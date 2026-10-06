# Task 02 — The current ask is measured in 10 cells

Status: done

## Outcome
Ten result directories `evals/results/ask/lean-goc-<case>-<model>` (5 cases × sonnet and opus), ten runs each, every run loaded, measured on the ask skill bytes of `c73030c` before task 03 edits anything.

## Scope
- In: 2 pilots and 10 cells in two lanes (one per model, plan D-03); `host.txt` and `loaded.txt` per directory.
- Out: any skill, case, grader or `evals/run.sh` edit.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/ask/lean-goc-*`, `evals/results/ask/lean-pilot-goc-*` (gitignored)
- Read: `evals/run.sh`, `evals/lean/*`

## Steps
1. Guard before every invocation (stop on any mismatch): directory digest (`find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`, first 16 hex) of `packages/spec/src/claude/skills/ask` = `b491b8fba7c58f27` and of `evals/ask` = `666ac4a6c0bf1221`; `shasum -a 256 evals/run.sh` starts `a75cd5b5fbe5b643`; node v22.23.3; `node evals/lean/budget.mjs check <c> --skills ask --cap 60`.
2. Each invocation as plan D-03; `claude --version` captured before and after into `<dir>/host.txt`; right after, `node evals/lean/loaded.mjs ask <dir> > <dir>/loaded.txt`.
3. Pilots (`--case co-bang-chung`): sonnet `--runs 3 --max-cost-usd 4`, opus `--runs 1 --max-cost-usd 3`, named `lean-pilot-goc-co-bang-chung-<model>`; any run not loaded, errored or partial → stop and ask the user.
4. Cells `lean-goc-<case>-<model>` for `co-bang-chung docs-lech-code khong-co-bang-chung hoi-lai cam-sua`, `--runs 10 --max-cost-usd 6`; a partial, errored or below-10-loaded cell reruns once into `<cell>-lan1` (plan D-06).
5. Run the Command.

## Acceptance
- AC-02: 10 cells complete, each `loaded=10/10`, each `host.txt` one version; `compare.mjs --skill ask --base-only` exits 0; spend within the ask cap.

## Dependencies
- task-01-ask-helpers.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-ask/task-01-ask-helpers.md && n=0 && for d in evals/results/ask/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && node evals/lean/compare.mjs --skill ask --base-only && node evals/lean/budget.mjs spent --skills ask --cap 60`
- Named probe: saved `loaded.txt` and `host.txt`; `compare.mjs --base-only`; `budget.mjs spent`.
- Reachability: `evals/run.sh` invoked from the repository root writes `evals/results/ask/<out>`.
- Oracle: `cells=10`, ten `base ok runs=10` lines, `budget: spent=<x> cap=60`, exit 0.
- Counterexample: a missing, partial or not-loaded cell, or a host change inside a cell, makes the Command exit 1.
- Artifacts: result directories (gitignored, local).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && grep -q '^Status: done' specs/lean-ask/task-01-ask-helpers.md && n=0 && for d in evals/results/ask/lean-goc-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ "$(sort -u "$d/host.txt" | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && node evals/lean/compare.mjs --skill ask --base-only && node evals/lean/budget.mjs spent --skills ask --cap 60
Exit: 0
Base: 5f5d745cad94c751727c5cd14247a428d48a125e
Head: c065838543f80efac8246428666e967cda977823c2c25a76a5685f4f07fadec0
```text
cells=10
cell=cam-sua-sonnet base ok runs=10
cell=cam-sua-opus base ok runs=10
cell=co-bang-chung-sonnet base ok runs=10
cell=co-bang-chung-opus base ok runs=10
cell=docs-lech-code-sonnet base ok runs=10
cell=docs-lech-code-opus base ok runs=10
cell=hoi-lai-sonnet base ok runs=10
cell=hoi-lai-opus base ok runs=10
cell=khong-co-bang-chung-sonnet base ok runs=10
cell=khong-co-bang-chung-opus base ok runs=10
budget: spent=9.819 cap=60
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any cell existed the Command exited 1 (`not loaded: evals/results/ask/lean-goc-*`).
- Paid runs: pilots `lean-pilot-goc-co-bang-chung-{sonnet 3/3, opus 1/1}`; 10 cells in two lanes (one per model), each `partial=false`, 10 runs, 0 errored or skipped, `loaded=10/10`, host `2.1.289 (Claude Code)` before and after; no `-lan1` rerun. Every invocation guarded the ask skill digest `b491b8fba7c58f27`, `evals/ask` `666ac4a6c0bf1221`, the `evals/run.sh` sha256 and node v22.23.3. Spend $9.819 of $60.
- Review: code-auditor PASS (empty `git diff c73030c` over the skill, the suite and the runner; suite options per D-03; spend re-summed).
