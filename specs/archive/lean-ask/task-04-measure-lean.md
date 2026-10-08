# Task 04 — The lean ask is measured in the same 10 cells and compared

Status: done

## Outcome
Ten result directories `evals/results/ask/lean-sau-<case>-<model>` on task 03's skill with task 02's options, and `specs/lean-ask/compare-ask.txt` from `evals/lean/compare.mjs --skill ask` for GATE-DONE.

## Scope
- In: 2 pilots and 10 cells as task 02 with `goc` → `sau`; the comparison file.
- Out: any skill, case, grader or `evals/run.sh` edit; a further repair round.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/ask/lean-sau-*`, `evals/results/ask/lean-pilot-sau-*` (gitignored), `specs/lean-ask/compare-ask.txt`
- Read: task 02's Steps, `evals/lean/*`

## Steps
1. Record the lean ask directory digest after task 03; `evals/ask` must still be `666ac4a6c0bf1221` and `evals/run.sh` `a75cd5b5fbe5b643…`; guard every invocation on them. A `claude --version` different from task 02's does not stop the run; `compare.mjs` tags `HOST-DRIFT`.
2. Pilots and cells exactly as task 02 Steps 2–4 with `goc` replaced by `sau`.
3. `node evals/lean/compare.mjs --skill ask > specs/lean-ask/compare-ask.txt`.
4. Run the Command.

## Acceptance
- AC-04: 10 lean cells complete and loaded 10/10; `compare-ask.txt` ends with a `regress= host-drift=` line and equals a fresh run; spend within the ask cap.

## Dependencies
- task-01-ask-helpers.md
- task-03-lean-rewrite.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-ask/task-03-lean-rewrite.md && n=0 && for d in evals/results/ask/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill ask > $t/c.txt && cmp $t/c.txt specs/lean-ask/compare-ask.txt && tail -1 specs/lean-ask/compare-ask.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills ask --cap 60`
- Named probe: saved `loaded.txt`; `compare.mjs` re-run byte-equal to the saved file; `budget.mjs spent`.
- Reachability: as task 02.
- Oracle: `cells=10`, one `regress=<k> host-drift=<h>` line, `budget: spent=<x> cap=60`, exit 0; the values are read at GATE-DONE.
- Counterexample: a missing or not-loaded cell, or a saved comparison that differs from a fresh run, makes the Command exit 1.
- Artifacts: result directories (gitignored); `compare-ask.txt` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-ask/task-03-lean-rewrite.md && n=0 && for d in evals/results/ask/lean-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill ask > $t/c.txt && cmp $t/c.txt specs/lean-ask/compare-ask.txt && tail -1 specs/lean-ask/compare-ask.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills ask --cap 60
Exit: 0
Base: 5f5d745cad94c751727c5cd14247a428d48a125e
Head: 71b5ba48d6ac38dacb7c294cfa9d2fa3769fbe1f20ae724495306747b3bd87a5
```text
cells=10
regress=11 host-drift=0
budget: spent=20.2081 cap=60
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any lean cell existed the Command exited 1 (`not loaded: evals/results/ask/lean-sau-*`).
- Paid runs: pilots `lean-pilot-sau-co-bang-chung-{sonnet 3/3, opus 1/1}`; 10 cells in two lanes, each `partial=false`, 10 runs, 0 errored or skipped, `loaded=10/10`, host `2.1.289 (Claude Code)` (same as every goc cell, no `HOST-DRIFT`); no `-lan1` rerun. Lean ask digest `8c4705dec7cdd0fb` guarded on every invocation. Spend $20.2081 of $60.
- Result (read at GATE-DONE, plan D-05): `regress=11`, all from one failure — `hoi-lai` no longer asks back: `hoi-lai` 10/10 → 0/10 (sonnet and opus), `mot-cau-hoi` 10 → 1 (sonnet) and 10 → 8 (opus, p=0.47), `joint` 10 → 0 in both, and their pooled lines. Without `hoi-lai`, pooled `joint` is 38/40 → 37/40 (sonnet) and 40/40 → 39/40 (opus). The other four cases match within one run; no safety grader regressed. This is the risk named in Known limits (the removed Ask Back example).
- Review: code-auditor PASS (digests, 10 clean cells, options equal to the goc cells, saved comparison byte-equal to a fresh run, the 11 REGRESS lines recounted independently from `result.json`).
