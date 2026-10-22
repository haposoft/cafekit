/**
 * Copyright (c) 2026 Haposoft. MIT License.
 *
 * Runtime-directory derivation for the gate hooks.
 *
 * The hooks used to hardcode `.claude` in every project-runtime path, so a copy installed
 * under `.omp/hooks/` or `.codex/hooks/` read another platform's config, never matched
 * installed-root detection, and wrote session state into a directory that did not exist.
 * This module ships in `hooks/lib/`, so the runtime root is always two levels up from
 * here and its basename is the answer: `.claude`, `.codex`, or `.omp`.
 *
 * In the source tree the same files live at `packages/spec/src/<platform>/hooks/lib/`, so
 * the basename is the undotted platform name; it is mapped to its dotted form so tests
 * that run hooks from source see the same directory an install would. A dotted basename
 * always wins over the source-tree check, because an install can legitimately sit under a
 * path that happens to contain `/packages/spec/src/`.
 *
 * Anything else yields `.claude`, which is exactly the behaviour every caller had before
 * this module existed. There is deliberately no "derived" flag: nobody would read it.
 *
 * The source-tree marker is inlined rather than required from `hook-state-dir.cjs` so a
 * fixture that copies a hook by hand needs to copy only this one library.
 */

const path = require('path');

const SOURCE_MARKER = `${path.sep}packages${path.sep}spec${path.sep}src${path.sep}`;
const HOOKS_DIR = path.resolve(__dirname, '..');
const RUNTIME_ROOT = path.resolve(HOOKS_DIR, '..');

/** `.claude`, `.codex`, `.omp`, or whatever dotted folder this hook tree is installed under. */
function runtimeDirName() {
  const base = path.basename(RUNTIME_ROOT);
  if (base.startsWith('.')) return base;
  if (HOOKS_DIR.includes(SOURCE_MARKER)) return `.${base}`;
  return '.claude';
}

/** Absolute runtime directory for a project, e.g. `<cwd>/.omp`. */
function runtimeDir(cwd) {
  return path.join(cwd, runtimeDirName());
}

/** Absolute path under the runtime directory, e.g. `runtimePath(cwd, 'runtime.json')`. */
function runtimePath(cwd, ...segments) {
  return path.join(runtimeDir(cwd), ...segments);
}

module.exports = { runtimeDirName, runtimeDir, runtimePath };
