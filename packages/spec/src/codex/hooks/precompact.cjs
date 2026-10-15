#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');
const { PROJECT_ROOT, atomicWrite, hookStateDir, logCrash, readPayload } = require('./lib/hook-context.cjs');

function gitLine(args) {
  try {
    return execFileSync('git', args, {
      cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch { return null; }
}

try {
  const payload = readPayload();
  if (!payload) process.exit(0);
  const sessionId = [payload.session_id, payload.sessionId, payload.sessionID, payload.session?.id]
    .find(value => typeof value === 'string' && value.trim());
  if (!sessionId) process.exit(0);
  const status = gitLine(['status', '--porcelain']);
  // These anchors are re-derivable facts, never proof or authorization.
  const record = {
    captured_at: new Date().toISOString(),
    session_id: sessionId,
    trigger: typeof payload.trigger === 'string' ? payload.trigger : null,
    project_root: PROJECT_ROOT,
    branch: gitLine(['rev-parse', '--abbrev-ref', 'HEAD']),
    head: gitLine(['rev-parse', '--short', 'HEAD']),
    dirty_count: status === null ? null : status.split('\n').filter(line => line.trim()).length,
  };
  const key = crypto.createHash('sha256').update(sessionId).digest('hex');
  atomicWrite(path.join(hookStateDir(PROJECT_ROOT), `compact-recovery-${key}.json`), `${JSON.stringify(record)}\n`);
} catch (error) {
  if (error.message === 'hook payload is empty') process.exit(0);
  logCrash('precompact', error);
}
