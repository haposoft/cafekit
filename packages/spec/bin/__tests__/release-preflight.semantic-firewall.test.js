'use strict';

// R0-01 owned semantic-firewall test for the D1 production CLI callers
// wired around change-firewall.cjs: release-preflight.mjs (verify-only) and
// benchmark-workflow.mjs's `freeze` verb (create-only). Every scenario below
// runs against an isolated temp checkout this file constructs by copying the
// real, unmodified source scripts into a fresh git repo -- change-firewall.cjs
// resolves its production root via git from its own file location, so a
// faithful copy under the same relative layout is what actually lets these
// CLIs run against a fixture instead of this repo's own real authority state.
// The real checkout is only ever read (package.json version/scripts), never mutated.

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
// generic fixture helpers (self-contained; mirrors change-firewall.semantic-firewall.test.js)
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-release-preflight-'));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// The exact dependency closure release-preflight.mjs/benchmark-workflow.mjs
// need at runtime, copied verbatim (never reimplemented) under the same
// relative layout so change-firewall.cjs's own __dirname-based git-root
// resolution naturally targets this isolated checkout instead of the real one.
const RUNTIME_FILES = [
  'src/claude/scripts/change-firewall.cjs',
  'src/claude/scripts/spec-authoring-digest.cjs',
  'src/claude/scripts/validate-spec-output.cjs',
  'src/claude/scripts/workflow-policy.cjs',
  'src/claude/scripts/spec-semantic-model.cjs',
  'src/claude/scripts/spec-ground.cjs',
  'scripts/release-preflight.mjs',
  'scripts/benchmark-workflow.mjs',
];

function initIsolatedCheckout(root, { version = '0.0.1-fixture' } = {}) {
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'CafeKit Test']);
  for (const relative of RUNTIME_FILES) {
    const target = path.join(root, 'packages/spec', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, relative), target);
  }
  writeJson(path.join(root, 'packages/spec/package.json'), { name: 'fixture-package', version });
  fs.mkdirSync(path.join(root, 'packages/spec/benchmarks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/spec/.cafekit-release'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/spec/bin/__tests__'), { recursive: true });
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'init']);
  return git(root, ['rev-parse', 'HEAD']).trim();
}

function runReleasePreflight(root) {
  return spawnSync(process.execPath, [path.join(root, 'packages/spec/scripts/release-preflight.mjs')], {
    cwd: root, encoding: 'utf8',
  });
}

function runFreezeCli(root, args = []) {
  return spawnSync(process.execPath, [path.join(root, 'packages/spec/scripts/benchmark-workflow.mjs'), 'freeze', ...args], {
    cwd: root, encoding: 'utf8',
  });
}

// Builds a durable Compact/Full authorized_evolution spec_ref fixture: a real
// requirements.md/design.md pair computeSemanticDigest21 accepts with zero
// errors, authoring both validated with a fresh C16 receipt, and a seed
// semantic_review_history PASS entry matching the real digest.
function buildEvolutionSpecFixture(root, name) {
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
  const policy = POLICY.workflowPolicySnapshot({ riskSignals: {}, planningDepth: 'Compact' });
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
  const reviewReceiptDigest = cf.sha256Tag(`${name}-independent-pass-1`);
  const fullSpec = {
    ...baseSpec,
    validation: {
      status: 'not-run',
      authoring_validation: {
        schema_version: '1',
        requirements: receiptEntry(DIGEST.digestFileBytes(requirementsPath)),
        design: receiptEntry(DIGEST.digestFileBytes(designPath)),
        research: receiptEntry(DIGEST.RESEARCH_ABSENT_DIGEST),
        tasks: receiptEntry(DIGEST.TASKS_ABSENT_DIGEST),
      },
      semantic_review_history: {
        lineage_id: cf.sha256Tag(`${name}-lineage`),
        entries: [{ sequence: 0, review_epoch: 0, verdict: 'PASS', semantic_digest: digest, review_receipt_digest: reviewReceiptDigest }],
      },
    },
  };
  writeJson(path.join(specDir, 'spec.json'), fullSpec);
  return { specRef: path.posix.join('specs', name), digest, reviewReceiptDigest };
}

// Legitimate C10/C14 bootstrap + one authorized_evolution release cycle, built
// entirely through the production change-firewall.cjs API (bound to this
// isolated root) -- reaches a real `released` generation 1 authority with no
// hand-crafted digests. Returns the bound instance and key commits/digests.
function publishOneReleasedGeneration(root) {
  writeJson(path.join(root, 'specs/archive/cafekit-semantic-eval-firewall/reports/bootstrap-legacy-bridge-review.json'), {
    schema_version: '1', verdict: 'PASS', blocking_count: 0, reviewed_criteria: ['R1.1'],
    semantic_digest: cf.sha256Tag('bridge'), bootWindowBaseCommit: git(root, ['rev-parse', 'HEAD']).trim(),
    written_at: new Date().toISOString(),
  });
  const baseCommit = git(root, ['rev-parse', 'HEAD']).trim();
  const reviewReceiptDigest = cf.sha256Tag('seed-review-receipt');
  writeJson(path.join(root, 'specs/archive/cafekit-semantic-eval-firewall/spec.json'), {
    validation: {
      semantic_review_history: {
        entries: [{ sequence: 0, review_epoch: 0, verdict: 'PASS', review_receipt_digest: reviewReceiptDigest, semantic_digest: cf.sha256Tag('feature-digest') }],
      },
    },
  });
  writeFile(path.join(root, 'packages/spec/src/claude/scripts/boot-window-change.cjs'), 'module.exports = {};\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'boot window change']);
  const headCommit = git(root, ['rev-parse', 'HEAD']).trim();

  const inst = cf.createChangeFirewall({ root });
  inst.bootstrapBaseline({ baseCommit, headCommit, bootstrapReviewDigest: reviewReceiptDigest, packageVersion: '0.0.1-fixture' });

  const changedPaths = ['packages/spec/src/claude/scripts/boot-window-change.cjs'];
  const evo = buildEvolutionSpecFixture(root, 'cycle1-spec');
  inst.createFreezeManifest({
    change_intent: 'authorized_evolution', proposal_id: 'p1', spec_ref: evo.specRef,
    spec_semantic_digest: evo.digest, independent_pass_receipt_digest: evo.reviewReceiptDigest,
    planned_write_set: changedPaths, rollback_condition: 'revert the commit',
    negative_control_family: ['a write outside planned_write_set is rejected'],
  });
  const freeze = inst.verifyFreezeManifest();
  return { inst, headCommit, changedPaths, freeze };
}

// ---------------------------------------------------------------------------
// release-preflight always requires a freeze (R1.4/R1.6)
// ---------------------------------------------------------------------------

test('release-preflight: exits 2 when no freeze exists at all (fresh boot-window checkout)', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    const result = runReleasePreflight(root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /release preflight failed/);
  });
});

// ---------------------------------------------------------------------------
// boot-window refusal: no_protected_change is only ever valid once released
// ---------------------------------------------------------------------------

test('release-preflight: refuses a no_protected_change freeze while authority is still in bootstrap state', () => {
  withTempRepo((root) => {
    const commit = initIsolatedCheckout(root);
    // Baseline equal to current HEAD (empty derived diff) -- this exact shape
    // can never be produced by the real createFreezeManifest during bootstrap
    // (it refuses empty paths outright), so it is constructed directly here
    // to prove the *reader* side (verifyFreezeManifest, via release-preflight)
    // independently refuses it too, never trusting a stale/impossible freeze.
    writeJson(path.join(root, 'packages/spec/benchmarks/release-baseline.json'), {
      state: 'bootstrap', generation: 0, baselineCommit: commit,
      baselinePackageVersion: '0.0.1-fixture', bootstrapReviewDigest: cf.sha256Tag('seed'),
      previousBaselineDigest: null,
    });
    const inst = cf.createChangeFirewall({ root });
    const authority = inst.loadBaselineAuthority();
    const treeDigest = inst.computeProtectedTreeDigest([]);
    const candidateFields = {
      baselineAuthorityDigest: authority.digest, baselineGeneration: 0, baselineCommit: commit,
      failureLedgerDigest: cf.NO_FAILURES_ATTESTATION_DIGEST, failureLedgerGeneration: null,
      remediatedFailureIds: [], changedPaths: [], treeDigest,
      proposalDigest: cf.NO_CHANGE_ATTESTATION_DIGEST, packageVersion: '0.0.1-fixture',
    };
    writeJson(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json'), {
      ...candidateFields, changeKind: 'no_protected_change', candidateDigest: cf.computeCandidateDigest(candidateFields),
    });
    const result = runReleasePreflight(root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /release preflight failed/);
  });
});

// ---------------------------------------------------------------------------
// released + no_protected_change succeeds (the normal clean-pack path)
// ---------------------------------------------------------------------------

test('release-preflight: released state with a clean no_protected_change freeze succeeds (exit 0)', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    const { inst } = publishOneReleasedGeneration(root);
    const freezeBytes = fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json'));
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz'), 'fake-bytes');
    const freezeJson = JSON.parse(freezeBytes.toString('utf8'));
    const artifactDigest = cf.sha256Tag(fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz')));
    const authorityBefore = inst.loadBaselineAuthority();
    const receiptObj = {
      schema_version: '1', receipt_id: 'r1', status: 'published',
      baselineAuthorityDigest: authorityBefore.digest, baselineGeneration: authorityBefore.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freezeJson.candidateDigest,
      treeDigest: freezeJson.treeDigest, packageVersion: freezeJson.packageVersion,
      releaseCommit: git(root, ['rev-parse', 'HEAD']).trim(),
      artifactPath: 'packages/spec/.cafekit-release/artifact.tgz', artifactDigest, resolvedFailureIds: [],
    };
    inst.advanceBaseline(Buffer.from(`${JSON.stringify(receiptObj, null, 2)}\n`));
    // released state, nothing further changed -> clean no_protected_change freeze.
    inst.createFreezeManifest(null);

    const result = runReleasePreflight(root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 'preflight_ok');
    assert.equal(parsed.changeKind, 'no_protected_change');
    assert.equal(parsed.packageVersion, '0.0.1-fixture');
  });
});

// R1.3 (design.md Errors and Recovery: "Caller base override | exit 2 | no
// accept"): a CLI/environment attempt to override the baseline this tool
// loads must be *rejected* with exit 2 -- not silently ignored -- and must
// never mutate the authority, receipt, or freeze files on its way to that
// rejection. release-preflight.mjs itself has no legitimate CLI argument at
// all (any argv is rejected before any filesystem access); the environment
// deny-boundary lives in change-firewall.cjs's shared assertBaselineUsable
// entry point (reached via verifyFreezeManifest) so it applies uniformly to
// every caller, not just this one CLI.
function setUpPublishedFixture(root) {
  const { inst } = publishOneReleasedGeneration(root);
  const freezeBytes = fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json'));
  fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz'), 'fake-bytes');
  const freezeJson = JSON.parse(freezeBytes.toString('utf8'));
  const artifactDigest = cf.sha256Tag(fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz')));
  const authorityBefore = inst.loadBaselineAuthority();
  const receiptObj = {
    schema_version: '1', receipt_id: 'r1', status: 'published',
    baselineAuthorityDigest: authorityBefore.digest, baselineGeneration: authorityBefore.record.generation,
    freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freezeJson.candidateDigest,
    treeDigest: freezeJson.treeDigest, packageVersion: freezeJson.packageVersion,
    releaseCommit: git(root, ['rev-parse', 'HEAD']).trim(),
    artifactPath: 'packages/spec/.cafekit-release/artifact.tgz', artifactDigest, resolvedFailureIds: [],
  };
  inst.advanceBaseline(Buffer.from(`${JSON.stringify(receiptObj, null, 2)}\n`));
  inst.createFreezeManifest(null);
  return { inst };
}

function snapshotPublishedFixtureBytes(root) {
  return {
    authority: fs.readFileSync(path.join(root, 'packages/spec/benchmarks/release-baseline.json')),
    receipt: fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/release-receipt.json')),
    freeze: fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json')),
  };
}

test('R1.3: release-preflight.mjs rejects any extra CLI argument with exit 2 and mutates nothing', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    setUpPublishedFixture(root);
    const before = snapshotPublishedFixtureBytes(root);

    const result = spawnSync(process.execPath, [
      path.join(root, 'packages/spec/scripts/release-preflight.mjs'),
      '--baseline-commit', '0'.repeat(40),
    ], { cwd: root, encoding: 'utf8' });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /release preflight failed/);
    assert.match(result.stderr, /accepts no CLI arguments/);
    assert.deepEqual(snapshotPublishedFixtureBytes(root), before, 'a rejected CLI-argument attempt must mutate nothing');
  });
});

test('R1.3: presence of any of the six reserved CAFEKIT_ baseline-override env keys is rejected with exit 2 and mutates nothing', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    setUpPublishedFixture(root);
    const before = snapshotPublishedFixtureBytes(root);

    // The exact closed six-key reserved set (change-firewall.cjs R1.3) -- no
    // other env name is ever a channel. Presence alone (any value) rejects.
    for (const name of [
      'CAFEKIT_BASE_COMMIT', 'CAFEKIT_BASELINE_COMMIT',
      'CAFEKIT_BASE_REF', 'CAFEKIT_BASELINE_REF',
      'CAFEKIT_BASE_PATH', 'CAFEKIT_BASELINE_PATH',
    ]) {
      const result = spawnSync(process.execPath, [path.join(root, 'packages/spec/scripts/release-preflight.mjs')], {
        cwd: root,
        encoding: 'utf8',
        // Test-created env only -- never the real process environment.
        env: { PATH: process.env.PATH, [name]: '0'.repeat(40) },
      });

      assert.equal(result.status, 2, `${name} must reject with exit 2`);
      assert.match(result.stderr, /release preflight failed/);
      assert.match(result.stderr, /reserved baseline override channel/);
      assert.match(result.stderr, new RegExp(name));
      assert.deepEqual(snapshotPublishedFixtureBytes(root), before, `${name} rejection must mutate nothing`);
    }
  });
});

test('R1.3 control: no other environment variable name, however base/baseline-shaped or ambient, ever triggers the base-override deny-boundary', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    setUpPublishedFixture(root);

    const result = spawnSync(process.execPath, [path.join(root, 'packages/spec/scripts/release-preflight.mjs')], {
      cwd: root,
      encoding: 'utf8',
      // DATABASE_URL: token DATABASE, not BASE -- must never false-positive.
      // RELEASE_NOTES_PATH: has a RELEASE-family token but no BASE/BASELINE
      // token at all -- must never false-positive either. RELEASE_BASE_URL
      // and AUTHORITY_BASE_URL end in BASE_URL, not BASE/BASELINE followed by
      // COMMIT/REF/PATH. GITHUB_BASE_REF/GITHUB_BASE_SHA are ambient vars
      // GitHub Actions sets on every pull_request run -- GITHUB is a
      // third-party namespace this tool never owns. OVERRIDE_BASE_COMMIT,
      // FORCE_BASELINE_REF, and BASECOMMIT are all base/baseline-shaped names
      // that are NOT in the closed six-key reserved set -- an env key this
      // runtime never reads cannot influence authority, so none of these
      // may ever be treated as a channel this boundary owns (see
      // change-firewall.cjs R1.3).
      env: {
        PATH: process.env.PATH,
        DATABASE_URL: 'postgres://example',
        RELEASE_NOTES_PATH: '/tmp/notes.md',
        RELEASE_BASE_URL: 'https://example.invalid/release',
        AUTHORITY_BASE_URL: 'https://example.invalid/authority',
        GITHUB_BASE_REF: 'main',
        GITHUB_BASE_SHA: '0'.repeat(40),
        OVERRIDE_BASE_COMMIT: '0'.repeat(40),
        FORCE_BASELINE_REF: 'main',
        BASECOMMIT: '0'.repeat(40),
      },
    });

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 'preflight_ok');
    assert.equal(parsed.changeKind, 'no_protected_change');
  });
});

// ---------------------------------------------------------------------------
// stale freeze after a baseline advance, and after a ledger event (R1.4/R1.10)
// ---------------------------------------------------------------------------

test('release-preflight: exits 2 for a freeze left stale by a baseline advance since it was created', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    const { inst } = publishOneReleasedGeneration(root);
    const staleFreezeBytes = fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json'));
    const staleFreezeJson = JSON.parse(staleFreezeBytes.toString('utf8'));
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz'), 'fake-bytes');
    const artifactDigest = cf.sha256Tag(fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz')));
    const authorityBefore = inst.loadBaselineAuthority();
    const receiptObj = {
      schema_version: '1', receipt_id: 'r1', status: 'published',
      baselineAuthorityDigest: authorityBefore.digest, baselineGeneration: authorityBefore.record.generation,
      freezeDigest: cf.sha256Tag(staleFreezeBytes), candidateDigest: staleFreezeJson.candidateDigest,
      treeDigest: staleFreezeJson.treeDigest, packageVersion: staleFreezeJson.packageVersion,
      releaseCommit: git(root, ['rev-parse', 'HEAD']).trim(),
      artifactPath: 'packages/spec/.cafekit-release/artifact.tgz', artifactDigest, resolvedFailureIds: [],
    };
    // advanceBaseline rotates authority to generation 1 and invalidates the freeze;
    // restore the pre-advance (now stale) freeze bytes to simulate one left on disk.
    inst.advanceBaseline(Buffer.from(`${JSON.stringify(receiptObj, null, 2)}\n`));
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json'), staleFreezeBytes);

    const result = runReleasePreflight(root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /release preflight failed/);
  });
});

test('release-preflight: exits 2 for a freeze left stale by a C15 ledger event since it was created', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    const { inst } = publishOneReleasedGeneration(root);
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz'), 'fake-bytes');
    const artifactDigest = cf.sha256Tag(fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/artifact.tgz')));
    const freezeBytes = fs.readFileSync(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json'));
    const freezeJson = JSON.parse(freezeBytes.toString('utf8'));
    const authorityBefore = inst.loadBaselineAuthority();
    inst.advanceBaseline(Buffer.from(`${JSON.stringify({
      schema_version: '1', receipt_id: 'r1', status: 'published',
      baselineAuthorityDigest: authorityBefore.digest, baselineGeneration: authorityBefore.record.generation,
      freezeDigest: cf.sha256Tag(freezeBytes), candidateDigest: freezeJson.candidateDigest,
      treeDigest: freezeJson.treeDigest, packageVersion: freezeJson.packageVersion,
      releaseCommit: git(root, ['rev-parse', 'HEAD']).trim(),
      artifactPath: 'packages/spec/.cafekit-release/artifact.tgz', artifactDigest, resolvedFailureIds: [],
    }, null, 2)}\n`));
    // fresh clean freeze against the now-released authority
    inst.createFreezeManifest(null);
    // a ledger event lands after the freeze was created -> stales it (R1.10)
    inst.openFailure({
      failure_id: 'F-stale', paths: ['packages/spec/scripts/unrelated.mjs'], candidate_digest: cf.sha256Tag('c'),
      evidence_digest: cf.sha256Tag('e'), occurred_at: new Date().toISOString(),
    });

    const result = runReleasePreflight(root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /release preflight failed/);
  });
});

// ---------------------------------------------------------------------------
// benchmark-workflow.mjs freeze CLI: proposal variant failures
// ---------------------------------------------------------------------------

test('benchmark-workflow freeze CLI: refuses a protected change with no --proposal supplied at all', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    publishOneReleasedGeneration(root);
    writeFile(path.join(root, 'packages/spec/scripts/needs-proposal.mjs'), 'export const x = 1;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'unauthorized-looking change']);

    const result = runFreezeCli(root, []);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /benchmark validation failed/);
  });
});

test('benchmark-workflow freeze CLI: refuses a benchmark_remediation proposal for a non-framework_regression class', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    publishOneReleasedGeneration(root);
    writeFile(path.join(root, 'packages/spec/scripts/regressed.mjs'), 'export const x = 1;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'regressed change']);
    const proposalFile = path.join(root, 'proposal.json');
    writeJson(proposalFile, {
      change_intent: 'benchmark_remediation', proposal_id: 'p', invariant_id: 'inv', hypothesis: 'h',
      owner_layer: 'benchmark_controller', primary_failure_class: 'oracle_defect',
      paths: ['packages/spec/scripts/regressed.mjs'], failure_ids: ['F1'], evidence: ['e'],
      true_positive_family: ['tp'], negative_control_family: ['nc'], rollback_condition: 'revert',
    });
    const result = runFreezeCli(root, ['--proposal', proposalFile]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /non_framework_regression|benchmark validation failed/);
  });
});

test('benchmark-workflow freeze CLI: refuses an authorized_evolution proposal missing required fields', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    publishOneReleasedGeneration(root);
    writeFile(path.join(root, 'packages/spec/scripts/evolved.mjs'), 'export const x = 1;\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'evolved change']);
    const proposalFile = path.join(root, 'proposal.json');
    writeJson(proposalFile, {
      // missing spec_semantic_digest / independent_pass_receipt_digest / negative_control_family
      change_intent: 'authorized_evolution', proposal_id: 'p', spec_ref: 'specs/does-not-exist',
      planned_write_set: ['packages/spec/scripts/evolved.mjs'], rollback_condition: 'r',
    });
    const result = runFreezeCli(root, ['--proposal', proposalFile]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /malformed_proposal|benchmark validation failed/);
  });
});

// ---------------------------------------------------------------------------
// sentinel: any injected defect surfaces as a nonzero exit, never a false success
// ---------------------------------------------------------------------------

test('sentinel: a corrupted freeze file surfaces as release-preflight exit 2, never a false success', () => {
  withTempRepo((root) => {
    initIsolatedCheckout(root);
    publishOneReleasedGeneration(root);
    fs.writeFileSync(path.join(root, 'packages/spec/.cafekit-release/change-firewall-freeze.json'), '{ not valid json');
    const result = runReleasePreflight(root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /release preflight failed/);
  });
});

// ---------------------------------------------------------------------------
// package.json wiring: version preserved, reserved paths excluded (real checkout, read-only)
// ---------------------------------------------------------------------------

test('package.json: version stays valid SemVer and the npm lifecycle stays unwired while the boot-window is open', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  // R1.6 requires the version field preserved, not pinned to one release literal
  // this task happened to land against -- a hard-coded release string would
  // need re-patching on every version bump without proving anything R1.6 asks
  // for. The durable, release-agnostic invariant is: the field is present and
  // is a valid SemVer string (optional prerelease/build metadata included).
  assert.equal(typeof pkg.version, 'string');
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
  // R0-01 wired prepack/prepublishOnly to release-preflight.mjs while stating
  // it "does not invoke bootstrapBaseline, create a real freeze, or publish
  // (D11/I9 boot-window)". R1-03 bootstrap-activation, which closes that
  // window, never ran and this feature is paused -- so the wiring made every
  // publish exit 2 on a freeze that nothing was allowed to create. The gate
  // stays runnable on its own (`release:freeze`, and the script invoked
  // directly by the tests above); it just no longer sits on npm's lifecycle.
  // Rewire both when R1-03 lands.
  assert.equal(pkg.scripts.prepack, undefined);
  assert.equal(pkg.scripts.prepublishOnly, undefined);
  assert.equal(pkg.scripts['release:freeze'], 'node scripts/benchmark-workflow.mjs freeze');
  // pre-existing scripts untouched
  assert.equal(pkg.scripts.test, 'node scripts/run-skill-self-tests.mjs');
  assert.equal(pkg.scripts['test:package'], 'node --test bin/__tests__/package-inventory.test.js');
});

test('D1: reserved control-plane paths never appear inside derived protected changes', () => {
  assert.equal(cf.isProtectedPath('packages/spec/benchmarks/release-baseline.json'), false);
  assert.equal(cf.isProtectedPath('packages/spec/benchmarks/benchmark-failure-ledger.json'), false);
  assert.equal(cf.isProtectedPath('packages/spec/.cafekit-release/change-firewall-freeze.json'), false);
  assert.equal(cf.isProtectedPath('packages/spec/.cafekit-release/release-receipt.json'), false);
});
