'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const {
  convertCodexAgentContent,
  normalizeCodexBody,
} = require('../lib/codex-install');

const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const PACKAGE_VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
const OLD_FIXTURE_VERSION = '0.14.1';
const NO_INVENTION_ANCHOR = 'Before implementation handoff, apply the **no-invention gate**:';
const IMPLEMENTATION_READINESS_BOUNDARY_ROWS = [
  ['Interaction/UI', 'entry journey; visible/loading/empty/error states; input/focus/keyboard; accessibility; responsive/native/device behavior'],
  ['API/CLI', 'entrypoint/route or command grammar; identity/auth; input/default/normalization; success output; error/status/exit; duplicate/retry/idempotency; compatibility'],
  ['Data/schema', 'authority/storage/transaction; version; exact keys/nesting/types; required/optional; enum/format/bounds/cardinality; unknown-field behavior; compatibility/migration'],
  ['Async/state', 'initial/terminal states; event + guard + effect + next + error; ordering/concurrency; duplicate/retry; writer/lock acquire/contention/release; cancellation; rollback/recovery'],
  ['Filesystem/security', 'authoritative root; trusted/untrusted segment grammar; lexical + canonical containment and symlink policy; flags/mode; temp/rename/fsync; lock/stale reclaim; crash cleanup'],
  ['Runtime/deploy', 'config/env/flags; registration/packaging; OS/arch; rollout/rollback; health/logging; operator recovery'],
  ['Time/retention', 'clock source; unit/precision/timezone; endpoints and inclusion/comparator; anomaly behavior; expiry/purge/recovery'],
  ['AI/model', 'provider/model/prompt/tool schema; nondeterminism/bounds; safety/privacy; fallback; cost/token limit; eval oracle'],
  ['Integration/proof', 'caller; export/registration; packaging/config; native path/consumer; proof level (`source`/`installed`/`live`); observable failure oracle'],
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
    '- Artifacts: <required artifact path plus digest algorithm/comparison rule, or explicitly ephemeral with cleanup rule>',
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
  scopeReturnsToC1: 'A repair that adds user semantics or scope returns to GATE-SCOPE.',
};

const ADAPTIVE_COVERAGE_PROFILE_HEADER = [
  'ID', 'Outcome', 'Change kinds', 'Material surfaces', 'Ambiguity/action',
  'Risk/evidence', 'Required proof',
];
const ADAPTIVE_COVERAGE_PROFILE_ROW = [
  'CP-01', '<externally observable outcome>', '<all kinds>', '<all material surfaces>',
  '<state + action>', '<level + evidence>', '<source/installed/live set>',
];
const ADAPTIVE_COVERAGE_AMBIGUITY_ROWS = [
  ['State', 'Required action'],
  ['`none`', 'proceed'],
  ['`examples-needed`', 'add two or three examples only for an already decided rule; promote to `decision-needed` if an example changes observable behavior'],
  ['`decision-needed`', 'ask the user at GATE-SCOPE/GATE-REVIEW and keep affected tasks blocked'],
  ['`design-needed`', 'after user-owned decisions settle, route material competing technical designs through Brainstorm'],
];
const ADAPTIVE_REVIEWER_ROWS = [
  ['Groups', 'Reviewers', 'Roles', 'Claim budget'],
  ['1-2', '2', 'Fact Checker plus all matching material lenses', 'about 5 per group'],
  ['3-5', '3', 'Fact Checker plus all matching material lenses', 'about 10 per group'],
  ['6+', '4', 'Fact Checker plus all matching material lenses', 'at least 15 total'],
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
  reviewCapacity: 'Reviewer count is fixed by the table, not lens count. Give each reviewer a distinct primary lens; when material lenses exceed reviewers, combine related named lenses on one reviewer and keep every material lens assigned.',
};
const REQUIRED_PAYLOAD = [
  'bin/install.js',
  'src/claude/migration-manifest.json',
  'src/claude/scripts/scan-staged-secrets.cjs',
  'src/claude/scripts/workflow-policy.cjs',
  'src/claude/scripts/provenance.cjs',
  'src/claude/scripts/spec-receipt.cjs',
  'src/claude/scripts/generate-skill-catalog.cjs',
  'src/claude/rules/process-management.md',
  'src/claude/rules/review-audit-self-decision.md',
  'src/claude/rules/skill-domain-routing.md',
  'src/claude/rules/skill-workflow-routing.md',
  'src/claude/skills/orca/SKILL.md',
  'src/claude/skills/brainstorm/SKILL.md',
  'src/claude/skills/brainstorm/references/question-framework.md',
  'src/claude/agents/brainstormer.md',
  'src/claude/skills/research/SKILL.md',
  'src/claude/agents/researcher.md',
  'src/claude/skills/docs/SKILL.md',
  'src/claude/skills/docx/SKILL.md',
  'src/claude/skills/pdf/SKILL.md',
  'src/claude/skills/pptx/SKILL.md',
  'src/claude/skills/xlsx/SKILL.md',
  'src/claude/skills/ai-multimodal/SKILL.md',
];
const FORBIDDEN_PAYLOAD = [
  /(^|\/)\.logs(\/|$)/,
  /\.log$/,
  /\.coverage(?:\/|$)/,
  /__pycache__(?:\/|$)/,
  /\.pyc$/,
  /(^|\/)\.(?:cache|state|tmp)(\/|$)/,
  /^src\/\.codex(?:\/|$)/,
  /^src\/claude\/skills\/(?:backend-development|frontend-development|frontend-design|mobile-development|devops|react-best-practices)(?:\/|$)/,
];
const RUNTIMES = {
  claude: {
    root: '.claude', rules: '.claude/hooks/rules.cjs', specs: '.claude/skills/specs',
    specMaker: '.claude/agents/spec-maker.md',
    manifest: '.claude/cafekit-manifest.json', templatesManifestPath: 'skills/specs/references/templates.md'
  },
  codex: {
    root: '.codex', rules: '.codex/hooks/rules.cjs', specs: '.agents/skills/specs',
    specMaker: '.codex/agents/spec_maker.toml',
    manifest: '.codex/cafekit-manifest.json', templatesManifestPath: '.agents/skills/specs/references/templates.md'
  },
};
const ADAPTIVE_SOURCE_RELATIVES = {
  skill: 'src/claude/skills/specs/SKILL.md',
  specMaker: 'src/claude/agents/spec-maker.md',
  templates: 'src/claude/skills/specs/references/templates.md',
  review: 'src/claude/skills/specs/references/review.md',
};
const BRAINSTORM_SOURCE_RELATIVES = {
  skill: 'src/claude/skills/brainstorm/SKILL.md',
  framework: 'src/claude/skills/brainstorm/references/question-framework.md',
  agent: 'src/claude/agents/brainstormer.md',
};
const RESEARCH_SOURCE_RELATIVES = {
  research: 'src/claude/skills/research/SKILL.md',
  agent: 'src/claude/agents/researcher.md',
  workflow: 'src/claude/rules/skill-workflow-routing.md',
  domain: 'src/claude/rules/skill-domain-routing.md',
};
const HOTFIX_SOURCE_RELATIVES = {
  skill: 'src/claude/skills/fix/SKILL.md',
  review: 'src/claude/skills/fix/references/review-cycle.md',
  parallel: 'src/claude/skills/fix/references/parallel-patterns.md',
  specialized: 'src/claude/skills/fix/references/workflow-specialized.md',
};
const REQUIRED_ADAPTIVE_BRAINSTORM_GROUPS = [
  'adviser-gate-fallback',
  'decision-brief',
  'direct-precedence',
  'evidence-semantics',
  'leading-flags',
  'lens-trigger-skip',
  'no-persistence-dispatch',
  'numeric-estimates',
  'ordered-depth',
  'pre-tool-authority-redaction',
];
const ADAPTIVE_BRAINSTORM_INSTALLED_RULES = [
  { group: 'direct-precedence', mutations: [
    { from: 'Route Direct first, then apply controls only to requests that remain in Brainstorm.', to: 'Apply controls before Direct classification.', clause: 'Route Direct first, then apply controls only to requests that remain in Brainstorm.' },
  ] },
  { group: 'ordered-depth', mutations: [
    { from: 'With no Deep signal, use Standard.', to: 'Deep is always the default.', clause: 'With no Deep signal, use Standard. `--deep` raises Standard to Deep.' },
  ] },
  { group: 'leading-flags', mutations: [
    { from: 'Parse controls only from the leading consecutive token segment.', to: 'Parse flag-like tokens anywhere.', clause: 'Parse controls only from the leading consecutive token segment.' },
    { from: '`--deep`, `--visual`, and `--advice` in any order, each at most once.', to: '`--deep`, `--visual`, and `--advice` may repeat.', clause: '`--deep`, `--visual`, and `--advice` in any order, each at most once.' },
    { from: '`--` ends the control segment.', to: '`--` is treated as another control.', clause: '`--` ends the control segment.' },
    { from: 'An unknown or duplicate `--*` inside the leading segment returns usage', to: 'An unknown or duplicate `--*` is ignored', clause: 'An unknown or duplicate `--*` inside the leading segment returns usage and performs no scout, question, tool call, write, or workflow action.' },
  ] },
  { group: 'lens-trigger-skip', mutations: [
    { from: 'failure isolation for partial or cascading failure across boundaries', to: 'generic failure notes', clause: 'failure isolation for partial or cascading failure across boundaries' },
  ] },
  { group: 'evidence-semantics', mutations: [
    { from: 'Missing evidence forces feasibility `unknown` and confidence `low`.', to: 'Missing evidence permits a confident guess.', clause: 'Missing evidence forces feasibility `unknown` and confidence `low`.' },
  ] },
  { group: 'numeric-estimates', mutations: [
    { from: 'A numeric estimate requires range, unit, basis, evidence, and assumptions; otherwise report `unknown`.', to: 'A numeric estimate may be a best-effort number.', clause: 'A numeric estimate requires range, unit, basis, evidence, and assumptions; otherwise report `unknown`.' },
  ] },
  { group: 'pre-tool-authority-redaction', mutations: [
    { from: 'Before an external visual tool or adviser handoff, minimize context and redact secrets, credentials, private keys, access tokens, and unnecessary PII.', to: 'Forward full context to every external tool and adviser.', clause: 'Before an external visual tool or adviser handoff, minimize context and redact secrets, credentials, private keys, access tokens, and unnecessary PII.' },
    { from: '`--visual` may present inline Mermaid or ASCII for any non-direct analysis and falls back to equivalent text when rendering is unavailable.', to: '`--visual` fails when rendering is unavailable.', clause: '`--visual` may present inline Mermaid or ASCII for any non-direct analysis and falls back to equivalent text when rendering is unavailable.' },
    { from: 'Durable or external rendering requires explicit user authority before invocation.', to: 'Durable or external rendering may run without consent.', clause: 'Durable or external rendering requires explicit user authority before invocation.' },
  ] },
  { group: 'adviser-gate-fallback', mutations: [
    { from: '`--advice` invokes `brainstormer` only after the material-choice gate;', to: '`--advice` invokes `brainstormer` before routing;', clause: '`--advice` invokes `brainstormer` only after the material-choice gate;' },
    { from: 'if advice is unavailable or fails, label it unavailable and continue with controller analysis.', to: 'if advice is unavailable, stop the workflow.', clause: 'if advice is unavailable or fails, label it unavailable and continue with controller analysis.' },
  ] },
  { group: 'decision-brief', mutations: [
    { from: 'The first section records target identity, current source revision and worktree state or `[UNVERIFIED]`, an evidence-as-of value, and what change invalidates the brief.', to: 'The handoff has no revision or freshness binding.', clause: 'The first section records target identity, current source revision and worktree state or `[UNVERIFIED]`, an evidence-as-of value, and what change invalidates the brief.' },
  ] },
  { group: 'no-persistence-dispatch', mutations: [
    { from: 'Neither overlay writes, approves, persists, dispatches, or completes work.', to: 'Overlays may persist, approve, dispatch, and complete work.', clause: 'Neither overlay writes, approves, persists, dispatches, or completes work.' },
  ] },
];

function npmPack(args, cwd) {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-npm-pack-cache-'));
  try {
    const result = spawnSync('npm', ['pack', '--ignore-scripts', ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: cache },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return JSON.parse(result.stdout)[0];
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
}

function packedInventory(tarball) {
  const result = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((entry) => entry.replace(/^package\//, '').replace(/\/$/, ''))
    .filter(Boolean)
    .sort();
}

function assertCleanInventory(inventory) {
  assert.deepEqual(inventory, [...inventory].sort(), 'package inventory must be sorted');
  assert.equal(new Set(inventory).size, inventory.length, 'package inventory must not contain duplicates');
  for (const required of REQUIRED_PAYLOAD) assert.ok(inventory.includes(required), `missing payload: ${required}`);
  for (const entry of inventory) {
    for (const pattern of FORBIDDEN_PAYLOAD) {
      assert.doesNotMatch(entry, pattern, `forbidden generated payload: ${entry}`);
    }
  }
}

function packageDirectory(name, from) {
  let directory = path.dirname(require.resolve(name, { paths: [from] }));
  while (directory !== path.dirname(directory)) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (metadata.name === name) return { directory, metadata };
    }
    directory = path.dirname(directory);
  }
  throw new Error(`cannot resolve local runtime dependency ${name}`);
}

function packedRuntimeClosure(destination) {
  fs.mkdirSync(destination, { recursive: true });
  const rootManifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  const queue = Object.keys(rootManifest.dependencies || {});
  const visited = new Set();
  const tarballs = [];
  while (queue.length > 0) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);
    const resolved = packageDirectory(name, PACKAGE_ROOT);
    const packed = npmPack(['--ignore-scripts', '--pack-destination', destination, '--json'], resolved.directory);
    tarballs.push(path.join(destination, packed.filename));
    queue.push(...Object.keys(resolved.metadata.dependencies || {}));
  }
  return tarballs.sort();
}

function installPacked(tarball, root, runtimeClosure) {
  fs.mkdirSync(root, { recursive: true });
  const result = spawnSync('npm', [
    'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    '--package-lock=false', '--prefix', root, tarball, ...runtimeClosure,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: path.join(root, '.cafekit-npm-cache') },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const installer = path.join(root, 'node_modules', '@haposoft', 'cafekit', 'bin', 'install.js');
  assert.ok(fs.existsSync(installer), 'npm install must resolve packed package bin');
  return installer;
}

function runInstaller(installer, root, platforms, lang, extraArgs = []) {
  const args = ['--platform', platforms.join(','), '--yes', ...extraArgs];
  if (lang) args.push('--lang', lang);
  const result = spawnSync(process.execPath, [installer, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, HOME: path.join(root, 'home'), PATH: '/usr/bin:/bin' },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result;
}

function installedRoutingRuleFiles(project, platform) {
  const runtimeRoot = platform === 'codex' ? '.codex' : '.claude';
  return {
    workflow: path.join(project, runtimeRoot, 'rules/skill-workflow-routing.md'),
    domain: path.join(project, runtimeRoot, 'rules/skill-domain-routing.md'),
  };
}

function routingRuleIssues(files) {
  const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [
    key, fs.readFileSync(file, 'utf8').replace(/\s+/g, ' '),
  ]));
  const issues = new Set();
  const requires = (issue, clauses) => {
    if (clauses.some(([source, clause]) => !text[source].includes(clause))) issues.add(issue);
  };
  requires('rule-direct-path', [
    ['workflow', 'If the user names a valid installed skill, use it directly'],
    ['workflow', 'If one obvious low-risk installed skill covers the intent, use it directly'],
    ['workflow', 'do not spawn agents for ceremony'],
  ]);
  requires('rule-live-catalog', [
    ['workflow', 'Resolve every abstract link against the current runtime catalog'],
    ['domain', 'examples below are intent hints, not a copied installed inventory'],
  ]);
  requires('rule-installed-only', [
    ['domain', 'document/artifact work | use only a matching installed optional capability'],
    ['domain', 'Never infer an optional document capability from this rule'],
  ]);
  requires('rule-duplicate', [
    ['domain', 'do not auto-route; require explicit user disambiguation'],
  ]);
  requires('authority', [
    ['workflow', 'Diagnosis does not authorize repair'],
    ['workflow', 'implementation does not authorize commit, push, deploy, publish, or release'],
    ['workflow', "no route expands the user's existing authority"],
  ]);

  const corpus = Object.values(text).join(' ').toLowerCase();
  const issueIf = (issue, pattern) => { if (pattern.test(corpus)) issues.add(issue); };
  issueIf('authority', /(?:successful review permits push|implementation authorizes (?:push|deploy)|diagnosis authorizes repair)/);
  issueIf('authority', /(?<!no )(?:live catalog|route)(?:(?!\b(?:never|not|cannot|can't)\b).){0,40}(?:grants|expands)(?:(?!\b(?:no|never|not|cannot|can't)\b).){0,30}(?:mutation|delivery|user )?authority/);
  issueIf('rule-direct-path', /always invoke route for explicit installed skills[^.]*obvious low-risk[^.]*factual/);
  issueIf('rule-live-catalog', /(?<!never )treat examples as installed inventory/);
  issueIf('rule-installed-only', /(?<!never )invoke (?:the )?(?:docs|document) capability even when (?:absent|not installed|unavailable)/);
  issueIf('rule-duplicate', /(?<!never )automatically (?:choose|select|route to) the first duplicate/);
  return [...issues].sort();
}

function markdownTableUnderHeading(content, heading) {
  const lines = markdownSectionUnderHeading(content, heading).split('\n');
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

function markdownSectionUnderHeading(content, heading) {
  const lines = String(content).split('\n');
  const headingIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (headingIndex < 0) return '';
  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && /^##\s+/.test(line)
  );
  return lines.slice(headingIndex + 1, nextHeadingIndex < 0 ? undefined : nextHeadingIndex).join('\n');
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

function parseGeneratedTomlString(content, key) {
  const matches = String(content).match(new RegExp(`^${key} = (.+)$`, 'gm')) || [];
  assert.equal(matches.length, 1, `expected one TOML key: ${key}`);
  return JSON.parse(matches[0].slice(`${key} = `.length));
}

function rewriteGeneratedTomlString(content, key, value) {
  const matches = String(content).match(new RegExp(`^${key} = (.+)$`, 'gm')) || [];
  assert.equal(matches.length, 1, `expected one TOML key to rewrite: ${key}`);
  return String(content).replace(matches[0], `${key} = ${JSON.stringify(value)}`);
}

function implementationReadinessContractIssues(input) {
  const keys = input && typeof input === 'object' && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (keys.join(',') !== 'review,templates'
    || typeof input.templates !== 'string' || typeof input.review !== 'string') {
    throw new TypeError('implementation-readiness checker expects exactly templates and review UTF-8 strings');
  }

  const issues = new Set();
  const authoring = markdownSectionUnderHeading(
    input.templates,
    'No-invention and conditional boundary contracts'
  );
  if (!authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.noInvention)) {
    issues.add('no-invention');
  }
  const contradictoryNoInvention = /\b(?:exception|however)\b.{0,160}\bimplementation handoff\b.{0,80}\b(?:may|can)\s+(?:proceed|continue)\b.{0,160}\bunresolved\b/i;
  if (contradictoryNoInvention.test(normalizeMarkdownWhitespace(authoring))) {
    issues.add('no-invention');
  }

  const boundaryTable = markdownTableUnderHeading(
    input.templates,
    'No-invention and conditional boundary contracts'
  );
  if (!authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.materialDefinition)
    || !authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.exactBoundaryChoices)
    || IMPLEMENTATION_READINESS_BOUNDARY_ROWS.length !== 9
    || !boundaryTableHasRequiredRows(boundaryTable)) {
    issues.add('boundary-contract');
  }

  const proof = markdownSectionUnderHeading(input.templates, 'Verification Plan');
  const proofPlanLines = proof.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('- '));
  const normalizedProofContract = normalizeMarkdownWhitespace(markdownBetweenHeadings(
    input.templates,
    'Verification Plan',
    'Canonical inline Receipt'
  ));
  const normalizedProofClauses = [
    IMPLEMENTATION_READINESS_CLAUSES.proofTrace,
    IMPLEMENTATION_READINESS_CLAUSES.namedProbeOwnership,
    IMPLEMENTATION_READINESS_CLAUSES.proofLevelSeparation,
    IMPLEMENTATION_READINESS_CLAUSES.disposableTemplateControls,
    IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping,
  ].map(normalizeMarkdownWhitespace);
  const reviewNegativeControls = normalizeMarkdownWhitespace(
    markdownSectionUnderHeading(input.review, 'B2 — fresh-context red team')
  );
  if (JSON.stringify(proofPlanLines) !== JSON.stringify(IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines)
    || normalizedProofClauses.some((clause) => !normalizedProofContract.includes(clause))
    || !reviewNegativeControls.includes(normalizeMarkdownWhitespace(
      IMPLEMENTATION_READINESS_CLAUSES.disposableReviewControls
    ))) {
    issues.add('proof-chain');
  }

  const failureGuidance = markdownSectionUnderHeading(input.templates, 'Twelve edge-case dimensions');
  if (!failureGuidance.includes(IMPLEMENTATION_READINESS_CLAUSES.failureSemantics)) {
    issues.add('failure-semantics');
  }

  const evidenceRules = markdownSectionUnderHeading(input.review, 'B1 — evidence rule');
  if (!evidenceRules.includes(IMPLEMENTATION_READINESS_CLAUSES.privacyIdentifiers)) {
    issues.add('privacy-identifiers');
  }

  const closure = markdownSectionUnderHeading(input.review, 'Accepted-repair closure');
  const normalizedClosure = normalizeMarkdownWhitespace(closure);
  const closureHeader = markdownTableUnderHeading(input.review, 'Accepted-repair closure')[0] || [];
  if (JSON.stringify(closureHeader) !== JSON.stringify([
    'ID', 'Decision', 'Original counterexample', 'Repaired at', 'Proved at', 'Replay', 'Closure',
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

function adaptiveCoverageContractIssues(input) {
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
    ADAPTIVE_COVERAGE_CLAUSES.independentSubsystem,
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

  const boundaryTable = markdownTableUnderHeading(input.templates, 'No-invention and conditional boundary contracts');
  if (!boundaryTableHasRequiredRows(boundaryTable)) {
    issues.add('adaptive-boundary-lenses');
  }
  return [...issues].sort();
}

function installedSpecsReadinessIssues(project, installedRoot, expectedRelative) {
  assert.equal(path.isAbsolute(project), true, 'project root must be absolute');
  assert.equal(path.isAbsolute(installedRoot), true, 'installed Specs root must be absolute');
  const canonicalProject = fs.realpathSync(project);
  const canonicalInstalled = fs.realpathSync(installedRoot);
  const relative = path.relative(canonicalProject, canonicalInstalled);
  assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'installed Specs root must stay inside project');
  assert.equal(canonicalInstalled, fs.realpathSync(path.join(canonicalProject, expectedRelative)), 'checker must use the native installed Specs root');
  return implementationReadinessContractIssues({
    templates: fs.readFileSync(path.join(canonicalInstalled, 'references/templates.md'), 'utf8'),
    review: fs.readFileSync(path.join(canonicalInstalled, 'references/review.md'), 'utf8'),
  });
}

function assertInstalledSpecsReadiness(project, platform, expected = []) {
  const runtime = RUNTIMES[platform];
  assert.ok(runtime, `unknown platform: ${platform}`);
  const installedRoot = path.join(project, runtime.specs);
  const issues = installedSpecsReadinessIssues(project, installedRoot, runtime.specs);
  assert.deepEqual(issues, expected, `${platform} installed Specs readiness issues`);
  return issues;
}

function adaptiveInstalledPaths(project, platform) {
  const runtime = RUNTIMES[platform];
  assert.ok(runtime, `unknown platform: ${platform}`);
  return {
    skill: path.join(project, runtime.specs, 'SKILL.md'),
    specMaker: path.join(project, runtime.specMaker),
    templates: path.join(project, runtime.specs, 'references/templates.md'),
    review: path.join(project, runtime.specs, 'references/review.md'),
  };
}

function installedAdaptiveCoverageSources(project, platform) {
  const installedPaths = adaptiveInstalledPaths(project, platform);
  const sources = Object.fromEntries(
    Object.entries(installedPaths).map(([source, target]) => [source, fs.readFileSync(target, 'utf8')])
  );
  if (platform === 'codex') {
    sources.specMaker = parseGeneratedTomlString(sources.specMaker, 'developer_instructions');
  }
  return sources;
}

function assertInstalledAdaptiveCoverage(project, platform, expected = []) {
  const issues = adaptiveCoverageContractIssues(installedAdaptiveCoverageSources(project, platform));
  assert.deepEqual(issues, expected, `${platform} installed adaptive Specs issues`);
  return issues;
}

function assertPackedAdaptiveParity(project, platform) {
  const installedPaths = adaptiveInstalledPaths(project, platform);
  for (const [source, sourceRelative] of Object.entries(ADAPTIVE_SOURCE_RELATIVES)) {
    const sourcePath = path.join(PACKAGE_ROOT, sourceRelative);
    const sourceBytes = fs.readFileSync(sourcePath);
    let expectedBytes = sourceBytes;
    if (platform === 'codex') {
      const sourceText = sourceBytes.toString('utf8');
      expectedBytes = Buffer.from(source === 'specMaker'
        ? convertCodexAgentContent(sourceText, path.basename(sourcePath))
        : normalizeCodexBody(sourceText, sourcePath));
    }
    assert.deepEqual(
      fs.readFileSync(installedPaths[source]),
      expectedBytes,
      `${platform} installed ${source} must equal its exact production projection`
    );
  }
  assertInstalledSpecsReadiness(project, platform);
  assertInstalledAdaptiveCoverage(project, platform);
}

function assertPackedBrainstormParity(project, platform) {
  const installedRelatives = platform === 'codex'
    ? {
        skill: '.agents/skills/brainstorm/SKILL.md',
        framework: '.agents/skills/brainstorm/references/question-framework.md',
        agent: '.codex/agents/brainstormer.toml',
      }
    : {
        skill: '.claude/skills/brainstorm/SKILL.md',
        framework: '.claude/skills/brainstorm/references/question-framework.md',
        agent: '.claude/agents/brainstormer.md',
      };

  for (const [source, sourceRelative] of Object.entries(BRAINSTORM_SOURCE_RELATIVES)) {
    const sourcePath = path.join(PACKAGE_ROOT, sourceRelative);
    const sourceText = fs.readFileSync(sourcePath, 'utf8');
    const expected = platform === 'codex'
      ? (source === 'agent'
          ? convertCodexAgentContent(sourceText, path.basename(sourcePath))
          : normalizeCodexBody(sourceText, sourcePath))
      : sourceText;
    const installedPath = path.join(project, installedRelatives[source]);
    assert.equal(
      fs.readFileSync(installedPath, 'utf8'),
      expected,
      `${platform} packed Brainstorm ${source} must equal its exact production projection`
    );
  }
}

function packedResearchPaths(project, platform) {
  return platform === 'codex'
    ? {
        research: path.join(project, '.agents/skills/research/SKILL.md'),
        agent: path.join(project, '.codex/agents/researcher.toml'),
        workflow: path.join(project, '.codex/rules/skill-workflow-routing.md'),
        domain: path.join(project, '.codex/rules/skill-domain-routing.md'),
      }
    : {
        research: path.join(project, '.claude/skills/research/SKILL.md'),
        agent: path.join(project, '.claude/agents/researcher.md'),
        workflow: path.join(project, '.claude/rules/skill-workflow-routing.md'),
        domain: path.join(project, '.claude/rules/skill-domain-routing.md'),
      };
}

function readPackedResearch(project, platform) {
  const paths = packedResearchPaths(project, platform);
  const values = Object.fromEntries(Object.entries(paths).map(([key, target]) => [
    key, fs.readFileSync(target, 'utf8'),
  ]));
  if (platform === 'codex') {
    values.agent = parseGeneratedTomlString(values.agent, 'developer_instructions');
  }
  return values;
}

function packedResearchIssues(project, platform) {
  const values = Object.fromEntries(Object.entries(readPackedResearch(project, platform)).map(
    ([key, value]) => [key, value.replace(/\s+/g, ' ').trim()]
  ));
  const issues = new Set();
  const publicResearch = platform === 'codex' ? 'name: cf-research' : 'name: cf:research';
  if (!values.research.includes(publicResearch)
    || !values.research.includes('Choose the smallest depth that can support the decision:')
    || !values.research.includes('Use delegated researchers only as optional acceleration')
    || !values.research.includes('research sequentially with the same evidence bar.')
    || !values.research.includes('Default to a concise answer in chat.')
    || !values.research.includes('claim, URL or repository anchor, authority, date/version, applicability to this project')) {
    issues.add('research-adaptive-evidence');
  }
  if (!values.agent.includes('do not implement code, write files, mutate task state, ask the user directly, or launch another workflow.')
    || !values.agent.includes('owns any authorized persistence.')) {
    issues.add('research-agent-boundary');
  }
  if (/numeric optimization capability/.test(`${values.workflow}\n${values.domain}`)) {
    issues.add('loop-removed');
  }
  return [...issues].sort();
}

function assertPackedResearchParity(project, platform) {
  const installed = packedResearchPaths(project, platform);
  for (const [key, relative] of Object.entries(RESEARCH_SOURCE_RELATIVES)) {
    const sourcePath = path.join(PACKAGE_ROOT, relative);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const expected = platform === 'codex'
      ? (key === 'agent'
          ? convertCodexAgentContent(source, path.basename(sourcePath))
          : normalizeCodexBody(source, sourcePath))
      : source;
    assert.equal(fs.readFileSync(installed[key], 'utf8'), expected, `${platform} ${key} projection drifted`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(project, RUNTIMES[platform].manifest), 'utf8'));
  const prefixes = platform === 'codex'
    ? ['.agents/skills/research/']
    : ['skills/research/'];
  for (const prefix of prefixes) {
    assert.ok(Object.keys(manifest.files).some((entry) => entry.startsWith(prefix)), `${platform} manifest missing ${prefix}`);
  }
  const removedLoop = platform === 'codex' ? '.agents/skills/loop/' : 'skills/loop/';
  assert.equal(Object.keys(manifest.files).some((entry) => entry.startsWith(removedLoop)), false, `${platform} manifest still lists ${removedLoop}`);
  assert.equal(fs.existsSync(path.join(project, platform === 'codex' ? '.agents/skills/loop' : '.claude/skills/loop')), false, `${platform} still installs Loop`);
  assert.deepEqual(packedResearchIssues(project, platform), []);
}

function packedBrainstormInstalledPaths(project, platform) {
  return platform === 'codex'
    ? {
        skill: path.join(project, '.agents/skills/brainstorm/SKILL.md'),
        framework: path.join(project, '.agents/skills/brainstorm/references/question-framework.md'),
        agent: path.join(project, '.codex/agents/brainstormer.toml'),
      }
    : {
        skill: path.join(project, '.claude/skills/brainstorm/SKILL.md'),
        framework: path.join(project, '.claude/skills/brainstorm/references/question-framework.md'),
        agent: path.join(project, '.claude/agents/brainstormer.md'),
      };
}

function packedAdaptiveBrainstormIssues(project, platform) {
  const skill = fs.readFileSync(packedBrainstormInstalledPaths(project, platform).skill, 'utf8')
    .replace(/\s+/g, ' ').trim();
  return ADAPTIVE_BRAINSTORM_INSTALLED_RULES
    .filter(({ mutations }) => mutations.some(({ clause }) => !skill.includes(clause)))
    .map(({ group }) => group)
    .sort();
}

function assertPackedAdaptiveBrainstormMutations(project, platform, canonicalBytes) {
  const installedScope = platform === 'codex'
    ? path.join(project, '.agents/skills/brainstorm')
    : path.join(project, '.claude/skills/brainstorm');
  const target = packedBrainstormInstalledPaths(project, platform).skill;
  assertContainedRealpath(project, installedScope, `${platform} Brainstorm installed scope`);
  const targetLstat = fs.lstatSync(target);
  assert.equal(targetLstat.isSymbolicLink(), false, `${platform} mutation target must not be a symlink`);
  assert.equal(targetLstat.isFile(), true, `${platform} mutation target must be a regular file`);
  const canonicalTarget = assertContainedRealpath(installedScope, target, `${platform} Brainstorm mutation target`);
  assert.equal(
    canonicalTarget,
    assertContainedRealpath(project, target, `${platform} Brainstorm project mutation target`),
    `${platform} scope and project containment must resolve to the same target`
  );
  const targetStat = fs.statSync(canonicalTarget);
  assert.equal(targetStat.nlink, 1, `${platform} mutation target must have exactly one hard link`);
  for (const sourcePath of canonicalBytes.keys()) {
    const canonicalSource = fs.realpathSync(sourcePath);
    const sourceStat = fs.statSync(canonicalSource);
    assert.notEqual(canonicalTarget, canonicalSource, `${platform} mutation target must not resolve to canonical source`);
    assert.notDeepEqual(
      [targetStat.dev, targetStat.ino],
      [sourceStat.dev, sourceStat.ino],
      `${platform} mutation target must not share a canonical source inode`
    );
  }
  const original = fs.readFileSync(target);
  const exercised = new Set();
  assert.deepEqual(packedAdaptiveBrainstormIssues(project, platform), []);
  for (const rule of ADAPTIVE_BRAINSTORM_INSTALLED_RULES) {
    assert.ok(rule.mutations.length > 0, `${platform}/${rule.group} must contain at least one mutation`);
    let completedMutations = 0;
    for (const mutation of rule.mutations) {
      const content = original.toString('utf8');
      const anchor = content.indexOf(mutation.from);
      assert.ok(anchor >= 0, `${platform}/${rule.group} anchor must exist`);
      assert.equal(content.indexOf(mutation.from, anchor + mutation.from.length), -1, `${platform}/${rule.group} anchor must be unique`);
      try {
        fs.writeFileSync(target, `${content.slice(0, anchor)}${mutation.to}${content.slice(anchor + mutation.from.length)}`);
        assert.deepEqual(packedAdaptiveBrainstormIssues(project, platform), [rule.group]);
        for (const [sourcePath, expected] of canonicalBytes) assert.deepEqual(fs.readFileSync(sourcePath), expected);
      } finally {
        fs.writeFileSync(target, original);
      }
      assert.deepEqual(fs.readFileSync(target), original, `${platform}/${rule.group} installed bytes restored`);
      completedMutations += 1;
    }
    assert.ok(completedMutations > 0, `${platform}/${rule.group} must execute at least one mutation`);
    exercised.add(`${platform}:${rule.group}`);
  }
  return exercised;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function assertContainedRealpath(root, target, label) {
  const canonicalRoot = fs.realpathSync(root);
  const canonicalTarget = fs.realpathSync(target);
  const relative = path.relative(canonicalRoot, canonicalTarget);
  assert.ok(
    relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    `${label} must stay inside ${canonicalRoot}`
  );
  return canonicalTarget;
}

function installedMutationContext(tempRoot, project, platform, packageRoot = PACKAGE_ROOT) {
  const runtime = RUNTIMES[platform];
  assert.ok(runtime, `unknown platform: ${platform}`);
  const canonicalTempRoot = assertContainedRealpath(os.tmpdir(), tempRoot, `${platform} mkdtemp root`);
  assert.match(path.basename(canonicalTempRoot), /^cafekit-package-matrix-/, `${platform} mutation root must be the verified matrix mkdtemp`);
  const canonicalProject = assertContainedRealpath(canonicalTempRoot, project, `${platform} packed project`);
  const installedRelatives = {
    skill: path.join(runtime.specs, 'SKILL.md'),
    specMaker: runtime.specMaker,
    templates: 'references/templates.md',
    review: 'references/review.md',
  };
  installedRelatives.templates = path.join(runtime.specs, installedRelatives.templates);
  installedRelatives.review = path.join(runtime.specs, installedRelatives.review);
  const installedPaths = Object.fromEntries(
    Object.entries(installedRelatives).map(([source, relative]) => [source, path.join(canonicalProject, relative)])
  );
  const sourcePaths = Object.fromEntries(
    Object.entries(ADAPTIVE_SOURCE_RELATIVES)
      .map(([source, relative]) => [source, path.join(packageRoot, relative)])
  );
  for (const source of Object.keys(sourcePaths)) sourcePaths[source] = fs.realpathSync(sourcePaths[source]);
  const sourceHashes = Object.fromEntries(
    Object.entries(sourcePaths).map(([source, sourcePath]) => [source, sha256(fs.readFileSync(sourcePath))])
  );
  const assertSourceHashes = (stage) => {
    for (const source of Object.keys(sourcePaths)) {
      assert.equal(
        sha256(fs.readFileSync(sourcePaths[source])),
        sourceHashes[source],
        `${platform} PACKAGE_ROOT ${source} SHA changed ${stage}`
      );
    }
  };
  const assertSafeInstalledTarget = (source, stage) => {
    assert.ok(Object.hasOwn(installedPaths, source), `${platform} unknown installed mutation source: ${source}`);
    assertSourceHashes(`before ${stage}`);

    const currentTempRoot = assertContainedRealpath(os.tmpdir(), tempRoot, `${platform} ${stage} mkdtemp root`);
    assert.equal(currentTempRoot, canonicalTempRoot, `${platform} ${stage} mutation root changed`);
    const currentProject = assertContainedRealpath(currentTempRoot, project, `${platform} ${stage} packed project`);
    assert.equal(currentProject, canonicalProject, `${platform} ${stage} packed project changed`);

    const target = installedPaths[source];
    const targetMetadata = fs.lstatSync(target);
    assert.equal(
      targetMetadata.isSymbolicLink(),
      false,
      `${platform} ${stage} target must be a regular non-symlink file`
    );
    assert.equal(targetMetadata.isFile(), true, `${platform} ${stage} target must be a regular non-symlink file`);
    const canonicalTarget = assertContainedRealpath(
      currentProject,
      target,
      `${platform} ${stage} installed ${source} mutation target`
    );
    assert.equal(
      canonicalTarget,
      path.join(currentProject, installedRelatives[source]),
      `${platform} ${stage} target must remain at its exact native installed path`
    );
    assert.notEqual(canonicalTarget, sourcePaths[source], `${platform} ${stage} target must not be package source`);

    const installedIdentity = fs.statSync(target);
    for (const [protectedSource, protectedSourcePath] of Object.entries(sourcePaths)) {
      const sourceIdentity = fs.statSync(protectedSourcePath);
      assert.ok(
        installedIdentity.dev !== sourceIdentity.dev || installedIdentity.ino !== sourceIdentity.ino,
        `${platform} ${stage} target must not share (dev, ino) with any package source: ${protectedSource}`
      );
    }
    assert.equal(
      installedIdentity.nlink,
      1,
      `${platform} ${stage} target must have exactly one hard link`
    );
    return target;
  };
  const writeInstalled = (source, content, stage) => {
    const target = assertSafeInstalledTarget(source, stage);
    fs.writeFileSync(target, content);
    assertSourceHashes(`immediately after ${stage}`);
  };
  for (const source of Object.keys(installedPaths)) {
    assertSafeInstalledTarget(source, `${source} context creation`);
  }
  return { installedPaths, sourcePaths, assertSafeInstalledTarget, writeInstalled, assertSourceHashes };
}

test('installed mutation guard rejects post-context symlink and hardlink before source bytes change', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-package-matrix-'));
  const trackedSources = Object.fromEntries(
    Object.entries(ADAPTIVE_SOURCE_RELATIVES)
      .map(([source, relative]) => [source, path.join(PACKAGE_ROOT, relative)])
  );
  const trackedHashes = Object.fromEntries(
    Object.entries(trackedSources).map(([source, sourcePath]) => [source, sha256(fs.readFileSync(sourcePath))])
  );
  try {
    for (const topology of ['symlink', 'hardlink']) {
      for (const source of Object.keys(ADAPTIVE_SOURCE_RELATIVES)) {
        const packageRoot = path.join(root, `${topology}-${source}-package-source`);
        const project = path.join(root, `${topology}-${source}-project`);
        for (const [fixtureSource, relative] of Object.entries(ADAPTIVE_SOURCE_RELATIVES)) {
          const sourcePath = path.join(packageRoot, relative);
          fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
          fs.writeFileSync(sourcePath, `${topology} disposable source ${fixtureSource}\n`);
        }
        for (const [fixtureSource, installedPath] of Object.entries(adaptiveInstalledPaths(project, 'claude'))) {
          fs.mkdirSync(path.dirname(installedPath), { recursive: true });
          fs.writeFileSync(installedPath, `${topology} disposable installed ${fixtureSource}\n`);
        }

        const context = installedMutationContext(root, project, 'claude', packageRoot);
        const sourcePath = context.sourcePaths[source];
        const target = context.installedPaths[source];
        const sourceBytes = fs.readFileSync(sourcePath);
        const sourceHash = sha256(sourceBytes);
        fs.unlinkSync(target);
        if (topology === 'symlink') {
          fs.symlinkSync(sourcePath, target);
          assert.equal(fs.lstatSync(target).isSymbolicLink(), true, 'symlink control must change target topology');
        } else {
          fs.linkSync(sourcePath, target);
          const sourceIdentity = fs.statSync(sourcePath);
          const installedIdentity = fs.statSync(target);
          assert.deepEqual(
            [installedIdentity.dev, installedIdentity.ino],
            [sourceIdentity.dev, sourceIdentity.ino],
            'hardlink control must share source identity'
          );
        }

        assert.throws(
          () => context.writeInstalled(source, 'forbidden installed mutation\n', `${topology} regression`),
          topology === 'symlink' ? /regular non-symlink file/ : /must not share \(dev, ino\)/
        );
        assert.deepEqual(fs.readFileSync(sourcePath), sourceBytes, `${topology} rejection must preserve source bytes`);
        assert.equal(sha256(fs.readFileSync(sourcePath)), sourceHash, `${topology} rejection must preserve source SHA`);
        context.assertSourceHashes(`after rejected ${topology} write`);
      }
    }

    const crossSourcePackageRoot = path.join(root, 'cross-source-package-source');
    const crossSourceProject = path.join(root, 'cross-source-project');
    for (const [source, relative] of Object.entries(ADAPTIVE_SOURCE_RELATIVES)) {
      const sourcePath = path.join(crossSourcePackageRoot, relative);
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, `cross-source disposable source ${source}\n`);
    }
    for (const [source, installedPath] of Object.entries(adaptiveInstalledPaths(crossSourceProject, 'claude'))) {
      fs.mkdirSync(path.dirname(installedPath), { recursive: true });
      fs.writeFileSync(installedPath, `cross-source disposable installed ${source}\n`);
    }
    const crossSourceContext = installedMutationContext(
      root,
      crossSourceProject,
      'claude',
      crossSourcePackageRoot
    );
    const targetSource = 'skill';
    const linkedSource = 'specMaker';
    assert.notEqual(targetSource, linkedSource, 'cross-source control requires A != B');
    const crossSourceTarget = crossSourceContext.installedPaths[targetSource];
    const crossSourceTargetBytes = fs.readFileSync(crossSourceTarget);
    const crossSourceState = Object.fromEntries(
      Object.entries(crossSourceContext.sourcePaths).map(([source, sourcePath]) => {
        const bytes = fs.readFileSync(sourcePath);
        return [source, { bytes, sha: sha256(bytes) }];
      })
    );
    fs.unlinkSync(crossSourceTarget);
    fs.linkSync(crossSourceContext.sourcePaths[linkedSource], crossSourceTarget);
    try {
      assert.throws(
        () => crossSourceContext.writeInstalled(
          targetSource,
          'forbidden packed cross-source mutation\n',
          'cross-source hardlink regression'
        ),
        /must not share \(dev, ino\) with any package source: specMaker/
      );
    } finally {
      fs.unlinkSync(crossSourceTarget);
      fs.writeFileSync(crossSourceTarget, crossSourceTargetBytes);
      fs.writeFileSync(
        crossSourceContext.sourcePaths[linkedSource],
        crossSourceState[linkedSource].bytes
      );
    }
    assert.deepEqual(
      fs.readFileSync(crossSourceTarget),
      crossSourceTargetBytes,
      'cross-source control must restore exact installed bytes'
    );
    for (const [source, sourcePath] of Object.entries(crossSourceContext.sourcePaths)) {
      const actual = fs.readFileSync(sourcePath);
      assert.deepEqual(actual, crossSourceState[source].bytes, `cross-source rejection must preserve ${source} bytes`);
      assert.equal(sha256(actual), crossSourceState[source].sha, `cross-source rejection must preserve ${source} SHA`);
    }
    crossSourceContext.assertSourceHashes('after rejected cross-source hardlink write');

    for (const [source, sourcePath] of Object.entries(trackedSources)) {
      assert.equal(
        sha256(fs.readFileSync(sourcePath)),
        trackedHashes[source],
        `tracked PACKAGE_ROOT ${source} SHA must remain unchanged`
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function assertInstalledReadinessMutationsDetected(tempRoot, project, platform) {
  const context = installedMutationContext(tempRoot, project, platform);
  const baselineBytes = Object.fromEntries(
    Object.entries(context.installedPaths).map(([source, target]) => [source, fs.readFileSync(target)])
  );
  const baseline = Object.fromEntries(
    Object.entries(baselineBytes).map(([source, bytes]) => [source, bytes.toString('utf8')])
  );
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
      name, issue: 'boundary-contract', source: 'templates',
      from: `| ${row[0]} | ${row[1]} |`,
      to: `| ${row[0]} | ${weakened} |`,
    };
  };
  const mutations = [
    {
      name: 'no-invention-blocking', issue: 'no-invention', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.noInvention,
      to: 'Before implementation handoff, note ambiguous choices without blocking handoff.',
    },
    {
      name: 'no-invention-contradictory-override', issue: 'no-invention', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.noInvention,
      to: `${IMPLEMENTATION_READINESS_CLAUSES.noInvention}\n\nException: implementation handoff may proceed with an unresolved material choice.`,
    },
    {
      name: 'material-boundary-definition', issue: 'boundary-contract', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.materialDefinition,
      to: 'A boundary is material when it seems relevant to the task.',
    },
    {
      name: 'exact-boundary-choices', issue: 'boundary-contract', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.exactBoundaryChoices,
      to: 'For every required row, describe the listed choices generally.',
    },
    boundaryMutation('interaction-accessibility', 'Interaction/UI', [
      ['input/focus/keyboard; ', ''],
      ['accessibility; ', ''],
    ]),
    boundaryMutation('api-success-and-error-semantics', 'API/CLI', [
      ['success output; ', ''],
      ['error/status/exit; ', ''],
    ]),
    boundaryMutation('schema-shape-and-unknown-fields', 'Data/schema', [
      ['exact keys/nesting/types; ', ''],
      ['unknown-field behavior; ', ''],
    ]),
    boundaryMutation('schema-enum-and-format', 'Data/schema', [
      ['enum/format/', ''],
    ]),
    boundaryMutation('state-lock-lifecycle', 'Async/state', [
      ['writer/lock acquire/contention/release; ', 'writer/lock; '],
    ]),
    boundaryMutation('filesystem-segment-grammar', 'Filesystem/security', [
      ['trusted/untrusted segment grammar; ', ''],
    ]),
    boundaryMutation('filesystem-stale-lock-reclaim', 'Filesystem/security', [
      ['lock/stale reclaim; ', ''],
    ]),
    boundaryMutation('runtime-rollout-and-recovery', 'Runtime/deploy', [
      ['rollout/rollback; ', ''],
      ['operator recovery', ''],
    ]),
    boundaryMutation('retention-clock-and-endpoints', 'Time/retention', [
      ['clock source; ', ''],
      ['unit/precision/timezone; ', ''],
      ['endpoints and inclusion/comparator; ', ''],
    ]),
    boundaryMutation('ai-model-safety-and-eval', 'AI/model', [
      ['safety/privacy; ', ''],
      ['eval oracle', ''],
    ]),
    boundaryMutation('proof-level-partition', 'Integration/proof', [
      ['proof level (`source`/`installed`/`live`)', 'proof level'],
    ]),
    {
      name: 'concrete-named-probe', issue: 'proof-chain', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[1],
      to: '- Named probe: <suite label>',
    },
    {
      name: 'aggregate-suite-probe-owner', issue: 'proof-chain', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.namedProbeOwnership,
      to: 'Aggregate suites may cite only the suite label.',
    },
    {
      name: 'reachability-levels', issue: 'proof-chain', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[2],
      to: '- Reachability: <entrypoint or consumer>',
    },
    {
      name: 'proof-level-separation', issue: 'proof-chain', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofLevelSeparation,
      to: 'Proof may be promoted between source, installed, and live levels.',
    },
    {
      name: 'disposable-template-negative-controls', issue: 'proof-chain', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.disposableTemplateControls,
      to: 'Run mutation or destructive negative controls against the available project copy.',
    },
    {
      name: 'disposable-review-negative-controls', issue: 'proof-chain', source: 'review',
      from: IMPLEMENTATION_READINESS_CLAUSES.disposableReviewControls,
      to: 'Run mutation or destructive negative controls against the available project copy.',
    },
    {
      name: 'required-proof-level-mapping', issue: 'proof-chain', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping,
      to: 'Map one required proof level to one probe; other levels may remain implicit.',
    },
    {
      name: 'artifact-path-and-digest-or-ephemeral', issue: 'proof-chain', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[5],
      to: '- Artifacts: <required artifact path, or none>',
    },
    {
      name: 'proof-counterexample', issue: 'proof-chain', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[4],
      to: '- Counterexample: <example>',
    },
    {
      name: 'repair-and-proof-columns', issue: 'repair-closure', source: 'review',
      from: '| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |',
      to: '| ID | Decision | Original counterexample | Repaired at | Evidence | Replay | Closure |',
    },
    {
      name: 'fresh-original-counterexample-replay', issue: 'repair-closure', source: 'review',
      from: 'After applying an accepted GATE-REVIEW finding, a fresh-context closure pass records and\nfreshly replays its original counterexample after the repair under this exact review-log header:',
      to: 'After applying an accepted GATE-REVIEW finding, record the repair under this review-log header:',
    },
    {
      name: 'distinct-repair-and-proof-evidence', issue: 'repair-closure', source: 'review',
      from: IMPLEMENTATION_READINESS_CLAUSES.distinctRepairProof,
      to: '`Repaired at` and `Proved at` may cite the same repair edit.',
    },
    {
      name: 'unknown-blocks-handoff', issue: 'repair-closure', source: 'review',
      from: IMPLEMENTATION_READINESS_CLAUSES.unknownBlocks,
      to: '`PASS` closes it; `FAIL` and `UNKNOWN` may continue to implementation handoff.',
    },
    {
      name: 'crash-versus-catchable-failure', issue: 'failure-semantics', source: 'templates',
      from: IMPLEMENTATION_READINESS_CLAUSES.failureSemantics,
      to: 'Crash and catchable failure both mean an error occurred.',
    },
    {
      name: 'privacy-identifier-surface', issue: 'privacy-identifiers', source: 'review',
      from: IMPLEMENTATION_READINESS_CLAUSES.privacyIdentifiers,
      to: 'Any privacy/security claim names the sensitive data at risk.',
    },
  ];
  assert.equal(mutations.length, 30, `${platform} readiness mutation inventory drifted`);
  assertInstalledSpecsReadiness(project, platform);
  for (const mutation of mutations) {
    const anchorIndex = baseline[mutation.source].indexOf(mutation.from);
    assert.notEqual(anchorIndex, -1, `${platform} ${mutation.name} mutation anchor must exist`);
    assert.equal(
      baseline[mutation.source].indexOf(mutation.from, anchorIndex + mutation.from.length),
      -1,
      `${platform} ${mutation.name} mutation anchor must be unique`
    );
    const weakened = `${baseline[mutation.source].slice(0, anchorIndex)}${mutation.to}${baseline[mutation.source].slice(anchorIndex + mutation.from.length)}`;
    try {
      context.writeInstalled(mutation.source, weakened, `${mutation.name} mutation`);
      assertInstalledSpecsReadiness(project, platform, [mutation.issue]);
    } finally {
      context.writeInstalled(mutation.source, baselineBytes[mutation.source], `${mutation.name} restoration`);
    }
    assert.deepEqual(
      fs.readFileSync(context.installedPaths[mutation.source]),
      baselineBytes[mutation.source],
      `${platform} ${mutation.name} must restore exact installed bytes`
    );
    assertInstalledSpecsReadiness(project, platform);
  }

  const integrationRow = IMPLEMENTATION_READINESS_BOUNDARY_ROWS
    .find(([label]) => label === 'Integration/proof');
  const integrationLine = `| ${integrationRow.join(' | ')} |`;
  const openBoundary = baseline.templates.replace(
    integrationLine,
    `${integrationLine}\n| other:domain-specific | task-specific material choices and observable oracle |`
  );
  assert.notEqual(openBoundary, baseline.templates, `${platform} readiness positive control must apply`);
  try {
    context.writeInstalled('templates', openBoundary, 'readiness open-boundary positive control');
    assertInstalledSpecsReadiness(project, platform);
  } finally {
    context.writeInstalled('templates', baselineBytes.templates, 'readiness open-boundary restoration');
  }
  assert.deepEqual(
    fs.readFileSync(context.installedPaths.templates),
    baselineBytes.templates,
    `${platform} readiness positive control must restore exact installed bytes`
  );
  context.assertSourceHashes('after readiness mutations and positive control');
}

function assertInstalledAdaptiveMutationsDetected(tempRoot, project, platform) {
  const context = installedMutationContext(tempRoot, project, platform);
  const baselineBytes = Object.fromEntries(
    Object.entries(context.installedPaths).map(([source, target]) => [source, fs.readFileSync(target)])
  );
  const baseline = installedAdaptiveCoverageSources(project, platform);
  const mutations = [
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
      'Source/static checks prove live-model adherence.', ['proof-lifecycle']],
  ];
  assert.equal(mutations.length, 23, `${platform} adaptive mutation inventory drifted`);
  assertInstalledAdaptiveCoverage(project, platform);

  const renderMutation = (source, value) => {
    if (platform === 'codex' && source === 'specMaker') {
      return Buffer.from(rewriteGeneratedTomlString(
        baselineBytes.specMaker.toString('utf8'),
        'developer_instructions',
        value
      ));
    }
    return Buffer.from(value);
  };
  for (const [name, source, from, to, expected] of mutations) {
    const anchorIndex = baseline[source].indexOf(from);
    assert.notEqual(anchorIndex, -1, `${platform} ${name} mutation anchor must exist`);
    assert.equal(
      baseline[source].indexOf(from, anchorIndex + from.length),
      -1,
      `${platform} ${name} mutation anchor must be unique`
    );
    const weakened = `${baseline[source].slice(0, anchorIndex)}${to}${baseline[source].slice(anchorIndex + from.length)}`;
    const weakenedBytes = renderMutation(source, weakened);
    try {
      context.writeInstalled(source, weakenedBytes, `${name} adaptive mutation`);
      if (platform === 'codex' && source === 'specMaker') {
        assert.equal(
          parseGeneratedTomlString(fs.readFileSync(context.installedPaths.specMaker, 'utf8'), 'developer_instructions'),
          weakened,
          `${platform} ${name} must rewrite only parsed developer_instructions`
        );
      }
      assertInstalledAdaptiveCoverage(project, platform, [...expected].sort());
    } finally {
      context.writeInstalled(source, baselineBytes[source], `${name} adaptive restoration`);
    }
    assert.deepEqual(
      fs.readFileSync(context.installedPaths[source]),
      baselineBytes[source],
      `${platform} ${name} must restore exact installed bytes`
    );
    assertInstalledAdaptiveCoverage(project, platform);
  }

  const integrationRow = IMPLEMENTATION_READINESS_BOUNDARY_ROWS
    .find(([label]) => label === 'Integration/proof');
  const integrationLine = `| ${integrationRow.join(' | ')} |`;
  const validVariants = [
    ['open material surface', baseline.templates.replace(
      integrationLine,
      `${integrationLine}\n| other:domain-specific | task-specific material choices and observable oracle |`
    )],
    ['task CP reference requirement', baseline.templates.replace(
      ADAPTIVE_COVERAGE_CLAUSES.scopedUnion,
      `${ADAPTIVE_COVERAGE_CLAUSES.scopedUnion} Require every task to reference a CP row.`
    )],
  ];
  for (const [name, templates] of validVariants) {
    assert.notEqual(templates, baseline.templates, `${platform} ${name} positive control must apply`);
    try {
      context.writeInstalled('templates', Buffer.from(templates), `${name} adaptive positive control`);
      assertInstalledAdaptiveCoverage(project, platform);
    } finally {
      context.writeInstalled('templates', baselineBytes.templates, `${name} adaptive restoration`);
    }
    assert.deepEqual(
      fs.readFileSync(context.installedPaths.templates),
      baselineBytes.templates,
      `${platform} ${name} must restore exact installed bytes`
    );
  }
  assertInstalledSpecsReadiness(project, platform);
  context.assertSourceHashes('after adaptive mutations and positive controls');
}

function assertPristineUpgradeAndUserPreservation(installer, tempRoot, project, platform) {
  const runtime = RUNTIMES[platform];
  const context = installedMutationContext(tempRoot, project, platform);
  const templatesPath = context.installedPaths.templates;
  const manifestPath = path.join(project, runtime.manifest);
  const metadataPath = path.join(project, runtime.root, 'cafekit.json');
  const baseline = fs.readFileSync(templatesPath, 'utf8');
  const weakened = baseline.replace(NO_INVENTION_ANCHOR, '');
  assert.notEqual(weakened, baseline, `${platform} old fixture mutation must apply`);
  try {
    context.writeInstalled('templates', weakened, 'pristine-upgrade mutation');
    const oldManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.ok(oldManifest.files[runtime.templatesManifestPath], `${platform} templates ownership record missing`);
    oldManifest.files[runtime.templatesManifestPath] = {
      ...oldManifest.files[runtime.templatesManifestPath], sha256: sha256(weakened), version: OLD_FIXTURE_VERSION
    };
    writeJson(manifestPath, oldManifest);
    const oldMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    oldMetadata.version = OLD_FIXTURE_VERSION;
    writeJson(metadataPath, oldMetadata);

    runInstaller(installer, project, [platform], null);
    context.assertSourceHashes('immediately after pristine-upgrade installer');
    context.assertSafeInstalledTarget('templates', 'after pristine-upgrade installer');
    assert.equal(fs.readFileSync(templatesPath, 'utf8'), baseline, `${platform} pristine old gate must upgrade`);
    assert.equal(JSON.parse(fs.readFileSync(metadataPath, 'utf8')).version, PACKAGE_VERSION);
    const upgradedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(upgradedManifest.files[runtime.templatesManifestPath].sha256, sha256(baseline));
    assert.equal(upgradedManifest.files[runtime.templatesManifestPath].version, PACKAGE_VERSION);
    assertInstalledSpecsReadiness(project, platform);

    context.writeInstalled('templates', weakened, 'user-preservation mutation after installer');
    const manifestBeforePreservedRerun = fs.readFileSync(manifestPath, 'utf8');
    const preserved = runInstaller(installer, project, [platform], null);
    context.assertSourceHashes('immediately after user-preservation installer');
    context.assertSafeInstalledTarget('templates', 'after user-preservation installer');
    assert.equal(fs.readFileSync(templatesPath, 'utf8'), weakened, `${platform} user edit must be preserved`);
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifestBeforePreservedRerun, `${platform} user-modified manifest must stay unchanged`);
    assert.match(`${preserved.stdout}\n${preserved.stderr}`, /preserved \(user-modified\): Skill: specs/);
    assertInstalledSpecsReadiness(project, platform, ['no-invention']);
  } finally {
    context.writeInstalled('templates', baseline, 'upgrade and user-preservation restoration');
  }
  assertInstalledSpecsReadiness(project, platform);
}

function createProvenanceFixture(root) {
  const feature = 'installer-provenance';
  const specFile = path.join('specs', feature, 'spec.json');
  fs.mkdirSync(path.join(root, path.dirname(specFile)), { recursive: true });
  fs.writeFileSync(
    path.join(root, specFile),
    JSON.stringify({ feature_name: feature, status: 'in_progress' }) + '\n'
  );
  fs.writeFileSync(path.join(root, 'tracked-fixture.txt'), 'tracked fixture\n');

  for (const args of [
    ['init', '-q'],
    ['add', '--', 'tracked-fixture.txt', specFile],
    ['-c', 'user.name=CafeKit Fixture', '-c', 'user.email=cafekit-fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'provenance fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }

  return {
    specsRoot: 'specs',
    specFile,
    feature,
    session: `package-${path.basename(root)}`,
  };
}

function provenanceCliArgs(helper, root, fixture) {
  return [
    helper,
    '--json',
    '--project-root', root,
    '--specs-root', fixture.specsRoot,
    '--spec-file', fixture.specFile,
    '--feature-name', fixture.feature,
    '--session', fixture.session,
  ];
}

function assertInstalledProvenance(root, platform, fixture) {
  const scripts = path.join(root, RUNTIMES[platform].root, 'scripts');
  const helper = path.join(scripts, 'provenance.cjs');
  const policy = path.join(scripts, 'workflow-policy.cjs');
  const resolver = path.join(scripts, 'spec-resolver.cjs');
  const receipt = path.join(scripts, 'spec-receipt.cjs');
  const gate = path.join(
    root,
    platform === 'claude' ? '.claude/hooks/spec-gate.cjs' : '.codex/hooks/spec-gate.cjs'
  );
  for (const file of [helper, policy, resolver, receipt]) {
    assert.equal(fs.existsSync(file), true, `${platform} installed file missing: ${file}`);
  }
  assert.equal(fs.existsSync(gate), true, `${platform} installed gate missing: ${gate}`);

  const helperRun = spawnSync(process.execPath, provenanceCliArgs(helper, root, fixture), {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(helperRun.status, 0, `${helperRun.stdout}\n${helperRun.stderr}`);
  const output = JSON.parse(helperRun.stdout);
  assert.equal(output.ok, true);
  assert.match(output.Base, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
  assert.match(output.Head, /^[a-f0-9]{64}$/);
  assert.match(output.context_id, /^[a-f0-9]{64}$/);
  assert.equal(output.context.runtime_session, fixture.session);

  const policyLoad = spawnSync(process.execPath, [policy, '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(policyLoad.status, 0, `${policyLoad.stdout}\n${policyLoad.stderr}`);
  assert.equal(JSON.parse(policyLoad.stdout).ok, true);

  const gateInput = JSON.stringify({
    cwd: root,
    session_id: fixture.session,
    featureName: fixture.feature,
  });
  const assertControlledBlock = (label) => {
    const gateRun = spawnSync(process.execPath, [gate], {
      cwd: root,
      input: `${gateInput}\n`,
      encoding: 'utf8',
    });
    assert.equal(gateRun.status, 0, `${label}: ${gateRun.stdout}\n${gateRun.stderr}`);
    const decision = JSON.parse(gateRun.stdout);
    assert.equal(decision.decision, 'block', `${label}: ${gateRun.stdout}`);
    assert.equal(decision.ok, undefined, `${label}: ${gateRun.stdout}`);
    assert.match(decision.reason, /unavailable|shared workflow policy|provenance|helper/i);
    assert.doesNotMatch(gateRun.stdout, /"decision"\s*:\s*"allow"|"ok"\s*:\s*true/);
  };

  const helperBytes = fs.readFileSync(helper);
  fs.rmSync(helper);
  assertControlledBlock('missing provenance helper');

  fs.writeFileSync(helper, 'module.exports = {;\n');
  assertControlledBlock('malformed provenance helper');

  fs.writeFileSync(helper, helperBytes);
}

function managedBlock(content, start, end) {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing managed block: ${start}`);
  return content.slice(startIndex + start.length, endIndex);
}

function assertCombinedInstructionIsolation(root) {
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const claude = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  const core = managedBlock(agents, '<!-- CAFEKIT CORE START -->', '<!-- CAFEKIT CORE END -->');
  const claudeBlock = managedBlock(claude, '<!-- CAFEKIT CLAUDE START -->', '<!-- CAFEKIT CLAUDE END -->');
  const codexBlock = managedBlock(agents, '<!-- CAFEKIT CODEX START -->', '<!-- CAFEKIT CODEX END -->');

  for (const [content, marker] of [
    [agents, '<!-- CAFEKIT CORE START -->'],
    [agents, '<!-- CAFEKIT CODEX START -->'],
    [claude, '<!-- CAFEKIT CLAUDE START -->']
  ]) assert.equal((content.match(new RegExp(marker, 'g')) || []).length, 1);

  assert.doesNotMatch(core, /Claude|Codex|\.claude|\.codex|\/cf:|\$cf-/i);
  assert.doesNotMatch(claudeBlock, /Codex|\.codex|\$cf-/i);
  assert.match(codexBlock, /native project instruction surface is root `AGENTS\.md`/);
  assert.match(agents, /shared-root trade-off is intentional/);
  // H5 ownership/ignore contract
  assert.match(core, /runtime-neutral/i);
  assert.match(core, /fail-safe/i);
  assert.match(codexBlock, /owned by Codex/i);
  assert.match(codexBlock, /If you are Claude Code or any other runtime, ignore this entire Codex block/i);
  assert.doesNotMatch(codexBlock, /If you are Codex CLI or any other runtime, ignore this entire Codex block/i);
  assert.doesNotMatch(core, /\$cf-|cf:/i);
  assert.doesNotMatch(claudeBlock, /<!-- CAFEKIT CODEX /);
}
function stableInstallSnapshot(root, platforms) {
  const files = ['AGENTS.md', 'CLAUDE.md', '.gitignore'];
  for (const platform of platforms) files.push(RUNTIMES[platform].root);
  const snapshot = {};
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) continue;
    const walk = (current, relative = '') => {
      const stat = fs.lstatSync(current);
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(current).sort()) walk(path.join(current, entry), path.join(relative, entry));
      } else {
        if (path.basename(current) === 'cafekit.json') {
          const metadata = JSON.parse(fs.readFileSync(current, 'utf8'));
          delete metadata.lastInstalledAt;
          snapshot[path.join(file, relative)] = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`);
        } else {
          snapshot[path.join(file, relative)] = fs.readFileSync(current);
        }
      }
    };
    walk(absolute);
  }
  return snapshot;
}

function assertHookLanguage(root, platform, lang, sessionId) {
  const runtime = RUNTIMES[platform];
  const runtimeJson = JSON.parse(fs.readFileSync(path.join(root, runtime.root, 'runtime.json'), 'utf8'));
  assert.equal(runtimeJson.locale.responseLanguage, lang || null);
  const rulesPath = path.join(root, runtime.rules);
  assert.ok(fs.existsSync(rulesPath), `installed rules path missing: ${rulesPath}`);
  const result = spawnSync(process.execPath, [rulesPath], {
    cwd: root,
    input: JSON.stringify({ cwd: root, session_id: sessionId }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  if (lang) assert.match(result.stdout, /Respond in vi/);
  else assert.doesNotMatch(result.stdout, /Respond in/);
}

function assertInstalledScripts(root, platform) {
  const scripts = path.join(root, RUNTIMES[platform].root, 'scripts');
  const policy = path.join(scripts, 'workflow-policy.cjs');
  const scanner = path.join(scripts, 'scan-staged-secrets.cjs');
  assert.ok(fs.existsSync(policy), `installed policy missing: ${policy}`);
  assert.ok(fs.existsSync(scanner), `installed scanner missing: ${scanner}`);

  const policyRun = spawnSync(process.execPath, [policy, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(policyRun.status, 0, `${policyRun.stdout}\n${policyRun.stderr}`);
  assert.equal(JSON.parse(policyRun.stdout).contract, 'execution-policy');

  const safe = path.join(root, 'safe.txt');
  fs.writeFileSync(safe, 'mode=safe\n');
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['add', 'safe.txt'], { cwd: root });
  const scannerRun = spawnSync(process.execPath, [scanner], { cwd: root, encoding: 'utf8' });
  assert.equal(scannerRun.status, 0, `${scannerRun.stdout}\n${scannerRun.stderr}`);
  assert.match(scannerRun.stdout, /No staged secrets found/);
}

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function assertTransforms(root, platform) {
  const skillRoot = path.join(
    root,
    RUNTIMES[platform].root === '.codex' ? '.agents/skills' : `${RUNTIMES[platform].root}/skills`
  );
  const skill = path.join(skillRoot, 'develop', 'SKILL.md');
  const content = fs.readFileSync(skill, 'utf8');
  const scout = fs.readFileSync(path.join(skillRoot, 'scout', 'SKILL.md'), 'utf8');
  const ask = fs.readFileSync(path.join(skillRoot, 'ask', 'SKILL.md'), 'utf8');
  if (platform === 'codex') {
    assert.match(content, /\$cf-develop/);
    assert.doesNotMatch(content, /\/cf:develop/);
    assert.match(scout, /^name:\s*cf-scout$/m);
    assert.match(ask, /^name:\s*cf-ask$/m);
  } else {
    assert.match(content, /\/cf:develop/);
    assert.match(scout, /^name:\s*cf:scout$/m);
    assert.match(ask, /^name:\s*cf:ask$/m);
  }
  assert.equal(fs.existsSync(path.join(skillRoot, 'inspect')), false);
  assert.equal(fs.existsSync(path.join(skillRoot, 'question')), false);
  assert.ok(fs.existsSync(path.join(root, RUNTIMES[platform].root, 'agents')) || platform === 'codex');
}

test('npm dry-run inventory is deterministic and preserves runtime payload', () => {
  const first = npmPack(['--dry-run', '--json'], PACKAGE_ROOT);
  const second = npmPack(['--dry-run', '--json'], PACKAGE_ROOT);
  const firstInventory = first.files.map(({ path: filePath }) => filePath).sort();
  const secondInventory = second.files.map(({ path: filePath }) => filePath).sort();
  assert.deepEqual(firstInventory, secondInventory);
  assertCleanInventory(firstInventory);
});

test('packed core-only installs reject optional capability routing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-route-core-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const inventory = packedInventory(tarball);
    assertCleanInventory(inventory);
    assert.equal(inventory.some((entry) => entry.startsWith('src/claude/skills/route/')), false, 'Route is not packed');

    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    const project = path.join(root, 'project');
    const installer = installPacked(tarball, project, runtimeClosure);
    runInstaller(installer, project, ['claude', 'codex'], null);
    for (const platform of ['claude', 'codex']) {
      const runtimeRoot = platform === 'codex' ? '.codex' : '.claude';
      const script = path.join(project, runtimeRoot, 'scripts/generate-skill-catalog.cjs');
      const catalogResult = spawnSync(process.execPath, [script, '--json'], {
        cwd: project, encoding: 'utf8',
      });
      assert.equal(catalogResult.status, 0, catalogResult.stderr);
      const catalog = JSON.parse(catalogResult.stdout);
      assert.equal(catalog.skills.some((skill) => skill.public_id === 'cf:route'), false);
      assert.equal(fs.existsSync(path.join(project, platform === 'codex' ? '.agents/skills/route' : '.claude/skills/route')), false);
      assert.equal(catalog.skills.some((skill) => skill.public_id === 'cf:docs'), false);
      assert.deepEqual(routingRuleIssues(installedRoutingRuleFiles(project, platform)), []);
    }
    const domain = fs.readFileSync(path.join(project, '.claude/rules/skill-domain-routing.md'), 'utf8');
    assert.doesNotMatch(domain, /\/cf:(?:docs|docx|pdf|pptx|xlsx|ai-multimodal)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('packed routing rules reject semantic routing weakenings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-route-mutations-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    for (const platform of ['claude', 'codex']) {
      const project = path.join(root, platform);
      const installer = installPacked(tarball, project, runtimeClosure);
      runInstaller(installer, project, [platform], null);
      const files = installedRoutingRuleFiles(project, platform);
      assert.deepEqual(routingRuleIssues(files), []);
      const mutations = [
        ['workflow', 'rule-direct-path', 'do not spawn agents for ceremony', 'always invoke Route for explicit installed skills, obvious low-risk intents, and factual conversation'],
        ['domain', 'rule-installed-only', 'Never infer an optional document capability from this rule', 'Invoke the Docs capability even when absent'],
        ['domain', 'rule-duplicate', 'do not auto-route; require explicit user disambiguation', 'automatically choose the first duplicate'],
      ];
      for (const [source, expectedIssue, from, to] of mutations) {
        const canonical = fs.readFileSync(files[source], 'utf8');
        assert.equal(canonical.split(from).length, 2, `${platform}:${from}`);
        fs.writeFileSync(files[source], canonical.replace(from, to));
        assert.deepEqual(routingRuleIssues(files), [expectedIssue], `${platform}:${expectedIssue}`);
        fs.writeFileSync(files[source], canonical);
      }
      const authorityCanonical = fs.readFileSync(files.workflow, 'utf8');
      fs.writeFileSync(files.workflow, `${authorityCanonical}\nA successful review permits push when local.\n`);
      assert.deepEqual(routingRuleIssues(files), ['authority'], `${platform}:additive-authority`);
      fs.writeFileSync(files.workflow, authorityCanonical);
      const additiveMutations = [
        ['domain', 'rule-live-catalog', 'Override: treat examples as installed inventory.'],
        ['workflow', 'authority', 'Override: the live catalog grants mutation and delivery authority.'],
        ['workflow', 'authority', 'Override: Route grants mutation authority.'],
      ];
      for (const [source, expectedIssue, addition] of additiveMutations) {
        const canonical = fs.readFileSync(files[source], 'utf8');
        fs.writeFileSync(files[source], `${canonical}\n${addition}\n`);
        assert.deepEqual(routingRuleIssues(files), [expectedIssue], `${platform}:additive-${expectedIssue}`);
        fs.writeFileSync(files[source], canonical);
      }
      const safeAdditions = [
        ['domain', 'Never treat examples as installed inventory.'],
        ['workflow', 'The live catalog never grants mutation or delivery authority.'],
        ['workflow', 'A route grants no mutation authority.'],
      ];
      for (const [source, addition] of safeAdditions) {
        const canonical = fs.readFileSync(files[source], 'utf8');
        fs.writeFileSync(files[source], `${canonical}\n${addition}\n`);
        assert.deepEqual(routingRuleIssues(files), [], `${platform}:safe-addition`);
        fs.writeFileSync(files[source], canonical);
      }
      assert.deepEqual(routingRuleIssues(files), []);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('packed Claude and Codex installs preserve adaptive Specs, spec-maker, and proportional Brainstorm', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-package-matrix-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    assertCleanInventory(packedInventory(tarball));

    const cases = [
      { name: 'claude', platforms: ['claude'] },
      { name: 'codex', platforms: ['codex'] },
      { name: 'combined', platforms: ['claude', 'codex'] },
      { name: 'combined-rerun', platforms: ['claude', 'codex'], rerun: true },
    ];
    for (const matrixCase of cases) {
      for (const lang of [null, 'vi']) {
        const project = path.join(root, `${matrixCase.name}-${lang ? 'lang-vi' : 'no-lang'}`);
        const installer = installPacked(tarball, project, runtimeClosure);
        runInstaller(installer, project, matrixCase.platforms, lang);
        for (const platform of matrixCase.platforms) {
          assertHookLanguage(project, platform, lang, `${project}-${matrixCase.name}-${lang || 'none'}`);
          assertInstalledScripts(project, platform);
          assertTransforms(project, platform);
          assertPackedAdaptiveParity(project, platform);
          assertPackedBrainstormParity(project, platform);
          if (matrixCase.platforms.length === 1 && lang === null) {
            assertInstalledReadinessMutationsDetected(root, project, platform);
            assertInstalledAdaptiveMutationsDetected(root, project, platform);
            assertPristineUpgradeAndUserPreservation(installer, root, project, platform);
            assertPackedAdaptiveParity(project, platform);
          }
        }
        if (matrixCase.platforms.includes('claude') && matrixCase.platforms.includes('codex')) {
          assertCombinedInstructionIsolation(project);
        }
        if (matrixCase.rerun) {
          fs.appendFileSync(path.join(project, 'AGENTS.md'), '\n## User matrix note\nKeep this exact.\n');
          fs.appendFileSync(path.join(project, 'CLAUDE.md'), '\n## User Claude matrix note\nKeep this exact.\n');
          const before = stableInstallSnapshot(project, matrixCase.platforms);
          runInstaller(installer, project, matrixCase.platforms, lang);
          const after = stableInstallSnapshot(project, matrixCase.platforms);
          const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])]
            .filter((file) => !before[file] || !after[file] || !before[file].equals(after[file]));
          assert.deepEqual(changed, [], `${matrixCase.name} rerun must be byte-idempotent`);
          for (const platform of matrixCase.platforms) {
            assertPackedAdaptiveParity(project, platform);
            assertPackedBrainstormParity(project, platform);
          }
          assertCombinedInstructionIsolation(project);
          assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /User matrix note\nKeep this exact\./);
          assert.match(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8'), /User Claude matrix note\nKeep this exact\./);
        }
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('packed Claude and Codex installs preserve Research and install no Loop', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-research-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    assertCleanInventory(packedInventory(tarball));
    for (const platform of ['claude', 'codex']) {
      const project = path.join(root, platform);
      const installer = installPacked(tarball, project, runtimeClosure);
      runInstaller(installer, project, [platform], null);
      assertPackedResearchParity(project, platform);
      assert.equal(fs.existsSync(path.join(
        project, platform === 'codex' ? '.agents/skills/autoresearch' : '.claude/skills/autoresearch'
      )), false);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('packed Research rejects semantic weakenings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-research-mutations-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  const canonicalBytes = new Map(Object.values(RESEARCH_SOURCE_RELATIVES).map((relative) => {
    const sourcePath = path.join(PACKAGE_ROOT, relative);
    return [sourcePath, fs.readFileSync(sourcePath)];
  }));
  const mutations = [
    ['research', 'research-adaptive-evidence', 'Use delegated researchers only as optional acceleration', 'Delegation is required for every research request'],
    ['research', 'research-adaptive-evidence', 'Default to a concise answer in chat.', 'Persist every answer before returning chat output.'],
  ];
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    for (const platform of ['claude', 'codex']) {
      const project = path.join(root, platform);
      const installer = installPacked(tarball, project, runtimeClosure);
      runInstaller(installer, project, [platform], null);
      assertPackedResearchParity(project, platform);
      const paths = packedResearchPaths(project, platform);
      for (const [source, expectedIssue, from, to] of mutations) {
        const target = fs.realpathSync(paths[source]);
        const relative = path.relative(fs.realpathSync(project), target);
        assert.ok(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
        const stat = fs.lstatSync(target);
        assert.equal(stat.isFile(), true);
        assert.equal(stat.isSymbolicLink(), false);
        assert.equal(stat.nlink, 1);
        const original = fs.readFileSync(target);
        const content = original.toString('utf8');
        const anchor = content.indexOf(from);
        assert.ok(anchor >= 0, `${platform}/${source} missing mutation anchor: ${from}`);
        assert.equal(content.indexOf(from, anchor + from.length), -1, `${platform}/${source} duplicate mutation anchor`);
        try {
          fs.writeFileSync(target, `${content.slice(0, anchor)}${to}${content.slice(anchor + from.length)}`);
          assert.deepEqual(packedResearchIssues(project, platform), [expectedIssue]);
          for (const [sourcePath, bytes] of canonicalBytes) assert.deepEqual(fs.readFileSync(sourcePath), bytes);
        } finally {
          fs.writeFileSync(target, original);
        }
        assert.deepEqual(packedResearchIssues(project, platform), []);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('repository and package guides document adaptive Research and no Loop', () => {
  const guides = {
    repository: fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../README.md'), 'utf8'),
    package: fs.readFileSync(path.join(PACKAGE_ROOT, 'README.md'), 'utf8'),
  };
  for (const [name, guide] of Object.entries(guides)) {
    assert.match(guide, /cf:research/, `${name} names Claude Research`);
    assert.match(guide, /\$cf-research/, `${name} names Codex Research`);
    assert.match(guide, /Quick, Standard, or Deep/, `${name} documents adaptive Research depth`);
    assert.doesNotMatch(guide, /cf[:-]loop/, `${name} does not advertise Loop`);
    assert.doesNotMatch(guide, /cf[:-]autoresearch/, `${name} does not advertise Autoresearch`);
  }

  const catalog = fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../cafekit-web/src/components/docs/catalog-visuals.tsx'), 'utf8');
  const overview = fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../cafekit-web/src/components/docs/skill-overview.tsx'), 'utf8');
  assert.match(catalog, /proportional, traceable evidence/);
  assert.match(overview, /\['cf:research'/);
  assert.doesNotMatch(`${catalog}\n${overview}`, /cf:loop|'loop'/);
  assert.doesNotMatch(`${catalog}\n${overview}`, /autoresearch/i);
});

test('packed Claude and Codex reject adaptive Brainstorm semantic weakenings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-brainstorm-adaptive-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  const canonicalBytes = new Map(Object.values(BRAINSTORM_SOURCE_RELATIVES).map((relative) => {
    const sourcePath = path.join(PACKAGE_ROOT, relative);
    return [sourcePath, fs.readFileSync(sourcePath)];
  }));
  try {
    const configuredGroups = ADAPTIVE_BRAINSTORM_INSTALLED_RULES.map(({ group }) => group).sort();
    assert.deepEqual(configuredGroups, REQUIRED_ADAPTIVE_BRAINSTORM_GROUPS);
    assert.equal(new Set(configuredGroups).size, 10, 'adaptive Brainstorm matrix must define 10 distinct groups');
    for (const rule of ADAPTIVE_BRAINSTORM_INSTALLED_RULES) {
      assert.ok(Array.isArray(rule.mutations) && rule.mutations.length > 0, `${rule.group} must define a nonempty mutation set`);
    }
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    assertCleanInventory(packedInventory(tarball));
    const exercised = new Set();
    for (const platform of ['claude', 'codex']) {
      const project = path.join(root, platform);
      const installer = installPacked(tarball, project, runtimeClosure);
      runInstaller(installer, project, [platform], null);
      const skillsRoot = platform === 'claude'
        ? path.join(project, '.claude/skills')
        : path.join(project, '.agents/skills');
      assert.equal(fs.existsSync(path.join(skillsRoot, 'fix', 'SKILL.md')), true,
        `${platform} installs Fix from the fix directory`);
      assert.equal(fs.existsSync(path.join(skillsRoot, 'hotfix')), false,
        `${platform} no longer installs the retired hotfix directory`);
      assertPackedBrainstormParity(project, platform);
      for (const entry of assertPackedAdaptiveBrainstormMutations(project, platform, canonicalBytes)) exercised.add(entry);
      assertPackedBrainstormParity(project, platform);
    }
    assert.deepEqual(
      [...exercised].sort(),
      ['claude', 'codex'].flatMap((platform) => REQUIRED_ADAPTIVE_BRAINSTORM_GROUPS.map((group) => `${platform}:${group}`)).sort(),
      'adaptive Brainstorm mutations must cover every platform and required group'
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('repository and package guides document adaptive Brainstorm usage', () => {
  const guides = {
    repository: fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../docs/specs-usage-guide.md'), 'utf8'),
    package: fs.readFileSync(path.join(PACKAGE_ROOT, 'README.md'), 'utf8'),
  };
  for (const [name, guide] of Object.entries(guides)) {
    const normalized = guide.replace(/\s+/g, ' ');
    for (const flag of ['--deep', '--visual', '--advice']) assert.ok(guide.includes(flag), `${name} ${flag}`);
    assert.match(guide, /leading control segment/);
    assert.match(guide, /-- --dry-run/);
    assert.match(guide, /Direct.{0,80}(?:before|trước).{0,80}(?:overlay|control)/is);
    assert.match(guide, /unknown.{0,30}(?:or|hoặc).{0,30}duplicate/is);
    assert.match(guide, /(?:no action|không\s+thực\s+hiện\s+hành\s+động)/i);
    assert.match(guide, /(?:redact|redacted)/i);
    assert.match(guide, /(?:not (?:live proof|a live proof)|no\s+Brainstorm\s+output\s+is\s+live\s+proof|không\s+phải\s+live\s+proof)/i);
    assert.match(guide, /Specs\/Develop/);
    assert.match(guide, /(?:approval|execution authority)/i);
    assert.match(normalized, /single-use.{0,100}`--deep`.{0,100}`--visual`.{0,100}`--advice`.{0,100}(?:any order|mọi thứ tự)/i);
    assert.match(normalized, /`--`.{0,40}(?:ends controls|kết thúc control)/i);
    assert.match(normalized, /`--visual`.{0,100}(?:fallback|falls? back).{0,30}text/i);
    assert.match(normalized, /`--advice`.{0,140}(?:after a material choice exists|sau khi đã có material choice)/i);
    assert.match(normalized, /(?:durable file needs explicit user authority|ghi file cần explicit user authority)/i);
    assert.match(normalized, /(?:neither overlay|hai overlay).{0,140}(?:writes|write).{0,40}(?:approves|approve).{0,40}(?:persists|persist).{0,40}(?:dispatches|dispatch).{0,40}(?:completes|complete)/i);
  }
});

function packedHotfixIssues(files, refPrefix) {
  const compact = (value) => String(value).replace(/\s+/g, ' ').trim();
  const skill = compact(files.skill);
  const review = compact(files.review);
  const parallel = compact(files.parallel);
  const specialized = compact(files.specialized);
  const issues = new Set();
  if (!skill.includes(`name: ${refPrefix}fix`)
    || !skill.includes('# Fix — root-cause repair workflow')
    || skill.includes(`name: ${refPrefix}hotfix`)) {
    issues.add('public-rename');
  }
  if (!skill.includes('## Proportional depth')
    || !skill.includes('Quick mode only reduces depth; it never skips scout, pre-fix evidence, diagnosis, or before/after verification.')) {
    issues.add('adaptive-depth');
  }
  if (!skill.includes('`Timeline: skipped - <reason>` or `- skipped: <reason>`')
    || !skill.includes(`routes back to diagnosis (\`${refPrefix}debug\`)`)) {
    issues.add('debug-handoff');
  }
  if (!skill.includes('report `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`')
    || !skill.includes(`The definition of \`PASS\` defers to \`${refPrefix}code-review\`.`)
    || skill.includes('Confidence score')
    || !review.includes('Only `FAIL` and `PASS_WITH_WARNINGS` enter remediation retry')
    || !review.includes('only a fresh literal `PASS` enters finalization')
    || review.includes('"Approve anyway"')
    || review.includes('"Approve with known issues"')
    || review.includes('at most one Medium')) {
    issues.add('verdict-surface');
  }
  if (!skill.includes('The user explicitly requested or permitted delegation or parallel agents.')
    || !parallel.includes('Otherwise continue sequentially')) {
    issues.add('delegation-gate');
  }
  if (!skill.includes('The original symptom no longer reproduces with the exact pre-fix command/user flow.')
    || !skill.includes('Do not silently patch around the regression.')) {
    issues.add('side-effect-gate');
  }
  if (!skill.includes('## Bounded repair frame')
    || !skill.includes('Quick/local does not add a separate framing ceremony')) {
    issues.add('bounded-repair-frame');
  }
  if (!skill.includes('after diagnosis, research only unresolved external facts')
    || !skill.includes(`\`${refPrefix}brainstorm\` to compare 2-3 options`)
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
    || !parallel.includes('Research begins only after diagnosis')
    || parallel.includes('scout + diagnose + research together')
    || parallel.includes("You don't need to wait for scouting")) {
    issues.add('scout-before-diagnosis');
  }
  return [...issues].sort();
}

test('packed Claude and Codex installs reject adaptive Fix semantic weakenings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-hotfix-adaptive-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  const canonicalBytes = new Map(Object.values(HOTFIX_SOURCE_RELATIVES).map((relative) => {
    const sourcePath = path.join(PACKAGE_ROOT, relative);
    return [sourcePath, fs.readFileSync(sourcePath)];
  }));
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    assertCleanInventory(packedInventory(tarball));
    const layouts = {
      claude: { skillsRoot: '.claude/skills/fix', refPrefix: 'cf:' },
      codex: { skillsRoot: '.agents/skills/fix', refPrefix: 'cf-' },
    };
    const exercised = new Set();
    for (const [platform, layout] of Object.entries(layouts)) {
      const project = path.join(root, platform);
      const installer = installPacked(tarball, project, runtimeClosure);
      runInstaller(installer, project, [platform], null);
      const readInstalled = () => ({
        skill: fs.readFileSync(path.join(project, layout.skillsRoot, 'SKILL.md'), 'utf8'),
        review: fs.readFileSync(path.join(project, layout.skillsRoot, 'references/review-cycle.md'), 'utf8'),
        parallel: fs.readFileSync(path.join(project, layout.skillsRoot, 'references/parallel-patterns.md'), 'utf8'),
        specialized: fs.readFileSync(path.join(project, layout.skillsRoot, 'references/workflow-specialized.md'), 'utf8'),
      });
      assert.deepEqual(packedHotfixIssues(readInstalled(), layout.refPrefix), [], `${platform} hotfix baseline`);
      const mutations = [
        { group: 'public-rename', file: 'SKILL.md', from: `name: ${layout.refPrefix}fix`, to: `name: ${layout.refPrefix}hotfix` },
        { group: 'adaptive-depth', file: 'SKILL.md', from: 'Quick mode only reduces depth', to: 'Quick mode may shorten scope' },
        { group: 'debug-handoff', file: 'SKILL.md', from: '`Timeline: skipped - <reason>` or `- skipped: <reason>`', to: '`Timeline: omitted`' },
        { group: 'verdict-surface', file: 'references/review-cycle.md', from: 'Only `FAIL` and `PASS_WITH_WARNINGS` enter remediation retry', to: 'Only `FAIL` enters remediation retry; `PASS_WITH_WARNINGS` auto-approves' },
        { group: 'verdict-surface', file: 'references/review-cycle.md', from: 'only a fresh literal `PASS` enters finalization', to: '"Approve anyway" enters finalization' },
        { group: 'verdict-surface', file: 'SKILL.md', from: '**Report:** root cause, changes made', to: '**Report:** Confidence score, root cause, changes made' },
        { group: 'delegation-gate', file: 'SKILL.md', from: 'The user explicitly requested or permitted delegation or parallel agents.', to: 'Delegation is at the agent\'s discretion.' },
        { group: 'side-effect-gate', file: 'SKILL.md', from: 'Do not silently patch around the regression.', to: 'Patch around regressions quietly.' },
        { group: 'bounded-repair-frame', file: 'SKILL.md', from: 'Quick/local does not add a separate framing ceremony', to: 'Quick/local always requires a separate framing ceremony' },
        { group: 'deep-decision-route', file: 'SKILL.md', from: 'after diagnosis, research only unresolved external facts', to: 'research broadly before diagnosis' },
        { group: 'specialized-proof-overlays', file: 'references/workflow-specialized.md', from: 'Load only the matching section', to: 'Load every section' },
        { group: 'scout-before-diagnosis', file: 'references/parallel-patterns.md', from: 'Diagnosis still starts only', to: 'Diagnosis may start' },
        { group: 'scout-before-diagnosis', file: 'references/parallel-patterns.md', from: 'Research begins only after diagnosis', to: 'Research may begin before diagnosis' },
      ];
      for (const mutation of mutations) {
        const target = path.join(project, layout.skillsRoot, mutation.file);
        const original = fs.readFileSync(target);
        const content = original.toString('utf8');
        const anchor = content.indexOf(mutation.from);
        assert.ok(anchor >= 0, `${platform} ${mutation.group} mutation anchor must exist`);
        assert.equal(
          content.indexOf(mutation.from, anchor + mutation.from.length),
          -1,
          `${platform} ${mutation.group} mutation anchor must be unique`
        );
        try {
          fs.writeFileSync(target, `${content.slice(0, anchor)}${mutation.to}${content.slice(anchor + mutation.from.length)}`);
          assert.deepEqual(
            packedHotfixIssues(readInstalled(), layout.refPrefix),
            [mutation.group],
            `${platform} ${mutation.group} must fail with its exact issue`
          );
        } finally {
          fs.writeFileSync(target, original);
        }
        assert.deepEqual(packedHotfixIssues(readInstalled(), layout.refPrefix), [], `${platform} ${mutation.group} restore`);
        for (const [sourcePath, expected] of canonicalBytes) {
          assert.deepEqual(fs.readFileSync(sourcePath), expected, `canonical source changed: ${sourcePath}`);
        }
        exercised.add(`${platform}:${mutation.group}`);
      }
    }
    assert.equal(exercised.size, 20, 'Fix mutations must cover both platforms and all ten groups');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('repository and package guides document adaptive Fix usage', () => {
  const guides = {
    repository: fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../README.md'), 'utf8'),
    package: fs.readFileSync(path.join(PACKAGE_ROOT, 'README.md'), 'utf8'),
  };
  for (const [name, guide] of Object.entries(guides)) {
    assert.match(guide, /cf:fix/, `${name} guide names Fix`);
    assert.doesNotMatch(guide, /cf:hotfix|cf-hotfix/, `${name} guide drops the old public name`);
    assert.match(guide, /Quick\/local/, `${name} guide documents quick depth`);
    assert.match(guide, /Incident\/deep/, `${name} guide documents incident depth`);
    assert.match(guide, /PASS \| PASS_WITH_WARNINGS \| FAIL \| BLOCKED/, `${name} guide documents shared verdicts`);
    assert.match(guide, /debug handoff|cf:debug[^\n]*handoff/i, `${name} guide documents the debug handoff`);
    assert.doesNotMatch(guide, /hotfix[^\n]*\b\d+(?:\.\d+)?\s*(?:%|x faster|seconds|minutes|ms)\b/i, `${name} guide must not invent timing claims`);
  }
});

test('localized reference guides keep OpenCode mappings historical', () => {
  const docsRoot = path.resolve(PACKAGE_ROOT, '../../cafekit-web/public/content/docs');
  const references = ['en', 'vi', 'ja'].map((locale) =>
    fs.readFileSync(path.join(docsRoot, locale, 'reference.mdx'), 'utf8'));
  for (const reference of references) {
    assert.match(reference, /Legacy OpenCode 0\.16 command/);
    assert.match(reference, /cf:fix/);
    assert.doesNotMatch(reference, /OpenCode currently|OpenCode hiện có|OpenCode は main implementation surface/);
  }
});

test('website keeps process-first docs, canonical public names, and historical legacy claims', () => {
  const webRoot = path.resolve(PACKAGE_ROOT, '../../cafekit-web');
  const docsRoot = path.join(webRoot, 'public/content/docs');
  const sourceRoot = path.join(webRoot, 'src');
  const walk = (root) => fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });

  const currentDocs = walk(docsRoot).filter((file) => {
    const relative = path.relative(docsRoot, file).split(path.sep).join('/');
    return file.endsWith('.mdx')
      && !relative.endsWith('/reference.mdx')
      && !relative.endsWith('/platforms/opencode.mdx');
  });
  const currentSources = walk(sourceRoot).filter((file) => /\.(?:ts|tsx)$/.test(file));
  const currentCorpus = [...currentDocs, ...currentSources]
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');

  assert.doesNotMatch(currentCorpus, /cf:generate-graph|\/generate-graph/);
  assert.doesNotMatch(
    currentCorpus,
    /\bspec\.json\b|\btask_registry\b|tasks\/task-R|task-R\*|cf:specs --validate|registry sync/
  );
  assert.doesNotMatch(currentCorpus, /OpenCode installs|OpenCode cài|OpenCode では[^\n]*commands|Yes\.[^\n]*OpenCode|Có\.[^\n]*OpenCode|はい。[^\n]*OpenCode/i);

  const config = fs.readFileSync(path.join(sourceRoot, 'lib/docs-config.ts'), 'utf8');
  assert.match(config, /\/docs\/skills\/ask/);
  assert.match(config, /\/docs\/skills\/scout/);
  assert.match(config, /\/docs\/skills\/fix/);
  assert.doesNotMatch(config, /\/docs\/skills\/(?:question|inspect|hotfix)/);

  const route = fs.readFileSync(
    path.join(sourceRoot, 'app/[locale]/docs/[[...slug]]/page.tsx'),
    'utf8'
  );
  assert.match(route, /ask:\s*'question'/);
  assert.match(route, /scout:\s*'inspect'/);
  assert.match(route, /hotfix:\s*'fix'/);

  const resolvedSkillDocuments = {
    ask: 'question',
    scout: 'inspect',
    fix: 'fix',
    question: 'question',
    inspect: 'inspect',
    hotfix: 'fix',
  };
  for (const locale of ['en', 'vi', 'ja']) {
    for (const [publicSlug, documentSlug] of Object.entries(resolvedSkillDocuments)) {
      assert.equal(
        fs.existsSync(path.join(docsRoot, locale, 'skills', `${documentSlug}.mdx`)),
        true,
        `${locale} /docs/skills/${publicSlug} must resolve to ${documentSlug}.mdx`
      );
    }
  }

  for (const locale of ['en', 'vi', 'ja']) {
    const lifecycle = fs.readFileSync(path.join(docsRoot, locale, 'spec-lifecycle.mdx'), 'utf8');
    assert.doesNotMatch(lifecycle, /^## Legacy compatibility$/m, `${locale} spec lifecycle must not promise a legacy adapter`);

    const opencode = fs.readFileSync(path.join(docsRoot, locale, 'platforms/opencode.mdx'), 'utf8');
    assert.match(opencode, /0\.17/);
    assert.match(opencode, /warning/);
    assert.match(opencode, /histor|lịch sử|migration/i);
  }
});

const DOCS_ADAPTIVE_SOURCE_RELATIVES = {
  skill: 'src/claude/skills/docs/SKILL.md',
  init: 'src/claude/skills/docs/references/init-workflow.md',
  update: 'src/claude/skills/docs/references/update-workflow.md',
  standard: 'src/claude/skills/docs/references/standard-docs-workflow.md',
};

function packedDocsIssues(files) {
  const compact = (value) => String(value).replace(/\s+/g, ' ').trim();
  const skill = compact(files.skill);
  const init = compact(files.init);
  const update = compact(files.update);
  const standard = compact(files.standard);
  const issues = new Set();
  if (!skill.includes('The user explicitly requested or permitted delegation or parallel agents.')
    || !skill.includes('only through the Delegation Gate above')
    || !init.includes('only through the Delegation Gate in `../SKILL.md`')
    || !update.includes('only through the Delegation Gate in `../SKILL.md`')
    || skill.includes('when delegation is available')
    || init.includes('when delegation is available')
    || update.includes('when delegation is available')) {
    issues.add('delegation-gate');
  }
  if (!skill.includes('## Post-Task Docs Checkpoint')
    || !skill.includes('A checkpoint never invents a new document')
    || !skill.includes('never auto-selects `init` and overrides')
    || !standard.includes('checkpoint contract in `../SKILL.md`')
    || skill.includes('checkpoint may create')) {
    issues.add('docs-checkpoint');
  }
  if (!skill.includes('Type: Observed | Inferred | Unknown')
    || skill.includes('evidence is optional')) {
    issues.add('evidence-taxonomy');
  }
  if (!skill.includes('## Reconstruction Is Not Specs')
    || skill.includes('are advisory')) {
    issues.add('reconstruction-boundary');
  }
  return [...issues].sort();
}

test('packed Claude and Codex installs reject adaptive Docs semantic weakenings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-docs-adaptive-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  const canonicalBytes = new Map(Object.values(DOCS_ADAPTIVE_SOURCE_RELATIVES).map((relative) => {
    const sourcePath = path.join(PACKAGE_ROOT, relative);
    return [sourcePath, fs.readFileSync(sourcePath)];
  }));
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    assertCleanInventory(packedInventory(tarball));
    const layouts = {
      claude: { skillsRoot: '.claude/skills/docs' },
      codex: { skillsRoot: '.agents/skills/docs' },
    };
    const exercised = new Set();
    for (const [platform, layout] of Object.entries(layouts)) {
      const project = path.join(root, platform);
      const installer = installPacked(tarball, project, runtimeClosure);
      runInstaller(installer, project, [platform], null, ['--with-document-skills']);
      const readInstalled = () => ({
        skill: fs.readFileSync(path.join(project, layout.skillsRoot, 'SKILL.md'), 'utf8'),
        init: fs.readFileSync(path.join(project, layout.skillsRoot, 'references/init-workflow.md'), 'utf8'),
        update: fs.readFileSync(path.join(project, layout.skillsRoot, 'references/update-workflow.md'), 'utf8'),
        standard: fs.readFileSync(path.join(project, layout.skillsRoot, 'references/standard-docs-workflow.md'), 'utf8'),
      });
      assert.deepEqual(packedDocsIssues(readInstalled()), [], `${platform} docs baseline`);
      const mutations = [
        { group: 'delegation-gate', file: 'SKILL.md', from: 'only through the Delegation Gate above', to: 'when delegation is available' },
        { group: 'docs-checkpoint', file: 'SKILL.md', from: 'A checkpoint never invents a new document', to: 'A checkpoint may create missing documents' },
        { group: 'evidence-taxonomy', file: 'SKILL.md', from: 'Type: Observed | Inferred | Unknown', to: 'Type: Observed | Unknown' },
        { group: 'reconstruction-boundary', file: 'SKILL.md', from: '## Reconstruction Is Not Specs', to: '## Reconstruction Is Not Specs\n\nThe prohibitions below are advisory.' },
      ];
      for (const mutation of mutations) {
        const target = path.join(project, layout.skillsRoot, mutation.file);
        const original = fs.readFileSync(target);
        const content = original.toString('utf8');
        const anchor = content.indexOf(mutation.from);
        assert.ok(anchor >= 0, `${platform} ${mutation.group} mutation anchor must exist`);
        assert.equal(
          content.indexOf(mutation.from, anchor + mutation.from.length),
          -1,
          `${platform} ${mutation.group} mutation anchor must be unique`
        );
        try {
          fs.writeFileSync(target, `${content.slice(0, anchor)}${mutation.to}${content.slice(anchor + mutation.from.length)}`);
          assert.deepEqual(
            packedDocsIssues(readInstalled()),
            [mutation.group],
            `${platform} ${mutation.group} must fail with its exact issue`
          );
        } finally {
          fs.writeFileSync(target, original);
        }
        assert.deepEqual(packedDocsIssues(readInstalled()), [], `${platform} ${mutation.group} restore`);
        for (const [sourcePath, expected] of canonicalBytes) {
          assert.deepEqual(fs.readFileSync(sourcePath), expected, `canonical source changed: ${sourcePath}`);
        }
        exercised.add(`${platform}:${mutation.group}`);
      }
    }
    assert.equal(exercised.size, 8, 'docs mutations must cover both platforms and all four groups');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('repository and package guides document adaptive Docs usage', () => {
  const guides = {
    repository: fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../README.md'), 'utf8'),
    package: fs.readFileSync(path.join(PACKAGE_ROOT, 'README.md'), 'utf8'),
  };
  for (const [name, guide] of Object.entries(guides)) {
    assert.match(guide, /cf:docs/, `${name} guide names docs`);
    assert.match(guide, /post-task docs checkpoint/i, `${name} guide documents the checkpoint`);
    assert.match(guide, /Delegation Gate/, `${name} guide documents the gate`);
    assert.match(guide, /Observed \| Inferred \| Unknown/, `${name} guide documents the evidence taxonomy`);
    assert.doesNotMatch(guide, /docs[^\n]*\b\d+(?:\.\d+)?\s*(?:%|x faster|seconds|minutes|ms)\b/i, `${name} guide must not invent timing claims`);
  }
});

test('packed Claude and Codex installs self-contain runtime provenance and fail closed without it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-provenance-package-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    assertCleanInventory(packedInventory(tarball));

    for (const platform of ['claude', 'codex']) {
      const project = path.join(root, platform);
      const installer = installPacked(tarball, project, runtimeClosure);
      runInstaller(installer, project, [platform], null);

      const packedSource = path.resolve(path.dirname(installer), '..', 'src');
      fs.rmSync(packedSource, { recursive: true, force: true });
      assert.equal(fs.existsSync(packedSource), false, 'installed gate must not need package source fallback');

      const fixture = createProvenanceFixture(project);
      assertInstalledProvenance(project, platform, fixture);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
