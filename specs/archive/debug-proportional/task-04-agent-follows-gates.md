# Task 04 — The debugger agent follows the skill's two gates

Status: done

## Outcome
`agents/debugger.md` tells the agent, at the start of every investigation before any evidence is collected, to read and follow the `<DIAGNOSTIC-ONLY-GATE>` and `<ROOT-CAUSE-GATE>` of the `cf:debug` skill, which carry rules (f) and (g), and to check them again before rating root-cause confidence; a checker of its own pins that pointer inside `## Operating Boundary` with a counterexample per clause.

## Scope
- In: one sentence in the agent's `## Operating Boundary` (`debugger.md:28-30`) pointing to both gates of `.claude/skills/debug/SKILL.md`; a new checker `validateDebugAgentGates` / `runDebugAgentGatesTests` with seven mutations and its own log lines in `run-skill-self-tests.mjs`, registered in `runStaticSemanticTests` and the static total.
- Out: the rest of `debugger.md`, including `- Query relevant databases using appropriate tools (psql for PostgreSQL)` at `:43` (the user chose KEEP, not EXPAND); `skills/debug/SKILL.md`; `evals/`; the Codex test file.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/agents/debugger.md`, `packages/spec/scripts/run-skill-self-tests.mjs` (the new agent-gates checker and its registration only)
- Read: `packages/spec/src/claude/skills/debug/SKILL.md:36-43` (DIAGNOSTIC-ONLY-GATE, rule (g) at `:40`) and `:58-66` (ROOT-CAUSE-GATE, rule (f) at `:63`); `packages/spec/src/claude/skills/fix/references/diagnosis-protocol.md:29`; `packages/spec/bin/lib/codex-install.js:232-250` (the Codex rewrite of `.claude/skills` and `cf:` names)

## Steps
1. Add to `## Operating Boundary`, after the paragraph at `debugger.md:30`, this sentence: "At the start of every investigation, before collecting any evidence, read and follow the `<DIAGNOSTIC-ONLY-GATE>` and `<ROOT-CAUSE-GATE>` of the `cf:debug` skill (`.claude/skills/debug/SKILL.md`), and check them again before rating root-cause confidence." Keep every pinned agent line byte-for-byte and keep `Keep an elimination path`, ``Use `/cf:scout` or focused local `rg`/reads``, `Quick/local and Standard reports omit them.` and the report-shape pointer's opening appearing exactly once each (`replaceDebugClauseOnce` requires a single anchor); add none of the strings the debug checkers forbid (`less than 2 days old`, `create/update a codebase summary`, `Debugger Report`, `## Required Report Shape`, `## Reporting Standards`).
2. Add `validateDebugAgentGates(agent)`, raising `debug-agent-gates` unless the text between `## Operating Boundary` and `## Investigation Methodology` (`markdownBetweenHeadings`) contains the Step 1 sentence's parts — "At the start of every investigation, before collecting any evidence, read and follow", `<DIAGNOSTIC-ONLY-GATE>`, `<ROOT-CAUSE-GATE>`, `.claude/skills/debug/SKILL.md`, "check them again before rating root-cause confidence". Add `runDebugAgentGatesTests()`: the intact agent raises nothing; seven mutations, each anchored on the whole sentence, raise `debug-agent-gates` — the sentence dropped; `<ROOT-CAUSE-GATE>` removed; `<DIAGNOSTIC-ONLY-GATE>` removed; the sentence moved to the end of the file; the trigger weakened to "When convenient,"; the path removed; the closing ", and check them again before rating root-cause confidence" removed. It logs `✔ cf:debug agent points to the skill's two gates` and `✔ cf:debug agent-gates checker rejects 7 weakenings` and returns 8; register it in `runStaticSemanticTests` and the static total.
3. Run the suite.

## Acceptance
- AC-04 as stated in `plan.md`.
- The Codex projection test passes unchanged (the installed agent is the converted source).

## Dependencies
- task-01-proportional-report.md

## Verification Plan
- Command: `cd packages/spec && node scripts/run-skill-self-tests.mjs`
- Named probe: the two log lines of `runDebugAgentGatesTests`; `codex-native.test.js`'s debugger install assertion inside the suite's package Node tests
- Reachability: known — `fix/references/diagnosis-protocol.md:29` activates the `debugger` agent when the root cause is unclear, and the agent reads `debugger.md`
- Oracle: `[skill-test] PASS: 1434 tests executed` (1426 plus the new checker's eight) with `✔ cf:debug agent points to the skill's two gates` and `✔ cf:debug agent-gates checker rejects 7 weakenings`
- Counterexample: `validateDebugAgentGates` applied to the `debugger.md` bytes before this task raises `debug-agent-gates`, and each of the seven mutations raises it (the runner fails when a mutation does not)
- Artifacts: none

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: cd packages/spec && node scripts/run-skill-self-tests.mjs
Exit: 0
Base: f56826b0e05b6333dc72538b587f83c0e4d30b2d
Head: 885769dbbcaa987cb0f7698f3c674b8da840a40a16df7498c0a57c9490cb769f
```text
$ cd packages/spec && node scripts/run-skill-self-tests.mjs
✔ cf:debug proportional checker rejects 20 weakenings
✔ cf:debug agent points to the skill's two gates
✔ cf:debug agent-gates checker rejects 7 weakenings
[skill-test] static semantic checks
[skill-test] package Node tests
✔ Codex install preserves the adaptive diagnostic-only Debug contract (435.633042ms)
ℹ tests 525
ℹ pass 524
ℹ fail 0
[skill-test] hook behavioral tests
ℹ tests 226
ℹ pass 226
ℹ fail 0
[skill-test] PASS: 1434 tests executed
```

The fenced block keeps the two debug-proportional checker lines around task 04's, task 04's two lines, the Codex debug install test, the Node and hook totals and the final line; the log has no failure line, and the one unpassed package Node test is the opt-in E2E skip. The same run is the proof of tasks 01 and 02, whose Receipts quote their own probe lines from it.

Oracle: `[skill-test] PASS: 1434 tests executed` — 1426 plus the new checker's eight — with both new lines; the same Command before any change passed at 1426 without them. Counterexample: `validateDebugAgentGates` applied to the pre-task agent (the current file without the sentence) raises `debug-agent-gates`, and on the current file nothing; each of the seven mutations raises it, and the runner fails when one does not. The sentence sits at `debugger.md:32`, inside `## Operating Boundary`; the pinned agent anchors each appear once and no forbidden string appears; `debugger.md:45` (`- Query relevant databases …`) and `skills/debug/SKILL.md` (sha256 `82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8`) are unchanged. The Codex conversion yields `cf-debug` and `.agents/skills/debug/SKILL.md` with both gate tags (checked by review).

Repair rounds: none; one review, PASS.

Limits, for GATE-DONE: the checker requires the sentence's five parts independently within the section (a sentence split across two sentences still passes) and bounds the section by the next heading `## Investigation Methodology`; the repository's own installed copy under `.claude/agents/` is refreshed only by a reinstall; the agent's adherence at runtime is not measured (plan Known limits).
