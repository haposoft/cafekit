# Task 04 — The repairs are measured against the figures they came from

Status: pending

## Outcome
`evals/results/develop/{sach,hong}-{sonnet,opus}-sau` each hold ten runs of the unchanged cases against the repaired skill, and the Receipt reports the same four figures beside this morning's, with correctness held separate.

## Scope
- In: four `evals/run.sh` invocations, the summarizer, reading per-run figures, and recording them beside the before-figures.
- Out: any change to the cases, the fixture, the graders or the harness — an unchanged instrument is what makes the comparison mean anything.

## Coverage
- CP-04

## Ownership
- Create: `evals/results/develop/sach-sonnet-sau/`, `sach-opus-sau/`, `hong-sonnet-sau/`, `hong-opus-sau/` (gitignored)
- Read: `specs/develop-efficiency/task-03-measure-efficiency.md` for the before-figures and for the four traps its Receipt records

## Steps
1. **Register the expected direction of every grader before running anything**, per D-06, and write it into this task before the first paid run. The repair teaches a run to stop and raise a blocker when the verification fails for a reason unrelated to the task. A run that obeys writes no `Status: done` and no Receipt, so in the broken cells `dong-task` and `receipt-day-du` are expected to **fall**, and a fall there is evidence the repair works rather than evidence it failed. The figures that should improve are the verification count and where the first verification appears in the run. In the clean cells nothing should move except a small rise in Read and Bash counts, because verification-first adds one run of the command by design.
2. Confirm none of the four result directories exists.
3. Run the clean-sonnet invocation first and stop. Compare its correct count and its median tool calls with this morning's 9/10 and 12. **Expect the tool count to rise by one to three**, because verification-first adds a command run and the scout addition adds a read; that rise is the repair working, not drift. Stop and ask the user only if the correct count falls in the **clean** cell, which nothing in this packet should touch.
4. Run the remaining three. The flag facts are unchanged from this morning and each was paid for once: `--case` takes one glob, `--ablation none` keeps one arm, `--threshold 0` keeps the exit code out of the oracle, and `--out` refuses to overwrite.
5. Report per cell: correct count, median tool calls from the `tool_used` graders, median duration, and median cost of a correct run. **Never present `turns` as a tool count**, and state the medians are over correct runs only.
6. Put each figure beside this morning's. The cell that matters is broken-sonnet, which closed 2 of 10 before; the clean cells are the control that shows the edits did not cost anything.

## Acceptance
- AC-06 as stated in `plan.md`.
- Every figure is a median over correct runs, and excluded runs are named.
- The before-figures are quoted from `develop-efficiency`, not recomputed from memory.
- The registered directions from Step 1 are quoted in the Receipt beside the outcome for each, so a grader that fell as predicted is read as designed rather than as a regression.
- **No conclusion is drawn here.** Whether the repairs worked is a GATE-DONE reading.

## Dependencies
- task-01-skill-proves-verification-first.md
- task-02-fixed-point-proportionate.md
- task-03-plan-may-declare-several-commands.md

## Verification Plan
- Command: `evals/run.sh develop --out hong-opus-sau --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong && node evals/summarize.mjs evals/results/develop/sach-sonnet-sau evals/results/develop/sach-opus-sau evals/results/develop/hong-sonnet-sau evals/results/develop/hong-opus-sau`
- Prerequisite run 1 of 3 — **run this alone and stop**: `evals/run.sh develop --out sach-sonnet-sau --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 8 --allow-tools Write Edit Bash --case mot-task-sach`
- Prerequisite run 2 of 3: `evals/run.sh develop --out sach-opus-sau --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 10 --allow-tools Write Edit Bash --case mot-task-sach`
- Prerequisite run 3 of 3: `evals/run.sh develop --out hong-sonnet-sau --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 10 --allow-tools Write Edit Bash --case mot-task-hong`
- Named probe: the eight graders of each case, counted per run
- Reachability: known — the identical four commands ran this morning and produced the before-figures
- Oracle: all four run commands and the summarizer exit 0; four directories `partial: false`, each one case, one arm `with`, ten runs
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason
- Artifacts: the four `result.json` files, gitignored, each declared in the Receipt on its own `Artifact:` line with a `sha256:` line beneath it

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A figure that moves the wrong way, or does not move, is the finding this task exists to produce and must be reported as it is.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
