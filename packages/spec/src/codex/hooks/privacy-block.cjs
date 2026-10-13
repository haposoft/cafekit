#!/usr/bin/env node
'use strict';

function deny(reason) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  })}\n`);
}

try {
  const { APPROVAL_PREFIX, createPending, hasGrant } = require('./lib/privacy-state.cjs');
  const { getHookContext, readPayload } = require('./lib/hook-context.cjs');
  const { sensitivePaths } = require('./lib/privacy-paths.cjs');
  const data = readPayload();
  if (!data) process.exit(0);
  const { projectRoot, sessionCwd, runtime } = getHookContext(data);
  if (runtime.privacyBlock === false) process.exit(0);

  const filePaths = sensitivePaths(data.tool_name || '', data.tool_input || {}, sessionCwd);
  const effectivePaths = filePaths;
  if (effectivePaths.length === 0) process.exit(0);
  if (!data.session_id) {
    deny(
      'Sensitive file access denied because this hook invocation had no Codex session ID. ' +
      'No approval request or token was created.'
    );
    process.exit(0);
  }
  const grantInput = {
    projectRoot,
    sessionCwd,
    sessionId: data.session_id,
    filePaths: effectivePaths
  };
  if (hasGrant(grantInput)) process.exit(0);

  const pending = createPending(grantInput);
  deny(
    `Sensitive file access denied: ${pending.displayName}. ` +
    `To approve access to exactly these paths for the next hour of this Codex ` +
    `session, send this exact user prompt: ` +
    `${APPROVAL_PREFIX}${pending.requestId}`
  );
  process.exit(0);
} catch {
  deny('Sensitive access could not be evaluated safely. No file content was read or logged.');
  process.exit(0);
}
