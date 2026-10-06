# Task 02 — Budget and payload comparison for the repair

Status: done

## Outcome
`budget.mjs --packet repair` budgets the `sau-*` cells against $100 with ceilings over the existing pilots of the four measured cases (plan D-03), and `check-payload.mjs --pair <before>,<after>…` prints delivered, valid and placed before and after, over comparable runs, with a two-sided Fisher p.

## Scope
- In: the `repair` packet in `budget.mjs`; `--pair` in `check-payload.mjs`; self-tests for both.
- Out: graders; paid runs; other packets' behaviour.

## Coverage
- CP-02

## Ownership
- Modify: `evals/test/budget.mjs`, `evals/test/check-payload.mjs`
- Read: `evals/test/compare.mjs` (`fisher`)

## Steps
1. `budget.mjs`: a `repair` packet as plan D-03 — `result.json` under any directory whose basename starts with `sau-` at any depth, `_kept/repair/**/*.lost.json`, ceilings the larger of the pilot formula over `sach`, `thieu-cong-cu`, `tron-legacy`, `khong-cham-code` and the before-cells' caps (sonnet 4, opus 5), `fits` over four cells per model; the baseline and hard packets unchanged; self-tests including `_capped/sau-x-opus-cap1` (counted), `base-*`/`kho-*` (not), and an opus ceiling of 5 when the pilot formula gives 4.
2. `check-payload.mjs --pair b1,a1 [b2,a2 …]`: refuse a pair whose `<case>-<model>` differ; for each pair print `pair=<a> delivered|valid|placed before=<x>/<comparable> after=<y>/<comparable> p=<p>` (Fisher from `compare.mjs`, both sides over comparable runs) and both sides' `check=` failure counts; `placed` per plan D-03; the existing output unchanged without the flag; self-tests including p for 0/10 against 10/10, 2-of-2-delivered against 7-of-10 read as 2/10 against 7/10, a mismatched pair, and `placed` failing for a JSON block inside the report, two blocks, or a block before more text with a fence.
3. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-02: both self-tests pass; the checker still passes; the Command prints `evals-test-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in budget check-payload compare save-runs; do node evals/test/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && node evals/test/budget.mjs --packet repair ceiling sonnet && node evals/test/budget.mjs --packet repair ceiling opus && node evals/test/budget.mjs --packet repair spent && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'`
- Named probe: the four self-tests; the checker; the repair ceilings over the real pilots
- Reachability: known — task 03 calls `budget.mjs --packet repair` and `check-payload.mjs --pair`
- Oracle: the Command exits 0, prints the ceilings 4 (sonnet) and 5 (opus) and `spent=0 cap=100`
- Counterexample: a `repair` packet that counts `base-*` or `kho-*` cells, or a `--pair` that swaps before and after, makes a self-test fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in budget check-payload compare save-runs; do node evals/test/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && node evals/test/budget.mjs --packet repair ceiling sonnet && node evals/test/budget.mjs --packet repair ceiling opus && node evals/test/budget.mjs --packet repair spent && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'
Exit: 0
Base: 599a9073634813bd0ac6c4984f5d34d8365dc65d
Head: e9da26c7b3dab0fcb7d76f8688a1f6be8cc6c9ebda6e31db87a828a668b69fdc
```text
budget self-test: ok
check-payload self-test: ok
compare self-test: ok
save-runs self-test: ok
checker: ok
4
5
spent=20.0158 cap=100
evals-test-digest: 298fc9ab6e958fbe0a63093b92d8e571b5863c5aa098a8abd7c70bb2e3f2f4a9
```

Fresh code-auditor review: PASS (24 mutants killed; check-payload output on all 30 earlier cells and budget without --packet or with --packet hard byte-identical to HEAD; placed() reads 0/140 earlier answers as placed). Re-run at the final-Head fixed point.
