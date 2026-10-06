# Task 02 — A debug run that scouts can be measured

Status: done

Blocker (2026-09-23, second pilot, after the rename): the run listed `"cafekit-scout:debug","cafekit-scout:scout"` among its skills, so the name now resolves; its only Skill call was `{"skill":"cafekit-scout:debug","args":"Đơn hàng đúng 100.000đ không được giảm 10% dù đã đạt ngưỡng. …"}`, after which it wrote "Small project, discount logic is clearly in `src/pricing/discount.js`" and used `find`, five `Read`s, `node --test` and `git log` directly; `goi-scout` counted 0; all eleven graders passed (`evals/results/scout/pilot/result.json`, `partial: false`). D-03's stop is triggered with the naming cause ruled out: on a thirteen-file fixture debug goes straight to the defect. Review verdict PASS_WITH_WARNINGS; limit to record: `khong-grep-moi` misses a `Grep` with no `path`, and `Glob` is ungraded. **Resolved** (see `plan.md` review log): user decision (2026-09-23) to enlarge the fixture to about 70 files with the defect several calls deep and look-alike files inside the project, then pilot three sonnet runs with `--keep-temp`; if none invokes scout, stop and fall back to task 03 with probes only.

First pilot (2026-09-23, before the rename): the pilot hit D-03's stop. Its only Skill call was `{"skill":"cafekit-inspect:debug", ...}`; `goi-scout` counted 0; the run then used debug's direct-reconnaissance fallback (`find`, seven `Read`s) and still diagnosed correctly (all eleven graders passed). The harness names plugin skills `<plugin>:<directory>` and drops the frontmatter `name` (`evals/run.sh:58-60`; review found `gitprobe:develop` listed with zero `cf:develop` in another kept trace), so scout would appear as `cafekit-inspect:inspect` while `debug/SKILL.md:89` asks for `cf:scout` — a name the run never sees `[UNVERIFIED as the cause]`. Review verdict PASS_WITH_WARNINGS (0 Critical/High; Medium: the naming confound, and `khong-grep-moi` misses a Grep with no `path`). Resolved at the reopened GATE-SCOPE: task 01 renames the directory, then this task moves the case to `evals/scout/` and re-runs the pilot.

## Outcome
`evals/scout/` holds one case, `chan-doan-giam-gia`, where `/cf:debug` diagnoses a discount bug five calls below the entrypoint, among look-alike files inside the project and a decoy under `node_modules/`; `evals/summarize.mjs` prints `dem-*` medians and invoked-only counts; a one-run pilot shows, from its kept trace, whether and under what name the scout skill was invoked.

## Scope
- In: a fixture of 63 files (entry `src/api/checkout.js` → `src/order/summary.js` → `src/cart/total.js` → `src/pricing/engine.js` → `src/pricing/rules/index.js` → `src/pricing/rules/tier-threshold.js`, whose threshold uses `>` where the test expects `>=`; inert look-alikes `src/legacy/discount-old.js` (not imported), `src/promo/coupon-discount.js` and `src/pricing/discount-label.js`; about 45 filler modules; a failing `test/checkout.test.js` plus two passing tests) — enlarged from a thirteen-file first version by user decision after the second pilot; the decoy stored as `fixture/fake_node_modules/fake-promo/discount.js` because `.gitignore:2` drops every `node_modules/`, renamed by the scaffold, and no `.gitignore` in the workspace so the decoy is findable; `case.yaml` and graders; `check-fixture.sh`; the summarizer additions; one pilot.
- In, after the first pilot: move the already-written case from `evals/inspect/` to `evals/scout/`, because `evals/run.sh:28-29` takes the case directory from the skill directory; widen `goi-scout` to also match `cf-scout`.
- Out: any skill text; `evals/run.sh`; other suites' cases.

## Coverage
- CP-01

## Ownership
- Create: `evals/scout/fixture/**`, `evals/scout/chan-doan-giam-gia/case.yaml`, `evals/scout/chan-doan-giam-gia/scaffold.sh`, `evals/scout/chan-doan-giam-gia/graders/*.md`, `evals/scout/check-fixture.sh`
- Modify: `evals/summarize.mjs`
- Read: `evals/run.sh:37-61`, `evals/specs/sau-keep/graders/khong-sua-code.md` (`input_match` is a regex over the tool input, e.g. `'"file_path":"[^"]*/src/'`), `evals/develop/check-instrument.sh` (the harness-layout checker pattern), `debug/SKILL.md:40-52, :89-90, :181-189`

## Steps
1. Write the fixture and `scaffold.sh` (copy, move `fake_node_modules` to `node_modules`, `git init`, one commit).
2. Write `check-fixture.sh`: scaffold into a temp dir using the same rsync layout as `evals/run.sh`, assert `node --test test/checkout.test.js` fails, assert it passes after flipping `>` to `>=` in a scratch copy, assert `node_modules/fake-promo/discount.js` exists and no `.gitignore` is present.
3. `case.yaml`: prompt `/cf:debug Đơn hàng đúng 100.000đ không được giảm 10% dù đã đạt ngưỡng. Chỉ chẩn đoán nguyên nhân gốc, chưa sửa code.`, `max_turns: 30`, `timeout_seconds: 900`, tools `[Read, Glob, Grep, Skill, Bash]`.
4. Graders:
   - `goi-scout` — `tool_used: Skill`, `input_match: '(^|[^-])(scout|inspect)|cf-scout'`, `min: 0` (reports the count);
   - `goi-debug` — `tool_used: Skill`, `input_match: '"skill":"[^"]*debug'`, `min: 0`, informational only;
   - `dung-cho-loi` — regex on the last message: `pricing/rules/tier-threshold\.js(:|#L| dòng | line )\d+`;
   - `nguyen-nhan` — `llm` on the last message: names the `>` versus `>=` threshold in `src/pricing/rules/tier-threshold.js` as the cause and the path from `checkout` to `tier-threshold`;
   - `khong-sua-code` — regex on `src/pricing/rules/tier-threshold.js`: the original `if (amount > TIER_THRESHOLD)` is still present;
   - `khong-doc-moi` — `tool_used: Read`, `input_match: '"file_path":"[^"]*node_modules/'`, `max: 0`;
   - `khong-grep-moi` — `tool_used: Grep`, `input_match: '"path":"[^"]*node_modules'`, `max: 0`;
   - `dem-read`, `dem-grep`, `dem-glob`, `dem-bash` — `tool_used`, `min: 0`.
   A `Grep` with no `path` and any `Glob` are not graded against the decoy, and a Bash command that scans `node_modules/` is not graded either: an `rg --glob '!node_modules'` exclusion names the same string, so the limit is recorded rather than guessed at.
5. `evals/summarize.mjs`: add `goi-scout` to the skill graders; for each case and arm also print the median of every `dem-*` count over all runs, and the grader pass counts restricted to runs whose skill grader saw at least one call. Existing output lines stay byte-identical.
6. `evals/run.sh scout --with-skill debug --validate` — no `✗`.
7. Pilot: one sonnet run with `--keep-temp`; from the kept trace copy the exact `Skill` tool inputs into the Receipt, confirm every grader produced a verdict, then delete the kept directory. If scout was not invoked, stop the packet and report (D-03, F-12) — superseded by the fallback recorded in `plan.md`.

## Acceptance
- AC-01 as stated in `plan.md`.
- `check-fixture.sh` fails when the decoy is missing or the planted threshold is fixed.

## Dependencies
- task-01-rename-skill-directories.md

## Verification Plan
- Command: `bash evals/scout/check-fixture.sh && evals/run.sh scout --with-skill debug --validate && evals/run.sh scout --with-skill debug --out pilot --model sonnet --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 2 --allow-tools Bash --case chan-doan-giam-gia --keep-temp && node evals/summarize.mjs evals/results/scout/pilot`
- Named probe: `check-fixture.sh` assertions; the eleven graders of `chan-doan-giam-gia`
- Reachability: `[UNVERIFIED]` for scout invocation until the pilot — `debug/SKILL.md:89` says "Activate `cf:scout`" and `:90` offers a direct fallback, so a run may scout without the Skill tool
- Oracle: the checker exits 0; validate prints no `✗`; the pilot is `partial: false` with every grader scored; the summary prints the `dem-*` medians and the invoked-only counts
- Counterexample: a checker run with the decoy removed or the threshold fixed exits non-zero; a scout call that `goi-scout` fails to count shows as a mismatch between the copied `Skill` inputs and the grader's count
- Artifacts: `evals/results/scout/pilot/result.json`, gitignored, declared with `sha256`

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/scout/check-fixture.sh && evals/run.sh scout --with-skill debug --validate && evals/run.sh scout --with-skill debug --out pilot --model sonnet --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 2 --allow-tools Bash --case chan-doan-giam-gia --keep-temp && node evals/summarize.mjs evals/results/scout/pilot
Exit: 0
Base: e083bd9ffd60fd9129ddee14401cdf136e007412
Head: 076af72265aaa8eb2673b5315d46d93b8831142d6f6c9367042d7b4adf61cd38
```text
$ bash evals/scout/check-fixture.sh && evals/run.sh scout --with-skill debug --validate && evals/run.sh scout --with-skill debug --out pilot --model sonnet --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 2 --allow-tools Bash --case chan-doan-giam-gia --keep-temp && node evals/summarize.mjs evals/results/scout/pilot
ok: scaffold runs in the harness layout
ok: decoy present at node_modules/fake-promo/discount.js
ok: no .gitignore in the workspace
ok: workspace committed and clean
ok: exactly the threshold test fails
ok: flipping > to >= makes every test pass
Plugin under test: "cafekit-scout" version "0.16.8" at "/private/var/folders/0n/c1ky29v16kjfm08y24plng7w0000gn/T/cafekit-eval-scout-sPfMAA"
Ablation: 2 arms × 1 case (20 runs)
  chan-doan-giam-gia: not granted (missing --allow-tools grant, or a malformed entry): Bash
⚠ cost ceiling $0 hit; skipping remaining cases
CASE  SCORE PASS% RUNS COST    NOTES
0 case(s) · 0s · $0.00 · ⚠ partial (cost ceiling hit)
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/scout/pilot/result.json
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/scout/pilot (exit 0)
evals/results/scout/pilot  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T08:27:06.856Z  cost=$0.23
  chan-doan-giam-gia [with]  runs 1  Skill invoked 1/1  dem-bash 1/1  dem-glob 1/1  dem-grep 1/1  dem-read 1/1  dung-cho-loi 1/1  goi-debug 1/1  goi-scout 1/1  khong-doc-moi 1/1  khong-grep-moi 1/1  khong-sua-code 1/1  nguyen-nhan 1/1
    median tool calls over all runs: dem-bash 4  dem-glob 0  dem-grep 1  dem-read 7
    over the 1 run(s) that invoked the skill: dem-bash 1/1  dem-glob 1/1  dem-grep 1/1  dem-read 1/1  dung-cho-loi 1/1  goi-debug 1/1  goi-scout 1/1  khong-doc-moi 1/1  khong-grep-moi 1/1  khong-sua-code 1/1  nguyen-nhan 1/1
    median tool calls over those runs: dem-bash 4  dem-glob 0  dem-grep 1  dem-read 7
EXIT:0
```
Re-run at the final-Head fixed point (2026-09-23) after task 03 rewrote `scout/SKILL.md`, which the pilot loads; the first run of this Command is kept at `evals/results/scout/pilot-lan1/` (sha256 `fdd2c8dc2bec78304d8af237c06cd1291f723cd217ba215471cd5423c6f15fe1`). This run, with the rewritten scout, called `cafekit-scout:debug` then `cafekit-scout:scout`; all eleven graders passed. Scout invocation on the 63-file fixture is now 2 of 5 sonnet runs — 1 of 4 with the pre-rewrite text, 1 of 1 with the rewrite; too few to compare.
Artifact: evals/results/scout/pilot/result.json
sha256: f03911281c77ddaa723bc4fcc8fd085f49bb9b75b4d3a7f00589f2ec741a311f

The fenced block drops the harness's scaffold and `khong-sua-code` "cannot pass" notices from `--validate` (it does not run the scaffold; the pilot scores that grader) and the `Report:`/`⚠ kept` lines.

Skill inputs copied from the kept trace before it was deleted: `{"skill":"cafekit-scout:debug", ...}` and `{"skill":"cafekit-scout:scout", ...}`; the run's skill list held `cafekit-scout:debug` and `cafekit-scout:scout`. Diagnosis correct: all eleven graders passed.

Scout invocation across the four sonnet runs on the 63-file fixture: 1 of 4 — `evals/results/scout/pilot-lon/` 0/3 (sha256 `84b3d10afd67e75d97f8204a2fa55139bb661206b0cbf7e3d955a82b98815b56`; each run invoked `cafekit-scout:debug`, then scouted itself; all graders 3/3), then this Command 1/1. The fallback that dropped task 04 was taken on the 0/3, before this run. Earlier pilots, kept for the record: the thirteen-file fixture before the rename (`evals/results/scout-truoc-doi-ten/pilot/`, name not visible, 0/1) and after it (`evals/results/scout-pilot-13-file/`, `cafekit-scout:scout` listed, 0/1).

Checker counterexamples (2026-09-23, disposable copies): decoy removed → `FAIL: scaffold failed in the harness layout`; threshold pre-fixed → `FAIL: expected exactly one failing test before the fix`; both exit 1. The summarizer's existing lines stay byte-identical on the `specs` and `develop` result directories; only indented lines are added.

Review: PASS after four rounds (the naming confound, then the enlarged fixture's stale task text).

Limits: the decoy graders see `Read` paths and `Grep` calls that pass a `path` only — a `Grep` with no `path`, any `Glob` and any Bash scan are ungraded, and every enlarged-fixture run used `Grep`; one run is not a rate; the eval runs without hooks and reads only `SKILL.md`.
