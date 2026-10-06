'use strict';

// Shared C16 freshness primitive (D13). Owned by R0-01. This module is the sole
// place the raw-byte / stable-JSON digest algorithm for authoring artifacts is
// implemented; R1-01's spec-authoring-validation.cjs and validate-spec-output.cjs's
// authorized_evolution/finalizer freshness checks reuse it unmodified (I20).
//
// Non-circular: every digest here is computed only from an authored artifact's own
// bytes (requirements.md, design.md, research.md, task files). None of these ever
// hash semantic_digest, review_receipt_digest, or the C16 receipt's own bytes.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const RESEARCH_ABSENT_DIGEST = 'RESEARCH_ABSENT_DIGEST';
const TASKS_ABSENT_DIGEST = 'TASKS_ABSENT_DIGEST';

function asciiOrdinalCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Canonical stable-JSON bytes: object keys sorted by the same ordinal rule
// (JS's default Array.prototype.sort() on strings already compares by UTF-16
// code unit, i.e. ASCII ordinal for the ASCII-restricted keys/values in scope
// here), arrays kept in caller-supplied order. Matches the stableJson
// convention already used by spec-semantic-model.cjs / validate-spec-output.cjs.
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256Tag(bytes) {
  return `sha256:${sha256Hex(bytes)}`;
}

// Raw-byte sha256 of an exact file's current bytes, no normalization. Throws on
// a missing/non-regular file so callers cannot silently digest a symlink or a
// directory as if it were authored content.
function digestFileBytes(absolutePath) {
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile()) throw new Error(`${absolutePath} is not a regular file`);
  return sha256Tag(fs.readFileSync(absolutePath));
}

function listTaskFiles(specDir) {
  const tasksDir = path.join(specDir, 'tasks');
  let entries;
  try {
    entries = fs.readdirSync(tasksDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `tasks/${entry.name}`);
}

// sha256 over the stable-JSON canonical bytes of an array of {path, digest}
// objects, one per task file, sorted by path with the exact ASCII ordinal
// comparator (never localeCompare) — or the exact sentinel when taskless.
function computeTasksBundleDigest(specDir) {
  const taskPaths = listTaskFiles(specDir);
  if (taskPaths.length === 0) return TASKS_ABSENT_DIGEST;
  const bundle = taskPaths
    .map((relativePath) => ({
      path: relativePath,
      digest: digestFileBytes(path.join(specDir, relativePath)),
    }))
    .sort((a, b) => asciiOrdinalCompare(a.path, b.path));
  return sha256Tag(Buffer.from(stableJson(bundle), 'utf8'));
}

// Raw-byte sha256 of research.md, or the exact sentinel when absent. Absence is
// read from the file itself (the durable, unambiguous signal), not from the
// authoring.research enum, so this never depends on a caller-supplied claim.
function computeResearchDigest(specDir) {
  const researchPath = path.join(specDir, 'research.md');
  try {
    const stat = fs.lstatSync(researchPath);
    if (!stat.isFile()) return RESEARCH_ABSENT_DIGEST;
  } catch (error) {
    if (error.code === 'ENOENT') return RESEARCH_ABSENT_DIGEST;
    throw error;
  }
  return digestFileBytes(researchPath);
}

// Fresh digests recomputed, at read time, over a spec's exact current authoring
// bytes — the four C16 stages.
function computeCurrentDigests(specDir) {
  return {
    requirements: digestFileBytes(path.join(specDir, 'requirements.md')),
    design: digestFileBytes(path.join(specDir, 'design.md')),
    research: computeResearchDigest(specDir),
    tasks: computeTasksBundleDigest(specDir),
  };
}

// I20 exact freshness algorithm: a stage is fresh iff its authoring.<field>
// enum reads "validated" AND the C16 receipt is present with a stored digest
// for that field that exactly equals a digest freshly recomputed over the
// field's current bytes. Every other combination reads as draft.
function isFieldFresh({ authoringValue, receiptEntry, currentDigest }) {
  if (authoringValue !== 'validated') return false;
  if (!receiptEntry || typeof receiptEntry !== 'object') return false;
  if (typeof receiptEntry.digest !== 'string') return false;
  return receiptEntry.digest === currentDigest;
}

// Convenience wrapper: given a spec.json's own `authoring` and
// `validation.authoring_validation` (may be absent/null), report freshness for
// the requested stages against the spec's current on-disk bytes.
function assertAuthoringFresh({ specDir, authoring, receipt, fields = ['requirements', 'design'] }) {
  const currentDigests = computeCurrentDigests(specDir);
  const report = {};
  for (const field of fields) {
    const authoringValue = authoring && typeof authoring === 'object' ? authoring[field] : undefined;
    const receiptEntry = receipt && typeof receipt === 'object' ? receipt[field] : undefined;
    report[field] = {
      digest: currentDigests[field],
      authoringValue,
      fresh: isFieldFresh({ authoringValue, receiptEntry, currentDigest: currentDigests[field] }),
    };
  }
  return report;
}

module.exports = {
  RESEARCH_ABSENT_DIGEST,
  TASKS_ABSENT_DIGEST,
  asciiOrdinalCompare,
  stableJson,
  sha256Hex,
  sha256Tag,
  digestFileBytes,
  listTaskFiles,
  computeTasksBundleDigest,
  computeResearchDigest,
  computeCurrentDigests,
  isFieldFresh,
  assertAuthoringFresh,
};
