'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROVENANCE_MODE = 'worktree-sha256-v1';
const CONTEXT_SCHEMA_VERSION = '1';
const trustedContexts = new WeakSet();

class ProvenanceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProvenanceError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProvenanceError(code, message);
}

function valueOf(input, snake, camel) {
  const hasSnake = Object.prototype.hasOwnProperty.call(input, snake);
  const hasCamel = Object.prototype.hasOwnProperty.call(input, camel);
  if (hasSnake && hasCamel && input[snake] !== input[camel]) {
    fail('ambiguous_identity', `${snake} and ${camel} disagree`);
  }
  return hasSnake ? input[snake] : input[camel];
}

function text(value, field) {
  if (typeof value !== 'string' || value.trim() !== value || value === '' || /[\0\r\n]/.test(value)) {
    fail('malformed_input', `${field} must be a non-empty single-line string`);
  }
  return value;
}

function inside(root, candidate, field) {
  const relative = path.relative(root, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail('path_escape', `${field} escapes the project root`);
  }
  return relative;
}

function existingPath(value, field, kind, base = process.cwd()) {
  const requested = text(value, field);
  let canonical;
  try { canonical = fs.realpathSync(path.resolve(base, requested)); } catch (error) {
    fail('path_error', `${field} cannot be canonicalized (${error.code || error.message})`);
  }
  let stat;
  try { stat = fs.lstatSync(canonical); } catch (error) {
    fail('path_error', `${field} cannot be inspected (${error.code || error.message})`);
  }
  if ((kind === 'directory' && !stat.isDirectory()) || (kind === 'file' && !stat.isFile())) {
    fail('malformed_input', `${field} is not a ${kind}`);
  }
  return canonical;
}

function runGit(root, args, label) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0 || result.signal) {
    const detail = result.error?.message || String(result.stderr || '').trim() || `exit ${result.status}`;
    fail('git_command_failed', `${label} failed: ${detail}`);
  }
  if (!Buffer.isBuffer(result.stdout)) fail('malformed_git_output', `${label} did not return bytes`);
  return result.stdout;
}

function decode(value, label) {
  const decoded = value.toString('utf8');
  if (!Buffer.from(decoded, 'utf8').equals(value)) fail('malformed_git_output', `${label} is not valid UTF-8`);
  return decoded;
}

function oneLine(value, label) {
  const output = decode(value, label);
  if (!/^[^\0\r\n]+\n?$/.test(output)) fail('malformed_git_output', `${label} is not a single line`);
  return output.replace(/\n$/, '');
}

function gitBase(root, specsRoot) {
  const specsRelative = path.relative(root, specsRoot).split(path.sep).join('/');
  const sourceHistory = decode(runGit(
    root,
    ['log', '-1', '--format=%H', '--', '.', `:(exclude,literal)${specsRelative}`],
    'git log source base',
  )).trim();
  const roots = sourceHistory ? [] : decode(
    runGit(root, ['rev-list', '--max-parents=0', '--reverse', 'HEAD'], 'git rev-list root'),
    'git rev-list root',
  ).trim().split('\n');
  if (!sourceHistory && (roots.length === 0 || roots.some((rootId) => !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i.test(rootId)))) {
    fail('malformed_git_output', 'git rev-list root did not return commit ids');
  }
  const output = (sourceHistory || roots[0]).toLowerCase();
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(output)) fail('malformed_git_output', 'git source base did not return a commit id');
  return output;
}

function gitRoot(requested) {
  const input = existingPath(requested, 'projectRoot', 'directory');
  const reported = oneLine(runGit(input, ['rev-parse', '--show-toplevel'], 'git rev-parse --show-toplevel'));
  const root = existingPath(reported, 'git project root', 'directory');
  inside(root, input, 'projectRoot');
  return root;
}

function splitNul(bytes, label) {
  if (bytes.length && bytes[bytes.length - 1] !== 0) fail('malformed_git_output', `${label} is not NUL terminated`);
  return bytes.length === 0 ? [] : bytes.subarray(0, -1).toString('binary').split('\0').map((entry) => {
    const raw = Buffer.from(entry, 'binary');
    return decode(raw, label);
  });
}

function pathKey(root, relative, label) {
  if (typeof relative !== 'string' || relative === '' || relative.includes('\0') || path.posix.isAbsolute(relative)) {
    fail('malformed_git_output', `${label} contains an invalid path`);
  }
  const normalized = path.sep === '\\' ? relative.replaceAll('\\', '/') : relative;
  if (normalized.split('/').includes('..')) fail('path_escape', `${label} escapes the project root`);
  const absolute = path.resolve(root, ...normalized.split('/'));
  inside(root, absolute, label);
  return { relative: normalized, absolute };
}

function parseStatus(bytes) {
  const values = splitNul(bytes, 'git status');
  const entries = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.length < 4 || value[2] !== ' ') fail('malformed_git_output', 'git status emitted an invalid porcelain record');
    const xy = value.slice(0, 2);
    const first = value.slice(3);
    if (xy.includes('R') || xy.includes('C')) {
      const next = values[++index];
      if (!next) fail('malformed_git_output', 'git status rename record is incomplete');
      entries.set(first, { xy, role: 'rename-source', counterpart: next });
      entries.set(next, { xy, role: 'rename-target', counterpart: first });
    } else {
      entries.set(first, { xy, role: xy === '??' || xy === '!!' ? 'untracked' : 'tracked' });
    }
  }
  return entries;
}

// Generated runtime state, not source evidence. Shared with the receipt binding
// selector so the gate's own cache writes cannot be read as a dirty worktree.
const RUNTIME_STATE_ROOTS = Object.freeze([
  '.git', 'node_modules',
  '.claude/hooks/.logs', '.codex/hooks/.logs', '.omp/hooks/.logs',
  '.claude/.logs', '.codex/.logs', '.omp/.logs',
  '.claude/runtime.json', '.codex/runtime.json', '.omp/runtime.json',
]);

function excluded(root, absolute, specsRoot) {
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  const specsRelative = path.relative(root, specsRoot);
  // These roots are generated runtime state, not source evidence. The selected
  // canonical specs root is excluded above to avoid receipt/state recursion.
  const roots = RUNTIME_STATE_ROOTS;
  if (relative === specsRelative || relative.startsWith(`${specsRelative}/`)) return true;
  return roots.some((entry) => relative === entry || relative.startsWith(`${entry}/`));
}

function manifest(root, specsRoot) {
  const statuses = parseStatus(runGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 'git status'));
  const tracked = [
    ...splitNul(runGit(root, ['ls-files', '-z', '--cached'], 'git ls-files'), 'git ls-files'),
    ...splitNul(runGit(root, ['ls-tree', '-r', '-z', '--name-only', 'HEAD'], 'git ls-tree'), 'git ls-tree'),
    ...statuses.keys(),
  ];
  const paths = [...new Set(tracked)].map((entry) => pathKey(root, entry, 'worktree path'))
    .filter(({ absolute }) => !excluded(root, absolute, specsRoot))
    .sort((left, right) => left.relative < right.relative ? -1 : left.relative > right.relative ? 1 : 0);
  const unique = new Map(paths.map((entry) => [entry.relative, entry]));
  const records = [];
  for (const { relative, absolute } of unique.values()) {
    let before;
    try { before = fs.lstatSync(absolute); } catch (error) {
      if (error.code === 'ENOENT') { records.push({ path: relative, type: 'deleted', mode: '0000', status: statuses.get(relative) || null, content: null }); continue; }
      fail('path_error', `cannot inspect ${relative} (${error.code || error.message})`);
    }
    const mode = (before.mode & 0o7777).toString(8).padStart(4, '0');
    let content;
    let type = 'file';
    if (before.isSymbolicLink()) { type = 'symlink'; content = Buffer.from(fs.readlinkSync(absolute), 'utf8'); }
    else if (before.isFile()) { content = fs.readFileSync(absolute); }
    else { type = before.isDirectory() ? 'directory' : 'special'; content = Buffer.alloc(0); }
    let after;
    try { after = fs.lstatSync(absolute); } catch { fail('worktree_race', `${relative} changed during provenance capture`); }
    if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.mode !== after.mode) {
      fail('worktree_race', `${relative} changed during provenance capture`);
    }
    records.push({ path: relative, type, mode, status: statuses.get(relative) || null, content: content.toString('base64') });
  }
  return { status: [...statuses.entries()], records };
}

function manifestDigest(snapshot) {
  const hash = crypto.createHash('sha256');
  hash.update('cafekit-provenance\0');
  for (const record of snapshot.records) hash.update(`${JSON.stringify(record)}\n`);
  return hash.digest('hex');
}

function identity(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('malformed_input', 'runtime provenance input must be an object');
  const root = gitRoot(valueOf(input, 'project_root', 'projectRoot'));
  const specsRoot = existingPath(valueOf(input, 'specs_root', 'specsRoot'), 'specsRoot', 'directory', root);
  inside(root, specsRoot, 'specsRoot');
  if (specsRoot === root) fail('ambiguous_identity', 'specsRoot must be a distinct project subdirectory');
  const specFile = existingPath(valueOf(input, 'spec_file', 'specFile'), 'specFile', 'file', root);
  inside(specsRoot, specFile, 'specFile');
  const feature = text(valueOf(input, 'feature_name', 'featureName'), 'feature_name');
  if (feature.includes('/') || feature.includes('\\') || feature === '.' || feature === '..') fail('ambiguous_identity', 'feature_name must be one path segment');
  const featureDir = existingPath(path.join(specsRoot, feature), 'feature directory', 'directory');
  if (path.dirname(specFile) !== featureDir) fail('ambiguous_identity', 'feature_name does not identify the selected spec file');
  const session = text(valueOf(input, 'runtime_session', 'runtimeSession'), 'runtime_session');
  const requestedMode = valueOf(input, 'provenance_mode', 'provenanceMode');
  const mode = requestedMode === undefined ? PROVENANCE_MODE : text(requestedMode, 'provenance_mode');
  if (mode !== PROVENANCE_MODE) fail('malformed_input', `unsupported provenance mode: ${mode}`);
  return { root, specsRoot, specFile, feature, session, mode };
}

function deriveRuntimeProvenance(input) {
  const current = identity(input);
  const base = gitBase(current.root, current.specsRoot);
  const first = manifest(current.root, current.specsRoot);
  const head = manifestDigest(first);
  const second = manifest(current.root, current.specsRoot);
  if (JSON.stringify(first) !== JSON.stringify(second) || gitBase(current.root, current.specsRoot) !== base) fail('worktree_race', 'checkout changed during provenance capture');
  const stable = {
    schema_version: CONTEXT_SCHEMA_VERSION,
    project_root: current.root,
    specs_root: current.specsRoot,
    spec_file: current.specFile,
    feature_name: current.feature,
    runtime_session: current.session,
    provenance_mode: current.mode,
    Base: base,
    Head: head,
  };
  const contextId = crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
  const context = Object.freeze({
    ...stable,
    base,
    head,
    context_id: contextId,
    contextId,
    expected_provenance: Object.freeze({ base, head }),
  });
  trustedContexts.add(context);
  return context;
}

function isTrustedRuntimeContext(value) {
  return Boolean(value && typeof value === 'object' && trustedContexts.has(value));
}

function recomputeRuntimeProvenance(value) {
  if (!isTrustedRuntimeContext(value)) fail('untrusted_context', 'runtime provenance context was not derived by the runtime helper');
  return deriveRuntimeProvenance({
    projectRoot: value.project_root,
    specsRoot: value.specs_root,
    specFile: value.spec_file,
    featureName: value.feature_name,
    runtimeSession: value.runtime_session,
    provenanceMode: value.provenance_mode,
  });
}

function createReceiptBinding(value) {
  const context = recomputeRuntimeProvenance(value);
  const binding = Object.freeze({
    expectedProvenance: Object.freeze({ base: context.base, head: context.head }),
    requireProvenanceBinding: true,
    runtimeContext: context,
    contextId: context.context_id,
  });
  return binding;
}

function parseArgs(argv) {
  const result = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') result.json = true;
    else if (arg === '--project-root') result.projectRoot = argv[++index];
    else if (arg === '--specs-root') result.specsRoot = argv[++index];
    else if (arg === '--spec-file') result.specFile = argv[++index];
    else if (arg === '--feature-name') result.featureName = argv[++index];
    else if (arg === '--runtime-session' || arg === '--session') result.runtimeSession = argv[++index];
    else if (arg === '--provenance-mode') result.provenanceMode = argv[++index];
    else fail('malformed_input', `unknown option: ${arg}`);
  }
  return result;
}

function runCli(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
    const context = deriveRuntimeProvenance(options);
    const output = { ok: true, context, Base: context.base, Head: context.head, context_id: context.context_id };
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return 0;
  } catch (error) {
    const output = { ok: false, error: { code: error.code || 'provenance_failed', message: error.message } };
    if (options?.json) process.stdout.write(`${JSON.stringify(output)}\n`);
    else process.stderr.write(`${output.error.code}: ${output.error.message}\n`);
    return 2;
  }
}

if (require.main === module) process.exitCode = runCli();

module.exports = {
  RUNTIME_STATE_ROOTS,
  CONTEXT_SCHEMA_VERSION,
  PROVENANCE_MODE,
  ProvenanceError,
  createReceiptBinding,
  deriveRuntimeContext: deriveRuntimeProvenance,
  deriveRuntimeProvenance,
  isTrustedRuntimeContext,
  recomputeRuntimeContext: recomputeRuntimeProvenance,
  recomputeRuntimeProvenance,
  runCli,
};
