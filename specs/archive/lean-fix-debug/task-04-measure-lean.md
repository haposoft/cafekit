# Task 04 — The lean pair is measured in the same 16 cells and compared

Status: done

## Outcome
Sixteen result directories `evals/results/{fix,debug}/lean-sau-<case>-<model>` measured on task 03's skills with task 02's instrument and options, and `evals/lean/compare.mjs` output for both skills saved as `specs/lean-fix-debug/compare-{fix,debug}.txt` for GATE-DONE.

## Scope
- In: 4 pilots and 16 cells on the lean skills, run one invocation at a time; the two comparison files.
- Out: any skill, case, grader or `evals/run.sh` edit; a further repair round (plan D-01 break signal).

## Coverage
- CP-02

## Ownership
- Create: `evals/results/fix/lean-sau-*`, `evals/results/debug/lean-sau-*`, `evals/results/{fix,debug}/lean-pilot-sau-*` (gitignored), `specs/lean-fix-debug/compare-fix.txt`, `specs/lean-fix-debug/compare-debug.txt`
- Read: task 02's Steps, `evals/lean/*`

## Steps
1. Record the lean skills' directory digests (task 02 Step 1's method) after task 03: `fix`, `debug`; `scout` must still be `22e5165f2beffc88`, `evals/fix` `760dc05e14904f9c`, `evals/debug` `65e5ee72cead5d2d`, `evals/run.sh` `a75cd5b5fbe5b643…`. Guard every invocation on these digests; record `claude --version` in `host.txt` as task 02 does — a version different from task 02's does not stop the run, `compare.mjs` tags it `HOST-DRIFT` and GATE-DONE names it (plan D-02).
2. Pilots and cells exactly as task 02 Steps 2–4 (sonnet pilots 3 runs, `host.txt`, `loaded.txt`, `verify-run-log.txt`, plan D-06 reruns) with `goc` replaced by `sau` in every name.
3. `node evals/lean/compare.mjs --skill fix > specs/lean-fix-debug/compare-fix.txt` and the same for `debug`.
4. Run the Command.

## Acceptance
- AC-04: 16 lean cells complete and loaded 10/10; both comparison files exist and end with a `regress= host-drift=` line; spend within the cap.

## Dependencies
- task-01-eval-helpers.md
- task-03-lean-rewrite.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-fix-debug/task-03-lean-rewrite.md && n=0 && for d in evals/results/fix/lean-sau-* evals/results/debug/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; case "$d" in evals/results/fix/*) grep -q ' runs=10 .* disagreements=0$' "$d/verify-run-log.txt" || { echo "verify: $d"; exit 1; };; esac; n=$((n+1)); done && [ "$n" = 16 ] && echo "cells=$n" && tmp=$(mktemp -d) && for s in fix debug; do node evals/lean/compare.mjs --skill $s > $tmp/cmp-$s.txt && cmp $tmp/cmp-$s.txt specs/lean-fix-debug/compare-$s.txt && tail -1 specs/lean-fix-debug/compare-$s.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' || { echo "compare: $s"; exit 1; }; done && node evals/lean/budget.mjs spent`
- Named probe: saved `loaded.txt` and `verify-run-log.txt`; `compare.mjs` re-run byte-equal to the saved file; `budget.mjs spent`.
- Reachability: as task 02.
- Oracle: `cells=16`, two `regress=<k> host-drift=<h>` lines, `budget: spent=<x> cap=150`, exit 0. The values are not the pass condition — GATE-DONE reads them (plan D-05, D-02).
- Counterexample: a missing, partial or not-loaded cell, or a saved comparison that differs from a fresh run, makes the Command exit 1.
- Artifacts: result directories (gitignored); `compare-{fix,debug}.txt` (tracked), re-derived byte-equal by the Command.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-fix-debug/task-03-lean-rewrite.md && n=0 && for d in evals/results/fix/lean-sau-* evals/results/debug/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; case "$d" in evals/results/fix/*) grep -q ' runs=10 .* disagreements=0$' "$d/verify-run-log.txt" || { echo "verify: $d"; exit 1; };; esac; n=$((n+1)); done && [ "$n" = 16 ] && echo "cells=$n" && tmp=$(mktemp -d) && for s in fix debug; do node evals/lean/compare.mjs --skill $s > $tmp/cmp-$s.txt && cmp $tmp/cmp-$s.txt specs/lean-fix-debug/compare-$s.txt && tail -1 specs/lean-fix-debug/compare-$s.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' || { echo "compare: $s"; exit 1; }; done && node evals/lean/budget.mjs spent
Exit: 0
Base: 6a5cd57d0d0b4186cf25914740e1c51f649b20cb
Head: fc7fddac464d0d32dde683268e18eef69eaacc64fdd153fcabc9116958d891a2
```text
cells=16
regress=0 host-drift=0
regress=1 host-drift=0
budget: spent=55.6413 cap=150
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any lean cell existed the Command exited 1 (`not loaded: evals/results/fix/lean-sau-*`).
- Paid runs: pilots `lean-pilot-sau-red-truoc-{sonnet 3/3, opus 1/1}`, `lean-pilot-sau-chi-chan-doan-{sonnet 3/3, opus 1/1}`; 16 cells in two lanes (one per model), each `partial=false`, 10 runs, 0 errored or skipped, `loaded=10/10`, host `2.1.289 (Claude Code)` (same as every goc cell, no `HOST-DRIFT`), fix cells `disagreements=0`; no `-lan1` rerun. Lean digests guarded on every invocation: fix `af5d39c8d795c3b0`, debug `b57f009c542c42a5`. Packet spend $55.6413 of $150.
- Result (read at GATE-DONE, plan D-05): fix `regress=0`; debug `regress=1` — `loi-hien-nhien-opus gon-gang-llm base=3/10 after=0/10 p=0.2105` (a 0.3 rate move; the LLM judge recorded votes only, no reasons; the report-shape and depth rules are byte-identical between sides).
- Review: code-auditor PASS (digests, 16 clean cells, suite options equal to the goc cells, saved comparisons byte-equal to a fresh run, the REGRESS reported).
- Artifacts: `specs/lean-fix-debug/compare-fix.txt`, `compare-debug.txt` (tracked); `evals/results/{fix,debug}/lean-sau-*` and `lean-pilot-sau-*` (gitignored, local).
