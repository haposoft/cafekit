#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * PreToolUse Hook — inspect-block.cjs
 * Implements: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * Blocks access to heavy directories that would flood the LLM context window.
 * Also warns on overly-broad glob patterns.
 *
 * Disable: set "inspect": { "enabled": false } in <runtime>/runtime.json
 *
 * Exit: 0 = allow, 2 = block
 */

try {
  const fs   = require('fs');
  const { BLOCKED_DIRS, inspectInput } = require('./lib/inspect-paths.cjs');
  const { projectRoot } = require('./lib/project-root.cjs');

  const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
  function readRuntime(cwd) {
    try {
      const p = runtimePath(cwd, 'runtime.json');
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
    } catch { return {}; }
  }

  // ── Main ──────────────────────────────────────────────────────────────────

/**
 * Deny the call with a reason every host can read.
 *
 * The reason is the JSON `permissionDecisionReason`, which Claude Code reads natively and
 * grok honours "regardless of exit code"; the same text also goes to stderr, because on
 * an exit-2 denial that is the channel Claude Code feeds back, and grok reads only the
 * first stderr line. Exit 2 stays so a host that reads neither still blocks.
 */
function denyWithReason(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  }) + '\n');
  process.stderr.write(reason + '\n');
  process.exit(2);
}

  const stdin   = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) process.exit(0);

  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const data      = normalizeHookPayload(JSON.parse(stdin));
  const toolName  = data.tool_name  || '';
  const toolInput = data.tool_input || {};
  let cwd         = data.cwd        || process.cwd();
  try { cwd = fs.realpathSync(cwd); } catch { /* retain the payload cwd when unavailable */ }
  const root      = projectRoot(data);
  const runtime   = readRuntime(root);

  if (runtime.scout?.enabled === false || runtime.inspect?.enabled === false) process.exit(0);

  const result = inspectInput(toolName, toolInput, {
    cwd, projectRoot: root
  });
  if (result.broadGlob) {
    denyWithReason(
      `SCOPE LIMIT EXCEEDED: Glob pattern is excessively broad\n` +
      `Requested Pattern: ${result.broadGlob}\n\n` +
      `Please narrow your scope (e.g., src/**/*.ts rather than **/*.ts).`
    );
  }

  if (result.blockedPath) {
      const { requested, blocked } = result.blockedPath;
      denyWithReason(
        `SCOPE LIMIT EXCEEDED: Directory "${blocked}/" is explicitly forbidden\n` +
        `Requested Path: ${requested}\n` +
        `Restricted zones: ${[...BLOCKED_DIRS].join(', ')}`
      );
  }

  process.exit(0);

} catch (e) {
  try {
    const fs = require('fs'), p = require('path');
    const d = require('./lib/hook-state-dir.cjs').hookStateDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(p.join(d, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'inspect-block', status: 'crash', error: e.message }) + '\n');
  } catch (_) {}
  process.exit(0);
}
