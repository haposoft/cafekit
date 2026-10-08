# Task 02 — The current code-review skill is measured in 10 cells

Status: done

## Outcome
Ten result directories `evals/results/code-review/lean-goc-<case>-<model>` (plan D-02's five slash cases × sonnet and opus), ten runs each, every run loaded, with `host.txt`, `loaded.txt` and `verify.txt` saved, on the code-review skill bytes of `13304cd4` before task 03 edits anything.

## Scope
- In: 2 pilots and 10 cells in two lanes (plan D-03, D-08); `host.txt`, `skill-digest.txt`, `lane.txt`, `loaded.txt` and `verify.txt` per directory, written right after each invocation (plan D-07).
- Out: any skill, agent, case, grader or `evals/run.sh` edit.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/code-review/lean-goc-*`, `evals/results/code-review/lean-pilot-goc-*` (gitignored)
- Read: `evals/run.sh`, `evals/lean/*`, `evals/code-review/verify-runs.mjs`

## Steps
0. Set `specs/_shared/active-feature.json` to `{"featureName":"lean-code-review"}` (plan D-08).
1. Guard before every invocation (stop on any mismatch): directory digest (`find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`, first 16 hex) of `packages/spec/src/claude/skills/code-review` = `33efcf3d10e73892` and of `evals/code-review` = `ca9269c02676dd76`; `shasum -a 256 evals/run.sh` starts `a75cd5b5fbe5b643`; node v22.23.3; `command -v git` = `/opt/homebrew/bin/git`; `node evals/lean/budget.mjs check <c> --skills code-review --cap 120`; `pgrep -f '[c]laude plugin eval' | wc -l` below 2 (wait while it reads ≥2; plan D-08).
2. `<dir>` is the repo-relative path `evals/results/code-review/<name>` (the Command matches `verify.txt`'s directory line by it). Each invocation as plan D-03, chained in one shell with its evidence: the Step 1 `pgrep` count appended as `pgrep=<n>` to `<dir>/lane.txt`; the two guarded digests written to `<dir>/skill-digest.txt` as `skill=<16 hex>` and `evals=<16 hex>`; `claude --version > <dir>/host.txt` is taken before and appended after; the run is `evals/run.sh …; echo "run-exit=$?" >> <dir>/host.txt`; then at once `node evals/lean/loaded.mjs code-review <dir> > <dir>/loaded.txt; echo "loaded-exit=$?" >> <dir>/host.txt` and `node evals/code-review/verify-runs.mjs <dir> > <dir>/verify.txt 2>&1; echo "verify-exit=$?" >> <dir>/verify.txt` (the kept temp directories vanish on reboot).
3. Pilots (`--case chi-loi-nho`): sonnet `--runs 3 --max-cost-usd 2`, opus `--runs 1 --max-cost-usd 1.5`, named `lean-pilot-goc-chi-loi-nho-<model>`; any run not loaded, errored or partial, or a `verify.txt` directory line with `git-broken` other than 0 or `disagreements` other than 0 → stop and ask the user.
4. Cells `lean-goc-<case>-<model>` for `giam-gia khong-co-loi chi-loi-nho sua-ho thieu-tieu-chi`, `--runs 10 --max-cost-usd 5`; a partial, errored (including `run-exit` other than 0), below-10-loaded or `git-broken` cell reruns once into `<cell>-lan1` (plan D-06); a cell whose `verify.txt` directory line shows `disagreements` other than 0 reruns once into `<cell>-lan1`, and if the `-lan1` still disagrees, stop and ask the user; a quota or rate-limit error stops both lanes and asks the user.
5. Run the Command.

## Acceptance
- AC-02: 10 cells complete, each `loaded=10/10` with `loaded-exit=0`, each `host.txt` one version and a `run-exit=` line, each `skill-digest.txt` `skill=33efcf3d10e73892`, each `lane.txt` present, each `verify.txt` directory line `git-broken=0` and `disagreements=0`; `compare.mjs --skill code-review --base-only` exits 0; spend within the cap.

## Dependencies
- task-01-code-review-helpers.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-code-review/task-01-code-review-helpers.md && n=0 && for d in evals/results/code-review/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(grep -v = "$d/host.txt" | sort -u | wc -l | tr -d ' ')" = 1 ] && grep -q '^run-exit=' "$d/host.txt" && grep -qx 'loaded-exit=0' "$d/host.txt" || { echo "host: $d"; exit 1; }; grep -qx 'skill=33efcf3d10e73892' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -q '^pgrep=' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=" "$d/verify.txt" | grep -E ' git-broken=0 ' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && b=$(mktemp) && node evals/lean/compare.mjs --skill code-review --base-only > $b && cat $b && [ "$(grep -c ' base ok runs=10$' $b)" = 10 ] && node evals/lean/budget.mjs spent --skills code-review --cap 120`
- Named probe: saved `loaded.txt`, `host.txt` (version, `run-exit`, `loaded-exit`), `skill-digest.txt`, `lane.txt` and `verify.txt`; `compare.mjs --base-only`; `budget.mjs spent`.
- Reachability: `evals/run.sh code-review` builds the plugin `cf` from `packages/spec/src/claude/skills/code-review` and writes `evals/results/code-review/<out>`.
- Oracle: `cells=10`, 10 `base ok runs=10` lines, `budget: spent=<x> cap=120`, exit 0.
- Counterexample: a missing, partial or not-loaded cell, a host change inside a cell, a missing exit line or `loaded-exit` other than 0, a skill digest other than `33efcf3d10e73892`, a missing `lane.txt`, or a `verify.txt` with broken git or a disagreement makes the Command exit 1.
- Artifacts: result directories (gitignored, local).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-code-review/task-01-code-review-helpers.md && n=0 && for d in evals/results/code-review/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(grep -v = "$d/host.txt" | sort -u | wc -l | tr -d ' ')" = 1 ] && grep -q '^run-exit=' "$d/host.txt" && grep -qx 'loaded-exit=0' "$d/host.txt" || { echo "host: $d"; exit 1; }; grep -qx 'skill=33efcf3d10e73892' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -q '^pgrep=' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=" "$d/verify.txt" | grep -E ' git-broken=0 ' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && b=$(mktemp) && node evals/lean/compare.mjs --skill code-review --base-only > $b && cat $b && [ "$(grep -c ' base ok runs=10$' $b)" = 10 ] && node evals/lean/budget.mjs spent --skills code-review --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 0ba625abfa5ec016efda3e491fae679347f99ebf4594bef880d217609afdf433
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-code-review/task-01-code-review-helpers.md && n=0 && for d in evals/results/code-review/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(grep -v = "$d/host.txt" | sort -u | wc -l | tr -d ' ')" = 1 ] && grep -q '^run-exit=' "$d/host.txt" && grep -qx 'loaded-exit=0' "$d/host.txt" || { echo "host: $d"; exit 1; }; grep -qx 'skill=33efcf3d10e73892' "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -q '^pgrep=' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; grep -E "^$d runs=" "$d/verify.txt" | grep -E ' git-broken=0 ' | grep -qE ' disagreements=0$' || { echo "verify: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && b=$(mktemp) && node evals/lean/compare.mjs --skill code-review --base-only > $b && cat $b && [ "$(grep -c ' base ok runs=10$' $b)" = 10 ] && node evals/lean/budget.mjs spent --skills code-review --cap 120
cells=10
cell=chi-loi-nho-sonnet base ok runs=10
cell=chi-loi-nho-opus base ok runs=10
cell=giam-gia-sonnet base ok runs=10
cell=giam-gia-opus base ok runs=10
cell=khong-co-loi-sonnet base ok runs=10
cell=khong-co-loi-opus base ok runs=10
cell=sua-ho-sonnet base ok runs=10
cell=sua-ho-opus base ok runs=10
cell=thieu-tieu-chi-sonnet base ok runs=10
cell=thieu-tieu-chi-opus base ok runs=10
budget: spent=12.9862 cap=120
```

Second Receipt. The first was withdrawn: cells had runs that failed on the account session limit or a revoked OAuth token, and the Command did not count runs=10 lines; the Command now asserts them (Review log). Errored cells rerun into -lan1 with 0 errors (test: chap-chon-opus, thuong-do-opus; code-review: khong-co-loi-sonnet). Every cell now has 10 counted runs, loaded 10/10, per-cell skill digest of the base bytes, host 2.1.291. Deviations: active-feature.json set at task start, not per invocation (sibling lanes ran concurrently); sibling lanes sometimes made 3 concurrent sessions (user accepted).
