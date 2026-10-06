'use strict';

// R0-01 owned semantic-firewall test for change-firewall.cjs (D1/C1/C9/C10/C14/C15/C16).
// Every mutation below runs against an isolated temp git repo constructed by
// this file; the real project checkout's own change-firewall authority is
// never touched, except the one, explicitly read-only precondition check
// below (D11/R1.14), which must run before any other assertion in this file.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const cf = require(path.join(ROOT, 'src/claude/scripts/change-firewall.cjs'));
const DIGEST = require(path.join(ROOT, 'src/claude/scripts/spec-authoring-digest.cjs'));
const VALIDATOR = require(path.join(ROOT, 'src/claude/scripts/validate-spec-output.cjs'));
const POLICY = require(path.join(ROOT, 'src/claude/scripts/workflow-policy.cjs'));

// ---------------------------------------------------------------------------
// generic fixture helpers
// ---------------------------------------------------------------------------

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function withTempRepo(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-change-firewall-'));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// Minimal repo skeleton: git init + the exact directory shape D1/C10/C15 read
// from, plus a committed packages/spec/package.json.
function initRepo(root, { version = '0.0.1-fixture' } = {}) {
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'CafeKit Test']);
  writeJson(path.join(root, 'packages/spec/package.json'), { name: 'fixture-package', version });
  fs.mkdirSync(path.join(root, 'packages/spec/benchmarks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/spec/.cafekit-release'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/spec/src/claude/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/spec/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/spec/bin/__tests__'), { recursive: true });
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'init']);
  return git(root, ['rev-parse', 'HEAD']).trim();
}

function writeLegacyBridge(root, { baseCommit, semanticDigest = cf.sha256Tag('bridge-digest') }) {
  writeJson(path.join(root, 'specs/archive/cafekit-semantic-eval-firewall/reports/bootstrap-legacy-bridge-review.json'), {
    schema_version: '1',
    verdict: 'PASS',
    blocking_count: 0,
    reviewed_criteria: ['R1.1'],
    semantic_digest: semanticDigest,
    bootWindowBaseCommit: baseCommit,
    written_at: new Date().toISOString(),
  });
}

function writeFeatureSeedPass(root, { reviewReceiptDigest = cf.sha256Tag('seed-review-receipt') } = {}) {
  writeJson(path.join(root, 'specs/archive/cafekit-semantic-eval-firewall/spec.json'), {
    validation: {
      semantic_review_history: {
        entries: [{
          sequence: 0, review_epoch: 0, verdict: 'PASS',
          review_receipt_digest: reviewReceiptDigest, semantic_digest: cf.sha256Tag('feature-digest'),
        }],
      },
    },
  });
  return reviewReceiptDigest;
}

// Builds a durable Compact/Full authorized_evolution spec_ref fixture: a real
// requirements.md/design.md pair that computeSemanticDigest21 accepts with
// zero errors, authoring both validated with a fresh C16 receipt, and an
// optional seed semantic_review_history PASS entry matching the real digest.
function buildEvolutionSpecFixture(root, {
  name, planningDepth = 'Compact', includeSeedPass = true, freshReceipt = true,
} = {}) {
  const specDir = path.join(root, 'specs', name);
  const requirementsPath = path.join(specDir, 'requirements.md');
  const designPath = path.join(specDir, 'design.md');
  writeFile(
    requirementsPath,
    '# Requirements\n\n### Requirement 1: One\n\n'
    + '- **R1.1** When input arrives, the service shall return one deterministic result.\n'
    + '- **R1.2** When the result is produced, the caller shall be able to verify status value 1.\n',
  );
  writeFile(
    designPath,
    '# Design\n\n## Boundary\n\nThe `src/one.js` module owns the fixture behavior and returns one deterministic result.\n\n'
    + '## Typed Anchors\n\n| ID | Type | Target | Role | Access | Action |\n|---|---|---|---|---|---|\n'
    + '| A-D-01 | file | `src/one.js` | runtime entrypoint | read | read |\n'
    + '| A-D-02 | command | `node --test test/one.test.js` | proof command | read | read |\n\n'
    + '## Decisions and Invariants\n\n### D1 — Stable result\n\nReturn status value 1 and reject invalid input.\n\n'
    + '### I1 — Invalid-state invariant\n\nInvalid input never reports the success status.\n\n'
    + '### C1 — Result contract\n\nThe result contains one numeric status.\n\n'
    + '## Verification Definitions\n\n'
    + '- **V1**: Subject criteria R1.1; Subject owner A-D-01; Proof criteria R1.2; Proof owner A-D-02; '
    + 'Evidence anchor A-D-02; Decision refs D1, I1, C1; Method command `node --test test/one.test.js`; '
    + 'Expected exit code 0 and status value 1; Negative/failure invalid input returns a deterministic error; '
    + 'Reachability/grounding entrypoint `src/one.js` via A-D-01, A-D-02.\n',
  );
  const policy = POLICY.workflowPolicySnapshot({ riskSignals: {}, planningDepth });
  const baseSpec = {
    schema_version: '2.1',
    feature_name: name,
    created_at: '2026-08-16T00:00:00+07:00',
    updated_at: '2026-08-16T00:00:00+07:00',
    language: 'en',
    status: 'in_progress',
    current_phase: 'design',
    scope_lock: { source: 'fixture', in_scope: [], out_of_scope: [], expansion_policy: 'requires-user-approval' },
    coordination: { boundaries: [] },
    authoring: { requirements: 'validated', design: 'validated', research: 'absent', tasks: 'absent' },
    validation: { status: 'not-run' },
    ready_for_implementation: false,
    workflow_policy: policy,
  };
  const digestResult = VALIDATOR.computeSemanticDigest21(specDir, baseSpec);
  assert.deepEqual(digestResult.errors, [], `fixture spec must compute cleanly: ${digestResult.errors.join('; ')}`);
  const digest = digestResult.digest;

  const receiptEntry = (bytesDigest) => ({ digest: bytesDigest, validated_at: '2026-08-16T00:00:01+07:00' });
  const authoringValidation = freshReceipt ? {
    schema_version: '1',
    requirements: receiptEntry(DIGEST.digestFileBytes(requirementsPath)),
    design: receiptEntry(DIGEST.digestFileBytes(designPath)),
    research: receiptEntry(DIGEST.RESEARCH_ABSENT_DIGEST),
    tasks: receiptEntry(DIGEST.TASKS_ABSENT_DIGEST),
  } : null;

  const reviewReceiptDigest = cf.sha256Tag(`${name}-independent-pass-1`);
  const entries = includeSeedPass ? [{
    sequence: 0, review_epoch: 0, verdict: 'PASS',
    semantic_digest: digest, review_receipt_digest: reviewReceiptDigest,
  }] : [];

  const fullSpec = {
    ...baseSpec,
    validation: {
      status: 'not-run',
      authoring_validation: authoringValidation,
      semantic_review_history: { lineage_id: cf.sha256Tag(`${name}-lineage`), entries },
    },
  };
  writeJson(path.join(specDir, 'spec.json'), fullSpec);
  return {
    specDir, specRef: path.posix.join('specs', name), digest, reviewReceiptDigest, requirementsPath, designPath,
  };
}

function readFileBytes(...segments) {
  return fs.readFileSync(path.join(...segments));
}

// ---------------------------------------------------------------------------
// R1.14 / D11 precondition -- MUST run before any other change-firewall
// assertion in this file. Reads the real project checkout only; never writes it.
// ---------------------------------------------------------------------------

test('R1.14 precondition: the real legacy-bridge artifact exists and matches its exact schema before any other assertion', () => {
  const parsed = cf.assertLegacyBridgeArtifact();
  assert.equal(parsed.schema_version, '1');
  assert.equal(parsed.verdict, 'PASS');
  assert.equal(parsed.blocking_count, 0);
  assert.ok(Array.isArray(parsed.reviewed_criteria) && parsed.reviewed_criteria.length > 0);
  assert.match(parsed.semantic_digest, /^sha256:[0-9a-f]{64}$/);
  assert.match(parsed.bootWindowBaseCommit, /^[0-9a-f]{40}$/);
  assert.equal(typeof parsed.written_at, 'string');
  assert.deepEqual(
    Object.keys(parsed).sort(),
    ['blocking_count', 'bootWindowBaseCommit', 'reviewed_criteria', 'schema_version', 'semantic_digest', 'verdict', 'written_at'],
  );
});

test('R1.14 negative: an absent or malformed legacy-bridge artifact fails the precondition nonzero', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    assert.throws(() => inst.assertLegacyBridgeArtifact(), (error) => error.code === 'legacy_bridge_missing');

    writeJson(path.join(root, 'specs/archive/cafekit-semantic-eval-firewall/reports/bootstrap-legacy-bridge-review.json'), {
      schema_version: '1', verdict: 'FAIL', blocking_count: 0,
      reviewed_criteria: ['R1.1'], semantic_digest: cf.sha256Tag('x'),
      bootWindowBaseCommit: '0'.repeat(40), written_at: new Date().toISOString(),
    });
    assert.throws(() => inst.assertLegacyBridgeArtifact(), (error) => error.code === 'legacy_bridge_malformed');
  });
});

// ---------------------------------------------------------------------------
// D1 allowlist (R1.1 scaffolding)
// ---------------------------------------------------------------------------

test('D1: reserved control-plane paths are excluded from the protected allowlist before the prefix match', () => {
  assert.equal(cf.isProtectedPath('packages/spec/benchmarks/release-baseline.json'), false);
  assert.equal(cf.isProtectedPath('packages/spec/benchmarks/benchmark-failure-ledger.json'), false);
  assert.equal(cf.isProtectedPath('packages/spec/benchmarks/other-fixture.json'), true);
  assert.equal(cf.isProtectedPath('packages/spec/.cafekit-release/change-firewall-freeze.json'), false);
  assert.equal(cf.isProtectedPath('packages/spec/src/claude/scripts/foo.cjs'), true);
  assert.equal(cf.isProtectedPath('packages/spec/scripts/bar.mjs'), true);
  assert.equal(cf.isProtectedPath('packages/spec/bin/__tests__/x.test.js'), true);
  assert.equal(cf.isProtectedPath('packages/spec/bin/phases/copy-payload.js'), true);
  assert.equal(cf.isProtectedPath('packages/spec/package.json'), true);
  assert.equal(cf.isProtectedPath('packages/spec/.gitignore'), true);
  assert.equal(cf.isProtectedPath('packages/spec/README.md'), false);
});

// ---------------------------------------------------------------------------
// Boot-window absence (this task's authority decision): the real checkout's
// own release-baseline.json / benchmark-failure-ledger.json do not exist yet
// (R0-01 never invokes bootstrapBaseline/openFailure); loaders must read this
// as the exact, contract-legitimate "absent" state, not an error.
// ---------------------------------------------------------------------------

test('boot-window absence: loadBaselineAuthority/loadFailureLedger read the real checkout state as legitimate absent, not malformed', () => {
  assert.deepEqual(cf.loadBaselineAuthority(), { state: 'absent' });
  assert.deepEqual(cf.loadFailureLedger(), { state: 'absent' });
  assert.equal(cf.computeFailureLedgerDigest(), cf.NO_FAILURES_ATTESTATION_DIGEST);
  assert.throws(() => cf.assertBaselineUsable(), (error) => error.code === 'authority_absent');
  // assertFailureLedgerUsable never throws on legitimate absence (C15: "zero-open-failures", not malformed).
  assert.deepEqual(cf.assertFailureLedgerUsable(), { state: 'absent' });
});

test('R1.3: assertNoBaseOverrideEnv rejects only the exact six reserved CAFEKIT_ keys, by name only, never a name-shape guess', () => {
  function withEnvVar(name, value, run) {
    const had = Object.prototype.hasOwnProperty.call(process.env, name);
    const previous = process.env[name];
    process.env[name] = value;
    try {
      return run();
    } finally {
      if (had) process.env[name] = previous; else delete process.env[name];
    }
  }

  // Positive: the exact closed six-key reserved set -- presence alone (any
  // value) must reject exit 2 and must never mutate the real checkout's own
  // (boot-window absent) authority state.
  for (const name of [
    'CAFEKIT_BASE_COMMIT', 'CAFEKIT_BASELINE_COMMIT',
    'CAFEKIT_BASE_REF', 'CAFEKIT_BASELINE_REF',
    'CAFEKIT_BASE_PATH', 'CAFEKIT_BASELINE_PATH',
  ]) {
    withEnvVar(name, 'attempted-override', () => {
      assert.throws(() => cf.assertBaselineUsable(), (error) => error.code === 'caller_base_override', `${name} must be rejected`);
      assert.deepEqual(cf.loadBaselineAuthority(), { state: 'absent' }, `${name} rejection must not mutate authority state`);
    });
  }

  // Negative controls: no other environment variable name is ever a channel,
  // however base/baseline-shaped or ambient -- presence must never influence
  // behavior, so the real absent-authority checkout state must still surface,
  // not a false reject. GITHUB_BASE_REF/GITHUB_BASE_SHA are ambient vars
  // GitHub Actions sets on every pull_request run; OVERRIDE_BASE_COMMIT,
  // FORCE_BASELINE_REF, and BASECOMMIT are base/baseline-shaped names that
  // are NOT in the closed six-key reserved set; RELEASE_BASE_URL,
  // AUTHORITY_BASE_URL, DATABASE_URL, and RELEASE_NOTES_PATH share no exact
  // reserved name either -- none of these are ever read for authority.
  for (const name of [
    'RELEASE_BASE_URL', 'AUTHORITY_BASE_URL', 'DATABASE_URL', 'RELEASE_NOTES_PATH',
    'GITHUB_BASE_REF', 'GITHUB_BASE_SHA', 'OVERRIDE_BASE_COMMIT', 'FORCE_BASELINE_REF', 'BASECOMMIT',
  ]) {
    withEnvVar(name, 'not-an-override', () => {
      assert.throws(() => cf.assertBaselineUsable(), (error) => error.code === 'authority_absent', `${name} must never be treated as an override`);
    });
  }
});

// ---------------------------------------------------------------------------
// C1 ChangeProposal shape / R1.1 / R1.2
// ---------------------------------------------------------------------------

test('C1/R1.1/R1.2: benchmark_remediation is refused for a non-framework_regression class without blocking a distinct authorized_evolution', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    const changedPaths = ['packages/spec/scripts/x.mjs'];
    assert.throws(
      () => inst.assertHotspotChangeAllowed({
        changedPaths,
        proposal: {
          change_intent: 'benchmark_remediation', proposal_id: 'p', invariant_id: 'inv',
          hypothesis: 'h', owner_layer: 'benchmark_controller', primary_failure_class: 'model_runtime_error',
          paths: changedPaths, failure_ids: ['F1'], evidence: ['e'], true_positive_family: ['tp'],
          negative_control_family: ['nc'], rollback_condition: 'revert',
        },
      }),
      (error) => error.code === 'non_framework_regression',
    );
    // R1.2: this refusal is scoped to benchmark_remediation only; it must not read as
    // "no product change to a protected path is ever possible" -- proven by R1.7 tests below.
  });
});

test('C1: neither variant may embed a release-candidate lifecycle binding digest', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    assert.throws(
      () => inst.assertHotspotChangeAllowed({
        changedPaths: ['packages/spec/scripts/x.mjs'],
        proposal: {
          change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: 'specs/whatever',
          spec_semantic_digest: cf.sha256Tag('a'), independent_pass_receipt_digest: cf.sha256Tag('b'),
          planned_write_set: ['packages/spec/scripts/x.mjs'], rollback_condition: 'r',
          negative_control_family: ['nc'], treeDigest: cf.sha256Tag('c'),
        },
      }),
      (error) => error.code === 'malformed_proposal',
    );
  });
});

// ---------------------------------------------------------------------------
// C10 / R1.3 / R1.4: load rules, empty-path rule conditioned on authority state
// ---------------------------------------------------------------------------

test('C10/R1.3: absent authority fails closed for every command except bootstrapBaseline', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    assert.deepEqual(inst.loadBaselineAuthority(), { state: 'absent' });
    assert.throws(() => inst.assertBaselineUsable(), (error) => error.code === 'authority_absent');
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'authority_absent');
  });
});

test('C10/R1.5: computeCandidateDigest binds exactly the C9 field set, non-circular', () => {
  const fields = {
    baselineAuthorityDigest: cf.sha256Tag('a'), baselineGeneration: 0, baselineCommit: '0'.repeat(40),
    failureLedgerDigest: cf.NO_FAILURES_ATTESTATION_DIGEST, failureLedgerGeneration: null,
    remediatedFailureIds: [], changedPaths: ['a'], treeDigest: cf.sha256Tag('t'),
    proposalDigest: cf.NO_CHANGE_ATTESTATION_DIGEST, packageVersion: '1.0.0',
  };
  const digest = cf.computeCandidateDigest(fields);
  assert.match(digest, /^sha256:[0-9a-f]{64}$/);
  assert.throws(() => cf.computeCandidateDigest({ ...fields, candidateDigest: digest }), (error) => error.code === 'malformed_input');
  assert.throws(() => cf.computeCandidateDigest({ ...fields, extra: 1 }), (error) => error.code === 'malformed_input');
  const missing = { ...fields };
  delete missing.treeDigest;
  assert.throws(() => cf.computeCandidateDigest(missing), (error) => error.code === 'malformed_input');
});

// ---------------------------------------------------------------------------
// C14 BootstrapAttestation / R1.8
// ---------------------------------------------------------------------------

test('C14/R1.8: bootstrapBaseline refuses before the seed PASS exists, and refuses base/head mismatches', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/change.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });

    // feature spec.json exists but carries no semantic_review_history yet (no seed PASS).
    writeJson(path.join(root, 'specs/archive/cafekit-semantic-eval-firewall/spec.json'), { validation: {} });
    assert.throws(
      () => inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: cf.sha256Tag('x'), packageVersion: '0.0.1-fixture' }),
      (error) => error.code === 'seed_pass_missing',
    );

    const reviewReceiptDigest = writeFeatureSeedPass(root);

    // baseCommit mismatch vs bridge's own bootWindowBaseCommit
    assert.throws(
      () => inst.bootstrapBaseline({ baseCommit: headCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' }),
      (error) => error.code === 'base_commit_mismatch',
    );

    // stale headCommit (not the actual current HEAD)
    assert.throws(
      () => inst.bootstrapBaseline({ baseCommit, headCommit: baseCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' }),
      (error) => error.code === 'stale_attestation',
    );

    // bootstrapReviewDigest not bound to the seed PASS entry
    assert.throws(
      () => inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: cf.sha256Tag('wrong'), packageVersion: '0.0.1-fixture' }),
      (error) => error.code === 'stale_attestation',
    );

    // valid attestation: generation 0 written, baselineCommit explicit
    const boot = inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });
    assert.deepEqual(boot.protectedPaths, ['packages/spec/src/claude/scripts/change.cjs']);
    const authority = inst.loadBaselineAuthority();
    assert.equal(authority.state, 'bootstrap');
    assert.equal(authority.record.generation, 0);
    assert.equal(authority.record.baselineCommit, baseCommit);
    assert.equal(authority.record.previousBaselineDigest, null);

    // running again once authority exists is refused
    assert.throws(
      () => inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' }),
      (error) => error.code === 'authority_exists',
    );
  });
});

test('C10/R1.3: bootstrap state with empty derived protected paths always exits 2 (never a valid no-change bootstrap)', () => {
  withTempRepo((root) => {
    const commit = initRepo(root);
    // Right after a real bootstrapBaseline call, baselineCommit == baseCommit,
    // which always still shows the boot-window diff as pending -- so a
    // genuinely *empty* derived diff under state=bootstrap can only be
    // constructed directly (nothing committed for this path yet, so C10's
    // one-hop provenance rule trusts it per case (2)) to isolate this exact
    // state-conditioned rule from bootstrapBaseline's own, unrelated
    // non-empty-boot-window-diff precondition.
    writeJson(path.join(root, 'packages/spec/benchmarks/release-baseline.json'), {
      state: 'bootstrap', generation: 0, baselineCommit: commit,
      baselinePackageVersion: '0.0.1-fixture', bootstrapReviewDigest: cf.sha256Tag('seed'),
      previousBaselineDigest: null,
    });
    const inst = cf.createChangeFirewall({ root });
    assert.equal(inst.deriveProtectedChangedPaths(commit).length, 0);
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'empty_paths_invalid');
  });
});

test('REGRESSION round3 (critical): a committed bootstrap authority record hand-edited out-of-band (baselineCommit swapped) fails closed on the next normal use, before it can create/advance a freeze', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round3-provenance.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    // Commit the genuine bootstrap record itself: HEAD now carries a real,
    // trustworthy state=bootstrap/generation=0/baselineCommit=baseCommit record.
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'bootstrap record committed']);

    // Out-of-band edit: swap baselineCommit to a different real ancestor
    // (headCommit) while leaving state/generation untouched, exactly as
    // C10/R1.3's own load rule requires a bootstrap record to keep generation
    // 0. This tampered record is then itself landed via a later *ordinary*
    // commit -- the exact reviewed laundering path (not left dangling
    // uncommitted) -- before any firewall operation ever inspects it.
    const authorityPath = path.join(root, 'packages/spec/benchmarks/release-baseline.json');
    const tampered = JSON.parse(fs.readFileSync(authorityPath, 'utf8'));
    assert.equal(tampered.state, 'bootstrap');
    assert.equal(tampered.baselineCommit, baseCommit);
    tampered.baselineCommit = headCommit;
    fs.writeFileSync(authorityPath, `${JSON.stringify(tampered, null, 2)}\n`);
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'tampered bootstrap record landed via an ordinary commit']);

    // Before this fix, assertBaselineUsable only ran verifyAuthorityProvenance
    // for state === 'released', so a tampered *bootstrap* record sailed
    // through unnoticed and could be laundered into the released chain by a
    // later advanceBaseline. It must now fail closed exactly like a tampered
    // released record already does, even after the tamper itself was committed.
    assert.throws(() => inst.assertBaselineUsable(), (error) => error.code === 'out_of_band_edit');
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'out_of_band_edit');
    assert.throws(() => inst.advanceBaseline(Buffer.from('{}')), (error) => error.code === 'out_of_band_edit');
  });
});

// ---------------------------------------------------------------------------
// Full C9/C10/C12/C15 publication lifecycle (R1.7, R1.9-R1.13, I11-I14, I18)
// ---------------------------------------------------------------------------

test('full lifecycle: bootstrap -> authorized_evolution freeze -> publish -> clean no_protected_change -> benchmark_remediation + ledger -> crash/retry -> resolveFailure self-verification', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/boot-window-change.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();

    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });
    const authority0 = inst.loadBaselineAuthority();
    assert.equal(authority0.state, 'bootstrap');

    // --- Cycle 1: authorized_evolution freeze over the boot-window diff (R1.7) ---
    const evo = buildEvolutionSpecFixture(root, { name: 'cycle1-spec' });
    const changedPaths1 = ['packages/spec/src/claude/scripts/boot-window-change.cjs'];
    const proposal1 = {
      change_intent: 'authorized_evolution', proposal_id: 'p1', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths1, rollback_condition: 'revert the commit',
      negative_control_family: ['a write outside planned_write_set is rejected'],
    };
    const freeze1 = inst.createFreezeManifest(proposal1);
    assert.equal(freeze1.changeKind, 'protected_change');
    assert.deepEqual(freeze1.remediatedFailureIds, []);
    assert.deepEqual(freeze1.changedPaths, changedPaths1);
    const verified1 = inst.verifyFreezeManifest();
    assert.equal(verified1.candidateDigest, freeze1.candidateDigest);

    // I14: a superseded (lower-sequence) citation is refused once a fresh re-PASS exists.
    writeFile(evo.designPath, `${fs.readFileSync(evo.designPath, 'utf8')}\n<!-- a legitimate post-PASS correction -->\n`);
    const rebuiltSpec = JSON.parse(fs.readFileSync(path.join(evo.specDir, 'spec.json'), 'utf8'));
    const redigest = VALIDATOR.computeSemanticDigest21(evo.specDir, rebuiltSpec);
    assert.deepEqual(redigest.errors, []);
    assert.notEqual(redigest.digest, evo.digest, 'the correction must actually change the digest');
    const freshReceiptDigest = cf.sha256Tag('cycle1-spec-independent-pass-2');
    rebuiltSpec.validation.authoring_validation = {
      schema_version: '1',
      requirements: { digest: DIGEST.digestFileBytes(evo.requirementsPath), validated_at: '2026-08-16T00:10:00+07:00' },
      design: { digest: DIGEST.digestFileBytes(evo.designPath), validated_at: '2026-08-16T00:10:00+07:00' },
      research: { digest: DIGEST.RESEARCH_ABSENT_DIGEST, validated_at: '2026-08-16T00:10:00+07:00' },
      tasks: { digest: DIGEST.TASKS_ABSENT_DIGEST, validated_at: '2026-08-16T00:10:00+07:00' },
    };
    rebuiltSpec.validation.semantic_review_history.entries.push({
      sequence: 1, review_epoch: 1, verdict: 'PASS', semantic_digest: redigest.digest, review_receipt_digest: freshReceiptDigest,
    });
    writeJson(path.join(evo.specDir, 'spec.json'), rebuiltSpec);
    assert.throws(
      () => inst.assertHotspotChangeAllowed({
        changedPaths: changedPaths1,
        proposal: { ...proposal1, spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest },
      }),
      (error) => error.code === 'stale_spec_digest',
    );
    const rebound = inst.assertHotspotChangeAllowed({
      changedPaths: changedPaths1,
      proposal: { ...proposal1, spec_semantic_digest: redigest.digest, independent_pass_receipt_digest: freshReceiptDigest },
    });
    assert.equal(rebound.changeKind, 'protected_change');
    assert.throws(
      () => inst.assertHotspotChangeAllowed({
        changedPaths: changedPaths1,
        proposal: { ...proposal1, spec_semantic_digest: redigest.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest },
      }),
      (error) => error.code === 'superseded_pass_citation',
    );

    // Build + publish receipt 1 (I11/I13/I12).
    const freezeBytes1 = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-artifact-1.tgz'), 'fake-tgz-bytes-1');
    const artifactDigest1 = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/release-artifact-1.tgz'));
    const receiptObj1 = {
      schema_version: '1', receipt_id: 'r1', status: 'published',
      baselineAuthorityDigest: authority0.digest, baselineGeneration: authority0.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes1), candidateDigest: freeze1.candidateDigest,
      treeDigest: freeze1.treeDigest, packageVersion: freeze1.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/release-artifact-1.tgz',
      artifactDigest: artifactDigest1, resolvedFailureIds: [],
    };
    const receiptBytes1 = Buffer.from(`${JSON.stringify(receiptObj1, null, 2)}\n`);
    const publish1 = inst.advanceBaseline(receiptBytes1);
    assert.equal(publish1.status, 'published');
    const afterPublish1 = inst.loadBaselineAuthority();
    assert.equal(afterPublish1.state, 'released');
    assert.equal(afterPublish1.record.generation, 1);
    assert.equal(afterPublish1.record.releaseReceiptDigest, cf.sha256Tag(receiptBytes1));
    assert.equal(afterPublish1.record.baselineCommit, headCommit);
    assert.equal(fs.existsSync(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json')), false, 'advanceBaseline must invalidate the freeze');

    // I11 (1a): idempotent replay against intact canonical evidence is a no-op.
    const republish1 = inst.advanceBaseline(receiptBytes1);
    assert.equal(republish1.status, 'already_published');
    assert.equal(inst.loadBaselineAuthority().record.generation, 1);

    // I11 (1b): idempotent repair when canonical evidence is lost/corrupted.
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-receipt.json'), 'corrupted-not-json');

    // Prove the implementation itself re-reads and re-verifies the repair
    // write rather than trusting atomicWriteBytes blindly: seam the sole
    // physical write call the repair path uses so the bytes actually landing
    // on disk are NOT the supplied receipt bytes, then assert advanceBaseline
    // refuses to report "repaired" on that unverified write.
    const realWriteFileSync = fs.writeFileSync;
    fs.writeFileSync = (fd, data, ...rest) => {
      if (Buffer.isBuffer(data) && data.equals(receiptBytes1)) {
        return realWriteFileSync.call(fs, fd, Buffer.from('corrupted-by-seam'), ...rest);
      }
      return realWriteFileSync.call(fs, fd, data, ...rest);
    };
    try {
      assert.throws(
        () => inst.advanceBaseline(receiptBytes1),
        (error) => error.code === 'receipt_unverifiable',
      );
    } finally {
      fs.writeFileSync = realWriteFileSync;
    }
    // The failed repair attempt must never rotate authority or claim success.
    assert.equal(inst.loadBaselineAuthority().record.generation, 1);
    assert.equal(inst.loadBaselineAuthority().record.releaseReceiptDigest, cf.sha256Tag(receiptBytes1));

    // With the seam removed, a real retry idempotently repairs the canonical
    // evidence and its own re-verification confirms the write before success.
    const repaired = inst.advanceBaseline(receiptBytes1);
    assert.equal(repaired.status, 'repaired');
    assert.deepEqual(readFileBytes(root, 'packages/spec/.cafekit-release/release-receipt.json'), receiptBytes1);

    // R1.3/D1: released state with empty derived protected paths is a clean no_protected_change freeze.
    const cleanFreeze = inst.createFreezeManifest(null);
    assert.equal(cleanFreeze.changeKind, 'no_protected_change');
    assert.deepEqual(cleanFreeze.changedPaths, []);
    assert.equal(cleanFreeze.proposalDigest, cf.NO_CHANGE_ATTESTATION_DIGEST);
    inst.verifyFreezeManifest();
    inst.invalidateFreeze();

    // --- Cycle 2: benchmark_remediation + C15 ledger + reclassify + crash resume + resolveFailure ---
    writeFile(path.join(root, 'packages/spec/scripts/foo2.mjs'), 'export const x = 2;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'cycle2 change']);
    const headCommit2 = git(root, ['rev-parse', 'HEAD']).trim();
    const changedPaths2 = ['packages/spec/scripts/foo2.mjs'];

    inst.openFailure({
      failure_id: 'F1', paths: changedPaths2, candidate_digest: cf.sha256Tag('candidate-1'),
      evidence_digest: cf.sha256Tag('evidence-1'), occurred_at: new Date().toISOString(),
    });
    inst.classifyFailure({
      failure_id: 'F1', primary_failure_class: 'model_runtime_error',
      adjudication_digest: cf.sha256Tag('adj-1'), occurred_at: new Date().toISOString(),
    });

    // I18: reclassify refused on mismatched previous class / reused digest / while unresolved is fine, resolved-after is not yet reached.
    assert.throws(
      () => inst.reclassifyFailure({
        failure_id: 'F1', previous_primary_failure_class: 'oracle_defect', primary_failure_class: 'framework_regression',
        adjudication_digest: cf.sha256Tag('adj-2'), occurred_at: new Date().toISOString(),
      }),
      (error) => error.code === 'stale_previous_class',
    );
    assert.throws(
      () => inst.reclassifyFailure({
        failure_id: 'F1', previous_primary_failure_class: 'model_runtime_error', primary_failure_class: 'framework_regression',
        adjudication_digest: cf.sha256Tag('adj-1'), occurred_at: new Date().toISOString(),
      }),
      (error) => error.code === 'reused_adjudication_digest',
    );
    inst.reclassifyFailure({
      failure_id: 'F1', previous_primary_failure_class: 'model_runtime_error', primary_failure_class: 'framework_regression',
      adjudication_digest: cf.sha256Tag('adj-2'), occurred_at: new Date().toISOString(),
    });
    assert.equal(inst.deriveFailureState('F1').currentClass, 'framework_regression');
    assert.equal(inst.deriveFailureState('F1').blocking, true);

    // I8: authorized_evolution is refused unconditionally when it intersects this open entry.
    assert.throws(
      () => inst.assertHotspotChangeAllowed({
        changedPaths: changedPaths2,
        proposal: {
          change_intent: 'authorized_evolution', proposal_id: 'p2', spec_ref: evo.specRef,
          spec_semantic_digest: redigest.digest, independent_pass_receipt_digest: freshReceiptDigest,
          planned_write_set: changedPaths2, rollback_condition: 'r', negative_control_family: ['nc'],
        },
      }),
      (error) => error.code === 'open_ledger_intersection',
    );

    const proposal2 = {
      change_intent: 'benchmark_remediation', proposal_id: 'p2', invariant_id: 'INV-1',
      hypothesis: 'foo2 regressed', owner_layer: 'benchmark_controller', primary_failure_class: 'framework_regression',
      paths: changedPaths2, failure_ids: ['F1'], evidence: ['log line'],
      true_positive_family: ['case-a'], negative_control_family: ['case-b'], rollback_condition: 'revert foo2.mjs',
    };
    const freeze2 = inst.createFreezeManifest(proposal2);
    assert.deepEqual(freeze2.remediatedFailureIds, ['F1']);

    const freezeBytes2 = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-artifact-2.tgz'), 'fake-tgz-bytes-2');
    const artifactDigest2 = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/release-artifact-2.tgz'));
    const receiptObj2 = {
      schema_version: '1', receipt_id: 'r2', status: 'published',
      baselineAuthorityDigest: afterPublish1.digest, baselineGeneration: afterPublish1.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes2), candidateDigest: freeze2.candidateDigest,
      treeDigest: freeze2.treeDigest, packageVersion: freeze2.packageVersion,
      releaseCommit: headCommit2, artifactPath: 'packages/spec/.cafekit-release/release-artifact-2.tgz',
      artifactDigest: artifactDigest2, resolvedFailureIds: ['F1'],
    };
    const receiptBytes2 = Buffer.from(`${JSON.stringify(receiptObj2, null, 2)}\n`);

    // I11: crash-after-event-A-before-event-B -- pre-stage the receipt bytes at the
    // canonical path exactly as a prior crashed call would have left them, then
    // prove a fresh advanceBaseline call still resumes correctly through event B.
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-receipt.json'), receiptBytes2);
    assert.equal(inst.loadBaselineAuthority().record.generation, 1, 'authority must still be unrotated at this staged point');
    const publish2 = inst.advanceBaseline(receiptBytes2);
    assert.equal(publish2.status, 'published');
    const afterPublish2 = inst.loadBaselineAuthority();
    assert.equal(afterPublish2.state, 'released');
    assert.equal(afterPublish2.record.generation, 2);
    assert.equal(afterPublish2.record.releaseReceiptDigest, cf.sha256Tag(receiptBytes2));

    // I11: crash-between-event-B-and-event-C -- retry advanceBaseline (idempotent
    // no-op) before ever calling resolveFailure; ledger must still show F1 blocking.
    assert.equal(inst.deriveFailureState('F1').blocking, true);
    const resumeAdvance = inst.advanceBaseline(receiptBytes2);
    assert.equal(resumeAdvance.status, 'already_published');

    // I13/C15: resolveFailure independently re-verifies the persisted receipt and
    // id membership before appending -- never trusting a caller-supplied claim.
    const resolved = inst.resolveFailure({ failure_id: 'F1', decision_digest: cf.sha256Tag('decision-1') });
    assert.equal(resolved.status, 'resolved');
    assert.equal(inst.deriveFailureState('F1').blocking, false);
    assert.equal(inst.deriveFailureState('F1').resolved, true);

    // per-id idempotency: matching replay is a no-op.
    const replaySame = inst.resolveFailure({ failure_id: 'F1', decision_digest: cf.sha256Tag('decision-1') });
    assert.equal(replaySame.status, 'noop');
  });
});

test('REGRESSION (critical): advanceBaseline event (A) physically corrupted-by-seam on a genuinely new first publish fails closed via read-after-write verification -- event (B) never runs and authority never rotates', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/event-a-corrupt-change.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();

    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });
    const authority0 = inst.loadBaselineAuthority();
    assert.equal(authority0.state, 'bootstrap');

    const evo = buildEvolutionSpecFixture(root, { name: 'event-a-corrupt-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/event-a-corrupt-change.cjs'];
    const proposal = {
      change_intent: 'authorized_evolution', proposal_id: 'p1', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'revert the commit',
      negative_control_family: ['a write outside planned_write_set is rejected'],
    };
    const freeze = inst.createFreezeManifest(proposal);
    const freezeBytes = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/event-a-corrupt-artifact.tgz'), 'fake-tgz-bytes');
    const artifactDigest = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/event-a-corrupt-artifact.tgz'));
    const receiptObj = {
      schema_version: '1', receipt_id: 'r-event-a-corrupt', status: 'published',
      baselineAuthorityDigest: authority0.digest, baselineGeneration: authority0.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freeze.candidateDigest,
      treeDigest: freeze.treeDigest, packageVersion: freeze.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/event-a-corrupt-artifact.tgz',
      artifactDigest, resolvedFailureIds: [],
    };
    const receiptBytes = Buffer.from(`${JSON.stringify(receiptObj, null, 2)}\n`);

    const authorityPath = path.join(root, 'packages/spec/benchmarks/release-baseline.json');
    const baselineBytesBefore = fs.readFileSync(authorityPath);

    // Seam the sole physical write call event (A) uses so the bytes that
    // actually land on disk are silently corrupted -- proves advanceBaseline
    // re-reads and re-verifies the canonical file it just wrote on a
    // genuinely new first publish too, not only on the (1b) repair branch.
    const realWriteFileSync = fs.writeFileSync;
    fs.writeFileSync = (fd, data, ...rest) => {
      if (Buffer.isBuffer(data) && data.equals(receiptBytes)) {
        return realWriteFileSync.call(fs, fd, Buffer.from('corrupted-event-a-by-seam'), ...rest);
      }
      return realWriteFileSync.call(fs, fd, data, ...rest);
    };
    try {
      assert.throws(
        () => inst.advanceBaseline(receiptBytes),
        (error) => error.code === 'receipt_unverifiable',
      );
    } finally {
      fs.writeFileSync = realWriteFileSync;
    }

    // Event (B) must never have run: authority stays exactly bootstrap generation 0,
    // byte-identical to its pre-call state, and the call never reports published.
    const authorityAfter = inst.loadBaselineAuthority();
    assert.equal(authorityAfter.state, 'bootstrap');
    assert.equal(authorityAfter.record.generation, 0);
    assert.deepEqual(fs.readFileSync(authorityPath), baselineBytesBefore, 'release-baseline.json bytes must remain exactly as they were before the corrupted first-publish attempt');
  });
});

test('I13: resolveFailure refuses a mismatched-digest replay for an already-resolved id, never coercing it', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    // Hand-constructed authority/receipt pair (nothing committed for this path
    // yet, so C10's one-hop provenance rule trusts it per case (2)): isolates
    // resolveFailure's own mismatched-replay defense (I13) from the full gate
    // chain, which independently prevents this exact scenario from ever
    // arising through the normal pipeline (I12).
    inst.openFailure({
      failure_id: 'F1', paths: ['packages/spec/scripts/a.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    inst.classifyFailure({
      failure_id: 'F1', primary_failure_class: 'framework_regression',
      adjudication_digest: cf.sha256Tag('adj'), occurred_at: new Date().toISOString(),
    });

    const receiptA = {
      schema_version: '1', receipt_id: 'rA', status: 'published',
      baselineAuthorityDigest: cf.sha256Tag('authA'), baselineGeneration: 1,
      freezeDigest: cf.sha256Tag('freezeA'), candidateDigest: cf.sha256Tag('candA'),
      treeDigest: cf.sha256Tag('treeA'), packageVersion: '0.0.1-fixture',
      releaseCommit: '1'.repeat(40), artifactPath: 'packages/spec/.cafekit-release/a.tgz',
      artifactDigest: cf.sha256Tag('artA'), resolvedFailureIds: ['F1'],
    };
    const receiptBytesA = Buffer.from(`${JSON.stringify(receiptA, null, 2)}\n`);
    writeJson(path.join(root, 'packages/spec/benchmarks/release-baseline.json'), {
      state: 'released', generation: 1, baselineCommit: '1'.repeat(40),
      baselinePackageVersion: '0.0.1-fixture', releaseReceiptDigest: cf.sha256Tag(receiptBytesA),
      previousBaselineDigest: cf.sha256Tag('genesis'),
    });
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-receipt.json'), receiptBytesA);
    inst.resolveFailure({ failure_id: 'F1', decision_digest: cf.sha256Tag('decisionA') });
    assert.equal(inst.deriveFailureState('F1').resolved, true);

    // Rotate authority to a different published receipt that also names F1.
    const previousAuthorityBytes = readFileBytes(root, 'packages/spec/benchmarks/release-baseline.json');
    const receiptB = { ...receiptA, receipt_id: 'rB', releaseCommit: '2'.repeat(40) };
    const receiptBytesB = Buffer.from(`${JSON.stringify(receiptB, null, 2)}\n`);
    writeJson(path.join(root, 'packages/spec/benchmarks/release-baseline.json'), {
      state: 'released', generation: 2, baselineCommit: '2'.repeat(40),
      baselinePackageVersion: '0.0.1-fixture', releaseReceiptDigest: cf.sha256Tag(receiptBytesB),
      previousBaselineDigest: cf.sha256Tag(previousAuthorityBytes),
    });
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-receipt.json'), receiptBytesB);

    assert.throws(
      () => inst.resolveFailure({ failure_id: 'F1', decision_digest: cf.sha256Tag('decisionB') }),
      (error) => error.code === 'resolve_conflict',
    );
  });
});

// ---------------------------------------------------------------------------
// C15/R1.9/R1.10: no-bypass on malformed ledger, freeze staleness on ledger events
// ---------------------------------------------------------------------------

test('C15/R1.9: loadFailureLedger/assertFailureLedgerUsable fail closed on a malformed or out-of-band-edited ledger, with no bypass', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    inst.openFailure({
      failure_id: 'F1', paths: ['packages/spec/scripts/a.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'ledger opened F1']);

    // out-of-band edit: content diverges from the committed generation without advancing it.
    const ledgerPath = path.join(root, 'packages/spec/benchmarks/benchmark-failure-ledger.json');
    const tampered = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    tampered.events[0].paths = ['packages/spec/scripts/tampered.mjs'];
    fs.writeFileSync(ledgerPath, `${JSON.stringify(tampered, null, 2)}\n`);
    assert.throws(() => inst.assertFailureLedgerUsable(), (error) => error.code === 'out_of_band_edit');

    // malformed shape (unknown event type) fails closed regardless of provenance.
    const malformed = JSON.parse(readFileBytes(root, 'packages/spec/benchmarks/benchmark-failure-ledger.json').toString('utf8'));
    malformed.events[0].type = 'unknown_event_type';
    fs.writeFileSync(ledgerPath, `${JSON.stringify(malformed, null, 2)}\n`);
    assert.throws(() => inst.loadFailureLedger(), (error) => error.code === 'malformed_ledger');
  });
});

test('C9/R1.10: any accepted C15 ledger event since the last freeze makes that freeze stale', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/x.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const evo = buildEvolutionSpecFixture(root, { name: 'staleness-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/x.cjs'];
    inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    inst.verifyFreezeManifest();

    inst.openFailure({
      failure_id: 'F-stale', paths: ['packages/spec/scripts/unrelated.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    assert.throws(() => inst.verifyFreezeManifest(), (error) => error.code === 'freeze_stale');
  });
});

// ---------------------------------------------------------------------------
// I13: resolveFailure's independent self-verification, isolated unit coverage
// ---------------------------------------------------------------------------

test('I13: resolveFailure refuses an id absent from the persisted receipt, a digest mismatch, and a not-released authority', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/y.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });

    // not-released authority (still bootstrap state)
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });
    assert.throws(
      () => inst.resolveFailure({ failure_id: 'F1', decision_digest: cf.sha256Tag('d') }),
      (error) => error.code === 'not_released',
    );

    const evo = buildEvolutionSpecFixture(root, { name: 'resolve-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/y.cjs'];
    const freeze = inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    const authorityBefore = inst.loadBaselineAuthority();
    const freezeBytes = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz'), 'bytes');
    const artifactDigest = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/artifact.tgz'));
    const receiptObj = {
      schema_version: '1', receipt_id: 'r', status: 'published',
      baselineAuthorityDigest: authorityBefore.digest, baselineGeneration: authorityBefore.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freeze.candidateDigest, treeDigest: freeze.treeDigest,
      packageVersion: freeze.packageVersion, releaseCommit: headCommit,
      artifactPath: 'packages/spec/.cafekit-release/artifact.tgz', artifactDigest, resolvedFailureIds: [],
    };
    const receiptBytes = Buffer.from(`${JSON.stringify(receiptObj, null, 2)}\n`);
    inst.advanceBaseline(receiptBytes);

    // id absent from resolvedFailureIds ([]).
    assert.throws(
      () => inst.resolveFailure({ failure_id: 'GHOST', decision_digest: cf.sha256Tag('d') }),
      (error) => error.code === 'not_in_receipt',
    );

    // canonical receipt corrupted (unreadable bytes): no usable evidence to verify against.
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-receipt.json'), 'not-json-at-all');
    assert.throws(
      () => inst.resolveFailure({ failure_id: 'GHOST', decision_digest: cf.sha256Tag('d') }),
      (error) => error.code === 'receipt_missing',
    );
  });
});

// ---------------------------------------------------------------------------
// Independent-review regressions (four blockers)
// ---------------------------------------------------------------------------

test('REGRESSION (critical): verifyFreezeManifest fails closed when a protected path is added or removed after freeze creation', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/frozen-change.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const evo = buildEvolutionSpecFixture(root, { name: 'freeze-gap-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/frozen-change.cjs'];
    inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    inst.verifyFreezeManifest(); // sanity: valid immediately after creation

    // A protected path is ADDED after the freeze was created -- the recorded
    // changedPaths list alone (re-hashed by treeDigest) would never notice this;
    // only a fresh re-derivation against the current working tree catches it.
    writeFile(path.join(root, 'packages/spec/scripts/added-after-freeze.mjs'), 'export const x = 1;\n');
    assert.throws(() => inst.verifyFreezeManifest(), (error) => error.code === 'freeze_stale');
    fs.rmSync(path.join(root, 'packages/spec/scripts/added-after-freeze.mjs'));
    inst.verifyFreezeManifest(); // back to valid once the extra path is gone

    // The frozen change is REMOVED after the freeze was created (working tree
    // reverts to matching baselineCommit for that path) -- derived paths
    // become empty, no longer matching the frozen non-empty set.
    fs.rmSync(path.join(root, 'packages/spec/src/claude/scripts/frozen-change.cjs'));
    assert.throws(() => inst.verifyFreezeManifest(), (error) => error.code === 'freeze_stale');
  });
});

test('REGRESSION (high): advanceBaseline rejects a path-traversal, absolute, or symlinked artifactPath -- never a naive string-prefix check', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/artifact-path-change.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const evo = buildEvolutionSpecFixture(root, { name: 'artifact-path-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/artifact-path-change.cjs'];
    const freeze = inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    const freezeBytes = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    const authority = inst.loadBaselineAuthority();

    function buildReceipt(artifactPath, artifactDigest) {
      return {
        schema_version: '1', receipt_id: 'r', status: 'published',
        baselineAuthorityDigest: authority.digest, baselineGeneration: authority.record.generation,
        freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freeze.candidateDigest,
        treeDigest: freeze.treeDigest, packageVersion: freeze.packageVersion,
        releaseCommit: headCommit, artifactPath, artifactDigest, resolvedFailureIds: [],
      };
    }
    function receiptBytesFor(artifactPath, artifactDigest) {
      return Buffer.from(`${JSON.stringify(buildReceipt(artifactPath, artifactDigest), null, 2)}\n`);
    }

    // Lexical `..` traversal: the raw string still starts with the reserved
    // prefix as TEXT, but resolves outside the project root once `..`
    // segments are followed -- a naive .startsWith() check would accept this.
    assert.throws(
      () => inst.advanceBaseline(receiptBytesFor('packages/spec/.cafekit-release/../../../../../../../etc/passwd', cf.sha256Tag('whatever'))),
      (error) => error.code === 'artifact_path_escape',
    );

    // Absolute path.
    assert.throws(
      () => inst.advanceBaseline(receiptBytesFor('/etc/passwd', cf.sha256Tag('whatever'))),
      (error) => error.code === 'artifact_path_escape',
    );

    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-artifact-outside-'));
    try {
      const realOutsideFile = path.join(outsideDir, 'real.tgz');
      fs.writeFileSync(realOutsideFile, 'real-bytes');
      const realDigest = cf.sha256Tag(fs.readFileSync(realOutsideFile));

      // Symlink at the final path component itself.
      fs.symlinkSync(realOutsideFile, path.join(root, 'packages/spec/.cafekit-release/linked-artifact.tgz'));
      assert.throws(
        () => inst.advanceBaseline(receiptBytesFor('packages/spec/.cafekit-release/linked-artifact.tgz', realDigest)),
        (error) => error.code === 'artifact_invalid',
      );

      // Symlinked ANCESTOR directory (the final component is a real file at
      // the resolved target, so lstat on it alone would not catch this).
      fs.symlinkSync(outsideDir, path.join(root, 'packages/spec/.cafekit-release/linked-dir'), 'dir');
      assert.throws(
        () => inst.advanceBaseline(receiptBytesFor('packages/spec/.cafekit-release/linked-dir/real.tgz', realDigest)),
        (error) => error.code === 'artifact_invalid',
      );
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});

test('REGRESSION (medium): createFreezeManifest/verifyFreezeManifest fail closed when baselineCommit is not an ancestor of current HEAD', () => {
  withTempRepo((root) => {
    initRepo(root);
    const mainBranch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    git(root, ['checkout', '-qb', 'divergent-branch']);
    writeFile(path.join(root, 'divergent.txt'), 'x');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'divergent commit']);
    const divergentCommit = git(root, ['rev-parse', 'HEAD']).trim();
    git(root, ['checkout', '-q', mainBranch]);

    writeJson(path.join(root, 'packages/spec/benchmarks/release-baseline.json'), {
      state: 'bootstrap', generation: 0, baselineCommit: divergentCommit,
      baselinePackageVersion: '0.0.1-fixture', bootstrapReviewDigest: cf.sha256Tag('seed'),
      previousBaselineDigest: null,
    });
    const inst = cf.createChangeFirewall({ root });
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'baseline_not_ancestor');

    // Hand-place a freeze that is otherwise internally consistent (matching
    // authority digest/generation), to prove verifyFreezeManifest
    // independently re-checks ancestry too, never trusting whatever a
    // (hypothetical) prior create call had accepted.
    const authority = inst.loadBaselineAuthority();
    const treeDigest = inst.computeProtectedTreeDigest([]);
    const candidateFields = {
      baselineAuthorityDigest: authority.digest, baselineGeneration: 0, baselineCommit: divergentCommit,
      failureLedgerDigest: cf.NO_FAILURES_ATTESTATION_DIGEST, failureLedgerGeneration: null,
      remediatedFailureIds: [], changedPaths: [], treeDigest,
      proposalDigest: cf.NO_CHANGE_ATTESTATION_DIGEST, packageVersion: '0.0.1-fixture',
    };
    writeJson(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json'), {
      ...candidateFields, changeKind: 'no_protected_change', candidateDigest: cf.computeCandidateDigest(candidateFields),
    });
    assert.throws(() => inst.verifyFreezeManifest(), (error) => error.code === 'baseline_not_ancestor');
  });
});

test('REGRESSION (medium): authorized_evolution refuses a spec_ref reached through a symlinked ancestor directory', () => {
  withTempRepo((root) => {
    initRepo(root);
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-specref-outside-'));
    try {
      fs.mkdirSync(path.join(outsideDir, 'actual-spec'), { recursive: true });
      fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
      fs.symlinkSync(outsideDir, path.join(root, 'specs', 'linked-parent'), 'dir');

      const inst = cf.createChangeFirewall({ root });
      const proposalFor = (specRef) => ({
        change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: specRef,
        spec_semantic_digest: cf.sha256Tag('a'), independent_pass_receipt_digest: cf.sha256Tag('b'),
        planned_write_set: ['packages/spec/scripts/x.mjs'], rollback_condition: 'r', negative_control_family: ['nc'],
      });

      // Symlinked ancestor directory: the final resolved target is a real
      // directory, so a lexical-only or lstat-only check would accept it.
      assert.throws(
        () => inst.assertHotspotChangeAllowed({
          changedPaths: ['packages/spec/scripts/x.mjs'],
          proposal: proposalFor('specs/linked-parent/actual-spec'),
        }),
        (error) => error.code === 'path_escape',
      );

      // Direct symlink at spec_ref itself (the simpler case) is also refused.
      fs.symlinkSync(outsideDir, path.join(root, 'specs', 'direct-link'), 'dir');
      assert.throws(
        () => inst.assertHotspotChangeAllowed({
          changedPaths: ['packages/spec/scripts/x.mjs'],
          proposal: proposalFor('specs/direct-link'),
        }),
        (error) => error.code === 'path_escape',
      );
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Round 2 fresh-review regressions (1 critical, reproduced end-to-end): a
// hand-edited freeze/receipt that stays internally self-consistent (its own
// candidateDigest recomputed over its own, now-forged fields) must never be
// trusted -- verifyFreezeManifest and advanceBaseline must re-derive every
// bound field against live ground truth (authority, C15 ledger, package.json,
// artifact containment), not just check the freeze's own internal consistency.
// ---------------------------------------------------------------------------

test('REGRESSION round2 (critical): verifyFreezeManifest/advanceBaseline reject a hand-edited freeze that narrows remediatedFailureIds via a self-recomputed candidateDigest; F1 stays blocking and authority never rotates', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/scripts/round2-remediation-forged.mjs'), 'export const x = 1;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });
    const authorityBefore = inst.loadBaselineAuthority();

    const changedPaths = ['packages/spec/scripts/round2-remediation-forged.mjs'];
    inst.openFailure({
      failure_id: 'F1', paths: changedPaths, candidate_digest: cf.sha256Tag('cand'),
      evidence_digest: cf.sha256Tag('evi'), occurred_at: new Date().toISOString(),
    });
    inst.classifyFailure({
      failure_id: 'F1', primary_failure_class: 'framework_regression',
      adjudication_digest: cf.sha256Tag('adj'), occurred_at: new Date().toISOString(),
    });
    assert.equal(inst.deriveFailureState('F1').blocking, true);

    const freeze = inst.createFreezeManifest({
      change_intent: 'benchmark_remediation', proposal_id: 'p', invariant_id: 'INV-1',
      hypothesis: 'h', owner_layer: 'benchmark_controller', primary_failure_class: 'framework_regression',
      paths: changedPaths, failure_ids: ['F1'], evidence: ['e'],
      true_positive_family: ['tp'], negative_control_family: ['nc'], rollback_condition: 'revert',
    });
    assert.deepEqual(freeze.remediatedFailureIds, ['F1']);
    inst.verifyFreezeManifest(); // sanity: valid immediately after creation

    // Hand-edit the freeze: drop F1 from remediatedFailureIds, then recompute
    // candidateDigest over the tampered fields -- exactly the self-consistency
    // trick the round-1 exploit relied on to pass the old candidateDigest-only check.
    const freezePath = path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    const tampered = JSON.parse(fs.readFileSync(freezePath, 'utf8'));
    tampered.remediatedFailureIds = [];
    tampered.candidateDigest = cf.computeCandidateDigest({
      baselineAuthorityDigest: tampered.baselineAuthorityDigest, baselineGeneration: tampered.baselineGeneration,
      baselineCommit: tampered.baselineCommit, failureLedgerDigest: tampered.failureLedgerDigest,
      failureLedgerGeneration: tampered.failureLedgerGeneration, remediatedFailureIds: tampered.remediatedFailureIds,
      changedPaths: tampered.changedPaths, treeDigest: tampered.treeDigest,
      proposalDigest: tampered.proposalDigest, packageVersion: tampered.packageVersion,
    });
    fs.writeFileSync(freezePath, `${JSON.stringify(tampered, null, 2)}\n`);

    assert.throws(() => inst.verifyFreezeManifest(), (error) => error.code === 'freeze_stale');

    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-artifact-round2.tgz'), 'bytes');
    const artifactDigest = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/release-artifact-round2.tgz'));
    const receiptBytes = Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r-round2', status: 'published',
      baselineAuthorityDigest: authorityBefore.digest, baselineGeneration: authorityBefore.record.generation,
      freezeDigest: cf.sha256Tag(fs.readFileSync(freezePath)), candidateDigest: tampered.candidateDigest,
      treeDigest: tampered.treeDigest, packageVersion: tampered.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/release-artifact-round2.tgz',
      artifactDigest, resolvedFailureIds: [],
    }, null, 2)}\n`);
    assert.throws(() => inst.advanceBaseline(receiptBytes), (error) => error.code === 'freeze_stale');

    assert.equal(inst.loadBaselineAuthority().state, 'bootstrap', 'authority must never rotate off a rejected tampered freeze');
    assert.equal(inst.deriveFailureState('F1').blocking, true, 'F1 must still be blocking');
  });
});

test('REGRESSION round2 (critical): verifyFreezeManifest rejects a freeze whose changedPaths smuggles an extra protected path not covered by its own remediatedFailureIds opened.paths union', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/scripts/round2-uncovered-f1.mjs'), 'export const x = 1;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const pathF1 = 'packages/spec/scripts/round2-uncovered-f1.mjs';
    inst.openFailure({
      failure_id: 'F1', paths: [pathF1], candidate_digest: cf.sha256Tag('cand'),
      evidence_digest: cf.sha256Tag('evi'), occurred_at: new Date().toISOString(),
    });
    inst.classifyFailure({
      failure_id: 'F1', primary_failure_class: 'framework_regression',
      adjudication_digest: cf.sha256Tag('adj'), occurred_at: new Date().toISOString(),
    });

    const freeze = inst.createFreezeManifest({
      change_intent: 'benchmark_remediation', proposal_id: 'p', invariant_id: 'INV-1',
      hypothesis: 'h', owner_layer: 'benchmark_controller', primary_failure_class: 'framework_regression',
      paths: [pathF1], failure_ids: ['F1'], evidence: ['e'],
      true_positive_family: ['tp'], negative_control_family: ['nc'], rollback_condition: 'revert',
    });
    assert.deepEqual(freeze.remediatedFailureIds, ['F1']);
    assert.deepEqual(freeze.changedPaths, [pathF1]);
    inst.verifyFreezeManifest(); // sanity: valid immediately after creation

    // A second, unrelated protected-path change lands in the real working tree
    // -- never proposed, never covered by F1's own opened.paths.
    const pathExtra = 'packages/spec/scripts/round2-uncovered-extra.mjs';
    writeFile(path.join(root, pathExtra), 'export const y = 2;\n');

    // Hand-edit the freeze to fold this extra real path into changedPaths
    // (matching the now-real diff) while leaving remediatedFailureIds
    // unchanged at ['F1'] -- then recompute treeDigest/candidateDigest so the
    // freeze stays internally self-consistent and re-derivation-against-reality
    // alone (changedPaths vs the real diff, treeDigest vs real content) cannot
    // distinguish it from a legitimate freeze.
    const freezePath = path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    const tampered = JSON.parse(fs.readFileSync(freezePath, 'utf8'));
    tampered.changedPaths = cf.sortedUnique([pathF1, pathExtra]);
    tampered.treeDigest = inst.computeProtectedTreeDigest(tampered.changedPaths);
    tampered.candidateDigest = cf.computeCandidateDigest({
      baselineAuthorityDigest: tampered.baselineAuthorityDigest, baselineGeneration: tampered.baselineGeneration,
      baselineCommit: tampered.baselineCommit, failureLedgerDigest: tampered.failureLedgerDigest,
      failureLedgerGeneration: tampered.failureLedgerGeneration, remediatedFailureIds: tampered.remediatedFailureIds,
      changedPaths: tampered.changedPaths, treeDigest: tampered.treeDigest,
      proposalDigest: tampered.proposalDigest, packageVersion: tampered.packageVersion,
    });
    fs.writeFileSync(freezePath, `${JSON.stringify(tampered, null, 2)}\n`);

    // The plain re-derivation-against-reality checks alone would NOT catch this
    // (freeze.changedPaths now matches the real current diff exactly) -- only
    // the path-union invariant (pathsUnion === changedPaths) does.
    assert.deepEqual(inst.deriveProtectedChangedPaths(baseCommit), tampered.changedPaths);
    assert.throws(() => inst.verifyFreezeManifest(), (error) => error.code === 'freeze_stale');
  });
});

test('REGRESSION round2 (critical): verifyFreezeManifest rejects a forged baselineCommit even when candidateDigest is recomputed to stay self-consistent', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round2-forged-commit.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const evo = buildEvolutionSpecFixture(root, { name: 'round2-forged-commit-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/round2-forged-commit.cjs'];
    inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    inst.verifyFreezeManifest(); // sanity: valid immediately after creation

    const freezePath = path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    const tampered = JSON.parse(fs.readFileSync(freezePath, 'utf8'));
    // A syntactically valid but forged commit id -- the fix must reject on the
    // authority-vs-freeze mismatch itself, regardless of whether it is a real commit.
    tampered.baselineCommit = '9'.repeat(40);
    tampered.candidateDigest = cf.computeCandidateDigest({
      baselineAuthorityDigest: tampered.baselineAuthorityDigest, baselineGeneration: tampered.baselineGeneration,
      baselineCommit: tampered.baselineCommit, failureLedgerDigest: tampered.failureLedgerDigest,
      failureLedgerGeneration: tampered.failureLedgerGeneration, remediatedFailureIds: tampered.remediatedFailureIds,
      changedPaths: tampered.changedPaths, treeDigest: tampered.treeDigest,
      proposalDigest: tampered.proposalDigest, packageVersion: tampered.packageVersion,
    });
    fs.writeFileSync(freezePath, `${JSON.stringify(tampered, null, 2)}\n`);

    assert.throws(() => inst.verifyFreezeManifest(), (error) => error.code === 'freeze_stale');
  });
});

test('REGRESSION round2 (critical): advanceBaseline independently re-verifies the current freeze before trusting it -- a freeze staled only by an intervening real C15 ledger event is rejected, never just candidateDigest-matched through', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round2-stale-advance.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });
    const authority = inst.loadBaselineAuthority();

    const evo = buildEvolutionSpecFixture(root, { name: 'round2-stale-advance-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/round2-stale-advance.cjs'];
    const freeze = inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    const freezeBytes = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');

    // Stale the freeze via a legitimate, untampered ledger event, then attempt
    // a direct advanceBaseline call against the now-stale-but-byte-identical freeze.
    inst.openFailure({
      failure_id: 'F-stale-advance', paths: ['packages/spec/scripts/round2-unrelated.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });

    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/release-artifact-round2-stale.tgz'), 'bytes');
    const artifactDigest = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/release-artifact-round2-stale.tgz'));
    const receiptBytes = Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r-round2-stale', status: 'published',
      baselineAuthorityDigest: authority.digest, baselineGeneration: authority.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freeze.candidateDigest,
      treeDigest: freeze.treeDigest, packageVersion: freeze.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/release-artifact-round2-stale.tgz',
      artifactDigest, resolvedFailureIds: [],
    }, null, 2)}\n`);
    assert.throws(() => inst.advanceBaseline(receiptBytes), (error) => error.code === 'freeze_stale');
    assert.equal(inst.loadBaselineAuthority().state, 'bootstrap', 'authority must never rotate against a stale freeze');
  });
});

test('REGRESSION round2 (high): advanceBaseline rejects an artifactPath redirected via a symlinked ancestor to another directory still inside the project root', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round2-internal-symlink.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const evo = buildEvolutionSpecFixture(root, { name: 'round2-internal-symlink-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/round2-internal-symlink.cjs'];
    const freeze = inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    const freezeBytes = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    const authority = inst.loadBaselineAuthority();

    // A real directory elsewhere inside the project root (NOT under
    // .cafekit-release/), with a symlink placed *inside* .cafekit-release/
    // pointing at it. The final resolved target is a real file still inside
    // the project root, so a project-root-only containment check (round 1)
    // would wrongly accept this; containment must be checked against the real
    // .cafekit-release/ directory itself.
    const internalDir = path.join(root, 'packages/spec/round2-internal-dir');
    fs.mkdirSync(internalDir, { recursive: true });
    fs.writeFileSync(path.join(internalDir, 'real.tgz'), 'real-bytes');
    const realDigest = cf.sha256Tag(fs.readFileSync(path.join(internalDir, 'real.tgz')));
    fs.symlinkSync(internalDir, path.join(root, 'packages/spec/.cafekit-release/linked-internal-dir'), 'dir');

    const receiptBytes = Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r-round2-internal', status: 'published',
      baselineAuthorityDigest: authority.digest, baselineGeneration: authority.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freeze.candidateDigest,
      treeDigest: freeze.treeDigest, packageVersion: freeze.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/linked-internal-dir/real.tgz',
      artifactDigest: realDigest, resolvedFailureIds: [],
    }, null, 2)}\n`);
    assert.throws(() => inst.advanceBaseline(receiptBytes), (error) => error.code === 'artifact_invalid');
    assert.equal(inst.loadBaselineAuthority().state, 'bootstrap', 'authority must never rotate on a rejected artifact path');
  });
});

test('REGRESSION round2 (critical): advanceBaseline rejects an artifactPath when packages/spec/.cafekit-release/ itself is a symlink, even to a directory still inside the project root', () => {
  withTempRepo((root) => {
    // Replace the real .cafekit-release/ (created by initRepo) with a symlink
    // to another real directory still inside the project root, before doing
    // anything else. A relative-containment-only check would never catch
    // this: both the artifact candidate and the release directory itself
    // resolve through the identical redirection, so they always appear
    // "contained" relative to each other no matter where it points.
    const baseCommit = initRepo(root);
    fs.rmSync(path.join(root, 'packages/spec/.cafekit-release'), { recursive: true, force: true });
    const actualReleaseDir = path.join(root, 'packages/spec/actual-cafekit-release');
    fs.mkdirSync(actualReleaseDir, { recursive: true });
    fs.symlinkSync(actualReleaseDir, path.join(root, 'packages/spec/.cafekit-release'), 'dir');

    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round2-release-dir-symlink.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const evo = buildEvolutionSpecFixture(root, { name: 'round2-release-dir-symlink-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/round2-release-dir-symlink.cjs'];
    const freeze = inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    // Writes through the symlinked .cafekit-release/ land transparently in
    // actualReleaseDir; freeze creation/read logic never inspects it for a
    // symlinked ancestor, so this proceeds exactly like a normal checkout.
    const freezeBytes = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    const authority = inst.loadBaselineAuthority();
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz'), 'bytes');
    const artifactDigest = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/artifact.tgz'));

    const receiptBytes = Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r-round2-releasedir-symlink', status: 'published',
      baselineAuthorityDigest: authority.digest, baselineGeneration: authority.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freeze.candidateDigest,
      treeDigest: freeze.treeDigest, packageVersion: freeze.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/artifact.tgz',
      artifactDigest, resolvedFailureIds: [],
    }, null, 2)}\n`);
    assert.throws(() => inst.advanceBaseline(receiptBytes), (error) => error.code === 'artifact_invalid');
    assert.equal(inst.loadBaselineAuthority().state, 'bootstrap', 'authority must never rotate when .cafekit-release/ itself is a symlink');
  });
});

test('REGRESSION round2 (critical): advanceBaseline rejects an artifactPath redirected by a symlink planted inside .cafekit-release/ to another real subdir still inside the release tree', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round2-internal-release-symlink.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const evo = buildEvolutionSpecFixture(root, { name: 'round2-internal-release-symlink-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/round2-internal-release-symlink.cjs'];
    const freeze = inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    const freezeBytes = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    const authority = inst.loadBaselineAuthority();

    // A real subdirectory *of the real .cafekit-release/ itself*, plus a
    // symlink also planted inside .cafekit-release/ that redirects to it --
    // the resolved target never leaves the real release tree at all, so a
    // containment-relative-to-release-dir check alone would wrongly accept it.
    const realSubdir = path.join(root, 'packages/spec/.cafekit-release/real-target-subdir');
    fs.mkdirSync(realSubdir, { recursive: true });
    fs.writeFileSync(path.join(realSubdir, 'real.tgz'), 'real-bytes');
    const realDigest = cf.sha256Tag(fs.readFileSync(path.join(realSubdir, 'real.tgz')));
    fs.symlinkSync(realSubdir, path.join(root, 'packages/spec/.cafekit-release/redirect-subdir'), 'dir');

    const receiptBytes = Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r-round2-internal-release', status: 'published',
      baselineAuthorityDigest: authority.digest, baselineGeneration: authority.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freeze.candidateDigest,
      treeDigest: freeze.treeDigest, packageVersion: freeze.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/redirect-subdir/real.tgz',
      artifactDigest: realDigest, resolvedFailureIds: [],
    }, null, 2)}\n`);
    assert.throws(() => inst.advanceBaseline(receiptBytes), (error) => error.code === 'artifact_invalid');
    assert.equal(inst.loadBaselineAuthority().state, 'bootstrap', 'authority must never rotate on an internal release-dir symlink redirect');
  });
});

// ---------------------------------------------------------------------------
// Shared committed-history provenance invariant (round4): every committed
// snapshot pair is validated -- not merely the last-commit-vs-current hop --
// for both C10 authority and C15 ledger, with an explicit fail-closed guard
// against an undetectable or shallow git history.
// ---------------------------------------------------------------------------

test('REGRESSION round4 (critical): a committed released C10 record hand-edited in place (same generation) fails closed even after an unrelated later commit', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round4-released-tamper.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const evo = buildEvolutionSpecFixture(root, { name: 'round4-released-spec' });
    const changedPaths = ['packages/spec/src/claude/scripts/round4-released-tamper.cjs'];
    const freeze = inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: evo.specRef,
      spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    const authority = inst.loadBaselineAuthority();
    const freezeBytes = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/round4-artifact.tgz'), 'artifact-bytes');
    const artifactDigest = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/round4-artifact.tgz'));
    const receiptBytes = Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r-round4', status: 'published',
      baselineAuthorityDigest: authority.digest, baselineGeneration: authority.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freeze.candidateDigest,
      treeDigest: freeze.treeDigest, packageVersion: freeze.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/round4-artifact.tgz',
      artifactDigest, resolvedFailureIds: [],
    }, null, 2)}\n`);
    inst.advanceBaseline(receiptBytes);
    assert.equal(inst.loadBaselineAuthority().state, 'released');

    // Commit the genuine released record (a real, legitimate commit).
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'released record committed']);

    // Same-generation in-place tamper, itself committed as an ordinary commit.
    const authorityPath = path.join(root, 'packages/spec/benchmarks/release-baseline.json');
    const genuine = JSON.parse(fs.readFileSync(authorityPath, 'utf8'));
    const tampered = { ...genuine, baselinePackageVersion: `${genuine.baselinePackageVersion}-tampered` };
    fs.writeFileSync(authorityPath, `${JSON.stringify(tampered, null, 2)}\n`);
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'same-generation released tamper']);

    // An unrelated later commit, touching a different file entirely.
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round4-unrelated.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'unrelated later commit']);

    // Before this fix, provenance compared only the last commit against
    // current -- and this unrelated commit doesn't even touch
    // release-baseline.json, so "the last committed version of this file" is
    // still the tampered one, byte-identical to current, and was trusted
    // forever. The shared committed-history walk now finds the
    // genuine->tampered pair among release-baseline.json's own committed
    // snapshots and rejects it regardless of what committed afterward.
    assert.throws(() => inst.assertBaselineUsable(), (error) => error.code === 'out_of_band_edit');
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'out_of_band_edit');
  });
});

test('REGRESSION round4 (critical): a committed C15 ledger record hand-edited in place (same generation) fails closed even after an unrelated later commit', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    inst.openFailure({
      failure_id: 'F-round4', paths: ['packages/spec/scripts/round4-ledger.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'ledger opened F-round4']);

    // Same-generation in-place event tamper, itself committed.
    const ledgerPath = path.join(root, 'packages/spec/benchmarks/benchmark-failure-ledger.json');
    const tampered = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    tampered.events[0].paths = ['packages/spec/scripts/round4-ledger-tampered.mjs'];
    fs.writeFileSync(ledgerPath, `${JSON.stringify(tampered, null, 2)}\n`);
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'same-generation ledger tamper']);

    // An unrelated later commit, touching a different file entirely.
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round4-ledger-unrelated.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'unrelated later commit']);

    assert.throws(() => inst.assertFailureLedgerUsable(), (error) => error.code === 'out_of_band_edit');
    assert.throws(
      () => inst.classifyFailure({
        failure_id: 'F-round4', primary_failure_class: 'model_runtime_error',
        adjudication_digest: cf.sha256Tag('adj'), occurred_at: new Date().toISOString(),
      }),
      (error) => error.code === 'out_of_band_edit',
    );
  });
});

// ---------------------------------------------------------------------------
// Review5 (round5): the canonical contract (design.md C10, "an out-of-band
// edit": generation must equal priorGeneration + 1) admits no generation-jump
// exemption once a committed predecessor exists -- not even for several named
// transitions squashed uncommitted into one later commit. The prior "C15
// squash compatibility" positive test above asserted exactly the behavior
// this contract forbids and is replaced by the contract-accurate regressions
// below.
// ---------------------------------------------------------------------------

test('REGRESSION round5 (critical): a C10 committed generation jump with a schema-valid record and fabricated previousDigest rejects', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeJson(path.join(root, 'packages/spec/benchmarks/release-baseline.json'), {
      state: 'bootstrap', generation: 0, baselineCommit: baseCommit,
      baselinePackageVersion: '0.0.1-fixture', bootstrapReviewDigest: cf.sha256Tag('seed'),
      previousBaselineDigest: null,
    });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'genesis bootstrap committed']);

    // A schema-valid released record at generation 2 -- skipping generation 1
    // entirely -- with a well-formed but fabricated previousBaselineDigest.
    // Shape validation alone would accept this; only the exact
    // generation-must-advance-by-one rule catches it.
    writeJson(path.join(root, 'packages/spec/benchmarks/release-baseline.json'), {
      state: 'released', generation: 2, baselineCommit: baseCommit,
      baselinePackageVersion: '0.0.1-fixture', releaseReceiptDigest: cf.sha256Tag('receipt'),
      previousBaselineDigest: cf.sha256Tag('fabricated-predecessor'),
    });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'fabricated generation-2 released record']);

    const inst = cf.createChangeFirewall({ root });
    assert.throws(() => inst.assertBaselineUsable(), (error) => error.code === 'out_of_band_edit');
  });
});

test('REGRESSION round5 (high): a C15 committed generation jump with a fully shape-valid event count and fabricated previousDigest rejects', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    inst.openFailure({
      failure_id: 'F-round5', paths: ['packages/spec/scripts/round5-ledger.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'genesis ledger committed']);

    // A schema-valid ledger record at generation 2 -- events.length matches
    // generation + 1 exactly and every event independently validates -- but
    // it skips generation 1 entirely and previousLedgerDigest is fabricated.
    // Shape validation alone would accept this; only the exact generation
    // rule catches it.
    const ledgerPath = path.join(root, 'packages/spec/benchmarks/benchmark-failure-ledger.json');
    const genuine = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    writeJson(ledgerPath, {
      schema_version: '1', generation: 2, previousLedgerDigest: cf.sha256Tag('fabricated-predecessor'),
      events: [
        genuine.events[0],
        {
          type: 'classified', failure_id: 'F-round5', primary_failure_class: 'model_runtime_error',
          adjudication_digest: cf.sha256Tag('adj-1'), occurred_at: new Date().toISOString(),
        },
        {
          type: 'reclassified', failure_id: 'F-round5', previous_primary_failure_class: 'model_runtime_error',
          primary_failure_class: 'framework_regression', adjudication_digest: cf.sha256Tag('adj-2'), occurred_at: new Date().toISOString(),
        },
      ],
    });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'fabricated generation-2 ledger record']);

    assert.throws(() => inst.assertFailureLedgerUsable(), (error) => error.code === 'out_of_band_edit');
  });
});

test('REGRESSION round5 (critical): a second uncommitted C15 named transition relative to the same committed predecessor is rejected before write, leaving file bytes unchanged', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    inst.openFailure({
      failure_id: 'F-round5b', paths: ['packages/spec/scripts/round5b-ledger.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'genesis ledger committed']); // generation 0, committed predecessor

    // First uncommitted transition: exactly one step beyond the committed
    // predecessor -- accepted.
    inst.classifyFailure({
      failure_id: 'F-round5b', primary_failure_class: 'model_runtime_error',
      adjudication_digest: cf.sha256Tag('adj-1'), occurred_at: new Date().toISOString(),
    });
    const ledgerPath = path.join(root, 'packages/spec/benchmarks/benchmark-failure-ledger.json');
    const afterFirstTransition = fs.readFileSync(ledgerPath);

    // Second uncommitted transition, still relative to the same committed
    // (generation 0) predecessor -- would jump the committed chain by two.
    // Rejected before ever touching the file: bytes stay exactly as the
    // first transition left them, not a corrupted generation-2 state that
    // only the next load would have caught.
    assert.throws(
      () => inst.reclassifyFailure({
        failure_id: 'F-round5b', previous_primary_failure_class: 'model_runtime_error', primary_failure_class: 'framework_regression',
        adjudication_digest: cf.sha256Tag('adj-2'), occurred_at: new Date().toISOString(),
      }),
      (error) => error.code === 'out_of_band_edit',
    );
    assert.deepEqual(fs.readFileSync(ledgerPath), afterFirstTransition, 'file bytes must remain exactly as the first valid transition left them');
  });
});

test('a normal exact-plus-one uncommitted C15 named transition after a committed predecessor remains accepted', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    inst.openFailure({
      failure_id: 'F-round5c', paths: ['packages/spec/scripts/round5c-ledger.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'genesis ledger committed']);

    const record = inst.classifyFailure({
      failure_id: 'F-round5c', primary_failure_class: 'model_runtime_error',
      adjudication_digest: cf.sha256Tag('adj-1'), occurred_at: new Date().toISOString(),
    });
    assert.equal(record.generation, 1);
    assert.equal(inst.assertFailureLedgerUsable().record.generation, 1);
  });
});

test('multiple uncommitted C15 named transitions remain accepted when there is no committed predecessor at all', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    inst.openFailure({
      failure_id: 'F-round5e', paths: ['packages/spec/scripts/round5e-ledger.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    inst.classifyFailure({
      failure_id: 'F-round5e', primary_failure_class: 'model_runtime_error',
      adjudication_digest: cf.sha256Tag('adj-1'), occurred_at: new Date().toISOString(),
    });
    const record = inst.reclassifyFailure({
      failure_id: 'F-round5e', previous_primary_failure_class: 'model_runtime_error', primary_failure_class: 'framework_regression',
      adjudication_digest: cf.sha256Tag('adj-2'), occurred_at: new Date().toISOString(),
    });
    // None of this has ever been committed -- case (2) of C10's own load
    // rules trusts it as first-ever state, however many uncommitted
    // transitions produced it.
    assert.equal(record.generation, 2);
    assert.equal(inst.assertFailureLedgerUsable().record.generation, 2);
  });
});

test('REGRESSION round4 (critical): a shallow/ambiguous committed history fails closed instead of trusting the fetched HEAD as genesis', () => {
  withTempRepo((srcRoot) => {
    const baseCommit = initRepo(srcRoot);
    writeLegacyBridge(srcRoot, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(srcRoot);
    writeFile(path.join(srcRoot, 'packages/spec/src/claude/scripts/round4-shallow.cjs'), 'module.exports = {};\n');
    git(srcRoot, ['add', '-A']);
    git(srcRoot, ['commit', '-qm', 'boot window change']);
    const headCommit = git(srcRoot, ['rev-parse', 'HEAD']).trim();
    const srcInst = cf.createChangeFirewall({ root: srcRoot });
    srcInst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });
    git(srcRoot, ['add', '-A']);
    git(srcRoot, ['commit', '-qm', 'bootstrap record committed']);

    const shallowParent = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-shallow-'));
    try {
      git(shallowParent, ['clone', '--no-local', '--depth', '1', srcRoot, 'clone']);
      const shallowRoot = path.join(shallowParent, 'clone');
      assert.equal(
        git(shallowRoot, ['rev-parse', '--is-shallow-repository']).trim(), 'true',
        'fixture sanity: the clone must actually be shallow',
      );
      const shallowInst = cf.createChangeFirewall({ root: shallowRoot });

      // The shallow clone's HEAD carries a perfectly well-formed bootstrap
      // record -- the truncated fetched history simply cannot prove it is the
      // *true* genesis. Before this fix, a git-log/show ambiguity over an
      // incomplete history was silently treated as "nothing committed,
      // trusted"; now it must fail closed rather than accept the fetched HEAD
      // as a false, unprovable trust root.
      assert.throws(() => shallowInst.assertBaselineUsable(), (error) => error.code === 'out_of_band_edit');
    } finally {
      fs.rmSync(shallowParent, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Review6 (round6): readCommittedSnapshots must fail closed whenever
// committed history exists for a reserved path but HEAD currently has no
// blob for it (a committed deletion no named transition ever performs), not
// silently treat "currently absent" as "never committed"; and
// gitChangedPathsRaw must never allowlist git change statuses by an
// enumerated diff-filter that can silently stop covering a real status (T
// type-change, U unmerged) it never anticipated.
// ---------------------------------------------------------------------------

test('REGRESSION round6 (critical): a committed C10 authority git-rm-committed then recreated uncommitted is rejected, not trusted as a fresh first record', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round6-c10-delete.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const authorityPath = path.join(root, 'packages/spec/benchmarks/release-baseline.json');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'genuine bootstrap record committed']);

    // git-rm the committed authority and commit the deletion -- no named
    // transition ever deletes this file, so committed history now shows a
    // real deletion, not "this path never existed."
    git(root, ['rm', '-q', 'packages/spec/benchmarks/release-baseline.json']);
    git(root, ['commit', '-qm', 'authority deleted']);
    assert.equal(fs.existsSync(authorityPath), false);

    // Recreate a brand-new-looking bootstrap record directly, uncommitted --
    // before this fix, gitHeadFileBytes returning null for the (now-deleted)
    // path short-circuited readCommittedSnapshots straight to "never
    // committed, trusted" without ever consulting git log.
    writeJson(authorityPath, {
      state: 'bootstrap', generation: 0, baselineCommit: baseCommit,
      baselinePackageVersion: '0.0.1-fixture', bootstrapReviewDigest: reviewReceiptDigest,
      previousBaselineDigest: null,
    });
    assert.throws(() => inst.assertBaselineUsable(), (error) => error.code === 'out_of_band_edit');
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'out_of_band_edit');

    // Even bootstrapBaseline's own writer-side candidate check refuses to
    // launder a fresh record into the deleted path's place.
    fs.rmSync(authorityPath);
    const headCommit2 = git(root, ['rev-parse', 'HEAD']).trim();
    assert.throws(
      () => inst.bootstrapBaseline({ baseCommit, headCommit: headCommit2, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' }),
      (error) => error.code === 'out_of_band_edit',
    );
  });
});

test('REGRESSION round6 (critical): a committed C15 ledger git-rm-committed then recreated uncommitted is rejected, not trusted as a fresh first record', () => {
  withTempRepo((root) => {
    initRepo(root);
    const inst = cf.createChangeFirewall({ root });
    inst.openFailure({
      failure_id: 'F-round6', paths: ['packages/spec/scripts/round6-ledger.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });
    const ledgerPath = path.join(root, 'packages/spec/benchmarks/benchmark-failure-ledger.json');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'genuine ledger record committed']);

    git(root, ['rm', '-q', 'packages/spec/benchmarks/benchmark-failure-ledger.json']);
    git(root, ['commit', '-qm', 'ledger deleted']);
    assert.equal(fs.existsSync(ledgerPath), false);

    // Recreate a brand-new-looking generation-0 ledger directly, uncommitted.
    writeJson(ledgerPath, {
      schema_version: '1', generation: 0, previousLedgerDigest: null,
      events: [{
        type: 'opened', failure_id: 'F-round6-fresh', paths: ['packages/spec/scripts/round6-ledger-fresh.mjs'],
        candidate_digest: cf.sha256Tag('c2'), evidence_digest: cf.sha256Tag('e2'), occurred_at: new Date().toISOString(),
      }],
    });
    assert.throws(() => inst.assertFailureLedgerUsable(), (error) => error.code === 'out_of_band_edit');

    // Even openFailure's own writer-side candidate check refuses to launder a
    // fresh record into the deleted path's place.
    fs.rmSync(ledgerPath);
    assert.throws(
      () => inst.openFailure({
        failure_id: 'F-round6-second', paths: ['packages/spec/scripts/round6-ledger-second.mjs'], candidate_digest: cf.sha256Tag('c3'),
        evidence_digest: cf.sha256Tag('e3'), occurred_at: new Date().toISOString(),
      }),
      (error) => error.code === 'out_of_band_edit',
    );
  });
});

test('REGRESSION round6 (high): a protected regular file swapped to a symlink (type-change) enters D1 derivation and is gated without reading outside the root', () => {
  withTempRepo((root) => {
    initRepo(root);
    const protectedRelPath = 'packages/spec/scripts/round6-typechange.mjs';
    writeFile(path.join(root, protectedRelPath), 'export const x = 1;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'protected file committed before the boot window']);
    const baseCommit = git(root, ['rev-parse', 'HEAD']).trim();
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);

    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round6-typechange-boot.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();

    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    // Type-change: the already-committed protected regular file (present
    // since baseCommit, unrelated to the boot-window diff) is swapped for a
    // symlink pointing at a target outside the project root that never even
    // needs to exist -- the digest/derivation must never dereference it.
    const protectedAbsPath = path.join(root, protectedRelPath);
    fs.unlinkSync(protectedAbsPath);
    fs.symlinkSync('/nonexistent-outside-target-round6', protectedAbsPath);

    // Prior to the diff-filter fix, --diff-filter=ACDMR silently dropped this
    // T (type-changed) status path from derivation entirely.
    const changedPaths = inst.deriveProtectedChangedPaths(baseCommit);
    assert.ok(changedPaths.includes(protectedRelPath), 'a type-changed protected path must enter D1 derivation, not be silently dropped');

    // The gate correctly demands a proposal for this now-visible protected
    // change; computing that gate/tree digest must not read the (nonexistent)
    // external symlink target.
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'proposal_required');
    const treeDigest = inst.computeProtectedTreeDigest(changedPaths);
    assert.match(treeDigest, /^sha256:[0-9a-f]{64}$/);
  });
});

test('REGRESSION round6 (critical): a second uncommitted C10 advanceBaseline call relative to the same committed predecessor is rejected before mutation, leaving bytes unchanged', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round6-c10-second-advance.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    // Commit the genuine bootstrap record: this is the committed predecessor.
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'bootstrap record committed']);

    // First advanceBaseline call: released generation 1, exactly one step
    // beyond the committed bootstrap predecessor -- accepted, left uncommitted.
    const evo1 = buildEvolutionSpecFixture(root, { name: 'round6-second-advance-spec-1' });
    const changedPaths = ['packages/spec/src/claude/scripts/round6-c10-second-advance.cjs'];
    const freeze1 = inst.createFreezeManifest({
      change_intent: 'authorized_evolution', proposal_id: 'p1', spec_ref: evo1.specRef,
      spec_semantic_digest: evo1.digest, independent_pass_receipt_digest: evo1.reviewReceiptDigest,
      planned_write_set: changedPaths, rollback_condition: 'r', negative_control_family: ['nc'],
    });
    const authority0 = inst.loadBaselineAuthority();
    const freezeBytes1 = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/round6-artifact-1.tgz'), 'artifact-bytes-1');
    const artifactDigest1 = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/round6-artifact-1.tgz'));
    const receiptBytes1 = Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r-round6-1', status: 'published',
      baselineAuthorityDigest: authority0.digest, baselineGeneration: authority0.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes1), candidateDigest: freeze1.candidateDigest,
      treeDigest: freeze1.treeDigest, packageVersion: freeze1.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/round6-artifact-1.tgz',
      artifactDigest: artifactDigest1, resolvedFailureIds: [],
    }, null, 2)}\n`);
    inst.advanceBaseline(receiptBytes1);
    const authorityPath = path.join(root, 'packages/spec/benchmarks/release-baseline.json');
    const receiptPath = path.join(root, 'packages/spec/.cafekit-release/release-receipt.json');
    const afterFirstAdvance = fs.readFileSync(authorityPath);
    const receiptAfterFirstAdvance = fs.readFileSync(receiptPath);
    assert.equal(inst.loadBaselineAuthority().record.generation, 1);

    // Second advanceBaseline call, against a freshly-built no_protected_change
    // freeze/receipt for the current (still-uncommitted) generation-1
    // authority -- would jump the *committed* chain (still only generation 0)
    // by two. Rejected before ever touching either release-baseline.json or
    // release-receipt.json's bytes: prepare-then-validate-all builds and
    // verifies Event (B)'s candidate against committed provenance *before*
    // Event (A) (the receipt) is ever written, so a rejection here leaves
    // both files exactly as the first, successful advance left them -- not
    // a corrupted receipt paired with an untouched authority record.
    const freeze2 = inst.createFreezeManifest(null);
    const authority1 = inst.loadBaselineAuthority();
    const freezeBytes2 = readFileBytes(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json');
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/round6-artifact-2.tgz'), 'artifact-bytes-2');
    const artifactDigest2 = cf.sha256Tag(readFileBytes(root, 'packages/spec/.cafekit-release/round6-artifact-2.tgz'));
    const receiptBytes2 = Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r-round6-2', status: 'published',
      baselineAuthorityDigest: authority1.digest, baselineGeneration: authority1.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes2), candidateDigest: freeze2.candidateDigest,
      treeDigest: freeze2.treeDigest, packageVersion: freeze2.packageVersion,
      releaseCommit: headCommit, artifactPath: 'packages/spec/.cafekit-release/round6-artifact-2.tgz',
      artifactDigest: artifactDigest2, resolvedFailureIds: [],
    }, null, 2)}\n`);
    assert.throws(() => inst.advanceBaseline(receiptBytes2), (error) => error.code === 'out_of_band_edit');
    assert.deepEqual(fs.readFileSync(authorityPath), afterFirstAdvance, 'release-baseline.json bytes must remain exactly as the first advance left them');
    assert.deepEqual(fs.readFileSync(receiptPath), receiptAfterFirstAdvance, 'release-receipt.json bytes must remain exactly as the first advance left them -- Event (A) must never run before Event (B)\'s candidate is validated');
  });
});

// ---------------------------------------------------------------------------
// Review7 (round7): advanceBaseline's prepare/validate-all-before-first-write
// invariant (proven above); a genuine git status U (unmerged) protected path
// must enter D1 derivation and be gated exactly like any other change; a
// reserved control-plane path renamed away and back (or recreated at the same
// path) must never be trusted as first-ever provenance.
// ---------------------------------------------------------------------------

test('REGRESSION round7 (high): a genuinely unmerged (git status U) protected path still enters D1 derivation and is gated without reading outside the root', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    const protectedRelPath = 'packages/spec/scripts/round7-unmerged.mjs';
    writeFile(path.join(root, protectedRelPath), 'export const x = 0;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const mainBranch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();

    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'bootstrap record committed']);

    git(root, ['checkout', '-qb', 'round7-branch-a']);
    writeFile(path.join(root, protectedRelPath), 'export const x = 1;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'branch a change']);

    git(root, ['checkout', '-q', mainBranch]);
    writeFile(path.join(root, protectedRelPath), 'export const x = 2;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'branch b change']);

    // A genuine merge attempt -- both branches touched the same line of the
    // same protected file, so this must conflict, leaving real unmerged
    // (multi-stage index) entries and conflict markers on disk, not a
    // simulated/hand-crafted stand-in.
    const mergeResult = spawnSync('git', ['-C', root, 'merge', '--no-commit', '--no-ff', 'round7-branch-a'], { encoding: 'utf8' });
    assert.notEqual(mergeResult.status, 0, 'fixture sanity: the merge must actually conflict');
    assert.match(git(root, ['status', '--porcelain']), /^UU /m, 'fixture sanity: the protected path must show as a genuine unmerged (UU) status');

    const changedPaths = inst.deriveProtectedChangedPaths(baseCommit);
    assert.ok(changedPaths.includes(protectedRelPath), 'an unmerged protected path must enter D1 derivation, not be silently dropped');

    // Computing the gate/tree digest over this unmerged path must not crash
    // or read anything outside the trusted root -- readWorktreeEntry reads
    // the on-disk (conflict-marked) file bytes directly, the same as any
    // other regular file, never dereferencing anything external.
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'proposal_required');
    const treeDigest = inst.computeProtectedTreeDigest(changedPaths);
    assert.match(treeDigest, /^sha256:[0-9a-f]{64}$/);
  });
});

test('REGRESSION round7 (critical): a committed C10 authority renamed away then renamed back to the reserved path is never trusted as first-ever provenance', () => {
  withTempRepo((root) => {
    const baseCommit = initRepo(root);
    writeLegacyBridge(root, { baseCommit });
    const reviewReceiptDigest = writeFeatureSeedPass(root);
    writeFile(path.join(root, 'packages/spec/src/claude/scripts/round7-rename.cjs'), 'module.exports = {};\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'boot window change']);
    const headCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const inst = cf.createChangeFirewall({ root });
    inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

    const authorityPath = path.join(root, 'packages/spec/benchmarks/release-baseline.json');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'genuine bootstrap record committed']);

    // Rename the reserved path away, committed -- git log -- <reserved path>
    // still shows this commit as a real touch (removal) of that exact path,
    // exactly like a plain deletion.
    git(root, ['mv', 'packages/spec/benchmarks/release-baseline.json', 'packages/spec/benchmarks/round7-renamed-away.json']);
    git(root, ['commit', '-qm', 'authority renamed away']);
    assert.equal(fs.existsSync(authorityPath), false);

    // Rename it back to the exact reserved path, committed -- the bytes are
    // byte-identical to the original (a pure rename, no content change), yet
    // the path's own committed history still shows a real absence in
    // between: no named transition ever deletes or renames this file, so
    // this must never be laundered back in as a trusted, unbroken chain.
    git(root, ['mv', 'packages/spec/benchmarks/round7-renamed-away.json', 'packages/spec/benchmarks/release-baseline.json']);
    git(root, ['commit', '-qm', 'authority renamed back']);
    assert.equal(fs.existsSync(authorityPath), true);

    assert.throws(() => inst.assertBaselineUsable(), (error) => error.code === 'out_of_band_edit');
    assert.throws(() => inst.createFreezeManifest(null), (error) => error.code === 'out_of_band_edit');
  });
});
