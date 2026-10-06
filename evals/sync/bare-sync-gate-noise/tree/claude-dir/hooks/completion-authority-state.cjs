'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PREFIX = 'APPROVE CAFEKIT COMPLETION ';
const NONCE_RE = /^[a-f0-9]{24}$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const TTL_MS = 5 * 60 * 1000;
const KEY_BYTES = 32;
const SCHEMA_VERSION = 3;
const LEGACY_SCHEMA_VERSION = 2;
const EPHEMERAL_FILE_RE = /^(pending|grant)-([a-f0-9]{24})\.json$/;
const BASELINE_FILE_RE = /^baseline-([a-f0-9]{64})\.json$/;
const FLOOR_FILE = 'policy-floor.json';

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function secureMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(dir, 0o700);
}

function homeDirectory() {
  const requested = process.platform === 'win32'
    ? (process.env.USERPROFILE || (process.env.HOMEDRIVE && process.env.HOMEPATH
      ? `${process.env.HOMEDRIVE}${process.env.HOMEPATH}`
      : null))
    : process.env.HOME;
  const home = requested || os.homedir();
  if (typeof home !== 'string' || !home.trim()) throw new Error('user home directory is unavailable');
  return path.resolve(home);
}

function userStateRoot() {
  return path.join(homeDirectory(), '.cafekit', 'completion-authority');
}

function keyPath() {
  return path.join(userStateRoot(), 'hmac.key');
}

function canonicalProjectRoot(projectRoot) {
  if (typeof projectRoot !== 'string' || !projectRoot.trim()) throw new Error('project root is required');
  return fs.realpathSync(path.resolve(projectRoot));
}

function projectNamespace(projectRoot) {
  const canonical = canonicalProjectRoot(projectRoot);
  const projectHash = digest({ namespace: 'cafekit-completion-authority-v2', project_root: canonical });
  return { canonical, projectHash };
}

function stateDir(projectRoot) {
  return path.join(userStateRoot(), 'projects', projectNamespace(projectRoot).projectHash);
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function normalizeIdentity(identity, { allowMissingSpec = false } = {}) {
  if (!plain(identity)) throw new Error('baseline identity must be an object');
  const projectRoot = canonicalProjectRoot(identity.project_root);
  const featureName = identity.feature_name;
  if (typeof featureName !== 'string' || !featureName.trim() || featureName.includes('/') || featureName.includes('\\') || featureName === '.' || featureName === '..') {
    throw new Error('baseline feature identity is malformed');
  }
  if (typeof identity.spec_file !== 'string' || !identity.spec_file.trim()) throw new Error('baseline spec identity is malformed');
  const requestedSpec = path.resolve(projectRoot, identity.spec_file);
  let specFile = requestedSpec;
  try {
    specFile = fs.realpathSync(requestedSpec);
  } catch (error) {
    if (!allowMissingSpec || !['ENOENT', 'ENOTDIR'].includes(error.code)) throw new Error(`baseline spec identity cannot be canonicalized (${error.code || error.message})`);
  }
  if (!inside(projectRoot, specFile) || specFile === projectRoot || path.basename(specFile) !== 'spec.json') {
    throw new Error('baseline spec identity escapes the project');
  }
  if (path.basename(path.dirname(specFile)) !== featureName) throw new Error('baseline feature and spec identities disagree');
  return { project_root: projectRoot, spec_file: specFile, feature_name: featureName };
}

function identityDigest(identity) {
  return digest({
    namespace: 'cafekit-completion-baseline-v1',
    project_root: identity.project_root,
    spec_file: identity.spec_file,
    feature_name: identity.feature_name,
  });
}

function baselinePath(projectRoot, identity) {
  const normalized = normalizeIdentity(identity, { allowMissingSpec: true });
  const namespace = projectNamespace(projectRoot);
  if (normalized.project_root !== namespace.canonical) throw new Error('baseline project identity does not match state namespace');
  return path.join(stateDir(namespace.canonical), `baseline-${identityDigest(normalized)}.json`);
}

function atomicWrite(file, value) {
  const dir = path.dirname(file);
  secureMkdir(dir);
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(temp, 0o600);
  fs.renameSync(temp, file);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function recordFiles(projectRoot) {
  const dir = stateDir(projectRoot);
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function anyAuthorityRecords() {
  const projects = path.join(userStateRoot(), 'projects');
  let entries;
  try { entries = fs.readdirSync(projects, { withFileTypes: true }); } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) return true;
    if (!entry.isDirectory()) return true;
    if (fs.readdirSync(path.join(projects, entry.name)).length > 0) return true;
  }
  return false;
}

function readKey() {
  const file = keyPath();
  let stat;
  try { stat = fs.lstatSync(file); } catch (error) {
    if (error.code === 'ENOENT') return { key: null, missing: true };
    throw new Error(`completion authority key cannot be inspected (${error.code || error.message})`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('completion authority key is not a regular file');
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) throw new Error('completion authority key permissions are too broad');
  let key;
  try { key = fs.readFileSync(file); } catch (error) { throw new Error(`completion authority key cannot be read (${error.message})`); }
  if (key.length !== KEY_BYTES) throw new Error('completion authority key is malformed');
  return { key, missing: false };
}

function ensureKey() {
  secureMkdir(userStateRoot());
  secureMkdir(path.join(userStateRoot(), 'projects'));
  const current = readKey();
  if (!current.missing) return current.key;
  if (anyAuthorityRecords()) throw new Error('completion authority key is missing while authority records exist');
  const key = crypto.randomBytes(KEY_BYTES);
  try {
    fs.writeFileSync(keyPath(), key, { flag: 'wx', mode: 0o600 });
    if (process.platform !== 'win32') fs.chmodSync(keyPath(), 0o600);
    return key;
  } catch (error) {
    if (error.code === 'EEXIST') {
      const raced = readKey();
      if (!raced.missing) return raced.key;
    }
    throw new Error(`completion authority key cannot be created (${error.message})`);
  }
}

function unsignedRecord(record) {
  const unsigned = { ...record };
  delete unsigned.mac;
  delete unsigned.file;
  return unsigned;
}

function recordMac(record, key) {
  return crypto.createHmac('sha256', key).update(stableStringify(unsignedRecord(record))).digest('hex');
}

function macMatches(record, key) {
  if (typeof record?.mac !== 'string' || !/^[a-f0-9]{64}$/.test(record.mac)) return false;
  const actual = Buffer.from(record.mac, 'hex');
  const expected = Buffer.from(recordMac(record, key), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function exactKeys(value, expected) {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function validTimestamp(value) {
  return typeof value === 'string' && value.trim() === value && !Number.isNaN(Date.parse(value));
}

function validateEphemeral(record, kind, nonce, now, key) {
  const expected = kind === 'pending'
    ? ['schema_version', 'kind', 'nonce', 'binding', 'issued_at', 'expires_at', 'mac']
    : ['schema_version', 'kind', 'nonce', 'binding', 'issued_at', 'expires_at', 'approved_at', 'mac'];
  if (!plain(record) || !exactKeys(record, expected)) return { ok: false, reason: 'malformed authority record' };
  if (!macMatches(record, key)) return { ok: false, reason: 'authority record MAC is invalid' };
  if (![LEGACY_SCHEMA_VERSION, SCHEMA_VERSION].includes(record.schema_version) || record.kind !== kind || record.nonce !== nonce || !NONCE_RE.test(nonce)) return { ok: false, reason: 'authority record identity is invalid' };
  if (!plain(record.binding) || typeof record.binding.session_id !== 'string' || !record.binding.session_id.trim()) return { ok: false, reason: 'authority record binding is invalid' };
  if (!validTimestamp(record.issued_at) || !Number.isFinite(record.expires_at) || record.expires_at <= Date.parse(record.issued_at)) return { ok: false, reason: 'authority record timestamps are invalid' };
  if (kind === 'grant' && !validTimestamp(record.approved_at)) return { ok: false, reason: 'authority grant approval timestamp is invalid' };
  if (record.expires_at <= now) return { ok: false, expired: true, reason: 'authority record expired' };
  return { ok: true };
}

function validateBaseline(record, filename, projectRoot, key) {
  const expected = ['schema_version', 'kind', 'identity', 'policy', 'issued_at', 'updated_at', 'mac'];
  if (!plain(record) || !exactKeys(record, expected)) return { ok: false, reason: 'malformed policy baseline' };
  if (!macMatches(record, key)) return { ok: false, reason: 'policy baseline MAC is invalid' };
  if (![LEGACY_SCHEMA_VERSION, SCHEMA_VERSION].includes(record.schema_version) || record.kind !== 'baseline' || !validTimestamp(record.issued_at) || !validTimestamp(record.updated_at)) return { ok: false, reason: 'policy baseline identity or timestamps are invalid' };
  let identity;
  try { identity = normalizeIdentity(record.identity, { allowMissingSpec: true }); } catch (error) { return { ok: false, reason: error.message }; }
  if (filename !== `baseline-${identityDigest(identity)}.json` || identity.project_root !== canonicalProjectRoot(projectRoot)) return { ok: false, reason: 'policy baseline namespace is invalid' };
  if (!plain(record.policy)) return { ok: false, reason: 'policy baseline policy is malformed' };
  return { ok: true, identity };
}

function validatePolicyFloor(record, filename, key) {
  const expected = ['schema_version', 'kind', 'policy', 'issued_at', 'updated_at', 'mac'];
  if (!plain(record) || !exactKeys(record, expected)) return { ok: false, reason: 'malformed project policy floor' };
  if (!macMatches(record, key)) return { ok: false, reason: 'project policy floor MAC is invalid' };
  if (filename !== FLOOR_FILE || ![LEGACY_SCHEMA_VERSION, SCHEMA_VERSION].includes(record.schema_version) || record.kind !== 'policy-floor' || !validTimestamp(record.issued_at) || !validTimestamp(record.updated_at)) {
    return { ok: false, reason: 'project policy floor identity or timestamps are invalid' };
  }
  if (!plain(record.policy)) return { ok: false, reason: 'project policy floor policy is malformed' };
  return { ok: true };
}

function readState(projectRoot, now = Date.now()) {
  const state = {
    pending: null,
    grant: null,
    baselines: [],
    floor: null,
    floorMissing: false,
    malformed: false,
    reason: null,
    keyMissing: false,
    keyError: null,
  };
  let files;
  try { files = recordFiles(projectRoot); } catch (error) {
    state.malformed = true;
    state.reason = error.message;
    state.keyError = error;
    return state;
  }
  let keyInfo;
  try { keyInfo = readKey(); } catch (error) {
    state.malformed = true;
    state.reason = error.message;
    state.keyError = error;
    return state;
  }
  if (keyInfo.missing) {
    state.keyMissing = true;
    if (files.length > 0) {
      state.malformed = true;
      state.reason = 'completion authority key is missing while authority records exist';
    }
    return state;
  }
  const key = keyInfo.key;
  for (const name of files) {
    const ephemeral = name.match(EPHEMERAL_FILE_RE);
    const baseline = name.match(BASELINE_FILE_RE);
    const floor = name === FLOOR_FILE;
    if (!ephemeral && !baseline && !floor) {
      if (name.endsWith('.json')) {
        state.malformed = true;
        state.reason ||= `unknown completion authority record ${name}`;
      }
      continue;
    }
    const file = path.join(stateDir(projectRoot), name);
    const record = readJson(file);
    const result = ephemeral
      ? validateEphemeral(record, ephemeral[1], ephemeral[2], now, key)
      : baseline
        ? validateBaseline(record, name, projectRoot, key)
        : validatePolicyFloor(record, name, key);
    if (!result.ok) {
      if (result.expired) {
        try { fs.unlinkSync(file); } catch { /* expired state is harmless if cleanup races */ }
      } else {
        state.malformed = true;
        state.reason ||= result.reason;
      }
      continue;
    }
    const accepted = { ...record, file };
    if (ephemeral) {
      if (ephemeral[1] === 'pending') {
        if (state.pending) {
          state.malformed = true;
          state.reason ||= 'multiple pending completion authority records exist';
        } else state.pending = accepted;
      } else if (state.grant) {
        state.malformed = true;
        state.reason ||= 'multiple grant completion authority records exist';
      } else state.grant = accepted;
    } else if (baseline) {
      if (state.baselines.some((entry) => stableStringify(entry.identity) === stableStringify(accepted.identity))) {
        state.malformed = true;
        state.reason ||= 'duplicate policy baselines exist';
      } else state.baselines.push(accepted);
    } else if (state.floor) {
      state.malformed = true;
      state.reason ||= 'multiple project policy floors exist';
    } else {
      state.floor = accepted;
    }
  }
  if (state.pending && state.grant) {
    state.malformed = true;
    state.reason ||= 'pending and grant completion authority records coexist';
  }
  if (!state.floor) {
    state.floorMissing = true;
  }
  return state;
}

function clearState(projectRoot) {
  let files;
  try { files = recordFiles(projectRoot); } catch { return; }
  for (const name of files) {
    if (/^(?:pending|grant)-[a-f0-9]+\.json$/.test(name)) {
      try { fs.unlinkSync(path.join(stateDir(projectRoot), name)); } catch { /* session cleanup is idempotent */ }
    }
  }
}

function sameBinding(record, binding) {
  return Boolean(record && binding && stableStringify(record.binding) === stableStringify(binding));
}

function createPending(projectRoot, binding) {
  if (!plain(binding) || typeof binding.session_id !== 'string' || !binding.session_id.trim()) throw new Error('completion authority binding is malformed');
  const key = ensureKey();
  const state = readState(projectRoot);
  if (state.malformed || state.keyError || state.keyMissing) throw new Error(state.reason || 'completion authority state is unavailable');
  if (state.pending && sameBinding(state.pending, binding)) {
    const { file, ...record } = state.pending;
    return record;
  }
  clearState(projectRoot);
  const nonce = crypto.randomBytes(12).toString('hex');
  const issuedAt = new Date().toISOString();
  const record = {
    schema_version: SCHEMA_VERSION,
    kind: 'pending',
    nonce,
    binding: JSON.parse(JSON.stringify(binding)),
    issued_at: issuedAt,
    expires_at: Date.now() + TTL_MS,
  };
  record.mac = recordMac(record, key);
  atomicWrite(path.join(stateDir(projectRoot), `pending-${nonce}.json`), record);
  return record;
}

function approvePending(projectRoot, sessionId, nonce) {
  if (typeof sessionId !== 'string' || !sessionId.trim() || !NONCE_RE.test(nonce || '')) return { ok: false, reason: 'shape' };
  let state;
  let key;
  try {
    key = readKey();
    if (key.missing) return { ok: false, reason: 'authority-key-missing' };
    state = readState(projectRoot);
  } catch (error) {
    return { ok: false, reason: `authority-unavailable:${error.message}` };
  }
  if (state.malformed || state.keyError || state.keyMissing) return { ok: false, reason: state.reason || 'authority-state-malformed' };
  const pending = state.pending;
  if (!pending || pending.binding.session_id !== sessionId || pending.nonce !== nonce) return { ok: false, reason: 'missing-or-bound' };
  const { file, mac, ...unsignedPending } = pending;
  const grant = {
    ...unsignedPending,
    kind: 'grant',
    approved_at: new Date().toISOString(),
  };
  grant.mac = recordMac(grant, key.key);
  try { fs.unlinkSync(file); } catch { return { ok: false, reason: 'consumed' }; }
  try {
    atomicWrite(path.join(stateDir(projectRoot), `grant-${nonce}.json`), grant);
  } catch (error) {
    return { ok: false, reason: `grant-write:${error.message}` };
  }
  return { ok: true, grant };
}

function consumeGrant(projectRoot, binding) {
  let state;
  try { state = readState(projectRoot); } catch (error) { return { ok: false, reason: `authority-unavailable:${error.message}` }; }
  if (state.malformed || state.keyError || state.keyMissing) return { ok: false, reason: state.reason || 'authority-state-malformed' };
  if (!state.grant) return { ok: false, reason: 'missing' };
  if (!sameBinding(state.grant, binding)) {
    clearState(projectRoot);
    return { ok: false, reason: 'binding' };
  }
  try {
    fs.unlinkSync(state.grant.file);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'consume' };
  }
}

function readBaseline(projectRoot, identity) {
  const normalized = normalizeIdentity(identity, { allowMissingSpec: true });
  const state = readState(projectRoot);
  if (state.malformed || state.keyError || state.keyMissing) throw new Error(state.reason || 'completion authority state is unavailable');
  return state.baselines.find((entry) => stableStringify(entry.identity) === stableStringify(normalized)) || null;
}

function writeBaseline(projectRoot, identity, policy) {
  if (!plain(policy)) throw new Error('policy baseline must contain a policy object');
  const normalized = normalizeIdentity(identity, { allowMissingSpec: true });
  const key = ensureKey();
  const state = readState(projectRoot);
  if (state.malformed || state.keyError || state.keyMissing) throw new Error(state.reason || 'completion authority state is unavailable');
  const existing = state.baselines.find((entry) => stableStringify(entry.identity) === stableStringify(normalized));
  const issuedAt = existing?.issued_at || new Date().toISOString();
  const record = {
    schema_version: SCHEMA_VERSION,
    kind: 'baseline',
    identity: normalized,
    policy: JSON.parse(JSON.stringify(policy)),
    issued_at: issuedAt,
    updated_at: new Date().toISOString(),
  };
  record.mac = recordMac(record, key);
  atomicWrite(baselinePath(projectRoot, normalized), record);
  return record;
}

function readPolicyFloor(projectRoot) {
  const state = readState(projectRoot);
  if (state.malformed || state.keyError || state.keyMissing) throw new Error(state.reason || 'completion authority state is unavailable');
  return state.floor || null;
}

function writePolicyFloor(projectRoot, policy) {
  if (!plain(policy)) throw new Error('project policy floor must contain a policy object');
  const key = ensureKey();
  const state = readState(projectRoot);
  if (state.malformed || state.keyError || state.keyMissing) throw new Error(state.reason || 'completion authority state is unavailable');
  const issuedAt = state.floor?.issued_at || new Date().toISOString();
  const record = {
    schema_version: SCHEMA_VERSION,
    kind: 'policy-floor',
    policy: JSON.parse(JSON.stringify(policy)),
    issued_at: issuedAt,
    updated_at: new Date().toISOString(),
  };
  record.mac = recordMac(record, key);
  atomicWrite(path.join(stateDir(projectRoot), FLOOR_FILE), record);
  return record;
}

function hasState(projectRoot) {
  try {
    const state = readState(projectRoot);
    if (state.malformed || state.keyError) return true;
    if (state.pending || state.grant || state.baselines.length > 0 || state.floor) return true;
    return !state.keyMissing && recordFiles(projectRoot).length > 0;
  } catch {
    return true;
  }
}

module.exports = {
  PREFIX,
  NONCE_RE,
  TTL_MS,
  SCHEMA_VERSION,
  FLOOR_FILE,
  stableStringify,
  digest,
  canonicalProjectRoot,
  atomicWrite,
  readKey,
  recordMac,
  macMatches,
  userStateRoot,
  stateDir,
  clearState,
  readState,
  ensureKey,
  createPending,
  approvePending,
  consumeGrant,
  readBaseline,
  writeBaseline,
  readPolicyFloor,
  writePolicyFloor,
  hasState,
};
