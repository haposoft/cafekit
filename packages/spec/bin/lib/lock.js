/**
 * CafeKit install process lock (P5)
 *
 * Prevents two installer runs (or a run racing another writer) from clobbering
 * the same project. A lock file at the project root holds the owning PID and a
 * timestamp. If a live process owns it, a second run refuses; if the owner is
 * dead (stale lock), it is reclaimed.
 *
 * Pure module: no console output, no process control. Returns structured
 * results; the orchestrator decides what to log and whether to exit.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LOCK_FILE = '.cafekit.lock';

/**
 * Check whether a PID belongs to a live process. `process.kill(pid, 0)` sends
 * no signal but throws ESRCH if the process does not exist.
 */
function isProcessAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM → process exists but we can't signal it → still alive.
    return err.code === 'EPERM';
  }
}

/** Lock file text for this process. */
function lockPayload() {
  return `${JSON.stringify({ pid: process.pid, since: new Date().toISOString() }, null, 2)}\n`;
}

/**
 * Create `file` holding `data` only if it does not exist; false when another process got
 * there first. The data is written to a private temp file and hard-linked into place, so
 * the file never exists empty: a `wx` write opens it before writing, and a reader in that
 * gap would see no pid and take a live lock for a stale one.
 */
function createExclusive(file, data) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}`;
  let written = false;
  try {
    fs.writeFileSync(temp, data, { encoding: 'utf8', flag: 'wx' });
    written = true;
    fs.linkSync(temp, file);
    return true;
  } catch (err) {
    // A failed temp write (a full disk) is a real error; never create the lock after it.
    if (!written) throw err;
    if (err.code === 'EEXIST') return false;
    // exFAT, FAT32 and some network or VM shares have no hard links, and the error a
    // failed link reports differs by platform. The temp write succeeded, so the folder is
    // writable: fall back to a plain `wx` create, which still lets only one run win (with
    // the brief empty-file gap back) and raises any real error itself.
    return createWithoutLink(file, data);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function createWithoutLink(file, data) {
  try {
    fs.writeFileSync(file, data, { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function parseLock(raw) {
  try {
    const info = JSON.parse(raw);
    return info && typeof info === 'object' ? info : {};
  } catch {
    return {};
  }
}

/**
 * Attempt to acquire the lock.
 *
 * The lock file is created with `wx`, so of two racing runs exactly one wins. A stale
 * lock (its pid is dead) is reclaimed only by the run that also creates the
 * `.cafekit.lock.reclaim` guard with `wx`: it re-reads the lock, and only when the
 * bytes are still the stale ones it read does it delete the lock and create its own,
 * again with `wx`. Checking and replacing cannot be one atomic step, so without the
 * guard two reclaimers could each see the stale bytes and each believe it won.
 *
 * @param {string} cwd  project root (defaults to process.cwd())
 * @returns {{acquired: boolean, reason?: string, pid?: number, since?: string, reclaimed?: boolean}}
 *   acquired:false + reason:'held' → another live process owns it (pid/since set)
 *   acquired:false + reason:'reclaiming' → another run is reclaiming a stale lock, or died doing so
 *   acquired:true, reclaimed:true  → a stale lock was taken over
 */
function acquire(cwd = process.cwd(), attempt = 0) {
  const lockPath = path.join(cwd, LOCK_FILE);
  if (createExclusive(lockPath, lockPayload())) return { acquired: true, reclaimed: false };

  const raw = readOrNull(lockPath);
  // The owner released it between our create and our read: try once more.
  if (raw === null) return attempt < 1 ? acquire(cwd, attempt + 1) : { acquired: false, reason: 'held', pid: undefined };
  const info = parseLock(raw);
  if (isProcessAlive(info.pid)) {
    return { acquired: false, reason: 'held', pid: info.pid, since: info.since };
  }

  const guardPath = `${lockPath}.reclaim`;
  // The current owner, for a refusal that names who holds the lock.
  const held = () => {
    const owner = parseLock(readOrNull(lockPath) || '');
    return { acquired: false, reason: 'held', pid: owner.pid, since: owner.since };
  };
  if (!createExclusive(guardPath, lockPayload())) {
    // A guard left by a run that died while reclaiming blocks every later reclaim until
    // it is deleted by hand; removing it here would reopen the race it closes.
    const guard = parseLock(readOrNull(guardPath) || '');
    return { acquired: false, reason: 'reclaiming', pid: guard.pid, since: guard.since, guard: guardPath };
  }
  try {
    if (readOrNull(lockPath) !== raw) return held();
    fs.rmSync(lockPath, { force: true });
    if (!createExclusive(lockPath, lockPayload())) return held();
    return { acquired: true, reclaimed: true };
  } finally {
    fs.rmSync(guardPath, { force: true });
  }
}

/**
 * Release the lock if (and only if) this process owns it. Safe to call in a
 * finally block even when acquire() failed.
 */
function release(cwd = process.cwd()) {
  const lockPath = path.join(cwd, LOCK_FILE);
  if (!fs.existsSync(lockPath)) return;
  try {
    const info = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (info.pid && info.pid !== process.pid) return; // not ours, leave it
  } catch {
    // Unreadable lock — fall through and remove it.
  }
  fs.rmSync(lockPath, { force: true });
}

module.exports = {
  LOCK_FILE,
  isProcessAlive,
  acquire,
  release
};
