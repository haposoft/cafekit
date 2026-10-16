#!/usr/bin/env node
/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * SessionStart Hook — session.cjs
 * Implements: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * Fires once per session (startup, resume, clear, compact).
 * Detects project environment and writes context to CLAUDE_ENV_FILE.
 *
 * Exit: 0 always (fail-open)
 */

function logCrash(error) {
  try {
    const fs = require('fs'), path = require('path');
    const dir = require('./lib/hook-state-dir.cjs').hookStateDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'session', status: 'crash', error: error.message }) + '\n');
  } catch (_) {}
}

try {
  const fs   = require('fs');
  const path = require('path');
  const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
  const os   = require('os');
  const { projectRoot } = require('./lib/project-root.cjs');
  const { checkCafeKitUpdate } = require('./lib/update-check.cjs');
  const { clearSessionReservation } = require('./lib/rules-reservation.cjs');
  const { execSync } = require('child_process');

  // ── Utilities ─────────────────────────────────────────────────────────────
  function run(cmd, fallback = '', cwd = process.cwd()) {
    try {
      return execSync(cmd, {
        cwd, encoding: 'utf8', timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch { return fallback; }
  }

  /** Write a key=value export line to CLAUDE_ENV_FILE */
  function writeEnv(file, key, value) {
    if (!file) return;
    try {
      // Escape every char that stays special inside a double-quoted shell
      // string: backslash, dollar, backtick, and the closing quote. Escaping
      // only `"` left `$(...)`/backticks live, so a value sourced from repo
      // content (branch, package name) could execute when the env file is sourced.
      const safe = String(value ?? '').replace(/([\\$`"])/g, '\\$1');
      fs.appendFileSync(file, `export ${key}="${safe}"\n`);
    } catch { /* fail-open */ }
  }

  /** Read <runtime>/runtime.json config */
  function readRuntime(cwd) {
    try {
      const p = runtimePath(cwd, 'runtime.json');
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
    } catch { return {}; }
  }

  // ── Project Detection ──────────────────────────────────────────────────────

  function detectProjectType(cwd) {
    if (fs.existsSync(path.join(cwd, 'pnpm-workspace.yaml')) ||
        fs.existsSync(path.join(cwd, 'lerna.json'))) return 'monorepo';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
      if (pkg.workspaces) return 'monorepo';
      if (pkg.main || pkg.exports || pkg.module) return 'library';
    } catch { /* ignore */ }
    return 'app';
  }

  function detectPackageManager(cwd) {
    if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml')))  return 'pnpm';
    if (fs.existsSync(path.join(cwd, 'yarn.lock')))        return 'yarn';
    if (fs.existsSync(path.join(cwd, 'bun.lockb')))        return 'bun';
    if (fs.existsSync(path.join(cwd, 'package-lock.json'))) return 'npm';
    return '';
  }

  function detectFramework(cwd) {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
      );
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next'])        return 'next';
      if (deps['nuxt'])        return 'nuxt';
      if (deps['@sveltejs/kit']) return 'sveltekit';
      if (deps['react'])       return 'react';
      if (deps['vue'])         return 'vue';
      if (deps['svelte'])      return 'svelte';
      if (deps['express'])     return 'express';
      if (deps['fastify'])     return 'fastify';
      if (deps['hono'])        return 'hono';
    } catch { /* ignore */ }
    return '';
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  (async () => {
  const stdin   = fs.readFileSync(0, 'utf8').trim();
  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const payload = stdin ? normalizeHookPayload(JSON.parse(stdin)) : {};
  const source  = payload.source || 'unknown';
  if (source === 'compact') clearSessionReservation(payload.session_id);
  const envFile = process.env.CLAUDE_ENV_FILE;
  const cwd     = projectRoot(payload);
  const runtime = readRuntime(cwd);

  // Check CafeKit update in parallel with project detection (async, fail-open).
  const updateCheckPromise = checkCafeKitUpdate(runtimeDir(cwd)).catch(() => '');

  // Project detection
  const projectType = runtime.project?.type !== 'auto'
    ? (runtime.project?.type || detectProjectType(cwd))
    : detectProjectType(cwd);

  const packageManager = runtime.project?.packageManager !== 'auto'
    ? (runtime.project?.packageManager || detectPackageManager(cwd))
    : detectPackageManager(cwd);

  const framework = runtime.project?.framework !== 'auto'
    ? (runtime.project?.framework || detectFramework(cwd))
    : detectFramework(cwd);

  // Static environment
  const gitBranch  = run('git branch --show-current', '', cwd);
  const gitRoot    = run('git rev-parse --show-toplevel', '', cwd);
  const nodeVer    = process.version;
  const pythonVer  = run('python3 --version', '', cwd) || run('python --version', '', cwd);
  const user       = process.env.USERNAME || process.env.USER
                     || process.env.LOGNAME || os.userInfo().username;
  const timezone   = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Write env vars (no prefix — descriptive names only)
  if (envFile) {
    writeEnv(envFile, 'PROJECT_TYPE',    projectType);
    writeEnv(envFile, 'PACKAGE_MANAGER', packageManager);
    writeEnv(envFile, 'FRAMEWORK',       framework);
    writeEnv(envFile, 'GIT_BRANCH',      gitBranch);
    writeEnv(envFile, 'GIT_ROOT',        gitRoot);
    writeEnv(envFile, 'NODE_VERSION',    nodeVer);
    writeEnv(envFile, 'PYTHON_VERSION',  pythonVer);
    writeEnv(envFile, 'OS_PLATFORM',     process.platform);
    writeEnv(envFile, 'PROJECT_ROOT',    cwd);
    writeEnv(envFile, 'CLAUDE_USER',     user);
    writeEnv(envFile, 'TIMEZONE',        timezone);
    writeEnv(envFile, 'LOCALE',          process.env.LANG || '');
  }

  // Session summary + update notice
  const updateNotice = await updateCheckPromise;
  const parts = [];
  if (projectType)    parts.push(`Type: ${projectType}`);
  if (packageManager) parts.push(`PM: ${packageManager}`);
  if (framework)      parts.push(`Framework: ${framework}`);
  if (gitBranch)      parts.push(`Branch: ${gitBranch}`);
  // Orca (onorca.dev) sets this in every pane; it is a presence marker, not a secret.
  // ORCA_AGENT_HOOK_TOKEN and ORCA_AGENT_LAUNCH_TOKEN live in the same environment and
  // must never be read or printed here.
  if (typeof process.env.ORCA_PANE_KEY === 'string' && process.env.ORCA_PANE_KEY !== '') {
    parts.push('Orca: pane');
  }

  console.log(`Session ${source}. ${parts.length ? parts.join(' | ') : 'No project info detected.'}${updateNotice}`);

  if (typeof payload.cwd === 'string' && payload.cwd) {
    let sessionCwd = path.resolve(payload.cwd);
    try { sessionCwd = fs.realpathSync(sessionCwd); } catch { /* lexical fallback */ }
    if (sessionCwd !== cwd) {
      console.log(`CafeKit project root: ${cwd} (session working directory: ${sessionCwd}).`);
    }
  }

  // Compact warning — context compaction can lose pending approval state
  if (source === 'compact') {
    console.log('\n🚨 SESSION COMPRESSED — VERIFY PENDING AUTHORIZATIONS:');
    console.log('Any pending confirmations requested via AskUserQuestion might have been lost.');
    console.log('Do not proceed without explicitly asking the user again to ensure safety.');
    console.log('Use AskUserQuestion: "The chat context was compressed. Do I still have permission to proceed?"');

    // Anchors captured by the PreCompact hook. These are re-derivable facts, not
    // proof and not an authorization: they save the session from rebuilding its
    // bearings, and nothing more.
    try {
      const fs2 = require('fs'), p2 = require('path');
      if (typeof payload.session_id !== 'string' || !payload.session_id.trim()) process.exit(0);
      const key = require('crypto').createHash('sha256').update(payload.session_id).digest('hex');
      const file = p2.join(require('./lib/hook-state-dir.cjs').hookStateDir(), `compact-recovery-${key}.json`);
      const record = JSON.parse(fs2.readFileSync(file, 'utf8'));
      if (record.session_id !== payload.session_id) process.exit(0);
      const parts = [];
      if (record.branch) parts.push(`branch ${record.branch}`);
      if (record.head) parts.push(`HEAD ${record.head}`);
      if (typeof record.dirty_count === 'number') parts.push(`${record.dirty_count} uncommitted path(s)`);
      console.log('\n=== State before compaction ===');
      if (record.captured_at) console.log(`Captured: ${record.captured_at}`);
      if (parts.length) console.log(`Repository: ${parts.join(' | ')}`);
      const workflow = record.workflow;
      if (workflow && workflow.feature) {
        const counts = Object.entries(workflow.counts || {}).map(([k, v]) => `${v} ${k}`).join(', ');
        console.log(`Feature: ${workflow.feature}${counts ? ` (${counts})` : ''}`);
        if (Array.isArray(workflow.in_progress) && workflow.in_progress.length > 0) {
          console.log(`In flight: ${workflow.in_progress.join(', ')}`);
        }
      }
      console.log('Re-read these from disk before acting; they describe the moment before compaction.');
      console.log('=== End of pre-compaction state ===');
    } catch (_) { /* no capture available */ }
  }

  process.exit(0);
  })().catch((error) => {
    logCrash(error);
    process.exit(0);
  });

} catch (error) {
  logCrash(error);
  process.exit(0);
}
