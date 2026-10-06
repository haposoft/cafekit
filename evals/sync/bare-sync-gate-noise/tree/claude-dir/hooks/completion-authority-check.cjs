'use strict';

const fs = require('fs');
const path = require('path');
const STATE = require('./completion-authority-state.cjs');
const RECEIPT = require('../scripts/spec-receipt.cjs');
const RESOLVER = require('../scripts/spec-resolver.cjs');

const scripts = path.join(__dirname, '..', 'scripts');

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
  return typeof RESOLVER.extractExplicitTarget === 'function' ? RESOLVER.extractExplicitTarget(payload) : null;
}

function resolveCandidate({ resolver = RESOLVER, projectRoot, runtime, payload }) {
  const target = typeof resolver.extractExplicitTarget === 'function' ? resolver.extractExplicitTarget(payload) : explicitTarget(payload);
  if (typeof resolver.resolvePersistedSpec === 'function') return resolver.resolvePersistedSpec({ projectRoot, runtime, target });
  if (target) return resolver.resolveActiveSpec({ projectRoot, runtime, explicitFeature: target.explicitFeature, explicitPath: target.explicitPath });
  const candidates = resolver.findAllSpecCandidates(projectRoot, runtime);
  if (candidates.length > 1) return { error: 'multiple_persisted', candidates: candidates.map((candidate) => candidate.featureName) };
  return candidates[0] || null;
}

function dependencies(overrides = {}) {
  if (!overrides.grounder) runtimeModule(scripts, 'spec-semantic-model.cjs');
  const grounder = overrides.grounder || runtimeModule(scripts, 'spec-ground.cjs');
  const validator = overrides.validator || runtimeModule(scripts, 'validate-spec-output.cjs');
  return {
    validator,
    grounder,
    semanticAuthority: overrides.semanticAuthority || require('./semantic-review-authority.cjs'),
  };
}

module.exports = FINAL_STATE.createAuthority({
  state: STATE,
  resolveCandidate,
  dependencies,
  receipts: {
    task: (featureDir, taskPath, task, context, policy) => RECEIPT.checkTaskReceipt(featureDir, taskPath, task, context, policy),
    feature: (featureDir, context, policy) => RECEIPT.checkFeatureReceipt(featureDir, context, policy),
  },
});
