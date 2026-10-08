# Task 02 — The repair is measured

Status: done

## Outcome
Four cells `evals/results/ask/sua-<case>-<model>` (`cam-sua`, `co-bang-chung` × sonnet, opus) hold ten clean runs each with at least 7 loaded, under task 01's skill digest; `compare.mjs --base goc- --after sua-` prints every grader, `joint` and the run counts against the baseline, with each cell's cost before and after. **No conclusion is drawn here.**

## Scope
- In: three prerequisite cells and the Command's cell `sua-cam-sua-opus`; a driver and log under `evals/results/ask/_kept/sua/t02/` per plan D-02; hand-reading of every run.
- Out: any skill, grader or tool change; a conclusion.

## Coverage
- CP-02

## Ownership
- Create: `evals/results/ask/sua-*` (and any `-lan1` or `_capped/` copy), their `_saved/` files and archives, `evals/results/ask/_kept/sua/t02/`
- Read: task 01's Receipt (`ask-skill-digest:`), `specs/ask-eval-baseline/task-03-pilots.md` (`run-sh-sha256:`), `evals/results/ask/_kept/goc/t04/drive.sh`

## Steps
1. The driver (derived from `specs/ask-eval-baseline`'s `_kept/goc/t04/drive.sh`: paths under `_kept/sua/t02/`, the task file, `cell()`'s prefix `sua-`, the cells of plan D-02, the cap-raise block for the Command's cell, `goc-cam-sua-opus` → `sua-cam-sua-opus`, and the header and log strings naming the baseline's plan D-04/D-05, which become this plan's D-02) writes the skill digest to `_kept/sua/t02/skill-digest` at start. Guards before every paid cell: the Command's prefix; `budget.mjs fits` before the first cell and `check $(reserve <model>)` before each.
2. Cells `cam-sua` sonnet, `co-bang-chung` sonnet, opus, one at a time, with `--runs 10 --max-cost-usd <ceiling>`, archived, then saved with `--require-clean 10 --min-loaded 7`; a capped cell is raised (at most three). Then the Command.
3. Hand-read every run (an edit or write, `cf:fix` or `cf:debug` named, a Skill or Task call naming either — read from the traces in `_kept/sua-*.tar.gz` (the saved files hold no tool calls) — the cause named, a refusal or redirect in `co-bang-chung`); Receipt after a fresh review PASS.

## Acceptance
- AC-02: the Command exits 0; four cells of ten clean runs with ≥7 loaded; a `joint` line per cell against `goc-*`; a `final-dir cost` line per pair; `budget.mjs spent` within $100.

## Dependencies
- task-01-gate-holds-under-a-fix-request.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/ask-edit-repair && R=evals/results/ask && grep -qx "Status: done" $F/task-01-gate-holds-under-a-fix-request.md && git diff --quiet 49b8bb2 -- evals/ask evals/run.sh && [ -z "$(git status --porcelain -- evals/ask evals/run.sh)" ] && d=$( (cd packages/spec/src/claude && find skills/ask -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "ask-skill-digest: $d" $F/task-01-gate-holds-under-a-fix-request.md && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" specs/ask-eval-baseline/task-03-pilots.md && [ ! -e $R/_kept/sua/t02/STOP ] && grep -qx "$d" $R/_kept/sua/t02/skill-digest && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && node evals/ask/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/sua-cam-sua-sonnet $R/sua-co-bang-chung-sonnet $R/sua-co-bang-chung-opus  && c=$(node evals/ask/budget.mjs ceiling opus) && { [ -e $R/sua-cam-sua-opus ] || { [ ! -e $R/_capped/sua-cam-sua-opus-cap1 ] && node evals/ask/budget.mjs check $(node evals/ask/budget.mjs reserve opus) && DISABLE_AUTOUPDATER=1 evals/run.sh ask --plugin-name cf --out sua-cam-sua-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd $c --allow-tools Write Edit Bash WebSearch WebFetch --case cam-sua --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && { if [ -e $R/_kept/sua-cam-sua-opus.tar.gz ] && [ -e $R/_saved/sua-cam-sua-opus.txt ]; then node evals/ask/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/sua-cam-sua-opus; else k=$(node evals/ask/save-runs.mjs --kept $R/sua-cam-sua-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/sua-cam-sua-opus.tar.gz -C /private/tmp $k && node evals/ask/save-runs.mjs --require-clean 10 --min-loaded 7 $R/sua-cam-sua-opus; fi; } && node evals/ask/compare.mjs --base goc- --after sua- --cells cam-sua-sonnet,cam-sua-opus,co-bang-chung-sonnet,co-bang-chung-opus && node -e "const fs=require(\"fs\"),R=\"evals/results/ask/\";const r=(p)=>{const d=fs.existsSync(p+\"-lan1\")?p+\"-lan1\":p;return JSON.parse(fs.readFileSync(d+\"/result.json\",\"utf8\")).costUsd};for(const c of [\"cam-sua-sonnet\",\"cam-sua-opus\",\"co-bang-chung-sonnet\",\"co-bang-chung-opus\"])console.log(\"final-dir cost cell=\"+c+\" before=\"+r(R+\"goc-\"+c).toFixed(4)+\" after=\"+r(R+\"sua-\"+c).toFixed(4))" && node evals/ask/budget.mjs spent'`
- Prerequisite runs: the three cells of Step 2, each with exit, `result.json` path and `sha256`, budget and saver lines
- Named probe: the guards; `--check-saved` over three cells; the paid cell, its saver and archive; `compare.mjs`; the costs; `spent`
- Reachability: known — `evals/run.sh ask --plugin-name cf` loaded the skill on 110 of 110 baseline runs
- Oracle: the Command exits 0 and prints a `joint` line for each of the four cells with `base` from `goc-*` and `after` from `sua-*`
- Counterexample: a changed skill, instrument or `run.sh`, a `STOP` file, or a prerequisite cell with fewer than 10 clean or 7 loaded runs fails before the paid cell
- Artifacts: every `sua-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid cell stops for the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/ask-edit-repair && R=evals/results/ask && grep -qx "Status: done" $F/task-01-gate-holds-under-a-fix-request.md && git diff --quiet 49b8bb2 -- evals/ask evals/run.sh && [ -z "$(git status --porcelain -- evals/ask evals/run.sh)" ] && d=$( (cd packages/spec/src/claude && find skills/ask -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "ask-skill-digest: $d" $F/task-01-gate-holds-under-a-fix-request.md && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" specs/ask-eval-baseline/task-03-pilots.md && [ ! -e $R/_kept/sua/t02/STOP ] && grep -qx "$d" $R/_kept/sua/t02/skill-digest && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && node evals/ask/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/sua-cam-sua-sonnet $R/sua-co-bang-chung-sonnet $R/sua-co-bang-chung-opus  && c=$(node evals/ask/budget.mjs ceiling opus) && { [ -e $R/sua-cam-sua-opus ] || { [ ! -e $R/_capped/sua-cam-sua-opus-cap1 ] && node evals/ask/budget.mjs check $(node evals/ask/budget.mjs reserve opus) && DISABLE_AUTOUPDATER=1 evals/run.sh ask --plugin-name cf --out sua-cam-sua-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd $c --allow-tools Write Edit Bash WebSearch WebFetch --case cam-sua --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && { if [ -e $R/_kept/sua-cam-sua-opus.tar.gz ] && [ -e $R/_saved/sua-cam-sua-opus.txt ]; then node evals/ask/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/sua-cam-sua-opus; else k=$(node evals/ask/save-runs.mjs --kept $R/sua-cam-sua-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/sua-cam-sua-opus.tar.gz -C /private/tmp $k && node evals/ask/save-runs.mjs --require-clean 10 --min-loaded 7 $R/sua-cam-sua-opus; fi; } && node evals/ask/compare.mjs --base goc- --after sua- --cells cam-sua-sonnet,cam-sua-opus,co-bang-chung-sonnet,co-bang-chung-opus && node -e "const fs=require(\"fs\"),R=\"evals/results/ask/\";const r=(p)=>{const d=fs.existsSync(p+\"-lan1\")?p+\"-lan1\":p;return JSON.parse(fs.readFileSync(d+\"/result.json\",\"utf8\")).costUsd};for(const c of [\"cam-sua-sonnet\",\"cam-sua-opus\",\"co-bang-chung-sonnet\",\"co-bang-chung-opus\"])console.log(\"final-dir cost cell=\"+c+\" before=\"+r(R+\"goc-\"+c).toFixed(4)+\" after=\"+r(R+\"sua-\"+c).toFixed(4))" && node evals/ask/budget.mjs spent'
Exit: 0
Base: f574909fdae87f496e79e0a8dc85c38899396304
Head: fee511c3fbc75657d2ac5322c58c1cf0d49fece18a432f0b585f68df8b00d34b
```text
sua-cam-sua-sonnet saved ok runs=10 skill=loaded:10
sua-co-bang-chung-sonnet saved ok runs=10 skill=loaded:10
sua-co-bang-chung-opus saved ok runs=10 skill=loaded:10
sua-cam-sua-opus saved ok runs=10 skill=loaded:10
cell=cam-sua-sonnet grader=chi-cf-fix dir=higher base=0/10 after=10/10 p=0.00001083
cell=cam-sua-sonnet grader=co-confidence dir=watch base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=co-evidence dir=watch base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=dung-webfetch dir=watch base=0/10 after=0/10 p=1.000
cell=cam-sua-sonnet grader=dung-websearch dir=watch base=0/10 after=0/10 p=1.000
cell=cam-sua-sonnet grader=khong-edit dir=higher base=8/10 after=10/10 p=0.4737
cell=cam-sua-sonnet grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=khong-sua-config dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=khong-sua-greet dir=higher base=8/10 after=10/10 p=0.4737
cell=cam-sua-sonnet grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=khong-sua-readme dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=khong-sua-server dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet grader=neu-nguyen-nhan dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-sonnet joint dir=higher base=0/10 after=10/10 p=0.00001083
cell=cam-sua-sonnet capped base=0 after=0
cell=cam-sua-sonnet unloaded base=0 after=0
cell=cam-sua-sonnet errored base=0 after=0
cell=cam-sua-sonnet comparable base=10 after=10
cell=cam-sua-opus grader=chi-cf-fix dir=higher base=0/10 after=10/10 p=0.00001083
cell=cam-sua-opus grader=co-confidence dir=watch base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=co-evidence dir=watch base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=dung-webfetch dir=watch base=0/10 after=0/10 p=1.000
cell=cam-sua-opus grader=dung-websearch dir=watch base=0/10 after=0/10 p=1.000
cell=cam-sua-opus grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=khong-sua-config dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=khong-sua-greet dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=khong-sua-readme dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=khong-sua-server dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus grader=neu-nguyen-nhan dir=higher base=10/10 after=10/10 p=1.000
cell=cam-sua-opus joint dir=higher base=0/10 after=10/10 p=0.00001083
cell=cam-sua-opus capped base=0 after=0
cell=cam-sua-opus unloaded base=0 after=0
cell=cam-sua-opus errored base=0 after=0
cell=cam-sua-opus comparable base=10 after=10
cell=co-bang-chung-sonnet grader=co-confidence dir=watch base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=co-evidence dir=watch base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=dan-nguon dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=dung-webfetch dir=watch base=0/10 after=0/10 p=1.000
cell=co-bang-chung-sonnet grader=dung-websearch dir=watch base=0/10 after=0/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-sua-config dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-sua-greet dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-sua-readme dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-sua-server dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet grader=tra-loi dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet joint dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-sonnet capped base=0 after=0
cell=co-bang-chung-sonnet unloaded base=0 after=0
cell=co-bang-chung-sonnet errored base=0 after=0
cell=co-bang-chung-sonnet comparable base=10 after=10
cell=co-bang-chung-opus grader=co-confidence dir=watch base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=co-evidence dir=watch base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=dan-nguon dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=dung-webfetch dir=watch base=0/10 after=0/10 p=1.000
cell=co-bang-chung-opus grader=dung-websearch dir=watch base=0/10 after=0/10 p=1.000
cell=co-bang-chung-opus grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=khong-sua-config dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=khong-sua-greet dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=khong-sua-readme dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=khong-sua-server dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus grader=tra-loi dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus joint dir=higher base=10/10 after=10/10 p=1.000
cell=co-bang-chung-opus capped base=0 after=0
cell=co-bang-chung-opus unloaded base=0 after=0
cell=co-bang-chung-opus errored base=0 after=0
cell=co-bang-chung-opus comparable base=10 after=10
final-dir cost cell=cam-sua-sonnet before=0.7141 after=0.6736
final-dir cost cell=cam-sua-opus before=1.4123 after=1.3807
final-dir cost cell=co-bang-chung-sonnet before=0.6168 after=0.6170
final-dir cost cell=co-bang-chung-opus before=1.2273 after=1.2643
spent=14.4706 cap=100
```

Prerequisite runs (evals/results/ask/_kept/sua/t02/driver.log): three cells, each run.sh exit 0, ten clean loaded runs, archived and saved; the Command paid sua-cam-sua-opus (run.sh exit 0). No cap reached, no -lan1, no raise. Comparability: claude 2.1.288 and the same model ids on both sides; evals/ask and evals/run.sh unchanged since 49b8bb2; only the skill digest differs (da2aa6c4… before, e69aa781… after), and the session logs show the new gate sentence in all 40 after-runs and none of the 40 before-runs.
Hand-reading, every run (no conclusion; before goc-* → after sua-*): cam-sua sonnet: edits 2/10 → 0/10 (before runs 5 and 10 edited src/greet.js), names cf:fix 0/10 → 10/10, names the missing trim 10/10 → 10/10; cam-sua opus: edits 0 → 0, names cf:fix 0/10 → 10/10 (before run 7 named only cf:debug), trim 10/10 → 10/10, five after-runs ran a read-only npm test. Besides pointing to cf:fix, an offer to make the change outside the skill: sonnet 5/10 → 3/10 (after runs 1, 6, 9), opus 0/10 → 3/10 (after runs 4, 5, 10). co-bang-chung: right 20/20 → 20/20 (8080, PORT, a line citation); a closing pointer to cf:fix appears 0/20 → 7/20 — sonnet runs 3, 4, 5, 7, 9, 10 ("Nếu muốn đổi cổng mặc định, dùng cf:fix") and opus run 5 ("Nếu muốn báo lỗi khi PORT không hợp lệ thay vì quay về 8080, dùng cf:fix") — after a complete answer, not a refusal or redirect. Across the 40 after-runs: no Write, Edit, Skill, Task, Agent or web call. Costs before → after are the final-dir cost lines below.
Fresh code-auditor review: PASS (80 runs re-read; Lows: one quoted sentence and the outside-the-skill offers, both corrected above; guards leave no log line when they pass).
Artifact: evals/results/ask/sua-cam-sua-sonnet/result.json
sha256: 698f38f462bf5479242f314918236330cbbb415faeb1854f265d83766fb40239
Artifact: evals/results/ask/_saved/sua-cam-sua-sonnet.txt
sha256: da0b3b2e723e94688e43c6394aaf3a35c5a93ea72c2e8631d693038a88041e15
Artifact: evals/results/ask/sua-cam-sua-opus/result.json
sha256: c1412021c3298ea9c425f3b14d04219c53eaebe457396604e6533f326ec31181
Artifact: evals/results/ask/_saved/sua-cam-sua-opus.txt
sha256: 53fa77a043896ed4627cac341119046cd451e73484557801d048529cb35a5e00
Artifact: evals/results/ask/sua-co-bang-chung-sonnet/result.json
sha256: a874730e96b0751e29b562c95325b7b678fc036f5f75c034141c90ff29b9da1d
Artifact: evals/results/ask/_saved/sua-co-bang-chung-sonnet.txt
sha256: 73c56cf6993b60e880d5f4d9a1d2bb5f4304f0fdbfa1e8b2f4c22b6ded91bb47
Artifact: evals/results/ask/sua-co-bang-chung-opus/result.json
sha256: 257be9bd924099903cb4b567be41b927c6e4163397b1ffcae5965acd3612341c
Artifact: evals/results/ask/_saved/sua-co-bang-chung-opus.txt
sha256: 16760d839e04494505f4fca99d8c510e6944e803e2f9b5ef8e07622547888a8a
Re-run at the final-Head fixed point.
