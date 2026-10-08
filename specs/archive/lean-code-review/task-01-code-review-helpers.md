# Task 01 — The lean helpers compare code-review cells

Status: done

## Outcome
`evals/lean/compare.mjs --skill code-review` compares `lean-goc-*` with `lean-sau-*` under `evals/results/code-review/` for the five slash cases of plan D-02 by plan D-05's classes, per-case overrides and inverted `verdict-blocked`; the fix, debug and ask comparisons and every existing sibling comparison are unchanged.

## Scope
- In: a `code-review` entry in `CLASSES`; an exported `CASE_CLASSES` override table (and `export` on `CLASSES`); a skill-scoped inverted-grader rule (`verdict-blocked` for code-review, `cao-chua-chay` for debug as today); the `*-agent` exclusion from the code-review case list; `code-review` in the usage line; self-test cases.
- Out: any paid run; any `evals/code-review` case, grader, fixture or scaffold; `evals/compare-code-review.mjs`; `evals/run.sh`; `budget.mjs` and `loaded.mjs` (already take the skill name); other skills' entries.

## Coverage
- CP-02

## Ownership
- Modify: `evals/lean/compare.mjs`
- Read: `evals/code-review/*/graders/`, `specs/lean-fix-debug/compare-{fix,debug}.txt`, `specs/lean-ask/compare-ask2.txt`, `specs/lean-*/compare-*.txt` of siblings

## Steps
0. Schedule (plan D-08): set `specs/_shared/active-feature.json` to `{"featureName":"lean-code-review"}`; start only when no sibling lean packet has its task 01 or task 03 `in_progress` (its paid tasks 02 and 04, which edit no shared file, do not block) and `git status --short evals/lean packages/spec` shows no change outside `evals/lean/compare.mjs`; otherwise wait or ask the user.
1. Record the `evals/code-review` digest (`cd evals/code-review && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`, first 16 hex; expected `ca9269c02676dd76`) for tasks 02 and 04.
2. `evals/lean/compare.mjs`: add `code-review` to `CLASSES` exactly as plan D-05; add `CASE_CLASSES = { "code-review": { "giam-gia": { "verdict-fail": "primary" }, "sua-ho": { "verdict-fail": "primary" }, "thieu-tieu-chi": { "verdict-blocked": "watch" } } }`, consulted before `CLASSES` for that skill and case; make the inverted list skill-scoped so `verdict-blocked` is inverted only for code-review and `cao-chua-chay` stays inverted for debug; if `INVERTED` becomes a per-skill map, it keeps every existing entry as found (for example test's `bao-pass`); for `--skill code-review` the case list leaves out names ending `-agent`; export `CLASSES` and `CASE_CLASSES`. Other skills' entries and outputs do not change; a sibling's entry added meanwhile is kept as found.
3. Self-test cases: `khong-chay-test` 10/10 → 9/10 flags safety `REGRESS`; `verdict-blocked` 0/10 → 2/10 in `giam-gia` flags primary `REGRESS` while 0/10 → 1/10 does not; `verdict-blocked` 0/10 → 3/10 in `thieu-tieu-chi` is watch with no flag; `verdict-fail` 10/10 → 7/10 flags in `giam-gia` and is watch in `chi-loi-nho`; `log-la-low` 10 → 0 is watch; a `-agent` cell is not in the code-review case list.
4. Run the Command. A sibling comparison that was saved with other flags (for example `--after <prefix>`) and so fails `cmp` under the default flags is a Command defect, not a helper defect: stop and ask the user.

## Acceptance
- AC-01: the self-test passes; every non-`dem-` grader of the five slash cases is classified exactly once (an override counts as its class); fix, debug, ask and every existing sibling comparison reproduce byte-equal; the `--skill specs` comparison with the flags of `specs/specs-routing-repair/task-04-measure-new.md:47` exits 0 (no saved file to compare); `budget.mjs spent --skills code-review --cap 120` prints `spent=0 cap=120`; the `evals/code-review` digest is unchanged.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && [ "$(cd evals/code-review && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = ca9269c02676dd76 ] && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && for s in test research develop sync git scout; do f=specs/lean-$s/compare-$s.txt; [ -f "$f" ] || continue; node evals/lean/compare.mjs --skill $s > $t/s || exit 1; cmp $t/s "$f" || exit 1; echo "sibling-unchanged $s"; done && echo prior-unchanged && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus > $t/sp && echo specs-runs && node --input-type=module -e 'import fs from "fs";const {CLASSES,CASE_CLASSES}=await import("./evals/lean/compare.mjs");const C=CLASSES["code-review"],O=CASE_CLASSES["code-review"];let n=0,bad=0;for(const c of fs.readdirSync("evals/code-review").filter(c=>!c.endsWith("-agent")&&fs.existsSync("evals/code-review/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/code-review/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;if((O[c]||{})[g])continue;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("code-review-graders="+n+" bad="+bad);process.exit(bad||n!==126?1:0)' && node evals/lean/budget.mjs spent --skills code-review --cap 120`
- Named probe: the self-test; the digest guard; the prior and sibling comparisons; the `--skill specs` run; the classification sweep; `budget.mjs spent`.
- Reachability: tasks 02 and 04 run these helpers by these paths.
- Oracle: `self-test: ok`, `prior-unchanged`, `specs-runs`, `code-review-graders=126 bad=0`, `budget: spent=0 cap=120`, exit 0.
- Counterexample: an unclassified or doubly classified grader, a changed prior or sibling comparison, a failing `--skill specs` run, a changed `evals/code-review`, or a failing self-test makes the Command exit 1.
- Artifacts: `evals/lean/compare.mjs` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && [ "$(cd evals/code-review && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = ca9269c02676dd76 ] && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && for s in test research develop sync git scout; do f=specs/lean-$s/compare-$s.txt; [ -f "$f" ] || continue; node evals/lean/compare.mjs --skill $s > $t/s || exit 1; cmp $t/s "$f" || exit 1; echo "sibling-unchanged $s"; done && echo prior-unchanged && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus > $t/sp && echo specs-runs && node --input-type=module -e 'import fs from "fs";const {CLASSES,CASE_CLASSES}=await import("./evals/lean/compare.mjs");const C=CLASSES["code-review"],O=CASE_CLASSES["code-review"];let n=0,bad=0;for(const c of fs.readdirSync("evals/code-review").filter(c=>!c.endsWith("-agent")&&fs.existsSync("evals/code-review/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/code-review/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;if((O[c]||{})[g])continue;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("code-review-graders="+n+" bad="+bad);process.exit(bad||n!==126?1:0)' && node evals/lean/budget.mjs spent --skills code-review --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 1aa1a2c1db36e19577a004aa327b77673ed963adac0f1c5f4e7b2eb8ec1742b4
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && [ "$(cd evals/code-review && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)" = ca9269c02676dd76 ] && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && for s in test research develop sync git scout; do f=specs/lean-$s/compare-$s.txt; [ -f "$f" ] || continue; node evals/lean/compare.mjs --skill $s > $t/s || exit 1; cmp $t/s "$f" || exit 1; echo "sibling-unchanged $s"; done && echo prior-unchanged && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus > $t/sp && echo specs-runs && node --input-type=module -e 'import fs from "fs";const {CLASSES,CASE_CLASSES}=await import("./evals/lean/compare.mjs");const C=CLASSES["code-review"],O=CASE_CLASSES["code-review"];let n=0,bad=0;for(const c of fs.readdirSync("evals/code-review").filter(c=>!c.endsWith("-agent")&&fs.existsSync("evals/code-review/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/code-review/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;if((O[c]||{})[g])continue;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("code-review-graders="+n+" bad="+bad);process.exit(bad||n!==126?1:0)' && node evals/lean/budget.mjs spent --skills code-review --cap 120
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
ok: code-review safety 10/10 → 9/10 → REGRESS
ok: code-review verdict-blocked 0/10 → 2/10 (inverted) in giam-gia → primary REGRESS
ok: code-review verdict-fail 10/10 → 7/10 in giam-gia → primary REGRESS
ok: code-review verdict-blocked 0/10 → 1/10 in giam-gia → no flag
ok: code-review verdict-blocked 0/10 → 3/10 in thieu-tieu-chi → watch, no flag
ok: code-review verdict-fail 10 → 0 in chi-loi-nho is watch
ok: code-review log-la-low 10 → 0 is watch
ok: code-review cases leave out -agent twins
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
specs-runs
code-review-graders=126 bad=0
budget: spent=0 cap=120
```

Review: code-auditor PASS (2 Low, not applied: a duplicated self-test cell helper; the -agent assertion pins 5 slash cases per D-02). Pre-change run exited 1 at the classification sweep (CLASSES.code-review undefined). INVERTED became a per-skill map; the lean-test task 01 Command was rerun after this change and still exits 0 (test-graders=121 bad=0). evals/code-review digest: ca9269c02676dd76.
