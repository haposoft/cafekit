#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  getHookContext,
  logCrash,
  readPayload
} = require('./lib/hook-context.cjs');
const { clearState } = require('./lib/privacy-state.cjs');
const { clearState: clearCompletionState } = require('./completion-authority-state.cjs');

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

try {
  const payload = readPayload();
  if (!payload) process.exit(0);
  const { projectRoot, runtime, sessionCwd } = getHookContext(payload);
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

  // Approval tokens never survive a session boundary or compaction.
  clearState(projectRoot);
  clearCompletionState(projectRoot, payload.session_id);

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
    `Session ${payload.source || 'unknown'}. ${parts.join(' | ') || 'No project info detected.'}\n`
  );

  if (sessionCwd !== projectRoot) {
    process.stdout.write(
      `CafeKit project root: ${projectRoot} (session working directory: ${sessionCwd}).\n`
    );
  }
  if (payload.source === 'compact') {
    process.stdout.write(
      'Session compacted. Pending CafeKit privacy approvals were invalidated; request fresh user approval if needed.\n'
    );
  }
} catch (error) {
  logCrash('session', error);
}
