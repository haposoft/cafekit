# Sync protocols

Use surgical edits and verify bytes after writing. Never replace a whole packet
to change one task state.

## Resolve safely

1. Canonicalize `specs/<feature>/` under the configured specs root.
2. Require regular non-symlink `plan.md` and flat `task-*.md` files.
3. Match the requested task by exact basename; reject aliases and ambiguity.
4. Require exactly one `Status: pending|in_progress|paused|blocked|done` line.
5. Read dependencies and acceptance IDs before choosing a transition.

## Transitions

- `pending|paused|blocked -> in_progress`: change Status only; preserve a real
  blocker in history or remove it only when its prerequisite changed.
- `* -> blocked`: write a concrete reason and keep existing proof unchanged.
- `in_progress -> done`: validate the current inline Receipt first, then change
  Status. Never perform this order in reverse.
- `done -> in_progress`: allowed when proof becomes stale or implementation
  changes; retain the stale receipt only when clearly labelled non-authoritative.

For Flash, keep `Status: in_progress`, `FLASH_UNVERIFIED`, and blocker
`awaiting /cf:test <feature>`. Only sync-finalize with fresh canonical proof
may replace that marker and set done.

## Receipt update

The primary Receipt is the final `## Receipt` section in the task file. It must
contain one Verification PASS, one exact Command, one successful Exit, one
runtime-bound Base/Head pair, and non-empty fenced current output. Preserve
additional concrete negative, reachability, and artifact evidence.

Reject duplicate Receipt headings, placeholders, copied output, conflicting
success/failure markers, zero executed tests when tests are required, stale
provenance, and path or artifact mismatch.

## Audit reconciliation

- Plan row without task file: report missing; do not synthesize scope.
- Task file without plan row: report unknown; do not silently adopt it.
- Done without valid Receipt: after the user confirms, downgrade when the repair is deterministic,
  otherwise report and request direction.
- Receipt on unfinished task: preserve it only if it is clearly historical;
  otherwise report the conflict.
- Missing or cyclic dependency: report; block affected tasks only after the user confirms.
- Overlapping write ownership in one proposed wave: report and request an
  ownership decision.
- Acceptance ID not mapped both ways: report traceability drift.

After a repair, re-read every changed file and print a concise mismatch/fix/
unresolved summary. Never claim execution proof from the audit itself.
