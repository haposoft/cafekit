#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { runtimeDirName, runtimeDir, runtimePath } = require('./lib/runtime-dir.cjs');
const { spawnSync } = require('child_process');
const STATE = require('./completion-authority-state.cjs');
const PATH_SAFETY = require('./lib/runtime-path-safety.cjs');

const SCHEMA_VERSION = 1;
const MARKER = 'CAFEKIT_SEMANTIC_REVIEW_ATTESTATION ';
const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const REVIEWER_ROLE_ALLOWLIST = new Set(['code-auditor', 'code_auditor']);
const RECORD_FIELDS = ['schema_version', 'kind', 'identity', 'semantic_digest', 'event', 'verdict', 'host_session_id', 'reviewer_agent_id', 'reviewer_agent_type', 'issued_at', 'mac'];

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value, fields) {
  return plain(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort());
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function projectRoot(payload = {}) {
  const installedRoot = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(runtimePath(installedRoot, 'hooks', path.basename(__filename)))) {
    try { return STATE.canonicalProjectRoot(installedRoot); } catch {}
  }
  for (const candidate of [process.env.CLAUDE_PROJECT_DIR, process.env.PROJECT_ROOT]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      try { return STATE.canonicalProjectRoot(candidate); } catch { /* continue */ }
    }
  }
  const cwd = typeof payload.cwd === 'string' && payload.cwd.trim() ? payload.cwd : process.cwd();
  return STATE.canonicalProjectRoot(cwd);
}

function identityFor(root, specFile, featureName) {
  if (typeof featureName !== 'string' || !featureName.trim() || featureName.includes('/') || featureName.includes('\\') || featureName === '.' || featureName === '..' || featureName.includes('..')) throw new Error('feature identity is malformed');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(featureName)) throw new Error('feature identity is malformed');
  const canonicalRoot = STATE.canonicalProjectRoot(root);
  const canonicalSpec = fs.realpathSync(path.resolve(specFile));
  if (!inside(canonicalRoot, canonicalSpec) || path.basename(canonicalSpec) !== 'spec.json') throw new Error('spec identity escapes the project');
  const relative = path.relative(canonicalRoot, canonicalSpec);
  const expected = path.join('specs', featureName, 'spec.json');
  if (relative !== expected) throw new Error(`spec identity must be ${expected}, not ${relative}`);
  const spec = JSON.parse(fs.readFileSync(canonicalSpec, 'utf8'));
  if (spec.feature_name !== featureName) throw new Error('feature identity does not match spec.json');
  return { project_root: canonicalRoot, spec_file: canonicalSpec, feature_name: featureName };
}

function recordPath(root, identity) {
  const name = STATE.digest({ namespace: 'cafekit-semantic-review-observation-v1', identity });
  return path.join(STATE.stateDir(root), 'semantic-reviews', `observation-${name}.json`);
}

function parseClaim(message) {
  const lines = String(message || '').split(/\r?\n/).filter((line) => line.startsWith(MARKER));
  if (lines.length === 0) return null;
  if (lines.length !== 1) throw new Error('exactly one semantic review attestation marker is required');
  const claim = JSON.parse(lines[0].slice(MARKER.length));
  if (!exactKeys(claim, ['feature_name', 'spec_file', 'semantic_digest', 'verdict'])) throw new Error('semantic review claim fields are malformed');
  if (claim.verdict !== 'PASS' || !SHA256_RE.test(claim.semantic_digest || '')) throw new Error('semantic review claim must contain literal PASS and a sha256 digest');
  return claim;
}

function validatorFor(root) {
  const installedRoot = runtimeDir(root);
  const installedHook = path.join(installedRoot, 'hooks', path.basename(__filename));
  if (fs.existsSync(installedHook)) {
    const canonicalHook = PATH_SAFETY.canonicalRegularFile(root, installedHook, 'installed semantic hook');
    if (canonicalHook !== fs.realpathSync(__filename)) throw new Error('installed semantic hook identity is invalid');
    const validator = path.join(installedRoot, 'scripts', 'validate-spec-output.cjs');
    PATH_SAFETY.verifyCommonJsClosure(installedRoot, validator);
    return PATH_SAFETY.canonicalRegularFile(installedRoot, validator, 'semantic validator');
  }

  const sourceRuntime = path.resolve(__dirname, '..');
  const sourceRoot = path.resolve(sourceRuntime, '..');
  if (`.${path.basename(sourceRuntime)}` !== runtimeDirName() || path.basename(sourceRoot) !== 'src') {
    throw new Error('semantic validator runtime root is not recognized');
  }
  const validator = path.join(sourceRuntime, 'scripts', 'validate-spec-output.cjs');
  PATH_SAFETY.verifyCommonJsClosure(sourceRoot, validator);
  return PATH_SAFETY.canonicalRegularFile(sourceRoot, validator, 'semantic validator');
}

function currentDigest(root, specFile) {
  const validator = validatorFor(root);
  const result = spawnSync(process.execPath, [validator, path.dirname(specFile), '--semantic-digest'], { cwd: root, encoding: 'utf8' });
  const digest = result.stdout.trim();
  if (result.status !== 0 || !SHA256_RE.test(digest)) throw new Error(`semantic digest could not be recomputed (${result.stderr.trim() || `exit ${result.status}`})`);
  return digest;
}

function recordFromSubagentStop(payload) {
  // Honest-agent guardrail: the host hook observes this SubagentStop payload.
  // The worker-authored claim is not authenticated input or a security boundary.
  if (!plain(payload) || payload.hook_event_name !== 'SubagentStop') return { recorded: false, reason: 'event' };
  for (const field of ['session_id', 'agent_id', 'agent_type', 'last_assistant_message']) {
    if (typeof payload[field] !== 'string' || !payload[field].trim()) return { recorded: false, reason: `missing-${field}` };
  }
  if (!REVIEWER_ROLE_ALLOWLIST.has(payload.agent_type)) return { recorded: false, reason: 'reviewer-role' };
  const root = projectRoot(payload);
  const claim = parseClaim(payload.last_assistant_message);
  if (claim === null) return { recorded: false, reason: 'no-claim' };
  const requestedSpec = path.resolve(root, claim.spec_file);
  const identity = identityFor(root, requestedSpec, claim.feature_name);
  const digest = currentDigest(root, identity.spec_file);
  if (digest !== claim.semantic_digest) throw new Error('claimed semantic digest does not match current artifacts');
  const key = STATE.ensureKey();
  const record = {
    schema_version: SCHEMA_VERSION, kind: 'semantic-review-observation', identity,
    semantic_digest: digest, event: 'SubagentStop', verdict: 'PASS',
    host_session_id: payload.session_id, reviewer_agent_id: payload.agent_id,
    reviewer_agent_type: payload.agent_type, issued_at: new Date().toISOString(),
  };
  record.mac = STATE.recordMac(record, key);
  STATE.atomicWrite(recordPath(root, identity), record);
  return { recorded: true, record };
}

function verifyAttestation(root, specFile, featureName, semanticDigest) {
  let identity;
  try { identity = identityFor(root, specFile, featureName); } catch (error) { return { ok: false, reason: error.message }; }
  const file = recordPath(root, identity);
  let record;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { return { ok: false, reason: error.code === 'ENOENT' ? 'matching host-hook observation is missing' : 'host-hook observation is unreadable' }; }
  const key = STATE.readKey();
  if (key.missing) return { ok: false, reason: 'completion authority key is missing' };
  if (!exactKeys(record, RECORD_FIELDS) || !STATE.macMatches(record, key.key)) return { ok: false, reason: 'host-hook observation is malformed or its MAC is invalid' };
  if (record.schema_version !== SCHEMA_VERSION || record.kind !== 'semantic-review-observation' || record.event !== 'SubagentStop' || record.verdict !== 'PASS') return { ok: false, reason: 'host-hook observation event or verdict is invalid' };
  if (STATE.stableStringify(record.identity) !== STATE.stableStringify(identity)) return { ok: false, reason: 'host-hook observation project, feature, or spec identity is invalid' };
  if (record.semantic_digest !== semanticDigest) return { ok: false, reason: 'host-hook observation semantic digest is stale' };
  return { ok: true, record };
}

if (require.main === module) {
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    const { normalizeHookPayload } = require('./lib/hook-payload.cjs');
    if (raw) recordFromSubagentStop(normalizeHookPayload(JSON.parse(raw)));
  } catch (error) {
    process.stderr.write(`CafeKit semantic review SubagentStop claim rejected: ${error.message}\n`);
  }
}

module.exports = { MARKER, REVIEWER_ROLE_ALLOWLIST, recordFromSubagentStop, verifyAttestation, identityFor, recordPath };
