#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SEMANTIC = require('./spec-semantic-model.cjs');
const VALIDATOR = require('./validate-spec-output.cjs');
const { canonicalProjectRoot, groundSpec } = require('./spec-ground.cjs');

const REVIEW_RESULT_FIELDS = Object.freeze([
  'verdict', 'findings', 'unresolved_decisions', 'graph_coverage',
  'reviewed_criteria', 'counterexamples', 'reviewer_evidence',
]);
const C2_RECEIPT_FIELDS = Object.freeze([
  'status', 'semantic_digest', 'verdict', 'lifecycle_disposition',
  'findings', 'unresolved_decisions', 'graph_coverage', 'repair_round',
  'reviewed_criteria', 'counterexamples', 'reviewer_evidence',
]);
const HISTORY_FIELDS = Object.freeze(['lineage_id', 'entries']);
const HISTORY_ENTRY_FIELDS = Object.freeze([
  'sequence', 'semantic_digest', 'review_receipt_digest', 'verdict',
  'lifecycle_disposition', 'blocking_count', 'attempt_index', 'review_epoch',
]);
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value, fields) {
  return plain(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort());
}

function stableDigest(value, semantic) {
  if (!semantic || typeof semantic.stableJson !== 'function') {
    throw new Error('semantic stableJson is required for readiness receipts');
  }
  const stable = semantic.stableJson(value);
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(stable, 'utf8')).digest('hex')}`;
}

function requireString(value, label, minimum = 1) {
  if (typeof value !== 'string' || value.length < minimum) {
    throw new Error(`${label} must be a string with at least ${minimum} characters`);
  }
}

function validateReviewFinding(finding, index) {
  if (!exactKeys(finding, ['id', 'severity', 'location', 'summary', 'blocking', 'disposition'])) {
    throw new Error(`semantic review finding ${index} fields must be exact`);
  }
  requireString(finding.id, `semantic review finding ${index}.id`);
  requireString(finding.location, `semantic review finding ${index}.location`);
  requireString(finding.summary, `semantic review finding ${index}.summary`, 8);
  if (!['Critical', 'High', 'Medium', 'Low'].includes(finding.severity)) {
    throw new Error(`semantic review finding ${index}.severity is invalid`);
  }
  if (typeof finding.blocking !== 'boolean') {
    throw new Error(`semantic review finding ${index}.blocking must be boolean`);
  }
  if (!['open', 'accepted', 'mitigated'].includes(finding.disposition)) {
    throw new Error(`semantic review finding ${index}.disposition is invalid`);
  }
}

function validateReviewDecision(decision, index) {
  if (!exactKeys(decision, ['id', 'summary', 'blocking'])) {
    throw new Error(`semantic review unresolved decision ${index} fields must be exact`);
  }
  requireString(decision.id, `semantic review unresolved decision ${index}.id`);
  requireString(decision.summary, `semantic review unresolved decision ${index}.summary`, 8);
  if (typeof decision.blocking !== 'boolean') {
    throw new Error(`semantic review unresolved decision ${index}.blocking must be boolean`);
  }
}

function validateGraphCoverage(surface, index) {
  if (!exactKeys(surface, ['surface', 'covered', 'notes'])) {
    throw new Error(`semantic review graph coverage ${index} fields must be exact`);
  }
  if (![
    'criterion_local', 'cross_criterion', 'runtime_path',
    'assumption_provenance', 'compatibility_migration',
  ].includes(surface.surface)) {
    throw new Error(`semantic review graph coverage ${index}.surface is invalid`);
  }
  if (typeof surface.covered !== 'boolean') {
    throw new Error(`semantic review graph coverage ${index}.covered must be boolean`);
  }
  requireString(surface.notes, `semantic review graph coverage ${index}.notes`);
}

function validateCounterexample(counterexample, index) {
  if (!exactKeys(counterexample, [
    'criterion', 'case_kind', 'scenario', 'expected', 'decision_refs', 'verification_ref',
  ])) {
    throw new Error(`semantic review counterexample ${index} fields must be exact`);
  }
  for (const field of ['criterion', 'case_kind', 'scenario', 'expected', 'verification_ref']) {
    requireString(counterexample[field], `semantic review counterexample ${index}.${field}`);
  }
  if (!Array.isArray(counterexample.decision_refs)
    || counterexample.decision_refs.some((value) => typeof value !== 'string')) {
    throw new Error(`semantic review counterexample ${index}.decision_refs must be string array`);
  }
}

function validateReviewerEvidence(evidence) {
  if (evidence === null) return;
  if (!exactKeys(evidence, ['assurance', 'summary'])) {
    throw new Error('semantic review reviewer_evidence fields must be exact');
  }
  if (!['Routine', 'Elevated', 'Strict'].includes(evidence.assurance)) {
    throw new Error('semantic review reviewer_evidence.assurance is invalid');
  }
  requireString(evidence.summary, 'semantic review reviewer_evidence.summary', 8);
}

function readReviewResult(input) {
  if (!exactKeys(input, REVIEW_RESULT_FIELDS)) {
    throw new Error(`semantic review result fields must be exactly ${REVIEW_RESULT_FIELDS.join(', ')}`);
  }
  if (input.verdict !== 'PASS' && input.verdict !== 'FAIL') {
    throw new Error('semantic review result verdict must be PASS or FAIL');
  }
  if (!Array.isArray(input.findings)) throw new Error('semantic review result findings must be an array');
  input.findings.forEach(validateReviewFinding);
  if (!Array.isArray(input.unresolved_decisions)) {
    throw new Error('semantic review result unresolved_decisions must be an array');
  }
  input.unresolved_decisions.forEach(validateReviewDecision);
  if (!Array.isArray(input.graph_coverage)) {
    throw new Error('semantic review result graph_coverage must be an array');
  }
  input.graph_coverage.forEach(validateGraphCoverage);
  if (!Array.isArray(input.reviewed_criteria)
    || input.reviewed_criteria.some((value) => typeof value !== 'string' || !/^R\d+\.\d+$/.test(value))
    || new Set(input.reviewed_criteria).size !== input.reviewed_criteria.length) {
    throw new Error('semantic review result reviewed_criteria must be unique RN.M strings');
  }
  if (!Array.isArray(input.counterexamples)) {
    throw new Error('semantic review result counterexamples must be an array');
  }
  input.counterexamples.forEach(validateCounterexample);
  validateReviewerEvidence(input.reviewer_evidence);
  return JSON.parse(JSON.stringify(input));
}

function blockingCount(review) {
  return review.findings.filter((finding) => finding.blocking).length
    + review.unresolved_decisions.filter((decision) => decision.blocking).length;
}

function buildCompletedReceipt(review, semanticDigest, recordedEntry) {
  return {
    status: 'completed',
    semantic_digest: semanticDigest,
    verdict: review.verdict,
    lifecycle_disposition: recordedEntry.lifecycle_disposition,
    findings: JSON.parse(JSON.stringify(review.findings)),
    unresolved_decisions: JSON.parse(JSON.stringify(review.unresolved_decisions)),
    graph_coverage: JSON.parse(JSON.stringify(review.graph_coverage)),
    repair_round: recordedEntry.attempt_index,
    reviewed_criteria: JSON.parse(JSON.stringify(review.reviewed_criteria)),
    counterexamples: JSON.parse(JSON.stringify(review.counterexamples)),
    reviewer_evidence: JSON.parse(JSON.stringify(review.reviewer_evidence)),
  };
}

function validateHistory(history) {
  if (!plain(history) || !exactKeys(history, HISTORY_FIELDS)) {
    throw new Error('spec.validation.semantic_review_history must contain exactly lineage_id and entries');
  }
  if (typeof history.lineage_id !== 'string' || !SHA256_RE.test(history.lineage_id)) {
    throw new Error('spec.validation.semantic_review_history.lineage_id must be a sha256 digest');
  }
  if (!Array.isArray(history.entries)) {
    throw new Error('spec.validation.semantic_review_history.entries must be an array');
  }

  const receipts = new Set();
  let priorPasses = 0;
  let failuresSincePass = 0;
  let blocked = false;
  for (const [index, entry] of history.entries.entries()) {
    if (!plain(entry) || !exactKeys(entry, HISTORY_ENTRY_FIELDS)) {
      throw new Error(`semantic review history entry ${index} fields diverge from the canonical entry`);
    }
    if (entry.sequence !== index) throw new Error(`semantic review history entry ${index} has a divergent sequence`);
    if (typeof entry.semantic_digest !== 'string' || !SHA256_RE.test(entry.semantic_digest)) {
      throw new Error(`semantic review history entry ${index} has an invalid semantic digest`);
    }
    if (typeof entry.review_receipt_digest !== 'string' || !SHA256_RE.test(entry.review_receipt_digest)) {
      throw new Error(`semantic review history entry ${index} has an invalid review receipt digest`);
    }
    if (receipts.has(entry.review_receipt_digest)) {
      throw new Error(`semantic review history entry ${index} duplicates a review receipt digest`);
    }
    receipts.add(entry.review_receipt_digest);
    if (entry.verdict !== 'PASS' && entry.verdict !== 'FAIL') {
      throw new Error(`semantic review history entry ${index} has an invalid verdict`);
    }
    if (entry.review_epoch !== priorPasses) {
      throw new Error(`semantic review history entry ${index} has a divergent review_epoch`);
    }
    if (entry.attempt_index !== failuresSincePass) {
      throw new Error(`semantic review history entry ${index} has a divergent attempt_index`);
    }
    if (entry.attempt_index > 2) {
      throw new Error(`semantic review history entry ${index} exceeds the terminal attempt limit`);
    }
    if (!Number.isInteger(entry.blocking_count) || entry.blocking_count < 0) {
      throw new Error(`semantic review history entry ${index} has an invalid blocking_count`);
    }
    const expectedDisposition = entry.verdict === 'PASS' || entry.attempt_index < 2
      ? 'CONTINUE' : 'BLOCKED';
    if (entry.lifecycle_disposition !== expectedDisposition) {
      throw new Error(`semantic review history entry ${index} has a divergent lifecycle_disposition`);
    }
    if (blocked) throw new Error('semantic review history contains an entry after BLOCKED');
    if (entry.verdict === 'PASS') {
      if (entry.blocking_count !== 0) throw new Error(`semantic review history entry ${index} PASS has blockers`);
      priorPasses += 1;
      failuresSincePass = 0;
    } else {
      failuresSincePass += 1;
      blocked = entry.lifecycle_disposition === 'BLOCKED';
    }
  }
  return { history: JSON.parse(JSON.stringify(history)), receipts, priorPasses, failuresSincePass, blocked };
}

function deriveLineageId(spec, semantic) {
  if (!plain(spec) || typeof spec.feature_name !== 'string' || spec.feature_name.length === 0) {
    throw new Error('spec.feature_name is required for semantic review lineage');
  }
  if (typeof spec.created_at !== 'string' || spec.created_at.length === 0) {
    throw new Error('spec.created_at is required for semantic review lineage');
  }
  return stableDigest({ feature_name: spec.feature_name, created_at: spec.created_at }, semantic);
}

function currentHistory(spec, semantic) {
  const lineageId = deriveLineageId(spec, semantic);
  const supplied = spec.validation?.semantic_review_history;
  if (supplied === undefined || supplied === null) {
    return {
      history: { lineage_id: lineageId, entries: [] },
      receipts: new Set(), priorPasses: 0, failuresSincePass: 0, blocked: false,
    };
  }
  const state = validateHistory(supplied);
  if (state.history.lineage_id !== lineageId) {
    throw new Error('spec.validation.semantic_review_history lineage_id diverges from spec identity');
  }
  return state;
}

function canonicalCheck({ directory, root, candidate, validator, grounder }) {
  const validation = validator.validateSpec(directory, candidate);
  if (validation.errors.length) throw new Error(`readiness validation failed (${validation.errors.join('; ')})`);
  const grounding = grounder({ specDir: directory, root, spec: candidate });
  if (grounding.errors.length) throw new Error(`readiness grounding failed (${grounding.errors.join('; ')})`);
}

function atomicReplace(file, bytes, io = fs) {
  const stat = io.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('spec.json must be a regular non-symlink file');
  const original = io.readFileSync(file);
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.finalize-${process.pid}-${Date.now()}`);
  let descriptor;
  try {
    descriptor = io.openSync(temporary, 'wx', stat.mode);
    io.writeFileSync(descriptor, bytes);
    io.fsyncSync(descriptor);
    io.closeSync(descriptor);
    descriptor = undefined;
    if (process.env.CAFEKIT_FINALIZE_FAIL_BEFORE_RENAME === '1') throw new Error('injected finalization failure before rename');
    io.renameSync(temporary, file);
  } catch (error) {
    if (descriptor !== undefined) try { io.closeSync(descriptor); } catch {}
    try { io.unlinkSync(temporary); } catch {}
    if (!io.readFileSync(file).equals(original)) {
      const rollback = `${temporary}-rollback`;
      try {
        io.writeFileSync(rollback, original, { flag: 'wx', mode: stat.mode });
        io.renameSync(rollback, file);
      } finally { try { io.unlinkSync(rollback); } catch {} }
    }
    throw error;
  }
}

function finalizeReadiness({
  specDir,
  reviewResult,
  projectRoot,
  io = fs,
  validator = VALIDATOR,
  grounder = groundSpec,
  semantic = SEMANTIC,
  now = new Date().toISOString(),
}) {
  const directory = io.realpathSync(path.resolve(specDir));
  const root = projectRoot ? io.realpathSync(path.resolve(projectRoot)) : canonicalProjectRoot(directory);
  const relative = path.relative(root, directory);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('spec directory escapes the canonical project root');
  }
  const specFile = path.join(directory, 'spec.json');
  const original = io.readFileSync(specFile);
  let spec;
  try { spec = JSON.parse(original); } catch (error) { throw new Error(`spec.json is invalid JSON (${error.message})`); }
  if (!plain(spec) || spec.schema_version !== '2.1') throw new Error('readiness finalization accepts canonical schema 2.1 only');
  const review = readReviewResult(reviewResult);
  const blockerCount = blockingCount(review);
  if (review.verdict === 'PASS' && blockerCount > 0) {
    throw new Error('semantic review PASS cannot contain blocking findings or unresolved decisions');
  }
  const state = currentHistory(spec, semantic);
  const projection = semantic.modelFromMarkdown(directory, spec);
  if (projection.errors.length) throw new Error(`semantic projection failed (${projection.errors.join('; ')})`);

  const candidate = JSON.parse(JSON.stringify(spec));
  candidate.semantic_model = projection.model;
  if (!plain(candidate.validation)) throw new Error('spec.validation must be an object');
  const authoringValidation = candidate.validation.authoring_validation;
  candidate.validation = {
    ...candidate.validation,
    status: 'completed',
    semantic_review_history: {
      lineage_id: state.history.lineage_id,
      entries: [...state.history.entries],
    },
  };
  if (JSON.stringify(candidate.validation.authoring_validation) !== JSON.stringify(authoringValidation)) {
    throw new Error('spec.validation.authoring_validation must be preserved');
  }

  candidate.ready_for_implementation = false;
  const digestResult = validator.computeSemanticDigest21(directory, candidate);
  if (digestResult.errors.length) throw new Error(`semantic digest failed (${digestResult.errors.join('; ')})`);
  for (const entry of state.history.entries) {
    const hypotheticalReceipt = buildCompletedReceipt(review, digestResult.digest, entry);
    const hypotheticalDigest = stableDigest(hypotheticalReceipt, semantic);
    if (entry.review_receipt_digest === hypotheticalDigest) {
      return {
        spec,
        semantic_digest: entry.semantic_digest,
        replayed: true,
        history_entry: entry,
      };
    }
  }
  if (state.blocked) throw new Error('readiness finalization refused: current review epoch already ends BLOCKED');
  const reviewEpoch = state.priorPasses;
  const attemptIndex = state.failuresSincePass;
  if (attemptIndex > 2) throw new Error('readiness finalization refused: no next attempt exists');
  const lifecycleDisposition = review.verdict === 'PASS' || attemptIndex < 2 ? 'CONTINUE' : 'BLOCKED';
  const receipt = buildCompletedReceipt(review, digestResult.digest, {
    attempt_index: attemptIndex,
    lifecycle_disposition: lifecycleDisposition,
  });
  if (!exactKeys(receipt, C2_RECEIPT_FIELDS)) {
    throw new Error('completed semantic review receipt fields diverge from C2');
  }
  candidate.validation.semantic_review = receipt;
  const reviewReceiptDigest = stableDigest(receipt, semantic);
  const historyEntry = {
    sequence: state.history.entries.length,
    semantic_digest: digestResult.digest,
    review_receipt_digest: reviewReceiptDigest,
    verdict: review.verdict,
    lifecycle_disposition: lifecycleDisposition,
    blocking_count: blockerCount,
    attempt_index: attemptIndex,
    review_epoch: reviewEpoch,
  };
  candidate.validation.semantic_review_history.entries.push(historyEntry);
  candidate.updated_at = now;
  canonicalCheck({ directory, root, candidate, validator, grounder });

  const ready = review.verdict === 'PASS'
    && lifecycleDisposition === 'CONTINUE'
    && blockerCount === 0
    && candidate.validation.semantic_review.semantic_digest === digestResult.digest;
  candidate.ready_for_implementation = ready;
  if (ready) {
    if (plain(candidate.timestamps)) {
      candidate.timestamps = { ...candidate.timestamps, validation_done: now };
    }
    canonicalCheck({ directory, root, candidate, validator, grounder });
  }

  const bytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`);
  atomicReplace(specFile, bytes, io);
  return { spec: candidate, semantic_digest: digestResult.digest, replayed: false, history_entry: historyEntry };
}

function usage() {
  process.stderr.write('Usage: node .claude/scripts/spec-readiness.cjs specs/<feature> --review-result <review.json>\n');
}

function main() {
  const args = process.argv.slice(2);
  const marker = args.indexOf('--review-result');
  if (args.length !== 3 || marker !== 1) { usage(); process.exitCode = 2; return; }
  try {
    const reviewFile = path.resolve(args[2]);
    const reviewStat = fs.lstatSync(reviewFile);
    if (!reviewStat.isFile() || reviewStat.isSymbolicLink()) throw new Error('review result must be a regular non-symlink JSON file');
    const reviewResult = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
    const result = finalizeReadiness({ specDir: args[0], reviewResult });
    process.stdout.write(`SPEC_READY ${args[0]} ${result.semantic_digest}\n`);
  } catch (error) {
    process.stderr.write(`SPEC_NOT_READY ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { atomicReplace, finalizeReadiness, readReviewResult };

if (require.main === module) main();
