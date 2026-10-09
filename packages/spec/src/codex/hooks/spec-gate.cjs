#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  atomicWrite,
  getHookContext,
  hookStateDir,
  logCrash,
  readPayload
} = require('./lib/hook-context.cjs');
const {
  checkWorkflowReceiptDetails,
  checkWorkflowReceiptSet,
  loadSharedPolicy,
  receiptFixHint,
} = require('./lib/spec-receipt.cjs');

function emitBlock(reason) {
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
}

function sessionIdentity(payload) {
  const candidates = [
    payload && payload.session_id,
    payload && payload.sessionId,
    payload && payload.sessionID,
    payload && payload.session && payload.session.id,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim() !== '') || null;
}

try {
  const payload = readPayload();
  if (payload.stop_hook_active === true) process.exit(0);
  const loaded = loadSharedPolicy();
  if (!loaded.policy) {
    logCrash('spec-gate', loaded.error);
    emitBlock(`Completion gate unavailable: shared workflow policy could not be loaded (${loaded.error.message}). Repair ${loaded.path} before completing tasks.`);
    process.exit(0);
  }
  const POLICY = loaded.policy;
  // Match Claude: one invocation validates receipts against one checkout snapshot.
  require(path.join(path.dirname(loaded.path), 'provenance.cjs')).enableSnapshotMemo();
  const { projectRoot, runtime } = getHookContext(payload);
  if (typeof POLICY.deriveRuntimeContext !== 'function') {
    throw new Error('shared workflow policy lacks completion authority functions');
  }
  const resolver = require('./lib/spec-utils.cjs');
  // The payload is still the authority. The recorded target only answers the ambiguity
  // the payload leaves, which is what made the block unescapable on this runtime too.
  const target = resolver.extractExplicitTarget(payload)
    || resolver.readActiveFeatureTarget({ projectRoot, runtime });
  let resolved = resolver.resolveWorkflowCandidate({ projectRoot, runtime, target, includeCompleted: true });
  if (typeof resolver.refineWorkflowGateResolution === 'function') {
    resolved = resolver.refineWorkflowGateResolution(resolved);
  }
  if (!resolved) process.exit(0);
  if (resolved.layoutKind === 'process-v3-completed-set') {
    const configuredGate = runtime.spec?.completion_gate;
    if (configuredGate !== undefined && configuredGate !== true) {
      emitBlock('Completion gate: runtime.spec.completion_gate is a worker-writable flag, not an authorization; no completion-gate bypass is supported. Remove the flag and satisfy the gate.');
      process.exit(0);
    }
    const checked = checkWorkflowReceiptSet(
      resolved.candidates,
      projectRoot,
      sessionIdentity(payload),
    );
    if (checked.failures.length === 0) process.exit(0);
    const lines = [`Completion gate: ${checked.failures.length} done task(s) lack a verification receipt.`];
    for (const failure of checked.failures) {
      lines.push(`- \`${failure.featureName}/${failure.taskPath}\`: failed check(s) ${failure.failures.join(', ')}`);
      lines.push(`  In \`specs/${failure.featureName}/${failure.taskPath}\`: ${receiptFixHint(failure.failures, failure.body) || 'write a runtime-bound `## Receipt` with the planned command'}.`);
    }
    emitBlock(lines.slice(0, 8).join('\n'));
    process.exit(0);
  }
  if (resolved.error === 'multiple_active' || resolved.error === 'multiple_persisted') {
    process.stdout.write(`${JSON.stringify({
      decision: 'block',
      reason: `Completion gate: multiple active specs detected (${resolved.candidates.join(', ')}). Provide explicit feature target or resolve ambiguity before completing tasks.`
    })}\n`);
    process.exit(0);
  }
  if (resolved.error === 'invalid_specs') {
    process.stdout.write(`${JSON.stringify({
      decision: 'block',
      reason: `Completion gate: invalid workflow packet detected (${resolved.candidates.join(', ')}): ${resolved.reason}. Fix the packet's plan.md or task files before completing tasks.`
    })}\n`);
    process.exit(0);
  }
  if (resolved.error === 'explicit_not_found' || resolved.error === 'explicit_malformed') {
    process.stdout.write(`${JSON.stringify({
      decision: 'block',
      reason: `Completion gate: explicit spec target invalid (${resolved.error}): ${resolved.reason || resolved.explicitFeature || resolved.explicitPath || 'unknown'}. Provide a valid feature target inside configured specs root.`
    })}\n`);
    process.exit(0);
  }
  if (resolved.error) process.exit(0);
  const active = resolved;
  const runtimeContext = POLICY.deriveRuntimeContext({
    projectRoot,
    specsRoot: active.specsDir,
    specFile: active.stateFile,
    featureName: active.featureName,
    runtimeSession: sessionIdentity(payload),
  });
  const configuredGate = runtime.spec?.completion_gate;
  if (configuredGate !== undefined && configuredGate !== true) {
    emitBlock('Completion gate: runtime.spec.completion_gate is a worker-writable flag, not an authorization; no completion-gate bypass is supported. Remove the flag and satisfy the gate.');
    process.exit(0);
  }
  const registry = active.taskRegistry || {};
  const currentStatuses = Object.fromEntries(
    Object.entries(registry).map(([taskPath, task]) => [taskPath, task?.status || 'pending']),
  );
  const cacheFile = path.join(hookStateDir(projectRoot), 'spec-gate-last.json');
  const cacheExists = fs.existsSync(cacheFile);
  let cache = {};
  if (cacheExists) {
    try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { cache = {}; }
  }

  // Cache hardening: revalidate every done task on every Stop so a
  // cached PASS cannot hide later receipt/provenance mutations.
  // Cache is optimization only - validate every done task even on first run.
  const cacheIdentity = {
    project_root: runtimeContext.project_root,
    specs_root: runtimeContext.specs_root,
    spec_file: runtimeContext.spec_file,
    feature_name: runtimeContext.feature_name,
    runtime_session: runtimeContext.runtime_session,
    provenance_mode: runtimeContext.provenance_mode,
    Base: runtimeContext.base,
    Head: runtimeContext.head,
    context_id: runtimeContext.context_id,
  };
  const cacheEntries = cache && cache.entries && typeof cache.entries === 'object' ? cache.entries : {};
  const previous = cacheExists && cacheEntries[runtimeContext.context_id]
    ? cacheEntries[runtimeContext.context_id].tasks || {}
    : {};
  const allDoneTasks = Object.keys(registry).filter((taskPath) => (
    currentStatuses[taskPath] === 'done'
  ));
  const featureDir = path.join(active.specsDir, active.featureName);
  const failures = allDoneTasks
    .map((taskPath) => {
      const proof = checkWorkflowReceiptDetails(featureDir, taskPath, runtimeContext);
      return {
        taskPath,
        body: proof.body,
        failures: proof.failures
      };
    })
    .filter((result) => result.failures.length);

  const next = { ...previous, ...currentStatuses };
  for (const result of failures) {
    if (previous[result.taskPath] === undefined) delete next[result.taskPath];
    else next[result.taskPath] = previous[result.taskPath];
  }
  try {
    atomicWrite(cacheFile, `${JSON.stringify({
      entries: { ...cacheEntries, [runtimeContext.context_id]: { identity: cacheIdentity, tasks: next } },
    })}\n`);
  } catch { /* Cache persistence is not completion authority. */ }

  if (!failures.length) process.exit(0);
  const lines = [`Completion gate: ${failures.length} done task(s) lack a verification receipt.`];
  for (const result of failures) {
    lines.push(`- \`${result.taskPath}\`: failed check(s) ${result.failures.join(', ')}`);
    lines.push(`  In \`specs/${active.featureName}/${path.posix.basename(result.taskPath)}\`: ${receiptFixHint(result.failures, result.body) || 'write a runtime-bound `## Receipt` with command output'}.`);
  }
  process.stdout.write(`${JSON.stringify({
    decision: 'block',
    reason: lines.slice(0, 8).join('\n')
  })}\n`);
} catch (error) {
  logCrash('spec-gate', error);
  emitBlock(`Completion gate controlled failure: ${error.message}. Completion is blocked until the hook is repaired.`);
}
