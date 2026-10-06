/**
 * CafeKit install backup / rollback (P2)
 *
 * Snapshots platform folders before any writes so a mid-install crash can be
 * rolled back to the pre-run state. Snapshots live under
 * `.cafekit-backup/<runId>/` at the project root and are pruned to the most
 * recent few on success.
 *
 * Pure module: no console output, no process control. The orchestrator decides
 * when to snapshot, restore, and prune, and what to log.
 */

const fs = require('fs');
const path = require('path');
const { assertNoSymlinkPath } = require('./path-safety');

const BACKUP_ROOT = '.cafekit-backup';
const SNAPSHOT_METADATA = 'snapshot.json';
const SNAPSHOT_DATA = 'data';

function validateTarget(target) {
  if (typeof target !== 'string' || !target || target.includes('\0')) {
    throw new Error('Backup target must be a non-empty relative path');
  }

  // Validate both separator styles so a snapshot created on one platform
  // cannot become unsafe when restored on another.
  const portable = target.replace(/\\/g, '/');
  const parts = portable.split('/');
  if (path.isAbsolute(target) || portable.startsWith('/') || parts.includes('..') || parts.includes('')) {
    throw new Error(`Unsafe backup target: ${target}`);
  }
  if (portable === '.' || portable === BACKUP_ROOT || portable.startsWith(`${BACKUP_ROOT}/`)) {
    throw new Error(`Unsafe backup target: ${target}`);
  }
  return parts.join(path.sep);
}

function validateRunId(runId) {
  if (typeof runId !== 'string' || !runId || runId === '.' || runId === '..' || /[\\/]/.test(runId)) {
    throw new Error('Backup runId must be a single path segment');
  }
  return runId;
}

/**
 * Recursively copy a directory tree (verbatim, no transforms). Used for
 * snapshot and restore. Skips if the source does not exist.
 */
function copyTree(src, dest) {
  let stat;
  try {
    stat = fs.lstatSync(src);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (stat.isSymbolicLink()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.symlinkSync(fs.readlinkSync(src), dest);
    return;
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyTree(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    // Preserve restrictive perms (e.g. .env at 0o600) on the backup copy.
    try {
      fs.chmodSync(dest, stat.mode);
    } catch {
      /* best-effort: chmod may fail on some filesystems */
    }
  }
}

/**
 * Snapshot explicit targets (relative to cwd, e.g. ['.claude', 'CLAUDE.md']).
 * Every target is recorded, including targets absent before the run.
 *
 * @param {string[]} folders
 * @param {string} runId  unique id for this run (timestamp-based)
 */
function snapshot(folders, runId) {
  const targets = [...new Set(folders.map(validateTarget))];
  const backupDir = path.join(BACKUP_ROOT, validateRunId(runId));
  const dataDir = path.join(backupDir, SNAPSHOT_DATA);
  assertNoSymlinkPath(BACKUP_ROOT);
  fs.mkdirSync(backupDir, { recursive: true });

  const records = [];
  for (const target of targets) {
    assertNoSymlinkPath(target);
    const existed = fs.existsSync(target);
    records.push({ target, existed });
    if (existed) copyTree(target, path.join(dataDir, target));
  }
  fs.writeFileSync(
    path.join(backupDir, SNAPSHOT_METADATA),
    `${JSON.stringify({ schemaVersion: 1, targets: records }, null, 2)}\n`,
    'utf8'
  );

  return backupDir;
}

/**
 * Restore every explicit target to its pre-run state. Existing targets are
 * replaced from backup; targets absent before the run are removed.
 *
 * @param {string} backupDir  path returned by snapshot()
 */
function restore(backupDir) {
  if (!backupDir || !fs.existsSync(backupDir)) return;

  const metadataPath = path.join(backupDir, SNAPSHOT_METADATA);
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  if (metadata?.schemaVersion !== 1 || !Array.isArray(metadata.targets)) {
    throw new Error(`Invalid backup metadata: ${metadataPath}`);
  }

  for (const record of metadata.targets) {
    if (!record || typeof record.existed !== 'boolean') {
      throw new Error(`Invalid backup target metadata: ${metadataPath}`);
    }
    const target = validateTarget(record.target);
    const source = path.join(backupDir, SNAPSHOT_DATA, target);
    let sourceExists = true;
    try {
      fs.lstatSync(source);
    } catch (error) {
      if (error.code === 'ENOENT') sourceExists = false;
      else throw error;
    }
    if (record.existed && !sourceExists) {
      throw new Error(`Backup data missing for target: ${target}`);
    }
    fs.rmSync(target, { recursive: true, force: true });
    if (record.existed) copyTree(source, target);
  }
}

/**
 * Keep only the most recent `keepN` backups; delete older ones. Backups sort
 * lexicographically by runId, which is timestamp-prefixed so newest sorts last.
 */
function prune(keepN = 3) {
  if (!fs.existsSync(BACKUP_ROOT)) return;

  const dirs = fs
    .readdirSync(BACKUP_ROOT)
    .filter((name) => {
      try {
        return fs.statSync(path.join(BACKUP_ROOT, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();

  const toRemove = dirs.slice(0, Math.max(0, dirs.length - keepN));
  for (const name of toRemove) {
    fs.rmSync(path.join(BACKUP_ROOT, name), { recursive: true, force: true });
  }
}

module.exports = {
  BACKUP_ROOT,
  snapshot,
  restore,
  prune
};
