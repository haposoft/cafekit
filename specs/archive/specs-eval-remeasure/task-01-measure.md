# Task 01 — The current specs is measured on seven cases in both models

Status: done

## Outcome
Fourteen result directories `evals/results/specs/lean-re-<case>-<model>` (7 cases × sonnet and opus), ten runs each, complete, with `host.txt`, plus the two pilots.

## Scope
- In: pilots and 14 cells per plan D-01, D-02.
- Out: any file edit.

## Coverage
- CP-01

## Ownership
- Create: `evals/results/specs/lean-re-*` (gitignored)
- Read: `evals/run.sh`, `evals/lean/budget.mjs`, `evals/summarize.mjs`

## Steps
1. Guards per D-01 before every invocation; `node evals/lean/budget.mjs check <c> --skills specs --cap 80`.
2. Pilots (D-02); then cells for `dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua sau-keep khong-kich-hoat sua-typo` in two lanes; `--max-cost-usd 8` per cell (`sau-keep` opus 12); `host.txt` and `loaded.txt` per D-04 right after each.
3. Run the Command.

## Acceptance
- AC-01: 14 cells `partial=false`, 10 runs, no errored run other than the turn cap (D-04), each with `loaded.txt`, each `host.txt` one version and all equal.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && n=0 && for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua sau-keep khong-kich-hoat sua-typo; do for m in sonnet opus; do d=evals/results/specs/lean-re-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;process.exit(r.partial===false&&w.length===10&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; n=$((n+1)); done; done && [ "$n" = 14 ] && echo "cells=$n" && [ "$(cat evals/results/specs/lean-re-*/host.txt | sort -u | wc -l | tr -d ' ')" = 1 ] && echo one-host && node evals/lean/budget.mjs spent --skills specs --cap 80`
- Named probe: each `result.json`, `host.txt`, budget.
- Reachability: `evals/run.sh specs` writes `evals/results/specs/<out>`.
- Oracle: `cells=14`, `one-host`, `budget: spent=<x> cap=80`, exit 0.
- Counterexample: a missing, partial or errored cell, or mixed hosts, makes the Command exit 1.
- Artifacts: result directories (gitignored).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && n=0 && for c in dung-o-c1 export-csv mo-ho-c1 mo-ho-du-cua sau-keep khong-kich-hoat sua-typo; do for m in sonnet opus; do d=evals/results/specs/lean-re-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;process.exit(r.partial===false&&w.length===10&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; n=$((n+1)); done; done && [ "$n" = 14 ] && echo "cells=$n" && [ "$(cat evals/results/specs/lean-re-*/host.txt | sort -u | wc -l | tr -d ' ')" = 1 ] && echo one-host && node evals/lean/budget.mjs spent --skills specs --cap 80
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: 5d05a24693edc26df57a7b77c0646d33e6d01a28f3b7adfcf25ef7f96833c8d6
```text
cells=14
one-host
budget: spent=22.9475 cap=80
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any cell existed the Command exited 1 (`unclean: evals/results/specs/lean-re-dung-o-c1-sonnet`).
- Paid runs: pilots `lean-re-pilot-*` (sonnet 3, opus 1) loaded and clean; 14 cells, each `partial=false`, 10 runs, no errored run, host `2.1.289 (Claude Code)` before and after; no `-lan1` rerun was needed. Spend $22.9475 of $80.
- Guards: every invocation checked the D-01 digests (specs `f208fb4864a8b11d`, brainstorm `3b5ee008aaa94d05`, evals/specs `835f27e50264490b`), the `evals/run.sh` sha256 and node v22.23.3; `git diff --stat HEAD` over those paths is empty.
- Review: code-auditor PASS; non-blocking note: that `--with-skill brainstorm` took effect is shown only by the driver arguments, as `result.json` does not list plugin skills.
- Artifacts: `evals/results/specs/lean-re-*` (gitignored, local) with `result.json`, `host.txt`, `loaded.txt`.
