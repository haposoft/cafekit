# Task 02 — Fix accepts a debug report sized to its depth

Status: done

## Outcome
`cf:fix --from-debug` requires `Evidence Timeline` and `Elimination Path` only when the report's `**Depth:**` is `incident/deep`, so a Quick/local or Standard report that omits them is accepted instead of being routed back to diagnosis.

## Scope
- In: the `--from-debug` validation list in `skills/fix/SKILL.md:172-180`; one clause and one mutation in the fix checker of `run-skill-self-tests.mjs`.
- Out: every other part of `fix`; the pinned strings `` `Timeline: skipped - <reason>` or `- skipped: <reason>` ``, `` `Elimination Path` records the decisive observation ``, `` `Recurrence-Prevention Handoff`, when present, carries evidence-backed candidates only. `` and `` routes back to diagnosis (`cf:debug`) ``, which stay byte-for-byte so `bin/__tests__/package-inventory.test.js:2689-2691, :2768` and `bin/__tests__/codex-native.test.js:2798-2801` pass unchanged.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/fix/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs` (the fix checker only)
- Read: `run-skill-self-tests.mjs:3236-3250`, the two `bin/__tests__` files above, task 01's `**Depth:**` line

## Steps
1. Prefix the Timeline and Elimination Path bullets with "when `**Depth:**` is `incident/deep`," and add one bullet: a Quick/local or Standard report may omit both; a report with no `**Depth:**` line is treated as `incident/deep`.
2. Add the clause to the fix checker and one mutation that drops the depth condition.
3. Run the suite.

## Acceptance
- AC-03 as stated in `plan.md`.
- The four pinned fix strings are unchanged.

## Dependencies
- task-01-proportional-report.md

## Verification Plan
- Command: `cd packages/spec && node scripts/run-skill-self-tests.mjs`
- Named probe: the fix checker's `handoff-validation` issue and the new mutation; `package-inventory.test.js` `debug-handoff` group; `codex-native.test.js` fix install assertions
- Reachability: known — `fix/SKILL.md:172` is the step every `--from-debug` run reads
- Oracle: `[skill-test] PASS` with more tests than task 01's Receipt records
- Counterexample: the new mutation makes the suite fail on `handoff-validation`
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
✔ cf:fix adaptive contract is complete and bounded
✔ cf:fix checker rejects 30 semantic weakenings
[skill-test] static semantic checks
✔ cf:fix is packaged from the fix directory and the hotfix directory is retired
[skill-test] package Node tests
✔ Codex installed Fix preserves the adaptive repair contract (497.356292ms)
✔ packed Claude and Codex installs reject adaptive Fix semantic weakenings (5081.981416ms)
ℹ tests 525
ℹ pass 524
ℹ fail 0
[skill-test] hook behavioral tests
ℹ tests 226
ℹ pass 226
ℹ fail 0
[skill-test] PASS: 1434 tests executed
```

The fenced block keeps the fix checker lines, the two package tests that carry the `debug-handoff` group and the Codex fix assertions, the Node and hook totals and the final line; the log has no `✖`, and the one unpassed package Node test is the opt-in E2E skip.

Oracle: 1426 tests against 1424 in task 01's Receipt; the pre-change run of the same Command passed at 1424. Counterexample: `hotfixAdaptiveContractIssues` returns `handoff-validation` on the `HEAD` version of `fix/SKILL.md`; `handoff-drops-depth-condition` and `handoff-accepts-undeclared-depth` each raise it. The four pinned fix strings are unchanged; `package-inventory.test.js` and `codex-native.test.js` are unchanged.

Deviation within Scope: the Timeline bullet also accepts "one line naming the sources checked when none carries timestamps", the form `debug/SKILL.md` Step 2 now produces (task 01's open Low); a second mutation covers the missing-depth default. `packages/spec/src/claude/skills/debug/SKILL.md` sha256 is still `82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8`.

Repair rounds: none; one review, PASS. A second final-Head re-run followed the debug-eval-instrument packet, which changed `evals/debug` and so moved Head from `910715a1…` to `b33cf1b0…`; the block above was that run (1426 tests). A third final-Head re-run followed task 04, which changed `debugger.md` and `run-skill-self-tests.mjs` (Head `b33cf1b0…` → `885769db…`); the block above is that run (1434 tests, eight of them task 04's), which also proves tasks 01 and 04 by their own probe lines.

Open Low findings, for GATE-DONE: the timestamp-less clause and the Elimination Path depth condition have no mutation of their own; a `**Depth:**` value other than the three (the template line copied unfilled, `deep`) has no rule, while a missing line defaults to `incident/deep`; `fix` trusts the declared depth, so a report declared `standard` that Step 3 judges Incident/deep has no rule sending it back to `cf:debug`; substring checks do not catch an added contradicting sentence.
