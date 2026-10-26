#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { atomicWrite, getHookContext, logCrash, readPayload } = require('./lib/hook-context.cjs');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

try {
  const data = readPayload();
  if (!['UserPromptSubmit', 'PreToolUse'].includes(data.hook_event_name)) process.exit(0);
  if (typeof data.session_id !== 'string' || !data.session_id.trim()) {
    throw new Error('missing session ID');
  }
  const { projectRoot } = getHookContext(data);
  const sessionHash = sha256(data.session_id);
  const root = process.env.CAFEKIT_ASK_GUARD_DIR
    || path.join(os.tmpdir(), 'cafekit-ask-guard', sha256(projectRoot));
  const directory = path.join(path.resolve(root), sessionHash);
  const flag = path.join(directory, 'state.json');

  if (data.hook_event_name === 'UserPromptSubmit') {
    const active = /^(\$cf-ask|\/cf:ask)(?=\s|$)/.test(String(data.prompt || '').trim());
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    atomicWrite(flag, `${JSON.stringify({ active })}\n`);
    process.exit(0);
  }
  // The live probe exposed this native edit separately from its enclosing exec.
  // Shell commands and child sessions are outside this guard's scope.
  if (data.tool_name !== 'apply_patch') process.exit(0);
  let state;
  try {
    state = JSON.parse(fs.readFileSync(flag, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') process.exit(0);
    throw error;
  }
  if (typeof state?.active !== 'boolean') throw new Error('invalid session flag');
  if (!state.active) process.exit(0);

  fs.appendFileSync(path.join(directory, 'denials.jsonl'), `${JSON.stringify({
    timestamp: new Date().toISOString(),
    session_id_sha256: sessionHash,
    tool_name: 'apply_patch'
  })}\n`, { mode: 0o600 });
  process.stderr.write('This ask session answers only. Run $cf-fix to change files.\n');
  process.exit(2);
} catch {
  // Do not log exception text: malformed payloads can contain private input.
  logCrash('ask-guard', new Error('Ask guard could not read or persist session state; allowing the call.'));
}
