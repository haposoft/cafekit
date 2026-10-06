# Task 03 — Scout becomes a short subroutine

Status: done

## Outcome
`scout/SKILL.md` is at most 70 lines: scope gate, no-scan lists and smallest route stay; a findings shape replaces the `Scout Report`; one rule says a host's own delegation mode is not the user's permission; one line places `inspector` and Explore; the Phase 1/2 procedure lives in the reference; `rules/workflow.md` names `cf:scout`.

## Scope
- In: rewrite `SKILL.md`; move the Phase 1/2 procedure into `references/internal-inspection.md`; delete the task-registration lines from `SKILL.md` (the reference already holds them at `:48-57`) and the three-minute timeout from both files; update the two existing probes and add clause probes with counterexamples; fix `rules/workflow.md:11`.
- Out: the directory name (task 01 owns it), the frontmatter `name` and `description`, `agents/inspector.md`, every caller.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/scout/SKILL.md`, `packages/spec/src/claude/skills/scout/references/internal-inspection.md`, `packages/spec/src/claude/rules/workflow.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `bin/__tests__/codex-native.test.js:1560-1570` and `:2258-2272`, `bin/__tests__/package-inventory.test.js:2284-2300`, `debug/SKILL.md:85-92`, `brainstorm/SKILL.md:94-97`

## Steps
1. Map every literal the suites pin in the two scout files (`run-skill-self-tests.mjs:4644-4662`, the two `bin/__tests__` files) before cutting anything.
2. Rewrite `SKILL.md`. The findings shape: relevant files each with `path:line` and one clause on why; the entrypoint and the call path to the code in question; blast radius (callers, tests, config a change would touch); unknowns — and the caller folds these into its own report. Host rule (D-02): a host or runtime mode that enables delegation on its own does not replace the user's permission; without it, scout stays in the main agent. Role line: `inspector` and Explore are delegation targets that run under the same gate and scope rules, not a replacement for them. Keep `**Fallback to AskUserQuestion:**` and its sentence verbatim in `SKILL.md` and nowhere in the reference (D-04, `codex-native.test.js:1560-1570`). Keep `NO_SCAN_PATHS` and `NO_SCAN_CONTENT_HINTS` byte-identical.
3. Move the Phase 1/2 procedure into the reference; delete the timeout line from both files.
4. `rules/workflow.md:11`: `inspect` → `cf:scout`.
5. Probes: extend the scout block with every AC-02 clause, pin both no-scan lists verbatim, and add a 70-line ceiling counted `trimEnd().split("\n").length`; add one mutation per clause — drop the findings shape, drop the host rule, drop the role line, drop a no-scan entry, drop the smallest-route table, reintroduce `# Scout Report`, reintroduce the timeout, exceed 70 lines — each must fail the suite.

## Acceptance
- AC-02 and AC-03 as stated in `plan.md`.
- The Codex projection tests pass unchanged.

## Dependencies
- task-02-debug-scout-case.md

## Verification Plan
- Command: `cd packages/spec && node scripts/run-skill-self-tests.mjs`
- Named probe: the `cf:scout` probe block in `run-skill-self-tests.mjs` and its new mutations; the scout assertions in `bin/__tests__/codex-native.test.js` and `package-inventory.test.js`, which run inside the suite's package Node tests
- Reachability: known — every caller loads `SKILL.md` by name, and the suite already reads both scout files
- Oracle: `[skill-test] PASS` with more tests than task 01's Receipt records
- Counterexample: each new mutation makes the suite fail on its scout issue
- Artifacts: none; the changed files are the deliverable

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: cd packages/spec && node scripts/run-skill-self-tests.mjs
Exit: 0
Base: e083bd9ffd60fd9129ddee14401cdf136e007412
Head: 076af72265aaa8eb2673b5315d46d93b8831142d6f6c9367042d7b4adf61cd38
```text
$ cd packages/spec && node scripts/run-skill-self-tests.mjs
[skill-test] static semantic checks
[skill-test] skill catalog checks
[skill-test] installer migration fixtures
[skill-test] instruction install fixtures
[skill-test] spec artifact validator fixtures
[skill-test] reconstruct docs validator fixtures
[skill-test] package Node tests
[skill-test] hook behavioral tests
[skill-test] chrome-devtools script tests
[skill-test] pdf bounding-box tests
[skill-test] retired completion-policy sentence is gone from the payload
[skill-test] source tree stays free of hook state
[skill-test] PASS: 1403 tests executed
EXIT:0
```
The suite rose from 1385 (task 01's Receipt) to 1403: the scout contract check plus seventeen mutations, each raising its own issue (`scout-findings-shape`, `scout-host-rule`, `scout-role-line`, `scout-no-scan`, `scout-smallest-route`, `scout-scope-gate`, `scout-report-template` ×2, `scout-timeout` ×3, `scout-line-ceiling`, `scout-two-phase-home` ×3, `scout-fallback-verbatim`, `scout-workflow-name`). The pre-change run of this Command passed with 1385 tests, as expected by construction; the Oracle's count is what separates before from after.

`scout/SKILL.md` is 61 lines (`trimEnd().split("\n")`), down from 142; its frontmatter, both no-scan lists and the `**Fallback to AskUserQuestion:**` sentence are byte-identical to `HEAD:packages/spec/src/claude/skills/inspect/SKILL.md`. The Phase 1/2 procedure now lives in `references/internal-inspection.md` under `## Two-Phase Broad Scout`; the three-minute timeout is gone from both files; `rules/workflow.md:11` names `cf:scout`.

Review: FAIL (2 High — the fallback sentence had been reworded, and nothing proved AC-03; 4 Medium — the reference contradicted its own gate, kept the old output shape, lost the read-only boundary, and the findings dropped Patterns), all fixed in one round, then PASS; 17/17 mutations replayed independently.

Limits: the **Patterns** line is not pinned by a probe, and the reference's agent report template has no `## Patterns` section although its Output Contract lists patterns (review Lows); `agents/inspector.md:53` still prints `# Scout Report` (plan Known limits); static checks prove the written contract, not that a live model follows it — task 02 measured 1 scout invocation in 4 runs.
