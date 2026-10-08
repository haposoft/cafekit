# Task 05 — The changed auditor is measured in the same 10 cells and compared

Status: pending

## Outcome
Ten result directories `evals/results/code-review/lean-tc-sau-<case>-agent-<model>` on task 04's auditor bytes with task 03's options and evidence files, and `specs/code-review-test-claims/compare-agent.txt` from `evals/lean/compare.mjs --skill code-review --agent --base lean-tc-goc- --after lean-tc-sau-` for GATE-DONE.

## Scope
- In: 2 pilots and 10 cells exactly as task 03 Steps 1–4 with `goc` → `sau` and the runner's `<agent-digest>` = task 04's `agent=`; the comparison file.
- Out: any edit to the auditor, the skill, the instrument, `evals/run.sh` or the helpers; a second repair round.

## Coverage
- CP-04

## Ownership
- Create: `evals/results/code-review/lean-tc-sau-*`, `evals/results/code-review/lean-tc-pilot-sau-*` (gitignored), `specs/code-review-test-claims/compare-agent.txt`
- Read: task 03's Steps and runner, task 01's and task 04's Receipt notes

## Steps
1. Read `agent=<16 hex>` from task 04's Receipt note and recompute it from `code-auditor.md`; stop if they differ or if it equals `96580cd5c4ec272a`. Read `evals=` from task 01's Receipt note; the runner's guards hold it, `skill=597db3198d2763be` and `evals/run.sh` `a75cd5b5fbe5b643` as in task 03. A different `claude --version` does not stop the run; `compare.mjs` tags `HOST-DRIFT`.
2. Pilots `lean-tc-pilot-sau-sua-ho-agent-<model>` and cells `lean-tc-sau-<case>-agent-<model>` with `~/Desktop/cafekit-lean-logs/bin/tc-cell.sh … <agent-digest>`, same runs, costs, lanes, stop and `-lan1` rules as task 03 Steps 3–4; in addition stop and ask the user when a pilot run's `caller-line` is `no` in every run (the changed bytes did not reach the report).
3. `node evals/lean/compare.mjs --skill code-review --agent --base lean-tc-goc- --after lean-tc-sau- > specs/code-review-test-claims/compare-agent.txt`.
4. Run the Command.

## Acceptance
- AC-05: 10 cells meeting task 03's per-cell conditions with `agent=` equal to task 04's recorded digest; `compare-agent.txt` equals a fresh run, has 10 `errored base=0 after=0` lines and ends with `regress=<k> host-drift=<h>`; the pooled lines and the per-cell `main-test-runs`, `run-claim` (the targets), `r.khong-khai-test-xanh`, `main-only-claim`, `sub-test-runs` and `caller-line` values are printed for GATE-DONE; spend within the cap.

## Dependencies
- task-02-agent-compare.md
- task-04-relay-wording.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/code-review-test-claims/task-04-relay-wording.md && ag=$(grep -o 'agent=[0-9a-f]\{16\}' specs/code-review-test-claims/task-04-relay-wording.md | tail -1) && [ -n "$ag" ] && [ "$ag" != agent=96580cd5c4ec272a ] && [ "$ag" = "agent=$(shasum -a 256 packages/spec/src/claude/agents/code-auditor.md | cut -c1-16)" ] && ev=$(grep -o 'evals=[0-9a-f]\{16\}' specs/code-review-test-claims/task-01-claim-grader.md | tail -1) && [ -n "$ev" ] && want="$ag $ev skill=597db3198d2763be " && n=0 && for d in evals/results/code-review/lean-tc-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; [ "$(wc -l < $d/digest.txt | tr -d ' ')" = 6 ] && [ "$(sort -u $d/digest.txt | tr '\n' ' ')" = "$want" ] || { echo "digest: $d"; exit 1; }; [ "$(wc -l < $d/host.txt | tr -d ' ')" = 2 ] && [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'run-exit=0' $d/exit.txt && grep -qx 'verify-exit=0' $d/exit.txt || { echo "exit: $d"; exit 1; }; grep -qE '^before=[01]$' $d/lane.txt && grep -q '^after=' $d/lane.txt || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=10 errored=0 " $d/verify.txt | grep -F ' auditor-calls=10 ' | grep -F ' git-broken=0 ' | grep -F ' main-test-runs=' | grep -F ' run-claim=' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill code-review --agent --base lean-tc-goc- --after lean-tc-sau- > $t/c.txt && cmp $t/c.txt specs/code-review-test-claims/compare-agent.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/code-review-test-claims/compare-agent.txt)" = 10 ] && grep -E '^pooled=(sonnet|opus) grader=(khong-chay-test|khong-chay-test-bash|khong-khai-test-xanh) ' specs/code-review-test-claims/compare-agent.txt && for d in evals/results/code-review/lean-tc-goc-* evals/results/code-review/lean-tc-sau-*; do grep -E "^$d runs=" $d/verify.txt | grep -oE '^[^ ]+|r\.khong-khai-test-xanh=[0-9]+|main-test-runs=[0-9]+|sub-test-runs=[0-9]+|caller-line=[0-9]+|run-claim=[0-9]+|main-only-claim=[0-9]+' | paste -s -d ' ' - || true; done && tail -1 specs/code-review-test-claims/compare-agent.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills code-review --cap 105.48`
- Named probe: per-cell evidence files against task 04's `agent=` and task 01's `evals=`; `compare.mjs --agent` re-run byte-equal to the saved file; the pooled lines of the two win graders and `khong-chay-test-bash`; the per-cell `main-test-runs`/`run-claim`/`r.khong-khai-test-xanh`/`main-only-claim`/`sub-test-runs`/`caller-line` table; `budget.mjs spent`.
- Reachability: as task 03; the changed bytes reach each run through `evals/run.sh --with-agent code-auditor`.
- Oracle: `cells=10`, six `pooled=` lines, twenty or more per-directory attribution lines, one `regress=<k> host-drift=<h>` line, `budget: spent=<x> cap=105.48`, exit 0; the values are read at GATE-DONE against the plan's win (targets `main-test-runs` and `run-claim`).
- Counterexample: a missing, short or errored cell, an auditor not called in every run, a digest other than task 04's, a missing evidence file, broken git or a disagreement, or a saved comparison that differs from a fresh run makes the Command exit 1.
- Artifacts: result directories (gitignored); `compare-agent.txt` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
