#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  atomicWrite,
  getHookContext,
  hookStateDir,
  logCrash,
  readPayload
} = require('./lib/hook-context.cjs');
const { loadSharedPolicy, loadSharedReceipt } = require('./lib/spec-receipt.cjs');

function emitControlledFailure(reason) {
  process.stdout.write(`> ⚠️ Spec tollgate unavailable: ${reason}. Repair the installed workflow policy before continuing.\n`);
}

function cacheFile(projectRoot, sessionId) {
  const key = crypto.createHash('sha256')
    .update(String(sessionId || 'unknown'))
    .digest('hex')
    .slice(0, 16);
  return path.join(hookStateDir(projectRoot), `tollgate-${key}.txt`);
}

try {
  const payload = readPayload();
  if (!payload) process.exit(0);
  const loaded = loadSharedPolicy();
  if (!loaded.policy) {
    logCrash('spec-state', loaded.error);
    emitControlledFailure(loaded.error.message);
    process.exit(0);
  }
  const POLICY = loaded.policy;
  const receiptLoaded = loadSharedReceipt();
  if (!receiptLoaded.receipt) throw receiptLoaded.error;
  const RECEIPT = receiptLoaded.receipt;
  const { projectRoot, runtime } = getHookContext(payload);
  if (runtime.spec?.tollgate === false) process.exit(0);
  const { resolveWorkflowCandidate } = require('./lib/spec-utils.cjs');
  const explicitFeature = payload.featureName || payload.feature || payload.explicitFeature || null;
  const explicitPath = payload.specPath || payload.spec_path || payload.featurePath || null;
  const resolved = resolveWorkflowCandidate(projectRoot, runtime, explicitFeature, explicitPath);
  if (!resolved) process.exit(0);
  if (resolved.error === 'multiple_active') {
    process.stdout.write(`> ⚠️ Multiple active specs detected: ${resolved.candidates.join(', ')}. Provide explicit feature target or resolve ambiguity. Tollgate paused.\n`);
    process.exit(0);
  }
  if (resolved.error === 'invalid_specs') {
    process.stdout.write(`> ⚠️ Invalid spec JSON detected: ${resolved.candidates.join(', ')}. ${resolved.reason}. Fix or remove malformed spec.json. Tollgate paused.\n`);
    process.exit(0);
  }
  if (resolved.error === 'explicit_not_found' || resolved.error === 'explicit_malformed') {
    const detail = resolved.reason || resolved.explicitFeature || resolved.explicitPath || 'unknown';
    process.stdout.write(`> ⚠️ Explicit spec target invalid (${resolved.error}): ${detail}. Provide a valid feature target inside configured specs root. Tollgate paused.\n`);
    process.exit(0);
  }
  if (resolved.error) process.exit(0);
  const active = resolved;
  const processWorkflow = active.layoutKind === 'process-v3';
  const runtimeContext = POLICY.deriveRuntimeContext({
    projectRoot,
    specsRoot: active.specsDir,
    specFile: active.stateFile || active.specFile || path.join(active.specsDir, active.featureName, 'spec.json'),
    featureName: active.featureName,
    runtimeSession: payload.session_id || payload.sessionId || payload.sessionID || payload.session?.id,
  });

  const phase = active.phase || active.spec?.current_phase || active.spec?.phase || 'unknown';
  const taskRegistry = active.taskRegistry || active.spec?.task_registry || {};
  const flashTasks = POLICY.flashState(taskRegistry);
  const tasks = Object.entries(taskRegistry);
  const counts = tasks.reduce((result, [, task]) => {
    const status = task?.status || 'pending';
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  const featureDir = path.join(active.specsDir, active.featureName);
  const statuses = new Map(tasks.map(([taskPath, task]) => [
    taskPath,
    task?.status || 'pending'
  ]));
  const dependencyProof = processWorkflow
    ? RECEIPT.workflowDependencyProofState(featureDir, taskRegistry, runtimeContext, POLICY)
    : {};
  const taskState = tasks.map(([taskPath, task]) => [
    taskPath,
    task?.status || 'pending',
    [...(Array.isArray(task?.dependencies) ? task.dependencies : [])].sort(),
  ]).sort(([left], [right]) => left.localeCompare(right));
  const proofState = Object.entries(dependencyProof).map(([taskPath, proof]) => [
    taskPath,
    proof.done,
    proof.valid,
    proof.eligible,
    proof.signature,
  ]);
  const next = tasks.find(([, task]) => (
    active.queueReady !== false
    && (task?.status || 'pending') === 'pending'
    && (task?.dependencies || []).every((dependency) => (
      processWorkflow ? dependencyProof[dependency]?.eligible === true : statuses.get(dependency) === 'done'
    ))
  ));
  const featureReceiptPresent = !processWorkflow
    && RECEIPT.safeRead(featureDir, 'feature-receipt.md').status === 'ok';
  const stateKey = JSON.stringify({
    project_root: runtimeContext.project_root,
    specs_root: runtimeContext.specs_root,
    spec_file: runtimeContext.spec_file,
    feature_name: runtimeContext.feature_name,
    runtime_session: runtimeContext.runtime_session,
    provenance_mode: runtimeContext.provenance_mode,
    Base: runtimeContext.base,
    Head: runtimeContext.head,
    context_id: runtimeContext.context_id,
    phase,
    workflow_contract: active.workflowContract || null,
    queue_ready: active.queueReady !== false,
    task_state: taskState,
    proof_state: proofState,
    done: counts.done || 0,
    total: tasks.length,
    feature_receipt_present: featureReceiptPresent,
  });
  const cache = cacheFile(projectRoot, runtimeContext.runtime_session);
  let previous = '';
  try { previous = fs.readFileSync(cache, 'utf8').trim(); } catch { /* first run */ }

  if (previous === stateKey) {
    const migration = processWorkflow && active.queueReady === false
      ? ' Add `Specs-Contract: process-first-ready-v1` after the plan title before tasks can enter Next.'
      : '';
    process.stdout.write(
      `> Spec \`${active.featureName}\` @ \`${phase}\` `
      + `(${counts.done || 0}/${tasks.length} tasks done). Tollgate active.${migration}\n`
    );
    process.exit(0);
  }

  atomicWrite(cache, `${stateKey}\n`);
  const lines = [
    `### Spec state changed: \`${active.featureName}\``,
    `- Phase: \`${phase}\` | Tasks: ${counts.done || 0} done / ${tasks.length} total`
  ];
  if (next) lines.push(`- Next unblocked: \`${next[0]}\``);
  if (flashTasks.length > 0) {
    lines.push(`- Flash verification pending: ${flashTasks.map((taskPath) => `\`${taskPath}\``).join(', ')}. A PASS proof keeps the persisted task in_progress until explicit sync-finalize.`);
  }
  if (processWorkflow) {
    if (active.queueReady === false) {
      lines.push('- Migration required: add `Specs-Contract: process-first-ready-v1` after the plan title before tasks can enter Next.');
    }
    lines.push(
      '- Sync each flat task `Status:` only after verified work; task proof belongs in that task\'s inline `## Receipt`.',
      `- Workflow source: \`specs/${active.featureName}/plan.md\`; Stop re-checks every done receipt, binding Base/Head to the runtime only while a committed task file no longer matches its committed bytes.`,
      '- Hooks revalidate receipt bytes but never grant approval.'
    );
  } else {
    lines.push(
      '- Sync `spec.json` and task Markdown status only after verified work; task proof belongs in `receipts/<task-basename>.md`.',
      `- Create \`feature-receipt.md\` once after final integration proof${featureReceiptPresent ? ' (present)' : ' (not required before closeout)'}.`,
      `- Validate with \`node .codex/scripts/validate-spec-output.cjs specs/${active.featureName}\`.`,
      '- Hooks revalidate receipt bytes but never grant approval.'
    );
  }
  process.stdout.write(`${lines.join('\n')}\n`);
} catch (error) {
  logCrash('spec-state', error);
  emitControlledFailure(error.message);
}
