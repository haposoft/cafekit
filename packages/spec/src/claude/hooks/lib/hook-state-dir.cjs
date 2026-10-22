'use strict';

/**
 * Where a Claude hook keeps its own generated state: crash logs and the
 * gate/tollgate caches.
 *
 * Hooks run from two places. In an installed project they live in
 * `<runtime-dir>/hooks/`, whose `.logs/` is gitignored, so writing beside the hook is
 * correct. During this package's tests they run straight from
 * `packages/spec/src/claude/hooks/`, where the same write lands inside the
 * source tree as an untracked directory. That changes the worktree digest the
 * receipt provenance is bound to, and the completion gate then reports every
 * done task as stale. It surfaced three times as a false alarm before the cause
 * was found, so source-tree runs write to a temp directory instead.
 *
 * Keeping the rule here means a new hook cannot reintroduce the bug by copying
 * the old `path.join(__dirname, '.logs')` line.
 */

const os = require('os');
const path = require('path');

// This module ships in `hooks/lib/`, so the hook directory is always its parent.
const HOOKS_DIR = path.join(__dirname, '..');
const SOURCE_MARKER = `${path.sep}packages${path.sep}spec${path.sep}src`;

/** True when `dir` sits inside this package's source tree rather than an install. */
function isSourceTree(dir) {
  return String(dir || '').includes(SOURCE_MARKER);
}

/**
 * State root for hooks running from the Claude Code plugin, or null outside it.
 * The plugin root is replaced on every update and the project must stay clean,
 * so plugin state lives in CLAUDE_PLUGIN_DATA, or the OS temp directory when the
 * host gives no usable data directory.
 */
function pluginStateRoot() {
  if (!process.env.CLAUDE_PLUGIN_ROOT) return null;
  const data = process.env.CLAUDE_PLUGIN_DATA;
  if (data && path.isAbsolute(data)) return data;
  // Per-user name so accounts sharing /tmp do not collide; this is a fallback
  // only, since the host sets CLAUDE_PLUGIN_DATA for plugin hooks.
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  return path.join(os.tmpdir(), `cafekit-plugin-${uid}`);
}

/** Absolute directory for hook-generated state; create it before writing. */
function hookStateDir() {
  const pluginRoot = pluginStateRoot();
  if (pluginRoot) return path.join(pluginRoot, '.logs');
  return isSourceTree(HOOKS_DIR)
    ? path.join(os.tmpdir(), 'cafekit-hook-logs', require('./runtime-dir.cjs').runtimeDirName().slice(1))
    : path.join(HOOKS_DIR, '.logs');
}

module.exports = { hookStateDir, isSourceTree, pluginStateRoot };
