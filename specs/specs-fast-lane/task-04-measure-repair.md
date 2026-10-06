# Task 04 — The repair is measured and compared

Status: blocked
Blocker: promoted only together with task 03 (plan D-04).

## Outcome
The `lean-fl-sau-<case>-<model>` cells of plan D-06 are complete. They are compared with their baselines using `evals/lean/compare.mjs --skill specs --base <prefix> --after lean-fl-sau-`.

## Scope
- In: the cells.
- Out: any edit.

## Coverage
- CP-04

## Ownership
- Create: `evals/results/specs/lean-fl-sau-*` (gitignored)

## Steps
1. Run the task 02 Step 1 guards, with these values:
   - the specs and develop skill digests printed in the task 03 Receipt;
   - the `evals/specs` digest printed in the task 02 Receipt.
2. Run the D-06 cells in two lanes, each with `host.txt` and `loaded.txt`.
3. Run the Command. It compares the failing cases against `lean-fl-goc-`, `dung-o-c1` and `sua-nho-lam-luon` against `lean-sau-`, and `mo-ho-du-cua` against `lean-fl-goc-`.

## Acceptance
- AC-04: every D-06 cell is clean; each compare prints `regress=<k> host-drift=<h>` and exits 0.

## Dependencies
- task-03-repair-surface.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && for d in evals/results/specs/lean-fl-sau-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; node -e 'const r=require("./'"$d"'/result.json");process.exit(r.partial===false&&r.cases[0].arms.with.every(x=>!x.error||/maximum number of turns/.test(x.error))?0:1)' || { echo "unclean: $d"; exit 1; }; [ -s $d/loaded.txt ] || exit 1; done && echo cells-clean && all=$(ls -d evals/results/specs/lean-fl-sau-* | sed 's|.*/lean-fl-sau-||;s|-lan1$||' | sort -u) && g=$(printf '%s\n' "$all" | grep -E '^(dung-o-c1|sua-nho-lam-luon)-' | paste -sd, -) && f=$(printf '%s\n' "$all" | grep -vE '^(dung-o-c1|sua-nho-lam-luon)-' | paste -sd, -) && node evals/lean/compare.mjs --skill specs --base lean-fl-goc- --after lean-fl-sau- --cells "$f" && node evals/lean/compare.mjs --skill specs --base lean-sau- --after lean-fl-sau- --cells "$g" && node evals/lean/budget.mjs spent --skills specs --cap 90`
- Named probe: the cells; `compare.mjs` twice.
- Reachability: `compare.mjs` reads `evals/results/specs/<base prefix>*` and `lean-fl-sau-*`.
- Oracle: `cells-clean`, two `regress=<k> host-drift=<h>` lines, exit 0.
- Counterexample: a partial cell or a missing baseline makes the Command exit 1.
- Artifacts: result directories (gitignored).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
