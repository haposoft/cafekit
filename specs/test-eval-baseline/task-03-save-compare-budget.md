# Task 03 — Test cells are saved, compared and budgeted

Status: done

## Outcome
`evals/test/save-runs.mjs`, `compare.mjs` and `budget.mjs` (plan D-04) save each run's final files, git status and last answer with its loading and cap facts, compare cells per grader and on `joint`, and enforce the $100 cap with integer ceilings, a one-run reserve, interrupted-cell costs and a fit check.

## Scope
- In: the three tools with self-tests; `check-fixtures.sh` running them.
- Out: `evals/develop/` tools; graders; results.

## Coverage
- CP-03

## Ownership
- Create: `evals/test/save-runs.mjs`, `evals/test/compare.mjs`, `evals/test/budget.mjs`
- Modify: `evals/test/check-fixtures.sh`
- Read: `evals/develop/{save-runs,compare,budget}.mjs`

## Steps
1. `save-runs.mjs` as plan D-04: saved parts, marker escaping, lost runs failing `save` and `--check-saved`, `GIT_OPTIONAL_LOCKS=0`, the flags and `-lan1`.
2. `compare.mjs --base <prefix> [--after <prefix> | --base-only] [--cells …]` (default: four cases × sonnet, opus): hyphenated cases, explicit joint members with the `thieu-cong-cu` alternative (`chay-dung-lenh` or `chi-blocked` and `kiem-cong-cu`, the only watch graders in `joint`), other watch graders kept out of `joint`, refusal of a missing member or a lost run, the `joint`, `capped`, `unloaded`, `errored`, `comparable` lines.
3. `budget.mjs spent | check <next> | ceiling <model> | reserve <model> | fits [--assume-missing <usd>]` as plan D-04: `spent` adds every `evals/results/test/**/result.json` and `_kept/**/*.lost.json`; `ceiling` over `pilot-<case>-<model>` (or `-lan1`), refusing a missing or unclean pilot, except that `fits --assume-missing <usd>` adds `<usd>` to `spent` for each missing pilot and takes that model's ceiling from the pilots present; `reserve` = ceiling + highest pilot cost; `fits` exits 1 unless `spent` + 4 × each model's `reserve` ≤ 100.
4. Self-tests that fail when any Step 1–3 feature is removed; `check-fixtures.sh` runs them. Run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-03: each tool's `--self-test` passes; the checker runs them; the Command prints `evals-test-digest:`.

## Dependencies
- task-02-four-cases-with-graders.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in save-runs compare budget; do node evals/test/$t.mjs --self-test || exit 1; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'`
- Named probe: the three self-tests; the checker
- Reachability: known — tasks 04 and 05 call the tools
- Oracle: the Command exits 0 with every self-test line `ok:`
- Counterexample: removing a feature named in Steps 1–3 makes its self-test fail
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in save-runs compare budget; do node evals/test/$t.mjs --self-test || exit 1; done && bash evals/test/check-fixtures.sh > /dev/null && echo "checker: ok" && n=$( (cd evals/test && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-test-digest: $n"'
Exit: 0
Base: 69d08975a4aea14d5e0d07ef09ffd9ec3f7eae1b
Head: cc860298d1ce86c3ea3c6a73c9d226dba3191dee060a6bbe3b96eadb4a8584f1
```text
ok: save-runs self-test: a sealed/home/cwd workspace is found and saved
ok: save-runs self-test: plan.md, package.json, src/greet.js and test/greet.test.js are saved
ok: save-runs self-test: the workspace's git status --porcelain is saved
ok: save-runs self-test: parseSaved returns every part and keeps an answer quoting `### run 5`, `--- task`, a backslash line, CRLF, a lone \r and U+2028
ok: save-runs self-test: the answer is the parent's last text, not a subagent's
ok: save-runs self-test: a run whose trace ends with error_max_turns is marked cap=yes
ok: save-runs self-test: turns above 30 alone is not a cap
ok: save-runs self-test: a run at the 900 s timeout is marked cap=yes
ok: save-runs self-test: --check-saved reads the saved file without kept directories
ok: save-runs self-test: --require-loaded fails a run whose init lacks the skill
ok: save-runs self-test: --min-loaded 2 fails a cell with one loaded run
ok: save-runs self-test: --min-loaded 1 passes it, from the saved file
ok: save-runs self-test: a refused --check-saved never prints `saved ok`
ok: save-runs self-test: a run with neither a Skill call nor the skill heading is not loaded
ok: save-runs self-test: a successful Skill call without the heading counts as loaded
ok: save-runs self-test: a Skill call that returns an error does not count as loaded
ok: save-runs self-test: the skill heading in the session transcript counts as loaded (slash expansion)
ok: save-runs self-test: a home/cwd without .git is not taken as the workspace
ok: save-runs self-test: a run with a trace but no workspace fails and keeps its section
ok: save-runs self-test: --check-saved fails a cell whose saved file holds a run lost before saving
ok: save-runs self-test: a workspace whose git status fails is a lost run
ok: save-runs self-test: --require-clean fails a partial cell
ok: save-runs self-test: a cell with -lan1 is read from -lan1
ok: save-runs self-test: --check-saved refuses a saved file with fewer runs than result.json
ok: save-runs self-test: --check-saved refuses a saved file older than its result.json
ok: save-runs self-test: a kept directory sealed at mode 000 is opened before its trace is looked for
ok: save-runs self-test: git status runs with GIT_OPTIONAL_LOCKS=0
ok: save-runs self-test: a run without a trace fails
ok: save-runs self-test: --kept lists kept directory names
ok: save-runs self-test: --require-clean without a number, --min-loaded 0, an unknown flag or no cell exits 2
ok: compare self-test: Fisher: 0/10 against 10/10 → p=1.083e-5
ok: compare self-test: a hyphenated case name resolves its joint (khong-test-sonnet → khong-test)
ok: compare self-test: joint needs each of its 12 members (a watch-true run still passes) and leaves an errored run out
ok: compare self-test: a watch grader is printed as watch and never enters joint
ok: compare self-test: the capped, unloaded, errored and comparable counts are printed
ok: compare self-test: thieu-cong-cu: the Command, or BLOCKED and an inspection together, satisfy the command part; nothing else does
ok: compare self-test: outside thieu-cong-cu a BLOCKED verdict does not stand in for running the Command
ok: compare self-test: a cell missing a joint member grader is refused
ok: compare self-test: a cell holding a run lost before saving is refused
ok: compare self-test: a partial or missing cell is refused
ok: compare self-test: a saved file with fewer runs than result.json is refused
ok: compare self-test: a saved file older than its result.json is refused
ok: compare self-test: a cell's -lan1 is used
ok: compare self-test: a run is counted once, in the order errored, unloaded, capped
ok: compare self-test: the default cells are the four cases × sonnet, opus
ok: budget self-test: result.json at any depth plus _kept/**/*.lost.json count, other suites and loose files not → spent=4
ok: budget self-test: check 96 on $4 → total=100, exit 0
ok: budget self-test: check 96.5 on $4 → exit 1
ok: budget self-test: check -1 → usage, exit 2
ok: budget self-test: ceiling with a pilot missing → exit 1
ok: budget self-test: ceiling with a pilot of two runs → exit 1
ok: budget self-test: ceiling reads -lan1 and keeps the $4 floor: max(4, ⌈12 × 0.25⌉) → 4
ok: budget self-test: reserve = ceiling + highest pilot → 4.25
ok: budget self-test: fits without a pilot → exit 1
ok: budget self-test: fits --assume-missing 4: spent 6.55 + 4 + 4 × 4.25 + 4 × (8 + 0.6) = 61.95, exit 0
ok: budget self-test: ceiling with an errored pilot → exit 1
ok: budget self-test: ceiling prints one integer: ⌈12 × 0.6⌉ → 8
ok: budget self-test: fits: spent 7.06 + 4 × 4.25 + 4 × 8.6 = 58.46 → exit 0
ok: budget self-test: fits: spent 52.06 + 51.4 = 103.46 > 100 → exit 1
ok: budget self-test: ceiling with a partial pilot → exit 1
ok: budget self-test: ceiling for an unknown model → usage, exit 2
ok: budget self-test: fits --assume-missing without a cost → usage, exit 2
ok: budget self-test: spent 102.06 above the cap → exit 1
ok: budget self-test: fits --assume-missing 4 with four pilots missing adds 4 × 4 = 16
ok: budget self-test: ceiling is ⌈12 × 0.4166667⌉ = 6, not rounded down
ok: budget self-test: an unreadable result.json makes spent exit 1, not count $0
checker: ok
evals-test-digest: 49c599f2ebf1bf95ab5adf292b12562183041072bbed59165368a3fe3a8635b2
```

Fresh code-auditor re-review after repair round 1: PASS (45 of 48 mutants killed, the rest equivalent or not applicable). Re-run at the final-Head fixed point.
