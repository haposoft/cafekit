'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLAUDE_ROOT = path.join(__dirname, '..', '..');
const STATE_HOOK = path.join(CLAUDE_ROOT, 'hooks', 'state.cjs');
const POLICY = require(path.join(CLAUDE_ROOT, 'scripts', 'workflow-policy.cjs'));

function processTaskContent(title, status, dependency = 'none') {
  return [
    `# ${title}`, '', `Status: ${status}`, '',
    '## Dependencies', '', `- ${dependency}`, '',
    '## Verification Plan', '', '- Command: node --test', '',
  ].join('\n');
}

function canonicalProcessTask(root, title, dependency = 'none') {
  const context = POLICY.deriveRuntimeContext({
    projectRoot: root,
    specsRoot: path.join(root, 'specs'),
    specFile: path.join(root, 'specs', 'auth', 'plan.md'),
    featureName: 'auth',
    runtimeSession: 'session-auth-state',
  });
  return [
    processTaskContent(title, 'done', dependency),
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${context.base}`, `Head: ${context.head}`,
    '```text', 'node --test', '1 test passed', '```', '',
  ].join('\n');
}

function inInstalledProcessSpecStateFixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-spec-state-'));
  try {
    const hooks = path.join(dir, '.claude', 'hooks');
    const scripts = path.join(dir, '.claude', 'scripts');
    fs.mkdirSync(hooks, { recursive: true });
    fs.mkdirSync(scripts, { recursive: true });
    fs.copyFileSync(path.join(CLAUDE_ROOT, 'hooks', 'spec-state.cjs'), path.join(hooks, 'spec-state.cjs'));
    fs.mkdirSync(path.join(hooks, 'lib'), { recursive: true });
    fs.copyFileSync(path.join(CLAUDE_ROOT, 'hooks', 'lib', 'runtime-dir.cjs'), path.join(hooks, 'lib', 'runtime-dir.cjs'));
    fs.copyFileSync(path.join(CLAUDE_ROOT, 'hooks', 'lib', 'hook-payload.cjs'), path.join(hooks, 'lib', 'hook-payload.cjs'));
    fs.copyFileSync(
      path.join(CLAUDE_ROOT, 'hooks', 'lib', 'hook-state-dir.cjs'),
      path.join(hooks, 'lib', 'hook-state-dir.cjs'),
    );
    for (const file of [
      'provenance.cjs',
      'spec-receipt.cjs',
      'spec-resolver.cjs',
      'workflow-policy.cjs',
    ]) {
      fs.copyFileSync(path.join(CLAUDE_ROOT, 'scripts', file), path.join(scripts, file));
    }

    const feature = path.join(dir, 'specs', 'auth');
    fs.mkdirSync(feature, { recursive: true });
    fs.writeFileSync(path.join(feature, 'plan.md'), '# Auth plan\nSpecs-Contract: process-first-ready-v1\n');

    for (const args of [
      ['init', '-q'],
      ['config', 'user.email', 'cafekit@example.invalid'],
      ['config', 'user.name', 'CafeKit Test'],
      ['commit', '--allow-empty', '-qm', 'fixture'],
    ]) {
      const git = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
      assert.strictEqual(git.status, 0, git.stderr);
    }

    const writeTask = (basename, title, status, dependency = 'none') => {
      fs.writeFileSync(
        path.join(feature, basename),
        processTaskContent(title, status, dependency),
      );
    };
    const runState = () => spawnSync(process.execPath, [path.join(hooks, 'spec-state.cjs')], {
      cwd: dir,
      env: { ...process.env, PROJECT_ROOT: dir },
      input: JSON.stringify({
        cwd: dir,
        featureName: 'auth',
        session_id: 'session-auth-state',
        hook_event_name: 'UserPromptSubmit',
        prompt: 'Continue',
      }),
      encoding: 'utf8',
    });
    return run({
      cacheFile: path.join(hooks, '.logs', 'tollgate-last.txt'),
      dir,
      feature,
      hooks,
      runState,
      writePlan: (content) => fs.writeFileSync(path.join(feature, 'plan.md'), content),
      writeTask,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('Claude installed spec-state re-evaluates a standalone task when blocked becomes pending', () => {
  inInstalledProcessSpecStateFixture(({ cacheFile, hooks, runState, writeTask }) => {
    writeTask('task-01-auth.md', 'Task 01: auth', 'blocked');

    const blocked = runState();
    assert.strictEqual(blocked.status, 0, blocked.stderr);
    assert.match(blocked.stdout, /0 pending, 1 blocked/);
    assert.doesNotMatch(blocked.stdout, /Next unblocked/);
    assert.ok(cacheFile.startsWith(`${hooks}${path.sep}`), 'cache must stay inside temporary installed hooks');
    assert.strictEqual(fs.existsSync(cacheFile), true, 'installed cache must be created');
    const blockedCache = fs.readFileSync(cacheFile, 'utf8');

    writeTask('task-01-auth.md', 'Task 01: auth', 'pending');
    const pending = runState();
    assert.strictEqual(pending.status, 0, pending.stderr);
    assert.match(pending.stdout, /Spec state changed: `auth`/);
    assert.match(pending.stdout, /1 pending, 0 blocked/);
    assert.match(pending.stdout, /Next unblocked: `task-01-auth\.md`/);
    assert.notStrictEqual(fs.readFileSync(cacheFile, 'utf8'), blockedCache, 'state cache must change');
  });
});

test('Claude installed spec-state requires current canonical dependency proof and keys receipt mutations', () => {
  inInstalledProcessSpecStateFixture(({ cacheFile, dir, feature, hooks, runState, writeTask }) => {
    const predecessor = 'task-01-semantic-review.md';
    const dependent = 'task-02-implementation.md';
    writeTask(predecessor, 'Task 01: semantic review', 'blocked');
    writeTask(dependent, 'Task 02: implementation', 'pending', predecessor);
    const dependentPath = path.join(feature, dependent);
    const unchangedDependent = fs.readFileSync(dependentPath, 'utf8');

    const blocked = runState();
    assert.strictEqual(blocked.status, 0, blocked.stderr);
    assert.match(blocked.stdout, /0 done \/ 2 total \(0 in_progress, 1 pending, 1 blocked\)/);
    assert.doesNotMatch(blocked.stdout, /Next unblocked/);
    assert.ok(cacheFile.startsWith(`${hooks}${path.sep}`), 'cache must stay inside temporary installed hooks');
    assert.strictEqual(fs.existsSync(cacheFile), true, 'installed cache must be created');
    const blockedCache = fs.readFileSync(cacheFile, 'utf8');

    writeTask(predecessor, 'Task 01: semantic review', 'done');
    const missing = runState();
    assert.strictEqual(missing.status, 0, missing.stderr);
    assert.doesNotMatch(missing.stdout, /Next unblocked/);
    const missingCache = fs.readFileSync(cacheFile, 'utf8');
    assert.notStrictEqual(missingCache, blockedCache, 'done without proof must change cached proof state');

    fs.appendFileSync(path.join(feature, predecessor), '\n## Receipt\n\nVerification: PASS\n');
    const malformed = runState();
    assert.strictEqual(malformed.status, 0, malformed.stderr);
    assert.doesNotMatch(malformed.stdout, /Next unblocked/);

    fs.writeFileSync(path.join(feature, predecessor), canonicalProcessTask(dir, 'Task 01: semantic review'));
    const ready = runState();
    assert.strictEqual(ready.status, 0, ready.stderr);
    assert.match(ready.stdout, /Next unblocked: `task-02-implementation\.md`/);
    const readyCache = fs.readFileSync(cacheFile, 'utf8');
    assert.notStrictEqual(readyCache, missingCache, 'canonical proof must change cached proof state');

    fs.writeFileSync(
      path.join(feature, predecessor),
      fs.readFileSync(path.join(feature, predecessor), 'utf8').replace('Verification: PASS', 'Verification: FAIL'),
    );
    const mutated = runState();
    assert.strictEqual(mutated.status, 0, mutated.stderr);
    assert.doesNotMatch(mutated.stdout, /Next unblocked/);
    assert.notStrictEqual(fs.readFileSync(cacheFile, 'utf8'), readyCache, 'receipt-only mutation must change cache');
    assert.strictEqual(fs.readFileSync(dependentPath, 'utf8'), unchangedDependent, 'dependent must remain pending');
  });
});

test('Claude installed spec-state keeps unversioned pending packets out of Next with migration guidance', () => {
  inInstalledProcessSpecStateFixture(({ feature, runState, writePlan, writeTask }) => {
    const fencedMarkerPlan = '# Auth plan\n\n```markdown\nSpecs-Contract: process-first-ready-v1\n```\n';
    writePlan(fencedMarkerPlan);
    writeTask('task-01-auth.md', 'Task 01: auth', 'pending');
    const taskBytes = fs.readFileSync(path.join(feature, 'task-01-auth.md'));
    const result = runState();
    assert.strictEqual(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Next unblocked/);
    assert.match(result.stdout, /Migration required: add `Specs-Contract: process-first-ready-v1`/);
    const cached = runState();
    assert.strictEqual(cached.status, 0, cached.stderr);
    assert.doesNotMatch(cached.stdout, /Next unblocked/);
    assert.match(cached.stdout, /Add `Specs-Contract: process-first-ready-v1`/);

    writePlan(fencedMarkerPlan.replace('# Auth plan\n', '# Auth plan\nSpecs-Contract: process-first-ready-v1\n'));
    const marked = runState();
    assert.strictEqual(marked.status, 0, marked.stderr);
    assert.match(marked.stdout, /Spec state changed: `auth`/);
    assert.match(marked.stdout, /Next unblocked: `task-01-auth\.md`/);
    assert.deepStrictEqual(fs.readFileSync(path.join(feature, 'task-01-auth.md')), taskBytes, 'marker-only transition must not change task bytes');
  });
});

test('Claude resolver ignores fenced workflow annotations and rejects fenced-only Status', () => {
  inInstalledProcessSpecStateFixture(({ dir, feature, runState, writePlan, writeTask }) => {
    const resolver = require(path.join(dir, '.claude', 'scripts', 'spec-resolver.cjs'));
    const trailingFence = resolver.annotatedMarkdownLines([
      '```markdown', '``` trailing', 'Specs-Contract: process-first-ready-v1',
      'Status: done', '## Receipt', '```',
    ].join('\n'));
    assert.deepStrictEqual(trailingFence.slice(2, 5).map(({ outsideFence }) => outsideFence), [false, false, false]);
    const fourSpaceFence = resolver.annotatedMarkdownLines('    ```markdown\nStatus: pending');
    assert.strictEqual(fourSpaceFence[1].outsideFence, true);
    writePlan('# Auth plan\nSpecs-Contract: process-first-ready-v1\n');
    fs.writeFileSync(path.join(feature, 'task-01-fenced-only.md'), [
      '# Task 01', '', '```markdown', 'Status: done', '```', '',
      '## Dependencies', '', '- none', '', '## Verification Plan', '', '- Command: node --test', '',
    ].join('\n'));
    const malformed = resolver.resolveWorkflowCandidate({ projectRoot: dir, runtime: {}, explicitFeature: 'auth' });
    assert.strictEqual(malformed.error, 'explicit_malformed');
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
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /Next unblocked: `task-02-predecessor\.md`/);
    assert.doesNotMatch(result.stdout, /Next unblocked: `task-01-dependent\.md`/);
  });
});

test('Claude resolver accepts unique legacy task numbers, rejects ambiguity, and rejects exact cycles', () => {
  inInstalledProcessSpecStateFixture(({ dir, feature, writePlan, writeTask }) => {
    const resolver = require(path.join(dir, '.claude', 'scripts', 'spec-resolver.cjs'));
    writePlan('# Auth plan\n');
    writeTask('task-01-a.md', 'Task 01: a', 'pending');
    writeTask('task-02-b.md', 'Task 02: b', 'pending', 'Task 01');
    fs.writeFileSync(path.join(feature, 'task-03-c.md'), '# Task 03: c\n\nStatus: pending\n');
    const unique = resolver.resolveWorkflowCandidate({ projectRoot: dir, runtime: {}, explicitFeature: 'auth' });
    assert.deepStrictEqual(unique.taskRegistry['task-02-b.md'].dependencies, ['task-01-a.md']);
    assert.deepStrictEqual(unique.taskRegistry['task-03-c.md'].dependencies, []);
    assert.strictEqual(unique.workflowContract, null);
    assert.strictEqual(unique.queueReady, false);

    writeTask('task-01-second.md', 'Task 01: second', 'pending');
    const ambiguous = resolver.resolveWorkflowCandidate({ projectRoot: dir, runtime: {}, explicitFeature: 'auth' });
    assert.strictEqual(ambiguous.error, 'explicit_malformed');
    assert.match(ambiguous.reason, /legacy dependency Task 01 maps to 2 task basenames/);

    fs.rmSync(path.join(feature, 'task-01-second.md'));
    fs.rmSync(path.join(feature, 'task-03-c.md'));
    writePlan('# Auth plan\nSpecs-Contract: process-first-ready-v1\n');
    writeTask('task-01-a.md', 'Task 01: a', 'pending', 'task-02-b.md');
    writeTask('task-02-b.md', 'Task 02: b', 'pending', 'task-01-a.md');
    const cycle = resolver.resolveWorkflowCandidate({ projectRoot: dir, runtime: {}, explicitFeature: 'auth' });
    assert.strictEqual(cycle.error, 'explicit_malformed');
    assert.match(cycle.reason, /dependency cycle detected: task-01-a\.md -> task-02-b\.md -> task-01-a\.md/);
  });
});

test('Stop snapshot includes tracked modifications and untracked files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-state-'));
  try {
    fs.mkdirSync(path.join(dir, '.claude'));
    spawnSync('git', ['init', '-q'], { cwd: dir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'before\n');
    spawnSync('git', ['add', 'tracked.txt'], { cwd: dir });
    spawnSync('git', ['commit', '-qm', 'initial'], { cwd: dir });

    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'after\n');
    fs.writeFileSync(path.join(dir, 'new-untracked.json'), '{}\n');
    const result = spawnSync(process.execPath, [STATE_HOOK], {
      cwd: dir,
      input: JSON.stringify({ hook_event_name: 'Stop', cwd: dir }),
      encoding: 'utf8',
    });

    assert.strictEqual(result.status, 0);
    const state = fs.readFileSync(
      path.join(dir, '.claude', 'session-state', 'latest.md'),
      'utf8',
    );
    assert.match(state, /- tracked\.txt/);
    assert.match(state, /- new-untracked\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Stop snapshot includes untracked files before the first commit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-state-no-head-'));
  try {
    fs.mkdirSync(path.join(dir, '.claude'));
    spawnSync('git', ['init', '-q'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'first-untracked.txt'), 'new\n');

    const result = spawnSync(process.execPath, [STATE_HOOK], {
      cwd: dir,
      input: JSON.stringify({ hook_event_name: 'Stop', cwd: dir }),
      encoding: 'utf8',
    });

    assert.strictEqual(result.status, 0);
    const state = fs.readFileSync(
      path.join(dir, '.claude', 'session-state', 'latest.md'),
      'utf8',
    );
    assert.match(state, /- first-untracked\.txt/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The SessionStart block used to print even when it held only headings, placeholders and
// timestamp-only agent results, which told a resumed Claude session nothing.
const PLACEHOLDER_STATE = [
  '# Session State',
  '<!-- Generated: GENERATED -->',
  '<!-- Branch: unknown -->',
  '',
  '## What Worked (Verified)',
  '- (No completed tasks recorded)',
  '',
  "## What's Left",
  '- (All tasks completed)',
  '',
  '## Key Files Modified',
  '- (No file changes detected)',
  '',
  '## Agent Result: code-auditor (01:44:00)',
  '- Completed at 01:44:00',
  '',
  '## Agent Result: code-auditor (01:44:21)',
  '- Completed at 01:44:21',
  '',
  '## Agent Result: code-auditor (01:44:50)',
  '- Completed at 01:44:50',
  '',
].join('\n');

function sessionStartWith(content, runtimeFolder = '.claude') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-state-start-'));
  try {
    let hook = STATE_HOOK;
    if (runtimeFolder !== '.claude') {
      const hooks = path.join(dir, runtimeFolder, 'hooks');
      fs.mkdirSync(path.join(hooks, 'lib'), { recursive: true });
      fs.copyFileSync(STATE_HOOK, path.join(hooks, 'state.cjs'));
      for (const lib of ['parser.cjs', 'runtime-dir.cjs', 'hook-payload.cjs', 'hook-state-dir.cjs']) {
        fs.copyFileSync(path.join(path.dirname(STATE_HOOK), 'lib', lib), path.join(hooks, 'lib', lib));
      }
      hook = path.join(hooks, 'state.cjs');
    }
    const stateFolder = path.join(dir, runtimeFolder, 'session-state');
    fs.mkdirSync(stateFolder, { recursive: true });
    fs.writeFileSync(path.join(stateFolder, 'latest.md'), content.replace('GENERATED', new Date().toISOString()));
    const result = spawnSync(process.execPath, [hook], {
      cwd: dir,
      input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'start-1', cwd: dir }),
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, result.stderr);
    return result.stdout.trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('SessionStart prints nothing when prior context is only placeholders', () => {
  assert.strictEqual(sessionStartWith(PLACEHOLDER_STATE), '');
});

test('SessionStart prints prior context that has a completed todo', () => {
  const withTodo = PLACEHOLDER_STATE.replace('- (No completed tasks recorded)', '- Ship the statusline');
  assert.match(sessionStartWith(withTodo), /Prior Execution Context[\s\S]*Ship the statusline/);
});

test('SessionStart under .omp keeps printing placeholder-only context', () => {
  assert.match(sessionStartWith(PLACEHOLDER_STATE, '.omp'), /Prior Execution Context/);
});
