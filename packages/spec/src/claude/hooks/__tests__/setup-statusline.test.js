'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BUILD = path.resolve(__dirname, '../../../../scripts/build-claude-plugin.mjs');
let work;
let tree;

before(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-statusline-setup-'));
  tree = path.join(work, "plug'in", 'cf');
  const built = spawnSync('node', [BUILD, '--out', tree], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// A private HOME per case: these tests must never touch the real ~/.claude.
function home() {
  const dir = fs.mkdtempSync(path.join(work, 'home-'));
  fs.mkdirSync(path.join(dir, '.claude'));
  return { dir, data: path.join(dir, 'plugin-data') };
}

function sessionStart(h, root = tree) {
  const run = spawnSync('node', [path.join(root, 'hooks/plugin-context.cjs')], {
    input: '{}', encoding: 'utf8',
    env: { ...process.env, HOME: h.dir, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: h.data },
  });
  assert.equal(run.status, 0, run.stderr);
}

function setup(h, ...args) {
  return spawnSync('node', [path.join(tree, 'scripts/setup-statusline.cjs'), ...args], {
    encoding: 'utf8', env: { ...process.env, HOME: h.dir },
  });
}

const launcher = (h) => path.join(h.data, 'status.cjs');
const settingsFile = (h) => path.join(h.dir, '.claude/settings.json');

test('launcher-written: SessionStart writes a launcher and a data pointer that run the statusline', () => {
  const h = home();
  sessionStart(h);
  assert.equal(fs.readFileSync(path.join(h.dir, '.claude/cafekit-plugin-data'), 'utf8').trim(), h.data);
  const run = spawnSync('node', [launcher(h)], { input: JSON.stringify({ model: { display_name: 'Test' }, workspace: { current_dir: work } }), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.notEqual(run.stdout.trim(), '');
});

test('quote-in-path: a plugin root containing a quote still loads', () => {
  assert.ok(tree.includes("'"));
  const h = home();
  sessionStart(h);
  assert.equal(spawnSync('node', ['--check', launcher(h)]).status, 0);
});

test('launcher-missing-root-silent: a removed plugin version makes the launcher exit 0 silently', () => {
  const h = home();
  const gone = path.join(work, 'gone', 'cf');
  spawnSync('node', [BUILD, '--out', gone]);
  sessionStart(h, gone);
  fs.rmSync(path.dirname(gone), { recursive: true, force: true });
  const run = spawnSync('node', [launcher(h)], { input: '{}', encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
});

test('set-when-absent: setup adds statusLine and keeps every other key', () => {
  const h = home();
  sessionStart(h);
  fs.writeFileSync(settingsFile(h), JSON.stringify({ theme: 'dark', permissions: { allow: ['Bash(ls:*)'] } }, null, 2));
  const run = setup(h);
  assert.equal(run.status, 0, run.stderr);
  const settings = JSON.parse(fs.readFileSync(settingsFile(h), 'utf8'));
  assert.equal(settings.theme, 'dark');
  assert.deepEqual(settings.permissions, { allow: ['Bash(ls:*)'] });
  assert.equal(settings.statusLine.type, 'command');
  assert.ok(settings.statusLine.command.includes(launcher(h)));
});

test('replace-own-launcher: setup refreshes a statusLine that already points to the launcher', () => {
  const h = home();
  sessionStart(h);
  fs.writeFileSync(settingsFile(h), JSON.stringify({ statusLine: { type: 'command', command: `node ${launcher(h)}`, padding: 4 } }));
  assert.equal(setup(h).status, 0);
  const { statusLine } = JSON.parse(fs.readFileSync(settingsFile(h), 'utf8'));
  assert.equal(statusLine.command, `node ${JSON.stringify(launcher(h))}`);
  assert.equal(statusLine.padding, 0);
});

test('keep-extended-launcher-command: a user command that wraps the launcher is not replaced', () => {
  const h = home();
  sessionStart(h);
  for (const statusLine of [
    { type: 'command', command: `node "${launcher(h)}" | tee /tmp/status.log` },
    { type: 'command' },
    'not-an-object',
  ]) {
    fs.writeFileSync(settingsFile(h), JSON.stringify({ statusLine }));
    const before = sha(settingsFile(h));
    assert.equal(setup(h).status, 0);
    assert.equal(sha(settingsFile(h)), before, `replaced ${JSON.stringify(statusLine)}`);
  }
});

test('mode-preserved: a 0600 settings file stays 0600 after setup', () => {
  const h = home();
  sessionStart(h);
  fs.writeFileSync(settingsFile(h), JSON.stringify({ env: { EXAMPLE_KEY: 'placeholder' } }), { mode: 0o600 });
  fs.chmodSync(settingsFile(h), 0o600);
  assert.equal(setup(h).status, 0);
  assert.equal(fs.statSync(settingsFile(h)).mode & 0o777, 0o600);
  assert.ok(JSON.parse(fs.readFileSync(settingsFile(h), 'utf8')).statusLine);
});

test('launcher-broken-version-reports: a present but broken statusline is not silenced', () => {
  const h = home();
  const broken = path.join(work, 'broken', 'cf');
  spawnSync('node', [BUILD, '--out', broken]);
  sessionStart(h, broken);
  fs.rmSync(path.join(broken, 'hooks/lib/color.cjs'));
  const run = spawnSync('node', [launcher(h)], { input: '{}', encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /color\.cjs/);
});

test('keep-foreign-status-cjs-byte-identical: another statusLine named status.cjs is left alone', () => {
  const h = home();
  sessionStart(h);
  fs.writeFileSync(settingsFile(h), JSON.stringify({ statusLine: { type: 'command', command: 'node ~/tools/status.cjs' } }));
  const before = sha(settingsFile(h));
  const run = setup(h);
  assert.equal(run.status, 0);
  assert.equal(sha(settingsFile(h)), before);
  assert.match(run.stdout + run.stderr, /already has a statusLine/);
});

test('malformed-exit-1: unparsable settings stay byte-identical and exit 1', () => {
  const h = home();
  sessionStart(h);
  fs.writeFileSync(settingsFile(h), '{ "theme": "dark", // comment\n}');
  const before = sha(settingsFile(h));
  const run = setup(h);
  assert.equal(run.status, 1);
  assert.equal(sha(settingsFile(h)), before);
});

test('symlink-preserved: a symlinked settings file is updated through its target', () => {
  const h = home();
  sessionStart(h);
  const target = path.join(h.dir, 'dotfiles-settings.json');
  fs.writeFileSync(target, '{}');
  fs.symlinkSync(target, settingsFile(h));
  assert.equal(setup(h).status, 0);
  assert.ok(fs.lstatSync(settingsFile(h)).isSymbolicLink());
  assert.ok(JSON.parse(fs.readFileSync(target, 'utf8')).statusLine);
});

test('missing-pointer-exit-1: setup before any plugin session writes nothing', () => {
  const h = home();
  fs.writeFileSync(settingsFile(h), '{}');
  const run = setup(h);
  assert.equal(run.status, 1);
  assert.equal(fs.readFileSync(settingsFile(h), 'utf8'), '{}');
});

test('command-registered: the plugin ships /cf:setup-statusline calling the script', () => {
  const command = fs.readFileSync(path.join(tree, 'commands/setup-statusline.md'), 'utf8');
  assert.match(command, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/setup-statusline\.cjs/);
});
