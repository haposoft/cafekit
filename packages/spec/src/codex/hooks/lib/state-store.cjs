'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { atomicWrite } = require('./hook-context.cjs');

const MAX_ARCHIVES = 5;
const MAX_AGENTS = 3;
const MAX_FILES = 5;
const WAIT_BUFFER = new Int32Array(new SharedArrayBuffer(4));

function sessionKey(sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) return null;
  return crypto.createHash('sha256').update(sessionId).digest('hex');
}

function stateDir(projectRoot, sessionId) {
  const key = sessionKey(sessionId);
  return key
    ? path.join(projectRoot, '.codex', 'session-state', key)
    : null;
}

function acquireLock(dir) {
  const lock = path.join(dir, '.write-lock');
  fs.mkdirSync(dir, { recursive: true });
  const deadline = Date.now() + 3000;

  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lock);
      return () => {
        try { fs.rmdirSync(lock); } catch { /* already released */ }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') return null;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 15000) {
          fs.rmSync(lock, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      Atomics.wait(WAIT_BUFFER, 0, 0, 20);
    }
  }
  return null;
}

function withStateLock(projectRoot, sessionId, callback) {
  const dir = stateDir(projectRoot, sessionId);
  if (!dir) return false;
  const release = acquireLock(dir);
  if (!release) return false;
  try {
    callback(dir);
    return true;
  } finally {
    release();
  }
}

function readData(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
  } catch {
    return { todos: [], agentResults: [] };
  }
}

function runGit(projectRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function refreshGit(data, projectRoot) {
  data.branch = runGit(projectRoot, ['branch', '--show-current'])
    || runGit(projectRoot, ['rev-parse', '--short', 'HEAD']);
  const changed = runGit(projectRoot, ['diff', '--name-only', 'HEAD'])
    || runGit(projectRoot, ['diff', '--name-only']);
  const untracked = runGit(projectRoot, ['ls-files', '--others', '--exclude-standard']);
  data.modifiedFiles = [...new Set(
    `${changed}\n${untracked}`.split('\n').map((item) => item.trim()).filter(Boolean)
  )].slice(0, MAX_FILES);
  data.timestamp = new Date().toISOString();
  return data;
}

function markdown(data) {
  const todos = Array.isArray(data.todos) ? data.todos : [];
  const done = todos.filter((todo) => ['completed', 'done'].includes(todo.status));
  const pending = todos.filter((todo) => !['completed', 'done'].includes(todo.status));
  const agents = (data.agentResults || []).slice(-MAX_AGENTS);
  const files = data.modifiedFiles || [];
  const lines = [
    '# Session State',
    `<!-- Generated: ${data.timestamp || new Date().toISOString()} -->`,
    `<!-- Branch: ${data.branch || 'unknown'} -->`,
    '',
    '## What Worked (Verified)',
    ...(done.length ? done.map((todo) => `- ${todo.content}`) : ['- (No completed tasks recorded)']),
    '',
    "## What's Left",
    ...(pending.length ? pending.map((todo) => `- [ ] ${todo.content}`) : ['- (No pending tasks recorded)']),
    ''
  ];

  if (data.lastToolEvent) {
    lines.push('## Latest Tracked Tool', `- ${data.lastToolEvent}`, '');
  }
  if (data.lastAssistant) {
    lines.push('## Latest Assistant Message', data.lastAssistant, '');
  }
  for (const agent of agents) {
    lines.push(
      `## Agent Result: ${agent.type || 'unknown'} (${agent.id || 'unknown'})`,
      agent.message || '- Completed without a result message.',
      ''
    );
  }
  lines.push(
    '## Key Files Modified',
    ...(files.length ? files.map((file) => `- ${file}`) : ['- (No file changes detected)']),
    ''
  );
  return lines.join('\n');
}

function writeData(dir, data) {
  data.agentResults = (data.agentResults || []).slice(-MAX_AGENTS);
  atomicWrite(path.join(dir, 'data.json'), `${JSON.stringify(data, null, 2)}\n`);
  atomicWrite(path.join(dir, 'latest.md'), markdown(data));
}

function archive(dir) {
  const latest = path.join(dir, 'latest.md');
  if (!fs.existsSync(latest)) return;
  const archiveDir = path.join(dir, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  fs.copyFileSync(latest, path.join(archiveDir, `${stamp}-${process.pid}.md`));
  const files = fs.readdirSync(archiveDir).filter((name) => name.endsWith('.md')).sort();
  while (files.length > MAX_ARCHIVES) {
    fs.unlinkSync(path.join(archiveDir, files.shift()));
  }
}

module.exports = {
  archive,
  readData,
  refreshGit,
  stateDir,
  withStateLock,
  writeData
};
