# Task 03 — A Verification Plan may declare several commands

Status: done

## Outcome
`spec-receipt.cjs` accepts a Receipt whose `Command:` matches the last top-level command declared in its Verification Plan, and still returns `command_identity` when the Receipt names a command the plan does not, proved by tests in both directions.

## Scope
- In: the command-identity logic in `packages/spec/src/claude/scripts/spec-receipt.cjs` and new cases in `packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`.
- Out: the `provenance` and `artifact_hash` checks; `workflow-policy.cjs`; installed copies in other projects; the skill text.

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/scripts/spec-receipt.cjs`, `packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`
- Read: `specs/develop-efficiency/task-03-measure-efficiency.md` for the Receipt that was rejected, and the current matcher around `spec-receipt.cjs:152-168`

## Steps
1. Read the current matcher and write down, before editing, exactly which inputs it accepts and rejects today. **This file gates every task in every project that installed it**, so a change must be additive: what is rejected today and should stay rejected must still be rejected.
2. Widen the plan side only: collect every command the Verification Plan declares, rather than requiring exactly one. Keep the Receipt side unchanged — a Receipt still declares one command.
3. **Bind the Receipt to the last declared command, not to any of them.** Accepting any would let a plan declare `node -v` beside `npm test` and close on the cheap one — a Receipt that is rejected outright today, so accepting it would be a new hole rather than a repaired one. The final `- Command:` is the canonical proof because the earlier ones are prerequisites.
4. Keep the failure closed. With no command found in the plan the result stays `command_identity`, as it is today; silence must never become a pass.
5. Add tests in three directions: a plan with several commands and a Receipt naming the **last** one passes; a Receipt naming a command absent from the plan fails; a Receipt naming an **earlier** declared command fails, which is what stops the cheap-command hole. The single-command case must behave exactly as before.
6. Run the Command. All 68 existing hook tests must still pass — a regression here is worse than the defect being fixed.

## Acceptance
- AC-05 as stated in `plan.md`.
- The 68 existing tests in `spec-gate.test.js` pass unchanged, and the new ones cover accept, reject and the unchanged single-command path.
- The diff is additive on the plan side; no previously rejected Receipt becomes acceptable except the multi-command case this task exists for.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && node --test src/claude/hooks/__tests__/spec-gate.test.js bin/__tests__/develop-contract.test.js`
- Named probe: the new multi-command cases plus the existing `command_identity` cases, and `bin/__tests__/develop-contract.test.js`, which builds process-first tasks whose Receipts pass through the same matcher and would otherwise only fail ten minutes later inside the full suite
- Reachability: known — this suite runs inside the full self-test run and can also be run alone
- Oracle: exit 0 with every test passing and the total above the current 68
- Counterexample: reverting the matcher to require exactly one plan command fails the new accepting test; loosening it to accept any command at all fails the new rejecting test
- Artifacts: none; stdout is the evidence

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A regression in any of the 68 existing tests stops this task immediately: the defect being fixed is an inconvenience, and a broken gate is not.

## Receipt

Verification: PASS
Command: cd packages/spec && node --test src/claude/hooks/__tests__/spec-gate.test.js bin/__tests__/develop-contract.test.js
Exit: 0
Base: ca5dae8320faf81f9e2694f7bd218208337fc457
Head: ab2e0bc44f81659caf919908ab1d56611a95f4a8aacc57b7fb5cc6c8a142ff66
```text
$ cd packages/spec && node --test src/claude/hooks/__tests__/spec-gate.test.js bin/__tests__/develop-contract.test.js
✔ 52. a plan with several commands binds the Receipt to the last one (3064.007917ms)
✔ 53. an indented or sub-heading Command never becomes the canonical one (3999.282375ms)
ℹ tests 139
ℹ pass 139
ℹ fail 0
$ echo $?
0
```
No artifact is produced: the changed files are the deliverable.

- `workflowVerificationCommand` now binds the Receipt to the **last top-level** `- Command:` in the Verification Plan. One declared command behaves as before; none declared still returns `null` and fails closed with `command_identity`.
- **Top-level only, which review forced.** The first version kept the old `^\s*` pattern and ended the section only at `#{1,2}`, so an indented `- Command: true` under a Counterexample, or a `- Command: true` under a `### Cleanup` step after the main block, became the canonical command and let a Receipt close on `true` — reopening the cheap-command hole this change was meant to close. Now only unindented commands count, and commands under a `###` sub-heading are used only when the main block declares none, so a plan written the old way with its command under a sub-heading still works.
- Tests: test 52 covers last closes, earlier blocks, undeclared blocks; test 53 covers the indented and sub-heading forms, each blocking the cheap command and passing the main one. A counterexample was run by hand against the first version — binding to the first command made test 52 fail — and the file was restored.
- 139 tests pass: the 68 existing hook tests, 69 in `bin/__tests__/develop-contract.test.js`, and the two new ones.
- Untouched: the legacy separate-receipt path at `spec-receipt.cjs:251`, which reads `plannedField` rather than this matcher.
- Not documented yet for plan authors: `references/templates.md` still shows a single `- Command:` and does not say the last one is canonical. That file sits at 745/750 in the bundle budget; recorded rather than squeezed in.
- **This reaches a project only when it reinstalls**; this repository's own gitignored `.claude/scripts/spec-receipt.cjs` is still the 18/09 copy.
