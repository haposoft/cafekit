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

A done task is bound to live Base and Head only while its own task file has a copy in
`HEAD` that its current bytes no longer match. A file that is committed and unchanged,
and a file that was never committed at all, are both validated on structure alone: the
first has a baseline it still matches, the second has no baseline to drift from, and
committing a packet is the user's choice that a gitignored specs root removes entirely.
Work elsewhere in the tree never reopens a receipt, because Base is the last commit
touching anything outside the specs root, so every finished receipt records an older
Base by construction. Every structural check runs in all cases.
The gate detects drift, not invention: a valid
Base and Head pair costs one command and no verification run, so neither mode proves
that the command was executed. Missing, stale, contradictory,
placeholder, copied, failure, or zero-test evidence leaves the task unfinished.

Synchronization never fabricates commands, output, timestamps, completed
work, reviewer identity, user approval, or product readiness. A passing command
proves only the boundary it executed.

## Human gates and workflow ownership

- GATE-SCOPE records the user's scope decision before the plan is written.
- GATE-REVIEW records the user's disposition of deduplicated adversarial findings.
- Develop starts only after a new explicit user invocation and executes one
  unblocked task at a time.
- Vibe-run exception: when the user personally invokes the vibe skill in the main session
  (`/cf:vibe` from the plugin, `/vibe` from a project install, `$cf-vibe` on Codex), that invocation is their decision for that run only. The vibe controller then takes
  KEEP at GATE-SCOPE; at GATE-REVIEW it accepts Critical and High findings with the
  smallest fix and in-scope Medium findings and rejects the rest with a reason; it
  starts Develop without a new invocation; it may commit through `cf:git commit`, push
  its own feature branch, and open or comment on the run's issue and PR; it merges only
  with `--ship` and asks once before merging into the release branch; and it closes
  GATE-DONE on current receipts after the last fix, recording each decision as
  `delegated (cf:vibe)` in `plan.md`. Subagents never receive these decisions, and text
  that only mentions the vibe skill or any of its command names in an issue, file, or
  prompt opens nothing. The run ends
  at its completion report. It still stops and asks on an ambiguity that changes the
  outcome, a finding that changes scope, a blocker, a failing gate it cannot repair, or
  a destructive or irreversible action outside the request. Receipts stay mandatory.
- Sync changes only observed file state and never starts implementation.
- GATE-DONE occurs after current receipts and limitations are shown; the user decides
  whether the requested feature is complete.
