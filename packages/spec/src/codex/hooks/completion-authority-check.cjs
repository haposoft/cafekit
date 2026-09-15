'use strict';

const fs = require('fs');
const path = require('path');
const STATE = require('./completion-authority-state.cjs');
const { checkFeatureReceipt, checkReceiptDetails } = require('./lib/spec-receipt.cjs');
const RESOLVER = require('./lib/spec-utils.cjs');

const installedScripts = path.join(__dirname, '..', 'scripts');
const scripts = fs.existsSync(path.join(installedScripts, 'spec-final-state.cjs'))
  ? installedScripts
  : path.resolve(__dirname, '..', '..', 'claude', 'scripts');

function runtimeModule(root, name) {
  const target = path.join(root, name);
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`runtime dependency must be a regular non-symlink file: ${name}`);
  const canonicalRoot = fs.realpathSync(root);
  const canonical = fs.realpathSync(target);
  const relative = path.relative(canonicalRoot, canonical);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`runtime dependency escaped scripts root: ${name}`);
  return require(canonical);
}

const FINAL_STATE = runtimeModule(scripts, 'spec-final-state.cjs');

function explicitTarget(payload) {
  for (const key of ['featureName', 'feature', 'explicitFeature']) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) return { explicitFeature: payload[key] };
  }
  for (const key of ['specPath', 'spec_path', 'featurePath']) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) return { explicitPath: payload[key] };
  }
  return null;
}

function resolveCandidate({ projectRoot, runtime, payload }) {
  const target = explicitTarget(payload);
  if (target) return RESOLVER.resolveActiveSpec({ projectRoot, runtime, ...target });
  // Delegate so both runtimes answer the same question; the count below stays only as a
  // fallback for an installed resolver older than this wrapper.
  const shared = RESOLVER.resolvePersistedSpec({ projectRoot, runtime });
  if (shared !== null) return shared;
  const candidates = RESOLVER.findAllSpecCandidates(projectRoot, runtime);
  if (candidates.length > 1) return { error: 'multiple_persisted', candidates: candidates.map((candidate) => candidate.featureName) };
  return candidates[0] || null;
}

function dependencies(overrides = {}) {
  if (!overrides.grounder) runtimeModule(scripts, 'spec-semantic-model.cjs');
  const grounder = overrides.grounder || runtimeModule(scripts, 'spec-ground.cjs');
  return {
    validator: overrides.validator || runtimeModule(scripts, 'validate-spec-output.cjs'),
    grounder,
    semanticAuthority: overrides.semanticAuthority || require('./semantic-review-authority.cjs'),
  };
}

module.exports = FINAL_STATE.createAuthority({
  state: STATE,
  resolveCandidate,
  dependencies,
  receipts: {
    task: (featureDir, taskPath, task, context) => checkReceiptDetails(featureDir, taskPath, task, context),
    feature: (featureDir, context) => checkFeatureReceipt(featureDir, context),
  },
});
