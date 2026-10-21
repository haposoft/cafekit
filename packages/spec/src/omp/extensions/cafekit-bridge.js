/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * CafeKit bridge for Oh My Pi.
 *
 * omp has no hooks.json. It loads extensions from `.omp/extensions/` and emits lifecycle
 * events to them. This extension is the only thing that stands between those events and
 * CafeKit's gate scripts in `.omp/hooks/`: it shapes each omp event into the Claude-shaped
 * payload the scripts read, runs the scripts as child processes, and translates their
 * verdicts back into omp's contract.
 *
 * Facts read from the installed omp binary drive the design:
 *  - omp auto-loads only `<name>.{ts,js}` and `<dir>/index.{ts,js}` from `.omp/extensions/`, so this
 *    file is `.js`; an `.mjs` bridge is never loaded and every gate is silently off.
 *  - omp is a Bun binary: `process.execPath` is omp itself, not node, so the hooks are run
 *    with a `node` found on PATH (see hookRunner).
 *  - omp fails CLOSED at `tool_call`: a handler that throws or exceeds
 *    `extensionHandlers.toolCallTimeoutMs` (default 30000) is replaced by omp's own
 *    `{ block: true, reason: "Extension … timed out" }`. The bridge therefore keeps a
 *    shorter budget so a slow gate blocks with its own name instead of a generic reason.
 *  - omp's `input` payload is `{ type, text, images, source }` with no session id or cwd.
 *    Session-scoped hooks (`rules.cjs`) exit when the id is missing, so the bridge mints one
 *    per load and reuses it; omp loads an extension once per session.
 *  - `session_stop` carries `stop_hook_active`, the same field `spec-gate.cjs` uses to avoid
 *    re-blocking its own continuation. The bridge honours it before dispatching anything.
 *
 * Not mapped, because omp has no such events: SubagentStart (`agent.cjs`) and SubagentStop.
 * Task 04 documents this gap for operators.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Stay under omp's 30000 ms cut-off so our reason wins over its substitute. */
export const BRIDGE_TIMEOUT_MS = 8000;

/**
 * omp event → the CafeKit hooks registered for the equivalent Claude event.
 * Mirrors src/claude/settings/settings.json; `omp-bridge.test.js` fails if the two drift.
 */
export const DISPATCH = {
  session_start:          { event: 'SessionStart',     hooks: ['session.cjs', 'state.cjs'] },
  session_compact:        { event: 'SessionStart',     hooks: ['session.cjs'], source: 'compact' },
  session_before_compact: { event: 'PreCompact',       hooks: ['precompact.cjs'] },
  input:                  { event: 'UserPromptSubmit', hooks: ['secret-output-guardrail.cjs', 'rules.cjs', 'spec-state.cjs'] },
  tool_call:              { event: 'PreToolUse',       hooks: ['privacy-block.cjs', 'inspect-block.cjs'] },
  tool_result:            { event: 'PostToolUse',      hooks: ['state.cjs', 'spec-state.cjs'] },
  session_stop:           { event: 'Stop',             hooks: ['spec-gate.cjs', 'state.cjs'] },
};

/** Fallback id per extension load, for an omp whose context has no session manager. */
const SESSION_ID = `omp-${randomUUID()}`;

export function hooksDir() {
  if (process.env.CAFEKIT_OMP_HOOKS_DIR) return process.env.CAFEKIT_OMP_HOOKS_DIR;
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks');
}

function sessionIdFrom(ctx) {
  try {
    const id = ctx?.sessionManager?.getSessionId?.();
    return typeof id === 'string' && id ? id : null;
  } catch { return null; }
}

/**
 * Only the file paths of a tool result's details. An edit's details also carry the old and
 * new text of every file it changed, which no hook needs on stdin.
 */
function resultPaths(details) {
  if (!details || typeof details !== 'object') return {};
  const paths = (list) => (Array.isArray(list) ? list.filter((entry) => typeof entry?.path === 'string').map((entry) => ({ path: entry.path })) : undefined);
  const out = {};
  if (typeof details.path === 'string') out.path = details.path;
  const perFile = paths(details.perFileResults);
  if (perFile) out.perFileResults = perFile;
  const changes = paths(details.fileChanges);
  if (changes) out.fileChanges = changes;
  return out;
}

/** Build the Claude-shaped payload a CafeKit hook reads on stdin. */
export function shapePayload(kind, event, ctx) {
  const entry = DISPATCH[kind];
  const cwd = ctx?.cwd || process.cwd();
  const payload = {
    hook_event_name: entry.event,
    // omp's own id first: session_stop carries it, and touch and state must stay in one place.
    session_id: event?.session_id || sessionIdFrom(ctx) || SESSION_ID,
    cwd,
  };
  switch (kind) {
    case 'session_start':
      payload.source = event?.reason === 'resume' ? 'resume' : 'startup';
      break;
    case 'session_compact':
      payload.source = 'compact';
      break;
    case 'session_before_compact':
      payload.trigger = event?.reason === 'manual' ? 'manual' : 'auto';
      break;
    case 'input':
      payload.prompt = typeof event?.text === 'string' ? event.text : '';
      break;
    case 'tool_call':
      payload.tool_name = event?.toolName ?? event?.tool_name ?? '';
      payload.tool_input = event?.input ?? {};
      payload.tool_use_id = event?.toolCallId ?? null;
      break;
    case 'tool_result':
      payload.tool_name = event?.toolName ?? event?.tool_name ?? '';
      payload.tool_input = event?.input ?? {};
      payload.tool_response = { content: event?.content ?? [], isError: event?.isError === true, details: resultPaths(event?.details) };
      payload.tool_use_id = event?.toolCallId ?? null;
      break;
    case 'session_stop':
      payload.stop_hook_active = event?.stop_hook_active === true;
      payload.last_assistant_message = event?.last_assistant_message ?? null;
      break;
    default:
      break;
  }
  return payload;
}

/**
 * Read a hook's verdict. No CafeKit hook writes a block reason to stderr; the three
 * mechanisms in use are stdout JSON `decision:"block"`, stdout JSON
 * `hookSpecificOutput.permissionDecision` of `deny` (or `ask`, which omp cannot express),
 * and exit 2 with the reason on stdout. Anything else is an allow, and any stdout text
 * that is not a verdict is context to inject.
 */
export function interpretVerdict({ code, stdout = '', stderr = '' }, hookName) {
  const out = String(stdout).trim();
  const lines = out ? out.split('\n') : [];
  const inject = [];
  let block = null;

  for (const line of lines) {
    let parsed = null;
    try { parsed = JSON.parse(line); } catch { parsed = null; }
    if (!parsed || typeof parsed !== 'object') { inject.push(line); continue; }

    if (parsed.decision === 'block') {
      block = block || { reason: parsed.reason || `Blocked by ${hookName}` };
      continue;
    }
    const decision = parsed.hookSpecificOutput?.permissionDecision;
    if (decision === 'deny' || decision === 'ask') {
      block = block || { reason: parsed.hookSpecificOutput.permissionDecisionReason || `Blocked by ${hookName}` };
      continue;
    }
    const extra = parsed.hookSpecificOutput?.additionalContext;
    if (typeof extra === 'string' && extra) inject.push(extra);
  }

  if (!block && code === 2) {
    block = { reason: out || String(stderr).trim() || `Blocked by ${hookName}` };
  }
  return { block: Boolean(block), reason: block?.reason, inject: inject.join('\n').trim() };
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function realOrSelf(target) {
  try { return realpathSync(target); } catch { return path.resolve(target); }
}

/**
 * The executable that runs a hook. Under node that is `process.execPath`. Under Bun (omp)
 * it is the first `node` on PATH that sits in an absolute PATH entry outside the project,
 * so a repository cannot plant its own `node` (`.`, `node_modules/.bin`) in front of the
 * gates. Returns `{ command }` or `{ error }`; never throws.
 */
export function hookRunner({ cwd = process.cwd(), env = process.env, bun = process.versions?.bun, platform = process.platform } = {}) {
  if (!bun) return { command: process.execPath };
  const project = realOrSelf(cwd);
  const names = platform === 'win32'
    ? String(env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean).map((ext) => `node${ext.toLowerCase()}`)
    : ['node'];
  const delimiter = platform === 'win32' ? ';' : ':';
  for (const dir of String(env.PATH || env.Path || '').split(delimiter)) {
    if (!dir || !path.isAbsolute(dir)) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (!statSync(candidate).isFile()) continue;
        if (platform !== 'win32') accessSync(candidate, constants.X_OK);
      } catch { continue; }
      if (isInside(project, realOrSelf(candidate))) continue;
      return { command: candidate };
    }
  }
  return { error: 'node was not found on PATH outside the project' };
}

/** Run one hook as a child process with a hard budget. Never throws. */
export function dispatchHook(hookPath, payload, { cwd, timeoutMs = BRIDGE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const runner = hookRunner({ cwd });
    if (runner.error) {
      resolve({ code: null, signal: null, stdout: '', stderr: runner.error, timedOut: false, failed: true });
      return;
    }
    let child;
    try {
      child = spawn(runner.command, [hookPath], {
        cwd,
        env: { ...process.env, PROJECT_ROOT: cwd },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: String(error?.message || error), timedOut: false, failed: true });
      return;
    }
    const out = []; const err = [];
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      finish({ code: null, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), timedOut: true, failed: true });
    }, timeoutMs);
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', (error) => { clearTimeout(timer); finish({ code: null, stdout: '', stderr: String(error?.message || error), timedOut: false, failed: true }); });
    child.on('close', (code, signal) => { clearTimeout(timer); finish({ code, signal, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), timedOut: false, failed: false }); });
    try { child.stdin.write(JSON.stringify(payload)); child.stdin.end(); } catch { /* close handler still runs */ }
  });
}

/**
 * Dispatch every hook for an omp event and fold their verdicts. The first block wins and
 * short-circuits; injected context from allowing hooks is concatenated. A hook that fails
 * or times out on a gating event counts as a block naming that hook, matching omp's own
 * fail-closed posture rather than fighting it.
 */
export async function runEvent(kind, event, ctx, { timeoutMs = BRIDGE_TIMEOUT_MS, dir = hooksDir() } = {}) {
  const entry = DISPATCH[kind];
  if (!entry) return { block: false, inject: '' };

  // A Stop that omp re-fires after our own block must not block again (infinite loop).
  if (kind === 'session_stop' && event?.stop_hook_active === true) return { block: false, inject: '', skipped: 'stop_hook_active' };

  const gating = kind === 'tool_call' || kind === 'session_stop';
  const payload = shapePayload(kind, event, ctx);
  const injections = [];

  for (const hookName of entry.hooks) {
    const hookPath = path.join(dir, hookName);
    if (!existsSync(hookPath)) {
      // A missing gate must be loud on gating events; silently allowing is the worst outcome.
      if (gating) return { block: true, reason: `CafeKit gate ${hookName} is not installed under ${dir}`, hook: hookName };
      continue;
    }
    const result = await dispatchHook(hookPath, payload, { cwd: payload.cwd, timeoutMs });
    if (result.failed) {
      if (gating) {
        const why = result.timedOut ? `exceeded ${timeoutMs} ms` : (result.stderr.trim() || 'failed to run');
        return { block: true, reason: `CafeKit gate ${hookName} ${why}`, hook: hookName };
      }
      continue;
    }
    const verdict = interpretVerdict(result, hookName);
    if (verdict.block) return { block: true, reason: verdict.reason, hook: hookName };
    // A gate that dies without a verdict (a broken node shim, a crash, a kill) must not
    // read as an allow: only 0 and 2 are answers a gate gives on purpose.
    if (gating && result.code !== 0 && result.code !== 2) {
      const how = result.signal ? `was killed by ${result.signal}` : `exited with code ${result.code}`;
      return { block: true, reason: `CafeKit gate ${hookName} ${how}`, hook: hookName };
    }
    if (verdict.inject) injections.push(verdict.inject);
  }
  return { block: false, inject: injections.join('\n\n') };
}

/** Extension entry point: omp calls this once with its ExtensionAPI. */
export default function cafekitBridge(pi) {
  const opts = {};

  pi.on('session_start', async (event, ctx) => { await runEvent('session_start', event, ctx, opts); });
  pi.on('session_compact', async (event, ctx) => { await runEvent('session_compact', event, ctx, opts); });
  pi.on('session_before_compact', async (event, ctx) => { await runEvent('session_before_compact', event, ctx, opts); });
  pi.on('tool_result', async (event, ctx) => { await runEvent('tool_result', event, ctx, opts); });

  pi.on('tool_call', async (event, ctx) => {
    const r = await runEvent('tool_call', event, ctx, opts);
    return r.block ? { block: true, reason: r.reason } : undefined;
  });

  // omp cannot block a prompt, so a hook's block reason on input is surfaced as context.
  pi.on('input', async (event, ctx) => {
    const r = await runEvent('input', event, ctx, opts);
    const extra = [r.block ? r.reason : '', r.inject].filter(Boolean).join('\n\n');
    if (!extra) return { action: 'continue' };
    return { action: 'transform', text: `${event.text}\n\n${extra}`, images: event.images };
  });

  pi.on('session_stop', async (event, ctx) => {
    const r = await runEvent('session_stop', event, ctx, opts);
    if (r.block) return { decision: 'block', reason: r.reason };
    return r.inject ? { continue: true, additionalContext: r.inject } : undefined;
  });
}
