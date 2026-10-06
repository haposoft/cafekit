'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Installed layout: <project>/.codex/hooks/lib/hook-context.cjs
// Canonicalize installed project root via realpath where available; lexical fallback keeps source-tree tests working.
// This ensures a symlink project root (e.g., /tmp/link -> /real/project) is resolved to its real location,
// keeping assertConfiguredSpecsPath and state paths consistent with resolveSessionCwd's realpath.
// Installed-root authority stays PROJECT_ROOT (now canonical); do not change without updating state/approval paths.
const PROJECT_ROOT = (() => {
  const lexical = path.resolve(__dirname, '..', '..', '..');
  try {
    return fs.realpathSync(lexical);
  } catch {
    return lexical;
  }
})();

function readPayload() {
  const raw = fs.readFileSync(0, 'utf8').trim();
  if (!raw) throw new Error('hook payload is empty');
  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('hook payload must be a JSON object');
  }
  return payload;
}

function resolveSessionCwd(payload) {
  const value = typeof payload?.cwd === 'string' ? payload.cwd.trim() : '';
  const resolved = value
    ? path.resolve(process.cwd(), value)
    : process.cwd();
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function readRuntime(projectRoot = PROJECT_ROOT) {
  try {
    const file = path.join(projectRoot, '.codex', 'runtime.json');
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : {};
  } catch {
    return {};
  }
}

function assertConfiguredSpecsPath(projectRoot, runtime) {
  const configured = runtime?.paths?.specs;
  if (configured !== undefined && (typeof configured !== 'string' || configured.trim() === '')) {
    throw new Error('runtime.paths.specs must be a non-empty path');
  }
  const requested = configured || 'specs';
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, requested);
  const relative = path.relative(root, resolved);
  if (relative !== '' && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) {
    throw new Error('configured specs root escapes project root');
  }
  let probe = resolved;
  try {
    while (!fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
    const rootReal = fs.realpathSync(root);
    const probeReal = fs.realpathSync(probe);
    const canonicalRelative = path.relative(rootReal, probeReal);
    if (canonicalRelative !== '' && (canonicalRelative === '..' || canonicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(canonicalRelative))) {
      throw new Error('configured specs root traverses outside project root');
    }
  } catch (error) {
    if (/configured specs root/.test(error.message)) throw error;
    throw new Error(`configured specs root cannot be validated (${error.message})`);
  }
  return resolved;
}

function getHookContext(payload) {
  const runtime = readRuntime(PROJECT_ROOT);
  assertConfiguredSpecsPath(PROJECT_ROOT, runtime);
  return {
    projectRoot: PROJECT_ROOT,
    sessionCwd: resolveSessionCwd(payload),
    runtime
  };
}

function resolveProjectPath(projectRoot, configuredPath, fallback) {
  const requested = typeof configuredPath === 'string' && configuredPath.trim()
    ? configuredPath.trim()
    : fallback;
  const resolved = path.resolve(projectRoot, requested);
  const relative = path.relative(projectRoot, resolved);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
    ? resolved
    : path.resolve(projectRoot, fallback);
}

function atomicWrite(file, content, mode = 0o600) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const suffix = `${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const temp = `${file}.${suffix}.tmp`;
  fs.writeFileSync(temp, content, { encoding: 'utf8', mode });
  fs.renameSync(temp, file);
}

/**
 * Where a hook keeps its own generated state: crash logs, session reservations
 * and the gate/tollgate caches.
 *
 * Installed, that is `<project>/.codex/hooks/.logs/`. Under this package's own
 * tests PROJECT_ROOT resolves to `packages/spec/src`, so the same write lands in
 * the source tree; it accumulated silently there because the repository ignores
 * `.codex` at any depth. Source-tree runs therefore write to a temp directory.
 */
function hookStateDir(projectRoot) {
  const root = projectRoot || PROJECT_ROOT;
  return String(root).includes(`${path.sep}packages${path.sep}spec${path.sep}src`)
    ? path.join(require('os').tmpdir(), 'cafekit-hook-logs', 'codex')
    : path.join(root, '.codex', 'hooks', '.logs');
}

function logCrash(hook, error) {
  try {
    const dir = hookStateDir(PROJECT_ROOT);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'hook-log.jsonl'),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        hook,
        status: 'crash',
        error: String(error?.message || error)
      })}\n`
    );
  } catch {
    // Hook failures remain fail-open unless the hook explicitly denies.
  }
}

module.exports = {
  PROJECT_ROOT,
  atomicWrite,
  getHookContext,
  hookStateDir,
  logCrash,
  readPayload,
  readRuntime,
  assertConfiguredSpecsPath,
  resolveProjectPath,
  resolveSessionCwd
};
