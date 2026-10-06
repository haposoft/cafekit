#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * PreCompact Hook — precompact.cjs
 * Implements: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * Compaction drops the transcript that told the session where it was. The
 * existing SessionStart warning tells the operator something was lost but not
 * what, so recovery starts from a blank slate and the session re-derives facts
 * it already had. This hook writes down the machine-checkable anchors just
 * before the drop: branch, HEAD, how dirty the tree is, and which task the
 * packet says is in flight. `session.cjs` prints them back on the compact
 * restart.
 *
 * Only facts the runtime can re-derive are recorded. Nothing here is proof of
 * work and nothing here grants an authorization; a compacted session must still
 * re-ask for a pending confirmation.
 *
 * Storage: the hook state directory (temp when run from source).
 * Exit: 0 always (fail-open).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RECOVERY_FILE = 'compact-recovery.json';

function gitLine(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const value = String(result.stdout || '').trim();
  return value === '' ? null : value;
}

function projectRoot(payload) {
  const configured = typeof process.env.CLAUDE_PROJECT_DIR === 'string' ? process.env.CLAUDE_PROJECT_DIR.trim() : '';
  const candidates = [configured, typeof payload.cwd === 'string' ? payload.cwd.trim() : '', process.cwd()];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { return fs.realpathSync(path.resolve(candidate)); } catch { /* next */ }
  }
  return process.cwd();
}

/** The one task the packet currently says is in flight, if any. */
function activeTask(root) {
  try {
    const RESOLVER = require(path.join(__dirname, '..', 'scripts', 'spec-resolver.cjs'));
    if (typeof RESOLVER.resolveWorkflowCandidate !== 'function') return null;
    const resolved = RESOLVER.resolveWorkflowCandidate({ projectRoot: root, runtime: {}, target: null });
    if (!resolved || resolved.error || resolved.layoutKind !== 'process-v3') return null;
    const registry = resolved.taskRegistry || {};
    const inProgress = Object.keys(registry).filter((taskPath) => registry[taskPath]?.status === 'in_progress');
    return {
      feature: resolved.featureName || null,
      in_progress: inProgress,
      counts: Object.values(registry).reduce((acc, task) => {
        const status = task?.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
    };
  } catch {
    return null;
  }
}

try {
  const stdin = fs.readFileSync(0, 'utf8').trim();
  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const payload = stdin ? normalizeHookPayload(JSON.parse(stdin)) : {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) process.exit(0);

  const root = projectRoot(payload);
  const status = gitLine(root, ['status', '--porcelain']);
  const record = {
    captured_at: new Date().toISOString(),
    trigger: typeof payload.trigger === 'string' ? payload.trigger : null,
    session_id: typeof payload.session_id === 'string' ? payload.session_id : null,
    project_root: root,
    branch: gitLine(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    head: gitLine(root, ['rev-parse', '--short', 'HEAD']),
    dirty_count: status === null ? null : status.split('\n').filter((line) => line.trim() !== '').length,
    workflow: activeTask(root),
  };

  const dir = require('./lib/hook-state-dir.cjs').hookStateDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, RECOVERY_FILE);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`);
  fs.renameSync(temp, target);
  process.exit(0);
} catch (error) {
  try {
    const dir = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'hook-log.jsonl'),
      `${JSON.stringify({ ts: new Date().toISOString(), hook: 'precompact', status: 'crash', error: error.message })}\n`,
    );
  } catch (_) { /* fail-open */ }
  process.exit(0);
}
