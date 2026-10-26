'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../../../..');
const SRC = path.resolve(__dirname, '../../src');
const SCRIPT = path.resolve(__dirname, '../../scripts/build-codex-plugin.mjs');
let lib;
let claudeLib;
let work;
let tree;

function walk(root, base = root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });
}

before(async () => {
  lib = await import(SCRIPT);
  claudeLib = await import(path.resolve(__dirname, '../../scripts/build-claude-plugin.mjs'));
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-codex-plugin-build-'));
  tree = lib.build(path.join(work, 'cf-codex'));
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

test('inventory-and-policy: the Claude plugin skill list, Codex names, and explicit-only policies', () => {
  const skills = fs.readdirSync(path.join(tree, 'skills')).sort();
  // The Claude plugin's skills plus the Codex-only ones.
  assert.deepEqual(skills, [...claudeLib.inScopeSkills(), ...lib.CODEX_ONLY_SKILLS].sort());
  const { isExplicitOnlySkill, CODEX_POLICY_FILE, CODEX_EXPLICIT_ONLY_POLICY } = require('../phases/copy-payload');
  for (const skill of skills) {
    const text = fs.readFileSync(path.join(tree, 'skills', skill, 'SKILL.md'), 'utf8');
    assert.match(text, new RegExp(`^---\\nname: cf-${skill}\\n`), `${skill} keeps the installer's Codex name`);
    const policy = path.join(tree, 'skills', skill, CODEX_POLICY_FILE);
    const skillSource = lib.CODEX_ONLY_SKILLS.includes(skill) ? path.join(SRC, 'codex/plugin/skills', skill) : path.join(SRC, 'claude/skills', skill);
    if (isExplicitOnlySkill(skillSource)) {
      assert.equal(fs.readFileSync(policy, 'utf8'), CODEX_EXPLICIT_ONLY_POLICY, `${skill} policy`);
    } else {
      assert.ok(!fs.existsSync(policy), `${skill} has an unexpected policy file`);
    }
  }
});

test('path-allowlist: Markdown reaches plugin files through {CAFEKIT_ROOT}, never an install path', () => {
  const offenders = [];
  for (const file of walk(tree).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(tree, file), 'utf8');
    if (/\.codex[/\\](skills|references|scripts|rules|hooks|output-styles)\b/.test(text)) offenders.push(`${file}: .codex runtime path`);
    if (/\.agents[/\\]skills\b/.test(text)) offenders.push(`${file}: .agents/skills path`);
    if (/(?<!~\/)\.codex\/agents\//.test(text)) offenders.push(`${file}: project .codex/agents path`);
    if (/\.claude[/\\](skills|references|scripts|rules)\b/.test(text)) offenders.push(`${file}: .claude runtime path`);
    if (/\{CAFEKIT_ROOT\}\/scripts\//.test(text)) offenders.push(`${file}: script reached by path instead of {cafekit:<name>}`);
    for (const [, rel] of text.matchAll(/\{CAFEKIT_ROOT\}\/([^\s`'")]+)/g)) {
      const target = rel.replace(/[.,:;]+$/, '');
      if (/[<*]/.test(target)) continue;
      if (!fs.existsSync(path.join(tree, target))) offenders.push(`${file}: {CAFEKIT_ROOT}/${target} does not exist`);
    }
  }
  assert.deepEqual(offenders, []);
  const commands = lib.scriptCommands(tree);
  assert.ok(commands.includes('provenance'), 'provenance is not in the command table');
  for (const name of commands) assert.ok(fs.existsSync(path.join(tree, 'scripts', `${name}.cjs`)), `${name} has no script`);
});

test('manifest-and-marketplace: plugin.json and the repo marketplace carry the keys Codex reads', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(tree, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'cf');
  assert.equal(manifest.version, require('../../package.json').version);
  for (const key of ['description', 'author', 'license', 'interface']) assert.ok(manifest[key], `plugin.json lacks ${key}`);
  const market = lib.marketplace();
  assert.equal(typeof market.name, 'string');
  const entry = market.plugins.find((p) => p.name === 'cf');
  assert.deepEqual(entry.source, { source: 'local', path: './plugins/cf-codex' });
  assert.ok(entry.policy?.installation && entry.policy?.authentication && entry.category, 'entry lacks policy or category');
});

test('marketplace-not-ignored: git can commit .agents/plugins/marketplace.json', () => {
  // --no-index: a tracked file would otherwise always read as not ignored.
  const run = spawnSync('git', ['check-ignore', '-q', '--no-index', '.agents/plugins/marketplace.json'], { cwd: REPO });
  assert.equal(run.status, 1, 'the marketplace file is ignored by git');
  const skills = spawnSync('git', ['check-ignore', '-q', '--no-index', '.agents/skills/specs/SKILL.md'], { cwd: REPO });
  assert.equal(skills.status, 0, 'npx-installed .agents/skills must stay ignored');
  // A reinstall must not append `.agents/` after `!.agents/plugins/` and hide the marketplace again.
  const { hasPattern } = require('../phases/root-config');
  assert.ok(hasPattern(['.agents/*', '!.agents/plugins/'], '.agents/'));
});

test('claude-marketplace-guard: the Codex marketplace never points at the Claude plugin tree', () => {
  const entry = lib.marketplace().plugins.find((p) => p.name === 'cf');
  assert.notEqual(path.normalize(entry.source.path), path.normalize('./plugins/cf'));
  assert.ok(!fs.existsSync(path.join(REPO, 'plugins/cf/.codex-plugin')), 'the Claude tree must not carry a Codex manifest');
});

test('check-detects-drift: --check fails after one byte changes in a fresh copy', () => {
  const copy = lib.build(path.join(work, 'copy'));
  const clean = spawnSync('node', [SCRIPT, '--check', copy], { encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  fs.appendFileSync(path.join(copy, 'skills/specs/SKILL.md'), 'x');
  const drift = spawnSync('node', [SCRIPT, '--check', copy], { encoding: 'utf8' });
  assert.equal(drift.status, 1);
  assert.match(drift.stderr, /changed skills\/specs\/SKILL\.md/);
});

// ── Runtime and hooks.json ─────────────────────────────────────────────────────

const RUNTIME_DIRS = ['hooks', 'rules', 'output-styles'];

function npxInstall() {
  const repo = fs.mkdtempSync(path.join(work, 'npx-'));
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const run = spawnSync('node', [path.resolve(__dirname, '../install.js'), '--platform', 'codex', '-y'], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, HOME: fs.mkdtempSync(path.join(work, 'home-')) },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return repo;
}

function runtimeFiles(root) {
  return RUNTIME_DIRS.flatMap((dir) => (fs.existsSync(path.join(root, dir)) ? walk(path.join(root, dir)).map((f) => `${dir}/${f}`) : []))
    .concat(fs.existsSync(path.join(root, 'runtime.schema.json')) ? ['runtime.schema.json'] : [])
    .filter((f) => f !== 'hooks/hooks.json' && !f.includes('/.logs/'))
    .sort();
}

test('runtime-matches-npx: the plugin runtime holds the same files and bytes as an npx Codex install', () => {
  const installed = path.join(npxInstall(), '.codex');
  const expected = runtimeFiles(installed);
  assert.deepEqual(runtimeFiles(tree), expected);
  for (const file of expected) {
    assert.ok(fs.readFileSync(path.join(tree, file)).equals(fs.readFileSync(path.join(installed, file))), `${file} differs from the npx install`);
  }
});

test('requires-resolve: every relative require in the plugin hooks resolves inside the tree', () => {
  const missing = [];
  for (const file of walk(path.join(tree, 'hooks')).filter((f) => f.endsWith('.cjs'))) {
    const full = path.join(tree, 'hooks', file);
    for (const [, spec] of fs.readFileSync(full, 'utf8').matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const target = path.resolve(path.dirname(full), spec);
      if (![target, `${target}.cjs`, `${target}.js`].some((t) => fs.existsSync(t))) missing.push(`hooks/${file} → ${spec}`);
    }
  }
  assert.deepEqual(missing, []);
});

function pluginHandlers() {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8'));
  return Object.entries(hooks).flatMap(([event, groups]) => groups.flatMap((group) => group.hooks.map((h) => ({ event, ...h }))));
}

test('hook-commands-fallback: every plugin hook has a POSIX command with a node PATH fallback and a Windows command', () => {
  const template = JSON.parse(fs.readFileSync(path.join(SRC, 'codex/hooks.json'), 'utf8')).hooks;
  const handlers = pluginHandlers();
  // The template's runtime hooks plus the one plugin-only SessionStart hook.
  const pluginOnly = handlers.filter((h) => h.command.includes('/plugin/hooks/'));
  assert.deepEqual(pluginOnly.map((h) => h.event), ['SessionStart']);
  assert.equal(handlers.length - pluginOnly.length, Object.values(template).flat().flatMap((g) => g.hooks).length);
  for (const handler of handlers) {
    const [, dir, script] = handler.command.match(/((?:plugin\/)?hooks)\/([a-z0-9-]+\.cjs)"$/) || [];
    assert.ok(script && fs.existsSync(path.join(tree, dir, script)), `bad command ${handler.command}`);
    assert.match(handler.command, /^PATH="\$PATH":'[^']+'(:'[^']+')* node "\$\{PLUGIN_ROOT\}\/(plugin\/)?hooks\/[a-z0-9-]+\.cjs"$/);
    assert.equal(typeof handler.commandWindows, 'string');
    assert.ok(handler.commandWindows.includes(script) && handler.commandWindows.includes('PLUGIN_ROOT'), handler.commandWindows);
  }
});

test('no-build-machine-paths: hooks.json names no absolute path of the machine that built it', () => {
  const text = fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8');
  for (const local of [REPO, os.homedir(), path.dirname(process.execPath)]) assert.ok(!text.includes(local), `hooks.json contains ${local}`);
  const windows = pluginHandlers()[0].commandWindows;
  const decoded = spawnSync('node', ['-e', `${windows.replace(/^node -e "|"$/g, '').replace(/require\('module'\)\.runMain\(\)/, 'console.log(process.argv[1])')}`], {
    encoding: 'utf8', env: { ...process.env, PLUGIN_ROOT: path.join(work, 'win-root') },
  });
  assert.equal(decoded.stdout.trim(), path.join(work, 'win-root', 'hooks', pluginHandlers()[0].command.match(/hooks\/([a-z0-9-]+\.cjs)"$/)[1]));
});

test('npx-hook-commands-unchanged: the npx install still gets absolute project launchers', () => {
  const repo = npxInstall();
  const { hooks } = JSON.parse(fs.readFileSync(path.join(repo, '.codex/hooks.json'), 'utf8'));
  for (const handler of Object.values(hooks).flat().flatMap((g) => g.hooks)) {
    assert.match(handler.command, /node '[^']+\/\.codex\/hooks\/[a-z0-9-]+\.cjs'$/);
    assert.ok(handler.command.includes(fs.realpathSync(repo)));
    assert.ok(!handler.command.includes('PLUGIN_ROOT'));
    const encoded = handler.commandWindows.split(' ').pop();
    assert.ok(Buffer.from(encoded, 'base64url').toString('utf8').startsWith(path.join(fs.realpathSync(repo), '.codex', 'hooks')), 'npx Windows launcher lost its project path');
  }
});

const SAMPLE_PAYLOADS = {
  SessionStart: { source: 'startup' },
  UserPromptSubmit: { prompt: 'hello' },
  PreToolUse: { tool_name: 'Bash', tool_input: { command: 'ls' } },
  PermissionRequest: { tool_name: 'Bash', tool_input: { command: 'ls' } },
  PostToolUse: { tool_name: 'apply_patch', tool_input: { command: '' }, tool_response: {} },
  Stop: { stop_hook_active: false },
  SubagentStart: { agent_type: 'debugger' },
  SubagentStop: { agent_type: 'debugger', stop_hook_active: false },
  PreCompact: { trigger: 'manual' },
};

test('hook-smoke: every generated plugin launcher runs its hook to exit 0 without a crash log', () => {
  // A private root holding the tree, so every crash log a hook writes lands under it.
  const sandbox = fs.mkdtempSync(path.join(work, 'smoke-'));
  const smokeTree = lib.build(path.join(sandbox, 'plugin', 'cf-codex'));
  const repo = path.join(sandbox, 'repo');
  fs.mkdirSync(repo);
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const data = path.join(sandbox, 'data');
  const failures = [];
  for (const handler of pluginHandlers()) {
    const payload = { session_id: 'codex-smoke', hook_event_name: handler.event, cwd: repo, ...(SAMPLE_PAYLOADS[handler.event] || {}) };
    const run = spawnSync('sh', ['-c', handler.command], {
      cwd: repo, input: JSON.stringify(payload), encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: path.join(sandbox, 'home'), PLUGIN_ROOT: smokeTree, PLUGIN_DATA: data, CLAUDE_PLUGIN_ROOT: smokeTree, CLAUDE_PLUGIN_DATA: data },
    });
    if (run.status !== 0) failures.push(`${handler.event} ${handler.command}: exit ${run.status} ${run.stderr.slice(0, 200)}`);
  }
  const crashLogs = walk(sandbox).filter((f) => f.endsWith('hook-log.jsonl'))
    .filter((f) => /"status":"crash"/.test(fs.readFileSync(path.join(sandbox, f), 'utf8')));
  for (const log of crashLogs) failures.push(`crash logged in ${log}: ${fs.readFileSync(path.join(sandbox, log), 'utf8').slice(0, 200)}`);
  assert.deepEqual(failures, []);
});
