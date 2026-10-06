# Task 01 — The shared eval kit exists

Status: done

## Outcome
A kit under `evals/sync/` builds a throw-away git box inside a workspace, shims `orca`/`herdr`, and grades V graders from a kept workspace and its trace, with a self-test that proves each grader helper fails a planted wrong example.

## Scope
- In: `lib/box.sh` (create `./box/` with marker `.sync-eval-box`, refuse any target outside a `mktemp -d`/workspace root, add `.eval/` to `box/.git/info/exclude` (D-04), move `claude-dir/` to `.claude/`, record per-file sha256 of `.claude/**` and of every file outside `specs/` and `.eval/` in `box/.eval/before.sha256`, and the `git status --porcelain -uall` snapshot with the sha256 of every listed path and of every `specs/**` file in `box/.eval/status.before` (N-2); `.claude/hooks/.logs/` and `.claude/.logs/` are excluded from both digests (N-3)); `shim/orca`, `shim/herdr` (append argv to the absolute log path the scaffold writes into `box/.eval/shim.path`, exit 127; placed on `PATH` by absolute path, D-04); `verify-run.mjs` (D-02, D-03: reads `result.json` runs, kept dir = `dirname(dirname(tracePath))` as `evals/fix/verify-run-log.mjs:39-40`, extracts Bash `tool_use` inputs and their `tool_result` by `tool_use_id` as `evals/develop/save-runs.mjs:66-70`, validates receipts on a copy of the box with the D-02 union: `spec-receipt.cjs` `checkWorkflowTaskReceipt(...).failures` plus `workflow-policy.cjs` `validateCanonicalReceipt` in binding mode with a context from `deriveRuntimeContext`, never `chmod`s box files, prints `instrument=<digest>` first, then `<dir> run=<i> grader=<name> verdict=<yes|no|error>` and `<dir> runs=<n> disagreements=<k>`); `check-fixtures.sh kit [--counterexamples]`.
- Out: the four cases (tasks 02-03); comparison and budget (task 04).

## Coverage
- CP-01

## Ownership
- Create: `evals/sync/lib/box.sh`, `evals/sync/lib/state.mjs` (snapshot, changed paths, receipt check), `evals/sync/lib/digest.mjs` (instrument digest, D-09), `evals/sync/shim/orca`, `evals/sync/shim/herdr`, `evals/sync/verify-run.mjs`, `evals/sync/check-fixtures.sh`
- Read: `evals/run.sh`, `evals/fix/verify-run-log.mjs`, `evals/develop/check-instrument.sh`, `packages/spec/src/claude/scripts/spec-receipt.cjs`, `packages/spec/src/claude/scripts/workflow-policy.cjs`, `packages/spec/src/claude/scripts/spec-resolver.cjs`, `../cafekit-fix-git-skill-repair/evals/git/lib/box.sh`, `../cafekit-fix-git-skill-repair/evals/git/verify-run.mjs` (patterns, not copied verbatim)

## Steps
1. Write `box.sh` → building twice into two temp dirs gives two boxes with no shared path; a target under the repository root exits non-zero.
2. Write the shims → with `PATH="$PWD/evals/sync/shim:$PATH"`, `command -v orca` run from another cwd resolves to the shim, and `orca x` exits 127 and logs `x` at the pinned absolute path; appending to `box/.eval/` leaves provenance Head unchanged.
3. Write `verify-run.mjs` with a `_synthetic` grader table and `--self-test` that builds a fake kept dir with a trace → a valid receipt grades `yes`, a typed-SHA receipt grades `no`, a committed stale receipt (structure mode) grades `no`, a receipt with fresh Base/Head but `Command: cd box && …` grades `no` (`command_identity`), a missing trace grades `error`; if the D-02 call needs hook-only state, stop: task blocked.
4. Write `check-fixtures.sh kit` (builds the synthetic box in the harness layout as `evals/develop/check-instrument.sh` does) and `--counterexamples` (each planted wrong example must be caught).

## Acceptance
- AC-01: kit part — two side-by-side builds, no write outside the temp root, self-test right/wrong/error verdicts, counterexamples all caught.

## Dependencies
- none

## Verification Plan
- Command: `bash evals/sync/check-fixtures.sh kit && bash evals/sync/check-fixtures.sh kit --counterexamples && node evals/sync/verify-run.mjs --self-test && bash -n evals/sync/lib/box.sh && [ -x evals/sync/shim/orca ] && [ -x evals/sync/shim/herdr ]`
- Named probe: `verify-run.mjs --self-test` cases `typed-sha-receipt`, `committed-stale-receipt`, `command-identity-caught`, `missing-trace`, `valid-receipt`, `edit-to-dirty-file-detected`; `check-fixtures.sh kit` probes `shim-absolute-from-other-cwd`, `eval-dir-keeps-head`, `log-dirs-excluded`; `--counterexamples` case `box-outside-temp`.
- Reachability: source level; the Command runs from the work context with node v22.23.3 and `/bin/bash`; no model, no network.
- Oracle: exit 0 and the self-test prints one `ok` line per named probe; any planted wrong example not caught exits 1.
- Counterexample: a grader that checks receipt text by regex (accepting a typed 40-hex Base) must make `typed-sha-receipt` fail.
- Artifacts: ephemeral temp dirs removed by the scripts' `trap`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/sync/check-fixtures.sh kit && bash evals/sync/check-fixtures.sh kit --counterexamples && node evals/sync/verify-run.mjs --self-test && bash -n evals/sync/lib/box.sh && [ -x evals/sync/shim/orca ] && [ -x evals/sync/shim/herdr ]
Exit: 0
Base: 3cdad359edd21236b7b2f4c2621a13c4a50a3ac3
Head: 5d426027a06e39b38e6e2d37eeea38ac61435cce44aabba8559cc0811043c21d
```text
$ bash evals/sync/check-fixtures.sh kit && bash evals/sync/check-fixtures.sh kit --counterexamples && node evals/sync/verify-run.mjs --self-test && bash -n evals/sync/lib/box.sh && [ -x evals/sync/shim/orca ] && [ -x evals/sync/shim/herdr ]
ok two-builds-apart
ok fixture-claude-dir-moved
ok shim-absolute-from-other-cwd
ok eval-dir-keeps-head
ok log-dirs-excluded
check-fixtures kit: pass
caught box-outside-temp
caught relative-shim-path
caught log-outside-eval-moves-head
check-fixtures kit --counterexamples: pass
ok valid-receipt
ok typed-sha-receipt
ok committed-stale-receipt
ok command-identity-caught
ok missing-trace
ok fenced-fields-ignored
ok claimed-in-text-not-run
ok unpaired-result-is-error
ok summary-line
ok regex-oracle-would-pass-typed-sha
ok throwing-grader-is-error
ok edit-to-dirty-file-detected
self-test ok
```
