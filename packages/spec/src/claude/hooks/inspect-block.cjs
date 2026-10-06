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
  const path = require('path');
  const { execSync } = require('child_process');

  // Directories that should never be read (too large / irrelevant to LLM)
  const BLOCKED_DIRS = [
    'node_modules', 'dist', 'build', '.next', '.nuxt', '.output',
    '__pycache__', '.venv', 'venv',
    'vendor', 'target',
    '.git', 'coverage', '.nyc_output',
  ];

  // Glob patterns too broad to be useful
  const BROAD_GLOB = [/^\*\*\/\*$/, /^\*\*\.\w+$/, /^\*\*\/\*\.\w+$/];

  // Commands that are always allowed (build tools, package managers, venv)
  const ALLOWED_CMD = /^(npm|pnpm|yarn|bun|npx|pnpx|bunx|tsc|vite|esbuild|webpack|rollup|turbo|nx|jest|vitest|eslint|prettier|go|cargo|make|mvn|gradle|dotnet|docker|kubectl|helm|python3?|pip|uv|deno|bundle|rake|php|composer|ruby|mix)\b/;
  const VENV_EXEC   = /(^|[\/\\])\.?venv[\/\\](bin|Scripts)[\/\\]/;
  const VENV_CREATE = /^(python3?|py)\s+.*-m\s+venv\s+|^uv\s+venv(\s|$)/;

  function isAllowedCommand(cmd) {
    const s = cmd.trim().replace(/^(\w+=\S+\s+)+/, '').replace(/^(sudo|env|time)\s+/, '').trim();
    return ALLOWED_CMD.test(s) || VENV_EXEC.test(s) || VENV_CREATE.test(s);
  }

  function isBlockedPath(p) {
    return p.replace(/\\/g, '/').split('/').some(seg => BLOCKED_DIRS.includes(seg));
  }

  function isBroadGlob(p) {
    return BROAD_GLOB.some(r => r.test(p.trim()));
  }

  function extractPaths(toolName, input) {
    const out = [];
    if (!input) return out;
    if (input.file_path) out.push(input.file_path);
    if (input.path)      out.push(input.path);
    if (input.pattern)   out.push(input.pattern);
    if (typeof input.command === 'string') {
      const m = input.command.match(/(?:cat|ls|find|head|tail)\s+(\S+)/g);
      if (m) m.forEach(s => out.push(s.trim().split(/\s+/).pop()));
    }
    return out.filter(Boolean);
  }

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
  const cwd       = data.cwd        || process.cwd();
  const runtime   = readRuntime(cwd);

  if (runtime.scout?.enabled === false || runtime.inspect?.enabled === false) process.exit(0);

  // Allow all-permitted bash commands immediately
  if (toolInput.command) {
    const cmds = toolInput.command.split(/\s*(?:&&|\|\||;)\s*/).filter(Boolean);
    if (cmds.every(c => isAllowedCommand(c))) process.exit(0);
  }

  // Broad glob check
  if (toolInput.pattern && isBroadGlob(toolInput.pattern)) {
    denyWithReason(
      `SCOPE LIMIT EXCEEDED: Glob pattern is excessively broad\n` +
      `Requested Pattern: ${toolInput.pattern}\n\n` +
      `Please narrow your scope (e.g., src/**/*.ts rather than **/*.ts).`
    );
  }

  // Blocked directory check
  const paths = extractPaths(toolName, toolInput);
  for (const p of paths) {
    if (isBlockedPath(p)) {
      const blocked = p.replace(/\\/g, '/').split('/').find(s => BLOCKED_DIRS.includes(s));
      denyWithReason(
        `SCOPE LIMIT EXCEEDED: Directory "${blocked}/" is explicitly forbidden\n` +
        `Requested Path: ${p}\n` +
        `Restricted zones: ${BLOCKED_DIRS.join(', ')}`
      );
    }
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
