#!/usr/bin/env node
'use strict';

function context(message) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: message
    }
  })}\n`);
}

let projectRoot, sessionId, state;
try {
  const { resolveProjectRoot, readPayload } = require('./lib/hook-context.cjs');
  const data = readPayload();
  if (!data) process.exit(0);
  projectRoot = resolveProjectRoot(data);
  sessionId = data.session_id;
  let claimed = { ok: false, requestIds: [] };
  try {
    state = require('./lib/privacy-state.cjs');
    claimed = state.claimShortMarkers(projectRoot, sessionId);
  } catch { /* the outer catch retries invalidation, never approval */ }
  if (!claimed.ok) throw new Error('Short approval markers could not be claimed safely');
  const { APPROVAL_PREFIX, approvePending, cleanup } = state;
  // A pasted prompt arrives with whatever whitespace the terminal added around
  // it. Rejecting on a trailing newline made the approval look broken while the
  // id it named was still perfectly valid; the exactness that matters is the
  // request id, checked below.
  const prompt = String(data.prompt || '').trim();
  cleanup(projectRoot);

  const shortApproval = new Set(['y', 'yes', 'có']).has(prompt.normalize('NFC').toLowerCase());
  if (!shortApproval && !prompt.startsWith(APPROVAL_PREFIX)) process.exit(0);
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    context('CafeKit privacy approval rejected: this hook invocation had no Codex session ID.');
    process.exit(0);
  }
  let requestId;
  if (shortApproval) {
    if (claimed.requestIds.length !== 1) process.exit(0);
    requestId = claimed.requestIds[0];
  } else requestId = prompt.slice(APPROVAL_PREFIX.length);
  if (!/^[a-f0-9]{24}$/.test(requestId)) {
    context('CafeKit privacy approval rejected: the prompt did not exactly match a pending request.');
    process.exit(0);
  }

  const result = approvePending({
    projectRoot,
    sessionId,
    requestId
  });
  if (!result.ok) {
    context('CafeKit privacy approval rejected: request missing, expired, consumed, or from another session.');
    process.exit(0);
  }

  context(
    `User approved the pending sensitive access (${result.displayName}). ` +
    `The grant is session-bound, bound to exactly those paths, and expires in one hour. ` +
    `Tell the user which paths were just granted (${result.displayName}) before reading them.`
  );
  process.exit(0);
} catch {
  try {
    if (projectRoot && typeof sessionId === 'string' && sessionId.trim()) {
      (state || require('./lib/privacy-state.cjs')).claimShortMarkers(projectRoot, sessionId);
    }
  } catch { /* no approval follows an invalidation failure */ }
  context('CafeKit privacy approval failed safely; no token was issued.');
  process.exit(0);
}
