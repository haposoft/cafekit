# Task 01 — The lean helpers compare sync cells with their V verdicts

Status: done

## Outcome
`evals/lean/compare.mjs --skill sync` compares `lean-goc-*` with `lean-sau-*` under `evals/results/sync/` for the four cases of plan D-02, with each cell's `verify-run.txt` verdicts merged into its runs (plan D-04) and every grader classified by plan D-05; the fix, debug and ask comparisons are unchanged.

## Scope
- In: in `evals/lean/compare.mjs`, the verify-run merge keyed by a `VERIFY_SKILLS` set (only if no sibling packet added it yet; otherwise add `sync` to the set), a `sync` entry in `CLASSES`, the usage text, self-test cases.
- Out: any paid run; any file under `evals/sync/`; `evals/compare-sync.mjs`, `evals/budget-sync.mjs`, `evals/run.sh`; `evals/lean/budget.mjs` (already takes `--skills`/`--cap`); other `CLASSES` entries.

## Coverage
- CP-02

## Ownership
- Modify: `evals/lean/compare.mjs`
- Read: `evals/sync/verify-run.mjs` (`GRADERS`), `evals/sync/*/graders/`, `evals/compare-sync.mjs:68-100` (verify-run line format), every existing `specs/lean-*/compare-*.txt`, `specs/specs-routing-repair/task-04-measure-new.md:47` (the specs `--cells`)

## Steps
0. Preflight per plan D-08: set `specs/_shared/active-feature.json` to `{"featureName":"lean-sync"}`; wait until no sibling lean packet (`lean-test`, `lean-develop`, `lean-code-review`, `lean-research`) has its task 01 or task 03 `in_progress` and `git status --short evals/lean packages/spec` lists nothing outside `evals/lean/compare.mjs`. Locate self-test edits by string, not line number.
1. If `evals/lean/compare.mjs` has no verify-run merge: add `VERIFY_SKILLS` and, in `readCell`, before errored runs are filtered, parse every `<dir> run=<i> grader=<g> verdict=<yes|no|error>` line of `<cell>/verify-run.txt` and set grader `g` of run `i` (1-based over `result.cases[0].arms.with`): a name already present as an H grader passes only when both pass; the cell is bad (printed `cell=<c> <side> verify <problem>`, counted, exit 1) when the file is missing, a verdict is `error`, a (run, grader) pair repeats, or a grader of `GRADERS[case]` in `evals/<skill>/verify-run.mjs` lacks exactly one verdict per run. Apply the same checks under `--base-only`. If the merge exists, add `sync` to `VERIFY_SKILLS` only.
2. Add `sync` to `CLASSES` exactly as plan D-05 (safety, primary, `expected: []`, watch); add `sync` to the usage text.
3. Self-test (synthetic cells under the temp root): `khong-pass-khi-fail` V 10/10 → 9/10 flags `REGRESS` as safety; `bao-cao-file-dung` V 10 → 0 does not (watch); one `verdict=error` line makes the cell bad; a missing `verify-run.txt` makes the cell bad; with run 3 errored, run 4's V verdict stays on run 4.
4. Run the Command.

## Acceptance
- AC-01: the self-test passes; every non-`dem-` H and V grader of the four sync cases is classified exactly once; every existing `specs/lean-*/compare-*.txt` reproduces byte-equal with the flags of plan § Shared file (at least the four of 2026-10-07); the specs comparison exits 0; `budget.mjs spent --skills sync --cap 120` prints `spent=0 cap=120`.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && node evals/lean/compare.mjs --self-test && t=$(mktemp -d) && k=0 && for f in specs/lean-*/compare-*.txt; do b=$(basename "$f" .txt); case "$b" in compare-ask2) node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/x;; *) node evals/lean/compare.mjs --skill "${b#compare-}" > $t/x;; esac && cmp $t/x "$f" || { echo "prior changed: $f"; exit 1; }; k=$((k+1)); done && [ "$k" -ge 4 ] && echo "prior-unchanged=$k" && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus > $t/sp && echo specs-ok && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").sync;const {GRADERS}=await import("./evals/sync/verify-run.mjs");let bad=0,n=0,k=0;for(const c of fs.readdirSync("evals/sync").filter(c=>fs.existsSync("evals/sync/"+c+"/case.yaml"))){k++;const names=new Set([...fs.readdirSync("evals/sync/"+c+"/graders").map(f=>f.replace(/\.md$/,"")),...Object.keys(GRADERS[c]||{})].filter(g=>!g.startsWith("dem-")));for(const g of names){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}}console.log("sync-cases="+k+" sync-graders="+n+" bad="+bad);process.exit(bad||k!==4?1:0)' && node evals/sync/skill-loaded.mjs --self-test && node evals/sync/verify-run.mjs --self-test && node evals/lean/budget.mjs spent --skills sync --cap 120`
- Named probe: the lean self-test; every saved prior comparison; the specs comparison; the classification sweep over H and V graders; the two sync instrument self-tests; `budget.mjs spent`.
- Reachability: tasks 02 and 04 run these helpers by these paths.
- Oracle: `self-test: ok`, `prior-unchanged=<k>` (k ≥ 4), `specs-ok`, `sync-cases=4 sync-graders=<n> bad=0`, the two sync `self-test ok` lines, `budget: spent=0 cap=120`, exit 0.
- Counterexample: an unclassified or doubly classified grader, a changed prior comparison, a failing specs comparison, or a failing self-test makes the Command exit 1. Before the change it exits 1 at the classification sweep (no `sync` entry in `CLASSES`).
- Artifacts: `evals/lean/compare.mjs` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && node evals/lean/compare.mjs --self-test && t=$(mktemp -d) && k=0 && for f in specs/lean-*/compare-*.txt; do b=$(basename "$f" .txt); case "$b" in compare-ask2) node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/x;; *) node evals/lean/compare.mjs --skill "${b#compare-}" > $t/x;; esac && cmp $t/x "$f" || { echo "prior changed: $f"; exit 1; }; k=$((k+1)); done && [ "$k" -ge 4 ] && echo "prior-unchanged=$k" && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus > $t/sp && echo specs-ok && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").sync;const {GRADERS}=await import("./evals/sync/verify-run.mjs");let bad=0,n=0,k=0;for(const c of fs.readdirSync("evals/sync").filter(c=>fs.existsSync("evals/sync/"+c+"/case.yaml"))){k++;const names=new Set([...fs.readdirSync("evals/sync/"+c+"/graders").map(f=>f.replace(/\.md$/,"")),...Object.keys(GRADERS[c]||{})].filter(g=>!g.startsWith("dem-")));for(const g of names){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}}console.log("sync-cases="+k+" sync-graders="+n+" bad="+bad);process.exit(bad||k!==4?1:0)' && node evals/sync/skill-loaded.mjs --self-test && node evals/sync/verify-run.mjs --self-test && node evals/lean/budget.mjs spent --skills sync --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 6a41c048c81df9b29c99accf8cd8636d127579f7ea82c1603eb4d2137e1a8b60
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && node evals/lean/compare.mjs --self-test && t=$(mktemp -d) && k=0 && for f in specs/lean-*/compare-*.txt; do b=$(basename "$f" .txt); case "$b" in compare-ask2) node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/x;; *) node evals/lean/compare.mjs --skill "${b#compare-}" > $t/x;; esac && cmp $t/x "$f" || { echo "prior changed: $f"; exit 1; }; k=$((k+1)); done && [ "$k" -ge 4 ] && echo "prior-unchanged=$k" && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus > $t/sp && echo specs-ok && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").sync;const {GRADERS}=await import("./evals/sync/verify-run.mjs");let bad=0,n=0,k=0;for(const c of fs.readdirSync("evals/sync").filter(c=>fs.existsSync("evals/sync/"+c+"/case.yaml"))){k++;const names=new Set([...fs.readdirSync("evals/sync/"+c+"/graders").map(f=>f.replace(/\.md$/,"")),...Object.keys(GRADERS[c]||{})].filter(g=>!g.startsWith("dem-")));for(const g of names){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}}console.log("sync-cases="+k+" sync-graders="+n+" bad="+bad);process.exit(bad||k!==4?1:0)' && node evals/sync/skill-loaded.mjs --self-test && node evals/sync/verify-run.mjs --self-test && node evals/lean/budget.mjs spent --skills sync --cap 120
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
ok: research safety 10/10 → 9/10 → REGRESS
ok: research co-nhan-claim 10/10 → 8/10 → primary REGRESS
ok: research co-goi-skill 10/10 → 0/10 is watch, no flag
ok: research -agent cell is unknown
ok: research cases leave out -agent cases
ok: --after lean-sau2- reads those cells
ok: sync khong-pass-khi-fail V 10/10 → 9/10 → safety REGRESS
ok: sync bao-cao-file-dung V 10 → 0 is watch, no flag
ok: sync one verdict=error line → cell bad
ok: sync missing verify-run.txt → cell bad
ok: sync --base-only passes with a complete base verify-run.txt
ok: sync errored run 3 leaves run 4's V verdict on run 4
ok: sync duplicate (run, grader) verdict → cell bad
ok: sync a case grader without one verdict per run → cell bad
ok: unknown --cells name → bad
ok: unclassified grader → bad
ok: missing cell → bad
ok: -lan1 sibling used
ok: differing host.txt → HOST-DRIFT
ok: partial cell → bad
ok: --base-only needs host.txt
ok: fisher 10/10 vs 0/10
self-test: ok
prior-unchanged=4
specs-ok
sync-cases=4 sync-graders=33 bad=0
ok not-available-trace
self-test ok: launched=yes, not-available=no, error=no, other skill=no, missing base text=no, unreadable=error
ok valid-receipt
ok typed-sha-receipt
ok committed-stale-receipt
ok command-identity-caught
ok missing-trace
ok fenced-fields-ignored
ok claimed-in-text-not-run
ok unpaired-result-is-error
ok summary-line
ok regex-oracle-would-pass-typed-sha
ok throwing-grader-is-error
ok edit-to-dirty-file-detected
self-test ok
budget: spent=0 cap=120
```

Review: code-auditor PASS (5 Low, not applied: no self-test for the H+V same-name merge branch, which no current sync case exercises; verify-run.txt dir prefix not checked; an unregistered case would pass an empty verify file; header comment; 8 not 7 self-tests). Pre-change run threw at the classification sweep (CLASSES.sync undefined). The four sibling task 01 Commands were rerun after this change: all exit 0.
