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
const SCAFFOLD = path.join(SCRIPTS, 'spec-scaffold.cjs');
const VALIDATOR = path.join(SCRIPTS, 'validate-spec-output.cjs');
const AUTHORING_VALIDATION = path.join(SCRIPTS, 'spec-authoring-validation.cjs');
const RUNTIME_CLOSURE = require('./test-runtime-dependency-closure.cjs');
const SEMANTIC_MODEL = require(path.join(SCRIPTS, 'spec-semantic-model.cjs'));
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

function prepareCanonicalTaskless(root, { specStatus, featureReceipt }) {
  const scaffold = spawnSync(process.execPath, [SCAFFOLD, FEATURE, '--title', 'Closeout fixture'], { cwd: root, encoding: 'utf8' });
  assert.equal(scaffold.status, 0, scaffold.stderr);
  const featureDir = path.join(root, 'specs', FEATURE);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/final-state.js'), 'module.exports = { ready: true };\n');
  fs.writeFileSync(path.join(root, 'test/final-state.test.js'), "require('node:test')('final state', () => {});\n");
  fs.writeFileSync(path.join(featureDir, 'requirements.md'), `# Requirements

## Requirements
### Requirement 1: Closeout state
- **R1.1**: When closeout is requested, the system shall accept current validated state and reject stale semantic state.
- **R1.2**: The system shall prove the current digest through the grounded final-state boundary.
`);
  fs.writeFileSync(path.join(featureDir, 'design.md'), `# Design

## Architecture
The final-state authority recomputes current semantic state before closeout.

## Typed Anchors
| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-D-01 | file | \`src/final-state.js\` | design boundary | read | read |
| A-D-02 | file | \`test/final-state.test.js\` | separate proof boundary | read | read |

## Canonical Contracts & Invariants
### D1 — Current-state decision
The current persisted artifacts are authoritative.
### I1 — Stale-state invariant
A changed semantic artifact cannot retain readiness.
### C1 — Closeout contract
Only a validated and grounded current digest reaches closeout.

## Verification Definitions
- **V1**: Subject criteria R1.1; Subject owner A-D-01; Proof criteria R1.2; Proof owner A-D-02; Evidence anchor A-D-02; Decision refs D1, I1, C1; Method inspection \`src/final-state.js\` via A-D-01; Expected current validated state reaches closeout with the reviewed digest; Negative/failure stale semantic state is rejected before execution closeout; Reachability/grounding entrypoint \`src/final-state.js\` via A-D-01, A-D-02.

## Verification
R1.1 and R1.2 are verified by V1 against D1, I1, and C1.
`);
  const specPath = path.join(featureDir, 'spec.json');
  const seed = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const seedProjection = SEMANTIC_MODEL.modelFromMarkdown(featureDir, seed);
  assert.deepEqual(seedProjection.errors, []);
  seed.semantic_model = seedProjection.model;
  fs.writeFileSync(specPath, `${JSON.stringify(seed, null, 2)}\n`);
  // I21: only the C16 coordinator may set an authoring stage to `validated`,
  // and only together with the digest receipt that proves it fresh. The fixture
  // runs the real command instead of hand-authoring the enum.
  const authored = spawnSync(
    process.execPath,
    [AUTHORING_VALIDATION, featureDir, '--root', root],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(authored.status, 0, `${authored.stdout}\n${authored.stderr}`);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  assert.equal(spec.authoring.requirements, 'validated');
  assert.equal(spec.authoring.design, 'validated');
  spec.validation.status = 'completed';
  spec.validation.semantic_review = {
    status: 'completed',
    semantic_digest: null,
    verdict: 'PASS',
    lifecycle_disposition: 'CONTINUE',
    findings: [],
    unresolved_decisions: [],
    graph_coverage: [
      'criterion_local', 'cross_criterion', 'runtime_path',
      'assumption_provenance', 'compatibility_migration',
    ].map((surface) => ({ surface, covered: true, notes: `${surface} reviewed for the closeout fixture.` })),
    repair_round: 0,
    reviewer_evidence: {
      assurance: 'Routine',
      summary: 'Closeout fixture reviewer confirmed both criteria against the grounded final-state boundary.',
    },
    reviewed_criteria: ['R1.1', 'R1.2'],
    counterexamples: [{
      criterion: 'R1.1', case_kind: 'failure',
      scenario: 'A requirements artifact changes after the reviewed digest was recorded.',
      expected: 'Final-state authority rejects closeout until the current digest is reviewed.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }, {
      criterion: 'R1.2', case_kind: 'adversarial',
      scenario: 'A closeout supplies execution provenance while retaining a digest for older authored artifacts.',
      expected: 'Final-state authority rejects the stale digest despite valid execution provenance.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }],
  };
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  const digest = spawnSync(process.execPath, [VALIDATOR, featureDir, '--semantic-digest'], { cwd: root, encoding: 'utf8' });
  assert.equal(digest.status, 0, `${digest.stdout}\n${digest.stderr}`);
  spec.validation.semantic_review.semantic_digest = digest.stdout.trim();
  // C13: a completed receipt is only terminal when the durable history records
  // it. The entry binds the same semantic digest, the receipt's own canonical
  // digest, and the attempt index the receipt reports as repair_round.
  spec.validation.semantic_review_history.entries = [{
    sequence: 0,
    semantic_digest: spec.validation.semantic_review.semantic_digest,
    review_receipt_digest: `sha256:${crypto.createHash('sha256')
      .update(SEMANTIC_MODEL.stableJson(spec.validation.semantic_review), 'utf8').digest('hex')}`,
    verdict: 'PASS',
    lifecycle_disposition: 'CONTINUE',
    blocking_count: 0,
    attempt_index: spec.validation.semantic_review.repair_round,
    review_epoch: 0,
  }];
  spec.ready_for_implementation = true;
  spec.status = specStatus === 'complete' ? 'done' : specStatus;
  delete spec.current_phase;
  delete spec.phase;
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  const ctx = runtime(root);
  if (featureReceipt) fs.writeFileSync(path.join(featureDir, 'feature-receipt.md'), receiptBody(ctx, `Feature: ${FEATURE}`));
  return { featureDir, ctx };
}

function prepare(root, { taskless = false, specStatus = 'in_progress', taskStatus = 'done', taskReceipt = true, legacy = false, featureReceipt = false } = {}) {
  if (taskless) return prepareCanonicalTaskless(root, { specStatus, featureReceipt });
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
      const early = gitRoot(resources);
      const invalidAlias = gitRoot(resources);
      const taskless = gitRoot(resources);
      const taskBearing = gitRoot(resources);
      prepare(early, { taskless: true, specStatus: 'in_progress' });
      assert.equal(gate(early, kind), '', `${kind} pre-closeout`);
      const { featureDir: invalidAliasDir } = prepare(invalidAlias, { taskless: true, specStatus: 'in_progress' });
      const invalidAliasFile = path.join(invalidAliasDir, 'spec.json');
      const invalidAliasSpec = JSON.parse(fs.readFileSync(invalidAliasFile, 'utf8'));
      invalidAliasSpec.status = 'completed';
      fs.writeFileSync(invalidAliasFile, `${JSON.stringify(invalidAliasSpec, null, 2)}\n`);
      assert.match(gate(invalidAlias, kind), /Legacy spec\.json closeout is no longer supported/, `${kind} blocks legacy 2.1 closeout with the migration message`);
      prepare(taskless, { taskless: true, specStatus: 'complete', featureReceipt: true });
      assert.match(gate(taskless, kind), /Legacy spec\.json closeout is no longer supported/, `${kind} taskless 2.1 closeout is retired`);
      fs.appendFileSync(path.join(taskless, 'specs', FEATURE, 'requirements.md'), '\nSemantic mutation after review.\n');
      assert.match(gate(taskless, kind), /Legacy spec\.json closeout is no longer supported/, `${kind} still blocks a changed 2.1 packet`);
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

test('shared taskless terminal predicate requires canonical 2.1 policy and physical tasklessness', () => {
  withTempResources((resources) => {
    const root = gitRoot(resources);
    const { featureDir } = prepare(root, { taskless: true, specStatus: 'complete' });
    const specPath = path.join(featureDir, 'spec.json');
    const canonical = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    assert.equal(POLICY.isCanonicalTasklessTerminalSpec(canonical, featureDir), true);

    const legacy = {
      ...canonical,
      schema_version: '2.0',
      workflow_policy: POLICY.workflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Routine' }),
    };
    assert.equal(POLICY.isCanonicalTasklessTerminalSpec(legacy, featureDir), false);

    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'tasks', 'hidden.md'), '# physical task\n');
    assert.equal(POLICY.isCanonicalTasklessTerminalSpec(canonical, featureDir), false);
  });
});

test('scaffold creates planning artifacts but no task or feature receipts', () => {
  withTempResources((resources) => {
    const root = resources.directory('scaffold-root');
    const result = spawnSync(process.execPath, [path.join(SCRIPTS, 'spec-scaffold.cjs'), 'no-receipt', '--specs-root', 'specs'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const files = fs.readdirSync(path.join(root, 'specs', 'no-receipt'), { recursive: true }).map(String);
    assert.equal(files.some((file) => file.includes('receipt')), false);
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
