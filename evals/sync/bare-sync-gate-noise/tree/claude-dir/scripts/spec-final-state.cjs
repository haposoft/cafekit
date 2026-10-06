'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const SEMANTIC = require('./spec-semantic-model.cjs');

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function readBoundFile(root, target) {
  const requested = path.isAbsolute(target) ? target : path.resolve(root, target);
  if (!inside(root, requested)) return null;
  try {
    const canonicalRoot = fs.realpathSync(root);
    const canonical = fs.realpathSync(requested);
    if (!inside(canonicalRoot, canonical) || !fs.statSync(canonical).isFile()) return null;
    return fs.readFileSync(canonical);
  } catch { return null; }
}

function artifactReferences(body) {
  if (typeof body !== 'string') return [];
  const references = [];
  for (const line of body.split('\n')) {
    if (!/^\s*Artifacts?\s*:/i.test(line) && !/^\s*Artifact\s+produced\b/i.test(line)) continue;
    const hashes = [...line.matchAll(/\b(?:artifact[_-])?sha-?256\s*:\s*([^\s),;`]+)/gi)].map((match) => match[1]);
    const raw = line.replace(/^\s*Artifacts?\s*:\s*/i, '').replace(/^\s*Artifact\s+produced\s*:?[ \t]*/i, '').replace(/\b(?:artifact[_-])?sha-?256\s*:\s*[^\s),;`]+/gi, '').replace(/[()[\]{}]/g, ' ').trim();
    raw.split(/\s*(?:\+|,|;|\band\b)\s*/i).map((value) => value.trim()).filter(Boolean)
      .forEach((artifactPath, index) => references.push({ path: artifactPath, hash: hashes[index] || null }));
  }
  return references;
}

function validatorApi(validatorPath) {
  let imported;
  try { imported = require(validatorPath); }
  catch (error) { throw new Error(`canonical validator CommonJS API could not be loaded (${error.message})`); }
  if (typeof imported.validateSpec !== 'function' || typeof imported.computeSemanticDigest21 !== 'function') {
    throw new Error('canonical validator must export validateSpec and computeSemanticDigest21 CommonJS APIs');
  }
  return imported;
}

function stableDigest(value) {
  return `sha256:${crypto.createHash('sha256').update(SEMANTIC.stableJson(value), 'utf8').digest('hex')}`;
}

function validateTerminalSemanticReview(spec, semanticDigest) {
  const review = spec.validation?.semantic_review;
  if (!plain(review) || review.status !== 'completed') {
    return { ok: false, reason: 'canonical schema 2.1 final state requires a completed semantic review receipt' };
  }
  if (review.verdict !== 'PASS' || review.lifecycle_disposition !== 'CONTINUE') {
    return { ok: false, reason: 'canonical schema 2.1 final state requires semantic review PASS CONTINUE' };
  }
  if (!Array.isArray(review.findings) || !Array.isArray(review.unresolved_decisions)) {
    return { ok: false, reason: 'canonical schema 2.1 final state requires canonical semantic review findings and decisions' };
  }
  const blockingCount = review.findings.filter((finding) => finding?.blocking === true).length
    + review.unresolved_decisions.filter((decision) => decision?.blocking === true).length;
  if (blockingCount !== 0) {
    return { ok: false, reason: 'canonical schema 2.1 final state requires zero blocking findings or decisions' };
  }

  const entries = spec.validation?.semantic_review_history?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, reason: 'canonical schema 2.1 final state requires a latest semantic review history entry' };
  }
  const latest = entries[entries.length - 1];
  if (latest?.verdict !== 'PASS'
    || latest?.lifecycle_disposition !== 'CONTINUE'
    || latest?.blocking_count !== 0) {
    return { ok: false, reason: 'canonical schema 2.1 final state requires latest history PASS CONTINUE with blocking_count 0' };
  }
  if (latest.semantic_digest !== semanticDigest || latest.semantic_digest !== review.semantic_digest) {
    return { ok: false, reason: 'canonical schema 2.1 final state requires latest history and receipt semantic_digest to match' };
  }
  if (!Number.isInteger(review.repair_round) || review.repair_round !== latest.attempt_index) {
    return { ok: false, reason: 'canonical schema 2.1 final state requires receipt repair_round to equal latest history attempt_index' };
  }
  if (latest.review_receipt_digest !== stableDigest(review)) {
    return { ok: false, reason: 'canonical schema 2.1 final state requires latest history review_receipt_digest to match the canonical receipt' };
  }
  return { ok: true };
}

function isDurableCloseout(spec) {
  if (!plain(spec)) return false;
  if (spec.schema_version === '2.1') return spec.status === 'done';
  const phase = spec.current_phase || spec.phase;
  return ['done', 'completed', 'complete'].includes(spec.status)
    || ['closeout', 'completion', 'completed', 'complete'].includes(phase);
}

function isValidLifecycleStatus(spec) {
  if (!plain(spec)) return false;
  if (spec.schema_version === '2.1') return ['in_progress', 'paused', 'blocked', 'done'].includes(spec.status);
  return ['in_progress', 'in-progress', 'paused', 'blocked', 'done', 'completed', 'complete'].includes(spec.status);
}

function validateCanonicalFinalState({ policy, projectRoot, candidate, dependencies }) {
  if (candidate.spec.schema_version !== '2.1') return { ok: true, legacy: true, semanticDigest: null };
  const featureDir = candidate.featureDir || path.dirname(candidate.specFile);
  const review = candidate.spec.validation?.semantic_review;
  if (candidate.spec.ready_for_implementation !== true
    || candidate.spec.validation?.status !== 'completed'
    || review?.status !== 'completed'
    || !SHA256_RE.test(review?.semantic_digest || '')) {
    return { ok: false, reason: 'canonical schema 2.1 terminal state requires completed readiness and a bound semantic digest' };
  }
  let apis;
  try { apis = dependencies(); }
  catch (error) { return { ok: false, reason: error.message }; }
  let validation;
  try { validation = apis.validator.validateSpec(featureDir); }
  catch (error) { return { ok: false, reason: `canonical schema 2.1 validation failed safely (${error.message})` }; }
  if (!validation || !Array.isArray(validation.errors) || validation.errors.length > 0) {
    return { ok: false, reason: `canonical schema 2.1 validation failed (${(validation?.errors || ['invalid validator result']).slice(0, 4).join('; ')})` };
  }
  let grounding;
  try { grounding = apis.grounder.groundSpec({ specDir: featureDir, root: projectRoot, spec: candidate.spec }); }
  catch (error) { return { ok: false, reason: `canonical schema 2.1 grounding failed safely (${error.message})` }; }
  if (!grounding || !Array.isArray(grounding.errors) || grounding.errors.length > 0) {
    return { ok: false, reason: `canonical schema 2.1 grounding failed (${(grounding?.errors || ['invalid grounder result']).slice(0, 4).join('; ')})` };
  }
  let digest;
  try {
    const result = apis.validator.computeSemanticDigest21(featureDir, candidate.spec);
    if (!result || !Array.isArray(result.errors) || result.errors.length > 0 || !SHA256_RE.test(result.digest || '')) {
      return { ok: false, reason: `canonical semantic digest could not be recomputed (${(result?.errors || ['invalid digest result']).slice(0, 4).join('; ')})` };
    }
    digest = result.digest;
  } catch (error) {
    return { ok: false, reason: `canonical semantic digest could not be recomputed (${error.message})` };
  }
  if (digest !== review.semantic_digest) return { ok: false, reason: 'canonical semantic digest is stale for the current final-state artifacts' };
  const terminalReview = validateTerminalSemanticReview(candidate.spec, digest);
  if (!terminalReview.ok) return { ok: false, reason: terminalReview.reason };
  if (policy.readWorkflowPolicySnapshot(candidate.spec).assurance_level === 'Strict') {
    const observed = apis.semanticAuthority.verifyAttestation(projectRoot, candidate.specFile, candidate.featureName, digest);
    if (!observed?.ok) return { ok: false, reason: `Strict semantic authority requires an allowlisted host-hook-observed reviewer PASS event (${observed?.reason || 'observation unavailable'})` };
  }
  return { ok: true, legacy: false, semanticDigest: digest };
}

function configuredProjectMinimum(policy, runtime = {}) {
  const configured = runtime.spec?.policy_minimum;
  if (configured === undefined) return policy.canonicalWorkflowPolicySnapshot({ planning_depth: 'Compact', assurance_level: 'Routine' });
  if (!plain(configured)) throw new Error('runtime.spec.policy_minimum must be a canonical policy object');
  return policy.canonicalWorkflowPolicySnapshot(Object.prototype.hasOwnProperty.call(configured, 'version') ? { workflow_policy: configured } : configured);
}

function axisRank(values, value) { return Array.isArray(values) ? values.indexOf(value) : -1; }
function canonicalPolicy(policy, snapshot) { return policy.canonicalWorkflowPolicySnapshot({ workflow_policy: snapshot }); }
function policyView(policy, snapshot) { return policy.readWorkflowPolicySnapshot({ workflow_policy: canonicalPolicy(policy, snapshot) }); }

function policyMonotonicFailures(policy, baseline, current) {
  const failures = [];
  const before = policyView(policy, baseline);
  const after = policyView(policy, current);
  for (const [field, values] of [['planning_depth', policy.PLANNING_DEPTHS], ['automatic_planning_depth', policy.PLANNING_DEPTHS], ['assurance_level', policy.ASSURANCE_LEVELS], ['automatic_assurance_level', policy.ASSURANCE_LEVELS]]) {
    if (axisRank(values, after[field]) < axisRank(values, before[field])) failures.push(`workflow_policy.${field === 'automatic_planning_depth' ? 'classified_minimum.planning_depth' : field === 'automatic_assurance_level' ? 'classified_minimum.assurance_level' : field} downgraded from ${before[field]} to ${after[field]}`);
  }
  const risks = new Set(after.risks);
  for (const risk of before.risks) if (!risks.has(risk)) failures.push(`workflow_policy risk ${risk} was removed`);
  const obligations = new Set(after.proof_obligations);
  for (const obligation of before.proof_obligations) if (!obligations.has(obligation)) failures.push(`workflow_policy obligation ${obligation} was removed`);
  return failures;
}

function mergePolicyFloor(policy, floor, current) {
  const merged = { ...current, risks: [...new Set([...(current.risks || []), ...(floor.risks || [])])] };
  for (const [field, values] of [['planning_depth', policy.PLANNING_DEPTHS], ['automatic_planning_depth', policy.PLANNING_DEPTHS], ['assurance_level', policy.ASSURANCE_LEVELS], ['automatic_assurance_level', policy.ASSURANCE_LEVELS]]) {
    if (axisRank(values, floor[field]) > axisRank(values, current[field])) merged[field] = floor[field];
  }
  const riskFloor = policy.classifyLane({ risks: merged.risks, taskCount: 1 }).automaticAssuranceLevel;
  if (axisRank(policy.ASSURANCE_LEVELS, riskFloor) > axisRank(policy.ASSURANCE_LEVELS, merged.automatic_assurance_level)) merged.automatic_assurance_level = riskFloor;
  if (axisRank(policy.ASSURANCE_LEVELS, merged.automatic_assurance_level) > axisRank(policy.ASSURANCE_LEVELS, merged.assurance_level)) merged.assurance_level = merged.automatic_assurance_level;
  merged.lane = policy.compatibilityLane(merged.planning_depth, merged.assurance_level);
  merged.automatic_lane = policy.compatibilityLane(merged.automatic_planning_depth, merged.automatic_assurance_level);
  merged.artifact_profile = { None: 'targeted', Compact: 'bounded', Full: 'strict' }[merged.planning_depth];
  merged.planning_obligations = policy.planningObligationsFor(merged.planning_depth);
  merged.proof_obligations = policy.obligationsForAssurance(merged.assurance_level, merged.risks);
  merged.actor_needs = policy.actorNeedsFor(merged.proof_obligations);
  return merged;
}

function observePolicyBaseline({ state, policy, projectRoot, candidate, runtime }) {
  if (!Object.prototype.hasOwnProperty.call(candidate.spec, 'workflow_policy')) return { ok: false, reason: 'workflow_policy is missing for persisted spec' };
  const validation = policy.validateWorkflowPolicySnapshot(candidate.spec.workflow_policy);
  if (!validation.valid) return { ok: false, reason: `workflow_policy is malformed: ${validation.errors.join('; ')}` };
  const current = canonicalPolicy(policy, candidate.spec.workflow_policy);
  try {
    const identity = { project_root: fs.realpathSync(projectRoot), spec_file: fs.realpathSync(candidate.specFile), feature_name: candidate.featureName };
    state.ensureKey();
    let authorityState = state.readState(projectRoot);
    if (authorityState.malformed || authorityState.keyError || authorityState.keyMissing) return { ok: false, reason: authorityState.reason || 'completion authority state is unavailable' };
    const projectMinimum = configuredProjectMinimum(policy, runtime);
    const minimumFailures = policyMonotonicFailures(policy, projectMinimum, current);
    if (minimumFailures.length) return { ok: false, reason: `workflow_policy is below the configured project minimum (${minimumFailures.join('; ')})` };
    if (!authorityState.floor || state.digest(authorityState.floor.policy) !== state.digest(projectMinimum)) {
      state.writePolicyFloor(projectRoot, projectMinimum);
      authorityState = state.readState(projectRoot);
      if (authorityState.malformed || authorityState.keyError || authorityState.keyMissing || !authorityState.floor) return { ok: false, reason: authorityState.reason || 'configured project policy minimum could not be persisted' };
    }
    const baseline = state.readBaseline(projectRoot, identity);
    if (!baseline) { state.writeBaseline(projectRoot, identity, current); return { ok: true }; }
    const baselineValidation = policy.validateWorkflowPolicySnapshot(baseline.policy);
    if (!baselineValidation.valid) return { ok: false, reason: `persisted workflow policy baseline is malformed: ${baselineValidation.errors.join('; ')}` };
    const failures = policyMonotonicFailures(policy, baseline.policy, current);
    if (failures.length) return { ok: false, reason: `workflow_policy baseline is monotonic and cannot be downgraded (${failures.join('; ')})` };
    if (state.digest(baseline.policy) !== state.digest(current)) state.writeBaseline(projectRoot, identity, current);
    return { ok: true };
  } catch (error) { return { ok: false, reason: `workflow_policy baseline unavailable: ${error.message}` }; }
}

function createAuthority(adapter) {
  if (!adapter || typeof adapter.resolveCandidate !== 'function' || !adapter.state || !adapter.receipts || typeof adapter.dependencies !== 'function') {
    throw new Error('final-state runtime adapter is incomplete');
  }
  const finalStateDependencies = (overrides = {}) => {
    if (overrides.validator && overrides.grounder && overrides.semanticAuthority) return overrides;
    const loaded = adapter.dependencies(overrides);
    if (typeof loaded.validator?.validateSpec !== 'function' || typeof loaded.validator?.computeSemanticDigest21 !== 'function' || typeof loaded.grounder?.groundSpec !== 'function' || typeof loaded.semanticAuthority?.verifyAttestation !== 'function') throw new Error('canonical final-state validator, grounder, or semantic authority API is unavailable');
    return loaded;
  };
  const resolveCandidate = (input) => adapter.resolveCandidate(input);
  const validate = (input) => validateCanonicalFinalState({ ...input, dependencies: () => finalStateDependencies(input.dependencies || {}) });

  function evaluateCloseout({ policy, projectRoot, runtime = {}, payload = {}, finalState = {}, resolver }) {
    if (payload.stop_hook_active === true) return { ok: true, active: false, candidate: null };
    const candidate = resolveCandidate({ resolver, projectRoot, runtime, payload });
    if (!candidate) return { ok: true, candidate: null };
    if (candidate.error) return { ok: false, candidate, reason: `${candidate.error}: ${Array.isArray(candidate.candidates) ? candidate.candidates.join(', ') : (candidate.reason || candidate.error)}` };
    if (!isValidLifecycleStatus(candidate.spec)) return { ok: false, candidate, reason: `spec status is invalid: ${String(candidate.spec.status)}` };
    if (!isDurableCloseout(candidate.spec)) return { ok: true, active: false, candidate };
    const canonical = validate({ policy, projectRoot, candidate, dependencies: finalState });
    if (!canonical.ok) return { ok: false, candidate, reason: canonical.reason };
    const sessionId = payload.session_id;
    if (typeof sessionId !== 'string' || !sessionId.trim()) return { ok: false, candidate, reason: 'trusted host session ID is unavailable' };
    const baseline = observePolicyBaseline({ state: adapter.state, policy, projectRoot, candidate, runtime });
    if (!baseline.ok) return { ok: false, candidate, reason: baseline.reason };
    if (runtime.spec?.completion_gate !== undefined && runtime.spec.completion_gate !== true) return { ok: false, candidate, reason: 'runtime.spec.completion_gate is worker-writable and cannot authorize completion' };
    const registry = plain(candidate.spec.task_registry) ? candidate.spec.task_registry : {};
    const featureDir = path.join(candidate.specsDir, candidate.featureName);
    if (Object.keys(registry).length === 0 && !policy.isCanonicalTasklessTerminalSpec(candidate.spec, featureDir)) return { ok: false, candidate, reason: 'task_registry is missing or empty outside canonical schema 2.1 taskless topology' };
    let runtimeContext;
    try { runtimeContext = policy.deriveRuntimeContext({ projectRoot, specsRoot: candidate.specsDir, specFile: candidate.specFile, featureName: candidate.featureName, runtimeSession: sessionId }); }
    catch (error) { return { ok: false, candidate, reason: `runtime provenance unavailable: ${error.message}` }; }
    if (!policy.isTrustedRuntimeContext(runtimeContext)) return { ok: false, candidate, reason: 'fresh trusted runtime Base/Head/context is unavailable' };
    const receiptBodies = [];
    const taskFiles = [];
    const failures = [];
    for (const [taskPath, task] of Object.entries(registry)) {
      if (!plain(task) || task.status !== 'done') { failures.push(`${taskPath}: status is not done`); continue; }
      if (policy.isStaleFlashDone(task)) failures.push(`${taskPath}: FLASH_UNVERIFIED`);
      const receipt = adapter.receipts.task(featureDir, taskPath, task, runtimeContext, policy);
      if (receipt.failures.length) failures.push(`${taskPath}: checks ${receipt.failures.join(',')}`);
      if (receipt.body) receiptBodies.push(receipt.body);
      if (receipt.taskFile && receipt.receiptBytes) taskFiles.push({ path: taskPath, task_digest: crypto.createHash('sha256').update(receipt.taskFile.bytes).digest('hex'), receipt_digest: crypto.createHash('sha256').update(receipt.receiptBytes).digest('hex'), receipt_source: receipt.source });
    }
    const featureReceipt = adapter.receipts.feature(featureDir, runtimeContext, policy);
    if (featureReceipt.failures.length) failures.push(`feature-receipt.md: checks ${featureReceipt.failures.join(',')}`);
    if (failures.length) return { ok: false, candidate, reason: `technical completion proof is incomplete (${failures.slice(0, 4).join('; ')})` };
    let completion;
    try { completion = policy.completionDecisionForSpec(candidate.spec, { runtimeContext, executionReceipt: featureReceipt.body, taskContext: {} }); }
    catch (error) { return { ok: false, candidate, reason: `workflow completion proof could not be evaluated: ${error.message}` }; }
    if (!['complete', 'not_applicable'].includes(completion.completion)) return { ok: false, candidate, reason: completion.blocker || 'workflow completion proof is incomplete' };
    if (featureReceipt.body) receiptBodies.push(featureReceipt.body);
    const artifactFiles = receiptBodies.flatMap(artifactReferences).sort((a, b) => `${a.path}:${a.hash}`.localeCompare(`${b.path}:${b.hash}`)).map((reference) => ({ ...reference, digest: crypto.createHash('sha256').update(readBoundFile(projectRoot, reference.path) || Buffer.from('<missing>')).digest('hex') }));
    const digest = adapter.state.digest;
    const specBytes = readBoundFile(projectRoot, candidate.specFile);
    const binding = { project_root: runtimeContext.project_root, platform: process.platform, session_id: sessionId, feature_name: candidate.featureName, spec_file: candidate.specFile, runtime: { base: runtimeContext.base, head: runtimeContext.head, context_id: runtimeContext.context_id }, spec_digest: digest(candidate.spec), spec_bytes_digest: crypto.createHash('sha256').update(specBytes || Buffer.from('<missing>')).digest('hex'), policy_digest: digest(candidate.spec.workflow_policy ?? null), task_registry_digest: digest(registry), task_digest: digest(taskFiles), semantic_digest: canonical.semanticDigest, feature_receipt_digest: crypto.createHash('sha256').update(featureReceipt.receiptBytes).digest('hex'), artifact_digest: digest(artifactFiles), provenance_digest: digest({ runtime: runtimeContext, receipts: receiptBodies.map((body) => body.match(/^\s*(?:Base|Head|base_sha|head_sha)\s*:.*$/gim) || []) }) };
    binding.binding_digest = digest(binding);
    return { ok: true, active: true, candidate, runtimeContext, binding };
  }

  return { configuredProjectMinimum, evaluateCloseout, finalStateDependencies, isDurableCloseout, isValidLifecycleStatus, mergePolicyFloor, observePolicyBaseline: (input) => observePolicyBaseline({ ...input, state: input.STATE || adapter.state }), policyMonotonicFailures, resolveCandidate, validateCanonicalFinalState: validate, validatorApi };
}

module.exports = { createAuthority, isDurableCloseout, isValidLifecycleStatus, validateCanonicalFinalState, validatorApi };
