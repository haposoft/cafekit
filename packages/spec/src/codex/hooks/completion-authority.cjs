#!/usr/bin/env node
'use strict';

const { getHookContext, readPayload, logCrash } = require('./lib/hook-context.cjs');
const { loadSharedPolicy } = require('./lib/spec-receipt.cjs');
let STATE;
let evaluateCloseout;

function emitBlock(reason) {
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
}

function context(message) {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: message } })}\n`);
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
  const { projectRoot } = getHookContext(payload);
  const session = typeof payload.session_id === 'string' ? payload.session_id : null;
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : null;
  if (!session) return context('CafeKit completion approval rejected: host session ID is missing.');
  if (!prompt || prompt !== prompt.trim() || !prompt.startsWith(STATE.PREFIX)) return;
  const nonce = prompt.slice(STATE.PREFIX.length);
  if (!STATE.NONCE_RE.test(nonce) || `${STATE.PREFIX}${nonce}` !== prompt) {
    return context('CafeKit completion approval rejected: the prompt did not exactly match a pending request.');
  }
  const result = STATE.approvePending(projectRoot, session, nonce);
  if (!result.ok) return context('CafeKit completion approval rejected: request missing, expired, consumed, or bound to another session.');
  context('CafeKit completion approval accepted for one bound closeout retry.');
}

function stop(payload) {
  if (payload.stop_hook_active === true) return;
  const loaded = loadSharedPolicy();
  if (!loaded.policy) {
    emitBlock(`Completion authority unavailable: shared workflow policy could not be loaded (${loaded.error.message}). Repair ${loaded.path} before completing tasks`);
    return;
  }
  const { projectRoot, runtime } = getHookContext(payload);
  if (typeof loaded.policy.completionDecisionForSpec !== 'function' || typeof loaded.policy.deriveRuntimeContext !== 'function' || typeof loaded.policy.validateWorkflowPolicySnapshot !== 'function') {
    throw new Error('shared workflow policy lacks completion authority functions');
  }
  let result;
  try {
    result = evaluateCloseout({ policy: loaded.policy, projectRoot, runtime, payload });
  } catch (error) {
    STATE.clearState(projectRoot);
    emitBlock(`Completion authority controlled failure: ${error.message}. Completion is blocked until the authority is repaired`);
    return;
  }
  if (result.candidate === null) {
    if (STATE.hasState(projectRoot)) {
      STATE.clearState(projectRoot);
      emitBlock('Completion authority: an observed persisted spec disappeared; fresh technical closeout and approval are required');
    }
    return;
  }
  if (result.active === false) return;
  if (!result.ok) {
    STATE.clearState(projectRoot);
    emitBlock(`Completion authority: ${result.reason}`);
    return;
  }
  const consumed = STATE.consumeGrant(projectRoot, result.binding);
  if (consumed.ok) return;
  const pending = STATE.createPending(projectRoot, result.binding);
  // Name the feature: a recorded target can influence which packet resolves, so an
  // approval the user cannot identify is an approval they cannot withhold.
  const feature = result.candidate?.featureName;
  emitBlock(`Completion authority: technical proofs pass, but user closeout approval is required for ${feature ? `"${feature}"` : 'the resolved feature'}. Enter exactly "${STATE.PREFIX}${pending.nonce}" as your next user prompt. This approval is one-time and expires in five minutes.`);
}

let mode = process.argv[2] || null;
try {
  const payload = readPayload();
  mode = mode || (payload.hook_event_name === 'UserPromptSubmit' ? '--approve' : '--stop');
  if (mode === '--stop' && payload.stop_hook_active === true) {
    // Host loop prevention is always silent, including when dependencies are unavailable.
  } else {
    const dependencyError = loadAuthority();
    if (dependencyError) {
      if (mode === '--approve') context(`CafeKit completion approval failed safely; authority dependency unavailable (${dependencyError.message}).`);
      else emitBlock(`Completion authority unavailable: ${dependencyError.message}. Repair the installed authority before completing tasks`);
    } else if (mode === '--approve') approve(payload);
    else if (mode === '--stop') stop(payload);
    else throw new Error('completion authority mode is required');
  }
} catch (error) {
  if (mode === '--approve') context(`CafeKit completion approval failed safely; no grant was issued (${error.message}).`);
  else {
    logCrash('completion-authority', error);
    emitBlock(`Completion authority controlled failure: ${error.message}. Completion is blocked until the authority is repaired`);
  }
}
