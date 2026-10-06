# Task 01 — The skill text carries the eight mechanisms at net zero lines per floor, and the probes pin them

Status: done

## Outcome
`SKILL.md`, `references/templates.md`, and `references/review.md` state the eight A⁺ mechanisms; the nine-file bundle stays at or below 750 lines, the three files at or below 550, and `SKILL.md` within 150–230; every sentence, heading, and layout token pinned before this task is still present verbatim; three new probes reject a weakened copy of each new rule. The self-test suite passes.

## Scope
- In: the add ledger and the cut ledger below; the pinned Tasks-table literals (`packages/spec/scripts/run-skill-self-tests.mjs:4411` header check, `:4263` at HEAD `279a115`; mutation anchor rows `:1235-1236` now); new clauses in `ADAPTIVE_COVERAGE_CLAUSES` (`:700-730` now, `:700-720` at HEAD `279a115`) with `has()` checks in the adaptive checker (`:843-885` now) and new 5-tuples in the semantic-weakening mutation list (`:920-980` now, the list behind "rejects N semantic weakenings").
- Out: consumers (`develop`, `rules/workflow.md`, `spec-maker` — task 02); eval cases (task 03); legacy `skills/specs/templates/*`; any hook or resolver; the `SKILL.md` line floor (`:5158-5160` now, a user decision); the frontmatter description (measured 2026-09-17, unchanged) and its `frontmatterGate` clause (`:704`, verbatim).

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/specs/SKILL.md` (Step 0 `:14-28`, Flow 1 `:55-64`, Flow 3 `:84-88`, Flow 4–5 `:90-110`)
- Modify: `packages/spec/src/claude/skills/specs/references/templates.md` (intro `:1-11`, plan template `:13-50`, task template `:52-92`, trace paragraph `:94-102`, EARS `:139-150`, dimensions `:187-202`, quality checks `:204-219`)
- Modify: `packages/spec/src/claude/skills/specs/references/review.md` (a short author fact-check rule before `## B2` at `:42` or inside `## Aggregate before GATE-REVIEW` at `:75-87`)
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs` (current lines after this task: `:700-730` clauses, `:843-885` new checks, `:920-980` mutations, `:1157-1158` anchor row, `:4411` header literal)
- Read: the pin facts in `plan.md` § Measured constraints; `agents/spec-maker.md` (an input of the same checker)

## Steps
1. Run the Command once before editing → record `total 750/750`, `rejects 23 semantic weakenings`, and `wc -l` of the three files (150 / 219 / 127) as the baseline.
2. Apply the cut ledger (its ranges are as of HEAD `279a115`, before this task shifted them), nothing else, then run the Command → the only failure allowed is the bundle-delta arithmetic; no pinned clause, heading, or token may go missing. Per-file targets: `SKILL.md` −5, `templates.md` −23.
   - `SKILL.md:90-110` Flow 4–5 → condense by five lines while keeping verbatim the phrase `## Receipt` (`SKILL.md:95`, probe `:4355`) and "Placeholder or remembered output is not evidence." (`SKILL.md:105`, probe `:5318`); keep: an implementation workflow owns execution; one unblocked task, single `Status:` writer; the user decides at GATE-DONE.
   - `templates.md:3-11` → three lines that still contain verbatim `specs/<feature>/`, `plan.md`, and `task-NN-<slug>.md` (lint `:2579-2583`, probe `:4259-4265`); the tree drawing goes, the tokens stay (−6).
   - `templates.md:139-150` → keep the heading `## EARS sentence patterns`, the five names `Ubiquitous`, `Event-driven`, `State-driven`, `Unwanted behavior`, `Optional feature` (`:5107`), and the threshold sentence; drop the prose around them (−4).
   - `templates.md:189-197` → keep the heading `## Twelve edge-case dimensions`; name the twelve dimensions in three lines; keep `:199` (`Crash` …) verbatim (−6).
   - `templates.md:204-219` → keep the heading `## Quality and saturation checks`; fold the eight checks and the new fact-check sample into eight compact lines (−7).
3. Apply the add ledger. Quoted phrases become pinned clauses; keep each on one line so `has()` matches after whitespace normalization. Per-file totals: `SKILL.md` +5 (net 0, stays at 150), `templates.md` +16 (net −7), `review.md` +3 → bundle 746/750.
   - `SKILL.md` Step 0, after `:16`: "Request size is not a risk signal; a one-line request that touches a shared contract is `elevated`."
   - `SKILL.md` Flow 1, replacing `:63-64`: "Ask GATE-SCOPE exactly once: list every `decision-needed` item as `[NEEDS CLARIFICATION: <question>]`, offer EXPAND, KEEP, and CUT together, and never choose a product outcome on the user's behalf." followed by the existing sentence about recording scope and exclusions.
   - `SKILL.md` Flow 3, before the review sentence: "Before GATE-REVIEW, re-run a sample of the plan's `path:line` citations sized by the claim budget in `review.md`; relabel any stale citation `[UNVERIFIED]`."
   - `templates.md` plan template, after `## Out of scope`: a `## Decisions` table with header `| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |` and one placeholder row.
   - `templates.md` plan template Tasks header → `| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |`; the example row gains a `P1` cell; after the table: "`Priority`: P1 the outcome is unusable without it; P2 needed for acceptance; P3 improves it. Number tasks in priority order; the table follows filename order."
   - `templates.md` task template, after `## Ownership`: `## Steps` with `1. <ordered action on one owned file → expected observation>`.
   - `templates.md` after the trace paragraph (`:94-102`): "Verification compares observed output with the Oracle; a judgment such as \"looks right\" is not a verification."
   - `templates.md` task template, before `## Receipt`: `## Failure Protocol` with the block "On a failed Step or Verify: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user." and, outside the fence, one example: "Example: the Command exits 1 with `expected 3 files, found 2` → record it, add the missing writer, rerun the same Command; do not delete the assertion."
   - `review.md`, before `## B2` or inside `## Aggregate before GATE-REVIEW`: the author samples about 5 / 10 / 15 citations following the claim-budget table at `:33-38` and relabels stale ones `[UNVERIFIED]`.
4. Update the self-tests: the header literal and the anchor rows (`:4263` and `:1088-1089` at HEAD `279a115`; `:4411` and `:1235-1236` after this task) (`from` and `to` both gain the `P1` cell) take the new Tasks shape; add clauses `scopeAskOnce`, `sizeNotRisk`, `factCheckSample`, `decisionsTable`, `verifyCompare`, `failureProtocol` to `ADAPTIVE_COVERAGE_CLAUSES`; add `has()` checks producing issues `scope-ask-once`, `decisions-steps-failure-protocol`, `fact-check-sample`; append seven 5-tuples to the list (`:920-980` after this task) whose weakened text drops `CUT`, turns the failure protocol into improvisation, trusts stale citations, makes `Priority` optional, replaces the worked failure example with a pointer, drops the `## Steps` heading, and lets a copy of `## Steps` escape the task template.
5. Run the Command → `[skill-test] PASS`, `total N/750` with N ≤ 750, `rejects 30 semantic weakenings`; run `wc -l` on the three files → sum ≤ 550 and `SKILL.md` within 150–230.
6. Run `evals/run.sh specs --validate` (exit 2 until task 03 repairs `run.sh`; the pass signal here is the absence of any `✗` line) → the temporary plugin still loads the skill.

## Acceptance
- AC-01, AC-02, AC-03, AC-04 as stated in `plan.md`.
- **Nothing pinned moved.** The suite is the authority on pins; it passes without any probe being weakened or deleted. The 2026-09-18 pin inventory (15 / 56 / 13 sentences by one counting rule, 22 / 63 / 18 by the reviewer's) is an authoring aid, not an acceptance number.
- **Every new rule has a counterexample.** The mutation count rises from 23 to 30, one per sentence or section AC-02/AC-03/AC-04 names (the three ask/protocol/citation rules, the P1-P3 rule, the worked failure example, a dropped `## Steps` heading, and a copy of it escaping the task template); each weakened text is a plausible edit a tired editor could make, not gibberish.
- **The budget is printed, not assumed.** The receipt's fenced output contains the `total N/750` line, and the `stays lean` probe passes at the printed `SKILL.md` length.

## Dependencies
- none

## Verification Plan
- Command: `node scripts/run-skill-self-tests.mjs`
- Named probe: `cf:specs adaptive coverage contract is complete and monotonic` (`run-skill-self-tests.mjs:1020`), `bundle line budget` (`:1016`), `cf:specs adaptive coverage checker rejects N semantic weakenings` (`:1021`), `cf:specs SKILL stays lean after slim-flow diet` (`:5158-5160`), and the new issues `scope-ask-once`, `decisions-steps-failure-protocol`, `fact-check-sample`
- Reachability: known — run from `packages/spec`; `pnpm test` in that package runs the same script (`packages/spec/package.json` → `"test": "node scripts/run-skill-self-tests.mjs"`)
- Oracle: exit 0, `[skill-test] PASS`, `total N/750` with N ≤ 750, `rejects 30 semantic weakenings`
- Counterexample: delete the word `CUT` from the Flow 1 sentence → the suite fails with issue `scope-ask-once`; restore it → PASS
- Artifacts: none; stdout is the evidence and is copied into the Receipt

## Failure Protocol
On a failed Step or Verify: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If the budget or a floor cannot be met without touching a pinned sentence, heading, or token, that is a GATE-SCOPE question, not an edit.

## Receipt

Verification: PASS
Command: node scripts/run-skill-self-tests.mjs
Exit: 0
Base: 279a115290b1caad3c46fa93e0ce13882284aa59
Head: a84f23b3fa6d84aceee66362d747bba274d8d6b1a07f46d937a2ffc3bef47abe
```text
$ node scripts/run-skill-self-tests.mjs
✔ cf:specs adaptive coverage contract is complete and monotonic; bundle deltas: src/claude/skills/specs/SKILL.md -20, src/claude/skills/specs/references/review.md +5, src/claude/skills/specs/references/templates.md +10; total 745/750
✔ cf:specs adaptive coverage checker rejects 30 semantic weakenings
✔ cf:specs SKILL stays lean after slim-flow diet
[skill-test] PASS: 1360 tests executed
```
Excerpt of the four lines this task's Named probe names, taken from the 1045-line log of that same run; run from `packages/spec`, exit 0. Base and Head derived with `node packages/spec/src/claude/scripts/provenance.cjs --project-root . --specs-root specs --spec-file specs/specs-a-plus/task-01-skill-text-and-probes.md --feature-name specs-a-plus --session develop-task-01 --json`, captured twice with identical values.

- Measured deltas: `SKILL.md` 150 → 150 (its floor is 150, so it absorbed its own additions), `templates.md` 219 → 212, `review.md` 127 → 129; three files 496 → 491 of 550; nine-file bundle 750 → 745 of 750; suite 1353 → 1360 tests; semantic-weakening mutations 23 → 30.
- Ledger deviation: Step 2/3 planned `SKILL.md` −5/+5 and `review.md` +3. Actual was −3/+3 in `SKILL.md`, because the redundant sentence "Present the answers and ask the user to EXPAND, KEEP, or CUT." was replaced rather than kept (grep confirmed no probe pinned it), and +2 in `review.md`. The binding constraints — net zero at the `SKILL.md` floor, both ceilings, every pin present — all hold.
- Review: fresh-context reviewer, three rounds inside the task's cap. Round 1 FAIL (1 High: the new probe was vacuous for the P1–P3 rule and the worked failure example, which AC-03 names). Round 2 FAIL (1 High: this task's own Oracle still said `rejects 26` after the repair raised it to 29). Round 3 PASS after the counts were synchronized with the measurement and the section checks were bounded, deduplicated, and level-pinned.
- Open limitations, none blocking this task, all for GATE-DONE: (1) `inTaskTemplate` still accepts a `## Steps` heading moved into the ~13 prose lines between the task template's closing fence and `## Status matrix`; every realistic variant (deleted, duplicated, demoted, moved into the plan template, moved below both templates) is rejected. (2) `SKILL.md:39` "Ask once at each gate." is now the general form of the narrower Flow 1 rule; `:39` is outside this task's Ownership. (3) The six packet task files still carry the earlier "On a failed Step or Verify:" wording that the template has since replaced. (4) `plan.md` D-02's break-signal ("A parser appears → keep `Priority` as the last column") would break the Status-last parser at `run-skill-self-tests.mjs:1067` if it were ever executed; it is inert today and stays as accepted at GATE-REVIEW.
