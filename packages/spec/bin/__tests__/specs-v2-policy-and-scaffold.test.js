'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const POLICY = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/workflow-policy.cjs'));
const SCAFFOLD = path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-scaffold.cjs');
const TEMPLATE = path.join(PACKAGE_ROOT, 'src/claude/skills/specs/templates/spec-state.json');
const CANONICAL_POLICY_FIELDS = [
  'version', 'planning_depth', 'assurance_level', 'classified_minimum', 'risks',
];
const CANONICAL_SPEC_FIELDS_WITH_TASKS = [
  'schema_version', 'feature_name', 'created_at', 'updated_at', 'language', 'status',
  'scope_lock', 'authoring', 'coordination', 'validation', 'semantic_model',
  'ready_for_implementation', 'workflow_policy', 'task_files', 'task_registry',
].sort();

function run(root, args, env = {}) {
  return spawnSync(process.execPath, [SCAFFOLD, ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, ...env },
  });
}

function output(result) { return `${result.stdout}\n${result.stderr}`; }

function readSpec(root, feature) {
  return JSON.parse(fs.readFileSync(path.join(root, 'specs', feature, 'spec.json'), 'utf8'));
}

// A canonical 2.1 scaffold always emits the C2 semantic_review shape plus the
// C13 history and C16 receipt slots. A genuine schema 2.0 record predates all
// three, so a fixture that simulates legacy migration input must strip them —
// relabelling schema_version alone produces a record that never existed and
// trips the 2.0 allowlist before the behavior under test is ever reached.
function downgradeToLegacy20(spec) {
  spec.schema_version = '2.0';
  delete spec.validation.semantic_review_history;
  delete spec.validation.authoring_validation;
  const review = spec.validation.semantic_review;
  spec.validation.semantic_review = {
    status: review.status,
    semantic_digest: review.semantic_digest,
    reviewed_criteria: review.reviewed_criteria,
    counterexamples: review.counterexamples,
  };
  return spec;
}

function ownershipBoundary() {
  return JSON.stringify([{
    id: 'B-OWN', type: 'ownership', tasks: ['R1-01', 'R1-02'],
    write_sets: { 'R1-01': ['src/one.js'], 'R1-02': ['src/two.js'] },
  }]);
}

function readTree(root) {
  const result = {};
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) visit(absolute);
      else result[relative] = fs.readFileSync(absolute).toString('base64');
    }
  }
  visit(root);
  return result;
}

function runMatchingTasksOnly(root, feature, env = {}) {
  return run(root, [
    feature, '--tasks-only', '--tasks', 'R1-01-one,R1-02-two',
    '--boundaries', ownershipBoundary(),
  ], env);
}

function transactionDirs(root) {
  return fs.readdirSync(root).filter((entry) => entry.startsWith('.cafekit-scaffold-tx-'));
}

test('policy 2.1 persists exactly selected axes, classified minimum, and risks', () => {
  const snapshot = POLICY.canonicalWorkflowPolicySnapshot({
    planning_depth: 'Compact', assurance_level: 'Routine',
  });
  assert.deepEqual(Object.keys(snapshot), CANONICAL_POLICY_FIELDS);
  assert.equal(snapshot.version, '2.1');
  const view = POLICY.readWorkflowPolicySnapshot({ workflow_policy: snapshot });
  assert.equal(view.lane, 'Standard');
  assert.equal(view.artifact_profile, 'bounded');
  assert.deepEqual(view.proof_obligations, ['needsExecutionProof']);
  assert.deepEqual(POLICY.validateWorkflowPolicySnapshot(snapshot), { valid: true, errors: [] });
  const legacyCanonical = { ...snapshot, override_receipt: null };
  assert.equal(POLICY.validateWorkflowPolicySnapshot(legacyCanonical).valid, false);
  assert.deepEqual(
    POLICY.canonicalWorkflowPolicySnapshot({ workflow_policy: legacyCanonical }),
    snapshot,
  );
});

test('legacy policy is losslessly readable while authoring persistence migrates to 2.1', () => {
  const legacy = {
    version: '2', planning_depth: 'Compact', automatic_planning_depth: 'Compact',
    assurance_level: 'Routine', automatic_assurance_level: 'Routine', lane: 'Standard',
    automatic_lane: 'Standard', risks: [], artifact_profile: 'bounded',
    planning_obligations: ['needsRequirements', 'needsDesign'], proof_obligations: ['needsExecutionProof'],
    actor_needs: [{ capability: 'execution-proof', independence: 'same-session' }], override_receipt: null,
  };
  const view = POLICY.readWorkflowPolicySnapshot({ workflow_policy: legacy });
  assert.equal(view.version, '2');
  assert.equal(view.lane, 'Standard');
  const migrated = POLICY.persistWorkflowPolicySnapshot({ workflow_policy: legacy }).workflow_policy;
  assert.equal(migrated.version, '2.1');
  assert.equal(migrated.planning_depth, 'Compact');
  assert.equal(Object.hasOwn(migrated, 'lane'), false);
  assert.equal(Object.hasOwn(migrated, 'override_receipt'), false);
});

test('canonical state template is schema 2.1 and approval-free', () => {
  const template = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  assert.equal(template.schema_version, '2.1');
  assert.equal(template.workflow_policy.version, '2.1');
  assert.equal(Object.hasOwn(template, 'approvals'), false);
  assert.deepEqual(template.authoring, {
    requirements: 'draft', design: 'draft', research: 'absent', tasks: 'absent',
  });
  assert.deepEqual(template.coordination, { boundaries: [] });
  assert.equal(template.semantic_model, null);
  assert.deepEqual(Object.keys(template.workflow_policy), CANONICAL_POLICY_FIELDS);
  assert.equal(Object.hasOwn(template, 'override_receipt'), false);
  assert.doesNotMatch(
    fs.readFileSync(SCAFFOLD, 'utf8'),
    /persist only workflow_policy\.override_receipt/,
  );
});

test('new scaffold emits taskless Compact 2.1 without Routine ceremony', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-taskless-'));
  try {
    const result = run(root, ['compact']);
    assert.equal(result.status, 0, result.stderr);
    const spec = readSpec(root, 'compact');
    assert.equal(spec.schema_version, '2.1');
    assert.equal(spec.workflow_policy.version, '2.1');
    assert.deepEqual(spec.coordination, { boundaries: [] });
    assert.equal(spec.authoring.tasks, 'absent');
    assert.equal(Object.hasOwn(spec, 'task_files'), false);
    assert.equal(Object.hasOwn(spec, 'task_registry'), false);
    assert.equal(Object.hasOwn(spec, 'research'), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('research materializes only from a concrete uncertainty and stays minimal', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-research-'));
  try {
    for (const [feature, args] of [
      ['missing', ['--research']],
      ['placeholder', ['--research', '--uncertainty', 'TBD']],
      ['orphan', ['--uncertainty', 'Which persistence boundary is authoritative?']],
    ]) {
      const result = run(root, [feature, ...args]);
      assert.equal(result.status, 2, output(result));
      assert.equal(fs.existsSync(path.join(root, 'specs', feature)), false);
    }

    const uncertainty = 'Which persisted boundary owns retry idempotency?';
    const result = run(root, ['grounded', '--research', '--uncertainty', uncertainty]);
    assert.equal(result.status, 0, output(result));
    const spec = readSpec(root, 'grounded');
    assert.equal(spec.research, 'research.md');
    assert.equal(spec.authoring.research, 'draft');
    const research = fs.readFileSync(path.join(root, 'specs/grounded/research.md'), 'utf8');
    assert.deepEqual(
      [...research.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
      ['Uncertainty', 'Evidence Summary', 'Decision', 'Remaining Gaps'],
    );
    assert.match(research, new RegExp(uncertainty.replace(/[?]/g, '\\?')));
    assert.doesNotMatch(research, /\{\{[^}]+\}\}/);
    assert.doesNotMatch(research, /Finding 1|Option A|example\.com|Architecture Pattern Evaluation/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('scaffold generates typed topology and canonical task projection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-owned-'));
  try {
    const result = run(root, [
      'owned', '--tasks', 'R1-01-one,R1-02-two', '--boundaries', ownershipBoundary(),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const spec = readSpec(root, 'owned');
    assert.deepEqual(spec.coordination.boundaries, JSON.parse(ownershipBoundary()));
    assert.equal(spec.authoring.tasks, 'draft');
    for (const taskPath of spec.task_files) {
      const body = fs.readFileSync(path.join(root, 'specs', 'owned', taskPath), 'utf8');
      for (const heading of ['Outcome', 'Scope', 'Anchors and Ownership', 'Changes', 'Acceptance', 'Dependencies', 'Verification Plan']) {
        assert.match(body, new RegExp(`^## ${heading}$`, 'm'));
      }
      assert.match(body, /\| ID \| Type \| Target \| Role \| Access \| Action \|/);
      assert.doesNotMatch(body, /^## Related Files$/m);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('scaffold rejects marker-only evidence, single-task parallel, and parent-child contention', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-negative-'));
  try {
    const marker = run(root, ['marker', '--tasks', 'R1-01-one', '--task-triggers', 'separate_proof']);
    assert.equal(marker.status, 2);
    assert.match(`${marker.stdout}\n${marker.stderr}`, /only topology authority|typed coordination/);

    const single = run(root, [
      'single', '--tasks', 'R1-01-one', '--boundaries',
      JSON.stringify([{ id: 'B-P', type: 'parallel', tasks: ['R1-01'], resources: { 'R1-01': ['src/one.js'] } }]),
    ]);
    assert.equal(single.status, 2);
    assert.match(`${single.stdout}\n${single.stderr}`, /at least 2 task/);

    const contention = run(root, [
      'contention', '--tasks', 'R1-01-one,R1-02-two', '--boundaries',
      JSON.stringify([{ id: 'B-P', type: 'parallel', tasks: ['R1-01', 'R1-02'], resources: {
        'R1-01': ['src/domain'], 'R1-02': ['src/domain/model.js'],
      } }]),
    ]);
    assert.equal(contention.status, 2);
    assert.match(`${contention.stdout}\n${contention.stderr}`, /resource contention/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('scaffold rejects incomplete dependency, transition, and proof boundaries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-boundaries-'));
  try {
    const cases = [
      ['dependency', { id: 'B-D', type: 'dependency', producer: 'R1-01', consumer: 'R1-02' }, /fields must be exactly/],
      ['transition', { id: 'B-T', type: 'transition', design_ref: 'T1', owner: 'R1-01', consumers: ['R1-02'], precondition: 'ready state', postcondition: 'done state', failure: 'failed state' }, /fields must be exactly/],
      ['proof', { id: 'B-V', type: 'proof', subject: 'R1-01', verifier: 'R1-01', verification_ref: 'V1', artifact_anchor: 'A-R1-01-02' }, /duplicate task ids|subject and verifier must differ/],
    ];
    for (const [feature, boundary, expected] of cases) {
      const result = run(root, [
        feature, '--tasks', 'R1-01-one,R1-02-two', '--boundaries', JSON.stringify([boundary]),
      ]);
      assert.equal(result.status, 2);
      assert.match(`${result.stdout}\n${result.stderr}`, expected);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('scaffold transaction rolls back injected writes exactly', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-rollback-'));
  try {
    const result = run(root, ['rollback'], { CAFEKIT_SCAFFOLD_FAIL_AFTER_WRITES: '1' });
    assert.equal(result.status, 2);
    assert.match(`${result.stdout}\n${result.stderr}`, /transaction rolled back/);
    assert.equal(fs.existsSync(path.join(root, 'specs', 'rollback')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('durable transaction recovery covers every fresh and replacement rename boundary', { skip: process.platform === 'win32' }, () => {
  const matrices = [
    { name: 'fresh', boundaries: 3, prepare() {}, invoke(root, feature, env) { return run(root, [feature], env); } },
    {
      name: 'replacement', boundaries: 2,
      prepare(root, feature) {
        const initial = run(root, [
          feature, '--tasks', 'R1-01-one,R1-02-two', '--boundaries', ownershipBoundary(),
        ]);
        assert.equal(initial.status, 0, output(initial));
        const specPath = path.join(root, 'specs', feature, 'spec.json');
        const spec = downgradeToLegacy20(readSpec(root, feature));
        fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
      },
      invoke(root, feature, env) { return runMatchingTasksOnly(root, feature, env); },
    },
  ];

  for (const matrix of matrices) {
    for (let boundary = 1; boundary <= matrix.boundaries; boundary += 1) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), `cafekit-sk21-kill-${matrix.name}-`));
      const feature = `${matrix.name}-${boundary}`;
      try {
        matrix.prepare(root, feature);
        const killed = matrix.invoke(root, feature, {
          CAFEKIT_SCAFFOLD_KILL_AFTER_RENAMES: String(boundary),
        });
        assert.equal(killed.status, null, `${matrix.name}:${boundary}: ${output(killed)}`);
        assert.equal(killed.signal, 'SIGKILL', `${matrix.name}:${boundary}`);
        assert.equal(transactionDirs(root).length, 1, `${matrix.name}:${boundary} missing journal`);

        const recovered = matrix.invoke(root, feature, {});
        assert.equal(recovered.status, 0, `${matrix.name}:${boundary}: ${output(recovered)}`);
        assert.equal(transactionDirs(root).length, 0, `${matrix.name}:${boundary} leaked journal`);
        assert.equal(readSpec(root, feature).schema_version, '2.1');
      } finally { fs.rmSync(root, { recursive: true, force: true }); }
    }
  }
});

test('startup recovery preserves a target whose transaction ownership cannot be proven', { skip: process.platform === 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-unowned-'));
  try {
    const killed = run(root, ['unowned'], { CAFEKIT_SCAFFOLD_KILL_AFTER_RENAMES: '1' });
    assert.equal(killed.status, null, output(killed));
    assert.equal(killed.signal, 'SIGKILL');
    const target = path.join(root, 'specs/unowned/spec.json');
    const externalBytes = Buffer.from('{"external":"concurrent writer"}\n');
    fs.writeFileSync(target, externalBytes);

    const recovery = run(root, ['unowned']);
    assert.equal(recovery.status, 2, output(recovery));
    assert.match(output(recovery), /refuses to delete unowned target spec\.json/);
    assert.deepEqual(fs.readFileSync(target), externalBytes);
    assert.equal(transactionDirs(root).length, 1, 'journal must remain for explicit resolution');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('typed boundary mutation preserves legacy graph counterexamples atomically', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-graph-mutations-'));
  try {
    const tasks = 'R1-01-owner,R1-02-consumer';
    const cases = [
      ['unknown-task', [{ id: 'B-D', type: 'dependency', producer: 'R1-99', consumer: 'R1-02', deliverable: 'artifacts/value.json' }], /unknown task R1-99/],
      ['canonical-path-alias', [{ id: 'B-D', type: 'dependency', producer: 'tasks/task-R1-01-owner.md', consumer: 'R1-02', deliverable: 'artifacts/value.json' }], /unknown task tasks\/task-R1-01-owner\.md/],
      ['duplicate-boundary-id', [
        { id: 'B-DUP', type: 'dependency', producer: 'R1-01', consumer: 'R1-02', deliverable: 'artifacts/a.json' },
        { id: 'B-DUP', type: 'dependency', producer: 'R1-01', consumer: 'R1-02', deliverable: 'artifacts/b.json' },
      ], /duplicate id B-DUP/],
      ['dependency-cycle', [
        { id: 'B-D1', type: 'dependency', producer: 'R1-01', consumer: 'R1-02', deliverable: 'artifacts/a.json' },
        { id: 'B-D2', type: 'dependency', producer: 'R1-02', consumer: 'R1-01', deliverable: 'artifacts/b.json' },
      ], /dependency cycle/],
      ['malformed-fields', [{ id: 'B-D', type: 'dependency', producer: 'R1-01', consumer: 'R1-02' }], /fields must be exactly/],
    ];
    for (const [feature, boundaries, expected] of cases) {
      const before = fs.existsSync(path.join(root, 'specs'))
        ? fs.readdirSync(path.join(root, 'specs')).sort() : [];
      const result = run(root, [feature, '--tasks', tasks, '--boundaries', JSON.stringify(boundaries)]);
      assert.equal(result.status, 2, output(result));
      assert.match(output(result), expected);
      assert.equal(fs.existsSync(path.join(root, 'specs', feature)), false, `${feature} wrote before validation`);
      assert.deepEqual(fs.existsSync(path.join(root, 'specs')) ? fs.readdirSync(path.join(root, 'specs')).sort() : [], before);
    }

    const identity = run(root, [
      'duplicate-task-identity', '--tasks', 'R1-01-owner,R1-01-alias', '--boundaries', '[]',
    ]);
    assert.equal(identity.status, 2);
    assert.match(output(identity), /duplicate task id "R1-01"/);
    assert.equal(fs.existsSync(path.join(root, 'specs', 'duplicate-task-identity')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('tasks-only normalization is table-driven, conservative, and idempotent', () => {
  const cases = [
    {
      name: 'partial authoring and legacy schema',
      mutate(spec) {
        spec.schema_version = '2.0';
        spec.override_receipt = null;
        spec.workflow_policy.override_receipt = null;
        delete spec.feature_name;
        spec.authoring = { requirements: 'validated' };
        spec.ready_for_implementation = true;
        spec.validation = {
          status: 'completed',
          semantic_review: {
            status: 'completed', semantic_digest: 'legacy',
            reviewed_criteria: ['R1.1'], counterexamples: ['legacy review'],
          },
        };
      },
      verify(spec) {
        assert.equal(spec.feature_name, 'partial-authoring-and-legacy-schema');
        assert.deepEqual(Object.keys(spec).sort(), CANONICAL_SPEC_FIELDS_WITH_TASKS);
        assert.equal(Object.hasOwn(spec, 'override_receipt'), false);
        assert.deepEqual(Object.keys(spec.scope_lock).sort(), [
          'expansion_policy', 'in_scope', 'out_of_scope', 'source',
        ]);
        assert.equal(Object.hasOwn(spec.task_registry['tasks/task-R1-01-one.md'], 'legacy_owner'), false);
        assert.deepEqual(Object.keys(spec.workflow_policy), CANONICAL_POLICY_FIELDS);
        // The legacy input asserts requirements: 'validated' with no C16 receipt
        // behind it. Migration downgrades it to draft rather than carrying the
        // unprovable claim forward: only spec-authoring-validation.cjs may write
        // `validated`, and only together with a matching digest receipt (I21).
        assert.deepEqual(spec.authoring, {
          requirements: 'draft', design: 'draft', research: 'absent', tasks: 'draft',
        });
        assert.equal(spec.ready_for_implementation, false);
        // A legacy validation block never satisfies the canonical 2.1 shape, so
        // migration replaces it with the fresh C2 review, a seeded C13 lineage,
        // and an empty C16 slot — the legacy digest/criteria are not carried
        // forward as if they had been reviewed under the current contract.
        assert.deepEqual(Object.keys(spec.validation).sort(), [
          'authoring_validation', 'semantic_review', 'semantic_review_history', 'status',
        ]);
        assert.equal(spec.validation.status, 'not-run');
        assert.deepEqual(spec.validation.semantic_review, {
          status: 'not-run', semantic_digest: null, verdict: null, lifecycle_disposition: null,
          findings: [], unresolved_decisions: [], graph_coverage: [], repair_round: 0,
          reviewed_criteria: [], counterexamples: [], reviewer_evidence: null,
        });
        assert.deepEqual(spec.validation.semantic_review_history.entries, []);
        assert.match(spec.validation.semantic_review_history.lineage_id, /^sha256:[0-9a-f]{64}$/);
        assert.equal(spec.validation.authoring_validation, null);
      },
    },
    {
      name: 'legacy research pointer and valid done lifecycle',
      research: true,
      mutate(spec) {
        downgradeToLegacy20(spec);
        spec.research = { path: 'research.md' };
        delete spec.authoring.research;
        const task = spec.task_registry['tasks/task-R1-01-one.md'];
        Object.assign(task, {
          status: 'done', blocker: null,
          started_at: '2026-08-13T01:00:00.000Z',
          completed_at: '2026-08-13T02:00:00.000Z',
          last_updated_at: '2026-08-13T03:00:00.000Z',
        });
      },
      verify(spec) {
        assert.equal(spec.research, 'research.md');
        assert.equal(spec.authoring.research, 'draft');
        assert.equal(spec.task_registry['tasks/task-R1-01-one.md'].status, 'done');
        assert.equal(
          spec.task_registry['tasks/task-R1-01-one.md'].completed_at,
          '2026-08-13T02:00:00.000Z',
        );
      },
    },
    {
      name: 'legacy nested inert receipt read migration',
      mutate(spec) {
        downgradeToLegacy20(spec);
        spec.workflow_policy.override_receipt = null;
      },
      verify(spec) {
        assert.equal(Object.hasOwn(spec, 'override_receipt'), false);
        assert.deepEqual(Object.keys(spec.workflow_policy), CANONICAL_POLICY_FIELDS);
        assert.equal(spec.ready_for_implementation, false);
        assert.equal(spec.validation.status, 'not-run');
      },
    },
    {
      name: 'already canonical matching bundle',
      expectStable: true,
      mutate() {},
      verify(spec) {
        assert.equal(spec.schema_version, '2.1');
        assert.equal(spec.authoring.tasks, 'draft');
      },
    },
  ];

  for (const scenario of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-normalize-'));
    try {
      const initial = run(root, [
        scenario.name.replaceAll(' ', '-'), '--tasks', 'R1-01-one,R1-02-two',
        '--boundaries', ownershipBoundary(), ...(scenario.research ? [
          '--research', '--uncertainty', 'Which evidence resolves the legacy research decision?',
        ] : []),
      ]);
      assert.equal(initial.status, 0, output(initial));
      const feature = scenario.name.replaceAll(' ', '-');
      const specPath = path.join(root, 'specs', feature, 'spec.json');
      const spec = readSpec(root, feature);
      scenario.mutate(spec);
      fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
      const before = fs.readFileSync(specPath, 'utf8');
      const result = runMatchingTasksOnly(root, feature);
      assert.equal(result.status, 0, `${scenario.name}: ${output(result)}`);
      const after = fs.readFileSync(specPath, 'utf8');
      if (scenario.expectStable) assert.equal(after, before, `${scenario.name} rewrote canonical state`);
      scenario.verify(JSON.parse(after));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('canonical 2.1 input rejects unknown semantics at every authored object boundary', () => {
  const mutations = [
    ['top', (spec) => { spec.dead_field = true; }],
    ['scope', (spec) => { spec.scope_lock.dead_field = true; }],
    ['authoring', (spec) => { spec.authoring.approved = true; }],
    ['coordination', (spec) => { spec.coordination.task_triggers = ['marker']; }],
    ['boundary', (spec) => { spec.coordination.boundaries[0].narrative_owner = 'self-claim'; }],
    ['validation', (spec) => { spec.validation.audit_status = 'PASS'; }],
    ['semantic-review', (spec) => { spec.validation.semantic_review.reviewer_claim = 'self'; }],
    ['counterexample', (spec) => {
      spec.validation.semantic_review.counterexamples.push({
        criterion: 'R1.1', case_kind: 'failure', scenario: 'request fails',
        expected: 'failure remains observable', decision_refs: ['D1'],
        verification_ref: 'V1', hidden_claim: 'trusted',
      });
    }],
    ['registry', (spec) => { spec.task_registry['tasks/task-R1-01-one.md'].owner_note = 'narrative'; }],
  ];
  for (const [name, mutate] of mutations) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-closed-world-'));
    try {
      const feature = `unknown-${name}`;
      const initial = run(root, [
        feature, '--tasks', 'R1-01-one,R1-02-two', '--boundaries', ownershipBoundary(),
      ]);
      assert.equal(initial.status, 0, output(initial));
      const specPath = path.join(root, 'specs', feature, 'spec.json');
      const spec = readSpec(root, feature);
      mutate(spec);
      fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
      const before = readTree(path.dirname(specPath));
      const result = runMatchingTasksOnly(root, feature);
      assert.equal(result.status, 2, `${name}: ${output(result)}`);
      assert.match(output(result), /closed-world; unknown=\[[^\]]+\]/);
      assert.deepEqual(readTree(path.dirname(specPath)), before, `${name} mutated on rejection`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('tasks-only migration rejects invalid evidence without any write', () => {
  const cases = [
    {
      name: 'missing requirements',
      mutate(root, feature) { fs.unlinkSync(path.join(root, 'specs', feature, 'requirements.md')); },
      expected: /requirements\.md|physical requirements/,
    },
    {
      name: 'forged done lifecycle',
      mutate(root, feature, spec) {
        spec.task_registry['tasks/task-R1-01-one.md'].status = 'done';
        fs.writeFileSync(path.join(root, 'specs', feature, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      },
      expected: /done lifecycle is inconsistent/,
    },
    {
      name: 'research pointer without artifact',
      mutate(root, feature, spec) {
        spec.research = 'research.md';
        spec.authoring.research = 'validated';
        fs.writeFileSync(path.join(root, 'specs', feature, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      },
      expected: /without a physical research\.md/,
    },
    {
      name: 'canonical top level inert receipt',
      mutate(root, feature, spec) {
        spec.override_receipt = null;
        fs.writeFileSync(path.join(root, 'specs', feature, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      },
      expected: /closed-world.*override_receipt/,
    },
    {
      name: 'ambiguous top level inert receipt',
      mutate(root, feature, spec) {
        downgradeToLegacy20(spec);
        delete spec.schema_version;
        spec.override_receipt = null;
        fs.writeFileSync(path.join(root, 'specs', feature, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      },
      expected: /only readable as inert null during schema 2\.0 migration; omit the field/,
    },
    {
      name: 'legacy top level non inert receipt',
      mutate(root, feature, spec) {
        downgradeToLegacy20(spec);
        spec.override_receipt = { issuer: 'unsupported' };
        fs.writeFileSync(path.join(root, 'specs', feature, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      },
      expected: /top-level override_receipt is unsupported; omit the field/,
    },
    {
      name: 'nested non inert receipt',
      mutate(root, feature, spec) {
        spec.workflow_policy.override_receipt = 'forged';
        fs.writeFileSync(path.join(root, 'specs', feature, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      },
      expected: /workflow_policy\.override_receipt is unsupported; omit the field/,
    },
    ...['', 42, 'different-feature'].map((featureName) => ({
      name: `conflicting feature identity ${String(featureName) || 'empty'}`,
      mutate(root, feature, spec) {
        spec.feature_name = featureName;
        fs.writeFileSync(path.join(root, 'specs', feature, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      },
      expected: /feature_name conflicts with the scaffold feature identity/,
    })),
  ];

  for (const scenario of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk21-atomic-'));
    try {
      const feature = scenario.name.replaceAll(' ', '-');
      const initial = run(root, [
        feature, '--tasks', 'R1-01-one,R1-02-two', '--boundaries', ownershipBoundary(),
      ]);
      assert.equal(initial.status, 0, output(initial));
      scenario.mutate(root, feature, readSpec(root, feature));
      const featureDir = path.join(root, 'specs', feature);
      const before = readTree(featureDir);
      const result = runMatchingTasksOnly(root, feature);
      assert.equal(result.status, 2, `${scenario.name}: ${output(result)}`);
      assert.match(output(result), scenario.expected);
      assert.deepEqual(readTree(featureDir), before, `${scenario.name} mutated the bundle on rejection`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('schema 2.0 migration rejects unknown authority fields instead of projection-dropping them', () => {
  const mutations = [
    ['top-level', (spec) => { spec.dead_authority = true; }],
    ['scope-lock', (spec) => { spec.scope_lock.dead_authority = true; }],
    ['workflow-policy', (spec) => { spec.workflow_policy.dead_authority = true; }],
    ['registry', (spec) => { spec.task_registry['tasks/task-R1-01-one.md'].dead_authority = true; }],
  ];
  for (const [name, mutate] of mutations) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-sk20-unknown-'));
    try {
      const feature = `legacy-unknown-${name}`;
      assert.equal(run(root, [feature, '--tasks', 'R1-01-one,R1-02-two', '--boundaries', ownershipBoundary()]).status, 0);
      const specPath = path.join(root, 'specs', feature, 'spec.json');
      const spec = downgradeToLegacy20(readSpec(root, feature));
      mutate(spec);
      fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
      const before = readTree(path.dirname(specPath));
      const result = runMatchingTasksOnly(root, feature);
      assert.equal(result.status, 2, `${name}: ${output(result)}`);
      // Must name the injected dead_authority field specifically: before the
      // legacy downgrade above, this matched on the 2.1-only validation records
      // instead and passed without exercising the mutation under test.
      assert.match(output(result), /unsupported legacy authority field.*dead_authority/);
      assert.deepEqual(readTree(path.dirname(specPath)), before);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('--help and --version answer on stdout before any precondition runs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-scaffold-info-flags-'));
  try {
    for (const flag of ['--help', '-h']) {
      const result = run(root, [flag]);
      assert.equal(result.status, 0, `${flag}: ${output(result)}`);
      assert.match(result.stdout, /^Usage: node spec-scaffold\.cjs/, `${flag} must print usage on stdout`);
      assert.equal(result.stderr, '', `${flag} must not write to stderr`);
    }

    for (const flag of ['--version', '-v']) {
      const result = run(root, [flag]);
      assert.equal(result.status, 0, `${flag}: ${output(result)}`);
      // Prerelease suffixes are normal on this package (e.g. 0.16.0-rc.4).
      assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/, `${flag} must print a SemVer version`);
      assert.equal(result.stderr, '', `${flag} must not write to stderr`);
    }

    // A help flag must never be read as a feature name, and must not create a spec.
    assert.deepEqual(fs.readdirSync(root), [], 'info flags must not touch the work tree');

    // The no-argument path keeps usage-as-diagnostic: stderr, exit 2.
    const bare = run(root, []);
    assert.equal(bare.status, 2, output(bare));
    assert.equal(bare.stdout, '', 'bare invocation must not print usage on stdout');
    assert.match(bare.stderr, /^Usage: node spec-scaffold\.cjs/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
