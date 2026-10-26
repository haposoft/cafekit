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
  const { pluginRoot, resolveProjectRoot, readRuntime, resolveSessionCwd, readPayload } = require('./lib/hook-context.cjs');
  const { sensitivePaths } = require('./lib/privacy-paths.cjs');
  const data = readPayload();
  if (!data) process.exit(0);
  const projectRoot = resolveProjectRoot(data);
  const runtime = readRuntime(projectRoot);
  const sessionCwd = resolveSessionCwd(data);
  // A plugin is trusted once for every repository, so a repository cannot switch it off.
  if (runtime.privacyBlock === false && !pluginRoot()) process.exit(0);

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
    `To allow exactly these paths for one hour of this Codex session, the user replies ` +
    `y (or yes / có) as their very next message; any other reply cancels that shortcut, ` +
    `and it only works while this is the only pending request. Fallback exact prompt: ` +
    `${APPROVAL_PREFIX}${pending.requestId}`
  );
  process.exit(0);
} catch {
  deny('Sensitive access could not be evaluated safely. No file content was read or logged.');
  process.exit(0);
}
