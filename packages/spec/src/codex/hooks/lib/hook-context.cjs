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

/**
 * Plugin root when this hook runs from the Codex plugin tree, else null.
 *
 * Codex exports PLUGIN_ROOT (and CLAUDE_PLUGIN_ROOT) to plugin hooks. An npx-installed
 * hook can inherit those variables from a parent process, so the plugin is recognized
 * only when this file really lives under that root.
 */
function pluginRoot() {
  const declared = process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT;
  if (!declared) return null;
  try {
    const root = fs.realpathSync(declared);
    const self = fs.realpathSync(path.resolve(__dirname, '..', '..'));
    return self === root ? root : null;
  } catch {
    return null;
  }
}

/**
 * Where the plugin keeps state for every repository: PLUGIN_DATA, or a per-user temp
 * directory. The temp directory must be a real 0700 directory this user owns; anything
 * else throws, so privacy decisions fail closed instead of trusting a planted path.
 */
function pluginStateRoot() {
  const data = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA;
  if (data && path.isAbsolute(data)) {
    fs.mkdirSync(data, { recursive: true, mode: 0o700 });
    return fs.realpathSync(data);
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  const dir = path.join(require('os').tmpdir(), `cafekit-codex-plugin-${uid}`);
  try { fs.mkdirSync(dir, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = fs.lstatSync(dir);
  const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
  if (!stat.isDirectory() || stat.isSymbolicLink() || !owned || (stat.mode & 0o077) !== 0) {
    throw new Error(`unsafe CafeKit plugin state directory: ${dir}`);
  }
  return dir;
}

/** Per-repository state directory under the plugin state root. */
function pluginProjectDir(projectRoot, name) {
  const key = crypto.createHash('sha256').update(String(projectRoot)).digest('hex').slice(0, 16);
  return path.join(pluginStateRoot(), 'projects', key, name);
}

/**
 * True when the repository runs CafeKit's own npx-installed Codex hooks: its
 * .codex/hooks.json parses, and every CafeKit launcher in it names a hook script that
 * exists inside this repository. A committed hooks.json from another machine, or a
 * planted file with no real hooks behind it, must not switch the plugin's gates off.
 */
function hasProjectCafekitHooks(projectRoot) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(projectRoot, '.codex', 'hooks.json'), 'utf8'));
    const hooksDir = fs.realpathSync(path.join(projectRoot, '.codex', 'hooks'));
    const commands = Object.values(config?.hooks || {}).flat()
      .flatMap((group) => (Array.isArray(group?.hooks) ? group.hooks : []))
      .map((handler) => String(handler?.command || ''));
    const scripts = commands
      .map((command) => command.match(/'([^']*[/\\]\.codex[/\\]hooks[/\\][a-z0-9-]+\.cjs)'\s*$/)?.[1])
      .filter(Boolean);
    if (scripts.length === 0) return false;
    // The npx launcher names its script by the exact path <realpath(root)>/.codex/hooks.
    // Anything else (a relative path, `..`, a symlinked alias, /proc/self/cwd) can
    // resolve against whatever cwd the hook runs in, so it never counts.
    const expectedDir = path.join(fs.realpathSync(projectRoot), '.codex', 'hooks');
    return scripts.every((script) => {
      if (!path.isAbsolute(script) || path.dirname(script) !== expectedDir) return false;
      try {
        const real = fs.realpathSync(script);
        return path.dirname(real) === hooksDir && fs.statSync(real).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

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

function gitTopLevel(cwd) {
  try {
    const out = require('child_process').execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return out ? fs.realpathSync(out) : cwd;
  } catch {
    return cwd;
  }
}

/**
 * The repository a hook acts on. An npx install sits inside it (PROJECT_ROOT); the plugin
 * lives in a shared cache, so it takes the repository from the payload's cwd. Beside an
 * active npx install the plugin stands down, so one set of gates and one privacy store
 * decide; `onStandDown` lets SessionStart say so once.
 */
function resolveProjectRoot(payload, { onStandDown } = {}) {
  if (!pluginRoot()) return PROJECT_ROOT;
  const root = gitTopLevel(resolveSessionCwd(payload));
  if (hasProjectCafekitHooks(root)) {
    if (typeof onStandDown === 'function') onStandDown(root);
    process.exit(0);
  }
  return root;
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
  const projectRoot = resolveProjectRoot(payload);
  const runtime = readRuntime(projectRoot);
  assertConfiguredSpecsPath(projectRoot, runtime);
  return {
    projectRoot,
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
  if (pluginRoot()) return projectRoot ? pluginProjectDir(projectRoot, 'logs') : path.join(pluginStateRoot(), 'logs');
  const root = projectRoot || PROJECT_ROOT;
  return String(root).includes(`${path.sep}packages${path.sep}spec${path.sep}src`)
    ? path.join(require('os').tmpdir(), 'cafekit-hook-logs', 'codex')
    : path.join(root, '.codex', 'hooks', '.logs');
}

function logCrash(hook, error) {
  try {
    const dir = pluginRoot() ? hookStateDir(null) : hookStateDir(PROJECT_ROOT);
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
  pluginRoot,
  pluginProjectDir,
  resolveProjectRoot,
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
