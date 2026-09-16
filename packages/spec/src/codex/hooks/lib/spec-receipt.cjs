'use strict';

const fs = require('fs');
const path = require('path');

function loadModule(installedName, sourceName, validate, missingMessage) {
  const installed = path.join(__dirname, '../../scripts', installedName);
  const source = path.join(__dirname, '../../../claude/scripts', sourceName);
  const candidates = fs.existsSync(installed) ? [installed] : [source];
  let lastError = new Error(missingMessage);
  for (const candidate of candidates) {
    try {
      const value = require(candidate);
      validate(value);
      return { value, error: null, path: candidate };
    } catch (error) { lastError = error; }
  }
  return { value: null, error: lastError, path: candidates[0] };
}

function loadSharedPolicy() {
  const loaded = loadModule(
    'workflow-policy.cjs',
    'workflow-policy.cjs',
    (policy) => {
      if (typeof policy?.validateCanonicalReceipt !== 'function') {
        throw new Error('shared workflow policy has no validateCanonicalReceipt function');
      }
    },
    'shared workflow policy is missing'
  );
  return { policy: loaded.value, error: loaded.error, path: loaded.path };
}

function loadSharedReceipt() {
  const loaded = loadModule(
    'spec-receipt.cjs',
    'spec-receipt.cjs',
    (receipt) => {
      if (typeof receipt?.checkTaskReceipt !== 'function') {
        throw new Error('shared spec receipt helper has no checkTaskReceipt function');
      }
    },
    'shared spec receipt helper is missing'
  );
  return { receipt: loaded.value, error: loaded.error, path: loaded.path };
}

function getSharedPolicy() { return loadSharedPolicy().policy; }
function getSharedValidate() { return getSharedPolicy()?.validateCanonicalReceipt || null; }

function receiptHelper() {
  const loaded = loadSharedReceipt();
  if (!loaded.receipt) throw loaded.error;
  return loaded.receipt;
}

function evidenceBody(text) { return receiptHelper().evidenceBody(text, getSharedPolicy() || {}); }
function safeTaskFile(featureDir, taskPath) {
  const result = receiptHelper().safeRead(featureDir, taskPath);
  return result.status === 'ok' ? result.path : null;
}
function validateCanonicalReceipt(body, options = {}) {
  const validate = getSharedValidate();
  return validate ? validate(body, options) : ['shared_validator'];
}
function checkReceiptDetails(featureDir, taskPath, task, runtimeContext) {
  const policy = getSharedPolicy();
  if (!policy) return { failures: ['shared_validator'], status: 'missing' };
  return receiptHelper().checkTaskReceipt(featureDir, taskPath, task, runtimeContext, policy);
}
function checkWorkflowReceiptDetails(featureDir, taskPath, runtimeContext) {
  const policy = getSharedPolicy();
  const receipt = receiptHelper();
  if (!policy || typeof receipt.checkWorkflowTaskReceipt !== 'function') {
    return { failures: ['shared_validator'], status: 'missing' };
  }
  return receipt.checkWorkflowTaskReceipt(featureDir, taskPath, runtimeContext, policy);
}
function checkWorkflowReceiptSet(candidates, projectRoot, runtimeSession) {
  const policy = getSharedPolicy();
  const receipt = receiptHelper();
  if (!policy || typeof receipt.checkWorkflowReceiptSet !== 'function') {
    return { failures: [{ featureName: '<set>', taskPath: '<set>', failures: ['shared_validator'] }] };
  }
  return receipt.checkWorkflowReceiptSet(candidates, projectRoot, runtimeSession, policy);
}
function checkReceipt(featureDir, taskPath, task, runtimeContext) {
  const map = {
    unsafe_path: 'a', missing_receipt: 'b', task_status: 'a', completed_at: 'd',
    verification_state: 'c', placeholder: 'c', validator_unavailable: 'c',
    command: 'e', command_identity: 'e', exit_result: 'f', provenance: 'g',
    artifact_hash: 'h', artifact_declaration: 'h',
  };
  return [...new Set(checkReceiptDetails(featureDir, taskPath, task, runtimeContext).failures.map((failure) => map[failure] || failure))];
}
function checkFeatureReceipt(featureDir, runtimeContext) {
  const policy = getSharedPolicy();
  if (!policy) return { failures: ['shared_validator'], status: 'missing' };
  return receiptHelper().checkFeatureReceipt(featureDir, runtimeContext, policy);
}
function receiptFixHint(failures) {
  const helper = receiptHelper();
  return typeof helper.receiptFixHint === 'function' ? helper.receiptFixHint(failures) : null;
}
function readTaskProof(featureDir, taskPath) {
  return receiptHelper().readTaskProof(featureDir, taskPath, getSharedPolicy() || {});
}

module.exports = {
  checkFeatureReceipt,
  checkReceipt,
  checkReceiptDetails,
  checkWorkflowReceiptDetails,
  checkWorkflowReceiptSet,
  evidenceBody,
  getSharedPolicy,
  getSharedValidate,
  loadSharedPolicy,
  loadSharedReceipt,
  readTaskProof,
  receiptFixHint,
  safeTaskFile,
  validateCanonicalReceipt,
};
