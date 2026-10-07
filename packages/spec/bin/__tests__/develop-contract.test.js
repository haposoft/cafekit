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

function canonicalReceipt(command = 'pnpm test', extra = '') {
  return `Verification: PASS\nCommand: ${command}\nExit: 0\nBase: ${EXPECTED_BASE}\nHead: ${EXPECTED_HEAD}\n${extra}`;
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
  const regions = markdownLegacyRegions(develop);
  assert.doesNotMatch(develop, /DO NOT write implementation code until an approved spec exists/i);
  assert.doesNotMatch(regions.primary, /planning_depth|assurance_level|execution_tier|\blane\b/i);
  assert.doesNotMatch(develop, /## Legacy workflow compatibility|Also supports existing legacy Specs packets/);
  assert.match(regions.primary, /specs\/<feature>\/plan\.md[\s\S]*task-NN-\*\.md/i);
  assert.match(regions.primary, /one unblocked task at a time/i);
  assert.match(regions.primary, /Verification Plan/);
  assert.match(regions.primary, /inline Receipt/i);
  assert.doesNotMatch(develop, /D2\[Step 3/);
  assert.match(develop, /--notes.*opt-in/i);
  assert.doesNotMatch(develop, /--no-notes/);
  assert.doesNotMatch(develop, /planner|implementer|test-runner|code-auditor|docs-keeper/i);
});

test('Specs primary output is a flat process-first packet with isolated legacy compatibility', () => {
  const specs = read(SPECS);
  const regions = markdownLegacyRegions(specs);
  const legacyHeadings = regions.headings.filter(({ text }) => /legacy/i.test(text));
  assert.equal(legacyHeadings.length, 0);
  assert.match(regions.primary, /specs\/<feature>\/[\s\S]*plan\.md[\s\S]*task-01-<slug>\.md[\s\S]*task-02-<slug>\.md/i);
  assert.match(regions.primary, /Task files are flat beside `plan\.md`/i);
  assert.match(regions.primary, /one task at a time/i);
  assert.match(regions.primary, /inline `## Receipt`/i);
  assert.match(regions.primary, /GATE-SCOPE[\s\S]*GATE-REVIEW[\s\S]*GATE-DONE/i);
  assert.doesNotMatch(specs, /installed legacy adapters?/i);
  assertVocabularyIsLegacyOnly(SPECS, regions);
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
  assert.match(implementer, /Under every dispatch mode[\s\S]{0,160}do NOT edit[\s\S]{0,80}`plan\.md`[\s\S]{0,80}`Status:`[\s\S]{0,80}`## Receipt`/i);
  assert.match(implementer, /controller/i);
  assert.match(implementer, /process-first work[\s\S]{0,100}Ownership\s+boundary\./i);

  const auditor = read(PROCESS_FIRST_AGENTS[2]);
  assert.match(auditor, /accepted GATE-SCOPE\/GATE-REVIEW decisions/i);
  assert.doesNotMatch(auditor, /CAFEKIT_SEMANTIC_REVIEW_ATTESTATION/);

  const docsKeeper = read(PROCESS_FIRST_AGENTS[3]);
  assert.match(docsKeeper, /never[\s\S]{0,80}invent or write Status, Receipt, approval, or execution proof/i);

  const deployer = read(PROCESS_FIRST_AGENTS[4]);
  assert.match(deployer, /current final inline Receipt/i);
  assert.match(deployer, /GATE-DONE\/release authorization/i);
  assert.match(deployer, /does not write process-first Status\/Receipt/i);
});

test('R7 Develop and Sync surfaces teach process-v3 and isolate hierarchical Legacy sections', () => {
  const surfaces = [
    ['develop', DEVELOP, 0],
    ['parallel waves', PARALLEL_WAVES, 0],
    ['sync', SYNC_SKILL, 0],
    ['sync protocols', SYNC_PROTOCOLS, 0],
  ];
  const regionsByName = new Map();

  for (const [name, filePath, expectedLegacy] of surfaces) {
    const regions = markdownLegacyRegions(read(filePath));
    const legacyHeadings = regions.headings.filter(({ text }) => /legacy/i.test(text));
    assert.equal(legacyHeadings.length, expectedLegacy, `${name} must have exactly ${expectedLegacy} Legacy heading(s)`);
    assert.match(regions.primary, /inline (?:`## )?Receipts?/i, `${name} must teach inline Receipts`);
    if (expectedLegacy === 1) {
      assert.match(regions.legacy, /spec\.json/i, `${name} must retain the spec.json adapter`);
      assert.match(regions.legacy, /task_registry/i, `${name} must retain task_registry compatibility`);
    }
    assertVocabularyIsLegacyOnly(filePath, regions);
    regionsByName.set(name, regions);
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
  assert.match(regionsByName.get('sync').primary, /sync-finalize/i);
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
    assert.match(installedReview, /For proof consumption, this skill's `## Execution-proof boundary` is\s+authoritative/i);
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
  assert.match(section, /chỉ nằm trong `## Receipt` inline/i);
  assert.match(section, /không phải benchmark thời gian/i);
  assert.match(section, /không chứng minh live adherence/i);
  assert.doesNotMatch(section, /\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|minutes?)\b/i);
  assert.doesNotMatch(section, /\[(?:LIVE_)?VERIFIED\]/i);
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
