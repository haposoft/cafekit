'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../scripts/build-claude-plugin.mjs');
let lib;
let work;
let tree;

function walk(root, base = root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });
}

const markdownFiles = () => walk(tree).filter((file) => file.endsWith('.md'));

before(async () => {
  lib = await import(SCRIPT);
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-plugin-build-'));
  tree = lib.build(path.join(work, 'cf'));
});

after(() => fs.rmSync(work, { recursive: true, force: true }));

test('inventory: 15 in-scope skills, 13 agents, no excluded component', () => {
  const skills = fs.readdirSync(path.join(tree, 'skills')).sort();
  const agents = fs.readdirSync(path.join(tree, 'agents')).map((f) => f.replace(/\.md$/, '')).sort();
  assert.equal(skills.length, 15);
  assert.equal(agents.length, 13);
  for (const name of lib.EXCLUDED_SKILLS) assert.ok(!skills.includes(name), `excluded skill shipped: ${name}`);
  for (const name of lib.EXCLUDED_AGENTS) assert.ok(!agents.includes(name), `excluded agent shipped: ${name}`);
  for (const skill of skills) assert.ok(fs.existsSync(path.join(tree, 'skills', skill, 'SKILL.md')), `${skill} has no SKILL.md`);
  const manifest = JSON.parse(fs.readFileSync(path.join(tree, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'cf');
  assert.equal(manifest.version, require('../../package.json').version);
});

test('no-dot-claude-path: Markdown keeps no .claude runtime path and no unsubstituted root', () => {
  const offenders = [];
  for (const file of markdownFiles()) {
    const text = fs.readFileSync(path.join(tree, file), 'utf8');
    if (/\.claude[/\\](skills|references|scripts|rules)[/\\]/.test(text)) offenders.push(`${file}: .claude path`);
    if (!lib.substitutesPluginRoot(file) && text.includes('${CLAUDE_PLUGIN_ROOT}')) offenders.push(`${file}: root variable in a file the host does not substitute`);
  }
  assert.deepEqual(offenders, []);
  for (const bin of fs.readdirSync(path.join(tree, 'bin'))) {
    assert.ok(fs.statSync(path.join(tree, 'bin', bin)).mode & 0o111, `${bin} is not executable`);
    const target = bin.replace(/^cafekit-/, '');
    assert.ok(fs.existsSync(path.join(tree, 'scripts', `${target}.cjs`)), `${bin} points to a missing script`);
  }
});

test('hook-commands: every hook runs from the plugin root and exists', () => {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8'));
  const commands = Object.values(hooks).flat().flatMap((entry) => entry.hooks.map((h) => h.command));
  assert.ok(commands.length > 0);
  for (const command of commands) {
    const match = command.match(/^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([^"]+)"$/);
    assert.ok(match, `unexpected hook command: ${command}`);
    assert.ok(fs.existsSync(path.join(tree, 'hooks', match[1])), `missing hook file ${match[1]}`);
  }
});

const SAMPLE_PAYLOADS = {
  SessionStart: { source: 'startup' },
  UserPromptSubmit: { prompt: 'hello' },
  PreToolUse: { tool_name: 'Read', tool_input: { file_path: 'README.md' } },
  PostToolUse: { tool_name: 'Edit', tool_input: { file_path: 'README.md' }, tool_response: {} },
  Stop: { stop_hook_active: false },
  SubagentStart: { agent_type: 'cf:debugger' },
  SubagentStop: { agent_type: 'cf:debugger', stop_hook_active: false },
  PreCompact: { trigger: 'manual' },
};

test('hook-smoke: every registered hook exits 0 in the built tree without a crash', () => {
  const repo = fs.mkdtempSync(path.join(work, 'repo-'));
  spawnSync('git', ['init', '-q'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), '# demo\n');
  const data = fs.mkdtempSync(path.join(work, 'data-'));
  const { hooks } = JSON.parse(fs.readFileSync(path.join(tree, 'hooks/hooks.json'), 'utf8'));
  const failures = [];
  for (const [event, entries] of Object.entries(hooks)) {
    assert.ok(SAMPLE_PAYLOADS[event], `no sample payload for ${event}`);
    for (const entry of entries) {
      for (const { command } of entry.hooks) {
        const file = command.match(/hooks\/([^"]+)"$/)[1];
        const payload = { session_id: 'plugin-build-smoke', hook_event_name: event, cwd: repo, transcript_path: path.join(repo, 'none.jsonl'), ...SAMPLE_PAYLOADS[event] };
        const run = spawnSync('node', [path.join(tree, 'hooks', file)], {
          cwd: repo,
          input: JSON.stringify(payload),
          encoding: 'utf8',
          env: { ...process.env, HOME: path.join(work, 'home'), CLAUDE_PLUGIN_ROOT: tree, CLAUDE_PLUGIN_DATA: data, CLAUDE_PROJECT_DIR: repo },
          timeout: 20000,
        });
        const output = `${run.stdout}${run.stderr}`;
        if (run.status !== 0 || /Completion gate unavailable|crash/i.test(output)) failures.push(`${event} ${file}: exit ${run.status} ${output.slice(0, 200)}`);
      }
    }
  }
  const logs = walk(tree).filter((file) => file.endsWith('hook-log.jsonl'))
    .concat(fs.existsSync(data) ? walk(data).filter((f) => f.endsWith('hook-log.jsonl')).map((f) => path.join('..', path.basename(data), f)) : []);
  for (const log of logs) {
    const text = fs.readFileSync(path.resolve(tree, log), 'utf8');
    if (/"status":"crash"/.test(text)) failures.push(`crash logged in ${log}: ${text.slice(0, 200)}`);
  }
  assert.deepEqual(failures, []);
});

test('agent-names-resolve: agents are called by their namespaced name and exist', () => {
  const agents = lib.inScopeAgents();
  // `cf:<name>` also names skills, including optional ones shipped elsewhere
  // (cf:ai-multimodal); only names that are agents in the source must resolve.
  const sourceAgents = fs.readdirSync(path.resolve(__dirname, '../../src/claude/agents')).map((f) => f.replace(/\.md$/, ''));
  const offenders = [];
  for (const file of markdownFiles()) {
    const text = fs.readFileSync(path.join(tree, file), 'utf8');
    for (const agent of agents) {
      if (text.includes(`\`${agent}\``)) offenders.push(`${file}: bare \`${agent}\``);
      if (new RegExp(`subagent_type["']?\\s*[:=]\\s*["']?${agent}\\b`).test(text)) offenders.push(`${file}: bare subagent_type ${agent}`);
    }
    for (const [, name] of text.matchAll(/`cf:([a-z0-9-]+)`/g)) {
      if (sourceAgents.includes(name) && !agents.includes(name)) offenders.push(`${file}: cf:${name} is not a shipped agent`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('check-detects-drift: --check fails after one byte changes in a copy', () => {
  // A fresh build, not a copy of `tree`: the hook smoke test above may have left logs there.
  const copy = lib.build(path.join(work, 'copy'));
  const clean = spawnSync('node', [SCRIPT, '--check', copy], { encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  fs.appendFileSync(path.join(copy, 'rules/workflow.md'), 'x');
  const drift = spawnSync('node', [SCRIPT, '--check', copy], { encoding: 'utf8' });
  assert.equal(drift.status, 1);
  assert.match(drift.stderr, /changed rules\/workflow\.md/);
});

test('build refuses to wipe a non-empty directory that is not a cf build', () => {
  const foreign = fs.mkdtempSync(path.join(work, 'foreign-'));
  fs.writeFileSync(path.join(foreign, 'keep.txt'), 'user data');
  assert.throws(() => lib.build(foreign), /Refusing to replace/);
  assert.equal(fs.readFileSync(path.join(foreign, 'keep.txt'), 'utf8'), 'user data');
});
