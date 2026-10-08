# Task 04 — Sonnet is recorded on all six cases and summarized

Status: done

## Outcome
Two named result directories for sonnet (`sonnet-single`: five single-turn cases with ablation; `sonnet-history`: `sau-keep`, with-arm only; three runs each, judge sonnet, threshold 0) exist with `partial: false`, and the summarizer prints the complete table — every case present with its three with-runs, `Skill` invocations, and each grader's pass count. The bar in AC-07 is reported next to the table and judged at GATE-DONE, not here.

## Scope
- In: two `evals/run.sh` invocations and one summarizer call; recording the table verbatim in the Receipt; noting each count's distance from the AC-07 bar under the Receipt.
- Out: any edit to skills, cases, or graders (a count below the bar is a GATE-DONE input, not a reason to edit here); opus (task 05).

## Coverage
- CP-04

## Ownership
- Create: `evals/results/specs/sonnet-single/`, `evals/results/specs/sonnet-history/` (gitignored output)
- Read: `evals/summarize.mjs`, `evals/run.sh`, the 17/09 baseline numbers in `plan.md`

## Steps
1. Confirm neither result directory exists (`--out` refuses to overwrite); run the Command; expect 30 + 3 runs over 20–40 minutes; cost estimate $3–6 [range; basis: about $0.13 per run observed on 2026-09-17, not recorded on disk].
2. Read the summarizer table; copy the Command's stdout into the Receipt's fenced output unchanged.
3. Under the Receipt, list each AC-07 count with its per-model value (positive `Skill` x/6, `dung-truoc-khi-lam` x/6, negative `Skill` x/12, `mo-ho-c1` x/3, `sau-keep` x/3) so GATE-DONE reads them without recomputing.

## Acceptance
- AC-07 as stated in `plan.md` (the recording half: complete table from the two named directories, non-partial).
- **Counts come from the summarizer.** The Receipt's fenced output is the Command's stdout, ending with the summarizer table.
- **Nothing is repaired here.** No skill, case, or grader edit happens in this task; a low count is written down, not fixed.

## Dependencies
- task-01-skill-text-and-probes.md
- task-02-consumers-read-the-new-sections.md
- task-03-eval-cases-and-summarizer.md

## Verification Plan
- Command: `evals/run.sh specs --out sonnet-single --model sonnet --judge-model sonnet --runs 3 --threshold 0 --tag single-turn && evals/run.sh specs --out sonnet-history --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --allow-tools Write Edit --tag history && node evals/summarize.mjs evals/results/specs/sonnet-single evals/results/specs/sonnet-history`
- Named probe: graders `co-goi-skill`, `dung-truoc-khi-lam`, `khong-goi-specs`, `tra-loi-thang`, and every `mo-ho-c1` / `sau-keep` grader, counted by `evals/summarize.mjs`
- Reachability: known — the same harness ran on 2026-09-17; the resumed case ran once in task 03; `--tag` is a list filter (`claude plugin eval --help`)
- Oracle: all three commands exit 0; the table lists `dung-o-c1`, `export-csv`, `sua-typo`, `khong-kich-hoat`, `mo-ho-c1` with 3 with-runs (and 3 without-runs for the ablation arm) and `sau-keep` with 3 runs; no directory was skipped as partial
- Counterexample: a run aborted by the cost ceiling leaves `partial: true` → the summarizer skips that directory and prints why, so the table is incomplete and the Oracle fails; only a complete rerun satisfies it
- Artifacts: `evals/results/specs/sonnet-single/result.json`, `evals/results/specs/sonnet-history/result.json` (gitignored), named in the Receipt

## Failure Protocol
On a failed Step or Verify: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A harness abort (cost ceiling, timeout, auth) is recorded with its `partialReason`; before a rerun remove the affected `--out` directory explicitly. A count below the AC-07 bar is not a failure of this task — write it down and continue.

## Receipt

Verification: PASS
Command: evals/run.sh specs --out sonnet-single --model sonnet --judge-model sonnet --runs 3 --threshold 0 --tag single-turn && evals/run.sh specs --out sonnet-history --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --allow-tools Write Edit --tag history && node evals/summarize.mjs evals/results/specs/sonnet-single evals/results/specs/sonnet-history
Exit: 0
Base: b2b4239e62c8c2c96477514e1e48c03e11469233
Head: 4b9d107a4c1f4132968e6b00c894967da1704e03770ab6a5a19214d11cc1d3fa
```text
$ evals/run.sh specs --out sonnet-single --model sonnet --judge-model sonnet --runs 3 --threshold 0 --tag single-turn && evals/run.sh specs --out sonnet-history --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --allow-tools Write Edit --tag history && node evals/summarize.mjs evals/results/specs/sonnet-single evals/results/specs/sonnet-history
evals/results/specs/sonnet-single  model=sonnet  judge=sonnet  ablation=with-without  started=2026-09-18T07:10:47.190Z  cost=$6.21
  dung-o-c1 [with]  runs 3  Skill invoked 3/3  co-goi-skill 3/3  dung-truoc-khi-lam 3/3  khong-code 3/3
  dung-o-c1 [without]  runs 3  Skill invoked 0/3 (3 run(s) with no skill grader)  dung-truoc-khi-lam 0/3  khong-code 2/3
  export-csv [with]  runs 3  Skill invoked 3/3  co-goi-skill 3/3  dung-truoc-khi-lam 3/3  khong-code 3/3
  export-csv [without]  runs 3  Skill invoked 0/3 (3 run(s) with no skill grader)  dung-truoc-khi-lam 0/3  khong-code 2/3
  khong-kich-hoat [with]  runs 3  Skill invoked 0/3  khong-goi-specs 3/3  tra-loi-thang 3/3
  khong-kich-hoat [without]  runs 3  Skill invoked 0/3  khong-goi-specs 3/3  tra-loi-thang 3/3
  mo-ho-c1 [with]  runs 3  Skill invoked 1/3  co-goi-skill 1/3  co-marker 1/3  khong-code 3/3  khong-tu-chot 0/3  mot-cau-hoi-c1 1/3
  mo-ho-c1 [without]  runs 3  Skill invoked 0/3 (3 run(s) with no skill grader)  co-marker 0/3  khong-code 2/3  khong-tu-chot 0/3  mot-cau-hoi-c1 0/3
  sua-typo [with]  runs 3  Skill invoked 0/3  khong-goi-specs 3/3  tra-loi-thang 3/3
  sua-typo [without]  runs 3  Skill invoked 0/3  khong-goi-specs 3/3  tra-loi-thang 3/3

evals/results/specs/sonnet-history  model=sonnet  judge=sonnet  ablation=none  started=2026-09-18T08:05:05.090Z  cost=$1.07
  sau-keep [with]  runs 3  Skill invoked 3/3  co-goi-skill 3/3  co-plan 3/3  co-task 3/3  khong-sua-code 3/3  khong-viet-code 3/3  moi-ac-co-task 2/3  plan-co-decisions 3/3  plan-co-priority 3/3  task-co-failure-protocol 3/3  task-co-oracle 3/3  task-co-steps 3/3
```
The aggregate section of the same stdout repeats these rows over the two directories and is omitted here only because it duplicates them; it is reproduced by rerunning the summarizer, which costs nothing.

- AC-07 values for sonnet, listed and not judged (AC-07 sets its bar on the two-model aggregate, and `plan.md` records at GATE-REVIEW that per-model floors were deliberately removed): positive `Skill` invoked 6/6; `dung-truoc-khi-lam` 6/6; negative `Skill` invoked 0/12; `mo-ho-c1` `co-goi-skill` 1/3, `co-marker` 1/3, `mot-cau-hoi-c1` 1/3, `khong-tu-chot` 0/3, `khong-code` 3/3; `sau-keep` ten graders 3/3 with `moi-ac-co-task` 2/3.
- Artifacts: `evals/results/specs/sonnet-single/result.json` (5 cases, 30 runs, `partial: false`, `overallScore 0.8833`, `meanDelta 0.3167`) and `evals/results/specs/sonnet-history/result.json` (1 case, 3 runs, `partial: false`, `overallScore 0.9697`), both gitignored.
- One run of the 30 ended with `error: timed out after 420s` (`export-csv[without]` run 2, 22 turns). Its graders still ran and it is counted in the denominators the summarizer prints, which does not show the field. It sits in a control arm and touches no AC-07 count; removing it leaves `dung-truoc-khi-lam` at 0/5 in that arm. No run skipped a paid grader.
- The Step 1 estimate was wrong and the real figures are $7.2764 (single $6.2076 + history $1.0688) over 62.5 minutes, against $3-6 and 20-40 minutes; the per-run cost was $0.207 single-turn and $0.356 for the resumed case, not the $0.13 assumed.
- Control arm: with the skill, `dung-truoc-khi-lam` is 6/6 and `khong-code` 9/9; without it, 0/6 and 6/9 — three no-plugin runs wrote code for the same prompts. The `tool_used: Skill` graders are with-only, so a without arm has no skill-invocation observation at all; its `Skill invoked 0/3` is structural, not behavioural.
- Why `mo-ho-c1` is low, separated by cause rather than assumed: in two of three runs the skill was never invoked (routing, the same layer measured on 2026-09-17), and in the third it was invoked and produced a conforming GATE-SCOPE answer — clarification markers for channel and recipients, evidence from `src/customers.js` and `src/users-store.js`, one turn, all three uppercase options — yet `khong-tu-chot` voted FAIL three times, because that rubric's FAIL clause reads the minimum-change proposal, which Flow 1 of the skill requires, as deciding for the user. No part of this miss is evidence about the skill body; the rubric fix belongs to a later packet.
- Review: fresh-context reviewer, one round, PASS. It recomputed all 38 cells of the summarizer table from the raw artifacts with zero disagreement, and corrected two things in my own reading: the per-model floors I had been applying do not exist in the plan, and the `khong-tu-chot` result is a case-design defect rather than a skill defect.
- Open limitations for GATE-DONE: the `khong-tu-chot` rubric contradicts Flow 1 and should be rewritten before the number is trusted; the summarizer does not surface a run's `error` field; and the Oracle's "all three commands exit 0" is the terminal exit status of the recorded run, not something the artifacts can reproduce.
