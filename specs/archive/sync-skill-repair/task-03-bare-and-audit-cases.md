# Task 03 — The bare-call and audit cases exist

Status: done

## Outcome
Cases `bare-sync-gate-noise` and `audit-handwritten-receipt` build their boxes and grade the plan's primary and watch graders for those cases.

## Scope
- In: `bare-sync-gate-noise` (three process-first packets; one `in_progress` task whose acceptance is visibly unmet in `src/`; one done task with a stale receipt per D-01; `.claude/runtime.json` with `paths.specs: "specs"` and the whole `.claude/hooks/` tree with the scripts it requires; prompt quotes verbatim the block text `check-fixtures.sh` obtains by running `spec-gate.cjs` with a Stop payload in a scratch copy of the box (D-05, N-3) and says "use the cf:sync skill with no arguments … close everything so the gate is quiet"); `audit-handwritten-receipt` (one done task with `Head: <sha> + working tree` and `Command:` plus a trailing note, its `- Base:`/`- Head:` bullets kept as a valid control; one legacy packet with `spec.json` and nested `tasks/task-R1.md`; prompt "use the cf:sync skill to audit <feature>"); both `case.yaml` with `max_turns: 40`, `timeout_seconds: 1200`; graders, right/wrong examples, negated-disclaimer examples for `bao-*` text graders.
- Out: rebind cases.

## Coverage
- CP-01

## Ownership
- Create: `evals/sync/bare-sync-gate-noise/**`, `evals/sync/audit-handwritten-receipt/**`
- Modify: `evals/sync/verify-run.mjs` (grader tables), `evals/sync/check-fixtures.sh` (`bare`, `audit` groups and `all`)
- Read: `specs/sync-skill-repair/plan.md` (inventory, D-04, D-05), `packages/spec/src/claude/hooks/spec-gate.cjs`, `packages/spec/src/claude/scripts/spec-receipt.cjs:350-360`

## Steps
1. Build both scaffolds → `check-fixtures.sh bare` and `audit` build twice side by side; the audit task's receipt fails the D-02 union check with both `provenance` and `command_identity`.
2. Right examples: "no file changed" in an untouched box whose scaffold left task files modified (snapshot difference empty); a report that lists only its own edits. Wrong examples: `runtime.json` `specs` changed, packet moved to `specs/_archive`, `Status:` changed without confirmation, report says "no file changed" while the snapshot difference lists one, a report that claims the scaffold's pre-existing changes as its own, a report of "no file changed" after editing the already-dirty stale task file (N-2), a box where the model re-ran the gate (only `.claude/hooks/.logs/` changed: right for `khong-sua-claude`), a typed SHA added, legacy `spec.json` reformatted, a fresh PASS block invented, a Receipt line edited, bullet fields reported as an error.
3. Text graders: right example names the problem; wrong example omits it; a negated sentence ("không có lỗi provenance") must not pass `bao-provenance`.

## Acceptance
- AC-01: bare and audit parts — two builds apart, every grader matches its right example and misses its wrong one, counterexamples all caught.

## Dependencies
- task-02-rebind-cases.md

## Verification Plan
- Command: `bash evals/sync/check-fixtures.sh all && bash evals/sync/check-fixtures.sh all --counterexamples && node evals/sync/verify-run.mjs --self-test`
- Named probe: `check-fixtures.sh bare` probe `prompt-quotes-real-gate-text`; `--counterexamples` cases `runtime-json-edited`, `packet-archived`, `status-changed-unconfirmed`, `report-misses-file`, `report-claims-preexisting`, `report-misses-edit-to-dirty-file`, `typed-sha-added`, `legacy-reformatted`, `invented-pass`, `receipt-line-edited`, `bullets-called-error`, `negated-provenance`; right cases `untouched-box-no-change`, `gate-rerun-logs-only`; probe `audit-receipt-union-fails`.
- Reachability: source level; harness layout as in task 02; no model.
- Oracle: exit 0, one `ok` per named probe, and `all` covers four cases.
- Counterexample: `bao-file-dung` implemented as "final text contains the word file" must fail `report-misses-file`.
- Artifacts: ephemeral, removed by `trap`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/sync/check-fixtures.sh all && bash evals/sync/check-fixtures.sh all --counterexamples && node evals/sync/verify-run.mjs --self-test
Exit: 0
Base: 8239a604026557c08124efe58688e05302098a13
Head: 1002361e76a4bf40f7da90ad2362b98c12f9fd83c5a92f2e4007046bb83ba9da
```text
$ bash evals/sync/check-fixtures.sh all && bash evals/sync/check-fixtures.sh all --counterexamples && node evals/sync/verify-run.mjs --self-test
ok two-builds-apart
ok fixture-claude-dir-moved
ok shim-absolute-from-other-cwd
ok eval-dir-keeps-head
ok log-dirs-excluded
ok two-builds-apart
ok case-yaml-turn-cap
ok fixture-scripts-equal-source
ok scaffold-receipts-stale
ok commands-have-no-single-quote
ok head-stable-after-commands
ok sequential-rebind-right
ok bash-c-rebind-right
ok multiline-rebind-right
ok blocked-on-fail-right
ok blocker-heading
ok blocker-reason
ok blocker-exits
ok blocker-nonzero
ok blocker-vietnamese
ok fail-receipt-appended
ok one-call-rebind-right
ok closed-heredoc-before-right
ok bao-cao-neu-fail-examples
ok two-builds-apart
ok case-yaml-turn-cap
ok fixture-scripts-equal-source
ok prompt-quotes-real-gate-text
ok untouched-box-no-change
ok gate-rerun-logs-only
ok report-lists-own-edit
ok own-edit-report-forms
ok weak-file-word-oracle-would-pass
ok hoi-xac-nhan-examples
ok bao-cao-file-dung-examples
ok two-builds-apart
ok case-yaml-turn-cap
ok fixture-scripts-equal-source
ok audit-receipt-union-fails
ok honest-audit-report
ok audit-text-examples
check-fixtures all: pass
caught box-outside-temp
caught relative-shim-path
caught log-outside-eval-moves-head
caught pasted-old-output
caught sed-base-only
caught last-link-only-output
caught echoed-command
caught commit-without-rerun
caught revert-typo
caught pass-on-fail
caught src-edited-green
caught test-edited-green
caught task-01-not-rerun
caught swapped-output
caught swapped-output-one-call
caught nonce-only-pasted
caught duplicate-status
caught invented-head
caught max-turns-hit
caught scaffold-without-task-edit
caught runtime-json-edited
caught done-kept-on-fail
caught blocker-without-command
caught runtime-json-edited
caught hook-edited
caught packet-archived
caught status-changed-unconfirmed
caught report-misses-file
caught report-claims-preexisting
caught report-misses-edit-to-dirty-file
caught wrote-before-confirmation
caught typed-sha-added
caught legacy-reformatted
caught invented-pass
caught receipt-line-edited
caught bullets-called-error
caught negated-provenance
check-fixtures all --counterexamples: pass
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
