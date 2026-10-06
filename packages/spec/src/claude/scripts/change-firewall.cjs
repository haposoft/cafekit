'use strict';

// D1 change-firewall gate (owner R0-01). Exports the exact named surface D1
// requires: loadBaselineAuthority, assertBaselineUsable, bootstrapBaseline,
// advanceBaseline, deriveProtectedChangedPaths, computeProtectedTreeDigest,
// computeProposalDigest, computeCandidateDigest, assertHotspotChangeAllowed,
// createFreezeManifest, verifyFreezeManifest, invalidateFreeze,
// NO_CHANGE_ATTESTATION_DIGEST, plus the C15 BenchmarkFailureLedger surface
// (loadFailureLedger, assertFailureLedgerUsable, openFailure, classifyFailure,
// reclassifyFailure, resolveFailure, computeFailureLedgerDigest,
// deriveFailureState, NO_FAILURES_ATTESTATION_DIGEST) this same module owns.
//
// Production callers never get a per-call path override (I13/I19): the plain
// top-level exports are bound to this checkout's own real project root
// (resolved via git from this file's own location, never process.cwd()).
// `createChangeFirewall({ root })` exists only so a test/harness can construct
// an isolated instance bound to a different, once-verified trusted root.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DIGEST = require('./spec-authoring-digest.cjs');
const { asciiOrdinalCompare, stableJson } = DIGEST;

let VALIDATOR = null;
function validatorModule() {
  if (!VALIDATOR) VALIDATOR = require('./validate-spec-output.cjs');
  return VALIDATOR;
}

const SCHEMA_VERSION = '1';

const REL = {
  releaseBaseline: 'packages/spec/benchmarks/release-baseline.json',
  ledger: 'packages/spec/benchmarks/benchmark-failure-ledger.json',
  freeze: 'packages/spec/.cafekit-release/change-firewall-freeze.json',
  receipt: 'packages/spec/.cafekit-release/release-receipt.json',
  legacyBridge: 'specs/archive/cafekit-semantic-eval-firewall/reports/bootstrap-legacy-bridge-review.json',
  cafekitReleaseDir: 'packages/spec/.cafekit-release/',
  packageJson: 'packages/spec/package.json',
};

const PROTECTED_FILE_PATHS = new Set([
  'packages/spec/bin/phases/copy-payload.js',
  'packages/spec/package.json',
  'packages/spec/.gitignore',
]);

const PROTECTED_DIR_PREFIXES = [
  'packages/spec/src/claude/scripts/',
  'packages/spec/src/claude/skills/specs/',
  'packages/spec/scripts/',
  'packages/spec/benchmarks/',
  'packages/spec/bin/__tests__/',
];

const RESERVED_PATHS = new Set([REL.releaseBaseline, REL.ledger]);

const FAILURE_CLASSES = [
  'framework_regression', 'model_runtime_error', 'prompt_ambiguity',
  'domain_research_failure', 'infrastructure', 'oracle_defect', 'mixed', 'unknown',
];

const OWNER_LAYERS = [
  'authoring_kernel', 'structural_compiler', 'semantic_reviewer',
  'readiness_finalizer', 'benchmark_controller', 'independent_adjudicator', 'release_process',
];

const CANDIDATE_DIGEST_FIELDS = [
  'baselineAuthorityDigest', 'baselineGeneration', 'baselineCommit',
  'failureLedgerDigest', 'failureLedgerGeneration', 'remediatedFailureIds',
  'changedPaths', 'treeDigest', 'proposalDigest', 'packageVersion',
];

const RELEASE_RECEIPT_FIELDS = [
  'schema_version', 'receipt_id', 'status', 'baselineAuthorityDigest', 'baselineGeneration',
  'freezeDigest', 'candidateDigest', 'treeDigest', 'packageVersion', 'releaseCommit',
  'artifactPath', 'artifactDigest', 'resolvedFailureIds',
];

const NO_CHANGE_ATTESTATION_DIGEST = `sha256:${crypto.createHash('sha256').update('cafekit:no-protected-change:v1').digest('hex')}`;
const NO_FAILURES_ATTESTATION_DIGEST = `sha256:${crypto.createHash('sha256').update('cafekit:no-open-failures:v1').digest('hex')}`;

class ChangeFirewallError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ChangeFirewallError';
    this.code = code;
  }
}
function fail(code, message) { throw new ChangeFirewallError(code, message); }

// ---------------------------------------------------------------------------
// generic helpers
// ---------------------------------------------------------------------------

function sha256Hex(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function sha256Tag(bytes) { return `sha256:${sha256Hex(bytes)}`; }
function isSha256Tag(value) { return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value); }
function isCommitId(value) { return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value); }
function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

function exactKeys(value, keys) {
  return plain(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function hasOnlyKeys(value, required, optional = []) {
  if (!plain(value)) return false;
  const keys = Object.keys(value);
  if (!required.every((key) => keys.includes(key))) return false;
  const allowed = new Set([...required, ...optional]);
  return keys.every((key) => allowed.has(key));
}

function sortedUnique(list) { return [...new Set(list)].sort(asciiOrdinalCompare); }

function isSortedUniqueArray(value, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return allowEmpty;
  if (value.some((entry) => typeof entry !== 'string' || entry === '')) return false;
  for (let index = 1; index < value.length; index += 1) {
    if (!(value[index - 1] < value[index])) return false;
  }
  return true;
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry !== '');
}

// ---------------------------------------------------------------------------
// git helpers
// ---------------------------------------------------------------------------

function runGit(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || String(result.stderr || '').trim() || `exit ${result.status}`;
    fail('git_command_failed', `git ${args.join(' ')} failed: ${detail}`);
  }
  return result.stdout;
}

function runGitBytes(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || (Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : '').trim() || `exit ${result.status}`;
    fail('git_command_failed', `git ${args.join(' ')} failed: ${detail}`);
  }
  return result.stdout;
}

function tryGitBytes(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

function splitNul(buffer) {
  if (buffer.length === 0) return [];
  const trimmed = buffer[buffer.length - 1] === 0 ? buffer.subarray(0, -1) : buffer;
  return trimmed.length === 0 ? [] : trimmed.toString('utf8').split('\0');
}

function gitHeadCommit(root) {
  const out = runGit(root, ['rev-parse', 'HEAD']).trim();
  if (!isCommitId(out)) fail('malformed_git_output', 'git rev-parse HEAD did not return a commit id');
  return out;
}

function isRealCommit(root, sha) {
  if (!isCommitId(sha)) return false;
  const result = spawnSync('git', ['-C', root, 'cat-file', '-e', `${sha}^{commit}`]);
  return result.status === 0;
}

function isAncestorOrEqual(root, ancestor, descendant) {
  if (!isRealCommit(root, descendant)) return false;
  if (ancestor === descendant) return isRealCommit(root, ancestor);
  if (!isRealCommit(root, ancestor)) return false;
  const result = spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', ancestor, descendant]);
  return result.status === 0;
}

function gitHeadFileBytes(root, relativePath) {
  return tryGitBytes(root, ['show', `HEAD:${relativePath}`]);
}

function tryParseJson(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
}

// true/false when git can answer definitively; null when the check itself is
// ambiguous (spawn error, non-zero exit, or an unrecognized answer). Callers
// must treat null exactly like "shallow" -- fail closed, never silently
// assume a full clone just because the shallow probe itself misbehaved.
function isShallowRepository(root) {
  const result = spawnSync('git', ['-C', root, 'rev-parse', '--is-shallow-repository'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const value = result.stdout.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

// Fail-closed reader for the ordered (oldest -> newest) committed snapshots
// of relativePath -- the shared foundation both C10 authority and C15 ledger
// provenance build on. The shallow/ambiguity probe runs *first*, unconditionally
// -- before any "no history" trust can ever be granted, not merely once a
// current blob happens to exist -- because a truncated or unanswerable clone
// can hide real prior history for a path that currently looks absent just as
// easily as it can hide the true genesis of a path that currently looks
// present. { ok: true, snapshots: [] } (trusted, matching C10's own case (2),
// "uncommitted... trusted... without requiring a git commit first") is
// returned only when a full, non-shallow `git log` query itself *succeeds*
// and independently proves zero commits ever touched this path, *and* HEAD
// currently has no blob for it -- both facts must agree. If committed
// history exists for this path but HEAD's tree currently has no blob for it,
// that is a committed deletion: no named transition ever deletes or renames
// this file, so a git-rm'd-then-recommitted (or renamed-away) reserved
// control-plane path is itself an out-of-band edit, not a fresh "never
// committed" genesis for whatever gets written in its place -- fail closed.
// Any other ambiguity -- a failed or non-zero `git log`/`git show`, or a
// commit whose blob cannot be read -- is reported as { ok: false } rather
// than silently treated as "nothing committed" or "this is genesis". That
// silent fallback is exactly how a shallow clone, a transient git failure, or
// a delete-then-recreate could smuggle a tampered/laundered snapshot past
// provenance as a false, unprovable trust root.
function readCommittedSnapshots(root, relativePath) {
  if (isShallowRepository(root) !== false) return { ok: false }; // true or null (ambiguous): fail closed
  const logResult = spawnSync('git', ['-C', root, 'log', '--format=%H', '--', relativePath], { encoding: 'utf8' });
  if (logResult.error || logResult.status !== 0) return { ok: false };
  const commits = logResult.stdout.split('\n').map((line) => line.trim()).filter(Boolean).reverse(); // oldest first
  const headBytes = gitHeadFileBytes(root, relativePath);
  if (commits.length === 0) {
    if (headBytes !== null) return { ok: false }; // HEAD has a blob `git log` never saw: ambiguous, fail closed
    return { ok: true, snapshots: [] }; // full history independently proves this path never appeared: trusted
  }
  if (headBytes === null) return { ok: false }; // committed history exists but HEAD has no blob: committed deletion
  const snapshots = [];
  for (const hash of commits) {
    const bytes = tryGitBytes(root, ['show', `${hash}:${relativePath}`]);
    if (bytes === null) return { ok: false };
    snapshots.push({ hash, bytes });
  }
  return { ok: true, snapshots };
}

// Honest-agent-only provenance (C10/C15, not a defense against a privileged
// history-rewriting insider). Validates the *entire* committed-then-current
// chain for a control-plane record against one shared generation rule --
// every adjacent pair, including every committed-to-committed pair, not
// merely a last-commit-vs-current hop: a same-generation in-place rewrite
// that itself got committed (and later buried under unrelated commits) is
// caught here even though it is no longer the most recent commit, which a
// check comparing only "current" against "the last commit" could never see
// once that rewrite stopped being the most recent one.
//
// The exact rule (design.md C10, "an out-of-band edit": generation must equal
// priorGeneration + 1, or the load rejects): once a committed predecessor
// exists for this path, every content-changing pair -- committed-to-committed
// or committed-to-current alike -- must advance generation by *exactly* one,
// and the later record's own previousDigest must hash the immediately prior
// bytes exactly. There is no generation-jump exemption: a named transition
// always writes priorGeneration+1 relative to whatever it itself loaded as
// current, so a real generation gap against the last *committed* snapshot can
// only mean an intervening uncommitted transition was never independently
// verified against that committed predecessor before a later one overwrote
// it -- exactly the gap assertCandidateProvenance (called by every named
// writer before it mutates anything) exists to close. The only trusted case
// with no such constraint is case (2) of C10's own load rules: no committed
// predecessor exists at all yet, so whatever is currently on disk -- however
// many uncommitted transitions produced it -- is trusted as first-ever state.
// parseSnapshot turns raw committed bytes into a validated record (or null
// on a malformed historic snapshot, itself fail-closed); verifyPair, when
// supplied, checks each caller-owned structural invariant across every
// adjacent pair (C10 legal state order; C15 append-only event prefix).
function verifyProvenanceChain(root, relativePath, {
  currentBytes, currentRecord, parseSnapshot, getGeneration, getPreviousDigest, verifyPair, label,
}) {
  const read = readCommittedSnapshots(root, relativePath);
  if (!read.ok) {
    fail('out_of_band_edit', `${label} committed history could not be independently established (a shallow clone or an unreadable git history)`);
  }
  const chain = read.snapshots.map((snapshot) => {
    const record = parseSnapshot(snapshot.bytes);
    if (!record) fail('out_of_band_edit', `${label} has a committed snapshot that fails its exact schema`);
    return { bytes: snapshot.bytes, record };
  });
  chain.push({ bytes: currentBytes, record: currentRecord });

  for (let index = 1; index < chain.length; index += 1) {
    const prev = chain[index - 1];
    const curr = chain[index];
    if (prev.bytes.equals(curr.bytes)) continue; // unchanged at this hop: nothing to verify
    const prevGeneration = getGeneration(prev.record);
    const currGeneration = getGeneration(curr.record);
    if (currGeneration !== prevGeneration + 1) {
      fail('out_of_band_edit', `${label} generation does not advance by exactly one from its committed predecessor`);
    }
    if (getPreviousDigest(curr.record) !== sha256Tag(prev.bytes)) {
      fail('out_of_band_edit', `${label} previousDigest does not hash the immediately prior committed bytes`);
    }
    if (verifyPair) verifyPair(prev.record, curr.record);
  }
}

// ---------------------------------------------------------------------------
// root resolution (I13/I19: production calls never take a per-call override)
// ---------------------------------------------------------------------------

function resolveTrustedRoot(requestedRoot) {
  const rawRoot = requestedRoot ? path.resolve(requestedRoot) : resolveGitRootFromHere();
  const canonical = fs.realpathSync(rawRoot);
  const stat = fs.lstatSync(canonical);
  if (!stat.isDirectory()) fail('malformed_input', 'trusted root must be a directory');
  return canonical;
}

function resolveGitRootFromHere() {
  const result = spawnSync('git', ['-C', __dirname, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    fail('root_resolution_failed', 'cannot resolve the canonical project root via git from this source checkout');
  }
  return result.stdout.trim();
}

function absPath(root, relativePath) {
  return path.join(root, ...relativePath.split('/'));
}

// ---------------------------------------------------------------------------
// D1 protected-path allowlist
// ---------------------------------------------------------------------------

function isExcludedPath(relativePath) {
  return relativePath === REL.cafekitReleaseDir.replace(/\/$/, '') || relativePath.startsWith(REL.cafekitReleaseDir);
}

function isReservedPath(relativePath) {
  return RESERVED_PATHS.has(relativePath);
}

function isProtectedPath(relativePath) {
  if (isExcludedPath(relativePath)) return false;
  if (isReservedPath(relativePath)) return false; // reserved-path exclusion precedes the prefix match (D1)
  if (PROTECTED_FILE_PATHS.has(relativePath)) return true;
  return PROTECTED_DIR_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// atomic writes
// ---------------------------------------------------------------------------

function atomicWriteBytes(absoluteTarget, bytes) {
  fs.mkdirSync(path.dirname(absoluteTarget), { recursive: true });
  const tmp = path.join(
    path.dirname(absoluteTarget),
    `.${path.basename(absoluteTarget)}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
  );
  const fd = fs.openSync(tmp, 'wx', 0o644);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, absoluteTarget);
}

// Sole canonical JSON-record byte serialization (D13-adjacent: one shared
// primitive, never a per-writer reimplementation). Every C10/C15 named
// writer computes its candidate's bytes through this exact function once,
// then reuses those same bytes both to validate the candidate's provenance
// and to perform the atomic write -- there is never a second, independently
// re-serialized copy that could drift from what actually gets persisted.
function jsonRecordBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function atomicWriteJson(absoluteTarget, value) {
  atomicWriteBytes(absoluteTarget, jsonRecordBytes(value));
}

function readJsonFileIfExists(root, relativePath) {
  const absolute = absPath(root, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('malformed_input', `${relativePath} must be a regular non-symlink file`);
  const bytes = fs.readFileSync(absolute);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail('malformed_json', `${relativePath} is not valid JSON (${error.message})`);
  }
  return { bytes, parsed };
}

// Tolerant variant for the one place a corrupt-or-missing file is itself an
// expected, recoverable state rather than a fatal error: advanceBaseline's
// idempotency check (I11 1a/1b) and resolveFailure's independent receipt read
// (I13) must be able to distinguish "no usable canonical evidence" (missing,
// unreadable, or malformed bytes) from a hard error, so they can apply their
// own specific repair/refuse semantics instead of an uncaught crash.
function tryReadJsonFile(root, relativePath) {
  try {
    return readJsonFileIfExists(root, relativePath);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// deriveProtectedChangedPaths / computeProtectedTreeDigest (D1, R1.3, R1.5)
// ---------------------------------------------------------------------------

// No --diff-filter: an allowlist of change statuses (the prior
// A(dded)/C(opied)/D(eleted)/M(odified)/R(enamed) set) is exactly the kind of
// brittle enumeration that silently stops covering a real git status it never
// anticipated -- it omitted T (type-changed, e.g. a protected regular file
// swapped for a symlink to the same path) and U (unmerged), either of which
// would let a protected-path change escape D1 detection entirely rather than
// merely being classified oddly. Every change status git diff can report
// must surface here; isProtectedPath below still gates which *paths* count.
function gitChangedPathsRaw(root, baselineCommit, headCommit) {
  const diffArgs = headCommit
    ? ['diff', '--name-only', '-z', baselineCommit, headCommit]
    : ['diff', '--name-only', '-z', baselineCommit];
  const tracked = splitNul(runGitBytes(root, diffArgs));
  const untracked = splitNul(runGitBytes(root, ['ls-files', '-z', '--others', '--exclude-standard']));
  return [...tracked, ...untracked];
}

// Self-derives protected changed paths from a git diff (never a caller-supplied
// changedPaths substitute): baselineCommit vs the working tree for a routine
// freeze, or baselineCommit..headCommit for the one-time C14 bootstrap diff.
function deriveProtectedChangedPaths(root, baselineCommit, options = {}) {
  if (!isCommitId(baselineCommit)) fail('malformed_input', 'baselineCommit must be a full git commit object id');
  const headCommit = options.headCommit;
  if (headCommit !== undefined && !isCommitId(headCommit)) fail('malformed_input', 'headCommit must be a full git commit object id');
  const raw = gitChangedPathsRaw(root, baselineCommit, headCommit);
  const protectedPaths = raw.filter((entry) => entry && isProtectedPath(entry));
  return sortedUnique(protectedPaths);
}

function readWorktreeEntry(root, relativePath) {
  const absolute = absPath(root, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    if (error.code === 'ENOENT') return { type: 'deleted', mode: '0000', content: Buffer.alloc(0) };
    throw error;
  }
  if (stat.isSymbolicLink()) return { type: 'symlink', mode: '0000', content: Buffer.from(fs.readlinkSync(absolute), 'utf8') };
  if (stat.isFile()) return { type: 'file', mode: (stat.mode & 0o7777).toString(8).padStart(4, '0'), content: fs.readFileSync(absolute) };
  if (stat.isDirectory()) return { type: 'directory', mode: '0000', content: Buffer.alloc(0) };
  return { type: 'other', mode: '0000', content: Buffer.alloc(0) };
}

function readGitTreeEntry(root, ref, relativePath) {
  const output = runGit(root, ['ls-tree', ref, '--', relativePath]);
  const line = output.split('\n').find(Boolean);
  if (!line) return { type: 'deleted', mode: '0000', content: Buffer.alloc(0) };
  const match = line.match(/^([0-7]+) (blob|tree|commit) ([0-9a-f]+)\t/);
  if (!match) fail('malformed_git_output', 'git ls-tree emitted an unrecognized entry');
  const [, gitMode, objectType, sha] = match;
  if (objectType !== 'blob') return { type: 'other', mode: '0000', content: Buffer.alloc(0) };
  const isSymlink = gitMode === '120000';
  const content = runGitBytes(root, ['cat-file', 'blob', sha]);
  return { type: isSymlink ? 'symlink' : 'file', mode: isSymlink ? '0000' : gitMode.slice(-4), content };
}

// Hashes sorted protected paths with type, mode, and content or a delete
// sentinel (R1.5). With options.ref, reads each path from that git ref
// (bootstrap-time, over a committed baseCommit); otherwise reads the current
// working tree (routine freeze-time, over the proposed candidate state).
function computeProtectedTreeDigest(root, protectedPaths, options = {}) {
  const sorted = sortedUnique(protectedPaths);
  const hash = crypto.createHash('sha256');
  hash.update('cafekit-protected-tree-v1\n');
  for (const relativePath of sorted) {
    const entry = options.ref ? readGitTreeEntry(root, options.ref, relativePath) : readWorktreeEntry(root, relativePath);
    hash.update(`${relativePath}\n${entry.type}\n${entry.mode}\n`);
    hash.update(entry.type === 'deleted' ? Buffer.from('DELETED') : entry.content);
    hash.update('\n');
  }
  return `sha256:${hash.digest('hex')}`;
}

function computeProposalDigest(proposal) {
  if (proposal === null || proposal === undefined) return NO_CHANGE_ATTESTATION_DIGEST;
  return sha256Tag(Buffer.from(stableJson(proposal), 'utf8'));
}

function computeCandidateDigest(fields) {
  if (!plain(fields)) fail('malformed_input', 'candidate digest fields must be an object');
  const missing = CANDIDATE_DIGEST_FIELDS.filter((key) => !Object.prototype.hasOwnProperty.call(fields, key));
  if (missing.length) fail('malformed_input', `candidate digest missing fields: ${missing.join(', ')}`);
  const extra = Object.keys(fields).filter((key) => !CANDIDATE_DIGEST_FIELDS.includes(key));
  if (extra.length) fail('malformed_input', `candidate digest received unexpected fields: ${extra.join(', ')}`);
  const bound = {};
  for (const key of CANDIDATE_DIGEST_FIELDS) bound[key] = fields[key];
  return sha256Tag(Buffer.from(stableJson(bound), 'utf8'));
}

// ---------------------------------------------------------------------------
// C10 ReleaseBaselineAuthority
// ---------------------------------------------------------------------------

function validateBootstrapRecordShape(record) {
  if (!exactKeys(record, ['state', 'generation', 'baselineCommit', 'baselinePackageVersion', 'bootstrapReviewDigest', 'previousBaselineDigest'])) return false;
  if (record.state !== 'bootstrap') return false;
  if (record.generation !== 0) return false;
  if (!isCommitId(record.baselineCommit)) return false;
  if (typeof record.baselinePackageVersion !== 'string' || !record.baselinePackageVersion) return false;
  if (!isSha256Tag(record.bootstrapReviewDigest)) return false;
  if (record.previousBaselineDigest !== null) return false;
  return true;
}

function validateReleasedRecordShape(record) {
  if (!plain(record) || record.state !== 'released') return false;
  const hasCandidate = Object.prototype.hasOwnProperty.call(record, 'releasedCandidateDigest');
  const hasReceipt = Object.prototype.hasOwnProperty.call(record, 'releaseReceiptDigest');
  if (hasCandidate === hasReceipt) return false; // exactly one required
  const expected = [
    'state', 'generation', 'baselineCommit', 'baselinePackageVersion', 'previousBaselineDigest',
    hasCandidate ? 'releasedCandidateDigest' : 'releaseReceiptDigest',
  ];
  if (!exactKeys(record, expected)) return false;
  if (!Number.isInteger(record.generation) || record.generation < 1) return false;
  if (!isCommitId(record.baselineCommit)) return false;
  if (typeof record.baselinePackageVersion !== 'string' || !record.baselinePackageVersion) return false;
  if (!isSha256Tag(record.previousBaselineDigest)) return false;
  if (hasCandidate && !isSha256Tag(record.releasedCandidateDigest)) return false;
  if (hasReceipt && !isSha256Tag(record.releaseReceiptDigest)) return false;
  return true;
}

function loadBaselineAuthority(root) {
  const loaded = readJsonFileIfExists(root, REL.releaseBaseline);
  if (!loaded) return { state: 'absent' };
  const { bytes, parsed } = loaded;
  if (!plain(parsed) || typeof parsed.state !== 'string') fail('malformed_authority', 'release-baseline.json is not a recognized C10 record');
  if (parsed.state === 'bootstrap') {
    if (!validateBootstrapRecordShape(parsed)) fail('malformed_authority', 'release-baseline.json bootstrap record fails the exact C10 schema');
    return { state: 'bootstrap', record: parsed, bytes, digest: sha256Tag(bytes) };
  }
  if (parsed.state === 'released') {
    if (!validateReleasedRecordShape(parsed)) fail('malformed_authority', 'release-baseline.json released record fails the exact C10 schema');
    return { state: 'released', record: parsed, bytes, digest: sha256Tag(bytes) };
  }
  fail('malformed_authority', 'release-baseline.json state must be bootstrap or released');
}

// Turns raw committed bytes into a validated C10 record (or null on a
// malformed/unrecognized historic snapshot) -- reuses the exact same shape
// validators loadBaselineAuthority applies to the live file, so a historic
// commit is held to the identical schema, never a looser "unknown" reading.
function parseBaselineSnapshot(bytes) {
  const parsed = tryParseJson(bytes);
  if (!plain(parsed) || typeof parsed.state !== 'string') return null;
  if (parsed.state === 'bootstrap') return validateBootstrapRecordShape(parsed) ? parsed : null;
  if (parsed.state === 'released') return validateReleasedRecordShape(parsed) ? parsed : null;
  return null;
}

// C10's own legal transition: bootstrap may become released (advanceBaseline,
// once); released may only ever advance to another released generation.
// released regressing back to bootstrap is never legitimate -- explicit here
// even though the schema already makes it unreachable in practice (bootstrap
// is always generation 0, so a released->bootstrap pair is already caught by
// verifyProvenanceChain's own generation-must-advance rule first) -- keeping
// the rule named and checked directly, not merely an emergent side effect.
function verifyBaselineStateOrder(prevRecord, currRecord) {
  if (prevRecord.state === 'released' && currRecord.state === 'bootstrap') {
    fail('out_of_band_edit', 'release-baseline.json regresses from released back to bootstrap');
  }
}

// Shared per-call options for every release-baseline.json provenance check
// (live-state validation and pre-write candidate validation alike) -- one
// definition, so C10's parse/generation/digest/state-order rules can never
// drift between the two call sites.
const BASELINE_PROVENANCE_OPTIONS = {
  parseSnapshot: parseBaselineSnapshot,
  getGeneration: (record) => record.generation,
  getPreviousDigest: (record) => record.previousBaselineDigest,
  verifyPair: verifyBaselineStateOrder,
  label: 'release-baseline.json',
};

// Honest-agent-only provenance (C10, not a defense against a privileged
// history-rewriting insider): the shared verifyProvenanceChain walks every
// committed snapshot of release-baseline.json plus the live (possibly
// uncommitted) current record, requiring each path-changing hop to move
// generation by *exactly* one and, on that hop, to hash the immediately
// prior committed bytes exactly -- catching a same-generation in-place
// rewrite (bootstrap or released alike) even once it is no longer the most
// recent commit. Case (2) is the only exemption: no committed predecessor
// exists at all yet, so whatever is currently on disk is trusted as
// first-ever state without requiring a git commit first.
function verifyAuthorityProvenance(root, loaded) {
  verifyProvenanceChain(root, REL.releaseBaseline, {
    ...BASELINE_PROVENANCE_OPTIONS,
    currentBytes: loaded.bytes,
    currentRecord: loaded.record,
  });
}

// Validates a prospective (not-yet-written) C10 candidate against the exact
// same rule, before any mutation happens: a second uncommitted named
// transition relative to the same committed predecessor jumps generation by
// more than one and is rejected *here*, leaving the file's bytes exactly as
// the last valid transition left them, rather than writing a state that only
// the next load would reject. Returns the candidate's serialized bytes (via
// the sole canonical jsonRecordBytes) so the caller reuses them verbatim for
// the atomic write -- no second, independent serialization.
function verifyBaselineCandidate(root, candidateRecord) {
  const candidateBytes = jsonRecordBytes(candidateRecord);
  verifyProvenanceChain(root, REL.releaseBaseline, {
    ...BASELINE_PROVENANCE_OPTIONS,
    currentBytes: candidateBytes,
    currentRecord: candidateRecord,
  });
  return candidateBytes;
}

// R1.3 (design.md Errors and Recovery: "Caller base override | exit 2 | no
// accept"): no function in this module ever accepts a baselineCommit/root
// override from a caller (I13/I19), so the only remaining candidate surface
// is environment configuration. This is a closed, exactly-enumerated
// reserved-key boundary -- never an open-ended name-shape scan over
// process.env. An environment variable this runtime never reads cannot
// influence baseline authority and is therefore not an override attempt by
// definition: guessing at arbitrary names via a BASE/BASELINE-shaped token
// pattern is exactly the false-positive/false-negative tradeoff this
// enumeration removes (a prior token-matching version false-positived on
// ambient vars such as GITHUB_BASE_REF/GITHUB_BASE_SHA that GitHub Actions
// sets on every pull_request run, and was never provably exhaustive against
// a genuine override name it does not anticipate either). The six keys below
// are the entire observable channel; presence is checked by exact key name
// only (Object.prototype.hasOwnProperty on process.env), never by value --
// a value is never read or logged. No other environment variable name --
// however BASE/BASELINE-shaped, and regardless of any third-party or ambient
// prefix (GITHUB_BASE_REF, OVERRIDE_BASE_COMMIT, FORCE_BASELINE_REF,
// BASECOMMIT, RELEASE_BASE_URL, AUTHORITY_BASE_URL, DATABASE_URL,
// RELEASE_NOTES_PATH, etc.) -- is ever a supported override channel: none of
// them are read, and none influence authority, so a reviewer must not read
// any of these names as a channel this boundary recognizes.
const BASE_OVERRIDE_ENV_KEYS = Object.freeze(new Set([
  'CAFEKIT_BASE_COMMIT',
  'CAFEKIT_BASELINE_COMMIT',
  'CAFEKIT_BASE_REF',
  'CAFEKIT_BASELINE_REF',
  'CAFEKIT_BASE_PATH',
  'CAFEKIT_BASELINE_PATH',
]));

function assertNoBaseOverrideEnv() {
  for (const name of BASE_OVERRIDE_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(process.env, name)) {
      fail('caller_base_override', `environment variable ${name} is a reserved baseline override channel; only tracked release-baseline.json is ever loaded (R1.3)`);
    }
  }
}

function assertBaselineUsable(root, options = {}) {
  assertNoBaseOverrideEnv();
  const loaded = loadBaselineAuthority(root);
  if (loaded.state === 'absent') {
    if (options.allowAbsent) return loaded;
    fail('authority_absent', 'release-baseline.json does not exist; only bootstrapBaseline may create it');
  }
  verifyAuthorityProvenance(root, loaded);
  return loaded;
}

// ---------------------------------------------------------------------------
// D11 legacy-bridge artifact precondition (read-only; R0-01 never writes it)
// ---------------------------------------------------------------------------

const LEGACY_BRIDGE_KEYS = ['schema_version', 'verdict', 'blocking_count', 'reviewed_criteria', 'semantic_digest', 'bootWindowBaseCommit', 'written_at'];

function readLegacyBridgeArtifact(root) {
  const loaded = readJsonFileIfExists(root, REL.legacyBridge);
  if (!loaded) fail('legacy_bridge_missing', 'bootstrap-legacy-bridge-review.json does not exist');
  const { parsed } = loaded;
  if (!exactKeys(parsed, LEGACY_BRIDGE_KEYS)) fail('legacy_bridge_malformed', 'bootstrap-legacy-bridge-review.json has an unexpected key set');
  if (parsed.schema_version !== '1') fail('legacy_bridge_malformed', 'bootstrap-legacy-bridge-review.json schema_version must be "1"');
  if (parsed.verdict !== 'PASS') fail('legacy_bridge_malformed', 'bootstrap-legacy-bridge-review.json verdict must be PASS');
  if (parsed.blocking_count !== 0) fail('legacy_bridge_malformed', 'bootstrap-legacy-bridge-review.json blocking_count must be 0');
  if (!Array.isArray(parsed.reviewed_criteria) || parsed.reviewed_criteria.length === 0) {
    fail('legacy_bridge_malformed', 'bootstrap-legacy-bridge-review.json reviewed_criteria must be a non-empty array');
  }
  if (!isSha256Tag(parsed.semantic_digest)) fail('legacy_bridge_malformed', 'bootstrap-legacy-bridge-review.json semantic_digest must be sha256');
  if (!isCommitId(parsed.bootWindowBaseCommit)) fail('legacy_bridge_malformed', 'bootstrap-legacy-bridge-review.json bootWindowBaseCommit must be a full commit id');
  if (typeof parsed.written_at !== 'string' || !parsed.written_at) fail('legacy_bridge_malformed', 'bootstrap-legacy-bridge-review.json written_at must be a non-empty string');
  return parsed;
}

// ---------------------------------------------------------------------------
// C14 BootstrapAttestation / bootstrapBaseline
// ---------------------------------------------------------------------------

const REL_FEATURE_SPEC = 'specs/archive/cafekit-semantic-eval-firewall/spec.json';

function readFeatureSpecJson(root) {
  const loaded = readJsonFileIfExists(root, REL_FEATURE_SPEC);
  if (!loaded) fail('spec_missing', 'this feature spec.json does not exist');
  return loaded.parsed;
}

function validateAttestationShape(attestation) {
  return exactKeys(attestation, ['baseCommit', 'headCommit', 'bootstrapReviewDigest', 'packageVersion'])
    && isCommitId(attestation.baseCommit)
    && isCommitId(attestation.headCommit)
    && isSha256Tag(attestation.bootstrapReviewDigest)
    && typeof attestation.packageVersion === 'string' && attestation.packageVersion !== '';
}

function readSeedPassEntry(spec) {
  const history = spec && spec.validation && spec.validation.semantic_review_history;
  if (!plain(history) || !Array.isArray(history.entries)) return null;
  return history.entries.find((entry) => entry && entry.sequence === 0 && entry.review_epoch === 0 && entry.verdict === 'PASS') || null;
}

// C14: one-time, caller-supplied input; never persisted verbatim. No
// treeDigest field (baseCommit already pins the tree). Refuses to run before
// the seed semantic_review_history entry (sequence 0/review_epoch 0) exists,
// and verifies baseCommit against the legacy-bridge artifact's own durably
// captured bootWindowBaseCommit field rather than a merge-base guess.
function bootstrapBaseline(root, attestation) {
  if (!validateAttestationShape(attestation)) fail('malformed_input', 'C14 BootstrapAttestation fails its exact schema');
  const existing = loadBaselineAuthority(root);
  if (existing.state !== 'absent') fail('authority_exists', 'release-baseline.json already exists; bootstrapBaseline only creates the first record');

  const bridge = readLegacyBridgeArtifact(root);
  if (attestation.baseCommit !== bridge.bootWindowBaseCommit) {
    fail('base_commit_mismatch', 'C14 baseCommit does not equal the legacy-bridge artifact bootWindowBaseCommit');
  }
  if (!isRealCommit(root, attestation.baseCommit)) fail('malformed_input', 'C14 baseCommit is not a real git commit object');
  const headCommit = gitHeadCommit(root);
  if (attestation.headCommit !== headCommit) fail('stale_attestation', 'C14 headCommit does not equal the actual current HEAD');
  if (!isAncestorOrEqual(root, attestation.baseCommit, attestation.headCommit)) {
    fail('malformed_input', 'C14 baseCommit is not an ancestor of (or equal to) headCommit');
  }

  const spec = readFeatureSpecJson(root);
  const seedEntry = readSeedPassEntry(spec);
  if (!seedEntry) fail('seed_pass_missing', 'bootstrapBaseline cannot run before the seed semantic_review_history entry exists');
  if (attestation.bootstrapReviewDigest !== seedEntry.review_receipt_digest) {
    fail('stale_attestation', 'C14 bootstrapReviewDigest does not match the seed PASS entry review_receipt_digest');
  }

  const protectedPaths = deriveProtectedChangedPaths(root, attestation.baseCommit, { headCommit: attestation.headCommit });
  if (protectedPaths.length === 0) fail('empty_bootstrap_diff', 'bootstrap requires a real independent-PASS digest over a non-empty protected change set');

  const record = {
    state: 'bootstrap',
    generation: 0,
    baselineCommit: attestation.baseCommit,
    baselinePackageVersion: attestation.packageVersion,
    bootstrapReviewDigest: attestation.bootstrapReviewDigest,
    previousBaselineDigest: null,
  };
  const bytes = verifyBaselineCandidate(root, record);
  atomicWriteBytes(absPath(root, REL.releaseBaseline), bytes);
  return { record, protectedPaths };
}

// ---------------------------------------------------------------------------
// C15 BenchmarkFailureLedger
// ---------------------------------------------------------------------------

function validateOpenedEvent(event) {
  return exactKeys(event, ['type', 'failure_id', 'paths', 'candidate_digest', 'evidence_digest', 'occurred_at'])
    && event.type === 'opened'
    && typeof event.failure_id === 'string' && event.failure_id !== ''
    && isSortedUniqueArray(event.paths)
    && isSha256Tag(event.candidate_digest)
    && isSha256Tag(event.evidence_digest)
    && typeof event.occurred_at === 'string' && event.occurred_at !== '';
}

function validateClassifiedEvent(event) {
  return exactKeys(event, ['type', 'failure_id', 'primary_failure_class', 'adjudication_digest', 'occurred_at'])
    && event.type === 'classified'
    && typeof event.failure_id === 'string' && event.failure_id !== ''
    && FAILURE_CLASSES.includes(event.primary_failure_class)
    && isSha256Tag(event.adjudication_digest)
    && typeof event.occurred_at === 'string' && event.occurred_at !== '';
}

function validateReclassifiedEvent(event) {
  return exactKeys(event, ['type', 'failure_id', 'previous_primary_failure_class', 'primary_failure_class', 'adjudication_digest', 'occurred_at'])
    && event.type === 'reclassified'
    && typeof event.failure_id === 'string' && event.failure_id !== ''
    && FAILURE_CLASSES.includes(event.previous_primary_failure_class)
    && FAILURE_CLASSES.includes(event.primary_failure_class)
    && isSha256Tag(event.adjudication_digest)
    && typeof event.occurred_at === 'string' && event.occurred_at !== '';
}

function validateResolvedEvent(event) {
  return exactKeys(event, ['type', 'failure_id', 'decision_digest', 'release_receipt_digest', 'occurred_at'])
    && event.type === 'resolved'
    && typeof event.failure_id === 'string' && event.failure_id !== ''
    && isSha256Tag(event.decision_digest)
    && isSha256Tag(event.release_receipt_digest)
    && typeof event.occurred_at === 'string' && event.occurred_at !== '';
}

function validateLedgerEvent(event) {
  if (!plain(event) || typeof event.type !== 'string') return false;
  if (event.type === 'opened') return validateOpenedEvent(event);
  if (event.type === 'classified') return validateClassifiedEvent(event);
  if (event.type === 'reclassified') return validateReclassifiedEvent(event);
  if (event.type === 'resolved') return validateResolvedEvent(event);
  return false;
}

// Pure shape validator (no throwing) so it can be reused both by the live
// loader below and by parseLedgerSnapshot for a raw historic commit. Named
// transitions (openFailure/classifyFailure/reclassifyFailure/resolveFailure)
// each append exactly one event per generation (nextLedgerRecord), so
// events.length === generation + 1 is a structural fact of every valid
// record, current or historic -- not merely something to check pairwise.
function validateLedgerRecordShape(parsed) {
  if (!exactKeys(parsed, ['schema_version', 'generation', 'previousLedgerDigest', 'events'])) return false;
  if (parsed.schema_version !== '1') return false;
  if (!Number.isInteger(parsed.generation) || parsed.generation < 0) return false;
  if (parsed.generation === 0 && parsed.previousLedgerDigest !== null) return false;
  if (parsed.generation > 0 && !isSha256Tag(parsed.previousLedgerDigest)) return false;
  if (!Array.isArray(parsed.events) || parsed.events.length !== parsed.generation + 1) return false;
  const seenOpened = new Set();
  for (const event of parsed.events) {
    if (!validateLedgerEvent(event)) return false;
    if (event.type === 'opened') {
      if (seenOpened.has(event.failure_id)) return false;
      seenOpened.add(event.failure_id);
    }
  }
  return true;
}

function loadFailureLedger(root) {
  const loaded = readJsonFileIfExists(root, REL.ledger);
  if (!loaded) return { state: 'absent' };
  const { bytes, parsed } = loaded;
  if (!validateLedgerRecordShape(parsed)) fail('malformed_ledger', 'benchmark-failure-ledger.json fails the exact C15 schema');
  return { state: 'present', record: parsed, bytes, digest: sha256Tag(bytes) };
}

// Turns raw committed bytes into a validated C15 record (or null on a
// malformed/unrecognized historic snapshot), reusing the exact same shape
// validator loadFailureLedger applies to the live file.
function parseLedgerSnapshot(bytes) {
  const parsed = tryParseJson(bytes);
  return validateLedgerRecordShape(parsed) ? parsed : null;
}

// Append-only, generation-per-event invariant (C15): a committed transition
// must strictly extend the events array, and every event the prior committed
// snapshot already recorded must reappear byte-for-byte, in the same order,
// in the later one -- never rewritten, reordered, or dropped. Since named
// transitions each add exactly one event per generation and generation must
// now advance by exactly one (no jump exemption), curr.events.length is
// always exactly prev.events.length + 1 by construction; the explicit
// length/prefix checks below stay as direct, named defense-in-depth rather
// than an implicit side effect of the generation rule alone.
function verifyLedgerEventPrefix(prevRecord, currRecord) {
  const prevEvents = prevRecord.events;
  const currEvents = currRecord.events;
  if (currEvents.length <= prevEvents.length) {
    fail('out_of_band_edit', 'benchmark-failure-ledger.json committed transition does not append new events');
  }
  for (let index = 0; index < prevEvents.length; index += 1) {
    if (JSON.stringify(prevEvents[index]) !== JSON.stringify(currEvents[index])) {
      fail('out_of_band_edit', 'benchmark-failure-ledger.json rewrites a previously committed event instead of only appending');
    }
  }
}

// Shared per-call options for every benchmark-failure-ledger.json provenance
// check (live-state validation and pre-write candidate validation alike).
const LEDGER_PROVENANCE_OPTIONS = {
  parseSnapshot: parseLedgerSnapshot,
  getGeneration: (record) => record.generation,
  getPreviousDigest: (record) => record.previousLedgerDigest,
  verifyPair: verifyLedgerEventPrefix,
  label: 'benchmark-failure-ledger.json',
};

// Same honest-agent-only chain-of-custody rule as C10 (verifyAuthorityProvenance),
// via the shared verifyProvenanceChain: every committed snapshot plus the
// live (possibly uncommitted) current record must move generation by exactly
// one with the matching digest check, and each committed transition must
// append-only extend the prior committed events array.
function verifyLedgerProvenance(root, loaded) {
  verifyProvenanceChain(root, REL.ledger, {
    ...LEDGER_PROVENANCE_OPTIONS,
    currentBytes: loaded.bytes,
    currentRecord: loaded.record,
  });
}

// Validates a prospective (not-yet-written) C15 candidate against the exact
// same rule before any mutation: a second uncommitted named transition
// relative to the same committed predecessor is rejected here, before the
// ledger's on-disk bytes are ever overwritten. Returns the candidate's
// serialized bytes so the caller reuses them verbatim for the atomic write.
function verifyLedgerCandidate(root, candidateRecord) {
  const candidateBytes = jsonRecordBytes(candidateRecord);
  verifyProvenanceChain(root, REL.ledger, {
    ...LEDGER_PROVENANCE_OPTIONS,
    currentBytes: candidateBytes,
    currentRecord: candidateRecord,
  });
  return candidateBytes;
}

function assertFailureLedgerUsable(root) {
  const loaded = loadFailureLedger(root);
  if (loaded.state === 'present') verifyLedgerProvenance(root, loaded);
  return loaded;
}

function computeFailureLedgerDigest(root) {
  const loaded = loadFailureLedger(root);
  return loaded.state === 'present' ? loaded.digest : NO_FAILURES_ATTESTATION_DIGEST;
}

// Folds a failure_id's events: the most recent classification-type event
// (classified or reclassified) determines the current class (I18); blocking
// while opened-only or classified framework_regression and unresolved.
function deriveFailureState(ledgerLoaded, failureId) {
  const events = ledgerLoaded && ledgerLoaded.state === 'present' ? ledgerLoaded.record.events : [];
  const relevant = events.filter((event) => event.failure_id === failureId);
  const opened = relevant.find((event) => event.type === 'opened');
  if (!opened) return { exists: false };
  let currentClass = null;
  let resolved = false;
  let resolvedEvent = null;
  for (const event of relevant) {
    if (event.type === 'classified' || event.type === 'reclassified') currentClass = event.primary_failure_class;
    if (event.type === 'resolved') { resolved = true; resolvedEvent = event; }
  }
  const blocking = !resolved && (currentClass === null || currentClass === 'framework_regression');
  return { exists: true, openedPaths: opened.paths, currentClass, resolved, resolvedEvent, blocking };
}

function allOpenFailureIds(ledgerLoaded) {
  if (!ledgerLoaded || ledgerLoaded.state !== 'present') return [];
  const ids = new Set();
  for (const event of ledgerLoaded.record.events) if (event.type === 'opened') ids.add(event.failure_id);
  return [...ids];
}

// Builds the candidate for a named C15 transition and validates it against
// the committed predecessor *before* returning -- callers write the returned
// bytes verbatim; nothing here ever mutates release-baseline.json/the
// ledger's own on-disk bytes itself before that validation passes.
function nextLedgerRecord(root, buildEvent) {
  const loaded = assertFailureLedgerUsable(root);
  const events = loaded.state === 'present' ? [...loaded.record.events] : [];
  const generation = loaded.state === 'present' ? loaded.record.generation + 1 : 0;
  const previousLedgerDigest = loaded.state === 'present' ? loaded.digest : null;
  const newEvent = buildEvent(events, loaded);
  events.push(newEvent);
  const record = { schema_version: '1', generation, previousLedgerDigest, events };
  const bytes = verifyLedgerCandidate(root, record);
  return { record, bytes };
}

function openFailure(root, input) {
  if (!plain(input)) fail('malformed_input', 'openFailure input must be an object');
  const { failure_id: failureId, paths, candidate_digest: candidateDigest, evidence_digest: evidenceDigest, occurred_at: occurredAt } = input;
  if (typeof failureId !== 'string' || !failureId) fail('malformed_input', 'openFailure requires a non-empty failure_id');
  if (!isSortedUniqueArray(paths)) fail('malformed_input', 'openFailure requires sorted-unique non-empty paths');
  if (!isSha256Tag(candidateDigest)) fail('malformed_input', 'openFailure requires a valid candidate_digest');
  if (!isSha256Tag(evidenceDigest)) fail('malformed_input', 'openFailure requires a valid evidence_digest');
  if (typeof occurredAt !== 'string' || !occurredAt) fail('malformed_input', 'openFailure requires occurred_at');
  const { record, bytes } = nextLedgerRecord(root, (events) => {
    if (events.some((event) => event.type === 'opened' && event.failure_id === failureId)) {
      fail('duplicate_failure_id', `failure_id ${failureId} already opened`);
    }
    return { type: 'opened', failure_id: failureId, paths: [...paths], candidate_digest: candidateDigest, evidence_digest: evidenceDigest, occurred_at: occurredAt };
  });
  atomicWriteBytes(absPath(root, REL.ledger), bytes);
  return record;
}

function classifyFailure(root, input) {
  if (!plain(input)) fail('malformed_input', 'classifyFailure input must be an object');
  const { failure_id: failureId, primary_failure_class: primaryClass, adjudication_digest: adjudicationDigest, occurred_at: occurredAt } = input;
  if (typeof failureId !== 'string' || !failureId) fail('malformed_input', 'classifyFailure requires failure_id');
  if (!FAILURE_CLASSES.includes(primaryClass)) fail('malformed_input', 'classifyFailure requires a valid primary_failure_class');
  if (!isSha256Tag(adjudicationDigest)) fail('malformed_input', 'classifyFailure requires a valid adjudication_digest');
  if (typeof occurredAt !== 'string' || !occurredAt) fail('malformed_input', 'classifyFailure requires occurred_at');
  const { record, bytes } = nextLedgerRecord(root, (events) => {
    if (!events.some((event) => event.type === 'opened' && event.failure_id === failureId)) {
      fail('unknown_failure_id', `classifyFailure requires an opened event for ${failureId}`);
    }
    if (events.some((event) => event.type === 'classified' && event.failure_id === failureId)) {
      fail('already_classified', `failure_id ${failureId} already has a classified event`);
    }
    if (events.some((event) => (event.type === 'classified' || event.type === 'reclassified') && event.adjudication_digest === adjudicationDigest)) {
      fail('reused_adjudication_digest', 'adjudication_digest has already been used for a classification event');
    }
    return { type: 'classified', failure_id: failureId, primary_failure_class: primaryClass, adjudication_digest: adjudicationDigest, occurred_at: occurredAt };
  });
  atomicWriteBytes(absPath(root, REL.ledger), bytes);
  return record;
}

function reclassifyFailure(root, input) {
  if (!plain(input)) fail('malformed_input', 'reclassifyFailure input must be an object');
  const {
    failure_id: failureId, previous_primary_failure_class: previousClass,
    primary_failure_class: primaryClass, adjudication_digest: adjudicationDigest, occurred_at: occurredAt,
  } = input;
  if (typeof failureId !== 'string' || !failureId) fail('malformed_input', 'reclassifyFailure requires failure_id');
  if (!FAILURE_CLASSES.includes(previousClass)) fail('malformed_input', 'reclassifyFailure requires a valid previous_primary_failure_class');
  if (!FAILURE_CLASSES.includes(primaryClass)) fail('malformed_input', 'reclassifyFailure requires a valid primary_failure_class');
  if (!isSha256Tag(adjudicationDigest)) fail('malformed_input', 'reclassifyFailure requires a valid adjudication_digest');
  if (typeof occurredAt !== 'string' || !occurredAt) fail('malformed_input', 'reclassifyFailure requires occurred_at');
  const { record, bytes } = nextLedgerRecord(root, (events) => {
    const state = deriveFailureState({ state: 'present', record: { events } }, failureId);
    if (!state.exists || state.currentClass === null) fail('unknown_failure_id', `reclassifyFailure requires a prior classified event for ${failureId}`);
    if (state.resolved) fail('already_resolved', `failure_id ${failureId} already has a resolved event`);
    if (state.currentClass !== previousClass) fail('stale_previous_class', 'previous_primary_failure_class does not match the currently-derived class');
    if (events.some((event) => (event.type === 'classified' || event.type === 'reclassified') && event.adjudication_digest === adjudicationDigest)) {
      fail('reused_adjudication_digest', 'adjudication_digest has already been used for a classification event');
    }
    return {
      type: 'reclassified', failure_id: failureId, previous_primary_failure_class: previousClass,
      primary_failure_class: primaryClass, adjudication_digest: adjudicationDigest, occurred_at: occurredAt,
    };
  });
  atomicWriteBytes(absPath(root, REL.ledger), bytes);
  return record;
}

// I13: never trusts a caller-supplied release_receipt_digest or a caller's
// claim that failure_id belongs to the release being resolved. Independently
// re-derives and validates the published receipt before appending.
function resolveFailure(root, input) {
  if (!plain(input)) fail('malformed_input', 'resolveFailure input must be an object');
  const { failure_id: failureId, decision_digest: decisionDigest } = input;
  if (typeof failureId !== 'string' || !failureId) fail('malformed_input', 'resolveFailure requires failure_id');
  if (!isSha256Tag(decisionDigest)) fail('malformed_input', 'resolveFailure requires a valid decision_digest');

  const authority = assertBaselineUsable(root);
  if (authority.state !== 'released') fail('not_released', 'resolveFailure requires a released C10 authority');
  const canonical = tryReadJsonFile(root, REL.receipt);
  if (!canonical) fail('receipt_missing', 'canonical release receipt does not exist or is unreadable/malformed');
  const recomputedDigest = sha256Tag(canonical.bytes);
  if (recomputedDigest !== authority.record.releaseReceiptDigest) {
    fail('receipt_digest_mismatch', 'canonical receipt bytes do not match the currently published releaseReceiptDigest');
  }
  if (!validateReceiptShape(canonical.parsed)) fail('malformed_receipt', 'canonical release receipt fails the exact C12 schema');
  if (Object.prototype.hasOwnProperty.call(input, 'release_receipt_digest')
    && input.release_receipt_digest !== undefined && input.release_receipt_digest !== recomputedDigest) {
    fail('untrusted_claim_mismatch', 'caller-supplied release_receipt_digest does not match the independently recomputed digest');
  }
  const resolvedIds = sortedUnique(canonical.parsed.resolvedFailureIds);
  if (!resolvedIds.includes(failureId)) fail('not_in_receipt', 'failure_id is not a member of the persisted receipt resolvedFailureIds');

  const ledgerLoaded = loadFailureLedger(root);
  const state = deriveFailureState(ledgerLoaded, failureId);
  if (!state.exists) fail('unknown_failure_id', `resolveFailure requires a known failure_id ${failureId}`);
  if (state.resolved) {
    if (state.resolvedEvent.release_receipt_digest === recomputedDigest) return { status: 'noop' };
    fail('resolve_conflict', 'failure_id already resolved with a different release_receipt_digest');
  }
  if (state.currentClass !== 'framework_regression') fail('not_framework_regression', 'resolveFailure only resolves ids currently classified framework_regression');

  const { record, bytes } = nextLedgerRecord(root, () => ({
    type: 'resolved', failure_id: failureId, decision_digest: decisionDigest,
    release_receipt_digest: recomputedDigest, occurred_at: new Date().toISOString(),
  }));
  atomicWriteBytes(absPath(root, REL.ledger), bytes);
  return { status: 'resolved', record };
}

// ---------------------------------------------------------------------------
// C1 ChangeProposal shape validators
// ---------------------------------------------------------------------------

function validateBenchmarkRemediationShape(proposal) {
  const required = [
    'change_intent', 'proposal_id', 'invariant_id', 'hypothesis', 'owner_layer',
    'primary_failure_class', 'paths', 'failure_ids', 'evidence',
    'true_positive_family', 'negative_control_family', 'rollback_condition',
  ];
  if (!hasOnlyKeys(proposal, required, ['held_out_result', 'ceremony_delta'])) return false;
  if (proposal.change_intent !== 'benchmark_remediation') return false;
  if (typeof proposal.proposal_id !== 'string' || !proposal.proposal_id) return false;
  if (typeof proposal.invariant_id !== 'string' || !proposal.invariant_id) return false;
  if (typeof proposal.hypothesis !== 'string' || !proposal.hypothesis) return false;
  if (!OWNER_LAYERS.includes(proposal.owner_layer)) return false;
  if (!FAILURE_CLASSES.includes(proposal.primary_failure_class)) return false;
  if (!isSortedUniqueArray(proposal.paths)) return false;
  if (!Array.isArray(proposal.failure_ids) || proposal.failure_ids.length === 0) return false;
  if (!proposal.failure_ids.every((entry) => typeof entry === 'string' && entry !== '')) return false;
  if (new Set(proposal.failure_ids).size !== proposal.failure_ids.length) return false;
  if (!isNonEmptyStringArray(proposal.evidence)) return false;
  if (!isNonEmptyStringArray(proposal.true_positive_family)) return false;
  if (!isNonEmptyStringArray(proposal.negative_control_family)) return false;
  if (typeof proposal.rollback_condition !== 'string' || !proposal.rollback_condition) return false;
  if ('held_out_result' in proposal && typeof proposal.held_out_result !== 'string') return false;
  if ('ceremony_delta' in proposal && typeof proposal.ceremony_delta !== 'string') return false;
  return true;
}

function validateAuthorizedEvolutionShape(proposal) {
  const required = [
    'change_intent', 'proposal_id', 'spec_ref', 'spec_semantic_digest',
    'independent_pass_receipt_digest', 'planned_write_set', 'rollback_condition', 'negative_control_family',
  ];
  if (!hasOnlyKeys(proposal, required)) return false;
  if (proposal.change_intent !== 'authorized_evolution') return false;
  if (typeof proposal.proposal_id !== 'string' || !proposal.proposal_id) return false;
  if (typeof proposal.spec_ref !== 'string' || !proposal.spec_ref) return false;
  if (!isSha256Tag(proposal.spec_semantic_digest)) return false;
  if (!isSha256Tag(proposal.independent_pass_receipt_digest)) return false;
  if (!isSortedUniqueArray(proposal.planned_write_set)) return false;
  if (typeof proposal.rollback_condition !== 'string' || !proposal.rollback_condition) return false;
  if (!isNonEmptyStringArray(proposal.negative_control_family)) return false;
  return true;
}

// Containment is checked twice: once lexically (before touching the
// filesystem) and once again against the fully realpath-resolved location,
// since an intermediate ancestor directory component can be a symlink that
// silently redirects a lexically-contained path outside the project root
// (lstat on the final component alone does not catch this).
function resolveSpecRefDir(root, specRef) {
  if (typeof specRef !== 'string' || !specRef) fail('malformed_input', 'spec_ref must be a non-empty repo-relative path');
  if (path.isAbsolute(specRef)) fail('path_escape', 'spec_ref must be repo-relative, not absolute');
  const absolute = path.resolve(root, specRef);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('path_escape', 'spec_ref escapes the project root');
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch {
    fail('spec_ref_missing', 'spec_ref directory does not exist');
  }
  if (stat.isSymbolicLink()) fail('path_escape', 'spec_ref must not itself be a symlink');
  if (!stat.isDirectory()) fail('spec_ref_missing', 'spec_ref must be a directory');
  let realAbsolute;
  let realRoot;
  try {
    realAbsolute = fs.realpathSync(absolute);
    realRoot = fs.realpathSync(root);
  } catch {
    fail('spec_ref_missing', 'spec_ref cannot be resolved');
  }
  const realRelative = path.relative(realRoot, realAbsolute);
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    fail('path_escape', 'spec_ref escapes the project root via a symlinked ancestor');
  }
  return absolute;
}

// C12 artifactPath containment: rejects an absolute path, a lexical `..`
// escape (a raw string-prefix check alone is not enough -- a value like
// `packages/spec/.cafekit-release/../../../etc/passwd` still starts with the
// reserved prefix as text), anything outside the reserved release directory,
// a missing file, a symlink at the final component, and a symlinked ancestor
// directory that would otherwise silently redirect a lexically-contained
// path outside the project root.
function assertArtifactPath(root, relativeInput) {
  if (typeof relativeInput !== 'string' || relativeInput === '') fail('malformed_input', 'artifactPath must be a non-empty string');
  if (path.isAbsolute(relativeInput)) fail('artifact_path_escape', 'artifactPath must be repo-relative, not absolute');
  const lexicalCandidate = path.resolve(root, relativeInput);
  const lexicalRelative = path.relative(root, lexicalCandidate);
  if (lexicalRelative === '..' || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
    fail('artifact_path_escape', 'artifactPath escapes the project root');
  }
  const normalizedRelative = lexicalRelative.split(path.sep).join('/');
  if (!normalizedRelative.startsWith(REL.cafekitReleaseDir)) {
    fail('artifact_path_escape', 'artifactPath must be restricted to packages/spec/.cafekit-release/');
  }
  let stat;
  try {
    stat = fs.lstatSync(lexicalCandidate);
  } catch {
    fail('artifact_missing', 'release artifact does not exist at artifactPath');
  }
  if (stat.isSymbolicLink()) fail('artifact_invalid', 'release artifact must not be a symlink');
  if (!stat.isFile()) fail('artifact_invalid', 'release artifact must be a regular file');
  // No path component may be a symlink -- not the artifact's own ancestor
  // directories, and not packages/spec/.cafekit-release/ itself. Comparing
  // realpath-resolved endpoints only by their *relative* distance is not a
  // sound check: if an ancestor symlink (including .cafekit-release/ itself)
  // redirects the whole subtree elsewhere, both the candidate and the release
  // directory resolve through that same redirection and still appear
  // "contained" relative to each other; the same blind spot lets a symlink
  // planted *inside* the release directory redirect to another real subdir
  // that is still, itself, inside the release tree. The only check that
  // catches every case uniformly is that realpath resolution changes nothing
  // at all from the literal, lexically-resolved paths.
  const lexicalReleaseDir = absPath(root, REL.cafekitReleaseDir.replace(/\/$/, ''));
  let realCandidate;
  let realReleaseDir;
  try {
    realCandidate = fs.realpathSync(lexicalCandidate);
    realReleaseDir = fs.realpathSync(lexicalReleaseDir);
  } catch {
    fail('artifact_missing', 'release artifact cannot be resolved');
  }
  if (realReleaseDir !== lexicalReleaseDir) {
    fail('artifact_invalid', 'packages/spec/.cafekit-release/ itself resolves through a symlink');
  }
  if (realCandidate !== lexicalCandidate) {
    fail('artifact_invalid', 'release artifact path resolves through a symlinked component');
  }
  return lexicalCandidate;
}

function readSpecJsonAt(specDir) {
  const specFile = path.join(specDir, 'spec.json');
  let stat;
  try {
    stat = fs.lstatSync(specFile);
  } catch {
    fail('spec_ref_missing', 'spec_ref does not contain spec.json');
  }
  if (!stat.isFile()) fail('spec_ref_missing', 'spec_ref spec.json must be a regular file');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  } catch (error) {
    fail('malformed_input', `spec_ref spec.json is not valid JSON (${error.message})`);
  }
  return parsed;
}

function computeSpecSemanticDigest(specDir, spec) {
  const result = validatorModule().computeSemanticDigest21(specDir, spec);
  if (result.errors && result.errors.length) fail('spec_digest_failed', `cannot compute spec_ref semantic digest (${result.errors.join('; ')})`);
  return result.digest;
}

// Shared C15 remediation ground-truth helper (single rule, no per-caller/
// per-fixture duplication): the exact set of currently open, blocking,
// path-intersecting ledger entries for a given changedPaths set, plus the
// union of their opened paths. Always re-derived from the live ledger --
// never trusts a caller- or freeze-recorded remediation claim. Used by
// assertBenchmarkRemediation, ledgerIntersectsPaths (I8), and
// verifyFreezeManifest's independent remediatedFailureIds re-check.
function deriveExpectedRemediation(ledgerLoaded, changedPaths) {
  const intersecting = allOpenFailureIds(ledgerLoaded)
    .map((failureId) => ({ failureId, state: deriveFailureState(ledgerLoaded, failureId) }))
    .filter(({ state }) => state.blocking && state.openedPaths.some((entryPath) => changedPaths.includes(entryPath)));
  return {
    failureIds: sortedUnique(intersecting.map((entry) => entry.failureId)),
    pathsUnion: sortedUnique(intersecting.flatMap((entry) => entry.state.openedPaths)),
  };
}

function ledgerIntersectsPaths(ledgerLoaded, changedPaths) {
  return deriveExpectedRemediation(ledgerLoaded, changedPaths).failureIds.length > 0;
}

function assertBenchmarkRemediation(proposal, changedPaths, ledgerLoaded) {
  if (!validateBenchmarkRemediationShape(proposal)) fail('malformed_proposal', 'benchmark_remediation proposal fails the exact C1 schema');
  if (JSON.stringify(sortedUnique(proposal.paths)) !== JSON.stringify(changedPaths)) {
    fail('paths_mismatch', 'benchmark_remediation paths must exactly equal the derived protected changedPaths');
  }
  if (proposal.primary_failure_class !== 'framework_regression') {
    fail('non_framework_regression', 'benchmark_remediation only accepts primary_failure_class = framework_regression');
  }
  const failureIds = sortedUnique(proposal.failure_ids);
  const expected = deriveExpectedRemediation(ledgerLoaded, changedPaths);
  if (JSON.stringify(expected.failureIds) !== JSON.stringify(failureIds)) {
    fail('failure_ids_mismatch', 'failure_ids must exactly name every intersecting open ledger entry');
  }
  if (JSON.stringify(expected.pathsUnion) !== JSON.stringify(changedPaths)) {
    fail('paths_union_mismatch', 'the combined opened.paths union of the named failure_ids must exactly equal the proposal paths');
  }
  return { changeKind: 'protected_change', remediatedFailureIds: failureIds };
}

function assertAuthorizedEvolution(root, proposal, changedPaths, ledgerLoaded) {
  if (!validateAuthorizedEvolutionShape(proposal)) fail('malformed_proposal', 'authorized_evolution proposal fails the exact C1 schema');
  if (JSON.stringify(sortedUnique(proposal.planned_write_set)) !== JSON.stringify(changedPaths)) {
    fail('paths_mismatch', 'authorized_evolution planned_write_set must exactly equal the derived protected changedPaths');
  }
  // I8: refuse unconditionally on any open-ledger intersection; no citation passes it through.
  if (ledgerIntersectsPaths(ledgerLoaded, changedPaths)) {
    fail('open_ledger_intersection', 'authorized_evolution is refused unconditionally when it intersects an open C15 ledger entry; use benchmark_remediation instead');
  }

  const specDir = resolveSpecRefDir(root, proposal.spec_ref);
  const spec = readSpecJsonAt(specDir);
  const planningDepth = spec && spec.workflow_policy && spec.workflow_policy.planning_depth;
  if (planningDepth !== 'Compact' && planningDepth !== 'Full') {
    fail('planning_depth_invalid', 'spec_ref workflow_policy.planning_depth must be Compact or Full');
  }
  const freshness = DIGEST.assertAuthoringFresh({
    specDir,
    authoring: spec.authoring,
    receipt: spec.validation && spec.validation.authoring_validation,
    fields: ['requirements', 'design'],
  });
  if (!freshness.requirements.fresh || !freshness.design.fresh) {
    fail('authoring_not_fresh', 'spec_ref authoring.requirements/design must both be validated and C16-digest-fresh (I20)');
  }
  const currentDigest = computeSpecSemanticDigest(specDir, spec);
  if (proposal.spec_semantic_digest !== currentDigest) fail('stale_spec_digest', 'spec_semantic_digest does not equal the current semantic_model digest');

  const history = spec.validation && spec.validation.semantic_review_history;
  const entries = plain(history) && Array.isArray(history.entries) ? history.entries : [];
  const matching = entries.filter((entry) => entry && entry.verdict === 'PASS' && entry.semantic_digest === currentDigest);
  if (matching.length === 0) fail('missing_independent_pass', 'no accepted PASS entry in this lineage matches the current spec digest');
  const latest = matching.reduce((best, entry) => (entry.sequence > best.sequence ? entry : best), matching[0]);
  if (proposal.independent_pass_receipt_digest !== latest.review_receipt_digest) {
    fail('superseded_pass_citation', 'independent_pass_receipt_digest must cite the latest accepted PASS in the lineage (I14), not a superseded entry');
  }
  return { changeKind: 'protected_change', remediatedFailureIds: [] };
}

// D1/I8: gates unproven or unauthorized change without freezing legitimate
// evolution. changedPaths must already be self-derived (deriveProtectedChangedPaths).
function assertHotspotChangeAllowed(root, { proposal, changedPaths, ledgerLoaded } = {}) {
  if (!isSortedUniqueArray(changedPaths)) fail('malformed_input', 'changedPaths must be sorted-unique and non-empty');
  const ledger = ledgerLoaded || assertFailureLedgerUsable(root);
  if (!plain(proposal) || typeof proposal.change_intent !== 'string') fail('proposal_required', 'a tagged C1 ChangeProposal is required for a protected change');
  if (proposal.change_intent === 'benchmark_remediation') return assertBenchmarkRemediation(proposal, changedPaths, ledger);
  if (proposal.change_intent === 'authorized_evolution') return assertAuthorizedEvolution(root, proposal, changedPaths, ledger);
  fail('malformed_input', 'change_intent must be benchmark_remediation or authorized_evolution');
}

// ---------------------------------------------------------------------------
// C9 FreezeManifest
// ---------------------------------------------------------------------------

function validateFreezeShape(freeze) {
  const keys = [
    'baselineAuthorityDigest', 'baselineGeneration', 'baselineCommit',
    'failureLedgerDigest', 'failureLedgerGeneration', 'remediatedFailureIds',
    'changeKind', 'proposalDigest', 'treeDigest', 'changedPaths', 'packageVersion', 'candidateDigest',
  ];
  if (!exactKeys(freeze, keys)) return false;
  if (!isSha256Tag(freeze.baselineAuthorityDigest)) return false;
  if (!Number.isInteger(freeze.baselineGeneration) || freeze.baselineGeneration < 0) return false;
  if (!isCommitId(freeze.baselineCommit)) return false;
  if (freeze.failureLedgerDigest !== NO_FAILURES_ATTESTATION_DIGEST && !isSha256Tag(freeze.failureLedgerDigest)) return false;
  if (freeze.failureLedgerGeneration !== null && !(Number.isInteger(freeze.failureLedgerGeneration) && freeze.failureLedgerGeneration >= 0)) return false;
  if (!isSortedUniqueArray(freeze.remediatedFailureIds, { allowEmpty: true })) return false;
  if (!['protected_change', 'no_protected_change'].includes(freeze.changeKind)) return false;
  if (freeze.proposalDigest !== NO_CHANGE_ATTESTATION_DIGEST && !isSha256Tag(freeze.proposalDigest)) return false;
  if (!isSha256Tag(freeze.treeDigest)) return false;
  if (!isSortedUniqueArray(freeze.changedPaths, { allowEmpty: true })) return false;
  if (freeze.changeKind === 'protected_change' && freeze.changedPaths.length === 0) return false;
  if (freeze.changeKind === 'no_protected_change' && freeze.changedPaths.length !== 0) return false;
  if (typeof freeze.packageVersion !== 'string' || !freeze.packageVersion) return false;
  if (!isSha256Tag(freeze.candidateDigest)) return false;
  return true;
}

function readPackageVersion(root) {
  const loaded = readJsonFileIfExists(root, REL.packageJson);
  if (!loaded || typeof loaded.parsed.version !== 'string' || !loaded.parsed.version) {
    fail('malformed_input', 'packages/spec/package.json version is missing');
  }
  return loaded.parsed.version;
}

function createFreezeManifest(root, proposal) {
  const authority = assertBaselineUsable(root);
  if (!isAncestorOrEqual(root, authority.record.baselineCommit, gitHeadCommit(root))) {
    fail('baseline_not_ancestor', 'authority baselineCommit is not an ancestor of (or equal to) current HEAD');
  }
  const ledgerLoaded = assertFailureLedgerUsable(root);
  const failureLedgerDigest = ledgerLoaded.state === 'present' ? ledgerLoaded.digest : NO_FAILURES_ATTESTATION_DIGEST;
  const failureLedgerGeneration = ledgerLoaded.state === 'present' ? ledgerLoaded.record.generation : null;

  const protectedPaths = deriveProtectedChangedPaths(root, authority.record.baselineCommit);
  const packageVersion = readPackageVersion(root);

  let changeKind;
  let proposalDigest;
  let remediatedFailureIds = [];
  let changedPaths = protectedPaths;

  if (protectedPaths.length === 0) {
    if (authority.state !== 'released') fail('empty_paths_invalid', 'empty derived protected paths are never valid during bootstrap state');
    if (proposal !== null && proposal !== undefined) fail('malformed_input', 'a no_protected_change freeze must not carry a C1 proposal');
    changeKind = 'no_protected_change';
    proposalDigest = NO_CHANGE_ATTESTATION_DIGEST;
    changedPaths = [];
  } else {
    changeKind = 'protected_change';
    const gate = assertHotspotChangeAllowed(root, { proposal, changedPaths: protectedPaths, ledgerLoaded });
    proposalDigest = computeProposalDigest(proposal);
    remediatedFailureIds = gate.remediatedFailureIds;
  }

  const treeDigest = computeProtectedTreeDigest(root, changedPaths);
  const candidateFields = {
    baselineAuthorityDigest: authority.digest,
    baselineGeneration: authority.record.generation,
    baselineCommit: authority.record.baselineCommit,
    failureLedgerDigest,
    failureLedgerGeneration,
    remediatedFailureIds: sortedUnique(remediatedFailureIds),
    changedPaths,
    treeDigest,
    proposalDigest,
    packageVersion,
  };
  const candidateDigest = computeCandidateDigest(candidateFields);

  const manifest = {
    baselineAuthorityDigest: authority.digest,
    baselineGeneration: authority.record.generation,
    baselineCommit: authority.record.baselineCommit,
    failureLedgerDigest,
    failureLedgerGeneration,
    remediatedFailureIds: sortedUnique(remediatedFailureIds),
    changeKind,
    proposalDigest,
    treeDigest,
    changedPaths,
    packageVersion,
    candidateDigest,
  };
  atomicWriteJson(absPath(root, REL.freeze), manifest);
  return manifest;
}

function verifyFreezeManifest(root) {
  const loaded = readJsonFileIfExists(root, REL.freeze);
  if (!loaded) fail('freeze_missing', 'change-firewall-freeze.json does not exist; freeze creation must run first');
  const freeze = loaded.parsed;
  if (!validateFreezeShape(freeze)) fail('freeze_malformed', 'change-firewall-freeze.json fails the exact C9 schema');

  const authority = assertBaselineUsable(root);
  if (freeze.baselineAuthorityDigest !== authority.digest
    || freeze.baselineGeneration !== authority.record.generation
    || freeze.baselineCommit !== authority.record.baselineCommit) {
    fail('freeze_stale', 'freeze is stale against the current C10 authority');
  }
  if (!isAncestorOrEqual(root, authority.record.baselineCommit, gitHeadCommit(root))) {
    fail('baseline_not_ancestor', 'authority baselineCommit is not an ancestor of (or equal to) current HEAD');
  }
  const ledgerLoaded = assertFailureLedgerUsable(root);
  const currentLedgerDigest = ledgerLoaded.state === 'present' ? ledgerLoaded.digest : NO_FAILURES_ATTESTATION_DIGEST;
  const currentLedgerGeneration = ledgerLoaded.state === 'present' ? ledgerLoaded.record.generation : null;
  if (freeze.failureLedgerDigest !== currentLedgerDigest || freeze.failureLedgerGeneration !== currentLedgerGeneration) {
    fail('freeze_stale', 'freeze is stale against the current C15 ledger');
  }
  if (freeze.changeKind === 'no_protected_change' && authority.state !== 'released') {
    fail('freeze_malformed', 'no_protected_change is only valid when authority state is released');
  }
  const currentPackageVersion = readPackageVersion(root);
  if (freeze.packageVersion !== currentPackageVersion) {
    fail('freeze_stale', 'freeze packageVersion no longer matches the current package.json version');
  }
  // Re-derive the protected changed-path set fresh from the authority baseline
  // and the current working tree -- never trust the freeze's own recorded
  // list. A path added or removed since freeze creation changes this set
  // even when every already-listed path's own content digest still matches,
  // so this exact-set comparison is required in addition to the treeDigest
  // recompute below (which only re-hashes the paths the freeze already lists).
  const currentChangedPaths = deriveProtectedChangedPaths(root, authority.record.baselineCommit);
  if (JSON.stringify(currentChangedPaths) !== JSON.stringify(freeze.changedPaths)) {
    fail('freeze_stale', 'derived protected changed paths no longer match the frozen set');
  }
  const recomputedTreeDigest = computeProtectedTreeDigest(root, freeze.changedPaths);
  if (recomputedTreeDigest !== freeze.treeDigest) fail('freeze_stale', 'freeze treeDigest no longer matches the current working tree');
  // Re-derive the expected remediation from the live C15 ledger + the current
  // changedPaths -- never trust freeze.remediatedFailureIds itself. The
  // candidateDigest recompute below only proves the freeze's own recorded
  // fields are mutually self-consistent, not that they still reflect ground
  // truth; a hand-edited freeze that narrows remediatedFailureIds and
  // self-recomputes a matching candidateDigest must still fail here.
  const expectedRemediation = deriveExpectedRemediation(ledgerLoaded, freeze.changedPaths);
  if (JSON.stringify(expectedRemediation.failureIds) !== JSON.stringify(freeze.remediatedFailureIds)) {
    fail('freeze_stale', 'freeze remediatedFailureIds no longer names exactly the current intersecting open C15 ledger entries');
  }
  // Same path-union invariant assertBenchmarkRemediation enforces at proposal
  // time: when remediatedFailureIds is non-empty, changedPaths must equal
  // exactly the combined opened.paths union of those named entries -- never a
  // superset that smuggles an extra, unrelated protected-path change through
  // under an otherwise-correct failure_ids/remediatedFailureIds match. Skipped
  // when remediatedFailureIds is empty (authorized_evolution/no_protected_change,
  // where changedPaths is never required to be covered by any ledger entry).
  if (freeze.remediatedFailureIds.length > 0
    && JSON.stringify(expectedRemediation.pathsUnion) !== JSON.stringify(freeze.changedPaths)) {
    fail('freeze_stale', 'freeze changedPaths is not exactly the opened.paths union of its own remediatedFailureIds');
  }
  const recomputedCandidate = computeCandidateDigest({
    baselineAuthorityDigest: freeze.baselineAuthorityDigest,
    baselineGeneration: freeze.baselineGeneration,
    baselineCommit: freeze.baselineCommit,
    failureLedgerDigest: freeze.failureLedgerDigest,
    failureLedgerGeneration: freeze.failureLedgerGeneration,
    remediatedFailureIds: freeze.remediatedFailureIds,
    changedPaths: freeze.changedPaths,
    treeDigest: freeze.treeDigest,
    proposalDigest: freeze.proposalDigest,
    packageVersion: freeze.packageVersion,
  });
  if (recomputedCandidate !== freeze.candidateDigest) fail('freeze_malformed', "freeze candidateDigest does not match its own bound fields");
  return freeze;
}

function invalidateFreeze(root) {
  const absolute = absPath(root, REL.freeze);
  try {
    fs.unlinkSync(absolute);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

// ---------------------------------------------------------------------------
// C12 ReleaseReceipt / advanceBaseline (I11/I13)
// ---------------------------------------------------------------------------

function validateReceiptShape(receipt) {
  if (!exactKeys(receipt, RELEASE_RECEIPT_FIELDS)) return false;
  if (receipt.schema_version !== '1') return false;
  if (typeof receipt.receipt_id !== 'string' || !receipt.receipt_id) return false;
  if (receipt.status !== 'published') return false;
  if (!isSha256Tag(receipt.baselineAuthorityDigest)) return false;
  if (!Number.isInteger(receipt.baselineGeneration) || receipt.baselineGeneration < 0) return false;
  if (!isSha256Tag(receipt.freezeDigest)) return false;
  if (!isSha256Tag(receipt.candidateDigest)) return false;
  if (!isSha256Tag(receipt.treeDigest)) return false;
  if (typeof receipt.packageVersion !== 'string' || !receipt.packageVersion) return false;
  if (!isCommitId(receipt.releaseCommit)) return false;
  if (typeof receipt.artifactPath !== 'string' || !receipt.artifactPath) return false;
  if (!isSha256Tag(receipt.artifactDigest)) return false;
  if (!isSortedUniqueArray(receipt.resolvedFailureIds, { allowEmpty: true })) return false;
  return true;
}

// Publishing a release is exactly three independent single-file-atomic events
// (I11): (A) persist the canonical receipt, (B) rotate C10 authority (owned
// here, as two sequential sub-steps of this one call); (C) resolveFailure per
// id is invoked separately by the caller, strictly after this returns success.
function advanceBaseline(root, receiptBytes) {
  if (!Buffer.isBuffer(receiptBytes)) fail('malformed_input', 'advanceBaseline requires the exact receipt bytes as a Buffer');
  let receipt;
  try {
    receipt = JSON.parse(receiptBytes.toString('utf8'));
  } catch (error) {
    fail('malformed_input', `supplied receipt bytes are not valid JSON (${error.message})`);
  }
  const suppliedDigest = sha256Tag(receiptBytes);
  const suppliedShapeOk = validateReceiptShape(receipt);

  const authority = assertBaselineUsable(root);
  const publishedDigest = authority.state === 'released' ? authority.record.releaseReceiptDigest : null;

  // (1) idempotency check, before any other read or write.
  if (publishedDigest && suppliedDigest === publishedDigest) {
    const canonical = tryReadJsonFile(root, REL.receipt);
    const canonicalOk = Boolean(canonical) && sha256Tag(canonical.bytes) === publishedDigest && validateReceiptShape(canonical.parsed);
    if (canonicalOk) return { status: 'already_published', digest: publishedDigest };
    // (1b) repair from supplied bytes -- only if the supplied bytes themselves
    // independently verify (their digest already matches the published one).
    if (!suppliedShapeOk) fail('receipt_unverifiable', 'canonical receipt evidence is missing/corrupt and the supplied bytes fail the exact C12 schema');
    atomicWriteBytes(absPath(root, REL.receipt), receiptBytes);
    // Re-read the canonical bytes this write actually produced and reuse the
    // same digest/schema authority as (1a) to prove the repair landed -- never
    // trust the write call alone (design.md C12 1b: "re-verify the write").
    const repairedRead = tryReadJsonFile(root, REL.receipt);
    const repairedOk = Boolean(repairedRead) && sha256Tag(repairedRead.bytes) === publishedDigest && validateReceiptShape(repairedRead.parsed);
    if (!repairedOk) fail('receipt_unverifiable', 'idempotent repair write did not durably persist verifiable canonical receipt evidence (re-read failed digest/schema verification)');
    return { status: 'repaired', digest: publishedDigest };
  }

  // (2) a genuinely new release candidate. Independently re-verify the current
  // on-disk freeze itself before this receipt is allowed to bind against it --
  // verifyFreezeManifest re-derives authority/ledger/tree/remediation ground
  // truth fresh and throws on any staleness or tampering. Trusting the freeze's
  // own recorded bytes/fields (via only a candidateDigest/treeDigest match
  // below) is not enough: a hand-edited freeze can recompute its own
  // candidateDigest to stay internally self-consistent, so this call must run
  // before any of that freeze's fields are relied on.
  if (!suppliedShapeOk) fail('malformed_receipt', 'supplied receipt fails the exact C12 schema');
  if (receipt.baselineAuthorityDigest !== authority.digest) fail('authority_mismatch', 'receipt baselineAuthorityDigest does not match the current authority');
  if (receipt.baselineGeneration !== authority.record.generation) fail('authority_mismatch', 'receipt baselineGeneration does not match the current authority generation');

  verifyFreezeManifest(root);
  const freezeLoaded = readJsonFileIfExists(root, REL.freeze);
  if (!freezeLoaded) fail('freeze_missing', 'advanceBaseline requires a valid current freeze');
  if (receipt.freezeDigest !== sha256Tag(freezeLoaded.bytes)) fail('freeze_mismatch', 'receipt freezeDigest does not match the current freeze bytes');
  const freeze = freezeLoaded.parsed;
  if (receipt.candidateDigest !== freeze.candidateDigest) fail('candidate_mismatch', 'receipt candidateDigest does not match the current freeze');
  if (receipt.treeDigest !== freeze.treeDigest) fail('candidate_mismatch', 'receipt treeDigest does not match the current freeze');
  if (receipt.packageVersion !== freeze.packageVersion) fail('candidate_mismatch', 'receipt packageVersion does not match the current freeze');

  const currentRemediated = sortedUnique(freeze.remediatedFailureIds);
  const receiptResolved = sortedUnique(receipt.resolvedFailureIds);
  if (JSON.stringify(currentRemediated) !== JSON.stringify(receiptResolved)) {
    fail('resolved_failure_ids_mismatch', 'receipt resolvedFailureIds diverges from the freeze remediatedFailureIds (I12)');
  }

  if (!isAncestorOrEqual(root, authority.record.baselineCommit, receipt.releaseCommit)) {
    fail('release_commit_unreachable', 'receipt releaseCommit is not reachable from the current baseline');
  }

  const artifactAbs = assertArtifactPath(root, receipt.artifactPath);
  const artifactDigest = sha256Tag(fs.readFileSync(artifactAbs));
  if (artifactDigest !== receipt.artifactDigest) fail('artifact_digest_mismatch', 'artifactDigest does not match the actual packaged bytes');

  // Prepare-then-validate-all, strictly before the first write: Event (A)'s
  // bytes (receiptBytes) are already fixed and schema/match-validated above;
  // Event (B)'s candidate is built and independently verified against
  // committed C10 provenance *here*, before either file is touched. Building
  // this candidate can throw (e.g. an out-of-band-edit/second-uncommitted-
  // advance rejection) exactly as easily as any check already run above --
  // running it only after Event (A) had already mutated release-receipt.json
  // would leave that file rewritten while release-baseline.json stayed
  // untouched on the very failure path this whole event sequence exists to
  // avoid. Neither file may be touched until both candidates are known-good.
  const previousBytes = authority.bytes;
  const newRecord = {
    state: 'released',
    generation: authority.record.generation + 1,
    baselineCommit: receipt.releaseCommit,
    baselinePackageVersion: receipt.packageVersion,
    releaseReceiptDigest: suppliedDigest,
    previousBaselineDigest: sha256Tag(previousBytes),
  };
  const newBytes = verifyBaselineCandidate(root, newRecord);

  // Event (A): persist the canonical receipt bytes verbatim, strictly before authority mutation.
  atomicWriteBytes(absPath(root, REL.receipt), receiptBytes);

  // Read-after-write verification (R1.11/I11), symmetric with the (1b) repair
  // branch above: re-read the exact bytes this write actually produced and
  // reuse the same digest/schema authority to prove event (A) landed --
  // never trust atomicWriteBytes alone. A physically corrupted write, a
  // concurrent clobber, or a filesystem fault throws fail-closed here,
  // strictly before event (B) ever runs, so authority is never rotated and
  // this call never returns `published`.
  const persistedRead = tryReadJsonFile(root, REL.receipt);
  const persistedOk = Boolean(persistedRead) && sha256Tag(persistedRead.bytes) === suppliedDigest && validateReceiptShape(persistedRead.parsed);
  if (!persistedOk) fail('receipt_unverifiable', 'event (A) receipt write did not durably persist verifiable canonical receipt evidence (re-read failed digest/schema verification)');

  // Event (B): rotate authority, the sole publication checkpoint, then invalidate the freeze.
  atomicWriteBytes(absPath(root, REL.releaseBaseline), newBytes);
  invalidateFreeze(root);

  return { status: 'published', digest: suppliedDigest, record: newRecord };
}

// ---------------------------------------------------------------------------
// Public factory + production (root-bound) surface
// ---------------------------------------------------------------------------

// Test/harness-only entry point: binds every D1 export to an explicit,
// once-verified trusted root. Production code must never call this with a
// caller-supplied path per call (I13/I19) -- use the plain top-level exports
// below instead, which are always bound to this checkout's real project root.
function createChangeFirewall(options = {}) {
  const root = resolveTrustedRoot(options.root);
  return {
    root,
    loadBaselineAuthority: () => loadBaselineAuthority(root),
    assertBaselineUsable: (opts) => assertBaselineUsable(root, opts),
    bootstrapBaseline: (attestation) => bootstrapBaseline(root, attestation),
    advanceBaseline: (receiptBytes) => advanceBaseline(root, receiptBytes),
    deriveProtectedChangedPaths: (baselineCommit, opts) => deriveProtectedChangedPaths(root, baselineCommit, opts),
    computeProtectedTreeDigest: (paths, opts) => computeProtectedTreeDigest(root, paths, opts),
    computeProposalDigest,
    computeCandidateDigest,
    assertHotspotChangeAllowed: (opts) => assertHotspotChangeAllowed(root, opts),
    createFreezeManifest: (proposal) => createFreezeManifest(root, proposal),
    verifyFreezeManifest: () => verifyFreezeManifest(root),
    invalidateFreeze: () => invalidateFreeze(root),
    loadFailureLedger: () => loadFailureLedger(root),
    assertFailureLedgerUsable: () => assertFailureLedgerUsable(root),
    openFailure: (input) => openFailure(root, input),
    classifyFailure: (input) => classifyFailure(root, input),
    reclassifyFailure: (input) => reclassifyFailure(root, input),
    resolveFailure: (input) => resolveFailure(root, input),
    computeFailureLedgerDigest: () => computeFailureLedgerDigest(root),
    deriveFailureState: (failureId) => deriveFailureState(loadFailureLedger(root), failureId),
    assertLegacyBridgeArtifact: () => readLegacyBridgeArtifact(root),
    NO_CHANGE_ATTESTATION_DIGEST,
    NO_FAILURES_ATTESTATION_DIGEST,
  };
}

let cachedDefaultRoot = null;
function defaultRoot() {
  if (!cachedDefaultRoot) cachedDefaultRoot = resolveTrustedRoot();
  return cachedDefaultRoot;
}

module.exports = {
  SCHEMA_VERSION,
  REL,
  ChangeFirewallError,
  NO_CHANGE_ATTESTATION_DIGEST,
  NO_FAILURES_ATTESTATION_DIGEST,
  isProtectedPath,
  sortedUnique,
  sha256Tag,
  createChangeFirewall,

  loadBaselineAuthority: () => loadBaselineAuthority(defaultRoot()),
  assertBaselineUsable: (opts) => assertBaselineUsable(defaultRoot(), opts),
  bootstrapBaseline: (attestation) => bootstrapBaseline(defaultRoot(), attestation),
  advanceBaseline: (receiptBytes) => advanceBaseline(defaultRoot(), receiptBytes),
  deriveProtectedChangedPaths: (baselineCommit, opts) => deriveProtectedChangedPaths(defaultRoot(), baselineCommit, opts),
  computeProtectedTreeDigest: (paths, opts) => computeProtectedTreeDigest(defaultRoot(), paths, opts),
  computeProposalDigest,
  computeCandidateDigest,
  assertHotspotChangeAllowed: (opts) => assertHotspotChangeAllowed(defaultRoot(), opts),
  createFreezeManifest: (proposal) => createFreezeManifest(defaultRoot(), proposal),
  verifyFreezeManifest: () => verifyFreezeManifest(defaultRoot()),
  invalidateFreeze: () => invalidateFreeze(defaultRoot()),

  loadFailureLedger: () => loadFailureLedger(defaultRoot()),
  assertFailureLedgerUsable: () => assertFailureLedgerUsable(defaultRoot()),
  openFailure: (input) => openFailure(defaultRoot(), input),
  classifyFailure: (input) => classifyFailure(defaultRoot(), input),
  reclassifyFailure: (input) => reclassifyFailure(defaultRoot(), input),
  resolveFailure: (input) => resolveFailure(defaultRoot(), input),
  computeFailureLedgerDigest: () => computeFailureLedgerDigest(defaultRoot()),
  deriveFailureState: (failureId) => deriveFailureState(loadFailureLedger(defaultRoot()), failureId),
  assertLegacyBridgeArtifact: () => readLegacyBridgeArtifact(defaultRoot()),
};
