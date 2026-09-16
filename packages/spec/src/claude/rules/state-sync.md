# Process-first state synchronization

## Primary file state

For new work, `specs/<feature>/plan.md` and its direct-child
`task-NN-*.md` files are canonical, hand-editable state. Task files stay flat
beside the plan; indexes and host task views are disposable projections.

Each task has exactly one `Status:` field using `pending`, `in_progress`,
`paused`, `blocked`, or `done`. The controller is the sole writer of task
status and proof. A task's final `## Receipt` is its only canonical execution
proof.

## Surgical synchronization

Before changing state:

1. read the plan row and the task's Outcome, Acceptance, Dependencies,
   Verification Plan, Status, and Receipt;
2. confirm every dependency and owned path at the requested boundary;
3. edit only the observed Status, concrete blocker, implemented checkbox, or
   Receipt; and
4. re-read the file and confirm exactly one Status field and one Receipt
   section.

Starting or resuming changes only Status to `in_progress`. Blocking records a
specific cause without creating proof. Do not replace a whole packet to make a
state transition.

Set `Status: done` only after the inline Receipt passes the
`validateCanonicalReceipt` contract: exact command, `Exit: 0`,
`Verification: PASS`, runtime-derived Base and Head values, and a non-empty
fenced block of current command output.

A done task keeps that binding while its file differs from its committed bytes,
and is validated on structure alone once that file is committed and unchanged. Work
elsewhere in the tree does not reopen it: Base is the last commit touching anything
outside the specs root, so every finished receipt records an older Base by
construction and reopening on a dirty tree failed all of them at once.
The gate detects drift, not invention: a valid
Base and Head pair costs one command and no verification run, so neither mode proves
that the command was executed. Missing, stale, contradictory,
placeholder, copied, failure, or zero-test evidence leaves the task unfinished.

Synchronization never fabricates commands, output, timestamps, completed
work, reviewer identity, user approval, or product readiness. A passing command
proves only the boundary it executed.

## Human gates and workflow ownership

- C1 records the user's scope decision before the plan is written.
- C2 records the user's disposition of deduplicated adversarial findings.
- Develop starts only after a new explicit user invocation and executes one
  unblocked task at a time.
- Sync changes only observed file state and never starts implementation.
- C3 occurs after current receipts and limitations are shown; the user decides
  whether the requested feature is complete.

## Legacy compatibility

Existing packets containing `spec.json`, nested `tasks/task-R*.md`, or other
legacy kernel artifacts stay on their installed adapters. Preserve their
`task_registry`, `semantic_model`, `planning_depth`, lane,
`execution_tier`, typed topology, separate receipts, and feature closeout
contract. Do not migrate that machine authority or storage shape while syncing
an unrelated process-first packet.
