#!/usr/bin/env node
'use strict';

const {
  APPROVAL_PREFIX,
  approvePending,
  cleanup
} = require('./lib/privacy-state.cjs');
const {
  getHookContext,
  readPayload
} = require('./lib/hook-context.cjs');

function context(message) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: message
    }
  })}\n`);
}

try {
  const data = readPayload();
  if (!data) process.exit(0);
  const { projectRoot } = getHookContext(data);
  // A pasted prompt arrives with whatever whitespace the terminal added around
  // it. Rejecting on a trailing newline made the approval look broken while the
  // id it named was still perfectly valid; the exactness that matters is the
  // request id, checked below.
  const prompt = String(data.prompt || '').trim();
  cleanup(projectRoot);

  if (!prompt.startsWith(APPROVAL_PREFIX)) process.exit(0);
  if (!data.session_id) {
    context('CafeKit privacy approval rejected: this hook invocation had no Codex session ID.');
    process.exit(0);
  }
  const requestId = prompt.slice(APPROVAL_PREFIX.length);
  if (`${APPROVAL_PREFIX}${requestId}` !== prompt || !/^[a-f0-9]{24}$/.test(requestId)) {
    context('CafeKit privacy approval rejected: the prompt did not exactly match a pending request.');
    process.exit(0);
  }

  const result = approvePending({
    projectRoot,
    sessionId: data.session_id,
    requestId
  });
  if (!result.ok) {
    context('CafeKit privacy approval rejected: request missing, expired, consumed, or from another session.');
    process.exit(0);
  }

  context(
    `User approved the pending sensitive access (${result.displayName}). ` +
    `The grant is session-bound, bound to exactly those paths, and expires in one hour.`
  );
  process.exit(0);
} catch {
  context('CafeKit privacy approval failed safely; no token was issued.');
  process.exit(0);
}
