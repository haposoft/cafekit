'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const {
  convertCodexAgentContent,
  normalizeCodexBody,
  transformManagedCodexContent,
  upsertManagedCodexBlock
} = require('../lib/codex-install');
const { createTracker } = require('../lib/manifest');
const { checkVersions } = require('../lib/version-check');
const {
  resolvePlatforms,
  selectLanguage
} = require('../phases/select-platform');
const { MESSAGES } = require('../lib/i18n');

const PACKAGE_ROOT = path.join(__dirname, '../..');
const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')
).version;
const INSTALLER = path.join(PACKAGE_ROOT, 'bin/install.js');
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(PACKAGE_ROOT, 'src/claude/migration-manifest.json'), 'utf8')
);
const SPECS_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/specs');
const SPEC_MAKER_SOURCE_PATH = path.join(PACKAGE_ROOT, 'src/claude/agents/spec-maker.md');
const BRAINSTORM_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/brainstorm');
const BRAINSTORM_SKILL_SOURCE_PATH = path.join(BRAINSTORM_SOURCE_ROOT, 'SKILL.md');
const BRAINSTORM_REFERENCE_SOURCE_PATH = path.join(
  BRAINSTORM_SOURCE_ROOT,
  'references/question-framework.md'
);
const BRAINSTORM_AGENT_SOURCE_PATH = path.join(PACKAGE_ROOT, 'src/claude/agents/brainstormer.md');
const BRAINSTORM_SOURCE_PATHS = [
  BRAINSTORM_SKILL_SOURCE_PATH,
  BRAINSTORM_REFERENCE_SOURCE_PATH,
  BRAINSTORM_AGENT_SOURCE_PATH
];
const RESEARCH_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/research');
const RESEARCH_SKILL_SOURCE_PATH = path.join(RESEARCH_SOURCE_ROOT, 'SKILL.md');
const RESEARCH_AGENT_SOURCE_PATH = path.join(PACKAGE_ROOT, 'src/claude/agents/researcher.md');
const DEVELOP_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/develop');
const DEVELOP_BUNDLE = [
  'SKILL.md',
  'references/quality-gate.md',
  'references/parallel-waves.md',
  'references/subagent-patterns.md'
];
const TEST_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/test');
const TEST_BUNDLE = [
  'SKILL.md',
  'references/execution-strategy.md',
  'references/failure-triage.md',
  'references/test-memory.md'
];
const TEST_RUNNER_SOURCE_PATH = path.join(PACKAGE_ROOT, 'src/claude/agents/test-runner.md');
const DOCS_ADAPTIVE_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/docs');
const DOCS_ADAPTIVE_BUNDLE = [
  'SKILL.md',
  'references/init-workflow.md',
  'references/update-workflow.md',
  'references/standard-docs-workflow.md'
];
const HOTFIX_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/hotfix');
const HOTFIX_BUNDLE = [
  'SKILL.md',
  'references/diagnosis-protocol.md',
  'references/review-cycle.md',
  'references/parallel-patterns.md',
  'references/prevention-gate.md',
  'references/workflow-specialized.md'
];
const DEBUG_SKILL_SOURCE_PATH = path.join(PACKAGE_ROOT, 'src/claude/skills/debug/SKILL.md');
const DEBUG_AGENT_SOURCE_PATH = path.join(PACKAGE_ROOT, 'src/claude/agents/debugger.md');
const DEBUG_REFERENCE_FILES = [
  'core-philosophy.md',
  'root-cause-tracing.md',
  'verification-protocol.md',
  'log-ci-analysis.md',
  'parallel-agent-hydration.md',
  'side-effect-gate.md'
];
const CODE_REVIEW_SOURCE_ROOT = path.join(PACKAGE_ROOT, 'src/claude/skills/code-review');
const IMPLEMENTATION_READINESS_BOUNDARY_ROWS = [
  ['Interaction/UI', 'entry journey; visible/loading/empty/error states; input/focus/keyboard; accessibility; responsive/native/device behavior'],
  ['API/CLI', 'entrypoint/route or command grammar; identity/auth; input/default/normalization; success output; error/status/exit; duplicate/retry/idempotency; compatibility'],
  ['Data/schema', 'authority/storage/transaction; version; exact keys/nesting/types; required/optional; enum/format/bounds/cardinality; unknown-field behavior; compatibility/migration'],
  ['Async/state', 'initial/terminal states; event + guard + effect + next + error; ordering/concurrency; duplicate/retry; writer/lock acquire/contention/release; cancellation; rollback/recovery'],
  ['Filesystem/security', 'authoritative root; trusted/untrusted segment grammar; lexical + canonical containment and symlink policy; flags/mode; temp/rename/fsync; lock/stale reclaim; crash cleanup'],
  ['Runtime/deploy', 'config/env/flags; registration/packaging; OS/arch; rollout/rollback; health/logging; operator recovery'],
  ['Time/retention', 'clock source; unit/precision/timezone; endpoints and inclusion/comparator; anomaly behavior; expiry/purge/recovery'],
  ['AI/model', 'provider/model/prompt/tool schema; nondeterminism/bounds; safety/privacy; fallback; cost/token limit; eval oracle'],
  ['Integration/proof', 'caller; export/registration; packaging/config; native path/consumer; proof level (`source`/`installed`/`live`); observable failure oracle']
];

function boundaryTableHasRequiredRows(table) {
  const [header, ...rows] = table;
  const labels = rows.map((row) => row[0]);
  return JSON.stringify(header || []) === JSON.stringify(['Boundary', 'Required contract when material'])
    && new Set(labels).size === labels.length
    && IMPLEMENTATION_READINESS_BOUNDARY_ROWS.every((expected) =>
      rows.some((row) => JSON.stringify(row) === JSON.stringify(expected)));
}

const IMPLEMENTATION_READINESS_CLAUSES = {
  noInvention: 'Before implementation handoff, apply the **no-invention gate**: if two implementations conform to the packet text yet can produce different externally observable output, state, error, security, or compatibility behavior, surface the missing choice as an explicit GATE-SCOPE or GATE-REVIEW question and block handoff.',
  materialDefinition: 'A boundary is material when the task creates, changes, or depends on it and a different choice changes an external observation, security, durable data, compatibility, or proof reachability. Require only the matching material row; omit nonmaterial categories.',
  exactBoundaryChoices: 'For every required row, name each listed choice exactly; labels such as “JSON”, “local path”, “locked”, or “timestamped” alone remain unresolved.',
  proofPlanLines: [
    '- Command: `<exact runnable command>`',
    '- Named probe: <existing concrete probe/test/hook ID; never only a suite label>',
    '- Reachability: <known command/caller/environment per required level; `UNKNOWN` only when the path cannot yet be established>',
    '- Oracle: <externally observable success or failure>',
    '- Counterexample: <material alternative behavior that must make this proof fail>',
    '- Artifacts: <required artifact path plus digest algorithm/comparison rule, or explicitly ephemeral with cleanup rule>'
  ],
  proofTrace: 'Trace `Command → Named probe → Reachability → Oracle`.',
  namedProbeOwnership: 'Aggregate suites name the\nowning concrete probe.',
  proofLevelSeparation: 'Levels stay separate and never promote one another.',
  disposableTemplateControls: 'Run mutation or destructive\nnegative controls only on disposable copies under a verified temporary root,\nnever tracked worktree or canonical source bytes.',
  proofLevelMapping: 'For every required level in each referenced CP row, map its named probe and\nreachability here; one command may own several explicitly named level probes.',
  disposableReviewControls: 'Run mutation or destructive negative controls only on disposable copies below a verified temporary root, never tracked worktree or canonical source bytes.',
  failureSemantics: '`Crash` means abrupt unhandled termination before the claimed catch point; a catchable failure returns/raises an error or exits nonzero. Never use them interchangeably.',
  privacyIdentifiers: 'Any privacy/security claim names the exact identifier surface at risk, such as an env var, header, path, token class, or field name; generic “sensitive data” is insufficient.',
  freshReplay: 'After applying an accepted GATE-REVIEW finding, a fresh-context closure pass records and freshly replays its original counterexample after the repair under this exact review-log header:',
  distinctRepairProof: '`Repaired at` cites the repair edit; `Proved at` must cite distinct evidence from the fresh replay, never the repair-edit citation.',
  closureTransition: 'An accepted finding transitions `accepted → repaired → PASS|FAIL|UNKNOWN`.',
  unknownBlocks: 'Only `PASS` closes it; `FAIL` remains open for the remaining paper-review round; `UNKNOWN` blocks implementation handoff.',
  scopeReturnsToC1: 'A repair that adds user semantics or scope returns to GATE-SCOPE.'
};
const ADAPTIVE_COVERAGE_PROFILE_HEADER = [
  'ID', 'Outcome', 'Change kinds', 'Material surfaces', 'Ambiguity/action',
  'Risk/evidence', 'Required proof'
];
const ADAPTIVE_COVERAGE_PROFILE_ROW = [
  'CP-01', '<externally observable outcome>', '<all kinds>', '<all material surfaces>',
  '<state + action>', '<level + evidence>', '<source/installed/live set>'
];
const ADAPTIVE_COVERAGE_AMBIGUITY_ROWS = [
  ['State', 'Required action'],
  ['`none`', 'proceed'],
  ['`examples-needed`', 'add two or three examples only for an already decided rule; promote to `decision-needed` if an example changes observable behavior'],
  ['`decision-needed`', 'ask the user at GATE-SCOPE/GATE-REVIEW and keep affected tasks blocked'],
  ['`design-needed`', 'after user-owned decisions settle, route material competing technical designs through Brainstorm']
];
const ADAPTIVE_REVIEWER_ROWS = [
  ['Groups', 'Reviewers', 'Roles', 'Claim budget'],
  ['1-2', '2', 'Fact Checker plus all matching material lenses', 'about 5 per group'],
  ['3-5', '3', 'Fact Checker plus all matching material lenses', 'about 10 per group'],
  ['6+', '4', 'Fact Checker plus all matching material lenses', 'at least 15 total']
];
const ADAPTIVE_COVERAGE_CLAUSES = {
  riskFirst: 'Classify material risk before choosing a workflow; user wording never lowers an observed floor.',
  criticalFloor: '`critical`: auth/secrets/privacy; destructive/irreversible work or possible data loss/corruption; money/privilege/safety; production-state mutation.',
  elevatedFloor: '`elevated`: cross-component contracts, compatibility, concurrency, external integration, or installed/runtime behavior.',
  frontmatterGate: 'skip only when a change is clear, isolated, reversible, routine, and likely limited to one or two files.',
  directGate: 'Work directly only when the cause and change are clear, isolated, reversible,\n`routine`, and likely limited to one or two files.',
  splitRoute: 'Split three or more independent\nsubsystems; otherwise use one Specs packet for any material work that does not qualify for direct work or Brainstorm-only exploration.',
  independentSubsystem: 'A subsystem is independent only when its outcome, boundary, and verification/deployment path can move through the lifecycle separately.',
  profileAuthority: 'For a Specs route, `plan.md` owns one `## Coverage profile` row per externally observable outcome; direct and Brainstorm-only routes do not persist it.',
  openKinds: 'Change kinds are multi-valued (`add`, `modify`, `fix`, `refactor`, `remove`, `migrate`, `integrate`), and unfamiliar kinds or surfaces use `other:<verbatim>` rather than disappearing.',
  scopedUnion: 'Each task references its CP IDs; authoring, review, edge, and proof obligations union only inside affected rows/tasks.',
  profileRederivation: 'Rederive affected CP rows after any accepted scope, outcome, criteria, ownership, dependency, risk, or proof delta before task status.',
  plannedProof: '`Required proof` is a planned level set, not execution\nevidence: known but unrun proof may be `pending`; `UNKNOWN` reachability blocks\n`pending`; missing, failed, or unavailable required evidence blocks `done`/GATE-DONE.',
  proofSeparation: 'Levels stay separate and never promote one another.',
  liveLimit: 'Source/static checks prove the written contract, not live-model adherence.',
  specMakerAuthority: 'they are the canonical risk and coverage authority. Do not duplicate\ntheir taxonomy here.',
  specMakerAmbiguity: 'Apply the canonical ambiguity action; examples never decide observable behavior.',
  specMakerRoute: 'Apply their risk-first route before GATE-SCOPE and stop when the\nrequest qualifies for direct work; hand off when it requires Brainstorm-only exploration.',
  reviewRisk: 'Keep Fact Checker as the baseline. Assign every remaining material CP risk to a\nnamed reviewer lens; a critical row includes both relevant security-adversary and\nfailure-mode coverage, and nonmaterial lenses are not added.',
  reviewCapacity: 'Reviewer count is fixed by the table, not lens count. Give each reviewer a distinct primary lens; when material lenses exceed reviewers, combine related named lenses on one reviewer and keep every material lens assigned.'
};
const V3_SPECS_BUNDLE = [
  'SKILL.md',
  'references/review.md',
  'references/templates.md',
  'templates/design.md',
  'templates/requirements-init.md',
  'templates/requirements.md',
  'templates/research.md',
  'templates/spec-state.json',
  'templates/task.md'
];
const OBSOLETE_SPECS_FILES = [
  'references/archive-workflow.md',
  'references/ask-user-question-gates.md',
  'references/codebase-analysis.md',
  'references/cross-spec-dependency.md',
  'references/research-strategy.md',
  'references/scope-inquiry.md',
  'references/translation-mirror.md',
  'rules/design-discovery-full.md',
  'rules/design-discovery-light.md',
  'rules/design-principles.md',
  'rules/design-review.md',
  'rules/ears-format.md',
  'rules/phase-decision-matrix.md',
  'rules/task-scoring-rubric.md',
  'rules/tasks-generation.md'
];

function inTempProject(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-native-'));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function install(root, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [INSTALLER, '--platform', 'codex', '--yes', ...extraArgs],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: '/usr/bin:/bin' }
    }
  );
}

function installPlatforms(root, platforms, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [INSTALLER, '--platform', platforms.join(','), '--yes', ...extraArgs],
    { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' } }
  );
}

function installedCatalog(root, runtime) {
  const script = path.join(root, runtime === 'codex' ? '.codex' : '.claude', 'scripts', 'generate-skill-catalog.cjs');
  const result = spawnSync(process.execPath, [script, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function allFiles(root, predicate) {
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...allFiles(target, predicate));
    else if (predicate(target)) found.push(target);
  }
  return found;
}

function allHookLaunchers(config) {
  return Object.entries(config.hooks).flatMap(([event, groups]) => (
    groups.flatMap((group) => group.hooks.map((handler) => ({ event, handler })))
  ));
}

function parseGeneratedTomlString(content, key) {
  const match = content.match(new RegExp(`^${key} = (.+)$`, 'm'));
  assert.ok(match, `missing TOML key: ${key}`);
  return JSON.parse(match[1]);
}

function replaceGeneratedTomlString(content, key, value) {
  const pattern = new RegExp(`^${key} = .+$`, 'gm');
  const matches = [...content.matchAll(pattern)];
  assert.equal(matches.length, 1, `expected exactly one TOML key: ${key}`);
  return content.replace(pattern, `${key} = ${JSON.stringify(value)}`);
}

function renderCanonicalVerificationExample(template) {
  const values = new Map([
    ['SUBJECT_REQ', '1'],
    ['X', '1'],
    ['PROOF_REQ', '1'],
    ['Y', '2'],
    ['exact command', 'node --test test/installed.test.js'],
    ['exact anchored target', 'src/installed.js#entry'],
    ['exact/repository/entrypoint', 'src/installed.js'],
    ['observable result', 'the subject behavior and verifier proof both pass'],
    ['concrete observable result and proof', 'the subject behavior and verifier proof both pass'],
    ['concrete rejected or recovery case', 'invalid input remains rejected and observable'],
    ['real entrypoint/caller and grounded anchor expectation', 'the installed entrypoint reaches A-D-01'],
  ]);
  return template.replace(/\{\{([^}]+)\}\}/g, (placeholder, name) => (
    values.has(name) ? values.get(name) : placeholder
  ));
}

function assertInstalledVerificationModel(grounderPath, designTemplate) {
  const { parseVerificationDefinitions } = require(grounderPath);
  assert.equal(typeof parseVerificationDefinitions, 'function');
  const concreteDesign = renderCanonicalVerificationExample(designTemplate);
  const errors = [];
  const definitions = parseVerificationDefinitions(concreteDesign, errors);
  assert.deepEqual(errors, []);
  assert.equal(definitions.size, 1);
  const definition = definitions.get('V1');
  assert.ok(definition);
  assert.deepEqual(definition.subject_criteria, ['R1.1']);
  assert.deepEqual(definition.proof_criteria, []);
  assert.equal(definition.proof_owner, null);
  assert.equal(definition.evidence_anchor, null);
  assert.deepEqual(definition.decision_refs, ['D1', 'I1', 'C1']);
  for (const field of [
    'subject_criteria', 'subject_owner', 'decision_refs', 'method', 'expected',
    'negative', 'reachability'
  ]) {
    const value = definition[field];
    assert.ok(
      Array.isArray(value)
        ? value.length > 0
        : (typeof value === 'string' ? value.trim() !== '' : value && Object.keys(value).length > 0)
    );
  }
  for (const mutation of [
    concreteDesign.replace('- **V1**:', '### V1 —'),
    concreteDesign.replace('- **V1**:', '| V1 |'),
    concreteDesign.replace('; Expected ', '\nExpected '),
    concreteDesign.replace('Decision refs ', 'Decisions '),
  ]) {
    const mutationErrors = [];
    const mutated = parseVerificationDefinitions(mutation, mutationErrors);
    assert.ok(mutationErrors.length > 0);
    assert.equal(mutated.has('V1'), false);
  }
}

function markdownSection(content, heading) {
  const lines = String(content).split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

function markdownTableUnderHeading(content, heading) {
  const lines = markdownSection(content, heading).split('\n');
  const tableStart = lines.findIndex((line) => line.trim().startsWith('|'));
  if (tableStart < 0) return [];
  const rows = [];
  for (let index = tableStart; index < lines.length && lines[index].trim().startsWith('|'); index += 1) {
    const cells = lines[index].split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function normalizeMarkdownWhitespace(content) {
  return String(content).replace(/\s+/g, ' ').trim();
}

function markdownBetweenHeadings(content, startHeading, endHeading) {
  const value = String(content);
  const startMarker = `## ${startHeading}`;
  const endMarker = `## ${endHeading}`;
  const startIndex = value.indexOf(startMarker);
  const endIndex = value.indexOf(endMarker, startIndex + startMarker.length);
  if (startIndex < 0 || endIndex < 0) return '';
  return value.slice(startIndex + startMarker.length, endIndex);
}

function implementationReadinessIssues(input) {
  const keys = input && typeof input === 'object' && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (keys.join(',') !== 'review,templates'
    || typeof input.templates !== 'string' || typeof input.review !== 'string') {
    throw new TypeError('implementation-readiness checker expects templates and review UTF-8 strings');
  }

  const issues = new Set();
  const { templates, review } = input;
  const authoring = markdownSection(templates, 'No-invention and conditional boundary contracts');
  if (!authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.noInvention)) {
    issues.add('no-invention');
  }
  const contradictoryNoInvention = /\b(?:exception|however)\b.{0,160}\bimplementation handoff\b.{0,80}\b(?:may|can)\s+(?:proceed|continue)\b.{0,160}\bunresolved\b/i;
  if (contradictoryNoInvention.test(normalizeMarkdownWhitespace(authoring))) {
    issues.add('no-invention');
  }

  const boundaryTable = markdownTableUnderHeading(
    templates,
    'No-invention and conditional boundary contracts'
  );
  if (!authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.materialDefinition)
    || !authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.exactBoundaryChoices)
    || IMPLEMENTATION_READINESS_BOUNDARY_ROWS.length !== 9
    || !boundaryTableHasRequiredRows(boundaryTable)) {
    issues.add('boundary-contract');
  }

  const proof = markdownSection(templates, 'Verification Plan');
  const proofPlanLines = proof.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('- '));
  const normalizedProofContract = normalizeMarkdownWhitespace(markdownBetweenHeadings(
    templates,
    'Verification Plan',
    'Canonical inline Receipt'
  ));
  const normalizedProofClauses = [
    IMPLEMENTATION_READINESS_CLAUSES.proofTrace,
    IMPLEMENTATION_READINESS_CLAUSES.namedProbeOwnership,
    IMPLEMENTATION_READINESS_CLAUSES.proofLevelSeparation,
    IMPLEMENTATION_READINESS_CLAUSES.disposableTemplateControls,
    IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping
  ].map(normalizeMarkdownWhitespace);
  const reviewNegativeControls = normalizeMarkdownWhitespace(
    markdownSection(review, 'B2 — fresh-context red team')
  );
  if (JSON.stringify(proofPlanLines) !== JSON.stringify(IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines)
    || normalizedProofClauses.some((clause) => !normalizedProofContract.includes(clause))
    || !reviewNegativeControls.includes(normalizeMarkdownWhitespace(
      IMPLEMENTATION_READINESS_CLAUSES.disposableReviewControls
    ))) {
    issues.add('proof-chain');
  }

  const failureGuidance = markdownSection(templates, 'Twelve edge-case dimensions');
  if (!failureGuidance.includes(IMPLEMENTATION_READINESS_CLAUSES.failureSemantics)) {
    issues.add('failure-semantics');
  }

  const evidenceRules = markdownSection(review, 'B1 — evidence rule');
  if (!evidenceRules.includes(IMPLEMENTATION_READINESS_CLAUSES.privacyIdentifiers)) {
    issues.add('privacy-identifiers');
  }

  const closure = markdownSection(review, 'Accepted-repair closure');
  const normalizedClosure = normalizeMarkdownWhitespace(closure);
  const closureHeader = markdownTableUnderHeading(review, 'Accepted-repair closure')[0] || [];
  if (JSON.stringify(closureHeader) !== JSON.stringify([
    'ID', 'Decision', 'Original counterexample', 'Repaired at', 'Proved at', 'Replay', 'Closure'
  ])
    || !normalizedClosure.includes(normalizeMarkdownWhitespace(IMPLEMENTATION_READINESS_CLAUSES.freshReplay))
    || !closure.includes(IMPLEMENTATION_READINESS_CLAUSES.distinctRepairProof)
    || !closure.includes(IMPLEMENTATION_READINESS_CLAUSES.closureTransition)
    || !closure.includes(IMPLEMENTATION_READINESS_CLAUSES.unknownBlocks)
    || !closure.includes(IMPLEMENTATION_READINESS_CLAUSES.scopeReturnsToC1)) {
    issues.add('repair-closure');
  }

  return [...issues].sort();
}

function adaptiveCoverageIssues(input) {
  const expectedKeys = ['review', 'skill', 'specMaker', 'templates'];
  const keys = input && typeof input === 'object' && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)
    || expectedKeys.some((key) => typeof input[key] !== 'string')) {
    throw new TypeError('adaptive-coverage checker expects skill, specMaker, templates, and review UTF-8 strings');
  }

  const issues = new Set();
  const skill = normalizeMarkdownWhitespace(input.skill);
  const templates = normalizeMarkdownWhitespace(input.templates);
  const review = normalizeMarkdownWhitespace(input.review);
  const specMaker = normalizeMarkdownWhitespace(input.specMaker);
  const has = (source, clause) => source.includes(normalizeMarkdownWhitespace(clause));

  const riskClauses = [
    ADAPTIVE_COVERAGE_CLAUSES.riskFirst,
    ADAPTIVE_COVERAGE_CLAUSES.criticalFloor,
    ADAPTIVE_COVERAGE_CLAUSES.elevatedFloor,
    ADAPTIVE_COVERAGE_CLAUSES.frontmatterGate,
    ADAPTIVE_COVERAGE_CLAUSES.directGate,
    ADAPTIVE_COVERAGE_CLAUSES.splitRoute,
    ADAPTIVE_COVERAGE_CLAUSES.independentSubsystem
  ];
  const riskDowngrade = /\buser\b.{0,80}\b(?:may|can)\b.{0,80}\blower\b.{0,40}\brisk\b/i;
  const riskyDirectOverride = /\b(?:exception|even if|regardless)\b.{0,160}\b(?:auth|secret|privacy|destructive|irreversible|data loss|corruption|production[- ]state|critical)\b.{0,160}\b(?:direct|work directly|go direct)\b/i;
  if (riskClauses.some((clause) => !has(skill, clause))
    || riskDowngrade.test(skill) || riskyDirectOverride.test(skill)) {
    issues.add('risk-first-routing');
  }

  const profileTable = markdownTableUnderHeading(input.templates, 'Coverage profile');
  const profileHeadingCount = (input.templates.match(/^## Coverage profile\s*$/gm) || []).length;
  const taskReferencesCoverage = /## Coverage\s*\n- <exact `CP-NN` IDs owned by this task>/.test(input.templates);
  if (JSON.stringify(profileTable[0] || []) !== JSON.stringify(ADAPTIVE_COVERAGE_PROFILE_HEADER)
    || profileHeadingCount !== 1 || profileTable.length !== 2
    || JSON.stringify(profileTable[1]) !== JSON.stringify(ADAPTIVE_COVERAGE_PROFILE_ROW)
    || !taskReferencesCoverage
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.profileAuthority)
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.openKinds)) {
    issues.add('coverage-profile-shape');
  }

  const ambiguityTable = markdownTableUnderHeading(input.templates, 'Example Mapping rule');
  if (JSON.stringify(ambiguityTable) !== JSON.stringify(ADAPTIVE_COVERAGE_AMBIGUITY_ROWS)
    || !templates.includes('retention of 30 versus 90 days is `decision-needed`')) {
    issues.add('ambiguity-actions');
  }

  const globalCeremony = /\b(?:critical|security|failure|proof|review|edge|obligations?|lenses?)\b[^.!?\n]{0,120}\b(?:union|apply|spread|require)\w*\b[^.!?\n]{0,120}\b(?:all|every)\s+(?:cp\s+)?(?:rows?|outcomes?|tasks?)\b|\b(?:union|apply|spread)\w*\b[^.!?\n]{0,120}\b(?:all|every)\s+(?:cp\s+)?(?:rows?|outcomes?|tasks?)\b/i;
  if (!has(templates, ADAPTIVE_COVERAGE_CLAUSES.scopedUnion)
    || globalCeremony.test(templates)
    || !review.includes('nonmaterial lenses are not added')) {
    issues.add('scoped-coverage');
  }

  const rederiveSources = [templates, skill, specMaker, review];
  if (!has(templates, ADAPTIVE_COVERAGE_CLAUSES.profileRederivation)
    || rederiveSources.some((source) => !/rederive affected cp rows?/.test(source.toLowerCase()))) {
    issues.add('profile-lifecycle');
  }

  const statusMatrix = markdownTableUnderHeading(input.templates, 'Status matrix');
  if (!has(templates, ADAPTIVE_COVERAGE_CLAUSES.plannedProof)
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.proofSeparation)
    || !has(templates, IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping)
    || !has(skill, ADAPTIVE_COVERAGE_CLAUSES.liveLimit)
    || !statusMatrix.some((row) => row[0] === 'accepted finding open or `UNKNOWN` reachability' && row[1] === '`blocked`')) {
    issues.add('proof-lifecycle');
  }

  const reviewerRowsPresent = ADAPTIVE_REVIEWER_ROWS.every((row) =>
    input.review.includes(`| ${row.join(' | ')} |`));
  if (!has(review, ADAPTIVE_COVERAGE_CLAUSES.reviewRisk)
    || !has(review, ADAPTIVE_COVERAGE_CLAUSES.reviewCapacity)
    || !reviewerRowsPresent) {
    issues.add('reviewer-routing');
  }
  if (!specMaker.includes('skills/specs/SKILL.md')
    || !specMaker.includes('skills/specs/references/templates.md')
    || !has(specMaker, ADAPTIVE_COVERAGE_CLAUSES.specMakerAuthority)
    || !has(specMaker, ADAPTIVE_COVERAGE_CLAUSES.specMakerAmbiguity)
    || !has(specMaker, ADAPTIVE_COVERAGE_CLAUSES.specMakerRoute)) {
    issues.add('spec-maker-authority');
  }

  const boundaryTable = markdownTableUnderHeading(
    input.templates,
    'No-invention and conditional boundary contracts'
  );
  if (!boundaryTableHasRequiredRows(boundaryTable)) {
    issues.add('adaptive-boundary-lenses');
  }
  return [...issues].sort();
}

function authoringProjectionIssues(files) {
  const issues = [];
  issues.push(...implementationReadinessIssues({ templates: files.templates, review: files.review }));
  const foreignRuntimeBoundary = 'If you are Claude Code or any other runtime, ignore this entire Codex block';
  if (!files.skill.includes('Task files are flat beside `plan.md`')
    || !files.skill.includes('Do not create a nested task directory.')) {
    issues.push('flat-layout-entrypoint');
  }
  if (!files.templates.includes('The primary layout is always flat:')
    || !files.templates.includes('task-NN-<slug>.md')) {
    issues.push('flat-layout-template');
  }
  for (const gate of ['GATE-SCOPE', 'GATE-REVIEW', 'GATE-DONE']) {
    if (!files.skill.includes(gate)) issues.push(`human-gate-${gate.slice(0, 2).toLowerCase()}`);
  }
  if (!files.review.includes('fresh-context red team')
    || !/Cap the presented\s+list at 15/.test(files.review)
    || !files.review.includes('at most two review-and-repair rounds')) {
    issues.push('adversarial-review');
  }
  if (!files.skill.includes('inline `## Receipt`')
    || !files.templates.includes('## Canonical inline Receipt')) {
    issues.push('inline-receipt');
  }
  for (const field of [
    'Verification: PASS', 'Command:', 'Exit: 0', 'Base:', 'Head:'
  ]) {
    if (!files.templates.includes(field)) issues.push(`receipt-${field.toLowerCase()}`);
  }
  if (!/^name: cf-specs$/m.test(files.skill)) issues.push('codex-skill-name');
  const bundle = [files.skill, files.review, files.templates, files.legacyTemplates].join('\n');
  const runtimeProjection = `${bundle}\n${files.codex.replace(foreignRuntimeBoundary, '')}`;
  if (!files.codex.includes(foreignRuntimeBoundary)
    || files.codex.includes('If you are Codex CLI or any other runtime, ignore this entire Codex block')) {
    issues.push('codex-ownership-boundary');
  }
  for (const claudeOnly of [
    'AskUserQuestion', 'TaskCreate', 'TaskGet', 'TaskUpdate', 'TaskList',
    'WebSearch', 'WebFetch', 'SendMessage', 'Claude Code', '.claude', '/cf:', 'cf:'
  ]) {
    if (runtimeProjection.includes(claudeOnly)) issues.push(`claude-vocabulary-${claudeOnly}`);
  }
  for (const command of ['$cf-specs', '$cf-develop', '$cf-sync']) {
    if (!files.codex.includes(command)) issues.push(`codex-command-${command}`);
  }
  for (const state of ['pending', 'in_progress', 'paused', 'blocked', 'done']) {
    if (!files.codex.includes(`\`${state}\``)) issues.push(`lifecycle-${state}`);
  }
  if (!files.codex.includes('flat `task-NN-*.md` files')
    || !files.codex.includes('inline `## Receipt`')
    || !files.codex.includes('GATE-SCOPE') || !files.codex.includes('GATE-REVIEW') || !files.codex.includes('GATE-DONE')) {
    issues.push('codex-process-v3');
  }
  return [...new Set(issues)].sort();
}

function canonicalInstalledSpecsRoot(projectRoot, installedRoot) {
  assert.equal(path.isAbsolute(projectRoot), true, 'project root must be absolute');
  assert.equal(path.isAbsolute(installedRoot), true, 'installed Specs root must be absolute');
  const canonicalProject = fs.realpathSync(projectRoot);
  const canonicalInstalled = fs.realpathSync(installedRoot);
  const relative = path.relative(canonicalProject, canonicalInstalled);
  assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'installed Specs root must stay inside project');
  assert.equal(
    canonicalInstalled,
    fs.realpathSync(path.join(canonicalProject, '.agents/skills/specs')),
    'checker must read the native installed Codex Specs root'
  );
  return canonicalInstalled;
}

function readInstalledAuthoringProjection(projectRoot, installedRoot) {
  const canonicalRoot = canonicalInstalledSpecsRoot(projectRoot, installedRoot);
  const read = (relative) => fs.readFileSync(path.join(canonicalRoot, relative), 'utf8');
  const specMakerToml = fs.readFileSync(
    path.join(projectRoot, '.codex/agents/spec_maker.toml'),
    'utf8'
  );
  return {
    skill: read('SKILL.md'),
    review: read('references/review.md'),
    templates: read('references/templates.md'),
    specMaker: parseGeneratedTomlString(specMakerToml, 'developer_instructions'),
    legacyTemplates: V3_SPECS_BUNDLE.filter((relative) => relative.startsWith('templates/')).map(read).join('\n'),
    codex: [
      fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8'),
      fs.readFileSync(path.join(projectRoot, '.codex/rules/state-sync.md'), 'utf8')
    ].join('\n')
  };
}

function installedAuthoringProjectionIssues(projectRoot, installedRoot) {
  return authoringProjectionIssues(readInstalledAuthoringProjection(projectRoot, installedRoot));
}

function installedAdaptiveCoverageIssues(projectRoot, installedRoot) {
  const { skill, specMaker, templates, review } = readInstalledAuthoringProjection(
    projectRoot,
    installedRoot
  );
  return adaptiveCoverageIssues({ skill, specMaker, templates, review });
}

function assertDisposableInstalledMutationTarget({
  projectRoot,
  installedScope,
  targetPath,
  expectedTargetPath,
  canonicalSourcePaths,
  scopeLabel
}) {
  const canonicalProject = fs.realpathSync(projectRoot);
  const canonicalScope = fs.realpathSync(installedScope);
  const targetLstat = fs.lstatSync(targetPath);
  assert.equal(targetLstat.isSymbolicLink(), false, 'installed mutation target must not be a symlink');
  assert.equal(targetLstat.isFile(), true, 'installed mutation target must be a regular file');
  const canonicalTarget = fs.realpathSync(targetPath);
  assert.equal(
    canonicalTarget,
    fs.realpathSync(expectedTargetPath),
    `installed mutation target must be the exact ${scopeLabel} projection`
  );
  const scopeRelative = path.relative(canonicalScope, canonicalTarget);
  const projectRelative = path.relative(canonicalProject, canonicalTarget);
  assert.ok(
    scopeRelative && scopeRelative !== '..'
      && !scopeRelative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(scopeRelative),
    `installed mutation target must stay inside ${scopeLabel}`
  );
  assert.ok(
    projectRelative && projectRelative !== '..'
      && !projectRelative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(projectRelative),
    'installed mutation target must stay inside the disposable project'
  );
  assert.ok(
    Array.isArray(canonicalSourcePaths) && canonicalSourcePaths.length > 0,
    'installed mutation guard requires the full canonical source set'
  );
  const targetStat = fs.statSync(canonicalTarget);
  for (const sourcePath of canonicalSourcePaths) {
    const canonicalSource = fs.realpathSync(sourcePath);
    assert.notEqual(
      canonicalTarget,
      canonicalSource,
      'installed mutation target must not resolve to any canonical source'
    );
    const sourceStat = fs.statSync(canonicalSource);
    assert.notDeepEqual(
      [targetStat.dev, targetStat.ino],
      [sourceStat.dev, sourceStat.ino],
      `installed mutation target must not share an inode with canonical source set: ${sourcePath}`
    );
  }
  assert.equal(targetStat.nlink, 1, 'installed mutation target must have exactly one hard link');
  return canonicalTarget;
}

function assertInstalledMutationTarget(projectRoot, installedRoot, relative) {
  const canonicalInstalled = canonicalInstalledSpecsRoot(projectRoot, installedRoot);
  const targetPath = path.join(canonicalInstalled, relative);
  return assertDisposableInstalledMutationTarget({
    projectRoot,
    installedScope: canonicalInstalled,
    targetPath,
    expectedTargetPath: path.join(projectRoot, '.agents/skills/specs', relative),
    canonicalSourcePaths: canonicalProjectionSourcePaths(),
    scopeLabel: '.agents/skills/specs'
  });
}

function assertInstalledSpecMakerMutationTarget(projectRoot) {
  const installedScope = path.join(projectRoot, '.codex/agents');
  const targetPath = path.join(installedScope, 'spec_maker.toml');
  return assertDisposableInstalledMutationTarget({
    projectRoot,
    installedScope,
    targetPath,
    expectedTargetPath: targetPath,
    canonicalSourcePaths: canonicalProjectionSourcePaths(),
    scopeLabel: '.codex/agents'
  });
}

function canonicalProjectionSourcePaths() {
  return [
    ...V3_SPECS_BUNDLE.map((relative) => path.join(SPECS_SOURCE_ROOT, relative)),
    SPEC_MAKER_SOURCE_PATH
  ];
}

function canonicalProjectionSourceBytes() {
  const sourcePaths = canonicalProjectionSourcePaths();
  return new Map(sourcePaths.map((sourcePath) => [
    sourcePath,
    fs.readFileSync(sourcePath)
  ]));
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function canonicalBrainstormSourceBytes() {
  return new Map(BRAINSTORM_SOURCE_PATHS.map((sourcePath) => [
    sourcePath,
    fs.readFileSync(sourcePath)
  ]));
}

function assertCanonicalBrainstormSourceBytesUnchanged(sourceBytes) {
  for (const [sourcePath, expected] of sourceBytes) {
    const actual = fs.readFileSync(sourcePath);
    assert.deepEqual(
      actual,
      expected,
      `canonical Brainstorm source changed: ${path.relative(PACKAGE_ROOT, sourcePath)}`
    );
    assert.equal(sha256(actual), sha256(expected));
  }
}

function readInstalledBrainstormProjection(projectRoot) {
  const skillRoot = path.join(projectRoot, '.agents/skills/brainstorm');
  const agentPath = path.join(projectRoot, '.codex/agents/brainstormer.toml');
  return {
    skill: fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8'),
    framework: fs.readFileSync(path.join(skillRoot, 'references/question-framework.md'), 'utf8'),
    agent: parseGeneratedTomlString(fs.readFileSync(agentPath, 'utf8'), 'developer_instructions')
  };
}

function brainstormProjectionClausePrefix(content, index) {
  const starts = ['.', '!', '?', ';', '\n'].map((marker) => content.lastIndexOf(marker, index - 1));
  return content.slice(Math.max(...starts) + 1, index).trim();
}

function brainstormProjectionIsLocallyNegated(content, index) {
  const clausePrefix = brainstormProjectionClausePrefix(content, index);
  const localBoundary = Math.max(
    clausePrefix.lastIndexOf(','),
    clausePrefix.lastIndexOf(':'),
    clausePrefix.lastIndexOf('—')
  );
  const localPrefix = clausePrefix.slice(localBoundary + 1).trim().toLowerCase();
  const directNegation = /\b(?:never|do not|does not|must not|may not|should not|will not|cannot|can't|is forbidden to|are forbidden to|is not (?:permitted|allowed) to|are not (?:permitted|allowed) to|not (?:permitted|allowed) to)(?:\s+(?:ever|directly|automatically|implicitly|explicitly|immediately|intentionally|silently))*\s*$/;
  if (directNegation.test(localPrefix)) return true;
  const fullPrefix = clausePrefix.toLowerCase();
  if (/\b(?:but|yet|however|except|instead)\b[^.!?;\n]*$/.test(fullPrefix)) return false;
  return /\b(?:never|do not|does not|must not|may not|should not|will not|cannot|can't|is forbidden to|are forbidden to|is not (?:permitted|allowed) to|are not (?:permitted|allowed) to|not (?:permitted|allowed) to)\b(?:(?!\b(?:but|yet|however|except|instead)\b).){0,160}\b(?:and|or|nor)(?:\s+then)?(?:\s+(?:ever|directly|automatically|implicitly|explicitly|immediately|intentionally|silently))*\s*$/.test(fullPrefix);
}

function brainstormProjectionHasUnauthorizedAuthority(content) {
  const actionPattern = /\b(?:ask|question|contact|invoke|start|dispatch|launch|route|forward|run|execute|hand(?:\s+|-)?off|write|edit|update|mutate|delegate|claim)\b/gi;
  const actions = [...content.matchAll(actionPattern)];
  for (let index = 0; index < actions.length; index += 1) {
    const match = actions[index];
    const normalizedAction = match[0].toLowerCase().replace(/[-\s]+/g, ' ');
    const action = normalizedAction === 'handoff' ? 'hand off' : normalizedAction;
    const start = match.index + match[0].length;
    const nextAction = actions[index + 1]?.index ?? content.length;
    const punctuation = content.slice(start).search(/[.!?;\n]/);
    const punctuationEnd = punctuation < 0 ? content.length : start + punctuation;
    const tail = content.slice(start, Math.min(start + 100, nextAction, punctuationEnd));
    const hasTarget = ['ask', 'question', 'contact'].includes(action)
      ? /\b(?:the )?user\b/i.test(tail)
      : ['invoke', 'start', 'dispatch', 'launch', 'route', 'forward', 'run', 'execute', 'hand off'].includes(action)
        ? /\b(?:Specs|Fix|Develop)\b/i.test(tail)
        : ['write', 'edit', 'update', 'mutate'].includes(action)
          ? /\b(?:files?|task state|shared state)\b/i.test(tail)
          : action === 'delegate'
            ? /\b(?:work|tasks?)\b/i.test(tail)
            : /\bapproval\b/i.test(tail);
    if (hasTarget && !brainstormProjectionIsLocallyNegated(content, match.index)) return true;
  }
  return false;
}

function brainstormProjectionIssues(files) {
  const compact = (value) => String(value).replace(/\s+/g, ' ').trim();
  const skill = compact(files.skill);
  const framework = compact(files.framework);
  const agent = compact(files.agent);
  const issues = new Set();
  const specialistBoundary = 'Do not ask the user directly, write files, mutate shared task state, delegate work, invoke Specs/Fix/Develop, or claim approval.';
  const specialistHandoff = 'Non-bug exploration may end in chat; feature/docs delivery may only prepare a future explicit Specs invocation; bug handoff requires evidenced root cause and the user\'s explicit fix request.';
  const agentAuthorityRemainder = agent
    .replace(specialistBoundary, '')
    .replace(specialistHandoff, '');
  const adaptiveClauses = {
    'adaptive-direct-precedence': 'Route Direct first, then apply controls only to requests that remain in Brainstorm.',
    'adaptive-ordered-depth': 'With no Deep signal, use Standard. `--deep` raises Standard to Deep.',
    'adaptive-leading-flags': 'Parse controls only from the leading consecutive token segment.',
    'adaptive-lens-trigger-skip': 'failure isolation for partial or cascading failure across boundaries',
    'adaptive-evidence-semantics': 'Missing evidence forces feasibility `unknown` and confidence `low`.',
    'adaptive-numeric-estimates': 'A numeric estimate requires range, unit, basis, evidence, and assumptions; otherwise report `unknown`.',
    'adaptive-pre-tool-redaction': 'Before an external visual tool or adviser handoff, minimize context and redact secrets, credentials, private keys, access tokens, and unnecessary PII.',
    'adaptive-adviser-gate': '`--advice` invokes `brainstormer` only after the material-choice gate;',
    'adaptive-decision-freshness': 'The first section records target identity, current source revision and worktree state or `[UNVERIFIED]`, an evidence-as-of value, and what change invalidates the brief.',
    'adaptive-non-authority': 'Neither overlay writes, approves, persists, dispatches, or completes work.'
  };

  if (!skill.includes('leave Brainstorm before scout, questions, approval, or persistence.')
    || !skill.includes('Hydration is not a terminal route; continue to exactly one intent route below.')) {
    issues.add('front-door-routing');
  }
  if (!skill.includes('Then use `cf-debug` until root cause is evidenced.')
    || !skill.includes('Hand off to `cf-fix` only when the user explicitly requested a fix')) {
    issues.add('bug-routing');
  }
  if (!skill.includes('Do not request design approval, persist a report, or invoke another workflow without a new explicit request.')) {
    issues.add('exploration-stop');
  }
  if (!skill.includes('For a material choice, compare 2–3 mechanically distinct viable approaches')
    || !skill.includes('Never create strawman options.')
    || !agent.includes('never invent strawmen to fill a quota.')) {
    issues.add('option-cardinality');
  }
  if (!agent.includes('You advise `cf-brainstorm`; you do not replace its routing, question, approval, persistence, or handoff ownership.')
    || !agent.includes(specialistBoundary)
    || brainstormProjectionHasUnauthorizedAuthority(agentAuthorityRemainder)) {
    issues.add('specialist-boundary');
  }
  if (!agent.includes('If the request is a symptom without an evidenced root cause, return it to `cf-debug`.')
    || !agent.includes('If the controller has not identified whether the work is feature delivery, an explicitly authorized fix, or non-bug exploration, request that routing context instead of guessing.')) {
    issues.add('specialist-routing');
  }
  if (!agent.includes(specialistHandoff)) {
    issues.add('specialist-handoff');
  }
  if (!skill.includes('Persist only approved decisions and semantics, only with user authority')
    || !skill.includes('redact live secrets, credentials, private keys, access tokens, and unnecessary PII;')
    || !framework.includes('Do not write "user selected" unless direct user text or the native input tool confirms it.')) {
    issues.add('approval-persistence');
  }
  for (const [issue, clause] of Object.entries(adaptiveClauses)) {
    if (!skill.includes(clause)) issues.add(issue);
  }
  const visible = `${skill}\n${framework}\n${agent}`;
  if (/\bAskUserQuestion\b/.test(visible)
    || /\b(?:a|an|one|each|every|another|this|that|the|[0-9]+)\s+a structured user-input request\b/i.test(visible)
    || /\ban structured user-input request\b/i.test(visible)
    || /\ba structured user-input request\s+(?:calls|batches)\b/i.test(visible)) {
    issues.add('projection-grammar');
  }
  return [...issues].sort();
}

function assertInstalledBrainstormMutationTarget(projectRoot, source) {
  const skillRoot = path.join(projectRoot, '.agents/skills/brainstorm');
  if (source === 'agent') {
    const agentRoot = path.join(projectRoot, '.codex/agents');
    const targetPath = path.join(agentRoot, 'brainstormer.toml');
    return assertDisposableInstalledMutationTarget({
      projectRoot,
      installedScope: agentRoot,
      targetPath,
      expectedTargetPath: targetPath,
      canonicalSourcePaths: BRAINSTORM_SOURCE_PATHS,
      scopeLabel: '.codex/agents'
    });
  }
  const relative = source === 'skill' ? 'SKILL.md' : 'references/question-framework.md';
  const targetPath = path.join(skillRoot, relative);
  return assertDisposableInstalledMutationTarget({
    projectRoot,
    installedScope: skillRoot,
    targetPath,
    expectedTargetPath: targetPath,
    canonicalSourcePaths: BRAINSTORM_SOURCE_PATHS,
    scopeLabel: '.agents/skills/brainstorm'
  });
}

function assertCanonicalSpecsSourceBytesUnchanged(sourceBytes) {
  for (const [sourcePath, expected] of sourceBytes) {
    const actual = fs.readFileSync(sourcePath);
    assert.deepEqual(
      actual,
      expected,
      `canonical source bytes changed during installed mutation: ${path.relative(PACKAGE_ROOT, sourcePath)}`
    );
    assert.equal(
      sha256(actual),
      sha256(expected),
      `canonical source SHA changed during installed mutation: ${path.relative(PACKAGE_ROOT, sourcePath)}`
    );
  }
}

function assertInstalledAuthoringProjection(root, installedRoot) {
  canonicalInstalledSpecsRoot(root, installedRoot);
  const relativeFiles = (directory) => allFiles(directory, () => true)
    .map((file) => path.relative(directory, file).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(relativeFiles(SPECS_SOURCE_ROOT), V3_SPECS_BUNDLE);
  assert.deepEqual(relativeFiles(installedRoot), V3_SPECS_BUNDLE);

  for (const relative of V3_SPECS_BUNDLE) {
    const sourcePath = path.join(SPECS_SOURCE_ROOT, relative);
    const expected = normalizeCodexBody(fs.readFileSync(sourcePath, 'utf8'), sourcePath);
    const actual = fs.readFileSync(path.join(installedRoot, relative), 'utf8');
    assert.equal(actual, expected, `Codex Specs projection drifted: ${relative}`);
  }
  const sourceSpecMaker = fs.readFileSync(SPEC_MAKER_SOURCE_PATH, 'utf8');
  const installedSpecMakerPath = path.join(root, '.codex/agents/spec_maker.toml');
  assert.equal(
    fs.readFileSync(installedSpecMakerPath, 'utf8'),
    convertCodexAgentContent(sourceSpecMaker, path.basename(SPEC_MAKER_SOURCE_PATH)),
    'Codex spec_maker projection drifted'
  );
  for (const relative of OBSOLETE_SPECS_FILES) {
    assert.equal(fs.existsSync(path.join(installedRoot, relative)), false, `obsolete Specs file installed: ${relative}`);
  }

  const files = readInstalledAuthoringProjection(root, installedRoot);
  const sourceBytes = canonicalProjectionSourceBytes();
  assert.deepEqual(installedAuthoringProjectionIssues(root, installedRoot), []);
  assert.deepEqual(installedAdaptiveCoverageIssues(root, installedRoot), []);
  assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);

  if (process.platform !== 'win32') {
    for (const [installedPath, sourcePath, assertTarget] of [
      [
        path.join(installedRoot, 'references/templates.md'),
        path.join(SPECS_SOURCE_ROOT, 'references/templates.md'),
        () => assertInstalledMutationTarget(root, installedRoot, 'references/templates.md')
      ],
      [
        installedSpecMakerPath,
        SPEC_MAKER_SOURCE_PATH,
        () => assertInstalledSpecMakerMutationTarget(root)
      ]
    ]) {
      const backupPath = `${installedPath}.cafekit-backup`;
      fs.renameSync(installedPath, backupPath);
      try {
        fs.linkSync(sourcePath, installedPath);
        assert.throws(assertTarget, /must not share an inode with canonical source/);
        assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
      } finally {
        try { fs.unlinkSync(installedPath); } catch { /* best-effort disposable cleanup */ }
        fs.renameSync(backupPath, installedPath);
      }
    }

    const crossSourceRoot = path.join(root, 'cross-source-native-control');
    const crossSourceProject = path.join(crossSourceRoot, 'project');
    const crossSourceScope = path.join(crossSourceProject, '.agents/skills/specs');
    const crossSourceTarget = path.join(crossSourceScope, 'target-a.md');
    const crossSourcePaths = [
      path.join(crossSourceRoot, 'sources/source-a.md'),
      path.join(crossSourceRoot, 'sources/source-b.md')
    ];
    fs.mkdirSync(crossSourceScope, { recursive: true });
    fs.mkdirSync(path.dirname(crossSourcePaths[0]), { recursive: true });
    fs.writeFileSync(crossSourceTarget, 'native installed target A\n');
    fs.writeFileSync(crossSourcePaths[0], 'native canonical source A\n');
    fs.writeFileSync(crossSourcePaths[1], 'native canonical source B\n');
    const targetBytes = fs.readFileSync(crossSourceTarget);
    const sourceState = new Map(crossSourcePaths.map((sourcePath) => {
      const bytes = fs.readFileSync(sourcePath);
      return [sourcePath, { bytes, sha: sha256(bytes) }];
    }));
    assert.notEqual(crossSourcePaths[0], crossSourcePaths[1], 'cross-source control requires A != B');
    fs.unlinkSync(crossSourceTarget);
    fs.linkSync(crossSourcePaths[1], crossSourceTarget);
    try {
      assert.throws(
        () => fs.writeFileSync(
          assertDisposableInstalledMutationTarget({
            projectRoot: crossSourceProject,
            installedScope: crossSourceScope,
            targetPath: crossSourceTarget,
            expectedTargetPath: crossSourceTarget,
            canonicalSourcePaths: crossSourcePaths,
            scopeLabel: '.agents/skills/specs'
          }),
          'forbidden native cross-source mutation\n'
        ),
        /must not share an inode with canonical source set/
      );
    } finally {
      fs.unlinkSync(crossSourceTarget);
      fs.writeFileSync(crossSourceTarget, targetBytes);
      fs.writeFileSync(crossSourcePaths[1], sourceState.get(crossSourcePaths[1]).bytes);
    }
    assert.deepEqual(fs.readFileSync(crossSourceTarget), targetBytes, 'cross-source control must restore exact target bytes');
    for (const [sourcePath, expected] of sourceState) {
      const actual = fs.readFileSync(sourcePath);
      assert.deepEqual(actual, expected.bytes, 'cross-source rejection must preserve every source byte');
      assert.equal(sha256(actual), expected.sha, 'cross-source rejection must preserve every source SHA');
    }
  }

  const boundaryMutation = (name, boundary, replacements) => {
    const row = IMPLEMENTATION_READINESS_BOUNDARY_ROWS.find(([label]) => label === boundary);
    assert.ok(row, `${name} references unknown boundary ${boundary}`);
    let weakened = row[1];
    for (const [from, to] of replacements) {
      const next = weakened.replace(from, to);
      assert.notEqual(next, weakened, `${name} weakening anchor must exist in ${boundary}`);
      weakened = next;
    }
    return {
      name,
      issue: 'boundary-contract',
      relative: 'references/templates.md',
      from: `| ${row[0]} | ${row[1]} |`,
      to: `| ${row[0]} | ${weakened} |`
    };
  };

  const readinessMutations = [
    {
      name: 'no-invention-blocking',
      issue: 'no-invention',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.noInvention,
      to: 'Before implementation handoff, note ambiguous choices without blocking handoff.'
    },
    {
      name: 'no-invention-contradictory-override',
      issue: 'no-invention',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.noInvention,
      to: `${IMPLEMENTATION_READINESS_CLAUSES.noInvention}\n\nException: implementation handoff may proceed with an unresolved material choice.`
    },
    {
      name: 'material-boundary-definition',
      issue: 'boundary-contract',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.materialDefinition,
      to: 'A boundary is material when it seems relevant to the task.'
    },
    {
      name: 'exact-boundary-choices',
      issue: 'boundary-contract',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.exactBoundaryChoices,
      to: 'For every required row, describe the listed choices generally.'
    },
    boundaryMutation('interaction-accessibility', 'Interaction/UI', [
      ['input/focus/keyboard; ', ''],
      ['accessibility; ', '']
    ]),
    boundaryMutation('api-success-and-error-semantics', 'API/CLI', [
      ['success output; ', ''],
      ['error/status/exit; ', '']
    ]),
    boundaryMutation('schema-shape-and-unknown-fields', 'Data/schema', [
      ['exact keys/nesting/types; ', ''],
      ['unknown-field behavior; ', '']
    ]),
    boundaryMutation('schema-enum-and-format', 'Data/schema', [
      ['enum/format/', '']
    ]),
    boundaryMutation('state-lock-lifecycle', 'Async/state', [
      ['writer/lock acquire/contention/release; ', 'writer/lock; ']
    ]),
    boundaryMutation('filesystem-segment-grammar', 'Filesystem/security', [
      ['trusted/untrusted segment grammar; ', '']
    ]),
    boundaryMutation('filesystem-stale-lock-reclaim', 'Filesystem/security', [
      ['lock/stale reclaim; ', '']
    ]),
    boundaryMutation('runtime-rollout-and-recovery', 'Runtime/deploy', [
      ['rollout/rollback; ', ''],
      ['operator recovery', '']
    ]),
    boundaryMutation('retention-clock-and-endpoints', 'Time/retention', [
      ['clock source; ', ''],
      ['unit/precision/timezone; ', ''],
      ['endpoints and inclusion/comparator; ', '']
    ]),
    boundaryMutation('ai-model-safety-and-eval', 'AI/model', [
      ['safety/privacy; ', ''],
      ['eval oracle', '']
    ]),
    boundaryMutation('proof-level-partition', 'Integration/proof', [
      ['proof level (`source`/`installed`/`live`)', 'proof level']
    ]),
    {
      name: 'concrete-named-probe',
      issue: 'proof-chain',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[1],
      to: '- Named probe: <suite label>'
    },
    {
      name: 'aggregate-suite-probe-owner',
      issue: 'proof-chain',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.namedProbeOwnership,
      to: 'Aggregate suites may cite only the suite label.'
    },
    {
      name: 'reachability-levels',
      issue: 'proof-chain',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[2],
      to: '- Reachability: <entrypoint or consumer>'
    },
    {
      name: 'proof-level-separation',
      issue: 'proof-chain',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofLevelSeparation,
      to: 'Proof may be promoted between source, installed, and live levels.'
    },
    {
      name: 'disposable-template-negative-controls',
      issue: 'proof-chain',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.disposableTemplateControls,
      to: 'Run mutation or destructive negative controls against the available project copy.'
    },
    {
      name: 'disposable-review-negative-controls',
      issue: 'proof-chain',
      relative: 'references/review.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.disposableReviewControls,
      to: 'Run mutation or destructive negative controls against the available project copy.'
    },
    {
      name: 'required-proof-level-mapping',
      issue: 'proof-chain',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping,
      to: 'Map one required proof level to one probe; other levels may remain implicit.'
    },
    {
      name: 'artifact-path-and-digest-or-ephemeral',
      issue: 'proof-chain',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[5],
      to: '- Artifacts: <required artifact path, or none>'
    },
    {
      name: 'proof-counterexample',
      issue: 'proof-chain',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[4],
      to: '- Counterexample: <example>'
    },
    {
      name: 'repair-and-proof-columns',
      issue: 'repair-closure',
      relative: 'references/review.md',
      from: '| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |',
      to: '| ID | Decision | Original counterexample | Repaired at | Evidence | Replay | Closure |'
    },
    {
      name: 'fresh-original-counterexample-replay',
      issue: 'repair-closure',
      relative: 'references/review.md',
      from: 'After applying an accepted GATE-REVIEW finding, a fresh-context closure pass records and\nfreshly replays its original counterexample after the repair under this exact review-log header:',
      to: 'After applying an accepted GATE-REVIEW finding, record the repair under this review-log header:'
    },
    {
      name: 'distinct-repair-and-proof-evidence',
      issue: 'repair-closure',
      relative: 'references/review.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.distinctRepairProof,
      to: '`Repaired at` and `Proved at` may cite the same repair edit.'
    },
    {
      name: 'unknown-blocks-handoff',
      issue: 'repair-closure',
      relative: 'references/review.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.unknownBlocks,
      to: '`PASS` closes it; `FAIL` and `UNKNOWN` may continue to implementation handoff.'
    },
    {
      name: 'crash-versus-catchable-failure',
      issue: 'failure-semantics',
      relative: 'references/templates.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.failureSemantics,
      to: 'Crash and catchable failure both mean an error occurred.'
    },
    {
      name: 'privacy-identifier-surface',
      issue: 'privacy-identifiers',
      relative: 'references/review.md',
      from: IMPLEMENTATION_READINESS_CLAUSES.privacyIdentifiers,
      to: 'Any privacy/security claim names the sensitive data at risk.'
    }
  ];
  assert.equal(readinessMutations.length, 30, 'installed readiness mutation set must match canonical source');

  for (const { name, issue, relative, from, to } of readinessMutations) {
    const target = assertInstalledMutationTarget(root, installedRoot, relative);
    const installedBytes = fs.readFileSync(target, 'utf8');
    const anchorIndex = installedBytes.indexOf(from);
    assert.ok(anchorIndex >= 0, `${name} mutation anchor must exist in installed bytes`);
    assert.equal(
      installedBytes.indexOf(from, anchorIndex + from.length),
      -1,
      `${name} mutation anchor must be unique in installed bytes`
    );
    const weakened = `${installedBytes.slice(0, anchorIndex)}${to}${installedBytes.slice(anchorIndex + from.length)}`;
    try {
      fs.writeFileSync(assertInstalledMutationTarget(root, installedRoot, relative), weakened);
      assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
      assert.deepEqual(installedAuthoringProjectionIssues(root, installedRoot), [issue], name);
    } finally {
      fs.writeFileSync(assertInstalledMutationTarget(root, installedRoot, relative), installedBytes);
    }
    assert.deepEqual(installedAuthoringProjectionIssues(root, installedRoot), [], `${name} restore`);
    assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
  }

  const integrationRow = IMPLEMENTATION_READINESS_BOUNDARY_ROWS
    .find(([label]) => label === 'Integration/proof');
  const integrationLine = `| ${integrationRow.join(' | ')} |`;
  const templatesTarget = assertInstalledMutationTarget(
    root,
    installedRoot,
    'references/templates.md'
  );
  const templatesBytes = fs.readFileSync(templatesTarget, 'utf8');
  const extendedTemplates = templatesBytes.replace(
    integrationLine,
    `${integrationLine}\n| other:domain-specific | task-specific material choices and observable oracle |`
  );
  assert.notEqual(extendedTemplates, templatesBytes, 'open-boundary positive control must change installed templates');
  try {
    fs.writeFileSync(assertInstalledMutationTarget(root, installedRoot, 'references/templates.md'), extendedTemplates);
    assert.deepEqual(installedAuthoringProjectionIssues(root, installedRoot), []);
    assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
  } finally {
    fs.writeFileSync(assertInstalledMutationTarget(root, installedRoot, 'references/templates.md'), templatesBytes);
  }
  assert.deepEqual(installedAuthoringProjectionIssues(root, installedRoot), [], 'open-boundary restore');
  assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);

  const adaptiveMutations = [
    ['frontmatter-risk-bypass', 'skill', ADAPTIVE_COVERAGE_CLAUSES.frontmatterGate,
      'skip for any clear one-file or two-file change.', ['risk-first-routing']],
    ['destructive-routine-direct', 'skill', ADAPTIVE_COVERAGE_CLAUSES.directGate,
      'Work directly when the change is routine and likely limited to one or two files.', ['risk-first-routing']],
    ['destructive-direct-exception', 'skill', ADAPTIVE_COVERAGE_CLAUSES.directGate,
      `${ADAPTIVE_COVERAGE_CLAUSES.directGate} Exception: destructive one-file work labeled routine may go direct.`, ['risk-first-routing']],
    ['user-risk-downgrade', 'skill', ADAPTIVE_COVERAGE_CLAUSES.riskFirst,
      `${ADAPTIVE_COVERAGE_CLAUSES.riskFirst} A user may lower critical risk to routine.`, ['risk-first-routing']],
    ['four-subsystem-split', 'skill', ADAPTIVE_COVERAGE_CLAUSES.splitRoute,
      'Split four or more independent subsystems; otherwise use one Specs packet for substantial work.', ['risk-first-routing']],
    ['forced-single-kind', 'templates', ADAPTIVE_COVERAGE_CLAUSES.openKinds,
      'Choose one primary change kind and ignore unfamiliar kinds or surfaces.', ['coverage-profile-shape']],
    ['missing-profile-column', 'templates', '| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |',
      '| ID | Outcome | Change kinds | Material surfaces | Risk/evidence | Required proof |', ['coverage-profile-shape']],
    ['duplicate-profile-heading', 'templates', '## Coverage profile\n',
      '## Coverage profile\n\n## Coverage profile\n', ['coverage-profile-shape']],
    ['truncated-profile-row', 'templates', `| ${ADAPTIVE_COVERAGE_PROFILE_ROW.join(' | ')} |`,
      '| CP-01 | <externally observable outcome> |', ['coverage-profile-shape']],
    ['examples-promote-to-design', 'templates', `| ${ADAPTIVE_COVERAGE_AMBIGUITY_ROWS[2].join(' | ')} |`,
      '| `examples-needed` | add examples and promote to `design-needed` if behavior changes |', ['ambiguity-actions']],
    ['examples-select-retention', 'templates', 'retention of 30 versus 90 days is\n`decision-needed`',
      'retention of 30 versus 90 days may remain\n`examples-needed`', ['ambiguity-actions']],
    ['global-critical-ceremony', 'templates', ADAPTIVE_COVERAGE_CLAUSES.scopedUnion,
      'Each task copies its CP values; authoring, review, edge, and proof obligations union across every task.', ['scoped-coverage']],
    ['scoped-union-contradiction', 'templates', ADAPTIVE_COVERAGE_CLAUSES.scopedUnion,
      `${ADAPTIVE_COVERAGE_CLAUSES.scopedUnion} Exception: critical proof obligations apply across every CP row.`, ['scoped-coverage']],
    ['stale-profile-after-c2', 'templates', ADAPTIVE_COVERAGE_CLAUSES.profileRederivation,
      'Keep existing coverage rows after accepted plan changes.', ['profile-lifecycle']],
    ['planned-proof-blocks-start', 'templates', ADAPTIVE_COVERAGE_CLAUSES.plannedProof,
      '`Required proof` is execution evidence: known but unrun proof blocks `pending`; `UNKNOWN` may proceed; missing evidence may still reach `done`/GATE-DONE.', ['proof-lifecycle']],
    ['source-promotes-live', 'templates', ADAPTIVE_COVERAGE_CLAUSES.proofSeparation,
      'Source proof may promote installed and live proof.', ['proof-lifecycle']],
    ['unmapped-proof-level', 'templates', IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping,
      'A task may map only one required proof level to its probe.', ['proof-lifecycle']],
    ['critical-reviewer-omitted', 'review', ADAPTIVE_COVERAGE_CLAUSES.reviewRisk,
      'Keep Fact Checker as the baseline and choose any remaining reviewer; critical rows need no matching risk role.', ['reviewer-routing', 'scoped-coverage']],
    ['reviewer-lens-overflow', 'review', ADAPTIVE_COVERAGE_CLAUSES.reviewCapacity,
      'Each reviewer owns exactly one lens; skip excess material lenses when the fixed reviewer count is full.', ['reviewer-routing']],
    ['spec-maker-local-taxonomy', 'specMaker', ADAPTIVE_COVERAGE_CLAUSES.specMakerAuthority,
      'this agent owns a separate risk and coverage taxonomy.', ['spec-maker-authority']],
    ['spec-maker-examples-decide', 'specMaker', ADAPTIVE_COVERAGE_CLAUSES.specMakerAmbiguity,
      'Use examples to settle every ambiguous observable behavior.', ['spec-maker-authority']],
    ['spec-maker-skips-brainstorm', 'specMaker', ADAPTIVE_COVERAGE_CLAUSES.specMakerRoute,
      'Apply the risk-first route before GATE-SCOPE and stop only for direct work.', ['spec-maker-authority']],
    ['static-proves-live', 'skill', ADAPTIVE_COVERAGE_CLAUSES.liveLimit,
      'Source/static checks prove live-model adherence.', ['proof-lifecycle']]
  ];
  assert.equal(adaptiveMutations.length, 23, 'installed adaptive mutation set must match canonical source');

  const adaptiveTarget = (source) => {
    if (source === 'specMaker') {
      const target = assertInstalledSpecMakerMutationTarget(root);
      const bytes = fs.readFileSync(target);
      const content = bytes.toString('utf8');
      return {
        target,
        bytes,
        content: parseGeneratedTomlString(content, 'developer_instructions'),
        render: (value) => replaceGeneratedTomlString(content, 'developer_instructions', value)
      };
    }
    const relative = {
      skill: 'SKILL.md',
      templates: 'references/templates.md',
      review: 'references/review.md'
    }[source];
    assert.ok(relative, `unknown adaptive mutation source: ${source}`);
    const target = assertInstalledMutationTarget(root, installedRoot, relative);
    const bytes = fs.readFileSync(target);
    return { target, bytes, content: bytes.toString('utf8'), render: (value) => value };
  };

  for (const [name, source, from, to, expected] of adaptiveMutations) {
    const targetState = adaptiveTarget(source);
    const anchorIndex = targetState.content.indexOf(from);
    assert.ok(anchorIndex >= 0, `${name} mutation anchor must exist in installed bytes`);
    assert.equal(
      targetState.content.indexOf(from, anchorIndex + from.length),
      -1,
      `${name} mutation anchor must be unique in installed bytes`
    );
    const weakened = `${targetState.content.slice(0, anchorIndex)}${to}${targetState.content.slice(anchorIndex + from.length)}`;
    try {
      fs.writeFileSync(adaptiveTarget(source).target, targetState.render(weakened));
      assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
      assert.deepEqual(installedAdaptiveCoverageIssues(root, installedRoot), [...expected].sort(), name);
    } finally {
      fs.writeFileSync(adaptiveTarget(source).target, targetState.bytes);
    }
    assert.deepEqual(fs.readFileSync(adaptiveTarget(source).target), targetState.bytes, `${name} byte restore`);
    assert.deepEqual(installedAdaptiveCoverageIssues(root, installedRoot), [], `${name} restore`);
    assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
  }

  const intactAdaptive = readInstalledAuthoringProjection(root, installedRoot);
  const adaptivePositiveControls = [
    ['open material surface', intactAdaptive.templates.replace(
      integrationLine,
      `${integrationLine}\n| other:domain-specific | task-specific material choices and observable oracle |`
    )],
    ['task CP reference requirement', intactAdaptive.templates.replace(
      ADAPTIVE_COVERAGE_CLAUSES.scopedUnion,
      `${ADAPTIVE_COVERAGE_CLAUSES.scopedUnion} Require every task to reference a CP row.`
    )]
  ];
  for (const [name, templates] of adaptivePositiveControls) {
    assert.notEqual(templates, intactAdaptive.templates, `${name} positive control must change installed templates`);
    const target = assertInstalledMutationTarget(root, installedRoot, 'references/templates.md');
    const original = fs.readFileSync(target);
    try {
      fs.writeFileSync(target, templates);
      assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
      assert.deepEqual(installedAdaptiveCoverageIssues(root, installedRoot), [], name);
    } finally {
      fs.writeFileSync(assertInstalledMutationTarget(root, installedRoot, 'references/templates.md'), original);
    }
    assert.deepEqual(fs.readFileSync(target), original, `${name} byte restore`);
    assert.deepEqual(installedAdaptiveCoverageIssues(root, installedRoot), [], `${name} restore`);
    assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
  }

  const mutations = [
    ['skill', (value) => value.replace('Task files are flat beside `plan.md`', 'Task files may be nested')],
    ['review', (value) => value.replace('list at 15', 'list without a cap')],
    ['templates', (value) => value.replace('Verification: PASS', 'Verification: UNKNOWN')],
    ['codex', (value) => `${value}\nUse TaskUpdate for state changes.`]
  ];
  for (const [key, mutate] of mutations) {
    const changed = { ...files, [key]: mutate(files[key]) };
    assert.notDeepEqual(authoringProjectionIssues(changed), []);
  }
  assert.equal(
    fs.readFileSync(installedSpecMakerPath, 'utf8'),
    convertCodexAgentContent(sourceSpecMaker, path.basename(SPEC_MAKER_SOURCE_PATH)),
    'Codex spec_maker projection must be byte-exact after mutation restores'
  );
  assertCanonicalSpecsSourceBytesUnchanged(sourceBytes);
}

test('Codex payload transform emits native skill and subagent syntax', () => {
  const transformed = normalizeCodexBody(
    'Agent(subagent_type="implementer", prompt="Implement it", description="Code Feature")\n' +
    'Use `/specs auth`, `SendMessage`, `Bash`, `Read`, and `Edit`.'
  );

  assert.match(
    transformed,
    /spawn_agent\(agent_type="implementer", fork_turns="none", message="Implement it", task_name="code_feature"\)/
  );
  assert.match(transformed, /\$cf-specs auth/);
  assert.match(transformed, /`send_message`/);
  assert.match(transformed, /`exec_command`/);
  assert.match(transformed, /`apply_patch`/);
  assert.doesNotMatch(transformed, /Agent\(|subagent_type|\/specs\b|Claude Code/);
});

test('Codex payload transform keeps structured user-input grammar across determiners', () => {
  const cases = [
    ['standalone bare token', 'AskUserQuestion', 'a structured user-input request'],
    ['standalone code token', '`AskUserQuestion`', 'a structured user-input request'],
    ['standalone multi-backtick token', '``AskUserQuestion``', 'a structured user-input request'],
    ['standalone padded multi-backtick token', '`` AskUserQuestion ``', 'a structured user-input request'],
    ['one', 'one AskUserQuestion call', 'one structured user-input request call'],
    ['one multi-backtick', 'one ``AskUserQuestion`` call', 'one structured user-input request call'],
    ['one padded multi-backtick', 'one `` AskUserQuestion `` call', 'one structured user-input request call'],
    ['each', 'each AskUserQuestion call', 'each structured user-input request call'],
    ['every', 'every AskUserQuestion batch', 'every structured user-input request batch'],
    ['another', 'another AskUserQuestion call', 'another structured user-input request call'],
    ['this', 'this AskUserQuestion call', 'this structured user-input request call'],
    ['that', 'that AskUserQuestion call', 'that structured user-input request call'],
    ['a', 'a AskUserQuestion call', 'a structured user-input request call'],
    ['an', 'an AskUserQuestion call', 'a structured user-input request call'],
    ['capitalized each', 'Each AskUserQuestion call', 'Each structured user-input request call'],
    ['capitalized an', 'An AskUserQuestion call', 'A structured user-input request call'],
    ['the', 'the AskUserQuestion call', 'the structured user-input request call'],
    ['numeric', '27 AskUserQuestion calls', '27 structured user-input request calls'],
    ['plural calls', 'AskUserQuestion calls', 'structured user-input request calls'],
    ['plural batches', 'AskUserQuestion batches', 'structured user-input request batches']
  ];

  for (const [name, input, expected] of cases) {
    const actual = normalizeCodexBody(input, '/fixture/instructions.md');
    assert.equal(actual, expected, name);
    assert.equal(normalizeCodexBody(actual, '/fixture/instructions.md'), expected, `${name} idempotence`);
    assert.doesNotMatch(actual, /\bAskUserQuestion\b/, `${name} Claude-only token`);
    assert.doesNotMatch(actual, /\ban structured user-input request\b/i, `${name} incompatible article`);
    assert.doesNotMatch(
      actual,
      /\b(?:a|an|one|each|every|another|this|that|the|[0-9]+)\s+a structured user-input request\b/i,
      `${name} doubled article`
    );
  }

  assert.equal(
    normalizeCodexBody('one\nAskUserQuestion call', '/fixture/instructions.md'),
    'one\nstructured user-input request call',
    'a single Markdown soft break must preserve its determiner relationship'
  );
  assert.equal(
    normalizeCodexBody('AskUserQuestion\nCalls', '/fixture/instructions.md'),
    'structured user-input request\nCalls',
    'a single Markdown soft break must preserve a plural relationship'
  );
  assert.equal(
    normalizeCodexBody('one\n\nAskUserQuestion call', '/fixture/instructions.md'),
    'one\n\na structured user-input request call',
    'a paragraph break must not bind a prior determiner'
  );
  assert.equal(
    normalizeCodexBody('MyAskUserQuestionHelper AskUserQuestionFactory', '/fixture/instructions.md'),
    'MyAskUserQuestionHelper AskUserQuestionFactory',
    'balanced token matching must preserve identifiers'
  );
  assert.equal(
    normalizeCodexBody('[tool](https://example.test/AskUserQuestion)', '/fixture/instructions.md'),
    '[tool](https://example.test/AskUserQuestion)',
    'Markdown link destinations must stay byte-exact'
  );
  assert.equal(
    normalizeCodexBody('https://example.test/AskUserQuestion', '/fixture/instructions.md'),
    'https://example.test/AskUserQuestion',
    'raw URL tokens must stay byte-exact'
  );
  assert.equal(
    normalizeCodexBody('one ``AskUserQuestion``` call', '/fixture/instructions.md'),
    'one ``AskUserQuestion``` call',
    'mismatched backtick runs must stay byte-exact'
  );
  assert.equal(
    normalizeCodexBody('``Use AskUserQuestion here``', '/fixture/instructions.md'),
    '``Use AskUserQuestion here``',
    'non-token code spans must stay byte-exact'
  );
  assert.equal(
    normalizeCodexBody('```js\nAskUserQuestion\n````', '/fixture/instructions.md'),
    '```js\nAskUserQuestion\n````',
    'a longer closing backtick fence must protect its body'
  );
  assert.equal(
    normalizeCodexBody('~~~text\nAskUserQuestion\n~~~~', '/fixture/instructions.md'),
    '~~~text\nAskUserQuestion\n~~~~',
    'a longer closing tilde fence must protect its body'
  );
  const markerCollision = '\uE000CAFEKIT_0_ASK_999\uE001';
  assert.equal(
    normalizeCodexBody(markerCollision, '/fixture/instructions.md'),
    markerCollision,
    'literal internal-marker-shaped input must stay byte-exact'
  );
  const codeMarkerCollision = '\uE000CAFEKIT_0_CODE_0\uE001 and ``not token``';
  assert.equal(
    normalizeCodexBody(codeMarkerCollision, '/fixture/instructions.md'),
    codeMarkerCollision,
    'mask restoration must not replace a literal marker-shaped prefix'
  );
  assert.equal(
    normalizeCodexBody('one AskUserQuestion call', '/fixture/session.cjs'),
    'one AskUserQuestion call',
    'non-instruction assets must preserve executable text'
  );
  assert.equal(
    normalizeCodexBody('No structured input token here.', '/fixture/instructions.md'),
    'No structured input token here.',
    'token-free instruction text must stay byte-exact'
  );
});

test('Codex structured-input corpus oracle stays differential and production-aware', () => {
  const sourceRoot = path.join(PACKAGE_ROOT, 'src/claude');
  const occurrenceFiles = allFiles(sourceRoot, (file) => /\.(?:md|mdx|txt|cjs|js)$/i.test(file))
    .filter((file) => fs.readFileSync(file, 'utf8').includes('AskUserQuestion'));
  const relative = (file) => path.relative(PACKAGE_ROOT, file).split(path.sep).join('/');
  const actualPaths = occurrenceFiles.map(relative).sort();
  const expectedPaths = [
    'src/claude/agents/spec-maker.md',
    'src/claude/hooks/session.cjs',
    'src/claude/skills/git/SKILL.md',
    'src/claude/skills/inspect/SKILL.md'
  ];
  assert.deepEqual(actualPaths, expectedPaths, 'every source occurrence needs an explicit projection oracle');

  const instructionExpectedSnippets = new Map([
    ['src/claude/skills/git/SKILL.md', 'Present options via a structured user-input request — header'],
    ['src/claude/skills/inspect/SKILL.md', '**Fallback to a structured user-input request:**']
  ]);
  for (const [relativePath, expectedSnippet] of instructionExpectedSnippets) {
    const sourcePath = path.join(PACKAGE_ROOT, relativePath);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const sentinel = '__CAFEKIT_STRUCTURED_INPUT_SENTINEL__';
    const withSentinel = source.replace(/`?\bAskUserQuestion\b`?/g, sentinel);
    assert.notEqual(withSentinel, source, `${relativePath} differential control must replace a token`);
    const expected = normalizeCodexBody(withSentinel, sourcePath)
      .replaceAll(sentinel, 'a structured user-input request');
    const actual = normalizeCodexBody(source, sourcePath);
    assert.equal(actual, expected, `${relativePath} independent differential oracle`);
    assert.match(actual, new RegExp(expectedSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const specMaker = fs.readFileSync(SPEC_MAKER_SOURCE_PATH, 'utf8');
  const convertedAgent = convertCodexAgentContent(specMaker, path.basename(SPEC_MAKER_SOURCE_PATH));
  assert.doesNotMatch(convertedAgent, /\bAskUserQuestion\b/);
  assert.doesNotMatch(convertedAgent, /structured user-input request/);

  const sessionPath = path.join(PACKAGE_ROOT, 'src/claude/hooks/session.cjs');
  const session = normalizeCodexBody(fs.readFileSync(sessionPath, 'utf8'), sessionPath);
  assert.equal((session.match(/\bAskUserQuestion\b/g) || []).length, 2);
});

test('Codex payload transform preserves executable keyword arguments', () => {
  const transformed = normalizeCodexBody(
    'parser = ArgumentParser(description="Analyze it")\n' +
    'result = client.generate(prompt=prompt)\n' +
    'skills = ".claude/skills"\n',
    '/fixture/tool.py'
  );

  assert.match(transformed, /description="Analyze it"/);
  assert.match(transformed, /prompt=prompt/);
  assert.match(transformed, /skills = "\.agents\/skills"/);
  assert.doesNotMatch(transformed, /task_name=|message=prompt/);
});

test('Codex managed AGENTS block preserves malformed marker topologies', () => {
  const malformed = [
    'user before\n<!-- CAFEKIT CODEX START -->\nuser tail\n',
    'user before\n<!-- CAFEKIT CODEX END -->\nuser tail\n',
    '<!-- CAFEKIT CODEX END -->\nuser\n<!-- CAFEKIT CODEX START -->\n',
    '<!-- CAFEKIT CODEX START -->\na\n<!-- CAFEKIT CODEX START -->\nb\n<!-- CAFEKIT CODEX END -->\n',
    '<!-- CAFEKIT CODEX START -->\na\n<!-- CAFEKIT CODEX END -->\nb\n<!-- CAFEKIT CODEX END -->\n'
  ];
  for (const content of malformed) {
    assert.equal(upsertManagedCodexBlock(content, 'replacement'), content);
    assert.equal(transformManagedCodexContent(content, () => 'replacement'), content);
  }
});

test('platform resolver keeps saved runtimes and newly detected Codex', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-detect-'));
  const originalCwd = process.cwd();
  try {
    for (const folder of ['.claude', '.codex']) {
      fs.mkdirSync(path.join(root, folder), { recursive: true });
    }
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );
    process.chdir(root);
    const ctx = {
      options: { platforms: [], forceOverwrite: false },
      interactive: false,
      dryRun: false,
      ui: { info() {} },
      t: (key) => key
    };
    await resolvePlatforms(ctx);
    assert.deepEqual(ctx.platforms, ['claude', 'codex']);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('explicit Codex install restores the Codex locale first', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-locale-'));
  const originalCwd = process.cwd();
  try {
    for (const [folder, responseLanguage] of [
      ['.claude', '日本語'],
      ['.codex', 'Tiếng Việt']
    ]) {
      fs.mkdirSync(path.join(root, folder), { recursive: true });
      fs.writeFileSync(
        path.join(root, folder, 'runtime.json'),
        `${JSON.stringify({ locale: { responseLanguage } })}\n`
      );
    }
    process.chdir(root);
    const ctx = {
      options: { platforms: ['codex'] },
      interactive: false,
      lang: 'en',
      setLang(code, locale) {
        this.lang = code;
        this.locale = locale;
      },
      ui: { info() {} },
      t: (key) => key
    };
    await selectLanguage(ctx);
    assert.equal(ctx.locale, 'Tiếng Việt');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('same-version install can add Codex beside an existing runtime', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-version-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );
    process.chdir(root);
    const ctx = {
      platforms: ['claude', 'codex'],
      dryRun: false,
      interactive: false,
      options: { forceOverwrite: false },
      ui: { info() {}, warn() {} }
    };
    await checkVersions(ctx);
    assert.notEqual(ctx.cancelled, true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolvePlatforms interactive prompts to add more platforms when prior install exists', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-add-platforms-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );
    process.chdir(root);
    const ctx = {
      options: { platforms: [], forceOverwrite: false },
      interactive: true,
      dryRun: false,
      ui: {
        info() {},
        confirm: async ({ message }) => {
          if (message.includes('Existing platforms') || message.includes('addPlatformsPrompt')) return true;
          if (message.includes('confirmAllDetected') || message.includes('existing configs')) return true;
          return true;
        },
        select: async ({ message, options }) => {
          if (message.includes('selectPlatform') || message.includes('Select platform')) {
            return ['codex'];
          }
          return options[0].value;
        },
        isCancel: () => false
      },
      t: (key, vars) => {
        const tpl = (MESSAGES.en && MESSAGES.en[key]) || key;
        if (vars) return tpl.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{${name}}`));
        return tpl;
      }
    };
    await resolvePlatforms(ctx);
    assert.deepEqual(ctx.platforms.sort(), ['claude', 'codex'].sort());
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolvePlatforms interactive keeps existing platforms when user declines to add more', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-keep-platforms-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );
    process.chdir(root);
    const ctx = {
      options: { platforms: [], forceOverwrite: false },
      interactive: true,
      dryRun: false,
      ui: {
        info() {},
        confirm: async ({ message }) => {
          // Check that the message is properly rendered without {names} placeholder
          // If i18n uses {existing} but ctx passes {names}, the rendered message will contain {existing}
          if (message.includes('Existing platforms') || message.includes('既存プラットフォーム') || message.includes('Nền tảng hiện có')) {
            assert.ok(!message.includes('{'), `Message should not contain unrendered placeholder: ${message}`);
            assert.ok(!message.includes('}'), `Message should not contain unrendered placeholder: ${message}`);
            return false; // decline to add more
          }
          return true; // confirmAllDetected
        },
        select: async () => ['claude'],
        isCancel: () => false
      },
      t: (key, vars) => {
        const tpl = (MESSAGES.en && MESSAGES.en[key]) || key;
        if (vars) return tpl.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{${name}}`));
        return tpl;
      }
    };
    await resolvePlatforms(ctx);
    assert.deepEqual(ctx.platforms, ['claude']);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('addPlatformsPrompt placeholder consistency across all locales', () => {
  const expectedPlaceholders = ['names'];
  const placeholderRegex = /\{(\w+)\}/g;

  for (const [locale, messages] of Object.entries(MESSAGES)) {
    const template = messages.addPlatformsPrompt;
    assert.ok(template, `Missing addPlatformsPrompt key in locale: ${locale}`);

    const placeholders = [];
    let match;
    while ((match = placeholderRegex.exec(template)) !== null) {
      placeholders.push(match[1]);
    }

    assert.deepEqual(
      placeholders,
      expectedPlaceholders,
      `Locale ${locale} addPlatformsPrompt has incorrect placeholders. Template: "${template}". Expected: ${JSON.stringify(expectedPlaceholders)}, Got: ${JSON.stringify(placeholders)}`
    );
  }
});

test('same-version non-interactive install performs a selective refresh', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-version-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.codex', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'codex' })}\n`
    );
    process.chdir(root);
    const messages = [];
    const ctx = {
      platforms: ['codex'],
      dryRun: false,
      interactive: false,
      options: { forceOverwrite: false },
      ui: { info(message) { messages.push(message); }, warn() {} },
      t: (key) => key
    };
    await checkVersions(ctx);
    assert.notEqual(ctx.cancelled, true);
    assert.equal(ctx.options.forceOverwrite, false);
    assert.deepEqual(messages, ['versionRefreshing']);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('same-version interactive refresh does not enable force overwrite', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-version-'));
  const originalCwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.codex', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'codex' })}\n`
    );
    process.chdir(root);
    const ctx = {
      platforms: ['codex'],
      dryRun: false,
      interactive: true,
      options: { forceOverwrite: false },
      ui: {
        info() {},
        warn() {},
        select: async () => 'refresh',
        isCancel: () => false
      },
      t: (key) => key
    };
    await checkVersions(ctx);
    assert.notEqual(ctx.cancelled, true);
    assert.equal(ctx.options.forceOverwrite, false);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('mixed runtime versions update the stale Codex install', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-codex-version-'));
  const originalCwd = process.cwd();
  try {
    for (const [folder, platform, version] of [
      ['.claude', 'claude', PACKAGE_VERSION],
      ['.codex', 'codex', '0.14.1']
    ]) {
      fs.mkdirSync(path.join(root, folder), { recursive: true });
      fs.writeFileSync(
        path.join(root, folder, 'cafekit.json'),
        `${JSON.stringify({ version, platform })}\n`
      );
    }
    process.chdir(root);
    const ctx = {
      platforms: ['claude', 'codex'],
      dryRun: false,
      interactive: false,
      options: { forceOverwrite: false },
      ui: { info() {}, warn() {} }
    };
    await checkVersions(ctx);
    assert.notEqual(ctx.cancelled, true);
    assert.equal(ctx.isUpdate, true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Codex ownership rejects files outside its split managed roots', () => {
  inTempProject((root) => {
    const originalCwd = process.cwd();
    process.chdir(root);
    try {
      const tracker = createTracker('.codex', PACKAGE_VERSION, {
        recordRoot: '.',
        allowedRoots: ['.codex', '.agents']
      });
      assert.throws(() => tracker.keyFor('AGENTS.md'), /outside allowed roots/);
      assert.equal(tracker.keyFor('.agents/skills/specs/SKILL.md'), '.agents/skills/specs/SKILL.md');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

test('Codex dry-run leaves both managed roots untouched', () => {
  inTempProject((root) => {
    const result = install(root, ['--dry-run']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.existsSync(path.join(root, '.codex')), false);
    assert.equal(fs.existsSync(path.join(root, '.agents')), false);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.equal(fs.existsSync(path.join(root, '.gitignore')), false);
  });
});

test('Codex install preserves the adaptive diagnostic-only Debug contract', () => {
  inTempProject((root) => {
    const result = install(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installedSkill = fs.readFileSync(
      path.join(root, '.agents/skills/debug/SKILL.md'), 'utf8'
    );
    assert.match(installedSkill, /^name: cf-debug$/m);
    assert.match(installedSkill, /## Proportional depth/);
    assert.match(installedSkill, /Evidence Timeline/);
    assert.match(installedSkill, /### Elimination Path/);
    assert.match(installedSkill, /### Recurrence-Prevention Handoff/);
    assert.match(installedSkill, /`cf-debug` is read-only for product code/);

    const installedAgent = fs.readFileSync(
      path.join(root, '.codex/agents/debugger.toml'), 'utf8'
    );
    assert.equal(
      installedAgent,
      convertCodexAgentContent(fs.readFileSync(DEBUG_AGENT_SOURCE_PATH, 'utf8'), 'debugger.md')
    );
    assert.match(installedAgent, /Never implement the repair/);

    for (const relative of DEBUG_REFERENCE_FILES) {
      const source = fs.readFileSync(
        path.join(PACKAGE_ROOT, 'src/claude/references/debugger', relative), 'utf8'
      );
      const installed = fs.readFileSync(
        path.join(root, '.codex/references/debugger', relative), 'utf8'
      );
      assert.equal(installed, normalizeCodexBody(source, relative), relative);
    }
    assert.equal(fs.existsSync(DEBUG_SKILL_SOURCE_PATH), true);
  });
});

test('Codex Windows hook launchers stay project-bound without Git from nested cwd', () => {
  inTempProject((root) => {
    const projectRoot = path.join(root, 'project with spaces');
    fs.mkdirSync(projectRoot, { recursive: true });
    const installed = install(projectRoot);
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);

    const config = JSON.parse(
      fs.readFileSync(path.join(projectRoot, '.codex', 'hooks.json'), 'utf8')
    );
    const launchers = allHookLaunchers(config);
    assert.ok(launchers.length > 0, 'installed Codex config must register hook launchers');
    const semanticReviewEvents = [];
    for (const { event, handler } of launchers) {
      assert.doesNotMatch(handler.commandWindows, /\$\(/);
      assert.doesNotMatch(handler.commandWindows, /\bgit\b/i);
      assert.doesNotMatch(handler.commandWindows, /process\.cwd\(\)|existsSync/);
      const encodedPath = handler.commandWindows.match(/\s([A-Za-z0-9_-]+)$/)?.[1];
      assert.ok(encodedPath, `missing encoded hook path in: ${handler.commandWindows}`);
      const target = Buffer.from(encodedPath, 'base64url').toString('utf8');
      assert.equal(path.dirname(target), fs.realpathSync(path.join(projectRoot, '.codex', 'hooks')));
      assert.equal(
        fs.existsSync(target),
        true,
        `missing installed hook: ${path.basename(target)}`
      );
      if (path.basename(target) === 'semantic-review-authority.cjs') {
        semanticReviewEvents.push(event);
      }
    }
    assert.deepEqual(semanticReviewEvents, ['SubagentStop']);

    const nested = path.join(projectRoot, 'nested', 'workspace');
    fs.mkdirSync(nested, { recursive: true });
    const shadowHooks = path.join(projectRoot, 'nested', '.codex', 'hooks');
    const shadowMarker = path.join(root, 'shadow-hook-ran');
    fs.mkdirSync(shadowHooks, { recursive: true });
    fs.writeFileSync(
      path.join(shadowHooks, 'session.cjs'),
      `require('node:fs').writeFileSync(${JSON.stringify(shadowMarker)}, 'unsafe')\n`
    );
    const session = config.hooks.SessionStart[0].hooks[0];
    const nodeCommand = session.commandWindows.replace(/^node /, `"${process.execPath}" `);
    const noGitEnv = { ...process.env, PATH: '' };
    const launched = spawnSync(nodeCommand, {
      cwd: nested,
      encoding: 'utf8',
      input: JSON.stringify({
        session_id: 'windows-launcher-test',
        cwd: nested,
        hook_event_name: 'SessionStart',
        source: 'startup'
      }),
      env: noGitEnv,
      shell: true
    });
    assert.equal(launched.status, 0, launched.stderr);
    assert.match(launched.stdout, /Session startup\./);
    assert.match(launched.stdout, /CafeKit project root:/);
    assert.equal(fs.existsSync(shadowMarker), false);
    assert.match(session.commandWindows, /require\('module'\)\.runMain\(\)/, 'Windows launcher must execute hook main');
  });
});

// Run an installed POSIX launcher verbatim under the environment a macOS GUI host hands
// its children: no `git`, and no `node` on PATH. Nothing here rewrites the command, so a
// launcher that cannot find its own interpreter fails the way it fails in the wild.
const GUI_PATH = '/usr/bin:/bin:/usr/sbin:/sbin';

function runPosixLauncher(command, cwd, pathValue = GUI_PATH) {
  return spawnSync(command, {
    cwd,
    encoding: 'utf8',
    input: JSON.stringify({
      session_id: 'posix-launcher-test',
      cwd,
      hook_event_name: 'SessionStart',
      source: 'startup'
    }),
    env: { PATH: pathValue, HOME: os.homedir() },
    shell: true
  });
}

function sessionLauncher(projectRoot) {
  const config = JSON.parse(
    fs.readFileSync(path.join(projectRoot, '.codex', 'hooks.json'), 'utf8')
  );
  return { config, command: config.hooks.SessionStart[0].hooks[0].command };
}

test('Codex POSIX hook launchers run without Git and outside the repository root', () => {
  inTempProject((root) => {
    // A launcher that asks Git for its root gets nothing here and the outer root one
    // directory down, and in both cases points at a path that does not exist.
    const plain = path.join(root, 'no-git-project');
    fs.mkdirSync(plain, { recursive: true });
    assert.equal(install(plain).status, 0);

    const repoRoot = path.join(root, 'repo');
    const nested = path.join(repoRoot, 'packages', 'inner');
    fs.mkdirSync(nested, { recursive: true });
    spawnSync('git', ['init', '-q'], { cwd: repoRoot });
    assert.equal(install(nested).status, 0);

    for (const projectRoot of [plain, nested]) {
      const { config, command } = sessionLauncher(projectRoot);
      for (const { handler } of allHookLaunchers(config)) {
        // A PATH floor, then `node`, then one single-quoted absolute path. Inside single
        // quotes the shell expands nothing, so a project path may safely contain $, a
        // backtick, or the word git — this fixture's own path contains it.
        assert.match(
          handler.command,
          /^PATH="\$PATH"(?::'(?:[^']|'\\'')+')+ node '(?:[^']|'\\'')+'$/,
          `launcher must carry a PATH floor and a quoted path: ${handler.command}`
        );
        assert.doesNotMatch(handler.command, /rev-parse/, `launcher must not consult Git: ${handler.command}`);
        assert.ok(
          handler.command.includes(path.join(projectRoot, '.codex', 'hooks')),
          `launcher must name this project's hooks directory: ${handler.command}`
        );
      }
      const launched = runPosixLauncher(command, projectRoot);
      assert.equal(launched.status, 0, launched.stderr);
      assert.match(launched.stdout, /Session startup\./);
    }
  });
});

// A reinstall treats an already-registered script as the user's placement, so a launcher
// an older installer wrote would otherwise keep its broken command forever.
for (const [label, legacyCommand] of [
  ['resolved their path through Git', (script) => `node "$(git rev-parse --show-toplevel)/.codex/hooks/${script}"`],
  ['looked for node on PATH', (script, root) => `node '${path.join(fs.realpathSync(root), '.codex', 'hooks', script)}'`],
]) {
  test(`a reinstall rebinds Codex launchers that ${label}`, () => {
    inTempProject((root) => {
      assert.equal(install(root).status, 0);
      const configPath = path.join(root, '.codex', 'hooks.json');

      const downgraded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      for (const { handler } of allHookLaunchers(downgraded)) {
        handler.command = legacyCommand(path.basename(handler.command.replace(/'$/, '')), root);
      }
      // A hook the user wrote, in the same shape CafeKit used to emit, must never be
      // rewritten: it points somewhere else entirely.
      const foreign = { type: 'command', command: 'node "$(git rev-parse --show-toplevel)/tools/mine.cjs"' };
      downgraded.hooks.SessionStart[0].hooks.push(foreign);
      fs.writeFileSync(configPath, `${JSON.stringify(downgraded, null, 2)}\n`);

      const again = install(root);
      assert.equal(again.status, 0, again.stderr);
      assert.match(again.stdout, /rebound \d+ launcher/, 'the rebind must be reported, not silent');

      const { config, command } = sessionLauncher(root);
      const commands = allHookLaunchers(config).map(({ handler }) => handler.command);
      assert.ok(commands.includes(foreign.command), 'a foreign hook must survive untouched');
      assert.equal(
        commands.filter((entry) => !entry.startsWith('PATH=')).length,
        1,
        'every CafeKit launcher must be rebound, leaving only the foreign one'
      );
      const launched = runPosixLauncher(command, root);
      assert.equal(launched.status, 0, launched.stderr);
      assert.match(launched.stdout, /Session startup\./);

      // Running the installer again must change nothing.
      const third = install(root);
      assert.doesNotMatch(third.stdout, /rebound \d+ launcher/, 'rebinding must be idempotent');
    });
  });
}

test('Codex installed Specs and spec-maker reject adaptive coverage mutations', () => {
  inTempProject((root) => {
    const userInstructions = '# User rules\n\nKeep this exact.\n';
    fs.writeFileSync(path.join(root, 'AGENTS.md'), userInstructions);

    const first = install(root, ['--with-document-skills']);
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    assert.equal(fs.existsSync(path.join(root, '.claude')), false);
    assert.equal(fs.existsSync(path.join(root, '.codex', 'config.toml')), false);

    for (const relative of [
      '.codex/hooks.json',
      '.codex/runtime.json',
      '.codex/hooks/privacy-block.cjs',
      '.codex/rules/workflow.md',
      '.codex/rules/hook-protocols.md',
      '.codex/rules/state-sync.md',
      '.codex/rules/review-audit-self-decision.md',
      '.codex/rules/process-management.md',
      '.codex/scripts/spec-ground.cjs',
      '.codex/scripts/validate-spec-output.cjs',
      '.agents/.gitignore',
      ...V3_SPECS_BUNDLE.map((file) => `.agents/skills/specs/${file}`)
    ]) {
      assert.equal(fs.existsSync(path.join(root, relative)), true, `missing ${relative}`);
    }

    const installedDesign = fs.readFileSync(
      path.join(root, '.agents/skills/specs/templates/design.md'), 'utf8'
    );
    assert.equal((installedDesign.match(/^## Verification Definitions$/gm) || []).length, 1);
    assertInstalledVerificationModel(
      path.join(root, '.codex/scripts/spec-ground.cjs'),
      installedDesign
    );
    const installedSpecsRoot = path.join(root, '.agents/skills/specs');
    assert.throws(
      () => installedAuthoringProjectionIssues(root, '.agents/skills/specs'),
      /must be absolute/
    );
    assert.throws(
      () => installedAuthoringProjectionIssues(root, SPECS_SOURCE_ROOT),
      /must stay inside project/
    );
    assert.throws(
      () => installedAuthoringProjectionIssues(root, path.dirname(root)),
      /must stay inside project/
    );
    assertInstalledAuthoringProjection(root, installedSpecsRoot);

    const installedTask = fs.readFileSync(
      path.join(root, '.agents/skills/specs/templates/task.md'), 'utf8'
    );
    assert.deepEqual(
      [...installedTask.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
      ['Outcome', 'Scope', 'Anchors and Ownership', 'Changes', 'Acceptance', 'Dependencies', 'Verification Plan']
    );
    assert.match(installedTask, /^- \*\*Task role:\*\*/m);

    const installedState = JSON.parse(fs.readFileSync(
      path.join(root, '.agents/skills/specs/templates/spec-state.json'), 'utf8'
    ));
    assert.deepEqual(Object.keys(installedState.workflow_policy).sort(), [
      'assurance_level', 'classified_minimum', 'planning_depth', 'risks', 'version'
    ]);

    const agentsGitignore = fs.readFileSync(
      path.join(root, '.agents', '.gitignore'),
      'utf8'
    );
    assert.match(agentsGitignore, /skills\/\*\*\/\.venv\//);
    assert.match(agentsGitignore, /skills\/\*\*\/node_modules\//);
    assert.match(agentsGitignore, /!skills\/\*\*\/\.env\.example/);

    if (process.platform !== 'win32') {
      for (const [sourceRelative, installedRelative] of [
        ['src/claude/scripts/validate-spec-output.cjs', '.codex/scripts/validate-spec-output.cjs'],
        ['src/claude/skills/chrome-devtools/scripts/install.sh', '.agents/skills/chrome-devtools/scripts/install.sh'],
        ['src/claude/skills/ai-multimodal/scripts/check_setup.py', '.agents/skills/ai-multimodal/scripts/check_setup.py']
      ]) {
        const sourceMode = fs.statSync(path.join(PACKAGE_ROOT, sourceRelative)).mode & 0o111;
        const installedMode = fs.statSync(path.join(root, installedRelative)).mode & 0o111;
        assert.notEqual(sourceMode, 0, `fixture should be executable: ${sourceRelative}`);
        assert.equal(installedMode, sourceMode, `execute bits differ: ${installedRelative}`);
      }
    }

    for (const fileName of MANIFEST.agents.required) {
      const name = path.basename(fileName, '.md').replace(/-/g, '_');
      const agentPath = path.join(root, '.codex', 'agents', `${name}.toml`);
      const content = fs.readFileSync(agentPath, 'utf8');
      const sourcePath = path.join(PACKAGE_ROOT, 'src', 'claude', 'agents', fileName);
      assert.equal(
        content,
        convertCodexAgentContent(fs.readFileSync(sourcePath, 'utf8'), fileName),
        `Codex agent projection drifted: ${fileName}`
      );
      assert.equal(parseGeneratedTomlString(content, 'name'), name);
      assert.ok(parseGeneratedTomlString(content, 'description').length > 8);
      assert.ok(parseGeneratedTomlString(content, 'developer_instructions').length > 20);
    }

    const skillFiles = allFiles(
      path.join(root, '.agents', 'skills'),
      (file) => path.basename(file) === 'SKILL.md'
    );
    const skillNames = skillFiles.map((file) => {
      const match = fs.readFileSync(file, 'utf8').match(/^name:\s*(.+)$/m);
      assert.ok(match, `missing skill name in ${file}`);
      return match[1].trim();
    });
    assert.ok(skillNames.length >= 20);
    assert.equal(new Set(skillNames).size, skillNames.length);
    assert.ok(skillNames.every((name) => /^[a-z0-9-]+$/.test(name)));

    const scoutSkill = fs.readFileSync(
      path.join(root, '.agents', 'skills', 'inspect', 'SKILL.md'),
      'utf8'
    );
    assert.match(scoutSkill, /^name:\s*cf-scout$/m);
    assert.equal(
      fs.existsSync(path.join(root, '.agents', 'skills', 'scout')),
      false,
      'public Scout rename must keep the manifest-owned inspect directory'
    );
    const askSkill = fs.readFileSync(
      path.join(root, '.agents', 'skills', 'question', 'SKILL.md'),
      'utf8'
    );
    assert.match(askSkill, /^name:\s*cf-ask$/m);
    assert.equal(
      fs.existsSync(path.join(root, '.agents', 'skills', 'ask')),
      false,
      'public Ask rename must keep the manifest-owned question directory'
    );

    const catalog = spawnSync(
      process.execPath,
      [path.join(root, '.codex', 'scripts', 'generate-skill-catalog.cjs'), '--json'],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(catalog.status, 0, catalog.stderr);
    const catalogData = JSON.parse(catalog.stdout);
    assert.equal(catalogData.total, skillNames.length);
    assert.equal(
      catalogData.root,
      fs.realpathSync(path.join(root, '.agents', 'skills'))
    );

    for (const retired of MANIFEST.obsolete.skills) {
      assert.equal(
        fs.existsSync(path.join(root, '.agents', 'skills', retired)),
        false,
        `retired skill should not be installed: ${retired}`
      );
    }

    const multimodalScript = fs.readFileSync(
      path.join(root, '.agents', 'skills', 'ai-multimodal', 'scripts', 'gemini_batch_process.py'),
      'utf8'
    );
    assert.match(multimodalScript, /prompt=prompt/);
    assert.doesNotMatch(multimodalScript, /message=prompt/);

    const modelVisibleFiles = [
      path.join(root, 'AGENTS.md'),
      ...allFiles(path.join(root, '.codex', 'agents'), (file) => file.endsWith('.toml')),
      ...allFiles(path.join(root, '.codex', 'rules'), (file) => file.endsWith('.md')),
      ...allFiles(path.join(root, '.agents', 'skills'), (file) => file.endsWith('.md'))
    ];
    const visible = modelVisibleFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    const foreignRuntimeBoundary = 'If you are Claude Code or any other runtime, ignore this entire Codex block';
    assert.match(visible, new RegExp(foreignRuntimeBoundary));
    assert.doesNotMatch(visible, /If you are Codex CLI or any other runtime, ignore this entire Codex block/);
    assert.doesNotMatch(
      visible.replaceAll(foreignRuntimeBoundary, ''),
      /\bAgent\(|subagent_type|`Agent`|\bSendMessage\b|\/cf:|\bcf:|Claude Code/,
    );
    assert.doesNotMatch(visible, /@@PRIVACY_PROMPT_START@@|Claude Tasks/);
    assert.match(visible, /\$cf-specs/);

    const agentsMd = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    assert.ok(agentsMd.startsWith(userInstructions));
    assert.equal((agentsMd.match(/<!-- CAFEKIT CODEX START -->/g) || []).length, 1);
    assert.match(agentsMd, /fork_turns: "none"/);
    assert.match(agentsMd, /repository is trusted/);

    const ownership = JSON.parse(
      fs.readFileSync(path.join(root, '.codex', 'cafekit-manifest.json'), 'utf8')
    );
    assert.ok(Object.keys(ownership.files).every((key) => (
      (key.startsWith('.codex/') || key.startsWith('.agents/')) && !key.includes('../')
    )));

    const questionSkill = path.join(root, '.agents', 'skills', 'question', 'SKILL.md');
    fs.appendFileSync(questionSkill, '\nUSER-CODEX-SENTINEL\n');
    // Fresh installs are exact. Refresh/upgrade intentionally documents the
    // current Codex limitation: removed skill paths are not pruned.
    const obsoleteSpecsRule = path.join(
      root, '.agents', 'skills', 'specs', 'rules', 'design-principles.md'
    );
    fs.mkdirSync(path.dirname(obsoleteSpecsRule), { recursive: true });
    fs.writeFileSync(obsoleteSpecsRule, 'LEGACY-CODEX-ORPHAN\n');

    const sameVersion = install(root);
    assert.equal(sameVersion.status, 0, `${sameVersion.stdout}\n${sameVersion.stderr}`);
    assert.deepEqual(installedAuthoringProjectionIssues(root, installedSpecsRoot), []);
    assert.match(fs.readFileSync(questionSkill, 'utf8'), /USER-CODEX-SENTINEL/);
    assert.equal(
      fs.existsSync(obsoleteSpecsRule),
      true,
      'known limitation: Codex refresh does not prune obsolete skill files'
    );

    const metadataPath = path.join(root, '.codex', 'cafekit.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    metadata.version = '0.14.1';
    fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

    const upgrade = install(root);
    assert.equal(upgrade.status, 0, `${upgrade.stdout}\n${upgrade.stderr}`);
    assert.deepEqual(installedAuthoringProjectionIssues(root, installedSpecsRoot), []);
    assert.match(fs.readFileSync(questionSkill, 'utf8'), /USER-CODEX-SENTINEL/);
    assert.equal(
      fs.existsSync(obsoleteSpecsRule),
      true,
      'known limitation: Codex upgrade does not prune obsolete skill files'
    );
    assert.ok(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').startsWith(userInstructions));

    const forced = install(root, ['--force-overwrite']);
    assert.equal(forced.status, 0, `${forced.stdout}\n${forced.stderr}`);
    assert.doesNotMatch(fs.readFileSync(questionSkill, 'utf8'), /USER-CODEX-SENTINEL/);
  });
});

test('Codex installed Brainstorm skill reference and agent preserve proportional routing parity', () => {
  inTempProject((root) => {
    const sourceBytes = canonicalBrainstormSourceBytes();
    const result = install(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installedSkillPath = path.join(root, '.agents/skills/brainstorm/SKILL.md');
    const installedReferencePath = path.join(
      root,
      '.agents/skills/brainstorm/references/question-framework.md'
    );
    const installedAgentPath = path.join(root, '.codex/agents/brainstormer.toml');
    const sourceSkill = fs.readFileSync(BRAINSTORM_SKILL_SOURCE_PATH, 'utf8');
    const sourceReference = fs.readFileSync(BRAINSTORM_REFERENCE_SOURCE_PATH, 'utf8');
    const sourceAgent = fs.readFileSync(BRAINSTORM_AGENT_SOURCE_PATH, 'utf8');

    assert.equal(
      fs.readFileSync(installedSkillPath, 'utf8'),
      normalizeCodexBody(sourceSkill, BRAINSTORM_SKILL_SOURCE_PATH),
      'installed Brainstorm skill must equal the generic Codex projection'
    );
    assert.equal(
      fs.readFileSync(installedReferencePath, 'utf8'),
      normalizeCodexBody(sourceReference, BRAINSTORM_REFERENCE_SOURCE_PATH),
      'installed Brainstorm reference must equal the generic Codex projection'
    );
    assert.equal(
      fs.readFileSync(installedAgentPath, 'utf8'),
      convertCodexAgentContent(sourceAgent, path.basename(BRAINSTORM_AGENT_SOURCE_PATH)),
      'installed brainstormer agent must equal the Codex TOML projection'
    );

    assert.deepEqual(brainstormProjectionIssues(readInstalledBrainstormProjection(root)), []);
    assertCanonicalBrainstormSourceBytesUnchanged(sourceBytes);

    const safelyStrengthened = readInstalledBrainstormProjection(root);
    safelyStrengthened.agent += '\nThe specialist may never ask the user directly or contact the user. Do not write files or mutate shared task state. Do not delegate work or delegate tasks. The specialist is not permitted to launch Specs or run Develop.';
    assert.deepEqual(
      brainstormProjectionIssues(safelyStrengthened),
      [],
      'safe specialist prohibitions must not produce authority issues'
    );

    const mutations = [
      {
        name: 'adaptive-direct-precedence-removed', source: 'skill',
        from: 'Route Direct first, then\napply controls only to requests that remain in Brainstorm.',
        to: 'Apply controls before Direct classification.', expected: ['adaptive-direct-precedence']
      },
      {
        name: 'adaptive-ordered-depth-removed', source: 'skill',
        from: 'With no Deep signal, use Standard.', to: 'Deep is always the default.',
        expected: ['adaptive-ordered-depth']
      },
      {
        name: 'adaptive-leading-flags-removed', source: 'skill',
        from: 'Parse controls only from the leading consecutive token segment.',
        to: 'Parse flag-like tokens anywhere.', expected: ['adaptive-leading-flags']
      },
      {
        name: 'adaptive-failure-isolation-removed', source: 'skill',
        from: 'failure isolation for partial or cascading failure\nacross boundaries',
        to: 'generic failure notes', expected: ['adaptive-lens-trigger-skip']
      },
      {
        name: 'adaptive-evidence-fallback-removed', source: 'skill',
        from: 'Missing evidence\nforces feasibility `unknown` and confidence `low`.',
        to: 'Missing evidence permits a confident guess.', expected: ['adaptive-evidence-semantics']
      },
      {
        name: 'adaptive-numeric-evidence-removed', source: 'skill',
        from: 'A numeric estimate requires\nrange, unit, basis, evidence, and assumptions; otherwise report `unknown`.',
        to: 'A numeric estimate may be a best-effort number.', expected: ['adaptive-numeric-estimates']
      },
      {
        name: 'adaptive-pre-tool-redaction-removed', source: 'skill',
        from: 'Before an\nexternal visual tool or adviser handoff, minimize context and redact secrets,\ncredentials, private keys, access tokens, and unnecessary PII.',
        to: 'Forward full context to every external tool and adviser.', expected: ['adaptive-pre-tool-redaction']
      },
      {
        name: 'adaptive-adviser-gate-removed', source: 'skill',
        from: '`--advice` invokes\n`brainstormer` only after the material-choice gate;',
        to: '`--advice` invokes `brainstormer` before routing;', expected: ['adaptive-adviser-gate']
      },
      {
        name: 'adaptive-decision-freshness-removed', source: 'skill',
        from: 'The first section records target\nidentity, current source revision and worktree state or `[UNVERIFIED]`, an\nevidence-as-of value, and what change invalidates the brief.',
        to: 'The handoff has no revision or freshness binding.', expected: ['adaptive-decision-freshness']
      },
      {
        name: 'adaptive-overlay-authority-removed', source: 'skill',
        from: 'Neither overlay\nwrites, approves, persists, dispatches, or completes work.',
        to: 'Overlays may persist, approve, dispatch, and complete work.', expected: ['adaptive-non-authority']
      },
      {
        name: 'debug-route-removed',
        source: 'skill',
        from: 'Then use `cf-debug` until',
        to: 'Skip diagnosis and choose a remedy before',
        expected: ['bug-routing']
      },
      {
        name: 'fix-authority-removed',
        source: 'skill',
        from: 'only when the user explicitly requested a fix',
        to: 'automatically whenever root cause is known',
        expected: ['bug-routing']
      },
      {
        name: 'exploration-stop-removed',
        source: 'skill',
        from: 'Do not request design approval, persist a report, or\n   invoke another workflow without a new explicit request.',
        to: 'Request approval, persist a report, and invoke another workflow.',
        expected: ['exploration-stop']
      },
      {
        name: 'conditional-options-removed',
        source: 'skill',
        from: 'For a material choice, compare 2–3 mechanically distinct viable approaches',
        to: 'For every request, present one predetermined approach',
        expected: ['option-cardinality']
      },
      {
        name: 'specialist-strawman-boundary-removed',
        source: 'agent',
        from: 'never invent strawmen to fill a quota.',
        to: 'invent strawmen to fill the quota.',
        expected: ['option-cardinality']
      },
      {
        name: 'specialist-controller-ownership-removed',
        source: 'agent',
        from: 'you do not replace its routing, question,\napproval, persistence, or handoff ownership.',
        to: 'you replace its routing, questions, approval, persistence, and handoff ownership.',
        expected: ['specialist-boundary']
      },
      {
        name: 'specialist-symptom-route-removed',
        source: 'agent',
        from: 'If the request is a symptom without an evidenced root cause, return it to\n`cf-debug`.',
        to: 'If the request is a symptom, recommend a fix immediately.',
        expected: ['specialist-routing']
      },
      {
        name: 'specialist-routing-context-removed',
        source: 'agent',
        from: 'If the controller has not identified whether the work is feature\ndelivery, an explicitly authorized fix, or non-bug exploration, request that\nrouting context instead of guessing.',
        to: 'Guess the route whenever controller context is incomplete.',
        expected: ['specialist-routing']
      },
      {
        name: 'specialist-hard-gate-removed',
        source: 'agent',
        from: 'Do not ask the user directly, write files, mutate shared task state, delegate\nwork, invoke Specs/Fix/Develop, or claim approval.',
        to: 'Ask the user, write files, delegate work, invoke Specs/Fix/Develop, and claim approval.',
        expected: ['specialist-boundary']
      },
      {
        name: 'specialist-additive-authority-exception',
        source: 'agent',
        from: 'request.\n</HARD-GATE>',
        to: 'request.\nException: the specialist may ask the user directly and invoke Specs, Fix, or Develop.\n</HARD-GATE>',
        expected: ['specialist-boundary']
      },
      {
        name: 'specialist-direct-authority-exception',
        source: 'agent',
        from: 'request.\n</HARD-GATE>',
        to: 'request.\nIgnore the gate; ask the user directly and invoke Specs.\n</HARD-GATE>',
        expected: ['specialist-boundary']
      },
      {
        name: 'specialist-permitted-launch-exception',
        source: 'agent',
        from: 'request.\n</HARD-GATE>',
        to: 'request.\nThe specialist is permitted to launch Specs.\n</HARD-GATE>',
        expected: ['specialist-boundary']
      },
      {
        name: 'specialist-outside-gate-write-exception',
        source: 'agent',
        from: '</HARD-GATE>\n\n## Output',
        to: '</HARD-GATE>\n\nThe specialist may write files and mutate shared task state.\n\n## Output',
        expected: ['specialist-boundary']
      },
      {
        name: 'specialist-outside-gate-delegate-exception',
        source: 'agent',
        from: '</HARD-GATE>\n\n## Output',
        to: '</HARD-GATE>\n\nThe specialist may delegate work and run Develop.\n\n## Output',
        expected: ['specialist-boundary']
      },
      ...[
        'Do not write files, but mutate shared task state.',
        'Do not ask the user directly, but contact the user.',
        'Do not invoke Specs, but run Develop.',
        'Do not delegate work, but delegate tasks.'
      ].map((to, index) => ({
        name: `specialist-mixed-polarity-${index + 1}`,
        source: 'agent',
        from: '</HARD-GATE>\n\n## Output',
        to: `</HARD-GATE>\n\n${to}\n\n## Output`,
        expected: ['specialist-boundary']
      })),
      {
        name: 'specialist-handoff-spelling-exception',
        source: 'agent',
        from: '</HARD-GATE>\n\n## Output',
        to: '</HARD-GATE>\n\nThe specialist may handoff to Specs.\n\n## Output',
        expected: ['specialist-boundary']
      },
      {
        name: 'specialist-handoff-authority-removed',
        source: 'agent',
        from: 'Non-bug exploration may end\nin chat; feature/docs delivery may only prepare a future explicit Specs\ninvocation; bug handoff requires evidenced root cause and the user\'s explicit fix\nrequest.',
        to: 'Every route may invoke delivery workflows automatically.',
        expected: ['specialist-handoff']
      },
      {
        name: 'decision-provenance-removed',
        source: 'framework',
        from: 'Do not write "user selected" unless direct user text or the native input tool\n  confirms it.',
        to: 'Write "user selected" for inferred defaults.',
        expected: ['approval-persistence']
      },
      {
        name: 'installed-grammar-corruption',
        source: 'skill',
        from: '## Completion bar',
        to: 'one a structured user-input request call\n\n## Completion bar',
        expected: ['projection-grammar']
      }
    ];

    for (const mutation of mutations) {
      const target = assertInstalledBrainstormMutationTarget(root, mutation.source);
      const original = fs.readFileSync(target);
      const fullContent = original.toString('utf8');
      const projectedContent = mutation.source === 'agent'
        ? parseGeneratedTomlString(fullContent, 'developer_instructions')
        : fullContent;
      const anchor = projectedContent.indexOf(mutation.from);
      assert.ok(anchor >= 0, `${mutation.name} mutation anchor must exist`);
      assert.equal(
        projectedContent.indexOf(mutation.from, anchor + mutation.from.length),
        -1,
        `${mutation.name} mutation anchor must be unique`
      );
      const weakened = `${projectedContent.slice(0, anchor)}${mutation.to}${projectedContent.slice(anchor + mutation.from.length)}`;
      const rendered = mutation.source === 'agent'
        ? replaceGeneratedTomlString(fullContent, 'developer_instructions', weakened)
        : weakened;
      try {
        fs.writeFileSync(assertInstalledBrainstormMutationTarget(root, mutation.source), rendered);
        assertCanonicalBrainstormSourceBytesUnchanged(sourceBytes);
        assert.deepEqual(
          brainstormProjectionIssues(readInstalledBrainstormProjection(root)),
          mutation.expected,
          mutation.name
        );
      } finally {
        fs.writeFileSync(assertInstalledBrainstormMutationTarget(root, mutation.source), original);
      }
      assert.deepEqual(fs.readFileSync(target), original, `${mutation.name} byte restore`);
      assert.deepEqual(brainstormProjectionIssues(readInstalledBrainstormProjection(root)), []);
      assertCanonicalBrainstormSourceBytesUnchanged(sourceBytes);
    }
  });
});

test('Codex installed Develop preserves plan-native execution and references', () => {
  inTempProject((root) => {
    const sourceBytes = new Map(DEVELOP_BUNDLE.map((relative) => [
      path.join(DEVELOP_SOURCE_ROOT, relative),
      fs.readFileSync(path.join(DEVELOP_SOURCE_ROOT, relative))
    ]));
    const result = install(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installedRoot = path.join(root, '.agents/skills/develop');
    for (const relative of DEVELOP_BUNDLE) {
      const sourcePath = path.join(DEVELOP_SOURCE_ROOT, relative);
      assert.equal(
        fs.readFileSync(path.join(installedRoot, relative), 'utf8'),
        normalizeCodexBody(fs.readFileSync(sourcePath, 'utf8'), sourcePath),
        `Codex Develop projection drifted: ${relative}`
      );
    }
    const installedSkill = fs.readFileSync(path.join(installedRoot, 'SKILL.md'), 'utf8');
    assert.match(installedSkill, /\$cf-develop <feature>/);
    assert.match(installedSkill, /\.codex\/scripts\/workflow-policy\.cjs/);
    assert.doesNotMatch(installedSkill, /\/cf:develop|\.claude\/scripts/);
    assert.equal(fs.existsSync(path.join(root, '.claude/skills/develop')), false);
    for (const [sourcePath, expected] of sourceBytes) {
      assert.deepEqual(fs.readFileSync(sourcePath), expected, `canonical source changed: ${sourcePath}`);
    }
  });
});

test('Codex installed Research preserves adaptive evidence semantics', () => {
  inTempProject((root) => {
    const sourceBytes = new Map([
      [RESEARCH_SKILL_SOURCE_PATH, fs.readFileSync(RESEARCH_SKILL_SOURCE_PATH)],
      [RESEARCH_AGENT_SOURCE_PATH, fs.readFileSync(RESEARCH_AGENT_SOURCE_PATH)],
    ]);
    const result = install(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installedSkillPath = path.join(root, '.agents/skills/research/SKILL.md');
    const installedAgentPath = path.join(root, '.codex/agents/researcher.toml');
    assert.equal(
      fs.readFileSync(installedSkillPath, 'utf8'),
      normalizeCodexBody(fs.readFileSync(RESEARCH_SKILL_SOURCE_PATH, 'utf8'), RESEARCH_SKILL_SOURCE_PATH)
    );
    assert.equal(
      fs.readFileSync(installedAgentPath, 'utf8'),
      convertCodexAgentContent(fs.readFileSync(RESEARCH_AGENT_SOURCE_PATH, 'utf8'), 'researcher.md')
    );
    const installedSkill = fs.readFileSync(installedSkillPath, 'utf8');
    const installedAgent = parseGeneratedTomlString(
      fs.readFileSync(installedAgentPath, 'utf8'), 'developer_instructions'
    );
    assert.match(installedSkill, /^name: cf-research$/m);
    assert.match(installedSkill, /Quick \| One low-risk, reversible fact or known option/);
    assert.match(installedSkill, /research sequentially with the same evidence bar/);
    assert.match(installedSkill, /Default to a concise answer in chat/);
    assert.match(installedSkill, /confirmed \| inferred \| unresolved/);
    assert.match(installedAgent, /do not implement code,\s+write files, mutate task state/);
    assert.match(installedAgent, /owns any\s+authorized persistence/);
    assert.doesNotMatch(installedSkill, /must (?:instantly |always )?delegate/i);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, '.codex/cafekit-manifest.json'), 'utf8')
    );
    assert.ok(manifest.files['.agents/skills/research/SKILL.md']);
    assert.ok(manifest.files['.codex/agents/researcher.toml']);
    assert.equal(fs.existsSync(path.join(root, '.claude/skills/research')), false);
    for (const [sourcePath, expected] of sourceBytes) {
      assert.deepEqual(fs.readFileSync(sourcePath), expected, `canonical source changed: ${sourcePath}`);
    }
  });
});

test('Codex installed Test preserves plan-native proof and references', () => {
  inTempProject((root) => {
    const sourcePaths = [
      ...TEST_BUNDLE.map((relative) => path.join(TEST_SOURCE_ROOT, relative)),
      TEST_RUNNER_SOURCE_PATH,
      path.join(CODE_REVIEW_SOURCE_ROOT, 'SKILL.md')
    ];
    const sourceBytes = new Map(sourcePaths.map((sourcePath) => [
      sourcePath, fs.readFileSync(sourcePath)
    ]));
    const result = install(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installedRoot = path.join(root, '.agents/skills/test');
    for (const relative of TEST_BUNDLE) {
      const sourcePath = path.join(TEST_SOURCE_ROOT, relative);
      assert.equal(
        fs.readFileSync(path.join(installedRoot, relative), 'utf8'),
        normalizeCodexBody(fs.readFileSync(sourcePath, 'utf8'), sourcePath),
        `Codex Test projection drifted: ${relative}`
      );
    }
    const installedSkill = fs.readFileSync(path.join(installedRoot, 'SKILL.md'), 'utf8');
    assert.match(installedSkill, /\$cf-test/);
    assert.match(installedSkill, /test-proof-v1/);
    assert.doesNotMatch(installedSkill, /\/cf:test/);

    const installedRunnerPath = path.join(root, '.codex/agents/test_runner.toml');
    assert.equal(
      fs.readFileSync(installedRunnerPath, 'utf8'),
      convertCodexAgentContent(
        fs.readFileSync(TEST_RUNNER_SOURCE_PATH, 'utf8'),
        path.basename(TEST_RUNNER_SOURCE_PATH)
      ),
      'Codex test_runner projection drifted'
    );
    const installedRunner = parseGeneratedTomlString(
      fs.readFileSync(installedRunnerPath, 'utf8'), 'developer_instructions'
    );
    assert.match(installedRunner, /test-proof-v1/);
    assert.match(installedRunner, /sole writer of[\s\S]*Status and inline Receipt/i);

    const reviewSourcePath = path.join(CODE_REVIEW_SOURCE_ROOT, 'SKILL.md');
    const installedReview = fs.readFileSync(path.join(root, '.agents/skills/code-review/SKILL.md'), 'utf8');
    assert.equal(installedReview, normalizeCodexBody(
      fs.readFileSync(reviewSourcePath, 'utf8'), reviewSourcePath
    ));
    assert.match(installedReview, /controller-validated `test-proof-v1`/);
    assert.match(installedReview, /Never create or search for a separate[\s\S]*process-first receipt/i);
    assert.equal(fs.existsSync(path.join(root, '.claude/skills/test')), false);
    for (const [sourcePath, expected] of sourceBytes) {
      assert.deepEqual(fs.readFileSync(sourcePath), expected, `canonical source changed: ${sourcePath}`);
    }
  });
});

function hotfixProjectionIssues(files) {
  const compact = (value) => String(value).replace(/\s+/g, ' ').trim();
  const skill = compact(files.skill);
  const review = compact(files.review);
  const parallel = compact(files.parallel);
  const specialized = compact(files.specialized);
  const issues = new Set();
  if (!skill.includes('name: cf-fix')
    || !skill.includes('# Fix — root-cause repair workflow')
    || skill.includes('name: cf-hotfix')) {
    issues.add('public-rename');
  }
  if (!skill.includes('## Proportional depth')
    || !skill.includes('Quick mode only reduces depth; it never skips scout, pre-fix evidence, diagnosis, or before/after verification.')) {
    issues.add('adaptive-depth');
  }
  if (!skill.includes('`Timeline: skipped - <reason>` or `- skipped: <reason>`')
    || !skill.includes('`Recurrence-Prevention Handoff`, when present, carries evidence-backed candidates only.')
    || !skill.includes('routes back to diagnosis (`cf-debug`)')) {
    issues.add('debug-handoff');
  }
  if (!skill.includes('report `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`')
    || !skill.includes('The definition of `PASS` defers to `cf-code-review`.')
    || skill.includes('Confidence score')
    || !review.includes('Only `FAIL` and `PASS_WITH_WARNINGS` enter remediation retry')
    || !review.includes('only a fresh literal `PASS` enters finalization')
    || review.includes('"Approve anyway"')
    || review.includes('"Approve with known issues"')
    || review.includes('at most one Medium')) {
    issues.add('verdict-surface');
  }
  if (!skill.includes('The user explicitly requested or permitted delegation or parallel agents.')
    || !skill.includes('The active runtime exposes an Explore/delegation capability.')
    || !skill.includes('at least two distinct, non-overlapping scopes')
    || !parallel.includes('The user explicitly requested or permitted delegation or parallel agents.')) {
    issues.add('delegation-gate');
  }
  if (!skill.includes('The original symptom no longer reproduces with the exact pre-fix command/user flow.')
    || !skill.includes('Do not silently patch around the regression.')) {
    issues.add('side-effect-gate');
  }
  if (!skill.includes('## Bounded repair frame')
    || !skill.includes('Quick/local does not add a separate framing ceremony')
    || !skill.includes('**Outcome:**')
    || !skill.includes('**Constraints:**')
    || !skill.includes('**Non-goals:**')
    || !skill.includes('**Acceptance:**')) {
    issues.add('bounded-repair-frame');
  }
  if (!skill.includes('after diagnosis, research only unresolved external facts')
    || !skill.includes('`cf-brainstorm` to compare 2-3 options')
    || !skill.includes('When diagnosis leaves one safe direct repair, skip research and')) {
    issues.add('deep-decision-route');
  }
  if (!skill.includes('Load only the matching')
    || !specialized.includes('Load only the matching section')
    || (specialized.match(/\*\*Baseline:\*\*/g) || []).length < 5
    || (specialized.match(/\*\*Proof:\*\*/g) || []).length < 5) {
    issues.add('specialized-proof-overlays');
  }
  if (!parallel.includes('Diagnosis still starts only')
    || !parallel.includes('after the required scout outputs are synthesized')
    || !parallel.includes('Research begins only after Step 2 diagnosis')
    || parallel.includes('scout + diagnose + research together')
    || parallel.includes("You don't need to wait for scouting")) {
    issues.add('scout-before-diagnosis');
  }
  return [...issues].sort();
}

test('Codex installed Fix preserves the adaptive repair contract', () => {
  inTempProject((root) => {
    const sourceBytes = new Map(HOTFIX_BUNDLE.map((relative) => [
      path.join(HOTFIX_SOURCE_ROOT, relative),
      fs.readFileSync(path.join(HOTFIX_SOURCE_ROOT, relative))
    ]));
    const result = install(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installedRoot = path.join(root, '.agents/skills/hotfix');
    assert.equal(fs.existsSync(path.join(root, '.agents/skills/fix')), false,
      'public Fix rename must keep the manifest-owned hotfix directory');
    for (const relative of HOTFIX_BUNDLE) {
      const sourcePath = path.join(HOTFIX_SOURCE_ROOT, relative);
      assert.equal(
        fs.readFileSync(path.join(installedRoot, relative), 'utf8'),
        normalizeCodexBody(fs.readFileSync(sourcePath, 'utf8'), sourcePath),
        `Codex Fix projection drifted: ${relative}`
      );
    }
    const readProjection = () => ({
      skill: fs.readFileSync(path.join(installedRoot, 'SKILL.md'), 'utf8'),
      review: fs.readFileSync(path.join(installedRoot, 'references/review-cycle.md'), 'utf8'),
      parallel: fs.readFileSync(path.join(installedRoot, 'references/parallel-patterns.md'), 'utf8'),
      specialized: fs.readFileSync(path.join(installedRoot, 'references/workflow-specialized.md'), 'utf8'),
    });
    const installedSkill = readProjection().skill;
    assert.match(installedSkill, /name: cf-fix/);
    assert.doesNotMatch(installedSkill, /name: cf-hotfix|\/cf:fix|cf:debug|cf:code-review/);
    assert.deepEqual(hotfixProjectionIssues(readProjection()), []);

    const mutations = [
      {
        name: 'public-name-reverts', file: 'SKILL.md',
        from: 'name: cf-fix', to: 'name: cf-hotfix',
        expected: ['public-rename']
      },
      {
        name: 'quick-skips-diagnosis', file: 'SKILL.md',
        from: 'Quick mode only reduces depth', to: 'Quick mode may shorten scope',
        expected: ['adaptive-depth']
      },
      {
        name: 'handoff-drops-skip-forms', file: 'SKILL.md',
        from: '`Timeline: skipped - <reason>` or `- skipped: <reason>`', to: '`Timeline: omitted`',
        expected: ['debug-handoff']
      },
      {
        name: 'warnings-auto-accept', file: 'references/review-cycle.md',
        from: 'Only `FAIL` and `PASS_WITH_WARNINGS` enter remediation retry',
        to: 'Only `FAIL` enters remediation retry; `PASS_WITH_WARNINGS` auto-approves',
        expected: ['verdict-surface']
      },
      {
        name: 'warnings-user-approve', file: 'references/review-cycle.md',
        from: 'only a fresh literal `PASS` enters finalization', to: '"Approve anyway" enters finalization',
        expected: ['verdict-surface']
      },
      {
        name: 'pass-redefined-locally', file: 'references/review-cycle.md',
        from: 'The definition of `PASS` defers to `cf-code-review`; Fix never redefines it with local severity thresholds.',
        to: 'The definition of `PASS` is local: no Critical, no High, at most one Medium.',
        expected: ['verdict-surface']
      },
      {
        name: 'confidence-score-returns', file: 'SKILL.md',
        from: '**Report:** root cause, changes made',
        to: '**Report:** Confidence score, root cause, changes made',
        expected: ['verdict-surface']
      },
      {
        name: 'delegation-loses-user-clause', file: 'SKILL.md',
        from: 'The user explicitly requested or permitted delegation or parallel agents.',
        to: 'Delegation is at the agent\'s discretion.',
        expected: ['delegation-gate']
      },
      {
        name: 'sweep-permits-silent-patch', file: 'SKILL.md',
        from: 'Do not silently patch around the regression.', to: 'Patch around regressions quietly.',
        expected: ['side-effect-gate']
      },
      {
        name: 'quick-gains-mandatory-frame', file: 'SKILL.md',
        from: 'Quick/local does not add a separate framing ceremony', to: 'Quick/local always requires a separate framing ceremony',
        expected: ['bounded-repair-frame']
      },
      {
        name: 'deep-researches-before-diagnosis', file: 'SKILL.md',
        from: 'after diagnosis, research only unresolved external facts', to: 'research broadly before diagnosis',
        expected: ['deep-decision-route']
      },
      {
        name: 'overlays-load-everything', file: 'references/workflow-specialized.md',
        from: 'Load only the matching section', to: 'Load every section',
        expected: ['specialized-proof-overlays']
      },
      {
        name: 'diagnosis-starts-before-scout', file: 'references/parallel-patterns.md',
        from: 'Diagnosis still starts only', to: 'Diagnosis may start',
        expected: ['scout-before-diagnosis']
      },
      {
        name: 'research-starts-before-diagnosis', file: 'references/parallel-patterns.md',
        from: 'Research begins only after Step 2 diagnosis', to: 'Research may begin before Step 2 diagnosis',
        expected: ['scout-before-diagnosis']
      }
    ];
    for (const mutation of mutations) {
      const target = path.join(installedRoot, mutation.file);
      const original = fs.readFileSync(target);
      const content = original.toString('utf8');
      const anchor = content.indexOf(mutation.from);
      assert.ok(anchor >= 0, `${mutation.name} mutation anchor must exist`);
      assert.equal(
        content.indexOf(mutation.from, anchor + mutation.from.length),
        -1,
        `${mutation.name} mutation anchor must be unique`
      );
      const weakened = `${content.slice(0, anchor)}${mutation.to}${content.slice(anchor + mutation.from.length)}`;
      try {
        fs.writeFileSync(target, weakened);
        assert.deepEqual(hotfixProjectionIssues(readProjection()), mutation.expected, mutation.name);
      } finally {
        fs.writeFileSync(target, original);
      }
      assert.deepEqual(fs.readFileSync(target), original, `${mutation.name} byte restore`);
      assert.deepEqual(hotfixProjectionIssues(readProjection()), []);
    }
    for (const [sourcePath, expected] of sourceBytes) {
      assert.deepEqual(fs.readFileSync(sourcePath), expected, `canonical source changed: ${sourcePath}`);
    }
  });
});

function docsProjectionIssues(files) {
  const compact = (value) => String(value).replace(/\s+/g, ' ').trim();
  const skill = compact(files.skill);
  const init = compact(files.init);
  const update = compact(files.update);
  const standard = compact(files.standard);
  const issues = new Set();
  if (!skill.includes('The user explicitly requested or permitted delegation or parallel agents.')
    || !skill.includes('The active runtime exposes an Explore/delegation capability.')
    || !skill.includes('at least two distinct, non-overlapping scopes')
    || !skill.includes('Otherwise continue sequentially in the main agent')
    || !skill.includes('only through the Delegation Gate above')
    || !init.includes('only through the Delegation Gate in `../SKILL.md`')
    || !update.includes('only through the Delegation Gate in `../SKILL.md`')
    || skill.includes('when delegation is available')
    || init.includes('when delegation is available')
    || update.includes('when delegation is available')) {
    issues.add('delegation-gate');
  }
  if (!skill.includes('## Post-Task Docs Checkpoint')
    || !skill.includes('`none`: report that no docs change is needed and edit nothing.')
    || !skill.includes('A checkpoint never invents a new document')
    || !skill.includes('never auto-selects `init` and overrides')
    || !skill.includes('report the gap and recommend an explicit')
    || !standard.includes('checkpoint contract in `../SKILL.md`')
    || skill.includes('checkpoint may create')) {
    issues.add('docs-checkpoint');
  }
  if (!skill.includes('Type: Observed | Inferred | Unknown')
    || !skill.includes('Confidence: High | Medium | Low')
    || skill.includes('evidence is optional')) {
    issues.add('evidence-taxonomy');
  }
  if (!skill.includes('## Reconstruction Is Not Specs')
    || skill.includes('are advisory')) {
    issues.add('reconstruction-boundary');
  }
  return [...issues].sort();
}

test('Codex installed Docs preserves the adaptive contract', () => {
  inTempProject((root) => {
    const sourceBytes = new Map(DOCS_ADAPTIVE_BUNDLE.map((relative) => [
      path.join(DOCS_ADAPTIVE_SOURCE_ROOT, relative),
      fs.readFileSync(path.join(DOCS_ADAPTIVE_SOURCE_ROOT, relative))
    ]));
    const result = install(root, ['--with-document-skills']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const installedRoot = path.join(root, '.agents/skills/docs');
    for (const relative of DOCS_ADAPTIVE_BUNDLE) {
      const sourcePath = path.join(DOCS_ADAPTIVE_SOURCE_ROOT, relative);
      assert.equal(
        fs.readFileSync(path.join(installedRoot, relative), 'utf8'),
        normalizeCodexBody(fs.readFileSync(sourcePath, 'utf8'), sourcePath),
        `Codex Docs projection drifted: ${relative}`
      );
    }
    const readProjection = () => ({
      skill: fs.readFileSync(path.join(installedRoot, 'SKILL.md'), 'utf8'),
      init: fs.readFileSync(path.join(installedRoot, 'references/init-workflow.md'), 'utf8'),
      update: fs.readFileSync(path.join(installedRoot, 'references/update-workflow.md'), 'utf8'),
      standard: fs.readFileSync(path.join(installedRoot, 'references/standard-docs-workflow.md'), 'utf8'),
    });
    assert.match(readProjection().skill, /name: cf-docs/);
    assert.deepEqual(docsProjectionIssues(readProjection()), []);

    const mutations = [
      {
        name: 'gate-loses-user-clause', file: 'SKILL.md',
        from: 'The user explicitly requested or permitted delegation or parallel agents.',
        to: 'Delegation is at the agent\'s discretion.',
        expected: ['delegation-gate']
      },
      {
        name: 'keeper-ungated-returns', file: 'SKILL.md',
        from: 'only through the Delegation Gate above', to: 'when delegation is available',
        expected: ['delegation-gate']
      },
      {
        name: 'checkpoint-invents-doc', file: 'SKILL.md',
        from: 'A checkpoint never invents a new document', to: 'A checkpoint may create missing documents',
        expected: ['docs-checkpoint']
      },
      {
        name: 'taxonomy-drops-inferred', file: 'SKILL.md',
        from: 'Type: Observed | Inferred | Unknown', to: 'Type: Observed | Unknown',
        expected: ['evidence-taxonomy']
      },
      {
        name: 'reconstruction-becomes-advisory', file: 'SKILL.md',
        from: '## Reconstruction Is Not Specs',
        to: '## Reconstruction Is Not Specs\n\nThe prohibitions below are advisory.',
        expected: ['reconstruction-boundary']
      }
    ];
    for (const mutation of mutations) {
      const target = path.join(installedRoot, mutation.file);
      const original = fs.readFileSync(target);
      const content = original.toString('utf8');
      const anchor = content.indexOf(mutation.from);
      assert.ok(anchor >= 0, `${mutation.name} mutation anchor must exist`);
      assert.equal(
        content.indexOf(mutation.from, anchor + mutation.from.length),
        -1,
        `${mutation.name} mutation anchor must be unique`
      );
      const weakened = `${content.slice(0, anchor)}${mutation.to}${content.slice(anchor + mutation.from.length)}`;
      try {
        fs.writeFileSync(target, weakened);
        assert.deepEqual(docsProjectionIssues(readProjection()), mutation.expected, mutation.name);
      } finally {
        fs.writeFileSync(target, original);
      }
      assert.deepEqual(fs.readFileSync(target), original, `${mutation.name} byte restore`);
      assert.deepEqual(docsProjectionIssues(readProjection()), []);
    }
    for (const [sourcePath, expected] of sourceBytes) {
      assert.deepEqual(fs.readFileSync(sourcePath), expected, `canonical source changed: ${sourcePath}`);
    }
  });
});

test('Codex install on top of existing Claude installation preserves content and adds Codex', () => {
  inTempProject((root) => {
    // Setup existing Claude installation with content
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'cafekit.json'),
      `${JSON.stringify({ version: PACKAGE_VERSION, platform: 'claude' })}\n`
    );

    // Existing CLAUDE.md with content
    const claudeMdContent = '# CLAUDE.md\n\n## User Instructions\n\nThis is my existing CLAUDE.md content.\n';
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), claudeMdContent);

    // Existing AGENTS.md with content
    const agentsMdContent = '# AGENTS.md\n\n## User Rules\n\nKeep this exact.\n';
    fs.writeFileSync(path.join(root, 'AGENTS.md'), agentsMdContent);

    // Run Codex install
    const result = install(root, ['--platform', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    // Assert .claude/ and its content still exist
    assert.equal(fs.existsSync(path.join(root, '.claude')), true, '.claude should exist');
    assert.equal(fs.existsSync(path.join(root, '.claude', 'cafekit.json')), true, '.claude/cafekit.json should exist');
    const claudeMetadata = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'cafekit.json'), 'utf8'));
    assert.equal(claudeMetadata.platform, 'claude', '.claude/cafekit.json should still be claude platform');

    // Assert .codex/ is created with payload
    assert.equal(fs.existsSync(path.join(root, '.codex')), true, '.codex should be created');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'hooks.json')), true, '.codex/hooks.json should exist');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'runtime.json')), true, '.codex/runtime.json should exist');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'hooks', 'privacy-block.cjs')), true, '.codex/hooks/privacy-block.cjs should exist');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'rules', 'workflow.md')), true, '.codex/rules/workflow.md should exist');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'scripts', 'spec-ground.cjs')), true, '.codex/scripts/spec-ground.cjs should exist');
    assert.equal(fs.existsSync(path.join(root, '.codex', 'scripts', 'validate-spec-output.cjs')), true, '.codex/scripts/validate-spec-output.cjs should exist');
    assert.equal(fs.existsSync(path.join(root, '.agents', '.gitignore')), true, '.agents/.gitignore should exist');
    assert.equal(fs.existsSync(path.join(root, '.agents', 'skills', 'specs', 'SKILL.md')), true, '.agents/skills/specs/SKILL.md should exist');

    // Assert .codex/cafekit.json has platform codex
    const codexMetadata = JSON.parse(fs.readFileSync(path.join(root, '.codex', 'cafekit.json'), 'utf8'));
    assert.equal(codexMetadata.platform, 'codex', '.codex/cafekit.json should have platform codex');
    assert.equal(codexMetadata.version, PACKAGE_VERSION, '.codex/cafekit.json should have current version');

    // Assert AGENTS.md root contains CODEX markers AND preserves original content
    const agentsMd = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    assert.match(agentsMd, /<!-- CAFEKIT CODEX START -->/, 'AGENTS.md should have CODEX START marker');
    assert.match(agentsMd, /<!-- CAFEKIT CODEX END -->/, 'AGENTS.md should have CODEX END marker');
    assert.match(agentsMd, /Keep this exact\./, 'AGENTS.md should preserve original user content');
    assert.ok(agentsMd.startsWith(agentsMdContent), 'AGENTS.md should start with original user content');

    // Assert CLAUDE.md is unchanged
    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.equal(claudeMd, claudeMdContent, 'CLAUDE.md should be unchanged');
  });
});

test('Codex installed code_auditor contains Strict conditional marker', () => {
  inTempProject((root) => {
    const result = install(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const toml = fs.readFileSync(path.join(root, '.codex', 'agents', 'code_auditor.toml'), 'utf8');
    assert.match(toml, /Strict Semantic Review Attestation/);
    assert.match(toml, /CAFEKIT_SEMANTIC_REVIEW_ATTESTATION/);
    assert.match(toml, /MAC-protected host-hook observation/);
    assert.doesNotMatch(toml, /host-signed/);
    assert.match(toml, /specs\/<feature>\/spec\.json/);
  });
});

test('Codex scaffold resolver rejects symlink template', () => {
  inTempProject((root) => {
    const result = install(root);
    assert.equal(result.status, 0);
    const template = path.join(root, '.agents', 'skills', 'specs', 'templates', 'task.md');
    const target = path.join(root, 'outside.md');
    fs.writeFileSync(target, 'evil');
    const original = fs.readFileSync(template);
    fs.unlinkSync(template);
    fs.symlinkSync(target, template);
    const scaffold = path.join(root, '.codex', 'scripts', 'spec-scaffold.cjs');
    const out = spawnSync(process.execPath, [scaffold, 'symlink-test', '--tasks', 'R1-01-foo,R1-02-bar', '--boundaries', '[{"id":"B-OWN","type":"ownership","tasks":["R1-01","R1-02"],"write_sets":{"R1-01":["src/a.js"],"R1-02":["src/b.js"]}}]'], { cwd: root, encoding: 'utf8' });
    // Should fail because template is symlink and resolver rejects it
    assert.notEqual(out.status, 0, 'scaffold should reject symlink template');
    assert.match(`${out.stdout}\n${out.stderr}`, /template not found|symlink/i);
    fs.unlinkSync(template);
    fs.writeFileSync(template, original);
  });
});

test('Claude and Codex installed Route preserve proportional live-catalog semantics', () => {
  inTempProject((root) => {
    const result = installPlatforms(root, ['claude', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const sourceRoot = path.join(PACKAGE_ROOT, 'src/claude/skills/route');
    const expectedFiles = [
      'SKILL.md', 'references/task-taxonomy.md',
      'references/chaining-patterns.md', 'references/agent-timing.md'
    ];
    const expectedRules = ['skill-workflow-routing.md', 'skill-domain-routing.md'];
    for (const runtime of ['claude', 'codex']) {
      const installedRoot = path.join(root, runtime === 'codex' ? '.agents/skills/route' : '.claude/skills/route');
      for (const relative of expectedFiles) {
        const source = fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
        const installed = fs.readFileSync(path.join(installedRoot, relative), 'utf8');
        const expected = runtime === 'codex'
          ? normalizeCodexBody(source, path.join(sourceRoot, relative))
          : source;
        assert.equal(installed, expected, `${runtime}:${relative}`);
      }
      for (const relative of expectedRules) {
        const sourcePath = path.join(PACKAGE_ROOT, 'src/claude/rules', relative);
        const source = fs.readFileSync(sourcePath, 'utf8');
        const installed = fs.readFileSync(path.join(
          root, runtime === 'codex' ? '.codex/rules' : '.claude/rules', relative
        ), 'utf8');
        const expected = runtime === 'codex' ? normalizeCodexBody(source, sourcePath) : source;
        assert.equal(installed, expected, `${runtime}:rules/${relative}`);
      }
      const route = fs.readFileSync(path.join(installedRoot, 'SKILL.md'), 'utf8');
      assert.match(route, /names a valid installed skill[\s\S]*one installed skill clearly covers[\s\S]*Direct factual conversation/);
      assert.match(route, /highest-link[\s\S]*risk[\s\S]*number of material domains/);
      assert.match(route, /never expand it/);
      const catalog = installedCatalog(root, runtime);
      assert.ok(catalog.skills.some((skill) => skill.public_id === 'cf:route'));
      assert.equal(catalog.skills.some((skill) => skill.public_id === 'cf:docs'), false);
    }
  });
});

test('combined installs bind each catalog to its native runtime inventory', () => {
  inTempProject((root) => {
    const result = installPlatforms(root, ['claude', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    fs.cpSync(
      path.join(PACKAGE_ROOT, 'src/claude/skills/docs'),
      path.join(root, '.claude/skills/docs'),
      { recursive: true }
    );
    const claude = installedCatalog(root, 'claude');
    const codex = installedCatalog(root, 'codex');
    assert.equal(claude.root, fs.realpathSync(path.join(root, '.claude/skills')));
    assert.equal(codex.root, fs.realpathSync(path.join(root, '.agents/skills')));
    assert.equal(claude.skills.some((skill) => skill.public_id === 'cf:docs'), true);
    assert.equal(codex.skills.some((skill) => skill.public_id === 'cf:docs'), false);
  });
});

test('Claude and Codex installed rules preserve the ported review and process guidance', () => {
  inTempProject((root) => {
    const result = installPlatforms(root, ['claude', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const ported = ['review-audit-self-decision.md', 'process-management.md'];
    const renameOnly = (content) => content
      .replace(/\/cf:([a-z0-9-]+)/gi, (_match, name) => `$cf-${name}`)
      .replace(/\bcf:([a-z0-9-]+)/gi, (_match, name) => `cf-${name}`);
    for (const relative of ported) {
      const sourcePath = path.join(PACKAGE_ROOT, 'src/claude/rules', relative);
      const source = fs.readFileSync(sourcePath, 'utf8');
      assert.equal(
        fs.existsSync(path.join(PACKAGE_ROOT, 'src/codex/rules', relative)),
        false,
        `${relative} must not be shadowed by a Codex native override`
      );
      assert.equal(
        fs.readFileSync(path.join(root, '.claude/rules', relative), 'utf8'),
        source,
        `claude:rules/${relative}`
      );
      const installedCodex = fs.readFileSync(path.join(root, '.codex/rules', relative), 'utf8');
      assert.equal(installedCodex, normalizeCodexBody(source, sourcePath), `codex:rules/${relative}`);
      assert.equal(
        installedCodex,
        renameOnly(source),
        `codex:rules/${relative} must differ from source only by skill-name renames`
      );
    }
    const agentsMd = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    const pointerLines = agentsMd
      .split('\n')
      .filter((line) => ported.some((relative) => line.includes(relative)));
    assert.equal(pointerLines.length, ported.length, 'AGENTS.md must point at both ported rules');
    for (const relative of ported) {
      assert.ok(
        pointerLines.some((line) => line.includes(`.codex/rules/${relative}`)),
        `AGENTS.md must name .codex/rules/${relative}`
      );
    }
    const pointerText = pointerLines.join('\n');
    for (const forbidden of ['cf:', 'Claude Code', 'Claude Tasks', 'SendMessage', '.claude/']) {
      assert.equal(
        pointerText.includes(forbidden),
        false,
        `AGENTS.md pointer must stay Codex-native: ${forbidden}`
      );
    }
  });
});

test('installed Route degrades safely when an agent is absent', () => {
  inTempProject((root) => {
    const result = installPlatforms(root, ['claude', 'codex']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const cases = [
      ['claude', '.claude/agents/researcher.md', '.claude/skills/route'],
      ['codex', '.codex/agents/researcher.toml', '.agents/skills/route'],
    ];
    for (const [runtime, agentRelative, routeRelative] of cases) {
      fs.rmSync(path.join(root, agentRelative), { force: true });
      assert.equal(fs.existsSync(path.join(root, agentRelative)), false);
      const timing = fs.readFileSync(path.join(root, routeRelative, 'references/agent-timing.md'), 'utf8');
      const route = fs.readFileSync(path.join(root, routeRelative, 'SKILL.md'), 'utf8');
      const normalizedRoute = route.replace(/\s+/g, ' ');
      assert.match(timing, /If the preferred agent is absent[\s\S]*never synthesize a role/);
      assert.match(normalizedRoute, /continue inline when safe or return the named gap/);
      assert.match(normalizedRoute, /Never synthesize an unavailable agent/);
      assert.doesNotMatch(`${timing}\n${route}`, /researcher(?:\.md|\.toml)/i, runtime);
    }
  });
});
