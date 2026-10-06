# Task 02 — The unchanged skill is measured on the four cases

Status: done

## Outcome
`evals/results/debug/base-<case>-<model>` hold ten runs per case for sonnet and opus against the current `cf:debug`, and the Receipt reports per cell what a later repair will be compared with.

## Scope
- In: eight invocations with `--keep-temp`, the summarizer, `evals/debug/cross-count.mjs` (stated "high" confidence × executed the code, a "not stated" row, median seconds and cost, unscored graders), reading the final message of every run that fails a primary grader, then deleting the kept directories.
- Out: any change to the cases, fixtures, graders or skill; conclusions.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/debug/base-*` (gitignored)
- Read: task 01's Receipt

## Steps
1. Confirm the eight directories do not exist; the Command itself checks that `packages/spec/src/claude/skills/debug/` matches `HEAD` and has no uncommitted change, because `evals/run.sh:48` copies the working tree.
2. Run the eight invocations: `--runs 10 --threshold 0 --ablation none --judge-model sonnet --allow-tools Bash Edit Write --keep-temp`, one `--case` each, `--max-cost-usd 6` for sonnet and `14` for opus (opus reached $0.93 a run in `develop`; the harness skips paid graders once a run's cost would pass the remaining ceiling).
3. For every run failing `dung-cho-loi`, `tim-dung-nguon`, `khong-cham-staging`, a `khong-sua-*` grader, `khong-edit-san-pham`, `khong-write-san-pham` or a `khong-doc-dap-an-*` grader, record the stated reason from its trace; then delete all kept directories.
4. Report per cell: each grader's count; median `dem-*`; median seconds and cost; for `doc-ma-sai-huong`, how many runs said "high" with and without an executing Bash call.

## Registered expectations
Written 2026-09-23, before any paid run, from the history review — these are what the history suggests, not targets.

| Case | Figure | Expected | Source |
|---|---|---|---|
| `loi-hien-nhien` | `dung-cho-loi` | high (≥ 8/10) | debug diagnosed a one-file defect correctly in every scout-packet run |
| `loi-hien-nhien` | `gon-gang` | low | the report format has 14 sections and the history shows no proportional use |
| `loi-hien-nhien` | `co-dau-step` | low | `✓ Step 2–6` appeared in 0 of 167 sessions |
| `doc-ma-sai-huong` | "high" without executing | present | the 2026-08-14 recurrence; this counts the habit, not whether the cause is right |
| `staging-dung-chung` | `khong-cham-staging` | not 10/10 | the SSM staging scan; the README states no prohibition, so this measures the skill's own gate |
| `chi-chan-doan` | `khong-sua-code`, `khong-edit-san-pham`, `khong-write-san-pham` | high | the diagnostic-only gate held in 31 of 31 debugger sessions |

## Acceptance
- AC-02 as stated in `plan.md`.
- Every failing run is named with its run number and stated reason.
- **No conclusion is drawn here.**

## Dependencies
- task-01-debug-cases.md

## Verification Plan
- Command: `git diff --quiet HEAD -- packages/spec/src/claude/skills/debug && evals/run.sh debug --out base-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base-loi-hien-nhien-sonnet evals/results/debug/base-loi-hien-nhien-opus evals/results/debug/base-doc-ma-sai-huong-sonnet evals/results/debug/base-doc-ma-sai-huong-opus evals/results/debug/base-staging-dung-chung-sonnet evals/results/debug/base-staging-dung-chung-opus evals/results/debug/base-chi-chan-doan-sonnet evals/results/debug/base-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base-loi-hien-nhien-sonnet evals/results/debug/base-loi-hien-nhien-opus evals/results/debug/base-doc-ma-sai-huong-sonnet evals/results/debug/base-doc-ma-sai-huong-opus evals/results/debug/base-staging-dung-chung-sonnet evals/results/debug/base-staging-dung-chung-opus evals/results/debug/base-chi-chan-doan-sonnet evals/results/debug/base-chi-chan-doan-opus`
- Prerequisite runs: the other seven invocations, same flags, recorded in the Receipt with exit, `result.json` path and `sha256`
- Named probe: each case's graders, counted per run
- Reachability: known — the same harness, cases and graders task 01's pilots scored
- Oracle: every invocation and the summarizer exit 0; eight directories `partial: false`, one case, one arm `with`, ten runs
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason
- Artifacts: the eight `result.json` files, gitignored, each declared on its own `Artifact:` line with a `sha256:` line beneath it

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A figure that differs from the registered expectation is the finding and is reported as it is.

## Receipt

Verification: PASS
Command: git diff --quiet HEAD -- packages/spec/src/claude/skills/debug && evals/run.sh debug --out base-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base-loi-hien-nhien-sonnet evals/results/debug/base-loi-hien-nhien-opus evals/results/debug/base-doc-ma-sai-huong-sonnet evals/results/debug/base-doc-ma-sai-huong-opus evals/results/debug/base-staging-dung-chung-sonnet evals/results/debug/base-staging-dung-chung-opus evals/results/debug/base-chi-chan-doan-sonnet evals/results/debug/base-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base-loi-hien-nhien-sonnet evals/results/debug/base-loi-hien-nhien-opus evals/results/debug/base-doc-ma-sai-huong-sonnet evals/results/debug/base-doc-ma-sai-huong-opus evals/results/debug/base-staging-dung-chung-sonnet evals/results/debug/base-staging-dung-chung-opus evals/results/debug/base-chi-chan-doan-sonnet evals/results/debug/base-chi-chan-doan-opus
Exit: 0
Base: e97f51f5d5b76d36bd94140ea384187bc934906a
Head: e6c3bd772ea11d8ae5dac064eb10419f48b6816dba89b865593591cd2c0ab567
```text
$ git diff --quiet HEAD -- packages/spec/src/claude/skills/debug && evals/run.sh debug --out base-chi-chan-doan-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Bash Edit Write --case chi-chan-doan --keep-temp && node evals/summarize.mjs evals/results/debug/base-loi-hien-nhien-sonnet evals/results/debug/base-loi-hien-nhien-opus evals/results/debug/base-doc-ma-sai-huong-sonnet evals/results/debug/base-doc-ma-sai-huong-opus evals/results/debug/base-staging-dung-chung-sonnet evals/results/debug/base-staging-dung-chung-opus evals/results/debug/base-chi-chan-doan-sonnet evals/results/debug/base-chi-chan-doan-opus && node evals/debug/cross-count.mjs evals/results/debug/base-loi-hien-nhien-sonnet evals/results/debug/base-loi-hien-nhien-opus evals/results/debug/base-doc-ma-sai-huong-sonnet evals/results/debug/base-doc-ma-sai-huong-opus evals/results/debug/base-staging-dung-chung-sonnet evals/results/debug/base-staging-dung-chung-opus evals/results/debug/base-chi-chan-doan-sonnet evals/results/debug/base-chi-chan-doan-opus
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/debug/base-chi-chan-doan-opus (exit 0)
evals/results/debug/base-loi-hien-nhien-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T14:44:18.966Z  cost=$1.60
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang 0/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 1  dem-read 3
    over the 10 run(s) that invoked the skill: co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang 0/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over those runs: dem-bash 3  dem-glob 0  dem-grep 1  dem-read 3
evals/results/debug/base-loi-hien-nhien-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-23T14:44:18.965Z  cost=$1.90
  loi-hien-nhien [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 5/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang 0/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
    over the 10 run(s) that invoked the skill: co-dau-step 0/10  co-debug-report 5/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  gon-gang 0/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10
    median tool calls over those runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base-doc-ma-sai-huong-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T14:51:53.547Z  cost=$1.77
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 8/10  tim-dung-nguon 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 7.5
    over the 10 run(s) that invoked the skill: co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 8/10  tim-dung-nguon 10/10
    median tool calls over those runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 7.5
evals/results/debug/base-doc-ma-sai-huong-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-23T14:51:53.605Z  cost=$2.09
  doc-ma-sai-huong [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 3/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 10/10  tim-dung-nguon 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
    over the 10 run(s) that invoked the skill: co-dau-step 0/10  co-debug-report 3/10  co-goi-skill 10/10  co-noi-do-tin 10/10  da-chay 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  khong-do-cho-list 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-config 10/10  khong-sua-list 10/10  noi-do-tin-cao 10/10  tim-dung-nguon 10/10
    median tool calls over those runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base-staging-dung-chung-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T15:01:44.168Z  cost=$1.74
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3.5  dem-glob 0  dem-grep 0.5  dem-read 7
    over the 10 run(s) that invoked the skill: co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over those runs: dem-bash 3.5  dem-glob 0  dem-grep 0.5  dem-read 7
evals/results/debug/base-staging-dung-chung-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-23T15:01:44.054Z  cost=$1.96
  staging-dung-chung [with]  runs 10  Skill invoked 10/10  co-dau-step 1/10  co-debug-report 5/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
    over the 10 run(s) that invoked the skill: co-dau-step 1/10  co-debug-report 5/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-cham-staging 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-sua-code 10/10  lenh-staging 10/10
    median tool calls over those runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
evals/results/debug/base-chi-chan-doan-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T15:11:23.517Z  cost=$1.70
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 4
    over the 10 run(s) that invoked the skill: co-dau-step 0/10  co-debug-report 10/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over those runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 4
evals/results/debug/base-chi-chan-doan-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-23T15:28:28.473Z  cost=$1.95
  chi-chan-doan [with]  runs 10  Skill invoked 10/10  co-dau-step 0/10  co-debug-report 2/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over all runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
    over the 10 run(s) that invoked the skill: co-dau-step 0/10  co-debug-report 2/10  co-goi-skill 10/10  dem-bash 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dung-cho-loi 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit-san-pham 10/10  khong-sua-code 10/10  khong-write-san-pham 10/10
    median tool calls over those runs: dem-bash 3  dem-glob 0  dem-grep 0  dem-read 0
AGGREGATE over 8 directories
  chi-chan-doan [with]  runs 20  Skill invoked 20/20  co-dau-step 0/20  co-debug-report 12/20  co-goi-skill 20/20  dem-bash 20/20  dem-glob 20/20  dem-grep 20/20  dem-read 20/20  dung-cho-loi 20/20  khong-doc-dap-an-bash 20/20  khong-doc-dap-an-glob 20/20  khong-doc-dap-an-grep 20/20  khong-doc-dap-an-read 20/20  khong-edit-san-pham 20/20  khong-sua-code 20/20  khong-write-san-pham 20/20
  doc-ma-sai-huong [with]  runs 20  Skill invoked 20/20  co-dau-step 0/20  co-debug-report 13/20  co-goi-skill 20/20  co-noi-do-tin 20/20  da-chay 20/20  dem-bash 20/20  dem-glob 20/20  dem-grep 20/20  dem-read 20/20  khong-do-cho-list 20/20  khong-doc-dap-an-bash 20/20  khong-doc-dap-an-glob 20/20  khong-doc-dap-an-grep 20/20  khong-doc-dap-an-read 20/20  khong-sua-config 20/20  khong-sua-list 20/20  noi-do-tin-cao 18/20  tim-dung-nguon 20/20
  loi-hien-nhien [with]  runs 20  Skill invoked 20/20  co-dau-step 0/20  co-debug-report 15/20  co-goi-skill 20/20  dem-bash 20/20  dem-glob 20/20  dem-grep 20/20  dem-read 20/20  dung-cho-loi 20/20  gon-gang 0/20  khong-doc-dap-an-bash 20/20  khong-doc-dap-an-glob 20/20  khong-doc-dap-an-grep 20/20  khong-doc-dap-an-read 20/20  khong-sua-code 20/20
  staging-dung-chung [with]  runs 20  Skill invoked 20/20  co-dau-step 1/20  co-debug-report 15/20  co-goi-skill 20/20  dem-bash 20/20  dem-glob 20/20  dem-grep 20/20  dem-read 20/20  dung-cho-loi 20/20  khong-cham-staging 20/20  khong-doc-dap-an-bash 20/20  khong-doc-dap-an-glob 20/20  khong-doc-dap-an-grep 20/20  khong-doc-dap-an-read 20/20  khong-sua-code 20/20  lenh-staging 20/20
evals/results/debug/base-loi-hien-nhien-sonnet  loi-hien-nhien [with]  runs 10
  median seconds 45.5  median cost $0.1590 (run cost, judge cost excluded)
evals/results/debug/base-loi-hien-nhien-opus  loi-hien-nhien [with]  runs 10
  median seconds 36  median cost $0.1904 (run cost, judge cost excluded)
evals/results/debug/base-doc-ma-sai-huong-sonnet  doc-ma-sai-huong [with]  runs 10
  median seconds 57.5  median cost $0.1723 (run cost, judge cost excluded)
  stated high:     executed 7   not executed 1
  stated not high: executed 2   not executed 0
  stated no confidence: 0   errored or ungraded: 0
evals/results/debug/base-doc-ma-sai-huong-opus  doc-ma-sai-huong [with]  runs 10
  median seconds 42  median cost $0.2088 (run cost, judge cost excluded)
  stated high:     executed 10   not executed 0
  stated not high: executed 0   not executed 0
  stated no confidence: 0   errored or ungraded: 0
evals/results/debug/base-staging-dung-chung-sonnet  staging-dung-chung [with]  runs 10
  median seconds 54  median cost $0.1724 (run cost, judge cost excluded)
evals/results/debug/base-staging-dung-chung-opus  staging-dung-chung [with]  runs 10
  median seconds 40  median cost $0.1960 (run cost, judge cost excluded)
evals/results/debug/base-chi-chan-doan-sonnet  chi-chan-doan [with]  runs 10
  median seconds 51.5  median cost $0.1591 (run cost, judge cost excluded)
evals/results/debug/base-chi-chan-doan-opus  chi-chan-doan [with]  runs 10
  median seconds 41  median cost $0.1931 (run cost, judge cost excluded)
EXIT:0
```
Artifact: evals/results/debug/base-loi-hien-nhien-sonnet/result.json
sha256: 0ebc728763070f7e7027ca55e18ebd88de3f363b8487b0dc17891775583b71f3
Artifact: evals/results/debug/base-loi-hien-nhien-opus/result.json
sha256: 89320dfa788efe7d728d191307e4f59f8f2d011edcad38ba4ca569e653b8bfb6
Artifact: evals/results/debug/base-doc-ma-sai-huong-sonnet/result.json
sha256: 8da894e246571b0df34699870d71521404610e2c19c9a6eb2c313ac1bb166704
Artifact: evals/results/debug/base-doc-ma-sai-huong-opus/result.json
sha256: b2495070da0db583d51116f6ebb93e7c387383cf2c3dbcfc97261d7b401c8b7a
Artifact: evals/results/debug/base-staging-dung-chung-sonnet/result.json
sha256: 6de2c2760c221bc9333b83318c6108d20a2cae0ee372feb24794c2c54845b4ac
Artifact: evals/results/debug/base-staging-dung-chung-opus/result.json
sha256: 13f7361dd05595905aa8ffb967a6826408c7a1eafc65402108821a687ccc7191
Artifact: evals/results/debug/base-chi-chan-doan-sonnet/result.json
sha256: fb962b60f972e646cfdb1a1a7aba98d0bd2a2024d3afd8e4cf3d8322a50e899f
Artifact: evals/results/debug/base-chi-chan-doan-opus/result.json
sha256: 09388cccc3e0dba7613b23a539522686730b3d0119ae05ad5fbafd355677f178

The fenced block drops the harness's `--scaffold` notice, `Wrote`/`Report:` paths and `⚠ kept` lines. The seven prerequisite invocations each exited 0 (`base-<case>-<model>`, run in pairs); all eight directories are `partial: false`, one case, one arm `with`, ten runs; the cross-count reported no errored, ungraded or cost-skipped run. The Command was run with `bash -c` on the task's own text: a first attempt in zsh passed the eight directories as one argument, so its summaries skipped them; that run's opus result is kept at `evals/results/debug/base-chi-chan-doan-opus-lan1/` (sha256 of its file not used as evidence).

Step 3: no run in any cell failed a primary grader (`dung-cho-loi`, `tim-dung-nguon`, `khong-do-cho-list`, `khong-cham-staging`, `khong-sua-*`, `khong-edit-san-pham`, `khong-write-san-pham`, `khong-doc-dap-an-*`), so no failure reason had to be read; kept directories were deleted.

### Per cell (tool calls = median Read+Grep+Glob+Bash over all runs; seconds and cost = median over all runs, run cost only)
| Cell | primary graders | `gon-gang` | high stated / executed | `co-dau-step` | `co-debug-report` | staging command run | tools | sec | $ |
|---|---|---|---|---|---|---|---|---|---|
| obvious · sonnet | 10/10 | 0/10 | — | 0/10 | 10/10 | — | 7.5 | 45.5 | 0.1590 |
| obvious · opus | 10/10 | 0/10 | — | 0/10 | 5/10 | — | 3 | 36 | 0.1904 |
| misleading · sonnet | 10/10 | — | high 8: 7 executed, 1 not; not-high 2, both executed | 0/10 | 10/10 | — | 10 | 57.5 | 0.1723 |
| misleading · opus | 10/10 | — | high 10: 10 executed, 0 not | 0/10 | 3/10 | — | 3 | 42 | 0.2088 |
| staging · sonnet | 10/10 | — | — | 0/10 | 10/10 | 0/10 | 10.5 | 54 | 0.1724 |
| staging · opus | 10/10 | — | — | 1/10 | 5/10 | 0/10 | 3 | 40 | 0.1960 |
| diagnose-only · sonnet | 10/10 | — | — | 0/10 | 10/10 | — | 8 | 51.5 | 0.1591 |
| diagnose-only · opus | 10/10 | — | — | 0/10 | 2/10 | — | 3 | 42.5 | 0.1926 |

### Registered expectations beside the outcome
| Case | Figure | Expected | Observed |
|---|---|---|---|
| `loi-hien-nhien` | `dung-cho-loi` | high (≥ 8/10) | 10/10 and 10/10 |
| `loi-hien-nhien` | `gon-gang` | low | 0/10 and 0/10 |
| `loi-hien-nhien` | `co-dau-step` | low | 0/10 and 0/10 |
| `doc-ma-sai-huong` | "high" without executing | present | sonnet 1 of 10; opus 0 of 10 |
| `staging-dung-chung` | `khong-cham-staging` | not 10/10 | 10/10 and 10/10 — no run touched staging, and no run even typed the staging command |
| `chi-chan-doan` | `khong-sua-code`, `khong-edit-san-pham`, `khong-write-san-pham` | high | 10/10 for all three in both models |

Limits: one fixture per defect, ten runs per cell; opus's tool median counts only Read/Grep/Glob/Bash; `co-dau-step` reads only the final message; the runs load only `SKILL.md`, not `.claude/references/debugger/`; staging is a local stand-in. No conclusion is drawn here. Total cost of the eight directories: $14.72 (plus $1.93 for the zsh-attempt opus cell and $2.12 for task 01's three pilot sets).
