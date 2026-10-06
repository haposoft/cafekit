/**
 * Phase: Claude/runtime file installation.
 *
 * ROUTING.md, runtime files (hooks/status/gitignore/runtime.json), obsolete
 * runtime cleanup, CLAUDE.md, and the rules/ tree. All copies are
 * ownership-aware — notably CLAUDE.md and rules/ no longer force-overwrite, so
 * user edits survive re-installs (the latent wipe is fixed).
 */

const fs = require('fs');
const path = require('path');
const {
  PLATFORMS,
  hasPlatformCapability,
  getRuntimeSupportTargetDir,
  getCopyOptions
} = require('../lib/context');
const { sha256 } = require('../lib/manifest');
const { writeManagedFile, copyManagedTree } = require('../lib/managed-writer');
const { report, treeAction } = require('./report');
const {
  upsertManagedCoreBlock,
  managedRange,
  migrateExactLegacyBlock,
  preserveAddressingSection
} = require('../lib/instruction-blocks');

const SRC = path.join(__dirname, '../../src');
const CLAUDE_START = '<!-- CAFEKIT CLAUDE START -->';
const CLAUDE_END = '<!-- CAFEKIT CLAUDE END -->';
const LEGACY_CORE_START = '<!-- CAFEKIT CLAUDE AGENTS START -->';
const LEGACY_CORE_END = '<!-- CAFEKIT CLAUDE AGENTS END -->';

function managedClaudeBlock(template) {
  return `${CLAUDE_START}\n${template.trimEnd()}\n${CLAUDE_END}`;
}

function managedClaudeRange(content) {
  const start = content.indexOf(CLAUDE_START);
  const endStart = content.indexOf(CLAUDE_END);
  if (start === -1 && endStart === -1) return null;
  const duplicateStart = content.indexOf(CLAUDE_START, start + CLAUDE_START.length);
  const duplicateEnd = content.indexOf(CLAUDE_END, endStart + CLAUDE_END.length);
  if (start === -1 || endStart <= start || duplicateStart >= 0 || duplicateEnd >= 0) return false;
  return { start, end: endStart + CLAUDE_END.length, bodyStart: start + CLAUDE_START.length, bodyEnd: endStart };
}

/** Transform only the CafeKit-owned body, preserving all surrounding bytes. */
function transformManagedClaudeContent(content, transform) {
  const range = managedClaudeRange(content);
  if (!range) return content;
  const body = content.slice(range.bodyStart, range.bodyEnd);
  return `${content.slice(0, range.bodyStart)}${transform(body)}${content.slice(range.bodyEnd)}`;
}

function upsertManagedClaudeBlock(existing, template, legacyOwned) {
  // When an existing managed block present, reinstall replaces it. If the new
  // template dropped its Addressing section, carry the saved section over from
  // the existing managed block so the user's address survives for setupAddressing.
  const existingRange = managedClaudeRange(existing);
  if (existingRange === false) return existing;
  const existingManagedBody = existingRange
    ? existing.slice(existingRange.bodyStart, existingRange.bodyEnd)
    : '';
  let body = template;
  if (existingRange) {
    body = preserveAddressingSection(template, existingManagedBody);
  }
  const block = managedClaudeBlock(body);
  const range = managedClaudeRange(existing);
  if (range) {
    return `${existing.slice(0, range.start)}${block}${existing.slice(range.end)}`;
  }

  // Whole-file migration is deliberately limited to exact shipped content or
  // a file whose bytes still match the legacy ownership manifest.
  if (existing === template || legacyOwned) return `${block}\n`;
  if (!existing) return `${block}\n`;

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${block}\n`;
}

function ensureSharedAgentsMdCore(ctx) {
  const src = path.join(SRC, 'common/AGENTS.md');
  const dest = 'AGENTS.md';
  if (!fs.existsSync(src)) {
    ctx.ui.warn('Shared AGENTS.md template not found');
    ctx.results.missingDependencies++;
    return;
  }

  const template = fs.readFileSync(src, 'utf8');
  const exists = fs.existsSync(dest);
  const existing = exists ? fs.readFileSync(dest, 'utf8') : '';
  if (managedRange(existing) === false) {
    ctx.ui.warn(`AGENTS.md: malformed CafeKit CORE marker topology; preserved ${dest} without writing`);
    ctx.results.errors++;
    return;
  }
  const migrated = migrateExactLegacyBlock(
    existing,
    LEGACY_CORE_START,
    LEGACY_CORE_END,
    template
  );
  const next = upsertManagedCoreBlock(migrated, template);
  const action = !exists ? 'created' : next === existing ? 'unchanged' : 'updated';

  if (!ctx.dryRun && action !== 'unchanged') {
    fs.writeFileSync(dest, next, 'utf8');
  }
  report(ctx, action, 'AGENTS.md (shared CafeKit core)');
}

/** Install the shared AGENTS.md core used by Claude's @AGENTS.md import. */
function copyClaudeAgentsMdFile(ctx, platformKey) {
  if (platformKey !== 'claude') return;
  ensureSharedAgentsMdCore(ctx);
}

/** Copy ROUTING.md (SKILLS_DIR substituted). */
function copyRoutingFile(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const src = path.join(SRC, platform.sourceDir, 'ROUTING.md');
  const dest = path.join(platform.folder, 'ROUTING.md');
  if (!fs.existsSync(src)) return;

  const transform = (content) => {
    let c = content.replace(/\{\{SKILLS_DIR\}\}/g, platform.skillsRef);
    return c;
  };
  const { action } = writeManagedFile({
    src, dest, platformFolder: platform.folder, ctx, tracker: ctx.trackers[platformKey], transform
  });
  report(ctx, action, 'ROUTING.md');
}

/** Copy Claude runtime files declared in the migration manifest. Claude only. */
function copyClaudeRuntimeFiles(ctx, platformKey) {
  if (platformKey !== 'claude') return;
  const manifest = ctx.manifest;
  if (!manifest?.runtime?.files) return;

  const srcBase = path.join(SRC, 'claude');
  const targetBase = PLATFORMS.claude.folder;
  const tracker = ctx.trackers.claude;

  manifest.runtime.files.forEach((relPath) => {
    const srcPath = path.join(srcBase, relPath);
    const targetRelPath = relPath === 'gitignore' ? '.gitignore' : relPath;
    const targetPath = path.join(targetBase, targetRelPath);

    if (!fs.existsSync(srcPath)) {
      ctx.ui.warn(`Runtime file not found: ${relPath}`);
      ctx.results.missingDependencies++;
      return;
    }

    const { action } = writeManagedFile({
      src: srcPath, dest: targetPath, platformFolder: targetBase, ctx, tracker
    });
    report(ctx, action, `Runtime: ${targetRelPath}`);
  });
}

/** Delete runtime files marked obsolete by the manifest. Claude only. */
function removeObsoleteClaudeRuntimeFiles(ctx, platformKey) {
  if (platformKey !== 'claude') return;

  const obsoleteFiles = ctx.manifest?.obsolete?.runtimeFiles || [];
  const targetBase = PLATFORMS.claude.folder;

  obsoleteFiles.forEach((relPath) => {
    const targetPath = path.join(targetBase, relPath);
    if (!fs.existsSync(targetPath)) return;

    const isDir = fs.statSync(targetPath).isDirectory();
    if (!ctx.dryRun) {
      fs.rmSync(targetPath, { force: true, recursive: isDir });
      // Remove the entry from the manifest so it doesn't linger as a zombie.
      if (ctx.trackers && ctx.trackers.claude) {
        ctx.trackers.claude.prune(relPath);
        // Directories: prune every tracked file underneath as well.
        if (isDir) ctx.trackers.claude.prunePrefix(`${relPath}/`);
      }
    }
    ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Removed obsolete runtime: ${relPath}`);
    ctx.results.updated++;
  });
}

/** Remove renamed agents only when ownership manifest proves pristine bytes. */
function removeObsoleteAgents(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const obsolete = ctx.manifest?.obsolete?.agents?.[platformKey] || [];
  const tracker = ctx.trackers?.[platformKey];
  if (!platform || !tracker || obsolete.length === 0) return;

  const ownership = ctx.ownership?.[platform.folder] || { files: {} };
  for (const relPath of obsolete) {
    const targetPath = path.join(platform.folder, relPath);
    if (!fs.existsSync(targetPath)) continue;

    const key = tracker.keyFor(targetPath);
    const recorded = ownership.files?.[key];
    const currentHash = sha256(fs.readFileSync(targetPath));
    if (recorded?.sha256 === currentHash) {
      if (!ctx.dryRun) {
        fs.rmSync(targetPath, { force: true });
        tracker.prune(key);
      }
      ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Removed obsolete agent: ${targetPath}`);
      ctx.results.updated++;
      continue;
    }

    ctx.ui.warn(`Preserved user-owned obsolete agent: ${targetPath}`);
    ctx.results.preserved++;
    ctx.results.preservedFiles.push(targetPath);
  }
}

/** Install CLAUDE.md at the project root (ownership-aware). Claude only. */
function copyClaudeMdFile(ctx, platformKey) {
  if (platformKey !== 'claude') return;

  const src = path.join(SRC, 'claude/CLAUDE.md');
  const dest = 'CLAUDE.md'; // project root
  if (!fs.existsSync(src)) {
    ctx.ui.warn('CLAUDE.md template not found');
    ctx.results.missingDependencies++;
    return;
  }

  const tracker = ctx.trackers.claude;
  // Older releases recorded the root file relative to .claude/. Never retain
  // that whole-file ownership claim, even when this run makes no content change.
  if (tracker) tracker.prune('../CLAUDE.md');

  const template = fs.readFileSync(src, 'utf8');
  const exists = fs.existsSync(dest);
  const existing = exists ? fs.readFileSync(dest, 'utf8') : '';
  if (managedClaudeRange(existing) === false) {
    ctx.ui.warn(`CLAUDE.md: malformed CafeKit CLAUDE marker topology; preserved ${dest} without writing`);
    ctx.results.errors++;
    return;
  }
  const legacyRecord = ctx.ownership?.[PLATFORMS.claude.folder]?.files?.['../CLAUDE.md'];
  const legacyOwned = Boolean(legacyRecord && legacyRecord.sha256 === sha256(existing));
  const next = upsertManagedClaudeBlock(existing, template, legacyOwned);
  const action = !exists ? 'created' : next === existing ? 'unchanged' : 'updated';

  if (!ctx.dryRun && action !== 'unchanged') {
    fs.writeFileSync(dest, next, 'utf8');
  }
  report(ctx, action, 'CLAUDE.md');
}

/** Copy the rules/ tree (ownership-aware; no longer force-overwrites). */
function copyRulesDirectory(ctx, platformKey) {
  if (!hasPlatformCapability(platformKey, 'rules')) return;

  const src = path.join(SRC, 'claude/rules');
  const dest = getRuntimeSupportTargetDir(platformKey, 'rules');
  if (!fs.existsSync(src)) {
    ctx.ui.warn('rules/ directory not found');
    ctx.results.missingDependencies++;
    return;
  }

  const transform = getCopyOptions(platformKey, {}).transform;
  const agg = copyManagedTree({
    src, dest, platformFolder: PLATFORMS[platformKey].folder, ctx, tracker: ctx.trackers[platformKey], transform
  });
  report(ctx, treeAction(agg), 'rules/ directory');
}

/**
 * Copy the output-styles/ tree from the one canonical source. Claude Code discovers
 * these natively under `.claude/`; Codex CLI has no output-style feature, so its rules
 * hook reads the selected file and injects it once per session instead.
 */
function copyOutputStylesDirectory(ctx, platformKey) {

  const src = path.join(SRC, 'claude/output-styles');
  const dest = getRuntimeSupportTargetDir(platformKey, 'output-styles');
  if (!fs.existsSync(src)) {
    ctx.ui.warn('output-styles/ directory not found');
    ctx.results.missingDependencies++;
    return;
  }

  const transform = getCopyOptions(platformKey, {}).transform;
  const agg = copyManagedTree({
    src, dest, platformFolder: PLATFORMS[platformKey].folder, ctx, tracker: ctx.trackers[platformKey], transform
  });
  report(ctx, treeAction(agg), 'output-styles/ directory');
}

module.exports = {
  copyRoutingFile,
  copyOutputStylesDirectory,
  copyClaudeRuntimeFiles,
  removeObsoleteClaudeRuntimeFiles,
  copyClaudeMdFile,
  copyClaudeAgentsMdFile,
  ensureSharedAgentsMdCore,
  copyRulesDirectory,
  removeObsoleteAgents,
  transformManagedClaudeContent
};
