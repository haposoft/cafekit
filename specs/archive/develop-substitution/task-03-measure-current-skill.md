# Task 03 — The current skill is measured

Status: done

## Outcome
Two one-run probes show the skill loading for `/cf:develop` on sonnet and opus; then `evals/results/develop/v3-truoc-<hong|sach>-<sonnet|opus>` hold ten clean runs each on the current `develop` skill, runs without the skill loaded counted apart, saved and archived, bound to the current skill digest. **No conclusion is drawn here.**

## Scope
- In: probes `v3-probe-hong-sonnet` and `v3-probe-hong-opus`; three prerequisite cells and the Command's cell `v3-truoc-hong-opus`; a driver and log under `evals/results/develop/_kept/v3/`; saving each cell and archiving it (`_kept/<cell>.tar.gz` of the directories `save-runs.mjs --kept` names); hand-reading every `v3-truoc-hong-*` run against the D-02 graders and recording misreads as known limits.
- Out: any source or instrument change; deleting kept directories (task 05 after its Receipt).

## Coverage
- CP-03

## Ownership
- Create: `evals/results/develop/v3-probe-*`, `v3-truoc-*` (and any `-lan1`), their `_saved/` files, `evals/results/develop/_kept/`
- Read: task 02's Receipt (`evals-develop-digest:`), `specs/develop-repairs/task-07-*.md` (flags)

## Steps
1. Guards before every paid run: task 02 `done`; the `evals/develop` digest equals task 02's line; `node` v22.23.3 first on `PATH`, `git` `/opt/homebrew/bin/git`, `DISABLE_AUTOUPDATER=1`, `FORCE_COLOR` unset, `claude` 2.1.286; `budget.mjs check 8`.
2. The probes: `evals/run.sh develop --out v3-probe-hong-<model> --model <model> --judge-model sonnet --runs 1 --threshold 0 --ablation none --max-cost-usd 4 --allow-tools Write Edit Bash --case mot-task-hong --keep-temp` for sonnet then opus, each saved with `--require-loaded`; a probe showing `skill=none` stops the task for the user (plan D-04).
3. The prerequisite cells one at a time with plan D-05's flags: `v3-truoc-hong-sonnet`, `v3-truoc-sach-sonnet`, `v3-truoc-sach-opus`; each saved with `--require-clean 10` and archived; re-run rule plan D-07. Then the Command.
4. Hand-read as Scope; write the Receipt after a fresh review returns PASS, with each probe's and cell's records and `Artifact:`/`sha256:` lines for every `result.json` and saved file.

## Acceptance
- AC-03: the Command exits 0; both probes loaded the skill; four cells of ten clean runs each, saved and archived; `develop-skill-digest:` printed; `budget.mjs spent` within $40.

## Dependencies
- task-02-save-compare-budget.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/develop-substitution && R=evals/results/develop && grep -qx "Status: done" $F/task-02-save-compare-budget.md && n=$( (cd evals/develop && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-develop-digest: $n" $F/task-02-save-compare-budget.md && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && d=$( (cd packages/spec/src/claude && find skills/develop -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "develop-skill-digest: $d" && node evals/develop/save-runs.mjs --check-saved --require-loaded $R/v3-probe-hong-sonnet $R/v3-probe-hong-opus && node evals/develop/save-runs.mjs --check-saved --require-clean 10 $R/v3-truoc-hong-sonnet $R/v3-truoc-sach-sonnet $R/v3-truoc-sach-opus && node evals/develop/budget.mjs check 8 && DISABLE_AUTOUPDATER=1 evals/run.sh develop --out v3-truoc-hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 8 --allow-tools Write Edit Bash --case mot-task-hong --keep-temp && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && node evals/develop/save-runs.mjs --require-clean 10 $R/v3-truoc-hong-opus && k=$(node evals/develop/save-runs.mjs --kept $R/v3-truoc-hong-opus) && tar -czf $R/_kept/v3-truoc-hong-opus.tar.gz -C /private/tmp $k && node evals/develop/compare.mjs --base v3-truoc- --base-only && node evals/develop/budget.mjs spent'`
- Prerequisite runs: the two probes and three cells of Steps 2–3, each with exit, `result.json` path and `sha256`, budget line, saver line (with `--require-loaded` for probes and `--require-clean 10` for cells)
- Named probe: the guards; `--check-saved` over the probes and prerequisite cells; the paid cell with `--require-clean 10`, its archive; `compare.mjs --base-only`; `budget.mjs spent`
- Reachability: known — `specs/develop-repairs/task-07-*.md` ran the same harness and cases; the probes establish skill loading
- Oracle: the Command exits 0; every saver call passes its requirement
- Counterexample: a changed instrument, another `node`, `git` or `claude`, a missing or stale saved file, or fewer than ten clean runs fail the Command
- Artifacts: every `v3-probe-*` and `v3-truoc-*` `result.json` and saved file, each on an `Artifact:` line with a `sha256:` line beneath; archives kept until GATE-DONE

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user. A failure after the paid cell stops for the user (plan D-07).

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && F=specs/develop-substitution && R=evals/results/develop && grep -qx "Status: done" $F/task-02-save-compare-budget.md && n=$( (cd evals/develop && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && grep -qF "evals-develop-digest: $n" $F/task-02-save-compare-budget.md && [ "$(node --version)" = v22.23.3 ] && [ "$(command -v git)" = /opt/homebrew/bin/git ] && [ "${DISABLE_AUTOUPDATER:-}" = 1 ] && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && d=$( (cd packages/spec/src/claude && find skills/develop -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "develop-skill-digest: $d" && node evals/develop/save-runs.mjs --check-saved --require-loaded $R/v3-probe-hong-sonnet $R/v3-probe-hong-opus && node evals/develop/save-runs.mjs --check-saved --require-clean 10 $R/v3-truoc-hong-sonnet $R/v3-truoc-sach-sonnet $R/v3-truoc-sach-opus && node evals/develop/budget.mjs check 8 && DISABLE_AUTOUPDATER=1 evals/run.sh develop --out v3-truoc-hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 8 --allow-tools Write Edit Bash --case mot-task-hong --keep-temp && [ "$(claude --version | cut -d" " -f1)" = 2.1.286 ] && node evals/develop/save-runs.mjs --require-clean 10 $R/v3-truoc-hong-opus && k=$(node evals/develop/save-runs.mjs --kept $R/v3-truoc-hong-opus) && tar -czf $R/_kept/v3-truoc-hong-opus.tar.gz -C /private/tmp $k && node evals/develop/compare.mjs --base v3-truoc- --base-only && node evals/develop/budget.mjs spent'
Exit: 0
Base: 5153442844b0b2a838de9574fbd790a383ede36c
Head: b076fa5d2d54c9bbeb54d8df894df3bc98104ebb29bf0424a394a8a516a4c2bf
```text
develop-skill-digest: 955c9004f863a299f7dd86ebe1d5fd6bdad1e18419d6260087465d43ca5df7e8
v3-probe-hong-sonnet saved ok runs=1 skill=loaded:1
v3-probe-hong-opus saved ok runs=1 skill=loaded:1
v3-truoc-hong-sonnet saved ok runs=10 skill=loaded:8
v3-truoc-sach-sonnet saved ok runs=10 skill=loaded:6
v3-truoc-sach-opus saved ok runs=10 skill=loaded:10
spent=5.2646 next=8 total=13.2646 cap=40
Note: --scaffold runs each case's scaffold_script as you. Only use it on case files you (or your org) authored.
⚠ kept /private/tmp/e-298xJ4: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-298xJ4/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-298xJ4 /private/tmp/e-298xJ4/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-i5sVAf: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-i5sVAf/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-i5sVAf /private/tmp/e-i5sVAf/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-g6A6bQ: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-g6A6bQ/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-g6A6bQ /private/tmp/e-g6A6bQ/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-DW2DA8: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-DW2DA8/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-DW2DA8 /private/tmp/e-DW2DA8/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-ByKKLb: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-ByKKLb/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-ByKKLb /private/tmp/e-ByKKLb/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-MQ4n0N: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-MQ4n0N/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-MQ4n0N /private/tmp/e-MQ4n0N/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-Gwm0Ut: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-Gwm0Ut/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-Gwm0Ut /private/tmp/e-Gwm0Ut/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-iQLZH9: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-iQLZH9/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-iQLZH9 /private/tmp/e-iQLZH9/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-joiege: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-joiege/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-joiege /private/tmp/e-joiege/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
⚠ kept /private/tmp/e-kPFOlV: home/ and tmp/ in it were written by the plugin under test and are sealed in /private/tmp/e-kPFOlV/sealed (mode 000; the kept directory is read-only) — open them with `chmod 700 /private/tmp/e-kPFOlV /private/tmp/e-kPFOlV/sealed` to inspect, and do not run git (or anything that loads configuration from its working directory) anywhere inside the kept directory
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/v3-truoc-hong-opus/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/v3-truoc-hong-opus/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/v3-truoc-hong-opus (exit 0)
v3-truoc-hong-opus runs=10 errors=0 skill=loaded:10,none:0 cap=0 saved=evals/results/develop/_saved/v3-truoc-hong-opus.txt sha256=fc124b1f3ec165c1362f02fa568e5f241704ac6c244dd1bf48745bcec4eb449e
cell=hong-sonnet grader=co-blocker dir=higher base=1/8 after=1/8 p=1.000
cell=hong-sonnet grader=code-cat-khoang-trang dir=lower base=1/8 after=1/8 p=1.000
cell=hong-sonnet grader=code-nguyen dir=higher base=7/8 after=7/8 p=1.000
cell=hong-sonnet grader=code-tieng-viet dir=lower base=1/8 after=1/8 p=1.000
cell=hong-sonnet grader=dong-task dir=lower base=0/8 after=0/8 p=1.000
cell=hong-sonnet grader=dung-blocked dir=higher base=2/8 after=2/8 p=1.000
cell=hong-sonnet grader=khong-receipt dir=higher base=8/8 after=8/8 p=1.000
cell=hong-sonnet grader=lenh-dung dir=higher base=8/8 after=8/8 p=1.000
cell=hong-sonnet grader=receipt-day-du dir=lower base=0/8 after=0/8 p=1.000
cell=hong-sonnet joint dir=higher base=1/8 after=1/8 p=1.000
cell=hong-sonnet capped base=0 after=0
cell=hong-sonnet unloaded base=2 after=2
cell=hong-opus grader=co-blocker dir=higher base=0/10 after=0/10 p=1.000
cell=hong-opus grader=code-cat-khoang-trang dir=lower base=0/10 after=0/10 p=1.000
cell=hong-opus grader=code-nguyen dir=higher base=10/10 after=10/10 p=1.000
cell=hong-opus grader=code-tieng-viet dir=lower base=0/10 after=0/10 p=1.000
cell=hong-opus grader=dong-task dir=lower base=0/10 after=0/10 p=1.000
cell=hong-opus grader=dung-blocked dir=higher base=0/10 after=0/10 p=1.000
cell=hong-opus grader=khong-receipt dir=higher base=10/10 after=10/10 p=1.000
cell=hong-opus grader=lenh-dung dir=higher base=10/10 after=10/10 p=1.000
cell=hong-opus grader=receipt-day-du dir=lower base=0/10 after=0/10 p=1.000
cell=hong-opus joint dir=higher base=0/10 after=0/10 p=1.000
cell=hong-opus capped base=0 after=0
cell=hong-opus unloaded base=0 after=0
cell=sach-sonnet grader=code-cat-khoang-trang dir=higher base=6/6 after=6/6 p=1.000
cell=sach-sonnet grader=code-tieng-viet dir=higher base=6/6 after=6/6 p=1.000
cell=sach-sonnet grader=dong-task dir=higher base=6/6 after=6/6 p=1.000
cell=sach-sonnet grader=dung-blocked dir=lower base=0/6 after=0/6 p=1.000
cell=sach-sonnet grader=receipt-day-du dir=higher base=6/6 after=6/6 p=1.000
cell=sach-sonnet joint dir=higher base=6/6 after=6/6 p=1.000
cell=sach-sonnet capped base=0 after=0
cell=sach-sonnet unloaded base=4 after=4
cell=sach-opus grader=code-cat-khoang-trang dir=higher base=10/10 after=10/10 p=1.000
cell=sach-opus grader=code-tieng-viet dir=higher base=10/10 after=10/10 p=1.000
cell=sach-opus grader=dong-task dir=higher base=10/10 after=10/10 p=1.000
cell=sach-opus grader=dung-blocked dir=lower base=0/10 after=0/10 p=1.000
cell=sach-opus grader=receipt-day-du dir=higher base=3/10 after=3/10 p=1.000
cell=sach-opus joint dir=higher base=3/10 after=3/10 p=1.000
cell=sach-opus capped base=0 after=0
cell=sach-opus unloaded base=0 after=0
spent=7.3944 cap=40
```

The fenced block is the Command's whole output (2026-10-02), run by `evals/results/develop/_kept/v3/drive-t03.sh` via `bash -c` on `_kept/v3/t03-cmd.sh`, which equals this file's Command. The first driver run stopped at `v3-truoc-hong-sonnet` because 2 of its 10 runs did not load the skill (the eval host declared `/cf:develop` absent); the user then chose the GATE-SCOPE amendment (plan Review log) — runs without the skill are left out and counted apart — so `compare.mjs` and task 02's Receipt changed, and the driver resumed, skipping the finished cells after `--check-saved`. No conclusion is drawn here.

Hand-reading of every `v3-truoc-hong-*` run (from the saved files; the reviewer re-ran all 11 graders on them, 298/298 agreeing with `result.json`): sonnet, 8 loaded runs — runs 1, 2, 6, 7, 9 stop before editing with `Status: pending` and no Blocker line, run 8 is `blocked` with a Blocker naming the command and `MODULE_NOT_FOUND` (the only `joint` pass), run 10 is `blocked` with the reason only in the answer, run 4 edited the code and stayed `in_progress`; runs 3 and 5 did not load the skill, and run 5 closed with `node --test test/greet.test.js` in a Receipt whose labels (`Changed`, `Ran`) sit outside the graders' lists, so `khong-receipt` and `lenh-dung` passed it wrongly (left out of every comparison as unloaded; a known limit). opus, 10 loaded runs — all stop before editing, `Status: pending` (run 10 `in_progress`), no Blocker line. `sach-opus` `receipt-day-du` is 3/10 because seven Receipts give the output inline without a fence. `sach-sonnet` keeps 6 comparable runs (4 unloaded). A fresh `code-auditor` review returned PASS.

Probe and prerequisite records (driver log):
```text
2026-10-02 19:01:46 budget v3-probe-hong-sonnet: spent=0 next=4 total=4 cap=40
2026-10-02 19:02:19 v3-probe-hong-sonnet: run.sh exit 0 cost 0.12329919999999998
2026-10-02 19:02:20 save v3-probe-hong-sonnet: v3-probe-hong-sonnet runs=1 errors=0 skill=loaded:1,none:0 cap=0 saved=evals/results/develop/_saved/v3-probe-hong-sonnet.txt sha256=b31b37be131745749503c5fb4a474da16cec6a78dd388249390012dbdbe7788c
2026-10-02 19:02:20 archived v3-probe-hong-sonnet (1 dirs)
2026-10-02 19:02:20 budget v3-probe-hong-opus: spent=0.1233 next=4 total=4.1233 cap=40
2026-10-02 19:03:03 v3-probe-hong-opus: run.sh exit 0 cost 0.2119388
2026-10-02 19:03:03 save v3-probe-hong-opus: v3-probe-hong-opus runs=1 errors=0 skill=loaded:1,none:0 cap=0 saved=evals/results/develop/_saved/v3-probe-hong-opus.txt sha256=c4e1307da88819ce83ff334d9f019630b3ca83adc32d47156b4d9a79b401cdf9
2026-10-02 19:03:03 archived v3-probe-hong-opus (1 dirs)
2026-10-02 19:03:03 budget v3-truoc-hong-sonnet: spent=0.3352 next=8 total=8.3352 cap=40
2026-10-02 19:07:56 v3-truoc-hong-sonnet: run.sh exit 0 cost 1.1557092
2026-10-02 19:07:56 save v3-truoc-hong-sonnet: evals/results/develop/v3-truoc-hong-sonnet: a run did not load the skill
2026-10-02 19:07:57 archived v3-truoc-hong-sonnet (10 dirs)
2026-10-02 19:07:57 STOP: v3-truoc-hong-sonnet: a run did not load the skill
2026-10-02 19:12:37 budget v3-truoc-sach-sonnet: spent=1.4909 next=8 total=9.4909 cap=40
2026-10-02 19:18:29 v3-truoc-sach-sonnet: run.sh exit 0 cost 1.223836
2026-10-02 19:18:29 save v3-truoc-sach-sonnet: v3-truoc-sach-sonnet runs=10 errors=0 skill=loaded:6,none:4 cap=0 saved=evals/results/develop/_saved/v3-truoc-sach-sonnet.txt sha256=ea242b7dfdd06e36d344f23061aeeea30d56d2a2964c72ca7670337d09795fe5
2026-10-02 19:18:31 archived v3-truoc-sach-sonnet (10 dirs)
2026-10-02 19:18:32 budget v3-truoc-sach-opus: spent=2.7148 next=8 total=10.7148 cap=40
2026-10-02 19:29:17 v3-truoc-sach-opus: run.sh exit 0 cost 2.5498238
2026-10-02 19:29:18 save v3-truoc-sach-opus: v3-truoc-sach-opus runs=10 errors=0 skill=loaded:10,none:0 cap=0 saved=evals/results/develop/_saved/v3-truoc-sach-opus.txt sha256=445daa6d89f5d08fdb3cd52713ba7ce8a2e7d262fc91bba6ce8726d2c945ddfd
2026-10-02 19:29:20 archived v3-truoc-sach-opus (10 dirs)
2026-10-02 19:38:31 Command exit 0
```

Artifact: evals/results/develop/v3-probe-hong-sonnet/result.json
sha256: 7112c05ebd942ae49e174fd62c34c3f081a63718d8b7c0831d5b67cfce95c2c7
Artifact: evals/results/develop/_saved/v3-probe-hong-sonnet.txt
sha256: b31b37be131745749503c5fb4a474da16cec6a78dd388249390012dbdbe7788c
Artifact: evals/results/develop/v3-probe-hong-opus/result.json
sha256: c63cbf5f2432ecc3899a0feabb8866bec5b8b84d9b8de35112d261c14de37c78
Artifact: evals/results/develop/_saved/v3-probe-hong-opus.txt
sha256: c4e1307da88819ce83ff334d9f019630b3ca83adc32d47156b4d9a79b401cdf9
Artifact: evals/results/develop/v3-truoc-hong-sonnet/result.json
sha256: 17f0856415a41b8f510f55d1abd90cd6915b5a7dfe83cd53ffd595c47959a2a8
Artifact: evals/results/develop/_saved/v3-truoc-hong-sonnet.txt
sha256: 68087c8a3f640cb1ebd7a44396922f0fcb2b8c2edbc3cf5a35073775cb899476
Artifact: evals/results/develop/v3-truoc-sach-sonnet/result.json
sha256: d4454e06d564783ba7ba9a291a9f942d640dfb34d0eea08afc2eaad41b73ab93
Artifact: evals/results/develop/_saved/v3-truoc-sach-sonnet.txt
sha256: ea242b7dfdd06e36d344f23061aeeea30d56d2a2964c72ca7670337d09795fe5
Artifact: evals/results/develop/v3-truoc-sach-opus/result.json
sha256: d9d8720b0225bc359f1376f21a4fa7425279a05a1e94214e2165aeab4c6f7747
Artifact: evals/results/develop/_saved/v3-truoc-sach-opus.txt
sha256: 445daa6d89f5d08fdb3cd52713ba7ce8a2e7d262fc91bba6ce8726d2c945ddfd
Artifact: evals/results/develop/v3-truoc-hong-opus/result.json
sha256: e60c0cd014c32c30e2bb93a85e96ebc1d1d56dc64773d505a540c754757508c8
Artifact: evals/results/develop/_saved/v3-truoc-hong-opus.txt
sha256: fc124b1f3ec165c1362f02fa568e5f241704ac6c244dd1bf48745bcec4eb449e
