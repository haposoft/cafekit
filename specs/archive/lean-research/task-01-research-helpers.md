# Task 01 — The lean helpers compare research cells

Status: done

## Outcome
`evals/lean/compare.mjs --skill research` compares `lean-goc-*` with `lean-sau-*` under `evals/results/research/` for the four skill-path cases of plan D-02 by plan D-05's classes; the fix, debug and ask comparisons are unchanged.

## Scope
- In: a `research` entry in `CLASSES`; the research case list leaves out every case ending in `-agent` (add a `research` key to the per-skill exclusion; create that map only if no sibling packet has); `research` in the usage line; self-test cases.
- Out: any paid run; any `evals/research` case, grader, fixture or helper; `evals/run.sh`; `budget.mjs` and `loaded.mjs` (already take a skill); other skills' entries.

## Coverage
- CP-02

## Ownership
- Modify: `evals/lean/compare.mjs`
- Read: `evals/research/{chon-kien-truc-theo-rang-buoc,da-co-quyet-dinh,khong-luu-khong-sua,nguon-cu-mau-thuan}/graders/`, `specs/lean-fix-debug/compare-{fix,debug}.txt`, `specs/lean-ask/compare-ask2.txt`

## Steps
0. Preflight per plan § Shared files and schedule: set `specs/_shared/active-feature.json` to `{"featureName":"lean-research"}`; wait until no sibling lean packet has its task 01 or task 03 `in_progress` (its paid tasks 02 and 04, which edit no shared file, do not block) and `git status --short evals/lean packages/spec` lists nothing but `evals/lean/compare.mjs` (or nothing); locate edits by string (`CLASSES`, the exclusion map), not by line number.
1. Add `research` to `CLASSES` exactly as plan D-05 (safety, primary, `expected: []`, watch); add nothing to `INVERTED`.
2. Exclude the `-agent` cases from the `research` case list so `--skill research` yields eight cells (four cases × two models).
3. Self-test cases: `khong-file-moi` 10/10 → 9/10 flags safety `REGRESS`; `co-nhan-claim` 10/10 → 8/10 flags primary `REGRESS`; `co-goi-skill` 10/10 → 0/10 does not flag (watch); `--cells nguon-cu-mau-thuan-agent-sonnet` reports `unknown`.
4. Run the Command.

## Acceptance
- AC-01: the self-test passes; every non-`dem-` grader of the four skill-path cases is classified exactly once; no `-agent` case appears; fix, debug and ask comparisons reproduce byte-equal; `budget.mjs spent --skills research --cap 120` prints `spent=0 cap=120`.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").research;let bad=0,n=0;for(const c of fs.readdirSync("evals/research").filter(c=>!c.endsWith("-agent")&&fs.existsSync("evals/research/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/research/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("research-graders="+n+" bad="+bad);process.exit(bad?1:0)' && { node evals/lean/compare.mjs --skill research --base-only --cells nguon-cu-mau-thuan-agent-sonnet || true; } | grep -qx 'cell=nguon-cu-mau-thuan-agent-sonnet unknown' && echo agent-excluded && node evals/lean/budget.mjs spent --skills research --cap 120`
- Named probe: the lean self-test; the three prior comparisons; the classification sweep; the `-agent` exclusion probe; `budget.mjs spent`.
- Reachability: tasks 02 and 04 run these helpers by these paths.
- Oracle: `self-test: ok`, `prior-unchanged`, `research-graders=<n> bad=0`, `agent-excluded`, `budget: spent=0 cap=120`, exit 0.
- Counterexample: an unclassified or doubly classified grader, an `-agent` cell accepted, a changed prior comparison, or a failing self-test makes the Command exit 1.
- Artifacts: `evals/lean/compare.mjs` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A failing self-test is recorded with the failing suite's name. A quota, rate-limit or billing error → stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").research;let bad=0,n=0;for(const c of fs.readdirSync("evals/research").filter(c=>!c.endsWith("-agent")&&fs.existsSync("evals/research/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/research/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("research-graders="+n+" bad="+bad);process.exit(bad?1:0)' && { node evals/lean/compare.mjs --skill research --base-only --cells nguon-cu-mau-thuan-agent-sonnet || true; } | grep -qx 'cell=nguon-cu-mau-thuan-agent-sonnet unknown' && echo agent-excluded && node evals/lean/budget.mjs spent --skills research --cap 120
Exit: 0
Base: 7ff52692bdbbfb2e3ecfeb28b4ffa2b5d546cd33
Head: 429636cc8a4433c7765a92ac8d193f3b5bc2b4d405e69bbec306ad7af98dd47e
```text
$ cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f && cmp $t/f specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d && cmp $t/d specs/lean-fix-debug/compare-debug.txt && node evals/lean/compare.mjs --skill ask --after lean-sau2- > $t/a && cmp $t/a specs/lean-ask/compare-ask2.txt && echo prior-unchanged && node --input-type=module -e 'import fs from "fs";const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").research;let bad=0,n=0;for(const c of fs.readdirSync("evals/research").filter(c=>!c.endsWith("-agent")&&fs.existsSync("evals/research/"+c+"/case.yaml")))for(const g of fs.readdirSync("evals/research/"+c+"/graders").map(f=>f.replace(/\.md$/,"")).filter(g=>!g.startsWith("dem-"))){n++;const hit=Object.values(C).filter(v=>v.some(x=>x.endsWith("*")?g.startsWith(x.slice(0,-1)):g===x)).length;if(hit!==1){console.log("unclassified-or-duplicate",c,g,hit);bad++}}console.log("research-graders="+n+" bad="+bad);process.exit(bad?1:0)' && { node evals/lean/compare.mjs --skill research --base-only --cells nguon-cu-mau-thuan-agent-sonnet || true; } | grep -qx 'cell=nguon-cu-mau-thuan-agent-sonnet unknown' && echo agent-excluded && node evals/lean/budget.mjs spent --skills research --cap 120
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
research-graders=65 bad=0
agent-excluded
budget: spent=0 cap=120
```

Review: code-auditor FAIL round 1 (the runtime usage message at evals/lean/compare.mjs:470 lacked research, a Scope item); repair round 1 added it (grep shows research in both usage strings), Command rerun exit 0. Pre-change run threw at the classification sweep (CLASSES.research undefined). The lean-test, lean-code-review and lean-develop task 01 Commands were rerun after the change: all exit 0. Low (shared cell-builder duplication in self-tests) not applied.
