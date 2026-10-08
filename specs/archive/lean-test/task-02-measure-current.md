# Task 02 — The current test skill is measured in 18 cells

Status: done

## Outcome
Eighteen result directories `evals/results/test/lean-goc-<case>-<model>` (plan D-02's nine cases × sonnet and opus), ten runs each, every run loaded, on the test skill bytes of `13304cd4` before task 03 edits anything.

## Scope
- In: 2 pilots and 18 cells in two lanes (plan D-03); `host.txt`, `loaded.txt` and `skill-digest.txt` per directory; each cell saved with `evals/test/save-runs.mjs` and its kept directories archived to `evals/results/test/_kept/<cell>.tar.gz`.
- Out: any skill, case, grader or `evals/run.sh` edit.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/test/lean-goc-*`, `evals/results/test/lean-pilot-goc-*`, `evals/results/test/_saved/lean-*`, `evals/results/test/_kept/lean-*` (gitignored)
- Read: `evals/run.sh`, `evals/lean/*`

## Steps
1. Guard before every invocation (stop on any mismatch): directory digest (`find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`, first 16 hex) of `packages/spec/src/claude/skills/test` = `eeae584c1ff910ab`, and of `evals/test` equal to the value recorded in task 01's Receipt note; `shasum -a 256 evals/run.sh` starts `a75cd5b5fbe5b643`; node v22.23.3; `node evals/lean/budget.mjs check <c> --skills test --cap 200`.
2. Each invocation as plan D-03; `claude --version` before and after into `<dir>/host.txt`; the two guarded digests into `<dir>/skill-digest.txt` as `skill=<16 hex>` and `evals=<16 hex>`; then, in the same step while the traces still exist, `node evals/lean/loaded.mjs test <dir> > <dir>/loaded.txt`, `node evals/test/save-runs.mjs <cell>`, and `tar czf evals/results/test/_kept/<cell>.tar.gz` of the directories `save-runs.mjs --kept <cell>` names.
3. Pilots (`--case sach`): sonnet `--runs 3 --max-cost-usd 4`, opus `--runs 1 --max-cost-usd 3`, named `lean-pilot-goc-sach-<model>`; any run not loaded, errored or partial → stop and ask the user.
4. Cells `lean-goc-<case>-<model>` for `sach do khong-test thieu-cong-cu trung-probe khong-cham-code thuong-sach thuong-do chap-chon`, `--runs 10 --max-cost-usd 8`; a partial, errored or below-10-loaded cell reruns once into `<cell>-lan1` (plan D-06).
5. Run the Command.

## Acceptance
- AC-02: 18 cells complete, each `loaded=10/10`, each `host.txt` one version; `compare.mjs --skill test --base-only` exits 0; spend within the cap.

## Dependencies
- task-01-test-helpers.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-test/task-01-test-helpers.md && n=0 && for d in evals/results/test/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'skill=eeae584c1ff910ab' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node evals/test/save-runs.mjs --check-saved "$d" > /dev/null || { echo "saved: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 18 ] && echo "cells=$n" && b=$(mktemp) && node evals/lean/compare.mjs --skill test --base-only > $b && cat $b && [ "$(grep -c ' base ok runs=10$' $b)" = 18 ] && node evals/lean/budget.mjs spent --skills test --cap 200`
- Named probe: saved `loaded.txt`, `host.txt`, `skill-digest.txt`; `save-runs.mjs --check-saved`; `compare.mjs --base-only`; `budget.mjs spent`.
- Reachability: `evals/run.sh test` builds the plugin from `packages/spec/src/claude/skills/test` and writes `evals/results/test/<out>`.
- Oracle: `cells=18`, 18 `base ok runs=10` lines, `budget: spent=<x> cap=200`, exit 0.
- Counterexample: a missing, partial, unsaved or not-loaded cell, a host change inside a cell, or a cell run on other skill bytes makes the Command exit 1.
- Artifacts: result directories (gitignored, local).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-test/task-01-test-helpers.md && n=0 && for d in evals/results/test/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'skill=eeae584c1ff910ab' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node evals/test/save-runs.mjs --check-saved "$d" > /dev/null || { echo "saved: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 18 ] && echo "cells=$n" && b=$(mktemp) && node evals/lean/compare.mjs --skill test --base-only > $b && cat $b && [ "$(grep -c ' base ok runs=10$' $b)" = 18 ] && node evals/lean/budget.mjs spent --skills test --cap 200
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 0ba625abfa5ec016efda3e491fae679347f99ebf4594bef880d217609afdf433
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-test/task-01-test-helpers.md && n=0 && for d in evals/results/test/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'skill=eeae584c1ff910ab' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node evals/test/save-runs.mjs --check-saved "$d" > /dev/null || { echo "saved: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 18 ] && echo "cells=$n" && b=$(mktemp) && node evals/lean/compare.mjs --skill test --base-only > $b && cat $b && [ "$(grep -c ' base ok runs=10$' $b)" = 18 ] && node evals/lean/budget.mjs spent --skills test --cap 200
cells=18
cell=chap-chon-sonnet base ok runs=10
cell=chap-chon-opus base ok runs=10
cell=do-sonnet base ok runs=10
cell=do-opus base ok runs=10
cell=khong-cham-code-sonnet base ok runs=10
cell=khong-cham-code-opus base ok runs=10
cell=khong-test-sonnet base ok runs=10
cell=khong-test-opus base ok runs=10
cell=sach-sonnet base ok runs=10
cell=sach-opus base ok runs=10
cell=thieu-cong-cu-sonnet base ok runs=10
cell=thieu-cong-cu-opus base ok runs=10
cell=thuong-do-sonnet base ok runs=10
cell=thuong-do-opus base ok runs=10
cell=thuong-sach-sonnet base ok runs=10
cell=thuong-sach-opus base ok runs=10
cell=trung-probe-sonnet base ok runs=10
cell=trung-probe-opus base ok runs=10
budget: spent=41.6639 cap=200
```

Second Receipt. The first was withdrawn: cells had runs that failed on the account session limit or a revoked OAuth token, and the Command did not count runs=10 lines; the Command now asserts them (Review log). Errored cells rerun into -lan1 with 0 errors (test: chap-chon-opus, thuong-do-opus; code-review: khong-co-loi-sonnet). Every cell now has 10 counted runs, loaded 10/10, per-cell skill digest of the base bytes, host 2.1.291. Deviations: active-feature.json set at task start, not per invocation (sibling lanes ran concurrently); sibling lanes sometimes made 3 concurrent sessions (user accepted).
