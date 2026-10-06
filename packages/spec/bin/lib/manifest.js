/**
 * CafeKit install manifest (P1 — ownership tracking)
 *
 * Records every managed file the installer wrote, keyed by SHA-256 of the
 * payload at install time. On a later run we compare three hashes — the file
 * on disk, the hash recorded here, and the new payload — to classify each
 * file as pristine / user-modified / user-created. This is what lets update
 * skip unchanged files and preserve user edits instead of blindly overwriting.
 *
 * The manifest lives at `<platformFolder>/cafekit-manifest.json`, a sibling of
 * the existing `cafekit.json` metadata (which stays pure version metadata).
 *
 * Pure module: no console output, no process control. Side effects limited to
 * reading/writing the manifest file itself.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertNoSymlinkPath, isInside } = require('./path-safety');

const MANIFEST_FILE = 'cafekit-manifest.json';
const SCHEMA_VERSION = 1;

/**
 * SHA-256 of a buffer or string. Returns hex digest.
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * SHA-256 of a file on disk, or null if it does not exist / cannot be read.
 */
function hashFile(filePath) {
  try {
    return sha256(fs.readFileSync(filePath));
  } catch {
    return null;
  }
}

/**
 * Absolute path to a platform's manifest file.
 */
function manifestPath(platformFolder) {
  return path.join(platformFolder, MANIFEST_FILE);
}

/**
 * Read a platform manifest. Returns a normalized object even when the file is
 * absent or corrupt, so callers never have to null-check.
 *
 * Shape: { schemaVersion, version, files: { <relPath>: { sha256, version } } }
 */
function read(platformFolder) {
  const empty = { schemaVersion: SCHEMA_VERSION, version: null, files: {} };
  try {
    const raw = fs.readFileSync(manifestPath(platformFolder), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.files !== 'object') {
      return empty;
    }
    return {
      schemaVersion: parsed.schemaVersion || SCHEMA_VERSION,
      version: parsed.version || null,
      files: parsed.files || {}
    };
  } catch {
    return empty;
  }
}

/**
 * Create a tracker that accumulates installed-file records during a run and
 * writes them back as the new baseline. relPath keys are normalized to forward
 * slashes and are relative to the platform folder.
 */
function createTracker(platformFolder, version, options = {}) {
  const files = {};
  const recordRoot = path.resolve(options.recordRoot || platformFolder);
  const allowedRoots = (options.allowedRoots || [options.recordRoot || platformFolder])
    .map((root) => path.resolve(root));

  function keyFor(filePath) {
    const target = path.resolve(filePath);
    if (!allowedRoots.some((root) => isInside(root, target))) {
      throw new Error(`Managed file is outside allowed roots: ${filePath}`);
    }
    assertNoSymlinkPath(target);
    return path.relative(recordRoot, target).replace(/\\/g, '/');
  }

  return {
    recordRoot,
    allowedRoots,
    keyFor,

    /**
     * Record a managed file by its on-disk path. Hashes the file as written.
     * Skips silently if the file is missing (e.g. dry-run).
     */
    record(absPath) {
      const hash = hashFile(absPath);
      if (hash === null) return;
      const rel = keyFor(absPath);
      files[rel] = { sha256: hash, version };
    },

    /** Number of files recorded so far. */
    count() {
      return Object.keys(files).length;
    },

    /** Keys explicitly pruned this run — must not survive the merge into the prior manifest. */
    _pruned: new Set(),

    /** Remove a relPath from this run's tracked files (e.g. after obsolete removal). */
    prune(rel) {
      const key = rel.replace(/\\/g, '/');
      delete files[key];
      this._pruned.add(key);
    },

    /**
     * Prune every tracked key under a directory prefix (e.g. "skills/foo/").
     * Marks prior-manifest keys with the same prefix for deletion on write().
     */
    prunePrefix(relPrefix) {
      const prefix = relPrefix.replace(/\\/g, '/');
      for (const key of Object.keys(files)) {
        if (key.startsWith(prefix)) delete files[key];
      }
      const prior = read(platformFolder);
      for (const key of Object.keys(prior.files || {})) {
        if (key.startsWith(prefix)) this._pruned.add(key);
      }
    },

    /** Recorded hash for a relPath written earlier this run, or null. */
    recorded(rel) {
      const key = rel.replace(/\\/g, '/');
      return files[key] ? files[key].sha256 : null;
    },

    /**
     * Write the manifest to disk. Merges onto any prior manifest so files
     * touched by a partial/selective run are not dropped from the baseline.
     */
    write() {
      const prior = read(platformFolder);
      // Start from prior, delete pruned entries, then overlay this run's files.
      const merged = { ...prior.files };
      for (const key of this._pruned) delete merged[key];
      Object.assign(merged, files);
      const out = {
        schemaVersion: SCHEMA_VERSION,
        version,
        files: merged
      };
      const target = manifestPath(platformFolder);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    }
  };
}

/**
 * Classify a managed file against the recorded baseline + the incoming payload.
 *
 * @param {string} absPath      destination path on disk
 * @param {string} platformFolder root of the platform install (e.g. .claude)
 * @param {object} manifest     result of read(platformFolder)
 * @param {string} payloadHash  sha256 of the content about to be written
 * @returns {{state: string, diskHash: string|null, recordedHash: string|null, changed: boolean}}
 *   state: 'absent' | 'pristine' | 'user-modified' | 'user-created'
 *   changed: whether the payload differs from what's on disk (false → skip copy)
 */
function classify(absPath, platformFolder, manifest, payloadHash, recordRoot = platformFolder) {
  const rel = path.relative(recordRoot, absPath).replace(/\\/g, '/');
  const recorded = manifest.files[rel];
  const recordedHash = recorded ? recorded.sha256 : null;
  const diskHash = hashFile(absPath);

  if (diskHash === null) {
    return { state: 'absent', diskHash: null, recordedHash, changed: true };
  }

  // File exists but we never recorded installing it → user created it.
  if (!recordedHash) {
    return {
      state: 'user-created',
      diskHash,
      recordedHash: null,
      changed: diskHash !== payloadHash
    };
  }

  // On disk matches our last install → safe to update from payload.
  if (diskHash === recordedHash) {
    return {
      state: 'pristine',
      diskHash,
      recordedHash,
      changed: diskHash !== payloadHash
    };
  }

  // On disk diverged from our baseline → user edited a managed file.
  return {
    state: 'user-modified',
    diskHash,
    recordedHash,
    changed: diskHash !== payloadHash
  };
}

module.exports = {
  MANIFEST_FILE,
  SCHEMA_VERSION,
  sha256,
  hashFile,
  manifestPath,
  read,
  createTracker,
  classify
};
