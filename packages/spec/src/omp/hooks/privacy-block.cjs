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

const EVALUATION_FAILURE = 'Sensitive access could not be evaluated safely.';

function askForPermission(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      // omp has no ask state on tool_call, so an ask under Claude becomes a denial here.
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  }) + '\n');
}

try {
  const fs = require('fs');
  const { sensitivePaths, displayNames } = require('./lib/privacy-paths.cjs');
  const { projectRoot: resolveProjectRoot } = require('./lib/project-root.cjs');

  const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
  function readRuntime(cwd) {
    try {
      const file = runtimePath(cwd, 'runtime.json');
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch {
      return {};
    }
  }

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) {
    askForPermission(EVALUATION_FAILURE);
    process.exit(0);
  }

  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const data = normalizeHookPayload(JSON.parse(stdin));
  const toolName = data.tool_name || '';
  const toolInput = data.tool_input || {};
  const cwd = typeof data.cwd === 'string' && data.cwd.trim() ? data.cwd : process.cwd();
  const projectRoot = resolveProjectRoot(data);
  const runtime = readRuntime(projectRoot);

  // A plugin is trusted once for every repository, so a repository cannot switch it off.
  if (runtime.privacyBlock === false && !require('./lib/plugin-options.cjs').isPlugin()) process.exit(0);

  const paths = sensitivePaths(toolName, toolInput, cwd);
  if (paths.length) askForPermission(`Sensitive file access requires approval: ${displayNames(paths)}`);

  process.exit(0);
} catch (_) {
  askForPermission(EVALUATION_FAILURE);
  process.exit(0);
}
