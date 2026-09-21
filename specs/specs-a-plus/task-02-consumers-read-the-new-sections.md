# Task 02 — Develop, the workflow rule, and spec-maker read what the templates now produce

Status: done

## Outcome
A task's `Steps` and `Failure Protocol` are loaded by Develop and extracted by the workflow rule; spec-maker requires a priority, ordered Steps, and a Failure Protocol per task. One consumer probe fails when any of these phrases is removed.

## Scope
- In: one sentence each at `develop/SKILL.md:62`, `rules/workflow.md:22-29` (two bullets), `agents/spec-maker.md:49-52`; one consumer probe block in the self-tests.
- Out: the Sync skill — its Audit already reports an acceptance ID not mapped both ways as traceability drift (`skills/sync/references/sync-protocols.md:50`); Develop's selection table (`:70-78`), its Flash and parallel modes, its quality-gate references; the Codex rules (`src/codex/rules/` holds only `hook-protocols.md` and `state-sync.md`, so `workflow.md` has no mirror); the installed `.claude/rules/` copy.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/SKILL.md` (`:61-62` only; `:60` is pinned — "Load the plan index into working context once." — and the file must stay within 140–200 lines, `run-skill-self-tests.mjs:5163-5165`)
- Modify: `packages/spec/src/claude/rules/workflow.md` (`:22-29`)
- Modify: `packages/spec/src/claude/agents/spec-maker.md` (`:49-52`; the checker reads this file as `specMaker`, pinned sentences at `:11`, `:20-23`, `:39`, `:55-57`, `:66-67`, `:71-76`, `:90` stay)
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs` (a new, self-contained consumer probe; task 01's blocks are not touched)

## Steps
1. `develop/SKILL.md:62` → add both sections to the loaded-section list in the template's own section order ("…Scope, Ownership, Steps, Acceptance, Dependencies, Verification Plan, Failure Protocol, owned code, and consumers.").
2. `rules/workflow.md:22-29` → add `Steps` after `Ownership` and `Failure Protocol` after `Verification Plan`, mirroring the template's section order.
3. `agents/spec-maker.md:49-52` → "Each task owns one outcome, a priority, normally no more than about five files, explicit acceptance IDs, dependencies, ordered Steps, a runnable Verification Plan, and a Failure Protocol."
4. Add the consumer probe: read the three files, require the phrases, and assert that a copy of `develop/SKILL.md` without `Failure Protocol` fails; print `✔ cf:specs consumers load Steps and Failure Protocol`.
5. Run the Command → PASS; confirm the develop line count is still within 140–200.

## Acceptance
- AC-05 as stated in `plan.md`.
- **Develop's pinned lines are untouched.** `:60` and the selection table keep their bytes; the change is confined to `:61-62`.
- **The probe proves absence, not presence only.** Its counterexample runs inside the suite (a mutated copy), so a future deletion of one phrase fails the suite.

## Dependencies
- task-01-skill-text-and-probes.md

## Verification Plan
- Command: `node scripts/run-skill-self-tests.mjs`
- Named probe: `cf:specs consumers load Steps and Failure Protocol` (new); `cf:specs adaptive coverage contract is complete and monotonic` (`:1020`, spec-maker is one of its inputs); `cf:develop SKILL stays within directional context budget` (`:5163-5165`)
- Reachability: known — same script and package as task 01
- Oracle: exit 0, `[skill-test] PASS`, the new `✔` line present
- Counterexample: remove `Failure Protocol` from `develop/SKILL.md:62` → the suite fails naming the consumer probe; restore → PASS
- Artifacts: none

## Failure Protocol
On a failed Step or Verify: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If a pinned develop sentence must change to fit the wording, stop and ask instead.

## Receipt

Verification: PASS
Command: node scripts/run-skill-self-tests.mjs
Exit: 0
Base: 279a115290b1caad3c46fa93e0ce13882284aa59
Head: 510fad671b5cc0502b504b5956c836cd1b482e1db23b5c85cf83fb416edd475f
```text
$ node scripts/run-skill-self-tests.mjs
✔ cf:specs adaptive coverage checker rejects 30 semantic weakenings
✔ cf:specs consumers load Steps and Failure Protocol; rejects 5 weakenings
✔ cf:develop SKILL stays within directional context budget
[skill-test] PASS: 1366 tests executed
```
Excerpt of the lines this task's Named probe names, from the 1050-line log of that same run; run from `packages/spec`, exit 0. Base and Head derived with `node packages/spec/src/claude/scripts/provenance.cjs --project-root . --specs-root specs --spec-file specs/specs-a-plus/task-02-consumers-read-the-new-sections.md --feature-name specs-a-plus --session develop-task-02 --json`, captured twice with identical values.

- Measured: `develop/SKILL.md` 178 lines (window 140-200), `rules/workflow.md` 84 → 86, `agents/spec-maker.md` 107 → 107; the nine-file specs bundle is unchanged at 745/750 because no consumer file belongs to it; suite 1360 → 1366 tests, the new probe contributing five counterexamples plus itself.
- The probe reads each consumer file separately rather than concatenating them, so a phrase in the wrong file cannot satisfy another file's obligation; a fresh reviewer proved that by moving the develop clause into the rule file, which still failed.
- Review: fresh-context reviewer, two rounds. Round 1 FAIL (this task's Step 1 quoted a sentence that does not exist in `develop/SKILL.md:62`: the ledger said `Steps` went after `Verification Plan` while the installed order puts it after `Ownership`; the installed order is the better one, so the description was repaired, not the code). Round 2 PASS after the quote, three stale probe citations, and the rule check were fixed.
- Open limitations, none blocking, all for GATE-DONE: (1) the rule clauses now pin field order as well as presence, which is stricter than AC-05 requires and fails closed on a reformat; (2) "a priority" in `spec-maker.md:49` could be misread as a `Priority:` field in the task file, while the template keeps priority as a Tasks-table cell; (3) `rules/workflow.md` lists the two fields but its Execute and Verify sections do not yet say what to do with them; (4) a duplicate `  - `Steps`` bullet elsewhere in the rule file would still pass, harmless markdown litter; (5) the citations labelled "now" in task-01 and the develop-budget range in this task shifted again with this task's own edits and will be refreshed once before GATE-DONE, since no later task owns `run-skill-self-tests.mjs`; (6) the six packet task files still carry the earlier "On a failed Step or Verify:" wording.
