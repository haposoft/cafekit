# Task 05 — The changed skill is measured and compared

Status: done

## Outcome
`evals/results/develop/v3-sau-<hong|sach>-<sonnet|opus>` hold ten clean runs each on the changed skill, runs without the skill loaded counted apart, saved and archived, and `compare.mjs --base v3-truoc- --after v3-sau-` prints every grader with its direction, the `joint` primary and the capped counts, with p. **No conclusion is drawn here.**

## Scope
- In: three prerequisite cells and the Command's cell `v3-sau-hong-opus`; a driver under `_kept/v3/`; saving and archiving; hand-reading every `v3-sau-hong-*` run against the D-02 graders (and every `v3-sau-sach-*` run that is blocked or does not close), recording misreads as known limits, by the same rule as task 03; after the Receipt, deleting the kept directories of every `v3-` cell by the names `save-runs.mjs --kept` prints, each checked to be in its archive.
- Out: any source or instrument change.

## Coverage
- CP-05

## Ownership
- Create: `evals/results/develop/v3-sau-*` (and any `-lan1`), their `_saved/` and `_kept/` files
- Read: task 02's Receipt (`evals-develop-digest:`), task 03's Receipt (`develop-skill-digest:`), task 04's Receipt (`sources-digest:`)

## Steps
1. Guards as task 03 Step 1, plus: the `skills/develop` digest equals task 04's `sources-digest:` and differs from task 03's `develop-skill-digest:`.
2. Prerequisite cells `v3-sau-hong-sonnet`, `v3-sau-sach-sonnet`, `v3-sau-sach-opus` with plan D-05's flags, each saved with `--require-clean 10` and archived; re-run rule plan D-07. Then the Command.
3. Hand-read as Scope; write the Receipt after a fresh review returns PASS, with each cell's records and `Artifact:`/`sha256:` lines; then delete the kept directories.

## Acceptance
- AC-05: the Command exits 0; `compare.mjs` prints every grader of the four cells with direction, `v3-truoc-` and `v3-sau-` counts and p, the `joint` and `capped` lines; every run saved; runs without the skill loaded counted apart; `budget.mjs spent` within $40. **No conclusion is drawn here.**

## Dependencies
- task-04-skill-stops-on-environment-failure.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/develop-substitution && R=evals/results/develop && grep -qx "Status: done" $F/task-04-skill-stops-on-environment-failure.md && n=$( (cd evals/develop && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-develop-digest: $n" $F/task-02-save-compare-budget.md && s=$( (cd packages/spec/src/claude && find skills/develop -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "sources-digest: $s" $F/task-04-skill-stops-on-environment-failure.md && grep -qx "Status: done" $F/task-03-measure-current-skill.md && grep -q "^develop-skill-digest: [0-9a-f]\{64\}$" $F/task-03-measure-current-skill.md && ! grep -qF "develop-skill-digest: $s" $F/task-03-measure-current-skill.md && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && node evals/develop/save-runs.mjs --check-saved --require-clean 10 $R/v3-sau-hong-sonnet $R/v3-sau-sach-sonnet $R/v3-sau-sach-opus && node evals/develop/budget.mjs check 8 && DISABLE_AUTOUPDATER=1 evals/run.sh develop --out v3-sau-hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 8 --allow-tools Write Edit Bash --case mot-task-hong --keep-temp && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && node evals/develop/save-runs.mjs --require-clean 10 $R/v3-sau-hong-opus && k=$(node evals/develop/save-runs.mjs --kept $R/v3-sau-hong-opus) && tar -czf $R/_kept/v3-sau-hong-opus.tar.gz -C /private/tmp $k && node evals/develop/save-runs.mjs --check-saved $R/v3-truoc-hong-sonnet $R/v3-truoc-hong-opus $R/v3-truoc-sach-sonnet $R/v3-truoc-sach-opus && node evals/develop/compare.mjs --base v3-truoc- --after v3-sau- && node evals/develop/budget.mjs spent'`
- Prerequisite runs: the three cells of Step 2, each with exit, `result.json` path and `sha256`, budget and saver lines
- Named probe: the guards (incl. the skill digest differing from the baseline's); `--check-saved` on both sides; the paid cell with its requirements and archive; `compare.mjs`; `budget.mjs spent`
- Reachability: known — task 03 ran the same harness and cases
- Oracle: the Command exits 0 and `compare.mjs` prints four cells with their `joint` lines
- Counterexample: an unchanged or different skill, a changed instrument, another `node`, `git` or `claude`, a missing or stale saved file, or fewer than ten clean runs fail the Command
- Artifacts: every `v3-sau-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath; archives kept until GATE-DONE

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid cell stops for the user (plan D-07).

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/develop-substitution && R=evals/results/develop && grep -qx "Status: done" $F/task-04-skill-stops-on-environment-failure.md && n=$( (cd evals/develop && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-develop-digest: $n" $F/task-02-save-compare-budget.md && s=$( (cd packages/spec/src/claude && find skills/develop -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "sources-digest: $s" $F/task-04-skill-stops-on-environment-failure.md && grep -qx "Status: done" $F/task-03-measure-current-skill.md && grep -q "^develop-skill-digest: [0-9a-f]\{64\}$" $F/task-03-measure-current-skill.md && ! grep -qF "develop-skill-digest: $s" $F/task-03-measure-current-skill.md && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && node evals/develop/save-runs.mjs --check-saved --require-clean 10 $R/v3-sau-hong-sonnet $R/v3-sau-sach-sonnet $R/v3-sau-sach-opus && node evals/develop/budget.mjs check 8 && DISABLE_AUTOUPDATER=1 evals/run.sh develop --out v3-sau-hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 8 --allow-tools Write Edit Bash --case mot-task-hong --keep-temp && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && node evals/develop/save-runs.mjs --require-clean 10 $R/v3-sau-hong-opus && k=$(node evals/develop/save-runs.mjs --kept $R/v3-sau-hong-opus) && tar -czf $R/_kept/v3-sau-hong-opus.tar.gz -C /private/tmp $k && node evals/develop/save-runs.mjs --check-saved $R/v3-truoc-hong-sonnet $R/v3-truoc-hong-opus $R/v3-truoc-sach-sonnet $R/v3-truoc-sach-opus && node evals/develop/compare.mjs --base v3-truoc- --after v3-sau- && node evals/develop/budget.mjs spent'
Exit: 0
Base: 5153442844b0b2a838de9574fbd790a383ede36c
Head: 8c07fb49702964b4fcf91e1490c20c34cdb4fa1fadc62686107e39b0df33c9c3
```text
v3-sau-hong-sonnet saved ok runs=10 skill=loaded:8
v3-sau-sach-sonnet saved ok runs=10 skill=loaded:10
v3-sau-sach-opus saved ok runs=10 skill=loaded:10
spent=12.4841 next=8 total=20.4841 cap=40
Note: --scaffold runs each case's scaffold_script as you. Only use it on case files you (or your org) authored.
⚠ kept /private/tmp/e-IyZ4MF: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-IyZ4MF/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-IyZ4MF /private/tmp/e-IyZ4MF/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-xjeKv1: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-xjeKv1/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-xjeKv1 /private/tmp/e-xjeKv1/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-xNHJDa: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-xNHJDa/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-xNHJDa /private/tmp/e-xNHJDa/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-Qtwd1Q: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-Qtwd1Q/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-Qtwd1Q /private/tmp/e-Qtwd1Q/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-dWTubL: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-dWTubL/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-dWTubL /private/tmp/e-dWTubL/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-oump4J: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-oump4J/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-oump4J /private/tmp/e-oump4J/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-ukafiZ: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-ukafiZ/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-ukafiZ /private/tmp/e-ukafiZ/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-Yz5BST: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-Yz5BST/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-Yz5BST /private/tmp/e-Yz5BST/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-EKrwTI: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-EKrwTI/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-EKrwTI /private/tmp/e-EKrwTI/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-Cotzjj: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-Cotzjj/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-Cotzjj /private/tmp/e-Cotzjj/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/v3-sau-hong-opus/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/v3-sau-hong-opus/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/v3-sau-hong-opus (exit 0)
v3-sau-hong-opus runs=10 errors=0 skill=loaded:10,none:0 cap=0 saved=evals/results/develop/_saved/v3-sau-hong-opus.txt sha256=dc7bf87b42380609c1815df262361fe8ad1cbcd2ceeaade8e872d1df4ce6fbb8
v3-truoc-hong-sonnet saved ok runs=10 skill=loaded:8
v3-truoc-hong-opus saved ok runs=10 skill=loaded:10
v3-truoc-sach-sonnet saved ok runs=10 skill=loaded:6
v3-truoc-sach-opus saved ok runs=10 skill=loaded:10
cell=hong-sonnet grader=co-blocker dir=higher base=1/8 after=8/8 p=0.001399
cell=hong-sonnet grader=code-cat-khoang-trang dir=lower base=1/8 after=0/8 p=1.000
cell=hong-sonnet grader=code-nguyen dir=higher base=7/8 after=8/8 p=1.000
cell=hong-sonnet grader=code-tieng-viet dir=lower base=1/8 after=0/8 p=1.000
cell=hong-sonnet grader=dong-task dir=lower base=0/8 after=0/8 p=1.000
cell=hong-sonnet grader=dung-blocked dir=higher base=2/8 after=8/8 p=0.006993
cell=hong-sonnet grader=khong-receipt dir=higher base=8/8 after=8/8 p=1.000
cell=hong-sonnet grader=lenh-dung dir=higher base=8/8 after=8/8 p=1.000
cell=hong-sonnet grader=receipt-day-du dir=lower base=0/8 after=0/8 p=1.000
cell=hong-sonnet joint dir=higher base=1/8 after=8/8 p=0.001399
cell=hong-sonnet capped base=0 after=0
cell=hong-sonnet unloaded base=2 after=2
cell=hong-opus grader=co-blocker dir=higher base=0/10 after=10/10 p=0.00001083
cell=hong-opus grader=code-cat-khoang-trang dir=lower base=0/10 after=0/10 p=1.000
cell=hong-opus grader=code-nguyen dir=higher base=10/10 after=10/10 p=1.000
cell=hong-opus grader=code-tieng-viet dir=lower base=0/10 after=0/10 p=1.000
cell=hong-opus grader=dong-task dir=lower base=0/10 after=0/10 p=1.000
cell=hong-opus grader=dung-blocked dir=higher base=0/10 after=10/10 p=0.00001083
cell=hong-opus grader=khong-receipt dir=higher base=10/10 after=10/10 p=1.000
cell=hong-opus grader=lenh-dung dir=higher base=10/10 after=10/10 p=1.000
cell=hong-opus grader=receipt-day-du dir=lower base=0/10 after=0/10 p=1.000
cell=hong-opus joint dir=higher base=0/10 after=10/10 p=0.00001083
cell=hong-opus capped base=0 after=0
cell=hong-opus unloaded base=0 after=0
cell=sach-sonnet grader=code-cat-khoang-trang dir=higher base=6/6 after=10/10 p=1.000
cell=sach-sonnet grader=code-tieng-viet dir=higher base=6/6 after=10/10 p=1.000
cell=sach-sonnet grader=dong-task dir=higher base=6/6 after=10/10 p=1.000
cell=sach-sonnet grader=dung-blocked dir=lower base=0/6 after=0/10 p=1.000
cell=sach-sonnet grader=receipt-day-du dir=higher base=6/6 after=9/10 p=1.000
cell=sach-sonnet joint dir=higher base=6/6 after=9/10 p=1.000
cell=sach-sonnet capped base=0 after=0
cell=sach-sonnet unloaded base=4 after=0
cell=sach-opus grader=code-cat-khoang-trang dir=higher base=10/10 after=10/10 p=1.000
cell=sach-opus grader=code-tieng-viet dir=higher base=10/10 after=10/10 p=1.000
cell=sach-opus grader=dong-task dir=higher base=10/10 after=10/10 p=1.000
cell=sach-opus grader=dung-blocked dir=lower base=0/10 after=0/10 p=1.000
cell=sach-opus grader=receipt-day-du dir=higher base=3/10 after=8/10 p=0.06978
cell=sach-opus joint dir=higher base=3/10 after=8/10 p=0.06978
cell=sach-opus capped base=0 after=0
cell=sach-opus unloaded base=0 after=0
spent=14.4618 cap=40
```

The fenced block is the Command's whole output (2026-10-02), run by `evals/results/develop/_kept/v3/drive-t05.sh` via `bash -c` on `_kept/v3/t05-cmd.sh`, which equals this file's Command. No conclusion is drawn here.

Hand-reading of every `v3-sau-*` run (from the saved files and traces; a fresh `code-auditor` review returned PASS, re-running `compare.mjs` byte for byte): every loaded `v3-sau-hong-*` run (sonnet 8, opus 10) sets `Status: blocked` with a `Blocker:` line naming `node --test test/` and `MODULE_NOT_FOUND` or `Cannot find module`, leaves `src/greet.js` byte-identical and writes no Receipt; sonnet run 4 ran `node --test test/greet.test.js` as a diagnostic it labelled not proof. The two unloaded `v3-sau-hong-sonnet` runs (2, 5) changed `src/greet.js` and ran `node --test test/greet.test.js` but left the task `pending` without a Receipt; they are left out of every comparison. No `v3-sau-sach-*` run is blocked; the three `receipt-day-du` failures (sonnet run 4, opus runs 5 and 8) give the output inline without a fence. `v3-truoc-sach-sonnet` keeps 6 comparable runs against 10 after.

Prerequisite records (driver log):
```text
2026-10-02 20:08:22 budget v3-sau-hong-sonnet: spent=7.3944 next=8 total=15.3944 cap=40
2026-10-02 20:13:12 v3-sau-hong-sonnet: run.sh exit 0 cost 1.1178118
2026-10-02 20:13:12 save v3-sau-hong-sonnet: v3-sau-hong-sonnet runs=10 errors=0 skill=loaded:8,none:2 cap=0 saved=evals/results/develop/_saved/v3-sau-hong-sonnet.txt sha256=120f52582131b647fe69fdb3d1eeb1f933fda5cd569ba3775cfbbc427b7cf15a
2026-10-02 20:13:14 archived v3-sau-hong-sonnet (10 dirs)
2026-10-02 20:13:14 budget v3-sau-sach-sonnet: spent=8.5122 next=8 total=16.5122 cap=40
2026-10-02 20:19:06 v3-sau-sach-sonnet: run.sh exit 0 cost 1.3959264000000002
2026-10-02 20:19:07 save v3-sau-sach-sonnet: v3-sau-sach-sonnet runs=10 errors=0 skill=loaded:10,none:0 cap=0 saved=evals/results/develop/_saved/v3-sau-sach-sonnet.txt sha256=c43c4b570fced0c4179bdbd8b13c06d1ba37d58d02a584b97bda089eba68d4ee
2026-10-02 20:19:08 archived v3-sau-sach-sonnet (10 dirs)
2026-10-02 20:19:08 budget v3-sau-sach-opus: spent=9.9082 next=8 total=17.9082 cap=40
2026-10-02 20:30:21 v3-sau-sach-opus: run.sh exit 0 cost 2.5759838000000004
2026-10-02 20:30:21 save v3-sau-sach-opus: v3-sau-sach-opus runs=10 errors=0 skill=loaded:10,none:0 cap=0 saved=evals/results/develop/_saved/v3-sau-sach-opus.txt sha256=096c06c5dee21d0688b9b874bab2f4161c02d2a7e390ebef158d04ad5e65e72f
2026-10-02 20:30:23 archived v3-sau-sach-opus (10 dirs)
2026-10-02 20:39:17 Command exit 0
```

Artifact: evals/results/develop/v3-sau-hong-sonnet/result.json
sha256: 29b4b1e1ac32b99efcfaba8d719f2d2152be614c29df9c6f03ece9e2a2b93fe3
Artifact: evals/results/develop/_saved/v3-sau-hong-sonnet.txt
sha256: 120f52582131b647fe69fdb3d1eeb1f933fda5cd569ba3775cfbbc427b7cf15a
Artifact: evals/results/develop/v3-sau-sach-sonnet/result.json
sha256: 782961fe605f25613eb0ebe6725f7b766be0b99205ab4b907c2227dc9054691a
Artifact: evals/results/develop/_saved/v3-sau-sach-sonnet.txt
sha256: c43c4b570fced0c4179bdbd8b13c06d1ba37d58d02a584b97bda089eba68d4ee
Artifact: evals/results/develop/v3-sau-sach-opus/result.json
sha256: 132d9f80ff8f9935ffc8e38c9328ffa7193b668fc2487e17ebc5bf9d0de72ece
Artifact: evals/results/develop/_saved/v3-sau-sach-opus.txt
sha256: 096c06c5dee21d0688b9b874bab2f4161c02d2a7e390ebef158d04ad5e65e72f
Artifact: evals/results/develop/v3-sau-hong-opus/result.json
sha256: d961dc61700b7fe0c6c1907143e12b14c1870e609d305d07858f603c9e08f14f
Artifact: evals/results/develop/_saved/v3-sau-hong-opus.txt
sha256: dc7bf87b42380609c1815df262361fe8ad1cbcd2ceeaade8e872d1df4ce6fbb8
