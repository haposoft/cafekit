'use strict';

// R1-01 owned proof: frozen C2 SemanticReviewReceipt (verdict vs
// lifecycle_disposition, structural-only checks per R3.4), C13
// SemanticReviewHistory (exact keys, whole-lineage digest dedupe), and C16
// AuthoringValidationReceipt (the sole spec-authoring-validation.cjs atomic
// writer, fail-closed freshness in validate-spec-output.cjs).

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const SCAFFOLD = path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-scaffold.cjs');
const VALIDATOR = path.join(PACKAGE_ROOT, 'src/claude/scripts/validate-spec-output.cjs');
const AUTHORING_VALIDATOR = path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-authoring-validation.cjs');

function exec(root, script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

function output(result) { return `${result.stdout}\n${result.stderr}`; }

function writeSpec(specPath, spec) {
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
}

function readSpec(specPath) {
  return JSON.parse(fs.readFileSync(specPath, 'utf8'));
}

function task(id, title, ownedPath, action, criterion, taskRole) {
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
${criterion ? `- [ ] Implement the owned behavior. _Requirements: ${criterion.slice(1)}_` : '- [ ] Verify the subject implementation through the canonical proof boundary.'}

## Acceptance
${criterion ? `- **${criterion}:** The command returns the concrete expected state.` : '- The verifier produces an observable proof artifact without claiming the subject acceptance criterion.'}

## Dependencies
- none

## Verification Plan
- **Verification ref:** V1
- **Task role:** ${taskRole}
- **Command:** \`node --test test/service.test.js\`
- **Expected:** Exit code 0 and exact state enabled.
- **Negative path:** Invalid input returns the specified failure state.
- **Reachability:** \`src/entry.js\`
`;
}

// A ready, coordinator-validated fixture. C16's own receipt is produced by
// the real spec-authoring-validation.cjs coordinator, never hand-written, so
// every test here starts from a byte-accurate receipt.
function makeReadyFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-c2-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/entry.js'), 'module.exports = { enabled: true };\n');
  fs.writeFileSync(path.join(root, 'src/service.js'), 'module.exports = { enabled: true };\n');
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
  const scaffold = exec(root, SCAFFOLD, ['feature', '--tasks', 'R1-01-entry,R1-02-verify', '--boundaries', JSON.stringify(boundaries)]);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  const specDir = path.join(root, 'specs/feature');
  fs.writeFileSync(path.join(specDir, 'requirements.md'), `# Requirements

## Requirements
### Requirement 1: Entry behavior
- **R1.1**: When valid input arrives, the entry shall return enabled state.
- **R1.2**: The verifier shall produce a separate observable proof artifact for the enabled state.
`);
  fs.writeFileSync(path.join(root, 'src/design-boundary.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(specDir, 'design.md'), `# Design

## Architecture
The entry delegates to the service and emits a verifier-owned artifact.

## Typed Anchors
| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-D-01 | file | \`src/design-boundary.js\` | design boundary | read | read |

## Canonical Contracts & Invariants
### D1 — Entry decision
The entry always returns enabled true on valid input.
### I1 — Invalid-state invariant
Invalid input never returns enabled state.
### C1 — Result contract
The result contains an enabled boolean.

## Verification Definitions
- **V1**: Criteria R1.1; Owner R1-01; Proof criteria R1.2; Proof owner R1-02; Evidence anchor A-R1-02-02; Decision refs D1, I1, C1; Method command \`node --test test/service.test.js\`; Expected exit 0 with enabled state and verifier artifact; Negative/failure invalid input returns rejected state without an enabled result; Reachability/grounding entrypoint \`src/entry.js\` via A-D-01, A-R1-02-02.
`);
  fs.writeFileSync(path.join(specDir, 'tasks/task-R1-01-entry.md'), task('R1-01', 'Entry', 'src/entry.js', 'modify', 'R1.1', 'subject'));
  fs.writeFileSync(path.join(specDir, 'tasks/task-R1-02-verify.md'), task('R1-02', 'Verify', 'src/service.js', 'modify', 'R1.2', 'verifier'));
  const promoted = exec(root, SCAFFOLD, ['feature', '--sync-semantic-model']);
  assert.equal(promoted.status, 0, output(promoted));
  const specPath = path.join(specDir, 'spec.json');
  const coordinated = exec(root, AUTHORING_VALIDATOR, [specDir]);
  assert.equal(coordinated.status, 0, output(coordinated));
  const spec = readSpec(specPath);
  spec.validation.status = 'completed';
  spec.validation.semantic_review = {
    status: 'completed',
    semantic_digest: null,
    verdict: 'PASS',
    lifecycle_disposition: 'CONTINUE',
    findings: [],
    unresolved_decisions: [],
    graph_coverage: [
      'criterion_local', 'cross_criterion', 'runtime_path', 'assumption_provenance', 'compatibility_migration',
    ].map((surface) => ({ surface, covered: true, notes: 'Fixture coverage.' })),
    repair_round: 0,
    reviewed_criteria: ['R1.1', 'R1.2'],
    counterexamples: [{
      criterion: 'R1.1', case_kind: 'failure',
      scenario: 'The entry receives an invalid input object without the required discriminator.',
      expected: 'The entry returns rejected state and never emits enabled true.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }, {
      criterion: 'R1.2', case_kind: 'adversarial',
      scenario: 'The implementation reports enabled state without producing the verifier-owned artifact.',
      expected: 'Verification fails because the separate proof artifact is absent.',
      decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
    }],
    reviewer_evidence: { assurance: 'Routine', summary: 'Fixture reviewer evidence for structural contract test.' },
  };
  writeSpec(specPath, spec);
  const digest = exec(root, VALIDATOR, [specDir, '--semantic-digest']);
  assert.equal(digest.status, 0, output(digest));
  const refreshed = readSpec(specPath);
  refreshed.validation.semantic_review.semantic_digest = digest.stdout.trim();
  refreshed.ready_for_implementation = true;
  writeSpec(specPath, refreshed);
  return { root, specDir, specPath };
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

function sha256Tag(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

test('C2 receipt freezes the exact key set with separate verdict and lifecycle_disposition', () => {
  const fixture = makeReadyFixture();
  try {
    const clean = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(clean.status, 0, output(clean));
    // Snapshot the known-clean baseline once; every mutation below clones it
    // fresh so one case's leftover mutation never contaminates the next.
    const baseline = readSpec(fixture.specPath);

    const missingLifecycle = JSON.parse(JSON.stringify(baseline));
    missingLifecycle.validation.semantic_review.lifecycle_disposition = null;
    writeSpec(fixture.specPath, missingLifecycle);
    const result1 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result1.status, 1, output(result1));
    assert.match(output(result1), /lifecycle_disposition: must be CONTINUE or BLOCKED when completed/);

    const extraKey = JSON.parse(JSON.stringify(baseline));
    extraKey.validation.semantic_review.reviewer_note = 'not a canonical C2 field';
    writeSpec(fixture.specPath, extraKey);
    const result2 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result2.status, 1, output(result2));
    assert.match(output(result2), /semantic_review: schema 2\.1 fields must be exactly/);

    const conflated = JSON.parse(JSON.stringify(baseline));
    conflated.validation.semantic_review.verdict = 'FAIL';
    conflated.validation.semantic_review.lifecycle_disposition = 'CONTINUE';
    writeSpec(fixture.specPath, conflated);
    const result3 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    // R3.4: structural validator enforces shape/type/enum/cardinality only —
    // it does not judge whether a FAIL+CONTINUE pairing is a meaningful
    // review outcome (that policy belongs to the R1-02 finalizer).
    assert.equal(result3.status, 0, output(result3));
  } finally { cleanup(fixture); }
});

test('sync migrates an exact legacy review into a fresh C2/C13/C16 lifecycle even when the semantic model is unchanged', () => {
  const fixture = makeReadyFixture();
  try {
    const legacy = readSpec(fixture.specPath);
    legacy.validation = {
      status: 'completed',
      semantic_review: {
        status: 'completed',
        semantic_digest: legacy.validation.semantic_review.semantic_digest,
        reviewed_criteria: legacy.validation.semantic_review.reviewed_criteria,
        counterexamples: legacy.validation.semantic_review.counterexamples,
      },
    };
    legacy.ready_for_implementation = true;
    writeSpec(fixture.specPath, legacy);

    const migrated = exec(fixture.root, SCAFFOLD, ['feature', '--sync-semantic-model']);
    assert.equal(migrated.status, 0, output(migrated));
    const next = readSpec(fixture.specPath);
    assert.equal(next.ready_for_implementation, false);
    assert.equal(next.validation.status, 'not-run');
    assert.deepEqual(Object.keys(next.validation).sort(), [
      'authoring_validation', 'semantic_review', 'semantic_review_history', 'status',
    ]);
    assert.equal(next.validation.semantic_review.status, 'not-run');
    assert.deepEqual(next.validation.semantic_review_history.entries, []);
    assert.equal(next.validation.authoring_validation, null);
    assert.equal(next.authoring.requirements, 'draft');
    assert.equal(next.authoring.design, 'draft');
    assert.equal(next.authoring.tasks, 'draft');
  } finally { cleanup(fixture); }
});

test('C2 findings/unresolved_decisions/graph_coverage/reviewer_evidence enforce exact shape', () => {
  const fixture = makeReadyFixture();
  try {
    const badFinding = readSpec(fixture.specPath);
    badFinding.validation.semantic_review.findings = [{
      id: 'F1', severity: 'Severe', location: 'design.md', summary: 'A concrete finding summary.', blocking: false, disposition: 'open',
    }];
    writeSpec(fixture.specPath, badFinding);
    const result1 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result1.status, 1, output(result1));
    assert.match(output(result1), /findings\[0\]\.severity: must be Critical, High, Medium, or Low/);

    const badCoverage = readSpec(fixture.specPath);
    badCoverage.validation.semantic_review.graph_coverage = badCoverage.validation.semantic_review.graph_coverage.slice(0, 4);
    writeSpec(fixture.specPath, badCoverage);
    const result2 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result2.status, 1, output(result2));
    assert.match(output(result2), /graph_coverage: missing required surface/);

    const badEvidence = readSpec(fixture.specPath);
    badEvidence.validation.semantic_review.reviewer_evidence = { assurance: 'Overkill', summary: 'A concrete reviewer summary.' };
    writeSpec(fixture.specPath, badEvidence);
    const result3 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result3.status, 1, output(result3));
    assert.match(output(result3), /reviewer_evidence\.assurance: must be Routine, Elevated, or Strict/);
  } finally { cleanup(fixture); }
});

test('C13 semantic_review_history freezes exact keys and dedupes across the whole lineage', () => {
  const fixture = makeReadyFixture();
  try {
    const spec = readSpec(fixture.specPath);
    const receiptDigestA = sha256Tag(Buffer.from('receipt-a'));
    const receiptDigestB = sha256Tag(Buffer.from('receipt-b'));
    const semanticDigest = spec.validation.semantic_review.semantic_digest;
    spec.validation.semantic_review_history.entries = [
      {
        sequence: 0, semantic_digest: semanticDigest, review_receipt_digest: receiptDigestA,
        verdict: 'FAIL', lifecycle_disposition: 'CONTINUE', blocking_count: 1, attempt_index: 0, review_epoch: 0,
      },
      {
        sequence: 1, semantic_digest: semanticDigest, review_receipt_digest: receiptDigestB,
        verdict: 'PASS', lifecycle_disposition: 'CONTINUE', blocking_count: 0, attempt_index: 1, review_epoch: 0,
      },
    ];
    writeSpec(fixture.specPath, spec);
    const clean = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(clean.status, 0, output(clean));
    // Snapshot the known-clean 2-entry baseline once; every mutation below
    // clones it fresh so one case's leftover mutation never contaminates the
    // next (each case must independently isolate the single defect it proves).
    const baseline = readSpec(fixture.specPath);

    const missingEpoch = JSON.parse(JSON.stringify(baseline));
    delete missingEpoch.validation.semantic_review_history.entries[0].review_epoch;
    writeSpec(fixture.specPath, missingEpoch);
    const result1 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result1.status, 1, output(result1));
    assert.match(output(result1), /entries\[0\]: fields must be exactly/);

    // Whole-lineage dedupe: a third entry replaying entry 0's digest is a
    // replay even though entry 0 is not the latest entry.
    const replay = JSON.parse(JSON.stringify(baseline));
    replay.validation.semantic_review_history.entries.push({
      sequence: 2, semantic_digest: semanticDigest, review_receipt_digest: receiptDigestA,
      verdict: 'PASS', lifecycle_disposition: 'CONTINUE', blocking_count: 0, attempt_index: 2, review_epoch: 0,
    });
    writeSpec(fixture.specPath, replay);
    const result2 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result2.status, 1, output(result2));
    assert.match(output(result2), /review_receipt_digest: replays an existing entry's digest anywhere in the lineage/);

    const badLineage = JSON.parse(JSON.stringify(baseline));
    badLineage.validation.semantic_review_history.lineage_id = sha256Tag(Buffer.from('wrong'));
    writeSpec(fixture.specPath, badLineage);
    const result3 = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(result3.status, 1, output(result3));
    assert.match(output(result3), /lineage_id: must be sha256 of feature_name and created_at/);
  } finally { cleanup(fixture); }
});

test('C16 coordinator is the sole atomic writer: clean pass writes, a failing pass leaves spec.json untouched', () => {
  const fixture = makeReadyFixture();
  try {
    const before = readSpec(fixture.specPath);
    assert.equal(before.authoring.requirements, 'validated');
    assert.equal(before.authoring.design, 'validated');
    assert.equal(before.authoring.tasks, 'validated');
    assert.ok(before.validation.authoring_validation);
    assert.match(before.validation.authoring_validation.requirements.digest, /^sha256:[a-f0-9]{64}$/);

    // Re-running the coordinator on already-fresh bytes is a clean no-op pass.
    const rerun = exec(fixture.root, AUTHORING_VALIDATOR, [fixture.specDir]);
    assert.equal(rerun.status, 0, output(rerun));

    // Break grounding (dangling design anchor target) so the coordinator's
    // own validate+ground pass fails; spec.json bytes must stay identical.
    const designPath = path.join(fixture.specDir, 'design.md');
    fs.writeFileSync(designPath, fs.readFileSync(designPath, 'utf8').replace(
      '| A-D-01 | file | `src/design-boundary.js` | design boundary | read | read |',
      '| A-D-01 | file | `src/does-not-exist.js` | design boundary | read | read |',
    ));
    const beforeBytes = fs.readFileSync(fixture.specPath, 'utf8');
    const failing = exec(fixture.root, AUTHORING_VALIDATOR, [fixture.specDir]);
    assert.notEqual(failing.status, 0, output(failing));
    const afterBytes = fs.readFileSync(fixture.specPath, 'utf8');
    assert.equal(afterBytes, beforeBytes, 'a failed coordinator run must leave spec.json completely unchanged');
  } finally { cleanup(fixture); }
});

test('C16/I20 fail-closed freshness: an edit after validation reverts the stage to draft-equivalent structurally', () => {
  const fixture = makeReadyFixture();
  try {
    const clean = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(clean.status, 0, output(clean));

    // Edit requirements.md after the coordinator already ran; do not rerun the
    // coordinator. authoring.requirements still reads validated, but its
    // receipt digest no longer matches the current bytes.
    fs.appendFileSync(path.join(fixture.specDir, 'requirements.md'), '\nA later edit changes the authored requirement text.\n');
    const stale = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(stale.status, 1, output(stale));
    assert.match(output(stale), /spec\.json\.authoring\.requirements: reads validated but validation\.authoring_validation.*digest-mismatched/);

    // An absent receipt with a validated reading is refused identically.
    const missingReceipt = readSpec(fixture.specPath);
    missingReceipt.validation.authoring_validation = null;
    writeSpec(fixture.specPath, missingReceipt);
    const absent = exec(fixture.root, VALIDATOR, [fixture.specDir]);
    assert.equal(absent.status, 1, output(absent));
    assert.match(output(absent), /spec\.json\.authoring\.requirements: reads validated but validation\.authoring_validation is absent/);
  } finally { cleanup(fixture); }
});
