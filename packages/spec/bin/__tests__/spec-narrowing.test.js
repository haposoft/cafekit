'use strict';

// Two Stop hooks ask two different questions about the same repository, so they narrow an
// ambiguous scan differently. The gate asks which packet still has unfinished work, so it
// can validate that packet's receipts. Closeout approval asks which packet is claiming
// closeout, so it can demand a one-time approval for it. Counting finished history as
// ambiguity is what left a repository of accumulated features permanently blocked, with
// the documented escape — an explicit feature target — unavailable.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const RESOLVER = require(path.join(PACKAGE_ROOT, 'src/claude/scripts/spec-resolver.cjs'));

function withProject(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-narrowing-'));
  try {
    return run(fs.realpathSync(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A legacy packet: spec.json plus nested tasks, the shape issue #79 reports. */
function legacyPacket(root, name, { status, phase, taskStatus = 'done' } = {}) {
  const dir = path.join(root, 'specs', name);
  fs.mkdirSync(path.join(dir, 'tasks'), { recursive: true });
  const spec = { feature_name: name, task_registry: { 'tasks/task-R0-01-x.md': { status: taskStatus, completed_at: '2026-01-01T00:00:00.000Z' } } };
  if (status !== undefined) spec.status = status;
  if (phase !== undefined) spec.current_phase = phase;
  fs.writeFileSync(path.join(dir, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'tasks', 'task-R0-01-x.md'), `# Task\n\nStatus: ${taskStatus}\n`);
}

/** A process-first packet: plan.md plus one flat task file. */
function workflowPacket(root, name, taskStatus) {
  const dir = path.join(root, 'specs', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plan.md'), '# Plan\nSpecs-Contract: process-first-ready-v1\n');
  fs.writeFileSync(
    path.join(dir, 'task-01-x.md'),
    `# Task 01\n\nStatus: ${taskStatus}\n\n## Dependencies\n- none\n`
  );
}

function gateResolution(root) {
  const resolved = RESOLVER.resolveWorkflowCandidate({
    projectRoot: root, runtime: {}, target: null, includeCompleted: true,
  });
  return RESOLVER.refineWorkflowGateResolution(resolved);
}

// ── The gate: which packet still has work ───────────────────────────────────────────

test('a legacy repository resolves its one unfinished packet', () => {
  withProject((root) => {
    for (let index = 1; index <= 3; index += 1) {
      legacyPacket(root, `done-${index}`, { status: 'done', phase: 'closeout' });
    }
    legacyPacket(root, 'active-now', { status: 'in_progress', phase: 'execution', taskStatus: 'pending' });
    const resolved = gateResolution(root);
    assert.equal(resolved.error, undefined, `expected a resolution, got ${resolved.error}`);
    assert.equal(resolved.featureName, 'active-now');
  });
});

test('a legacy candidate never reaches the bulk branch', () => {
  // The bulk branch exits before the semantic-digest, FLASH_UNVERIFIED, feature-receipt
  // and completion-policy layers, so a legacy packet reaching it would turn a block into
  // a silent pass. With every legacy packet finished there is nothing to narrow to, and
  // the existing ambiguity must stand rather than the set being audited.
  withProject((root) => {
    legacyPacket(root, 'done-1', { status: 'done', phase: 'closeout' });
    legacyPacket(root, 'done-2', { status: 'done', phase: 'closeout' });
    const resolved = gateResolution(root);
    assert.notEqual(resolved.layoutKind, 'process-v3-completed-set');
    assert.ok(resolved.error, 'an all-legacy finished set must stay ambiguous');
  });
});

test('a process-first set still reaches the bulk branch', () => {
  withProject((root) => {
    workflowPacket(root, 'done-1', 'done');
    workflowPacket(root, 'done-2', 'done');
    assert.equal(gateResolution(root).layoutKind, 'process-v3-completed-set');
  });
});

test('one unfinished process-first packet still narrows', () => {
  withProject((root) => {
    workflowPacket(root, 'done-1', 'done');
    workflowPacket(root, 'active-now', 'pending');
    assert.equal(gateResolution(root).featureName, 'active-now');
  });
});

// ── Closeout approval: which packet is claiming closeout ────────────────────────────

test('one packet claiming closeout among finished ones resolves', () => {
  withProject((root) => {
    legacyPacket(root, 'shipped', { status: 'in_progress', phase: 'execution', taskStatus: 'done' });
    legacyPacket(root, 'closing', { status: 'done', phase: 'closeout' });
    const resolved = RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {} });
    assert.equal(resolved.error, undefined);
    assert.equal(resolved.featureName, 'closing');
  });
});

test('a lone finished packet still resolves', () => {
  // Four existing cases depend on this: closeout approval is claimed against a finished
  // spec, so a single packet must resolve whatever its status.
  for (const status of ['done', 'completed']) {
    withProject((root) => {
      legacyPacket(root, 'only', { status });
      const resolved = RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {} });
      assert.equal(resolved.featureName, 'only', `status ${status} must still resolve`);
    });
  }
});

test('a lone packet mid-execution still resolves', () => {
  // The closeout filter would drop this one, so the single-candidate return above it is
  // what keeps a repository holding exactly one in-flight packet resolvable. Without it
  // the hook goes silent for that repository instead of checking the packet.
  withProject((root) => {
    legacyPacket(root, 'solo', { status: 'in_progress', phase: 'implementation', taskStatus: 'pending' });
    const resolved = RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {} });
    assert.equal(resolved.featureName, 'solo');
  });
});

test('no packet claiming closeout resolves to null', () => {
  // null means nothing is in flight and the hook stays silent; an error would keep
  // blocking a repository where no closeout is being claimed at all.
  withProject((root) => {
    legacyPacket(root, 'a', { status: 'in_progress', phase: 'execution' });
    legacyPacket(root, 'b', { status: 'in_progress', phase: 'execution' });
    assert.equal(RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {} }), null);
  });
});

test('several packets claiming closeout stay ambiguous and name only those', () => {
  withProject((root) => {
    legacyPacket(root, 'closing-a', { status: 'done', phase: 'closeout' });
    legacyPacket(root, 'closing-b', { status: 'done', phase: 'closeout' });
    legacyPacket(root, 'working', { status: 'in_progress', phase: 'execution' });
    const resolved = RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {} });
    assert.equal(resolved.error, 'multiple_persisted');
    assert.deepEqual(resolved.candidates, ['closing-a', 'closing-b']);
  });
});

test('codex resolveCandidate agrees with the shared resolver', () => {
  // Codex kept its own candidate count, reachable because spec-utils did not export the
  // shared function. A Claude-only change would leave every Codex turn blocked.
  const codexCheck = require(path.join(PACKAGE_ROOT, 'src/codex/hooks/completion-authority-check.cjs'));
  const utils = require(path.join(PACKAGE_ROOT, 'src/codex/hooks/lib/spec-utils.cjs'));
  assert.equal(typeof utils.resolvePersistedSpec, 'function', 'the wrapper must be exported');
  withProject((root) => {
    legacyPacket(root, 'shipped', { status: 'in_progress', phase: 'execution', taskStatus: 'done' });
    legacyPacket(root, 'closing', { status: 'done', phase: 'closeout' });
    const shared = RESOLVER.resolvePersistedSpec({ projectRoot: root, runtime: {} });
    const viaCodex = codexCheck.resolveCandidate({ projectRoot: root, runtime: {}, payload: {} });
    assert.equal(viaCodex.featureName, shared.featureName);
  });
});
