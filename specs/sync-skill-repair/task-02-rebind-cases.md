# Task 02 — The two rebind cases exist

Status: done

## Outcome
Cases `rebind-base-moved` and `rebind-verify-fails` build a box whose two done receipts really fail the live check (D-01) and grade the plan's primary and watch graders for those cases.

## Scope
- In: `evals/sync/fixtures/rebind/` (a process-first packet `specs/doi-ten/` with `plan.md`, two done tasks, valid receipts written by the scaffold from a real run of each Command; `src/`, `test/`; `claude-dir/scripts/` copies of `provenance.cjs`, `spec-receipt.cjs`, `spec-resolver.cjs`, `workflow-policy.cjs` kept equal to source by `check-fixtures.sh`; each Command has two `&&` links printing `RUN-A-<nonce>` and `RUN-B-<nonce>` for one nonce per run from the fixture's `scripts/nonce.mjs` (`crypto.randomUUID()`), appended to `.eval/ran.log`; no Command contains a single quote — D-02, N-4); the two cases' `case.yaml` (prompt names `cf:sync`, no leading slash; `runs: 20`; `max_turns: 40`; `timeout_seconds: 1200`; `allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]`) and `scaffold.sh`; their graders in `verify-run.mjs` and harness graders.
- Out: cases 3 and 4.

## Coverage
- CP-01

## Ownership
- Create: `evals/sync/fixtures/rebind/**`, `evals/sync/rebind-base-moved/**`, `evals/sync/rebind-verify-fails/**`
- Modify: `evals/sync/verify-run.mjs` (grader tables for these two cases), `evals/sync/check-fixtures.sh` (`rebind` group)
- Read: `specs/sync-skill-repair/plan.md` (case and grader inventory, D-01, D-02), `packages/spec/src/claude/scripts/spec-receipt.cjs:210-234`

## Steps
1. Build the fixture and scaffold: commit packet + code, commit once outside `specs/`, then the uncommitted Outcome typo fix in both task files → the D-02 check reports `provenance` for both receipts (asserted by `check-fixtures.sh rebind`).
2. In `rebind-verify-fails`, task-02's Command exits 1 printing `FAIL-<nonce>`; `src/` and `test/` sha256 recorded.
3. Add right and wrong example workspaces for every grader of both cases (right: sequential rebind of both tasks run through `cd box && …` and through `bash -c '…'`; right for case 2: task-02 `blocked` with a blocker line naming its Command and exit and the D-10 marker; wrong for case 2: `blocked` with a blocker that names neither; wrong: old output pasted, `sed` on `Base:` only, PASS on the failing task, a test edited to green, `.claude/runtime.json` edited, output of only the last link, Command echoed instead of run, task files committed without a rerun, the typo reverted, `done` kept unchanged on the failing task).

## Acceptance
- AC-01: rebind part — scaffolded receipts fail the live check; every grader matches its right example and misses its wrong one; counterexamples all caught.

## Dependencies
- task-01-eval-kit.md

## Verification Plan
- Command: `bash evals/sync/check-fixtures.sh rebind && bash evals/sync/check-fixtures.sh rebind --counterexamples && node evals/sync/verify-run.mjs --self-test`
- Named probe: `check-fixtures.sh rebind` checks `scaffold-receipts-stale`, `two-builds-apart`, `fixture-scripts-equal-source`, `case-yaml-turn-cap`, `head-stable-after-commands` (rebind task-01, run task-02's Command, task-01 still valid), `sequential-rebind-right`, `bash-c-rebind-right`, `commands-have-no-single-quote`; `--counterexamples` cases `pasted-old-output`, `sed-base-only`, `pass-on-fail`, `test-edited-green`, `last-link-only-output`, `echoed-command`, `commit-without-rerun`, `revert-typo`, `done-kept-on-fail`, `blocker-without-command`.
- Reachability: source level; scaffolds run in the harness layout (`evals/` rsynced into a temp dir, as `evals/run.sh:64-65`); no model.
- Oracle: exit 0 with one `ok` line per named probe.
- Counterexample: a scaffold that only commits outside `specs/` (no uncommitted task edit) must fail `scaffold-receipts-stale`.
- Artifacts: ephemeral, removed by `trap`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/sync/check-fixtures.sh rebind && bash evals/sync/check-fixtures.sh rebind --counterexamples && node evals/sync/verify-run.mjs --self-test
Exit: 0
Base: 3cdad359edd21236b7b2f4c2621a13c4a50a3ac3
Head: 5d426027a06e39b38e6e2d37eeea38ac61435cce44aabba8559cc0811043c21d
```text
$ bash evals/sync/check-fixtures.sh rebind && bash evals/sync/check-fixtures.sh rebind --counterexamples && node evals/sync/verify-run.mjs --self-test
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
check-fixtures rebind: pass
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
check-fixtures rebind --counterexamples: pass
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
