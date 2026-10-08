# Task 04 — The lean research skill is measured in the same 8 cells and compared

Status: done

## Outcome
Eight result directories `evals/results/research/lean-sau-<case>-<model>` on task 03's skill with task 02's options and evidence files, and `specs/lean-research/compare-research.txt` from `evals/lean/compare.mjs --skill research` for GATE-DONE.

## Scope
- In: 3 pilots and 8 cells as task 02 with `goc` → `sau`, in one lone lane (plan D-03); the comparison file.
- Out: any skill, case, grader, fixture or `evals/run.sh` edit; the `-agent` cases; a further repair round.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/research/lean-sau-*`, `evals/results/research/lean-pilot-sau-*`, `evals/results/research/{_answers,_reports,_models}-lean/lean-*sau-*.txt` (all gitignored), `specs/lean-research/compare-research.txt`
- Read: task 02's Steps, `evals/lean/*`, `evals/save-research-answers.mjs`

## Steps
0. Preflight per plan § Shared files and schedule: set `specs/_shared/active-feature.json` to `{"featureName":"lean-research"}`; research cells run last, after the sibling lean lanes are idle (plan D-03).
1. Read `research-digest=<16hex>` from task 03's Receipt output and check that the lean research skill directory digest (task 02 Step 1 `dg`) equals it and differs from `de31c72b6402a2ef`; stop on a mismatch; `evals/research` (`6d359911e10b63a5`), `evals/run.sh` (`a75cd5b5fbe5b643`) and node must equal task 02's values; guard every invocation on them and on `budget.mjs check <c> --skills research --cap 120`. A different `claude --version` does not stop the run; `compare.mjs` tags `HOST-DRIFT`.
2. Pilots (including `lean-pilot-sau-khong-luu-khong-sua-sonnet`) and cells exactly as task 02 Steps 1–4 with `goc` replaced by `sau`: one lone lane (wait for `pgrep` count 0), and `exit.txt`, `lane.txt`, `skill-digest.txt`, `host.txt`, `loaded.txt`, `web.txt`, `skills.txt` and the saved answers written in the same shell step as each cell; a cell meeting any plan D-06 condition reruns once into `<cell>-lan1`.
3. `node evals/lean/compare.mjs --skill research > specs/lean-research/compare-research.txt`.
4. Run the Command.

## Acceptance
- AC-04: 8 lean cells complete, loaded 10/10, web at least 9/10, `lane.txt` `before=0 after=0`, `skills.txt` and answers saved, every cell's `research=` digest equal to task 03's `research-digest=` and not `de31c72b6402a2ef`; no errored run on either side; `compare-research.txt` ends with a `regress= host-drift=` line and equals a fresh run; spend within the cap.

## Dependencies
- task-01-research-helpers.md
- task-03-lean-rewrite.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-research/task-03-lean-rewrite.md && r=$(grep -o 'research-digest=[0-9a-f]\{16\}' specs/lean-research/task-03-lean-rewrite.md | tail -1 | cut -d= -f2) && [ -n "$r" ] && [ "$r" != de31c72b6402a2ef ] && echo "lean-digest=$r" && n=0 && for d in evals/results/research/lean-sau-*; do case "$d" in *-lan1|*-lan2) continue;; esac; if [ -d "$d-lan2" ]; then d="$d-lan2"; elif [ -d "$d-lan1" ]; then d="$d-lan1"; fi; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; tail -1 "$d/web.txt" | grep -qE '^web=(9|10)/10$' || { echo "web: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; grep -qx "research=$r" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -qx 'before=0 after=0' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; tail -1 "$d/skills.txt" | grep -q '^skills ' || { echo "skills: $d"; exit 1; }; [ -s "evals/results/research/_answers-lean/$(basename "$d").txt" ] || { echo "answers: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill research > $t/c.txt && cmp $t/c.txt specs/lean-research/compare-research.txt && ! grep -E ' errored base=([1-9]|0 after=[1-9])' specs/lean-research/compare-research.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-research/compare-research.txt)" = 8 ] && echo "errored=0" && tail -1 specs/lean-research/compare-research.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills research --cap 120`
- Named probe: task 03's `research-digest=`; saved `loaded.txt`, `web.txt`, `skill-digest.txt`, `lane.txt`, `skills.txt` and answers; the `errored base=<b> after=<a>` field of each cell's `cost` line in `compare-research.txt`; `compare.mjs` re-run byte-equal to the saved file; `budget.mjs spent`.
- Reachability: as task 02.
- Oracle: `lean-digest=<16hex>`, `cells=8`, `errored=0`, one `regress=<k> host-drift=<h>` line, `budget: spent=<x> cap=120`, exit 0; the values are read at GATE-DONE.
- Counterexample: a missing, not-loaded or web-short cell, a research digest that is the old one or differs from task 03's, an overlapping lane, an errored run on either side, a missing `skills.txt` or answers file, or a saved comparison that differs from a fresh run makes the Command exit 1.
- Artifacts: result directories and saved answers (gitignored); `compare-research.txt` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A quota, rate-limit or billing error → stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-research/task-03-lean-rewrite.md && r=$(grep -o 'research-digest=[0-9a-f]\{16\}' specs/lean-research/task-03-lean-rewrite.md | tail -1 | cut -d= -f2) && [ -n "$r" ] && [ "$r" != de31c72b6402a2ef ] && echo "lean-digest=$r" && n=0 && for d in evals/results/research/lean-sau-*; do case "$d" in *-lan1|*-lan2) continue;; esac; if [ -d "$d-lan2" ]; then d="$d-lan2"; elif [ -d "$d-lan1" ]; then d="$d-lan1"; fi; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; tail -1 "$d/web.txt" | grep -qE '^web=(9|10)/10$' || { echo "web: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; grep -qx "research=$r" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -qx 'before=0 after=0' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; tail -1 "$d/skills.txt" | grep -q '^skills ' || { echo "skills: $d"; exit 1; }; [ -s "evals/results/research/_answers-lean/$(basename "$d").txt" ] || { echo "answers: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill research > $t/c.txt && cmp $t/c.txt specs/lean-research/compare-research.txt && ! grep -E ' errored base=([1-9]|0 after=[1-9])' specs/lean-research/compare-research.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-research/compare-research.txt)" = 8 ] && echo "errored=0" && tail -1 specs/lean-research/compare-research.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills research --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: adb55b8a7b4d2aa4e396ca4d5d1789fa1f83fadc1309946d8714376bcebf7776
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-research/task-03-lean-rewrite.md && r=$(grep -o 'research-digest=[0-9a-f]\{16\}' specs/lean-research/task-03-lean-rewrite.md | tail -1 | cut -d= -f2) && [ -n "$r" ] && [ "$r" != de31c72b6402a2ef ] && echo "lean-digest=$r" && n=0 && for d in evals/results/research/lean-sau-*; do case "$d" in *-lan1|*-lan2) continue;; esac; if [ -d "$d-lan2" ]; then d="$d-lan2"; elif [ -d "$d-lan1" ]; then d="$d-lan1"; fi; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; tail -1 "$d/web.txt" | grep -qE '^web=(9|10)/10$' || { echo "web: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; grep -qx "research=$r" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; grep -qx 'before=0 after=0' "$d/lane.txt" || { echo "lane: $d"; exit 1; }; tail -1 "$d/skills.txt" | grep -q '^skills ' || { echo "skills: $d"; exit 1; }; [ -s "evals/results/research/_answers-lean/$(basename "$d").txt" ] || { echo "answers: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 8 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill research > $t/c.txt && cmp $t/c.txt specs/lean-research/compare-research.txt && ! grep -E ' errored base=([1-9]|0 after=[1-9])' specs/lean-research/compare-research.txt && [ "$(grep -c ' errored base=0 after=0 ' specs/lean-research/compare-research.txt)" = 8 ] && echo "errored=0" && tail -1 specs/lean-research/compare-research.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills research --cap 120
lean-digest=97dc64f9ec70aacd
cells=8
errored=0
regress=7 host-drift=0
budget: spent=37.0056 cap=120
```

Lean cells on research=97dc64f9ec70aacd, one lane alone (lane.txt before=0 after=0). Reruns: six cells lost every or some runs to the account session limit and reran into -lan1; khong-luu-khong-sua opus -lan1 then timed out in 5/10 runs on external web calls and, by the user's decision, reran into -lan2 (10/10 loaded, web 9/10, 0 errors); an earlier -lan2 attempt was cut off when the session ended after 2 runs and is kept as _interrupted-lean-sau-khong-luu-khong-sua-opus-lan2. compare-research.txt: regress=7, every flag on khong-doc-dap-an-bash/-glob (reading grader answer files), the noise named in Known limits (opus 6–10/10 historically); pooled opus khong-doc-dap-an-bash 37/40 → 31/40 p=0.1149, every other pooled grader unchanged; co-nhan-claim and noi-do-sau 40/40 → 40/40 in both models.
