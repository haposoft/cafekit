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
const { projectRoot } = require('./lib/project-root.cjs');
const { packetAt, namedPackets, explicitFailure } = require('./lib/spec-touch.cjs');
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
    require(path.join(__dirname, '..', 'scripts', 'provenance.cjs')).enableSnapshotMemo();
    RESOLVER = require(path.join(__dirname, '..', 'scripts', 'spec-resolver.cjs'));
    RECEIPT = require(path.join(__dirname, '..', 'scripts', 'spec-receipt.cjs'));
    if (typeof RESOLVER.resolveWorkflowCandidate !== 'function') throw new Error('shared spec resolver has no resolveWorkflowCandidate function');
  } catch (error) {
    logCrash(error);
    emitControlledFailure(error.message);
    process.exit(0);
  }

  const baseDir = projectRoot(payload);

  // Read runtime configuration if exists
  let runtime = {};
  try {
    const p = runtimePath(baseDir, 'runtime.json');
    if (fs.existsSync(p)) runtime = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { /* ignore */ }

  // Reminder toggle.
  // (The Stop completion gate has its own toggle: spec.completion_gate.)
  if (runtime.spec && runtime.spec.tollgate === false) process.exit(0);

  const explicitFeature = payload.featureName || payload.feature || payload.explicitFeature || null;
  const explicitPath = payload.explicitPath || payload.specPath || payload.spec_path || payload.featurePath || null;

  // ── Per-session touch set (Claude and omp) ────────────────────────────────
  // Several sessions can share one checkout. On Claude and omp the tollgate speaks only
  // about a packet this session touched. Codex runs its own copy, and grok sends
  // `sessionId` before normalization, so both keep the old behaviour.
  const claudeSession = rawPayload && typeof rawPayload.session_id === 'string' && rawPayload.session_id
    ? rawPayload.session_id
    : null;
  const touchFilter = ['.claude', '.omp'].includes(runtimeDirName()) && claudeSession !== null;
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
    if (touchFilter && specsRoot && !explicitFailure(payload) && /^(Edit|Write|MultiEdit)$/.test(payload.tool_name || '')) {
      const name = packetAt(payload.tool_input && payload.tool_input.file_path, specsRoot, cwd);
      if (name) addTouched([name]);
    }
    process.exit(0);
  }

  // A legacy packet (a specs/<x>/ directory without plan.md that the old flow left
  // behind) is no longer read. Say so once per session instead of on every prompt.
  const legacyPackets = typeof RESOLVER.findLegacyPackets === 'function'
    ? RESOLVER.findLegacyPackets(baseDir, runtime)
    : [];
  if (legacyPackets.length > 0) {
    const sessionKey = sessionIdentity(payload);
    const noticeFile = sessionKey
      ? path.join(
        require('./lib/hook-state-dir.cjs').hookStateDir(),
        `legacy-notice-${require('crypto').createHash('sha256').update(sessionKey).digest('hex')}.json`,
      )
      : null;
    let noticed = [];
    if (noticeFile) {
      try { noticed = JSON.parse(fs.readFileSync(noticeFile, 'utf8')); } catch { noticed = []; }
      if (!Array.isArray(noticed)) noticed = [];
    }
    const fresh = legacyPackets.filter((name) => !noticed.includes(name));
    if (fresh.length > 0) {
      for (const name of fresh) {
        console.log(`\n> ⚠️ \`specs/${name}\` is a legacy Specs packet without plan.md; CafeKit no longer reads it. Move ongoing work to a process-first plan.md packet.`);
      }
      if (noticeFile) {
        try {
          fs.mkdirSync(path.dirname(noticeFile), { recursive: true });
          fs.writeFileSync(noticeFile, JSON.stringify([...noticed, ...fresh].sort()));
        } catch { /* an unwritable state dir only repeats the notice */ }
      }
    }
  }

  if (touchFilter) {
    let packets = [];
    try {
      packets = fs.readdirSync(specsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch { /* no specs root */ }
    const named = specsRoot ? namedPackets(payload.prompt || payload.user_prompt, packets, specsRoot, baseDir) : [];
    if (typeof explicitFeature === 'string' && explicitFeature) named.push(explicitFeature);
    const fromPath = specsRoot ? packetAt(explicitPath, specsRoot, baseDir) : null;
    if (fromPath) named.push(fromPath);
    if (named.length) addTouched(named);
  }

  let resolved = RESOLVER.resolveWorkflowCandidate({ projectRoot: baseDir, runtime, explicitFeature, explicitPath });
  if (touchFilter && !explicitFeature && !explicitPath
    && ['multiple_active', 'invalid_specs'].includes(resolved?.error)) {
    const touched = readTouched();
    const candidates = resolved.candidates || [];
    if (!candidates.includes('<specs>') && !candidates.some(name => touched.has(name))) {
      const selected = [...touched].map(name => RESOLVER.resolveWorkflowCandidate({
        projectRoot: baseDir, runtime, explicitFeature: name,
      }));
      resolved = selected.find(candidate => candidate?.error);
      const active = selected.filter(candidate => candidate && !candidate.error && !candidate.allTasksDone);
      if (!resolved) resolved = active.length > 1
        ? { error: 'multiple_active', candidates: active.map(candidate => candidate.featureName) }
        : active[0] || null;
    }
  }

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
    console.log(`\n> ⚠️ Invalid workflow packet detected: ${cands}. ${resolved.reason}. Fix the packet's plan.md or task files before continuing. Tollgate paused.\n`);
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

  const featureName = resolved.featureName;
  if (touchFilter && !readTouched().has(featureName)) process.exit(0);
  const specsPath = resolved.specsDir;
  const runtimeContext = POLICY.deriveRuntimeContext({
    projectRoot: baseDir,
    specsRoot: specsPath,
    specFile: resolved.stateFile,
    featureName,
    runtimeSession: sessionIdentity(payload),
  });

  const phase = resolved.phase || 'unknown';
  const taskRegistry = resolved.taskRegistry || {};
  const taskEntries = Object.entries(taskRegistry);
  const taskCounts = taskEntries.reduce((acc, [, task]) => {
    const status = task?.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const featureDir = path.join(specsPath, featureName);
  const dependencyProof = RECEIPT.workflowDependencyProofState(featureDir, taskRegistry, runtimeContext, POLICY);
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
    return resolved.queueReady !== false && status === 'pending'
      && deps.every((dep) => dependencyProof[dep]?.eligible === true);
  });

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
  });
  const cacheName = touchFilter
    ? `tollgate-last-${require('crypto').createHash('sha256').update(claudeSession).digest('hex').slice(0, 16)}.txt`
    : 'tollgate-last.txt';
  const cacheFile = path.join(require('./lib/hook-state-dir.cjs').hookStateDir(), cacheName);

  let lastKey = '';
  if (stateKey) {
    try { lastKey = fs.readFileSync(cacheFile, 'utf8'); } catch { /* first run */ }
  }

  if (stateKey && lastKey === stateKey) {
    const migration = resolved.queueReady === false
      ? ' Add `Specs-Contract: process-first-ready-v1` after the plan title before tasks can enter Next.'
      : '';
    console.log(`\n> 🔵 Spec \`${featureName}\` @ \`${phase}\` (${taskCounts.done || 0}/${taskEntries.length} tasks done). Tollgate active — sync task Markdown when state changes.${migration}\n`);
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
  if (resolved.queueReady === false) {
    lines.push('- Migration required: add `Specs-Contract: process-first-ready-v1` after the plan title before tasks can enter Next.');
  }
  lines.push('- Sync each flat task `Status:` only after verified work; task proof belongs in that task\'s inline `## Receipt`.');
  lines.push(`- Workflow source: \`specs/${featureName}/plan.md\`; Stop re-checks every done receipt, binding Base/Head to the runtime only while a committed task file no longer matches its committed bytes.`);
  lines.push('- Hooks revalidate receipt bytes but never grant approval.');
  lines.push('');

  console.log(lines.join('\n'));
  process.exit(0);

} catch (e) {
  if (e.code === 'no_git_history') {
    console.log('Repo has no commits yet; create the first commit, then record Base/Head after it.');
    process.exit(0);
  }
  logCrash(e);
  emitControlledFailure(e.message);
  process.exit(0);
}
