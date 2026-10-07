'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const TEMP_RUN_ID = String(process.env.CAFEKIT_CLOSEOUT_TEMP_RUN_ID || `${process.pid}-${Date.now()}`)
  .replace(/[^a-zA-Z0-9_-]/g, '-');
const TEMP_PREFIX = `cafekit-v2-closeout-owned-${TEMP_RUN_ID}`;

function withTempResources(callback) {
  const ownedPaths = [];
  const originalHome = Object.hasOwn(process.env, 'HOME')
    ? { present: true, value: process.env.HOME }
    : { present: false };
  function ownedDirectory(label) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${TEMP_PREFIX}-${label}-`));
    ownedPaths.push(directory);
    return directory;
  }
  const resources = {
    directory: ownedDirectory,
    useHome(label) {
      const directory = ownedDirectory(label);
      process.env.HOME = directory;
      return directory;
    },
  };
  try {
    return callback(resources);
  } finally {
    if (originalHome.present) process.env.HOME = originalHome.value;
    else delete process.env.HOME;
    for (const ownedPath of ownedPaths.reverse()) {
      fs.rmSync(ownedPath, { recursive: true, force: true });
    }
  }
}

test('temp resource scope cleans exact owned paths and restores HOME after failure', () => {
  const originalHome = Object.hasOwn(process.env, 'HOME')
    ? { present: true, value: process.env.HOME }
    : { present: false };
  let root;
  let home;
  assert.throws(() => withTempResources((resources) => {
    root = resources.directory('failure-root');
    home = resources.useHome('failure-home');
    throw new Error('intentional resource-scope failure');
  }), /intentional resource-scope failure/);
  assert.equal(fs.existsSync(root), false);
  assert.equal(fs.existsSync(home), false);
  assert.equal(Object.hasOwn(process.env, 'HOME'), originalHome.present);
  if (originalHome.present) assert.equal(process.env.HOME, originalHome.value);
});
