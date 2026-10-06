'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PROVENANCE = require('./provenance.cjs');

const CANONICAL_VERDICTS = Object.freeze(['PASS', 'PASS_WITH_WARNINGS', 'FAIL', 'BLOCKED']);
const LEGACY_DIAGNOSTIC_VERDICTS = Object.freeze(['PARTIAL', 'NO_TESTS']);
const REVIEW_VERDICTS = CANONICAL_VERDICTS;
const EXECUTION_TIERS = Object.freeze(['Light', 'Standard', 'Deep']);
const LANES = Object.freeze(['Direct', 'Standard', 'Critical']);
const PLANNING_DEPTHS = Object.freeze(['None', 'Compact', 'Full']);
const ASSURANCE_LEVELS = Object.freeze(['Routine', 'Elevated', 'Strict']);
const ARTIFACT_PROFILES = Object.freeze(['targeted', 'bounded', 'strict']);
const PLANNING_OBLIGATIONS = Object.freeze([
  'needsRequirements',
  'needsDesign',
]);
const PROOF_OBLIGATIONS = Object.freeze([
  'needsInspection',
  'needsExecutionProof',
  'needsIndependentAudit',
  'needsDurableTaskState',
]);
const READ_COMPAT_PROOF_OBLIGATIONS = Object.freeze([
  ...PROOF_OBLIGATIONS,
  'needsResearchGrounding',
]);
const WORKFLOW_POLICY_VERSION = '2';
const CANONICAL_WORKFLOW_POLICY_VERSION = '2.1';
const CANONICAL_WORKFLOW_POLICY_FIELDS = Object.freeze([
  'version',
  'planning_depth',
  'assurance_level',
  'classified_minimum',
  'risks',
]);
const WORKFLOW_POLICY_FIELDS = Object.freeze([
  'version',
  'planning_depth',
  'automatic_planning_depth',
  'assurance_level',
  'automatic_assurance_level',
  'lane',
  'automatic_lane',
  'risks',
  'artifact_profile',
  'planning_obligations',
  'proof_obligations',
  'actor_needs',
  'override_receipt',
]);
const RECEIPT_BINDING_FIELDS = Object.freeze(['expectedProvenance', 'requireProvenanceBinding']);
const INDEPENDENT_AUDIT_SCHEMA_VERSION = '1';
const INDEPENDENT_AUDIT_FIELDS = Object.freeze([
  'schema_version',
  'reviewer_session_id',
  'implementation_session_id',
  'expected_provenance',
  'evidence',
  'verdict',
]);
const FLASH_PROMOTION_FIELDS = Object.freeze(['readyForSync', 'flashTransition', 'promotionReceipt']);
const LEGACY_TIER_LANES = Object.freeze({ Light: 'Direct', Standard: 'Standard', Deep: 'Critical' });
const V1_POLICY_FIELDS = Object.freeze([
  'version', 'lane', 'automatic_lane', 'risks', 'artifact_profile',
  'proof_obligations', 'actor_needs', 'override_receipt',
]);
const ARTIFACT_PROFILE_BY_LANE = Object.freeze({ Direct: 'targeted', Standard: 'bounded', Critical: 'strict' });
const ARTIFACT_PROFILE_BY_PLANNING = Object.freeze({ None: 'targeted', Compact: 'bounded', Full: 'strict' });
const ACTOR_NEEDS_BY_OBLIGATION = Object.freeze({
  needsInspection: Object.freeze({ capability: 'inspection', independence: 'same-session' }),
  needsExecutionProof: Object.freeze({ capability: 'execution-proof', independence: 'same-session' }),
  needsIndependentAudit: Object.freeze({ capability: 'audit', independence: 'independent' }),
  needsDurableTaskState: Object.freeze({ capability: 'durable-task-state', independence: 'same-session' }),
  needsResearchGrounding: Object.freeze({ capability: 'research-grounding', independence: 'same-session' }),
});
const ACTOR_CAPABILITIES = new Set(Object.values(ACTOR_NEEDS_BY_OBLIGATION).map((need) => need.capability));
const ACTOR_INDEPENDENCE = new Set(['same-session', 'independent']);
const LANE_RISK_KEYS = Object.freeze({
  reversibility: ['reversible', 'reversibility', 'irreversible', 'non-reversible'],
  destructive: ['destructive', 'deletion', 'delete', 'destroy'],
  auth: ['auth', 'authentication', 'authorization'],
  payment: ['payment', 'billing', 'charge'],
  privacy: ['privacy', 'pii', 'personal data'],
  data: ['data loss', 'loss of data', 'data corruption', 'corrupt data', 'data integrity'],
  schema: ['schema'],
  migration: ['migration', 'migrate', 'database migration'],
  publicContract: ['publicContract', 'public_contract', 'public contract', 'api contract', 'breaking change', 'backward compatibility'],
  crossRuntime: ['crossRuntime', 'cross-runtime', 'cross runtime', 'cross_service', 'cross-service', 'runtime coupling', 'worker', 'webhook'],
  ambiguity: ['ambiguous', 'ambiguity', 'unclear', 'unknown requirements', 'underspecified'],
  rollback: ['rollback', 'rollback difficulty', 'hard to rollback', 'cannot rollback', 'no rollback'],
});

function hasOwn(value, key) {
  return value !== null
    && (typeof value === 'object' || typeof value === 'function')
    && Object.prototype.hasOwnProperty.call(value, key);
}

const PLACEHOLDER_TOKENS = new Set(['TBD','TODO','N/A','NA','NONE','UNKNOWN','PENDING','PLACEHOLDER','REPLACE_ME','-','?']);
const TAP_METADATA_HEADING_RE = /^\s*#\s*(?:(?:tests?|suites?|pass|fail|cancel(?:l)?ed|skipped|todo)\s+\d+|duration(?:_ms)?\s+\d+(?:\.\d+)?)\s*$/i;
const ARTIFACT_DECLARATION_KEY = 'artifacts';
const TASK_ARTIFACT_KEYS = Object.freeze(['artifact', 'artifact_ref', 'artifact_path']);
const PROVENANCE_VALUE_RE = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const PROSE_RECEIPT_FIELD_RE = /^\s*(?:Notes?|Description|Command(?:\(s\))?)\s*:/i;
function isPlaceholderToken(value) {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  if (v === '') return true;
  if (/^\{\{.*\}\}$/.test(v)) return true;
  if (/^<.*>$/.test(v)) return true;
  const upper = v.toUpperCase();
  if (PLACEHOLDER_TOKENS.has(upper)) return true;
  return false;
}
function isTapMetadataHeading(line) {
  return typeof line === 'string' && TAP_METADATA_HEADING_RE.test(line);
}

function hasConcreteArtifactDeclaration(value) {
  if (typeof value === 'string') return !isPlaceholderToken(value);
  if (Array.isArray(value)) return value.some(hasConcreteArtifactDeclaration);
  return Boolean(value && typeof value === 'object');
}

function isSafeArtifactPath(value) {
  if (typeof value !== 'string' || value !== value.trim() || isPlaceholderToken(value)) return false;
  if (/^(?:[a-z]:[\\/]|[\\/]|https?:\/\/)/i.test(value)) return false;
  return !value.split(/[\\/]+/).includes('..');
}

function isPathInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function stableStat(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs?.toString(), stat.ctimeNs?.toString()].join(':');
}

function hashValidatedArtifact(root, relativePath, expectedHash) {
  if (!isSafeArtifactPath(relativePath) || typeof root !== 'string' || root.trim() === '') return false;
  const rootPath = path.resolve(root);
  const target = path.resolve(rootPath, relativePath);
  if (!isPathInside(rootPath, target)) return false;

  const segments = path.relative(rootPath, target).split(path.sep).filter(Boolean);
  let current = rootPath;
  try {
    for (let index = 0; index < segments.length; index += 1) {
      current = path.join(current, segments[index]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return false;
      if (index < segments.length - 1 && !stat.isDirectory()) return false;
    }
    const rootReal = fs.realpathSync(rootPath);
    const targetReal = fs.realpathSync(target);
    if (!isPathInside(rootReal, targetReal)) return false;
    const before = fs.statSync(target);
    if (!before.isFile()) return false;
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
    const fd = fs.openSync(target, flags);
    try {
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || stableStat(opened) !== stableStat(before)) return false;
      const bytes = fs.readFileSync(fd);
      const after = fs.fstatSync(fd);
      if (stableStat(after) !== stableStat(opened)) return false;
      const actual = crypto.createHash('sha256').update(bytes).digest('hex');
      return actual.toLowerCase() === String(expectedHash).toLowerCase();
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) {
    return false;
  }
}

function artifactDeclaration(task = {}) {
  if (Object.prototype.hasOwnProperty.call(task, ARTIFACT_DECLARATION_KEY)) {
    const artifacts = task[ARTIFACT_DECLARATION_KEY];
    const unique = Array.isArray(artifacts) ? new Set(artifacts).size === artifacts.length : false;
    return {
      declared: true,
      valid: Array.isArray(artifacts)
        && artifacts.length > 0
        && unique
        && artifacts.every(isSafeArtifactPath),
      paths: Array.isArray(artifacts) ? [...artifacts] : [],
    };
  }

  // Read legacy aliases only for compatibility with pre-P0 task registries.
  const legacyKey = TASK_ARTIFACT_KEYS.find((key) => hasConcreteArtifactDeclaration(task?.[key]));
  const legacyValue = legacyKey ? task[legacyKey] : null;
  const legacyPaths = typeof legacyValue === 'string'
    ? [legacyValue]
    : Array.isArray(legacyValue) && legacyValue.every((value) => typeof value === 'string')
      ? [...legacyValue]
      : [];
  return {
    declared: Boolean(legacyKey),
    valid: !legacyKey || (legacyPaths.length > 0 && legacyPaths.every(isSafeArtifactPath)),
    legacy: true,
    paths: legacyPaths,
  };
}

function normalizeProvenanceValue(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^sha256:/i, '');
  return normalized || null;
}

function isConcreteProvenanceValue(value) {
  return PROVENANCE_VALUE_RE.test(normalizeProvenanceValue(value) || '');
}

function runtimeContextFromContext(context) {
  const candidates = [
    context?.runtime_context,
    context?.runtimeContext,
    context?.provenance_context,
    context?.provenanceContext,
    context?.receipt_binding?.runtimeContext,
    context?.receiptBinding?.runtimeContext,
    context?.provenance_binding?.runtimeContext,
    context?.provenanceBinding?.runtimeContext,
  ];
  const candidate = candidates.find((value) => PROVENANCE.isTrustedRuntimeContext(value));
  if (!candidate) return null;
  try { return PROVENANCE.recomputeRuntimeContext(candidate); } catch (_) { return null; }
}

function firstDefined(source, keys) {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  }
  return undefined;
}

function expectedProvenanceFromSource(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const nested = firstDefined(source, [
    'expectedProvenance',
    'expected_provenance',
  ]);
  const candidate = nested && typeof nested === 'object' && !Array.isArray(nested)
    ? nested
    : source;
  const base = firstDefined(candidate, [
    'base', 'Base', 'base_sha', 'baseSha', 'expectedBase', 'expected_base',
    'expectedBaseSha', 'expected_base_sha',
  ]);
  const head = firstDefined(candidate, [
    'head', 'Head', 'head_sha', 'headSha', 'expectedHead', 'expected_head',
    'expectedHeadSha', 'expected_head_sha',
  ]);
  if (base === undefined && head === undefined) return null;
  return { base, head };
}

function createReceiptBinding(runtimeContext) {
  if (!PROVENANCE.isTrustedRuntimeContext(runtimeContext)) {
    throw new TypeError('Receipt binding requires a runtime-derived provenance context');
  }
  try { return PROVENANCE.createReceiptBinding(runtimeContext); } catch (error) {
    throw new TypeError(error.message);
  }
}

function receiptValidatorOptions(task = {}, {
  requireProvenanceBinding = false,
  requireExplicitBinding = false,
  runtimeContext,
} = {}) {
  const declaration = artifactDeclaration(task);
  let trusted = null;
  if (runtimeContext !== undefined && PROVENANCE.isTrustedRuntimeContext(runtimeContext)) {
    try { trusted = PROVENANCE.recomputeRuntimeContext(runtimeContext); } catch (_) { trusted = null; }
  }
  return {
    requireArtifactHash: declaration.declared,
    artifactDeclarationValid: declaration.valid,
    artifactPaths: declaration.paths,
    artifactRoot: trusted?.project_root || null,
    verifyArtifactBytes: Boolean(trusted?.project_root),
    expectedProvenance: trusted ? { base: trusted.base, head: trusted.head } : null,
    requireProvenanceBinding: requireProvenanceBinding || (runtimeContext !== undefined && runtimeContext !== null) || requireExplicitBinding,
  };
}

function sha256ValuesFromLine(line) {
  const values = [];
  const labels = [...line.matchAll(/\b(?:artifact[_-])?sha-?256\s*:/gi)];
  for (const label of labels) {
    const remainder = line.slice(label.index + label[0].length);
    const token = remainder.match(/^\s*([^\s)\],;`]+)/);
    values.push(token ? token[1].trim() : '');
  }
  return values;
}

function artifactPathText(line) {
  return line
    .replace(/^\s*Artifacts?\s*:\s*/i, '')
    .replace(/^\s*Artifact\s+produced\s*:?\s*/i, '')
    .replace(/\b(?:artifact[_-])?sha-?256\s*:\s*[^\s)\],;`]+/gi, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?:\s*[+,;]\s*)+$/, '')
    .trim();
}

function parseArtifactDeclarations(body) {
  const declarations = [];
  let previous = null;
  for (const raw of body.split('\n')) {
    if (PROSE_RECEIPT_FIELD_RE.test(raw)) {
      previous = null;
      continue;
    }
    const isDeclaration = /^\s*Artifacts?\s*:/i.test(raw)
      || /^\s*Artifact\s+produced\b/i.test(raw)
      || /^\s*artifact[_-]?sha-?256\s*:/i.test(raw);
    if (isDeclaration) {
      previous = {
        raw,
        pathText: artifactPathText(raw),
        hashes: sha256ValuesFromLine(raw),
      };
      declarations.push(previous);
      continue;
    }
    if (previous && /^\s*sha-?256\s*:/i.test(raw)) {
      previous.hashes.push(...sha256ValuesFromLine(raw));
      continue;
    }
    if (raw.trim() !== '') previous = null;
  }
  return declarations;
}

function artifactSha256Values(body) {
  return parseArtifactDeclarations(body).flatMap((declaration) => declaration.hashes);
}

function hasCanonicalArtifactHash(body) {
  const hashes = artifactSha256Values(body);
  return hashes.length > 0 && hashes.every((value) => /^[a-f0-9]{64}$/i.test(value));
}

function hasConcreteArtifactHash(body) {
  const hashes = artifactSha256Values(body);
  return hashes.length > 0 && hashes.every((value) => value !== '' && !isPlaceholderToken(value));
}

function hasExplicitFailure(body) {
  if (typeof body !== 'string') return false;
  const lines = body.split('\n');
  for (const raw of lines) {
    if (PROSE_RECEIPT_FIELD_RE.test(raw)) continue;
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    // 1. Zero execution (structured, anchored): zero tests, zero passing, or no collection.
    if (/^\s*(?:#|ℹ)?\s*tests?\s+0\b/i.test(raw)) return true;
    if (/^\s*(?:#|ℹ)?\s*0\s+tests?\b/i.test(raw)) return true;
    if (/^\s*(?:#|ℹ)?\s*tests?\s+run\s*:\s*0\b/i.test(raw)) return true;
    if (/^\s*0\s+(?:passing|passed)\b/i.test(raw)) return true;
    if (/^\s*Tests?\s*:\s*0\s+(?:passing|passed)\b/i.test(raw)) return true;
    if (/^\s*Tests?\s+passed\s*:\s*0\b/i.test(raw)) return true;
    if (/^\s*Passed\s*:\s*0\b/i.test(raw)) return true;
    if (/^\s*Tests:\s*0\s+total\b/i.test(raw)) return true;
    if (/^\s*collected\s+0\s+items\b/i.test(raw)) return true;
    if (/^\s*No tests? found\b/i.test(raw)) return true;
    // 2. Cancellation (optional marker #/ℹ, cancelled/canceled, both orders, count >0; 0 passes)
    if (/^\s*(?:#|ℹ)?\s*cancel(?:l)?ed\s*[:\s]*[1-9]\d*\b/i.test(raw)) return true;
    if (/^\s*(?:#|ℹ)?\s*[1-9]\d*\s+cancel(?:l)?ed\b/i.test(raw)) return true;
    // 3. Suite / file failures: Test Suites: N failed, Test Files N failed (N>0)
    if (/^\s*Test Suites?:?\s*[1-9]\d*\s+failed\b/i.test(raw)) return true;
    if (/^\s*Test Files?:?\s*[1-9]\d*\s+failed\b/i.test(raw)) return true;
    if (/^\s*Test Suites?:?\s*0\s+failed\b[^\r\n]*\b0\s+passed\b/i.test(raw)) return true;
    if (/^\s*Test Files?:?\s*0\s+failed\b[^\r\n]*\b0\s+passed\b/i.test(raw)) return true;
    // 4. Pytest short-summary entries (anchored to a Python test path)
    if (/^\s*FAILED[ \t]+\S+\.py(?:::\S+)?(?:[ \t]+-[^\r\n]*)?\s*$/i.test(raw)) return true;
    // 5. Runner FAIL (anchored exact FAIL, horizontal whitespace/colon/end; --- FAIL:)
    if (/^\s*FAIL(?:[ \t]+|:|$)/.test(raw)) return true;
    if (/^\s*---\s*FAIL:/.test(raw)) return true;
    // 6. Error/failure summaries (anchored, N>0; prose Notes/Description/Command skipped)
    if (/^\s*[1-9]\d*\s+errors?\b/i.test(raw)) return true;
    if (/^\s*errors?\s*[:\s]*[1-9]\d*\b/i.test(raw)) return true;
    if (/^\s*failures?\s*[:\s]*[1-9]\d*\b/i.test(raw)) return true;
    if (/^\s*failure\s+summary\s*[:.]?\s*$/i.test(raw)) return true;
    if (/^\s*Found\s+[1-9]\d*\s+errors?\b/i.test(raw)) return true;
    if (/^\s*failureCount\s*:\s*[1-9]\d*\s*[,;]?\s*$/i.test(raw)) return true;
    if (/^\s*ERROR\s*$/i.test(raw)) return true;
    if (/^\s*ERROR\s+collecting\b/i.test(raw)) return true;
    if (/^\s*Tests run\s*:/i.test(raw) && (/\b(?:Failures?|Errors?)\s*[:=]\s*[1-9]/i.test(raw) || /\b0\s+(?:tests?|passing|passed)\b/i.test(raw))) return true;
    // Maven Surefire's structured failure lines; do not treat arbitrary [ERROR] prose as failure.
    if (/^\s*\[ERROR\]\s+Tests run:\s*\d+\b[^\r\n]*\b(?:Failures?|Errors?):\s*[1-9]\d*\b/i.test(raw)) return true;
    if (/^\s*\[ERROR\]\s+Failed to execute goal\b/i.test(raw)) return true;
    // 7. Gradle (anchored, optional)
    if (/^\s*\d+\s+tests?\s+completed,\s*[1-9]\d*\s+failed\b/i.test(raw)) return true;
    // Existing structured checks (preserve, anchored where needed to avoid prose false positive)
    if (/^\s*Tests?\s+failed\s*$/i.test(raw)) return true;
    if (/^\s*Tests?\s+failed\s*:\s*[1-9]\d*\b/i.test(raw)) return true;
    if (/\b(?:Verification|Result|Status|Outcome)\s*:\s*FAIL(?:ED|URE)?\b/i.test(raw)) return true;
    if (/^\s*FAIL\s*$/i.test(trimmed)) return true;
    if (/^\s*FAIL\s*:/i.test(trimmed)) return true;
    if (/^\s*FAILED\s*$/i.test(trimmed)) return true;
    if (/^\s*FAILED\s*:/i.test(trimmed)) return true;
    if (/^\s*FAILURE\s*$/i.test(trimmed)) return true;
    if (/^\s*FAILURE\s*:/i.test(trimmed)) return true;
    if (/^\s*one\s+failing(?:\s+(?:test|tests|suite|suites))?\s*[,:]?\s*$/i.test(raw)) return true;
    if (/^\s*(?:#|ℹ)?\s*fail\s+[1-9]/i.test(raw)) return true;
    if (/^\s*not ok\b/i.test(raw)) return true;
    if (/^\s*Tests\s*:?\s*[1-9]/i.test(raw) && /\bfailed\b/i.test(raw)) return true;
    if (/^\s*\d+\s+failed\b/i.test(raw)) {
      const m = raw.match(/^\s*(\d+)\s+failed\b/i);
      if (m && parseInt(m[1], 10) !== 0) return true;
    }
    if (/exit\s+code\s*[:=]?\s*[1-9]/i.test(raw)) return true;
  }
  return false;
}
const trustedClassifications = new WeakSet();
const trustedV1Adapters = new WeakSet();

function clonePolicySnapshot(snapshot) {
  const clone = JSON.parse(JSON.stringify(snapshot));
  if (trustedV1Adapters.has(snapshot)) trustedV1Adapters.add(clone);
  return clone;
}

const APPROVAL_SCHEMA_VERSION = '2.0';
const LEGACY_APPROVAL_ERROR = `Legacy approval state detected (field \`approved\`). Migration required: replace \`approved\` with \`agent_validated\` per schema v${APPROVAL_SCHEMA_VERSION} (schema_version: "${APPROVAL_SCHEMA_VERSION}"). See spec-state.json template.`;

function assertLane(lane) {
  if (!LANES.includes(lane)) {
    throw new TypeError(`Unsupported workflow lane: ${String(lane)}`);
  }
  return lane;
}

function assertPlanningDepth(depth) {
  if (!PLANNING_DEPTHS.includes(depth)) {
    throw new TypeError(`Unsupported planning depth: ${String(depth)}`);
  }
  return depth;
}

function assertAssuranceLevel(level) {
  if (!ASSURANCE_LEVELS.includes(level)) {
    throw new TypeError(`Unsupported assurance level: ${String(level)}`);
  }
  return level;
}

function compatibilityLane(planningDepth, assuranceLevel) {
  assertPlanningDepth(planningDepth);
  assertAssuranceLevel(assuranceLevel);
  if (assuranceLevel === 'Strict') return 'Critical';
  if (planningDepth === 'None' && assuranceLevel === 'Routine') return 'Direct';
  return 'Standard';
}

function v1Axes(lane) {
  assertLane(lane);
  if (lane === 'Direct') return { planningDepth: 'None', assuranceLevel: 'Routine' };
  if (lane === 'Critical') return { planningDepth: 'Full', assuranceLevel: 'Strict' };
  return { planningDepth: 'Compact', assuranceLevel: 'Routine' };
}

function asTrue(value) {
  return value === true || value === 1 || value === 'true' || value === 'yes';
}

function signalValue(source, keys) {
  return keys.some((key) => asTrue(source[key]));
}

function textValue(input) {
  const files = Array.isArray(input.files) ? input.files : [];
  return [input.title, input.description, input.summary, input.operation, ...files]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function classifyRiskSignals(input = {}) {
  const nestedSignals = input.signals && typeof input.signals === 'object' ? input.signals : {};
  const declaredRiskValues = [input.riskSignals, input.risks]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value) => typeof value === 'string');
  const declaredSignals = declaredRiskValues
    .join(' ')
    .toLowerCase();
  const explicitRisk = (terms) => declaredRiskValues.some((value) => terms.includes(value.trim().toLowerCase()));
  const source = {
    ...input,
    ...nestedSignals,
    ...(input.riskSignals && typeof input.riskSignals === 'object' && !Array.isArray(input.riskSignals) ? input.riskSignals : {}),
  };
  const text = `${textValue(input)} ${declaredSignals}`;
  const hasTerm = (terms) => terms.some((term) => {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^a-z0-9_])${escaped}(?:$|[^a-z0-9_])`).test(text);
  });
  const reversibility = String(source.reversibility || '').toLowerCase();
  const rollback = String(source.rollback || source.rollbackDifficulty || '').toLowerCase();
  const signals = {
    reversibility: source.reversible === false
      || ['irreversible', 'non-reversible', 'not reversible'].includes(reversibility)
      || hasTerm(['irreversible', 'non-reversible', 'not reversible']),
    destructive: signalValue(source, LANE_RISK_KEYS.destructive) || hasTerm(LANE_RISK_KEYS.destructive),
    auth: signalValue(source, LANE_RISK_KEYS.auth) || hasTerm(LANE_RISK_KEYS.auth),
    payment: signalValue(source, LANE_RISK_KEYS.payment) || hasTerm(LANE_RISK_KEYS.payment),
    privacy: signalValue(source, LANE_RISK_KEYS.privacy) || hasTerm(LANE_RISK_KEYS.privacy),
    data: signalValue(source, ['data', 'dataset', 'records'])
      || explicitRisk(['data', 'dataset', 'records'])
      || hasTerm(LANE_RISK_KEYS.data),
    schema: signalValue(source, LANE_RISK_KEYS.schema) || hasTerm(LANE_RISK_KEYS.schema),
    migration: signalValue(source, LANE_RISK_KEYS.migration) || hasTerm(LANE_RISK_KEYS.migration),
    publicContract: signalValue(source, LANE_RISK_KEYS.publicContract) || hasTerm(LANE_RISK_KEYS.publicContract),
    crossRuntime: signalValue(source, LANE_RISK_KEYS.crossRuntime) || hasTerm(LANE_RISK_KEYS.crossRuntime),
    ambiguity: signalValue(source, LANE_RISK_KEYS.ambiguity)
      || ['high', 'severe'].includes(String(source.ambiguity || '').toLowerCase())
      || hasTerm(LANE_RISK_KEYS.ambiguity),
    rollback: signalValue(source, LANE_RISK_KEYS.rollback)
      || ['difficult', 'hard', 'none', 'impossible'].includes(rollback)
      || hasTerm(LANE_RISK_KEYS.rollback),
  };
  return signals;
}

function explicitReversible(input = {}) {
  const source = {
    ...input,
    ...(input.signals && typeof input.signals === 'object' ? input.signals : {}),
    ...(input.riskSignals && typeof input.riskSignals === 'object' ? input.riskSignals : {}),
  };
  return source.reversible === true
    || String(source.reversibility || '').toLowerCase() === 'reversible';
}

function overrideLane(input = {}) {
  if (typeof input === 'string') return input;
  return input.override ?? input.laneOverride ?? input.requestedLane ?? input.lane ?? null;
}

function freezeClassification(obj) {
  Object.freeze(obj);
  if (Array.isArray(obj.warnings)) Object.freeze(obj.warnings);
  if (Array.isArray(obj.risks)) Object.freeze(obj.risks);
  if (obj.signals && typeof obj.signals === 'object') Object.freeze(obj.signals);
  trustedClassifications.add(obj);
  return obj;
}

function requestedAxis(input, snake, camel) {
  return input[snake] ?? input[camel] ?? null;
}

function inferredPlanningDepth(input, taskCount) {
  const complexity = String(input.systemComplexity ?? input.system_complexity ?? input.complexity ?? '').toLowerCase();
  const scope = String(input.scope ?? input.scopeSize ?? input.scope_size ?? '').toLowerCase();
  if (['high', 'complex', 'system', 'cross-system'].includes(complexity)
    || ['large', 'broad', 'multi-package', 'system'].includes(scope)
    || taskCount >= 5) return 'Full';
  if (explicitReversible(input) && input.lowRisk === true && input.isolated === true && taskCount <= 2) return 'None';
  return 'Compact';
}

function minimumAssuranceForRisks(risks = []) {
  const listed = Array.isArray(risks) ? risks : [];
  return listed.length > 0 ? 'Elevated' : 'Routine';
}

function classifyLane(input = {}) {
  if (typeof input === 'string') {
    const axes = v1Axes(input);
    return freezeClassification({
      ...axes,
      automaticPlanningDepth: axes.planningDepth,
      automaticAssuranceLevel: axes.assuranceLevel,
      lane: input,
      automaticLane: input,
      overridden: false,
      warnings: [], risks: [], signals: {},
    });
  }
  if (!input || typeof input !== 'object') throw new TypeError('Lane classification input must be an object');
  const taskCount = input.taskCount === undefined ? 1 : input.taskCount;
  if (!Number.isInteger(taskCount) || taskCount < 1) throw new RangeError('taskCount must be a positive integer');

  const signals = classifyRiskSignals(input);
  const explicitRisks = Array.isArray(input.risks)
    ? input.risks.filter((risk) => typeof risk === 'string' && risk.trim() !== '')
    : [];
  const risks = [...new Set([
    ...Object.entries(signals).filter(([, active]) => active).map(([name]) => name),
    ...explicitRisks,
  ])];
  const inferredPlanning = inferredPlanningDepth(input, taskCount);
  const automaticAssurance = minimumAssuranceForRisks(risks);
  const legacyRequested = overrideLane(input);
  const legacyAxes = legacyRequested === null || legacyRequested === undefined ? null : v1Axes(assertLane(legacyRequested));
  const requestedPlanning = requestedAxis(input, 'planning_depth', 'planningDepth') ?? legacyAxes?.planningDepth;
  const requestedAssurance = requestedAxis(input, 'assurance_level', 'assuranceLevel') ?? legacyAxes?.assuranceLevel;
  if (requestedPlanning !== null && requestedPlanning !== undefined) assertPlanningDepth(requestedPlanning);
  if (requestedAssurance !== null && requestedAssurance !== undefined) assertAssuranceLevel(requestedAssurance);
  if (requestedPlanning && PLANNING_DEPTHS.indexOf(requestedPlanning) < PLANNING_DEPTHS.indexOf(inferredPlanning)) {
    throw new Error(`planning_depth downgrade from ${inferredPlanning} to ${requestedPlanning} is not permitted`);
  }
  if (requestedAssurance && ASSURANCE_LEVELS.indexOf(requestedAssurance) < ASSURANCE_LEVELS.indexOf(automaticAssurance)) {
    throw new Error(`assurance_level downgrade from ${automaticAssurance} to ${requestedAssurance} is blocked for risks: ${risks.join(', ')}`);
  }
  const planningDepth = requestedPlanning || inferredPlanning;
  const assuranceLevel = requestedAssurance || automaticAssurance;
  const lane = compatibilityLane(planningDepth, assuranceLevel);
  const automaticLane = compatibilityLane(inferredPlanning, automaticAssurance);
  return freezeClassification({
    planningDepth,
    automaticPlanningDepth: inferredPlanning,
    assuranceLevel,
    automaticAssuranceLevel: automaticAssurance,
    lane,
    automaticLane,
    overridden: Boolean(requestedPlanning || requestedAssurance || legacyAxes),
    warnings: legacyAxes ? [`Legacy lane ${legacyRequested} adapted to Specs v2 axes.`] : [],
    risks,
    signals,
  });
}

function uniqueStrings(values, field) {
  if (!Array.isArray(values)) return { valid: false, error: `${field} must be an array` };
  if (values.some((value) => typeof value !== 'string' || value.trim() === '')) {
    return { valid: false, error: `${field} must contain non-empty strings` };
  }
  if (new Set(values).size !== values.length) return { valid: false, error: `${field} must not contain duplicates` };
  return { valid: true };
}

function planningObligationsFor(depth) {
  assertPlanningDepth(depth);
  if (depth === 'None') return [];
  if (depth === 'Compact') return ['needsRequirements', 'needsDesign'];
  return [...PLANNING_OBLIGATIONS];
}

function obligationsForAssurance(level, risks = []) {
  assertAssuranceLevel(level);
  const obligations = new Set(['needsExecutionProof']);
  if (level === 'Elevated') obligations.add('needsInspection');
  if (level === 'Strict') {
    obligations.add('needsInspection');
    obligations.add('needsIndependentAudit');
  }
  return PROOF_OBLIGATIONS.filter((obligation) => obligations.has(obligation));
}

function obligationsForLane(lane, risks = []) {
  return obligationsForAssurance(v1Axes(assertLane(lane)).assuranceLevel, risks);
}

function legacyObligationsForLane(lane, risks = []) {
  assertLane(lane);
  const riskSet = new Set(risks);
  const selected = new Set(['needsExecutionProof']);
  if (lane !== 'Direct') selected.add('needsInspection');
  if (lane === 'Critical') selected.add('needsIndependentAudit');
  if (lane === 'Critical' && [
    'destructive', 'reversibility', 'rollback', 'data', 'schema', 'migration',
    'privacy', 'payment', 'crossRuntime',
  ].some((risk) => riskSet.has(risk))) selected.add('needsDurableTaskState');
  if (lane === 'Critical' && [
    'auth', 'payment', 'privacy', 'schema', 'migration', 'publicContract',
    'crossRuntime', 'ambiguity',
  ].some((risk) => riskSet.has(risk))) selected.add('needsResearchGrounding');
  return [...PROOF_OBLIGATIONS, 'needsResearchGrounding'].filter((obligation) => selected.has(obligation));
}

function actorNeedsFor(obligations) {
  return obligations.map((obligation) => ({ ...ACTOR_NEEDS_BY_OBLIGATION[obligation] }));
}

function mergeProofObligations(...groups) {
  const selected = new Set(groups.flat());
  return READ_COMPAT_PROOF_OBLIGATIONS.filter((obligation) => selected.has(obligation));
}

function snapshotFromClassification(classification) {
  const planningDepth = assertPlanningDepth(classification.planningDepth);
  const automaticPlanningDepth = assertPlanningDepth(classification.automaticPlanningDepth || planningDepth);
  const assuranceLevel = assertAssuranceLevel(classification.assuranceLevel);
  const automaticAssuranceLevel = assertAssuranceLevel(classification.automaticAssuranceLevel || assuranceLevel);
  if (PLANNING_DEPTHS.indexOf(planningDepth) < PLANNING_DEPTHS.indexOf(automaticPlanningDepth)) {
    throw new Error(`Workflow policy cannot downgrade planning_depth ${automaticPlanningDepth} to ${planningDepth}`);
  }
  if (ASSURANCE_LEVELS.indexOf(assuranceLevel) < ASSURANCE_LEVELS.indexOf(automaticAssuranceLevel)) {
    throw new Error(`Workflow policy cannot downgrade assurance_level ${automaticAssuranceLevel} to ${assuranceLevel}`);
  }
  const risks = Array.isArray(classification.risks) ? [...new Set(classification.risks)] : [];
  const minimumAssurance = minimumAssuranceForRisks(risks);
  if (ASSURANCE_LEVELS.indexOf(assuranceLevel) < ASSURANCE_LEVELS.indexOf(minimumAssurance)) {
    throw new Error(`Workflow policy assurance_level ${assuranceLevel} is below ${minimumAssurance} for risks: ${risks.join(', ')}`);
  }
  const lane = compatibilityLane(planningDepth, assuranceLevel);
  const automaticLane = compatibilityLane(automaticPlanningDepth, automaticAssuranceLevel);
  const proofObligations = obligationsForAssurance(assuranceLevel, risks);
  return {
    version: WORKFLOW_POLICY_VERSION,
    planning_depth: planningDepth,
    automatic_planning_depth: automaticPlanningDepth,
    assurance_level: assuranceLevel,
    automatic_assurance_level: automaticAssuranceLevel,
    lane,
    automatic_lane: automaticLane,
    risks,
    artifact_profile: ARTIFACT_PROFILE_BY_PLANNING[planningDepth],
    planning_obligations: planningObligationsFor(planningDepth),
    proof_obligations: proofObligations,
    actor_needs: actorNeedsFor(proofObligations),
    override_receipt: null,
  };
}

function canonicalSnapshotFromAxes({
  planningDepth,
  assuranceLevel,
  automaticPlanningDepth,
  automaticAssuranceLevel,
  risks = [],
}) {
  assertPlanningDepth(planningDepth);
  assertAssuranceLevel(assuranceLevel);
  assertPlanningDepth(automaticPlanningDepth);
  assertAssuranceLevel(automaticAssuranceLevel);
  if (PLANNING_DEPTHS.indexOf(planningDepth) < PLANNING_DEPTHS.indexOf(automaticPlanningDepth)) {
    throw new Error(`Workflow policy cannot downgrade planning_depth ${automaticPlanningDepth} to ${planningDepth}`);
  }
  if (ASSURANCE_LEVELS.indexOf(assuranceLevel) < ASSURANCE_LEVELS.indexOf(automaticAssuranceLevel)) {
    throw new Error(`Workflow policy cannot downgrade assurance_level ${automaticAssuranceLevel} to ${assuranceLevel}`);
  }
  const uniqueRisks = [...new Set(risks)];
  const minimumForRisks = minimumAssuranceForRisks(uniqueRisks);
  if (ASSURANCE_LEVELS.indexOf(assuranceLevel) < ASSURANCE_LEVELS.indexOf(minimumForRisks)) {
    throw new Error(`Workflow policy assurance_level ${assuranceLevel} is below ${minimumForRisks} for risks: ${uniqueRisks.join(', ')}`);
  }
  return {
    version: CANONICAL_WORKFLOW_POLICY_VERSION,
    planning_depth: planningDepth,
    assurance_level: assuranceLevel,
    classified_minimum: {
      planning_depth: automaticPlanningDepth,
      assurance_level: automaticAssuranceLevel,
    },
    risks: uniqueRisks,
  };
}

function canonicalWorkflowPolicySnapshot(input = {}) {
  if (input && typeof input === 'object' && hasOwn(input, 'workflow_policy')) {
    const view = readWorkflowPolicySnapshot(input);
    return canonicalSnapshotFromAxes({
      planningDepth: view.planning_depth,
      assuranceLevel: view.assurance_level,
      automaticPlanningDepth: view.automatic_planning_depth,
      automaticAssuranceLevel: view.automatic_assurance_level,
      risks: view.risks,
    });
  }
  const classification = trustedClassifications.has(input) ? input : classifyLane(input);
  return canonicalSnapshotFromAxes({
    planningDepth: classification.planningDepth,
    assuranceLevel: classification.assuranceLevel,
    automaticPlanningDepth: classification.automaticPlanningDepth,
    automaticAssuranceLevel: classification.automaticAssuranceLevel,
    risks: classification.risks,
  });
}

function isCanonicalTasklessTerminalSpec(spec, specDir) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || spec.schema_version !== '2.1') return false;
  const policy = spec.workflow_policy;
  const validation = validateWorkflowPolicySnapshot(policy);
  if (!validation.valid || policy.version !== CANONICAL_WORKFLOW_POLICY_VERSION
    || !['Compact', 'Full'].includes(policy.planning_depth)) return false;
  if (Object.prototype.hasOwnProperty.call(spec, 'task_files')
    && (!Array.isArray(spec.task_files) || spec.task_files.length !== 0)) return false;
  if (Object.prototype.hasOwnProperty.call(spec, 'task_registry')
    && (!spec.task_registry || typeof spec.task_registry !== 'object'
      || Array.isArray(spec.task_registry) || Object.keys(spec.task_registry).length !== 0)) return false;
  if (typeof specDir !== 'string' || specDir.trim() === '') return false;
  try {
    const entries = fs.readdirSync(path.join(specDir, 'tasks'));
    return entries.length === 0;
  } catch (error) {
    return error && error.code === 'ENOENT';
  }
}

function canonicalPolicyView(snapshot) {
  const planningDepth = snapshot.planning_depth;
  const assuranceLevel = snapshot.assurance_level;
  const automaticPlanningDepth = snapshot.classified_minimum.planning_depth;
  const automaticAssuranceLevel = snapshot.classified_minimum.assurance_level;
  const proofObligations = obligationsForAssurance(assuranceLevel, snapshot.risks);
  return {
    ...JSON.parse(JSON.stringify(snapshot)),
    automatic_planning_depth: automaticPlanningDepth,
    automatic_assurance_level: automaticAssuranceLevel,
    lane: compatibilityLane(planningDepth, assuranceLevel),
    automatic_lane: compatibilityLane(automaticPlanningDepth, automaticAssuranceLevel),
    artifact_profile: ARTIFACT_PROFILE_BY_PLANNING[planningDepth],
    planning_obligations: planningObligationsFor(planningDepth),
    proof_obligations: proofObligations,
    actor_needs: actorNeedsFor(proofObligations),
  };
}

function workflowPolicySnapshot(input = {}) {
  if (input && typeof input === 'object' && hasOwn(input, 'workflow_policy')) {
    return readWorkflowPolicySnapshot(input);
  }
  if (input && typeof input === 'object' && input.design_context?.execution_tier) {
    return readWorkflowPolicySnapshot(input);
  }
  if (input && typeof input === 'object' && isWorkflowPolicySnapshot(input)) {
    assertWorkflowPolicySnapshot(input);
    if (input.version === WORKFLOW_POLICY_VERSION) return clonePolicySnapshot(input);
    return readWorkflowPolicySnapshot({ workflow_policy: input });
  }
  const classification = trustedClassifications.has(input)
    ? input
    : classifyLane(input);
  return snapshotFromClassification(classification);
}

function isWorkflowPolicySnapshot(value) {
  return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'version'));
}

function validateV1Snapshot(snapshot) {
  const errors = [];
  if (JSON.stringify(Object.keys(snapshot).sort()) !== JSON.stringify([...V1_POLICY_FIELDS].sort())) {
    errors.push(`workflow_policy v1 fields must be exactly ${V1_POLICY_FIELDS.join(', ')}`);
  }
  if (!LANES.includes(snapshot.lane)) errors.push(`workflow_policy.lane must be one of ${LANES.join(', ')}`);
  if (!LANES.includes(snapshot.automatic_lane)) errors.push(`workflow_policy.automatic_lane must be one of ${LANES.join(', ')}`);
  if (LANES.includes(snapshot.lane) && LANES.includes(snapshot.automatic_lane)
    && LANES.indexOf(snapshot.lane) < LANES.indexOf(snapshot.automatic_lane)) errors.push('workflow_policy.lane cannot be lower than automatic_lane');
  const risks = uniqueStrings(snapshot.risks, 'workflow_policy.risks');
  if (!risks.valid) errors.push(risks.error);
  if (risks.valid && LANES.includes(snapshot.lane)) {
    const minimum = compatibilityLane('None', minimumAssuranceForRisks(snapshot.risks));
    if (LANES.indexOf(snapshot.lane) < LANES.indexOf(minimum)) errors.push(`workflow_policy.lane must be at least ${minimum} for its risks`);
  }
  if (LANES.includes(snapshot.lane) && snapshot.artifact_profile !== ARTIFACT_PROFILE_BY_LANE[snapshot.lane]) {
    errors.push(`workflow_policy.artifact_profile must be ${ARTIFACT_PROFILE_BY_LANE[snapshot.lane]} for ${snapshot.lane}`);
  }
  const obligations = uniqueStrings(snapshot.proof_obligations, 'workflow_policy.proof_obligations');
  if (!obligations.valid) errors.push(obligations.error);
  else if (LANES.includes(snapshot.lane) && risks.valid) {
    const expected = legacyObligationsForLane(snapshot.lane, snapshot.risks);
    if (JSON.stringify(snapshot.proof_obligations) !== JSON.stringify(expected)) errors.push('workflow_policy.proof_obligations do not match v1 lane and risks');
  }
  if (!Array.isArray(snapshot.actor_needs)) errors.push('workflow_policy.actor_needs must be an array');
  else if (obligations.valid && JSON.stringify(snapshot.actor_needs) !== JSON.stringify(actorNeedsFor(snapshot.proof_obligations))) errors.push('workflow_policy.actor_needs must correspond to proof_obligations');
  if (snapshot.override_receipt !== null) errors.push('workflow_policy.override_receipt must be null');
  return { valid: errors.length === 0, errors };
}

function validateWorkflowPolicySnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { valid: false, errors: ['workflow_policy must be an object'] };
  }
  if (snapshot.version === CANONICAL_WORKFLOW_POLICY_VERSION) {
    const keys = Object.keys(snapshot).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...CANONICAL_WORKFLOW_POLICY_FIELDS].sort())) {
      errors.push(`workflow_policy v2.1 fields must be exactly ${CANONICAL_WORKFLOW_POLICY_FIELDS.join(', ')}`);
    }
    if (!PLANNING_DEPTHS.includes(snapshot.planning_depth)) {
      errors.push(`workflow_policy.planning_depth must be one of ${PLANNING_DEPTHS.join(', ')}`);
    }
    if (!ASSURANCE_LEVELS.includes(snapshot.assurance_level)) {
      errors.push(`workflow_policy.assurance_level must be one of ${ASSURANCE_LEVELS.join(', ')}`);
    }
    const minimum = snapshot.classified_minimum;
    if (!minimum || typeof minimum !== 'object' || Array.isArray(minimum)
      || Object.keys(minimum).sort().join(',') !== 'assurance_level,planning_depth') {
      errors.push('workflow_policy.classified_minimum must contain exactly planning_depth and assurance_level');
    } else {
      if (!PLANNING_DEPTHS.includes(minimum.planning_depth)) {
        errors.push(`workflow_policy.classified_minimum.planning_depth must be one of ${PLANNING_DEPTHS.join(', ')}`);
      }
      if (!ASSURANCE_LEVELS.includes(minimum.assurance_level)) {
        errors.push(`workflow_policy.classified_minimum.assurance_level must be one of ${ASSURANCE_LEVELS.join(', ')}`);
      }
      if (PLANNING_DEPTHS.includes(snapshot.planning_depth) && PLANNING_DEPTHS.includes(minimum.planning_depth)
        && PLANNING_DEPTHS.indexOf(snapshot.planning_depth) < PLANNING_DEPTHS.indexOf(minimum.planning_depth)) {
        errors.push('workflow_policy.planning_depth cannot be lower than classified_minimum.planning_depth');
      }
      if (ASSURANCE_LEVELS.includes(snapshot.assurance_level) && ASSURANCE_LEVELS.includes(minimum.assurance_level)
        && ASSURANCE_LEVELS.indexOf(snapshot.assurance_level) < ASSURANCE_LEVELS.indexOf(minimum.assurance_level)) {
        errors.push('workflow_policy.assurance_level cannot be lower than classified_minimum.assurance_level');
      }
    }
    const risks = uniqueStrings(snapshot.risks, 'workflow_policy.risks');
    if (!risks.valid) errors.push(risks.error);
    if (risks.valid && ASSURANCE_LEVELS.includes(snapshot.assurance_level)) {
      const riskMinimum = minimumAssuranceForRisks(snapshot.risks);
      if (ASSURANCE_LEVELS.indexOf(snapshot.assurance_level) < ASSURANCE_LEVELS.indexOf(riskMinimum)) {
        errors.push(`workflow_policy.assurance_level must be at least ${riskMinimum} for its risks`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
  if (snapshot.version === '1') return validateV1Snapshot(snapshot);
  const keys = Object.keys(snapshot).sort();
  const expectedKeys = [...WORKFLOW_POLICY_FIELDS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    errors.push(`workflow_policy fields must be exactly ${WORKFLOW_POLICY_FIELDS.join(', ')}`);
  }
  if (snapshot.version !== WORKFLOW_POLICY_VERSION) errors.push('workflow_policy.version must be "2"');
  if (!PLANNING_DEPTHS.includes(snapshot.planning_depth)) errors.push(`workflow_policy.planning_depth must be one of ${PLANNING_DEPTHS.join(', ')}`);
  if (!PLANNING_DEPTHS.includes(snapshot.automatic_planning_depth)) errors.push(`workflow_policy.automatic_planning_depth must be one of ${PLANNING_DEPTHS.join(', ')}`);
  if (!ASSURANCE_LEVELS.includes(snapshot.assurance_level)) errors.push(`workflow_policy.assurance_level must be one of ${ASSURANCE_LEVELS.join(', ')}`);
  if (!ASSURANCE_LEVELS.includes(snapshot.automatic_assurance_level)) errors.push(`workflow_policy.automatic_assurance_level must be one of ${ASSURANCE_LEVELS.join(', ')}`);
  if (!LANES.includes(snapshot.lane)) errors.push(`workflow_policy.lane must be one of ${LANES.join(', ')}`);
  if (!LANES.includes(snapshot.automatic_lane)) errors.push(`workflow_policy.automatic_lane must be one of ${LANES.join(', ')}`);
  if (PLANNING_DEPTHS.includes(snapshot.planning_depth) && PLANNING_DEPTHS.includes(snapshot.automatic_planning_depth)
    && PLANNING_DEPTHS.indexOf(snapshot.planning_depth) < PLANNING_DEPTHS.indexOf(snapshot.automatic_planning_depth)) errors.push('workflow_policy.planning_depth cannot be lower than automatic_planning_depth');
  if (ASSURANCE_LEVELS.includes(snapshot.assurance_level) && ASSURANCE_LEVELS.includes(snapshot.automatic_assurance_level)
    && ASSURANCE_LEVELS.indexOf(snapshot.assurance_level) < ASSURANCE_LEVELS.indexOf(snapshot.automatic_assurance_level)) errors.push('workflow_policy.assurance_level cannot be lower than automatic_assurance_level');
  if (PLANNING_DEPTHS.includes(snapshot.planning_depth) && ASSURANCE_LEVELS.includes(snapshot.assurance_level)
    && snapshot.lane !== compatibilityLane(snapshot.planning_depth, snapshot.assurance_level)) errors.push('workflow_policy.lane is not the derived compatibility lane');
  if (PLANNING_DEPTHS.includes(snapshot.automatic_planning_depth) && ASSURANCE_LEVELS.includes(snapshot.automatic_assurance_level)
    && snapshot.automatic_lane !== compatibilityLane(snapshot.automatic_planning_depth, snapshot.automatic_assurance_level)) errors.push('workflow_policy.automatic_lane is not the derived compatibility lane');
  if (PLANNING_DEPTHS.includes(snapshot.planning_depth) && snapshot.artifact_profile !== ARTIFACT_PROFILE_BY_PLANNING[snapshot.planning_depth]) errors.push('workflow_policy.artifact_profile does not match planning_depth');
  const risks = uniqueStrings(snapshot.risks, 'workflow_policy.risks');
  if (!risks.valid) errors.push(risks.error);
  if (risks.valid && ASSURANCE_LEVELS.includes(snapshot.assurance_level)) {
    const minimumAssurance = minimumAssuranceForRisks(snapshot.risks);
    if (ASSURANCE_LEVELS.indexOf(snapshot.assurance_level) < ASSURANCE_LEVELS.indexOf(minimumAssurance)) {
      errors.push(`workflow_policy.assurance_level must be at least ${minimumAssurance} for its risks`);
    }
  }
  const planning = uniqueStrings(snapshot.planning_obligations, 'workflow_policy.planning_obligations');
  if (!planning.valid) errors.push(planning.error);
  else if (PLANNING_DEPTHS.includes(snapshot.planning_depth)
    && JSON.stringify(snapshot.planning_obligations) !== JSON.stringify(planningObligationsFor(snapshot.planning_depth))) errors.push('workflow_policy.planning_obligations do not match planning_depth');
  const obligations = uniqueStrings(snapshot.proof_obligations, 'workflow_policy.proof_obligations');
  if (!obligations.valid) {
    errors.push(obligations.error);
  } else {
    for (const obligation of snapshot.proof_obligations) {
      if (!READ_COMPAT_PROOF_OBLIGATIONS.includes(obligation)) errors.push(`workflow_policy.proof_obligations has unknown obligation ${obligation}`);
    }
    if (!snapshot.proof_obligations.includes('needsExecutionProof')) {
      errors.push('workflow_policy.proof_obligations must include needsExecutionProof');
    }
    if (ASSURANCE_LEVELS.includes(snapshot.assurance_level) && risks.valid) {
      const expected = obligationsForAssurance(snapshot.assurance_level, snapshot.risks);
      const exact = JSON.stringify(snapshot.proof_obligations) === JSON.stringify(expected);
      const trustedCompat = trustedV1Adapters.has(snapshot)
        && JSON.stringify(snapshot.proof_obligations) === JSON.stringify(mergeProofObligations(expected, snapshot.proof_obligations));
      if (!exact && !trustedCompat) {
        errors.push('workflow_policy.proof_obligations do not match assurance_level and risks');
      }
    }
  }
  if (!Array.isArray(snapshot.actor_needs)) {
    errors.push('workflow_policy.actor_needs must be an array');
  } else {
    for (const need of snapshot.actor_needs) {
      if (!need || typeof need !== 'object' || Array.isArray(need)
        || Object.keys(need).sort().join(',') !== 'capability,independence'
        || !ACTOR_CAPABILITIES.has(need.capability)
        || !ACTOR_INDEPENDENCE.has(need.independence)) {
        errors.push('workflow_policy.actor_needs must describe capability and independence, never an agent name');
        break;
      }
    }
    if (ASSURANCE_LEVELS.includes(snapshot.assurance_level) && obligations.valid
      && JSON.stringify(snapshot.actor_needs) !== JSON.stringify(actorNeedsFor(snapshot.proof_obligations))) {
      errors.push('workflow_policy.actor_needs must correspond to proof_obligations');
    }
  }
  if (snapshot.override_receipt !== null) errors.push('legacy workflow_policy.override_receipt is inert and must be null');
  return { valid: errors.length === 0, errors };
}

function assertWorkflowPolicySnapshot(snapshot) {
  const result = validateWorkflowPolicySnapshot(snapshot);
  if (!result.valid) throw new TypeError(`Invalid workflow policy snapshot: ${result.errors.join('; ')}`);
  return snapshot;
}

function readWorkflowPolicySnapshot(spec = {}) {
  if (!spec || typeof spec !== 'object') throw new TypeError('Spec state must be an object');
  if (hasOwn(spec, 'workflow_policy')) {
    let persisted = spec.workflow_policy;
    if (persisted?.version === CANONICAL_WORKFLOW_POLICY_VERSION
      && hasOwn(persisted, 'override_receipt')) {
      if (persisted.override_receipt !== null) {
        throw new TypeError('Invalid workflow policy snapshot: legacy workflow_policy.override_receipt is inert and must be null');
      }
      persisted = { ...persisted };
      delete persisted.override_receipt;
    }
    assertWorkflowPolicySnapshot(persisted);
    if (persisted.version === CANONICAL_WORKFLOW_POLICY_VERSION) {
      return canonicalPolicyView(persisted);
    }
    if (persisted.version === WORKFLOW_POLICY_VERSION) return clonePolicySnapshot(persisted);
    const selected = v1Axes(persisted.lane);
    const automatic = v1Axes(persisted.automatic_lane);
    const adapted = snapshotFromClassification({
      ...selected,
      automaticPlanningDepth: automatic.planningDepth,
      automaticAssuranceLevel: automatic.assuranceLevel,
      risks: persisted.risks,
    });
    const proofObligations = mergeProofObligations(adapted.proof_obligations, persisted.proof_obligations);
    const result = {
      ...adapted,
      proof_obligations: proofObligations,
      actor_needs: actorNeedsFor(proofObligations),
    };
    trustedV1Adapters.add(result);
    return result;
  }
  // Legacy state is read-compatible only. The fallback is deliberately not
  // written back and cannot authorize a downgrade or override new input.
  const rawLegacyTier = spec.design_context && spec.design_context.execution_tier;
  const legacyTier = typeof rawLegacyTier === 'string'
    ? Object.keys(LEGACY_TIER_LANES).find((tier) => tier.toLowerCase() === rawLegacyTier.toLowerCase())
    : null;
  const legacyLane = legacyTier ? LEGACY_TIER_LANES[legacyTier] : null;
  if (legacyLane) {
    const axes = v1Axes(legacyLane);
    return snapshotFromClassification({ ...axes, automaticPlanningDepth: axes.planningDepth, automaticAssuranceLevel: axes.assuranceLevel, risks: [] });
  }
  throw new TypeError('workflow_policy snapshot is missing at the spec boundary');
}

function persistWorkflowPolicySnapshot(spec, input = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('Spec state must be an object');
  const next = { ...spec };
  delete next.override_receipt;
  if (hasOwn(spec, 'workflow_policy')) {
    return { ...next, workflow_policy: canonicalWorkflowPolicySnapshot(spec) };
  }
  return { ...next, workflow_policy: canonicalWorkflowPolicySnapshot(input) };
}

const persistWorkflowPolicy = persistWorkflowPolicySnapshot;
const createWorkflowPolicySnapshot = workflowPolicySnapshot;

function candidateAssuranceForRisks(input, risks) {
  // A risk severity label is evidence for inspection, not independent-audit
  // authority. Strict is selected only through the explicit assurance axis.
  const explicitRiskLevel = String(input?.riskLevel || input?.risk_level || input?.level || '').toLowerCase();
  const riskLevelAssurance = ['standard', 'medium', 'high', 'critical', 'deep'].includes(explicitRiskLevel)
    ? 'Elevated'
    : null;
  const riskLevel = minimumAssuranceForRisks(risks);
  const candidates = [riskLevelAssurance, riskLevel]
    .filter((level) => level !== null && level !== undefined);
  if (candidates.length === 0 || candidates.every((level) => level === 'Routine')) return null;
  return ASSURANCE_LEVELS[Math.max(...candidates.map((level) => ASSURANCE_LEVELS.indexOf(level)))];
}

function escalateWorkflowPolicy(policyOrSpec, riskInput = {}) {
  const canonicalInput = policyOrSpec && typeof policyOrSpec === 'object'
    && (policyOrSpec.version === CANONICAL_WORKFLOW_POLICY_VERSION
      || policyOrSpec.workflow_policy?.version === CANONICAL_WORKFLOW_POLICY_VERSION);
  const current = policyOrSpec && typeof policyOrSpec === 'object' && hasOwn(policyOrSpec, 'workflow_policy')
    ? readWorkflowPolicySnapshot(policyOrSpec)
    : workflowPolicySnapshot(policyOrSpec);
  const discovered = classifyRiskSignals(riskInput);
  const explicitRisks = Array.isArray(riskInput?.risks)
    ? riskInput.risks.filter((risk) => typeof risk === 'string' && risk.trim() !== '')
    : [];
  const newRisks = [...new Set([
    ...Object.entries(discovered).filter(([, active]) => active).map(([name]) => name),
    ...explicitRisks,
  ])];
  const risks = [...new Set([...current.risks, ...newRisks])];
  const requestedAssurance = riskInput?.assurance_level ?? riskInput?.assuranceLevel;
  if (requestedAssurance !== undefined && requestedAssurance !== null) {
    assertAssuranceLevel(requestedAssurance);
  }
  const hasNewRisk = newRisks.some((risk) => !current.risks.includes(risk));
  const hasRiskLevel = ['standard', 'medium', 'high', 'critical', 'deep'].includes(
    String(riskInput?.riskLevel || riskInput?.risk_level || riskInput?.level || '').toLowerCase(),
  );
  const raisesRequestedAssurance = requestedAssurance
    && ASSURANCE_LEVELS.indexOf(requestedAssurance) > ASSURANCE_LEVELS.indexOf(current.assurance_level);
  if (!hasNewRisk && !hasRiskLevel && !raisesRequestedAssurance) return current;
  const candidate = candidateAssuranceForRisks(riskInput, risks);
  if (!candidate && !raisesRequestedAssurance) return current;
  const automaticAssuranceLevel = ASSURANCE_LEVELS[Math.max(
    ASSURANCE_LEVELS.indexOf(current.automatic_assurance_level),
    ASSURANCE_LEVELS.indexOf(candidate || 'Routine'),
  )];
  const assuranceLevel = ASSURANCE_LEVELS[Math.max(
    ASSURANCE_LEVELS.indexOf(current.assurance_level),
    ASSURANCE_LEVELS.indexOf(automaticAssuranceLevel),
    ASSURANCE_LEVELS.indexOf(requestedAssurance || 'Routine'),
  )];
  const axes = {
    planningDepth: current.planning_depth,
    automaticPlanningDepth: current.automatic_planning_depth,
    assuranceLevel,
    automaticAssuranceLevel,
    risks,
  };
  return canonicalInput ? canonicalSnapshotFromAxes(axes) : snapshotFromClassification(axes);
}

function policyForSpec(spec, riskInput = null) {
  const snapshot = riskInput ? escalateWorkflowPolicy(spec, riskInput) : readWorkflowPolicySnapshot(spec);
  return lanePolicy(snapshot);
}

function lanePolicy(input = {}) {
  const snapshot = input && typeof input === 'object' && hasOwn(input, 'workflow_policy')
    ? readWorkflowPolicySnapshot(input)
    : input && typeof input === 'object' && isWorkflowPolicySnapshot(input)
      ? (assertWorkflowPolicySnapshot(input), clonePolicySnapshot(input))
      : workflowPolicySnapshot(input);
  const lane = assertLane(snapshot.lane);
  return {
    ...snapshot,
    proof_obligations: [...snapshot.proof_obligations],
    actor_needs: snapshot.actor_needs.map((need) => ({ ...need })),
    planning_obligations: [...snapshot.planning_obligations],
    requiresSpec: snapshot.planning_depth !== 'None',
    requiresState: snapshot.planning_depth === 'Full'
      || snapshot.proof_obligations.includes('needsDurableTaskState'),
    qualityGate: lane === 'Direct' ? 'main-session' : lane === 'Standard' ? 'combined-feature-review' : 'strict-evidence',
    shipPoint: lane === 'Direct' ? 'task' : 'feature',
    evidence: snapshot.artifact_profile,
  };
}

function isLegacyApprovalObject(obj) {
  return obj && typeof obj === 'object' && 'approved' in obj;
}

function validateApprovalSchema(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return { valid: false, absent: false, legacy: false, error: 'spec must be a non-array object' };
  if (!Object.prototype.hasOwnProperty.call(spec, 'approvals')) {
    return { valid: true, absent: true, legacy: false };
  }
  const approvals = spec.approvals;
  if (approvals === null || typeof approvals !== 'object' || Array.isArray(approvals)) {
    return { valid: false, absent: false, legacy: false, error: 'approvals must be a non-empty object' };
  }
  if (Object.keys(approvals).length === 0) {
    return { valid: false, absent: false, legacy: false, error: 'approvals must not be empty' };
  }
  // Check for legacy field `approved` in any stage
  for (const [stage, val] of Object.entries(approvals)) {
    if (isLegacyApprovalObject(val)) {
      return {
        valid: false,
        absent: false,
        legacy: true,
        error: `Legacy approval state at approvals.${stage}.approved. ${LEGACY_APPROVAL_ERROR}`,
      };
    }
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return { valid: false, absent: false, legacy: false, error: `approvals.${stage} must be an approval object` };
    }
    const keys = Object.keys(val).sort();
    if (!['agent_validated,generated', 'agent_validated,generated,user_approved'].includes(keys.join(','))) {
      return { valid: false, absent: false, legacy: false, error: `approvals.${stage} must contain generated and agent_validated; legacy user_approved is readable but has zero authority` };
    }
    if (keys.some((key) => typeof val[key] !== 'boolean')) {
      return { valid: false, absent: false, legacy: false, error: `approvals.${stage} fields must be boolean` };
    }
  }
  // Check schema version
  const version = Object.prototype.hasOwnProperty.call(spec, 'schema_version')
    ? spec.schema_version
    : spec.approval_schema_version;
  if (version !== undefined && typeof version !== 'string') {
    return { valid: false, absent: false, legacy: false, error: 'schema_version must be a string' };
  }
  if (version && version !== APPROVAL_SCHEMA_VERSION) {
    return { valid: false, absent: false, legacy: false, error: `Unsupported schema_version ${version}, expected ${APPROVAL_SCHEMA_VERSION}` };
  }
  if (!version && Object.keys(approvals).length > 0) {
    // No version but uses new schema - allow for backward compat but warn that version should be present
    // Fail closed only if legacy detected above; otherwise allow.
    return { valid: true, absent: false, legacy: false, warning: `Missing schema_version, expected ${APPROVAL_SCHEMA_VERSION}` };
  }
  return { valid: true, absent: false, legacy: false };
}

function approvalState(state = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('approval state must be an object');
  }
  if (Object.prototype.hasOwnProperty.call(state, 'approvals')) {
    const validation = validateApprovalSchema(state);
    if (!validation.valid) throw new Error(validation.error);
    return {
      generated: false,
      agent_validated: false,
      ready: false,
      present: true,
      schema_version: APPROVAL_SCHEMA_VERSION,
      legacy: false,
    };
  }
  if (isLegacyApprovalObject(state)) throw new Error(LEGACY_APPROVAL_ERROR);

  const version = Object.prototype.hasOwnProperty.call(state, 'schema_version')
    ? state.schema_version
    : state.approval_schema_version;
  if (version !== undefined && (typeof version !== 'string' || version !== APPROVAL_SCHEMA_VERSION)) {
    throw new Error(`Unsupported schema_version ${String(version)}, expected ${APPROVAL_SCHEMA_VERSION}`);
  }

  const known = ['generated', 'agent_validated', 'user_approved'];
  const present = known.some((key) => Object.prototype.hasOwnProperty.call(state, key));
  const unknown = Object.keys(state).filter((key) => !known.includes(key) && key !== 'schema_version' && key !== 'approval_schema_version');
  if (unknown.length > 0) throw new TypeError(`malformed approval state fields: ${unknown.join(', ')}`);
  for (const key of known) {
    if (Object.prototype.hasOwnProperty.call(state, key) && typeof state[key] !== 'boolean') {
      throw new TypeError(`approval state field ${key} must be boolean`);
    }
  }
  const result = {
    generated: state.generated === true,
    agent_validated: state.agent_validated === true,
  };
  return {
    ...result,
    ready: result.generated && result.agent_validated,
    present,
    schema_version: APPROVAL_SCHEMA_VERSION,
    legacy_user_approved: state.user_approved === true,
  };
}
function assertVerdict(verdict) {
  if (!CANONICAL_VERDICTS.includes(verdict)) {
    throw new TypeError(`Unsupported canonical verdict: ${String(verdict)}`);
  }
  return verdict;
}

function executionPolicy({ flash = false, parallel = false } = {}) {
  if (flash && parallel) {
    return {
      allowed: false,
      failFast: true,
      mode: 'flash-parallel-conflict',
      reason: '--flash cannot be combined with --parallel; no execution starts',
    };
  }
  return {
    allowed: true,
    failFast: false,
    mode: parallel ? 'parallel' : flash ? 'flash' : 'standard',
    reason: null,
  };
}

function delegationPlan({ tier, lane = null, mode = 'full-spec', taskCount = 1 } = {}) {
  if (lane !== null && lane !== undefined) {
    const policy = lanePolicy(lane);
    return {
      lane: policy.lane,
      mode,
      proof_obligations: [...policy.proof_obligations],
      actor_needs: policy.actor_needs.map((need) => ({ ...need })),
      qualityGate: policy.qualityGate,
      shipPoint: policy.shipPoint,
    };
  }
  if (!EXECUTION_TIERS.includes(tier)) {
    throw new TypeError(`Unsupported execution tier: ${String(tier)}`);
  }
  if (!Number.isInteger(taskCount) || taskCount < 1) {
    throw new RangeError('taskCount must be a positive integer');
  }

  // Legacy tier input is read-only compatibility. It is translated once to
  // the canonical lane contract and never emits a new tier authority or an
  // agent sequence.
  const legacyLane = LEGACY_TIER_LANES[tier];
  const policy = lanePolicy(legacyLane);
  return {
    tier,
    legacy: true,
    lane: policy.lane,
    mode,
    proof_obligations: [...policy.proof_obligations],
    actor_needs: policy.actor_needs.map((need) => ({ ...need })),
    qualityGate: policy.qualityGate,
    shipPoint: policy.shipPoint,
    taskCount,
  };
}

function normalizeVerdict(verdict) {
  if (CANONICAL_VERDICTS.includes(verdict)) return { verdict, diagnostic: null };
  if (LEGACY_DIAGNOSTIC_VERDICTS.includes(verdict)) return { verdict: 'BLOCKED', diagnostic: verdict };
  throw new TypeError(`Unsupported canonical verdict: ${String(verdict)}`);
}

function unfinishedVerdictDecision(verdict, context = {}, diagnostic = null) {
  const action = diagnostic === 'PARTIAL'
    ? 'continue-verification'
    : diagnostic === 'NO_TESTS'
      ? 'configure-or-run-tests'
      : verdict === 'FAIL'
        ? 'fix-and-rerun'
        : 'stop';
  return {
    verdict,
    ...(diagnostic ? { diagnostic } : {}),
    action,
    completion: 'unfinished',
    terminal: verdict !== 'FAIL',
    unfinished: true,
    retry: verdict === 'FAIL',
    blocker: context.blocker || (
      diagnostic === 'PARTIAL'
        ? 'verification is partial; required proof remains unfinished'
        : diagnostic === 'NO_TESTS'
          ? 'no tests were executed'
          : verdict === 'FAIL'
            ? 'verification returned FAIL'
            : 'verification is blocked; resolve the blocker before retrying'
    ),
  };
}

function adaptVerdict(verdict, context = {}) {
  const normalized = normalizeVerdict(verdict);
  if (normalized.verdict === 'PASS' || normalized.verdict === 'PASS_WITH_WARNINGS') {
    return {
      verdict: normalized.verdict,
      ...(normalized.diagnostic ? { diagnostic: normalized.diagnostic } : {}),
      action: normalized.verdict === 'PASS_WITH_WARNINGS' ? 'review-passed-with-warnings' : 'review-passed',
      completion: 'unfinished',
      terminal: true,
      unfinished: true,
      retry: false,
      blocker: context.blocker || 'completion decision requires canonical execution proof and workflow obligations',
    };
  }
  return unfinishedVerdictDecision(normalized.verdict, context, normalized.diagnostic);
}

function workflowPolicyObligations(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return null;
  const policy = hasOwn(context, 'workflow_policy')
    ? context.workflow_policy
    : hasOwn(context, 'workflowPolicy')
      ? context.workflowPolicy
      : hasOwn(context, 'policy')
        ? context.policy
        : context.task_context && typeof context.task_context === 'object'
          ? (hasOwn(context.task_context, 'workflow_policy')
            ? context.task_context.workflow_policy
            : hasOwn(context.task_context, 'workflowPolicy')
              ? context.task_context.workflowPolicy
              : null)
          : null;
  if (!validateWorkflowPolicySnapshot(policy).valid) return null;
  return [...readWorkflowPolicySnapshot({ workflow_policy: policy }).proof_obligations];
}

function executionReceiptFromContext(context) {
  const candidates = [
    context?.execution_receipt,
    context?.executionReceipt,
    context?.canonical_execution_receipt,
    context?.canonicalExecutionReceipt,
    context?.execution?.receipt,
    context?.execution?.body,
    context?.receipt,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim() !== '') || null;
}

function proofContainers(context) {
  return [
    context?.proofs,
    context?.workflow_proofs,
    context?.workflowProofs,
    context?.evidence,
    context?.obligation_evidence,
    context?.obligationEvidence,
  ].filter((value) => value && typeof value === 'object' && !Array.isArray(value));
}

function concreteEvidence(value) {
  if (typeof value === 'string') return value.trim() !== '' && !isPlaceholderToken(value);
  if (Array.isArray(value)) return value.some(concreteEvidence);
  if (!value || typeof value !== 'object') return false;
  return ['evidence', 'proof', 'receipt', 'report', 'summary']
    .some((key) => concreteEvidence(value[key]));
}

function evidenceForObligation(context, obligation) {
  for (const container of proofContainers(context)) {
    if (Object.prototype.hasOwnProperty.call(container, obligation) && concreteEvidence(container[obligation])) {
      return container[obligation];
    }
  }
  const aliases = {
    needsInspection: ['inspection', 'inspectionEvidence', 'inspection_evidence'],
    needsDurableTaskState: ['durableTaskState', 'durable_task_state', 'taskState', 'task_state'],
    needsResearchGrounding: ['research', 'researchGrounding', 'research_grounding'],
  };
  for (const key of aliases[obligation] || []) {
    if (concreteEvidence(context?.[key])) return context[key];
  }
  return null;
}

function independentAuditEvidence(context) {
  const runtimeContext = runtimeContextFromContext(context);
  const expectedProvenance = runtimeContext
    ? { base: runtimeContext.base, head: runtimeContext.head }
    : null;
  const candidates = [
    ...proofContainers(context).map((container) => container.needsIndependentAudit),
    context?.independentAudit,
    context?.independent_audit,
    context?.audit,
  ];
  return candidates.find((value) => {
    if (Array.isArray(value)) return false;
    return validateIndependentAuditEvidence(value, expectedProvenance, runtimeContext).valid;
  }) || null;
}

function validateIndependentAuditEvidence(value, expectedProvenance, runtimeContext) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['audit must be an object'] };
  }
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...INDEPENDENT_AUDIT_FIELDS].sort())) {
    errors.push(`audit fields must be exactly ${INDEPENDENT_AUDIT_FIELDS.join(', ')}`);
  }
  if (value.schema_version !== INDEPENDENT_AUDIT_SCHEMA_VERSION) {
    errors.push(`audit.schema_version must be "${INDEPENDENT_AUDIT_SCHEMA_VERSION}"`);
  }
  for (const field of ['reviewer_session_id', 'implementation_session_id']) {
    if (typeof value[field] !== 'string' || isPlaceholderToken(value[field])) {
      errors.push(`audit.${field} must be concrete`);
    }
  }
  if (typeof value.reviewer_session_id === 'string'
    && typeof value.implementation_session_id === 'string'
    && value.reviewer_session_id.trim() === value.implementation_session_id.trim()) {
    errors.push('audit reviewer and implementation sessions must be distinct');
  }
  if (typeof value.evidence !== 'string' || isPlaceholderToken(value.evidence)) {
    errors.push('audit.evidence must be concrete');
  }
  if (value.verdict !== 'PASS') errors.push('audit.verdict must be literal PASS');

  if (!PROVENANCE.isTrustedRuntimeContext(runtimeContext)) {
    errors.push('audit runtime provenance/session context is unavailable');
  } else if (typeof value.implementation_session_id === 'string'
    && value.implementation_session_id.trim() !== runtimeContext.runtime_session) {
    errors.push('audit implementation session does not match the runtime session');
  }

  if (!value.expected_provenance
    || typeof value.expected_provenance !== 'object'
    || Array.isArray(value.expected_provenance)
    || JSON.stringify(Object.keys(value.expected_provenance).sort()) !== JSON.stringify(['base', 'head'])) {
    errors.push('audit.expected_provenance must contain exactly base and head');
  }
  const actualBinding = expectedProvenanceFromSource(value.expected_provenance);
  const runtimeBinding = PROVENANCE.isTrustedRuntimeContext(runtimeContext)
    ? { base: runtimeContext.base, head: runtimeContext.head }
    : null;
  if (!actualBinding
    || !isConcreteProvenanceValue(actualBinding.base)
    || !isConcreteProvenanceValue(actualBinding.head)
    || !expectedProvenance
    || !isConcreteProvenanceValue(expectedProvenance.base)
    || !isConcreteProvenanceValue(expectedProvenance.head)
    || normalizeProvenanceValue(actualBinding.base) !== normalizeProvenanceValue(expectedProvenance.base)
    || normalizeProvenanceValue(actualBinding.head) !== normalizeProvenanceValue(expectedProvenance.head)) {
    errors.push('audit expected Base and Head binding does not match the runtime binding');
  }
  if (runtimeBinding
    && (normalizeProvenanceValue(actualBinding?.base) !== runtimeBinding.base
      || normalizeProvenanceValue(actualBinding?.head) !== runtimeBinding.head)) {
    errors.push('audit expected Base and Head do not match the freshly derived runtime binding');
  }
  return { valid: errors.length === 0, errors };
}

function completionReceiptOptions(context) {
  const task = context?.task_context || context?.taskContext || context?.task || context;
  const runtimeContext = runtimeContextFromContext(context);
  const derived = receiptValidatorOptions(task && typeof task === 'object' ? task : {}, {
    requireProvenanceBinding: true,
    runtimeContext,
  });
  const supplied = context?.receipt_options || context?.receiptOptions;
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return derived;
  return {
    ...derived,
    ...supplied,
    artifactDeclarationValid: derived.artifactDeclarationValid === false
      ? false
      : supplied.artifactDeclarationValid !== false,
    requireArtifactHash: derived.requireArtifactHash === true || supplied.requireArtifactHash === true,
    artifactPaths: derived.artifactPaths.length > 0 ? derived.artifactPaths : (Array.isArray(supplied.artifactPaths) ? supplied.artifactPaths : []),
    artifactRoot: derived.artifactRoot,
    verifyArtifactBytes: derived.verifyArtifactBytes === true || supplied.verifyArtifactBytes === true,
    expectedProvenance: derived.expectedProvenance,
    requireProvenanceBinding: true,
  };
}

function runtimeBoundProofsFromSpec(spec, runtimeContext) {
  // Spec files are worker-writable: plain proof strings are never execution
  // evidence. Only canonical receipts bound to this fresh runtime may enter
  // the completion decision; independent audit remains a strict object schema.
  const proofSources = [
    'completion_proofs',
    'completionProofs',
    'workflow_proofs',
    'workflowProofs',
    'obligation_evidence',
    'obligationEvidence',
    'proofs',
  ];
  const sourceKey = proofSources.find((key) => spec && spec[key] && typeof spec[key] === 'object' && !Array.isArray(spec[key]));
  if (!sourceKey) return null;
  const source = spec[sourceKey];
  const trusted = {};
  const receiptOptions = receiptValidatorOptions({}, {
    runtimeContext,
    requireProvenanceBinding: true,
  });
  for (const [obligation, value] of Object.entries(source)) {
    if (obligation === 'needsIndependentAudit') {
      trusted[obligation] = value;
      continue;
    }
    const candidates = value && typeof value === 'object' && !Array.isArray(value)
      ? [value.receipt, value.execution_receipt, value.executionReceipt]
      : [];
    const receipt = candidates.find((candidate) => (
      typeof candidate === 'string'
      && validateCanonicalReceipt(candidate, receiptOptions).length === 0
    ));
    if (receipt) trusted[obligation] = { receipt };
  }
  return trusted;
}

function completionDecisionForSpec(spec, {
  runtimeContext,
  executionReceipt,
  taskContext,
} = {}) {
  const policy = spec && typeof spec === 'object' ? spec.workflow_policy : null;
  const policyView = policy ? readWorkflowPolicySnapshot({ workflow_policy: policy }) : null;
  const context = {
    workflow_policy: policy,
    runtime_context: runtimeContext,
    execution_receipt: executionReceipt,
    task_context: taskContext,
  };
  const trustedProofs = runtimeBoundProofsFromSpec(spec, runtimeContext);
  if (trustedProofs) context.proofs = trustedProofs;
  if (policyView && policyView.lane === 'Direct') {
    return {
      completion: 'not_applicable',
      unfinished: false,
      missingProof: [],
      blocker: null,
    };
  }
  return completionDecision('PASS', context);
}

function completionDecision(verdict, context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) context = {};
  const normalized = normalizeVerdict(verdict);
  if (normalized.verdict === 'PASS_WITH_WARNINGS') {
    return {
      verdict: normalized.verdict,
      action: 'review-passed-with-warnings',
      completion: 'unfinished',
      terminal: true,
      unfinished: true,
      retry: false,
      blocker: context.blocker || 'PASS_WITH_WARNINGS is not a completion verdict; literal PASS is required',
    };
  }
  if (normalized.verdict !== 'PASS') {
    return unfinishedVerdictDecision(normalized.verdict, context, normalized.diagnostic);
  }

  const runtimeContext = runtimeContextFromContext(context);
  if (!runtimeContext) {
    return {
      verdict: normalized.verdict,
      action: 'blocked-runtime-provenance',
      completion: 'unfinished',
      terminal: true,
      unfinished: true,
      retry: false,
      blocker: 'completion blocked: runtime-derived provenance and session context are unavailable or stale',
      missingProof: ['runtime_provenance'],
    };
  }
  const decisionContext = { ...context, runtime_context: runtimeContext };

  const missing = [];
  const receipt = executionReceiptFromContext(decisionContext);
  const receiptFailures = receipt
    ? validateCanonicalReceipt(receipt, completionReceiptOptions(decisionContext))
    : ['verification_state'];
  if (receiptFailures.length > 0) missing.push(`execution_receipt:${receiptFailures.join(',')}`);

  const obligations = workflowPolicyObligations(decisionContext);
  if (!obligations) {
    missing.push('workflow_policy.proof_obligations');
  } else {
    for (const obligation of obligations) {
      if (obligation === 'needsExecutionProof') continue;
      if (obligation === 'needsIndependentAudit') {
        if (!independentAuditEvidence(decisionContext)) missing.push(obligation);
        continue;
      }
      if (!evidenceForObligation(decisionContext, obligation)) missing.push(obligation);
    }
  }
  if (missing.length > 0) {
    return {
      verdict: normalized.verdict,
      ...(normalized.diagnostic ? { diagnostic: normalized.diagnostic } : {}),
      action: 'await-required-proof',
      completion: 'unfinished',
      terminal: true,
      unfinished: true,
      retry: false,
      blocker: decisionContext.blocker || `completion blocked: missing ${missing.join(', ')}`,
      missingProof: missing,
    };
  }
  return {
    verdict: normalized.verdict,
    action: 'complete',
    completion: 'complete',
    terminal: true,
    unfinished: false,
    retry: false,
    blocker: null,
  };
}

function consumeReviewVerdict(verdict, context = {}) {
  const result = adaptVerdict(verdict, context);
  return {
    ...result,
    source: 'review',
    completion: 'unfinished',
    unfinished: true,
    createsCompletion: false,
    completionDecisionRequired: true,
    action: result.verdict === 'PASS' || result.verdict === 'PASS_WITH_WARNINGS'
      ? 'review-result-only'
      : result.action,
    blocker: result.verdict === 'PASS' || result.verdict === 'PASS_WITH_WARNINGS'
      ? context.blocker || 'review verdict is not completion proof'
      : result.blocker,
  };
}

function isFlashUnverified(task) {
  return task?.status === 'in_progress' && task.receipt === 'FLASH_UNVERIFIED';
}

function isCanonicalFlashUnverified(task) {
  return isFlashUnverified(task)
    && task.dependencyBlocked === true
    && task.unblocks === false
    && typeof task.blocker === 'string'
    && !isPlaceholderToken(task.blocker)
    && !FLASH_PROMOTION_FIELDS.some((field) => hasOwn(task, field));
}

function isStaleFlashDone(task) {
  return task?.status === 'done' && task.receipt === 'FLASH_UNVERIFIED';
}

const SYNC_FINALIZE_CAPABILITY = Symbol('sync-finalize-capability');
const trustedFlashPromotions = new WeakMap();

function flashRuntimeContext(value) {
  if (!PROVENANCE.isTrustedRuntimeContext(value)) return null;
  try { return PROVENANCE.recomputeRuntimeContext(value); } catch (_) { return null; }
}

function evaluateFlashPromotion(task, verdict, proof = 'Verification: PASS', capability = null, runtimeContext) {
  const trustedRuntime = flashRuntimeContext(runtimeContext);
  if (!trustedRuntime) {
    return blockedFlashSync(task, 'flash promotion blocked: runtime-derived provenance and session context are unavailable or stale');
  }
  const normalized = normalizeVerdict(verdict);
  if (!isFlashUnverified(task)) return task;

  if (normalized.verdict !== 'PASS') {
    return {
      ...task,
      status: 'in_progress',
      receipt: 'FLASH_UNVERIFIED',
      blocker: normalized.diagnostic === 'NO_TESTS'
        ? 'awaiting test proof from /cf:test <feature>'
        : normalized.diagnostic === 'PARTIAL'
          ? 'verification is partial; awaiting complete test proof'
          : `verification returned ${normalized.verdict}`,
      dependencyBlocked: true,
      unblocks: false,
      readyForSync: false,
      flashTransition: 'unverified',
      promotionReceipt: null,
    };
  }

  if (typeof proof !== 'string') {
    throw new TypeError('PASS promotion requires a concrete Verification: PASS receipt');
  }
  const failures = validateCanonicalReceipt(proof, receiptValidatorOptions(task, {
    requireProvenanceBinding: true,
    runtimeContext: trustedRuntime,
  }));
  if (failures.length > 0) {
    return {
      ...task,
      status: 'in_progress',
      receipt: 'FLASH_UNVERIFIED',
      blocker: `canonical receipt required for promotion: missing ${failures.join(', ')}`,
      dependencyBlocked: true,
      unblocks: false,
      readyForSync: false,
      flashTransition: 'unverified',
      promotionReceipt: null,
    };
  }

  const promoted = {
    ...task,
    status: 'in_progress',
    receipt: proof.trim(),
    blocker: null,
    dependencyBlocked: true,
    unblocks: false,
    readyForSync: true,
    flashTransition: 'promoted',
    promotionReceipt: proof.trim(),
  };
  if (capability === SYNC_FINALIZE_CAPABILITY) trustedFlashPromotions.set(promoted, capability);
  return promoted;
}

function promoteFlashTask(task, verdict, proof = 'Verification: PASS', runtimeContext) {
  const candidate = runtimeContext
    || task?.runtime_context
    || task?.runtimeContext
    || task?.receipt_binding?.runtimeContext
    || task?.receiptBinding?.runtimeContext;
  return evaluateFlashPromotion(task, verdict, proof, null, candidate);
}

function finalizeFlashTaskInternal(task, operation, capability, runtimeContext) {
  if (operation !== 'sync-finalize' || capability !== SYNC_FINALIZE_CAPABILITY || trustedFlashPromotions.get(task) !== capability) {
    return blockedFlashSync(task, 'sync-finalize blocked: only trusted same-operation promotion may finalize');
  }
  if (
    task?.status !== 'in_progress'
    || task.readyForSync !== true
  ) return blockedFlashSync(task, 'sync-finalize blocked: trusted promotion state is incomplete');
  const receipt = String(task.receipt || '');
  if (task.flashTransition !== 'promoted' || task.promotionReceipt !== receipt) {
    return blockedFlashSync(task, 'sync-finalize blocked: trusted promotion state is incomplete');
  }
  const failures = validateCanonicalReceipt(receipt, receiptValidatorOptions(task, {
    requireProvenanceBinding: true,
    runtimeContext,
  }));
  if (failures.length > 0) {
    return blockedFlashSync(task, `sync-finalize blocked: canonical receipt required (${failures.join(', ')})`);
  }

  trustedFlashPromotions.delete(task);
  return {
    ...task,
    status: 'done',
    dependencyBlocked: false,
    unblocks: true,
    readyForSync: false,
    flashTransition: 'finalized',
  };
}

function finalizeFlashTask(task, operation) {
  if (operation !== 'sync-finalize') return task;
  return blockedFlashSync(task, 'sync-finalize blocked: only syncFinalizeFlashTask owns finalization');
}

function blockedFlashSync(task, blocker) {
  return {
    ...task,
    status: 'in_progress',
    receipt: 'FLASH_UNVERIFIED',
    dependencyBlocked: true,
    unblocks: false,
    readyForSync: false,
    flashTransition: 'unverified',
    promotionReceipt: null,
    blocker,
  };
}

function syncFinalizeFlashTask(task, verdict, proof, runtimeContext) {
  if (!isCanonicalFlashUnverified(task)) {
    return blockedFlashSync(
      task,
      'sync-finalize blocked: current task must be FLASH_UNVERIFIED in the exact canonical stored state; caller promotion state is not trusted',
    );
  }
  if (verdict !== 'PASS') {
    return blockedFlashSync(task, 'sync-finalize blocked: explicit PASS verdict is required');
  }
  if (typeof proof !== 'string' || proof.trim() === '') {
    return blockedFlashSync(task, 'sync-finalize blocked: explicit canonical --proof is required');
  }

  // Treat all promotion fields from --task-json as untrusted. Rebuild the
  // unverified state, then derive promotion and finalization in this operation.
  const current = {
    ...task,
    readyForSync: false,
    flashTransition: 'unverified',
    promotionReceipt: null,
    dependencyBlocked: true,
    unblocks: false,
  };
  const candidate = runtimeContext
    || task?.runtime_context
    || task?.runtimeContext
    || task?.receipt_binding?.runtimeContext
    || task?.receiptBinding?.runtimeContext;
  const trustedRuntime = flashRuntimeContext(candidate);
  if (!trustedRuntime) {
    return blockedFlashSync(task, 'sync-finalize blocked: runtime-derived provenance and session context are unavailable or stale');
  }
  const promoted = evaluateFlashPromotion(current, 'PASS', proof, SYNC_FINALIZE_CAPABILITY, trustedRuntime);
  if (promoted.readyForSync !== true) return promoted;
  return finalizeFlashTaskInternal(promoted, 'sync-finalize', SYNC_FINALIZE_CAPABILITY, trustedRuntime);
}

function flashState(taskRegistry = {}) {
  return Object.entries(taskRegistry)
    .filter(([, task]) => isFlashUnverified(task))
    .map(([taskPath]) => taskPath);
}

// Every other section of a task file writes its fields as list items — the Verification
// Plan's own `- Command:` sits a few lines above the Receipt — so continuing that house
// style inside the Receipt is the natural mistake, and it used to fail five checks at
// once with a message that pointed at the content instead of the dash. Accept either
// form. The receipt body is cut to its own `## Receipt` section, so this cannot pick up
// the Verification Plan's fields.
const RECEIPT_FIELD_PREFIX = '\\s*(?:[-*+]\\s+)?';

function receiptFieldPattern(name, tail = '\\s*:', flags = '') {
  return new RegExp(`^${RECEIPT_FIELD_PREFIX}${name}${tail}`, flags);
}

function validateCanonicalReceipt(body, options = {}) {
  if (typeof body !== 'string') return ['verification_state'];
  const failures = [];
  const addFailure = (failure) => {
    if (!failures.includes(failure)) failures.push(failure);
  };
  // Fail-closed on placeholders anywhere — provenance, command, or artifact must not be templated
  if (/\{\{[^}]+\}\}/.test(body)) {
    addFailure('placeholder');
    // placeholder also implies missing concrete provenance/command; keep explicit failures for mapping
  }
  // Explicit failure outcome anywhere in body must make canonical validator fail (structured only)
  if (hasExplicitFailure(body)) {
    addFailure('verification_state');
  }
  // Unambiguous verification state: must be Verification: PASS exactly
  if (!receiptFieldPattern('Verification', '\\s*:\\s*PASS\\s*$', 'm').test(body)) {
    addFailure('verification_state');
  }
  // Command must be present with non-empty concrete value on same line, not placeholder
  const cmdLine = body.split('\n').find((l) => receiptFieldPattern('Command(?:\\(s\\))?', '\\s*:', 'm').test(l)) || null;
  if (!cmdLine || !receiptFieldPattern('Command(?:\\(s\\))?', '\\s*:[ \\t]*\\S', 'm').test(cmdLine)) {
    addFailure('command');
  } else {
    const m = cmdLine.match(receiptFieldPattern('Command(?:\\(s\\))?', '\\s*:[ \\t]*(.*)$', 'm'));
    const val = m ? m[1].trim() : '';
    if (isPlaceholderToken(val)) {
      addFailure('command');
    } else if (/\{\{[^}]+\}\}/.test(cmdLine)) {
      addFailure('command');
    }
  }
  // Exit / Result handling: collect all Result lines; if no Exit then need at least one Result and all PASS; if has Exit then every Exit integer 0 and every Result if any all PASS
  const lines = body.split('\n');
  const exitValues = [];
  const resultValues = [];
  for (const line of lines) {
    if (receiptFieldPattern('Exit', '\\s*:', 'i').test(line)) {
      const m = line.match(receiptFieldPattern('Exit', '\\s*:\\s*(.*)$', 'i'));
      exitValues.push(m ? m[1].trim() : '');
    } else if (/exit\s+code\s*[:=]/i.test(line)) {
      const m = line.match(/exit\s+code\s*[:=]\s*(.*)$/i);
      if (m) exitValues.push(m[1].trim());
    }
    if (receiptFieldPattern('Result', '\\s*:', 'i').test(line)) {
      const m = line.match(receiptFieldPattern('Result', '\\s*:\\s*(.+?)\\s*$', 'i'));
      resultValues.push(m ? m[1].trim() : '');
    }
  }

  if (exitValues.length === 0) {
    if (resultValues.length === 0 || resultValues.some((v) => v !== 'PASS')) {
      addFailure('exit_result');
    }
  } else {
    let exitOk = true;
    for (const v of exitValues) {
      if (!/^-?\d+$/.test(v)) { exitOk = false; break; }
      const n = Number.parseInt(v, 10);
      if (n !== 0) { exitOk = false; break; }
    }
    if (!exitOk) addFailure('exit_result');
    if (resultValues.length > 0 && resultValues.some((v) => v !== 'PASS')) {
      addFailure('exit_result');
    }
  }
  // Provenance is either a concrete Base/Head pair or a concrete base_sha/head_sha pair.
  // Without expected values this validates schema only; it does not claim identity binding.
  const receiptLines = body.split('\n');
  const readField = (name) => receiptLines
    .filter((line) => receiptFieldPattern(name, '\\s*:', 'i').test(line))
    .map((line) => line.replace(receiptFieldPattern(name, '\\s*:\\s*', 'i'), '').trim());
  const baseValues = readField('Base');
  const headValues = readField('Head');
  const baseShaValues = readField('base_sha');
  const headShaValues = readField('head_sha');
  const labelStyle = baseValues.length > 0 || headValues.length > 0;
  const shaStyle = baseShaValues.length > 0 || headShaValues.length > 0;
  let actualProvenance = null;
  if (labelStyle === shaStyle || labelStyle && (baseShaValues.length > 0 || headShaValues.length > 0)) {
    addFailure('provenance');
  } else {
    const base = labelStyle ? baseValues : baseShaValues;
    const head = labelStyle ? headValues : headShaValues;
    if (base.length !== 1 || head.length !== 1 || !isConcreteProvenanceValue(base[0]) || !isConcreteProvenanceValue(head[0])) {
      addFailure('provenance');
    } else {
      actualProvenance = { base: normalizeProvenanceValue(base[0]), head: normalizeProvenanceValue(head[0]) };
    }
  }
  const expected = options.expectedProvenance || options.expected_provenance || options.expected || null;
  const expectedBase = expected && typeof expected === 'object'
    ? firstDefined(expected, ['base', 'Base', 'base_sha', 'baseSha', 'expectedBase', 'expected_base'])
    : options.expectedBase ?? options.expected_base ?? options.expectedBaseSha ?? options.expected_base_sha;
  const expectedHead = expected && typeof expected === 'object'
    ? firstDefined(expected, ['head', 'Head', 'head_sha', 'headSha', 'expectedHead', 'expected_head'])
    : options.expectedHead ?? options.expected_head ?? options.expectedHeadSha ?? options.expected_head_sha;
  if (options.requireProvenanceBinding === true || expectedBase !== undefined || expectedHead !== undefined) {
    if (!actualProvenance
      || !isConcreteProvenanceValue(expectedBase)
      || !isConcreteProvenanceValue(expectedHead)
      || normalizeProvenanceValue(expectedBase) !== actualProvenance.base
      || normalizeProvenanceValue(expectedHead) !== actualProvenance.head) {
      addFailure('provenance');
    }
  }

  if (options.artifactDeclarationValid === false) addFailure('artifact_declaration');
  const artifactDeclarations = parseArtifactDeclarations(body);
  for (const declaration of artifactDeclarations) {
    if (declaration.hashes.length === 0 || declaration.hashes.some((hash) => !/^[a-f0-9]{64}$/i.test(hash))) {
      addFailure('artifact_hash');
    }
    const declaredPaths = declaration.pathText
      .split(/\s*(?:\+|,|;|\band\b)\s*/i)
      .map((value) => value.trim())
      .filter(Boolean);
    if (declaredPaths.length > 1 && declaration.hashes.length !== declaredPaths.length) {
      addFailure('artifact_hash');
    }
  }
  const artifactPaths = Array.isArray(options.artifactPaths) ? options.artifactPaths : [];
  if (options.requireArtifactHash) {
    if (artifactDeclarations.length === 0) addFailure('artifact_hash');
    for (const artifactPath of artifactPaths) {
      const matches = artifactDeclarations.filter((declaration) => {
        const candidates = declaration.pathText.split(/\s*(?:\+|,|;|\band\b)\s*/i).map((value) => value.trim()).filter(Boolean);
        return candidates.length === 1 && candidates.includes(artifactPath);
      });
      if (matches.length !== 1 || matches[0].hashes.length !== 1 || !/^[a-f0-9]{64}$/i.test(matches[0].hashes[0])) {
        addFailure('artifact_hash');
      }
    }
  }
  if (options.verifyArtifactBytes === true || typeof options.artifactRoot === 'string') {
    if (typeof options.artifactRoot !== 'string' || options.artifactRoot.trim() === '') {
      if (artifactDeclarations.length > 0 || options.requireArtifactHash) addFailure('artifact_hash');
    } else {
      for (const declaration of artifactDeclarations) {
        const declaredPaths = declaration.pathText
          .split(/\s*(?:\+|,|;|\band\b)\s*/i)
          .map((value) => value.trim())
          .filter(Boolean);
        if (declaredPaths.length === 0 || declaration.hashes.length !== declaredPaths.length) {
          addFailure('artifact_hash');
          continue;
        }
        for (let index = 0; index < declaredPaths.length; index += 1) {
          if (!hashValidatedArtifact(options.artifactRoot, declaredPaths[index], declaration.hashes[index])) {
            addFailure('artifact_hash');
          }
        }
      }
    }
  }
  return failures;
}

function parseCliArgs(argv) {
  const options = {
    flash: false,
    parallel: false,
    json: false,
    verdict: null,
    task: null,
    action: null,
    lane: null,
    override: null,
    proof: null,
    userAuthorized: false,
    origin: null,
    projectRoot: null,
    specsRoot: null,
    specFile: null,
    featureName: null,
    runtimeSession: null,
    provenanceMode: null,
    runtimeContextInput: undefined,
  };
  const args = [...argv];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--flash') options.flash = true;
    else if (arg === '--parallel') options.parallel = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--user-authorized') options.userAuthorized = true;
    else if (arg === '--origin') options.origin = args[++i];
    else if (arg === '--consume-verdict') options.action = 'consume-verdict';
    else if (arg === '--promote-flash') options.action = 'promote-flash';
    else if (arg === '--sync-finalize') options.action = 'sync-finalize';
    else if (arg === '--classify-lane') options.action = 'classify-lane';
    else if (arg === '--lane-policy') options.action = 'lane-policy';
    else if (arg === '--policy-snapshot') options.action = 'policy-snapshot';
    else if (arg === '--validate-policy') options.action = 'validate-policy';
    else if (arg === '--completion-decision') options.action = 'completion-decision';
    else if (arg === '--approval-state') options.action = 'approval-state';
    else if (arg === '--validate-approval') options.action = 'validate-approval';
    else if (arg === '--validate-receipt') options.action = 'validate-receipt';
    else if (arg === '--lane') options.lane = args[++i];
    else if (arg === '--override') options.override = args[++i];
    else if (arg === '--verdict') {
      options.verdict = args[++i];
      if (!options.verdict) throw new Error('--verdict requires a value');
    } else if (arg === '--task-json') {
      const raw = args[++i];
      if (!raw) throw new Error('--task-json requires a JSON value');
      options.task = JSON.parse(raw);
    } else if (arg === '--proof') {
      options.proof = args[++i];
      if (!options.proof) throw new Error('--proof requires a value');
    } else if (arg === '--project-root') options.projectRoot = args[++i];
    else if (arg === '--specs-root') options.specsRoot = args[++i];
    else if (arg === '--spec-file') options.specFile = args[++i];
    else if (arg === '--feature-name') options.featureName = args[++i];
    else if (arg === '--runtime-session' || arg === '--session') options.runtimeSession = args[++i];
    else if (arg === '--provenance-mode') options.provenanceMode = args[++i];
    else if (arg === '--runtime-context') {
      const raw = args[++i];
      if (!raw) throw new Error('--runtime-context requires a JSON value');
      options.runtimeContextInput = JSON.parse(raw);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function cliRuntimeContext(options) {
  if (options.runtimeContextInput !== undefined) {
    throw new Error('--runtime-context JSON is not trusted; provide runtime identity flags');
  }
  const supplied = [options.projectRoot, options.specsRoot, options.specFile, options.featureName, options.runtimeSession]
    .some((value) => value !== null && value !== undefined);
  if (!supplied) return null;
  return PROVENANCE.deriveRuntimeContext({
    projectRoot: options.projectRoot,
    specsRoot: options.specsRoot,
    specFile: options.specFile,
    featureName: options.featureName,
    runtimeSession: options.runtimeSession,
    provenanceMode: options.provenanceMode || undefined,
  });
}

function cliResult(result, json) {
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.message}\n`);
  return result.exitCode;
}

function runCli(argv = process.argv.slice(2)) {
  try {
    const options = parseCliArgs(argv);
    const policy = executionPolicy(options);
    if (!policy.allowed) {
      return cliResult({
        ok: false,
        contract: 'execution-policy',
        ...policy,
        message: 'Unsupported flags: --flash and --parallel are incompatible.\nNo spec state, task receipt, worktree, subagent, or commit was created.',
        exitCode: 2,
      }, options.json);
    }

    if (options.action === 'classify-lane') {
      const input = options.task || {};
      // Merge CLI lane/override and auth flags into input
      const merged = { ...input };
      if (options.lane) merged.override = options.lane;
      if (options.override) merged.override = options.override;
      if (options.userAuthorized) merged.userAuthorized = true;
      if (options.origin) merged.origin = options.origin;
      const classification = classifyLane(merged);
      return cliResult({ ok: true, classification, policy: lanePolicy(classification), exitCode: 0, message: `Lane: ${classification.lane}` }, options.json);
    }
    if (options.action === 'lane-policy') {
      const input = options.task || options.lane;
      if (!input) throw new Error('--lane-policy requires --lane or --task-json');
      const policy = lanePolicy(input);
      return cliResult({ ok: true, policy, exitCode: 0, message: `Lane: ${policy.lane}` }, options.json);
    }
    if (options.action === 'policy-snapshot') {
      if (!options.task) throw new Error('--policy-snapshot requires --task-json');
      const snapshot = canonicalWorkflowPolicySnapshot(options.task);
      const view = readWorkflowPolicySnapshot({ workflow_policy: snapshot });
      return cliResult({ ok: true, snapshot, exitCode: 0, message: `Policy snapshot: ${view.lane}` }, options.json);
    }
    if (options.action === 'validate-policy') {
      if (!options.task) throw new Error('--validate-policy requires --task-json');
      const snapshot = hasOwn(options.task, 'workflow_policy') ? options.task.workflow_policy : options.task;
      const result = validateWorkflowPolicySnapshot(snapshot);
      return cliResult({ ok: result.valid, ...result, exitCode: result.valid ? 0 : 2, message: result.valid ? 'Workflow policy snapshot valid' : result.errors.join('; ') }, options.json);
    }
    if (options.action === 'approval-state') {
      if (!options.task) throw new Error('--approval-state requires --task-json');
      const state = approvalState(options.task);
      return cliResult({ ok: true, state, exitCode: 0, message: `Approval ready: ${state.ready}` }, options.json);
    }
    if (options.action === 'validate-approval') {
      if (!options.task) throw new Error('--validate-approval requires --task-json');
      const result = validateApprovalSchema(options.task);
      return cliResult({ ok: result.valid, ...result, exitCode: result.valid ? 0 : 2, message: result.valid ? 'Approval schema valid' : result.error }, options.json);
    }
    if (options.action === 'validate-receipt') {
      if (!options.task) throw new Error('--validate-receipt requires --task-json');
      const body = options.task.body || options.task.receipt || '';
      const failures = validateCanonicalReceipt(body, receiptValidatorOptions(options.task, { runtimeContext: cliRuntimeContext(options) }));
      return cliResult({ ok: failures.length === 0, failures, exitCode: failures.length === 0 ? 0 : 2, message: failures.length === 0 ? 'Receipt valid' : `Receipt missing: ${failures.join(', ')}` }, options.json);
    }
    if (options.action === 'consume-verdict') {
      const result = consumeReviewVerdict(options.verdict, options.task || {});
      return cliResult({ ok: true, ...result, exitCode: 0, message: `Verdict ${options.verdict}: ${result.action}` }, options.json);
    }
    if (options.action === 'completion-decision') {
      const runtimeContext = cliRuntimeContext(options);
      const result = completionDecision(options.verdict, runtimeContext
        ? { ...(options.task || {}), runtime_context: runtimeContext }
        : (options.task || {}));
      return cliResult({ ok: true, ...result, exitCode: 0, message: `Verdict ${options.verdict}: ${result.completion}` }, options.json);
    }
    if (options.action === 'promote-flash') {
      if (!options.task) throw new Error('--promote-flash requires --task-json');
      const result = promoteFlashTask(options.task, options.verdict, options.proof, cliRuntimeContext(options));
      return cliResult({ ok: true, task: result, exitCode: 0, message: 'Flash task promotion evaluated.' }, options.json);
    }
    if (options.action === 'sync-finalize') {
      if (!options.task) throw new Error('--sync-finalize requires --task-json');
      const result = syncFinalizeFlashTask(options.task, options.verdict, options.proof, cliRuntimeContext(options));
      const ok = result.status === 'done';
      return cliResult({ ok, task: result, exitCode: ok ? 0 : 2, message: ok ? 'Flash task sync-finalize evaluated.' : (result.blocker || 'Flash task sync-finalize blocked.') }, options.json);
    }

    return cliResult({ ok: true, contract: 'execution-policy', ...policy, exitCode: 0, message: `Execution mode: ${policy.mode}` }, options.json);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
}

if (require.main === module) process.exitCode = runCli();

module.exports = {
  REVIEW_VERDICTS,
  CANONICAL_VERDICTS,
  LEGACY_DIAGNOSTIC_VERDICTS,
  EXECUTION_TIERS,
  LANES,
  PLANNING_DEPTHS,
  ASSURANCE_LEVELS,
  ARTIFACT_PROFILES,
  PLANNING_OBLIGATIONS,
  PROOF_OBLIGATIONS,
  WORKFLOW_POLICY_VERSION,
  WORKFLOW_POLICY_FIELDS,
  CANONICAL_WORKFLOW_POLICY_VERSION,
  CANONICAL_WORKFLOW_POLICY_FIELDS,
  RECEIPT_BINDING_FIELDS,
  INDEPENDENT_AUDIT_SCHEMA_VERSION,
  INDEPENDENT_AUDIT_FIELDS,
  APPROVAL_SCHEMA_VERSION,
  LEGACY_APPROVAL_ERROR,
  executionPolicy,
  classifyLane,
  compatibilityLane,
  planningObligationsFor,
  obligationsForAssurance,
  obligationsForLane,
  actorNeedsFor,
  isWorkflowPolicySnapshot,
  validateWorkflowPolicySnapshot,
  assertWorkflowPolicySnapshot,
  workflowPolicySnapshot,
  canonicalWorkflowPolicySnapshot,
  isCanonicalTasklessTerminalSpec,
  createWorkflowPolicySnapshot,
  persistWorkflowPolicySnapshot,
  persistWorkflowPolicy,
  readWorkflowPolicySnapshot,
  escalateWorkflowPolicy,
  policyForSpec,
  lanePolicy,
  approvalState,
  validateApprovalSchema,
  isLegacyApprovalObject,
  isTapMetadataHeading,
  deriveRuntimeContext: PROVENANCE.deriveRuntimeContext,
  recomputeRuntimeContext: PROVENANCE.recomputeRuntimeContext,
  isTrustedRuntimeContext: PROVENANCE.isTrustedRuntimeContext,
  createReceiptBinding,
  receiptValidatorOptions,
  validateCanonicalReceipt,
  validateIndependentAuditEvidence,
  completionDecisionForSpec,
  delegationPlan,
  assertVerdict,
  normalizeVerdict,
  adaptVerdict,
  completionDecision,
  consumeReviewVerdict,
  isFlashUnverified,
  isCanonicalFlashUnverified,
  isStaleFlashDone,
  promoteFlashTask,
  finalizeFlashTask,
  syncFinalizeFlashTask,
  flashState,
  parseCliArgs,
  runCli,
};
