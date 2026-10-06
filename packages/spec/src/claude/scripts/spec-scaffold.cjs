#!/usr/bin/env node
/**
 * CafeKit spec SCAFFOLD generator (Specs v2 — output-cost reducer).
 *
 * Field tests showed the dominant cost of a spec run is OUTPUT tokens: the
 * model hand-Writes spec.json + every task file from scratch (a 16-task spec
 * emitted ~935K output tokens). This script does the mechanical scaffolding so
 * the model only has to Edit-fill content, not Write whole files.
 *
 * It creates spec.json (with task_files + task_registry pre-populated) and one
 * stub per task from the canonical templates, leaving the `{{...}}` placeholders
 * for the model to fill. It NEVER overwrites an existing spec directory.
 *
 * Usage:
 *   node spec-scaffold.cjs <feature> [--tasks "R0-01-slug,R1-01-slug,..."] \
 *        [--boundaries '[{"id":"B-OWN","type":"ownership",...}]'] \
 *        [--lane Standard|Critical] [--planning-depth None|Compact|Full] \
 *        [--assurance-level Routine|Elevated|Strict] [--research] [--risks auth,privacy] \
 *        [--lang en] [--title "..."] [--specs-root specs] \
 *        [--artifacts '{"R1-01-slug":["dist/output.js"]}'] \
 *        [--dependencies '{"R1-02-consumer":["R1-01-owner"]}']
 *
 * Exit: 0 = scaffolded, 2 = usage/precondition error.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const POLICY = require('./workflow-policy.cjs');
const SEMANTIC = require('./spec-semantic-model.cjs');
const AUTHORING_DIGEST = require('./spec-authoring-digest.cjs');
const PATH_SAFETY = require('../hooks/lib/runtime-path-safety.cjs');

const TEMPLATES = path.join(__dirname, '..', 'skills', 'specs', 'templates');

function resolveTemplatePath(name) {
  const adapterRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(adapterRoot, '..');
  const candidates = [
    { file: path.join(TEMPLATES, name), root: adapterRoot },
    // Packed Codex: <project>/.codex/scripts/spec-scaffold.cjs -> <project>/.agents/skills/specs/templates
    {
      file: path.resolve(__dirname, '..', '..', '.agents', 'skills', 'specs', 'templates', name),
      root: projectRoot,
    },
  ];
  for (const candidate of candidates) {
    try {
      return PATH_SAFETY.canonicalRegularFile(candidate.root, candidate.file, 'spec template');
    } catch (e) {
      if (e.code !== 'ENOENT' && !/cannot be inspected \(ENOENT\)/.test(e.message)) {
        throw new Error(`template check failed: ${e.message} (${candidate.file})`);
      }
      continue;
    }
  }
  throw new Error(`template not found: ${name} (checked ${candidates.map((item) => item.file).join(', ')})`);
}
const TASK_ID_RE = /^R(\d+)-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const TASK_PATH_RE = /^tasks\/task-(R\d+-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const FEATURE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EXECUTION_CLOSURE_BLOCK_RE = /<!-- EXECUTION_CLOSURE_START -->[\s\S]*?<!-- EXECUTION_CLOSURE_END -->\n?/g;
const REGISTRY_KEYS = [
  'id',
  'title',
  'status',
  'dependencies',
  'blocker',
  'started_at',
  'completed_at',
  'last_updated_at',
];
const AUTHORING_FIELDS = ['requirements', 'design', 'research', 'tasks'];
const AUTHORING_STATES = new Set(['draft', 'validated', 'absent']);
const SPEC_STATUS_VALUES = new Set(['in_progress', 'paused', 'blocked', 'done']);
const TASK_STATUS_VALUES = new Set(['pending', 'in_progress', 'blocked', 'done']);
const VALIDATION_STATUS_VALUES = new Set(['not-run', 'in_progress', 'completed']);
const CANONICAL_SPEC_FIELDS = new Set([
  'schema_version', 'feature_name', 'created_at', 'updated_at', 'language', 'status',
  'scope_lock', 'authoring', 'coordination', 'validation', 'semantic_model', 'ready_for_implementation',
  'workflow_policy', 'research', 'task_files', 'task_registry', 'decisions',
]);
const SCOPE_LOCK_FIELDS = ['source', 'in_scope', 'out_of_scope', 'expansion_policy'];
const COORDINATION_FIELDS = new Set(['boundaries', 'phases']);
// Schema 2.0 legacy shapes (pre-Specs-v2.1 migration input) are frozen as-is;
// they never gain the C2/C13/C16 fields below, which are canonical-2.1-only.
const LEGACY_VALIDATION_FIELDS = ['status', 'semantic_review'];
const LEGACY_SEMANTIC_REVIEW_FIELDS = ['status', 'semantic_digest', 'reviewed_criteria', 'counterexamples', 'reviewed_artifact_digest'];
// Canonical schema 2.1 (R1-01, frozen C2/C13/C16).
const VALIDATION_FIELDS = ['status', 'semantic_review', 'semantic_review_history', 'authoring_validation'];
const PRE_C2_SEMANTIC_REVIEW_FIELDS = ['status', 'semantic_digest', 'reviewed_criteria', 'counterexamples'];
const SEMANTIC_REVIEW_FIELDS = [
  'status', 'semantic_digest', 'verdict', 'lifecycle_disposition', 'findings',
  'unresolved_decisions', 'graph_coverage', 'repair_round', 'reviewed_criteria',
  'counterexamples', 'reviewer_evidence',
];
const SEMANTIC_REVIEW_FINDING_FIELDS = ['id', 'severity', 'location', 'summary', 'blocking', 'disposition'];
const SEMANTIC_REVIEW_DECISION_FIELDS = ['id', 'summary', 'blocking'];
const SEMANTIC_REVIEW_COVERAGE_FIELDS = ['surface', 'covered', 'notes'];
const SEMANTIC_REVIEW_EVIDENCE_FIELDS = ['assurance', 'summary'];
const SEMANTIC_REVIEW_HISTORY_FIELDS = ['lineage_id', 'entries'];
const SEMANTIC_REVIEW_HISTORY_ENTRY_FIELDS = [
  'sequence', 'semantic_digest', 'review_receipt_digest', 'verdict',
  'lifecycle_disposition', 'blocking_count', 'attempt_index', 'review_epoch',
];
const AUTHORING_VALIDATION_FIELDS = ['schema_version', 'requirements', 'design', 'research', 'tasks'];
const AUTHORING_VALIDATION_STAGE_FIELDS = ['digest', 'validated_at'];
const LEGACY_SPEC_FIELDS = [
  ...CANONICAL_SPEC_FIELDS,
  'approvals', 'current_phase', 'override_receipt', 'timestamps',
];
const LEGACY_COORDINATION_FIELDS = [
  ...COORDINATION_FIELDS,
  'tasks_required', 'phases_required', 'reason', 'task_triggers',
];
const LEGACY_TIMESTAMP_FIELDS = [
  'init', 'requirements_done', 'research_done', 'design_done', 'tasks_done',
  'code_done', 'test_done', 'review_done', 'validation_done',
];
const LEGACY_APPROVAL_FIELDS = ['requirements', 'design', 'research', 'tasks'];
const LEGACY_APPROVAL_STATE_FIELDS = ['generated', 'agent_validated', 'user_approved'];
const LEGACY_POLICY_FIELDS = [
  'version', 'planning_depth', 'automatic_planning_depth', 'assurance_level',
  'automatic_assurance_level', 'lane', 'automatic_lane', 'risks', 'artifact_profile',
  'planning_obligations', 'proof_obligations', 'actor_needs', 'classified_minimum', 'override_receipt',
];
const TRANSACTION_PREFIX = '.cafekit-scaffold-tx-';
const TRANSACTION_FORMAT = 'cafekit-spec-scaffold-transaction/1';

class ScaffoldPreconditionError extends Error {}

const USAGE_TEXT = 'Usage: node spec-scaffold.cjs <feature> [--sync-semantic-model] [--tasks "R0-01-slug,R1-01-slug" --boundaries \'[{"id":"B-OWN","type":"ownership",...}]\'] [--lane Standard|Critical] [--planning-depth Compact|Full] [--assurance-level Routine|Elevated|Strict] [--research --uncertainty "..."] [--phases \'[{"id":"phase-1","task_ids":["R1-01"],"entry_condition":"...","exit_condition":"...","owner_boundary":"B-OWN"}]\'] [--risks auth,privacy] [--lang en] [--title "..."] [--specs-root specs]';

// Usage reaches stderr when it accompanies a precondition failure, and stdout
// when the caller asked for it with --help; a requested help text is output,
// not a diagnostic.
function usage() {
  console.error(USAGE_TEXT);
}

function failPrecondition(message) {
  throw new ScaffoldPreconditionError(message);
}

function observeInstalledPolicyBaseline({ args, specDir, spec }) {
  const adapterDir = path.dirname(__dirname);
  const adapterName = path.basename(adapterDir);
  if (path.basename(__dirname) !== 'scripts' || (adapterName !== '.claude' && adapterName !== '.codex')) return;
  const statePath = path.join(adapterDir, 'hooks', 'completion-authority-state.cjs');
  const checkPath = path.join(adapterDir, 'hooks', 'completion-authority-check.cjs');
  if (![statePath, checkPath].every((filePath) => {
    try {
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.isSymbolicLink()) return false;
      const real = fs.realpathSync(filePath);
      const realDir = fs.realpathSync(path.dirname(filePath));
      const rel = path.relative(realDir, real);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
      return true;
    } catch { return false; }
  })) return;
  let installedRoot;
  let scaffoldCwd;
  let specFile;
  try {
    installedRoot = fs.realpathSync(path.resolve(adapterDir, '..'));
    scaffoldCwd = fs.realpathSync(path.resolve(process.cwd()));
    specFile = path.join(specDir, 'spec.json');
    const canonicalSpecFile = fs.realpathSync(specFile);
    if (!isWithin(installedRoot, scaffoldCwd) || !isWithin(installedRoot, canonicalSpecFile)) {
      throw new Error(`scaffold cwd and spec path must stay inside installed project root ${installedRoot}`);
    }
  } catch (error) {
    throw new Error(`installed ${adapterName} scaffold authority baseline could not be verified: ${error.message}`);
  }
  let STATE;
  let check;
  let runtime = {};
  try {
    const realStatePath = fs.realpathSync(statePath);
    const realCheckPath = fs.realpathSync(checkPath);
    // Ensure real paths are still inside adapterDir's realpath (no symlink escape)
    const realAdapterDir = fs.realpathSync(adapterDir);
    const relState = path.relative(realAdapterDir, realStatePath);
    const relCheck = path.relative(realAdapterDir, realCheckPath);
    if (relState.startsWith('..') || path.isAbsolute(relState) || relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
      throw new Error('scaffold authority path escapes adapter');
    }
    STATE = require(realStatePath);
    check = require(realCheckPath);
    const runtimePath = path.join(installedRoot, adapterName, 'runtime.json');
    if (fs.existsSync(runtimePath)) runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
  } catch (error) {
    throw new Error(`installed ${adapterName} scaffold authority hooks are unavailable: ${error.message}`);
  }
  if (typeof check.observePolicyBaseline !== 'function') throw new Error(`installed ${adapterName} scaffold authority check does not expose observePolicyBaseline`);
  let result;
  try {
    result = check.observePolicyBaseline({ STATE, policy: POLICY, projectRoot: installedRoot, candidate: { spec, specFile, featureName: args.feature }, runtime });
  } catch (error) {
    throw new Error(`installed ${adapterName} scaffold authority baseline failed: ${error.message}`);
  }
  if (!result || result.ok !== true) throw new Error(`installed ${adapterName} scaffold authority baseline rejected the spec: ${result?.reason || 'unknown reason'}`);
}

function parseArgs(argv) {
  const a = {
    feature: null,
    tasks: null,
    lane: null,
    risks: null,
    lang: 'en',
    title: null,
    specsRoot: 'specs',
    tasksOnly: false,
    artifacts: null,
    dependencies: null,
    planningDepth: null,
    assuranceLevel: null,
    coordination: false,
    taskTriggers: null,
    boundaries: null,
    phases: null,
    research: false,
    uncertainty: null,
    syncSemanticModel: false,
  };
  let dependenciesSeen = false;
  for (let i = 2; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--tasks') a.tasks = argv[++i];
    else if (v === '--lane') a.lane = argv[++i];
    else if (v === '--planning-depth') a.planningDepth = argv[++i];
    else if (v === '--assurance-level') a.assuranceLevel = argv[++i];
    else if (v === '--coordination') a.coordination = true;
    else if (v === '--task-triggers') a.taskTriggers = argv[++i];
    else if (v === '--boundaries') a.boundaries = argv[++i];
    else if (v === '--phases') a.phases = argv[++i];
    else if (v === '--research') a.research = true;
    else if (v === '--uncertainty') a.uncertainty = argv[++i];
    else if (v === '--risks') a.risks = argv[++i];
    else if (v === '--lang') a.lang = argv[++i];
    else if (v === '--title') a.title = argv[++i];
    else if (v === '--specs-root') a.specsRoot = argv[++i];
    else if (v === '--tasks-only') a.tasksOnly = true;
    else if (v === '--sync-semantic-model') a.syncSemanticModel = true;
    else if (v === '--artifacts') a.artifacts = argv[++i];
    else if (v === '--dependencies') {
      if (dependenciesSeen) failPrecondition('--dependencies may be provided only once');
      dependenciesSeen = true;
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
        failPrecondition('--dependencies requires one JSON object value');
      }
      a.dependencies = argv[++i];
    }
    else if (!a.feature) a.feature = v;
  }
  return a;
}

function readTemplate(name) {
  const p = resolveTemplatePath(name);
  if (!fs.existsSync(p)) {
    failPrecondition(`template not found: ${p}`);
  }
  return fs.readFileSync(p, 'utf8');
}

function titleFromSlug(slug) {
  const s = slug.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function concreteUncertainty(value) {
  return typeof value === 'string'
    && value === value.trim()
    && value.length >= 12
    && !/^(?:tbd|todo|unknown|n\/a|none|placeholder)$/i.test(value);
}

function renderResearchTemplate(feature, uncertainty) {
  return readTemplate('research.md')
    .replace(/\{\{FEATURE_NAME\}\}/g, feature)
    .replace(/\{\{UNCERTAINTY\}\}/g, uncertainty);
}

function registryEntry(t, artifactDeclarations, dependencies = []) {
  const entry = {
    id: `R${t.req}-${t.seq}`,
    title: titleFromSlug(t.slug),
    status: 'pending',
    dependencies: [...dependencies],
    blocker: null,
    started_at: null,
    completed_at: null,
    last_updated_at: null,
  };
  const artifacts = artifactDeclarations.get(t.file);
  if (artifacts) entry.artifacts = artifacts;
  return entry;
}

function pendingApproval() {
  return 'draft';
}

// C2 SemanticReviewReceipt (R1-01, frozen): not-run keeps every receipt field
// null/empty, including the separate verdict and lifecycle_disposition and
// the finalizer-derived repair_round attempt index.
function semanticReviewNotRun() {
  return {
    status: 'not-run',
    semantic_digest: null,
    verdict: null,
    lifecycle_disposition: null,
    findings: [],
    unresolved_decisions: [],
    graph_coverage: [],
    repair_round: 0,
    reviewed_criteria: [],
    counterexamples: [],
    reviewer_evidence: null,
  };
}

// C13 SemanticReviewHistory (R1-01, frozen): lineage_id is derived once, from
// the immutable feature_name/created_at pair, and never set by a caller.
function computeLineageId(featureName, createdAt) {
  return `sha256:${crypto.createHash('sha256').update(SEMANTIC.stableJson({ feature_name: featureName, created_at: createdAt })).digest('hex')}`;
}

function semanticReviewHistoryInitial(featureName, createdAt) {
  return { lineage_id: computeLineageId(featureName, createdAt), entries: [] };
}

function parseArtifactDeclarations(raw, parsedTasks) {
  if (raw === null || raw === undefined) return new Map();
  let declarations;
  try {
    declarations = JSON.parse(raw);
  } catch (error) {
    failPrecondition(`--artifacts must be valid JSON (${error.message})`);
  }
  if (!declarations || typeof declarations !== 'object' || Array.isArray(declarations)) {
    failPrecondition('--artifacts must be an object keyed by task id or task path');
  }

  const result = new Map();
  for (const [key, artifacts] of Object.entries(declarations)) {
    const task = parsedTasks.find((candidate) => key === candidate.raw || key === candidate.file);
    if (!task) {
      failPrecondition(`--artifacts references unknown task "${key}"`);
    }
    if (!Array.isArray(artifacts) || artifacts.length === 0 || artifacts.some((artifact) => (
      typeof artifact !== 'string'
      || artifact.trim() === ''
      || artifact !== artifact.trim()
      || /^(?:[A-Za-z]:[\\/]|[\\/]|https?:\/\/)/.test(artifact)
      || artifact.split(/[\\/]+/).includes('..')
    ))) {
      failPrecondition(`--artifacts for "${key}" must be a non-empty array of safe relative paths`);
    }
    if (new Set(artifacts).size !== artifacts.length) {
      failPrecondition(`--artifacts for "${key}" must not contain duplicate paths`);
    }
    result.set(task.file, artifacts);
  }
  return result;
}

function parseDependencyDeclarations(raw, parsedTasks, knownTaskFiles, existingRegistry = {}) {
  if (raw === null || raw === undefined) return new Map();
  let declarations;
  try {
    declarations = JSON.parse(raw);
  } catch (error) {
    failPrecondition(`--dependencies must be valid JSON (${error.message})`);
  }
  if (!isPlainObject(declarations)) {
    failPrecondition('--dependencies must be an object keyed by requested task id or task path');
  }

  const requested = new Map();
  for (const task of parsedTasks) {
    requested.set(task.raw, task);
    requested.set(task.file, task);
  }
  const known = new Map();
  for (const taskPath of knownTaskFiles) {
    const identity = parseTaskPath(taskPath, `known task ${taskPath}`);
    known.set(taskPath, taskPath);
    known.set(identity.rawId, taskPath);
  }

  const result = new Map();
  const declaredTargets = new Map();
  for (const [key, dependencyRefs] of Object.entries(declarations)) {
    const task = requested.get(key);
    if (!task) failPrecondition(`--dependencies references unknown requested task "${key}"`);
    const previousKey = declaredTargets.get(task.file);
    if (previousKey) {
      failPrecondition(
        `--dependencies declares task "${task.file}" more than once after canonical resolution ` +
        `("${previousKey}" and "${key}")`,
      );
    }
    declaredTargets.set(task.file, key);
    if (!Array.isArray(dependencyRefs)) {
      failPrecondition(`--dependencies for "${key}" must be an array`);
    }
    const dependencies = [];
    const seen = new Set();
    for (const dependencyRef of dependencyRefs) {
      if (typeof dependencyRef !== 'string') {
        failPrecondition(`--dependencies for "${key}" must contain only task ids or task paths`);
      }
      const dependency = known.get(dependencyRef);
      if (!dependency) {
        failPrecondition(`--dependencies for "${key}" references unknown task "${dependencyRef}"`);
      }
      if (dependency === task.file) {
        failPrecondition(`--dependencies for "${key}" cannot contain itself`);
      }
      if (seen.has(dependency)) {
        failPrecondition(`--dependencies for "${key}" must not contain duplicate edges`);
      }
      seen.add(dependency);
      dependencies.push(dependency);
    }
    result.set(task.file, dependencies);
  }

  const candidateRegistry = {};
  for (const taskPath of knownTaskFiles) {
    candidateRegistry[taskPath] = {
      dependencies: [...(existingRegistry[taskPath]?.dependencies || [])],
    };
  }
  for (const task of parsedTasks) {
    if (!candidateRegistry[task.file]) candidateRegistry[task.file] = { dependencies: [] };
  }
  for (const [taskPath, dependencies] of result) {
    candidateRegistry[taskPath].dependencies = dependencies;
  }
  validateDependencyCycles(knownTaskFiles, candidateRegistry);
  return result;
}

function parsePhaseDeclarations(raw, knownTaskFiles) {
  if (raw === null) return [];
  let phases;
  try {
    phases = JSON.parse(raw);
  } catch (error) {
    failPrecondition(`--phases must be valid JSON (${error.message})`);
  }
  if (!Array.isArray(phases) || phases.length === 0) {
    failPrecondition('--phases must be a non-empty JSON array');
  }
  const requiredKeys = ['entry_condition', 'exit_condition', 'id', 'owner_boundary', 'task_ids'];
  const knownTaskIds = new Set(knownTaskFiles.map((taskPath) => parseTaskPath(taskPath, `known task ${taskPath}`).id));
  const phaseIds = new Set();
  return phases.map((phase, index) => {
    const label = `--phases[${index}]`;
    if (!isPlainObject(phase) || JSON.stringify(Object.keys(phase).sort()) !== JSON.stringify(requiredKeys)) {
      failPrecondition(`${label} must contain exactly ${requiredKeys.join(', ')}`);
    }
    for (const key of ['id', 'entry_condition', 'exit_condition', 'owner_boundary']) {
      if (typeof phase[key] !== 'string' || phase[key].trim() === '' || phase[key] !== phase[key].trim()) {
        failPrecondition(`${label}.${key} must be a non-empty trimmed string`);
      }
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(phase.id)) {
      failPrecondition(`${label}.id must be one safe identifier`);
    }
    if (phaseIds.has(phase.id)) failPrecondition(`--phases contains duplicate id ${phase.id}`);
    phaseIds.add(phase.id);
    if (!Array.isArray(phase.task_ids) || phase.task_ids.length === 0) {
      failPrecondition(`${label}.task_ids must be a non-empty array`);
    }
    const taskIds = new Set();
    for (const taskId of phase.task_ids) {
      if (typeof taskId !== 'string' || !knownTaskIds.has(taskId)) {
        failPrecondition(`${label}.task_ids references unknown task ${String(taskId)}`);
      }
      if (taskIds.has(taskId)) failPrecondition(`${label}.task_ids must not contain duplicate task ids`);
      taskIds.add(taskId);
    }
    return cloneJson(phase);
  });
}

const BOUNDARY_FIELDS = Object.freeze({
  ownership: ['id', 'type', 'tasks', 'write_sets'],
  dependency: ['id', 'type', 'producer', 'consumer', 'deliverable'],
  transition: ['id', 'type', 'design_ref', 'owner', 'consumers', 'precondition', 'postcondition', 'failure', 'recovery'],
  proof: ['id', 'type', 'subject', 'verifier', 'verification_ref', 'artifact_anchor'],
  parallel: ['id', 'type', 'tasks', 'resources'],
});

function exactTarget(value, label) {
  safeRelativePath(value, label);
  if (/[*?{}[\]]/.test(value) || /[\\/]$/.test(value)) {
    failPrecondition(`${label} must be one exact grounded target, not a glob or parent directory`);
  }
  return value;
}

function targetsContend(left, right) {
  const a = left.replace(/\\/g, '/').replace(/\/+$/, '');
  const b = right.replace(/\\/g, '/').replace(/\/+$/, '');
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function boundaryTaskList(value, label, knownTaskIds, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) {
    failPrecondition(`${label} must contain at least ${minimum} task id(s)`);
  }
  const seen = new Set();
  for (const taskId of value) {
    if (!knownTaskIds.has(taskId)) failPrecondition(`${label} references unknown task ${String(taskId)}`);
    if (seen.has(taskId)) failPrecondition(`${label} must not contain duplicate task ids`);
    seen.add(taskId);
  }
  return [...value];
}

function boundaryTargetMap(value, tasks, label) {
  if (!isPlainObject(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...tasks].sort())) {
    failPrecondition(`${label} must be an object keyed exactly by its task ids`);
  }
  const result = {};
  for (const taskId of tasks) {
    if (!Array.isArray(value[taskId]) || value[taskId].length === 0) {
      failPrecondition(`${label}.${taskId} must be a non-empty exact target array`);
    }
    result[taskId] = value[taskId].map((target, index) => exactTarget(target, `${label}.${taskId}[${index}]`));
    if (new Set(result[taskId]).size !== result[taskId].length) {
      failPrecondition(`${label}.${taskId} must not contain duplicate targets`);
    }
  }
  for (let left = 0; left < tasks.length; left += 1) {
    for (let right = left + 1; right < tasks.length; right += 1) {
      for (const a of result[tasks[left]]) {
        for (const b of result[tasks[right]]) {
          if (targetsContend(a, b)) {
            failPrecondition(`${label} has resource contention between ${tasks[left]}:${a} and ${tasks[right]}:${b}`);
          }
        }
      }
    }
  }
  return result;
}

function parseBoundaryDeclarations(raw, knownTaskFiles) {
  if (raw === null || raw === undefined) return [];
  let boundaries;
  try { boundaries = JSON.parse(raw); } catch (error) {
    failPrecondition(`--boundaries must be valid JSON (${error.message})`);
  }
  if (!Array.isArray(boundaries) || boundaries.length === 0) {
    failPrecondition('--boundaries must be a non-empty JSON array');
  }
  const taskPathById = new Map(knownTaskFiles.map((taskPath) => {
    const identity = parseTaskPath(taskPath, `known task ${taskPath}`);
    return [identity.id, taskPath];
  }));
  const knownTaskIds = new Set(taskPathById.keys());
  const ids = new Set();
  const result = boundaries.map((boundary, index) => {
    const label = `--boundaries[${index}]`;
    if (!isPlainObject(boundary) || !Object.prototype.hasOwnProperty.call(BOUNDARY_FIELDS, boundary.type)) {
      failPrecondition(`${label}.type must be ownership, dependency, transition, proof, or parallel`);
    }
    if (JSON.stringify(Object.keys(boundary).sort()) !== JSON.stringify([...BOUNDARY_FIELDS[boundary.type]].sort())) {
      failPrecondition(`${label} ${boundary.type} fields must be exactly ${BOUNDARY_FIELDS[boundary.type].join(', ')}`);
    }
    if (typeof boundary.id !== 'string' || !/^B-[A-Z0-9][A-Z0-9._-]*$/i.test(boundary.id)) {
      failPrecondition(`${label}.id must be a safe B-* identifier`);
    }
    if (ids.has(boundary.id)) failPrecondition(`--boundaries contains duplicate id ${boundary.id}`);
    ids.add(boundary.id);
    if (boundary.type === 'ownership') {
      const tasks = boundaryTaskList(boundary.tasks, `${label}.tasks`, knownTaskIds, 2);
      boundaryTargetMap(boundary.write_sets, tasks, `${label}.write_sets`);
    } else if (boundary.type === 'dependency') {
      boundaryTaskList([boundary.producer, boundary.consumer], label, knownTaskIds, 2);
      if (boundary.producer === boundary.consumer) failPrecondition(`${label} producer and consumer must differ`);
      exactTarget(boundary.deliverable, `${label}.deliverable`);
    } else if (boundary.type === 'transition') {
      boundaryTaskList([boundary.owner], `${label}.owner`, knownTaskIds);
      boundaryTaskList(boundary.consumers, `${label}.consumers`, knownTaskIds);
      if (boundary.consumers.includes(boundary.owner)) failPrecondition(`${label}.consumers cannot include transition owner`);
      if (!/^T\d+(?:\.\d+)?$/i.test(boundary.design_ref)) failPrecondition(`${label}.design_ref must be a T id`);
      for (const field of ['precondition', 'postcondition', 'failure', 'recovery']) {
        if (typeof boundary[field] !== 'string' || boundary[field].trim().length < 8) {
          failPrecondition(`${label}.${field} must be a concrete definition`);
        }
      }
    } else if (boundary.type === 'proof') {
      boundaryTaskList([boundary.subject, boundary.verifier], label, knownTaskIds, 2);
      if (boundary.subject === boundary.verifier) failPrecondition(`${label} subject and verifier must differ`);
      if (!/^V\d+(?:\.\d+)?$/i.test(boundary.verification_ref)) failPrecondition(`${label}.verification_ref must be a V id`);
      if (!new RegExp(`^A-${boundary.verifier}-\\d{2}$`).test(boundary.artifact_anchor)) {
        failPrecondition(`${label}.artifact_anchor must be owned by verifier ${boundary.verifier}`);
      }
    } else if (boundary.type === 'parallel') {
      const tasks = boundaryTaskList(boundary.tasks, `${label}.tasks`, knownTaskIds, 2);
      boundaryTargetMap(boundary.resources, tasks, `${label}.resources`);
    }
    return cloneJson(boundary);
  });

  const dependencies = result.filter((boundary) => boundary.type === 'dependency');
  const graph = new Map([...knownTaskIds].map((taskId) => [taskId, []]));
  for (const boundary of dependencies) graph.get(boundary.producer).push(boundary.consumer);
  const visiting = new Set();
  const visited = new Set();
  const visit = (taskId, stack = []) => {
    if (visiting.has(taskId)) {
      const start = stack.indexOf(taskId);
      failPrecondition(`coordination.boundaries dependency cycle: ${stack.slice(start).concat(taskId).join(' -> ')}`);
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    for (const consumer of graph.get(taskId)) visit(consumer, [...stack, taskId]);
    visiting.delete(taskId);
    visited.add(taskId);
  };
  for (const taskId of knownTaskIds) visit(taskId);
  const pathExists = (from, to, seen = new Set()) => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return graph.get(from).some((next) => pathExists(next, to, seen));
  };
  for (const boundary of result.filter((candidate) => candidate.type === 'parallel')) {
    for (let left = 0; left < boundary.tasks.length; left += 1) {
      for (let right = left + 1; right < boundary.tasks.length; right += 1) {
        if (pathExists(boundary.tasks[left], boundary.tasks[right])
          || pathExists(boundary.tasks[right], boundary.tasks[left])) {
          failPrecondition(`${boundary.id}: parallel tasks must have no dependency path`);
        }
      }
    }
    const authorities = result.filter((candidate) => ['transition', 'proof'].includes(candidate.type));
    for (const authority of authorities) {
      const owners = authority.type === 'transition'
        ? [authority.owner, ...authority.consumers]
        : [authority.subject, authority.verifier];
      if (boundary.tasks.filter((taskId) => owners.includes(taskId)).length > 1) {
        failPrecondition(`${boundary.id}: parallel tasks cannot share ${authority.type} authority ${authority.id}`);
      }
    }
  }
  return result;
}

function dependenciesFromBoundaries(boundaries, knownTaskFiles) {
  const pathById = new Map(knownTaskFiles.map((taskPath) => [parseTaskPath(taskPath, taskPath).id, taskPath]));
  const result = new Map(knownTaskFiles.map((taskPath) => [taskPath, []]));
  for (const boundary of boundaries) {
    if (boundary.type !== 'dependency') continue;
    result.get(pathById.get(boundary.consumer)).push(pathById.get(boundary.producer));
  }
  for (const [taskPath, dependencies] of result) result.set(taskPath, [...new Set(dependencies)].sort());
  return result;
}

function validatePhaseBoundaryRefs(phases, boundaries) {
  const boundaryIds = new Set(boundaries.map((boundary) => boundary.id));
  for (const phase of phases) {
    if (!boundaryIds.has(phase.owner_boundary)) {
      failPrecondition(`phase ${phase.id}.owner_boundary references unknown boundary ${phase.owner_boundary}`);
    }
  }
}

function applyExecutionClosureProfile(content, includeExecutionClosure) {
  if (!includeExecutionClosure) return content.replace(EXECUTION_CLOSURE_BLOCK_RE, '');
  return content
    .replace('<!-- EXECUTION_CLOSURE_START -->\n', '')
    .replace('<!-- EXECUTION_CLOSURE_END -->\n', '');
}

function declaredImplementationObligations(spec) {
  return Array.isArray(spec?.implementation_obligations)
    ? spec.implementation_obligations.filter(isPlainObject)
    : [];
}

function taskHasDeclaredImplementationObligation(spec, taskPath) {
  return declaredImplementationObligations(spec).some((obligation) => (
    obligation.owner_task === taskPath
    || (Array.isArray(obligation.consumer_tasks) && obligation.consumer_tasks.includes(taskPath))
  ));
}

function fillTask(taskTpl, t, feature, dependencies = [], includeExecutionClosure = false) {
  return applyExecutionClosureProfile(taskTpl, includeExecutionClosure)
    .replace(/\{\{REQ_NUMBER\}\}/g, t.req)
    .replace(/\{\{SEQ\}\}/g, t.seq)
    .replace(/\{\{TITLE\}\}/g, titleFromSlug(t.slug))
    .replace(/\{\{FEATURE_NAME\}\}/g, feature)
    .replace(/\{\{PRIORITY\}\}/g, 'P2')
    .replace(/\{\{EFFORT\}\}/g, 'TBD')
    .replace(/\{\{DEPENDENCIES\}\}/g, dependencies.length > 0 ? dependencies.join(', ') : 'none');
}

function parseRiskNames(raw) {
  if (!raw) return [];
  const aliases = new Map([
    ['auth', 'auth'],
    ['authentication', 'auth'],
    ['authorization', 'auth'],
  ]);
  return [...new Set(raw
    .split(',')
    .map((risk) => risk.trim().toLowerCase())
    .filter(Boolean)
    .map((risk) => aliases.get(risk) || risk))];
}

function nowIso() {
  // Local ISO with offset, e.g. 2026-06-21T12:30:00+07:00
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`;
}

function hasOwn(value, key) {
  return value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertExactKeys(value, expected, label) {
  if (!isPlainObject(value)) failPrecondition(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    const unknown = actual.filter((key) => !wanted.includes(key));
    const missing = wanted.filter((key) => !actual.includes(key));
    failPrecondition(
      `${label} must be closed-world; unknown=[${unknown.join(', ')}], missing=[${missing.join(', ')}]`,
    );
  }
}

function canonicalRegistryFields(entry) {
  return hasOwn(entry, 'artifacts') ? [...REGISTRY_KEYS, 'artifacts'] : REGISTRY_KEYS;
}

function assertCanonicalSpecInputClosedWorld(spec, { allowLegacyReview = false } = {}) {
  if (!isPlainObject(spec) || spec.schema_version !== '2.1') return;
  const topLevel = [...CANONICAL_SPEC_FIELDS].filter((field) => {
    if (field === 'research') return hasOwn(spec, 'research');
    if (field === 'task_files' || field === 'task_registry') return hasOwn(spec, field);
    if (field === 'decisions') return hasOwn(spec, 'decisions');
    return true;
  });
  assertExactKeys(spec, topLevel, 'canonical schema 2.1 spec.json');
  assertExactKeys(spec.scope_lock, SCOPE_LOCK_FIELDS, 'canonical schema 2.1 scope_lock');
  assertExactKeys(spec.authoring, AUTHORING_FIELDS, 'canonical schema 2.1 authoring');
  const coordinationFields = hasOwn(spec.coordination, 'phases')
    ? [...COORDINATION_FIELDS] : ['boundaries'];
  assertExactKeys(spec.coordination, coordinationFields, 'canonical schema 2.1 coordination');
  const reviewKeys = isPlainObject(spec.validation?.semantic_review)
    ? Object.keys(spec.validation.semantic_review).sort().join(',') : '';
  const legacyReviewFields = reviewKeys === [...LEGACY_SEMANTIC_REVIEW_FIELDS].sort().join(',')
    ? LEGACY_SEMANTIC_REVIEW_FIELDS
    : reviewKeys === [...PRE_C2_SEMANTIC_REVIEW_FIELDS].sort().join(',')
      ? PRE_C2_SEMANTIC_REVIEW_FIELDS : null;
  const legacyReview = allowLegacyReview
    && isPlainObject(spec.validation)
    && Object.keys(spec.validation).sort().join(',') === ['semantic_review', 'status'].sort().join(',')
    && legacyReviewFields !== null;
  // semantic_review_history and authoring_validation (C13/C16) are required
  // going forward, but a pre-existing 2.1 spec authored before this feature's
  // cutover may not carry them yet; accept their absence here so scaffold can
  // migrate such a spec forward (normalizeSpec21Candidate forces a fresh reset
  // whenever either is missing) instead of hard-failing on an old file.
  const validationFields = legacyReview ? ['status', 'semantic_review'] : [...VALIDATION_FIELDS].filter((field) => {
    if (field === 'semantic_review_history' || field === 'authoring_validation') return hasOwn(spec.validation, field);
    return true;
  });
  assertExactKeys(spec.validation, validationFields, 'canonical schema 2.1 validation');
  assertExactKeys(
    spec.validation.semantic_review,
    legacyReview ? legacyReviewFields : SEMANTIC_REVIEW_FIELDS,
    'canonical schema 2.1 validation.semantic_review',
  );
  if (Array.isArray(spec.validation.semantic_review?.counterexamples)) {
    const fields = ['criterion', 'case_kind', 'scenario', 'expected', 'decision_refs', 'verification_ref'];
    for (const [index, counterexample] of spec.validation.semantic_review.counterexamples.entries()) {
      assertExactKeys(
        counterexample,
        fields,
        `canonical schema 2.1 validation.semantic_review.counterexamples[${index}]`,
      );
    }
  }
  for (const [index, finding] of (spec.validation.semantic_review?.findings || []).entries()) {
    assertExactKeys(finding, SEMANTIC_REVIEW_FINDING_FIELDS, `canonical schema 2.1 validation.semantic_review.findings[${index}]`);
  }
  for (const [index, decision] of (spec.validation.semantic_review?.unresolved_decisions || []).entries()) {
    assertExactKeys(decision, SEMANTIC_REVIEW_DECISION_FIELDS, `canonical schema 2.1 validation.semantic_review.unresolved_decisions[${index}]`);
  }
  for (const [index, coverage] of (spec.validation.semantic_review?.graph_coverage || []).entries()) {
    assertExactKeys(coverage, SEMANTIC_REVIEW_COVERAGE_FIELDS, `canonical schema 2.1 validation.semantic_review.graph_coverage[${index}]`);
  }
  if (!legacyReview && spec.validation.semantic_review?.reviewer_evidence !== null) {
    assertExactKeys(
      spec.validation.semantic_review?.reviewer_evidence,
      SEMANTIC_REVIEW_EVIDENCE_FIELDS,
      'canonical schema 2.1 validation.semantic_review.reviewer_evidence',
    );
  }
  if (hasOwn(spec.validation, 'semantic_review_history')) {
    assertExactKeys(spec.validation.semantic_review_history, SEMANTIC_REVIEW_HISTORY_FIELDS, 'canonical schema 2.1 validation.semantic_review_history');
    for (const [index, entry] of (spec.validation.semantic_review_history?.entries || []).entries()) {
      assertExactKeys(entry, SEMANTIC_REVIEW_HISTORY_ENTRY_FIELDS, `canonical schema 2.1 validation.semantic_review_history.entries[${index}]`);
    }
  }
  if (hasOwn(spec.validation, 'authoring_validation') && spec.validation.authoring_validation !== null) {
    assertExactKeys(spec.validation.authoring_validation, AUTHORING_VALIDATION_FIELDS, 'canonical schema 2.1 validation.authoring_validation');
    for (const stage of ['requirements', 'design', 'research', 'tasks']) {
      assertExactKeys(
        spec.validation.authoring_validation?.[stage],
        AUTHORING_VALIDATION_STAGE_FIELDS,
        `canonical schema 2.1 validation.authoring_validation.${stage}`,
      );
    }
  }
  if (hasOwn(spec, 'decisions')) {
    if (!Array.isArray(spec.decisions) || spec.decisions.length === 0) failPrecondition('canonical schema 2.1 decisions must be omitted or a non-empty array');
    for (const [index, decision] of spec.decisions.entries()) {
      assertExactKeys(decision, ['id', 'classification', 'statement', 'status', 'evidence'], `canonical schema 2.1 decisions[${index}]`);
    }
  }
  if (Array.isArray(spec.coordination?.boundaries)) {
    for (const [index, boundary] of spec.coordination.boundaries.entries()) {
      if (!isPlainObject(boundary) || !Object.prototype.hasOwnProperty.call(BOUNDARY_FIELDS, boundary.type)) {
        failPrecondition(`canonical schema 2.1 coordination.boundaries[${index}] has an unknown type`);
      }
      assertExactKeys(
        boundary,
        BOUNDARY_FIELDS[boundary.type],
        `canonical schema 2.1 coordination.boundaries[${index}]`,
      );
    }
  }
  if (Array.isArray(spec.coordination?.phases)) {
    const fields = ['entry_condition', 'exit_condition', 'id', 'owner_boundary', 'task_ids'];
    for (const [index, phase] of spec.coordination.phases.entries()) {
      assertExactKeys(phase, fields, `canonical schema 2.1 coordination.phases[${index}]`);
    }
  }
  if (hasOwn(spec, 'task_registry') && isPlainObject(spec.task_registry)) {
    for (const [taskPath, entry] of Object.entries(spec.task_registry)) {
      assertExactKeys(entry, canonicalRegistryFields(entry), `canonical schema 2.1 task_registry.${taskPath}`);
    }
  }
}

function rejectUnknownKeys(value, allowed, label) {
  if (!isPlainObject(value)) return;
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    failPrecondition(`${label} contains unsupported legacy authority field(s): ${unknown.join(', ')}; remove or explicitly migrate them before schema 2.1 promotion`);
  }
}

function assertLegacyMigrationClosedWorld(spec) {
  rejectUnknownKeys(spec, LEGACY_SPEC_FIELDS, 'schema 2.0 spec.json');
  rejectUnknownKeys(spec.scope_lock, SCOPE_LOCK_FIELDS, 'schema 2.0 scope_lock');
  rejectUnknownKeys(spec.authoring, AUTHORING_FIELDS, 'schema 2.0 authoring');
  rejectUnknownKeys(spec.coordination, LEGACY_COORDINATION_FIELDS, 'schema 2.0 coordination');
  rejectUnknownKeys(spec.validation, LEGACY_VALIDATION_FIELDS, 'schema 2.0 validation');
  rejectUnknownKeys(spec.validation?.semantic_review, LEGACY_SEMANTIC_REVIEW_FIELDS, 'schema 2.0 validation.semantic_review');
  for (const [index, counterexample] of (spec.validation?.semantic_review?.counterexamples || []).entries()) {
    rejectUnknownKeys(counterexample, ['criterion', 'case_kind', 'scenario', 'expected', 'decision_refs', 'verification_ref'], `schema 2.0 semantic_review.counterexamples[${index}]`);
  }
  for (const [index, boundary] of (spec.coordination?.boundaries || []).entries()) {
    if (!isPlainObject(boundary) || !hasOwn(BOUNDARY_FIELDS, boundary.type)) {
      failPrecondition(`schema 2.0 coordination.boundaries[${index}] has an unknown authority type`);
    }
    rejectUnknownKeys(boundary, BOUNDARY_FIELDS[boundary.type], `schema 2.0 coordination.boundaries[${index}]`);
  }
  if (isPlainObject(spec.workflow_policy)) {
    rejectUnknownKeys(spec.workflow_policy, LEGACY_POLICY_FIELDS, 'schema 2.0 workflow_policy');
  }
  if (hasOwn(spec, 'current_phase')
    && (typeof spec.current_phase !== 'string' || spec.current_phase.trim() === '')) {
    failPrecondition('schema 2.0 current_phase must be a non-empty string when present');
  }
  if (hasOwn(spec, 'timestamps')) {
    if (!isPlainObject(spec.timestamps)) failPrecondition('schema 2.0 timestamps must be an object');
    rejectUnknownKeys(spec.timestamps, LEGACY_TIMESTAMP_FIELDS, 'schema 2.0 timestamps');
    for (const [field, value] of Object.entries(spec.timestamps)) {
      if (value !== null && !isIsoTimestamp(value)) {
        failPrecondition(`schema 2.0 timestamps.${field} must be null or a valid ISO 8601 timestamp`);
      }
    }
  }
  if (hasOwn(spec, 'approvals')) {
    if (!isPlainObject(spec.approvals)) failPrecondition('schema 2.0 approvals must be an object');
    rejectUnknownKeys(spec.approvals, LEGACY_APPROVAL_FIELDS, 'schema 2.0 approvals');
    for (const [section, state] of Object.entries(spec.approvals)) {
      if (!isPlainObject(state)) failPrecondition(`schema 2.0 approvals.${section} must be an object`);
      rejectUnknownKeys(state, LEGACY_APPROVAL_STATE_FIELDS, `schema 2.0 approvals.${section}`);
      for (const [field, value] of Object.entries(state)) {
        if (typeof value !== 'boolean') {
          failPrecondition(`schema 2.0 approvals.${section}.${field} must be boolean`);
        }
      }
    }
  }
  if (isPlainObject(spec.task_registry)) for (const [taskPath, entry] of Object.entries(spec.task_registry)) {
    rejectUnknownKeys(entry, canonicalRegistryFields(entry), `schema 2.0 task_registry.${taskPath}`);
  }
}

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function isWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function assertNoSymlinkPath(root, target, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (!isWithin(resolvedRoot, resolvedTarget)) {
    failPrecondition(`${label} escapes the work root: ${target}`);
  }

  const relative = path.relative(resolvedRoot, resolvedTarget);
  let current = resolvedRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      failPrecondition(`${label} cannot be inspected (${error.message})`);
    }
    if (stat.isSymbolicLink()) failPrecondition(`${label} cannot traverse a symlink: ${current}`);
  }
}

function assertExistingDirectory(root, directory, label) {
  assertNoSymlinkPath(root, directory, label);
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch (error) {
    failPrecondition(`${label} is missing (${error.message})`);
  }
  if (!stat.isDirectory()) failPrecondition(`${label} must be a directory`);
}

function assertRegularFileOrMissing(root, filePath, label) {
  assertNoSymlinkPath(root, filePath, label);
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile()) failPrecondition(`${label} must be a regular file`);
  } catch (error) {
    if (error instanceof ScaffoldPreconditionError) throw error;
    if (error.code !== 'ENOENT') failPrecondition(`${label} cannot be inspected (${error.message})`);
  }
}

function safeRelativePath(value, label) {
  if (
    typeof value !== 'string'
    || value.trim() === ''
    || value !== value.trim()
    || path.isAbsolute(value)
    || /^[A-Za-z]:[\\/]/.test(value)
    || value.split(/[\\/]+/).includes('..')
  ) {
    failPrecondition(`${label} must be a safe relative path`);
  }
  return value;
}

function validateArtifactList(artifacts, label) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    failPrecondition(`${label} must be a non-empty array of safe relative paths`);
  }
  const seen = new Set();
  for (const artifact of artifacts) {
    safeRelativePath(artifact, `${label} entry`);
    if (seen.has(artifact)) failPrecondition(`${label} must not contain duplicate paths`);
    seen.add(artifact);
  }
}

function parseTaskPath(taskPath, label) {
  const match = typeof taskPath === 'string' && taskPath.match(TASK_PATH_RE);
  if (!match) failPrecondition(`${label} must match tasks/task-R{N}-{SEQ}-<slug>.md`);
  const rawId = match[1];
  const idParts = rawId.match(TASK_ID_RE);
  if (!idParts) failPrecondition(`${label} contains an invalid task id`);
  return { id: `R${idParts[1]}-${idParts[2]}`, rawId, req: idParts[1], seq: idParts[2], slug: idParts[3] };
}

function validateTaskPathList(taskFiles, label) {
  if (!Array.isArray(taskFiles)) failPrecondition(`${label} must be an array`);
  const seen = new Set();
  for (const taskPath of taskFiles) {
    parseTaskPath(taskPath, `${label} entry`);
    if (seen.has(taskPath)) failPrecondition(`${label} contains duplicate path ${taskPath}`);
    seen.add(taskPath);
  }
  return [...taskFiles].sort();
}

function validateRegistryEntry(taskPath, entry, declaredSet) {
  if (!isPlainObject(entry)) failPrecondition(`task_registry.${taskPath} must be an object`);
  for (const key of REGISTRY_KEYS) {
    if (!hasOwn(entry, key)) failPrecondition(`task_registry.${taskPath} is missing ${key}`);
  }
  const identity = parseTaskPath(taskPath, `task_registry.${taskPath}`);
  if (entry.id !== identity.id) failPrecondition(`task_registry.${taskPath}.id conflicts with its task path`);
  if (typeof entry.title !== 'string' || entry.title.trim() === '') failPrecondition(`task_registry.${taskPath}.title must be a non-empty string`);
  if (!TASK_STATUS_VALUES.has(entry.status)) {
    failPrecondition(`task_registry.${taskPath}.status must be one of ${[...TASK_STATUS_VALUES].join(', ')}`);
  }
  if (!Array.isArray(entry.dependencies)) failPrecondition(`task_registry.${taskPath}.dependencies must be an array`);
  const dependencies = new Set();
  for (const dependency of entry.dependencies) {
    parseTaskPath(dependency, `task_registry.${taskPath}.dependencies entry`);
    if (dependencies.has(dependency)) failPrecondition(`task_registry.${taskPath}.dependencies contains a duplicate`);
    if (dependency === taskPath) failPrecondition(`task_registry.${taskPath}.dependencies cannot contain itself`);
    if (!declaredSet.has(dependency)) failPrecondition(`task_registry.${taskPath}.dependencies references unknown task ${dependency}`);
    dependencies.add(dependency);
  }
  if (hasOwn(entry, 'artifacts')) validateArtifactList(entry.artifacts, `task_registry.${taskPath}.artifacts`);
  const label = `task_registry.${taskPath}`;
  if (entry.blocker !== null && (typeof entry.blocker !== 'string' || entry.blocker.trim() === '')) {
    failPrecondition(`${label}.blocker must be null or a non-empty string`);
  }
  for (const field of ['started_at', 'completed_at', 'last_updated_at']) {
    if (entry[field] !== null && !isIsoTimestamp(entry[field])) {
      failPrecondition(`${label}.${field} must be null or an ISO 8601 timestamp`);
    }
  }
  if (entry.status === 'pending') {
    if (entry.blocker !== null || entry.started_at !== null || entry.completed_at !== null) {
      failPrecondition(`${label} pending lifecycle is inconsistent`);
    }
  } else if (entry.status === 'in_progress') {
    if (entry.blocker !== null || !isIsoTimestamp(entry.started_at)
      || entry.completed_at !== null || !isIsoTimestamp(entry.last_updated_at)
      || Date.parse(entry.last_updated_at) < Date.parse(entry.started_at)) {
      failPrecondition(`${label} in_progress lifecycle is inconsistent`);
    }
  } else if (entry.status === 'blocked') {
    if (typeof entry.blocker !== 'string' || entry.blocker.trim() === ''
      || entry.completed_at !== null || !isIsoTimestamp(entry.last_updated_at)
      || (isIsoTimestamp(entry.started_at) && Date.parse(entry.last_updated_at) < Date.parse(entry.started_at))) {
      failPrecondition(`${label} blocked lifecycle is inconsistent`);
    }
  } else if (entry.status === 'done') {
    if (entry.blocker !== null
      || ![entry.started_at, entry.completed_at, entry.last_updated_at].every(isIsoTimestamp)
      || Date.parse(entry.completed_at) < Date.parse(entry.started_at)
      || Date.parse(entry.last_updated_at) < Date.parse(entry.completed_at)) {
      failPrecondition(`${label} done lifecycle is inconsistent`);
    }
  }
}

function semanticReviewShapeValid(review) {
  if (!isPlainObject(review) || Object.keys(review).sort().join(',') !== [...SEMANTIC_REVIEW_FIELDS].sort().join(',')) return false;
  if (!['not-run', 'completed'].includes(review.status)) return false;
  if (review.semantic_digest !== null && typeof review.semantic_digest !== 'string') return false;
  if (review.verdict !== null && !['PASS', 'FAIL'].includes(review.verdict)) return false;
  if (review.lifecycle_disposition !== null && !['CONTINUE', 'BLOCKED'].includes(review.lifecycle_disposition)) return false;
  if (!Array.isArray(review.findings) || !review.findings.every((finding) => isPlainObject(finding)
    && Object.keys(finding).sort().join(',') === [...SEMANTIC_REVIEW_FINDING_FIELDS].sort().join(','))) return false;
  if (!Array.isArray(review.unresolved_decisions) || !review.unresolved_decisions.every((decision) => isPlainObject(decision)
    && Object.keys(decision).sort().join(',') === [...SEMANTIC_REVIEW_DECISION_FIELDS].sort().join(','))) return false;
  if (!Array.isArray(review.graph_coverage) || !review.graph_coverage.every((coverage) => isPlainObject(coverage)
    && Object.keys(coverage).sort().join(',') === [...SEMANTIC_REVIEW_COVERAGE_FIELDS].sort().join(','))) return false;
  if (!Number.isInteger(review.repair_round) || review.repair_round < 0 || review.repair_round > 2) return false;
  if (!Array.isArray(review.reviewed_criteria) || !Array.isArray(review.counterexamples)) return false;
  if (review.reviewer_evidence !== null && (!isPlainObject(review.reviewer_evidence)
    || Object.keys(review.reviewer_evidence).sort().join(',') !== [...SEMANTIC_REVIEW_EVIDENCE_FIELDS].sort().join(','))) return false;
  return true;
}

function semanticReviewHistoryShapeValid(history) {
  if (!isPlainObject(history) || Object.keys(history).sort().join(',') !== [...SEMANTIC_REVIEW_HISTORY_FIELDS].sort().join(',')) return false;
  if (typeof history.lineage_id !== 'string') return false;
  return Array.isArray(history.entries) && history.entries.every((entry) => isPlainObject(entry)
    && Object.keys(entry).sort().join(',') === [...SEMANTIC_REVIEW_HISTORY_ENTRY_FIELDS].sort().join(','));
}

function authoringValidationShapeValid(receipt) {
  if (receipt === null) return true;
  if (!isPlainObject(receipt) || Object.keys(receipt).sort().join(',') !== [...AUTHORING_VALIDATION_FIELDS].sort().join(',')) return false;
  return ['requirements', 'design', 'research', 'tasks'].every((stage) => isPlainObject(receipt[stage])
    && Object.keys(receipt[stage]).sort().join(',') === [...AUTHORING_VALIDATION_STAGE_FIELDS].sort().join(','));
}

function preflightSpec21Candidate(spec, evidence) {
  if (!isPlainObject(spec)) failPrecondition('schema 2.1 candidate must be an object');
  assertCanonicalSpecInputClosedWorld(spec);
  if (hasOwn(spec, 'override_receipt')) {
    failPrecondition('schema 2.1 candidate override_receipt is unsupported; omit the field');
  }
  const required = [
    'schema_version', 'feature_name', 'created_at', 'updated_at', 'language', 'status',
    'scope_lock', 'authoring', 'coordination', 'validation', 'semantic_model', 'ready_for_implementation',
    'workflow_policy',
  ];
  for (const field of required) if (!hasOwn(spec, field)) {
    failPrecondition(`schema 2.1 candidate is missing required machine field ${field}`);
  }
  if (spec.schema_version !== '2.1') failPrecondition('schema 2.1 candidate has an unsupported schema_version');
  if (spec.feature_name !== evidence.featureName) failPrecondition('feature_name conflicts with the scaffold feature identity');
  if (!isIsoTimestamp(spec.created_at) || !isIsoTimestamp(spec.updated_at)
    || Date.parse(spec.updated_at) < Date.parse(spec.created_at)) {
    failPrecondition('schema 2.1 candidate lifecycle timestamps are invalid');
  }
  if (typeof spec.language !== 'string' || spec.language.trim() === '') failPrecondition('schema 2.1 candidate language must be non-empty');
  if (!SPEC_STATUS_VALUES.has(spec.status)) failPrecondition('schema 2.1 candidate status is invalid');
  if (!isPlainObject(spec.scope_lock)) failPrecondition('schema 2.1 candidate scope_lock must be an object');
  if (!isPlainObject(spec.authoring)
    || Object.keys(spec.authoring).sort().join(',') !== [...AUTHORING_FIELDS].sort().join(',')) {
    failPrecondition('schema 2.1 candidate authoring must contain exactly requirements, design, research, and tasks');
  }
  for (const field of AUTHORING_FIELDS) if (!AUTHORING_STATES.has(spec.authoring[field])) {
    failPrecondition(`schema 2.1 candidate authoring.${field} is invalid`);
  }
  if (!evidence.requirementsExists || !evidence.designExists) {
    failPrecondition('schema 2.1 migration requires physical requirements.md and design.md files');
  }
  if (spec.authoring.requirements === 'absent' || spec.authoring.design === 'absent') {
    failPrecondition('physical requirements.md and design.md cannot be marked absent');
  }
  if (evidence.researchExists) {
    if (spec.research !== 'research.md' || spec.authoring.research === 'absent') {
      failPrecondition('research pointer, authoring state, and physical research.md must agree');
    }
  } else if (hasOwn(spec, 'research') || spec.authoring.research !== 'absent') {
    failPrecondition('absent physical research.md requires no pointer and authoring.research absent');
  }
  if (!isPlainObject(spec.coordination) || !Array.isArray(spec.coordination.boundaries)) {
    failPrecondition('schema 2.1 candidate coordination.boundaries must be an array');
  }
  if (!isPlainObject(spec.validation) || !VALIDATION_STATUS_VALUES.has(spec.validation.status)
    || !semanticReviewShapeValid(spec.validation.semantic_review)
    || !semanticReviewHistoryShapeValid(spec.validation.semantic_review_history)
    || !authoringValidationShapeValid(spec.validation.authoring_validation)) {
    failPrecondition('schema 2.1 candidate validation state is invalid');
  }
  if (typeof spec.ready_for_implementation !== 'boolean') failPrecondition('schema 2.1 candidate readiness must be boolean');
  if (spec.semantic_model !== null) {
    const semanticErrors = SEMANTIC.validateSemanticModel(spec.semantic_model, spec);
    if (semanticErrors.length) failPrecondition(`schema 2.1 candidate semantic_model is invalid (${semanticErrors.join('; ')})`);
  } else if (spec.ready_for_implementation === true) {
    failPrecondition('schema 2.1 readiness requires a promoted semantic_model');
  }
  if (isPlainObject(spec.workflow_policy) && hasOwn(spec.workflow_policy, 'override_receipt')) {
    failPrecondition('schema 2.1 candidate workflow_policy.override_receipt is unsupported; omit the field');
  }
  const policyValidation = POLICY.validateWorkflowPolicySnapshot(spec.workflow_policy);
  if (!policyValidation.valid || spec.workflow_policy.version !== '2.1') {
    failPrecondition(`schema 2.1 candidate workflow_policy is invalid (${policyValidation.errors.join('; ')})`);
  }
  const taskFiles = validateTaskPathList(spec.task_files || [], 'task_files');
  if (JSON.stringify(taskFiles) !== JSON.stringify([...evidence.taskFiles].sort())) {
    failPrecondition('schema 2.1 candidate task_files do not match the resulting physical topology');
  }
  if (taskFiles.length === 0) {
    if (hasOwn(spec, 'task_files') || hasOwn(spec, 'task_registry') || spec.authoring.tasks !== 'absent') {
      failPrecondition('taskless schema 2.1 candidate must omit task topology and mark tasks absent');
    }
  } else {
    if (!isPlainObject(spec.task_registry)
      || Object.keys(spec.task_registry).sort().join(',') !== taskFiles.join(',')) {
      failPrecondition('schema 2.1 candidate task_registry must exactly match task_files');
    }
    if (!['draft', 'validated'].includes(spec.authoring.tasks)) {
      failPrecondition('physical tasks require draft or validated authoring state');
    }
    const declared = new Set(taskFiles);
    for (const taskPath of taskFiles) validateRegistryEntry(taskPath, spec.task_registry[taskPath], declared);
    validateDependencyCycles(taskFiles, spec.task_registry);
  }
}

function normalizeSpec21Candidate(candidate, evidence) {
  try {
    if (!isPlainObject(candidate)) failPrecondition('migration candidate must be an object');
    if (!['2.0', '2.1'].includes(candidate.schema_version)) {
      failPrecondition('migration candidate schema_version must be exactly 2.0 or 2.1');
    }
    const isLegacy = candidate.schema_version === '2.0';
    if (isLegacy) assertLegacyMigrationClosedWorld(candidate);
    if (!isLegacy) assertCanonicalSpecInputClosedWorld(candidate);
    const featureName = !hasOwn(candidate, 'feature_name') && isLegacy
      ? evidence.featureName : candidate.feature_name;
    if (typeof featureName !== 'string' || featureName.trim() === ''
      || featureName !== evidence.featureName) {
      failPrecondition('existing feature_name conflicts with the scaffold feature identity');
    }
    if (!isIsoTimestamp(candidate.created_at) || !isIsoTimestamp(candidate.updated_at)) {
      failPrecondition('existing created_at and updated_at must be valid ISO 8601 timestamps');
    }
    if (typeof candidate.language !== 'string' || candidate.language.trim() === '') {
      failPrecondition('existing language must be a non-empty string');
    }
    const status = isLegacy && candidate.status === 'in-progress' ? 'in_progress' : candidate.status;
    if (!SPEC_STATUS_VALUES.has(status)) failPrecondition('existing spec status is invalid');
    if (!isPlainObject(candidate.scope_lock)) failPrecondition('existing scope_lock must be an object');
    const scopeLock = {
      source: candidate.scope_lock.source,
      in_scope: candidate.scope_lock.in_scope,
      out_of_scope: candidate.scope_lock.out_of_scope,
      expansion_policy: candidate.scope_lock.expansion_policy,
    };
    if (typeof scopeLock.source !== 'string' || scopeLock.source.trim() === ''
      || !Array.isArray(scopeLock.in_scope) || !Array.isArray(scopeLock.out_of_scope)
      || typeof scopeLock.expansion_policy !== 'string' || scopeLock.expansion_policy.trim() === '') {
      failPrecondition('existing scope_lock canonical fields are invalid');
    }

    // D13/I21/R3.9: spec-scaffold.cjs never *writes* `validated` for any
    // authoring field — only spec-authoring-validation.cjs's atomic coordinator
    // may flip a stage to validated, after its own clean validator+grounder
    // pass. It does, however, carry an existing `validated` reading forward
    // untouched while that stage's C16 receipt still matches the stage's
    // current bytes, exactly as it already preserves the C13 history and the
    // receipt itself below: a still-fresh durable record is not scaffold's to
    // destroy, and drafting it would force a pointless re-validation. Any
    // stage whose bytes actually changed no longer matches its receipt and
    // therefore lands on draft here (and reads as draft everywhere via I20).
    const receiptForFreshness = authoringValidationShapeValid(candidate.validation?.authoring_validation)
      ? candidate.validation.authoring_validation
      : null;
    // One pass over the current bytes for all four stages; assertAuthoringFresh
    // already treats a non-`validated` enum as not fresh. Any unreadable
    // artifact fails closed to draft here, and the per-stage preconditions
    // below still report the missing file as the real error.
    let authoringFreshness = null;
    if (receiptForFreshness !== null && typeof evidence.specDir === 'string') {
      try {
        authoringFreshness = AUTHORING_DIGEST.assertAuthoringFresh({
          specDir: evidence.specDir,
          authoring: candidate.authoring,
          receipt: receiptForFreshness,
          fields: ['requirements', 'design', 'research', 'tasks'],
        });
      } catch {
        authoringFreshness = null;
      }
    }
    const carryForward = (field) => (authoringFreshness?.[field]?.fresh ? 'validated' : 'draft');
    const authoring = {};
    for (const field of ['requirements', 'design']) {
      if (!evidence[`${field}Exists`]) failPrecondition(`physical ${field}.md is required for schema 2.1 migration`);
      authoring[field] = carryForward(field);
    }
    if (evidence.researchExists) {
      const pointer = isPlainObject(candidate.research) ? candidate.research.path : candidate.research;
      if (pointer !== undefined && pointer !== null && pointer !== 'research.md') {
        failPrecondition('legacy research pointer is ambiguous; expected canonical research.md');
      }
      authoring.research = carryForward('research');
    } else {
      if (hasOwn(candidate, 'research') && candidate.research !== null) {
        failPrecondition('research pointer exists without a physical research.md artifact');
      }
      authoring.research = 'absent';
    }
    if (evidence.taskFiles.length > 0) {
      authoring.tasks = carryForward('tasks');
    } else {
      authoring.tasks = 'absent';
    }
    const projectedRegistry = {};
    for (const taskPath of evidence.taskFiles) {
      const entry = candidate.task_registry?.[taskPath];
      if (!isPlainObject(entry)) failPrecondition(`task_registry.${taskPath} must be an object`);
      projectedRegistry[taskPath] = {};
      for (const key of canonicalRegistryFields(entry)) {
        if (hasOwn(entry, key)) projectedRegistry[taskPath][key] = cloneJson(entry[key]);
      }
    }
    // semantic_review_history (C13) and authoring_validation (C16) are durable
    // records this migration step never wipes on its own: history is
    // append-only for the life of the spec record (I6 — lineage_id never
    // resets on an ordinary content edit) and the C16 receipt may only ever be
    // written by spec-authoring-validation.cjs (I21) — scaffold is not a
    // writer of either and only seeds a fresh skeleton when a pre-cutover
    // legacy spec never carried them at all.
    const historyValid = hasOwn(candidate.validation || {}, 'semantic_review_history')
      && semanticReviewHistoryShapeValid(candidate.validation.semantic_review_history);
    const authoringValidationValid = hasOwn(candidate.validation || {}, 'authoring_validation')
      && authoringValidationShapeValid(candidate.validation.authoring_validation);
    const validationValid = isPlainObject(candidate.validation)
      && VALIDATION_STATUS_VALUES.has(candidate.validation.status)
      && semanticReviewShapeValid(candidate.validation.semantic_review)
      && historyValid
      && authoringValidationValid;
    const readinessValid = typeof candidate.ready_for_implementation === 'boolean';
    const preservedHistory = historyValid
      ? cloneJson(candidate.validation.semantic_review_history)
      : semanticReviewHistoryInitial(featureName, candidate.created_at);
    const preservedAuthoringValidation = authoringValidationValid
      ? cloneJson(candidate.validation.authoring_validation)
      : null;
    const freshValidation = {
      status: 'not-run',
      semantic_review: semanticReviewNotRun(),
      semantic_review_history: preservedHistory,
      authoring_validation: preservedAuthoringValidation,
    };
    const next = {
      schema_version: '2.1',
      feature_name: featureName,
      created_at: candidate.created_at,
      updated_at: candidate.updated_at,
      language: candidate.language,
      status,
      scope_lock: scopeLock,
      authoring,
      coordination: cloneJson(evidence.coordination),
      validation: validationValid ? cloneJson(candidate.validation) : freshValidation,
      semantic_model: isLegacy ? null : cloneJson(candidate.semantic_model),
      ready_for_implementation: readinessValid ? candidate.ready_for_implementation : false,
      workflow_policy: cloneJson(evidence.workflowPolicy),
      ...(evidence.researchExists ? { research: 'research.md' } : {}),
      ...(evidence.taskFiles.length > 0 ? {
        task_files: [...evidence.taskFiles].sort(), task_registry: projectedRegistry,
      } : {}),
    };
    const semanticChanged = evidence.tasksChanged || evidence.researchChanged
      || isLegacy || JSON.stringify(next) !== JSON.stringify(candidate);
    if (semanticChanged || !validationValid || !readinessValid) {
      next.ready_for_implementation = false;
      next.validation = freshValidation;
      next.semantic_model = null;
    }
    const changed = JSON.stringify(next) !== JSON.stringify(candidate);
    if (changed) next.updated_at = evidence.timestamp;
    preflightSpec21Candidate(next, evidence);
    return { ok: true, spec: next, changed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function validateDependencyCycles(taskFiles, registry) {
  const visiting = new Set();
  const visited = new Set();
  function visit(taskPath, stack = []) {
    if (visiting.has(taskPath)) {
      const start = stack.indexOf(taskPath);
      failPrecondition(`task_registry.dependencies contains a cycle: ${stack.slice(start).concat(taskPath).join(' -> ')}`);
    }
    if (visited.has(taskPath)) return;
    visiting.add(taskPath);
    for (const dependency of registry[taskPath].dependencies) visit(dependency, [...stack, taskPath]);
    visiting.delete(taskPath);
    visited.add(taskPath);
  }
  for (const taskPath of taskFiles) visit(taskPath);
}

function listExistingTaskFiles(workRoot, specDir) {
  const tasksDir = path.join(specDir, 'tasks');
  assertNoSymlinkPath(workRoot, tasksDir, 'tasks directory');
  if (!fs.existsSync(tasksDir)) return [];
  assertExistingDirectory(workRoot, tasksDir, 'tasks directory');
  const files = [];
  for (const entry of fs.readdirSync(tasksDir, { withFileTypes: true })) {
    const fullPath = path.join(tasksDir, entry.name);
    if (entry.isSymbolicLink()) failPrecondition(`tasks entry cannot be a symlink: ${fullPath}`);
    if (!entry.isFile()) failPrecondition(`tasks entry must be a regular file: ${fullPath}`);
    const relative = `tasks/${entry.name}`;
    parseTaskPath(relative, `tasks entry ${relative}`);
    files.push(relative);
  }
  return files.sort();
}

function readPersistedPolicy(spec) {
  if (hasOwn(spec, 'override_receipt')) {
    if (spec.override_receipt !== null) {
      failPrecondition('existing top-level override_receipt is unsupported; omit the field');
    }
    if (spec.schema_version !== '2.0') {
      failPrecondition('top-level override_receipt is only readable as inert null during schema 2.0 migration; omit the field');
    }
  }
  if (!hasOwn(spec, 'workflow_policy')) {
    const legacy = spec.design_context?.execution_tier;
    failPrecondition(
      legacy
        ? 'existing spec has no persisted workflow_policy; design_context.execution_tier is read-only and cannot create policy'
        : 'existing spec must contain a persisted workflow_policy snapshot',
    );
  }
  if (isPlainObject(spec.workflow_policy)
    && hasOwn(spec.workflow_policy, 'override_receipt')
    && spec.workflow_policy.override_receipt !== null) {
    failPrecondition('existing workflow_policy.override_receipt is unsupported; omit the field');
  }
  try {
    return POLICY.readWorkflowPolicySnapshot(spec);
  } catch (error) {
    failPrecondition(`existing workflow_policy is invalid (${error.message})`);
  }
}

function validateResearchTopology(workRoot, specDir, spec, needsResearch) {
  const canonical = 'research.md';
  if (hasOwn(spec, 'research') && spec.research !== null) {
    const pointer = isPlainObject(spec.research) ? spec.research.path : spec.research;
    if (typeof pointer !== 'string') failPrecondition('spec.research must be null, a safe relative path, or an object with a path');
    const safePointer = safeRelativePath(pointer, 'spec.research');
    const pointerPath = path.resolve(specDir, safePointer);
    assertNoSymlinkPath(workRoot, pointerPath, 'spec.research path');
    if (!isWithin(specDir, pointerPath)) failPrecondition('spec.research path must stay inside the spec directory');
    if (needsResearch && safePointer !== canonical) {
      failPrecondition('spec.research path must be research.md for an explicit --research request');
    }
    assertRegularFileOrMissing(workRoot, pointerPath, 'spec.research path');
  }
  const researchPath = path.join(specDir, canonical);
  assertRegularFileOrMissing(workRoot, researchPath, 'research.md');
  return researchPath;
}

function inspectTaskTopology(workRoot, specDir, spec, parsed, artifactDeclarations) {
  const hasTaskFiles = hasOwn(spec, 'task_files');
  const hasRegistry = hasOwn(spec, 'task_registry');
  if (hasTaskFiles !== hasRegistry) failPrecondition('task_files and task_registry must be present together');

  const declared = hasTaskFiles ? validateTaskPathList(spec.task_files, 'task_files') : [];
  const registry = hasRegistry ? spec.task_registry : {};
  if (hasRegistry && !isPlainObject(registry)) failPrecondition('task_registry must be an object keyed by task file path');
  const declaredSet = new Set(declared);
  if (hasRegistry) {
    const registryIds = new Set();
    for (const taskPath of Object.keys(registry)) {
      parseTaskPath(taskPath, `task_registry key ${taskPath}`);
      if (!declaredSet.has(taskPath)) failPrecondition(`task_registry has an unregistered entry ${taskPath}`);
      validateRegistryEntry(taskPath, registry[taskPath], declaredSet);
      if (registryIds.has(registry[taskPath].id)) failPrecondition(`task_registry contains duplicate task id ${registry[taskPath].id}`);
      registryIds.add(registry[taskPath].id);
    }
    for (const taskPath of declared) {
      if (!hasOwn(registry, taskPath)) failPrecondition(`task_registry is missing entry ${taskPath}`);
    }
    validateDependencyCycles(declared, registry);
  }

  const existing = listExistingTaskFiles(workRoot, specDir);
  const existingSet = new Set(existing);
  if (!hasTaskFiles && existing.length > 0) failPrecondition('tasks directory contains files but task_files/task_registry are absent');
  for (const taskPath of existing) {
    if (!declaredSet.has(taskPath)) failPrecondition(`task_files is missing existing task file ${taskPath}`);
  }
  const requested = new Set(parsed.map((task) => task.file));
  for (const taskPath of declared) {
    if (!existingSet.has(taskPath)) failPrecondition(`task_files declares missing task file ${taskPath}`);
  }

  for (const task of parsed) {
    if (!existingSet.has(task.file)) continue;
    const entry = registry[task.file];
    const expected = registryEntry(task, artifactDeclarations);
    if (entry.id !== expected.id || entry.title !== expected.title) {
      failPrecondition(`conflicting duplicate task ${task.raw}: existing registry entry differs`);
    }
    if (artifactDeclarations.has(task.file)) {
      if (!hasOwn(entry, 'artifacts') || JSON.stringify(entry.artifacts) !== JSON.stringify(expected.artifacts)) {
        failPrecondition(`conflicting duplicate task ${task.raw}: existing registry artifacts differ`);
      }
    }
  }

  return {
    declared,
    registry,
    existing,
    existingSet,
    requested,
    hasTaskTopology: hasTaskFiles,
  };
}

function captureTarget(workRoot, specDir, relativePath) {
  const target = path.join(specDir, relativePath);
  assertNoSymlinkPath(workRoot, target, `target ${relativePath}`);
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile()) failPrecondition(`target ${relativePath} must be a regular file`);
    return { exists: true, bytes: fs.readFileSync(target) };
  } catch (error) {
    if (error instanceof ScaffoldPreconditionError) throw error;
    if (error.code !== 'ENOENT') failPrecondition(`target ${relativePath} cannot be inspected (${error.message})`);
    return { exists: false, bytes: null };
  }
}

function parseFailureInjection() {
  const raw = process.env.CAFEKIT_SCAFFOLD_FAIL_AFTER_WRITES;
  if (raw === undefined) return null;
  if (!/^[1-9]\d*$/.test(raw)) failPrecondition('CAFEKIT_SCAFFOLD_FAIL_AFTER_WRITES must be a positive integer');
  return Number(raw);
}

function parseCrashInjection() {
  const raw = process.env.CAFEKIT_SCAFFOLD_KILL_AFTER_RENAMES;
  if (raw === undefined) return null;
  if (!/^[1-9]\d*$/.test(raw)) {
    failPrecondition('CAFEKIT_SCAFFOLD_KILL_AFTER_RENAMES must be a positive integer');
  }
  return Number(raw);
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function fsyncPath(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function fsyncDirectory(directory) {
  try { fsyncPath(directory); } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR'].includes(error.code)) throw error;
  }
}

function fileDigestOrNull(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile()) throw new Error(`transaction path is not a regular file: ${filePath}`);
    return digest(fs.readFileSync(filePath));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) return pid === process.pid;
  try { process.kill(pid, 0); return true; } catch (error) {
    return error.code === 'EPERM';
  }
}

function validateTransactionManifest(workRoot, transactionDir, manifest) {
  if (!isPlainObject(manifest) || manifest.format !== TRANSACTION_FORMAT) {
    throw new Error(`unrecognized scaffold transaction manifest: ${transactionDir}`);
  }
  const transactionId = path.basename(transactionDir).slice(TRANSACTION_PREFIX.length);
  if (manifest.transaction_id !== transactionId || !/^[a-f0-9-]{20,}$/i.test(transactionId)) {
    throw new Error(`scaffold transaction identity mismatch: ${transactionDir}`);
  }
  if (path.resolve(manifest.work_root || '') !== workRoot) {
    throw new Error(`scaffold transaction work root mismatch: ${transactionDir}`);
  }
  const specRelative = safeRelativePath(manifest.spec_dir, 'transaction spec_dir');
  const specDir = path.resolve(workRoot, specRelative);
  if (!isWithin(workRoot, specDir) || !Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    throw new Error(`invalid scaffold transaction topology: ${transactionDir}`);
  }
  const seen = new Set();
  for (const entry of manifest.entries) {
    if (!isPlainObject(entry)) throw new Error(`invalid scaffold transaction entry: ${transactionDir}`);
    const relativePath = safeRelativePath(entry.path, 'transaction entry path');
    if (seen.has(relativePath)) throw new Error(`duplicate scaffold transaction path: ${relativePath}`);
    seen.add(relativePath);
    if (!isPlainObject(entry.before) || typeof entry.before.exists !== 'boolean'
      || (entry.before.exists && !/^[a-f0-9]{64}$/.test(entry.before.digest || ''))
      || !/^[a-f0-9]{64}$/.test(entry.after_digest || '')) {
      throw new Error(`invalid scaffold transaction digest evidence: ${relativePath}`);
    }
  }
  return { ...manifest, specDir };
}

function removeEmptyTransactionParents(specDir, target) {
  let current = path.dirname(target);
  while (isWithin(specDir, current) && current !== path.dirname(specDir)) {
    try { fs.rmdirSync(current); } catch (error) {
      if (error.code === 'ENOENT') break;
      if (['ENOTEMPTY', 'EEXIST'].includes(error.code)) break;
      throw error;
    }
    if (current === specDir) break;
    current = path.dirname(current);
  }
}

function recoverTransaction(workRoot, transactionDir, rawManifest) {
  const manifest = validateTransactionManifest(workRoot, transactionDir, rawManifest);
  if (processIsAlive(manifest.pid)) return false;
  for (let index = manifest.entries.length - 1; index >= 0; index -= 1) {
    const entry = manifest.entries[index];
    const target = path.join(manifest.specDir, entry.path);
    const backup = path.join(transactionDir, 'backup', entry.path);
    const targetDigest = fileDigestOrNull(target);
    const backupDigest = fileDigestOrNull(backup);
    if (entry.before.exists) {
      if (backupDigest !== null && backupDigest !== entry.before.digest) {
        throw new Error(`recovery cannot prove backup ownership for ${entry.path}`);
      }
      if (targetDigest === entry.after_digest) {
        removeTarget(target);
      } else if (targetDigest !== null && targetDigest !== entry.before.digest) {
        throw new Error(`recovery refuses to overwrite unowned target ${entry.path}`);
      }
      if (fileDigestOrNull(target) === null) {
        if (backupDigest !== entry.before.digest) {
          throw new Error(`recovery is missing the owned backup for ${entry.path}`);
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.renameSync(backup, target);
      }
    } else if (targetDigest === entry.after_digest) {
      removeTarget(target);
    } else if (targetDigest !== null) {
      throw new Error(`recovery refuses to delete unowned target ${entry.path}`);
    }
    removeEmptyTransactionParents(manifest.specDir, target);
  }
  fs.rmSync(transactionDir, { recursive: true, force: true });
  fsyncDirectory(workRoot);
  return true;
}

function recoverTransactions(workRoot) {
  let recovered = 0;
  for (const entry of fs.readdirSync(workRoot, { withFileTypes: true })) {
    if (!entry.name.startsWith(TRANSACTION_PREFIX)) continue;
    const transactionDir = path.join(workRoot, entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      failPrecondition(`scaffold transaction identity is not a directory: ${transactionDir}`);
    }
    const manifestPath = path.join(transactionDir, 'manifest.json');
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (error) {
      failPrecondition(`scaffold transaction cannot be recovered (${error.message}): ${transactionDir}`);
    }
    try {
      if (recoverTransaction(workRoot, transactionDir, manifest)) recovered += 1;
    } catch (error) {
      failPrecondition(`scaffold transaction recovery stopped safely (${error.message})`);
    }
  }
  return recovered;
}

function prepareTransaction(workRoot, specDir, changes, snapshots, transactionRoot, createSpecDir) {
  assertExistingDirectory(workRoot, transactionRoot, 'scaffold transaction directory');
  const transactionId = crypto.randomUUID();
  const transactionDir = path.join(transactionRoot, `${TRANSACTION_PREFIX}${transactionId}`);
  const stageDir = path.join(transactionDir, 'stage');
  const backupDir = path.join(transactionDir, 'backup');
  fs.mkdirSync(stageDir, { recursive: true });
  fs.mkdirSync(backupDir);
  const entries = [];
  try {
    for (const change of changes) {
      safeRelativePath(change.path, `staged path ${change.path}`);
      const staged = path.join(stageDir, change.path);
      fs.mkdirSync(path.dirname(staged), { recursive: true });
      fs.writeFileSync(staged, change.body, { encoding: 'utf8', flag: 'wx' });
      fsyncPath(staged);
      const before = snapshots.get(change.path);
      entries.push({
        path: change.path,
        before: { exists: before.exists, ...(before.exists ? { digest: digest(before.bytes) } : {}) },
        after_digest: digest(Buffer.from(change.body, 'utf8')),
      });
    }
    const manifest = {
      format: TRANSACTION_FORMAT,
      transaction_id: transactionId,
      pid: process.pid,
      work_root: workRoot,
      spec_dir: path.relative(workRoot, specDir),
      create_spec_dir: createSpecDir,
      entries,
    };
    const manifestPath = path.join(transactionDir, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    fsyncPath(manifestPath);
    fsyncDirectory(transactionDir);
    fsyncDirectory(transactionRoot);
    return { transactionDir, stageDir, backupDir, manifest };
  } catch (error) {
    fs.rmSync(transactionDir, { recursive: true, force: true });
    throw error;
  }
}

function ensureTargetParent(workRoot, specDir, relativePath, createdDirs) {
  const parent = path.dirname(relativePath);
  if (parent === '.') return;
  let current = specDir;
  for (const segment of parent.split(path.sep)) {
    current = path.join(current, segment);
    assertNoSymlinkPath(workRoot, current, `target parent ${current}`);
    if (fs.existsSync(current)) {
      assertExistingDirectory(workRoot, current, `target parent ${current}`);
    } else {
      fs.mkdirSync(current);
      createdDirs.push(current);
    }
  }
}

function ensureDirectoryTree(workRoot, directory, createdDirs, label) {
  assertNoSymlinkPath(workRoot, directory, label);
  const relative = path.relative(path.resolve(workRoot), path.resolve(directory));
  let current = path.resolve(workRoot);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.existsSync(current)) {
      assertExistingDirectory(workRoot, current, label);
    } else {
      fs.mkdirSync(current);
      createdDirs.push(current);
    }
  }
}

function removeTarget(target) {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isDirectory()) throw new Error(`rollback target is a directory: ${target}`);
    fs.unlinkSync(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function commitChanges(
  workRoot,
  specDir,
  changes,
  snapshots,
  failureAfter,
  { createSpecDir = false, afterApply = null, transactionRoot = path.dirname(specDir) } = {},
) {
  const transaction = prepareTransaction(
    workRoot, specDir, changes, snapshots, transactionRoot, createSpecDir,
  );
  const createdDirs = [];
  let writes = 0;
  let renames = 0;
  const crashAfter = parseCrashInjection();
  const renameBoundary = (from, to) => {
    fs.renameSync(from, to);
    renames += 1;
    fsyncDirectory(path.dirname(to));
    if (crashAfter !== null && renames >= crashAfter) process.kill(process.pid, 'SIGKILL');
  };
  try {
    if (createSpecDir) {
      if (fs.existsSync(specDir)) failPrecondition(`spec dir already exists: ${specDir}`);
      ensureDirectoryTree(workRoot, specDir, createdDirs, 'spec directory');
    }
    for (const change of changes) {
      const target = path.join(specDir, change.path);
      const before = captureTarget(workRoot, specDir, change.path);
      const expected = snapshots.get(change.path);
      if (before.exists !== expected.exists || (before.exists && !before.bytes.equals(expected.bytes))) {
        failPrecondition(`target changed during preflight: ${change.path}`);
      }
      ensureTargetParent(workRoot, specDir, change.path, createdDirs);
      const backup = path.join(transaction.backupDir, change.path);
      if (before.exists) {
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        renameBoundary(target, backup);
      }
      renameBoundary(path.join(transaction.stageDir, change.path), target);
      writes += 1;
      if (failureAfter !== null && writes >= failureAfter) {
        throw new Error(`injected failure after ${writes} staged write(s)`);
      }
    }
    if (typeof afterApply === 'function') afterApply();
  } catch (error) {
    let rollbackError = null;
    try {
      const manifest = { ...transaction.manifest, pid: -1 };
      recoverTransaction(workRoot, transaction.transactionDir, manifest);
    } catch (rollbackFailure) {
      rollbackError = rollbackFailure;
    }
    if (rollbackError) throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`);
    throw new Error(`${error.message}; transaction rolled back`);
  }
  fs.rmSync(transaction.transactionDir, { recursive: true, force: true });
  fsyncDirectory(transactionRoot);
}

function scaffoldTasksOnly({ args, specDir, specPath, spec, persistedPolicy, parsed, artifactDeclarations, taskTpl, ts }) {
  const workRoot = path.resolve(process.cwd());
  assertExistingDirectory(workRoot, specDir, 'spec directory');
  assertRegularFileOrMissing(workRoot, specPath, 'spec.json');
  const requirementsPath = path.join(specDir, 'requirements.md');
  const designPath = path.join(specDir, 'design.md');
  assertRegularFileOrMissing(workRoot, requirementsPath, 'requirements.md');
  assertRegularFileOrMissing(workRoot, designPath, 'design.md');
  const topology = inspectTaskTopology(workRoot, specDir, spec, parsed, artifactDeclarations);
  const allTaskFiles = [...new Set([...topology.declared, ...parsed.map((task) => task.file)])].sort();
  if (args.taskTriggers !== null || args.coordination || args.dependencies !== null || args.artifacts !== null) {
    failPrecondition('schema 2.1 mutation uses --boundaries as the only topology authority');
  }
  const boundaries = parseBoundaryDeclarations(args.boundaries, allTaskFiles);
  if (boundaries.length === 0) {
    failPrecondition('--tasks-only requires a complete non-empty --boundaries array for the resulting task bundle');
  }
  const dependencyDeclarations = dependenciesFromBoundaries(boundaries, allTaskFiles);
  const phases = args.phases === null && Array.isArray(spec.coordination?.phases)
    ? cloneJson(spec.coordination.phases)
    : parsePhaseDeclarations(args.phases, allTaskFiles);
  validatePhaseBoundaryRefs(phases, boundaries);
  for (const task of parsed) {
    if (!topology.existingSet.has(task.file) || !dependencyDeclarations.has(task.file)) continue;
    const existing = topology.registry[task.file].dependencies;
    const requested = dependencyDeclarations.get(task.file);
    if (JSON.stringify(existing) !== JSON.stringify(requested)) {
      failPrecondition(`conflicting duplicate task ${task.raw}: existing registry dependencies differ`);
    }
  }

  let nextPolicy = POLICY.canonicalWorkflowPolicySnapshot(spec);
  if (args.risks && args.risks.length > 0) {
    try {
      nextPolicy = POLICY.escalateWorkflowPolicy(nextPolicy, { risks: args.risks });
    } catch (error) {
      failPrecondition(`--tasks-only cannot escalate workflow policy (${error.message})`);
    }
    const validation = POLICY.validateWorkflowPolicySnapshot(nextPolicy);
    if (!validation.valid) failPrecondition(`--tasks-only escalation produced an invalid workflow_policy (${validation.errors.join('; ')})`);
  }

  const needsResearch = args.research === true;
  const researchPath = validateResearchTopology(workRoot, specDir, spec, needsResearch);
  const researchExists = fs.existsSync(researchPath);
  const researchTemplate = needsResearch && !researchExists
    ? renderResearchTemplate(args.feature, args.uncertainty)
    : null;
  const newTasks = parsed.filter((task) => !topology.existingSet.has(task.file));
  const nextSpec = cloneJson(spec);
  if (!topology.hasTaskTopology && newTasks.length > 0) {
    nextSpec.task_files = [];
    nextSpec.task_registry = {};
  }
  for (const task of newTasks) {
    nextSpec.task_files.push(task.file);
    nextSpec.task_registry[task.file] = registryEntry(
      task,
      artifactDeclarations,
      dependencyDeclarations.get(task.file) || [],
    );
  }
  if (needsResearch && nextSpec.research !== 'research.md') {
    nextSpec.research = 'research.md';
  }
  nextSpec.task_files.sort();
  const normalized = normalizeSpec21Candidate(nextSpec, {
    featureName: args.feature,
    timestamp: ts,
    specDir,
    requirementsExists: fs.existsSync(requirementsPath),
    designExists: fs.existsSync(designPath),
    researchExists: researchExists || researchTemplate !== null,
    researchChanged: researchTemplate !== null,
    taskFiles: allTaskFiles,
    tasksChanged: newTasks.length > 0,
    coordination: { boundaries, ...(phases.length > 0 ? { phases } : {}) },
    workflowPolicy: nextPolicy,
  });
  if (!normalized.ok) failPrecondition(`schema 2.1 migration rejected candidate (${normalized.error})`);
  const normalizedSpec = normalized.spec;
  const specChanged = JSON.stringify(normalizedSpec) !== JSON.stringify(spec);
  if (specChanged && normalizedSpec.updated_at === spec.created_at && ts !== spec.created_at) {
    failPrecondition('schema 2.1 migration produced a stale updated_at timestamp');
  }

  const changes = newTasks.map((task) => ({
    path: task.file,
    body: fillTask(
      taskTpl,
      task,
      args.feature,
      dependencyDeclarations.get(task.file) || [],
      taskHasDeclaredImplementationObligation(normalizedSpec, task.file),
    ),
  }));
  if (researchTemplate !== null) changes.push({ path: 'research.md', body: researchTemplate });
  if (specChanged) changes.push({ path: 'spec.json', body: `${JSON.stringify(normalizedSpec, null, 2)}\n` });
  if (changes.length === 0) return { createdTasks: [], researchCreated: false };

  const expectedAbsent = new Set(newTasks.map((task) => task.file));
  if (researchTemplate !== null) expectedAbsent.add('research.md');
  const snapshots = new Map();
  for (const change of changes) {
    const snapshot = captureTarget(workRoot, specDir, change.path);
    if (expectedAbsent.has(change.path) && snapshot.exists) {
      failPrecondition(`target appeared after preflight: ${change.path}`);
    }
    snapshots.set(change.path, snapshot);
  }
  commitChanges(workRoot, specDir, changes, snapshots, parseFailureInjection(), {
    transactionRoot: workRoot,
    afterApply: () => observeInstalledPolicyBaseline({ args, specDir, spec: normalizedSpec }),
  });
  return { createdTasks: newTasks.map((task) => task.file), researchCreated: researchTemplate !== null };
}

function syncSemanticModel({ workRoot, args, specDir, ts }) {
  assertExistingDirectory(workRoot, specDir, 'spec directory');
  const specPath = path.join(specDir, 'spec.json');
  assertRegularFileOrMissing(workRoot, specPath, 'spec.json');
  if (!fs.existsSync(specPath)) failPrecondition('--sync-semantic-model requires an existing spec.json');
  let spec;
  try { spec = JSON.parse(fs.readFileSync(specPath, 'utf8')); }
  catch (error) { failPrecondition(`--sync-semantic-model spec.json is invalid JSON (${error.message})`); }
  if (!isPlainObject(spec) || spec.schema_version !== '2.1') failPrecondition('--sync-semantic-model accepts canonical schema 2.1 only');
  assertCanonicalSpecInputClosedWorld(spec, { allowLegacyReview: true });
  const projection = SEMANTIC.modelFromMarkdown(specDir, spec);
  if (projection.errors.length) failPrecondition(`semantic projection is invalid (${projection.errors.join('; ')})`);
  const modelUnchanged = SEMANTIC.stableJson(spec.semantic_model) === SEMANTIC.stableJson(projection.model);
  const lifecycleCanonical = isPlainObject(spec.validation)
    && Object.keys(spec.validation).sort().join(',') === [...VALIDATION_FIELDS].sort().join(',')
    && semanticReviewShapeValid(spec.validation.semantic_review)
    && semanticReviewHistoryShapeValid(spec.validation.semantic_review_history)
    && authoringValidationShapeValid(spec.validation.authoring_validation);
  if (modelUnchanged && lifecycleCanonical) {
    console.log(`SEMANTIC_MODEL_UNCHANGED ${path.relative(process.cwd(), specDir) || specDir}`);
    return;
  }
  const next = cloneJson(spec);
  next.semantic_model = projection.model;
  next.updated_at = ts;
  next.ready_for_implementation = false;
  if (!lifecycleCanonical) {
    for (const stage of ['requirements', 'design', 'research', 'tasks']) {
      if (next.authoring?.[stage] === 'validated') next.authoring[stage] = 'draft';
    }
  }
  // Only the ephemeral semantic_review pointer is invalidated by a projection
  // resync; semantic_review_history (C13) and authoring_validation (C16) are
  // durable records this command never writes and must carry forward as-is.
  next.validation = {
    status: 'not-run',
    semantic_review: semanticReviewNotRun(),
    semantic_review_history: hasOwn(spec.validation, 'semantic_review_history')
      && semanticReviewHistoryShapeValid(spec.validation.semantic_review_history)
      ? cloneJson(spec.validation.semantic_review_history)
      : semanticReviewHistoryInitial(args.feature, spec.created_at),
    authoring_validation: hasOwn(spec.validation, 'authoring_validation')
      && authoringValidationShapeValid(spec.validation.authoring_validation)
      ? cloneJson(spec.validation.authoring_validation)
      : null,
  };
  preflightSpec21Candidate(next, {
    featureName: args.feature,
    requirementsExists: fs.existsSync(path.join(specDir, 'requirements.md')),
    designExists: fs.existsSync(path.join(specDir, 'design.md')),
    researchExists: fs.existsSync(path.join(specDir, 'research.md')),
    taskFiles: listExistingTaskFiles(workRoot, specDir),
  });
  const snapshot = captureTarget(workRoot, specDir, 'spec.json');
  commitChanges(
    workRoot,
    specDir,
    [{ path: 'spec.json', body: `${JSON.stringify(next, null, 2)}\n` }],
    new Map([['spec.json', snapshot]]),
    parseFailureInjection(),
    { transactionRoot: workRoot },
  );
  console.log(`SEMANTIC_MODEL_SYNCED ${path.relative(process.cwd(), specDir) || specDir}`);
}

// Version lives in a different file depending on where this script runs: an
// installed adapter carries `<adapter>/cafekit.json`, the source tree carries
// `packages/spec/package.json`. Read them with fs rather than require so the
// runtime dependency closure — which may only copy files under src/claude —
// stays satisfiable in an installed runtime.
function readVersion() {
  const candidates = [
    path.resolve(__dirname, '..', 'cafekit.json'),
    path.resolve(__dirname, '..', '..', '..', 'package.json'),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (typeof parsed.version === 'string' && parsed.version) return parsed.version;
    } catch {
      // try the next location
    }
  }
  return 'unknown';
}

// --help/--version answer before any precondition runs: a caller asking what
// this command is must not be told their help flag is an invalid feature name,
// and must not trigger transaction recovery as a side effect.
function respondToInfoFlags(argv) {
  const flags = argv.slice(2);
  if (flags.includes('--help') || flags.includes('-h')) {
    console.log(USAGE_TEXT);
    return true;
  }
  if (flags.includes('--version') || flags.includes('-v')) {
    console.log(readVersion());
    return true;
  }
  return false;
}

function main() {
  if (respondToInfoFlags(process.argv)) return;
  const workRoot = path.resolve(process.cwd());
  const recoveredTransactions = recoverTransactions(workRoot);
  if (recoveredTransactions > 0) {
    console.error(`recovered ${recoveredTransactions} interrupted scaffold transaction(s)`);
  }
  const args = parseArgs(process.argv);
  if (args.syncSemanticModel) {
    if (!args.feature || args.tasks !== null || args.tasksOnly || args.boundaries !== null || args.research
      || args.planningDepth || args.assuranceLevel || args.lane) {
      failPrecondition('--sync-semantic-model is an isolated explicit promotion mode and cannot be combined with authoring mutations');
    }
    safeRelativePath(args.specsRoot, '--specs-root');
    safeRelativePath(args.feature, 'feature');
    const specDir = path.resolve(workRoot, args.specsRoot, args.feature);
    if (!isWithin(workRoot, specDir)) failPrecondition(`spec directory escapes the work root: ${specDir}`);
    syncSemanticModel({ workRoot, args, specDir, ts: nowIso() });
    return;
  }
  if (!args.feature || (args.tasks === null && args.tasksOnly) || (args.coordination && !args.tasks)) {
    usage();
    failPrecondition('missing feature or required task arguments');
  }
  if (args.research && !concreteUncertainty(args.uncertainty)) {
    failPrecondition('--research requires --uncertainty with one concrete unresolved question (at least 12 trimmed characters)');
  }
  if (!args.research && args.uncertainty !== null) {
    failPrecondition('--uncertainty is only valid with --research');
  }
  if (typeof args.lane === 'string' && args.lane.toLowerCase() === 'direct') {
    failPrecondition('Direct lane does not create a spec; run targeted verification from the Direct workflow instead');
  }
  if (args.lane && !POLICY.LANES.includes(args.lane)) {
    failPrecondition(`--lane must be one of ${POLICY.LANES.join(', ')}`);
  }
  if (args.planningDepth && !POLICY.PLANNING_DEPTHS.includes(args.planningDepth)) {
    failPrecondition(`--planning-depth must be one of ${POLICY.PLANNING_DEPTHS.join(', ')}`);
  }
  if (args.planningDepth === 'None') {
    failPrecondition('None planning depth does not create a durable spec; use the Direct workflow instead');
  }
  if (args.assuranceLevel && !POLICY.ASSURANCE_LEVELS.includes(args.assuranceLevel)) {
    failPrecondition(`--assurance-level must be one of ${POLICY.ASSURANCE_LEVELS.join(', ')}`);
  }
  if (args.lane && (args.planningDepth || args.assuranceLevel)) {
    failPrecondition('--lane is a compatibility adapter and cannot be combined with Specs v2 axis flags');
  }

  const ids = (args.tasks || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (args.tasksOnly && ids.length === 0) {
    failPrecondition('--tasks-only requires at least one task id');
  }
  const parsed = [];
  const seenIds = new Set();
  for (const id of ids) {
    const m = id.match(TASK_ID_RE);
    if (!m) {
      failPrecondition(`invalid task id "${id}" (want R{N}-{SEQ}-<slug>, SEQ 2 digits)`);
    }
    const logicalId = `R${m[1]}-${m[2]}`;
    if (seenIds.has(logicalId)) failPrecondition(`duplicate task id "${logicalId}"`);
    seenIds.add(logicalId);
    parsed.push({ raw: id, req: m[1], seq: m[2], slug: m[3], file: `tasks/task-${id}.md` });
  }
  if (args.phases !== null && parsed.length === 0) {
    failPrecondition('--phases requires --tasks because phase grouping needs a task graph');
  }
  if (args.phases !== null && args.planningDepth !== 'Full') {
    failPrecondition('--phases requires explicit --planning-depth Full before any scaffold writes');
  }
  const artifactDeclarations = parseArtifactDeclarations(args.artifacts, parsed);
  if (args.taskTriggers !== null || args.coordination || args.dependencies !== null || args.artifacts !== null) {
    failPrecondition('schema 2.1 authoring uses --boundaries as the only topology authority; task triggers, coordination markers, dependencies, and artifact maps are read compatibility only');
  }
  const boundaries = args.tasksOnly ? null : parseBoundaryDeclarations(
    args.boundaries,
    parsed.map((task) => task.file).sort(),
  );
  const dependencyDeclarations = args.tasksOnly
    ? null
    : dependenciesFromBoundaries(boundaries, parsed.map((task) => task.file).sort());
  const riskNames = parseRiskNames(args.risks);
  const phases = args.tasksOnly
    ? []
    : parsePhaseDeclarations(args.phases, parsed.map((task) => task.file));
  if (!args.tasksOnly) validatePhaseBoundaryRefs(phases, boundaries);

  safeRelativePath(args.specsRoot, '--specs-root');
  safeRelativePath(args.feature, 'feature');
  if (!FEATURE_NAME_RE.test(args.feature)) {
    failPrecondition('feature must be one safe path segment starting with an alphanumeric character');
  }
  const specDir = path.resolve(process.cwd(), args.specsRoot, args.feature);
  if (!isWithin(workRoot, specDir)) failPrecondition(`spec directory escapes the work root: ${specDir}`);
  assertNoSymlinkPath(workRoot, specDir, 'spec directory');
  const taskTpl = readTemplate('task.md');
  const ts = nowIso();
  const created = [];

  // --- --tasks-only: add task stubs + merge registry into an existing spec ---
  if (args.tasksOnly) {
    const specPath = path.join(specDir, 'spec.json');
    assertNoSymlinkPath(workRoot, specPath, 'spec.json');
    if (!fs.existsSync(specPath)) failPrecondition(`--tasks-only needs an existing spec.json at ${specPath}`);
    let spec;
    try {
      spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    } catch (error) {
      failPrecondition(`--tasks-only existing spec.json is invalid JSON (${error.message})`);
    }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      failPrecondition('--tasks-only existing spec.json must contain a JSON object');
    }
    assertCanonicalSpecInputClosedWorld(spec);
    if (spec.schema_version === '2.0') assertLegacyMigrationClosedWorld(spec);
    const persistedPolicy = readPersistedPolicy(spec);
    if (args.planningDepth && args.planningDepth !== persistedPolicy.planning_depth) {
      failPrecondition(`--tasks-only --planning-depth ${args.planningDepth} does not match persisted workflow_policy.planning_depth ${persistedPolicy.planning_depth}`);
    }
    if (args.lane && args.lane !== persistedPolicy.lane) {
      failPrecondition(`--tasks-only --lane ${args.lane} does not match persisted workflow_policy.lane ${persistedPolicy.lane}; omit --lane or use the persisted lane (downgrade is not allowed)`);
    }
    const result = scaffoldTasksOnly({
      args: { ...args, risks: riskNames },
      specDir,
      specPath,
      spec,
      persistedPolicy,
      parsed,
      artifactDeclarations,
      taskTpl,
      ts,
    });
    const createdTasks = result.createdTasks;
    const relTo = path.relative(process.cwd(), specDir) || specDir;
    console.log(`SCAFFOLDED (tasks-only) ${relTo}`);
    console.log(`- ${createdTasks.length} new task stub(s); task_files + task_registry merged.`);
    if (result.researchCreated) console.log('- research.md created by explicit --research request.');
    console.log(`- NEXT: Edit-fill {{...}} in each stub; set dependencies; run validator + spec-ground.`);
    return;
  }

  const policyInput = args.lane
    ? { risks: riskNames, override: args.lane }
    : {
      risks: riskNames,
      ...(args.planningDepth ? { planning_depth: args.planningDepth } : {}),
      ...(args.assuranceLevel ? { assurance_level: args.assuranceLevel } : {}),
    };
  let selectedPolicy;
  try {
    selectedPolicy = POLICY.workflowPolicySnapshot(policyInput);
  } catch (error) {
    failPrecondition(error.message);
  }
  if (parsed.length > 0 && boundaries.length === 0) {
    failPrecondition('physical task bundle requires at least one typed coordination.boundaries entry with semantic evidence');
  }
  if (parsed.length === 0 && args.boundaries !== null) {
    failPrecondition('--boundaries requires --tasks');
  }
  if (fs.existsSync(specDir)) {
    console.error(`precondition: spec dir already exists, refusing to overwrite: ${specDir}`);
    process.exit(2);
  }

  // --- spec.json (from spec-state.json template) ---
  const spec = JSON.parse(readTemplate('spec-state.json'));
  spec.feature_name = args.feature;
  spec.created_at = ts;
  spec.updated_at = ts;
  spec.language = args.lang;
  spec.scope_lock = spec.scope_lock || {};
  spec.scope_lock.source = args.title || `{{PROJECT_DESCRIPTION}}`;
  delete spec.workflow_policy;
  delete spec.override_receipt;
  Object.assign(spec, POLICY.persistWorkflowPolicySnapshot(spec, policyInput));
  spec.validation = isPlainObject(spec.validation) ? spec.validation : {};
  spec.validation.semantic_review = semanticReviewNotRun();
  spec.validation.semantic_review_history = semanticReviewHistoryInitial(args.feature, ts);
  spec.validation.authoring_validation = null;
  if (args.research) {
    spec.research = 'research.md';
    spec.authoring.research = 'draft';
  }
  spec.coordination = {
    boundaries,
    ...(phases.length > 0 ? { phases } : {}),
  };
  if (parsed.length > 0) {
    spec.authoring.tasks = 'draft';
    spec.task_files = parsed.map((t) => t.file);
    spec.task_registry = {};
    for (const t of parsed) {
      spec.task_registry[t.file] = registryEntry(
        t,
        artifactDeclarations,
        dependencyDeclarations.get(t.file) || [],
      );
    }
  } else {
    delete spec.task_files;
    delete spec.task_registry;
  }
  if (args.research) spec.authoring.research = 'draft';
  preflightSpec21Candidate(spec, {
    featureName: args.feature,
    requirementsExists: true,
    designExists: true,
    researchExists: args.research,
    taskFiles: parsed.map((task) => task.file),
  });
  const changes = [{ path: 'spec.json', body: `${JSON.stringify(spec, null, 2)}\n` }];
  created.push('spec.json');

  // --- doc templates (placeholders left for the model to fill) ---
  const docs = [
    ['requirements.md', 'requirements.md'],
    ...(args.research ? [['research.md', 'research.md']] : []),
    ['design.md', 'design.md'],
  ];
  for (const [tpl, out] of docs) {
    const source = tpl === 'research.md'
      ? renderResearchTemplate(args.feature, args.uncertainty)
      : readTemplate(tpl);
    const body = applyExecutionClosureProfile(
      source,
      tpl === 'design.md'
        && (selectedPolicy.lane === 'Critical' || declaredImplementationObligations(spec).length > 0),
    ).replace(/\{\{FEATURE_NAME\}\}/g, args.feature);
    changes.push({ path: out, body });
    created.push(out);
  }

  // --- task stubs (fill the cheap placeholders; leave the rest) ---
  for (const t of parsed) {
    changes.push({
      path: t.file,
      body: fillTask(
        taskTpl,
        t,
        args.feature,
        dependencyDeclarations.get(t.file) || [],
        taskHasDeclaredImplementationObligation(spec, t.file),
      ),
    });
    created.push(t.file);
  }

  const snapshots = new Map();
  for (const change of changes) snapshots.set(change.path, captureTarget(workRoot, specDir, change.path));
  commitChanges(workRoot, specDir, changes, snapshots, parseFailureInjection(), {
    createSpecDir: true,
    transactionRoot: workRoot,
    afterApply: () => observeInstalledPolicyBaseline({ args, specDir, spec }),
  });

  const rel = path.relative(process.cwd(), specDir) || specDir;
  console.log(`SCAFFOLDED ${rel}`);
  console.log(`- ${created.length} files created: spec.json + ${docs.length} docs + ${parsed.length} task stub(s)`);
  if (parsed.length > 0) console.log(`- task_files + task_registry pre-populated (${parsed.length} entries, all pending)`);
  console.log('- NEXT: Fill all spec placeholders (do NOT leave any); run validator + spec-ground before ready.');
}

try {
  main();
} catch (error) {
  console.error(`precondition: ${error.message}`);
  process.exitCode = 2;
}
