#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * PreToolUse Hook — privacy-block.cjs
 *
 * Claude Code CLI privacy gate for sensitive files.
 *
 * Runtime contract:
 * - Sensitive access returns Claude Code's native PreToolUse "ask" decision
 * - The same decision applies to direct tools and Bash commands
 * - Symlinks are classified by their resolved target before their alias
 *
 * Exit: 0 (the JSON hook output carries the permission decision)
 */

try {
  const fs = require('fs');
  const path = require('path');
  const { sensitivePaths } = require('./lib/privacy-paths.cjs');

  const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
  function readRuntime(cwd) {
    try {
      const file = runtimePath(cwd, 'runtime.json');
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch {
      return {};
    }
  }

  function askForPermission(filePath) {
    const basename = path.basename(filePath);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `Sensitive file access requires approval: ${basename}`
      }
    }) + '\n');
  }

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) process.exit(0);

  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const data = normalizeHookPayload(JSON.parse(stdin));
  const toolName = data.tool_name || '';
  const toolInput = data.tool_input || {};
  const cwd = typeof data.cwd === 'string' && data.cwd.trim() ? data.cwd : process.cwd();
  const installedRuntime = path.resolve(__dirname, '..');
  const projectRoot = path.basename(installedRuntime).startsWith('.')
    ? path.dirname(installedRuntime) : process.env.CLAUDE_PROJECT_DIR || cwd;
  const runtime = readRuntime(projectRoot);

  if (runtime.privacyBlock === false) process.exit(0);

  const paths = sensitivePaths(toolName, toolInput, cwd);
  if (paths.length) askForPermission(paths[0]);

  process.exit(0);
} catch (_) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: 'Sensitive access could not be evaluated safely.'
    }
  }) + '\n');
  process.exit(0);
}
