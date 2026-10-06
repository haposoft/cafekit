'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const SCAFFOLD = path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-scaffold.cjs');
const VALIDATOR = path.join(PACKAGE_ROOT, 'src/claude/scripts/validate-spec-output.cjs');
const GROUNDER = path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-ground.cjs');
const AUTHORING_VALIDATOR = path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-authoring-validation.cjs');

// C2 SemanticReviewReceipt (R1-01, frozen): a minimal but exact-shape completed
// receipt for fixtures that need `ready_for_implementation` true.
function completedSemanticReview({ reviewedCriteria, counterexamples }) {
  return {
    status: 'completed',
    semantic_digest: null,
    verdict: 'PASS',
    lifecycle_disposition: 'CONTINUE',
    findings: [],
    unresolved_decisions: [],
    graph_coverage: [
      'criterion_local', 'cross_criterion', 'runtime_path', 'assumption_provenance', 'compatibility_migration',
    ].map((surface) => ({ surface, covered: true, notes: 'Fixture coverage for structural contract test.' })),
    repair_round: 0,
    reviewed_criteria: reviewedCriteria,
    counterexamples,
    reviewer_evidence: { assurance: 'Routine', summary: 'Fixture reviewer evidence for structural contract test.' },
  };
}

function exec(root, script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

function output(result) { return `${result.stdout}\n${result.stderr}`; }

function task(id, title, ownedPath, action = 'modify', dependencies = 'none', criterion = 'R1.1', taskRole = 'subject') {
  return `# Task ${id}: ${title}
**Status:** pending

## Outcome
Deliver observable ${title.toLowerCase()} behavior through the declared entrypoint.

## Scope
- **In scope:** Exact behavior for ${ownedPath}.
- **Out of scope:** Unrelated runtime behavior.

## Anchors and Ownership
| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-${id}-01 | file | \`${ownedPath}\` | owner | write | ${action} |
| A-${id}-02 | artifact | \`artifacts/${id}.json\` | verifier | write | create |

## Changes
- [ ] ${criterion ? `Implement the owned behavior. _Requirements: ${criterion.slice(1)}_` : 'Verify the subject implementation through the canonical proof boundary.'}

## Acceptance
${criterion ? `- **${criterion}:** The command returns the concrete expected state.` : '- The verifier produces an observable proof artifact without claiming the subject acceptance criterion.'}

## Dependencies
- ${dependencies}

## Verification Plan
- **Verification ref:** V1
- **Task role:** ${taskRole}
- **Command:** \`node --test test/service.test.js\`
- **Expected:** Exit code 0 and exact state enabled.
- **Negative path:** Invalid input returns the specified failure state.
- **Reachability:** \`src/entry.js\`
`;
}

function makeFixture({ ready = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-validator-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/entry.js'), 'module.exports = { enabled: true };\n');
  fs.writeFileSync(path.join(root, 'src/service.js'), 'module.exports = { enabled: true };\n');
  fs.writeFileSync(path.join(root, 'src/design-boundary.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(root, 'test/service.test.js'), 'require("node:test")("service",()=>{});\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const boundaries = [{
    id: 'B-OWN', type: 'ownership', tasks: ['R1-01', 'R1-02'],
    write_sets: {
      'R1-01': ['src/entry.js', 'artifacts/R1-01.json'],
      'R1-02': ['src/service.js', 'artifacts/R1-02.json'],
    },
  }, {
    id: 'B-V', type: 'proof', subject: 'R1-01', verifier: 'R1-02',
    verification_ref: 'V1', artifact_anchor: 'A-R1-02-02',
  }];
  const scaffold = exec(root, SCAFFOLD, [
    'feature', '--tasks', 'R1-01-entry,R1-02-verify', '--boundaries', JSON.stringify(boundaries),
  ]);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  const specDir = path.join(root, 'specs/feature');
  fs.writeFileSync(path.join(specDir, 'requirements.md'), `# Requirements

## Requirements
### Requirement 1: Service behavior
- **R1.1**: When valid input arrives, the system shall return enabled state; invalid input shall return rejected state.
- **R1.2**: The verifier shall produce a separate observable proof artifact for the enabled and rejected states.
`);
  fs.writeFileSync(path.join(specDir, 'design.md'), `# Design

## Architecture
The entry delegates to the service and emits a verifier-owned artifact.

## Typed Anchors
| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-D-01 | file | \`src/design-boundary.js\` | design boundary | read | read |
| A-D-02 | artifact | \`artifacts/design-proof.json\` | taskless proof evidence | write | create |

## Canonical Contracts & Invariants
### D1 — Delegation decision
The entry delegates exactly once.
### I1 — Invalid-state invariant
Invalid input never returns enabled state.
### C1 — Result contract
The result contains an enabled boolean.
### T1 — Service transition
The transition moves rejected input to failure and valid input to enabled; recovery retries from rejected.

## Verification Definitions
- **V1**: Criteria R1.1; Owner R1-01; Proof criteria R1.2; Proof owner R1-02; Evidence anchor A-R1-02-02; Decision refs D1, I1, C1; Method command \`node --test test/service.test.js\`; Expected exit 0 with enabled state and verifier artifact; Negative/failure invalid input returns rejected state without an enabled result; Reachability/grounding entrypoint \`src/entry.js\` via A-D-01, A-R1-02-02.
`);
  fs.writeFileSync(path.join(specDir, 'tasks/task-R1-01-entry.md'), task('R1-01', 'Entry', 'src/entry.js'));
  fs.writeFileSync(path.join(specDir, 'tasks/task-R1-02-verify.md'), task('R1-02', 'Verify', 'src/service.js', 'modify', 'none', 'R1.2', 'verifier'));
  const promoted = exec(root, SCAFFOLD, ['feature', '--sync-semantic-model']);
  assert.equal(promoted.status, 0, output(promoted));
  const specPath = path.join(specDir, 'spec.json');
  if (!ready) return { root, specDir, specPath };
  // C16/D13: only spec-authoring-validation.cjs may flip authoring.* to
  // validated and write the matching receipt (I21/R3.9) — run the real
  // coordinator instead of hand-writing those fields.
  const coordinated = exec(root, AUTHORING_VALIDATOR, [specDir]);
  assert.equal(coordinated.status, 0, output(coordinated));
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  spec.validation.status = 'completed';
  spec.validation.semantic_review = completedSemanticReview({
    reviewedCriteria: ['R1.1', 'R1.2'],
    counterexamples: [{
      criterion: 'R1.1', case_kind: 'failure',
      scenario: 'The service receives an invalid input object without the required discriminator.',
      expected: 'The service returns rejected state and never emits enabled true.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }, {
      criterion: 'R1.2', case_kind: 'adversarial',
      scenario: 'The implementation reports enabled state without producing the verifier-owned artifact.',
      expected: 'Verification fails because the separate proof artifact is absent.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }],
  });
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  const digest = exec(root, VALIDATOR, [specDir, '--semantic-digest']);
  assert.equal(digest.status, 0, output(digest));
  spec.validation.semantic_review.semantic_digest = digest.stdout.trim();
  spec.ready_for_implementation = true;
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  return { root, specDir, specPath };
}

function mutateFixture(fixture, mutate) {
  const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
  mutate(state);
  fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
  return exec(fixture.root, VALIDATOR, [fixture.specDir]);
}

function refreshSemanticDigest(fixture) {
  const previous = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
  const promoted = exec(fixture.root, SCAFFOLD, ['feature', '--sync-semantic-model']);
  assert.equal(promoted.status, 0, output(promoted));
  // C16/D13: authoring.* and its receipt are never hand-restored — only
  // spec-authoring-validation.cjs may write them (I21). Re-run it best-effort
  // over the current (possibly just-edited) bytes; a fixture that
  // deliberately broke grounding/validation after the initial ready fixture
  // leaves authoring at scaffold's own draft reset instead, which is fine —
  // the caller is exercising a different failure, not readiness itself.
  const wasValidated = ['requirements', 'design', 'research', 'tasks']
    .some((field) => previous.authoring[field] === 'validated');
  if (wasValidated) exec(fixture.root, AUTHORING_VALIDATOR, [fixture.specDir]);
  const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
  state.validation.status = previous.validation.status;
  state.validation.semantic_review = previous.validation.semantic_review;
  state.validation.semantic_review.semantic_digest = null;
  state.ready_for_implementation = false;
  fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
  const digest = exec(fixture.root, VALIDATOR, [fixture.specDir, '--semantic-digest']);
  assert.equal(digest.status, 0, output(digest));
  state.validation.semantic_review.semantic_digest = digest.stdout.trim();
  state.ready_for_implementation = previous.ready_for_implementation;
  fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
}

function promoteSemanticModel(fixture) {
  const promoted = exec(fixture.root, SCAFFOLD, ['feature', '--sync-semantic-model']);
  assert.equal(promoted.status, 0, output(promoted));
}

function appendTaskAnchor(fixture, row) {
  const taskPath = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
  const content = fs.readFileSync(taskPath, 'utf8').replace(
    '| A-R1-01-02 | artifact | `artifacts/R1-01.json` | verifier | write | create |',
    `| A-R1-01-02 | artifact | \`artifacts/R1-01.json\` | verifier | write | create |\n${row}`,
  );
  fs.writeFileSync(taskPath, content);
}

function canonicalResearch21() {
  return `# Research

## Uncertainty
- Which exact service boundary owns the enabled state and its rejected-input behavior?

## Evidence Summary
- Inspection of \`src/service.js\` shows the module exports the enabled-state boundary used by this fixture.

## Decision
- Keep the service module as canonical owner because the inspected implementation exposes the required observable state.

## Remaining Gaps
- None — the inspected service evidence resolves the ownership uncertainty for this bounded fixture.
`;
}

function makeTasklessReadyFixture() {
  const fixture = makeFixture();
  fs.rmSync(path.join(fixture.specDir, 'tasks'), { recursive: true, force: true });
  const designPath = path.join(fixture.specDir, 'design.md');
  fs.writeFileSync(designPath, fs.readFileSync(designPath, 'utf8')
    .replace('Owner R1-01', 'Owner A-D-01')
    .replace('Proof owner R1-02', 'Proof owner A-D-02')
    .replace('Evidence anchor A-R1-02-02', 'Evidence anchor A-D-02')
    .replace('via A-D-01, A-R1-02-02', 'via A-D-01, A-D-02'));
  const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
  delete state.task_files;
  delete state.task_registry;
  state.coordination = { boundaries: [] };
  // Dropping task topology requires the taskless authoring state exactly:
  // scaffold's closed-world check refuses task_files/task_registry omission
  // paired with anything but authoring.tasks = 'absent'.
  state.authoring.tasks = 'absent';
  fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
  const promoted = exec(fixture.root, SCAFFOLD, ['feature', '--sync-semantic-model']);
  assert.equal(promoted.status, 0, output(promoted));
  // C16/D13: only spec-authoring-validation.cjs may flip authoring.* to
  // validated and write the matching receipt (I21/R3.9) — run the real
  // coordinator instead of hand-writing those fields.
  const coordinated = exec(fixture.root, AUTHORING_VALIDATOR, [fixture.specDir]);
  assert.equal(coordinated.status, 0, output(coordinated));
  const validatedState = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
  validatedState.validation.status = 'completed';
  validatedState.validation.semantic_review = completedSemanticReview({
    reviewedCriteria: ['R1.1', 'R1.2'],
    counterexamples: [{
      criterion: 'R1.1', case_kind: 'failure',
      scenario: 'The service receives invalid input without the required discriminator.',
      expected: 'The service returns rejected state and never emits enabled true.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }, {
      criterion: 'R1.2', case_kind: 'adversarial',
      scenario: 'The subject reports success without producing the design-owned proof artifact.',
      expected: 'Verification fails because the separate taskless proof evidence is absent.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }],
  });
  fs.writeFileSync(fixture.specPath, `${JSON.stringify(validatedState, null, 2)}\n`);
  const digest = exec(fixture.root, VALIDATOR, [fixture.specDir, '--semantic-digest']);
  assert.equal(digest.status, 0, output(digest));
  const readyState = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
  readyState.validation.semantic_review.semantic_digest = digest.stdout.trim();
  readyState.ready_for_implementation = true;
  fs.writeFileSync(fixture.specPath, `${JSON.stringify(readyState, null, 2)}\n`);
  return fixture;
}

test('generated schema 2.1 artifact validates after concrete authoring projection', () => {
  const fixture = makeFixture();
  try {
    const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result.status, 0, output(result));
    assert.match(output(result), /structural checks do not replace semantic judgment/);
    const ground = exec(fixture.root, GROUNDER, [fixture.specDir, '--root', fixture.root]);
    assert.equal(ground.status, 0, output(ground));
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('validator module API is side-effect free and matches CLI validation and digest results', () => {
  const imported = spawnSync(process.execPath, ['-e', `
    const api = require(${JSON.stringify(VALIDATOR)});
    process.stdout.write(Object.keys(api).sort().join(','));
  `], { encoding: 'utf8' });
  assert.equal(imported.status, 0, output(imported));
  assert.equal(imported.stderr, '');
  assert.equal(imported.stdout, 'computeSemanticDigest21,validateSpec');

  const fixture = makeFixture();
  try {
    const api = require(VALIDATOR);
    const directValidation = api.validateSpec(fixture.specDir);
    const cliValidation = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(cliValidation.status, directValidation.errors.length === 0 ? 0 : 1, output(cliValidation));
    assert.deepEqual(directValidation.errors, []);
    for (const warning of directValidation.warnings) assert.match(output(cliValidation), new RegExp(`\\[WARN\\] ${warning.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

    const explicitSpec = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    const implicitDigest = api.computeSemanticDigest21(fixture.specDir);
    const explicitDigest = api.computeSemanticDigest21(fixture.specDir, explicitSpec);
    const cliDigest = exec(fixture.root, VALIDATOR, [fixture.specDir, '--semantic-digest']);
    assert.equal(cliDigest.status, 0, output(cliDigest));
    assert.deepEqual(implicitDigest, explicitDigest);
    assert.deepEqual(implicitDigest.errors, []);
    assert.equal(implicitDigest.digest, cliDigest.stdout.trim());
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('ready schema 2.1 requires exact receipt coverage and traceable V definition', () => {
  const fixture = makeFixture({ ready: true });
  try {
    const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result.status, 0, output(result));
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('digest is stable on lifecycle fields and stale on authoring, policy, or topology changes', () => {
  const fixture = makeFixture({ ready: true });
  try {
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    const digest = state.validation.semantic_review.semantic_digest;
    state.status = 'blocked';
    state.updated_at = '2030-01-01T00:00:00Z';
    state.task_registry['tasks/task-R1-01-entry.md'].status = 'in_progress';
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    assert.equal(exec(fixture.root, VALIDATOR, [fixture.specDir, '--semantic-digest']).stdout.trim(), digest);
    state.scope_lock.in_scope.push('new semantic scope');
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    const stale = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(stale.status, 1);
    assert.match(output(stale), /semantic_digest: stale/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('receipt rejects proof self-owner and duplicate generic counterexamples', () => {
  const fixture = makeFixture({ ready: true });
  try {
    let result = mutateFixture(fixture, (state) => {
      const proof = state.coordination.boundaries.find((boundary) => boundary.type === 'proof');
      proof.verifier = proof.subject;
    });
    assert.equal(result.status, 1);
    assert.match(output(result), /proof subject must differ from verifier/);

    const fresh = makeFixture({ ready: true });
    try {
      result = mutateFixture(fresh, (state) => {
        state.validation.semantic_review.counterexamples.push({
          criterion: 'R1.1', case_kind: 'failure', scenario: 'works', expected: 'correct behavior',
          decision_refs: ['D1'], verification_ref: 'V1',
        });
      });
      assert.equal(result.status, 1);
      assert.match(output(result), /generic boilerplate|duplicate counterexample fingerprint/);
    } finally { fs.rmSync(fresh.root, { recursive: true, force: true }); }
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('validator rejects missing deliverable, recovery, and verifier-owned artifact anchor', () => {
  const cases = [
    [(state) => { state.coordination.boundaries.push({ id: 'B-D', type: 'dependency', producer: 'R1-01', consumer: 'R1-02' }); }, /malformed typed boundary/],
    [(state) => { state.coordination.boundaries.push({ id: 'B-T', type: 'transition', design_ref: 'T1', owner: 'R1-01', consumers: ['R1-02'], precondition: 'input is accepted', postcondition: 'state is enabled', failure: 'state is rejected' }); }, /malformed typed boundary/],
    [(state) => { state.coordination.boundaries.find((boundary) => boundary.type === 'proof').artifact_anchor = 'A-R1-01-02'; }, /must be owned by verifier/],
  ];
  for (const [mutate, expected] of cases) {
    const fixture = makeFixture();
    try {
      const result = mutateFixture(fixture, mutate);
      assert.equal(result.status, 1);
      assert.match(output(result), expected);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});

test('dependency boundary binds exact producer and consumer anchors to the registry DAG edge', () => {
  const fixture = makeFixture();
  try {
    const producerPath = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
    const consumerPath = path.join(fixture.specDir, 'tasks/task-R1-02-verify.md');
    fs.writeFileSync(producerPath, fs.readFileSync(producerPath, 'utf8').replace(
      '| A-R1-01-02 | artifact | `artifacts/R1-01.json` | verifier | write | create |',
      '| A-R1-01-02 | artifact | `artifacts/R1-01.json` | verifier | write | create |\n| A-R1-01-03 | artifact | `artifacts/deliverable.json` | producer | write | create |',
    ));
    fs.writeFileSync(consumerPath, fs.readFileSync(consumerPath, 'utf8').replace(
      '| A-R1-02-02 | artifact | `artifacts/R1-02.json` | verifier | write | create |',
      '| A-R1-02-02 | artifact | `artifacts/R1-02.json` | verifier | write | create |\n| A-R1-02-03 | artifact | `artifacts/deliverable.json` | consumer | read | read |',
    ).replace('## Dependencies\n- none', '## Dependencies\n- tasks/task-R1-01-entry.md'));
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    state.coordination.boundaries.push({
      id: 'B-D', type: 'dependency', producer: 'R1-01', consumer: 'R1-02',
      deliverable: 'artifacts/deliverable.json',
    });
    state.coordination.boundaries.find((boundary) => boundary.type === 'ownership')
      .write_sets['R1-01'].push('artifacts/deliverable.json');
    state.task_registry['tasks/task-R1-02-verify.md'].dependencies = ['tasks/task-R1-01-entry.md'];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    promoteSemanticModel(fixture);
    const valid = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(valid.status, 0, output(valid));

    state.task_registry['tasks/task-R1-02-verify.md'].dependencies = [];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    const drift = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(drift.status, 1);
    assert.match(output(drift), /must bind the registry DAG edge|exact projection/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('schema 2.1 reuses core machine lifecycle invariants without mutating artifacts', () => {
  const cases = [
    ['scope-lock-shape', (state) => { state.scope_lock = true; }, /scope_lock: must be an object/],
    ['scope-lock-source', (state) => { state.scope_lock.source = ''; }, /scope_lock\.source: must be a non-empty string/],
    ['scope-lock-duplicates', (state) => { state.scope_lock.in_scope = ['same', 'same']; }, /in_scope: must be an array of unique/],
    ['scope-lock-policy', (state) => { state.scope_lock.expansion_policy = 'silent'; }, /expansion_policy: must be requires-user-approval/],
    ['validation-shape', (state) => { state.validation = 'completed'; }, /validation: must be an object|requires status and semantic_review/],
    ['registry-required-field', (state) => { delete state.task_registry['tasks/task-R1-01-entry.md'].blocker; }, /missing blocker/],
    ['registry-status', (state) => { state.task_registry['tasks/task-R1-01-entry.md'].status = 'ready'; }, /status: must be one of/],
    ['blocked-without-blocker', (state) => {
      state.task_registry['tasks/task-R1-01-entry.md'].status = 'blocked';
      state.task_registry['tasks/task-R1-01-entry.md'].last_updated_at = '2026-08-13T01:00:00Z';
    }, /blocked status requires a non-empty blocker/],
    ['reversed-task-time', (state) => {
      const entry = state.task_registry['tasks/task-R1-01-entry.md'];
      entry.status = 'in_progress';
      entry.started_at = '2026-08-13T02:00:00Z';
      entry.last_updated_at = '2026-08-13T01:00:00Z';
    }, /started_at <= last_updated_at/],
    ['reversed-spec-time', (state) => { state.updated_at = '2000-01-01T00:00:00Z'; }, /created_at <= updated_at/],
    ['ready-validation-fail-closed', (state) => { state.ready_for_implementation = true; }, /requires validation.status completed|requires completed semantic review/],
  ];
  for (const [name, mutate, expected] of cases) {
    const fixture = makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      mutate(state);
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const before = fs.readFileSync(fixture.specPath, 'utf8');
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, `${name} unexpectedly passed\n${output(result)}`);
      assert.match(output(result), expected, name);
      assert.equal(fs.readFileSync(fixture.specPath, 'utf8'), before, `${name} mutated spec.json`);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});

test('canonical task graph enforces substantive sections and exact criterion authority', () => {
  const cases = [
    ['generic-outcome', (fixture) => {
      const file = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(
        'Deliver observable entry behavior through the declared entrypoint.', 'Done.',
      ));
    }, /Outcome must be concrete and non-generic/],
    ['changes-acceptance-drift', (fixture) => {
      const file = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('_Requirements: 1.1_', '_Requirements: 1.2_'));
    }, /Changes and Acceptance must trace the same exact RN.M criteria/],
    ['orphan-criterion', (fixture) => {
      fs.appendFileSync(path.join(fixture.specDir, 'requirements.md'), '- **R1.3**: The system shall return a distinct audit state.\n');
    }, /R1\.3: (?:acceptance criterion not covered by any task|requires exactly one task implementation owner)/],
    ['duplicate-local-authority', (fixture) => {
      const file = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(
        '- **R1.1:** The command returns the concrete expected state.',
        '- **R1.1:** The command returns the concrete expected state.\n- **R1.1:** The same criterion is claimed twice.',
      ));
    }, /Acceptance contains duplicate RN.M authority/],
    ['proof-verifier-cannot-duplicate-acceptance', (fixture) => {
      const file = path.join(fixture.specDir, 'tasks/task-R1-02-verify.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8')
        .replace('_Requirements: 1.2_', '_Requirements: 1.1_')
        .replace(/R1\.2/g, 'R1.1'));
    }, /requires exactly one implementation owner/],
  ];
  for (const [name, mutate, expected] of cases) {
    const fixture = makeFixture();
    try {
      mutate(fixture);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, `${name} unexpectedly passed\n${output(result)}`);
      assert.match(output(result), expected, name);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});

test('research authoring is an exact pointer-file state machine and participates in digest drift', () => {
  const invalidCases = [
    ['absent-pointer', (fixture, state) => { state.research = 'research.md'; }, /absent requires no pointer/],
    ['absent-file', (fixture) => { fs.writeFileSync(path.join(fixture.specDir, 'research.md'), '# Research\n'); }, /absent requires no physical artifact/],
    ['draft-missing', (_fixture, state) => { state.authoring.research = 'draft'; }, /requires canonical pointer|requires a physical regular file/],
  ];
  for (const [name, mutate, expected] of invalidCases) {
    const fixture = makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      mutate(fixture, state);
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, `${name} unexpectedly passed`);
      assert.match(output(result), expected, name);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }

  const structuralMutations = [
    ...['Uncertainty', 'Evidence Summary', 'Decision', 'Remaining Gaps'].map((heading) => [
      `missing-${heading}`, (content) => content.replace(`## ${heading}`, `## Missing ${heading}`),
      new RegExp(`requires exactly one ## ${heading} section`),
    ]),
    ...['Uncertainty', 'Evidence Summary', 'Decision', 'Remaining Gaps'].map((heading) => [
      `duplicate-${heading}`, (content) => `${content}\n## ${heading}\n- A second machine section must be rejected.\n`,
      new RegExp(`requires exactly one ## ${heading} section`),
    ]),
    ['placeholder-uncertainty', (content) => content.replace(/## Uncertainty[\s\S]*?## Evidence Summary/, '## Uncertainty\n- TBD\n\n## Evidence Summary'), /Uncertainty must contain concrete non-placeholder content/],
    ['placeholder-evidence', (content) => content.replace(/## Evidence Summary[\s\S]*?## Decision/, '## Evidence Summary\n- TODO\n\n## Decision'), /Evidence Summary must contain concrete non-placeholder content/],
    ['placeholder-decision', (content) => content.replace(/## Decision[\s\S]*?## Remaining Gaps/, '## Decision\n- Pending\n\n## Remaining Gaps'), /Decision must contain concrete non-placeholder content/],
    ['ungrounded-evidence', (content) => content.replace('`src/service.js`', '`src/phantom-service.js`'), /Evidence Summary must ground/],
    ['bare-none', (content) => content.replace(/- None[^\n]+/, '- None'), /Remaining Gaps None requires concrete rationale or evidence/],
    ['placeholder-gap', (content) => content.replace(/- None[^\n]+/, '- TODO'), /Remaining Gaps must contain a concrete gap/],
  ];
  for (const [name, mutate, expected] of structuralMutations) {
    const fixture = makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      state.authoring.research = 'draft';
      state.research = 'research.md';
      fs.writeFileSync(path.join(fixture.specDir, 'research.md'), mutate(canonicalResearch21()));
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, `${name} unexpectedly passed\n${output(result)}`);
      assert.match(output(result), expected, name);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }

  for (const remainingGaps of [
    '- None — the inspected repository evidence resolves the bounded ownership question.',
    '- The external retry limit remains unresolved and can change the recovery design.',
  ]) {
    const fixture = makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      state.authoring.research = 'draft';
      state.research = 'research.md';
      fs.writeFileSync(path.join(fixture.specDir, 'research.md'), canonicalResearch21().replace(/- None[^\n]+/, remainingGaps));
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      assert.equal(exec(fixture.root, VALIDATOR, [fixture.specDir]).status, 0);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }

  // Production lifecycle order (I15/R3.7): research is added and left draft
  // BEFORE readiness exists, the coordinator proves it clean, and only then
  // does the semantic reviewer compute a digest and the finalizer promote —
  // never the reverse. Start from the plain (not yet ready) fixture so the
  // coordinator never has to run against an already-completed, now-stale
  // review (that ordering is out of the coordinator's own contract).
  const fixture = makeFixture();
  try {
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    state.research = 'research.md';
    state.authoring.research = 'draft';
    fs.writeFileSync(path.join(fixture.specDir, 'research.md'), canonicalResearch21());
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    // C16/D13: only spec-authoring-validation.cjs may flip authoring.research
    // (and every other non-absent stage) to validated and write the matching
    // receipt (I21/R3.9).
    const coordinated = exec(fixture.root, AUTHORING_VALIDATOR, [fixture.specDir]);
    assert.equal(coordinated.status, 0, output(coordinated));
    const validated = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    validated.validation.status = 'completed';
    validated.validation.semantic_review = completedSemanticReview({
      reviewedCriteria: ['R1.1', 'R1.2'],
      counterexamples: [{
        criterion: 'R1.1', case_kind: 'failure',
        scenario: 'The service receives an invalid input object without the required discriminator.',
        expected: 'The service returns rejected state and never emits enabled true.',
        decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
      }, {
        criterion: 'R1.2', case_kind: 'adversarial',
        scenario: 'The implementation reports enabled state without producing the verifier-owned artifact.',
        expected: 'Verification fails because the separate proof artifact is absent.',
        decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
      }],
    });
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(validated, null, 2)}\n`);
    const digest = exec(fixture.root, VALIDATOR, [fixture.specDir, '--semantic-digest']);
    assert.equal(digest.status, 0, output(digest));
    validated.validation.semantic_review.semantic_digest = digest.stdout.trim();
    validated.ready_for_implementation = true;
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(validated, null, 2)}\n`);
    assert.equal(exec(fixture.root, VALIDATOR, [fixture.specDir]).status, 0);
    fs.appendFileSync(path.join(fixture.specDir, 'research.md'), '\nA second grounded conclusion changes the authored research artifact.\n');
    const stale = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(stale.status, 1);
    assert.match(output(stale), /stale.*research/);
    fs.unlinkSync(path.join(fixture.specDir, 'research.md'));
    const refused = exec(fixture.root, VALIDATOR, [fixture.specDir, '--semantic-digest']);
    assert.equal(refused.status, 1);
    assert.doesNotMatch(refused.stdout, /^sha256:/m);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('canonical T/V definitions, proof anchors, phases, and access normalization share one model', () => {
  const invalidCases = [
    ['incidental-verification', (fixture) => {
      const file = path.join(fixture.specDir, 'design.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- **V1**:', '- Verification V1:'));
    }, /Verification Definitions requires at least one canonical V definition|missing canonical V definition/],
    ['source-write-as-proof', (fixture, state) => {
      state.coordination.boundaries.find((boundary) => boundary.type === 'proof').artifact_anchor = 'A-R1-02-01';
    }, /source write is not proof/],
    ['ownership-owned-phase', (_fixture, state) => {
      state.coordination.phases = [{
        id: 'P1', task_ids: ['R1-01', 'R1-02'], entry_condition: 'Both tasks are authored.',
        exit_condition: 'Both task outcomes are verified.', owner_boundary: 'B-OWN',
      }];
    }, /ownership cannot own phase progression/],
    ['phase-participant-and-coverage-drift', (_fixture, state) => {
      state.coordination.phases = [{
        id: 'P1', task_ids: ['R1-01'], entry_condition: 'The subject task is authored.',
        exit_condition: 'The subject task is verified.', owner_boundary: 'B-V',
      }];
    }, /participants must match phase task_ids exactly|R1-02 must appear in exactly one phase/],
    ['incidental-transition-reference', (fixture, state) => {
      const design = path.join(fixture.specDir, 'design.md');
      fs.writeFileSync(design, fs.readFileSync(design, 'utf8').replace('### T1 — Service transition', 'The prose mentions T1 service transition'));
      state.coordination.boundaries.push({
        id: 'B-T', type: 'transition', design_ref: 'T1', owner: 'R1-01', consumers: ['R1-02'],
        precondition: 'Valid input is accepted by the entry boundary.',
        postcondition: 'Enabled state is persisted for the consumer.',
        failure: 'Invalid input leaves the service rejected.',
        recovery: 'Retry begins from the rejected state without duplicate output.',
      });
    }, /missing canonical design T definition/],
    ...[
      ['Criteria', 'Coverage'],
      ['Owner', 'Ownership'],
      ['Proof criteria', 'Proof coverage'],
      ['Proof owner', 'Verifier'],
      ['Evidence anchor', 'Evidence'],
      ['Decision refs', 'References'],
      ['Method', 'Procedure'],
      ['Expected', 'Outcome'],
      ['Negative/failure', 'Failure'],
      ['Reachability/grounding', 'Grounding'],
    ].map(([label, replacement]) => [`v-definition-missing-${label}`, (fixture) => {
      const design = path.join(fixture.specDir, 'design.md');
      fs.writeFileSync(design, fs.readFileSync(design, 'utf8').replace(label, replacement));
    }, /V definition must use Criteria; Owner; optional Proof criteria; Proof owner; Evidence anchor; Decision refs; Method; Expected; Negative\/failure; Reachability\/grounding grammar/]),
  ];
  for (const [name, mutate, expected] of invalidCases) {
    const fixture = makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      mutate(fixture, state);
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, `${name} unexpectedly passed\n${output(result)}`);
      assert.match(output(result), expected, name);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }

  const fixture = makeFixture();
  try {
    for (const name of ['tasks/task-R1-01-entry.md', 'tasks/task-R1-02-verify.md']) {
      const file = path.join(fixture.specDir, name);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\| write \| modify \|/i, '| WRITE | MODIFY |'));
    }
    promoteSemanticModel(fixture);
    const validate = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    const ground = exec(fixture.root, GROUNDER, [fixture.specDir, '--root', fixture.root]);
    assert.equal(validate.status, 0, output(validate));
    assert.equal(ground.status, 0, output(ground));
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('explicit Access and Action remain authoritative when Role prose claims create', () => {
  const fixture = makeFixture({ ready: true });
  try {
    const design = path.join(fixture.specDir, 'design.md');
    fs.writeFileSync(design, fs.readFileSync(design, 'utf8').replace(
      '| A-D-01 | file | `src/design-boundary.js` | design boundary | read | read |',
      '| A-D-01 | file | `src/role-cannot-create.js` | create this planned file | read | read |',
    ));
    refreshSemanticDigest(fixture);
    const validator = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    const grounder = exec(fixture.root, GROUNDER, [fixture.specDir, '--root', fixture.root]);
    assert.equal(validator.status, 1, output(validator));
    assert.equal(grounder.status, 1, output(grounder));
    assert.match(output(validator), /A-D-01: read target not found.*src\/role-cannot-create\.js/);
    assert.match(output(grounder), /A-D-01: read target not found.*src\/role-cannot-create\.js/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('typed boundaries require exact non-empty resource maps and participation by every task', () => {
  const mapMutations = [
    ['empty', (boundary) => { boundary.write_sets['R1-01'] = []; }, /must be a non-empty array of unique exact targets/],
    ['extra', (boundary) => { boundary.write_sets['R1-01'].push('src/unclaimed.js'); }, /lacks exact task write anchor/],
  ];
  for (const [name, mutate, expected] of mapMutations) {
    const fixture = makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      mutate(state.coordination.boundaries.find((boundary) => boundary.type === 'ownership'));
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, `${name}: ${output(result)}`);
      assert.match(output(result), expected);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }

  const fixture = makeFixture();
  try {
    const thirdPath = 'tasks/task-R1-03-third.md';
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    fs.writeFileSync(path.join(fixture.root, 'src/third.js'), 'module.exports = { enabled: true };\n');
    fs.writeFileSync(path.join(fixture.specDir, thirdPath), task('R1-03', 'Third', 'src/third.js', 'modify', 'none', '', 'subject'));
    state.task_files.push(thirdPath);
    state.task_registry[thirdPath] = {
      ...state.task_registry['tasks/task-R1-01-entry.md'], id: 'R1-03', title: 'Third', dependencies: [],
    };
    const ownership = state.coordination.boundaries.find((boundary) => boundary.type === 'ownership');
    ownership.tasks.push('R1-03');
    ownership.write_sets['R1-03'] = ['src/third.js', 'artifacts/R1-03.json'];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    promoteSemanticModel(fixture);
    assert.equal(exec(fixture.root, VALIDATOR, [fixture.specDir]).status, 0);

    ownership.tasks = ownership.tasks.filter((id) => id !== 'R1-03');
    delete ownership.write_sets['R1-03'];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /task R1-03 must participate in at least one justified typed boundary/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('same-target writers cannot hide outside declared coordination pairs', () => {
  const fixture = makeFixture();
  try {
    const thirdPath = 'tasks/task-R1-03-shadow.md';
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    fs.writeFileSync(
      path.join(fixture.specDir, thirdPath),
      task('R1-03', 'Shadow writer', 'src/entry.js', 'modify', 'none', '', 'subject'),
    );
    state.task_files.push(thirdPath);
    state.task_registry[thirdPath] = {
      ...state.task_registry['tasks/task-R1-01-entry.md'],
      id: 'R1-03',
      title: 'Shadow writer',
      dependencies: [],
    };
    state.coordination.boundaries.push({
      id: 'B-OWN-SHADOW',
      type: 'ownership',
      tasks: ['R1-02', 'R1-03'],
      write_sets: {
        'R1-02': ['src/service.js', 'artifacts/R1-02.json'],
        'R1-03': ['src/entry.js', 'artifacts/R1-03.json'],
      },
    });
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);

    const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result.status, 1, output(result));
    assert.match(
      output(result),
      /R1-01 and R1-03 both hold a write anchor for src\/entry\.js with no dependency boundary connecting them/,
    );
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('schema 2.1 grounding follows actual readiness and task execution phase', () => {
  const fixture = makeFixture();
  try {
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    const taskPath = 'tasks/task-R1-01-entry.md';
    state.task_registry[taskPath] = {
      ...state.task_registry[taskPath],
      status: 'blocked',
      blocker: 'Waiting for a concrete external prerequisite.',
      last_updated_at: '2026-08-17T00:00:00Z',
    };
    fs.writeFileSync(
      path.join(fixture.specDir, taskPath),
      fs.readFileSync(path.join(fixture.specDir, taskPath), 'utf8').replace('**Status:** pending', '**Status:** blocked'),
    );
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    const blocked = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(blocked.status, 0, output(blocked));

    state.task_registry[taskPath] = {
      ...state.task_registry[taskPath],
      status: 'in_progress',
      blocker: null,
      started_at: '2026-08-17T00:00:00Z',
      last_updated_at: '2026-08-17T00:00:00Z',
    };
    fs.writeFileSync(
      path.join(fixture.specDir, taskPath),
      fs.readFileSync(path.join(fixture.specDir, taskPath), 'utf8').replace('**Status:** blocked', '**Status:** in_progress'),
    );
    fs.writeFileSync(path.join(fixture.root, 'artifacts/R1-01.json'), '{}\n');
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    const materialized = exec(fixture.root, GROUNDER, [fixture.specDir, '--root', fixture.root]);
    assert.equal(materialized.status, 0, output(materialized));
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('schema 2.1 grounding permits a missing planned read only through its direct create dependency', () => {
  const fixture = makeFixture();
  try {
    const producerPath = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
    const consumerPath = path.join(fixture.specDir, 'tasks/task-R1-02-verify.md');
    fs.writeFileSync(producerPath, fs.readFileSync(producerPath, 'utf8').replace(
      '| A-R1-01-02 | artifact | `artifacts/R1-01.json` | verifier | write | create |',
      '| A-R1-01-02 | artifact | `artifacts/R1-01.json` | verifier | write | create |\n| A-R1-01-03 | file | `artifacts/planned-output.json` | owner | write | create |',
    ));
    fs.writeFileSync(consumerPath, fs.readFileSync(consumerPath, 'utf8').replace(
      '| A-R1-02-02 | artifact | `artifacts/R1-02.json` | verifier | write | create |',
      '| A-R1-02-02 | artifact | `artifacts/R1-02.json` | verifier | write | create |\n| A-R1-02-03 | file | `artifacts/planned-output.json` | consumer | read | read |',
    ).replace('- none\n\n## Verification Plan', '- tasks/task-R1-01-entry.md\n\n## Verification Plan'));
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    state.coordination.boundaries[0].write_sets['R1-01'].push('artifacts/planned-output.json');
    state.coordination.boundaries.push({
      id: 'B-PLANNED-READ', type: 'dependency', producer: 'R1-01', consumer: 'R1-02',
      deliverable: 'artifacts/planned-output.json',
    });
    state.task_registry['tasks/task-R1-02-verify.md'].dependencies = ['tasks/task-R1-01-entry.md'];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    const synced = exec(fixture.root, SCAFFOLD, ['feature', '--sync-semantic-model']);
    assert.equal(synced.status, 0, output(synced));
    const grounded = exec(fixture.root, GROUNDER, [fixture.specDir, '--root', fixture.root]);
    assert.equal(grounded.status, 0, output(grounded));

    const withoutDependency = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    withoutDependency.task_registry['tasks/task-R1-02-verify.md'].dependencies = [];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(withoutDependency, null, 2)}\n`);
    const refused = exec(fixture.root, GROUNDER, [fixture.specDir, '--root', fixture.root]);
    assert.equal(refused.status, 1, output(refused));
    assert.match(output(refused), /read target not found.*artifacts\/planned-output\.json/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('schema 2.1 rejects unknown and dead machine fields outside the explicit adapter', () => {
  const cases = [
    ['top-level', (state) => { state.dead_machine_field = true; }, /dead_machine_field: unknown or legacy field is not canonical in closed schema 2\.1/],
    ['validation', (state) => { state.validation.legacy_digest = 'inert'; }, /validation: fields must be exactly status, semantic_review, semantic_review_history, authoring_validation/],
    ['scope-lock', (state) => { state.scope_lock.legacy_mode = true; }, /scope_lock: fields must be exactly/],
  ];
  for (const [name, mutate, expected] of cases) {
    const fixture = makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      mutate(state);
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, `${name}: ${output(result)}`);
      assert.match(output(result), expected);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});

test('digest mode refuses malformed physical topology and tracks substantive mutation classes', () => {
  const mutationCases = [
    ['authoring', (_fixture, state) => { state.authoring.design = 'draft'; }],
    ['policy', (_fixture, state) => {
      state.workflow_policy.assurance_level = 'Elevated';
      state.workflow_policy.classified_minimum.assurance_level = 'Elevated';
    }],
    ['coordination', (_fixture, state) => { state.coordination.boundaries[0].id = 'B-OWN-RENAMED'; }],
    ['task-content', (fixture) => {
      const file = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
      fs.appendFileSync(file, '\nConcrete authoring note changes the owned behavior.\n');
    }],
  ];
  for (const [name, mutate] of mutationCases) {
    const fixture = makeFixture({ ready: true });
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      const original = state.validation.semantic_review.semantic_digest;
      mutate(fixture, state);
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir, '--semantic-digest']);
      assert.equal(result.status, 0, `${name}: ${output(result)}`);
      assert.notEqual(result.stdout.trim(), original, `${name} did not invalidate digest`);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }

  const malformed = makeFixture();
  try {
    const taskPath = path.join(malformed.specDir, 'tasks/task-R1-02-verify.md');
    fs.writeFileSync(taskPath, fs.readFileSync(taskPath, 'utf8').replace('## Anchors and Ownership', '## Broken Ownership'));
    const result = exec(malformed.root, VALIDATOR, [malformed.specDir, '--semantic-digest']);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /^sha256:/m);
    assert.match(output(result), /digest requires exactly one ## Anchors and Ownership|requires one table/);
  } finally { fs.rmSync(malformed.root, { recursive: true, force: true }); }
});

test('taskless ready spec rejects a phantom design anchor through shared grounding', () => {
  const fixture = makeTasklessReadyFixture();
  try {
    const designPath = path.join(fixture.specDir, 'design.md');
    fs.writeFileSync(designPath, fs.readFileSync(designPath, 'utf8')
      .replace('src/design-boundary.js', 'src/phantom-boundary.js'));
    refreshSemanticDigest(fixture);
    const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /grounding: design\.md: A-D-01: read target not found/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('ready task rejects a dangling canonical A-D reference', () => {
  const fixture = makeFixture({ ready: true });
  try {
    const taskPath = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
    fs.writeFileSync(taskPath, fs.readFileSync(taskPath, 'utf8')
      .replace('- **In scope:**', '- **Canonical design anchor:** A-D-99\n- **In scope:**'));
    const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /dangling canonical design anchor reference A-D-99/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('dependency topology cannot legalize duplicate criterion implementation owners', () => {
  const fixture = makeFixture();
  try {
    const producerPath = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
    const verifierPath = path.join(fixture.specDir, 'tasks/task-R1-02-verify.md');
    fs.writeFileSync(producerPath, fs.readFileSync(producerPath, 'utf8').replace(
      '| A-R1-01-02 | artifact | `artifacts/R1-01.json` | verifier | write | create |',
      '| A-R1-01-02 | artifact | `artifacts/R1-01.json` | verifier | write | create |\n| A-R1-01-03 | artifact | `artifacts/dependency.json` | producer | write | create |',
    ));
    fs.writeFileSync(verifierPath, fs.readFileSync(verifierPath, 'utf8')
      .replace('_Requirements: 1.2_', '_Requirements: 1.1_')
      .replace(/R1\.2/g, 'R1.1')
      .replace('| A-R1-02-02 | artifact | `artifacts/R1-02.json` | verifier | write | create |', '| A-R1-02-02 | artifact | `artifacts/R1-02.json` | verifier | write | create |\n| A-R1-02-03 | artifact | `artifacts/dependency.json` | consumer | read | read |')
      .replace('## Dependencies\n- none', '## Dependencies\n- tasks/task-R1-01-entry.md'));
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    state.coordination.boundaries = [{
      id: 'B-OWN', type: 'ownership', tasks: ['R1-01', 'R1-02'],
      write_sets: {
        'R1-01': ['src/entry.js', 'artifacts/R1-01.json', 'artifacts/dependency.json'],
        'R1-02': ['src/service.js', 'artifacts/R1-02.json'],
      },
    }, {
      id: 'B-D', type: 'dependency', producer: 'R1-01', consumer: 'R1-02',
      deliverable: 'artifacts/dependency.json',
    }];
    state.task_registry['tasks/task-R1-02-verify.md'].dependencies = ['tasks/task-R1-01-entry.md'];
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result.status, 1, output(result));
    assert.match(output(result), /R1\.1: requires exactly one implementation owner; claimed by R1-01, R1-02/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('separate proof verifier passes without duplicating subject acceptance ownership', () => {
  const fixture = makeFixture({ ready: true });
  try {
    const verifier = fs.readFileSync(path.join(fixture.specDir, 'tasks/task-R1-02-verify.md'), 'utf8');
    assert.doesNotMatch(verifier, /^\s*[-*+]\s+(?:\*\*)?R1\.1/m);
    const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result.status, 0, output(result));
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('readiness action matrix permits absent create but rejects absent read modify and delete', () => {
  const cases = [
    ['create', 'write', 0],
    ['read', 'read', 1],
    ['modify', 'write', 1],
    ['delete', 'write', 1],
  ];
  for (const [action, access, expectedStatus] of cases) {
    const fixture = makeFixture({ ready: true });
    try {
      appendTaskAnchor(fixture, `| A-R1-01-03 | file | \`src/missing-${action}.js\` | owner | ${access} | ${action} |`);
      if (access === 'write') {
        const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
        state.coordination.boundaries.find((boundary) => boundary.type === 'ownership')
          .write_sets['R1-01'].push(`src/missing-${action}.js`);
        fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      }
      refreshSemanticDigest(fixture);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, expectedStatus, `${action}: ${output(result)}`);
      if (expectedStatus === 1) assert.match(output(result), new RegExp(`grounding: .* ${action} target not found`));
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});

test('ready semantic digest is stale after anchor topology or policy edits', () => {
  const cases = [
    (fixture) => {
      const file = path.join(fixture.specDir, 'tasks/task-R1-01-entry.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('src/entry.js', 'src/renamed-entry.js'));
    },
    (fixture, state) => { state.coordination.boundaries[0].id = 'B-OWN-EDITED'; },
    (_fixture, state) => {
      state.workflow_policy.assurance_level = 'Elevated';
      state.workflow_policy.classified_minimum.assurance_level = 'Elevated';
    },
  ];
  for (const mutate of cases) {
    const fixture = makeFixture({ ready: true });
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      mutate(fixture, state);
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, output(result));
      assert.match(output(result), /semantic_digest: stale/);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});

test('validator and CLI grounder reject the same missing modify counterexample', () => {
  const fixture = makeFixture({ ready: true });
  try {
    appendTaskAnchor(fixture, '| A-R1-01-03 | file | `src/shared-missing.js` | owner | write | modify |');
    const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
    state.coordination.boundaries.find((boundary) => boundary.type === 'ownership')
      .write_sets['R1-01'].push('src/shared-missing.js');
    fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
    refreshSemanticDigest(fixture);
    const validator = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    const grounder = exec(fixture.root, GROUNDER, [fixture.specDir, '--root', fixture.root]);
    assert.equal(validator.status, 1, output(validator));
    assert.equal(grounder.status, 1, output(grounder));
    const counterexample = /tasks\/task-R1-01-entry\.md: A-R1-01-03: modify target not found in work tree: src\/shared-missing\.js/;
    assert.match(output(validator), counterexample);
    assert.match(output(grounder), counterexample);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('schema 2.1 policy is exactly five fields and rejects inert override receipt locations', () => {
  const cases = [
    (state) => { state.override_receipt = null; },
    (state) => { state.workflow_policy.override_receipt = null; },
  ];
  for (const mutate of cases) {
    const fixture = makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      assert.deepEqual(Object.keys(state.workflow_policy).sort(), [
        'assurance_level', 'classified_minimum', 'planning_depth', 'risks', 'version',
      ]);
      mutate(state);
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, output(result));
      assert.match(output(result), /override receipt is inert|v2\.1 fields must be exactly/);
      assert.doesNotMatch(output(result), /persist only workflow_policy\.override_receipt/);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});

test('semantic authority mutation families reject empty inventory, ambiguous owners, vague proof, and projection drift', () => {
  const cases = [
    ['empty-criteria', (fixture) => {
      const file = path.join(fixture.specDir, 'requirements.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^- \*\*R1\.[12]\*\*:[^\n]+\n/gm, ''));
    }, /non-empty RN\.M inventory|criteria: must be a non-empty array/],
    ['taskless-owner-ambiguity', (fixture, state) => {
      state.semantic_model.verification_definitions[0].proof_owner = 'A-D-01';
      state.semantic_model.verification_definitions[0].evidence_anchor = 'A-D-01';
      state.semantic_model.criteria.find((criterion) => criterion.kind === 'proof').owner = 'A-D-01';
    }, /subject\/proof owners must be distinct/],
    ['vague-method', (fixture) => {
      const file = path.join(fixture.specDir, 'design.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(
        'Method command `node --test test/service.test.js`', 'Method inspect it',
      ));
    }, /Method must be exact command|structured method/],
    ['vague-reachability', (fixture) => {
      const file = path.join(fixture.specDir, 'design.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(
        'Reachability/grounding entrypoint `src/entry.js` via A-D-01, A-R1-02-02',
        'Reachability/grounding reachable through the application',
      ));
    }, /Reachability\/grounding must be entrypoint|projection drift/],
    ['machine-markdown-drift', (_fixture, state) => {
      state.semantic_model.anchors[0].target = 'src/authority-only-edit.js';
    }, /semantic_model: differs from Markdown projection/],
  ];
  for (const [name, mutate, expected] of cases) {
    const fixture = name === 'taskless-owner-ambiguity' ? makeTasklessReadyFixture() : makeFixture();
    try {
      const state = JSON.parse(fs.readFileSync(fixture.specPath, 'utf8'));
      mutate(fixture, state);
      fs.writeFileSync(fixture.specPath, `${JSON.stringify(state, null, 2)}\n`);
      const result = exec(fixture.root, VALIDATOR, [fixture.specDir]);
      assert.equal(result.status, 1, `${name}: ${output(result)}`);
      assert.match(output(result), expected, name);
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});

test('route and schema grounding never accepts design self-reference as repository evidence', () => {
  for (const type of ['route', 'schema']) for (const action of ['create', 'modify']) {
    const fixture = makeFixture();
    try {
      const designPath = path.join(fixture.specDir, 'design.md');
      const id = type === 'route' ? 'A-D-03' : 'A-D-04';
      const target = type === 'route' ? 'POST /self-grounded' : 'SelfGroundedRecord';
      fs.writeFileSync(designPath, fs.readFileSync(designPath, 'utf8')
        .replace('| A-D-02 | artifact', `| ${id} | ${type} | \`${target}\` | registration boundary | write | ${action} |\n| A-D-02 | artifact`)
        .replace('via A-D-01, A-R1-02-02', `via A-D-01, ${id}, A-R1-02-02`));
      promoteSemanticModel(fixture);
      const result = exec(fixture.root, GROUNDER, [fixture.specDir, '--root', fixture.root]);
      assert.equal(result.status, action === 'create' ? 0 : 1, `${type}/${action}: ${output(result)}`);
      if (action === 'modify') assert.match(output(result), new RegExp(`${type} target is not semantically reachable`));
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
  }
});
