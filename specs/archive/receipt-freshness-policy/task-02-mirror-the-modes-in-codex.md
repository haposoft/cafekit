# Task 02 — The Codex gate applies the same two modes

Status: done

## Outcome

For any packet state, the Codex gate and tollgate reach the same accept or block
decision as Claude, so a project using both runtimes cannot get contradictory
completion verdicts.

## Scope

- In: a regression lock proving Codex inherits the two modes through its installed
  wrapper, and the Codex tollgate message.
- Out: the shared checker and the mode selector, authored in task 01; and the Codex
  gate and wrapper source, which need no change.

### Scope narrowed after task 01 landed

Task 01 changed the shared checker that Codex loads, so Codex already behaves
correctly with no source change of its own. Measured on a temporary repository
against `checkWorkflowReceiptDetails`: a committed receipt on a clean tree returns
no failures, and the same receipt with an uncommitted change outside the specs root
returns `provenance`. The wrapper resolves to `claude/scripts/spec-receipt.cjs`
through `loadModule` (`codex/hooks/lib/spec-receipt.cjs:6-19`), and the gate already
supplies a context carrying `project_root` (`codex/hooks/spec-gate.cjs:120-126`).

The gate and wrapper are therefore no longer owned for modification. Listing them as
writable invited exactly what this packet forbids: a second copy of the mode logic
inside the Codex wrapper. The outcome, CP-04 and AC-04 are unchanged; only the work
needed to reach them shrank.

## Coverage

- CP-04

## Ownership

- Modify: `packages/spec/src/codex/hooks/spec-state.cjs`
- Modify: `packages/spec/bin/__tests__/codex-hooks.test.js`
- Read: `packages/spec/src/codex/hooks/spec-gate.cjs`
- Read: `packages/spec/src/codex/hooks/lib/spec-receipt.cjs`
- Read: `packages/spec/src/claude/scripts/spec-receipt.cjs`

## Acceptance

- AC-04: for each of the six states task 01 proves — committed on a clean tree,
  untracked, staged only, modified, unreadable `HEAD` path, and dirty tree outside
  the specs root — the Codex gate emits the decision that state requires, asserted
  as an absolute value: accept for the first state, block for the other five. Parity
  with Claude is checked in addition, never instead. Parity alone cannot detect a
  defect here, because both runtimes execute the same checker module, so a broken
  implementation stays in agreement with itself.
- Both Codex paths are covered: the per-task wrapper
  `checkWorkflowReceiptDetails` (`codex/hooks/lib/spec-receipt.cjs:72-79`), reached
  from `codex/hooks/spec-gate.cjs:179`, and the completed-set wrapper
  `checkWorkflowReceiptSet` (`:80-87`), reached from `codex/hooks/spec-gate.cjs:65`.
  Both wrappers stay pass-through; the mode logic is never duplicated into them. The
  material difference is that only the completed-set call receives a project root,
  so the per-task path must obtain one from `runtimeContext.project_root`, and the
  proof must exercise that asymmetry rather than assume it.
- The Codex fallback validator path is exercised, not only the shared-policy path.
- The Codex tollgate message at `spec-state.cjs:159` states the two modes and the
  clean-tree condition instead of claiming revalidation of every done task.

## Dependencies

- task-01-structure-only-for-committed-receipts.md

## Verification Plan

- Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js`
- Named probe: a new case `Codex emits the required decision for all six receipt
  states`, asserting the absolute expected decision for each state on both the
  per-task and completed-set paths, plus a companion assertion that Claude agrees.
- Reachability: the test installs the Codex runtime into a temporary project and
  runs the real hook as a subprocess, the pattern already at
  `codex-hooks.test.js:92-130`, with the fixture staging and committing files so the
  committed branch is reachable.
- Fixture precondition, without which the counterexample cannot fail: the
  `dirty tree outside specs` state must run the hook from a working directory inside
  the repository but below the project root, and place the uncommitted change outside
  that directory's subtree. `runHook` already takes the working directory as its
  second argument (`codex-hooks.test.js:21-31`) and a nested `packages/app` directory
  is already created by an existing fixture (`codex-hooks.test.js:406`). With the
  working directory set to the project root, a root-from-working-directory
  implementation returns the same decision as a correct one, and the case passes while
  the defect survives.
- Oracle: for every state the Codex gate emits the required absolute decision, and
  the two runtimes additionally agree byte for byte.
- Counterexample: the two Codex paths differ in what they can supply, and that is
  what the proof must exercise. The completed-set path passes `projectRoot`
  explicitly (`codex/hooks/spec-gate.cjs:65-69`), while the per-task path passes
  only `featureDir`, `taskPath` and `runtimeContext`
  (`codex/hooks/spec-gate.cjs:179`; wrapper at `codex/hooks/lib/spec-receipt.cjs:72-79`).
  An implementation that resolves the repository root from the process working
  directory rather than from `runtimeContext.project_root` must therefore produce the
  wrong absolute decision on the per-task path for the `dirty tree outside specs`
  state, and the case must fail on that assertion alone, without reference to Claude.
- Artifacts: none; the temporary install root is removed by the test.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/codex-hooks.test.js
Exit: 0
Base: 874bda9490ddd205dfb52772d33f8392458c675b
Head: ec2ea6805c49bb0ec70c4bc4ff74d727ba05a21180ecad45ebbe992a10791598
```text
$ node --test packages/spec/bin/__tests__/codex-hooks.test.js
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
