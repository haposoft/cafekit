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
  try {
    POLICY = require(policyPath);
    // One gate run checks every done receipt against the same checkout; capture it once.
    require(path.join(__dirname, '..', 'scripts', 'provenance.cjs')).enableSnapshotMemo();
    RESOLVER = require(path.join(__dirname, '..', 'scripts', 'spec-resolver.cjs'));
    RECEIPT = require(path.join(__dirname, '..', 'scripts', 'spec-receipt.cjs'));
    if (typeof POLICY.validateCanonicalReceipt !== 'function'
      || typeof RECEIPT.checkWorkflowTaskReceipt !== 'function'
      || typeof RECEIPT.checkWorkflowReceiptSet !== 'function'
      || typeof RESOLVER.resolveWorkflowCandidate !== 'function') {
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
  let resolved = RESOLVER.resolveWorkflowCandidate({ projectRoot: baseDir, runtime, target, includeCompleted: true });
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
      const hint = typeof RECEIPT.receiptFixHint === 'function' ? RECEIPT.receiptFixHint(failure.failures, failure.body) : null;
      lines.push(`  Fix in \`specs/${failure.featureName}/${failure.taskPath}\`: ${hint || 'write a runtime-bound `## Receipt` with the planned command'}.`);
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
      reason: `Completion gate: invalid workflow packet detected (${resolved.candidates.join(', ')}): ${resolved.reason}. Fix the packet's plan.md or task files before completing tasks.`,
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

  const featureName = resolved.featureName;
  const specsPath = resolved.specsDir;
  const runtimeContext = POLICY.deriveRuntimeContext({
    projectRoot: baseDir,
    specsRoot: specsPath,
    specFile: resolved.stateFile,
    featureName,
    runtimeSession: sessionIdentity(payload),
  });

  const configuredGate = runtime.spec?.completion_gate;
  if (configuredGate !== undefined && configuredGate !== true) {
    emitBlock('Completion gate: runtime.spec.completion_gate is a worker-writable flag, not an authorization; no completion-gate bypass is supported. Remove the flag and satisfy the gate.');
    process.exit(0);
  }
  const taskRegistry = resolved.taskRegistry || {};
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
    .map((taskPath) => {
      const proof = RECEIPT.checkWorkflowTaskReceipt(featureDir, taskPath, runtimeContext, POLICY);
      return { taskPath, fails: proof.failures, body: proof.body };
    })
    .filter((f) => f.fails.length > 0);

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

  if (failures.length === 0) process.exit(0);

  const lines = [`⚠️ Completion gate: ${failures.length} done task(s) lack a verification receipt.`];
  for (const { taskPath, fails, body } of failures) {
    lines.push(`- \`${taskPath}\`: failed check(s) ${fails.join(', ')}`);
    lines.push(`  Fix in \`specs/${featureName}/${path.posix.basename(taskPath)}\`: ${(typeof RECEIPT.receiptFixHint === 'function' && RECEIPT.receiptFixHint(fails, body)) || 'write a runtime-bound `## Receipt` with command output'}.`);
  }
  process.stdout.write(JSON.stringify({ decision: 'block', reason: lines.slice(0, 8).join('\n') }) + '\n');
  process.exit(0);

} catch (e) {
  logCrash(e);
  emitBlock(`Completion gate controlled failure: ${e.message}. Completion is blocked until the hook is repaired.`);
  process.exit(0);
}
