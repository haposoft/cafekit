# Task 04 — Comparison, budget, stage-root and skill-loaded helpers exist

Status: done

## Outcome
Before any paid run, four helpers exist that read and write the one real result location: a cell-by-cell comparison, a $60 budget guard that counts pilots and reruns, a stage-root that builds a run root for the unchanged (`goc`) or repaired (`sau`) skill, and a counter of runs that really loaded `cf:git`.

## Scope
- In: four new scripts, each with `--self-test` where it computes anything.
- Out: every existing file under `evals/` except the new ones named here; any paid run.

## Coverage
- CP-02

## Ownership
- Create: `evals/compare-git.mjs`, `evals/budget-git-sau.mjs`, `evals/git/stage-root.sh`, `evals/git/skill-loaded.mjs`
- Read: `evals/compare-code-review.mjs`, `evals/budget-research-sau.mjs`, `evals/run.sh`, `evals/git/verify-run.mjs`, `../cafekit-fix-fix-repair/evals/fix-s55/stage-root.sh`, `../cafekit-fix-fix-repair/evals/fix-s55/skill-loaded.mjs`

## Steps
1. `evals/compare-git.mjs [--base-only] [--strict] [--root <dir>]` (default root `evals/results/git`): cases `wt-plain-git-no-orca`, `wt-cleanup-prune`, `commit-secret-scan-portable`, `wrong-checkout-guard`; one model, `opus`. Read `base-<case>-opus/result.json` and `sau-<case>-opus/result.json` (with `--base-only` the base cell on both sides). Count, over runs of `cases[0].arms.with` without `error` and without `skippedPaidGraders`, every harness grader, and add the `verify-run.txt` verdicts of the cell as graders (`yes` counts, `error` runs are excluded); a grader name that appears in both sources (`dung-prune`) counts a run as `yes` only when both say `yes`. Print `cell=<case>-opus grader=<g> base=<x>/<n> after=<y>/<m> p=<p> <primary|watch>` (two-sided Fisher exact as `evals/compare-code-review.mjs:43-56`; `primary` per the inventory in `plan.md`), then per cell `cell=<case>-opus cost base=<x> after=<y> seconds base=<s> after=<t> errored base=<e>/<n> after=<f>/<m>` and `cell=<case>-opus loaded base=<k>/<n> after=<j>/<m>` (from `skill-loaded.txt`), and `instrument=<same|changed>` comparing the instrument digest (D-08 in `plan.md`: `evals/git/**`, `evals/compare-git.mjs`, `evals/budget-git-sau.mjs`) with `evals/results/git/instrument.digest`. With no cell present print `no cells` and exit 0. `--strict` exits 1 when any cell has `loaded` 0, `errored` equal to its run count, `n` below 5, different `n` on the two sides (unless `--base-only`), the instrument `changed`, or (without `--base-only`) a base and an after directory that are the same. `--self-test` checks the Fisher figures, the filters, the merge of the two grader sources, and a fixture result tree.
2. `evals/budget-git-sau.mjs [--root <dir>] [--cap <n>]`: sum top-level `costUsd` and each run's `judgeCostUsd` over every `result.json` directly under every `base-*` and `sau-*` directory of the root (pilots and `-lan<k>` reruns included); print amounts as `Number(x.toFixed(4))`; `spent` prints `budget: spent=<x> cap=<cap>` and exits 1 above the cap; `check <next>` prints `budget: spent=<x> next=<n> total=<t> cap=<cap>` and exits 1 when spent plus next exceeds the cap or `<next>` is not a number; `estimate --runs <n>` takes the highest per-run cost among the `*-pilot-*` results present and prints `estimate: spent=<x> remaining=<r> total=<t> cap=<cap>` where `remaining` is every unfinished cell of both sides at `n` runs, plus any `sau-pilot-*` not yet run (one run per case), and exits 1 when `total` exceeds the cap; default cap 60; `--self-test` includes a fixture with a pilot, a `-lan1` rerun and a missing cell.
3. `evals/git/stage-root.sh <goc|sau> <root>`: copy `evals/run.sh`, `evals/compare-git.mjs`, `packages/spec/package.json` and `evals/git/` into `<root>` (the caller passes a `mktemp -d` path; refuse a root inside `evals/results/`), with the `git` skill from `git archive 26103b9 packages/spec/src/claude/skills/git` for `goc` and from this worktree for `sau`; print `side=`, `run-sh-sha256:`, `instrument:` (the D-08 instrument digest), and `skill-git:` (digest of the skill directory); copy nothing into `evals/results/`.
4. `evals/git/skill-loaded.mjs <result dir>...`: a run is `loaded` when a `Skill` tool call named `git` or `cf:git` receives a result starting `Launching skill: ` and the trace holds a message beginning `Base directory for this skill: ` and ending `/skills/git`; print per-run lines and `<dir> loaded=<k>/<n> model=<ids from the init event>`; `--self-test`.

## Acceptance
- AC-02: every `--self-test` exits 0; `compare-git.mjs --base-only` on an empty root prints `no cells` and exits 0; `budget-git-sau.mjs spent --cap -1` exits 1; on an empty root `check 61` exits 1 and `check 1` exits 0; `stage-root.sh goc` stages the baseline skill text (its `commit-protocols.md` still holds the line `git add -A`); the `instrument:` digest `stage-root.sh` prints equals `compare-git.mjs --digest`; a root inside `evals/results/` is refused (exit 2) without being created.

## Dependencies
- task-03-commit-cases.md

## Verification Plan
- Command: `node --check evals/compare-git.mjs && node --check evals/budget-git-sau.mjs && node --check evals/git/skill-loaded.mjs && node evals/compare-git.mjs --self-test && node evals/budget-git-sau.mjs --self-test && node evals/git/skill-loaded.mjs --self-test && bash -n evals/git/stage-root.sh && e=$(mktemp -d) && node evals/compare-git.mjs --base-only --root "$e" | grep -qx 'no cells' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$' && ! node evals/budget-git-sau.mjs spent --root "$e" --cap -1 && ! node evals/budget-git-sau.mjs check 61 --root "$e" && node evals/budget-git-sau.mjs check 1 --root "$e" && r=$(mktemp -d) && bash evals/git/stage-root.sh goc "$r/goc" | grep -q '^skill-git:' && grep -q '^git add -A' "$r/goc/packages/spec/src/claude/skills/git/references/commit-protocols.md" && [ "$(bash evals/git/stage-root.sh sau "$r/sau" | sed -n 's/^instrument: //p')" = "$(node evals/compare-git.mjs --digest)" ] && ! bash evals/git/stage-root.sh goc "$PWD/evals/results/refused" >/dev/null 2>&1 && ! bash evals/git/stage-root.sh goc "$PWD/evals/Results/refused" >/dev/null 2>&1 && [ ! -e evals/results/refused ] && rm -rf "$e" "$r"`
- Named probe: the three `--self-test` runs, the `spent`/`check` calls on an empty root, and the `goc` staging check.
- Reachability: task 05's Command and Steps call all four; task 07's Command calls `compare-git.mjs --strict` and `budget-git-sau.mjs`.
- Oracle: exit 0; the `spent` line matches `spent=[0-9.]+` so the Command replays after money is spent; the `goc` skill holds the baseline text of `26103b9` (replayable after task 06 repairs the live skill).
- Counterexample: a budget that ignores `judgeCostUsd`, a pilot directory or a `-lan` rerun, or that reads a nested root, fails its self-test; a comparison that counts errored runs, drops the `verify-run.txt` graders, or reads the same side twice fails its self-test; a `skill-loaded` that counts a run whose result is an error fails its self-test; a stage-root that stages the live skill for `goc` fails the `git add -A` check; a stage-root whose digest algorithm differs from `compare-git.mjs` would make `instrument=same` impossible and fails the equality check; one that creates the refused root fails the last check.
- Artifacts: none beyond the four scripts; output ephemeral; the temp roots are removed.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --check evals/compare-git.mjs && node --check evals/budget-git-sau.mjs && node --check evals/git/skill-loaded.mjs && node evals/compare-git.mjs --self-test && node evals/budget-git-sau.mjs --self-test && node evals/git/skill-loaded.mjs --self-test && bash -n evals/git/stage-root.sh && e=$(mktemp -d) && node evals/compare-git.mjs --base-only --root "$e" | grep -qx 'no cells' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$' && ! node evals/budget-git-sau.mjs spent --root "$e" --cap -1 && ! node evals/budget-git-sau.mjs check 61 --root "$e" && node evals/budget-git-sau.mjs check 1 --root "$e" && r=$(mktemp -d) && bash evals/git/stage-root.sh goc "$r/goc" | grep -q '^skill-git:' && grep -q '^git add -A' "$r/goc/packages/spec/src/claude/skills/git/references/commit-protocols.md" && [ "$(bash evals/git/stage-root.sh sau "$r/sau" | sed -n 's/^instrument: //p')" = "$(node evals/compare-git.mjs --digest)" ] && ! bash evals/git/stage-root.sh goc "$PWD/evals/results/refused" >/dev/null 2>&1 && ! bash evals/git/stage-root.sh goc "$PWD/evals/Results/refused" >/dev/null 2>&1 && [ ! -e evals/results/refused ] && rm -rf "$e" "$r"
Exit: 0
Base: 20ba7e7efdbd3ac09f34867ba078a60f88929336
Head: f5ab24a1f885e5ebe2300d3cc28457cedc2ebd99a9beb30da74f92988899d899
```text
$ node --check evals/compare-git.mjs && node --check evals/budget-git-sau.mjs && node --check evals/git/skill-loaded.mjs && node evals/compare-git.mjs --self-test && node evals/budget-git-sau.mjs --self-test && node evals/git/skill-loaded.mjs --self-test && bash -n evals/git/stage-root.sh && e=$(mktemp -d) && node evals/compare-git.mjs --base-only --root "$e" | grep -qx 'no cells' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$' && ! node evals/budget-git-sau.mjs spent --root "$e" --cap -1 && ! node evals/budget-git-sau.mjs check 61 --root "$e" && node evals/budget-git-sau.mjs check 1 --root "$e" && r=$(mktemp -d) && bash evals/git/stage-root.sh goc "$r/goc" | grep -q '^skill-git:' && grep -q '^git add -A' "$r/goc/packages/spec/src/claude/skills/git/references/commit-protocols.md" && [ "$(bash evals/git/stage-root.sh sau "$r/sau" | sed -n 's/^instrument: //p')" = "$(node evals/compare-git.mjs --digest)" ] && ! bash evals/git/stage-root.sh goc "$PWD/evals/results/refused" >/dev/null 2>&1 && ! bash evals/git/stage-root.sh goc "$PWD/evals/Results/refused" >/dev/null 2>&1 && [ ! -e evals/results/refused ] && rm -rf "$e" "$r"
self-test ok: fisher, AND-merge, V-only graders, error and skipped exclusion, cost, loaded, instrument, every strict problem
self-test ok: spent, perRun, estimate
self-test ok: launched=yes (plain, plugin-prefixed), no call=no, error result=no, other skill=no, missing base text=no, unreadable=error
budget: spent=0 cap=-1
budget: spent=0 next=61 total=61 cap=60
budget: spent=0 next=1 total=1 cap=60
```
