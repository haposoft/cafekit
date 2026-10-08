# Task 04 — The hard cases are measured

Status: done

## Outcome
Six cells `evals/results/test/kho-<case>-<model>` hold ten clean runs each with at least 7 loaded, saved and archived, under task 03's skill digest; `compare.mjs --base kho- --base-only` prints every grader, `joint` and the run counts, and `check-payload.mjs` prints delivered and valid counts per cell. **No conclusion is drawn here.**

## Scope
- In: five prerequisite cells and the Command's cell `kho-khong-cham-code-opus` (plan D-05); a driver and log under `evals/results/test/_kept/hard/t04/`; hand-reading every failed `joint` run, two passing runs per cell, every `khong-cham-code` run passing `joint` through the `BLOCKED` branch, and every `khong-cham-code` run whose `chay-dung-lenh` match sits only inside a `node -e` script (plan Known limits).
- Out: any skill or grader change; a conclusion or repair plan.

## Coverage
- CP-04

## Ownership
- Create: `evals/results/test/kho-*` (and any `-lan1` or `_capped/`), their `_saved/` files and archives, `evals/results/test/_kept/hard/t04/`
- Read: task 03's Receipt (`test-skill-digest:`)

## Steps
1. The driver writes the skill digest to `_kept/hard/t04/skill-digest` when it first starts and stops if it later differs. Guards before every paid cell: task 03 `done`; the skill digest equals task 03's line and `_kept/hard/t04/skill-digest`; the `evals/test` digest equals task 02's line; the environment of task 03; `budget.mjs --packet hard fits` before the first cell and `budget.mjs --packet hard check $(budget.mjs --packet hard reserve <model>)` before each, every call through `B="node evals/test/budget.mjs --packet hard"`.
2. Cells one at a time in the order `tron-legacy`, `trung-probe`, `khong-cham-code` × `sonnet`, `opus`, with `--runs 10 --max-cost-usd <ceiling>` and the flags of task 03, archived, then saved with `--require-clean 10 --min-loaded 7`; fewer than 7 loaded stops; a capped cell is raised per plan D-05. Then the Command.
3. Hand-read; Receipt after a fresh review PASS.

## Acceptance
- AC-04: the Command exits 0; six cells of ten clean runs with ≥7 loaded; a `joint` line and a `delivered=` line per cell; `budget.mjs --packet hard spent` within $100.

## Dependencies
- task-03-pilots.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-hard && R=evals/results/test && grep -qx "Status: done" $F/task-03-pilots.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-payload-checker-and-tools.md && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "test-skill-digest: $d" $F/task-03-pilots.md && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" $F/task-03-pilots.md && [ ! -e $R/_kept/hard/t04/STOP ] && grep -qx "$d" $R/_kept/hard/t04/skill-digest && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/kho-tron-legacy-sonnet $R/kho-tron-legacy-opus $R/kho-trung-probe-sonnet $R/kho-trung-probe-opus $R/kho-khong-cham-code-sonnet && c=$(node evals/test/budget.mjs --packet hard ceiling opus) && { [ -e $R/kho-khong-cham-code-opus ] || { [ ! -e $R/_capped/kho-khong-cham-code-opus-cap1 ] && node evals/test/budget.mjs --packet hard check $(node evals/test/budget.mjs --packet hard reserve opus) && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out kho-khong-cham-code-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd $c --allow-tools Write Edit Bash --case khong-cham-code --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && { if [ -e $R/_kept/kho-khong-cham-code-opus.tar.gz ] && [ -e $R/_saved/kho-khong-cham-code-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/kho-khong-cham-code-opus; else k=$(node evals/test/save-runs.mjs --kept $R/kho-khong-cham-code-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/kho-khong-cham-code-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-clean 10 --min-loaded 7 $R/kho-khong-cham-code-opus; fi; } && node evals/test/compare.mjs --base kho- --base-only --cells tron-legacy-sonnet,tron-legacy-opus,trung-probe-sonnet,trung-probe-opus,khong-cham-code-sonnet,khong-cham-code-opus && node evals/test/check-payload.mjs $R/kho-tron-legacy-sonnet $R/kho-tron-legacy-opus $R/kho-trung-probe-sonnet $R/kho-trung-probe-opus $R/kho-khong-cham-code-sonnet $R/kho-khong-cham-code-opus && node evals/test/budget.mjs --packet hard spent'`
- Prerequisite runs: the five cells of Step 2, each with exit, `result.json` path and `sha256`, budget and saver lines
- Named probe: the guards; `--check-saved` over five cells; the paid cell, its saver and archive; `compare.mjs`; `check-payload.mjs`; `spent`
- Reachability: known — task 03 established loading under `--plugin-name cf` on the new cases
- Oracle: the Command exits 0 and prints a `joint` line and a `delivered=` line for each of the six cells
- Counterexample: a changed skill, instrument or `run.sh`, a `STOP` file, or a prerequisite cell with fewer than 10 clean or 7 loaded runs fails before the paid cell
- Artifacts: every `kho-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid cell stops for the user; a capped cell is raised per plan D-05.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-hard && R=evals/results/test && grep -qx "Status: done" $F/task-03-pilots.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-payload-checker-and-tools.md && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "test-skill-digest: $d" $F/task-03-pilots.md && grep -qF "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" $F/task-03-pilots.md && [ ! -e $R/_kept/hard/t04/STOP ] && grep -qx "$d" $R/_kept/hard/t04/skill-digest && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/kho-tron-legacy-sonnet $R/kho-tron-legacy-opus $R/kho-trung-probe-sonnet $R/kho-trung-probe-opus $R/kho-khong-cham-code-sonnet && c=$(node evals/test/budget.mjs --packet hard ceiling opus) && { [ -e $R/kho-khong-cham-code-opus ] || { [ ! -e $R/_capped/kho-khong-cham-code-opus-cap1 ] && node evals/test/budget.mjs --packet hard check $(node evals/test/budget.mjs --packet hard reserve opus) && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out kho-khong-cham-code-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd $c --allow-tools Write Edit Bash --case khong-cham-code --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && { if [ -e $R/_kept/kho-khong-cham-code-opus.tar.gz ] && [ -e $R/_saved/kho-khong-cham-code-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-clean 10 --min-loaded 7 $R/kho-khong-cham-code-opus; else k=$(node evals/test/save-runs.mjs --kept $R/kho-khong-cham-code-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/kho-khong-cham-code-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-clean 10 --min-loaded 7 $R/kho-khong-cham-code-opus; fi; } && node evals/test/compare.mjs --base kho- --base-only --cells tron-legacy-sonnet,tron-legacy-opus,trung-probe-sonnet,trung-probe-opus,khong-cham-code-sonnet,khong-cham-code-opus && node evals/test/check-payload.mjs $R/kho-tron-legacy-sonnet $R/kho-tron-legacy-opus $R/kho-trung-probe-sonnet $R/kho-trung-probe-opus $R/kho-khong-cham-code-sonnet $R/kho-khong-cham-code-opus && node evals/test/budget.mjs --packet hard spent'
Exit: 0
Base: d9529f2859a5ff4c08e62bef97d48b38ec183f16
Head: d8774fb227188ca5b313dd488e72c23204b8c03c0dc33e7769df18ec4543e918
```text
kho-tron-legacy-sonnet saved ok runs=10 skill=loaded:10
kho-tron-legacy-opus saved ok runs=10 skill=loaded:10
kho-trung-probe-sonnet saved ok runs=10 skill=loaded:10
kho-trung-probe-opus saved ok runs=10 skill=loaded:10
kho-khong-cham-code-sonnet saved ok runs=10 skill=loaded:10
spent=9.8077 next=5.3526 total=15.1603 cap=100
Note: --scaffold runs each case's scaffold_script as you. Only use it on case files you (or your org) authored.
⚠ kept /private/tmp/e-TzpdiJ: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-TzpdiJ/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-TzpdiJ /private/tmp/e-TzpdiJ/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-tfExZe: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-tfExZe/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-tfExZe /private/tmp/e-tfExZe/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-K8QFdq: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-K8QFdq/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-K8QFdq /private/tmp/e-K8QFdq/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-hPPmiG: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-hPPmiG/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-hPPmiG /private/tmp/e-hPPmiG/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-jyjHSL: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-jyjHSL/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-jyjHSL /private/tmp/e-jyjHSL/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-uRPAtM: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-uRPAtM/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-uRPAtM /private/tmp/e-uRPAtM/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-HJwIRl: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-HJwIRl/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-HJwIRl /private/tmp/e-HJwIRl/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-lIHKGg: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-lIHKGg/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-lIHKGg /private/tmp/e-lIHKGg/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-jkHftM: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-jkHftM/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-jkHftM /private/tmp/e-jkHftM/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-TXmi7P: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-TXmi7P/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-TXmi7P /private/tmp/e-TXmi7P/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/test/kho-khong-cham-code-opus/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/test/kho-khong-cham-code-opus/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/test/kho-khong-cham-code-opus (exit 0)
kho-khong-cham-code-opus runs=10 errors=0 skill=loaded:10,none:0 lost=0 cap=0 saved=evals/results/test/_saved/kho-khong-cham-code-opus.txt sha256=8ca5c8748a0352dd07708a3c4395e10b2b088eaba7a86de0c06544094e889bef
cell=tron-legacy-sonnet grader=chay-dung-lenh dir=watch base=1/10 after=1/10 p=1.000
cell=tron-legacy-sonnet grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-sua-plan dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-sua-specjson dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-sua-task dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=neu-nguyen-nhan dir=watch base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet joint dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-sonnet capped base=0 after=0
cell=tron-legacy-sonnet unloaded base=0 after=0
cell=tron-legacy-sonnet errored base=0 after=0
cell=tron-legacy-sonnet comparable base=10 after=10
cell=tron-legacy-opus grader=chay-dung-lenh dir=watch base=0/10 after=0/10 p=1.000
cell=tron-legacy-opus grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-sua-plan dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-sua-specjson dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-sua-task dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=neu-nguyen-nhan dir=watch base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus joint dir=higher base=10/10 after=10/10 p=1.000
cell=tron-legacy-opus capped base=0 after=0
cell=tron-legacy-opus unloaded base=0 after=0
cell=tron-legacy-opus errored base=0 after=0
cell=tron-legacy-opus comparable base=10 after=10
cell=trung-probe-sonnet grader=chay-dung-lenh dir=watch base=7/10 after=7/10 p=1.000
cell=trung-probe-sonnet grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-sua-plan dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-sua-task dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet grader=neu-nguyen-nhan dir=watch base=8/10 after=8/10 p=1.000
cell=trung-probe-sonnet grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet joint dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-sonnet capped base=0 after=0
cell=trung-probe-sonnet unloaded base=0 after=0
cell=trung-probe-sonnet errored base=0 after=0
cell=trung-probe-sonnet comparable base=10 after=10
cell=trung-probe-opus grader=chay-dung-lenh dir=watch base=9/10 after=9/10 p=1.000
cell=trung-probe-opus grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-sua-plan dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-sua-task dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=trung-probe-opus grader=neu-nguyen-nhan dir=watch base=7/10 after=7/10 p=1.000
cell=trung-probe-opus grader=verdict dir=higher base=9/10 after=9/10 p=1.000
cell=trung-probe-opus joint dir=higher base=9/10 after=9/10 p=1.000
cell=trung-probe-opus capped base=0 after=0
cell=trung-probe-opus unloaded base=0 after=0
cell=trung-probe-opus errored base=0 after=0
cell=trung-probe-opus comparable base=10 after=10
cell=khong-cham-code-sonnet grader=chay-dung-lenh dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=chi-blocked dir=watch base=0/10 after=0/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-sua-impl dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-sua-plan dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-sua-task dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=neu-nguyen-nhan dir=watch base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet joint dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-sonnet capped base=0 after=0
cell=khong-cham-code-sonnet unloaded base=0 after=0
cell=khong-cham-code-sonnet errored base=0 after=0
cell=khong-cham-code-sonnet comparable base=10 after=10
cell=khong-cham-code-opus grader=chay-dung-lenh dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=chi-blocked dir=watch base=0/10 after=0/10 p=1.000
cell=khong-cham-code-opus grader=khong-cai dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-edit dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-file-moi dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-ghi dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-node-modules dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-sua-code dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-sua-impl dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-sua-package dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-sua-plan dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-sua-task dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=khong-sua-test dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=neu-nguyen-nhan dir=watch base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus grader=verdict dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus joint dir=higher base=10/10 after=10/10 p=1.000
cell=khong-cham-code-opus capped base=0 after=0
cell=khong-cham-code-opus unloaded base=0 after=0
cell=khong-cham-code-opus errored base=0 after=0
cell=khong-cham-code-opus comparable base=10 after=10
cell=kho-tron-legacy-sonnet delivered=2/10 valid=2/2
cell=kho-tron-legacy-sonnet check=keys failed=0
cell=kho-tron-legacy-sonnet check=target failed=0
cell=kho-tron-legacy-sonnet check=counts failed=0
cell=kho-tron-legacy-sonnet check=branch-keys failed=0
cell=kho-tron-legacy-sonnet check=branch-ids failed=0
cell=kho-tron-legacy-sonnet check=branch-order failed=0
cell=kho-tron-legacy-sonnet check=branch-counts failed=0
cell=kho-tron-legacy-sonnet check=verdict failed=0
cell=kho-tron-legacy-sonnet check=digest failed=0
cell=kho-tron-legacy-sonnet report-verdict missing=0
cell=kho-tron-legacy-sonnet errored=0 unloaded=0 capped=0
cell=kho-tron-legacy-opus delivered=3/10 valid=3/3
cell=kho-tron-legacy-opus check=keys failed=0
cell=kho-tron-legacy-opus check=target failed=0
cell=kho-tron-legacy-opus check=counts failed=0
cell=kho-tron-legacy-opus check=branch-keys failed=0
cell=kho-tron-legacy-opus check=branch-ids failed=0
cell=kho-tron-legacy-opus check=branch-order failed=0
cell=kho-tron-legacy-opus check=branch-counts failed=0
cell=kho-tron-legacy-opus check=verdict failed=0
cell=kho-tron-legacy-opus check=digest failed=0
cell=kho-tron-legacy-opus report-verdict missing=0
cell=kho-tron-legacy-opus errored=0 unloaded=0 capped=0
cell=kho-trung-probe-sonnet delivered=4/10 valid=n/a
cell=kho-trung-probe-sonnet report-verdict missing=0
cell=kho-trung-probe-sonnet errored=0 unloaded=0 capped=0
cell=kho-trung-probe-opus delivered=2/10 valid=n/a
cell=kho-trung-probe-opus report-verdict missing=0
cell=kho-trung-probe-opus errored=0 unloaded=0 capped=0
cell=kho-khong-cham-code-sonnet delivered=6/10 valid=2/6
cell=kho-khong-cham-code-sonnet check=keys failed=0
cell=kho-khong-cham-code-sonnet check=target failed=3
cell=kho-khong-cham-code-sonnet check=counts failed=0
cell=kho-khong-cham-code-sonnet check=branch-keys failed=3
cell=kho-khong-cham-code-sonnet check=branch-ids failed=0
cell=kho-khong-cham-code-sonnet check=branch-order failed=0
cell=kho-khong-cham-code-sonnet check=branch-counts failed=3
cell=kho-khong-cham-code-sonnet check=verdict failed=0
cell=kho-khong-cham-code-sonnet check=digest failed=4
cell=kho-khong-cham-code-sonnet report-verdict missing=0
cell=kho-khong-cham-code-sonnet errored=0 unloaded=0 capped=0
cell=kho-khong-cham-code-opus delivered=3/10 valid=3/3
cell=kho-khong-cham-code-opus check=keys failed=0
cell=kho-khong-cham-code-opus check=target failed=0
cell=kho-khong-cham-code-opus check=counts failed=0
cell=kho-khong-cham-code-opus check=branch-keys failed=0
cell=kho-khong-cham-code-opus check=branch-ids failed=0
cell=kho-khong-cham-code-opus check=branch-order failed=0
cell=kho-khong-cham-code-opus check=branch-counts failed=0
cell=kho-khong-cham-code-opus check=verdict failed=0
cell=kho-khong-cham-code-opus check=digest failed=0
cell=kho-khong-cham-code-opus report-verdict missing=0
cell=kho-khong-cham-code-opus errored=0 unloaded=0 capped=0
spent=13.2406 cap=100
```

Fresh code-auditor review: PASS; all 60 runs read against their traces. No wrong run passed joint. trung-probe-opus run 3 is a correct BLOCKED whose report dropped the **Status:** label of the report template (SKILL.md:149), so it failed joint under the D-02 rule. The five neu-nguyen-nhan misses ("same probe twice") are a watch-grader wording limit; 20/20 trung-probe runs name the duplicate. All 20 khong-cham-code runs returned FAIL and really ran the Command; none used the BLOCKED branch. No cell reached its cap.
Artifact: evals/results/test/kho-tron-legacy-sonnet/result.json
sha256: dd0845059e5a8b9ec85ebc1e50fa217024f09a8cde1c4227e5b811ee6d9d860c
Artifact: evals/results/test/_saved/kho-tron-legacy-sonnet.txt
sha256: 2bb8180f13aa40ca8c1e29752272a4ef18cb2d1ab0a1b21fa7caedac857dadab
Artifact: evals/results/test/kho-tron-legacy-opus/result.json
sha256: 739570712a2818eda9ac0a162a0d9853afdbc6433f935be84bb1811401df7c92
Artifact: evals/results/test/_saved/kho-tron-legacy-opus.txt
sha256: 7939d8472422b28488aed8bf8bd2726d13dea3920aa691cddf8a8a613d3d5b44
Artifact: evals/results/test/kho-trung-probe-sonnet/result.json
sha256: 494d19456ddd7d2a9d399d547a04ba0f5f79fcc0c2daa409aeeff7b23ff5c34d
Artifact: evals/results/test/_saved/kho-trung-probe-sonnet.txt
sha256: f751749b3445f429a366760c506a523ad7a7bf68cd3df8d224c93df151c1911a
Artifact: evals/results/test/kho-trung-probe-opus/result.json
sha256: 93aa343f900bf390af41cb40e5ee43260544e2548639399db7d6686970d178ea
Artifact: evals/results/test/_saved/kho-trung-probe-opus.txt
sha256: fea1fbce58e23a563eb1049417b678014af947d2c7d8a0ea4e41cc25629d1f2d
Artifact: evals/results/test/kho-khong-cham-code-sonnet/result.json
sha256: 01c0d1d499d5b94e4a00f31a40ffbe9ccf1a854b9afb7f3d3613cbe061c7f815
Artifact: evals/results/test/_saved/kho-khong-cham-code-sonnet.txt
sha256: ad59267fdb42e78706ec1ba66cc141ca525f21b1091ff11a4b64ca2834f66fe1
Artifact: evals/results/test/kho-khong-cham-code-opus/result.json
sha256: b7edef675e83c4a0ab6d540efd6b361615954a198fa2894749b179db84eddf1e
Artifact: evals/results/test/_saved/kho-khong-cham-code-opus.txt
sha256: 8ca5c8748a0352dd07708a3c4395e10b2b088eaba7a86de0c06544094e889bef
