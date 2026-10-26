'use strict';

// The Codex plugin cannot ship AGENTS.md and Codex substitutes nothing in skill text, so
// a plugin-only SessionStart hook injects the CafeKit core and defines {CAFEKIT_ROOT}
// and the {cafekit:<name>} commands. The npx install must never receive that hook.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPTS = path.resolve(__dirname, '../../scripts');
const INSTALL = path.resolve(__dirname, '../install.js');
const ROOT_LENGTH = 120;
let work;
let lib;
let tree;

before(async () => {
  work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-codex-context-')));
  lib = await import(path.join(SCRIPTS, 'build-codex-plugin.mjs'));
  // A plugin root of exactly ROOT_LENGTH characters, the size the core budget assumes.
  const pad = ROOT_LENGTH - work.length - '/cf-codex'.length - 1;
  assert.ok(pad > 0, `temp directory too long: ${work}`);
  tree = lib.build(path.join(work, 'p'.repeat(pad), 'cf-codex'));
  assert.equal(tree.length, ROOT_LENGTH);
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

function hook(root, { cwd = work, env = {} } = {}) {
  const base = { ...process.env, HOME: path.join(work, 'home'), PLUGIN_DATA: path.join(work, 'data'), CLAUDE_PLUGIN_DATA: path.join(work, 'data') };
  delete base.PLUGIN_ROOT; delete base.CLAUDE_PLUGIN_ROOT;
  const fullEnv = { ...base, ...(root ? { PLUGIN_ROOT: root, CLAUDE_PLUGIN_ROOT: root } : {}), ...env };
  const script = path.join(root || tree, 'plugin/hooks/plugin-context.cjs');
  return spawnSync('node', [script], { cwd, encoding: 'utf8', env: fullEnv, input: JSON.stringify({ session_id: 'ctx', hook_event_name: 'SessionStart', source: 'startup', cwd }) });
}

function context(root = tree, options) {
  const result = hook(root, options);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
}

test('emits-session-start-json: the hook prints the SessionStart JSON Codex reads, registered for every source', () => {
  const result = hook(tree);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(typeof output.hookSpecificOutput.additionalContext, 'string');
  const { hooks } = JSON.parse(fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8'));
  const group = hooks.SessionStart.find((g) => g.hooks.some((h) => h.command.includes('/plugin/hooks/plugin-context.cjs')));
  assert.ok(group, 'plugin-context is not registered on SessionStart');
  assert.deepEqual(group.matcher.split('|').sort(), ['clear', 'compact', 'resume', 'startup']);
  assert.match(group.hooks[0].commandWindows, /'plugin','hooks','plugin-context\.cjs'/);
});

test('core-under-10000-chars: with a 120-character plugin root the injected text stays within the host cap', () => {
  const text = context();
  assert.ok(text.length <= 10000, `${text.length} characters`);
});

test('marker-in-first-2000: the core marker sits in the first 2000 characters', () => {
  const index = context().indexOf('CAFEKIT-CODEX-CORE-LOADED');
  assert.ok(index >= 0 && index < 2000, `marker at ${index}`);
});

test('command-table-complete: every recorded script has one absolute command that runs', () => {
  const text = context();
  const names = lib.scriptCommands(tree);
  assert.ok(names.length > 0);
  const table = [...text.matchAll(/^ {2}- `\{cafekit:([A-Za-z0-9-]+)\}`: `(.+)`$/gm)];
  assert.deepEqual(table.map(([, name]) => name), names);
  assert.ok(!/\{cafekit:[A-Za-z0-9-]+\}/.test(text.replace(/^ {2}- `\{cafekit:[^\n]*$/gm, '')), 'a command is named outside the table');
  const scratch = fs.mkdtempSync(path.join(work, 'run-'));
  for (const [, name, command] of table) {
    assert.match(command, new RegExp(`^node '${tree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/scripts/${name}\\.cjs'$`));
    const run = spawnSync('sh', ['-c', `${command} --help`], { cwd: scratch, encoding: 'utf8', input: '' });
    assert.ok([0, 1, 2].includes(run.status), `${name}: exit ${run.status}`);
    assert.doesNotMatch(run.stderr, /Cannot find module|MODULE_NOT_FOUND/, name);
  }
});

test('rule-paths-exist: the root, the rules directory and every rules file named in the core exist', () => {
  const text = context();
  assert.match(text, new RegExp(`means \`${tree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\``));
  const section = text.slice(text.indexOf('## Detailed rules'));
  const dir = section.match(/`([^`]+\/rules)\/`/)[1];
  assert.equal(dir, path.join(tree, 'rules'));
  const files = [...section.matchAll(/`([a-z-]+\.md)`/g)].map(([, f]) => f);
  assert.ok(files.length >= 9, files.join(', '));
  for (const file of files) assert.ok(fs.existsSync(path.join(dir, file)), file);
  assert.doesNotMatch(text, /\{CAFEKIT_ROOT\}\//, 'an unresolved root token remains');
});

test('dollar-in-root: a plugin root containing `$&` is injected literally', () => {
  const root = path.join(work, 'dollar-$&-root', 'cf-codex');
  fs.cpSync(tree, root, { recursive: true });
  const text = context(root);
  assert.ok(text.includes(`means \`${root}\``));
  assert.ok(text.includes(`node '${root}/scripts/provenance.cjs'`));
});

test('silent-without-plugin-root: without a plugin root, or with one inherited from elsewhere, the hook prints nothing', () => {
  for (const env of [{}, { PLUGIN_ROOT: work, CLAUDE_PLUGIN_ROOT: work }]) {
    const result = hook(null, { env });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
  }
});

function walk(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test('npx-install-lacks-plugin-hook: an npx Codex install neither ships nor calls the plugin hook, and the plugin stands down beside it', () => {
  const repo = path.join(work, 'npx-repo');
  fs.mkdirSync(repo);
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const install = spawnSync('node', [INSTALL, '--platform', 'codex', '-y'], { cwd: repo, encoding: 'utf8', env: { ...process.env, HOME: path.join(work, 'npx-home') } });
  assert.equal(install.status, 0, install.stderr || install.stdout);
  const installed = walk(repo).filter((f) => !f.includes(`${path.sep}.git${path.sep}`));
  assert.deepEqual(installed.filter((f) => /plugin-context\.cjs$|script-commands\.json$/.test(f)), []);
  assert.ok(!installed.some((f) => fs.readFileSync(f).includes('CAFEKIT-CODEX-CORE-LOADED')), 'the plugin core reached the npx install');
  assert.doesNotMatch(fs.readFileSync(path.join(repo, '.codex/hooks.json'), 'utf8'), /plugin-context/);
  const beside = hook(tree, { cwd: repo });
  assert.equal(beside.status, 0, beside.stderr);
  assert.equal(beside.stdout, '');
});
