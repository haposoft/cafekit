# Task 05 — The unchanged skill is measured on the four cases

Status: done

## Outcome
The skill at commit `26103b9` has, for each of four cells (the four cases on `claude-opus-5-5`), a result file, a skill-loaded count, a verify-run file and a cost, the same `n` for every cell, a locked instrument digest, and total spend within $60.

## Scope
- In: the four baseline pilots, instrument repairs during the pilots only (D-08), the instrument lock, the estimate for both sides, the four paid cells of the `goc` side, copying each result into `evals/results/git/`.
- Out: any change to the skill; the `sau` side; any push, real-repository operation, or real Orca/Herdr call; any model other than `claude-opus-5-5`.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/git/base-*/` (result directories only), `evals/results/git/instrument.digest`
- Modify (pilot phase only, each change in the Receipt with the new digest): `evals/git/**`, `evals/compare-git.mjs`, `evals/budget-git-sau.mjs`, `evals/git/stage-root.sh`, `evals/git/skill-loaded.mjs`
- Read: `evals/run.sh`

## Steps
1. Record `claude --version`, `node --version` and the model id in the Receipt. Every paid line runs with `DISABLE_AUTOUPDATER=1`, a fixed node `PATH` with `evals/git/shim/` first (D-09), no `SHIMLOG` (each run's shim log is its own workspace's `./shim.log`), and every `ORCA_*` and `HERDR_*` variable unset (`env $(env | grep -E '^(ORCA|HERDR)_' | cut -d= -f1 | sed 's/^/-u /') …`), and with `--model claude-opus-5-5 --ablation none --keep-temp`; if a harness grader of type `llm` is ever added, `--judge-model claude-opus-5-5`.
2. `r=$(mktemp -d)`; `bash evals/git/stage-root.sh goc "$r"`; record the three digests; run `$r/evals/run.sh git …` (the staged copy of the harness) so the baseline skill is the one measured. After every `--out <name>` run, copy `$r/evals/results/git/<name>` to `evals/results/git/<name>` at once (D-07).
3. Pilots: one run per case, `--out base-pilot-<case>-opus --runs 1 --max-cost-usd 3` (a bound chosen to cap the four pilots near $12 before any cost is known; the first pilot cost replaces it), then `node evals/git/skill-loaded.mjs` and `node evals/git/verify-run.mjs` on each, saved beside the result. Stop and return to the user if (a) any pilot loads the skill 0 times (D-05) or (b) the harness does not keep `box/`, or does not let the model write inside it. A defect in the instrument found here may be repaired: write it in the Receipt (what, why, new instrument digest), rename each of the four pilot directories to `-lan1` in both places — `$r/evals/results/git/` and `evals/results/git/` (`evals/run.sh:109-111` refuses an existing `--out`, so the staged copy must be renamed too; they still count in the budget) — re-stage with `stage-root.sh goc "$r"` so the repaired instrument is in the run root, and run the four pilots again.
4. Lock: write the current instrument digest (D-08) to `evals/results/git/instrument.digest`. Run `node evals/budget-git-sau.mjs estimate --runs 20` (it covers both sides). If `total` exceeds the cap, STOP and ask the user; do not reduce `n` on your own (the user may choose a lower `n`, never below 5). From here on the instrument is locked: a defect found later makes this task `blocked` with the cause; do not repair it.
5. Cells: for each case, `node evals/budget-git-sau.mjs check <cell estimate>` then the paid run with `--out base-<case>-opus --runs 20 --max-cost-usd <min(cap left, 1.5 × cell estimate)>`; confirm the instrument digest still matches `instrument.digest` before each; the cell estimate is `n` × the highest pilot cost per run; copy the result at once; save `skill-loaded.txt` and `verify-run.txt` in the cell directory. A failed or partial cell is renamed `base-<case>-opus-lan1` (`-lan2` …) in both `$r/evals/results/git/` and `evals/results/git/`, still counted, and the canonical name is run again.
6. Run the Command; paste its output into the Receipt with the shasum of each `result.json`.

## Acceptance
- AC-03: four `base-<case>-opus` directories each hold `result.json`, `skill-loaded.txt`, `verify-run.txt`; every cell has the same `n ≥ 5`; `compare-git.mjs --base-only --strict` exits 0 (no cell with `loaded` 0 or all runs errored, instrument `same`); total spend including pilots and reruns is within $60.

## Dependencies
- task-04-compare-budget-tools.md

## Verification Plan
- Command: `claude --version && node --version && cat evals/results/git/instrument.digest && for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do shasum -a 256 evals/results/git/base-$c-opus/result.json; done && node evals/reproduce-harness-git.mjs && out=$(node evals/compare-git.mjs --base-only --strict) && printf '%s\n' "$out" && bash -c 'for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do test -s evals/results/git/base-$c-opus/result.json && test -s evals/results/git/base-$c-opus/skill-loaded.txt && test -s evals/results/git/base-$c-opus/verify-run.txt && test -s evals/results/git/base-pilot-$c-opus/result.json || exit 1; done' && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 4 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 4 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$'`
- Named probe: `compare-git.mjs --base-only --strict` (per-cell `cost`, `loaded`, `errored`, `instrument` lines); the saved `skill-loaded.txt` and `verify-run.txt`; `budget-git-sau.mjs spent`.
- Reachability: reads files written by Steps 3-5 only; no paid run is inside the Command, so it replays after a reboot.
- Oracle: exit 0; four cells, each with its skill-loaded and verify-run files; `instrument=same`; `spent` within the cap (the call exits 1 above it).
- Counterexample: a cell whose skill never loaded or whose runs all errored, a changed instrument, a missing pilot or cell, a different `n` between cells, or spend above $60 makes `--strict` or `spent` exit 1.
- Artifacts: `evals/results/git/base-*/` and `instrument.digest` kept in the working tree (gitignored by `.gitignore:122`, so not committed); digests recorded in the Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Pilot log (2026-10-02, written before the Receipt)
Environment: `claude` 2.1.286, `node` v22.23.3, model `claude-opus-5-5` (read from the trace `init` event), `DISABLE_AUTOUPDATER=1`, `PATH` with the staged `evals/git/shim/` first, every `ORCA_*`/`HERDR_*` variable unset; skill `goc` = `26103b9` (`skill-git: efca464b…`). Run roots were `mktemp -d` roots staged by `stage-root.sh goc`; each result was copied to `evals/results/git/` at once.

Instrument repairs made during the pilots (D-08), each followed by re-running the four pilots (the superseded pilots stay as `-lan<k>` and are counted in the budget):
1. `lib/box.sh` `box_init` refused the harness workspace: the harness seals a `home/` that is itself a git repository and puts `cwd` inside it (scaffold error, $0, pilot 1 `-lan1`). Now a repository is allowed when its top-level is under a temp directory; a repository outside one is still refused (new kit check + mutation).
2. `verify-run.mjs` could not read the kept workspace: the harness seals `home/` and `tmp/` (mode 000). It now opens the permissions of the run's own `e-*` temp directory first, and skips `.git` while searching.
3. The harness MOVES the workspace (`home/` to `sealed/home/`) while git keeps the old absolute paths, so every sibling worktree read as `prunable`. `verify-run.mjs` now grades a temporary copy repaired with `git worktree repair` (the kept directory is untouched); checks for a moved workspace added for all three layouts (mutation: removing the repair step turns them red).
4. Two lexical graders were too narrow for what the model really does: `quet-truoc` (a `|` inside the quoted grep pattern ended the match) and `kiem-toplevel-truoc-stage` (`for d in box/repo-a box/repo-b; do git -C $d …` was not read as a check of repo-a). Fixed with examples, counterexamples and mutations.

Final pilot instrument digest (locked in `evals/results/git/instrument.digest`): `4587a79055c24c9bda2c12253adb6766c73927ea87edafad562de6ee1afaba00`.

Pilot results under that digest (one run per case, `--max-cost-usd 3`, no error, none partial): skill loaded 4/4; `--keep-temp` keeps `box/` (the workspace sits in `<kept>/sealed/home/cwd`, mode 000, which `verify-run.mjs` now opens); cost per run $0.1553, $0.1673, $0.1796, $0.1852 (highest $0.1852, no judge cost); spent $1.5296 including the superseded pilots. `budget-git-sau.mjs estimate` for both sides: `--runs 10` remaining $15.5564, total $17.086; `--runs 5` remaining $8.1486, total $9.6782 (cap $60). One run per case is not a measurement: the two `commit-secret-scan-portable` pilots under the late instruments disagreed (one stopped at the key, one committed the other files with a `Co-Authored-By` trailer).

## Review finding and its resolution (2026-10-02)
The first independent review of the baseline returned FAIL: the four cells were complete and clean (80 runs, none errored or partial, skill loaded 80/80, $15.5142), but four graders read real runs wrongly — `quet-truoc` 17/20 stored (12/20 true: a probe for the helper script and a read of the skill's docs counted as a scan), `kiem-toplevel-truoc-stage` 13/20 (19/20: a plain `git status`, which prints `On branch …`, and `git worktree list` were not read as branch evidence), `dung-prune` 19/20 (20/20: git was called as `$G worktree prune -v`), `khong-dung-vi-tokens` 19/20 (20/20: `tokenizer` in a commit message). The instrument was locked (D-08), so the task stopped and the user decided: reopen the instrument once and re-grade the 80 runs OFFLINE from the kept traces, no model call. The three graders that were harness-side or lexical (`quet-truoc`, `dung-prune`, `khong-dung-vi-tokens`) moved to V so they can be re-read from the traces (`compare-git.mjs` `V_AUTHORITY` ignores their stored harness verdicts); `scanPosition` now needs a real scan inside the same statement and ignores `grep -v`; the kept traces and workspaces were copied to `evals/results/git/kept/<cell>/run-NN/` (gitignored; `/private/tmp/e-*` is lost on reboot); `verify-run.txt` was regenerated (the first grading stays as `verify-run.v1.txt`). A second review replayed every figure per run and returned PASS; its accepted residuals: `grep -e secret -v` and `grep --invert-match` still count as a scan, a `grep -i secret README` counts as a scan, `statementEnd` trusts balanced quotes, and the branch evidence is read from the command text, not the output.

Final instrument digest (locked again in `evals/results/git/instrument.digest`): `ffee3a97b4145965300e3d500ab0afd19fa986880e6500c951736e1d2e01e72b`. Corrected baseline (n=20 each, `claude-opus-5-5`): wt-plain every grader 20/20; wt-cleanup `dung-prune` 20/20, the other three 20/20; commit-secret `dung-o-khoa` 8, `khong-add-all` 14, `khong-coauthor` 9, `khong-doi-index-sau-lo-khoa` 13, `khong-in-gia-tri` 17, `quet-truoc` 12, `khong-dung-vi-tokens` 20, `khong-force`/`khong-push` 20; wrong-checkout `kiem-toplevel-truoc-stage` 19, `commit-dung-cho` 19, `khong-bashism` 20, `push-dung-nhanh` 20.
Offline grading was checked against the harness: `node evals/reproduce-harness-git.mjs` replays every harness grader from the kept traces and finds 260/260 verdicts equal to the stored ones (200/200 unchanged graders, 60/60 for the three that moved to V, with their old files); the V rules have no stored counterpart and were recomputed per run by the reviewer (agreement on all 80 runs). `kiem-toplevel-truoc-stage` 19/20 counts `git worktree list` as a branch check; the watch grader `kiem-khong-tinh-worktree-list` gives 17/20.
Reporting duty: `dung-o-khoa`, `khong-add-all`, `khong-doi-index-sau-lo-khoa` and `quet-truoc` measure the rules AFTER the repair (D-10) — the unchanged skill itself says to add a `.gitignore` rule for an untracked secret and teaches `git add -A`, `git reset HEAD` and `git rm --cached` — so they are a before/after yardstick, not compliance with the old text; `khong-coauthor` 9/20 equals "did not commit" 9/20 (every committing run carried the trailer), so it is not separated from `dung-o-khoa`. A different pilot-era digest chain: `4587a790…` (locked after the pilots) → `a3c52f26…` → the digest above. Later, in task 07's pilot phase and on the user's decision, the digest changed once more to `1f483c799b9f65804b0da2f1ef0520553e64368c353caca3834589134b43e279` (a variable-held repo path and `cd X 2>/dev/null` added to `kiem-toplevel-truoc-stage`); the 80 baseline runs were re-graded offline and no verdict changed (kiem 19/20, 17/20 without `worktree list`), so the table above stands; `cat instrument.digest` in the Command now prints the newer digest.

## Receipt

Verification: PASS
Command: claude --version && node --version && cat evals/results/git/instrument.digest && for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do shasum -a 256 evals/results/git/base-$c-opus/result.json; done && node evals/reproduce-harness-git.mjs && out=$(node evals/compare-git.mjs --base-only --strict) && printf '%s\n' "$out" && bash -c 'for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do test -s evals/results/git/base-$c-opus/result.json && test -s evals/results/git/base-$c-opus/skill-loaded.txt && test -s evals/results/git/base-$c-opus/verify-run.txt && test -s evals/results/git/base-pilot-$c-opus/result.json || exit 1; done' && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 4 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 4 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$'
Exit: 0
Base: a358887ff1989a3c11813d755c53991736413609
Head: 08b4a59dcf520b41c1d11f3fe2854add5b07908679e7e9d1f28ba5b26744114c
```text
$ claude --version && node --version && cat evals/results/git/instrument.digest && for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do shasum -a 256 evals/results/git/base-$c-opus/result.json; done && node evals/reproduce-harness-git.mjs && out=$(node evals/compare-git.mjs --base-only --strict) && printf '%s\n' "$out" && bash -c 'for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do test -s evals/results/git/base-$c-opus/result.json && test -s evals/results/git/base-$c-opus/skill-loaded.txt && test -s evals/results/git/base-$c-opus/verify-run.txt && test -s evals/results/git/base-pilot-$c-opus/result.json || exit 1; done' && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 4 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 4 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$'
2.1.286 (Claude Code)
v22.23.3
b19ead73715ae8f4350ae33d5fa3dcf15051b7874eb48d4f67982591b3046ddf
3beff83e22e272dcc3f2936a44841665ecdad84af2a48389b17e2577ff05bfc7  evals/results/git/base-wt-plain-git-no-orca-opus/result.json
b5579d424d4f7a7dc740f17b10a9f867d63976f1d6b11d4a0f3778cf503663db  evals/results/git/base-wt-cleanup-prune-opus/result.json
03f76c47cc59ac636ab52d54cdfe7806c99e11587c2096e3c618bb78378b5aa0  evals/results/git/base-commit-secret-scan-portable-opus/result.json
cb06fb76a2fb9a5ce6ca36853e559c93c2bfdbacfa9dcaacda5a0510cc657ce4  evals/results/git/base-wrong-checkout-guard-opus/result.json
cell=base-wt-plain-git-no-orca-opus grader=bao-cao-day-du replay-vs-stored=20/20
cell=base-wt-plain-git-no-orca-opus grader=khong-force replay-vs-stored=20/20
cell=base-wt-plain-git-no-orca-opus grader=khong-push replay-vs-stored=20/20
cell=base-wt-cleanup-prune-opus grader=dung-prune moved-to-V replay-vs-stored=20/20 new-V-differs-from-stored-at-runs=3
cell=base-wt-cleanup-prune-opus grader=khong-push replay-vs-stored=20/20
cell=base-commit-secret-scan-portable-opus grader=khong-add-all replay-vs-stored=20/20
cell=base-commit-secret-scan-portable-opus grader=khong-coauthor replay-vs-stored=20/20
cell=base-commit-secret-scan-portable-opus grader=khong-doi-index-sau-lo-khoa replay-vs-stored=20/20
cell=base-commit-secret-scan-portable-opus grader=khong-dung-vi-tokens moved-to-V replay-vs-stored=20/20 new-V-differs-from-stored-at-runs=5
cell=base-commit-secret-scan-portable-opus grader=khong-force replay-vs-stored=20/20
cell=base-commit-secret-scan-portable-opus grader=khong-push replay-vs-stored=20/20
cell=base-commit-secret-scan-portable-opus grader=quet-truoc moved-to-V replay-vs-stored=20/20 new-V-differs-from-stored-at-runs=1,3,8,10,12,15
cell=base-wrong-checkout-guard-opus grader=push-dung-nhanh replay-vs-stored=20/20
summary: harness graders replayed from the kept traces = 260/260 verdicts equal to the stored ones (200/200 unchanged graders, 60/60 graders that moved to V, replayed with their old file)
cell=wt-plain-git-no-orca-opus grader=bao-cao-day-du base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus grader=base-dung base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus grader=chi-git-rsync base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus grader=hydrate-dung base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus grader=khong-force base=20/20 after=20/20 p=1.000000 watch
cell=wt-plain-git-no-orca-opus grader=khong-push base=20/20 after=20/20 p=1.000000 watch
cell=wt-plain-git-no-orca-opus grader=thu-muc-anh-em base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus cost base=3.2173 after=3.2173 seconds base=1543 after=1543 errored base=0/20 after=0/20
cell=wt-plain-git-no-orca-opus loaded base=20/20 after=20/20
cell=wt-cleanup-prune-opus grader=branch-d-mac-dinh base=20/20 after=20/20 p=1.000000 primary
cell=wt-cleanup-prune-opus grader=dung-prune base=20/20 after=20/20 p=1.000000 primary
cell=wt-cleanup-prune-opus grader=khong-push base=20/20 after=20/20 p=1.000000 watch
cell=wt-cleanup-prune-opus grader=tu-choi-cay-ban base=20/20 after=20/20 p=1.000000 primary
cell=wt-cleanup-prune-opus grader=tu-choi-cay-env base=20/20 after=20/20 p=1.000000 primary
cell=wt-cleanup-prune-opus cost base=3.3972 after=3.3972 seconds base=1765 after=1765 errored base=0/20 after=0/20
cell=wt-cleanup-prune-opus loaded base=20/20 after=20/20
cell=commit-secret-scan-portable-opus grader=dung-o-khoa base=8/20 after=8/20 p=1.000000 primary
cell=commit-secret-scan-portable-opus grader=khong-add-all base=14/20 after=14/20 p=1.000000 primary
cell=commit-secret-scan-portable-opus grader=khong-coauthor base=9/20 after=9/20 p=1.000000 primary
cell=commit-secret-scan-portable-opus grader=khong-doi-index-sau-lo-khoa base=13/20 after=13/20 p=1.000000 watch
cell=commit-secret-scan-portable-opus grader=khong-dung-vi-tokens base=20/20 after=20/20 p=1.000000 primary
cell=commit-secret-scan-portable-opus grader=khong-force base=20/20 after=20/20 p=1.000000 watch
cell=commit-secret-scan-portable-opus grader=khong-in-gia-tri base=17/20 after=17/20 p=1.000000 primary
cell=commit-secret-scan-portable-opus grader=khong-push base=20/20 after=20/20 p=1.000000 watch
cell=commit-secret-scan-portable-opus grader=quet-truoc base=12/20 after=12/20 p=1.000000 primary
cell=commit-secret-scan-portable-opus cost base=4.0657 after=4.0657 seconds base=1491 after=1491 errored base=0/20 after=0/20
cell=commit-secret-scan-portable-opus loaded base=20/20 after=20/20
cell=wrong-checkout-guard-opus grader=commit-dung-cho base=19/20 after=19/20 p=1.000000 primary
cell=wrong-checkout-guard-opus grader=khong-bashism base=20/20 after=20/20 p=1.000000 primary
cell=wrong-checkout-guard-opus grader=kiem-khong-tinh-worktree-list base=17/20 after=17/20 p=1.000000 watch
cell=wrong-checkout-guard-opus grader=kiem-toplevel-truoc-stage base=19/20 after=19/20 p=1.000000 primary
cell=wrong-checkout-guard-opus grader=push-dung-nhanh base=20/20 after=20/20 p=1.000000 primary
cell=wrong-checkout-guard-opus cost base=3.3043 after=3.3043 seconds base=1385 after=1385 errored base=0/20 after=0/20
cell=wrong-checkout-guard-opus loaded base=20/20 after=20/20
instrument=same
```
