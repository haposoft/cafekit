'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { finalizeReadiness } = require('../../src/claude/scripts/spec-readiness.cjs');

const SEMANTIC_DIGEST = `sha256:${'a'.repeat(64)}`;
const FEATURE_NAME = 'cafekit-semantic-eval-firewall';
const CREATED_AT = '2026-08-17T00:00:00.000Z';
const AUTHORING_VALIDATION = Object.freeze({
  schema_version: '1',
  requirements: { digest: `sha256:${'b'.repeat(64)}`, validated_at: CREATED_AT },
  design: { digest: `sha256:${'c'.repeat(64)}`, validated_at: CREATED_AT },
  research: { digest: `sha256:${'d'.repeat(64)}`, validated_at: CREATED_AT },
  tasks: { digest: `sha256:${'e'.repeat(64)}`, validated_at: CREATED_AT },
});

function review(verdict = 'PASS', overrides = {}) {
  return {
    verdict,
    findings: [],
    unresolved_decisions: [],
    graph_coverage: [{
      surface: 'criterion_local',
      covered: true,
      notes: 'criterion was reviewed against the canonical semantic model',
    }],
    reviewed_criteria: ['R1.1'],
    counterexamples: [],
    reviewer_evidence: null,
    ...overrides,
  };
}

function finding(id, blocking = false) {
  return {
    id,
    severity: 'High',
    location: 'spec.json:R1.1',
    summary: 'The semantic review requires an explicit disposition',
    blocking,
    disposition: 'open',
  };
}

function decision(id, blocking = false) {
  return {
    id,
    summary: 'The unresolved decision needs an owner and a recorded outcome',
    blocking,
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function dependencies({ staleAuthoring = false } = {}) {
  const calls = { digest: 0, validate: 0, ground: 0 };
  const expectedAuthoring = JSON.stringify(AUTHORING_VALIDATION);
  return {
    calls,
    semantic: {
      modelFromMarkdown: () => ({ model: { projected: true }, errors: [] }),
      stableJson,
    },
    validator: {
      computeSemanticDigest21: () => {
        calls.digest += 1;
        return { errors: [], digest: SEMANTIC_DIGEST };
      },
      validateSpec: (_directory, candidate) => {
        calls.validate += 1;
        const preserved = JSON.stringify(candidate.validation.authoring_validation) === expectedAuthoring;
        return { errors: staleAuthoring || !preserved ? ['authoring validation is stale'] : [], warnings: [] };
      },
    },
    grounder: () => {
      calls.ground += 1;
      return { errors: [] };
    },
  };
}

function fixture({ identity = { feature_name: FEATURE_NAME, created_at: CREATED_AT },
  semanticReviewHistory, authoringValidation = AUTHORING_VALIDATION } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-readiness-'));
  const validation = {
    status: 'completed',
    semantic_review: null,
    authoring_validation: authoringValidation,
  };
  if (semanticReviewHistory !== undefined) validation.semantic_review_history = semanticReviewHistory;
  const spec = {
    schema_version: '2.1',
    ...identity,
    semantic_model: { projected: false },
    validation,
    ready_for_implementation: false,
    timestamps: {
      init: CREATED_AT,
      requirements_done: CREATED_AT,
      design_done: CREATED_AT,
      validation_done: CREATED_AT,
    },
    updated_at: CREATED_AT,
  };
  fs.writeFileSync(path.join(directory, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  return { directory, spec };
}

function finalize(directory, reviewResult, options = {}) {
  const injected = dependencies(options);
  const result = finalizeReadiness({
    specDir: directory,
    projectRoot: directory,
    reviewResult,
    ...injected,
  });
  return { result, calls: injected.calls };
}

function cleanup(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

test('explicit PASS builds a completed C2 receipt, preserves C16, and is ready', () => {
  const { directory } = fixture();
  try {
    const { result, calls } = finalize(directory, review('PASS'));
    assert.equal(result.spec.ready_for_implementation, true);
    assert.equal(result.spec.validation.semantic_review.status, 'completed');
    assert.equal(result.spec.validation.semantic_review.verdict, 'PASS');
    assert.deepEqual(result.spec.validation.semantic_review.findings, []);
    assert.deepEqual(result.spec.validation.authoring_validation, AUTHORING_VALIDATION);
    assert.match(result.history_entry.review_receipt_digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(calls.validate, 2);
    assert.equal(calls.ground, 2);
  } finally {
    cleanup(directory);
  }
});

test('explicit FAIL is authoritative even when there are no blockers', () => {
  const { directory } = fixture();
  try {
    const { result } = finalize(directory, review('FAIL'));
    assert.equal(result.spec.ready_for_implementation, false);
    assert.equal(result.history_entry.verdict, 'FAIL');
    assert.equal(result.history_entry.blocking_count, 0);
    assert.equal(result.history_entry.lifecycle_disposition, 'CONTINUE');
  } finally {
    cleanup(directory);
  }
});

test('PASS with blocking findings or decisions is refused', () => {
  for (const overrides of [
    { findings: [finding('F-BLOCKING', true)] },
    { unresolved_decisions: [decision('D-BLOCKING', true)] },
  ]) {
    const { directory } = fixture();
    try {
      assert.throws(
        () => finalize(directory, review('PASS', overrides)),
        /PASS cannot contain blocking/,
      );
      const persisted = JSON.parse(fs.readFileSync(path.join(directory, 'spec.json'), 'utf8'));
      assert.equal(persisted.validation.semantic_review_history, undefined);
    } finally {
      cleanup(directory);
    }
  }
});

test('blocking_count counts blocking findings and unresolved decisions', () => {
  const { directory } = fixture();
  try {
    const { result } = finalize(directory, review('FAIL', {
      findings: [finding('F-BLOCKING', true), finding('F-OPEN', false)],
      unresolved_decisions: [decision('D-BLOCKING', true), decision('D-OPEN', false)],
    }));
    assert.equal(result.history_entry.blocking_count, 2);
  } finally {
    cleanup(directory);
  }
});

test('caller digest and derived/control fields are rejected from public input', () => {
  const fields = [
    'review_receipt_digest', 'lifecycle_disposition', 'repair_round', 'review_epoch',
    'attempt_index', 'semantic_review_history', 'lineage', 'readiness',
    'ready_for_implementation', 'validation', 'authoring_validation',
  ];
  for (const field of fields) {
    const { directory } = fixture();
    try {
      const invalid = { ...review(), [field]: field };
      assert.throws(() => finalize(directory, invalid), /fields must be exactly/);
    } finally {
      cleanup(directory);
    }
  }
});

test('lineage is deterministic and divergent or missing identity is rejected', () => {
  const firstFixture = fixture();
  const secondFixture = fixture();
  const divergentFixture = fixture({
    semanticReviewHistory: { lineage_id: `sha256:${'f'.repeat(64)}`, entries: [] },
  });
  const missingFixture = fixture({ identity: { created_at: CREATED_AT } });
  try {
    const first = finalize(firstFixture.directory, review()).result;
    const second = finalize(secondFixture.directory, review()).result;
    assert.equal(
      first.spec.validation.semantic_review_history.lineage_id,
      second.spec.validation.semantic_review_history.lineage_id,
    );
    assert.match(first.spec.validation.semantic_review_history.lineage_id, /^sha256:[0-9a-f]{64}$/);
    assert.throws(
      () => finalize(divergentFixture.directory, review()),
      /lineage_id diverges/,
    );
    assert.throws(
      () => finalize(missingFixture.directory, review()),
      /feature_name is required/,
    );
  } finally {
    cleanup(firstFixture.directory);
    cleanup(secondFixture.directory);
    cleanup(divergentFixture.directory);
    cleanup(missingFixture.directory);
  }
});

test('replaying a receipt is idempotent across the whole lineage', () => {
  const { directory } = fixture();
  try {
    finalize(directory, review('PASS'));
    const before = fs.readFileSync(path.join(directory, 'spec.json'), 'utf8');
    const replay = finalize(directory, review('PASS')).result;
    const after = fs.readFileSync(path.join(directory, 'spec.json'), 'utf8');
    assert.equal(replay.replayed, true);
    assert.equal(replay.spec.validation.semantic_review_history.entries.length, 1);
    assert.equal(after, before);
  } finally {
    cleanup(directory);
  }
});

test('replaying an earlier receipt dedupes across the whole lineage', () => {
  const { directory } = fixture();
  try {
    finalize(directory, review('PASS', { reviewed_criteria: ['R1.1'] }));
    finalize(directory, review('FAIL', { reviewed_criteria: ['R1.2'] }));
    const specFile = path.join(directory, 'spec.json');
    const beforeReplay = fs.readFileSync(specFile);
    const replay = finalize(directory, review('PASS', { reviewed_criteria: ['R1.1'] })).result;
    const afterReplay = fs.readFileSync(specFile);
    assert.equal(replay.replayed, true);
    assert.equal(replay.history_entry.sequence, 0);
    assert.equal(replay.history_entry.review_epoch, 0);
    assert.equal(replay.history_entry.attempt_index, 0);
    assert.equal(replay.spec.validation.semantic_review_history.entries.length, 2);
    assert.deepEqual(afterReplay, beforeReplay);
  } finally {
    cleanup(directory);
  }
});

test('a PASS starts the next epoch with a reset FAIL attempt index', () => {
  const { directory } = fixture();
  try {
    finalize(directory, review('PASS'));
    finalize(directory, review('FAIL', { reviewed_criteria: ['R1.2'] }));
    finalize(directory, review('PASS', { reviewed_criteria: ['R1.3'] }));
    const next = finalize(directory, review('FAIL', { reviewed_criteria: ['R1.4'] })).result;
    assert.equal(next.history_entry.review_epoch, 2);
    assert.equal(next.history_entry.attempt_index, 0);
    assert.equal(next.history_entry.lifecycle_disposition, 'CONTINUE');
  } finally {
    cleanup(directory);
  }
});

test('the third FAIL is terminal BLOCKED and there is no index 3', () => {
  const { directory } = fixture();
  try {
    finalize(directory, review('FAIL', { reviewed_criteria: ['R1.1'] }));
    finalize(directory, review('FAIL', { reviewed_criteria: ['R1.2'] }));
    const blocked = finalize(directory, review('FAIL', { reviewed_criteria: ['R1.3'] })).result;
    assert.equal(blocked.spec.ready_for_implementation, false);
    assert.equal(blocked.history_entry.attempt_index, 2);
    assert.equal(blocked.history_entry.lifecycle_disposition, 'BLOCKED');
    const specFile = path.join(directory, 'spec.json');
    const beforeReplay = fs.readFileSync(specFile);
    const replay = finalize(directory, review('FAIL', { reviewed_criteria: ['R1.3'] })).result;
    const afterReplay = fs.readFileSync(specFile);
    assert.equal(replay.replayed, true);
    assert.equal(replay.history_entry.attempt_index, 2);
    assert.deepEqual(afterReplay, beforeReplay);
    assert.throws(() => finalize(directory, review('PASS')), /already ends BLOCKED/);
    const persisted = JSON.parse(afterReplay.toString('utf8'));
    assert.deepEqual(
      persisted.validation.semantic_review_history.entries.map((entry) => entry.attempt_index),
      [0, 1, 2],
    );
  } finally {
    cleanup(directory);
  }
});

test('stale C16 authoring validation refuses the append', () => {
  const { directory } = fixture({
    authoringValidation: { ...AUTHORING_VALIDATION, design: { digest: 'stale' } },
  });
  try {
    const specFile = path.join(directory, 'spec.json');
    const before = fs.readFileSync(specFile);
    assert.throws(
      () => finalize(directory, review('PASS'), { staleAuthoring: true }),
      /readiness validation failed/,
    );
    const after = fs.readFileSync(specFile);
    assert.deepEqual(after, before);
    const persisted = JSON.parse(after.toString('utf8'));
    assert.equal(persisted.validation.semantic_review_history, undefined);
  } finally {
    cleanup(directory);
  }
});
