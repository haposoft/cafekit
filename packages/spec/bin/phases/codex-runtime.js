'use strict';

const fs = require('fs');
const path = require('path');
const { PLATFORMS } = require('../lib/context');
const { writeManagedFile, copyManagedTree } = require('../lib/managed-writer');
const { report, treeAction } = require('./report');
const { isGeneratedArtifact } = require('../lib/copy-utils');
const { copyRulesDirectory, copyOutputStylesDirectory, removeObsoleteRuntimeFiles } = require('./claude-runtime');
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

/** Use the shared ownership and symlink checks for Codex runtime cleanup. */
function removeObsoleteCodexHooks(ctx, platformKey) {
  removeObsoleteRuntimeFiles(ctx, platformKey);
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

  const hooksSource = path.join(CODEX_SRC, 'hooks');
  const libsSource = path.join(hooksSource, 'lib');
  const shimPattern = /^(?:['"]use strict['"];?\s*)?module\.exports\s*=\s*require\(['"]\.\.\/\.\.\/\.\.\/claude\/hooks\/lib\/([^'"/]+)['"]\);?\s*$/;
  const sharedLibraries = fs.readdirSync(libsSource).filter(name => {
    const file = path.join(libsSource, name);
    if (!fs.lstatSync(file).isFile()) return false;
    const match = fs.readFileSync(file, 'utf8').match(shimPattern);
    return match && match[1] === name;
  });
  const agg = { created: 0, updated: 0, unchanged: 0, preserved: 0, missing: 0 };
  const copyHookEntry = relative => {
    if (isGeneratedArtifact(path.basename(relative))) return;
    const child = copyManagedTree({
      src: path.join(hooksSource, relative),
      dest: path.join(platform.folder, 'hooks', relative),
      sourceRoot: hooksSource,
      platformFolder: platform.folder, ctx, tracker: ctx.trackers[platformKey]
    });
    for (const key of Object.keys(agg)) agg[key] += child[key];
  };
  for (const name of fs.readdirSync(hooksSource)) {
    if (name !== 'lib') copyHookEntry(name);
    else for (const lib of fs.readdirSync(libsSource)) {
      if (!sharedLibraries.includes(lib)) copyHookEntry(path.join('lib', lib));
    }
  }
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
  const helperLabels = {
    'privacy-command-analysis.cjs': 'Codex privacy command analyzer',
    'privacy-paths.cjs': 'Codex privacy path analyzer',
    'secret-keywords.cjs': 'Codex secret keyword matcher',
    'runtime-path-safety.cjs': 'Codex runtime path safety',
    'inspect-paths.cjs': 'Codex inspection path analyzer',
    'spec-touch.cjs': 'Codex spec touch helpers',
    'update-check.cjs': 'Codex update check'
  };
  for (const name of sharedLibraries) {
    writeSourceFile(ctx, platformKey,
      path.join(SRC, 'claude', 'hooks', 'lib', name),
      path.join(platform.folder, 'hooks', 'lib', name),
      helperLabels[name] || `Codex hook helper: ${name}`);
  }
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
  copyRulesDirectory(ctx, platformKey, new Set(fs.readdirSync(path.join(CODEX_SRC, 'rules'))));
  copyOutputStylesDirectory(ctx, platformKey);
  installNativeRuleOverrides(ctx, platformKey);
  installManagedAgentsMd(ctx);
  return ctx;
}

module.exports = { installCodexRuntime };
