'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { test } = require('node:test');
const { installCodexHookRuntime } = require('./codex-hook-runtime-fixture.cjs');

const OLD_INSPECTION_MATCHER = 'Bash|exec_command|apply_patch|Edit|Write|Read|Glob|Grep|mcp__.*|shell';
const NEW_INSPECTION_MATCHER = 'Bash|exec_command|shell|apply_patch|mcp__.*|collaborationspawn_agent|collaborationwait_agent';
function matcherFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-matcher-'));
  const previous = process.cwd();
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/codex/hooks.json'), 'utf8'));
  const messages = [], warnings = [];
  const ctx = { dryRun: false, results: { updated: 0, unchanged: 0, errors: 0 },
    manifest: require('../../src/claude/migration-manifest.json'),
    ui: { detail: value => messages.push(value), warn: value => warnings.push(value) } };
  const file = path.join(root, '.codex/hooks.json');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true }); process.chdir(root);
    const merge = require('../phases/codex-hooks.js').mergeCodexHooks;
    run({ root, config, ctx, file, messages, warnings, merge: () => merge(ctx, 'codex', root),
      save: () => fs.writeFileSync(file, JSON.stringify(config)), read: () => JSON.parse(fs.readFileSync(file, 'utf8')) });
  } finally { process.chdir(previous); fs.rmSync(root, { recursive: true, force: true }); }
}
test('upgrade refreshes a former managed inspection matcher and reports it', () => matcherFixture(f => {
  f.config.hooks.PreToolUse[0].matcher = OLD_INSPECTION_MATCHER; f.save();
  const before = fs.readFileSync(f.file, 'utf8');
  f.ctx.dryRun = true; f.merge();
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  assert.ok(f.messages.some(line => /↻.*matcher updated/.test(line)));
  f.ctx.dryRun = false; f.messages.length = 0; f.merge();
  assert.equal(f.read().hooks.PreToolUse[0].matcher, NEW_INSPECTION_MATCHER);
  assert.ok(f.messages.some(line => /↻.*matcher updated/.test(line)));
  assert.ok(!f.messages.some(line => /already registered/.test(line)));
}));
test('upgrade preserves a mixed user group and warns', () => matcherFixture(f => {
  f.config.hooks.PreToolUse[0].matcher = OLD_INSPECTION_MATCHER;
  f.config.hooks.PreToolUse[0].hooks.push({ type: 'command', command: 'echo user-owned' }); f.save(); f.merge();
  assert.equal(f.read().hooks.PreToolUse[0].matcher, OLD_INSPECTION_MATCHER);
  assert.ok(f.read().hooks.PreToolUse[0].hooks.some(h => h.command === 'echo user-owned'));
  assert.ok(f.warnings.some(line => /matcher.*preserv/i.test(line)));
}));
test('upgrade preserves a user-selected managed matcher and warns', () => matcherFixture(f => {
  f.config.hooks.PreToolUse[0].matcher = 'Read|Grep'; f.save(); f.merge();
  assert.equal(f.read().hooks.PreToolUse[0].matcher, 'Read|Grep');
  assert.ok(f.warnings.some(line => /matcher.*preserv/i.test(line)));
}));
test('upgrade refreshes the surviving group after retired hooks are pruned', () => matcherFixture(f => {
  f.config.hooks.PreToolUse[0].matcher = OLD_INSPECTION_MATCHER;
  f.config.hooks.PreToolUse[0].hooks.push({ type: 'command', command: 'node ".codex/hooks/task-scaffold-guard.cjs"' });
  f.save(); f.merge();
  assert.equal(f.read().hooks.PreToolUse[0].matcher, NEW_INSPECTION_MATCHER);
  assert.ok(!JSON.stringify(f.read()).includes('task-scaffold-guard'));
  assert.ok(f.messages.some(line => /matcher updated/.test(line)));
}));

const PACKAGE_ROOT = path.join(__dirname, '../..');
const CODEX_HOOKS = path.join(PACKAGE_ROOT, 'src/codex/hooks');
const PROVENANCE = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/provenance.cjs'));
const POLICY = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/workflow-policy.cjs'));
const VALID_BASE = '0123456789abcdef0123456789abcdef01234567';
const VALID_HEAD = '89abcdef0123456789abcdef0123456789abcdef';
const { stateDir: codexStateDir } = require(
  path.join(CODEX_HOOKS, 'lib', 'state-store.cjs')
);

// A hook child that never exits must fail its test, not hang the whole suite.
const HOOK_TIMEOUT_MS = 30000;

function runHook(file, cwd, payload) {
  const result = spawnSync(process.execPath, [file], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: HOOK_TIMEOUT_MS
  });
  assert.equal(result.error, undefined, `${path.basename(file)} did not exit: ${result.error?.message}`);
  return result;
}

function runtimeContext(root, feature = 'auth', session = 'session-a') {
  return PROVENANCE.deriveRuntimeContext({
    projectRoot: root,
    specsRoot: path.join(root, 'specs'),
    specFile: path.join(root, 'specs', feature, 'plan.md'),
    featureName: feature,
    runtimeSession: session,
  });
}

function bindReceipt(root, value, feature = 'auth', session = 'session-a') {
  const context = runtimeContext(root, feature, session);
  return value.replaceAll(VALID_BASE, context.base).replaceAll(VALID_HEAD, context.head);
}

function workflowRuntimeContext(root, feature = 'auth', session = 'session-a') {
  return PROVENANCE.deriveRuntimeContext({
    projectRoot: root,
    specsRoot: path.join(root, 'specs'),
    specFile: path.join(root, 'specs', feature, 'plan.md'),
    featureName: feature,
    runtimeSession: session,
  });
}

/** A process-first packet with one flat task whose Verification Plan runs `command`. */
function writeProcessTask(featureDir, status, receiptLines = null, command = 'pnpm test', taskName = 'task-01-auth.md') {
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Plan\nSpecs-Contract: process-first-ready-v1\n');
  const lines = [
    '# Task 01', '', `Status: ${status}`, '',
    '## Dependencies', '', '- none', '',
    '## Verification Plan', '', `- Command: ${command}`, '',
  ];
  if (receiptLines) lines.push('## Receipt', '', ...receiptLines, '');
  fs.writeFileSync(path.join(featureDir, taskName), lines.join('\n'));
  return path.join(featureDir, taskName);
}

function inHookFixture(run, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-hooks-'));
  const hooks = path.join(root, '.codex', 'hooks');
  let deferred = false;
  try {
    installCodexHookRuntime(root);
    fs.mkdirSync(path.join(root, '.codex', 'scripts'), { recursive: true });
    if (options.policy !== 'missing') {
      if (options.policy === 'malformed') {
        fs.writeFileSync(path.join(root, '.codex', 'scripts', 'workflow-policy.cjs'), 'module.exports = {\n');
      } else {
        fs.copyFileSync(
          path.join(PACKAGE_ROOT, 'src/claude/scripts/workflow-policy.cjs'),
          path.join(root, '.codex', 'scripts', 'workflow-policy.cjs'),
        );
        fs.copyFileSync(
          path.join(PACKAGE_ROOT, 'src/claude/scripts/provenance.cjs'),
          path.join(root, '.codex', 'scripts', 'provenance.cjs'),
        );
        fs.copyFileSync(
          path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-receipt.cjs'),
          path.join(root, '.codex', 'scripts', 'spec-receipt.cjs'),
        );
      }
    }
    fs.copyFileSync(
      path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'),
      path.join(root, '.codex', 'scripts', 'spec-resolver.cjs'),
    );
    fs.writeFileSync(path.join(root, '.codex', 'scripts', 'spec-scaffold.cjs'), '');
    for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test'], ['commit', '--allow-empty', '-qm', 'fixture']]) {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const result = run(root, hooks);
    if (result && typeof result.then === 'function') {
      deferred = true;
      return result.finally(() => fs.rmSync(root, { recursive: true, force: true }));
    }
    return result;
  } finally {
    if (!deferred) fs.rmSync(root, { recursive: true, force: true });
  }
}

function processTaskContent(title, status, dependency = 'none') {
  return [
    `# ${title}`, '', `Status: ${status}`, '',
    '## Dependencies', '', `- ${dependency}`, '',
    '## Verification Plan', '', '- Command: node --test', '',
  ].join('\n');
}

function inNoCommitCodexFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-no-commit-'));
  const hooks = path.join(root, '.codex/hooks');
  try {
    installCodexHookRuntime(root);
    const scripts = path.join(root, '.codex/scripts');
    fs.mkdirSync(scripts, { recursive: true });
    for (const name of ['workflow-policy.cjs', 'provenance.cjs', 'spec-receipt.cjs', 'spec-resolver.cjs']) {
      fs.copyFileSync(path.join(PACKAGE_ROOT, 'src/claude/scripts', name), path.join(scripts, name));
    }
    for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test']]) {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const writePacket = (feature, status) => {
      const dir = path.join(root, 'specs', feature);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'plan.md'), '# Plan\nSpecs-Contract: process-first-ready-v1\n');
      fs.writeFileSync(path.join(dir, 'task-01-work.md'), processTaskContent('Task 01: work', status)
        + (status === 'done' ? '\n## Receipt\n\nVerification: PASS\n' : ''));
    };
    const invoke = (hook, event) => runHook(path.join(hooks, `${hook}.cjs`), root, {
      cwd: root, session_id: 'no-commit-codex', hook_event_name: event, prompt: 'Continue specs/auth',
    });
    run({ writePacket, gate: () => invoke('spec-gate', 'Stop'), state: () => invoke('spec-state', 'UserPromptSubmit') });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('Codex collaborationspawn_agent appears as the latest tracked tool on resume', () => {
  inHookFixture((root, hooks) => {
    const state = path.join(hooks, 'state.cjs');
    const session = { cwd: root, session_id: 'spawn-tracking' };
    const tracked = runHook(state, root, {
      ...session, hook_event_name: 'PostToolUse', tool_name: 'collaborationspawn_agent',
      tool_input: { message: 'Inspect the parser behavior' },
    });
    assert.equal(tracked.status, 0, tracked.stderr);
    const resumed = runHook(state, root, { ...session, hook_event_name: 'SessionStart', source: 'resume' });
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.match(resumed.stdout, /Latest Tracked Tool/);
    assert.match(resumed.stdout, /collaborationspawn_agent/);
  });
});

test('Codex collaborationspawn_agent input does not create a pending todo', () => {
  inHookFixture((root, hooks) => {
    const state = path.join(hooks, 'state.cjs');
    const session = { cwd: root, session_id: 'spawn-no-todo' };
    const title = 'Inspect parser without creating a todo';
    const tracked = runHook(state, root, {
      ...session, hook_event_name: 'PostToolUse', tool_name: 'collaborationspawn_agent',
      tool_input: { id: 'spawn-child', title },
    });
    assert.equal(tracked.status, 0, tracked.stderr);
    const resumed = runHook(state, root, { ...session, hook_event_name: 'SessionStart', source: 'resume' });
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.match(resumed.stdout, /Latest Tracked Tool/);
    assert.match(resumed.stdout, /collaborationspawn_agent/);
    const pending = resumed.stdout.match(/## What's Left\n([\s\S]*?)(?=\n## |$)/);
    assert.ok(pending, 'the pending task section must be present');
    assert.ok(!pending[1].includes(title), 'spawn metadata must not become a pending task');
  });
});

test('Codex no commits allows Stop without done tasks and prints one reminder', () => {
  inNoCommitCodexFixture(({ writePacket, gate, state }) => {
    writePacket('auth', 'in_progress');
    const stopped = gate();
    assert.equal(stopped.status, 0, stopped.stderr);
    assert.equal(stopped.stdout.trim(), '');
    const prompted = state();
    assert.equal(prompted.status, 0, prompted.stderr);
    assert.match(prompted.stdout, /no commits/);
    assert.equal(prompted.stdout.trim().split('\n').length, 1);
    assert.doesNotMatch(prompted.stdout, /Spec tollgate unavailable/);
  });
});

test('Codex no commits blocks a done task with first commit guidance', () => {
  inNoCommitCodexFixture(({ writePacket, gate }) => {
    writePacket('auth', 'done');
    const result = gate();
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.decision, 'block');
    assert.match(body.reason, /first commit/);
    assert.doesNotMatch(body.reason, /controlled failure/);
  });
});

test('Codex no commits blocks two completed packets with first commit guidance', () => {
  inNoCommitCodexFixture(({ writePacket, gate }) => {
    for (const feature of ['auth', 'billing']) writePacket(feature, 'done');
    const result = gate();
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.decision, 'block');
    assert.match(body.reason, /first commit/);
    assert.doesNotMatch(body.reason, /controlled failure/);
  });
});

function canonicalProcessTask(root, title, dependency = 'none') {
  const context = workflowRuntimeContext(root, 'auth', 'session-auth-state');
  return [
    processTaskContent(title, 'done', dependency),
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${context.base}`, `Head: ${context.head}`,
    '```text', 'node --test', '1 test passed', '```', '',
  ].join('\n');
}

test('Claude and Codex docs sync ignore committed Specs state but report source changes', () => {
  inHookFixture((root, hooks) => {
    const docsDir = path.join(root, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"docs-sync-fixture"}\n');
    fs.writeFileSync(path.join(docsDir, 'project-overview-pdr.md'), '# Fixture\n');
    let result = spawnSync('git', ['-C', root, 'add', 'package.json', 'docs/project-overview-pdr.md'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    result = spawnSync('git', ['-C', root, 'commit', '-qm', 'source baseline'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const sourceBase = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    fs.writeFileSync(path.join(docsDir, '.sync_hash'), `${sourceBase}\n`);
    result = spawnSync('git', ['-C', root, 'add', 'docs/.sync_hash'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    result = spawnSync('git', ['-C', root, 'commit', '-qm', 'sync docs'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const featureDir = path.join(root, 'specs', 'demo');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Completed packet\n');
    result = spawnSync('git', ['-C', root, 'add', 'specs/demo/plan.md'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    result = spawnSync('git', ['-C', root, 'commit', '-qm', 'refresh receipt state'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const payload = { cwd: root, session_id: 'docs-sync-session', hook_event_name: 'SessionStart' };
    const docsSyncHooks = [
      path.join(hooks, 'docs-sync.cjs'),
      path.join(PACKAGE_ROOT, 'src/claude/hooks/docs-sync.cjs'),
    ];
    for (const hook of docsSyncHooks) {
      const afterSpecCommit = runHook(hook, root, payload);
      assert.equal(afterSpecCommit.status, 0, afterSpecCommit.stderr);
      assert.equal(afterSpecCommit.stdout, '', `${hook}: spec-only commits must not stale docs sync`);
    }

    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.js'), 'module.exports = true;\n');
    result = spawnSync('git', ['-C', root, 'add', 'src/app.js'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    result = spawnSync('git', ['-C', root, 'commit', '-qm', 'change source'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const hook of docsSyncHooks) {
      const afterSourceCommit = runHook(hook, root, payload);
      assert.equal(afterSourceCommit.status, 0, afterSourceCommit.stderr);
      assert.match(afterSourceCommit.stdout, /Docs sync needed/);
    }
  });
});

function inInstalledProcessSpecStateFixture(run) {
  return inHookFixture((root, hooks) => {
    const feature = path.join(root, 'specs', 'auth');
    fs.mkdirSync(feature, { recursive: true });
    fs.writeFileSync(path.join(feature, 'plan.md'), '# Auth plan\nSpecs-Contract: process-first-ready-v1\n');

    const writeTask = (basename, title, status, dependency = 'none') => {
      fs.writeFileSync(
        path.join(feature, basename),
        processTaskContent(title, status, dependency),
      );
    };
    const runState = () => runHook(path.join(hooks, 'spec-state.cjs'), root, {
      cwd: root,
      featureName: 'auth',
      session_id: 'session-auth-state',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'Continue',
    });
    const findCacheFile = () => {
      const cacheDir = path.join(hooks, '.logs');
      const cacheNames = fs.existsSync(cacheDir)
        ? fs.readdirSync(cacheDir).filter((file) => file.startsWith('tollgate-'))
        : [];
      assert.equal(cacheNames.length, 1, 'one installed session cache must exist');
      return path.join(cacheDir, cacheNames[0]);
    };
    return run({
      feature,
      findCacheFile,
      hooks,
      root,
      runState,
      writePlan: (content) => fs.writeFileSync(path.join(feature, 'plan.md'), content),
      writeTask,
    });
  });
}

function writeCodexLegacyPacket(root, name = 'old') {
  const dir = path.join(root, 'specs', name);
  fs.mkdirSync(path.join(dir, 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify({
    feature_name: name,
    status: 'in_progress',
    task_registry: { 'tasks/task-R1-01-x.md': { status: 'done' } },
  }));
  fs.writeFileSync(path.join(dir, 'tasks', 'task-R1-01-x.md'), '# Task\n\n**Status:** done\n');
}

const CODEX_LEGACY_NOTICE = /`specs\/old` is a legacy Specs packet without plan\.md; CafeKit no longer reads it/g;

test('Codex spec-state notices a leftover legacy packet once per session, also when it is the only packet', () => {
  inHookFixture((root, hooks) => {
    writeCodexLegacyPacket(root);
    const prompt = (session) => runHook(path.join(hooks, 'spec-state.cjs'), root, {
      cwd: root, session_id: session, hook_event_name: 'UserPromptSubmit', prompt: 'Continue',
    });
    const first = prompt('session-a');
    assert.equal(first.status, 0, first.stderr);
    assert.equal((first.stdout.match(CODEX_LEGACY_NOTICE) || []).length, 1);
    assert.equal((prompt('session-a').stdout.match(CODEX_LEGACY_NOTICE) || []).length, 0, 'the same session is not told twice');
    assert.equal((prompt('session-b').stdout.match(CODEX_LEGACY_NOTICE) || []).length, 1, 'a new session is told once');
  });
});

test('Codex Stop ignores a leftover legacy packet and still blocks a malformed process-first packet', () => {
  inHookFixture((root, hooks) => {
    const gate = path.join(hooks, 'spec-gate.cjs');
    const payload = { cwd: root, session_id: 'session-a', hook_event_name: 'Stop', stop_hook_active: false };
    writeCodexLegacyPacket(root);
    const legacyOnly = runHook(gate, root, payload);
    assert.equal(legacyOnly.status, 0, legacyOnly.stderr);
    assert.equal(legacyOnly.stdout, '', 'a legacy packet alone never blocks');

    const shared = path.join(root, 'specs', '_shared');
    fs.mkdirSync(shared, { recursive: true });
    fs.writeFileSync(path.join(shared, 'active-feature.json'), '{"featureName": "old"}\n');
    assert.equal(runHook(gate, root, payload).stdout, '', 'a recorded legacy packet never blocks');
    fs.rmSync(shared, { recursive: true, force: true });

    const feature = path.join(root, 'specs', 'cycle');
    writeProcessTask(feature, 'done', null, 'pnpm test', 'task-01-a.md');
    writeProcessTask(feature, 'pending', null, 'pnpm test', 'task-02-b.md');
    for (const [name, dependency] of [['task-01-a.md', 'task-02-b.md'], ['task-02-b.md', 'task-01-a.md']]) {
      const file = path.join(feature, name);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- none', `- ${dependency}`));
    }
    const cycle = runHook(gate, root, payload);
    assert.equal(cycle.status, 0, cycle.stderr);
    const block = JSON.parse(cycle.stdout);
    assert.equal(block.decision, 'block');
    assert.match(block.reason, /invalid workflow packet/);
  });
});

test('Codex Stop still blocks a recorded missing packet and reads a plan.md + spec.json packet as process-first', () => {
  inHookFixture((root, hooks) => {
    const gate = path.join(hooks, 'spec-gate.cjs');
    const payload = { cwd: root, session_id: 'session-a', hook_event_name: 'Stop', stop_hook_active: false };
    const feature = path.join(root, 'specs', 'auth');
    writeProcessTask(feature, 'done');
    fs.writeFileSync(path.join(feature, 'spec.json'), JSON.stringify({ feature_name: 'auth' }));
    const hybrid = runHook(gate, root, payload);
    assert.equal(hybrid.status, 0, hybrid.stderr);
    const hybridBlock = JSON.parse(hybrid.stdout);
    assert.equal(hybridBlock.decision, 'block');
    assert.match(hybridBlock.reason, /task-01-auth\.md/);

    const shared = path.join(root, 'specs', '_shared');
    fs.mkdirSync(shared, { recursive: true });
    fs.writeFileSync(path.join(shared, 'active-feature.json'), '{"featureName": "nope"}\n');
    const missing = runHook(gate, root, payload);
    assert.equal(missing.status, 0, missing.stderr);
    const missingBlock = JSON.parse(missing.stdout);
    assert.equal(missingBlock.decision, 'block');
    assert.match(missingBlock.reason, /explicit_not_found/);
  });
});

test('Codex installed spec-state uses one snapshot for done task receipts', (t) => {
  inInstalledProcessSpecStateFixture(({ feature, hooks, root, writeTask }) => {
    const trace = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-codex-snapshot-count-'));
    try {
      const tasks = ['task-01-work.md', 'task-02-work.md'];
      for (const name of tasks) writeTask(name, name, 'done');
      writeTask('task-03-work.md', 'Task 03: work', 'in_progress');
      const scripts = path.join(root, '.codex/scripts');
      const provenance = require(path.join(scripts, 'provenance.cjs'));
      const policy = require(path.join(scripts, 'workflow-policy.cjs'));
      const receipt = require(path.join(scripts, 'spec-receipt.cjs'));
      const context = provenance.deriveRuntimeContext({ projectRoot: root,
        specsRoot: path.join(root, 'specs'), specFile: path.join(feature, 'plan.md'),
        featureName: 'auth', runtimeSession: 'one-snapshot' });
      for (const name of tasks) {
        fs.appendFileSync(path.join(feature, name), [
          '\n## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
          `Base: ${context.base}`, `Head: ${context.head}`, '```text', '1 test passed', '```', '',
        ].join('\n'));
        assert.deepEqual(receipt.checkWorkflowTaskReceipt(feature, name, context, policy).failures, []);
      }
      const countFile = path.join(trace, 'git-status.txt');
      const preload = path.join(trace, 'count.cjs');
      fs.writeFileSync(preload, `
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
for (const method of ['spawnSync', 'execFileSync']) {
  const original = cp[method];
  cp[method] = function(command, args, ...rest) {
    if (path.basename(String(command)) === 'git' && Array.isArray(args) && args.includes('status'))
      fs.appendFileSync(${JSON.stringify(countFile)}, 'status\\n');
    return original.call(this, command, args, ...rest);
  };
}
`);
      const result = spawnSync(process.execPath, [path.join(hooks, 'spec-state.cjs')], {
        cwd: root, encoding: 'utf8', timeout: HOOK_TIMEOUT_MS,
        env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${JSON.stringify(preload)}` },
        input: JSON.stringify({ cwd: root, featureName: 'auth', hook_event_name: 'UserPromptSubmit',
          session_id: 'one-snapshot', prompt: 'Continue specs/auth' }),
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Spec state changed/);
      const count = fs.readFileSync(countFile, 'utf8').trim().split('\n').length;
      t.diagnostic(`Codex git status calls: ${count}`);
      assert.ok(count > 0 && count <= 2, `git status calls: ${count}; expected at most 2`);
    } finally { fs.rmSync(trace, { recursive: true, force: true }); }
  });
});

test('Codex installed spec-state re-evaluates a standalone task when blocked becomes pending', () => {
  inInstalledProcessSpecStateFixture(({ findCacheFile, hooks, runState, writeTask }) => {
    writeTask('task-01-auth.md', 'Task 01: auth', 'blocked');

    const blocked = runState();
    assert.equal(blocked.status, 0, blocked.stderr);
    assert.match(blocked.stdout, /Spec state changed: `auth`/);
    assert.doesNotMatch(blocked.stdout, /Next unblocked/);
    const cacheFile = findCacheFile();
    assert.ok(cacheFile.startsWith(`${hooks}${path.sep}`), 'cache must stay inside temporary installed hooks');
    const blockedCache = fs.readFileSync(cacheFile, 'utf8');

    writeTask('task-01-auth.md', 'Task 01: auth', 'pending');
    const pending = runState();
    assert.equal(pending.status, 0, pending.stderr);
    assert.match(pending.stdout, /Spec state changed: `auth`/);
    assert.match(pending.stdout, /Next unblocked: `task-01-auth\.md`/);
    assert.notEqual(fs.readFileSync(cacheFile, 'utf8'), blockedCache, 'state cache must change');
  });
});

test('Codex installed spec-state requires current canonical dependency proof and keys receipt mutations', () => {
  inInstalledProcessSpecStateFixture(({ feature, findCacheFile, hooks, root, runState, writeTask }) => {
    const predecessor = 'task-01-semantic-review.md';
    const dependent = 'task-02-implementation.md';
    writeTask(predecessor, 'Task 01: semantic review', 'blocked');
    writeTask(dependent, 'Task 02: implementation', 'pending', predecessor);
    const dependentPath = path.join(feature, dependent);
    const unchangedDependent = fs.readFileSync(dependentPath, 'utf8');

    const blocked = runState();
    assert.equal(blocked.status, 0, blocked.stderr);
    assert.match(blocked.stdout, /Tasks: 0 done \/ 2 total/);
    assert.doesNotMatch(blocked.stdout, /Next unblocked/);
    const cacheFile = findCacheFile();
    assert.ok(cacheFile.startsWith(`${hooks}${path.sep}`), 'cache must stay inside temporary installed hooks');
    const blockedCache = fs.readFileSync(cacheFile, 'utf8');

    writeTask(predecessor, 'Task 01: semantic review', 'done');
    const missing = runState();
    assert.equal(missing.status, 0, missing.stderr);
    assert.doesNotMatch(missing.stdout, /Next unblocked/);
    const missingCache = fs.readFileSync(cacheFile, 'utf8');
    assert.notEqual(missingCache, blockedCache, 'done without proof must change cached proof state');

    fs.appendFileSync(path.join(feature, predecessor), '\n## Receipt\n\nVerification: PASS\n');
    const malformed = runState();
    assert.equal(malformed.status, 0, malformed.stderr);
    assert.doesNotMatch(malformed.stdout, /Next unblocked/);

    fs.writeFileSync(path.join(feature, predecessor), canonicalProcessTask(root, 'Task 01: semantic review'));
    const ready = runState();
    assert.equal(ready.status, 0, ready.stderr);
    assert.match(ready.stdout, /Next unblocked: `task-02-implementation\.md`/);
    const readyCache = fs.readFileSync(cacheFile, 'utf8');
    assert.notEqual(readyCache, missingCache, 'canonical proof must change cached proof state');

    fs.writeFileSync(
      path.join(feature, predecessor),
      fs.readFileSync(path.join(feature, predecessor), 'utf8').replace('Verification: PASS', 'Verification: FAIL'),
    );
    const mutated = runState();
    assert.equal(mutated.status, 0, mutated.stderr);
    assert.doesNotMatch(mutated.stdout, /Next unblocked/);
    assert.notEqual(fs.readFileSync(cacheFile, 'utf8'), readyCache, 'receipt-only mutation must change cache');
    assert.equal(fs.readFileSync(dependentPath, 'utf8'), unchangedDependent, 'dependent must remain pending');
  });
});

test('Codex installed spec-state keeps unversioned pending packets out of Next with migration guidance', () => {
  inInstalledProcessSpecStateFixture(({ feature, runState, writePlan, writeTask }) => {
    const fencedMarkerPlan = '# Auth plan\n\n```markdown\nSpecs-Contract: process-first-ready-v1\n```\n';
    writePlan(fencedMarkerPlan);
    writeTask('task-01-auth.md', 'Task 01: auth', 'pending');
    const taskBytes = fs.readFileSync(path.join(feature, 'task-01-auth.md'));
    const result = runState();
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Next unblocked/);
    assert.match(result.stdout, /Migration required: add `Specs-Contract: process-first-ready-v1`/);
    const cached = runState();
    assert.equal(cached.status, 0, cached.stderr);
    assert.doesNotMatch(cached.stdout, /Next unblocked/);
    assert.match(cached.stdout, /Add `Specs-Contract: process-first-ready-v1`/);

    writePlan(fencedMarkerPlan.replace('# Auth plan\n', '# Auth plan\nSpecs-Contract: process-first-ready-v1\n'));
    const marked = runState();
    assert.equal(marked.status, 0, marked.stderr);
    assert.match(marked.stdout, /Spec state changed: `auth`/);
    assert.match(marked.stdout, /Next unblocked: `task-01-auth\.md`/);
    assert.deepEqual(fs.readFileSync(path.join(feature, 'task-01-auth.md')), taskBytes, 'marker-only transition must not change task bytes');
  });
});

test('Codex resolver ignores fenced workflow annotations and rejects fenced-only Status', () => {
  inInstalledProcessSpecStateFixture(({ feature, root, runState, writePlan, writeTask }) => {
    const resolver = require(path.join(root, '.codex', 'scripts', 'spec-resolver.cjs'));
    const trailingFence = resolver.annotatedMarkdownLines([
      '```markdown', '``` trailing', 'Specs-Contract: process-first-ready-v1',
      'Status: done', '## Receipt', '```',
    ].join('\n'));
    assert.deepEqual(trailingFence.slice(2, 5).map(({ outsideFence }) => outsideFence), [false, false, false]);
    const fourSpaceFence = resolver.annotatedMarkdownLines('    ```markdown\nStatus: pending');
    assert.equal(fourSpaceFence[1].outsideFence, true);
    writePlan('# Auth plan\nSpecs-Contract: process-first-ready-v1\n');
    fs.writeFileSync(path.join(feature, 'task-01-fenced-only.md'), [
      '# Task 01', '', '```markdown', 'Status: done', '```', '',
      '## Dependencies', '', '- none', '', '## Verification Plan', '', '- Command: node --test', '',
    ].join('\n'));
    const malformed = resolver.resolveWorkflowCandidate({ projectRoot: root, runtime: {}, explicitFeature: 'auth' });
    assert.equal(malformed.error, 'explicit_malformed');
    assert.match(malformed.reason, /must contain exactly one supported Status field/);

    fs.rmSync(path.join(feature, 'task-01-fenced-only.md'));
    writeTask('task-01-dependent.md', 'Task 01: dependent', 'pending', 'task-02-predecessor.md');
    fs.writeFileSync(path.join(feature, 'task-02-predecessor.md'), [
      '# Task 02', '', 'Status: pending', '', '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
      '~~~~markdown', 'Status: done', '## Dependencies', '- task-01-dependent.md', '## Receipt',
      'Verification: PASS', 'Command: node --test', 'Exit: 0', '```text', 'fake pass', '```', '~~~~', '',
    ].join('\n'));
    const result = runState();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Next unblocked: `task-02-predecessor\.md`/);
    assert.doesNotMatch(result.stdout, /Next unblocked: `task-01-dependent\.md`/);
  });
});

test('Codex resolver accepts unique legacy task numbers, rejects ambiguity, and rejects exact cycles', () => {
  inInstalledProcessSpecStateFixture(({ feature, root, writePlan, writeTask }) => {
    const resolver = require(path.join(root, '.codex', 'scripts', 'spec-resolver.cjs'));
    writePlan('# Auth plan\n');
    writeTask('task-01-a.md', 'Task 01: a', 'pending');
    writeTask('task-02-b.md', 'Task 02: b', 'pending', '01');
    fs.writeFileSync(path.join(feature, 'task-03-c.md'), '# Task 03: c\n\nStatus: pending\n');
    const unique = resolver.resolveWorkflowCandidate({ projectRoot: root, runtime: {}, explicitFeature: 'auth' });
    assert.deepEqual(unique.taskRegistry['task-02-b.md'].dependencies, ['task-01-a.md']);
    assert.deepEqual(unique.taskRegistry['task-03-c.md'].dependencies, []);
    assert.equal(unique.workflowContract, null);
    assert.equal(unique.queueReady, false);

    writeTask('task-01-second.md', 'Task 01: second', 'pending');
    const ambiguous = resolver.resolveWorkflowCandidate({ projectRoot: root, runtime: {}, explicitFeature: 'auth' });
    assert.equal(ambiguous.error, 'explicit_malformed');
    assert.match(ambiguous.reason, /legacy dependency 01 maps to 2 task basenames/);

    fs.rmSync(path.join(feature, 'task-01-second.md'));
    fs.rmSync(path.join(feature, 'task-03-c.md'));
    writePlan('# Auth plan\nSpecs-Contract: process-first-ready-v1\n');
    writeTask('task-01-a.md', 'Task 01: a', 'pending', 'task-02-b.md');
    writeTask('task-02-b.md', 'Task 02: b', 'pending', 'task-01-a.md');
    const cycle = resolver.resolveWorkflowCandidate({ projectRoot: root, runtime: {}, explicitFeature: 'auth' });
    assert.equal(cycle.error, 'explicit_malformed');
    assert.match(cycle.reason, /dependency cycle detected: task-01-a\.md -> task-02-b\.md -> task-01-a\.md/);
  });
});

test('Codex inspect still denies blocked reads when the configured specs path escapes', () => {
  inHookFixture((root, hooks) => {
    fs.writeFileSync(path.join(root, '.codex/runtime.json'), JSON.stringify({ paths: { specs: '../outside' } }));
    const result = runHook(path.join(hooks, 'inspect-block.cjs'), root, {
      cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'dist/index.html' },
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /SCOPE LIMIT EXCEEDED/);
  });
});

test('Codex rules still inject when the configured specs path escapes', () => {
  inHookFixture((root, hooks) => {
    fs.writeFileSync(path.join(root, '.codex/runtime.json'), JSON.stringify({ paths: { specs: '../outside' } }));
    const result = runHook(path.join(hooks, 'rules.cjs'), root, {
      cwd: root, hook_event_name: 'UserPromptSubmit', session_id: 'invalid-specs-rules',
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /## Rules/);
    assert.ok(result.stdout.includes(`${fs.realpathSync(root)}/specs/`));
  });
});

test('Codex rules wait for runtime before reserving the same session', () => {
  inHookFixture((root, hooks) => {
    const file = path.join(root, '.codex/runtime.json');
    const payload = { cwd: root, hook_event_name: 'UserPromptSubmit', session_id: 'waiting-for-runtime' };
    const hook = path.join(hooks, 'rules.cjs');
    assert.equal(fs.existsSync(file), false);
    const absent = runHook(hook, root, payload);
    assert.equal(absent.status, 0);
    assert.equal(absent.stdout, '');
    fs.writeFileSync(file, JSON.stringify({ paths: { specs: 'specs' } }));
    const present = runHook(hook, root, payload);
    assert.equal(present.status, 0);
    assert.match(present.stdout, /## Rules/);
    assert.equal(runHook(hook, root, payload).stdout, '');
  });
});

test('Codex secret guardrail runs from source with its shared keyword shim', () => {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.PROJECT_ROOT;
  const result = spawnSync(process.execPath, [path.join(CODEX_HOOKS, 'secret-output-guardrail.cjs')], {
    cwd: PACKAGE_ROOT, env, encoding: 'utf8', timeout: HOOK_TIMEOUT_MS, input: JSON.stringify({ prompt: 'Explain secret handling.' }),
  });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /## Secret handling/);
});

test('Codex secret guardrail fails open without a keyword library or a stack', () => {
  inHookFixture((root, hooks) => {
    fs.unlinkSync(path.join(hooks, 'lib/secret-keywords.cjs'));
    const result = runHook(path.join(hooks, 'secret-output-guardrail.cjs'), root, { prompt: 'Explain secret handling.' });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    const rows = fs.readFileSync(path.join(hooks, '.logs/hook-log.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].hook, 'secret-output-guardrail');
  });
});

for (const invalidSpecs of [false, true]) {
  test(`Codex compact warns about pending confirmations${invalidSpecs ? ' with an invalid specs path' : ''}`, () => {
    inHookFixture((root, hooks) => {
      fs.writeFileSync(path.join(root, '.codex/runtime.json'), JSON.stringify({ paths: { specs: invalidSpecs ? '../outside' : 'specs' } }));
      const result = runHook(path.join(hooks, 'session.cjs'), root, {
        cwd: root, hook_event_name: 'SessionStart', source: 'compact', session_id: 'compact-session',
      });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /Pending.*(?:confirmation|approval)/i);
      assert.match(result.stdout, /(?:request|ask).*?(?:fresh|again|user)/i);
    });
  });
}

test('Codex compact clears its pending privacy request even with an invalid specs path', () => {
  inHookFixture((root, hooks) => {
    const privacy = require(path.join(hooks, 'lib/privacy-state.cjs'));
    privacy.createPending({ projectRoot: root, sessionCwd: root, sessionId: 'compact-session', filePaths: ['.env'] });
    const dir = path.join(hooks, '.privacy');
    const pending = () => fs.readdirSync(dir).filter(name => name.startsWith('pending-'));
    assert.equal(pending().length, 1);
    fs.writeFileSync(path.join(root, '.codex/runtime.json'), JSON.stringify({ paths: { specs: '../outside' } }));
    const result = runHook(path.join(hooks, 'session.cjs'), root, {
      cwd: root, hook_event_name: 'SessionStart', source: 'compact', session_id: 'compact-session',
    });
    assert.equal(result.status, 0);
    assert.equal(pending().length, 0);
  });
});

// Two privacy blocks racing on a fresh project both see no `.privacy` directory;
// the second mkdir then meets the directory the first one made.
test('Codex privacy records a request when another hook creates its state directory first', () => {
  inHookFixture((root, hooks) => {
    const privacy = require(path.join(hooks, 'lib/privacy-state.cjs'));
    fs.mkdirSync(path.join(hooks, '.privacy'), { mode: 0o700 });
    const existsSync = fs.existsSync;
    fs.existsSync = target => (path.basename(String(target)) === '.privacy' ? false : existsSync(target));
    let request;
    try {
      request = privacy.createPending({ projectRoot: root, sessionCwd: root, sessionId: 'race-session', filePaths: ['.env'] });
    } finally {
      fs.existsSync = existsSync;
    }
    assert.match(request.requestId, /^[a-f0-9]{24}$/);
  });
});

test('Codex privacy denies when its state path is a regular file', () => {
  inHookFixture((root, hooks) => {
    fs.writeFileSync(path.join(hooks, '.privacy'), '');
    const result = runHook(path.join(hooks, 'privacy-block.cjs'), root, {
      cwd: root, session_id: 'file-state', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'cat .env' },
    });
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(output.permissionDecision, 'deny');
    assert.match(output.permissionDecisionReason, /could not be evaluated safely/);
  });
});

test('Codex compact releases only its own rules reservation', () => {
  inHookFixture((root, hooks) => {
    fs.writeFileSync(path.join(root, '.codex/runtime.json'), '{}');
    const prompt = session_id => runHook(path.join(hooks, 'rules.cjs'), root, { cwd: root, hook_event_name: 'UserPromptSubmit', session_id });
    for (const id of ['session-s', 'session-t']) {
      assert.match(prompt(id).stdout, /## Rules/);
      assert.equal(prompt(id).stdout, '');
    }
    const compact = runHook(path.join(hooks, 'session.cjs'), root, {
      cwd: root, hook_event_name: 'SessionStart', source: 'compact', session_id: 'session-s',
    });
    assert.equal(compact.status, 0);
    assert.match(prompt('session-s').stdout, /## Rules/);
    assert.equal(prompt('session-t').stdout, '');
  });
});

test('Codex precompact ignores empty stdin without recording a crash', () => {
  inHookFixture((root, hooks) => {
    const result = spawnSync(process.execPath, [path.join(hooks, 'precompact.cjs')], {
      cwd: root, input: '', encoding: 'utf8', timeout: HOOK_TIMEOUT_MS,
    });
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    const file = path.join(hooks, '.logs/hook-log.jsonl');
    const rows = fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
      : [];
    assert.equal(rows.filter(row => row.hook === 'precompact' && row.status === 'crash').length, 0);
  });
});

test('Codex precompact anchors are restored only to the matching session', () => {
  inHookFixture((root, hooks) => {
    const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
    const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
    assert.equal(status.status, 0);
    const dirty = status.stdout.trim().split('\n').filter(Boolean).length;
    const capture = runHook(path.join(hooks, 'precompact.cjs'), root, {
      cwd: root, hook_event_name: 'PreCompact', trigger: 'auto', session_id: 'session-s',
    });
    assert.equal(capture.status, 0, capture.stderr);
    const restart = session_id => runHook(path.join(hooks, 'session.cjs'), root, {
      cwd: root, hook_event_name: 'SessionStart', source: 'compact', session_id,
    });
    const own = restart('session-s');
    assert.equal(own.status, 0);
    assert.match(own.stdout, /State before compaction/);
    assert.ok(own.stdout.includes(`HEAD ${head}`));
    assert.ok(own.stdout.includes(`${dirty} uncommitted path(s)`));
    const other = restart('session-t');
    assert.equal(other.status, 0);
    assert.match(other.stdout, /Pending/i);
    assert.doesNotMatch(other.stdout, /State before compaction/);
  });
});

function sessionWithoutUpdateNetwork(root, hooks, session_id) {
  const marker = path.join(root, 'update-network-attempted');
  const preload = path.join(root, 'block-update-network.cjs');
  fs.writeFileSync(preload, `require('https').get = () => {
    require('fs').writeFileSync(${JSON.stringify(marker)}, 'attempted');
    throw new Error('network disabled in update test');
  };\n`);
  const result = spawnSync(process.execPath, ['--require', preload, path.join(hooks, 'session.cjs')], {
    cwd: root, encoding: 'utf8', timeout: HOOK_TIMEOUT_MS,
    input: JSON.stringify({ cwd: root, hook_event_name: 'SessionStart', source: 'startup', session_id }),
  });
  assert.equal(fs.existsSync(marker), false, 'the cached update check must not attempt a network request');
  return result;
}

test('Codex SessionStart prints a newer cached CafeKit version', () => {
  inHookFixture((root, hooks) => {
    fs.writeFileSync(path.join(root, '.codex/cafekit.json'), JSON.stringify({ version: '1.2.3' }));
    fs.writeFileSync(path.join(root, '.codex/.cafekit-update-cache.json'), JSON.stringify({ ts: Date.now(), latest: '1.3.0' }));
    const result = sessionWithoutUpdateNetwork(root, hooks, 'cached-update');
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('\n⚡ CafeKit update available: 1.2.3 → 1.3.0\n   Run: npx @haposoft/cafekit\n'));
  });
});

test('Codex SessionStart stays silent about an equal cached CafeKit version', () => {
  inHookFixture((root, hooks) => {
    fs.writeFileSync(path.join(root, '.codex/cafekit.json'), JSON.stringify({ version: '1.2.3' }));
    fs.writeFileSync(path.join(root, '.codex/.cafekit-update-cache.json'), JSON.stringify({ ts: Date.now(), latest: '1.2.3' }));
    const result = sessionWithoutUpdateNetwork(root, hooks, 'equal-update');
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /CafeKit update available/);
  });
});

test('Codex update failure still clears pending privacy for the session', () => {
  inHookFixture((root, hooks) => {
    const privacy = require(path.join(hooks, 'lib/privacy-state.cjs'));
    privacy.createPending({ projectRoot: root, sessionCwd: root, sessionId: 'failed-update', filePaths: ['.env'] });
    fs.writeFileSync(path.join(root, '.codex/cafekit.json'), JSON.stringify({ version: '1.2.3' }));
    fs.writeFileSync(path.join(hooks, 'lib/update-check.cjs'), "module.exports = { checkCafeKitUpdate() { throw new Error('synthetic update failure'); } };\n");
    const result = sessionWithoutUpdateNetwork(root, hooks, 'failed-update');
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    const pending = fs.readdirSync(path.join(hooks, '.privacy')).filter(name => name.startsWith('pending-'));
    assert.equal(pending.length, 0);
  });
});

test('Codex Stop describes an escaping specs root as an invalid workflow packet', () => {
  inHookFixture((root, hooks) => {
    fs.writeFileSync(path.join(root, '.codex/runtime.json'), JSON.stringify({ paths: { specs: '../outside' } }));
    const result = runHook(path.join(hooks, 'spec-gate.cjs'), root, {
      cwd: root, session_id: 'invalid-root-message', hook_event_name: 'Stop', stop_hook_active: false,
    });
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.decision, 'block');
    assert.match(output.reason, /^Completion gate: invalid workflow packet detected \(<specs>\):/);
    assert.doesNotMatch(output.reason, /controlled failure/);
  });
});

test('Codex spec-state shows detailed task status counts on its Phase line', () => {
  inInstalledProcessSpecStateFixture(({ writeTask, runState }) => {
    for (const [name, status] of [['task-01-active.md', 'in_progress'], ['task-02-next.md', 'pending'],
      ['task-03-blocked.md', 'blocked'], ['task-04-later.md', 'pending']]) {
      writeTask(name, name, status);
    }
    const result = runState();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^- Phase: .* \| Tasks: 0 done \/ 4 total \(1 in_progress, 2 pending, 1 blocked\)$/m);
  });
});

function shortPrivacyFixture(check) {
  return inHookFixture((root, hooks) => {
    fs.writeFileSync(path.join(root, '.env'), 'fixture\n');
    fs.writeFileSync(path.join(root, 'credentials.json'), '{}\n');
    const dir = path.join(hooks, '.privacy');
    const session = 'short-approval-session';
    const payload = (file = '.env', session_id = session) => ({ cwd: root, session_id,
      hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `cat ${file}` } });
    const block = (file, id) => runHook(path.join(hooks, 'privacy-block.cjs'), root, payload(file, id));
    const submit = (prompt, session_id = session, env = process.env) => spawnSync(process.execPath,
      [path.join(hooks, 'privacy-approval.cjs')], { cwd: root, encoding: 'utf8', env, timeout: HOOK_TIMEOUT_MS,
        input: JSON.stringify({ cwd: root, session_id, hook_event_name: 'UserPromptSubmit', prompt }) });
    const files = prefix => fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.startsWith(prefix)) : [];
    const id = result => {
      assert.equal(result.status, 0, result.stderr);
      const reason = JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason;
      const match = reason.match(/APPROVE CAFEKIT PRIVACY ([a-f0-9]{24})/);
      assert.ok(match, reason);
      return match[1];
    };
    return check({ root, hooks, dir, session, payload, block, submit, files, id });
  });
}

function asyncPrivacyBlock(fixture, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(fixture.hooks, 'privacy-block.cjs')], { cwd: fixture.root });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify(fixture.payload(file)));
  });
}

for (const [label, prompt] of [['y', 'y'], ['yes', 'yes'], ['title-case Vietnamese', 'Có'],
  ['padded y', ' y '], ['decomposed Vietnamese', 'co\u0301'], ['uppercase Vietnamese', 'CÓ'], ['terminal newline', 'Y\r\n']]) {
  test(`Codex short privacy approval accepts ${label} and reports granted paths`, () => shortPrivacyFixture(f => {
    const denied = f.block();
    const requestId = f.id(denied);
    const sessionHash = crypto.createHash('sha256').update(f.session).digest('hex');
    assert.deepEqual(f.files('short-'), [`short-${sessionHash}-${requestId}.json`]);
    assert.match(denied.stdout, /y \(or yes \/ có\)/);
    const result = f.submit(prompt);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /User approved/);
    assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /Tell the user.*\.env.*before reading/i);
    assert.equal(f.files('token-').length, 1);
    assert.equal(f.files('short-').length, 0);
    assert.equal(f.block().stdout, '');
    assert.equal(f.block().stdout, '', 'the one-hour grant remains reusable');
  }));
}

test('Codex short privacy approval is cancelled by an intervening prompt', () => shortPrivacyFixture(f => {
  f.id(f.block());
  assert.equal(f.submit('ok làm đi').status, 0);
  const result = f.submit('y');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /User approved/);
  assert.equal(f.files('token-').length, 0);
  assert.equal(f.files('short-').length, 0);
  assert.match(f.block().stdout, /"permissionDecision":"deny"/);
}));

test('Codex short privacy approval stays in its session and requires pending state', () => shortPrivacyFixture(f => {
  assert.equal(f.submit('y').status, 0);
  assert.equal(f.files('token-').length, 0);
  f.id(f.block());
  assert.doesNotMatch(f.submit('y', 'another-session').stdout, /User approved/);
  assert.equal(f.files('token-').length, 0);
  assert.match(f.submit('y').stdout, /User approved/);
}));

for (const [label, prompt] of [['extra Vietnamese text', 'y nhé'], ['extra English text', 'yes please'],
  ['repeated letter', 'yy'], ['fullwidth letter', 'ｙ'], ['zero-width suffix', 'y\u200b']]) {
  test(`Codex short privacy approval rejects ${label}`, () => shortPrivacyFixture(f => {
    f.id(f.block());
    const result = f.submit(prompt);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /User approved/);
    assert.equal(f.files('token-').length, 0);
    assert.equal(f.files('short-').length, 0);
    assert.doesNotMatch(f.submit('y').stdout, /User approved/);
  }));
}

test('Codex short privacy approval refuses two requests while the long phrase selects one', () => shortPrivacyFixture(f => {
  const first = f.id(f.block());
  f.id(f.block('credentials.json'));
  const result = f.submit('y');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /User approved/);
  assert.equal(f.files('token-').length, 0);
  assert.equal(f.files('short-').length, 0);
  const exact = f.submit(`APPROVE CAFEKIT PRIVACY ${first}`);
  assert.match(exact.stdout, /User approved/);
  assert.match(JSON.parse(exact.stdout).hookSpecificOutput.additionalContext, /Tell the user.*\.env.*before reading/i);
  assert.equal(f.block().stdout, '');
  assert.match(f.block('credentials.json').stdout, /"permissionDecision":"deny"/);
}));

test('parallel Codex privacy blocks preserve both markers and cannot be approved by y', () => shortPrivacyFixture(async f => {
  const results = await Promise.all([asyncPrivacyBlock(f, '.env'), asyncPrivacyBlock(f, 'credentials.json')]);
  assert.notEqual(f.id(results[0]), f.id(results[1]));
  assert.equal(f.files('short-').length, 2);
  assert.equal(f.submit('y').status, 0);
  assert.equal(f.files('token-').length, 0);
  assert.equal(f.files('short-').length, 0);
  assert.match(f.block().stdout, /"permissionDecision":"deny"/);
  assert.match(f.block('credentials.json').stdout, /"permissionDecision":"deny"/);
}));

test('repeated Codex blocks for the same path set reuse the request and short marker', () => shortPrivacyFixture(f => {
  const first = f.id(f.block('.env credentials.json'));
  assert.equal(f.id(f.block('credentials.json .env')), first);
  assert.equal(f.files('pending-').length, 1);
  assert.equal(f.files('short-').length, 1);
  assert.match(f.submit('y').stdout, /User approved/);
  assert.equal(f.block('.env credentials.json').stdout, '');
  assert.match(f.block().stdout, /"permissionDecision":"deny"/);
}));

test('a later Codex block restores the short marker for the same pending request', () => shortPrivacyFixture(f => {
  const requestId = f.id(f.block());
  assert.equal(f.submit('ok làm đi').status, 0);
  assert.equal(f.files('short-').length, 0);
  assert.equal(f.id(f.block()), requestId);
  assert.equal(f.files('pending-').length, 1);
  assert.equal(f.files('short-').length, 1);
  assert.match(f.submit('y').stdout, /User approved/);
  assert.equal(f.block().stdout, '');
  assert.match(f.block('credentials.json').stdout, /"permissionDecision":"deny"/);
}));

test('an immediate repeated Codex block keeps one short marker without an exclusive-write error', () => shortPrivacyFixture(f => {
  const requestId = f.id(f.block());
  assert.equal(f.id(f.block()), requestId);
  assert.equal(f.files('pending-').length, 1);
  assert.equal(f.files('short-').length, 1);
  assert.match(f.submit('y').stdout, /User approved/);
  assert.equal(f.block().stdout, '');
}));

test('a Codex prompt error after claiming markers cancels the short approval', () => shortPrivacyFixture(f => {
  f.id(f.block());
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-privacy-fault-'));
  try {
    const preload = path.join(outside, 'fault.cjs');
    fs.writeFileSync(preload, `const fs = require('fs'); const original = fs.readdirSync; let calls = 0;\nfs.readdirSync = function(dir, ...args) { if (String(dir) === ${JSON.stringify(fs.realpathSync(f.dir))} && ++calls === 2) throw new Error('injected state read error'); return original.call(this, dir, ...args); };\n`);
    const failed = f.submit('ok làm đi', f.session, { ...process.env, NODE_OPTIONS: `--require=${preload}` });
    assert.equal(failed.status, 0, failed.stderr);
    assert.match(failed.stdout, /failed safely/);
    assert.equal(f.files('short-').length, 0);
    assert.equal(f.files('token-').length, 0);
    assert.doesNotMatch(f.submit('y').stdout, /User approved/);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
}));

test('a Codex post-claim error cancels a marker created during prompt processing', () => shortPrivacyFixture(f => {
  f.id(f.block());
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-privacy-post-claim-fault-'));
  try {
    const preload = path.join(outside, 'fault.cjs');
    fs.writeFileSync(preload, `const assert = require('node:assert/strict');
const state = require(${JSON.stringify(path.join(f.hooks, 'lib/privacy-state.cjs'))});
const claim = state.claimShortMarkers;
let claimed = false;
state.claimShortMarkers = (...args) => {
  const result = claim(...args);
  if (!claimed) { assert.equal(result.ok, true); assert.equal(result.requestIds.length, 1); claimed = true; }
  return result;
};
state.cleanup = () => {
  assert.equal(claimed, true);
  state.createPending(${JSON.stringify({ projectRoot: f.root, sessionCwd: f.root, sessionId: f.session, filePath: 'credentials.json' })});
  throw new Error('injected processing error after marker claim');
};\n`);
    const failed = f.submit('ok làm đi', f.session, { ...process.env, NODE_OPTIONS: `--require=${preload}` });
    assert.equal(failed.status, 0, failed.stderr);
    assert.match(failed.stdout, /failed safely/);
    assert.equal(f.files('pending-').length, 2);
    assert.equal(f.files('short-').length, 0);
    assert.doesNotMatch(f.submit('y').stdout, /User approved/);
    assert.equal(f.files('token-').length, 0);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
}));

test('a corrupt Codex short marker cannot grant permission even with valid pending state', () => shortPrivacyFixture(f => {
  f.id(f.block());
  const markers = f.files('short-');
  assert.equal(markers.length, 1);
  fs.writeFileSync(path.join(f.dir, markers[0]), '{');
  const result = f.submit('y');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /User approved/);
  assert.equal(f.files('token-').length, 0);
  assert.equal(f.files('short-').length, 0);
  assert.doesNotMatch(f.submit('y').stdout, /User approved/);
}));

for (const unlinkFailure of [false, true]) {
test(`an unclaimable Codex short marker is cancelled after ${unlinkFailure ? 'rename and unlink errors' : 'a rename error'}`, () => shortPrivacyFixture(f => {
  f.id(f.block());
  assert.equal(f.files('short-').length, 1);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-privacy-rename-fault-'));
  try {
    const preload = path.join(outside, 'fault.cjs');
    const prefix = JSON.stringify(path.join(fs.realpathSync(f.dir), 'short-'));
    fs.writeFileSync(preload, `const fs = require('fs'); const original = fs.renameSync;\nfs.renameSync = function(from, to) { if (String(from).startsWith(${prefix})) throw new Error('injected rename failure'); return original.call(this, from, to); };\n`
      + (unlinkFailure ? `const unlink = fs.unlinkSync; fs.unlinkSync = function(file) { if (String(file).startsWith(${prefix})) throw new Error('injected unlink failure'); return unlink.call(this, file); };\n` : ''));
    const result = f.submit('ok làm đi', f.session, { ...process.env, NODE_OPTIONS: `--require=${preload}` });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /User approved/);
    assert.equal(f.files('token-').length, 0);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
  assert.doesNotMatch(f.submit('y').stdout, /User approved/);
  assert.equal(f.files('token-').length, 0);
  assert.equal(f.files('short-').length, 0);
}));
}

test('Codex compact clears pending requests and short markers only for its session', () => shortPrivacyFixture(f => {
  f.id(f.block());
  f.id(f.block('credentials.json', 'other-session'));
  const result = runHook(path.join(f.hooks, 'session.cjs'), f.root,
    { source: 'compact', session_id: f.session, cwd: f.root, hook_event_name: 'SessionStart' });
  assert.equal(result.status, 0, result.stderr);
  const prefix = `short-${crypto.createHash('sha256').update(f.session).digest('hex')}-`;
  assert.equal(f.files(prefix).length, 0);
  assert.equal(f.files('short-').length, 1);
  assert.doesNotMatch(f.submit('y').stdout, /User approved/);
  assert.equal(f.files('token-').length, 0);
  assert.match(f.submit('y', 'other-session').stdout, /User approved/);
}));

test('Codex short approval cannot grant an expired pending request', () => shortPrivacyFixture(f => {
  const id = f.id(f.block());
  const file = path.join(f.dir, `pending-${id}.json`);
  const pending = JSON.parse(fs.readFileSync(file, 'utf8'));
  pending.expiresAt = Date.now() - 1;
  fs.writeFileSync(file, JSON.stringify(pending));
  assert.equal(f.submit('y').status, 0);
  assert.equal(f.files('token-').length, 0);
  assert.equal(f.files('short-').length, 0);
}));

test('Codex cleanup removes expired short markers', () => shortPrivacyFixture(f => {
  f.id(f.block());
  const markers = f.files('short-');
  assert.equal(markers.length, 1);
  const file = path.join(f.dir, markers[0]);
  const marker = JSON.parse(fs.readFileSync(file, 'utf8'));
  marker.expiresAt = Date.now() - 1;
  fs.writeFileSync(file, JSON.stringify(marker));
  require(path.join(f.hooks, 'lib/privacy-state.cjs')).cleanup(f.root);
  assert.equal(f.files('short-').length, 0);
}));

test('Codex long privacy approval still works after an intervening prompt and reports paths', () => shortPrivacyFixture(f => {
  const id = f.id(f.block());
  assert.equal(f.submit('ok làm đi').status, 0);
  assert.equal(f.files('short-').length, 0);
  const result = f.submit(`APPROVE CAFEKIT PRIVACY ${id}`);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /User approved/);
  assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /Tell the user.*\.env.*before reading/i);
  assert.equal(f.block().stdout, '');
}));

test('Codex privacy approval is exact, session-bound, and reusable within its window', () => {
  inHookFixture((root, hooks) => {
    const nested = path.join(root, 'packages', 'app');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, '.env'), 'SECRET=value\n');
    const block = path.join(hooks, 'privacy-block.cjs');
    const approve = path.join(hooks, 'privacy-approval.cjs');
    const harmlessPatch = runHook(block, nested, {
      cwd: nested,
      session_id: 'session-a',
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_input: {
        command: '*** Begin Patch\n*** Update File: README.md\n+Document `.env` setup.\n*** End Patch\n'
      }
    });
    assert.equal(harmlessPatch.stdout, '');

    const request = {
      cwd: nested,
      session_id: 'session-a',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'cat .env' }
    };

    const denied = runHook(block, nested, request);
    assert.equal(denied.status, 0);
    const decision = JSON.parse(denied.stdout);
    assert.equal(decision.hookSpecificOutput.permissionDecision, 'deny');
    const prompt = decision.hookSpecificOutput.permissionDecisionReason.match(
      /APPROVE CAFEKIT PRIVACY [a-f0-9]{24}/
    )?.[0];
    assert.ok(prompt);
    assert.equal(fs.existsSync(path.join(nested, '.codex')), false);
    assert.equal(fs.existsSync(path.join(hooks, '.privacy')), true);

    const wrongSession = runHook(approve, nested, {
      cwd: nested,
      session_id: 'session-b',
      hook_event_name: 'UserPromptSubmit',
      prompt
    });
    assert.match(wrongSession.stdout, /rejected/);

    // A pasted prompt carries the terminal's surrounding whitespace. The
    // exactness that matters is the request id, not the padding.
    const padded = runHook(approve, nested, {
      cwd: nested,
      session_id: 'session-a',
      hook_event_name: 'UserPromptSubmit',
      prompt: ` ${prompt}\n`
    });
    assert.match(padded.stdout, /User approved/, 'whitespace padding must not void the approval');

    // The grant now covers repeated access to the same paths, and is not bound
    // to the tool that first tripped the gate.
    const allowedOnce = runHook(block, nested, request);
    assert.equal(allowedOnce.stdout, '');

    const allowedAgain = runHook(block, nested, request);
    assert.equal(allowedAgain.stdout, '', 'one approval covers a re-read');

    const allowedOtherTool = runHook(block, nested, {
      ...request,
      tool_name: 'exec_command'
    });
    assert.equal(allowedOtherTool.stdout, '', 'grant is not bound to a tool name');

    // A fresh session, so the single-path grant above cannot mask the exact-set
    // matching under test.
    fs.writeFileSync(path.join(nested, 'credentials.json'), '{"token":"test"}\n');
    const multiRequest = {
      ...request,
      session_id: 'session-c',
      tool_input: { command: 'cat .env credentials.json' }
    };
    const multiDenied = runHook(block, nested, multiRequest);
    const multiDecision = JSON.parse(multiDenied.stdout);
    assert.match(multiDecision.hookSpecificOutput.permissionDecisionReason, /\.env, credentials\.json/);
    const multiPrompt = multiDecision.hookSpecificOutput.permissionDecisionReason.match(
      /APPROVE CAFEKIT PRIVACY [a-f0-9]{24}/
    )?.[0];
    assert.ok(multiPrompt);

    const multiApproved = runHook(approve, nested, {
      cwd: nested,
      session_id: 'session-c',
      hook_event_name: 'UserPromptSubmit',
      prompt: multiPrompt
    });
    assert.match(multiApproved.stdout, /User approved/);

    // A grant for two paths authorizes exactly that set: neither a subset nor a
    // superset, in either order.
    const subsetDenied = runHook(block, nested, { ...request, session_id: 'session-c' });
    assert.equal(JSON.parse(subsetDenied.stdout).hookSpecificOutput.permissionDecision, 'deny');
    fs.writeFileSync(path.join(nested, 'tokens.json'), '{"token":"test"}\n');
    const supersetDenied = runHook(block, nested, {
      ...request,
      session_id: 'session-c',
      tool_input: { command: 'cat .env credentials.json tokens.json' }
    });
    assert.equal(JSON.parse(supersetDenied.stdout).hookSpecificOutput.permissionDecision, 'deny');
    const reordered = {
      ...request,
      session_id: 'session-c',
      tool_input: { command: 'cat credentials.json .env' }
    };
    assert.equal(runHook(block, nested, reordered).stdout, '');
    assert.equal(runHook(block, nested, multiRequest).stdout, '', 'the set stays granted');

    // Session binding survives the change: another session sees no grant.
    const otherSession = runHook(block, nested, { ...request, session_id: 'session-d' });
    assert.equal(JSON.parse(otherSession.stdout).hookSpecificOutput.permissionDecision, 'deny');
  });
});

test('Codex privacy grant window is one hour and restarts at approval', () => {
  inHookFixture((root, hooks) => {
    const state = require(path.join(hooks, 'lib', 'privacy-state.cjs'));
    const HOUR = 60 * 60 * 1000;
    assert.equal(state.TTL_MS, HOUR, 'a five-minute window expired mid-conversation');

    fs.writeFileSync(path.join(root, '.env'), 'SECRET=1\n');
    const pending = state.createPending({
      projectRoot: root,
      sessionCwd: root,
      sessionId: 'session-ttl',
      filePaths: ['.env'],
    });
    assert.ok(pending.expiresAt - Date.now() > HOUR - 5000, 'pending must live an hour');

    const approved = state.approvePending({
      projectRoot: root,
      sessionId: 'session-ttl',
      requestId: pending.requestId,
    });
    assert.equal(approved.ok, true);

    const stateDir = path.join(root, '.codex', 'hooks', '.privacy');
    const tokenFile = fs.readdirSync(stateDir).find((name) => name.startsWith('token-'));
    assert.ok(tokenFile, 'approval must write a grant');
    const grant = JSON.parse(fs.readFileSync(path.join(stateDir, tokenFile), 'utf8'));
    assert.ok(grant.expiresAt - Date.now() > HOUR - 5000, 'the grant window starts at approval');
    assert.equal(grant.toolName, undefined, 'a grant is not bound to a tool name');
  });
});

test('Codex privacy hook parses native patch fields and move destinations', () => {
  inHookFixture((root, hooks) => {
    const block = path.join(hooks, 'privacy-block.cjs');
    const payload = (patch) => ({
      cwd: root,
      session_id: 'session-a',
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_input: { patch }
    });

    const harmless = runHook(
      block,
      root,
      payload('*** Begin Patch\n*** Update File: README.md\n+Document `.env` setup.\n*** End Patch\n')
    );
    assert.equal(harmless.stdout, '');

    for (const patch of [
      '*** Begin Patch\n*** Update File: .env\n+SECRET=x\n*** End Patch\n',
      '*** Begin Patch\n*** Update File: README.md\n*** Move to: credentials.json\n*** End Patch\n'
    ]) {
      const denied = runHook(block, root, payload(patch));
      assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny');
    }
  });
});

test('Codex inspect hook scans native shell commands and structured paths', () => {
  inHookFixture((root, hooks) => {
    const inspect = path.join(hooks, 'inspect-block.cjs');
    const payload = (command) => ({
      cwd: root,
      session_id: 'session-a',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command }
    });

    for (const command of [
      'rg secret node_modules',
      "sed -n '1,20p' dist/bundle.js",
      "rg --glob '**/*' symbol ."
    ]) {
      const result = runHook(inspect, root, payload(command));
      assert.equal(result.status, 2, command);
      assert.match(result.stderr, /SCOPE LIMIT EXCEEDED/);
    }

    for (const command of ['rg symbol src packages', "rg --glob '**/*' symbol src"]) {
      const normal = runHook(inspect, root, payload(command));
      assert.equal(normal.status, 0);
    }

    const structured = runHook(inspect, root, {
      ...payload(''),
      tool_name: 'mcp__filesystem__read_file',
      tool_input: { path: 'coverage/index.html' }
    });
    assert.equal(structured.status, 2);
  });
});

test('Codex completion gate cannot be bypassed from a nested cwd', () => {
  inHookFixture((root, hooks) => {
    const nested = path.join(root, 'packages', 'app');
    const feature = path.join(root, 'specs', 'auth');
    fs.mkdirSync(nested, { recursive: true });
    writeProcessTask(feature, 'pending', null, 'node --test');
    const gate = path.join(hooks, 'spec-gate.cjs');
    const payload = {
      cwd: nested,
      session_id: 'session-a',
      hook_event_name: 'Stop',
      stop_hook_active: false,
      last_assistant_message: 'done'
    };

    const seeded = runHook(gate, nested, payload);
    assert.equal(seeded.status, 0);
    assert.equal(seeded.stdout, '');

    writeProcessTask(feature, 'done', null, 'node --test');
    const blocked = runHook(gate, nested, payload);
    assert.equal(blocked.status, 0);
    assert.equal(JSON.parse(blocked.stdout).decision, 'block');
    assert.match(JSON.parse(blocked.stdout).reason, /verification receipt/);

    writeProcessTask(feature, 'done', bindReceipt(root, [
      'Verification: PASS', 'Command: node --test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
      '```', 'node --test', 'ok 1', '```',
    ].join('\n')).split('\n'), 'node --test');
    const valid = runHook(gate, nested, payload);
    assert.equal(valid.status, 0);
    assert.equal(valid.stdout, '');
  });
});

test('Codex completion gate validates explicit process-v3 inline Receipt', () => {
  inHookFixture((root, hooks) => {
    const nested = path.join(root, 'packages', 'app');
    const feature = path.join(root, 'specs', 'auth');
    const taskFile = path.join(feature, 'task-01-auth.md');
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(feature, { recursive: true });
    fs.writeFileSync(path.join(feature, 'plan.md'), '# Auth plan\n');
    fs.writeFileSync(taskFile, [
      '# Task 01: auth', '', 'Status: done', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
    ].join('\n'));

    const gate = path.join(hooks, 'spec-gate.cjs');
    const payload = {
      cwd: nested,
      featureName: 'auth',
      session_id: 'session-a',
      hook_event_name: 'Stop',
      stop_hook_active: false,
    };
    const blocked = runHook(gate, nested, payload);
    assert.equal(blocked.status, 0, blocked.stderr);
    assert.match(JSON.parse(blocked.stdout).reason, /missing_receipt/);

    const context = workflowRuntimeContext(root);
    fs.writeFileSync(taskFile, [
      '# Task 01: auth', '', 'Status: done', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
      '## Receipt', '', '```text', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
      `Base: ${context.base}`, `Head: ${context.head}`, 'pass: 1', '```', '',
    ].join('\n'));
    const fencedFields = runHook(gate, nested, payload);
    assert.equal(fencedFields.status, 0, fencedFields.stderr);
    assert.match(JSON.parse(fencedFields.stdout).reason, /verification_state/);
    assert.match(JSON.parse(fencedFields.stdout).reason, /command/);
    assert.match(JSON.parse(fencedFields.stdout).reason, /provenance/);

    fs.writeFileSync(taskFile, [
      '# Task 01: auth', '', 'Status: done', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
      '## Receipt', '',
      'Verification: PASS', 'Command: node --test', 'Exit: 0',
      `Base: ${context.base}`, `Head: ${context.head}`,
      '````text', '$ node --test', 'pass: 1', '```', '',
    ].join('\n'));
    const malformedOutputFence = runHook(gate, nested, payload);
    assert.equal(malformedOutputFence.status, 0, malformedOutputFence.stderr);
    assert.match(JSON.parse(malformedOutputFence.stdout).reason, /command_output/);

    fs.writeFileSync(taskFile, [
      '# Task 01: auth', '', 'Status: done', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
      '## Receipt', '',
      'Verification: PASS', 'Command: node --test', 'Exit: 0',
      `Base: ${context.base}`, `Head: ${context.head}`,
      '```text', '$ node --test', 'pass: 1', '```', '',
    ].join('\n'));
    const passed = runHook(gate, nested, payload);
    assert.equal(passed.status, 0, passed.stderr);
    assert.equal(passed.stdout, '');
  });
});

test('Codex process-v3 Receipt command must match the exact Verification Plan command', () => {
  inHookFixture((root, hooks) => {
    const feature = path.join(root, 'specs', 'auth');
    fs.mkdirSync(feature, { recursive: true });
    fs.writeFileSync(path.join(feature, 'plan.md'), '# Auth plan\n');
    const context = workflowRuntimeContext(root);
    fs.writeFileSync(path.join(feature, 'task-01-auth.md'), [
      '# Task 01: auth', '', 'Status: done', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: pnpm test', '',
      '## Receipt', '', 'Verification: PASS', 'Command: true', 'Exit: 0',
      `Base: ${context.base}`, `Head: ${context.head}`,
      '```text', '$ true', 'pass: 1', '```', '',
    ].join('\n'));

    const result = runHook(path.join(hooks, 'spec-gate.cjs'), root, {
      cwd: root,
      session_id: 'session-a',
      hook_event_name: 'Stop',
      stop_hook_active: false,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.notEqual(result.stdout, '', 'a substituted receipt command must block');
    assert.match(JSON.parse(result.stdout).reason, /command_identity/);
  });
});

test('Codex recorded active feature turns the identity block into receipt validation', () => {
  // Issue #79 end to end on this runtime. Two unfinished packets make the gate answer a
  // missing-receipt violation with an identity complaint; naming the feature resolves it
  // and the violation surfaces.
  inHookFixture((root, hooks) => {
    for (const name of ['alpha', 'beta']) {
      const feature = path.join(root, 'specs', name);
      writeProcessTask(feature, 'done', null, 'node --test', 'task-01-x.md');
      fs.writeFileSync(path.join(feature, 'task-02-y.md'),
        '# Task 02\n\nStatus: pending\n\n## Dependencies\n\n- none\n\n## Verification Plan\n\n- Command: node --test\n');
    }
    const payload = { cwd: root, session_id: 'session-a', hook_event_name: 'Stop', stop_hook_active: false };

    const blocked = runHook(path.join(hooks, 'spec-gate.cjs'), root, payload);
    assert.equal(blocked.status, 0, blocked.stderr);
    assert.match(JSON.parse(blocked.stdout).reason, /multiple active specs detected/);

    const shared = path.join(root, 'specs', '_shared');
    fs.mkdirSync(shared, { recursive: true });
    fs.writeFileSync(path.join(shared, 'active-feature.json'), '{"featureName": "beta"}\n');

    const resolved = runHook(path.join(hooks, 'spec-gate.cjs'), root, payload);
    assert.equal(resolved.status, 0, resolved.stderr);
    const reason = JSON.parse(resolved.stdout).reason;
    assert.doesNotMatch(reason, /multiple active specs/, 'the recorded feature must resolve it');
    assert.match(reason, /lack a verification receipt/, 'the gate must now reach receipt validation');
    assert.match(reason, /specs\/beta\//, 'and validate the named feature, not a sibling');
  });
});

test('Codex process-v3 Stop ignores a completed packet when one packet remains active', () => {
  inHookFixture((root, hooks) => {
    const completed = path.join(root, 'specs', 'auth');
    const active = path.join(root, 'specs', 'active');
    fs.mkdirSync(completed, { recursive: true });
    fs.mkdirSync(active, { recursive: true });
    fs.writeFileSync(path.join(completed, 'plan.md'), '# Auth plan\n');
    fs.writeFileSync(path.join(active, 'plan.md'), '# Active plan\n');
    const context = workflowRuntimeContext(root);
    fs.writeFileSync(path.join(completed, 'task-01-auth.md'), [
      '# Task 01: auth', '', 'Status: done', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
      '## Receipt', '',
      'Verification: PASS', 'Command: node --test', 'Exit: 0',
      `Base: ${context.base}`, `Head: ${context.head}`,
      '```text', '$ node --test', 'pass: 1', '```', '',
    ].join('\n'));
    fs.writeFileSync(path.join(active, 'task-01-active.md'), [
      '# Task 01: active', '', 'Status: pending', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
    ].join('\n'));

    const result = runHook(path.join(hooks, 'spec-gate.cjs'), root, {
      cwd: root,
      session_id: 'session-a',
      hook_event_name: 'Stop',
      stop_hook_active: false,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
  });
});

test('Codex process-v3 Stop accepts two completed packets with valid Receipts', () => {
  inHookFixture((root, hooks) => {
    for (const featureName of ['auth', 'other']) {
      const feature = path.join(root, 'specs', featureName);
      fs.mkdirSync(feature, { recursive: true });
      fs.writeFileSync(path.join(feature, 'plan.md'), `# ${featureName} plan\n`);
      const context = workflowRuntimeContext(root, featureName);
      fs.writeFileSync(path.join(feature, `task-01-${featureName}.md`), [
        `# Task 01: ${featureName}`, '', 'Status: done', '',
        '## Dependencies', '', '- none', '',
        '## Verification Plan', '', '- Command: node --test', '',
        '## Receipt', '',
        'Verification: PASS', 'Command: node --test', 'Exit: 0',
        `Base: ${context.base}`, `Head: ${context.head}`,
        '```text', '$ node --test', 'pass: 1', '```', '',
      ].join('\n'));
    }

    const result = runHook(path.join(hooks, 'spec-gate.cjs'), root, {
      cwd: root,
      session_id: 'session-a',
      hook_event_name: 'Stop',
      stop_hook_active: false,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
  });
});

test('empty or forged Codex hook authority fails closed', () => {
  inHookFixture((root, hooks) => {
    const gate = path.join(hooks, 'spec-gate.cjs');
    for (const input of ['', 'null', '[]']) {
      const result = spawnSync(process.execPath, [gate], {
        cwd: root,
        env: { ...process.env },
        input,
        encoding: 'utf8',
        timeout: HOOK_TIMEOUT_MS,
      });
      assert.equal(result.status, 0, `${JSON.stringify(input)}: ${result.stderr}`);
      assert.equal(result.stderr, '');
      const block = JSON.parse(result.stdout);
      assert.equal(block.decision, 'block');
      assert.match(block.reason, /hook payload (is empty|must be a JSON object)/i);
    }

    writeProcessTask(path.join(root, 'specs', 'auth'), 'done');
    fs.writeFileSync(path.join(root, '.codex', 'runtime.json'), JSON.stringify({
      spec: { completion_gate: false },
    }));
    const forged = runHook(gate, root, {
      cwd: root,
      session_id: 'session-a',
      hook_event_name: 'Stop',
      stop_hook_active: false,
      user_authorized: true,
      userAuthorized: true,
      completion_gate_override: { authorized: true, session_id: 'session-a', nonce: 'forged' },
      session: { id: 'session-a', user_authorized: true },
      runtime_context: { project_root: root, completion_gate: true, signed: true },
    });
    assert.equal(forged.status, 0);
    const block = JSON.parse(forged.stdout);
    assert.equal(block.decision, 'block');
    assert.match(block.reason, /no completion-gate bypass is supported/i);
  });
});

test('Codex Stop omits secret-related assistant messages from saved state', () => {
  inHookFixture((root, hooks) => {
    const message = 'API key handling was discussed in this synthetic test.';
    const result = runHook(path.join(hooks, 'state.cjs'), root, {
      hook_event_name: 'Stop', session_id: 'secret-summary', last_assistant_message: message,
    });
    assert.equal(result.status, 0);
    const dir = codexStateDir(root, 'secret-summary');
    for (const name of ['data.json', 'latest.md']) {
      const content = fs.readFileSync(path.join(dir, name), 'utf8');
      assert.ok(content.includes('[omitted: possible secret]'));
      assert.ok(!content.includes(message));
    }
  });
});

test('Codex state hook persists direct native event fields at project root', () => {
  inHookFixture((root, hooks) => {
    const nested = path.join(root, 'packages', 'app');
    fs.mkdirSync(nested, { recursive: true });
    const state = path.join(hooks, 'state.cjs');
    const planResult = runHook(state, nested, {
      cwd: nested,
      session_id: 'session-a',
      hook_event_name: 'PostToolUse',
      tool_name: 'update_plan',
      tool_input: {
        plan: [
          { step: 'Implement native hooks', status: 'completed' },
          { step: 'Run sandbox smoke', status: 'in_progress' }
        ]
      },
      tool_response: { ok: true }
    });
    assert.equal(planResult.status, 0);

    const agentResult = runHook(state, nested, {
      cwd: nested,
      session_id: 'session-a',
      hook_event_name: 'SubagentStop',
      agent_id: 'agent-1',
      agent_type: 'test_runner',
      last_assistant_message: 'Native hook tests passed.'
    });
    assert.equal(agentResult.status, 0);

    const sessionAState = codexStateDir(root, 'session-a');
    const data = JSON.parse(fs.readFileSync(path.join(sessionAState, 'data.json'), 'utf8'));
    assert.deepEqual(data.todos.map(({ content, status }) => ({ content, status })), [
      { content: 'Implement native hooks', status: 'completed' },
      { content: 'Run sandbox smoke', status: 'in_progress' }
    ]);
    assert.equal(data.agentResults[0].message, 'Native hook tests passed.');
    assert.equal(fs.existsSync(path.join(nested, '.codex')), false);

    const sessionB = runHook(state, nested, {
      cwd: nested,
      session_id: 'session-b',
      hook_event_name: 'PostToolUse',
      tool_name: 'update_plan',
      tool_input: { plan: [{ step: 'Independent task', status: 'in_progress' }] },
      tool_response: { ok: true }
    });
    assert.equal(sessionB.status, 0);
    const sessionBState = codexStateDir(root, 'session-b');
    const dataB = JSON.parse(fs.readFileSync(path.join(sessionBState, 'data.json'), 'utf8'));
    assert.deepEqual(dataB.todos.map(({ content }) => content), ['Independent task']);
    assert.notEqual(sessionAState, sessionBState);

    const resumeA = runHook(state, nested, {
      cwd: nested,
      session_id: 'session-a',
      hook_event_name: 'SessionStart',
      source: 'resume'
    });
    assert.match(resumeA.stdout, /Implement native hooks/);
    assert.doesNotMatch(resumeA.stdout, /Independent task/);

    const missingSession = runHook(state, nested, {
      cwd: nested,
      hook_event_name: 'PostToolUse',
      tool_name: 'update_plan',
      tool_input: { plan: [{ step: 'Must not persist', status: 'in_progress' }] }
    });
    assert.equal(missingSession.status, 0);
    assert.equal(codexStateDir(root, ''), null);
  });
});

test('Codex canonical receipt provenance requires both Base and Head', () => {
  const receipt = require(path.join(CODEX_HOOKS, 'lib', 'spec-receipt.cjs'));
  const onlyBase = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: abc\n');
  assert.ok(onlyBase.includes('provenance'), 'only Base should fail');
  const onlyHead = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nHead: def\n');
  assert.ok(onlyHead.includes('provenance'), 'only Head should fail');
  const both = receipt.validateCanonicalReceipt(`Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: ${VALID_BASE}\nHead: ${VALID_HEAD}\n`);
  assert.deepEqual(both, [], 'both Base and Head should pass');
  const onlyBaseSha = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: abc\n');
  assert.ok(onlyBaseSha.includes('provenance'));
  const bothSha = receipt.validateCanonicalReceipt(`Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: ${VALID_BASE}\nhead_sha: ${VALID_HEAD}\n`);
  assert.deepEqual(bothSha, [], 'both base_sha and head_sha should pass');
  // Empty / bare provenance must fail — non-empty same-line value required
  const emptyBase = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase:\nHead: def\n');
  assert.ok(emptyBase.includes('provenance'), 'empty Base: should fail');
  const spacesBase = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase:   \nHead: def\n');
  assert.ok(spacesBase.includes('provenance'), 'Base: spaces only should fail');
  const emptyHead = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: abc\nHead:\n');
  assert.ok(emptyHead.includes('provenance'), 'empty Head: should fail');
  const bareBaseSha = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha\nhead_sha: def\n');
  assert.ok(bareBaseSha.includes('provenance'), 'bare base_sha without colon/value should fail');
  const emptyBaseSha = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha:\nhead_sha: def\n');
  assert.ok(emptyBaseSha.includes('provenance'), 'empty base_sha: should fail');
  const spacesBaseSha = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha:   \nhead_sha: def\n');
  assert.ok(spacesBaseSha.includes('provenance'), 'base_sha spaces only should fail');
  const bareBoth = receipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha head_sha\n');
  assert.ok(bareBoth.includes('provenance'), 'bare base_sha head_sha without colon should fail');
  const validBaseHead = receipt.validateCanonicalReceipt(`Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: ${VALID_BASE}\nHead: ${VALID_HEAD}\n`);
  assert.deepEqual(validBaseHead, [], 'valid Base+Head with values should pass');
  const validSha = receipt.validateCanonicalReceipt(`Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: ${VALID_BASE}\nhead_sha: ${VALID_HEAD}\n`);
  assert.deepEqual(validSha, [], 'valid base_sha+head_sha with values should pass');

  // Integration via spec-gate hook: only Base blocks, both passes
  inHookFixture((root, hooks) => {
    const feature = path.join(root, 'specs', 'auth');
    const gate = path.join(hooks, 'spec-gate.cjs');
    const payload = { cwd: path.join(root, 'packages', 'app'), session_id: 'session-a', hook_event_name: 'Stop', stop_hook_active: false };
    const output = ['```', 'pnpm test', 'ok 1', '```'];
    fs.mkdirSync(payload.cwd, { recursive: true });

    // only Base -> block
    writeProcessTask(feature, 'done', ['Verification: PASS', 'Command: pnpm test', 'Exit: 0', 'Base: abc', ...output]);
    const blocked = runHook(gate, payload.cwd, payload);
    assert.equal(JSON.parse(blocked.stdout).decision, 'block');
    assert.match(JSON.parse(blocked.stdout).reason, /\bprovenance\b/);

    // both -> no block
    writeProcessTask(feature, 'done', bindReceipt(root, ['Verification: PASS', 'Command: pnpm test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, ...output].join('\n')).split('\n'));
    const passed = runHook(gate, payload.cwd, payload);
    assert.equal(passed.stdout, '');

    // empty Base: should block provenance — reset gate cache so re-checked as newly-done
    try { fs.rmSync(path.join(root, '.codex', 'hooks', '.logs', 'spec-gate-last.json'), { force: true }); } catch {}
    writeProcessTask(feature, 'done', ['Verification: PASS', 'Command: pnpm test', 'Exit: 0', 'Base:', 'Head: def', ...output]);
    const blockedEmpty = runHook(gate, payload.cwd, payload);
    assert.equal(JSON.parse(blockedEmpty.stdout).decision, 'block');
    assert.match(JSON.parse(blockedEmpty.stdout).reason, /\bprovenance\b/);

    // bare base_sha without colon should block — reset cache again
    try { fs.rmSync(path.join(root, '.codex', 'hooks', '.logs', 'spec-gate-last.json'), { force: true }); } catch {}
    writeProcessTask(feature, 'done', ['Verification: PASS', 'Command: pnpm test', 'Exit: 0', 'base_sha head_sha', ...output]);
    const blockedBare = runHook(gate, payload.cwd, payload);
    assert.equal(JSON.parse(blockedBare.stdout).decision, 'block');
    assert.match(JSON.parse(blockedBare.stdout).reason, /\bprovenance\b/);
  });
});

test('Codex cache hardening: every done re-validated — mutation, malformed cache, unchanged valid', () => {
  inHookFixture((root, hooks) => {
    const feature = path.join(root, 'specs', 'auth');
    const taskPath = 'task-01-auth.md';
    const gate = path.join(hooks, 'spec-gate.cjs');
    const appCwd = path.join(root, 'packages', 'app');
    fs.mkdirSync(appCwd, { recursive: true });
    const payload = { cwd: appCwd, session_id: 'session-a', hook_event_name: 'Stop', stop_hook_active: false };
    const cacheFile = path.join(root, '.codex', 'hooks', '.logs', 'spec-gate-last.json');
    const output = ['```', 'pass', '```'];
    const writeValid = () => writeProcessTask(feature, 'done', (writeProcessTask(feature, 'done'), bindReceipt(root, [
      'Verification: PASS', 'Command: pnpm test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, ...output,
    ].join('\n'))).split('\n'));

    // first-run (no cache) with valid receipt → no block, cache seeded
    try { fs.rmSync(cacheFile, { force: true }); } catch {}
    writeValid();
    let res = runHook(gate, appCwd, payload);
    assert.equal(res.stdout, '', 'first-run valid should not block');
    assert.ok(fs.existsSync(cacheFile), 'cache file must be created on first valid run');
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    assert.equal(cache.entries[runtimeContext(root).context_id].tasks[taskPath], 'done');

    // cache-hit unchanged valid → still no block (revalidation passes)
    res = runHook(gate, appCwd, payload);
    assert.equal(res.stdout, '', 'cache-hit unchanged valid must not block');

    // mutation: remove Command/Verification → must block even though cache says done
    writeProcessTask(feature, 'done', ['Exit: 0', 'Base: abc123', 'Head: def456', ...output]);
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block', 'mutated receipt missing Verification/Command should block on cache-hit');
    assert.match(JSON.parse(res.stdout).reason, /\bverification_state\b|\bcommand\b/);
    // second hit still blocks
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block', 'second hit after mutation still blocks');

    // restore valid, then mutate provenance (remove Head) → block
    writeValid();
    assert.equal(runHook(gate, appCwd, payload).stdout, '', 'restored valid should pass again');
    writeProcessTask(feature, 'done', ['Verification: PASS', 'Command: pnpm test', 'Exit: 0', 'Base: abc123', ...output]);
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block');
    assert.match(JSON.parse(res.stdout).reason, /\bprovenance\b/);

    // malformed cache with valid receipt → must still pass (cache parse fail-open)
    writeValid();
    fs.writeFileSync(cacheFile, '{ malformed');
    res = runHook(gate, appCwd, payload);
    assert.equal(res.stdout, '', 'malformed cache with valid receipt must not block');
    // malformed cache with invalid receipt → must still block
    fs.writeFileSync(cacheFile, '{ malformed again');
    writeProcessTask(feature, 'done');
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block', 'malformed cache with invalid receipt must block');
  });
});

test('Codex cache identity separates same-feature receipts from different roots', () => {
  const contexts = [];
  for (let index = 0; index < 2; index += 1) {
    const context = inHookFixture((root, hooks) => {
      writeProcessTask(path.join(root, 'specs', 'auth'), 'done', null, 'node --test');
      writeProcessTask(path.join(root, 'specs', 'auth'), 'done', bindReceipt(root, [
        'Verification: PASS', 'Command: node --test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
        '```', 'node --test', 'ok 1', '```',
      ].join('\n')).split('\n'), 'node --test');
      const result = runHook(path.join(hooks, 'spec-gate.cjs'), root, {
        cwd: root,
        session_id: 'session-a',
        hook_event_name: 'Stop',
        stop_hook_active: false,
      });
      assert.equal(result.stdout, '');
      const cache = JSON.parse(fs.readFileSync(path.join(root, '.codex', 'hooks', '.logs', 'spec-gate-last.json'), 'utf8'));
      const ids = Object.keys(cache.entries);
      assert.equal(ids.length, 1);
      assert.equal(cache.entries[ids[0]].identity.feature_name, 'auth');
      return runtimeContext(root);
    });
    contexts.push(context);
  }
  assert.notEqual(contexts[0].context_id, contexts[1].context_id);
});

test('Codex P0 regression: placeholder, explicit failure, artifact, symlink and invalid_specs', () => {
  const path2 = require('node:path');
  const specReceipt = require(path2.join(__dirname, '../../src/codex/hooks/lib/spec-receipt.cjs'));
  const specUtils = require(path2.join(__dirname, '../../src/codex/hooks/lib/spec-utils.cjs'));
  const fs2 = require('node:fs');
  const os2 = require('node:os');
  // Probe A: Tests failed and multiple Results
  assert.ok(specReceipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nTests failed: 1\n').length > 0);
  assert.ok(specReceipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nResult: FAIL\nResult: PASS\n').includes('exit_result'));
  // Probe B: placeholder tokens
  assert.ok(specReceipt.validateCanonicalReceipt('Verification: PASS\nCommand: TODO\nExit: 0\nBase: a\nHead: b\n').includes('command'));
  assert.ok(specReceipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: TBD\nHead: b\n').includes('provenance'));
  assert.ok(specReceipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: pending\nhead_sha: unknown\n').includes('provenance'));
  assert.deepEqual(specReceipt.validateCanonicalReceipt(`Verification: PASS\nCommand: npm run todo:test\nExit: 0\nBase: ${VALID_BASE}\nHead: ${VALID_HEAD}\n`), []);
  // Probe C: artifact
  assert.ok(specReceipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nArtifact: x\nsha256: TBD\n').includes('artifact_hash'));
  assert.ok(specReceipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nArtifact: x\nsha256: \n').includes('artifact_hash'));
  assert.deepEqual(specReceipt.validateCanonicalReceipt(`Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: ${VALID_BASE}\nHead: ${VALID_HEAD}\nArtifact: bundle\nsha256: ${'a'.repeat(64)}\n`), []);
  // Probe D/E: symlink packet and task
  const tmp = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'cafekit-codex-reg-'));
  try {
    const specsDir = path2.join(tmp, 'specs');
    writeProcessTask(path2.join(specsDir, 'valid'), 'pending');
    const outside = path2.join(tmp, 'outside');
    writeProcessTask(outside, 'pending');
    fs2.symlinkSync(outside, path2.join(specsDir, 'linked'));
    assert.equal(specUtils.resolveWorkflowCandidate(tmp, {}, 'linked', null).error, 'explicit_malformed');
    assert.equal(specUtils.resolveWorkflowCandidate(tmp, {}, null, path2.join(specsDir, 'linked', 'plan.md')).error, 'explicit_malformed');
    fs2.rmSync(path2.join(specsDir, 'linked'));
    // task symlink to a file outside the packet
    const featDir = path2.join(specsDir, 'valid');
    const outsideTask = path2.join(tmp, 'outside-task.md');
    fs2.copyFileSync(path2.join(featDir, 'task-01-auth.md'), outsideTask);
    fs2.symlinkSync(outsideTask, path2.join(featDir, 'task-02-link.md'));
    const proof = specReceipt.checkWorkflowReceiptDetails(featDir, 'task-02-link.md', null);
    assert.ok(proof.failures.includes('unsafe_path'), `task symlink must be unsafe, got ${proof.failures}`);
    assert.equal(specUtils.resolveWorkflowCandidate(tmp, {}, null, null).error, 'invalid_specs');
    fs2.rmSync(path2.join(featDir, 'task-02-link.md'));
    // malformed packet: dependency on a missing task
    const bad = path2.join(specsDir, 'bad');
    writeProcessTask(bad, 'pending');
    fs2.writeFileSync(path2.join(bad, 'task-01-auth.md'),
      fs2.readFileSync(path2.join(bad, 'task-01-auth.md'), 'utf8').replace('- none', '- task-09-missing.md'));
    const mal = specUtils.resolveWorkflowCandidate(tmp, {}, null, null);
    assert.equal(mal.error, 'invalid_specs');
  } finally {
    fs2.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Codex adapter parity - phantom vectors via shared validator (r3)', () => {
  const receipt = require(path.join(__dirname, '../../src/codex/hooks/lib/spec-receipt.cjs'));
  const base = `Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: ${VALID_BASE}\nHead: ${VALID_HEAD}\n`;
  const rejects = [
    'Tests: 0 total',
    'Test Suites: 1 failed, 1 total',
    'FAIL ./foo.test.js',
    'FAIL\tpackage',
    'FAIL\texample.test/probe\t0.431s',
    '--- FAIL: TestName (0.00s)',
    'FAILED tests/test_demo.py::test_foo - assert 1 == 2',
    'FAILED tests/test_demo.py',
    'ERROR collecting tests/test_demo.py',
    '# fail 1',
    'ℹ fail 1',
    'not ok 1 - test',
    '[ERROR] Tests run: 5, Failures: 1, Errors: 0, Skipped: 0',
    '[ERROR] Tests run: 5, Failures: 0, Errors: 1, Skipped: 0',
    '[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.2.5:test',
    'ℹ tests 0',
    'collected 0 items',
    '1 error in 0.12s',
    'ℹ cancelled 1',
  ];
  for (const vector of rejects) {
    assert.ok(receipt.validateCanonicalReceipt(base + vector + '\n').length > 0, `should reject via Codex: ${vector}`);
  }
  const passes = [
    'Notes: handles error/failure',
    'collected 1 item',
    'Test Suites: 0 failed',
    '[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0',
    '[ERROR] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0',
    '[ERROR] Error handling is documented',
    'FAILURE mode analysis',
    'Notes: tests failed previously but now fixed',
  ];
  for (const vector of passes) {
    assert.deepEqual(receipt.validateCanonicalReceipt(base + vector + '\n'), [], `should pass via Codex: ${vector}`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-tap-heading-'));
  try {
    const featureDir = path.join(tmp, 'feature');
    const receiptFields = base.trim().split('\n');
    writeProcessTask(featureDir, 'done', [...receiptFields, '```', 'pnpm test', '# fail 1', '```']);
    const tapFailure = receipt.checkWorkflowReceiptDetails(featureDir, 'task-01-auth.md', null);
    assert.ok(tapFailure.failures.includes('verification_state'), `unindented TAP # fail 1 must reach the shared validator, got ${tapFailure.failures}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('installed Codex gate fails closed with a controlled decision when policy is missing or malformed', () => {
  for (const policy of ['missing', 'malformed']) {
    inHookFixture((root, hooks) => {
      const result = runHook(path.join(hooks, 'spec-gate.cjs'), root, {
        cwd: root,
        session_id: 'session-a',
        hook_event_name: 'Stop',
        stop_hook_active: false,
      });
      assert.equal(result.status, 0, `${policy}: ${result.stderr}`);
      assert.equal(result.stderr, '', `${policy} must not leak a stack trace`);
      const block = JSON.parse(result.stdout);
      assert.equal(block.decision, 'block');
      assert.match(block.reason, /workflow policy could not be loaded/i);
      assert.ok(fs.existsSync(path.join(hooks, '.logs', 'hook-log.jsonl')));
    }, { policy });
  }
});

test('Codex adapter enforces declared task artifact SHA-256 with missing, invalid, and valid evidence', () => {
  const artifact = Buffer.from('cafekit codex fixture artifact\n');
  const digest = crypto.createHash('sha256').update(artifact).digest('hex');
  const cases = [
    ['', true],
    ['sha256: abc123', true],
    [`sha256: ${'0'.repeat(64)}`, true],
    [`sha256: ${digest}`, false],
  ];
  for (const [hashLine, shouldBlock] of cases) {
    inHookFixture((root, hooks) => {
      const feature = path.join(root, 'specs', 'artifact-demo');
      fs.mkdirSync(path.join(root, 'output'), { recursive: true });
      fs.writeFileSync(path.join(root, 'output', 'bundle.js'), artifact);
      writeProcessTask(feature, 'done', null, 'node --test');
      writeProcessTask(feature, 'done', bindReceipt(root, [
        'Verification: PASS', 'Command: node --test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
        'Artifact: output/bundle.js', hashLine, '```', 'node --test', 'ok 1', '```',
      ].join('\n'), 'artifact-demo').split('\n'), 'node --test');
      const result = runHook(path.join(hooks, 'spec-gate.cjs'), root, {
        cwd: root,
        session_id: 'session-a',
        hook_event_name: 'Stop',
        stop_hook_active: false,
      });
      assert.equal(result.status, 0, result.stderr);
      if (shouldBlock) {
        const block = JSON.parse(result.stdout);
        assert.equal(block.decision, 'block');
        assert.match(block.reason, /\bartifact_hash\b/);
      } else {
        assert.equal(result.stdout, '');
      }
    });
  }
});

test('Codex privacy denies obfuscated secret reads, allows benign and runtime state', () => {
  inHookFixture((root, hooks) => {
    const block = path.join(hooks, 'privacy-block.cjs');
    const denied = [
      { command: "cat .e''nv", tool: 'exec_command' },
      { command: 'cat ~/.cafekit/completion-authority/hmac.key', tool: 'exec_command' },
      { command: 'cat ~/.ssh/id_rsa', tool: 'Bash' },
      { command: 'docker compose --env-file .env up', tool: 'exec_command' },
      { command: "python3 -c \"open('.env').read()\"", tool: 'exec_command' },
      { command: "node -e \"fs.readFileSync('.env')\"", tool: 'Bash' },
      { command: "bash -c 'cat .e''nv'", tool: 'exec_command' },
      { command: "echo ok; cat .env", tool: 'Bash' },
    ];
    for (const { command, tool } of denied) {
      const res = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command } });
      assert.equal(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, 'deny', command);
    }
    // Runtime state and transcripts are CafeKit's own bookkeeping, not secrets.
    // Guarding them by substring also matched every source file and doc that
    // merely spelled `sessions` or `session-state`, so the gate fired on the
    // repo it was installed in. The one real secret there, hmac.key, is still
    // covered above by the `.key` rule.
    const allowed = [
      { command: "echo hello", tool: 'exec_command' },
      { command: "cat README.md", tool: 'exec_command' },
      { command: "cat src/app.js", tool: 'Bash' },
      { command: 'cat .codex/sessions/test.json', tool: 'exec_command' },
      { command: 'cat .codex/session-state/latest.md', tool: 'Bash' },
      { command: 'cat docs/sessions-guide.md', tool: 'exec_command' },
    ];
    for (const { command, tool } of allowed) {
      const res = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command } });
      assert.equal(res.stdout, '', command);
    }
  });
});

test('Codex privacy denies sensitive names it can resolve, allows pure indirection', () => {
  inHookFixture((root, hooks) => {
    const block = path.join(hooks, 'privacy-block.cjs');
    const denied = [
      { command: 'cat .e\\\nnv', tool: 'Bash' },
      { command: "cat $'\\x2e\\x65\\x6e\\x76'", tool: 'exec_command' },
      { command: 'cat .env*', tool: 'Bash' },
      { command: 'cat certs/*.pem', tool: 'exec_command' },
      { command: 'cat ~/.aws/credentials', tool: 'Bash' },
      { command: 'ssh -i ~/.ssh/id_ed25519 host', tool: 'exec_command' },
      { command: 'curl --config ~/.netrc https://example.com', tool: 'Bash' },
      { command: 'kubectl --kubeconfig ~/.kube/kubeconfig get pods', tool: 'exec_command' },
      { command: 'openssl rsa -in server.key', tool: 'Bash' },
      { command: 'less "$HOME/.env"', tool: 'Bash' },
      { command: 'cat $(echo .env)', tool: 'Bash' },
      { command: 'cat `echo .env`', tool: 'Bash' },
    ];
    for (const { command, tool } of denied) {
      const res = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command } });
      assert.equal(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, 'deny', `should deny ${command}`);
    }
    // Accepted gap: the target of a bare `$FILE` is unknowable without running
    // the shell, and every denial here costs a round trip through a one-shot
    // approval prompt. A sensitive name spelled out next to the expansion
    // (`"$HOME/.env"`, `$(echo .env)`) is not indirection and is denied above.
    const allowed = [
      { command: "echo $VAR", tool: 'exec_command' },
      { command: 'echo "$HOME"', tool: 'Bash' },
      { command: "git status", tool: 'exec_command' },
      { command: "git status $VAR", tool: 'Bash' },
      { command: "cat README.md", tool: 'exec_command' },
      { command: "cat .env.example", tool: 'Bash' },
      { command: "cat .env.sample", tool: 'Bash' },
      { command: "cat .env.template", tool: 'exec_command' },
      { command: "cat .env.test", tool: 'Bash' },
      { command: "cat '$FILE'", tool: 'exec_command' },
      { command: "cat '$HOME/README.md'", tool: 'Bash' },
      { command: "cat README.md '$EXTRA'", tool: 'exec_command' },
      { command: "echo '$(cat $FILE)'", tool: 'Bash' },
      { command: 'echo .envoy', tool: 'exec_command' },
      { command: 'echo not.env', tool: 'Bash' },
      { command: 'echo .env', tool: 'exec_command' },
      { command: "printf '%s\\n' .env", tool: 'Bash' },
      { command: 'git log -- .env', tool: 'Bash' },
      { command: 'git status sessions.md', tool: 'exec_command' },
      { command: 'python3 -c "print(os.environ[\'HOME\'])"', tool: 'Bash' },
      { command: 'head -n "$COUNT" README.md', tool: 'exec_command' },
      { command: 'grep .env README.md', tool: 'Bash' },
      { command: "sed -n '/.env/p' README.md", tool: 'exec_command' },
      { command: 'cat $FILE', tool: 'Bash' },
      { command: 'cat "$FILE"', tool: 'exec_command' },
      { command: 'cat ${FILE}', tool: 'Bash' },
      { command: 'cat $1', tool: 'exec_command' },
      { command: 'head $SECRET', tool: 'exec_command' },
      { command: 'tail ${MY_FILE}', tool: 'Bash' },
      { command: 'cat README.md $EXTRA', tool: 'Bash' },
      { command: 'echo ok; cat README.md $FILE', tool: 'Bash' },
      { command: 'cat README.md | head $FILE', tool: 'exec_command' },
      { command: "bash -c 'cat $FILE'", tool: 'Bash' },
      { command: 'cat README.md *', tool: 'Bash' },
      { command: 'cat ~/.zshrc', tool: 'exec_command' },
      { command: 'du -sh */', tool: 'Bash' },
      { command: 'env -u UNUSED cat "$FILE"', tool: 'Bash' },
      { command: 'timeout 1 cat "$FILE"', tool: 'exec_command' },
      { command: "eval 'cat \"$FILE\"'", tool: 'exec_command' },
      { command: "find . -exec sh -c 'cat \"$FILE\"' \\;", tool: 'Bash' },
      { command: 'source "$FILE"', tool: 'exec_command' },
      { command: 'xargs -a "$LIST" cat', tool: 'Bash' },
      { command: 'python3 -c \'open(os.environ["FILE"]).read()\'', tool: 'exec_command' },
      { command: 'node -e \'fs.readFileSync(process.env.FILE)\'', tool: 'Bash' },
      { command: 'cat < "$FILE"', tool: 'exec_command' },
    ];
    for (const { command, tool } of allowed) {
      const res = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command } });
      assert.equal(res.stdout, '', `should allow ${command}`);
    }
    const assignmentOnly = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'FILE=.env; cat README.md' } });
    assert.equal(assignmentOnly.stdout, '');
    const assignmentRead = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'FILE=.env; cat .env' } });
    assert.equal(JSON.parse(assignmentRead.stdout).hookSpecificOutput.permissionDecision, 'deny');
  });
});

test('Codex privacy reads an inert heredoc body as prose, not shell', () => {
  inHookFixture((root, hooks) => {
    const block = path.join(hooks, 'privacy-block.cjs');
    const inert = "gh pr create --body \"$(cat <<'BODY'\nRun `cat .env` to inspect config\nBODY\n)\"";
    const allowed = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: inert } });
    assert.equal(allowed.stdout, '', 'quoted delimiter expands nothing');

    const expanding = 'bash -c "cat <<BODY\n$(cat .env)\nBODY"';
    const denied = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: expanding } });
    assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny', 'unquoted delimiter expands');
  });
});

test('Claude and Codex privacy lexers agree on literals, delimiters, and quote expansion', () => {
  inHookFixture((root, hooks) => {
    const claude = path.join(PACKAGE_ROOT, 'src/claude/hooks/privacy-block.cjs');
    const codex = path.join(hooks, 'privacy-block.cjs');
    const vectors = [
      ["cat .e''nv", true],
      ["python3 -c \"open('.env').read()\"", true],
      ['cat README.md $FILE', false],
      ['echo ok; cat README.md $FILE', false],
      ["cat '$FILE'", false],
      ["echo '$(cat $FILE)'", false],
      ["cat README.md '*'", false],
      ["cat README.md '~'", false],
      ["cat README.md '{README.md,LICENSE}'", false],
      ['cat .env.example', false],
      ['echo .envoy', false],
      ['cat .e\\\nnv', true],
      ["cat $'\\x2e\\x65\\x6e\\x76'", true],
      ['env -u UNUSED cat "$FILE"', false],
      ['timeout 1 cat "$FILE"', false],
      ["eval 'cat \"$FILE\"'", false],
      ["find . -exec sh -c 'cat \"$FILE\"' \\;", false],
      ['source "$FILE"', false],
      ['xargs -a "$LIST" cat', false],
      ['python3 -c \'open(os.environ["FILE"]).read()\'', false],
      ['cat ~/.ssh/id_rsa', true],
      ['docker compose --env-file .env up', true],
      ['cat ~/.zshrc', false],
      ['git log -- .env', false],
      ['echo .env', false],
      ["printf '%s\\n' .env", false],
      ['git status sessions.md', false],
      ['python3 -c "print(os.environ[\'HOME\'])"', false],
    ];
    for (const [command, blocked] of vectors) {
      const payload = { cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } };
      const stateDir = path.join(hooks, '.privacy');
      const pendingCount = () => fs.existsSync(stateDir)
        ? fs.readdirSync(stateDir).filter((name) => name.startsWith('pending-')).length
        : 0;
      const beforePending = pendingCount();
      const claudeResult = runHook(claude, root, payload);
      const codexResult = runHook(codex, root, { ...payload, session_id: `parity-${command}` });
      const claudeOutput = claudeResult.stdout.trim() ? JSON.parse(claudeResult.stdout) : null;
      const codexOutput = codexResult.stdout.trim() ? JSON.parse(codexResult.stdout) : null;
      assert.equal(claudeOutput?.hookSpecificOutput?.permissionDecision || null, blocked ? 'ask' : null, `Claude parity vector: ${command}`);
      assert.equal(codexOutput?.hookSpecificOutput?.permissionDecision || null, blocked ? 'deny' : null, `Codex parity vector: ${command}`);
      if (blocked) {
        assert.equal(claudeOutput.hookSpecificOutput.hookEventName, 'PreToolUse');
        assert.equal(codexOutput.hookSpecificOutput.hookEventName, 'PreToolUse');
        assert.ok(claudeOutput.hookSpecificOutput.permissionDecisionReason);
        assert.ok(codexOutput.hookSpecificOutput.permissionDecisionReason);
      }
      assert.equal(pendingCount() - beforePending, blocked ? 1 : 0, `Codex approval-state side effect: ${command}`);
    }
  });
});

test('Codex privacy handles dangling symlink to protected target (and allows benign/example)', () => {
  inHookFixture((root, hooks) => {
    const block = path.join(hooks, 'privacy-block.cjs');
    // Create .env and dangling link
    const env = path.join(root, '.env');
    fs.writeFileSync(env, 'SECRET=1');
    const link = path.join(root, 'innocent.txt');
    fs.symlinkSync(env, link);
    fs.unlinkSync(env);
    const denied = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: link } });
    assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny', 'dangling to .env must deny');

    // Dangling benign
    const benign = path.join(root, 'benign.txt');
    fs.writeFileSync(benign, 'hi');
    const dangling = path.join(root, 'dangling.txt');
    fs.symlinkSync(benign, dangling);
    fs.unlinkSync(benign);
    const allowed1 = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: dangling } });
    assert.equal(allowed1.stdout, '', 'dangling benign should allow');

    // Dangling to .env.example
    const example = path.join(root, '.env.example');
    fs.writeFileSync(example, 'EXAMPLE=1');
    const linkExample = path.join(root, 'link-example.txt');
    fs.symlinkSync(example, linkExample);
    fs.unlinkSync(example);
    const allowed2 = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: linkExample } });
    assert.equal(allowed2.stdout, '', 'dangling to .env.example should allow');

    // Real link to allowed example remains allowed
    fs.writeFileSync(example, 'EXAMPLE=1');
    const realLink = path.join(root, 'real-example.txt');
    if (fs.existsSync(realLink)) fs.unlinkSync(realLink);
    // remove previous dangling if exists
    try { fs.unlinkSync(linkExample); } catch {}
    fs.symlinkSync(example, realLink);
    const allowed3 = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: realLink } });
    assert.equal(allowed3.stdout, '', 'real link to .env.example should allow');

    // Looping symlink fails closed
    const a = path.join(root, 'loop-a');
    const b = path.join(root, 'loop-b');
    try { fs.unlinkSync(a); } catch {}
    try { fs.unlinkSync(b); } catch {}
    fs.symlinkSync(b, a);
    fs.symlinkSync(a, b);
    const looped = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: a } });
    assert.equal(JSON.parse(looped.stdout).hookSpecificOutput.permissionDecision, 'deny', 'looping symlink should deny');
  });
});

test('Codex privacy apply_patch with temp fixtures respects sensitive vs safe', () => {
  inHookFixture((root, hooks) => {
    const block = path.join(hooks, 'privacy-block.cjs');
    const safePatch = '*** Begin Patch\n*** Update File: README.md\n+hi\n*** End Patch\n';
    const safeRes = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'apply_patch', tool_input: { patch: safePatch } });
    assert.equal(safeRes.stdout, '', 'safe patch should allow');
    const sensitivePatch = '*** Begin Patch\n*** Update File: .env\n+SECRET=x\n*** End Patch\n';
    const denied = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'apply_patch', tool_input: { patch: sensitivePatch } });
    assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny');
  });
});

test('Codex hook-context canonicalizes symlink project root (regression)', () => {
  inHookFixture((root, hooks) => {
    const hookContextPath = path.join(hooks, 'lib', 'hook-context.cjs');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-symroot-'));
    try {
      const linkRoot = path.join(outside, 'link-project');
      fs.symlinkSync(root, linkRoot);
      // Require the installed hook-context via the symlink path to see PROJECT_ROOT canonicalization
      const linkedContext = require(path.join(linkRoot, '.codex', 'hooks', 'lib', 'hook-context.cjs'));
      const realRoot = fs.realpathSync(root);
      assert.equal(linkedContext.PROJECT_ROOT, realRoot, 'PROJECT_ROOT should be canonicalized via realpath');
      // getHookContext should still work with cwd inside symlink root
      const payload = { cwd: linkRoot, session_id: 's1' };
      const ctx = linkedContext.getHookContext(payload);
      assert.equal(ctx.projectRoot, realRoot);
      assert.ok(ctx.sessionCwd, 'sessionCwd should be resolved');
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
      // Clear require cache for the symlink context to avoid polluting other tests
      Object.keys(require.cache).forEach((k) => { if (k.includes('link-project')) delete require.cache[k]; });
    }
  });
});

test('Codex session state refuses a symlinked state path and writes nothing outside the project', () => {
  inHookFixture((root, hooks) => {
    const stateStore = require(path.join(hooks, 'lib', 'state-store.cjs'));
    const sessionId = 'sess-symlink';
    const dir = stateStore.stateDir(root, sessionId);
    const sessionState = path.dirname(dir);
    // A repository can commit either the shared state folder or one session folder as a link.
    for (const link of [sessionState, dir]) {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-state-outside-'));
      try {
        fs.rmSync(sessionState, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(outside, link);
        let called = false;
        const ok = stateStore.withStateLock(root, sessionId, (stateDir) => {
          called = true;
          stateStore.writeData(stateDir, { todos: [] });
        });
        assert.equal(ok, false, `${path.relative(root, link)} link must be refused`);
        assert.equal(called, false);
        assert.deepEqual(fs.readdirSync(outside), [], 'nothing may be written outside the project');
      } finally {
        fs.rmSync(sessionState, { recursive: true, force: true });
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }
    assert.equal(stateStore.withStateLock(root, sessionId, () => {}), true, 'a plain state folder still locks');
  });
});

test('Codex resolver rejects symlink escape', () => {
  inHookFixture((root, hooks) => {
    const specUtils = require(path.join(hooks, 'lib', 'spec-utils.cjs'));
    const resolverPath = path.join(root, '.codex', 'scripts', 'spec-resolver.cjs');
    const linkTarget = path.join(root, 'external.js');
    fs.writeFileSync(linkTarget, 'module.exports = {}');
    const original = fs.readFileSync(resolverPath);
    fs.unlinkSync(resolverPath);
    fs.symlinkSync(linkTarget, resolverPath);
    assert.throws(() => specUtils.specsDirectory(root, {}), /symlink|rejected/i);
    fs.unlinkSync(resolverPath);
    fs.writeFileSync(resolverPath, original);
    const scripts = path.dirname(resolverPath);
    const outsideScripts = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-scripts-outside-'));
    try {
      fs.cpSync(scripts, outsideScripts, { recursive: true });
      fs.rmSync(scripts, { recursive: true, force: true });
      fs.symlinkSync(outsideScripts, scripts);
      assert.throws(() => specUtils.specsDirectory(root, {}), /symlink|trusted root|rejected/i);
    } finally {
      try { fs.unlinkSync(scripts); } catch {}
      fs.mkdirSync(scripts, { recursive: true });
      fs.copyFileSync(
        path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'),
        path.join(scripts, 'spec-resolver.cjs'),
      );
      fs.rmSync(outsideScripts, { recursive: true, force: true });
    }
  });
});

test('Codex privacy state rejects a symlinked state directory without external writes', () => {
  inHookFixture((root, hooks) => {
    const block = path.join(hooks, 'privacy-block.cjs');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-privacy-outside-'));
    const state = path.join(hooks, '.privacy');
    try {
      fs.symlinkSync(outside, state);
      const result = runHook(block, root, {
        cwd: root,
        session_id: 'state-symlink',
        hook_event_name: 'PreToolUse',
        tool_name: 'Read',
        tool_input: { file_path: path.join(root, '.env') },
      });
      const output = JSON.parse(result.stdout);
      assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
      assert.match(output.hookSpecificOutput.permissionDecisionReason, /could not be evaluated safely/i);
      assert.deepEqual(fs.readdirSync(outside), []);
    } finally {
      try { fs.unlinkSync(state); } catch {}
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

test('Claude and Codex fail closed consistently for malformed cwd payloads', () => {
  inHookFixture((root, hooks) => {
    const payload = {
      cwd: 123,
      session_id: 'malformed-cwd',
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: path.join(root, '.env') },
    };
    const claude = runHook(path.join(PACKAGE_ROOT, 'src/claude/hooks/privacy-block.cjs'), root, payload);
    const codex = runHook(path.join(hooks, 'privacy-block.cjs'), root, payload);
    assert.equal(JSON.parse(claude.stdout).hookSpecificOutput.permissionDecision, 'ask');
    assert.equal(JSON.parse(codex.stdout).hookSpecificOutput.permissionDecision, 'deny');
  });
});

test('Codex emits the required decision for every receipt state', () => {
  // Codex owns no checker of its own: both wrappers in .codex/hooks/lib forward to
  // the shared module, so the two receipt modes arrive by inheritance. This case is
  // the regression lock on that inheritance. Each state asserts the decision Codex
  // must emit on its own terms; parity with Claude is checked in addition, never
  // instead, because both runtimes execute the same module and a broken
  // implementation would agree with itself.
  //
  // The dirty-tree state runs the hook from a directory below the project root with
  // the uncommitted change outside that directory's subtree. Without that, an
  // implementation resolving the repository root from the working directory returns
  // the same decision as a correct one and the case cannot fail.
  inHookFixture((root, hooks) => {
    const nested = path.join(root, 'packages', 'app');
    const feature = path.join(root, 'specs', 'auth');
    const taskFile = path.join(feature, 'task-01-auth.md');
    const outsideDirt = path.join(root, 'src', 'outside.txt');
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(feature, { recursive: true });
    fs.mkdirSync(path.dirname(outsideDirt), { recursive: true });
    fs.writeFileSync(path.join(feature, 'plan.md'), '# Auth plan\n');
    fs.writeFileSync(outsideDirt, 'committed\n');

    const staleBase = 'f'.repeat(40);
    const staleHead = 'e'.repeat(40);
    const taskBody = [
      '# Task 01: auth', '', 'Status: done', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
      '## Receipt', '',
      'Verification: PASS', 'Command: node --test', 'Exit: 0',
      `Base: ${staleBase}`, `Head: ${staleHead}`,
      '```text', '$ node --test', 'pass: 1', '```', '',
    ].join('\n');
    fs.writeFileSync(taskFile, taskBody);

    const gate = path.join(hooks, 'spec-gate.cjs');
    const payload = {
      cwd: nested,
      featureName: 'auth',
      session_id: 'session-a',
      hook_event_name: 'Stop',
      stop_hook_active: false,
    };
    const git = (...args) => {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return result;
    };
    const decide = () => {
      const result = runHook(gate, nested, payload);
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim() === '' ? 'accept' : 'block';
    };
    // Use the same module instance that minted the context: a trusted runtime
    // context is tracked per module, so mixing the package copy with the fixture
    // copy would report a spurious binding failure.
    const RECEIPT = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-receipt.cjs'));
    const sharedDecides = () => {
      const failures = RECEIPT.checkWorkflowTaskReceipt(
        feature, 'task-01-auth.md', workflowRuntimeContext(root), POLICY,
      ).failures;
      return failures.length === 0 ? 'accept' : 'block';
    };

    // 1. untracked task file — no copy in HEAD, so there is no baseline to drift
    //    from. Committing a packet is the user's choice and a project that
    //    gitignores its specs root cannot do it at all, so binding here only failed
    //    the receipt permanently once the source moved on. The structural checks
    //    still run; state 6 below is the state that binds.
    assert.equal(decide(), 'accept', 'an uncommitted task file must not be bound');
    assert.equal(sharedDecides(), 'accept', 'the shared checker must agree');

    // 2. staged but not committed — `git add` puts the file in the index, not in
    //    HEAD, so it reads exactly like state 1.
    git('add', '-A');
    assert.equal(decide(), 'accept', 'staging does not create a committed baseline');
    assert.equal(sharedDecides(), 'accept', 'the shared checker must agree');

    // 3. committed on a clean tree — the one accepting state.
    git('commit', '-qm', 'receipt and source');
    // Generated runtime state is excluded by design, so assert cleanliness the way
    // the selector sees it: nothing dirty outside the specs root and the runtime
    // state roots. The gate's own cache write must not read as a dirty worktree.
    const cleanStatus = spawnSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all',
      '--', '.', ':(exclude,literal)specs', ':(exclude,literal).codex/hooks/.logs',
      ':(exclude,literal).claude/hooks/.logs', ':(exclude,literal).codex/runtime.json'], { encoding: 'utf8' });
    assert.equal(cleanStatus.stdout.trim(), '', 'nothing outside specs and runtime state may be dirty for this state to mean anything');
    assert.equal(decide(), 'accept', 'a committed, unchanged receipt on a clean tree must be accepted');
    assert.equal(sharedDecides(), 'accept', 'the shared checker must agree');

    // 4. Contract change: an uncommitted file outside the specs root no longer
    //    rebinds a committed receipt. Base is the last commit touching anything
    //    outside the specs root, so every receipt written before a later commit
    //    records an older Base by construction — measured at 52 of 52 on the
    //    CafeKit repository. The condition therefore failed every historical
    //    receipt at once whenever any unrelated file was dirty, and could not
    //    tell a tampered receipt from an untouched one. Case 6 below still
    //    catches the receipt that actually changed.
    fs.writeFileSync(outsideDirt, 'uncommitted\n');
    assert.ok(!path.relative(nested, outsideDirt).startsWith('..') === false,
      'the dirt must lie outside the working directory used for the run');
    assert.equal(decide(), 'accept', 'unrelated dirt must not reopen a committed receipt');
    assert.equal(sharedDecides(), 'accept', 'the shared checker must agree');
    git('checkout', '--', 'src/outside.txt');

    // 5. work confined to the specs root does not reopen a committed receipt.
    fs.writeFileSync(path.join(feature, 'plan.md'), '# Auth plan\n\nEdited after the receipt landed.\n');
    assert.equal(decide(), 'accept', 'edits inside the specs root must not rebind');
    git('checkout', '--', 'specs/auth/plan.md');

    // 6. committed then modified — the receipt itself changed after the commit.
    fs.writeFileSync(taskFile, taskBody.replace(`Head: ${staleHead}`, `Head: ${'d'.repeat(40)}`));
    assert.equal(decide(), 'block', 'a receipt edited after commit must be rebound');
    assert.equal(sharedDecides(), 'block', 'the shared checker must agree');
  });
});

test('Codex wrappers stay pass-through and carry no receipt-mode logic', () => {
  // The mode selector must exist in exactly one place. If it is ever duplicated
  // into the Codex wrapper, the two runtimes can drift apart silently.
  const wrapper = fs.readFileSync(
    path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-receipt.cjs'),
    'utf8',
  );
  for (const marker of ['receiptBindingMode', 'skip-worktree', 'ls-files', 'cat-file', 'structure']) {
    assert.ok(
      !wrapper.includes(marker),
      `the Codex wrapper must not reimplement receipt-mode logic; found ${marker}`,
    );
  }
  assert.match(wrapper, /checkWorkflowTaskReceipt\(featureDir, taskPath, runtimeContext, policy\)/);
  assert.match(
    fs.readFileSync(path.join(PACKAGE_ROOT, 'src/codex/hooks/spec-state.cjs'), 'utf8'),
    /Stop re-checks every done receipt/,
  );
});
