#!/usr/bin/env node
/**
 * CafeKit spec artifact validator.
 *
 * This is intentionally deterministic. Prompt rules can drift; this script is
 * the hard backstop before a spec is marked ready for implementation.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const POLICY = require('./workflow-policy.cjs');
const SEMANTIC = require('./spec-semantic-model.cjs');
const AUTHORING_DIGEST = require('./spec-authoring-digest.cjs');
const {
  canonicalProjectRoot,
  groundSpec,
  parseCanonicalAnchors,
  parseVerificationDefinitions,
} = require('./spec-ground.cjs');

const TASK_PATH_RE = /^tasks\/task-R\d+-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const TASK_IDENTITY_RE = /^tasks\/task-(R\d+-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const REQUIRED_REGISTRY_KEYS = [
  'id',
  'title',
  'status',
  'dependencies',
  'blocker',
  'started_at',
  'completed_at',
  'last_updated_at',
];
const APPROVAL_SCHEMA_VERSION = '2.0';
const LEGACY_APPROVAL_ERROR =
  `Legacy approval field "approved" detected. Migration required: replace "approved" with "agent_validated" per schema v${APPROVAL_SCHEMA_VERSION} (schema_version: "${APPROVAL_SCHEMA_VERSION}"). See spec-state.json template.`;
const FEATURE_RECEIPT_FILE = 'feature-receipt.md';
const SPEC_STATUS_VALUES = new Set(['in_progress', 'in-progress', 'paused', 'blocked', 'done']);
const TASK_STATUS_VALUES = new Set(['pending', 'in_progress', 'blocked', 'done']);
const VALIDATION_STATUS_VALUES = new Set(['not-run', 'in_progress', 'completed']);
const ANCHOR_TYPES = new Set([
  'file', 'symbol', 'command', 'route', 'schema', 'contract', 'artifact', 'external',
]);
const PHASE_FIELDS = ['id', 'task_ids', 'entry_condition', 'exit_condition', 'owner_boundary'];
const TASK_TRIGGER_VALUES = new Set([
  'distinct_ownership',
  'real_dependency',
  'durable_transition',
  'separate_proof',
  'parallel_coordination',
]);
const SEMANTIC_REVIEW_FIELDS = [
  'status',
  'reviewed_artifact_digest',
  'reviewed_criteria',
  'counterexamples',
];
const SEMANTIC_REVIEW_STATUSES = new Set(['not-run', 'completed']);
const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const SCHEMA_21 = '2.1';
const TASK_21_SECTIONS = [
  'Outcome', 'Scope', 'Anchors and Ownership', 'Changes', 'Acceptance', 'Dependencies', 'Verification Plan',
];
const BOUNDARY_21_FIELDS = Object.freeze({
  ownership: ['id', 'type', 'tasks', 'write_sets'],
  dependency: ['id', 'type', 'producer', 'consumer', 'deliverable'],
  transition: ['id', 'type', 'design_ref', 'owner', 'consumers', 'precondition', 'postcondition', 'failure', 'recovery'],
  proof: ['id', 'type', 'subject', 'verifier', 'verification_ref', 'artifact_anchor'],
  parallel: ['id', 'type', 'tasks', 'resources'],
});
const SPEC_21_REQUIRED_FIELDS = Object.freeze([
  'schema_version', 'feature_name', 'created_at', 'updated_at', 'language', 'status',
  'scope_lock', 'authoring', 'coordination', 'validation', 'semantic_model',
  'ready_for_implementation', 'workflow_policy',
]);
const SPEC_21_OPTIONAL_FIELDS = Object.freeze(['research', 'task_files', 'task_registry', 'decisions']);

// C2 SemanticReviewReceipt (R1-01, frozen) — separate reviewer verdict from
// lifecycle_disposition; repair_round is the finalizer-derived C13 attempt_index.
// This is the sole canonical field-list authority for C2's exact key set;
// every other consumer (e.g. run-skill-self-tests.mjs's template contract
// check) imports this constant rather than maintaining its own literal copy.
const C2_FIELDS = Object.freeze([
  'status', 'semantic_digest', 'verdict', 'lifecycle_disposition', 'findings',
  'unresolved_decisions', 'graph_coverage', 'repair_round', 'reviewed_criteria',
  'counterexamples', 'reviewer_evidence',
]);
const C2_VERDICTS = new Set(['PASS', 'FAIL']);
const C2_LIFECYCLE_DISPOSITIONS = new Set(['CONTINUE', 'BLOCKED']);
const C2_FINDING_FIELDS = ['id', 'severity', 'location', 'summary', 'blocking', 'disposition'];
const C2_FINDING_SEVERITIES = new Set(['Critical', 'High', 'Medium', 'Low']);
const C2_FINDING_DISPOSITIONS = new Set(['open', 'accepted', 'mitigated']);
const C2_UNRESOLVED_DECISION_FIELDS = ['id', 'summary', 'blocking'];
const C2_GRAPH_COVERAGE_FIELDS = ['surface', 'covered', 'notes'];
const C2_GRAPH_COVERAGE_SURFACES = [
  'criterion_local', 'cross_criterion', 'runtime_path', 'assumption_provenance', 'compatibility_migration',
];
const C2_REVIEWER_EVIDENCE_FIELDS = ['assurance', 'summary'];
const C2_REVIEWER_EVIDENCE_ASSURANCES = new Set(['Routine', 'Elevated', 'Strict']);
// C13 SemanticReviewHistory (R1-01, frozen) — durable, append-only, whole-lineage-deduped.
const C13_HISTORY_FIELDS = ['lineage_id', 'entries'];
const C13_ENTRY_FIELDS = [
  'sequence', 'semantic_digest', 'review_receipt_digest', 'verdict',
  'lifecycle_disposition', 'blocking_count', 'attempt_index', 'review_epoch',
];
// C16 AuthoringValidationReceipt (R1-01, frozen) — sole freshness evidence for
// an authoring stage's `validated` reading (I20); computed via the shared,
// R0-01-owned spec-authoring-digest.cjs primitive (never reimplemented here).
const C16_FIELDS = ['schema_version', 'requirements', 'design', 'research', 'tasks'];
const C16_STAGE_FIELDS = ['digest', 'validated_at'];
const VALIDATION_21_FIELDS = ['status', 'semantic_review', 'semantic_review_history', 'authoring_validation'];

function usage() {
  console.error('Usage: node .claude/scripts/validate-spec-output.cjs specs/<feature> [--semantic-digest]');
}

function resolveSpecDir(input) {
  if (!input) return null;

  const cwd = process.cwd();
  const direct = path.resolve(cwd, input);
  if (fs.existsSync(direct)) return direct;

  const viaSpecs = path.resolve(cwd, 'specs', input);
  if (fs.existsSync(viaSpecs)) return viaSpecs;

  return direct;
}

function readJson(filePath, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${filePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function isMissingError(error) {
  return error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

function validateSpecRoot(specDir, errors) {
  let rootStat;
  try {
    rootStat = fs.lstatSync(specDir);
  } catch (error) {
    errors.push(`${specDir}: spec directory does not exist (${error.message})`);
    return null;
  }
  if (rootStat.isSymbolicLink()) {
    errors.push(`${specDir}: spec directory cannot be a symlink`);
    return null;
  }
  if (!rootStat.isDirectory()) {
    errors.push(`${specDir}: spec path must be a directory`);
    return null;
  }
  try {
    return fs.realpathSync(specDir);
  } catch (error) {
    errors.push(`${specDir}: spec directory canonicalization failed (${error.message})`);
    return null;
  }
}

function inspectSpecArtifact(specDir, canonicalSpecDir, relativePath, label, errors, { required = false, type = 'file' } = {}) {
  const target = path.resolve(specDir, relativePath);
  if (!isPathInside(specDir, target)) {
    errors.push(`${label}: path must stay inside the spec directory`);
    return null;
  }

  const relative = path.relative(path.resolve(specDir), target);
  let current = path.resolve(specDir);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (isMissingError(error)) {
        if (required) errors.push(`${label}: missing`);
        return null;
      }
      errors.push(`${label}: cannot be inspected (${error.message})`);
      return null;
    }
    if (stat.isSymbolicLink()) {
      errors.push(`${label}: symlink is not allowed (${current})`);
      return null;
    }
  }

  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (isMissingError(error)) {
      if (required) errors.push(`${label}: missing`);
      return null;
    }
    errors.push(`${label}: cannot be inspected (${error.message})`);
    return null;
  }
  const typeMatches = type === 'directory' ? stat.isDirectory() : stat.isFile();
  if (!typeMatches) {
    errors.push(`${label}: must be a regular ${type}`);
    return null;
  }

  let canonicalTarget;
  try {
    canonicalTarget = fs.realpathSync(target);
  } catch (error) {
    errors.push(`${label}: canonicalization failed (${error.message})`);
    return null;
  }
  if (!isPathInside(canonicalSpecDir, canonicalTarget)) {
    errors.push(`${label}: canonical path escapes the spec directory`);
    return null;
  }
  return { path: target, canonicalPath: canonicalTarget, stat };
}

function listTaskFiles(specDir, canonicalSpecDir, errors) {
  const tasks = inspectSpecArtifact(specDir, canonicalSpecDir, 'tasks', 'tasks directory', errors, {
    type: 'directory',
  });
  if (!tasks) return [];

  let entries;
  try {
    entries = fs.readdirSync(tasks.path, { withFileTypes: true });
  } catch (error) {
    errors.push(`tasks directory: cannot be read (${error.message})`);
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const relative = path.join('tasks', entry.name).split(path.sep).join('/');
    const artifact = inspectSpecArtifact(specDir, canonicalSpecDir, relative, relative, errors);
    if (artifact && !entry.name.endsWith('.md')) {
      errors.push(`${relative}: unexpected task artifact; only .md task files are allowed`);
    }
    if (artifact && entry.name.endsWith('.md')) files.push(relative);
  }
  return files.sort();
}

function hasHeading(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+${escaped}\\s*$`, 'm').test(content);
}

function headingCount(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...content.matchAll(new RegExp(`^##\\s+${escaped}\\s*$`, 'gim'))].length;
}

function validateUniqueSectionGroups(label, content, groups, errors) {
  for (const group of groups) {
    const count = group.reduce((total, heading) => total + headingCount(content, heading), 0);
    if (count > 1) {
      errors.push(`${label}: machine-read section ${group.join('/')} must appear at most once`);
    }
  }
}

function extractSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, 'im');
  const match = content.match(re);
  if (!match) return null;
  const start = match.index + match[0].length;
  const after = content.slice(start);
  const next = after.match(/^##\s+/m);
  return next ? after.slice(0, next.index) : after;
}

function semanticMarkdown(content) {
  const withoutComments = String(content).replace(/<!--[\s\S]*?-->/g, '');
  let fence = null;
  return withoutComments.split('\n').map((line) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      const character = marker[1][0];
      const length = marker[1].length;
      if (fence === null) fence = { character, length };
      else if (character === fence.character && length >= fence.length) fence = null;
      return '';
    }
    return fence === null ? line : '';
  }).join('\n');
}

function requirementHeadingDeclarations(requirementsText) {
  const semanticText = semanticMarkdown(requirementsText);
  const declarations = [];
  const invalid = [];
  const headingRe = /^#{2,4}\s+(.+?)\s*$/gm;
  let match;
  while ((match = headingRe.exec(semanticText)) !== null) {
    const heading = match[1].trim();
    const explicit = heading.match(/^Requirement\s+([^\s:.-]+)(?=[:.\s-]|$)/i);
    const prefixed = heading.match(/^((?:R|REQ|NFR|SEC|PERF)[A-Za-z0-9_.-]*\d[A-Za-z0-9_.-]*)(?=[:\s]|$)/i);
    const numeric = heading.match(/^(\d+)(?=[:.\s-]|$)/);
    const bracketed = heading.match(/^\[(R\d+)\](?=[:.\s-]|$)/i);
    let token = null;
    let canonical = null;
    if (explicit) {
      token = explicit[1];
      canonical = /^\d+$/.test(token)
        ? `R${token}`
        : (/^R\d+$/i.test(token) ? token.toUpperCase() : null);
    } else if (prefixed) {
      token = prefixed[1];
      canonical = /^R\d+$/i.test(token) ? token.toUpperCase() : null;
    } else if (numeric) {
      token = numeric[1];
    } else if (bracketed) {
      token = bracketed[1];
    }
    if (canonical) declarations.push({ id: canonical, heading });
    else if (token !== null) invalid.push({ token, heading });
  }
  return { declarations, invalid };
}

function acceptanceCriterionDeclarations(requirementsText) {
  const semanticText = semanticMarkdown(requirementsText);
  const canonical = [];
  const invalid = [];
  const re = /^\s*(?:[-*+]\s+)?\*{0,2}([^\s*]+)\*{0,2}(?:\s*[:—-])?\s+(.+?)\s*$/gm;
  let match;
  while ((match = re.exec(semanticText)) !== null) {
    const token = match[1];
    const looksStructured = /^(?:R|REQ|NFR|SEC|PERF|AC)[A-Za-z0-9_.-]*\d[A-Za-z0-9_.-]*$/i.test(token)
      || /^R\d+[.-][A-Za-z0-9]+$/i.test(token);
    if (!looksStructured) continue;
    if (/^R\d+\.\d+$/i.test(token)) {
      canonical.push({ id: token.toUpperCase(), text: match[2].trim() });
    } else {
      invalid.push({ token, text: match[2].trim() });
    }
  }
  return { canonical, invalid };
}

function validateRequirementInventory(requirementsText, errors) {
  const headings = requirementHeadingDeclarations(requirementsText);
  const criteria = acceptanceCriterionDeclarations(requirementsText);
  for (const declaration of headings.invalid) {
    if (hasSpecPlaceholders(declaration.token)) continue;
    errors.push(
      `requirements.md: unsupported requirement id ${declaration.token} in requirement heading; ` +
      'use Requirement N or RN',
    );
  }
  for (const declaration of criteria.invalid) {
    if (hasSpecPlaceholders(declaration.token)) continue;
    errors.push(
      `requirements.md: unsupported acceptance criterion id ${declaration.token}; use RN.M`,
    );
  }

  const seenRequirements = new Set();
  for (const declaration of headings.declarations) {
    if (seenRequirements.has(declaration.id)) {
      errors.push(`requirements.md: duplicate canonical requirement id ${declaration.id}`);
    }
    seenRequirements.add(declaration.id);
  }
  const seenCriteria = new Set();
  for (const criterion of criteria.canonical) {
    if (seenCriteria.has(criterion.id)) {
      errors.push(`requirements.md: duplicate canonical acceptance criterion id ${criterion.id}`);
    }
    seenCriteria.add(criterion.id);
    const requirementId = criterion.id.split('.')[0];
    if (seenRequirements.size > 0 && !seenRequirements.has(requirementId)) {
      errors.push(`requirements.md: acceptance criterion ${criterion.id} has no matching ${requirementId} heading`);
    }
  }
}

function extractRequirementIds(requirementsText) {
  return [...new Set(requirementHeadingDeclarations(requirementsText).declarations
    .map(({ id }) => id)
    .filter((id) => id !== 'R0'))].sort();
}

function extractAcceptanceCriteria(requirementsText) {
  return acceptanceCriterionDeclarations(requirementsText).canonical;
}

function hasTestableAcceptanceCriterion(requirementsText) {
  const assertion = /\b(?:shall|must|returns?|rejects?|emits?|writes?|persists?|creates?|deletes?|renders?|displays?|records?|exits?|fails?|equals?|contains?|remains?|transitions?)\b/i;
  const observable = /`[^`]+`|\b(?:exit code|http|status|file|path|record|event|response|result|state|field|value|message|artifact|directory|request|output|error)\b|\d/i;
  return extractAcceptanceCriteria(requirementsText).some(({ text }) => (
    text.length >= 24
    && !hasSpecPlaceholders(text)
    && assertion.test(text)
    && observable.test(text)
  ));
}

function hasConcreteDesignBoundary(designText) {
  const sections = [
    'Boundary',
    'Architecture',
    'Components and Interfaces',
    'Canonical Contracts & Invariants',
    'Implementation Boundary',
  ].map((heading) => extractSection(designText, heading)).filter(Boolean);
  const boundary = sections.join('\n');
  if (boundary.length < 24 || hasSpecPlaceholders(boundary)) return false;
  const genericIdentifiers = new Set([
    'module', 'service', 'component', 'entrypoint', 'interface', 'function',
    'class', 'route', 'command', 'database', 'table', 'process', 'boundary', 'owner',
  ]);
  const fencedReferences = [...boundary.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1].trim())
    .filter((reference) => (
      reference.length >= 3
      && !genericIdentifiers.has(reference.toLowerCase())
      && (/[/\\.]/.test(reference) || /^[A-Za-z_$][A-Za-z0-9_$.:-]*$/.test(reference))
    ));
  const pathReference = /(?:^|\s)(?:src|packages|apps|lib|cmd|internal|tests?|\.claude|\.codex)\/[A-Za-z0-9_.\/-]+/im.test(boundary);
  const ownedBehavior = /\b(?:owns?|reads?|writes?|calls?|invokes?|imports?|registers?|routes?|persists?|updates?|creates?|deletes?|validates?|returns?|emits?|handles?|maps?|touches?|modifies?|implements?|consumes?|produces?)\b/i.test(boundary);
  return ownedBehavior && (fencedReferences.length > 0 || pathReference);
}

function taskFormat(content) {
  const conciseHeadings = [
    'Outcome', 'Scope and Typed Anchors', 'Changes', 'Acceptance', 'Dependencies',
    'Verification Plan',
  ];
  return conciseHeadings.some((heading) => hasHeading(content, heading)) ? 'v2' : 'legacy';
}

function sectionFieldValues(section, labels) {
  return evidenceFieldValues(section || '', labels);
}

function validateVerificationPlan(taskPath, content, errors) {
  const section = extractSection(content, 'Verification Plan') || '';
  const commands = sectionFieldValues(section, ['Command', 'Commands', 'Command(s)']);
  if (!commands.some((value) => isExecutableCommand(value) || isJustifiedNotApplicable(value))) {
    errors.push(`${taskPath}: Verification Plan requires a command-shaped invocation or justified N/A`);
  }
  if (!sectionFieldValues(section, ['Expected', 'Expected result', 'Expected proof']).some(hasObservableProof)) {
    errors.push(`${taskPath}: Verification Plan requires an observable Expected result`);
  }
  const negative = sectionFieldValues(section, ['Negative path', 'Negative-path']);
  if (!negative.some((value) => meaningfulMarkdownLines(value).length > 0 || isJustifiedNotApplicable(value))) {
    errors.push(`${taskPath}: Verification Plan requires a negative-path disposition`);
  }
  const reachability = sectionFieldValues(section, ['Reachability']);
  if (!reachability.some((value) => isConcreteReachabilityAnchor(value) || isJustifiedNotApplicable(value))) {
    errors.push(`${taskPath}: Verification Plan requires a concrete reachability target or justified N/A`);
  }
  if (/^\s*(?:[-*+]\s*)?(?:\*\*)?(?:Observed|Actual|Verdict|Verification)(?:\*\*)?\s*:/im.test(section)
    || /^\s*(?:Base|Head)\s*:/im.test(section)
    || /\b(?:PASS|PASS_WITH_WARNINGS|FAIL|BLOCKED)\b/.test(section)) {
    errors.push(`${taskPath}: Verification Plan is planned proof only and must not contain execution receipt fields or verdicts`);
  }
}

/**
 * Extract sub-criteria IDs (e.g. R3.4) only from canonical criterion declaration
 * positions. Incidental prose such as "see R7.2" is not an inventory entry.
 */
function extractSubCriteriaIds(requirementsText) {
  return [...new Set(extractAcceptanceCriteria(requirementsText)
    .map(({ id }) => id)
    .filter((id) => !id.startsWith('R0.')))].sort();
}

function meaningfulMarkdownLines(section) {
  if (typeof section !== 'string') return [];
  return section.split('\n').map((rawLine) => rawLine
    .trim()
    .replace(/^[-*+]\s*/, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/\*\*/g, '')
    .trim())
    .filter((line) => (
      line.length >= 8
      && !/^\|?\s*:?-{3,}/.test(line)
      && !hasSpecPlaceholders(line)
    ));
}

function hasSubstantiveSection(content, headings) {
  const section = headings.map((heading) => extractSection(content, heading)).find((value) => value !== null);
  return meaningfulMarkdownLines(section).length > 0;
}

function hasActionableTaskStep(section) {
  if (typeof section !== 'string') return false;
  return section.split('\n').some((line) => {
    const match = line.match(/^\s*[-*+]\s+\[[ xX]\]\s+(?:\d+(?:\.\d+)?\s+)?(?:\(P\)\s+)?(.+?)\s*$/i);
    if (!match) return false;
    const action = match[1].replace(/\*\*/g, '').trim();
    return action.length >= 4
      && !hasSpecPlaceholders(action)
      && !/^_?Requirements?\s*:/i.test(action);
  });
}

function hasSubstantiveTaskRequirement(section) {
  return meaningfulMarkdownLines(section).some((line) => {
    if (/^_?Requirements?\s*:/i.test(line)) return false;
    const match = line.match(/^(?:R)?\d+(?:\.\d+)?\s*(?:[-—:]\s*)?(.+)$/i);
    return Boolean(match && match[1].trim().length >= 4 && !hasSpecPlaceholders(match[1]));
  });
}

function evidenceFieldValues(section, labels) {
  const alternation = labels
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const re = new RegExp(
    `^\\s*(?:[-*+]\\s*)?(?:\\*\\*)?(?:${alternation})(?:\\*\\*)?\\s*:\\s*(.*?)\\s*$`,
    'gim',
  );
  return [...section.matchAll(re)].map((match) => match[1].trim());
}

function isJustifiedNotApplicable(value) {
  const match = typeof value === 'string' && value.match(/^N\/A\s*(?:[-—:]\s*)(.+)$/i);
  return Boolean(match && match[1].trim().length >= 12 && !hasSpecPlaceholders(match[1]));
}

function isExecutableCommand(value) {
  // Static validation can prove command shape only. Project command/script
  // existence is runtime evidence owned by the execution receipt; resolving it
  // here would require forbidden project inspection or command execution.
  if (typeof value !== 'string' || hasSpecPlaceholders(value)) return false;
  const fenced = [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
  const candidates = fenced.length > 0 ? fenced : [value.trim()];
  return candidates.some((command) => {
    if (command.length < 4 || /^(?:run|execute|verify|check)\s+(?:tests?|checks?|build)$/i.test(command)) return false;
    const first = command.split(/\s+/)[0];
    if (!/^(?:[A-Za-z0-9_@.-]+|\.\.?\/[A-Za-z0-9_./-]+)$/.test(first)) return false;
    return command.includes(' ')
      || /[/.]/.test(first)
      || /^(?:make|pytest|jest|vitest)$/i.test(first);
  });
}

function hasObservableProof(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length >= 12
    && !hasSpecPlaceholders(text)
    && /`[^`]+`|(?:^|\s)(?:src|packages|apps|lib|cmd|internal|tests?)\/|\b(?:exit(?:\s+code)?|status|error|output|result|artifact|route|record|state|field|value|response|file|path|persisted|rendered|registered|imported|mounted|invoked)\b|\d/i.test(text);
}

function hasObservableCompletionCriterion(section) {
  return meaningfulMarkdownLines(section).some((line) => (
    line.length >= 16
    && /\b(?:returns?|rejects?|writes?|persists?|creates?|deletes?|renders?|displays?|records?|exits?|fails?|equals?|contains?|remains?|transitions?|is imported|is mounted|is registered|is invoked)\b/i.test(line)
    && /`[^`]+`|(?:^|\s)(?:src|packages|apps|lib|cmd|internal|tests?)\/|\b(?:exit(?:\s+code)?|status|error|output|result|artifact|route|record|state|field|value|response|file|path|caller|component|service|command)\b|\d/i.test(line)
  ));
}

function isConcreteReachabilityAnchor(value) {
  if (typeof value !== 'string') return false;
  const anchor = value.replace(/`/g, '').trim();
  return anchor.length >= 3
    && !hasSpecPlaceholders(anchor)
    && !/^(?:N\/A|none|unknown|pending)$/i.test(anchor)
    && (/[/\\.]/.test(anchor) || /^[A-Za-z_$][A-Za-z0-9_$:-]*(?:\s+[A-Za-z0-9_./:-]+)*$/.test(anchor));
}

function validateTaskSections(taskPath, content, errors) {
  if (taskFormat(content) === 'v2') {
    const headings = [
      'Outcome', 'Scope and Typed Anchors', 'Changes', 'Acceptance', 'Dependencies',
      'Verification Plan',
    ];
    validateUniqueSectionGroups(taskPath, content, headings.map((heading) => [heading]), errors);
    for (const heading of headings) {
      if (!hasHeading(content, heading)) errors.push(`${taskPath}: missing ${heading}`);
      else if (heading !== 'Dependencies' && !hasSubstantiveSection(content, [heading])) errors.push(`${taskPath}: ${heading} must be substantive`);
    }
    const changes = extractSection(content, 'Changes') || '';
    if (!hasActionableTaskStep(changes)) {
      errors.push(`${taskPath}: Changes must contain at least one substantive actionable checkbox`);
    }
    const acceptance = extractSection(content, 'Acceptance') || '';
    if (!/\bR?\d+\.\d+\b/.test(acceptance)) {
      errors.push(`${taskPath}: Acceptance must map at least one canonical RN.M criterion`);
    }
    validateVerificationPlan(taskPath, content, errors);
    return;
  }
  validateUniqueSectionGroups(taskPath, content, [
    ['Context'],
    ['Constraints'],
    ['Steps', 'Implementation Steps'],
    ['Requirements'],
    ['Related Files'],
    ['Completion Criteria'],
    ['Evidence', 'Task Test Plan & Verification Evidence', 'Verification & Evidence'],
    ['Risk Assessment'],
    ['Execution Closure'],
  ], errors);
  const hasContext = hasHeading(content, 'Context');
  const hasConstraints = hasHeading(content, 'Constraints');
  const hasSteps =
    hasHeading(content, 'Steps') || hasHeading(content, 'Implementation Steps');
  const hasRequirements =
    hasHeading(content, 'Requirements') || /_Requirements:\s*[^_\n]+_/i.test(content);
  const hasRelatedFiles = hasHeading(content, 'Related Files');
  const hasCompletionCriteria = hasHeading(content, 'Completion Criteria');
  // legacy heading aliases: read-compat only, no longer advertised
  const hasEvidence =
    hasHeading(content, 'Evidence') ||
    hasHeading(content, 'Task Test Plan & Verification Evidence') ||
    hasHeading(content, 'Verification & Evidence');
  const hasRiskAssessment = hasHeading(content, 'Risk Assessment');
  const stepsSection = extractSection(content, 'Steps')
    || extractSection(content, 'Implementation Steps')
    || '';
  const requirementsSection = extractSection(content, 'Requirements') || '';

  if (!hasContext) errors.push(`${taskPath}: missing Context`);
  else if (!hasSubstantiveSection(content, ['Context'])) errors.push(`${taskPath}: Context section must contain substantive task context`);
  if (!hasConstraints) errors.push(`${taskPath}: missing Constraints`);
  else if (!hasSubstantiveSection(content, ['Constraints'])) errors.push(`${taskPath}: Constraints section must contain substantive scope or implementation constraints`);
  if (!hasSteps) errors.push(`${taskPath}: missing Steps/Implementation Steps`);
  else if (!hasActionableTaskStep(stepsSection)) errors.push(`${taskPath}: Steps must contain at least one substantive actionable checkbox`);
  if (!hasRequirements) errors.push(`${taskPath}: missing Requirements mapping`);
  else if (!hasSubstantiveTaskRequirement(requirementsSection)) errors.push(`${taskPath}: Requirements section must contain a substantive mapped requirement description`);
  if (!hasRelatedFiles) errors.push(`${taskPath}: missing Related Files`);
  else if (relatedFilesSection(content).rows.length === 0) errors.push(`${taskPath}: Related Files section must not be empty`);
  if (!hasCompletionCriteria) errors.push(`${taskPath}: missing Completion Criteria`);
  else {
    const completion = extractSection(content, 'Completion Criteria') || '';
    if (!hasObservableCompletionCriterion(completion)) {
      errors.push(`${taskPath}: Completion Criteria must contain at least one observable, testable outcome`);
    }
  }
  if (!hasEvidence) errors.push(`${taskPath}: missing Evidence or task test plan`);
  if (!hasRiskAssessment) errors.push(`${taskPath}: missing Risk Assessment`);
  if (hasEvidence) {
    const evidenceSection = extractSection(content, 'Evidence')
      || extractSection(content, 'Task Test Plan & Verification Evidence')
      || extractSection(content, 'Verification & Evidence')
      || '';
    const commandValues = evidenceFieldValues(evidenceSection, ['Command', 'Commands', 'Command(s)']);
    if (!commandValues.some((value) => isExecutableCommand(value) || isJustifiedNotApplicable(value))) {
      errors.push(`${taskPath}: Evidence requires an executable Command(s) value or explicit justified N/A`);
    }
    const expectedValues = evidenceFieldValues(evidenceSection, ['Expected proof', 'Expected result', 'Expected', 'Expect']);
    if (!expectedValues.some(hasObservableProof)) {
      errors.push(`${taskPath}: Evidence requires an observable expected result`);
    }
    const artifactValues = evidenceFieldValues(
      evidenceSection,
      ['Inspect', 'Artifact/runtime proof', 'Artifact / runtime proof', 'Artifact proof', 'Runtime proof'],
    );
    if (!artifactValues.some((value) => isConcreteReachabilityAnchor(value) || hasObservableProof(value))) {
      errors.push(`${taskPath}: Evidence requires concrete artifact or runtime proof`);
    }
    if (!/Runtime reachability verification/i.test(evidenceSection)) {
      errors.push(`${taskPath}: missing Runtime reachability verification`);
    } else {
      const anchorValues = evidenceFieldValues(evidenceSection, ['Entrypoint/caller', 'Anchor']);
      const concreteAnchors = anchorValues.filter(isConcreteReachabilityAnchor);
      if (concreteAnchors.length === 0) {
        errors.push(`${taskPath}: Runtime reachability verification must reference a concrete file path or anchor (e.g. \`src/...\` or Entrypoint/caller)`);
      } else {
        // Cross-check against declared Related Files paths
        const relatedPaths = new Set(relatedFilesSection(content).rows.map((r) => r.path));
        const referencedPaths = concreteAnchors
          .map((anchor) => anchor.replace(/`/g, '').replace(/^\.\//, ''))
          .filter((anchor) => /[/\\.]|^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(anchor));
        // At least one referenced path should correspond to a declared Related Files entry (or be clearly external)
        if (referencedPaths.length > 0 && relatedPaths.size > 0) {
          const overlaps = referencedPaths.some((p) => [...relatedPaths].some((rp) => p === rp || p.endsWith(rp) || rp.endsWith(p) || p.includes(rp.split('/').pop())));
          if (!overlaps && !/\b(?:external|later integration task)\b/i.test(evidenceSection)) {
            errors.push(`${taskPath}: Runtime reachability verification references no Related Files path — must anchor to a declared file`);
          }
        }
      }
    }
  }
}

function taskDeclaresParallel(content, taskPath, errors) {
  const steps = extractSection(content, 'Changes')
    || extractSection(content, 'Steps')
    || extractSection(content, 'Implementation Steps')
    || '';
  const actionable = steps.split('\n').filter((line) => /^\s*[-*+]\s+\[[ xX]\]\s+/i.test(line));
  const markedIndexes = [];
  actionable.forEach((line, index) => {
    if (/\(P\)/i.test(line)) markedIndexes.push(index);
  });
  if (markedIndexes.length > 1) {
    errors.push(`${taskPath}: task-level (P) marker must appear exactly once`);
  }
  if (markedIndexes.some((index) => index !== 0)) {
    errors.push(`${taskPath}: task-level (P) marker must be on the first actionable Steps checkbox`);
  }
  if (markedIndexes.length > 0
    && !/^\s*[-*+]\s+\[[ xX]\]\s+(?:\d+(?:\.\d+)?\s+)?\(P\)\s+\S/i.test(actionable[markedIndexes[0]])) {
    errors.push(`${taskPath}: (P) must follow the optional step number on an actionable checkbox`);
  }
  return markedIndexes.length > 0;
}

/**
 * Task files are usually created from the scaffold template, so a task can start as
 * a stub full of `{{...}}` placeholders, and nothing guarantees the model FILLED it.
 * An unfilled `{{...}}` is an incomplete task — SKILL.md: "Leave NO {{...}} placeholder ... fails DoCT" —
 * so it is a hard error here. A `.../` path fragment is a not-yet-resolved path
 * placeholder; it is only a warning, because it usually survives in prose Steps
 * while the Related Files table (which spec-ground.cjs does verify) is already
 * concrete. Matching `\.\.\.\/` (three dots + slash) avoids flagging a relative
 * `../` path or a prose ellipsis.
 */
function validateTaskPlaceholders(taskPath, content, errors, warnings) {
  const stub = content.match(/\{\{[^}\n]+\}\}/);
  if (stub) {
    errors.push(`${taskPath}: unfilled scaffold placeholder ${stub[0]} — task stub was not completed`);
  }
  const bracket = content.match(SPEC_BRACKET_PLACEHOLDER_RE);
  if (bracket) {
    errors.push(`${taskPath}: unresolved square-bracket placeholder ${bracket[0]}`);
  }
  if (/\.\.\.\//.test(content)) {
    warnings.push(`${taskPath}: contains a '.../' path placeholder — replace with a concrete path`);
  }
}

function markdownHeaders(content, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...content.matchAll(new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.*?)\\s*$`, 'gim'))]
    .map((match) => match[1].trim());
}

function expectedTaskId(taskPath) {
  return taskPath.match(TASK_IDENTITY_RE)?.[1] || null;
}

function validateTaskIdentity(taskPath, content, entry, errors) {
  const expected = expectedTaskId(taskPath);
  if (!expected) return;
  if (entry?.id !== expected) {
    errors.push(`${taskPath}: task_registry id must match path-derived id ${expected} (got ${String(entry?.id)})`);
  }
  const headings = [...content.matchAll(/^#\s+Task\s+(R\d+-\d{2})\s*:/gim)].map((match) => match[1].toUpperCase());
  if (headings.length !== 1) {
    errors.push(`${taskPath}: canonical task heading must appear exactly once`);
  } else if (headings[0] !== expected) {
    errors.push(`${taskPath}: Markdown heading id ${headings[0]} must match path-derived id ${expected}`);
  }
}

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function validateTaskLifecycle(taskPath, entry, errors) {
  if (!isPlainObject(entry) || !TASK_STATUS_VALUES.has(entry.status)) return;
  const label = `spec.json.task_registry.${taskPath}`;
  const blocker = entry.blocker;
  if (blocker !== null && (typeof blocker !== 'string' || blocker.trim() === '')) {
    errors.push(`${label}.blocker: must be null or a non-empty string`);
  }
  for (const field of ['started_at', 'completed_at', 'last_updated_at']) {
    if (entry[field] !== null && !isIsoTimestamp(entry[field])) {
      errors.push(`${label}.${field}: must be null or an ISO 8601 timestamp`);
    }
  }

  if (entry.status === 'pending') {
    if (blocker !== null) errors.push(`${label}: pending status requires blocker null`);
    if (entry.started_at !== null || entry.completed_at !== null) {
      errors.push(`${label}: pending status requires started_at and completed_at null`);
    }
  } else if (entry.status === 'in_progress') {
    if (blocker !== null) errors.push(`${label}: in_progress status requires blocker null`);
    if (!isIsoTimestamp(entry.started_at) || !isIsoTimestamp(entry.last_updated_at)) {
      errors.push(`${label}: in_progress status requires started_at and last_updated_at timestamps`);
    } else if (Date.parse(entry.last_updated_at) < Date.parse(entry.started_at)) {
      errors.push(`${label}: in_progress timestamps must satisfy started_at <= last_updated_at`);
    }
    if (entry.completed_at !== null) errors.push(`${label}: in_progress status requires completed_at null`);
  } else if (entry.status === 'blocked') {
    if (typeof blocker !== 'string' || blocker.trim() === '') {
      errors.push(`${label}: blocked status requires a non-empty blocker`);
    }
    if (!isIsoTimestamp(entry.last_updated_at)) {
      errors.push(`${label}: blocked status requires last_updated_at timestamp`);
    } else if (isIsoTimestamp(entry.started_at)
      && Date.parse(entry.last_updated_at) < Date.parse(entry.started_at)) {
      errors.push(`${label}: started blocked timestamps must satisfy started_at <= last_updated_at`);
    }
    if (entry.completed_at !== null) errors.push(`${label}: blocked status requires completed_at null`);
  } else if (entry.status === 'done') {
    if (blocker !== null) errors.push(`${label}: done status requires blocker null`);
    if (![entry.started_at, entry.completed_at, entry.last_updated_at].every(isIsoTimestamp)) {
      errors.push(`${label}: done status requires started_at, completed_at, and last_updated_at timestamps`);
    } else if (
      Date.parse(entry.completed_at) < Date.parse(entry.started_at)
      || Date.parse(entry.last_updated_at) < Date.parse(entry.completed_at)
    ) {
      errors.push(`${label}: done timestamps must satisfy started_at <= completed_at <= last_updated_at`);
    }
  }
}

function validateTaskDependencyHeader(taskPath, content, entry, specReady, errors) {
  const registryDependencies = Array.isArray(entry?.dependencies) ? entry.dependencies : [];
  const headers = markdownHeaders(content, 'Dependencies');
  if (headers.length > 1) {
    errors.push(`${taskPath}: Dependencies header must appear exactly once`);
  }
  let raw = headers[0];
  if (taskFormat(content) === 'v2') {
    const section = extractSection(content, 'Dependencies') || '';
    const values = section.split('\n')
      .map((line) => line.trim().replace(/^[-*+]\s*/, '').replace(/^`|`$/g, '').trim())
      .filter(Boolean);
    raw = values.length === 1 && /^(?:none|n\/a)$/i.test(values[0])
      ? values[0]
      : values.join(',');
  }
  if (raw === undefined) {
    if (registryDependencies.length > 0 || specReady) {
      errors.push(`${taskPath}: missing Dependencies header; required for dependency parity before readiness`);
    }
    return;
  }

  let markdownDependencies = [];
  if (!/^(?:none|n\/a)$/i.test(raw)) {
    markdownDependencies = raw.split(',').map((dependency) => dependency.trim().replace(/^`|`$/g, ''));
    const seen = new Set();
    for (const dependency of markdownDependencies) {
      if (!TASK_PATH_RE.test(dependency)) {
        errors.push(`${taskPath}: Dependencies header contains invalid task path ${dependency || '(empty)'}`);
      } else if (dependency === taskPath) {
        errors.push(`${taskPath}: Dependencies header cannot contain itself`);
      } else if (seen.has(dependency)) {
        errors.push(`${taskPath}: Dependencies header contains duplicate dependency ${dependency}`);
      }
      seen.add(dependency);
    }
  }

  const registrySorted = [...registryDependencies].sort();
  const markdownSorted = [...markdownDependencies].sort();
  if (JSON.stringify(registrySorted) !== JSON.stringify(markdownSorted)) {
    errors.push(
      `${taskPath}: dependency drift between spec.json task_registry ${JSON.stringify(registrySorted)} ` +
      `and Markdown Dependencies header ${JSON.stringify(markdownSorted)}`,
    );
  }
}

function validateTaskStatusHeader(taskPath, content, entry, specReady, errors) {
  const headers = markdownHeaders(content, 'Status');
  if (headers.length > 1) {
    errors.push(`${taskPath}: Status header must appear exactly once`);
  }
  const status = headers[0];
  if (status === undefined) {
    errors.push(`${taskPath}: missing Status header required for registry parity`);
    return;
  }
  if (!TASK_STATUS_VALUES.has(status)) {
    errors.push(`${taskPath}: Status must be one of ${[...TASK_STATUS_VALUES].join(', ')} (got ${status})`);
  }
  if (specReady && status === 'blocked') {
    errors.push(`${taskPath}: Status cannot be blocked while ready_for_implementation is true`);
  }
  if (typeof entry?.status === 'string' && status !== entry.status) {
    errors.push(
      `${taskPath}: status drift between spec.json task_registry ${entry.status} ` +
      `and Markdown Status header ${status}`,
    );
  }
}

/**
 * Each phase completion must carry its own timestamp. Reusing `timestamps.init`
 * for a later phase is forbidden (SKILL.md spec.json Update Rules). This used to
 * be a prompt-only rule the model had to remember; here it is a hard backstop.
 */
function validateTimestamps(spec, errors) {
  const ts = spec.timestamps;
  for (const field of ['created_at', 'updated_at']) {
    if (Object.prototype.hasOwnProperty.call(spec, field) && !isIsoTimestamp(spec[field])) {
      errors.push(`spec.json.${field}: must be an ISO 8601 timestamp`);
    }
  }
  if (ts === undefined) return;
  if (!isPlainObject(ts)) {
    errors.push('spec.json.timestamps: must be an object when present');
    return;
  }
  for (const [field, value] of Object.entries(ts)) {
    if (value !== null && !isIsoTimestamp(value)) {
      errors.push(`spec.json.timestamps.${field}: must be null or an ISO 8601 timestamp`);
    }
  }
  const init = ts.init;
  if (!isIsoTimestamp(init)) return;

  for (const phase of ['requirements_done', 'design_done', 'tasks_done']) {
    if (ts[phase] && ts[phase] === init) {
      errors.push(
        `spec.json.timestamps.${phase}: reuses init timestamp (${init}); ` +
          'each phase must stamp its own completion time',
      );
    }
  }
}

function validateFinalLifecycleTimestamps(spec, taskFiles, context, errors) {
  if (spec.ready_for_implementation !== true) return;
  const ts = isPlainObject(spec.timestamps) ? spec.timestamps : {};
  const required = ['init', 'requirements_done', 'design_done', 'validation_done'];
  if (taskFiles.length > 0) required.push('tasks_done');
  if (explicitResearchPath(spec) === 'research.md') required.push('research_done');
  for (const field of required) {
    if (!isIsoTimestamp(ts[field])) {
      errors.push(`spec.json.timestamps.${field}: ready handoff requires an ISO 8601 timestamp`);
    }
  }
  for (const field of ['created_at', 'updated_at']) {
    if (!isIsoTimestamp(spec[field])) {
      errors.push(`spec.json.${field}: ready handoff requires an ISO 8601 timestamp`);
    }
  }

  if (![spec.created_at, ts.init, ts.requirements_done, ts.design_done, ts.validation_done, spec.updated_at]
    .every(isIsoTimestamp)) return;
  const ordered = [
    ['created_at', spec.created_at],
    ['timestamps.init', ts.init],
    ['timestamps.requirements_done', ts.requirements_done],
    ...(isIsoTimestamp(ts.research_done) ? [['timestamps.research_done', ts.research_done]] : []),
    ['timestamps.design_done', ts.design_done],
    ...(isIsoTimestamp(ts.tasks_done) ? [['timestamps.tasks_done', ts.tasks_done]] : []),
    ...(isIsoTimestamp(ts.review_done) ? [['timestamps.review_done', ts.review_done]] : []),
    ['timestamps.validation_done', ts.validation_done],
  ];
  for (let index = 1; index < ordered.length; index += 1) {
    if (Date.parse(ordered[index][1]) < Date.parse(ordered[index - 1][1])) {
      errors.push(
        `spec.json final lifecycle timestamps must be ordered; ${ordered[index][0]} precedes ${ordered[index - 1][0]}`,
      );
    }
  }
  if (Date.parse(spec.updated_at) !== Date.parse(ts.validation_done)) {
    errors.push('spec.json.updated_at must describe the same final state as timestamps.validation_done');
  }
  const lastValidatedAt = spec.validation?.last_validated_at;
  if (lastValidatedAt !== undefined && lastValidatedAt !== null) {
    if (!isIsoTimestamp(lastValidatedAt)) {
      errors.push('spec.json.validation.last_validated_at: must be null or an ISO 8601 timestamp');
    } else if (Date.parse(lastValidatedAt) !== Date.parse(ts.validation_done)) {
      errors.push('spec.json.validation.last_validated_at must describe the same final state as timestamps.validation_done');
    }
  }
}

/** Normalize a fenced code block body for byte-comparison: trim + collapse
 * trailing whitespace per line + drop blank edges. Keeps inner structure so a
 * real field rename (user_name vs userName) still differs. */
function normalizeBlock(body) {
  return body
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

/**
 * Parse canonical contract definitions from design.md. A definition is an HTML
 * marker `<!-- contract:NAME -->` immediately followed by a fenced code block.
 * Returns a Map<name, normalizedBody>. Empty when the spec uses no markers —
 * which makes the whole cross-layer check opt-in (no effect on legacy specs).
 */
function extractContractDefs(designText, label, errors) {
  const defs = new Map();
  const re = /<!--\s*contract:([A-Za-z0-9_.-]+)\s*-->\s*\n```[^\n]*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = re.exec(designText)) !== null) {
    if (defs.has(match[1])) {
      errors.push(`${label}: duplicate canonical contract definition "${match[1]}"`);
      continue;
    }
    defs.set(match[1], normalizeBlock(match[2]));
  }
  return defs;
}

/**
 * From a task body, return the contracts it claims plus its local contract
 * copies. Shape: { names: string[], blocks: Map<name, string>, firstBlock: string|null }
 * `names` come from a `Contracts: A, B` line. `blocks` maps every
 * `<!-- contract:NAME -->` marker in the task to its fenced block, so a task
 * carrying multiple contracts has EACH copy verified (not just the first).
 * `firstBlock` keeps the legacy fallback for single-contract tasks that copy
 * the block without repeating the marker.
 */
function extractTaskContracts(taskText, taskPath, errors) {
  const names = [];
  const nameLines = [...taskText.matchAll(/^\s*Contracts:\s*([^\n]+)$/gim)];
  if (nameLines.length > 1) {
    errors.push(`${taskPath}: Contracts declaration must appear at most once`);
  }
  const seenNames = new Set();
  for (const nameLine of nameLines) {
    for (const token of nameLine[1].split(',')) {
      const name = token.trim();
      if (!name) continue;
      if (seenNames.has(name)) {
        errors.push(`${taskPath}: Contracts declaration contains duplicate name "${name}"`);
        continue;
      }
      seenNames.add(name);
      names.push(name);
    }
  }
  const blocks = extractContractDefs(taskText, taskPath, errors); // same marker+fence grammar as design.md
  const blockMatch = taskText.match(/```[^\n]*\n([\s\S]*?)\n```/);
  const firstBlock = blockMatch ? normalizeBlock(blockMatch[1]) : null;
  return { names, blocks, firstBlock };
}

function implementationObligationClosure(content, label, errors) {
  const allIds = [];
  const re = /<!--\s*implementation-obligation:([a-z0-9]+(?:[._-][a-z0-9]+)*)\s*-->/gi;
  let match;
  while ((match = re.exec(content)) !== null) {
    allIds.push(match[1].toLowerCase());
  }
  const counts = new Map();
  for (const id of allIds) counts.set(id, (counts.get(id) || 0) + 1);
  for (const [id, count] of counts) {
    if (count > 1) errors.push(`${label}: duplicate implementation obligation marker ${id}`);
  }

  const closureCount = headingCount(content, 'Execution Closure');
  const section = closureCount === 1 ? (extractSection(content, 'Execution Closure') || '') : '';
  const closureIds = [];
  const blocks = new Map();
  const closureRe = /<!--\s*implementation-obligation:([a-z0-9]+(?:[._-][a-z0-9]+)*)\s*-->/gi;
  const markers = [...section.matchAll(closureRe)];
  for (const [index, marker] of markers.entries()) {
    const id = marker[1].toLowerCase();
    closureIds.push(id);
    const blockStart = marker.index + marker[0].length;
    const blockEnd = markers[index + 1]?.index ?? section.length;
    if (!blocks.has(id)) blocks.set(id, section.slice(blockStart, blockEnd).trim());
  }
  if (allIds.length > 0 && closureCount !== 1) {
    errors.push(`${label}: implementation obligation markers require exactly one Execution Closure section`);
  } else if (allIds.length > closureIds.length) {
    const closureCounts = new Map();
    for (const id of closureIds) closureCounts.set(id, (closureCounts.get(id) || 0) + 1);
    for (const [id, count] of counts) {
      if ((closureCounts.get(id) || 0) < count) {
        errors.push(`${label}: implementation obligation marker ${id} must be inside Execution Closure`);
      }
    }
  }
  const notApplicable = closureCount === 1
    && closureIds.length === 0
    && isJustifiedNotApplicable(section.trim());
  return {
    ids: [...new Set(closureIds)],
    section,
    headingCount: closureCount,
    blocks,
    notApplicable,
  };
}

const RELATED_FILE_ACTIONS = new Set(['create', 'modify', 'delete', 'read']);

function relatedFilesSection(content) {
  const lines = content.split('\n');
  const headingIndex = lines.findIndex((line) => /^##+\s+Related Files\s*$/i.test(line));
  if (headingIndex < 0) return { present: false, rows: [] };
  const rows = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##+\s+/.test(line)) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    const filePath = (cells[1] || '').replace(/`/g, '').trim();
    const action = (cells[2] || '').replace(/`/g, '').trim().toLowerCase();
    if (!filePath || filePath.toLowerCase() === 'path' || /^-+$/.test(filePath)) continue;
    rows.push({ path: filePath, action });
  }
  return { present: true, rows };
}

function unsafeRelatedPath(filePath) {
  return path.isAbsolute(filePath)
    || /^[A-Za-z]:[\\/]/.test(filePath)
    || filePath.split(/[\\/]+/).includes('..');
}

function validateRelatedFiles(taskPath, content, errors) {
  const section = relatedFilesSection(content);
  if (!section.present || section.rows.length === 0) return;
  for (const row of section.rows) {
    if (!RELATED_FILE_ACTIONS.has(row.action)) {
      errors.push(`${taskPath}: unsupported Related Files action "${row.action}" for ${row.path}`);
    }
    if (unsafeRelatedPath(row.path)) {
      errors.push(`${taskPath}: Related Files path must be relative and stay within work root: ${row.path}`);
    }
  }
}

function parseMarkdownTable(section, expectedHeaders) {
  if (typeof section !== 'string') return [];
  const lines = section.split('\n');
  for (let index = 0; index + 1 < lines.length; index += 1) {
    if (!/^\s*\|/.test(lines[index]) || !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1])) continue;
    const headers = lines[index].split('|').slice(1, -1).map((cell) => cell.trim().toLowerCase());
    if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders.map((header) => header.toLowerCase()))) continue;
    const rows = [];
    for (let rowIndex = index + 2; rowIndex < lines.length && /^\s*\|/.test(lines[rowIndex]); rowIndex += 1) {
      const cells = lines[rowIndex].split('|').slice(1, -1)
        .map((cell) => cell.trim().replace(/^`|`$/g, '').trim());
      if (cells.some(Boolean)) rows.push(cells);
    }
    return rows;
  }
  return [];
}

function typedAnchors(content, label, namespace, errors) {
  const section = extractSection(content, namespace === 'design' ? 'Typed Anchors' : 'Scope and Typed Anchors') || '';
  const rows = parseMarkdownTable(section, ['ID', 'Type', 'Target', 'Role']);
  if (rows.length === 0) {
    const consumesDesign = namespace === 'task'
      && sectionFieldValues(section, ['Canonical design anchors consumed']).join(' ').match(/\bA-D-\d{2}\b/);
    if (!consumesDesign) errors.push(`${label}: typed anchor table ID/Type/Target/Role is required unless the task only consumes canonical design anchors`);
    return [];
  }
  const taskId = namespace === 'task' ? expectedTaskId(label) : null;
  const namespacePattern = namespace === 'design'
    ? /^A-D-\d{2}$/
    : new RegExp(`^A-${taskId || 'INVALID'}-\\d{2}$`);
  return rows.map(([id = '', rawType = '', target = '', role = '']) => {
    const type = rawType.toLowerCase();
    if (!ANCHOR_TYPES.has(type)) {
      errors.push(`${label}: typed anchor ${id || '(missing id)'} has unknown Type ${rawType || '(empty)'}`);
    }
    if (!namespacePattern.test(id)) {
      errors.push(`${label}: typed anchor ${id || '(missing id)'} has invalid ${namespace} namespace`);
    }
    if (!target || hasSpecPlaceholders(target)) {
      errors.push(`${label}: typed anchor ${id || '(missing id)'} requires a concrete Target`);
    }
    if (!role || hasSpecPlaceholders(role)) {
      errors.push(`${label}: typed anchor ${id || '(missing id)'} requires a concrete Role`);
    }
    return { id, type, target, role, label, namespace };
  });
}

function validateTypedAnchorInventory(designText, taskContents, errors) {
  const designAnchors = typedAnchors(designText, 'design.md', 'design', errors);
  const allAnchors = [...designAnchors];
  for (const [taskPath, content] of taskContents) {
    if (taskFormat(content) === 'v2') allAnchors.push(...typedAnchors(content, taskPath, 'task', errors));
  }
  const byId = new Map();
  const designByTarget = new Map(designAnchors.map((anchor) => [`${anchor.type}\0${anchor.target}`, anchor]));
  for (const anchor of allAnchors) {
    if (byId.has(anchor.id)) {
      errors.push(`${anchor.label}: duplicate typed anchor ID ${anchor.id}; first declared in ${byId.get(anchor.id).label}`);
    } else byId.set(anchor.id, anchor);
    if (anchor.namespace === 'task') {
      const canonical = designByTarget.get(`${anchor.type}\0${anchor.target}`);
      if (canonical) {
        errors.push(`${anchor.label}: typed anchor ${anchor.id} duplicates canonical design target ${canonical.id}; reference the design anchor ID instead`);
      }
    }
  }
  for (const [taskPath, content] of taskContents) {
    if (taskFormat(content) !== 'v2') continue;
    for (const reference of content.match(/\bA-D-\d{2}\b/g) || []) {
      if (!byId.has(reference)) errors.push(`${taskPath}: dangling canonical design anchor reference ${reference}`);
    }
  }
  for (const reference of designText.match(/\bA-D-\d{2}\b/g) || []) {
    if (!byId.has(reference)) errors.push(`design.md: dangling canonical design anchor reference ${reference}`);
  }
  return { anchors: allAnchors, designAnchors, byId };
}

function validateArtifactDeclaration(taskPath, entry, errors) {
  if (!Object.prototype.hasOwnProperty.call(entry || {}, 'artifacts')) return;
  const artifacts = entry.artifacts;
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    errors.push(`spec.json.task_registry.${taskPath}.artifacts: must be a non-empty array of safe relative paths`);
    return;
  }

  const seen = new Set();
  for (const artifact of artifacts) {
    const invalid = typeof artifact !== 'string'
      || artifact.trim() === ''
      || artifact !== artifact.trim()
      || /^\{\{[^}]+\}\}$/.test(artifact)
      || /^(?:TBD|TODO|N\/A|NA|NONE|UNKNOWN|PENDING|PLACEHOLDER|REPLACE_ME)$/i.test(artifact)
      || /^(?:[A-Za-z]:[\\/]|[\\/]|https?:\/\/)/.test(artifact)
      || artifact.split(/[\\/]+/).includes('..')
      || seen.has(artifact);
    if (invalid) {
      errors.push(`spec.json.task_registry.${taskPath}.artifacts: each entry must be a unique safe relative path (${String(artifact)})`);
      continue;
    }
    seen.add(artifact);
  }
}

function workflowPolicyContext(spec, errors) {
  if (Object.prototype.hasOwnProperty.call(spec, 'workflow_policy')) {
    const result = POLICY.validateWorkflowPolicySnapshot(spec.workflow_policy);
    if (!result.valid) {
      for (const error of result.errors) errors.push(error);
      return { explicit: true, policy: null, legacy: false, taskRequired: false, strict: false };
    }
    let policy;
    try {
      policy = POLICY.readWorkflowPolicySnapshot(spec);
    } catch (error) {
      errors.push(`spec.json.workflow_policy: shared policy adapter failed (${error.message})`);
      return { explicit: true, policy: null, legacy: false, taskRequired: false, strict: false };
    }
    return {
      explicit: true,
      policy,
      legacy: spec.workflow_policy.version === '1',
      taskRequired: spec.coordination?.tasks_required === true,
      strict: policy.assurance_level === 'Strict',
    };
  }

  const legacyTier = spec.design_context?.execution_tier;
  errors.push(
    legacyTier
      ? 'spec.json.workflow_policy: missing persisted snapshot; design_context.execution_tier is a read-only legacy adapter and cannot establish workflow authority or readiness'
      : 'spec.json.workflow_policy: missing persisted snapshot; the current spec boundary requires an explicit workflow_policy',
  );
  return { explicit: false, policy: null, legacy: false, taskRequired: false, strict: false };
}

function validateFeatureReceipt(spec, context, errors, warnings, receiptArtifact) {
  if (!receiptArtifact) return;
  let body;
  try {
    body = fs.readFileSync(receiptArtifact.path, 'utf8');
  } catch (error) {
    errors.push(`${FEATURE_RECEIPT_FILE}: cannot be read (${error.message})`);
    return;
  }
  if (/^\s*Verification:\s*PENDING\s*$/im.test(body)) {
    if (context.legacy) {
      warnings.push(`${FEATURE_RECEIPT_FILE}: legacy v1 PENDING receipt is read-compatible only and is not readiness proof`);
      return;
    }
    errors.push(`${FEATURE_RECEIPT_FILE}: premature execution receipt is forbidden in a Specs v2 pre-implementation artifact`);
    return;
  }
  if (spec.status !== 'done') {
    errors.push(`${FEATURE_RECEIPT_FILE}: completed execution receipt is valid only on terminal status done, never for readiness`);
    return;
  }
  if (!/^\s*Verification:\s*PASS\s*$/im.test(body)) {
    errors.push(`${FEATURE_RECEIPT_FILE}: completed taskless proof requires literal Verification: PASS`);
  }
  if (!/^\s*Status:\s*done\s*$/im.test(body)) {
    errors.push(`${FEATURE_RECEIPT_FILE}: completed proof and spec.json must both use status done`);
  }
  const commands = evidenceFieldValues(body, ['Command', 'Commands', 'Command(s)']);
  if (!commands.some(isExecutableCommand)) {
    errors.push(`${FEATURE_RECEIPT_FILE}: completed proof requires an executable Command`);
  }
  const expected = evidenceFieldValues(body, ['Expected result', 'Expected proof', 'Expected']);
  if (!expected.some(hasObservableProof)) {
    errors.push(`${FEATURE_RECEIPT_FILE}: completed proof requires an observable expected result`);
  }
  const observed = evidenceFieldValues(body, ['Observed result', 'Result', 'Observed proof']);
  if (!observed.some(hasObservableProof)) {
    errors.push(`${FEATURE_RECEIPT_FILE}: completed proof requires an observable result`);
  }
  const artifacts = evidenceFieldValues(
    body,
    ['Artifact/runtime proof', 'Artifact / runtime proof', 'Artifact proof', 'Runtime proof', 'Inspect'],
  );
  if (!artifacts.some((value) => isConcreteReachabilityAnchor(value) || hasObservableProof(value))) {
    errors.push(`${FEATURE_RECEIPT_FILE}: completed proof requires concrete artifact or runtime proof`);
  }
  const bindingPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
  const base = evidenceFieldValues(body, ['Base'])[0];
  const head = evidenceFieldValues(body, ['Head'])[0];
  if (!bindingPattern.test(base || '') || !bindingPattern.test(head || '') || base === head) {
    errors.push(`${FEATURE_RECEIPT_FILE}: completed proof requires distinct 40- or 64-hex Base and Head bindings`);
  }
}

const SPEC_PLACEHOLDER_RE = /\{\{[^}\n]+\}\}|<[^>\n]+>|(?<![A-Za-z0-9_./-])(?:TBD|TODO|N\/A|NA|NONE|UNKNOWN|PENDING|PLACEHOLDER|REPLACE_ME)(?![A-Za-z0-9_./-])|\.{3,}/i;
const SPEC_BRACKET_PLACEHOLDER_RE = /\[(?:specific(?:\s+[a-z][a-z0-9 /_-]{0,60})?|target\s+users?|component\s+name)\](?!\s*\()/i;
const SPEC_TEMPLATE_GUIDANCE_RE = /\b(?:to be filled|filled by (?:the )?(?:feature owner|user)|fill (?:this|in)|replace (?:this|with)|add (?:the )?real)\b/i;

function hasSpecPlaceholders(content) {
  return SPEC_PLACEHOLDER_RE.test(content)
    || SPEC_BRACKET_PLACEHOLDER_RE.test(content)
    || SPEC_TEMPLATE_GUIDANCE_RE.test(content);
}

function validateRequirementDialect(requirementsText, errors) {
  const legacy = requirementsText.match(/\bREQ-\d+\b/i);
  if (legacy) {
    errors.push(
      `requirements.md: ${legacy[0].toUpperCase()} is not a canonical requirement id; ` +
      'use Requirement N/RN with acceptance criteria RN.M (task mappings use N.M)',
    );
  }
}

function validateSemanticReadiness(spec, requirementsText, designText, context, errors) {
  if (
    spec.ready_for_implementation !== true
    || !context.explicit
    || context.policy?.lane === 'Direct'
  ) return;
  const profile = context.policy?.lane || 'non-Direct';

  const source = spec.scope_lock?.source;
  if (typeof source !== 'string' || source.trim() === '' || hasSpecPlaceholders(source)) {
    errors.push(`spec.json.scope_lock.source: ${profile} readiness requires a concrete scope source`);
  }
  if (hasSpecPlaceholders(requirementsText)) {
    errors.push(`requirements.md: ${profile} readiness rejects placeholders`);
  }
  let placeholderDesignText = designText;
  if (context.policy?.lane === 'Critical') {
    const closure = extractSection(designText, 'Execution Closure');
    if (closure !== null && isJustifiedNotApplicable(closure.trim())) {
      placeholderDesignText = designText.replace(closure, '');
    }
  }
  if (hasSpecPlaceholders(placeholderDesignText)) {
    errors.push(`design.md: ${profile} readiness rejects placeholders`);
  }
  if (extractRequirementIds(requirementsText).length === 0) {
    errors.push(`requirements.md: ${profile} readiness requires at least one canonical numeric requirement id (Requirement N or RN)`);
  }
  if (extractSubCriteriaIds(requirementsText).length === 0 || !hasTestableAcceptanceCriterion(requirementsText)) {
    errors.push(
      `requirements.md: ${profile} readiness requires at least one testable acceptance criterion using RN.M`,
    );
  }
  if (!hasConcreteDesignBoundary(designText)) {
    errors.push(
      `design.md: ${profile} readiness requires a grounded path/code identifier plus owned or touched behavior in Architecture, Components and Interfaces, Canonical Contracts & Invariants, or Implementation Boundary`,
    );
  }
}

function validateResearchPointer(specDir, canonicalSpecDir, spec, errors) {
  if (!Object.prototype.hasOwnProperty.call(spec, 'research') || spec.research === null) return;
  const pointer = spec.research && typeof spec.research === 'object' && !Array.isArray(spec.research)
    ? spec.research.path
    : spec.research;
  if (
    typeof pointer !== 'string'
    || pointer.trim() === ''
    || pointer !== pointer.trim()
    || path.isAbsolute(pointer)
    || /^[A-Za-z]:[\\/]/.test(pointer)
    || pointer.split(/[\\/]+/).includes('..')
  ) {
    errors.push('spec.research: must be a safe relative path inside the spec directory');
    return;
  }
  inspectSpecArtifact(specDir, canonicalSpecDir, pointer, 'spec.research path', errors);
}

function hasConcreteResearchEvidence(section) {
  const placeholder = /\{\{[^}]+\}\}|<[^>]+>|\[[^\]]+\]|\b(?:TBD|TODO|N\/A|NA|NONE|UNKNOWN|PENDING|PLACEHOLDER|REPLACE_ME)\b/i;
  const boilerplate = /^(?:this section is mandatory\b.*|(?:result or skip rationale|relevant files\/modules|existing patterns\/contracts|tests or checks affected|decision|why it fits the current codebase|why it fits current external constraints|task implication|test\/verification implication)\s*:?)$/i;
  const generic = /^(?:finding|gap|alternative)\s+\d+\b|^(?:codebase scout|external \/ current research)\s*:\s*required\s*\/\s*skipped/i;

  return section.split('\n').some((rawLine) => {
    const line = rawLine
      .trim()
      .replace(/^[-*+]\s*/, '')
      .replace(/^\||\|$/g, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .trim();
    if (!line || line.endsWith(':') || placeholder.test(line) || boilerplate.test(line) || generic.test(line)) return false;
    return line.length >= 8;
  });
}

function validateResearchArtifact(researchArtifact, errors, requireConcrete = true) {
  if (!researchArtifact) {
    errors.push('research.md: missing Evidence Summary for non-trivial spec');
    return;
  }
  const research = fs.readFileSync(researchArtifact.path, 'utf8');
  validateUniqueSectionGroups('research.md', research, [['Evidence Summary']], errors);
  const evidence = extractSection(research, 'Evidence Summary');
  if (evidence === null) {
    errors.push('research.md: missing ## Evidence Summary');
  } else if (requireConcrete && !hasConcreteResearchEvidence(evidence)) {
    errors.push('research.md: Evidence Summary must contain concrete evidence; empty or placeholder content is not sufficient');
  }
}

function groundedResearchEvidence(section, canonicalSpecDir) {
  if (/https:\/\/[^\s)>]+/i.test(section)) return true;
  const projectRoot = path.dirname(path.dirname(canonicalSpecDir));
  for (const match of section.matchAll(/`([^`]+)`/g)) {
    let target = match[1].trim();
    if (!target || /\s/.test(target) || path.isAbsolute(target) || /^[A-Za-z]:[\\/]/.test(target)) continue;
    target = target.split('#')[0].replace(/:\d+(?::\d+)?$/, '');
    if (unsafeRelatedPath(target)) continue;
    const resolved = path.resolve(projectRoot, target);
    if (isPathInside(projectRoot, resolved) && fs.existsSync(resolved)) return true;
  }
  return false;
}

function validateResearchArtifact21(researchArtifact, canonicalSpecDir, errors) {
  const research = fs.readFileSync(researchArtifact.path, 'utf8');
  const headings = ['Uncertainty', 'Evidence Summary', 'Decision', 'Remaining Gaps'];
  for (const heading of headings) {
    const count = headingCount(research, heading);
    if (count !== 1) errors.push(`research.md: requires exactly one ## ${heading} section`);
  }
  const sections = Object.fromEntries(headings.map((heading) => [heading, extractSection(research, heading)]));
  for (const heading of ['Uncertainty', 'Evidence Summary', 'Decision']) {
    if (sections[heading] !== null && !hasConcreteResearchEvidence(sections[heading])) {
      errors.push(`research.md: ${heading} must contain concrete non-placeholder content`);
    }
  }
  if (sections['Evidence Summary'] !== null
    && hasConcreteResearchEvidence(sections['Evidence Summary'])
    && !groundedResearchEvidence(sections['Evidence Summary'], canonicalSpecDir)) {
    errors.push('research.md: Evidence Summary must ground at least one existing repository target or https primary source');
  }
  const gaps = sections['Remaining Gaps'];
  if (gaps !== null) {
    const semantic = semanticMarkdown(gaps).replace(/^\s*[-*+]\s*/gm, '').trim();
    const none = /^none\b/i.test(semantic);
    if (none) {
      const rationale = semantic.replace(/^none\b\s*(?:[-—:]\s*)?/i, '').trim();
      if (rationale.length < 12 || !hasConcreteResearchEvidence(rationale)) {
        errors.push('research.md: Remaining Gaps None requires concrete rationale or evidence');
      }
    } else if (!hasConcreteResearchEvidence(gaps)) {
      errors.push('research.md: Remaining Gaps must contain a concrete gap or None with rationale or evidence');
    }
  }
}

function validateStateTransitions(spec, errors, context = {}) {
  // Canonical approval authority is technical only. rc.3 user_approved is readable but inert.
  // Legacy "approved" field is rejected fail-closed with migration guidance.
  const approvals = spec.approvals || {};
  let hasLegacy = false;
  for (const [stage, approval] of Object.entries(approvals)) {
    if (!approval || typeof approval !== 'object') {
      errors.push(`spec.json.approvals.${stage}: must be an object`);
      continue;
    }
    if ('approved' in approval) {
      errors.push(`spec.json.approvals.${stage}: ${LEGACY_APPROVAL_ERROR}`);
      hasLegacy = true;
    }
    const keys = Object.keys(approval).sort();
    const canonical = ['agent_validated', 'generated'];
    const rc3 = ['agent_validated', 'generated', 'user_approved'];
    if (JSON.stringify(keys) !== JSON.stringify(canonical) && JSON.stringify(keys) !== JSON.stringify(rc3)) {
      errors.push(`spec.json.approvals.${stage}: fields must be generated and agent_validated; legacy user_approved is readable but has zero authority`);
    }
    for (const key of keys) {
      if (typeof approval[key] !== 'boolean') errors.push(`spec.json.approvals.${stage}.${key}: must be boolean`);
    }
    // Unsupported/ambiguous: if schema_version missing when approvals use v2 shape, warn but not fail? B2 says fail closed.
    // We fail closed when version is unsupported or ambiguous and ready_for_implementation is true.
  }

  // Schema version validation
  if (spec.schema_version !== undefined && spec.schema_version !== APPROVAL_SCHEMA_VERSION) {
    errors.push(`spec.json.schema_version: unsupported "${spec.schema_version}", expected "${APPROVAL_SCHEMA_VERSION}" — migration required`);
  }
  if (spec.approval_schema_version !== undefined && spec.approval_schema_version !== APPROVAL_SCHEMA_VERSION) {
    errors.push(`spec.json.approval_schema_version: unsupported "${spec.approval_schema_version}", expected "${APPROVAL_SCHEMA_VERSION}"`);
  }
  // If approvals use v2 fields but no schema_version, treat as ambiguous — fail closed when ready flag is set
  const usesV2 = Object.values(approvals).some((a) => a && typeof a === 'object' && 'agent_validated' in a);
  if (usesV2 && spec.schema_version === undefined && spec.approval_schema_version === undefined) {
    // Only warn now; will be error if ready_for_implementation is true (checked below)
    // Provide guidance
    if (spec.ready_for_implementation === true) {
      errors.push(`spec.json.schema_version: missing — spec uses v2 approvals but has no schema_version "${APPROVAL_SCHEMA_VERSION}"`);
    }
  }

  if (spec.validation?.status === 'completed' && !spec.timestamps?.validation_done) {
    errors.push('spec.json.validation: completed transition requires timestamps.validation_done');
  }

  if (spec.ready_for_implementation === true) {
    if (hasLegacy) {
      errors.push('spec.json.ready_for_implementation: cannot be true with legacy approved fields');
    }
    const stages = context.taskRequired
      ? ['requirements', 'design', 'tasks']
      : ['requirements', 'design'];
    for (const stage of stages) {
      const approval = spec.approvals?.[stage];
      if (!approval || approval?.generated !== true || approval?.agent_validated !== true) {
        errors.push(`spec.json.ready_for_implementation: requires generated and agent_validated ${stage} evidence (v2)`);
      }
    }
    if (spec.validation?.status === 'in_progress' || spec.validation?.status === 'not-run') {
      errors.push('spec.json.ready_for_implementation: cannot be true while validation evidence is incomplete');
    }
  }
}

function validateReadinessStatusValues(spec, errors) {
  if (typeof spec.ready_for_implementation !== 'boolean') {
    errors.push('spec.json.ready_for_implementation: must be a boolean');
  }
  if (typeof spec.status !== 'string' || !SPEC_STATUS_VALUES.has(spec.status)) {
    errors.push(`spec.json.status: must be one of ${[...SPEC_STATUS_VALUES].join(', ')}`);
  }
  if (spec.validation !== undefined && !isPlainObject(spec.validation)) {
    errors.push('spec.json.validation: must be an object when present');
  }
  const validationStatus = isPlainObject(spec.validation) ? spec.validation.status : undefined;
  if (validationStatus !== undefined && !VALIDATION_STATUS_VALUES.has(validationStatus)) {
    errors.push(`spec.json.validation.status: must be one of ${[...VALIDATION_STATUS_VALUES].join(', ')}`);
  }
  if (spec.ready_for_implementation !== true) return;
  if (spec.status === 'blocked' || spec.status === 'paused') {
    errors.push(`spec.json.status: cannot be ${spec.status} while ready_for_implementation is true`);
  }
  if (typeof spec.blocker === 'string' && spec.blocker.trim() !== '') {
    errors.push('spec.json.blocker: must be empty while ready_for_implementation is true');
  }
  if (validationStatus !== 'completed') {
    errors.push('spec.json.ready_for_implementation: requires validation.status completed');
  }
}

function validateCoreMachineState(spec, taskFiles, errors, { schema21 = false } = {}) {
  if (!isPlainObject(spec.scope_lock)) {
    errors.push('spec.json.scope_lock: must be an object, not a boolean or array');
  }
  validateTimestamps(spec, errors);
  validateReadinessStatusValues(spec, errors);
  if (isIsoTimestamp(spec.created_at) && isIsoTimestamp(spec.updated_at)
    && Date.parse(spec.updated_at) < Date.parse(spec.created_at)) {
    errors.push('spec.json lifecycle timestamps must satisfy created_at <= updated_at');
  }
  if (schema21 || spec.schema_version === APPROVAL_SCHEMA_VERSION) {
    const required = [
      'schema_version', 'feature_name', 'created_at', 'updated_at', 'status',
      'scope_lock', 'authoring', 'coordination', 'validation', 'ready_for_implementation', 'workflow_policy',
    ];
    if (!schema21) required.splice(required.indexOf('authoring'), 1);
    else required.push('language');
    for (const field of required) if (!Object.prototype.hasOwnProperty.call(spec, field)) {
      errors.push(`spec.json.${field}: required by schema ${spec.schema_version} machine state`);
    }
    if (!isPlainObject(spec.validation)
      || !Object.prototype.hasOwnProperty.call(spec.validation, 'status')
      || !Object.prototype.hasOwnProperty.call(spec.validation, 'semantic_review')) {
      errors.push(`spec.json.validation: schema ${spec.schema_version} requires status and semantic_review`);
    }
  }

  if (taskFiles.length === 0) return;
  const taskFileSet = new Set(taskFiles);
  if (!Array.isArray(spec.task_files)) errors.push('spec.json.task_files: physical tasks require an array');
  if (!isPlainObject(spec.task_registry)) {
    errors.push('spec.json.task_registry: physical tasks require an object keyed by task file path');
    return;
  }
  for (const taskPath of taskFiles) {
    const entry = spec.task_registry[taskPath];
    const label = `spec.json.task_registry.${taskPath}`;
    if (!isPlainObject(entry)) {
      errors.push(`${label}: must be an object`);
      continue;
    }
    for (const key of REQUIRED_REGISTRY_KEYS) if (!Object.prototype.hasOwnProperty.call(entry, key)) {
      errors.push(`${label}: missing ${key}`);
    }
    if (entry.id !== expectedTaskId(taskPath)) {
      errors.push(`${label}: id must match path-derived id ${expectedTaskId(taskPath)} (got ${String(entry.id)})`);
    }
    if (typeof entry.title !== 'string' || entry.title.trim() === '' || hasSpecPlaceholders(entry.title)) {
      errors.push(`${label}.title: must be a concrete non-empty string`);
    }
    if (!TASK_STATUS_VALUES.has(entry.status)) {
      errors.push(`${label}.status: must be one of ${[...TASK_STATUS_VALUES].join(', ')}`);
    }
    validateTaskLifecycle(taskPath, entry, errors);
    if (spec.ready_for_implementation === true && entry.status === 'blocked') {
      errors.push(`${label}.status: cannot be blocked while ready_for_implementation is true`);
    }
    if (!Array.isArray(entry.dependencies)) {
      errors.push(`${label}.dependencies: must be an array`);
      continue;
    }
    const seen = new Set();
    for (const dependency of entry.dependencies) {
      if (!taskFileSet.has(dependency)) errors.push(`${label}.dependencies: unknown dependency ${dependency}`);
      if (dependency === taskPath) errors.push(`${label}.dependencies: cannot contain itself`);
      if (seen.has(dependency)) errors.push(`${label}.dependencies: duplicate dependency ${dependency}`);
      seen.add(dependency);
    }
  }
}

function meaningfulObligationValue(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length >= 8
    && !hasSpecPlaceholders(text)
    && !/^(?:works?|done|check|verify|test|proof|evidence|state|authority|recovery)$/i.test(text);
}

function normalizeClosureText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[|`*_[\]{}()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function closureFieldName(value) {
  const name = normalizeClosureText(value).replace(/\s*\/\s*/g, ' / ');
  if (/^(?:obligation ids? \/ )?requirements?$/.test(name)
    || /^obligation id \/ requirements$/.test(name)) return ['requirements'];
  if (/^canonical state$/.test(name)) return ['canonical_state'];
  if (/^authority$/.test(name)) return ['authority'];
  if (/^(?:crash \/ retry )?recovery$/.test(name)) return ['recovery'];
  if (/^owner task$/.test(name)) return ['owner_task'];
  if (/^(?:consumer tasks?|consumers?)(?: \/ dependency order)?$/.test(name)) return ['consumer_tasks'];
  if (/^verification$/.test(name)) return ['verification'];
  if (/^evidence$/.test(name)) return ['evidence'];
  if (/^verification \/ evidence$/.test(name)) return ['verification', 'evidence'];
  return [];
}

function appendClosureField(fields, label, value) {
  for (const key of closureFieldName(label)) {
    if (!fields.has(key)) fields.set(key, []);
    fields.get(key).push(String(value).trim());
  }
}

function parseClosureFields(block) {
  const fields = new Map();
  const lines = String(block).split('\n');
  for (const line of lines) {
    const candidate = line
      .trim()
      .replace(/^[-*+]\s*/, '')
      .replace(/^\*\*/, '');
    const field = candidate.match(/^([^:]+?)(?:\*\*)?\s*:\s*(.*?)\s*$/);
    if (field) appendClosureField(fields, field[1], field[2]);
  }

  for (let index = 0; index + 2 < lines.length; index += 1) {
    if (!/^\s*\|/.test(lines[index]) || !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1])) {
      continue;
    }
    const headers = lines[index].split('|').slice(1, -1).map((cell) => cell.trim());
    for (let rowIndex = index + 2; rowIndex < lines.length && /^\s*\|/.test(lines[rowIndex]); rowIndex += 1) {
      const cells = lines[rowIndex].split('|').slice(1, -1).map((cell) => cell.trim());
      headers.forEach((header, cellIndex) => appendClosureField(fields, header, cells[cellIndex] || ''));
    }
    break;
  }
  return fields;
}

function closureField(fields, key) {
  return (fields.get(key) || []).join(' ');
}

function normalizedStringSet(values) {
  return [...new Set(values.map((value) => String(value).toUpperCase()))].sort();
}

function validateClosureCorrespondence(label, closure, obligationId, obligation, errors) {
  const block = closure.blocks?.get(obligationId);
  if (typeof block !== 'string' || block.trim() === '') {
    errors.push(`${label}: Execution Closure marker ${obligationId} requires a marker-local field block`);
    return;
  }
  const parsed = parseClosureFields(block);
  const fields = [
    ['canonical_state', obligation.canonical_state],
    ['authority', obligation.authority],
    ['recovery', obligation.recovery],
    ['owner_task', obligation.owner_task],
    ['verification', obligation.verification],
    ['evidence', obligation.evidence],
  ];
  for (const [field, value] of fields) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const localValue = closureField(parsed, field);
    if (!localValue || !normalizeClosureText(localValue).includes(normalizeClosureText(value))) {
      errors.push(
        `${label}: Execution Closure for ${obligationId} must mirror spec.json ${field} in its marker-local field`,
      );
    }
  }

  const expectedRequirements = normalizedStringSet(
    Array.isArray(obligation.requirements) ? obligation.requirements : [],
  );
  const actualRequirements = normalizedStringSet(
    closureField(parsed, 'requirements').match(/\bR\d+(?:\.\d+)?\b/gi) || [],
  );
  if (JSON.stringify(actualRequirements) !== JSON.stringify(expectedRequirements)) {
    errors.push(
      `${label}: Execution Closure for ${obligationId} must mirror spec.json requirements in its marker-local field`,
    );
  }

  const consumers = Array.isArray(obligation.consumer_tasks) ? obligation.consumer_tasks : [];
  const consumerValue = closureField(parsed, 'consumer_tasks');
  if (consumers.length === 0) {
    if (!/^\s*(?:none|n\/a)\b/i.test(consumerValue)) {
      errors.push(`${label}: Execution Closure for ${obligationId} must state that consumer_tasks are none`);
    }
  } else {
    const actualConsumers = [...new Set(
      consumerValue.match(/tasks\/task-R\d+-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md/gi) || [],
    )].sort();
    const expectedConsumers = [...new Set(consumers)].sort();
    if (JSON.stringify(actualConsumers) !== JSON.stringify(expectedConsumers)) {
      errors.push(
        `${label}: Execution Closure for ${obligationId} must mirror spec.json consumer_tasks in its marker-local field`,
      );
    }
  }
}

function validateImplementationObligations(
  spec,
  context,
  requirementIds,
  subCriteriaIds,
  taskFiles,
  registry,
  designClosure,
  taskClosures,
  errors,
) {
  if (!Object.prototype.hasOwnProperty.call(spec, 'implementation_obligations')) {
    const taskClosurePresent = [...taskClosures.values()].some((closure) => closure.headingCount > 0);
    if (designClosure.ids.length > 0 || [...taskClosures.values()].some((closure) => closure.ids.length > 0)) {
      errors.push(
        'implementation obligation markers require a declared spec.json.implementation_obligations array',
      );
    }
    if (context.policy?.lane === 'Critical') {
      if (designClosure.headingCount !== 1 || !designClosure.notApplicable) {
        errors.push(
          'design.md: Critical scope must declare non-empty spec.json.implementation_obligations or one justified N/A in Execution Closure',
        );
      }
    } else if (designClosure.headingCount > 0) {
      errors.push('design.md: Execution Closure is allowed only for a declared Critical obligation decision');
    }
    if (taskClosurePresent) {
      errors.push('tasks/: Execution Closure is allowed only for tasks assigned to declared implementation obligations');
    }
    return;
  }
  const obligations = spec.implementation_obligations;
  if (context.policy?.lane !== 'Critical') {
    errors.push('spec.json.implementation_obligations: allowed only for Critical workflow policy');
  }
  if (!Array.isArray(obligations) || obligations.length === 0) {
    errors.push('spec.json.implementation_obligations: must be a non-empty array when present');
    return;
  }
  if (designClosure.notApplicable) {
    errors.push('design.md: justified N/A cannot coexist with declared implementation obligations');
  }

  const knownRequirements = new Set([...requirementIds, ...subCriteriaIds]);
  const knownTasks = new Set(taskFiles);
  const dependencies = new Map(taskFiles.map((taskFile) => [
    taskFile,
    new Set(Array.isArray(registry?.[taskFile]?.dependencies) ? registry[taskFile].dependencies : []),
  ]));
  function dependsOn(taskFile, ownerTask, seen = new Set()) {
    if (taskFile === ownerTask) return true;
    if (seen.has(taskFile)) return false;
    seen.add(taskFile);
    return [...(dependencies.get(taskFile) || [])].some((dependency) => (
      dependsOn(dependency, ownerTask, seen)
    ));
  }

  const ids = new Set();
  const obligationsById = new Map();
  for (const [index, obligation] of obligations.entries()) {
    const label = `spec.json.implementation_obligations[${index}]`;
    if (!isPlainObject(obligation)) {
      errors.push(`${label}: must be an object`);
      continue;
    }
    const obligationId = typeof obligation.id === 'string' ? obligation.id.trim().toLowerCase() : '';
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(obligationId)) {
      errors.push(`${label}.id: must be a stable lowercase marker id`);
    } else if (obligation.id !== obligationId) {
      errors.push(`${label}.id: must be lowercase without surrounding whitespace`);
    } else if (ids.has(obligationId)) {
      errors.push(`${label}.id: duplicate obligation id ${obligationId}`);
    } else {
      ids.add(obligationId);
      obligationsById.set(obligationId, obligation);
    }

    if (!Array.isArray(obligation.requirements) || obligation.requirements.length === 0) {
      errors.push(`${label}.requirements: must be a non-empty array of requirement references`);
    } else {
      const seenRequirements = new Set();
      for (const reference of obligation.requirements) {
        if (typeof reference !== 'string' || !/^R\d+(?:\.\d+)?$/i.test(reference)) {
          errors.push(`${label}.requirements: invalid requirement reference ${String(reference)}`);
          continue;
        }
        const normalized = reference.toUpperCase();
        if (seenRequirements.has(normalized)) {
          errors.push(`${label}.requirements: duplicate requirement reference ${normalized}`);
        } else if (!knownRequirements.has(normalized)) {
          errors.push(`${label}.requirements: unknown requirement reference ${normalized}`);
        }
        seenRequirements.add(normalized);
      }
    }

    const ownerTask = obligation.owner_task;
    const ownerValid = typeof ownerTask === 'string' && knownTasks.has(ownerTask);
    if (!ownerValid) {
      errors.push(`${label}.owner_task: must name exactly one registered task`);
    }

    if (!Array.isArray(obligation.consumer_tasks)) {
      errors.push(`${label}.consumer_tasks: must be an array of registered tasks`);
    } else {
      const seenConsumers = new Set();
      for (const consumerTask of obligation.consumer_tasks) {
        if (typeof consumerTask !== 'string' || !knownTasks.has(consumerTask)) {
          errors.push(`${label}.consumer_tasks: unknown task reference ${String(consumerTask)}`);
          continue;
        }
        if (consumerTask === ownerTask) {
          errors.push(`${label}.consumer_tasks: owner task cannot also be a consumer`);
        } else if (seenConsumers.has(consumerTask)) {
          errors.push(`${label}.consumer_tasks: duplicate task reference ${consumerTask}`);
        } else if (ownerValid && !dependsOn(consumerTask, ownerTask)) {
          errors.push(`${label}.consumer_tasks: ${consumerTask} must depend on owner ${ownerTask}`);
        }
        seenConsumers.add(consumerTask);
      }
    }

    for (const field of ['canonical_state', 'authority', 'recovery']) {
      if (!meaningfulObligationValue(obligation[field])) {
        errors.push(`${label}.${field}: must be concrete, non-placeholder implementation semantics`);
      }
    }
    if (!isExecutableCommand(obligation.verification)) {
      errors.push(`${label}.verification: must be an executable command`);
    }
    if (!hasObservableProof(obligation.evidence)) {
      errors.push(`${label}.evidence: must name an observable result, state, artifact, or exit outcome`);
    }
  }

  if (ids.size > 0 && designClosure.headingCount !== 1) {
    errors.push('design.md: declared implementation obligations require exactly one Execution Closure section');
  }
  const designSet = new Set(designClosure.ids);
  for (const designId of designSet) {
    if (!ids.has(designId)) {
      errors.push(`design.md: implementation obligation marker ${designId} is not declared in spec.json`);
    }
  }
  for (const obligationId of ids) {
    if (!designSet.has(obligationId)) {
      errors.push(`design.md: missing implementation obligation marker ${obligationId}`);
    }
  }

  for (const [taskFile, closure] of taskClosures) {
    if (closure.headingCount > 0 && closure.ids.length === 0) {
      errors.push(`${taskFile}: Execution Closure requires at least one assigned implementation obligation marker`);
    }
    for (const marker of closure.ids) {
      const obligation = obligationsById.get(marker);
      if (!obligation) {
        errors.push(`${taskFile}: implementation obligation marker ${marker} is not declared in spec.json`);
        continue;
      }
      const participants = new Set([
        obligation.owner_task,
        ...(Array.isArray(obligation.consumer_tasks) ? obligation.consumer_tasks : []),
      ]);
      if (!participants.has(taskFile)) {
        errors.push(`${taskFile}: marker ${marker} is not assigned to this owner/consumer task`);
      }
    }
  }

  for (const [obligationId, obligation] of obligationsById) {
    if (designSet.has(obligationId)) {
      validateClosureCorrespondence('design.md', designClosure, obligationId, obligation, errors);
    }
    const participants = [
      obligation.owner_task,
      ...(Array.isArray(obligation.consumer_tasks) ? obligation.consumer_tasks : []),
    ].filter((taskFile) => typeof taskFile === 'string' && knownTasks.has(taskFile));
    for (const taskFile of participants) {
      const closure = taskClosures.get(taskFile)
        || { ids: [], section: '', headingCount: 0, blocks: new Map(), notApplicable: false };
      if (!closure.ids.includes(obligationId)) {
        errors.push(`${taskFile}: missing implementation obligation marker ${obligationId}`);
      } else {
        if (closure.headingCount !== 1) {
          errors.push(`${taskFile}: declared implementation obligations require exactly one Execution Closure section`);
        }
        validateClosureCorrespondence(taskFile, closure, obligationId, obligation, errors);
      }
    }
  }
}

function validateDependencyTopology(spec, taskFiles, registry, taskRecords, errors) {
  const dependencies = new Map(taskFiles.map((taskFile) => [taskFile, new Set(registry?.[taskFile]?.dependencies || [])]));
  if (dependencies.size === 0) return;

  const visiting = new Set();
  const visited = new Set();
  function visit(taskFile, stack = []) {
    if (visiting.has(taskFile)) {
      const cycleStart = stack.indexOf(taskFile);
      errors.push(`spec.json.task_registry.dependencies: dependency cycle detected (${stack.slice(cycleStart).concat(taskFile).join(' -> ')})`);
      return;
    }
    if (visited.has(taskFile)) return;
    visiting.add(taskFile);
    for (const dependency of dependencies.get(taskFile) || []) visit(dependency, [...stack, taskFile]);
    visiting.delete(taskFile);
    visited.add(taskFile);
  }
  for (const taskFile of taskFiles) visit(taskFile);

  const roots = taskFiles.filter((taskFile) => (dependencies.get(taskFile) || new Set()).size === 0);
  const reachable = new Set();
  const dependents = new Map(taskFiles.map((taskFile) => [taskFile, []]));
  for (const [taskFile, deps] of dependencies) {
    for (const dependency of deps) dependents.get(dependency)?.push(taskFile);
  }
  const queue = [...roots];
  while (queue.length > 0) {
    const taskFile = queue.shift();
    if (reachable.has(taskFile)) continue;
    reachable.add(taskFile);
    queue.push(...(dependents.get(taskFile) || []));
  }
  for (const taskFile of taskFiles) {
    if (!reachable.has(taskFile)) errors.push(`spec.json.task_registry.${taskFile}: orphan or unreachable task in dependency graph`);
  }

  function dependsOn(taskFile, ancestor, seen = new Set()) {
    if (taskFile === ancestor) return true;
    if (seen.has(taskFile)) return false;
    seen.add(taskFile);
    return [...(dependencies.get(taskFile) || [])].some((dependency) => dependsOn(dependency, ancestor, seen));
  }

  const producers = new Map();
  for (const [taskFile, record] of taskRecords) {
    for (const [index, row] of record.rows.entries()) {
      if (row.action !== 'create') continue;
      const prior = producers.get(row.path);
      if (prior && prior.taskFile !== taskFile) {
        errors.push(`${taskFile}: Related Files path ${row.path} is created by multiple tasks (${prior.taskFile}, ${taskFile})`);
      } else {
        producers.set(row.path, { taskFile, index });
      }
    }
  }
  // Lifecycle ordering: Create must precede Modify/Delete/Read within task for same path
  for (const [taskFile, record] of taskRecords) {
    const createIndexByPath = new Map();
    for (const [index, row] of record.rows.entries()) {
      if (row.action === 'create' && !createIndexByPath.has(row.path)) {
        createIndexByPath.set(row.path, index);
      }
    }
    for (const [index, row] of record.rows.entries()) {
      if (!['modify', 'delete', 'read'].includes(row.action)) continue;
      if (!createIndexByPath.has(row.path)) continue;
      const createIdx = createIndexByPath.get(row.path);
      if (createIdx > index) {
        errors.push(`${taskFile}: Create must precede ${row.action} for ${row.path} within Related Files order`);
      }
    }
  }
  // Cross-task lifecycle: Modify/Delete/Read of a path created by another task must depend on creator
  for (const [taskFile, record] of taskRecords) {
    for (const [index, row] of record.rows.entries()) {
      if (!['modify', 'delete', 'read'].includes(row.action)) continue;
      const producer = producers.get(row.path);
      if (!producer) continue;
      if (producer.taskFile === taskFile) continue;
      if (!dependsOn(taskFile, producer.taskFile)) {
        errors.push(`${taskFile}: ${row.action} of ${row.path} must depend on creator ${producer.taskFile}`);
      }
    }
  }

  // Existing implementation: Modify/Delete on non-produced paths must have a Read before them.
  // This ensures lifecycle Read is not skipped for existing files.
  for (const [taskFile, record] of taskRecords) {
    for (const [index, row] of record.rows.entries()) {
      if (!['modify', 'delete'].includes(row.action)) continue;
      if (producers.has(row.path)) continue; // produced by spec, not existing
      // Check if there's a Read for same path preceding this Modify/Delete
      let hasPrecedingRead = false;
      // Same task earlier row
      for (let i = 0; i < index; i += 1) {
        const r = record.rows[i];
        if (r.action === 'read' && r.path === row.path) { hasPrecedingRead = true; break; }
      }
      if (hasPrecedingRead) continue;
      // In any dependency ancestor
      const deps = dependencies.get(taskFile) || new Set();
      // Walk transitive deps for Read
      const stack = [...deps];
      const seen = new Set();
      while (stack.length > 0) {
        const dep = stack.pop();
        if (seen.has(dep)) continue;
        seen.add(dep);
        const depRecord = taskRecords.get(dep);
        if (depRecord && depRecord.rows.some((r) => r.action === 'read' && r.path === row.path)) {
          hasPrecedingRead = true; break;
        }
        for (const d of dependencies.get(dep) || []) stack.push(d);
      }
      if (!hasPrecedingRead) {
        errors.push(`${taskFile}: ${row.action} of ${row.path} targets existing implementation but has no preceding Read — add a Read for ${row.path} before modifying it (lifecycle ordering)`);
      }
    }
  }
}

function validateParallelEligibility(taskFiles, registry, taskRecords, errors) {
  const parallelTasks = taskFiles.filter((taskFile) => taskRecords.get(taskFile)?.parallel === true);
  for (const taskFile of parallelTasks) {
    const dependencies = Array.isArray(registry?.[taskFile]?.dependencies)
      ? registry[taskFile].dependencies
      : [];
    if (dependencies.length > 0) {
      errors.push(`${taskFile}: task-level (P) cannot declare sibling dependencies`);
    }

    const ownRows = taskRecords.get(taskFile)?.rows || [];
    for (const sibling of taskFiles) {
      if (sibling === taskFile) continue;
      const siblingRows = taskRecords.get(sibling)?.rows || [];
      const conflicts = new Set();
      for (const ownRow of ownRows) {
        for (const siblingRow of siblingRows) {
          if (ownRow.path === siblingRow.path) {
            conflicts.add(ownRow.path);
          }
        }
      }
      for (const conflict of conflicts) {
        errors.push(
          `${taskFile}: task-level (P) has Related Files contention on ${conflict} with ${sibling}`,
        );
      }
    }
  }
}

function explicitResearchPath(spec) {
  if (!Object.prototype.hasOwnProperty.call(spec, 'research') || spec.research === null) return null;
  return isPlainObject(spec.research) ? spec.research.path : spec.research;
}

function validateCoordinationTopology(spec, context, taskFiles, specDir, errors) {
  const depth = context.policy?.planning_depth;
  if (depth === 'None') {
    errors.push('spec.json.workflow_policy.planning_depth: None cannot have a durable spec artifact');
  }
  const coordination = spec.coordination;
  if (!isPlainObject(coordination)) {
    if (!context.legacy) errors.push('spec.json.coordination: Specs v2 requires an object');
    return { tasksRequired: context.legacy && taskFiles.length > 0, phases: [] };
  }
  if (typeof coordination.tasks_required !== 'boolean') {
    errors.push('spec.json.coordination.tasks_required: must be a boolean');
  }
  if (typeof coordination.phases_required !== 'boolean') {
    errors.push('spec.json.coordination.phases_required: must be a boolean');
  }
  const tasksRequired = coordination.tasks_required === true;
  if (tasksRequired && taskFiles.length === 0) {
    errors.push('spec.json.coordination.tasks_required: true requires physical task files and matching registry');
  }
  if (!tasksRequired && taskFiles.length > 0) {
    errors.push('tasks/: physical task files exist while coordination.tasks_required is false');
  }
  let taskTriggers = [];
  if (!context.legacy && tasksRequired) {
    if (coordination.reason !== 'task_topology') {
      errors.push('spec.json.coordination.reason: Specs v2 task bundles require canonical task_topology reason');
    }
    if (!Array.isArray(coordination.task_triggers) || coordination.task_triggers.length === 0) {
      errors.push('spec.json.coordination.task_triggers: Specs v2 task bundles require a non-empty auditable trigger list');
    } else {
      taskTriggers = coordination.task_triggers;
      const seen = new Set();
      for (const trigger of taskTriggers) {
        if (!TASK_TRIGGER_VALUES.has(trigger)) {
          errors.push(`spec.json.coordination.task_triggers: unknown trigger ${String(trigger)}`);
        } else if (seen.has(trigger)) {
          errors.push(`spec.json.coordination.task_triggers: duplicate trigger ${trigger}`);
        }
        seen.add(trigger);
      }
    }
  } else if (!context.legacy && Object.prototype.hasOwnProperty.call(coordination, 'task_triggers')) {
    errors.push('spec.json.coordination.task_triggers: taskless Specs v2 must omit task triggers');
  }
  const phases = coordination.phases;
  if (phases !== undefined && !Array.isArray(phases)) {
    errors.push('spec.json.coordination.phases: must be an array when present');
    return { tasksRequired, phases: [] };
  }
  const phaseList = Array.isArray(phases) ? phases : [];
  if (coordination.phases_required !== (phaseList.length > 0)) {
    errors.push('spec.json.coordination.phases_required: must match whether structured phases are present');
  }
  if (phaseList.length > 0 && (depth !== 'Full' || !tasksRequired)) {
    errors.push('spec.json.coordination.phases: structured phases are allowed only for a Full task graph');
  }
  const taskIds = new Set(taskFiles.map(expectedTaskId));
  const covered = new Set();
  const phaseIds = new Set();
  for (const [index, phase] of phaseList.entries()) {
    const label = `spec.json.coordination.phases[${index}]`;
    if (!isPlainObject(phase)
      || JSON.stringify(Object.keys(phase).sort()) !== JSON.stringify([...PHASE_FIELDS].sort())) {
      errors.push(`${label}: must contain exactly ${PHASE_FIELDS.join(', ')}`);
      continue;
    }
    if (typeof phase.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(phase.id)) {
      errors.push(`${label}.id: must be a stable kebab-case id`);
    } else if (phaseIds.has(phase.id)) errors.push(`${label}.id: duplicate phase id ${phase.id}`);
    phaseIds.add(phase.id);
    if (!Array.isArray(phase.task_ids) || phase.task_ids.length === 0) {
      errors.push(`${label}.task_ids: must be a non-empty array`);
    } else {
      for (const taskId of phase.task_ids) {
        if (!taskIds.has(taskId)) errors.push(`${label}.task_ids: unknown task id ${String(taskId)}`);
        else if (covered.has(taskId)) errors.push(`${label}.task_ids: task ${taskId} is grouped more than once`);
        covered.add(taskId);
      }
    }
    for (const field of ['entry_condition', 'exit_condition', 'owner_boundary']) {
      if (typeof phase[field] !== 'string' || phase[field].trim().length < 8 || hasSpecPlaceholders(phase[field])) {
        errors.push(`${label}.${field}: must be concrete and non-placeholder`);
      }
    }
  }
  if (phaseList.length > 0) {
    for (const taskId of taskIds) {
      if (!covered.has(taskId)) errors.push(`spec.json.coordination.phases: task ${taskId} is not grouped exactly once`);
    }
  }
  try {
    for (const entry of fs.readdirSync(specDir, { withFileTypes: true })) {
      if (entry.isFile() && /^phase(?:-|_).*\.md$/i.test(entry.name)) {
        errors.push(`${entry.name}: phase files are forbidden; use compact spec.json.coordination.phases metadata`);
      }
    }
  } catch (_) {}
  return { tasksRequired, phases: phaseList, taskTriggers };
}

function validateTaskTriggerEvidence(spec, topology, taskFiles, taskRecords, errors) {
  if (!Array.isArray(topology.taskTriggers) || topology.taskTriggers.length === 0) return;
  const triggers = new Set(topology.taskTriggers);
  const dependencyCount = Object.values(spec.task_registry || {}).reduce((count, entry) => (
    count + (Array.isArray(entry?.dependencies) ? entry.dependencies.length : 0)
  ), 0);
  const artifactTaskCount = Object.values(spec.task_registry || {}).filter((entry) => (
    Array.isArray(entry?.artifacts) && entry.artifacts.length > 0
  )).length;
  const parallelTaskCount = taskFiles.filter((taskFile) => taskRecords.get(taskFile)?.parallel === true).length;
  const writeOwners = new Map();
  let tasksWithWriteOwnership = 0;
  for (const taskFile of taskFiles) {
    const writePaths = new Set((taskRecords.get(taskFile)?.rows || [])
      .filter((row) => ['create', 'modify', 'delete'].includes(row.action))
      .map((row) => path.normalize(row.path).split(path.sep).join('/')));
    if (writePaths.size > 0) tasksWithWriteOwnership += 1;
    for (const filePath of writePaths) {
      if (!writeOwners.has(filePath)) writeOwners.set(filePath, []);
      writeOwners.get(filePath).push(taskFile);
    }
  }
  const overlappingWrite = [...writeOwners.entries()]
    .find(([, owners]) => owners.length > 1);
  const hasDistinctOwnership = taskFiles.length >= 2
    && tasksWithWriteOwnership >= 2
    && overlappingWrite === undefined;
  const evidence = {
    distinct_ownership: hasDistinctOwnership,
    real_dependency: dependencyCount > 0,
    durable_transition: topology.phases.length > 0,
    separate_proof: artifactTaskCount > 0,
    parallel_coordination: parallelTaskCount > 0,
  };
  for (const trigger of triggers) {
    if (TASK_TRIGGER_VALUES.has(trigger) && evidence[trigger] !== true) {
      if (trigger === 'distinct_ownership') {
        const overlap = overlappingWrite
          ? `; shared write path ${overlappingWrite[0]} is declared by ${overlappingWrite[1].join(', ')}`
          : '';
        errors.push(
          'spec.json.coordination.task_triggers: distinct_ownership requires at least 2 tasks with distinct, ' +
          `non-overlapping Related Files Create/Modify/Delete boundaries${overlap}`,
        );
      } else {
        errors.push(`spec.json.coordination.task_triggers: ${trigger} has no matching physical task inventory or graph evidence`);
      }
    }
  }
  for (const [trigger, present] of Object.entries(evidence)) {
    if (present && trigger !== 'distinct_ownership' && !triggers.has(trigger)) {
      errors.push(`spec.json.coordination.task_triggers: physical task inventory or graph requires ${trigger}`);
    }
  }
}

function criterionReferences(content) {
  const ids = new Set();
  for (const match of semanticMarkdown(content).matchAll(/\bR?(\d+\.\d+)\b/gi)) ids.add(`R${match[1]}`);
  return ids;
}

function namedContractDefinitions(designText, errors) {
  const ids = new Set();
  for (const match of semanticMarkdown(designText).matchAll(/^#{3,6}\s+(C\d+)\s+(?:—|-)\s+.+$/gim)) {
    const id = match[1].toUpperCase();
    if (ids.has(id)) errors.push(`design.md: duplicate named contract ID ${id}`);
    ids.add(id);
  }
  return ids;
}

function validateNamedContractReferences(designText, taskContents, errors) {
  const definitions = namedContractDefinitions(designText, errors);
  for (const [taskPath, content] of taskContents) {
    if (taskFormat(content) !== 'v2') continue;
    const scope = extractSection(content, 'Scope and Typed Anchors') || '';
    const declared = sectionFieldValues(scope, ['Contracts/Invariants', 'Contracts', 'Invariants']).join(' ');
    for (const id of declared.match(/\bC\d+\b/gi) || []) {
      if (!definitions.has(id.toUpperCase())) errors.push(`${taskPath}: references unknown named contract ${id.toUpperCase()}`);
    }
    if (/<!--\s*contract:[A-Za-z0-9_.-]+\s*-->/.test(content)) {
      errors.push(`${taskPath}: Specs v2 tasks reference named contract IDs and must not copy canonical contract blocks`);
    }
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function semanticDigestState(spec) {
  const taskRegistry = isPlainObject(spec.task_registry)
    ? Object.fromEntries(Object.entries(spec.task_registry).map(([taskPath, entry]) => [taskPath, {
      id: entry?.id ?? null,
      dependencies: entry?.dependencies ?? null,
      ...(Object.prototype.hasOwnProperty.call(entry || {}, 'artifacts') ? { artifacts: entry.artifacts } : {}),
    }]))
    : spec.task_registry ?? null;
  return {
    scope_lock: spec.scope_lock ?? null,
    task_files: spec.task_files ?? null,
    task_registry: taskRegistry,
    coordination: spec.coordination ?? null,
    semantic_model: spec.semantic_model ?? null,
    decisions: spec.decisions ?? null,
    workflow_policy: spec.workflow_policy ?? null,
  };
}

function semanticTaskMarkdown(content) {
  let fence = null;
  let inComment = false;
  return String(content).split(/(\r?\n)/).map((line) => {
    if (/^\r?\n$/.test(line)) return line;
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      return line;
    }
    const commentStart = line.indexOf('<!--');
    if (commentStart >= 0) {
      if (line.indexOf('-->', commentStart + 4) < 0) inComment = true;
      return line;
    }
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      const character = marker[1][0];
      const length = marker[1].length;
      if (fence === null) fence = { character, length };
      else if (character === fence.character && length >= fence.length) fence = null;
      return line;
    }
    if (fence !== null) return line;
    return line
      .replace(/^(\*\*Status:\*\*[ \t]*)(?:pending|in_progress|blocked|done)([ \t]*)$/, '$1<lifecycle-status>$2')
      .replace(/^(\s*[-*+]\s+\[)[ xX](\])/, '$1 $2');
  }).join('');
}

function computeSemanticDigest(specDir) {
  const errors = [];
  const canonicalSpecDir = validateSpecRoot(specDir, errors);
  if (!canonicalSpecDir) return { errors, digest: null };
  const specArtifact = inspectSpecArtifact(
    specDir, canonicalSpecDir, 'spec.json', 'spec.json', errors, { required: true },
  );
  const spec = specArtifact ? readJson(specArtifact.path, errors) : null;
  const artifacts = [];
  for (const relativePath of ['requirements.md', 'design.md']) {
    const artifact = inspectSpecArtifact(
      specDir, canonicalSpecDir, relativePath, relativePath, errors, { required: true },
    );
    if (artifact) artifacts.push([relativePath, fs.readFileSync(artifact.path)]);
  }
  const research = inspectSpecArtifact(specDir, canonicalSpecDir, 'research.md', 'research.md', errors);
  if (research) artifacts.push(['research.md', fs.readFileSync(research.path)]);
  for (const taskFile of listTaskFiles(specDir, canonicalSpecDir, errors)) {
    const artifact = inspectSpecArtifact(specDir, canonicalSpecDir, taskFile, taskFile, errors, { required: true });
    if (artifact) artifacts.push([taskFile, Buffer.from(semanticTaskMarkdown(fs.readFileSync(artifact.path, 'utf8')), 'utf8')]);
  }
  if (!isPlainObject(spec) || errors.length > 0) return { errors, digest: null };
  const hash = crypto.createHash('sha256');
  for (const [relativePath, bytes] of artifacts) {
    hash.update(relativePath, 'utf8');
    hash.update('\0');
    hash.update(String(bytes.length), 'utf8');
    hash.update('\0');
    hash.update(bytes);
    hash.update('\0');
  }
  const state = Buffer.from(stableJson(semanticDigestState(spec)), 'utf8');
  hash.update('spec.json#semantic-state\0', 'utf8');
  hash.update(String(state.length), 'utf8');
  hash.update('\0');
  hash.update(state);
  return { errors, digest: `sha256:${hash.digest('hex')}` };
}

function designSemanticReviewIds(designText) {
  return new Set([...semanticMarkdown(designText).matchAll(/^#{3,6}\s+([DIC]\d+)\s+(?:—|-)\s+.+$/gim)]
    .map((match) => match[1].toUpperCase()));
}

function concreteSemanticReviewText(value) {
  return typeof value === 'string'
    && value.trim() === value
    && meaningfulObligationValue(value)
    && !hasSpecPlaceholders(value);
}

function validateSemanticReview(specDir, spec, context, subCriteriaIds, designText, errors) {
  const review = spec.validation?.semantic_review;
  if (!isPlainObject(review)) {
    if (!context.legacy) errors.push('spec.json.validation.semantic_review: Specs v2 requires the canonical object');
    return;
  }
  const fields = Object.keys(review).sort();
  if (JSON.stringify(fields) !== JSON.stringify([...SEMANTIC_REVIEW_FIELDS].sort())) {
    errors.push(`spec.json.validation.semantic_review: fields must be exactly ${SEMANTIC_REVIEW_FIELDS.join(', ')}`);
  }
  if (!SEMANTIC_REVIEW_STATUSES.has(review.status)) {
    errors.push('spec.json.validation.semantic_review.status: must be not-run or completed');
    return;
  }
  if (!Array.isArray(review.reviewed_criteria)) {
    errors.push('spec.json.validation.semantic_review.reviewed_criteria: must be an array');
  }
  if (!Array.isArray(review.counterexamples)) {
    errors.push('spec.json.validation.semantic_review.counterexamples: must be an array');
  }
  if (review.status === 'not-run') {
    if (spec.ready_for_implementation === true) {
      errors.push('spec.json.ready_for_implementation: requires validation.semantic_review.status completed');
    }
    if (review.reviewed_artifact_digest !== null || review.reviewed_criteria?.length > 0
      || review.counterexamples?.length > 0) {
      errors.push('spec.json.validation.semantic_review: not-run state must keep receipt fields null or empty');
    }
    return;
  }

  if (!SHA256_RE.test(review.reviewed_artifact_digest || '')) {
    errors.push('spec.json.validation.semantic_review.reviewed_artifact_digest: must be sha256:<64 lowercase hex>');
  } else {
    const computed = computeSemanticDigest(specDir);
    if (computed.errors.length > 0) {
      errors.push(`spec.json.validation.semantic_review.reviewed_artifact_digest: cannot recompute (${computed.errors.join('; ')})`);
    } else if (review.reviewed_artifact_digest !== computed.digest) {
      errors.push('spec.json.validation.semantic_review.reviewed_artifact_digest: stale or does not match final artifacts and canonical state');
    }
  }
  if (context.policy?.assurance_level === 'Strict') errors.push('spec.json.validation.semantic_review: Strict assurance is no longer supported (its reviewer attestation hook was removed); move the packet to plan.md with flat task files');

  const criteria = Array.isArray(review.reviewed_criteria) ? review.reviewed_criteria : [];
  const criterionSet = new Set(criteria);
  if (criterionSet.size !== criteria.length) {
    errors.push('spec.json.validation.semantic_review.reviewed_criteria: must not contain duplicates');
  }
  for (const criterion of criteria) {
    if (!subCriteriaIds.includes(criterion)) {
      errors.push(`spec.json.validation.semantic_review.reviewed_criteria: unknown criterion ${String(criterion)}`);
    }
  }
  for (const criterion of subCriteriaIds) {
    if (!criterionSet.has(criterion)) {
      errors.push(`spec.json.validation.semantic_review.reviewed_criteria: missing criterion ${criterion}`);
    }
  }

  const designIds = designSemanticReviewIds(designText);
  const coveredCriteria = new Set();
  for (const [index, counterexample] of (Array.isArray(review.counterexamples) ? review.counterexamples : []).entries()) {
    const label = `spec.json.validation.semantic_review.counterexamples[${index}]`;
    const expectedFields = ['criterion', 'scenario', 'expected', 'design_reference'];
    if (!isPlainObject(counterexample)
      || JSON.stringify(Object.keys(counterexample).sort()) !== JSON.stringify(expectedFields.sort())) {
      errors.push(`${label}: must contain exactly criterion, scenario, expected, design_reference`);
      continue;
    }
    if (!subCriteriaIds.includes(counterexample.criterion)) {
      errors.push(`${label}.criterion: unknown criterion ${String(counterexample.criterion)}`);
    } else if (coveredCriteria.has(counterexample.criterion)) {
      errors.push(`${label}.criterion: duplicate counterexample for ${counterexample.criterion}`);
    } else {
      coveredCriteria.add(counterexample.criterion);
    }
    for (const field of ['scenario', 'expected']) {
      if (!concreteSemanticReviewText(counterexample[field])) {
        errors.push(`${label}.${field}: must be concrete and non-placeholder`);
      }
    }
    if (typeof counterexample.design_reference !== 'string'
      || !designIds.has(counterexample.design_reference.toUpperCase())) {
      errors.push(`${label}.design_reference: must reference a real D/I/C ID in design.md`);
    }
  }
  for (const criterionId of subCriteriaIds) {
    if (!coveredCriteria.has(criterionId)) {
      errors.push(`spec.json.validation.semantic_review.counterexamples: missing concrete counterexample for ${criterionId}`);
    }
  }
}

function exactTaskTarget(value) {
  return typeof value === 'string' && value.trim() === value && value !== ''
    && !unsafeRelatedPath(value) && !/[*?{}[\]]/.test(value) && !/[\\/]$/.test(value);
}

function targetsContend(left, right) {
  const a = left.replace(/\\/g, '/').replace(/\/+$/, '');
  const b = right.replace(/\\/g, '/').replace(/\/+$/, '');
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function task21Anchors(taskPath, content, errors) {
  const section = extractSection(content, 'Anchors and Ownership') || '';
  const tableCount = (section.match(/^\s*\|\s*ID\s*\|\s*Type\s*\|\s*Target\s*\|\s*Role\s*\|\s*Access\s*\|\s*Action\s*\|\s*$/gim) || []).length;
  if (tableCount !== 1) {
    errors.push(`${taskPath}: Anchors and Ownership requires one table ID | Type | Target | Role | Access | Action`);
    return [];
  }
  if (hasHeading(content, 'Related Files')) {
    errors.push(`${taskPath}: Related Files is not canonical in schema 2.1; use Anchors and Ownership only`);
  }
  return parseCanonicalAnchors(content, { label: taskPath, design: false }, errors);
}

function canonicalTaskCriterionIds(section) {
  return [...new Set([...String(section || '').matchAll(/^\s*[-*+]\s+(?:\*\*)?(R\d+\.\d+)(?:\*\*)?\s*:/gim)]
    .map((match) => match[1].toUpperCase()))].sort();
}

function canonicalTaskChangeIds(section) {
  const ids = [];
  for (const match of String(section || '').matchAll(/_Requirements:\s*([^_\n]+)_/gi)) {
    for (const token of match[1].split(',')) {
      const id = token.trim().match(/^(?:R)?(\d+\.\d+)$/i);
      if (id) ids.push(`R${id[1]}`);
    }
  }
  return [...new Set(ids)].sort();
}

function hasConcreteTaskProse(section) {
  return meaningfulMarkdownLines(section).some((line) => (
    line.length >= 16
    && !/^(?:implement|update|handle|verify|deliver|support|works?|done|task outcome|in scope|out of scope)\.?$/i.test(line)
    && !/\b(?:as needed|appropriate behavior|expected behavior|the feature|this task|relevant files?)\b/i.test(line)
  ));
}

function validateTask21(taskPath, content, entry, specReady, errors) {
  for (const section of TASK_21_SECTIONS) {
    if (headingCount(content, section) !== 1) errors.push(`${taskPath}: requires exactly one ## ${section} section`);
  }
  const h2 = [...content.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]);
  for (const heading of h2) if (!TASK_21_SECTIONS.includes(heading)) {
    errors.push(`${taskPath}: schema 2.1 task has non-canonical section ## ${heading}`);
  }
  validateTaskIdentity(taskPath, content, entry, errors);
  validateTaskDependencyHeader(taskPath, content, entry, true, errors);
  validateTaskStatusHeader(taskPath, content, entry, specReady, errors);
  validateVerificationPlan(taskPath, content, errors);
  validateTaskPlaceholders(taskPath, content, errors, []);
  const outcome = extractSection(content, 'Outcome') || '';
  const scope = extractSection(content, 'Scope') || '';
  const changes = extractSection(content, 'Changes') || '';
  const acceptance = extractSection(content, 'Acceptance') || '';
  if (!hasConcreteTaskProse(outcome)) errors.push(`${taskPath}: Outcome must be concrete and non-generic`);
  if (!hasConcreteTaskProse(scope)
    || !/^\s*[-*+]\s+(?:\*\*)?In scope(?:\*\*)?\s*:/im.test(scope)
    || !/^\s*[-*+]\s+(?:\*\*)?Out of scope(?:\*\*)?\s*:/im.test(scope)) {
    errors.push(`${taskPath}: Scope requires concrete In scope and Out of scope boundaries`);
  }
  if (!hasActionableTaskStep(changes)) errors.push(`${taskPath}: Changes requires an actionable checkbox`);
  const changeCriteria = canonicalTaskChangeIds(changes);
  const acceptanceCriteria = canonicalTaskCriterionIds(acceptance);
  const rawChangeCriteria = [...changes.matchAll(/_Requirements:\s*([^_\n]+)_/gi)]
    .flatMap((match) => match[1].split(','))
    .map((token) => token.trim().replace(/^R/i, ''))
    .filter((token) => /^\d+\.\d+$/.test(token));
  const rawAcceptanceCriteria = [...acceptance.matchAll(/^\s*[-*+]\s+(?:\*\*)?(R\d+\.\d+)(?:\*\*)?\s*:/gim)]
    .map((match) => match[1].toUpperCase());
  if (new Set(rawChangeCriteria).size !== rawChangeCriteria.length) errors.push(`${taskPath}: Changes contains duplicate RN.M authority`);
  if (new Set(rawAcceptanceCriteria).size !== rawAcceptanceCriteria.length) errors.push(`${taskPath}: Acceptance contains duplicate RN.M authority`);
  if (!hasConcreteTaskProse(acceptance)) errors.push(`${taskPath}: Acceptance must declare a concrete implementation or verification outcome`);
  if (JSON.stringify(changeCriteria) !== JSON.stringify(acceptanceCriteria)) {
    errors.push(`${taskPath}: Changes and Acceptance must trace the same exact RN.M criteria`);
  }
  const verificationRefs = sectionFieldValues(extractSection(content, 'Verification Plan') || '', ['Verification ref'])
    .map((value) => String(value).toUpperCase().match(/\bV\d+(?:\.\d+)?\b/)?.[0])
    .filter(Boolean);
  if (verificationRefs.length !== 1 || !/^V\d+(?:\.\d+)?$/.test(verificationRefs[0])) {
    errors.push(`${taskPath}: Verification Plan requires exactly one canonical V reference`);
  }
  const taskRoles = sectionFieldValues(extractSection(content, 'Verification Plan') || '', ['Task role'])
    .map((value) => String(value).toLowerCase().match(/\b(subject|verifier)\b/)?.[1])
    .filter(Boolean);
  if (taskRoles.length !== 1) errors.push(`${taskPath}: Verification Plan requires exactly one Task role: subject or verifier`);
  return {
    anchors: task21Anchors(taskPath, content, errors),
    criteria: acceptanceCriteria,
    verificationRefs,
    taskRole: taskRoles[0] || null,
  };
}

function semanticDigest21(specDir, spec, taskFiles) {
  const policy = spec.workflow_policy;
  const semanticState = {
    schema_version: spec.schema_version,
    feature_name: spec.feature_name,
    scope_lock: spec.scope_lock,
    authoring: spec.authoring,
    research: spec.research ?? null,
    workflow_policy: policy,
    coordination: spec.coordination,
    semantic_model: spec.semantic_model,
    task_files: spec.task_files,
    task_registry: Object.fromEntries(taskFiles.map((taskPath) => {
      const entry = spec.task_registry?.[taskPath] || {};
      return [taskPath, { id: entry.id, title: entry.title, dependencies: entry.dependencies, artifacts: entry.artifacts }];
    })),
  };
  const artifacts = {
    state: semanticState,
    requirements: fs.readFileSync(path.join(specDir, 'requirements.md'), 'utf8'),
    design: fs.readFileSync(path.join(specDir, 'design.md'), 'utf8'),
    research: spec.research === 'research.md' && fs.existsSync(path.join(specDir, 'research.md'))
      ? fs.readFileSync(path.join(specDir, 'research.md'), 'utf8') : null,
    tasks: taskFiles.map((taskPath) => [taskPath, semanticTaskMarkdown(fs.readFileSync(path.join(specDir, taskPath), 'utf8'))]),
  };
  return `sha256:${crypto.createHash('sha256').update(stableJson(artifacts)).digest('hex')}`;
}

function computeSemanticDigest21(specDir, spec) {
  const errors = [];
  const canonicalSpecDir = validateSpecRoot(specDir, errors);
  if (!canonicalSpecDir) return { errors, digest: null };
  if (spec === undefined) {
    const specArtifact = inspectSpecArtifact(specDir, canonicalSpecDir, 'spec.json', 'spec.json', errors, { required: true });
    if (specArtifact) spec = readJson(specArtifact.path, errors);
  }
  if (!isPlainObject(spec)) {
    if (errors.length === 0) errors.push('spec.json: must contain a JSON object');
    return { errors, digest: null };
  }
  const requiredArtifacts = ['requirements.md', 'design.md'];
  const contents = new Map();
  for (const relativePath of requiredArtifacts) {
    const artifact = inspectSpecArtifact(specDir, canonicalSpecDir, relativePath, relativePath, errors, { required: true });
    if (artifact) contents.set(relativePath, fs.readFileSync(artifact.path, 'utf8'));
  }
  const taskFiles = listTaskFiles(specDir, canonicalSpecDir, errors);
  const projection = SEMANTIC.modelFromMarkdown(canonicalSpecDir, spec);
  errors.push(...projection.errors.map((error) => `semantic projection: ${error}`));
  let digestSpec = spec;
  if (!isPlainObject(spec.semantic_model)) {
    digestSpec = { ...spec, semantic_model: projection.model };
  } else {
    errors.push(...SEMANTIC.validateSemanticModel(spec.semantic_model, spec));
    if (SEMANTIC.stableJson(spec.semantic_model) !== SEMANTIC.stableJson(projection.model)) {
      errors.push('spec.json.semantic_model: digest refuses Markdown projection drift');
    }
  }
  const verificationDefinitions = new Map(((spec.semantic_model || projection.model).verification_definitions || [])
    .map((definition) => [definition.id, definition]));
  const declared = Array.isArray(spec.task_files) ? [...spec.task_files].sort() : [];
  if (taskFiles.length === 0) {
    if (Object.prototype.hasOwnProperty.call(spec, 'task_files') || Object.prototype.hasOwnProperty.call(spec, 'task_registry')) {
      errors.push('schema 2.1 digest refuses task inventory without physical tasks');
    }
  } else {
    if (JSON.stringify(declared) !== JSON.stringify(taskFiles)) errors.push('schema 2.1 digest requires task_files to match physical tasks exactly');
    if (!isPlainObject(spec.task_registry) || Object.keys(spec.task_registry).sort().join(',') !== taskFiles.join(',')) {
      errors.push('schema 2.1 digest requires task_registry to match physical tasks exactly');
    }
  }
  validateResearchLifecycle21(specDir, canonicalSpecDir, spec, errors);
  const anchorsByTask = new Map();
  const criteriaByTask = new Map();
  for (const taskPath of taskFiles) {
    const artifact = inspectSpecArtifact(specDir, canonicalSpecDir, taskPath, taskPath, errors, { required: true });
    if (!artifact) continue;
    const content = fs.readFileSync(artifact.path, 'utf8');
    for (const section of TASK_21_SECTIONS) if (headingCount(content, section) !== 1) {
      errors.push(`${taskPath}: digest requires exactly one ## ${section} section`);
    }
    validateTaskIdentity(taskPath, content, spec.task_registry?.[taskPath], errors);
    anchorsByTask.set(taskPath, task21Anchors(taskPath, content, errors));
    criteriaByTask.set(taskPath, canonicalTaskCriterionIds(extractSection(content, 'Acceptance') || ''));
  }
  if (contents.has('design.md')) {
    validateBoundaries21(
      spec, taskFiles, spec.task_registry || {}, anchorsByTask, criteriaByTask,
      contents.get('design.md'), verificationDefinitions, errors,
    );
  }
  if (errors.length > 0) return { errors, digest: null };
  return { errors, digest: semanticDigest21(specDir, digestSpec, taskFiles) };
}

function validateSemanticReviewFindings(review, errors) {
  if (!Array.isArray(review.findings)) {
    errors.push('spec.json.validation.semantic_review.findings: must be an array');
    return;
  }
  const findingIds = new Set();
  for (const [index, finding] of review.findings.entries()) {
    const label = `semantic_review.findings[${index}]`;
    if (!isPlainObject(finding) || Object.keys(finding).sort().join(',') !== [...C2_FINDING_FIELDS].sort().join(',')) {
      errors.push(`${label}: fields must be exactly ${C2_FINDING_FIELDS.join(', ')}`); continue;
    }
    if (typeof finding.id !== 'string' || finding.id === '' || findingIds.has(finding.id)) errors.push(`${label}.id: must be a unique non-empty string`);
    findingIds.add(finding.id);
    if (!C2_FINDING_SEVERITIES.has(finding.severity)) errors.push(`${label}.severity: must be Critical, High, Medium, or Low`);
    if (typeof finding.location !== 'string' || finding.location.trim() === '') errors.push(`${label}.location: must be a non-empty string`);
    if (!concreteSemanticReviewText(finding.summary)) errors.push(`${label}.summary: must be concrete with minimum length 8`);
    if (typeof finding.blocking !== 'boolean') errors.push(`${label}.blocking: must be boolean`);
    if (!C2_FINDING_DISPOSITIONS.has(finding.disposition)) errors.push(`${label}.disposition: must be open, accepted, or mitigated`);
  }
}

function validateSemanticReviewUnresolvedDecisions(review, errors) {
  if (!Array.isArray(review.unresolved_decisions)) {
    errors.push('spec.json.validation.semantic_review.unresolved_decisions: must be an array');
    return;
  }
  const decisionIds = new Set();
  for (const [index, decision] of review.unresolved_decisions.entries()) {
    const label = `semantic_review.unresolved_decisions[${index}]`;
    if (!isPlainObject(decision) || Object.keys(decision).sort().join(',') !== [...C2_UNRESOLVED_DECISION_FIELDS].sort().join(',')) {
      errors.push(`${label}: fields must be exactly ${C2_UNRESOLVED_DECISION_FIELDS.join(', ')}`); continue;
    }
    if (typeof decision.id !== 'string' || decision.id === '' || decisionIds.has(decision.id)) errors.push(`${label}.id: must be a unique non-empty string`);
    decisionIds.add(decision.id);
    if (!concreteSemanticReviewText(decision.summary)) errors.push(`${label}.summary: must be concrete with minimum length 8`);
    if (typeof decision.blocking !== 'boolean') errors.push(`${label}.blocking: must be boolean`);
  }
}

function validateSemanticReviewGraphCoverage(review, errors) {
  if (!Array.isArray(review.graph_coverage)) {
    errors.push('spec.json.validation.semantic_review.graph_coverage: must be an array');
    return;
  }
  const coveredSurfaces = new Set();
  for (const [index, coverage] of review.graph_coverage.entries()) {
    const label = `semantic_review.graph_coverage[${index}]`;
    if (!isPlainObject(coverage) || Object.keys(coverage).sort().join(',') !== [...C2_GRAPH_COVERAGE_FIELDS].sort().join(',')) {
      errors.push(`${label}: fields must be exactly ${C2_GRAPH_COVERAGE_FIELDS.join(', ')}`); continue;
    }
    if (!C2_GRAPH_COVERAGE_SURFACES.includes(coverage.surface)) errors.push(`${label}.surface: must be a canonical graph coverage surface`);
    else coveredSurfaces.add(coverage.surface);
    if (typeof coverage.covered !== 'boolean') errors.push(`${label}.covered: must be boolean`);
    if (typeof coverage.notes !== 'string') errors.push(`${label}.notes: must be a string`);
  }
  for (const surface of C2_GRAPH_COVERAGE_SURFACES) if (!coveredSurfaces.has(surface)) {
    errors.push(`spec.json.validation.semantic_review.graph_coverage: missing required surface ${surface}`);
  }
}

function validateSemanticReviewerEvidence(review, errors) {
  if (review.reviewer_evidence === null) return;
  if (!isPlainObject(review.reviewer_evidence)
    || Object.keys(review.reviewer_evidence).sort().join(',') !== [...C2_REVIEWER_EVIDENCE_FIELDS].sort().join(',')) {
    errors.push(`spec.json.validation.semantic_review.reviewer_evidence: fields must be exactly ${C2_REVIEWER_EVIDENCE_FIELDS.join(', ')} or null`);
    return;
  }
  if (!C2_REVIEWER_EVIDENCE_ASSURANCES.has(review.reviewer_evidence.assurance)) {
    errors.push('spec.json.validation.semantic_review.reviewer_evidence.assurance: must be Routine, Elevated, or Strict');
  }
  if (!concreteSemanticReviewText(review.reviewer_evidence.summary)) {
    errors.push('spec.json.validation.semantic_review.reviewer_evidence.summary: must be concrete with minimum length 8');
  }
}

function validateSemanticReview21(specDir, spec, criteria, designIds, verificationDefs, errors) {
  const review = spec.validation?.semantic_review;
  if (!isPlainObject(review) || Object.keys(review).sort().join(',') !== [...C2_FIELDS].sort().join(',')) {
    errors.push(`spec.json.validation.semantic_review: schema 2.1 fields must be exactly ${C2_FIELDS.join(', ')}`);
    return;
  }
  if (!['not-run', 'completed'].includes(review.status)) errors.push('spec.json.validation.semantic_review.status: must be not-run or completed');
  if (review.status === 'not-run') {
    if (review.semantic_digest !== null || review.verdict !== null || review.lifecycle_disposition !== null
      || review.reviewer_evidence !== null || review.repair_round !== 0
      || review.findings?.length || review.unresolved_decisions?.length
      || review.graph_coverage?.length || review.reviewed_criteria?.length || review.counterexamples?.length) {
      errors.push('spec.json.validation.semantic_review: not-run receipt must keep verdict, lifecycle_disposition, and reviewer_evidence null, repair_round 0, and every array empty');
    }
    if (spec.ready_for_implementation === true) errors.push('spec.json.ready_for_implementation: requires completed semantic review');
    return;
  }
  const computed = computeSemanticDigest21(specDir, spec);
  if (computed.errors.length > 0) {
    errors.push(`spec.json.validation.semantic_review.semantic_digest: cannot recompute malformed physical topology (${computed.errors.join('; ')})`);
  } else if (review.semantic_digest !== computed.digest) {
    errors.push('spec.json.validation.semantic_review.semantic_digest: stale for current authoring, policy, topology, or research');
  }
  if (typeof review.semantic_digest !== 'string' || !SHA256_RE.test(review.semantic_digest)) {
    errors.push('spec.json.validation.semantic_review.semantic_digest: must be sha256:<64 lowercase hex> when completed');
  }
  if (!C2_VERDICTS.has(review.verdict)) errors.push('spec.json.validation.semantic_review.verdict: must be PASS or FAIL when completed');
  if (!C2_LIFECYCLE_DISPOSITIONS.has(review.lifecycle_disposition)) errors.push('spec.json.validation.semantic_review.lifecycle_disposition: must be CONTINUE or BLOCKED when completed');
  if (!Number.isInteger(review.repair_round) || review.repair_round < 0 || review.repair_round > 2) {
    errors.push('spec.json.validation.semantic_review.repair_round: must be an integer 0..2 when completed');
  }
  validateSemanticReviewFindings(review, errors);
  validateSemanticReviewUnresolvedDecisions(review, errors);
  validateSemanticReviewGraphCoverage(review, errors);
  validateSemanticReviewerEvidence(review, errors);
  if (!Array.isArray(review.reviewed_criteria) || new Set(review.reviewed_criteria).size !== review.reviewed_criteria.length) {
    errors.push('spec.json.validation.semantic_review.reviewed_criteria: must be a unique array');
  } else {
    for (const criterion of criteria) if (!review.reviewed_criteria.includes(criterion)) errors.push(`semantic review missing criterion ${criterion}`);
    for (const criterion of review.reviewed_criteria) if (!criteria.includes(criterion)) errors.push(`semantic review has unknown criterion ${criterion}`);
  }
  if (!Array.isArray(review.counterexamples)) {
    errors.push('spec.json.validation.semantic_review.counterexamples: must be an array');
    return;
  }
  const fingerprints = new Map();
  const covered = new Set();
  for (const [index, counterexample] of review.counterexamples.entries()) {
    const label = `semantic_review.counterexamples[${index}]`;
    const expected = ['criterion', 'case_kind', 'scenario', 'expected', 'decision_refs', 'verification_ref'];
    if (!isPlainObject(counterexample) || Object.keys(counterexample).sort().join(',') !== expected.sort().join(',')) {
      errors.push(`${label}: fields must be exactly ${expected.join(', ')}`);
      continue;
    }
    if (!criteria.includes(counterexample.criterion)) errors.push(`${label}.criterion: unknown criterion ${counterexample.criterion}`);
    if (covered.has(counterexample.criterion)) errors.push(`${label}.criterion: duplicate counterexample for ${counterexample.criterion}`);
    covered.add(counterexample.criterion);
    if (!['negative', 'boundary', 'failure', 'recovery', 'adversarial'].includes(counterexample.case_kind)) {
      errors.push(`${label}.case_kind: must name a concrete semantic case kind`);
    }
    for (const field of ['scenario', 'expected']) {
      const value = counterexample[field];
      if (!concreteSemanticReviewText(value) || /^(?:works?|fails?|handles? (?:it|error)|correct behavior|expected behavior)$/i.test(String(value).trim())) {
        errors.push(`${label}.${field}: obvious placeholder or generic boilerplate; structural checks do not replace semantic judgment`);
      }
    }
    const fingerprint = [counterexample.case_kind, counterexample.scenario, counterexample.expected]
      .map((value) => String(value).toLowerCase().replace(/\bR\d+(?:\.\d+)?\b/gi, '').replace(/[^a-z0-9]+/g, ' ').trim()).join('|');
    if (fingerprints.has(fingerprint)) {
      errors.push(`${label}: normalized duplicate counterexample fingerprint also used by ${fingerprints.get(fingerprint)}; structural checks do not replace semantic judgment`);
    } else fingerprints.set(fingerprint, counterexample.criterion);
    if (!Array.isArray(counterexample.decision_refs) || counterexample.decision_refs.length === 0) {
      errors.push(`${label}.decision_refs: requires at least one D/I/C ref`);
    } else for (const ref of counterexample.decision_refs) {
      if (!/^[DIC]\d+(?:\.\d+)?$/i.test(ref) || !designIds.has(ref.toUpperCase())) errors.push(`${label}.decision_refs: ${ref} does not exist in design.md`);
    }
    const verificationRef = String(counterexample.verification_ref || '').toUpperCase();
    const definition = verificationDefs.get(verificationRef);
    if (!definition) errors.push(`${label}.verification_ref: ${verificationRef || '(empty)'} has no V definition in design.md`);
    else {
      const definitionCriteria = [...definition.subject_criteria, ...definition.proof_criteria];
      if (!definitionCriteria.includes(counterexample.criterion)) errors.push(`${label}.verification_ref: ${verificationRef} does not trace criterion ${counterexample.criterion}`);
      for (const ref of counterexample.decision_refs || []) {
        if (!definition.decision_refs.includes(ref.toUpperCase())) errors.push(`${label}.verification_ref: ${verificationRef} does not trace decision ${ref}`);
      }
    }
  }
  for (const criterion of criteria) if (!covered.has(criterion)) errors.push(`semantic review counterexamples missing criterion ${criterion}`);
  if (spec.workflow_policy?.assurance_level === 'Strict') errors.push('spec.json.validation.semantic_review: Strict assurance is no longer supported (its reviewer attestation hook was removed); move the packet to plan.md with flat task files');
}

function computeLineageId(featureName, createdAt) {
  return `sha256:${crypto.createHash('sha256').update(SEMANTIC.stableJson({ feature_name: featureName, created_at: createdAt })).digest('hex')}`;
}

// C13 SemanticReviewHistory: structural completeness, types, nullability,
// enums, cardinality, and whole-lineage digest dedupe only — never semantic
// judgment of the epoch/attempt-index derivation itself (that is the R1-02
// finalizer's own write-time responsibility, see C3/D4).
function validateSemanticReviewHistory21(spec, errors) {
  const history = spec.validation?.semantic_review_history;
  if (!isPlainObject(history) || Object.keys(history).sort().join(',') !== [...C13_HISTORY_FIELDS].sort().join(',')) {
    errors.push(`spec.json.validation.semantic_review_history: fields must be exactly ${C13_HISTORY_FIELDS.join(', ')}`);
    return;
  }
  const expectedLineageId = computeLineageId(spec.feature_name, spec.created_at);
  if (history.lineage_id !== expectedLineageId) {
    errors.push('spec.json.validation.semantic_review_history.lineage_id: must be sha256 of feature_name and created_at; callers never set it directly');
  }
  if (!Array.isArray(history.entries)) {
    errors.push('spec.json.validation.semantic_review_history.entries: must be an array');
    return;
  }
  const digestsSeen = new Set();
  for (const [index, entry] of history.entries.entries()) {
    const label = `semantic_review_history.entries[${index}]`;
    if (!isPlainObject(entry) || Object.keys(entry).sort().join(',') !== [...C13_ENTRY_FIELDS].sort().join(',')) {
      errors.push(`${label}: fields must be exactly ${C13_ENTRY_FIELDS.join(', ')}`); continue;
    }
    if (entry.sequence !== index) errors.push(`${label}.sequence: must start at 0 and increase by exactly 1 per real append`);
    if (typeof entry.semantic_digest !== 'string' || !SHA256_RE.test(entry.semantic_digest)) errors.push(`${label}.semantic_digest: must be sha256:<64 lowercase hex>`);
    if (typeof entry.review_receipt_digest !== 'string' || !SHA256_RE.test(entry.review_receipt_digest)) {
      errors.push(`${label}.review_receipt_digest: must be sha256:<64 lowercase hex>`);
    } else if (digestsSeen.has(entry.review_receipt_digest)) {
      errors.push(`${label}.review_receipt_digest: replays an existing entry's digest anywhere in the lineage; a replay must not be appended twice`);
    } else digestsSeen.add(entry.review_receipt_digest);
    if (!C2_VERDICTS.has(entry.verdict)) errors.push(`${label}.verdict: must be PASS or FAIL`);
    if (!C2_LIFECYCLE_DISPOSITIONS.has(entry.lifecycle_disposition)) errors.push(`${label}.lifecycle_disposition: must be CONTINUE or BLOCKED`);
    if (!Number.isInteger(entry.blocking_count) || entry.blocking_count < 0) errors.push(`${label}.blocking_count: must be a non-negative integer`);
    if (!Number.isInteger(entry.attempt_index) || entry.attempt_index < 0 || entry.attempt_index > 2) errors.push(`${label}.attempt_index: must be an integer 0..2`);
    if (!Number.isInteger(entry.review_epoch) || entry.review_epoch < 0) errors.push(`${label}.review_epoch: must be a non-negative integer`);
  }
}

// C16 AuthoringValidationReceipt: structural completeness plus the fail-closed
// freshness check (I20/R3.8) — an authoring.<field> reading `validated`
// without a matching fresh digest is a hard structural failure here, not a
// silent downgrade to draft.
function validateAuthoringValidation21(specDir, spec, errors) {
  const receipt = spec.validation?.authoring_validation;
  if (receipt !== null) {
    if (!isPlainObject(receipt) || Object.keys(receipt).sort().join(',') !== [...C16_FIELDS].sort().join(',')) {
      errors.push(`spec.json.validation.authoring_validation: fields must be exactly ${C16_FIELDS.join(', ')} or null`);
      return;
    }
    if (receipt.schema_version !== '1') errors.push('spec.json.validation.authoring_validation.schema_version: must be exactly "1"');
    for (const stage of ['requirements', 'design', 'research', 'tasks']) {
      const label = `spec.json.validation.authoring_validation.${stage}`;
      const entry = receipt[stage];
      if (!isPlainObject(entry) || Object.keys(entry).sort().join(',') !== [...C16_STAGE_FIELDS].sort().join(',')) {
        errors.push(`${label}: fields must be exactly ${C16_STAGE_FIELDS.join(', ')}`); continue;
      }
      const sentinel = stage === 'research' ? AUTHORING_DIGEST.RESEARCH_ABSENT_DIGEST
        : stage === 'tasks' ? AUTHORING_DIGEST.TASKS_ABSENT_DIGEST : null;
      const digestValid = typeof entry.digest === 'string'
        && (SHA256_RE.test(entry.digest) || (sentinel !== null && entry.digest === sentinel));
      if (!digestValid) errors.push(`${label}.digest: must be sha256:<64 lowercase hex>${sentinel ? ` or ${sentinel}` : ''}`);
      if (!isIsoTimestamp(entry.validated_at)) errors.push(`${label}.validated_at: must be an ISO timestamp`);
    }
  }
  let freshness;
  try {
    freshness = AUTHORING_DIGEST.assertAuthoringFresh({
      specDir, authoring: spec.authoring, receipt, fields: ['requirements', 'design', 'research', 'tasks'],
    });
  } catch (error) {
    errors.push(`spec.json.validation.authoring_validation: cannot recompute current authoring digests (${error.message})`);
    return;
  }
  for (const field of ['requirements', 'design', 'research', 'tasks']) {
    if (spec.authoring?.[field] === 'validated' && !freshness[field]?.fresh) {
      errors.push(`spec.json.authoring.${field}: reads validated but validation.authoring_validation is absent, missing this field's entry, or digest-mismatched against current bytes (I20/C16)`);
    }
  }
}

function validateDecisionState21(spec, errors) {
  if (!Object.prototype.hasOwnProperty.call(spec, 'decisions')) return;
  if (!Array.isArray(spec.decisions) || spec.decisions.length === 0) {
    errors.push('spec.json.decisions: omit when no decisions exist; otherwise use a non-empty array');
    return;
  }
  const ids = new Set();
  for (const [index, decision] of spec.decisions.entries()) {
    const label = `spec.json.decisions[${index}]`;
    const fields = ['id', 'classification', 'statement', 'status', 'evidence'];
    if (!isPlainObject(decision) || Object.keys(decision).sort().join(',') !== fields.sort().join(',')) {
      errors.push(`${label}: fields must be exactly ${fields.join(', ')}`); continue;
    }
    if (!/^Q\d+$/.test(decision.id) || ids.has(decision.id)) errors.push(`${label}.id: must be a unique Qn id`);
    ids.add(decision.id);
    if (!concreteSemanticReviewText(decision.statement)) errors.push(`${label}.statement: must be concrete`);
    if (decision.classification === 'repository_fact') {
      if (decision.status !== 'grounded' || !concreteSemanticReviewText(decision.evidence)) errors.push(`${label}: repository_fact requires grounded status and repository evidence`);
    } else if (decision.classification === 'reversible_assumption') {
      if (decision.status !== 'recorded' || !concreteSemanticReviewText(decision.evidence)) errors.push(`${label}: reversible_assumption requires recorded status and a bounded reversal boundary`);
    } else if (decision.classification === 'user_owned') {
      if (!['unresolved', 'resolved'].includes(decision.status)) errors.push(`${label}.status: user_owned must be unresolved or resolved`);
      if (decision.status === 'unresolved' && decision.evidence !== null) errors.push(`${label}.evidence: unresolved user_owned decision must be null`);
      if (decision.status === 'resolved' && !concreteSemanticReviewText(decision.evidence)) errors.push(`${label}.evidence: resolved user_owned decision requires the user resolution`);
      if (decision.status === 'unresolved' && spec.ready_for_implementation === true) errors.push(`${label}: unresolved material user-owned decision blocks readiness`);
    } else errors.push(`${label}.classification: must be repository_fact, reversible_assumption, or user_owned`);
  }
}

function canonicalDesignDefinitions(designText, kind, errors) {
  const definitions = new Map();
  const semantic = semanticMarkdown(designText);
  const heading = new RegExp(`^#{3,6}\\s+(${kind}\\d+(?:\\.\\d+)?)\\s+(?:—|-)\\s+(.+)$`, 'gim');
  const matches = [...semantic.matchAll(heading)];
  for (const [index, match] of matches.entries()) {
    const nextHeading = semantic.slice(match.index + match[0].length).search(/^#{1,6}\s+/m);
    const end = nextHeading < 0 ? semantic.length : match.index + match[0].length + nextHeading;
    const definition = semantic.slice(match.index + match[0].length, end).trim();
    const id = match[1].toUpperCase();
    if (definitions.has(id)) errors.push(`design.md: duplicate canonical ${kind} definition ${id}`);
    else definitions.set(id, definition);
  }
  const bullet = new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*(${kind}\\d+(?:\\.\\d+)?)\\*\\*\\s*[:—-]\\s*(.+)$`, 'gim');
  for (const match of semantic.matchAll(bullet)) {
    const id = match[1].toUpperCase();
    if (definitions.has(id)) errors.push(`design.md: duplicate canonical ${kind} definition ${id}`);
    else definitions.set(id, match[2].trim());
  }
  return definitions;
}

function boundaryParticipants(boundary) {
  if (boundary.type === 'ownership' || boundary.type === 'parallel') return boundary.tasks || [];
  if (boundary.type === 'dependency') return [boundary.producer, boundary.consumer];
  if (boundary.type === 'transition') return [boundary.owner, ...(boundary.consumers || [])];
  if (boundary.type === 'proof') return [boundary.subject, boundary.verifier];
  return [];
}

function validateTaskCriterionGraph(
  taskFiles, registry, criteriaByTask, verificationRefsByTask, taskRolesByTask,
  knownCriteria, boundaries, verificationDefinitions, errors,
) {
  if (taskFiles.length === 0) return;
  const owners = new Map(knownCriteria.map((criterion) => [criterion, []]));
  for (const taskPath of taskFiles) {
    for (const criterion of criteriaByTask.get(taskPath) || []) {
      if (!owners.has(criterion)) errors.push(`${taskPath}: Acceptance references unknown criterion ${criterion}`);
      else owners.get(criterion).push(registry[taskPath]?.id);
    }
  }
  for (const [criterion, taskIds] of owners) {
    if (taskIds.length === 0) errors.push(`requirements.md:${criterion}: acceptance criterion not covered by any task`);
    if (taskIds.length > 1) errors.push(`requirements.md:${criterion}: requires exactly one implementation owner; claimed by ${taskIds.join(', ')}`);
  }
  for (const taskPath of taskFiles) {
    for (const verificationRef of verificationRefsByTask.get(taskPath) || []) {
      const definition = verificationDefinitions.get(verificationRef);
      if (!definition) {
        errors.push(`${taskPath}: Verification ref ${verificationRef} has no concrete canonical V definition`);
        continue;
      }
      const definitionCriteria = [...definition.subject_criteria, ...definition.proof_criteria];
      for (const criterion of criteriaByTask.get(taskPath) || []) if (!definitionCriteria.includes(criterion)) {
        errors.push(`${taskPath}: Verification ref ${verificationRef} does not trace owned criterion ${criterion}`);
      }
    }
  }
  for (const boundary of (boundaries || []).filter((item) => item?.type === 'proof')) {
    const subjectPath = taskFiles.find((candidate) => registry[candidate]?.id === boundary.subject);
    const verifierPath = taskFiles.find((candidate) => registry[candidate]?.id === boundary.verifier);
    const subjectCriteria = criteriaByTask.get(subjectPath) || [];
    const verifierCriteria = criteriaByTask.get(verifierPath) || [];
    if (taskRolesByTask.get(subjectPath) !== 'subject') errors.push(`${subjectPath || boundary.subject}: proof subject must declare Task role subject`);
    if (taskRolesByTask.get(verifierPath) !== 'verifier') errors.push(`${verifierPath || boundary.verifier}: proof verifier must declare Task role verifier`);
    if (subjectCriteria.length === 0) errors.push(`${subjectPath || boundary.subject}: proof subject requires at least one implementation criterion`);
    if (verifierCriteria.length === 0) errors.push(`${verifierPath || boundary.verifier}: proof verifier requires a separately owned proof criterion`);
    for (const criterion of verifierCriteria) if (subjectCriteria.includes(criterion)) {
      errors.push(`${verifierPath || boundary.verifier}: proof verifier criterion ${criterion} duplicates subject implementation ownership`);
    }
    const definition = verificationDefinitions.get(String(boundary.verification_ref).toUpperCase());
    const definitionCriteria = definition ? [...definition.subject_criteria, ...definition.proof_criteria] : [];
    for (const criterion of [...subjectCriteria, ...verifierCriteria]) if (definition && !definitionCriteria.includes(criterion)) {
      errors.push(`${boundary.id}: shared V definition must trace subject and verifier criterion ${criterion}`);
    }
    for (const taskId of [boundary.subject, boundary.verifier]) {
      const taskPath = taskFiles.find((candidate) => registry[candidate]?.id === taskId);
      if (taskPath && !(verificationRefsByTask.get(taskPath) || []).includes(String(boundary.verification_ref).toUpperCase())) {
        errors.push(`${taskPath}: proof boundary ${boundary.id} must match task Verification ref ${boundary.verification_ref}`);
      }
    }
  }
}

function validateBoundaries21(spec, taskFiles, registry, anchorsByTask, criteriaByTask, designText, verificationDefinitions, errors) {
  if (!isPlainObject(spec.coordination) || !Array.isArray(spec.coordination.boundaries)) {
    errors.push('spec.json.coordination.boundaries: must be an array');
    return;
  }
  const allowedCoordination = new Set(['boundaries', 'phases']);
  for (const key of Object.keys(spec.coordination)) if (!allowedCoordination.has(key)) {
    errors.push(`spec.json.coordination.${key}: marker/task trigger authority is not canonical in schema 2.1`);
  }
  if (taskFiles.length > 0 && spec.coordination.boundaries.length === 0) {
    errors.push('physical task bundle requires at least one typed coordination boundary with semantic evidence');
  }
  const pathById = new Map(taskFiles.map((taskPath) => [registry[taskPath]?.id, taskPath]));
  const taskIds = new Set(pathById.keys());
  const boundaryIds = new Set();
  const boundaryById = new Map();
  const dependencyEdges = [];
  const authorityByTask = new Map(taskFiles.map((taskPath) => [registry[taskPath]?.id, new Set()]));
  const transitionDefinitions = canonicalDesignDefinitions(designText, 'T', errors);
  const taskList = (value, label, minimum = 1) => {
    if (!Array.isArray(value) || value.length < minimum || new Set(value).size !== value.length) {
      errors.push(`${label}: must contain at least ${minimum} unique task id(s)`);
      return [];
    }
    for (const taskId of value) if (!taskIds.has(taskId)) errors.push(`${label}: unknown task ${taskId}`);
    return value;
  };
  const validateTargetMap = (value, tasks, label) => {
    if (!isPlainObject(value) || Object.keys(value).sort().join(',') !== [...tasks].sort().join(',')) {
      errors.push(`${label}: must be keyed exactly by boundary tasks`); return;
    }
    for (const taskId of tasks) {
      if (!Array.isArray(value[taskId]) || value[taskId].length === 0 || new Set(value[taskId]).size !== value[taskId].length) {
        errors.push(`${label}.${taskId}: must be a non-empty array of unique exact targets`);
        continue;
      }
      for (const target of value[taskId]) if (!exactTaskTarget(target)) errors.push(`${label}.${taskId}: ${target} is not an exact target`);
    }
    for (let left = 0; left < tasks.length; left += 1) for (let right = left + 1; right < tasks.length; right += 1) {
      for (const a of value[tasks[left]] || []) for (const b of value[tasks[right]] || []) {
        if (targetsContend(a, b)) errors.push(`${label}: parent/child or exact resource contention ${a} vs ${b}`);
      }
    }
  };
  for (const [index, boundary] of spec.coordination.boundaries.entries()) {
    const label = `spec.json.coordination.boundaries[${index}]`;
    const fields = BOUNDARY_21_FIELDS[boundary?.type];
    if (!fields || !isPlainObject(boundary) || Object.keys(boundary).sort().join(',') !== [...(fields || [])].sort().join(',')) {
      errors.push(`${label}: malformed typed boundary`); continue;
    }
    if (boundaryIds.has(boundary.id)) errors.push(`${label}: duplicate boundary ID ${boundary.id}`);
    boundaryIds.add(boundary.id);
    boundaryById.set(boundary.id, boundary);
    if (boundary.type === 'ownership') {
      const tasks = taskList(boundary.tasks, `${label}.tasks`, 2);
      validateTargetMap(boundary.write_sets, tasks, `${label}.write_sets`);
      for (const taskId of tasks) {
        const taskWrites = new Set((anchorsByTask.get(pathById.get(taskId)) || []).filter((anchor) => anchor.access === 'write').map((anchor) => anchor.target));
        const declaredWrites = new Set(boundary.write_sets?.[taskId] || []);
        for (const target of boundary.write_sets?.[taskId] || []) if (!taskWrites.has(target)) errors.push(`${label}.write_sets.${taskId}: ${target} lacks exact task write anchor`);
        for (const target of taskWrites) if (!declaredWrites.has(target)) errors.push(`${label}.write_sets.${taskId}: missing exact task write target ${target}`);
      }
    } else if (boundary.type === 'dependency') {
      taskList([boundary.producer, boundary.consumer], label, 2);
      if (boundary.producer === boundary.consumer) errors.push(`${label}: producer and consumer must differ`);
      if (!exactTaskTarget(boundary.deliverable)) errors.push(`${label}.deliverable: missing exact deliverable`);
      dependencyEdges.push([boundary.producer, boundary.consumer, boundary.deliverable]);
      const producerPath = pathById.get(boundary.producer);
      const consumerPath = pathById.get(boundary.consumer);
      const producerAnchors = anchorsByTask.get(producerPath) || [];
      const consumerAnchors = anchorsByTask.get(consumerPath) || [];
      if (!producerAnchors.some((anchor) => anchor.target === boundary.deliverable && anchor.access === 'write')) {
        errors.push(`${label}.deliverable: producer ${boundary.producer} must own an exact write anchor for ${boundary.deliverable}`);
      }
      if (!consumerAnchors.some((anchor) => anchor.target === boundary.deliverable && anchor.access === 'read')) {
        errors.push(`${label}.deliverable: consumer ${boundary.consumer} must own an exact read anchor for ${boundary.deliverable}`);
      }
      if (!registry[consumerPath]?.dependencies?.includes(producerPath)) errors.push(`${label}: dependency boundary must bind the registry DAG edge`);
    } else if (boundary.type === 'transition') {
      taskList([boundary.owner], `${label}.owner`);
      taskList(boundary.consumers, `${label}.consumers`);
      if (boundary.consumers.includes(boundary.owner)) errors.push(`${label}.consumers: transition owner cannot also be its consumer`);
      const transitionDefinition = transitionDefinitions.get(String(boundary.design_ref).toUpperCase());
      if (!transitionDefinition || !concreteSemanticReviewText(transitionDefinition)) errors.push(`${label}.design_ref: missing canonical design T definition`);
      for (const field of ['precondition', 'postcondition', 'failure', 'recovery']) if (!concreteSemanticReviewText(boundary[field])) errors.push(`${label}.${field}: missing concrete transition definition`);
      for (const taskId of [boundary.owner, ...boundary.consumers]) authorityByTask.get(taskId)?.add(boundary.id);
    } else if (boundary.type === 'proof') {
      taskList([boundary.subject, boundary.verifier], label, 2);
      if (boundary.subject === boundary.verifier) errors.push(`${label}: proof subject must differ from verifier`);
      const verificationDefinition = verificationDefinitions.get(String(boundary.verification_ref).toUpperCase());
      if (!verificationDefinition) errors.push(`${label}.verification_ref: missing canonical V definition`);
      else {
        if (verificationDefinition.subject_owner !== boundary.subject) errors.push(`${label}.subject: must match semantic V subject_owner`);
        if (verificationDefinition.proof_owner !== boundary.verifier) errors.push(`${label}.verifier: must match semantic V proof_owner`);
        if (verificationDefinition.evidence_anchor !== boundary.artifact_anchor) errors.push(`${label}.artifact_anchor: must match semantic V evidence_anchor`);
      }
      const verifierPath = pathById.get(boundary.verifier);
      const proofAnchor = (anchorsByTask.get(verifierPath) || []).find((anchor) => anchor.id === boundary.artifact_anchor);
      const observableProofAnchor = proofAnchor?.role === 'verifier' && (
        (proofAnchor.type === 'command' && proofAnchor.access === 'read' && proofAnchor.action === 'read')
        || (proofAnchor.type === 'artifact' && proofAnchor.access === 'write' && ['create', 'modify'].includes(proofAnchor.action))
      );
      if (!observableProofAnchor) errors.push(`${label}.artifact_anchor: must be owned by verifier ${boundary.verifier} as an observable command or output artifact anchor; a source write is not proof`);
      const subjectPath = pathById.get(boundary.subject);
      const subjectCriteria = criteriaByTask.get(subjectPath) || [];
      const definitionCriteria = verificationDefinition
        ? [...verificationDefinition.subject_criteria, ...verificationDefinition.proof_criteria] : [];
      if (verificationDefinition && !subjectCriteria.some((criterion) => definitionCriteria.includes(criterion))) {
        errors.push(`${label}.verification_ref: canonical V definition must trace a criterion owned by proof subject ${boundary.subject}`);
      }
      authorityByTask.get(boundary.subject)?.add(boundary.id);
      authorityByTask.get(boundary.verifier)?.add(boundary.id);
    } else if (boundary.type === 'parallel') {
      const tasks = taskList(boundary.tasks, `${label}.tasks`, 2);
      validateTargetMap(boundary.resources, tasks, `${label}.resources`);
      for (const taskId of tasks) {
        const taskWrites = (anchorsByTask.get(pathById.get(taskId)) || []).filter((anchor) => anchor.access === 'write').map((anchor) => anchor.target);
        const resources = [...(boundary.resources?.[taskId] || [])].sort();
        if (JSON.stringify([...new Set(taskWrites)].sort()) !== JSON.stringify(resources)) {
          errors.push(`${label}.resources.${taskId}: must exactly equal task write resources`);
        }
      }
    }
  }
  // D10/I7/R8.3: global ownership-contention scan. Candidate pairs are derived
  // directly from the complete anchorsByTask write-anchor projection — every
  // task's every write anchor — never only from declared write_sets or from
  // iterating already-declared boundaries. Any single existing dependency
  // boundary between a pair covers every target that pair shares, regardless
  // of which target it names as its own deliverable; a same-target write pair
  // with no dependency boundary at all (even one never named in any boundary)
  // is exactly the defect this scan exists to catch.
  const connectedPairs = new Set(dependencyEdges.map(([producer, consumer]) => [producer, consumer].sort().join('\0')));
  const writersByTarget = new Map();
  for (const taskPath of taskFiles) {
    const taskId = registry[taskPath]?.id;
    if (!taskId) continue;
    for (const anchor of anchorsByTask.get(taskPath) || []) {
      if (anchor.access !== 'write') continue;
      if (!writersByTarget.has(anchor.target)) writersByTarget.set(anchor.target, new Set());
      writersByTarget.get(anchor.target).add(taskId);
    }
  }
  const flaggedContentionPairs = new Set();
  for (const [target, writers] of writersByTarget) {
    const writerIds = [...writers].sort();
    for (let left = 0; left < writerIds.length; left += 1) for (let right = left + 1; right < writerIds.length; right += 1) {
      const a = writerIds[left]; const b = writerIds[right];
      const pairKey = [a, b].sort().join('\0');
      if (connectedPairs.has(pairKey) || flaggedContentionPairs.has(pairKey)) continue;
      flaggedContentionPairs.add(pairKey);
      errors.push(`spec.json.coordination.boundaries: ${a} and ${b} both hold a write anchor for ${target} with no dependency boundary connecting them`);
    }
  }
  const participation = new Map([...taskIds].map((taskId) => [taskId, 0]));
  for (const boundary of spec.coordination.boundaries) {
    for (const taskId of new Set(boundaryParticipants(boundary))) if (participation.has(taskId)) {
      participation.set(taskId, participation.get(taskId) + 1);
    }
  }
  for (const [taskId, count] of participation) if (count === 0) {
    errors.push(`spec.json.coordination.boundaries: task ${taskId} must participate in at least one justified typed boundary`);
  }
  for (const taskPath of taskFiles) {
    const expected = dependencyEdges.filter(([, consumer]) => consumer === registry[taskPath]?.id).map(([producer]) => pathById.get(producer)).sort();
    if (JSON.stringify([...(registry[taskPath]?.dependencies || [])].sort()) !== JSON.stringify(expected)) errors.push(`${taskPath}: registry dependencies must be an exact projection of dependency boundaries`);
  }
  if (Object.prototype.hasOwnProperty.call(spec.coordination, 'phases')) {
    if (!Array.isArray(spec.coordination.phases) || spec.coordination.phases.length === 0) {
      errors.push('spec.json.coordination.phases: must be a non-empty compact metadata array');
    } else {
      const phaseIds = new Set();
      for (const [index, phase] of spec.coordination.phases.entries()) {
        const label = `spec.json.coordination.phases[${index}]`;
        const fields = ['id', 'task_ids', 'entry_condition', 'exit_condition', 'owner_boundary'];
        if (!isPlainObject(phase) || Object.keys(phase).sort().join(',') !== fields.sort().join(',')) {
          errors.push(`${label}: fields must be exactly ${fields.join(', ')}`); continue;
        }
        if (phaseIds.has(phase.id)) errors.push(`${label}: duplicate phase id ${phase.id}`);
        phaseIds.add(phase.id);
        taskList(phase.task_ids, `${label}.task_ids`);
        const ownerBoundary = boundaryById.get(phase.owner_boundary);
        if (!ownerBoundary) errors.push(`${label}.owner_boundary: unknown boundary ${phase.owner_boundary}`);
        else {
          const participants = [...new Set(boundaryParticipants(ownerBoundary))].sort();
          const phaseTasks = [...new Set(phase.task_ids || [])].sort();
          if (!['dependency', 'transition', 'proof'].includes(ownerBoundary.type)) {
            errors.push(`${label}.owner_boundary: ${ownerBoundary.type} cannot own phase progression`);
          }
          if (JSON.stringify(participants) !== JSON.stringify(phaseTasks)) {
            errors.push(`${label}.owner_boundary: participants must match phase task_ids exactly`);
          }
        }
        for (const field of ['entry_condition', 'exit_condition']) if (!concreteSemanticReviewText(phase[field])) errors.push(`${label}.${field}: must be concrete`);
      }
      const phaseTasks = spec.coordination.phases.flatMap((phase) => Array.isArray(phase?.task_ids) ? phase.task_ids : []);
      const counts = new Map([...taskIds].map((taskId) => [taskId, phaseTasks.filter((candidate) => candidate === taskId).length]));
      for (const [taskId, count] of counts) if (count !== 1) {
        errors.push(`spec.json.coordination.phases: task ${taskId} must appear in exactly one phase (found ${count})`);
      }
    }
  }
  const graph = new Map([...taskIds].map((taskId) => [taskId, []]));
  for (const [producer, consumer] of dependencyEdges) graph.get(producer)?.push(consumer);
  const visiting = new Set();
  const visited = new Set();
  const visit = (taskId, stack = []) => {
    if (visiting.has(taskId)) {
      const start = stack.indexOf(taskId);
      errors.push(`spec.json.coordination.boundaries: dependency cycle ${stack.slice(start).concat(taskId).join(' -> ')}`);
      return;
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    for (const next of graph.get(taskId) || []) visit(next, [...stack, taskId]);
    visiting.delete(taskId);
    visited.add(taskId);
  };
  for (const taskId of taskIds) visit(taskId);
  const pathExists = (from, to, seen = new Set()) => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (graph.get(from) || []).some((next) => pathExists(next, to, seen));
  };
  for (const boundary of spec.coordination.boundaries.filter((item) => item.type === 'parallel')) {
    for (let left = 0; left < boundary.tasks.length; left += 1) for (let right = left + 1; right < boundary.tasks.length; right += 1) {
      const a = boundary.tasks[left]; const b = boundary.tasks[right];
      if (pathExists(a, b) || pathExists(b, a)) errors.push(`${boundary.id}: parallel tasks have a dependency path`);
      for (const authority of authorityByTask.get(a) || []) if (authorityByTask.get(b)?.has(authority)) errors.push(`${boundary.id}: parallel tasks share transition/proof authority ${authority}`);
    }
  }
}

function validateResearchLifecycle21(specDir, canonicalSpecDir, spec, errors) {
  const state = spec.authoring?.research;
  const hasPointer = Object.prototype.hasOwnProperty.call(spec, 'research');
  const artifact = inspectSpecArtifact(specDir, canonicalSpecDir, 'research.md', 'research.md', errors);
  if (state === 'absent') {
    if (hasPointer) errors.push('spec.json.research: authoring.research absent requires no pointer');
    if (artifact) errors.push('research.md: authoring.research absent requires no physical artifact');
    return null;
  }
  if (state === 'draft' || state === 'validated') {
    if (spec.research !== 'research.md') errors.push(`spec.json.research: authoring.research ${state} requires canonical pointer research.md`);
    if (!artifact) errors.push(`research.md: authoring.research ${state} requires a physical regular file`);
    else validateResearchArtifact21(artifact, canonicalSpecDir, errors);
    return artifact;
  }
  return artifact;
}

function validateSpec21(specDir, canonicalSpecDir, spec, errors, warnings) {
  const allowedFields = new Set([...SPEC_21_REQUIRED_FIELDS, ...SPEC_21_OPTIONAL_FIELDS]);
  for (const field of SPEC_21_REQUIRED_FIELDS) if (!Object.prototype.hasOwnProperty.call(spec, field)) {
    errors.push(`spec.json.${field}: required by closed schema 2.1 machine state`);
  }
  for (const field of Object.keys(spec)) if (!allowedFields.has(field)) {
    errors.push(`spec.json.${field}: unknown or legacy field is not canonical in closed schema 2.1`);
  }
  const policy = POLICY.validateWorkflowPolicySnapshot(spec.workflow_policy);
  if (!policy.valid || spec.workflow_policy?.version !== SCHEMA_21) {
    errors.push(...policy.errors.map((error) => `spec.json.${error}`));
    if (spec.workflow_policy?.version !== SCHEMA_21) errors.push('spec.json.workflow_policy.version: schema 2.1 mutation requires policy 2.1');
  }
  const authoringFields = ['requirements', 'design', 'research', 'tasks'];
  if (!isPlainObject(spec.authoring) || Object.keys(spec.authoring).sort().join(',') !== authoringFields.sort().join(',')) {
    errors.push(`spec.json.authoring: fields must be exactly ${authoringFields.join(', ')}`);
  } else for (const [artifact, state] of Object.entries(spec.authoring)) {
    if (!['draft', 'validated', 'absent'].includes(state)) errors.push(`spec.json.authoring.${artifact}: must be draft, validated, or absent`);
  }
  if (Object.prototype.hasOwnProperty.call(spec, 'approvals')) errors.push('spec.json.approvals: legacy approval semantics are inert and not canonical in schema 2.1');
  const scopeFields = ['source', 'in_scope', 'out_of_scope', 'expansion_policy'];
  if (isPlainObject(spec.scope_lock)
    && Object.keys(spec.scope_lock).sort().join(',') !== [...scopeFields].sort().join(',')) {
    errors.push(`spec.json.scope_lock: fields must be exactly ${scopeFields.join(', ')}`);
  }
  if (isPlainObject(spec.scope_lock)) {
    if (typeof spec.scope_lock.source !== 'string' || spec.scope_lock.source.trim() === '') errors.push('spec.json.scope_lock.source: must be a non-empty string');
    for (const field of ['in_scope', 'out_of_scope']) {
      const values = spec.scope_lock[field];
      if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.trim() !== value || value === '')
        || new Set(values || []).size !== (values || []).length) {
        errors.push(`spec.json.scope_lock.${field}: must be an array of unique non-empty trimmed strings`);
      }
    }
    if (spec.scope_lock.expansion_policy !== 'requires-user-approval') errors.push('spec.json.scope_lock.expansion_policy: must be requires-user-approval');
  }
  if (isPlainObject(spec.validation)
    && Object.keys(spec.validation).sort().join(',') !== [...VALIDATION_21_FIELDS].sort().join(',')) {
    errors.push(`spec.json.validation: fields must be exactly ${VALIDATION_21_FIELDS.join(', ')}`);
  }
  const taskFiles = listTaskFiles(specDir, canonicalSpecDir, errors);
  validateCoreMachineState(spec, taskFiles, errors, { schema21: true });
  validateDecisionState21(spec, errors);
  validateResearchLifecycle21(specDir, canonicalSpecDir, spec, errors);
  if (taskFiles.length === 0) {
    if (Object.prototype.hasOwnProperty.call(spec, 'task_files') || Object.prototype.hasOwnProperty.call(spec, 'task_registry')) errors.push('taskless schema 2.1 must omit task_files and task_registry');
    if (spec.authoring?.tasks !== 'absent') errors.push('spec.json.authoring.tasks: taskless spec must be absent');
  } else {
    if (JSON.stringify([...(spec.task_files || [])].sort()) !== JSON.stringify(taskFiles)) errors.push('spec.json.task_files: must exactly match physical tasks');
    if (!isPlainObject(spec.task_registry) || Object.keys(spec.task_registry).sort().join(',') !== taskFiles.join(',')) errors.push('spec.json.task_registry: must exactly match physical tasks');
    if (!['draft', 'validated'].includes(spec.authoring?.tasks)) errors.push('spec.json.authoring.tasks: physical tasks require draft or validated');
  }
  const requirementsText = fs.readFileSync(path.join(specDir, 'requirements.md'), 'utf8');
  const designText = fs.readFileSync(path.join(specDir, 'design.md'), 'utf8');
  const projection = SEMANTIC.modelFromMarkdown(canonicalSpecDir, spec);
  errors.push(...projection.errors.map((error) => `semantic projection: ${error}`));
  if (!isPlainObject(spec.semantic_model)) {
    errors.push('spec.json.semantic_model: schema 2.1 requires explicit promoted machine semantic authority');
  } else {
    errors.push(...SEMANTIC.validateSemanticModel(spec.semantic_model, spec));
    if (SEMANTIC.stableJson(spec.semantic_model) !== SEMANTIC.stableJson(projection.model)) {
      errors.push('spec.json.semantic_model: differs from Markdown projection; restore the Markdown the semantic model was finalized from');
    }
  }
  const authorityModel = isPlainObject(spec.semantic_model) ? spec.semantic_model : projection.model;
  const verificationDefinitions = new Map((authorityModel.verification_definitions || []).map((definition) => [definition.id, definition]));
  const designIds = new Set(designSemanticReviewIds(designText));
  for (const definition of verificationDefinitions.values()) for (const decisionRef of definition.decision_refs) {
    if (!designIds.has(decisionRef)) errors.push(`spec.json.semantic_model.${definition.id}: decision ref ${decisionRef} does not exist in design.md`);
  }
  const designAnchors = (authorityModel.anchors || []).filter((anchor) => /^A-D-/.test(anchor.id)).map((anchor) => ({
    ...anchor, label: 'design.md', design: true, schema21: true,
  }));
  validateRequirementInventory(requirementsText, errors);
  const criteria = (authorityModel.criteria || []).map((criterion) => criterion.id);
  const anchorsByTask = new Map();
  const criteriaByTask = new Map();
  const verificationRefsByTask = new Map();
  const taskRolesByTask = new Map();
  const taskContents = new Map();
  for (const taskPath of taskFiles) {
    const content = fs.readFileSync(path.join(specDir, taskPath), 'utf8');
    const task = validateTask21(
      taskPath,
      content,
      spec.task_registry?.[taskPath],
      spec.ready_for_implementation === true,
      errors,
    );
    taskContents.set(taskPath, content);
    anchorsByTask.set(taskPath, task.anchors);
    criteriaByTask.set(taskPath, task.criteria);
    verificationRefsByTask.set(taskPath, task.verificationRefs);
    taskRolesByTask.set(taskPath, task.taskRole);
  }
  const anchorsById = new Map();
  const designTargets = new Map(designAnchors.map((anchor) => [`${anchor.type}\0${anchor.target}`, anchor]));
  for (const anchor of [...designAnchors, ...[...anchorsByTask.values()].flat()]) {
    if (anchorsById.has(anchor.id)) errors.push(`${anchor.label}: duplicate anchor ID ${anchor.id}; first declared in ${anchorsById.get(anchor.id).label}`);
    else anchorsById.set(anchor.id, anchor);
    if (!anchor.design && designTargets.has(`${anchor.type}\0${anchor.target}`)) {
      errors.push(`${anchor.label}: anchor ${anchor.id} duplicates canonical design target ${designTargets.get(`${anchor.type}\0${anchor.target}`).id}`);
    }
  }
  for (const [taskPath, content] of taskContents) for (const reference of content.match(/\bA-D-\d{2}\b/g) || []) {
    if (!anchorsById.has(reference)) errors.push(`${taskPath}: dangling canonical design anchor reference ${reference}`);
  }
  validateTaskCriterionGraph(
    taskFiles,
    spec.task_registry || {},
    criteriaByTask,
    verificationRefsByTask,
    taskRolesByTask,
    criteria,
    spec.coordination?.boundaries,
    verificationDefinitions,
    errors,
  );
  validateBoundaries21(
    spec, taskFiles, spec.task_registry || {}, anchorsByTask, criteriaByTask,
    designText, verificationDefinitions, errors,
  );
  validateSemanticReview21(specDir, spec, criteria, designIds, verificationDefinitions, errors);
  validateSemanticReviewHistory21(spec, errors);
  validateAuthoringValidation21(specDir, spec, errors);
  if (spec.ready_for_implementation === true) {
    for (const artifact of ['requirements', 'design']) if (spec.authoring?.[artifact] !== 'validated') errors.push(`spec.json.authoring.${artifact}: readiness requires validated`);
    if (taskFiles.length > 0 && spec.authoring?.tasks !== 'validated') errors.push('spec.json.authoring.tasks: readiness requires validated task projection');
    if (spec.research === 'research.md' && spec.authoring?.research !== 'validated') errors.push('spec.json.authoring.research: explicit research readiness requires validated');
    let projectRoot = null;
    try { projectRoot = canonicalProjectRoot(canonicalSpecDir); } catch (error) {
      errors.push(`spec.json.ready_for_implementation: canonical project root cannot be resolved (${error.message})`);
    }
    if (projectRoot) {
      const grounding = groundSpec({ specDir: canonicalSpecDir, root: projectRoot, spec });
      for (const error of grounding.errors) errors.push(`grounding: ${error}`);
      for (const warning of grounding.warnings) warnings.push(`grounding: ${warning}`);
    }
    if (errors.length > 0) errors.push('spec.json.ready_for_implementation: cannot be true while schema 2.1 semantic errors exist');
  }
  warnings.push('schema 2.1 structural checks do not replace semantic judgment');
}

function validateSpec(specDir, overrideSpec) {
  const errors = [];
  const warnings = [];
  const canonicalSpecDir = validateSpecRoot(specDir, errors);
  if (!canonicalSpecDir) return { errors, warnings };

  for (const forbidden of ['init.json', 'spec-state.json', 'hydration.md']) {
    const artifact = inspectSpecArtifact(specDir, canonicalSpecDir, forbidden, forbidden, errors);
    if (artifact) {
      errors.push(`${forbidden}: forbidden generated artifact`);
    }
  }

  const specJsonArtifact = inspectSpecArtifact(specDir, canonicalSpecDir, 'spec.json', 'spec.json', errors, { required: true });
  if (!specJsonArtifact) return { errors, warnings };

  const spec = overrideSpec === undefined ? readJson(specJsonArtifact.path, errors) : overrideSpec;
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    if (errors.length === 0) errors.push('spec.json: must contain a JSON object');
    return { errors, warnings };
  }

  if (spec.schema_version === SCHEMA_21 && Object.prototype.hasOwnProperty.call(spec, 'override_receipt')) {
    errors.push('spec.json.override_receipt: legacy override receipt is inert read compatibility and must be omitted from canonical state');
  }

  if (spec.schema_version === SCHEMA_21) {
    const requirements = inspectSpecArtifact(specDir, canonicalSpecDir, 'requirements.md', 'requirements.md', errors, { required: true });
    const design = inspectSpecArtifact(specDir, canonicalSpecDir, 'design.md', 'design.md', errors, { required: true });
    if (requirements && design) validateSpec21(specDir, canonicalSpecDir, spec, errors, warnings);
    return { errors, warnings };
  }

  const policyContext = workflowPolicyContext(spec, errors);
  const taskFiles = listTaskFiles(specDir, canonicalSpecDir, errors);
  const taskFileSet = new Set(taskFiles);
  validateCoreMachineState(spec, taskFiles, errors);
  const topology = validateCoordinationTopology(spec, policyContext, taskFiles, specDir, errors);
  policyContext.taskRequired = topology.tasksRequired;
  const requiresTaskBundle = topology.tasksRequired;
  validateStateTransitions(spec, errors, policyContext);
  validateFinalLifecycleTimestamps(spec, taskFiles, policyContext, errors);
  if (!requiresTaskBundle && !policyContext.legacy) {
    if (Object.prototype.hasOwnProperty.call(spec, 'task_files')) {
      errors.push('spec.json.task_files: taskless Specs v2 must omit task inventory');
    }
    if (Object.prototype.hasOwnProperty.call(spec, 'task_registry')) {
      errors.push('spec.json.task_registry: taskless Specs v2 must omit task registry');
    }
  }

  if (!Array.isArray(spec.task_files)) {
    if (requiresTaskBundle) errors.push('spec.json.task_files: missing array');
    if (Array.isArray(spec.tasks)) {
      errors.push('spec.json.tasks: legacy field detected; use task_files');
    }
  } else {
    const declared = [...spec.task_files].sort();
    if (JSON.stringify(declared) !== JSON.stringify(taskFiles)) {
      errors.push('spec.json.task_files: must exactly match files under tasks/');
      warnings.push(`expected task_files=${JSON.stringify(taskFiles)}`);
    }
  }

  if (!spec.task_registry || typeof spec.task_registry !== 'object' || Array.isArray(spec.task_registry)) {
    if (requiresTaskBundle) errors.push('spec.json.task_registry: missing object keyed by task file path');
  } else {
    const registryKeys = Object.keys(spec.task_registry).sort();
    if (JSON.stringify(registryKeys) !== JSON.stringify(taskFiles)) {
      errors.push('spec.json.task_registry: keys must exactly match task file paths');
    }

    for (const [registryPath, entry] of Object.entries(spec.task_registry)) {
      if (!taskFileSet.has(registryPath)) {
        errors.push(`spec.json.task_registry.${registryPath}: no matching task file`);
      }
      validateArtifactDeclaration(registryPath, entry, errors);
    }
  }

  for (const taskFile of taskFiles) {
    if (!TASK_PATH_RE.test(taskFile)) {
      errors.push(`${taskFile}: must match tasks/task-R{N}-{SEQ}-<slug>.md with two-digit SEQ`);
    }
  }

  if (taskFiles.length > 2 && taskFiles.every((taskFile) => /^tasks\/task-R0-/.test(taskFile))) {
    errors.push('tasks/: feature work cannot be entirely R0; reserve R0 for shared foundation tasks');
  }

  const validationRecommended = spec.design_context?.validation_recommended === true;
  if (taskFiles.length >= 5 && !validationRecommended) {
    errors.push('spec.json.design_context.validation_recommended: must be true for specs with 5+ task files');
  }
  if (
    (validationRecommended || taskFiles.length >= 5) &&
    spec.ready_for_implementation === true &&
    spec.validation?.status !== 'completed'
  ) {
    errors.push(
      'spec.json.ready_for_implementation: cannot be true when validation is recommended but validation.status is not completed',
    );
  }
  if (spec.validation?.status === 'completed') {
    if (!spec.timestamps?.validation_done) {
      errors.push('spec.json.timestamps.validation_done: required when validation.status is completed');
    }
    if (taskFiles.length >= 5 && !spec.timestamps?.review_done) {
      errors.push('spec.json.timestamps.review_done: required after validation for a large task graph');
    }
  }

  const requirementsArtifact = inspectSpecArtifact(
    specDir,
    canonicalSpecDir,
    'requirements.md',
    'requirements.md',
    errors,
    { required: true },
  );
  const designArtifact = inspectSpecArtifact(
    specDir,
    canonicalSpecDir,
    'design.md',
    'design.md',
    errors,
    { required: true },
  );
  const researchArtifact = inspectSpecArtifact(specDir, canonicalSpecDir, 'research.md', 'research.md', errors);
  const receiptArtifact = inspectSpecArtifact(specDir, canonicalSpecDir, FEATURE_RECEIPT_FILE, FEATURE_RECEIPT_FILE, errors);
  validateResearchPointer(specDir, canonicalSpecDir, spec, errors);

  const researchPointer = explicitResearchPath(spec);
  if (researchPointer !== null && researchPointer !== 'research.md') {
    errors.push('spec.research: explicit research must use the canonical research.md path');
  }
  const legacyResearchRequired = policyContext.legacy
    && spec.workflow_policy?.proof_obligations?.includes('needsResearchGrounding');
  if (researchPointer === 'research.md' || (policyContext.legacy && researchArtifact)) {
    validateResearchArtifact(researchArtifact, errors, true);
  } else if (legacyResearchRequired) {
    validateResearchArtifact(null, errors, true);
  } else if (researchArtifact) {
    errors.push('research.md: physical research artifact requires explicit spec.research="research.md"');
  }

  validateFeatureReceipt(spec, policyContext, errors, warnings, receiptArtifact);

  let requirementIds = [];
  let subCriteriaIds = [];
  let requirementsText = '';
  let designText = '';
  if (requirementsArtifact) {
    requirementsText = fs.readFileSync(requirementsArtifact.path, 'utf8');
    validateUniqueSectionGroups('requirements.md', requirementsText, [['Requirements']], errors);
    validateRequirementDialect(requirementsText, errors);
    validateRequirementInventory(requirementsText, errors);
    requirementIds = extractRequirementIds(requirementsText);
    subCriteriaIds = extractSubCriteriaIds(requirementsText);
  }
  if (designArtifact) {
    designText = fs.readFileSync(designArtifact.path, 'utf8');
    validateUniqueSectionGroups('design.md', designText, [
      ['Architecture'],
      ['Canonical Contracts & Invariants'],
      ['Execution Closure'],
      ['Requirements Traceability'],
      ['Components and Interfaces'],
    ], errors);
  }
  if (!policyContext.legacy) {
    validateSemanticReview(
      specDir,
      spec,
      policyContext,
      subCriteriaIds,
      designText,
      errors,
    );
  }
  validateSemanticReadiness(spec, requirementsText, designText, policyContext, errors);

  const coveredRequirementIds = new Set();
  const coveredSubCriteriaIds = new Set();
  const mappedRequirementReferences = [];
  const taskRecords = new Map();
  const taskClosures = new Map();
  const taskContents = new Map();
  // Cross-layer contract defs (opt-in): empty unless design.md uses
  // <!-- contract:NAME --> markers, so legacy specs are unaffected.
  const contractDefs = designArtifact ? extractContractDefs(designText, 'design.md', errors) : new Map();
  const designClosure = designArtifact
    ? implementationObligationClosure(designText, 'design.md', errors)
    : { ids: [], section: '', headingCount: 0, blocks: new Map(), notApplicable: false };
  for (const taskFile of taskFiles) {
    const taskArtifact = inspectSpecArtifact(specDir, canonicalSpecDir, taskFile, taskFile, errors);
    if (!taskArtifact) continue;
    const content = fs.readFileSync(taskArtifact.path, 'utf8');
    taskContents.set(taskFile, content);
    const registryEntry = spec.task_registry?.[taskFile];
    validateTaskIdentity(taskFile, content, registryEntry, errors);
    validateTaskSections(taskFile, content, errors);
    validateTaskPlaceholders(taskFile, content, errors, warnings);
    validateRelatedFiles(taskFile, content, errors);
    validateTaskDependencyHeader(
      taskFile,
      content,
      registryEntry,
      spec.ready_for_implementation === true,
      errors,
    );
    validateTaskStatusHeader(
      taskFile,
      content,
      registryEntry,
      spec.ready_for_implementation === true,
      errors,
    );
    taskClosures.set(
      taskFile,
      implementationObligationClosure(content, taskFile, errors),
    );
    taskRecords.set(taskFile, {
      rows: relatedFilesSection(content).rows,
      parallel: taskDeclaresParallel(content, taskFile, errors),
    });

    // Requirement traceability: only structured _Requirements: ..._ mappings inside Steps/Requirements sections count.
    // Incidental mentions elsewhere (prose Context, Constraints) must not be counted.
    const stepsSection = extractSection(content, 'Changes') || extractSection(content, 'Steps') || extractSection(content, 'Implementation Steps') || '';
    const reqSectionInTask = extractSection(content, 'Requirements') || '';
    const acceptanceSection = extractSection(content, 'Acceptance') || '';
    const mappingSource = `${stepsSection}\n${reqSectionInTask}\n${acceptanceSection}`;
    // Also consider inline _Requirements: inside Steps bullet lines that may be outside section extraction edge cases,
    // so fallback to whole content scanning only if sections are null (e.g., malformed heading). But prefer scoped.
    const effectiveMappingSource = mappingSource.trim() ? mappingSource : content;
    const numericMappingRe = /_Requirements:\s*([^_\n]+)_/gi;
    let match;
    while ((match = numericMappingRe.exec(effectiveMappingSource)) !== null) {
      for (const token of match[1].split(',')) {
        const trimmed = token.trim();
        const major = trimmed.match(/^(\d+)(?:\.\d+)?$/);
        if (major) {
          const requirementId = `R${major[1]}`;
          const sub = trimmed.match(/^(\d+\.\d+)$/);
          const subId = sub ? `R${sub[1]}` : null;
          coveredRequirementIds.add(requirementId);
          mappedRequirementReferences.push({ taskFile, token: trimmed, requirementId, subId });
        } else if (trimmed !== '') {
          errors.push(`${taskFile}: requirement mapping "${trimmed}" must use numeric IDs such as 1 or 1.1`);
        }
        // Record the full sub-criterion (e.g. 3.4 -> R3.4) for per-criterion coverage.
        const sub = trimmed.match(/^(\d+\.\d+)$/);
        if (sub) coveredSubCriteriaIds.add(`R${sub[1]}`);
      }
    }

    if (taskFormat(content) === 'v2') {
      for (const subId of criterionReferences(`${stepsSection}\n${acceptanceSection}`)) {
        coveredSubCriteriaIds.add(subId);
        coveredRequirementIds.add(subId.split('.')[0]);
        mappedRequirementReferences.push({
          taskFile,
          token: subId.slice(1),
          requirementId: subId.split('.')[0],
          subId,
        });
      }
    }

    // Cross-layer contract check (opt-in via design.md markers). When a task
    // claims `Contracts: NAME`, design.md must define the name and the task's
    // local copy must match the canonical definition byte-for-byte (after
    // whitespace normalization). This catches BE/FE drift like user_name vs
    // userName before integration, and rejects declarations with no canonical
    // source instead of silently accepting an orphan contract.
    if (taskFormat(content) === 'v2') continue;
    const { names, blocks, firstBlock } = extractTaskContracts(content, taskFile, errors);
    for (const taggedName of blocks.keys()) {
      if (!names.includes(taggedName)) {
        errors.push(
          `${taskFile}: carries <!-- contract:${taggedName} --> block but must declare it on one Contracts: line`,
        );
      }
    }
    if (names.length > 0 && contractDefs.size === 0) {
      errors.push(`${taskFile}: declares contract(s) but design.md defines no canonical contract blocks`);
    }
    if (contractDefs.size > 0) {
      for (const name of names) {
        if (!contractDefs.has(name)) {
          errors.push(`${taskFile}: declares unknown contract "${name}" (not defined in design.md)`);
          continue;
        }
        // Prefer the task's marker-tagged copy for this contract; fall back to
        // the first fenced block only for single-contract tasks (legacy format).
        const localCopy = blocks.has(name)
          ? blocks.get(name)
          : (names.length === 1 ? firstBlock : null);
        if (localCopy === null) {
          errors.push(`${taskFile}: contract "${name}" is missing a copied canonical block`);
          continue;
        }
        if (localCopy !== contractDefs.get(name)) {
          errors.push(`${taskFile}: contract "${name}" body diverges from the canonical definition in design.md`);
        }
      }
    }
  }


  if (!policyContext.legacy) validateTypedAnchorInventory(designText, taskContents, errors);
  validateNamedContractReferences(designText, taskContents, errors);

  validateDependencyTopology(spec, taskFiles, spec.task_registry, taskRecords, errors);
  validateParallelEligibility(taskFiles, spec.task_registry, taskRecords, errors);
  if (!policyContext.legacy) {
    validateTaskTriggerEvidence(spec, topology, taskFiles, taskRecords, errors);
  }
  if (policyContext.legacy) {
    validateImplementationObligations(
      spec,
      policyContext,
      requirementIds,
      subCriteriaIds,
      taskFiles,
      spec.task_registry,
      designClosure,
      taskClosures,
      errors,
    );
  } else if (Object.prototype.hasOwnProperty.call(spec, 'implementation_obligations')) {
    errors.push('spec.json.implementation_obligations: legacy copied-closure contract is not part of Specs v2; use named design contracts and task references');
  }

  if (policyContext.strict && requirementIds.length === 0) {
    errors.push('requirements.md: strict workflow requires numeric requirement IDs (for example Requirement 1 or R1)');
  }
  if (requiresTaskBundle) {
    const knownRequirements = new Set(requirementIds);
    const knownSubCriteria = new Set(subCriteriaIds);
    for (const reference of mappedRequirementReferences) {
      if (!knownRequirements.has(reference.requirementId)) {
        errors.push(`${reference.taskFile}: requirement mapping "${reference.token}" references unknown requirement ${reference.requirementId}`);
      } else if (reference.subId && !knownSubCriteria.has(reference.subId)) {
        errors.push(`${reference.taskFile}: requirement mapping "${reference.token}" references unknown acceptance criterion ${reference.subId}`);
      }
    }
  }

  if (requiresTaskBundle) {
    for (const requirementId of requirementIds) {
      if (!coveredRequirementIds.has(requirementId)) {
        errors.push(`requirements.md:${requirementId}: not covered by any task`);
      }
    }
  }

  // Per-criterion coverage: every explicit R{N}.{M} literal in requirements.md
  // must appear in a numeric `_Requirements: x.y_` task mapping.
  if (requiresTaskBundle && subCriteriaIds.length > 0) {
    for (const subId of subCriteriaIds) {
      if (!coveredSubCriteriaIds.has(subId)) {
        errors.push(`requirements.md:${subId}: acceptance criterion not covered by any task`);
      }
    }
  }


  const designVerification = extractSection(designText, 'Verification') || '';
  const designVerificationCoverage = criterionReferences(designVerification);
  for (const subId of subCriteriaIds) {
    if (!designVerificationCoverage.has(subId)) {
      errors.push(`requirements.md:${subId}: missing deterministic design Verification coverage`);
    }
  }

  if (spec.ready_for_implementation === true && errors.length > 0) {
    errors.push('spec.json.ready_for_implementation: cannot be true while validator errors exist');
  }

  return { errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const semanticDigestMode = args.includes('--semantic-digest');
  const positional = args.filter((arg) => arg !== '--semantic-digest');
  const specDir = positional.length === 1 ? resolveSpecDir(positional[0]) : null;
  if (!specDir) {
    usage();
    process.exit(2);
  }

  if (semanticDigestMode) {
    let spec = null;
    try { spec = JSON.parse(fs.readFileSync(path.join(specDir, 'spec.json'), 'utf8')); } catch {}
    const result = spec?.schema_version === SCHEMA_21
      ? computeSemanticDigest21(specDir, spec)
      : computeSemanticDigest(specDir);
    if (result.errors.length > 0) {
      console.error(`SEMANTIC_DIGEST_FAIL ${path.relative(process.cwd(), specDir) || specDir}`);
      for (const error of result.errors) console.error(`- ${error}`);
      process.exit(1);
    }
    console.log(result.digest);
    return;
  }

  const { errors, warnings } = validateSpec(specDir);
  for (const warning of warnings) {
    console.warn(`[WARN] ${warning}`);
  }

  if (errors.length > 0) {
    console.error(`STRUCTURAL_FAIL ${path.relative(process.cwd(), specDir) || specDir}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`STRUCTURALLY_VALID ${path.relative(process.cwd(), specDir) || specDir} (semantic review and execution proof are not claimed)`);
}

module.exports = { validateSpec, computeSemanticDigest21 };
Object.defineProperty(module.exports, 'C2_FIELDS', {
  value: C2_FIELDS,
  enumerable: false,
});

if (require.main === module) main();
