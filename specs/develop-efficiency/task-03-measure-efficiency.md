# Task 03 — The four efficiency numbers are measured and recorded per model

Status: pending

## Outcome
`evals/results/develop/sach-*` and `hong-*` hold ten runs per model of each case, and the Receipt records, per model and per case, the tool calls, wall-clock duration, cost including judge, and verification invocations per run, with correct and incorrect runs counted separately.

## Scope
- In: one `evals/run.sh` invocation per case per model, the summarizer call, reading the per-run figures out of each `result.json`, and recording them.
- Out: any edit to the cases, the fixture, the harness or the skill; any conclusion about what to change in `cf:develop`, which is a later packet.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/develop/sach-sonnet/`, `sach-opus/`, `hong-sonnet/`, `hong-opus/` (gitignored)
- Read: `evals/summarize.mjs`, and today's figures in `specs/skill-routing/task-02-measure-the-two-doors-again.md` for the shape of an honest measurement Receipt

## Steps
1. Confirm none of the four result directories exists.
2. Run **step 1 only**, then stop and read three things before launching anything else: the real `costUsd` plus `judgeCostUsd` per run, the per-tool counts from the `tool_used` graders, and how many runs ended at the `max_turns` ceiling. D-05 caps this by absolute figures, not ratios: stop and ask the user if any single run exceeds **$1.20** or the running total passes **$35**. Also settle the `[UNVERIFIED]` question from task 02 here — whether the workspace can produce a runtime `Base`/`Head` at all — because it decides whether a valid close is even possible before three more steps are paid for.
3. Run the remaining three invocations. Four flag facts are load-bearing and were each paid for once already in earlier packets: `--with-skill` is consumed only while it is the first remaining argument (`evals/run.sh:38`); `--ablation none` keeps one arm rather than two; `--threshold 0` keeps the harness exit code out of the oracle; and `--case` takes one glob, so each case needs its own invocation.
4. For every run, read the per-tool counts out of the `tool_used` grader explanations, plus `costUsd`, `judgeCostUsd` and `durationSeconds` from `result.json`, and pair each with its correctness verdict. Report median and range, not the mean alone, because one stuck run distorts a mean and the spread is the interesting part. **`turns` may be recorded as a raw field but must never be presented as a tool count**: in `evals/results/specs/dinh-tuyen-sonnet/result.json` ten of twenty runs read `turns: 1` while averaging $0.167 and 96 seconds.
5. State the repair-round figure plainly: verification invocations per run in the broken case, minus one, beside the clean case's baseline.
6. Copy the summarizer stdout into the Receipt unchanged and declare each `result.json` with its `sha256`.

## Acceptance
- AC-04 and AC-05 as stated in `plan.md`.
- **Efficiency figures are reported only for runs that passed the correctness graders**, with the excluded runs counted and named.
- The cost figure includes the judge, because the report's own `costUsd` omits it.
- Runs that ended at the `max_turns` ceiling are counted and named separately from runs that finished, because a censored run measures the ceiling rather than the skill.
- The Receipt states plainly that these figures are the skill's **floor with the completion gate absent**, per the limitation in `plan.md`; no figure here may be compared with a real session without that sentence attached.
- **No conclusion is drawn here.** Whether the numbers mean `cf:develop` needs changing, and how, is a GATE-DONE reading and then a new packet.

## Dependencies
- task-02-two-cases.md

## Verification Plan
- Command, step 1 of 4 — **run this alone and stop**: `evals/run.sh develop --out sach-sonnet --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 8 --allow-tools Write Edit Bash --case mot-task-sach`
- Command, step 2: `evals/run.sh develop --out sach-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 10 --allow-tools Write Edit Bash --case mot-task-sach`
- Command, step 3: `evals/run.sh develop --out hong-sonnet --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 10 --allow-tools Write Edit Bash --case mot-task-hong`
- Command, step 4: `evals/run.sh develop --out hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong && node evals/summarize.mjs evals/results/develop/sach-sonnet evals/results/develop/sach-opus evals/results/develop/hong-sonnet evals/results/develop/hong-opus`
- The four steps are **separate commands, not one `&&` chain**. An earlier draft chained them, which would have spent the whole budget before the checkpoint in Step 2 below could fire. Each `--max-cost-usd` is the ceiling the harness itself enforces by aborting with `partial: true`; the four sum to $42 against the user's $35 ceiling, so the running total is checked between steps as well.
- Named probe: the correctness graders from task 02, counted by `evals/summarize.mjs`
- Reachability: known — the identical command shape ran four times today against the `cf:specs` suite; `--max-cost-usd` is the same flag the `--validate` path already uses with a ceiling of 0
- Oracle: all five commands exit 0; all four directories `partial: false`, each holding one case, one arm named `with`, ten runs. A `partial: true` directory means a cost ceiling or a turn ceiling stopped the run, and it is reported as a censored measurement rather than quietly averaged in
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason, leaving the table incomplete
- Artifacts: the four `result.json` files, gitignored, each declared in the Receipt on its own `Artifact:` line with a `sha256:` line beneath it, because nothing outside the Receipt records those bytes

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A harness abort is recorded with its `partialReason` and the affected `--out` directory is removed explicitly before any rerun; once a directory holds a non-partial `result.json`, those numbers are the measurement. A figure that is worse than expected is a finding, not a failure.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
