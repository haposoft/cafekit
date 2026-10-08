# Task 02 — The flaky packet is budgeted

Status: done

## Outcome
`budget.mjs --packet flaky` budgets the `ondinh-*` cells per plan D-03; every other packet behaves as before.

## Scope
- In: the `flaky` packet in `budget.mjs` and its self-tests.
- Out: graders; `compare.mjs`; paid runs.

## Coverage
- CP-02

## Ownership
- Modify: `evals/test/budget.mjs`

## Steps
1. A `flaky` packet: `result.json` under any directory whose basename starts with `ondinh-`, at any depth; `_kept/ondinh/**/*.lost.json`; cases `thuong-sach`, `chap-chon`; floor sonnet 4, opus 4; `cells: 2`.
2. Self-tests: it counts `ondinh-*` at any depth (incl. `_capped/`, `-lan1`, nested) and `_kept/ondinh/` lost files and nothing else (`rong-*`, `sau-*`, `pilot-*`, `xondinh-*`, `_kept/rong/`); the ceiling over the two cases' pilots with the floor; `fits` over two cells; the other packets' outputs unchanged.
3. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-02 (the pinned spends are a fixed point, plan Known limits): the self-tests pass; the hard, repair and coverage packets' spend is unchanged; the flaky spend equals an independent sum; the Command prints `evals-test-digest:`.

## Dependencies
- none

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in budget compare save-runs check-payload; do node evals/test/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && [ "$(node evals/test/budget.mjs --packet hard spent)" = "spent=13.2406 cap=100" ] && [ "$(node evals/test/budget.mjs --packet repair spent)" = "spent=20.0158 cap=100" ] && [ "$(node evals/test/budget.mjs --packet coverage spent)" = "spent=8.7061 cap=100" ] && echo "earlier packet spend: unchanged" && [ "$(node evals/test/budget.mjs --packet flaky ceiling sonnet)" = 4 ] && [ "$(node evals/test/budget.mjs --packet flaky ceiling opus)" = 4 ] && echo "ceilings: sonnet=4 opus=4" && c=$(node evals/test/budget.mjs --packet flaky spent) && x=$(node -e "const fs=require(\"fs\"),p=require(\"path\");let t=0;const w=(d,c,k)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f,c||e.name.startsWith(\"ondinh-\"),k||(e.name===\"ondinh\"&&p.basename(d)===\"_kept\"));else if((e.name===\"result.json\"&&c)||(e.name.endsWith(\".lost.json\")&&k))t+=Number(JSON.parse(fs.readFileSync(f,\"utf8\")).costUsd);}};w(\"evals/results/test\",false,false);console.log(\"spent=\"+Number(t.toFixed(4))+\" cap=100\")") && [ "$c" = "$x" ] && echo "flaky spend: $c, equal to an independent sum" && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'`
- Named probe: the four self-tests; the checker; the earlier packets' spend; both ceilings
- Reachability: known — task 03 calls `budget.mjs --packet flaky`
- Oracle: the Command exits 0, prints `earlier packet spend: unchanged`, `ceilings: sonnet=4 opus=4` (the floor; the current pilots give less) and `flaky spend: … equal to an independent sum`
- Counterexample: a `flaky` packet counting `rong-*` or `sau-*` cells, or another packet's spend moving, makes a self-test or the Command fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in budget compare save-runs check-payload; do node evals/test/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && [ "$(node evals/test/budget.mjs --packet hard spent)" = "spent=13.2406 cap=100" ] && [ "$(node evals/test/budget.mjs --packet repair spent)" = "spent=20.0158 cap=100" ] && [ "$(node evals/test/budget.mjs --packet coverage spent)" = "spent=8.7061 cap=100" ] && echo "earlier packet spend: unchanged" && [ "$(node evals/test/budget.mjs --packet flaky ceiling sonnet)" = 4 ] && [ "$(node evals/test/budget.mjs --packet flaky ceiling opus)" = 4 ] && echo "ceilings: sonnet=4 opus=4" && c=$(node evals/test/budget.mjs --packet flaky spent) && x=$(node -e "const fs=require(\"fs\"),p=require(\"path\");let t=0;const w=(d,c,k)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f,c||e.name.startsWith(\"ondinh-\"),k||(e.name===\"ondinh\"&&p.basename(d)===\"_kept\"));else if((e.name===\"result.json\"&&c)||(e.name.endsWith(\".lost.json\")&&k))t+=Number(JSON.parse(fs.readFileSync(f,\"utf8\")).costUsd);}};w(\"evals/results/test\",false,false);console.log(\"spent=\"+Number(t.toFixed(4))+\" cap=100\")") && [ "$c" = "$x" ] && echo "flaky spend: $c, equal to an independent sum" && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'
Exit: 0
Base: 0920a6171805ca51bf4662fdc803f7b5f437b40e
Head: 9bcbe289ec3a2ded5f1e627b17d0e459ef640cf5b043e38ee72ba11a172af951
```text
budget self-test: ok
compare self-test: ok
save-runs self-test: ok
check-payload self-test: ok
checker: ok
earlier packet spend: unchanged
ceilings: sonnet=4 opus=4
flaky spend: spent=5.0347 cap=100, equal to an independent sum
evals-test-digest: 665f43c7cdd9007e22919fadf003cceea3c965e63ac15f176d8c1b065ef0c2f3
```

Fresh code-auditor review: PASS (the flaky packet matches D-03; the six self-test sums re-derived; no cross-packet counting; ceiling, reserve, check, fits and spent work on the real tree; 3 Low notes: the floor equals ceilingOf's own minimum, the stale usage line, the predicate sees every path segment). Re-run at the final-Head fixed point.
