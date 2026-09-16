#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * Stop Hook — spec-gate.cjs
 * Implements: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * Blocks turn end when any done task lacks a verification receipt.
 * Block contract (exit 0 + stdout): {"decision":"block","reason":"..."}.
 *
 * Safety: stop_hook_active loop guard; no worker-writable completion-gate
 * bypass exists; cache is optimization only - every
 * done transition is validated even on first run / empty cache; crash → controlled block + hooks/.logs/hook-log.jsonl. Exit: 0 always.
 */

const fs = require('fs');
const path = require('path');
const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');

function projectRoot(payload = {}) {
  const configured = typeof process.env.CLAUDE_PROJECT_DIR === 'string'
    ? process.env.CLAUDE_PROJECT_DIR.trim()
    : '';
  if (configured) {
    try { return fs.realpathSync(path.resolve(configured)); } catch { /* continue */ }
  }

  const installedRoot = path.resolve(__dirname, '..', '..');
  const installedHook = runtimePath(installedRoot, 'hooks', path.basename(__filename));
  if (fs.existsSync(installedHook)) return installedRoot;

  const sourceFixture = typeof process.env.PROJECT_ROOT === 'string'
    ? process.env.PROJECT_ROOT.trim()
    : '';
  if (sourceFixture) {
    try { return fs.realpathSync(path.resolve(sourceFixture)); } catch { /* continue */ }
  }

  const legacy = typeof payload.cwd === 'string' ? payload.cwd.trim() : '';
  if (legacy) {
    try { return fs.realpathSync(path.resolve(legacy)); } catch { /* continue */ }
  }
  try { return fs.realpathSync(process.cwd()); } catch { return path.resolve(process.cwd()); }
}

function logCrash(error) {
  try {
    const d = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(
      path.join(d, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'spec-gate', status: 'crash', error: error.message }) + '\n'
    );
  } catch (_) {}
}

function emitBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
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
  const policyPath = path.join(__dirname, '..', 'scripts', 'workflow-policy.cjs');

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) throw new Error('hook payload is empty');

  const payload = JSON.parse(stdin);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('hook payload must be a JSON object');
  }

  // Never re-block a continuation caused by our own block (infinite-loop guard). Grok
  // spells this `stopHookActive`; both are accepted here rather than through the payload
  // reader, because the catch at the end of this file answers a block, so a reader that
  // threw above the guard would block every completion instead of only a foreign one.
  // The rest of this hook is already host-neutral: sessionIdentity() accepts sessionId
  // and sessionID, the resolver reads camelCase targets, and projectRoot reads cwd.
  if (payload.stop_hook_active === true || payload.stopHookActive === true) process.exit(0);

  let POLICY;
  let RESOLVER;
  let RECEIPT;
  let FINAL_STATE;
  try {
    POLICY = require(policyPath);
    RESOLVER = require(path.join(__dirname, '..', 'scripts', 'spec-resolver.cjs'));
    RECEIPT = require(path.join(__dirname, '..', 'scripts', 'spec-receipt.cjs'));
    FINAL_STATE = require('./completion-authority-check.cjs');
    if (typeof POLICY.validateCanonicalReceipt !== 'function'
      || typeof POLICY.completionDecisionForSpec !== 'function'
      || typeof RECEIPT.checkTaskReceipt !== 'function'
      || typeof RECEIPT.checkWorkflowReceiptSet !== 'function'
      || typeof FINAL_STATE.evaluateCloseout !== 'function') {
      throw new Error('shared workflow policy lacks completion authority functions');
    }
  } catch (error) {
    logCrash(error);
    emitBlock(`Completion gate unavailable: shared workflow policy could not be loaded (${error.message}). Repair ${policyPath} before completing tasks.`);
    process.exit(0);
  }

  const cwd     = projectRoot(payload);

  // Missing/malformed runtime.json keeps the gate ON (fail-closed, valve 3 style).
  let runtime = {};
  try {
    const rp = runtimePath(cwd, 'runtime.json');
    if (fs.existsSync(rp)) runtime = JSON.parse(fs.readFileSync(rp, 'utf8'));
  } catch { /* gate stays on */ }
  // Active-spec discovery via shared resolver — explicit target if present, else fail on ambiguity.
  const baseDir   = cwd;
  const target = (typeof RESOLVER.extractExplicitTarget === 'function'
    ? RESOLVER.extractExplicitTarget(payload)
    : null)
    // Only when the host named nothing. The recorded target is what makes "Provide
    // explicit feature target" an instruction a user can actually follow.
    || (typeof RESOLVER.readActiveFeatureTarget === 'function'
      ? RESOLVER.readActiveFeatureTarget({ projectRoot: baseDir, runtime })
      : null);
  let resolved = typeof RESOLVER.resolveWorkflowCandidate === 'function'
    ? RESOLVER.resolveWorkflowCandidate({ projectRoot: baseDir, runtime, target, includeCompleted: true })
    : FINAL_STATE.resolveCandidate({ resolver: RESOLVER, projectRoot: baseDir, runtime, payload });
  if (typeof RESOLVER.refineWorkflowGateResolution === 'function') {
    resolved = RESOLVER.refineWorkflowGateResolution(resolved);
  }
  if (!resolved) process.exit(0);
  if (resolved.layoutKind === 'process-v3-completed-set') {
    const configuredGate = runtime.spec?.completion_gate;
    if (configuredGate !== undefined && configuredGate !== true) {
      emitBlock('Completion gate: runtime.spec.completion_gate is a worker-writable flag, not an authorization; no completion-gate bypass is supported. Remove the flag and satisfy the gate.');
      process.exit(0);
    }
    const checked = RECEIPT.checkWorkflowReceiptSet(
      resolved.candidates,
      baseDir,
      sessionIdentity(payload),
      POLICY,
    );
    if (checked.failures.length === 0) process.exit(0);
    const lines = [`⚠️ Completion gate: ${checked.failures.length} done task(s) lack a verification receipt.`];
    for (const failure of checked.failures) {
      lines.push(`- \`${failure.featureName}/${failure.taskPath}\`: failed check(s) ${failure.failures.join(', ')}`);
      lines.push(`  Fix: write a runtime-bound \`## Receipt\` with the planned command in \`specs/${failure.featureName}/${failure.taskPath}\`.`);
    }
    emitBlock(lines.slice(0, 8).join('\n'));
    process.exit(0);
  }
  if (resolved.error === 'multiple_active' || resolved.error === 'multiple_persisted') {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Completion gate: multiple active specs detected (${resolved.candidates.join(', ')}). Provide explicit feature target or resolve ambiguity before completing tasks. Candidates: ${resolved.candidates.join(', ')}`
    }) + '\n');
    process.exit(0);
  }
  if (resolved.error === 'invalid_specs') {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Completion gate: invalid spec JSON detected (${resolved.candidates.join(', ')}): ${resolved.reason}. Fix or remove malformed spec.json before completing tasks.`
    }) + '\n');
    process.exit(0);
  }
  if (resolved.error === 'explicit_not_found' || resolved.error === 'explicit_malformed') {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Completion gate: explicit spec target invalid (${resolved.error}): ${resolved.reason || resolved.explicitFeature || resolved.explicitPath || 'unknown'}. Provide a valid feature target inside configured specs root.`
    }) + '\n');
    process.exit(0);
  }
  if (resolved.error) process.exit(0);

  const activeSpec = resolved.spec || {};
  const processWorkflow = resolved.layoutKind === 'process-v3';
  const featureName = resolved.featureName;
  const specsPath = resolved.specsDir;
  const lifecyclePhase = activeSpec.current_phase || activeSpec.phase;
  const explicitCloseout = ['done', 'completed', 'complete'].includes(activeSpec.status)
    || ['closeout', 'completion', 'completed', 'complete'].includes(lifecyclePhase);
  if (!processWorkflow && activeSpec.schema_version === '2.1') {
    const finalState = FINAL_STATE.evaluateCloseout({
      resolver: RESOLVER,
      policy: POLICY,
      projectRoot: baseDir,
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
    projectRoot: baseDir,
    specsRoot: specsPath,
    specFile: resolved.stateFile || resolved.specFile || path.join(specsPath, featureName, 'spec.json'),
    featureName,
    runtimeSession: sessionIdentity(payload),
  });

  const configuredGate = runtime.spec?.completion_gate;
  if (configuredGate !== undefined && configuredGate !== true) {
    emitBlock('Completion gate: runtime.spec.completion_gate is a worker-writable flag, not an authorization; no completion-gate bypass is supported. Remove the flag and satisfy the gate.');
    process.exit(0);
  }
  const taskRegistry = resolved.taskRegistry || activeSpec.task_registry || {};
  const cacheFile = path.join(require('./lib/hook-state-dir.cjs').hookStateDir(), 'spec-gate-last.json');
  const cacheExists = fs.existsSync(cacheFile);
  let cache = {};
  if (cacheExists) {
    try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { cache = {}; }
  }

  const currentStatuses = {};
  for (const [tp, task] of Object.entries(taskRegistry)) {
    currentStatuses[tp] = task?.status || 'pending';
  }

  const staleFlashTasks = processWorkflow ? [] : Object.entries(taskRegistry)
    .filter(([, task]) => POLICY.isStaleFlashDone(task))
    .map(([taskPath]) => taskPath);
  if (staleFlashTasks.length > 0) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Completion gate: ${staleFlashTasks.length} task(s) marked done with FLASH_UNVERIFIED (${staleFlashTasks.join(', ')}). Run /cf:test for exact proof, then use explicit sync-finalize.`
    }) + '\n');
    process.exit(0);
  }

  // Cache hardening: every Stop re-reads and re-checks the receipt of every
  // task currently marked done, so a cached PASS cannot hide later mutations
  // (deletion, placeholder, changed Verification/Command/Exit, missing
  // output, edited artifact bytes). Base/Head are compared against the live
  // runtime only while the task file has a copy in HEAD that it no longer
  // matches; committed-and-unchanged and never-committed are both checked on
  // structure alone, and work elsewhere in the tree never reopens a receipt.
  // Cache is an optimization, not truth.
  const featureCache = cacheExists ? (cache[featureName] || {}) : {};
  const allDoneTasks = Object.keys(taskRegistry).filter((tp) =>
    (taskRegistry[tp]?.status || 'pending') === 'done'
  );
  const featureDir = path.join(specsPath, featureName);
  const failures = allDoneTasks
    .map((taskPath) => ({
      taskPath,
      fails: processWorkflow
        ? RECEIPT.checkWorkflowTaskReceipt(featureDir, taskPath, runtimeContext, POLICY).failures
        : RECEIPT.checkTaskReceipt(featureDir, taskPath, taskRegistry[taskPath], runtimeContext, POLICY).failures,
    }))
    .filter((f) => f.fails.length > 0);

  const featureCloseoutRequired = !processWorkflow && explicitCloseout && allDoneTasks.length > 0;
  const featureReceipt = featureCloseoutRequired
    ? RECEIPT.checkFeatureReceipt(featureDir, runtimeContext, POLICY)
    : null;
  if (featureReceipt && featureReceipt.failures.length) {
    failures.push({ taskPath: 'feature-receipt.md', fails: featureReceipt.failures });
  }
  const completion = featureCloseoutRequired && featureReceipt?.failures.length === 0
    && Object.prototype.hasOwnProperty.call(activeSpec, 'workflow_policy')
    ? POLICY.completionDecisionForSpec(activeSpec, {
      runtimeContext,
      executionReceipt: featureReceipt.body,
      taskContext: {},
    })
    : null;

  // Always persist status transitions, including done → pending. Keep
  // failing done tasks at their previous cached status so a stale valid
  // entry cannot mask a mutated receipt on the next Stop; with
  // revalidation of every done task the gate still re-fires regardless.
  try {
    const nextFeature = { ...featureCache, ...currentStatuses };
    for (const { taskPath } of failures) {
      if (featureCache[taskPath] === undefined) delete nextFeature[taskPath];
      else nextFeature[taskPath] = featureCache[taskPath];
    }
    cache[featureName] = nextFeature;
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
  } catch { /* fail-open */ }

  const completionBlocked = completion && completion.completion !== 'complete' && completion.completion !== 'not_applicable';
  if (failures.length === 0 && !completionBlocked) process.exit(0);

  const lines = [
    failures.length > 0
      ? `⚠️ Completion gate: ${failures.length} done task(s) lack a verification receipt.`
      : '⚠️ Completion gate: workflow completion proof is incomplete.',
  ];
  for (const { taskPath, fails } of failures) {
    lines.push(`- \`${taskPath}\`: failed check(s) ${fails.join(', ')}`);
    lines.push(taskPath === 'feature-receipt.md'
      ? `  Fix: run final integration proof, then write \`specs/${featureName}/feature-receipt.md\`.`
      : processWorkflow
        ? `  Fix: write a runtime-bound \`## Receipt\` with command output in \`specs/${featureName}/${path.posix.basename(taskPath)}\`.`
        : `  Fix: write canonical proof to \`specs/${featureName}/receipts/${path.posix.basename(taskPath)}\`; legacy \`## Evidence\` remains read-compatible.`);
  }
  if (completionBlocked) {
    lines.push(`- Completion decision unfinished: ${completion.blocker || 'required workflow proof is missing.'}`);
    if (Array.isArray(completion.missingProof) && completion.missingProof.length > 0) {
      lines.push(`  Missing proof: ${completion.missingProof.join(', ')}`);
    }
  }
  process.stdout.write(JSON.stringify({ decision: 'block', reason: lines.slice(0, 8).join('\n') }) + '\n');
  process.exit(0);

} catch (e) {
  logCrash(e);
  emitBlock(`Completion gate controlled failure: ${e.message}. Completion is blocked until the hook is repaired.`);
  process.exit(0);
}
