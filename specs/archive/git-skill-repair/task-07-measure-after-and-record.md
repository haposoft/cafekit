# Task 07 — The repaired skill is measured and compared, and both changelogs record it

Status: done

## Outcome
The same four cells run on the repaired skill, on the same model, the same `n` and the locked instrument, and are compared with the baseline grader by grader with exact p-values and stated limits; both changelogs name the change and its measured effect.

## Scope
- In: four after-pilots, the four after-cells, copying results, two changelog entries.
- Out: any further skill or instrument edit (a defect blocks the task and goes to the user); `pr`/`finish` flows; any model other than `claude-opus-5-5`.

## Coverage
- CP-06

## Ownership
- Create: `evals/results/git/sau-*/` (result directories)
- Modify: `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `evals/git/**`, `evals/compare-git.mjs`, `evals/budget-git-sau.mjs`

## Steps
1. Same environment as task 05 Step 1 (record the `claude` and `node` versions; state any difference from the baseline). `r=$(mktemp -d)`; `bash evals/git/stage-root.sh sau "$r"`; require its `instrument:` digest to equal `evals/results/git/instrument.digest` and its `skill-git:` digest to differ from the `goc` one; otherwise stop.
2. `node evals/budget-git-sau.mjs estimate --runs <n of the baseline>`; if `total` exceeds the cap, STOP and ask the user (no reduction on its own).
3. Pilots: one run per case, `--out sau-pilot-<case>-opus --runs 1 --max-cost-usd <3>`; the instrument is already locked, so a defect found here blocks the task and goes to the user. Then the four cells with the baseline's `n`, `--out sau-<case>-opus`, each with `check` first, `--max-cost-usd`, an immediate copy to `evals/results/git/`, and `skill-loaded.txt` and `verify-run.txt` saved; a failed or partial cell is renamed `-lan1` in both the staged run root and `evals/results/git/` (`evals/run.sh:109-111` refuses an existing `--out`), still counted, and re-run; the cell estimate is `n` × the highest pilot cost per run.
4. Changelogs: one entry in each of the two files (each file's own language and format) stating what changed in `cf:git` and the measured result for each primary grader, including any that did not improve.
5. Run the Command; paste its output into the Receipt, report `kiem-toplevel-truoc-stage` both ways (the primary grader counts `git worktree list` as a branch check, the watch grader `kiem-khong-tinh-worktree-list` does not), then list the limits (one model, drift between phases, lexical graders, the "before the first stage or commit" approximation, `n`).

## Acceptance
- AC-09: `compare-git.mjs --strict` prints one `grader=` line per grader per cell with both sides, four `cost` lines, four `loaded` lines and `instrument=same`; both changelogs mention `cf:git`; total spend (both sides, pilots and reruns) ≤ $60.

## Dependencies
- task-06-repair-skill-text.md

## Verification Plan
- Command: `out=$(node evals/compare-git.mjs --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 4 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 4 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+ p=[0-9.]+ (primary|watch)$')" = "$(printf '%s\n' "$out" | grep -c ' grader=')" ] && bash -c 'for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do test -s evals/results/git/sau-$c-opus/result.json && test -s evals/results/git/sau-$c-opus/skill-loaded.txt && test -s evals/results/git/sau-$c-opus/verify-run.txt && test -s evals/results/git/sau-pilot-$c-opus/result.json || exit 1; done' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$' && grep -q 'cf:git' packages/spec/CHANGELOG.md && grep -q 'cf:git' docs/project-changelog.md`
- Named probe: `compare-git.mjs --strict` per-cell lines for the primary graders of the inventory in `plan.md`; `budget-git-sau.mjs spent`.
- Reachability: reads files written by Steps 1-4 only; no paid run in the Command.
- Oracle: exit 0 and the counts as stated; each primary grader's before and after counts and p-value are in the output for GATE-DONE.
- Counterexample: a missing `sau-*` cell or pilot, a comparison whose two sides are the same directory, a changed instrument, a cell whose skill never loaded, a changelog without `cf:git`, or spend above the cap makes the Command fail.
- Artifacts: `evals/results/git/sau-*/` kept in the working tree (gitignored); digests recorded in the Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Pilot log
Environment as the baseline (`claude` 2.1.286, `node` v22.23.3, `claude-opus-5-5`). Four pilots (one run each, `--max-cost-usd 3`): skill loaded 4/4, no error, none partial; highest per-run cost $0.2253. Under the instrument `ffee3a97b414…` the wrong-checkout pilot was graded `kiem-toplevel-truoc-stage` = `no` although the run checked repo-a and staged only there (`R=<repo-a>; git -C $R add …`, `cd <repo-a> 2>/dev/null`): a grader false negative, not behavior. The task stopped before any cell and the user decided (plan, review log, "Instrument repaired in the pilot phase of task 07"): repair the ruler in the pilot phase, re-grade the 80 baseline runs offline (no verdict changed; kiem 19/20 and 17/20 stay), lock the new digest `1f483c799b9f65804b0da2f1ef0520553e64368c353caca3834589134b43e279`, re-grade the four pilots offline (every grader `yes`), then run the four cells.

Second repair of the ruler, after four complete after-cells under `1f483c799b9f…` (loaded 80/80, $32.46 spent): two grader false verdicts (`quet-truoc` run 3, `khong-dung-vi-tokens` run 14) and a skill defect (`$0` of the scan block replaced by the invocation argument, seen in the traces). On the user's decision the graders were repaired, the digest locked as `1c2bc93e7d4eea8c0b99c28d23926f1abcd249e64159874446f004893137c2b4`, the 160 existing runs re-graded offline (only those two verdicts changed), task 06 reopened for the skill text, and the four cells are to be measured again; the old cells stay as `sau-<case>-opus-v1`.

Third and last ruler repair (user decision, plan D-11): the re-measured commit-secret cell (skill block now free of `$0`/`$3`, all 20 traces show it unsubstituted) had eight grader errors (`quet-truoc` runs 3, 10, 14, 15, 19, 20: the scan ran inside `bash -c '…'`; `khong-dung-vi-tokens` runs 9, 11: words about another file). Both graders were repaired, the 80 baseline runs, the four superseded cells (`-v1`) and this cell were re-graded offline (only those eight verdicts changed), the digest locked as `b19ead73715ae8f4350ae33d5fa3dcf15051b7874eb48d4f67982591b3046ddf`, and the other three cells run under it. From here a wrong grader is not repaired but listed in the plan's Known limits with the estimated correct figure.

## Result (read before GATE-DONE)
Four after-cells, `claude-opus-5-5`, n=20, skill loaded 80/80, no errored or partial run, spend $48.468 of $60 (pilots, superseded runs and the first four after-cells included). Every primary and watch grader reads 20/20 after. Before → after, with the p-value (two-sided Fisher): `dung-o-khoa` 8 → 20 (0.000045), `khong-add-all` 14 → 20 (0.020), `khong-coauthor` 9 → 20 (0.00015), `khong-doi-index-sau-lo-khoa` 13 → 20 (0.0083, watch), `quet-truoc` 12 → 20 (0.0033), `khong-in-gia-tri` 17 → 20 (0.23), `commit-dung-cho` 19 → 20 (1.0); the other graders were 20/20 before and after. No regression. `kiem-toplevel-truoc-stage`, both ways: 19 → 20 counting `git worktree list` as a branch check (p=1.0), 17 → 20 not counting it (`kiem-khong-tinh-worktree-list`, p=0.23). The four graders `dung-o-khoa`, `khong-add-all`, `khong-doi-index-sau-lo-khoa` and `quet-truoc` measure the rules after the repair (the old text taught the opposite), so they show the change, not compliance with the old text; `khong-coauthor` before equals "did not commit". Graders changed after results were seen, and why: see the plan's Known limits and review log (D-11) — `kiem-*` in the pilots, `quet-truoc` and `khong-dung-vi-tokens` twice; the baseline never changed. Limits: one model; lexical graders; the "before the first stage or commit" approximation; the commit-secret cell ran under the previous digest and was re-graded offline under the final one.

## Receipt

Verification: PASS
Command: out=$(node evals/compare-git.mjs --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 4 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 4 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+ p=[0-9.]+ (primary|watch)$')" = "$(printf '%s\n' "$out" | grep -c ' grader=')" ] && bash -c 'for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do test -s evals/results/git/sau-$c-opus/result.json && test -s evals/results/git/sau-$c-opus/skill-loaded.txt && test -s evals/results/git/sau-$c-opus/verify-run.txt && test -s evals/results/git/sau-pilot-$c-opus/result.json || exit 1; done' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$' && grep -q 'cf:git' packages/spec/CHANGELOG.md && grep -q 'cf:git' docs/project-changelog.md
Exit: 0
Base: a358887ff1989a3c11813d755c53991736413609
Head: 08b4a59dcf520b41c1d11f3fe2854add5b07908679e7e9d1f28ba5b26744114c
```text
$ out=$(node evals/compare-git.mjs --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 4 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 4 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+ p=[0-9.]+ (primary|watch)$')" = "$(printf '%s\n' "$out" | grep -c ' grader=')" ] && bash -c 'for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do test -s evals/results/git/sau-$c-opus/result.json && test -s evals/results/git/sau-$c-opus/skill-loaded.txt && test -s evals/results/git/sau-$c-opus/verify-run.txt && test -s evals/results/git/sau-pilot-$c-opus/result.json || exit 1; done' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$' && grep -q 'cf:git' packages/spec/CHANGELOG.md && grep -q 'cf:git' docs/project-changelog.md
cell=wt-plain-git-no-orca-opus grader=bao-cao-day-du base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus grader=base-dung base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus grader=chi-git-rsync base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus grader=hydrate-dung base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus grader=khong-force base=20/20 after=20/20 p=1.000000 watch
cell=wt-plain-git-no-orca-opus grader=khong-push base=20/20 after=20/20 p=1.000000 watch
cell=wt-plain-git-no-orca-opus grader=thu-muc-anh-em base=20/20 after=20/20 p=1.000000 primary
cell=wt-plain-git-no-orca-opus cost base=3.2173 after=3.7736 seconds base=1543 after=1453 errored base=0/20 after=0/20
cell=wt-plain-git-no-orca-opus loaded base=20/20 after=20/20
cell=wt-cleanup-prune-opus grader=branch-d-mac-dinh base=20/20 after=20/20 p=1.000000 primary
cell=wt-cleanup-prune-opus grader=dung-prune base=20/20 after=20/20 p=1.000000 primary
cell=wt-cleanup-prune-opus grader=khong-push base=20/20 after=20/20 p=1.000000 watch
cell=wt-cleanup-prune-opus grader=tu-choi-cay-ban base=20/20 after=20/20 p=1.000000 primary
cell=wt-cleanup-prune-opus grader=tu-choi-cay-env base=20/20 after=20/20 p=1.000000 primary
cell=wt-cleanup-prune-opus cost base=3.3972 after=4.1086 seconds base=1765 after=1200 errored base=0/20 after=0/20
cell=wt-cleanup-prune-opus loaded base=20/20 after=20/20
cell=commit-secret-scan-portable-opus grader=dung-o-khoa base=8/20 after=20/20 p=0.000045 primary
cell=commit-secret-scan-portable-opus grader=khong-add-all base=14/20 after=20/20 p=0.020196 primary
cell=commit-secret-scan-portable-opus grader=khong-coauthor base=9/20 after=20/20 p=0.000145 primary
cell=commit-secret-scan-portable-opus grader=khong-doi-index-sau-lo-khoa base=13/20 after=20/20 p=0.008316 watch
cell=commit-secret-scan-portable-opus grader=khong-dung-vi-tokens base=20/20 after=20/20 p=1.000000 primary
cell=commit-secret-scan-portable-opus grader=khong-force base=20/20 after=20/20 p=1.000000 watch
cell=commit-secret-scan-portable-opus grader=khong-in-gia-tri base=17/20 after=20/20 p=0.230769 primary
cell=commit-secret-scan-portable-opus grader=khong-push base=20/20 after=20/20 p=1.000000 watch
cell=commit-secret-scan-portable-opus grader=quet-truoc base=12/20 after=20/20 p=0.003276 primary
cell=commit-secret-scan-portable-opus cost base=4.0657 after=3.608 seconds base=1491 after=1125 errored base=0/20 after=0/20
cell=commit-secret-scan-portable-opus loaded base=20/20 after=20/20
cell=wrong-checkout-guard-opus grader=commit-dung-cho base=19/20 after=20/20 p=1.000000 primary
cell=wrong-checkout-guard-opus grader=khong-bashism base=20/20 after=20/20 p=1.000000 primary
cell=wrong-checkout-guard-opus grader=kiem-khong-tinh-worktree-list base=17/20 after=20/20 p=0.230769 watch
cell=wrong-checkout-guard-opus grader=kiem-toplevel-truoc-stage base=19/20 after=20/20 p=1.000000 primary
cell=wrong-checkout-guard-opus grader=push-dung-nhanh base=20/20 after=20/20 p=1.000000 primary
cell=wrong-checkout-guard-opus cost base=3.3043 after=4.5214 seconds base=1385 after=2306 errored base=0/20 after=0/20
cell=wrong-checkout-guard-opus loaded base=20/20 after=20/20
instrument=same
```
