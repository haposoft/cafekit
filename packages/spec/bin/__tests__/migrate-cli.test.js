'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { sha256 } = require('../lib/manifest');

const INSTALLER = path.join(__dirname, '../install.js');
const BUILD = path.resolve(__dirname, '../../scripts/build-codex-plugin.mjs');

let work;
let repo;
let tree;
let privacyCommand;

// The installer writes into its cwd, so every run uses a temp repository as cwd.
function cafekit(cwd, ...args) {
  return spawnSync(process.execPath, [INSTALLER, ...args], {
    cwd,
    env: { ...process.env, HOME: path.join(work, 'home'), CI: '1' },
    encoding: 'utf8'
  });
}

function gitRepo(name) {
  const dir = path.join(work, name);
  fs.mkdirSync(dir, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: dir });
  return fs.realpathSync(dir);
}

function treeHash(root) {
  const hash = crypto.createHash('sha256');
  const visit = (rel) => {
    const abs = path.join(root, rel);
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) hash.update(`L ${rel} ${fs.readlinkSync(abs)}\n`);
    else if (stat.isDirectory()) for (const name of fs.readdirSync(abs).sort()) visit(path.join(rel, name));
    else hash.update(`F ${rel} ${sha256(fs.readFileSync(abs))}\n`);
  };
  visit('.');
  return hash.digest('hex');
}

// Runs the built Codex plugin's privacy hook through its generated launcher, as Codex does.
function pluginPrivacy(cwd) {
  return spawnSync('sh', ['-c', privacyCommand], {
    cwd,
    input: JSON.stringify({ session_id: 'migrate-cli', hook_event_name: 'PreToolUse', cwd, tool_name: 'Bash', tool_input: { command: 'cat .env' } }),
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, HOME: path.join(work, 'home'), PLUGIN_ROOT: tree, CLAUDE_PLUGIN_ROOT: tree, PLUGIN_DATA: path.join(work, 'data'), CLAUDE_PLUGIN_DATA: path.join(work, 'data') }
  });
}

before(async () => {
  work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-migrate-cli-')));
  fs.mkdirSync(path.join(work, 'home'));
  const lib = await import(BUILD);
  tree = lib.build(path.join(work, 'plugin', 'cf-codex'));
  const { hooks } = JSON.parse(fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8'));
  privacyCommand = hooks.PreToolUse.flatMap((group) => group.hooks).find((handler) => handler.command.includes('/hooks/privacy-block.cjs"')).command;

  repo = gitRepo('both');
  fs.writeFileSync(path.join(repo, '.env'), 'EXAMPLE=placeholder\n');
  const install = cafekit(repo, '--platform', 'claude,codex', '-y');
  assert.equal(install.status, 0, install.stderr || install.stdout);
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

test('dry-run-default: migrate prints the plan, exits 0 and writes nothing', () => {
  const beforeHash = treeHash(repo);
  const run = cafekit(repo, 'migrate');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /dry run \(nothing is written\)/);
  assert.match(run.stdout, /Remove \(\d+ files\):/);
  assert.match(run.stdout, /migrate --apply/);
  assert.equal(treeHash(repo), beforeHash);
});

test('plugin-stands-down-before: beside the npx Codex hooks the plugin hook stays silent', () => {
  const result = pluginPrivacy(repo);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('apply-exits-zero: migrate --apply removes the npx install and exits 0', () => {
  const run = cafekit(repo, 'migrate', '--apply');
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /✓ Removed \d+ files/);
  assert.ok(!fs.existsSync(path.join(repo, '.codex/hooks.json')));
  assert.ok(fs.existsSync(path.join(repo, '.codex/runtime.json')));
  const again = cafekit(repo, 'migrate');
  assert.equal(again.status, 0);
  assert.match(again.stdout, /Nothing to migrate/);
});

test('plugin-gates-after-apply: once the npx hooks are gone the plugin privacy gate acts', () => {
  const result = pluginPrivacy(repo);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"permissionDecision":"deny"/);
});

test('unknown-flag-two: an unknown flag after migrate exits 2 and writes nothing', () => {
  const dir = gitRepo('flag');
  const run = cafekit(dir, 'migrate', '--bogus');
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Unknown argument for migrate: --bogus/);
  assert.deepEqual(fs.readdirSync(dir), ['.git']);
});

test('unknown-positional-two: an unknown positional argument exits 2 before any install', () => {
  const dir = gitRepo('positional');
  const run = cafekit(dir, 'bogus', '-y');
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Unknown argument: "bogus"/);
  assert.deepEqual(fs.readdirSync(dir), ['.git']);
  const misplaced = cafekit(dir, '-y', 'migrate');
  assert.equal(misplaced.status, 2);
  assert.match(misplaced.stderr, /migrate must be the first argument/);
  assert.deepEqual(fs.readdirSync(dir), ['.git']);
});

test('platform-refused-exits-one: an install migrate cannot read stops the whole run with exit 1', () => {
  const dir = gitRepo('refused');
  const install = cafekit(dir, '--platform', 'claude,codex', '-y');
  assert.equal(install.status, 0, install.stderr || install.stdout);
  fs.writeFileSync(path.join(dir, '.codex/cafekit-manifest.json'), '{ "files": ');
  const beforeHash = treeHash(dir);
  for (const args of [['migrate'], ['migrate', '--apply']]) {
    const run = cafekit(dir, ...args);
    assert.equal(run.status, 1, args.join(' '));
    assert.match(run.stderr, /Codex CLI cannot be migrated: the install manifest does not parse/);
    assert.match(run.stderr, /Nothing was changed/);
    assert.doesNotMatch(run.stdout, /✓ Removed/);
  }
  assert.equal(treeHash(dir), beforeHash);
});

test('install-unchanged: a plain install in another repository still succeeds', () => {
  const dir = gitRepo('plain');
  const run = cafekit(dir, '--platform', 'codex', '-y');
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.ok(fs.existsSync(path.join(dir, '.codex/hooks.json')));
  assert.ok(!fs.existsSync(path.join(dir, '.cafekit.lock')));
});
