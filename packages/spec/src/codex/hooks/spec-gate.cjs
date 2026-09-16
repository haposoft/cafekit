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
  checkFeatureReceipt,
  checkReceiptDetails,
  checkWorkflowReceiptDetails,
  checkWorkflowReceiptSet,
  loadSharedPolicy,
  receiptFixHint,
} = require('./lib/spec-receipt.cjs');
const { taskStatusMap } = require('./lib/spec-utils.cjs');
const FINAL_STATE = require('./completion-authority-check.cjs');

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
  const { projectRoot, runtime } = getHookContext(payload);
  if (typeof POLICY.completionDecisionForSpec !== 'function') {
    throw new Error('shared workflow policy lacks completion authority functions');
  }
  const resolver = require('./lib/spec-utils.cjs');
  // The payload is still the authority. The recorded target only answers the ambiguity
  // the payload leaves, which is what made the block unescapable on this runtime too.
  const target = resolver.extractExplicitTarget(payload)
    || resolver.readActiveFeatureTarget({ projectRoot, runtime });
  let resolved = typeof resolver.resolveWorkflowCandidate === 'function'
    ? resolver.resolveWorkflowCandidate({ projectRoot, runtime, target, includeCompleted: true })
    : FINAL_STATE.resolveCandidate({ resolver, projectRoot, runtime, payload });
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
      lines.push(`  In \`specs/${failure.featureName}/${failure.taskPath}\`: ${receiptFixHint(failure.failures) || 'write a runtime-bound `## Receipt` with the planned command'}.`);
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
      reason: `Completion gate: invalid spec JSON detected (${resolved.candidates.join(', ')}): ${resolved.reason}. Fix or remove malformed spec.json before completing tasks.`
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
  const activeSpec = active.spec || {};
  const processWorkflow = active.layoutKind === 'process-v3';
  const lifecyclePhase = activeSpec.current_phase || activeSpec.phase;
  const explicitCloseout = ['done', 'completed', 'complete'].includes(activeSpec.status)
    || ['closeout', 'completion', 'completed', 'complete'].includes(lifecyclePhase);
  if (!processWorkflow && activeSpec.schema_version === '2.1') {
    const finalState = FINAL_STATE.evaluateCloseout({
      policy: POLICY,
      projectRoot,
      runtime,
      payload: { ...payload, session_id: sessionIdentity(payload) },
    });
    if (!finalState.ok) {
      emitBlock(`Completion gate: ${finalState.reason}`);
      process.exit(0);
    }
    if (finalState.active) process.exit(0);
  }
  const runtimeContext = POLICY.deriveRuntimeContext({
    projectRoot,
    specsRoot: active.specsDir,
    specFile: active.stateFile || active.specFile || path.join(active.specsDir, active.featureName, 'spec.json'),
    featureName: active.featureName,
    runtimeSession: sessionIdentity(payload),
  });
  const configuredGate = runtime.spec?.completion_gate;
  if (configuredGate !== undefined && configuredGate !== true) {
    emitBlock('Completion gate: runtime.spec.completion_gate is a worker-writable flag, not an authorization; no completion-gate bypass is supported. Remove the flag and satisfy the gate.');
    process.exit(0);
  }
  const registry = active.taskRegistry || activeSpec.task_registry || {};
  const currentStatuses = processWorkflow
    ? Object.fromEntries(Object.entries(registry).map(([taskPath, task]) => [taskPath, task?.status || 'pending']))
    : taskStatusMap(activeSpec);
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
  const staleFlashTasks = processWorkflow ? [] : Object.entries(registry)
    .filter(([, task]) => POLICY.isStaleFlashDone(task))
    .map(([taskPath]) => taskPath);
  if (staleFlashTasks.length > 0) {
    process.stdout.write(`${JSON.stringify({
      decision: 'block',
      reason: `Completion gate: ${staleFlashTasks.length} task(s) marked done with FLASH_UNVERIFIED (${staleFlashTasks.join(', ')}). Run /cf:test, then use explicit sync-finalize.`
    })}\n`);
    process.exit(0);
  }
  const allDoneTasks = Object.keys(registry).filter((taskPath) => (
    currentStatuses[taskPath] === 'done'
  ));
  const featureDir = path.join(active.specsDir, active.featureName);
  const receiptBodies = new Map();
  const failures = allDoneTasks
    .map((taskPath) => {
      const proof = processWorkflow
        ? checkWorkflowReceiptDetails(featureDir, taskPath, runtimeContext)
        : checkReceiptDetails(featureDir, taskPath, registry[taskPath], runtimeContext);
      if (proof.body) receiptBodies.set(taskPath, proof.body);
      return {
        taskPath,
        failures: proof.failures
      };
    })
    .filter((result) => result.failures.length);

  const featureCloseoutRequired = !processWorkflow && explicitCloseout && allDoneTasks.length > 0;
  const featureReceipt = featureCloseoutRequired
    ? checkFeatureReceipt(featureDir, runtimeContext)
    : null;
  if (featureReceipt && featureReceipt.failures.length) {
    failures.push({ taskPath: 'feature-receipt.md', failures: featureReceipt.failures });
  }
  const completion = featureCloseoutRequired && featureReceipt?.failures.length === 0
    && Object.prototype.hasOwnProperty.call(active.spec, 'workflow_policy')
    ? POLICY.completionDecisionForSpec(active.spec, {
      runtimeContext,
      executionReceipt: featureReceipt.body,
      taskContext: {},
    })
    : null;

  const next = { ...previous, ...currentStatuses };
  for (const result of failures) {
    if (previous[result.taskPath] === undefined) delete next[result.taskPath];
    else next[result.taskPath] = previous[result.taskPath];
  }
  atomicWrite(cacheFile, `${JSON.stringify({
    schema_version: '2',
    entries: { ...cacheEntries, [runtimeContext.context_id]: { identity: cacheIdentity, tasks: next } },
  })}\n`);

  const completionBlocked = completion && completion.completion !== 'complete' && completion.completion !== 'not_applicable';
  if (!failures.length && !completionBlocked) process.exit(0);
  const lines = [
    failures.length > 0
      ? `Completion gate: ${failures.length} done task(s) lack a verification receipt.`
      : 'Completion gate: workflow completion proof is incomplete.'
  ];
  for (const result of failures) {
    lines.push(`- \`${result.taskPath}\`: failed check(s) ${result.failures.join(', ')}`);
    lines.push(result.taskPath === 'feature-receipt.md'
      ? `  Run final integration proof, then write \`specs/${active.featureName}/feature-receipt.md\`.`
      : processWorkflow
        ? `  In \`specs/${active.featureName}/${path.posix.basename(result.taskPath)}\`: ${receiptFixHint(result.failures) || 'write a runtime-bound `## Receipt` with command output'}.`
        : `  Write canonical proof to \`specs/${active.featureName}/receipts/${path.posix.basename(result.taskPath)}\`; legacy \`## Evidence\` remains read-compatible.`);
  }
  if (completionBlocked) {
    lines.push(`- Completion decision unfinished: ${completion.blocker || 'required workflow proof is missing.'}`);
    if (Array.isArray(completion.missingProof) && completion.missingProof.length > 0) {
      lines.push(`  Missing proof: ${completion.missingProof.join(', ')}`);
    }
  }
  process.stdout.write(`${JSON.stringify({
    decision: 'block',
    reason: lines.slice(0, 8).join('\n')
  })}\n`);
} catch (error) {
  logCrash('spec-gate', error);
  emitBlock(`Completion gate controlled failure: ${error.message}. Completion is blocked until the hook is repaired.`);
}
