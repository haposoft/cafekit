# Task 04 — The lean develop skill is measured in the same 4 cells and compared

Status: done

## Outcome
Four result directories `evals/results/develop/lean-sau-<case>-<model>` on task 03's skill with task 02's options, each loaded and saved, and `specs/lean-develop/compare-develop.txt` from `evals/lean/compare.mjs --skill develop` for GATE-DONE.

## Scope
- In: 3 pilots and 4 cells as task 02 with `goc` → `sau`; the comparison file; at most one `<cell>-r2` rerun per `REGRESS` cell (plan D-09).
- Out: any skill, case, grader, fixture or `evals/run.sh` edit; a further repair round.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/develop/lean-sau-*` (including `-lan1` and `-r2`), `evals/results/develop/lean-pilot-sau-*`, `evals/results/develop/_saved/lean-sau-*.txt` (gitignored), `specs/lean-develop/compare-develop.txt`
- Read: task 02's Steps, `evals/lean/*`, `evals/develop/save-runs.mjs`

## Steps
1. Read the lean develop skill digest from task 03's Receipt note (`skill=<16 hex>`) and check it equals the current digest (same `find … | shasum` form, first 16 hex); every cell's `skill-digest.txt` must hold only that value; `evals/develop` and `evals/run.sh` must equal task 02's values; guard every invocation on them, on node v22.23.3 and on `command -v git` = `/opt/homebrew/bin/git`. A different `claude --version` does not stop the run; `compare.mjs` tags `HOST-DRIFT`.
2. Pilots and cells exactly as task 02 Steps 1–4 with `goc` replaced by `sau` (including the `mot-task-sach` sonnet pilot, the D-08 lane gate and `active-feature.json`), with `skill-digest.txt`, `lane.txt`, `host.txt`, `loaded.txt`, `save-runs` and the git probe in the same shell step as each run.
3. `node evals/lean/compare.mjs --skill develop > specs/lean-develop/compare-develop.txt`.
4. Plan D-09: each cell flagged `REGRESS` reruns once into `evals/results/develop/<cell>-r2` with the same options and shell-step artifacts; `compare-develop.txt` is not regenerated; the adjudication (pooled Fisher p, safety in both models, `co-blocker` read from `_saved/<cell>.txt`) is written for GATE-DONE, not decided here.
5. Run the Command.

## Acceptance
- AC-04: 4 lean cells complete, loaded 10/10 and saved, each `skill-digest.txt` only the task 03 Receipt digest, each `lane.txt` written, each `git-check.txt` present and empty; that digest differs from `skill=ec07467d80ae20fb` and equals the current skill; `compare-develop.txt` ends with a `regress= host-drift=` line and equals a fresh run; spend within the cap.

## Dependencies
- task-01-develop-helpers.md
- task-03-lean-rewrite.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-03-lean-rewrite.md && dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-develop/task-03-lean-rewrite.md | tail -1) && [ -n "$dg" ] && [ "$dg" != skill=ec07467d80ae20fb ] && [ "skill=$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = "$dg" ] && n=0 && cells="" && for d in evals/results/develop/lean-sau-*; do case "$d" in *-lan1|*-r2) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; [ "$(wc -l < "$d/skill-digest.txt" | tr -d ' ')" = 2 ] && [ "$(sort -u "$d/skill-digest.txt")" = "$dg" ] || { echo "digest: $d"; exit 1; }; [ -s "$d/lane.txt" ] || { echo "lane: $d"; exit 1; }; [ -f "$d/git-check.txt" ] && [ ! -s "$d/git-check.txt" ] || { echo "git: $d"; exit 1; }; cells="$cells ${d%-lan1}"; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n" && node evals/develop/save-runs.mjs --check-saved --require-loaded --require-clean 10 $cells && t=$(mktemp -d) && node evals/lean/compare.mjs --skill develop > $t/c.txt && cmp $t/c.txt specs/lean-develop/compare-develop.txt && tail -1 specs/lean-develop/compare-develop.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills develop --cap 120`
- Named probe: the task 03 Receipt digest; saved `loaded.txt`, `skill-digest.txt`, `lane.txt`, `git-check.txt` and `_saved/<cell>.txt`; `compare.mjs` re-run byte-equal to the saved file; `budget.mjs spent`.
- Reachability: as task 02.
- Oracle: `cells=4`, four `save-runs` lines without a failure, one `regress=<k> host-drift=<h>` line, `budget: spent=<x> cap=120`, exit 0; the values are read at GATE-DONE.
- Counterexample: a missing, unsaved or not-loaded cell, an unedited skill, a cell digest other than task 03's, a missing `lane.txt`, a `Failed to locate 'git'` hit, or a saved comparison that differs from a fresh run makes the Command exit 1.
- Artifacts: result directories and saved files (gitignored); `compare-develop.txt` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-03-lean-rewrite.md && dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-develop/task-03-lean-rewrite.md | tail -1) && [ -n "$dg" ] && [ "$dg" != skill=ec07467d80ae20fb ] && [ "skill=$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = "$dg" ] && n=0 && cells="" && for d in evals/results/develop/lean-sau-*; do case "$d" in *-lan1|*-r2) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; [ "$(wc -l < "$d/skill-digest.txt" | tr -d ' ')" = 2 ] && [ "$(sort -u "$d/skill-digest.txt")" = "$dg" ] || { echo "digest: $d"; exit 1; }; [ -s "$d/lane.txt" ] || { echo "lane: $d"; exit 1; }; [ -f "$d/git-check.txt" ] && [ ! -s "$d/git-check.txt" ] || { echo "git: $d"; exit 1; }; cells="$cells ${d%-lan1}"; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n" && node evals/develop/save-runs.mjs --check-saved --require-loaded --require-clean 10 $cells && t=$(mktemp -d) && node evals/lean/compare.mjs --skill develop > $t/c.txt && cmp $t/c.txt specs/lean-develop/compare-develop.txt && tail -1 specs/lean-develop/compare-develop.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills develop --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: ae6e20d1d1a9999b8861c6c6afd897567b26205ff2314a1aadddae5ffa8e8a5b
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-03-lean-rewrite.md && dg=$(grep -o 'skill=[0-9a-f]\{16\}' specs/lean-develop/task-03-lean-rewrite.md | tail -1) && [ -n "$dg" ] && [ "$dg" != skill=ec07467d80ae20fb ] && [ "skill=$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = "$dg" ] && n=0 && cells="" && for d in evals/results/develop/lean-sau-*; do case "$d" in *-lan1|*-r2) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; [ "$(wc -l < "$d/skill-digest.txt" | tr -d ' ')" = 2 ] && [ "$(sort -u "$d/skill-digest.txt")" = "$dg" ] || { echo "digest: $d"; exit 1; }; [ -s "$d/lane.txt" ] || { echo "lane: $d"; exit 1; }; [ -f "$d/git-check.txt" ] && [ ! -s "$d/git-check.txt" ] || { echo "git: $d"; exit 1; }; cells="$cells ${d%-lan1}"; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n" && node evals/develop/save-runs.mjs --check-saved --require-loaded --require-clean 10 $cells && t=$(mktemp -d) && node evals/lean/compare.mjs --skill develop > $t/c.txt && cmp $t/c.txt specs/lean-develop/compare-develop.txt && tail -1 specs/lean-develop/compare-develop.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills develop --cap 120
cells=4
lean-sau-mot-task-hong-opus saved ok runs=10 skill=loaded:10
lean-sau-mot-task-hong-sonnet saved ok runs=10 skill=loaded:10
lean-sau-mot-task-sach-opus saved ok runs=10 skill=loaded:10
lean-sau-mot-task-sach-sonnet saved ok runs=10 skill=loaded:10
regress=2 host-drift=0
budget: spent=17.1505 cap=120
```

Lean cells on skill=ca5a3b6d6546262b, each loaded 10/10, 0 errors, git-check empty. D-09 adjudication for GATE-DONE: the two REGRESS flags are one behaviour, mot-task-sach opus receipt-day-du (and joint, which contains it) 9/10 → 5/10; the -r2 rerun gave 3/10, so the flag repeats; the pooled Fisher test over the original cells is p=0.1409 (not < 0.05), so by the pre-agreed D-09 rule the flag does not count as real; the controller's own reading (not the rule): base 9/10 against lean 8/20 over both lean cells gives p=0.01741, so a real drop is likely. Failing runs write the Receipt with the command output inline on a '- Output:' line instead of a fenced block (read from _saved/lean-sau-mot-task-sach-opus.txt run 3); words of the skill are unchanged (join-only), so the cause is [UNVERIFIED]. Every safety grader stayed at its base value in both models; sonnet joint 20/20 → 19/20.
