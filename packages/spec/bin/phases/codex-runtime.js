'use strict';

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');
const { writeManagedFile, copyManagedTree } = require('../lib/managed-writer');
const { report, treeAction } = require('./report');
const { copyRulesDirectory, copyOutputStylesDirectory } = require('./claude-runtime');
const {
  managedRange,
  upsertManagedCodexBlock
} = require('../lib/codex-install');
const { mergeCodexHooks } = require('./codex-hooks');

const SRC = path.join(__dirname, '../../src');
const CODEX_SRC = path.join(SRC, 'codex');

// hooks.json is merged by `codex-hooks.js`, not copied: it is a shared config file
// the user also writes to, so a verbatim copy would either preserve CafeKit's stale
// hooks or destroy the user's.
const CODEX_OWN_RUNTIME = [
  ['gitignore', '.gitignore'],
  ['runtime.json', 'runtime.json']
];

/**
 * Delete hooks the manifest marks obsolete. Codex tracker keys are project-relative
 * (`.codex/hooks/…`), so the record is pruned through keyFor, and always: a record whose
 * file is already gone must still leave the manifest.
 */
function removeObsoleteCodexHooks(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const tracker = ctx.trackers && ctx.trackers[platformKey];
  const obsoleteHooks = (ctx.manifest?.obsolete?.runtimeFiles || []).filter((rel) => rel.startsWith('hooks/'));
  for (const rel of obsoleteHooks) {
    const target = path.join(platform.folder, rel);
    const exists = fs.existsSync(target);
    if (!ctx.dryRun) {
      if (exists) fs.rmSync(target, { force: true, recursive: fs.statSync(target).isDirectory() });
      if (tracker) tracker.prune(tracker.keyFor(target));
    }
    if (exists) {
      ctx.ui.detail(`  ↻ ${ctx.dryRun ? '[dry-run] ' : ''}Removed obsolete Codex runtime: ${rel}`);
      ctx.results.updated++;
    }
  }
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

function installRuntimeFiles(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  for (const [sourceRel, targetRel] of CODEX_OWN_RUNTIME) {
    writeSourceFile(
      ctx,
      platformKey,
      path.join(CODEX_SRC, sourceRel),
      path.join(platform.folder, targetRel),
      `Codex runtime: ${targetRel}`
    );
  }
  writeSourceFile(
    ctx,
    platformKey,
    path.join(CODEX_SRC, 'agents-gitignore'),
    path.join('.agents', '.gitignore'),
    'Codex skills: .agents/.gitignore'
  );

  mergeCodexHooks(ctx, platformKey);

  const agg = copyManagedTree({
    src: path.join(CODEX_SRC, 'hooks'),
    dest: path.join(platform.folder, 'hooks'),
    platformFolder: platform.folder,
    ctx,
    tracker: ctx.trackers[platformKey]
  });
  report(ctx, treeAction(agg), 'Codex native hooks');
  removeObsoleteCodexHooks(ctx, platformKey);
  // Keep one canonical command analyzer in the Claude source tree, then
  // materialize the same bytes into the installed Codex runtime.
  // One canonical runtime schema lives in the Claude source tree; both installed
  // runtimes reference it as ./runtime.schema.json beside their runtime.json.
  writeSourceFile(
    ctx,
    platformKey,
    path.join(SRC, 'claude', 'runtime.schema.json'),
    path.join(platform.folder, 'runtime.schema.json'),
    'Codex runtime schema'
  );
  writeSourceFile(
    ctx,
    platformKey,
    path.join(SRC, 'claude', 'hooks', 'lib', 'privacy-command-analysis.cjs'),
    path.join(platform.folder, 'hooks', 'lib', 'privacy-command-analysis.cjs'),
    'Codex privacy command analyzer'
  );
  writeSourceFile(
    ctx,
    platformKey,
    path.join(SRC, 'claude', 'hooks', 'lib', 'secret-keywords.cjs'),
    path.join(platform.folder, 'hooks', 'lib', 'secret-keywords.cjs'),
    'Codex secret keyword matcher'
  );
  writeSourceFile(
    ctx,
    platformKey,
    path.join(SRC, 'claude', 'hooks', 'lib', 'runtime-path-safety.cjs'),
    path.join(platform.folder, 'hooks', 'lib', 'runtime-path-safety.cjs'),
    'Codex runtime path safety'
  );
}

function installNativeRuleOverrides(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  const source = path.join(CODEX_SRC, 'rules');
  if (!fs.existsSync(source)) return;
  const agg = copyManagedTree({
    src: source,
    dest: path.join(platform.folder, 'rules'),
    platformFolder: platform.folder,
    ctx,
    tracker: ctx.trackers[platformKey]
  });
  report(ctx, treeAction(agg), 'Codex native rule overrides');
}

function installManagedAgentsMd(ctx) {
  const runtimeSource = path.join(CODEX_SRC, 'AGENTS.md');
  if (!fs.existsSync(runtimeSource)) {
    report(ctx, 'missing', 'Codex AGENTS.md template');
    return;
  }

  const destination = 'AGENTS.md';
  const exists = fs.existsSync(destination);
  const existing = exists ? fs.readFileSync(destination, 'utf8') : '';
  if (managedRange(existing) === false) {
    ctx.ui.warn(`AGENTS.md: malformed CafeKit CODEX marker topology; preserved ${destination} without writing`);
    ctx.results.errors++;
    return;
  }
  // This template is already Codex-native. Running it through the generic
  // Claude-to-Codex converter corrupts intentional cross-runtime wording such
  // as the fail-safe instruction for Claude Code to ignore this block.
  const block = fs.readFileSync(runtimeSource, 'utf8');
  const next = upsertManagedCodexBlock(existing, block);
  const action = !exists ? 'created' : next === existing ? 'unchanged' : 'updated';

  if (!ctx.dryRun && action !== 'unchanged') {
    fs.writeFileSync(destination, next, 'utf8');
  }
  report(ctx, action, 'AGENTS.md (CafeKit Codex block)');
}

function installCodexRuntime(ctx, platformKey) {
  if (platformKey !== 'codex') return ctx;
  installRuntimeFiles(ctx, platformKey);
  copyRulesDirectory(ctx, platformKey);
  copyOutputStylesDirectory(ctx, platformKey);
  installNativeRuleOverrides(ctx, platformKey);
  installManagedAgentsMd(ctx);
  return ctx;
}

module.exports = { installCodexRuntime };
