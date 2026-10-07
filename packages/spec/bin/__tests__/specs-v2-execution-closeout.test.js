'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPTS = path.join(ROOT, 'src/claude/scripts');
const POLICY = require(path.join(SCRIPTS, 'workflow-policy.cjs'));
const PROVENANCE = require(path.join(SCRIPTS, 'provenance.cjs'));
const RECEIPT = require(path.join(SCRIPTS, 'spec-receipt.cjs'));
const RUNTIME_CLOSURE = require('./test-runtime-dependency-closure.cjs');
const FEATURE = 'closeout-demo';
const TASK = 'tasks/task-R1-01-closeout.md';
const TEMP_RUN_ID = String(process.env.CAFEKIT_CLOSEOUT_TEMP_RUN_ID || `${process.pid}-${Date.now()}`)
  .replace(/[^a-zA-Z0-9_-]/g, '-');
const TEMP_PREFIX = `cafekit-v2-closeout-owned-${TEMP_RUN_ID}`;

function withTempResources(callback) {
  const ownedPaths = [];
  const originalHome = Object.hasOwn(process.env, 'HOME')
    ? { present: true, value: process.env.HOME }
    : { present: false };
  function ownedDirectory(label) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${TEMP_PREFIX}-${label}-`));
    ownedPaths.push(directory);
    return directory;
  }
  const resources = {
    directory: ownedDirectory,
    useHome(label) {
      const directory = ownedDirectory(label);
      process.env.HOME = directory;
      return directory;
    },
  };
  try {
    return callback(resources);
  } finally {
    if (originalHome.present) process.env.HOME = originalHome.value;
    else delete process.env.HOME;
    for (const ownedPath of ownedPaths.reverse()) {
      fs.rmSync(ownedPath, { recursive: true, force: true });
    }
  }
}

test('temp resource scope cleans exact owned paths and restores HOME after failure', () => {
  const originalHome = Object.hasOwn(process.env, 'HOME')
    ? { present: true, value: process.env.HOME }
    : { present: false };
  let root;
  let home;
  assert.throws(() => withTempResources((resources) => {
    root = resources.directory('failure-root');
    home = resources.useHome('failure-home');
    throw new Error('intentional resource-scope failure');
  }), /intentional resource-scope failure/);
  assert.equal(fs.existsSync(root), false);
  assert.equal(fs.existsSync(home), false);
  assert.equal(Object.hasOwn(process.env, 'HOME'), originalHome.present);
  if (originalHome.present) assert.equal(process.env.HOME, originalHome.value);
});

function gitRoot(resources) {
  const root = resources.directory('git-root');
  for (const args of [['init', '-q'], ['config', 'user.email', 'test@example.invalid'], ['config', 'user.name', 'Test'], ['commit', '--allow-empty', '-qm', 'base']]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return root;
}

function runtime(root, session = 'execution-session') {
  return PROVENANCE.deriveRuntimeContext({
    projectRoot: root,
    specsRoot: path.join(root, 'specs'),
    specFile: path.join(root, 'specs', FEATURE, 'spec.json'),
    featureName: FEATURE,
    runtimeSession: session,
  });
}

function receiptBody(ctx, extra = '') {
  return [
    'Verification: PASS',
    'Command: node --test',
    'Exit: 0',
    'Result: PASS',
    'Expected: focused verification passes',
    'Observed: focused verification passed',
    `Base: ${ctx.base}`,
    `Head: ${ctx.head}`,
    extra,
  ].filter(Boolean).join('\n') + '\n';
}

function prepare(root, { taskless = false, specStatus = 'in_progress', taskStatus = 'done', taskReceipt = true, legacy = false, featureReceipt = false } = {}) {
  const featureDir = path.join(root, 'specs', FEATURE);
  fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
  const policy = POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Routine' });
  const spec = {
    status: specStatus === 'complete' ? 'in_progress' : specStatus,
    current_phase: specStatus === 'complete' ? 'closeout' : 'implementation',
    feature_name: FEATURE, workflow_policy: policy, task_registry: {},
  };
  if (!taskless) spec.task_registry[TASK] = { status: taskStatus, completed_at: '2026-08-13T00:00:00.000Z', dependencies: [] };
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify(spec));
  const ctx = runtime(root);
  if (!taskless) {
    const plan = [
      '# Task R1-01: closeout', `**Status:** ${taskStatus}`, '## Outcome', 'Closeout works.',
      '## Verification Plan', '- **Command:** `node --test`', '- **Expected:** focused verification passes',
      '- **Negative path:** not relevant', '- **Reachability:** not relevant',
    ].join('\n') + (legacy ? `\n## Evidence\n\n${receiptBody(ctx)}` : '\n');
    fs.writeFileSync(path.join(featureDir, TASK), plan);
    if (taskReceipt) {
      fs.mkdirSync(path.join(featureDir, 'receipts'), { recursive: true });
      fs.writeFileSync(path.join(featureDir, 'receipts', path.basename(TASK)), receiptBody(ctx, `Task: ${path.basename(TASK)}\nTask path: ${TASK}`));
    }
  }
  if (featureReceipt) fs.writeFileSync(path.join(featureDir, 'feature-receipt.md'), receiptBody(ctx, `Feature: ${FEATURE}`));
  return { featureDir, ctx };
}

function installGate(root, kind) {
  const runtimeDir = path.join(root, kind === 'claude' ? '.claude' : '.codex');
  fs.mkdirSync(path.join(runtimeDir, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(runtimeDir, 'hooks', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(runtimeDir, 'scripts'), { recursive: true });
  // Copy the real transitive require closure rather than a hand-listed subset.
  // A hand-listed subset silently rots the moment one of these entrypoints
  // gains a new local dependency: the fixture keeps building, and the gate only
  // fails later with a bare MODULE_NOT_FOUND from inside the installed runtime.
  RUNTIME_CLOSURE.copyClaudeTestRuntime(ROOT, runtimeDir, [
    'scripts/workflow-policy.cjs', 'scripts/provenance.cjs', 'scripts/spec-resolver.cjs',
    'scripts/spec-receipt.cjs', 'scripts/validate-spec-output.cjs', 'scripts/spec-ground.cjs',
    'scripts/spec-semantic-model.cjs', 'scripts/spec-final-state.cjs',
    'hooks/lib/runtime-path-safety.cjs', 'hooks/lib/hook-state-dir.cjs', 'hooks/lib/runtime-dir.cjs',
    'hooks/lib/hook-payload.cjs',
  ]);
  if (kind === 'claude') {
    fs.copyFileSync(path.join(ROOT, 'src/claude/hooks', 'spec-gate.cjs'), path.join(runtimeDir, 'hooks', 'spec-gate.cjs'));
  } else {
    fs.cpSync(path.join(ROOT, 'src/codex/hooks'), path.join(runtimeDir, 'hooks'), { recursive: true });
  }
  // The real installer materializes this canonical helper for both adapters.
  // Keep this narrow runtime fixture faithful to the same dependency closure.
  fs.copyFileSync(
    path.join(ROOT, 'src/claude/hooks/lib/runtime-path-safety.cjs'),
    path.join(runtimeDir, 'hooks/lib/runtime-path-safety.cjs'),
  );
  return path.join(runtimeDir, 'hooks/spec-gate.cjs');
}

function gate(root, kind) {
  const home = path.join(root, '.claude', 'hooks', '.logs', 'test-home');
  fs.mkdirSync(home, { recursive: true });
  const hook = installGate(root, kind);
  const featureReceipt = path.join(root, 'specs', FEATURE, 'feature-receipt.md');
  if (fs.existsSync(featureReceipt)) {
    const current = runtime(root);
    fs.writeFileSync(featureReceipt, receiptBody(current, `Feature: ${FEATURE}`));
    assert.deepEqual(RECEIPT.checkFeatureReceipt(path.dirname(featureReceipt), current, POLICY).failures, []);
  }
  const result = spawnSync(process.execPath, [hook], {
    cwd: root,
    env: { ...process.env, HOME: home, USERPROFILE: home, ...(kind === 'claude' ? { CLAUDE_PROJECT_DIR: root } : {}) },
    input: JSON.stringify({ cwd: root, session_id: 'execution-session', hook_event_name: 'Stop', stop_hook_active: false }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('separate receipt passes; missing, traversal, symlink, and conflicting legacy proof fail closed', () => {
  withTempResources((resources) => {
    const root = gitRoot(resources);
    const { featureDir, ctx } = prepare(root);
    assert.deepEqual(RECEIPT.checkTaskReceipt(featureDir, TASK, { completed_at: '2026-08-13T00:00:00.000Z' }, ctx, POLICY).failures, []);
    fs.unlinkSync(path.join(featureDir, 'receipts', path.basename(TASK)));
    assert.ok(RECEIPT.checkTaskReceipt(featureDir, TASK, { completed_at: '2026-08-13T00:00:00.000Z' }, ctx, POLICY).failures.includes('missing_receipt'));
    assert.equal(RECEIPT.canonicalTaskReceiptPath('../task-x.md'), null);
    const outside = path.join(root, 'outside.md');
    fs.writeFileSync(outside, receiptBody(ctx));
    fs.mkdirSync(path.join(featureDir, 'receipts'), { recursive: true });
    fs.symlinkSync(outside, path.join(featureDir, 'receipts', path.basename(TASK)));
    assert.ok(RECEIPT.checkTaskReceipt(featureDir, TASK, { completed_at: '2026-08-13T00:00:00.000Z' }, ctx, POLICY).failures.includes('unsafe_path'));
    fs.unlinkSync(path.join(featureDir, 'receipts', path.basename(TASK)));
    const taskFile = path.join(featureDir, TASK);
    fs.appendFileSync(taskFile, `\n## Evidence\n\n${receiptBody(ctx)}`);
    assert.equal(RECEIPT.checkTaskReceipt(featureDir, TASK, { completed_at: '2026-08-13T00:00:00.000Z' }, ctx, POLICY).source, 'legacy');
    fs.writeFileSync(path.join(featureDir, 'receipts', path.basename(TASK)), receiptBody(ctx, `Task: ${path.basename(TASK)}\nTask path: ${TASK}`).replace('Command: node --test', 'Command: node --test changed'));
    assert.ok(RECEIPT.checkTaskReceipt(featureDir, TASK, { completed_at: '2026-08-13T00:00:00.000Z' }, ctx, POLICY).failures.includes('receipt_conflict'));
  });
});

test('Claude and Codex gates require task proof at every Stop and feature proof only at durable closeout', () => {
  withTempResources((resources) => {
    for (const kind of ['claude', 'codex']) {
      const taskBearing = gitRoot(resources);
      prepare(taskBearing, { taskReceipt: false, featureReceipt: false });
      assert.match(gate(taskBearing, kind), new RegExp(path.basename(TASK)), `${kind} unproven done task before closeout`);
      prepare(taskBearing, { taskReceipt: true, featureReceipt: false });
      assert.equal(gate(taskBearing, kind), '', `${kind} proven done task before closeout`);
      assert.equal(fs.existsSync(path.join(taskBearing, 'specs', FEATURE, 'feature-receipt.md')), false);
      prepare(taskBearing, { specStatus: 'complete', featureReceipt: false });
      assert.match(gate(taskBearing, kind), /feature-receipt\.md/);
      prepare(taskBearing, { specStatus: 'complete', featureReceipt: true });
      assert.equal(gate(taskBearing, kind), '');
      fs.appendFileSync(path.join(taskBearing, 'specs', FEATURE, 'receipts', path.basename(TASK)), 'Exit: 1\n');
      assert.match(gate(taskBearing, kind), new RegExp(path.basename(TASK)));
    }
  });
});

test('an unproven done dependency cannot advance a dependent task', () => {
  withTempResources((resources) => {
    for (const kind of ['claude', 'codex']) {
      const root = gitRoot(resources);
      const { featureDir } = prepare(root, { taskReceipt: false });
      const dependent = 'tasks/task-R1-02-dependent.md';
      const specFile = path.join(featureDir, 'spec.json');
      const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
      spec.task_registry[dependent] = { status: 'pending', completed_at: null, dependencies: [TASK] };
      fs.writeFileSync(specFile, JSON.stringify(spec));
      fs.writeFileSync(path.join(featureDir, dependent), '# Task R1-02: dependent\n\n**Status:** pending\n');
      const blocked = gate(root, kind);
      assert.match(blocked, new RegExp(path.basename(TASK)), `${kind} must reject the unproven done dependency`);
      assert.equal(JSON.parse(fs.readFileSync(specFile, 'utf8')).task_registry[dependent].status, 'pending');
    }
  });
});

test('legacy receipt still requires provenance under a clean committed tree', () => {
  // The workflow task path may validate a committed, unchanged receipt on
  // structure alone; the legacy task and feature receipt paths must not.
  withTempResources((resources) => {
    const root = gitRoot(resources);
    const { featureDir } = prepare(root);
    const stale = { base: 'f'.repeat(40), head: 'e'.repeat(40) };
    fs.writeFileSync(
      path.join(featureDir, 'receipts', path.basename(TASK)),
      receiptBody(stale, `Task: ${path.basename(TASK)}\nTask path: ${TASK}`),
    );
    fs.writeFileSync(path.join(featureDir, 'feature-receipt.md'), receiptBody(stale, `Feature: ${FEATURE}`));
    for (const args of [['add', '-A'], ['commit', '-qm', 'committed legacy receipts']]) {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const clean = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' });
    assert.equal(clean.stdout.trim(), '', 'fixture tree must be clean before the check');
    const ctx = runtime(root);
    const taskFailures = RECEIPT.checkTaskReceipt(featureDir, TASK, { completed_at: '2026-08-13T00:00:00.000Z' }, ctx, POLICY).failures;
    assert.ok(taskFailures.includes('provenance'), `legacy task receipts keep provenance binding when committed and clean; got ${JSON.stringify(taskFailures)}`);
    const featureFailures = RECEIPT.checkFeatureReceipt(featureDir, ctx, POLICY).failures;
    assert.ok(featureFailures.includes('provenance'), `feature receipts keep provenance binding when committed and clean; got ${JSON.stringify(featureFailures)}`);
  });
});
