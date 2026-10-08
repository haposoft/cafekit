# Task 01 — The lean helpers compare develop cells

Status: done

## Outcome
`evals/lean/compare.mjs --skill develop` compares `lean-goc-*` with `lean-sau-*` under `evals/results/develop/` for `mot-task-hong` and `mot-task-sach` by plan D-06's classes, with the per-case inversion and derived `joint` of plan D-05; every earlier lean comparison is unchanged.

## Scope
- In: `export` on `LOWER` and `JOINT` in `evals/develop/compare.mjs`; a `develop` entry in `CLASSES`, per-case inversion, direction-aware pooling, derived `joint`, the usage string and self-test cases in `evals/lean/compare.mjs`.
- Out: any paid run; any `evals/develop` case, grader, scaffold or fixture; `evals/run.sh`; `budget.mjs`; other skills' `CLASSES` entries (sibling packets own them).

## Coverage
- CP-02

## Ownership
- Modify: `evals/lean/compare.mjs`, `evals/develop/compare.mjs`
- Read: `evals/develop/*/graders/`, `evals/develop/check-instrument.sh`, `specs/lean-fix-debug/compare-{fix,debug}.txt`, `specs/lean-ask/compare-ask2.txt`, any `specs/lean-*/compare-*.txt` of sibling packets

## Steps
1. Schedule (plan D-08): start only when no sibling lean packet (`lean-test`, `lean-code-review`, `lean-research`, `lean-sync`) has its task 01 or task 03 `in_progress` (its paid tasks 02 and 04, which edit no shared file, do not block) and `git status --short evals/lean packages/spec` shows no change outside this task's owned files; set `specs/_shared/active-feature.json` to `{"featureName":"lean-develop"}` first.
2. `evals/develop/compare.mjs`: add `export` to `LOWER` and `JOINT`; nothing else changes.
3. `evals/lean/compare.mjs`: add `develop` to `CLASSES` as plan D-06. For `--skill develop`, the short case is the case name without `mot-task-`; a grader in `LOWER[short]` is inverted for that cell (best 0/n, a rise is worse); the pooled key includes the direction so hong and sach never pool a grader in opposite directions; add to every counted run `joint` = `JOINT[short](Object.fromEntries(r.graders.map((g) => [g.name, g.passed === true])))`; `LOWER.hong` also lists the two watch graders — their inversion is cosmetic (watch never flags). If a sibling packet already added a generic per-case inversion or joint hook, use it instead of a second mechanism. Self-test cases: `khong-receipt` 10/10 → 9/10 in hong flags `REGRESS`; hong `dong-task` 0/10 → 2/10 flags `REGRESS` while sach `dong-task` 10/10 → 10/10 does not, and no pooled line mixes the two; sach `dung-blocked` 0/10 → 2/10 flags `REGRESS`; sach `code-tieng-viet` 10/10 → 0/10 is watch with no flag; two sach members failing in different runs give `joint` 10/10 → 8/10 and flag `REGRESS`.
4. Run the Command.

## Acceptance
- AC-01: the lean self-test and `check-instrument.sh` pass; every non-`dem-` develop grader plus `joint` is classified exactly once; fix, debug and ask comparisons and every saved sibling `compare-<skill>.txt` reproduce byte-equal; `budget.mjs spent --skills develop --cap 120` prints `spent=0 cap=120`; the `evals/develop` digest after this task is printed for task 02.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && node evals/lean/compare.mjs --self-test && bash evals/develop/check-instrument.sh > /dev/null && echo instrument-ok && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && for f in specs/lean-test/compare-test.txt specs/lean-code-review/compare-code-review.txt specs/lean-research/compare-research.txt specs/lean-sync/compare-sync.txt specs/lean-git/compare-git.txt specs/lean-scout/compare-scout.txt; do [ -f "$f" ] || continue; s=${f##*/compare-}; s=${s%.txt}; node evals/lean/compare.mjs --skill $s > $t/x && cmp $t/x $f || exit 1; done && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").develop;let bad=0,n=0;const names=new Set(["joint"]);for(const c of ["mot-task-hong","mot-task-sach"])for(const g of fs.readdirSync("evals/develop/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-")))names.add(g);for(const g of names){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",g,hit);bad++}}console.log("develop-graders="+n+" bad="+bad);process.exit(bad?1:0)' && node evals/lean/budget.mjs spent --skills develop --cap 120 && (cd evals/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16 | sed 's/^/evals-develop-digest: /')`
- Named probe: the lean self-test; `check-instrument.sh` (runs the develop `compare`/`save-runs`/`budget` self-tests, scaffold, provenance and grader samples, $0); the prior comparisons; the classification sweep; `budget.mjs spent`; the digest line.
- Reachability: tasks 02 and 04 run these helpers by these paths.
- Oracle: `self-test: ok`, `instrument-ok`, `prior-unchanged`, `develop-graders=10 bad=0`, `budget: spent=0 cap=120`, one `evals-develop-digest: <16 hex>` line, exit 0.
- Counterexample: an unclassified grader, a pooled line mixing directions, a changed prior comparison, or a failing self-test makes the Command exit 1.
- Artifacts: the two helper files (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && node evals/lean/compare.mjs --self-test && bash evals/develop/check-instrument.sh > /dev/null && echo instrument-ok && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && for f in specs/lean-test/compare-test.txt specs/lean-code-review/compare-code-review.txt specs/lean-research/compare-research.txt specs/lean-sync/compare-sync.txt specs/lean-git/compare-git.txt specs/lean-scout/compare-scout.txt; do [ -f "$f" ] || continue; s=${f##*/compare-}; s=${s%.txt}; node evals/lean/compare.mjs --skill $s > $t/x && cmp $t/x $f || exit 1; done && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").develop;let bad=0,n=0;const names=new Set(["joint"]);for(const c of ["mot-task-hong","mot-task-sach"])for(const g of fs.readdirSync("evals/develop/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-")))names.add(g);for(const g of names){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",g,hit);bad++}}console.log("develop-graders="+n+" bad="+bad);process.exit(bad?1:0)' && node evals/lean/budget.mjs spent --skills develop --cap 120 && (cd evals/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16 | sed 's/^/evals-develop-digest: /')
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 15c0980094bbb6b7a31314f22e269d8bc7c59cc3028e20683bacf0fef30d2839
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && node evals/lean/compare.mjs --self-test && bash evals/develop/check-instrument.sh > /dev/null && echo instrument-ok && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && for f in specs/lean-test/compare-test.txt specs/lean-code-review/compare-code-review.txt specs/lean-research/compare-research.txt specs/lean-sync/compare-sync.txt specs/lean-git/compare-git.txt specs/lean-scout/compare-scout.txt; do [ -f "$f" ] || continue; s=${f##*/compare-}; s=${s%.txt}; node evals/lean/compare.mjs --skill $s > $t/x && cmp $t/x $f || exit 1; done && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").develop;let bad=0,n=0;const names=new Set(["joint"]);for(const c of ["mot-task-hong","mot-task-sach"])for(const g of fs.readdirSync("evals/develop/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-")))names.add(g);for(const g of names){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",g,hit);bad++}}console.log("develop-graders="+n+" bad="+bad);process.exit(bad?1:0)' && node evals/lean/budget.mjs spent --skills develop --cap 120 && (cd evals/develop && find . -type f ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16 | sed 's/^/evals-develop-digest: /')
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
ok: develop hong khong-receipt 10/10 → 9/10 → REGRESS
ok: develop hong dong-task 0/10 → 2/10 (inverted) → REGRESS
ok: develop sach dong-task 10/10 → 10/10 → no flag
ok: develop pooled dong-task lines never mix directions
ok: develop sach dung-blocked 0/10 → 2/10 (inverted) → REGRESS
ok: develop sach code-tieng-viet 10/10 → 0/10 is watch, no flag
ok: develop joint 10/10 → 8/10 (two members, two runs) → REGRESS
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
instrument-ok
prior-unchanged
develop-graders=10 bad=0
budget: spent=0 cap=120
evals-develop-digest: d9ff51633880a954
```

Review: code-auditor PASS (2 Low DRY notes, not applied). Pre-change run: instrument-ok and prior-unchanged printed, then the classification sweep threw (CLASSES.develop undefined). The lean-test and lean-code-review task 01 Commands were rerun after this change and both exit 0. evals-develop-digest=d9ff51633880a954 (task 02 guards on it).
