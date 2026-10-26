'use strict';

const fs = require('fs');
const path = require('path');
const { PLATFORMS, getCopyOptions } = require('../lib/context');
const { writeManagedFile } = require('../lib/managed-writer');
const { report, treeAction } = require('./report');
const { isGeneratedArtifact } = require('../lib/copy-utils');
const { removeObsoleteRuntimeFiles } = require('./claude-runtime');
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

// A shim in src/codex/hooks/lib re-exports one Claude library so the source tree
// keeps a single copy; installs ship the real Claude file in its place.
const SHIM_PATTERN = /^(?:['"]use strict['"];?\s*)?module\.exports\s*=\s*require\(['"]\.\.\/\.\.\/\.\.\/claude\/hooks\/lib\/([^'"/]+)['"]\);?\s*$/;

function isCodexShim(file, name) {
  const match = fs.readFileSync(file, 'utf8').match(SHIM_PATTERN);
  return Boolean(match && match[1] === name);
}

/**
 * The Codex runtime files and where they land under the runtime root, shared by
 * this installer and the Codex plugin build so the two cannot drift apart.
 * Each entry: { src, dest (relative), group, transform: 'codex-body' | null }.
 */
function codexRuntimeLayout() {
  const entries = [];
  const add = (src, dest, group, transform = null) => entries.push({ src, dest, group, transform });
  const hookDir = path.join(CODEX_SRC, 'hooks');
  const libDir = path.join(hookDir, 'lib');
  // Hooks ship file by file; a directory or symlink here would be dropped silently.
  const requireFile = (file) => {
    if (!fs.lstatSync(file).isFile()) throw new Error(`Codex runtime layout expects a regular file: ${file}`);
    return file;
  };
  for (const name of fs.readdirSync(hookDir)) {
    if (name !== 'lib' && !isGeneratedArtifact(name)) add(requireFile(path.join(hookDir, name)), `hooks/${name}`, 'hooks');
  }
  const sharedLibraries = [];
  for (const name of fs.readdirSync(libDir)) {
    if (isGeneratedArtifact(name)) continue;
    const file = requireFile(path.join(libDir, name));
    if (isCodexShim(file, name)) sharedLibraries.push(name);
    else add(file, `hooks/lib/${name}`, 'hooks');
  }
  add(path.join(SRC, 'claude', 'runtime.schema.json'), 'runtime.schema.json', 'schema');
  for (const name of sharedLibraries) add(path.join(SRC, 'claude', 'hooks', 'lib', name), `hooks/lib/${name}`, 'shared-lib');
  const overrides = fs.readdirSync(path.join(CODEX_SRC, 'rules')).filter((name) => !isGeneratedArtifact(name));
  for (const name of fs.readdirSync(path.join(SRC, 'claude', 'rules'))) {
    if (!overrides.includes(name) && !isGeneratedArtifact(name)) add(path.join(SRC, 'claude', 'rules', name), `rules/${name}`, 'rules', 'codex-body');
  }
  for (const name of fs.readdirSync(path.join(SRC, 'claude', 'output-styles'))) {
    if (!isGeneratedArtifact(name)) add(path.join(SRC, 'claude', 'output-styles', name), `output-styles/${name}`, 'output-styles', 'codex-body');
  }
  for (const name of overrides) add(path.join(CODEX_SRC, 'rules', name), `rules/${name}`, 'rule-overrides');
  return entries;
}

/** Every layout group in install order with its report label; null reports each file. */
const LAYOUT_GROUPS = [
  ['hooks', 'Codex native hooks'],
  ['schema', null],
  ['shared-lib', null],
  ['rules', 'rules/ directory'],
  ['output-styles', 'output-styles/ directory'],
  ['rule-overrides', 'Codex native rule overrides']
];

const SHARED_LIB_LABELS = {
  'runtime.schema.json': 'Codex runtime schema',
  'privacy-command-analysis.cjs': 'Codex privacy command analyzer',
  'privacy-paths.cjs': 'Codex privacy path analyzer',
  'secret-keywords.cjs': 'Codex secret keyword matcher',
  'runtime-path-safety.cjs': 'Codex runtime path safety',
  'inspect-paths.cjs': 'Codex inspection path analyzer',
  'spec-touch.cjs': 'Codex spec touch helpers',
  'update-check.cjs': 'Codex update check'
};

/** Write one layout group; `label` reports the group, or each file when omitted. */
function writeLayoutGroup(ctx, platformKey, entries, label) {
  const platform = PLATFORMS[platformKey];
  const bodyTransform = getCopyOptions(platformKey, {}).transform;
  const agg = { created: 0, updated: 0, unchanged: 0, preserved: 0, missing: 0 };
  for (const entry of entries) {
    const { action } = writeManagedFile({
      src: entry.src,
      dest: path.join(platform.folder, entry.dest),
      sourceRoot: SRC,
      platformFolder: platform.folder,
      ctx,
      tracker: ctx.trackers[platformKey],
      transform: entry.transform === 'codex-body' ? bodyTransform : undefined
    });
    if (label) {
      if (agg[action] !== undefined) agg[action]++;
    } else {
      const name = path.basename(entry.dest);
      report(ctx, action, SHARED_LIB_LABELS[name] || `Codex hook helper: ${name}`);
    }
  }
  if (label) report(ctx, treeAction(agg), label);
}

function installRuntimeFiles(ctx, platformKey) {
  const platform = PLATFORMS[platformKey];
  // Validate the whole layout before the first write, so a bad source cannot leave a partial install.
  const layout = codexRuntimeLayout();
  const unknown = layout.filter((entry) => !LAYOUT_GROUPS.some(([name]) => name === entry.group));
  if (unknown.length) throw new Error(`Codex runtime layout group not installed: ${unknown[0].group}`);
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

  for (const [name, label] of LAYOUT_GROUPS) {
    writeLayoutGroup(ctx, platformKey, layout.filter((entry) => entry.group === name), label);
    // Obsolete hook files go before the canonical schema and shared Claude libraries
    // are materialized, matching the order earlier installs used.
    if (name === 'hooks') removeObsoleteCodexHooks(ctx, platformKey);
  }
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
  installManagedAgentsMd(ctx);
  return ctx;
}

module.exports = { installCodexRuntime, codexRuntimeLayout, LAYOUT_GROUPS };
