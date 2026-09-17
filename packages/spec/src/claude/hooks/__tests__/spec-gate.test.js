'use strict';

// Behavioral tests for spec-gate.cjs (Stop completion gate). The hook is run as
// a real subprocess: a Stop payload is piped to stdin; we assert exit code and
// whether stdout carries {"decision":"block",...}. The hook resolves its own
// state directory; running from source that is a temp directory rather than the
// source tree, and it is shared, so each test seeds/clears it deliberately.

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK = path.join(__dirname, '..', 'spec-gate.cjs');
const { hookStateDir } = require(path.join(__dirname, '..', 'lib', 'hook-state-dir.cjs'));
const CACHE = path.join(hookStateDir(), 'spec-gate-last.json');
const PROVENANCE = require(path.join(__dirname, '..', '..', 'scripts', 'provenance.cjs'));
const POLICY = require(path.join(__dirname, '..', '..', 'scripts', 'workflow-policy.cjs'));
const FEATURE = 'demo';
const TASK_REL = 'tasks/task-R0-01-x.md';
const VALID_BASE = '0123456789abcdef0123456789abcdef01234567';
const VALID_HEAD = '89abcdef0123456789abcdef0123456789abcdef';
const FIXTURE_ARTIFACT = Buffer.from('cafekit claude fixture artifact\n');
const FIXTURE_ARTIFACT_DIGEST = crypto.createHash('sha256').update(FIXTURE_ARTIFACT).digest('hex');

function runHook(payload, cwd) {
  const projectRoot = cwd || payload.cwd;
  const specsRoot = path.join(projectRoot, 'specs');
  if (fs.existsSync(specsRoot)) {
    for (const featureName of fs.readdirSync(specsRoot)) {
      installFeatureReceipt(projectRoot, featureName, payload.session_id || 'test');
    }
  }
  // PROJECT_ROOT wins over cwd in the hook; pin it to the fixture so a host
  // monorepo's real specs/ cannot leak into the test (e.g. active rtk-* specs).
  const env = { ...process.env, PROJECT_ROOT: projectRoot };
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      hook_event_name: 'Stop',
      session_id: 'test',
      transcript_path: '/tmp/t',
      stop_hook_active: false,
      ...payload,
      cwd: projectRoot,
    }),
    encoding: 'utf8',
    env,
  });
  return {
    code: res.status,
    stdout: (res.stdout || '').trim(),
    stderr: res.stderr || '',
  };
}

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-spec-gate-'));
  for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test'], ['commit', '--allow-empty', '-qm', 'fixture']]) {
    const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
  }
  return dir;
}

function runtimeContext(dir) {
  return PROVENANCE.deriveRuntimeContext({
    projectRoot: dir,
    specsRoot: path.join(dir, 'specs'),
    specFile: path.join(dir, 'specs', FEATURE, 'spec.json'),
    featureName: FEATURE,
    runtimeSession: 'test',
  });
}

function bindFixtureReceipt(dir, value) {
  const context = runtimeContext(dir);
  return value.replaceAll(VALID_BASE, context.base).replaceAll(VALID_HEAD, context.head);
}

function workflowRuntimeContext(dir) {
  return PROVENANCE.deriveRuntimeContext({
    projectRoot: dir,
    specsRoot: path.join(dir, 'specs'),
    specFile: path.join(dir, 'specs', FEATURE, 'plan.md'),
    featureName: FEATURE,
    runtimeSession: 'test',
  });
}

function makeWorkflowFixture(receiptLines = [], plannedCommand = 'node --test') {
  const dir = tmpDir();
  const featureDir = path.join(dir, 'specs', FEATURE);
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Demo plan\n');
  const context = workflowRuntimeContext(dir);
  const task = [
    '# Task 01: demo',
    '',
    'Status: done',
    '',
    '## Dependencies',
    '',
    '- none',
    '',
    '## Verification Plan',
    '',
    `- Command: ${plannedCommand}`,
    '',
    ...receiptLines,
    '',
  ].join('\n')
    .replaceAll(VALID_BASE, context.base)
    .replaceAll(VALID_HEAD, context.head);
  fs.writeFileSync(path.join(featureDir, 'task-01-demo.md'), task);
  return dir;
}

function installFeatureReceipt(dir, featureName = FEATURE, session = 'test') {
  const featureDir = path.join(dir, 'specs', featureName);
  const specFile = path.join(featureDir, 'spec.json');
  if (!fs.existsSync(specFile)) return;
  let spec;
  try { spec = JSON.parse(fs.readFileSync(specFile, 'utf8')); } catch { return; }
  const lifecyclePhase = spec.current_phase || spec.phase;
  const explicitCloseout = ['completed', 'complete'].includes(spec.status)
    || ['closeout', 'completion', 'completed', 'complete'].includes(lifecyclePhase);
  if (!explicitCloseout) return;
  const tasks = Object.values(spec.task_registry || {});
  if (tasks.length === 0 || tasks.some((task) => task.status !== 'done')) return;
  const context = PROVENANCE.deriveRuntimeContext({
    projectRoot: dir,
    specsRoot: path.join(dir, 'specs'),
    specFile,
    featureName,
    runtimeSession: session,
  });
  fs.writeFileSync(path.join(featureDir, 'feature-receipt.md'), [
    `Feature: ${featureName}`,
    'Expected: final integration verification passes',
    'Observed: final integration verification passed',
    'Verification: PASS',
    'Command: node --test',
    'Exit: 0',
    `Base: ${context.base}`,
    `Head: ${context.head}`,
    '',
  ].join('\n'));
}

function clearCache() {
  try { fs.unlinkSync(CACHE); } catch { /* absent */ }
}

function seedCache(featureMap) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(featureMap));
}

function readCache() {
  return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
}

/**
 * Build a minimal active-spec fixture under dir.
 * @param {object} opts
 * @param {string} [opts.taskStatus='done']
 * @param {string|null} [opts.completed_at='2026-07-01T00:00:00Z']
 * @param {string} [opts.mdStatus='done']
 * @param {'valid'|'legacy-valid'|'failed'|'fence-only'|'missing-evidence'|'placeholder'|'none'} [opts.evidence='valid']
 * @param {object|null} [opts.runtime] — if set, write .claude/runtime.json
 * @param {object|null} [opts.workflowPolicy] — if set, persist completion obligations
 * @param {string} [opts.phase='closeout'] — persisted lifecycle boundary
 */
function makeFixture(opts = {}) {
  const {
    taskStatus = 'done',
    completed_at = '2026-07-01T00:00:00Z',
    mdStatus = 'done',
    evidence = 'valid',
    runtime = null,
    workflowPolicy = null,
    phase = 'closeout',
  } = opts;
  const dir = tmpDir();
  const featureDir = path.join(dir, 'specs', FEATURE);
  const tasksDir = path.join(featureDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });

  const entry = { status: taskStatus };
  if (completed_at !== null) entry.completed_at = completed_at;

  const spec = {
    status: 'in_progress',
    feature_name: FEATURE,
    current_phase: phase,
    task_registry: { [TASK_REL]: entry },
  };
  if (workflowPolicy) spec.workflow_policy = workflowPolicy;
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify(spec));

  let evidenceBlock = '';
  if (evidence === 'valid') {
    evidenceBlock = [
      '## Evidence',
      '',
      'Verification: PASS',
      'Command: npm test',
      'Exit: 0',
      'Result: PASS',
      `Base: ${VALID_BASE}`,
      `Head: ${VALID_HEAD}`,
      `Artifact: output/bundle.js (sha256:${FIXTURE_ARTIFACT_DIGEST})`,
      '```',
      'npm test',
      'PASS: 10 tests',
      '```',
      '',
    ].join('\n');
  } else if (evidence === 'legacy-valid') {
    evidenceBlock = `## Evidence\n\nVerification: PASS\nCommand: npm test\nExit: 0\nBase: ${VALID_BASE}\nHead: ${VALID_HEAD}\nnpm test — passed, exit code 0\n`;
  } else if (evidence === 'failed') {
    evidenceBlock = '## Evidence\n\nVerification: PASS\n\nFAIL: tests failed, exit code 1\n';
  } else if (evidence === 'fence-only') {
    evidenceBlock = '## Evidence\n\n```\nnpm test\n```\n';
  } else if (evidence === 'placeholder') {
    evidenceBlock = [
      '## Evidence',
      '',
      'Command: `{{TYPECHECK / TEST COMMAND}}`',
      'Expected: {{What proves success}}',
      '',
    ].join('\n');
  } else if (evidence === 'missing-evidence') {
    evidenceBlock = '## Risk Assessment\n\nNone.\n';
  } else {
    evidenceBlock = '';
  }

  fs.writeFileSync(
    path.join(dir, 'specs', FEATURE, TASK_REL),
    [
      `# Task R0-01: example`,
      '',
      `**Status:** ${mdStatus}`,
      '',
      evidenceBlock,
    ].join('\n'),
  );

  if (runtime) {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.claude', 'runtime.json'),
      JSON.stringify(runtime),
    );
  }

  if (evidence === 'valid') {
    fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'output', 'bundle.js'), FIXTURE_ARTIFACT);
  }
  if (evidence === 'valid' || evidence === 'legacy-valid') {
    const taskFile = path.join(dir, 'specs', FEATURE, TASK_REL);
    fs.writeFileSync(taskFile, bindFixtureReceipt(dir, fs.readFileSync(taskFile, 'utf8')));
  }

  return dir;
}

function parseBlock(stdout) {
  if (!stdout) return null;
  // Hook may print only the JSON line.
  try {
    return JSON.parse(stdout);
  } catch {
    const line = stdout.split('\n').find((l) => l.includes('"decision"'));
    if (!line) return null;
    return JSON.parse(line);
  }
}

function installClaudeGate(root, policyMode = 'valid') {
  const hooks = path.join(root, '.claude', 'hooks');
  const scripts = path.join(root, '.claude', 'scripts');
  fs.mkdirSync(hooks, { recursive: true });
  fs.mkdirSync(scripts, { recursive: true });
  fs.copyFileSync(HOOK, path.join(hooks, 'spec-gate.cjs'));
  fs.mkdirSync(path.join(hooks, 'lib'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', 'lib', 'runtime-dir.cjs'), path.join(hooks, 'lib', 'runtime-dir.cjs'));
  fs.copyFileSync(path.join(__dirname, '..', 'lib', 'hook-payload.cjs'), path.join(hooks, 'lib', 'hook-payload.cjs'));
  fs.copyFileSync(
    path.join(__dirname, '..', 'lib', 'hook-state-dir.cjs'),
    path.join(hooks, 'lib', 'hook-state-dir.cjs'),
  );
  for (const name of [
    'completion-authority-check.cjs', 'completion-authority-state.cjs', 'semantic-review-authority.cjs',
  ]) fs.copyFileSync(path.join(__dirname, '..', name), path.join(hooks, name));
  for (const name of ['spec-resolver.cjs', 'spec-receipt.cjs', 'validate-spec-output.cjs', 'spec-ground.cjs', 'spec-semantic-model.cjs', 'spec-final-state.cjs']) {
    fs.copyFileSync(path.join(__dirname, '..', '..', 'scripts', name), path.join(scripts, name));
  }
  if (policyMode === 'valid') {
    fs.copyFileSync(path.join(__dirname, '..', '..', 'scripts', 'workflow-policy.cjs'), path.join(scripts, 'workflow-policy.cjs'));
    fs.copyFileSync(path.join(__dirname, '..', '..', 'scripts', 'provenance.cjs'), path.join(scripts, 'provenance.cjs'));
  } else if (policyMode === 'malformed') {
    fs.writeFileSync(path.join(scripts, 'workflow-policy.cjs'), 'module.exports = {\n');
  }
  return path.join(hooks, 'spec-gate.cjs');
}

test('CLAUDE_PROJECT_DIR wins over malicious payload.cwd and stale process cwd', () => {
  const target = makeFixture({ evidence: 'missing-evidence' });
  const stale = tmpDir();
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const result = spawnSync(process.execPath, [HOOK], {
      cwd: stale,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: target,
        PROJECT_ROOT: stale,
      },
      input: JSON.stringify({
        hook_event_name: 'Stop',
        session_id: 'test',
        stop_hook_active: false,
        cwd: stale,
      }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const body = parseBlock(result.stdout.trim());
    assert.equal(body?.decision, 'block');
    assert.match(body.reason, new RegExp(TASK_REL.replace('/', '\\/')));
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(stale, { recursive: true, force: true });
  }
});

beforeEach(() => {
  clearCache();
});

after(() => {
  clearCache();
});

test('1. newly-done task WITHOUT receipt → block, reason names task path', () => {
  const dir = makeFixture({
    evidence: 'missing-evidence',
    completed_at: '2026-07-01T00:00:00Z',
  });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const { code, stdout } = runHook({}, dir);
    assert.strictEqual(code, 0);
    const body = parseBlock(stdout);
    assert.ok(body, 'expected block JSON on stdout');
    assert.strictEqual(body.decision, 'block');
    assert.ok(
      body.reason.includes(TASK_REL),
      `reason must name task path; got: ${body.reason}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('installed Claude gate fails closed with a controlled decision when policy is missing or malformed', () => {
  for (const policyMode of ['missing', 'malformed']) {
    const dir = tmpDir();
    const gate = installClaudeGate(dir, policyMode);
    try {
      const result = spawnSync(process.execPath, [gate], {
        cwd: dir,
        env: { ...process.env, PROJECT_ROOT: dir },
        input: JSON.stringify({ cwd: dir, session_id: 'test', stop_hook_active: false }),
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${policyMode}: ${result.stderr}`);
      assert.equal(result.stderr, '', `${policyMode} must not leak a stack trace`);
      const block = parseBlock(result.stdout);
      assert.equal(block?.decision, 'block', `${policyMode} must emit a controlled block`);
      assert.match(block.reason, /workflow policy could not be loaded/i);
      assert.ok(fs.existsSync(path.join(dir, '.claude', 'hooks', '.logs', 'hook-log.jsonl')));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('Claude adapter requires canonical SHA-256 only for a declared task artifact', () => {
  const digest = FIXTURE_ARTIFACT_DIGEST;
  const bodies = [
    { suffix: '', expected: true, label: 'missing hash' },
    { suffix: 'sha256: abc123\n', expected: true, label: 'invalid hash' },
    { suffix: `sha256: ${'0'.repeat(64)}\n`, expected: true, label: 'mismatched hash' },
    { suffix: `sha256: ${digest}\n`, expected: false, label: 'valid hash' },
  ];
  for (const { suffix, expected, label } of bodies) {
    const dir = tmpDir();
    const gate = installClaudeGate(dir);
    const featureDir = path.join(dir, 'specs', FEATURE);
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'output', 'bundle.js'), FIXTURE_ARTIFACT);
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
      status: 'in_progress',
      current_phase: 'closeout',
      feature_name: FEATURE,
      task_registry: {
        [TASK_REL]: {
          status: 'done',
          completed_at: '2026-08-11T00:00:00.000Z',
          artifacts: ['output/bundle.js'],
        },
      },
    }));
    fs.writeFileSync(path.join(featureDir, TASK_REL), [
      '# Task', '', '**Status:** done', '', '## Evidence', '',
      'Verification: PASS', 'Command: node --test', 'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
      'Artifact: output/bundle.js', suffix,
    ].join('\n'));
    fs.writeFileSync(
      path.join(featureDir, TASK_REL),
      bindFixtureReceipt(dir, fs.readFileSync(path.join(featureDir, TASK_REL), 'utf8')),
    );
    installFeatureReceipt(dir);
    try {
      const result = spawnSync(process.execPath, [gate], {
        cwd: dir,
        env: { ...process.env, PROJECT_ROOT: dir },
        input: JSON.stringify({ cwd: dir, session_id: 'test', stop_hook_active: false }),
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      if (expected) {
        const block = parseBlock(result.stdout);
        assert.equal(block?.decision, 'block', `${label} must block`);
        assert.match(block.reason, /\bartifact_hash\b/);
      } else {
        assert.equal(result.stdout, '', `${label} must pass`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('Claude artifact verification rejects traversal and symlink paths', () => {
  const cases = [
    { artifactPath: '../outside.js', symlink: false },
    { artifactPath: 'output/link.js', symlink: true },
  ];
  for (const { artifactPath, symlink } of cases) {
    const dir = tmpDir();
    const featureDir = path.join(dir, 'specs', FEATURE);
    const artifactBytes = Buffer.from(`artifact-${artifactPath}\n`);
    const digest = crypto.createHash('sha256').update(artifactBytes).digest('hex');
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    if (symlink) {
      fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
      const target = path.join(dir, 'artifact-target.js');
      fs.writeFileSync(target, artifactBytes);
      fs.symlinkSync(target, path.join(dir, artifactPath));
    } else {
      fs.writeFileSync(path.join(dir, 'outside.js'), artifactBytes);
    }
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
      status: 'in_progress',
      current_phase: 'closeout',
      feature_name: FEATURE,
      task_registry: {
        [TASK_REL]: {
          status: 'done',
          completed_at: '2026-08-11T00:00:00.000Z',
          artifacts: [artifactPath],
        },
      },
    }));
    fs.writeFileSync(path.join(featureDir, TASK_REL), bindFixtureReceipt(dir, [
      '# Task', '', '**Status:** done', '', '## Evidence', '',
      'Verification: PASS', 'Command: node --test', 'Exit: 0',
      `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
      `Artifact: ${artifactPath} (sha256:${digest})`,
    ].join('\n')));
    try {
      const body = parseBlock(runHook({}, dir).stdout);
      assert.equal(body?.decision, 'block', `${artifactPath} must block`);
      assert.match(body.reason, /\bartifact_hash\b/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('2. newly-done task WITH valid receipt → no block, cache updated', () => {
  const dir = makeFixture({ evidence: 'valid' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const { code, stdout } = runHook({}, dir);
    assert.strictEqual(code, 0);
    assert.strictEqual(stdout, '', 'valid receipt must not produce block output');
    const cache = readCache();
    assert.strictEqual(cache[FEATURE][TASK_REL], 'done');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('3. no active spec → exit 0 silent', () => {
  const dir = tmpDir();
  try {
    fs.mkdirSync(path.join(dir, 'specs'), { recursive: true });
    // No in_progress spec.
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const { code, stdout } = runHook({}, dir);
    assert.strictEqual(code, 0);
    assert.strictEqual(stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('4. stop_hook_active: true → exit 0 silent even with violating task', () => {
  const dir = makeFixture({ evidence: 'missing-evidence' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const { code, stdout } = runHook({ stop_hook_active: true }, dir);
    assert.strictEqual(code, 0);
    assert.strictEqual(stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('4b. done task before explicit closeout without receipt blocks', () => {
  const dir = makeFixture({ evidence: 'missing-evidence', phase: 'implementation' });
  try {
    const { code, stdout } = runHook({}, dir);
    assert.strictEqual(code, 0);
    const body = parseBlock(stdout);
    assert.strictEqual(body?.decision, 'block');
    assert.match(body.reason, new RegExp(TASK_REL));
    assert.strictEqual(fs.existsSync(path.join(dir, 'specs', FEATURE, 'feature-receipt.md')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('4c. done task before explicit closeout with valid task receipt is silent', () => {
  const dir = makeFixture({ evidence: 'valid', phase: 'implementation' });
  try {
    const { code, stdout } = runHook({}, dir);
    assert.strictEqual(code, 0);
    assert.strictEqual(stdout, '');
    assert.strictEqual(fs.existsSync(path.join(dir, 'specs', FEATURE, 'feature-receipt.md')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('5. first run (no cache) with done-without-receipt → block (cache is not truth)', () => {
  const dir = makeFixture({ evidence: 'missing-evidence' });
  try {
    clearCache();
    assert.ok(!fs.existsSync(CACHE), 'cache must be absent for first-run');
    const { code, stdout } = runHook({}, dir);
    assert.strictEqual(code, 0);
    const body = parseBlock(stdout);
    assert.ok(body, 'first run must block done without receipt');
    assert.strictEqual(body.decision, 'block');
    assert.ok(body.reason.includes(TASK_REL));
    assert.ok(fs.existsSync(CACHE), 'cache file must be created even when blocking');
    const cache = readCache();
    // failing task must not be cached as done
    assert.strictEqual(cache[FEATURE]?.[TASK_REL], undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('6. forged payload, session, and context cannot bypass completion_gate=false', () => {
  const dir = makeFixture({
    evidence: 'missing-evidence',
    runtime: { spec: { completion_gate: false } },
  });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const { code, stdout } = runHook({
      user_authorized: true,
      userAuthorized: true,
      completion_gate_override: { authorized: true, session_id: 'test', nonce: 'forged' },
      session: { id: 'test', user_authorized: true },
      runtime_context: { project_root: dir, completion_gate: true, signed: true },
    }, dir);
    assert.strictEqual(code, 0);
    const body = parseBlock(stdout);
    assert.equal(body?.decision, 'block');
    assert.match(body.reason, /no completion-gate bypass is supported/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('empty or malformed Claude hook payload fails closed', () => {
  const dir = tmpDir();
  const gate = installClaudeGate(dir);
  try {
    for (const input of ['', 'null', '[]']) {
      const result = spawnSync(process.execPath, [gate], {
        cwd: dir,
        env: { ...process.env, PROJECT_ROOT: dir },
        input,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${JSON.stringify(input)}: ${result.stderr}`);
      assert.equal(result.stderr, '');
      const block = parseBlock(result.stdout);
      assert.equal(block?.decision, 'block', `${JSON.stringify(input)} must block`);
      assert.match(block.reason, /hook payload (is empty|must be a JSON object)/i);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('explicit Strict completion ignores worker-writable proof strings and remains blocked', () => {
  const dir = makeFixture({
    workflowPolicy: POLICY.workflowPolicySnapshot({ riskSignals: { auth: true }, assurance_level: 'Strict' }),
  });
  try {
    const specPath = path.join(dir, 'specs', FEATURE, 'spec.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    spec.proofs = {
      needsInspection: 'inspection completed',
      needsIndependentAudit: 'PASS',
      needsResearchGrounding: 'research completed',
    };
    fs.writeFileSync(specPath, JSON.stringify(spec));
    const body = parseBlock(runHook({}, dir).stdout);
    assert.equal(body?.decision, 'block');
    assert.match(body.reason, /needsInspection|needsIndependentAudit|needsResearchGrounding/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('7. Evidence with {{...}} placeholder → blocked (placeholder)', () => {
  const dir = makeFixture({ evidence: 'placeholder' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const { code, stdout } = runHook({}, dir);
    assert.strictEqual(code, 0);
    const body = parseBlock(stdout);
    assert.ok(body, 'expected block JSON on stdout');
    assert.strictEqual(body.decision, 'block');
    assert.ok(
      body.reason.includes(TASK_REL) && /\bplaceholder\b/.test(body.reason),
      `reason must cite task path and placeholder; got: ${body.reason}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('8. explicit failure cannot pass even when PASS text is present', () => {
  const dir = makeFixture({ evidence: 'failed' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body);
    assert.match(body.reason, /\bverification_state\b/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('9. a code fence alone is not verification proof', () => {
  const dir = makeFixture({ evidence: 'fence-only' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    assert.ok(parseBlock(runHook({}, dir).stdout));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('10. completed_at must be a valid ISO timestamp', () => {
  const dir = makeFixture({ completed_at: 'yesterday' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body);
    assert.match(body.reason, /\bcompleted_at\b/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('11. done → pending cache transition is persisted and explicit closeout gates re-completion', () => {
  const dir = makeFixture({ taskStatus: 'pending', mdStatus: 'pending', phase: 'implementation' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'done' } });
    assert.strictEqual(runHook({}, dir).stdout, '');
    assert.strictEqual(readCache()[FEATURE][TASK_REL], 'pending');

    const specFile = path.join(dir, 'specs', FEATURE, 'spec.json');
    const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
    spec.task_registry[TASK_REL] = {
      status: 'done',
      completed_at: '2026-07-01T00:00:00Z',
    };
    spec.current_phase = 'closeout';
    fs.writeFileSync(specFile, JSON.stringify(spec));
    const taskFile = path.join(dir, 'specs', FEATURE, TASK_REL);
    fs.writeFileSync(taskFile, '# Task\n\n**Status:** done\n\n## Evidence\n\nFAIL: tests failed\n');

    assert.ok(parseBlock(runHook({}, dir).stdout), 're-completed failing task must be gated');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('12. legacy successful receipt remains read-compatible', () => {
  const dir = makeFixture({ evidence: 'legacy-valid' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    assert.strictEqual(runHook({}, dir).stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('13. provenance requires both Base and Head - only Base fails', () => {
  const dir = tmpDir();
  const featureDir = path.join(dir, 'specs', FEATURE);
  const tasksDir = path.join(featureDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
    status: 'in_progress',
    feature_name: FEATURE,
    current_phase: 'closeout',
    task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } },
  }));
  // Only Base, missing Head
  fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), bindFixtureReceipt(dir, [
    '# Task',
    '',
    '**Status:** done',
    '',
    '## Evidence',
    '',
    'Verification: PASS',
    'Command: npm test',
    'Exit: 0',
    `Base: ${VALID_BASE}`,
    '```',
    'npm test PASS',
    '```',
  ].join('\n')));
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'only Base should block');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /\bprovenance\b/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('14. provenance requires both Base and Head - only Head fails', () => {
  const dir = tmpDir();
  const featureDir = path.join(dir, 'specs', FEATURE);
  const tasksDir = path.join(featureDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
    status: 'in_progress',
    feature_name: FEATURE,
    current_phase: 'closeout',
    task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } },
  }));
  // Only Head, missing Base
  fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), [
    '# Task',
    '',
    '**Status:** done',
    '',
    '## Evidence',
    '',
    'Verification: PASS',
    'Command: npm test',
    'Exit: 0',
    `Head: ${VALID_HEAD}`,
    '```',
    'npm test PASS',
    '```',
  ].join('\n'));
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'only Head should block');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /\bprovenance\b/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('15. provenance with both Base and Head passes', () => {
  const dir = tmpDir();
  const featureDir = path.join(dir, 'specs', FEATURE);
  const tasksDir = path.join(featureDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
    status: 'in_progress',
    feature_name: FEATURE,
    current_phase: 'closeout',
    task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } },
  }));
  fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), bindFixtureReceipt(dir, [
    '# Task',
    '',
    '**Status:** done',
    '',
    '## Evidence',
    '',
    'Verification: PASS',
    'Command: npm test',
    'Exit: 0',
    `Base: ${VALID_BASE}`,
    `Head: ${VALID_HEAD}`,
    '```',
    'npm test PASS',
    '```',
  ].join('\n')));
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const { stdout } = runHook({}, dir);
    assert.strictEqual(stdout, '', 'both Base and Head should not block');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('16. registry task path with ../ escape or sibling-prefix is rejected (check a)', () => {
  const dir = tmpDir();
  const featureDir = path.join(dir, 'specs', FEATURE);
  const evilFeature = path.join(dir, 'specs', `${FEATURE}-evil`);
  const maliciousRel = `../${FEATURE}-evil/tasks/task.md`;
  const maliciousAbs = path.join(evilFeature, 'tasks/task.md');
  // Prepare evil file with valid receipt outside feature (should be ignored due to path traversal)
  fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(evilFeature, 'tasks'), { recursive: true });
  fs.writeFileSync(maliciousAbs, [
    '# Task',
    '',
    '**Status:** done',
    '',
    '## Evidence',
    '',
    'Verification: PASS',
    'Command: npm test',
    'Exit: 0',
    `Base: ${VALID_BASE}`,
    `Head: ${VALID_HEAD}`,
    '```',
    'pass',
    '```',
  ].join('\n'));
  // Also create sibling-prefix style path: tasks/../../demo-evil/tasks/task.md
  const siblingPrefixRel = `tasks/../../${FEATURE}-evil/tasks/task.md`;
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
    status: 'in_progress',
    feature_name: FEATURE,
    current_phase: 'closeout',
    task_registry: {
      [maliciousRel]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' },
      [siblingPrefixRel]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' },
      [path.resolve(featureDir, maliciousRel)]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' },
    },
  }));
  try {
    seedCache({ [FEATURE]: { [maliciousRel]: 'pending', [siblingPrefixRel]: 'pending', [path.resolve(featureDir, maliciousRel)]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'traversal path should block');
    assert.strictEqual(body.decision, 'block');
    // Must fail check a (file + Status)
    assert.match(body.reason, /\ba\b/);
    // Ensure malicious path is named in reason
    assert.ok(body.reason.includes(maliciousRel) || body.reason.includes(siblingPrefixRel));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('17. empty or bare provenance fails — Base:/Head: require non-empty same-line values', () => {
  const cases = [
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0','Base:','Head: def456'].join('\n'), desc: 'empty Base:' },
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0','Base:   ','Head: def456'].join('\n'), desc: 'Base: spaces only' },
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0','Base: abc','Head:'].join('\n'), desc: 'empty Head:' },
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0','base_sha','head_sha: def'].join('\n'), desc: 'bare base_sha without colon' },
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0','base_sha:','head_sha: def'].join('\n'), desc: 'empty base_sha:' },
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0','base_sha:   ','head_sha: def'].join('\n'), desc: 'base_sha spaces only' },
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0','base_sha head_sha'].join('\n'), desc: 'bare base_sha head_sha without colon' },
  ];
  for (const { evidence, desc } of cases) {
    const dir = tmpDir();
    const featureDir = path.join(dir, 'specs', FEATURE);
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
    status: 'in_progress',
    feature_name: FEATURE,
    current_phase: 'closeout',
      task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } },
    }));
    fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), ['# Task','','**Status:** done','','## Evidence','','' + evidence,'```','pass','```'].join('\n'));
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, `empty/bare provenance should block for ${desc}`);
    assert.strictEqual(body.decision, 'block', `empty/bare should block: ${desc}`);
    assert.match(body.reason, /\bprovenance\b/, `should fail provenance for ${desc}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('18. valid non-empty Base: value and base_sha: value pass', () => {
  const validCases = [
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0',`Base: ${VALID_BASE}`,`Head: ${VALID_HEAD}`].join('\n'), shouldPass: true },
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0',`base_sha: ${VALID_BASE}`,`head_sha: ${VALID_HEAD}`].join('\n'), shouldPass: true },
    { evidence: ['Verification: PASS','Command: npm test','Exit: 0',`Base: ${'a'.repeat(40)}`,`Head: ${'b'.repeat(40)}`].join('\n'), shouldPass: false },
  ];
  for (const { evidence, shouldPass } of validCases) {
    const dir = tmpDir();
    const featureDir = path.join(dir, 'specs', FEATURE);
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
      status: 'in_progress',
      feature_name: FEATURE,
      current_phase: 'closeout',
      task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } },
    }));
    const boundEvidence = shouldPass ? bindFixtureReceipt(dir, evidence) : evidence;
    fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), ['# Task','','**Status:** done','','## Evidence','','' + boundEvidence,'```','pass','```'].join('\n'));
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const result = runHook({}, dir);
    if (shouldPass) assert.strictEqual(result.stdout, '', `valid provenance should not block: ${evidence.slice(0,40)}`);
    else assert.match(parseBlock(result.stdout).reason, /\bprovenance\b/, 'arbitrary valid-length SHA values must block');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- Cache-hardening regressions: cached PASS must not hide later mutations ---

test('19. cache-hit: unchanged valid receipt stays PASS on second Stop (revalidation)', () => {
  const dir = makeFixture({ evidence: 'valid' });
  try {
    clearCache();
    // first Stop (no cache file) with valid receipt → no block, cache seeded as done
    let res = runHook({}, dir);
    assert.strictEqual(res.stdout, '', 'first run valid must not block');
    assert.strictEqual(readCache()[FEATURE][TASK_REL], 'done');
    // second Stop with same valid receipt and cache-hit → must still not block
    res = runHook({}, dir);
    assert.strictEqual(res.stdout, '', 'cache-hit with unchanged valid receipt must not block');
    assert.strictEqual(readCache()[FEATURE][TASK_REL], 'done');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('20. cache-hit: receipt mutation (removed Verification/Command) blocks even though status stays done', () => {
  const dir = makeFixture({ evidence: 'valid' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    assert.strictEqual(runHook({}, dir).stdout, '', 'initial valid must pass');
    assert.strictEqual(readCache()[FEATURE][TASK_REL], 'done');
    // mutate: strip Verification: PASS and Command — keep file as done
    const taskFile = path.join(dir, 'specs', FEATURE, TASK_REL);
    fs.writeFileSync(taskFile, [
      '# Task', '', '**Status:** done', '',
      '## Evidence', '',
      'Exit: 0', `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`,
      '```', 'pass', '```',
    ].join('\n'));
    const blocked = parseBlock(runHook({}, dir).stdout);
    assert.ok(blocked, 'mutated receipt missing Verification/Command should block on cache-hit');
    assert.strictEqual(blocked.decision, 'block');
    assert.match(blocked.reason, /\bverification_state\b|\bcommand\b/);
    // cache must not have been promoted to still-valid done; next run must still block
    const secondBlocked = parseBlock(runHook({}, dir).stdout);
    assert.ok(secondBlocked, 'second hit after mutation must still block');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('21. cache-hit: provenance mutation (removed Head / changed to stale) blocks', () => {
  const dir = makeFixture({ evidence: 'valid' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    assert.strictEqual(runHook({}, dir).stdout, '');
    // mutate: remove Head, leave only Base
    const taskFile = path.join(dir, 'specs', FEATURE, TASK_REL);
    fs.writeFileSync(taskFile, [
      '# Task', '', '**Status:** done', '',
      '## Evidence', '', 'Verification: PASS', 'Command: npm test', 'Exit: 0', `Base: ${VALID_BASE}`,
      '```', 'pass', '```',
    ].join('\n'));
    let body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'missing Head provenance should block on cache-hit');
    assert.match(body.reason, /\bprovenance\b/);
    // mutate back to include both but with empty Head value (stale)
    fs.writeFileSync(taskFile, [
      '# Task', '', '**Status:** done', '',
      '## Evidence', '', 'Verification: PASS', 'Command: npm test', 'Exit: 0', `Base: ${VALID_BASE}`, 'Head:',
      '```', 'pass', '```',
    ].join('\n'));
    body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'empty Head should block as stale provenance');
    assert.match(body.reason, /\bprovenance\b/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('22. cache-hit: deleted task file blocks even though spec still says done', () => {
  const dir = makeFixture({ evidence: 'valid' });
  try {
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    assert.strictEqual(runHook({}, dir).stdout, '');
    assert.strictEqual(readCache()[FEATURE][TASK_REL], 'done');
    fs.unlinkSync(path.join(dir, 'specs', FEATURE, TASK_REL));
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'deleted receipt file should block on cache-hit');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /\ba\b/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('23. malformed cache JSON does not bypass validation', () => {
  // valid receipt with malformed cache → must still PASS (fail-open on cache parse, not on receipt)
  const dirValid = makeFixture({ evidence: 'valid' });
  try {
    clearCache();
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, '{ not json');
    const res = runHook({}, dirValid);
    assert.strictEqual(res.stdout, '', 'malformed cache with valid receipt must not block');
    assert.ok(fs.existsSync(CACHE), 'hook must rewrite cache file');
  } finally {
    fs.rmSync(dirValid, { recursive: true, force: true });
  }
  // invalid receipt with malformed cache → must still BLOCK (cache not truth)
  const dirInvalid = makeFixture({ evidence: 'missing-evidence' });
  try {
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, '{ malformed: ');
    const body = parseBlock(runHook({}, dirInvalid).stdout);
    assert.ok(body, 'malformed cache with invalid receipt must block');
    assert.strictEqual(body.decision, 'block');
  } finally {
    fs.rmSync(dirInvalid, { recursive: true, force: true });
  }
});

test('24. first-run (no cache file) with valid receipt passes and seeds cache', () => {
  const dir = makeFixture({ evidence: 'valid' });
  try {
    clearCache();
    assert.ok(!fs.existsSync(CACHE));
    const { stdout } = runHook({}, dir);
    assert.strictEqual(stdout, '', 'first run valid receipt must not block');
    assert.ok(fs.existsSync(CACHE), 'cache must be created on first valid run');
    assert.strictEqual(readCache()[FEATURE][TASK_REL], 'done');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('25. placeholder tokens Command: TODO / Base: TBD / artifact sha256 empty must block', () => {
  const cases = [
    { evidence: ['Verification: PASS','Command: TODO','Exit: 0','Base: a','Head: b'].join('\n'), check: /\bcommand\b/, desc: 'Command TODO' },
    { evidence: ['Verification: PASS','Command: pnpm test','Exit: 0','Base: TBD','Head: b'].join('\n'), check: /\bprovenance\b/, desc: 'Base TBD' },
    { evidence: ['Verification: PASS','Command: pnpm test','Exit: 0','Base: a','Head: N/A'].join('\n'), check: /\bprovenance\b/, desc: 'Head N/A' },
    { evidence: ['Verification: PASS','Command: pnpm test','Exit: 0','base_sha: pending','head_sha: unknown'].join('\n'), check: /\bprovenance\b/, desc: 'base_sha pending' },
    { evidence: ['Verification: PASS','Command: pnpm test','Exit: 0','Base: a','Head: b','Artifact: bundle','sha256: '].join('\n'), check: /\bartifact_hash\b/, desc: 'artifact empty sha' },
    { evidence: ['Verification: PASS','Command: pnpm test','Exit: 0','Base: a','Head: b','Artifact: bundle','sha256: TBD'].join('\n'), check: /\bartifact_hash\b/, desc: 'artifact TBD sha' },
  ];
  for (const { evidence, check, desc } of cases) {
    const dir = tmpDir();
    const featureDir = path.join(dir, 'specs', FEATURE);
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: FEATURE, current_phase: 'closeout', task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } } }));
    fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), ['# Task','','**Status:** done','','## Evidence','','' + evidence,'```','pass','```'].join('\n'));
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, `placeholder case ${desc} should block`);
    assert.strictEqual(body.decision, 'block', desc);
    assert.match(body.reason, check, `check for ${desc}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // Ensure normal todo substring does NOT block
  const dir2 = tmpDir();
  const featureDir2 = path.join(dir2, 'specs', FEATURE);
  fs.mkdirSync(path.join(featureDir2, 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(featureDir2, 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: FEATURE, current_phase: 'closeout', task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } } }));
  fs.writeFileSync(path.join(dir2, 'specs', FEATURE, TASK_REL), bindFixtureReceipt(dir2, ['# Task','','**Status:** done','','## Evidence','','Verification: PASS','Command: npm run todo:test','Exit: 0',`Base: ${VALID_BASE}`,`Head: ${VALID_HEAD}`,'```','pass','```'].join('\n')));
  seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
  assert.strictEqual(runHook({}, dir2).stdout, '', 'command containing todo substring should not block');
  fs.rmSync(dir2, { recursive: true, force: true });
});

test('26. explicit failure outcomes Tests failed / Result FAIL and multiple Results must block', () => {
  const cases = [
    { evidence: ['Verification: PASS','Command: pnpm test','Exit: 0','Base: a','Head: b','Tests failed: 1'].join('\n'), desc: 'Tests failed: 1' },
    { evidence: ['Verification: PASS','Command: pnpm test','Exit: 0','Base: a','Head: b','Result: FAIL','Result: PASS'].join('\n'), desc: 'Result FAIL then PASS' },
    { evidence: ['Verification: PASS','Command: pnpm test','Exit: 0','Base: a','Head: b','0 tests passed'].join('\n'), desc: '0 tests' },
  ];
  for (const { evidence, desc } of cases) {
    const dir = tmpDir();
    const featureDir = path.join(dir, 'specs', FEATURE);
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: FEATURE, current_phase: 'closeout', task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } } }));
    fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), ['# Task','','**Status:** done','','## Evidence','','' + evidence,'```','pass','```'].join('\n'));
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, `explicit failure ${desc} should block`);
    assert.strictEqual(body.decision, 'block');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('27. task markdown symlink outside feature must be rejected (check a)', () => {
  const dir = tmpDir();
  const featureDir = path.join(dir, 'specs', FEATURE);
  fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: FEATURE, current_phase: 'closeout', task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } } }));
  const outside = path.join(dir, 'outside.md');
  fs.writeFileSync(outside, '# Task\n\n**Status:** done\n\n## Evidence\n\nVerification: PASS\nCommand: pnpm test\nExit: 0\nBase: a\nHead: b\n');
  const taskPath = path.join(dir, 'specs', FEATURE, TASK_REL);
  try { fs.unlinkSync(taskPath); } catch {}
  fs.symlinkSync(outside, taskPath);
  seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
  const body = parseBlock(runHook({}, dir).stdout);
  assert.ok(body, 'symlink task outside should block');
  assert.strictEqual(body.decision, 'block');
  assert.match(body.reason, /\ba\b/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('28. malformed spec.json must block with invalid_specs', () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'specs', 'good'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'specs', 'bad'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'specs', 'good', 'spec.json'), JSON.stringify({ status: 'in_progress', feature_name: 'good', task_registry: {} }));
  fs.writeFileSync(path.join(dir, 'specs', 'bad', 'spec.json'), '{ malformed');
  seedCache({});
  const { stdout } = runHook({}, dir);
  const body = parseBlock(stdout);
  assert.ok(body, 'malformed spec should block');
  assert.strictEqual(body.decision, 'block');
  assert.match(body.reason, /invalid spec/i);
  assert.match(body.reason, /bad/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('29. specs/linked symlink outside must be explicit_malformed and non-explicit scan must not count it', () => {
  const dir = tmpDir();
  const specsDir = path.join(dir, 'specs');
  fs.mkdirSync(specsDir, { recursive: true });
  const outside = path.join(dir, 'outside-feat');
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'spec.json'), JSON.stringify({ status: 'in_progress' }));
  const link = path.join(specsDir, 'linked');
  fs.symlinkSync(outside, link);
  // non-explicit should block with invalid_specs (fail-closed, not phantom no-active)
  seedCache({});
  const nonExplicit = parseBlock(runHook({}, dir).stdout);
  assert.ok(nonExplicit, 'non-explicit symlink outside should block with invalid_specs');
  assert.strictEqual(nonExplicit.decision, 'block');
  assert.match(nonExplicit.reason, /invalid spec/i);
  assert.match(nonExplicit.reason, /linked/);
  // explicit should block explicit_malformed
  const body = parseBlock(runHook({ featureName: 'linked' }, dir).stdout);
  assert.ok(body);
  assert.strictEqual(body.decision, 'block');
  assert.match(body.reason, /explicit_malformed/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('30. phantom vectors via gate evidence must block with verification_state (r3)', () => {
  const vectors = [
    'ℹ tests 0',
    'Tests: 0 total',
    '0 tests',
    'collected 0 items',
    'No tests found.',
    'ℹ cancelled 1',
    'cancelled 1',
    '1 cancelled',
    'Test Suites: 1 failed, 1 total',
    'FAIL ./foo.test.js',
    'FAIL\tpackage',
    'FAIL\texample.test/probe\t0.431s',
    '--- FAIL: TestName (0.00s)',
    'FAILED tests/test_demo.py::test_foo - assert 1 == 2',
    'FAILED tests/test_demo.py',
    '# fail 1',
    'ℹ fail 1',
    'not ok 1 - test',
    '1 error in 0.12s',
    'ERROR collecting tests/test_demo.py',
    'Found 2 errors',
    'Tests run: 5, Failures: 1, Errors: 0',
    '[ERROR] Tests run: 5, Failures: 1, Errors: 0, Skipped: 0',
    '[ERROR] Tests run: 5, Failures: 0, Errors: 1, Skipped: 0',
    '[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.2.5:test',
    '5 tests completed, 1 failed',
  ];
  for (const v of vectors) {
    const dir = tmpDir();
    const featureDir = path.join(dir, 'specs', FEATURE);
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
      status: 'in_progress',
      feature_name: FEATURE,
      current_phase: 'closeout',
      task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } },
    }));
    const evidence = bindFixtureReceipt(dir, ['Verification: PASS','Command: npm test','Exit: 0',`Base: ${VALID_BASE}`,`Head: ${VALID_HEAD}`, v].join('\n'));
    fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), ['# Task','','**Status:** done','','## Evidence','','' + evidence,'```','pass','```'].join('\n'));
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, `vector should block: ${v}`);
    assert.strictEqual(body.decision, 'block', `vector ${v} should block`);
    assert.match(body.reason, /\bverification_state\b/, `vector ${v} should fail verification_state`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // positive controls must not block
  const passes = [
    'Tests failed: 0',
    'fail 0',
    'Tests: 0 failed',
    'cancelled 0',
    'Test Suites: 0 failed',
    '5 tests completed, 0 failed',
    'errors 0',
    'Found 0 errors',
    'collected 1 item',
    '[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0',
    '[ERROR] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0',
    '[ERROR] Error handling is documented',
    'Error handling is documented',
    'FAILURE mode analysis',
    'Notes: tests failed previously but now fixed',
    'Notes: supports zero-test parsing',
    '# tests 1',
    '# suites 0',
    '# pass 1',
    '# fail 0',
    '# cancelled 0',
    '# skipped 0',
    '# todo 0',
    '# duration_ms 114.203625',
  ];
  for (const v of passes) {
    const dir = tmpDir();
    const featureDir = path.join(dir, 'specs', FEATURE);
    fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify({
      status: 'in_progress',
      feature_name: FEATURE,
      current_phase: 'closeout',
      task_registry: { [TASK_REL]: { status: 'done', completed_at: '2026-07-01T00:00:00Z' } },
    }));
    const evidence = bindFixtureReceipt(dir, ['Verification: PASS','Command: npm test','Exit: 0',`Base: ${VALID_BASE}`,`Head: ${VALID_HEAD}`, v].join('\n'));
    fs.writeFileSync(path.join(dir, 'specs', FEATURE, TASK_REL), ['# Task','','**Status:** done','','## Evidence','','' + evidence,'```','pass','```'].join('\n'));
    seedCache({ [FEATURE]: { [TASK_REL]: 'pending' } });
    const { stdout } = runHook({}, dir);
    assert.strictEqual(stdout, '', `positive control should not block: ${v}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('31. process-v3 done task without inline Receipt blocks', () => {
  const dir = makeWorkflowFixture();
  try {
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'missing process-v3 receipt should block');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /missing_receipt/);
    assert.match(body.reason, /## Receipt/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('32. process-v3 requires Receipt heading and runtime-bound provenance', () => {
  const legacyHeading = makeWorkflowFixture([
    '## Evidence', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '```text', 'pass', '```',
  ]);
  try {
    clearCache();
    const body = parseBlock(runHook({}, legacyHeading).stdout);
    assert.ok(body, 'legacy Evidence heading must not satisfy process-v3 receipt');
    assert.match(body.reason, /missing_receipt/);
  } finally {
    fs.rmSync(legacyHeading, { recursive: true, force: true });
  }

  // Base and Head are compared against the runtime for a task file that has a copy in
  // HEAD and no longer matches it. That is the state a stale pair has to reach now:
  // committing a packet is the user's choice, so an uncommitted one is not bound.
  const stale = makeWorkflowFixture(boundReceipt());
  try {
    commitAll(stale, 'receipt');
    const taskFile = path.join(stale, 'specs', FEATURE, 'task-01-demo.md');
    fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8')
      .replace(/^Head: .*$/m, `Head: ${VALID_BASE}`));
    clearCache();
    const body = parseBlock(runHook({}, stale).stdout);
    assert.ok(body, 'stale process-v3 provenance should block once the packet is committed');
    assert.match(body.reason, /provenance/);
  } finally {
    fs.rmSync(stale, { recursive: true, force: true });
  }
});

test('32b. process-v3 ignores a Receipt heading and proof contained only in a fence', () => {
  const dir = makeWorkflowFixture([
    '~~~~markdown', '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '```text', 'pass: 1', '```', '~~~~',
  ]);
  try {
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'fenced-only process-v3 Receipt must block');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /missing_receipt/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('32c. process-v3 ignores canonical Receipt fields contained only in its output fence', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', '```text', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, 'pass: 1', '```',
  ]);
  try {
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'fenced-only canonical fields must block');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /verification_state/);
    assert.match(body.reason, /command/);
    assert.match(body.reason, /provenance/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('32d. process-v3 preserves explicit failures from the Receipt output fence', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '```text', '$ node --test',
    'exit code: 1', 'FAIL', '```',
  ]);
  try {
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'explicit fenced output failure must block');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /verification_state/);
    assert.match(body.reason, /exit_result/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('32e. process-v3 rejects output whose closing fence is shorter than its opener', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '````text', '$ node --test',
    'pass: 1', '```',
  ]);
  try {
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'malformed output fence must block');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /command_output/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('33. process-v3 done task with canonical inline Receipt passes', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '```text', '$ node --test',
    'Status: pending', '## Receipt', 'pass: 1', '```',
  ]);
  try {
    clearCache();
    const result = runHook({}, dir);
    assert.strictEqual(result.code, 0, result.stderr);
    assert.strictEqual(result.stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('34. process-v3 Receipt command must match the exact Verification Plan command', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: true', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '```text', '$ true', 'pass: 1', '```',
  ], 'pnpm test');
  try {
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body, 'a substituted receipt command must block');
    assert.strictEqual(body.decision, 'block');
    assert.match(body.reason, /command_identity/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('35. process-v3 Stop ignores a completed packet when one packet remains active', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '```text', '$ node --test', 'pass: 1', '```',
  ]);
  try {
    const activeDir = path.join(dir, 'specs', 'active');
    fs.mkdirSync(activeDir, { recursive: true });
    fs.writeFileSync(path.join(activeDir, 'plan.md'), '# Active plan\n');
    fs.writeFileSync(path.join(activeDir, 'task-01-active.md'), [
      '# Task 01: active', '', 'Status: pending', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
    ].join('\n'));
    clearCache();
    const result = runHook({}, dir);
    assert.strictEqual(result.code, 0, result.stderr);
    assert.strictEqual(result.stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('36. process-v3 Stop accepts two completed packets with valid Receipts', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '```text', '$ node --test', 'pass: 1', '```',
  ]);
  try {
    const otherDir = path.join(dir, 'specs', 'other');
    fs.mkdirSync(otherDir, { recursive: true });
    fs.writeFileSync(path.join(otherDir, 'plan.md'), '# Other plan\n');
    const context = PROVENANCE.deriveRuntimeContext({
      projectRoot: dir,
      specsRoot: path.join(dir, 'specs'),
      specFile: path.join(otherDir, 'plan.md'),
      featureName: 'other',
      runtimeSession: 'test',
    });
    fs.writeFileSync(path.join(otherDir, 'task-01-other.md'), [
      '# Task 01: other', '', 'Status: done', '',
      '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '',
      '## Receipt', '',
      'Verification: PASS', 'Command: node --test', 'Exit: 0',
      `Base: ${context.base}`, `Head: ${context.head}`,
      '```text', '$ node --test', 'pass: 1', '```', '',
    ].join('\n'));
    clearCache();
    const result = runHook({}, dir);
    assert.strictEqual(result.code, 0, result.stderr);
    assert.strictEqual(result.stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Receipt freshness: bound while written or altered, structure-only once committed on a clean tree ──

const STALE_BASE = 'f'.repeat(40);
const STALE_HEAD = 'e'.repeat(40);

function commitAll(dir, message) {
  for (const args of [['add', '-A'], ['commit', '-qm', message, '--allow-empty']]) {
    const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
  }
}

function boundReceipt(base = VALID_BASE, head = VALID_HEAD) {
  return [
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${base}`, `Head: ${head}`, '```text', '$ node --test', 'pass: 1', '```',
  ];
}

function runHookFrom(dir, cwd) {
  const res = spawnSync(process.execPath, [HOOK], {
    cwd,
    input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'test', transcript_path: '/tmp/t', stop_hook_active: false, cwd: dir }),
    encoding: 'utf8',
    env: { ...process.env, PROJECT_ROOT: dir },
  });
  return { code: res.status, stdout: (res.stdout || '').trim(), stderr: res.stderr || '' };
}

test('37. committed receipt on a clean tree survives later commits', () => {
  const dir = makeWorkflowFixture(boundReceipt());
  try {
    commitAll(dir, 'receipt');
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'unrelated.txt'), 'later change\n');
    commitAll(dir, 'unrelated source change');
    clearCache();
    const result = runHook({}, dir);
    assert.strictEqual(result.code, 0, result.stderr);
    assert.strictEqual(result.stdout, '', 'a committed, unchanged receipt on a clean tree must stay accepted after unrelated commits');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('38. an uncommitted task file is not bound to live Base and Head', () => {
  // Contract change. Committing a packet is the user's choice, and a project that
  // gitignores its specs root cannot do it at all. A task file with no copy in HEAD
  // has no baseline to drift from, so binding it only failed it permanently once the
  // source moved on. Case 50 proves the structural checks still run on such a file.
  const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
  try {
    clearCache();
    assert.strictEqual(runHook({}, dir).stdout, '', 'an uncommitted task file must not be bound');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('38b. the same stale receipt is accepted once committed on a clean tree', () => {
  // Documents the accepted trade-off: once committed and clean, Base and Head
  // must be concrete but are no longer compared against the runtime.
  const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
  try {
    commitAll(dir, 'receipt');
    clearCache();
    const result = runHook({}, dir);
    assert.strictEqual(result.stdout, '', result.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('39. a staged task file reads the same as an uncommitted one', () => {
  // Staging puts the file in the index, not in HEAD, so there is still no committed
  // baseline to compare against and the selector treats it exactly like case 38.
  // Case 40 covers the state that does bind: committed, then modified.
  const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
  try {
    const add = spawnSync('git', ['-C', dir, 'add', '-A'], { encoding: 'utf8' });
    assert.strictEqual(add.status, 0, add.stderr);
    const inHead = spawnSync('git', ['-C', dir, 'ls-tree', '--name-only', 'HEAD', '--',
      `specs/${FEATURE}/task-01-demo.md`], { encoding: 'utf8' });
    assert.strictEqual(inHead.stdout.trim(), '', 'staging must not put the file in HEAD');
    clearCache();
    assert.strictEqual(runHook({}, dir).stdout, '', 'a staged task file has no committed baseline either');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('40. modified receipt requires binding', () => {
  const dir = makeWorkflowFixture(boundReceipt());
  try {
    commitAll(dir, 'receipt');
    const taskFile = path.join(dir, 'specs', FEATURE, 'task-01-demo.md');
    const context = workflowRuntimeContext(dir);
    const before = fs.readFileSync(taskFile, 'utf8');
    const after = before.replace(`Head: ${context.head}`, `Head: ${STALE_HEAD}`);
    assert.notStrictEqual(after, before, 'fixture must contain the bound Head');
    fs.writeFileSync(taskFile, after);
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block', 'a receipt edited after commit must be rebound');
    assert.match(body.reason, /\bprovenance\b/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('41. unborn HEAD fails closed before any receipt check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-spec-gate-'));
  try {
    for (const args of [['init', '-q'], ['config', 'user.email', 'cafekit@example.invalid'], ['config', 'user.name', 'CafeKit Test']]) {
      const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
      assert.strictEqual(result.status, 0, result.stderr);
    }
    const featureDir = path.join(dir, 'specs', FEATURE);
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'plan.md'), '# Demo plan\n');
    fs.writeFileSync(path.join(featureDir, 'task-01-demo.md'), [
      '# Task 01: demo', '', 'Status: done', '', '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '', ...boundReceipt(STALE_BASE, STALE_HEAD), '',
    ].join('\n'));
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block', 'an unborn HEAD must block');
    // The block arrives from provenance derivation, which cannot resolve a base
    // commit here, so the receipt check is never reached. Asserting the reason
    // keeps this case honest: it guards fail-closed behavior on an unborn HEAD,
    // not the binding-mode selector. The selector's own HEAD-unreadable branch
    // is guarded by cases 38 and 39.
    assert.match(body.reason, /controlled failure/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('42. a dirty tree outside specs does not reopen a committed receipt', () => {
  // Contract change. This used to require a block. `Base` is the last commit
  // touching anything outside the specs root, so a receipt written before any
  // later commit records an older `Base` by construction — 52 of 52 done
  // receipts on the CafeKit repository. Reopening on a dirty tree therefore
  // failed every historical receipt at once, every time, which blocked projects
  // on their first turn of a session with nothing changed. What still blocks is
  // the task file that actually differs from its committed bytes, asserted
  // below from both working directories, since the git call must pin the
  // project root rather than the working directory.
  const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
  try {
    commitAll(dir, 'receipt');
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'dirty.txt'), 'uncommitted\n');
    clearCache();
    assert.strictEqual(runHook({}, dir).stdout, '', 'unrelated dirt must not reopen a committed receipt');
    clearCache();
    assert.strictEqual(runHookFrom(dir, path.join(dir, 'specs', FEATURE)).stdout, '',
      'and must not reopen it when the hook runs from inside the specs root either');

    const taskFile = path.join(dir, 'specs', FEATURE, 'task-01-demo.md');
    fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8').replace(STALE_HEAD, 'd'.repeat(64)));
    for (const [label, run] of [['project root', () => runHook({}, dir)],
      ['specs root', () => runHookFrom(dir, path.join(dir, 'specs', FEATURE))]]) {
      clearCache();
      const body = parseBlock(run().stdout);
      assert.ok(body && body.decision === 'block', `an edited task file must rebind, run from the ${label}`);
      assert.match(body.reason, /\bprovenance\b/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('42b. skip-worktree and assume-unchanged cannot hide an edited task file', () => {
  // Both index flags make `git status` report a modified file as clean. The mode
  // selector no longer consults status at all, but it must not become hideable
  // some other way: the committed-bytes check reads the file from disk and asks
  // git for `HEAD:<path>`, and neither consults the index. Marking the task file
  // with either flag must therefore change nothing.
  for (const flag of ['--skip-worktree', '--assume-unchanged']) {
    const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
    try {
      commitAll(dir, 'receipt');
      const taskRelative = `specs/${FEATURE}/task-01-demo.md`;
      const marked = spawnSync('git', ['-C', dir, 'update-index', flag, taskRelative], { encoding: 'utf8' });
      assert.strictEqual(marked.status, 0, marked.stderr);
      const taskFile = path.join(dir, taskRelative);
      fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8').replace(STALE_HEAD, 'd'.repeat(64)));
      const status = spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' });
      assert.strictEqual(status.stdout.trim(), '', `${flag} must make the tree look clean for this case to mean anything`);
      clearCache();
      const body = parseBlock(runHook({}, dir).stdout);
      assert.ok(body && body.decision === 'block', `${flag} must not hide an edited task file`);
      assert.match(body.reason, /\bprovenance\b/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('43. structure checks still block in committed mode', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 1',
    `Base: ${STALE_BASE}`, `Head: ${STALE_HEAD}`, '```text', '$ node --test', 'fail: 1', '```',
  ]);
  try {
    commitAll(dir, 'receipt');
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block');
    assert.match(body.reason, /exit_result/);
    assert.doesNotMatch(body.reason, /\bprovenance\b/, 'committed mode must not report a provenance failure for a stale but concrete pair');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('43b. committed mode still requires concrete Base and Head fields', () => {
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${STALE_BASE}`, '```text', '$ node --test', 'pass: 1', '```',
  ]);
  try {
    commitAll(dir, 'receipt without Head');
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block', 'a missing Head field must still block');
    assert.match(body.reason, /\bprovenance\b/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('44. edited artifact bytes still block in committed mode', () => {
  const artifactPath = 'output/bundle.js';
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${STALE_BASE}`, `Head: ${STALE_HEAD}`,
    `Artifact: ${artifactPath} (sha256:${FIXTURE_ARTIFACT_DIGEST})`,
    '```text', '$ node --test', 'pass: 1', '```',
  ]);
  try {
    fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
    fs.writeFileSync(path.join(dir, artifactPath), FIXTURE_ARTIFACT);
    commitAll(dir, 'receipt and artifact');
    clearCache();
    const accepted = runHook({}, dir);
    assert.strictEqual(accepted.stdout, '', accepted.stderr);
    fs.writeFileSync(path.join(dir, artifactPath), 'tampered\n');
    commitAll(dir, 'tamper artifact');
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block', 'artifact bytes must still be verified in committed mode');
    assert.match(body.reason, /artifact_hash/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('45. the cache grants no authority across a state change', () => {
  // A cached PASS must not survive a later mutation. The first run accepts and
  // writes the cache; the second run sees tampered artifact bytes committed on a
  // still-clean tree and must block without the cache being cleared first.
  const artifactPath = 'output/cached.js';
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
    `Base: ${STALE_BASE}`, `Head: ${STALE_HEAD}`,
    `Artifact: ${artifactPath} (sha256:${FIXTURE_ARTIFACT_DIGEST})`,
    '```text', '$ node --test', 'pass: 1', '```',
  ]);
  try {
    fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
    fs.writeFileSync(path.join(dir, artifactPath), FIXTURE_ARTIFACT);
    commitAll(dir, 'receipt and artifact');
    clearCache();
    const accepted = runHook({}, dir);
    assert.strictEqual(accepted.stdout, '', 'first run must accept and populate the cache');
    fs.writeFileSync(path.join(dir, artifactPath), 'tampered after the cached pass\n');
    commitAll(dir, 'tamper artifact, tree stays clean');
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block', 'a cached pass must not hide a later mutation');
    assert.match(body.reason, /artifact_hash/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('46. a dirty file inside the specs root does not force binding', () => {
  // The status and index queries exclude the specs root on purpose: a receipt is
  // written into that root, so counting it would make every receipt invalidate
  // itself. Dropping the exclusion from either query must fail this case.
  const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
  try {
    commitAll(dir, 'receipt');
    fs.writeFileSync(path.join(dir, 'specs', FEATURE, 'plan.md'), '# Demo plan\n\nEdited after the receipt was committed.\n');
    fs.writeFileSync(path.join(dir, 'specs', FEATURE, 'notes-untracked.md'), 'scratch\n');
    const dirty = spawnSync('git', ['-C', dir, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
    assert.match(dirty.stdout, /specs\//, 'the specs root must actually be dirty for this case to mean anything');
    clearCache();
    const result = runHook({}, dir);
    assert.strictEqual(result.stdout, '', 'work inside the specs root must not reopen a committed receipt');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('47. completed-set branch accepts committed receipts and blocks an edited one', () => {
  // Two finished packets resolve to the completed-set branch, which is the path
  // that revalidated every done receipt on every Stop. Prove committed receipts
  // survive both a clean and a dirty tree, then prove an edited one still blocks.
  const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
  try {
    const secondDir = path.join(dir, 'specs', 'second');
    fs.mkdirSync(secondDir, { recursive: true });
    fs.writeFileSync(path.join(secondDir, 'plan.md'), '# Second plan\n');
    fs.writeFileSync(path.join(secondDir, 'task-01-second.md'), [
      '# Task 01: second', '', 'Status: done', '', '## Dependencies', '', '- none', '',
      '## Verification Plan', '', '- Command: node --test', '', ...boundReceipt(STALE_BASE, STALE_HEAD), '',
    ].join('\n'));
    commitAll(dir, 'two completed packets');
    clearCache();
    const accepted = runHook({}, dir);
    assert.strictEqual(accepted.stdout, '', 'the completed-set branch must accept committed receipts on a clean tree');
    // Contract change: unrelated dirt no longer reopens committed receipts. This
    // used to assert a block, which is what made the gate unusable in a project
    // holding several finished packets — one untracked file failed every receipt
    // in the repository at once. Base is the last commit touching anything
    // outside the specs root, so a historical receipt records an older Base by
    // construction and the check fired on all of them, always.
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'dirty.txt'), 'uncommitted\n');
    clearCache();
    assert.strictEqual(runHook({}, dir).stdout, '', 'unrelated dirt must not reopen committed receipts');

    // What still blocks: the receipt that actually changed after being committed.
    fs.writeFileSync(
      path.join(secondDir, 'task-01-second.md'),
      fs.readFileSync(path.join(secondDir, 'task-01-second.md'), 'utf8').replace(STALE_HEAD, 'd'.repeat(64)),
    );
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block', 'a receipt edited after commit must still be rebound');
    assert.match(body.reason, /\bprovenance\b/);
    assert.match(body.reason, /second/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('51. Receipt fields written as list items are accepted', () => {
  // Every neighbouring section writes its fields as list items — the Verification Plan's
  // own `- Command:` sits a few lines above — so continuing that house style inside the
  // Receipt is the natural mistake. It used to fail verification_state, command,
  // exit_result and command_identity at once, with a message telling the user to rewrite
  // a Receipt whose content was already correct.
  const bulleted = boundReceipt().map((line) => (
    /^(Verification|Command|Exit|Base|Head):/.test(line) ? `- ${line}` : line
  ));
  assert.ok(bulleted.some((line) => line.startsWith('- Verification:')), 'the fixture must be bulleted');
  const dir = makeWorkflowFixture(bulleted);
  try {
    clearCache();
    assert.strictEqual(runHook({}, dir).stdout, '', 'a bulleted Receipt must be read, not rejected');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('52. the block names what to change, not just which check failed', () => {
  // The same sentence used to answer every receipt failure, including the ones where
  // the Receipt was present and one field simply could not be read.
  const dir = makeWorkflowFixture([
    '## Receipt', '', 'Command: node --test', 'Exit: 0',
    `Base: ${VALID_BASE}`, `Head: ${VALID_HEAD}`, '```text', '$ node --test', 'pass: 1', '```',
  ]);
  try {
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block');
    assert.match(body.reason, /add a `Verification: PASS` line/, 'the fix must name the missing field');
    assert.doesNotMatch(body.reason, /write a runtime-bound `## Receipt` with command output/,
      'the generic instruction must not stand in for a specific one');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('53. a hand-typed provenance pair is told to re-derive, not to add lines', () => {
  // Reported from a project whose receipt carried git short SHAs. Telling someone to
  // add `Base:` and `Head:` lines they had already written sends them looking in the
  // wrong place; the pair is there, it just is not the one the runtime derives.
  const dir = makeWorkflowFixture([
    '## Receipt', '', '- Verification: PASS', '- Command: node --test', '- Exit: 0',
    '- Base: d72bb57', '- Head: 5da1eca', '```text', '$ node --test', 'pass: 1', '```',
  ]);
  try {
    clearCache();
    const body = parseBlock(runHook({}, dir).stdout);
    assert.ok(body && body.decision === 'block');
    assert.match(body.reason, /present but are not the pair this runtime derives/);
    assert.match(body.reason, /short SHAs/);
    assert.doesNotMatch(body.reason, /add runtime-derived/, 'the lines exist; do not ask for them again');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('49. an unversioned specs root does not keep every receipt bound', () => {
  // Committing specs/ is the user's choice, not the tool's requirement. Without a
  // committed copy of the task file there is no baseline, so the selector used to keep
  // full binding — which fails every receipt permanently after the first source edit.
  // A project that has chosen not to version its packets has no drift to detect.
  const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'app.js'), 'module.exports = 1;\n');
    for (const args of [['add', 'src'], ['commit', '-qm', 'source only']]) {
      const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
      assert.strictEqual(result.status, 0, result.stderr);
    }
    const tracked = spawnSync('git', ['-C', dir, 'ls-files', '--', 'specs'], { encoding: 'utf8' });
    assert.strictEqual(tracked.stdout.trim(), '', 'the specs root must be untracked for this case to mean anything');
    fs.writeFileSync(path.join(dir, 'src', 'app.js'), 'module.exports = 2;\n');
    clearCache();
    assert.strictEqual(runHook({}, dir).stdout, '', 'an unversioned specs root must not stay bound forever');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('50. an uncommitted task file is still checked, only not against Base and Head', () => {
  // Dropping the binding must not stop the gate reading the packet. A gitignored or
  // simply uncommitted specs root keeps every structural check: a failing exit, a
  // placeholder, an empty output block, and a command that does not match the
  // Verification Plan all still block.
  const cases = [
    [['## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 1',
      `Base: ${STALE_BASE}`, `Head: ${STALE_HEAD}`, '```text', '$ node --test', 'fail: 1', '```'], /exit_result/],
    [['## Receipt', '', 'Verification: PASS', 'Command: node --test', 'Exit: 0',
      `Base: ${STALE_BASE}`, `Head: ${STALE_HEAD}`, '```text', '```'], /command_output/],
    [['## Receipt', '', 'Verification: PASS', 'Command: pnpm test', 'Exit: 0',
      `Base: ${STALE_BASE}`, `Head: ${STALE_HEAD}`, '```text', '$ pnpm test', 'pass', '```'], /command_identity/],
  ];
  for (const [receipt, expected] of cases) {
    const dir = makeWorkflowFixture(receipt);
    try {
      const tracked = spawnSync('git', ['-C', dir, 'ls-files', '--', 'specs'], { encoding: 'utf8' });
      assert.strictEqual(tracked.stdout.trim(), '', 'the packet must be uncommitted for this case to mean anything');
      clearCache();
      const body = parseBlock(runHook({}, dir).stdout);
      assert.ok(body && body.decision === 'block', `an uncommitted packet must still be checked: ${expected}`);
      assert.match(body.reason, expected);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('48. the gate\'s own runtime state does not defeat structure mode', () => {
  // The gate writes its cache under .claude/hooks/.logs on every Stop. If that
  // write counted as a dirty tree, a project tracking its runtime directory could
  // never reach structure mode and the gate would defeat itself. The status query
  // excludes the same runtime-state roots the provenance manifest already ignores.
  const dir = makeWorkflowFixture(boundReceipt(STALE_BASE, STALE_HEAD));
  try {
    const stateDir = path.join(dir, '.claude', 'hooks', '.logs');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'spec-gate-last.json'), '{}\n');
    fs.writeFileSync(path.join(dir, '.claude', 'runtime.json'), '{}\n');
    commitAll(dir, 'receipt plus tracked runtime state');
    // Mutate the tracked runtime state exactly as a Stop would.
    fs.writeFileSync(path.join(stateDir, 'spec-gate-last.json'), '{"demo":{"task-01-demo.md":"done"}}\n');
    fs.writeFileSync(path.join(dir, '.claude', 'runtime.json'), '{"spec":{}}\n');
    const dirty = spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' });
    assert.match(dirty.stdout, /\.claude\//, 'the runtime state must actually be dirty for this case to mean anything');
    clearCache();
    const result = runHook({}, dir);
    assert.strictEqual(result.stdout, '', 'generated runtime state must not be read as a dirty worktree');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
