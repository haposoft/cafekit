# Task 01 — Debug reports in proportion and shares one shape with its agent

Status: done

## Outcome
`skills/debug/SKILL.md` asks for a report sized to the failure's depth and states that depth, has no `✓ Step` lines or duplicated passages, tells the run to invoke the `scout` skill, allows "high" confidence only after runtime reproduction, forbids heavy reads on shared environments without permission, and asks the final answer to open with `## Debug Report`; `agents/debugger.md` uses the same report shape and depth rule; the probes pin all of it.

## Scope
- In: rewrite `SKILL.md` for changes (a)–(g) in `plan.md` plus D-05; replace the agent's `## Debugger Report` block and its Reporting Standards list (`debugger.md:101-133`) with a pointer to the skill's report shape and depth rule; add probes and mutations.
- Out: frontmatter `name` and `description`; the flags' existence (their explanation may shorten); `fix` (task 02), `scout`, `.claude/references/debugger/`; the Codex test file.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/debug/SKILL.md`, `packages/spec/src/claude/agents/debugger.md`, `packages/spec/scripts/run-skill-self-tests.mjs` (the debug checker and probes only)
- Read: `run-skill-self-tests.mjs:3103-3208` (checker and its mutations), `:4869-4905` (probes), `bin/__tests__/codex-native.test.js:1943-1975`, `skills/fix/SKILL.md:172-180`, `evals/debug/doc-ma-sai-huong/graders/noi-do-tin-cao.md`, `evals/debug/*/graders/co-debug-report.md`

## Steps
1. List every literal the suites pin in `SKILL.md` and `debugger.md` and keep each byte-for-byte; keep `**Quick/local:**`, `Trigger: event or input`, `Keep an elimination path` and ``Use `/cf:scout` or focused local `rg`/reads`` appearing exactly once each (`replaceDebugClauseOnce` requires a single anchor). Keep `## Debug Report` and the line `**Root cause confidence:** high | medium | low | unknown` byte-for-byte: the eval graders read them.
2. (a) Under `## Proportional depth`: Quick/local and Standard failures write the root-cause contract, the confirmed hypothesis and the verification plan; only Incident/deep work writes `Evidence Timeline`, `### Hypotheses Tested` beyond the confirmed one, `### Elimination Path` and `### Recurrence-Prevention Handoff`, and a shorter report omits them rather than writing "skipped". The report template gains one line, `**Depth:** quick/local | standard | incident/deep`, beneath `**Mode:**`, which `fix` reads (task 02). Step 4's "2-3 competing hypotheses" and ROOT-CAUSE-GATE's "Do NOT stop at the first plausible explanation" both apply only when the first explanation is not directly confirmed by evidence.
3. (b) Delete the six `**Output:** ✓ Step N` lines. (d) Delete the Step 1 checklist that restates HARD-GATE-SCOUT-FIRST, the mermaid chart, and the `---` separators; shorten the Arguments list to one line per flag and say a run chooses the depth itself when no flag is given.
4. (e) Step 1: invoke the `scout` skill (`cf:scout`) for the affected scope; if it is not installed, use direct read-only reconnaissance and say so.
5. (f) In ROOT-CAUSE-GATE: confidence `high` only when the cause was reproduced or observed at runtime (the failing command run, a log or probe read); from static reading alone, at most `medium`.
6. (g) In DIAGNOSTIC-ONLY-GATE: no heavy or costly reads — table scans, bulk exports, load or stress runs — against shared staging or production without the user's explicit permission; prefer local or fixture data.
7. D-05: the final answer opens with `## Debug Report` in the template's shape.
8. Agent: replace `debugger.md:101-133` and the `## Debugger Report` block with a pointer to the skill's report shape and depth rule, keeping the agent's pinned lines.
9. Probes: a debug-proportional check with one mutation per new clause — depth-scaled report, `**Depth:**` line, no `✓ Step`, the agent's single report shape, scout invocation, runtime-confidence rule, shared-environment rule, final-answer heading — plus a line ceiling of 245 for `SKILL.md`.

## Acceptance
- AC-01 as stated in `plan.md`.
- `SKILL.md` is at most 245 lines, down from 285.
- The Codex projection test passes unchanged.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && node scripts/run-skill-self-tests.mjs`
- Named probe: the new debug-proportional check and its mutations; `debugAdaptiveContractIssues`; the four `cf:debug` probes; the `codex-native.test.js` debug install assertions run inside the suite's package Node tests
- Reachability: known — the suite already reads both files and every caller loads `SKILL.md` by name
- Oracle: `[skill-test] PASS` with more tests than the 1403 in `scout-subroutine`'s final receipts
- Counterexample: each new mutation makes the suite fail on its own issue
- Artifacts: none; the Receipt records the `sha256` of `packages/spec/src/claude/skills/debug/SKILL.md`, which task 03 checks before any paid run

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
✔ cf:debug adaptive incident contract is complete and bounded
✔ cf:debug adaptive incident checker rejects 9 semantic weakenings
✔ cf:debug report is proportional to its stated depth and shared with its agent
✔ cf:debug proportional checker rejects 20 weakenings
[skill-test] static semantic checks
✔ cf:debug is diagnosis-only and read-only for product code
✔ cf:debug enforces scout-first before hypotheses
✔ cf:debug blocks hotfix handoff when root cause is unknown
✔ cf:debug references installed debugger manuals
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
Skill: packages/spec/src/claude/skills/debug/SKILL.md
sha256: 82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8

The fenced block keeps the debug checker and probe lines, the Codex debug install test, the Node and hook totals and the final line; it drops the other passing lines (1054 in all, no `✖`). The one unpassed package Node test is the opt-in E2E skip.

Final-Head re-run: task 02 changed `run-skill-self-tests.mjs`, which this proof reads, so the Command was run again at the current Head (1426 tests, two of them task 02's fix mutations; the run at this task's close gave 1424). A second final-Head re-run followed the debug-eval-instrument packet, which changed `evals/debug` and so moved Head from `910715a1…` to `b33cf1b0…`; the block above was that run (1426 tests). A third final-Head re-run followed task 04, which changed `debugger.md` and `run-skill-self-tests.mjs` (Head `b33cf1b0…` → `885769db…`); the block above is that run (1434 tests, eight of them task 04's), which also proves tasks 02 and 04 by their own probe lines. Oracle: more than 1403 before any change (the pre-change run of the same Command passed at 1403; its static phase read the unchanged files, while edits began during its later phases). Counterexamples: the new checker applied to the `HEAD` versions of both files raises nine issues (`debug-agent-shape debug-depth-line debug-depth-scaled-report debug-final-heading debug-line-ceiling debug-runtime-confidence debug-scout-invocation debug-shared-environment debug-step-markers`) and none on the changed files; each of the 20 mutations raises its own issue. `SKILL.md` is 240 lines (285 before); `debugger.md` 130 (206 before); `codex-native.test.js`, `skills/fix/`, `skills/scout/` and `references/debugger/` are unchanged.

Deliberate deviation within (a): `Temporary Instrumentation` is written only when instrumentation was added; the template no longer offers `none`.

Repair rounds: (1) review PASS_WITH_WARNINGS — Step 4's elimination path contradicted the short report (Medium), plus an Incident/deep timeline without timestamps, the lost "every depth follows the six steps", an incomplete agent pointer and checker gaps; all fixed; (2) review PASS; the controller then fixed two of its Lows (a short report with an unknown root cause lists every hypothesis tested; the template's `## Debug Report` heading and the gate-scoped exception are pinned); a fresh review of the whole diff returned PASS.

Open Low findings, for GATE-DONE: the sentence "Only Incident/deep reports add … the other hypotheses tested" carries no unknown-cause exception, and the agent pointer (`debugger.md:103`, pinned) omits it, although `fix/references/diagnosis-protocol.md:29` sends unclear causes to that agent; the line-ceiling mutation appends a fixed 10 lines, so trimming `SKILL.md` to 235 lines or fewer would break it; a one-line Incident/deep timeline without timestamps is neither producer form `fix` lists (`fix/SKILL.md:175`); rules (f) and (g) are not in the agent, which keeps "Query relevant databases" (`debugger.md:43`); substring checks do not catch an added contradicting sentence. Until task 02 lands, `fix --from-debug` still requires Timeline and Elimination Path.
