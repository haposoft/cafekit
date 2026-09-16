'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const CODEX_HOOKS = path.join(PACKAGE_ROOT, 'src/codex/hooks');
const PROVENANCE = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/provenance.cjs'));
const POLICY = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/workflow-policy.cjs'));
const VALID_BASE = '0123456789abcdef0123456789abcdef01234567';
const VALID_HEAD = '89abcdef0123456789abcdef0123456789abcdef';
const { stateDir: codexStateDir } = require(
  path.join(CODEX_HOOKS, 'lib', 'state-store.cjs')
);

function runHook(file, cwd, payload) {
  if (path.basename(file) === 'spec-gate.cjs') {
    const rootResult = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    if (rootResult.status === 0) installFeatureReceipts(rootResult.stdout.trim(), payload.session_id || 'session-a');
  }
  return spawnSync(process.execPath, [file], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8'
  });
}

function runtimeContext(root, feature = 'auth', session = 'session-a') {
  return PROVENANCE.deriveRuntimeContext({
    projectRoot: root,
    specsRoot: path.join(root, 'specs'),
    specFile: path.join(root, 'specs', feature, 'spec.json'),
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

function installFeatureReceipts(root, session = 'session-a') {
  const specsRoot = path.join(root, 'specs');
  if (!fs.existsSync(specsRoot)) return;
  for (const feature of fs.readdirSync(specsRoot)) {
    const featureDir = path.join(specsRoot, feature);
    const specFile = path.join(featureDir, 'spec.json');
    if (!fs.existsSync(specFile)) continue;
    let spec;
    try { spec = JSON.parse(fs.readFileSync(specFile, 'utf8')); } catch { continue; }
    const lifecyclePhase = spec.current_phase || spec.phase;
    const explicitCloseout = ['completed', 'complete'].includes(spec.status)
      || ['closeout', 'completion', 'completed', 'complete'].includes(lifecyclePhase);
    if (!explicitCloseout) continue;
    const tasks = Object.values(spec.task_registry || {});
    if (tasks.length === 0 || tasks.some((task) => task.status !== 'done')) continue;
    const context = runtimeContext(root, feature, session);
    fs.writeFileSync(path.join(featureDir, 'feature-receipt.md'), [
      `Feature: ${feature}`,
      'Expected: final integration verification passes',
      'Observed: final integration verification passed',
      'Verification: PASS',
      'Command: node --test',
      'Exit: 0',
      `Base: ${context.base}`,
      `Head: ${context.head}`,
      '',
    ].join('\n'));
  }
}

function inHookFixture(run, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-hooks-'));
  const hooks = path.join(root, '.codex', 'hooks');
  try {
    fs.cpSync(CODEX_HOOKS, hooks, { recursive: true });
    fs.copyFileSync(
      path.join(PACKAGE_ROOT, 'src/claude/hooks/lib/privacy-command-analysis.cjs'),
      path.join(hooks, 'lib/privacy-command-analysis.cjs'),
    );
    fs.copyFileSync(
      path.join(PACKAGE_ROOT, 'src/claude/hooks/lib/runtime-path-safety.cjs'),
      path.join(hooks, 'lib/runtime-path-safety.cjs'),
    );
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
    for (const file of ['validate-spec-output.cjs', 'spec-ground.cjs', 'spec-semantic-model.cjs', 'spec-final-state.cjs']) {
      fs.copyFileSync(
        path.join(PACKAGE_ROOT, 'src/claude/scripts', file),
        path.join(root, '.codex', 'scripts', file),
      );
    }
    fs.writeFileSync(path.join(root, '.codex', 'scripts', 'spec-scaffold.cjs'), '');
    for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test'], ['commit', '--allow-empty', '-qm', 'fixture']]) {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    return run(root, hooks);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function processTaskContent(title, status, dependency = 'none') {
  return [
    `# ${title}`, '', `Status: ${status}`, '',
    '## Dependencies', '', `- ${dependency}`, '',
    '## Verification Plan', '', '- Command: node --test', '',
  ].join('\n');
}

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
      "rg --glob '**/*' symbol src"
    ]) {
      const result = runHook(inspect, root, payload(command));
      assert.equal(result.status, 2, command);
      assert.match(result.stderr, /SCOPE LIMIT EXCEEDED/);
    }

    const normal = runHook(inspect, root, payload('rg symbol src packages'));
    assert.equal(normal.status, 0);

    const structured = runHook(inspect, root, {
      ...payload(''),
      tool_name: 'mcp__filesystem__read_file',
      tool_input: { path: 'coverage/index.html' }
    });
    assert.equal(structured.status, 2);
  });
});

test('Codex task scaffold hook blocks apply_patch Add File with stderr guidance', () => {
  inHookFixture((root, hooks) => {
    const result = runHook(path.join(hooks, 'task-scaffold-guard.cjs'), root, {
      cwd: root,
      session_id: 'session-a',
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_input: {
        command: '*** Begin Patch\n*** Add File: specs/auth/tasks/task-R0-01-auth.md\n+x\n*** End Patch\n'
      }
    });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /TASK SCAFFOLD REQUIRED/);
    assert.match(result.stderr, /node \.codex\/scripts\/spec-scaffold\.cjs auth/);
  });
});

test('Codex completion gate cannot be bypassed from a nested cwd', () => {
  inHookFixture((root, hooks) => {
    const nested = path.join(root, 'packages', 'app');
    const feature = path.join(root, 'specs', 'auth');
    const taskPath = 'tasks/task-R0-01-auth.md';
    fs.mkdirSync(path.join(feature, 'tasks'), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    const spec = {
      status: 'in_progress',
      feature_name: 'auth',
      task_registry: {
        [taskPath]: { status: 'pending', completed_at: null }
      }
    };
    fs.writeFileSync(path.join(feature, 'spec.json'), `${JSON.stringify(spec)}\n`);
    fs.writeFileSync(path.join(feature, taskPath), 'Status: pending\n');
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

    spec.task_registry[taskPath] = {
      status: 'done',
      completed_at: '2026-07-29T10:00:00.000Z'
    };
    fs.writeFileSync(path.join(feature, 'spec.json'), `${JSON.stringify(spec)}\n`);
    fs.writeFileSync(path.join(feature, taskPath), 'Status: done\n');

    const blockedBeforeCloseout = runHook(gate, nested, payload);
    assert.equal(blockedBeforeCloseout.status, 0);
    assert.equal(JSON.parse(blockedBeforeCloseout.stdout).decision, 'block');
    assert.match(JSON.parse(blockedBeforeCloseout.stdout).reason, /verification receipt/);

    fs.writeFileSync(path.join(feature, taskPath), bindReceipt(root, [
      'Status: done', '', '## Evidence', '', 'Verification: PASS',
      'Command: node --test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
    ].join('\n'), 'auth'));
    const validBeforeCloseout = runHook(gate, nested, payload);
    assert.equal(validBeforeCloseout.status, 0);
    assert.equal(validBeforeCloseout.stdout, '');
    assert.equal(fs.existsSync(path.join(feature, 'feature-receipt.md')), false);

    spec.current_phase = 'closeout';
    fs.writeFileSync(path.join(feature, 'spec.json'), `${JSON.stringify(spec)}\n`);
    const closeout = runHook(gate, nested, payload);
    assert.equal(closeout.status, 0);
    assert.equal(closeout.stdout, '');
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
  // Issue #79 end to end on this runtime. Two legacy packets both claiming closeout make
  // the gate answer a missing-receipt violation with an identity complaint whose stated
  // remedy nothing wrote. Naming the feature resolves it and the violation surfaces.
  inHookFixture((root, hooks) => {
    for (const name of ['alpha', 'beta']) {
      const feature = path.join(root, 'specs', name);
      fs.mkdirSync(path.join(feature, 'tasks'), { recursive: true });
      fs.writeFileSync(path.join(feature, 'spec.json'), `${JSON.stringify({
        feature_name: name,
        status: 'done',
        current_phase: 'closeout',
        task_registry: { 'tasks/task-R0-01-x.md': { status: 'done', completed_at: '2026-01-01T00:00:00.000Z' } },
      }, null, 2)}\n`);
      fs.writeFileSync(path.join(feature, 'tasks', 'task-R0-01-x.md'), '# Task\n\nStatus: done\n');
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
      });
      assert.equal(result.status, 0, `${JSON.stringify(input)}: ${result.stderr}`);
      assert.equal(result.stderr, '');
      const block = JSON.parse(result.stdout);
      assert.equal(block.decision, 'block');
      assert.match(block.reason, /hook payload (is empty|must be a JSON object)/i);
    }

    const feature = path.join(root, 'specs', 'auth');
    const taskPath = 'tasks/task.md';
    fs.mkdirSync(path.join(feature, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(feature, 'spec.json'), JSON.stringify({
      status: 'in_progress',
      current_phase: 'closeout',
      feature_name: 'auth',
      task_registry: { [taskPath]: { status: 'done', completed_at: '2026-08-11T00:00:00.000Z' } },
    }));
    fs.writeFileSync(path.join(feature, taskPath), 'Status: done\n');
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

test('explicit Strict Codex completion ignores worker-writable proof strings and remains blocked', () => {
  inHookFixture((root, hooks) => {
    const feature = path.join(root, 'specs', 'auth');
    const taskPath = 'tasks/task.md';
    fs.mkdirSync(path.join(feature, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(feature, 'spec.json'), JSON.stringify({
      status: 'in_progress',
      current_phase: 'closeout',
      feature_name: 'auth',
      workflow_policy: POLICY.workflowPolicySnapshot({ riskSignals: { auth: true }, assurance_level: 'Strict' }),
      proofs: {
        needsInspection: 'inspection completed',
        needsIndependentAudit: 'PASS',
        needsResearchGrounding: 'research completed',
      },
      task_registry: { [taskPath]: { status: 'done', completed_at: '2026-08-11T00:00:00.000Z' } },
    }));
    fs.writeFileSync(path.join(feature, taskPath), bindReceipt(root, [
      'Status: done', '', '## Evidence', '', 'Verification: PASS',
      'Command: node --test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
    ].join('\n'), 'auth'));
    const result = runHook(path.join(hooks, 'spec-gate.cjs'), root, {
      cwd: root,
      session_id: 'session-a',
      hook_event_name: 'Stop',
      stop_hook_active: false,
    });
    assert.equal(result.status, 0, result.stderr);
    const block = JSON.parse(result.stdout);
    assert.equal(block.decision, 'block');
    assert.match(block.reason, /needsInspection|needsIndependentAudit|needsResearchGrounding/);
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

test('semantic review authority hook is registered only for SubagentStop on Claude and Codex', () => {
  const configurations = [
    JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'src/claude/settings/settings.json'), 'utf8')).hooks,
    JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'src/codex/hooks.json'), 'utf8')).hooks,
  ];
  for (const hooks of configurations) {
    const registrations = [];
    for (const [event, groups] of Object.entries(hooks)) {
      for (const group of groups) {
        for (const hook of group.hooks || []) {
          if (String(hook.command || '').includes('semantic-review-authority.cjs')) registrations.push(event);
        }
      }
    }
    assert.deepEqual(registrations, ['SubagentStop']);
  }
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
    const taskPath = 'tasks/task-R0-01-auth.md';
    fs.mkdirSync(path.join(feature, 'tasks'), { recursive: true });
    const gate = path.join(hooks, 'spec-gate.cjs');
    const payload = { cwd: path.join(root, 'packages', 'app'), session_id: 'session-a', hook_event_name: 'Stop', stop_hook_active: false };

    // only Base -> block
    fs.writeFileSync(path.join(feature, 'spec.json'), JSON.stringify({ status: 'in_progress', current_phase: 'closeout', feature_name: 'auth', task_registry: { [taskPath]: { status: 'done', completed_at: '2026-07-29T10:00:00.000Z' } } }));
    fs.writeFileSync(path.join(feature, taskPath), 'Status: done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: abc\n');
    fs.mkdirSync(payload.cwd, { recursive: true });
    const blocked = runHook(gate, payload.cwd, payload);
    assert.equal(JSON.parse(blocked.stdout).decision, 'block');
    assert.match(JSON.parse(blocked.stdout).reason, /\bprovenance\b/);

    // both -> no block
    fs.writeFileSync(path.join(feature, taskPath), bindReceipt(root, `Status: done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: ${VALID_BASE}\nHead: ${VALID_HEAD}\n`));
    const passed = runHook(gate, payload.cwd, payload);
    assert.equal(passed.stdout, '');

    // empty Base: should block provenance — reset gate cache so re-checked as newly-done
    try { fs.rmSync(path.join(root, '.codex', 'hooks', '.logs', 'spec-gate-last.json'), { force: true }); } catch {}
    fs.writeFileSync(path.join(feature, taskPath), 'Status: done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase:\nHead: def\n');
    const blockedEmpty = runHook(gate, payload.cwd, payload);
    assert.equal(JSON.parse(blockedEmpty.stdout).decision, 'block');
    assert.match(JSON.parse(blockedEmpty.stdout).reason, /\bprovenance\b/);

    // bare base_sha without colon should block — reset cache again
    try { fs.rmSync(path.join(root, '.codex', 'hooks', '.logs', 'spec-gate-last.json'), { force: true }); } catch {}
    fs.writeFileSync(path.join(feature, taskPath), 'Status: done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha head_sha\n');
    const blockedBare = runHook(gate, payload.cwd, payload);
    assert.equal(JSON.parse(blockedBare.stdout).decision, 'block');
    assert.match(JSON.parse(blockedBare.stdout).reason, /\bprovenance\b/);
  });
});

test('Codex cache hardening: every done re-validated — mutation, deletion, malformed cache, unchanged valid', () => {
  inHookFixture((root, hooks) => {
    const feature = path.join(root, 'specs', 'auth');
    const taskPath = 'tasks/task-R0-01-auth.md';
    fs.mkdirSync(path.join(feature, 'tasks'), { recursive: true });
    const gate = path.join(hooks, 'spec-gate.cjs');
    const appCwd = path.join(root, 'packages', 'app');
    fs.mkdirSync(appCwd, { recursive: true });
    const payload = { cwd: appCwd, session_id: 'session-a', hook_event_name: 'Stop', stop_hook_active: false };
    const cacheFile = path.join(root, '.codex', 'hooks', '.logs', 'spec-gate-last.json');
    const validBodyTemplate = [
      'Status: done', '', '## Evidence', '', 'Verification: PASS',
      'Command: pnpm test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
      '```', 'pass', '```', '',
    ].join('\n');

    // first-run (no cache) with valid receipt → no block, cache seeded
    try { fs.rmSync(cacheFile, { force: true }); } catch {}
    fs.writeFileSync(path.join(feature, 'spec.json'), JSON.stringify({ status: 'in_progress', current_phase: 'closeout', feature_name: 'auth', task_registry: { [taskPath]: { status: 'done', completed_at: '2026-07-29T10:00:00.000Z' } } }));
    const validBody = bindReceipt(root, validBodyTemplate);
    fs.writeFileSync(path.join(feature, taskPath), validBody);
    let res = runHook(gate, appCwd, payload);
    assert.equal(res.stdout, '', 'first-run valid should not block');
    assert.ok(fs.existsSync(cacheFile), 'cache file must be created on first valid run');
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    assert.equal(cache.entries[runtimeContext(root).context_id].tasks[taskPath], 'done');

    // cache-hit unchanged valid → still no block (revalidation passes)
    res = runHook(gate, appCwd, payload);
    assert.equal(res.stdout, '', 'cache-hit unchanged valid must not block');

    // mutation: remove Command/Verification → must block even though cache says done
    fs.writeFileSync(path.join(feature, taskPath), 'Status: done\n\n## Evidence\n\nExit: 0\nBase: abc123\nHead: def456\n```\npass\n```\n');
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block', 'mutated receipt missing Verification/Command should block on cache-hit');
    assert.match(JSON.parse(res.stdout).reason, /\bverification_state\b|\bcommand\b/);
    // second hit still blocks
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block', 'second hit after mutation still blocks');

    // restore valid, then mutate provenance (remove Head) → block
    fs.writeFileSync(path.join(feature, taskPath), validBody);
    assert.equal(runHook(gate, appCwd, payload).stdout, '', 'restored valid should pass again');
    fs.writeFileSync(path.join(feature, taskPath), 'Status: done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: abc123\n```\npass\n```\n');
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block');
    assert.match(JSON.parse(res.stdout).reason, /\bprovenance\b/);

    // deletion → block with check a
    fs.writeFileSync(path.join(feature, taskPath), validBody);
    assert.equal(runHook(gate, appCwd, payload).stdout, '');
    fs.unlinkSync(path.join(feature, taskPath));
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block');
    assert.match(JSON.parse(res.stdout).reason, /\ba\b/);
    // restore for next sub-test
    fs.writeFileSync(path.join(feature, taskPath), validBody);
    try { fs.rmSync(cacheFile, { force: true }); } catch {}
    assert.equal(runHook(gate, appCwd, payload).stdout, '');

    // malformed cache with valid receipt → must still pass (cache parse fail-open)
    fs.writeFileSync(cacheFile, '{ malformed');
    fs.writeFileSync(path.join(feature, taskPath), validBody);
    res = runHook(gate, appCwd, payload);
    assert.equal(res.stdout, '', 'malformed cache with valid receipt must not block');
    // malformed cache with invalid receipt → must still block
    fs.writeFileSync(cacheFile, '{ malformed again');
    fs.writeFileSync(path.join(feature, taskPath), 'Status: done\n');
    res = runHook(gate, appCwd, payload);
    assert.equal(JSON.parse(res.stdout).decision, 'block', 'malformed cache with invalid receipt must block');
  });
});

test('Codex cache identity separates same-feature receipts from different roots', () => {
  const contexts = [];
  for (let index = 0; index < 2; index += 1) {
    const context = inHookFixture((root, hooks) => {
      const feature = path.join(root, 'specs', 'auth');
      const taskPath = 'tasks/task.md';
      fs.mkdirSync(path.join(feature, 'tasks'), { recursive: true });
      fs.writeFileSync(path.join(feature, 'spec.json'), JSON.stringify({
        status: 'in_progress',
        feature_name: 'auth',
        task_registry: { [taskPath]: { status: 'done', completed_at: '2026-08-11T00:00:00.000Z' } },
      }));
      fs.writeFileSync(path.join(feature, taskPath), bindReceipt(root, [
        'Status: done', '', '## Evidence', '', 'Verification: PASS',
        'Command: node --test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
      ].join('\n')));
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
  // Probe D/E: symlink spec/task
  const tmp = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'cafekit-codex-reg-'));
  try {
    const specsDir = path2.join(tmp, 'specs');
    fs2.mkdirSync(specsDir, { recursive: true });
    fs2.mkdirSync(path2.join(specsDir, 'valid'), { recursive: true });
    fs2.writeFileSync(path2.join(specsDir, 'valid', 'spec.json'), JSON.stringify({ status: 'in_progress' }));
    const outside = path2.join(tmp, 'outside');
    fs2.mkdirSync(outside, { recursive: true });
    fs2.writeFileSync(path2.join(outside, 'spec.json'), JSON.stringify({ status: 'in_progress' }));
    const link = path2.join(specsDir, 'linked');
    fs2.symlinkSync(outside, link);
    assert.equal(specUtils.resolveActiveSpec(tmp, {}, 'linked', null).error, 'explicit_malformed');
    assert.equal(specUtils.resolveActiveSpec(tmp, {}, null, path2.join(specsDir, 'linked', 'spec.json')).error, 'explicit_malformed');
    // task symlink
    const featDir = path2.join(specsDir, 'valid');
    fs2.mkdirSync(path2.join(featDir, 'tasks'), { recursive: true });
    const outsideTask = path2.join(tmp, 'outside-task.md');
    fs2.writeFileSync(outsideTask, '# Task\n\n**Status:** done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\n');
    const taskLink = path2.join(featDir, 'tasks', 'task.md');
    fs2.symlinkSync(outsideTask, taskLink);
    const fails = specReceipt.checkReceipt(featDir, 'tasks/task.md', { status: 'done', completed_at: '2026-08-11T00:00:00.000Z' });
    assert.ok(fails.includes('a'));
    // malformed spec
    fs2.mkdirSync(path2.join(specsDir, 'bad'), { recursive: true });
    fs2.writeFileSync(path2.join(specsDir, 'bad', 'spec.json'), '{ bad');
    const mal = specUtils.resolveActiveSpec(tmp, {}, null, null);
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
    const taskPath = 'tasks/task.md';
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    const taskPrefix = ['# Task', '', '**Status:** done', '', '## Evidence', '', base.trim()];
    fs.writeFileSync(path.join(featureDir, taskPath), [...taskPrefix, '# fail 1', ''].join('\n'));
    const tapFailure = receipt.checkReceipt(featureDir, taskPath, { status: 'done', completed_at: '2026-08-11T00:00:00.000Z' });
    assert.ok(tapFailure.includes('c'), 'unindented TAP # fail 1 must reach the shared validator');

    fs.writeFileSync(path.join(featureDir, taskPath), [...taskPrefix, '# Notes', 'FAILED tests/test_demo.py', ''].join('\n'));
    const markdownBody = receipt.evidenceBody(fs.readFileSync(path.join(featureDir, taskPath), 'utf8'));
    assert.doesNotMatch(markdownBody, /FAILED tests\/test_demo\.py/);
    assert.deepEqual(receipt.validateCanonicalReceipt(markdownBody), [], 'a real Markdown heading must still end Evidence');
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
    ['sha256: abc123\n', true],
    [`sha256: ${'0'.repeat(64)}\n`, true],
    [`sha256: ${digest}\n`, false],
  ];
  for (const [hashLine, shouldBlock] of cases) {
    inHookFixture((root, hooks) => {
      const feature = path.join(root, 'specs', 'artifact-demo');
      const taskPath = 'tasks/task.md';
      fs.mkdirSync(path.join(feature, 'tasks'), { recursive: true });
      fs.mkdirSync(path.join(root, 'output'), { recursive: true });
      fs.writeFileSync(path.join(root, 'output', 'bundle.js'), artifact);
      fs.writeFileSync(path.join(feature, 'spec.json'), JSON.stringify({
        status: 'in_progress',
        current_phase: 'closeout',
        feature_name: 'artifact-demo',
        task_registry: {
          [taskPath]: {
            status: 'done',
            completed_at: '2026-08-11T00:00:00.000Z',
            artifacts: ['output/bundle.js'],
          },
        },
      }));
      fs.writeFileSync(path.join(feature, taskPath), [
        '# Task', '', '**Status:** done', '', '## Evidence', '',
        'Verification: PASS', 'Command: node --test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
        'Artifact: output/bundle.js', hashLine,
      ].join('\n'));
      fs.writeFileSync(
        path.join(feature, taskPath),
        bindReceipt(root, fs.readFileSync(path.join(feature, taskPath), 'utf8'), 'artifact-demo'),
      );
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
    ];
    for (const { command, tool } of denied) {
      const res = runHook(block, root, { cwd: root, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command } });
      assert.equal(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, 'deny', `should deny ${command}`);
    }
    // Accepted gap: the target of `$FILE` is unknowable without running the
    // shell, and every denial here costs a round trip through a one-shot
    // approval prompt. `less "$HOME/.env"` is the edge of that decision.
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
      { command: 'cat $(echo .env)', tool: 'Bash' },
      { command: 'cat `echo .env`', tool: 'Bash' },
      { command: 'head $SECRET', tool: 'exec_command' },
      { command: 'tail ${MY_FILE}', tool: 'Bash' },
      { command: 'less "$HOME/.env"', tool: 'Bash' },
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

test('Codex resolver and state reject symlink escape', () => {
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
    // State dir symlink escape: create symlink for session-state dir
    const stateStore = require(path.join(hooks, 'lib', 'state-store.cjs'));
    const sessionId = 'sess-symlink';
    const dir = stateStore.stateDir(root, sessionId);
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    // Create a symlink that points outside project
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      fs.symlinkSync(outside, dir);
      // withStateLock should handle symlink safely (no crash, no write outside)
      const ok = stateStore.withStateLock(root, sessionId, () => {});
      assert.equal(typeof ok, 'boolean');
    } finally {
      try { fs.unlinkSync(dir); } catch {}
      fs.rmSync(outside, { recursive: true, force: true });
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
