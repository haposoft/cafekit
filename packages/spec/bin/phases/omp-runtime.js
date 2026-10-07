'use strict';

/**
 * Phase: Oh My Pi runtime.
 *
 * omp discovers `.claude/skills` and `.agents/skills` on its own, so CafeKit copies no
 * skill payload here. What omp does not have is CafeKit's enforcement chain, so this
 * phase provisions what carries it:
 *
 *   .omp/hooks/           the gate scripts: the Claude set, with omp's overlay on top
 *   .omp/extensions/      the bridge omp auto-loads, which dispatches those scripts
 *   .omp/runtime.json     the hooks' configuration, beside the schema that describes it
 *   .omp/rules/           the rules the hooks inject
 *
 * The hooks are portable: they derive their runtime directory from their own location,
 * so the Claude bytes run unchanged under `.omp/`. Only the files that genuinely differ
 * for omp live in `src/omp/hooks/` and are written over the Claude set afterwards, so a
 * change to a shared hook reaches omp without anyone remembering to re-fork it.
 */

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');
const { writeManagedFile, copyManagedTree } = require('../lib/managed-writer');
const { report, treeAction } = require('./report');
const { copyRulesDirectory } = require('./claude-runtime');

const SRC = path.join(__dirname, '../../src');
const CLAUDE_SRC = path.join(SRC, 'claude');
const OMP_SRC = path.join(SRC, 'omp');

/** Files under `src/omp/hooks/` that replace their Claude counterpart, relative to the hooks dir. */
function overlayFiles(dir = path.join(OMP_SRC, 'hooks'), prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const name of fs.readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(path.join(dir, name)).isDirectory()) found.push(...overlayFiles(path.join(dir, name), rel));
    else found.push(rel);
  }
  return found.sort();
}

/**
 * The Claude hook set is the list the migration manifest ships to `.claude/`, not a
 * directory walk: the source tree also holds `__tests__/`, which must never install.
 */
function claudeHookFiles(ctx) {
  const files = ctx.manifest?.runtime?.files || [];
  return files.filter((rel) => rel.startsWith('hooks/')).map((rel) => rel.slice('hooks/'.length));
}

function writeSourceFile(ctx, platformKey, src, dest, label) {
  const platform = PLATFORMS[platformKey];
  const { action } = writeManagedFile({
    src,
    dest,
    platformFolder: platform.folder,
    ctx,
    tracker: ctx.trackers[platformKey]
  });
  report(ctx, action, label);
}

function installHooks(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const overlay = new Set(overlayFiles());
  // Claude set first, skipping anything the overlay is about to replace so a file is
  // written once and the manifest records the bytes that actually land.
  for (const rel of claudeHookFiles(ctx)) {
    if (overlay.has(rel)) continue;
    writeSourceFile(
      ctx,
      platformKey,
      path.join(CLAUDE_SRC, 'hooks', rel),
      path.join(platform.folder, 'hooks', rel),
      `omp hooks: ${rel}`
    );
  }
  for (const rel of overlay) {
    writeSourceFile(
      ctx,
      platformKey,
      path.join(OMP_SRC, 'hooks', rel),
      path.join(platform.folder, 'hooks', rel),
      `omp hooks (overlay): ${rel}`
    );
  }
}

function installRuntimeFiles(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  writeSourceFile(
    ctx,
    platformKey,
    path.join(OMP_SRC, 'runtime.json'),
    path.join(platform.folder, 'runtime.json'),
    'omp runtime: runtime.json'
  );
  // One canonical runtime schema lives in the Claude source tree; every installed
  // runtime references it as ./runtime.schema.json beside its runtime.json.
  writeSourceFile(
    ctx,
    platformKey,
    path.join(CLAUDE_SRC, 'runtime.schema.json'),
    path.join(platform.folder, 'runtime.schema.json'),
    'omp runtime schema'
  );
}

function installBridge(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const bridgeSource = path.join(OMP_SRC, 'extensions');
  const bridgeDest = path.join(platform.folder, 'extensions');
  if (fs.existsSync(bridgeSource)) {
    const bridge = copyManagedTree({
      src: bridgeSource,
      dest: bridgeDest,
      platformFolder: platform.folder,
      ctx,
      tracker: ctx.trackers[platformKey]
    });
    report(ctx, treeAction(bridge), 'omp bridge extension');
  } else if (!ctx.dryRun) {
    // A half-provisioned install is visibly empty rather than silently absent.
    fs.mkdirSync(bridgeDest, { recursive: true });
    ctx.ui.detail('  ✓ omp extensions directory created (bridge not present)');
  }
}

/**
 * Delete hooks and scripts the manifest marks obsolete. Mirrors removeObsoleteClaudeRuntimeFiles, but the
 * omp tracker records keys relative to the project root (`.omp/hooks/…`), so the record is
 * pruned through keyFor rather than by the bare `hooks/…` path.
 */
function removeObsoleteOmpHooks(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const tracker = ctx.trackers && ctx.trackers[platformKey];
  const obsoleteHooks = (ctx.manifest?.obsolete?.runtimeFiles || []).filter((rel) => rel.startsWith('hooks/') || rel.startsWith('scripts/'));
  for (const rel of obsoleteHooks) {
    const target = path.join(platform.folder, rel);
    if (!fs.existsSync(target)) continue;
    if (!ctx.dryRun) {
      fs.rmSync(target, { force: true, recursive: fs.statSync(target).isDirectory() });
      if (tracker) tracker.prune(tracker.keyFor(target));
    }
    ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Removed obsolete omp runtime: ${rel}`);
    ctx.results.updated++;
  }
}

function installOmpRuntime(ctx, platformKey) {
  if (platformKey !== 'omp') return;
  installHooks(ctx, platformKey);
  removeObsoleteOmpHooks(ctx, platformKey);
  installRuntimeFiles(ctx, platformKey);
  installBridge(ctx, platformKey);
  copyRulesDirectory(ctx, platformKey);
  return ctx;
}

module.exports = { installOmpRuntime, overlayFiles, claudeHookFiles };
