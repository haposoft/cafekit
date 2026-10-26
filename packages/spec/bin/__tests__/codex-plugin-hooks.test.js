'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const BUILD = path.resolve(__dirname, '../../scripts/build-codex-plugin.mjs');
const INSTALL = path.resolve(__dirname, '../install.js');
const UID = typeof process.getuid === 'function' ? process.getuid() : 'user';
let lib;
let work;
let tree;
let handlers;

function walk(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? [`${full}/`, ...walk(full)] : [full];
  }).sort();
}

function git(cwd, ...args) {
  const run = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

function repo(name, setup = () => {}) {
  const dir = path.join(work, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n');
  fs.writeFileSync(path.join(dir, '.env'), 'EXAMPLE=placeholder\n');
  setup(dir);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'fixture');
  return dir;
}

function packet(dir, status) {
  fs.mkdirSync(path.join(dir, 'specs/demo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'specs/demo/plan.md'), '# Demo\nSpecs-Contract: process-first-ready-v1\n\n## Tasks\n| # | Task | Status |\n|---|---|---|\n| 01 | Demo | pending |\n');
  fs.writeFileSync(path.join(dir, 'specs/demo/task-01-demo.md'), `# Task 01 — Demo\n\nStatus: ${status}\n\n## Dependencies\n- none\n\n## Verification Plan\n- Command: \`test -f README.md\`\n\n## Receipt\n`);
}

function handler(event, script) {
  const found = handlers.find((h) => h.event === event && h.command.includes(`/hooks/${script}"`));
  assert.ok(found, `no ${event} handler for ${script}`);
  return found.command;
}

// Runs one plugin hook through its generated launcher, the way Codex starts it.
function run(event, script, cwd, payload = {}, env = {}) {
  const result = spawnSync('sh', ['-c', handler(event, script)], {
    cwd,
    input: JSON.stringify({ session_id: 'plugin-hooks-test', hook_event_name: event, cwd, ...payload }),
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, HOME: path.join(work, 'home'), PLUGIN_ROOT: tree, CLAUDE_PLUGIN_ROOT: tree, PLUGIN_DATA: path.join(work, 'data'), CLAUDE_PLUGIN_DATA: path.join(work, 'data'), ...env },
  });
  return result;
}

const ALL = [
  ['SessionStart', 'session.cjs', { source: 'startup' }],
  ['UserPromptSubmit', 'rules.cjs', { prompt: 'hello' }],
  ['PreToolUse', 'privacy-block.cjs', { tool_name: 'Bash', tool_input: { command: 'ls' } }],
  ['PreToolUse', 'inspect-block.cjs', { tool_name: 'Bash', tool_input: { command: 'ls' } }],
  ['PostToolUse', 'spec-state.cjs', { tool_name: 'apply_patch', tool_input: { command: '' }, tool_response: {} }],
  ['PreCompact', 'precompact.cjs', { trigger: 'manual' }],
  ['Stop', 'spec-gate.cjs', { stop_hook_active: false }],
  ['Stop', 'state.cjs', { stop_hook_active: false }],
];

before(async () => {
  lib = await import(BUILD);
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-codex-plugin-hooks-'));
  tree = lib.build(path.join(work, 'plugin', 'cf-codex'));
  const { hooks } = JSON.parse(fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8'));
  handlers = Object.entries(hooks).flatMap(([event, groups]) => groups.flatMap((g) => g.hooks.map((h) => ({ event, ...h }))));
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

test('gate-blocks-in-payload-repo: Stop blocks a done task without a receipt in the payload repository', () => {
  const dir = repo('gate', (d) => packet(d, 'done'));
  const result = run('Stop', 'spec-gate.cjs', dir, { stop_hook_active: false });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"decision":"block"/);
  assert.match(result.stdout, /task-01-demo\.md/);
});

test('privacy-uses-payload-repo: reading the payload repository .env is denied and the approval is keyed to it', () => {
  const dir = repo('privacy');
  const data = path.join(work, 'privacy-data');
  const result = run('PreToolUse', 'privacy-block.cjs', dir, { tool_name: 'Bash', tool_input: { command: 'cat .env' } }, { PLUGIN_DATA: data, CLAUDE_PLUGIN_DATA: data });
  assert.match(result.stdout, /"permissionDecision":"deny"/);
  const key = crypto.createHash('sha256').update(fs.realpathSync(dir)).digest('hex').slice(0, 16);
  assert.ok(walk(path.join(data, 'projects', key, 'privacy')).some((p) => !p.endsWith('/')), 'no pending approval stored for this repository');
});

test('nothing-written-outside-data: every hook leaves the repository, the plugin tree and its parent unchanged', () => {
  const dir = repo('clean', (d) => fs.mkdirSync(path.join(d, '.codex')) || fs.writeFileSync(path.join(d, '.codex/runtime.json'), '{}\n'));
  const data = path.join(work, 'clean-data');
  // Git's own .git/ files (an index refresh, a lock left by a timed-out git call) are not
  // CafeKit state, so the working tree is compared and git must report it clean.
  const worktree = () => walk(dir).filter((p) => !p.startsWith(path.join(dir, '.git') + path.sep) && p !== `${path.join(dir, '.git')}/`);
  const before = [worktree(), walk(path.join(work, 'plugin'))];
  for (const [event, script, payload] of ALL) {
    const result = run(event, script, dir, payload, { PLUGIN_DATA: data, CLAUDE_PLUGIN_DATA: data });
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
  }
  assert.deepEqual([worktree(), walk(path.join(work, 'plugin'))], before);
  assert.equal(git(dir, 'status', '--porcelain'), '', 'the hooks left changes in the repository');
  assert.ok(walk(data).some((p) => !p.endsWith('/')), 'no state under PLUGIN_DATA');
});

test('tmp-root-0700: without PLUGIN_DATA, state goes to a private per-user temp directory', () => {
  const dir = repo('tmp');
  const tmp = fs.mkdtempSync(path.join(work, 'tmp-'));
  for (const [event, script, payload] of ALL) run(event, script, dir, payload, { PLUGIN_DATA: '', CLAUDE_PLUGIN_DATA: '', TMPDIR: tmp });
  const root = path.join(tmp, `cafekit-codex-plugin-${UID}`);
  assert.ok(fs.lstatSync(root).isDirectory());
  assert.equal(fs.statSync(root).mode & 0o777, 0o700);
});

test('foreign-tmp-fail-closed: a temp state root this user does not safely own makes privacy deny', () => {
  const dir = repo('foreign');
  const tmp = fs.mkdtempSync(path.join(work, 'tmp-foreign-'));
  const elsewhere = fs.mkdtempSync(path.join(work, 'elsewhere-'));
  fs.symlinkSync(elsewhere, path.join(tmp, `cafekit-codex-plugin-${UID}`));
  const result = run('PreToolUse', 'privacy-block.cjs', dir, { tool_name: 'Bash', tool_input: { command: 'cat .env' } }, { PLUGIN_DATA: '', CLAUDE_PLUGIN_DATA: '', TMPDIR: tmp });
  assert.match(result.stdout, /"permissionDecision":"deny"/);
  assert.deepEqual(walk(elsewhere), [], 'state was written through the planted symlink');
});

test('no-npx-notice: the plugin session hook prints no npx update notice and keeps the update cache', () => {
  const dir = repo('notice', (d) => {
    fs.mkdirSync(path.join(d, '.codex'));
    fs.writeFileSync(path.join(d, '.codex/cafekit.json'), JSON.stringify({ version: '0.0.1' }));
  });
  const cache = path.join(dir, '.codex/.cafekit-update-cache.json');
  const bytes = JSON.stringify({ ts: Date.now(), latest: '99.0.0' });
  fs.writeFileSync(cache, bytes);
  const result = run('SessionStart', 'session.cjs', dir, { source: 'startup' });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /npx @haposoft\/cafekit/);
  assert.equal(fs.readFileSync(cache, 'utf8'), bytes);
});

test('defaults-without-runtime: without .codex/runtime.json the rules hook still injects the repository paths', () => {
  const dir = repo('defaults');
  const result = run('UserPromptSubmit', 'rules.cjs', dir, { prompt: 'hello', session_id: 'defaults-session' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(path.join(fs.realpathSync(dir), 'specs')), result.stdout);
});

function npxRepo(name) {
  const dir = repo(name);
  const install = spawnSync('node', [INSTALL, '--platform', 'codex', '-y'], { cwd: dir, encoding: 'utf8', env: { ...process.env, HOME: path.join(work, `home-${name}`) } });
  assert.equal(install.status, 0, install.stderr || install.stdout);
  return dir;
}

test('silent-beside-npx: with the npx Codex hooks active in the repository, plugin hooks stand down and say so once', () => {
  const dir = npxRepo('beside');
  const session = run('SessionStart', 'session.cjs', dir, { source: 'startup' });
  assert.equal(session.status, 0, session.stderr);
  assert.match(session.stdout, /CafeKit plugin is idle/);
  assert.match(session.stdout, /\$cf-/, 'the notice names the duplicate skills');
  assert.match(session.stdout, /trusted in \/hooks/, 'the notice says the gates depend on trusting the npx hooks');
  const privacy = run('PreToolUse', 'privacy-block.cjs', dir, { tool_name: 'Bash', tool_input: { command: 'cat .env' } });
  assert.equal(privacy.status, 0);
  assert.equal(privacy.stdout, '', 'the plugin hook acted beside the npx hooks');
  const rules = run('UserPromptSubmit', 'rules.cjs', dir, { prompt: 'hi', session_id: 'beside-rules' });
  assert.equal(rules.stdout, '');
});

test('planted-hooks-json-keeps-gates: a hooks.json without real npx hooks behind it does not switch the plugin off', () => {
  const cases = {
    planted: { description: 'x /.codex/hooks/ x', hooks: {} },
    foreignMachine: { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: "node '/Users/someone-else/project/.codex/hooks/privacy-block.cjs'" }] }] } },
    relativeScript: { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: "node './.codex/hooks/noop.cjs'" }] }] } },
  };
  // Absolute paths that still reach the repository's own hooks only through `..` or a
  // symlinked alias; on Linux /proc/self/cwd does the same through the hook's cwd.
  const alias = path.join(work, 'planted-alias-link');
  const command = (script) => ({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: `node '${script}'` }] }] } });
  cases.dotDot = (d) => command(`${fs.realpathSync(d)}/.codex/hooks/../hooks/noop.cjs`);
  cases.symlinkAlias = (d) => { fs.symlinkSync(fs.realpathSync(d), alias); return command(`${alias}/.codex/hooks/noop.cjs`); };
  for (const [name, entry] of Object.entries(cases)) {
    const dir = repo(`planted-${name}`, (d) => {
      const config = typeof entry === 'function' ? entry(d) : entry;
      fs.mkdirSync(path.join(d, '.codex/hooks'), { recursive: true });
      fs.writeFileSync(path.join(d, '.codex/hooks/noop.cjs'), '\n');
      fs.writeFileSync(path.join(d, '.codex/hooks.json'), JSON.stringify(config));
    });
    const result = run('PreToolUse', 'privacy-block.cjs', dir, { tool_name: 'Bash', tool_input: { command: 'cat .env' } });
    assert.match(result.stdout, /"permissionDecision":"deny"/, `${name}: the plugin stood down`);
  }
});

test('npx-installed-tree: npx-installed hooks keep their behavior, even with a plugin root inherited from the parent', () => {
  const dir = npxRepo('npx');
  for (const inherited of [false, true]) {
    const env = { ...process.env, HOME: path.join(work, 'home-npx') };
    delete env.PLUGIN_ROOT; delete env.CLAUDE_PLUGIN_ROOT; delete env.PLUGIN_DATA; delete env.CLAUDE_PLUGIN_DATA;
    if (inherited) Object.assign(env, { PLUGIN_ROOT: tree, CLAUDE_PLUGIN_ROOT: tree });
    const payload = { session_id: `npx-${inherited}`, hook_event_name: 'PreToolUse', cwd: dir, tool_name: 'Bash', tool_input: { command: 'cat .env' } };
    const result = spawnSync('node', [path.join(dir, '.codex/hooks/privacy-block.cjs')], { cwd: dir, input: JSON.stringify(payload), encoding: 'utf8', env });
    assert.match(result.stdout, /"permissionDecision":"deny"/, `inherited=${inherited}`);
    assert.ok(fs.existsSync(path.join(dir, '.codex/hooks/.privacy')), 'npx privacy state left its project location');
  }
});
