/**
 * Ownership-aware file writer (P1 + P4 + P6).
 *
 * Central decision point for every managed file the installer writes. Instead
 * of "exists? skip : overwrite", it hashes the incoming payload, classifies the
 * destination against the recorded manifest, and decides:
 *
 *   absent        → write (created)
 *   pristine      → write if payload differs (updated), else skip (unchanged)
 *   user-modified → keep by default (preserved); overwrite only with
 *   user-created    forceOverwrite (the pre-run snapshot already holds the
 *                   user's copy for rollback/recovery)
 *
 * Honors dry-run (classify + report, no writes). Records written/unchanged
 * files into the run's manifest tracker so the baseline stays accurate.
 *
 * Pure-ish: performs the actual file write, but logging/counters are left to
 * callers via the returned action so each call site keeps its own message flavor.
 */

const fs = require('fs');
const path = require('path');
const { isTextAsset, isGeneratedArtifact } = require('./copy-utils');
const manifest = require('./manifest');
const { assertNoSymlinkPath } = require('./path-safety');

/**
 * Resolve the payload bytes for a source file, applying a text transform when
 * provided and the file is a text asset (mirrors copy-utils.copyRecursive).
 * Returns { data, utf8 } where data is a string (utf8) or Buffer.
 */
function readPayload(src, transform) {
  if (typeof transform === 'function' && isTextAsset(src)) {
    return { data: transform(fs.readFileSync(src, 'utf8'), src), utf8: true };
  }
  return { data: fs.readFileSync(src), utf8: false };
}

/**
 * Plan and (unless dry-run) perform the write for a single managed file.
 *
 * @returns {{action: string, state: string}}
 *   action: 'created' | 'updated' | 'unchanged' | 'preserved' | 'missing'
 */
function writeManagedFile(opts) {
  const { src, dest, platformFolder, ctx, tracker, transform, sourceRoot } = opts;

  if (!fs.existsSync(src)) {
    return { action: 'missing', state: 'absent' };
  }
  const sourceStat = fs.lstatSync(src);
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
    throw new Error(`Managed source must be a non-symlink regular file: ${src}`);
  }
  if (sourceRoot) assertNoSymlinkPath(src, sourceRoot);
  assertNoSymlinkPath(dest);

  const { data, utf8 } = readPayload(src, transform);
  const payloadHash = manifest.sha256(data);
  // Ownership manifest for this platform (read at run start), NOT the migration manifest.
  const ownership = (ctx.ownership && ctx.ownership[platformFolder]) || { files: {} };

  // A file already written earlier THIS run (e.g. a spec template copied as part
  // of the specs/ tree, then revisited by the template-sync loop) is ours — treat
  // it as pristine against what we just wrote, not as a user-created file.
  const relForRun = tracker?.keyFor
    ? tracker.keyFor(dest)
    : path.relative(platformFolder, dest).replace(/\\/g, '/');
  const writtenThisRun = tracker ? tracker.recorded(relForRun) : null;

  let cls;
  if (writtenThisRun !== null) {
    cls = {
      state: 'pristine',
      diskHash: writtenThisRun,
      recordedHash: writtenThisRun,
      changed: writtenThisRun !== payloadHash
    };
  } else {
    cls = manifest.classify(
      dest,
      platformFolder,
      ownership,
      payloadHash,
      tracker?.recordRoot || platformFolder
    );
  }
  const forced = Boolean(ctx.options.forceOverwrite);

  let action;
  if (cls.state === 'absent') {
    action = 'created';
  } else if (cls.state === 'pristine') {
    action = cls.changed ? 'updated' : 'unchanged';
  } else {
    // user-modified or user-created
    if (forced) {
      action = cls.changed ? 'updated' : 'unchanged';
    } else {
      action = 'preserved';
    }
  }

  if (action === 'preserved') {
    ctx.results.preservedFiles.push(dest);
    // Do not record: leave the prior baseline entry so the file stays
    // classified as user-modified on the next run too.
    return { action, state: cls.state };
  }

  const willWrite = action === 'created' || action === 'updated';

  if (willWrite && !ctx.dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (utf8) {
      fs.writeFileSync(dest, data, 'utf8');
    } else {
      fs.writeFileSync(dest, data);
    }
    if (process.platform !== 'win32') {
      const sourceMode = fs.statSync(src).mode;
      const destinationMode = fs.statSync(dest).mode;
      fs.chmodSync(dest, (destinationMode & ~0o111) | (sourceMode & 0o111));
    }
  }

  // Record created/updated/unchanged files so the manifest reflects reality.
  // Skip recording in dry-run (nothing was written).
  if (tracker && !ctx.dryRun) {
    if (willWrite) {
      tracker.record(dest);
    } else {
      // unchanged pristine — record current (== payload) hash to keep baseline fresh
      tracker.record(dest);
    }
  }

  return { action, state: cls.state };
}

/**
 * Walk a source directory tree and apply writeManagedFile to each file,
 * mirroring copy-utils.copyRecursive's traversal (incl. gitignore → .gitignore).
 *
 * @returns {{created, updated, unchanged, preserved, missing}} aggregate counts
 */
function copyManagedTree(opts) {
  const { src, dest, platformFolder, ctx, tracker, transform } = opts;
  const sourceRoot = opts.sourceRoot || path.resolve(src);
  const agg = { created: 0, updated: 0, unchanged: 0, preserved: 0, missing: 0 };

  if (!fs.existsSync(src)) {
    agg.missing++;
    return agg;
  }

  const stats = fs.lstatSync(src);
  if (stats.isSymbolicLink()) throw new Error(`Managed source tree cannot contain symlinks: ${src}`);
  if (path.resolve(src) !== path.resolve(sourceRoot)) assertNoSymlinkPath(src, sourceRoot);
  if (stats.isDirectory()) {
    for (const childName of fs.readdirSync(src)) {
      // Generated artifacts (coverage, Python bytecode) are not runtime
      // payload — skip so they never ship.
      if (isGeneratedArtifact(childName)) continue;
      const destName = childName === 'gitignore' ? '.gitignore' : childName;
      const childAgg = copyManagedTree({
        ...opts,
        sourceRoot,
        src: path.join(src, childName),
        dest: path.join(dest, destName)
      });
      for (const k of Object.keys(agg)) agg[k] += childAgg[k];
    }
    return agg;
  }

  const { action } = writeManagedFile({ src, dest, platformFolder, ctx, tracker, transform, sourceRoot });
  if (agg[action] !== undefined) agg[action]++;
  return agg;
}

/**
 * Did a tree-copy aggregate touch the filesystem (created/updated anything)?
 */
function treeChanged(agg) {
  return agg.created > 0 || agg.updated > 0;
}

module.exports = {
  readPayload,
  writeManagedFile,
  copyManagedTree,
  treeChanged
};
