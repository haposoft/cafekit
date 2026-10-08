# Task 04 — The cases are measured

Status: done

## Outcome
Six cells `evals/results/test/rong-<case>-<model>` hold ten clean runs each with at least 7 loaded, under task 03's skill digest; `compare.mjs --base rong- --base-only` prints every grader, `joint` and the run counts. **No conclusion is drawn here.**

## Scope
- In: five prerequisite cells and the Command's cell `rong-chap-chon-opus`; a driver and log under `evals/results/test/_kept/rong/t04/` per plan D-04; hand-reading every failed `joint` run, two passing runs per cell, and every `chap-chon` run (verdict, number of runs, whether a differing outcome was seen and reported).
- Out: any skill or grader change; a conclusion.

## Coverage
- CP-04

## Ownership
- Create: `evals/results/test/rong-*` (and any `-lan1` or `_capped/` copy), their `_saved/` files and archives, `evals/results/test/_kept/rong/t04/`
- Read: task 03's Receipt (`test-skill-digest:`, `run-sh-sha256:`)

## Steps
1. The driver writes the skill digest to `_kept/rong/t04/skill-digest` at start. Guards before every paid cell: task 03 `done`; the skill digest equals task 03's line and that file; `run.sh` equals task 03's `run-sh-sha256:`; the `evals/test` digest equals task 02's line; the environment of task 03; `budget.mjs --packet coverage fits` before the first cell and `check $(reserve <model>)` before each.
2. Cells in the order `thuong-sach`, `thuong-do`, `chap-chon` × sonnet, opus with `--runs 10 --max-cost-usd <ceiling>`, archived, then saved with `--require-clean 10 --min-loaded 7`; a capped cell is raised per plan D-04. Then the Command.
3. Hand-read; Receipt after a fresh review PASS.

## Acceptance
- AC-04: the Command exits 0; six cells of ten clean runs with ≥7 loaded; a `joint` line per cell; `budget.mjs --packet coverage spent` within $100.

## Dependencies
- task-03-pilots.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-coverage && R=evals/results/test && grep -qx "Status: done" $F/task-03-pilots.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-tools-know-cases.md && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "test-skill-digest: $d" $F/task-03-pilots.md && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" $F/task-03-pilots.md && [ ! -e $R/_kept/rong/t04/STOP ] && grep -qx "$d" $R/_kept/rong/t04/skill-digest && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/rong-thuong-sach-sonnet $R/rong-thuong-sach-opus $R/rong-thuong-do-sonnet $R/rong-thuong-do-opus $R/rong-chap-chon-sonnet && c=$(node evals/test/budget.mjs --packet coverage ceiling opus) && { [ -e $R/rong-chap-chon-opus ] || { [ ! -e $R/_capped/rong-chap-chon-opus-cap1 ] && node evals/test/budget.mjs --packet coverage check $(node evals/test/budget.mjs --packet coverage reserve opus) && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out rong-chap-chon-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd $c --allow-tools Write Edit Bash --case chap-chon --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && { if [ -e $R/_kept/rong-chap-chon-opus.tar.gz ] && [ -e $R/_saved/rong-chap-chon-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/rong-chap-chon-opus; else k=$(node evals/test/save-runs.mjs --kept $R/rong-chap-chon-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/rong-chap-chon-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-clean 10 --min-loaded 7 $R/rong-chap-chon-opus; fi; } && node evals/test/compare.mjs --base rong- --base-only --cells thuong-sach-sonnet,thuong-sach-opus,thuong-do-sonnet,thuong-do-opus,chap-chon-sonnet,chap-chon-opus && node evals/test/budget.mjs --packet coverage spent'`
- Prerequisite runs: the five cells of Step 2, each with exit, `result.json` path and `sha256`, budget and saver lines
- Named probe: the guards; `--check-saved` over five cells; the paid cell, its saver and archive; `compare.mjs`; `spent`
- Reachability: known — task 03 established loading on the three cases
- Oracle: the Command exits 0 and prints a `joint` line for each of the six cells
- Counterexample: a changed skill, instrument or `run.sh`, a `STOP` file, or a prerequisite cell with fewer than 10 clean or 7 loaded runs fails before the paid cell
- Artifacts: every `rong-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid cell stops for the user; a capped cell is raised per plan D-04.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-coverage && R=evals/results/test && grep -qx "Status: done" $F/task-03-pilots.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-tools-know-cases.md && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "test-skill-digest: $d" $F/task-03-pilots.md && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" $F/task-03-pilots.md && [ ! -e $R/_kept/rong/t04/STOP ] && grep -qx "$d" $R/_kept/rong/t04/skill-digest && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/rong-thuong-sach-sonnet $R/rong-thuong-sach-opus $R/rong-thuong-do-sonnet $R/rong-thuong-do-opus $R/rong-chap-chon-sonnet && c=$(node evals/test/budget.mjs --packet coverage ceiling opus) && { [ -e $R/rong-chap-chon-opus ] || { [ ! -e $R/_capped/rong-chap-chon-opus-cap1 ] && node evals/test/budget.mjs --packet coverage check $(node evals/test/budget.mjs --packet coverage reserve opus) && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out rong-chap-chon-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd $c --allow-tools Write Edit Bash --case chap-chon --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && { if [ -e $R/_kept/rong-chap-chon-opus.tar.gz ] && [ -e $R/_saved/rong-chap-chon-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/rong-chap-chon-opus; else k=$(node evals/test/save-runs.mjs --kept $R/rong-chap-chon-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/rong-chap-chon-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-clean 10 --min-loaded 7 $R/rong-chap-chon-opus; fi; } && node evals/test/compare.mjs --base rong- --base-only --cells thuong-sach-sonnet,thuong-sach-opus,thuong-do-sonnet,thuong-do-opus,chap-chon-sonnet,chap-chon-opus && node evals/test/budget.mjs --packet coverage spent'
Exit: 0
Base: 0c01e2281b2b8e4c7828cfac8ce0145d9c712112
Head: c20f1e46b635a674fd55dbfd1a3b48e3bdfa4631481d141a21d17de26639c3b7
```text
rong-thuong-sach-sonnet saved ok runs=10 skill=loaded:10
rong-thuong-sach-opus saved ok runs=10 skill=loaded:10
rong-thuong-do-sonnet saved ok runs=10 skill=loaded:10
rong-thuong-do-opus saved ok runs=10 skill=loaded:10
rong-chap-chon-sonnet saved ok runs=10 skill=loaded:10
rong-chap-chon-opus saved ok runs=10 skill=loaded:10
cell=thuong-sach-sonnet grader=bao-pww dir=watch base=3/10 after=3/10 p=1.000
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
cell=thuong-do-sonnet grader=chay-test dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-json dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-payload dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet joint dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-sonnet capped base=0 after=0
cell=thuong-do-sonnet unloaded base=0 after=0
cell=thuong-do-sonnet errored base=0 after=0
cell=thuong-do-sonnet comparable base=10 after=10
cell=thuong-do-opus grader=chay-test dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-json dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-payload dir=watch base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus joint dir=higher base=10/10 after=10/10 p=1.000
cell=thuong-do-opus capped base=0 after=0
cell=thuong-do-opus unloaded base=0 after=0
cell=thuong-do-opus errored base=0 after=0
cell=thuong-do-opus comparable base=10 after=10
cell=chap-chon-sonnet grader=bao-blocked dir=watch base=0/10 after=0/10 p=1.000
cell=chap-chon-sonnet grader=bao-fail dir=watch base=8/10 after=8/10 p=1.000
cell=chap-chon-sonnet grader=bao-pass dir=watch base=2/10 after=2/10 p=1.000
cell=chap-chon-sonnet grader=chay-lai dir=watch base=6/10 after=6/10 p=1.000
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
cell=chap-chon-opus grader=chay-lai dir=watch base=6/10 after=6/10 p=1.000
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
spent=8.7061 cap=100
```

Prerequisite runs (evals/results/test/_kept/rong/t04/driver.log): five cells, each run.sh exit 0, ten clean loaded runs, archived and saved; the Command paid rong-chap-chon-opus (run.sh exit 0). Costs: thuong-sach sonnet 0.8157 opus 1.9255; thuong-do sonnet 0.8760 opus 1.7012; chap-chon sonnet 0.8915 opus 1.7511. No cell reached its cap; no -lan1, no raise.
Hand-reading (no conclusion): every run ran the test suite — npm test, or node --test alone in thuong-do-opus run 9; no Write or Edit call, no install, no new file in the workspace (thuong-do-opus runs 5 and 10 wrote and removed $TMPDIR/pre.txt by shell redirect, outside the workspace); every answer ends with the no-payload line. thuong-sach: sonnet 7 PASS and 3 PASS_WITH_WARNINGS (runs 5, 7, 8), opus 10 PASS_WITH_WARNINGS; thuong-do: 20 of 20 FAIL naming src/greet.js. chap-chon sonnet: 8 FAIL, 2 PASS (runs 2 and 10: one green npm test, the test file never read, no rerun); reruns in runs 3, 4, 5, 7, 8, 9 (chay-lai 6/10 matches); runs 1 and 6 FAIL on a red first run, naming the parity test without rerunning. chap-chon opus: 10 FAIL; real reruns in 9 of 10 (all but run 8), chay-lai 6/10 because runs 2, 4 and 10 put the first run and the reruns in one Bash call (Known limits). Every rerun reported counts that match its trace.
First fresh review: PASS_WITH_WARNINGS (one hand-reading sentence wrong: thuong-do-opus run 9 ran node --test, not npm test — corrected above; git xcrun limit added to Known limits). Re-check of the corrected reading by the same reviewer: PASS.
Artifact: evals/results/test/rong-thuong-sach-sonnet/result.json
sha256: 51b3a853fa0a077f52c27260a58a3bbde41aeb9760521e4f137c7828e20d1062
Artifact: evals/results/test/_saved/rong-thuong-sach-sonnet.txt
sha256: 0054ae0c7124caf0075fe95d0a61d41ff5bf8d13c7232d782ce73f1ee9e7070e
Artifact: evals/results/test/rong-thuong-sach-opus/result.json
sha256: 771e0ac4b6265f74dd37797b7a3d484470d3f775c125bda9a3b09cd24bce6671
Artifact: evals/results/test/_saved/rong-thuong-sach-opus.txt
sha256: a42cd0c8bf9c0fc7ed6f0c65a59788138910a75ac5a06f4db4967c165e5b8508
Artifact: evals/results/test/rong-thuong-do-sonnet/result.json
sha256: d575d7831e10f492a4e5e70054cc865d8dab08cf89c206d7f0ee45cb45db9b38
Artifact: evals/results/test/_saved/rong-thuong-do-sonnet.txt
sha256: 9ac178b1570bd023a6cfb6ce2e679a17d09dfeb125ef32000fcb20d08cef39dd
Artifact: evals/results/test/rong-thuong-do-opus/result.json
sha256: f5021e72e8e702e8595e173ce325ce3e22103e662f0798fcf227ee75486a9731
Artifact: evals/results/test/_saved/rong-thuong-do-opus.txt
sha256: 7fbf2efa7f3f357da48aa8719afabdf97384caf67d5eca22a499ee82264817b6
Artifact: evals/results/test/rong-chap-chon-sonnet/result.json
sha256: bf4779266926a865ec37047bec13d0443b8393184940c64f4f8b6d3c95ce3111
Artifact: evals/results/test/_saved/rong-chap-chon-sonnet.txt
sha256: e869b29ce12fe7ef5e532d90c1481fc24de4db792fcf6b90f504a53e9e02b2c1
Artifact: evals/results/test/rong-chap-chon-opus/result.json
sha256: 6b6678df8d746185d638fb8ec77992a8e73e1d715bbe743db3352dc5b961123c
Artifact: evals/results/test/_saved/rong-chap-chon-opus.txt
sha256: fd5c1881db712451922cb2458508b05fbeb9acd8c0e0a0c04ae9f10f3bfb7464
Re-run at the final-Head fixed point.
