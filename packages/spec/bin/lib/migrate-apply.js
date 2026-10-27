'use strict';

/**
 * Apply a `migrate` plan: remove exactly the planned files of an npx install and
 * rewrite the merged files, with a backup that is restored on any failure.
 *
 * Order: cwd check → lock → snapshot → re-plan and compare → per-file re-check →
 * writes → metadata → empty folders. Any error, or SIGINT between steps, restores
 * every snapshotted target. No console output; the caller reports the result.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { sha256 } = require('./manifest');
const backup = require('./backup');
const lock = require('./lock');
const { planManifestFiles } = require('./migrate-plan');
const { planMergedFiles } = require('./migrate-merged');

class MigrateError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function planMigration(projectRoot) {
  const manifest = planManifestFiles(projectRoot);
  const merged = planMergedFiles(projectRoot, manifest);
  return { manifest, merged };
}

/** Every change a plan makes, in apply order; two plans agree when their steps are equal. */
function planSteps(plan) {
  const steps = [];
  for (const entry of plan.manifest.entries) {
    if (entry.action === 'remove') steps.push({ op: 'unlink', path: entry.path, sha256: entry.sha256 });
  }
  for (const file of plan.merged.files) {
    if (file.action === 'write') steps.push({ op: 'write', path: file.path, sha256: sha256(file.before), content: file.after });
    if (file.action === 'remove') steps.push({ op: 'unlink', path: file.path, sha256: sha256(file.before) });
  }
  // The install metadata goes last, and only once the install owns no file any more.
  for (const platform of Object.values(plan.manifest.platforms)) {
    if (platform.status !== 'planned') continue;
    const owns = plan.manifest.entries.some((entry) => entry.platform === platform.platform && entry.action === 'keep');
    if (!owns) for (const rel of platform.metadata) steps.push({ op: 'unlink-metadata', path: rel });
  }
  return steps;
}

/** Top-level paths the steps touch, which is what the backup snapshots. */
function snapshotTargets(steps) {
  return [...new Set(steps.map((step) => step.path.split('/')[0]))].sort();
}

const nextTick = () => new Promise((resolve) => setImmediate(resolve));

/** Refuse to touch a path that changed since it was planned or that is not a plain file. */
function verifyStep(io, abs, step) {
  if (step.op === 'unlink-metadata') return;
  const stat = io.lstatSync(abs);
  if (stat.isSymbolicLink() || !stat.isFile() || sha256(io.readFileSync(abs)) !== step.sha256) {
    throw new MigrateError('stale', `${step.path} changed since it was planned`);
  }
}

function performStep(io, abs, step) {
  if (step.op === 'write') {
    // Write beside the target and rename over it, so the file is never half written. The
    // temp name is unpredictable and created with `wx`, so a planted symlink is never
    // followed; it keeps the target's mode, and it is removed again if the write fails,
    // because a temp file beside a root-level file lies outside every snapshot target.
    const temp = `${abs}.cafekit-migrate-${crypto.randomBytes(6).toString('hex')}`;
    const mode = io.lstatSync(abs).mode & 0o7777;
    let opened = false;
    try {
      io.writeFileSync(temp, step.content, { flag: 'wx', mode });
      opened = true;
      io.chmodSync(temp, mode);
      io.renameSync(temp, abs);
    } catch (error) {
      // writeFileSync creates the file before writing it, so a failed write (ENOSPC)
      // still leaves a temp behind; only an EEXIST from the create means the name is
      // someone else's.
      if (opened || error.code !== 'EEXIST') {
        try {
          io.unlinkSync(temp);
        } catch {
          // Never created, or already gone.
        }
      }
      throw error;
    }
    return;
  }
  if (step.op === 'unlink-metadata' && !io.existsSync(abs)) return;
  io.unlinkSync(abs);
}

/** Remove folders the plan emptied, deepest first; a folder that still holds anything stays. */
function removeEmptyFolders(io, root, steps) {
  const folders = new Set();
  for (const step of steps) {
    let dir = path.posix.dirname(step.path);
    while (dir !== '.') {
      folders.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  const deepestFirst = [...folders].sort((a, b) => b.split('/').length - a.split('/').length || a.localeCompare(b));
  for (const rel of deepestFirst) {
    try {
      io.rmdirSync(path.join(root, rel));
    } catch (error) {
      if (!['ENOTEMPTY', 'EEXIST', 'ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    }
  }
}

/**
 * @param {string} projectRoot  repository root; must equal the current working directory
 * @param {{plan?: object, fs?: object, runId?: string, onStep?: Function}} options
 *   plan: the plan the user saw (re-planned and compared before any change)
 *   fs: file-system implementation for apply and restore (tests inject failures)
 * @returns {Promise<object>} { ok, reason?, message?, backupDir?, removed, written, restoreErrors?, manualSteps? }
 */
async function applyMigration(projectRoot, options = {}) {
  const io = options.fs || fs;
  const root = fs.realpathSync(projectRoot);
  // backup.js and lock.js resolve paths from the working directory.
  if (fs.realpathSync(process.cwd()) !== root) {
    return { ok: false, reason: 'wrong-cwd', message: `Run migrate from the repository root: ${root}` };
  }
  const given = options.plan || planMigration(root);
  if (given.merged.refused) return { ok: false, reason: 'refused', message: given.merged.refused };
  const steps = planSteps(given);
  if (steps.length === 0) return { ok: true, nothing: true, removed: 0, written: 0 };

  const got = lock.acquire(root);
  if (!got.acquired) {
    const hint = got.reason === 'reclaiming'
      ? `; if no CafeKit run is active, delete ${lock.LOCK_FILE} and ${lock.LOCK_FILE}.reclaim`
      : '';
    return { ok: false, reason: 'locked', message: `Another CafeKit run holds ${lock.LOCK_FILE}${got.pid ? ` (pid ${got.pid})` : ''}${hint}` };
  }

  let interrupted = false;
  const onSigint = () => { interrupted = true; };
  process.on('SIGINT', onSigint);
  let backupDir = null;
  let touched = false;
  const done = { removed: 0, written: 0 };
  try {
    backupDir = backup.snapshot(snapshotTargets(steps), options.runId || `${Date.now()}-migrate`);
    const fresh = planMigration(root);
    if (fresh.merged.refused || JSON.stringify(planSteps(fresh)) !== JSON.stringify(steps)) {
      throw new MigrateError('stale', 'The repository changed since the plan was shown; run migrate again to see the new plan');
    }
    for (const step of steps) {
      await nextTick();
      if (interrupted) throw new MigrateError('interrupted', 'Interrupted');
      const abs = path.join(root, step.path);
      verifyStep(io, abs, step);
      touched = true;
      performStep(io, abs, step);
      if (step.op === 'write') done.written++;
      else done.removed++;
      if (typeof options.onStep === 'function') options.onStep(step);
    }
    await nextTick();
    if (interrupted) throw new MigrateError('interrupted', 'Interrupted');
    removeEmptyFolders(io, root, steps);
    return { ok: true, backupDir, ...done };
  } catch (error) {
    let restoreErrors = [];
    if (touched) {
      try {
        backup.restore(backupDir, { fs: io });
      } catch (restoreError) {
        restoreErrors = restoreError.restoreErrors || [{ target: '*', message: restoreError.message }];
      }
    }
    const manualSteps = restoreErrors.map(({ target }) => (target === '*'
      ? `Restore every folder and file under ${path.join(backupDir, 'data')} by hand`
      : `Copy ${path.join(backupDir, 'data', target)} back to ${target}`));
    // The rollback puts back the snapshot taken when apply started, so a change made to
    // those folders while apply ran is not kept either.
    const failed = new Set(restoreErrors.map((item) => item.target));
    const rolledBack = snapshotTargets(steps).filter((target) => !failed.has(target) && !failed.has('*'));
    const note = touched && rolledBack.length > 0
      ? ` Rolled back ${rolledBack.join(', ')} to the snapshot taken when migrate started; edits made there while it ran were not kept.`
      : '';
    return { ok: false, reason: error.code || 'failed', message: `${error.message.replace(/\.$/, '')}.${note}`, backupDir, restored: touched, restoreErrors, manualSteps, ...done };
  } finally {
    process.removeListener('SIGINT', onSigint);
    lock.release(root);
  }
}

module.exports = { applyMigration, planMigration, planSteps };
