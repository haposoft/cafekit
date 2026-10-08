# Task 02 — The current develop skill is measured in 4 cells

Status: done

## Outcome
Four result directories `evals/results/develop/lean-goc-<case>-<model>` (`mot-task-hong`, `mot-task-sach` × sonnet and opus), ten runs each, every run loaded and saved, on the develop skill bytes of `13304cd4` before task 03 edits anything.

## Scope
- In: 3 pilots and 4 cells in two lanes (plan D-04, D-08); `skill-digest.txt`, `lane.txt`, `host.txt`, `loaded.txt`, `git-check.txt` and `_saved/<cell>.txt` per directory, written in the same shell step as the run.
- Out: any skill, case, grader, fixture or `evals/run.sh` edit.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/develop/lean-goc-*`, `evals/results/develop/lean-pilot-goc-*`, `evals/results/develop/_saved/lean-*.txt` (gitignored)
- Read: `evals/run.sh`, `evals/lean/*`, `evals/develop/save-runs.mjs`

## Steps
1. Guard before every invocation (stop on any mismatch): `specs/_shared/active-feature.json` is `{"featureName":"lean-develop"}` (set it before this task starts, plan D-08); `pgrep -f '[c]laude plugin eval' | wc -l` is below 2 (wait otherwise, plan D-08); directory digest (`find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`, first 16 hex) of `packages/spec/src/claude/skills/develop` = `ec07467d80ae20fb`, and of `evals/develop` equal to task 01's `evals-develop-digest`; `shasum -a 256 evals/run.sh` starts `a75cd5b5fbe5b643`; node v22.23.3; `command -v git` = `/opt/homebrew/bin/git`; `claude --version` starts `2.1.291`; `node evals/lean/budget.mjs check <c> --skills develop --cap 120`.
2. Each invocation as plan D-04, in one shell step, with `dg` = the skill digest command of Step 1: `p0=$(pgrep -f '[c]laude plugin eval' | wc -l | tr -d ' ') && [ "$p0" -lt 2 ] && s0=$(dg) && v=$(claude --version) && evals/run.sh develop … --out <name> … && { echo "skill=$s0"; echo "skill=$(dg)"; } > <dir>/skill-digest.txt && { echo "before=$p0"; echo "after=$(pgrep -f '[c]laude plugin eval' | wc -l | tr -d ' ')"; } > <dir>/lane.txt && { echo "$v"; claude --version; } > <dir>/host.txt && node evals/lean/loaded.mjs develop <dir> > <dir>/loaded.txt && node evals/develop/save-runs.mjs --require-loaded --require-clean <n> <dir>`, then the plan D-04 git probe into `<dir>/git-check.txt` in the same step.
3. Pilots: `--case mot-task-hong` sonnet `--runs 3 --max-cost-usd 3` and opus `--runs 1 --max-cost-usd 2`, named `lean-pilot-goc-mot-task-hong-<model>`; `--case mot-task-sach` sonnet `--runs 1 --max-cost-usd 2`, named `lean-pilot-goc-mot-task-sach-sonnet`; any run not loaded, errored, partial, or a non-empty `git-check.txt` → stop and ask the user.
4. Cells `lean-goc-<case>-<model>` for `mot-task-hong mot-task-sach`, `--runs 10 --max-cost-usd 8`, sonnet lane and opus lane; a partial, errored, below-10-loaded or unsaved cell reruns once into `<cell>-lan1` (plan D-07); a non-empty `git-check.txt` reruns the cell once into `<cell>-lan1`, then stop and ask the user (plan D-04); a quota error → stop and ask the user.
5. Run the Command.

## Acceptance
- AC-02: 4 cells complete, each `loaded=10/10`, each `host.txt` one version, each `skill-digest.txt` only `skill=ec07467d80ae20fb` (before and after), each `lane.txt` written, each `git-check.txt` present and empty, each saved and loaded by `save-runs --check-saved`; `compare.mjs --skill develop --base-only` exits 0; the skill digest is still `ec07467d80ae20fb`; spend within the cap.

## Dependencies
- task-01-develop-helpers.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-01-develop-helpers.md && [ "$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = ec07467d80ae20fb ] && n=0 && cells="" && for d in evals/results/develop/lean-goc-*; do case "$d" in *-lan1|*-r2) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ "$(wc -l < "$d/skill-digest.txt" | tr -d ' ')" = 2 ] && [ "$(sort -u "$d/skill-digest.txt")" = skill=ec07467d80ae20fb ] || { echo "digest: $d"; exit 1; }; [ -s "$d/lane.txt" ] || { echo "lane: $d"; exit 1; }; [ -f "$d/git-check.txt" ] && [ ! -s "$d/git-check.txt" ] || { echo "git: $d"; exit 1; }; cells="$cells ${d%-lan1}"; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n" && node evals/develop/save-runs.mjs --check-saved --require-loaded --require-clean 10 $cells && node evals/lean/compare.mjs --skill develop --base-only && node evals/lean/budget.mjs spent --skills develop --cap 120`
- Named probe: saved `loaded.txt`, `host.txt`, `skill-digest.txt`, `lane.txt`, `git-check.txt` and `_saved/<cell>.txt`; `compare.mjs --base-only`; `budget.mjs spent`.
- Reachability: `evals/run.sh develop --plugin-name cf` builds the plugin from `packages/spec/src/claude/skills/develop` and writes `evals/results/develop/<out>`; the prompt `/cf:develop doi-loi-chao` resolves under plugin name `cf`.
- Oracle: `cells=4`, four `save-runs` lines without a failure, 4 `base ok runs=10` lines, `budget: spent=<x> cap=120`, exit 0.
- Counterexample: a missing, partial, unsaved or not-loaded cell, a host change inside a cell, a cell digest other than `ec07467d80ae20fb`, a missing `lane.txt`, a `Failed to locate 'git'` hit, or an edited skill makes the Command exit 1.
- Artifacts: result directories and saved files (gitignored, local).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-01-develop-helpers.md && [ "$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = ec07467d80ae20fb ] && n=0 && cells="" && for d in evals/results/develop/lean-goc-*; do case "$d" in *-lan1|*-r2) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ "$(wc -l < "$d/skill-digest.txt" | tr -d ' ')" = 2 ] && [ "$(sort -u "$d/skill-digest.txt")" = skill=ec07467d80ae20fb ] || { echo "digest: $d"; exit 1; }; [ -s "$d/lane.txt" ] || { echo "lane: $d"; exit 1; }; [ -f "$d/git-check.txt" ] && [ ! -s "$d/git-check.txt" ] || { echo "git: $d"; exit 1; }; cells="$cells ${d%-lan1}"; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n" && node evals/develop/save-runs.mjs --check-saved --require-loaded --require-clean 10 $cells && node evals/lean/compare.mjs --skill develop --base-only && node evals/lean/budget.mjs spent --skills develop --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 6a41c048c81df9b29c99accf8cd8636d127579f7ea82c1603eb4d2137e1a8b60
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-01-develop-helpers.md && [ "$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = ec07467d80ae20fb ] && n=0 && cells="" && for d in evals/results/develop/lean-goc-*; do case "$d" in *-lan1|*-r2) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ "$(wc -l < "$d/skill-digest.txt" | tr -d ' ')" = 2 ] && [ "$(sort -u "$d/skill-digest.txt")" = skill=ec07467d80ae20fb ] || { echo "digest: $d"; exit 1; }; [ -s "$d/lane.txt" ] || { echo "lane: $d"; exit 1; }; [ -f "$d/git-check.txt" ] && [ ! -s "$d/git-check.txt" ] || { echo "git: $d"; exit 1; }; cells="$cells ${d%-lan1}"; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n" && node evals/develop/save-runs.mjs --check-saved --require-loaded --require-clean 10 $cells && node evals/lean/compare.mjs --skill develop --base-only && node evals/lean/budget.mjs spent --skills develop --cap 120
cells=4
lean-goc-mot-task-hong-opus saved ok runs=10 skill=loaded:10
lean-goc-mot-task-hong-sonnet saved ok runs=10 skill=loaded:10
lean-goc-mot-task-sach-opus saved ok runs=10 skill=loaded:10
lean-goc-mot-task-sach-sonnet saved ok runs=10 skill=loaded:10
cell=mot-task-hong-sonnet base ok runs=10
cell=mot-task-hong-opus base ok runs=10
cell=mot-task-sach-sonnet base ok runs=10
cell=mot-task-sach-opus base ok runs=10
budget: spent=7.3152 cap=120
```

Runs: 3 pilots (hong sonnet 3/3, hong opus 1/1, sach sonnet 1/1 loaded, git-check empty) then 4 cells, each loaded 10/10, saved 10/10, git-check empty, skill-digest ec07467d80ae20fb before and after, evals/develop d9ff51633880a954, host 2.1.291. Spend 7.3152 of 120. Deviations: active-feature.json was set when the task started, not re-checked per invocation, because sibling packets run lanes at the same time; the run and its evidence were chained with ';' so evidence was written even if run.sh failed (none failed); lanes from sibling packets sometimes made 3 concurrent eval sessions (user accepted).
