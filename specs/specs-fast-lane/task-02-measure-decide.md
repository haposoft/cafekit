# Task 02 — The current skill is measured on five cases and the decision is printed

Status: done

## Outcome
- Ten cells `evals/results/specs/lean-fl-goc-<case>-<model>` are complete, per plan D-02 and D-03.
- `evals/specs/fast-lane-decision.mjs` prints the pre-registered D-04 decision.

## Scope
- In: the cells; the decision script.
- Out: any skill edit.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/specs/lean-fl-goc-*` (gitignored), `evals/specs/fast-lane-decision.mjs`
- Read: `evals/results/specs/lean-re-mo-ho-*`, `evals/run.sh`, `evals/lean/{budget,loaded}.mjs`

## Steps
1. Before every invocation, run the guards with the digest command:
   - the specs skill digest is `83ca3a0fb61de67b`;
   - the brainstorm digest is `3b5ee008aaa94d05`;
   - the develop skill digest and the `evals/specs` digest equal the `digest` lines printed in the task 01 Receipt;
   - `run.sh` and node match.

   Then run `node evals/lean/budget.mjs check <c> --skills specs --cap 90`.
2. Run the 10 cells in two lanes. Give each cell `host.txt` and `loaded.txt`, and copy every run's trace to `evals/results/specs/_traces/<cell>/`.
3. After every cell has finished, write `fast-lane-decision.mjs`. It must not exist earlier, because it lives in the directory the guards hash.
   - It prints the per-model D-04 lines `over-routing=…`, `develop-blocked=…` and `mo-ho-drop=…`, with their counts.
   - It exits 1 when a cell is missing or partial.
4. Run the Command.

## Acceptance
- AC-02:
  - there are 10 cells, each `partial=false`, with 10 runs and no error other than the turn cap;
  - every `host.txt` holds one version, and all are equal;
  - `loaded.txt` exists for each cell;
  - the decision lines are printed with exit 0;
  - spending stays within the cap;
  - the Command prints the `evals/specs` digest for task 04.

## Dependencies
- task-01-new-cases.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && n=0 && hosts="" && for c in lam-thang-doi-ten lam-thang-xoa-module develop-auth mo-ho-c1 mo-ho-du-cua; do for m in sonnet opus; do d=evals/results/specs/lean-fl-goc-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;process.exit(r.partial===false&&w.length===10&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; hosts="$hosts$(cat $d/host.txt)"$'\n'; n=$((n+1)); done; done && [ "$n" = 10 ] && echo "cells=$n" && [ "$(printf '%s' "$hosts" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')" = 1 ] && echo one-host && node evals/specs/fast-lane-decision.mjs && node evals/lean/budget.mjs spent --skills specs --cap 90 && echo "digest evals/specs=$( (cd evals/specs && find . -type f ! -name .DS_Store ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16)"`
- Named probe: the cells; the decision script.
- Reachability: `evals/run.sh specs` writes to `evals/results/specs/<out>`.
- Oracle: all of these, with exit 0:
  - `cells=10`, `one-host`;
  - the decision lines;
  - `budget: … cap=90`;
  - a `digest` line.
- Counterexample: the Command exits 1 on any of these:
  - a missing, partial or errored cell;
  - mixed hosts;
  - a failing decision script.
- Artifacts: result directories and `_traces` (gitignored); the decision script (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && n=0 && hosts="" && for c in lam-thang-doi-ten lam-thang-xoa-module develop-auth mo-ho-c1 mo-ho-du-cua; do for m in sonnet opus; do d=evals/results/specs/lean-fl-goc-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;process.exit(r.partial===false&&w.length===10&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; hosts="$hosts$(cat $d/host.txt)"$'\n'; n=$((n+1)); done; done && [ "$n" = 10 ] && echo "cells=$n" && [ "$(printf '%s' "$hosts" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')" = 1 ] && echo one-host && node evals/specs/fast-lane-decision.mjs && node evals/lean/budget.mjs spent --skills specs --cap 90 && echo "digest evals/specs=$( (cd evals/specs && find . -type f ! -name .DS_Store ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16)"
Exit: 0
Base: 0478881859422ba396e0318225ad899bc9a020de
Head: d332f6d7dda0caea5aed85f94abce9f273ce811b0e9b9d404418fa242d9bd30d
```text
cells=10
one-host
direct model=sonnet lam-thang-doi-ten=10/10 lam-thang-xoa-module=10/10 direct-done=20/20 over-routing=no
develop model=sonnet src-writes=9/10 blocked=0 specs=0 turncap=0 wrongly-stopped=1 develop-blocked=no
mo-ho model=sonnet case=mo-ho-c1 co-goi-skill=10→10 co-marker=10→10 khong-code=10→10 khong-tu-chot=9→10 mot-cau-hoi-c1=10→10
mo-ho model=sonnet case=mo-ho-du-cua da-goi-brainstorm=0→0 da-goi-mot-skill=9→10 da-goi-specs=9→10 khong-code=10→10 khong-tu-chot=8→8
direct model=opus lam-thang-doi-ten=10/10 lam-thang-xoa-module=10/10 direct-done=20/20 over-routing=no
develop model=opus src-writes=10/10 blocked=0 specs=0 turncap=0 wrongly-stopped=0 develop-blocked=no
mo-ho model=opus case=mo-ho-c1 co-goi-skill=10→10 co-marker=10→10 khong-code=10→10 khong-tu-chot=9→10 mot-cau-hoi-c1=10→10
mo-ho model=opus case=mo-ho-du-cua da-goi-brainstorm=0→0 da-goi-mot-skill=10→10 da-goi-specs=10→10 khong-code=10→10 khong-tu-chot=9→8
over-routing=no
develop-blocked=no
mo-ho-drop=none
budget: spent=62.3789 cap=90
digest evals/specs=561618b7159f8ca6
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: not run before the cells, because the Command reads paid-run artifacts. With no `lean-fl-goc-*` cell, the first cell check fails (`unclean: …`).
- Paid runs: 10 cells in two lanes. Every cell is `partial=false`, with 10 runs and no errored or turn-capped run, host `2.1.289 (Claude Code)` before and after, all traces copied, and no `-lan1`.
- Guards ran before every invocation: specs `83ca3a0fb61de67b`, brainstorm `3b5ee008aaa94d05`, develop `595d40e006903524`, `evals/specs` `5db5eb8f4e840f9e`, the `evals/run.sh` sha256 and node v22.23.3. `fast-lane-decision.mjs` was placed only after the last cell finished (14:07:54 vs 14:07:33).
- Spend for this task: $14.55. Budget: $62.3789 of $90.
- Decision (D-04): `over-routing=no` (direct-done 20/20 in both models), `develop-blocked=no`, `mo-ho-drop=none`.
  - Sonnet `develop-auth` run 7 implemented through Bash (`cat > src/google-login.js`). It is counted as wrongly stopped (1 of the threshold 3), so the true count is 0.
  - Develop loaded 10/10 in both models (`loaded.mjs develop`).
  - Tasks 03 and 04 stay `blocked`.
- Review: code-auditor PASS. It recomputed the counts independently from the traces and they match. Its three Low notes are all addressed: the Bash-write and loaded notes are recorded in plan Known limits, and the turns field is an observation only.
