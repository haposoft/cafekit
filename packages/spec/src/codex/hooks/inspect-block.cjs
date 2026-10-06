#!/usr/bin/env node
'use strict';

const {
  getHookContext,
  logCrash,
  readPayload
} = require('./lib/hook-context.cjs');
const { BLOCKED_DIRS, inspectInput } = require('./lib/inspect-paths.cjs');

function denyPath(requested, blocked) {
  process.stderr.write(
    `SCOPE LIMIT EXCEEDED: Directory "${blocked}/" is explicitly forbidden\n`
    + `Requested Path: ${requested}\n`
    + `Restricted zones: ${[...BLOCKED_DIRS].join(', ')}\n`
  );
  process.exit(2);
}

try {
  const payload = readPayload();
  if (!payload) process.exit(0);
  const { runtime } = getHookContext(payload);
  if (runtime.scout?.enabled === false || runtime.inspect?.enabled === false) process.exit(0);

  const result = inspectInput(payload.tool_input || {});
  if (result.broadGlob) {
    process.stderr.write(
      `SCOPE LIMIT EXCEEDED: Glob pattern is excessively broad\n`
      + `Requested Pattern: ${result.broadGlob}\n`
      + 'Please narrow the scope (for example, src/**/*.ts).\n'
    );
    process.exit(2);
  }
  if (result.blockedPath) {
    denyPath(result.blockedPath.requested, result.blockedPath.blocked);
  }
} catch (error) {
  logCrash('inspect-block', error);
}
