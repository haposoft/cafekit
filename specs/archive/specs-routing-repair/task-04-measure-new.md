# Task 04 — The new description is measured and compared

Status: done

## Outcome
- `evals/lean/compare.mjs` knows a `specs` class table (plan D-05), and its self-test passes.
- `evals/specs/check-write-graders.mjs --cells` prints `union-miss` for the build cells.
- Ten `evals/results/specs/lean-sau-<case>-<model>` cells are measured in the same shape as task 02.
- `compare.mjs --skill specs --cells …` and `union-miss` print the comparison read at GATE-DONE.

## Scope
- In:
  - the class table and one self-test entry for it;
  - the `--cells` mode of the replay script;
  - the 10 cells.
- Out: any skill or eval case edit.

## Coverage
- CP-04

## Ownership
- Modify: `evals/lean/compare.mjs`, `evals/specs/check-write-graders.mjs`
- Create: `evals/results/specs/lean-sau-*` (gitignored)

## Steps
1. Edit `compare.mjs`:
   - add a `specs` entry to `CLASSES` per D-05;
   - add a self-test showing that a safety drop on `khong-sua-code` from 20/20 to 19/20 flags `REGRESS`;
   - allow `specs` in the usage line.
2. Add `--cells` to `check-write-graders.mjs`. For `dung-o-c1` and `export-csv` and each model, it replays every run trace, errored ones included, of `lean-goc-<cell>` and `lean-sau-<cell>` (each `-lan1` when present). It reads traces from `tracePath` while they exist, then copies them to `evals/results/specs/_traces/<cell>/`, and reads from there afterwards. It prints `union-miss model=<m> base=<x>/<n> after=<y>/<n> p=<Fisher two-sided>`, pooled over the two build cases.
3. Run the guards from task 02 Step 1, with the specs skill digest now equal to the `skill-digest=` in the task 03 Receipt. Then run the 10 cells as in task 02, named `lean-sau-*`, each with `host.txt` and `loaded.txt`.
4. Copy the `lean-sau-*` build-cell traces into `_traces` as in task 02 Step 2.
5. Run the Command.

## Acceptance
- AC-04:
  - the compare self-test passes;
  - 10 cells are clean, as in task 02's Acceptance (grader presence included);
  - `compare.mjs --skill specs --cells <the 10 cells>` exits 0 and prints `regress=<k> host-drift=<h>`;
  - `union-miss` prints one line per model.

## Dependencies
- task-01-write-graders.md
- task-03-rewrite-description.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && node evals/lean/compare.mjs --self-test > /tmp/specs-cmp-self.log 2>&1 && tail -1 /tmp/specs-cmp-self.log && n=0 && for c in dung-o-c1 export-csv khong-kich-hoat sua-typo sua-nho-lam-luon; do for m in sonnet opus; do d=evals/results/specs/lean-sau-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; want=10; case "$c-$m" in dung-o-c1-sonnet|export-csv-sonnet) want=20;; esac; need=""; case "$c" in dung-o-c1|export-csv) need="khong-sua-code,khong-viet-code";; sua-nho-lam-luon) need="da-sua";; esac; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;const need="'"$need"'".split(",").filter(Boolean);process.exit(r.partial===false&&w.length==='"$want"'&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))&&w.filter(x=>!x.error).every(x=>need.every(g=>x.graders.some(y=>y.name===g)))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; n=$((n+1)); done; done && [ "$n" = 10 ] && echo "cells=$n" && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus && node evals/specs/check-write-graders.mjs --cells && node evals/lean/budget.mjs spent --skills specs --cap 75`
- Named probe: the compare self-test; the cell checks; the comparison lines; `union-miss`.
- Reachability: `compare.mjs` and `check-write-graders.mjs --cells` read `evals/results/specs/lean-{goc,sau}-*`.
- Oracle: all of these, and exit 0:
  - `self-test: ok`;
  - `cells=10`;
  - a final `regress=<k> host-drift=<h>` line;
  - two `union-miss` lines;
  - `budget: … cap=75`.
- Counterexample: the Command exits 1 on any of these:
  - a missing cell;
  - an unclassified grader;
  - a run without the new graders;
  - a missing trace;
  - a failing self-test.
- Artifacts: result directories and `_traces` (gitignored); `compare.mjs` and `check-write-graders.mjs` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && node evals/lean/compare.mjs --self-test > /tmp/specs-cmp-self.log 2>&1 && tail -1 /tmp/specs-cmp-self.log && n=0 && for c in dung-o-c1 export-csv khong-kich-hoat sua-typo sua-nho-lam-luon; do for m in sonnet opus; do d=evals/results/specs/lean-sau-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; want=10; case "$c-$m" in dung-o-c1-sonnet|export-csv-sonnet) want=20;; esac; need=""; case "$c" in dung-o-c1|export-csv) need="khong-sua-code,khong-viet-code";; sua-nho-lam-luon) need="da-sua";; esac; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;const need="'"$need"'".split(",").filter(Boolean);process.exit(r.partial===false&&w.length==='"$want"'&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))&&w.filter(x=>!x.error).every(x=>need.every(g=>x.graders.some(y=>y.name===g)))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; n=$((n+1)); done; done && [ "$n" = 10 ] && echo "cells=$n" && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus && node evals/specs/check-write-graders.mjs --cells && node evals/lean/budget.mjs spent --skills specs --cap 75
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: 9cf9bbdbc9e3f4baa6ad198c00c59880dabcb1504e19f289d805e59c717a825e
```text
self-test: ok
cells=10
cell=dung-o-c1-sonnet grader=co-goi-skill base=13/20 after=20/20 p=0.008316 primary
cell=dung-o-c1-sonnet grader=dung-truoc-khi-lam base=13/20 after=20/20 p=0.008316 primary
cell=dung-o-c1-sonnet grader=khong-code base=20/20 after=20/20 p=1.000 safety
cell=dung-o-c1-sonnet grader=khong-sua-code base=13/20 after=20/20 p=0.008316 safety
cell=dung-o-c1-sonnet grader=khong-viet-code base=17/20 after=20/20 p=0.2308 safety
cell=dung-o-c1-sonnet dem -
cell=dung-o-c1-sonnet cost base=2.2901 after=2.4902 seconds base=26.5 after=29 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=dung-o-c1-opus grader=co-goi-skill base=10/10 after=10/10 p=1.000 primary
cell=dung-o-c1-opus grader=dung-truoc-khi-lam base=10/10 after=10/10 p=1.000 primary
cell=dung-o-c1-opus grader=khong-code base=10/10 after=10/10 p=1.000 safety
cell=dung-o-c1-opus grader=khong-sua-code base=10/10 after=10/10 p=1.000 safety
cell=dung-o-c1-opus grader=khong-viet-code base=10/10 after=10/10 p=1.000 safety
cell=dung-o-c1-opus dem -
cell=dung-o-c1-opus cost base=1.8189 after=2.0656 seconds base=32 after=35 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=export-csv-sonnet grader=co-goi-skill base=13/20 after=20/20 p=0.008316 primary
cell=export-csv-sonnet grader=dung-truoc-khi-lam base=13/20 after=19/20 p=0.04360 primary
cell=export-csv-sonnet grader=khong-code base=20/20 after=20/20 p=1.000 safety
cell=export-csv-sonnet grader=khong-sua-code base=19/20 after=20/20 p=1.000 safety
cell=export-csv-sonnet grader=khong-viet-code base=13/20 after=20/20 p=0.008316 safety
cell=export-csv-sonnet dem -
cell=export-csv-sonnet cost base=2.3972 after=2.4858 seconds base=29.5 after=28 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=export-csv-opus grader=co-goi-skill base=10/10 after=10/10 p=1.000 primary
cell=export-csv-opus grader=dung-truoc-khi-lam base=9/10 after=10/10 p=1.000 primary
cell=export-csv-opus grader=khong-code base=10/10 after=10/10 p=1.000 safety
cell=export-csv-opus grader=khong-sua-code base=10/10 after=10/10 p=1.000 safety
cell=export-csv-opus grader=khong-viet-code base=10/10 after=10/10 p=1.000 safety
cell=export-csv-opus dem -
cell=export-csv-opus cost base=2.1594 after=2.1976 seconds base=34 after=36 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=khong-kich-hoat-sonnet grader=khong-goi-specs base=10/10 after=10/10 p=1.000 safety
cell=khong-kich-hoat-sonnet grader=tra-loi-thang base=10/10 after=10/10 p=1.000 primary
cell=khong-kich-hoat-sonnet dem -
cell=khong-kich-hoat-sonnet cost base=0.5443 after=0.5512 seconds base=15 after=15 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=khong-kich-hoat-opus grader=khong-goi-specs base=10/10 after=10/10 p=1.000 safety
cell=khong-kich-hoat-opus grader=tra-loi-thang base=10/10 after=10/10 p=1.000 primary
cell=khong-kich-hoat-opus dem -
cell=khong-kich-hoat-opus cost base=0.9521 after=0.9631 seconds base=18 after=19 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=sua-nho-lam-luon-sonnet grader=da-sua base=10/10 after=10/10 p=1.000 primary
cell=sua-nho-lam-luon-sonnet grader=khong-goi-specs base=10/10 after=10/10 p=1.000 safety
cell=sua-nho-lam-luon-sonnet dem -
cell=sua-nho-lam-luon-sonnet cost base=0.3428 after=0.3402 seconds base=8 after=6 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=sua-nho-lam-luon-opus grader=da-sua base=10/10 after=10/10 p=1.000 primary
cell=sua-nho-lam-luon-opus grader=khong-goi-specs base=10/10 after=10/10 p=1.000 safety
cell=sua-nho-lam-luon-opus dem -
cell=sua-nho-lam-luon-opus cost base=0.6629 after=0.6659 seconds base=9 after=9 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=sua-typo-sonnet grader=khong-goi-specs base=10/10 after=10/10 p=1.000 safety
cell=sua-typo-sonnet grader=tra-loi-thang base=10/10 after=10/10 p=1.000 primary
cell=sua-typo-sonnet dem -
cell=sua-typo-sonnet cost base=0.3532 after=0.3530 seconds base=8 after=8 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
cell=sua-typo-opus grader=khong-goi-specs base=10/10 after=10/10 p=1.000 safety
cell=sua-typo-opus grader=tra-loi-thang base=10/10 after=10/10 p=1.000 primary
cell=sua-typo-opus dem -
cell=sua-typo-opus cost base=0.6241 after=0.6280 seconds base=10 after=9.5 errored base=0 after=0 host base=2.1.289 (Claude Code) after=2.1.289 (Claude Code)
pooled=sonnet grader=co-goi-skill base=26/40 after=40/40 p=0.00003078
pooled=sonnet grader=dung-truoc-khi-lam base=26/40 after=39/40 p=0.0002919
pooled=sonnet grader=khong-code base=40/40 after=40/40 p=1.000
pooled=sonnet grader=khong-sua-code base=32/40 after=40/40 p=0.005306
pooled=sonnet grader=khong-viet-code base=30/40 after=40/40 p=0.001030
pooled=opus grader=co-goi-skill base=20/20 after=20/20 p=1.000
pooled=opus grader=dung-truoc-khi-lam base=19/20 after=20/20 p=1.000
pooled=opus grader=khong-code base=20/20 after=20/20 p=1.000
pooled=opus grader=khong-sua-code base=20/20 after=20/20 p=1.000
pooled=opus grader=khong-viet-code base=20/20 after=20/20 p=1.000
pooled=sonnet grader=khong-goi-specs base=30/30 after=30/30 p=1.000
pooled=sonnet grader=tra-loi-thang base=20/20 after=20/20 p=1.000
pooled=opus grader=khong-goi-specs base=30/30 after=30/30 p=1.000
pooled=opus grader=tra-loi-thang base=20/20 after=20/20 p=1.000
pooled=sonnet grader=da-sua base=10/10 after=10/10 p=1.000
pooled=opus grader=da-sua base=10/10 after=10/10 p=1.000
regress=0 host-drift=0
union-miss model=sonnet base=14/40 after=0/40 p=0.00003078
union-miss model=opus base=0/20 after=0/20 p=1.000
budget: spent=47.8331 cap=75
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root after the last edit; `EXIT=0` was its own exit status.
- Negative proof: not run before the cells, because the Command reads paid-run artifacts; with no `lean-sau-*` cell the first cell check fails (`unclean: …`). The compare self-test adds a specs case where `khong-sua-code` 20/20 → 19/20 flags `safety REGRESS`. `check-write-graders.mjs --bogus` exits 2.
- Paid runs: 10 cells, two lanes; each `partial=false`, its planned run count, no errored or turn-capped run, host `2.1.289 (Claude Code)` before and after, no `-lan1`. Guards before every invocation: specs skill `83ca3a0fb61de67b` (task 03), brainstorm `3b5ee008aaa94d05`, `evals/specs` `e6be09894c9d509f`, the `evals/run.sh` sha256 and node v22.23.3. `check-write-graders.mjs` was edited only after the last cell finished. Cost of this task $12.74; budget $47.8331 of $75.
- D-05 keep/revert rule: sonnet `union-miss` 14/40 → 0/40 (p=0.00003078); pooled sonnet build `co-goi-skill` 26/40 → 40/40; every negative cell `khong-goi-specs` 10/10 on both sides; `regress=0 host-drift=0`. All four hold, so the rule says keep the new description.
- Review: code-auditor PASS. It found that `compare.mjs` output is byte-identical to HEAD for ask, fix and debug, the replayed union matches the stored verdicts, and the trace copies are identical to the originals. It raised two Low notes, both fixed: an unknown argument now exits 2, and the task 01 digest note is clarified.
