'use strict';

const fs = require('fs');
const path = require('path');
const PATH_SAFETY = require('./runtime-path-safety.cjs');

// Save original fs methods at load time to avoid being affected by test monkey patches
// that simulate runtime canonicalization failures for spec paths. Resolver discovery
// must use these originals, while spec resolution uses the (possibly patched) fs.
const originalLstatSync = fs.lstatSync;

// Installed Codex hooks use .codex/scripts; source tests use the Claude-side
// source path. If an installed resolver exists but is malformed, do not fall
// back to another copy: the shared authority is unavailable.
const RESOLVER_CANDIDATES = [
  {
    file: path.join(__dirname, '../../scripts/spec-resolver.cjs'),
    root: path.resolve(__dirname, '../..'),
  },
  {
    file: path.join(__dirname, '../../../claude/scripts/spec-resolver.cjs'),
    root: path.resolve(__dirname, '../../..'),
  },
];

function canonicalRealpath(candidate) {
  try {
    return PATH_SAFETY.canonicalRegularFile(candidate.root, candidate.file, 'shared spec resolver');
  } catch (error) {
    throw new Error(`${error.message} (${candidate.file})`);
  }
}

function findCandidate() {
  // Fail closed if preferred installed resolver exists but is invalid; never silently fall back to source.
  const primary = RESOLVER_CANDIDATES[0];
  let primaryExists = false;
  try {
    originalLstatSync(primary.file);
    primaryExists = true;
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`resolver check failed: ${e.message} (${primary.file})`);
  }
  if (primaryExists) {
    canonicalRealpath(primary);
    return primary;
  }
  const secondary = RESOLVER_CANDIDATES[1];
  let secondaryExists = false;
  try {
    originalLstatSync(secondary.file);
    secondaryExists = true;
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`resolver check failed: ${e.message} (${secondary.file})`);
  }
  if (secondaryExists) {
    canonicalRealpath(secondary);
    return secondary;
  }
  return null;
}

function sharedResolver() {
  const candidate = findCandidate() || RESOLVER_CANDIDATES[0];
  try {
    // Use canonical realpath for require to avoid symlink hijack
    const realCandidate = canonicalRealpath(candidate);
    const resolver = require(realCandidate);
    if (typeof resolver?.resolveActiveSpec !== 'function') {
      throw new Error('shared spec resolver has no resolveActiveSpec function');
    }
    return resolver;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} (${candidate.file})`);
  }
}

function specsDirectory(projectRoot, runtime) {
  return sharedResolver().specsDirectory(projectRoot, runtime);
}

function findAllActiveSpecs(projectRoot, runtime) {
  return sharedResolver().findAllActiveSpecs(projectRoot, runtime);
}

function findAllSpecCandidates(projectRoot, runtime) {
  return sharedResolver().findAllSpecCandidates(projectRoot, runtime);
}

function resolveActiveSpec(projectRoot, runtime, explicitFeature, explicitPath) {
  if (projectRoot && typeof projectRoot === 'object') {
    return sharedResolver().resolveActiveSpec(projectRoot);
  }
  return sharedResolver().resolveActiveSpec({
    projectRoot,
    runtime,
    explicitFeature,
    explicitPath,
  });
}

function resolveWorkflowCandidate(projectRoot, runtime, explicitFeature, explicitPath) {
  const resolver = sharedResolver();
  if (typeof resolver.resolveWorkflowCandidate !== 'function') {
    return resolveActiveSpec(projectRoot, runtime, explicitFeature, explicitPath);
  }
  if (projectRoot && typeof projectRoot === 'object') {
    return resolver.resolveWorkflowCandidate(projectRoot);
  }
  return resolver.resolveWorkflowCandidate({
    projectRoot,
    runtime,
    explicitFeature,
    explicitPath,
  });
}

function refineWorkflowGateResolution(resolved) {
  const resolver = sharedResolver();
  return typeof resolver.refineWorkflowGateResolution === 'function'
    ? resolver.refineWorkflowGateResolution(resolved)
    : resolved;
}

function findActiveSpec(projectRoot, runtime) {
  const resolved = resolveActiveSpec(projectRoot, runtime);
  if (!resolved) return null;
  if (resolved.error === 'multiple_active' || resolved.error === 'invalid_specs') return resolved;
  if (resolved.error) return null;
  return resolved;
}

function taskStatusMap(spec) {
  return Object.fromEntries(
    Object.entries(spec.task_registry || {}).map(([taskPath, task]) => [
      taskPath,
      task?.status || 'pending',
    ]),
  );
}

function resolvePersistedSpec(options) {
  const resolver = sharedResolver();
  if (typeof resolver.resolvePersistedSpec !== 'function') return null;
  return resolver.resolvePersistedSpec(options);
}

module.exports = {
  findActiveSpec,
  resolvePersistedSpec,
  findAllActiveSpecs,
  findAllSpecCandidates,
  resolveActiveSpec,
  resolveWorkflowCandidate,
  refineWorkflowGateResolution,
  specsDirectory,
  taskStatusMap,
};
