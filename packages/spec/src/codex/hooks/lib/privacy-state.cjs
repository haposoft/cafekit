'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PATH_SAFETY = require('./runtime-path-safety.cjs');
const { displayNames } = require('./privacy-paths.cjs');

// Codex cannot raise an interactive prompt from a hook -- PreToolUse honours no
// "ask" decision -- so approval costs a full round trip: the agent has to relay
// a request id and the user has to type it back. A five-minute window expired
// mid-conversation, leaving the agent repeating a request id that could no
// longer be approved. An hour outlives a working session's train of thought.
const TTL_MS = 60 * 60 * 1000;
const APPROVAL_PREFIX = 'APPROVE CAFEKIT PRIVACY ';
function stateDir(projectRoot) {
  return path.join(projectRoot, '.codex', 'hooks', '.privacy');
}
function secureStateDir(projectRoot, create = false) {
  const root = PATH_SAFETY.canonicalDirectory(projectRoot, 'privacy project root');
  const hooks = path.join(root, '.codex', 'hooks');
  try { PATH_SAFETY.assertComponentPath(root, hooks); }
  catch (error) {
    if (!create && error.code === 'ENOENT') return null;
    throw error;
  }
  const dir = path.join(hooks, '.privacy');
  if (create && !fs.existsSync(dir)) {
    // A parallel hook can create the directory between the check and the mkdir;
    // the component and directory checks below still reject anything but a real directory.
    try { fs.mkdirSync(dir, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  try { PATH_SAFETY.assertComponentPath(root, dir); }
  catch (error) {
    if (!create && error.code === 'ENOENT') return null;
    throw error;
  }
  if (!fs.lstatSync(dir).isDirectory()) throw new Error('privacy state must be a regular directory');
  return dir;
}
function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
function pathKey(filePath, sessionCwd) {
  const requested = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(sessionCwd, filePath);
  let target = requested;
  try {
    target = fs.realpathSync(requested);
  } catch {
    // Missing or virtual paths are still bound to their normalized request path.
  }
  return hash(path.normalize(target));
}
function requestPaths(filePaths, filePath) {
  const values = Array.isArray(filePaths) ? filePaths : [filePath];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}
function requestPathKeys(filePaths, sessionCwd) {
  return [...new Set(filePaths.map((filePath) => pathKey(filePath, sessionCwd)))].sort();
}
function samePathKeys(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function atomicWrite(dir, file, payload) {
  PATH_SAFETY.assertComponentPath(dir, path.dirname(file));
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
}

function readJson(dir, file) {
  try {
    PATH_SAFETY.assertComponentPath(dir, file);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function validPending(record, sessionId, requestId, now = Date.now()) {
  return record?.requestId === requestId && record.sessionId === sessionId
    && Number.isFinite(record.expiresAt) && record.expiresAt > now
    && typeof record.displayName === 'string' && record.displayName.length > 0
    && Array.isArray(record.pathKeys) && record.pathKeys.length > 0
    && record.pathKeys.every(key => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key));
}

function writeShortMarker(dir, record) {
  const { requestId, sessionId, expiresAt } = record;
  fs.writeFileSync(path.join(dir, `short-${hash(sessionId)}-${requestId}.json`),
    `${JSON.stringify({ requestId, sessionId, expiresAt })}\n`,
    { encoding: 'utf8', mode: 0o600, flag: 'wx' });
}

/** Each prompt owns only markers it successfully renamed, never a shared mutable flag. */
function claimShortMarkers(projectRoot, sessionId) {
  const requestIds = [];
  if (typeof sessionId !== 'string' || !sessionId.trim()) return { ok: true, requestIds };
  const dir = secureStateDir(projectRoot);
  if (!dir) return { ok: true, requestIds };
  const prefix = `short-${hash(sessionId)}-`;
  let ok = true;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
    const file = path.join(dir, name);
    const claimed = path.join(dir, `claim-${crypto.randomBytes(12).toString('hex')}.tmp`);
    const requestId = name.slice(prefix.length, -'.json'.length);
    let moved = false;
    try {
      PATH_SAFETY.assertComponentPath(dir, file);
      fs.renameSync(file, claimed);
      moved = true;
      requestIds.push(requestId);
      PATH_SAFETY.assertComponentPath(dir, claimed);
      const marker = JSON.parse(fs.readFileSync(claimed, 'utf8'));
      if (!/^[a-f0-9]{24}$/.test(requestId) || marker.requestId !== requestId
        || marker.sessionId !== sessionId || !Number.isFinite(marker.expiresAt)
        || marker.expiresAt <= Date.now()) throw new Error('Invalid short approval marker');
    } catch {
      ok = false;
      if (!moved) {
        // A failed claim cancels the shortcut; deletion never counts as ownership.
        try { fs.unlinkSync(file); }
        catch {
          let descriptor;
          try {
            PATH_SAFETY.canonicalRegularFile(dir, file, 'short approval marker');
            descriptor = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW);
            fs.ftruncateSync(descriptor, 0);
          } catch { /* no permission follows a failed invalidation */ }
          finally {
            if (descriptor !== undefined) {
              try { fs.closeSync(descriptor); } catch { /* already rejected */ }
            }
          }
        }
      }
    } finally {
      if (moved) {
        try { fs.unlinkSync(claimed); } catch { ok = false; }
      }
    }
  }
  return { ok, requestIds };
}

function cleanup(projectRoot, now = Date.now()) {
  const dir = secureStateDir(projectRoot);
  if (!dir) return;
  for (const name of fs.readdirSync(dir)) {
    if (!/^(?:(?:pending|token)-[a-f0-9]+|short-[a-f0-9]{64}-[a-f0-9]{24})\.json$/.test(name)) continue;
    const file = path.join(dir, name);
    const record = readJson(dir, file);
    if (!record || !Number.isFinite(record.expiresAt) || record.expiresAt <= now) {
      try {
        fs.unlinkSync(file);
      } catch {
        // Another hook may have consumed it.
      }
    }
  }
}

function clearState(projectRoot, sessionId) {
  try {
    if (typeof sessionId !== 'string' || !sessionId.trim()) return;
    const dir = secureStateDir(projectRoot);
    if (!dir) return;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(`short-${hash(sessionId)}-`) && name.endsWith('.json')) {
        try { fs.unlinkSync(path.join(dir, name)); } catch { /* concurrently claimed */ }
        continue;
      }
      if (/^(pending|token)-[a-f0-9]+\.json$/.test(name)) {
        const file = path.join(dir, name);
        if (readJson(dir, file)?.sessionId !== sessionId) continue;
        try { fs.unlinkSync(file); } catch { /* concurrently consumed */ }
      }
    }
  } catch {
    // Session boundaries invalidate best-effort state without blocking startup.
  }
}

function createPending({
  projectRoot,
  sessionCwd,
  sessionId,
  filePaths,
  filePath
}) {
  cleanup(projectRoot);
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new Error('A Codex session ID is required');
  const paths = requestPaths(filePaths, filePath);
  if (paths.length === 0) throw new Error('At least one sensitive path is required');
  const pathKeys = requestPathKeys(paths, sessionCwd);
  const dir = secureStateDir(projectRoot, true);
  for (const name of fs.readdirSync(dir)) {
    const match = name.match(/^pending-([a-f0-9]{24})\.json$/);
    if (!match) continue;
    const pending = readJson(dir, path.join(dir, name));
    if (validPending(pending, sessionId, match[1]) && samePathKeys(pending.pathKeys, pathKeys)) {
      try { writeShortMarker(dir, pending); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      return pending;
    }
  }
  const requestId = crypto.randomBytes(12).toString('hex');
  const record = {
    version: 2,
    requestId,
    sessionId: String(sessionId || ''),
    pathKeys,
    displayName: displayNames(paths),
    expiresAt: Date.now() + TTL_MS
  };
  atomicWrite(dir, path.join(dir, `pending-${requestId}.json`), record);
  writeShortMarker(dir, record);
  return record;
}

function approvePending({ projectRoot, sessionId, requestId }) {
  cleanup(projectRoot);
  if (typeof sessionId !== 'string' || !sessionId.trim()) return { ok: false, reason: 'session' };
  if (!/^[a-f0-9]{24}$/.test(requestId)) return { ok: false, reason: 'invalid' };

  const dir = secureStateDir(projectRoot);
  if (!dir) return { ok: false, reason: 'missing' };
  const pendingFile = path.join(dir, `pending-${requestId}.json`);
  const record = readJson(dir, pendingFile);
  if (!record) return { ok: false, reason: 'missing' };
  if (record.sessionId !== String(sessionId || '')) return { ok: false, reason: 'session' };
  if (Number(record.expiresAt) <= Date.now()) return { ok: false, reason: 'expired' };
  if (!validPending(record, sessionId, requestId)) return { ok: false, reason: 'invalid' };

  try {
    fs.unlinkSync(pendingFile);
  } catch {
    return { ok: false, reason: 'consumed' };
  }

  // The grant window starts when the user approves, not when the request was
  // raised. Carrying the pending record's deadline over meant a late approval
  // bought only the minutes left on it.
  atomicWrite(dir, path.join(dir, `token-${requestId}.json`), {
    version: 2,
    requestId,
    sessionId: record.sessionId,
    pathKeys: record.pathKeys,
    expiresAt: Date.now() + TTL_MS
  });
  return { ok: true, displayName: record.displayName };
}

/**
 * A grant is session-bound, path-bound and time-limited, but not single-use:
 * one approval covers repeated access to the same paths until it expires.
 * Consuming it on first use made every re-read a fresh round trip, and the tool
 * name is not part of the identity either -- reading a file with `cat` and with
 * a native read is the same access to the same secret.
 */
function hasGrant({
  projectRoot,
  sessionCwd,
  sessionId,
  filePaths,
  filePath
}) {
  cleanup(projectRoot);
  if (!sessionId) return false;
  const dir = secureStateDir(projectRoot);
  if (!dir) return false;
  const paths = requestPaths(filePaths, filePath);
  if (paths.length === 0) return false;
  const expectedPaths = requestPathKeys(paths, sessionCwd);

  for (const name of fs.readdirSync(dir)) {
    if (!/^token-[a-f0-9]{24}\.json$/.test(name)) continue;
    const token = readJson(dir, path.join(dir, name));
    if (
      !token ||
      token.sessionId !== String(sessionId || '') ||
      !samePathKeys(token.pathKeys, expectedPaths) ||
      Number(token.expiresAt) <= Date.now()
    ) {
      continue;
    }
    return true;
  }
  return false;
}

module.exports = {
  APPROVAL_PREFIX,
  TTL_MS,
  pathKey,
  createPending,
  approvePending,
  hasGrant,
  cleanup,
  clearState,
  claimShortMarkers
};
