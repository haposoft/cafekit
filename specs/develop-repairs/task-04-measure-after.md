# Task 04 — The repairs are measured against the figures they came from

Status: done

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

## Registered expectations
Written 2026-09-23T07:26:14+07:00, before the first paid run.

| Cell | Grader | Before | Expected direction | Why |
|---|---|---|---|---|
| clean sonnet | correct close | 9/10 | **unchanged** | nothing in the repairs should break a clean task; a fall here is the stop signal |
| clean sonnet | tool calls | 12 | **up by 1–3** | verify-first adds one run of the command, the scout adds one read |
| clean opus | correct close | 9/10 | unchanged | as above |
| broken, both | `code-tieng-viet`, `code-cat-khoang-trang` | 10/10 | unchanged or down | a run that stops at the blocker may not edit the code at all |
| broken, both | `dong-task`, `receipt-day-du` | 7/10 & 2/10 (sonnet), 7/10 & 6/10 (opus) | **down** | obeying the new rule means stopping at an unrelated failure instead of closing; a fall is the repair working |
| broken, both | verification runs | 4–5 | **down** | the failure is seen once, before any change, and raised rather than retried |

## Receipt

Verification: PASS
Command: evals/run.sh develop --out hong-opus-sau --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong && node evals/summarize.mjs evals/results/develop/sach-sonnet-sau evals/results/develop/sach-opus-sau evals/results/develop/hong-sonnet-sau evals/results/develop/hong-opus-sau
Exit: 0
Base: 46a4ed1d51f2f293dabd51ec74bdbb4dcc294bc6
Head: 89673dae9b87e77a1a3b13365dbc49d9c96f3bee5a52b07b7ff499fb2cb696a6
```text
$ evals/run.sh develop --out hong-opus-sau --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong && node evals/summarize.mjs evals/results/develop/sach-sonnet-sau evals/results/develop/sach-opus-sau evals/results/develop/hong-sonnet-sau evals/results/develop/hong-opus-sau
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/hong-opus-sau/result.json
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/hong-opus-sau (exit 0)
evals/results/develop/sach-sonnet-sau  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T00:26:22.378Z  cost=$2.87
  mot-task-sach [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 9/10  code-tieng-viet 9/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 8/10  receipt-day-du 6/10
evals/results/develop/sach-opus-sau  model=opus  judge=sonnet  ablation=none  started=2026-09-23T01:41:23.792Z  cost=$2.26
  mot-task-sach [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 4/10  receipt-day-du 5/10
evals/results/develop/hong-sonnet-sau  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T01:41:23.792Z  cost=$3.77
  mot-task-hong [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 6/10  receipt-day-du 3/10
evals/results/develop/hong-opus-sau  model=opus  judge=sonnet  ablation=none  started=2026-09-23T05:14:56.753Z  cost=$2.06
  mot-task-hong [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 0/10  code-tieng-viet 0/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 0/10  receipt-day-du 0/10
AGGREGATE over 4 directories
  mot-task-hong [with]  runs 20  Skill invoked 0/20 (20 run(s) with an unread skill count)  code-cat-khoang-trang 10/20  code-tieng-viet 10/20  dem-edit 20/20  dem-read 20/20  dem-verify 20/20  dem-write 20/20  dong-task 6/20  receipt-day-du 3/20
  mot-task-sach [with]  runs 20  Skill invoked 0/20 (20 run(s) with an unread skill count)  code-cat-khoang-trang 19/20  code-tieng-viet 19/20  dem-edit 20/20  dem-read 20/20  dem-verify 20/20  dem-write 20/20  dong-task 12/20  receipt-day-du 11/20
EXIT:0
```
Artifact: evals/results/develop/sach-sonnet-sau/result.json
sha256: d1cc5917030fc33dc8d5a8756a53b78a196ce240ee2f6b59f1c3c0e36453cbc2
Artifact: evals/results/develop/sach-opus-sau/result.json
sha256: 86e152222cb948fc3d40956225ba9fd769b3c356618de4ebec1f293ff216a72e
Artifact: evals/results/develop/hong-sonnet-sau/result.json
sha256: f4501e19fbf2abf085fb5c67c1cea193242a3b43ed8a69ace7ab82c939f96a08
Artifact: evals/results/develop/hong-opus-sau/result.json
sha256: 5db10f2b65c2081f276338355f7d2564000aea3886a554d2a7e4b7586ffab732

**Mixed instrument, recorded rather than hidden.** Task 06 changed the scaffolds and `receipt-day-du` after the first three cells ran, which moved Head and made this Receipt stale; the user chose to rerun the final command rather than freeze the packet. So the first three directories were measured on the old instrument (no usable git in the workspace, `Base:\s*\S+`), and `hong-opus-sau` on the final instrument and skill (tasks 06 and 08: a committed workspace carrying `provenance.cjs`, a 40-hex Base, and the command named on `SKILL.md:142`). This is the third run of that cell: the first (old instrument, 0/10) is kept at `hong-opus-sau-thuoc-cu/`, the second (task-06 instrument, before task 08) at `hong-opus-sau-lan2/` (sha256 `55da50a949b88e7044be3561b14697bc18fa19c2216375ff3d0eeb03912e242d`, 0/10 correct, code graders 1/10), and this one was run at the final-Head fixed point after the last change outside `specs/`. The first broken-opus run on the old instrument is kept at `evals/results/develop/hong-opus-sau-thuoc-cu/` (0/10, sha256 `a880ee66056fa5ebfa5f26a296e4802113035f3b1eab7744c9c66a0f72b3801d`). The reruns had no `--keep-temp`; task 07 read the traces of the same cell under the same instrument and skill (`git-sau-hong-opus`) and found every run stopping before any code change. All four directories are `partial: false`, one case, one arm `with`, ten runs. Before/after on one instrument is task 07's job.

### The four cells beside the before-figures
Before-figures are quoted from the `develop-efficiency/task-03-measure-efficiency.md` Receipt. Tool calls are Read+Bash+Edit+Write from the `tool_used` graders, never `turns`; tool, seconds and $/run are medians over correct runs only; V is the median `Bash` count over all ten runs.

| Cell | correct before → after | tool calls | seconds | $/correct run | V all runs | excluded |
|---|---|---|---|---|---|---|
| clean sonnet | 9/10 → **6/10** | 12 → 11.5 | 70 → 105 | $0.2546 → $0.3269 | 1 → 2 | runs 9, 10 timed out after 1200s (counted as not correct) |
| clean opus | 9/10 → **4/10** | 13 → 4.5 | 156 → 46 | $0.6756 → $0.2405 | 4 → 2 | none |
| broken sonnet | 2/10 → 3/10 | 13.5 → 11 | 181.5 → 140 | $0.3346 → $0.3282 | 4 → 4 | none |
| broken opus | 6/10 → **0/10** | 15 → n/a | 175.5 → n/a | $0.8267 → n/a | 5 → 2 | none; no correct run, so no correct-run median; **final rerun on the task-06 and task-08 instrument** (see note) |

### Registered directions beside the outcome
| Cell | Grader | Registered | Observed |
|---|---|---|---|
| clean sonnet | correct close | unchanged; a fall is the stop signal | fell 9 → 6 (two of the four misses are 1200s timeouts; runs 3 and 8 fail only `receipt-day-du`) |
| clean sonnet | tool calls | up by 1–3 | 12 → 11.5, did not rise |
| clean opus | correct close | unchanged | fell 9 → 4; code graders 10/10, six runs end with one Edit (code only) and no task-file edit |
| broken, both | code graders | unchanged or down | sonnet 10/10 unchanged; opus 10 → 0 (final rerun) |
| broken, both | `dong-task`, `receipt-day-du` | down | sonnet 7 → 6 and 2 → 3; opus 7 → 0 and 6 → 0 (final rerun) |
| broken, both | verification runs | down | sonnet 4 → 4, not down; opus 5 → 2, down |

No conclusion is drawn here; the reading belongs to GATE-DONE.
