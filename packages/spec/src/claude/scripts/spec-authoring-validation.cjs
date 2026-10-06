#!/usr/bin/env node
'use strict';

// C16/D13 sole atomic writer (I21): the only code path permitted to set an
// authoring stage to `validated` or to write `validation.authoring_validation`.
// It builds an in-memory candidate spec.json (never persisted mid-run), proves
// it clean via the canonical validate-spec-output.cjs + spec-ground.cjs pass
// over that exact candidate, computes the C16 digests via the shared
// R0-01-owned spec-authoring-digest.cjs primitive, and only on a fully clean
// pass atomically replaces spec.json (write-temp-then-rename) with the updated
// `authoring.*` enum values and the fresh receipt written together. A failed,
// partial, or exceptional run leaves spec.json completely unchanged.

const fs = require('fs');
const path = require('path');
const { validateSpec } = require('./validate-spec-output.cjs');
const { groundSpec } = require('./spec-ground.cjs');
const DIGEST = require('./spec-authoring-digest.cjs');

const AUTHORING_FIELDS = ['requirements', 'design', 'research', 'tasks'];

function usage() {
  console.error('Usage: node spec-authoring-validation.cjs specs/<feature> [--root <path>]');
}

function resolveSpecDir(input) {
  const cwd = process.cwd();
  const direct = path.resolve(cwd, input);
  if (fs.existsSync(direct)) return direct;
  const viaSpecs = path.resolve(cwd, 'specs', input);
  if (fs.existsSync(viaSpecs)) return viaSpecs;
  return direct;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// In-memory candidate: every non-absent authoring field flips to `validated`
// and a fresh C16 receipt (all four stages, always present, non-circular —
// computed only from the authored artifacts' own current bytes) is attached.
// Both writes happen together in the same candidate object (I21).
function buildCandidate(currentSpec, specDir, nowIso) {
  if (!isPlainObject(currentSpec.authoring)) throw new Error('spec.json.authoring must be an object');
  const currentDigests = DIGEST.computeCurrentDigests(specDir);
  const candidate = cloneJson(currentSpec);
  const authoring = { ...candidate.authoring };
  for (const field of AUTHORING_FIELDS) {
    if (authoring[field] !== 'absent') authoring[field] = 'validated';
  }
  candidate.authoring = authoring;
  candidate.updated_at = nowIso;
  candidate.validation = {
    ...candidate.validation,
    authoring_validation: {
      schema_version: '1',
      requirements: { digest: currentDigests.requirements, validated_at: nowIso },
      design: { digest: currentDigests.design, validated_at: nowIso },
      research: { digest: currentDigests.research, validated_at: nowIso },
      tasks: { digest: currentDigests.tasks, validated_at: nowIso },
    },
  };
  return candidate;
}

function atomicReplaceSpec(specJsonPath, candidate) {
  const body = `${JSON.stringify(candidate, null, 2)}\n`;
  const tempPath = `${specJsonPath}.spec-authoring-validation-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, body);
  fs.renameSync(tempPath, specJsonPath);
}

// Runs the coordinator over one spec directory. Never partially persists: a
// clean validate+ground pass on the candidate is required before any write.
function runAuthoringValidation({ specDir, root = null }) {
  const specJsonPath = path.join(specDir, 'spec.json');
  const currentSpec = JSON.parse(fs.readFileSync(specJsonPath, 'utf8'));
  const nowIso = new Date().toISOString();
  const candidate = buildCandidate(currentSpec, specDir, nowIso);

  const validation = validateSpec(specDir, candidate);
  const grounding = groundSpec({ specDir, root, spec: candidate });
  const errors = [
    ...validation.errors.map((error) => `validate-spec-output: ${error}`),
    ...grounding.errors.map((error) => `spec-ground: ${error}`),
  ];
  if (errors.length > 0) return { ok: false, errors, candidate: null };

  atomicReplaceSpec(specJsonPath, candidate);
  return { ok: true, errors: [], candidate };
}

function main() {
  const args = process.argv.slice(2);
  const rootFlagIndex = args.indexOf('--root');
  const root = rootFlagIndex >= 0 ? path.resolve(process.cwd(), args[rootFlagIndex + 1] || '') : null;
  const positional = args.filter((arg, index) => arg !== '--root' && (rootFlagIndex < 0 || index !== rootFlagIndex + 1));
  if (positional.length !== 1) { usage(); process.exit(2); }
  const specDir = resolveSpecDir(positional[0]);
  if (!fs.existsSync(path.join(specDir, 'spec.json'))) {
    console.error(`spec-authoring-validation: no spec.json found at ${specDir}`);
    process.exit(2);
  }
  let result;
  try {
    result = runAuthoringValidation({ specDir, root });
  } catch (error) {
    console.error(`AUTHORING_VALIDATION_ERROR ${specDir}`);
    console.error(`- ${error.message}`);
    process.exit(2);
  }
  if (!result.ok) {
    console.error(`AUTHORING_VALIDATION_FAIL ${specDir}`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`AUTHORING_VALIDATED ${specDir}`);
}

module.exports = { runAuthoringValidation, buildCandidate };

if (require.main === module) main();
