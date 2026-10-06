#!/usr/bin/env node
/**
 * Copyright (c) 2026 soft. MIT License.
 *
 * UserPromptSubmit Hook — spec-state.cjs
 * Implements: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * Scans for an active spec in progress and dynamically injects
 * the State Sync (Tollgate) rule into the agent's context.
 *
 * Exit: 0 always; unavailable policy is surfaced as a controlled failure.
 */

const fs = require('fs');
const path = require('path');
const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');

function logCrash(error) {
  try {
    const d = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(
      path.join(d, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'spec-state', status: 'crash', error: error.message }) + '\n'
    );
  } catch (_) {}
}

function emitControlledFailure(reason) {
  console.log(`\n> ⚠️ Spec tollgate unavailable: ${reason}. Repair the installed workflow policy before continuing.\n`);
}

function sessionIdentity(payload) {
  const candidates = [
    payload && payload.session_id,
    payload && payload.sessionId,
    payload && payload.sessionID,
    payload && payload.session && payload.session.id,
  ];
  return candidates.find((value) => typeof value === 'string' && value.length > 0) || null;
}

function canonicalPath(value) {
  try { return fs.realpathSync(value); } catch { return null; }
}

/** Real path of `value`, resolving its deepest existing ancestor (the file may not exist yet). */
function canonicalTarget(value) {
  if (typeof value !== 'string' || !value) return null;
  let current = path.resolve(value);
  const rest = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    rest.unshift(path.basename(current));
    current = parent;
  }
  const real = canonicalPath(current);
  return real ? path.join(real, ...rest) : null;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Packets the prompt names: `specs/<name>`, a `/cf:<command> <name>` token, or the bare
 * name when it carries `-`, `_` or a digit. A plain word such as `docs` must use `specs/`,
 * so an ordinary sentence does not touch a packet.
 */
function packetsNamedIn(text, names) {
  if (typeof text !== 'string' || !text) return [];
  return names.filter((name) => {
    const n = escapeRegExp(name);
    if (new RegExp(`(^|[^\\w-])specs/${n}(?![\\w-])`).test(text)) return true;
    if (new RegExp(`/cf:[\\w-]+\\s+(?:specs/)?${n}(?![\\w-])`).test(text)) return true;
    return /[-_0-9]/.test(name) && new RegExp(`(^|[^\\w/-])${n}(?![\\w-])`).test(text);
  });
}

try {
  // ── Main ──────────────────────────────────────────────────────────────────

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) process.exit(0);

  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const rawPayload = JSON.parse(stdin);
  const payload = normalizeHookPayload(rawPayload);
  const cwd     = payload.cwd || process.cwd();

  let POLICY;
  let RESOLVER;
  let RECEIPT;
  try {
    POLICY = require(path.join(__dirname, '..', 'scripts', 'workflow-policy.cjs'));
    RESOLVER = require(path.join(__dirname, '..', 'scripts', 'spec-resolver.cjs'));
    RECEIPT = require(path.join(__dirname, '..', 'scripts', 'spec-receipt.cjs'));
    if (typeof POLICY.flashState !== 'function') throw new Error('shared workflow policy has no flashState function');
  } catch (error) {
    logCrash(error);
    emitControlledFailure(error.message);
    process.exit(0);
  }

  // Read runtime configuration if exists
  let runtime = {};
  try {
    const p = runtimePath(cwd, 'runtime.json');
    if (fs.existsSync(p)) runtime = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { /* ignore */ }

  // Reminder toggle.
  // (The Stop completion gate has its own toggle: spec.completion_gate.)
  if (runtime.spec && runtime.spec.tollgate === false) process.exit(0);

  // Same rule as spec-gate: an installed hook trusts its own location over the environment.
  const installedRoot = path.basename(path.resolve(__dirname, '..')).startsWith('.') ? path.resolve(__dirname, '..', '..') : null;
  const baseDir   = installedRoot || process.env.PROJECT_ROOT || cwd;
  const explicitFeature = payload.featureName || payload.feature || payload.explicitFeature || null;
  const explicitPath = payload.specPath || payload.spec_path || payload.featurePath || null;

  // ── Per-session touch set (Claude only) ───────────────────────────────────
  // Several sessions can share one checkout. On Claude the tollgate speaks only about a
  // packet this session touched. omp and Codex run their own copies, and grok sends
  // `sessionId` before normalization, so all three keep the old behaviour.
  const claudeSession = rawPayload && typeof rawPayload.session_id === 'string' && rawPayload.session_id
    ? rawPayload.session_id
    : null;
  const touchFilter = runtimeDirName() === '.claude' && claudeSession !== null;
  const touchFile = touchFilter
    ? path.join(
      require('./lib/hook-state-dir.cjs').hookStateDir(),
      `spec-touched-${require('crypto').createHash('sha256').update(claudeSession).digest('hex')}.json`,
    )
    : null;
  const readTouched = () => {
    try {
      const list = JSON.parse(fs.readFileSync(touchFile, 'utf8'));
      return new Set(Array.isArray(list) ? list : []);
    } catch { return new Set(); }
  };
  const addTouched = (names) => {
    const touched = readTouched();
    const before = touched.size;
    for (const name of names) touched.add(name);
    if (touched.size === before) return;
    try {
      fs.mkdirSync(path.dirname(touchFile), { recursive: true });
      fs.writeFileSync(touchFile, JSON.stringify([...touched].sort()));
    } catch { /* an unwritable state dir only loses the touch */ }
  };
  let specsRoot = null;
  try { specsRoot = RESOLVER.specsDirectory(baseDir, runtime); } catch { /* resolver reports it below */ }

  if (payload.hook_event_name === 'PostToolUse') {
    // Record only; no resolve, no git, no tollgate cache.
    if (touchFilter && specsRoot && /^(Edit|Write|MultiEdit)$/.test(payload.tool_name || '')) {
      const realRoot = canonicalPath(specsRoot);
      const realTarget = canonicalTarget(payload.tool_input && payload.tool_input.file_path);
      if (realRoot && realTarget) {
        const rel = path.relative(realRoot, realTarget);
        const parts = rel.split(path.sep);
        if (rel && parts[0] !== '..' && !path.isAbsolute(rel) && parts.length > 1) addTouched([parts[0]]);
      }
    }
    process.exit(0);
  }

  if (touchFilter) {
    let packets = [];
    try {
      packets = fs.readdirSync(specsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch { /* no specs root */ }
    const named = packetsNamedIn(payload.prompt, packets);
    if (typeof explicitFeature === 'string' && explicitFeature) named.push(explicitFeature);
    if (named.length) addTouched(named);
  }

  const resolveWorkflow = typeof RESOLVER.resolveWorkflowCandidate === 'function'
    ? RESOLVER.resolveWorkflowCandidate
    : RESOLVER.resolveActiveSpec;
  const resolved = resolveWorkflow({ projectRoot: baseDir, runtime, explicitFeature, explicitPath });

  if (!resolved) {
    process.exit(0); // No active spec, do nothing
  }

  if (resolved.error === 'multiple_active') {
    const candidates = resolved.candidates.join(', ');
    console.log(`\n> ⚠️ Multiple active specs detected: ${candidates}. Provide explicit feature target or resolve ambiguity. Tollgate paused.\n`);
    process.exit(0);
  }

  if (resolved.error === 'invalid_specs') {
    const cands = resolved.candidates.join(', ');
    console.log(`\n> ⚠️ Invalid spec JSON detected: ${cands}. ${resolved.reason}. Fix or remove malformed spec.json before continuing. Tollgate paused.\n`);
    process.exit(0);
  }

  if (resolved.error === 'explicit_not_found' || resolved.error === 'explicit_malformed') {
    const detail = resolved.reason || resolved.explicitFeature || resolved.explicitPath || 'unknown';
    console.log(`\n> ⚠️ Explicit spec target invalid (${resolved.error}): ${detail}. Provide a valid feature target inside configured specs root. Tollgate paused.\n`);
    process.exit(0);
  }

  if (resolved.error) {
    process.exit(0);
  }

  const activeSpec = resolved.spec || {};
  const processWorkflow = resolved.layoutKind === 'process-v3';
  const featureName = resolved.featureName;
  if (touchFilter && !readTouched().has(featureName)) process.exit(0);
  const specsPath = resolved.specsDir;
  const runtimeContext = POLICY.deriveRuntimeContext({
    projectRoot: baseDir,
    specsRoot: specsPath,
    specFile: resolved.stateFile || resolved.specFile || path.join(specsPath, featureName, 'spec.json'),
    featureName,
    runtimeSession: sessionIdentity(payload),
  });

  const phase = resolved.phase || activeSpec.current_phase || activeSpec.phase || 'unknown';
  const taskRegistry = resolved.taskRegistry || activeSpec.task_registry || {};
  const flashTasks = POLICY.flashState(taskRegistry);
  const taskEntries = Object.entries(taskRegistry);
  const taskCounts = taskEntries.reduce((acc, [, task]) => {
    const status = task?.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const featureDir = path.join(specsPath, featureName);
  const taskStatusByPath = new Map(taskEntries.map(([taskPath, task]) => [taskPath, task?.status || 'pending']));
  const dependencyProof = processWorkflow
    ? RECEIPT.workflowDependencyProofState(featureDir, taskRegistry, runtimeContext, POLICY)
    : {};
  const taskState = taskEntries.map(([taskPath, task]) => [
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
  const nextUnblocked = taskEntries.find(([, task]) => {
    const status = task?.status || 'pending';
    const deps = Array.isArray(task?.dependencies) ? task.dependencies : [];
    return resolved.queueReady !== false && status === 'pending' && deps.every((dep) => (
      processWorkflow ? dependencyProof[dep]?.eligible === true : taskStatusByPath.get(dep) === 'done'
    ));
  });
  const featureReceiptPresent = !processWorkflow
    && RECEIPT.safeRead(featureDir, 'feature-receipt.md').status === 'ok';

  // ── State-change gate: only emit the full tollgate when spec state changed ──
  // The cache is shared by installed hook copies, so its key must carry the
  // canonical project, complete session identity, and canonical spec identity.
  // If any identity is unavailable, skip caching and emit the full block.
  const stateKey = JSON.stringify({
    projectRoot: runtimeContext.project_root,
    specsRoot: runtimeContext.specs_root,
    specFile: runtimeContext.spec_file,
    featureName: runtimeContext.feature_name,
    runtimeSession: runtimeContext.runtime_session,
    provenanceMode: runtimeContext.provenance_mode,
    Base: runtimeContext.base,
    Head: runtimeContext.head,
    contextId: runtimeContext.context_id,
    phase,
    workflowContract: resolved.workflowContract || null,
    queueReady: resolved.queueReady !== false,
    taskState,
    proofState,
    done: taskCounts.done || 0,
    total: taskEntries.length,
    featureReceiptPresent,
  });
  const cacheFile = path.join(require('./lib/hook-state-dir.cjs').hookStateDir(), 'tollgate-last.txt');

  let lastKey = '';
  if (stateKey) {
    try { lastKey = fs.readFileSync(cacheFile, 'utf8'); } catch { /* first run */ }
  }

  if (stateKey && lastKey === stateKey) {
    const stateTarget = processWorkflow ? 'task Markdown' : '`spec.json`';
    const migration = processWorkflow && resolved.queueReady === false
      ? ' Add `Specs-Contract: process-first-ready-v1` after the plan title before tasks can enter Next.'
      : '';
    console.log(`\n> 🔵 Spec \`${featureName}\` @ \`${phase}\` (${taskCounts.done || 0}/${taskEntries.length} tasks done). Tollgate active — sync ${stateTarget} when state changes.${migration}\n`);
    process.exit(0);
  }

  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    if (stateKey) fs.writeFileSync(cacheFile, stateKey);
  } catch { /* cache failure only disables reminder compression */ }

  // Compact state-change block (enforcement lives on Stop via spec-gate.cjs).
  const lines = [];
  lines.push('');
  lines.push(`### Spec state changed: \`${featureName}\``);
  lines.push(`- Phase: \`${phase}\` | Tasks: ${(taskCounts.done || 0)} done / ${taskEntries.length} total` +
    (taskEntries.length > 0
      ? ` (${(taskCounts.in_progress || 0)} in_progress, ${(taskCounts.pending || 0)} pending, ${(taskCounts.blocked || 0)} blocked)`
      : ''));
  if (nextUnblocked) {
    lines.push(`- Next unblocked: \`${nextUnblocked[0]}\``);
  }
  if (flashTasks.length > 0) {
    lines.push(`- Flash verification pending: ${flashTasks.map((taskPath) => `\`${taskPath}\``).join(', ')}. A PASS proof keeps the persisted task in_progress until explicit sync-finalize.`);
  }
  if (processWorkflow) {
    if (resolved.queueReady === false) {
      lines.push('- Migration required: add `Specs-Contract: process-first-ready-v1` after the plan title before tasks can enter Next.');
    }
    lines.push('- Sync each flat task `Status:` only after verified work; task proof belongs in that task\'s inline `## Receipt`.');
    lines.push(`- Workflow source: \`specs/${featureName}/plan.md\`; Stop re-checks every done receipt, binding Base/Head to the runtime only while a committed task file no longer matches its committed bytes.`);
  } else {
    lines.push('- Sync `spec.json` + task Markdown status after verified work; task proof belongs in `receipts/<task-basename>.md`.');
    lines.push(`- Create \`feature-receipt.md\` once after final integration proof${featureReceiptPresent ? ' (present)' : ' (not required before closeout)'}.`);
    lines.push(`- Validate with \`node ${runtimeDirName()}/scripts/validate-spec-output.cjs specs/${featureName}\`; hooks revalidate receipt bytes but never grant approval.`);
  }
  lines.push('');

  console.log(lines.join('\n'));
  process.exit(0);

} catch (e) {
  logCrash(e);
  emitControlledFailure(e.message);
  process.exit(0);
}
