# Task 04 — The lean code-review skill is measured in the same 10 cells and compared

Status: done

## Outcome
Ten result directories `evals/results/code-review/lean-sau-<case>-<model>` on task 03's skill with task 02's options and evidence files, and `specs/lean-code-review/compare-code-review.txt` from `evals/lean/compare.mjs --skill code-review` for GATE-DONE.

## Scope
- In: 2 pilots and 10 cells as task 02 with `goc` → `sau` (same evidence files, plan D-08 lanes); the comparison file.
- Out: any skill, agent, case, grader or `evals/run.sh` edit; a further repair round.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/code-review/lean-sau-*`, `evals/results/code-review/lean-pilot-sau-*` (gitignored), `specs/lean-code-review/compare-code-review.txt`
- Read: task 02's Steps, `evals/lean/*`, `evals/code-review/verify-runs.mjs`

## Steps
1. Read the lean code-review skill digest from task 03's Receipt note (`skill=<16 hex>`), recompute it with task 02 Step 1's formula and stop if they differ or if it equals task 02's `33efcf3d10e73892`; every cell's `skill-digest.txt` carries that `skill=` line; `evals/code-review` (`ca9269c02676dd76`) and `evals/run.sh` (`a75cd5b5fbe5b643`) must equal task 02's values; guard every invocation on them, on `budget.mjs check <c> --skills code-review --cap 120` and on `pgrep -f '[c]laude plugin eval' | wc -l` below 2 (plan D-08). A different `claude --version` does not stop the run; `compare.mjs` tags `HOST-DRIFT`.
2. Pilots and cells exactly as task 02 Steps 2–4 with `goc` replaced by `sau`, each followed at once by its `lane.txt`, `skill-digest.txt`, `host.txt` (with `run-exit=` and `loaded-exit=`), `loaded.txt` and `verify.txt` (plan D-07), including task 02 Step 4's disagreement rerun and stop.
3. `node evals/lean/compare.mjs --skill code-review > specs/lean-code-review/compare-code-review.txt`.
4. Run the Command.

## Acceptance
- AC-04: 10 lean cells complete and loaded 10/10 (`loaded-exit=0`), each `skill-digest.txt` equal to task 03's recorded lean digest, each with `lane.txt`, and `verify.txt` showing `git-broken=0` and `disagreements=0`; `compare-code-review.txt` ends with a `regress= host-drift=` line and equals a fresh run; spend within the cap.

## Dependencies
- task-01-code-review-helpers.md
- task-03-lean-rewrite.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-code-review/task-03-lean-rewrite.md && n=0 && for d in evals/results/code-review/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] && grep -q '^run-exit=' "$d/host.txt" && grep -qx 'loaded-exit=0' "$d/host.txt" || { echo "host: $d"; exit 1; }; dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-code-review/task-03-lean-rewrite.md | tail -1); [ -n "$dg" ] && [ "$dg" != skill=33efcf3d10e73892 ] && grep -qx "$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -q '^pgrep=' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=" "$d/verify.txt" | grep -E ' git-broken=0 ' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill code-review > $t/c.txt && cmp $t/c.txt specs/lean-code-review/compare-code-review.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-code-review/compare-code-review.txt)" = 10 ] && tail -1 specs/lean-code-review/compare-code-review.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills code-review --cap 120`
- Named probe: saved `loaded.txt`, `host.txt` exit lines, `skill-digest.txt` against task 03's Receipt note, `lane.txt` and `verify.txt`; `compare.mjs` re-run byte-equal to the saved file; `budget.mjs spent`.
- Reachability: as task 02.
- Oracle: `cells=10`, one `regress=<k> host-drift=<h>` line, `budget: spent=<x> cap=120`, exit 0; the values are read at GATE-DONE.
- Counterexample: a missing or not-loaded cell, a skill digest other than task 03's recorded lean digest, a missing exit line or `lane.txt`, a `verify.txt` with broken git or a disagreement, or a saved comparison that differs from a fresh run makes the Command exit 1.
- Artifacts: result directories (gitignored); `compare-code-review.txt` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-code-review/task-03-lean-rewrite.md && n=0 && for d in evals/results/code-review/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] && grep -q '^run-exit=' "$d/host.txt" && grep -qx 'loaded-exit=0' "$d/host.txt" || { echo "host: $d"; exit 1; }; dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-code-review/task-03-lean-rewrite.md | tail -1); [ -n "$dg" ] && [ "$dg" != skill=33efcf3d10e73892 ] && grep -qx "$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -q '^pgrep=' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=" "$d/verify.txt" | grep -E ' git-broken=0 ' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill code-review > $t/c.txt && cmp $t/c.txt specs/lean-code-review/compare-code-review.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-code-review/compare-code-review.txt)" = 10 ] && tail -1 specs/lean-code-review/compare-code-review.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills code-review --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: e1e86cebb3e7e402b7142325f4500fe98ee92ba9a080e88e577d20c714e45e38
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-code-review/task-03-lean-rewrite.md && n=0 && for d in evals/results/code-review/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] && grep -q '^run-exit=' "$d/host.txt" && grep -qx 'loaded-exit=0' "$d/host.txt" || { echo "host: $d"; exit 1; }; dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-code-review/task-03-lean-rewrite.md | tail -1); [ -n "$dg" ] && [ "$dg" != skill=33efcf3d10e73892 ] && grep -qx "$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -q '^pgrep=' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=" "$d/verify.txt" | grep -E ' git-broken=0 ' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill code-review > $t/c.txt && cmp $t/c.txt specs/lean-code-review/compare-code-review.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-code-review/compare-code-review.txt)" = 10 ] && tail -1 specs/lean-code-review/compare-code-review.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills code-review --cap 120
cells=10
regress=1 host-drift=10
budget: spent=25.4881 cap=120
```

Lean cells on skill=597db3198d2763be, each loaded 10/10, 0 errored runs, no verify disagreement or git-broken. regress=1: thieu-tieu-chi sonnet neu-task (the report names task-01-slugify.md) 10/10 → 8/10, p=0.4737, a single-cell 0.2 move with no pooled flag. host-drift=10 is an artifact of this packet's host.txt, which appends run-exit= and loaded-exit= lines after the two version lines (plan task 02 Step 2), so compare.mjs reads more than one distinct line; all 42 version lines in lean-goc and lean-sau host.txt are '2.1.291 (Claude Code)'.
