# Task 05 — The lean develop skill asks for fenced Receipt output

Status: done

## Outcome
`develop/SKILL.md` says the Receipt's current output goes in a fenced block, the self-test pins that phrase, and the repaired skill is measured in the same 4 cells as `evals/results/develop/lean-sau2-<case>-<model>`, compared with the goc cells in `specs/lean-develop/compare-develop2.txt`.

## Scope
- In: the phrase "non-empty current output" becomes "non-empty current output in a fenced block" in `SKILL.md` (no other word changes; the line count stays ≤125); one self-test pin; pilots and the 4 paid cells; the comparison file.
- Out: any other skill text; `references/*`; `evals/develop`; the first lean cells `lean-sau-*` (kept as the record).

## Coverage
- CP-01, CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Create: `evals/results/develop/lean-sau2-*`, `evals/results/develop/lean-pilot-sau2-*` (gitignored), `specs/lean-develop/compare-develop2.txt`

## Steps
1. Edit the phrase; add a self-test pin requiring "non-empty current output in a fenced block" in the develop skill; run the full self-test (`[skill-test] PASS`).
2. Record the repaired skill digest (`skill=<16 hex>`); run the 1-run sonnet pilot on `mot-task-sach` and the 4 cells exactly as task 04 with names `lean-sau2-…` and that digest, each with its evidence files in the same step.
3. `node evals/lean/compare.mjs --skill develop --after lean-sau2- > specs/lean-develop/compare-develop2.txt`.
4. Run the Command.

## Acceptance
- AC-05: the phrase present once and pinned; ≤125 lines; self-test PASS; 4 `lean-sau2-*` cells loaded 10/10 with 0 errored runs and the repaired digest; `compare-develop2.txt` equals a fresh run and ends with `regress= host-drift=`.

## Dependencies
- task-04-measure-lean.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-04-measure-lean.md && f=packages/spec/src/claude/skills/develop/SKILL.md && [ "$(grep -c 'non-empty current output in a fenced block' $f)" = 1 ] && l=$(wc -l < $f | tr -d ' ') && [ "$l" -le 125 ] && echo "lines=$l" && dg=$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16) && n=0 && for d in evals/results/develop/lean-sau2-*; do tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; grep -qx "skill=$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node -e 'const r=require(require("path").resolve(process.argv[1],"result.json"));process.exit(r.cases[0].arms.with.some(x=>x.error)?1:0)' "$d" || { echo "errored: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n skill=$dg" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill develop --after lean-sau2- > $t/c.txt && cmp $t/c.txt specs/lean-develop/compare-develop2.txt && tail -1 specs/lean-develop/compare-develop2.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && (cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS')`
- Named probe: the phrase count; line count; per-cell loaded, digest and error checks; `compare.mjs --after lean-sau2-` byte-equal to the saved file; the full self-test.
- Reachability: `evals/run.sh develop` copies `skills/develop` into the plugin under test.
- Oracle: `lines=<n>` ≤125, `cells=4 skill=<hex>`, one `regress=<k> host-drift=<h>` line, `[skill-test] PASS`, exit 0; the comparison values are read at GATE-DONE.
- Counterexample: the phrase missing or doubled, a cell on other bytes, an errored or under-loaded cell, or a comparison that differs from a fresh run makes the Command exit 1.
- Artifacts: `compare-develop2.txt` (tracked); result directories (gitignored).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-04-measure-lean.md && f=packages/spec/src/claude/skills/develop/SKILL.md && [ "$(grep -c 'non-empty current output in a fenced block' $f)" = 1 ] && l=$(wc -l < $f | tr -d ' ') && [ "$l" -le 125 ] && echo "lines=$l" && dg=$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16) && n=0 && for d in evals/results/develop/lean-sau2-*; do tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; grep -qx "skill=$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node -e 'const r=require(require("path").resolve(process.argv[1],"result.json"));process.exit(r.cases[0].arms.with.some(x=>x.error)?1:0)' "$d" || { echo "errored: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n skill=$dg" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill develop --after lean-sau2- > $t/c.txt && cmp $t/c.txt specs/lean-develop/compare-develop2.txt && tail -1 specs/lean-develop/compare-develop2.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && (cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS')
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 46d752cafc081dc7251d8ac60686d8da92701c25f954d0498061211a3c74c370
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && grep -q '^Status: done' specs/lean-develop/task-04-measure-lean.md && f=packages/spec/src/claude/skills/develop/SKILL.md && [ "$(grep -c 'non-empty current output in a fenced block' $f)" = 1 ] && l=$(wc -l < $f | tr -d ' ') && [ "$l" -le 125 ] && echo "lines=$l" && dg=$(cd packages/spec/src/claude/skills/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16) && n=0 && for d in evals/results/develop/lean-sau2-*; do tail -1 "$d/loaded.txt" | grep -q ' loaded=10/10 ' || { echo "not loaded: $d"; exit 1; }; grep -qx "skill=$dg" "$d/skill-digest.txt" || { echo "digest: $d"; exit 1; }; node -e 'const r=require(require("path").resolve(process.argv[1],"result.json"));process.exit(r.cases[0].arms.with.some(x=>x.error)?1:0)' "$d" || { echo "errored: $d"; exit 1; }; n=$((n+1)); done && [ "$n" = 4 ] && echo "cells=$n skill=$dg" && t=$(mktemp -d) && node evals/lean/compare.mjs --skill develop --after lean-sau2- > $t/c.txt && cmp $t/c.txt specs/lean-develop/compare-develop2.txt && tail -1 specs/lean-develop/compare-develop2.txt | grep -E '^regress=[0-9]+ host-drift=[0-9]+$' && (cd packages/spec && node scripts/run-skill-self-tests.mjs 2>&1 | grep -E 'skill-test\] PASS')
lines=121
cells=4 skill=124b7151c62d0f73
regress=0 host-drift=0
[skill-test] PASS: 1351 tests executed
```

Pre-change run exited 1 at the phrase count. One phrase added ('in a fenced block'); the develop pin entry now requires it and gains an 'unfenced' mutation; full self-test PASS 1351. Repaired skill=124b7151c62d0f73, still 121 lines. Pilot (sach sonnet 1/1) and 4 cells loaded 10/10, 0 errored runs, git-check empty. compare-develop2.txt against the goc cells: regress=0; mot-task-sach opus receipt-day-du and joint 9/10 → 10/10 (first lean 5/10, rerun 3/10); every other grader equal or better.
