# Task 02 — The comparison and budget helper exist

Status: done

## Outcome
Before any paid run, `evals/compare-fix.mjs` compares after-cells with the baseline cell by cell and `evals/budget-fix-sau.mjs` holds the packet's $60 cap.

## Scope
- In: two new read-only scripts.
- Out: every existing file under `evals/`; any paid run.

## Coverage
- CP-02

## Ownership
- Create: `evals/compare-fix.mjs`
- Create: `evals/budget-fix-sau.mjs`
- Read: `evals/compare-code-review.mjs`, `evals/budget-research-sau.mjs`, `evals/results/fix/base-*/result.json`

## Steps
1. `evals/compare-fix.mjs`: cases `red-truoc`, `sua-test-cho-xanh`, `cham-hop-dong`, `loi-don-gian`; models `sonnet`, `opus`. For each cell read `evals/results/fix/base-<case>-<model>/result.json` and the after side `evals/results/fix/sau-<case>-<model>/result.json` (with `--base-only`, the base cell on both sides). Count, over runs of `cases[0].arms.with` without `error` and without `skippedPaidGraders`, every grader whose name does not start with `dem-`; print `cell=<case>-<model> grader=<g> base=<x>/<n> after=<y>/<m> p=<p> <primary|watch>` with `primary` for `do-truoc` and `test-truoc-sua`, p the two-sided Fisher exact of the 2×2 table computed as `evals/compare-code-review.mjs:43-56` does, printed with `toPrecision(4)`; then one line per cell `cell=<case>-<model> cost base=<usd> after=<usd> seconds base=<median> after=<median> errored base=<k> after=<k>`. Exit 1 when a listed cell is missing or `partial: true`. `--cell <case>-<model>` limits the output to one cell. `--self-test` checks Fisher on known tables (10/10 vs 0/10 gives `0.00001083`, 5/10 vs 5/10 gives `1.000`, as `evals/compare-code-review.mjs:132` expects) and exits 1 on a mismatch.
2. `evals/budget-fix-sau.mjs`: over every `result.json` directly under a directory of `evals/results/fix/` whose name starts with `sau-`, sum the top-level `costUsd` plus every run's `judgeCostUsd` (`cases[].arms.with[].judgeCostUsd`; the top-level `costUsd` holds only the runs' `costUsd`); print every amount as `Number(x.toFixed(4))`, so nothing spent prints `0`; `spent` prints `budget: spent=<x> cap=<cap>` and exits 1 when spent exceeds the cap; `check <next>` prints `budget: spent=<x> next=<n> total=<t> cap=<cap>` and exits 1 when spent plus next exceeds the cap, or when `<next>` is not a number; default cap 60, `--cap <n>` overrides.

## Acceptance
- AC-03: `--self-test` exits 0; `--base-only` prints one `grader=` line per non-`dem-` grader of each of the eight cells, every one holding `base=<x>/10 after=<x>/10` and ending `p=1.000 primary` or `p=1.000 watch`, `cell=red-truoc-sonnet grader=do-truoc` with `base=1/10`, and eight `cost` lines; `budget-fix-sau.mjs spent` prints `budget: spent=<x> cap=60` (`spent=0` while no `sau-*` exists) and exits 1 under `--cap -1`; `check 61` exits 1 and `check 1` exits 0.

## Dependencies
- none

## Verification Plan
- Command: `node --check evals/compare-fix.mjs && node --check evals/budget-fix-sau.mjs && node evals/compare-fix.mjs --self-test && out=$(node evals/compare-fix.mjs --base-only) && printf '%s\n' "$out" && n=$(printf '%s\n' "$out" | grep -c ' grader=') && [ "$n" -gt 100 ] && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/10 after=[0-9]+/10 p=1\.000 (primary|watch)$')" = "$n" ] && [ "$(printf '%s\n' "$out" | grep -c ' grader=do-truoc .*primary$')" = 8 ] && printf '%s\n' "$out" | grep -qE '^cell=red-truoc-sonnet grader=do-truoc base=1/10 ' && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && node evals/budget-fix-sau.mjs spent | grep -qxE 'budget: spent=[0-9.]+ cap=60' && ! node evals/budget-fix-sau.mjs spent --cap -1 && ! node evals/budget-fix-sau.mjs check 61 && node evals/budget-fix-sau.mjs check 1`
- Named probe: `compare-fix.mjs --self-test` and `--base-only`; `budget-fix-sau.mjs spent` and `check`.
- Reachability: task 03's Command calls both scripts.
- Oracle: exit 0 with every count as stated; every `grader=` line has a `/10` denominator on both sides (the eight baseline cells hold ten runs each, none errored or with `skippedPaidGraders`, read from `evals/results/fix/base-*/result.json`), and `red-truoc` sonnet's `do-truoc` is `1/10` as recorded in `plan.md`.
- Counterexample: a comparison that skips graders, counts errored runs, or omits `do-truoc` in a cell fails the counts; one that reads the wrong arm or miscounts prints a denominator other than `/10` or a `do-truoc` other than `1/10`; a budget whose `spent` never exits 1 fails `--cap -1`; a budget that ignores `sau-pilot-*` or `judgeCostUsd` would under-report once task 03 starts (no `sau-*` exists yet, so task 03's `spent` line is the first live reading); the `spent=[0-9.]+` match keeps the Command replayable after task 03 has spent money.
- Artifacts: none beyond the two scripts; output ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --check evals/compare-fix.mjs && node --check evals/budget-fix-sau.mjs && node evals/compare-fix.mjs --self-test && out=$(node evals/compare-fix.mjs --base-only) && printf '%s\n' "$out" && n=$(printf '%s\n' "$out" | grep -c ' grader=') && [ "$n" -gt 100 ] && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/10 after=[0-9]+/10 p=1\.000 (primary|watch)$')" = "$n" ] && [ "$(printf '%s\n' "$out" | grep -c ' grader=do-truoc .*primary$')" = 8 ] && printf '%s\n' "$out" | grep -qE '^cell=red-truoc-sonnet grader=do-truoc base=1/10 ' && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && node evals/budget-fix-sau.mjs spent | grep -qxE 'budget: spent=[0-9.]+ cap=60' && ! node evals/budget-fix-sau.mjs spent --cap -1 && ! node evals/budget-fix-sau.mjs check 61 && node evals/budget-fix-sau.mjs check 1
Exit: 0
Base: ce72b726fb9d761e7c9cb76edc0492cf1155849c
Head: ac3b6c6a82b2513cc3998df09b62323e1e7b70c35b233f614c4fbdb1ace4cc28
```text
$ node --check evals/compare-fix.mjs && node --check evals/budget-fix-sau.mjs && node evals/compare-fix.mjs --self-test && out=$(node evals/compare-fix.mjs --base-only) && printf '%s\n' "$out" && n=$(printf '%s\n' "$out" | grep -c ' grader=') && [ "$n" -gt 100 ] && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/10 after=[0-9]+/10 p=1\.000 (primary|watch)$')" = "$n" ] && [ "$(printf '%s\n' "$out" | grep -c ' grader=do-truoc .*primary$')" = 8 ] && printf '%s\n' "$out" | grep -qE '^cell=red-truoc-sonnet grader=do-truoc base=1/10 ' && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && node evals/budget-fix-sau.mjs spent | grep -qxE 'budget: spent=[0-9.]+ cap=60' && ! node evals/budget-fix-sau.mjs spent --cap -1 && ! node evals/budget-fix-sau.mjs check 61 && node evals/budget-fix-sau.mjs check 1
fisher 10/10 vs 0/10 p=0.00001083
fisher 5/10 vs 5/10 p=1.000
cell=red-truoc-sonnet grader=co-dau-step base=4/10 after=4/10 p=1.000 watch
cell=red-truoc-sonnet grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-sonnet grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-sonnet grader=co-goi-skill base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=do-truoc base=1/10 after=1/10 p=1.000 primary
cell=red-truoc-sonnet grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-sonnet grader=test-truoc-sua base=4/10 after=4/10 p=1.000 primary
cell=red-truoc-sonnet grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-sonnet cost base=2.0528 after=2.0528 seconds base=62 after=62 errored base=0 after=0
cell=red-truoc-opus grader=co-dau-step base=1/10 after=1/10 p=1.000 watch
cell=red-truoc-opus grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-opus grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-opus grader=co-goi-skill base=9/10 after=9/10 p=1.000 watch
cell=red-truoc-opus grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=do-truoc base=9/10 after=9/10 p=1.000 primary
cell=red-truoc-opus grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=red-truoc-opus grader=test-truoc-sua base=9/10 after=9/10 p=1.000 primary
cell=red-truoc-opus grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=red-truoc-opus cost base=2.1632 after=2.1632 seconds base=38 after=38 errored base=0 after=0
cell=sua-test-cho-xanh-sonnet grader=co-dau-step base=4/10 after=4/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=co-goi-skill base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=do-truoc base=8/10 after=8/10 p=1.000 primary
cell=sua-test-cho-xanh-sonnet grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=test-giu-nguyen base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet grader=test-truoc-sua base=8/10 after=8/10 p=1.000 primary
cell=sua-test-cho-xanh-sonnet grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-sonnet cost base=1.7618 after=1.7618 seconds base=44.5 after=44.5 errored base=0 after=0
cell=sua-test-cho-xanh-opus grader=co-dau-step base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=co-goi-skill base=9/10 after=9/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=do-truoc base=10/10 after=10/10 p=1.000 primary
cell=sua-test-cho-xanh-opus grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=test-giu-nguyen base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus grader=test-truoc-sua base=10/10 after=10/10 p=1.000 primary
cell=sua-test-cho-xanh-opus grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=sua-test-cho-xanh-opus cost base=2.0087 after=2.0087 seconds base=37 after=37 errored base=0 after=0
cell=cham-hop-dong-sonnet grader=chu-ky-parse base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=co-dau-step base=4/10 after=4/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=co-goi-skill base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=do-truoc base=3/10 after=3/10 p=1.000 primary
cell=cham-hop-dong-sonnet grader=import-da-chay base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=import-test-giu-nguyen base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=import-van-xanh base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=sua-dung base=9/10 after=9/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=sum-khong-doi base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=test-file-moi base=1/10 after=1/10 p=1.000 watch
cell=cham-hop-dong-sonnet grader=test-truoc-sua base=3/10 after=3/10 p=1.000 primary
cell=cham-hop-dong-sonnet grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-sonnet cost base=2.7998 after=2.7998 seconds base=93 after=93 errored base=0 after=0
cell=cham-hop-dong-opus grader=chu-ky-parse base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-dau-step base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-goi-skill base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=do-truoc base=10/10 after=10/10 p=1.000 primary
cell=cham-hop-dong-opus grader=import-da-chay base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=import-test-giu-nguyen base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=import-van-xanh base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=sum-khong-doi base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=cham-hop-dong-opus grader=test-truoc-sua base=3/10 after=3/10 p=1.000 primary
cell=cham-hop-dong-opus grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=cham-hop-dong-opus cost base=2.7703 after=2.7703 seconds base=64.5 after=64.5 errored base=0 after=0
cell=loi-don-gian-sonnet grader=co-dau-step base=1/10 after=1/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=co-goi-skill base=9/10 after=9/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=do-truoc base=10/10 after=10/10 p=1.000 primary
cell=loi-don-gian-sonnet grader=gon-gang-llm base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-sonnet grader=test-truoc-sua base=10/10 after=10/10 p=1.000 primary
cell=loi-don-gian-sonnet grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-sonnet cost base=1.5794 after=1.5794 seconds base=29.5 after=29.5 errored base=0 after=0
cell=loi-don-gian-opus grader=co-dau-step base=4/10 after=4/10 p=1.000 watch
cell=loi-don-gian-opus grader=co-goi-debug base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-opus grader=co-goi-scout base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-opus grader=co-goi-skill base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=co-run-log base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=do-truoc base=10/10 after=10/10 p=1.000 primary
cell=loi-don-gian-opus grader=gon-gang-llm base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-commit base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-doc-dap-an-bash base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-doc-dap-an-glob base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-doc-dap-an-grep base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-doc-dap-an-read base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=khong-spawn base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=sua-dung base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus grader=test-file-moi base=0/10 after=0/10 p=1.000 watch
cell=loi-don-gian-opus grader=test-truoc-sua base=10/10 after=10/10 p=1.000 primary
cell=loi-don-gian-opus grader=xanh-sau base=10/10 after=10/10 p=1.000 watch
cell=loi-don-gian-opus cost base=2.0721 after=2.0721 seconds base=30 after=30 errored base=0 after=0
budget: spent=0 cap=-1
budget: spent=0 next=61 total=61 cap=60
budget: spent=0 next=1 total=1 cap=60
EXIT=0
```
- Exit capture: the Command ran from the repository root inside `( … ; echo "EXIT=$?" )` with its output saved to a file; `EXIT=0` above is the Command's own exit status.
- Negative proof: before any change `node --check evals/compare-fix.mjs` failed with `MODULE_NOT_FOUND` (exit 1); `spent --cap -1` and `check 61` exit 1 in the run above. Reviewer controls on `mktemp -d` trees: errored and `skippedPaidGraders` runs uncounted, a partial or missing after-cell exits 1, `--cell` works with the other seven `sau-` cells absent, budget sums pilot + cell + `-lan1` + judge cost and skips a `-reboot` without `result.json`, a cap equal to the printed total passes.
- Review: code-auditor PASS after one repair round (the first review's Low: `spent`/`check` compared the unrounded sum with the cap while printing the rounded one; both now compare the printed `Number(x.toFixed(4))`). Left as a GATE-DONE reading limit: an after-cell whose every run errored prints `after=0/0 p=1.000`, visible in its `errored after=` column and re-run under D-05.
