# Task 04 — The joined sync skill is measured in the same 8 cells and compared

Status: done

## Outcome
Eight result directories `evals/results/sync/lean-sau-<case>-<model>` on task 03's skill with task 02's options and evidence, and `specs/lean-sync/compare-sync.txt` from `evals/lean/compare.mjs --skill sync` for GATE-DONE.

## Scope
- In: 2 pilots and 8 cells as task 02 with `goc` → `sau`; the comparison file.
- Out: any skill, case, grader, fixture, shim or `evals/run.sh` edit; a further repair round.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/sync/lean-sau-*`, `evals/results/sync/lean-pilot-sau-*`, `evals/results/sync/kept/lean-sau-*`, `evals/results/sync/kept/lean-pilot-sau-*` (gitignored), `specs/lean-sync/compare-sync.txt`
- Read: task 02's Steps, `evals/lean/*`

## Steps
0. Preflight per plan D-08: set `specs/_shared/active-feature.json` to `{"featureName":"lean-sync"}`.
1. Read `sync-digest=<16hex>` from task 03's Receipt output and check that the joined skill directory digest (`dg`, plan Scope) equals it and differs from `1cab4e4dca9e4763`; stop on a mismatch; `node evals/compare-sync.mjs --digest`, `evals/run.sh` and node must equal task 02's values; guard every invocation on them, on `budget.mjs check <c> --skills sync --cap 120`, and wait until `pgrep -f '[c]laude plugin eval' | wc -l | tr -d ' '` prints below 2. A different `claude --version` does not stop the run; `compare.mjs` tags `HOST-DRIFT`. A quota error stops the task and asks the user.
2. Pilots and cells exactly as task 02 Steps 2–5 with `goc` replaced by `sau` and the skill digest `sync-digest` in place of `1cab4e4dca9e4763`: `exit.txt`, `lane.txt`, `skill-digest.txt`, `host.txt`, the kept archive, then `verify-run.txt` and `skill-loaded.txt`, in the same shell step as each cell (plan D-07).
3. `node evals/lean/compare.mjs --skill sync > specs/lean-sync/compare-sync.txt`.
4. Run the Command.

## Acceptance
- AC-04: 8 joined cells complete with the task 02 evidence checks, each `skill-digest.txt` only `skill=<task 03 sync-digest>`; `compare-sync.txt` has 8 `errored base=0 after=0` cost lines, ends with a `regress= host-drift=` line and equals a fresh run; spend within the cap.

## Dependencies
- task-01-sync-helpers.md
- task-03-join-lines.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-03-join-lines.md && r=$(grep -o 'sync-digest=[0-9a-f]\{16\}' specs/lean-sync/task-03-join-lines.md | tail -1 | cut -d= -f2) && [ -n "$r" ] && [ "$r" != 1cab4e4dca9e4763 ] && echo "lean-digest=$r" && n=0 && for d in evals/results/sync/lean-sau-*; do case "$d" in *-lan1) continue;; esac; m=${d##*-}; [ -d "$d-lan1" ] && d="$d-lan1"; b=$(basename "$d"); tail -1 "$d/skill-loaded.txt" | grep -qE " loaded=[0-9]+/10 model=claude-${m}-5-5$" || { echo "not loaded: $d"; exit 1; }; head -1 "$d/verify-run.txt" | grep -qx 'instrument=69ac0da0da9bdfacdd9eb135f8fcb06f609c3405884fd90061e566ee591e288d' || { echo "instrument: $d"; exit 1; }; grep -q ' runs=10 disagreements=0$' "$d/verify-run.txt" && ! grep -q 'verdict=error' "$d/verify-run.txt" || { echo "verify: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; grep -qx "skill=$r" "$d/skill-digest.txt" && [ "$(sort -u "$d/skill-digest.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "digest: $d"; exit 1; }; grep -qE '^before=[01] after=[0-9]+$' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; [ "$(ls -d evals/results/sync/kept/$b/run-* 2>/dev/null | wc -l | tr -d ' ')" = 10 ] || { echo "kept: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill sync > $t/c.txt && cmp $t/c.txt specs/lean-sync/compare-sync.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-sync/compare-sync.txt)" = 8 ] && echo "errored=0" && tail -1 specs/lean-sync/compare-sync.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills sync --cap 120`
- Named probe: task 03's `sync-digest=`; saved `skill-loaded.txt` (with model), `verify-run.txt` (with `instrument=`), `host.txt`, `skill-digest.txt`, `lane.txt`; the kept archive; `compare.mjs` re-run byte-equal to the saved file; `budget.mjs spent`.
- Reachability: as task 02.
- Oracle: `lean-digest=<16hex>`, `cells=8`, `errored=0`, one `regress=<k> host-drift=<h>` line, `budget: spent=<x> cap=120`, exit 0; the values are read at GATE-DONE.
- Counterexample: a missing, not-loaded, wrong-model or V-`error` cell, a cell on a digest other than task 03's, a missing `lane.txt`, a missing archive, an errored run on either side, or a saved comparison that differs from a fresh run makes the Command exit 1. Before the run it exits 1 at the task-03 `Status: done` check.
- Artifacts: result directories and kept archives (gitignored); `compare-sync.txt` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-03-join-lines.md && r=$(grep -o 'sync-digest=[0-9a-f]\{16\}' specs/lean-sync/task-03-join-lines.md | tail -1 | cut -d= -f2) && [ -n "$r" ] && [ "$r" != 1cab4e4dca9e4763 ] && echo "lean-digest=$r" && n=0 && for d in evals/results/sync/lean-sau-*; do case "$d" in *-lan1) continue;; esac; m=${d##*-}; [ -d "$d-lan1" ] && d="$d-lan1"; b=$(basename "$d"); tail -1 "$d/skill-loaded.txt" | grep -qE " loaded=[0-9]+/10 model=claude-${m}-5-5$" || { echo "not loaded: $d"; exit 1; }; head -1 "$d/verify-run.txt" | grep -qx 'instrument=69ac0da0da9bdfacdd9eb135f8fcb06f609c3405884fd90061e566ee591e288d' || { echo "instrument: $d"; exit 1; }; grep -q ' runs=10 disagreements=0$' "$d/verify-run.txt" && ! grep -q 'verdict=error' "$d/verify-run.txt" || { echo "verify: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; grep -qx "skill=$r" "$d/skill-digest.txt" && [ "$(sort -u "$d/skill-digest.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "digest: $d"; exit 1; }; grep -qE '^before=[01] after=[0-9]+$' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; [ "$(ls -d evals/results/sync/kept/$b/run-* 2>/dev/null | wc -l | tr -d ' ')" = 10 ] || { echo "kept: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill sync > $t/c.txt && cmp $t/c.txt specs/lean-sync/compare-sync.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-sync/compare-sync.txt)" = 8 ] && echo "errored=0" && tail -1 specs/lean-sync/compare-sync.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills sync --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: e1e86cebb3e7e402b7142325f4500fe98ee92ba9a080e88e577d20c714e45e38
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && grep -q '^Status: done' specs/lean-sync/task-03-join-lines.md && r=$(grep -o 'sync-digest=[0-9a-f]\{16\}' specs/lean-sync/task-03-join-lines.md | tail -1 | cut -d= -f2) && [ -n "$r" ] && [ "$r" != 1cab4e4dca9e4763 ] && echo "lean-digest=$r" && n=0 && for d in evals/results/sync/lean-sau-*; do case "$d" in *-lan1) continue;; esac; m=${d##*-}; [ -d "$d-lan1" ] && d="$d-lan1"; b=$(basename "$d"); tail -1 "$d/skill-loaded.txt" | grep -qE " loaded=[0-9]+/10 model=claude-${m}-5-5$" || { echo "not loaded: $d"; exit 1; }; head -1 "$d/verify-run.txt" | grep -qx 'instrument=69ac0da0da9bdfacdd9eb135f8fcb06f609c3405884fd90061e566ee591e288d' || { echo "instrument: $d"; exit 1; }; grep -q ' runs=10 disagreements=0$' "$d/verify-run.txt" && ! grep -q 'verdict=error' "$d/verify-run.txt" || { echo "verify: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; grep -qx "skill=$r" "$d/skill-digest.txt" && [ "$(sort -u "$d/skill-digest.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "digest: $d"; exit 1; }; grep -qE '^before=[01] after=[0-9]+$' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; [ "$(ls -d evals/results/sync/kept/$b/run-* 2>/dev/null | wc -l | tr -d ' ')" = 10 ] || { echo "kept: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill sync > $t/c.txt && cmp $t/c.txt specs/lean-sync/compare-sync.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-sync/compare-sync.txt)" = 8 ] && echo "errored=0" && tail -1 specs/lean-sync/compare-sync.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills sync --cap 120
lean-digest=72c437df1ea657c6
cells=8
errored=0
regress=0 host-drift=0
budget: spent=28.0188 cap=120
```

Lean cells on sync-digest=72c437df1ea657c6, 0 errored runs, V disagreements 0, pilots sonnet 3/3 opus 1/1 loaded. regress=0. Loading per cell (user decision: compare over every run; base → lean): rebind-base-moved sonnet 10/10 → 5/10, opus 10 → 10; rebind-verify-fails sonnet 8/10 (-lan1) → 8/10, opus 10 → 10; bare-sync-gate-noise sonnet 8 → 8, opus 10 → 9; audit-handwritten-receipt sonnet 10 → 10, opus 10 (-lan1) → 10. The skill description (frontmatter) is byte-identical, so the rebind-base-moved sonnet loading drop is not explained by the rewrite [UNVERIFIED cause]; named for GATE-DONE.
