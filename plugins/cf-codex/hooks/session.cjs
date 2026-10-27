#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  pluginRoot,
  resolveProjectRoot,
  hookStateDir,
  readRuntime,
  resolveSessionCwd,
  logCrash,
  readPayload
} = require('./lib/hook-context.cjs');
const { clearState } = require('./lib/privacy-state.cjs');
const { clearSessionReservation } = require('./lib/rules-reservation.cjs');

function readPackage(projectRoot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  } catch {
    return {};
  }
}

function detectProjectType(projectRoot, pkg) {
  if (
    fs.existsSync(path.join(projectRoot, 'pnpm-workspace.yaml'))
    || fs.existsSync(path.join(projectRoot, 'lerna.json'))
    || pkg.workspaces
  ) return 'monorepo';
  if (pkg.main || pkg.exports || pkg.module) return 'library';
  return 'app';
}

function detectPackageManager(projectRoot) {
  const locks = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm']
  ];
  return locks.find(([file]) => fs.existsSync(path.join(projectRoot, file)))?.[1] || '';
}

function detectFramework(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const candidates = [
    ['next', 'next'],
    ['nuxt', 'nuxt'],
    ['@sveltejs/kit', 'sveltekit'],
    ['react', 'react'],
    ['vue', 'vue'],
    ['svelte', 'svelte'],
    ['express', 'express'],
    ['fastify', 'fastify'],
    ['hono', 'hono']
  ];
  return candidates.find(([dependency]) => deps[dependency])?.[1] || '';
}

function gitBranch(projectRoot) {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function printCompactAnchors(projectRoot, sessionId) {
  if (!sessionId) return;
  try {
    const key = crypto.createHash('sha256').update(sessionId).digest('hex');
    const file = path.join(hookStateDir(projectRoot), `compact-recovery-${key}.json`);
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (record.session_id !== sessionId) return;
    const parts = [];
    if (record.branch) parts.push(`branch ${record.branch}`);
    if (record.head) parts.push(`HEAD ${record.head}`);
    if (typeof record.dirty_count === 'number') parts.push(`${record.dirty_count} uncommitted path(s)`);
    process.stdout.write('\n=== State before compaction ===\n');
    if (record.captured_at) process.stdout.write(`Captured: ${record.captured_at}\n`);
    if (parts.length) process.stdout.write(`Repository: ${parts.join(' | ')}\n`);
    process.stdout.write('Re-read these from disk before acting; they describe the moment before compaction.\n');
    process.stdout.write('=== End of pre-compaction state ===\n');
  } catch { /* no matching capture available */ }
}

(async () => {
try {
  const payload = readPayload();
  if (!payload) process.exit(0);
  // Invalidate this session before runtime configuration can interrupt startup.
  const sessionId = [payload.session_id, payload.sessionId, payload.sessionID, payload.session?.id]
    .find((value) => typeof value === 'string' && value.trim());
  const projectRoot = resolveProjectRoot(payload, {
    onStandDown: () => process.stdout.write(
      'CafeKit plugin is idle in this repository: its npx install (.codex/hooks.json) runs the CafeKit hooks here, ' +
      'and the CafeKit skills appear twice ($cf-* from .agents/skills and from the plugin). ' +
      'The privacy, inspect and completion gates run only if those npx hooks are trusted in /hooks; ' +
      'trust them there, or remove the npx install from this repository to use the plugin: ' +
      'run `npx @haposoft/cafekit@latest migrate` to preview the removal, then add --apply.\n'
    )
  });
  clearState(projectRoot, sessionId);
  let updateNotice = '';
  // The plugin is updated through its marketplace, so an npx update notice would be wrong there.
  if (!pluginRoot()) {
    try {
      const { checkCafeKitUpdate } = require('./lib/update-check.cjs');
      updateNotice = await checkCafeKitUpdate(path.join(projectRoot, '.codex'));
    } catch { /* an update failure must not interrupt session startup */ }
  }
  if (payload.source === 'compact') {
    clearSessionReservation(projectRoot, sessionId);
    process.stdout.write(
      'Session compacted. Pending confirmations may have been lost. Pending CafeKit privacy approvals were invalidated; request fresh user approval before continuing.\n'
    );
    printCompactAnchors(projectRoot, sessionId);
  }
  const runtime = readRuntime(projectRoot);
  const sessionCwd = resolveSessionCwd(payload);
  const pkg = readPackage(projectRoot);
  const configured = runtime.project || {};
  const projectType = configured.type && configured.type !== 'auto'
    ? configured.type
    : detectProjectType(projectRoot, pkg);
  const packageManager = configured.packageManager && configured.packageManager !== 'auto'
    ? configured.packageManager
    : detectPackageManager(projectRoot);
  const framework = configured.framework && configured.framework !== 'auto'
    ? configured.framework
    : detectFramework(pkg);
  const branch = gitBranch(projectRoot);

  // Orca (onorca.dev) sets ORCA_PANE_KEY in every pane; it is a presence marker, not a
  // secret. ORCA_AGENT_HOOK_TOKEN and ORCA_AGENT_LAUNCH_TOKEN live in the same
  // environment and must never be read or printed here.
  const insideOrcaPane = typeof process.env.ORCA_PANE_KEY === 'string' && process.env.ORCA_PANE_KEY !== '';
  const parts = [
    projectType && `Type: ${projectType}`,
    packageManager && `PM: ${packageManager}`,
    framework && `Framework: ${framework}`,
    branch && `Branch: ${branch}`,
    insideOrcaPane && 'Orca: pane'
  ].filter(Boolean);
  process.stdout.write(
    `Session ${payload.source || 'unknown'}. ${parts.join(' | ') || 'No project info detected.'}${updateNotice}\n`
  );

  if (sessionCwd !== projectRoot) {
    process.stdout.write(
      `CafeKit project root: ${projectRoot} (session working directory: ${sessionCwd}).\n`
    );
  }
} catch (error) {
  logCrash('session', error);
}
})();
