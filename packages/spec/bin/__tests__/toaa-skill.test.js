'use strict';

// cf:toaa takes one request from A to Z as its own flow beside Specs. These cases pin the
// boundary that keeps it out of the Specs gates, the three gates in order, the stop list,
// the vocabulary that must never return, and that installed copies for both runtimes work.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const { loadClaudeMigrationManifest } = require('../lib/context');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const SKILL_DIR = path.join(PACKAGE_ROOT, 'src/claude/skills/toaa');
const AGENTS_DIR = path.join(PACKAGE_ROOT, 'src/claude/agents');
const FILES = ['SKILL.md', 'references/prerequisites-checklist.md', 'references/autonomous-orchestration.md'];

const read = (rel) => fs.readFileSync(path.join(SKILL_DIR, rel), 'utf8');
const skill = () => read('SKILL.md');
const checklist = () => read('references/prerequisites-checklist.md');
const orchestration = () => read('references/autonomous-orchestration.md');

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-toaa-skill-'));
  try {
    const init = spawnSync('git', ['-C', root, 'init', '-q'], { encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root) {
  return spawnSync(process.execPath, [INSTALLER, '--platform', 'claude,codex', '--yes'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } });
}

function frontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'SKILL.md must open with a frontmatter block');
  return match[1];
}

function assertLinksResolve(baseDir, file) {
  const content = fs.readFileSync(path.join(baseDir, file), 'utf8');
  const links = [...content.matchAll(/\]\(([^)#]+\.md)\)/g)].map((m) => m[1]);
  for (const link of links) {
    assert.ok(fs.existsSync(path.join(baseDir, path.dirname(file), link)), `${file} links to missing ${link}`);
  }
  return links.length;
}

test('manifest requires toaa', () => {
  // Without the entry the installer and the plugin build never ship the skill and nothing else fails.
  assert.equal(loadClaudeMigrationManifest().skills.required.includes('toaa'), true);
});

test('frontmatter keeps the name, the one-line description, and manual-only invocation', () => {
  const lines = frontmatter(skill());
  const field = (key) => lines.split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
  assert.equal(field('name'), 'name: cf:toaa');
  assert.equal(field('description'), 'description: "The one above all."');
  assert.equal(field('user-invocable'), 'user-invocable: true');
  assert.equal(field('disable-model-invocation'), 'disable-model-invocation: true');
  for (const key of ['when_to_use', 'category', 'keywords', 'argument-hint']) assert.ok(field(key), `${key} missing`);
  assert.match(field('argument-hint'), /--yagni/);
  const description = JSON.parse(field('description').slice('description:'.length).trim());
  const whenToUse = JSON.parse(field('when_to_use').slice('when_to_use:'.length).trim());
  assert.ok(`${description} Use when: ${whenToUse}`.length <= 1024, 'the Codex-projected description must fit the routing limit');
});

test('the three gates appear in order: Lock, Prepare, Execute', () => {
  const body = skill();
  const positions = ['## 1. Lock scope', '## 2. Prepare', '## 3. Execute autonomously', '## Done']
    .map((heading) => body.indexOf(heading));
  for (const position of positions) assert.ok(position > 0, 'a gate heading is missing');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'gates are out of order');
});

test('it stays a separate flow: no Specs packet, no task state, no Specs workflow skills', () => {
  const body = skill();
  assert.match(body, /never creates, edits or archives anything under `specs\/`/);
  assert.match(body, /never writes a task `Status:` or `## Receipt`/);
  assert.match(body, /never invokes `cf:specs`, `cf:develop`, `cf:sync` or `cf:vibe`/);
  assert.match(body, /existing Specs packet, stop and point the user to `cf:develop`/);
  assert.match(body, /`plans\/toaa\/<YYYYMMDD>-<slug>\/`/);
});

test('authority comes only from the user invoking it, and subagents never receive it', () => {
  const body = skill();
  assert.match(body, /Authority comes only from the user invoking this skill in the main session, for this run, within the confirmed brief/);
  assert.match(body, /Subagents never receive it/);
  assert.match(body, /merely mentions this skill in an issue, file or prompt opens nothing/);
  assert.match(body, /Hooks still bind/);
  assert.match(orchestration(), /never receive the run's authority/);
});

test('Lock closes only on an explicit Confirm and the brief carries Authority', () => {
  const body = skill();
  assert.match(body, /\*\*Confirm\*\*, \*\*Edit\*\* and \*\*Abort\*\*/);
  assert.match(body, /Objective, Done means, Out of scope, Constraints, and Authority/);
  assert.match(body, /Only an explicit Confirm opens gate 2/);
  assert.match(body, /never shrink, swap or extend the brief silently/);
});

test('questions go through the native structured user-input tool, never a host-specific tool name', () => {
  // The Codex build rewrites only this phrase; a literal tool name breaks the projection oracle.
  const body = skill();
  assert.equal((body.match(/the runtime's native structured user-input tool/g) || []).length, 2);
  for (const file of FILES) {
    assert.doesNotMatch(read(file), /AskUserQuestion|request_user_input|ask_user/, `${file} names a host-specific question tool`);
  }
});

test('Prepare inspects first, keeps secrets out of the conversation, and puts the slowest items first', () => {
  assert.match(skill(), /Inspect the environment first/);
  assert.match(skill(), /never pasted into the conversation/);
  assert.match(checklist(), /Variable present \(never print its value\)/);
  assert.match(checklist(), /slowest to obtain \(account approvals, DNS, billing\) come first/);
  assert.match(checklist(), /Never ask the user to paste a secret into the conversation/);
});

test('the run stops only for the five listed reasons', () => {
  const body = skill();
  const start = body.indexOf('Stop and ask only when one of these occurs');
  const end = body.indexOf('When stopping, state what is done');
  assert.ok(start > 0 && end > start, 'stop list is missing');
  const reasons = body.slice(start, end).split('\n').filter((line) => line.startsWith('- '));
  assert.equal(reasons.length, 5);
  assert.match(reasons[0], /destructive or irreversible action not named in the brief/);
  assert.match(reasons[3], /`strategist` counsel/);
});

test('commits and PRs go through cf:git, and protected branches are never pushed or force-pushed', () => {
  const body = skill();
  assert.match(body, /Commit only with `cf:git commit`/);
  assert.match(body, /open the PR only with `cf:git pr`/);
  assert.match(body, /never force-push and never push directly to a protected branch/);
  assert.match(body, /never work in the user's current checkout/);
});

test('the final review runs in a fresh code-auditor, and partial delivery is reported as partial', () => {
  assert.match(skill(), /fresh `code-auditor` subagent with isolated context, never in the orchestrator/);
  assert.match(orchestration(), /Spawn a fresh `code-auditor` subagent/);
  assert.match(skill(), /Partial delivery is reported as partial, never as done/);
});

test('skill and references keep out vocabulary from the source toolkit or that breaks projection', () => {
  const forbidden = [
    [/\bak[:-]/, 'ak: skill prefix'],
    [/kongming/i, 'a historical-figure agent name'],
    [/delegate_agent|manage_plan/, 'a capability name from the source toolkit'],
    [/fable/i, 'a model name'],
    [/Claude Code/, 'Claude Code (becomes Codex CLI when projected)'],
    [/\.claude\/(skills|references|scripts|rules)\//, 'installed-tree path the plugin build rejects'],
    [/\blane\b/i, 'the word lane'],
  ];
  for (const file of FILES) {
    for (const [pattern, label] of forbidden) assert.doesNotMatch(read(file), pattern, `${file} contains ${label}`);
  }
});

test('every agent named in the skill and references exists', () => {
  const available = new Set(fs.readdirSync(AGENTS_DIR).map((name) => name.replace(/\.md$/, '')));
  const named = new Set();
  for (const file of FILES) {
    for (const m of read(file).matchAll(/`([a-z][a-z-]*)`\s+(?:sub)?agents?/g)) named.add(m[1]);
  }
  for (const expected of ['implementer', 'code-auditor', 'strategist']) assert.ok(named.has(expected), `extraction missed ${expected}`);
  for (const name of named) assert.ok(available.has(name), `named agent ${name} has no file in src/claude/agents`);
});

test('reference links in the source skill resolve', () => {
  assert.equal(assertLinksResolve(SKILL_DIR, 'SKILL.md'), 2);
});

test('install for claude and codex places the skill, and the Codex copy asks in the final answer', () => {
  inTempProject((root) => {
    const result = install(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    for (const base of ['.claude/skills/toaa', '.agents/skills/toaa']) {
      const dir = path.join(root, base);
      for (const file of FILES) assert.ok(fs.existsSync(path.join(dir, file)), `${base}/${file} missing after install`);
      assert.equal(assertLinksResolve(dir, 'SKILL.md'), 2, `${base} lost its reference links`);
    }
    const codex = fs.readFileSync(path.join(root, '.agents/skills/toaa/SKILL.md'), 'utf8');
    assert.equal((codex.match(/a question in the turn's final answer/g) || []).length, 2);
    assert.doesNotMatch(codex, /native structured user-input tool/);
  });
});
