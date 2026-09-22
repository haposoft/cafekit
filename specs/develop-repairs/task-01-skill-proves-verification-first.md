# Task 01 — The skill proves the verification runs, counts rounds, and scouts its judge

Status: pending

## Outcome
`packages/spec/src/claude/skills/develop/SKILL.md` tells an implementer to run the task's verification command once before writing code, states what makes a repair round countable, places the Receipt after review where a single reading cannot miss it, and adds the judging test or probe to the Scout list — all inside the 200-line ceiling.

## Scope
- In: prose in `develop/SKILL.md`; new probe clauses and their counterexamples in `run-skill-self-tests.mjs`.
- Out: `quality-gate.md` (task 02), `spec-receipt.cjs` (task 03), any other skill, the 200-line ceiling itself.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `specs/develop-efficiency/task-03-measure-efficiency.md` for the figures that justify each edit, and `run-skill-self-tests.mjs:1026`, `:4371`, `:4497` for the three literals that must survive byte-for-byte

## Steps
1. **Build the pin map before editing one character.** Project every literal the probe suite shares with `develop/SKILL.md` onto its lines and list, per section, how many lines are pinned and how many are free. The map made today reports 47 shared strings covering 68 of 179 lines, leaving 111 free — regenerate it rather than trusting that number, because the suite may have moved. Cutting without this map is how a pinned sentence dies, and this packet has already watched a capital letter and a full stop break 1366 tests.
2. **Check the budget that actually binds.** It is not `develop/SKILL.md` against 200; it is four files against 400, currently 399 (`run-skill-self-tests.mjs:2516-2518`). Every line added here must be paid for in the same four files.
3. **Take the payment from `### Flash`, per D-07.** Reduce it to the shape `### Parallel` already uses — a pointer to `references/quality-gate.md` plus the one-sentence contract — because that reference states the same rule more fully, including a record template the skill omits. Confirm against the pin map that no Flash sentence is pinned before cutting it.
4. Add the verification-first step to `### 2. Implement`: run the task's exact Verification Plan command once before changing anything, expect it to fail, and read the failure. A command that fails for a reason unrelated to the task is a blocker to raise, not a puzzle to solve while implementing. This is the edit the measurement paid for — one such defect left the code correct in 20 of 20 runs and the task closed in 2 of 10.
5. Define a repair round in `### 3`: one round is one observed failure plus the repair and the re-run it causes, whether the failure came from proof or from review. The cap counts rounds, not commands.
6. Move the Receipt instruction so that its position after both proof and review is visible from the section's shape, not only from the middle of a sentence.
7. Add to `### 1. Scout`, after the pinned sentence and without altering it, that the scout reads the test or probe that will judge the work.
8. Add one probe clause per edit with a counterexample mutation, in the style the specs suite already uses, so removing any edit fails the suite.
9. Run the Command and compare the observed output with the Oracle.

## Acceptance
- AC-01, AC-02 and AC-03 as stated in `plan.md`.
- `develop/SKILL.md` stays between 140 and 200 lines **and the four-file total stays at or below 400**; the pin map is quoted in the Receipt with the before and after counts for every section touched.
- Each new clause has a mutation that the suite rejects; a clause with no counterexample is decoration.
- **No claim about behaviour is made here.** Whether the edits change what a run does is task 04's measurement.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && node scripts/run-skill-self-tests.mjs`
- Named probe: the new clauses added by this task, plus the two line budgets (`run-skill-self-tests.mjs:5163-5165` for 140–200 and `:2516-2518` for the four-file 400), `cf:develop scouts reachability and enforces task scope` (`:4499-4500`), and the consumer-section checker (`:1046`)
- Reachability: known — the same suite ran four times in `skill-routing` today
- Oracle: `[skill-test] PASS` with a test count above the current 1366, exit 0, and `wc -l` on the skill between 140 and 200
- Counterexample: removing any one of the four additions, or reflowing a pinned literal, fails the suite; the mutations added in Step 6 are what prove this rather than assert it
- Artifacts: none; stdout is the evidence

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If the edits cannot fit inside both ceilings without cutting a pinned literal, that is a scope question for the user, not a licence to raise either ceiling. If the pin map shows a Flash sentence is pinned, keep it and find the remaining lines among the 111 free ones rather than forcing the cut.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
