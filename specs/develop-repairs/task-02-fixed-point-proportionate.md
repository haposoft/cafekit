# Task 02 — The fixed-point rule asks for proof proportionate to its cost

Status: pending

## Outcome
`develop/references/quality-gate.md` permits rebinding a stale Receipt whose declared artifacts still match their recorded `sha256`, and requires re-running the proof only where no such artifact exists.

## Scope
- In: the `## Final-Head fixed point` section of `quality-gate.md`, and the probe clause needed to pin the new wording, which lives in `packages/spec/scripts/run-skill-self-tests.mjs`.
- Out: `SKILL.md` (task 01), the `provenance` check in the scripts, which is doing its job and is not changed.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/references/quality-gate.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `specs/skill-routing/task-02-measure-the-two-doors-again.md` for the rebinding that cost $11.77 to obey literally, and `specs/develop-efficiency/task-01-fixture-packet.md` for the one that cost 0.3 seconds

## Steps
1. Read the current rule at `quality-gate.md:75-89` and confirm for yourself that no script implements it — the plan claims this and a claim about the machine should not be taken on trust.
2. **List what the probe suite pins in this section before rewriting a word.** Five clauses are pinned verbatim (`run-skill-self-tests.mjs:2425-2431`) and one anchor is matched byte-exactly **including where its line breaks** (`:2608-2614`): `"Stop only when consecutive Head captures are identical and every \`done\` Receipt\nnames that current Head."`. `replaceDevelopClauseOnce` (`:2523-2529`) **throws** rather than fails when an anchor is not found exactly once, so a reflowed paragraph stops the whole suite instead of failing one test. Keep that line break where it is.
3. Rewrite the rule so it distinguishes two cases by what the proof costs to repeat: a Receipt that declares artifacts with `sha256` may be rebound after re-verifying those hashes, because matching bytes prove the measurement did not move; a Receipt with no artifact must re-run its command, because nothing else can show it still holds.
4. Keep what the rule gets right: consecutive Head captures must agree, and a remembered or copied Receipt is never a fixed point.
5. Add a probe clause pinning the artifact-hash escape, so a later edit cannot quietly restore a rule that costs $11.77 to obey.
6. Run the Command and compare the observed output with the Oracle.

## Acceptance
- AC-04 as stated in `plan.md`.
- The rewritten rule is quoted in this task's Receipt, with the two cases it now separates.
- The rule still refuses a rebind for a Receipt with no artifact and no re-run.

## Dependencies
- task-01-skill-proves-verification-first.md

## Verification Plan
- Command: `cd packages/spec && node scripts/run-skill-self-tests.mjs`
- Named probe: the develop contract checker over all four develop files (`run-skill-self-tests.mjs:2349`), plus the clause added in Step 4
- Reachability: known — the same suite gates every develop file today
- Oracle: `[skill-test] PASS`, exit 0
- Counterexample: deleting the artifact-hash escape fails the new clause; so does restoring the unconditional re-run
- Artifacts: none; stdout is the evidence

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If it turns out a script does implement the fixed point, stop: the scope of this task was decided on the opposite belief and the user must see the correction.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
