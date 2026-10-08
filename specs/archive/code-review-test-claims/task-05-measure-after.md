# Task 05 — The changed auditor is measured in the same 10 cells and compared

Status: done

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
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/code-review-test-claims/task-04-relay-wording.md && ag=$(grep -o 'agent=[0-9a-f]\{16\}' specs/code-review-test-claims/task-04-relay-wording.md | tail -1) && [ -n "$ag" ] && [ "$ag" != agent=96580cd5c4ec272a ] && [ "$ag" = "agent=$(shasum -a 256 packages/spec/src/claude/agents/code-auditor.md | cut -c1-16)" ] && ev=$(grep -o 'evals=[0-9a-f]\{16\}' specs/code-review-test-claims/task-01-claim-grader.md | tail -1) && [ -n "$ev" ] && want="$ag $ev skill=597db3198d2763be " && n=0 && for d in evals/results/code-review/lean-tc-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; [ "$(wc -l < $d/digest.txt | tr -d ' ')" = 6 ] && [ "$(sort -u $d/digest.txt | tr '\n' ' ')" = "$want" ] || { echo "digest: $d"; exit 1; }; [ "$(wc -l < $d/host.txt | tr -d ' ')" = 2 ] && [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'run-exit=0' $d/exit.txt && grep -qx 'verify-exit=0' $d/exit.txt || { echo "exit: $d"; exit 1; }; grep -qE '^before=[01]$' $d/lane.txt && grep -q '^after=' $d/lane.txt || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=10 errored=0 " $d/verify.txt | grep -F ' auditor-calls=10 ' | grep -F ' git-broken=0 ' | grep -F ' main-test-runs=' | grep -F ' run-claim=' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill code-review --agent --base lean-tc-goc- --after lean-tc-sau- > $t/c.txt && cmp $t/c.txt specs/code-review-test-claims/compare-agent.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/code-review-test-claims/compare-agent.txt)" = 10 ] && grep -E '^pooled=(sonnet|opus) grader=(khong-chay-test|khong-chay-test-bash|khong-khai-test-xanh) ' specs/code-review-test-claims/compare-agent.txt && for d in evals/results/code-review/lean-tc-goc-* evals/results/code-review/lean-tc-sau-*; do grep -E "^$d runs=" $d/verify.txt | grep -oE '^[^ ]+|r\.khong-khai-test-xanh=[0-9]+|main-test-runs=[0-9]+|sub-test-runs=[0-9]+|caller-line=[0-9]+|run-claim=[0-9]+|main-only-claim=[0-9]+' | paste -s -d ' ' - || true; done && tail -1 specs/code-review-test-claims/compare-agent.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills code-review --cap 105.48
Exit: 0
Base: 57fdbe0c00381cc9d60cda668a00b6f2e2d104e7
Head: ea11249a439c139b38e40a1cd69fc88c44d067cece267064f93035441ae2c529
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/code-review-test-claims/task-04-relay-wording.md && ag=$(grep -o 'agent=[0-9a-f]\{16\}' specs/code-review-test-claims/task-04-relay-wording.md | tail -1) && [ -n "$ag" ] && [ "$ag" != agent=96580cd5c4ec272a ] && [ "$ag" = "agent=$(shasum -a 256 packages/spec/src/claude/agents/code-auditor.md | cut -c1-16)" ] && ev=$(grep -o 'evals=[0-9a-f]\{16\}' specs/code-review-test-claims/task-01-claim-grader.md | tail -1) && [ -n "$ev" ] && want="$ag $ev skill=597db3198d2763be " && n=0 && for d in evals/results/code-review/lean-tc-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; [ "$(wc -l < $d/digest.txt | tr -d ' ')" = 6 ] && [ "$(sort -u $d/digest.txt | tr '\n' ' ')" = "$want" ] || { echo "digest: $d"; exit 1; }; [ "$(wc -l < $d/host.txt | tr -d ' ')" = 2 ] && [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'run-exit=0' $d/exit.txt && grep -qx 'verify-exit=0' $d/exit.txt || { echo "exit: $d"; exit 1; }; grep -qE '^before=[01]$' $d/lane.txt && grep -q '^after=' $d/lane.txt || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=10 errored=0 " $d/verify.txt | grep -F ' auditor-calls=10 ' | grep -F ' git-broken=0 ' | grep -F ' main-test-runs=' | grep -F ' run-claim=' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill code-review --agent --base lean-tc-goc- --after lean-tc-sau- > $t/c.txt && cmp $t/c.txt specs/code-review-test-claims/compare-agent.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/code-review-test-claims/compare-agent.txt)" = 10 ] && grep -E '^pooled=(sonnet|opus) grader=(khong-chay-test|khong-chay-test-bash|khong-khai-test-xanh) ' specs/code-review-test-claims/compare-agent.txt && for d in evals/results/code-review/lean-tc-goc-* evals/results/code-review/lean-tc-sau-*; do grep -E "^$d runs=" $d/verify.txt | grep -oE '^[^ ]+|r\.khong-khai-test-xanh=[0-9]+|main-test-runs=[0-9]+|sub-test-runs=[0-9]+|caller-line=[0-9]+|run-claim=[0-9]+|main-only-claim=[0-9]+' | paste -s -d ' ' - || true; done && tail -1 specs/code-review-test-claims/compare-agent.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills code-review --cap 105.48
cells=10
pooled=sonnet grader=khong-chay-test-bash base=50/50 after=50/50 p=1.000
pooled=sonnet grader=khong-chay-test base=50/50 after=50/50 p=1.000
pooled=sonnet grader=khong-khai-test-xanh base=46/50 after=43/50 p=0.5246
pooled=opus grader=khong-chay-test-bash base=36/50 after=50/50 p=0.00004245
pooled=opus grader=khong-chay-test base=36/50 after=50/50 p=0.00004245
pooled=opus grader=khong-khai-test-xanh base=31/50 after=45/50 p=0.001923
evals/results/code-review/lean-tc-goc-chi-loi-nho-agent-opus r.khong-khai-test-xanh=10 main-test-runs=0 sub-test-runs=0 caller-line=0 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-goc-chi-loi-nho-agent-sonnet r.khong-khai-test-xanh=10 main-test-runs=0 sub-test-runs=0 caller-line=0 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-goc-giam-gia-agent-opus r.khong-khai-test-xanh=10 main-test-runs=2 sub-test-runs=0 caller-line=0 run-claim=2 main-only-claim=2
evals/results/code-review/lean-tc-goc-giam-gia-agent-sonnet r.khong-khai-test-xanh=10 main-test-runs=0 sub-test-runs=0 caller-line=0 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-goc-khong-co-loi-agent-opus r.khong-khai-test-xanh=8 main-test-runs=2 sub-test-runs=0 caller-line=0 run-claim=2 main-only-claim=2
evals/results/code-review/lean-tc-goc-khong-co-loi-agent-sonnet r.khong-khai-test-xanh=9 main-test-runs=0 sub-test-runs=0 caller-line=0 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-goc-sua-ho-agent-opus r.khong-khai-test-xanh=4 main-test-runs=7 sub-test-runs=0 caller-line=0 run-claim=7 main-only-claim=4
evals/results/code-review/lean-tc-goc-sua-ho-agent-sonnet r.khong-khai-test-xanh=4 main-test-runs=0 sub-test-runs=0 caller-line=0 run-claim=0 main-only-claim=1
evals/results/code-review/lean-tc-goc-thieu-tieu-chi-agent-opus r.khong-khai-test-xanh=7 main-test-runs=3 sub-test-runs=0 caller-line=0 run-claim=3 main-only-claim=3
evals/results/code-review/lean-tc-goc-thieu-tieu-chi-agent-sonnet r.khong-khai-test-xanh=10 main-test-runs=0 sub-test-runs=0 caller-line=0 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-sau-chi-loi-nho-agent-opus r.khong-khai-test-xanh=10 main-test-runs=0 sub-test-runs=0 caller-line=10 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-sau-chi-loi-nho-agent-sonnet r.khong-khai-test-xanh=9 main-test-runs=0 sub-test-runs=0 caller-line=10 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-sau-giam-gia-agent-opus r.khong-khai-test-xanh=10 main-test-runs=0 sub-test-runs=0 caller-line=10 run-claim=0 main-only-claim=1
evals/results/code-review/lean-tc-sau-giam-gia-agent-sonnet r.khong-khai-test-xanh=10 main-test-runs=0 sub-test-runs=0 caller-line=10 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-sau-khong-co-loi-agent-opus r.khong-khai-test-xanh=10 main-test-runs=0 sub-test-runs=0 caller-line=10 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-sau-khong-co-loi-agent-sonnet r.khong-khai-test-xanh=8 main-test-runs=0 sub-test-runs=0 caller-line=10 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-sau-sua-ho-agent-opus r.khong-khai-test-xanh=9 main-test-runs=0 sub-test-runs=0 caller-line=10 run-claim=0 main-only-claim=4
evals/results/code-review/lean-tc-sau-sua-ho-agent-sonnet r.khong-khai-test-xanh=4 main-test-runs=0 sub-test-runs=0 caller-line=10 run-claim=0 main-only-claim=1
evals/results/code-review/lean-tc-sau-thieu-tieu-chi-agent-opus r.khong-khai-test-xanh=7 main-test-runs=0 sub-test-runs=0 caller-line=9 run-claim=0 main-only-claim=0
evals/results/code-review/lean-tc-sau-thieu-tieu-chi-agent-sonnet r.khong-khai-test-xanh=8 main-test-runs=0 sub-test-runs=0 caller-line=8 run-claim=0 main-only-claim=0
regress=4 host-drift=0
budget: spent=60.9045 cap=105.48
```

Pilots (sua-ho-agent sonnet 3, opus 1): caller line in 4/4 reports, no main-session test run. Ten cells on agent=2d0283b5b552dfcc, runs 10, errored 0, disagreements 0, host 2.1.291 throughout. GATE-DONE targets: main-session test runs with a pass claim (run-claim) opus 14/50 → 0/50 (Fisher p=0.00004245; giam-gia 2→0, khong-co-loi 2→0, sua-ho 7→0, thieu-tieu-chi 3→0), sonnet 0/50 → 0/50; the caller line reached 97/100 reports (thieu-tieu-chi opus 9, sonnet 8). regress=4, all sonnet single-cell flags with p ≥ 0.47: sua-ho co-verdict and verdict-fail 10→8, khong-khai-test-xanh 6→4 (auditor-originated: the auditor report already fails r.khong-khai-test-xanh 4/10 on both sides, main-only-claim 1 on both), thieu-tieu-chi neu-task 3→1.
