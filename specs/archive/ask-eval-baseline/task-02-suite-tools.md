# Task 02 — The suite's tools

Status: done

## Outcome
`evals/ask/{save-runs,compare,budget}.mjs`, adapted from `evals/test/`, save and check runs, compare cells with the joint members and watch lists of plan D-02, and budget the suite against $100 (plan D-03).

## Scope
- In: the three tools and their self-tests.
- Out: `evals/test/` (unchanged); paid runs.

## Coverage
- CP-02

## Ownership
- Create: `evals/ask/save-runs.mjs`, `evals/ask/compare.mjs`, `evals/ask/budget.mjs`
- Read: `evals/test/{save-runs,compare,budget}.mjs`

## Steps
1. `save-runs.mjs`: the saved parts are `readme`, `config`, `greet`, `server`, `test`, `package`, `status`, `answer`; the skill heading is `# Ask Skill`; the loaded-skill pattern matches `ask` (not `test`) and the timeout is 600 s, each with a self-test (a run whose Skill call names `cf:ask` is loaded, one naming `cf:test` is not; a 600 s run is capped); flags and the other self-tests as in `evals/test`.
2. `compare.mjs`: the five cases with their joint members and watch lists; a self-test that each case's joint members plus watch graders equal exactly its grader files, that joint needs each member, and that a watch grader never enters joint.
3. `budget.mjs`: one suite budget — every `result.json` under `evals/results/ask/` at any depth plus `_kept/**/*.lost.json`, cap $100; `ceiling` over the five cases' pilots; `fits` over five cells per model; self-tests.
4. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-02: the three self-tests and the checker pass; the spend equals an independent sum; the Command prints `evals-ask-digest:`.

## Dependencies
- task-01-five-cases.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in save-runs compare budget; do node evals/ask/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/ask/check-fixtures.sh > /dev/null && echo "checker: ok" && mkdir -p evals/results/ask && c=$(node evals/ask/budget.mjs spent) && x=$(node -e "const fs=require(\"fs\"),p=require(\"path\");let t=0;const w=(d,k)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f,k||e.name===\"_kept\");else if(e.name===\"result.json\"||(e.name.endsWith(\".lost.json\")&&k))t+=Number(JSON.parse(fs.readFileSync(f,\"utf8\")).costUsd);}};w(\"evals/results/ask\",false);console.log(\"spent=\"+Number(t.toFixed(4))+\" cap=100\")") && [ "$c" = "$x" ] && echo "ask spend: $c, equal to an independent sum" && n=$( (cd evals/ask && find . -type f ! -name .DS_Store ! -name "*.pyc" | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-ask-digest: $n"'`
- Named probe: the three self-tests; the checker; the spend
- Reachability: known — tasks 03 and 04 call the three tools
- Oracle: the Command exits 0 and prints three `self-test: ok` lines, `checker: ok` and `ask spend: … equal to an independent sum`
- Counterexample: a joint that includes a watch grader, a missing member, or a budget that skips a nested or `_capped/` cell makes a self-test or the Command fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in save-runs compare budget; do node evals/ask/$t.mjs --self-test > /dev/null || { echo "$t self-test failed"; exit 1; }; echo "$t self-test: ok"; done && bash evals/ask/check-fixtures.sh > /dev/null && echo "checker: ok" && mkdir -p evals/results/ask && c=$(node evals/ask/budget.mjs spent) && x=$(node -e "const fs=require(\"fs\"),p=require(\"path\");let t=0;const w=(d,k)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f,k||e.name===\"_kept\");else if(e.name===\"result.json\"||(e.name.endsWith(\".lost.json\")&&k))t+=Number(JSON.parse(fs.readFileSync(f,\"utf8\")).costUsd);}};w(\"evals/results/ask\",false);console.log(\"spent=\"+Number(t.toFixed(4))+\" cap=100\")") && [ "$c" = "$x" ] && echo "ask spend: $c, equal to an independent sum" && n=$( (cd evals/ask && find . -type f ! -name .DS_Store ! -name "*.pyc" | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-ask-digest: $n"'
Exit: 0
Base: 4f48b19e2e163d4942b14ed324f6fcc33c77617b
Head: f00df08fc7157dc9e172628803b1785802f25afc1166fab81006f454037283e2
```text
save-runs self-test: ok
compare self-test: ok
budget self-test: ok
checker: ok
ask spend: spent=10.535 cap=100, equal to an independent sum
evals-ask-digest: 666ac4a6c0bf122115a8b63b98126d5085b49efd886259c8df2d54da0ea96e08
```

Fresh code-auditor review: PASS after two repair rounds (round 1: the suite cap set to $100 before this Receipt under the user's 'thoải mái ngân sách', a pilot without costUsd fails ceiling, an init listing only cf:test is not loaded; round 2: a refusing fits self-test restored, tasks 03–04 say $100). Low: the independent sum walks the tree the way spent() does. The $100 cap is shown again at GATE-DONE. Re-run in task 03's grader-repair round (co-evidence and co-confidence anchored to label lines, khong-bia's names case-insensitive). Re-run at the final-Head fixed point.
