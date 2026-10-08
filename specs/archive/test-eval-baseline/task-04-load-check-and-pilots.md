# Task 04 — `/cf:test` loads and pilots give ceilings

Status: done

## Outcome
With the plugin named `cf`, a load check (`nap-sach-sonnet` with 3 runs, `nap-sach-opus` with 1) shows the skill loading on all four runs; eight pilots `evals/results/test/pilot-<case>-<model>` hold one clean loaded run each, saved and archived; both ceilings, the budget fit, the skill digest and the `run.sh` digest print. Every pilot answer is read by hand. **No conclusion is drawn here.**

## Scope
- In: the load check, seven prerequisite pilots and the Command's pilot `pilot-thieu-cong-cu-opus` (plan D-05); a driver and log under `evals/results/test/_kept/t04/` following plan D-05 (skill digest recorded at start in `skill-digest`, resume checks with the saver's flags, archive before save, `STOP` file, `budget.mjs fits --assume-missing 4` before the Command); hand-reading every pilot answer and file state against every grader, passes included, and each `files`-target grader against the saved `git status`, with at most one grader-repair round (plan D-06).
- Out: the cells (task 05); any skill change.

## Coverage
- CP-04

## Ownership
- Create: `evals/results/test/nap-*`, `pilot-*` (and any `-lan1`), their `_saved/` files, `evals/results/test/_kept/`, `evals/results/test/_pilot-lan1/`
- Modify (grader-repair round only, plan D-06): `evals/test/*/graders/*.md`, `evals/test/check-fixtures.sh`, the Receipts of `task-02-four-cases-with-graders.md` and `task-03-save-compare-budget.md`
- Read: task 01's Receipt (`run-sh-sha256:`), task 03's Receipt (`evals-test-digest:`)

## Steps
1. Guards before every paid run: no `_kept/t04/STOP`; tasks 01 and 03 `done`; the `evals/test` digest equals task 03's line, `evals/run.sh` equals task 01's `run-sh-sha256:` and the skill digest equals `_kept/t04/skill-digest`; once, before the first paid run, `claude --plugin-dir <a copy of the plugin run.sh builds> plugin details cf` lists the skill `test` ($0); `node` v22.23.3 first on `PATH`, `git` `/opt/homebrew/bin/git`, `DISABLE_AUTOUPDATER=1`, `FORCE_COLOR` unset, `claude` 2.1.286; `budget.mjs check 4`.
2. Load check, sonnet then opus: `evals/run.sh test --plugin-name cf --out nap-sach-<model> --model <model> --judge-model sonnet --runs <3|1> --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case sach --keep-temp`, archived, then saved with `--require-loaded --require-clean <3|1>`; any unloaded run stops for the user; then read `slash_commands` of the init event and record whether it lists `cf:test`.
3. Pilots one at a time in the order `sach`, `do`, `khong-test`, `thieu-cong-cu` × `sonnet`, `opus` with the same flags and `--runs 1`, archived, then saved with `--require-loaded --require-clean 1`; plan D-06 for re-runs. Then `budget.mjs fits --assume-missing 4`, and the Command.
4. Read every pilot by hand; write the Receipt after a fresh review returns PASS.

## Acceptance
- AC-04: the Command exits 0; the `plugin details` guard listed `test`; the load check loaded on 4 of 4 runs; eight pilots of one clean loaded run each; `ceiling sonnet` and `ceiling opus` print integers and `fits` passes; `test-skill-digest:` and `run-sh-sha256:` print; `budget.mjs spent` within $100.

## Dependencies
- task-01-run-sh-plugin-name.md
- task-03-save-compare-budget.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-baseline && R=evals/results/test && grep -qx "Status: done" $F/task-01-run-sh-plugin-name.md && grep -qx "Status: done" $F/task-03-save-compare-budget.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-03-save-compare-budget.md && s=$(shasum -a 256 evals/run.sh | cut -d" " -f1) && grep -qF "run-sh-sha256: $s" $F/task-01-run-sh-plugin-name.md && [ ! -e $R/_kept/t04/STOP ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qx "$d" $R/_kept/t04/skill-digest && echo "test-skill-digest: $d" && echo "run-sh-sha256: $s" && node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 3 $R/nap-sach-sonnet && node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/nap-sach-opus $R/pilot-sach-sonnet $R/pilot-sach-opus $R/pilot-do-sonnet $R/pilot-do-opus $R/pilot-khong-test-sonnet $R/pilot-khong-test-opus $R/pilot-thieu-cong-cu-sonnet && { [ -e $R/pilot-thieu-cong-cu-opus ] || { node evals/test/budget.mjs check 4 && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out pilot-thieu-cong-cu-opus --model opus --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case thieu-cong-cu --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && { if [ -e $R/_kept/pilot-thieu-cong-cu-opus.tar.gz ] && [ -e $R/_saved/pilot-thieu-cong-cu-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-thieu-cong-cu-opus; else k=$(node evals/test/save-runs.mjs --kept $R/pilot-thieu-cong-cu-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/pilot-thieu-cong-cu-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-loaded --require-clean 1 $R/pilot-thieu-cong-cu-opus; fi; } && echo "ceiling-sonnet=$(node evals/test/budget.mjs ceiling sonnet)" && echo "ceiling-opus=$(node evals/test/budget.mjs ceiling opus)" && node evals/test/budget.mjs fits && node evals/test/budget.mjs spent'`
- Prerequisite runs: the $0 `plugin details cf` guard output; the load check and its `slash_commands` reading; seven pilots of Steps 2–3, each with exit, `result.json` path and `sha256`, budget and saver lines
- Named probe: the guards; `--check-saved` over the load check and seven pilots; the paid pilot, its saver and archive; both ceilings; `fits`; `spent`
- Reachability: known — `evals/run.sh test` builds the plugin from `packages/spec/src/claude/skills/test` (`evals/run.sh:31`); the load check establishes that `/cf:test` loads it
- Oracle: the Command exits 0 and prints both ceilings
- Counterexample: a changed instrument, skill or `run.sh`, another `node`, `git` or `claude`, a `STOP` file, an unloaded or unclean prerequisite fails before the paid pilot; a missing pilot makes `ceiling` exit 1; a re-run after the paid pilot skips it rather than paying again
- Artifacts: every `nap-*` and `pilot-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid pilot stops for the user; the Command's pilot gets no `-lan1` (plan D-06).

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/test-eval-baseline && R=evals/results/test && grep -qx "Status: done" $F/task-01-run-sh-plugin-name.md && grep -qx "Status: done" $F/task-03-save-compare-budget.md && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-test-digest: $n" $F/task-03-save-compare-budget.md && s=$(shasum -a 256 evals/run.sh | cut -d" " -f1) && grep -qF "run-sh-sha256: $s" $F/task-01-run-sh-plugin-name.md && [ ! -e $R/_kept/t04/STOP ] && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && d=$( (cd packages/spec/src/claude && find skills/test -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qx "$d" $R/_kept/t04/skill-digest && echo "test-skill-digest: $d" && echo "run-sh-sha256: $s" && node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 3 $R/nap-sach-sonnet && node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/nap-sach-opus $R/pilot-sach-sonnet $R/pilot-sach-opus $R/pilot-do-sonnet $R/pilot-do-opus $R/pilot-khong-test-sonnet $R/pilot-khong-test-opus $R/pilot-thieu-cong-cu-sonnet && { [ -e $R/pilot-thieu-cong-cu-opus ] || { node evals/test/budget.mjs check 4 && DISABLE_AUTOUPDATER=1 evals/run.sh test --plugin-name cf --out pilot-thieu-cong-cu-opus --model opus --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case thieu-cong-cu --keep-temp; }; } && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && { if [ -e $R/_kept/pilot-thieu-cong-cu-opus.tar.gz ] && [ -e $R/_saved/pilot-thieu-cong-cu-opus.txt ]; then node evals/test/save-runs.mjs --check-saved --require-loaded --require-clean 1 $R/pilot-thieu-cong-cu-opus; else k=$(node evals/test/save-runs.mjs --kept $R/pilot-thieu-cong-cu-opus) && (cd /private/tmp && chmod -R u+rwX $k) && tar -czf $R/_kept/pilot-thieu-cong-cu-opus.tar.gz -C /private/tmp $k && node evals/test/save-runs.mjs --require-loaded --require-clean 1 $R/pilot-thieu-cong-cu-opus; fi; } && echo "ceiling-sonnet=$(node evals/test/budget.mjs ceiling sonnet)" && echo "ceiling-opus=$(node evals/test/budget.mjs ceiling opus)" && node evals/test/budget.mjs fits && node evals/test/budget.mjs spent'
Exit: 0
Base: 69d08975a4aea14d5e0d07ef09ffd9ec3f7eae1b
Head: cc860298d1ce86c3ea3c6a73c9d226dba3191dee060a6bbe3b96eadb4a8584f1
```text
test-skill-digest: 80cd13e736d051691abeef1f2eeaefd330f4d660526eab6beaf6b4354de61862
run-sh-sha256: a75cd5b5fbe5b6438a5eea160625bf8380383b96ead35a54a6dc10b46764d4fa
nap-sach-sonnet saved ok runs=3 skill=loaded:3
nap-sach-opus saved ok runs=1 skill=loaded:1
pilot-sach-sonnet saved ok runs=1 skill=loaded:1
pilot-sach-opus saved ok runs=1 skill=loaded:1
pilot-do-sonnet saved ok runs=1 skill=loaded:1
pilot-do-opus saved ok runs=1 skill=loaded:1
pilot-khong-test-sonnet saved ok runs=1 skill=loaded:1
pilot-khong-test-opus saved ok runs=1 skill=loaded:1
pilot-thieu-cong-cu-sonnet saved ok runs=1 skill=loaded:1
spent=2.3815 next=4 total=6.3815 cap=100
Note: --scaffold runs each case's scaffold_script as you. Only use it on case files you (or your org) authored.
⚠ kept /private/tmp/e-7vEKqu: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-7vEKqu/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-7vEKqu /private/tmp/e-7vEKqu/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/test/pilot-thieu-cong-cu-opus/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/test/pilot-thieu-cong-cu-opus/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/test/pilot-thieu-cong-cu-opus (exit 0)
pilot-thieu-cong-cu-opus runs=1 errors=0 skill=loaded:1,none:0 lost=0 cap=0 saved=evals/results/test/_saved/pilot-thieu-cong-cu-opus.txt sha256=ada6564a0b2b6ab81b82c48a9bbcd6c9358acc618944c0875ff3c1460db5370f
ceiling-sonnet=4
ceiling-opus=5
spent=2.7112 missing=0 sonnet=4+0.2024 opus=5+0.3378 need=40.872 cap=100
spent=2.7112 cap=100
```

Fresh code-auditor review: PASS; every pilot answer and file state was hand-read against every grader, none misread.
Artifact: evals/results/test/nap-sach-sonnet/result.json
sha256: d7f457ff116e2f9d4d379c6ec63627af847679b2183c0c2cc57d2fefc9fc3e9e
Artifact: evals/results/test/_saved/nap-sach-sonnet.txt
sha256: d031cd2643419b3e16f60ea5e8a70434765802081c130adf41f9552a8da9898f
Artifact: evals/results/test/nap-sach-opus/result.json
sha256: 4aee4b9008014bddc7942568607ebc8842d0772f86510cb68c140b7f5ff1b920
Artifact: evals/results/test/_saved/nap-sach-opus.txt
sha256: 3185b7c5dbfa20440de68b3aa3ef6826cbbde32b8114eadac99c3bab0fbdfcd3
Artifact: evals/results/test/pilot-sach-sonnet/result.json
sha256: 977b423b926a8701c7e9dc7eaa2e50eec48c95183d2c2a598b32c689e54a83a2
Artifact: evals/results/test/_saved/pilot-sach-sonnet.txt
sha256: b0bec79b7f5ca294a66343025eb8db02054c308d6e933d904783fe844e1d7bf3
Artifact: evals/results/test/pilot-sach-opus/result.json
sha256: 91f2bf028527f036356cc3d641007258bcd94e0c32bf0a1b5cdded5bf2563bd6
Artifact: evals/results/test/_saved/pilot-sach-opus.txt
sha256: d40dfe8c21c9d352df808e86ae9b04bc63a584f46ca60e63482210b6668dc0ce
Artifact: evals/results/test/pilot-do-sonnet/result.json
sha256: 1b2a4de2c7b0f86b68b9a74a8c9d85a33ac31cdd8b143ab6a926ad882345c70d
Artifact: evals/results/test/_saved/pilot-do-sonnet.txt
sha256: 145b7095cce71fbf8a3774eb5b533b30d9c9e04956dfa61db88addfba68684af
Artifact: evals/results/test/pilot-do-opus/result.json
sha256: 8b845e288eed742f918b650ccefa479ae5bb42c157e96865327309db4ca439ea
Artifact: evals/results/test/_saved/pilot-do-opus.txt
sha256: a98ad1c1842d098a8b3a970758ced04bdb15d1e031528cd1d6da2c4e8428d699
Artifact: evals/results/test/pilot-khong-test-sonnet/result.json
sha256: dfe3c1abd5c40e9c13af00ffb6411ea73fc0e9a619562e24b2244f3abb99f71d
Artifact: evals/results/test/_saved/pilot-khong-test-sonnet.txt
sha256: 1ef574d87a6c517b9c4a03ffd787242e7a384019eadfa7d534947efe36da2542
Artifact: evals/results/test/pilot-khong-test-opus/result.json
sha256: 2959677596f17e7c63e5bc50bef3b462669ae1350157f42937a4a4a32fa3d812
Artifact: evals/results/test/_saved/pilot-khong-test-opus.txt
sha256: 5d3b5b0e5ab94f7f41d68e693724604ba2c65924524190d39b808a287ac67e80
Artifact: evals/results/test/pilot-thieu-cong-cu-sonnet/result.json
sha256: 21ad9af432ec514b410a1dca8c5d5830322f6c38de60a627dc5f4a5503fa22a6
Artifact: evals/results/test/_saved/pilot-thieu-cong-cu-sonnet.txt
sha256: 67118be1fba51454224c64a0c608f353275649414ced4027fdb946229cee96aa
Artifact: evals/results/test/pilot-thieu-cong-cu-opus/result.json
sha256: 0f5e8873615b752cc180abd43cb0ad21a4ea2d8f4bbc56612c3487e92f3efcb9
Artifact: evals/results/test/_saved/pilot-thieu-cong-cu-opus.txt
sha256: ada6564a0b2b6ab81b82c48a9bbcd6c9358acc618944c0875ff3c1460db5370f
