# Task 04 — The lean test skill is measured in the same 18 cells and compared

Status: done

## Outcome
Eighteen result directories `evals/results/test/lean-sau-<case>-<model>` on task 03's final skill bytes with task 02's options; `specs/lean-test/compare-test.txt` from `evals/lean/compare.mjs --skill test` and `specs/lean-test/payload-test.txt` from `evals/test/check-payload.mjs --pair` over the six process-first cases, for GATE-DONE.

## Scope
- In: 2 pilots and 18 cells as task 02 with `goc` → `sau` (saved, archived, digest-stamped); the two comparison files.
- Out: any skill, case, grader or `evals/run.sh` edit; a further repair round.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/test/lean-sau-*`, `evals/results/test/lean-pilot-sau-*` (gitignored), `specs/lean-test/compare-test.txt`, `specs/lean-test/payload-test.txt`
- Read: task 02's Steps, `evals/lean/*`

## Steps
1. The lean test skill digest is the one in task 03's Receipt note; `evals/test` and `evals/run.sh` must equal task 02's values; guard every invocation on them. A different `claude --version` does not stop the run; `compare.mjs` tags `HOST-DRIFT`.
2. Pilots and cells exactly as task 02 Steps 2–4 with `goc` replaced by `sau`.
3. `node evals/lean/compare.mjs --skill test > specs/lean-test/compare-test.txt`; `node evals/test/check-payload.mjs --pair $(for c in sach do khong-test thieu-cong-cu trung-probe khong-cham-code; do for m in sonnet opus; do printf 'evals/results/test/lean-goc-%s-%s,evals/results/test/lean-sau-%s-%s ' $c $m $c $m; done; done) > specs/lean-test/payload-test.txt`.
4. Run the Command.

## Acceptance
- AC-04: 18 lean cells complete, saved, loaded 10/10 and stamped with task 03's digest; `payload-test.txt` equals a fresh run; `compare-test.txt` ends with a `regress= host-drift=` line and equals a fresh run; spend within the cap.

## Dependencies
- task-01-test-helpers.md
- task-03-lean-rewrite.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-test/task-03-lean-rewrite.md && n=0 && for d in evals/results/test/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-test/task-03-lean-rewrite.md | tail -1); [ -n "$dg" ] && grep -qx "$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node evals/test/save-runs.mjs --check-saved "$d" > /dev/null || { echo "saved: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 18 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill test > $t/c.txt && cmp $t/c.txt specs/lean-test/compare-test.txt && node evals/test/check-payload.mjs --pair $(for c in sach do khong-test thieu-cong-cu trung-probe khong-cham-code; do for m in sonnet opus; do printf 'evals/results/test/lean-goc-%s-%s,evals/results/test/lean-sau-%s-%s ' $c $m $c $m; done; done) > $t/p.txt && cmp $t/p.txt specs/lean-test/payload-test.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-test/compare-test.txt)" = 18 ] && tail -1 specs/lean-test/compare-test.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills test --cap 200`
- Named probe: saved `loaded.txt`, `skill-digest.txt`; `save-runs.mjs --check-saved`; `compare.mjs` and `check-payload.mjs --pair` re-runs byte-equal to the saved files; `budget.mjs spent`.
- Reachability: as task 02.
- Oracle: `cells=18`, one `regress=<k> host-drift=<h>` line, `budget: spent=<x> cap=200`, exit 0; the values are read at GATE-DONE.
- Counterexample: a missing, unsaved or not-loaded cell, a cell on bytes other than task 03's, or a saved comparison that differs from a fresh run makes the Command exit 1.
- Artifacts: result directories (gitignored); `compare-test.txt`, `payload-test.txt` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-test/task-03-lean-rewrite.md && n=0 && for d in evals/results/test/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-test/task-03-lean-rewrite.md | tail -1); [ -n "$dg" ] && grep -qx "$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node evals/test/save-runs.mjs --check-saved "$d" > /dev/null || { echo "saved: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 18 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill test > $t/c.txt && cmp $t/c.txt specs/lean-test/compare-test.txt && node evals/test/check-payload.mjs --pair $(for c in sach do khong-test thieu-cong-cu trung-probe khong-cham-code; do for m in sonnet opus; do printf 'evals/results/test/lean-goc-%s-%s,evals/results/test/lean-sau-%s-%s ' $c $m $c $m; done; done) > $t/p.txt && cmp $t/p.txt specs/lean-test/payload-test.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-test/compare-test.txt)" = 18 ] && tail -1 specs/lean-test/compare-test.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills test --cap 200
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: e1e86cebb3e7e402b7142325f4500fe98ee92ba9a080e88e577d20c714e45e38
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-test/task-03-lean-rewrite.md && n=0 && for d in evals/results/test/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-test/task-03-lean-rewrite.md | tail -1); [ -n "$dg" ] && grep -qx "$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node evals/test/save-runs.mjs --check-saved "$d" > /dev/null || { echo "saved: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 18 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill test > $t/c.txt && cmp $t/c.txt specs/lean-test/compare-test.txt && node evals/test/check-payload.mjs --pair $(for c in sach do khong-test thieu-cong-cu trung-probe khong-cham-code; do for m in sonnet opus; do printf 'evals/results/test/lean-goc-%s-%s,evals/results/test/lean-sau-%s-%s ' $c $m $c $m; done; done) > $t/p.txt && cmp $t/p.txt specs/lean-test/payload-test.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-test/compare-test.txt)" = 18 ] && tail -1 specs/lean-test/compare-test.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills test --cap 200
cells=18
regress=0 host-drift=0
budget: spent=81.0624 cap=200
```

Lean cells on skill=439519986ae5ca35, pilots sonnet 3/3 opus 1/1 loaded, each cell loaded 10/10, 0 errored runs, saved and archived. compare-test.txt: regress=0 host-drift=0. payload-test.txt: delivered and placed 10/10 → 10/10 in every process-first cell; valid moves within two runs (largest sach sonnet, thieu-cong-cu opus and khong-cham-code sonnet 10/10 → 8/10, each p=0.4737; thieu-cong-cu sonnet 9 → 10); trung-probe n/a by design.
