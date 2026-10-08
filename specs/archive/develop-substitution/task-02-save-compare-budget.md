# Task 02 — Develop cells are saved, compared and budgeted

Status: done

## Outcome
Three tools under `evals/develop/` (plan D-03): `save-runs.mjs` saves each run's final task file, `src/greet.js` and last assistant message with its skill-loading and cap facts, and checks saved files; `compare.mjs` compares two cell prefixes per grader and on the `joint` primary with a Fisher p; `budget.mjs` enforces the $40 cap over `v3-*` cells. All take a cell's `-lan1` when present.

## Scope
- In: the three tools with self-tests; `check-instrument.sh` running their self-tests.
- Out: graders; result files; `evals/run.sh`.

## Coverage
- CP-02

## Ownership
- Create: `evals/develop/save-runs.mjs`, `evals/develop/compare.mjs`, `evals/develop/budget.mjs`
- Modify: `evals/develop/check-instrument.sh`
- Read: `evals/brainstorm/save-answers.mjs` (trace reading, `chmod -R u+rwX` on sealed kept directories), `evals/brainstorm/read-traces.mjs:68-76` (recursive `home/cwd` search), `:142-160` (init skills), `evals/compare-research.mjs:31-45` (Fisher), `evals/brainstorm/budget.mjs`, `evals/develop/mot-task-*/case.yaml` (`max_turns: 30`, `timeout_seconds: 1200`)

## Steps
1. `save-runs.mjs <cell dir>...`: resolve each cell to `<cell>-lan1` when that directory exists; for each run with a `tracePath`, the kept directory is `dirname(dirname(tracePath))` and the workspace the first `home/cwd` below it (recursive; the real layout is `sealed/home/cwd`); write `evals/results/develop/_saved/<cell>.txt` with a header holding the `result.json` sha256 and, per `### run <n>`: `skill=<loaded|none>` by plan D-04, `init-skill=<yes|no>`, `skill-tool=<yes|no>` (`Skill` in the init tools), `cap=<yes|no>` (turns at `max_turns` or duration at the timeout), the final `specs/doi-loi-chao/task-01-doi-loi-chao.md`, `src/greet.js` and the last assistant text; print one line per cell with runs, errors, `skill=` and `cap=` counts and the saved file's sha256; exit 1 when a run has no trace or workspace. Flags: `--kept <cell>` prints kept directory names; `--check-saved <cell>...` checks each saved file exists and its header sha matches the current `result.json` (no kept directory needed); `--require-loaded` exits 1 on any `skill=none`; `--require-clean <n>` exits 1 unless the cell has `n` runs without an error and is not partial; both work with `--check-saved`, reading the facts from the saved file and `result.json` only.
2. `compare.mjs --base <prefix> [--after <prefix>] [--base-only] [--cells …]` (default cells `hong-sonnet hong-opus sach-sonnet sach-opus`): over runs without an error, without `cap=yes` and with the skill loaded, print `cell=<c> grader=<g> dir=<higher|lower> base=<x>/<n> after=<y>/<m> p=<p>` for every grader in `result.json`, then `cell=<c> joint base=… after=… p=…` (hong: the five D-02 graders together; sach: `dong-task` and `receipt-day-du` with `dung-blocked` false), then `cell=<c> capped base=<k> after=<k'>` and `cell=<c> unloaded base=<k> after=<k'>` (runs whose saved section says `skill=none` are left out of every count, plan amendment); `--base-only` compares the base with itself (p=1.000); exit 1 when a cell is missing or partial.
3. `budget.mjs spent | check <next>`: sum top-level `costUsd` of every `evals/results/develop/v3-*/result.json` (any depth) against $40.
4. Self-tests on synthetic directories (a `sealed/home/cwd` workspace; a `-lan1` cell; a `skill=none` run; a capped run; a stale saved file) for each tool; run the Command; Receipt after a fresh review PASS.

## Acceptance
- AC-02: each tool's `--self-test` passes, covering the cases in Step 4; the checker runs them; the Command prints `evals-develop-digest:`.

## Dependencies
- task-01-hong-grades-command-and-stop.md

## Verification Plan
- Command: `bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in save-runs compare budget; do node evals/develop/$t.mjs --self-test || exit 1; done && bash evals/develop/check-instrument.sh > /dev/null && echo "checker: ok" && n=$( (cd evals/develop && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-develop-digest: $n"'`
- Named probe: the three self-tests; the checker
- Reachability: known — task 03's Command calls the three tools
- Oracle: the Command exits 0 with every self-test line `ok:`
- Counterexample: a missing workspace, a `skill=none` run under `--require-loaded`, a stale saved file, a partial cell or spending past $40 make the matching tool exit 1 in its self-test
- Artifacts: none

## Failure Protocol
On a failed run: stop; do not widen scope, change the Command or weaken a test; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: bash -c 'set -o pipefail && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && unset FORCE_COLOR && for t in save-runs compare budget; do node evals/develop/$t.mjs --self-test || exit 1; done && bash evals/develop/check-instrument.sh > /dev/null && echo "checker: ok" && n=$( (cd evals/develop && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d" " -f1) && echo "evals-develop-digest: $n"'
Exit: 0
Base: 5153442844b0b2a838de9574fbd790a383ede36c
Head: 8c07fb49702964b4fcf91e1490c20c34cdb4fa1fadc62686107e39b0df33c9c3
```text
ok: save-runs self-test: a sealed/home/cwd workspace is found and saved
ok: save-runs self-test: the answer is the parent's last text, not a subagent's
ok: save-runs self-test: a run whose trace ends with error_max_turns is marked cap=yes
ok: save-runs self-test: turns above 30 alone is not a cap
ok: save-runs self-test: a run at the timeout is marked cap=yes
ok: save-runs self-test: --check-saved reads the saved file without kept directories
ok: save-runs self-test: --require-loaded fails a run whose init lacks the skill
ok: save-runs self-test: a run with neither a Skill call nor the skill heading is not loaded
ok: save-runs self-test: a successful Skill call without the heading counts as loaded
ok: save-runs self-test: a Skill call that returns an error does not count as loaded
ok: save-runs self-test: the skill heading in the session transcript counts as loaded
ok: save-runs self-test: a home/cwd without .git is not taken as the workspace
ok: save-runs self-test: a run with a trace but no workspace fails and keeps its section
ok: save-runs self-test: --require-clean fails a partial cell
ok: save-runs self-test: a cell with -lan1 is read from -lan1
ok: save-runs self-test: --check-saved refuses a saved file with fewer runs than result.json
ok: save-runs self-test: --check-saved refuses a saved file older than its result.json
ok: save-runs self-test: a run without a trace fails
ok: save-runs self-test: --kept lists kept directory names
ok: save-runs self-test: --require-clean without a number, an unknown flag or no cell exits 2
ok: compare self-test: Fisher: 0/10 against 10/10 → p=1.083e-5
ok: compare self-test: the joint line needs all five stop graders and leaves an errored run out
ok: compare self-test: a capped run is left out and reported
ok: compare self-test: a run without the skill loaded is left out and reported
ok: compare self-test: dong-task on hong is lower-is-better
ok: compare self-test: dem-* graders are not printed
ok: compare self-test: --base-only prints p=1.000
ok: compare self-test: a partial or missing cell is refused
ok: compare self-test: a saved file with fewer runs than result.json is refused
ok: compare self-test: a saved file older than its result.json is refused
ok: compare self-test: a cell's -lan1 is used, and the sach joint excludes blocked runs
ok: budget self-test: only v3-* develop cells count, at any depth, -lan1 included → spent=4
ok: budget self-test: check 36 on $4 → total=40, exit 0
ok: budget self-test: check 36.5 on $4 → exit 1
ok: budget self-test: check -1 → usage, exit 2
ok: budget self-test: spent above the cap → exit 1
checker: ok
evals-develop-digest: 7f25fd4165faa6034212c77f1a491f6f8f51abaae367544e184de4582747eb57
```

The fenced block is the Command's whole output (2026-10-02, run by the controller via `bash` on this file's Command text; it returned 0). Before the change the same Command returned 1 (the tools did not exist). A fresh `code-auditor` review returned FAIL (self-tests missed required behaviours: no workspace, Skill-call loading, time cap, errored runs, the joint conjunction, budget depth), then PASS_WITH_WARNINGS, then PASS after both repair rounds; 25 of 27 reviewer mutations are caught, the two left are covered upstream by `save` exiting 1 and `--require-clean`. Re-run after the GATE-SCOPE amendment (plan Review log): `compare.mjs` leaves out runs without the skill loaded and prints their count; the same reviewer returned PASS with every unloaded-filter mutation caught. Re-run at the final Head before GATE-DONE (later tasks changed files outside the specs root).
