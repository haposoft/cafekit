# Task 02 — The two-door case is measured again, and the negative cases are checked for over-trigger

Status: pending

## Outcome
`evals/results/specs/dinh-tuyen-sonnet` and `dinh-tuyen-opus` each hold **twenty** runs of `mo-ho-du-cua` with the rewritten descriptions and both doors loaded, and four `am-tinh-*` directories hold three runs each of `khong-kich-hoat` and `sua-typo` per model. The summarizer reports per model how many runs invoked each door, the Receipt derives how many invoked neither, and both sets are printed beside the 2026-09-21 baseline. What the movement means is read at GATE-DONE.

## Scope
- In: three `evals/run.sh` invocations per model — the ambiguous case at twenty runs, then one negative case each at three, because one invocation cannot select both — two summarizer calls, reading the retained final messages of every ambiguous run that invoked nothing, and recording both sets of counts against their baselines.
- Out: any edit to the skills, the cases, the graders or the harness; a second measurement round after a complete one, which is a new GATE-SCOPE decision rather than a repair.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/specs/dinh-tuyen-sonnet/`, `dinh-tuyen-opus/`, `am-tinh-kkh-sonnet/`, `am-tinh-typo-sonnet/`, `am-tinh-kkh-opus/`, `am-tinh-typo-opus/` (all gitignored)
- Read: `evals/summarize.mjs`, the baseline counts from `specs/specs-a-plus/task-10-measure-with-both-doors.md`, and the 0/24 negative baseline from `specs/specs-a-plus/plan.md`

## Steps
1. Confirm none of the six result directories exists; `--out` refuses to overwrite, and a leftover empty directory from an aborted run blocks the rerun.
2. Run the Command. Four flag facts are load-bearing and were each paid for once already: `--with-skill` is consumed only while it is the first remaining argument (the loop at `evals/run.sh:38`, guarded by `extra=()` at `:37`), so it precedes `--out`; `--ablation none` keeps one arm of twenty runs per model instead of two arms of forty; `--threshold 0` keeps the harness exit code out of the oracle; `--tag du-cua` selects the ambiguous case alone; and **`--case` takes one glob, so the two negative cases need one invocation each** — passing `--case a --case b` silently keeps only the last, confirmed here at $0: the validate output read `2 arms × 1 case` and named only `sua-typo`. A brace glob is not supported either; `--case '{khong-kich-hoat,sua-typo}'` returns `No eval cases found`. Cost estimate $10-14 for the ambiguous runs [range; basis: $5.19 including judge cost for twenty runs on 2026-09-21, doubled, widened because a description that routes more runs into a workflow makes those runs longer], plus an unmeasured amount for the twelve negative runs, which answer briefly and cost far less [UNVERIFIED].
3. Read the final message of every run that invoked neither door, from `cases[0].arms.with[i].graders[].evidence` in each `result.json`. The intermediate trace is deleted with its temporary directory, but the final message is retained; report what those runs did instead of routing.
4. Copy the Command's stdout into the Receipt unchanged and put the counts beside the baseline: sonnet 4/10 `cf:specs`, 0/10 `cf:brainstorm`, 6/10 neither; opus 7/10, 0/10, 3/10. Convert the new counts to the same scale before comparing, and state which side of the recorded resolution the result falls on — at or below 7/40 the drop is separable from the baseline, above it is not.
5. Report the negative-case counts against 0/24 plainly. A single invocation there is a regression even if the ambiguous counts improved, and it belongs in the Receipt whether or not anyone asks.

## Acceptance
- AC-04 and AC-06 as stated in `plan.md`.
- **Counts come from the summarizer**, both directories non-partial.
- The `Skill invoked` column is not read as the answer for the ambiguous case: `evals/summarize.mjs:19` recognises only the grader names `co-goi-skill` and `khong-goi-specs`, so it prints 0 with an honest note. The invocation count is `da-goi-mot-skill`, and **the count of runs that invoked neither door is not printed at all** — it is derived as `runs` minus `da-goi-mot-skill` and stated in the Receipt. The negative cases do carry `khong-goi-specs`, so their column is readable as printed.
- **No conclusion is drawn here.** Whether the rewrite worked, and whether another round is warranted, is a GATE-DONE reading.

## Dependencies
- task-01-rewrite-the-two-descriptions.md

## Verification Plan
- Command: `evals/run.sh specs --with-skill brainstorm --out dinh-tuyen-sonnet --model sonnet --judge-model sonnet --runs 20 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out dinh-tuyen-opus --model opus --judge-model sonnet --runs 20 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out am-tinh-kkh-sonnet --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --case khong-kich-hoat && evals/run.sh specs --with-skill brainstorm --out am-tinh-typo-sonnet --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --case sua-typo && evals/run.sh specs --with-skill brainstorm --out am-tinh-kkh-opus --model opus --judge-model sonnet --runs 3 --threshold 0 --ablation none --case khong-kich-hoat && evals/run.sh specs --with-skill brainstorm --out am-tinh-typo-opus --model opus --judge-model sonnet --runs 3 --threshold 0 --ablation none --case sua-typo && node evals/summarize.mjs evals/results/specs/dinh-tuyen-sonnet evals/results/specs/dinh-tuyen-opus && node evals/summarize.mjs evals/results/specs/am-tinh-kkh-sonnet evals/results/specs/am-tinh-typo-sonnet evals/results/specs/am-tinh-kkh-opus evals/results/specs/am-tinh-typo-opus`
- Named probe: graders `da-goi-mot-skill`, `da-goi-specs`, `da-goi-brainstorm`, `khong-tu-chot` and `khong-code`, counted by `evals/summarize.mjs`
- Reachability: known — the identical command with different `--out` names ran on 2026-09-21 and produced the baseline
- Oracle: all eight commands exit 0; all six directories `partial: false`; each ambiguous case carrying exactly one arm named `with` with twenty runs and each negative directory holding one case, one arm and three runs — one case rather than two is what proves the `--case` limit was respected instead of tripped, which is also how a missing `--ablation none` would be caught; `da-goi-specs + da-goi-brainstorm` at most `da-goi-mot-skill`, checked run by run and not only in total
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason, leaving the table incomplete
- Artifacts: the six `result.json` files, gitignored, each declared in the Receipt on its own `Artifact:` line with a `sha256:` line beneath it, because nothing outside the Receipt records those bytes and a bare `Artifacts:` line without hashes is rejected by the completion gate (`.claude/scripts/workflow-policy.cjs:327`)

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A harness abort is recorded with its `partialReason`, and the affected `--out` directory is removed explicitly before any rerun. The boundary between a permitted rerun and a forbidden second round is the artifact: a directory with no `result.json`, or one whose `result.json` is `partial: true`, may be deleted and rerun; once a directory holds a non-partial `result.json` those numbers **are** the measurement, and running that model again is a new GATE-SCOPE decision. If one model completes and the other aborts, rerun only the aborted one and record both start times and `claudeVersion` values, because a mixed sample is the break signal named in D-02. A count that moves the wrong way, or does not move, is a finding for GATE-DONE and not a failure of this task.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
