# Task 02 — The current description is measured with the new graders

Status: done

## Outcome
Ten result directories `evals/results/specs/lean-goc-<case>-<model>`:
- cases `dung-o-c1`, `export-csv`, `khong-kich-hoat`, `sua-typo` and `sua-nho-lam-luon`, each for sonnet and opus;
- sonnet `dung-o-c1` and `export-csv` run 20 times, every other cell 10;
- each directory is complete and has `host.txt` and `loaded.txt`;
- all are measured on the current skill bytes, before task 03 edits anything.

## Scope
- In: the 10 cells per plan D-02 and D-03.
- Out: any file edit.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/specs/lean-goc-*` (gitignored)
- Read: `evals/run.sh`, `evals/lean/{budget,loaded}.mjs`

## Steps
1. Before every invocation, run the guards with the plan's digest command, and stop on any mismatch:
   - the specs skill digest is `f208fb4864a8b11d`;
   - the brainstorm skill digest is `3b5ee008aaa94d05`;
   - the `evals/specs` digest equals the `digest=` printed in the task 01 Receipt;
   - the `evals/run.sh` sha256 starts `a75cd5b5fbe5b643`;
   - node is v22.23.3.

   Then run `node evals/lean/budget.mjs check <c> --skills specs --cap 75`.
2. Run the cells in two lanes, one per model, per D-02 and D-03. Right after each cell, write `host.txt` and `loaded.txt` as in `specs/specs-eval-remeasure` D-04. For the build cells, also copy every run's `tracePath` to `evals/results/specs/_traces/<cell>/run-NN.jsonl`, because `/private/tmp` is lost on reboot.
3. Run the Command.

## Acceptance
- AC-02:
  - 10 cells, each `partial=false`, each with its planned run count and no error other than the turn cap;
  - every run of a build cell carries both `khong-sua-code` and `khong-viet-code`, and every run of `sua-nho-lam-luon` carries `da-sua`;
  - every `host.txt` (of the chosen directories) holds one version, and all are equal;
  - every cell has `loaded.txt`;
  - the budget stays within its cap.

## Dependencies
- task-01-write-graders.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && n=0 && hosts="" && for c in dung-o-c1 export-csv khong-kich-hoat sua-typo sua-nho-lam-luon; do for m in sonnet opus; do d=evals/results/specs/lean-goc-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; want=10; case "$c-$m" in dung-o-c1-sonnet|export-csv-sonnet) want=20;; esac; need=""; case "$c" in dung-o-c1|export-csv) need="khong-sua-code,khong-viet-code";; sua-nho-lam-luon) need="da-sua";; esac; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;const need="'"$need"'".split(",").filter(Boolean);process.exit(r.partial===false&&w.length==='"$want"'&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))&&w.filter(x=>!x.error).every(x=>need.every(g=>x.graders.some(y=>y.name===g)))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; hosts="$hosts$(cat $d/host.txt)"$'\n'; n=$((n+1)); done; done && [ "$n" = 10 ] && echo "cells=$n" && [ "$(printf '%s' "$hosts" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')" = 1 ] && echo one-host && node evals/lean/budget.mjs spent --skills specs --cap 75`
- Named probe: each `result.json`, `host.txt`, budget.
- Reachability: `evals/run.sh specs` writes `evals/results/specs/<out>`.
- Oracle: `cells=10`, `one-host`, `budget: spent=<x> cap=75`, exit 0.
- Counterexample: the Command exits 1 on any of these:
  - a missing, short, partial or errored cell;
  - a run without the new graders;
  - mixed hosts.
- Artifacts: result directories (gitignored).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && n=0 && hosts="" && for c in dung-o-c1 export-csv khong-kich-hoat sua-typo sua-nho-lam-luon; do for m in sonnet opus; do d=evals/results/specs/lean-goc-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; want=10; case "$c-$m" in dung-o-c1-sonnet|export-csv-sonnet) want=20;; esac; need=""; case "$c" in dung-o-c1|export-csv) need="khong-sua-code,khong-viet-code";; sua-nho-lam-luon) need="da-sua";; esac; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;const need="'"$need"'".split(",").filter(Boolean);process.exit(r.partial===false&&w.length==='"$want"'&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))&&w.filter(x=>!x.error).every(x=>need.every(g=>x.graders.some(y=>y.name===g)))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; hosts="$hosts$(cat $d/host.txt)"$'\n'; n=$((n+1)); done; done && [ "$n" = 10 ] && echo "cells=$n" && [ "$(printf '%s' "$hosts" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')" = 1 ] && echo one-host && node evals/lean/budget.mjs spent --skills specs --cap 75
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: 9cf9bbdbc9e3f4baa6ad198c00c59880dabcb1504e19f289d805e59c717a825e
```text
cells=10
one-host
budget: spent=47.8331 cap=75
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: not run before the cells, because the Command reads paid-run artifacts; with no `lean-goc-*` cell the first `require` fails (`unclean: …`).
- Paid runs: 10 cells, two lanes; each `partial=false`, its planned run count (sonnet `dung-o-c1`, `export-csv` 20; others 10), no errored or turn-capped run; host `2.1.289 (Claude Code)` before and after; no `-lan1`. Cost of this task $12.14; budget $35.0925 of $75.
- Guards: before every invocation the driver checked specs `f208fb4864a8b11d`, brainstorm `3b5ee008aaa94d05`, `evals/specs` `e6be09894c9d509f`, the `evals/run.sh` sha256 and node v22.23.3; the reviewer recomputed them afterwards and they still hold.
- Baseline reading (for task 04): sonnet `dung-o-c1` invoked specs 13/20, `khong-sua-code` 13/20, `khong-viet-code` 17/20; sonnet `export-csv` invoked 13/20, `khong-sua-code` 19/20, `khong-viet-code` 13/20; opus build cells invoked 10/10; every negative cell `khong-goi-specs` 10/10; `sua-nho-lam-luon` `da-sua` 10/10 in both models.
- Traces: build-cell traces copied to `evals/results/specs/_traces/lean-goc-*` (20/20/10/10 files).
- Review: code-auditor PASS (three Low notes, none blocking).
