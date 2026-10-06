# Task 01 — The lean helpers compare ask cells and keep ask spend under its own cap

Status: done

## Outcome
`evals/lean/compare.mjs --skill ask` compares `lean-goc-*` with `lean-sau-*` under `evals/results/ask/` by plan D-05's classes, and `evals/lean/budget.mjs` sums only the skills it is given (`--skills ask --cap 60`), both with self-tests; the fix/debug behaviour of packet 1 is unchanged.

## Scope
- In: an `ask` entry in `CLASSES`; `--skills` and `--cap` in `budget.mjs`; self-test cases for both.
- Out: any paid run; any file under `evals/ask/`, `evals/run.sh`; changing the fix/debug classes or rules.

## Coverage
- CP-02

## Ownership
- Modify: `evals/lean/compare.mjs`, `evals/lean/budget.mjs`
- Read: `evals/ask/*/graders/`, `specs/lean-fix-debug/compare-{fix,debug}.txt`

## Steps
1. `compare.mjs`: add `ask` to `CLASSES` exactly as plan D-05 (`khong-sua-*` and the other wildcards as prefixes); `--skill ask` reads cases from the `evals/ask/` directories holding a `case.yaml` (the `fixture/` directory has none); for ask, add to every counted run the derived grader `joint`, passing when every member of the run's case in `MEMBERS` (imported from `../ask/compare.mjs`) passes — the case is the cell name without `-sonnet`/`-opus`. Self-test: an ask safety grader 10/10 → 9/10 flags `REGRESS`; a watch grader (`dung-websearch`) moving 10 → 0 does not; two members each failing one different run gives `joint` 10/10 → 8/10 and flags `REGRESS`.
2. `budget.mjs`: `--skills <comma list>` (default `fix,debug`) limits which `evals/results/<skill>/lean-*` directories are summed; `--cap <n>` (default 150) sets the cap printed and enforced; both are removed from the argument list wherever they appear, as `--root` is today (`evals/lean/budget.mjs` `main`), so `spent --skills ask --cap 60` and `check 4 --skills ask --cap 60` both parse; `spent(root, skills)` takes the list. Self-test: `--skills ask` ignores a fix cell; `--cap 60` refuses a `check` above 60.
3. Confirm packet 1 is unchanged: `node evals/lean/compare.mjs --skill fix` and `--skill debug` print bytes equal to `specs/lean-fix-debug/compare-{fix,debug}.txt`.
4. Run the Command.

## Acceptance
- AC-01: both self-tests pass; every non-`dem-` grader in `evals/ask/*/graders` is classified exactly once; packet 1's comparisons reproduce byte-equal; `budget.mjs spent --skills ask --cap 60` prints `spent=0 cap=60`.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && node evals/lean/budget.mjs --self-test && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f.txt && cmp $t/f.txt specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d.txt && cmp $t/d.txt specs/lean-fix-debug/compare-debug.txt && echo packet1-unchanged && node -e 'const fs=require("fs");const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").ask;const names=[...new Set(fs.readdirSync("evals/ask").filter(c=>fs.existsSync("evals/ask/"+c+"/case.yaml")).flatMap(c=>fs.readdirSync("evals/ask/"+c+"/graders").map(f=>f.replace(/\.md$/,""))))].filter(g=>!g.startsWith("dem-"));let bad=0;for(const g of names){const hit=Object.values(C).filter(v=>v.some(n=>n.endsWith("*")?g.startsWith(n.slice(0,-1)):g===n)).length;if(hit!==1){console.log("unclassified-or-duplicate",g,hit);bad++}}console.log("ask-graders="+names.length+" bad="+bad);process.exit(bad?1:0)' && node evals/lean/budget.mjs spent --skills ask --cap 60`
- Named probe: the two `--self-test` runs; the packet-1 byte comparison; the classification sweep; `budget.mjs spent --skills ask --cap 60`.
- Reachability: tasks 02 and 04 run these helpers by these paths.
- Oracle: two `self-test: ok`, `packet1-unchanged`, `ask-graders=<n> bad=0`, `budget: spent=0 cap=60`, exit 0.
- Counterexample: an unclassified ask grader, a packet-1 comparison that changes, or a budget that counts fix/debug spend under `--skills ask` makes the Command exit 1.
- Artifacts: the two helper files (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && node evals/lean/compare.mjs --self-test && node evals/lean/budget.mjs --self-test && t=$(mktemp -d) && node evals/lean/compare.mjs --skill fix > $t/f.txt && cmp $t/f.txt specs/lean-fix-debug/compare-fix.txt && node evals/lean/compare.mjs --skill debug > $t/d.txt && cmp $t/d.txt specs/lean-fix-debug/compare-debug.txt && echo packet1-unchanged && node -e 'const fs=require("fs");const src=fs.readFileSync("evals/lean/compare.mjs","utf8");const C=eval("("+src.match(/const CLASSES = (\{[\s\S]*?\n\});/)[1]+")").ask;const names=[...new Set(fs.readdirSync("evals/ask").filter(c=>fs.existsSync("evals/ask/"+c+"/case.yaml")).flatMap(c=>fs.readdirSync("evals/ask/"+c+"/graders").map(f=>f.replace(/\.md$/,""))))].filter(g=>!g.startsWith("dem-"));let bad=0;for(const g of names){const hit=Object.values(C).filter(v=>v.some(n=>n.endsWith("*")?g.startsWith(n.slice(0,-1)):g===n)).length;if(hit!==1){console.log("unclassified-or-duplicate",g,hit);bad++}}console.log("ask-graders="+names.length+" bad="+bad);process.exit(bad?1:0)' && node evals/lean/budget.mjs spent --skills ask --cap 60
Exit: 0
Base: 5f5d745cad94c751727c5cd14247a428d48a125e
Head: c065838543f80efac8246428666e967cda977823c2c25a76a5685f4f07fadec0
```text
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
ok: unknown --cells name → bad
ok: unclassified grader → bad
ok: missing cell → bad
ok: -lan1 sibling used
ok: differing host.txt → HOST-DRIFT
ok: partial cell → bad
ok: --base-only needs host.txt
ok: fisher 10/10 vs 0/10
self-test: ok
ok: empty root → 0
ok: sums lean-* under fix and debug only
budget: spent=4.85 next=100 total=104.85 cap=150
ok: check within cap → 0
budget: spent=4.85 next=146 total=150.85 cap=150
ok: check above cap → 1
budget: spent=4.85 cap=150
ok: spent within cap → 0
budget: spent=204.85 cap=150
ok: spent above cap → 1
usage: node evals/lean/budget.mjs spent | check <next> [--root <results root>] [--skills <a,b>] [--cap <n>] | --self-test
ok: bad usage → 2
ok: --skills ask sums ask only
budget: spent=53.5 next=7 total=60.5 cap=60
ok: --skills ask --cap 60 after check → 1 above 60
--skills takes a value
ok: --skills without a value → 2
--cap takes a value
ok: --cap empty → 2
budget: spent=53.5 cap=60
ok: --skills ask --cap 60 spent within → 0
self-test: ok
packet1-unchanged
ask-graders=24 bad=0
budget: spent=0 cap=60
```

- Exit capture: the Command was saved byte-identical to a script and run with `bash` from the repository root; `EXIT=0` was its own exit status.
- Negative proof: before any edit the Command exited 1 (`compare.mjs` had no `ask` class table, so the classification sweep threw).
- Self-tests cover: an ask safety grader 10/10 → 9/10 flags `REGRESS`; a watch grader 10 → 0 does not; two members failing in two different runs drop the derived `joint` 10/10 → 8/10 and flag it, while each member alone (9/10) does not; `budget.mjs --skills ask` ignores fix/debug spend, `--cap 60` refuses a check above 60, a flag without a value exits 2.
- Packet 1 unchanged: `compare.mjs --skill fix|debug` byte-equal to `specs/lean-fix-debug/compare-{fix,debug}.txt`; `budget.mjs spent` without flags still `spent=55.6413 cap=150`.
- Review: code-auditor PASS_WITH_WARNINGS (joint self-test at 7/10 instead of the 8/10 boundary; three Low: flag without value crashed, usage lacked ask, `--cap ""` read as 0) → repair round 1 → PASS.
