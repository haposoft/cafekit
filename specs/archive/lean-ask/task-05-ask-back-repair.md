# Task 05 — The lean ask asks back on a broad question again

Status: done

## Outcome
`ask/SKILL.md` gains one standard line that makes a question naming no aspect or target ("Is this system stable?") ask back before gathering evidence, ahead of the cautious-answer rule; the self-test pins it; the repaired lean skill is measured in the same 10 cells as `evals/results/ask/lean-sau2-<case>-<model>` and compared with the goc cells in `specs/lean-ask/compare-ask2.txt`.

## Scope
- In: one line in `## Standards` (≤110 lines total), its pin, `compare.mjs --after <prefix>` (default `lean-sau-`), 10 paid cells (no pilots: the loading path is unchanged), the comparison file.
- Out: any other skill text, the gate, frontmatter, `evals/ask`, `evals/run.sh`; the first lean cells `lean-sau-*` (kept as the record of the failure).

## Coverage
- CP-01, CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/ask/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `evals/lean/compare.mjs`
- Create: `evals/results/ask/lean-sau2-*` (gitignored), `specs/lean-ask/compare-ask2.txt`

## Steps
1. In `## Standards`, before "Answer directly when", add: "**Broad questions.** When the question names no aspect or target — \"Is this system stable?\", \"Is the code good?\" — ask back before gathering evidence, offering 2-3 aspects (for example code and tests, runtime reliability, deploy readiness), even when a cautious answer would be possible." Pin "ask back before gathering evidence" and "names no aspect or target" in the ask self-test entry.
2. `compare.mjs`: `--after <prefix>` sets the after-side prefix (default `lean-sau-`); self-test that `--after lean-sau2-` reads those cells.
3. Run the full self-test (`[skill-test] PASS`).
4. Record the repaired ask digest; run the 10 cells as task 02 Steps 1–2 and 4 with names `lean-sau2-<case>-<model>`, guarding on that digest; then `node evals/lean/compare.mjs --skill ask --after lean-sau2- > specs/lean-ask/compare-ask2.txt`.
5. Run the Command.

## Acceptance
- AC-05: ≤110 lines; both phrases pinned; self-test PASS; 10 `lean-sau2-*` cells clean and loaded 10/10; `compare-ask2.txt` equals a fresh run and ends with `regress= host-drift=`; spend within the ask cap (raised by the user's decision only if needed).

## Dependencies
- task-04-measure-lean.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-ask/task-04-measure-lean.md && f=packages/spec/src/claude/skills/ask/SKILL.md && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 110 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && grep -qF 'ask back before gathering evidence' $f && grep -qF 'names no aspect or target' $f && n=0 && for d in evals/results/ask/lean-sau2-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/c.txt && cmp $t/c.txt specs/lean-ask/compare-ask2.txt && tail -1 specs/lean-ask/compare-ask2.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills ask --cap 60 && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'`
- Named probe: the two phrases; saved `loaded.txt`; `compare.mjs --after lean-sau2-` byte-equal to the saved file; `budget.mjs spent`; the full self-test.
- Reachability: as tasks 02 and 03.
- Oracle: `lines=<n>` ≤110, `cells=10`, one `regress=<k> host-drift=<h>` line, `budget: spent=<x> cap=60`, `[skill-test] PASS`, exit 0; the comparison values are read at GATE-DONE.
- Counterexample: a missing phrase, a missing or not-loaded cell, a comparison that differs from a fresh run, or a failing self-test makes the Command exit 1.
- Artifacts: `compare-ask2.txt` (tracked); result directories (gitignored).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-ask/task-04-measure-lean.md && f=packages/spec/src/claude/skills/ask/SKILL.md && l=$(wc -l < $f | tr -d ' ') && { [ "$l" -le 110 ] || { echo "too long: $l"; exit 1; }; } && echo "lines=$l" && grep -qF 'ask back before gathering evidence' $f && grep -qF 'names no aspect or target' $f && n=0 && for d in evals/results/ask/lean-sau2-*; do case "$d" in *-lan1) continue;; esac; [ -d "$d-lan1" ] && d="$d-lan1"; tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; [ -s "$d/host.txt" ] || { echo "host: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 10 ] && echo "cells=$n" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/c.txt && cmp $t/c.txt specs/lean-ask/compare-ask2.txt && tail -1 specs/lean-ask/compare-ask2.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && node evals/lean/budget.mjs spent --skills ask --cap 60 && cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS'
Exit: 0
Base: 5f5d745cad94c751727c5cd14247a428d48a125e
Head: b394ae37f0977a6a3ede8e056039ef0ab8f52e8ada96f3eaf0bf146dff27723b
```text
lines=104
cells=10
regress=3 host-drift=0
budget: spent=29.4384 cap=60
[skill-test] PASS: 1603 tests executed
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before the edit the Command stopped at the missing `ask back before gathering evidence` phrase (exit 1).
- Change: one `**Broad questions.**` line in `## Standards` before "Answer directly" (102 → 104 lines); two pins added; `compare.mjs --after <prefix>` (default `lean-sau-`; packet-1 and the first lean-ask comparisons reproduce byte-equal; invalid prefixes exit 2).
- Paid runs: 10 cells `lean-sau2-*` in two lanes, each `partial=false`, 10 runs, 0 errored or skipped, `loaded=10/10`, host 2.1.289; repaired ask digest `3241d59916eb3831` guarded on every invocation. Packet spend $29.4384 of $60.
- Result (read at GATE-DONE): `hoi-lai`, `mot-cau-hoi` and `joint` back to 10/10 in both models. `regress=3`: `khong-co-bang-chung-opus` `khong-tim-thay` and `joint` 10 → 8 are grader false negatives (both failing answers correctly say there is no database, phrased "không cho thấy…" / "không được lưu", which the regex does not list); `hoi-lai-sonnet` `co-confidence` 2 → 0 matches asking back before gathering evidence.
- Review: code-auditor PASS (placement, pins, `--after` default and validation, digest, clean cells, options equal to goc; the two opus traces read).
