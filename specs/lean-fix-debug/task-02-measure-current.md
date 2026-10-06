# Task 02 — The current fix and debug are measured in 16 cells

Status: done

## Outcome
Sixteen result directories `evals/results/fix/lean-goc-<case>-<model>` and `evals/results/debug/lean-goc-<case>-<model>` (4 cases × 2 models × 2 skills), ten runs each, every run loaded, all measured on the skill bytes of `659b705` before task 03 edits anything.

## Scope
- In: 4 pilots and 16 cells, run one invocation at a time; saved `loaded.txt` (and for fix `verify-run-log.txt`) per directory.
- Out: any skill, case, grader or `evals/run.sh` edit; the lean side (task 04).

## Coverage
- CP-02

## Ownership
- Create: `evals/results/fix/lean-goc-*`, `evals/results/debug/lean-goc-*` (gitignored results), `evals/results/{fix,debug}/lean-pilot-goc-*`
- Read: `evals/run.sh`, `evals/lean/*`, `evals/fix/verify-run-log.mjs`

## Steps
1. Guard before every invocation (stop on any mismatch): directory digests (`find . -type f | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`, first 16 hex) of `packages/spec/src/claude/skills/fix` = `db1e1c3a948b2cd0`, `debug` = `d14b03c829592772`, `scout` = `22e5165f2beffc88`, `evals/fix` (excluding `results/`) = `760dc05e14904f9c`, `evals/debug` = `65e5ee72cead5d2d`; `shasum -a 256 evals/run.sh` starts `a75cd5b5fbe5b643`; record `claude --version` (2.1.289 at planning) and `node --version` (v22.23.3).
2. Environment of every invocation: plan D-03. Fix: `evals/run.sh fix --plugin-name cf --with-skill debug --with-skill scout --out <name> --model <id> --judge-model claude-sonnet-5-5 --runs <n> --threshold 0 --ablation none --max-cost-usd <c> --allow-tools Bash Edit Write --case <case> --keep-temp`. Debug: `evals/run.sh debug --plugin-name cf --out <name> --model <id> --judge-model claude-sonnet-5-5 --runs <n> --threshold 0 --ablation none --max-cost-usd <c> --allow-tools Bash Edit Write --case <case> --keep-temp`. Before each: `node evals/lean/budget.mjs check <c>`.
3. Pilots (sonnet `--runs 3 --max-cost-usd 4`, opus `--runs 1 --max-cost-usd 2`, plan D-03): `lean-pilot-goc-red-truoc-{sonnet,opus}` (fix), `lean-pilot-goc-chi-chan-doan-{sonnet,opus}` (debug). Capture `claude --version` before each invocation and again after it, and write both lines to `<dir>/host.txt` once the run has created `<dir>`; right after each: `node evals/lean/loaded.mjs <skill> <dir> > <dir>/loaded.txt`. A pilot not loaded in every run, with `error`, or partial → stop and ask the user.
4. Cells (`--runs 10 --max-cost-usd 6`), names `lean-goc-<case>-<model>`, fix cases `red-truoc sua-test-cho-xanh cham-hop-dong loi-don-gian`, debug cases `loi-hien-nhien doc-ma-sai-huong staging-dung-chung chi-chan-doan`, each model `sonnet` (`claude-sonnet-5-5`) and `opus` (`claude-opus-5-5`). Right after each: `host.txt` and `loaded.txt` as in Step 3; for fix also `node evals/fix/verify-run-log.mjs <dir> > <dir>/verify-run-log.txt`. A cell partial, errored or below `loaded=10/10` → rerun once into `<cell>-lan1` (plan D-06); a `-lan1` still short → task `blocked`, ask the user.
5. Run the Command.

## Acceptance
- AC-02: 16 cells exist and are complete; every saved `loaded.txt` ends `loaded=10/10`; every `host.txt` holds one version; every fix `verify-run-log.txt` shows no disagreement; `compare.mjs --base-only` exits 0 for both skills; spend within the cap.

## Dependencies
- task-01-eval-helpers.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-fix-debug/task-01-eval-helpers.md && n=0 && for d in evals/results/fix/lean-goc-* evals/results/debug/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; case "$d" in evals/results/fix/*) grep -q ' runs=10 .* disagreements=0$' "$d/verify-run-log.txt" || { echo "verify: $d"; exit 1; };; esac; n=$((n+1)); done && [ "$n" = 16 ] && echo "cells=$n" && node evals/lean/compare.mjs --skill fix --base-only && node evals/lean/compare.mjs --skill debug --base-only && node evals/lean/budget.mjs spent`
- Named probe: `loaded.txt` summary lines, `verify-run-log.txt`, `compare.mjs --base-only`, `budget.mjs spent`.
- Reachability: `evals/run.sh` invoked from the repository root writes to `evals/results/<skill>/<out>` (`evals/run.sh` `--out`).
- Oracle: `cells=16`, both `--base-only` exit 0, `budget: spent=<x> cap=150` with exit 0.
- Counterexample: a cell missing, partial, or with any run not loaded makes the Command exit 1.
- Artifacts: result directories (gitignored, local); costs counted by `budget.mjs`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-fix-debug/task-01-eval-helpers.md && n=0 && for d in evals/results/fix/lean-goc-* evals/results/debug/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; case "$d" in evals/results/fix/*) grep -q ' runs=10 .* disagreements=0$' "$d/verify-run-log.txt" || { echo "verify: $d"; exit 1; };; esac; n=$((n+1)); done && [ "$n" = 16 ] && echo "cells=$n" && node evals/lean/compare.mjs --skill fix --base-only && node evals/lean/compare.mjs --skill debug --base-only && node evals/lean/budget.mjs spent
Exit: 0
Base: 659b7053ca581085ca5c84977e6c1741c96f9b28
Head: a7e96572b408dd10f597b3cd348c07c37382a937cd2eea750e7b0c803a2741c1
```text
cells=16
cell=cham-hop-dong-sonnet base ok runs=10
cell=cham-hop-dong-opus base ok runs=10
cell=loi-don-gian-sonnet base ok runs=10
cell=loi-don-gian-opus base ok runs=10
cell=red-truoc-sonnet base ok runs=10
cell=red-truoc-opus base ok runs=10
cell=sua-test-cho-xanh-sonnet base ok runs=10
cell=sua-test-cho-xanh-opus base ok runs=10
cell=chi-chan-doan-sonnet base ok runs=10
cell=chi-chan-doan-opus base ok runs=10
cell=doc-ma-sai-huong-sonnet base ok runs=10
cell=doc-ma-sai-huong-opus base ok runs=10
cell=loi-hien-nhien-sonnet base ok runs=10
cell=loi-hien-nhien-opus base ok runs=10
cell=staging-dung-chung-sonnet base ok runs=10
cell=staging-dung-chung-opus base ok runs=10
budget: spent=28.0447 cap=150
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any cell existed the Command exited 1 (`not loaded: evals/results/fix/lean-goc-*`).
- Paid runs: pilots `lean-pilot-goc-red-truoc-{sonnet 3/3, opus 1/1}`, `lean-pilot-goc-chi-chan-doan-{sonnet 3/3, opus 1/1}`, all loaded via slash, clean; then 16 cells, every one `partial=false`, 10 runs, 0 errored or skipped, `loaded=10/10`, host `2.1.289 (Claude Code)` before and after, fix cells `disagreements=0`; no `-lan1` rerun was needed. The first three cells ran single-lane, the rest in two lanes (one per model) per the user's decision recorded in plan.md. Spend $28.0447 of $150.
- Guards: every invocation checked the skill and instrument digests of task 02 Step 1, the `evals/run.sh` sha256 and node v22.23.3 before running; `git diff --stat 659b705` over skills, `evals/fix`, `evals/debug` and `evals/run.sh` is empty.
- Review: code-auditor PASS (suite options per D-03: `modelOverride`, `judgeModel=claude-sonnet-5-5`, plugin name `cf`, threshold 0, ablation none).
- Artifacts: `evals/results/{fix,debug}/lean-goc-*` and `lean-pilot-goc-*` (gitignored, local) with `result.json`, `host.txt`, `loaded.txt`, and for fix `verify-run-log.txt`.
