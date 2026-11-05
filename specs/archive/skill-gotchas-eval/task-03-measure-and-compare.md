# Task 03 — Measure both sides and compare

Status: done

## Outcome
Both new cases are measured on `claude-sonnet-5-5` and `claude-opus-5-5`, without Gotchas (worktree at `7ed6b1fa`) and with them (working tree), and `specs/skill-gotchas-eval/compare-develop.txt` and `compare-sync.txt` hold the per-cell and pooled comparison, read by plan D-10, within the $30 cap.

## Scope
- In: the pilots of plan D-09 and the 8 cells of plan D-06 to D-08; the two comparison files.
- Out: any edit to cases, graders, helpers or skill source; reruns beyond plan D-08.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/develop/lean-gk-*`, `evals/results/sync/lean-gk-*`, `evals/results/{develop,sync}/kept/lean-gk-*`, `specs/skill-gotchas-eval/compare-develop.txt`, `specs/skill-gotchas-eval/compare-sync.txt`
- Read: `plan.md` D-01, D-06 to D-10

## Steps
1. Create the before worktree per plan D-01 and check `dg` of its two skill directories equals the Scope before digests, and of the live tree equals the after digests; run `evals/run.sh <skill> --plugin-name cf --allow-tools Write Edit Bash --validate --case <case>` from each tree and require no `not granted` line.
2. Pilots per plan D-09, each recorded per plan D-07 and, on the before side, copied back per plan D-01. A pilot failure or a before-side ceiling stops the task and asks the user.
3. The 8 cells, one invocation at a time, each gated from the live root by `node evals/lean/budget.mjs check <next> --skills develop,sync --cap 30` and the process count of plan D-07, recorded per plan D-07, before cells copied back and `diff -r`-checked before the next cell, rerun once per plan D-08 when needed. After every before cell has passed its check, `git worktree remove --force <wt>`.
4. Write the two comparison files with the Verification Plan Command's two `compare.mjs` invocations (each `> specs/skill-gotchas-eval/compare-<skill>.txt`, under `set -o pipefail`, exit 0 required), then run the Command → exit 0.

## Acceptance
- AC-03 as stated in `plan.md`.

## Dependencies
- task-01-develop-command-case.md
- task-02-sync-tick-case.md

## Verification Plan
- Command: `bash -o pipefail -c 't=$(mktemp -d) && node evals/lean/compare.mjs --skill develop --base lean-gk-truoc- --after lean-gk-sau- --cells lenh-tien-quyet-sonnet,lenh-tien-quyet-opus > $t/d && cmp $t/d specs/skill-gotchas-eval/compare-develop.txt && node evals/lean/compare.mjs --skill sync --base lean-gk-truoc- --after lean-gk-sau- --cells sua-task-done-sonnet,sua-task-done-opus > $t/s && cmp $t/s specs/skill-gotchas-eval/compare-sync.txt && [ "$(grep -c "errored base=0 after=0" $t/d)" = 2 ] && [ "$(grep -c "errored base=0 after=0" $t/s)" = 2 ] && node evals/lean/budget.mjs spent --skills develop,sync --cap 30 && for s in develop:06bf3a44fcb50995:bdb0ffb776c715e8 sync:72c437df1ea657c6:1e5a0b0d826546e5; do k=${s%%:*}; r=${s#*:}; b=${r%%:*}; a=${r#*:}; [ "$(awk "FNR==1" evals/results/$k/lean-gk-*/verify-run.txt | sort -u | wc -l | tr -d " ")" = 1 ] || exit 1; for d in evals/results/$k/lean-gk-*; do [ -d "$d-lan1" ] && continue; case $d in *-truoc-*) e=$b;; *-sau-*) e=$a;; *) exit 1;; esac; [ "$(sort -u $d/skill-digest.txt)" = "skill=$e" ] || exit 1; done; done'`
- Named probe: `evals/lean/compare.mjs` (exit 1 on a missing or partial cell, an unclassified grader or a V defect, now propagated through the temp file), the two `errored base=0 after=0` counts, `evals/lean/budget.mjs spent` (exit 1 above the cap), the single `instrument=` line per skill, and each kept cell's two `skill-digest.txt` lines equal to its side's digest (pilots included, a cell with a `-lan1` replaced by it).
- Reachability: run from the repository root after Step 3; the helpers read the live `evals/results/<skill>/`.
- Oracle: exit 0; each comparison file equals a fresh run of its helper.
- Counterexample: a before cell run from the live tree records the after digest, so the digest loop exits 1; a cell missing on one side makes `compare.mjs` exit 1, which `pipefail` and the temp file carry to the Command.
- Artifacts: `specs/skill-gotchas-eval/compare-develop.txt`, `specs/skill-gotchas-eval/compare-sync.txt`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A quota error or a spend that would cross $30 stops the task and asks the user.

## Receipt
Verification: PASS
Command: bash -o pipefail -c 't=$(mktemp -d) && node evals/lean/compare.mjs --skill develop --base lean-gk-truoc- --after lean-gk-sau- --cells lenh-tien-quyet-sonnet,lenh-tien-quyet-opus > $t/d && cmp $t/d specs/skill-gotchas-eval/compare-develop.txt && node evals/lean/compare.mjs --skill sync --base lean-gk-truoc- --after lean-gk-sau- --cells sua-task-done-sonnet,sua-task-done-opus > $t/s && cmp $t/s specs/skill-gotchas-eval/compare-sync.txt && [ "$(grep -c "errored base=0 after=0" $t/d)" = 2 ] && [ "$(grep -c "errored base=0 after=0" $t/s)" = 2 ] && node evals/lean/budget.mjs spent --skills develop,sync --cap 30 && for s in develop:06bf3a44fcb50995:bdb0ffb776c715e8 sync:72c437df1ea657c6:1e5a0b0d826546e5; do k=${s%%:*}; r=${s#*:}; b=${r%%:*}; a=${r#*:}; [ "$(awk "FNR==1" evals/results/$k/lean-gk-*/verify-run.txt | sort -u | wc -l | tr -d " ")" = 1 ] || exit 1; for d in evals/results/$k/lean-gk-*; do [ -d "$d-lan1" ] && continue; case $d in *-truoc-*) e=$b;; *-sau-*) e=$a;; *) exit 1;; esac; [ "$(sort -u $d/skill-digest.txt)" = "skill=$e" ] || exit 1; done; done'
Exit: 0
Base: 7ed6b1faae93d8299945862bf2887be9a53968cb
Head: 1376e41e3ce688ad163361742859ba38be0caff7aae4fc575eae5e80c167542f
Artifact: specs/skill-gotchas-eval/compare-develop.txt sha256: 76433b008452401977b03ad2db44595daae8cadb5805089522ef2da50a52bed8
Artifact: specs/skill-gotchas-eval/compare-sync.txt sha256: 67b30dc9687fbde5e8677db907688ea1500bd1ef05a799ac45b7d6eb9b3c0af7
Runs: 6 pilots and 8 cells under `evals/results/{develop,sync}/lean-gk-*` with `kept/` copies; no cell needed a `-lan1` (every cell exit 0, `partial=false`, 0 errored runs, 0 `verdict=error`, no `not granted`, loading 10/10 per cell and 3/3 or 1/1 per pilot). Every before cell was copied back and checked with `diff -r --no-dereference` before the worktree was removed with `git worktree remove --force`. Pilots (D-09): before-side primary 0/3 on both models in both cases, so no ceiling.

```text
budget: spent=15.3404 cap=30
```
