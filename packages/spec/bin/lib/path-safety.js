'use strict';

const fs = require('fs');
const path = require('path');

function isInside(base, target) {
  const relative = path.relative(base, target);
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/**
 * Reject installer targets that traverse symlinks below the project root.
 * Managed payloads and rollback snapshots must never follow a project-owned
 * link into another directory.
 */
function assertNoSymlinkPath(filePath, basePath = process.cwd()) {
  const base = path.resolve(basePath);
  const target = path.resolve(filePath);
  if (!isInside(base, target)) {
    throw new Error(`Managed path is outside the project root: ${filePath}`);
  }

  const relative = path.relative(base, target);
  let cursor = base;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) {
        throw new Error(`Refusing to follow symlinked managed path: ${filePath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
  return target;
}

module.exports = { assertNoSymlinkPath, isInside };
