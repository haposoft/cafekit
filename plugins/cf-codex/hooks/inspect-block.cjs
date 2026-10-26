#!/usr/bin/env node
'use strict';

const {
  pluginRoot,
  resolveProjectRoot,
  logCrash,
  readPayload,
  readRuntime,
  resolveSessionCwd
} = require('./lib/hook-context.cjs');

function denyPath(requested, blocked, BLOCKED_DIRS) {
  process.stderr.write(
    `SCOPE LIMIT EXCEEDED: Directory "${blocked}/" is explicitly forbidden\n`
    + `Requested Path: ${requested}\n`
    + `Restricted zones: ${[...BLOCKED_DIRS].join(', ')}\n`
  );
  process.exit(2);
}

try {
  const { BLOCKED_DIRS, inspectInput } = require('./lib/inspect-paths.cjs');
  const payload = readPayload();
  if (!payload) process.exit(0);
  const projectRoot = resolveProjectRoot(payload);
  const runtime = readRuntime(projectRoot);
  const sessionCwd = resolveSessionCwd(payload);
  // A plugin is trusted once for every repository, so a repository cannot switch it off.
  const disabled = runtime.scout?.enabled === false || runtime.inspect?.enabled === false;
  if (disabled && !pluginRoot()) process.exit(0);

  const result = inspectInput(payload.tool_name || '', payload.tool_input || {}, { cwd: sessionCwd, projectRoot });
  if (result.broadGlob) {
    process.stderr.write(
      `SCOPE LIMIT EXCEEDED: Glob pattern is excessively broad\n`
      + `Requested Pattern: ${result.broadGlob}\n`
      + 'Please narrow the scope (for example, src/**/*.ts).\n'
    );
    process.exit(2);
  }
  if (result.blockedPath) {
    denyPath(result.blockedPath.requested, result.blockedPath.blocked, BLOCKED_DIRS);
  }
} catch (error) {
  logCrash('inspect-block', error);
}
