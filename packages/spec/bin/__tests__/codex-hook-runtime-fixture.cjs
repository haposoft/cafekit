'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { codexRuntimeLayout } = require('../phases/codex-runtime');

// Groups the installer materializes under .codex that Codex hooks load at run time.
const HOOK_RUNTIME_GROUPS = new Set(['hooks', 'schema', 'shared-lib']);

/**
 * Lay the Codex hook runtime into `<root>/.codex` exactly as the installer does,
 * driven by the canonical layout so a new hook or shared library cannot be missed.
 * Returns the hooks directory.
 */
function installCodexHookRuntime(root) {
  const runtimeRoot = path.join(root, '.codex');
  for (const entry of codexRuntimeLayout()) {
    if (!HOOK_RUNTIME_GROUPS.has(entry.group)) continue;
    const target = path.join(runtimeRoot, entry.dest);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(entry.src, target);
  }
  return path.join(runtimeRoot, 'hooks');
}

module.exports = { installCodexHookRuntime };
