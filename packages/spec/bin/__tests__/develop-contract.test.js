'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const POLICY_PATH = path.join(PACKAGE_ROOT, 'src/claude/scripts/workflow-policy.cjs');
const POLICY = require(POLICY_PATH);
const PROVENANCE_HELPER = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/provenance.cjs'));
const RESOLVER = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));
const RECEIPTS = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-receipt.cjs'));
const FINAL_STATE = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-final-state.cjs'));
const VALIDATOR = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/validate-spec-output.cjs'));
const GROUNDER = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-ground.cjs'));
const SEMANTIC_AUTHORITY = require(path.join(PACKAGE_ROOT, 'src/claude/hooks/semantic-review-authority.cjs'));
const READINESS = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-readiness.cjs'));
const AUTHORING_VALIDATOR = path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-authoring-validation.cjs');
const { copyClaudeTestRuntime } = require('./test-runtime-dependency-closure.cjs');
const DEVELOP = path.join(PACKAGE_ROOT, 'src/claude/skills/develop/SKILL.md');
const SPECS = path.join(PACKAGE_ROOT, 'src/claude/skills/specs/SKILL.md');
const SCAFFOLD = path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-scaffold.cjs');
const GATE = path.join(PACKAGE_ROOT, 'src/claude/skills/develop/references/quality-gate.md');
const TEST_SKILL = path.join(PACKAGE_ROOT, 'src/claude/skills/test/SKILL.md');
const TEST_SOURCE_ROOT = path.dirname(TEST_SKILL);
const TEST_REFERENCES = ['execution-strategy.md', 'failure-triage.md', 'test-memory.md'];
const TEST_RUNNER = path.join(PACKAGE_ROOT, 'src/claude/agents/test-runner.md');
const SYNC_SKILL = path.join(PACKAGE_ROOT, 'src/claude/skills/sync/SKILL.md');
const CODE_REVIEW_SKILL = path.join(PACKAGE_ROOT, 'src/claude/skills/code-review/SKILL.md');
const PARALLEL_WAVES = path.join(PACKAGE_ROOT, 'src/claude/skills/develop/references/parallel-waves.md');
const DEVELOP_REFERENCES = ['quality-gate.md', 'parallel-waves.md', 'subagent-patterns.md'];
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const SYNC_PROTOCOLS = path.join(PACKAGE_ROOT, 'src/claude/skills/sync/references/sync-protocols.md');
const PROCESS_FIRST_AGENTS = [
  'implementer.md',
  'inspector.md',
  'code-auditor.md',
  'docs-keeper.md',
  'deployer.md',
].map((name) => path.join(PACKAGE_ROOT, 'src/claude/agents', name));
const PROVENANCE = path.join(PACKAGE_ROOT, '../../docs/provenance.md');
const SPECS_USAGE_GUIDE = path.join(PACKAGE_ROOT, '../../docs/specs-usage-guide.md');
const RUNTIME_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-policy-runtime-'));
const RUNTIME_SPEC = path.join(RUNTIME_ROOT, 'specs', 'demo', 'spec.json');
fs.mkdirSync(path.dirname(RUNTIME_SPEC), { recursive: true });
fs.mkdirSync(path.join(RUNTIME_ROOT, 'src'), { recursive: true });
fs.writeFileSync(path.join(RUNTIME_ROOT, 'src', 'app.js'), 'runtime fixture\n');
fs.writeFileSync(RUNTIME_SPEC, JSON.stringify({ status: 'in_progress', feature_name: 'demo', task_registry: {} }));
for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test'], ['add', '-A'], ['commit', '-qm', 'fixture']]) {
  const result = spawnSync('git', ['-C', RUNTIME_ROOT, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
const RUNTIME_CONTEXT = PROVENANCE_HELPER.deriveRuntimeContext({
  projectRoot: RUNTIME_ROOT,
  specsRoot: path.join(RUNTIME_ROOT, 'specs'),
  specFile: RUNTIME_SPEC,
  featureName: 'demo',
  runtimeSession: 'implementation-session-1',
});
after(() => fs.rmSync(RUNTIME_ROOT, { recursive: true, force: true }));
const EXPECTED_BASE = RUNTIME_CONTEXT.base;
const EXPECTED_HEAD = RUNTIME_CONTEXT.head;
const EXPECTED_PROVENANCE = { base: EXPECTED_BASE, head: EXPECTED_HEAD };
const RECEIPT_BINDING = POLICY.createReceiptBinding(RUNTIME_CONTEXT);

function initFixtureGit(root) {
  for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test'], ['add', '-A'], ['commit', '-qm', 'fixture']]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
}

function installClaudeRuntimeClosure(fixtureRoot, entry = 'hooks/spec-gate.cjs') {
  const destinationRoot = path.join(fixtureRoot, '.claude');
  copyClaudeTestRuntime(PACKAGE_ROOT, destinationRoot);
  const hooksRoot = path.join(PACKAGE_ROOT, 'src', 'claude', 'hooks');
  for (const hook of [
    'spec-gate.cjs',
    'completion-authority-check.cjs',
    'completion-authority-state.cjs',
    'semantic-review-authority.cjs',
  ]) {
    const target = path.join(destinationRoot, 'hooks', hook);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(hooksRoot, hook), target);
  }
  // Hook helpers the raw-copied hooks require at runtime.
  for (const helper of ['hook-state-dir.cjs', 'runtime-dir.cjs', 'hook-payload.cjs']) {
    const target = path.join(destinationRoot, 'hooks', 'lib', helper);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(hooksRoot, 'lib', helper), target);
  }
  return path.join(destinationRoot, entry);
}

function installClaude(root) {
  return spawnSync(process.execPath, [INSTALLER, '--platform', 'claude', '--yes'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: '/usr/bin:/bin' },
  });
}

function markdownLegacyRegions(content) {
  const headings = [];
  const primaryLines = [];
  const legacyLines = [];
  const hierarchy = [];

  for (const [index, line] of content.split('\n').entries()) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1].length;
      while (hierarchy.at(-1)?.level >= level) hierarchy.pop();
      const entry = { level, text: heading[2], line: index + 1 };
      hierarchy.push(entry);
      headings.push(entry);
    }

    const target = hierarchy.some(({ text }) => /legacy/i.test(text))
      ? legacyLines
      : primaryLines;
    target.push({ line: index + 1, text: line });
  }

  return {
    headings,
    primary: primaryLines.map(({ text }) => text).join('\n'),
    legacy: legacyLines.map(({ text }) => text).join('\n'),
    primaryLines,
  };
}

function assertVocabularyIsLegacyOnly(filePath, regions) {
  const vocabulary = [
    ['v2.1', /\bv2\.1\b/i],
    ['spec.json', /\bspec\.json\b/i],
    ['semantic_model', /\bsemantic[-_]model\b/i],
    ['machine authority', /\bmachine authority\b/i],
    ['task_registry', /\btask_registry\b/i],
    ['workflow_policy', /\bworkflow_policy\b/i],
    ['planning_depth', /\bplanning_depth\b/i],
    ['assurance_level', /\bassurance_level\b/i],
    ['execution_tier', /\bexecution_tier\b/i],
    ['classified_minimum', /\bclassified_minimum\b/i],
    ['coordination.boundaries', /\bcoordination\.boundaries\b/i],
    ['lane', /\blane\b/i],
  ];
  const violations = [];
  for (const { line, text } of regions.primaryLines) {
    for (const [term, pattern] of vocabulary) {
      if (pattern.test(text)) violations.push(`${line}:${term}`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `${path.relative(PACKAGE_ROOT, filePath)} has v2.1 vocabulary outside a Legacy heading`,
  );
}

function runNode(root, script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

function commandOutput(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function createCanonicalAuthoringFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-develop-contract-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'entry.js'), 'module.exports = { enabled: true };\n');
  fs.writeFileSync(path.join(root, 'test', 'service.test.js'), 'require("node:test")("service", () => {});\n');
  const scaffold = runNode(root, SCAFFOLD, ['feature']);
  assert.equal(scaffold.status, 0, commandOutput(scaffold));
  const specDir = path.join(root, 'specs', 'feature');
  const specPath = path.join(specDir, 'spec.json');
  fs.writeFileSync(path.join(specDir, 'requirements.md'), `# Requirements

## Requirements
### Requirement 1: Observable service behavior
- **R1.1**: When valid input arrives, the service shall return enabled state; invalid input shall return rejected state.
- **R1.2**: The verifier shall produce separate observable proof for enabled and rejected states.
`);
  fs.writeFileSync(path.join(specDir, 'design.md'), `# Design

## Architecture
The entrypoint exposes the bounded service behavior and a separate proof artifact.

## Typed Anchors
| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-D-01 | file | \`src/entry.js\` | service boundary | read | read |
| A-D-02 | artifact | \`artifacts/design-proof.json\` | proof evidence | write | create |

## Canonical Contracts & Invariants
### D1 — Dispatch decision
The entrypoint dispatches exactly once.
### I1 — Invalid-state invariant
Invalid input never returns enabled state.
### C1 — Result contract
The result contains one enabled boolean.

## Verification Definitions
- **V1**: Subject criteria R1.1; Subject owner A-D-01; Proof criteria R1.2; Proof owner A-D-02; Evidence anchor A-D-02; Decision refs D1, I1, C1; Method command \`node --test test/service.test.js\`; Expected exit 0 with enabled state and separate proof evidence; Negative/failure invalid input returns rejected state without enabled output; Reachability/grounding entrypoint \`src/entry.js\` via A-D-01, A-D-02.
`);
  return { root, specDir, specPath };
}

function createOrdinaryAuthoringFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-ordinary-readiness-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'entry.js'), 'module.exports = { action: "delete" };\n');
  fs.writeFileSync(path.join(root, 'test', 'entry.test.js'), 'require("node:test")("entry", () => {});\n');
  const scaffold = runNode(root, SCAFFOLD, ['ordinary']);
  assert.equal(scaffold.status, 0, commandOutput(scaffold));
  const specDir = path.join(root, 'specs', 'ordinary');
  const specPath = path.join(specDir, 'spec.json');
  fs.writeFileSync(path.join(specDir, 'requirements.md'), `# Requirements

## Requirements
### Requirement 1: Delete behavior
- **R1.1**: When deletion is requested, the service shall delete the selected record and report deleted state.
`);
  fs.writeFileSync(path.join(specDir, 'design.md'), `# Design

## Typed Anchors
| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-D-01 | file | \`src/entry.js\` | behavior owner | read | read |

## Canonical Contracts & Invariants
### D1 — Delete decision
The selected record is deleted rather than archived.
### I1 — State invariant
Deleted state is reported only after deletion succeeds.
### C1 — Result contract
The result contains the literal deleted state.

## Verification Definitions
- **V1**: Criteria R1.1; Owner A-D-01; Decision refs D1, I1, C1; Method command \`node --test test/entry.test.js\`; Expected exit 0 and the service reports deleted state; Negative/failure a missing record returns not-found without deleted state; Reachability/grounding entrypoint \`src/entry.js\` via A-D-01.
`);
  const semantic = runNode(root, SCAFFOLD, ['ordinary', '--sync-semantic-model']);
  assert.equal(semantic.status, 0, commandOutput(semantic));
  const authoring = runNode(root, AUTHORING_VALIDATOR, [specDir]);
  assert.equal(authoring.status, 0, commandOutput(authoring));
  initFixtureGit(root);
  return { root, specDir, specPath };
}

function ordinaryReview() {
  return canonicalPassReview(['R1.1'], [{
      criterion: 'R1.1', case_kind: 'failure',
      scenario: 'Deletion targets a record that does not exist in the current store.',
      expected: 'The service returns not-found and never reports the record as deleted.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }]);
}

function canonicalPassReview(reviewedCriteria, counterexamples) {
  return {
    verdict: 'PASS',
    findings: [],
    unresolved_decisions: [],
    graph_coverage: [
      'criterion_local', 'cross_criterion', 'runtime_path',
      'assumption_provenance', 'compatibility_migration',
    ].map((surface) => ({
      surface, covered: true,
      notes: 'The review covers this semantic surface against the canonical model.',
    })),
    reviewed_criteria: reviewedCriteria,
    counterexamples,
    reviewer_evidence: null,
  };
}

function promoteCanonicalModel(fixture) {
  const result = runNode(fixture.root, SCAFFOLD, ['feature', '--sync-semantic-model']);
  assert.equal(result.status, 0, commandOutput(result));
}

function makeCanonicalReady(fixture) {
  const authoring = runNode(fixture.root, AUTHORING_VALIDATOR, [fixture.specDir]);
  assert.equal(authoring.status, 0, commandOutput(authoring));
  const result = READINESS.finalizeReadiness({
    specDir: fixture.specDir,
    projectRoot: fixture.root,
    reviewResult: canonicalPassReview(['R1.1', 'R1.2'], [{
      criterion: 'R1.1', case_kind: 'failure',
      scenario: 'The service receives invalid input without its required discriminator.',
      expected: 'The service returns rejected state and never emits enabled true.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }, {
      criterion: 'R1.2', case_kind: 'adversarial',
      scenario: 'The service reports enabled state without producing separate proof evidence.',
      expected: 'Verification fails because the independent proof artifact is absent.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }]),
  });
  return result.spec;
}

function bindFixtureReceipt(root, value, feature = 'demo', session = 'test') {
  const context = PROVENANCE_HELPER.deriveRuntimeContext({
    projectRoot: root,
    specsRoot: path.join(root, 'specs'),
    specFile: path.join(root, 'specs', feature, 'spec.json'),
    featureName: feature,
    runtimeSession: session,
  });
  return value.replaceAll('0123456789abcdef0123456789abcdef01234567', context.base)
    .replaceAll('89abcdef0123456789abcdef0123456789abcdef', context.head);
}

function canonicalReceipt(command = 'pnpm test', extra = '') {
  return `Verification: PASS\nCommand: ${command}\nExit: 0\nBase: ${EXPECTED_BASE}\nHead: ${EXPECTED_HEAD}\n${extra}`;
}

function canonicalFlashTask(overrides = {}) {
  return {
    status: 'in_progress',
    receipt: 'FLASH_UNVERIFIED',
    blocker: 'awaiting /cf:test <feature>',
    dependencyBlocked: true,
    unblocks: false,
    feature_name: 'demo',
    runtime_context: RUNTIME_CONTEXT,
    expected_provenance: { ...EXPECTED_PROVENANCE },
    ...overrides,
  };
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function manifestAgents() {
  const manifest = JSON.parse(read(path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json')));
  return manifest.agents.required.map((fileName) => path.basename(fileName, path.extname(fileName)));
}

test('CLI rejects flash and parallel before any mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-policy-cli-'));
  const statePath = path.join(root, 'state.json');
  fs.writeFileSync(statePath, '{"status":"in_progress"}\n');
  const before = fs.readFileSync(statePath, 'utf8');
  try {
    const result = spawnSync(process.execPath, [POLICY_PATH, '--flash', '--parallel', '--json'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.failFast, true);
    assert.match(payload.message, /incompatible/);
    assert.equal(fs.readFileSync(statePath, 'utf8'), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('develop flags retain their process-v3 contracts', () => {
  const develop = read(DEVELOP);
  assert.match(develop, /node \.claude\/scripts\/workflow-policy\.cjs --flash --parallel --json/);
  assert.match(develop, /exits `2` before a task edit, receipt, worktree, subagent, or commit/i);
  assert.match(develop, /--notes` is opt-in/i);
  assert.match(develop, /implementation-notes-template\.html/);
  assert.match(develop, /Never create it by default/i);
  assert.match(develop, /--parallel \[N\][\s\S]*parallel-waves\.md[\s\S]*isolated worktrees[\s\S]*one controller writer/i);
  assert.match(develop, /--flash[\s\S]*Status: in_progress[\s\S]*FLASH_UNVERIFIED[\s\S]*awaiting \/cf:test <feature>/i);
  assert.match(develop, /FLASH_UNVERIFIED[\s\S]*do not unblock dependents[\s\S]*sync-finalize path/i);
});

test('delegation plan consumes legacy tiers as obligations without an agent chain', () => {
  const light = POLICY.delegationPlan({ tier: 'Light', mode: 'full-spec', taskCount: 2 });
  const standard = POLICY.delegationPlan({ tier: 'Standard', mode: 'specific-task' });
  const deep = POLICY.delegationPlan({ tier: 'Deep', mode: 'full-spec', taskCount: 2 });
  assert.deepEqual(light.proof_obligations, ['needsExecutionProof']);
  assert.deepEqual(standard.proof_obligations, ['needsExecutionProof']);
  assert.deepEqual(deep.proof_obligations, ['needsInspection', 'needsExecutionProof', 'needsIndependentAudit']);
  for (const plan of [light, standard, deep]) {
    assert.equal(Object.hasOwn(plan, 'delegated'), false);
    assert.doesNotMatch(JSON.stringify(plan), /inspector|implementer|test-runner|code-auditor/);
  }
  assert.doesNotMatch(read(GATE), /spec-review|quality-review/);
  assert.doesNotMatch(read(DEVELOP), /spec-review|quality-review/);
});

test('lane classifier selects Direct for explicit reversible low-risk work', () => {
  const result = POLICY.classifyLane({ reversible: true, lowRisk: true, isolated: true, taskCount: 1 });
  assert.equal(result.lane, 'Direct');
  assert.equal(result.automaticLane, 'Direct');
  assert.deepEqual(result.risks, []);
  const policy = POLICY.lanePolicy(result);
  assert.deepEqual(policy.proof_obligations, ['needsExecutionProof']);
  assert.equal(policy.artifact_profile, 'targeted');
  assert.equal(policy.requiresSpec, false);
  assert.equal(policy.requiresState, false);
  assert.equal(policy.proof_obligations.includes('needsDurableTaskState'), false);
});

test('lane classifier raises named risks to Elevated without inventing independent-audit authority', () => {
  const result = POLICY.classifyLane({
    reversible: true,
    riskSignals: { auth: true, migration: true, publicContract: true },
  });
  assert.equal(result.lane, 'Standard');
  assert.equal(result.assuranceLevel, 'Elevated');
  assert.equal(result.automaticAssuranceLevel, 'Elevated');
  assert.deepEqual(result.risks, ['auth', 'migration', 'publicContract']);
  assert.deepEqual(POLICY.lanePolicy(result).proof_obligations, [
    'needsInspection', 'needsExecutionProof',
  ]);

  const strict = POLICY.classifyLane({
    riskSignals: { auth: true },
    assurance_level: 'Strict',
  });
  assert.equal(strict.lane, 'Critical');
  assert.equal(strict.automaticLane, 'Standard');
  assert.equal(strict.assuranceLevel, 'Strict');
  assert.equal(strict.automaticAssuranceLevel, 'Elevated');
  assert.ok(POLICY.lanePolicy(strict).proof_obligations.includes('needsIndependentAudit'));
});

test('P1 persists the minimal v2.1 policy and derives compatibility views', () => {
  const initial = POLICY.persistWorkflowPolicySnapshot(
    { feature_name: 'bounded' },
    { riskSignals: {} },
  );
  const snapshot = initial.workflow_policy;
  assert.deepEqual(Object.keys(snapshot).sort(), [...POLICY.CANONICAL_WORKFLOW_POLICY_FIELDS].sort());
  assert.equal(snapshot.version, POLICY.CANONICAL_WORKFLOW_POLICY_VERSION);
  assert.equal(snapshot.planning_depth, 'Compact');
  assert.equal(snapshot.assurance_level, 'Routine');
  assert.deepEqual(snapshot.classified_minimum, {
    planning_depth: 'Compact',
    assurance_level: 'Routine',
  });
  for (const derivedField of ['lane', 'automatic_lane', 'artifact_profile', 'proof_obligations', 'actor_needs']) {
    assert.equal(Object.hasOwn(snapshot, derivedField), false, `${derivedField} must not be persisted`);
  }
  const view = POLICY.readWorkflowPolicySnapshot(initial);
  assert.equal(view.lane, 'Standard');
  assert.equal(view.automatic_lane, 'Standard');
  assert.equal(view.artifact_profile, 'bounded');
  assert.deepEqual(view.proof_obligations, ['needsExecutionProof']);
  assert.equal(Object.hasOwn(initial, 'override_' + 'receipt'), false);
  assert.equal(POLICY.validateWorkflowPolicySnapshot(snapshot).valid, true);

  const persistedAgain = POLICY.persistWorkflowPolicySnapshot(initial, {
    riskSignals: { auth: true },
    override: 'Direct',
  });
  assert.deepEqual(persistedAgain.workflow_policy, snapshot, 'persist-once must not reclassify an existing snapshot');

  const malformed = { ...snapshot, lane: 'Critical' };
  const validation = POLICY.validateWorkflowPolicySnapshot(malformed);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /v2\.1 fields must be exactly/);
  assert.throws(() => POLICY.readWorkflowPolicySnapshot({ workflow_policy: malformed }), /Invalid workflow policy snapshot/);

  const malformedShape = { ...snapshot, classified_minimum: { planning_depth: 'Compact' } };
  const shapeValidation = POLICY.validateWorkflowPolicySnapshot(malformedShape);
  assert.equal(shapeValidation.valid, false);
  assert.match(shapeValidation.errors.join('; '), /classified_minimum must contain exactly/);

  const malformedRisks = { ...snapshot, risks: { auth: true } };
  const risksValidation = POLICY.validateWorkflowPolicySnapshot(malformedRisks);
  assert.equal(risksValidation.valid, false);
  assert.match(risksValidation.errors.join('; '), /risks must be an array/);
});

test('P1 workflow-policy validation is semantic and explicit workflow_policy values never reclassify', () => {
  const direct = POLICY.workflowPolicySnapshot({ reversible: true, lowRisk: true, isolated: true });
  const standardUnknown = POLICY.escalateWorkflowPolicy(direct, { risks: ['unclassified-risk'] });
  const elevatedAuth = POLICY.workflowPolicySnapshot({ riskSignals: { auth: true } });
  const escalatedElevated = POLICY.escalateWorkflowPolicy(direct, { risks: ['auth'] });

  for (const legitimate of [direct, standardUnknown, elevatedAuth, escalatedElevated]) {
    assert.equal(POLICY.validateWorkflowPolicySnapshot(legitimate).valid, true);
  }
  assert.equal(escalatedElevated.lane, 'Standard');
  assert.equal(escalatedElevated.automatic_lane, 'Standard');
  assert.equal(escalatedElevated.planning_depth, 'None');
  assert.equal(escalatedElevated.assurance_level, 'Elevated');

  const forgedDirectAuth = { ...direct, risks: ['auth'] };
  const forgedDirectUnknown = { ...direct, risks: ['unclassified-risk'] };
  const forgedStandardAuth = { ...standardUnknown, risks: ['auth'] };
  for (const forged of [forgedDirectAuth, forgedDirectUnknown]) {
    const result = POLICY.validateWorkflowPolicySnapshot(forged);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('; '), /at least (Elevated|Strict)/);
  }
  assert.equal(
    POLICY.validateWorkflowPolicySnapshot(forgedStandardAuth).valid,
    true,
    'changing one normalized risk to another does not invent a higher assurance minimum',
  );
  for (const riskAlias of ['Auth', 'authentication', 'public_contract']) {
    const escalated = POLICY.escalateWorkflowPolicy(direct, { risks: [riskAlias] });
    assert.equal(escalated.lane, 'Standard', `${riskAlias} must classify as Elevated`);
    assert.equal(escalated.assurance_level, 'Elevated');
    assert.equal(POLICY.validateWorkflowPolicySnapshot({ ...direct, risks: [riskAlias] }).valid, false);
  }
  assert.throws(() => POLICY.assertWorkflowPolicySnapshot(forgedDirectAuth), /Invalid workflow policy snapshot/);
  assert.throws(() => POLICY.readWorkflowPolicySnapshot({ workflow_policy: forgedDirectAuth }), /Invalid workflow policy snapshot/);
  assert.throws(() => POLICY.lanePolicy({ workflow_policy: forgedDirectAuth }), /Invalid workflow policy snapshot/);

  for (const explicitValue of [null, undefined]) {
    const state = { workflow_policy: explicitValue, reversible: true, lowRisk: true, isolated: true };
    assert.throws(() => POLICY.workflowPolicySnapshot(state), /Invalid workflow policy snapshot/);
    assert.throws(() => POLICY.escalateWorkflowPolicy(state, {}), /Invalid workflow policy snapshot/);
    assert.throws(() => POLICY.lanePolicy(state), /Invalid workflow policy snapshot/);
  }

  const forgedLanePolicyCli = spawnSync(process.execPath, [
    POLICY_PATH,
    '--lane-policy',
    '--task-json',
    JSON.stringify({ workflow_policy: forgedDirectAuth }),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(forgedLanePolicyCli.status, 2, `${forgedLanePolicyCli.stdout}\n${forgedLanePolicyCli.stderr}`);
  assert.match(forgedLanePolicyCli.stderr, /Invalid workflow policy snapshot/);

  const nullLanePolicyCli = spawnSync(process.execPath, [
    POLICY_PATH,
    '--lane-policy',
    '--task-json',
    JSON.stringify({ workflow_policy: null, reversible: true, lowRisk: true, isolated: true }),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(nullLanePolicyCli.status, 2, `${nullLanePolicyCli.stdout}\n${nullLanePolicyCli.stderr}`);
  assert.match(nullLanePolicyCli.stderr, /Invalid workflow policy snapshot/);

  const validatePolicyCli = spawnSync(process.execPath, [
    POLICY_PATH,
    '--validate-policy',
    '--task-json',
    JSON.stringify({ workflow_policy: forgedDirectAuth }),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(validatePolicyCli.status, 2, `${validatePolicyCli.stdout}\n${validatePolicyCli.stderr}`);
  assert.equal(JSON.parse(validatePolicyCli.stdout).valid, false);

  const validateNullPolicyCli = spawnSync(process.execPath, [
    POLICY_PATH,
    '--validate-policy',
    '--task-json',
    JSON.stringify({ workflow_policy: null }),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(validateNullPolicyCli.status, 2, `${validateNullPolicyCli.stdout}\n${validateNullPolicyCli.stderr}`);
  assert.equal(JSON.parse(validateNullPolicyCli.stdout).valid, false);
});

test('P1 workflow policy escalation is monotonic across all newly classified risks', () => {
  const direct = POLICY.workflowPolicySnapshot({ reversible: true, lowRisk: true, isolated: true });
  assert.equal(direct.lane, 'Direct');
  assert.deepEqual(POLICY.escalateWorkflowPolicy(direct, {}), direct, 'no new risks must not escalate');

  const standard = POLICY.escalateWorkflowPolicy(direct, { risks: ['new-standard-risk'], riskLevel: 'standard' });
  assert.equal(standard.lane, 'Standard');
  assert.equal(standard.artifact_profile, 'targeted');
  assert.equal(standard.planning_depth, 'None');
  assert.equal(standard.assurance_level, 'Elevated');
  assert.equal(standard.risks.includes('new-standard-risk'), true);
  assert.deepEqual(standard.proof_obligations, ['needsInspection', 'needsExecutionProof']);

  const ambiguityElevated = POLICY.escalateWorkflowPolicy(direct, { riskSignals: { ambiguity: true } });
  assert.equal(ambiguityElevated.lane, 'Standard', 'risk discovery must require inspection without inventing an audit');
  assert.equal(ambiguityElevated.assurance_level, 'Elevated');

  const criticalSeverity = POLICY.escalateWorkflowPolicy(direct, { risks: ['payment'], riskLevel: 'critical' });
  assert.equal(criticalSeverity.assurance_level, 'Elevated', 'severity labels must not create independent-audit authority');
  assert.equal(criticalSeverity.proof_obligations.includes('needsIndependentAudit'), false);

  const critical = POLICY.escalateWorkflowPolicy(standard, { risks: ['auth'], assurance_level: 'Strict' });
  assert.equal(critical.lane, 'Critical');
  assert.equal(critical.artifact_profile, 'targeted');
  assert.equal(critical.planning_depth, 'None');
  assert.equal(critical.assurance_level, 'Strict');
  assert.equal(critical.automatic_assurance_level, 'Elevated');
  assert.equal(critical.proof_obligations.includes('needsIndependentAudit'), true);
  assert.equal(critical.proof_obligations.includes('needsResearchGrounding'), false);

  const noDowngrade = POLICY.escalateWorkflowPolicy(critical, { risks: ['another-standard-risk'], riskLevel: 'standard' });
  assert.equal(noDowngrade.lane, 'Critical');
  assert.equal(noDowngrade.proof_obligations.includes('needsIndependentAudit'), true);
  assert.equal(noDowngrade.proof_obligations.includes('needsResearchGrounding'), false);

  const criticalAgain = POLICY.escalateWorkflowPolicy(critical, { risks: ['auth'] });
  assert.deepEqual(criticalAgain, critical, 'repeating known risks must not create a new escalation');
});

test('P1 legacy execution tier is read-compatible without becoming emitted policy authority', () => {
  const legacy = { design_context: { execution_tier: 'Deep' } };
  const snapshot = POLICY.workflowPolicySnapshot(legacy);
  assert.equal(snapshot.lane, 'Critical');
  assert.equal(snapshot.artifact_profile, 'strict');
  const policy = POLICY.lanePolicy(legacy);
  assert.equal(policy.lane, 'Critical');
  assert.equal(Object.hasOwn(policy, 'execution_tier'), false);
  assert.equal(Object.hasOwn(policy, 'executionTier'), false);
  const legacyPlan = POLICY.delegationPlan({ tier: 'Deep' });
  assert.equal(Object.hasOwn(legacyPlan, 'execution_tier'), false);
  assert.equal(Object.hasOwn(legacyPlan, 'executionTier'), false);
  assert.deepEqual(legacyPlan.proof_obligations, snapshot.proof_obligations);
  assert.equal(POLICY.workflowPolicySnapshot({ design_context: { execution_tier: 'standard' } }).lane, 'Standard');
});

test('legacy v1 policy is read-compatible, immutable on read, and explicitly migrates to v2.1', () => {
  const cases = [
    { lane: 'Direct', risks: [], obligations: ['needsExecutionProof'] },
    { lane: 'Standard', risks: [], obligations: ['needsInspection', 'needsExecutionProof'] },
    { lane: 'Critical', risks: ['auth'], obligations: ['needsInspection', 'needsExecutionProof', 'needsIndependentAudit', 'needsResearchGrounding'] },
  ];
  for (const fixture of cases) {
    const v1 = {
      version: '1',
      lane: fixture.lane,
      automatic_lane: fixture.lane,
      risks: fixture.risks,
      artifact_profile: { Direct: 'targeted', Standard: 'bounded', Critical: 'strict' }[fixture.lane],
      proof_obligations: fixture.obligations,
      actor_needs: POLICY.actorNeedsFor(fixture.obligations),
      override_receipt: null,
    };
    assert.equal(POLICY.validateWorkflowPolicySnapshot(v1).valid, true, fixture.lane);
    const source = { feature_name: `legacy-${fixture.lane}`, workflow_policy: v1 };
    const before = JSON.stringify(source);
    const adapted = POLICY.readWorkflowPolicySnapshot(source);
    assert.equal(adapted.version, '2');
    assert.deepEqual(adapted.proof_obligations, fixture.obligations, fixture.lane);
    assert.deepEqual(adapted.actor_needs, v1.actor_needs, fixture.lane);
    assert.equal(POLICY.validateWorkflowPolicySnapshot(adapted).valid, true, fixture.lane);
    assert.equal(JSON.stringify(source), before, 'read adapter must not mutate persisted v1 state');
    const migrated = POLICY.persistWorkflowPolicySnapshot(source).workflow_policy;
    assert.equal(migrated.version, POLICY.CANONICAL_WORKFLOW_POLICY_VERSION);
    assert.deepEqual(Object.keys(migrated).sort(), [...POLICY.CANONICAL_WORKFLOW_POLICY_FIELDS].sort());
    const migratedView = POLICY.readWorkflowPolicySnapshot({ workflow_policy: migrated });
    assert.equal(migratedView.lane, adapted.lane, fixture.lane);
    assert.equal(migratedView.artifact_profile, adapted.artifact_profile, fixture.lane);
    assert.deepEqual(migratedView.proof_obligations, POLICY.obligationsForAssurance(
      migrated.assurance_level,
      migrated.risks,
    ), fixture.lane);
  }
});

test('post-classification downgrade is unsupported', () => {
  assert.throws(
    () => POLICY.classifyLane({ riskSignals: { privacy: true }, override: 'Direct' }),
    (error) => /planning_depth downgrade/.test(error.message) && /not permitted/.test(error.message),
  );
});

test('caller-requested downgrade is blocked before persistence', () => {
  assert.throws(
    () => POLICY.classifyLane({ riskSignals: { privacy: true }, override: 'Direct' }),
    (error) => /planning_depth downgrade/.test(error.message) && /not permitted/.test(error.message),
  );
  // also via CLI
  const cli = spawnSync(process.execPath, [
    POLICY_PATH,
    '--classify-lane',
    '--task-json',
    JSON.stringify({ riskSignals: { auth: true }, override: 'Direct' }),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /planning_depth downgrade.*not permitted/i);
});

test('forged approval via legacy approved field is rejected', () => {
  assert.throws(() => POLICY.approvalState({ generated: true, approved: true }), /Legacy approval state/);
  const cli = spawnSync(process.execPath, [
    POLICY_PATH,
    '--approval-state',
    '--task-json',
    JSON.stringify({ generated: true, approved: true }),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /Legacy approval state/);
  const legacyCheck = POLICY.validateApprovalSchema({ approvals: { requirements: { generated: true, approved: true } } });
  assert.equal(legacyCheck.valid, false);
  assert.equal(legacyCheck.legacy, true);
  assert.match(legacyCheck.error, /Legacy/);
});

test('technical approval readiness ignores legacy user_approved', () => {
  const state = POLICY.approvalState({ generated: true, agent_validated: true });
  assert.equal(state.generated, true);
  assert.equal(state.agent_validated, true);
  assert.equal(state.ready, true);
  assert.equal(state.schema_version, '2.0');
  assert.equal(POLICY.approvalState({ generated: true, agent_validated: true, user_approved: true }).ready, true);
  assert.equal(POLICY.approvalState({ generated: true, agent_validated: true, user_approved: false }).ready, true);
  const cli = spawnSync(process.execPath, [
    POLICY_PATH,
    '--approval-state',
    '--task-json',
    JSON.stringify({ generated: true, agent_validated: true }),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
  assert.equal(JSON.parse(cli.stdout).state.ready, true);
});

test('approval schema fails closed for explicit null, array, empty, and malformed states', () => {
  const absent = POLICY.validateApprovalSchema({});
  assert.equal(absent.valid, true);
  assert.equal(absent.absent, true);
  assert.equal(POLICY.approvalState({}).present, false);

  const invalidSpecs = [
    [],
    { approvals: null },
    { approvals: [] },
    { approvals: {} },
    { approvals: { requirements: null } },
    { approvals: { requirements: { generated: true, agent_validated: true, user_approved: null } } },
    { approvals: { requirements: { generated: true, agent_validated: true, user_approved: true, extra: false } } },
  ];
  for (const spec of invalidSpecs) {
    assert.equal(POLICY.validateApprovalSchema(spec).valid, false, `invalid approval should fail: ${JSON.stringify(spec)}`);
    assert.throws(() => POLICY.approvalState(spec), /approval|approvals|schema/i);
  }
  assert.throws(() => POLICY.approvalState({ schema_version: null }), /schema_version/);
  assert.throws(() => POLICY.approvalState({ schema_version: '1.0' }), /schema_version/);
});

test('CLI exposes a derived lane without making it primary Develop authority', () => {
  const cli = spawnSync(process.execPath, [
    POLICY_PATH,
    '--classify-lane',
    '--task-json',
    JSON.stringify({ reversible: true, lowRisk: true, isolated: true }),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
  const payload = JSON.parse(cli.stdout);
  assert.equal(payload.classification.lane, 'Direct');
  assert.equal(payload.policy.requiresSpec, false);
  const develop = read(DEVELOP);
  const regions = markdownLegacyRegions(develop);
  assert.doesNotMatch(develop, /DO NOT write implementation code until an approved spec exists/i);
  assert.doesNotMatch(regions.primary, /planning_depth|assurance_level|execution_tier|\blane\b/i);
  assert.match(regions.legacy, /planning_depth/);
  assert.match(regions.legacy, /assurance_level/);
  assert.match(regions.legacy, /execution_tier/);
  assert.match(regions.legacy, /derived lane/i);
  assert.match(regions.primary, /specs\/<feature>\/plan\.md[\s\S]*task-NN-\*\.md/i);
  assert.match(regions.primary, /one unblocked task at a time/i);
  assert.match(regions.primary, /Verification Plan/);
  assert.match(regions.primary, /inline Receipt/i);
  assert.doesNotMatch(develop, /D2\[Step 3/);
  assert.match(develop, /--notes.*opt-in/i);
  assert.doesNotMatch(develop, /--no-notes/);
  assert.doesNotMatch(develop, /planner|implementer|test-runner|code-auditor|docs-keeper/i);
  const fullRoutine = POLICY.readWorkflowPolicySnapshot({
    workflow_policy: POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Full', assurance_level: 'Routine' }),
  });
  const compactStrict = POLICY.readWorkflowPolicySnapshot({
    workflow_policy: POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Strict' }),
  });
  assert.equal(fullRoutine.planning_depth, 'Full');
  assert.equal(fullRoutine.assurance_level, 'Routine');
  assert.equal(compactStrict.planning_depth, 'Compact');
  assert.equal(compactStrict.assurance_level, 'Strict');
  assert.notEqual(fullRoutine.artifact_profile, compactStrict.artifact_profile);
  assert.notDeepEqual(fullRoutine.proof_obligations, compactStrict.proof_obligations);
});

test('Specs primary output is a flat process-first packet with isolated legacy compatibility', () => {
  const specs = read(SPECS);
  const regions = markdownLegacyRegions(specs);
  const legacyHeadings = regions.headings.filter(({ text }) => /legacy/i.test(text));
  assert.equal(legacyHeadings.length, 1);
  assert.match(regions.primary, /specs\/<feature>\/[\s\S]*plan\.md[\s\S]*task-01-<slug>\.md[\s\S]*task-02-<slug>\.md/i);
  assert.match(regions.primary, /Task files are flat beside `plan\.md`/i);
  assert.match(regions.primary, /one task at a time/i);
  assert.match(regions.primary, /inline `## Receipt`/i);
  assert.match(regions.primary, /GATE-SCOPE[\s\S]*GATE-REVIEW[\s\S]*GATE-DONE/i);
  assert.match(regions.legacy, /spec\.json/i);
  assert.match(regions.legacy, /never requires the legacy kernel/i);
  assertVocabularyIsLegacyOnly(SPECS, regions);
});

test('core execution agents default to process-first state and isolate legacy packets', () => {
  for (const filePath of PROCESS_FIRST_AGENTS) {
    const content = read(filePath);
    const name = path.basename(filePath);
    assert.match(content, /plan\.md/i, `${name} must read the process-first plan`);
    assert.match(content, /task-NN-\*\.md|task-NN-<slug>\.md/i, `${name} must understand flat tasks`);
    assert.match(content, /legacy/i, `${name} must isolate legacy compatibility`);
  }

  const implementer = read(PROCESS_FIRST_AGENTS[0]);
  assert.match(implementer, /Under every dispatch mode[\s\S]{0,160}do NOT edit[\s\S]{0,80}`plan\.md`[\s\S]{0,80}`Status:`[\s\S]{0,80}`## Receipt`/i);
  assert.match(implementer, /controller/i);
  assert.match(implementer, /process-first work[\s\S]{0,100}Ownership[\s\S]{0,100}`Related Files` only for a valid legacy adapter/i);

  const auditor = read(PROCESS_FIRST_AGENTS[2]);
  assert.match(auditor, /accepted GATE-SCOPE\/GATE-REVIEW decisions/i);
  assert.match(auditor, /Only for a valid legacy adapter[\s\S]*`Related Files`[\s\S]*`## Evidence`/i);
  assert.match(auditor, /Never require those legacy artifacts from a[\s\S]*process-first packet/i);
  assert.match(auditor, /attestation belongs only to the valid legacy/i);

  const docsKeeper = read(PROCESS_FIRST_AGENTS[3]);
  assert.match(docsKeeper, /never[\s\S]{0,80}invent or write Status, Receipt, approval, or execution proof/i);

  const deployer = read(PROCESS_FIRST_AGENTS[4]);
  assert.match(deployer, /current final inline Receipt/i);
  assert.match(deployer, /GATE-DONE\/release authorization/i);
  assert.match(deployer, /does not write process-first Status\/Receipt/i);
});

test('R7 Develop and Sync surfaces teach process-v3 and isolate hierarchical Legacy sections', () => {
  const surfaces = [
    ['develop', DEVELOP],
    ['parallel waves', PARALLEL_WAVES],
    ['sync', SYNC_SKILL],
    ['sync protocols', SYNC_PROTOCOLS],
  ];
  const regionsByName = new Map();
  let legacyCorpus = '';

  for (const [name, filePath] of surfaces) {
    const regions = markdownLegacyRegions(read(filePath));
    const legacyHeadings = regions.headings.filter(({ text }) => /legacy/i.test(text));
    assert.equal(legacyHeadings.length, 1, `${name} must have exactly one Legacy heading`);
    assert.match(regions.primary, /inline (?:`## )?Receipts?/i, `${name} must teach inline Receipts`);
    assert.match(regions.legacy, /spec\.json/i, `${name} must retain the spec.json adapter`);
    assert.match(regions.legacy, /task_registry/i, `${name} must retain task_registry compatibility`);
    assertVocabularyIsLegacyOnly(filePath, regions);
    regionsByName.set(name, regions);
    legacyCorpus += `\n${regions.legacy}`;
  }

  const develop = regionsByName.get('develop').primary;
  assert.match(develop, /`specs\/<feature>\/plan\.md` plus flat `task-NN-\*\.md`/i);
  assert.match(develop, /one unblocked task at a time/i);
  assert.match(develop, /Outcome and Acceptance/i);
  assert.match(develop, /Verification Plan/);
  assert.match(develop, /final inline `## Receipt`/i);

  const sync = regionsByName.get('sync').primary;
  assert.match(sync, /<task-NN-slug\.md>/i);
  assert.match(sync, /specs\/<feature>\/task-\*\.md` beside `plan\.md`/i);
  assert.match(sync, /Acceptance[\s\S]*Verification Plan/i);
  assert.match(sync, /current inline Receipt/i);

  const waves = regionsByName.get('parallel waves').primary;
  assert.match(waves, /dependencies from the plan table and each task/i);
  assert.match(waves, /acceptance, proof command/i);
  assert.match(waves, /one file has one writer per wave/i);
  assert.match(waves, /writes inline Receipts and Status one task at a time/i);

  const protocols = regionsByName.get('sync protocols').primary;
  assert.match(protocols, /`plan\.md` and flat `task-\*\.md` files/i);
  assert.match(protocols, /acceptance IDs/i);
  assert.match(protocols, /current inline Receipt/i);
  assert.match(legacyCorpus, /sync-finalize/i);
});

test('Develop process-first source contract preserves selection, recovery, final-Head, parallel, and Flash boundaries', () => {
  const develop = markdownLegacyRegions(read(DEVELOP)).primary;
  const quality = read(GATE);
  const waves = markdownLegacyRegions(read(PARALLEL_WAVES)).primary;
  const dispatch = read(path.join(path.dirname(PARALLEL_WAVES), 'subagent-patterns.md'));

  for (const clause of [
    /first dependency-valid `pending` row in `plan\.md` order/i,
    /Specific-task\s+mode never touches a sibling/i,
    /More than one `in_progress`/i,
    /For an interrupted `in_progress` task/i,
    /only the controller writes Status or Receipt/i,
    /do not research, replan, or add a routine user gate/i,
  ]) assert.match(develop, clause);
  assert.match(quality, /consecutive Head captures are identical/i);
  assert.match(quality, /skip, skipped, todo, cancel, canceled, cancelled/i);
  assert.match(quality, /exact command, current Head, required proof level, oracle/i);
  assert.match(waves, /every commit[\s\S]*complete changed tree/i);
  assert.match(waves, /handoff metadata cannot substitute/i);
  assert.match(develop, /later explicit non-Flash invocation may recover/i);
  assert.match(dispatch, /controller alone writes Status and inline Receipt/i);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-plan-native-'));
  try {
    const featureDir = path.join(root, 'specs', 'ordered');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Ordered\nSpecs-Contract: process-first-ready-v1\n');
    const task = (status, dependencies, receipt = '<!-- Fill only after execution. -->') =>
      `# Task\n\nStatus: ${status}\n\n## Dependencies\n\n${dependencies}\n\n## Verification Plan\n\n- Command: \`node --test\`\n\n## Receipt\n\n${receipt}\n`;
    fs.writeFileSync(path.join(featureDir, 'task-01-first.md'), task('pending', '- none'));
    fs.writeFileSync(path.join(featureDir, 'task-02-second.md'), task('pending', '- task-01-first.md'));
    initFixtureGit(root);

    let candidate = RESOLVER.resolveWorkflowCandidate({ projectRoot: root, explicitFeature: 'ordered' });
    assert.equal(candidate.queueReady, true);
    assert.deepEqual(Object.keys(candidate.taskRegistry), ['task-01-first.md', 'task-02-second.md']);
    let runtime = PROVENANCE_HELPER.deriveRuntimeContext({
      projectRoot: root, specsRoot: path.join(root, 'specs'), specFile: candidate.planFile,
      featureName: 'ordered', runtimeSession: 'plan-native-test',
    });
    const preMutationHead = runtime.head;
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.js'), 'later worktree mutation\n');
    runtime = PROVENANCE_HELPER.deriveRuntimeContext({
      projectRoot: root, specsRoot: path.join(root, 'specs'), specFile: candidate.planFile,
      featureName: 'ordered', runtimeSession: 'plan-native-test',
    });
    assert.notEqual(runtime.head, preMutationHead, 'a later non-Spec mutation must stale the earlier Head');
    const stableRuntime = PROVENANCE_HELPER.deriveRuntimeContext({
      projectRoot: root, specsRoot: path.join(root, 'specs'), specFile: candidate.planFile,
      featureName: 'ordered', runtimeSession: 'plan-native-test',
    });
    assert.equal(stableRuntime.head, runtime.head, 'unchanged consecutive captures must reach a fixed point');
    let dependencies = RECEIPTS.workflowDependencyProofState(featureDir, candidate.taskRegistry, runtime, POLICY);
    assert.equal(dependencies['task-01-first.md'].eligible, false);

    const receipt = `Verification: PASS\nCommand: node --test\nExit: 0\nBase: ${runtime.base}\nHead: ${runtime.head}\n\n\`\`\`text\n1 test passed\n\`\`\``;
    fs.writeFileSync(path.join(featureDir, 'task-01-first.md'), task('done', '- none', receipt));
    candidate = RESOLVER.resolveWorkflowCandidate({ projectRoot: root, explicitFeature: 'ordered' });
    runtime = PROVENANCE_HELPER.deriveRuntimeContext({
      projectRoot: root, specsRoot: path.join(root, 'specs'), specFile: candidate.planFile,
      featureName: 'ordered', runtimeSession: 'plan-native-test',
    });
    assert.deepEqual(RECEIPTS.checkWorkflowTaskReceipt(
      featureDir, 'task-01-first.md', runtime, POLICY,
    ).failures, []);
    dependencies = RECEIPTS.workflowDependencyProofState(featureDir, candidate.taskRegistry, runtime, POLICY);
    assert.equal(dependencies['task-01-first.md'].eligible, true);
    assert.equal(candidate.taskRegistry['task-02-second.md'].dependencies[0], 'task-01-first.md');

    fs.writeFileSync(path.join(featureDir, 'task-01-first.md'), task('in_progress', '- none'));
    fs.writeFileSync(path.join(featureDir, 'task-02-second.md'), task('in_progress', '- task-01-first.md'));
    candidate = RESOLVER.resolveWorkflowCandidate({ projectRoot: root, explicitFeature: 'ordered' });
    assert.equal(Object.values(candidate.taskRegistry).filter(({ status }) => status === 'in_progress').length, 2);

    fs.writeFileSync(path.join(featureDir, 'task-01-first.md'), task('paused', '- none'));
    fs.writeFileSync(path.join(featureDir, 'task-02-second.md'), task('blocked', '- task-01-first.md'));
    candidate = RESOLVER.resolveWorkflowCandidate({ projectRoot: root, explicitFeature: 'ordered' });
    assert.equal(candidate.taskRegistry['task-01-first.md'].status, 'paused');
    assert.equal(candidate.taskRegistry['task-02-second.md'].status, 'blocked');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Claude installed Develop preserves plan-native execution and references', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-claude-develop-'));
  try {
    const result = installClaude(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const sourceRoot = path.dirname(DEVELOP);
    const installedRoot = path.join(root, '.claude/skills/develop');
    for (const relative of ['SKILL.md', ...DEVELOP_REFERENCES.map((name) => `references/${name}`)]) {
      assert.equal(
        fs.readFileSync(path.join(installedRoot, relative), 'utf8'),
        fs.readFileSync(path.join(sourceRoot, relative), 'utf8'),
        `Claude Develop projection drifted: ${relative}`,
      );
    }
    assert.equal(fs.existsSync(path.join(root, '.agents/skills/develop')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Test process-first handoff preserves proof ownership and side-effect boundaries', () => {
  const skill = read(TEST_SKILL);
  const strategy = read(path.join(TEST_SOURCE_ROOT, 'references/execution-strategy.md'));
  const runner = read(TEST_RUNNER);
  const review = read(CODE_REVIEW_SKILL);
  const developConsumers = [read(DEVELOP), read(GATE), read(path.join(
    path.dirname(PARALLEL_WAVES), 'subagent-patterns.md',
  ))].join('\n');

  const exactKeys = [
    'schema_version', 'target', 'verdict', 'command', 'exit', 'counts',
    'provenance', 'proof_level', 'expected', 'observed', 'reachability',
    'artifacts', 'branches', 'raw_output', 'redactions', 'payload_sha256',
  ];
  for (const key of exactKeys) assert.match(strategy, new RegExp(`\\b${key}\\b`));
  const developHandoffFields = new Map([
    ['command', /Verification handoff separately contains the fresh command/i],
    ['exit', /fresh command, exit/i],
    ['branches', /named probes/i],
    ['counts', /counts, output/i],
    ['raw_output', /counts, output/i],
    ['provenance', /observed Head/i],
    ['reachability', /runtime reachability/i],
    ['proof_level', /required proof level/i],
  ]);
  for (const [field, sourceClause] of developHandoffFields) {
    assert.match(developConsumers, sourceClause, `Develop must currently consume ${field}`);
    assert.ok(exactKeys.includes(field), `test-proof-v1 must preserve Develop field ${field}`);
  }
  assert.match(runner, /Emit only `schema_version: "test-proof-v1"`/);
  assert.match(runner, /sole writer of[\s\S]*Status and inline Receipt/i);
  assert.match(review, /consume only the controller-validated[\s\S]*`test-proof-v1`[\s\S]*handoff/i);
  assert.match(review, /Never create or search for a separate[\s\S]*process-first receipt/i);
  assert.doesNotMatch([skill, strategy, runner].join('\n'), /npm\s+install|inject-auth\.js|--cookies\s|Bearer eyJ/);

  const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  };
  const proof = {
    schema_version: 'test-proof-v1',
    target: { feature: 'fixture', task_path: 'specs/fixture/task-01-proof.md' },
    verdict: 'PASS', command: 'node --test', exit: 0,
    counts: { executed: 1, passed: 1, failed: 0, skipped: 0 },
    provenance: { base: 'a'.repeat(40), head: 'b'.repeat(64) },
    proof_level: 'source', expected: 'named probe passes', observed: 'named probe passed',
    reachability: { status: 'PASS', evidence: ['test-runner -> controller'] },
    artifacts: [],
    branches: [{
      id: 'fixture named probe', required: true, verdict: 'PASS', command: 'node --test',
      exit: 0, counts: { executed: 1, passed: 1, failed: 0, skipped: 0 },
      proof_level: 'source',
    }],
    raw_output: '1 test passed', redactions: [],
  };
  proof.payload_sha256 = crypto.createHash('sha256').update(stable(proof)).digest('hex');
  assert.deepEqual(Object.keys(proof).sort(), exactKeys.slice().sort());
  assert.match(proof.payload_sha256, /^[a-f0-9]{64}$/);
  assert.equal(proof.counts.executed, proof.branches.reduce(
    (sum, branch) => sum + branch.counts.executed, 0,
  ));

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-test-proof-side-effects-'));
  const absentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-test-proof-memory-absent-'));
  const externalTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-test-owned-'));
  try {
    fs.mkdirSync(path.join(root, '.hapo'), { recursive: true });
    const memory = path.join(root, '.hapo/test-memory.json');
    fs.writeFileSync(memory, '{"known_issues":[]}\n');
    fs.writeFileSync(path.join(root, '.gitignore'), 'ignored-proof-state/\n');
    fs.writeFileSync(path.join(root, 'tracked.js'), 'before\n');
    initFixtureGit(root);
    const memoryBefore = crypto.createHash('sha256').update(fs.readFileSync(memory)).digest('hex');
    const command = spawnSync(process.execPath, ['-e', [
      "const fs=require('node:fs');",
      "fs.appendFileSync('tracked.js','after\\n');",
      "fs.writeFileSync('untracked-proof.txt','created by project command\\n');",
      "fs.mkdirSync('ignored-proof-state',{recursive:true});",
      "fs.writeFileSync('ignored-proof-state/output.txt','project output\\n');",
      "console.log('tests 1\\npass 1\\nfail 0\\nskipped 0');",
    ].join('')], { cwd: root, encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr);
    assert.match(command.stdout, /tests 1/);
    const drift = spawnSync('git', [
      '-C', root, 'status', '--porcelain=v1', '--ignored', '--untracked-files=all',
    ], { encoding: 'utf8' });
    assert.equal(drift.status, 0, drift.stderr);
    assert.match(drift.stdout, / M tracked\.js/);
    assert.match(drift.stdout, /\?\? untracked-proof\.txt/);
    assert.match(drift.stdout, /!! ignored-proof-state\//);
    const memoryAfter = crypto.createHash('sha256').update(fs.readFileSync(memory)).digest('hex');
    assert.equal(memoryAfter, memoryBefore, 'present Test memory must stay byte-identical');
    for (const relative of ['test-report.md', 'test-cache', 'test-auth.json']) {
      assert.equal(fs.existsSync(path.join(root, '.hapo', relative)), false, `${relative} must stay absent`);
    }
    assert.equal(fs.existsSync(path.join(root, 'node_modules')), false, 'project-local lazy install must stay absent');

    const absentMemory = path.join(absentRoot, '.hapo/test-memory.json');
    assert.equal(fs.existsSync(absentMemory), false);
    const noop = spawnSync(process.execPath, ['-e', "console.log('tests 1; pass 1')"], {
      cwd: absentRoot, encoding: 'utf8',
    });
    assert.equal(noop.status, 0, noop.stderr);
    assert.equal(fs.existsSync(absentMemory), false, 'absent Test memory must stay absent');

    fs.writeFileSync(path.join(externalTemp, 'ephemeral.txt'), 'proof temp\n');
  } finally {
    fs.rmSync(externalTemp, { recursive: true, force: true });
    fs.rmSync(absentRoot, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(fs.existsSync(externalTemp), false, 'Test-owned external temp must be cleaned');
});

test('Claude installed Test preserves plan-native proof and references', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-claude-test-proof-'));
  try {
    const result = installClaude(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const installedRoot = path.join(root, '.claude/skills/test');
    for (const relative of ['SKILL.md', ...TEST_REFERENCES.map((name) => `references/${name}`)]) {
      assert.equal(
        fs.readFileSync(path.join(installedRoot, relative), 'utf8'),
        fs.readFileSync(path.join(TEST_SOURCE_ROOT, relative), 'utf8'),
        `Claude Test projection drifted: ${relative}`,
      );
    }
    const installedRunner = fs.readFileSync(path.join(root, '.claude/agents/test-runner.md'), 'utf8');
    assert.equal(installedRunner, fs.readFileSync(TEST_RUNNER, 'utf8'));
    assert.match(installedRunner, /test-proof-v1/);
    const installedReview = fs.readFileSync(path.join(root, '.claude/skills/code-review/SKILL.md'), 'utf8');
    assert.equal(installedReview, fs.readFileSync(CODE_REVIEW_SKILL, 'utf8'));
    assert.match(installedReview, /controller-validated `test-proof-v1`/);
    assert.match(installedReview, /Do not load or follow legacy separate-receipt paragraphs/i);
    assert.equal(fs.existsSync(path.join(root, '.agents/skills/test')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('specs-usage-guide documents Test proof handoff without timing claims', () => {
  const guide = read(SPECS_USAGE_GUIDE);
  const section = guide.split('## Test proof handoff')[1]?.split('### Receipt canonical')[0] || '';
  assert.match(section, /`test-proof-v1`/);
  assert.match(section, /Test không ghi `Status:` hay inline[\s\S]*Develop controller là writer duy nhất/i);
  assert.match(section, /tracked\/untracked\/ignored drift/i);
  assert.match(section, /HTTPS\/localhost origin[\s\S]*fresh consent/i);
  assert.match(section, /separate-receipt adapter/i);
  assert.match(section, /không phải benchmark thời gian/i);
  assert.match(section, /không chứng minh live adherence/i);
  assert.doesNotMatch(section, /\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|minutes?)\b/i);
  assert.doesNotMatch(section, /\[(?:LIVE_)?VERIFIED\]/i);
});

test('canonical verdict adapter handles completion and unfinished decisions', () => {
  assert.deepEqual(POLICY.REVIEW_VERDICTS, ['PASS', 'PASS_WITH_WARNINGS', 'FAIL', 'BLOCKED']);
  assert.doesNotThrow(() => POLICY.assertVerdict('PASS_WITH_WARNINGS'));
  assert.throws(() => POLICY.assertVerdict('PARTIAL'), /Unsupported canonical verdict/);
  assert.equal(POLICY.consumeReviewVerdict('PASS').completion, 'unfinished');
  assert.equal(POLICY.consumeReviewVerdict('PASS').unfinished, true);
  assert.equal(POLICY.consumeReviewVerdict('PASS').createsCompletion, false);
  assert.equal(POLICY.consumeReviewVerdict('PASS_WITH_WARNINGS').unfinished, true);
  assert.equal(POLICY.consumeReviewVerdict('FAIL').retry, true);
  assert.equal(POLICY.consumeReviewVerdict('BLOCKED').retry, false);
  assert.equal(POLICY.consumeReviewVerdict('BLOCKED').unfinished, true);
  assert.equal(POLICY.consumeReviewVerdict('PARTIAL').completion, 'unfinished');
  assert.equal(POLICY.consumeReviewVerdict('NO_TESTS').completion, 'unfinished');
  assert.equal(POLICY.consumeReviewVerdict('PARTIAL').verdict, 'BLOCKED');
  assert.equal(POLICY.consumeReviewVerdict('NO_TESTS').verdict, 'BLOCKED');
  assert.equal(POLICY.consumeReviewVerdict('PARTIAL').retry, false);
  assert.equal(POLICY.consumeReviewVerdict('NO_TESTS').retry, false);
  assert.throws(() => POLICY.consumeReviewVerdict('UNKNOWN'), /Unsupported canonical verdict/);
  const cli = spawnSync(process.execPath, [POLICY_PATH, '--consume-verdict', '--verdict', 'BLOCKED', '--json'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
  assert.deepEqual(JSON.parse(cli.stdout).action, 'stop');
  assert.match(read(GATE), /PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED/);
  assert.match(read(CODE_REVIEW_SKILL), /PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED/);
  assert.match(read(TEST_SKILL), /PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED/);
});

test('completion decision requires canonical execution receipt and every workflow obligation', () => {
  const receipt = canonicalReceipt();
  const critical = POLICY.workflowPolicySnapshot({ riskSignals: { auth: true }, assurance_level: 'Strict' });
  const audit = {
    schema_version: '1',
    reviewer_session_id: 'review-session-1',
    implementation_session_id: 'implementation-session-1',
    expected_provenance: { ...EXPECTED_PROVENANCE },
    evidence: 'independent audit report for the bound change',
    verdict: 'PASS',
  };
  const missing = POLICY.completionDecision('PASS', {
    workflow_policy: critical,
    receipt_binding: RECEIPT_BINDING,
    execution_receipt: receipt,
    proofs: {
      needsInspection: { evidence: 'inspection receipt' },
      needsResearchGrounding: { evidence: 'research receipt' },
    },
  });
  assert.equal(missing.completion, 'unfinished');
  assert.ok(missing.missingProof.includes('needsIndependentAudit'));
  assert.equal(missing.unfinished, true);

  const complete = POLICY.completionDecision('PASS', {
    workflow_policy: critical,
    receipt_binding: RECEIPT_BINDING,
    execution_receipt: receipt,
    proofs: {
      needsInspection: { evidence: 'inspection receipt' },
      needsResearchGrounding: { evidence: 'research receipt' },
      needsIndependentAudit: audit,
    },
  });
  assert.equal(complete.completion, 'complete');
  assert.equal(complete.unfinished, false);
  assert.equal(complete.warnings, undefined);
  const warnings = POLICY.completionDecision('PASS_WITH_WARNINGS', {
    workflow_policy: critical,
    receipt_binding: RECEIPT_BINDING,
    execution_receipt: receipt,
    proofs: {
      needsInspection: { evidence: 'inspection receipt' },
      needsResearchGrounding: { evidence: 'research receipt' },
      needsIndependentAudit: audit,
    },
  });
  assert.equal(warnings.completion, 'unfinished');
  assert.equal(warnings.unfinished, true);
  assert.match(warnings.blocker, /literal PASS/);
  assert.equal(POLICY.completionDecision('PASS', {
    workflow_policy: { proof_obligations: ['needsExecutionProof'] },
    receipt_binding: RECEIPT_BINDING,
    execution_receipt: receipt,
  }).completion, 'unfinished');
  assert.equal(POLICY.completionDecision('PASS', {
    workflow_policy: {},
    receipt_binding: RECEIPT_BINDING,
    execution_receipt: receipt,
  }).completion, 'unfinished');
  assert.equal(POLICY.completionDecision('PASS', {
    workflow_policy: critical,
    execution_receipt: receipt,
  }).completion, 'unfinished', 'arbitrary Base/Head without runtime binding must not complete');
  assert.equal(POLICY.completionDecision('PASS', {
    workflow_policy: critical,
    receipt_binding: RECEIPT_BINDING,
    execution_receipt: receipt,
    proofs: {
      needsInspection: { evidence: 'inspection receipt' },
      needsResearchGrounding: { evidence: 'research receipt' },
      needsIndependentAudit: { independent: true, evidence: 'marker only', verdict: 'PASS' },
    },
  }).completion, 'unfinished', 'independent marker must not satisfy audit');
  assert.equal(POLICY.validateIndependentAuditEvidence({ independent: true }, EXPECTED_PROVENANCE).valid, false);
  assert.equal(POLICY.validateIndependentAuditEvidence({ ...audit, verdict: 'PASS_WITH_WARNINGS' }, EXPECTED_PROVENANCE).valid, false);
  assert.equal(POLICY.validateIndependentAuditEvidence({ ...audit, reviewer_session_id: audit.implementation_session_id }, EXPECTED_PROVENANCE).valid, false);
  assert.equal(POLICY.validateIndependentAuditEvidence({ ...audit, expected_provenance: { base: EXPECTED_BASE, head: 'fedcba9876543210fedcba9876543210fedcba98' } }, EXPECTED_PROVENANCE).valid, false);
  assert.equal(POLICY.validateIndependentAuditEvidence({ ...audit, extra: 'forged' }, EXPECTED_PROVENANCE).valid, false);
  assert.equal(POLICY.validateIndependentAuditEvidence([audit], EXPECTED_PROVENANCE).valid, false);
  assert.equal(POLICY.validateIndependentAuditEvidence(audit, EXPECTED_PROVENANCE, RUNTIME_CONTEXT).valid, true);
  assert.equal(POLICY.validateIndependentAuditEvidence(audit, EXPECTED_PROVENANCE, { ...RUNTIME_CONTEXT }).valid, false, 'forged runtime session context must not satisfy audit binding');
  assert.equal(POLICY.completionDecision('PASS', {}).completion, 'unfinished');
  const artifactContext = {
    workflow_policy: POLICY.workflowPolicySnapshot({ riskSignals: {} }),
    receipt_binding: RECEIPT_BINDING,
    task_context: { artifacts: ['output/bundle.js'], expected_provenance: { ...EXPECTED_PROVENANCE } },
    execution_receipt: receipt,
    proofs: { needsInspection: { evidence: 'inspection receipt' } },
    receipt_options: { requireArtifactHash: false, artifactPaths: [] },
  };
  const artifactBlocked = POLICY.completionDecision('PASS', artifactContext);
  assert.equal(artifactBlocked.completion, 'unfinished', 'caller receipt options must not weaken task artifact requirements');
  assert.ok(artifactBlocked.missingProof.some((item) => item.includes('artifact_hash')));
});

test('auto authoring reaches readiness only after promotion, validation, grounding, and current review', () => {
  const fixture = createCanonicalAuthoringFixture();
  try {
    let spec = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    assert.equal(spec.semantic_model, null);
    spec.ready_for_implementation = true;
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(spec, null, 2)}\n`);
    let validation = VALIDATOR.validateSpec(fixture.specDir);
    assert.ok(validation.errors.some((error) => error.includes('requires explicit promoted machine semantic authority')));

    spec.ready_for_implementation = false;
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(spec, null, 2)}\n`);
    promoteCanonicalModel(fixture);
    spec = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    assert.ok(spec.semantic_model && spec.semantic_model.criteria.length === 2);
    spec.ready_for_implementation = true;
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(spec, null, 2)}\n`);
    validation = VALIDATOR.validateSpec(fixture.specDir);
    assert.ok(validation.errors.some((error) => error.includes('readiness requires validated')));
    assert.ok(validation.errors.some((error) => error.includes('requires completed semantic review')));

    spec.ready_for_implementation = false;
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(spec, null, 2)}\n`);
    spec = makeCanonicalReady(fixture);
    validation = VALIDATOR.validateSpec(fixture.specDir);
    assert.deepEqual(validation.errors, [], validation.errors.join('\n'));
    assert.equal(GROUNDER.groundSpec({ specDir: fixture.specDir, root: fixture.root, spec }).errors.length, 0);

    const specs = read(SPECS);
    const executableBlocks = [...specs.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]);
    assert.ok(executableBlocks.every((block) => !/cf:?develop/i.test(block)), 'Specs must never execute Develop');
    assert.match(specs, /An implementation workflow owns execution/i);
    assert.match(specs, /selects one unblocked task[\s\S]*runs\s+the task's verification[\s\S]*inline `## Receipt`/i);
    assert.match(specs, /The user decides\s+at GATE-DONE whether the feature is done/i);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('atomic readiness supports one-criterion Routine specs and binds semantic text', () => {
  const fixture = createOrdinaryAuthoringFixture();
  try {
    const authored = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    authored.decisions = [
      { id: 'Q1', classification: 'repository_fact', statement: 'The runtime entrypoint is src/entry.js.', status: 'grounded', evidence: 'Repository anchor A-D-01 resolves to src/entry.js.' },
      { id: 'Q2', classification: 'reversible_assumption', statement: 'Use the existing direct module export for this bounded change.', status: 'recorded', evidence: 'Reversal is limited to src/entry.js and does not alter product data.' },
    ];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(authored, null, 2)}\n`);
    const result = READINESS.finalizeReadiness({ specDir: fixture.specDir, projectRoot: fixture.root, reviewResult: ordinaryReview() });
    assert.equal(result.spec.ready_for_implementation, true);
    assert.equal(result.spec.semantic_model.criteria.length, 1);
    assert.match(result.spec.semantic_model.criteria[0].text, /delete the selected record/);
    assert.deepEqual(VALIDATOR.validateSpec(fixture.specDir).errors, []);

    const beforeDigest = result.semantic_digest;
    const design = path.join(fixture.specDir, 'design.md');
    const originalDesign = fs.readFileSync(design, 'utf8');
    fs.writeFileSync(design, originalDesign.replace('deleted rather than archived', 'archived rather than deleted'));
    const decisionProjection = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-semantic-model.cjs')).modelFromMarkdown(fixture.specDir, result.spec);
    assert.notDeepEqual(decisionProjection.model.design_records, result.spec.semantic_model.design_records);
    const decisionDigest = VALIDATOR.computeSemanticDigest21(fixture.specDir, { ...result.spec, semantic_model: decisionProjection.model });
    assert.equal(decisionDigest.errors.length, 0, decisionDigest.errors.join('\n'));
    assert.notEqual(decisionDigest.digest, beforeDigest);
    fs.writeFileSync(design, originalDesign);

    const requirements = path.join(fixture.specDir, 'requirements.md');
    fs.writeFileSync(requirements, fs.readFileSync(requirements, 'utf8').replace('delete the selected record', 'archive the selected record'));
    const projection = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-semantic-model.cjs')).modelFromMarkdown(fixture.specDir, result.spec);
    assert.notEqual(projection.model.criteria[0].text, result.spec.semantic_model.criteria[0].text);
    const changed = VALIDATOR.computeSemanticDigest21(fixture.specDir, { ...result.spec, semantic_model: projection.model });
    assert.equal(changed.errors.length, 0, changed.errors.join('\n'));
    assert.notEqual(changed.digest, beforeDigest);
    assert.ok(VALIDATOR.validateSpec(fixture.specDir).errors.some((error) => /projection|stale/.test(error)));
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('atomic readiness preserves exact bytes on review, grounding, decision, and Strict authority failures', () => {
  const fixture = createOrdinaryAuthoringFixture();
  try {
    const original = fs.readFileSync(fixture.specPath);
    for (const mutate of [
      (review) => ({ ...review, reviewed_criteria: [] }),
      (review) => ({ ...review, counterexamples: [] }),
    ]) {
      assert.throws(() => READINESS.finalizeReadiness({ specDir: fixture.specDir, projectRoot: fixture.root, reviewResult: mutate(ordinaryReview()) }), /readiness validation/);
      assert.equal(fs.readFileSync(fixture.specPath).equals(original), true);
    }
    fs.unlinkSync(path.join(fixture.root, 'src', 'entry.js'));
    assert.throws(() => READINESS.finalizeReadiness({ specDir: fixture.specDir, projectRoot: fixture.root, reviewResult: ordinaryReview() }), /grounding|validation/);
    assert.equal(fs.readFileSync(fixture.specPath).equals(original), true);
    fs.writeFileSync(path.join(fixture.root, 'src', 'entry.js'), 'module.exports = { action: "delete" };\n');

    process.env.CAFEKIT_FINALIZE_FAIL_BEFORE_RENAME = '1';
    try {
      assert.throws(() => READINESS.finalizeReadiness({ specDir: fixture.specDir, projectRoot: fixture.root, reviewResult: ordinaryReview() }), /injected finalization failure/);
      assert.equal(fs.readFileSync(fixture.specPath).equals(original), true);
    } finally { delete process.env.CAFEKIT_FINALIZE_FAIL_BEFORE_RENAME; }

    const blocked = JSON.parse(original);
    blocked.decisions = [{ id: 'Q1', classification: 'user_owned', statement: 'Choose permanent deletion or retention archive behavior.', status: 'unresolved', evidence: null }];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(blocked, null, 2)}\n`);
    const blockedBytes = fs.readFileSync(fixture.specPath);
    assert.throws(() => READINESS.finalizeReadiness({ specDir: fixture.specDir, projectRoot: fixture.root, reviewResult: ordinaryReview() }), /unresolved material user-owned decision/);
    assert.equal(fs.readFileSync(fixture.specPath).equals(blockedBytes), true);

    delete blocked.decisions;
    blocked.workflow_policy = POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Strict' });
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(blocked, null, 2)}\n`);
    const strictBytes = fs.readFileSync(fixture.specPath);
    assert.throws(() => READINESS.finalizeReadiness({ specDir: fixture.specDir, projectRoot: fixture.root, reviewResult: ordinaryReview() }), /Strict readiness/);
    assert.equal(fs.readFileSync(fixture.specPath).equals(strictBytes), true);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('Strict atomic readiness succeeds only after current allowlisted host observation', () => {
  const fixture = createOrdinaryAuthoringFixture();
  try {
    const spec = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    spec.workflow_policy = POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Strict' });
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(spec, null, 2)}\n`);
    const before = fs.readFileSync(fixture.specPath);
    assert.throws(() => READINESS.finalizeReadiness({ specDir: fixture.specDir, projectRoot: fixture.root, reviewResult: ordinaryReview() }), /Strict readiness/);
    assert.equal(fs.readFileSync(fixture.specPath).equals(before), true);

    const digest = VALIDATOR.computeSemanticDigest21(fixture.specDir, spec);
    assert.equal(digest.errors.length, 0, digest.errors.join('\n'));
    const authorityHome = path.join(fixture.root, 'authority-home');
    const claim = `CAFEKIT_SEMANTIC_REVIEW_ATTESTATION ${JSON.stringify({ feature_name: 'ordinary', spec_file: 'specs/ordinary/spec.json', semantic_digest: digest.digest, verdict: 'PASS' })}`;
    const observed = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src/claude/hooks/semantic-review-authority.cjs')], {
      cwd: fixture.root,
      env: { ...process.env, HOME: authorityHome, USERPROFILE: authorityHome, PROJECT_ROOT: fixture.root },
      input: JSON.stringify({ hook_event_name: 'SubagentStop', session_id: 'host-session', agent_id: 'reviewer-1', agent_type: 'code_auditor', last_assistant_message: claim, cwd: fixture.root }),
      encoding: 'utf8',
    });
    assert.equal(observed.status, 0, observed.stderr);
    const reviewFile = path.join(fixture.root, 'review.json');
    fs.writeFileSync(reviewFile, `${JSON.stringify(ordinaryReview())}\n`);
    const finalized = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-readiness.cjs'), fixture.specDir, '--review-result', reviewFile], {
      cwd: fixture.root,
      env: { ...process.env, HOME: authorityHome, USERPROFILE: authorityHome, PROJECT_ROOT: fixture.root },
      encoding: 'utf8',
    });
    assert.equal(finalized.status, 0, `${finalized.stdout}\n${finalized.stderr}`);
    assert.equal(JSON.parse(fs.readFileSync(fixture.specPath, 'utf8')).ready_for_implementation, true);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('done is a final-state request bound to current semantic model and digest', () => {
  const fixture = createCanonicalAuthoringFixture();
  try {
    promoteCanonicalModel(fixture);
    const spec = makeCanonicalReady(fixture);
    spec.status = 'done';
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(spec, null, 2)}\n`);
    const candidate = {
      featureDir: fixture.specDir,
      featureName: 'feature',
      specFile: fixture.specPath,
      spec,
    };
    const dependencies = () => ({
      validator: VALIDATOR,
      grounder: GROUNDER,
      semanticAuthority: SEMANTIC_AUTHORITY,
    });
    const current = FINAL_STATE.validateCanonicalFinalState({
      policy: POLICY, projectRoot: fixture.root, candidate, dependencies,
    });
    assert.equal(current.ok, true, current.reason);
    assert.equal(current.semanticDigest, spec.validation.semantic_review.semantic_digest);

    const failedReceipt = structuredClone(spec);
    failedReceipt.validation.semantic_review.verdict = 'FAIL';
    const receiptMutation = FINAL_STATE.validateCanonicalFinalState({
      policy: POLICY,
      projectRoot: fixture.root,
      candidate: { ...candidate, spec: failedReceipt },
      dependencies,
    });
    assert.equal(receiptMutation.ok, false);
    assert.match(receiptMutation.reason, /PASS CONTINUE/);

    const mismatchedHistory = structuredClone(spec);
    const latest = mismatchedHistory.validation.semantic_review_history.entries[
      mismatchedHistory.validation.semantic_review_history.entries.length - 1
    ];
    latest.review_receipt_digest = `sha256:${'0'.repeat(64)}`;
    const digestMismatch = FINAL_STATE.validateCanonicalFinalState({
      policy: POLICY,
      projectRoot: fixture.root,
      candidate: { ...candidate, spec: mismatchedHistory },
      dependencies,
    });
    assert.equal(digestMismatch.ok, false);
    assert.match(digestMismatch.reason, /review_receipt_digest|canonical receipt/);

    const requirementsPath = path.join(fixture.specDir, 'requirements.md');
    const requirements = fs.readFileSync(requirementsPath, 'utf8');
    fs.writeFileSync(requirementsPath, requirements.replace('invalid input shall return rejected state', 'invalid input shall return a deterministic rejected state'));
    const staleDigest = FINAL_STATE.validateCanonicalFinalState({
      policy: POLICY, projectRoot: fixture.root, candidate, dependencies,
    });
    assert.equal(staleDigest.ok, false);
    assert.match(staleDigest.reason, /stale|differs from Markdown projection/i);

    fs.writeFileSync(requirementsPath, requirements);
    const staleModel = structuredClone(spec);
    staleModel.semantic_model.criteria[0].owner = 'A-D-02';
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(staleModel, null, 2)}\n`);
    const invalidModel = FINAL_STATE.validateCanonicalFinalState({
      policy: POLICY,
      projectRoot: fixture.root,
      candidate: { ...candidate, spec: staleModel },
      dependencies,
    });
    assert.equal(invalidModel.ok, false);
    assert.match(invalidModel.reason, /semantic projection|semantic_model|validation failed/i);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('flash PASS promotes proof; only trusted sync-finalize completes', () => {
  const initial = canonicalFlashTask();
  for (const verdict of ['FAIL', 'BLOCKED', 'PARTIAL', 'NO_TESTS', 'PASS_WITH_WARNINGS']) {
    const result = POLICY.promoteFlashTask(initial, verdict);
    assert.equal(result.status, 'in_progress');
    assert.equal(result.receipt, 'FLASH_UNVERIFIED');
    assert.equal(result.dependencyBlocked, true);
    assert.equal(result.unblocks, false);
    assert.match(result.blocker, /verification|test proof/);
  }
  const promoted = POLICY.promoteFlashTask(initial, 'PASS', canonicalReceipt());
  assert.equal(promoted.status, 'in_progress');
  assert.equal(promoted.receipt.startsWith('Verification: PASS'), true);
  assert.equal(promoted.blocker, null);
  assert.equal(promoted.dependencyBlocked, true);
  assert.equal(promoted.unblocks, false);
  assert.equal(promoted.readyForSync, true);
  assert.equal(POLICY.finalizeFlashTask(promoted, 'sync'), promoted);
  const forgedFinalize = POLICY.finalizeFlashTask(promoted, 'sync-finalize');
  assert.equal(forgedFinalize.status, 'in_progress');
  assert.equal(forgedFinalize.dependencyBlocked, true);
  assert.equal(forgedFinalize.unblocks, false);
  const finalized = POLICY.syncFinalizeFlashTask(initial, 'PASS', promoted.receipt);
  assert.equal(finalized.status, 'done');
  assert.equal(finalized.dependencyBlocked, false);
  assert.equal(finalized.unblocks, true);
  assert.equal(finalized.readyForSync, false);
  assert.equal(POLICY.isStaleFlashDone({ status: 'done', receipt: 'FLASH_UNVERIFIED' }), true);
  assert.match(read(TEST_SKILL), /only explicit .*sync-finalize/i);
  assert.match(read(SYNC_SKILL), /sync-finalize/);
});

test('spec-gate rejects stale FLASH_UNVERIFIED done state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-spec-gate-'));
  const specGate = installClaudeRuntimeClosure(root);
  assert.equal(fs.existsSync(path.join(root, '.claude', 'scripts', 'spec-final-state.cjs')), true);
  assert.equal(fs.existsSync(path.join(root, '.claude', 'scripts', 'validate-spec-output.cjs')), true);
  fs.mkdirSync(path.join(root, 'specs', 'demo', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'specs', 'demo', 'spec.json'), JSON.stringify({
    status: 'in_progress',
    current_phase: 'closeout',
    feature_name: 'demo',
    task_registry: { 'tasks/task.md': { status: 'done', receipt: 'FLASH_UNVERIFIED' } },
  }));
  initFixtureGit(root);
  try {
    const result = spawnSync(process.execPath, [specGate], {
      cwd: root,
      env: { ...process.env, PROJECT_ROOT: root },
      input: JSON.stringify({ cwd: root, session_id: 'test' }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.decision, 'block');
    assert.match(payload.reason, /FLASH_UNVERIFIED/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('first-run cache bypass is blocked - canonical receipt required even without cache', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-first-run-'));
  const claude = path.join(root, '.claude');
  const specGate = installClaudeRuntimeClosure(root);
  const specDir = path.join(root, 'specs', 'demo', 'tasks');
  fs.mkdirSync(specDir, { recursive: true });
  // Done task without canonical receipt (missing Command, provenance)
  fs.writeFileSync(path.join(root, 'specs', 'demo', 'spec.json'), JSON.stringify({
    status: 'done',
    current_phase: 'closeout',
    feature_name: 'demo',
    task_registry: { 'tasks/task-R1-01-one.md': { status: 'done', completed_at: '2026-07-29T10:00:00.000Z' } },
  }));
  fs.writeFileSync(path.join(specDir, 'task-R1-01-one.md'), '# Task\n\n**Status:** done\n\n## Evidence\n\nVerification: PASS\n```\nnpm test\n```\n');
  initFixtureGit(root);
  try {
    assert.equal(fs.existsSync(path.join(claude, 'hooks', '.logs', 'spec-gate-last.json')), false);
    const result = spawnSync(process.execPath, [specGate], {
      cwd: root,
      env: { ...process.env, PROJECT_ROOT: root },
      input: JSON.stringify({ cwd: root, session_id: 'test' }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.decision, 'block', 'first-run without canonical receipt must block');
    assert.match(payload.reason, /tasks\/task-R1-01-one\.md/);
    assert.match(payload.reason, /receipt|command|provenance/i);
    // Also test that with canonical receipt it passes
    fs.writeFileSync(path.join(specDir, 'task-R1-01-one.md'), '# Task R1-01: One\n\n**Status:** done\n\n## Outcome\n\nVerified result.\n\n## Scope and Typed Anchors\n\n- **In scope:** focused result\n- **Out of scope:** none\n\n## Changes\n\n- [x] Verify result.\n\n## Acceptance\n\n- Result is verified.\n\n## Dependencies\n\n- none\n\n## Verification Plan\n\n- **Command:** `pnpm test`\n- **Expected:** focused tests pass\n- **Negative path:** not relevant for fixture\n- **Reachability:** fixture test entrypoint\n');
    fs.mkdirSync(path.join(root, 'specs', 'demo', 'receipts'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'specs', 'demo', 'receipts', 'task-R1-01-one.md'),
      bindFixtureReceipt(root, '# Task Receipt\n\nTask: task-R1-01-one.md\nTask path: tasks/task-R1-01-one.md\nVerification: PASS\nCommand: pnpm test\nExit: 0\nResult: PASS\nExpected: focused tests pass\nObserved: focused tests passed\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n```\nnpm test\nPASS\n```\n'),
    );
    fs.writeFileSync(
      path.join(root, 'specs', 'demo', 'feature-receipt.md'),
      bindFixtureReceipt(root, '# Feature Receipt\n\nFeature: demo\nVerification: PASS\nCommand: pnpm test\nExit: 0\nResult: PASS\nExpected: integrated feature passes\nObserved: integrated feature passed\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n'),
    );
    // Clear cache to simulate fresh first-run with valid receipt
    try { fs.unlinkSync(path.join(claude, 'hooks', '.logs', 'spec-gate-last.json')); } catch {}
    // Re-run with valid receipt - should not block
    const result2 = spawnSync(process.execPath, [specGate], {
      cwd: root,
      env: { ...process.env, PROJECT_ROOT: root },
      input: JSON.stringify({ cwd: root, session_id: 'test' }),
      encoding: 'utf8',
    });
    assert.equal(result2.stdout, '', 'valid canonical receipt on first run must not block');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('canonical receipt requires command, exit, provenance and unambiguous PASS', () => {
  assert.deepEqual(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n'), []);
  const missingCommand = POLICY.validateCanonicalReceipt('Verification: PASS\nExit: 0\nBase: a\nHead: b\n');
  assert.ok(missingCommand.includes('command'));
  const missingProvenance = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\n');
  assert.ok(missingProvenance.includes('provenance'));
  const missingVerification = POLICY.validateCanonicalReceipt('Command: pnpm test\nExit: 0\nBase: a\nHead: b\n');
  assert.ok(missingVerification.includes('verification_state'));
  const artifactWithoutHash = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nArtifact: dist/bundle.js\n');
  assert.ok(artifactWithoutHash.includes('artifact_hash'));
  // CLI validation
  const cli = spawnSync(process.execPath, [POLICY_PATH, '--validate-receipt', '--task-json', JSON.stringify({ body: 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n' }), '--json'], { encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.equal(JSON.parse(cli.stdout).ok, true);
});

test('canonical receipt provenance requires both Base and Head (or both base_sha and head_sha)', () => {
  // Only Base fails - single endpoint must not satisfy provenance
  const onlyBase = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: abc123\n');
  assert.ok(onlyBase.includes('provenance'), 'only Base should fail provenance');
  // Only Head fails
  const onlyHead = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nHead: def456\n');
  assert.ok(onlyHead.includes('provenance'), 'only Head should fail provenance');
  // Both Base and Head passes
  const bothLabels = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n');
  assert.deepEqual(bothLabels, [], 'both Base and Head should pass');
  // Only base_sha fails
  const onlyBaseSha = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: abc123\n');
  assert.ok(onlyBaseSha.includes('provenance'), 'only base_sha should fail provenance');
  // Only head_sha fails
  const onlyHeadSha = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nhead_sha: def456\n');
  assert.ok(onlyHeadSha.includes('provenance'), 'only head_sha should fail provenance');
  // Both base_sha and head_sha passes
  const bothSha = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: 0123456789abcdef0123456789abcdef01234567\nhead_sha: 89abcdef0123456789abcdef0123456789abcdef\n');
  assert.deepEqual(bothSha, [], 'both base_sha and head_sha should pass');
  // Alternation-precedence false acceptance check: ensure single Head or base_sha alone does not pass
  const singleHeadLower = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nHead: single\n');
  assert.ok(singleHeadLower.includes('provenance'));
  // Empty / bare provenance must fail — same-line non-empty value required
  const emptyBase = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase:\nHead: def456\n');
  assert.ok(emptyBase.includes('provenance'), 'empty Base: should fail');
  const spacesBase = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase:   \nHead: def456\n');
  assert.ok(spacesBase.includes('provenance'), 'Base: with only spaces should fail');
  const emptyHead = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: abc\nHead:\n');
  assert.ok(emptyHead.includes('provenance'), 'empty Head: should fail');
  const spacesHead = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: abc\nHead:   \n');
  assert.ok(spacesHead.includes('provenance'), 'Head: with only spaces should fail');
  const bareBaseSha = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha\nhead_sha: def\n');
  assert.ok(bareBaseSha.includes('provenance'), 'bare base_sha without colon/value should fail');
  const emptyBaseSha = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha:\nhead_sha: def\n');
  assert.ok(emptyBaseSha.includes('provenance'), 'empty base_sha: should fail');
  const spacesBaseSha = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha:   \nhead_sha: def\n');
  assert.ok(spacesBaseSha.includes('provenance'), 'base_sha: with only spaces should fail');
  const bareHeadSha = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: abc\nhead_sha\n');
  assert.ok(bareHeadSha.includes('provenance'), 'bare head_sha without colon/value should fail');
  const bareBoth = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha head_sha\n');
  assert.ok(bareBoth.includes('provenance'), 'bare base_sha head_sha without colon/value should fail');
  const baseEmptyHeadValid = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase:\nHead: def\n');
  assert.ok(baseEmptyHeadValid.includes('provenance'));
  const validWithValues = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n');
  assert.deepEqual(validWithValues, [], 'valid Base and Head with values should pass');
  const validShaWithValues = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: 0123456789abcdef0123456789abcdef01234567\nhead_sha: 89abcdef0123456789abcdef0123456789abcdef\n');
  assert.deepEqual(validShaWithValues, [], 'valid base_sha and head_sha with values should pass');
  // CLI: only Base via --validate-receipt should fail
  const cliOnlyBase = spawnSync(process.execPath, [POLICY_PATH, '--validate-receipt', '--task-json', JSON.stringify({ body: 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\n' }), '--json'], { encoding: 'utf8' });
  assert.equal(cliOnlyBase.status, 2);
  assert.equal(JSON.parse(cliOnlyBase.stdout).ok, false);
  assert.ok(JSON.parse(cliOnlyBase.stdout).failures.includes('provenance'));
  const cliBoth = spawnSync(process.execPath, [POLICY_PATH, '--validate-receipt', '--task-json', JSON.stringify({ body: 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n' }), '--json'], { encoding: 'utf8' });
  assert.equal(cliBoth.status, 0);
  assert.equal(JSON.parse(cliBoth.stdout).ok, true);
  // CLI empty Base should fail
  const cliEmptyBase = spawnSync(process.execPath, [POLICY_PATH, '--validate-receipt', '--task-json', JSON.stringify({ body: 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase:\nHead: b\n' }), '--json'], { encoding: 'utf8' });
  assert.equal(cliEmptyBase.status, 2);
  assert.ok(JSON.parse(cliEmptyBase.stdout).failures.includes('provenance'));
});

test('canonical receipt binds expected provenance when the runtime supplies it', () => {
  const body = canonicalReceipt();
  const binding = POLICY.createReceiptBinding(RUNTIME_CONTEXT);
  assert.deepEqual(binding.expectedProvenance, EXPECTED_PROVENANCE);
  assert.equal(binding.requireProvenanceBinding, true);
  assert.equal(binding.runtimeContext.context_id, RUNTIME_CONTEXT.context_id);
  assert.throws(() => POLICY.createReceiptBinding(EXPECTED_PROVENANCE), /runtime-derived provenance context/);
  assert.ok(POLICY.validateCanonicalReceipt(body, { requireProvenanceBinding: true }).includes('provenance'));
  assert.deepEqual(POLICY.validateCanonicalReceipt(body, { expectedProvenance: EXPECTED_PROVENANCE }), []);
  assert.ok(POLICY.validateCanonicalReceipt(body, { expectedProvenance: { base: EXPECTED_BASE, head: 'fedcba9876543210fedcba9876543210fedcba98' } }).includes('provenance'));
  const taskOptions = POLICY.receiptValidatorOptions({ expected_provenance: EXPECTED_PROVENANCE });
  assert.equal(taskOptions.expectedProvenance, null, 'task-authored expected provenance is diagnostic metadata only');
  assert.deepEqual(POLICY.validateCanonicalReceipt(body, taskOptions), [], 'diagnostic parsing may accept schema-valid anchors without treating them as identity');
});

test('runtime provenance derives exact Git evidence, CLI context, and stale/forged blockers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-provenance-adversarial-'));
  const specsRoot = path.join(root, 'specs');
  const featureRoot = path.join(specsRoot, 'demo');
  const specFile = path.join(featureRoot, 'spec.json');
  const sourceFile = path.join(root, 'src', 'app.js');
  const renameSource = path.join(root, 'src', 'rename-old.js');
  const renameTarget = path.join(root, 'src', 'rename-new.js');
  fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
  fs.mkdirSync(featureRoot, { recursive: true });
  fs.writeFileSync(specFile, JSON.stringify({ status: 'in_progress', feature_name: 'demo', task_registry: {} }));
  fs.writeFileSync(sourceFile, 'original source\n');
  fs.writeFileSync(renameSource, 'rename source\n');
  fs.writeFileSync(path.join(root, '.gitignore'), 'ignored-secret.env\nnode_modules/\n.cache/\n');
  initFixtureGit(root);
  try {
    const input = {
      projectRoot: root,
      specsRoot,
      specFile,
      featureName: 'demo',
      runtimeSession: 'provenance-session',
    };
    const initial = PROVENANCE_HELPER.deriveRuntimeContext(input);
    const exactReceipt = `Verification: PASS\nCommand: node --test\nExit: 0\nBase: ${initial.base}\nHead: ${initial.head}\n`;
    assert.deepEqual(
      POLICY.validateCanonicalReceipt(exactReceipt, POLICY.receiptValidatorOptions({}, {
        runtimeContext: initial,
        requireProvenanceBinding: true,
      })),
      [],
      'exact runtime-derived receipt must validate',
    );
    const arbitraryReceipt = 'Verification: PASS\nCommand: node --test\nExit: 0\nBase: ' + 'a'.repeat(40) + '\nHead: ' + 'b'.repeat(64) + '\n';
    assert.ok(
      POLICY.validateCanonicalReceipt(arbitraryReceipt, POLICY.receiptValidatorOptions({}, {
        runtimeContext: initial,
        requireProvenanceBinding: true,
      })).includes('provenance'),
      'valid-shaped arbitrary SHA values must not bind',
    );

    fs.writeFileSync(specFile, JSON.stringify({
      status: 'in_progress',
      feature_name: 'demo',
      task_registry: {},
      receipt_refresh: true,
    }));
    const specCommit = spawnSync('git', ['-C', root, 'add', 'specs/demo/spec.json'], { encoding: 'utf8' });
    assert.equal(specCommit.status, 0, specCommit.stderr);
    const commitReceipt = spawnSync('git', ['-C', root, 'commit', '-qm', 'refresh spec receipt'], { encoding: 'utf8' });
    assert.equal(commitReceipt.status, 0, commitReceipt.stderr);
    const afterSpecOnlyCommit = PROVENANCE_HELPER.deriveRuntimeContext(input);
    assert.equal(afterSpecOnlyCommit.base, initial.base, 'spec-only commits must not stale receipt Base');
    assert.equal(afterSpecOnlyCommit.head, initial.head, 'spec-only commits must not stale receipt Head');

    const cli = spawnSync(process.execPath, [
      path.join(PACKAGE_ROOT, 'src/claude/scripts/provenance.cjs'), '--json',
      '--project-root', root, '--specs-root', specsRoot, '--spec-file', specFile,
      '--feature-name', 'demo', '--runtime-session', 'provenance-session',
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
    const cliOutput = JSON.parse(cli.stdout);
    assert.equal(cliOutput.ok, true);
    assert.equal(cliOutput.Base, initial.base);
    assert.equal(cliOutput.Head, initial.head);
    assert.equal(cliOutput.context_id, initial.context_id);

    const ignoredSecret = path.join(root, 'ignored-secret.env');
    fs.writeFileSync(ignoredSecret, 'TOKEN=first-secret\n');
    const withIgnoredSecret = PROVENANCE_HELPER.deriveRuntimeContext(input);
    fs.writeFileSync(ignoredSecret, 'TOKEN=changed-secret\n');
    const withChangedIgnoredSecret = PROVENANCE_HELPER.deriveRuntimeContext(input);
    assert.equal(withIgnoredSecret.head, initial.head, 'ignored secret-like files must not enter Head');
    assert.equal(withChangedIgnoredSecret.head, initial.head, 'changing an ignored secret-like file must not change Head');

    const ignoredCacheFile = path.join(root, 'packages', 'app', 'node_modules', 'cache', 'runtime.bin');
    fs.mkdirSync(path.dirname(ignoredCacheFile), { recursive: true });
    fs.writeFileSync(ignoredCacheFile, 'runtime cache bytes\n');
    const withIgnoredCache = PROVENANCE_HELPER.deriveRuntimeContext(input);
    fs.writeFileSync(ignoredCacheFile, 'changed runtime cache bytes\n');
    const withChangedIgnoredCache = PROVENANCE_HELPER.deriveRuntimeContext(input);
    assert.equal(withIgnoredCache.head, initial.head, 'nested ignored node_modules/cache files must not enter Head');
    assert.equal(withChangedIgnoredCache.head, initial.head, 'changing nested ignored cache data must not change Head');

    const forgedContext = { ...initial };
    const forgedDecision = POLICY.completionDecision('PASS', {
      workflow_policy: { proof_obligations: ['needsExecutionProof'] },
      runtime_context: forgedContext,
      execution_receipt: exactReceipt,
    });
    assert.equal(forgedDecision.completion, 'unfinished');
    assert.deepEqual(forgedDecision.missingProof, ['runtime_provenance']);

    const flash = {
      status: 'in_progress',
      receipt: 'FLASH_UNVERIFIED',
      blocker: 'awaiting test proof',
      dependencyBlocked: true,
      unblocks: false,
      runtime_context: initial,
    };
    const promoted = POLICY.promoteFlashTask(flash, 'PASS', exactReceipt);
    assert.equal(promoted.readyForSync, true);

    fs.writeFileSync(sourceFile, 'mutated source\n');
    const stale = POLICY.completionDecision('PASS', {
      workflow_policy: { proof_obligations: ['needsExecutionProof'] },
      receipt_binding: POLICY.createReceiptBinding(initial),
      execution_receipt: exactReceipt,
    });
    assert.equal(stale.completion, 'unfinished');
    assert.ok(stale.missingProof.some((item) => item.includes('execution_receipt:provenance')));
    const staleFinalized = POLICY.syncFinalizeFlashTask(flash, 'PASS', exactReceipt, initial);
    assert.equal(staleFinalized.status, 'in_progress');
    assert.equal(staleFinalized.readyForSync, false);

    fs.writeFileSync(path.join(root, 'src', 'untracked.js'), 'untracked source\n');
    const withUntracked = PROVENANCE_HELPER.deriveRuntimeContext(input);
    assert.notEqual(withUntracked.head, withIgnoredCache.head, 'non-ignored untracked source must change Head');
    fs.chmodSync(renameSource, 0o755);
    const withMode = PROVENANCE_HELPER.deriveRuntimeContext(input);
    assert.notEqual(withMode.head, withUntracked.head, 'mode changes must change Head');
    fs.renameSync(renameSource, renameTarget);
    const withRename = PROVENANCE_HELPER.deriveRuntimeContext(input);
    assert.notEqual(withRename.head, withMode.head, 'rename path semantics must change Head');
    fs.unlinkSync(sourceFile);
    const withDeletion = PROVENANCE_HELPER.deriveRuntimeContext(input);
    assert.notEqual(withDeletion.head, withRename.head, 'tracked deletion must change Head');
    const staged = spawnSync('git', ['-C', root, 'add', '-A'], { encoding: 'utf8' });
    assert.equal(staged.status, 0, staged.stderr);
    const stagedRename = PROVENANCE_HELPER.deriveRuntimeContext(input);
    assert.notEqual(stagedRename.head, withDeletion.head, 'staged rename/deletion evidence must be included');

    assert.throws(() => PROVENANCE_HELPER.deriveRuntimeContext({
      ...input,
      feature_name: 'other',
    }), /disagree/);
    assert.throws(() => PROVENANCE_HELPER.deriveRuntimeContext({
      ...input,
      specsRoot: root,
    }), /distinct project subdirectory/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-provenance-non-git-'));
  const nonGitSpec = path.join(nonGit, 'specs', 'demo', 'spec.json');
  fs.mkdirSync(path.dirname(nonGitSpec), { recursive: true });
  fs.writeFileSync(nonGitSpec, JSON.stringify({ status: 'in_progress', feature_name: 'demo' }));
  try {
    const blocked = spawnSync(process.execPath, [
      path.join(PACKAGE_ROOT, 'src/claude/scripts/provenance.cjs'), '--json',
      '--project-root', nonGit, '--specs-root', path.join(nonGit, 'specs'),
      '--spec-file', nonGitSpec, '--feature-name', 'demo', '--runtime-session', 'non-git-session',
    ], { cwd: nonGit, encoding: 'utf8' });
    assert.equal(blocked.status, 2);
    assert.equal(JSON.parse(blocked.stdout).error.code, 'git_command_failed');
  } finally {
    fs.rmSync(nonGit, { recursive: true, force: true });
  }
});

test('runtime provenance chooses a deterministic root when all history is Specs-only and multi-root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-provenance-multi-root-'));
  const specsRoot = path.join(root, 'specs');
  const featureRoot = path.join(specsRoot, 'demo');
  const specFile = path.join(featureRoot, 'spec.json');
  try {
    fs.mkdirSync(featureRoot, { recursive: true });
    fs.writeFileSync(specFile, JSON.stringify({ status: 'in_progress', feature_name: 'demo', task_registry: {} }));
    for (const args of [
      ['init', '-q', '-b', 'first-root'],
      ['config', 'user.email', 'cafekit@example.invalid'],
      ['config', 'user.name', 'CafeKit Test'],
      ['add', 'specs/demo/spec.json'],
      ['commit', '-qm', 'first specs root'],
      ['checkout', '--orphan', 'unrelated-specs'],
      ['rm', '-qrf', '.'],
    ]) {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const unrelatedSpec = path.join(specsRoot, 'unrelated', 'spec.json');
    fs.mkdirSync(path.dirname(unrelatedSpec), { recursive: true });
    fs.writeFileSync(unrelatedSpec, JSON.stringify({ status: 'in_progress', feature_name: 'unrelated', task_registry: {} }));
    let result = spawnSync('git', ['-C', root, 'add', 'specs/unrelated/spec.json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    result = spawnSync('git', ['-C', root, 'commit', '-qm', 'second specs root'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    result = spawnSync('git', ['-C', root, 'merge', '--allow-unrelated-histories', '-qm', 'merge specs roots', 'first-root'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const roots = spawnSync('git', ['-C', root, 'rev-list', '--max-parents=0', '--reverse', 'HEAD'], { encoding: 'utf8' });
    assert.equal(roots.status, 0, roots.stderr);
    const expectedBase = roots.stdout.trim().split('\n')[0].toLowerCase();
    const context = PROVENANCE_HELPER.deriveRuntimeContext({
      projectRoot: root,
      specsRoot,
      specFile,
      featureName: 'demo',
      runtimeSession: 'multi-root-session',
    });
    assert.equal(context.base, expectedBase);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('lane traces - Direct, Standard, explicit Strict classification, override, state mutation and completion', () => {
  // Direct: isolated reversible low-risk
  const direct = POLICY.classifyLane({ reversible: true, lowRisk: true, isolated: true, taskCount: 1 });
  assert.equal(direct.lane, 'Direct');
  assert.equal(direct.automaticLane, 'Direct');
  assert.deepEqual(POLICY.lanePolicy(direct).proof_obligations, ['needsExecutionProof']);
  assert.equal(POLICY.lanePolicy(direct).requiresSpec, false);
  assert.equal(POLICY.lanePolicy(direct).shipPoint, 'task');
  // Standard: default
  const standard = POLICY.classifyLane({ title: 'add pagination to list', taskCount: 1 });
  assert.equal(standard.lane, 'Standard');
  assert.deepEqual(POLICY.lanePolicy(standard).proof_obligations, ['needsExecutionProof']);
  assert.equal(POLICY.lanePolicy(standard).shipPoint, 'feature');
  // Risk alone is Elevated; Critical requires an explicit Strict assurance choice.
  const elevated = POLICY.classifyLane({ riskSignals: { auth: true }, taskCount: 1 });
  assert.equal(elevated.lane, 'Standard');
  assert.deepEqual(POLICY.lanePolicy(elevated).proof_obligations, ['needsInspection', 'needsExecutionProof']);
  const critical = POLICY.classifyLane({ riskSignals: { auth: true }, assurance_level: 'Strict', taskCount: 1 });
  assert.equal(critical.lane, 'Critical');
  assert.ok(critical.risks.includes('auth'));
  assert.deepEqual(POLICY.lanePolicy(critical).proof_obligations, ['needsInspection', 'needsExecutionProof', 'needsIndependentAudit']);
  // Override: Direct requesting Critical is allowed (upgrade) without extra auth
  const upgrade = POLICY.classifyLane({ reversible: true, lowRisk: true, isolated: true, taskCount: 1, override: 'Critical' });
  assert.equal(upgrade.lane, 'Critical');
  assert.equal(upgrade.automaticLane, 'Direct');
  // Downgrade without auth is blocked
  assert.throws(() => POLICY.classifyLane({ riskSignals: { payment: true }, override: 'Standard' }), /assurance_level downgrade.*blocked/i);
  // Caller-owned booleans cannot weaken the classified minimum.
  assert.throws(() => POLICY.classifyLane({ riskSignals: { payment: true }, override: 'Standard', userAuthorized: true }), /assurance_level downgrade.*blocked/i);
  assert.throws(() => POLICY.classifyLane({ riskSignals: { payment: true }, override: 'Standard', user_approved: true }), /assurance_level downgrade.*blocked/i);
  // State mutation: approvalState
  const pendingApproval = POLICY.approvalState({ generated: true, agent_validated: false, user_approved: false });
  assert.equal(pendingApproval.ready, false);
  const agentValidated = POLICY.approvalState({ generated: true, agent_validated: true, user_approved: false });
  assert.equal(agentValidated.ready, true, 'generated plus agent validation is technical readiness');
  const approved = POLICY.approvalState({ generated: true, agent_validated: true, user_approved: true });
  assert.equal(approved.ready, true);
  // Completion: flash work remains in_progress and does not unblock
  const flashTask = canonicalFlashTask();
  const failRemains = POLICY.promoteFlashTask(flashTask, 'FAIL');
  assert.equal(failRemains.status, 'in_progress');
  assert.equal(failRemains.unblocks, false);
  const blockedRemains = POLICY.promoteFlashTask(flashTask, 'BLOCKED');
  assert.equal(blockedRemains.unblocks, false);
  const noTestsRemains = POLICY.promoteFlashTask(flashTask, 'NO_TESTS');
  assert.equal(noTestsRemains.unblocks, false);
  const promoted = POLICY.promoteFlashTask(flashTask, 'PASS', canonicalReceipt());
  assert.equal(promoted.readyForSync, true);
  assert.equal(promoted.unblocks, false, 'promoted flash must not unblock until sync-finalize');
  const finalized = POLICY.syncFinalizeFlashTask(flashTask, 'PASS', promoted.receipt);
  assert.equal(finalized.status, 'done');
  assert.equal(finalized.unblocks, true);
});

test('flash selective promotion - only specific task is promoted, not blanket', () => {
  const registry = {
    'tasks/task-a.md': canonicalFlashTask(),
    'tasks/task-b.md': canonicalFlashTask(),
  };
  const promotedA = POLICY.promoteFlashTask(registry['tasks/task-a.md'], 'PASS', canonicalReceipt());
  const notPromotedB = registry['tasks/task-b.md']; // unchanged
  assert.equal(promotedA.readyForSync, true);
  assert.equal(notPromotedB.receipt, 'FLASH_UNVERIFIED');
  assert.equal(notPromotedB.readyForSync, undefined);
  // FAIL on B does not affect A
  const failB = POLICY.promoteFlashTask(notPromotedB, 'FAIL');
  assert.equal(failB.receipt, 'FLASH_UNVERIFIED');
  assert.equal(promotedA.receipt.startsWith('Verification: PASS'), true);
});

test('parallel waves require immutable provenance receipts and safe recovery', () => {
  const waves = markdownLegacyRegions(read(PARALLEL_WAVES)).primary;
  assert.match(waves, /only for explicit parallel execution/i);
  assert.match(waves, /isolated worktree support[\s\S]*fall back to the sequential loop/i);
  assert.match(waves, /Clamp `--parallel N` to 1\.\.5; default to 3/i);
  assert.match(waves, /clean destination[\s\S]*base_sha[\s\S]*incompatible bases/i);
  assert.match(waves, /consent for worker commits and controller cherry-picks/i);
  for (const field of ['base_sha', 'head_sha', 'branch', 'worktree_path', 'commit_range']) {
    assert.match(waves, new RegExp(`\\b${field}\\b`));
  }
  assert.match(waves, /git rev-list --reverse <base_sha>\.\.<head_sha>/i);
  assert.match(waves, /git diff --name-status <base_sha>\.\.<head_sha>/i);
  assert.match(waves, /code\/spec repair[\s\S]*new commit/i);
  assert.match(waves, /dependencies from the plan table and each task/i);
  for (const sharedSurface of ['registry', 'lockfile', 'manifest', 'generated output', 'migration', 'export barrel']) {
    assert.match(waves, new RegExp(sharedSurface, 'i'));
  }
  assert.match(waves, /One file has one writer per wave/i);
  assert.match(waves, /only the controller writes state\/proof/i);
  assert.match(waves, /commit only with user authorization/i);
  assert.match(waves, /blocked or failed worker keeps[\s\S]*worktree and branch/i);
  assert.match(waves, /Never[\s\S]*force-delete[\s\S]*merge success or explicit discard authorization/i);
  assert.match(waves, /git cherry-pick <next-worker-commit>/i);
  assert.match(waves, /On conflict, abort the pick[\s\S]*retain its branch\/worktree/i);
  assert.match(waves, /cleanup_authorization: merged-release/i);
  assert.match(waves, /affected integration|final.*integration/i);
  for (const category of ['baseline', 'environment', 'spec', 'code']) {
    assert.match(waves, new RegExp(`\\b${category}\\b`));
  }
  assert.match(waves, /Do not blind-retry/i);
});

test('provenance ledger defines reuse contract and source anchors', () => {
  assert.equal(fs.existsSync(PROVENANCE), true);
  const provenance = read(PROVENANCE);
  assert.match(provenance, /\bidea\b/);
  assert.match(provenance, /\bclean-room\b/);
  assert.match(provenance, /copied-text.*never valid|never valid.*copied-text/i);
  assert.match(provenance, /never copy source text verbatim/i);
  for (const column of ['Pattern', 'Source anchor', 'Reuse type', 'CafeKit destination', 'Evidence/status']) {
    assert.match(provenance, new RegExp(`\\b${column.replace('/', '\\/')}\\b`, 'i'));
  }
  assert.match(provenance, /AgentKit|cafekit-ref/);
  assert.match(provenance, /before implementation/i);
  // H1 remediation: distinguish survey vs verified implementation, fail unsupported claims
  assert.match(provenance, /external survey|not committed/i);
  assert.match(provenance, /survey only|not used|No borrowed text recorded/i);
  assert.match(provenance, /Source anchor.*plans\//);
  assert.match(provenance, /Evidence\/status/i);
  assert.match(provenance, /grep -r.*cafekit-ref/i);
  assert.doesNotMatch(provenance, /AgentKit T1.*implemented as direct source/i);
  // shipped runtime must not contain cafekit-ref/AgentKit verbatim (only ledger/plans may)
  const shippedHits = spawnSync('grep', ['-rn', 'cafekit-ref', 'packages/spec/src', '--include=*.md', '--include=*.cjs', '--include=*.ts'], { encoding: 'utf8' });
  const agentKitHits = spawnSync('grep', ['-rn', 'AgentKit', 'packages/spec/src', '--include=*.md', '--include=*.cjs', '--include=*.ts'], { encoding: 'utf8' });
  assert.equal(shippedHits.stdout.trim(), '', 'shipped runtime must not contain cafekit-ref verbatim');
  assert.equal(agentKitHits.stdout.trim(), '', 'shipped runtime must not contain AgentKit verbatim');
});

const BENCHMARK_SCRIPT = path.join(PACKAGE_ROOT, 'scripts/benchmark-workflow.mjs');
const BENCHMARK_CORPUS_SCHEMA = path.join(PACKAGE_ROOT, 'benchmarks/corpus.schema.json');
const BENCHMARK_CONFIG_EXAMPLE = path.join(PACKAGE_ROOT, 'benchmarks/benchmark-config.example.json');
const BENCHMARK_RUBRIC = path.join(PACKAGE_ROOT, 'benchmarks/rubric.md');
const BENCHMARK_DOCS = path.join(PACKAGE_ROOT, '../../docs/benchmark-workflow.md');

function canonicalBenchmark(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalBenchmark).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalBenchmark(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function benchmarkHash(value) {
  const crypto = require('node:crypto');
  return `sha256:${crypto.createHash('sha256').update(canonicalBenchmark(value)).digest('hex')}`;
}

function benchmarkRawHash(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function writeBenchmarkConfig(file, config) {
  const frozen = { ...config };
  delete frozen.config_sha256;
  frozen.config_sha256 = benchmarkHash(frozen);
  fs.writeFileSync(file, JSON.stringify(frozen));
}

function makeBenchmarkFixture(root) {
  const corpus = {
    schema_version: 'b1.v1', status: 'frozen', corpus_id: 'fixture-only-corpus',
    tasks: [
      { task_id: 'fixture-direct', lane: 'Direct', prompt: 'fixture-only reversible task', repo_sample: 'fixture-repo', acceptance: { criteria: ['fixture criterion'] }, risk: { level: 'low' } },
      { task_id: 'fixture-critical', lane: 'Critical', prompt: 'fixture-only negative control', repo_sample: 'fixture-repo', acceptance: { criteria: ['fixture contract'] }, risk: { level: 'high', reasons: ['fixture negative control'] } },
    ],
  };
  const corpusSha = benchmarkHash(corpus);
  const common = {
    schema_version: 'b1.v1', status: 'frozen', experiment_id: 'fixture-only-experiment',
    model: { name: 'fixture-model', version: 'fixture-version' }, reasoning_effort: 'fixture',
    repo: { identifier: 'fixture-repo', commit: 'abc1234567890', clean_initial_tree_sha: benchmarkHash('fixture-clean-tree') },
    permissions_fingerprint: benchmarkHash('fixture-permissions'), tool_availability_fingerprint: benchmarkHash('fixture-tools'),
    corpus_sha256: corpusSha, repeat_policy: { repeats_per_task: 2, context_isolated: true },
    input_usd_per_1k: 1, output_usd_per_1k: 2,
  };
  const configs = ['baseline', 'treatment'].map((arm) => {
    const config = { ...common, arm };
    config.config_sha256 = benchmarkHash(config);
    return config;
  });
  const artifactRef = 'fixture-artifact.bin';
  const artifactBytes = Buffer.from('fixture-only benchmark artifact\n');
  fs.writeFileSync(path.join(root, artifactRef), artifactBytes);
  const artifactSha = benchmarkRawHash(artifactBytes);
  const receipts = [];
  for (const config of configs) for (const task of corpus.tasks) for (const repeat of [1, 2]) {
    const treatment = config.arm === 'treatment';
    const critical = task.lane === 'Critical';
    const wall = critical ? 300 : (treatment ? 50 : 100) * repeat;
    const input = (treatment ? 100 : 200) * repeat;
    const output = (treatment ? 50 : 100) * repeat;
    receipts.push({
      task_id: task.task_id, lane: task.lane, arm: config.arm, repeat,
      model: config.model, reasoning_effort: config.reasoning_effort,
      repo_commit: config.repo.commit, clean_initial_tree_sha: config.repo.clean_initial_tree_sha,
      permissions_fingerprint: config.permissions_fingerprint, tool_availability_fingerprint: config.tool_availability_fingerprint,
      corpus_sha256: config.corpus_sha256, config_sha256: config.config_sha256,
      wall_ms: wall, input_tokens: input, output_tokens: output, context_loaded_tokens: 500,
      tool_calls: 2, subagent_calls: critical ? 1 : 0, correctness: true, regression: false,
      unsupported_completion_claim: false, user_corrections: 0, useful_reviewer_findings: 1,
      false_positive_reviewer_findings: 0,
      evidence: { artifact_ref: artifactRef, artifact_sha256: artifactSha, command: 'fixture-only command' },
    });
  }
  const paths = { corpus: path.join(root, 'corpus.json'), receipts: path.join(root, 'receipts.json') };
  fs.writeFileSync(paths.corpus, JSON.stringify(corpus));
  fs.writeFileSync(paths.receipts, JSON.stringify({ receipts }));
  paths.configs = configs.map((config, index) => {
    const file = path.join(root, `${config.arm}-${index}.json`);
    fs.writeFileSync(file, JSON.stringify(config));
    return file;
  });
  return paths;
}

test('B1 benchmark artifacts expose bounded CLI contract', () => {
  for (const file of [BENCHMARK_SCRIPT, BENCHMARK_CORPUS_SCHEMA, BENCHMARK_CONFIG_EXAMPLE, BENCHMARK_RUBRIC, BENCHMARK_DOCS]) assert.equal(fs.existsSync(file), true, file);
  assert.match(read(BENCHMARK_DOCS), /live baseline.*treatment.*pending/i);
  assert.match(read(BENCHMARK_DOCS), /`npm test`.*workflow correctness/i);
  assert.match(read(BENCHMARK_CONFIG_EXAMPLE), /TEMPLATE ONLY|example.template/i);
  assert.match(read(BENCHMARK_RUBRIC), /Direct/);
  assert.match(read(BENCHMARK_RUBRIC), /Standard/);
  assert.match(read(BENCHMARK_RUBRIC), /Critical/);
});

test('B1 validator rejects missing freeze fields and accepts fixture-only corpus', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-validation-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    assert.equal(JSON.parse(read(fixture.corpus)).status, 'frozen');
    const valid = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', fixture.receipts], { encoding: 'utf8' });
    assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);
    assert.equal(JSON.parse(valid.stdout).status, 'valid');
    const invalidConfig = JSON.parse(read(fixture.configs[0]));
    delete invalidConfig.clean_initial_tree_sha;
    delete invalidConfig.config_sha256;
    const invalidPath = path.join(root, 'missing-freeze.json');
    fs.writeFileSync(invalidPath, JSON.stringify(invalidConfig));
    const invalid = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', invalidPath], { encoding: 'utf8' });
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /missing or placeholder freeze field/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B1 validator fails closed for templates, prompts, parity, and artifacts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-integrity-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    const templateCorpus = JSON.parse(read(fixture.corpus));
    templateCorpus.status = 'example_template';
    const templatePath = path.join(root, 'template-corpus.json');
    fs.writeFileSync(templatePath, JSON.stringify(templateCorpus));
    const template = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', templatePath, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', fixture.receipts], { encoding: 'utf8' });
    assert.equal(template.status, 2);
    assert.match(template.stderr, /example_template.*receipt validation.*live summary/);

    const placeholderCorpus = JSON.parse(read(fixture.corpus));
    placeholderCorpus.tasks[0].prompt = '{{replace_me}}';
    const placeholderPath = path.join(root, 'placeholder-corpus.json');
    fs.writeFileSync(placeholderPath, JSON.stringify(placeholderCorpus));
    const placeholder = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', placeholderPath, '--config', fixture.configs[0]], { encoding: 'utf8' });
    assert.equal(placeholder.status, 2);
    assert.match(placeholder.stderr, /tasks\[0\]\.prompt.*missing or placeholder/);

    const emptyPromptWithHashCorpus = JSON.parse(read(fixture.corpus));
    emptyPromptWithHashCorpus.tasks[0].prompt = '';
    emptyPromptWithHashCorpus.tasks[0].prompt_sha256 = `sha256:${'1'.repeat(64)}`;
    const emptyPromptWithHashPath = path.join(root, 'empty-prompt-with-hash-corpus.json');
    fs.writeFileSync(emptyPromptWithHashPath, JSON.stringify(emptyPromptWithHashCorpus));
    const emptyPromptWithHash = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', emptyPromptWithHashPath, '--config', fixture.configs[0]], { encoding: 'utf8' });
    assert.equal(emptyPromptWithHash.status, 2);
    assert.match(emptyPromptWithHash.stderr, /tasks\[0\]: exactly one of prompt or prompt_sha256 required/);

    const treatment = JSON.parse(read(fixture.configs[1]));
    treatment.experiment_id = 'different-experiment';
    const parityPath = path.join(root, 'parity-treatment.json');
    writeBenchmarkConfig(parityPath, treatment);
    const parity = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', parityPath], { encoding: 'utf8' });
    assert.equal(parity.status, 2);
    assert.match(parity.stderr, /differ only by arm/);

    const receipts = JSON.parse(read(fixture.receipts));
    const missingArtifactHash = JSON.parse(read(fixture.receipts));
    delete missingArtifactHash.receipts[0].evidence.artifact_sha256;
    const missingArtifactHashPath = path.join(root, 'missing-artifact-hash.json');
    fs.writeFileSync(missingArtifactHashPath, JSON.stringify(missingArtifactHash));
    const missingHash = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', missingArtifactHashPath], { encoding: 'utf8' });
    assert.equal(missingHash.status, 2);
    assert.match(missingHash.stderr, /evidence\.artifact_sha256.*missing or placeholder/);

    receipts.receipts[0].evidence.artifact_sha256 = benchmarkRawHash(Buffer.from('wrong artifact'));
    const wrongHashPath = path.join(root, 'wrong-artifact-hash.json');
    fs.writeFileSync(wrongHashPath, JSON.stringify(receipts));
    const wrongHash = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', wrongHashPath], { encoding: 'utf8' });
    assert.equal(wrongHash.status, 2);
    assert.match(wrongHash.stderr, /artifact_sha256.*raw-byte hash mismatch/);

    receipts.receipts[0].evidence.artifact_ref = 'https://example.invalid/artifact.json';
    const uriPath = path.join(root, 'uri-artifact.json');
    fs.writeFileSync(uriPath, JSON.stringify(receipts));
    const uri = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', uriPath], { encoding: 'utf8' });
    assert.equal(uri.status, 2);
    assert.match(uri.stderr, /artifact_ref.*relative local file.*URI/);

    const outsideArtifact = path.join(path.dirname(root), `${path.basename(root)}-outside.bin`);
    fs.writeFileSync(outsideArtifact, Buffer.from('outside receipt bundle'));
    const traversalReceipts = JSON.parse(read(fixture.receipts));
    traversalReceipts.receipts[0].evidence.artifact_ref = path.relative(root, outsideArtifact);
    traversalReceipts.receipts[0].evidence.artifact_sha256 = benchmarkRawHash(fs.readFileSync(outsideArtifact));
    const traversalPath = path.join(root, 'traversal-artifact.json');
    fs.writeFileSync(traversalPath, JSON.stringify(traversalReceipts));
    const traversal = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', traversalPath], { encoding: 'utf8' });
    assert.equal(traversal.status, 2);
    assert.match(traversal.stderr, /artifact_ref.*path escapes receipt bundle directory/);
    fs.rmSync(outsideArtifact, { force: true });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B1 summary groups fixture-only receipts by arm/lane with deterministic quantiles', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-summary-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    const result = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'summarize', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', fixture.receipts], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'ready');
    assert.equal(summary.groups.baseline.Direct.metrics.wall_ms.median, 150);
    assert.equal(summary.groups.baseline.Direct.metrics.wall_ms.p25, 125);
    assert.equal(summary.groups.baseline.Direct.metrics.wall_ms.p75, 175);
    assert.equal(summary.groups.treatment.Direct.quality_rates.correctness, 1);
    assert.equal(summary.rollout_recommendation.gates.Critical.pass, true);

    const countAggregation = JSON.parse(read(fixture.receipts));
    const countedReceipt = countAggregation.receipts.find((item) => item.arm === 'baseline' && item.lane === 'Direct' && item.repeat === 1);
    countedReceipt.user_corrections = 2;
    countedReceipt.useful_reviewer_findings = 3;
    countedReceipt.false_positive_reviewer_findings = 4;
    const countAggregationPath = path.join(root, 'count-aggregation.json');
    fs.writeFileSync(countAggregationPath, JSON.stringify(countAggregation));
    const countAggregationResult = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'summarize', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', countAggregationPath], { encoding: 'utf8' });
    assert.equal(countAggregationResult.status, 0, `${countAggregationResult.stdout}\n${countAggregationResult.stderr}`);
    const countAggregationSummary = JSON.parse(countAggregationResult.stdout);
    assert.equal(countAggregationSummary.groups.baseline.Direct.quality_rates.user_correction_rate, 1);
    assert.equal(countAggregationSummary.groups.baseline.Direct.quality_rates.useful_reviewer_finding_rate, 2);
    assert.equal(countAggregationSummary.groups.baseline.Direct.quality_rates.false_positive_reviewer_finding_rate, 2);

    const degraded = JSON.parse(read(fixture.receipts));
    for (const receipt of degraded.receipts.filter((item) => item.arm === 'treatment')) {
      receipt.useful_reviewer_findings = 0;
      receipt.false_positive_reviewer_findings = 1;
    }
    const degradedPath = path.join(root, 'degraded-review-quality.json');
    fs.writeFileSync(degradedPath, JSON.stringify(degraded));
    const degradedResult = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'summarize', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', degradedPath], { encoding: 'utf8' });
    assert.equal(degradedResult.status, 0, `${degradedResult.stdout}\n${degradedResult.stderr}`);
    const degradedSummary = JSON.parse(degradedResult.stdout);
    assert.equal(degradedSummary.status, 'not-ready');
    assert.equal(degradedSummary.rollout_recommendation.gates.Critical.quality_pass, false);
    assert.equal(degradedSummary.rollout_recommendation.gates.Critical.pass, false);

    const lowRiskQualityFailure = JSON.parse(read(fixture.receipts));
    for (const receipt of lowRiskQualityFailure.receipts.filter((item) => item.lane === 'Direct')) receipt.correctness = false;
    const lowRiskQualityFailurePath = path.join(root, 'low-risk-quality-failure.json');
    fs.writeFileSync(lowRiskQualityFailurePath, JSON.stringify(lowRiskQualityFailure));
    const lowRiskQualityFailureResult = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'summarize', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', lowRiskQualityFailurePath], { encoding: 'utf8' });
    assert.equal(lowRiskQualityFailureResult.status, 0, `${lowRiskQualityFailureResult.stdout}\n${lowRiskQualityFailureResult.stderr}`);
    const lowRiskQualityFailureSummary = JSON.parse(lowRiskQualityFailureResult.stdout);
    assert.equal(lowRiskQualityFailureSummary.rollout_recommendation.gates.Direct.quality_pass, false);
    assert.equal(lowRiskQualityFailureSummary.rollout_recommendation.gates.Direct.pass, false);
    assert.equal(lowRiskQualityFailureSummary.rollout_recommendation.gates.Critical.pass, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B1 rollout rejects incomplete fixture-only lane/repeat matrices', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-completeness-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    const payload = JSON.parse(read(fixture.receipts));
    const completeReceipts = payload.receipts;
    const partialPath = path.join(root, 'partial.json');
    fs.writeFileSync(partialPath, JSON.stringify({ receipts: completeReceipts.filter((receipt) => !(receipt.arm === 'treatment' && receipt.lane === 'Direct' && receipt.repeat === 1)) }));
    const partial = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'summarize', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', partialPath], { encoding: 'utf8' });
    assert.equal(partial.status, 0, `${partial.stdout}\n${partial.stderr}`);
    const partialSummary = JSON.parse(partial.stdout);
    assert.equal(partialSummary.status, 'not-ready');
    assert.equal(partialSummary.rollout_recommendation.gates.Direct.treatment_matrix.complete, false);
    const incompleteValidation = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', partialPath], { encoding: 'utf8' });
    assert.equal(incompleteValidation.status, 2);
    assert.match(incompleteValidation.stderr, /incomplete receipt matrix.*treatment\/Direct\/fixture-direct\/1/);

    const missingLanePath = path.join(root, 'missing-lane.json');
    fs.writeFileSync(missingLanePath, JSON.stringify({ receipts: completeReceipts.filter((receipt) => !(receipt.arm === 'treatment' && receipt.lane === 'Critical')) }));
    const missingLane = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'summarize', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', missingLanePath], { encoding: 'utf8' });
    assert.equal(missingLane.status, 0, `${missingLane.stdout}\n${missingLane.stderr}`);
    const missingLaneSummary = JSON.parse(missingLane.stdout);
    assert.equal(missingLaneSummary.status, 'not-ready');
    assert.equal(missingLaneSummary.rollout_recommendation.gates.Critical.treatment_matrix.complete, false);

    const outOfRange = JSON.parse(JSON.stringify(completeReceipts));
    outOfRange[0].repeat = 3;
    const outOfRangePath = path.join(root, 'out-of-range.json');
    fs.writeFileSync(outOfRangePath, JSON.stringify({ receipts: outOfRange }));
    const invalidRepeat = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', outOfRangePath], { encoding: 'utf8' });
    assert.equal(invalidRepeat.status, 2);
    assert.match(invalidRepeat.stderr, /exceeds repeat_policy/);

    const duplicateArm = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[0]], { encoding: 'utf8' });
    assert.equal(duplicateArm.status, 2);
    assert.match(duplicateArm.stderr, /duplicate arm/);

    const invalidCorpus = JSON.parse(read(fixture.corpus));
    delete invalidCorpus.corpus_id;
    const invalidCorpusPath = path.join(root, 'missing-corpus-id.json');
    fs.writeFileSync(invalidCorpusPath, JSON.stringify(invalidCorpus));
    const missingCorpusId = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', invalidCorpusPath, '--config', fixture.configs[0]], { encoding: 'utf8' });
    assert.equal(missingCorpusId.status, 2);
    assert.match(missingCorpusId.stderr, /corpus_id.*missing or placeholder/);

    const invalidCost = JSON.parse(read(fixture.configs[0]));
    invalidCost.input_usd_per_1k = 'not-a-rate';
    const invalidCostPath = path.join(root, 'invalid-cost.json');
    fs.writeFileSync(invalidCostPath, JSON.stringify(invalidCost));
    const invalidCostResult = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', invalidCostPath], { encoding: 'utf8' });
    assert.equal(invalidCostResult.status, 2);
    assert.match(invalidCostResult.stderr, /config\.input_usd_per_1k.*non-negative number/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B1 summary marks no receipts exploratory instead of claiming a run', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-empty-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    const result = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'summarize', '--corpus', fixture.corpus, '--config', fixture.configs[0]], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'exploratory/no-live-runs');
    assert.equal(summary.live_runs, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B1 run requires explicit runner contract and rejects placeholders/shell strings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-run-runner-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    // Missing runner
    const missing = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--out', path.join(root, 'out-missing')], { encoding: 'utf8' });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /runner contract is required/);
    assert.match(missing.stderr, /explicit command array/);

    // Placeholder runner (command contains placeholder)
    const placeholderRunner = path.join(root, 'placeholder-runner.json');
    fs.writeFileSync(placeholderRunner, JSON.stringify({ schema_version: 'b1.v1', command: ['node', '{{replace_me}}'] }));
    const placeholder = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', placeholderRunner, '--out', path.join(root, 'out-placeholder')], { encoding: 'utf8' });
    assert.equal(placeholder.status, 2);
    assert.match(placeholder.stderr, /missing or placeholder freeze field/);

    // Shell string forbidden (command as string)
    const shellRunner = path.join(root, 'shell-runner.json');
    fs.writeFileSync(shellRunner, JSON.stringify({ schema_version: 'b1.v1', command: 'node runner.mjs' }));
    const shell = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', shellRunner, '--out', path.join(root, 'out-shell')], { encoding: 'utf8' });
    assert.equal(shell.status, 2);
    assert.match(shell.stderr, /explicit argv|shell string is forbidden/);

    // Missing out/receipts
    const minimalRunner = path.join(root, 'minimal-runner.json');
    fs.writeFileSync(minimalRunner, JSON.stringify({ schema_version: 'b1.v1', command: ['node', '-e', 'process.exit(0)'] }));
    const noOut = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', minimalRunner], { encoding: 'utf8' });
    assert.equal(noOut.status, 2);
    assert.match(noOut.stderr, /output is required/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B1 run executes via explicit argv, captures wall_ms/artifact, and remains honest no-live-runs without execution', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-run-execute-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    // Honest no-live-runs: summarize without receipts must stay exploratory
    const noLive = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'summarize', '--corpus', fixture.corpus, '--config', fixture.configs[0]], { encoding: 'utf8' });
    assert.equal(noLive.status, 0);
    const noLiveSummary = JSON.parse(noLive.stdout);
    assert.equal(noLiveSummary.status, 'exploratory/no-live-runs');
    assert.equal(noLiveSummary.live_runs, false);
    assert.equal(noLiveSummary.rollout_recommendation.status, 'exploratory');
    // Also validate without receipts is valid_no_receipts, not fabricated success
    const validNoReceipts = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0]], { encoding: 'utf8' });
    assert.equal(validNoReceipts.status, 0);
    assert.equal(JSON.parse(validNoReceipts.stdout).status, 'valid_no_receipts');

    // Create minimal deterministic runner that writes artifact and emits metrics JSON
    const runnerScript = path.join(root, 'runner.mjs');
    fs.writeFileSync(runnerScript, `
import fs from 'node:fs';
import path from 'node:path';
let input='';
process.stdin.on('data', c=>input+=c);
process.stdin.on('end', ()=>{
  const payload=JSON.parse(input);
  fs.mkdirSync(path.dirname(payload.artifact_path), {recursive:true});
  fs.writeFileSync(payload.artifact_path, 'artifact:'+payload.task_id+'/'+payload.repeat+'\\n');
  const out={input_tokens:100, output_tokens:50, context_loaded_tokens:500, tool_calls:2, subagent_calls:0, correctness:true, regression:false, unsupported_completion_claim:false, user_corrections:0, useful_reviewer_findings:1, false_positive_reviewer_findings:0};
  process.stdout.write(JSON.stringify(out));
});
`);
    const runnerJson = path.join(root, 'runner.json');
    fs.writeFileSync(runnerJson, JSON.stringify({ schema_version: 'b1.v1', command: ['node', runnerScript] }));
    const outDir = path.join(root, 'out-live');
    const run = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', runnerJson, '--out', outDir], { encoding: 'utf8' });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    const runResult = JSON.parse(run.stdout);
    assert.equal(runResult.status, 'executed');
    assert.equal(runResult.live_runs, true);
    assert.ok(fs.existsSync(path.join(outDir, 'receipts.json')), 'receipts.json must be written');
    // Receipts must be consumable by existing validate/summarize path
    const receipts = JSON.parse(fs.readFileSync(path.join(outDir, 'receipts.json'), 'utf8'));
    assert.ok(Array.isArray(receipts.receipts) || Array.isArray(receipts));
    const validate = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--receipts', path.join(outDir, 'receipts.json')], { encoding: 'utf8' });
    assert.equal(validate.status, 0, `${validate.stdout}\n${validate.stderr}`);
    assert.equal(JSON.parse(validate.stdout).status, 'valid');
    // Ensure receipts capture wall_ms, command, artifact hash and are frozen
    const firstReceipt = (receipts.receipts || receipts)[0];
    assert.ok(typeof firstReceipt.wall_ms === 'number' && firstReceipt.wall_ms >= 0, 'wall_ms captured');
    assert.ok(typeof firstReceipt.evidence.command === 'string' && firstReceipt.evidence.command.includes('node'), 'command captured');
    assert.match(firstReceipt.evidence.artifact_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.equal(firstReceipt.corpus_sha256, JSON.parse(fs.readFileSync(fixture.corpus, 'utf8')).corpus_sha256 || runResult.corpus_sha256 || firstReceipt.corpus_sha256);
    // Artifact file must exist and hash must match raw bytes
    const artifactPath = path.join(outDir, firstReceipt.evidence.artifact_ref);
    assert.ok(fs.existsSync(artifactPath), 'artifact file must exist inside bundle');
    const bytes = fs.readFileSync(artifactPath);
    const expectedHash = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
    assert.equal(firstReceipt.evidence.artifact_sha256, expectedHash);
    // Ensure no secrets leakage: receipts must not contain env secrets (check that known secret pattern not in file)
    const receiptsText = fs.readFileSync(path.join(outDir, 'receipts.json'), 'utf8');
    assert.doesNotMatch(receiptsText, /OPENAI_API_KEY|AWS_SECRET|GITHUB_TOKEN/);
    // Ensure artifact_ref is relative and does not escape
    assert.doesNotMatch(firstReceipt.evidence.artifact_ref, /^\//);
    assert.doesNotMatch(firstReceipt.evidence.artifact_ref, /^\.\./);
    assert.doesNotMatch(firstReceipt.evidence.artifact_ref, /^https?:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B1 run rejects mismatched corpus hash, artifact escape, and partial matrices fail-closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-run-safety-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    const runnerScript = path.join(root, 'safe-runner.mjs');
    fs.writeFileSync(runnerScript, `
import fs from 'node:fs';
import path from 'node:path';
let input='';
process.stdin.on('data', c=>input+=c);
process.stdin.on('end', ()=>{
  const payload=JSON.parse(input);
  fs.mkdirSync(path.dirname(payload.artifact_path), {recursive:true});
  fs.writeFileSync(payload.artifact_path, 'ok');
  const out={input_tokens:100, output_tokens:50, context_loaded_tokens:500, tool_calls:2, subagent_calls:0, correctness:true, regression:false, unsupported_completion_claim:false, user_corrections:0, useful_reviewer_findings:1, false_positive_reviewer_findings:0};
  process.stdout.write(JSON.stringify(out));
});
`);
    const runnerJson = path.join(root, 'runner.json');
    fs.writeFileSync(runnerJson, JSON.stringify({ schema_version: 'b1.v1', command: ['node', runnerScript] }));

    // Mismatched corpus_sha256 in config must be rejected before execution
    const badCorpus = JSON.parse(fs.readFileSync(fixture.corpus, 'utf8'));
    badCorpus.corpus_id = 'tampered-id';
    const badCorpusPath = path.join(root, 'bad-corpus.json');
    fs.writeFileSync(badCorpusPath, JSON.stringify(badCorpus));
    const mismatch = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', badCorpusPath, '--config', fixture.configs[0], '--runner', runnerJson, '--out', path.join(root, 'out-mismatch')], { encoding: 'utf8' });
    assert.equal(mismatch.status, 2);
    assert.match(mismatch.stderr, /corpus_sha256.*does not match corpus|freeze hash mismatch/);

    // Artifact escape via validator: craft receipt with traversal artifact_ref and expect reject
    const traversalReceipts = JSON.parse(fs.readFileSync(fixture.receipts, 'utf8'));
    const outsideArtifact = path.join(path.dirname(root), 'outside.bin');
    fs.writeFileSync(outsideArtifact, Buffer.from('outside'));
    traversalReceipts.receipts[0].evidence.artifact_ref = path.relative(root, outsideArtifact);
    traversalReceipts.receipts[0].evidence.artifact_sha256 = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(outsideArtifact)).digest('hex')}`;
    const traversalPath = path.join(root, 'traversal.json');
    fs.writeFileSync(traversalPath, JSON.stringify(traversalReceipts));
    const traversal = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--config', fixture.configs[1], '--receipts', traversalPath], { encoding: 'utf8' });
    assert.equal(traversal.status, 2);
    assert.match(traversal.stderr, /path escapes receipt bundle directory/);
    fs.rmSync(outsideArtifact, { force: true });

    // Partial matrix: run with runner that fails on one task/repeat must not be reported as valid success
    // Simulate by creating a runner that exits non-zero for one specific task
    const flakyRunner = path.join(root, 'flaky-runner.mjs');
    fs.writeFileSync(flakyRunner, `
import fs from 'node:fs';
import path from 'node:path';
let input='';
process.stdin.on('data', c=>input+=c);
process.stdin.on('end', ()=>{
  const payload=JSON.parse(input);
  if (payload.task_id==='fixture-direct' && payload.repeat===1 && payload.arm==='baseline') process.exit(7);
  fs.mkdirSync(path.dirname(payload.artifact_path), {recursive:true});
  fs.writeFileSync(payload.artifact_path, 'ok');
  const out={input_tokens:100, output_tokens:50, context_loaded_tokens:500, tool_calls:2, subagent_calls:0, correctness:true, regression:false, unsupported_completion_claim:false, user_corrections:0, useful_reviewer_findings:1, false_positive_reviewer_findings:0};
  process.stdout.write(JSON.stringify(out));
});
`);
    const flakyJson = path.join(root, 'flaky.json');
    fs.writeFileSync(flakyJson, JSON.stringify({ schema_version: 'b1.v1', command: ['node', flakyRunner] }));
    const flakyOut = path.join(root, 'out-flaky');
    const flakyRun = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', flakyJson, '--out', flakyOut], { encoding: 'utf8' });
    assert.equal(flakyRun.status, 2);
    assert.match(flakyRun.stderr, /runner exited non-zero|no receipt fabricated/);
    // No valid live success should be claimed from partial run
    if (fs.existsSync(path.join(flakyOut, 'receipts.json'))) {
      const maybeReceipts = JSON.parse(fs.readFileSync(path.join(flakyOut, 'receipts.json'), 'utf8'));
      if (maybeReceipts.receipts) {
        const incompleteValidate = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'validate', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--receipts', path.join(flakyOut, 'receipts.json')], { encoding: 'utf8' });
        assert.equal(incompleteValidate.status, 2);
        assert.match(incompleteValidate.stderr, /incomplete receipt matrix|runner exited/);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B1 runner secret safety: command argv with secret-like assignment/flag is fail-closed and stderr is redacted', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-b1-secret-'));
  const fixture = makeBenchmarkFixture(root);
  try {
    // Helper runner that would succeed if not blocked
    const okRunnerScript = path.join(root, 'ok.mjs');
    fs.writeFileSync(okRunnerScript, `
import fs from 'node:fs';
import path from 'node:path';
let input='';
process.stdin.on('data', c=>input+=c);
process.stdin.on('end', ()=>{
  const p=JSON.parse(input);
  fs.mkdirSync(path.dirname(p.artifact_path), {recursive:true});
  fs.writeFileSync(p.artifact_path,'ok');
  process.stdout.write(JSON.stringify({input_tokens:1,output_tokens:1,context_loaded_tokens:1,tool_calls:0,subagent_calls:0,correctness:true,regression:false,unsupported_completion_claim:false,user_corrections:0,useful_reviewer_findings:0,false_positive_reviewer_findings:0}));
});
`);
    // Secret-like argv must be rejected fail-closed, value not shown, keep shell:false
    const cases = [
      { desc: 'env assignment', command: ['node', okRunnerScript, 'OPENAI_API_KEY=sk-1234567890abcdefghij123456'] },
      { desc: 'flag equals', command: ['node', okRunnerScript, '--api-key=sk-1234567890abcdefghij123456'] },
      { desc: 'flag spaced', command: ['node', okRunnerScript, '--api-key', 'sk-1234567890abcdefghij123456'] },
      { desc: 'password', command: ['node', okRunnerScript, '--password=supersecret1234'] },
      { desc: 'jwt', command: ['node', okRunnerScript, '--jwt-secret=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij'] },
      { desc: 'github token', command: ['node', okRunnerScript, 'GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuv'] },
    ];
    for (const c of cases) {
      const runnerJson = path.join(root, `runner-${c.desc.replace(/\s+/g,'-')}.json`);
      fs.writeFileSync(runnerJson, JSON.stringify({ schema_version: 'b1.v1', command: c.command }));
      const out = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', runnerJson, '--out', path.join(root, `out-${c.desc}`)], { encoding: 'utf8' });
      assert.equal(out.status, 2, `case ${c.desc} should be blocked`);
      assert.match(out.stderr, /secret-like assignment\/flag is forbidden/);
      assert.match(out.stderr, /Value not shown/);
      // Must not leak secret value in error or evidence
      assert.doesNotMatch(out.stderr, /sk-1234567890/);
      assert.doesNotMatch(out.stderr, /supersecret/);
      assert.doesNotMatch(out.stderr, /ghp_/);
      assert.doesNotMatch(out.stderr, /eyJhbGci/);
      // Also ensure stderr snippet does not contain raw secret if leaked via stderr
      // (the runner never executed, so no stderr from runner, just validation error)
    }

    // Safe names must NOT be flagged (no false positive)
    const safeCases = [
      ['node', okRunnerScript, '--tokenizer', 'bert-base'],
      ['node', okRunnerScript, '--api-key-file', '/tmp/keyfile'],
      ['node', okRunnerScript, '--token-path', '/tmp/token'],
      ['node', okRunnerScript, '--password-hint', 'my hint'],
      ['node', okRunnerScript, '--password-label', 'label'],
    ];
    for (const [idx, command] of safeCases.entries()) {
      const runnerJson = path.join(root, `safe-${idx}.json`);
      fs.writeFileSync(runnerJson, JSON.stringify({ schema_version: 'b1.v1', command }));
      const out = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', runnerJson, '--out', path.join(root, `out-safe-${idx}`)], { encoding: 'utf8' });
      // Should not be blocked for secret-like; it should either succeed or fail for other reasons but not secret-like
      assert.doesNotMatch(out.stderr, /secret-like assignment\/flag is forbidden/, `safe case ${command.join(' ')} must not be flagged`);
      assert.equal(out.status, 0, `safe case ${command.join(' ')} should execute (got ${out.stderr})`);
      // Clean out for next
      fs.rmSync(path.join(root, `out-safe-${idx}`), { recursive: true, force: true });
    }

    // Stderr redaction: runner that exits non-zero and leaks secret in stderr must have [REDACTED] and not raw secret
    const leakyRunner = path.join(root, 'leaky.mjs');
    fs.writeFileSync(leakyRunner, `
import fs from 'node:fs';
let input='';
process.stdin.on('data', c=>input+=c);
process.stdin.on('end', ()=>{
  console.error('failed to connect with OPENAI_API_KEY=sk-1234567890abcdefghijklmnopqrstuv and token ghp_1234567890abcdefghijklmnopqrstuv');
  console.error('also password supersecret1234 and jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij');
  process.exit(2);
});
`);
    const leakyJson = path.join(root, 'leaky.json');
    fs.writeFileSync(leakyJson, JSON.stringify({ schema_version: 'b1.v1', command: ['node', leakyRunner] }));
    const leakyOut = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', leakyJson, '--out', path.join(root, 'out-leaky')], { encoding: 'utf8' });
    assert.equal(leakyOut.status, 2);
    assert.match(leakyOut.stderr, /runner exited non-zero/);
    assert.match(leakyOut.stderr, /\[REDACTED\]/);
    assert.doesNotMatch(leakyOut.stderr, /sk-1234567890/);
    assert.doesNotMatch(leakyOut.stderr, /ghp_1234567890/);
    assert.doesNotMatch(leakyOut.stderr, /supersecret/);
    assert.doesNotMatch(leakyOut.stderr, /eyJhbGci/);
    // Ensure no receipt was fabricated
    assert.equal(fs.existsSync(path.join(root, 'out-leaky', 'receipts.json')), false, 'no receipt should be fabricated on stderr secret leak');

    // Also test that evidence.command never contains secret when runner would have been allowed (it is blocked, so no evidence)
    // For a runner that does not contain secret, evidence should contain the safe command
    const safeRunnerForEvidence = path.join(root, 'evidence.mjs');
    fs.writeFileSync(safeRunnerForEvidence, `
import fs from 'node:fs';
import path from 'node:path';
let input='';
process.stdin.on('data', c=>input+=c);
process.stdin.on('end', ()=>{
  const p=JSON.parse(input);
  fs.mkdirSync(path.dirname(p.artifact_path),{recursive:true});
  fs.writeFileSync(p.artifact_path,'evidence');
  process.stdout.write(JSON.stringify({input_tokens:1,output_tokens:1,context_loaded_tokens:1,tool_calls:0,subagent_calls:0,correctness:true,regression:false,unsupported_completion_claim:false,user_corrections:0,useful_reviewer_findings:0,false_positive_reviewer_findings:0}));
});
`);
    const evidenceRunnerJson = path.join(root, 'evidence.json');
    fs.writeFileSync(evidenceRunnerJson, JSON.stringify({ schema_version: 'b1.v1', command: ['node', safeRunnerForEvidence, '--verbose'] }));
    const evidenceOut = path.join(root, 'out-evidence');
    const evidenceRun = spawnSync(process.execPath, [BENCHMARK_SCRIPT, 'run', '--corpus', fixture.corpus, '--config', fixture.configs[0], '--runner', evidenceRunnerJson, '--out', evidenceOut], { encoding: 'utf8' });
    assert.equal(evidenceRun.status, 0);
    const evidenceReceipts = JSON.parse(fs.readFileSync(path.join(evidenceOut, 'receipts.json'), 'utf8'));
    const ev = (evidenceReceipts.receipts || evidenceReceipts)[0].evidence;
    assert.match(ev.command, /node/);
    assert.doesNotMatch(ev.command, /sk-|ghp_|eyJ/);
    assert.doesNotMatch(JSON.stringify(evidenceReceipts), /OPENAI_API_KEY/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── P0 regressions ──────────────────────────────────────────────────────
test('P0 receipt fail-closed: Exit 1/-1/abc/conflict/empty command rejected', () => {
  const base = 'Verification: PASS\nCommand: pnpm test\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n';
  const cases = [
    { body: `${base}Exit: 1\n`, shouldFail: 'exit_result', desc: 'Exit 1' },
    { body: `${base}Exit: -1\n`, shouldFail: 'exit_result', desc: 'Exit -1' },
    { body: `${base}Exit: abc\n`, shouldFail: 'exit_result', desc: 'Exit abc' },
    { body: `${base}Exit: 0\nExit: 1\n`, shouldFail: 'exit_result', desc: 'conflicting exits 0 and 1' },
    { body: `${base}Exit: 0\nExit: abc\n`, shouldFail: 'exit_result', desc: 'conflicting exit 0 and abc' },
    { body: 'Verification: PASS\nCommand:\nExit: 0\nBase: a\nHead: b\n', shouldFail: 'command', desc: 'empty command' },
    { body: 'Verification: PASS\nCommand:   \nExit: 0\nBase: a\nHead: b\n', shouldFail: 'command', desc: 'command spaces only' },
    { body: `${base}Exit: 0\nResult: FAIL\n`, shouldFail: 'exit_result', desc: 'Result FAIL with Exit 0' },
    { body: `${base}Exit: 1\nResult: PASS\n`, shouldFail: 'exit_result', desc: 'Result PASS with Exit 1' },
    { body: 'Verification: PASS\nCommand: pnpm test\nResult: PASS\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n', shouldFail: null, desc: 'Result PASS without Exit (legacy alias ok)' },
    { body: 'Verification: PASS\nCommand: pnpm test\nResult: FAIL\nBase: a\nHead: b\n', shouldFail: 'exit_result', desc: 'Result FAIL without Exit' },
    { body: 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: {{base}}\nHead: {{head}}\n', shouldFail: 'placeholder', desc: 'placeholder provenance' },
    { body: 'Verification: PASS\nCommand: {{cmd}}\nExit: 0\nBase: a\nHead: b\n', shouldFail: 'placeholder', desc: 'placeholder command' },
    { body: 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\n', shouldFail: 'provenance', desc: 'missing Head' },
  ];
  for (const { body, shouldFail, desc } of cases) {
    const fails = POLICY.validateCanonicalReceipt(body);
    if (shouldFail) {
      assert.ok(fails.includes(shouldFail) || fails.includes('placeholder') || fails.includes('exit_result') || fails.includes('command') || fails.includes('provenance'), `case ${desc} should fail with ${shouldFail}, got ${fails}`);
    } else {
      assert.deepEqual(fails, [], `case ${desc} should pass, got ${fails}`);
    }
  }
  // CLI parity: Exit 1 must be rejected via CLI
  const cli = spawnSync(process.execPath, [POLICY_PATH, '--validate-receipt', '--task-json', JSON.stringify({ body: `${base}Exit: 1\n` }), '--json'], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.equal(JSON.parse(cli.stdout).ok, false);
});

test('P0 flash marker-only must not promote or finalize', () => {
  const flash = canonicalFlashTask({ blocker: 'awaiting /cf:test' });
  const markerOnly = 'Verification: PASS';
  const promoted = POLICY.promoteFlashTask(flash, 'PASS', markerOnly);
  assert.equal(promoted.status, 'in_progress');
  assert.equal(promoted.receipt, 'FLASH_UNVERIFIED');
  assert.equal(promoted.readyForSync, false);
  assert.equal(promoted.dependencyBlocked, true);
  assert.equal(promoted.unblocks, false);
  assert.match(promoted.blocker, /canonical receipt/);
  // Even with PASS marker but missing command/exit/provenance, finalize must not complete
  const fakePromoted = { status: 'in_progress', receipt: markerOnly, readyForSync: true, dependencyBlocked: true, unblocks: false };
  const notFinalized = POLICY.finalizeFlashTask(fakePromoted, 'sync-finalize');
  assert.equal(notFinalized.status, 'in_progress', 'marker-only receipt must not finalize');
  // Valid receipt promotes correctly
  const valid = canonicalReceipt();
  const good = POLICY.promoteFlashTask(flash, 'PASS', valid);
  assert.equal(good.readyForSync, true);
  assert.equal(good.receipt, valid.trim());
  const forgedFinalize = POLICY.finalizeFlashTask(good, 'sync-finalize');
  assert.equal(forgedFinalize.status, 'in_progress');
  assert.equal(forgedFinalize.unblocks, false);
  const finalized = POLICY.syncFinalizeFlashTask(flash, 'PASS', valid);
  assert.equal(finalized.status, 'done');
});

test('P0 canonical artifacts declaration requires SHA-256 and keeps no-artifact receipts compatible', () => {
  const receipt = 'Verification: PASS\nCommand: node --test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n';
  const invalid = `${receipt}sha256: abc123\n`;
  const digest = 'd'.repeat(64);
  const valid = `${receipt}Artifact: output/bundle.js\nSHA-256: ${digest}\n`;
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt), []);
  const options = POLICY.receiptValidatorOptions({ artifacts: ['output/bundle.js'] });
  assert.equal(options.requireArtifactHash, true);
  assert.equal(options.artifactDeclarationValid, true);
  assert.ok(POLICY.validateCanonicalReceipt(receipt, options).includes('artifact_hash'));
  assert.ok(POLICY.validateCanonicalReceipt(invalid, options).includes('artifact_hash'));
  assert.deepEqual(POLICY.validateCanonicalReceipt(valid, options), []);
  assert.equal(POLICY.receiptValidatorOptions({}).requireArtifactHash, false);
  assert.equal(POLICY.receiptValidatorOptions({ artifact_ref: 'output/bundle.js' }).requireArtifactHash, true, 'legacy alias remains read-compatible');
  for (const declaration of [null, [], ['../outside'], [{ path: 'output/bundle.js' }]]) {
    const malformed = POLICY.receiptValidatorOptions({ artifacts: declaration });
    assert.equal(malformed.artifactDeclarationValid, false, `malformed declaration must be rejected: ${JSON.stringify(declaration)}`);
    assert.ok(POLICY.validateCanonicalReceipt(receipt, malformed).includes('artifact_declaration'));
  }
});

test('P0 sync-finalize derives promotion from current FLASH_UNVERIFIED plus explicit PASS proof', () => {
  const receipt = canonicalReceipt('node --test');
  const forged = {
    status: 'in_progress',
    receipt,
    readyForSync: true,
    dependencyBlocked: true,
    unblocks: false,
    flashTransition: 'promoted',
    promotionReceipt: receipt,
  };
  const direct = spawnSync(process.execPath, [
    POLICY_PATH,
    '--sync-finalize',
    '--task-json',
    JSON.stringify(forged),
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(direct.status, 2, `${direct.stdout}\n${direct.stderr}`);
  const directPayload = JSON.parse(direct.stdout);
  assert.equal(directPayload.ok, false);
  assert.equal(directPayload.task.status, 'in_progress');
  assert.equal(directPayload.task.receipt, 'FLASH_UNVERIFIED');
  assert.equal(directPayload.task.readyForSync, false);
  assert.equal(directPayload.task.dependencyBlocked, true);
  assert.equal(directPayload.task.unblocks, false);
  assert.match(directPayload.message, /current task must be FLASH_UNVERIFIED.*canonical/i);

  const minimal = { status: 'in_progress', receipt: 'FLASH_UNVERIFIED' };
  const minimalResult = POLICY.syncFinalizeFlashTask(minimal, 'PASS', receipt);
  assert.equal(minimalResult.status, 'in_progress');
  assert.match(minimalResult.blocker, /exact canonical stored state/);
  const forgedOpen = { ...canonicalFlashTask(), readyForSync: true };
  const forgedOpenResult = POLICY.syncFinalizeFlashTask(forgedOpen, 'PASS', receipt);
  assert.equal(forgedOpenResult.status, 'in_progress');
  assert.equal(forgedOpenResult.unblocks, false);

  const current = canonicalFlashTask({ blocker: 'awaiting /cf:test' });
  const supported = spawnSync(process.execPath, [
    POLICY_PATH,
    '--sync-finalize',
    '--task-json',
    JSON.stringify(current),
    '--verdict',
    'PASS',
    '--proof',
    receipt,
    '--project-root',
    RUNTIME_ROOT,
    '--specs-root',
    path.join(RUNTIME_ROOT, 'specs'),
    '--spec-file',
    RUNTIME_SPEC,
    '--feature-name',
    'demo',
    '--runtime-session',
    'implementation-session-1',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(supported.status, 0, `${supported.stdout}\n${supported.stderr}`);
  assert.equal(JSON.parse(supported.stdout).task.status, 'done');
  const warningFinalize = POLICY.syncFinalizeFlashTask(current, 'PASS_WITH_WARNINGS', receipt);
  assert.equal(warningFinalize.status, 'in_progress');
  assert.equal(warningFinalize.unblocks, false);

  const initial = canonicalFlashTask();
  const promoted = POLICY.promoteFlashTask(initial, 'PASS', receipt);
  const persisted = JSON.parse(JSON.stringify(promoted));
  assert.equal(persisted.flashTransition, 'promoted');
  assert.equal(persisted.promotionReceipt, receipt.trim());
  const forgedPersistedFinalize = POLICY.finalizeFlashTask(persisted, 'sync-finalize');
  assert.equal(forgedPersistedFinalize.status, 'in_progress');
  assert.equal(forgedPersistedFinalize.unblocks, false);
  const finalized = POLICY.syncFinalizeFlashTask(initial, 'PASS', receipt);
  assert.equal(finalized.status, 'done');
  assert.equal(finalized.flashTransition, 'finalized');

  const artifactInitial = { ...initial, artifacts: ['output/bundle.js'] };
  const artifactPromotion = POLICY.promoteFlashTask(artifactInitial, 'PASS', receipt);
  assert.equal(artifactPromotion.readyForSync, false, 'flash promotion must apply task artifact requirements');

  const badProof = spawnSync(process.execPath, [
    POLICY_PATH,
    '--sync-finalize',
    '--task-json',
    JSON.stringify(current),
    '--verdict',
    'PASS',
    '--proof',
    'Verification: PASS',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(badProof.status, 2);
  assert.equal(JSON.parse(badProof.stdout).task.status, 'in_progress');

  const badArtifact = spawnSync(process.execPath, [
    POLICY_PATH,
    '--sync-finalize',
    '--task-json',
    JSON.stringify({ ...current, artifacts: ['output/bundle.js'] }),
    '--verdict',
    'PASS',
    '--proof',
    receipt,
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(badArtifact.status, 2);
  assert.equal(JSON.parse(badArtifact.stdout).task.status, 'in_progress');

  const markerOnly = {
    ...forged,
    flashTransition: 'promoted',
    promotionReceipt: 'Verification: PASS',
    receipt: 'Verification: PASS',
  };
  assert.equal(POLICY.finalizeFlashTask(markerOnly, 'sync-finalize').status, 'in_progress');
});

test('P0 Claude and Codex reject configured specs roots outside the project', () => {
  const claudeResolver = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));
  const codexUtils = require(path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-utils.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-external-specs-'));
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-configured-specs-'));
  try {
    const local = path.join(tmp, 'specs', 'local');
    const external = path.join(externalRoot, 'remote');
    fs.mkdirSync(local, { recursive: true });
    fs.mkdirSync(external, { recursive: true });
    fs.writeFileSync(path.join(local, 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: 'local' }));
    fs.writeFileSync(path.join(external, 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: 'remote' }));
    const runtime = { paths: { specs: externalRoot } };
    const claude = claudeResolver.resolveActiveSpec({ projectRoot: tmp, runtime });
    const codex = codexUtils.resolveActiveSpec(tmp, runtime, null, null);
    assert.equal(claude.error, 'invalid_specs');
    assert.equal(codex.error, 'invalid_specs');
    assert.match(claude.reason, /escapes project root/);
    assert.match(codex.reason, /escapes project root/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(externalRoot, { recursive: true, force: true });
  }
});

test('P0 caller-owned downgrade flags have no canonical capability', () => {
  for (const callerClaim of [{ user_approved: true }, { userApproved: true }, { userAuthorized: true }]) {
    assert.throws(
      () => POLICY.classifyLane({ riskSignals: { privacy: true }, override: 'Direct', ...callerClaim }),
      (error) => /downgrade/.test(error.message) && /not permitted/.test(error.message),
    );
  }
  assert.throws(() => POLICY.classifyLane({ riskSignals: { auth: true }, override: 'Standard', confirmDowngrade: true }), /assurance_level downgrade.*blocked/i);
  assert.equal(POLICY.isUserAuthorizedForDowngrade, undefined);
});

test('P0 canonical policy exposes no caller-owned downgrade authority', () => {
  assert.equal(POLICY.isUserAuthorizedForDowngrade, undefined);
  assert.equal(POLICY.isValidOverrideReceipt, undefined);
  assert.equal(POLICY.CANONICAL_WORKFLOW_POLICY_FIELDS.includes('override_' + 'receipt'), false);
  assert.throws(
    () => POLICY.classifyLane({
      riskSignals: { privacy: true },
      override: 'Direct',
      overrideReceipt: { verifiedByRuntime: true },
    }),
    (error) => /downgrade/.test(error.message) && /not permitted/.test(error.message),
  );
});

test('P0 active spec deterministic: multiple active ambiguity and explicit target/path containment', () => {
  const RESOLVER = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-resolver-'));
  try {
    const specsDir = path.join(tmp, 'specs');
    fs.mkdirSync(specsDir, { recursive: true });
    // Create two active specs
    for (const name of ['alpha', 'beta']) {
      fs.mkdirSync(path.join(specsDir, name), { recursive: true });
      fs.writeFileSync(path.join(specsDir, name, 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: name, current_phase: 'design' }));
    }
    const amb = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {} });
    assert.equal(amb.error, 'multiple_active');
    assert.deepEqual(amb.candidates.sort(), ['alpha', 'beta']);
    // Explicit feature resolves deterministically
    const alpha = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {}, explicitFeature: 'alpha' });
    assert.equal(alpha.featureName, 'alpha');
    // Explicit not-found fail-closed
    const notFound = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {}, explicitFeature: 'gamma' });
    assert.equal(notFound.error, 'explicit_not_found');
    // Explicit path containment: try to escape via ../
    const escape = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {}, explicitPath: path.join(tmp, 'specs', '..', 'etc', 'passwd') });
    assert.equal(escape.error, 'explicit_malformed');
    // Malformed feature name with slash must be rejected
    const malformed = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {}, explicitFeature: '../alpha' });
    assert.equal(malformed.error, 'explicit_malformed');
    // Valid explicit path inside root
    const validPath = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {}, explicitPath: path.join(specsDir, 'beta', 'spec.json') });
    assert.equal(validPath.featureName, 'beta');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('P0 parity Claude/Codex: canonical receipt and multi-active', () => {
  // Codex receipt validator must match Claude policy
  const codexReceipt = require(path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-receipt.cjs'));
  const claudeFails = POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 1\nBase: a\nHead: b\n');
  const codexFails = codexReceipt.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 1\nBase: a\nHead: b\n');
  assert.deepEqual(claudeFails.sort(), codexFails.sort(), 'Claude and Codex validators must agree on Exit 1');
  const codexEmptyCmd = codexReceipt.validateCanonicalReceipt('Verification: PASS\nCommand:\nExit: 0\nBase: a\nHead: b\n');
  assert.ok(codexEmptyCmd.includes('command'), 'Codex must reject empty Command');
  // Codex resolver parity: same containment behaviour
  const codexUtils = require(path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-utils.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-resolver-'));
  try {
    const specsDir = path.join(tmp, 'specs');
    fs.mkdirSync(specsDir, { recursive: true });
    for (const name of ['x', 'y']) {
      fs.mkdirSync(path.join(specsDir, name), { recursive: true });
      fs.writeFileSync(path.join(specsDir, name, 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: name }));
    }
    const amb = codexUtils.resolveActiveSpec(tmp, {}, null, null);
    assert.equal(amb.error, 'multiple_active');
    const esc = codexUtils.resolveActiveSpec(tmp, {}, null, path.join(tmp, 'specs', '..', 'outside', 'spec.json'));
    assert.equal(esc.error, 'explicit_malformed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('P0 regression: placeholder, explicit failure, artifact and lanePolicy forged are blocked', () => {
  // Probe A: explicit failure outcomes must fail canonical validator and not promote flash
  const bodyTestsFailed = 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nTests failed: 1\n';
  assert.ok(POLICY.validateCanonicalReceipt(bodyTestsFailed).length > 0, 'Tests failed: 1 must be rejected');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nResult: FAIL\nResult: PASS\n').includes('exit_result'), 'Result FAIL then PASS must be rejected');
  const flashTask = { status: 'in_progress', receipt: 'FLASH_UNVERIFIED', blocker: 'awaiting', dependencyBlocked: true, unblocks: false };
  const notPromoted = POLICY.promoteFlashTask(flashTask, 'PASS', bodyTestsFailed);
  assert.equal(notPromoted.readyForSync, false, 'flash with Tests failed should not promote');
  assert.equal(notPromoted.receipt, 'FLASH_UNVERIFIED');

  // Probe B: placeholder tokens must be rejected, but substring todo must pass
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: TODO\nExit: 0\nBase: a\nHead: b\n').includes('command'), 'Command TODO must be rejected');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: TBD\nHead: b\n').includes('provenance'), 'Base TBD must be rejected');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: N/A\n').includes('provenance'), 'Head N/A must be rejected');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nbase_sha: pending\nhead_sha: unknown\n').includes('provenance'), 'base_sha pending must be rejected');
  assert.deepEqual(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: npm run todo:test --fix\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n'), [], 'command containing todo substring should pass');

  // Probe C: artifact with empty or placeholder sha must fail, concrete passes, inline passes
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nArtifact: x\nsha256: \n').includes('artifact_hash'), 'artifact empty sha must fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nArtifact: x\nsha256: TBD\n').includes('artifact_hash'), 'artifact TBD sha must fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nArtifact: bundle\nsha256: abc123\n').includes('artifact_hash'), 'short artifact sha must fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nArtifact produced sha256:deadbeef\n').includes('artifact_hash'), 'short inline sha256 must fail');
  assert.deepEqual(POLICY.validateCanonicalReceipt(`Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\nArtifact: bundle\nsha256: ${'c'.repeat(64)}\n`), [], '64-hex artifact sha should pass');

  // Probe F: lanePolicy forged plain object must not bypass classification
  const { spawnSync } = require('node:child_process');
  const POLICY_PATH = path.join(PACKAGE_ROOT, 'src/claude/scripts/workflow-policy.cjs');
  const forged = spawnSync(process.execPath, [POLICY_PATH, '--lane-policy', '--task-json', JSON.stringify({ lane: 'Direct', automaticLane: 'Direct', riskSignals: { auth: true } }), '--json'], { encoding: 'utf8' });
  assert.equal(forged.status, 2, 'forged Direct with auth should be blocked via lanePolicy');
  assert.match(forged.stderr, /downgrade.*not permitted/i);
  const forged2 = spawnSync(process.execPath, [POLICY_PATH, '--lane-policy', '--task-json', JSON.stringify({ lane: 'Direct', automaticLane: 'Direct' }), '--json'], { encoding: 'utf8' });
  assert.equal(forged2.status, 2, 'plain Direct without justification should be blocked');

  const trusted = POLICY.classifyLane({ reversible: true, lowRisk: true, isolated: true });
  assert.equal(trusted.lane, 'Direct');
  const viaPolicy = POLICY.lanePolicy(trusted);
  assert.equal(viaPolicy.lane, 'Direct', 'trusted Direct should be respected');
  assert.throws(() => { 'use strict'; trusted.lane = 'Direct'; }, /read only|Cannot assign|TypeError/);
  const paymentTrusted = POLICY.classifyLane({ riskSignals: { payment: true } });
  const forgedCopy = { ...paymentTrusted, lane: 'Direct' };
  assert.equal(POLICY.lanePolicy(forgedCopy).lane, 'Standard', 'compatibility lane is derived from authoritative axes');
});

test('P0 regression: symlink spec/task containment and malformed spec handling', () => {
  const RESOLVER = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-regression-symlink-'));
  try {
    const specsDir = path.join(tmp, 'specs');
    fs.mkdirSync(specsDir, { recursive: true });
    fs.mkdirSync(path.join(specsDir, 'valid'), { recursive: true });
    fs.writeFileSync(path.join(specsDir, 'valid', 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: 'valid' }));
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'spec.json'), JSON.stringify({ status: 'in_progress' }));
    const link = path.join(specsDir, 'linked');
    fs.symlinkSync(outside, link);
    const e1 = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {}, explicitFeature: 'linked' });
    assert.equal(e1.error, 'explicit_malformed');
    const e2 = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {}, explicitPath: path.join(specsDir, 'linked', 'spec.json') });
    assert.equal(e2.error, 'explicit_malformed');
    const nonExplicit = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {} });
    assert.equal(nonExplicit.error, 'invalid_specs');
    assert.ok(nonExplicit.candidates.includes('linked'));
    const featDir = path.join(specsDir, 'valid');
    fs.mkdirSync(path.join(featDir, 'tasks'), { recursive: true });
    const taskOutside = path.join(tmp, 'outside-task.md');
    fs.writeFileSync(taskOutside, '# Task\n\n**Status:** done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\n');
    const taskLink = path.join(featDir, 'tasks', 'task.md');
    fs.symlinkSync(taskOutside, taskLink);
    const codexReceipt = require(path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-receipt.cjs'));
    const fails = codexReceipt.checkReceipt(featDir, 'tasks/task.md', { status: 'done', completed_at: '2026-08-11T00:00:00.000Z' });
    assert.ok(fails.includes('a'), 'task symlink outside should be rejected as check a');
    fs.mkdirSync(path.join(specsDir, 'bad'), { recursive: true });
    fs.writeFileSync(path.join(specsDir, 'bad', 'spec.json'), '{ malformed');
    const mal = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {} });
    assert.equal(mal.error, 'invalid_specs');
    assert.ok(mal.candidates.includes('bad'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('P0 regression: artifact hash scoped to structured Artifact declaration and explicit failure structured only', () => {
  // Artifact hash only required when structured Artifact declaration exists
  const prefix = 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n';
  const receipt = (suffix = '') => `${prefix}${suffix}`;
  const digestA = 'a'.repeat(64);
  const digestB = 'b'.repeat(64);
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt('Command: npm run artifact:test\n')), [], 'Command containing artifact without hash should pass');
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt('Notes: artifact behavior without declaration\n')), [], 'Notes containing artifact without structured declaration should pass');
  assert.ok(POLICY.validateCanonicalReceipt(receipt('Artifact: bundle\n')).includes('artifact_hash'), 'Artifact: without hash should fail');
  assert.ok(POLICY.validateCanonicalReceipt(receipt('Artifacts: bundle\nsha256: TBD\n')).includes('artifact_hash'), 'Artifacts: with TBD should fail');
  assert.ok(POLICY.validateCanonicalReceipt(receipt('Artifact produced sha256:deadbeef\n')).includes('artifact_hash'), 'short artifact hash must fail');
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt(`Artifact produced sha256:${digestA}\n`)), [], '64-hex artifact hash should pass');

  const artifactOptions = POLICY.receiptValidatorOptions({ artifacts: ['artifacts/a.js', 'artifacts/b.js'] });
  assert.ok(POLICY.validateCanonicalReceipt(receipt(`Artifact: artifacts/a.js\nSHA-256: ${digestA}\n`), artifactOptions).includes('artifact_hash'), 'missing second artifact binding must fail');
  assert.ok(POLICY.validateCanonicalReceipt(receipt(`Artifact: artifacts/a.js + artifacts/b.js\nSHA-256: ${digestA}\n`), artifactOptions).includes('artifact_hash'), 'one hash must not bind a combined multi-artifact declaration');
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt(`Artifact: artifacts/a.js\nSHA-256: ${digestA}\nArtifact: artifacts/b.js\nSHA-256: ${digestB}\n`), artifactOptions), [], 'each declared artifact must bind to its hash');
  assert.ok(POLICY.validateCanonicalReceipt(receipt('Artifact: artifacts/a.js\nSHA-256: deadbeef\nArtifact: artifacts/b.js\nSHA-256: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n'), artifactOptions).includes('artifact_hash'), 'short per-artifact hash must fail');

  const falseGreen = receipt([
    'Tests run: 0',
    '0 passing',
    'Failures: 1',
    'failure summary',
    'Result: PASS',
    'Artifact produced sha256:deadbeef',
    'Artifact: bundle + sha256:abc123',
  ].join('\n') + '\n');
  assert.ok(POLICY.validateCanonicalReceipt(falseGreen).length > 0, 'false-green independent-review vector must fail');

  // Explicit failure structured only: prose containing failure should not block, Tests failed: 0 should pass
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt('Notes: verifies failure handling\n')), [], 'Notes with failure handling should not block');
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt('Description: failure recovery\n')), [], 'Description with failure should not block');
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt('Tests failed: 0\n')), [], 'Tests failed: 0 should pass');
  assert.deepEqual(POLICY.validateCanonicalReceipt(receipt('fail 0\n')), [], 'fail 0 should pass');
  // Structured failures still blocked
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nStatus: FAILED\n').length > 0, 'Status: FAILED should fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nOutcome: FAILURE\n').length > 0, 'Outcome: FAILURE should fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nResult: FAILED\n').length > 0, 'Result: FAILED should fail');
  // TAP and Jest runner summaries (structured, anchored)
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\n# fail 1\n').length > 0, 'TAP # fail 1 should fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nℹ fail 2\n').length > 0, 'TAP ℹ fail 2 should fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nnot ok 1 - test\n').length > 0, 'TAP not ok 1 should fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nTests: 1 failed, 2 passed\n').length > 0, 'Jest Tests: 1 failed should fail');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\n1 failed, 2 passed\n').length > 0, '1 failed summary should fail');
  assert.deepEqual(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n# fail 0\n'), [], 'TAP # fail 0 should pass');
  assert.deepEqual(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\nTests: 0 failed\n'), [], 'Tests: 0 failed should pass');
});

test('P0 regression: safeTaskFile fail-closed on realpath error and single authority', () => {
  const fs2 = require('node:fs');
  const path2 = require('node:path');
  const os2 = require('node:os');
  const specGatePath = path2.join(PACKAGE_ROOT, 'src/claude/hooks/spec-gate.cjs');
  const specGateSrc = fs2.readFileSync(specGatePath, 'utf8');
  // Single authority: Claude hook should delegate to POLICY, not duplicate parser
  assert.match(specGateSrc, /POLICY\.validateCanonicalReceipt/);
  assert.doesNotMatch(specGateSrc, /const EXPLICIT_FAILURE/);
  // Codex should delegate to shared workflow-policy
  const codexSrc = fs2.readFileSync(path2.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-receipt.cjs'), 'utf8');
  assert.match(codexSrc, /getSharedValidate/);
  assert.match(codexSrc, /workflow-policy\.cjs/);
  assert.doesNotMatch(codexSrc, /const PLACEHOLDER_TOKENS/);
  // safeTaskFile fail-closed: simulate realpathSync throwing
  const tmp = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'cafekit-realpath-'));
  try {
    const featDir = path2.join(tmp, 'feat');
    fs2.mkdirSync(path2.join(featDir, 'tasks'), { recursive: true });
    fs2.writeFileSync(path2.join(featDir, 'tasks', 'task.md'), '# Task\n\n**Status:** done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\n');
    const orig = fs2.realpathSync;
    fs2.realpathSync = () => { throw new Error('simulated realpath failure'); };
    try {
      const codexReceipt = require(path2.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-receipt.cjs'));
      const fails = codexReceipt.checkReceipt(featDir, 'tasks/task.md', { status: 'done', completed_at: '2026-08-11T00:00:00.000Z' });
      assert.ok(fails.includes('a'), 'realpath failure should be fail-closed with check a');
    } finally {
      fs2.realpathSync = orig;
    }
  } finally {
    fs2.rmSync(tmp, { recursive: true, force: true });
  }
});

test('P0 regression: resolver fail-closed on canonicalization and lstat errors', () => {
  const fs2 = require('node:fs');
  const path2 = require('node:path');
  const os2 = require('node:os');
  const RESOLVER = require(path2.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));
  const tmp = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'cafekit-resolver-fail-'));
  try {
    const specsDir = path2.join(tmp, 'specs');
    fs2.mkdirSync(path2.join(specsDir, 'demo'), { recursive: true });
    fs2.writeFileSync(path2.join(specsDir, 'demo', 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: 'demo' }));
    // Monkey patch realpathSync to always throw for explicitFeature
    const origRealpath = fs2.realpathSync;
    fs2.realpathSync = () => { throw Object.assign(new Error('simulated EACCES'), { code: 'EACCES' }); };
    try {
      const res = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {}, explicitFeature: 'demo' });
      assert.equal(res.error, 'explicit_malformed', 'explicitFeature realpath failure should be explicit_malformed');
      assert.match(res.reason, /canonicalization error/);
    } finally {
      fs2.realpathSync = origRealpath;
    }
    // Non-explicit with specs root realpath failure should be invalid_specs <specs>
    const origRealpath2 = fs2.realpathSync;
    fs2.realpathSync = (p) => {
      if (p === specsDir || p === path2.resolve(specsDir)) throw Object.assign(new Error('simulated ELOOP'), { code: 'ELOOP' });
      return origRealpath2(p);
    };
    try {
      const res2 = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {} });
      assert.equal(res2.error, 'invalid_specs');
      assert.ok(res2.candidates.includes('<specs>'));
    } finally {
      fs2.realpathSync = origRealpath2;
    }
    // lstat error for entry (simulate EACCES on lstat)
    const origLstat = fs2.lstatSync;
    fs2.lstatSync = (p) => {
      if (p.includes('demo')) throw Object.assign(new Error('simulated EACCES'), { code: 'EACCES' });
      return origLstat(p);
    };
    try {
      const res3 = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {} });
      assert.equal(res3.error, 'invalid_specs');
      assert.ok(res3.candidates.includes('demo'));
    } finally {
      fs2.lstatSync = origLstat;
    }
    // Dangling spec.json symlink should be invalid_specs
    const outside = path2.join(tmp, 'outside-spec2');
    fs2.mkdirSync(outside, { recursive: true });
    fs2.writeFileSync(path2.join(outside, 'spec.json'), JSON.stringify({ status: 'in_progress' }));
    const featDir = path2.join(specsDir, 'dangle');
    fs2.mkdirSync(featDir, { recursive: true });
    const specLink = path2.join(featDir, 'spec.json');
    fs2.symlinkSync(path2.join(tmp, 'nonexistent-target'), specLink);
    const res4 = RESOLVER.resolveActiveSpec({ projectRoot: tmp, runtime: {} });
    assert.equal(res4.error, 'invalid_specs');
    assert.ok(res4.candidates.includes('dangle'));
  } finally {
    fs2.rmSync(tmp, { recursive: true, force: true });
  }
  // Codex parity: same monkey patch should give explicit_malformed
  const codexUtils = require(path2.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-utils.cjs'));
  const tmp2 = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'cafekit-codex-fail-'));
  try {
    const specsDir2 = path2.join(tmp2, 'specs');
    fs2.mkdirSync(path2.join(specsDir2, 'demo2'), { recursive: true });
    fs2.writeFileSync(path2.join(specsDir2, 'demo2', 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: 'demo2' }));
    const orig = fs2.realpathSync;
    fs2.realpathSync = () => { throw Object.assign(new Error('simulated EACCES'), { code: 'EACCES' }); };
    try {
      const r = codexUtils.resolveActiveSpec(tmp2, {}, 'demo2', null);
      assert.equal(r.error, 'explicit_malformed');
    } finally {
      fs2.realpathSync = orig;
    }
  } finally {
    fs2.rmSync(tmp2, { recursive: true, force: true });
  }
});

test('P0 canonical phantom vectors - zero, cancellation, suite, FAIL, error, collected (r3)', () => {
  const base = 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n';
  // 1. Zero execution
  const zeroFail = [
    'ℹ tests 0',
    'Tests: 0 total',
    '0 tests',
    'Tests: 0 passed',
    'Tests: 0 passing',
    'Test Suites: 0 failed, 0 passed',
    'Tests passed: 0',
    'Passed: 0',
    'one failing',
    'failureCount: 1',
    'collected 0 items',
    'No tests found.',
    'No tests found',
  ];
  for (const v of zeroFail) {
    assert.ok(POLICY.validateCanonicalReceipt(base + v + '\n').length > 0, `zero execution should fail: ${v}`);
  }
  // 2. Cancellation N>0
  const cancelFail = [
    'ℹ cancelled 1',
    'cancelled 1',
    '1 cancelled',
    'canceled 1',
    '1 canceled',
  ];
  for (const v of cancelFail) {
    assert.ok(POLICY.validateCanonicalReceipt(base + v + '\n').length > 0, `cancel should fail: ${v}`);
  }
  // 3. Suite / Files
  const suiteFail = [
    'Test Suites: 1 failed, 1 total',
    'Test Suites: 2 failed',
    'Test Files: 1 failed',
    'Test Files 1 failed',
  ];
  for (const v of suiteFail) {
    assert.ok(POLICY.validateCanonicalReceipt(base + v + '\n').length > 0, `suite should fail: ${v}`);
  }
  // 4. Runner FAIL
  const runnerFail = [
    'FAIL ./foo.test.js',
    'FAIL\tpackage',
    'FAIL\texample.test/probe\t0.431s',
    '--- FAIL: TestName (0.00s)',
    'FAIL',
    'FAIL: something',
    'FAILED tests/test_demo.py::test_foo - assert 1 == 2',
    'FAILED tests/test_demo.py',
    '# fail 1',
    'ℹ fail 1',
    'not ok 1 - test',
  ];
  for (const v of runnerFail) {
    assert.ok(POLICY.validateCanonicalReceipt(base + v + '\n').length > 0, `runner FAIL should fail: ${v}`);
  }
  // also standalone FAILED/FAILURE bare/colon
  for (const v of ['FAILED', 'FAILURE', 'FAILED:', 'FAILURE:']) {
    assert.ok(POLICY.validateCanonicalReceipt(base + v + '\n').length > 0, `standalone ${v} should fail`);
  }
  // 5. Error summaries N>0
  const errorFail = [
    '1 error in 0.12s',
    '2 errors',
    'ERROR collecting tests/test_demo.py',
    'ERROR',
    'Found 2 errors',
    'Tests run: 5, Failures: 1, Errors: 0',
    '[ERROR] Tests run: 5, Failures: 1, Errors: 0, Skipped: 0',
    '[ERROR] Tests run: 5, Failures: 0, Errors: 1, Skipped: 0',
    '[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.2.5:test',
    '5 tests completed, 1 failed',
  ];
  for (const v of errorFail) {
    assert.ok(POLICY.validateCanonicalReceipt(base + v + '\n').length > 0, `error should fail: ${v}`);
  }
  // Positive controls must pass
  const pass = [
    'Tests failed: 0',
    'fail 0',
    'Tests: 0 failed',
    'cancelled 0',
    'canceled 0',
    'Test Suites: 0 failed',
    'Test Files: 0 failed',
    '5 tests completed, 0 failed',
    'Tests run: 5, Failures: 0, Errors: 0',
    '# tests 1',
    '# suites 0',
    '# pass 1',
    '# fail 0',
    '# cancelled 0',
    '# skipped 0',
    '# todo 0',
    '# duration_ms 114.203625',
    '[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0',
    '[ERROR] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0',
    '[ERROR] Error handling is documented',
    'errors 0',
    'Found 0 errors',
    'tests 5',
    'collected 1 item',
    'collected 5 items',
    'Notes: handles error/failure',
    'Notes: verifies failure handling',
    'Notes: Tests: 0 passed',
    'Description: Tests passed: 0',
    'Notes: one failing test is documented',
    'Description: failureCount: 1 is documented',
    'one failing test: 1 is documented',
    'failureCount: 1 is documented',
    'Tests failed previously but now fixed',
    'Failure handling is documented',
    'failure summary follows in the notes',
    'ERROR handling is documented',
    'Summary: failureCount: 1 is documented',
    'Error handling is documented',
    'FAILURE mode analysis',
    'Notes: tests failed previously but now fixed',
    'Notes: supports zero-test parsing',
    'Command: npm run test --errorFlag',
    'Command: npm run artifact:test',
  ];
  for (const v of pass) {
    // Command lines are skipped; others should not trigger hasExplicitFailure
    const body = v.startsWith('Command:') ? `Verification: PASS\n${v}\nExit: 0\nBase: 0123456789abcdef0123456789abcdef01234567\nHead: 89abcdef0123456789abcdef0123456789abcdef\n` : base + v + '\n';
    assert.deepEqual(POLICY.validateCanonicalReceipt(body), [], `should pass: ${v}`);
  }
  assert.equal(POLICY.isTapMetadataHeading('# fail 1'), true);
  assert.equal(POLICY.isTapMetadataHeading('# duration_ms 114.203625'), true);
  assert.equal(POLICY.isTapMetadataHeading('# Notes'), false);
  assert.equal(POLICY.isTapMetadataHeading('# pass 1 explanation'), false);
});

test('generated runtime state under every platform folder stays out of the worktree digest', () => {
  // The gate writes its cache and the installer writes runtime.json under the platform
  // folder on every run. If those writes moved Head, a project tracking its runtime
  // directory could never hold a stable receipt. The exclusion list must name each
  // shipped platform, and a real source change must still move Head.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-state-roots-'));
  try {
    for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test'], ['commit', '--allow-empty', '-qm', 'fixture']]) {
      const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    fs.mkdirSync(path.join(root, 'specs', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(root, 'specs', 'demo', 'plan.md'), '# Demo plan\n');
    const derive = () => PROVENANCE_HELPER.deriveRuntimeContext({
      projectRoot: root,
      specsRoot: path.join(root, 'specs'),
      specFile: path.join(root, 'specs', 'demo', 'plan.md'),
      featureName: 'demo',
      runtimeSession: 'state-roots',
    });
    const before = derive();

    for (const folder of ['.claude', '.codex', '.omp']) {
      fs.mkdirSync(path.join(root, folder, 'hooks', '.logs'), { recursive: true });
      fs.mkdirSync(path.join(root, folder, '.logs'), { recursive: true });
      fs.writeFileSync(path.join(root, folder, 'hooks', '.logs', 'spec-gate-last.json'), '{"demo":{}}\n');
      fs.writeFileSync(path.join(root, folder, '.logs', 'hook-log.jsonl'), '{}\n');
      fs.writeFileSync(path.join(root, folder, 'runtime.json'), '{"spec":{"completion_gate":true}}\n');
    }
    const afterState = derive();
    assert.equal(afterState.head, before.head, 'runtime state under .claude, .codex, and .omp must not move Head');
    assert.equal(afterState.base, before.base);

    // Anything else under the platform folder is source: a hook edit must move Head.
    fs.mkdirSync(path.join(root, '.omp', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(root, '.omp', 'hooks', 'rules.cjs'), '// edited\n');
    assert.notEqual(derive().head, before.head, 'a real file under the platform folder must still move Head');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
