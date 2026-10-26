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
      if (typeof receipt?.checkWorkflowTaskReceipt !== 'function') {
        throw new Error('shared spec receipt helper has no checkWorkflowTaskReceipt function');
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

function safeTaskFile(featureDir, taskPath) {
  const result = receiptHelper().safeRead(featureDir, taskPath);
  return result.status === 'ok' ? result.path : null;
}
function validateCanonicalReceipt(body, options = {}) {
  const validate = getSharedValidate();
  return validate ? validate(body, options) : ['shared_validator'];
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
function receiptFixHint(failures, body) {
  const helper = receiptHelper();
  return typeof helper.receiptFixHint === 'function' ? helper.receiptFixHint(failures, body) : null;
}

module.exports = {
  checkWorkflowReceiptDetails,
  checkWorkflowReceiptSet,
  getSharedPolicy,
  getSharedValidate,
  loadSharedPolicy,
  loadSharedReceipt,
  receiptFixHint,
  safeTaskFile,
  validateCanonicalReceipt,
};
