# Task 03 — The current auditor is measured on the agent path with the new grader

Status: pending

## Outcome
Ten result directories `evals/results/code-review/lean-tc-goc-<case>-agent-<model>` (`chi-loi-nho`, `giam-gia`, `khong-co-loi`, `sua-ho`, `thieu-tieu-chi` × sonnet, opus), ten counted runs each, every run calling `code-auditor`, on the auditor bytes of `09ed604f` (`agent=96580cd5c4ec272a`) and task 01's instrument, with `digest.txt`, `host.txt`, `exit.txt`, `lane.txt` and `verify.txt` saved in the same shell step as the run.

## Scope
- In: 2 pilots and 10 cells in two lanes (plan D-05), evidence per plan D-06, reruns per plan D-07, budget per plan D-08.
- Out: any edit to `code-auditor.md`, the skill, the instrument, `evals/run.sh` or the helpers.

## Coverage
- CP-04

## Ownership
- Create: `evals/results/code-review/lean-tc-goc-*`, `evals/results/code-review/lean-tc-pilot-goc-*` (gitignored); runner `~/Desktop/cafekit-lean-logs/bin/tc-cell.sh` and logs `~/Desktop/cafekit-lean-logs/tc-*.log` (untracked, outside the repo)
- Read: `evals/run.sh`, `evals/code-review/verify-runs.mjs`, `evals/lean/{compare,budget}.mjs`, task 01's Receipt note

## Steps
0. `specs/_shared/active-feature.json` reads `{"featureName":"code-review-test-claims"}`. Read `evals=<16 hex>` from task 01's Receipt note.
1. Write the runner `~/Desktop/cafekit-lean-logs/bin/tc-cell.sh <name> <case> <model> <runs> <max-cost> <agent-digest>` (bash, reused by task 05, `set -o pipefail`, no variable named `PREFIX`). It runs from the repo root and, with `dir=evals/results/code-review/<name>`, stops before the run on any guard mismatch: `shasum -a 256 packages/spec/src/claude/agents/code-auditor.md` first 16 hex = `<agent-digest>` (here `96580cd5c4ec272a`); directory digest (`find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`, first 16 hex) of `packages/spec/src/claude/skills/code-review` = `597db3198d2763be` and of `evals/code-review` = task 01's `evals=`; `shasum -a 256 evals/run.sh` starts `a75cd5b5fbe5b643`; `node --version` = `v22.23.3`; `command -v git` = `/opt/homebrew/bin/git`; `node evals/lean/budget.mjs check <max-cost> --skills code-review --cap 105.48` exits 0; `pgrep -f '[c]laude plugin eval' | wc -l` below 2 (wait and retry while ≥2).
2. In the same script, in this order (plan D-06): record the three digests as `agent=`, `skill=`, `evals=` and `claude --version`; the run (plan D-05 options, `--out <name> --case <case> --runs <runs> --max-cost-usd <max-cost>`); then write `digest.txt` (the three lines before and the three recomputed after), `host.txt` (the version before and after, nothing else), `lane.txt` (`before=<k>`, `after=<k>`), `exit.txt` (`run-exit=<n>`), then at once `node evals/code-review/verify-runs.mjs evals/results/code-review/<name> > <dir>/verify.txt 2>&1` and append `verify-exit=<n>` to `exit.txt`. Log to `~/Desktop/cafekit-lean-logs/tc-<name>.log`.
3. Pilots, `--case sua-ho-agent`: sonnet 3 runs `--max-cost-usd 2`, opus 1 run `--max-cost-usd 1.5`, named `lean-tc-pilot-goc-sua-ho-agent-<model>`. Stop and ask the user when a pilot has an error, `run-exit` other than 0, `auditor-calls` below its runs, `git-broken` other than 0, a disagreement, or no `main-test-cmds=` / `sub-test-cmds=` / `caller-line=` / `run-claim=` token.
4. Cells `lean-tc-goc-<case>-agent-<model>` for the five cases as separate words, `--runs 10 --max-cost-usd 5`, one lane per model, one invocation at a time per lane. A cell that breaks plan D-07's conditions (including session-limit, OAuth or quota errors, after the limit resets, and two different `host.txt` lines) reruns once into `<cell>-lan1`; a short `-lan1` → stop and ask the user. `run.sh` refuses an existing `--out`; never reuse a name.
5. Run the Command.

## Acceptance
- AC-03: 10 cells; each `digest.txt` 6 lines whose distinct values are exactly `agent=96580cd5c4ec272a`, task 01's `evals=`, `skill=597db3198d2763be`; each `host.txt` 2 equal lines; each `exit.txt` `run-exit=0` and `verify-exit=0`; each `lane.txt` `before=` below 2; each `verify.txt` directory line `runs=10 errored=0`, `auditor-calls=10`, `git-broken=0`, `main-test-runs=` and `run-claim=` tokens, `disagreements=0`; `compare.mjs --agent --base-only` prints 10 `base ok runs=10`; the auditor is still at its base bytes; spend within the cap.

## Dependencies
- task-01-claim-grader.md
- task-02-agent-compare.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/code-review-test-claims/task-01-claim-grader.md && grep -q '^Status: done' specs/code-review-test-claims/task-02-agent-compare.md && ev=$(grep -o 'evals=[0-9a-f]\{16\}' specs/code-review-test-claims/task-01-claim-grader.md | tail -1) && [ -n "$ev" ] && [ "$ev" != evals=ca9269c02676dd76 ] && want="agent=96580cd5c4ec272a $ev skill=597db3198d2763be " && n=0 && for d in evals/results/code-review/lean-tc-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; [ "$(wc -l < $d/digest.txt | tr -d ' ')" = 6 ] && [ "$(sort -u $d/digest.txt | tr '\n' ' ')" = "$want" ] || { echo "digest: $d"; exit 1; }; [ "$(wc -l < $d/host.txt | tr -d ' ')" = 2 ] && [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'run-exit=0' $d/exit.txt && grep -qx 'verify-exit=0' $d/exit.txt || { echo "exit: $d"; exit 1; }; grep -qE '^before=[01]$' $d/lane.txt && grep -q '^after=' $d/lane.txt || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=10 errored=0 " $d/verify.txt | grep -F ' auditor-calls=10 ' | grep -F ' git-broken=0 ' | grep -F ' main-test-runs=' | grep -F ' run-claim=' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && b=$(mktemp) && node evals/lean/compare.mjs --skill code-review --agent --base lean-tc-goc- --base-only > $b && cat $b && [ "$(grep -c ' base ok runs=10$' $b)" = 10 ] && [ "$(shasum -a 256 packages/spec/src/claude/agents/code-auditor.md | cut -c1-16)" = 96580cd5c4ec272a ] && echo agent-still-base && node evals/lean/budget.mjs spent --skills code-review --cap 105.48`
- Named probe: per-cell `digest.txt`, `host.txt`, `exit.txt`, `lane.txt`, `verify.txt` (`verify-runs.mjs` directory line); `compare.mjs --agent --base-only`; `budget.mjs spent`.
- Reachability: `evals/run.sh code-review --with-agent code-auditor --plugin-name cf` copies `packages/spec/src/claude/agents/code-auditor.md` into the plugin (`evals/run.sh:86-88`) and writes `evals/results/code-review/<out>`; the `-agent` prompts ask for `code-auditor`.
- Oracle: `cells=10`, 10 `base ok runs=10` lines, `agent-still-base`, `budget: spent=<x> cap=105.48`, exit 0.
- Counterexample: a cell with fewer than 10 counted runs, an errored run, an auditor not called in every run, other auditor or instrument bytes, a host change inside a cell (D-07 reruns it into `-lan1`), a missing evidence file, broken git or a disagreement makes the Command exit 1.
- Artifacts: result directories and evidence files (gitignored, local); runner and logs under `~/Desktop/cafekit-lean-logs/`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
