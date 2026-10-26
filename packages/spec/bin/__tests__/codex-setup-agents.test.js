'use strict';

// Codex loads no agents from a plugin, so the plugin ships them as TOML with an
// ownership marker and a script copies them into the user's Codex agents directory.
// The script replaces only files whose marker hash still matches their body.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPTS = path.resolve(__dirname, '../../scripts');
const SRC = path.resolve(__dirname, '../../src');
const { convertCodexAgentContent, codexAgentName } = require('../lib/codex-install.js');
const { CODEX_POLICY_FILE, CODEX_EXPLICIT_ONLY_POLICY } = require('../phases/copy-payload.js');
const MARKER = /^# CafeKit agent: plugin=(\S+) version=(\S+) sha256=([0-9a-f]{64})\n/;
const REAL_AGENTS = path.join(os.homedir(), '.codex', 'agents');
let work;
let tree;
let agentNames;
let realBefore;

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function realState() {
  try {
    const stat = fs.statSync(REAL_AGENTS);
    return `${stat.mtimeMs}:${fs.readdirSync(REAL_AGENTS).sort().join(',')}`;
  } catch {
    return 'absent';
  }
}

before(async () => {
  realBefore = realState();
  work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-codex-agents-')));
  const lib = await import(path.join(SCRIPTS, 'build-codex-plugin.mjs'));
  const claudeLib = await import(path.join(SCRIPTS, 'build-claude-plugin.mjs'));
  agentNames = claudeLib.inScopeAgents();
  tree = lib.build(path.join(work, 'plugin', 'cf-codex'));
});

after(() => {
  fs.rmSync(work, { recursive: true, force: true });
  assert.equal(realState(), realBefore, 'the real ~/.codex/agents changed');
});

let caseCount = 0;
function setup() {
  const dir = path.join(work, `case-${++caseCount}`);
  const home = path.join(dir, 'home');
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(repo, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: repo });
  return { home, repo, agents: path.join(home, '.codex', 'agents') };
}

function setupAgents({ home, repo }, args = [], codexHome) {
  const env = { ...process.env, HOME: home };
  delete env.CODEX_HOME;
  if (codexHome !== undefined) env.CODEX_HOME = codexHome;
  return spawnSync('node', [path.join(tree, 'scripts/setup-agents.cjs'), ...args], { cwd: repo, encoding: 'utf8', env });
}

function shipped(name) {
  return fs.readFileSync(path.join(tree, 'agents', name), 'utf8');
}

// An older CafeKit release of the same agent: a valid marker over a different body.
function olderOwn(name) {
  const body = `name = "${name.replace(/\.toml$/, '')}"\ndescription = "an older release"\ndeveloper_instructions = "old"\n`;
  return `# CafeKit agent: plugin=cf version=0.0.1 sha256=${sha256(body)}\n${body}`;
}

test('agents-built-with-hash-marker: every in-scope agent ships as TOML whose marker hashes its body', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
  const files = fs.readdirSync(path.join(tree, 'agents')).sort();
  assert.deepEqual(files, agentNames.map((agent) => `${codexAgentName(agent)}.toml`).sort());
  for (const agent of agentNames) {
    const text = shipped(`${codexAgentName(agent)}.toml`);
    const [marker, plugin, version, digest] = text.match(MARKER) || [];
    assert.ok(marker, `${agent} has no marker`);
    assert.equal(plugin, 'cf');
    assert.equal(version, pkg.version);
    const body = text.slice(marker.length);
    assert.equal(sha256(body), digest, agent);
    assert.equal(body, convertCodexAgentContent(fs.readFileSync(path.join(SRC, 'claude/agents', `${agent}.md`), 'utf8'), `${agent}.md`), `${agent} differs from the npx conversion`);
  }
});

test('write-when-absent: an empty agents directory receives every shipped agent', () => {
  const ctx = setup();
  const result = setupAgents(ctx);
  assert.equal(result.status, 0, result.stderr);
  const files = fs.readdirSync(path.join(tree, 'agents')).sort();
  assert.deepEqual(fs.readdirSync(ctx.agents).sort(), files);
  for (const file of files) assert.equal(fs.readFileSync(path.join(ctx.agents, file), 'utf8'), shipped(file), file);
  assert.equal(result.stdout.match(/^written: /gm).length, files.length);
});

test('replace-own-unmodified: an unedited agent from an older release is replaced', () => {
  const ctx = setup();
  fs.mkdirSync(ctx.agents, { recursive: true });
  fs.writeFileSync(path.join(ctx.agents, 'test_runner.toml'), olderOwn('test_runner.toml'));
  const result = setupAgents(ctx);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(ctx.agents, 'test_runner.toml'), 'utf8'), shipped('test_runner.toml'));
  assert.match(result.stdout, /^replaced: .*test_runner\.toml$/m);
});

test('keep-modified-own: an agent whose body was edited under the marker keeps its bytes', () => {
  const ctx = setup();
  fs.mkdirSync(ctx.agents, { recursive: true });
  const edited = `${shipped('code_auditor.toml')}# my own note\n`;
  fs.writeFileSync(path.join(ctx.agents, 'code_auditor.toml'), edited);
  const result = setupAgents(ctx);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(sha256(fs.readFileSync(path.join(ctx.agents, 'code_auditor.toml'), 'utf8')), sha256(edited));
  assert.match(result.stdout, /^kept \(modified\): .*code_auditor\.toml$/m);
});

test('keep-foreign: a file CafeKit did not install keeps its bytes', () => {
  const ctx = setup();
  fs.mkdirSync(ctx.agents, { recursive: true });
  const foreign = 'name = "debugger"\ndescription = "mine"\ndeveloper_instructions = "mine"\n';
  fs.writeFileSync(path.join(ctx.agents, 'debugger.toml'), foreign);
  const result = setupAgents(ctx);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(ctx.agents, 'debugger.toml'), 'utf8'), foreign);
  assert.match(result.stdout, /^kept \(not installed by CafeKit\): .*debugger\.toml$/m);
});

test('mode-preserved: replacing an owned agent keeps its file mode', () => {
  const ctx = setup();
  fs.mkdirSync(ctx.agents, { recursive: true });
  const file = path.join(ctx.agents, 'implementer.toml');
  fs.writeFileSync(file, olderOwn('implementer.toml'), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  const result = setupAgents(ctx);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), shipped('implementer.toml'));
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(ctx.agents).filter((f) => f.endsWith('.tmp')), [], 'a temp file was left behind');
});

test('codex-home-honored: an absolute CODEX_HOME receives the agents and a relative one is refused', () => {
  const ctx = setup();
  const codexHome = path.join(ctx.home, 'custom-codex-home');
  const result = setupAgents(ctx, [], codexHome);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(path.join(codexHome, 'agents')).sort(), fs.readdirSync(path.join(tree, 'agents')).sort());
  assert.ok(!fs.existsSync(path.join(ctx.home, '.codex')), 'agents also went to ~/.codex');
  const refused = setup();
  const relative = setupAgents(refused, [], 'relative-home');
  assert.equal(relative.status, 1);
  assert.match(relative.stderr, /CODEX_HOME must be an absolute path/);
  assert.ok(!fs.existsSync(path.join(refused.repo, 'relative-home')) && !fs.existsSync(path.join(refused.home, '.codex')), 'a refused CODEX_HOME still wrote');
});

test('unreadable-kept: a file it cannot read is kept and the other agents still install', { skip: process.getuid?.() === 0 }, () => {
  const ctx = setup();
  fs.mkdirSync(ctx.agents, { recursive: true });
  const locked = path.join(ctx.agents, 'debugger.toml');
  fs.writeFileSync(locked, 'mine\n');
  fs.chmodSync(locked, 0o000);
  try {
    const result = setupAgents(ctx);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^kept \(unreadable\): .*debugger\.toml$/m);
    assert.equal(fs.readdirSync(ctx.agents).length, fs.readdirSync(path.join(tree, 'agents')).length);
  } finally {
    fs.chmodSync(locked, 0o600);
  }
  assert.equal(fs.readFileSync(locked, 'utf8'), 'mine\n');
});

test('symlink-kept: a symlinked agent stays a symlink and its target is untouched', () => {
  const ctx = setup();
  fs.mkdirSync(ctx.agents, { recursive: true });
  const elsewhere = path.join(ctx.home, 'dotfiles-researcher.toml');
  fs.writeFileSync(elsewhere, olderOwn('researcher.toml'));
  const before = fs.readFileSync(elsewhere, 'utf8');
  fs.symlinkSync(elsewhere, path.join(ctx.agents, 'researcher.toml'));
  const result = setupAgents(ctx);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.lstatSync(path.join(ctx.agents, 'researcher.toml')).isSymbolicLink());
  assert.equal(fs.readlinkSync(path.join(ctx.agents, 'researcher.toml')), elsewhere);
  assert.equal(fs.readFileSync(elsewhere, 'utf8'), before);
  assert.match(result.stdout, /^kept \(symlink\): .*researcher\.toml$/m);
});

test('repo-collision-reported: an agent of the same name in the repository is reported', () => {
  const ctx = setup();
  fs.mkdirSync(path.join(ctx.repo, '.codex/agents'), { recursive: true });
  fs.writeFileSync(path.join(ctx.repo, '.codex/agents/test_runner.toml'), 'name = "test_runner"\n');
  const result = setupAgents(ctx);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^collision: .*\.codex\/agents\/test_runner\.toml/m);
  assert.equal((result.stdout.match(/^collision: /gm) || []).length, 1);
});

test('skill-explicit-no-target: the skill is explicit-only and the script refuses any argument', () => {
  const skill = fs.readFileSync(path.join(tree, 'skills/setup-agents/SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: cf-setup-agents\n/);
  assert.match(skill, /\{cafekit:setup-agents\}/);
  assert.equal(fs.readFileSync(path.join(tree, 'skills/setup-agents', CODEX_POLICY_FILE), 'utf8'), CODEX_EXPLICIT_ONLY_POLICY);
  const ctx = setup();
  const target = path.join(ctx.home, 'elsewhere');
  const result = setupAgents(ctx, [target]);
  assert.equal(result.status, 2);
  assert.ok(!fs.existsSync(target) && !fs.existsSync(ctx.agents), 'the script wrote with an argument');
});
