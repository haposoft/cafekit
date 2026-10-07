'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const VALIDATOR = path.join(ROOT, 'src/claude/scripts/validate-spec-output.cjs');
const GROUNDING = path.join(ROOT, 'src/claude/scripts/spec-ground.cjs');
const RESOLVER = path.join(ROOT, 'src/claude/scripts/spec-resolver.cjs');
const POLICY = require(path.join(ROOT, 'src/claude/scripts/workflow-policy.cjs'));
const SPEC_RESOLVER = require(RESOLVER);
const { normalizeCodexBody } = require(path.join(ROOT, 'bin/lib/codex-install.js'));

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeRaw(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function run(script, args, cwd, options = {}) {
  const fixtureRoot = script === VALIDATOR && typeof args[0] === 'string'
    ? path.dirname(path.dirname(path.resolve(args[0])))
    : null;
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    ...options,
    env: {
      ...process.env,
      ...(fixtureRoot ? { HOME: path.join(fixtureRoot, '.home'), USERPROFILE: path.join(fixtureRoot, '.home') } : {}),
      ...(options.env || {}),
    },
  });
}

function snapshotTree(root) {
  const entries = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      const relative = path.relative(root, fullPath);
      if (entry.isSymbolicLink()) {
        entries.push(`${relative}\0symlink\0${fs.readlinkSync(fullPath)}`);
      } else if (entry.isDirectory()) {
        entries.push(`${relative}\0directory`);
        visit(fullPath);
      } else {
        entries.push(`${relative}\0file\0${fs.readFileSync(fullPath).toString('base64')}`);
      }
    }
  }
  visit(root);
  return entries.sort().join('\n');
}

function task({
  id = 'R1-01',
  mapping = '1.1',
  related = '`src/one.js` | Modify',
  relatedRows = null,
  dependencies = 'none',
  status = 'pending',
  parallel = false,
  extra = '',
} = {}) {
  const relatedPath = related.match(/`([^`]+)`/)?.[1] || 'src/one.js';
  const action = related.match(/\|\s*([A-Za-z]+)\b/i)?.[1] || 'Modify';
  const acceptanceId = mapping.match(/\d+\.\d+/)?.[0];
  const lifecycleRows = relatedRows === null ? (action.toLowerCase() === 'modify'
    ? `| \`${relatedPath}\` | Read | Inspect existing implementation |\n| ${related} | Update implementation |`
    : `| ${related} | Apply declared lifecycle action |`) : relatedRows;
  return `# Task ${id}: One\n\n**Status:** ${status}\n\n## Outcome\n\nCalling the real fixture entrypoint returns status value 1.\n\n## Scope and Typed Anchors\n\n- **In scope:** Implement the mapped observable behavior.\n- **Out of scope:** Unrelated runtime behavior.\n- **Contracts/Invariants:** none\n- **Canonical design anchors consumed:** A-D-01\n\n| ID | Type | Target | Role |\n|---|---|---|---|\n| A-${id}-01 | command | \`node --test test/one.test.js\` | planned verification command |\n\n## Changes\n\n- [ ] ${parallel ? '(P) ' : ''}Update the source boundary and preserve its negative path.${mapping ? ` _Requirements: ${mapping}_` : ''}\n\n## Acceptance\n\n${acceptanceId ? `- **R${acceptanceId}:**` : '-'} Calling \`${relatedPath}\` returns an observable result with status value 1.\n\n## Dependencies\n\n- ${dependencies}\n\n## Verification Plan\n\n- **Command:** \`node --test test/one.test.js\`\n- **Expected:** exit code 0 and one assertion for status value 1\n- **Negative path:** invalid input returns a deterministic error result\n- **Reachability:** \`${relatedPath}\` is invoked by the focused test\n\n## Related Files\n\n| Path | Action | Description |\n|---|---|---|---|\n${lifecycleRows}\n${extra}`;
}

function legacyWorkflowPolicy(lane = 'Standard') {
  const proofObligations = lane === 'Critical'
    ? ['needsInspection', 'needsExecutionProof', 'needsIndependentAudit', 'needsResearchGrounding']
    : ['needsInspection', 'needsExecutionProof'];
  return {
    version: '1',
    lane,
    automatic_lane: lane,
    risks: lane === 'Critical' ? ['auth'] : [],
    artifact_profile: lane === 'Critical' ? 'strict' : 'bounded',
    proof_obligations: proofObligations,
    actor_needs: proofObligations.map((obligation) => ({
      capability: {
        needsInspection: 'inspection',
        needsExecutionProof: 'execution-proof',
        needsIndependentAudit: 'audit',
        needsResearchGrounding: 'research-grounding',
      }[obligation],
      independence: obligation === 'needsIndependentAudit' ? 'independent' : 'same-session',
    })),
    override_receipt: null,
  };
}

function legacyTask({ relatedRows = '| `src/one.js` | Read | Inspect existing behavior |', extra = '' } = {}) {
  return `# Task R1-01: One\n\n**Status:** pending\n**Dependencies:** none\n\n## Context\n\nThe existing fixture service returns one deterministic result.\n\n## Constraints\n\nPreserve the stable result contract and its invalid-input behavior.\n\n## Steps\n\n- [ ] Inspect the declared boundary and preserve status value 1. _Requirements: 1.1_\n\n## Requirements\n\n- 1.1 — Return status value 1 from the fixture service.\n\n## Related Files\n\n| Path | Action | Description |\n|---|---|---|\n${relatedRows}\n\n## Completion Criteria\n\n- Calling \`src/one.js\` returns result status value 1.\n\n## Evidence\n\n- **Command:** \`node --test test/one.test.js\`\n- **Expected:** exit code 0 and status value 1\n- **Inspect:** \`src/one.js\` runtime result\n- Runtime reachability verification\n  - **Entrypoint/caller:** \`src/one.js\`\n\n## Risk Assessment\n\n| Risk | Severity | Mitigation |\n|---|---|---|\n| regression | low | focused test |\n${extra}`;
}

function lifecycleTimestamps({ tasks = true, research = false, review = false } = {}) {
  return {
    init: '2026-08-11T00:00:00+07:00',
    requirements_done: '2026-08-11T00:01:00+07:00',
    research_done: research ? '2026-08-11T00:02:00+07:00' : null,
    design_done: '2026-08-11T00:03:00+07:00',
    tasks_done: tasks ? '2026-08-11T00:04:00+07:00' : null,
    code_done: null,
    test_done: null,
    review_done: review ? '2026-08-11T00:05:00+07:00' : null,
    validation_done: '2026-08-11T00:06:00+07:00',
  };
}

function semanticReviewNotRun() {
  return {
    status: 'not-run', reviewed_artifact_digest: null, reviewed_criteria: [], counterexamples: [],
  };
}

function semanticDigest(specDir) {
  const result = run(VALIDATOR, [specDir, '--semantic-digest'], ROOT);
  assert.equal(result.status, 0, output(result));
  return result.stdout.trim();
}

function completeSemanticReview(specDir) {
  const statePath = path.join(specDir, 'spec.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.validation = isPlainObjectForTest(state.validation) ? state.validation : {};
  state.validation.semantic_review = {
    status: 'completed',
    reviewed_artifact_digest: semanticDigest(specDir),
    reviewed_criteria: ['R1.1'],
    counterexamples: [{
      criterion: 'R1.1',
      scenario: 'The fixture receives invalid input at its runtime boundary.',
      expected: 'The fixture returns the deterministic negative-path result.',
      design_reference: 'D1',
    }],
  };
  write(statePath, JSON.stringify(state, null, 2));
  return state;
}

function isPlainObjectForTest(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function obligationClosureBlock(obligation) {
  const consumers = obligation.consumer_tasks.length > 0
    ? obligation.consumer_tasks.join(', ')
    : 'none';
  return `<!-- implementation-obligation:${obligation.id} -->\n- Requirements: ${obligation.requirements.join(', ')}\n- Canonical state: ${obligation.canonical_state}\n- Authority: ${obligation.authority}\n- Recovery: ${obligation.recovery}\n- Owner task: ${obligation.owner_task}\n- Consumers: ${consumers}\n- Verification: ${obligation.verification}\n- Evidence: ${obligation.evidence}\n`;
}

function executionClosure(obligation) {
  return `\n## Execution Closure\n\n${obligationClosureBlock(obligation)}`;
}

function executionClosureTable(obligation) {
  const consumers = obligation.consumer_tasks.length > 0
    ? obligation.consumer_tasks.join(', ')
    : 'none';
  return `\n## Execution Closure\n\n<!-- implementation-obligation:${obligation.id} -->\n` +
    '| Obligation ID / Requirements | Canonical State | Authority | Crash / Retry Recovery | Owner Task | Consumer Tasks / Dependency Order | Verification / Evidence |\n' +
    '|---|---|---|---|---|---|---|\n' +
    `| ${obligation.id} / ${obligation.requirements.join(', ')} | ${obligation.canonical_state} | ${obligation.authority} | ${obligation.recovery} | \`${obligation.owner_task}\` | ${consumers} | \`${obligation.verification}\` → ${obligation.evidence} |\n`;
}

function criticalNoObligationDesign() {
  return designFixture() +
    '## Execution Closure\n\n' +
    'N/A — this fixture has no cross-task state, retry, migration, or authority obligation.\n';
}

function designFixture() {
  return '# Design\n\n## Boundary\n\nThe `src/one.js` module owns the fixture behavior and returns one deterministic result.\n\n' +
    '## Typed Anchors\n\n| ID | Type | Target | Role |\n|---|---|---|---|\n' +
    '| A-D-01 | file | `src/one.js` | existing owner and runtime entrypoint |\n\n' +
    '## Decisions and Invariants\n\n### D1 — Stable result\n\n- **Decision:** Return status value 1.\n- **Negative path:** Invalid input returns a deterministic error.\n- **Anchors:** A-D-01\n\n' +
    '## Verification\n\n| Requirement | Proof target | Expected result | Negative path / reachability |\n|---|---|---|---|\n' +
    '| R1.1 | `node --test test/one.test.js` | exit code 0 and status value 1 | invalid input through `src/one.js` |\n\n';
}

function createSpec(root, options = {}) {
  const featureName = options.name || 'spec';
  const specDir = path.join(root, 'specs', featureName);
  const taskPath = 'tasks/task-R1-01-one.md';
  write(
    path.join(specDir, 'requirements.md'),
    options.requirements || '# Requirements\n\n### Requirement 1: One\n\n- **R1.1** When input arrives, the service shall return one deterministic result.\n',
  );
  write(
    path.join(specDir, 'design.md'),
    options.design || designFixture(),
  );
  write(path.join(specDir, taskPath), options.task || task());
  write(path.join(root, 'test/one.test.js'), "'use strict';\n// Separate proof artifact for fixture validation.\n");
  write(path.join(specDir, 'spec.json'), JSON.stringify({
    schema_version: '2.0',
    feature_name: featureName,
    created_at: '2026-08-11T00:00:00+07:00',
    updated_at: '2026-08-11T00:05:00+07:00',
    language: 'en',
    status: 'in_progress',
    current_phase: 'tasks',
    scope_lock: { source: 'fixture', in_scope: ['1'], out_of_scope: [], expansion_policy: 'requires-user-approval' },
    coordination: {
      tasks_required: true,
      phases_required: false,
      reason: 'task_topology',
      task_triggers: ['separate_proof'],
    },
    task_files: [taskPath],
    task_registry: {
      [taskPath]: {
        id: 'R1-01', title: 'One', status: 'pending', dependencies: [], blocker: null,
        started_at: null, completed_at: null, last_updated_at: null,
        artifacts: ['test/one.test.js'],
      },
    },
    approvals: { requirements: { generated: true, agent_validated: true, user_approved: true }, design: { generated: true, agent_validated: true, user_approved: true }, tasks: { generated: true, agent_validated: true, user_approved: true } },
    validation: { status: 'not-run', semantic_review: semanticReviewNotRun() },
    timestamps: { ...lifecycleTimestamps(), validation_done: null },
    ready_for_implementation: false,
    workflow_policy: POLICY.workflowPolicySnapshot({ riskSignals: {} }),
    ...(options.spec || {}),
  }, null, 2));
  return specDir;
}

function createBoundedSpec(root, name = 'bounded') {
  const specDir = path.join(root, name);
  const policy = POLICY.workflowPolicySnapshot({ riskSignals: {} });
  write(path.join(specDir, 'requirements.md'), '# Requirements\n\n### Requirement 1: One\n\n- **R1.1** When input arrives, the service shall return status value 1.\n');
  write(path.join(specDir, 'design.md'), designFixture());
  write(path.join(specDir, 'spec.json'), JSON.stringify({
    schema_version: '2.0',
    feature_name: name,
    created_at: '2026-08-11T00:00:00+07:00',
    updated_at: '2026-08-11T00:03:00+07:00',
    status: 'in_progress',
    current_phase: 'design',
    scope_lock: { source: 'fixture', in_scope: [], out_of_scope: [], expansion_policy: 'requires-user-approval' },
    coordination: { tasks_required: false, phases_required: false, reason: 'taskless_requested' },
    approvals: {
      requirements: { generated: true, agent_validated: true, user_approved: false },
      design: { generated: true, agent_validated: true, user_approved: false },
    },
    validation: { status: 'not-run', semantic_review: semanticReviewNotRun() },
    timestamps: { ...lifecycleTimestamps({ tasks: false }), validation_done: null },
    ready_for_implementation: false,
    workflow_policy: policy,
  }, null, 2));
  return specDir;
}

function legacyTasklessSpec20State(name, policy) {
  return {
    schema_version: '2.0',
    feature_name: name,
    created_at: '2026-08-11T00:00:00+07:00',
    updated_at: '2026-08-11T00:03:00+07:00',
    language: 'en',
    status: 'in_progress',
    current_phase: 'design',
    scope_lock: {
      source: 'legacy fixture',
      in_scope: [],
      out_of_scope: [],
      expansion_policy: 'requires-user-approval',
    },
    coordination: {
      tasks_required: false,
      phases_required: false,
      reason: 'taskless_requested',
    },
    validation: { status: 'not-run', semantic_review: semanticReviewNotRun() },
    timestamps: { ...lifecycleTimestamps({ tasks: false }), validation_done: null },
    ready_for_implementation: false,
    workflow_policy: policy,
  };
}

function createLegacyTasklessSpec20(root, name, policy) {
  const specDir = path.join(root, 'specs', name);
  write(
    path.join(specDir, 'requirements.md'),
    '# Requirements\n\n### Requirement 1: Legacy baseline\n\n- **R1.1** The fixture shall preserve one deterministic result.\n',
  );
  write(path.join(specDir, 'design.md'), designFixture());
  write(
    path.join(specDir, 'spec.json'),
    JSON.stringify(legacyTasklessSpec20State(name, policy), null, 2),
  );
  return specDir;
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function completeScaffoldedSpec(specDir) {
  const state = JSON.parse(fs.readFileSync(path.join(specDir, 'spec.json'), 'utf8'));
  for (const [index, taskFile] of (state.task_files || []).entries()) {
    const entry = state.task_registry[taskFile];
    write(path.join(specDir, taskFile), task({
      id: entry.id,
      related: `\`src/${index === 0 ? 'one' : `task-${index + 1}`}.js\` | Read`,
      dependencies: entry.dependencies.length > 0 ? entry.dependencies.join(',') : 'none',
    }));
  }
  write(path.join(specDir, 'requirements.md'), '# Requirements\n\n### Requirement 1: Artifact\n\n- **R1.1** The task is verifiable.\n');
  write(
    path.join(specDir, 'design.md'),
    state.workflow_policy?.assurance_level === 'Strict' ? criticalNoObligationDesign() : designFixture(),
  );
  if (state.research === 'research.md') {
    write(path.join(specDir, 'research.md'), '# Research\n\n## Evidence Summary\n- Producer fixture.\n');
  }
  return state;
}

test('canonical legacy v2.0 taskless migration fixture is valid without execution evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-legacy-taskless-baseline-'));
  try {
    const specDir = createLegacyTasklessSpec20(
      root,
      'legacy-taskless-baseline',
      POLICY.workflowPolicySnapshot({ riskSignals: {} }),
    );
    const state = JSON.parse(fs.readFileSync(path.join(specDir, 'spec.json'), 'utf8'));
    assert.equal(state.schema_version, '2.0');
    assert.equal(state.ready_for_implementation, false);
    assert.equal(Object.hasOwn(state, 'task_files'), false);
    assert.equal(Object.hasOwn(state, 'task_registry'), false);
    assert.equal(fs.existsSync(path.join(specDir, 'research.md')), false);
    assert.equal(fs.existsSync(path.join(specDir, 'receipts')), false);
    state.override_receipt = { legacy: true };
    write(path.join(specDir, 'spec.json'), JSON.stringify(state, null, 2));
    const validation = run(VALIDATOR, [specDir], ROOT);
    assert.equal(validation.status, 0, output(validation));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Codex installer transform preserves all owned spec assets idempotently', () => {
  for (const relative of [
    'src/claude/skills/specs/SKILL.md',
    'src/claude/skills/specs/references/review.md',
    'src/claude/skills/specs/references/templates.md',
    'src/claude/skills/specs/templates/design.md',
    'src/claude/skills/specs/templates/task.md',
    'src/claude/scripts/spec-receipt.cjs',
    'src/claude/scripts/validate-spec-output.cjs',
  ]) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    const transformed = normalizeCodexBody(source, relative);
    assert.equal(normalizeCodexBody(transformed, relative), transformed, `${relative} must normalize idempotently`);
    assert.doesNotMatch(transformed, /node \.claude\/scripts\//, `${relative} retained a Claude executable path`);
    if (/node \.claude\/scripts\//.test(source)) {
      assert.match(transformed, /node \.codex\/scripts\//, `${relative} lost its Codex executable path`);
    }
    if (/implementation-obligation:/.test(source)) {
      assert.match(transformed, /implementation-obligation:/, `${relative} lost closure semantics`);
    }
  }

  const skill = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/SKILL.md'), 'utf8');
  const review = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/references/review.md'), 'utf8');
  const templates = fs.readFileSync(path.join(ROOT, 'src/claude/skills/specs/references/templates.md'), 'utf8');
  assert.match(skill, /specs\/<feature>\/[\s\S]{0,160}plan\.md[\s\S]{0,160}task-01-<slug>\.md/);
  assert.match(skill, /GATE-SCOPE[\s\S]*GATE-REVIEW[\s\S]*GATE-DONE/);
  assert.doesNotMatch(skill, /--(?:status|validate|archive)\b/);
  assert.match(review, /path:line/);
  assert.match(review, /Cap the presented[\s\S]{0,40}list at 15/);
  assert.match(review, /Round three requires runtime evidence/);
  assert.match(templates, /\| ID \| EARS criterion \| Proof \|/);
  assert.match(templates, /## Canonical inline Receipt[\s\S]*Verification: PASS[\s\S]*Exit: 0[\s\S]*Base:[\s\S]*Head:/);

});

test('resolver binds feature identity and rejects cross-feature spec aliases', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-resolver-identity-'));
  try {
    const specsDir = path.join(root, 'specs');
    write(path.join(specsDir, 'bar', 'spec.json'), JSON.stringify({ feature_name: 'bar', status: 'in_progress' }));
    fs.mkdirSync(path.join(specsDir, 'foo'), { recursive: true });
    fs.symlinkSync('../bar/spec.json', path.join(specsDir, 'foo', 'spec.json'));

    const explicit = SPEC_RESOLVER.resolveActiveSpec({ projectRoot: root, explicitFeature: 'foo' });
    assert.equal(explicit.error, 'explicit_malformed');
    assert.match(explicit.reason, /does not belong to feature directory|canonical feature/);

    const implicit = SPEC_RESOLVER.resolveActiveSpec({ projectRoot: root });
    assert.equal(implicit.error, 'invalid_specs');
    assert.deepEqual(implicit.candidates, ['foo']);
    assert.doesNotMatch(implicit.reason, /Multiple active specs/);
    assert.throws(
      () => SPEC_RESOLVER.findAllActiveSpecs(root),
      (error) => error.code === 'INVALID_SPECS' && /foo/.test(error.message),
    );

    const aliasRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-resolver-directory-alias-'));
    try {
      const aliasSpecs = path.join(aliasRoot, 'specs');
      write(path.join(aliasSpecs, 'bar', 'spec.json'), JSON.stringify({ feature_name: 'bar', status: 'in_progress' }));
      fs.symlinkSync('bar', path.join(aliasSpecs, 'foo'), 'dir');
      const resolved = SPEC_RESOLVER.resolveActiveSpec({ projectRoot: aliasRoot });
      assert.equal(resolved.featureName, 'bar');
      assert.equal(SPEC_RESOLVER.findAllActiveSpecs(aliasRoot).length, 1);
    } finally {
      fs.rmSync(aliasRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects hidden task symlinks instead of filtering them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-hidden-task-link-'));
  try {
    const specDir = createSpec(root, { name: 'hidden-task-link' });
    fs.symlinkSync('task-R1-01-one.md', path.join(specDir, 'tasks', '.hidden-task.md'));
    const result = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /tasks\/\.hidden-task\.md: symlink is not allowed/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects non-Markdown task artifacts instead of ignoring them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-task-artifact-'));
  try {
    const specDir = createSpec(root, { name: 'non-markdown-task-artifact' });
    write(path.join(specDir, 'tasks', 'notes.txt'), 'worker note\n');
    const result = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /tasks\/notes\.txt: unexpected task artifact/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator keeps authoring receipt-free and validates taskless execution closeout proof', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-feature-receipt-'));
  try {
    const specDir = createBoundedSpec(root, 'weak-completed-feature-receipt');
    write(path.join(specDir, 'feature-receipt.md'), [
      '# Feature Verification Receipt', '', 'Verification: PASS',
      'Command: npm test', 'Exit: 0', 'Base: a', 'Head: b',
    ].join('\n'));
    const premature = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(premature.status, 0);
    assert.match(output(premature), /completed execution receipt is valid only on terminal status done, never for readiness/);

    const weakSpecPath = path.join(specDir, 'spec.json');
    const weakSpec = JSON.parse(fs.readFileSync(weakSpecPath, 'utf8'));
    weakSpec.status = 'done';
    weakSpec.current_phase = 'done';
    write(weakSpecPath, JSON.stringify(weakSpec, null, 2));
    const weak = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(weak.status, 0);
    assert.match(output(weak), /completed proof and spec\.json must both use status done/);
    assert.match(output(weak), /observable expected result/);
    assert.match(output(weak), /distinct 40- or 64-hex Base and Head bindings/);

    const completedDir = createBoundedSpec(root, 'completed-feature-receipt');
    const completedSpecPath = path.join(completedDir, 'spec.json');
    const completedSpec = JSON.parse(fs.readFileSync(completedSpecPath, 'utf8'));
    completedSpec.status = 'done';
    completedSpec.current_phase = 'done';
    write(completedSpecPath, JSON.stringify(completedSpec, null, 2));
    write(path.join(completedDir, 'feature-receipt.md'), [
      '# Feature Verification Receipt', '', 'Verification: PASS', 'Status: done',
      'Command: `node --test test/one.test.js`',
      'Expected result: exit code 0 and one test passes',
      'Observed result: exit code 0 and one test passed',
      'Artifact/runtime proof: `src/one.js` persisted state value 1',
      `Base: ${'a'.repeat(40)}`,
      `Head: ${'b'.repeat(40)}`,
    ].join('\n'));
    const completed = run(VALIDATOR, [completedDir], ROOT);
    assert.equal(completed.status, 0, output(completed));

  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects required and optional spec artifacts that symlink outside the spec', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-artifact-links-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-external-artifacts-'));
  try {
    const required = createSpec(root, { name: 'required-artifact-link' });
    fs.unlinkSync(path.join(required, 'requirements.md'));
    fs.symlinkSync(path.join(external, 'requirements.md'), path.join(required, 'requirements.md'));
    write(path.join(external, 'requirements.md'), '# External requirements\n');
    const requiredResult = run(VALIDATOR, [required], ROOT);
    assert.notEqual(requiredResult.status, 0);
    assert.match(output(requiredResult), /requirements\.md: symlink is not allowed/);

    const optional = createSpec(root, { name: 'optional-artifact-link' });
    const optionalSpecPath = path.join(optional, 'spec.json');
    const optionalSpec = JSON.parse(fs.readFileSync(optionalSpecPath, 'utf8'));
    optionalSpec.research = 'research.md';
    write(optionalSpecPath, JSON.stringify(optionalSpec, null, 2));
    write(path.join(external, 'research.md'), '# External research\n');
    fs.symlinkSync(path.join(external, 'research.md'), path.join(optional, 'research.md'));
    const optionalResult = run(VALIDATOR, [optional], ROOT);
    assert.notEqual(optionalResult.status, 0);
    assert.match(output(optionalResult), /research\.md: symlink is not allowed/);

    const bounded = createBoundedSpec(root, 'receipt-artifact-link');
    write(path.join(external, 'feature-receipt.md'), '# External receipt\n');
    fs.symlinkSync(path.join(external, 'feature-receipt.md'), path.join(bounded, 'feature-receipt.md'));
    const boundedResult = run(VALIDATOR, [bounded], ROOT);
    assert.notEqual(boundedResult.status, 0);
    assert.match(output(boundedResult), /feature-receipt\.md: symlink is not allowed/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test('Standard bounded readiness requires canonical testable requirements and a concrete design boundary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-standard-placeholders-'));
  try {
    const specDir = createBoundedSpec(root, 'standard-placeholders');
    const specPath = path.join(specDir, 'spec.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    spec.ready_for_implementation = true;
    spec.approvals.requirements.user_approved = true;
    spec.approvals.design.user_approved = true;
    spec.validation = { status: 'completed' };
    spec.updated_at = '2026-08-11T00:06:00+07:00';
    spec.timestamps = lifecycleTimestamps({ tasks: false });
    spec.scope_lock.source = '{{PROJECT_DESCRIPTION}}';
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
    write(path.join(specDir, 'requirements.md'), '# Requirements\n\n{{REQUIREMENTS}}\n');
    write(path.join(specDir, 'design.md'), '# Design\n\nTBD\n');

    const rejected = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(rejected.status, 0);
    assert.match(output(rejected), /scope_lock\.source.*concrete scope source/);
    assert.match(output(rejected), /requirements\.md: Standard readiness rejects placeholders/);
    assert.match(output(rejected), /design\.md: Standard readiness rejects placeholders/);
    assert.doesNotMatch(output(rejected), /feature-receipt\.md: canonical feature receipt required/);

    spec.scope_lock.source = 'The bounded feature scope is the one described here';
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
    write(path.join(specDir, 'requirements.md'), '# Requirements\n\nThe bounded behavior is explicitly defined.\n');
    write(path.join(specDir, 'design.md'), '# Design\n\nThe bounded implementation boundary is explicitly defined.\n');
    const generic = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(generic.status, 0);
    assert.match(output(generic), /canonical numeric requirement id/);
    assert.match(output(generic), /testable acceptance criterion using RN\.M/);
    assert.match(output(generic), /grounded path\/code identifier/);

    write(
      path.join(specDir, 'requirements.md'),
      '# Requirements\n\n## Requirements\n\n### Requirement 1: Locale persistence\n\n' +
      '- **R1.1** When a locale is saved, the CLI shall write the selected value to `.codex/runtime.json` and return exit code 0.\n',
    );
    write(
      path.join(specDir, 'design.md'),
      '# Design\n\n## Boundary\n\nThe `.codex/runtime.json` file is owned by `saveLocale`; the CLI calls it before returning success.\n\n' +
      '## Typed Anchors\n\n| ID | Type | Target | Role |\n|---|---|---|---|\n' +
      '| A-D-01 | file | `.codex/runtime.json` | locale persistence target |\n' +
      '| A-D-02 | symbol | `src/runtime.js#saveLocale` | locale writer |\n\n' +
      '## Decisions and Invariants\n\n### D1 — Persist selected locale\n\n- **Decision:** `saveLocale` writes the selected value.\n- **Negative path:** Invalid locale leaves state unchanged.\n- **Anchors:** A-D-01, A-D-02\n\n' +
      '## Verification\n\n| Requirement | Proof target | Expected result | Negative path / reachability |\n|---|---|---|---|\n' +
      '| R1.1 | `node --test test/runtime.test.js` | exit code 0 and saved locale | invalid locale through `saveLocale` |\n',
    );
    completeSemanticReview(specDir);
    const accepted = run(VALIDATOR, [specDir], ROOT);
    assert.equal(accepted.status, 0, output(accepted));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator requires a strict persisted workflow-policy snapshot and never falls back to prose or legacy tier', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-policy-boundary-'));
  try {
    const policy = POLICY.workflowPolicySnapshot({ riskSignals: {} });
    const cases = [
      ['missing', (state) => { delete state.workflow_policy; }, /missing persisted snapshot/],
      ['explicit-null', (state) => { state.workflow_policy = null; }, /workflow_policy must be an object/],
      ['malformed', (state) => { state.workflow_policy = { ...policy, proof_obligations: { needsExecutionProof: true } }; }, /proof_obligations must be an array/],
      ['extra-field', (state) => { state.workflow_policy = { ...policy, extra: true }; }, /workflow_policy fields must be exactly/],
      ['lane-mismatch', (state) => { state.workflow_policy = { ...policy, lane: 'Critical', automatic_lane: 'Critical' }; }, /lane is not the derived compatibility lane|automatic_lane is not the derived compatibility lane/],
      ['risk-mismatch', (state) => { state.workflow_policy = { ...policy, risks: ['auth'] }; }, /assurance_level must be at least Elevated/],
      ['obligation-mismatch', (state) => { state.workflow_policy = { ...policy, proof_obligations: ['needsInspection', 'needsExecutionProof'], actor_needs: [{ capability: 'inspection', independence: 'same-session' }, { capability: 'execution-proof', independence: 'same-session' }] }; }, /proof_obligations do not match assurance_level and risks/],
    ];
    for (const [name, mutate, expected] of cases) {
      const specDir = createSpec(root, { name, spec: { workflow_policy: policy } });
      const statePath = path.join(specDir, 'spec.json');
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      mutate(state);
      write(statePath, JSON.stringify(state, null, 2));
      const beforeRun = snapshotTree(specDir);
      const result = run(VALIDATOR, [specDir], ROOT);
      assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
      assert.match(output(result), expected);
      assert.equal(snapshotTree(specDir), beforeRun, `${name} validator mutated the snapshot`);
    }

    const legacyDir = createSpec(root, {
      name: 'legacy-ready',
      spec: {
        workflow_policy: undefined,
        design_context: { execution_tier: 'Deep' },
        ready_for_implementation: true,
        approvals: {
          requirements: { generated: true, agent_validated: true, user_approved: true },
          design: { generated: true, agent_validated: true, user_approved: true },
          tasks: { generated: true, agent_validated: true, user_approved: true },
        },
        validation: { status: 'completed' },
        updated_at: '2026-08-11T00:06:00+07:00',
        timestamps: lifecycleTimestamps(),
      },
    });
    const legacyBefore = snapshotTree(legacyDir);
    const legacyResult = run(VALIDATOR, [legacyDir], ROOT);
    assert.notEqual(legacyResult.status, 0);
    assert.match(output(legacyResult), /execution_tier is a read-only legacy adapter/);
    assert.doesNotMatch(output(legacyResult), /^PASS/m);
    assert.equal(snapshotTree(legacyDir), legacyBefore);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('strict validator requires numeric IDs, rejects phantom mappings, and grounds research content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-strict-grounding-'));
  try {
    const strictPolicy = POLICY.workflowPolicySnapshot({ riskSignals: { auth: true }, assurance_level: 'Strict' });
    const noIds = createSpec(root, {
      name: 'no-numeric-ids',
      requirements: '# Requirements\n\nThe behavior has no numeric identifier.\n',
      spec: { workflow_policy: strictPolicy },
    });
    const noIdsResult = run(VALIDATOR, [noIds], ROOT);
    assert.notEqual(noIdsResult.status, 0);
    assert.match(output(noIdsResult), /strict workflow requires numeric requirement IDs/);

    const legacyDialect = createSpec(root, {
      name: 'legacy-req-dialect',
      requirements: '# Requirements\n\n## Requirements\n\n### REQ-01: One\n\n- **REQ-01.1** The service shall return one result.\n',
      spec: { workflow_policy: strictPolicy },
    });
    const legacyDialectResult = run(VALIDATOR, [legacyDialect], ROOT);
    assert.notEqual(legacyDialectResult.status, 0);
    assert.match(output(legacyDialectResult), /REQ-01 is not a canonical requirement id/);

    const phantom = createSpec(root, {
      name: 'phantom-mapping',
      task: task({ mapping: '9.1' }),
      spec: { workflow_policy: strictPolicy },
    });
    const phantomResult = run(VALIDATOR, [phantom], ROOT);
    assert.notEqual(phantomResult.status, 0);
    assert.match(output(phantomResult), /references unknown requirement R9/);

    const researchPlaceholder = createSpec(root, {
      name: 'research-placeholder',
      task: task({ related: '`src/strict-only.js` | Read' }),
      design: criticalNoObligationDesign(),
      spec: { workflow_policy: strictPolicy, research: 'research.md' },
    });
    write(path.join(researchPlaceholder, 'research.md'), '# Research\n\n## Evidence Summary\n- TBD\n');
    const placeholderResult = run(VALIDATOR, [researchPlaceholder], ROOT);
    assert.notEqual(placeholderResult.status, 0);
    assert.match(output(placeholderResult), /Evidence Summary must contain concrete evidence/);

    write(path.join(researchPlaceholder, 'research.md'), '# Research\n\n## Evidence Summary\n- Scout inspected `src/one.js` and confirmed the caller path.\n');
    const concreteResult = run(VALIDATOR, [researchPlaceholder], ROOT);
    assert.equal(concreteResult.status, 0, output(concreteResult));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects unsupported or duplicate structured requirement IDs without mining incidental prose', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-requirement-inventory-'));
  try {
    const unsupportedHeading = createSpec(root, {
      name: 'unsupported-heading',
      requirements: '# Requirements\n\n### R1A: One\n\n- **R1.1** The service shall return status value 1.\n',
    });
    let result = run(VALIDATOR, [unsupportedHeading], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /unsupported requirement id R1A/);

    const unsupportedCriterion = createSpec(root, {
      name: 'unsupported-criterion',
      requirements: '# Requirements\n\n### Requirement 1: One\n\n- **R1-1** The service shall return status value 1.\n',
    });
    result = run(VALIDATOR, [unsupportedCriterion], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /unsupported acceptance criterion id R1-1/);

    const duplicates = createSpec(root, {
      name: 'duplicate-inventory',
      requirements: '# Requirements\n\n### Requirement 1: First\n\n- **R1.1** The service shall return status value 1.\n\n' +
        '### R1: Duplicate\n\n- **R1.1** The service shall return status value 2.\n',
    });
    result = run(VALIDATOR, [duplicates], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /duplicate canonical requirement id R1/);
    assert.match(output(result), /duplicate canonical acceptance criterion id R1\.1/);

    const incidental = createSpec(root, {
      name: 'incidental-rfc-adr-and-reference',
      task: task({ related: '`src/one.js` | Read' }),
      requirements: '# Requirements\n\n### Requirement 1: One\n\n' +
        '- **R1.1** The service shall return one deterministic result with status value 1.\n\n' +
        'See RFC 9110, ADR-001, and R7.2 for historical context only.\n',
    });
    result = run(VALIDATOR, [incidental], ROOT);
    assert.equal(result.status, 0, output(result));

    const ignoredSyntax = createSpec(root, {
      name: 'ignored-fenced-and-commented-inventory',
      task: task({ related: '`src/one.js` | Read' }),
      requirements: '# Requirements\n\n### Requirement 1: One\n\n' +
        '- **R1.1** The service shall return one deterministic result with status value 1.\n\n' +
        '<!-- ### Requirement 1: commented duplicate\n- **R1.1** commented duplicate -->\n\n' +
        '```markdown\n### Requirement 1: example duplicate\n- **R1.1** example duplicate\n```\n',
    });
    result = run(VALIDATOR, [ignoredSyntax], ROOT);
    assert.equal(result.status, 0, output(result));

    for (const [name, heading] of [
      ['numeric-heading', '### 1: One'],
      ['bracket-heading', '### [R1]: One'],
    ]) {
      const invalidHeading = createSpec(root, {
        name,
        requirements: `# Requirements\n\n${heading}\n\n- **R1.1** The service shall return status value 1.\n`,
      });
      result = run(VALIDATOR, [invalidHeading], ROOT);
      assert.notEqual(result.status, 0);
      assert.match(output(result), /unsupported requirement id/);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator requires substantive Specs v2 task semantics and planned executable proof', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-task-semantics-'));
  try {
    const invalid = createSpec(root, { name: 'weak-task-semantics' });
    const weakTask = task({ related: '`src/one.js` | Read' })
      .replace('Calling the real fixture entrypoint returns status value 1.', 'TBD')
      .replace('- **In scope:** Implement the mapped observable behavior.', '- **In scope:** TBD')
      .replace('- **Out of scope:** Unrelated runtime behavior.', '- **Out of scope:** N/A')
      .replace('- **R1.1:** Calling `src/one.js` returns an observable result with status value 1.', '- **R1.1:** Works')
      .replace('| A-R1-01-01 | command | `node --test test/one.test.js` |', '| A-R1-01-01 | command | `npm run fixture-check` |')
      .replace('- **Command:** `node --test test/one.test.js`', '- **Command:** run tests')
      .replace('exit code 0 and one assertion for status value 1', 'looks good')
      .replace('invalid input returns a deterministic error result', 'TBD')
      .replace('`src/one.js` is invoked by the focused test', 'TBD');
    writeRaw(path.join(invalid, 'tasks/task-R1-01-one.md'), weakTask);
    const rejected = run(VALIDATOR, [invalid], ROOT);
    assert.notEqual(rejected.status, 0);
    assert.match(output(rejected), /Outcome must be substantive/);
    assert.match(output(rejected), /Verification Plan requires a command-shaped invocation or justified N\/A/);
    assert.match(output(rejected), /Verification Plan requires an observable Expected result/);
    assert.match(output(rejected), /Verification Plan requires a negative-path disposition/);
    assert.match(output(rejected), /Verification Plan requires a concrete reachability target or justified N\/A/);

    const emptyExecution = createSpec(root, {
      name: 'empty-steps-mapping-only-requirements',
      task: task({ related: '`src/empty.js` | Read' })
        .replace(/## Changes\n[\s\S]*?\n## Acceptance/, '## Changes\n\n## Acceptance'),
    });
    const emptyExecutionResult = run(VALIDATOR, [emptyExecution], ROOT);
    assert.notEqual(emptyExecutionResult.status, 0);
    assert.match(output(emptyExecutionResult), /Changes must be substantive|Changes must contain at least one substantive actionable checkbox/);

    const justified = createSpec(root, {
      name: 'justified-command-na',
      task: task({ related: '`src/static-contract.js` | Read' }).replace(
        '- **Command:** `node --test test/one.test.js`',
        '- Command: N/A — no executable runtime exists because this task only inspects a static contract',
      ),
    });
    const accepted = run(VALIDATOR, [justified], ROOT);
    assert.equal(accepted.status, 0, output(accepted));

    const projectSpecific = createSpec(root, {
      name: 'project-specific-command-shape',
      task: task({ related: '`src/project-specific.js` | Read' })
        .replace('node --test test/one.test.js', 'npm run project-specific-check'),
    });
    const projectSpecificResult = run(VALIDATOR, [projectSpecific], ROOT);
    assert.equal(projectSpecificResult.status, 0, output(projectSpecificResult));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('all ready non-Direct specs require semantic design and coherent authoring timestamps', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-ready-lifecycle-'));

  function readyFixture(name, mutate = () => {}) {
    const specDir = createSpec(root, {
      name,
      task: task({ related: '`src/one.js` | Read' }),
      spec: { workflow_policy: POLICY.workflowPolicySnapshot({ riskSignals: {} }) },
    });
    const specPath = path.join(specDir, 'spec.json');
    const state = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    state.ready_for_implementation = true;
    state.validation = { status: 'completed' };
    state.updated_at = '2026-08-11T00:06:00+07:00';
    state.timestamps = lifecycleTimestamps();
    mutate(state, specDir);
    write(specPath, JSON.stringify(state, null, 2));
    completeSemanticReview(specDir);
    return specDir;
  }

  try {
    const critical = readyFixture('critical-generic-design', (state, specDir) => {
      state.workflow_policy = POLICY.workflowPolicySnapshot({ riskSignals: { auth: true }, assurance_level: 'Strict' });
      state.timestamps = lifecycleTimestamps({ research: true });
      write(path.join(specDir, 'design.md'), '# Design\n\n## Architecture\n\nThe implementation boundary is defined and appropriate.\n');
    });
    let result = run(VALIDATOR, [critical], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /design\.md: Critical readiness requires a grounded path\/code identifier/);

    const strictAuthoring = readyFixture('critical-one-task-authoring', (state, specDir) => {
      state.workflow_policy = POLICY.workflowPolicySnapshot({ riskSignals: { auth: true }, assurance_level: 'Strict' });
      state.timestamps = lifecycleTimestamps({ research: true });
      write(path.join(specDir, 'design.md'), criticalNoObligationDesign());
    });
    result = run(VALIDATOR, [strictAuthoring], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /Strict assurance is no longer supported/);

    const invalidCases = [
      ['boolean-created-at', (state) => { state.created_at = true; }, /created_at: must be an ISO 8601 timestamp|created_at: ready handoff requires/],
      ['boolean-task-time', (state) => { state.timestamps.tasks_done = true; }, /timestamps\.tasks_done: must be null or an ISO 8601 timestamp|ready handoff requires/],
      ['missing-validation-time', (state) => { delete state.timestamps.validation_done; }, /timestamps\.validation_done: ready handoff requires/],
      ['reversed-phase-time', (state) => { state.timestamps.design_done = '2026-08-11T00:00:30+07:00'; }, /final lifecycle timestamps must be ordered/],
      ['mismatched-final-state', (state) => { state.updated_at = '2026-08-11T00:07:00+07:00'; }, /updated_at must describe the same final state/],
    ];
    for (const [name, mutate, expected] of invalidCases) {
      const specDir = readyFixture(name, mutate);
      result = run(VALIDATOR, [specDir], ROOT);
      assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
      assert.match(output(result), expected);
    }

    const reviewDir = readyFixture('five-task-review-time', (state, specDir) => {
      state.design_context = { validation_recommended: true };
      for (let index = 2; index <= 5; index += 1) {
        const taskPath = `tasks/task-R1-0${index}-review.md`;
        state.task_files.push(taskPath);
        state.task_registry[taskPath] = {
          id: `R1-0${index}`, title: `Review ${index}`, status: 'pending', dependencies: [], blocker: null,
          started_at: null, completed_at: null, last_updated_at: null,
        };
        write(path.join(specDir, taskPath), task({ id: `R1-0${index}`, related: `\`src/review-${index}.js\` | Read` }));
      }
    });
    result = run(VALIDATOR, [reviewDir], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /timestamps\.review_done: required after validation for a large task graph/);

    const reviewPath = path.join(reviewDir, 'spec.json');
    const reviewState = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
    reviewState.timestamps.review_done = '2026-08-11T00:05:00+07:00';
    write(reviewPath, JSON.stringify(reviewState, null, 2));
    result = run(VALIDATOR, [reviewDir], ROOT);
    assert.equal(result.status, 0, output(result));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('spec-ready excludes execution receipts and refuses Strict as no longer supported', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-spec-ready-'));
  try {
    const standardDir = createSpec(root, {
      name: 'pending-standard',
      task: task({ related: '`src/pending-only.js` | Read' }),
      spec: {
        workflow_policy: POLICY.workflowPolicySnapshot({ riskSignals: {} }),
        ready_for_implementation: true,
        approvals: {
          requirements: { generated: true, agent_validated: true, user_approved: true },
          design: { generated: true, agent_validated: true, user_approved: true },
          tasks: { generated: true, agent_validated: true, user_approved: true },
        },
        validation: { status: 'completed' },
        updated_at: '2026-08-11T00:06:00+07:00',
        timestamps: lifecycleTimestamps(),
      },
    });
    completeSemanticReview(standardDir);
    const standardResult = run(VALIDATOR, [standardDir], ROOT);
    assert.equal(standardResult.status, 0, output(standardResult));

    const criticalDir = createSpec(root, {
      name: 'pending-critical',
      task: task({ related: '`src/pending-only.js` | Read' }),
      design: criticalNoObligationDesign(),
      spec: {
        workflow_policy: POLICY.workflowPolicySnapshot({ riskSignals: { auth: true }, assurance_level: 'Strict' }),
        ready_for_implementation: true,
        approvals: {
          requirements: { generated: true, agent_validated: true, user_approved: true },
          design: { generated: true, agent_validated: true, user_approved: true },
          tasks: { generated: true, agent_validated: true, user_approved: true },
        },
        validation: { status: 'completed' },
        updated_at: '2026-08-11T00:06:00+07:00',
        timestamps: lifecycleTimestamps({ research: true, review: true }),
      },
    });
    completeSemanticReview(criticalDir);
    const criticalResult = run(VALIDATOR, [criticalDir], ROOT);
    assert.notEqual(criticalResult.status, 0);
    assert.match(output(criticalResult), /Strict assurance is no longer supported/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Specs v2 Compact validates without task registry or premature receipt and fails closed on policy shape errors', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-bounded-'));
  try {
    const specDir = createBoundedSpec(root);
    const valid = run(VALIDATOR, [specDir], ROOT);
    assert.equal(valid.status, 0, output(valid));
    const persisted = JSON.parse(fs.readFileSync(path.join(specDir, 'spec.json'), 'utf8'));
    assert.equal(persisted.workflow_policy.artifact_profile, 'bounded');
    assert.equal(Object.hasOwn(persisted, 'task_files'), false);
    assert.equal(Object.hasOwn(persisted, 'task_registry'), false);

    write(path.join(specDir, 'feature-receipt.md'), '# Feature Verification Receipt\n\nVerification: PENDING\n\nStatus: in_progress\n\nBlocker: awaiting execution proof\n');
    const prematureReceipt = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(prematureReceipt.status, 0);
    assert.match(output(prematureReceipt), /premature execution receipt/);
    fs.unlinkSync(path.join(specDir, 'feature-receipt.md'));
    const malformed = JSON.parse(fs.readFileSync(path.join(specDir, 'spec.json'), 'utf8'));
    malformed.workflow_policy.extra = true;
    fs.writeFileSync(path.join(specDir, 'spec.json'), JSON.stringify(malformed, null, 2));
    const malformedResult = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(malformedResult.status, 0);
    assert.match(output(malformedResult), /workflow_policy fields must be exactly/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects missing explicit requirement and sub-criterion mappings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-mapping-'));
  try {
    const specDir = createSpec(root, { task: task({ mapping: '' }) });
    const result = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /R1: not covered|R1\.1: acceptance criterion not covered/);

    const incidental = createSpec(root, {
      name: 'incidental',
      task: task({ mapping: '', file: 'task-R1-01-one.md' }).replace('Update source', 'Update R1 source'),
    });
    const incidentalResult = run(VALIDATOR, [incidental], ROOT);
    assert.notEqual(incidentalResult.status, 0);
    assert.match(output(incidentalResult), /R1: not covered/);

    const partial = createSpec(root, {
      name: 'partial',
      requirements: '# Requirements\n\n### Requirement 1: One\n\n- **R1.1** First.\n- **R1.2** Second.\n',
    });
    const partialResult = run(VALIDATOR, [partial], ROOT);
    assert.notEqual(partialResult.status, 0);
    assert.match(output(partialResult), /R1\.2: acceptance criterion not covered/);

    const standardUnknown = createSpec(root, {
      name: 'standard-unknown-mapping',
      task: task({ mapping: '1.1, 9.1' }),
      spec: { workflow_policy: POLICY.workflowPolicySnapshot({ riskSignals: {} }) },
    });
    const standardUnknownResult = run(VALIDATOR, [standardUnknown], ROOT);
    assert.notEqual(standardUnknownResult.status, 0);
    assert.match(output(standardUnknownResult), /references unknown requirement R9/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('v1 adapter rejects unknown, missing, and divergent contract copies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-contract-'));
  const design = `${designFixture()}<!-- contract:PAYLOAD -->\n\`\`\`json\n{ "id": 1 }\n\`\`\`\n`;
  function contractFixture(name, { designText = design, extra = '' } = {}) {
    return createSpec(root, {
      name,
      design: designText,
      task: legacyTask({ extra }),
      spec: { workflow_policy: legacyWorkflowPolicy() },
    });
  }
  try {
    const unknown = contractFixture('unknown', { extra: 'Contracts: MISSING\n' });
    let result = run(VALIDATOR, [unknown], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /unknown contract "MISSING"/);

    const noCanonical = contractFixture('no-canonical', {
      designText: designFixture(),
      extra: 'Contracts: PAYLOAD\n',
    });
    result = run(VALIDATOR, [noCanonical], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /defines no canonical contract blocks/);

    const missing = contractFixture('missing', { extra: 'Contracts: PAYLOAD\n' });
    result = run(VALIDATOR, [missing], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /contract "PAYLOAD" is missing/);

    const divergent = contractFixture('divergent', {
      extra: 'Contracts: PAYLOAD\n\n```json\n{ "id": 2 }\n```\n',
    });
    result = run(VALIDATOR, [divergent], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /contract "PAYLOAD" body diverges/);

    const duplicateDesign = contractFixture('duplicate-design-contract', {
      designText: `${design}\n<!-- contract:PAYLOAD -->\n\`\`\`json\n{ "id": 1 }\n\`\`\`\n`,
    });
    result = run(VALIDATOR, [duplicateDesign], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /duplicate canonical contract definition "PAYLOAD"/);

    const repeatedDeclaration = contractFixture('repeated-task-contract-line', {
      extra: 'Contracts: PAYLOAD\nContracts: PAYLOAD\n\n```json\n{ "id": 1 }\n```\n',
    });
    result = run(VALIDATOR, [repeatedDeclaration], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /Contracts declaration must appear at most once/);

    const duplicateName = contractFixture('duplicate-task-contract-name', {
      extra: 'Contracts: PAYLOAD, PAYLOAD\n\n```json\n{ "id": 1 }\n```\n',
    });
    result = run(VALIDATOR, [duplicateName], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /Contracts declaration contains duplicate name "PAYLOAD"/);

    const orphanTagged = contractFixture('orphan-tagged-contract', {
      extra: '<!-- contract:PAYLOAD -->\n```json\n{ "id": 1 }\n```\n',
    });
    result = run(VALIDATOR, [orphanTagged], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /must declare it on one Contracts: line/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects invalid ready approval and validation transitions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-state-'));
  try {
    const specDir = createSpec(root, {
      spec: {
        ready_for_implementation: true,
        approvals: { requirements: { generated: false, agent_validated: true, user_approved: true }, design: { generated: true, agent_validated: false, user_approved: true }, tasks: { generated: true, agent_validated: true, user_approved: false } },
        validation: { status: 'not-run' },
      },
    });
    const result = run(VALIDATOR, [specDir], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /requires generated and agent_validated requirements evidence/);
    assert.match(output(result), /requires generated and agent_validated design evidence/);
    assert.match(output(result), /validation evidence is incomplete/);

    // Legacy approved field must fail closed with migration guidance
    const legacyDir = createSpec(root, {
      name: 'legacy',
      spec: {
        schema_version: undefined,
        approvals: { requirements: { generated: true, approved: true }, design: { generated: true, agent_validated: true, user_approved: true }, tasks: { generated: true, agent_validated: true, user_approved: true } },
      },
    });
    // Remove schema_version to simulate legacy
    const legacySpecPath = path.join(legacyDir, 'spec.json');
    const legacySpec = JSON.parse(fs.readFileSync(legacySpecPath, 'utf8'));
    delete legacySpec.schema_version;
    fs.writeFileSync(legacySpecPath, JSON.stringify(legacySpec, null, 2));
    const legacyResult = run(VALIDATOR, [legacyDir], ROOT);
    assert.notEqual(legacyResult.status, 0);
    assert.match(output(legacyResult), /Legacy approval field "approved"/);

    // Unsupported schema_version must fail closed
    const unsupportedDir = createSpec(root, {
      name: 'unsupported',
      spec: { schema_version: '9.9' },
    });
    const unsupportedResult = run(VALIDATOR, [unsupportedDir], ROOT);
    assert.notEqual(unsupportedResult.status, 0);
    assert.match(output(unsupportedResult), /unsupported "9\.9"/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects precise square-bracket placeholders without flagging links or checkboxes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-square-placeholders-'));
  try {
    for (const [name, placeholder] of [
      ['specific-value', '[specific value]'],
      ['target-users', '[target users]'],
      ['component-name', '[Component Name]'],
    ]) {
      const specDir = createSpec(root, {
        name,
        task: task({ related: '`src/placeholder.js` | Read' }).replace(
          'Implement the mapped observable behavior.',
          `Implement the mapped ${placeholder} behavior.`,
        ),
      });
      const result = run(VALIDATOR, [specDir], ROOT);
      assert.notEqual(result.status, 0);
      assert.match(output(result), /unresolved square-bracket placeholder/);
    }

    const safe = createSpec(root, {
      name: 'safe-link-checkbox',
      task: `${task({ related: '`src/safe.js` | Read' })}\n[Component Name](https://example.invalid)\n- [ ] Keep this real checkbox.\n`,
    });
    const safeResult = run(VALIDATOR, [safe], ROOT);
    assert.equal(safeResult.status, 0, output(safeResult));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects malformed Related Files and dependency topology', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-shape-'));
  try {
    for (const [name, related, expected] of [
      ['empty', '', /Related Files section must not be empty/],
      ['action', '`src/one.js` | Rename', /unsupported Related Files action/],
      ['absolute', '`\/tmp\/one.js` | Modify', /must be relative/],
      ['traversal', '`..\/one.js` | Modify', /must be relative/],
    ]) {
      const specDir = createSpec(root, {
        name,
        task: legacyTask({ relatedRows: related ? `| ${related} | Invalid fixture row |` : '' }),
        spec: { workflow_policy: legacyWorkflowPolicy() },
      });
      const result = run(VALIDATOR, [specDir], ROOT);
      assert.notEqual(result.status, 0);
      assert.match(output(result), expected);
    }

    const cycle = createSpec(root, { name: 'cycle' });
    const statePath = path.join(cycle, 'spec.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.coordination.task_triggers = ['distinct_ownership', 'real_dependency'];
    state.task_files.push('tasks/task-R1-02-two.md');
    state.task_registry['tasks/task-R1-01-one.md'].dependencies = ['tasks/task-R1-02-two.md'];
    state.task_registry['tasks/task-R1-02-two.md'] = { id: 'R1-02', title: 'Two', status: 'pending', dependencies: ['tasks/task-R1-01-one.md'], blocker: null, started_at: null, completed_at: null, last_updated_at: null };
    write(path.join(cycle, 'tasks/task-R1-01-one.md'), task({
      related: '`src/one.js` | Read',
      dependencies: 'tasks/task-R1-02-two.md',
    }));
    write(path.join(cycle, 'tasks/task-R1-02-two.md'), task({
      id: 'R1-02',
      related: '`src/two.js` | Read',
      dependencies: 'tasks/task-R1-01-one.md',
    }));
    write(statePath, JSON.stringify(state, null, 2));
    const cycleResult = run(VALIDATOR, [cycle], ROOT);
    assert.notEqual(cycleResult.status, 0);
    assert.match(output(cycleResult), /dependency cycle detected/);

    const ordering = createSpec(root, {
      name: 'ordering',
      task: task({ related: '`src/generated.js` | Create' }),
    });
    const orderingStatePath = path.join(ordering, 'spec.json');
    const orderingState = JSON.parse(fs.readFileSync(orderingStatePath, 'utf8'));
    orderingState.task_files.push('tasks/task-R1-02-two.md');
    orderingState.task_registry['tasks/task-R1-02-two.md'] = { id: 'R1-02', title: 'Two', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null };
    write(path.join(ordering, 'tasks/task-R1-02-two.md'), task({
      id: 'R1-02',
      related: '`src/generated.js` | Modify',
      relatedRows: '| `src/generated.js` | Modify | Consume generated implementation |',
    }));
    write(orderingStatePath, JSON.stringify(orderingState, null, 2));
    const orderingResult = run(VALIDATOR, [ordering], ROOT);
    assert.notEqual(orderingResult.status, 0);
    assert.match(output(orderingResult), /must depend on creator/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('task-level (P) requires dependency-free and non-overlapping task ownership', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-parallel-'));
  const ownerPath = 'tasks/task-R1-01-one.md';
  const siblingPath = 'tasks/task-R1-02-two.md';

  function parallelFixture(name, { dependency = false, overlap = false } = {}) {
    const ownerTask = task({
      related: overlap ? '`src/shared.js` | Read' : '`src/parallel-a.js` | Read',
      relatedRows: overlap
        ? '| `src/shared.js` | Read | Inspect existing |\n| `src/shared.js` | Modify | Update owned behavior |'
        : null,
      parallel: true,
    });
    const specDir = createSpec(root, { name, task: ownerTask });
    const statePath = path.join(specDir, 'spec.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.coordination.task_triggers = dependency
      ? ['parallel_coordination', 'real_dependency', 'separate_proof']
      : ['parallel_coordination', 'separate_proof'];
    state.task_files.push(siblingPath);
    state.task_registry[siblingPath] = {
      id: 'R1-02', title: 'Two', status: 'pending',
      dependencies: dependency ? [ownerPath] : [],
      blocker: null, started_at: null, completed_at: null, last_updated_at: null,
    };
    const sibling = task({
      id: 'R1-02',
      related: overlap ? '`src/shared.js` | Read' : '`src/parallel-b.js` | Read',
      dependencies: dependency ? ownerPath : 'none',
      parallel: dependency,
    });
    write(path.join(specDir, siblingPath), sibling);
    write(statePath, JSON.stringify(state, null, 2));
    return specDir;
  }

  try {
    const valid = parallelFixture('parallel-valid');
    assert.equal(run(VALIDATOR, [valid], ROOT).status, 0);

    const dependency = parallelFixture('parallel-dependency', { dependency: true });
    const dependencyResult = run(VALIDATOR, [dependency], ROOT);
    assert.notEqual(dependencyResult.status, 0);
    assert.match(output(dependencyResult), /task-level \(P\) cannot declare sibling dependencies/);

    const overlap = parallelFixture('parallel-overlap', { overlap: true });
    const overlapResult = run(VALIDATOR, [overlap], ROOT);
    assert.notEqual(overlapResult.status, 0);
    assert.match(output(overlapResult), /task-level \(P\) has Related Files contention on src\/shared\.js/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects dependency drift and non-canonical readiness statuses', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-readiness-'));
  const ownerPath = 'tasks/task-R1-01-one.md';
  const consumerPath = 'tasks/task-R1-02-two.md';
  try {
    const driftDir = createSpec(root, {
      name: 'dependency-aligned',
      task: task({ related: '`src/owner.js` | Read' }),
    });
    const driftStatePath = path.join(driftDir, 'spec.json');
    const driftState = JSON.parse(fs.readFileSync(driftStatePath, 'utf8'));
    driftState.coordination.task_triggers = ['real_dependency', 'separate_proof'];
    driftState.task_files.push(consumerPath);
    driftState.task_registry[consumerPath] = {
      id: 'R1-02', title: 'Two', status: 'pending', dependencies: [ownerPath], blocker: null,
      started_at: null, completed_at: null, last_updated_at: null,
    };
    write(
      path.join(driftDir, consumerPath),
      task({
        id: 'R1-02',
        related: '`src/consumer.js` | Read',
        dependencies: ownerPath,
      }),
    );
    write(driftStatePath, JSON.stringify(driftState, null, 2));
    const aligned = run(VALIDATOR, [driftDir], ROOT);
    assert.equal(aligned.status, 0, output(aligned));

    const consumerFile = path.join(driftDir, consumerPath);
    write(
      consumerFile,
      fs.readFileSync(consumerFile, 'utf8').replace(
        `- ${ownerPath}\n\n## Verification Plan`,
        '- none\n\n## Verification Plan',
      ),
    );
    const drifted = run(VALIDATOR, [driftDir], ROOT);
    assert.notEqual(drifted.status, 0);
    assert.match(output(drifted), /dependency drift between spec\.json task_registry/);

    const duplicateHeader = createSpec(root, {
      name: 'duplicate-dependency-section',
      task: `${task({ related: '`src/duplicate.js` | Read' })}\n## Dependencies\n\n- none\n`,
    });
    const duplicateHeaderResult = run(VALIDATOR, [duplicateHeader], ROOT);
    assert.notEqual(duplicateHeaderResult.status, 0);
    assert.match(output(duplicateHeaderResult), /machine-read section Dependencies.*must appear at most once/);

    const duplicateSections = createSpec(root, {
      name: 'duplicate-machine-sections',
      task: `${task({ related: '`src/duplicate-sections.js` | Read' })}\n` +
        '## Verification Plan\n- **Command:** `npm test`\n\n' +
        '## Acceptance\n- **R1.1:** conflicting duplicate mapping\n',
    });
    const duplicateSectionsResult = run(VALIDATOR, [duplicateSections], ROOT);
    assert.notEqual(duplicateSectionsResult.status, 0);
    assert.match(output(duplicateSectionsResult), /machine-read section Verification Plan.*must appear at most once/);
    assert.match(output(duplicateSectionsResult), /machine-read section Acceptance.*must appear at most once/);

    const ordinary = createSpec(root, {
      name: 'ordinary-in-progress',
      task: task({ related: '`src/ordinary.js` | Read', status: 'in_progress' }),
      spec: {
        task_registry: {
          [ownerPath]: {
            id: 'R1-01', title: 'One', status: 'in_progress', dependencies: [], blocker: null,
            started_at: '2026-08-12T00:00:00+07:00', completed_at: null,
            last_updated_at: '2026-08-12T00:01:00+07:00',
            artifacts: ['test/one.test.js'],
          },
        },
      },
    });
    const ordinaryResult = run(VALIDATOR, [ordinary], ROOT);
    assert.equal(ordinaryResult.status, 0, output(ordinaryResult));

    const ordinaryStatePath = path.join(ordinary, 'spec.json');
    const ordinaryState = JSON.parse(fs.readFileSync(ordinaryStatePath, 'utf8'));
    const ordinaryTaskPath = path.join(ordinary, ownerPath);
    write(
      ordinaryTaskPath,
      fs.readFileSync(ordinaryTaskPath, 'utf8')
        .replace(/\n## Dependencies\n[\s\S]*?(?=\n## Verification Plan)/, ''),
    );
    ordinaryState.ready_for_implementation = true;
    ordinaryState.validation = { status: 'completed' };
    ordinaryState.timestamps = { validation_done: '2026-08-12T00:00:00+07:00' };
    write(ordinaryStatePath, JSON.stringify(ordinaryState, null, 2));
    const readyWithoutHeader = run(VALIDATOR, [ordinary], ROOT);
    assert.notEqual(readyWithoutHeader.status, 0);
    assert.match(output(readyWithoutHeader), /missing Dependencies/);

    const invalidCases = [
      ['bad-ready-type', (state) => { state.ready_for_implementation = 'true'; }, /ready_for_implementation: must be a boolean/],
      ['bad-spec-status', (state) => { state.status = 'ready'; }, /spec\.json\.status: must be one of/],
      ['bad-task-status', (state) => { state.task_registry[ownerPath].status = 'ready'; }, /task_registry.*status: must be one of/],
      ['bad-validation-shape', (state) => { state.validation = 'not-run'; }, /validation: must be an object/],
      [
        'registry-id-path-drift',
        (state) => { state.task_registry[ownerPath].id = 'R9-99'; },
        /task_registry id must match path-derived id R1-01/,
      ],
      [
        'markdown-heading-id-drift',
        (_state, specDir) => {
          const taskFile = path.join(specDir, ownerPath);
          write(taskFile, fs.readFileSync(taskFile, 'utf8').replace('# Task R1-01:', '# Task R9-99:'));
        },
        /Markdown heading id R9-99 must match path-derived id R1-01/,
      ],
      [
        'registry-markdown-status-drift',
        (state) => {
          state.task_registry[ownerPath].status = 'done';
          state.task_registry[ownerPath].started_at = '2026-08-12T00:00:00+07:00';
          state.task_registry[ownerPath].completed_at = '2026-08-12T00:01:00+07:00';
          state.task_registry[ownerPath].last_updated_at = '2026-08-12T00:01:00+07:00';
        },
        /status drift between spec\.json task_registry done and Markdown Status header pending/,
      ],
      [
        'done-missing-lifecycle-timestamps',
        (state, specDir) => {
          state.task_registry[ownerPath].status = 'done';
          const taskFile = path.join(specDir, ownerPath);
          write(taskFile, fs.readFileSync(taskFile, 'utf8').replace('**Status:** pending', '**Status:** done'));
        },
        /done status requires started_at, completed_at, and last_updated_at timestamps/,
      ],
      [
        'blocked-missing-blocker',
        (state, specDir) => {
          state.task_registry[ownerPath].status = 'blocked';
          state.task_registry[ownerPath].last_updated_at = '2026-08-12T00:01:00+07:00';
          const taskFile = path.join(specDir, ownerPath);
          write(taskFile, fs.readFileSync(taskFile, 'utf8').replace('**Status:** pending', '**Status:** blocked'));
        },
        /blocked status requires a non-empty blocker/,
      ],
      [
        'in-progress-with-blocker',
        (state, specDir) => {
          state.task_registry[ownerPath].status = 'in_progress';
          state.task_registry[ownerPath].blocker = 'waiting on owner';
          state.task_registry[ownerPath].started_at = '2026-08-12T00:00:00+07:00';
          state.task_registry[ownerPath].last_updated_at = '2026-08-12T00:01:00+07:00';
          const taskFile = path.join(specDir, ownerPath);
          write(taskFile, fs.readFileSync(taskFile, 'utf8').replace('**Status:** pending', '**Status:** in_progress'));
        },
        /in_progress status requires blocker null/,
      ],
      [
        'in-progress-reversed-timestamps',
        (state, specDir) => {
          state.task_registry[ownerPath].status = 'in_progress';
          state.task_registry[ownerPath].started_at = '2026-08-12T00:02:00+07:00';
          state.task_registry[ownerPath].last_updated_at = '2026-08-12T00:01:00+07:00';
          const taskFile = path.join(specDir, ownerPath);
          write(taskFile, fs.readFileSync(taskFile, 'utf8').replace('**Status:** pending', '**Status:** in_progress'));
        },
        /in_progress timestamps must satisfy started_at <= last_updated_at/,
      ],
      [
        'started-blocked-reversed-timestamps',
        (state, specDir) => {
          state.task_registry[ownerPath].status = 'blocked';
          state.task_registry[ownerPath].blocker = 'waiting for the declared external authority';
          state.task_registry[ownerPath].started_at = '2026-08-12T00:02:00+07:00';
          state.task_registry[ownerPath].last_updated_at = '2026-08-12T00:01:00+07:00';
          const taskFile = path.join(specDir, ownerPath);
          write(taskFile, fs.readFileSync(taskFile, 'utf8').replace('**Status:** pending', '**Status:** blocked'));
        },
        /started blocked timestamps must satisfy started_at <= last_updated_at/,
      ],
      [
        'bad-validation-status',
        (state) => {
          state.ready_for_implementation = true;
          state.validation = { status: 'ready' };
          state.timestamps = { validation_done: '2026-08-12T00:00:00+07:00' };
        },
        /validation\.status: must be one of|requires validation\.status completed/,
      ],
      [
        'blocked-ready',
        (state, specDir) => {
          state.ready_for_implementation = true;
          state.status = 'blocked';
          state.blocker = 'owner unavailable';
          state.validation = { status: 'completed' };
          state.timestamps = { validation_done: '2026-08-12T00:00:00+07:00' };
          state.task_registry[ownerPath].status = 'blocked';
          const taskFile = path.join(specDir, ownerPath);
          write(taskFile, fs.readFileSync(taskFile, 'utf8').replace('**Status:** pending', '**Status:** blocked'));
        },
        /cannot be blocked while ready_for_implementation is true/,
      ],
    ];
    for (const [name, mutate, expected] of invalidCases) {
      const specDir = createSpec(root, {
        name,
        task: task({ related: '`src/status.js` | Read' }),
      });
      const specPath = path.join(specDir, 'spec.json');
      const state = JSON.parse(fs.readFileSync(specPath, 'utf8'));
      mutate(state, specDir);
      write(specPath, JSON.stringify(state, null, 2));
      const result = run(VALIDATOR, [specDir], ROOT);
      assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
      assert.match(output(result), expected);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('v1 Critical implementation obligations validate ownership, references, closure, and proof', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-obligations-'));
  const ownerPath = 'tasks/task-R1-01-one.md';
  const consumerPath = 'tasks/task-R1-02-two.md';
  const criticalPolicy = legacyWorkflowPolicy('Critical');

  function makeFixture(name, mutate = () => {}, policy = criticalPolicy) {
    const obligation = {
      id: 'canonical-transition',
      requirements: ['R1.1'],
      canonical_state: 'Persisted transition state and allowed values',
      authority: 'Owner module is the sole transition authority',
      recovery: 'Retry reconciles the persisted state before continuing',
      owner_task: ownerPath,
      consumer_tasks: [consumerPath],
      verification: 'node --test focused.test.js',
      evidence: 'Exit 0 and the declared state transition is observed',
    };
    const specDir = createSpec(root, {
      name,
      task: task({ related: '`src/owner.js` | Read' }),
      spec: { workflow_policy: policy },
    });
    const specPath = path.join(specDir, 'spec.json');
    write(path.join(specDir, 'research.md'), '# Research\n\n## Evidence Summary\n\n- The auth-risk fixture requires independent grounding before implementation.\n');
    const state = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    state.task_files.push(consumerPath);
    state.task_registry[consumerPath] = {
      id: 'R1-02', title: 'Two', status: 'pending', dependencies: [ownerPath], blocker: null,
      started_at: null, completed_at: null, last_updated_at: null,
    };
    write(
      path.join(specDir, consumerPath),
      task({
        id: 'R1-02',
        related: '`src/consumer.js` | Read',
        dependencies: ownerPath,
        extra: executionClosure(obligation),
      })
        .replace('# Task R1-01: One', '# Task R1-02: Two'),
    );
    const ownerFile = path.join(specDir, ownerPath);
    write(
      ownerFile,
      `${fs.readFileSync(ownerFile, 'utf8')}${executionClosure(obligation)}`,
    );
    const designFile = path.join(specDir, 'design.md');
    write(
      designFile,
      `${fs.readFileSync(designFile, 'utf8')}${executionClosure(obligation)}`,
    );
    state.implementation_obligations = [obligation];
    mutate(state, specDir);
    write(specPath, JSON.stringify(state, null, 2));
    return specDir;
  }

  try {
    const omitted = createSpec(root, {
      name: 'critical-omitted-obligation-decision',
      spec: { workflow_policy: criticalPolicy },
    });
    write(path.join(omitted, 'research.md'), '# Research\n\n## Evidence Summary\n\n- The auth-risk fixture requires independent grounding before implementation.\n');
    const omittedResult = run(VALIDATOR, [omitted], ROOT);
    assert.notEqual(omittedResult.status, 0);
    assert.match(output(omittedResult), /Critical scope must declare non-empty.*or one justified N\/A/);

    const valid = makeFixture('valid-obligation');
    const validResult = run(VALIDATOR, [valid], ROOT);
    assert.equal(validResult.status, 0, output(validResult));

    const tableClosure = makeFixture('valid-table-closure', (state, specDir) => {
      const designFile = path.join(specDir, 'design.md');
      const designPrefix = fs.readFileSync(designFile, 'utf8').split('\n## Execution Closure\n')[0];
      write(designFile, `${designPrefix}${executionClosureTable(state.implementation_obligations[0])}`);
    });
    const tableClosureResult = run(VALIDATOR, [tableClosure], ROOT);
    assert.equal(tableClosureResult.status, 0, output(tableClosureResult));

    const swapped = makeFixture('marker-local-swapped-obligations', (state, specDir) => {
      const first = state.implementation_obligations[0];
      const second = {
        ...first,
        id: 'secondary-transition',
        canonical_state: 'Secondary persisted state and terminal values',
        authority: 'Secondary module is the sole transition authority',
        recovery: 'Restart rolls the secondary state back before retry',
        verification: 'node --test secondary-focused.test.js',
        evidence: 'Exit 0 and the secondary persisted transition is observed',
      };
      state.implementation_obligations.push(second);
      for (const taskFile of [ownerPath, consumerPath]) {
        const filePath = path.join(specDir, taskFile);
        write(filePath, `${fs.readFileSync(filePath, 'utf8')}\n${obligationClosureBlock(second)}`);
      }
      const designFile = path.join(specDir, 'design.md');
      const designPrefix = fs.readFileSync(designFile, 'utf8').split('\n## Execution Closure\n')[0];
      const firstWithSecondValues = { ...second, id: first.id };
      const secondWithFirstValues = { ...first, id: second.id };
      write(
        designFile,
        `${designPrefix}\n## Execution Closure\n\n` +
          `${obligationClosureBlock(firstWithSecondValues)}\n${obligationClosureBlock(secondWithFirstValues)}`,
      );
    });
    const swappedResult = run(VALIDATOR, [swapped], ROOT);
    assert.notEqual(swappedResult.status, 0);
    assert.match(output(swappedResult), /marker-local field/);

    const cases = [
      [
        'standard-only-rejected',
        () => {},
        legacyWorkflowPolicy(),
        /allowed only for Critical workflow policy/,
      ],
      [
        'owner-must-be-one-task',
        (state) => { state.implementation_obligations[0].owner_task = [ownerPath]; },
        criticalPolicy,
        /owner_task: must name exactly one registered task/,
      ],
      [
        'unknown-requirement',
        (state) => { state.implementation_obligations[0].requirements = ['R9.1']; },
        criticalPolicy,
        /unknown requirement reference R9\.1/,
      ],
      [
        'unknown-consumer',
        (state) => { state.implementation_obligations[0].consumer_tasks = ['tasks/task-R1-99-missing.md']; },
        criticalPolicy,
        /unknown task reference tasks\/task-R1-99-missing\.md/,
      ],
      [
        'missing-dependency-closure',
        (state, specDir) => {
          state.task_registry[consumerPath].dependencies = [];
          const taskFile = path.join(specDir, consumerPath);
          write(
            taskFile,
            fs.readFileSync(taskFile, 'utf8').replace(
              `- ${ownerPath}\n\n## Verification Plan`,
              '- none\n\n## Verification Plan',
            ),
          );
        },
        criticalPolicy,
        /must depend on owner tasks\/task-R1-01-one\.md/,
      ],
      [
        'missing-proof',
        (state) => {
          state.implementation_obligations[0].verification = 'TBD';
          state.implementation_obligations[0].evidence = 'PENDING';
        },
        criticalPolicy,
        /verification: must be an executable command|evidence: must name an observable result/,
      ],
      [
        'missing-state-authority-recovery',
        (state) => {
          delete state.implementation_obligations[0].canonical_state;
          state.implementation_obligations[0].authority = 'authority';
          state.implementation_obligations[0].recovery = 'recovery';
        },
        criticalPolicy,
        /canonical_state: must be concrete|authority: must be concrete|recovery: must be concrete/,
      ],
      [
        'missing-design-correspondence',
        (_state, specDir) => {
          const designFile = path.join(specDir, 'design.md');
          write(
            designFile,
            fs.readFileSync(designFile, 'utf8').replace(
              '\n<!-- implementation-obligation:canonical-transition -->\n',
              '\n',
            ),
          );
        },
        criticalPolicy,
        /design\.md: missing implementation obligation marker canonical-transition/,
      ],
      [
        'missing-owner-correspondence',
        (_state, specDir) => {
          const ownerFile = path.join(specDir, ownerPath);
          write(
            ownerFile,
            fs.readFileSync(ownerFile, 'utf8').replace(
              '\n<!-- implementation-obligation:canonical-transition -->\n',
              '\n',
            ),
          );
        },
        criticalPolicy,
        /task-R1-01-one\.md: missing implementation obligation marker canonical-transition/,
      ],
      [
        'marker-outside-execution-closure',
        (_state, specDir) => {
          const designFile = path.join(specDir, 'design.md');
          const body = fs.readFileSync(designFile, 'utf8')
            .replace('\n<!-- implementation-obligation:canonical-transition -->\n', '\n');
          write(designFile, `${body}\n## Outside Closure\n\n<!-- implementation-obligation:canonical-transition -->\n`);
        },
        criticalPolicy,
        /implementation obligation marker canonical-transition must be inside Execution Closure/,
      ],
      [
        'duplicate-closure-marker',
        (_state, specDir) => {
          const designFile = path.join(specDir, 'design.md');
          write(
            designFile,
            fs.readFileSync(designFile, 'utf8').replace(
              '<!-- implementation-obligation:canonical-transition -->',
              '<!-- implementation-obligation:canonical-transition -->\n<!-- implementation-obligation:canonical-transition -->',
            ),
          );
        },
        criticalPolicy,
        /duplicate implementation obligation marker canonical-transition/,
      ],
      [
        'duplicate-execution-closure',
        (_state, specDir) => {
          const designFile = path.join(specDir, 'design.md');
          write(designFile, `${fs.readFileSync(designFile, 'utf8')}\n## Execution Closure\n\nNo duplicate allowed.\n`);
        },
        criticalPolicy,
        /implementation obligation markers require exactly one Execution Closure section/,
      ],
      [
        'closure-json-drift',
        (_state, specDir) => {
          const ownerFile = path.join(specDir, ownerPath);
          write(
            ownerFile,
            fs.readFileSync(ownerFile, 'utf8').replace(
              'Persisted transition state and allowed values',
              'A divergent local transition description',
            ),
          );
        },
        criticalPolicy,
        /task-R1-01-one\.md: Execution Closure for canonical-transition must mirror spec\.json canonical_state/,
      ],
      [
        'closure-requirements-drift',
        (_state, specDir) => {
          const designFile = path.join(specDir, 'design.md');
          write(
            designFile,
            fs.readFileSync(designFile, 'utf8').replace('- Requirements: R1.1', '- Requirements: R9.1'),
          );
        },
        criticalPolicy,
        /design\.md: Execution Closure for canonical-transition must mirror spec\.json requirements/,
      ],
      [
        'duplicate-obligation-id',
        (state) => {
          state.implementation_obligations.push({ ...state.implementation_obligations[0] });
        },
        criticalPolicy,
        /duplicate obligation id canonical-transition/,
      ],
      [
        'whitespace-obligation-id',
        (state) => { state.implementation_obligations[0].id = ' canonical-transition '; },
        criticalPolicy,
        /must be lowercase without surrounding whitespace/,
      ],
    ];
    for (const [name, mutate, policy, expected] of cases) {
      const specDir = makeFixture(name, mutate, policy);
      const result = run(VALIDATOR, [specDir], ROOT);
      assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
      assert.match(output(result), expected);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('grounding rejects empty sections, unsafe paths, unsupported actions, and zero-match globs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-grounding-'));
  try {
    write(path.join(root, 'src/one.js'), 'source\n');
    const cases = [
      ['empty', '# Task\n\n## Related Files\n\n## Completion Criteria\n', /Related Files section must not be empty/],
      ['action', task({ related: '`src/one.js` | Rename' }), /unsupported Related Files action/],
      ['absolute', task({ related: '`\/tmp\/one.js` | Read' }), /must be relative/],
      ['traversal', task({ related: '`..\/one.js` | Read' }), /must be relative/],
      ['glob', task({ related: '`src\/missing-*.js` | Read' }), /glob matches no paths/],
    ];
    for (const [name, content, expected] of cases) {
      const specDir = path.join(root, name);
      write(path.join(specDir, 'tasks/task-R1-01-one.md'), content);
      const result = run(GROUNDING, [specDir, '--root', root], ROOT);
      assert.notEqual(result.status, 0);
      assert.match(output(result), expected);
    }

    const valid = path.join(root, 'valid');
    write(path.join(valid, 'tasks/task-R1-01-one.md'), task({ related: '`src/*.js` | Read' }));
    const result = run(GROUNDING, [valid, '--root', root], ROOT);
    assert.equal(result.status, 0, output(result));
    assert.match(result.stdout, /GROUNDED/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator enforces Read before Modify for existing implementation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-lifecycle-'));
  try {
    // Existing file Modify without preceding Read must fail
    const missingRead = createSpec(root, {
      name: 'missing-read',
      task: task({
        related: '`src/existing.js` | Modify',
        relatedRows: '| `src/existing.js` | Modify | Update existing implementation |',
      }),
    });
    const missingResult = run(VALIDATOR, [missingRead], ROOT);
    assert.notEqual(missingResult.status, 0);
    assert.match(output(missingResult), /has no preceding Read/);

    // Same path with Read in same task earlier row should pass
    const withReadSameTask = createSpec(root, {
      name: 'with-read-same',
      task: task({ related: '`src/existing.js` | Modify' }),
    });
    const sameResult = run(VALIDATOR, [withReadSameTask], ROOT);
    assert.equal(sameResult.status, 0, output(sameResult));

    // Modify should fail if Read is only in unrelated task without dependency
    const depRead = createSpec(root, { name: 'dep-read' });
    const depStatePath = path.join(depRead, 'spec.json');
    const depState = JSON.parse(fs.readFileSync(depStatePath, 'utf8'));
    depState.task_files.push('tasks/task-R1-02-two.md');
    depState.task_registry['tasks/task-R1-02-two.md'] = { id: 'R1-02', title: 'Two', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null };
    // Task 1 has Read, Task 2 modifies without depending
    write(path.join(depRead, 'tasks/task-R1-01-one.md'), task({ related: '`src/existing.js` | Read' }));
    write(path.join(depRead, 'tasks/task-R1-02-two.md'), task({
      id: 'R1-02',
      related: '`src/existing.js` | Modify',
      relatedRows: '| `src/existing.js` | Modify | Update existing implementation |',
      dependencies: 'tasks/task-R1-01-one.md',
    }));
    write(depStatePath, JSON.stringify(depState, null, 2));
    const depMissingResult = run(VALIDATOR, [depRead], ROOT);
    assert.notEqual(depMissingResult.status, 0);
    assert.match(output(depMissingResult), /has no preceding Read/);

    // If Modify task depends on Read task, should pass
    depState.task_registry['tasks/task-R1-02-two.md'].dependencies = ['tasks/task-R1-01-one.md'];
    depState.coordination.task_triggers = ['real_dependency', 'separate_proof'];
    write(depStatePath, JSON.stringify(depState, null, 2));
    const depPass = run(VALIDATOR, [depRead], ROOT);
    assert.equal(depPass.status, 0, output(depPass));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects reachability without concrete anchor and accepts with path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-reachability-'));
  try {
    const noAnchor = createSpec(root, {
      name: 'no-anchor',
      task: task({ related: '`src/one.js` | Modify' }).replace('Runtime reachability verification\n  - Entrypoint/caller: src/one.js', 'Runtime reachability verification\n  - Some vague phrase'),
    });
    // Add a Read to avoid lifecycle error, so we can isolate reachability check
    const noAnchorContent = fs.readFileSync(path.join(noAnchor, 'tasks/task-R1-01-one.md'), 'utf8')
      .replace('`src/one.js` | Modify', '`src/one.js` | Read\n| `src/one.js` | Modify');
    // Keep lifecycle satisfied: Read before Modify in same task
    write(path.join(noAnchor, 'tasks/task-R1-01-one.md'), noAnchorContent.replace('Some vague phrase', 'Runtime reachability verification'));
    // Actually construct valid task with missing concrete anchor explicitly
    write(path.join(noAnchor, 'tasks/task-R1-01-one.md'), `# Task R1-01: One\n\n## Context\n- X\n\n## Constraints\n- Y\n\n## Steps\n- [ ] Update\n  - _Requirements: 1.1_\n\n## Requirements\n- 1.1 — One\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/one.js\` | Read | Inspect |\n| \`src/one.js\` | Modify | Update |\n\n## Completion Criteria\n- [ ] Works\n\n## Evidence\n- Runtime reachability verification\n  - Note: verified somehow\n\n## Risk Assessment\n| Risk | Severity | Mitigation |\n|---|---|---|\n| None | Low | Tests |\n`);
    const noAnchorResult = run(VALIDATOR, [noAnchor], ROOT);
    assert.notEqual(noAnchorResult.status, 0);
    assert.match(output(noAnchorResult), /Runtime reachability verification must reference a concrete file path/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator keeps contract blocks opt-in regardless of task count', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-contract-closed-'));
  try {
    const specDir = createSpec(root, { name: 'five-no-contract' });
    const statePath = path.join(specDir, 'spec.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.design_context = { validation_recommended: true };
    for (let i = 2; i <= 5; i += 1) {
      const taskFile = `tasks/task-R1-0${i}-extra.md`;
      state.task_files.push(taskFile);
      state.task_registry[taskFile] = { id: `R1-0${i}`, title: `Extra ${i}`, status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null };
      write(path.join(specDir, taskFile), task({
        id: `R1-0${i}`,
        related: '`src/extra.js` | Modify',
        mapping: '1.1',
      }));
    }
    // Need to ensure each extra task has Read before Modify to avoid lifecycle error
    for (let i = 2; i <= 5; i += 1) {
      const p = path.join(specDir, `tasks/task-R1-0${i}-extra.md`);
      const c = fs.readFileSync(p, 'utf8').replace('`src/extra.js` | Modify', '`src/extra.js` | Read\n| `src/extra.js` | Modify');
      const updated = c.replace('Entrypoint/caller: src/one.js', 'Entrypoint/caller: src/extra.js');
      write(p, updated);
    }
    // Also fix first task to have Read
    const first = fs.readFileSync(path.join(specDir, 'tasks/task-R1-01-one.md'), 'utf8').replace('`src/one.js` | Modify', '`src/one.js` | Read\n| `src/one.js` | Modify');
    write(path.join(specDir, 'tasks/task-R1-01-one.md'), first);
    write(statePath, JSON.stringify(state, null, 2));
    const result = run(VALIDATOR, [specDir], ROOT);
    assert.equal(result.status, 0, output(result));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('grounding treats Create on existing file as error', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-grounding-create-existing-'));
  try {
    write(path.join(root, 'src/existing.js'), 'existing\n');
    const specDir = path.join(root, 'spec-create-existing');
    write(path.join(specDir, 'tasks/task-R1-01-one.md'), task({ related: '`src/existing.js` | Create' }));
    const result = run(GROUNDING, [specDir, '--root', root], ROOT);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /Create path already exists/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator scopes requirement mapping to structured section, incidental mention does not cover', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-scope-'));
  try {
    // Task mentions R1 in Context but has no structured _Requirements mapping — should fail
    const incidentalOnly = createSpec(root, {
      name: 'incidental-scope',
      task: `# Task R1-01: One\n\n## Context\nMention R1 and Requirement 1 incidental.\n\n## Constraints\n- Keep\n\n## Steps\n- [ ] Do work\n\n## Requirements\n- 1.1 — One\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/one.js\` | Read | Inspect |\n| \`src/one.js\` | Modify | Update |\n\n## Completion Criteria\n- [ ] Works\n\n## Evidence\n- Runtime reachability verification\n  - Entrypoint/caller: src/one.js\n\n## Risk Assessment\n| Risk | Severity | Mitigation |\n|---|---|---|\n| None | Low | Tests |\n`,
    });
    const res = run(VALIDATOR, [incidentalOnly], ROOT);
    assert.notEqual(res.status, 0);
    assert.match(output(res), /R1: not covered/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validator enforces Create before Read/Modify/Delete within same task and cross-task dependencies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-validator-create-order-'));
  try {
    // Same-task: Create after Read must fail (dead-code regression)
    const createAfterRead = createSpec(root, {
      name: 'create-after-read',
      task: task({
        related: '`src/new.js` | Read',
        relatedRows: '| `src/new.js` | Read | Read before create |\n| `src/new.js` | Create | Create after read |',
      }),
    });
    const carResult = run(VALIDATOR, [createAfterRead], ROOT);
    assert.notEqual(carResult.status, 0);
    assert.match(output(carResult), /Create must precede read for src\/new\.js/);

    // Same-task: Create after Modify must fail
    const createAfterModify = createSpec(root, {
      name: 'create-after-modify',
      task: task({
        related: '`src/new.js` | Modify',
        relatedRows: '| `src/new.js` | Modify | Modify before create |\n| `src/new.js` | Create | Create after modify |',
      }),
    });
    const camResult = run(VALIDATOR, [createAfterModify], ROOT);
    assert.notEqual(camResult.status, 0);
    assert.match(output(camResult), /Create must precede modify for src\/new\.js/);

    // Same-task: Create before Read/Modify must pass; repeated Reads must not be rejected
    const createBefore = createSpec(root, {
      name: 'create-before',
      task: task({
        related: '`src/new.js` | Create',
        relatedRows: '| `src/new.js` | Create | Create first |\n| `src/new.js` | Read | Read after create |\n| `src/new.js` | Modify | Modify after create |\n| `src/new.js` | Read | Second read |',
      }),
    });
    const cbResult = run(VALIDATOR, [createBefore], ROOT);
    assert.equal(cbResult.status, 0, output(cbResult));

    // Valid same-task repeated reads without create must pass (not rejected unnecessarily)
    const repeatedReads = createSpec(root, {
      name: 'repeated-reads',
      task: task({
        related: '`src/existing.js` | Read',
        relatedRows: '| `src/existing.js` | Read | First read |\n| `src/existing.js` | Read | Second read |\n| `src/existing.js` | Modify | Modify after reads |',
      }),
    });
    const rrResult = run(VALIDATOR, [repeatedReads], ROOT);
    assert.equal(rrResult.status, 0, output(rrResult));

    // Cross-task: Read without dependency must fail
    const crossRead = createSpec(root, { name: 'cross-read-base' });
    const crossReadStatePath = path.join(crossRead, 'spec.json');
    const crossReadState = JSON.parse(fs.readFileSync(crossReadStatePath, 'utf8'));
    // Task1 creates src/gen.js
    write(path.join(crossRead, 'tasks/task-R1-01-one.md'), task({ related: '`src/gen.js` | Create' }));
    crossReadState.task_files.push('tasks/task-R1-02-two.md');
    crossReadState.task_registry['tasks/task-R1-02-two.md'] = { id: 'R1-02', title: 'Two', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null };
    write(path.join(crossRead, 'tasks/task-R1-02-two.md'), task({
      id: 'R1-02',
      related: '`src/gen.js` | Read',
    }));
    write(crossReadStatePath, JSON.stringify(crossReadState, null, 2));
    const crossReadFail = run(VALIDATOR, [crossRead], ROOT);
    assert.notEqual(crossReadFail.status, 0);
    assert.match(output(crossReadFail), /read of src\/gen\.js must depend on creator/);

    // Cross-task Read with dependency must pass
    crossReadState.task_registry['tasks/task-R1-02-two.md'].dependencies = ['tasks/task-R1-01-one.md'];
    crossReadState.coordination.task_triggers = ['real_dependency', 'separate_proof'];
    const crossReadTaskPath = path.join(crossRead, 'tasks/task-R1-02-two.md');
    write(crossReadTaskPath, task({
      id: 'R1-02',
      related: '`src/gen.js` | Read',
      dependencies: 'tasks/task-R1-01-one.md',
    }));
    write(crossReadStatePath, JSON.stringify(crossReadState, null, 2));
    const crossReadPass = run(VALIDATOR, [crossRead], ROOT);
    assert.equal(crossReadPass.status, 0, output(crossReadPass));

    // Cross-task Modify without dependency must fail, with dep must pass
    const crossMod = createSpec(root, { name: 'cross-mod-base' });
    const crossModStatePath = path.join(crossMod, 'spec.json');
    const crossModState = JSON.parse(fs.readFileSync(crossModStatePath, 'utf8'));
    write(path.join(crossMod, 'tasks/task-R1-01-one.md'), task({ related: '`src/gen2.js` | Create' }));
    crossModState.task_files.push('tasks/task-R1-02-two.md');
    crossModState.task_registry['tasks/task-R1-02-two.md'] = { id: 'R1-02', title: 'Two', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null };
    write(path.join(crossMod, 'tasks/task-R1-02-two.md'), task({
      id: 'R1-02',
      related: '`src/gen2.js` | Modify',
      relatedRows: '| `src/gen2.js` | Modify | Modify without dependency |',
    }));
    write(crossModStatePath, JSON.stringify(crossModState, null, 2));
    const crossModFail = run(VALIDATOR, [crossMod], ROOT);
    assert.notEqual(crossModFail.status, 0);
    assert.match(output(crossModFail), /modify of src\/gen2\.js must depend on creator/);
    crossModState.task_registry['tasks/task-R1-02-two.md'].dependencies = ['tasks/task-R1-01-one.md'];
    crossModState.coordination.task_triggers = ['real_dependency', 'separate_proof'];
    const crossModTaskPath = path.join(crossMod, 'tasks/task-R1-02-two.md');
    write(crossModTaskPath, task({
      id: 'R1-02',
      related: '`src/gen2.js` | Modify',
      relatedRows: '| `src/gen2.js` | Modify | Modify generated implementation |',
      dependencies: 'tasks/task-R1-01-one.md',
    }));
    write(crossModStatePath, JSON.stringify(crossModState, null, 2));
    const crossModPass = run(VALIDATOR, [crossMod], ROOT);
    assert.equal(crossModPass.status, 0, output(crossModPass));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('grounding enforces Create ordering and cross-task dependency', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-grounding-order-'));
  try {
    // Same-task Create after Read must fail in grounding
    const specDir = path.join(root, 'spec-order');
    write(path.join(specDir, 'tasks/task-R1-01-one.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/new.js\` | Read | Read before create |\n| \`src/new.js\` | Create | Create after read |\n`);
    write(path.join(specDir, 'spec.json'), JSON.stringify({
      schema_version: '2.0',
      task_files: ['tasks/task-R1-01-one.md'],
      task_registry: { 'tasks/task-R1-01-one.md': { id: 'R1-01', title: 'One', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null } }
    }));
    const r1 = run(GROUNDING, [specDir, '--root', root], ROOT);
    assert.notEqual(r1.status, 0);
    assert.match(`${r1.stdout}\n${r1.stderr}`, /Create must precede read/);

    // Cross-task Read without dependency must fail in grounding
    const specDir2 = path.join(root, 'spec-cross');
    write(path.join(specDir2, 'tasks/task-R1-01-one.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/gen.js\` | Create | Create |\n`);
    write(path.join(specDir2, 'tasks/task-R1-02-two.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/gen.js\` | Read | Read without dep |\n`);
    write(path.join(specDir2, 'spec.json'), JSON.stringify({
      schema_version: '2.0',
      task_files: ['tasks/task-R1-01-one.md', 'tasks/task-R1-02-two.md'],
      task_registry: {
        'tasks/task-R1-01-one.md': { id: 'R1-01', title: 'One', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null },
        'tasks/task-R1-02-two.md': { id: 'R1-02', title: 'Two', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null }
      }
    }));
    const r2 = run(GROUNDING, [specDir2, '--root', root], ROOT);
    assert.notEqual(r2.status, 0);
    assert.match(`${r2.stdout}\n${r2.stderr}`, /read of src\/gen\.js must depend on creator/);

    // Cross-task Read with dependency must pass (if file not found but created, dependency satisfies)
    const spec2Json = JSON.parse(fs.readFileSync(path.join(specDir2, 'spec.json'), 'utf8'));
    spec2Json.task_registry['tasks/task-R1-02-two.md'].dependencies = ['tasks/task-R1-01-one.md'];
    fs.writeFileSync(path.join(specDir2, 'spec.json'), JSON.stringify(spec2Json, null, 2));
    const r3 = run(GROUNDING, [specDir2, '--root', root], ROOT);
    assert.equal(r3.status, 0, `${r3.stdout}\n${r3.stderr}`);

    // Repeated reads without create must not be rejected unnecessarily (grounding should pass if files exist or fail only for missing file, not ordering)
    write(path.join(root, 'src/existing.js'), 'x\n');
    const specDir3 = path.join(root, 'spec-repeated');
    write(path.join(specDir3, 'tasks/task-R1-01-one.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/existing.js\` | Read | First |\n| \`src/existing.js\` | Read | Second |\n`);
    const r4 = run(GROUNDING, [specDir3, '--root', root], ROOT);
    assert.equal(r4.status, 0, `${r4.stdout}\n${r4.stderr}`);

    // Create on existing must remain error in grounding
    const specDir4 = path.join(root, 'spec-create-existing2');
    write(path.join(specDir4, 'tasks/task-R1-01-one.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/existing.js\` | Create | Create existing |\n`);
    const r5 = run(GROUNDING, [specDir4, '--root', root], ROOT);
    assert.notEqual(r5.status, 0);
    assert.match(`${r5.stdout}\n${r5.stderr}`, /Create path already exists/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('grounding fails closed when cross-task producer exists but registry missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-grounding-missing-registry-'));
  try {
    // Cross-task Create -> Read with missing spec.json must fail closed
    const specDir = path.join(root, 'spec-missing-registry');
    write(path.join(specDir, 'tasks/task-R1-01-one.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/gen.js\` | Create | Create |\n`);
    write(path.join(specDir, 'tasks/task-R1-02-two.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/gen.js\` | Read | Read without registry |\n`);
    // Intentionally no spec.json
    const noRegistry = run(GROUNDING, [specDir, '--root', root], ROOT);
    assert.notEqual(noRegistry.status, 0);
    assert.match(`${noRegistry.stdout}\n${noRegistry.stderr}`, /task_registry is missing.*fail-closed|fail-closed/);

    // Missing registry but also empty registry object must fail closed
    write(path.join(specDir, 'spec.json'), JSON.stringify({ task_files: ['tasks/task-R1-01-one.md', 'tasks/task-R1-02-two.md'], task_registry: {} }));
    const emptyRegistry = run(GROUNDING, [specDir, '--root', root], ROOT);
    assert.notEqual(emptyRegistry.status, 0);
    assert.match(`${emptyRegistry.stdout}\n${emptyRegistry.stderr}`, /fail-closed|must depend on creator|task_registry/);

    // Valid single-task Create+Read with missing registry must still PASS (no cross-task)
    const singleDir = path.join(root, 'spec-single-missing-registry');
    write(path.join(singleDir, 'tasks/task-R1-01-one.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/single.js\` | Create | Create |\n| \`src/single.js\` | Read | Read same task |\n`);
    // No spec.json for single-task
    const singlePass = run(GROUNDING, [singleDir, '--root', root], ROOT);
    assert.equal(singlePass.status, 0, `${singlePass.stdout}\n${singlePass.stderr}`);

    // Existing-file Read without producer and missing registry must PASS (if file exists)
    write(path.join(root, 'src/existing2.js'), 'x\n');
    const existingDir = path.join(root, 'spec-existing-missing-registry');
    write(path.join(existingDir, 'tasks/task-R1-01-one.md'), `# Task\n\n## Related Files\n| Path | Action | Description |\n|---|---|---|\n| \`src/existing2.js\` | Read | Read existing |\n`);
    // No spec.json
    const existingPass = run(GROUNDING, [existingDir, '--root', root], ROOT);
    assert.equal(existingPass.status, 0, `${existingPass.stdout}\n${existingPass.stderr}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('benchmark gate fails Critical when both arms correctness is zero', () => {
  const BENCHMARK = path.join(ROOT, 'scripts/benchmark-workflow.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-benchmark-critical-zero-'));
  try {
    function canon(v) {
      if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
      if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
      return JSON.stringify(v);
    }
    function shaCanon(v) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(canon(v)).digest('hex')}`; }
    function hash(v) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(JSON.stringify(v)).digest('hex')}`; }
    function rawHash(buf) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(buf).digest('hex')}`; }
    const corpus = {
      schema_version: 'b1.v1',
      status: 'frozen',
      corpus_id: 'zero-critical-test',
      tasks: [
        { task_id: 'c1', lane: 'Critical', prompt: 'critical task', repo_sample: 'r/a', acceptance: { criteria: ['x'] }, risk: { level: 'high', reasons: ['x'] } },
        { task_id: 'd1', lane: 'Direct', prompt: 'direct task', repo_sample: 'r/a', acceptance: { criteria: ['x'] }, risk: { level: 'low', reasons: ['x'] } },
      ],
    };
    const corpusSha = shaCanon(corpus);
    const corpusPath = path.join(root, 'corpus.json');
    fs.writeFileSync(corpusPath, JSON.stringify(corpus));
    function makeConfig(arm) {
      const cfg = {
        schema_version: 'b1.v1',
        status: 'frozen',
        experiment_id: 'exp-zero',
        arm,
        model: { name: 'm', version: 'v' },
        reasoning_effort: 'standard',
        repo: { identifier: 'r', commit: 'abc1234', clean_initial_tree_sha: hash('clean') },
        permissions_fingerprint: hash('perm'),
        tool_availability_fingerprint: hash('tool'),
        corpus_sha256: corpusSha,
        repeat_policy: { repeats_per_task: 1, context_isolated: true },
        input_usd_per_1k: 0.01,
        output_usd_per_1k: 0.02,
      };
      const without = { ...cfg }; delete without.config_sha256;
      cfg.config_sha256 = shaCanon(without);
      return cfg;
    }
    const baselineCfg = makeConfig('baseline');
    const treatmentCfg = makeConfig('treatment');
    const baselinePath = path.join(root, 'baseline.json');
    const treatmentPath = path.join(root, 'treatment.json');
    fs.writeFileSync(baselinePath, JSON.stringify(baselineCfg));
    fs.writeFileSync(treatmentPath, JSON.stringify(treatmentCfg));
    const artifactBytes = Buffer.from('artifact');
    const artifactSha = rawHash(artifactBytes);
    const receiptsDir = path.join(root, 'receipts');
    fs.mkdirSync(receiptsDir, { recursive: true });
    fs.writeFileSync(path.join(receiptsDir, 'artifact.json'), artifactBytes);
    const receipts = [];
    for (const t of corpus.tasks) {
      for (const arm of ['baseline', 'treatment']) {
        const cfg = arm === 'baseline' ? baselineCfg : treatmentCfg;
        receipts.push({
          task_id: t.task_id,
          lane: t.lane,
          arm,
          repeat: 1,
          model: { name: 'm', version: 'v' },
          reasoning_effort: 'standard',
          repo_commit: 'abc1234',
          clean_initial_tree_sha: hash('clean'),
          permissions_fingerprint: hash('perm'),
          tool_availability_fingerprint: hash('tool'),
          corpus_sha256: corpusSha,
          config_sha256: cfg.config_sha256,
          wall_ms: 100,
          input_tokens: 10,
          output_tokens: 10,
          context_loaded_tokens: 100,
          tool_calls: 1,
          subagent_calls: 0,
          correctness: false,
          regression: false,
          unsupported_completion_claim: false,
          user_corrections: 0,
          useful_reviewer_findings: 1,
          false_positive_reviewer_findings: 0,
          evidence: { artifact_ref: 'artifact.json', artifact_sha256: artifactSha, command: 'echo hi' },
        });
      }
    }
    const receiptsPath = path.join(receiptsDir, 'receipts.json');
    fs.writeFileSync(receiptsPath, JSON.stringify({ receipts }));
    const summary = spawnSync(process.execPath, [BENCHMARK, 'summarize', '--corpus', corpusPath, '--config', baselinePath, '--config', treatmentPath, '--receipts', receiptsPath], { encoding: 'utf8' });
    assert.equal(summary.status, 0, `${summary.stdout}\n${summary.stderr}`);
    const parsed = JSON.parse(summary.stdout);
    assert.equal(parsed.rollout_recommendation.gates.Critical.pass, false, 'Critical should not pass with zero correctness');
    assert.equal(parsed.rollout_recommendation.gates.Critical.quality_pass, false);
    assert.equal(parsed.status, 'not-ready');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('benchmark validate handles empty and invalid evidence as not-ready/invalid', () => {
  const BENCHMARK = path.join(ROOT, 'scripts/benchmark-workflow.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-benchmark-empty-'));
  try {
    function canon(v) {
      if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
      if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
      return JSON.stringify(v);
    }
    function shaCanon(v) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(canon(v)).digest('hex')}`; }
    function hash(v) { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(JSON.stringify(v)).digest('hex')}`; }
    const corpus = {
      schema_version: 'b1.v1',
      status: 'frozen',
      corpus_id: 'empty-test',
      tasks: [{ task_id: 't1', lane: 'Direct', prompt: 'p', repo_sample: 'r/a', acceptance: { criteria: ['x'] }, risk: { level: 'low', reasons: ['x'] } }],
    };
    const corpusSha = shaCanon(corpus);
    const corpusPath = path.join(root, 'corpus.json');
    fs.writeFileSync(corpusPath, JSON.stringify(corpus));
    function makeConfig(arm) {
      const cfg = {
        schema_version: 'b1.v1', status: 'frozen', experiment_id: 'exp-empty', arm,
        model: { name: 'm', version: 'v' }, reasoning_effort: 'standard',
        repo: { identifier: 'r', commit: 'abc', clean_initial_tree_sha: hash('clean') },
        permissions_fingerprint: hash('perm'), tool_availability_fingerprint: hash('tool'),
        corpus_sha256: corpusSha, repeat_policy: { repeats_per_task: 1, context_isolated: true },
      };
      const without = { ...cfg }; delete without.config_sha256;
      cfg.config_sha256 = shaCanon(without);
      return cfg;
    }
    const cfg = makeConfig('baseline');
    const cfgPath = path.join(root, 'cfg.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const emptyReceipts = path.join(root, 'empty.json');
    fs.writeFileSync(emptyReceipts, JSON.stringify({ receipts: [] }));
    const emptySummary = spawnSync(process.execPath, [BENCHMARK, 'summarize', '--corpus', corpusPath, '--config', cfgPath, '--receipts', emptyReceipts], { encoding: 'utf8' });
    assert.equal(emptySummary.status, 0);
    const emptyParsed = JSON.parse(emptySummary.stdout);
    assert.ok(['not-ready', 'exploratory/no-live-runs'].includes(emptyParsed.status));

    const artifactBytes = Buffer.from('artifact');
    const rawHash = (b) => { const c = require('node:crypto'); return `sha256:${c.createHash('sha256').update(b).digest('hex')}`; };
    const artifactSha = rawHash(artifactBytes);
    const badReceipts = { receipts: [{
      task_id: 't1', lane: 'Direct', arm: 'baseline', repeat: 1,
      model: { name: 'm', version: 'v' }, reasoning_effort: 'standard',
      repo_commit: 'abc', clean_initial_tree_sha: hash('clean'),
      permissions_fingerprint: hash('perm'), tool_availability_fingerprint: hash('tool'),
      corpus_sha256: corpusSha, config_sha256: cfg.config_sha256,
      wall_ms: 100, input_tokens: 10, output_tokens: 10, context_loaded_tokens: 100, tool_calls: 1, subagent_calls: 0,
      correctness: true, regression: false, unsupported_completion_claim: false,
      user_corrections: 0, useful_reviewer_findings: 0, false_positive_reviewer_findings: 0,
      evidence: { artifact_ref: 'missing.json', artifact_sha256: artifactSha, command: 'echo hi' },
    }] };
    const badPath = path.join(root, 'bad.json');
    fs.writeFileSync(badPath, JSON.stringify(badReceipts));
    const badValidation = spawnSync(process.execPath, [BENCHMARK, 'validate', '--corpus', corpusPath, '--config', cfgPath, '--receipts', badPath], { encoding: 'utf8' });
    assert.equal(badValidation.status, 2);
    assert.match(badValidation.stderr, /artifact.*does not exist|artifact_ref/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('D12: run-skill-self-tests.mjs sentinel exits nonzero immediately when a required semantic-firewall basename is missing', () => {
  const RUNNER = path.join(ROOT, 'scripts/run-skill-self-tests.mjs');
  const result = spawnSync(process.execPath, [
    RUNNER, '--require-semantic-test', 'does-not-exist.semantic-firewall.test.js',
  ], { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /required semantic-firewall test not discovered: does-not-exist\.semantic-firewall\.test\.js/);
});
