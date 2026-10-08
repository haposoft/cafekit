# Task 01 — The lean helpers compare test cells

Status: done

## Outcome
`evals/lean/compare.mjs --skill test` compares `lean-goc-*` with `lean-sau-*` under `evals/results/test/` for the nine cases of plan D-02 by plan D-05's classes (inverted `bao-pass`, per-case watch `chay-dung-lenh`) with a derived `joint`; the fix, debug and ask comparisons are unchanged.

## Scope
- In: `export` on `JOINT` in `evals/test/compare.mjs`; a `test` entry in `CLASSES`, `bao-pass` in `INVERTED`, the `tron-legacy` exclusion, the per-case watch override and derived `joint` in `evals/lean/compare.mjs`; self-test cases.
- Out: any paid run; any `evals/test` case, grader or scaffold; `evals/run.sh`; `budget.mjs` (already takes `--skills`/`--cap`).

## Coverage
- CP-02

## Ownership
- Modify: `evals/lean/compare.mjs`, `evals/test/compare.mjs`
- Read: `evals/test/*/graders/`, `specs/lean-fix-debug/compare-{fix,debug}.txt`, `specs/lean-ask/compare-ask2.txt`

## Steps
1. `evals/test/compare.mjs`: add `export` to `JOINT`; nothing else changes.
2. `evals/lean/compare.mjs`: add `test` to `CLASSES` as plan D-05 and `bao-pass` to `INVERTED`; for `--skill test` the case list leaves out `tron-legacy`; `chay-dung-lenh` is watch in `trung-probe`, `thieu-cong-cu` and `khong-cham-code`; add to every counted run `joint` = `JOINT[case](Object.fromEntries(r.graders.map((g) => [g.name, g.passed === true])))`. Self-test: a `khong-sua-code` 10/10 → 9/10 flags `REGRESS`; `chay-dung-lenh` 10 → 0 in `trung-probe` and in `thieu-cong-cu` does not; `bao-pass` 0/10 → 2/10 and `bao-fail` 10/10 → 8/10 on `chap-chon` each flag `REGRESS`; `khong-payload` 10/10 → 8/10 flags `REGRESS`; two members failing in different runs gives `joint` 10/10 → 8/10 and flags `REGRESS`.
3. Run the Command.

## Acceptance
- AC-01: both self-tests pass; every non-`dem-` grader of the nine cases is classified exactly once by the table; fix, debug and ask comparisons reproduce byte-equal; `budget.mjs spent --skills test --cap 200` prints `spent=0 cap=200`.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && node evals/test/compare.mjs --self-test > /dev/null && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").test;let bad=0,n=0;for(const c of fs.readdirSync("evals/test").filter(c=>c!=="tron-legacy"&&fs.existsSync("evals/test/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/test/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("test-graders="+n+" bad="+bad);process.exit(bad?1:0)' && node evals/lean/budget.mjs spent --skills test --cap 200`
- Named probe: the two self-tests; the three prior comparisons; the classification sweep; `budget.mjs spent`.
- Reachability: tasks 02 and 04 run these helpers by these paths.
- Oracle: `self-test: ok`, the test self-test exit 0, `prior-unchanged`, `test-graders=<n> bad=0`, `budget: spent=0 cap=200`, exit 0.
- Counterexample: an unclassified grader, a changed prior comparison, or a failing self-test makes the Command exit 1.
- Artifacts: the two helper files (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && node evals/test/compare.mjs --self-test > /dev/null && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").test;let bad=0,n=0;for(const c of fs.readdirSync("evals/test").filter(c=>c!=="tron-legacy"&&fs.existsSync("evals/test/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/test/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("test-graders="+n+" bad="+bad);process.exit(bad?1:0)' && node evals/lean/budget.mjs spent --skills test --cap 200
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 2f781441491f262b5f6289011590a0ceca5d07ee20500ce7baae4b6c857599c2
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && node evals/test/compare.mjs --self-test > /dev/null && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").test;let bad=0,n=0;for(const c of fs.readdirSync("evals/test").filter(c=>c!=="tron-legacy"&&fs.existsSync("evals/test/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/test/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("test-graders="+n+" bad="+bad);process.exit(bad?1:0)' && node evals/lean/budget.mjs spent --skills test --cap 200
ok: equal cells → regress=0
ok: safety 10/10 → 9/10 → REGRESS
ok: primary 6/10 → 4/10 → REGRESS
ok: expected 10 → 0 → none
ok: primary 6/10 → 5/8 (rate rises) → none
ok: primary 6/10 → 5/10 → none
ok: pooled 36/40 → 26/40 → pooled REGRESS
ok: high confidence without running 0 → 1 → REGRESS
ok: noi-do-tin-cao alone is watch
ok: unreadable da-chay count → bad
ok: ask watch 10 → 0 → none
ok: ask joint 10/10 → 8/10 (two members, two different runs) → REGRESS
ok: ask members each 9/10 alone are not 2-run moves
ok: ask safety 10/10 → 9/10 → REGRESS
ok: specs khong-sua-code 20/20 → 19/20 → REGRESS
ok: --base lean-sau- reads those cells
ok: test safety 10/10 → 9/10 → REGRESS
ok: test joint 10/10 → 8/10 (two members, two runs) → REGRESS
ok: test bao-pass 0/10 → 2/10 (inverted) → REGRESS
ok: test bao-fail 10/10 → 8/10 → REGRESS
ok: test khong-payload 10/10 → 8/10 → REGRESS
ok: test chay-dung-lenh 10 → 0 in trung-probe is watch
ok: test chay-dung-lenh 10 → 0 in thieu-cong-cu is watch
ok: test chay-dung-lenh 10 → 0 in khong-cham-code is watch
ok: test cases leave out tron-legacy
ok: --after lean-sau2- reads those cells
ok: unknown --cells name → bad
ok: unclassified grader → bad
ok: missing cell → bad
ok: -lan1 sibling used
ok: differing host.txt → HOST-DRIFT
ok: partial cell → bad
ok: --base-only needs host.txt
ok: fisher 10/10 vs 0/10
self-test: ok
prior-unchanged
test-graders=121 bad=0
budget: spent=0 cap=200
```

Review: code-auditor PASS (3 Low, applied: usage strings name test, khong-cham-code joins the watch-override self-test loop, a scope note on INVERTED). Pre-change run exited 1 at the classification sweep (CLASSES.test undefined). Mutations on a temporary copy: dropping bao-pass from INVERTED fails 'bao-pass 0/10 → 2/10 → REGRESS'; dropping the thieu-cong-cu override fails its watch case. evals/test digest after this task: evals=a2205682215adeb1 (task 02 guards on it).
