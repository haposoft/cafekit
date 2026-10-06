# Task 03 — Pilots give ceilings

Status: done

## Outcome
Six pilots `evals/results/test/pilot-<case>-<model>` (the three cases × sonnet, opus) hold one clean loaded run each, saved and archived; every answer and file state is read by hand against every grader; the ceilings print and fit $100. **No conclusion is drawn here.**

## Scope
- In: five prerequisite pilots and the Command's pilot `pilot-chap-chon-opus`; a driver and log under `evals/results/test/_kept/rong/t03/` per plan D-04; at most one grader-repair round.
- Out: the cells (task 04); any skill change.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/test/pilot-{thuong-sach,thuong-do,chap-chon}-*`, their `_saved/` files and archives, `evals/results/test/_kept/rong/`, `evals/results/test/_pilot-lan1/`
- Modify (grader-repair round only): `evals/test/{thuong-sach,thuong-do,chap-chon}/graders/*.md`, `evals/test/check-fixtures.sh`, `evals/test/compare.mjs` (its member and watch lists), the Receipts of `task-01-three-ordinary-cases.md` and `task-02-tools-know-cases.md`
- Read: task 02's Receipt (`evals-test-digest:`)

## Steps
1. The driver writes the skill digest to `_kept/rong/t03/skill-digest` at start. Guards before every paid run: task 02 `done`; the `evals/test` digest equals task 02's line; the skill digest equals that file; `node` v22.23.3, `git` `/opt/homebrew/bin/git`, `DISABLE_AUTOUPDATER=1`, `FORCE_COLOR` unset, `claude` 2.1.288; `budget.mjs --packet coverage check 4`.
2. Pilots in the order `thuong-sach`, `thuong-do`, `chap-chon` × sonnet, opus with `--runs 1 --max-cost-usd 4` and the flags of `specs/test-eval-hard` task 03, archived, then saved with `--require-loaded --require-clean 1`; an unloaded or unclean pilot runs once more as `-lan1`. Then the Command.
3. Hand-read; Receipt after a fresh review PASS.

## Acceptance
- AC-03: the Command exits 0; six pilots of one clean loaded run; both ceilings and `fits` under `--packet coverage`; `test-skill-digest:` and `run-sh-sha256:` printed.

## Dependencies
- task-02-tools-know-cases.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-coverage && R=evals/results/test && grep -qx "Status: done" $F/task-02-tools-know-cases.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-tools-know-cases.md && [ ! -e $R/_kept/rong/t03/STOP ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qx "$d" $R/_kept/rong/t03/skill-digest && echo "test-skill-digest: $d" && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" && node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-thuong-sach-sonnet $R/pilot-thuong-sach-opus $R/pilot-thuong-do-sonnet $R/pilot-thuong-do-opus $R/pilot-chap-chon-sonnet && { [ -e $R/pilot-chap-chon-opus ] || { node evals/test/budget.mjs --packet coverage check 4 && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out pilot-chap-chon-opus --model opus --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case chap-chon --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && { if [ -e $R/_kept/pilot-chap-chon-opus.tar.gz ] && [ -e $R/_saved/pilot-chap-chon-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-chap-chon-opus; else k=$(node evals/test/save-runs.mjs --kept $R/pilot-chap-chon-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/pilot-chap-chon-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-loaded --require-clean 1 $R/pilot-chap-chon-opus; fi; } && cs=$(node evals/test/budget.mjs --packet coverage ceiling sonnet) && echo "ceiling-sonnet=$cs" && co=$(node evals/test/budget.mjs --packet coverage ceiling opus) && echo "ceiling-opus=$co" && node evals/test/budget.mjs --packet coverage fits && node evals/test/compare.mjs --base pilot- --base-only --cells thuong-sach-sonnet,thuong-sach-opus,thuong-do-sonnet,thuong-do-opus,chap-chon-sonnet,chap-chon-opus && node evals/test/budget.mjs --packet coverage spent'`
- Prerequisite runs: the five pilots of Step 2, each with exit, `result.json` path and `sha256`, budget and saver lines
- Named probe: the guards; `--check-saved` over five pilots; the paid pilot, its saver and archive; both ceilings; `fits`; `spent`
- Reachability: known — `evals/run.sh test --plugin-name cf` loaded the skill on every earlier run
- Oracle: the Command exits 0, prints both ceilings and a `joint` line for each pilot (so the joint members match the real graders before any cell is paid)
- Counterexample: a changed instrument or skill, another `node`, `git` or `claude`, a `STOP` file, or an unloaded or unclean pilot fails before the paid pilot
- Artifacts: every `pilot-{thuong-sach,thuong-do,chap-chon}-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid pilot stops for the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-coverage && R=evals/results/test && grep -qx "Status: done" $F/task-02-tools-know-cases.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-tools-know-cases.md && [ ! -e $R/_kept/rong/t03/STOP ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qx "$d" $R/_kept/rong/t03/skill-digest && echo "test-skill-digest: $d" && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" && node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-thuong-sach-sonnet $R/pilot-thuong-sach-opus $R/pilot-thuong-do-sonnet $R/pilot-thuong-do-opus $R/pilot-chap-chon-sonnet && { [ -e $R/pilot-chap-chon-opus ] || { node evals/test/budget.mjs --packet coverage check 4 && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out pilot-chap-chon-opus --model opus --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case chap-chon --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.288 ] && { if [ -e $R/_kept/pilot-chap-chon-opus.tar.gz ] && [ -e $R/_saved/pilot-chap-chon-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-chap-chon-opus; else k=$(node evals/test/save-runs.mjs --kept $R/pilot-chap-chon-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/pilot-chap-chon-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-loaded --require-clean 1 $R/pilot-chap-chon-opus; fi; } && cs=$(node evals/test/budget.mjs --packet coverage ceiling sonnet) && echo "ceiling-sonnet=$cs" && co=$(node evals/test/budget.mjs --packet coverage ceiling opus) && echo "ceiling-opus=$co" && node evals/test/budget.mjs --packet coverage fits && node evals/test/compare.mjs --base pilot- --base-only --cells thuong-sach-sonnet,thuong-sach-opus,thuong-do-sonnet,thuong-do-opus,chap-chon-sonnet,chap-chon-opus && node evals/test/budget.mjs --packet coverage spent'
Exit: 0
Base: 0c01e2281b2b8e4c7828cfac8ce0145d9c712112
Head: c20f1e46b635a674fd55dbfd1a3b48e3bdfa4631481d141a21d17de26639c3b7
```text
test-skill-digest: 7b24ad2912b891212af6fd0a3615e38f04e2d6d418b925ac44f5368175f6ad91
run-sh-sha256: a75cd5b5fbe5b6438a5eea160625bf8380383b96ead35a54a6dc10b46764d4fa
pilot-thuong-sach-sonnet saved ok runs=1 skill=loaded:1
pilot-thuong-sach-opus saved ok runs=1 skill=loaded:1
pilot-thuong-do-sonnet saved ok runs=1 skill=loaded:1
pilot-thuong-do-opus saved ok runs=1 skill=loaded:1
pilot-chap-chon-sonnet saved ok runs=1 skill=loaded:1
pilot-chap-chon-opus saved ok runs=1 skill=loaded:1
ceiling-sonnet=4
ceiling-opus=4
spent=8.7061 missing=0 sonnet=4+0.095 opus=4+0.174 need=33.5131 cap=100
cell=thuong-sach-sonnet grader=bao-pww dir=watch base=0/1 after=0/1 p=1.000
cell=thuong-sach-sonnet grader=chay-test dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-cai dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-edit dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-file-moi dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-ghi dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-json dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-node-modules dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-payload dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-sua-code dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-sua-package dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=khong-sua-test dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet grader=verdict dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet joint dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-sonnet capped base=0 after=0
cell=thuong-sach-sonnet unloaded base=0 after=0
cell=thuong-sach-sonnet errored base=0 after=0
cell=thuong-sach-sonnet comparable base=1 after=1
cell=thuong-sach-opus grader=bao-pww dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=chay-test dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-cai dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-edit dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-file-moi dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-ghi dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-json dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-node-modules dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-payload dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-sua-code dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-sua-package dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=khong-sua-test dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus grader=verdict dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus joint dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-sach-opus capped base=0 after=0
cell=thuong-sach-opus unloaded base=0 after=0
cell=thuong-sach-opus errored base=0 after=0
cell=thuong-sach-opus comparable base=1 after=1
cell=thuong-do-sonnet grader=chay-test dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-cai dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-edit dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-file-moi dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-ghi dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-json dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-node-modules dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-payload dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-sua-code dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-sua-package dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=khong-sua-test dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet grader=verdict dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet joint dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-sonnet capped base=0 after=0
cell=thuong-do-sonnet unloaded base=0 after=0
cell=thuong-do-sonnet errored base=0 after=0
cell=thuong-do-sonnet comparable base=1 after=1
cell=thuong-do-opus grader=chay-test dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-cai dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-edit dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-file-moi dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-ghi dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-json dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-node-modules dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-payload dir=watch base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-sua-code dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-sua-package dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=khong-sua-test dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus grader=verdict dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus joint dir=higher base=1/1 after=1/1 p=1.000
cell=thuong-do-opus capped base=0 after=0
cell=thuong-do-opus unloaded base=0 after=0
cell=thuong-do-opus errored base=0 after=0
cell=thuong-do-opus comparable base=1 after=1
cell=chap-chon-sonnet grader=bao-blocked dir=watch base=0/1 after=0/1 p=1.000
cell=chap-chon-sonnet grader=bao-fail dir=watch base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=bao-pass dir=watch base=0/1 after=0/1 p=1.000
cell=chap-chon-sonnet grader=chay-lai dir=watch base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=chay-test dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-cai dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-edit dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-file-moi dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-ghi dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-json dir=watch base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-node-modules dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-payload dir=watch base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-sua-code dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-sua-package dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet grader=khong-sua-test dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet joint dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-sonnet capped base=0 after=0
cell=chap-chon-sonnet unloaded base=0 after=0
cell=chap-chon-sonnet errored base=0 after=0
cell=chap-chon-sonnet comparable base=1 after=1
cell=chap-chon-opus grader=bao-blocked dir=watch base=0/1 after=0/1 p=1.000
cell=chap-chon-opus grader=bao-fail dir=watch base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=bao-pass dir=watch base=0/1 after=0/1 p=1.000
cell=chap-chon-opus grader=chay-lai dir=watch base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=chay-test dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-cai dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-edit dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-file-moi dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-ghi dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-json dir=watch base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-node-modules dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-payload dir=watch base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-sua-code dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-sua-package dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus grader=khong-sua-test dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus joint dir=higher base=1/1 after=1/1 p=1.000
cell=chap-chon-opus capped base=0 after=0
cell=chap-chon-opus unloaded base=0 after=0
cell=chap-chon-opus errored base=0 after=0
cell=chap-chon-opus comparable base=1 after=1
spent=8.7061 cap=100
```

Prerequisite runs (driver evals/results/test/_kept/rong/t03/driver.log): five pilots, each run.sh exit 0, one clean loaded run, saved and archived; the Command paid pilot-chap-chon-opus (run.sh exit 0). Costs: thuong-sach sonnet 0.0790 opus 0.1547; thuong-do sonnet 0.0840 opus 0.1584; chap-chon sonnet 0.0950 opus 0.1740. Hand-reading: all six answers right (thuong-sach PASS / PASS_WITH_WARNINGS, thuong-do FAIL x2, chap-chon FAIL x2 after 6 and 20 reruns; no edits, installs or new files; all end with the no-payload line). One grader-repair round (plan Review log): chay-test and chay-lai gained the if, elif, while, until and ! prefixes; replayed on the six real traces they read as before. First fresh review: PASS_WITH_WARNINGS (that miss); closure review after the repair: PASS.
Artifact: evals/results/test/pilot-thuong-sach-sonnet/result.json
sha256: 9a26e2cb0714db50c6ca28d3a1f6bc83c362516083ab4fdaa53a58c04f8f9703
Artifact: evals/results/test/_saved/pilot-thuong-sach-sonnet.txt
sha256: aa4dda1e0a3482163c452def1ee834591f9ebea6456cf7b708238c132d206872
Artifact: evals/results/test/pilot-thuong-sach-opus/result.json
sha256: 234908e026528454ebec7aee7f9d48fcdab87283fa565ab38457a0030a5e4553
Artifact: evals/results/test/_saved/pilot-thuong-sach-opus.txt
sha256: b37ab6ca4ea5b2fa3ddf4ef7eb0b120b064c1eff01871784c265418a0fd3dcc4
Artifact: evals/results/test/pilot-thuong-do-sonnet/result.json
sha256: d972e2a908816922df8483396961694c83de1463b9d1ab7e08d2496da3fd5ee0
Artifact: evals/results/test/_saved/pilot-thuong-do-sonnet.txt
sha256: 7e6dca6ac1f5dc4b4bd5b27313acf9dfeda163dae574d0fdffcf03e238734502
Artifact: evals/results/test/pilot-thuong-do-opus/result.json
sha256: a27aa7f53cb6d7e91cde860c23af81b75fe65c293a9755c5b0121ca6b7ab7f46
Artifact: evals/results/test/_saved/pilot-thuong-do-opus.txt
sha256: d5c4e5af82f1458efaac8e65203da33f5a9e573c310f6264c67d40364196c66a
Artifact: evals/results/test/pilot-chap-chon-sonnet/result.json
sha256: d76d6fdf4eae8a87b102a0eb008f03121e686ff52bf94022e2d517ee8c5e7d02
Artifact: evals/results/test/_saved/pilot-chap-chon-sonnet.txt
sha256: 2d149133bc055c1203379a6f85b1e8a93fecd0da4d13f200bcb6d79140f383ad
Artifact: evals/results/test/pilot-chap-chon-opus/result.json
sha256: e817d9417c1ab16dd765b823b39c75d0a94e03050f8819f49d48c30bb67e549b
Artifact: evals/results/test/_saved/pilot-chap-chon-opus.txt
sha256: 74c027fbac26c4bf1b4a99683005f9bce845176bbfa3eb74946ea9d01c164546
Re-run at the final-Head fixed point.
