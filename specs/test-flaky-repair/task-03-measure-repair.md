# Task 03 — The repair is measured

Status: done

## Outcome
Four cells `evals/results/test/ondinh-<case>-<model>` (`thuong-sach`, `chap-chon` × sonnet, opus) hold ten clean runs each with at least 7 loaded, under task 01's skill digest; `compare.mjs --base rong- --after ondinh-` prints every grader, `joint` and the run counts against the before-cells. **No conclusion is drawn here.**

## Scope
- In: three prerequisite cells and the Command's cell `ondinh-chap-chon-opus`; a driver and log under `evals/results/test/_kept/ondinh/t03/` per plan D-04; hand-reading per plan D-04.
- Out: any skill or grader change; a conclusion.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/test/ondinh-*` (and any `-lan1` or `_capped/` copy), their `_saved/` files and archives, `evals/results/test/_kept/ondinh/t03/`
- Read: task 01's Receipt (`test-skill-digest:`), task 02's Receipt (`evals-test-digest:`), `specs/test-eval-coverage/task-03-pilots.md` (`run-sh-sha256:`), `evals/results/test/_kept/rong/t04/drive.sh`

## Steps
1. The driver (derived from `specs/test-eval-coverage`'s `_kept/rong/t04/drive.sh`) writes the skill digest to `_kept/ondinh/t03/skill-digest` at start. Guards before every paid cell: tasks 01 and 02 `done`; `evals/test/{thuong-sach,chap-chon,fixture}`, `compare.mjs`, `save-runs.mjs` and `evals/run.sh` unchanged since `d3f9da7`; the skill digest equals task 01's line and that file; `run.sh` equals the coverage packet's `run-sh-sha256:`; the `evals/test` digest equals task 02's line; `node` v22.23.3, `git` `/opt/homebrew/bin/git`, `DISABLE_AUTOUPDATER=1`, `FORCE_COLOR` unset, `claude` 2.1.288; `budget.mjs --packet flaky fits` before the first cell and `check $(reserve <model>)` before each.
2. Cells in the order `thuong-sach` × sonnet, opus, then `chap-chon` × sonnet, with `--runs 10 --max-cost-usd <ceiling>`, archived, then saved with `--require-clean 10 --min-loaded 7`; a capped cell is raised per plan D-04. Then the Command.
3. Hand-read per plan D-04, including whether each `chap-chon` answer names the clock source and whether the agent placed it in the assertion; Receipt after a fresh review PASS.

## Acceptance
- AC-03: the Command exits 0; four cells of ten clean runs with ≥7 loaded; a `joint` line per cell against `rong-*`; `budget.mjs --packet flaky spent` within $100.

## Dependencies
- task-01-skill-reads-and-reruns.md
- task-02-flaky-budget.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-flaky-repair && R=evals/results/test && grep -qx "Status: done" $F/task-01-skill-reads-and-reruns.md && grep -qx "Status: done" $F/task-02-flaky-budget.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-flaky-budget.md && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "test-skill-digest: $d" $F/task-01-skill-reads-and-reruns.md && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" specs/test-eval-coverage/task-03-pilots.md && git diff --quiet d3f9da7 -- evals/test/thuong-sach evals/test/chap-chon evals/test/fixture evals/test/compare.mjs evals/test/save-runs.mjs evals/run.sh && [ ! -e $R/_kept/ondinh/t03/STOP ] && grep -qx "$d" $R/_kept/ondinh/t03/skill-digest && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/ondinh-thuong-sach-sonnet $R/ondinh-thuong-sach-opus $R/ondinh-chap-chon-sonnet && c=$(node evals/test/budget.mjs --packet flaky ceiling opus) && { [ -e $R/ondinh-chap-chon-opus ] || { [ ! -e $R/_capped/ondinh-chap-chon-opus-cap1 ] && node evals/test/budget.mjs --packet flaky check $(node evals/test/budget.mjs --packet flaky reserve opus) && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out ondinh-chap-chon-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd $c --allow-tools Write Edit Bash --case chap-chon --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && { if [ -e $R/_kept/ondinh-chap-chon-opus.tar.gz ] && [ -e $R/_saved/ondinh-chap-chon-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/ondinh-chap-chon-opus; else k=$(node evals/test/save-runs.mjs --kept $R/ondinh-chap-chon-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/ondinh-chap-chon-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-clean 10 --min-loaded 7 $R/ondinh-chap-chon-opus; fi; } && node evals/test/compare.mjs --base rong- --after ondinh- --cells thuong-sach-sonnet,thuong-sach-opus,chap-chon-sonnet,chap-chon-opus && node -e "const fs=require(\"fs\"),R=\"evals/results/test/\";const r=(p)=>{const d=fs.existsSync(p+\"-lan1\")?p+\"-lan1\":p;return JSON.parse(fs.readFileSync(d+\"/result.json\",\"utf8\")).costUsd};for(const c of [\"thuong-sach-sonnet\",\"thuong-sach-opus\",\"chap-chon-sonnet\",\"chap-chon-opus\"])console.log(\"final-dir cost cell=\"+c+\" before=\"+r(R+\"rong-\"+c).toFixed(4)+\" after=\"+r(R+\"ondinh-\"+c).toFixed(4))" && node evals/test/budget.mjs --packet flaky spent'`
- Prerequisite runs: the three cells of Step 2, each with exit, `result.json` path and `sha256`, budget and saver lines
- Named probe: the guards; `--check-saved` over three cells; the paid cell, its saver and archive; `compare.mjs`; `spent`
- Reachability: known — `evals/run.sh test --plugin-name cf` loaded the skill on 60 of 60 `rong-*` runs
- Oracle: the Command exits 0 and prints a `joint` line for each of the four cells with `base` from `rong-*` and `after` from `ondinh-*`, and a `final-dir cost cell=` line per pair (the cell's final directory; a raised cell's `_capped/` copies are listed by the driver log)
- Counterexample: a changed skill, instrument or `run.sh`, a `STOP` file, or a prerequisite cell with fewer than 10 clean or 7 loaded runs fails before the paid cell
- Artifacts: every `ondinh-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid cell stops for the user; a capped cell is raised per plan D-04.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-flaky-repair && R=evals/results/test && grep -qx "Status: done" $F/task-01-skill-reads-and-reruns.md && grep -qx "Status: done" $F/task-02-flaky-budget.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-flaky-budget.md && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "test-skill-digest: $d" $F/task-01-skill-reads-and-reruns.md && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" specs/test-eval-coverage/task-03-pilots.md && git diff --quiet d3f9da7 -- evals/test/thuong-sach evals/test/chap-chon evals/test/fixture evals/test/compare.mjs evals/test/save-runs.mjs evals/run.sh && [ ! -e $R/_kept/ondinh/t03/STOP ] && grep -qx "$d" $R/_kept/ondinh/t03/skill-digest && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/ondinh-thuong-sach-sonnet $R/ondinh-thuong-sach-opus $R/ondinh-chap-chon-sonnet && c=$(node evals/test/budget.mjs --packet flaky ceiling opus) && { [ -e $R/ondinh-chap-chon-opus ] || { [ ! -e $R/_capped/ondinh-chap-chon-opus-cap1 ] && node evals/test/budget.mjs --packet flaky check $(node evals/test/budget.mjs --packet flaky reserve opus) && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out ondinh-chap-chon-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd $c --allow-tools Write Edit Bash --case chap-chon --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && { if [ -e $R/_kept/ondinh-chap-chon-opus.tar.gz ] && [ -e $R/_saved/ondinh-chap-chon-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/ondinh-chap-chon-opus; else k=$(node evals/test/save-runs.mjs --kept $R/ondinh-chap-chon-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/ondinh-chap-chon-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-clean 10 --min-loaded 7 $R/ondinh-chap-chon-opus; fi; } && node evals/test/compare.mjs --base rong- --after ondinh- --cells thuong-sach-sonnet,thuong-sach-opus,chap-chon-sonnet,chap-chon-opus && node -e "const fs=require(\"fs\"),R=\"evals/results/test/\";const r=(p)=>{const d=fs.existsSync(p+\"-lan1\")?p+\"-lan1\":p;return JSON.parse(fs.readFileSync(d+\"/result.json\",\"utf8\")).costUsd};for(const c of [\"thuong-sach-sonnet\",\"thuong-sach-opus\",\"chap-chon-sonnet\",\"chap-chon-opus\"])console.log(\"final-dir cost cell=\"+c+\" before=\"+r(R+\"rong-\"+c).toFixed(4)+\" after=\"+r(R+\"ondinh-\"+c).toFixed(4))" && node evals/test/budget.mjs --packet flaky spent'
Exit: 0
Base: 0920a6171805ca51bf4662fdc803f7b5f437b40e
Head: 9bcbe289ec3a2ded5f1e627b17d0e459ef640cf5b043e38ee72ba11a172af951
```text
ondinh-thuong-sach-sonnet saved ok runs=10 skill=loaded:10
ondinh-thuong-sach-opus saved ok runs=10 skill=loaded:10
ondinh-chap-chon-sonnet saved ok runs=10 skill=loaded:10
ondinh-chap-chon-opus saved ok runs=10 skill=loaded:10
cell=thuong-sach-sonnet grader=bao-pww dir=watch base=3/10 after=4/10 p=1.000
cell=thuong-sach-sonnet grader=chay-test dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-json dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-payload dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet joint dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-sonnet capped base=0 after=0
cell=thuong-sach-sonnet unloaded base=0 after=0
cell=thuong-sach-sonnet errored base=0 after=0
cell=thuong-sach-sonnet comparable base=10 after=10
cell=thuong-sach-opus grader=bao-pww dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=chay-test dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-json dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-payload dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus joint dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-sach-opus capped base=0 after=0
cell=thuong-sach-opus unloaded base=0 after=0
cell=thuong-sach-opus errored base=0 after=0
cell=thuong-sach-opus comparable base=10 after=10
cell=chap-chon-sonnet grader=bao-blocked dir=watch base=0/10 after=0/10 p=1.000
cell=chap-chon-sonnet grader=bao-fail dir=watch base=8/10 after=10/10 p=0.4737
cell=chap-chon-sonnet grader=bao-pass dir=watch base=2/10 after=0/10 p=0.4737
cell=chap-chon-sonnet grader=chay-lai dir=watch base=6/10 after=3/10 p=0.3698
cell=chap-chon-sonnet grader=chay-test dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-json dir=watch base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-payload dir=watch base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet joint dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-sonnet capped base=0 after=0
cell=chap-chon-sonnet unloaded base=0 after=0
cell=chap-chon-sonnet errored base=0 after=0
cell=chap-chon-sonnet comparable base=10 after=10
cell=chap-chon-opus grader=bao-blocked dir=watch base=0/10 after=0/10 p=1.000
cell=chap-chon-opus grader=bao-fail dir=watch base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=bao-pass dir=watch base=0/10 after=0/10 p=1.000
cell=chap-chon-opus grader=chay-lai dir=watch base=6/10 after=4/10 p=0.6563
cell=chap-chon-opus grader=chay-test dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-json dir=watch base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-payload dir=watch base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus joint dir=higher base=10/10 after=10/10 p=1.000
cell=chap-chon-opus capped base=0 after=0
cell=chap-chon-opus unloaded base=0 after=0
cell=chap-chon-opus errored base=0 after=0
cell=chap-chon-opus comparable base=10 after=10
final-dir cost cell=thuong-sach-sonnet before=0.8157 after=0.8582
final-dir cost cell=thuong-sach-opus before=1.9255 after=1.6732
final-dir cost cell=chap-chon-sonnet before=0.8915 after=0.8775
final-dir cost cell=chap-chon-opus before=1.7511 after=1.6258
spent=5.0347 cap=100
```

Prerequisite runs (evals/results/test/_kept/ondinh/t03/driver.log): three cells, each run.sh exit 0, ten clean loaded runs, archived and saved; the Command paid ondinh-chap-chon-opus (run.sh exit 0). No cap reached, no -lan1, no raise, no lost file. Comparability: all 80 traces (rong-* and ondinh-*) on claude 2.1.288 with the same model ids (claude-sonnet-5-5, claude-opus-5-5); evals/test, fixture, cases and run.sh unchanged since d3f9da7 (guarded); the only difference is the skill digest (7b24ad29… before, ec7beef9… after).
Hand-reading (no conclusion; before → after):
- chap-chon sonnet: PASS 2/10 → 0/10, FAIL 8/10 → 10/10; test read 8/10 → 10/10 (before runs 2 and 10 never read it); every after answer names the process.hrtime parity check and places it in the assertion. Real reruns 6/10 → 7/10 (after runs 1, 2, 3, 6, 8, 9, 10); chay-lai reads 6/10 → 3/10 only because after runs 1, 2, 9 and 10 put the first run and the reruns in one Bash call; runs 4, 5 and 7 return FAIL from reading the assertion without rerunning (run 4: "the verdict follows from reading it"; run 7's only run failed). All seven after runs that rerun (1, 2, 3, 6, 8, 9, 10) report differing outcomes.
- chap-chon opus: FAIL 10/10 both sides; test read 10/10 both sides; every after answer names the process.hrtime parity check and places it in the assertion. Real reruns 9/10 → 4/10 (after runs 2, 3, 4, 7); chay-lai 6/10 → 4/10. The other six after runs return FAIL from the assertion without rerunning (in runs 1, 5, 6 and 9 the single run also failed). After runs 2, 3, 4 and 7 report differing outcomes.
- thuong-sach: verdict right 10/10 both sides (sonnet 7 PASS + 3 PWW → 6 PASS + 4 PWW; opus 10 PWW both); test read 10/10 both sides; all 20 after answers say the tests are deterministic, 18 of them that no rerun is needed (opus runs 8 and 9 say only "Flakiness: none"); no false FAIL. Real reruns 0/10 in all four thuong-sach cells; npm test ran twice only to recover the exit code in sonnet before run 5 and after runs 3, 7 and 10.
- Final-directory cost before → after: thuong-sach sonnet 0.8157 → 0.8582, opus 1.9255 → 1.6732; chap-chon sonnet 0.8915 → 0.8775, opus 1.7511 → 1.6258.
First fresh review: FAIL on the hand-reading only (the chay-lai drop was explained in the wrong direction; opus reruns and differing outcomes were missing; thuong-sach double runs unmentioned). Second fresh review of the corrected reading: FAIL (sonnet runs 2 and 9 missing from the differing-outcome list; thuong-sach reruns and the before exit-code repeat; the opus source sentence) — corrected above; no cell re-run. Third review of that correction: PASS.
Artifact: evals/results/test/ondinh-thuong-sach-sonnet/result.json
sha256: 651f553526868ade8e31ea1a05d467ef2ef10d2dc294407b625b0430389eaa11
Artifact: evals/results/test/_saved/ondinh-thuong-sach-sonnet.txt
sha256: aa20ced4e1acd36b295948993a33e36baedd73dd79ed9eb8d6b20a35df6b32d8
Artifact: evals/results/test/ondinh-thuong-sach-opus/result.json
sha256: fb5cf93ed95f02de9bf4635b2cdd3a229767cadf7676aa9f6befd5850c42df94
Artifact: evals/results/test/_saved/ondinh-thuong-sach-opus.txt
sha256: f6a3a2415e85fce48bbc6f5d2f11647d26113a5b267b282e23ab00c1d6b9e117
Artifact: evals/results/test/ondinh-chap-chon-sonnet/result.json
sha256: c032412c3a1d55304b09b5d72676bd41da7efb8e1fbe26308768922b054c09cb
Artifact: evals/results/test/_saved/ondinh-chap-chon-sonnet.txt
sha256: adecfc37dff8a9658bdfc118bca61c2515ec1ccbc9a546bb7ea2e67f10b56f97
Artifact: evals/results/test/ondinh-chap-chon-opus/result.json
sha256: 855f2dca2269da525140b529297b560d18f7267f42370a93a5ece9ccf04341cf
Artifact: evals/results/test/_saved/ondinh-chap-chon-opus.txt
sha256: 5444a4e6c8a4cff49622f4c585052ce0f993bb1435addc9115eea41d554ca7d5
Re-run at the final-Head fixed point.
