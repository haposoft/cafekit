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
  noInvention: 'Before implementation handoff, apply the **no-invention gate**: if two implementations conform to the packet text yet can produce different externally observable output, state, error, security, or compatibility behavior, surface the missing choice as an explicit C1 or C2 question and block handoff.',
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
  freshReplay: 'After applying an accepted C2 finding, a fresh-context closure pass records and freshly replays its original counterexample after the repair under this exact review-log header:',
  distinctRepairProof: '`Repaired at` cites the repair edit; `Proved at` must cite distinct evidence from the fresh replay, never the repair-edit citation.',
  closureTransition: 'An accepted finding transitions `accepted → repaired → PASS|FAIL|UNKNOWN`.',
  unknownBlocks: 'Only `PASS` closes it; `FAIL` remains open for the remaining paper-review round; `UNKNOWN` blocks implementation handoff.',
  scopeReturnsToC1: 'A repair that adds user semantics or scope returns to C1.',
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
  ['`decision-needed`', 'ask the user at C1/C2 and keep affected tasks blocked'],
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
  plannedProof: '`Required proof` is a planned level set, not execution\nevidence: known but unrun proof may be `pending`; `UNKNOWN` reachability blocks\n`pending`; missing, failed, or unavailable required evidence blocks `done`/C3.',
  proofSeparation: 'Levels stay separate and never promote one another.',
  liveLimit: 'Source/static checks prove the written contract, not live-model adherence.',
  specMakerAuthority: 'they are the canonical risk and coverage authority. Do not duplicate\ntheir taxonomy here.',
  specMakerAmbiguity: 'Apply the canonical ambiguity action; examples never decide observable behavior.',
  specMakerRoute: 'Apply their risk-first route before C1 and stop when the\nrequest qualifies for direct work; hand off when it requires Brainstorm-only exploration.',
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
  'src/claude/scripts/spec-ground.cjs',
  'src/claude/scripts/spec-final-state.cjs',
  'src/claude/scripts/spec-readiness.cjs',
  'src/claude/scripts/spec-semantic-model.cjs',
  'src/claude/scripts/validate-spec-output.cjs',
  'src/claude/scripts/spec-authoring-validation.cjs',
  'src/claude/scripts/spec-authoring-digest.cjs',
  'src/claude/scripts/generate-skill-catalog.cjs',
  'src/claude/rules/process-management.md',
  'src/claude/rules/review-audit-self-decision.md',
  'src/claude/rules/skill-domain-routing.md',
  'src/claude/rules/skill-workflow-routing.md',
  'src/claude/skills/route/SKILL.md',
  'src/claude/skills/route/references/task-taxonomy.md',
  'src/claude/skills/route/references/chaining-patterns.md',
  'src/claude/skills/route/references/agent-timing.md',
  'src/claude/skills/orca/SKILL.md',
  'src/claude/skills/brainstorm/SKILL.md',
  'src/claude/skills/brainstorm/references/question-framework.md',
  'src/claude/agents/brainstormer.md',
  'src/claude/skills/research/SKILL.md',
  'src/claude/agents/researcher.md',
  'src/claude/skills/loop/SKILL.md',
  'src/claude/skills/loop/references/bounded-loop-protocol.md',
  'src/claude/skills/loop/references/metric-and-guard-contract.md',
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
const RESEARCH_LOOP_SOURCE_RELATIVES = {
  research: 'src/claude/skills/research/SKILL.md',
  agent: 'src/claude/agents/researcher.md',
  loop: 'src/claude/skills/loop/SKILL.md',
  protocol: 'src/claude/skills/loop/references/bounded-loop-protocol.md',
  metric: 'src/claude/skills/loop/references/metric-and-guard-contract.md',
  workflow: 'src/claude/rules/skill-workflow-routing.md',
  domain: 'src/claude/rules/skill-domain-routing.md',
};
const HOTFIX_SOURCE_RELATIVES = {
  skill: 'src/claude/skills/hotfix/SKILL.md',
  review: 'src/claude/skills/hotfix/references/review-cycle.md',
  parallel: 'src/claude/skills/hotfix/references/parallel-patterns.md',
  specialized: 'src/claude/skills/hotfix/references/workflow-specialized.md',
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
    { from: 'Route Direct first, then\napply controls only to requests that remain in Brainstorm.', to: 'Apply controls before Direct classification.', clause: 'Route Direct first, then apply controls only to requests that remain in Brainstorm.' },
  ] },
  { group: 'ordered-depth', mutations: [
    { from: 'With no Deep signal, use Standard.', to: 'Deep is always the default.', clause: 'With no Deep signal, use Standard. `--deep` raises Standard to Deep.' },
  ] },
  { group: 'leading-flags', mutations: [
    { from: 'Parse controls only from the leading consecutive token segment.', to: 'Parse flag-like tokens anywhere.', clause: 'Parse controls only from the leading consecutive token segment.' },
    { from: '`--deep`, `--visual`, and `--advice` in any order, each at most once.', to: '`--deep`, `--visual`, and `--advice` may repeat.', clause: '`--deep`, `--visual`, and `--advice` in any order, each at most once.' },
    { from: '`--` ends\nthe control segment.', to: '`--` is treated as another control.', clause: '`--` ends the control segment.' },
    { from: 'An unknown or duplicate `--*` inside the leading segment returns usage', to: 'An unknown or duplicate `--*` is ignored', clause: 'An unknown or duplicate `--*` inside the leading segment returns usage and performs no scout, question, tool call, write, or workflow action.' },
  ] },
  { group: 'lens-trigger-skip', mutations: [
    { from: 'failure isolation for partial or cascading failure\nacross boundaries', to: 'generic failure notes', clause: 'failure isolation for partial or cascading failure across boundaries' },
  ] },
  { group: 'evidence-semantics', mutations: [
    { from: 'Missing evidence\nforces feasibility `unknown` and confidence `low`.', to: 'Missing evidence permits a confident guess.', clause: 'Missing evidence forces feasibility `unknown` and confidence `low`.' },
  ] },
  { group: 'numeric-estimates', mutations: [
    { from: 'A numeric estimate requires\nrange, unit, basis, evidence, and assumptions; otherwise report `unknown`.', to: 'A numeric estimate may be a best-effort number.', clause: 'A numeric estimate requires range, unit, basis, evidence, and assumptions; otherwise report `unknown`.' },
  ] },
  { group: 'pre-tool-authority-redaction', mutations: [
    { from: 'Before an\nexternal visual tool or adviser handoff, minimize context and redact secrets,\ncredentials, private keys, access tokens, and unnecessary PII.', to: 'Forward full context to every external tool and adviser.', clause: 'Before an external visual tool or adviser handoff, minimize context and redact secrets, credentials, private keys, access tokens, and unnecessary PII.' },
    { from: '`--visual` may present inline Mermaid or ASCII for any non-direct analysis and\nfalls back to equivalent text when rendering is unavailable.', to: '`--visual` fails when rendering is unavailable.', clause: '`--visual` may present inline Mermaid or ASCII for any non-direct analysis and falls back to equivalent text when rendering is unavailable.' },
    { from: 'Durable or external\nrendering requires explicit user authority before invocation.', to: 'Durable or external rendering may run without consent.', clause: 'Durable or external rendering requires explicit user authority before invocation.' },
  ] },
  { group: 'adviser-gate-fallback', mutations: [
    { from: '`--advice` invokes\n`brainstormer` only after the material-choice gate;', to: '`--advice` invokes `brainstormer` before routing;', clause: '`--advice` invokes `brainstormer` only after the material-choice gate;' },
    { from: 'if advice is unavailable or\nfails, label it unavailable and continue with controller analysis.', to: 'if advice is unavailable, stop the workflow.', clause: 'if advice is unavailable or fails, label it unavailable and continue with controller analysis.' },
  ] },
  { group: 'decision-brief', mutations: [
    { from: 'The first section records target\nidentity, current source revision and worktree state or `[UNVERIFIED]`, an\nevidence-as-of value, and what change invalidates the brief.', to: 'The handoff has no revision or freshness binding.', clause: 'The first section records target identity, current source revision and worktree state or `[UNVERIFIED]`, an evidence-as-of value, and what change invalidates the brief.' },
  ] },
  { group: 'no-persistence-dispatch', mutations: [
    { from: 'Neither overlay\nwrites, approves, persists, dispatches, or completes work.', to: 'Overlays may persist, approve, dispatch, and complete work.', clause: 'Neither overlay writes, approves, persists, dispatches, or completes work.' },
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

function installedRouteFiles(project, platform) {
  const runtimeRoot = platform === 'codex' ? '.codex' : '.claude';
  const root = path.join(project, platform === 'codex' ? '.agents/skills/route' : '.claude/skills/route');
  return {
    skill: path.join(root, 'SKILL.md'),
    taxonomy: path.join(root, 'references/task-taxonomy.md'),
    chaining: path.join(root, 'references/chaining-patterns.md'),
    timing: path.join(root, 'references/agent-timing.md'),
    workflow: path.join(project, runtimeRoot, 'rules/skill-workflow-routing.md'),
    domain: path.join(project, runtimeRoot, 'rules/skill-domain-routing.md'),
  };
}

function routeProjectionIssues(files) {
  const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [
    key, fs.readFileSync(file, 'utf8').replace(/\s+/g, ' '),
  ]));
  const issues = new Set();
  const requires = (issue, clauses) => {
    if (clauses.some(([source, clause]) => !text[source].includes(clause))) issues.add(issue);
  };
  requires('direct-path', [
    ['skill', 'invoke that skill directly'],
    ['skill', 'use it directly without constructing a chain'],
    ['skill', 'Do not create a route chain or spawn agents merely to answer it'],
  ]);
  requires('classification', [
    ['skill', 'final deliverable'], ['skill', 'highest-link risk'],
    ['skill', 'number of material domains'],
  ]);
  requires('link-contract', [
    ['chaining', '**Entry:**'], ['chaining', '**Exit:**'], ['chaining', '**Owner:** exactly one'],
  ]);
  requires('failure-stop', [
    ['chaining', '(link, owner, normalized cause)'],
    ['chaining', 'Two failures with the same failure key stop the chain'],
    ['chaining', 'Different normalized causes do not share a key'],
  ]);
  requires('collapse-and-detour', [
    ['skill', 'remove every link whose output is already evidenced'],
    ['chaining', 'preserve its valid exit evidence, normalize the root cause, and choose one bounded detour'],
  ]);
  requires('delegation-contract', [
    ['timing', '**Outcome** — observable result'],
    ['timing', '**Scope** — owned files, systems, or questions'],
    ['timing', '**Inputs** — current evidence and prerequisite artifacts'],
    ['timing', '**Constraints** — safety, compatibility, authority, and non-goals'],
    ['timing', '**Acceptance** — proof required for completion'],
    ['timing', '**Handoff** — expected returned artifact and destination'],
    ['timing', '**Status vocabulary** — `DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`'],
  ]);
  requires('agent-fallback', [
    ['timing', 'If the preferred agent is absent'],
    ['timing', 'never synthesize a role'],
    ['timing', 'DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT'],
  ]);
  requires('authority', [
    ['skill', 'never expand it'],
    ['skill', 'diagnosis does not authorize repair'],
    ['skill', 'does not authorize commit, push, deploy, publish, or release'],
  ]);
  requires('risk-gates', [
    ['skill', 'require independent review and user confirmation before advancing past the high-risk gate'],
  ]);
  requires('proof-boundary', [
    ['skill', 'remains `[UNPROVEN]` until a separate host run observes it'],
  ]);
  requires('rule-direct-path', [
    ['workflow', 'If the user names a valid installed skill, use it directly'],
    ['workflow', 'If one obvious low-risk installed skill covers the intent, use it directly'],
    ['workflow', 'do not invoke Route or agents for ceremony'],
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

function packedResearchLoopPaths(project, platform) {
  return platform === 'codex'
    ? {
        research: path.join(project, '.agents/skills/research/SKILL.md'),
        agent: path.join(project, '.codex/agents/researcher.toml'),
        loop: path.join(project, '.agents/skills/loop/SKILL.md'),
        protocol: path.join(project, '.agents/skills/loop/references/bounded-loop-protocol.md'),
        metric: path.join(project, '.agents/skills/loop/references/metric-and-guard-contract.md'),
        workflow: path.join(project, '.codex/rules/skill-workflow-routing.md'),
        domain: path.join(project, '.codex/rules/skill-domain-routing.md'),
      }
    : {
        research: path.join(project, '.claude/skills/research/SKILL.md'),
        agent: path.join(project, '.claude/agents/researcher.md'),
        loop: path.join(project, '.claude/skills/loop/SKILL.md'),
        protocol: path.join(project, '.claude/skills/loop/references/bounded-loop-protocol.md'),
        metric: path.join(project, '.claude/skills/loop/references/metric-and-guard-contract.md'),
        workflow: path.join(project, '.claude/rules/skill-workflow-routing.md'),
        domain: path.join(project, '.claude/rules/skill-domain-routing.md'),
      };
}

function readPackedResearchLoop(project, platform) {
  const paths = packedResearchLoopPaths(project, platform);
  const values = Object.fromEntries(Object.entries(paths).map(([key, target]) => [
    key, fs.readFileSync(target, 'utf8'),
  ]));
  if (platform === 'codex') {
    values.agent = parseGeneratedTomlString(values.agent, 'developer_instructions');
  }
  return values;
}

function packedResearchLoopIssues(project, platform) {
  const values = Object.fromEntries(Object.entries(readPackedResearchLoop(project, platform)).map(
    ([key, value]) => [key, value.replace(/\s+/g, ' ').trim()]
  ));
  const issues = new Set();
  const publicResearch = platform === 'codex' ? 'name: cf-research' : 'name: cf:research';
  const publicLoop = platform === 'codex' ? 'name: cf-loop' : 'name: cf:loop';
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
  if (!values.loop.includes(publicLoop)
    || !values.loop.includes('Loop is explicit-only. Never auto-route ordinary implementation, debugging, or research into Loop.')
    || !values.loop.includes('Reject dirty in-scope state; record but never import or clean out-of-scope dirt.')
    || !values.loop.includes('separately approved external realpath')
    || !values.loop.includes('complete detached-worktree tracked/untracked manifest')
    || !values.loop.includes('Live-agent adherence to this written contract is `[UNPROVEN]` without a host run.')) {
    issues.add('loop-safety');
  }
  if (!values.metric.includes('Guard is mandatory, fixed before baseline, and distinct from Metric.')
    || !values.metric.includes('`numeric_format`: exactly IEEE-754 binary64')
    || !values.metric.includes('nonzero exit')
    || !values.metric.includes('require median, noise, improvement, and required delta to remain finite.')) {
    issues.add('metric-guard');
  }
  if (!values.protocol.includes('do not clean. Preserve the exact path, PID/process evidence, and ownership marker; return `BLOCKED`')
    || !values.protocol.includes('`base_oid`;')
    || !values.protocol.includes('patch byte length and lowercase SHA-256')) {
    issues.add('failure-handoff');
  }
  if (!values.workflow.includes('numeric optimization capability remains explicit-only and must never be auto-routed.')
    || !values.domain.includes('explicit-only numeric optimization capability unless the user invokes it with its required bounded metric/guard contract.')) {
    issues.add('explicit-routing');
  }
  return [...issues].sort();
}

function assertPackedResearchLoopParity(project, platform) {
  const installed = packedResearchLoopPaths(project, platform);
  for (const [key, relative] of Object.entries(RESEARCH_LOOP_SOURCE_RELATIVES)) {
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
    ? ['.agents/skills/research/', '.agents/skills/loop/']
    : ['skills/research/', 'skills/loop/'];
  for (const prefix of prefixes) {
    assert.ok(Object.keys(manifest.files).some((entry) => entry.startsWith(prefix)), `${platform} manifest missing ${prefix}`);
  }
  assert.deepEqual(packedResearchLoopIssues(project, platform), []);
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
      from: 'After applying an accepted C2 finding, a fresh-context closure pass records and\nfreshly replays its original counterexample after the repair under this exact review-log header:',
      to: 'After applying an accepted C2 finding, record the repair under this review-log header:',
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
      '`Required proof` is execution evidence: known but unrun proof blocks `pending`; `UNKNOWN` may proceed; missing evidence may still reach `done`/C3.', ['proof-lifecycle']],
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
      'Apply the risk-first route before C1 and stop only for direct work.', ['spec-maker-authority']],
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
  const finalState = path.join(scripts, 'spec-final-state.cjs');
  const readiness = path.join(scripts, 'spec-readiness.cjs');
  const gate = path.join(
    root,
    platform === 'claude' ? '.claude/hooks/spec-gate.cjs' : '.codex/hooks/spec-gate.cjs'
  );
  const authorityDir = path.join(root, platform === 'claude' ? '.claude/hooks' : '.codex/hooks');
  const authority = path.join(authorityDir, 'completion-authority.cjs');
  const authorityCheck = path.join(authorityDir, 'completion-authority-check.cjs');
  const authorityState = path.join(authorityDir, 'completion-authority-state.cjs');
  const semanticAuthority = path.join(authorityDir, 'semantic-review-authority.cjs');
  for (const file of [helper, policy, resolver, receipt, finalState, readiness]) {
    assert.equal(fs.existsSync(file), true, `${platform} installed file missing: ${file}`);
  }
  assert.equal(fs.existsSync(gate), true, `${platform} installed gate missing: ${gate}`);

  for (const file of [authority, authorityCheck, authorityState, semanticAuthority]) {
    assert.equal(fs.existsSync(file), true, `${platform} installed completion authority missing: ${file}`);
  }
  const finalStateBytes = fs.readFileSync(finalState);
  fs.rmSync(finalState);
  const missingFinalState = spawnSync(process.execPath, [authority, '--stop'], {
    cwd: root,
    env: { ...process.env, PROJECT_ROOT: root },
    input: JSON.stringify({ cwd: root, session_id: fixture.session, hook_event_name: 'Stop' }),
    encoding: 'utf8',
  });
  assert.equal(JSON.parse(missingFinalState.stdout).decision, 'block', `${platform} missing final-state closure must fail closed`);
  const escapedFinalState = path.join(root, 'escaped-spec-final-state.cjs');
  fs.writeFileSync(escapedFinalState, finalStateBytes);
  fs.symlinkSync(escapedFinalState, finalState);
  const symlinkFinalState = spawnSync(process.execPath, [authority, '--stop'], {
    cwd: root,
    env: { ...process.env, PROJECT_ROOT: root },
    input: JSON.stringify({ cwd: root, session_id: fixture.session, hook_event_name: 'Stop' }),
    encoding: 'utf8',
  });
  assert.equal(JSON.parse(symlinkFinalState.stdout).decision, 'block', `${platform} symlinked final-state closure must fail closed`);
  fs.rmSync(finalState);
  fs.writeFileSync(finalState, finalStateBytes);
  fs.rmSync(escapedFinalState);
  const authorityCheckBytes = fs.readFileSync(authorityCheck);
  fs.writeFileSync(authorityCheck, 'module.exports = {};\n');
  const malformedAuthority = spawnSync(process.execPath, [authority, '--stop'], {
    cwd: root,
    env: { ...process.env, PROJECT_ROOT: root },
    input: JSON.stringify({ cwd: root, session_id: fixture.session, hook_event_name: 'Stop' }),
    encoding: 'utf8',
  });
  assert.equal(malformedAuthority.status, 0, `${platform} malformed authority must fail closed`);
  assert.equal(JSON.parse(malformedAuthority.stdout).decision, 'block');
  fs.writeFileSync(authorityCheck, authorityCheckBytes);
  fs.rmSync(authorityCheck);
  const missingAuthority = spawnSync(process.execPath, [authority, '--stop'], {
    cwd: root,
    env: { ...process.env, PROJECT_ROOT: root },
    input: JSON.stringify({ cwd: root, session_id: fixture.session, hook_event_name: 'Stop' }),
    encoding: 'utf8',
  });
  assert.equal(missingAuthority.status, 0, `${platform} missing authority dependency must fail closed`);
  assert.equal(JSON.parse(missingAuthority.stdout).decision, 'block');
  fs.writeFileSync(authorityCheck, authorityCheckBytes);

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
  const grounder = path.join(scripts, 'spec-ground.cjs');
  const finalState = path.join(scripts, 'spec-final-state.cjs');
  const readiness = path.join(scripts, 'spec-readiness.cjs');
  const validator = path.join(scripts, 'validate-spec-output.cjs');
  assert.ok(fs.existsSync(policy), `installed policy missing: ${policy}`);
  assert.ok(fs.existsSync(scanner), `installed scanner missing: ${scanner}`);
  assert.ok(fs.existsSync(grounder), `installed validator dependency missing: ${grounder}`);
  assert.ok(fs.existsSync(finalState), `installed final-state dependency missing: ${finalState}`);
  assert.ok(fs.existsSync(readiness), `installed readiness finalizer missing: ${readiness}`);
  assert.ok(fs.existsSync(validator), `installed validator missing: ${validator}`);

  const policyRun = spawnSync(process.execPath, [policy, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(policyRun.status, 0, `${policyRun.stdout}\n${policyRun.stderr}`);
  assert.equal(JSON.parse(policyRun.stdout).contract, 'execution-policy');

  const validatorRun = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
  assert.equal(validatorRun.status, 2, `${validatorRun.stdout}\n${validatorRun.stderr}`);
  assert.match(validatorRun.stderr, /Usage: .*validate-spec-output\.cjs/);
  assert.doesNotMatch(validatorRun.stderr, /MODULE_NOT_FOUND|Cannot find module/);

  const safe = path.join(root, 'safe.txt');
  fs.writeFileSync(safe, 'mode=safe\n');
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['add', 'safe.txt'], { cwd: root });
  const scannerRun = spawnSync(process.execPath, [scanner], { cwd: root, encoding: 'utf8' });
  assert.equal(scannerRun.status, 0, `${scannerRun.stdout}\n${scannerRun.stderr}`);
  assert.match(scannerRun.stdout, /No staged secrets found/);
}

function installedSemanticPaths(root, platform) {
  const runtimeRoot = path.join(root, RUNTIMES[platform].root);
  const skillRoot = platform === 'codex'
    ? path.join(root, '.agents', 'skills')
    : path.join(runtimeRoot, 'skills');
  const paths = {
    policy: path.join(runtimeRoot, 'scripts', 'workflow-policy.cjs'),
    scaffold: path.join(runtimeRoot, 'scripts', 'spec-scaffold.cjs'),
    validator: path.join(runtimeRoot, 'scripts', 'validate-spec-output.cjs'),
    authoringValidator: path.join(runtimeRoot, 'scripts', 'spec-authoring-validation.cjs'),
    authoringDigest: path.join(runtimeRoot, 'scripts', 'spec-authoring-digest.cjs'),
    grounder: path.join(runtimeRoot, 'scripts', 'spec-ground.cjs'),
    finalState: path.join(runtimeRoot, 'scripts', 'spec-final-state.cjs'),
    readiness: path.join(runtimeRoot, 'scripts', 'spec-readiness.cjs'),
    semanticModel: path.join(runtimeRoot, 'scripts', 'spec-semantic-model.cjs'),
    resolver: path.join(runtimeRoot, 'scripts', 'spec-resolver.cjs'),
    provenance: path.join(runtimeRoot, 'scripts', 'provenance.cjs'),
    completion: path.join(runtimeRoot, 'hooks', 'completion-authority-check.cjs'),
    semanticAuthority: path.join(runtimeRoot, 'hooks', 'semantic-review-authority.cjs'),
    stateTemplate: path.join(skillRoot, 'specs', 'templates', 'spec-state.json'),
  };
  for (const [name, target] of Object.entries(paths)) {
    assert.equal(fs.existsSync(target), true, `${platform} installed ${name} missing: ${target}`);
    assert.equal(path.relative(root, target).startsWith('..'), false, `${platform} ${name} escaped install root`);
  }
  return paths;
}

function runInstalled(script, args, root, expected = 0) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, expected, `${script}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function materializeSpecState(paths, root, feature, { strict = false } = {}) {
  const featureDir = path.join(root, 'specs', feature);
  runInstalled(paths.scaffold, [feature], root);
  const state = JSON.parse(fs.readFileSync(path.join(featureDir, 'spec.json'), 'utf8'));
  state.scope_lock.in_scope = [`${feature} behavior`];
  state.scope_lock.out_of_scope = ['unrelated behavior'];
  if (strict) {
    state.workflow_policy.assurance_level = 'Strict';
    state.workflow_policy.classified_minimum.assurance_level = 'Strict';
    state.workflow_policy.risks = ['auth'];
  }
  writeJson(path.join(featureDir, 'spec.json'), state);
  return { featureDir, specFile: path.join(featureDir, 'spec.json'), state };
}

function requirementsProjection({ proof = false } = {}) {
  return `# Requirements

## Requirements

### Requirement 1: Installed behavior

- **R1.1**: The CommonJS entrypoint \`src/entry.js\` shall return an object containing only status \`enabled\` when its sole \`valid\` argument is the boolean \`true\`; it shall return an object containing only status \`rejected\` for \`false\`, a missing argument, or any non-boolean value.${proof ? '\n- **R1.2**: The installed verifier shall prove the observed entry behavior through its grounded evidence boundary.' : ''}
`;
}

const TYPED_ANCHOR_COLUMNS = ['ID', 'Type', 'Target', 'Role', 'Access', 'Action'];

function typedAnchorTable(rows) {
  assert.ok(Array.isArray(rows) && rows.length > 0, 'typed anchor projection requires rows');
  const header = `| ${TYPED_ANCHOR_COLUMNS.join(' | ')} |`;
  const separator = `|${TYPED_ANCHOR_COLUMNS.map(() => '---').join('|')}|`;
  const body = rows.map((row) => {
    assert.deepEqual(Object.keys(row), ['id', 'type', 'target', 'role', 'access', 'action']);
    assert.ok(Object.values(row).every((value) => typeof value === 'string' && value.trim() !== ''));
    return `| ${row.id} | ${row.type} | \`${row.target}\` | ${row.role} | ${row.access} | ${row.action} |`;
  });
  return [header, separator, ...body].join('\n');
}

function designProjection({
  expected = 'exit 0; boolean true returns the exact enabled object; false, undefined, null, `"true"`, 1, and an object return the exact rejected object',
  taskful = false,
} = {}) {
  const anchors = typedAnchorTable([{
    id: 'A-D-01', type: 'file', target: taskful ? 'src/design-boundary.js' : 'src/entry.js',
    role: taskful ? 'existing design boundary for the entrypoint' : 'existing runtime entrypoint and contract owner',
    access: 'read', action: 'read',
  }]);
  const reachabilityAnchors = taskful ? 'A-R1-01-01, A-R1-02-02' : 'A-D-01';
  return `# Design

## Boundary

- **Owns:** The exact return contract of the CommonJS function exported by \`src/entry.js\`.
- **Reads:** One \`valid\` argument; only the boolean \`true\` is valid.
- **Writes/exposes:** Exactly one status field whose value is \`enabled\` or \`rejected\`.
- **Outside boundary:** Unrelated runtime behavior.

## Typed Anchors

${anchors}

## Decisions and Invariants

### D1 — Installed result decision

- **Decision:** \`valid === true\` returns an object containing only status \`enabled\`; every other value returns an object containing only status \`rejected\`.
- **Rejects ambiguity:** Truthy non-booleans such as \`"true"\` never count as valid.
- **Negative path:** \`false\`, \`undefined\`, \`null\`, strings, numbers, and objects return rejected.
- **Anchors:** A-D-01

### I1 — Rejection invariant

Any input other than the boolean \`true\` never returns enabled.

### C1 — Result contract

- **Owner:** A-D-01
- **Consumers:** \`test/entry.test.js\` and callers of the CommonJS export.
- **Shape/behavior:** The result is an object with exactly one \`status\` field set to \`enabled\` or \`rejected\`.
- **Compatibility:** The strict boolean discriminator, exact object shape, and two status values remain stable.

## Verification Definitions

- **V1**: Criteria R1.1; Owner ${taskful ? 'R1-01' : 'A-D-01'}; ${taskful ? 'Proof criteria R1.2; Proof owner R1-02; Evidence anchor A-R1-02-02; ' : ''}Decision refs D1, I1, C1; Method command \`node --test test/entry.test.js\`; Expected ${expected}; Negative/failure \`false\`, missing input, \`null\`, and truthy non-booleans all return the exact rejected object; Reachability/grounding entrypoint \`src/entry.js\` via ${reachabilityAnchors}.
`;
}

function completeSemanticReview(paths, root, fixture, counterexamples) {
  // C16/D13: only the installed spec-authoring-validation.cjs coordinator may
  // flip authoring.* to validated and write the matching receipt (I21/R3.9) —
  // run it over the fixture's current bytes instead of hand-writing the enum.
  // Lifecycle order (I15/R3.7): authoring -> coordinator -> semantic review ->
  // readiness, never the reverse.
  runInstalled(paths.scaffold, [fixture.state.feature_name, '--sync-semantic-model'], root);
  runInstalled(paths.authoringValidator, [fixture.featureDir], root);
  const state = JSON.parse(fs.readFileSync(fixture.specFile, 'utf8'));
  fixture.reviewResult = {
    verdict: 'PASS',
    findings: [],
    unresolved_decisions: [],
    graph_coverage: [
      'criterion_local', 'cross_criterion', 'runtime_path',
      'assumption_provenance', 'compatibility_migration',
    ].map((surface) => ({
      surface, covered: true,
      notes: 'The review covers this semantic surface against the canonical model.',
    })),
    reviewed_criteria: counterexamples.map(({ criterion }) => criterion),
    counterexamples,
    reviewer_evidence: null,
  };
  if (state.workflow_policy.assurance_level === 'Strict') {
    const digest = runInstalled(paths.validator, [fixture.featureDir, '--semantic-digest'], root).stdout.trim();
    assert.match(digest, /^sha256:[a-f0-9]{64}$/);
    return digest;
  }
  const reviewFile = path.join(fixture.featureDir, '.review-result.json');
  writeJson(reviewFile, fixture.reviewResult);
  runInstalled(paths.readiness, [fixture.featureDir, '--review-result', reviewFile], root);
  fs.unlinkSync(reviewFile);
  runInstalled(paths.validator, [fixture.featureDir], root);
  runInstalled(paths.grounder, [fixture.featureDir, '--root', root], root);
  return JSON.parse(fs.readFileSync(fixture.specFile, 'utf8')).validation.semantic_review.semantic_digest;
}

function createTasklessFixture(paths, root, feature, options = {}) {
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'entry.js'), 'module.exports = (valid) => ({ status: valid === true ? "enabled" : "rejected" });\n');
  fs.writeFileSync(path.join(root, 'src', 'design-boundary.js'), 'module.exports = { entry: "src/entry.js" };\n');
  fs.writeFileSync(path.join(root, 'test', 'entry.test.js'), `const test = require('node:test');
const assert = require('node:assert/strict');
const entry = require('../src/entry.js');

test('entry accepts only the boolean true discriminator', () => {
  assert.deepEqual(entry(true), { status: 'enabled' });
  for (const invalid of [false, undefined, null, 'true', 1, {}]) {
    assert.deepEqual(entry(invalid), { status: 'rejected' });
  }
});
`);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const fixture = materializeSpecState(paths, root, feature, options);
  fs.writeFileSync(path.join(fixture.featureDir, 'requirements.md'), requirementsProjection());
  fs.writeFileSync(path.join(fixture.featureDir, 'design.md'), designProjection());
  fixture.digest = completeSemanticReview(paths, root, fixture, [{
    criterion: 'R1.1', case_kind: 'failure',
    scenario: 'The installed entry receives input without the required discriminator.',
    expected: 'The installed entry returns rejected and never returns enabled.',
    decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
  }]);
  return fixture;
}

function taskProjection({ id, title, ownedPath, criterion, verificationRef, role, artifact = false }) {
  const artifactPath = `artifacts/${id}.json`;
  const anchors = typedAnchorTable([
    { id: `A-${id}-01`, type: 'file', target: ownedPath, role: 'owner', access: 'write', action: 'modify' },
    ...(artifact ? [{
      id: `A-${id}-02`, type: 'artifact', target: artifactPath,
      role: 'verifier', access: 'write', action: 'create',
    }] : []),
    {
      id: `A-${id}-${artifact ? '03' : '02'}`, type: 'command',
      target: 'node --test test/entry.test.js', role: 'verifier', access: 'read', action: 'read',
    },
  ]);
  return `# Task ${id}: ${title}
**Status:** pending

## Outcome

Deliver observable ${title.toLowerCase()} behavior through the installed entrypoint.

## Scope

- **In scope:** Exact behavior owned at ${ownedPath}.
- **Out of scope:** Unrelated runtime behavior.

## Anchors and Ownership

${anchors}

## Changes

- [ ] Implement the exact owned behavior. _Requirements: ${criterion.slice(1)}_

## Acceptance

- **${criterion}:** The installed command returns the criterion-specific observable state.

## Dependencies

- none

## Verification Plan

- **Verification ref:** ${verificationRef}
- **Task role:** ${role}
- **Command:** \`node --test test/entry.test.js\`
- **Expected:** Exit code 0 and the criterion-specific state is observed.${artifact ? ` The artifact \`${artifactPath}\` must exist, and SHA-256 over its current bytes must match the recorded digest.` : ''}
- **Negative path:** Invalid input returns the named rejected state.
- **Reachability:** \`src/entry.js\` is reached by the installed test command.
`;
}

function createTaskFixture(paths, root, feature) {
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const fixture = materializeSpecState(paths, root, feature);
  fs.writeFileSync(path.join(fixture.featureDir, 'requirements.md'), requirementsProjection({ proof: true }));
  fs.writeFileSync(path.join(fixture.featureDir, 'design.md'), designProjection({
    expected: 'exit 0, status enabled, and verifier artifact `artifacts/R1-02.json` whose SHA-256 over current bytes matches the recorded digest',
    taskful: true,
  }));
  const taskOne = 'tasks/task-R1-01-implement.md';
  const taskTwo = 'tasks/task-R1-02-verify.md';
  fs.mkdirSync(path.join(fixture.featureDir, 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(fixture.featureDir, taskOne), taskProjection({
    id: 'R1-01', title: 'Implement behavior', ownedPath: 'src/entry.js', criterion: 'R1.1',
    verificationRef: 'V1', role: 'subject implements R1.1',
  }));
  fs.writeFileSync(path.join(fixture.featureDir, taskTwo), taskProjection({
    id: 'R1-02', title: 'Verify behavior', ownedPath: 'test/entry.test.js', criterion: 'R1.2',
    verificationRef: 'V1', role: 'verifier verifies V1 through separately owned R1.2 proof', artifact: true,
  }));
  const state = fixture.state;
  state.authoring.tasks = 'draft';
  state.task_files = [taskOne, taskTwo];
  state.task_registry = Object.fromEntries([
    [taskOne, { id: 'R1-01', title: 'Implement behavior', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null }],
    [taskTwo, { id: 'R1-02', title: 'Verify behavior', status: 'pending', dependencies: [], blocker: null, started_at: null, completed_at: null, last_updated_at: null }],
  ]);
  state.coordination.boundaries = [{
    id: 'B-OWN', type: 'ownership', tasks: ['R1-01', 'R1-02'],
    write_sets: { 'R1-01': ['src/entry.js'], 'R1-02': ['test/entry.test.js', 'artifacts/R1-02.json'] },
  }, {
    id: 'B-PROOF', type: 'proof', subject: 'R1-01', verifier: 'R1-02',
    verification_ref: 'V1', artifact_anchor: 'A-R1-02-02',
  }];
  writeJson(fixture.specFile, state);
  fixture.digest = completeSemanticReview(paths, root, fixture, [{
    criterion: 'R1.1', case_kind: 'failure',
    scenario: 'Invalid input reaches the installed implementation boundary.',
    expected: 'The implementation returns rejected and never reports enabled.',
    decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
  }, {
    criterion: 'R1.2', case_kind: 'failure',
    scenario: 'The verification command completes without producing its proof artifact.',
    expected: 'The verification criterion remains unsatisfied until `artifacts/R1-02.json` exists and its SHA-256 over current bytes matches the recorded digest.',
    decision_refs: ['D1', 'I1', 'C1'], verification_ref: 'V1',
  }]);
  return fixture;
}

function initializeGit(root) {
  fs.writeFileSync(path.join(root, '.gitignore'), `${'node_' + 'modules'}/\n`);
  for (const args of [
    ['init', '-q'], ['config', 'user.name', 'CafeKit Packed E2E'],
    ['config', 'user.email', 'packed-e2e@example.invalid'],
    ['add', '--', '.gitignore', 'src/entry.js', 'src/design-boundary.js', 'test/entry.test.js', 'package.json'],
    ['commit', '--no-gpg-sign', '-qm', 'packed semantic fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }
}

function assertInstalledCompletion(paths, root, platform, fixture) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-completion-home-'));
  const code = `
const fs = require('fs');
const path = require('path');
const policy = require(process.argv[1]);
const provenance = require(process.argv[2]);
const checker = require(process.argv[3]);
const resolver = require(process.argv[4]);
const root = process.argv[5];
const feature = process.argv[6];
const specFile = path.join(root, 'specs', feature, 'spec.json');
const state = JSON.parse(fs.readFileSync(specFile, 'utf8'));
state.status = 'done';
fs.writeFileSync(specFile, JSON.stringify(state, null, 2) + '\\n');
const context = provenance.deriveRuntimeContext({ projectRoot: root, specsRoot: path.join(root, 'specs'), specFile, featureName: feature, runtimeSession: 'packed-session' });
fs.writeFileSync(path.join(root, 'specs', feature, 'feature-receipt.md'), ['Verification: PASS','Command: node --test','Exit: 0','Result: PASS','Expected: installed behavior passes','Observed: installed behavior passed','Base: ' + context.base,'Head: ' + context.head,'Feature: ' + feature].join('\\n') + '\\n');
const result = checker.evaluateCloseout({ resolver, policy, projectRoot: root, runtime: {}, payload: { session_id: 'packed-session', featureName: feature } });
process.stdout.write(JSON.stringify({ ok: result.ok, active: result.active, reason: result.reason || null, feature: result.candidate && result.candidate.featureName }));`;
  const result = spawnSync(process.execPath, ['-e', code, paths.policy, paths.provenance, paths.completion, paths.resolver, root, fixture.state.feature_name], {
    cwd: root, encoding: 'utf8', env: { ...process.env, HOME: home },
  });
  fs.rmSync(home, { recursive: true, force: true });
  assert.equal(result.status, 0, `${platform}\n${result.stdout}\n${result.stderr}`);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true, active: true, reason: null, feature: fixture.state.feature_name,
  });
}

function assertInstalledResolution(paths, root, platform, explicitFeature) {
  const code = `
const checker = require(process.argv[1]); const resolver = require(process.argv[2]);
const root = process.argv[3]; const platform = process.argv[4]; const feature = process.argv[5];
const base = { projectRoot: root, runtime: {}, payload: {} };
if (platform === 'claude') base.resolver = resolver;
const explicit = checker.resolveCandidate({ ...base, payload: { featureName: feature } });
const ambiguous = checker.resolveCandidate(base);
process.stdout.write(JSON.stringify({ explicit: explicit && explicit.featureName, error: ambiguous && ambiguous.error, candidates: ambiguous && ambiguous.candidates }));`;
  const result = spawnSync(process.execPath, ['-e', code, paths.completion, paths.resolver, root, platform, explicitFeature], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const resolution = JSON.parse(result.stdout);
  assert.equal(resolution.explicit, explicitFeature);
  assert.equal(resolution.error, 'multiple_persisted');
  assert.ok(resolution.candidates.length >= 2);
}

function assertStrictSimulatedHandlerGuardrail(paths, root, fixture) {
  // Simulated SubagentStop handler chain — NOT a live Codex host E2E.
  // This exercises the installed hook's handler logic via direct spawn,
  // not a real Codex binary dispatching SubagentStop. For live host,
  // see the opt-in CAFEKIT_CODEX_HOST_E2E test below.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-strict-home-'));
  const code = `
const authority = require(process.argv[1]); const readiness = require(process.argv[2]); const root = process.argv[3]; const feature = process.argv[4]; const digest = process.argv[5]; const review = JSON.parse(process.argv[6]);
const spec_file = 'specs/' + feature + '/spec.json';
const marker = authority.MARKER + JSON.stringify({ feature_name: feature, spec_file, semantic_digest: digest, verdict: 'PASS' });
const before = authority.verifyAttestation(root, spec_file, feature, digest);
const {spawnSync} = require('child_process');
const authorityPath = process.argv[1];
function handlerInvoke(payload) {
  return spawnSync(process.execPath, [authorityPath], {cwd: root, input: JSON.stringify(payload), encoding:'utf8', env: {...process.env, HOME: process.env.HOME, USERPROFILE: process.env.HOME, PROJECT_ROOT: root}});
}
const forgedPayload = {cwd: root, hook_event_name: 'SubagentStop', session_id: 'self-session', agent_id: 'self', agent_type: 'spec-maker', last_assistant_message: marker};
const forgedRes = handlerInvoke(forgedPayload);
const afterForged = authority.verifyAttestation(root, spec_file, feature, digest);
const observedPayload = {cwd: root, hook_event_name: 'SubagentStop', session_id: 'host-session', agent_id: 'reviewer-1', agent_type: 'code-auditor', last_assistant_message: marker};
const observedRes = handlerInvoke(observedPayload);
const afterObserved = authority.verifyAttestation(root, spec_file, feature, digest);
const finalized = readiness.finalizeReadiness({ specDir: require('path').join(root, 'specs', feature), projectRoot: root, reviewResult: review });
process.stdout.write(JSON.stringify({ before: before.ok, forged: afterForged.ok, afterForged: afterForged.ok, observed: afterObserved.ok, afterObserved: afterObserved.ok, ready: finalized.spec.ready_for_implementation, forgedStderr: forgedRes.stderr.trim(), observedStderr: observedRes.stderr.trim() }));`;
  const result = spawnSync(process.execPath, ['-e', code, paths.semanticAuthority, paths.readiness, root, fixture.state.feature_name, fixture.digest, JSON.stringify(fixture.reviewResult)], {
    cwd: root, encoding: 'utf8', env: { ...process.env, HOME: home, PROJECT_ROOT: root },
  });
  fs.rmSync(home, { recursive: true, force: true });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const out = JSON.parse(result.stdout);
  // Simulated handler: forged self-attestation via spec-maker must NOT create observation, code-auditor must.
  assert.equal(out.before, false, 'strict attestation must be missing before simulated handler observation');
  assert.equal(out.afterForged, false, 'forged self-attestation must NOT create simulated handler observation');
  assert.equal(out.afterObserved, true, 'code-auditor simulated handler must create observation');
  assert.equal(out.ready, true, 'SPEC_READY after simulated handler observation');
  assert.ok(out.forgedStderr.includes('rejected') || out.forgedStderr === '', 'forged handler invoke should be rejected or silent but not create observation');
  assert.equal(out.observedStderr, '', 'code-auditor simulated handler observation should be silent');
}

function assertStaleDigestMutations(paths, root, taskless, taskBearing) {
  const requirementFile = path.join(taskless.featureDir, 'requirements.md');
  const requirementBytes = fs.readFileSync(requirementFile);
  fs.appendFileSync(requirementFile, '\nThe installed Markdown meaning changed.\n');
  assert.match(runInstalled(paths.validator, [taskless.featureDir], root, 1).stderr, /semantic_digest: stale/);
  fs.writeFileSync(requirementFile, requirementBytes);

  const tasklessState = JSON.parse(fs.readFileSync(taskless.specFile, 'utf8'));
  const originalPolicy = JSON.parse(JSON.stringify(tasklessState.workflow_policy));
  tasklessState.workflow_policy.planning_depth = 'Full';
  writeJson(taskless.specFile, tasklessState);
  assert.match(runInstalled(paths.validator, [taskless.featureDir], root, 1).stderr, /semantic_digest: stale/);
  tasklessState.workflow_policy = originalPolicy;
  writeJson(taskless.specFile, tasklessState);

  const taskState = JSON.parse(fs.readFileSync(taskBearing.specFile, 'utf8'));
  const originalId = taskState.coordination.boundaries[0].id;
  taskState.coordination.boundaries[0].id = 'B-OWN-MUTATED';
  writeJson(taskBearing.specFile, taskState);
  assert.match(runInstalled(paths.validator, [taskBearing.featureDir], root, 1).stderr, /semantic_digest: stale/);
  taskState.coordination.boundaries[0].id = originalId;
  writeJson(taskBearing.specFile, taskState);
}

function assertTransforms(root, platform) {
  const skillRoot = path.join(
    root,
    RUNTIMES[platform].root === '.codex' ? '.agents/skills' : `${RUNTIMES[platform].root}/skills`
  );
  const skill = path.join(skillRoot, 'develop', 'SKILL.md');
  const content = fs.readFileSync(skill, 'utf8');
  const scout = fs.readFileSync(path.join(skillRoot, 'inspect', 'SKILL.md'), 'utf8');
  const ask = fs.readFileSync(path.join(skillRoot, 'question', 'SKILL.md'), 'utf8');
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
  assert.equal(fs.existsSync(path.join(skillRoot, 'scout')), false);
  assert.equal(fs.existsSync(path.join(skillRoot, 'ask')), false);
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
    for (const required of [
      'src/claude/skills/route/SKILL.md',
      'src/claude/skills/route/references/task-taxonomy.md',
      'src/claude/skills/route/references/chaining-patterns.md',
      'src/claude/skills/route/references/agent-timing.md',
    ]) assert.ok(inventory.includes(required), required);

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
      assert.ok(catalog.skills.some((skill) => skill.public_id === 'cf:route'));
      assert.equal(catalog.skills.some((skill) => skill.public_id === 'cf:docs'), false);
      assert.deepEqual(routeProjectionIssues(installedRouteFiles(project, platform)), []);
    }
    const domain = fs.readFileSync(path.join(project, '.claude/rules/skill-domain-routing.md'), 'utf8');
    assert.doesNotMatch(domain, /\/cf:(?:docs|docx|pdf|pptx|xlsx|ai-multimodal)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('packed Route rejects semantic routing weakenings', () => {
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
      const files = installedRouteFiles(project, platform);
      assert.deepEqual(routeProjectionIssues(files), []);
      const mutations = [
        ['skill', 'direct-path', 'invoke that skill directly', 'reclassify that skill'],
        ['skill', 'classification', 'highest-link', 'average-link'],
        ['chaining', 'link-contract', '**Owner:** exactly one', '**Owner:** several possible'],
        ['chaining', 'collapse-and-detour', 'preserve its valid exit evidence, normalize the root cause,\nand choose one bounded detour', 'discard its valid exit evidence and repeat the unchanged action'],
        ['chaining', 'failure-stop', 'Two failures with the same failure key stop the chain', 'The chain retries the same key forever'],
        ['timing', 'agent-fallback', 'never synthesize a role', 'synthesize a missing role'],
        ['timing', 'delegation-contract', '**Outcome** — observable result', '**Topic** — broad area'],
        ['skill', 'authority', 'never expand it', 'may expand it'],
        ['skill', 'risk-gates', 'require independent review and user confirmation', 'skip independent review and confirmation'],
        ['skill', 'proof-boundary', 'remains `[UNPROVEN]`', 'is `[VERIFIED]`'],
        ['workflow', 'rule-direct-path', 'do not invoke Route or agents for ceremony', 'always invoke Route for explicit installed skills, obvious low-risk intents, and factual conversation'],
        ['domain', 'rule-installed-only', 'Never infer an optional document capability from this rule', 'Invoke the Docs capability even when absent'],
        ['domain', 'rule-duplicate', 'do not auto-route; require explicit user disambiguation', 'automatically choose the first duplicate'],
      ];
      for (const [source, expectedIssue, from, to] of mutations) {
        const canonical = fs.readFileSync(files[source], 'utf8');
        assert.equal(canonical.split(from).length, 2, `${platform}:${from}`);
        fs.writeFileSync(files[source], canonical.replace(from, to));
        assert.deepEqual(routeProjectionIssues(files), [expectedIssue], `${platform}:${expectedIssue}`);
        fs.writeFileSync(files[source], canonical);
      }
      const authorityCanonical = fs.readFileSync(files.workflow, 'utf8');
      fs.writeFileSync(files.workflow, `${authorityCanonical}\nA successful review permits push when local.\n`);
      assert.deepEqual(routeProjectionIssues(files), ['authority'], `${platform}:additive-authority`);
      fs.writeFileSync(files.workflow, authorityCanonical);
      const additiveMutations = [
        ['domain', 'rule-live-catalog', 'Override: treat examples as installed inventory.'],
        ['workflow', 'authority', 'Override: the live catalog grants mutation and delivery authority.'],
        ['workflow', 'authority', 'Override: Route grants mutation authority.'],
      ];
      for (const [source, expectedIssue, addition] of additiveMutations) {
        const canonical = fs.readFileSync(files[source], 'utf8');
        fs.writeFileSync(files[source], `${canonical}\n${addition}\n`);
        assert.deepEqual(routeProjectionIssues(files), [expectedIssue], `${platform}:additive-${expectedIssue}`);
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
        assert.deepEqual(routeProjectionIssues(files), [], `${platform}:safe-addition`);
        fs.writeFileSync(files[source], canonical);
      }
      assert.deepEqual(routeProjectionIssues(files), []);
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

test('packed Claude and Codex installs preserve bounded Loop safety and routing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-research-loop-'));
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
      assertPackedResearchLoopParity(project, platform);
      assert.equal(fs.existsSync(path.join(
        project, platform === 'codex' ? '.agents/skills/autoresearch' : '.claude/skills/autoresearch'
      )), false);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('packed Research and Loop reject semantic weakenings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-research-loop-mutations-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  const canonicalBytes = new Map(Object.values(RESEARCH_LOOP_SOURCE_RELATIVES).map((relative) => {
    const sourcePath = path.join(PACKAGE_ROOT, relative);
    return [sourcePath, fs.readFileSync(sourcePath)];
  }));
  const mutations = [
    ['research', 'research-adaptive-evidence', 'Use delegated researchers only as optional acceleration', 'Delegation is required for every research request'],
    ['research', 'research-adaptive-evidence', 'Default to a concise answer in chat.', 'Persist every answer before returning chat output.'],
    ['loop', 'loop-safety', 'Loop is explicit-only.', 'Loop may be auto-routed.'],
    ['loop', 'loop-safety', 'separately approved external', 'worktree-contained'],
    ['loop', 'loop-safety', 'complete detached-worktree tracked/untracked manifest', 'scoped manifest'],
    ['metric', 'metric-guard', 'Guard is mandatory,', 'Guard may be optional,'],
    ['metric', 'metric-guard', '`numeric_format`: exactly IEEE-754 binary64', '`numeric_format`: implementation-defined'],
    ['metric', 'metric-guard', 'nonzero exit', 'nonzero value'],
    ['protocol', 'failure-handoff', 'do not clean. Preserve the exact path', 'clean the uncertain path and continue'],
    ['protocol', 'failure-handoff', '`base_oid`;', '`optional_base`;'],
    ['workflow', 'explicit-routing', 'must never be auto-routed', 'should be auto-routed when optimization seems useful'],
  ];
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    for (const platform of ['claude', 'codex']) {
      const project = path.join(root, platform);
      const installer = installPacked(tarball, project, runtimeClosure);
      runInstaller(installer, project, [platform], null);
      assertPackedResearchLoopParity(project, platform);
      const paths = packedResearchLoopPaths(project, platform);
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
          assert.deepEqual(packedResearchLoopIssues(project, platform), [expectedIssue]);
          for (const [sourcePath, bytes] of canonicalBytes) assert.deepEqual(fs.readFileSync(sourcePath), bytes);
        } finally {
          fs.writeFileSync(target, original);
        }
        assert.deepEqual(packedResearchLoopIssues(project, platform), []);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('repository and package guides document adaptive Research and bounded Loop', () => {
  const guides = {
    repository: fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../README.md'), 'utf8'),
    package: fs.readFileSync(path.join(PACKAGE_ROOT, 'README.md'), 'utf8'),
  };
  for (const [name, guide] of Object.entries(guides)) {
    assert.match(guide, /cf:research/, `${name} names Claude Research`);
    assert.match(guide, /cf:loop/, `${name} names Claude Loop`);
    assert.match(guide, /\$cf-research/, `${name} names Codex Research`);
    assert.match(guide, /\$cf-loop/, `${name} names Codex Loop`);
    assert.match(guide, /Quick, Standard, or Deep/, `${name} documents adaptive Research depth`);
    assert.match(guide, /explicit-only|never selected automatically/i, `${name} keeps Loop explicit-only`);
    for (const field of ['Goal', 'Scope', 'Metric', 'Direction', 'Baseline', 'Guard', 'minimum delta', 'budget']) {
      assert.match(guide, new RegExp(field, 'i'), `${name} documents Loop field ${field}`);
    }
    assert.match(guide, /stop\s+conditions/i, `${name} documents Loop stop conditions`);
    assert.match(guide, /detached worktree/, `${name} documents Loop isolation`);
    assert.match(guide, /base-bound (?:isolated )?patch handoff/, `${name} documents Loop handoff`);
    assert.match(guide, /does not .{0,80}guarantee|never .{0,80}guarantee/is, `${name} rejects guarantees`);
    assert.doesNotMatch(guide, /cf[:-]autoresearch/, `${name} does not advertise Autoresearch`);
  }

  const catalog = fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../cafekit-web/src/components/docs/catalog-visuals.tsx'), 'utf8');
  const overview = fs.readFileSync(path.resolve(PACKAGE_ROOT, '../../cafekit-web/src/components/docs/skill-overview.tsx'), 'utf8');
  assert.match(catalog, /\['Bounded optimization', \['loop'\]\]/);
  assert.match(catalog, /proportional, traceable evidence/);
  assert.match(overview, /\['cf:research'/);
  assert.match(overview, /\['cf:loop'/);
  for (const field of ['Goal', 'Scope', 'Metric', 'Direction', 'Baseline', 'Guard', 'noise policy', 'minimum delta', 'budget']) {
    assert.match(overview, new RegExp(field, 'i'), `website documents Loop field ${field}`);
  }
  assert.match(overview, /stop conditions/);
  assert.match(overview, /base-bound isolated patch handoff/);
  assert.match(overview, /without guaranteed improvement/);
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
      const publicDirectory = platform === 'claude'
        ? path.join(project, '.claude/skills/fix')
        : path.join(project, '.agents/skills/fix');
      assert.equal(fs.existsSync(publicDirectory), false,
        `${platform} public Fix rename keeps the manifest-owned hotfix directory`);
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
    || !parallel.includes('Research begins only after Step 2 diagnosis')
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
      claude: { skillsRoot: '.claude/skills/hotfix', refPrefix: 'cf:' },
      codex: { skillsRoot: '.agents/skills/hotfix', refPrefix: 'cf-' },
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
        { group: 'scout-before-diagnosis', file: 'references/parallel-patterns.md', from: 'Research begins only after Step 2 diagnosis', to: 'Research may begin before Step 2 diagnosis' },
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
      && !relative.endsWith('/platforms/opencode.mdx')
      && !relative.endsWith('/spec-lifecycle.mdx');
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
    const legacyIndex = lifecycle.search(/^## Legacy compatibility$/m);
    assert.ok(legacyIndex >= 0, `${locale} spec lifecycle must isolate legacy compatibility`);
    assert.doesNotMatch(lifecycle.slice(0, legacyIndex), /\bspec\.json\b|\btask_registry\b|tasks\/task-R/);
    assert.match(lifecycle.slice(legacyIndex), /\bspec\.json\b/);

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

test('packed Claude and Codex installs execute semantic kernel behavior without package source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-packed-semantic-'));
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
      assert.equal(fs.existsSync(packedSource), false, `${platform} package source must be unavailable`);

      const paths = installedSemanticPaths(project, platform);
      const taskless = createTasklessFixture(paths, project, 'compact-installed');
      initializeGit(project);
      assertInstalledCompletion(paths, project, platform, taskless);

      const strict = createTasklessFixture(paths, project, 'strict-installed', { strict: true });
      const taskBearing = createTaskFixture(paths, project, 'tasks-installed');
      assertInstalledResolution(paths, project, platform, 'strict-installed');
      assertStrictSimulatedHandlerGuardrail(paths, project, strict);
      assertStaleDigestMutations(paths, project, taskless, taskBearing);
      runInstalled(paths.validator, [taskless.featureDir], project);
      runInstalled(paths.validator, [taskBearing.featureDir], project);
      runInstalled(paths.grounder, [taskBearing.featureDir, '--root', project], project);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
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

test('packed Codex live host E2E via codex binary (opt-in)', async (t) => {
  if (process.env.CAFEKIT_CODEX_HOST_E2E !== '1') {
    t.skip('opt-in only: set CAFEKIT_CODEX_HOST_E2E=1 to run live Codex host');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-live-codex-'));
  const destination = path.join(root, 'pack');
  fs.mkdirSync(destination, { recursive: true });
  const cafekitHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cafekit-live-home-'));
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const originalCodexHome = process.env.CODEX_HOME;
  // Preserve original home for Codex auth (without inspecting contents)
  const authHome = originalCodexHome || (originalHome ? path.join(originalHome, '.codex') : null);
  let project;
  try {
    const packed = npmPack(['--pack-destination', destination, '--json'], PACKAGE_ROOT);
    const tarball = path.join(destination, packed.filename);
    const runtimeClosure = packedRuntimeClosure(path.join(root, 'runtime-closure'));
    project = path.join(root, 'codex-live');
    const installer = installPacked(tarball, project, runtimeClosure);
    runInstaller(installer, project, ['codex'], null);
    const paths = installedSemanticPaths(project, 'codex');
    const fixture = createTasklessFixture(paths, project, 'live-strict', { strict: true });
    initializeGit(project);
    // Verify via child process to keep CafeKit state isolated without mutating global env
    const verifyViaChild = (digest) => {
      const script = 'const a=require(process.argv[1]); console.log(JSON.stringify(a.verifyAttestation(process.argv[2],process.argv[3],process.argv[4],process.argv[5])))';
      const res = spawnSync(process.execPath, ['-e', script, paths.semanticAuthority, project, path.join(project, 'specs', 'live-strict', 'spec.json'), 'live-strict', digest], {
        encoding: 'utf8',
        env: { ...process.env, HOME: cafekitHome, USERPROFILE: cafekitHome },
      });
      assert.equal(res.status, 0, `verify child failed: ${res.stderr}`);
      return JSON.parse(res.stdout);
    };
    const before = verifyViaChild(fixture.digest);
    assert.equal(before.ok, false, 'before host observation, Strict attestation must be missing (fail-closed)');

    const model = process.env.CAFEKIT_CODEX_MODEL || 'gpt-5.6-luna';
    const reasoning = process.env.CAFEKIT_CODEX_REASONING || 'max';
    const codexBin = process.env.CAFEKIT_CODEX_BIN || 'codex';
    const canonicalProject = fs.realpathSync(project);
    const codeAuditorConfig = path.join(canonicalProject, '.codex', 'agents', 'code_auditor.toml');
    const semanticAuthorityHook = fs.realpathSync(paths.semanticAuthority);
    const shellQuote = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;
    const posixHookCommand = `${shellQuote(process.execPath)} ${shellQuote(semanticAuthorityHook)}`;
    const encodedHookPath = Buffer.from(semanticAuthorityHook, 'utf8').toString('base64url');
    const windowsHookCommand = 'node -e "process.argv[1]=Buffer.from(process.argv[1],\'base64url\').toString(\'utf8\');require(\'module\').runMain()" ' + encodedHookPath;
    const subagentStopHooks = `[{ matcher = "*", hooks = [{ type = "command", command = ${JSON.stringify(posixHookCommand)}, commandWindows = ${JSON.stringify(windowsHookCommand)} }] }]`;
    assert.equal(fs.existsSync(codeAuditorConfig), true, 'packed install must contain code_auditor config');
    const versionCheck = spawnSync(codexBin, ['--version'], { encoding: 'utf8' });
    if (versionCheck.status !== 0) {
      assert.fail(`Codex binary not available at ${codexBin}: ${versionCheck.stderr.trim()} (exit ${versionCheck.status})`);
    }
    const controllerPrompt = [
      'You are a CafeKit controller. Do NOT emit CAFEKIT_SEMANTIC_REVIEW_ATTESTATION yourself.',
      `Spawn exactly one subagent with agent_type="code_auditor" to perform Strict semantic review for feature live-strict.`,
      'Wait for that exact subagent to finish by calling wait_agent before you answer.',
      'This is a specs-only authoring review: assess requirements, design, semantic model, and counterexample coverage only. Do not require implementation code, execution receipts, or a Develop run.',
      'The request has assurance_level: Strict. Keep the review bounded to this fixture and do not invoke a skill.',
      'This is intentionally a pre-finalization candidate: semantic_model is null and semantic_review is not-run until a PASS marker is observed and spec-readiness atomically promotes them. Do not run or require the full validator before that host event because it must fail closed at this stage.',
      `The subagent must recompute the digest via: node .codex/scripts/validate-spec-output.cjs specs/live-strict --semantic-digest`,
      `The exact review result that will be passed to the finalizer is ${JSON.stringify(fixture.reviewResult)}. Verify every criterion, counterexample, decision ref, verification ref, and artifact statement before PASS.`,
      `If the subagent verifies PASS and the digest matches ${fixture.digest}, it must emit exactly:`,
      `CAFEKIT_SEMANTIC_REVIEW_ATTESTATION {"feature_name":"live-strict","spec_file":"specs/live-strict/spec.json","semantic_digest":"${fixture.digest}","verdict":"PASS"}`,
      'No other marker. After the subagent, do not add any marker.',
    ].join(' ');

    const execArgs = [
      'exec',
      '-m', model,
      '-c', `model_reasoning_effort=${reasoning}`,
      // Project agents are intentionally skipped until a user trusts the repo.
      // This disposable E2E must not mutate global trust, so register the
      // packed profile explicitly for this process. Static packed tests cover
      // the normal trusted-project auto-discovery path and file schema.
      '-c', 'agents.code_auditor.description="CafeKit Strict semantic reviewer"',
      '-c', `agents.code_auditor.config_file=${JSON.stringify(codeAuditorConfig)}`,
      // Isolate this E2E from the user's config/hooks while retaining auth.
      // The process-scoped hook executes the packed entrypoint directly.
      '--ignore-user-config',
      // Only thread-spawned Codex subagents emit the supported SubagentStop
      // event. The legacy internal path emits spawn PostToolUse but no
      // hook-observable completion payload and must remain fail-closed.
      '--enable', 'multi_agent_v2',
      '-c', 'features.hooks=true',
      '-c', `hooks.SubagentStop=${subagentStopHooks}`,
      '-s', 'read-only',
      '--dangerously-bypass-hook-trust',
      '--ephemeral',
      '-C', canonicalProject,
      controllerPrompt,
    ];
    const codexResult = spawnSync(codexBin, execArgs, {
      cwd: project,
      encoding: 'utf8',
      timeout: 600000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, HOME: cafekitHome, USERPROFILE: cafekitHome, ...(authHome ? { CODEX_HOME: authHome } : {}) },
    });
    if (codexResult.status !== 0) {
      const cliOutput = `${codexResult.stderr.trim()}\n${codexResult.stdout.trim()}`.trim();
      const processState = [
        `status=${codexResult.status}`,
        `signal=${codexResult.signal || 'none'}`,
        codexResult.error ? `spawn_error=${codexResult.error.code || codexResult.error.message}` : null,
      ].filter(Boolean).join(', ');
      const isEnvAuth = /authentication|unauthorized|credential|not logged in|login required|CODEX_HOME|not.*found|ENOENT/i.test(cliOutput);
      if (isEnvAuth) {
        assert.fail(`Live Codex host failed due to CLI/environment (${processState}): ${cliOutput.slice(0, 1600)}`);
      }
      assert.fail(`Live Codex host exec failed (${processState}): ${cliOutput.slice(0, 1600)}`);
    }
    // Verify via public authority API only (no HOME inspection) via child process
    const after = verifyViaChild(fixture.digest);
    const liveTrace = `${codexResult.stderr || ''}\n${codexResult.stdout || ''}`.trim();
    assert.equal(
      after.ok,
      true,
      `host observation must exist after Codex reviewer completion event (got ${after.reason})\n` +
      `Codex trace tail:\n${liveTrace.slice(-6000)}`,
    );
    assert.equal(after.record.reviewer_agent_type, 'code_auditor', 'observation must be from code_auditor');
    const reviewFile = path.join(project, 'specs', 'live-strict', '.live-review.json');
    fs.writeFileSync(reviewFile, JSON.stringify(fixture.reviewResult));
    const readinessResult = spawnSync(process.execPath, [paths.readiness, path.join(project, 'specs', 'live-strict'), '--review-result', reviewFile], {
      cwd: project,
      encoding: 'utf8',
      env: { ...process.env, HOME: cafekitHome },
    });
    fs.unlinkSync(reviewFile);
    assert.equal(readinessResult.status, 0, `readiness should succeed after host observation: ${readinessResult.stderr.trim()}`);
    assert.match(readinessResult.stdout, /SPEC_READY/);
    const specAfter = JSON.parse(fs.readFileSync(path.join(project, 'specs', 'live-strict', 'spec.json'), 'utf8'));
    assert.equal(specAfter.ready_for_implementation, true, 'SPEC_READY after live host observation');
  } finally {
    // Restore exact environment on all paths
    if (originalHome !== undefined) process.env.HOME = originalHome; else delete process.env.HOME;
    if (originalUserProfile !== undefined) process.env.USERPROFILE = originalUserProfile; else delete process.env.USERPROFILE;
    if (originalCodexHome !== undefined) process.env.CODEX_HOME = originalCodexHome; else delete process.env.CODEX_HOME;
    // Clear require cache for authority to avoid polluting other tests
    try {
      const tmpPaths = path.join(root || os.tmpdir(), 'codex-live', '.codex', 'hooks', 'semantic-review-authority.cjs');
      delete require.cache[require.resolve(tmpPaths)];
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cafekitHome, { recursive: true, force: true });
  }
});
