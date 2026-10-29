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
const { copyClaudeTestRuntime } = require('./test-runtime-dependency-closure.cjs');
const DEVELOP = path.join(PACKAGE_ROOT, 'src/claude/skills/develop/SKILL.md');
const SPECS = path.join(PACKAGE_ROOT, 'src/claude/skills/specs/SKILL.md');
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
const RUNTIME_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-policy-runtime-'));
const RUNTIME_SPEC = path.join(RUNTIME_ROOT, 'specs', 'demo', 'plan.md');
fs.mkdirSync(path.dirname(RUNTIME_SPEC), { recursive: true });
fs.mkdirSync(path.join(RUNTIME_ROOT, 'src'), { recursive: true });
fs.writeFileSync(path.join(RUNTIME_ROOT, 'src', 'app.js'), 'runtime fixture\n');
fs.writeFileSync(RUNTIME_SPEC, '# Demo\nSpecs-Contract: process-first-ready-v1\n');
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
  ]) {
    const target = path.join(destinationRoot, 'hooks', hook);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(hooksRoot, hook), target);
  }
  // Hook helpers the raw-copied hooks require at runtime.
  for (const helper of ['hook-state-dir.cjs', 'runtime-dir.cjs', 'hook-payload.cjs', 'project-root.cjs']) {
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

function assertNoLegacyVocabulary(filePath, content) {
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
  for (const [index, text] of content.split('\n').entries()) {
    for (const [term, pattern] of vocabulary) {
      if (pattern.test(text)) violations.push(`${index + 1}:${term}`);
    }
  }
  assert.deepEqual(violations, [], `${path.relative(PACKAGE_ROOT, filePath)} teaches a retired packet vocabulary`);
}

function canonicalReceipt(command = 'pnpm test', extra = '') {
  return `Verification: PASS\nCommand: ${command}\nExit: 0\nBase: ${EXPECTED_BASE}\nHead: ${EXPECTED_HEAD}\n${extra}`;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('CLI rejects flash and parallel before any mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-policy-cli-'));
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
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('develop flags retain their process-v3 contracts', () => {
  const develop = read(DEVELOP);
  assert.match(develop, /node \.claude\/scripts\/workflow-policy\.cjs --flash --parallel --json/);
  assert.match(develop, /exits `2` before a task edit, receipt, worktree, subagent, or commit/i);
  assert.match(develop, /--parallel \[N\][\s\S]*parallel-waves\.md[\s\S]*one controller writer/i);
  assert.match(develop, /--flash[\s\S]*Status: in_progress[\s\S]*FLASH_UNVERIFIED/);
  assert.match(develop, /FLASH_UNVERIFIED[\s\S]*do not unblock dependents/i);
});

test('review and sync skills keep the verdict vocabulary and the sync-finalize path', () => {
  assert.doesNotMatch(read(GATE), /spec-review|quality-review/);
  assert.doesNotMatch(read(DEVELOP), /spec-review|quality-review/);
  assert.match(read(GATE), /PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED/);
  assert.match(read(CODE_REVIEW_SKILL), /PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED/);
  assert.match(read(TEST_SKILL), /PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED/);
  assert.match(read(TEST_SKILL), /only explicit .*sync-finalize/i);
  assert.match(read(SYNC_SKILL), /sync-finalize/);
});

test('Develop names the process-first packet as its only authority', () => {
  const develop = read(DEVELOP);
  assertNoLegacyVocabulary(DEVELOP, develop);
  assert.doesNotMatch(develop, /Legacy workflow compatibility|existing legacy Specs packets/i);
  assert.match(develop, /specs\/<feature>\/plan\.md[\s\S]*task-NN-\*\.md/i);
  assert.match(develop, /one unblocked task at a time/i);
  assert.match(develop, /Verification Plan/);
  assert.match(develop, /inline Receipt/i);
});

test('Specs primary output is a flat process-first packet with no legacy packet vocabulary', () => {
  const specs = read(SPECS);
  assertNoLegacyVocabulary(SPECS, specs);
  assert.doesNotMatch(specs, /^#{1,6}\s.*legacy/im);
  assert.match(specs, /specs\/<feature>\/[\s\S]*plan\.md[\s\S]*task-01-<slug>\.md[\s\S]*task-02-<slug>\.md/i);
  assert.match(specs, /Task files are flat beside `plan\.md`/i);
  assert.match(specs, /inline `## Receipt`/i);
  assert.match(specs, /GATE-SCOPE[\s\S]*GATE-REVIEW[\s\S]*GATE-DONE/i);
});

test('core execution agents default to process-first state and carry no legacy adapter', () => {
  for (const filePath of PROCESS_FIRST_AGENTS) {
    const content = read(filePath);
    const name = path.basename(filePath);
    assert.match(content, /plan\.md/i, `${name} must read the process-first plan`);
    assert.match(content, /task-NN-\*\.md|task-NN-<slug>\.md/i, `${name} must understand flat tasks`);
    assert.doesNotMatch(content, /legacy|spec\.json|scope_lock/i, `${name} must not teach a legacy adapter`);
  }

  const implementer = read(PROCESS_FIRST_AGENTS[0]);
  assert.match(implementer, /do NOT edit[\s\S]{0,80}`plan\.md`[\s\S]{0,80}`Status:`[\s\S]{0,80}`## Receipt`/i);
  assert.match(implementer, /controller/i);
  assert.match(read(PROCESS_FIRST_AGENTS[2]), /GATE-SCOPE\/GATE-REVIEW/);
  assert.match(read(PROCESS_FIRST_AGENTS[3]), /never[\s\S]{0,80}Status, Receipt/i);
  const deployer = read(PROCESS_FIRST_AGENTS[4]);
  assert.match(deployer, /GATE-DONE/);
  assert.match(deployer, /does not write process-first Status\/Receipt/i);
});

test('Develop and Sync surfaces teach the flat process-first packet and no legacy vocabulary', () => {
  for (const [name, filePath] of [
    ['develop', DEVELOP], ['parallel waves', PARALLEL_WAVES], ['sync', SYNC_SKILL], ['sync protocols', SYNC_PROTOCOLS],
  ]) {
    const content = read(filePath);
    assert.doesNotMatch(content, /^#{1,6}\s.*legacy/im, `${name} must have no Legacy section`);
    assert.match(content, /inline (?:`## )?Receipts?/i, `${name} must teach inline Receipts`);
    assertNoLegacyVocabulary(filePath, content);
  }
  assert.match(read(DEVELOP), /`specs\/<feature>\/plan\.md` plus flat `task-NN-\*\.md`/i);
  assert.match(read(SYNC_SKILL), /<task-NN-slug\.md>/i);
  assert.match(read(SYNC_SKILL), /sync-finalize/i);
  assert.match(read(PARALLEL_WAVES), /one file has one writer per wave/i);
  assert.match(read(PARALLEL_WAVES), /writes inline Receipts and Status one task at a time/i);
  assert.match(read(SYNC_PROTOCOLS), /`plan\.md` and flat `task-\*\.md` files/i);
});

test('Develop process-first source contract preserves selection, recovery, final-Head, parallel, and Flash boundaries', () => {
  const develop = read(DEVELOP);
  const quality = read(GATE);
  const waves = read(PARALLEL_WAVES);
  const dispatch = read(path.join(path.dirname(PARALLEL_WAVES), 'subagent-patterns.md'));

  for (const clause of [
    /first dependency-valid `pending` row in `plan\.md` order/i,
    /Specific-task\s+mode never touches a sibling/i,
    /More than one `in_progress`/i,
    /For an interrupted `in_progress` task/i,
    /only the controller writes Status or Receipt/i,
  ]) assert.match(develop, clause);
  assert.match(quality, /consecutive Head captures are identical/i);
  assert.match(quality, /skip, skipped, todo, cancel, canceled, cancelled/i);
  assert.match(waves, /every commit[\s\S]*complete changed tree/i);
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

  const exactKeys = [
    'schema_version', 'target', 'verdict', 'command', 'exit', 'counts',
    'provenance', 'proof_level', 'expected', 'observed', 'reachability',
    'artifacts', 'branches', 'raw_output', 'redactions', 'payload_sha256',
  ];
  for (const key of exactKeys) assert.match(strategy, new RegExp(`\\b${key}\\b`));
  assert.match(runner, /Emit only `schema_version: "test-proof-v1"`/);
  assert.match(runner, /sole writer of[\s\S]*Status and inline Receipt/i);
  assert.match(review, /consume only the controller-validated[\s\S]*`test-proof-v1`[\s\S]*handoff/i);
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
    assert.equal(fs.existsSync(path.join(root, '.agents/skills/test')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test('first-run cache bypass is blocked - canonical receipt required even without cache', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-first-run-'));
  const claude = path.join(root, '.claude');
  const specGate = installClaudeRuntimeClosure(root);
  const featureDir = path.join(root, 'specs', 'demo');
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Demo\nSpecs-Contract: process-first-ready-v1\n');
  const taskFile = path.join(featureDir, 'task-01-one.md');
  const head = '# Task 01: One\n\nStatus: done\n\n## Dependencies\n\n- none\n\n## Verification Plan\n\n- Command: pnpm test\n\n';
  // Done task without a canonical receipt (no Command, no provenance)
  fs.writeFileSync(taskFile, `${head}## Receipt\n\nVerification: PASS\n\`\`\`\nnpm test\n\`\`\`\n`);
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
    assert.match(payload.reason, /task-01-one\.md/);
    assert.match(payload.reason, /receipt|command|provenance/i);
    const context = PROVENANCE_HELPER.deriveRuntimeContext({
      projectRoot: root,
      specsRoot: path.join(root, 'specs'),
      specFile: path.join(featureDir, 'plan.md'),
      featureName: 'demo',
      runtimeSession: 'test',
    });
    fs.writeFileSync(taskFile, `${head}## Receipt\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: ${context.base}\nHead: ${context.head}\n\`\`\`\npnpm test\nPASS\n\`\`\`\n`);
    // Clear cache to simulate fresh first-run with valid receipt
    try { fs.unlinkSync(path.join(claude, 'hooks', '.logs', 'spec-gate-last.json')); } catch {}
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
});

test('canonical receipt binds expected provenance when the runtime supplies it', () => {
  const body = canonicalReceipt();
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

    // A source change after the receipt was written leaves its Base/Head stale.
    fs.writeFileSync(sourceFile, 'mutated source\n');
    // The pre-change context is recomputed against the current tree, so the old pair no longer binds.
    assert.ok(
      POLICY.validateCanonicalReceipt(exactReceipt, POLICY.receiptValidatorOptions({}, {
        runtimeContext: initial,
        requireProvenanceBinding: true,
      })).includes('provenance'),
      'a receipt bound to the pre-change tree must go stale',
    );
    // A copied context is not runtime-derived and must never supply the expected pair.
    assert.ok(
      POLICY.validateCanonicalReceipt(exactReceipt, POLICY.receiptValidatorOptions({}, {
        runtimeContext: { ...initial },
        requireProvenanceBinding: true,
      })).includes('provenance'),
      'a copied runtime context must not bind',
    );

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

test('parallel waves require immutable provenance receipts and safe recovery', () => {
  const waves = read(PARALLEL_WAVES);
  assert.match(waves, /Clamp `--parallel N` to 1\.\.5; default to 3/i);
  assert.match(waves, /clean destination[\s\S]*base_sha[\s\S]*incompatible bases/i);
  for (const field of ['base_sha', 'head_sha', 'branch', 'worktree_path', 'commit_range']) {
    assert.match(waves, new RegExp(`\\b${field}\\b`));
  }
  assert.match(waves, /One file has one writer per wave/i);
  assert.match(waves, /only the controller writes state\/proof/i);
  assert.match(waves, /commit only with user authorization/i);
  assert.match(waves, /Never[\s\S]*force-delete[\s\S]*merge success or explicit discard authorization/i);
  assert.match(waves, /On conflict, abort the pick[\s\S]*retain its branch\/worktree/i);
  assert.match(waves, /cleanup_authorization: merged-release/i);
  assert.match(waves, /Do not blind-retry/i);
});

test('provenance ledger forbids copied source text and the shipped runtime carries none', () => {
  assert.equal(fs.existsSync(PROVENANCE), true);
  const provenance = read(PROVENANCE);
  assert.match(provenance, /\bclean-room\b/);
  assert.match(provenance, /never copy source text verbatim/i);
  // shipped runtime must not contain cafekit-ref/AgentKit verbatim (only ledger/plans may)
  const shippedHits = spawnSync('grep', ['-rn', 'cafekit-ref', 'packages/spec/src', '--include=*.md', '--include=*.cjs', '--include=*.ts'], { encoding: 'utf8' });
  const agentKitHits = spawnSync('grep', ['-rn', 'AgentKit', 'packages/spec/src', '--include=*.md', '--include=*.cjs', '--include=*.ts'], { encoding: 'utf8' });
  assert.equal(shippedHits.stdout.trim(), '', 'shipped runtime must not contain cafekit-ref verbatim');
  assert.equal(agentKitHits.stdout.trim(), '', 'shipped runtime must not contain AgentKit verbatim');
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

function writeWorkflowPacketAt(featureDir, taskStatus = 'pending', dependency = 'none') {
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Plan\nSpecs-Contract: process-first-ready-v1\n');
  fs.writeFileSync(path.join(featureDir, 'task-01-x.md'),
    `# Task 01\n\nStatus: ${taskStatus}\n\n## Dependencies\n\n- ${dependency}\n\n## Verification Plan\n\n- Command: pnpm test\n`);
}

test('P0 Claude and Codex reject configured specs roots outside the project', () => {
  const claudeResolver = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));
  const codexUtils = require(path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-utils.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-external-specs-'));
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-configured-specs-'));
  try {
    writeWorkflowPacketAt(path.join(tmp, 'specs', 'local'));
    writeWorkflowPacketAt(path.join(externalRoot, 'remote'));
    const runtime = { paths: { specs: externalRoot } };
    const claude = claudeResolver.resolveWorkflowCandidate({ projectRoot: tmp, runtime });
    const codex = codexUtils.resolveWorkflowCandidate(tmp, runtime, null, null);
    assert.equal(claude.error, 'invalid_specs');
    assert.equal(codex.error, 'invalid_specs');
    assert.match(claude.reason, /escapes project root/);
    assert.match(codex.reason, /escapes project root/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(externalRoot, { recursive: true, force: true });
  }
});

test('P0 active spec deterministic: multiple active ambiguity and explicit target/path containment', () => {
  const RESOLVER = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-resolver-'));
  try {
    const specsDir = path.join(tmp, 'specs');
    for (const name of ['alpha', 'beta']) writeWorkflowPacketAt(path.join(specsDir, name));
    const amb = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {} });
    assert.equal(amb.error, 'multiple_active');
    assert.deepEqual(amb.candidates.sort(), ['alpha', 'beta']);
    // Explicit feature resolves deterministically
    const alpha = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {}, explicitFeature: 'alpha' });
    assert.equal(alpha.featureName, 'alpha');
    // Explicit not-found fail-closed
    const notFound = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {}, explicitFeature: 'gamma' });
    assert.equal(notFound.error, 'explicit_not_found');
    // Explicit path containment: a plan.md reached through ../ is outside the specs root
    fs.mkdirSync(path.join(tmp, 'etc'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'etc', 'plan.md'), '# Outside\n');
    const escape = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {}, explicitPath: path.join(tmp, 'specs', '..', 'etc', 'plan.md') });
    assert.equal(escape.error, 'explicit_malformed');
    // Malformed feature name with slash must be rejected
    const malformed = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {}, explicitFeature: '../alpha' });
    assert.equal(malformed.error, 'explicit_malformed');
    // Valid explicit path inside root
    const validPath = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {}, explicitPath: path.join(specsDir, 'beta', 'plan.md') });
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
    for (const name of ['x', 'y']) writeWorkflowPacketAt(path.join(tmp, 'specs', name));
    const amb = codexUtils.resolveWorkflowCandidate(tmp, {}, null, null);
    assert.equal(amb.error, 'multiple_active');
    fs.mkdirSync(path.join(tmp, 'outside'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'outside', 'plan.md'), '# Outside\n');
    const esc = codexUtils.resolveWorkflowCandidate(tmp, {}, null, path.join(tmp, 'specs', '..', 'outside', 'plan.md'));
    assert.equal(esc.error, 'explicit_malformed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('P0 regression: placeholder, explicit failure and artifact receipts are blocked', () => {
  // Probe A: explicit failure outcomes must fail the canonical validator
  const bodyTestsFailed = 'Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nTests failed: 1\n';
  assert.ok(POLICY.validateCanonicalReceipt(bodyTestsFailed).length > 0, 'Tests failed: 1 must be rejected');
  assert.ok(POLICY.validateCanonicalReceipt('Verification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\nResult: FAIL\nResult: PASS\n').includes('exit_result'), 'Result FAIL then PASS must be rejected');

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
});

test('P0 regression: symlink spec/task containment and malformed spec handling', () => {
  const RESOLVER = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-regression-symlink-'));
  try {
    const specsDir = path.join(tmp, 'specs');
    writeWorkflowPacketAt(path.join(specsDir, 'valid'));
    const outside = path.join(tmp, 'outside');
    writeWorkflowPacketAt(outside);
    fs.symlinkSync(outside, path.join(specsDir, 'linked'));
    const e1 = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {}, explicitFeature: 'linked' });
    assert.equal(e1.error, 'explicit_malformed');
    const e2 = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {}, explicitPath: path.join(specsDir, 'linked', 'plan.md') });
    assert.equal(e2.error, 'explicit_malformed');
    const nonExplicit = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {} });
    assert.equal(nonExplicit.error, 'invalid_specs');
    assert.ok(nonExplicit.candidates.includes('linked'));
    fs.rmSync(path.join(specsDir, 'linked'));
    // A task file that is a symlink to a file outside the packet is refused.
    const taskOutside = path.join(tmp, 'outside-task.md');
    fs.copyFileSync(path.join(specsDir, 'valid', 'task-01-x.md'), taskOutside);
    fs.symlinkSync(taskOutside, path.join(specsDir, 'valid', 'task-02-link.md'));
    const linkedTask = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {} });
    assert.equal(linkedTask.error, 'invalid_specs');
    assert.ok(linkedTask.candidates.includes('valid'));
    fs.rmSync(path.join(specsDir, 'valid', 'task-02-link.md'));
    // A malformed packet (dependency on a missing task) is reported, not skipped.
    writeWorkflowPacketAt(path.join(specsDir, 'bad'), 'pending', 'task-09-missing.md');
    const mal = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {} });
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
  // The task-file read fails closed when realpath throws
  const tmp = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'cafekit-realpath-'));
  try {
    const featDir = path2.join(tmp, 'feat');
    writeWorkflowPacketAt(featDir, 'done');
    fs2.appendFileSync(path2.join(featDir, 'task-01-x.md'), '\n## Receipt\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\n```\npnpm test\n```\n');
    const codexReceipt = require(path2.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-receipt.cjs'));
    const orig = fs2.realpathSync;
    fs2.realpathSync = () => { throw new Error('simulated realpath failure'); };
    try {
      const proof = codexReceipt.checkWorkflowReceiptDetails(featDir, 'task-01-x.md', null);
      assert.ok(proof.failures.includes('unsafe_path'), `realpath failure must fail closed, got ${proof.failures}`);
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
    writeWorkflowPacketAt(path2.join(specsDir, 'demo'));
    const origRealpath = fs2.realpathSync;
    fs2.realpathSync = () => { throw Object.assign(new Error('simulated EACCES'), { code: 'EACCES' }); };
    try {
      const res = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {}, explicitFeature: 'demo' });
      assert.equal(res.error, 'explicit_malformed', 'explicitFeature realpath failure should be explicit_malformed');
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
      const res2 = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {} });
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
      const res3 = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {} });
      assert.equal(res3.error, 'invalid_specs');
      assert.ok(res3.candidates.includes('demo'));
    } finally {
      fs2.lstatSync = origLstat;
    }
    // A dangling plan.md symlink is invalid
    const featDir = path2.join(specsDir, 'dangle');
    fs2.mkdirSync(featDir, { recursive: true });
    fs2.symlinkSync(path2.join(tmp, 'nonexistent-target'), path2.join(featDir, 'plan.md'));
    const res4 = RESOLVER.resolveWorkflowCandidate({ projectRoot: tmp, runtime: {} });
    assert.equal(res4.error, 'invalid_specs');
    assert.ok(res4.candidates.includes('dangle'));
  } finally {
    fs2.rmSync(tmp, { recursive: true, force: true });
  }
  // Codex parity: same monkey patch should give explicit_malformed
  const codexUtils = require(path2.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-utils.cjs'));
  const tmp2 = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'cafekit-codex-fail-'));
  try {
    writeWorkflowPacketAt(path2.join(tmp2, 'specs', 'demo2'));
    const orig = fs2.realpathSync;
    fs2.realpathSync = () => { throw Object.assign(new Error('simulated EACCES'), { code: 'EACCES' }); };
    try {
      const r = codexUtils.resolveWorkflowCandidate(tmp2, {}, 'demo2', null);
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
