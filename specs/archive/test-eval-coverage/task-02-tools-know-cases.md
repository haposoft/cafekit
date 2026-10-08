# Task 02 — The tools know the cases

Status: done

## Outcome
`compare.mjs` knows the joint members and watch graders of the three cases (plan D-02), and `budget.mjs --packet coverage` budgets this packet (plan D-03); every existing cell and packet behaves as before.

## Scope
- In: the two tools and their self-tests.
- Out: graders; paid runs.

## Coverage
- CP-02

## Ownership
- Modify: `evals/test/compare.mjs`, `evals/test/budget.mjs`
- Read: `evals/test/check-fixtures.sh`

## Steps
1. `compare.mjs`: cases `thuong-sach`, `thuong-do` (joint = verdict, `chay-test`, the no-change graders) and `chap-chon` (joint = `chay-test` and the no-change graders); watch `khong-payload`, `khong-json`, `bao-pass`, `bao-fail`, `bao-blocked`, `chay-lai`, `bao-pww` per case; self-tests for each, one that each new case's joint members plus watch graders equal exactly the files in `evals/test/<case>/graders/`, and one that an existing case's output is unchanged.
2. `budget.mjs`: a `coverage` packet per plan D-03; self-tests that it counts `rong-*` and its pilots at any depth and nothing else, and that the other packets are unchanged.
3. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-02: the self-tests pass; `compare.mjs --base base- --base-only` output on the baseline cells is unchanged; the Command prints `evals-test-digest:`.

## Dependencies
- task-01-three-ordinary-cases.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in compare budget save-runs check-payload; do node evals/test/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && [ "$(node evals/test/compare.mjs --base base- --base-only | shasum -a 256 | cut -d" " -f1)" = 8e371740a57d36f148efa9a92214db332521e5ec7cee18465467e9fc3e96189c ] && [ "$(node evals/test/compare.mjs --base kho- --base-only --cells tron-legacy-sonnet,tron-legacy-opus,trung-probe-sonnet,trung-probe-opus,khong-cham-code-sonnet,khong-cham-code-opus | shasum -a 256 | cut -d" " -f1)" = e7cce8a1bfdddc8348791031b9719cf9cf644989ca772ce9c6e126237ba80529 ] && echo "earlier compare output: unchanged" && [ "$(node evals/test/budget.mjs --packet hard spent)" = "spent=13.2406 cap=100" ] && [ "$(node evals/test/budget.mjs --packet repair spent)" = "spent=20.0158 cap=100" ] && echo "earlier packet spend: unchanged" && c=$(node evals/test/budget.mjs --packet coverage spent) && x=$(node -e "const fs=require(\"fs\"),p=require(\"path\");let t=0;const re=/^(rong-|pilot-(thuong-sach|thuong-do|chap-chon)-)/;const w=(d,c,k)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f,c||re.test(e.name),k||(e.name===\"rong\"&&p.basename(d)===\"_kept\"));else if((e.name===\"result.json\"&&c)||(e.name.endsWith(\".lost.json\")&&k))t+=Number(JSON.parse(fs.readFileSync(f,\"utf8\")).costUsd);}};w(\"evals/results/test\",false,false);console.log(\"spent=\"+Number(t.toFixed(4))+\" cap=100\")") && [ "$c" = "$x" ] && echo "coverage spend: $c, equal to an independent sum" && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'`
- Named probe: the four self-tests; the checker; the baseline compare
- Reachability: known — tasks 03 and 04 call both tools
- Oracle: the Command exits 0 and prints `earlier compare output: unchanged`, `earlier packet spend: unchanged` and `coverage spend: spent=<x> cap=100, equal to an independent sum` (the coverage packet's own `result.json` and `_kept/rong/` lost files, within the cap)
- Counterexample: a `coverage` packet counting another packet's cells, or a joint that includes a watch grader, makes a self-test fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in compare budget save-runs check-payload; do node evals/test/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && [ "$(node evals/test/compare.mjs --base base- --base-only | shasum -a 256 | cut -d" " -f1)" = 8e371740a57d36f148efa9a92214db332521e5ec7cee18465467e9fc3e96189c ] && [ "$(node evals/test/compare.mjs --base kho- --base-only --cells tron-legacy-sonnet,tron-legacy-opus,trung-probe-sonnet,trung-probe-opus,khong-cham-code-sonnet,khong-cham-code-opus | shasum -a 256 | cut -d" " -f1)" = e7cce8a1bfdddc8348791031b9719cf9cf644989ca772ce9c6e126237ba80529 ] && echo "earlier compare output: unchanged" && [ "$(node evals/test/budget.mjs --packet hard spent)" = "spent=13.2406 cap=100" ] && [ "$(node evals/test/budget.mjs --packet repair spent)" = "spent=20.0158 cap=100" ] && echo "earlier packet spend: unchanged" && c=$(node evals/test/budget.mjs --packet coverage spent) && x=$(node -e "const fs=require(\"fs\"),p=require(\"path\");let t=0;const re=/^(rong-|pilot-(thuong-sach|thuong-do|chap-chon)-)/;const w=(d,c,k)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f,c||re.test(e.name),k||(e.name===\"rong\"&&p.basename(d)===\"_kept\"));else if((e.name===\"result.json\"&&c)||(e.name.endsWith(\".lost.json\")&&k))t+=Number(JSON.parse(fs.readFileSync(f,\"utf8\")).costUsd);}};w(\"evals/results/test\",false,false);console.log(\"spent=\"+Number(t.toFixed(4))+\" cap=100\")") && [ "$c" = "$x" ] && echo "coverage spend: $c, equal to an independent sum" && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'
Exit: 0
Base: 0c01e2281b2b8e4c7828cfac8ce0145d9c712112
Head: c20f1e46b635a674fd55dbfd1a3b48e3bdfa4631481d141a21d17de26639c3b7
```text
compare self-test: ok
budget self-test: ok
save-runs self-test: ok
check-payload self-test: ok
checker: ok
earlier compare output: unchanged
earlier packet spend: unchanged
coverage spend: spent=8.7061 cap=100, equal to an independent sum
evals-test-digest: de292251de9ec6c42ac6f7a119ee2e4599ba4e185adaff315f91a6afda63e72b
```

Fresh code-auditor review: PASS (joint and watch lists match D-02 and tie to the grader files; coverage packet per D-03). Reopened for the _kept/rong/ rename (review PASS). In task 03's grader-repair round its spent=0 check, true only before any pilot, was replaced by the user's choice with equality to an independent sum (fresh code-auditor review: PASS, mutants of the coverage packet make the sums differ). Re-run at the final-Head fixed point.
