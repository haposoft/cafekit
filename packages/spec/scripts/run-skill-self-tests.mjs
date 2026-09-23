#!/usr/bin/env node

import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const workflowPolicy = require(join(packageRoot, "src/claude/scripts/workflow-policy.cjs"));
const { parseVerificationDefinitions } = require(
  join(packageRoot, "src/claude/scripts/spec-ground.cjs"),
);
const semanticFirewallDiscovery = require(
  join(packageRoot, "scripts/semantic-firewall-test-discovery.cjs"),
);
// C2 SemanticReviewReceipt's exact field-list authority (R1-01, frozen) lives
// once in the validator; import it rather than maintaining a second literal.
const { C2_FIELDS } = require(
  join(packageRoot, "src/claude/scripts/validate-spec-output.cjs"),
);

// Repeatable `--require-semantic-test <basename>` flags (D12): each named
// basename must be discovered under bin/__tests__ and must itself pass in
// isolation, or the whole run fails nonzero.
function parseRequiredSemanticTests(argv) {
  const required = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--require-semantic-test") {
      const value = argv[index + 1];
      if (!value) throw new Error("--require-semantic-test requires a basename argument");
      required.push(value);
      index += 1;
    }
  }
  return required;
}

async function listFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => join(directory, entry.name))
    .sort();
}

function runCommand({ label, command, args, parseCount, summarize }) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: packageRoot,
      // Force colorless child output: the count parsers anchor on line starts,
      // and ANSI prefixes (e.g. FORCE_COLOR envs) break them -> false NO_TESTS.
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      output += chunk;
    });
    child.on("error", (error) => {
      resolveRun({ label, code: 1, count: 0, error: error.message });
    });
    child.on("close", (code) => {
      resolveRun({
        label,
        code,
        count: parseCount(output),
        summary: typeof summarize === "function" ? summarize(output) : null,
      });
    });
  });
}

function parseNodeTestCount(output) {
  const match = output.match(/^(?:#|ℹ)\s+tests\s+(\d+)/m);
  return match ? Number(match[1]) : 0;
}

function parseNodeTestSummary(output) {
  const metric = (name) => {
    const match = output.match(new RegExp(`^(?:#|ℹ)\\s+${name}\\s+(\\d+)`, "m"));
    return match ? Number(match[1]) : null;
  };
  const failingTests = [...output.matchAll(
    /^test at (.+?):(\d+):(\d+)\n✖ ([^\n]+?)(?: \([\d.]+ms\))?$/gm,
  )].map((match) => ({
    file: match[1],
    line: Number(match[2]),
    column: Number(match[3]),
    title: match[4],
  }));
  return {
    tests: metric("tests"),
    pass: metric("pass"),
    fail: metric("fail"),
    skipped: metric("skipped"),
    failingTests,
  };
}

function nodeFailureDetail(summary) {
  if (!summary) return "test summary unavailable";
  const counts = `tests=${summary.tests ?? "unknown"} pass=${summary.pass ?? "unknown"} fail=${summary.fail ?? "unknown"}`;
  if (summary.failingTests.length === 0) return counts;
  const failures = summary.failingTests
    .map(({ file, line, column, title }) => `${file}:${line}:${column} (${title})`)
    .join("; ");
  return `${counts}; failing=${failures}`;
}

function parsePythonUnittestCount(output) {
  const match = output.match(/Ran\s+(\d+)\s+tests?/);
  return match ? Number(match[1]) : 0;
}

const TASK_21_SECTIONS = [
  "Outcome",
  "Scope",
  "Anchors and Ownership",
  "Changes",
  "Acceptance",
  "Dependencies",
  "Verification Plan",
];

function markdownH2s(content) {
  return [...content.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]);
}

function markdownBoldBulletFields(content) {
  const fields = new Map();
  for (const line of String(content).split("\n")) {
    const prefix = "- **";
    const separator = ":**";
    if (!line.startsWith(prefix) || !line.includes(separator)) continue;
    const boundary = line.indexOf(separator);
    fields.set(line.slice(prefix.length, boundary).trim(), line.slice(boundary + separator.length).trim());
  }
  return fields;
}

function markdownTableUnderHeading(content, heading) {
  const lines = markdownSectionUnderHeading(content, heading).split("\n");
  const tableStart = lines.findIndex((line) => line.trim().startsWith("|"));
  if (tableStart < 0) return [];
  const rows = [];
  for (let index = tableStart; index < lines.length && lines[index].trim().startsWith("|"); index += 1) {
    const cells = lines[index].split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function markdownSectionUnderHeading(content, heading) {
  const lines = String(content).split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (headingIndex < 0) return "";
  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && /^##\s+/.test(line),
  );
  return lines.slice(headingIndex + 1, nextHeadingIndex < 0 ? undefined : nextHeadingIndex).join("\n");
}

function normalizeMarkdownWhitespace(content) {
  return String(content).replace(/\s+/g, " ").trim();
}

function markdownBetweenHeadings(content, startHeading, endHeading) {
  const value = String(content);
  const startMarker = `## ${startHeading}`;
  const endMarker = `## ${endHeading}`;
  const startIndex = value.indexOf(startMarker);
  const endIndex = value.indexOf(endMarker, startIndex + startMarker.length);
  if (startIndex < 0 || endIndex < 0) return "";
  return value.slice(startIndex + startMarker.length, endIndex);
}

const IMPLEMENTATION_READINESS_BOUNDARY_ROWS = [
  ["Interaction/UI", "entry journey; visible/loading/empty/error states; input/focus/keyboard; accessibility; responsive/native/device behavior"],
  ["API/CLI", "entrypoint/route or command grammar; identity/auth; input/default/normalization; success output; error/status/exit; duplicate/retry/idempotency; compatibility"],
  ["Data/schema", "authority/storage/transaction; version; exact keys/nesting/types; required/optional; enum/format/bounds/cardinality; unknown-field behavior; compatibility/migration"],
  ["Async/state", "initial/terminal states; event + guard + effect + next + error; ordering/concurrency; duplicate/retry; writer/lock acquire/contention/release; cancellation; rollback/recovery"],
  ["Filesystem/security", "authoritative root; trusted/untrusted segment grammar; lexical + canonical containment and symlink policy; flags/mode; temp/rename/fsync; lock/stale reclaim; crash cleanup"],
  ["Runtime/deploy", "config/env/flags; registration/packaging; OS/arch; rollout/rollback; health/logging; operator recovery"],
  ["Time/retention", "clock source; unit/precision/timezone; endpoints and inclusion/comparator; anomaly behavior; expiry/purge/recovery"],
  ["AI/model", "provider/model/prompt/tool schema; nondeterminism/bounds; safety/privacy; fallback; cost/token limit; eval oracle"],
  ["Integration/proof", "caller; export/registration; packaging/config; native path/consumer; proof level (`source`/`installed`/`live`); observable failure oracle"],
];

function boundaryTableHasRequiredRows(table) {
  const [header, ...rows] = table;
  const labels = rows.map((row) => row[0]);
  return JSON.stringify(header || []) === JSON.stringify(["Boundary", "Required contract when material"])
    && new Set(labels).size === labels.length
    && IMPLEMENTATION_READINESS_BOUNDARY_ROWS.every((expected) =>
      rows.some((row) => JSON.stringify(row) === JSON.stringify(expected)));
}

const IMPLEMENTATION_READINESS_CLAUSES = {
  noInvention: "Before implementation handoff, apply the **no-invention gate**: if two implementations conform to the packet text yet can produce different externally observable output, state, error, security, or compatibility behavior, surface the missing choice as an explicit GATE-SCOPE or GATE-REVIEW question and block handoff.",
  materialDefinition: "A boundary is material when the task creates, changes, or depends on it and a different choice changes an external observation, security, durable data, compatibility, or proof reachability. Require only the matching material row; omit nonmaterial categories.",
  exactBoundaryChoices: "For every required row, name each listed choice exactly; labels such as “JSON”, “local path”, “locked”, or “timestamped” alone remain unresolved.",
  proofPlanLines: [
    "- Command: `<exact runnable command>`",
    "- Named probe: <existing concrete probe/test/hook ID; never only a suite label>",
    "- Reachability: <known command/caller/environment per required level; `UNKNOWN` only when the path cannot yet be established>",
    "- Oracle: <externally observable success or failure>",
    "- Counterexample: <material alternative behavior that must make this proof fail>",
    "- Artifacts: <required artifact path plus digest algorithm/comparison rule, or explicitly ephemeral with cleanup rule>",
  ],
  proofTrace: "Trace `Command → Named probe → Reachability → Oracle`.",
  namedProbeOwnership: "Aggregate suites name the\nowning concrete probe.",
  proofLevelSeparation: "Levels stay separate and never promote one another.",
  disposableTemplateControls: "Run mutation or destructive\nnegative controls only on disposable copies under a verified temporary root,\nnever tracked worktree or canonical source bytes.",
  proofLevelMapping: "For every required level in each referenced CP row, map its named probe and\nreachability here; one command may own several explicitly named level probes.",
  disposableReviewControls: "Run mutation or destructive negative controls only on disposable copies below a verified temporary root, never tracked worktree or canonical source bytes.",
  failureSemantics: "`Crash` means abrupt unhandled termination before the claimed catch point; a catchable failure returns/raises an error or exits nonzero. Never use them interchangeably.",
  privacyIdentifiers: "Any privacy/security claim names the exact identifier surface at risk, such as an env var, header, path, token class, or field name; generic “sensitive data” is insufficient.",
  freshReplay: "After applying an accepted GATE-REVIEW finding, a fresh-context closure pass records and freshly replays its original counterexample after the repair under this exact review-log header:",
  distinctRepairProof: "`Repaired at` cites the repair edit; `Proved at` must cite distinct evidence from the fresh replay, never the repair-edit citation.",
  closureTransition: "An accepted finding transitions `accepted → repaired → PASS|FAIL|UNKNOWN`.",
  unknownBlocks: "Only `PASS` closes it; `FAIL` remains open for the remaining paper-review round; `UNKNOWN` blocks implementation handoff.",
  scopeReturnsToC1: "A repair that adds user semantics or scope returns to GATE-SCOPE.",
};

function implementationReadinessContractIssues(input) {
  const keys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (keys.join(",") !== "review,templates"
    || typeof input.templates !== "string" || typeof input.review !== "string") {
    throw new TypeError("implementation-readiness checker expects exactly templates and review UTF-8 strings");
  }

  const issues = new Set();
  const authoring = markdownSectionUnderHeading(
    input.templates,
    "No-invention and conditional boundary contracts",
  );
  if (!authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.noInvention)) {
    issues.add("no-invention");
  }
  const contradictoryNoInvention = /\b(?:exception|however)\b.{0,160}\bimplementation handoff\b.{0,80}\b(?:may|can)\s+(?:proceed|continue)\b.{0,160}\bunresolved\b/i;
  if (contradictoryNoInvention.test(normalizeMarkdownWhitespace(authoring))) {
    issues.add("no-invention");
  }

  const boundaryTable = markdownTableUnderHeading(
    input.templates,
    "No-invention and conditional boundary contracts",
  );
  if (!authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.materialDefinition)
    || !authoring.includes(IMPLEMENTATION_READINESS_CLAUSES.exactBoundaryChoices)
    || IMPLEMENTATION_READINESS_BOUNDARY_ROWS.length !== 9
    || !boundaryTableHasRequiredRows(boundaryTable)) {
    issues.add("boundary-contract");
  }

  const proof = markdownSectionUnderHeading(input.templates, "Verification Plan");
  const proofPlanLines = proof.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("- "));
  const normalizedProofContract = normalizeMarkdownWhitespace(markdownBetweenHeadings(
    input.templates,
    "Verification Plan",
    "Canonical inline Receipt",
  ));
  const normalizedProofClauses = [
    IMPLEMENTATION_READINESS_CLAUSES.proofTrace,
    IMPLEMENTATION_READINESS_CLAUSES.namedProbeOwnership,
    IMPLEMENTATION_READINESS_CLAUSES.proofLevelSeparation,
    IMPLEMENTATION_READINESS_CLAUSES.disposableTemplateControls,
    IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping,
  ].map(normalizeMarkdownWhitespace);
  const reviewNegativeControls = normalizeMarkdownWhitespace(
    markdownSectionUnderHeading(input.review, "B2 — fresh-context red team"),
  );
  if (JSON.stringify(proofPlanLines) !== JSON.stringify(IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines)
    || normalizedProofClauses.some((clause) => !normalizedProofContract.includes(clause))
    || !reviewNegativeControls.includes(normalizeMarkdownWhitespace(
      IMPLEMENTATION_READINESS_CLAUSES.disposableReviewControls,
    ))) {
    issues.add("proof-chain");
  }

  const failureGuidance = markdownSectionUnderHeading(input.templates, "Twelve edge-case dimensions");
  if (!failureGuidance.includes(IMPLEMENTATION_READINESS_CLAUSES.failureSemantics)) {
    issues.add("failure-semantics");
  }

  const evidenceRules = markdownSectionUnderHeading(input.review, "B1 — evidence rule");
  if (!evidenceRules.includes(IMPLEMENTATION_READINESS_CLAUSES.privacyIdentifiers)) {
    issues.add("privacy-identifiers");
  }

  const closure = markdownSectionUnderHeading(input.review, "Accepted-repair closure");
  const normalizedClosure = normalizeMarkdownWhitespace(closure);
  const closureHeader = markdownTableUnderHeading(input.review, "Accepted-repair closure")[0] || [];
  if (JSON.stringify(closureHeader) !== JSON.stringify([
    "ID", "Decision", "Original counterexample", "Repaired at", "Proved at", "Replay", "Closure",
  ])
    || !normalizedClosure.includes(normalizeMarkdownWhitespace(IMPLEMENTATION_READINESS_CLAUSES.freshReplay))
    || !closure.includes(IMPLEMENTATION_READINESS_CLAUSES.distinctRepairProof)
    || !closure.includes(IMPLEMENTATION_READINESS_CLAUSES.closureTransition)
    || !closure.includes(IMPLEMENTATION_READINESS_CLAUSES.unknownBlocks)
    || !closure.includes(IMPLEMENTATION_READINESS_CLAUSES.scopeReturnsToC1)) {
    issues.add("repair-closure");
  }

  return [...issues].sort();
}

async function runImplementationReadinessContractTests() {
  const fail = (message) => {
    throw new Error(`[FAIL] Specs implementation-readiness contract: ${message}`);
  };
  const baseline = {
    templates: await readFile(
      join(packageRoot, "src/claude/skills/specs/references/templates.md"),
      "utf8",
    ),
    review: await readFile(
      join(packageRoot, "src/claude/skills/specs/references/review.md"),
      "utf8",
    ),
  };
  const baselineIssues = implementationReadinessContractIssues(baseline);
  if (baselineIssues.length > 0) fail(`intact sources returned ${baselineIssues.join(", ")}`);

  const boundaryMutation = (name, boundary, replacements) => {
    const row = IMPLEMENTATION_READINESS_BOUNDARY_ROWS.find(([label]) => label === boundary);
    if (!row) fail(`${name} references unknown boundary ${boundary}`);
    let weakened = row[1];
    for (const [from, to] of replacements) {
      const next = weakened.replace(from, to);
      if (next === weakened) fail(`${name} weakening anchor is absent from ${boundary}`);
      weakened = next;
    }
    return {
      name,
      issue: "boundary-contract",
      source: "templates",
      from: `| ${row[0]} | ${row[1]} |`,
      to: `| ${row[0]} | ${weakened} |`,
    };
  };

  const mutations = [
    {
      name: "no-invention-blocking",
      issue: "no-invention",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.noInvention,
      to: "Before implementation handoff, note ambiguous choices without blocking handoff.",
    },
    {
      name: "no-invention-contradictory-override",
      issue: "no-invention",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.noInvention,
      to: `${IMPLEMENTATION_READINESS_CLAUSES.noInvention}\n\nException: implementation handoff may proceed with an unresolved material choice.`,
    },
    {
      name: "material-boundary-definition",
      issue: "boundary-contract",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.materialDefinition,
      to: "A boundary is material when it seems relevant to the task.",
    },
    {
      name: "exact-boundary-choices",
      issue: "boundary-contract",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.exactBoundaryChoices,
      to: "For every required row, describe the listed choices generally.",
    },
    boundaryMutation("interaction-accessibility", "Interaction/UI", [
      ["input/focus/keyboard; ", ""],
      ["accessibility; ", ""],
    ]),
    boundaryMutation("api-success-and-error-semantics", "API/CLI", [
      ["success output; ", ""],
      ["error/status/exit; ", ""],
    ]),
    boundaryMutation("schema-shape-and-unknown-fields", "Data/schema", [
      ["exact keys/nesting/types; ", ""],
      ["unknown-field behavior; ", ""],
    ]),
    boundaryMutation("schema-enum-and-format", "Data/schema", [
      ["enum/format/", ""],
    ]),
    boundaryMutation("state-lock-lifecycle", "Async/state", [
      ["writer/lock acquire/contention/release; ", "writer/lock; "],
    ]),
    boundaryMutation("filesystem-segment-grammar", "Filesystem/security", [
      ["trusted/untrusted segment grammar; ", ""],
    ]),
    boundaryMutation("filesystem-stale-lock-reclaim", "Filesystem/security", [
      ["lock/stale reclaim; ", ""],
    ]),
    boundaryMutation("runtime-rollout-and-recovery", "Runtime/deploy", [
      ["rollout/rollback; ", ""],
      ["operator recovery", ""],
    ]),
    boundaryMutation("retention-clock-and-endpoints", "Time/retention", [
      ["clock source; ", ""],
      ["unit/precision/timezone; ", ""],
      ["endpoints and inclusion/comparator; ", ""],
    ]),
    boundaryMutation("ai-model-safety-and-eval", "AI/model", [
      ["safety/privacy; ", ""],
      ["eval oracle", ""],
    ]),
    boundaryMutation("proof-level-partition", "Integration/proof", [
      ["proof level (`source`/`installed`/`live`)", "proof level"],
    ]),
    {
      name: "concrete-named-probe",
      issue: "proof-chain",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[1],
      to: "- Named probe: <suite label>",
    },
    {
      name: "aggregate-suite-probe-owner",
      issue: "proof-chain",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.namedProbeOwnership,
      to: "Aggregate suites may cite only the suite label.",
    },
    {
      name: "reachability-levels",
      issue: "proof-chain",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[2],
      to: "- Reachability: <entrypoint or consumer>",
    },
    {
      name: "proof-level-separation",
      issue: "proof-chain",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.proofLevelSeparation,
      to: "Proof may be promoted between source, installed, and live levels.",
    },
    {
      name: "disposable-template-negative-controls",
      issue: "proof-chain",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.disposableTemplateControls,
      to: "Run mutation or destructive negative controls against the available project copy.",
    },
    {
      name: "disposable-review-negative-controls",
      issue: "proof-chain",
      source: "review",
      from: IMPLEMENTATION_READINESS_CLAUSES.disposableReviewControls,
      to: "Run mutation or destructive negative controls against the available project copy.",
    },
    {
      name: "required-proof-level-mapping",
      issue: "proof-chain",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping,
      to: "Map one required proof level to one probe; other levels may remain implicit.",
    },
    {
      name: "artifact-path-and-digest-or-ephemeral",
      issue: "proof-chain",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[5],
      to: "- Artifacts: <required artifact path, or none>",
    },
    {
      name: "proof-counterexample",
      issue: "proof-chain",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.proofPlanLines[4],
      to: "- Counterexample: <example>",
    },
    {
      name: "repair-and-proof-columns",
      issue: "repair-closure",
      source: "review",
      from: "| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |",
      to: "| ID | Decision | Original counterexample | Repaired at | Evidence | Replay | Closure |",
    },
    {
      name: "fresh-original-counterexample-replay",
      issue: "repair-closure",
      source: "review",
      from: "After applying an accepted GATE-REVIEW finding, a fresh-context closure pass records and\nfreshly replays its original counterexample after the repair under this exact review-log header:",
      to: "After applying an accepted GATE-REVIEW finding, record the repair under this review-log header:",
    },
    {
      name: "distinct-repair-and-proof-evidence",
      issue: "repair-closure",
      source: "review",
      from: IMPLEMENTATION_READINESS_CLAUSES.distinctRepairProof,
      to: "`Repaired at` and `Proved at` may cite the same repair edit.",
    },
    {
      name: "unknown-blocks-handoff",
      issue: "repair-closure",
      source: "review",
      from: IMPLEMENTATION_READINESS_CLAUSES.unknownBlocks,
      to: "`PASS` closes it; `FAIL` and `UNKNOWN` may continue to implementation handoff.",
    },
    {
      name: "crash-versus-catchable-failure",
      issue: "failure-semantics",
      source: "templates",
      from: IMPLEMENTATION_READINESS_CLAUSES.failureSemantics,
      to: "Crash and catchable failure both mean an error occurred.",
    },
    {
      name: "privacy-identifier-surface",
      issue: "privacy-identifiers",
      source: "review",
      from: IMPLEMENTATION_READINESS_CLAUSES.privacyIdentifiers,
      to: "Any privacy/security claim names the sensitive data at risk.",
    },
  ];
  for (const { name, issue, source, from, to } of mutations) {
    const anchorIndex = baseline[source].indexOf(from);
    if (anchorIndex < 0) fail(`${name} mutation anchor is absent from real source`);
    if (baseline[source].indexOf(from, anchorIndex + from.length) >= 0) {
      fail(`${name} mutation anchor is not unique in real source`);
    }
    const mutatedSource = `${baseline[source].slice(0, anchorIndex)}${to}${baseline[source].slice(anchorIndex + from.length)}`;
    const mutated = { ...baseline, [source]: mutatedSource };
    const actual = implementationReadinessContractIssues(mutated);
    if (JSON.stringify(actual) !== JSON.stringify([issue])) {
      fail(`${name} expected ${issue} but returned ${JSON.stringify(actual)}`);
    }
  }

  const integrationRow = IMPLEMENTATION_READINESS_BOUNDARY_ROWS
    .find(([label]) => label === "Integration/proof");
  const integrationLine = `| ${integrationRow.join(" | ")} |`;
  const extendedTemplates = baseline.templates.replace(
    integrationLine,
    `${integrationLine}\n| other:domain-specific | task-specific material choices and observable oracle |`,
  );
  if (extendedTemplates === baseline.templates
    || implementationReadinessContractIssues({ ...baseline, templates: extendedTemplates }).length > 0) {
    fail("an additional other:<verbatim> material boundary must remain valid");
  }

  console.log(`✔ cf:specs implementation-readiness checker rejects ${mutations.length} gate-specific source mutations`);
  return mutations.length + 1;
}

const ADAPTIVE_COVERAGE_PROFILE_HEADER = [
  "ID", "Outcome", "Change kinds", "Material surfaces", "Ambiguity/action",
  "Risk/evidence", "Required proof",
];

const ADAPTIVE_COVERAGE_PROFILE_ROW = [
  "CP-01", "<externally observable outcome>", "<all kinds>", "<all material surfaces>",
  "<state + action>", "<level + evidence>", "<source/installed/live set>",
];

const ADAPTIVE_COVERAGE_AMBIGUITY_ROWS = [
  ["State", "Required action"],
  ["`none`", "proceed"],
  ["`examples-needed`", "add two or three examples only for an already decided rule; promote to `decision-needed` if an example changes observable behavior"],
  ["`decision-needed`", "ask the user at GATE-SCOPE/GATE-REVIEW and keep affected tasks blocked"],
  ["`design-needed`", "after user-owned decisions settle, route material competing technical designs through Brainstorm"],
];

const ADAPTIVE_REVIEWER_ROWS = [
  ["Groups", "Reviewers", "Roles", "Claim budget"],
  ["1-2", "2", "Fact Checker plus all matching material lenses", "about 5 per group"],
  ["3-5", "3", "Fact Checker plus all matching material lenses", "about 10 per group"],
  ["6+", "4", "Fact Checker plus all matching material lenses", "at least 15 total"],
];

const ADAPTIVE_GUIDE_ROUTE_ROWS = [
  ["Route", "Điều kiện"],
  ["Làm trực tiếp", "Chỉ khi cause và change đều clear, isolated, reversible, `routine`, và likely giới hạn trong một hoặc hai file"],
  ["GATE-SCOPE/GATE-REVIEW", "Còn user-owned observable choice; hỏi và giữ phần bị ảnh hưởng ở `blocked`"],
  ["Brainstorm", "Có material competing technical designs, sau khi user-owned choices đã chốt"],
  ["Một Specs packet", "Material work không đủ điều kiện Direct và không phải Brainstorm-only exploration"],
  ["Split Specs", "Có từ ba independent subsystem trở lên; mỗi subsystem có outcome, boundary và verification/deployment path tự đi qua lifecycle"],
];

const ADAPTIVE_GUIDE_AMBIGUITY_ROWS = [
  ["State", "Hành động bắt buộc", "Hệ quả status"],
  ["`none`", "Tiếp tục", "Có thể vào `pending` khi các blocker khác đã đóng"],
  ["`examples-needed`", "Thêm ví dụ chỉ để làm rõ rule đã quyết định; nếu ví dụ đổi observable behavior thì promote sang `decision-needed`", "Không tự chọn product outcome"],
  ["`decision-needed`", "Hỏi người dùng tại GATE-SCOPE/GATE-REVIEW", "Affected task giữ `blocked`"],
  ["`design-needed`", "Sau khi user-owned decision đã chốt, chuyển material competing designs sang Brainstorm", "Chưa author implementation choice trong task"],
];

const ADAPTIVE_GUIDE_CLAUSES = {
  riskFloor: "Luôn phân loại material risk trước khi chọn workflow; cách người dùng gọi một việc là “nhỏ” hoặc “routine” không được hạ risk floor đã quan sát.",
  critical: "`critical`: auth/secrets/privacy; destructive/irreversible hoặc nguy cơ mất, hỏng dữ liệu; money/privilege/safety; production-state mutation.",
  elevated: "`elevated`: cross-component contract, compatibility, concurrency, external integration, hoặc installed/runtime behavior.",
  profileReference: "Mỗi task có `## Coverage` và chỉ tham chiếu các `CP-NN` mình sở hữu; không copy profile sang task.",
  openCoverage: "Change kinds là tập nhiều giá trị; kind hoặc surface chưa có tên dùng `other:<verbatim>` thay vì bị bỏ qua.",
  plannedProof: "`Required proof` trong CP row là planned level set, không phải evidence đã chạy.",
  unknownBlocks: "`UNKNOWN` command/caller/environment reachability giữ task ở `blocked`.",
  knownUnrun: "Known nhưng chưa chạy required proof vẫn có thể ở `pending`.",
  executionBlocks: "Missing, failed hoặc unavailable required evidence chặn `done` và GATE-DONE.",
  proofSeparation: "`source`, `installed` và `live` độc lập; PASS ở level này không promote level khác.",
  staticLimit: "Source/static checks chỉ chứng minh written contract, không chứng minh live-model adherence.",
  timingBoundary: "CafeKit chưa đo wall-clock generation time và không công bố SLA cho Specs.",
  timingPacket: "`specs/specs-session-timing-benchmark/plan.md`",
};

function adaptiveUsageGuideIssues(content) {
  const issues = new Set();
  const normalized = normalizeMarkdownWhitespace(content);
  const has = (clause) => normalized.includes(normalizeMarkdownWhitespace(clause));
  const routeTable = markdownTableUnderHeading(content, "Routing thích ứng theo risk");
  if (JSON.stringify(routeTable) !== JSON.stringify(ADAPTIVE_GUIDE_ROUTE_ROWS)
    || !has(ADAPTIVE_GUIDE_CLAUSES.riskFloor)
    || !has(ADAPTIVE_GUIDE_CLAUSES.critical)
    || !has(ADAPTIVE_GUIDE_CLAUSES.elevated)) {
    issues.add("routing-and-risk");
  }

  const profileTable = markdownTableUnderHeading(content, "Coverage profile");
  if (JSON.stringify(profileTable[0] || []) !== JSON.stringify(ADAPTIVE_COVERAGE_PROFILE_HEADER)
    || profileTable.length !== 2 || profileTable[1].length !== ADAPTIVE_COVERAGE_PROFILE_HEADER.length
    || !has(ADAPTIVE_GUIDE_CLAUSES.profileReference)
    || !has(ADAPTIVE_GUIDE_CLAUSES.openCoverage)
    || !normalized.includes("affected rows/tasks")) {
    issues.add("coverage-profile");
  }

  const ambiguityTable = markdownTableUnderHeading(content, "Ambiguity và task status");
  if (JSON.stringify(ambiguityTable) !== JSON.stringify(ADAPTIVE_GUIDE_AMBIGUITY_ROWS)
    || !normalized.includes("`pending` nghĩa là semantic contract và reachability đã biết")
    || !normalized.includes("`done` chỉ hợp lệ khi required execution evidence hiện tại PASS")) {
    issues.add("ambiguity-and-status");
  }

  for (const clause of [
    ADAPTIVE_GUIDE_CLAUSES.plannedProof,
    ADAPTIVE_GUIDE_CLAUSES.unknownBlocks,
    ADAPTIVE_GUIDE_CLAUSES.knownUnrun,
    ADAPTIVE_GUIDE_CLAUSES.executionBlocks,
    ADAPTIVE_GUIDE_CLAUSES.proofSeparation,
    ADAPTIVE_GUIDE_CLAUSES.staticLimit,
  ]) {
    if (!has(clause)) issues.add("proof-lifecycle");
  }

  const numericTiming = /(?:[≤<>]=?\s*)?\d+(?:[.,]\d+)?\s*(?:ms|milliseconds?|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|giây|phút|giờ)\b/i;
  const isoTiming = /\bP(?:(?:\d+(?:[.,]\d+)?[YMWD])+(?:T(?:\d+(?:[.,]\d+)?[HMS])+)?|T(?:\d+(?:[.,]\d+)?[HMS])+)\b/i;
  if (!has(ADAPTIVE_GUIDE_CLAUSES.timingBoundary)
    || !has(ADAPTIVE_GUIDE_CLAUSES.timingPacket)
    || numericTiming.test(content)
    || isoTiming.test(content)) {
    issues.add("timing-claim");
  }
  return [...issues].sort();
}

function adaptiveUsageGuideContractValid(content) {
  if (adaptiveUsageGuideIssues(content).length > 0) return false;
  const mutations = [
    [ADAPTIVE_GUIDE_ROUTE_ROWS[5].join(" | "), "Split Specs | Một monolithic packet cho mọi subsystem", "routing-and-risk"],
    ["`critical`: auth/secrets/privacy", "`critical`: chỉ production deployment", "routing-and-risk"],
    ["| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |", "| ID | Outcome | Change kinds | Material surfaces | Risk/evidence | Required proof |", "coverage-profile"],
    ["Mỗi task có `## Coverage`", "Mỗi task copy toàn bộ Coverage profile", "coverage-profile"],
    [ADAPTIVE_GUIDE_AMBIGUITY_ROWS[2].join(" | "), "`examples-needed` | Dùng ví dụ để tự chọn observable behavior | Có thể vào `pending`", "ambiguity-and-status"],
    [ADAPTIVE_GUIDE_CLAUSES.knownUnrun, "Known nhưng chưa chạy required proof giữ task ở `blocked`.", "proof-lifecycle"],
    ["`source`, `installed` và `live` độc lập", "`source` PASS tự động promote `installed` và `live`", "proof-lifecycle"],
    ["CafeKit chưa đo wall-clock generation time", "CafeKit công bố SLA generation cho Specs", "timing-claim"],
  ];
  for (const [from, to, expected] of mutations) {
    const anchor = content.indexOf(from);
    if (anchor < 0 || content.indexOf(from, anchor + from.length) >= 0) return false;
    const mutated = `${content.slice(0, anchor)}${to}${content.slice(anchor + from.length)}`;
    if (!adaptiveUsageGuideIssues(mutated).includes(expected)) return false;
  }
  for (const timingClaim of [
    "Specs hoàn thành trong 5 phút.",
    "SLA p95 ≤ 300 s.",
    "SLA: 5m.",
    "SLA PT5M.",
    "SLA P3D.",
  ]) {
    if (!adaptiveUsageGuideIssues(`${content}\n${timingClaim}\n`).includes("timing-claim")) {
      return false;
    }
  }
  return true;
}

const ADAPTIVE_COVERAGE_CLAUSES = {
  riskFirst: "Classify material risk before choosing a workflow; user wording never lowers an observed floor.",
  criticalFloor: "`critical`: auth/secrets/privacy; destructive/irreversible work or possible data loss/corruption; money/privilege/safety; production-state mutation.",
  elevatedFloor: "`elevated`: cross-component contracts, compatibility, concurrency, external integration, or installed/runtime behavior.",
  frontmatterGate: "skip only when a change is clear, isolated, reversible, routine, and likely limited to one or two files.",
  directGate: "Work directly only when the cause and change are clear, isolated, reversible,\n`routine`, and likely limited to one or two files.",
  splitRoute: "Split three or more independent\nsubsystems; otherwise use one Specs packet for any material work that does not qualify for direct work or Brainstorm-only exploration.",
  independentSubsystem: "A subsystem is independent only when its outcome, boundary, and verification/deployment path can move through the lifecycle separately.",
  profileAuthority: "For a Specs route, `plan.md` owns one `## Coverage profile` row per externally observable outcome; direct and Brainstorm-only routes do not persist it.",
  openKinds: "Change kinds are multi-valued (`add`, `modify`, `fix`, `refactor`, `remove`, `migrate`, `integrate`), and unfamiliar kinds or surfaces use `other:<verbatim>` rather than disappearing.",
  scopedUnion: "Each task references its CP IDs; authoring, review, edge, and proof obligations union only inside affected rows/tasks.",
  profileRederivation: "Rederive affected CP rows after any accepted scope, outcome, criteria, ownership, dependency, risk, or proof delta before task status.",
  plannedProof: "`Required proof` is a planned level set, not execution\nevidence: known but unrun proof may be `pending`; `UNKNOWN` reachability blocks\n`pending`; missing, failed, or unavailable required evidence blocks `done`/GATE-DONE.",
  proofSeparation: "Levels stay separate and never promote one another.",
  liveLimit: "Source/static checks prove the written contract, not live-model adherence.",
  specMakerAuthority: "they are the canonical risk and coverage authority. Do not duplicate\ntheir taxonomy here.",
  specMakerAmbiguity: "Apply the canonical ambiguity action; examples never decide observable behavior.",
  specMakerRoute: "Apply their risk-first route before GATE-SCOPE and stop when the\nrequest qualifies for direct work; hand off when it requires Brainstorm-only exploration.",
  reviewRisk: "Keep Fact Checker as the baseline. Assign every remaining material CP risk to a\nnamed reviewer lens; a critical row includes both relevant security-adversary and\nfailure-mode coverage, and nonmaterial lenses are not added.",
  scopeAskOnce: "Ask GATE-SCOPE in one message: list every `decision-needed` item (the ambiguity action in `references/templates.md`) as `[NEEDS CLARIFICATION: <question>]`, offer EXPAND, KEEP, and CUT together, and never choose a product outcome on the user's behalf; if an answer leaves an item unsettled, re-ask only that item.",
  sizeNotRisk: "Request size is not a risk signal; a one-line request that touches a shared contract is `elevated`.",
  factCheckSample: "Before GATE-REVIEW, re-run a sample of the plan's `path:line` citations sized by the claim budget in `review.md`; relabel any stale citation `[UNVERIFIED]`.",
  reviewFactCheck: "Before GATE-REVIEW the author re-runs a sample of the plan's citations sized by the claim budget above",
  decisionsTable: "| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |",
  orderedSteps: "1. <ordered action on one owned file → expected observation>",
  priorityRule: "`Priority`: P1 means the outcome is unusable without it, P2 is needed for acceptance, P3 improves it. Number tasks in priority order so the plan table, the filename order, and the queue agree.",
  workedFailureExample: "Example failure: the Command exits 1 with `expected 3 files, found 2` → record observed versus expected, add the missing writer, and rerun the same Command; never delete the assertion.",
  verifyCompare: "Verification compares observed output with the Oracle; a judgment such as \"looks right\" is not a verification.",
  failureProtocol: "On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.",
  reviewCapacity: "Reviewer count is fixed by the table, not lens count. Give each reviewer a distinct primary lens; when material lenses exceed reviewers, combine related named lenses on one reviewer and keep every material lens assigned.",
};

const SPECS_BUNDLE_FILES = [
  "src/claude/skills/specs/SKILL.md",
  "src/claude/skills/specs/references/review.md",
  "src/claude/skills/specs/references/templates.md",
  "src/claude/skills/specs/templates/design.md",
  "src/claude/skills/specs/templates/requirements-init.md",
  "src/claude/skills/specs/templates/requirements.md",
  "src/claude/skills/specs/templates/research.md",
  "src/claude/skills/specs/templates/spec-state.json",
  "src/claude/skills/specs/templates/task.md",
];

const ADAPTIVE_OWNED_BASELINE_LINES = new Map([
  ["src/claude/skills/specs/SKILL.md", 170],
  ["src/claude/skills/specs/references/review.md", 124],
  ["src/claude/skills/specs/references/templates.md", 202],
]);

function adaptiveCoverageContractIssues(input) {
  const expectedKeys = ["review", "skill", "specMaker", "templates"];
  const keys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)
    || expectedKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("adaptive-coverage checker expects skill, specMaker, templates, and review UTF-8 strings");
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
    issues.add("risk-first-routing");
  }

  const profileTable = markdownTableUnderHeading(input.templates, "Coverage profile");
  const profileHeadingCount = (input.templates.match(/^## Coverage profile\s*$/gm) || []).length;
  const taskReferencesCoverage = /## Coverage\s*\n- <exact `CP-NN` IDs owned by this task>/.test(input.templates);
  if (JSON.stringify(profileTable[0] || []) !== JSON.stringify(ADAPTIVE_COVERAGE_PROFILE_HEADER)
    || profileHeadingCount !== 1 || profileTable.length !== 2
    || JSON.stringify(profileTable[1]) !== JSON.stringify(ADAPTIVE_COVERAGE_PROFILE_ROW)
    || !taskReferencesCoverage
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.profileAuthority)
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.openKinds)) {
    issues.add("coverage-profile-shape");
  }

  const ambiguityTable = markdownTableUnderHeading(input.templates, "Example Mapping rule");
  if (JSON.stringify(ambiguityTable) !== JSON.stringify(ADAPTIVE_COVERAGE_AMBIGUITY_ROWS)
    || !templates.includes("retention of 30 versus 90 days is `decision-needed`")) {
    issues.add("ambiguity-actions");
  }

  const globalCeremony = /\b(?:critical|security|failure|proof|review|edge|obligations?|lenses?)\b[^.!?\n]{0,120}\b(?:union|apply|spread|require)\w*\b[^.!?\n]{0,120}\b(?:all|every)\s+(?:cp\s+)?(?:rows?|outcomes?|tasks?)\b|\b(?:union|apply|spread)\w*\b[^.!?\n]{0,120}\b(?:all|every)\s+(?:cp\s+)?(?:rows?|outcomes?|tasks?)\b/i;
  if (!has(templates, ADAPTIVE_COVERAGE_CLAUSES.scopedUnion)
    || globalCeremony.test(templates)
    || !review.includes("nonmaterial lenses are not added")) {
    issues.add("scoped-coverage");
  }

  const rederiveSources = [templates, skill, specMaker, review];
  if (!has(templates, ADAPTIVE_COVERAGE_CLAUSES.profileRederivation)
    || rederiveSources.some((source) => !/rederive affected cp rows?/.test(source.toLowerCase()))) {
    issues.add("profile-lifecycle");
  }

  const statusMatrix = markdownTableUnderHeading(input.templates, "Status matrix");
  if (!has(templates, ADAPTIVE_COVERAGE_CLAUSES.plannedProof)
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.proofSeparation)
    || !has(templates, IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping)
    || !has(skill, ADAPTIVE_COVERAGE_CLAUSES.liveLimit)
    || !statusMatrix.some((row) => row[0] === "accepted finding open or `UNKNOWN` reachability" && row[1] === "`blocked`")) {
    issues.add("proof-lifecycle");
  }

  const reviewerRowsPresent = ADAPTIVE_REVIEWER_ROWS.every((row) =>
    input.review.includes(`| ${row.join(" | ")} |`));
  if (!has(review, ADAPTIVE_COVERAGE_CLAUSES.reviewRisk)
    || !has(review, ADAPTIVE_COVERAGE_CLAUSES.reviewCapacity)
    || !reviewerRowsPresent) {
    issues.add("reviewer-routing");
  }
  if (!specMaker.includes("skills/specs/SKILL.md")
    || !specMaker.includes("skills/specs/references/templates.md")
    || !has(specMaker, ADAPTIVE_COVERAGE_CLAUSES.specMakerAuthority)
    || !has(specMaker, ADAPTIVE_COVERAGE_CLAUSES.specMakerAmbiguity)
    || !has(specMaker, ADAPTIVE_COVERAGE_CLAUSES.specMakerRoute)) {
    issues.add("spec-maker-authority");
  }

  const boundaryTable = markdownTableUnderHeading(input.templates, "No-invention and conditional boundary contracts");
  if (!boundaryTableHasRequiredRows(boundaryTable)) {
    issues.add("adaptive-boundary-lenses");
  }

  if (!has(skill, ADAPTIVE_COVERAGE_CLAUSES.scopeAskOnce)
    || !has(skill, ADAPTIVE_COVERAGE_CLAUSES.sizeNotRisk)) {
    issues.add("scope-ask-once");
  }

  const taskHeader = markdownTableUnderHeading(input.templates, "Tasks")[0] || [];
  // `markdownSectionUnderHeading` stops at the next `## ` line even inside a fence, so the
  // template sections are bounded by their own heading offsets instead.
  const planTemplateStart = input.templates.indexOf("## `plan.md` template");
  const taskTemplateStart = input.templates.indexOf("## `task-NN-*.md` template");
  const taskTemplateEnd = input.templates.indexOf("## Status matrix");
  // A heading counts only when it appears exactly once as a whole line at level two, so a
  // demoted or duplicated copy cannot satisfy the section it was moved out of.
  const soleHeadingOffset = (heading) => (
    input.templates.split("\n").filter((line) => line === heading).length === 1
      ? input.templates.indexOf(`\n${heading}\n`)
      : -1);
  const inPlanTemplate = (heading) => {
    const at = soleHeadingOffset(heading);
    return at > planTemplateStart && planTemplateStart >= 0
      && taskTemplateStart > planTemplateStart && at < taskTemplateStart;
  };
  const inTaskTemplate = (heading) => {
    const at = soleHeadingOffset(heading);
    return at > taskTemplateStart && taskTemplateStart > 0
      && taskTemplateEnd > taskTemplateStart && at < taskTemplateEnd;
  };
  if (!has(templates, ADAPTIVE_COVERAGE_CLAUSES.decisionsTable)
    || !inPlanTemplate("## Decisions")
    || !taskHeader.includes("Priority")
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.priorityRule)
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.orderedSteps)
    || !inTaskTemplate("## Steps")
    || !inTaskTemplate("## Failure Protocol")
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.failureProtocol)
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.workedFailureExample)
    || !has(templates, ADAPTIVE_COVERAGE_CLAUSES.verifyCompare)) {
    issues.add("decisions-steps-failure-protocol");
  }

  if (!has(skill, ADAPTIVE_COVERAGE_CLAUSES.factCheckSample)
    || !has(review, ADAPTIVE_COVERAGE_CLAUSES.reviewFactCheck)) {
    issues.add("fact-check-sample");
  }
  return [...issues].sort();
}

async function specsBundleLineDeltas() {
  const rows = [];
  for (const relativePath of SPECS_BUNDLE_FILES) {
    const content = await readFile(join(packageRoot, relativePath), "utf8");
    const lines = content.split("\n");
    const current = content.endsWith("\n") ? lines.length - 1 : lines.length;
    const ownedBaseline = ADAPTIVE_OWNED_BASELINE_LINES.get(relativePath);
    rows.push({
      relativePath,
      current,
      delta: ownedBaseline === undefined ? null : current - ownedBaseline,
    });
  }
  return rows;
}

async function runAdaptiveCoverageContractTests() {
  const fail = (message) => {
    throw new Error(`[FAIL] cf:specs adaptive coverage contract: ${message}`);
  };
  const baseline = {
    skill: await readFile(join(packageRoot, "src/claude/skills/specs/SKILL.md"), "utf8"),
    specMaker: await readFile(join(packageRoot, "src/claude/agents/spec-maker.md"), "utf8"),
    templates: await readFile(join(packageRoot, "src/claude/skills/specs/references/templates.md"), "utf8"),
    review: await readFile(join(packageRoot, "src/claude/skills/specs/references/review.md"), "utf8"),
  };
  const baselineIssues = adaptiveCoverageContractIssues(baseline);
  if (baselineIssues.length > 0) fail(`intact sources returned ${baselineIssues.join(", ")}`);

  const mutations = [
    ["frontmatter-risk-bypass", "skill", ADAPTIVE_COVERAGE_CLAUSES.frontmatterGate,
      "skip for any clear one-file or two-file change.", ["risk-first-routing"]],
    ["destructive-routine-direct", "skill", ADAPTIVE_COVERAGE_CLAUSES.directGate,
      "Work directly when the change is routine and likely limited to one or two files.", ["risk-first-routing"]],
    ["destructive-direct-exception", "skill", ADAPTIVE_COVERAGE_CLAUSES.directGate,
      `${ADAPTIVE_COVERAGE_CLAUSES.directGate} Exception: destructive one-file work labeled routine may go direct.`, ["risk-first-routing"]],
    ["user-risk-downgrade", "skill", ADAPTIVE_COVERAGE_CLAUSES.riskFirst,
      `${ADAPTIVE_COVERAGE_CLAUSES.riskFirst} A user may lower critical risk to routine.`, ["risk-first-routing"]],
    ["four-subsystem-split", "skill", ADAPTIVE_COVERAGE_CLAUSES.splitRoute,
      "Split four or more independent subsystems; otherwise use one Specs packet for substantial work.", ["risk-first-routing"]],
    ["forced-single-kind", "templates", ADAPTIVE_COVERAGE_CLAUSES.openKinds,
      "Choose one primary change kind and ignore unfamiliar kinds or surfaces.", ["coverage-profile-shape"]],
    ["missing-profile-column", "templates", "| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |",
      "| ID | Outcome | Change kinds | Material surfaces | Risk/evidence | Required proof |", ["coverage-profile-shape"]],
    ["duplicate-profile-heading", "templates", "## Coverage profile\n",
      "## Coverage profile\n\n## Coverage profile\n", ["coverage-profile-shape"]],
    ["truncated-profile-row", "templates", `| ${ADAPTIVE_COVERAGE_PROFILE_ROW.join(" | ")} |`,
      "| CP-01 | <externally observable outcome> |", ["coverage-profile-shape"]],
    ["examples-promote-to-design", "templates", `| ${ADAPTIVE_COVERAGE_AMBIGUITY_ROWS[2].join(" | ")} |`,
      "| `examples-needed` | add examples and promote to `design-needed` if behavior changes |", ["ambiguity-actions"]],
    ["examples-select-retention", "templates", "retention of 30 versus 90 days is\n`decision-needed`",
      "retention of 30 versus 90 days may remain\n`examples-needed`", ["ambiguity-actions"]],
    ["global-critical-ceremony", "templates", ADAPTIVE_COVERAGE_CLAUSES.scopedUnion,
      "Each task copies its CP values; authoring, review, edge, and proof obligations union across every task.", ["scoped-coverage"]],
    ["scoped-union-contradiction", "templates", ADAPTIVE_COVERAGE_CLAUSES.scopedUnion,
      `${ADAPTIVE_COVERAGE_CLAUSES.scopedUnion} Exception: critical proof obligations apply across every CP row.`, ["scoped-coverage"]],
    ["stale-profile-after-c2", "templates", ADAPTIVE_COVERAGE_CLAUSES.profileRederivation,
      "Keep existing coverage rows after accepted plan changes.", ["profile-lifecycle"]],
    ["planned-proof-blocks-start", "templates", ADAPTIVE_COVERAGE_CLAUSES.plannedProof,
      "`Required proof` is execution evidence: known but unrun proof blocks `pending`; `UNKNOWN` may proceed; missing evidence may still reach `done`/GATE-DONE.", ["proof-lifecycle"]],
    ["source-promotes-live", "templates", ADAPTIVE_COVERAGE_CLAUSES.proofSeparation,
      "Source proof may promote installed and live proof.", ["proof-lifecycle"]],
    ["unmapped-proof-level", "templates", IMPLEMENTATION_READINESS_CLAUSES.proofLevelMapping,
      "A task may map only one required proof level to its probe.", ["proof-lifecycle"]],
    ["critical-reviewer-omitted", "review", ADAPTIVE_COVERAGE_CLAUSES.reviewRisk,
      "Keep Fact Checker as the baseline and choose any remaining reviewer; critical rows need no matching risk role.", ["reviewer-routing", "scoped-coverage"]],
    ["reviewer-lens-overflow", "review", ADAPTIVE_COVERAGE_CLAUSES.reviewCapacity,
      "Each reviewer owns exactly one lens; skip excess material lenses when the fixed reviewer count is full.", ["reviewer-routing"]],
    ["spec-maker-local-taxonomy", "specMaker", ADAPTIVE_COVERAGE_CLAUSES.specMakerAuthority,
      "this agent owns a separate risk and coverage taxonomy.", ["spec-maker-authority"]],
    ["spec-maker-examples-decide", "specMaker", ADAPTIVE_COVERAGE_CLAUSES.specMakerAmbiguity,
      "Use examples to settle every ambiguous observable behavior.", ["spec-maker-authority"]],
    ["spec-maker-skips-brainstorm", "specMaker", ADAPTIVE_COVERAGE_CLAUSES.specMakerRoute,
      "Apply the risk-first route before GATE-SCOPE and stop only for direct work.", ["spec-maker-authority"]],
    ["static-proves-live", "skill", ADAPTIVE_COVERAGE_CLAUSES.liveLimit,
      "Source/static checks prove live-model adherence.", ["proof-lifecycle"]],
    ["scope-ask-drops-cut", "skill", ADAPTIVE_COVERAGE_CLAUSES.scopeAskOnce,
      "Ask GATE-SCOPE in one message: offer EXPAND or KEEP, and settle the remaining scope items yourself.", ["scope-ask-once"]],
    ["task-failure-protocol-improvises", "templates", ADAPTIVE_COVERAGE_CLAUSES.failureProtocol,
      "On a failed Verify, adjust the Command or the test until it passes.", ["decisions-steps-failure-protocol"]],
    ["priority-rule-optional", "templates", ADAPTIVE_COVERAGE_CLAUSES.priorityRule,
      "`Priority`: fill it in when the order matters.", ["decisions-steps-failure-protocol"]],
    ["worked-failure-example-dropped", "templates", ADAPTIVE_COVERAGE_CLAUSES.workedFailureExample,
      "Example failure: see the Develop repair loop.", ["decisions-steps-failure-protocol"]],
    ["steps-heading-dropped-from-task-template", "templates", "## Steps\n1. <ordered action on one owned file → expected observation>",
      "1. <ordered action on one owned file → expected observation>", ["decisions-steps-failure-protocol"]],
    ["steps-copy-escapes-task-template", "templates", "## Status matrix",
      "## Steps\n1. <ordered action on one owned file → expected observation>\n\n## Status matrix", ["decisions-steps-failure-protocol"]],
    ["author-trusts-stale-citations", "skill", ADAPTIVE_COVERAGE_CLAUSES.factCheckSample,
      "Before GATE-REVIEW, trust the `path:line` citations already written in the plan.", ["fact-check-sample"]],
  ];
  for (const [name, source, from, to, expected] of mutations) {
    const anchor = baseline[source].indexOf(from);
    if (anchor < 0) fail(`${name} mutation anchor is absent from real source`);
    if (baseline[source].indexOf(from, anchor + from.length) >= 0) {
      fail(`${name} mutation anchor is not unique in real source`);
    }
    const weakened = `${baseline[source].slice(0, anchor)}${to}${baseline[source].slice(anchor + from.length)}`;
    const actual = adaptiveCoverageContractIssues({ ...baseline, [source]: weakened });
    if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
      fail(`${name} expected ${JSON.stringify([...expected].sort())} but returned ${JSON.stringify(actual)}`);
    }
  }

  const integrationRow = IMPLEMENTATION_READINESS_BOUNDARY_ROWS
    .find(([label]) => label === "Integration/proof");
  const integrationLine = `| ${integrationRow.join(" | ")} |`;
  const validVariants = [
    ["open material surface", baseline.templates.replace(
      integrationLine,
      `${integrationLine}\n| other:domain-specific | task-specific material choices and observable oracle |`,
    )],
    ["task CP reference requirement", baseline.templates.replace(
      ADAPTIVE_COVERAGE_CLAUSES.scopedUnion,
      `${ADAPTIVE_COVERAGE_CLAUSES.scopedUnion} Require every task to reference a CP row.`,
    )],
  ];
  for (const [name, templates] of validVariants) {
    if (templates === baseline.templates
      || adaptiveCoverageContractIssues({ ...baseline, templates }).length > 0) {
      fail(`${name} must remain valid`);
    }
  }

  const deltas = await specsBundleLineDeltas();
  const total = deltas.reduce((sum, row) => sum + row.current, 0);
  if (total > 750) fail(`bundle line budget is ${total}/750`);
  const changed = deltas.filter(({ delta }) => delta !== null && delta !== 0)
    .map(({ relativePath, delta }) => `${relativePath} ${delta >= 0 ? "+" : ""}${delta}`)
    .join(", ");
  console.log(`✔ cf:specs adaptive coverage contract is complete and monotonic; bundle deltas: ${changed}; total ${total}/750`);
  console.log(`✔ cf:specs adaptive coverage checker rejects ${mutations.length} semantic weakenings`);
  return mutations.length + 3;
}

const CONSUMER_SECTION_CLAUSES = {
  developLoads: "Scope, Ownership, Steps, Acceptance, Dependencies, Verification Plan, Failure Protocol, owned code, and consumers.",
  ruleExtractsSteps: "  - `Ownership`\n  - `Steps`\n  - `Acceptance`",
  ruleExtractsProtocol: "  - `Verification Plan`\n  - `Failure Protocol`",
  specMakerRequires: "Each task owns one outcome, a priority, normally no more\nthan about five files, explicit acceptance IDs, dependencies, ordered Steps, a runnable\nVerification Plan, and a Failure Protocol.",
};

// A task's `## Steps` and `## Failure Protocol` are only worth authoring if the workflows that
// execute the task read them. Each consumer is checked in its own file so a phrase present in the
// wrong file cannot satisfy another file's obligation.
function consumerSectionIssues(input) {
  const keys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (keys.join(",") !== "develop,specMaker,workflowRule"
    || keys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("consumer section checker expects develop, workflowRule, and specMaker UTF-8 strings");
  }

  const issues = new Set();
  const normalized = (value) => normalizeMarkdownWhitespace(value);
  if (!normalized(input.develop).includes(normalized(CONSUMER_SECTION_CLAUSES.developLoads))) {
    issues.add("develop-loads-task-sections");
  }
  const ruleExtracts = (block) => input.workflowRule.includes(block);
  if (!ruleExtracts(CONSUMER_SECTION_CLAUSES.ruleExtractsSteps)
    || !ruleExtracts(CONSUMER_SECTION_CLAUSES.ruleExtractsProtocol)) {
    issues.add("rule-extracts-task-sections");
  }
  if (!normalized(input.specMaker).includes(normalized(CONSUMER_SECTION_CLAUSES.specMakerRequires))) {
    issues.add("spec-maker-requires-task-sections");
  }
  return [...issues].sort();
}

async function runConsumerSectionContractTests() {
  const fail = (message) => {
    throw new Error(`[FAIL] cf:specs consumer sections: ${message}`);
  };
  const baseline = {
    develop: await readFile(join(packageRoot, "src/claude/skills/develop/SKILL.md"), "utf8"),
    workflowRule: await readFile(join(packageRoot, "src/claude/rules/workflow.md"), "utf8"),
    specMaker: await readFile(join(packageRoot, "src/claude/agents/spec-maker.md"), "utf8"),
  };
  const baselineIssues = consumerSectionIssues(baseline);
  if (baselineIssues.length > 0) fail(`intact sources returned ${baselineIssues.join(", ")}`);

  const mutations = [
    ["develop-drops-failure-protocol", "develop", CONSUMER_SECTION_CLAUSES.developLoads,
      "Scope, Ownership, Steps, Acceptance, Dependencies, Verification Plan, owned code, and consumers.",
      ["develop-loads-task-sections"]],
    ["develop-drops-steps", "develop", CONSUMER_SECTION_CLAUSES.developLoads,
      "Scope, Ownership, Acceptance, Dependencies, Verification Plan, Failure Protocol, owned code, and consumers.",
      ["develop-loads-task-sections"]],
    ["rule-drops-steps", "workflowRule", "  - `Steps`\n  - `Acceptance`", "  - `Acceptance`",
      ["rule-extracts-task-sections"]],
    ["rule-drops-failure-protocol", "workflowRule", "  - `Verification Plan`\n  - `Failure Protocol`",
      "  - `Verification Plan`", ["rule-extracts-task-sections"]],
    ["spec-maker-drops-protocol-and-priority", "specMaker", CONSUMER_SECTION_CLAUSES.specMakerRequires,
      "Each task owns one outcome, normally no more\nthan about five files, explicit acceptance IDs, dependencies, and a runnable\nVerification Plan.",
      ["spec-maker-requires-task-sections"]],
  ];
  for (const [name, source, from, to, expected] of mutations) {
    const anchor = baseline[source].indexOf(from);
    if (anchor < 0) fail(`${name} mutation anchor is absent from real source`);
    if (baseline[source].indexOf(from, anchor + from.length) >= 0) {
      fail(`${name} mutation anchor is not unique in real source`);
    }
    const weakened = `${baseline[source].slice(0, anchor)}${to}${baseline[source].slice(anchor + from.length)}`;
    const actual = consumerSectionIssues({ ...baseline, [source]: weakened });
    if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
      fail(`${name} expected ${JSON.stringify([...expected].sort())} but returned ${JSON.stringify(actual)}`);
    }
  }
  console.log(`✔ cf:specs consumers load Steps and Failure Protocol; rejects ${mutations.length} weakenings`);
  return mutations.length + 1;
}

const PROCESS_TASK_STATUS_CLAUSES = {
  skill: [
    "`pending` means semantically ready for the dependency-aware queue.",
    "Use `blocked` while a GATE-SCOPE/GATE-REVIEW decision, accepted finding, or `UNKNOWN` closure remains\nopen.",
    "Dependencies alone do not change `pending`; the resolver queues them.",
    "Promote only after current evidence closes every non-dependency blocker",
  ],
  templates: [
    "Use only direct-child task basenames or `none` under `## Dependencies`; keep `## Receipt` empty until execution produces canonical proof.",
  ],
  specMaker: [
    "Keep every new\ntask `Status: blocked` while GATE-REVIEW is open",
    "`pending` means semantically ready for the dependency-aware queue.",
    "Keep a task\n`blocked` while a GATE-SCOPE/GATE-REVIEW decision, accepted finding, or `UNKNOWN` closure remains\nopen.",
    "A named task dependency alone does not make it blocked; write dependencies\nas exact flat task basenames and let the resolver derive the next pending task.",
    "Move `blocked` to `pending` only when current evidence closes every non-dependency\nblocker.",
  ],
};

const PROCESS_TASK_STATUS_MATRIX = [
  ["Status condition", "Persisted state"],
  ["GATE-SCOPE/GATE-REVIEW decision open", "`blocked`"],
  ["accepted finding open or `UNKNOWN` reachability", "`blocked`"],
  ["every non-dependency blocker closed", "`pending`"],
  ["named task dependency not done", "keep `pending`; queue gates it"],
];

function processTaskStatusContractIssues(input) {
  const expectedKeys = ["skill", "specMaker", "templates"];
  const keys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)
    || expectedKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("process-task-status checker expects exactly skill, specMaker, and templates UTF-8 strings");
  }

  const issues = new Set();
  const containsClause = (source, clause) => normalizeMarkdownWhitespace(source)
    .includes(normalizeMarkdownWhitespace(clause));
  for (const [source, clauses] of Object.entries(PROCESS_TASK_STATUS_CLAUSES)) {
    if (clauses.some((clause) => !containsClause(input[source], clause))) {
      issues.add(`${source}-status-contract`);
    }
  }

  const taskTemplate = markdownSectionUnderHeading(input.templates, "`task-NN-*.md` template");
  const taskStatuses = [...taskTemplate.matchAll(/^Status:\s*(\S+)\s*$/gm)].map((match) => match[1]);
  const statusMatrix = markdownTableUnderHeading(input.templates, "Status matrix");
  const taskTable = markdownTableUnderHeading(input.templates, "Tasks");
  const taskRows = taskTable.slice(1);
  if (taskStatuses.length !== 1 || taskStatuses[0] !== "blocked"
    || taskRows.length === 0 || taskRows.some((row) => row.at(-1) !== "blocked")) {
    issues.add("template-default-blocked");
  }
  if (JSON.stringify(statusMatrix) !== JSON.stringify(PROCESS_TASK_STATUS_MATRIX)) {
    issues.add("status-matrix");
  }

  const unconditionalAllPending = /(?:leave|keep|set|mark)\s+(?:all|every)\s+new\s+tasks?\s+(?:`status:\s*)?pending`?/i;
  if (Object.values(input).some((source) => unconditionalAllPending.test(
    normalizeMarkdownWhitespace(source),
  ))) {
    issues.add("unconditional-all-pending");
  }
  const contradictoryStatusOverride = (source) => normalizeMarkdownWhitespace(source)
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => {
      // Gate names: the current GATE-SCOPE/GATE-REVIEW plus the C1/C2 spelling that
      // still appears in completed packets and historical plans.
      const GATE = "(?:C[12]|GATE-(?:SCOPE|REVIEW))";
      const gateStillOpen = new RegExp(`\\b${GATE}\\b.{0,60}\\b(?:open|unresolved|remains?\\s+open)\\b`, "i").test(sentence)
        || new RegExp(`\\bunresolved\\b.{0,40}\\b${GATE}\\b`, "i").test(sentence)
        || new RegExp(`\\b(?:before|until)\\b.{0,30}\\b${GATE}\\b.{0,30}\\b(?:closes?|resolved)\\b`, "i").test(sentence);
      return gateStillOpen
        && /\b(?:pending|dispatch(?:able)?|handoff)\b/i.test(sentence)
        && !/\bblocked\b/i.test(sentence);
    });
  if (Object.values(input).some(contradictoryStatusOverride)) {
    issues.add("contradictory-status-override");
  }

  return [...issues].sort();
}

async function runProcessTaskStatusContractTests() {
  const fail = (message) => {
    throw new Error(`[FAIL] Specs process-task status contract: ${message}`);
  };
  const baseline = {
    skill: await readFile(join(packageRoot, "src/claude/skills/specs/SKILL.md"), "utf8"),
    templates: await readFile(
      join(packageRoot, "src/claude/skills/specs/references/templates.md"),
      "utf8",
    ),
    specMaker: await readFile(join(packageRoot, "src/claude/agents/spec-maker.md"), "utf8"),
  };
  const baselineIssues = processTaskStatusContractIssues(baseline);
  if (baselineIssues.length > 0) fail(`intact sources returned ${baselineIssues.join(", ")}`);

  const mutations = [
    {
      name: "pending-means-queue-ready",
      source: "skill",
      from: PROCESS_TASK_STATUS_CLAUSES.skill[0],
      to: "`pending` means drafted and waiting.",
      issues: ["skill-status-contract"],
    },
    {
      name: "semantic-blockers-stay-blocked",
      source: "skill",
      from: PROCESS_TASK_STATUS_CLAUSES.skill[1],
      to: "Use `blocked` only when an implementation command fails.",
      issues: ["skill-status-contract"],
    },
    {
      name: "task-template-default-blocked",
      source: "templates",
      from: "Status: blocked\n\n## Outcome",
      to: "Status: pending\n\n## Outcome",
      issues: ["template-default-blocked"],
    },
    {
      name: "task-template-rejects-duplicate-status",
      source: "templates",
      from: "Status: blocked\n\n## Outcome",
      to: "Status: blocked\nStatus: pending\n\n## Outcome",
      issues: ["template-default-blocked"],
    },
    {
      name: "task-table-rejects-mixed-default-statuses",
      source: "templates",
      from: "| 01 | <one outcome> | P1 | AC-01 | `src/example.ts` | - | blocked |",
      to: "| 01 | <one outcome> | P1 | AC-01 | `src/example.ts` | - | blocked |\n| 02 | <later outcome> | P2 | AC-01 | `src/later.ts` | task-01-example.md | pending |",
      issues: ["template-default-blocked"],
    },
    {
      name: "current-evidence-transition",
      source: "templates",
      from: "| every non-dependency blocker closed | `pending` |",
      to: "| every non-dependency blocker closed | `blocked` |",
      issues: ["status-matrix"],
    },
    {
      name: "reject-unconditional-all-pending",
      source: "specMaker",
      from: PROCESS_TASK_STATUS_CLAUSES.specMaker[0],
      to: "Leave every new task `Status: pending` while GATE-REVIEW is open",
      issues: ["contradictory-status-override", "specMaker-status-contract", "unconditional-all-pending"],
    },
    {
      name: "reject-contradictory-status-override",
      source: "skill",
      from: PROCESS_TASK_STATUS_CLAUSES.skill[1],
      to: `${PROCESS_TASK_STATUS_CLAUSES.skill[1]}\n\nException: a task with an unresolved GATE-REVIEW decision may remain pending.`,
      issues: ["contradictory-status-override"],
    },
    {
      name: "reject-c2-open-pending-paraphrase",
      source: "skill",
      from: PROCESS_TASK_STATUS_CLAUSES.skill[1],
      to: `${PROCESS_TASK_STATUS_CLAUSES.skill[1]}\n\nHowever, while GATE-REVIEW remains open, a task can stay pending.`,
      issues: ["contradictory-status-override"],
    },
    {
      name: "reject-before-c2-close-pending-paraphrase",
      source: "skill",
      from: PROCESS_TASK_STATUS_CLAUSES.skill[1],
      to: `${PROCESS_TASK_STATUS_CLAUSES.skill[1]}\n\nA task can be pending before GATE-REVIEW closes.`,
      issues: ["contradictory-status-override"],
    },
  ];

  for (const { name, source, from, to, issues } of mutations) {
    const anchorIndex = baseline[source].indexOf(from);
    if (anchorIndex < 0) fail(`${name} mutation anchor is absent from real source`);
    if (baseline[source].indexOf(from, anchorIndex + from.length) >= 0) {
      fail(`${name} mutation anchor is not unique in real source`);
    }
    const mutatedSource = `${baseline[source].slice(0, anchorIndex)}${to}${baseline[source].slice(anchorIndex + from.length)}`;
    const actual = processTaskStatusContractIssues({ ...baseline, [source]: mutatedSource });
    const expected = [...issues].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      fail(`${name} expected ${JSON.stringify(expected)} but returned ${JSON.stringify(actual)}`);
    }
  }

  console.log(`✔ cf:specs process-task status checker rejects ${mutations.length} semantic weakenings`);
  return mutations.length + 1;
}

const BRAINSTORM_BUNDLE_LIMIT = 506;
const BRAINSTORM_CONTRACT_CLAUSES = {
  direct: "for a factual answer, a specific command, or an explicitly different workflow, leave Brainstorm before scout, questions, approval, or persistence.",
  readOnlyExploration: "Read-only product or architecture exploration is not direct merely because it writes no files.",
  acceptedSkill: "reuse accepted Outcome, Constraints, Non-goals, and Acceptance field by field only when current user text or an approved artifact binds them to the same target and revision.",
  hydrationTransition: "Hydration is not a terminal route; continue to exactly one intent route below.",
  acceptedFramework: "Preserve a current non-conflicting field; do not ask the user to repeat it.",
  staleFramework: "Treat a missing, stale, or conflicting field as unresolved",
  hydrationFramework: "Hydration never selects the route; classify the remaining request afterward.",
  neverApproval: "Never infer approval.",
  bugContract: "before diagnosis, capture the repaired-behavior Outcome, Constraints, Non-goals, and Acceptance evidence.",
  debugFirst: "Then use `cf:debug` until root cause is evidenced. Do not brainstorm fixes from a symptom.",
  remedyCount: "If at least two cause-aligned remedies remain, compare 2–3 here.",
  hotfixAuthority: "Hand off to `cf:fix` only when the user explicitly requested a fix",
  diagnosisStop: "diagnosis-only work returns the root-cause report and stops.",
  nonBugExploration: "Non-bug exploration only",
  explorationStop: "Do not request design approval, persist a report, or invoke another workflow without a new explicit request.",
  explicitSpecs: "ask the user to invoke `cf:specs` explicitly in a new request.",
  noDevelop: "Brainstorm never writes implementation, invokes Develop, or treats approval as implementation authority.",
  materialChoice: "A material design choice exists only when at least two viable paths would satisfy the contract with meaningfully different consequences.",
  optionCount: "For a material choice, compare 2–3 mechanically distinct viable approaches",
  singlePath: "With one viable path, present it and explain briefly why alternatives would be artificial or fail the contract. Never create strawman options.",
  reviewBeforePresent: "Run the internal 4-point review before presentation",
  presentReviewed: "Present the reviewed candidate.",
  criticalDecision: "Before final approval, require a separate explicit section decision when the design changes auth/secrets/privacy, destructive or irreversible behavior or data-loss risk, money/privilege/safety, or production-state mutation.",
  finalApproval: "After critical section decisions and revisions, request one final approval by default.",
  approvedPersistence: "Persist only approved decisions and semantics, only with user authority",
  configuredPath: "Use the repository's configured report path and naming convention.",
  redactPersistence: "Before writing, redact live secrets, credentials, private keys, access tokens, and unnecessary PII;",
  visualEvidence: "For supplied images, video, PDFs, or mockups, use `cf:ai-multimodal` when the optional document bundle is installed; otherwise use the runtime's available multimodal capability or report the evidence gap.",
  touchpoints: "Technical touchpoints are evidence, not a fifth user-owned field.",
  riskSurfaces: "Raise only risks that can change the contract or approval path",
  decisionTruth: "Do not write \"user selected\" unless direct user text or the native input tool confirms it.",
  specialistGate: "Proceed to comparative analysis only when at least two viable architectural paths have materially different consequences.",
  specialistSingle: "If one path is viable, return that conclusion and why alternatives fail the contract; never invent strawmen to fill a quota.",
  specialistBoundary: "Do not ask the user directly, write files, mutate shared task state, delegate work, invoke Specs/Fix/Develop, or claim approval.",
  specialistHandoff: "Non-bug exploration may end in chat; feature/docs delivery may only prepare a future explicit Specs invocation; bug handoff requires evidenced root cause and the user's explicit fix request.",
  controlSegment: "Parse controls only from the leading consecutive token segment.",
  controlGrammar: "Accept `--deep`, `--visual`, and `--advice` in any order, each at most once.",
  controlTerminator: "`--` ends the control segment.",
  contentBoundary: "After it or the first content token, every token is user content.",
  controlReject: "An unknown or duplicate `--*` inside the leading segment returns usage and performs no scout, question, tool call, write, or workflow action.",
  directBeforeControls: "Route Direct first, then apply controls only to requests that remain in Brainstorm.",
  depthStandard: "**Standard:** bounded single-surface work with no material risk signal.",
  depthDeep: "**Deep:** critical safety/security risk; public compatibility or data migration; cross-service state or concurrency; costly or irreversible rollback; or unresolved feasibility at a material boundary.",
  depthFallback: "With no Deep signal, use Standard. `--deep` raises Standard to Deep.",
  depthSplit: "If three or more subsystems are independently deliverable, split them instead of using Deep as a monolithic substitute.",
  lensSkip: "Apply a lens only when its trigger is present and otherwise record `skipped: <reason>`",
  visualOverlay: "`--visual` may present inline Mermaid or ASCII for any non-direct analysis and falls back to equivalent text when rendering is unavailable.",
  adviceOverlay: "`--advice` invokes `brainstormer` only after the material-choice gate; if advice is unavailable or fails, label it unavailable and continue with controller analysis.",
  overlayRedaction: "Before an external visual tool or adviser handoff, minimize context and redact secrets, credentials, private keys, access tokens, and unnecessary PII.",
  overlayAuthority: "Neither overlay writes, approves, persists, dispatches, or completes work.",
  feasibilityEnums: "**Feasibility:** `confirmed | plausible | unknown | infeasible`.",
  confidenceEnums: "**Confidence:** `high | medium | low`.",
  dispositionEnums: "**Disposition:** `chosen | rejected | deferred`.",
  evidenceFallback: "Missing evidence forces feasibility `unknown` and confidence `low`",
  numericEstimate: "A numeric estimate is valid only with range, unit, basis, evidence, and assumptions.",
  controllerEvidence: "On every route, keep feasibility (`confirmed | plausible | unknown | infeasible`), confidence (`high | medium | low`), and disposition (`chosen | rejected | deferred`) separate and cite evidence or basis.",
  controllerNumeric: "A numeric estimate requires range, unit, basis, evidence, and assumptions; otherwise report `unknown`.",
  decisionBrief: "The default handoff stays in chat Markdown.",
  decisionFreshness: "The first section records target identity, current source revision and worktree state or `[UNVERIFIED]`, an evidence-as-of value, and what change invalidates the brief.",
  decisionAuthority: "Durable file output requires explicit authority and creates no readiness, approval, proof, or execution state.",
  adviserRedaction: "Confirm the controller minimized and redacted supplied context.",
  adviserEvidence: "Keep feasibility (`confirmed | plausible | unknown | infeasible`), confidence (`high | medium | low`), and disposition (`chosen | rejected | deferred`) separate and evidence-backed.",
  adviserNumeric: "A numeric estimate requires range, unit, basis, evidence, and assumptions; otherwise report `unknown`.",
};

const BRAINSTORM_DECISION_HEADINGS = [
  "Target and evidence freshness", "Outcome", "Constraints", "Non-goals",
  "Acceptance", "Touchpoints", "Direction and alternatives",
  "Relevant impacts and failure behavior", "Rollout and recovery",
  "Proof mapping", "Decision register", "Assumptions", "Open questions",
];

const BRAINSTORM_LENS_TRIGGERS = [
  "feasibility for an unresolved material boundary",
  "stakeholders for externally affected roles",
  "system boundaries for cross-component state",
  "failure isolation for partial or cascading failure across boundaries",
  "reversibility and recovery for costly or irreversible failure",
  "operability for runtime ownership",
  "migration/rollback for data or public compatibility",
  "testability for a material proof gap",
  "second-order effects for downstream behavior or incentives",
];

const BRAINSTORM_ADAPTIVE_GROUPS = [
  "direct-precedence", "ordered-depth", "leading-flags", "lens-trigger-skip",
  "evidence-semantics", "numeric-estimates", "pre-tool-authority-redaction",
  "adviser-gate-fallback", "decision-brief", "no-persistence-dispatch",
];

const BRAINSTORM_BASELINE_LINES = {
  skill: 188,
  framework: 232,
  agent: 86,
};

function brainstormSemanticMarkdown(content) {
  return String(content)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/~~[\s\S]*?~~/g, " ");
}

function replaceBrainstormClauseOnce(content, clause, replacement) {
  const pattern = normalizeMarkdownWhitespace(clause)
    .split(" ")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const matcher = new RegExp(pattern, "g");
  const matches = [...String(content).matchAll(matcher)];
  if (matches.length !== 1) {
    throw new Error(`expected one normalized Brainstorm mutation anchor, found ${matches.length}`);
  }
  return String(content).replace(matcher, replacement);
}

function brainstormClausePrefix(content, index) {
  const starts = [".", "!", "?", ";", "\n"].map((marker) => content.lastIndexOf(marker, index - 1));
  return content.slice(Math.max(...starts) + 1, index).trim();
}

function brainstormIsLocallyNegated(content, index) {
  const clausePrefix = brainstormClausePrefix(content, index);
  const localBoundary = Math.max(
    clausePrefix.lastIndexOf(","),
    clausePrefix.lastIndexOf(":"),
    clausePrefix.lastIndexOf("—"),
  );
  const localPrefix = clausePrefix.slice(localBoundary + 1).trim().toLowerCase();
  const directNegation = /\b(?:never|do not|does not|must not|may not|should not|will not|cannot|can't|is not|are not|is forbidden to|are forbidden to|is not (?:permitted|allowed) to|are not (?:permitted|allowed) to|not (?:permitted|allowed) to)(?:\s+(?:ever|directly|automatically|implicitly|explicitly|immediately|intentionally|silently))*(?:\s+(?:be|to be))?\s*$/;
  if (directNegation.test(localPrefix)) return true;
  const fullPrefix = clausePrefix.toLowerCase();
  if (/\b(?:but|yet|however|except|instead)\b[^.!?;\n]*$/.test(fullPrefix)) return false;
  return /\b(?:never|do not|does not|must not|may not|should not|will not|cannot|can't|is forbidden to|are forbidden to|is not (?:permitted|allowed) to|are not (?:permitted|allowed) to|not (?:permitted|allowed) to)\b(?:(?!\b(?:but|yet|however|except|instead)\b).){0,160}\b(?:and|or|nor)(?:\s+then)?(?:\s+(?:ever|directly|automatically|implicitly|explicitly|immediately|intentionally|silently))*\s*$/.test(fullPrefix);
}

function brainstormHasAffirmativePhrase(content, pattern) {
  const value = normalizeMarkdownWhitespace(content);
  for (const match of value.matchAll(pattern)) {
    if (!brainstormIsLocallyNegated(value, match.index)) return true;
  }
  return false;
}

function brainstormHasWorkflowDispatch(content, workflow, allowUserInvocation = false) {
  const escapedWorkflow = workflow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    "\\b(?:invoke|start|dispatch|launch|route|forward|run|execute|hand(?:\\s+|-)?off)\\b"
      + `[^.!?;\\n]{0,100}?\\b(?:cf:)?${escapedWorkflow}\\b`,
    "gi",
  );
  const value = normalizeMarkdownWhitespace(content);
  for (const match of value.matchAll(pattern)) {
    const prefix = brainstormClausePrefix(value, match.index).toLowerCase();
    if (brainstormIsLocallyNegated(value, match.index)) continue;
    if (allowUserInvocation
      && /\b(?:(?:ask|tell|require)(?:s|ed|ing)?\s+the user to|the user may|wait for the user to)\s*$/.test(prefix)) continue;
    return true;
  }
  return false;
}

function brainstormHasUnauthorizedSpecialistAuthority(content) {
  const value = normalizeMarkdownWhitespace(content);
  const actionPattern = /\b(?:ask|question|contact|invoke|start|dispatch|launch|route|forward|run|execute|hand(?:\s+|-)?off|write|edit|update|mutate|delegate|claim)\b/gi;
  const actions = [...value.matchAll(actionPattern)];
  for (let index = 0; index < actions.length; index += 1) {
    const match = actions[index];
    const normalizedAction = match[0].toLowerCase().replace(/[-\s]+/g, " ");
    const action = normalizedAction === "handoff" ? "hand off" : normalizedAction;
    const start = match.index + match[0].length;
    const nextAction = actions[index + 1]?.index ?? value.length;
    const punctuation = value.slice(start).search(/[.!?;\n]/);
    const punctuationEnd = punctuation < 0 ? value.length : start + punctuation;
    const tail = value.slice(start, Math.min(start + 100, nextAction, punctuationEnd));
    const hasTarget = ["ask", "question", "contact"].includes(action)
      ? /\b(?:the )?user\b/i.test(tail)
      : ["invoke", "start", "dispatch", "launch", "route", "forward", "run", "execute", "hand off"].includes(action)
        ? /\b(?:Specs|Fix|Develop)\b/i.test(tail)
        : ["write", "edit", "update", "mutate"].includes(action)
          ? /\b(?:files?|task state|shared state)\b/i.test(tail)
          : action === "delegate"
            ? /\b(?:work|tasks?)\b/i.test(tail)
            : /\bapproval\b/i.test(tail);
    if (hasTarget && !brainstormIsLocallyNegated(value, match.index)) return true;
  }
  return false;
}

function brainstormHasUnsafePersistence(content) {
  return brainstormHasAffirmativePhrase(
    content,
    /\b(?:persist|write|save|copy|store|archive|record|commit)\b.{0,120}\b(?:before (?:final )?approval|without (?:explicit )?(?:user )?authority|raw (?:credentials?|secrets?|tokens?|private keys?|PII)|(?:credentials?|secrets?|tokens?|private keys?|PII) (?:verbatim|unredacted)|unapproved draft)\b/gi,
  );
}

function brainstormHasApprovalBypass(content) {
  return brainstormHasAffirmativePhrase(
    content,
    /\b(?:(?:skip|bypass|omit)\b|avoid\b(?!\s+duplicate\b)).{0,80}\b(?:final approval|section decision|approval)\b/gi,
  ) || brainstormHasAffirmativePhrase(
    content,
    /\b(?:final approval|section decision|approval)\b.{0,60}\b(?:optional|not required|unnecessary)\b/gi,
  );
}

function brainstormHasDirectCeremony(content) {
  const value = normalizeMarkdownWhitespace(content);
  const actionPattern = /\b(?:scout|inspect|discovery|questions?|approval|ask|request|seek|require|persist|write|save)\b/gi;
  for (const match of value.matchAll(actionPattern)) {
    const prefix = brainstormClausePrefix(value, match.index).toLowerCase();
    if (!/\bdirect requests?\b/.test(prefix)) continue;
    if (!brainstormIsLocallyNegated(value, match.index)) return true;
  }
  return false;
}

function brainstormClauseAround(value, index) {
  const start = Math.max(value.lastIndexOf(".", index - 1), value.lastIndexOf(";", index - 1), value.lastIndexOf("\n", index - 1)) + 1;
  const endings = [value.indexOf(".", index), value.indexOf(";", index), value.indexOf("\n", index)].filter((entry) => entry >= 0);
  const end = endings.length > 0 ? Math.min(...endings) : value.length;
  return value.slice(start, end);
}

function brainstormHasControlBeforeDirect(content) {
  const value = normalizeMarkdownWhitespace(content);
  for (const match of value.matchAll(/\b(?:appl(?:y|ies|ied|ying)|honor(?:s|ed|ing)?|pars(?:e|es|ed|ing)|process(?:es|ed|ing)?|run(?:s|ning)?|ran|activat(?:e|es|ed|ing)|execut(?:e|es|ed|ing))\b/gi)) {
    const clause = brainstormClauseAround(value, match.index);
    if (/(?:--deep|--visual|--advice|controls?|overlays?)/i.test(clause)
      && (/(?:before|prior to|ahead of).{0,30}Direct/i.test(clause)
        || /Direct.{0,80}(?:after|until after).{0,80}(?:--deep|--visual|--advice|controls?|overlays?|appl|honor|pars|process|run|activat|execut)/i.test(clause))
      && !brainstormIsLocallyNegated(value, match.index)) return true;
  }
  return false;
}

function brainstormHasSensitiveAdviserTransfer(content) {
  const value = normalizeMarkdownWhitespace(content);
  for (const match of value.matchAll(/\b(?:forward(?:s|ed|ing)?|shar(?:e|es|ed|ing)|send(?:s|ing)?|sent|cop(?:y|ies|ied|ying)|transmit(?:s|ted|ting)?|provid(?:e|es|ed|ing)|disclos(?:e|es|ed|ing))\b/gi)) {
    const clause = brainstormClauseAround(value, match.index);
    if (/(?:advisers?|advisors?|brainstormer|specialist)/i.test(clause)
      && /(?:credentials?|secrets?|tokens?|private keys?|PII)/i.test(clause)
      && !brainstormIsLocallyNegated(value, match.index)) return true;
  }
  return false;
}

function brainstormHasDeepWithoutSignal(content) {
  const value = normalizeMarkdownWhitespace(content);
  for (const match of value.matchAll(/\b(?:default|use|uses|used|using|selects?|selected|chooses?|chosen|allows?|allowed)\b/gi)) {
    const clause = brainstormClauseAround(value, match.index);
    const action = match[0].toLowerCase();
    const actionTargetsDeep = action === "default"
      ? /\bDeep\b.{0,30}\bdefault\b/i.test(clause)
      : new RegExp(`\\b${match[0]}\\b.{0,30}\\bDeep\\b`, "i").test(clause);
    if (actionTargetsDeep
      && /(?:no|without|absent|even when no).{0,40}(?:material risk|Deep)?\s*signal/i.test(clause)
      && !brainstormIsLocallyNegated(value, match.index)) return true;
  }
  return false;
}

function brainstormHasOptionalEvidence(content) {
  const value = normalizeMarkdownWhitespace(content);
  for (const match of value.matchAll(/\boptional\b/gi)) {
    const clause = brainstormClauseAround(value, match.index);
    if (/\bevidence\b/i.test(clause) && /\b(?:feasibility|confidence|confirmed|plausible)\b/i.test(clause)
      && !brainstormIsLocallyNegated(value, match.index)) return true;
  }
  return false;
}

function brainstormHasStaleDecisionPermission(content) {
  const value = normalizeMarkdownWhitespace(content);
  for (const match of value.matchAll(/\binvalidat(?:e|es|ed|ing)\b/gi)) {
    const clause = brainstormClauseAround(value, match.index);
    if (/\b(?:revision|HEAD|worktree|evidence)\b/i.test(clause)
      && /\b(?:brief|handoff|design)\b/i.test(clause)
      && brainstormIsLocallyNegated(value, match.index)) return true;
  }
  for (const match of value.matchAll(/\b(?:continue|continues|continued|using|use|uses|rely|relies|relied|remain|remains|stays?|valid|current)\b/gi)) {
    const clause = brainstormClauseAround(value, match.index);
    if (/\b(?:brief|handoff|design)\b/i.test(clause)
      && /(?:after|despite).{0,40}\b(?:revision|HEAD|worktree|evidence)\b.{0,20}\bchanges?\b/i.test(clause)
      && !brainstormIsLocallyNegated(value, match.index)) return true;
  }
  return false;
}

function brainstormHasUnsafeEvidencePromotion(content) {
  return brainstormHasAffirmativePhrase(
    content,
    /\b(?:classify|mark|report|treat|set|allow)\b.{0,100}\b(?:confirmed|plausible|high confidence)\b.{0,100}\b(?:without|missing|absent)\b.{0,30}\bevidence\b/gi,
  ) || brainstormHasAffirmativePhrase(
    content,
    /\b(?:missing|absent)\b.{0,30}\bevidence\b.{0,100}\b(?:may|can|permits?|allows?)\b.{0,100}\b(?:confirmed|plausible|high confidence)\b/gi,
  );
}

function brainstormContractIssues(input) {
  const expectedKeys = ["agent", "framework", "skill"];
  const keys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)
    || expectedKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("brainstorm checker expects exactly agent, framework, and skill UTF-8 strings");
  }

  const issues = new Set();
  const semantic = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, brainstormSemanticMarkdown(value)]),
  );
  const normalized = Object.fromEntries(
    Object.entries(semantic).map(([key, value]) => [key, normalizeMarkdownWhitespace(value)]),
  );
  const has = (source, clause) => normalized[source].includes(normalizeMarkdownWhitespace(clause));
  const frontDoor = markdownSectionUnderHeading(semantic.skill, "Front-door routing — before scout or questions");
  const contract = markdownSectionUnderHeading(semantic.skill, "Contract and evidence");
  const options = markdownSectionUnderHeading(semantic.skill, "Options and specialist use");
  const delivery = markdownSectionUnderHeading(semantic.skill, "Delivery design and approval");
  const persistence = markdownSectionUnderHeading(semantic.skill, "Persistence and handoff");
  const controls = markdownSectionUnderHeading(semantic.skill, "Control flags");
  const adaptiveDepth = markdownSectionUnderHeading(semantic.skill, "Adaptive analysis depth");
  const frameworkContract = markdownSectionUnderHeading(semantic.framework, "Contract gaps and accepted decisions");
  const risk = markdownSectionUnderHeading(semantic.framework, "Risk surfaces");
  const evidenceCalibration = markdownSectionUnderHeading(semantic.framework, "Evidence calibration");
  const decisionRegister = markdownSectionUnderHeading(semantic.framework, "Decision Register");
  const agentEntry = markdownSectionUnderHeading(semantic.agent, "Entry gate");
  const agentProcess = markdownSectionUnderHeading(semantic.agent, "Advisory process");
  const normalizedFrontDoor = normalizeMarkdownWhitespace(frontDoor);
  const normalizedOptions = normalizeMarkdownWhitespace(options);
  const normalizedDelivery = normalizeMarkdownWhitespace(delivery);
  const normalizedPersistence = normalizeMarkdownWhitespace(persistence);
  const normalizedAgentGate = normalizeMarkdownWhitespace(
    semantic.agent.match(/<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/)?.[1] || "",
  );
  const normalizedSkillGate = normalizeMarkdownWhitespace(
    semantic.skill.match(/<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/)?.[1] || "",
  );
  const skillGateRemainder = normalizedSkillGate.replace(
    normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.noDevelop),
    "",
  );
  const agentAuthorityRemainder = normalized.agent.replace(
    normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary),
    "",
  ).replace(
    normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.specialistHandoff),
    "",
  );

  const directIndex = frontDoor.indexOf("**Direct request:**");
  const hydrationIndex = frontDoor.indexOf("**Hydrate the contract, then keep routing:**");
  const directRoute = directIndex >= 0 && hydrationIndex > directIndex
    ? frontDoor.slice(directIndex, hydrationIndex)
    : "";
  const directRemainder = normalizeMarkdownWhitespace(directRoute)
    .replace(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.direct), "")
    .replace(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration), "");
  if (directIndex < 0 || hydrationIndex < 0
    || !normalizeMarkdownWhitespace(directRoute).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.direct))
    || !normalizeMarkdownWhitespace(directRoute).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration))
    || brainstormHasDirectCeremony(directRemainder)
    || !semantic.skill.includes("After front-door routing, run `cf:scout`")
    || semantic.skill.indexOf("## Front-door routing — before scout or questions")
      > semantic.skill.indexOf("After front-door routing, run `cf:scout`")) {
    issues.add("front-door-routing");
  }
  const bugIndex = frontDoor.indexOf("**Bug or failure:**");
  if (!normalizedFrontDoor.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.acceptedSkill))
    || !normalizedFrontDoor.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.hydrationTransition))
    || !normalizeMarkdownWhitespace(frameworkContract).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.acceptedFramework))
    || !normalizeMarkdownWhitespace(frameworkContract).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.staleFramework))
    || !normalizeMarkdownWhitespace(frameworkContract).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.hydrationFramework))
    || !/\b(?:never|do not) infer approval\b/i.test(normalizedFrontDoor)
    || hydrationIndex < 0 || bugIndex < hydrationIndex) {
    issues.add("accepted-contract");
  }

  const debugIndex = frontDoor.indexOf("`cf:debug`", bugIndex);
  const remedyIndex = frontDoor.indexOf("cause-aligned remedies", debugIndex);
  const explorationIndex = frontDoor.indexOf("**Non-bug exploration only:**");
  const featureIndex = frontDoor.indexOf("**Feature or documentation delivery:**", explorationIndex);
  const bugRoute = bugIndex >= 0 && explorationIndex > bugIndex
    ? frontDoor.slice(bugIndex, explorationIndex)
    : "";
  const normalizedBugRoute = normalizeMarkdownWhitespace(bugRoute);
  const hotfixRemainder = normalized.skill.replace(
    normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.hotfixAuthority),
    "",
  );
  const contractFields = markdownBoldBulletFields(contract);
  if (bugIndex < 0 || debugIndex < bugIndex || remedyIndex < debugIndex
    || explorationIndex < remedyIndex
    || !normalizedBugRoute.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.bugContract))
    || !normalizedBugRoute.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.debugFirst))
    || !normalizedBugRoute.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.remedyCount))
    || !normalizedBugRoute.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.hotfixAuthority))
    || !normalizedBugRoute.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.diagnosisStop))
    || !normalizeMarkdownWhitespace(contract).includes("For feature/docs delivery and every bug/failure, resolve four user-owned fields:")
    || ["Outcome", "Constraints", "Non-goals", "Acceptance"].some((field) => !contractFields.has(field))
    || brainstormHasWorkflowDispatch(hotfixRemainder, "fix")) {
    issues.add("bug-routing");
  }
  const explorationRoute = explorationIndex >= 0 && featureIndex > explorationIndex
    ? frontDoor.slice(explorationIndex, featureIndex)
    : "";
  const explorationRemainder = normalizeMarkdownWhitespace(explorationRoute).replace(
    normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.explorationStop),
    "",
  );
  if (!normalizeMarkdownWhitespace(explorationRoute).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.nonBugExploration))
    || !normalizeMarkdownWhitespace(explorationRoute).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.explorationStop))
    || featureIndex < 0
    || brainstormHasAffirmativePhrase(explorationRemainder, /\b(?:request|seek|require)\b.{0,40}\bapproval\b/gi)
    || brainstormHasAffirmativePhrase(explorationRemainder, /\b(?:persist|write|save)\b.{0,40}\b(?:report|summary|design)\b/gi)
    || ["specs", "fix", "develop"].some((workflow) => brainstormHasWorkflowDispatch(explorationRemainder, workflow))) {
    issues.add("exploration-stop");
  }
  if (!normalizedPersistence.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs))
    || !normalizedSkillGate.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.noDevelop))
    || brainstormHasWorkflowDispatch(normalized.skill, "specs", true)
    || brainstormHasWorkflowDispatch(normalized.skill, "develop")
    || /\bimplementation\b.{0,60}\b(?:begin|start|proceed|allowed|permitted)\b/i.test(skillGateRemainder)) {
    issues.add("handoff-boundary");
  }
  if (!normalizedOptions.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.materialChoice))
    || !normalizedOptions.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.optionCount))
    || !normalizedOptions.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.singlePath))) {
    issues.add("option-cardinality");
  }
  const reviewIndex = normalizedDelivery.indexOf(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.reviewBeforePresent));
  const presentIndex = normalizedDelivery.indexOf(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.presentReviewed));
  const criticalIndex = normalizedDelivery.indexOf(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.criticalDecision));
  const approvalIndex = normalizedDelivery.indexOf(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.finalApproval));
  const approvalRemainder = normalized.skill.replace(
    normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.finalApproval),
    "",
  );
  if (!normalizedDelivery.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.reviewBeforePresent))
    || !normalizedDelivery.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.presentReviewed))
    || !normalizedDelivery.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.finalApproval))
    || !normalizedDelivery.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.criticalDecision))
    || !normalizedPersistence.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.approvedPersistence))
    || !normalizedPersistence.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.configuredPath))
    || !normalizedPersistence.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.redactPersistence))
    || !(reviewIndex >= 0 && reviewIndex < presentIndex && presentIndex < criticalIndex && criticalIndex < approvalIndex)
    || brainstormHasUnsafePersistence(normalized.skill)
    || brainstormHasApprovalBypass(normalized.skill)
    || brainstormHasAffirmativePhrase(approvalRemainder, /\b(?:request|seek|obtain|get)\b.{0,50}\bfinal approval\b/gi)
    || !risk.includes("Critical section decision")) {
    issues.add("approval-persistence");
  }
  if (!normalizeMarkdownWhitespace(frameworkContract).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.touchpoints))
    || !normalizeMarkdownWhitespace(risk).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.riskSurfaces))
    || !normalizeMarkdownWhitespace(decisionRegister).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.decisionTruth))
    || !normalizeMarkdownWhitespace(contract).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.visualEvidence))
    || !semantic.framework.includes("## Domain Matrix")
    || !semantic.framework.includes("### Browser Extension")
    || !semantic.framework.includes("### AI / LLM")) {
    issues.add("question-evidence");
  }
  if (!normalizeMarkdownWhitespace(agentEntry).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.specialistGate))
    || !normalizeMarkdownWhitespace(agentEntry).includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.specialistSingle))
    || !normalizedAgentGate.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary))
    || !normalizedAgentGate.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.specialistHandoff))
    || agentEntry === ""
    || /^tools:.*\b(?:Write|Edit|TaskCreate|TaskUpdate|SendMessage)\b/m.test(semantic.agent)
    || brainstormHasUnauthorizedSpecialistAuthority(agentAuthorityRemainder)) {
    issues.add("specialist-boundary");
  }

  const normalizedControls = normalizeMarkdownWhitespace(controls);
  if (!["controlSegment", "controlGrammar", "controlTerminator", "contentBoundary", "controlReject", "directBeforeControls"]
    .every((key) => normalizedControls.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES[key])))
    || /(?:unknown|duplicate).{0,80}(?:continue|ignore|treat as content)/i.test(normalizedControls)
    || /(?:after the first content token|after `--`).{0,80}(?:parse|apply).{0,30}(?:control|flag)/i.test(normalizedControls)
    || brainstormHasControlBeforeDirect(normalized.skill)) {
    issues.add("adaptive-flags");
  }

  const normalizedDepth = normalizeMarkdownWhitespace(adaptiveDepth);
  if (!["depthStandard", "depthDeep", "depthFallback", "depthSplit", "lensSkip"]
    .every((key) => normalizedDepth.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES[key])))
    || BRAINSTORM_LENS_TRIGGERS.some((trigger) => !normalizedDepth.includes(normalizeMarkdownWhitespace(trigger)))
    || brainstormHasDeepWithoutSignal(normalizedDepth)) {
    issues.add("adaptive-depth");
  }

  const normalizedCalibration = normalizeMarkdownWhitespace(evidenceCalibration);
  if (!["feasibilityEnums", "confidenceEnums", "dispositionEnums", "evidenceFallback", "numericEstimate"]
    .every((key) => normalizedCalibration.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES[key])))
    || !normalized.skill.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.controllerEvidence))
    || !normalized.skill.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.controllerNumeric))
    || brainstormHasUnsafeEvidencePromotion(`${normalized.skill} ${normalized.framework}`)
    || brainstormHasOptionalEvidence(`${normalized.skill} ${normalized.framework}`)) {
    issues.add("evidence-calibration");
  }

  if (!["visualOverlay", "adviceOverlay", "overlayRedaction", "overlayAuthority"]
    .every((key) => normalizedOptions.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES[key])))
    || /(?:overlay|visual|advice).{0,100}(?:automatically|without authority).{0,50}(?:write|persist|dispatch|approve)/i.test(normalizedOptions)
    || brainstormHasSensitiveAdviserTransfer(normalized.skill)) {
    issues.add("overlay-boundary");
  }

  if (!["decisionBrief", "decisionFreshness", "decisionAuthority"]
    .every((key) => normalizedPersistence.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES[key])))
    || BRAINSTORM_DECISION_HEADINGS.some((heading) => !normalizedPersistence.includes(normalizeMarkdownWhitespace(`\`${heading}\``)))
    || brainstormHasStaleDecisionPermission(normalizedPersistence)) {
    issues.add("decision-brief");
  }

  const normalizedAgentProcess = normalizeMarkdownWhitespace(agentProcess);
  if (!normalizedAgentProcess.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.adviserRedaction))
    || !normalizedAgentProcess.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.adviserEvidence))
    || !normalizedAgentProcess.includes(normalizeMarkdownWhitespace(BRAINSTORM_CONTRACT_CLAUSES.adviserNumeric))
    || !normalizedAgentProcess.includes("`skipped: <reason>`")
    || !/^tools: Glob, Grep, Read, WebFetch, WebSearch$/m.test(semantic.agent)) {
    issues.add("adviser-adaptive");
  }

  const lines = Object.values(input).reduce((sum, value) => {
    const parts = value.split("\n");
    return sum + (value.endsWith("\n") ? parts.length - 1 : parts.length);
  }, 0);
  if (lines > BRAINSTORM_BUNDLE_LIMIT) issues.add("context-budget");

  return [...issues].sort();
}

async function runBrainstormContractTests() {
  const fail = (message) => {
    throw new Error(`[FAIL] cf:brainstorm proportional routing contract: ${message}`);
  };
  const paths = {
    skill: { relativePath: "src/claude/skills/brainstorm/SKILL.md", baselineLines: BRAINSTORM_BASELINE_LINES.skill },
    framework: { relativePath: "src/claude/skills/brainstorm/references/question-framework.md", baselineLines: BRAINSTORM_BASELINE_LINES.framework },
    agent: { relativePath: "src/claude/agents/brainstormer.md", baselineLines: BRAINSTORM_BASELINE_LINES.agent },
  };
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(paths).map(async ([key, { relativePath }]) => [
      key,
      await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const intact = brainstormContractIssues(baseline);
  if (intact.length > 0) fail(`intact sources returned ${intact.join(", ")}`);

  const reflowed = {
    ...baseline,
    skill: replaceBrainstormClauseOnce(
      baseline.skill,
      BRAINSTORM_CONTRACT_CLAUSES.direct,
      BRAINSTORM_CONTRACT_CLAUSES.direct.replace(" before scout", "\n   before scout"),
    ),
  };
  const reflowIssues = brainstormContractIssues(reflowed);
  if (reflowIssues.length > 0) fail(`whitespace-only reflow returned ${reflowIssues.join(", ")}`);

  const safeStrengthenings = [
    [BRAINSTORM_CONTRACT_CLAUSES.explorationStop, `${BRAINSTORM_CONTRACT_CLAUSES.explorationStop} Never invoke Fix from exploration. Do not invoke Develop.`],
    [BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs, `${BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs} The user may invoke \`cf:specs\` in a new request.`],
    [BRAINSTORM_CONTRACT_CLAUSES.redactPersistence, `${BRAINSTORM_CONTRACT_CLAUSES.redactPersistence} After final approval, save the draft.`],
    [BRAINSTORM_CONTRACT_CLAUSES.noDevelop, `${BRAINSTORM_CONTRACT_CLAUSES.noDevelop} The controller is forbidden to invoke Specs.`],
    [BRAINSTORM_CONTRACT_CLAUSES.finalApproval, `${BRAINSTORM_CONTRACT_CLAUSES.finalApproval} Avoid duplicate final approval.`],
    [BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls, `${BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls} Never honor --visual prior to Direct classification.`],
    [BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls, `${BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls} Controls are not permitted to be applied before Direct routing.`],
    [BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction, `${BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction} Internal advisers must never share credentials.`],
    [BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction, `${BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction} Credentials must not be forwarded to advisers. Tokens are not permitted to be transmitted to the specialist.`],
    [BRAINSTORM_CONTRACT_CLAUSES.decisionFreshness, `${BRAINSTORM_CONTRACT_CLAUSES.decisionFreshness} A brief is never valid after a revision change.`],
  ];
  const safelyStrengthened = {
    ...baseline,
    skill: safeStrengthenings.reduce(
      (content, [from, to]) => replaceBrainstormClauseOnce(content, from, to),
      baseline.skill,
    ),
    agent: replaceBrainstormClauseOnce(
      baseline.agent,
      BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary,
      `${BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary} The specialist may never ask the user directly or contact the user. Do not write files or mutate shared task state. Do not delegate work or delegate tasks. The specialist is not permitted to launch Specs or run Develop.`,
    ),
  };
  const strengtheningIssues = brainstormContractIssues(safelyStrengthened);
  if (strengtheningIssues.length > 0) {
    fail(`safe prohibition strengthening returned ${strengtheningIssues.join(", ")}`);
  }

  const mutations = [
    { name: "controls-before-direct", group: "direct-precedence", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls, to: "Apply controls before routing Direct.", expected: ["adaptive-flags"] },
    { name: "deep-additive-before-direct", group: "direct-precedence", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls, to: `${BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls} When --deep is present, apply it before Direct.`, expected: ["adaptive-flags"] },
    { name: "visual-additive-before-direct", group: "direct-precedence", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls, to: `${BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls} When --visual is present, honor it prior to Direct classification.`, expected: ["adaptive-flags"] },
    { name: "direct-deferred-until-control", group: "direct-precedence", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls, to: `${BRAINSTORM_CONTRACT_CLAUSES.directBeforeControls} Defer Direct classification until after applying --visual.`, expected: ["adaptive-flags"] },
    { name: "literal-flag-reparsed", group: "leading-flags", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.controlTerminator, to: "`--` pauses controls, but later `--*` content is parsed again.", expected: ["adaptive-flags"] },
    { name: "content-token-reparsed", group: "leading-flags", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.contentBoundary, to: "After the first content token, parse later `--*` tokens as controls.", expected: ["adaptive-flags"] },
    { name: "flag-order-forced", group: "leading-flags", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.controlGrammar, to: "Accept `--deep`, then `--visual`, then `--advice` only in that order.", expected: ["adaptive-flags"] },
    { name: "flag-combination-forbidden", group: "leading-flags", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.controlGrammar, to: "Accept exactly one of `--deep`, `--visual`, or `--advice`.", expected: ["adaptive-flags"] },
    { name: "duplicate-flag-ignored", group: "leading-flags", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.controlReject, to: "Ignore duplicate controls and continue.", expected: ["adaptive-flags"] },
    { name: "unknown-flag-becomes-content", group: "leading-flags", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.controlReject, to: "Treat unknown `--*` controls as content and continue.", expected: ["adaptive-flags"] },
    { name: "flag-equals-syntax-accepted", group: "leading-flags", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.controlGrammar, to: "Accept `--deep=true`, `--visual=true`, and `--advice=true`.", expected: ["adaptive-flags"] },
    { name: "deep-risk-truncated", group: "ordered-depth", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.depthDeep, to: "**Deep:** use only for critical security risk.", expected: ["adaptive-depth"] },
    { name: "deep-without-signal", group: "ordered-depth", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.depthFallback, to: `${BRAINSTORM_CONTRACT_CLAUSES.depthFallback} Without a Deep signal, select Deep when useful.`, expected: ["adaptive-depth"] },
    { name: "deep-default-without-risk", group: "ordered-depth", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.depthFallback, to: `${BRAINSTORM_CONTRACT_CLAUSES.depthFallback} Deep is the default even when no material risk signal exists.`, expected: ["adaptive-depth"] },
    { name: "deep-lenses-forced", group: "lens-trigger-skip", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.lensSkip, to: "Apply every lens whether or not its trigger is present", expected: ["adaptive-depth"] },
    ...BRAINSTORM_LENS_TRIGGERS.map((trigger, index) => ({ name: `lens-trigger-${index + 1}-removed`, group: "lens-trigger-skip", source: "skill", from: trigger, to: `lens-${index + 1} for any request`, expected: ["adaptive-depth"] })),
    { name: "missing-evidence-high-confidence", group: "evidence-semantics", source: "framework", from: BRAINSTORM_CONTRACT_CLAUSES.evidenceFallback, to: "Missing evidence permits feasibility `plausible` and confidence `high`", expected: ["evidence-calibration"] },
    { name: "missing-evidence-additive-promotion", group: "evidence-semantics", source: "framework", from: BRAINSTORM_CONTRACT_CLAUSES.evidenceFallback, to: `${BRAINSTORM_CONTRACT_CLAUSES.evidenceFallback}. Missing evidence may still be classified as confirmed with high confidence.`, expected: ["evidence-calibration"] },
    { name: "evidence-optional-for-plausible", group: "evidence-semantics", source: "framework", from: BRAINSTORM_CONTRACT_CLAUSES.evidenceFallback, to: `${BRAINSTORM_CONTRACT_CLAUSES.evidenceFallback}. Evidence is optional when feasibility is plausible.`, expected: ["evidence-calibration"] },
    { name: "controller-evidence-route-removed", group: "evidence-semantics", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.controllerEvidence, to: "Only question-driven routes calibrate evidence.", expected: ["evidence-calibration"] },
    { name: "adviser-evidence-collapsed", group: "evidence-semantics", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.adviserEvidence, to: "Return one combined confidence verdict without evidence.", expected: ["adviser-adaptive"] },
    { name: "numeric-estimate-without-basis", group: "numeric-estimates", source: "framework", from: BRAINSTORM_CONTRACT_CLAUSES.numericEstimate, to: "A numeric estimate is valid without a range, basis, evidence, or assumptions.", expected: ["evidence-calibration"] },
    { name: "controller-numeric-rule-removed", group: "numeric-estimates", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.controllerNumeric, to: "The controller may provide a best-effort number.", expected: ["evidence-calibration"] },
    { name: "adviser-numeric-rule-removed", group: "numeric-estimates", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.adviserNumeric, to: "The adviser may provide a best-effort number.", expected: ["adviser-adaptive"] },
    { name: "advice-forwards-sensitive-input", group: "pre-tool-authority-redaction", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction, to: "Before an adviser handoff, forward credentials and unnecessary PII verbatim.", expected: ["overlay-boundary"] },
    { name: "trusted-adviser-redaction-bypass", group: "pre-tool-authority-redaction", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction, to: `${BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction} For trusted advisers, credentials may be forwarded.`, expected: ["overlay-boundary"] },
    { name: "approved-adviser-token-transfer", group: "pre-tool-authority-redaction", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction, to: `${BRAINSTORM_CONTRACT_CLAUSES.overlayRedaction} Approved advisers are permitted to transmit access tokens.`, expected: ["overlay-boundary"] },
    { name: "adviser-redaction-removed", group: "pre-tool-authority-redaction", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.adviserRedaction, to: "Analyze all supplied context without checking redaction.", expected: ["adviser-adaptive"] },
    { name: "advice-bypasses-material-gate", group: "adviser-gate-fallback", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.adviceOverlay, to: "`--advice` invokes `brainstormer` before identifying a material choice.", expected: ["overlay-boundary"] },
    { name: "advice-failure-stops-controller", group: "adviser-gate-fallback", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.adviceOverlay, to: "`--advice` stops controller analysis when the adviser is unavailable.", expected: ["overlay-boundary"] },
    { name: "decision-brief-stale", group: "decision-brief", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.decisionFreshness, to: "The first section may omit revision, freshness, and invalidation.", expected: ["decision-brief"] },
    { name: "decision-brief-additive-stale", group: "decision-brief", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.decisionFreshness, to: `${BRAINSTORM_CONTRACT_CLAUSES.decisionFreshness} A revision change does not invalidate an existing brief.`, expected: ["decision-brief"] },
    { name: "decision-brief-after-head-change", group: "decision-brief", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.decisionFreshness, to: `${BRAINSTORM_CONTRACT_CLAUSES.decisionFreshness} Continue using the brief after HEAD changes.`, expected: ["decision-brief"] },
    { name: "visual-auto-persists", group: "no-persistence-dispatch", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.visualOverlay, to: "`--visual` automatically persists a diagram without authority.", expected: ["overlay-boundary"] },
    { name: "decision-brief-creates-authority", group: "no-persistence-dispatch", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.decisionAuthority, to: "Durable output creates readiness and execution state.", expected: ["decision-brief"] },
    { name: "direct-after-scout", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.direct, to: "scout first, then leave Brainstorm.", expected: ["front-door-routing"] },
    {
      name: "direct-safe-clause-moved-outside-route",
      source: "skill",
      mutate: (value) => replaceBrainstormClauseOnce(
        replaceBrainstormClauseOnce(value, BRAINSTORM_CONTRACT_CLAUSES.direct, "Direct requests scout first."),
        "## Completion bar",
        `${BRAINSTORM_CONTRACT_CLAUSES.direct}\n\n## Completion bar`,
      ),
      expected: ["front-door-routing"],
    },
    { name: "direct-contradictory-ceremony", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration, to: `${BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration} Direct requests scout first.`, expected: ["front-door-routing"] },
    { name: "direct-discovery-synonym", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration, to: `${BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration} Direct requests run discovery first.`, expected: ["front-door-routing"] },
    { name: "direct-approval-synonym", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration, to: `${BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration} Direct requests go through approval first.`, expected: ["front-door-routing"] },
    { name: "read-only-architecture-exits", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.readOnlyExploration, to: "Every read-only request is direct and exits Brainstorm.", expected: ["front-door-routing"] },
    { name: "accepted-contract-not-revision-bound", source: "skill", from: "binds them to the same target and revision.", to: "may come from any earlier approved artifact.", expected: ["accepted-contract"] },
    { name: "accepted-contract-reasks-fields", source: "framework", from: BRAINSTORM_CONTRACT_CLAUSES.acceptedFramework, to: "Ask the user to restate every accepted field.", expected: ["accepted-contract"] },
    { name: "accepted-contract-infers-approval", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.neverApproval, to: "Infer approval from an old label.", expected: ["accepted-contract"] },
    { name: "accepted-contract-becomes-terminal", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.hydrationTransition, to: "Hydration completes routing; stop here.", expected: ["accepted-contract"] },
    { name: "framework-hydration-selects-route", source: "framework", from: BRAINSTORM_CONTRACT_CLAUSES.hydrationFramework, to: "Hydration selects the final route.", expected: ["accepted-contract"] },
    { name: "bug-contract-drops-fields", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.bugContract, to: "before diagnosis, capture the repaired behavior.", expected: ["bug-routing"] },
    { name: "bug-options-before-debug", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.debugFirst, to: "Compare remedies, then use `cf:debug`.", expected: ["bug-routing"] },
    { name: "bug-remedy-count-removed", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.remedyCount, to: "If remedies remain, compare any number here.", expected: ["bug-routing"] },
    { name: "hotfix-without-authority", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.hotfixAuthority, to: "Hand off to `cf:fix` whenever root cause is known", expected: ["bug-routing"] },
    { name: "hotfix-contradictory-exception", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.diagnosisStop, to: `${BRAINSTORM_CONTRACT_CLAUSES.diagnosisStop} Urgent incidents may invoke \`cf:fix\` without user authority.`, expected: ["bug-routing"] },
    { name: "fix-hyphenated-handoff", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.diagnosisStop, to: `${BRAINSTORM_CONTRACT_CLAUSES.diagnosisStop} Hand-off to Fix immediately.`, expected: ["bug-routing"] },
    { name: "fix-object-handoff", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.diagnosisStop, to: `${BRAINSTORM_CONTRACT_CLAUSES.diagnosisStop} Hand off this request to Fix.`, expected: ["bug-routing"] },
    { name: "diagnosis-only-fix", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.diagnosisStop, to: "diagnosis-only work continues to Fix.", expected: ["bug-routing"] },
    { name: "exploration-approval", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.explorationStop, to: "Request approval, persist a report, then stop.", expected: ["exploration-stop"] },
    { name: "exploration-later-specs", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.explorationStop, to: `${BRAINSTORM_CONTRACT_CLAUSES.explorationStop} Then invoke \`cf:specs\`.`, expected: ["exploration-stop", "handoff-boundary"] },
    { name: "implicit-specs", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs, to: "invoke `cf:specs` immediately.", expected: ["handoff-boundary"] },
    { name: "specs-additive-handoff", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs, to: `${BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs} Emergency exception: hand off to \`cf:specs\` automatically.`, expected: ["handoff-boundary"] },
    { name: "specs-forward-summary", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs, to: `${BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs} Forward the approved summary to Specs automatically.`, expected: ["handoff-boundary"] },
    { name: "specs-launch-workflow", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs, to: `${BRAINSTORM_CONTRACT_CLAUSES.explicitSpecs} Launch the Specs workflow.`, expected: ["handoff-boundary"] },
    { name: "develop-after-approval", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.noDevelop, to: "Brainstorm may invoke Develop after approval.", expected: ["handoff-boundary"] },
    { name: "develop-additive-handoff", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.noDevelop, to: `${BRAINSTORM_CONTRACT_CLAUSES.noDevelop} Hand off to Develop after approval.`, expected: ["handoff-boundary"] },
    { name: "develop-route-request", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.noDevelop, to: `${BRAINSTORM_CONTRACT_CLAUSES.noDevelop} Route this request to Develop.`, expected: ["handoff-boundary"] },
    { name: "develop-unrelated-negation", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.noDevelop, to: `${BRAINSTORM_CONTRACT_CLAUSES.noDevelop} Do not wait, hand off to Develop immediately.`, expected: ["handoff-boundary"] },
    { name: "implementation-additive-gate-exception", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.noDevelop, to: `${BRAINSTORM_CONTRACT_CLAUSES.noDevelop} Exception: implementation may begin after approval.`, expected: ["handoff-boundary"] },
    {
      name: "develop-gate-moved-outside-hard-gate",
      source: "skill",
      mutate: (value) => replaceBrainstormClauseOnce(
        replaceBrainstormClauseOnce(value, BRAINSTORM_CONTRACT_CLAUSES.noDevelop, "Implementation is allowed after design approval."),
        "## Completion bar",
        `${BRAINSTORM_CONTRACT_CLAUSES.noDevelop}\n\n## Completion bar`,
      ),
      expected: ["handoff-boundary"],
    },
    { name: "one-option-material-choice", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.optionCount, to: "For a material choice, compare at most three approaches", expected: ["option-cardinality"] },
    { name: "single-path-strawman", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.singlePath, to: "With one viable path, invent alternatives for comparison.", expected: ["option-cardinality"] },
    {
      name: "review-moved-outside-delivery",
      source: "skill",
      mutate: (value) => replaceBrainstormClauseOnce(
        replaceBrainstormClauseOnce(value, BRAINSTORM_CONTRACT_CLAUSES.reviewBeforePresent, "Perform a lightweight check before presentation"),
        "## Front-door routing — before scout or questions",
        `${BRAINSTORM_CONTRACT_CLAUSES.reviewBeforePresent}.\n\n## Front-door routing — before scout or questions`,
      ),
      expected: ["approval-persistence"],
    },
    {
      name: "final-approval-before-critical-decision",
      source: "skill",
      mutate: (value) => replaceBrainstormClauseOnce(
        replaceBrainstormClauseOnce(value, BRAINSTORM_CONTRACT_CLAUSES.criticalDecision, "__CRITICAL_DECISION__"),
        BRAINSTORM_CONTRACT_CLAUSES.finalApproval,
        `${BRAINSTORM_CONTRACT_CLAUSES.finalApproval} ${BRAINSTORM_CONTRACT_CLAUSES.criticalDecision}`,
      ).replace("__CRITICAL_DECISION__", "Critical sections are handled later."),
      expected: ["approval-persistence"],
    },
    { name: "critical-gate-weakened", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.criticalDecision, to: "Before final approval, mention auth/secrets/privacy, destructive or irreversible behavior or data-loss risk, money/privilege/safety, or production-state mutation.", expected: ["approval-persistence"] },
    { name: "critical-gate-commented-out", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.criticalDecision, to: `<!-- ${BRAINSTORM_CONTRACT_CLAUSES.criticalDecision} -->`, expected: ["approval-persistence"] },
    { name: "critical-gate-additive-bypass", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.criticalDecision, to: `${BRAINSTORM_CONTRACT_CLAUSES.criticalDecision} Urgent production changes may skip the section decision.`, expected: ["approval-persistence"] },
    { name: "approval-unrelated-negation-bypass", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.criticalDecision, to: `${BRAINSTORM_CONTRACT_CLAUSES.criticalDecision} Do not hesitate, skip final approval.`, expected: ["approval-persistence"] },
    { name: "approval-pseudo-negation-bypass", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.criticalDecision, to: `${BRAINSTORM_CONTRACT_CLAUSES.criticalDecision} Do not hesitate to skip final approval.`, expected: ["approval-persistence"] },
    { name: "approval-afraid-pseudo-negation-bypass", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.criticalDecision, to: `${BRAINSTORM_CONTRACT_CLAUSES.criticalDecision} Do not be afraid to skip final approval.`, expected: ["approval-persistence"] },
    { name: "approval-wait-pseudo-negation-bypass", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.criticalDecision, to: `${BRAINSTORM_CONTRACT_CLAUSES.criticalDecision} Do not wait to skip final approval.`, expected: ["approval-persistence"] },
    { name: "alternate-early-final-approval", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.presentReviewed, to: `${BRAINSTORM_CONTRACT_CLAUSES.presentReviewed} For urgent work, request final approval now; handle critical section decisions afterward.`, expected: ["approval-persistence"] },
    { name: "persist-before-approval", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.approvedPersistence, to: "Persist the draft before approval, without user authority", expected: ["approval-persistence"] },
    { name: "secret-redaction-removed", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.redactPersistence, to: "Before writing, copy every value verbatim, including credentials;", expected: ["approval-persistence"] },
    { name: "persistence-additive-raw-draft-exception", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.redactPersistence, to: `${BRAINSTORM_CONTRACT_CLAUSES.redactPersistence} For urgent work, persist the draft with raw credentials before approval.`, expected: ["approval-persistence"] },
    { name: "persistence-unrelated-negation", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.redactPersistence, to: `${BRAINSTORM_CONTRACT_CLAUSES.redactPersistence} Do not delay, persist the draft with raw credentials before approval.`, expected: ["approval-persistence"] },
    { name: "persistence-pseudo-negation", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.redactPersistence, to: `${BRAINSTORM_CONTRACT_CLAUSES.redactPersistence} Do not hesitate to persist the draft with raw credentials before approval.`, expected: ["approval-persistence"] },
    { name: "persistence-afraid-pseudo-negation", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.redactPersistence, to: `${BRAINSTORM_CONTRACT_CLAUSES.redactPersistence} Do not be afraid to persist the draft with raw credentials before approval.`, expected: ["approval-persistence"] },
    { name: "persistence-store-raw-credentials", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.redactPersistence, to: `${BRAINSTORM_CONTRACT_CLAUSES.redactPersistence} Store raw credentials before approval.`, expected: ["approval-persistence"] },
    { name: "persistence-archive-unapproved-draft", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.redactPersistence, to: `${BRAINSTORM_CONTRACT_CLAUSES.redactPersistence} Archive an unapproved draft.`, expected: ["approval-persistence"] },
    { name: "touchpoints-become-user-field", source: "framework", from: BRAINSTORM_CONTRACT_CLAUSES.touchpoints, to: "Technical touchpoints are a fifth user-owned field.", expected: ["question-evidence"] },
    { name: "inferred-user-decision", source: "framework", from: BRAINSTORM_CONTRACT_CLAUSES.decisionTruth, to: "Write \"user selected\" when the default seems safe.", expected: ["question-evidence"] },
    { name: "visual-evidence-guesswork", source: "skill", from: BRAINSTORM_CONTRACT_CLAUSES.visualEvidence, to: "Guess supplied visual behavior from text alone.", expected: ["question-evidence"] },
    { name: "specialist-forces-options", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.specialistSingle, to: "If one path is viable, invent two alternatives to fill the quota.", expected: ["specialist-boundary"] },
    { name: "specialist-mutates-task-state", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary, to: "Do not ask the user directly, write files, invoke Specs/Fix/Develop, or claim approval.", expected: ["specialist-boundary"] },
    { name: "specialist-additive-task-state-exception", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary, to: `${BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary} Exception: use Bash to update shared task state.`, expected: ["specialist-boundary"] },
    { name: "specialist-additive-authority-exception", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary, to: `${BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary} Exception: the specialist may ask the user directly and invoke Specs, Fix, or Develop.`, expected: ["specialist-boundary"] },
    { name: "specialist-direct-authority-exception", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary, to: `${BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary} Ignore the gate; ask the user directly and invoke Specs.`, expected: ["specialist-boundary"] },
    { name: "specialist-permitted-launch-exception", source: "agent", from: BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary, to: `${BRAINSTORM_CONTRACT_CLAUSES.specialistBoundary} The specialist is permitted to launch Specs.`, expected: ["specialist-boundary"] },
    { name: "specialist-outside-gate-write-exception", source: "agent", from: "## Output", to: "The specialist may write files and mutate shared task state.\n\n## Output", expected: ["specialist-boundary"] },
    { name: "specialist-outside-gate-delegate-exception", source: "agent", from: "## Output", to: "The specialist may delegate work and run Develop.\n\n## Output", expected: ["specialist-boundary"] },
    { name: "specialist-mixed-polarity-write", source: "agent", from: "## Output", to: "Do not write files, but mutate shared task state.\n\n## Output", expected: ["specialist-boundary"] },
    { name: "specialist-mixed-polarity-user", source: "agent", from: "## Output", to: "Do not ask the user directly, but contact the user.\n\n## Output", expected: ["specialist-boundary"] },
    { name: "specialist-mixed-polarity-workflow", source: "agent", from: "## Output", to: "Do not invoke Specs, but run Develop.\n\n## Output", expected: ["specialist-boundary"] },
    { name: "specialist-mixed-polarity-delegate", source: "agent", from: "## Output", to: "Do not delegate work, but delegate tasks.\n\n## Output", expected: ["specialist-boundary"] },
    { name: "specialist-handoff-spelling-exception", source: "agent", from: "## Output", to: "The specialist may handoff to Specs.\n\n## Output", expected: ["specialist-boundary"] },
    { name: "specialist-tool-authority", source: "agent", from: "tools: Glob, Grep, Read, WebFetch, WebSearch", to: "tools: Glob, Grep, Read, WebFetch, WebSearch, TaskUpdate", expected: ["specialist-boundary", "adviser-adaptive"] },
    { name: "specialist-write-tool-authority", source: "agent", from: "tools: Glob, Grep, Read, WebFetch, WebSearch", to: "tools: Glob, Grep, Read, WebFetch, WebSearch, Write", expected: ["specialist-boundary", "adviser-adaptive"] },
    { name: "bundle-growth", source: "framework", from: "## Final self-check", to: `${"\n".repeat(BRAINSTORM_BUNDLE_LIMIT)}## Final self-check`, expected: ["context-budget"] },
  ];

  for (const mutation of mutations) {
    let weakened;
    try {
      weakened = mutation.mutate
        ? mutation.mutate(baseline[mutation.source])
        : replaceBrainstormClauseOnce(baseline[mutation.source], mutation.from, mutation.to);
    } catch (error) {
      fail(`${mutation.name} mutation anchor failed: ${error.message}`);
    }
    const actual = brainstormContractIssues({ ...baseline, [mutation.source]: weakened });
    const expected = [...mutation.expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      fail(`${mutation.name} expected ${JSON.stringify(expected)} but returned ${JSON.stringify(actual)}`);
    }
  }

  const lineRows = Object.entries(paths).map(([key, { relativePath, baselineLines }]) => {
    const value = baseline[key];
    const parts = value.split("\n");
    const count = value.endsWith("\n") ? parts.length - 1 : parts.length;
    return [relativePath, count, count - baselineLines];
  });
  const total = lineRows.reduce((sum, [, count]) => sum + count, 0);
  if (total > BRAINSTORM_BUNDLE_LIMIT) fail(`bundle line budget is ${total}/${BRAINSTORM_BUNDLE_LIMIT}`);
  const deltas = lineRows
    .map(([relativePath, count, delta]) => `${relativePath}=${count} (${delta >= 0 ? "+" : ""}${delta})`)
    .join(", ");
  const adaptiveMutations = mutations.filter(({ group }) => group);
  const actualAdaptiveGroups = [...new Set(adaptiveMutations.map(({ group }) => group))].sort();
  const expectedAdaptiveGroups = [...BRAINSTORM_ADAPTIVE_GROUPS].sort();
  if (JSON.stringify(actualAdaptiveGroups) !== JSON.stringify(expectedAdaptiveGroups)) {
    fail(`adaptive mutation groups expected ${JSON.stringify(expectedAdaptiveGroups)} but returned ${JSON.stringify(actualAdaptiveGroups)}`);
  }
  for (const group of BRAINSTORM_ADAPTIVE_GROUPS) {
    if (!adaptiveMutations.some((mutation) => mutation.group === group)) fail(`adaptive mutation group ${group} is empty`);
  }
  const proportionalMutationCount = mutations.length - adaptiveMutations.length;
  console.log(`✔ cf:brainstorm proportional routing contract is complete and bounded; ${deltas}; total ${total}/${BRAINSTORM_BUNDLE_LIMIT}`);
  console.log(`✔ cf:brainstorm proportional routing checker rejects semantic weakenings; count=${proportionalMutationCount}`);
  const adaptiveMutationCount = adaptiveMutations.length;
  console.log(`✔ cf:brainstorm adaptive-depth contract is complete and bounded; groups=${actualAdaptiveGroups.length}`);
  console.log(`✔ cf:brainstorm adaptive-depth checker rejects semantic weakenings; count=${adaptiveMutationCount}`);
  return mutations.length + 4;
}

function outsideLegacySections(content) {
  const kept = [];
  let legacyDepth = null;
  for (const line of String(content || "").split("\n")) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const depth = heading[1].length;
      const isLegacy = /\blegacy\b/i.test(heading[2]);
      if (legacyDepth !== null && depth <= legacyDepth) legacyDepth = null;
      if (isLegacy) legacyDepth = depth;
    }
    if (legacyDepth === null) kept.push(line);
  }
  return kept.join("\n");
}

const TEST_PLAN_NATIVE_PATHS = {
  skill: "src/claude/skills/test/SKILL.md",
  strategy: "src/claude/skills/test/references/execution-strategy.md",
  triage: "src/claude/skills/test/references/failure-triage.md",
  memory: "src/claude/skills/test/references/test-memory.md",
};

function testPlanNativeContractIssues(input) {
  const expectedKeys = Object.keys(TEST_PLAN_NATIVE_PATHS).sort();
  const actualKeys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
    || actualKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("test plan-native checker expects exactly four UTF-8 source strings");
  }

  const issues = new Set();
  const normalized = Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key, normalizeMarkdownWhitespace(value),
  ]));
  const requireClauses = (issue, clausesBySource) => {
    const missing = Object.entries(clausesBySource).some(([source, clauses]) =>
      clauses.some((clause) => !normalized[source].includes(normalizeMarkdownWhitespace(clause))));
    if (missing) issues.add(issue);
  };

  requireClauses("routing-truth-table", {
    skill: [
      "Use `lstat` so broken links count as markers.",
      "Any flat marker that is orphaned, malformed, duplicated, symlinked, nonregular, or mixed with a legacy marker",
      "No flat or legacy marker | Ordinary non-Spec testing",
    ],
    strategy: [
      "A flat task without a plan, a plan without tasks, wrong/missing process marker, malformed or duplicate task fields",
      "Orphan nested tasks/receipts, absent or schema-invalid root, conflicting identities",
      "Do not infer that an invalid marker is absent.",
    ],
  });

  const exactTopLevelKeys = [
    "schema_version", "target", "verdict", "command", "exit", "counts",
    "provenance", "proof_level", "expected", "observed", "reachability",
    "artifacts", "branches", "raw_output", "redactions", "payload_sha256",
  ];
  const schemaBlock = markdownSectionUnderHeading(input.strategy, "4. `test-proof-v1` schema");
  for (const key of exactTopLevelKeys) {
    if (!new RegExp(`(?:^|[\\s,])${key}(?:[\\s,]|$)`).test(schemaBlock)) {
      issues.add("proof-schema");
    }
  }
  requireClauses("proof-schema", { strategy: [
    "Return canonical UTF-8 JSON with exactly these top-level keys and no others:",
    "`schema_version`: exactly `test-proof-v1`.",
    "`target`: exact keys `{feature, task_path}`.",
    "`task_path` is a contained regular flat task path.",
    "`verdict`: exactly `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`.",
    "`exit`: integer; nullable only for pre-execution `BLOCKED`.",
    "`counts`: exact keys `{executed, passed, failed, skipped}` with nonnegative integers",
    "`passed + failed + skipped === executed`.",
    "`provenance`: exact keys `{base, head}`.",
    "Values are lowercase canonical Git SHAs matching current runtime anchors",
    "`proof_level`: exactly `source | installed | live`; never promote one level into another.",
    "`expected`, `observed`, `raw_output`: nonempty redacted strings after any attempted execution.",
    "`reachability`: exact keys `{status, evidence}`",
    "status is `PASS | FAIL | BLOCKED`",
    "evidence is an array of unique nonempty strings.",
    "`artifacts`: sorted array of exact `{path, sha256}` rows.",
    "Every path is contained and every digest is lowercase SHA-256.",
    "`redactions`: unique sorted labels drawn only from `authorization`, `cookie`, `set-cookie`, `credential`, `session-token`, `pii`; never include secret values.",
    "`payload_sha256`: lowercase SHA-256 of canonical stable JSON after removing only `payload_sha256`.",
    "`command`: exact task command string; nullable only for pre-execution `BLOCKED`.",
    "Each row has exact keys:",
    "id, required, verdict, command, exit, counts, proof_level",
    "`required` is exactly `true`; branch verdict and proof level use the same closed enums.",
    "`exit` is an integer; branch counts use the same closed shape.",
  ] });

  requireClauses("branch-and-aggregate-integrity", { strategy: [
    "IDs equal the Verification Plan's exact unique Named probes, one row each.",
    "Reject unknown nested keys, duplicate/missing/extra branch IDs, contradictory aggregate counts, command drift, proof-level promotion, and unsorted rows.",
    "Attribute each required execution to exactly one branch with no overlap or omission.",
    "Payload `executed`, `passed`, `failed`, and `skipped` each equal the element-wise sum of that field across every branch",
    "Aggregate required branches in strict order:",
    "Only every required branch at literal `PASS` can reach payload `PASS`.",
    "exit 0, executed > 0, failed 0, skipped 0, matching current provenance",
  ], skill: [
    "`FAIL` > `BLOCKED` > `PASS_WITH_WARNINGS` > `PASS`.",
  ] });

  requireClauses("controller-only-state-proof", { skill: [
    "Return exactly one canonical `test-proof-v1` object. Do not edit `plan.md`, `Status:`, the task's `## Receipt`, or any sibling task.",
    "The Develop controller validates the payload, recomputes its digest, checks current provenance, and alone writes process-first Status and inline Receipt.",
  ], strategy: [
    "Process-first Status and inline `## Receipt` remain controller-only.",
  ] });

  requireClauses("side-effect-boundary", { skill: [
    "Hash absent/present bytes before and after; never create, merge, or update it during proof.",
    "Put only Test-owned temporary files outside the project and clean them.",
    "Capture tracked, untracked, and ignored project-command drift separately from runtime Head.",
  ], strategy: [
    "Test-owned memory, reports, caches, lazy installs, and auth state must remain byte-for-byte absent/unchanged.",
  ], memory: [
    "If absent, continue without creating it.",
    "Never create, initialize, merge, normalize, rewrite, or delete Test memory.",
    "Known flaky tests and known issues remain labels only; they cannot downgrade a current required failure, justify a skip, or produce `PASS`.",
  ] });

  requireClauses("safe-ui-auth-and-redaction", { skill: [
    "use only an explicitly selected user-controlled profile bound to a confirmed HTTPS or localhost origin, identity, permissions, and action scope.",
    "Block cross-origin redirects and destructive production actions without fresh consent.",
    "Never ask for, export, paste, or persist cookies or tokens.",
  ], strategy: [
    "Never ask the user to paste credentials, cookies, bearer tokens, session tokens, or local-storage auth; never export or persist them.",
    "Redact Authorization, Cookie, Set-Cookie, session tokens, credentials, and scoped PII",
  ] });

  requireClauses("canonical-verdicts", { triage: [
    "Use only `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`.",
    "Do not emit `PARTIAL`, `COLLAPSE`, `NO_TESTS`, or an unknown result.",
    "Failure count never changes the lattice",
  ] });

  requireClauses("report-proof-separation", { skill: [
    "return a concise human report separately from the machine handoff.",
    "Do not place the full JSON payload, secrets, verbose raw logs, or screenshots in the concise report.",
  ], strategy: [
    "Do not write a report file during proof.",
  ] });

  const primaryCorpus = Object.values(input).map(outsideLegacySections).join("\n");
  if (/npm\s+install|inject-auth\.js|--cookies|Bearer eyJ|<lessons_learned>/i.test(primaryCorpus)) {
    issues.add("side-effect-boundary");
  }
  if (/(?:unknown|extra) (?:keys|fields).{0,40}(?:may|can|are) (?:be )?(?:accepted|allowed|ignored)/i.test(primaryCorpus)) {
    issues.add("proof-schema");
  }
  if (/payload counts.{0,100}(?:may|can).{0,60}(?:differ|overlap|omit)/i.test(primaryCorpus)) {
    issues.add("branch-and-aggregate-integrity");
  }
  if (/mixed (?:packet|state).{0,80}(?:may|can).{0,60}(?:select|choose|prefer|proceed)/i.test(primaryCorpus)) {
    issues.add("routing-truth-table");
  }
  if (/Test may (?:write|edit).{0,60}(?:Status|Receipt)/i.test(primaryCorpus)) {
    issues.add("controller-only-state-proof");
  }
  if (/Test memory (?:may|can) be (?:created|updated|merged)/i.test(primaryCorpus)) {
    issues.add("side-effect-boundary");
  }
  if (/cross-origin.{0,80}(?:may|can|is allowed to).{0,60}(?:reuse|proceed|continue)/i.test(primaryCorpus)
    || /(?:cookies|tokens|credentials).{0,60}(?:may|can) be (?:pasted|exported|persisted)/i.test(primaryCorpus)) {
    issues.add("safe-ui-auth-and-redaction");
  }
  if (/concise report.{0,80}(?:may|can).{0,50}(?:full JSON|raw logs|screenshots)/i.test(primaryCorpus)) {
    issues.add("report-proof-separation");
  }
  if (/\[(?:LIVE_)?VERIFIED\]/i.test(primaryCorpus)
    || /live adherence is (?:verified|proven)/i.test(primaryCorpus)) {
    issues.add("proof-level-promotion");
  }
  if (!/Live adherence is\s+`\[UNVERIFIED\]` without a host invocation\./.test(primaryCorpus)) {
    issues.add("proof-level-promotion");
  }

  return [...issues].sort();
}

async function runTestPlanNativeContractTests() {
  const fail = (message) => {
    throw new Error(`[FAIL] Test plan-native contract: ${message}`);
  };
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(TEST_PLAN_NATIVE_PATHS).map(async ([key, relativePath]) => [
      key, await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const baselineIssues = testPlanNativeContractIssues(baseline);
  if (baselineIssues.length > 0) fail(`intact sources returned ${baselineIssues.join(", ")}`);

  const mutations = [
    ["mixed-state-selects-flat", "skill", "routing-truth-table", "or mixed with a legacy marker", "and preferred over a legacy marker"],
    ["invalid-marker-is-absent", "strategy", "routing-truth-table", "Do not infer that an invalid marker is absent.", "Treat an invalid marker as absent."],
    ["payload-allows-extra-keys", "strategy", "proof-schema", "with exactly these top-level keys and no others:", "with these suggested top-level keys:"],
    ["digest-not-recomputed", "strategy", "proof-schema", "only `payload_sha256`.", "the supplied `payload_sha256` too."],
    ["count-shape-weakened", "strategy", "proof-schema", "`passed + failed + skipped === executed`.", "`passed + failed + skipped <= executed`."],
    ["task-path-escape", "strategy", "proof-schema", "`task_path` is a contained regular flat task path.", "`task_path` may escape or name a symlink."],
    ["verdict-enum-expanded", "strategy", "proof-schema", "`verdict`: exactly `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`.", "`verdict` may be any string."],
    ["exit-type-expanded", "strategy", "proof-schema", "`exit`: integer; nullable only for pre-execution `BLOCKED`.", "`exit` may be any value."],
    ["provenance-sha-weakened", "strategy", "proof-schema", "Values are lowercase canonical Git\n  SHAs matching current runtime anchors", "Values are arbitrary revision labels"],
    ["proof-level-expanded", "strategy", "proof-schema", "`proof_level`: exactly `source | installed | live`; never promote one level\n  into another.", "`proof_level` may be any string."],
    ["empty-output-accepted", "strategy", "proof-schema", "`expected`, `observed`, `raw_output`: nonempty redacted strings after any\n  attempted execution.", "Output strings may be empty after execution."],
    ["reachability-duplicates", "strategy", "proof-schema", "evidence is an array of unique nonempty strings.", "evidence may contain duplicate or empty strings."],
    ["reachability-status-expanded", "strategy", "proof-schema", "status is\n  `PASS | FAIL | BLOCKED`", "status may be any string"],
    ["artifact-order-weakened", "strategy", "proof-schema", "`artifacts`: sorted array of exact `{path, sha256}` rows.", "`artifacts` may be unsorted rows."],
    ["artifact-containment-weakened", "strategy", "proof-schema", "Every path is\n  contained and every digest is lowercase SHA-256.", "Paths may escape and digests may be short."],
    ["redaction-enum-expanded", "strategy", "proof-schema", "`redactions`: unique sorted labels drawn only from `authorization`, `cookie`,\n  `set-cookie`, `credential`, `session-token`, `pii`; never include secret values.", "`redactions` may contain arbitrary labels and values."],
    ["nullable-after-execution", "strategy", "proof-schema", "nullable only for pre-execution\n  `BLOCKED`.", "nullable for any verdict."],
    ["branch-required-optional", "strategy", "proof-schema", "`required` is exactly `true`", "`required` may be false"],
    ["branch-enums-expanded", "strategy", "proof-schema", "branch verdict and proof level use the same\n  closed enums.", "branch verdict and proof level may be arbitrary strings."],
    ["branch-count-shape-expanded", "strategy", "proof-schema", "branch counts\n  use the same closed shape.", "branch counts may have extra keys."],
    ["duplicate-branch-accepted", "strategy", "branch-and-aggregate-integrity", "duplicate/missing/extra branch IDs", "duplicate branch IDs are merged"],
    ["branch-overlap-accepted", "strategy", "branch-and-aggregate-integrity", "Attribute each required execution to exactly\none branch with no overlap or omission.", "Executions may appear in several branches."],
    ["aggregate-counts-not-summed", "strategy", "branch-and-aggregate-integrity", "each equal the element-wise sum of that field across every branch", "may differ from branch totals"],
    ["zero-tests-pass", "strategy", "branch-and-aggregate-integrity", "executed > 0", "executed >= 0"],
    ["tester-writes-receipt", "skill", "controller-only-state-proof", "alone writes process-first Status and inline Receipt.", "may delegate process-first Status and inline Receipt writes to Test."],
    ["memory-created", "memory", "side-effect-boundary", "If absent, continue without creating it.", "If absent, create a default memory file."],
    ["lazy-install-restored", "strategy", "side-effect-boundary", "Do not auto-install\nmissing runners, packages, browsers, or linters.", "Run npm install for missing browser tooling."],
    ["profile-cross-origin", "skill", "safe-ui-auth-and-redaction", "Block cross-origin redirects and destructive production actions without fresh\n  consent.", "Allow cross-origin redirects and destructive production actions."],
    ["partial-verdict", "triage", "canonical-verdicts", "Do not emit `PARTIAL`, `COLLAPSE`, `NO_TESTS`, or an unknown result.", "Emit `PARTIAL` for coverage gaps."],
    ["report-embeds-proof", "skill", "report-proof-separation", "Do not place the full JSON payload, secrets, verbose raw logs, or screenshots in", "Place the full JSON payload and verbose raw logs in"],
    ["live-proof-promoted", "skill", "proof-level-promotion", "`[UNVERIFIED]` without a host invocation.", "[VERIFIED] by static inspection."],
  ];

  for (const [name, source, issue, from, to] of mutations) {
    let weakened;
    try {
      weakened = replaceDevelopClauseOnce(baseline[source], from, to);
    } catch (error) {
      fail(`${name} mutation anchor failed: ${error.message}`);
    }
    const actual = testPlanNativeContractIssues({ ...baseline, [source]: weakened });
    if (!actual.includes(issue)) {
      fail(`${name} expected ${issue} but returned ${JSON.stringify(actual)}`);
    }
  }

  const additiveMutations = [
    ["additive-extra-keys", "strategy", "proof-schema", "Unknown keys may be accepted for forward compatibility."],
    ["additive-count-divergence", "strategy", "branch-and-aggregate-integrity", "Payload counts may differ from branch totals."],
    ["additive-mixed-route", "skill", "routing-truth-table", "Mixed packet state may choose process-first."],
    ["additive-test-writer", "skill", "controller-only-state-proof", "Test may write Status or Receipt after PASS."],
    ["additive-memory-writer", "memory", "side-effect-boundary", "Test memory may be updated after proof."],
    ["additive-cross-origin", "skill", "safe-ui-auth-and-redaction", "A cross-origin redirect may proceed with profile reuse."],
    ["additive-token-paste", "strategy", "safe-ui-auth-and-redaction", "Credentials may be pasted when browser login is difficult."],
    ["additive-report-raw", "skill", "report-proof-separation", "The concise report may include full JSON and raw logs."],
  ];
  for (const [name, source, issue, addition] of additiveMutations) {
    const legacyMarker = "\n## Legacy workflow compatibility";
    const value = baseline[source].includes(legacyMarker)
      ? baseline[source].replace(legacyMarker, `\n${addition}${legacyMarker}`)
      : `${baseline[source]}\n${addition}\n`;
    const actual = testPlanNativeContractIssues({
      ...baseline,
      [source]: value,
    });
    if (!actual.includes(issue)) {
      fail(`${name} expected ${issue} but returned ${JSON.stringify(actual)}`);
    }
  }

  console.log("✔ cf:test plan-native proof contract is complete and bounded");
  console.log("✔ cf:test plan-native checker rejects semantic weakenings");
  return mutations.length + additiveMutations.length + 1;
}

const DEVELOP_PLAN_NATIVE_PATHS = {
  skill: "src/claude/skills/develop/SKILL.md",
  quality: "src/claude/skills/develop/references/quality-gate.md",
  parallel: "src/claude/skills/develop/references/parallel-waves.md",
  dispatch: "src/claude/skills/develop/references/subagent-patterns.md",
  sync: "src/claude/skills/sync/SKILL.md",
  syncProtocols: "src/claude/skills/sync/references/sync-protocols.md",
};

function developPlanNativeContractIssues(input) {
  const sameOrderedStrings = (left, right) => left.length === right.length
    && left.every((value, index) => value === right[index]);
  const expectedKeys = Object.keys(DEVELOP_PLAN_NATIVE_PATHS).sort();
  const actualKeys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (!sameOrderedStrings(actualKeys, expectedKeys)
    || actualKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("develop plan-native checker expects exactly six UTF-8 source strings");
  }

  const issues = new Set();
  const { skill, quality, parallel, dispatch, sync, syncProtocols } = input;
  const normalized = Object.fromEntries(
    Object.entries({ skill, quality, parallel, dispatch })
      .map(([key, value]) => [key, normalizeMarkdownWhitespace(value)]),
  );
  const hasAllClauses = (source, clauses) => clauses.every((clause) =>
    normalized[source].includes(normalizeMarkdownWhitespace(clause)));
  const requireClauses = (issue, clausesBySource) => {
    if (Object.entries(clausesBySource).some(([source, clauses]) =>
      !hasAllClauses(source, clauses))) {
      issues.add(issue);
    }
  };

  requireClauses("accepted-fast-path", { skill: [
    "When line two is `Specs-Contract: process-first-ready-v1`, reuse the accepted GATE-SCOPE/GATE-REVIEW.",
    "Perform only a narrow freshness scout for target revision, scope drift, ownership conflict, and dependency/state changes.",
    "Reopen GATE-SCOPE only for evidenced scope drift; do not research, replan, or add a routine user gate before a real blocker or GATE-DONE.",
    "live-model adherence is `[UNVERIFIED]` without a host invocation.",
    "Load the plan index into working context once.",
  ] });

  requireClauses("artifact-rebind", { quality: [
    "A Receipt that declares artifacts with `sha256` may instead be rebound to the current Head once every declared hash is recomputed and matches,",
    "only when no file the proof reads changed between its recorded Head and the current one and every claim in the Receipt is derived from those artifacts;",
    "Otherwise, and for a Receipt with no artifact, re-run; only the controller rebinds.",
  ] });

  requireClauses("provenance-command", { skill: [
    "`Base:` and `Head:` copied from the `Base` and `Head` fields of `node .claude/scripts/provenance.cjs --project-root . --specs-root specs --spec-file <task file> --feature-name <feature> --session <any label> --json`",
    "(never typed or computed by hand),",
  ], quality: [
    "take Base and Head from the `Base` and `Head` fields printed by",
    "`node .claude/scripts/provenance.cjs --project-root . --specs-root specs --spec-file <task file> --feature-name <feature> --session <any label> --json`,",
    "run after the last change outside the specs root, and never type, abbreviate, or compute them by hand;",
  ] });

  requireClauses("verify-first-and-round", { skill: [
    "Unless under `--flash` or the command costs money or writes artifacts, run the task's exact Verification Plan command once before changing anything and expect it to fail;",
    "this pre-change run is not a repair round.",
    "Passing before any change, outside a resumed task, means the plan cannot judge the work and is a blocker;",
    "which is a blocker to raise, not a defect to work around while implementing.",
    "One repair round is one",
    "observed failure plus its repair and rerun, from proof or from review alike.",
    "**The Receipt is written last, after proof and review have both passed**",
    "Read the test or probe that will judge this task before implementing against it.",
  ] });

  requireClauses("current-byte-selection", { skill: [
    "More than one `in_progress` | Fail-stop; name every active task.",
    "Exactly one `in_progress` | Resume exactly that task.",
    "`paused` stops chaining; report and stop, never skip past it.",
    "`blocked` is not dependency-valid.",
    "Select the first dependency-valid `pending` row in `plan.md` order.",
    "Start only the exact pending target when dependencies are valid.",
    "Specific-task mode never touches a sibling and returns after its successful sync without chaining or GATE-DONE.",
  ] });
  if (/\bspecific-task mode\b.{0,160}\b(?:may|can|will)\b.{0,120}\b(?:touch|edit|mutate)\b.{0,40}\bsibling\b/i.test(normalized.skill)
    || /\bspecific-task mode\b.{0,160}\b(?:may|can|will)\b.{0,120}\b(?:chain|open|enter)\b.{0,40}\b(?:task|GATE-DONE)\b/i.test(normalized.skill)) {
    issues.add("current-byte-selection");
  }

  requireClauses("interrupted-recovery", { skill: [
    "Concurrent Develop invocations are unsupported; detected state, task, or owned-path drift stops before any Status or Receipt write.",
    "For an interrupted `in_progress` task, preserve and inspect current owned changes; discard ephemeral, remembered, or prior-attempt proof; compare unmet Acceptance against current task bytes and owned diff.",
    "Do not blindly replay a non-idempotent mutation.",
    "Resume only unmet work, then run fresh verification.",
  ] });
  if (/\b(?:detected|writer)\b.{0,80}\bdrift\b.{0,120}\b(?:may|can)\b.{0,120}\b(?:ignore|continue|write|mutate)/i.test(normalized.skill)) {
    issues.add("interrupted-recovery");
  }

  requireClauses("task-local-brief", { dispatch: [
    "Build the brief from current bytes after loading the plan index once. Include only:",
    "the task's referenced coverage-profile rows;",
    "Outcome, Scope, Ownership, Acceptance, Dependencies, and Verification Plan;",
    "owned code, its entrypoints/consumers, and explicit exclusions;",
    "Do not forward unrelated plan rows, sibling task bodies, ambient repository history, old proof, or a full session transcript.",
    "Reread the active task before mutation and after sync; a current-byte mismatch returns to the controller.",
  ] });

  requireClauses("final-head-fixed-point", { quality: [
    "Before GATE-DONE, repeat within the same three-round repair cap:",
    "Capture runtime Head and list every `done` task whose Receipt is stale or bound to a different Head.",
    "If proof changes any non-Specs byte, stop as BLOCKED;",
    "Stop only when consecutive Head captures are identical and every `done` Receipt names that current Head.",
    "A single pass, remembered result, copied Receipt, or proof promoted from another level is not a fixed point.",
  ] });

  requireClauses("shared-run-attribution", { quality: [
    "A shared command may prove several tasks only from one fresh captured run.",
    "map the exact command, current Head, required proof level, oracle, one uniquely named probe, and that probe's executed/pass count.",
    "Every mapped probe must execute at least once and all executions must pass.",
    "Duplicate probe names, ambiguous ownership/counts, skip, skipped, todo, cancel, canceled, cancelled, or remembered output cannot close any mapped task.",
    "Source, installed, and live proof levels remain distinct; never promote evidence from a lower level.",
  ] });

  requireClauses("complete-parallel-integration", { parallel: [
    "Range facts belong only in controller handoff metadata, never the inline Receipt:",
    "The final inline Receipt instead receives fresh runtime Base/Head, exact command, exit, and output after integration; handoff metadata cannot substitute for it.",
    "`git rev-list --reverse <base_sha>..<head_sha>`",
    "`git diff --name-status <base_sha>..<head_sha>`",
    "Reject an empty, discontinuous, partial, or base-incompatible range; duplicate/missing commits; and every path outside Ownership.",
    "After the last, compare the integrated owned-path tree with the worker tree.",
    "Any missing/extra commit or path stops before post-merge proof.",
  ] });

  requireClauses("non-flash-recovery", {
    skill: [
      "stop this invocation without chaining.",
      "Only a later explicit non-Flash invocation may recover the task.",
      "It treats Flash output as ephemeral, inspects current bytes and the owned diff, and obtains fresh canonical proof through the trusted sync-finalize path.",
    ],
    quality: [
      "Only a later explicit non-Flash invocation may recover it:",
      "discard Flash output as canonical evidence, inspect current bytes and the owned diff, and run fresh proof under the same sync-finalize contract.",
    ],
  });

  requireClauses("controller-only-state-proof", {
    dispatch: [
      "The controller alone writes Status and inline Receipt.",
      "Neither handoff is itself an inline Receipt; only the controller may validate and synchronize it.",
    ],
    parallel: [
      "Do not edit `plan.md`, Status, or `## Receipt`; only the controller writes state/proof.",
    ],
  });

  const expectedHint = "argument-hint: \"[feature-name|specs-directory-path] [task-file] [--flash] [--parallel [N]] [--notes]\"";
  const expectedUsage = [
    "/cf:develop <feature>",
    "/cf:develop specs/<feature>",
    "/cf:develop <feature> task-02-<slug>.md",
    "/cf:develop <feature> --flash",
    "/cf:develop <feature> --parallel [N]",
    "/cf:develop <feature> --notes",
  ];
  const usageLines = markdownSectionUnderHeading(skill, "Usage and pre-state guard")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(?:\/cf:develop|\$cf-develop)\b/.test(line));
  const modeHeadings = [...markdownSectionUnderHeading(skill, "Modes").matchAll(/^###\s+(.+?)\s*$/gm)]
    .map((match) => match[1]);
  if (!/^name:\s*cf:develop\s*$/m.test(skill)
    || !skill.includes(expectedHint)
    || !sameOrderedStrings(usageLines, expectedUsage)
    || !sameOrderedStrings(modeHeadings, [
      "Sequential feature or specific task", "Parallel (`--parallel [N]`)", "Flash (`--flash`)",
    ])) issues.add("public-mode-drift");

  const primaryCorpus = [skill, quality, parallel, dispatch]
    .map(outsideLegacySections)
    .join("\n");
  if (/\[(?:LIVE_)?VERIFIED\]/i.test(primaryCorpus)
    || /\b(?:live-model adherence|live behavior)\s+(?:is|are|has been)\s+(?:verified|proven|guaranteed)\b/i.test(primaryCorpus)
    || /\b(?:runtime|parser)\s+(?:enforces|guarantees|implements)\b/i.test(primaryCorpus)) {
    issues.add("live-or-runtime-claim");
  }
  if (/\b(?:wall[- ]clock|timing benchmark|latency|\d+\s*(?:seconds?|minutes?))\b/i.test(primaryCorpus)) {
    issues.add("timing-claim");
  }

  const legacyHeadingCount = [skill, quality, parallel, dispatch]
    .filter((value) => value.includes("## Legacy workflow compatibility")).length;
  if (legacyHeadingCount !== 4
    || /semantic_model|semantic-model|machine authority|task_registry|planning_depth|execution_tier|\blane\b/i.test(primaryCorpus)) {
    issues.add("legacy-isolation");
  }

  const lineCount = (value) => value.trimEnd().split("\n").length;
  const skillLines = lineCount(skill);
  const coreLines = [skill, parallel, sync, syncProtocols]
    .reduce((total, value) => total + lineCount(value), 0);
  if (skillLines < 140 || skillLines > 200 || coreLines > 400) issues.add("context-budget");

  return [...issues].sort();
}

function replaceDevelopClauseOnce(content, from, to) {
  const first = content.indexOf(from);
  if (first < 0 || content.indexOf(from, first + from.length) >= 0) {
    throw new Error(`expected one Develop mutation anchor: ${from}`);
  }
  return `${content.slice(0, first)}${to}${content.slice(first + from.length)}`;
}

async function runDevelopPlanNativeContractTests() {
  const fail = (message) => {
    throw new Error(`[FAIL] Develop plan-native contract: ${message}`);
  };
  const mutateClause = (name, source, issue, from, to) => ({
    name, source, issue, from, to,
  });
  const specificTaskBoundary = "Specific-task\nmode never touches a sibling and returns after its successful sync without chaining or GATE-DONE.";
  const verifyFirstMutations = [
    mutateClause("drops the command that derives Base and Head", "quality", "provenance-command",
      "`node .claude/scripts/provenance.cjs --project-root . --specs-root specs --spec-file <task file> --feature-name <feature> --session <any label> --json`,",
      "the runtime,"),
    mutateClause("the skill no longer names the provenance command", "skill", "provenance-command",
      "copied from the `Base` and `Head` fields of `node .claude/scripts/provenance.cjs", "taken from the runtime of `something"),
    mutateClause("lets Base and Head be computed by hand", "quality", "provenance-command",
      "and never type, abbreviate, or compute them by hand;", "or compute them however is convenient;"),
    mutateClause("rebinds without recomputing hashes", "quality", "artifact-rebind",
      "once every declared hash is recomputed and matches,", "without checking its hashes,"),
    mutateClause("lets an artifact-free Receipt skip the re-run", "quality", "artifact-rebind",
      "Receipt with no artifact, re-run; only the controller rebinds.", "Receipt, rebind the same way."),
    mutateClause("rebinds after the proof's inputs changed", "quality", "artifact-rebind",
      "when no file the proof reads changed between its recorded Head and the current one and",
      "even when the files the proof reads changed and"),
    mutateClause("expects the pre-change run to pass", "skill", "verify-first-and-round",
      "before changing anything and expect it to fail;",
      "before changing anything and expect it to pass;"),
    mutateClause("drops the costly-command exception", "skill", "verify-first-and-round",
      "Unless under `--flash` or the command costs money or writes artifacts, run",
      "Always run"),
    mutateClause("counts the pre-change run as a round", "skill", "verify-first-and-round",
      "this pre-change run is not a repair round.",
      "this pre-change run counts as the first repair round."),
    mutateClause("accepts a plan that passes before any change", "skill", "verify-first-and-round",
      "means the plan cannot judge the work and is a blocker;",
      "means the work is already done;"),
    mutateClause("lets an unrelated failure be worked around", "skill", "verify-first-and-round",
      "which is a blocker to raise, not a defect to work around while implementing.",
      "which can be worked around while implementing."),
    mutateClause("drops the round definition", "skill", "verify-first-and-round",
      "One repair round is one", "Repair rounds are counted loosely as one"),
    mutateClause("drops receipt-last", "skill", "verify-first-and-round",
      "**The Receipt is written last, after proof and review have both passed**",
      "The Receipt may be written once proof has passed"),
    mutateClause("drops scouting the judge", "skill", "verify-first-and-round",
      "Read the test or probe that will judge this task before implementing against it.",
      "Read whatever seems relevant."),
  ];
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(DEVELOP_PLAN_NATIVE_PATHS).map(async ([key, relativePath]) => [
      key, await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const baselineIssues = developPlanNativeContractIssues(baseline);
  if (baselineIssues.length > 0) fail(`intact sources returned ${baselineIssues.join(", ")}`);

  const mutations = [
    ...verifyFirstMutations,
    mutateClause(
      "paused-is-skipped",
      "skill",
      "current-byte-selection",
      "`paused` stops chaining; report and stop, never skip past it.",
      "Skip a paused row and continue the queue.",
    ),
    mutateClause(
      "selection-leaves-plan-order",
      "skill",
      "current-byte-selection",
      "Select the first dependency-valid `pending` row in `plan.md` order.",
      "Select any dependency-valid pending row in worker completion order.",
    ),
    mutateClause(
      "interrupted-action-replayed-blindly",
      "skill",
      "interrupted-recovery",
      "Do not blindly replay a non-idempotent\nmutation.",
      "Repeat every interrupted mutation from the beginning.",
    ),
    mutateClause(
      "multiple-active-resumes-first",
      "skill",
      "current-byte-selection",
      "More than one `in_progress` | Fail-stop; name every active task.",
      "More than one `in_progress` | Resume the first active task.",
    ),
    ...[
      ["specific-task-touches-sibling", "Specific-task\nmode never touches a sibling and returns after its successful sync without chaining or GATE-DONE. Specific-task mode may touch a sibling after sync."],
      ["specific-task-chains", "Specific-task\nmode never touches a sibling and returns after its successful sync without chaining or GATE-DONE. Specific-task mode may chain to the next task after sync."],
      ["specific-task-opens-c3", "Specific-task\nmode never touches a sibling and returns after its successful sync without chaining or GATE-DONE. Specific-task mode may open GATE-DONE after sync."],
    ].map(([name, to]) => mutateClause(
      name,
      "skill",
      "current-byte-selection",
      specificTaskBoundary,
      to,
    )),
    mutateClause(
      "writer-drift-allows-state-write",
      "skill",
      "interrupted-recovery",
      "detected state, task, or owned-path drift stops\nbefore any Status or Receipt write.",
      "detected state, task, or owned-path drift stops\nbefore any Status or Receipt write. Detected writer drift may be ignored and Status or Receipt writes may continue.",
    ),
    mutateClause(
      "shared-run-accepts-skips",
      "quality",
      "shared-run-attribution",
      "Duplicate probe names,\nambiguous ownership/counts, skip, skipped, todo, cancel, canceled, cancelled, or\nremembered output cannot close any mapped task.",
      "Skipped and cancelled probes may inherit the suite result.",
    ),
    mutateClause(
      "shared-run-allows-duplicate-probes",
      "quality",
      "shared-run-attribution",
      "one\nuniquely named probe, and that probe's executed/pass count.",
      "one reusable probe name without task-local counts.",
    ),
    mutateClause(
      "head-stops-after-one-pass",
      "quality",
      "final-head-fixed-point",
      "Stop only when consecutive Head captures are identical and every `done` Receipt\nnames that current Head.",
      "Stop after one stale-Receipt proof pass even when Head moves.",
    ),
    mutateClause(
      "partial-worker-range-integrates",
      "parallel",
      "complete-parallel-integration",
      "Reject an empty, discontinuous, partial, or base-incompatible range; duplicate/missing commits; and every path outside Ownership.",
      "Integrate any available subset of the worker range.",
    ),
    mutateClause(
      "flash-chains",
      "skill",
      "non-flash-recovery",
      "stop this invocation without chaining.",
      "continue with the next task after the preflight.",
    ),
    {
      name: "new-public-mode", source: "skill", issue: "public-mode-drift",
      mutate: (value) => replaceDevelopClauseOnce(
        value,
        "## Task cycle",
        "### Resume (`--resume`)\n\nResume automatically.\n\n## Task cycle",
      ),
    },
    mutateClause(
      "canonical-source-name-drifts",
      "skill",
      "public-mode-drift",
      "name: cf:develop",
      "name: cf-develop",
    ),
    mutateClause(
      "canonical-usage-drifts-to-codex",
      "skill",
      "public-mode-drift",
      "/cf:develop specs/<feature>",
      "$cf-develop specs/<feature>",
    ),
    mutateClause(
      "live-adherence-promoted",
      "skill",
      "live-or-runtime-claim",
      "live-model adherence is `[UNVERIFIED]` without a host invocation.",
      "live-model adherence is [VERIFIED] by this static contract.",
    ),
    mutateClause(
      "task-brief-loads-siblings",
      "dispatch",
      "task-local-brief",
      "Do not forward unrelated plan rows, sibling task bodies, ambient repository\nhistory, old proof, or a full session transcript.",
      "Forward all sibling tasks and repository history for convenience.",
    ),
    mutateClause(
      "worker-writes-receipt",
      "parallel",
      "controller-only-state-proof",
      "Do not edit `plan.md`, Status, or `## Receipt`; only the controller writes state/proof.",
      "Workers may write Status and Receipt before handoff.",
    ),
    mutateClause(
      "range-metadata-substitutes-receipt",
      "parallel",
      "complete-parallel-integration",
      "handoff metadata cannot substitute for it.",
      "handoff metadata may substitute for runtime Base/Head.",
    ),
  ];

  for (const mutation of mutations) {
    let weakened;
    try {
      weakened = mutation.mutate
        ? mutation.mutate(baseline[mutation.source])
        : replaceDevelopClauseOnce(baseline[mutation.source], mutation.from, mutation.to);
    } catch (error) {
      fail(`${mutation.name} mutation anchor failed: ${error.message}`);
    }
    const actual = developPlanNativeContractIssues({
      ...baseline,
      [mutation.source]: weakened,
    });
    if (!actual.includes(mutation.issue)) {
      fail(`${mutation.name} expected ${mutation.issue} but returned ${JSON.stringify(actual)}`);
    }
  }

  console.log("✔ cf:develop plan-native continuous contract is complete and bounded");
  console.log("✔ cf:develop plan-native checker rejects semantic weakenings");
  return mutations.length + 1;
}

function authoringInstructionIssues(sources) {
  const issues = [];
  const skill = sources.get("skill") || "";
  const review = sources.get("reviewReference") || "";
  const templates = sources.get("templatesReference") || "";
  const specMaker = sources.get("specMaker") || "";
  const primaryKeys = [
    "skill", "reviewReference", "templatesReference", "specMaker", "develop", "sync",
    "claudeState", "codexState", "claudeRuntime", "codexRuntime", "commonRuntime",
  ];
  const primaryCorpus = primaryKeys
    .map((key) => outsideLegacySections(sources.get(key) || ""))
    .join("\n");

  if (!/^name:\s*cf:specs\s*$/m.test(skill)
    || !/^description:\s*\S.+$/m.test(skill)
    || !/^argument-hint:\s*["']?<feature-description>["']?\s*$/m.test(skill)) {
    issues.push("specs-frontmatter-drift");
  }
  for (const gate of ["GATE-SCOPE", "GATE-REVIEW", "GATE-DONE"]) {
    if (!skill.includes(gate)) issues.push(`missing-human-gate-${gate.toLowerCase()}`);
  }
  for (const [key, content] of [["skill", skill], ["templates", templates]]) {
    if (!content.includes("specs/<feature>/") || !content.includes("plan.md")
      || !/task-(?:NN|\d{2})-(?:\*|<slug>)\.md/.test(content)) {
      issues.push(`${key}-flat-layout-drift`);
    }
  }
  if (/(?:specs\/<feature>\/)?tasks\/task-|plans\/<[^>]+>/.test(primaryCorpus)) {
    issues.push("primary-layout-is-not-flat-specs-feature");
  }
  if (!/path:line/.test(review) || !/cap[\s\S]{0,80}\b15\b/i.test(review)
    || !/two[^\n]*rounds/i.test(review) || !/consistency sweep/i.test(review)) {
    issues.push("review-evidence-or-stop-drift");
  }
  for (const token of [
    "Verification: PASS", "Command:", "Exit: 0", "Base:", "Head:", "```text",
  ]) {
    if (!templates.includes(token)) issues.push(`receipt-template-missing-${token.replace(/\W+/g, "-")}`);
  }
  if (!templates.includes("Twelve edge-case dimensions")
    || !templates.includes("EARS sentence patterns")
    || !templates.includes("Criteria")
    || !templates.includes("Tasks")) {
    issues.push("template-traceability-or-edge-cases-drift");
  }
  if (!/Do not start Develop|does not authorize work/i.test(specMaker)) {
    issues.push("spec-maker-auto-dispatches-develop");
  }

  const forbiddenV21 = /semantic_model|semantic-model|machine authority|task_registry|planning_depth|execution_tier|\blane\b/i;
  if (forbiddenV21.test(primaryCorpus)) issues.push("v21-vocabulary-outside-legacy");

  const codexProjection = `${sources.get("codexState") || ""}\n${sources.get("codexRuntime") || ""}`;
  for (const claudeOnlyTool of [
    "AskUserQuestion", "TaskCreate", "TaskGet", "TaskUpdate", "TaskList",
    "WebSearch", "WebFetch", "SendMessage",
  ]) {
    if (codexProjection.includes(claudeOnlyTool)) issues.push(`codex-claude-tool-${claudeOnlyTool}`);
  }
  return issues;
}

async function runAuthoringInstructionContractTests(fail) {
  const load = (relativePath) => readFile(join(packageRoot, relativePath), "utf8");
  const sources = new Map(await Promise.all([
    ["skill", "src/claude/skills/specs/SKILL.md"],
    ["reviewReference", "src/claude/skills/specs/references/review.md"],
    ["templatesReference", "src/claude/skills/specs/references/templates.md"],
    ["specMaker", "src/claude/agents/spec-maker.md"],
    ["develop", "src/claude/skills/develop/SKILL.md"],
    ["sync", "src/claude/skills/sync/SKILL.md"],
    ["claudeState", "src/claude/rules/state-sync.md"],
    ["codexState", "src/codex/rules/state-sync.md"],
    ["claudeRuntime", "src/claude/CLAUDE.md"],
    ["codexRuntime", "src/codex/AGENTS.md"],
    ["commonRuntime", "src/common/AGENTS.md"],
  ].map(async ([key, relativePath]) => [key, await load(relativePath)])));

  const issues = authoringInstructionIssues(sources);
  if (issues.length > 0) fail(`canonical instruction lint failed: ${issues.join(", ")}`);

  const mutations = [
    ["old specs flags", "skill", (value) => value.replace("<feature-description>", "[--status]")],
    ["missing GATE-REVIEW gate", "skill", (value) => value.replaceAll("GATE-REVIEW", "D2")],
    ["nested task layout", "templatesReference", (value) => `Use specs/<feature>/tasks/task-01.md.\n${value}`],
    ["missing evidence citations", "reviewReference", (value) => value.replaceAll("path:line", "citation")],
    ["missing receipt verification", "templatesReference", (value) => value.replaceAll("Verification: PASS", "Verification: MAYBE")],
    ["v2.1 authority outside Legacy", "claudeState", (value) => `task_registry is machine authority.\n${value}`],
    ["Codex Claude-tool vocabulary", "codexState", (value) => `Call TaskUpdate.\n${value}`],
    ["spec-maker auto dispatch", "specMaker", (value) => value
      .replaceAll("does not authorize work", "authorizes work")
      .replaceAll("Do not start Develop", "Start Develop")],
  ];
  for (const [label, key, mutate] of mutations) {
    const mutated = new Map(sources);
    mutated.set(key, mutate(mutated.get(key)));
    if (authoringInstructionIssues(mutated).length === 0) {
      fail(`instruction lint accepted ${label} mutation`);
    }
  }
  console.log("✔ Specs v3 flat layout, the three gates, review, and receipt contracts survive mutations");
  console.log("✔ Specs v2.1 vocabulary is isolated under hierarchical Legacy sections");
  console.log("✔ Claude-to-Codex projection rejects Claude-only tool vocabulary");
  return 8;
}

async function runSpecs21ContractTests() {
  const fail = (message) => {
    throw new Error(`[FAIL] Specs v2.1 contract: ${message}`);
  };
  const authoringInstructionTests = await runAuthoringInstructionContractTests(fail);
  const taskTemplate = await readFile(
    join(packageRoot, "src/claude/skills/specs/templates/task.md"),
    "utf8",
  );
  const designTemplate = await readFile(
    join(packageRoot, "src/claude/skills/specs/templates/design.md"),
    "utf8",
  );
  const stateTemplate = JSON.parse(await readFile(
    join(packageRoot, "src/claude/skills/specs/templates/spec-state.json"),
    "utf8",
  ));

  const headings = markdownH2s(taskTemplate);
  if (JSON.stringify(headings) !== JSON.stringify(TASK_21_SECTIONS)) {
    fail(`task headings ${JSON.stringify(headings)} do not equal ${JSON.stringify(TASK_21_SECTIONS)}`);
  }
  const ownershipHeader = /^\|\s*ID\s*\|\s*Type\s*\|\s*Target\s*\|\s*Role\s*\|\s*Access\s*\|\s*Action\s*\|$/gm;
  if ((taskTemplate.match(ownershipHeader) || []).length !== 1) {
    fail("task template must contain exactly one six-column ownership table");
  }
  if (/^##\s+(?:Related Files|Evidence|Completion Criteria)\s*$/m.test(taskTemplate)
    || /\btask_triggers\b|\(P\)/.test(taskTemplate)) {
    fail("task template contains legacy canonical-authoring vocabulary");
  }
  const verificationSectionCount = markdownH2s(designTemplate)
    .filter((heading) => heading === "Verification Definitions").length;
  if (verificationSectionCount !== 1) {
    fail("design template must expose exactly one Verification Definitions section");
  }
  const concreteValues = new Map([
    ["SUBJECT_REQ", "1"],
    ["X", "1"],
    ["PROOF_REQ", "1"],
    ["Y", "2"],
    ["exact command", "node --test test/retry.test.js"],
    ["exact anchored target", "src/retry-service.js#retry"],
    ["exact/repository/entrypoint", "src/retry-service.js"],
    ["observable result", "the subject result and verifier proof both pass"],
    ["concrete observable result and proof", "the subject result and verifier proof both pass"],
    ["concrete rejected or recovery case", "an exhausted retry remains failed and observable"],
    ["real entrypoint/caller and grounded anchor expectation", "the public retry caller reaches A-D-01"],
  ]);
  const concreteDesign = designTemplate.replace(/\{\{([^}]+)\}\}/g, (placeholder, name) => (
    concreteValues.has(name) ? concreteValues.get(name) : placeholder
  ));
  const parserErrors = [];
  const definitions = parseVerificationDefinitions(concreteDesign, parserErrors);
  if (parserErrors.length > 0) {
    fail(`canonical concrete V example is parser-invalid: ${parserErrors.join("; ")}`);
  }
  const definition = definitions.get("V1");
  if (!definition || definitions.size !== 1) {
    fail("canonical parser must return exactly V1");
  }
  if (JSON.stringify(definition.subject_criteria) !== JSON.stringify(["R1.1"])
    || JSON.stringify(definition.proof_criteria) !== JSON.stringify([])) {
    fail(`canonical V1 criteria drifted: ${JSON.stringify({
      subject: definition.subject_criteria,
      proof: definition.proof_criteria,
    })}`);
  }
  if (definition.proof_owner !== null || definition.evidence_anchor !== null) {
    fail(`canonical base V1 must omit proof authority: ${JSON.stringify({
      proof_owner: definition.proof_owner,
      evidence_anchor: definition.evidence_anchor,
    })}`);
  }
  if (JSON.stringify(definition.decision_refs) !== JSON.stringify(["D1", "I1", "C1"])) {
    fail(`canonical V1 decision refs drifted: ${JSON.stringify(definition.decision_refs)}`);
  }
  const proofDesign = concreteDesign.replace(
    "Owner A-D-01; Decision refs",
    "Owner A-D-01; Proof criteria R1.2; Proof owner A-D-02; Evidence anchor A-D-02; Decision refs",
  );
  const proofParserErrors = [];
  const proofDefinition = parseVerificationDefinitions(proofDesign, proofParserErrors).get("V1");
  if (proofParserErrors.length > 0
    || !proofDefinition
    || JSON.stringify(proofDefinition.subject_criteria) !== JSON.stringify(["R1.1"])
    || JSON.stringify(proofDefinition.proof_criteria) !== JSON.stringify(["R1.2"])
    || proofDefinition.subject_owner !== "A-D-01"
    || proofDefinition.proof_owner !== "A-D-02"
    || proofDefinition.evidence_anchor !== "A-D-02"
    || proofDefinition.subject_owner === proofDefinition.proof_owner) {
    fail(`canonical proof extension drifted: ${JSON.stringify({
      errors: proofParserErrors,
      definition: proofDefinition,
    })}`);
  }
  for (const field of [
    "subject_criteria", "subject_owner", "decision_refs", "method", "expected", "negative",
    "reachability",
  ]) {
    const value = definition[field];
    if ((Array.isArray(value) && value.length === 0)
      || (typeof value === "string" && value.trim() === "")
      || (value && typeof value === "object" && Object.keys(value).length === 0)
      || value === undefined) {
      fail(`canonical V1 parser field ${field} must be non-empty`);
    }
  }
  for (const hiddenGrammarMutation of [
    concreteDesign.replace("- **V1**:", "### V1 —"),
    concreteDesign.replace("- **V1**:", "| V1 |"),
    concreteDesign.replace("; Expected ", "\nExpected "),
    concreteDesign.replace("Decision refs ", "Decisions "),
  ]) {
    const mutationErrors = [];
    const mutationDefinitions = parseVerificationDefinitions(hiddenGrammarMutation, mutationErrors);
    if (mutationErrors.length === 0 || mutationDefinitions.has("V1")) {
      fail("canonical parser accepted a hidden V grammar mutation");
    }
  }
  const concreteTask = taskTemplate.replace(/\{\{([^}]+)\}\}/g, (placeholder, name) => {
    if (/^V reference\b/.test(name)) return "V1";
    if (name === "subject | verifier") return "subject";
    return placeholder;
  });
  const taskFields = markdownBoldBulletFields(concreteTask);
  if (taskFields.get("Verification ref") !== "V1"
    || !["subject", "verifier"].includes(taskFields.get("Task role"))) {
    fail("task Verification Plan must reference a V ID and declare subject/verifier role");
  }

  const policyKeys = Object.keys(stateTemplate.workflow_policy || {}).sort();
  const expectedPolicyKeys = [...workflowPolicy.CANONICAL_WORKFLOW_POLICY_FIELDS].sort();
  if (stateTemplate.schema_version !== "2.1"
    || stateTemplate.workflow_policy?.version !== "2.1"
    || JSON.stringify(policyKeys) !== JSON.stringify(expectedPolicyKeys)) {
    fail("spec-state template must exactly equal the executable canonical policy fields");
  }
  const runtimePolicy = workflowPolicy.canonicalWorkflowPolicySnapshot({
    planningDepth: "Compact",
    assuranceLevel: "Routine",
    risks: [],
  });
  if (JSON.stringify(Object.keys(runtimePolicy).sort()) !== JSON.stringify(expectedPolicyKeys)) {
    fail("executable canonical workflow policy emits a non-minimal projection");
  }
  if (JSON.stringify(runtimePolicy) !== JSON.stringify(stateTemplate.workflow_policy)) {
    fail("spec-state workflow_policy bytes drift from the executable canonical projection");
  }
  if (Object.prototype.hasOwnProperty.call(stateTemplate, "approvals")) {
    fail("spec-state template must not persist legacy approval state");
  }
  const authoring = stateTemplate.authoring || {};
  if (Object.keys(authoring).sort().join(",") !== "design,requirements,research,tasks"
    || !Object.values(authoring).every((value) => ["draft", "validated", "absent"].includes(value))) {
    fail("authoring state must use only draft, validated, or absent");
  }
  if (Object.keys(stateTemplate.coordination || {}).join(",") !== "boundaries"
    || !Array.isArray(stateTemplate.coordination.boundaries)) {
    fail("coordination.boundaries must be the initial topology authority");
  }
  const semanticReviewKeys = Object.keys(stateTemplate.validation?.semantic_review || {}).sort();
  if (semanticReviewKeys.join(",") !== [...C2_FIELDS].sort().join(",")) {
    fail("semantic review template fields drifted from the GATE-REVIEW canonical field-list authority");
  }

  const instructionFiles = [
    "src/claude/skills/specs/SKILL.md",
    "src/claude/skills/specs/references/review.md",
    "src/claude/skills/specs/references/templates.md",
    "src/claude/agents/spec-maker.md",
  ];
  const instructionText = (await Promise.all(instructionFiles.map((file) => (
    readFile(join(packageRoot, file), "utf8")
  )))).join("\n");
  for (const token of [
    "specs/<feature>/", "plan.md", "task-NN-", "GATE-SCOPE", "GATE-REVIEW", "GATE-DONE",
    "path:line", "Verification: PASS", "Base:", "Head:",
  ]) {
    if (!instructionText.includes(token)) fail(`instruction model is missing ${token}`);
  }
  const staleDowngradeField = "override_" + "receipt";
  const canonicalAuthoringFiles = [
    "../../README.md",
    "../../docs/specs-usage-guide.md",
    "../../plans/specs-v2-remake-blueprint.md",
    "src/claude/agents/spec-maker.md",
    "src/claude/skills/specs/SKILL.md",
    "src/claude/skills/specs/references/review.md",
    "src/claude/skills/specs/references/templates.md",
    "src/claude/skills/specs/templates/design.md",
    "src/claude/skills/specs/templates/task.md",
    "src/claude/skills/develop/SKILL.md",
    "src/claude/skills/sync/SKILL.md",
  ];
  for (const file of canonicalAuthoringFiles) {
    const content = await readFile(join(packageRoot, file), "utf8");
    if (content.includes(staleDowngradeField)) {
      fail(`${file} exposes a stale downgrade receipt on the canonical authoring path`);
    }
  }

  const reporterFixture = [
    "ℹ tests 3",
    "ℹ pass 2",
    "ℹ fail 1",
    "ℹ skipped 0",
    "",
    "test at bin/__tests__/fixture.test.js:12:3",
    "✖ reports the exact contract failure (1.5ms)",
  ].join("\n");
  const reporterSummary = parseNodeTestSummary(reporterFixture);
  if (reporterSummary.tests !== 3 || reporterSummary.pass !== 2
    || reporterSummary.fail !== 1 || reporterSummary.failingTests.length !== 1
    || reporterSummary.failingTests[0].file !== "bin/__tests__/fixture.test.js"
    || !nodeFailureDetail(reporterSummary).includes("fixture.test.js:12:3")) {
    fail("full-runner failure summary must preserve exact count and failing test location");
  }

  console.log("✔ Specs v2.1 task structure and ownership table are canonical");
  console.log("✔ Specs v2.1 V definitions expose the validator grammar and proof roles");
  console.log("✔ Specs v2.1 machine state and semantic receipt vocabulary are canonical");
  console.log("✔ Specs v2.1 canonical authoring source exposes no downgrade receipt");
  console.log("✔ Full runner preserves exact Node failure counts and locations");
  return 15 + authoringInstructionTests;
}

const DEBUG_ADAPTIVE_PATHS = {
  skill: "src/claude/skills/debug/SKILL.md",
  agent: "src/claude/agents/debugger.md",
  tracing: "src/claude/references/debugger/root-cause-tracing.md",
  verification: "src/claude/references/debugger/verification-protocol.md",
  parallel: "src/claude/references/debugger/parallel-agent-hydration.md",
  logs: "src/claude/references/debugger/log-ci-analysis.md",
  sideEffects: "src/claude/references/debugger/side-effect-gate.md",
};

function debugAdaptiveContractIssues(input) {
  const issues = new Set();
  const { skill, agent, tracing, verification, parallel, logs, sideEffects } = input;
  if (!skill.includes("## Proportional depth")
    || !skill.includes("**Quick/local:**")
    || !skill.includes("**Incident/deep:**")
    || !skill.includes('argument-hint: "[issue] --quick|--ci|--frontend|--perf"')) {
    issues.add("proportional-depth");
  }
  if (!skill.includes("`cf:debug` is read-only for product code")
    || !agent.includes("Never implement the repair")
    || !verification.includes("Debug owns the failing baseline and the proof plan")
    || verification.includes("Execution (Apply the Fix)")) {
    issues.add("diagnostic-boundary");
  }
  if (!skill.includes("Evidence Timeline")
    || !logs.includes("Normalize all timestamps to one timezone")
    || !logs.includes("ordering, not causation")
    || !logs.includes("request, trace, job, session, or run ID")) {
    issues.add("timeline-causality");
  }
  if (!skill.includes("Preserve an elimination path")
    || !agent.includes("Keep an elimination path")) {
    issues.add("elimination-path");
  }
  if (!skill.includes("Trigger: event or input")
    || !skill.includes("Contributing factors:")
    || !skill.includes("Do not collapse correlation into causation")
    || !tracing.includes("## Separate Causal Roles")) {
    issues.add("causal-taxonomy");
  }
  if (!tracing.includes("symptom -> immediate cause -> caller/data boundary -> origin")
    || !tracing.includes("For test pollution, isolate the polluter")
    || !tracing.includes("History And Bisection")) {
    issues.add("deep-tracing");
  }
  if (!skill.includes("### Recurrence-Prevention Handoff")
    || !agent.includes("### Recurrence-Prevention Handoff")
    || !sideEffects.includes("Observability/alerting gap")) {
    issues.add("recurrence-handoff");
  }
  if (!parallel.includes("The user explicitly requested or permitted delegation or parallel agents")
    || !parallel.includes("The active runtime exposes an Explore/delegation capability")
    || !parallel.includes("at least two distinct, non-overlapping scopes")
    || !parallel.includes("Otherwise continue sequentially")
    || !parallel.includes("Reconnaissance is read-only")) {
    issues.add("delegation-gate");
  }
  if (!agent.includes("Use `/cf:scout` or focused local `rg`/reads")
    || agent.includes("less than 2 days old")
    || agent.includes("create/update a codebase summary")) {
    issues.add("targeted-discovery");
  }
  return [...issues].sort();
}

function replaceDebugClauseOnce(content, from, to) {
  const first = content.indexOf(from);
  if (first < 0 || content.indexOf(from, first + from.length) >= 0) {
    throw new Error(`expected one Debug mutation anchor: ${from}`);
  }
  return `${content.slice(0, first)}${to}${content.slice(first + from.length)}`;
}

async function runDebugAdaptiveContractTests() {
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(DEBUG_ADAPTIVE_PATHS).map(async ([key, relativePath]) => [
      key, await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const baselineIssues = debugAdaptiveContractIssues(baseline);
  if (baselineIssues.length > 0) {
    throw new Error(`[FAIL] Debug adaptive contract: intact sources returned ${baselineIssues.join(", ")}`);
  }
  const mutations = [
    ["quick-becomes-deep", "skill", "proportional-depth", "**Quick/local:**", "**Routine:**"],
    ["debug-applies-fix", "verification", "diagnostic-boundary", "Debug owns the failing baseline and the proof plan", "Debug applies the fix and owns the proof plan"],
    ["timeline-drops-timezone", "logs", "timeline-causality", "Normalize all timestamps to one timezone", "Compare timestamps as printed"],
    ["elimination-is-optional", "agent", "elimination-path", "Keep an elimination path", "Optionally summarize candidates"],
    ["cause-loses-trigger", "skill", "causal-taxonomy", "Trigger: event or input", "Activation detail: event or input"],
    ["trace-stops-at-throw", "tracing", "deep-tracing", "symptom -> immediate cause -> caller/data boundary -> origin", "symptom -> thrown frame"],
    ["recurrence-is-removed", "sideEffects", "recurrence-handoff", "Observability/alerting gap", "Operational notes"],
    ["delegation-loses-user-gate", "parallel", "delegation-gate", "The user explicitly requested or permitted delegation or parallel agents", "Delegation seems useful"],
    ["scout-becomes-mandatory-summary", "agent", "targeted-discovery", "Use `/cf:scout` or focused local `rg`/reads", "Always create/update a codebase summary"],
  ];
  for (const [name, source, expectedIssue, from, to] of mutations) {
    const changed = { ...baseline, [source]: replaceDebugClauseOnce(baseline[source], from, to) };
    const issues = debugAdaptiveContractIssues(changed);
    if (!issues.includes(expectedIssue)) {
      throw new Error(`[FAIL] Debug adaptive contract mutation ${name} missed ${expectedIssue}: ${issues.join(", ")}`);
    }
  }
  console.log("✔ cf:debug adaptive incident contract is complete and bounded");
  console.log(`✔ cf:debug adaptive incident checker rejects ${mutations.length} semantic weakenings`);
  return mutations.length + 1;
}

const HOTFIX_ADAPTIVE_PATHS = {
  skill: "src/claude/skills/fix/SKILL.md",
  diagnosis: "src/claude/skills/fix/references/diagnosis-protocol.md",
  review: "src/claude/skills/fix/references/review-cycle.md",
  parallel: "src/claude/skills/fix/references/parallel-patterns.md",
  prevention: "src/claude/skills/fix/references/prevention-gate.md",
  specialized: "src/claude/skills/fix/references/workflow-specialized.md",
};

function hotfixAdaptiveContractIssues(input) {
  const issues = new Set();
  const { skill, diagnosis, review, parallel, prevention, specialized } = input;
  const parallelContract = parallel.replace(/\s+/g, " ").trim();
  if (!skill.includes("name: cf:fix")
    || !skill.includes("# Fix — root-cause repair workflow")
    || skill.includes("name: cf:hotfix")) {
    issues.add("public-rename");
  }
  if (!skill.includes("## Proportional depth")
    || !skill.includes("**Quick/local:**")
    || !skill.includes("**Incident/deep:**")
    || !skill.includes("Quick mode only reduces depth")
    || !skill.includes("it never skips scout, pre-fix evidence, diagnosis, or before/after verification")) {
    issues.add("proportional-depth");
  }
  if (!skill.includes("Trigger: event or input")
    || !skill.includes("Contributing factors: conditions that raised likelihood")
    || !diagnosis.includes("- Trigger: event or input")
    || !diagnosis.includes("- Contributing factors: conditions that raised likelihood")) {
    issues.add("causal-fields");
  }
  if (!skill.includes("`Timeline: skipped - <reason>`")
    || !skill.includes("`- skipped: <reason>`")
    || !skill.includes("`Elimination Path` records the decisive observation")
    || !skill.includes("`Recurrence-Prevention Handoff`, when present")
    || !skill.includes("routes back to diagnosis")) {
    issues.add("handoff-validation");
  }
  if (!skill.includes("report `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`")
    || !skill.includes("The definition of `PASS` defers to `cf:code-review`")
    || !skill.includes("same remediation or user-pause path as `FAIL`")
    || skill.includes("Confidence score")
    || !review.includes("PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED")
    || !review.includes("Only `FAIL` and `PASS_WITH_WARNINGS` enter remediation retry")
    || !review.includes("The definition of `PASS` defers to `cf:code-review`")
    || !review.includes("only a fresh literal `PASS` enters finalization")
    || review.includes('"Approve anyway"')
    || review.includes('"Approve with known issues"')
    || review.includes('→ "Approve"')
    || review.includes("at most one Medium")) {
    issues.add("verdict-surface");
  }
  if (!skill.includes("The original symptom no longer reproduces with the exact pre-fix command/user flow.")
    || !skill.includes("Modified files and transitively affected modules still pass relevant tests.")
    || !skill.includes("Blast-radius workflows have no business-logic regression.")
    || !skill.includes("No new lint/type/build errors were introduced.")
    || !skill.includes("Public contracts are unchanged unless intentionally called out: function signatures, exported types, response shapes, DB schemas, env vars.")
    || !skill.includes("Do not silently patch around the regression.")) {
    issues.add("side-effect-gate");
  }
  if (!skill.includes("The user explicitly requested or permitted delegation or parallel agents.")
    || !skill.includes("The active runtime exposes an Explore/delegation capability.")
    || !skill.includes("at least two distinct, non-overlapping scopes")
    || !skill.includes("Otherwise continue sequentially")
    || !skill.includes("optional visibility fallback, never a required step")
    || !parallel.includes("The user explicitly requested or permitted delegation or parallel agents.")
    || !parallel.includes("at least two distinct, non-overlapping scopes")
    || !parallel.includes("Otherwise continue sequentially")) {
    issues.add("delegation-gate");
  }
  if (!prevention.includes("Step 5 side-effect sweep")
    || !prevention.includes("Recurrence-Prevention Handoff")) {
    issues.add("prevention-link");
  }
  if (!skill.includes("## Bounded repair frame")
    || !skill.includes("Quick/local does not add a separate framing ceremony")
    || !skill.includes("**Outcome:**")
    || !skill.includes("**Constraints:**")
    || !skill.includes("**Non-goals:**")
    || !skill.includes("**Acceptance:**")
    || !skill.includes("does not select a solution, widen the issue into feature work")) {
    issues.add("bounded-repair-frame");
  }
  if (!skill.includes("after diagnosis, research only unresolved external facts")
    || !skill.includes("multiple cause-aligned remedies or an architecture decision remain")
    || !skill.includes("`cf:brainstorm` to compare 2-3 options")
    || !skill.includes("concise staged implementation plan with dependencies and proof per")
    || !skill.includes("When diagnosis leaves one safe direct repair, skip research and")) {
    issues.add("deep-decision-route");
  }
  if (!skill.includes("Load only the matching")
    || !specialized.includes("Load only the matching section")
    || !specialized.includes("## CI/CD Pipeline Failures")
    || !specialized.includes("## Test Suite Failures")
    || !specialized.includes("## TypeScript Type Errors")
    || !specialized.includes("## UI / Visual Issues")
    || !specialized.includes("## Application Log Errors")
    || (specialized.match(/\*\*Baseline:\*\*/g) || []).length < 5
    || (specialized.match(/\*\*Proof:\*\*/g) || []).length < 5) {
    issues.add("specialized-proof-overlays");
  }
  if (!parallelContract.includes("Diagnosis still starts only")
    || !parallelContract.includes("after the required scout outputs are synthesized")
    || !parallelContract.includes("then begin hypotheses and diagnosis")
    || !parallelContract.includes("Research begins only after Step 2 diagnosis")
    || parallelContract.includes("scout + diagnose + research together")
    || parallelContract.includes("You don't need to wait for scouting")) {
    issues.add("scout-before-diagnosis");
  }
  return [...issues].sort();
}

function replaceHotfixClauseOnce(content, from, to) {
  const first = content.indexOf(from);
  if (first < 0 || content.indexOf(from, first + from.length) >= 0) {
    throw new Error(`expected one Hotfix mutation anchor: ${from}`);
  }
  return `${content.slice(0, first)}${to}${content.slice(first + from.length)}`;
}

async function runHotfixAdaptiveContractTests() {
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(HOTFIX_ADAPTIVE_PATHS).map(async ([key, relativePath]) => [
      key, await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const baselineIssues = hotfixAdaptiveContractIssues(baseline);
  if (baselineIssues.length > 0) {
    throw new Error(`[FAIL] Hotfix adaptive contract: intact sources returned ${baselineIssues.join(", ")}`);
  }
  const mutations = [
    ["public-name-reverts", "skill", "public-rename", "name: cf:fix", "name: cf:hotfix"],
    ["quick-skips-diagnosis", "skill", "proportional-depth", "Quick mode only reduces depth", "Quick mode may shorten diagnosis"],
    ["contract-loses-trigger", "skill", "causal-fields", "Trigger: event or input that activated the failure", "Activation note: whatever started the failure"],
    ["protocol-loses-contributing", "diagnosis", "causal-fields", "- Contributing factors: conditions that raised likelihood or impact but are not sufficient causes, or `none evidenced`", "- Side notes: optional context"],
    ["handoff-drops-dash-skip-form", "skill", "handoff-validation", "`Timeline: skipped - <reason>`", "`Timeline: omitted`"],
    ["handoff-drops-colon-skip-form", "skill", "handoff-validation", "`- skipped: <reason>`", "`- omitted: <reason>`"],
    ["recurrence-becomes-required", "skill", "handoff-validation", "`Recurrence-Prevention Handoff`, when present, carries evidence-backed candidates only", "`Recurrence-Prevention Handoff` is always required"],
    ["incomplete-report-implements", "skill", "handoff-validation", "routes back to diagnosis", "may proceed to implementation with caveats"],
    ["enum-drops-warnings", "skill", "verdict-surface", "report `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`", "report `PASS | FAIL | BLOCKED`"],
    ["warnings-auto-accept", "review", "verdict-surface", "Only `FAIL` and `PASS_WITH_WARNINGS` enter remediation retry", "Only `FAIL` enters remediation retry; `PASS_WITH_WARNINGS` auto-approves"],
    ["warnings-user-approve", "review", "verdict-surface", "only a fresh literal `PASS` enters finalization", '"Approve anyway" enters finalization'],
    ["pass-redefined-locally", "review", "verdict-surface", "The definition of `PASS` defers to `cf:code-review`; Fix never redefines it with local severity thresholds.", "The definition of `PASS` is local: no Critical, no High, at most one Medium."],
    ["confidence-score-returns", "skill", "verdict-surface", "**Report:** root cause, changes made", "**Report:** Confidence score, root cause, changes made"],
    ["sweep-loses-repro-check", "skill", "side-effect-gate", "The original symptom no longer reproduces with the exact pre-fix command/user flow.", "The symptom appears resolved."],
    ["sweep-loses-module-tests", "skill", "side-effect-gate", "Modified files and transitively affected modules still pass relevant tests.", "Modified files look correct on re-read."],
    ["sweep-loses-blast-radius", "skill", "side-effect-gate", "Blast-radius workflows have no business-logic regression.", "Nearby workflows were not inspected."],
    ["sweep-loses-toolchain-check", "skill", "side-effect-gate", "No new lint/type/build errors were introduced.", "Lint noise is acceptable."],
    ["sweep-loses-contract-check", "skill", "side-effect-gate", "Public contracts are unchanged unless intentionally called out: function signatures, exported types, response shapes, DB schemas, env vars.", "Public contracts probably held."],
    ["delegation-loses-user-clause", "skill", "delegation-gate", "The user explicitly requested or permitted delegation or parallel agents.", "Delegation is at the agent's discretion."],
    ["patterns-lose-scope-clause", "parallel", "delegation-gate", "at least two distinct, non-overlapping scopes", "any promising scope"],
    ["tasks-become-mandatory", "skill", "delegation-gate", "Task-tracking tools are an optional visibility fallback, never a required step", "Task-tracking tools are a required step"],
    ["prevention-unlinks-sweep", "prevention", "prevention-link", "Step 5 side-effect sweep", "final summary"],
    ["prevention-drops-recurrence", "prevention", "prevention-link", "Recurrence-Prevention Handoff", "informal notes"],
    ["quick-gains-mandatory-frame", "skill", "bounded-repair-frame", "Quick/local does not add a separate framing ceremony", "Quick/local always requires a separate framing ceremony"],
    ["deep-skips-post-diagnosis-choice", "skill", "deep-decision-route", "after diagnosis, research only unresolved external facts", "research broadly before diagnosis"],
    ["overlays-load-everything", "specialized", "specialized-proof-overlays", "Load only the matching section", "Load every section"],
    ["diagnosis-starts-before-scout", "parallel", "scout-before-diagnosis", "Diagnosis still starts only", "Diagnosis may start"],
    ["research-starts-before-diagnosis", "parallel", "scout-before-diagnosis", "Research begins only after Step 2 diagnosis", "Research may begin before Step 2 diagnosis"],
  ];
  for (const [name, source, expectedIssue, from, to] of mutations) {
    const changed = { ...baseline, [source]: replaceHotfixClauseOnce(baseline[source], from, to) };
    const issues = hotfixAdaptiveContractIssues(changed);
    if (!issues.includes(expectedIssue)) {
      throw new Error(`[FAIL] Hotfix adaptive contract mutation ${name} missed ${expectedIssue}: ${issues.join(", ")}`);
    }
  }
  console.log("✔ cf:fix adaptive contract is complete and bounded");
  console.log(`✔ cf:fix checker rejects ${mutations.length} semantic weakenings`);
  return mutations.length + 1;
}

const DOCS_ADAPTIVE_PATHS = {
  skill: "src/claude/skills/docs/SKILL.md",
  init: "src/claude/skills/docs/references/init-workflow.md",
  update: "src/claude/skills/docs/references/update-workflow.md",
  standard: "src/claude/skills/docs/references/standard-docs-workflow.md",
};

function docsAdaptiveContractIssues(input) {
  const issues = new Set();
  const { skill, init, update, standard } = input;
  if (!skill.includes("The user explicitly requested or permitted delegation or parallel agents.")
    || !skill.includes("The active runtime exposes an Explore/delegation capability.")
    || !skill.includes("at least two distinct, non-overlapping scopes")
    || !skill.includes("Otherwise continue sequentially in the main agent")
    || !skill.includes("only through the Delegation Gate above")
    || !init.includes("only through the Delegation Gate in `../SKILL.md`")
    || !update.includes("Delegate to `docs-keeper` only through the Delegation Gate in `../SKILL.md`")
    || !update.includes("only when the Delegation Gate in `../SKILL.md` is open")
    || skill.includes("when delegation is available")
    || init.includes("when delegation is available")
    || update.includes("when delegation is available")) {
    issues.add("delegation-gate");
  }
  if (!skill.includes("## Post-Task Docs Checkpoint")
    || !skill.includes("`none`: report that no docs change is needed and edit nothing.")
    || !skill.includes("update only affected existing docs, surgically")
    || !skill.includes("A checkpoint never invents a new document")
    || !skill.includes("never auto-selects `init` and overrides")
    || !skill.includes("report the gap and recommend an explicit `/cf:docs --init`")
    || !update.includes("A post-task checkpoint entry never switches to `init`")
    || !standard.includes("checkpoint contract in `../SKILL.md`")
    || skill.includes("checkpoint may create")) {
    issues.add("docs-checkpoint");
  }
  if (!skill.includes("Type: Observed | Inferred | Unknown")
    || !skill.includes("Confidence: High | Medium | Low")
    || !skill.includes("Do not hide uncertainty.")
    || skill.includes("evidence is optional")) {
    issues.add("evidence-taxonomy");
  }
  if (!skill.includes("## Reconstruction Is Not Specs")
    || !skill.includes("- create `specs/<feature>/`")
    || !skill.includes("- run `/cf:develop`")
    || skill.includes("are advisory")) {
    issues.add("reconstruction-boundary");
  }
  if (!skill.includes("validate-docs.cjs")
    || !skill.includes("validate-docs-reconstruct.cjs")
    || !update.includes("validate-docs.cjs")
    || !skill.includes("Choose the smallest adequate docs work")
    || skill.includes("skip the validator")) {
    issues.add("validation-and-proportionality");
  }
  return [...issues].sort();
}

function replaceDocsClauseOnce(content, from, to) {
  const first = content.indexOf(from);
  if (first < 0 || content.indexOf(from, first + from.length) >= 0) {
    throw new Error(`expected one Docs mutation anchor: ${from}`);
  }
  return `${content.slice(0, first)}${to}${content.slice(first + from.length)}`;
}

async function runDocsAdaptiveContractTests() {
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(DOCS_ADAPTIVE_PATHS).map(async ([key, relativePath]) => [
      key, await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const baselineIssues = docsAdaptiveContractIssues(baseline);
  if (baselineIssues.length > 0) {
    throw new Error(`[FAIL] Docs adaptive contract: intact sources returned ${baselineIssues.join(", ")}`);
  }
  const mutations = [
    ["gate-loses-user-clause", "skill", "delegation-gate", "The user explicitly requested or permitted delegation or parallel agents.", "Delegation is at the agent's discretion."],
    ["gate-loses-capability-clause", "skill", "delegation-gate", "The active runtime exposes an Explore/delegation capability.", "Any runtime may delegate."],
    ["keeper-ungated-returns", "update", "delegation-gate", "Delegate to `docs-keeper` only through the Delegation Gate in `../SKILL.md`", "Delegate to `docs-keeper` when delegation is available"],
    ["readers-ungated", "update", "delegation-gate", "only when the Delegation Gate in `../SKILL.md` is open", "whenever it seems faster"],
    ["init-keeper-ungated", "init", "delegation-gate", "only through the Delegation Gate in `../SKILL.md`", "when delegation is available"],
    ["skill-keeper-ungated", "skill", "delegation-gate", "only through the Delegation Gate above", "when delegation is available"],
    ["checkpoint-none-edits", "skill", "docs-checkpoint", "`none`: report that no docs change is needed and edit nothing.", "`none`: refresh the docs anyway."],
    ["checkpoint-invents-doc", "skill", "docs-checkpoint", "A checkpoint never invents a new document", "A checkpoint may create missing documents"],
    ["checkpoint-auto-init", "skill", "docs-checkpoint", "never auto-selects `init` and overrides", "may fall back to `init` and overrides"],
    ["escape-path-removed", "skill", "docs-checkpoint", "report the gap and recommend an explicit `/cf:docs --init`", "silently bootstrap the missing docs with `/cf:docs"],
    ["update-checkpoint-switches", "update", "docs-checkpoint", "A post-task checkpoint entry never switches to `init`", "A checkpoint may switch to `init`"],
    ["standard-checkpoint-dropped", "standard", "docs-checkpoint", "checkpoint contract in `../SKILL.md`", "local judgment"],
    ["taxonomy-drops-inferred", "skill", "evidence-taxonomy", "Type: Observed | Inferred | Unknown", "Type: Observed | Unknown"],
    ["uncertainty-hidden", "skill", "evidence-taxonomy", "Do not hide uncertainty.", "Smooth over uncertainty; evidence is optional."],
    ["reconstruction-becomes-advisory", "skill", "reconstruction-boundary", "## Reconstruction Is Not Specs", "## Reconstruction Is Not Specs\n\nThe prohibitions below are advisory."],
    ["reconstruction-creates-specs", "skill", "reconstruction-boundary", "- create `specs/<feature>/`", "- create planning folders freely"],
    ["validator-skipped", "skill", "validation-and-proportionality", "use `.claude/scripts/validate-docs.cjs <docs-root>` after create/update work", "skip the validator after create/update work"],
    ["smallest-adequate-removed", "skill", "validation-and-proportionality", "Choose the smallest adequate docs work", "Prefer comprehensive rewrites"],
  ];
  for (const [name, source, expectedIssue, from, to] of mutations) {
    const changed = { ...baseline, [source]: replaceDocsClauseOnce(baseline[source], from, to) };
    const issues = docsAdaptiveContractIssues(changed);
    if (!issues.includes(expectedIssue)) {
      throw new Error(`[FAIL] Docs adaptive contract mutation ${name} missed ${expectedIssue}: ${issues.join(", ")}`);
    }
  }
  console.log("✔ cf:docs adaptive contract is complete and bounded");
  console.log(`✔ cf:docs checker rejects ${mutations.length} semantic weakenings`);
  return mutations.length + 1;
}

const RESEARCH_ADAPTIVE_PATHS = {
  skill: "src/claude/skills/research/SKILL.md",
  agent: "src/claude/agents/researcher.md",
  template: "src/claude/skills/specs/templates/research.md",
};

function researchAdaptiveContractIssues(input) {
  const expectedKeys = Object.keys(RESEARCH_ADAPTIVE_PATHS).sort();
  const actualKeys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
    || actualKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("research adaptive checker expects exactly three UTF-8 source strings");
  }

  const issues = new Set();
  const normalized = Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key, normalizeMarkdownWhitespace(value),
  ]));
  const requireClauses = (issue, clausesBySource) => {
    const missing = Object.entries(clausesBySource).some(([source, clauses]) =>
      clauses.some((clause) => !normalized[source].includes(normalizeMarkdownWhitespace(clause))));
    if (missing) issues.add(issue);
  };

  requireClauses("depth-routing", { skill: [
    "Choose the smallest depth that can support the decision:",
    "Quick | One low-risk, reversible fact or known option",
    "Standard | Several viable options or a material integration choice",
    "Deep | High blast radius, hard-to-reverse architecture, security/compliance, substantial cost, or conflicting evidence",
    "Escalate depth when evidence conflicts, a primary source is missing, or a finding changes the decision boundary.",
  ], agent: [
    "Honor the controller's `Quick | Standard | Deep` assignment.",
    "Deep completes a separate contradiction-and-gap round",
  ] });
  requireClauses("claim-provenance", { skill: [
    "Repository claims: cite a resolvable `path:line` anchor from current bytes.",
    "claim, URL or repository anchor, authority, date/version, applicability to this project, and status `confirmed | inferred | unresolved`.",
    "Browse when facts may have changed; record the source date or applicable version.",
  ], agent: [
    "claim, URL or repository anchor, authority, date/version, applicability, and `confirmed | inferred | unresolved`.",
  ], template: [
    "URL or repository path:line; authority; date/version; project applicability; confirmed|inferred|unresolved.",
  ] });
  requireClauses("contradiction-and-ranking", { skill: [
    "Do not inflate source counts with mirrors or articles that repeat the same upstream claim.",
    "Complete Standard, then run a separate contradiction-and-gap round",
    "rank only viable options and name a winner when evidence and project fit support one.",
    "If evidence cannot choose a winner, return `unresolved` plus the smallest fact or experiment that would.",
  ], agent: [
    "Surface contradictions, version mismatch, missing primary evidence, and limits.",
    "Never convert source quantity into a fabricated credibility score.",
  ] });
  requireClauses("delegation-fallback", { skill: [
    "Use delegated researchers only as optional acceleration",
    "If delegation is unavailable, unauthorized, or not useful, research sequentially with the same evidence bar.",
    "The controller owns the question, source reconciliation, and final recommendation.",
  ] });
  requireClauses("persistence-authority", { skill: [
    "Default to a concise answer in chat.",
    "one explicitly resolved active Spec requires durable `research.md`",
    "the user explicitly requests a durable report and approves its destination.",
    "Do not create a Spec or `_shared` archive merely to save an answer.",
  ], agent: [
    "do not implement code, write files, mutate task state, ask the user directly, or launch another workflow.",
    "The controller reconciles tracks, chooses the final recommendation, and owns any authorized persistence.",
  ] });
  requireClauses("legacy-template", { skill: [
    "Keep claim records and comparisons inside `## Evidence Summary`; do not add or reorder mandatory H2 headings.",
  ], template: [
    "## Uncertainty", "## Evidence Summary", "## Decision", "## Remaining Gaps",
    "Keep the mandatory H2 headings in this exact order.",
  ] });
  requireClauses("proof-boundary", { skill: [
    "It never starts Develop, edits implementation code, claims user approval, or presents source/installed evidence as live-system proof.",
  ] });

  const skillCorpus = normalized.skill.toLowerCase();
  const agentCorpus = normalized.agent.toLowerCase();
  if (/must (?:instantly |always )?delegate|must not attempt to run websearch|delegation is required/.test(skillCorpus)) {
    issues.add("delegation-fallback");
  }
  if (/(?:every|all) research (?:request|task).{0,50}(?:requires?|must use).{0,40}(?:delegat|researcher)/.test(skillCorpus)) {
    issues.add("delegation-fallback");
  }
  if (/always save|all research belongs in|create it if it does not exist/.test(skillCorpus)) {
    issues.add("persistence-authority");
  }
  if (/(?:persist|save|archive) every (?:answer|response|report)/.test(skillCorpus)) {
    issues.add("persistence-authority");
  }
  if (/deep (?:may|can|should).{0,50}skip.{0,40}contradiction/.test(skillCorpus)) {
    issues.add("contradiction-and-ranking");
  }
  if (/material claims?.{0,60}(?:may|can).{0,40}(?:omit|skip).{0,50}(?:anchor|date|version|status|applicability)/.test(skillCorpus)) {
    issues.add("claim-provenance");
  }
  if (/credibility coefficient|absolute accuracy|supreme directive|alpha predator/.test(agentCorpus)) {
    issues.add("contradiction-and-ranking");
  }
  if (/live (?:adherence|system) is (?:verified|proven)|\[verified\]/.test(skillCorpus)) {
    issues.add("proof-boundary");
  }
  if (/(?:source|installed).{0,50}(?:may|can|should).{0,40}(?:count|serve|be treated).{0,30}(?:as )?live/.test(skillCorpus)) {
    issues.add("proof-boundary");
  }

  const mandatoryHeadings = markdownH2s(input.template);
  if (JSON.stringify(mandatoryHeadings) !== JSON.stringify([
    "Uncertainty", "Evidence Summary", "Decision", "Remaining Gaps",
  ])) issues.add("legacy-template");
  return [...issues].sort();
}

function replaceResearchClauseOnce(content, from, to) {
  const first = content.indexOf(from);
  if (first < 0 || content.indexOf(from, first + from.length) >= 0) {
    throw new Error(`research mutation anchor must occur exactly once: ${from}`);
  }
  return `${content.slice(0, first)}${to}${content.slice(first + from.length)}`;
}

async function runResearchAdaptiveContractTests() {
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(RESEARCH_ADAPTIVE_PATHS).map(async ([key, relativePath]) => [
      key, await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const baselineIssues = researchAdaptiveContractIssues(baseline);
  if (baselineIssues.length > 0) {
    throw new Error(`[FAIL] Research adaptive contract: intact sources returned ${baselineIssues.join(", ")}`);
  }
  const mutations = [
    ["quick-becomes-default-deep", "skill", "depth-routing", "Choose the smallest depth that can support the decision:", "Always use Deep regardless of decision risk:"],
    ["deep-drops-contradiction-round", "skill", "contradiction-and-ranking", "Complete Standard, then run a separate contradiction-and-gap round", "Repeat Standard until the answer looks complete"],
    ["repo-anchor-removed", "skill", "claim-provenance", "cite a resolvable `path:line` anchor from current bytes.", "mention a likely repository file."],
    ["claim-status-removed", "agent", "claim-provenance", "and `confirmed | inferred | unresolved`.", "and a confidence adjective."],
    ["mirrors-count-independent", "skill", "contradiction-and-ranking", "Do not inflate source counts", "Inflate source counts"],
    ["winner-without-fit", "skill", "contradiction-and-ranking", "rank only viable options", "rank every option"],
    ["delegation-mandatory", "skill", "delegation-fallback", "Use delegated researchers only as optional acceleration", "Delegation is required"],
    ["fallback-lowers-bar", "skill", "delegation-fallback", "research sequentially with the same evidence bar.", "answer from memory with a lower evidence bar."],
    ["chat-default-removed", "skill", "persistence-authority", "Default to a concise answer in chat.", "Always save before answering."],
    ["shared-archive-restored", "skill", "persistence-authority", "Do not create a Spec or `_shared` archive merely to save an answer.", "Create `_shared` for every answer."],
    ["agent-writes-report", "agent", "persistence-authority", "do not implement code,", "do not implement code; write the report and update task state;"],
    ["template-reorders-heading", "template", "legacy-template", "## Decision", "## Conclusion"],
    ["live-proof-promoted", "skill", "proof-boundary", "presents source/installed evidence as live-system proof.", "treats installed text as verified live behavior."],
    ["additive-delegation-override", "skill", "delegation-fallback", "## 4. Synthesize", "Every research request requires a delegated researcher.\n\n## 4. Synthesize"],
    ["additive-persistence-override", "skill", "persistence-authority", "## Handoff boundary", "Persist every answer before returning chat output.\n\n## Handoff boundary"],
    ["additive-deep-skip", "skill", "contradiction-and-ranking", "## 3. Gather evidence", "Deep may skip the contradiction-and-gap round when time constrained.\n\n## 3. Gather evidence"],
    ["additive-provenance-omission", "skill", "claim-provenance", "## 4. Synthesize", "Material claims may omit date or status when the source looks official.\n\n## 4. Synthesize"],
    ["additive-live-promotion", "skill", "proof-boundary", "## Handoff boundary", "Installed evidence may be treated as live proof.\n\n## Handoff boundary"],
  ];
  for (const [name, source, expectedIssue, from, to] of mutations) {
    const changed = { ...baseline, [source]: replaceResearchClauseOnce(baseline[source], from, to) };
    const issues = researchAdaptiveContractIssues(changed);
    if (!issues.includes(expectedIssue)) {
      throw new Error(`[FAIL] Research adaptive mutation ${name} missed ${expectedIssue}: ${issues.join(", ")}`);
    }
  }
  console.log("✔ cf:research adaptive evidence contract is complete and bounded");
  console.log(`✔ cf:research checker rejects semantic weakenings; count=${mutations.length}`);
  return mutations.length + 1;
}

const ROUTE_CONTRACT_PATHS = {
  skill: "src/claude/skills/route/SKILL.md",
  taxonomy: "src/claude/skills/route/references/task-taxonomy.md",
  chaining: "src/claude/skills/route/references/chaining-patterns.md",
  timing: "src/claude/skills/route/references/agent-timing.md",
};

function routeContractIssues(input) {
  const expectedKeys = Object.keys(ROUTE_CONTRACT_PATHS).sort();
  const actualKeys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
    || actualKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("route checker expects exactly four UTF-8 source strings");
  }

  const issues = new Set();
  const normalized = Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key, normalizeMarkdownWhitespace(value),
  ]));
  const requireClauses = (issue, clausesBySource) => {
    const missing = Object.entries(clausesBySource).some(([source, clauses]) =>
      clauses.some((clause) => !normalized[source].includes(normalizeMarkdownWhitespace(clause))));
    if (missing) issues.add(issue);
  };

  requireClauses("direct-path", { skill: [
    "when the user names a valid installed skill, invoke that skill directly",
    "when exactly one installed skill clearly covers a low-risk request, use it directly without constructing a chain.",
    "Do not create a route chain or spawn agents merely to answer it.",
  ] });
  requireClauses("classification", { skill: [
    "Record exactly one class based on the final deliverable",
    "size (`trivial | standard | epic`)",
    "the highest-link risk (`low | elevated | high`)",
    "the number of material domains.",
  ], taxonomy: [
    "Classify by the final deliverable the user expects",
    "Risk is the maximum risk of any retained link, never an average",
    "Count only material domains that need distinct evidence or ownership.",
  ] });
  requireClauses("installed-only", { skill: [
    "Use the runtime's live installed skill and agent catalogs.",
    "Never synthesize a skill, agent, command, or optional bundle",
    "Name the gap; do not invent a substitute with broader authority.",
  ], timing: [
    "If the preferred agent is absent, do the work inline when safe or name the gap and stop; never synthesize a role",
  ] });
  requireClauses("link-contract", { chaining: [
    "**Entry:** the evidence or artifact required to start.",
    "**Exit:** one observable artifact or decision passed forward.",
    "**Owner:** exactly one installed skill, installed agent, or the controller.",
  ] });
  requireClauses("collapse-and-insertion", { skill: [
    "remove every link whose output is already evidenced",
  ], chaining: [
    "Remove a link when its exit is already current and evidenced.",
    "Insert a link only for a real modifier:",
  ] });
  requireClauses("failure-stop", { chaining: [
    "preserve its valid exit evidence, normalize the root cause, and choose one bounded detour that can change that cause.",
    "Track the failure key as `(link, owner, normalized cause)` within the current chain.",
    "Two failures with the same failure key stop the chain",
    "Different normalized causes do not share a key",
    "does not replace a separate orchestrator's authoritative task-retry budget.",
  ] });
  requireClauses("delegation-contract", { timing: [
    "Delegation is optional acceleration, not a mandatory stage.",
    "Every delegated link receives exactly these seven fields:",
    "**Outcome** — observable result.",
    "**Scope** — owned files, systems, or questions.",
    "**Inputs** — current evidence and prerequisite artifacts.",
    "**Constraints** — safety, compatibility, authority, and non-goals.",
    "**Acceptance** — proof required for completion.",
    "**Handoff** — expected returned artifact and destination.",
    "**Status vocabulary** — `DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`.",
    "Parallel delegates require disjoint write ownership",
    "`DONE`: validate the exit artifact, then advance.",
    "`DONE_WITH_CONCERNS`: resolve correctness or scope concerns before advancing",
    "`BLOCKED`: change evidence, owner, scope, or dependency before retrying.",
    "`NEEDS_CONTEXT`: supply the missing bounded context before retrying.",
    "Never blindly retry `BLOCKED` or `NEEDS_CONTEXT`.",
  ] });
  requireClauses("authority", { skill: [
    "The route may narrow user authority but never expand it.",
    "diagnosis does not authorize repair",
    "implementation does not authorize commit, push, deploy, publish, or release",
  ], taxonomy: [
    "Modifiers constrain a route. They never grant mutation, external-action, commit, push, deploy, publish, or release authority.",
  ], chaining: [
    "review cannot imply push, diagnosis cannot imply repair, and build cannot imply deploy.",
  ] });
  requireClauses("risk-gates", { skill: [
    "`elevated`: add explicit verification appropriate to the changed surface.",
    "`high`: require independent review and user confirmation before advancing past the high-risk gate.",
    "obtain that confirmation immediately before the action.",
  ] });
  requireClauses("proof-boundary", { skill: [
    "live-model adherence. That behavior remains `[UNPROVEN]` until a separate host run observes it.",
  ] });

  const corpus = Object.values(normalized).join(" ").toLowerCase();
  const issueIf = (issue, pattern) => { if (pattern.test(corpus)) issues.add(issue); };
  issueIf("installed-only", /(?:always|must).{0,30}invoke.{0,30}cf:(?:docs|docx|pdf|pptx|xlsx|ai-multimodal).{0,40}(?:even when|if).{0,20}(?:absent|not installed|unavailable)/);
  issueIf("installed-only", /(?:missing|absent|unavailable) agent.{0,50}(?:may|can|should).{0,30}(?:be synthesized|be invented|be assumed)/);
  issueIf("delegation-contract", /(?:always|may|can|should).{0,20}(?:blindly )?retry.{0,20}(?:blocked|needs_context).{0,40}(?:without change|unchanged|identical)|(?:^|[.!?]\s+)retry (?:a )?(?:blocked|needs_context) result once with identical inputs/);
  issueIf("authority", /(?:review|diagnosis|implementation|build)(?:(?!\b(?:never|not|cannot|can't)\b).){0,40}(?:authorizes|implies|grants|permits|allows).{0,30}(?:push|repair|deploy|publish|release)/);
  issueIf("classification", /(?:use|calculate|set).{0,20}(?:the )?(?:average|mean).{0,20}(?:link )?risk|risk is averaged/);
  issueIf("failure-stop", /different normalized causes share (?:a|the same) key/);
  issueIf("failure-stop", /same failure key.{0,40}(?:may|can|should).{0,20}(?:retry forever|continue indefinitely|loop)/);
  issueIf("proof-boundary", /live-model adherence.{0,30}(?:is|becomes) `?\[?(?:verified|proven)/);

  return [...issues].sort();
}

function replaceRouteClauseOnce(content, from, to) {
  const first = content.indexOf(from);
  if (first < 0 || content.indexOf(from, first + from.length) >= 0) {
    throw new Error(`route mutation anchor must occur exactly once: ${from}`);
  }
  return `${content.slice(0, first)}${to}${content.slice(first + from.length)}`;
}

function routingRuleIssues(input) {
  const expectedKeys = ["domain", "workflow"];
  const actualKeys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
    || actualKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("routing rule checker expects workflow and domain source strings");
  }

  const workflow = normalizeMarkdownWhitespace(input.workflow);
  const domain = normalizeMarkdownWhitespace(input.domain);
  const issues = new Set();
  const requireAll = (issue, content, clauses) => {
    if (clauses.some((clause) => !content.includes(normalizeMarkdownWhitespace(clause)))) {
      issues.add(issue);
    }
  };

  requireAll("proportional-direct", workflow, [
    "If the user names a valid installed skill, use it directly",
    "If one obvious low-risk installed skill covers the intent, use it directly",
    "do not invoke Route or agents for ceremony",
    "ambiguous, multi-step, multi-domain, or elevated/high-risk work",
  ]);
  requireAll("live-catalog", workflow, [
    "Resolve every abstract link against the current runtime catalog",
    "An absent, invalid, folder-mismatched, duplicate, or retired entry is not routable",
  ]);
  requireAll("authority", workflow, [
    "Diagnosis does not authorize repair",
    "implementation does not authorize commit, push, deploy, publish, or release",
    "no route expands the user's existing authority",
  ]);
  requireAll("installed-only", domain, [
    "examples below are intent hints, not a copied installed inventory",
    "document/artifact work | use only a matching installed optional capability",
    "Never infer an optional document capability from this rule",
  ]);
  requireAll("duplicate", domain, [
    "If multiple catalog entries expose the same public identity, do not auto-route; require explicit user disambiguation",
  ]);

  const corpus = `${workflow} ${domain}`.toLowerCase();
  const issueIf = (issue, pattern) => { if (pattern.test(corpus)) issues.add(issue); };
  issueIf("proportional-direct", /always invoke route for explicit installed skills[^.]*obvious low-risk[^.]*factual/);
  issueIf("live-catalog", /(?<!never )treat examples as installed inventory/);
  issueIf("authority", /(?<!no )(?:live catalog|route)(?:(?!\b(?:never|not|cannot|can't)\b).){0,40}(?:grants|expands)(?:(?!\b(?:no|never|not|cannot|can't)\b).){0,30}(?:mutation|delivery|user )?authority/);
  issueIf("installed-only", /(?<!never )invoke (?:the )?(?:docs|document) capability even when (?:absent|not installed|unavailable)/);
  issueIf("duplicate", /(?<!never )automatically (?:choose|select|route to) the first duplicate/);

  return [...issues].sort();
}

async function runRouteContractTests() {
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(ROUTE_CONTRACT_PATHS).map(async ([key, relativePath]) => [
      key, await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const baselineIssues = routeContractIssues(baseline);
  if (baselineIssues.length > 0) {
    throw new Error(`[FAIL] Route contract: intact sources returned ${baselineIssues.join(", ")}`);
  }

  const safeStrengthenings = [
    {
      source: "chaining",
      from: "## Failure detours and stop",
      to: "A successful review never permits push when local.\n\n## Failure detours and stop",
    },
    {
      source: "timing",
      from: "## Status handling",
      to: "Never retry a BLOCKED result once with identical inputs.\n\n## Status handling",
    },
  ];
  for (const strengthening of safeStrengthenings) {
    const changed = {
      ...baseline,
      [strengthening.source]: replaceRouteClauseOnce(
        baseline[strengthening.source], strengthening.from, strengthening.to,
      ),
    };
    const issues = routeContractIssues(changed);
    if (issues.length > 0) {
      throw new Error(`[FAIL] Route safe strengthening returned ${issues.join(", ")}`);
    }
  }

  const mutations = [
    ["named-skill-reclassified", "skill", "direct-path", "invoke that skill directly", "reclassify that skill through Route"],
    ["obvious-intent-chained", "skill", "direct-path", "use it directly without constructing a chain.", "construct a full chain before using it."],
    ["factual-answer-spawns-agents", "skill", "direct-path", "Do not create a route chain or spawn agents merely to answer it.", "Spawn agents and create a route chain before answering it."],
    ["terminal-class-removed", "taxonomy", "classification", "Classify by the final deliverable the user expects", "Classify by the first verb the user writes"],
    ["risk-averaged-down", "taxonomy", "classification", "Risk is the maximum risk of any retained link, never an average", "Risk is the average link risk"],
    ["domain-count-removed", "skill", "classification", "the number of material domains.", "the broad topic label."],
    ["absent-docs-invoked", "skill", "installed-only", "## 3. Compose the shortest valid chain", "Always invoke cf:docs even when it is not installed.\n\n## 3. Compose the shortest valid chain"],
    ["link-owner-optional", "chaining", "link-contract", "**Owner:** exactly one installed skill, installed agent, or the controller.", "**Owner:** any number of possible skills or agents."],
    ["collapse-removed", "chaining", "collapse-and-insertion", "Remove a link when its exit is already current and evidenced.", "Keep every link even when its exit is already evidenced."],
    ["bounded-detour-removed", "chaining", "failure-stop", "preserve its valid exit evidence, normalize the root cause,\nand choose one bounded detour that can change that cause.", "discard prior evidence and retry the same action."],
    ["same-key-loops", "chaining", "failure-stop", "Two failures with the same failure key stop the chain", "Two failures with the same failure key may retry forever and do not stop the chain"],
    ["different-causes-conflated", "chaining", "failure-stop", "Different normalized causes do\nnot share a key", "Different normalized causes share the same key"],
    ["brief-drops-status", "timing", "delegation-contract", "**Status vocabulary** — `DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`.", "**Status** — any free-form completion message."],
    ["brief-drops-outcome", "timing", "delegation-contract", "**Outcome** — observable result.", "**Topic** — broad area of interest."],
    ["done-with-concerns-auto-advances", "timing", "delegation-contract", "`DONE_WITH_CONCERNS`: resolve correctness or scope concerns before advancing;", "`DONE_WITH_CONCERNS`: advance without resolving correctness or scope concerns;"],
    ["missing-agent-synthesized", "timing", "installed-only", "never synthesize a role or pretend delegation occurred.", "a missing agent may be synthesized and treated as delegated."],
    ["blocked-blind-retry", "timing", "delegation-contract", "Never blindly retry `BLOCKED` or `NEEDS_CONTEXT`.", "Always blindly retry BLOCKED without change."],
    ["review-authorizes-push", "chaining", "authority", "review cannot imply push", "review authorizes push"],
    ["additive-review-permits-push", "chaining", "authority", "## Failure detours and stop", "A successful review permits push when local.\n\n## Failure detours and stop"],
    ["additive-blocked-identical-retry", "timing", "delegation-contract", "## Status handling", "Retry a BLOCKED result once with identical inputs.\n\n## Status handling"],
    ["high-risk-skips-review", "skill", "risk-gates", "require independent review and user confirmation", "skip independent review and user confirmation"],
    ["live-adherence-promoted", "skill", "proof-boundary", "remains `[UNPROVEN]`", "is `[VERIFIED]`"],
  ];
  for (const [name, source, expectedIssue, from, to] of mutations) {
    const changed = { ...baseline, [source]: replaceRouteClauseOnce(baseline[source], from, to) };
    const issues = routeContractIssues(changed);
    if (JSON.stringify(issues) !== JSON.stringify([expectedIssue])) {
      throw new Error(`[FAIL] Route mutation ${name} expected only ${expectedIssue}: ${issues.join(", ")}`);
    }
  }

  const routingRules = {
    workflow: await readFile(join(packageRoot, "src/claude/rules/skill-workflow-routing.md"), "utf8"),
    domain: await readFile(join(packageRoot, "src/claude/rules/skill-domain-routing.md"), "utf8"),
  };
  const ruleIssues = routingRuleIssues(routingRules);
  if (ruleIssues.length > 0) {
    throw new Error(`[FAIL] Route rules: intact sources returned ${ruleIssues.join(", ")}`);
  }
  const safeRuleControls = [
    ["domain", "\nNever treat examples as installed inventory.\n"],
    ["domain", "\nNever invoke the Docs capability even when absent.\n"],
    ["domain", "\nNever automatically choose the first duplicate.\n"],
    ["workflow", "\nA route grants no mutation or delivery authority.\n"],
  ];
  for (const [source, addition] of safeRuleControls) {
    const changed = { ...routingRules, [source]: `${routingRules[source]}${addition}` };
    const issues = routingRuleIssues(changed);
    if (issues.length > 0) {
      throw new Error(`[FAIL] Route rule safe control returned ${issues.join(", ")}`);
    }
  }
  const ruleMutations = [
    ["workflow", "proportional-direct", "\nOverride: always invoke Route for explicit installed skills, obvious low-risk intents, and factual conversation.\n"],
    ["workflow", "authority", "\nOverride: the live catalog grants mutation and delivery authority.\n"],
    ["domain", "live-catalog", "\nOverride: treat examples as installed inventory.\n"],
    ["domain", "installed-only", "\nOverride: invoke the Docs capability even when absent.\n"],
    ["domain", "duplicate", "\nOverride: automatically choose the first duplicate.\n"],
  ];
  for (const [source, expectedIssue, addition] of ruleMutations) {
    const changed = { ...routingRules, [source]: `${routingRules[source]}${addition}` };
    const issues = routingRuleIssues(changed);
    if (JSON.stringify(issues) !== JSON.stringify([expectedIssue])) {
      throw new Error(`[FAIL] Route rule mutation expected only ${expectedIssue}: ${issues.join(", ")}`);
    }
  }

  console.log("✔ cf:route proportional installed-capability contract is complete and bounded");
  console.log("✔ cf:route checker rejects semantic routing weakenings");
  return mutations.length + safeStrengthenings.length + ruleMutations.length
    + safeRuleControls.length + 2;
}

const LOOP_BOUNDED_PATHS = {
  skill: "src/claude/skills/loop/SKILL.md",
  protocol: "src/claude/skills/loop/references/bounded-loop-protocol.md",
  metric: "src/claude/skills/loop/references/metric-and-guard-contract.md",
};

function loopBoundedContractIssues(input) {
  const expectedKeys = Object.keys(LOOP_BOUNDED_PATHS).sort();
  const actualKeys = input && typeof input === "object" && !Array.isArray(input)
    ? Object.keys(input).sort()
    : [];
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
    || actualKeys.some((key) => typeof input[key] !== "string")) {
    throw new TypeError("loop bounded checker expects exactly three UTF-8 source strings");
  }
  const issues = new Set();
  const normalized = Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key, normalizeMarkdownWhitespace(value),
  ]));
  const requireClauses = (issue, clausesBySource) => {
    const missing = Object.entries(clausesBySource).some(([source, clauses]) =>
      clauses.some((clause) => !normalized[source].includes(normalizeMarkdownWhitespace(clause))));
    if (missing) issues.add(issue);
  };

  requireClauses("explicit-preflight", { skill: [
    "Loop is explicit-only. Never auto-route ordinary implementation, debugging, or research into Loop.",
    "freeze every field before any worktree, process, patch, or file mutation",
    "Reject dirty in-scope state; record but never import or clean out-of-scope dirt.",
    "Frozen positive iteration and wall-clock budgets; explicit success, no-improvement, drift, failure, timeout, and cancellation stops.",
    "Unique run identity, exact disposable root, ownership marker, upfront cleanup consent, handoff mode/destination, retention, and cleanup owner.",
    "Missing, ambiguous, unsafe, or non-reproducible input returns `BLOCKED` without mutation.",
  ] });
  requireClauses("metric-semantics", { metric: [
    "`sample_count`: integer at least 3, identical for baseline and candidates.",
    "`numeric_format`: exactly IEEE-754 binary64, roundTiesToEven after every operation, with negative zero normalized to positive zero.",
    "Each successful sample must emit exactly one trimmed UTF-8 line matching",
    "Reject empty, multi-line, multi-value, `NaN`, `Infinity`, unit-suffixed, nonzero exit, signaled, or timed-out output.",
    "Reject a decimal with a nonzero significand when binary64 parsing underflows it to zero.",
    "Calculate noise as the maximum absolute distance from that median.",
    "required_delta = max(minimum_delta, best_noise + candidate_noise)",
    "Accept only when `improvement > required_delta`",
    "Equality is not an improvement.",
    "use `lower + (upper - lower) / 2` when both have the same sign",
    "otherwise use `lower / 2 + upper / 2`.",
    "require median, noise, improvement, and required delta to remain finite.",
    "A failed sample rejects the candidate rather than being dropped from aggregation.",
  ] });
  requireClauses("guard-independence", { skill: [
    "Distinct immutable Guard argv and timeout for code mutation.",
    "Do not edit Metric, Guard, tests, benchmarks, datasets, budgets, or thresholds to win",
  ], metric: [
    "Guard is mandatory, fixed before baseline, and distinct from Metric.",
    "A second invocation of Metric, a threshold over the same output, or an oracle the loop may edit is not an independent Guard.",
    "Run Guard after Metric on the identical candidate fingerprint.",
  ] });
  requireClauses("command-boundary", { skill: [
    "The safety boundary is cooperative: commands must already be trusted by the user or repository.",
    "No instruction-only workflow can contain a malicious executable without an OS sandbox.",
    "Screen each trusted command as an argv vector and run it with `cwd` fixed to the canonical detached root.",
    "The executable is a separately approved external realpath; only path-valued target arguments must resolve inside the detached root.",
    "Never use `eval`, `sh -c`, `bash -c`, `zsh -c`, `cmd /c`, PowerShell `-Command`",
  ], protocol: [
    "Refuse general shell evaluation, inline code flags, Git external targeting",
    "Do not apply the target-path rule to the separately approved executable itself.",
    "This screening reduces mistakes; it cannot contain arbitrary side effects from a malicious or compromised executable.",
  ] });
  requireClauses("worktree-isolation", { skill: [
    "add a detached Git worktree at the pinned OID.",
    "Do not create a branch or commit.",
    "primary worktree bytes, index, branch, and refs remain untouched.",
    "Create a fresh unique detached worktree from pinned base and apply only the accepted-best patch",
    "Make exactly one bounded hypothesis change inside Scope. Multiple unrelated changes are forbidden.",
  ], protocol: [
    "Reject any dirty path that is inside Scope; never import, stash, clean, or overwrite primary dirt.",
    "use `git worktree add --detach`",
    "Do not use `-b`, create refs, or commit.",
    "Every later path must be a lexical and canonical descendant of the owned root.",
    "Parallel iterations are forbidden: one run, one lock, one candidate at a time.",
  ] });
  requireClauses("oracle-drift", { skill: [
    "Capture the complete detached-worktree tracked/untracked manifest before and after every Metric and Guard run",
    "Any other oracle mutation is drift.",
  ], protocol: [
    "Capture the complete detached-worktree tracked/untracked fingerprint around every Metric and Guard command.",
    "every other oracle-created file or byte/mode/type/path change, inside or outside Scope, rejects the candidate as drift.",
  ] });
  requireClauses("process-and-cleanup", { skill: [
    "Launch every command in an isolated process group on POSIX or Job Object on Windows.",
    "If the runtime cannot terminate the whole process tree, refuse to run.",
    "If descendants, path ownership, or cleanup is uncertain, retain exact residue and return `BLOCKED`",
    "never use `git reset --hard`, `git clean`, broad deletion, or unrelated recovery.",
  ], protocol: [
    "terminate the whole tree, wait the frozen grace period, escalate to kill, reap, and verify no owned descendant remains.",
    "do not clean. Preserve the exact path, PID/process evidence, and ownership marker; return `BLOCKED`",
    "Never broaden a glob or follow a symlink.",
  ] });
  requireClauses("patch-handoff", { skill: [
    "a redacted tracked-text patch bound to base OID, complete scoped file manifest, and lowercase SHA-256.",
    "Use only the preflight-selected handoff mode: inline ephemeral patch, or an exact user-approved path outside the primary worktree",
    "Never apply, commit, push, merge, cherry-pick, deploy, publish, or write an artifact into the primary worktree implicitly.",
  ], protocol: [
    "Default handoff supports tracked regular UTF-8 text files only.",
    "`base_oid`;",
    "patch byte length and lowercase SHA-256",
    "creation time, retention/expiry, cleanup owner, and application authority.",
    "Never apply or commit it.",
  ] });
  requireClauses("proof-boundary", { skill: [
    "Live-agent adherence to this written contract is `[UNPROVEN]` without a host run.",
  ], protocol: [
    "Live-agent adherence remains `[UNPROVEN]` until separately observed.",
  ] });

  const corpus = Object.values(normalized).join(" ").toLowerCase();
  const issueIf = (issue, pattern) => { if (pattern.test(corpus)) issues.add(issue); };
  issueIf("explicit-preflight", /(?:loop|optimization).{0,40}(?:may|can|should).{0,30}(?:start|mutate).{0,30}(?:before|without).{0,30}preflight/);
  issueIf("explicit-preflight", /(?:iteration|wall-clock) budgets?.{0,40}(?:may|can|is allowed to).{0,30}(?:be optional|be omitted|change)/);
  issueIf("guard-independence", /guard.{0,40}(?:may|can|is allowed to).{0,35}(?:be optional|equal the metric|be edited|be skipped)/);
  issueIf("metric-semantics", /(?:nan|infinity|multi-value|failed sample).{0,50}(?:may|can).{0,30}(?:pass|be accepted|be dropped|be ignored)/);
  issueIf("metric-semantics", /derived values?.{0,40}(?:may|can).{0,30}(?:be non-finite|overflow|be stored)/);
  issueIf("metric-semantics", /numeric (?:format|representation).{0,40}(?:may|can|is allowed to).{0,25}(?:vary|be inferred|change)/);
  issueIf("command-boundary", /(?:eval|sh -c|bash -c|git -c|--git-dir|--work-tree).{0,50}(?:may|can|is allowed to).{0,25}(?:run|target|be used)/);
  issueIf("command-boundary", /executable realpath.{0,40}(?:must|should).{0,25}(?:be|resolve).{0,20}inside the detached root/);
  issueIf("worktree-isolation", /(?:primary worktree|primary branch|dirty in-scope).{0,60}(?:may|can|is allowed to).{0,35}(?:change|be imported|be cleaned|be committed)/);
  issueIf("oracle-drift", /oracle mutation.{0,50}(?:may|can|is allowed to).{0,30}(?:pass|be kept|be ignored)/);
  issueIf("oracle-drift", /oracle mutation outside scope.{0,50}(?:may|can|is allowed to).{0,30}(?:pass|be kept|be ignored)/);
  issueIf("worktree-isolation", /multiple unrelated changes.{0,40}(?:may|can|are allowed to).{0,25}(?:be included|be kept|pass)/);
  issueIf("guard-independence", /(?:benchmarks?|datasets?).{0,40}(?:may|can|are allowed to).{0,25}(?:be edited|change between)/);
  issueIf("process-and-cleanup", /(?:surviving descendant|uncertain ownership|cleanup uncertainty).{0,60}(?:may|can|is allowed to).{0,35}(?:clean|delete|reuse|continue)/);
  issueIf("process-and-cleanup", /recovery.{0,30}(?:may|can|should).{0,20}use.{0,20}git reset --hard/);
  issueIf("patch-handoff", /(?:patch|handoff).{0,50}(?:may|can|is allowed to).{0,40}(?:omit|skip).{0,30}(?:base|manifest|sha-256|retention)/);
  issueIf("proof-boundary", /live-agent adherence.{0,30}(?:is|becomes)\s+`?\[?(?:proven|verified)\b|\[verified\]/);
  return [...issues].sort();
}

function replaceLoopClauseOnce(content, from, to) {
  const first = content.indexOf(from);
  if (first < 0 || content.indexOf(from, first + from.length) >= 0) {
    throw new Error(`loop mutation anchor must occur exactly once: ${from}`);
  }
  return `${content.slice(0, first)}${to}${content.slice(first + from.length)}`;
}

async function runLoopBoundedContractTests() {
  const baseline = Object.fromEntries(await Promise.all(
    Object.entries(LOOP_BOUNDED_PATHS).map(async ([key, relativePath]) => [
      key, await readFile(join(packageRoot, relativePath), "utf8"),
    ]),
  ));
  const baselineIssues = loopBoundedContractIssues(baseline);
  if (baselineIssues.length > 0) {
    throw new Error(`[FAIL] Loop bounded contract: intact sources returned ${baselineIssues.join(", ")}`);
  }
  const contractMedian = (lower, upper) => {
    const sameSign = (lower >= 0 && upper >= 0) || (lower <= 0 && upper <= 0);
    const value = sameSign
      ? lower + ((upper - lower) / 2)
      : (lower / 2) + (upper / 2);
    return Object.is(value, -0) ? 0 : value;
  };
  if (contractMedian(Number.MIN_VALUE, Number.MIN_VALUE) !== Number.MIN_VALUE) {
    throw new Error("[FAIL] Loop bounded contract: smallest-subnormal median underflowed");
  }
  if (!Number.isFinite(contractMedian(Number.MAX_VALUE, Number.MAX_VALUE))) {
    throw new Error("[FAIL] Loop bounded contract: maximum-finite median overflowed");
  }
  const metricSamplePattern = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
  for (const sample of ["0", "1.25", "-3", "5e-324", "1E+9"]) {
    if (!metricSamplePattern.test(sample) || !Number.isFinite(Number(sample))) {
      throw new Error(`[FAIL] Loop bounded contract: valid finite sample rejected: ${sample}`);
    }
  }
  for (const sample of ["", "NaN", "Infinity", "1 ms", "1\n2"]) {
    if (metricSamplePattern.test(sample)) {
      throw new Error(`[FAIL] Loop bounded contract: invalid sample accepted: ${sample}`);
    }
  }
  const mutations = [
    ["preflight-optional", "skill", "explicit-preflight", "freeze every field before any", "freeze fields after the first"],
    ["dirty-scope-import", "protocol", "worktree-isolation", "never import, stash, clean, or overwrite primary dirt.", "import dirty in-scope bytes into the experiment."],
    ["branch-worktree", "protocol", "worktree-isolation", "use `git worktree add --detach`", "use `git worktree add -b loop-result`"],
    ["guard-optional", "metric", "guard-independence", "Guard is mandatory,", "Guard may be optional or equal the Metric;"],
    ["sample-count-one", "metric", "metric-semantics", "integer at least 3", "integer at least 1"],
    ["threshold-equality", "metric", "metric-semantics", "improvement > required_delta", "improvement >= required_delta"],
    ["failed-sample-dropped", "metric", "metric-semantics", "A failed sample rejects the candidate", "A failed sample may be dropped"],
    ["oracle-mutation-accepted", "skill", "oracle-drift", "Any other oracle mutation is drift.", "Oracle mutation may be ignored."],
    ["shell-eval-enabled", "skill", "command-boundary", "Never use `eval`", "You may use `eval`"],
    ["primary-commit-enabled", "skill", "patch-handoff", "Never apply, commit, push, merge, cherry-pick, deploy, publish", "You may apply, commit, push, merge, cherry-pick, deploy, publish"],
    ["descendant-cleanup", "skill", "process-and-cleanup", "retain exact residue and return `BLOCKED`", "delete the path and continue"],
    ["reset-hard-recovery", "protocol", "process-and-cleanup", "No `git reset --hard`", "Recovery may use `git reset --hard`"],
    ["handoff-drops-base", "protocol", "patch-handoff", "`base_oid`;", "optional note;"],
    ["live-proof-promoted", "skill", "proof-boundary", "`[UNPROVEN]`", "`[VERIFIED]`"],
    ["additive-guard-exception", "metric", "guard-independence", "## Reproducibility and drift", "Guard may be skipped for a promising candidate.\n\n## Reproducibility and drift"],
    ["additive-primary-mutation", "skill", "worktree-isolation", "## 4. Failure and process ownership", "The primary worktree may be changed after a metric win.\n\n## 4. Failure and process ownership"],
    ["additive-shell-exception", "protocol", "command-boundary", "## Iteration lifecycle", "Bash -c may be used for complex metrics.\n\n## Iteration lifecycle"],
    ["additive-uncertain-cleanup", "protocol", "process-and-cleanup", "## Patch handoff", "Uncertain ownership may be cleaned to save disk space.\n\n## Patch handoff"],
    ["additive-incomplete-patch", "protocol", "patch-handoff", "## Patch handoff", "Patch handoff may omit the base OID or SHA-256.\n\n## Patch handoff"],
    ["one-change-removed", "skill", "worktree-isolation", "Make exactly one bounded hypothesis change", "Make any number of unrelated changes"],
    ["additive-multiple-changes", "protocol", "worktree-isolation", "## Process-tree timeout and cancellation", "Multiple unrelated changes may be included in one candidate.\n\n## Process-tree timeout and cancellation"],
    ["additive-budget-optional", "skill", "explicit-preflight", "## 2. Establish isolation and baseline", "Iteration and wall-clock budgets may be omitted.\n\n## 2. Establish isolation and baseline"],
    ["additive-benchmark-edit", "skill", "guard-independence", "## 4. Failure and process ownership", "Benchmarks may be edited between iterations.\n\n## 4. Failure and process ownership"],
    ["additive-outside-scope-oracle-write", "protocol", "oracle-drift", "## Process-tree timeout and cancellation", "Oracle mutation outside Scope may be ignored.\n\n## Process-tree timeout and cancellation"],
    ["executable-forced-inside-root", "protocol", "command-boundary", "Do not apply the target-path rule", "The executable realpath must resolve inside the detached root; do not apply the target-path rule"],
    ["additive-derived-overflow", "metric", "metric-semantics", "## Guard independence", "Derived values may be non-finite and stored as current best.\n\n## Guard independence"],
    ["numeric-format-unfrozen", "metric", "metric-semantics", "`numeric_format`: exactly IEEE-754 binary64", "`numeric_format`: implementation-defined number"],
    ["additive-numeric-format-drift", "metric", "metric-semantics", "## Guard independence", "Numeric representation may vary between iterations.\n\n## Guard independence"],
    ["same-sign-median-regression", "metric", "metric-semantics", "use `lower + (upper - lower) / 2`", "use `lower / 2 + upper / 2`"],
    ["finite-nonzero-value-rejected", "metric", "metric-semantics", "nonzero exit", "nonzero value"],
  ];
  for (const [name, source, expectedIssue, from, to] of mutations) {
    const changed = { ...baseline, [source]: replaceLoopClauseOnce(baseline[source], from, to) };
    const issues = loopBoundedContractIssues(changed);
    if (!issues.includes(expectedIssue)) {
      throw new Error(`[FAIL] Loop bounded mutation ${name} missed ${expectedIssue}: ${issues.join(", ")}`);
    }
  }
  console.log("✔ cf:loop bounded experiment contract is complete and fail-closed");
  console.log(`✔ cf:loop checker rejects unsafe semantic weakenings; count=${mutations.length}`);
  return mutations.length + 1;
}

const PORTED_RULE_PATHS = [
  "src/claude/rules/review-audit-self-decision.md",
  "src/claude/rules/process-management.md",
];

// cf:scout is a short subroutine: callers fold its findings into their own report, the scope and
// no-scan rules stay verbatim, delegation needs the user's permission even when a host enables it,
// and the delegation procedure lives in the reference.
function validateScoutSubroutineContract(skill, reference, workflow) {
  const issues = new Set();
  const flat = normalizeMarkdownWhitespace(skill);
  const has = (clause) => flat.includes(normalizeMarkdownWhitespace(clause));
  const require = (issue, clauses) => { if (!clauses.every(has)) issues.add(issue); };
  if (skill.trimEnd().split("\n").length > 70) issues.add("scout-line-ceiling");
  require("scout-scope-gate", [
    "reject repo-root or root-wide patterns (`.`, `/`, `**/*`, `**/*.ts`) with no scoped directory",
    "never enter the no-scan lists below.",
  ]);
  require("scout-no-scan", [
    "- `.git/`, `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`",
    "- `tmp/`, `temp/`, `vendor/`, `artifacts/`, `secrets/`, `private/`",
    "- private keys, token dumps, credential exports, `.env` secrets",
    "- generated bundles, binary blobs",
  ]);
  require("scout-smallest-route", [
    "| Named files/directories or focused scope (about 50 files or fewer) | Main-agent `rg` plus targeted reads; do not delegate |",
    "| Medium scope that still fits one coherent search | Main-agent scouting; narrow before considering delegation |",
    "| Broad scope with two or more independent areas | Structure map, then the delegation gate in `./references/internal-inspection.md` |",
  ]);
  require("scout-findings-shape", [
    "Return these for the caller to fold into its own report:",
    "- **Relevant files** — each as `path:line` with one clause on why it matters.",
    "- **Entrypoint and call path** — where the behavior starts and each hop to the code in question.",
    "- **Blast radius** — callers, tests, and config that a change there would touch.",
    "- **Unknowns** — what the search could not settle, and what would settle it.",
  ]);
  require("scout-host-rule", [
    "A host or runtime mode that enables delegation on its own does not replace the user's permission;",
    "without it, scout stays in the main agent.",
  ]);
  require("scout-role-line", [
    "`inspector` and Explore are delegation targets that run under this gate and these scope rules, not a replacement for them.",
  ]);
  // The Codex projection rewrites this exact sentence, so it stays byte-for-byte.
  if (!skill.includes("**Fallback to AskUserQuestion:** if the structure map still leaves multiple\nplausible targets and the choice would materially change the scan, offer 2–4\nconcrete scopes from findings, then continue with the selected scope.")) {
    issues.add("scout-fallback-verbatim");
  }
  if (/Scout Report/.test(skill)) issues.add("scout-report-template");
  if (/3\s*min|three[- ]minutes?|3 minutes/i.test(`${skill}\n${reference}`)) issues.add("scout-timeout");
  if (/Phase 1|Phase 2|Structure Map/.test(skill)) issues.add("scout-two-phase-home");
  const flatReference = normalizeMarkdownWhitespace(reference);
  if (!reference.includes("## Two-Phase Broad Scout")
    || !flatReference.includes("return a division plan of 1–10 sub-scopes")
    || !flatReference.includes("merge sub-scopes under 10 files and split those over 100")) {
    issues.add("scout-two-phase-home");
  }
  if (!workflow.includes("- Use `cf:scout` or focused search when structure is unclear.")
    || /Use `inspect`/.test(workflow)) {
    issues.add("scout-workflow-name");
  }
  return issues;
}

async function runScoutSubroutineContractTests() {
  const fail = (message) => { throw new Error(`[FAIL] Scout subroutine contract: ${message}`); };
  const skill = await readFile(join(packageRoot, "src/claude/skills/scout/SKILL.md"), "utf8");
  const reference = await readFile(join(packageRoot, "src/claude/skills/scout/references/internal-inspection.md"), "utf8");
  const workflow = await readFile(join(packageRoot, "src/claude/rules/workflow.md"), "utf8");
  const baseline = validateScoutSubroutineContract(skill, reference, workflow);
  if (baseline.size) fail(`current text fails: ${[...baseline].join(", ")}`);
  const swap = (from, to) => (text) => {
    if (!text.includes(from)) fail(`mutation anchor missing: ${from}`);
    return text.replace(from, to);
  };
  const mutations = [
    ["drops-blast-radius", "skill", swap("- **Blast radius** — callers, tests, and config that a change there would touch.\n", ""), "scout-findings-shape"],
    ["drops-host-rule", "skill", swap("A host or runtime mode that enables delegation on its own does not replace the user's permission;", "A host mode that enables delegation counts as permission;"), "scout-host-rule"],
    ["drops-role-line", "skill", swap("`inspector` and Explore are delegation targets that run", "`inspector` and Explore may replace scout and run"), "scout-role-line"],
    ["drops-no-scan-entry", "skill", swap("`artifacts/`, `secrets/`, `private/`", "`artifacts/`, `private/`"), "scout-no-scan"],
    ["drops-route-row", "skill", swap("| Medium scope that still fits one coherent search | Main-agent scouting; narrow before considering delegation |\n", ""), "scout-smallest-route"],
    ["drops-scope-gate", "skill", swap("never enter the no-scan lists below.", "scan wherever needed."), "scout-scope-gate"],
    ["restores-report-template", "skill", (text) => `${text}\n# Scout Report\n`, "scout-report-template"],
    ["restores-timeout-skill", "skill", (text) => `${text}\n- Timeout: 3 minutes per agent\n`, "scout-timeout"],
    ["restores-timeout-reference", "reference", (text) => `${text}\n- 3 min/agent; skip non-responders\n`, "scout-timeout"],
    ["exceeds-line-ceiling", "skill", (text) => `${text}${"\nfiller".repeat(20)}\n`, "scout-line-ceiling"],
    ["moves-two-phase-out", "reference", swap("## Two-Phase Broad Scout", "## Broad Scout"), "scout-two-phase-home"],
    ["empties-two-phase", "reference", swap("division plan of 1–10 sub-scopes", "plan"), "scout-two-phase-home"],
    ["returns-phase-one-to-skill", "skill", (text) => `${text}\n### Phase 1 — Structure Map\n`, "scout-two-phase-home"],
    ["rewrites-fallback", "skill", swap("offer 2–4\nconcrete scopes from findings", "ask the user to\npick a scope"), "scout-fallback-verbatim"],
    ["restores-report-prose", "skill", (text) => `${text}\nEnd with a Scout Report.\n`, "scout-report-template"],
    ["restores-timeout-words", "skill", (text) => `${text}\n- Give each agent three minutes.\n`, "scout-timeout"],
    ["workflow-names-inspect", "workflow", swap("- Use `cf:scout` or focused search", "- Use `inspect` or focused search"), "scout-workflow-name"],
  ];
  for (const [name, source, mutate, issue] of mutations) {
    const issues = validateScoutSubroutineContract(
      source === "skill" ? mutate(skill) : skill,
      source === "reference" ? mutate(reference) : reference,
      source === "workflow" ? mutate(workflow) : workflow,
    );
    if (!issues.has(issue)) fail(`${name} did not raise ${issue}`);
  }
  return mutations.length + 1;
}

async function runStaticSemanticTests() {
  const processTaskStatusTests = await runProcessTaskStatusContractTests();
  const implementationReadinessTests = await runImplementationReadinessContractTests();
  const adaptiveCoverageTests = await runAdaptiveCoverageContractTests();
  const consumerSectionTests = await runConsumerSectionContractTests();
  const brainstormContractTests = await runBrainstormContractTests();
  const developPlanNativeTests = await runDevelopPlanNativeContractTests();
  const scoutSubroutineTests = await runScoutSubroutineContractTests();
  const testPlanNativeTests = await runTestPlanNativeContractTests();
  const debugAdaptiveTests = await runDebugAdaptiveContractTests();
  const hotfixAdaptiveTests = await runHotfixAdaptiveContractTests();
  const docsAdaptiveTests = await runDocsAdaptiveContractTests();
  const researchAdaptiveTests = await runResearchAdaptiveContractTests();
  const routeContractTests = await runRouteContractTests();
  const loopBoundedTests = await runLoopBoundedContractTests();
  const specs21Tests = await runSpecs21ContractTests();
  const specTemplateFiles = await readdir(
    join(packageRoot, "src/claude/skills/specs/templates"),
  );

  if (!specTemplateFiles.includes("spec-state.json")) {
    console.error("[FAIL] cf:specs spec-state template is missing");
    process.exit(1);
  }

  if (specTemplateFiles.includes("init.json")) {
    console.error("[FAIL] legacy cf:specs init.json template must not be packaged");
    process.exit(1);
  }

  const removedPlatformLower = "anti" + "gravity";
  const removedPlatformTitle = "Anti" + "gravity";

  if (await fileExists(join(packageRoot, "src", removedPlatformLower, "GEMINI.md"))) {
    console.error("[FAIL] legacy secondary platform bundle must not be packaged");
    process.exit(1);
  }

  const checks = [
    {
      label: "cf:specs hard output contract requires the flat packet",
      file: "src/claude/skills/specs/SKILL.md",
      assert: (content) =>
        content.includes("## Primary output layout") &&
        content.includes("specs/<feature>/") &&
        content.includes("Task files are flat beside `plan.md`") &&
        content.includes("Do not create a nested task directory"),
    },
    {
      label: "spec-maker emits only the flat planning packet",
      file: "src/claude/agents/spec-maker.md",
      assert: (content) =>
        content.includes("### 3. Author the flat packet") &&
        content.includes("specs/<feature>/plan.md") &&
        content.includes("Do not create implementation files, receipts, approval records") &&
        content.includes("Keep every new\ntask `Status: blocked` while GATE-REVIEW is open"),
    },
    {
      label: "installer syncs spec-state template and drops init template",
      file: "bin/phases/copy-payload.js",
      assert: (content) =>
        content.includes("'spec-state.json'") &&
        content.includes("Removed legacy template") &&
        !content.includes("'init.json',"),
    },
    {
      label: "installer writes CafeKit version metadata",
      files: ["bin/phases/write-metadata.js", "bin/phases/summary.js", "bin/lib/context.js", "bin/lib/i18n.js"],
      assert: (content) =>
        content.includes("cafekit.json") &&
        content.includes("writePlatformVersionMetadata") &&
        content.includes("previousVersion") &&
        content.includes("CafeKit Version") &&
        content.includes("const INSTALL_COMMAND = `npx ${packageJson.name}@${packageJson.version}`"),
    },
    {
      label: "installer offers Codex as a native split-root runtime",
      files: [
        "bin/lib/context.js",
        "bin/phases/copy-payload.js",
        "bin/phases/codex-runtime.js",
        "bin/lib/codex-install.js",
      ],
      assert: (content) =>
        content.includes("id: 'codex'") &&
        content.includes("skillsDir: '.agents/skills'") &&
        content.includes("agentsDir: '.codex/agents'") &&
        content.includes("installCodexRuntime") &&
        content.includes("convertCodexAgentContent") &&
        content.includes("fork_turns=\"none\"") &&
        !content.includes("config.toml"),
    },
    {
      label: "Codex split roots keep generated skill files locally ignored",
      files: [
        "src/codex/gitignore",
        "src/codex/agents-gitignore",
        "bin/phases/codex-runtime.js",
        "bin/phases/root-config.js",
      ],
      assert: (content) =>
        content.includes("path.join('.agents', '.gitignore')") &&
        content.includes("skills/**/.venv/") &&
        content.includes("skills/**/node_modules/") &&
        content.includes("!skills/**/.env.example") &&
        content.includes("'.agents/'") &&
        !content.includes("../.agents/skills"),
    },
    {
      label: "installer maps Claude gitignore template to dotfile",
      file: "bin/phases/claude-runtime.js",
      assert: (content) =>
        content.includes("relPath === 'gitignore' ? '.gitignore' : relPath"),
    },
    {
      label: "Claude migration manifest includes gitignore template",
      file: "src/claude/migration-manifest.json",
      assert: (content) => content.includes('"gitignore"'),
    },
    {
      label: "Claude gitignore template ignores generated session state",
      file: "src/claude/gitignore",
      assert: (content) =>
        content.includes("session-state/") &&
        content.includes("hooks/.logs/") &&
        content.includes("plugins/.logs/") &&
        content.includes("skills/**/node_modules/") &&
        content.includes("skills/**/.venv/") &&
        content.includes(".cafekit-update-cache.json"),
    },
    {
      label: "installer root gitignore ignores runtime folders",
      file: "bin/phases/root-config.js",
      assert: (content) =>
        content.includes("'plans/*'") &&
        content.includes("'!plans/*.md'") &&
        content.includes("'!plans/templates/'") &&
        content.includes("'!plans/templates/**'") &&
        content.includes("'.claude/'") &&
        content.includes("'.codex/'") &&
        content.includes("'.agents/'") &&
        content.includes("'.cafekit-backup/'") &&
        content.includes("'.cafekit.lock'") &&
        content.includes("function hasPattern"),
    },
    {
      label: "cf:specs and spec-maker never auto-dispatch Develop",
      files: [
        "src/claude/skills/specs/SKILL.md",
        "src/claude/agents/spec-maker.md",
      ],
      assert: (content) =>
        content.includes("does not authorize work") &&
        content.includes("Do not start Develop") &&
        !content.includes("ready_for_implementation"),
    },
    {
      label: "cf:specs frontmatter exposes only feature-description input",
      file: "src/claude/skills/specs/SKILL.md",
      assert: (content) =>
        /^name:\s*cf:specs$/m.test(content) &&
        /^description:\s*\S.+$/m.test(content) &&
        /^argument-hint:\s*["']<feature-description>["']$/m.test(content) &&
        !/--(?:status|validate|archive)/.test(content),
    },
    {
      label: "spec-maker emits a flat packet and stops at handoff",
      file: "src/claude/agents/spec-maker.md",
      assert: (content) =>
        content.includes("specs/<feature>/plan.md") &&
        content.includes("task-01-<slug>.md") &&
        content.includes("`pending` means semantically ready for the dependency-aware queue") &&
        content.includes("write dependencies") &&
        content.includes("exact flat task basenames") &&
        content.includes("Do not start Develop"),
    },
    {
      label: "cf:ask skill answers questions with repo-first evidence",
      file: "src/claude/skills/ask/SKILL.md",
      assert: (content) =>
        content.includes("name: cf:ask") &&
        content.includes("Answer questions with evidence") &&
        content.includes("<ANSWER-ONLY-GATE>") &&
        content.includes("Source-first") &&
        content.includes("Use external/current sources") &&
        content.includes("Ask back only when") &&
        content.includes("--repo") &&
        content.includes("--web") &&
        content.includes("--both") &&
        content.includes("repo evidence") &&
        content.includes("external/current evidence") &&
        content.includes("when the optional document bundle is installed") &&
        content.includes("--with-document-skills") &&
        content.includes("templates/question.md"),
    },
    {
      label: "cf:ask template captures answer evidence and gaps",
      file: "src/claude/skills/ask/templates/question.md",
      assert: (content) =>
        content.includes("## Question") &&
        content.includes("## Answer") &&
        content.includes("## Evidence") &&
        content.includes("## Source Trace") &&
        content.includes("## Gaps / Unknowns") &&
        content.includes("## Follow-up Question"),
    },
    {
      label: "cf:ask is packaged from the ask directory and the question directory is retired",
      file: "src/claude/migration-manifest.json",
      assert: (content) => {
        const manifest = JSON.parse(content);
        return manifest.skills.required.includes("ask") &&
          !manifest.skills.required.includes("question") &&
          manifest.obsolete.skills.includes("question");
      },
    },
    {
      label: "cf:fix is packaged from the fix directory and the hotfix directory is retired",
      file: "src/claude/migration-manifest.json",
      assert: (content) => {
        const manifest = JSON.parse(content);
        return manifest.skills.required.includes("fix") &&
          !manifest.skills.required.includes("hotfix") &&
          manifest.obsolete.skills.includes("hotfix");
      },
    },
    {
      label: "cf:specs review requires evidence, fresh context, and bounded findings",
      file: "src/claude/skills/specs/references/review.md",
      assert: (content) =>
        content.includes("path:line") &&
        content.includes("fresh-context") &&
        /cap[\s\S]{0,80}\b15\b/i.test(content) &&
        /two[^\n]*rounds/i.test(content),
    },
    {
      label: "cf:specs review gives GATE-REVIEW ownership to the user and sweeps every edit",
      file: "src/claude/skills/specs/references/review.md",
      assert: (content) =>
        content.includes("accept, reject, or revise") &&
        content.includes("Do not apply findings before that") &&
        content.includes("consistency sweep") &&
        content.includes("Reread every file"),
    },
    {
      label: "cf:specs requirements template has no SDD phase marker",
      file: "src/claude/skills/specs/templates/requirements-init.md",
      assert: (content) => !content.includes("/sdd:"),
    },
    {
      label: "cf:specs flow is gated GATE-SCOPE to GATE-DONE and process-first",
      file: "src/claude/skills/specs/SKILL.md",
      assert: (content) =>
        ["GATE-SCOPE", "GATE-REVIEW", "GATE-DONE"].every((gate) => content.includes(gate)) &&
        content.includes("specs/<feature>/") &&
        /task-(?:NN|\d{2})-(?:\*|<slug>)\.md/.test(content) &&
        content.includes("## Receipt") &&
        !content.includes("--auto"),
    },
    {
      label: "parallel-waves reference keeps single-writer, fallback, cap, and cherry-pick recipe",
      file: "src/claude/skills/develop/references/parallel-waves.md",
      assert: (content) =>
        content.includes("one state writer") &&
        content.includes("fall back to the sequential loop") &&
        content.includes("Clamp `--parallel N` to 1..5") &&
        content.includes("base_sha") &&
        content.includes("commit_range") &&
        content.includes("git cherry-pick"),
    },
    {
      label: "develop SKILL wires --parallel to parallel-waves and keeps sequential default",
      file: "src/claude/skills/develop/SKILL.md",
      assert: (content) =>
        content.includes("--parallel") &&
        content.includes("references/parallel-waves.md") &&
        content.includes("one unblocked task at a time"),
    },
    {
      label: "implementer is single-track with process-first and legacy state prohibition",
      file: "src/claude/agents/implementer.md",
      assert: (content) =>
        content.includes("within its workspace") &&
        content.includes("Do NOT edit `plan.md`, task `Status:`, or inline `## Receipt`") &&
        content.includes("For legacy packets, do not edit\n  `spec.json`"),
    },
    {
      label: "orchestrator sanctions worktree parallelism with single-writer rule and cap",
      file: "src/claude/rules/orchestrator.md",
      assert: (content) =>
        content.includes("worktree isolation") &&
        content.includes("single writer per file per wave") &&
        content.includes("never more than 5"),
    },
    {
      label: "parallel waves isolate worktrees and retain blocked recovery state",
      file: "src/claude/skills/develop/references/parallel-waves.md",
      assert: (content) =>
        content.includes("isolated worktree") &&
        content.includes("keeps its identifiable worktree and branch") &&
        content.includes("Never\nforce-delete"),
    },
    {
      label: "runtime template documents develop.parallel escape hatch",
      file: "src/claude/runtime.json",
      assert: (content) => content.includes('"develop"') && content.includes('"parallel": true'),
    },
    {
      label: "cf:specs templates trace acceptance criteria to flat tasks and proof",
      file: "src/claude/skills/specs/references/templates.md",
      assert: (content) =>
        content.includes("| ID | EARS criterion | Proof |") &&
        content.includes("| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |") &&
        content.includes("task-NN-<slug>.md") &&
        content.includes("## Verification Plan"),
    },
    {
      label: "cf:specs plan template carries the queue-ready contract marker on line two",
      file: "src/claude/skills/specs/references/templates.md",
      assert: (content) => /^# <Feature name>\nSpecs-Contract: process-first-ready-v1$/m.test(content),
    },
    {
      label: "cf:specs templates carry EARS, Example Mapping, and edge-case saturation",
      file: "src/claude/skills/specs/references/templates.md",
      assert: (content) =>
        content.includes("EARS sentence patterns") &&
        content.includes("Event-driven") &&
        content.includes("Example Mapping rule") &&
        content.includes("Twelve edge-case dimensions") &&
        content.includes("Quality and saturation checks"),
    },
    {
      label: "cf:specs keeps human decisions at exactly the three named gates",
      file: "src/claude/skills/specs/SKILL.md",
      assert: (content) =>
        content.includes("GATE-SCOPE") &&
        content.includes("GATE-REVIEW") &&
        content.includes("GATE-DONE") &&
        content.includes("Ask once at each gate") &&
        content.includes("Do not ask for routine implementation choices"),
    },
    {
      label: "legacy kernel task template keeps the Specs v2.1 plan contract",
      file: "src/claude/skills/specs/templates/task.md",
      assert: (content) =>
        content.includes("**Status:** pending") &&
        content.includes("## Outcome") &&
        content.includes("## Scope") &&
        content.includes("## Anchors and Ownership") &&
        content.includes("| ID | Type | Target | Role | Access | Action |") &&
        content.includes("## Changes") &&
        content.includes("## Acceptance") &&
        content.includes("## Dependencies") &&
        content.includes("## Verification Plan") &&
        !content.includes("## Evidence") &&
        !content.includes("## Completion Criteria"),
    },
    {
      label: "spec validator enforces Specs v2.1 task-plan sections",
      file: "src/claude/scripts/validate-spec-output.cjs",
      assert: (content) =>
        content.includes("TASK_21_SECTIONS") &&
        content.includes("Anchors and Ownership") &&
        content.includes("ID | Type | Target | Role | Access | Action") &&
        content.includes("Verification Plan requires a command-shaped invocation") &&
        content.includes("planned proof only"),
    },
    {
      label: "spec validator blocks complex ready state before validation",
      file: "src/claude/scripts/validate-spec-output.cjs",
      assert: (content) =>
        content.includes("design_context.validation_recommended") &&
        content.includes("5+ task files") &&
        content.includes("validation.status is not completed"),
    },
    {
      label: "cf:specs inline receipt is executable and provenance-bound",
      file: "src/claude/skills/specs/references/templates.md",
      assert: (content) =>
        content.includes("## Canonical inline Receipt") &&
        content.includes("Verification: PASS") &&
        content.includes("Command:") &&
        content.includes("Exit: 0") &&
        content.includes("Base:") &&
        content.includes("Head:") &&
        content.includes("```text"),
    },
    {
      label: "spec-maker separates planning from implementation and proof",
      file: "src/claude/agents/spec-maker.md",
      assert: (content) =>
        content.includes("it is not an implementation") &&
        content.includes("does not authorize work") &&
        content.includes("Do not create implementation files, receipts") &&
        content.includes("Do not start Develop"),
    },
    {
      label: "cf:develop scouts reachability and enforces task scope",
      file: "src/claude/skills/develop/SKILL.md",
      assert: (content) =>
        content.includes("### 1. Scout") &&
        content.includes("Trace entrypoints, callers, dependents") &&
        content.includes("Honor Scope, Ownership, Acceptance, and Dependencies") &&
        content.includes("feature-level integration"),
    },
    {
      label: "cf:develop supports explicit flash mode",
      file: "src/claude/skills/develop/SKILL.md",
      assert: (content) =>
        content.includes("[--flash]") &&
        content.includes("### Flash (`--flash`)") &&
        content.toLowerCase().includes("skip dedicated tests") &&
        content.includes("FLASH_UNVERIFIED") &&
        content.includes("awaiting /cf:test <feature>") &&
        content.includes("do not unblock dependents"),
    },
    {
      label: "cf:develop makes implementation notes opt-in",
      file: "src/claude/skills/develop/SKILL.md",
      assert: (content) =>
        content.includes("--notes` is opt-in") &&
        !content.includes("--no-notes") &&
        content.includes("references/implementation-notes-template.html") &&
        content.includes("scope exceptions") &&
        content.includes("Never create it by default"),
    },
    {
      label: "cf:develop implementation notes template is self-contained and block-based",
      file: "src/claude/skills/develop/references/implementation-notes-template.html",
      assert: (content) =>
        content.includes("<style>") &&
        content.includes("CafeKit Implementation Notes") &&
        content.includes("TASK_TOC_START") &&
        content.includes("NOTES_START") &&
        content.includes("task-block") &&
        content.includes("note.decision") &&
        content.includes("scope-escape") &&
        !content.includes("<script") &&
        !content.includes("https://") &&
        !content.includes("http://"),
    },
    {
      label: "cf:develop quality gate separates proof, review, and closeout owners",
      file: "src/claude/skills/develop/references/quality-gate.md",
      assert: (content) =>
        content.includes("Test owner") &&
        content.includes("Review owner") &&
        content.includes("Closeout owner") &&
        content.includes("reachability failure"),
    },
    {
      label: "cf:develop quality gate has flash bypass semantics",
      file: "src/claude/skills/develop/references/quality-gate.md",
      assert: (content) =>
        content.includes("## Flash gate") &&
        content.includes("Tests: skipped by user request") &&
        content.includes("Evidence: FLASH_UNVERIFIED") &&
        content.includes("does not write a PASS receipt") &&
        content.includes("sync-finalize"),
    },
    {
      label: "process-first Develop and Sync keep proof ownership explicit with isolated Legacy vocabulary",
      files: [
        "src/claude/skills/develop/SKILL.md",
        "src/claude/skills/sync/SKILL.md",
        "src/claude/skills/develop/references/quality-gate.md",
      ],
      assert: (content) => {
        const primary = outsideLegacySections(content);
        return content.includes("inline `## Receipt`") &&
          content.includes("Test owner") &&
          content.includes("Review owner") &&
          content.includes("Closeout owner") &&
          content.includes("Status: done") &&
        content.includes("PASS_WITH_WARNINGS") &&
          !/semantic_model|semantic-model|machine authority|task_registry|planning_depth|execution_tier|\blane\b/i.test(primary);
      },
    },
    {
      label: "cf:scout uses a focused local fast path before delegation",
      file: "src/claude/skills/scout/SKILL.md",
      assert: (content) =>
        content.includes("name: cf:scout") &&
        content.includes("about 50 files or fewer") &&
        content.includes("Main-agent `rg` plus targeted reads; do not delegate") &&
        content.includes("Do not use the file estimate alone to justify agents") &&
        !content.includes("external-gemini-inspection") &&
        !content.includes("Gemini") &&
        !content.includes("`ext`"),
    },
    {
      label: "cf:scout delegation requires permission runtime support and independent scopes",
      file: "src/claude/skills/scout/references/internal-inspection.md",
      assert: (content) =>
        content.includes("The user explicitly requested or permitted delegation or parallel agents") &&
        content.includes("The active runtime exposes an Explore/delegation capability") &&
        content.includes("at least two distinct, non-overlapping scopes") &&
        content.includes("Focused discovery stays in the main agent"),
    },
    {
      label: "quality gate uses shared verdicts instead of numeric scores",
      file: "src/claude/skills/develop/references/quality-gate.md",
      assert: (content) =>
        content.includes("PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED") &&
        content.includes("Only literal PASS") &&
        content.includes("Review depth follows risk") &&
        !/\b(?:9\.5|score\s*[><=])\b/.test(content),
    },
    {
      label: "inspect runtime config has no legacy Gemini model key",
      file: "src/claude/runtime.json",
      assert: (content) =>
        content.includes('"inspect"') &&
        !content.includes('"gemini"'),
    },
    {
      label: "hotfix review cycle consumes severity verdicts",
      file: "src/claude/skills/fix/references/review-cycle.md",
      assert: (content) =>
        content.includes("verdict and severity-classified findings") &&
        content.includes("PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED") &&
        content.includes("BLOCKED` is terminal") &&
        content.includes("Only `FAIL` and `PASS_WITH_WARNINGS` enter remediation retry") &&
        content.includes("The definition of `PASS` defers to `cf:code-review`") &&
        !content.includes("at most one Medium") &&
        !content.includes("score >= 9.0") &&
        !content.includes("critical_issues[]"),
    },
    {
      label: "code-auditor speaks the shared verdict surface",
      file: "src/claude/agents/code-auditor.md",
      assert: (content) =>
        content.includes("PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED") &&
        content.includes("The definition of `PASS` defers to `cf:code-review`") &&
        content.includes("cannot finish a task") &&
        !content.includes("at most one Medium"),
    },
    {
      label: "test-runner performs scope and runtime reachability audits",
      file: "src/claude/agents/test-runner.md",
      assert: (content) =>
        content.includes("Runtime Reachability Audit") &&
        content.includes("Scope Coverage Audit") &&
        content.includes("Runtime Reachability Missing = FAIL"),
    },
    {
      label: "cf:test supports spec-aware feature testing",
      file: "src/claude/skills/test/SKILL.md",
      assert: (content) =>
        content.includes("<SCOPE-GATE>") &&
        content.includes("/cf:test <feature-name>") &&
        content.includes("Spec-Aware Mode"),
    },
    {
      label: "cf:fix is deterministic scout-first without mode selection",
      file: "src/claude/skills/fix/SKILL.md",
      assert: (content) =>
        content.includes("Default: deterministic scout-first fix") &&
        content.includes("There is no initial mode selection step") &&
        content.includes("<HARD-GATE-SCOUT-FIRST>") &&
        !content.includes("Default: Autonomous mode"),
    },
    {
      label: "cf:fix quick path never skips scout or diagnosis",
      file: "src/claude/skills/fix/SKILL.md",
      assert: (content) =>
        content.includes("it never skips scout, pre-fix evidence, diagnosis, or before/after verification") &&
        content.includes("Quick mode only reduces depth") &&
        content.includes("Do not ask generic questions before this step"),
    },
    {
      label: "cf:fix enforces no-side-effect gate with user options",
      file: "src/claude/skills/fix/SKILL.md",
      assert: (content) =>
        content.includes("<HARD-GATE-NO-SIDE-EFFECTS>") &&
        content.includes("Public contracts are unchanged") &&
        content.includes("Revert this fix and try a different root-cause angle") &&
        content.includes("Do not silently patch around the regression"),
    },
    {
      label: "cf:fix references are local and not stale debugger paths",
      file: "src/claude/skills/fix/SKILL.md",
      assert: (content) => !content.includes("references/debugger/"),
    },
    {
      label: "cf:fix prevention gate points back to side-effect sweep",
      file: "src/claude/skills/fix/references/prevention-gate.md",
      assert: (content) =>
        content.includes("Step 5 side-effect sweep") &&
        !content.includes("references/debugger/"),
    },
    {
      label: "cf:fix review cycle uses pause conditions not mode selection",
      file: "src/claude/skills/fix/references/review-cycle.md",
      assert: (content) =>
        content.includes("## Default Review Handling") &&
        content.includes("## Required User Pause") &&
        content.includes("## When To Pause vs Continue") &&
        !content.includes("## Autonomous Mode") &&
        !content.includes("## Human-in-the-Loop Mode"),
    },
    {
      label: "cf:debug is diagnosis-only and read-only for product code",
      file: "src/claude/skills/debug/SKILL.md",
      assert: (content) =>
        content.includes("<DIAGNOSTIC-ONLY-GATE>") &&
        content.includes("`cf:debug` is read-only for product code") &&
        content.includes("Do NOT edit product code") &&
        content.includes("Temporary instrumentation is allowed only") &&
        content.includes("Temporary instrumentation: removed"),
    },
    {
      label: "cf:debug enforces scout-first before hypotheses",
      file: "src/claude/skills/debug/SKILL.md",
      assert: (content) =>
        content.includes("<HARD-GATE-SCOUT-FIRST>") &&
        content.includes("Before hypotheses, inspect the actual codebase context") &&
        content.includes("project type, language, framework, runtime, and test runner") &&
        content.includes("3-6 bullet codebase-context summary"),
    },
    {
      label: "cf:debug blocks hotfix handoff when root cause is unknown",
      file: "src/claude/skills/debug/SKILL.md",
      assert: (content) =>
        content.includes("<ROOT-CAUSE-GATE>") &&
        content.includes("Root cause: unknown") &&
        content.includes("Missing Evidence") &&
        content.includes("Next Diagnostic Action") &&
        content.includes("do not hand off to `cf:fix` as ready"),
    },
    {
      label: "cf:debug references installed debugger manuals",
      file: "src/claude/skills/debug/SKILL.md",
      assert: (content) =>
        content.includes("`.claude/references/debugger/core-philosophy.md`") &&
        content.includes("`.claude/references/debugger/side-effect-gate.md`") &&
        !content.includes("`references/debugger/"),
    },
    {
      label: "Claude runtime template exposes process-first Specs truth",
      file: "src/claude/CLAUDE.md",
      assert: (content) =>
        content.includes("## Claude Code runtime") &&
        content.includes("/cf:specs") &&
        content.includes("specs/<feature>/plan.md") &&
        content.includes("task-NN-*.md") &&
        content.includes("inline `## Receipt`") &&
        content.includes("### Legacy Specs compatibility") &&
        !/semantic_model|semantic-model|machine authority|task_registry|planning_depth|execution_tier|\blane\b/i.test(outsideLegacySections(content)),
    },
    {
      label: "Codex runtime template exposes process-first Specs truth",
      file: "src/codex/AGENTS.md",
      assert: (content) =>
        content.includes("## Codex runtime") &&
        content.includes("$cf-specs") &&
        content.includes("specs/<feature>/plan.md") &&
        content.includes("task-NN-*.md") &&
        content.includes("inline `## Receipt`") &&
        content.includes("### Legacy Specs compatibility") &&
        !/semantic_model|semantic-model|machine authority|task_registry|planning_depth|execution_tier|\blane\b/i.test(outsideLegacySections(content)),
    },
    {
      label: "Claude wrapper keeps runtime delta without template Language or Addressing",
      file: "src/claude/CLAUDE.md",
      assert: (content) =>
        content.includes("@AGENTS.md") &&
        content.includes("## Claude Code runtime") &&
        content.includes(".claude/skills/.venv/bin/python3") &&
        !content.includes("## Language Consistency") &&
        !content.includes("## Addressing (Context Overflow Indicator)"),
    },
    {
      label: "all runtime instruction templates carry local venv guidance",
      files: ["src/claude/CLAUDE.md", "src/codex/AGENTS.md"],
      assert: (content) =>
        content.includes("macOS/Linux") &&
        content.includes("Windows") &&
        content.includes(".claude/skills/.venv") &&
        content.includes(".agents/skills/.venv"),
    },
    {
      label: "Codex instruction template avoids global Claude skills path",
      file: "src/codex/AGENTS.md",
      assert: (content) => !content.includes("~/.claude/skills"),
    },
    {
      label: "Codex warning describes local hook bypass risk",
      file: "src/codex/AGENTS.md",
      assert: (content) => content.includes(
        "Do not edit global trust configuration. Hooks are not a complete security boundary; hosted tools and untrusted project hooks can bypass the local hook path.",
      ),
    },
    {
      label: "state cache carries full project, session, and spec identity",
      files: ["src/claude/hooks/spec-state.cjs"],
      assert: (content) =>
        content.includes("sessionID") &&
        content.includes("session_id") &&
        content.includes("realpathSync") &&
        !/slice\(\s*0\s*,\s*12\s*\)/.test(content),
    },
    {
      label: "shared resolver keeps explicit target and fail-closed ambiguity",
      file: "src/claude/scripts/spec-resolver.cjs",
      assert: (content) =>
        content.includes("extractExplicitTarget") &&
        content.includes("'multiple_active'") &&
        content.includes("guess from the first active directory") &&
        content.includes("Provide explicit feature") &&
        content.includes("if (active.length === 1) return active[0]") &&
        content.includes("candidates: active.map"),
    },
    {
      label: "rules hooks stay silent when runtime.json is absent",
      files: ["src/claude/hooks/rules.cjs", "src/codex/hooks/rules.cjs"],
      assert: (content) =>
        content.includes("return null") &&
        content.includes("runtime === null"),
    },
    {
      label: "CafeKit skill routing workflow rule maps core flows",
      file: "src/claude/rules/skill-workflow-routing.md",
      assert: (content) => {
        const normalized = content.replace(/\s+/g, " ");
        return normalized.includes("If the user names a valid installed skill, use it directly") &&
          normalized.includes("If one obvious low-risk installed skill covers the intent, use it directly") &&
          normalized.includes("do not invoke Route or agents for ceremony") &&
          normalized.includes("use the installed Route capability") &&
          normalized.includes("Resolve every abstract link against the current runtime catalog") &&
          normalized.includes("numeric optimization capability remains explicit-only") &&
          !normalized.includes("/cf:docs --reconstruct <scope>");
      },
    },
    {
      label: "CafeKit skill routing domain rule maps core and optional skills",
      file: "src/claude/rules/skill-domain-routing.md",
      assert: (content) => {
        const normalized = content.replace(/\s+/g, " ");
        return normalized.includes("Generate the current runtime catalog first") &&
          normalized.includes("description`, `when_to_use`, `category`, and `keywords") &&
          normalized.includes("evidence answer") &&
          normalized.includes("repository discovery") &&
          normalized.includes("document/artifact work") &&
          normalized.includes("matching installed optional capability") &&
          normalized.includes("require explicit user disambiguation") &&
          normalized.includes("explicit-only numeric optimization capability") &&
          !/\/cf:(?:docs|docx|pdf|pptx|xlsx|ai-multimodal)/.test(normalized);
      },
    },
    {
      label: "cf:docs skill is present in the optional document bundle",
      file: "src/claude/migration-manifest.json",
      assert: (content) => content.includes('"documentSkills"') && content.includes('"docs"'),
    },
    {
      label: "cf:docs --reconstruct keeps as-is evidence contract",
      file: "src/claude/skills/docs/SKILL.md",
      assert: (content) =>
        content.includes("name: cf:docs") &&
        content.includes("/cf:docs --reconstruct <scope>") &&
        content.includes("Mode flags are exclusive") &&
        content.includes("docs/as-is/<scope-slug>/") &&
        content.includes("Observed | Inferred | Unknown") &&
        content.includes("Confidence: High | Medium | Low") &&
        content.includes("MUST NOT") &&
        content.includes("/cf:specs <change request based on approved as-is docs>"),
    },
    {
      label: "cf:docs --reconstruct reference defines output and human review gate",
      file: "src/claude/skills/docs/references/reconstruct-workflow.md",
      assert: (content) =>
        content.includes("docs/as-is/<scope-slug>/") &&
        content.includes("overview.html") &&
        content.includes("requirements-as-is.md") &&
        content.includes("evidence-map.md") &&
        content.includes("unknowns-and-assumptions.md") &&
        content.includes("validate-docs-reconstruct.cjs") &&
        content.includes("Human Review Gate") &&
        content.includes("Do not recommend `/cf:develop`"),
    },
    {
      label: "cf:docs --reconstruct templates keep evidence and overview starters",
      file: "src/claude/skills/docs/templates/reconstruction.json",
      assert: (content) =>
        content.includes('"source_revision"') &&
        content.includes('"review_status": "pending"') &&
        content.includes('"approved_for_specs": false') &&
        content.includes('"overview.html"') &&
        content.includes('"constraints-risks-and-decisions.md"') &&
        content.includes('"glossary.md"'),
    },
    {
      label: "cf:docs --reconstruct overview template is self-contained",
      file: "src/claude/skills/docs/templates/reconstruct-overview.html",
      assert: (content) =>
        content.includes("data-reconstruct-overview") &&
        content.includes("SYSTEM_OVERVIEW_START") &&
        content.includes("REQUIREMENTS_START") &&
        content.includes("UNKNOWNS_START") &&
        !content.includes("<script") &&
        !content.includes("https://") &&
        !content.includes("http://"),
    },
    {
      label: "cf:docs normal docs references keep init update summarize phases",
      file: "src/claude/skills/docs/SKILL.md",
      assert: (content) =>
        content.includes("references/init-workflow.md") &&
        content.includes("references/update-workflow.md") &&
        content.includes("references/summarize-workflow.md") &&
        content.includes("CafeKit ships `docs-keeper` instead"),
    },
    {
      label: "cf:docs --init reference keeps scout author validate discipline",
      file: "src/claude/skills/docs/references/init-workflow.md",
      assert: (content) =>
        content.includes("Structure Scout") &&
        content.includes("Evidence Scout") &&
        content.includes("docs-keeper") &&
        content.includes("validate-docs.cjs <docs-root>"),
    },
    {
      label: "cf:docs --update reference reads existing docs before surgical updates",
      file: "src/claude/skills/docs/references/update-workflow.md",
      assert: (content) =>
        content.includes("Existing Docs Read") &&
        content.includes("Surgical Docs Update") &&
        content.includes("docs.maxLoc") &&
        content.includes(".sync_hash"),
    },
    {
      label: "cf:docs --summarize reference avoids broad codebase scans by default",
      file: "src/claude/skills/docs/references/summarize-workflow.md",
      assert: (content) =>
        content.includes("Do not scan the entire codebase") &&
        content.includes("codebase-summary.md") &&
        content.includes("Update only `codebase-summary.md`"),
    },
    {
      label: "docs validator accepts configured docs root argument",
      file: "src/claude/scripts/validate-docs.cjs",
      assert: (content) =>
        content.includes("process.argv[2] || 'docs'") &&
        content.includes("path.resolve(process.cwd(), docsArg)"),
    },
    {
      label: "reconstruct validator is packaged and enforces evidence IDs",
      file: "src/claude/migration-manifest.json",
      assert: (content) => content.includes('"validate-docs-reconstruct.cjs"'),
    },
    {
      label: "reconstruct validator requires overview and bundle registry",
      file: "src/claude/scripts/validate-docs-reconstruct.cjs",
      assert: (content) =>
        content.includes("'overview.html'") &&
        content.includes("must exactly list the as-is document bundle") &&
        content.includes("must reference evidence IDs") &&
        content.includes("data-reconstruct-overview"),
    },
    {
      label: "CafeKit no longer installs automatic skill router hook",
      file: "src/claude/settings/settings.json",
      assert: (content) =>
        content.includes('hooks/rules.cjs') &&
        content.includes('hooks/spec-state.cjs') &&
        !content.includes('hooks/skill-router.cjs'),
    },
    {
      label: "strategist keeps the AgentKit autonomy contract and claims no execution proof",
      file: "src/claude/agents/strategist.md",
      assert: (content) =>
        content.includes("model: fable") &&
        content.includes("Everything the caller needs must be in your single final message") &&
        content.includes("Never ask the user or the caller a question") &&
        content.includes("Advisory-only: never edit project code or scaffold files") &&
        content.includes("Your advice is not execution proof") &&
        content.includes("substitutes the newest Opus it does allow"),
    },
    {
      label: "model escalation reaches the strategist before the user and grants no authority",
      file: "src/claude/rules/orchestrator.md",
      assert: (content) =>
        content.includes("## Model Escalation") &&
        content.includes("spawn the `strategist` agent for counsel instead") &&
        content.includes("Counsel is not execution proof") &&
        content.includes("Escalate to the user when the strategist also cannot"),
    },
    {
      label: "PreCompact captures re-derivable anchors and claims no authorization",
      file: "src/claude/hooks/precompact.cjs",
      assert: (content) =>
        content.includes("Only facts the runtime can re-derive are recorded") &&
        content.includes("nothing here grants an authorization") &&
        content.includes("compact-recovery.json") &&
        content.includes("hook-state-dir.cjs"),
      label: "completion policy states both receipt modes and the invention limit",
      file: "src/claude/rules/state-sync.md",
      assert: (content) =>
        content.includes("bound to live Base and Head only while its own task file has a copy in") &&
        content.includes("committing a packet is the user's choice") &&
        content.includes("Every structural check runs in all cases") &&
        content.includes("The gate detects drift, not invention") &&
        !content.includes("revalidates every task currently marked done"),
    },
    {
      label: "Codex carries the same completion policy, since it does not auto-load Claude rules",
      file: "src/codex/rules/state-sync.md",
      assert: (content) =>
        content.includes("bound to live Base and Head only while its own task file has a copy in") &&
        content.includes("committing a packet is the user's choice") &&
        content.includes("Every structural check runs in all cases") &&
        content.includes("The gate detects drift, not invention") &&
        !content.includes("revalidates every task currently marked done"),
    },
    {
      label: "workflow rule points at one home for the binding policy instead of copying it",
      file: "src/claude/rules/workflow.md",
      assert: (content) =>
        content.includes("are stated once in `state-sync.md`") &&
        !content.includes("The gate detects drift, not invention") &&
        !content.includes("revalidates every task currently marked done"),
    },
    {
      label: "Specs machine boundary records what the gate cannot detect",
      file: "src/claude/skills/specs/SKILL.md",
      assert: (content) =>
        content.includes("detects drift\nbetween a receipt and the tree, not invention") &&
        content.includes("GATE-DONE is where a human weighs the evidence") &&
        !content.includes("revalidates every done task's inline Receipt and provenance"),
    },
    {
      label: "installer architecture documents omp coverage and gaps",
      file: "../../docs/installer-architecture.md",
      assert: (content) =>
        content.includes("## Oh My Pi (omp)") &&
        content.includes(".omp/extensions/cafekit-bridge.mjs") &&
        content.includes("omp discovers `.claude/skills` and `.agents/skills` on its own") &&
        content.includes("Not carried: `agent.cjs` (SubagentStart) and `semantic-review-authority.cjs` (SubagentStop)") &&
        content.includes("`.omp/` is added to the root ignore rules"),
    },
    {
      label: "installer architecture documents grok compatibility",
      file: "../../docs/installer-architecture.md",
      assert: (content) =>
        content.includes("## Grok CLI") &&
        content.includes("[compat.claude]") &&
        content.includes("normalizes grok's camelCase envelope") &&
        content.includes("grok --trust") &&
        content.includes("CLAUDE_PROJECT_DIR` is set by grok") &&
        content.includes("It has four control-flow channels") &&
        content.includes("`usage.cjs` is deliberately not routed") &&
        content.includes("Turning off `[compat.claude] hooks` is not supported"),
    },
    {
      label: "installer architecture documents completion gate identity",
      file: "../../docs/installer-architecture.md",
      assert: (content) =>
        content.includes("## Completion gate identity") &&
        content.includes("which packet still has unfinished work") &&
        content.includes("which packet is claiming closeout") &&
        content.includes("specs/_shared/active-feature.json") &&
        content.includes("A target supplied by the host always wins") &&
        content.includes("only while its own task file has a copy in") &&
        content.includes("work elsewhere in the tree never reopens a receipt") &&
        content.includes("a project\n  gitignoring its specs root cannot meet") &&
        content.includes("detects drift between a receipt and the\n  tree, not invention") &&
        content.includes("still block"),
    },
    {
      label: "installer architecture documents orca awareness",
      file: "../../docs/installer-architecture.md",
      assert: (content) =>
        content.includes("## Orca (onorca.dev)") &&
        content.includes("reads `orca skills get") &&
        content.includes("ORCA_PANE_KEY") &&
        content.includes("ORCA_AGENT_HOOK_TOKEN") &&
        content.includes("ORCA_AGENT_LAUNCH_TOKEN") &&
        content.includes("never read, write, or print either one") &&
        content.includes("ORCA_WORKTREE_ID") &&
        content.includes("Orca is not Herdr") &&
        content.includes("beside a Claude or Codex install") &&
        content.includes("no session line"),
    },
    {
      label: "installer architecture documents hook portability",
      file: "../../docs/installer-architecture.md",
      assert: (content) =>
        content.includes("## Hook portability") &&
        content.includes("runtime-dir.cjs") &&
        content.includes("derive their runtime directory from their own location") &&
        content.includes("Thirteen `~/.claude/` sites") &&
        content.includes("kept as Claude Code behaviour") &&
        content.includes("Twenty dead-code lines in `lib/context.cjs` and `lib/detect.cjs`") &&
        content.includes("`src/omp/hooks/` is an overlay of one file"),
    },
    {
      label: "CafeKit runtime config drives shared hook config",
      file: "src/claude/hooks/lib/config.cjs",
      assert: (content) =>
        content.includes("RUNTIME_CONFIG_PATH = `${runtimeDirName()}/runtime.json`") &&
        content.includes("const CONFIG_PATH = RUNTIME_CONFIG_PATH") &&
        content.includes("if (runtimeConfig) merged = deepMerge(merged, runtimeConfig)") &&
        !content.includes("'skill-router': true"),
    },
    {
      label: "CafeKit migration manifest excludes removed skill router files",
      file: "src/claude/migration-manifest.json",
      assert: (content) => {
        const manifest = JSON.parse(content);
        return (
          manifest.scripts.required.includes("generate-skill-catalog.cjs") &&
          !manifest.runtime.files.includes("hooks/skill-router.cjs") &&
          !manifest.runtime.files.includes("hooks/lib/skill-router-routes.cjs") &&
          manifest.obsolete.runtimeFiles.includes("hooks/skill-router.cjs") &&
          manifest.obsolete.runtimeFiles.includes("hooks/lib/skill-router-routes.cjs") &&
          manifest.obsolete.settingsHookCommandSubstrings.includes("hooks/skill-router.cjs")
        );
      },
    },
    {
      label: "CafeKit installer cleans obsolete skill router runtime and settings hooks",
      files: ["bin/phases/claude-runtime.js", "bin/phases/claude-settings.js"],
      assert: (content) =>
        content.includes("function removeObsoleteClaudeRuntimeFiles") &&
        content.includes("function pruneObsoleteSettingsHooks") &&
        content.includes("settingsHookCommandSubstrings") &&
        content.includes("fs.rmSync(targetPath, { force: true, recursive: isDir })") &&
        content.includes("prunePrefix") &&
        content.includes("removeObsoleteClaudeRuntimeFiles(ctx, platformKey)"),
    },
    {
      label: "CafeKit rules hook injects only project-specific reminders",
      file: "src/claude/hooks/rules.cjs",
      assert: (content) =>
        content.includes("reserveSession") &&
        content.includes("runtime.locale") &&
        content.includes("docs.maxLoc") &&
        content.includes("Markdown files") &&
        !content.includes("COOLDOWN_MS") &&
        !content.includes("## Skill Routing") &&
        !content.includes("[IMPORTANT] Consider Modularization") &&
        !content.includes("YAGNI · KISS · DRY"),
    },
    {
      label: "docs sync respects runtime docs path",
      files: [
        "src/claude/hooks/docs-sync.cjs",
        "src/codex/hooks/docs-sync.cjs",
      ],
      assertParts: ([claudeHook, codexHook]) =>
        claudeHook.includes("loadConfig({ cwd") &&
        claudeHook.includes("config.paths?.docs || 'docs'") &&
        claudeHook.includes("config.paths?.specs || 'specs'") &&
        codexHook.includes("runtime.paths?.docs") &&
        codexHook.includes("runtime.paths?.specs") &&
        [claudeHook, codexHook].every((content) => content.includes(":(exclude,literal)")),
    },
    {
      label: "cf:specs SKILL stays lean after slim-flow diet",
      file: "src/claude/skills/specs/SKILL.md",
      assert: (content) => content.trimEnd().split("\n").length >= 150 && content.trimEnd().split("\n").length <= 230,
    },
    {
      label: "cf:develop SKILL stays within directional context budget",
      file: "src/claude/skills/develop/SKILL.md",
      assert: (content) => content.trimEnd().split("\n").length >= 140 && content.trimEnd().split("\n").length <= 200,
    },
    {
      label: "cf:specs complete shipped bundle stays at or below 750 lines",
      files: [
        "src/claude/skills/specs/SKILL.md",
        "src/claude/skills/specs/references/review.md",
        "src/claude/skills/specs/references/templates.md",
        "src/claude/skills/specs/templates/design.md",
        "src/claude/skills/specs/templates/requirements-init.md",
        "src/claude/skills/specs/templates/requirements.md",
        "src/claude/skills/specs/templates/research.md",
        "src/claude/skills/specs/templates/spec-state.json",
        "src/claude/skills/specs/templates/task.md",
      ],
      assert: (content) => content.trimEnd().split("\n").length - 8 <= 750,
    },
    {
      label: "process-first Develop and Sync core stays at or below 400 lines",
      files: [
        "src/claude/skills/develop/SKILL.md",
        "src/claude/skills/develop/references/parallel-waves.md",
        "src/claude/skills/sync/SKILL.md",
        "src/claude/skills/sync/references/sync-protocols.md",
      ],
      assert: (content) => content.trimEnd().split("\n").length - 3 <= 400,
    },
    {
      label: "docs-sync.cjs has no shouting banners",
      file: "src/claude/hooks/docs-sync.cjs",
      assert: (content) =>
        !content.includes("URGENT") && !content.includes("BẮT BUỘC"),
    },
    {
      label: "workflow routing keeps proportional and authority boundaries",
      file: "src/claude/rules/skill-workflow-routing.md",
      assert: (content) => {
        const normalized = content.replace(/\s+/g, " ");
        return normalized.includes("ambiguous, multi-step, multi-domain, or elevated/high-risk work") &&
          normalized.includes("Collapse links whose output is already current and evidenced") &&
          normalized.includes("Diagnosis does not authorize repair") &&
          normalized.includes("no route expands the user's existing authority");
      },
    },
    {
      label: "usage hook reads runtime config from hook cwd",
      file: "src/claude/hooks/usage.cjs",
      assert: (content) =>
        content.includes("function readRuntime(cwd)") &&
        content.includes("const cwd = input.cwd || process.cwd()") &&
        content.includes("runtime.usage?.enabled === false"),
    },
    {
      label: "statusline layout contract keeps registry, fallback, cost gate, and weekly anchors",
      file: "src/claude/status.cjs",
      assert: (content) =>
        content.includes("const LAYOUT_SECTION_IDS = ['model', 'context', 'quota', 'directory', 'git', 'plan', 'cost', 'changes']") &&
        content.includes("invalid layout falls back to the") &&
        content.includes("if (lines.length === 0) return null") &&
        content.includes("billingMode === 'api'") &&
        content.includes("seven_day") &&
        content.includes("USAGE_CACHE_TTL_MS = 300000"),
    },
    {
      label: "repository guide documents statusline configuration",
      file: "../../README.md",
      assert: (content) =>
        content.includes("statuslineLayout") &&
        content.includes("statuslineColors") &&
        content.includes('"statusline"'),
    },
    {
      label: "package guide documents statusline configuration",
      file: "README.md",
      assert: (content) =>
        content.includes("statuslineLayout") &&
        content.includes("statuslineColors") &&
        content.includes('"statusline"'),
    },
    {
      label: "statusline colors respect runtime config",
      file: "src/claude/status.cjs",
      assert: (content) =>
        content.includes("colors.setColorEnabled(config.statuslineColors !== false)") &&
        content.includes("colors.shouldUseColor"),
    },
    {
      label: "templates expose all five EARS forms and measurable wording",
      file: "src/claude/skills/specs/references/templates.md",
      assert: (content) =>
        ["Ubiquitous", "Event-driven", "State-driven", "Unwanted behavior", "Optional feature"]
          .every((token) => content.includes(token)) &&
        content.includes("measurable threshold or observation"),
    },
    {
      label: "templates route ambiguity without guessing outcomes",
      file: "src/claude/skills/specs/references/templates.md",
      assert: (content) => {
        const normalized = content.replace(/\s+/g, " ");
        return normalized.includes("Classify ambiguity in every affected CP row") &&
          ["`none`", "`examples-needed`", "`decision-needed`", "`design-needed`"]
            .every((token) => normalized.includes(token)) &&
          normalized.includes("two or three examples only for an already decided rule") &&
          normalized.includes("retention of 30 versus 90 days is `decision-needed`");
      },
    },
    {
      label: "review contract keeps evidence-backed saturation and runtime-only third round",
      file: "src/claude/skills/specs/references/review.md",
      assert: (content) =>
        content.includes("Review saturation") &&
        content.includes("Round three requires runtime evidence") &&
        content.includes("larger useful set means the plan should be split"),
    },
    {
      // Behavioral: structured projection — task template Compact core has one anchor, proof conditional (parsed, not phrase-aggregate)
      label: "task template Compact core is per-surface parsed (behavioral)",
      file: "src/claude/skills/specs/templates/task.md",
      assert: (content) => {
        const rows = content
          .split("\n")
          .filter((line) => line.trim().startsWith("|"))
          .map((line) => line.split("|").slice(1, -1).map((c) => c.trim()));
        // Core must have exactly one data row (owner) by default; proof row is conditional comment, not a second data row
        const dataRows = rows.filter((cells) => cells[0].startsWith("A-R"));
        const hasSingleCoreAnchor = dataRows.length === 1 && dataRows[0][1] === "file";
        const hasProofConditionalComment = content.includes("For a typed proof boundary, add:");
        const hasBareNotOwnership = content.includes("bare command is not ownership") || content.includes("bare");
        return hasSingleCoreAnchor && hasProofConditionalComment && hasBareNotOwnership;
      },
    },
    {
      // Design template Compact core parsed: single anchor, proof conditional
      label: "design template Compact core is per-surface parsed (behavioral)",
      file: "src/claude/skills/specs/templates/design.md",
      assert: (content) => {
        const rows = content
          .split("\n")
          .filter((line) => line.trim().startsWith("|"))
          .map((line) => line.split("|").slice(1, -1).map((c) => c.trim()));
        const dataRows = rows.filter((cells) => cells[0].startsWith("A-D"));
        const hasSingleCoreAnchor = dataRows.length === 1 && dataRows[0][0] === "A-D-01";
        const hasProofConditionalComment = content.includes("For a typed proof boundary, add:") && content.includes("A-D-02");
        return hasSingleCoreAnchor && hasProofConditionalComment;
      },
    },
    {
      label: "Specs skill keeps scope and proof boundaries explicit",
      file: "src/claude/skills/specs/SKILL.md",
      assert: (content) => {
        const norm = content.toLowerCase().replace(/\s+/g, " ");
        return norm.includes("one or two files") &&
          norm.includes("do not create a plan merely because documentation mentions this skill") &&
          norm.includes("placeholder or remembered output is not evidence") &&
          norm.includes("two pre-code rounds; later claims need runtime evidence");
      },
    },
    {
      label: "review keeps user decisions and the bounded paper stop",
      file: "src/claude/skills/specs/references/review.md",
      assert: (content) => {
        const norm = content.toLowerCase().replace(/\s+/g, " ");
        return norm.includes("the user chooses accept, reject, or revise") &&
          norm.includes("do not apply findings before that decision") &&
          norm.includes("allow at most two review-and-repair rounds") &&
          norm.includes("round three requires runtime evidence");
      },
    },
    {
      label: "spec-maker keeps planning separate from dispatch and proof",
      file: "src/claude/agents/spec-maker.md",
      assert: (content) => {
        const norm = content.toLowerCase().replace(/\s+/g, " ");
        return norm.includes("it is not an implementation and does not authorize work") &&
          norm.includes("do not create implementation files, receipts") &&
          norm.includes("do not start develop") &&
          norm.includes("keep every new task `status: blocked` while gate-review is open") &&
          !norm.includes("leave every new task `status: pending`");
      },
    },
    {
      label: "specs-usage-guide documents the flat packet and canonical inline receipt",
      file: "../../docs/specs-usage-guide.md",
      assert: (content) =>
        content.includes("specs/<feature>/plan.md") &&
        content.includes("task-NN-<slug>.md") &&
        ["GATE-SCOPE", "GATE-REVIEW", "GATE-DONE"].every((gate) => content.includes(gate)) &&
        ["Verification: PASS", "Command:", "Exit: 0", "Base:", "Head:"]
          .every((field) => content.includes(field)),
    },
    {
      label: "specs-usage-guide documents adaptive routing without timing claims",
      file: "../../docs/specs-usage-guide.md",
      assert: (content) => adaptiveUsageGuideContractValid(content),
    },
    {
      label: "specs-usage-guide documents plan-native Develop without timing or live-adherence claims",
      files: [
        "../../docs/specs-usage-guide.md",
        "bin/__tests__/develop-contract.test.js",
        "bin/__tests__/codex-native.test.js",
      ],
      assertParts: ([guide, developTests, codexTests]) => {
        const normalized = guide.replace(/\s+/g, " ");
        const guideContract = [
          "cf:develop <feature>",
          "task-NN-<slug>.md",
          "paused",
          "blocked",
          "in_progress",
          "--parallel",
          "commit range",
          "owned-path",
          "--flash",
          "FLASH_UNVERIFIED",
          "hai lần capture",
          "structural metrics",
          "[UNVERIFIED]",
        ].every((clause) => normalized.includes(clause)) &&
          !/đo (?:được )?\d+\s*(?:ms|s|giây|phút)|live-model (?:PASS|đã xác minh)/i.test(normalized);
        const developNames = [
          "Develop process-first source contract preserves selection, recovery, final-Head, parallel, and Flash boundaries",
          "Claude installed Develop preserves plan-native execution and references",
        ];
        const codexName = "Codex installed Develop preserves plan-native execution and references";
        return guideContract &&
          developNames.every((name) => developTests.includes(`test('${name}', () =>`)) &&
          codexTests.includes(`test('${codexName}', () =>`);
      },
    },
    {
      // Installed Codex projection is verified via transform, not raw source path (behavioral)
      label: "Codex installed projection uses Codex paths (behavioral, temp fixture)",
      files: [
        "src/claude/skills/specs/SKILL.md",
        "src/claude/skills/specs/references/review.md",
      ],
      assert: (content) => {
        // Check that Claude source uses .claude and that Codex transform would use .codex — verify via normalizeCodexBody if available
        try {
          const codexLib = require(join(packageRoot, "bin/lib/codex-install.js"));
          const normalize = codexLib.normalizeCodexBody;
          if (typeof normalize === "function") {
            const sample = "/cf:develop <feature> --parallel";
            const transformed = normalize(sample, "src/claude/skills/develop/SKILL.md");
            return transformed.includes("$cf-develop <feature> --parallel") && !transformed.includes("/cf:develop");
          }
        } catch {}
        return false;
      },
    },
    {
      // Per-surface benchmark tuning targets are explicit and not correctness waivers (Vietnamese positive phrase)
      label: "benchmark tuning targets are per-surface explicit (advisory, not waiver)",
      file: "../../docs/benchmark-workflow.md",
      assert: (content) =>
        content.includes("≤10 phút") &&
        content.includes("≤40 phút") &&
        content.includes("500K") &&
        content.includes("tối đa") &&
        content.includes("2 vòng") &&
        content.toLowerCase().includes("tinh chỉnh") &&
        content.includes("không phải để cắt"),
    },
    {
      label: "specs-usage-guide teaches Develop and Sync without leaking v2.1 vocabulary",
      file: "../../docs/specs-usage-guide.md",
      assert: (content) =>
        content.includes("## Develop và Sync") &&
        content.includes("sync-finalize") &&
        content.includes("## Legacy compatibility") &&
        !/semantic_model|semantic-model|machine authority|task_registry|planning_depth|execution_tier|\blane\b/i.test(outsideLegacySections(content)),
    },
    {
      label: "ported review rule keeps decision precedence without reversal loopholes",
      file: PORTED_RULE_PATHS[0],
      assert: (content) => {
        const normalized = content.replace(/\s+/g, " ");
        return normalized.includes("do not reverse it because an audit raises an abstract concern") &&
          normalized.includes("Reverse only when the audit adds new evidence or the context changed") &&
          normalized.includes("name the verification source") &&
          normalized.includes("Do not silently undo an explicit user decision") &&
          normalized.includes("GATE-SCOPE scope choice, GATE-REVIEW finding dispositions, and GATE-DONE completion judgement") &&
          normalized.includes("- the original decision - the audit concern - the trade-off - the concrete options") &&
          normalized.includes("Then wait for the user") &&
          normalized.includes("identify what the code actually stores, protects, or exposes") &&
          normalized.includes("Fix real failure modes. Document non-issues briefly.") &&
          normalized.includes("scout before asking") &&
          normalized.includes("owns the ask-back conditions; do not restate that list here") &&
          normalized.includes("Do not add plan IDs, phase numbers, CP or AC identifiers, audit labels, or finding codes to code comments, migration names, test names, or commit messages") &&
          !/(audit|review) (concerns?|findings?) (override|outrank|take precedence)/i.test(normalized) &&
          !/do not wait for the user/i.test(normalized) &&
          !/ids? (may|can) appear in (code|test|commit)/i.test(normalized);
      },
    },
    {
      label: "ported process rule keeps ownership, port, and cleanup discipline",
      file: PORTED_RULE_PATHS[1],
      assert: (content) => {
        const normalized = content.replace(/\s+/g, " ");
        return normalized.includes("picks a new port and starts another process") &&
          normalized.includes("those processes stay behind") &&
          normalized.includes("Track every background process you start: command, PID, port, and worktree") &&
          normalized.includes("whose exit you can observe over an unobservable detached run") &&
          normalized.includes("check whether one is already running") &&
          normalized.includes("Bind to a deterministic port per project or worktree") &&
          normalized.includes("stop the stale owner rather than taking another port") &&
          normalized.includes("`lsof -i :PORT` or `ss -ltnp`") &&
          normalized.includes("Stop what you started when its task, session, or worktree ends") &&
          normalized.includes("wave releases a worktree") &&
          normalized.includes("Reconcile periodically") &&
          normalized.includes("Stop cleanly first") &&
          normalized.includes("Only stop processes you started or clearly own") &&
          normalized.includes("never match a kill pattern broad enough") &&
          !/start on another port/i.test(normalized) &&
          !/orphaned processes are (acceptable|fine|harmless|expected)/i.test(normalized);
      },
    },
    {
      label: "ported rules survive the Codex transform as rename-only",
      files: PORTED_RULE_PATHS,
      assertParts: (parts) => {
        let normalize;
        try {
          normalize = require(join(packageRoot, "bin/lib/codex-install.js")).normalizeCodexBody;
        } catch {
          return false;
        }
        if (typeof normalize !== "function") return false;
        const forbiddenTokens = [
          "Claude Code", "CLAUDE.md", "Claude Tasks", "AskUserQuestion", "TodoWrite",
          "TaskCreate", "TaskGet", "TaskUpdate", "TaskList", "SendMessage", "WebSearch",
          "WebFetch", "subagent_type", "prompt=", "description=\"", "Agent tool",
          "`Agent`", "Agent(", "Explore subagent", "packages/spec/src/", ".claude", ".codex",
          "`Bash`", "`Read`", "`Glob`", "`Grep`", "`Write`", "`Edit`", "`NotebookEdit`",
          "code-auditor", "test-runner", "spec-maker", "docs-keeper", "git-ops",
          "project-manager", "ui-ux-designer",
        ];
        const forbiddenPatterns = [
          /(^|[\s("'`])\/(brainstorm|code-review|debug|develop|docs|frontend-design|git|hotfix|inspect|question|research|specs|test)(?=$|[\s<`),.:])/m,
          /cf:(?![a-z0-9-])/,
        ];
        return PORTED_RULE_PATHS.every((relative, index) => {
          const content = parts[index];
          if (forbiddenTokens.some((token) => content.includes(token))) return false;
          if (forbiddenPatterns.some((pattern) => pattern.test(content))) return false;
          const renameOnly = content
            .replace(/\/cf:([a-z0-9-]+)/gi, (_m, name) => `$cf-${name}`)
            .replace(/\bcf:([a-z0-9-]+)/gi, (_m, name) => `cf-${name}`);
          return normalize(content, relative) === renameOnly;
        });
      },
    },
    {
      label: "Specs primary flow is file-first while legacy kernel remains isolated",
      file: "src/claude/skills/specs/SKILL.md",
      assert: (content) =>
        content.includes("Files are state") &&
        content.includes("## Legacy compatibility") &&
        !/semantic_model|semantic-model|machine authority|task_registry|planning_depth|execution_tier|\blane\b/i.test(outsideLegacySections(content)),
    },
  ];

  console.log("\n[skill-test] static semantic checks");
  for (const check of checks) {
    const targets = check.files ?? [check.file];
    const parts = await Promise.all(
      targets.map((rel) => readFile(join(packageRoot, rel), "utf8")),
    );
    const valid = check.assertParts
      ? check.assertParts(parts)
      : check.assert(parts.join("\n"));
    if (!valid) {
      console.error(`[FAIL] ${check.label}: ${targets.join(", ")}`);
      process.exit(1);
    }
    console.log(`✔ ${check.label}`);
  }

  return checks.length + specs21Tests + implementationReadinessTests
    + processTaskStatusTests + adaptiveCoverageTests + brainstormContractTests
    + developPlanNativeTests + scoutSubroutineTests + testPlanNativeTests + debugAdaptiveTests
    + hotfixAdaptiveTests + researchAdaptiveTests + routeContractTests
    + loopBoundedTests + docsAdaptiveTests + consumerSectionTests;
}

function runSkillCatalogTests() {
  const scriptPath = join(packageRoot, "src/claude/scripts/generate-skill-catalog.cjs");
  const sourceRoot = join(packageRoot, "src/claude/skills");
  const result = spawnSync(process.execPath, [scriptPath, "--skills", "--root", sourceRoot], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    console.error("[FAIL] skill catalog script failed");
    process.exit(1);
  }
  for (const expected of [
    "CafeKit Skills Catalog",
    "`cf:specs`",
    "`cf:develop`",
    "`cf:docs`",
    "`cf:ask`",
    "`cf:scout`",
    "`cf:debug`",
    "`cf:fix`",
  ]) {
    if (!result.stdout.includes(expected)) {
      console.error(result.stdout);
      console.error(`[FAIL] skill catalog missing ${expected}`);
      process.exit(1);
    }
  }

  const json = spawnSync(process.execPath, [scriptPath, "--json", "--root", sourceRoot], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  if (json.status !== 0) {
    console.error(json.stdout);
    console.error(json.stderr);
    console.error("[FAIL] skill catalog JSON mode failed");
    process.exit(1);
  }
  const parsed = JSON.parse(json.stdout);
  if (!Array.isArray(parsed.skills) || parsed.skills.length < 20) {
    console.error(json.stdout);
    console.error("[FAIL] skill catalog JSON has too few skills");
    process.exit(1);
  }
  const retiredDirectories = [
    "backend-development",
    "devops",
    "frontend-design",
    "frontend-development",
    "mobile-development",
    "react-best-practices",
  ];
  for (const directory of retiredDirectories) {
    if (parsed.skills.some((skill) => skill.directory === directory)
      || !parsed.diagnostics?.some((diagnostic) =>
        diagnostic.code === "retired_skill" && diagnostic.directory === directory)) {
      console.error(json.stdout);
      console.error(`[FAIL] skill catalog did not exclude retired skill ${directory}`);
      process.exit(1);
    }
  }

  // Determinism guard: running again must produce identical JSON (no cache/stale output)
  const json2 = spawnSync(process.execPath, [scriptPath, "--json", "--root", sourceRoot], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  if (json2.stdout !== json.stdout) {
    console.error("[FAIL] skill catalog output not deterministic across runs");
    process.exit(1);
  }

  console.log("✔ skill catalog script lists installed CafeKit skills");
  console.log("✔ skill catalog JSON mode is machine-readable");
  return 2;
}

async function fileExists(filePath) {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function runInstallerMigrationFixtureTests() {
  const root = await mkdtemp(join(tmpdir(), "cafekit-installer-migration-"));

  try {
    await mkdir(join(root, ".claude", "hooks", "lib"), { recursive: true });
    await writeFile(join(root, ".claude", "hooks", "skill-router.cjs"), "old router");
    await writeFile(join(root, ".claude", "hooks", "lib", "skill-router-routes.cjs"), "old routes");
    await writeFile(
      join(root, ".claude", "settings.json"),
      JSON.stringify(
        {
          hooks: {
            UserPromptSubmit: [
              {
                matcher: "*",
                hooks: [
                  {
                    type: "command",
                    command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/skill-router.cjs"',
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
    );

    const result = spawnSync(process.execPath, [join(packageRoot, "bin", "install.js")], {
      cwd: root,
      input: "n\n\n",
      encoding: "utf8",
      env: { ...process.env, PATH: "/usr/bin:/bin" },
    });

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
      console.error("[FAIL] installer migration fixture failed");
      process.exit(1);
    }

    const settings = JSON.parse(await readFile(join(root, ".claude", "settings.json"), "utf8"));
    const serializedHooks = JSON.stringify(settings.hooks || {});
    const failures = [];

    if (await fileExists(join(root, ".claude", "hooks", "skill-router.cjs"))) {
      failures.push("obsolete skill-router hook file still exists");
    }
    if (await fileExists(join(root, ".claude", "hooks", "lib", "skill-router-routes.cjs"))) {
      failures.push("obsolete skill-router route file still exists");
    }
    if (serializedHooks.includes("hooks/skill-router.cjs")) {
      failures.push("obsolete skill-router settings hook still exists");
    }
    if (!(await fileExists(join(root, ".claude", "rules", "skill-workflow-routing.md")))) {
      failures.push("skill workflow routing rule was not installed");
    }
    if (!(await fileExists(join(root, ".claude", "scripts", "generate-skill-catalog.cjs")))) {
      failures.push("skill catalog script was not installed");
    }
    if (await fileExists(join(root, ".claude", "skills", "docs", "SKILL.md"))) {
      failures.push("optional cf:docs skill was installed without opt-in");
    }

    if (failures.length > 0) {
      console.error(failures.join("\n"));
      process.exit(1);
    }

    console.log("✔ installer migrates old skill-router runtime to rule-based routing");
    return 1;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/**
 * Schema-drift tripwire: every hook command in the settings template must map
 * to a real payload file that the migration manifest ships, and vice versa —
 * a hook listed in runtime.files but registered nowhere is dead weight, a hook
 * registered in settings but not shipped breaks at runtime.
 */
async function runSettingsManifestConsistencyCheck() {
  const settings = JSON.parse(
    await readFile(join(packageRoot, "src/claude/settings/settings.json"), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(join(packageRoot, "src/claude/migration-manifest.json"), "utf8"),
  );

  const registered = new Set(
    JSON.stringify(settings.hooks).match(/hooks\/[a-z-]+\.cjs/g) || [],
  );
  const shipped = new Set(
    (manifest.runtime?.files || []).filter((f) => /^hooks\/[a-z-]+\.cjs$/.test(f)),
  );
  // Helpers imported by completion-authority.cjs, not executable hook entrypoints
  // (see src/claude/hooks/completion-authority.cjs:64-65 requiring ./completion-authority-state.cjs and ./completion-authority-check.cjs)
  const helperAllowlist = new Set([
    "hooks/completion-authority-check.cjs",
    "hooks/completion-authority-state.cjs",
  ]);

  const failures = [];
  for (const hook of registered) {
    if (!shipped.has(hook)) failures.push(`registered in settings but not in manifest runtime.files: ${hook}`);
    if (!(await fileExists(join(packageRoot, "src/claude", hook)))) {
      failures.push(`registered in settings but payload file missing: ${hook}`);
    }
  }
  for (const hook of shipped) {
    if (!registered.has(hook) && !helperAllowlist.has(hook)) failures.push(`shipped in manifest but registered in no settings event: ${hook}`);
  }

  if (failures.length > 0) {
    console.error(failures.join("\n"));
    console.error("[FAIL] settings/manifest hook consistency check failed");
    process.exit(1);
  }

  console.log(`✔ settings template and manifest agree on ${registered.size} hooks`);
  return 1;
}

/**
 * Regression: a non-interactive upgrade (--yes/--force-overwrite) must preserve
 * the configured locale.responseLanguage. Bug (0.14.0/0.14.1 era): selectLanguage
 * returned before restoring the saved locale when !interactive, so
 * patchRuntimeLocale clobbered the label with the 'en' default on every upgrade.
 */
/**
 * Runs last: no suite above may leave hook state inside the source tree.
 *
 * Hooks resolve their own state directory and send source-tree runs to a temp
 * directory, because an untracked `.logs/` under `src/` changes the worktree
 * digest that receipt provenance binds to. That made the completion gate report
 * every done task as stale three times before the cause was found, so the
 * invariant is checked rather than remembered.
 */
/**
 * The old policy sentence promised the gate revalidated every done task against
 * the current tree. That is no longer what the gate does, and a stale copy of the
 * promise would teach an operator to read a correct silence as a bug.
 */
async function runCompletionPolicyWordingCheck() {
  const retired = "revalidates every task currently marked done";
  const offenders = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".venv") continue;
        await walk(absolute);
      } else if (/\.(md|cjs|mjs|js|json|html)$/.test(entry.name)) {
        const content = await readFile(absolute, "utf8");
        if (content.includes(retired)) offenders.push(absolute);
      }
    }
  }

  console.log("\n[skill-test] retired completion-policy sentence is gone from the payload");
  await walk(join(packageRoot, "src"));
  if (offenders.length > 0) {
    console.error(
      `[FAIL] the retired sentence "${retired}" still appears in: ${offenders.join(", ")}. `
      + "State the two receipt modes instead; the policy is defined once in src/claude/rules/state-sync.md.",
    );
    process.exit(1);
  }
  console.log("Ran 1 test in completion policy wording");
  return 1;
}

async function runSourceTreeCleanlinessCheck() {
  const sourceRoot = join(packageRoot, "src");
  const offenders = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const absolute = join(dir, entry.name);
      if (entry.name === ".logs") offenders.push(absolute);
      else await walk(absolute);
    }
  }

  console.log("\n[skill-test] source tree stays free of hook state");
  await walk(sourceRoot);
  if (offenders.length > 0) {
    console.error(
      `[FAIL] hook state written into the source tree: ${offenders.join(", ")}. `
      + "Use hooks/lib/hook-state-dir.cjs (Claude) or hookStateDir() from "
      + "hooks/lib/hook-context.cjs (Codex) instead of a path built from the hook's own location.",
    );
    process.exit(1);
  }
  console.log("Ran 1 test in source tree cleanliness");
  return 1;
}

async function runLocalePreservationFixtureTest() {
  const root = await mkdtemp(join(tmpdir(), "cafekit-installer-locale-"));

  try {
    await mkdir(join(root, ".claude"), { recursive: true });

    const install = (args = []) =>
      spawnSync(process.execPath, [join(packageRoot, "bin", "install.js"), ...args], {
        cwd: root,
        input: "n\n\n",
        encoding: "utf8",
        env: { ...process.env, PATH: "/usr/bin:/bin" },
      });

    const first = install();
    if (first.status !== 0) {
      console.error(first.stdout, first.stderr);
      console.error("[FAIL] locale fixture: fresh install failed");
      process.exit(1);
    }

    // Simulate a configured install: user language saved as a freeform label.
    const rtPath = join(root, ".claude", "runtime.json");
    const rt = JSON.parse(await readFile(rtPath, "utf8"));
    rt.locale = { ...(rt.locale || {}), responseLanguage: "Tiếng Việt" };
    await writeFile(rtPath, `${JSON.stringify(rt, null, 2)}\n`);

    // Non-interactive upgrade — the exact path that clobbered the locale.
    const second = install(["--force-overwrite"]);
    if (second.status !== 0) {
      console.error(second.stdout, second.stderr);
      console.error("[FAIL] locale fixture: upgrade run failed");
      process.exit(1);
    }

    const after = JSON.parse(await readFile(rtPath, "utf8"));
    if (after.locale?.responseLanguage !== "Tiếng Việt") {
      console.error(
        `[FAIL] locale fixture: responseLanguage became ${JSON.stringify(after.locale?.responseLanguage)} after upgrade (expected "Tiếng Việt")`,
      );
      process.exit(1);
    }

    console.log("✔ installer upgrade preserves configured locale.responseLanguage");
    return 1;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}


async function writeText(filePath, content) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function listFilesRecursively(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursively(filePath));
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }
  return files;
}

async function assertNoSourcePayloadPaths(root, platform, reportFailure) {
  const payloadRoots = {
    claude: [".claude/skills", ".claude/rules", ".claude/agents"],
    codex: [".agents/skills", ".codex/rules", ".codex/agents"],
  };
  const files = [];
  for (const relativeRoot of payloadRoots[platform] || []) {
    files.push(...await listFilesRecursively(join(root, relativeRoot)));
  }

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    if (content.includes("packages/spec/src/")) {
      reportFailure(`${platform}: installed payload leaks packages/spec/src/ in ${filePath}`);
    }
  }
}

function runSpecValidator(specDir) {
  const validator = join(packageRoot, "src/claude/scripts/validate-spec-output.cjs");
  return spawnSync(process.execPath, [validator, specDir], {
    cwd: packageRoot,
    encoding: "utf8",
  });
}

function runReconstructValidator(bundleDir) {
  const validator = join(packageRoot, "src/claude/scripts/validate-docs-reconstruct.cjs");
  return spawnSync(process.execPath, [validator, bundleDir], {
    cwd: packageRoot,
    encoding: "utf8",
  });
}

async function createValidSpecFixture(root) {
  // Migration coverage: this deliberately exercises the schema 2.0 read-
  // compatibility path. Canonical v2.1 authoring is checked structurally by
  // runSpecs21ContractTests above.
  const specDir = join(root, "valid-spec");
  const taskPath = "tasks/task-R1-01-user-permission.md";
  await writeText(
    join(specDir, "spec.json"),
    JSON.stringify(
      {
        schema_version: "2.0",
        feature_name: "valid-spec",
        created_at: "2026-08-13T00:00:00+07:00",
        updated_at: "2026-08-13T00:05:00+07:00",
        status: "in_progress",
        current_phase: "tasks",
        workflow_policy: workflowPolicy.workflowPolicySnapshot({ riskSignals: {} }),
        scope_lock: {
          source: "Add user permission control",
          in_scope: ["1"],
          out_of_scope: [],
          expansion_policy: "requires-user-approval",
        },
        approvals: {
          requirements: { generated: true, agent_validated: true },
          design: { generated: true, agent_validated: true },
          tasks: { generated: true, agent_validated: true },
        },
        coordination: {
          tasks_required: true,
          phases_required: false,
          reason: "task_topology",
          task_triggers: ["separate_proof"],
        },
        task_files: [taskPath],
        task_registry: {
          [taskPath]: {
            id: "R1-01",
            title: "User permission control",
            status: "pending",
            dependencies: [],
            blocker: null,
            started_at: null,
            completed_at: null,
            last_updated_at: null,
            artifacts: ["backend/tests/test_admin_permissions.py"],
          },
        },
        validation: {
          status: "not-run",
          last_validated_at: null,
          semantic_review: {
            status: "not-run",
            reviewed_artifact_digest: null,
            reviewed_criteria: [],
            counterexamples: [],
          },
        },
        timestamps: {
          init: "2026-08-13T00:00:00+07:00",
          requirements_done: "2026-08-13T00:01:00+07:00",
          research_done: null,
          design_done: "2026-08-13T00:03:00+07:00",
          tasks_done: "2026-08-13T00:04:00+07:00",
          code_done: null,
          test_done: null,
          review_done: null,
          validation_done: null,
        },
        ready_for_implementation: false,
      },
      null,
      2,
    ),
  );
  await writeText(
    join(specDir, "requirements.md"),
    `# Requirements\n\n### Requirement 1: User Permission\n\n- **R1.1** When an admin toggles permission, the system shall persist the user permission state.\n`,
  );
  await writeText(
    join(specDir, "design.md"),
    `# Design\n\n## Boundary\n\nThe existing admin route owns the permission update.\n\n## Typed Anchors\n\n| ID | Type | Target | Role |\n|---|---|---|---|\n| A-D-01 | file | \`backend/app/api/v1/admin.py\` | existing route owner and entrypoint |\n| A-D-02 | route | \`PATCH /admin/users/{id}/permissions\` | permission update contract |\n\n## Decisions and Invariants\n\n### D1 — Preserve admin authorization\n\n- **Decision:** Extend the existing route and preserve its authorization check.\n- **Negative path:** A missing user returns 404.\n- **Anchors:** A-D-01, A-D-02\n\n## Verification\n\n| Requirement | Proof target | Expected result | Negative path / reachability |\n|---|---|---|---|\n| R1.1 | \`pytest backend/tests/test_admin_permissions.py\` | exit code 0 and persisted permission | missing user through A-D-02 returns 404 |\n`,
  );
  await writeText(
    join(specDir, taskPath),
    `# Task R1-01: User permission control\n\n**Status:** pending\n\n## Outcome\n\nAn admin can persist a user's workspace permission through the existing route.\n\n## Scope and Typed Anchors\n\n- **In scope:** Permission update and missing-user response.\n- **Out of scope:** A new authorization system.\n- **Contracts/Invariants:** D1\n- **Canonical design anchors consumed:** A-D-01, A-D-02\n\n| ID | Type | Target | Role |\n|---|---|---|---|\n| A-R1-01-01 | command | \`pytest backend/tests/test_admin_permissions.py\` | planned focused verification |\n\n## Changes\n\n- [ ] Persist permission through the existing admin route. _Requirements: 1.1_\n- [ ] Return 404 for a missing user. _Requirements: 1.1_\n\n## Acceptance\n\n- **R1.1:** The real route returns the persisted permission and rejects a missing user with 404.\n\n## Dependencies\n\n- none\n\n## Verification Plan\n\n- **Command:** \`pytest backend/tests/test_admin_permissions.py\`\n- **Expected:** exit code 0 with persisted-permission assertions\n- **Negative path:** missing user returns 404\n- **Reachability:** \`PATCH /admin/users/{id}/permissions\` is registered by \`backend/app/api/v1/admin.py\`\n`,
  );
  return specDir;
}

async function createInvalidSpecFixture(root) {
  const specDir = join(root, "invalid-triage-like-spec");
  const taskFiles = [
    "tasks/task-R0-01-project-setup.md",
    "tasks/task-R0-02-ticket-list.md",
    "tasks/task-R0-03-filtering.md",
    "tasks/task-R0-04-ticket-detail.md",
    "tasks/task-R0-05-status-update.md",
  ];
  await writeText(
    join(specDir, "spec.json"),
    JSON.stringify(
      {
        feature: "triage-dashboard",
        status: "approved",
        scope_lock: true,
        tasks: taskFiles,
        task_registry: {
          "task-R0-01": { slug: "project-setup", status: "pending" },
          "task-R0-02": { slug: "ticket-list", status: "pending" },
          "task-R0-03": { slug: "filtering", status: "pending" },
        },
        ready_for_implementation: true,
      },
      null,
      2,
    ),
  );
  await writeText(
    join(specDir, "requirements.md"),
    "# Requirements\n\n### R1 — Ticket List\nWHEN the dashboard loads, THE SYSTEM SHALL show tickets.\n",
  );
  await writeText(join(specDir, "design.md"), "# Design\n\nRender ticket list.\n");
  for (const taskFile of taskFiles) {
    await writeText(
      join(specDir, taskFile),
      `# Task\n\n## Goal\nBuild something.\n\n## Steps\n1. Do work.\n\n## Acceptance Criteria\n- Works.\n`,
    );
  }
  return specDir;
}

async function runSpecValidatorFixtureTests() {
  const root = await mkdtemp(join(tmpdir(), "cafekit-spec-validator-"));
  try {
    const validSpec = await createValidSpecFixture(root);
    const invalidSpec = await createInvalidSpecFixture(root);

    const valid = runSpecValidator(validSpec);
    if (valid.status !== 0) {
      console.error(valid.stdout);
      console.error(valid.stderr);
      console.error("[FAIL] spec validator rejected valid fixture");
      process.exit(1);
    }

    const invalid = runSpecValidator(invalidSpec);
    const invalidOutput = `${invalid.stdout}\n${invalid.stderr}`;
    const expectedFailures = [
      "scope_lock",
      "task_files",
      "task_registry",
      "design_context.validation_recommended",
      "validation.status is not completed",
      "entirely R0",
      "missing Requirements mapping",
      "missing Evidence",
      "missing Related Files",
      "missing Completion Criteria",
      "missing Risk Assessment",
    ];

    if (invalid.status === 0) {
      console.error("[FAIL] spec validator accepted invalid triage-like fixture");
      process.exit(1);
    }

    for (const expected of expectedFailures) {
      if (!invalidOutput.includes(expected)) {
        console.error(invalidOutput);
        console.error(`[FAIL] spec validator did not report ${expected}`);
        process.exit(1);
      }
    }

    console.log("✔ spec validator accepts valid fixture");
    console.log("✔ spec validator rejects triage-like invalid fixture");

    // Specs v2 tasks reference named design contracts and never copy their
    // canonical bodies, preventing first-block-only drift by construction.
    const driftSpec = join(root, "multi-contract-drift-spec");
    await cp(validSpec, driftSpec, { recursive: true });
    const driftDesignPath = join(driftSpec, "design.md");
    const driftDesign = `${await readFile(driftDesignPath, "utf8")}\n### C1 — Permission payload\n\n<!-- contract:PermissionPayload -->\n\`\`\`json\n{ "user_id": 1, "can_create": true }\n\`\`\`\n\n### GATE-REVIEW — Permission error\n\n<!-- contract:PermissionError -->\n\`\`\`json\n{ "error": "not_found" }\n\`\`\`\n`;
    await writeText(
      driftDesignPath,
      driftDesign,
    );
    const driftTaskPath = join(driftSpec, "tasks/task-R1-01-user-permission.md");
    const driftTask = (await readFile(driftTaskPath, "utf8")).replace(
      "- **Contracts/Invariants:** D1",
      '- **Contracts/Invariants:** C1, C2\n\n<!-- contract:PermissionPayload -->\n```json\n{ "user_id": 1, "can_create": true }\n```\n\n<!-- contract:PermissionError -->\n```json\n{ "error": "notFound" }\n```',
    );
    await writeText(driftTaskPath, driftTask);
    const drift = runSpecValidator(driftSpec);
    const driftOutput = `${drift.stdout}\n${drift.stderr}`;
    if (drift.status === 0 || !driftOutput.includes("Specs v2 tasks reference named contract IDs and must not copy canonical contract blocks")) {
      console.error(driftOutput);
      console.error("[FAIL] spec validator allowed copied canonical contract blocks in a Specs v2 task");
      process.exit(1);
    }
    console.log("✔ spec validator rejects copied canonical contract blocks in Specs v2 tasks");
    return 3;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const reconstructDocuments = [
  "overview.html",
  "system-overview.md",
  "requirements-as-is.md",
  "roles-and-permissions.md",
  "entities-and-statuses.md",
  "business-rules.md",
  "integrations.md",
  "architecture-c4.md",
  "constraints-risks-and-decisions.md",
  "glossary.md",
  "evidence-map.md",
  "unknowns-and-assumptions.md",
];

async function writeReconstructFiles(bundleDir, overrides = {}) {
  for (const file of reconstructDocuments) {
    const defaultContent = file.endsWith(".html")
      ? "<!doctype html><html data-reconstruct-overview><body>overview</body></html>\n"
      : `# ${file}\n\nSource-backed current-state content.\n`;
    await writeText(join(bundleDir, file), overrides[file] ?? defaultContent);
  }
}

async function createValidReconstructFixture(root) {
  const bundleDir = join(root, "valid-reconstruct");
  await writeReconstructFiles(bundleDir, {
    "requirements-as-is.md":
      "# Requirements\n\n## R-ASIS-001: View ticket\n\n- Type: Observed\n- Confidence: High\n- Evidence:\n  - E-API-001 - `src/api/tickets.ts:listTickets`\n- Actors:\n  - Support agent\n- Trigger:\n  - GET /tickets\n- Current outcome:\n  - Ticket list returned.\n",
    "evidence-map.md":
      "# Evidence Map\n\n| ID | Source | Observation |\n|---|---|---|\n| E-API-001 | `src/api/tickets.ts:listTickets` | Ticket list route returns tickets. |\n",
  });
  await writeText(
    join(bundleDir, "reconstruction.json"),
    JSON.stringify(
      {
        scope: "valid-reconstruct",
        generated_at: "2026-05-22T00:00:00.000Z",
        status: "draft",
        docs_root: "docs/as-is/valid-reconstruct",
        source_revision: "abc123",
        source_branch: "main",
        evidence_policy: "observed-inferred-unknown",
        review_gate: "human_review_required",
        review_status: "pending",
        approved_for_specs: false,
        documents: reconstructDocuments,
        counts: { requirements: 1, evidence_items: 1, observed: 1, inferred: 0, unknown: 0 },
        next_recommended_step: "human_review",
      },
      null,
      2,
    ),
  );
  return bundleDir;
}

async function createInvalidReconstructFixture(root) {
  const bundleDir = join(root, "invalid-reconstruct");
  await writeReconstructFiles(bundleDir, {
    "overview.html": "<!doctype html><html><body>missing marker</body></html>\n",
    "requirements-as-is.md": "# Requirements\n\n## R-ASIS-001: View ticket\n\n- Current outcome: ticket list.\n",
    "evidence-map.md": "# Evidence Map\n\nNo evidence IDs.\n",
  });
  await writeText(
    join(bundleDir, "reconstruction.json"),
    JSON.stringify(
      {
        scope: "invalid-reconstruct",
        generated_at: "2026-05-22T00:00:00.000Z",
        status: "draft",
        docs_root: "docs/as-is/invalid-reconstruct",
        documents: ["requirements-as-is.md"],
        counts: {},
        next_recommended_step: "human_review",
      },
      null,
      2,
    ),
  );
  return bundleDir;
}

async function runReconstructValidatorFixtureTests() {
  const root = await mkdtemp(join(tmpdir(), "cafekit-reconstruct-validator-"));
  try {
    const valid = runReconstructValidator(await createValidReconstructFixture(root));
    if (valid.status !== 0) {
      console.error(valid.stdout);
      console.error(valid.stderr);
      console.error("[FAIL] reconstruct validator rejected valid fixture");
      process.exit(1);
    }

    const invalid = runReconstructValidator(await createInvalidReconstructFixture(root));
    const invalidOutput = `${invalid.stdout}\n${invalid.stderr}`;
    for (const expected of [
      "source_revision",
      "review_status",
      "approved_for_specs",
      "must exactly list",
      "missing Type",
      "must reference evidence IDs",
      "overview.html",
    ]) {
      if (invalid.status === 0 || !invalidOutput.includes(expected)) {
        console.error(invalidOutput);
        console.error(`[FAIL] reconstruct validator did not report ${expected}`);
        process.exit(1);
      }
    }

    console.log("✔ reconstruct validator accepts valid fixture");
    console.log("✔ reconstruct validator rejects incomplete evidence bundle");
    return 2;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runWave1InstructionFixtureTests() {
  const roots = [];
  const installer = join(packageRoot, "bin", "install.js");
  const install = (root, platforms, extraArgs = []) => spawnSync(
    process.execPath,
    [installer, "--platform", platforms, "--yes", ...extraArgs],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: "/usr/bin:/bin",
      },
    },
  );

  const fail = (message, result) => {
    if (result && result.status !== 0) {
      message += `\\n${result.stdout}\\n${result.stderr}`;
    }
    console.error(`[FAIL] Wave 1 install fixture: ${message}`);
    process.exit(1);
  };

  const assertInstalledInstruction = async (root, platform, fileName, skillPath, includeCore = true) => {
    const content = await readFile(join(root, fileName), "utf8");
    const required = [skillPath, "macOS/Linux", "Windows"];
    if (includeCore) {
      required.push(
        "For process-first Specs, `plan.md` and flat `task-NN-*.md` files are",
        "keeps canonical execution proof in its final inline `## Receipt`",
        "NO_TESTS",
        "0 tests + exit 0",
      );
    }
    for (const text of required) {
      if (!content.includes(text)) fail(`${platform}: ${fileName} missing ${JSON.stringify(text)}`);
    }
    if (platform === "codex" && content.includes("~/.claude/skills")) {
      fail(`${platform}: ${fileName} contains global Claude skills path`);
    }
    return content;
  };

  const assertSharedCore = async (root, platform) => {
    const content = await readFile(join(root, "AGENTS.md"), "utf8");
    for (const text of [
      "Deliver exactly what was asked. Do not expand, polish, or add optional work beyond the request. Match existing code style and structure.",
      "For process-first Specs, `plan.md` and flat `task-NN-*.md` files are",
      "Specs uses three user decisions: GATE-SCOPE for scope, GATE-REVIEW for adversarial findings,",
      "When a hook blocks an action, that is an instruction boundary — do not work around it.",
      "Verification comes from the project's hooks and validators, not from spawning more agents.",
      "NO_TESTS",
      "0 tests + exit 0",
    ]) {
      if (!content.includes(text)) fail(`${platform}: AGENTS.md missing ${JSON.stringify(text)}`);
    }
    if ((content.match(/## Language Consistency <!-- cafekit:lang -->/g) || []).length !== 1) {
      fail(`${platform}: AGENTS.md must contain one managed language section`);
    }
    return content;
  };

  const assertVietnameseInstructions = async (root, platform) => {
    const files = [];
    for (const fileName of ["AGENTS.md", "CLAUDE.md"]) {
      const filePath = join(root, fileName);
      if (await fileExists(filePath)) files.push([fileName, await readFile(filePath, "utf8")]);
    }
    for (const [fileName, content] of files) {
      if (content.includes("Always respond in **English**")) {
        fail(`${platform}: ${fileName} still contains English language instruction`);
      }
    }
    const payloadRoots = platform === "combined"
      ? [".claude/skills", ".claude/rules", ".claude/agents", ".agents/skills", ".codex/rules", ".codex/agents"]
      : {
        claude: [".claude/skills", ".claude/rules", ".claude/agents"],
        codex: [".agents/skills", ".codex/rules", ".codex/agents"],
      }[platform] || [];
    for (const relativeRoot of payloadRoots) {
      for (const filePath of await listFilesRecursively(join(root, relativeRoot))) {
        const content = await readFile(filePath, "utf8");
        if (content.includes("Always respond in **English**")) {
          fail(`${platform}: installed payload ${filePath} still contains English language instruction`);
        }
      }
    }
    const agents = files.find(([fileName]) => fileName === "AGENTS.md")?.[1] || "";
    const coreStart = agents.indexOf("<!-- CAFEKIT CORE START -->");
    const coreEnd = agents.indexOf("<!-- CAFEKIT CORE END -->");
    if (coreStart < 0 || coreEnd <= coreStart) fail(`${platform}: AGENTS.md has no valid core block`);
    const core = agents.slice(coreStart, coreEnd);
    if (!core.includes("Always respond in **Vietnamese**")) {
      fail(`${platform}: Vietnamese language instruction is not inside CORE`);
    }
    if (agents.slice(0, coreStart).includes("Always respond in **Vietnamese**")
      || agents.slice(coreEnd).includes("Always respond in **Vietnamese**")) {
      fail(`${platform}: Vietnamese language instruction escaped CORE`);
    }
  };

  const runHook = (root, hook, payload, env) => spawnSync(
    process.execPath,
    [join(packageRoot, hook)],
    {
      cwd: root,
      input: JSON.stringify(payload),
      encoding: "utf8",
      env: { ...process.env, PROJECT_ROOT: env },
    },
  );

  try {
    const standalone = [
      ["claude", ".claude/skills/.venv/bin/python3", "CLAUDE.md"],
      ["codex", ".agents/skills/.venv/bin/python3", "AGENTS.md"],
    ];

    for (const [platform, skillPath, fileName] of standalone) {
      const root = await mkdtemp(join(tmpdir(), `cafekit-wave1-${platform}-`));
      roots.push(root);
      const result = install(root, platform, ["--lang", "vi"]);
      if (result.status !== 0) fail(`${platform} install failed`, result);
      await assertInstalledInstruction(root, platform, fileName, skillPath, platform !== "claude");
      await assertSharedCore(root, platform);
      await assertVietnameseInstructions(root, platform);
      await assertNoSourcePayloadPaths(root, platform, fail);
    }

    const claudeRoot = roots[0];
    const codexRoot = roots[1];
    const decoy = await mkdtemp(join(tmpdir(), "cafekit-wave1-decoy-"));
    roots.push(decoy);
    const cwdAuthority = runHook(
      claudeRoot,
      "src/claude/hooks/rules.cjs",
      { cwd: claudeRoot, session_id: `${claudeRoot}-cwd-authority` },
      decoy,
    );
    if (
      cwdAuthority.status !== 0
      || !cwdAuthority.stdout.includes(`${claudeRoot}/plans/`)
      || cwdAuthority.stdout.includes(`${decoy}/plans/`)
    ) {
      fail("Claude rules hook did not prefer payload.cwd over PROJECT_ROOT", cwdAuthority);
    }
    const agentAuthority = runHook(
      claudeRoot,
      "src/claude/hooks/agent.cjs",
      { cwd: claudeRoot, agent_id: `${claudeRoot}-agent-authority` },
      decoy,
    );
    if (
      agentAuthority.status !== 0
      || !agentAuthority.stdout.includes(`${claudeRoot}/plans/`)
      || agentAuthority.stdout.includes(`${decoy}/plans/`)
    ) {
      fail("Claude agent hook did not prefer payload.cwd over PROJECT_ROOT", agentAuthority);
    }
    await rm(join(claudeRoot, ".claude", "runtime.json"), { force: true });
    await rm(join(codexRoot, ".codex", "runtime.json"), { force: true });

    const claudeRules = runHook(
      claudeRoot,
      "src/claude/hooks/rules.cjs",
      { cwd: claudeRoot, session_id: `${claudeRoot}-missing-claude` },
      decoy,
    );
    if (claudeRules.status !== 0 || claudeRules.stdout.trim() !== "") {
      fail("Claude rules hook injected with runtime.json missing", claudeRules);
    }
    const claudeAgent = runHook(
      claudeRoot,
      "src/claude/hooks/agent.cjs",
      { cwd: claudeRoot, agent_id: `${claudeRoot}-missing-agent` },
      decoy,
    );
    if (claudeAgent.status !== 0 || claudeAgent.stdout.trim() !== "") {
      fail("Claude agent hook injected with runtime.json missing", claudeAgent);
    }
    const codexRules = runHook(
      codexRoot,
      "src/codex/hooks/rules.cjs",
      { cwd: codexRoot, session_id: `${codexRoot}-missing-codex` },
      decoy,
    );
    if (codexRules.status !== 0 || codexRules.stdout.trim() !== "") {
      fail("Codex rules hook injected with runtime.json missing", codexRules);
    }

    const combined = await mkdtemp(join(tmpdir(), "cafekit-wave1-combined-"));
    roots.push(combined);
    await writeFile(join(combined, "AGENTS.md"), "# User instructions\\n\\nKeep this sentinel.\\n");
    const first = spawnSync(
      process.execPath,
      [installer, "--platform", "claude,codex", "--lang", "vi", "--yes"],
      {
        cwd: combined,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: "/usr/bin:/bin",
        },
      },
    );
    if (first.status !== 0) fail("combined install failed", first);

    const agentsBefore = await readFile(join(combined, "AGENTS.md"), "utf8");
    const claudeBefore = await readFile(join(combined, "CLAUDE.md"), "utf8");
    const counts = (content, marker) => (content.match(new RegExp(marker, "g")) || []).length;
    for (const [marker, label] of [
      ["<!-- CAFEKIT CORE START -->", "core"],
      ["<!-- CAFEKIT CODEX START -->", "Codex"],
    ]) {
      if (counts(agentsBefore, marker) !== 1) fail(`combined install has duplicate/missing ${label} marker`);
    }
    if (counts(agentsBefore, "For process-first Specs, `plan.md` and flat `task-NN-\\*.md` files are") !== 1) {
      fail("shared core duplicated in combined install");
    }
    if (counts(agentsBefore, "cafekit:lang") !== 1) fail("combined install must have one managed language marker");
    if (!agentsBefore.includes("Keep this sentinel.")) fail("combined install removed user AGENTS content");
    await assertVietnameseInstructions(combined, "combined");
    if (claudeBefore.includes("cafekit:lang")
      || claudeBefore.includes("## Language Consistency")
      || claudeBefore.includes("## Addressing (Context Overflow Indicator)")) {
      fail("combined CLAUDE.md contains template Language or Addressing section");
    }
    await assertNoSourcePayloadPaths(combined, "claude", fail);
    await assertNoSourcePayloadPaths(combined, "codex", fail);

    const second = spawnSync(
      process.execPath,
      [installer, "--platform", "claude,codex", "--lang", "vi", "--yes", "--force-overwrite"],
      {
        cwd: combined,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: "/usr/bin:/bin",
        },
      },
    );
    if (second.status !== 0) fail("combined second install failed", second);
    const agentsAfter = await readFile(join(combined, "AGENTS.md"), "utf8");
    const claudeAfter = await readFile(join(combined, "CLAUDE.md"), "utf8");
    if (agentsAfter !== agentsBefore) fail("combined second install changed AGENTS.md bytes");
    if (claudeAfter !== claudeBefore) fail("combined second install changed CLAUDE.md bytes");
    if (counts(agentsAfter, "For process-first Specs, `plan.md` and flat `task-NN-\\*.md` files are") !== 1) {
      fail("combined rerun duplicated shared core");
    }
    if (counts(agentsAfter, "cafekit:lang") !== 1) fail("combined rerun duplicated managed language marker");
    if (!agentsAfter.includes("Keep this sentinel.")) fail("combined rerun removed user AGENTS content");
    await assertNoSourcePayloadPaths(combined, "claude", fail);
    await assertNoSourcePayloadPaths(combined, "codex", fail);

    console.log("✔ Wave 1 real installs cover both runtimes, missing-runtime silence, vi localization, and combined idempotence");
    return 1;
  } finally {
    for (const root of roots) await rm(root, { recursive: true, force: true });
  }
}
async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--static-only")) {
    const totalTests = await runStaticSemanticTests();
    console.log(`\n[skill-test] PASS: ${totalTests} focused static tests executed`);
    return;
  }
  const requiredSemanticTests = parseRequiredSemanticTests(argv);
  const chromeTestsDir = join(
    packageRoot,
    "src/claude/skills/chrome-devtools/scripts/__tests__",
  );
  const chromeTests = await listFiles(
    chromeTestsDir,
    (name) => name.endsWith(".test.js"),
  );

  const pdfBoundingBoxTest = join(
    packageRoot,
    "src/claude/skills/pdf/scripts/check_bounding_boxes_test.py",
  );

  const hookTestsDir = join(packageRoot, "src/claude/hooks/__tests__");
  const hookTests = await listFiles(
    hookTestsDir,
    (name) => name.endsWith(".test.js"),
  );

  const installerTestsDir = join(packageRoot, "bin", "__tests__");
  const installerTests = await listFiles(
    installerTestsDir,
    (name) => name.endsWith(".test.js"),
  );

  const testSuites = [
    {
      label: "package Node tests",
      command: process.execPath,
      args: ["--test", ...installerTests],
      expectedFiles: installerTests.length,
      parseCount: parseNodeTestCount,
      summarize: parseNodeTestSummary,
    },
    {
      label: "hook behavioral tests",
      command: process.execPath,
      args: ["--test", ...hookTests],
      expectedFiles: hookTests.length,
      parseCount: parseNodeTestCount,
      summarize: parseNodeTestSummary,
    },
    {
      label: "chrome-devtools script tests",
      command: process.execPath,
      args: ["--test", ...chromeTests],
      expectedFiles: chromeTests.length,
      parseCount: parseNodeTestCount,
      summarize: parseNodeTestSummary,
    },
    {
      label: "pdf bounding-box tests",
      command: process.env.PYTHON ?? "python3",
      args: [pdfBoundingBoxTest],
      expectedFiles: 1,
      parseCount: parsePythonUnittestCount,
    },
  ];

  // D12: every required `*.semantic-firewall.test.js` basename must already
  // be discovered under bin/__tests__ (sorted basenames, sole discovery
  // authority: semantic-firewall-test-discovery.cjs) -- missing/undiscovered
  // fails immediately, before any suite runs. Each required basename is then
  // run and verified in isolation, exactly like every other suite above:
  // not executed (0 tests) or a failing exit code both fail the whole run.
  if (requiredSemanticTests.length > 0) {
    const discovery = semanticFirewallDiscovery.assertRequiredSemanticTests(
      installerTestsDir,
      requiredSemanticTests,
    );
    if (!discovery.ok) {
      for (const basename of discovery.missing) {
        console.error(`[FAIL] required semantic-firewall test not discovered: ${basename}`);
      }
      process.exit(1);
    }
    for (const basename of requiredSemanticTests) {
      testSuites.push({
        label: `semantic-firewall required test: ${basename}`,
        command: process.execPath,
        args: ["--test", join(installerTestsDir, basename)],
        expectedFiles: 1,
        parseCount: parseNodeTestCount,
        summarize: parseNodeTestSummary,
      });
    }
  }

  const missingSuites = testSuites.filter((suite) => suite.expectedFiles === 0);
  if (missingSuites.length > 0) {
    for (const suite of missingSuites) {
      console.error(`[NO_TESTS] ${suite.label}: no test files found`);
    }
    process.exit(1);
  }

  let totalTests = await runStaticSemanticTests();
  console.log("\n[skill-test] skill catalog checks");
  totalTests += runSkillCatalogTests();
  console.log("\n[skill-test] installer migration fixtures");
  totalTests += await runSettingsManifestConsistencyCheck();
  totalTests += await runInstallerMigrationFixtureTests();
  totalTests += await runLocalePreservationFixtureTest();
  console.log("\n[skill-test] instruction install fixtures");
  totalTests += await runWave1InstructionFixtureTests();
  console.log("\n[skill-test] spec artifact validator fixtures");
  totalTests += await runSpecValidatorFixtureTests();
  console.log("\n[skill-test] reconstruct docs validator fixtures");
  totalTests += await runReconstructValidatorFixtureTests();
  for (const suite of testSuites) {
    console.log(`\n[skill-test] ${suite.label}`);
    const result = await runCommand(suite);
    if (result.error) {
      console.error(`[FAIL] ${suite.label}: ${result.error}`);
      process.exit(1);
    }
    if (result.code !== 0) {
      const detail = suite.summarize ? `; ${nodeFailureDetail(result.summary)}` : "";
      console.error(`[FAIL] ${suite.label}: exited with code ${result.code}${detail}`);
      process.exit(result.code ?? 1);
    }
    if (result.count === 0) {
      console.error(`[NO_TESTS] ${suite.label}: command passed but ran 0 tests`);
      process.exit(1);
    }
    totalTests += result.count;
  }

  if (totalTests === 0) {
    console.error("[NO_TESTS] skill self-test pipeline ran 0 tests");
    process.exit(1);
  }

  totalTests += await runCompletionPolicyWordingCheck();
  totalTests += await runSourceTreeCleanlinessCheck();

  console.log(`\n[skill-test] PASS: ${totalTests} tests executed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
