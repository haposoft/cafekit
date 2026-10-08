# Task 02 — The current sync skill is measured in 8 cells

Status: done

## Outcome
Eight result directories `evals/results/sync/lean-goc-<case>-<model>` (plan D-02's four cases × sonnet and opus), ten runs each, every run loaded on the cell's own model, none errored, every V verdict present and none `error`, the skill digest `1cab4e4dca9e4763` before and after each run, every kept run archived, on the sync skill bytes of `13304cd4` before task 03 edits anything.

## Scope
- In: 2 pilots and 8 cells in two lanes (plan D-03) under the machine-wide count of plan D-08; `exit.txt`, `lane.txt`, `skill-digest.txt`, `host.txt`, the kept archive, `verify-run.txt` and `skill-loaded.txt` per directory (plan D-07).
- Out: any skill, case, grader, fixture, shim or `evals/run.sh` edit.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/sync/lean-goc-*`, `evals/results/sync/lean-pilot-goc-*`, `evals/results/sync/kept/lean-goc-*`, `evals/results/sync/kept/lean-pilot-goc-*` (gitignored)
- Read: `evals/run.sh`, `evals/sync/verify-run.mjs`, `evals/sync/skill-loaded.mjs`, `evals/lean/*`

## Steps
0. Preflight per plan D-08: set `specs/_shared/active-feature.json` to `{"featureName":"lean-sync"}`.
1. Once: `w=$(mktemp -d)/fx && git worktree add --detach "$w" HEAD && (cd "$w" && bash evals/sync/check-fixtures.sh all); x=$?; git worktree remove --force "$w"; [ "$x" = 0 ]` (plan D-08: sibling packets write `specs/` concurrently, so the live tree is not used).
2. Guard before every invocation (stop on any mismatch): skill directory digest (plan Scope formula, `dg`) `1cab4e4dca9e4763`; `node evals/compare-sync.mjs --digest` = `69ac0da0da9bdfacdd9eb135f8fcb06f609c3405884fd90061e566ee591e288d`; `shasum -a 256 evals/run.sh` starts `a75cd5b5fbe5b643`; `node --version` v22.23.3; `node evals/lean/budget.mjs check <c> --skills sync --cap 120`; then wait (never stop anything) until `pgrep -f '[c]laude plugin eval' | wc -l | tr -d ' '` prints below 2. A quota error stops the task and asks the user.
3. Each invocation as plan D-03 and, in the same shell step, plan D-07 in its order: hold `pgrep` count, `claude --version` and skill digest before; `evals/run.sh …; x=$?`; then, whatever `x` is, write `exit.txt`, `lane.txt`, `skill-digest.txt` and `host.txt`; for each run `i` with a `tracePath`, `k=$(dirname "$(dirname "$tracePath")")`, `chmod -R u+rwX "$k"` and `cp -Rp "$k" evals/results/sync/kept/<name>/run-<i as two digits>`; only then `node evals/sync/verify-run.mjs <dir> > <dir>/verify-run.txt` (its first line is `instrument=<digest>`; do not echo it again) and `node evals/sync/skill-loaded.mjs <dir> > <dir>/skill-loaded.txt`.
4. Pilots (`--case rebind-verify-fails`): sonnet `--runs 3 --max-cost-usd 2`, opus `--runs 1 --max-cost-usd 1`, named `lean-pilot-goc-rebind-verify-fails-<model>`; any run not loaded on its model, errored or partial, any V `error`, or a skill digest other than `skill=1cab4e4dca9e4763` → stop and ask the user.
5. Cells `lean-goc-<case>-<model>` for `rebind-base-moved rebind-verify-fails bare-sync-gate-noise audit-handwritten-receipt`, `--runs 10`, `--max-cost-usd 3` (sonnet) or `6` (opus); a partial, errored, below-10-loaded or V-`error` cell reruns once into `<cell>-lan1` (plan D-06).
6. Run the Command.

## Acceptance
- AC-02: 8 cells complete, each `loaded=10/10 model=claude-<model>-5-5` for its own model, each `verify-run.txt` starting `instrument=69ac0da0da9bdfacdd9eb135f8fcb06f609c3405884fd90061e566ee591e288d` and ending `runs=10 disagreements=0` with no `error` verdict, each `skill-digest.txt` only `skill=1cab4e4dca9e4763`, each `lane.txt` `before=0` or `1`, each `host.txt` one version, each kept archive 10 runs; `compare.mjs --skill sync --base-only` prints 8 `base ok runs=10` lines (no errored run) and exits 0; spend within the cap.

## Dependencies
- task-01-sync-helpers.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-01-sync-helpers.md && n=0 && for d in evals/results/sync/lean-goc-*; do case "$d" in *-lan1) continue;; esac; m=${d##*-}; [ -d "$d-lan1" ] && d="$d-lan1"; b=$(basename "$d"); tail -1 "$d/skill-loaded.txt" | grep -qE " loaded=[0-9]+/10 model=claude-${m}-5-5$" || { echo "not loaded: $d"; exit 1; }; head -1 "$d/verify-run.txt" | grep -qx 'instrument=69ac0da0da9bdfacdd9eb135f8fcb06f609c3405884fd90061e566ee591e288d' || { echo "instrument: $d"; exit 1; }; grep -q ' runs=10 disagreements=0$' "$d/verify-run.txt" && ! grep -q 'verdict=error' "$d/verify-run.txt" || { echo "verify: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'skill=1cab4e4dca9e4763' "$d/skill-digest.txt" && [ "$(sort -u "$d/skill-digest.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "digest: $d"; exit 1; }; grep -qE '^before=[01] after=[0-9]+$' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; [ "$(ls -d evals/results/sync/kept/$b/run-* 2>/dev/null | wc -l | tr -d ' ')" = 10 ] || { echo "kept: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill sync --base-only | tee $t/b && [ "$(grep -c ' base ok runs=10$' $t/b)" = 8 ] && echo "base-ok=8" && node evals/lean/budget.mjs spent --skills sync --cap 120`
- Named probe: saved `skill-loaded.txt` (with model), `verify-run.txt` (with `instrument=`), `host.txt`, `skill-digest.txt`, `lane.txt`; the kept archive; `compare.mjs --base-only`; `budget.mjs spent`.
- Reachability: `evals/run.sh sync` builds the plugin from `packages/spec/src/claude/skills/sync` and writes `evals/results/sync/<out>`.
- Oracle: `cells=8`, 8 `base ok runs=10` lines, `base-ok=8`, `budget: spent=<x> cap=120`, exit 0.
- Counterexample: a missing, partial, not-loaded, wrong-model, errored or V-`error` cell, a different instrument or skill digest, a missing `lane.txt` or one started at 2+ concurrent sessions, a host change inside a cell, or a cell without its ten archived runs makes the Command exit 1. Before the run it exits 1 at the task-01 `Status: done` check.
- Artifacts: result directories and kept archives (gitignored, local).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-01-sync-helpers.md && n=0 && for d in evals/results/sync/lean-goc-*; do case "$d" in *-lan1) continue;; esac; m=${d##*-}; [ -d "$d-lan1" ] && d="$d-lan1"; b=$(basename "$d"); tail -1 "$d/skill-loaded.txt" | grep -qE " loaded=[0-9]+/10 model=claude-${m}-5-5$" || { echo "not loaded: $d"; exit 1; }; head -1 "$d/verify-run.txt" | grep -qx 'instrument=69ac0da0da9bdfacdd9eb135f8fcb06f609c3405884fd90061e566ee591e288d' || { echo "instrument: $d"; exit 1; }; grep -q ' runs=10 disagreements=0$' "$d/verify-run.txt" && ! grep -q 'verdict=error' "$d/verify-run.txt" || { echo "verify: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'skill=1cab4e4dca9e4763' "$d/skill-digest.txt" && [ "$(sort -u "$d/skill-digest.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "digest: $d"; exit 1; }; grep -qE '^before=[01] after=[0-9]+$' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; [ "$(ls -d evals/results/sync/kept/$b/run-* 2>/dev/null | wc -l | tr -d ' ')" = 10 ] || { echo "kept: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill sync --base-only | tee $t/b && [ "$(grep -c ' base ok runs=10$' $t/b)" = 8 ] && echo "base-ok=8" && node evals/lean/budget.mjs spent --skills sync --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 319d36d84c51bf017f6f91a09623918bd3f02fbb4e44fa8d10a759c45b2a0da1
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-01-sync-helpers.md && n=0 && for d in evals/results/sync/lean-goc-*; do case "$d" in *-lan1) continue;; esac; m=${d##*-}; [ -d "$d-lan1" ] && d="$d-lan1"; b=$(basename "$d"); tail -1 "$d/skill-loaded.txt" | grep -qE " loaded=[0-9]+/10 model=claude-${m}-5-5$" || { echo "not loaded: $d"; exit 1; }; head -1 "$d/verify-run.txt" | grep -qx 'instrument=69ac0da0da9bdfacdd9eb135f8fcb06f609c3405884fd90061e566ee591e288d' || { echo "instrument: $d"; exit 1; }; grep -q ' runs=10 disagreements=0$' "$d/verify-run.txt" && ! grep -q 'verdict=error' "$d/verify-run.txt" || { echo "verify: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; grep -qx 'skill=1cab4e4dca9e4763' "$d/skill-digest.txt" && [ "$(sort -u "$d/skill-digest.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "digest: $d"; exit 1; }; grep -qE '^before=[01] after=[0-9]+$' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; [ "$(ls -d evals/results/sync/kept/$b/run-* 2>/dev/null | wc -l | tr -d ' ')" = 10 ] || { echo "kept: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill sync --base-only | tee $t/b && [ "$(grep -c ' base ok runs=10$' $t/b)" = 8 ] && echo "base-ok=8" && node evals/lean/budget.mjs spent --skills sync --cap 120
cells=8
cell=audit-handwritten-receipt-sonnet base ok runs=10
cell=audit-handwritten-receipt-opus base ok runs=10
cell=bare-sync-gate-noise-sonnet base ok runs=10
cell=bare-sync-gate-noise-opus base ok runs=10
cell=rebind-base-moved-sonnet base ok runs=10
cell=rebind-base-moved-opus base ok runs=10
cell=rebind-verify-fails-sonnet base ok runs=10
cell=rebind-verify-fails-opus base ok runs=10
base-ok=8
budget: spent=15.0591 cap=120
```

check-fixtures.sh all passed in a temporary clean worktree. Pilots: sonnet 3/3, opus 1/1 loaded, no V error. Cells loaded per the user's decision (compare over every run): audit-handwritten-receipt opus -lan1 10/10 (the first cell lost 5 runs to the account session limit), sonnet 10/10; bare-sync-gate-noise sonnet 8/10, opus 10/10; rebind-base-moved 10/10 both; rebind-verify-fails sonnet -lan1 8/10 (first 7/10), opus 10/10. Every cell 10 counted runs, no V error, disagreements 0, skill=1cab4e4dca9e4763. Deviation: active-feature.json set at task start, not per invocation (sibling lanes ran concurrently).
