'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const CLAUDE_HOOK = path.join(__dirname, '..', 'completion-authority.cjs');
const CODEX_HOOKS = path.join(ROOT, 'codex/hooks');
const POLICY = require(path.join(ROOT, 'claude/scripts/workflow-policy.cjs'));
const PROVENANCE = require(path.join(ROOT, 'claude/scripts/provenance.cjs'));
const AUTHORITY_CHECK = require(path.join(ROOT, 'claude/hooks/completion-authority-check.cjs'));
const RESOLVER = require(path.join(ROOT, 'claude/scripts/spec-resolver.cjs'));
const SEMANTIC_MODEL = require(path.join(ROOT, 'claude/scripts/spec-semantic-model.cjs'));
const { copyClaudeTestRuntime } = require(path.join(ROOT, '../bin/__tests__/test-runtime-dependency-closure.cjs'));
const FEATURE = 'authority-fixture';
const TASK = 'tasks/closeout.md';
const TEST_HOMES = new Map();

function homeFor(root) {
  if (!TEST_HOMES.has(root)) {
    const home = path.join(os.tmpdir(), 'cafekit-authority-homes', path.basename(root));
    fs.mkdirSync(home, { recursive: true });
    TEST_HOMES.set(root, home);
  }
  return TEST_HOMES.get(root);
}

function cleanupFixture(root) {
  fs.rmSync(root, { recursive: true, force: true });
  const home = TEST_HOMES.get(root);
  if (home) fs.rmSync(home, { recursive: true, force: true });
  TEST_HOMES.delete(root);
}

function gitFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-authority-'));
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'cafekit@example.invalid'],
    ['config', 'user.name', 'CafeKit Test'],
    ['commit', '--allow-empty', '-qm', 'fixture'],
  ]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return root;
}

function context(root, session = 'session-a', featureName = FEATURE) {
  return PROVENANCE.deriveRuntimeContext({
    projectRoot: root,
    specsRoot: path.join(root, 'specs'),
    specFile: path.join(root, 'specs', featureName, 'spec.json'),
    featureName,
    runtimeSession: session,
  });
}

function prepare(root, { lane = 'Standard', status = 'in_progress', phase = 'closeout', proofs = true, feature = FEATURE } = {}) {
  const featureDir = path.join(root, 'specs', feature);
  fs.mkdirSync(path.join(featureDir, 'tasks'), { recursive: true });
  const policyInput = lane === 'Critical'
    ? { riskSignals: { auth: true }, assurance_level: 'Strict' }
    : lane === 'Direct'
      ? { reversible: true, lowRisk: true, isolated: true }
      : { riskSignals: {} };
  const spec = {
    status,
    current_phase: phase,
    feature_name: feature,
    workflow_policy: POLICY.canonicalWorkflowPolicySnapshot(policyInput),
    task_registry: { [TASK]: { status: 'done', completed_at: '2026-08-12T00:00:00.000Z' } },
  };
  fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify(spec));
  const runtime = context(root, 'session-a', feature);
  const body = [
    'Verification: PASS',
    'Command: node --test',
    'Exit: 0',
    `Base: ${runtime.base}`,
    `Head: ${runtime.head}`,
  ].join('\n');
  fs.writeFileSync(path.join(featureDir, TASK), `# Closeout\n\nStatus: done\n\n## Evidence\n\n${body}\n`);
  fs.writeFileSync(path.join(featureDir, 'feature-receipt.md'), [
    `Feature: ${feature}`,
    'Expected: final integration verification passes',
    'Observed: final integration verification passed',
    body,
    '',
  ].join('\n'));
  if (proofs) {
    spec.proofs = {
      needsInspection: { receipt: body },
      needsResearchGrounding: { receipt: body },
    };
    if (lane === 'Critical') {
      spec.proofs.needsIndependentAudit = {
        schema_version: '1',
        reviewer_session_id: 'reviewer-session',
        implementation_session_id: 'session-a',
        expected_provenance: { base: runtime.base, head: runtime.head },
        evidence: 'independent closeout review passed',
        verdict: 'PASS',
      };
    }
    fs.writeFileSync(path.join(featureDir, 'spec.json'), JSON.stringify(spec));
  }
  return { featureDir, specFile: path.join(featureDir, 'spec.json') };
}

function adapter(kind, root) {
  const home = homeFor(root);
  fs.mkdirSync(home, { recursive: true });
  if (kind === 'claude') {
    return {
      root,
      hook: CLAUDE_HOOK,
      sessionHook: path.join(__dirname, '..', 'session.cjs'),
      state: path.join(home, '.cafekit', 'completion-authority', 'projects'),
      home,
      env: { ...process.env, HOME: home, USERPROFILE: home, PROJECT_ROOT: root },
      run(mode, payload) {
        return spawnSync(process.execPath, [CLAUDE_HOOK, mode], {
          cwd: root,
          env: this.env,
          input: JSON.stringify({ cwd: root, session_id: 'session-a', ...payload }),
          encoding: 'utf8',
        });
      },
    };
  }
  copyClaudeTestRuntime(path.join(ROOT, '..'), path.join(root, '.codex'));
  const hooks = path.join(root, '.codex/hooks');
  fs.cpSync(CODEX_HOOKS, hooks, { recursive: true });
  for (const helper of ['privacy-command-analysis.cjs', 'runtime-path-safety.cjs']) {
    fs.copyFileSync(
      path.join(ROOT, 'claude/hooks/lib', helper),
      path.join(hooks, 'lib', helper),
    );
  }
  return {
    root,
    hook: path.join(hooks, 'completion-authority.cjs'),
    sessionHook: path.join(hooks, 'session.cjs'),
    state: path.join(home, '.cafekit', 'completion-authority', 'projects'),
    home,
    env: { ...process.env, HOME: home, USERPROFILE: home },
    run(mode, payload) {
      return spawnSync(process.execPath, [path.join(hooks, 'completion-authority.cjs'), mode], {
        cwd: root,
        env: this.env,
        input: JSON.stringify({ cwd: root, session_id: 'session-a', ...payload }),
        encoding: 'utf8',
      });
    },
  };
}

function stateFiles(runtime) {
  if (!fs.existsSync(runtime.state)) return [];
  return fs.readdirSync(runtime.state, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => fs.readdirSync(path.join(runtime.state, entry.name)));
}

function stateRecord(runtime, prefix) {
  const files = stateFiles(runtime).filter((name) => name.startsWith(prefix));
  assert.equal(files.length, 1, `expected exactly one ${prefix} authority record`);
  const projects = fs.readdirSync(runtime.state, { withFileTypes: true }).find((entry) => entry.isDirectory());
  return path.join(runtime.state, projects.name, files[0]);
}

function writeRuntime(runtime, value) {
  const platformDir = runtime.hook.includes(`${path.sep}.codex${path.sep}`) ? '.codex' : '.claude';
  const dir = path.join(runtime.root, platformDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime.json'), `${JSON.stringify(value)}\n`);
}

function sessionStart(runtime, source = 'startup', sessionId = 'session-a') {
  return spawnSync(process.execPath, [runtime.sessionHook], {
    cwd: runtime.root,
    env: runtime.env,
    input: JSON.stringify({ cwd: runtime.root, session_id: sessionId, source, hook_event_name: 'SessionStart' }),
    encoding: 'utf8',
  });
}

function stop(runtime, payload = {}) {
  return runtime.run('--stop', { hook_event_name: 'Stop', ...payload });
}

function approve(runtime, nonce, payload = {}) {
  return runtime.run('--approve', {
    hook_event_name: 'UserPromptSubmit',
    prompt: `APPROVE CAFEKIT COMPLETION ${nonce}`,
    ...payload,
  });
}

function block(result) {
  assert.equal(result.status, 0, result.stderr);
  const output = result.stdout.trim();
  assert.notEqual(output, '', 'expected a controlled block');
  const line = output.split('\n').find((value) => value.includes('"decision"'));
  return JSON.parse(line || output);
}

function nonceFrom(result) {
  const body = block(result);
  const match = body.reason.match(/APPROVE CAFEKIT COMPLETION ([a-f0-9]{24})/);
  assert.ok(match, body.reason);
  return { body, nonce: match[1] };
}

for (const kind of ['claude', 'codex']) {
  test(`${kind}: authoring, partial execution, done-before-closeout, and stop loops are silent`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      const fixture = prepare(root, { phase: 'authoring' });
      let spec = JSON.parse(fs.readFileSync(fixture.specFile, 'utf8'));
      spec.task_registry = {};
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      fs.rmSync(path.join(fixture.featureDir, 'feature-receipt.md'), { force: true });
      assert.equal(stop(runtime).stdout.trim(), '', 'Compact taskless authoring pause must be silent');

      spec.task_registry = { [TASK]: { status: 'in_progress', completed_at: null } };
      spec.current_phase = 'implementation';
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      assert.equal(stop(runtime).stdout.trim(), '', 'partial task execution must be silent');

      spec.task_registry[TASK] = { status: 'done', completed_at: '2026-08-12T00:00:00.000Z' };
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      assert.equal(stop(runtime).stdout.trim(), '', 'done tasks without explicit closeout must be silent');
      assert.equal(stateFiles(runtime).length, 0, 'inactive stops must not mutate authority state');

      const loop = stop(runtime, { stop_hook_active: true });
      assert.equal(loop.status, 0, loop.stderr);
      assert.equal(loop.stdout.trim(), '', 'recursive Stop invocation must be silent');

      spec.current_phase = 'closeout';
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      assert.match(block(stop(runtime)).reason, /technical completion proof|feature-receipt/i);
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: exact user approval is one-time and runtime-bound`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root);
      const first = nonceFrom(stop(runtime));
      const forged = runtime.run('--approve', { hook_event_name: 'UserPromptSubmit', user_authorized: true });
      assert.equal(forged.status, 0);
      assert.equal(stateFiles(runtime).filter((name) => name.startsWith('grant-')).length, 0);
      approve(runtime, first.nonce);
      assert.equal(stop(runtime).stdout.trim(), '', 'approved closeout must pass once');
      const replay = approve(runtime, first.nonce);
      assert.equal(replay.status, 0);
      const second = nonceFrom(stop(runtime));
      assert.notEqual(second.nonce, first.nonce, 'replayed nonce must not grant a second closeout');
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: valid Critical closeout succeeds only after exact approval`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root, { lane: 'Critical' });
      const pending = nonceFrom(stop(runtime));
      assert.equal(stop(runtime).stdout.match(/APPROVE CAFEKIT COMPLETION/g).length, 1);
      approve(runtime, pending.nonce);
      assert.equal(stop(runtime).stdout.trim(), '');
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: wrong nonce/session/target and forged approval fields never grant`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root);
      const pending = nonceFrom(stop(runtime));
      const replacement = pending.nonce.endsWith('0') ? '1' : '0';
      const wrongNonce = approve(runtime, `${pending.nonce.slice(0, -1)}${replacement}`);
      assert.equal(wrongNonce.status, 0);
      assert.equal(stateFiles(runtime).some((name) => name.startsWith('grant-')), false);
      const wrongEvent = approve(runtime, pending.nonce, { hook_event_name: 'Stop' });
      assert.equal(wrongEvent.status, 0);
      assert.equal(stateFiles(runtime).some((name) => name.startsWith('grant-')), false);
      const wrongSession = approve(runtime, pending.nonce, { session_id: 'other-session' });
      assert.equal(wrongSession.status, 0);
      assert.equal(stateFiles(runtime).some((name) => name.startsWith('grant-')), false);
      const forged = runtime.run('--approve', {
        hook_event_name: 'UserPromptSubmit',
        user_authorized: true,
        userAuthorized: true,
        session: { id: 'session-a', user_authorized: true },
      });
      assert.equal(forged.status, 0);
      assert.equal(stateFiles(runtime).some((name) => name.startsWith('grant-')), false);
      approve(runtime, pending.nonce);
      const wrongStop = stop(runtime, {
        session_id: 'other-session',
        featureName: 'wrong-feature',
        runtime_context: { project_root: '/forged', head: 'forged', context_id: 'forged' },
        user_authorized: true,
      });
      assert.equal(block(wrongStop).decision, 'block');
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: status, policy, registry, and artifact/proof mutation invalidate approval`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      const fixture = prepare(root);
      const initial = nonceFrom(stop(runtime));
      approve(runtime, initial.nonce);
      const spec = JSON.parse(fs.readFileSync(fixture.specFile, 'utf8'));
      spec.status = 'completed';
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      const statusMutation = nonceFrom(stop(runtime));
      assert.notEqual(statusMutation.nonce, initial.nonce);

      approve(runtime, statusMutation.nonce);
      const direct = POLICY.workflowPolicySnapshot({ reversible: true, lowRisk: true, isolated: true });
      spec.workflow_policy = direct;
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      const policyMutation = block(stop(runtime));
      assert.match(policyMutation.reason, /monotonic|downgraded/i);
      spec.task_registry = {};
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      const missingRegistry = block(stop(runtime));
      assert.match(missingRegistry.reason, /monotonic|downgraded/i);

      prepare(root, { lane: 'Direct' });
      const directRuntime = adapter(kind, root);
      const artifactMutation = block(stop(directRuntime));
      assert.match(artifactMutation.reason, /monotonic|downgraded/i);
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: completed, invalid/malformed candidates, Critical fake proofs, and Direct no-spec are fail-closed`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      for (const input of ['', 'null', '[]']) {
        const malformed = spawnSync(process.execPath, [runtime.hook, '--stop'], {
          cwd: root,
          env: runtime.env,
          input,
          encoding: 'utf8',
        });
        assert.equal(malformed.status, 0);
        assert.equal(block(malformed).decision, 'block');
      }
      prepare(root, { status: 'completed' });
      assert.match(nonceFrom(stop(runtime)).body.reason, /approval/i);

      const specFile = path.join(root, 'specs', FEATURE, 'spec.json');
      const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
      spec.task_registry[TASK].completed_at = null;
      fs.writeFileSync(specFile, JSON.stringify(spec));
      assert.match(block(stop(runtime)).reason, /completed_at/i);

      fs.writeFileSync(specFile, '{ malformed');
      assert.equal(block(stop(runtime)).decision, 'block');

      fs.rmSync(path.join(root, 'specs'), { recursive: true, force: true });
      const disappeared = block(stop(runtime));
      assert.match(disappeared.reason, /disappeared|persisted/i);

      const noSpecRoot = gitFixture();
      try {
        const noSpec = adapter(kind, noSpecRoot);
        assert.equal(stop(noSpec).stdout.trim(), '', 'true no-spec Direct path remains silent');
      } finally {
        cleanupFixture(noSpecRoot);
      }

      prepare(root, { lane: 'Critical', proofs: false });
      const critical = adapter(kind, root);
      const criticalBlock = block(stop(critical));
      assert.match(criticalBlock.reason, /technical completion proof|needsIndependentAudit/i);

      fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(root, '.claude', 'runtime.json'), JSON.stringify({ spec: { completion_gate: false } }));
      if (kind === 'codex') {
        fs.rmSync(path.join(root, '.claude'), { recursive: true, force: true });
        fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
        fs.writeFileSync(path.join(root, '.codex', 'runtime.json'), JSON.stringify({ spec: { completion_gate: false } }));
      }
      assert.match(block(stop(critical)).reason, /worker-writable|cannot authorize/i);
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: copied, unsigned, MAC-invalid, wrong-key, and project-local grants never authorize`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root);
      const localDir = path.join(root, kind === 'claude' ? '.claude/hooks/.logs/completion-authority' : '.codex/hooks/.logs/completion-authority');
      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(path.join(localDir, 'grant-deadbeefdeadbeefdeadbeef.json'), JSON.stringify({ kind: 'grant', nonce: 'deadbeefdeadbeefdeadbeef', binding: {} }));
      const pending = nonceFrom(stop(runtime));
      approve(runtime, pending.nonce);
      assert.equal(stop(runtime).stdout.trim(), '', 'project-local legacy grant must be ignored');
      fs.rmSync(localDir, { recursive: true, force: true });

      const retry = nonceFrom(stop(runtime));
      const pendingFile = stateRecord(runtime, 'pending-');
      const copiedGrant = path.join(path.dirname(pendingFile), `grant-${retry.nonce}.json`);
      fs.copyFileSync(pendingFile, copiedGrant);
      const copiedApproval = approve(runtime, retry.nonce);
      assert.doesNotMatch(copiedApproval.stdout, /accepted/i);
      assert.equal(stateFiles(runtime).some((name) => name.startsWith('grant-')), true);
      fs.rmSync(copiedGrant);
      approve(runtime, retry.nonce);
      assert.equal(stop(runtime).stdout.trim(), '');

      const clean = gitFixture();
      try {
        const cleanRuntime = adapter(kind, clean);
        prepare(clean);
        const cleanPending = nonceFrom(stop(cleanRuntime));
        const cleanFile = stateRecord(cleanRuntime, 'pending-');
        const record = JSON.parse(fs.readFileSync(cleanFile, 'utf8'));
        record.mac = `${record.mac.slice(0, -1)}${record.mac.endsWith('0') ? '1' : '0'}`;
        fs.writeFileSync(cleanFile, JSON.stringify(record));
        assert.doesNotMatch(approve(cleanRuntime, cleanPending.nonce).stdout, /accepted/i);
      } finally {
        cleanupFixture(clean);
      }

      const wrongKeyRoot = gitFixture();
      try {
        const wrongKeyRuntime = adapter(kind, wrongKeyRoot);
        prepare(wrongKeyRoot);
        const wrongKeyPending = nonceFrom(stop(wrongKeyRuntime));
        fs.writeFileSync(path.join(wrongKeyRuntime.home, '.cafekit', 'completion-authority', 'hmac.key'), Buffer.alloc(32, 7));
        assert.doesNotMatch(approve(wrongKeyRuntime, wrongKeyPending.nonce).stdout, /accepted/i);
      } finally {
        cleanupFixture(wrongKeyRoot);
      }
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: replay and signed-record mutation remain one-use and bound`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root);
      const pending = nonceFrom(stop(runtime));
      approve(runtime, pending.nonce);
      assert.equal(stop(runtime).stdout.trim(), '');
      assert.doesNotMatch(approve(runtime, pending.nonce).stdout, /accepted/i);
      const next = nonceFrom(stop(runtime));
      const specFile = path.join(root, 'specs', FEATURE, 'spec.json');
      const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
      spec.task_registry[TASK].completed_at = '2026-08-13T00:00:00.000Z';
      fs.writeFileSync(specFile, JSON.stringify(spec));
      approve(runtime, next.nonce);
      const mutated = block(stop(runtime));
      assert.match(mutated.reason, /approval|technical|binding|proof/i);
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: policy baseline is recorded before proof completion, survives SessionStart, and blocks Critical to Direct`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root, { lane: 'Critical', proofs: false });
      const incomplete = block(stop(runtime));
      assert.match(incomplete.reason, /technical|proof|missing/i);
      assert.equal(stateFiles(runtime).filter((name) => name.startsWith('baseline-')).length, 1);

      prepare(root, { lane: 'Critical' });
      const pending = nonceFrom(stop(runtime));
      assert.equal(sessionStart(runtime).status, 0);
      assert.equal(stateFiles(runtime).filter((name) => name.startsWith('baseline-')).length, 1);
      assert.equal(stateFiles(runtime).some((name) => name.startsWith('pending-') || name.startsWith('grant-')), false);
      const freshPending = nonceFrom(stop(runtime));
      assert.notEqual(freshPending.nonce, pending.nonce);

      approve(runtime, freshPending.nonce);
      assert.equal(stop(runtime).stdout.trim(), '');
      const retry = nonceFrom(stop(runtime));
      approve(runtime, retry.nonce);
      const specFile = path.join(root, 'specs', FEATURE, 'spec.json');
      const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
      spec.workflow_policy = POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Routine' });
      fs.writeFileSync(specFile, JSON.stringify(spec));
      const downgrade = block(stop(runtime));
      assert.match(downgrade.reason, /monotonic|downgraded/i);
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: Critical feature A cannot raise ceremony for Compact Routine feature B`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root, { feature: 'critical-feature-a', lane: 'Critical' });
      nonceFrom(stop(runtime));
      assert.equal(stateFiles(runtime).filter((name) => name === 'policy-floor.json').length, 1);

      fs.rmSync(path.join(root, 'specs', 'critical-feature-a'), { recursive: true, force: true });
      prepare(root, { feature: 'compact-feature-b', lane: 'Standard' });
      const light = nonceFrom(stop(runtime));
      assert.match(light.body.reason, /approval/i);
      const floor = JSON.parse(fs.readFileSync(stateRecord(runtime, 'policy-floor'), 'utf8'));
      assert.deepEqual(floor.policy, POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Routine' }));
      assert.equal(stateFiles(runtime).filter((name) => name.startsWith('baseline-')).length, 2);
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: Critical policy floor survives same-path recreation and a new session`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      const featureDir = path.join(root, 'specs', FEATURE);
      prepare(root, { lane: 'Critical' });
      nonceFrom(stop(runtime));
      fs.rmSync(featureDir, { recursive: true, force: true });
      prepare(root, { lane: 'Direct' });
      const recreated = block(stop(runtime));
      assert.match(recreated.reason, /project policy floor|monotonic|downgraded/i);
    } finally {
      cleanupFixture(root);
    }

    const sessionRoot = gitFixture();
    try {
      const runtime = adapter(kind, sessionRoot);
      prepare(sessionRoot, { lane: 'Critical' });
      nonceFrom(stop(runtime));
      assert.equal(sessionStart(runtime, 'startup', 'session-b').status, 0);
      assert.equal(stateFiles(runtime).filter((name) => name === 'policy-floor.json').length, 1);
      assert.equal(stateFiles(runtime).some((name) => name.startsWith('pending-') || name.startsWith('grant-')), false);
      prepare(sessionRoot, { lane: 'Direct' });
      const newSession = block(stop(runtime, { session_id: 'session-b' }));
      assert.match(newSession.reason, /project policy floor|monotonic|downgraded/i);
    } finally {
      cleanupFixture(sessionRoot);
    }
  });

  test(`${kind}: project policy floor prevents risk removal without coupling assurance to durable state`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root, { lane: 'Critical' });
      const specFile = path.join(root, 'specs', FEATURE, 'spec.json');
      const initialSpec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
      initialSpec.workflow_policy = POLICY.canonicalWorkflowPolicySnapshot({ riskSignals: { auth: true, privacy: true } });
      assert.equal(POLICY.readWorkflowPolicySnapshot(initialSpec).proof_obligations.includes('needsDurableTaskState'), false);
      fs.writeFileSync(specFile, JSON.stringify(initialSpec));
      nonceFrom(stop(runtime));
      const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
      assert.ok(spec.workflow_policy.risks.length > 0);
      assert.ok(POLICY.readWorkflowPolicySnapshot(spec).proof_obligations.length > 0);
      spec.workflow_policy = POLICY.canonicalWorkflowPolicySnapshot({ riskSignals: { auth: true } });
      fs.writeFileSync(specFile, JSON.stringify(spec));
      const blocked = block(stop(runtime));
      assert.match(blocked.reason, /risk .*removed/i);
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: missing legacy floor migrates from config while corrupt floor fails closed`, () => {
    const missingRoot = gitFixture();
    try {
      const runtime = adapter(kind, missingRoot);
      prepare(missingRoot);
      nonceFrom(stop(runtime));
      fs.rmSync(stateRecord(runtime, 'policy-floor'), { force: true });
      const migrated = nonceFrom(stop(runtime));
      assert.match(migrated.body.reason, /approval/i);
      assert.equal(JSON.parse(fs.readFileSync(stateRecord(runtime, 'policy-floor'), 'utf8')).schema_version, 3);
    } finally {
      cleanupFixture(missingRoot);
    }

    const corruptRoot = gitFixture();
    try {
      const runtime = adapter(kind, corruptRoot);
      prepare(corruptRoot);
      nonceFrom(stop(runtime));
      fs.writeFileSync(stateRecord(runtime, 'policy-floor'), '{ corrupt');
      assert.match(block(stop(runtime)).reason, /floor|malformed|authority/i);
    } finally {
      cleanupFixture(corruptRoot);
    }
  });

  test(`${kind}: configured minimum is stable across feature escalation, while missing policy is blocked`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root, { lane: 'Standard' });
      nonceFrom(stop(runtime));
      const standardFloor = JSON.parse(fs.readFileSync(stateRecord(runtime, 'policy-floor'), 'utf8'));
      assert.equal(POLICY.readWorkflowPolicySnapshot({ workflow_policy: standardFloor.policy }).lane, 'Standard');
      prepare(root, { lane: 'Critical' });
      const escalated = nonceFrom(stop(runtime));
      assert.match(escalated.body.reason, /approval/i);
      const criticalFloor = JSON.parse(fs.readFileSync(stateRecord(runtime, 'policy-floor'), 'utf8'));
      assert.deepEqual(criticalFloor.policy, standardFloor.policy);

      const missingRoot = gitFixture();
      try {
        const missingRuntime = adapter(kind, missingRoot);
        const fixture = prepare(missingRoot);
        const spec = JSON.parse(fs.readFileSync(fixture.specFile, 'utf8'));
        delete spec.workflow_policy;
        fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
        assert.match(block(stop(missingRuntime)).reason, /workflow_policy.*missing/i);
      } finally {
        cleanupFixture(missingRoot);
      }
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: canonical config minimum applies without inheriting feature policy`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      writeRuntime(runtime, { spec: { policy_minimum: { planning_depth: 'Full', assurance_level: 'Elevated' } } });
      prepare(root, { lane: 'Standard' });
      assert.match(block(stop(runtime)).reason, /configured project minimum/i);
      const strict = prepare(root, { lane: 'Critical' });
      const spec = JSON.parse(fs.readFileSync(strict.specFile, 'utf8'));
      spec.workflow_policy = POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Full', assurance_level: 'Strict', risks: ['auth'] });
      fs.writeFileSync(strict.specFile, JSON.stringify(spec));
      nonceFrom(stop(runtime));
      const floor = JSON.parse(fs.readFileSync(stateRecord(runtime, 'policy-floor'), 'utf8'));
      assert.deepEqual(floor.policy, POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Full', assurance_level: 'Elevated' }));
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: legacy v2 baseline migrates to canonical 2.1 without losing feature history`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      const fixture = prepare(root);
      const spec = JSON.parse(fs.readFileSync(fixture.specFile, 'utf8'));
      spec.workflow_policy = POLICY.workflowPolicySnapshot({ riskSignals: {} });
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      nonceFrom(stop(runtime));
      const first = JSON.parse(fs.readFileSync(stateRecord(runtime, 'baseline-'), 'utf8'));
      assert.equal(first.policy.version, '2.1');
      assert.equal(first.schema_version, 3);

      spec.workflow_policy = POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Routine' });
      fs.writeFileSync(fixture.specFile, JSON.stringify(spec));
      nonceFrom(stop(runtime));
      const migrated = JSON.parse(fs.readFileSync(stateRecord(runtime, 'baseline-'), 'utf8'));
      assert.equal(migrated.policy.version, '2.1');
      assert.equal(migrated.issued_at, first.issued_at);
    } finally {
      cleanupFixture(root);
    }
  });

  test(`${kind}: explicit target resolves before sibling ambiguity while no target remains ambiguous`, () => {
    const root = gitFixture();
    try {
      const runtime = adapter(kind, root);
      prepare(root);
      assert.match(block(stop(runtime, { featureName: 'other-feature' })).reason, /explicit/i);
      prepare(root, { feature: 'other-feature', phase: 'implementation' });
      assert.ok(nonceFrom(stop(runtime, { featureName: FEATURE })).nonce);
      // Contract change: a sibling that is not claiming closeout is no longer a rival.
      // This used to assert ambiguity, which is the over-strict behaviour issue #79
      // reports: a repository that had merely accumulated features could never name its
      // current one again. Only FEATURE is at closeout here, so it resolves and its
      // approval is demanded. Two packets both claiming closeout still block, which
      // `several packets claiming closeout stay ambiguous and name only those` covers in
      // bin/__tests__/spec-narrowing.test.js.
      assert.ok(nonceFrom(stop(runtime)).nonce, 'the one packet claiming closeout resolves');
      for (const malformed of [
        { featureName: '' },
        { featureName: 42 },
        { specPath: '../escape/spec.json' },
      ]) assert.match(block(stop(runtime, malformed)).reason, /explicit|malformed|escape/i);
    } finally {
      cleanupFixture(root);
    }
  });
}

test('Claude hook: CLAUDE_PROJECT_DIR wins over malicious payload.cwd and stale process cwd', () => {
  const target = gitFixture();
  const stale = gitFixture();
  try {
    prepare(target);
    const home = homeFor(target);
    const result = spawnSync(process.execPath, [CLAUDE_HOOK, '--stop'], {
      cwd: stale,
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        CLAUDE_PROJECT_DIR: target,
        PROJECT_ROOT: stale,
      },
      input: JSON.stringify({
        hook_event_name: 'Stop',
        session_id: 'session-a',
        cwd: stale,
      }),
      encoding: 'utf8',
    });
    assert.match(block(result).reason, /approval/i);
  } finally {
    cleanupFixture(target);
    cleanupFixture(stale);
  }
});

test('installed scaffold observes Critical policy before Stop and source scaffold does not touch authority state', () => {
  const root = gitFixture();
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-source-scaffold-'));
  const sourceHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-source-home-'));
  const installedHome = homeFor(root);
  try {
    const installedClaude = path.join(root, '.claude');
    fs.cpSync(path.join(ROOT, 'claude/scripts'), path.join(installedClaude, 'scripts'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'claude/skills/specs/templates'), path.join(installedClaude, 'skills/specs/templates'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'claude/hooks'), path.join(installedClaude, 'hooks'), { recursive: true });

    const installedScaffold = path.join(installedClaude, 'scripts/spec-scaffold.cjs');
    const installedHook = path.join(installedClaude, 'hooks/completion-authority.cjs');
    const installedRuntime = {
      root,
      home: installedHome,
      state: path.join(installedHome, '.cafekit', 'completion-authority', 'projects'),
      run(mode, payload) {
        return spawnSync(process.execPath, [installedHook, mode], {
          cwd: root,
          env: {
            ...process.env,
            HOME: installedHome,
            USERPROFILE: installedHome,
            CLAUDE_PROJECT_DIR: root,
            PROJECT_ROOT: root,
          },
          input: JSON.stringify({ cwd: root, session_id: 'session-a', ...payload }),
          encoding: 'utf8',
        });
      },
    };
    const scaffolded = spawnSync(process.execPath, [installedScaffold, 'installed-critical', '--lane', 'Critical'], {
      cwd: root,
      env: { ...process.env, HOME: installedHome, USERPROFILE: installedHome },
      encoding: 'utf8',
    });
    assert.equal(scaffolded.status, 0, `${scaffolded.stdout}\n${scaffolded.stderr}`);

    const floor = JSON.parse(fs.readFileSync(stateRecord(installedRuntime, 'policy-floor'), 'utf8'));
    const baseline = JSON.parse(fs.readFileSync(stateRecord(installedRuntime, 'baseline-'), 'utf8'));
    assert.equal(typeof floor.mac, 'string');
    assert.ok(floor.mac.length > 0);
    assert.equal(typeof baseline.mac, 'string');
    assert.ok(baseline.mac.length > 0);

    fs.rmSync(path.join(root, 'specs', 'installed-critical'), { recursive: true, force: true });
    const disappeared = block(stop(installedRuntime));
    assert.match(disappeared.reason, /disappeared/i);

    const sourceScaffolded = spawnSync(process.execPath, [path.join(ROOT, 'claude/scripts/spec-scaffold.cjs'), 'source-critical', '--lane', 'Critical'], {
      cwd: sourceRoot,
      env: { ...process.env, HOME: sourceHome, USERPROFILE: sourceHome },
      encoding: 'utf8',
    });
    assert.equal(sourceScaffolded.status, 0, `${sourceScaffolded.stdout}\n${sourceScaffolded.stderr}`);
    assert.equal(fs.existsSync(path.join(sourceHome, '.cafekit', 'completion-authority')), false);
  } finally {
    cleanupFixture(root);
    fs.rmSync(sourceRoot, { recursive: true, force: true });
    fs.rmSync(sourceHome, { recursive: true, force: true });
  }
});

test('canonical final-state decision rejects every stale mutation class before execution proof', () => {
  const root = gitFixture();
  try {
    const featureDir = path.join(root, 'specs', 'final-state-matrix');
    fs.mkdirSync(featureDir, { recursive: true });
    const specFile = path.join(featureDir, 'spec.json');
    const digest = `sha256:${'a'.repeat(64)}`;
    // Canonical terminal shape: a completed C2 receipt that is PASS/CONTINUE
    // with zero blocking items, plus the C13 history entry that records it and
    // binds the same semantic digest, the receipt's own canonical digest, and
    // the attempt index the receipt reports as repair_round.
    const terminalReview = {
      status: 'completed', semantic_digest: digest, verdict: 'PASS',
      lifecycle_disposition: 'CONTINUE', findings: [], unresolved_decisions: [],
      graph_coverage: [], repair_round: 0, reviewed_criteria: [], counterexamples: [],
      reviewer_evidence: null,
    };
    const baseSpec = {
      schema_version: '2.1', feature_name: 'final-state-matrix', ready_for_implementation: true,
      validation: {
        status: 'completed',
        semantic_review: terminalReview,
        semantic_review_history: {
          lineage_id: `sha256:${'c'.repeat(64)}`,
          entries: [{
            sequence: 0,
            semantic_digest: digest,
            review_receipt_digest: `sha256:${crypto.createHash('sha256')
              .update(SEMANTIC_MODEL.stableJson(terminalReview), 'utf8').digest('hex')}`,
            verdict: 'PASS',
            lifecycle_disposition: 'CONTINUE',
            blocking_count: 0,
            attempt_index: 0,
            review_epoch: 0,
          }],
        },
        authoring_validation: null,
      },
      workflow_policy: POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Routine' }),
    };
    fs.writeFileSync(specFile, JSON.stringify(baseSpec));
    const candidate = { featureName: 'final-state-matrix', featureDir, specFile, spec: baseSpec };
    const state = { validationErrors: [], groundingErrors: [], digest, observed: false };
    const dependencies = {
      validator: {
        validateSpec: () => ({ errors: state.validationErrors, warnings: [] }),
        computeSemanticDigest21: () => ({ errors: [], digest: state.digest }),
      },
      grounder: { groundSpec: () => ({ errors: state.groundingErrors, warnings: [], checked: 0 }) },
      semanticAuthority: { verifyAttestation: () => ({ ok: state.observed, reason: 'missing observation' }) },
    };
    const cases = [
      ['readiness', (spec) => { spec.ready_for_implementation = false; }, /readiness/],
      ['canonical validation', () => { state.validationErrors = ['invalid current state']; }, /validation failed/],
      ['grounding', () => { state.groundingErrors = ['ungrounded target']; }, /grounding failed/],
      ['semantic digest', () => { state.digest = `sha256:${'b'.repeat(64)}`; }, /digest is stale/],
    ];
    for (const [name, mutate, expected] of cases) {
      candidate.spec = structuredClone(baseSpec);
      state.validationErrors = [];
      state.groundingErrors = [];
      state.digest = digest;
      mutate(candidate.spec);
      const result = AUTHORITY_CHECK.validateCanonicalFinalState({ policy: POLICY, projectRoot: root, candidate, dependencies });
      assert.equal(result.ok, false, name);
      assert.match(result.reason, expected, name);
    }

    candidate.spec = structuredClone(baseSpec);
    state.digest = digest;
    assert.equal(AUTHORITY_CHECK.validateCanonicalFinalState({ policy: POLICY, projectRoot: root, candidate, dependencies }).ok, true);
    candidate.spec.workflow_policy = POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Full', assurance_level: 'Strict' });
    assert.match(
      AUTHORITY_CHECK.validateCanonicalFinalState({ policy: POLICY, projectRoot: root, candidate, dependencies }).reason,
      /host-hook-observed reviewer PASS/,
    );
    state.observed = true;
    assert.equal(AUTHORITY_CHECK.validateCanonicalFinalState({ policy: POLICY, projectRoot: root, candidate, dependencies }).ok, true);
  } finally { cleanupFixture(root); }
});

test('schema 2.1 lifecycle vocabulary is exact and legacy aliases stay in the legacy adapter', () => {
  const canonical = [
    ['in_progress', false],
    ['paused', false],
    ['blocked', false],
    ['done', true],
  ];
  for (const checker of [AUTHORITY_CHECK, require(path.join(ROOT, 'codex/hooks/completion-authority-check.cjs'))]) {
    for (const [status, terminal] of canonical) {
      const spec = { schema_version: '2.1', status };
      assert.equal(checker.isValidLifecycleStatus(spec), true, status);
      assert.equal(checker.isDurableCloseout(spec), terminal, status);
    }
    for (const alias of ['completed', 'complete', 'in-progress']) {
      const spec = { schema_version: '2.1', status: alias, current_phase: 'closeout' };
      assert.equal(checker.isValidLifecycleStatus(spec), false, alias);
      assert.equal(checker.isDurableCloseout(spec), false, alias);
    }
    assert.equal(checker.isValidLifecycleStatus({ schema_version: '2.0', status: 'completed' }), true);
    assert.equal(checker.isDurableCloseout({ schema_version: '2.0', status: 'in_progress', current_phase: 'closeout' }), true);
  }
});

test('final-state authority loads the validator CommonJS API directly and propagates canonical failures', () => {
  const root = gitFixture();
  try {
    const validatorPath = path.join(ROOT, 'claude/scripts/validate-spec-output.cjs');
    const canonicalValidator = require(validatorPath);
    const featureDir = path.join(root, 'specs', 'direct-validator-api');
    fs.mkdirSync(featureDir, { recursive: true });
    const specFile = path.join(featureDir, 'spec.json');
    const digest = `sha256:${'a'.repeat(64)}`;
    const candidate = {
      featureName: 'direct-validator-api', featureDir, specFile,
      spec: {
        schema_version: '2.1', status: 'done', ready_for_implementation: true,
        validation: { status: 'completed', semantic_review: { status: 'completed', semantic_digest: digest } },
        workflow_policy: POLICY.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Routine' }),
      },
    };
    fs.writeFileSync(specFile, `${JSON.stringify(candidate.spec, null, 2)}\n`);
    const validatorFixture = path.join(root, 'direct-validator.cjs');
    fs.writeFileSync(validatorFixture, [
      "'use strict';",
      "module.exports = {",
      "  validateSpec() { return { errors: ['direct-api-canonical-failure'], warnings: [] }; },",
      `  computeSemanticDigest21() { return { errors: [], digest: '${digest}' }; },`,
      "};",
      '',
    ].join('\n'));
    const invalidFixture = path.join(root, 'invalid-validator.cjs');
    fs.writeFileSync(invalidFixture, 'module.exports = { validateSpec() {} };\n');

    for (const [name, checkerPath] of [
      ['claude', path.join(ROOT, 'claude/hooks/completion-authority-check.cjs')],
      ['codex', path.join(ROOT, 'codex/hooks/completion-authority-check.cjs')],
    ]) {
      const checker = require(checkerPath);
      assert.doesNotMatch(fs.readFileSync(checkerPath, 'utf8'), /spawnSync|node:child_process|require\(['"]child_process['"]\)/, `${name} has no validator CLI path`);
      const dependencies = checker.finalStateDependencies();
      assert.equal(dependencies.validator.validateSpec, canonicalValidator.validateSpec, `${name} resolves the source CommonJS API directly`);
      assert.equal(dependencies.validator.computeSemanticDigest21, canonicalValidator.computeSemanticDigest21, `${name} resolves the digest API directly`);
      const directValidator = checker.validatorApi(validatorFixture);
      const result = checker.validateCanonicalFinalState({
        policy: POLICY, projectRoot: root, candidate,
        dependencies: {
          validator: directValidator,
          grounder: { groundSpec: () => ({ errors: [], warnings: [] }) },
          semanticAuthority: { verifyAttestation: () => ({ ok: true }) },
        },
      });
      assert.equal(result.ok, false, name);
      assert.match(result.reason, /direct-api-canonical-failure/, name);
      assert.throws(() => checker.validatorApi(invalidFixture), /must export validateSpec and computeSemanticDigest21/, name);
    }
  } finally { cleanupFixture(root); }
});

test('persisted resolver isolates exact explicit target from malformed siblings and scans globally only without target', () => {
  const root = gitFixture();
  try {
    prepare(root, { feature: 'exact-target', phase: 'implementation' });
    const malformedDir = path.join(root, 'specs', 'malformed-sibling');
    fs.mkdirSync(malformedDir, { recursive: true });
    fs.writeFileSync(path.join(malformedDir, 'spec.json'), '{ malformed');
    const explicit = RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {}, target: { featureName: 'exact-target' } });
    assert.equal(explicit.error, undefined);
    assert.equal(explicit.featureName, 'exact-target');
    const global = RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {} });
    assert.equal(global.error, 'invalid_specs');
    for (const target of [{ featureName: '' }, { featureName: 42 }, { specPath: '../escape/spec.json' }]) {
      assert.match(RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {}, target }).error, /^explicit_/);
    }
  } finally { cleanupFixture(root); }
});
