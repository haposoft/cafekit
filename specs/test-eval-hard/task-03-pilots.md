# Task 03 — Pilots give ceilings

Status: done

## Outcome
Six pilots `evals/results/test/pilot-<case>-<model>` (the three new cases × sonnet, opus) hold one clean loaded run each, saved and archived; every answer and file state is read by hand against every grader; the ceilings print and fit $100. **No conclusion is drawn here.**

## Scope
- In: five prerequisite pilots and the Command's pilot `pilot-khong-cham-code-opus`; a driver and log under `evals/results/test/_kept/hard/t03/` (plan D-05); at most one grader-repair round (plan D-02).
- Out: the cells (task 04); any skill change.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/test/pilot-{tron-legacy,trung-probe,khong-cham-code}-*`, their `_saved/` files and archives, `evals/results/test/_kept/hard/`, `evals/results/test/_pilot-lan1/`
- Modify (grader-repair round only, plan D-05): `evals/test/{tron-legacy,trung-probe,khong-cham-code}/graders/*.md`, `evals/test/check-fixtures.sh`, the Receipts of `task-01-three-hard-cases.md` and `task-02-payload-checker-and-tools.md`
- Read: task 02's Receipt (`evals-test-digest:`)

## Steps
1. The driver writes the skill digest to `_kept/hard/t03/skill-digest` when it first starts and stops if it later differs. Guards before every paid run: task 02 `done`; the `evals/test` digest equals task 02's line; the skill digest equals `_kept/hard/t03/skill-digest`; `node` v22.23.3, `git` `/opt/homebrew/bin/git`, `DISABLE_AUTOUPDATER=1`, `FORCE_COLOR` unset, `claude` 2.1.286; `budget.mjs --packet hard check 4`.
2. Pilots in the order `tron-legacy`, `trung-probe`, `khong-cham-code` × `sonnet`, `opus`: `evals/run.sh test --plugin-name cf --out pilot-<case>-<model> --model <model> --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case <case> --keep-temp`, archived, then saved with `--require-loaded --require-clean 1`; an unloaded or unclean pilot runs once more as `-lan1`. Then the Command.
3. Hand-read; Receipt after a fresh review PASS.

## Acceptance
- AC-03: the Command exits 0; six pilots of one clean loaded run; `ceiling sonnet`, `ceiling opus` and `fits` under `--packet hard`; `test-skill-digest:` and `run-sh-sha256:` printed.

## Dependencies
- task-02-payload-checker-and-tools.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-hard && R=evals/results/test && grep -qx "Status: done" $F/task-02-payload-checker-and-tools.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-payload-checker-and-tools.md && [ ! -e $R/_kept/hard/t03/STOP ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qx "$d" $R/_kept/hard/t03/skill-digest && echo "test-skill-digest: $d" && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" && node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-tron-legacy-sonnet $R/pilot-tron-legacy-opus $R/pilot-trung-probe-sonnet $R/pilot-trung-probe-opus $R/pilot-khong-cham-code-sonnet && { [ -e $R/pilot-khong-cham-code-opus ] || { node evals/test/budget.mjs --packet hard check 4 && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out pilot-khong-cham-code-opus --model opus --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case khong-cham-code --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && { if [ -e $R/_kept/pilot-khong-cham-code-opus.tar.gz ] && [ -e $R/_saved/pilot-khong-cham-code-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-khong-cham-code-opus; else k=$(node evals/test/save-runs.mjs --kept $R/pilot-khong-cham-code-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/pilot-khong-cham-code-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-loaded --require-clean 1 $R/pilot-khong-cham-code-opus; fi; } && cs=$(node evals/test/budget.mjs --packet hard ceiling sonnet) && echo "ceiling-sonnet=$cs" && co=$(node evals/test/budget.mjs --packet hard ceiling opus) && echo "ceiling-opus=$co" && node evals/test/budget.mjs --packet hard fits && node evals/test/budget.mjs --packet hard spent'`
- Prerequisite runs: the five pilots of Step 2, each with exit, `result.json` path and `sha256`, budget and saver lines
- Named probe: the guards; `--check-saved` over five pilots; the paid pilot, its saver and archive; both ceilings; `fits`; `spent`
- Reachability: known — `evals/run.sh test --plugin-name cf` loaded the skill on 80 of 80 runs in `specs/test-eval-baseline`
- Oracle: the Command exits 0 and prints both ceilings
- Counterexample: a changed instrument or skill, another `node`, `git` or `claude`, a `STOP` file, or an unloaded or unclean pilot fails before the paid pilot
- Artifacts: every `pilot-{tron-legacy,trung-probe,khong-cham-code}-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid pilot stops for the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-hard && R=evals/results/test && grep -qx "Status: done" $F/task-02-payload-checker-and-tools.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-02-payload-checker-and-tools.md && [ ! -e $R/_kept/hard/t03/STOP ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qx "$d" $R/_kept/hard/t03/skill-digest && echo "test-skill-digest: $d" && echo "run-sh-sha256: $(shasum -a 256 evals/run.sh | cut -d" " -f1)" && node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-tron-legacy-sonnet $R/pilot-tron-legacy-opus $R/pilot-trung-probe-sonnet $R/pilot-trung-probe-opus $R/pilot-khong-cham-code-sonnet && { [ -e $R/pilot-khong-cham-code-opus ] || { node evals/test/budget.mjs --packet hard check 4 && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out pilot-khong-cham-code-opus --model opus --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case khong-cham-code --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && { if [ -e $R/_kept/pilot-khong-cham-code-opus.tar.gz ] && [ -e $R/_saved/pilot-khong-cham-code-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-khong-cham-code-opus; else k=$(node evals/test/save-runs.mjs --kept $R/pilot-khong-cham-code-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/pilot-khong-cham-code-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-loaded --require-clean 1 $R/pilot-khong-cham-code-opus; fi; } && cs=$(node evals/test/budget.mjs --packet hard ceiling sonnet) && echo "ceiling-sonnet=$cs" && co=$(node evals/test/budget.mjs --packet hard ceiling opus) && echo "ceiling-opus=$co" && node evals/test/budget.mjs --packet hard fits && node evals/test/budget.mjs --packet hard spent'
Exit: 0
Base: d9529f2859a5ff4c08e62bef97d48b38ec183f16
Head: d8774fb227188ca5b313dd488e72c23204b8c03c0dc33e7769df18ec4543e918
```text
test-skill-digest: 80cd13e736d051691abeef1f2eeaefd330f4d660526eab6beaf6b4354de61862
run-sh-sha256: a75cd5b5fbe5b6438a5eea160625bf8380383b96ead35a54a6dc10b46764d4fa
pilot-tron-legacy-sonnet saved ok runs=1 skill=loaded:1
pilot-tron-legacy-opus saved ok runs=1 skill=loaded:1
pilot-trung-probe-sonnet saved ok runs=1 skill=loaded:1
pilot-trung-probe-opus saved ok runs=1 skill=loaded:1
pilot-khong-cham-code-sonnet saved ok runs=1 skill=loaded:1
spent=0.8812 next=4 total=4.8812 cap=100
Note: --scaffold runs each case's scaffold_script as you. Only use it on case files you (or your org) authored.
⚠ kept /private/tmp/e-Q9qZUi: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-Q9qZUi/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-Q9qZUi /private/tmp/e-Q9qZUi/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/test/pilot-khong-cham-code-opus/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/test/pilot-khong-cham-code-opus/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/test/pilot-khong-cham-code-opus (exit 0)
pilot-khong-cham-code-opus runs=1 errors=0 skill=loaded:1,none:0 lost=0 cap=0 saved=evals/results/test/_saved/pilot-khong-cham-code-opus.txt sha256=9d6e022a473cf81ced5c485ce8e60a9fd30305be65c0aa6ced18cdcf5aafc108
ceiling-sonnet=4
ceiling-opus=5
spent=1.1851 missing=0 sonnet=4+0.128 opus=5+0.3526 need=29.6269 cap=100
spent=1.1851 cap=100
```

Fresh code-auditor review: PASS; every pilot answer, file state and grader hand-read against its trace, no pass/fail misread.
Artifact: evals/results/test/pilot-tron-legacy-sonnet/result.json
sha256: 6e44026f7d98a8f8db61fd0c5fc16784a8c30b94a00d07ad51a7e2ae18f43e3d
Artifact: evals/results/test/_saved/pilot-tron-legacy-sonnet.txt
sha256: 85f6f8fe8d48497e88ee51d345321f72fea098f0abddb7e10cd0a379c7dc2795
Artifact: evals/results/test/pilot-tron-legacy-opus/result.json
sha256: b7bae05361d2fbb85a4d7200fb17fbfa12b810ba8b7047381c0d8bcb0526ccef
Artifact: evals/results/test/_saved/pilot-tron-legacy-opus.txt
sha256: e62aa7010ed563c5cad3cfdfe37ce8f03288abd36ba8a6a259ed9ded2713dd07
Artifact: evals/results/test/pilot-trung-probe-sonnet/result.json
sha256: 934b0f742917ead281c5d9e72fb39eff2876922569a90c4d6e1564e6c1f46bd7
Artifact: evals/results/test/_saved/pilot-trung-probe-sonnet.txt
sha256: c154b98e749758483bb1141af18cb916ca2c516fe99453dc95cbda90159c4e7a
Artifact: evals/results/test/pilot-trung-probe-opus/result.json
sha256: d2e4a81005da9215b2225b66af1337a5361d63dbcf0ba224ac6632f8543d775f
Artifact: evals/results/test/_saved/pilot-trung-probe-opus.txt
sha256: 92a4a73e06d8acbc04e49fbc311d3e79e216f5c3a127b661b75284490c463f04
Artifact: evals/results/test/pilot-khong-cham-code-sonnet/result.json
sha256: d9020ee5dbca157dfcbd0d45a8916ac72107837047e764128efb8ca24470bbe8
Artifact: evals/results/test/_saved/pilot-khong-cham-code-sonnet.txt
sha256: 4bc75e72b457a9f8fb740e774f11eae9943eb56ec8e52d1349cd1856d32bdf00
Artifact: evals/results/test/pilot-khong-cham-code-opus/result.json
sha256: b52b0cb6f8e42d104d05266d4bf88292ae2c2f0854efbb590473936cf0950025
Artifact: evals/results/test/_saved/pilot-khong-cham-code-opus.txt
sha256: 9d6e022a473cf81ced5c485ce8e60a9fd30305be65c0aa6ced18cdcf5aafc108
