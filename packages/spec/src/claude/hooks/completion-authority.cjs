#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
let STATE;
let evaluateCloseout;

function emitBlock(reason) {
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
}

function readPayload() {
  const raw = fs.readFileSync(0, 'utf8').trim();
  if (!raw) throw new Error('hook payload is empty');
  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('hook payload must be a JSON object');
  return payload;
}

function projectRoot(payload = {}) {
  const configured = typeof process.env.CLAUDE_PROJECT_DIR === 'string'
    ? process.env.CLAUDE_PROJECT_DIR.trim()
    : '';
  if (configured) {
    try { return fs.realpathSync(path.resolve(configured)); } catch { /* continue */ }
  }

  const installedRoot = path.resolve(__dirname, '..', '..');
  const installedHook = runtimePath(installedRoot, 'hooks', path.basename(__filename));
  if (fs.existsSync(installedHook)) return installedRoot;

  const sourceFixture = typeof process.env.PROJECT_ROOT === 'string'
    ? process.env.PROJECT_ROOT.trim()
    : '';
  if (sourceFixture) {
    try { return fs.realpathSync(path.resolve(sourceFixture)); } catch { /* continue */ }
  }

  const legacy = typeof payload.cwd === 'string' ? payload.cwd.trim() : '';
  if (legacy) {
    try { return fs.realpathSync(path.resolve(legacy)); } catch { /* continue */ }
  }
  try { return fs.realpathSync(process.cwd()); } catch { return path.resolve(process.cwd()); }
}

function sessionId(payload) {
  return typeof payload.session_id === 'string' ? payload.session_id : null;
}

function readRuntime(root) {
  try {
    const file = runtimePath(root, 'runtime.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  } catch { return {}; }
}

function rejectApproval(reason) {
  process.stdout.write(`CafeKit completion approval rejected: ${reason}.\n`);
}

function loadAuthority() {
  try {
    STATE = require('./completion-authority-state.cjs');
    ({ evaluateCloseout } = require('./completion-authority-check.cjs'));
    const requiredState = ['createPending', 'approvePending', 'consumeGrant', 'clearState', 'hasState', 'ensureKey', 'readBaseline', 'writeBaseline', 'readPolicyFloor', 'writePolicyFloor'];
    if (requiredState.some((name) => typeof STATE[name] !== 'function') || typeof evaluateCloseout !== 'function') {
      throw new Error('completion authority dependency exports are malformed');
    }
    return null;
  } catch (error) {
    return error;
  }
}

function approve(payload) {
  if (payload.hook_event_name !== 'UserPromptSubmit') return;
  const root = projectRoot(payload);
  const session = sessionId(payload);
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : null;
  if (!session) return rejectApproval('host session ID is missing');
  if (!prompt || prompt !== prompt.trim() || !prompt.startsWith(STATE.PREFIX)) return;
  const nonce = prompt.slice(STATE.PREFIX.length);
  if (!STATE.NONCE_RE.test(nonce) || `${STATE.PREFIX}${nonce}` !== prompt) return rejectApproval('the prompt did not exactly match a pending request');
  const result = STATE.approvePending(root, session, nonce);
  if (!result.ok) return rejectApproval('request missing, expired, consumed, or bound to another session');
  process.stdout.write('CafeKit completion approval accepted for one bound closeout retry.\n');
}

function stop(payload) {
  if (payload.stop_hook_active === true) return;
  const root = projectRoot(payload);
  const runtime = readRuntime(root);
  const resolverPath = path.join(__dirname, '..', 'scripts', 'spec-resolver.cjs');
  const policyPath = path.join(__dirname, '..', 'scripts', 'workflow-policy.cjs');
  let resolver;
  let policy;
  try {
    resolver = require(resolverPath);
    policy = require(policyPath);
    if (typeof resolver.findAllSpecCandidates !== 'function' || typeof resolver.resolveActiveSpec !== 'function') throw new Error('shared spec resolver lacks candidate scan functions');
    if (typeof policy.completionDecisionForSpec !== 'function' || typeof policy.deriveRuntimeContext !== 'function' || typeof policy.validateWorkflowPolicySnapshot !== 'function') throw new Error('shared workflow policy lacks completion authority functions');
  } catch (error) {
    STATE.clearState(root);
    emitBlock(`Completion authority unavailable: ${error.message}. Repair ${policyPath} and ${resolverPath} before completing tasks`);
    return;
  }

  let result;
  try {
    result = evaluateCloseout({ resolver, policy, projectRoot: root, runtime, payload });
  } catch (error) {
    STATE.clearState(root);
    emitBlock(`Completion authority controlled failure: ${error.message}. Completion is blocked until the authority is repaired`);
    return;
  }
  if (result.candidate === null) {
    if (STATE.hasState(root)) {
      STATE.clearState(root);
      emitBlock('Completion authority: an observed persisted spec disappeared; fresh technical closeout and approval are required');
    }
    return;
  }
  if (result.active === false) return;
  if (!result.ok) {
    STATE.clearState(root);
    emitBlock(`Completion authority: ${result.reason}`);
    return;
  }
  const consumed = STATE.consumeGrant(root, result.binding);
  if (consumed.ok) return;
  const pending = STATE.createPending(root, result.binding);
  // Name the feature: a recorded target can influence which packet resolves, so an
  // approval the user cannot identify is an approval they cannot withhold.
  const feature = result.candidate?.featureName;
  emitBlock(`Completion authority: technical proofs pass, but user closeout approval is required for ${feature ? `"${feature}"` : 'the resolved feature'}. Enter exactly "${STATE.PREFIX}${pending.nonce}" as your next user prompt. This approval is one-time and expires in five minutes.`);
}

let mode = process.argv[2] || null;
try {
  const raw = readPayload();
  // Read the loop guard before normalization: the catch below answers a block, so a
  // reader failure must not be able to reach it. Both spellings are accepted here.
  const hostLoop = raw.stop_hook_active === true || raw.stopHookActive === true;
  const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
  const payload = normalizeHookPayload(raw);
  mode = mode || (payload.hook_event_name === 'UserPromptSubmit' ? '--approve' : '--stop');
  if (mode === '--stop' && hostLoop) {
    // Host loop prevention is always silent, including when dependencies are unavailable.
  } else {
    const dependencyError = loadAuthority();
    if (dependencyError) {
      if (mode === '--approve') rejectApproval(`authority dependency unavailable (${dependencyError.message})`);
      else emitBlock(`Completion authority unavailable: ${dependencyError.message}. Repair the installed authority before completing tasks`);
    } else if (mode === '--approve') approve(payload);
    else if (mode === '--stop') stop(payload);
    else throw new Error('completion authority mode is required');
  }
} catch (error) {
  if (mode === '--approve') rejectApproval(`authority failed safely (${error.message})`);
  else emitBlock(`Completion authority controlled failure: ${error.message}. Completion is blocked until the authority is repaired`);
}
