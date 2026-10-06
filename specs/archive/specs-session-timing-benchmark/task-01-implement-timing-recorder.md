# Task 01 — Implement the Specs timing recorder

<!-- Archived unexecuted; successor: ../../specs-session-timing-benchmark/plan.md. -->

Status: pending

## Outcome
An operator can create and advance one local Specs timing artifact, then obtain an honest phase-duration report without storing conversation content.

## Scope
- In: exact `start --run <safe-id> --feature <slug>`, `mark --run <safe-id> --event <event>`, and `report --run <safe-id>` operations; locked atomic writes; canonical runtime-local storage; injectable wall and monotonic clocks for tests.
- Out: hooks, network export, transcript parsing, model invocation, and B1 schema migration.

## Ownership
- Create: `packages/spec/src/claude/scripts/specs-timing.cjs`
- Create: `packages/spec/bin/__tests__/specs-timing.test.js`
- Read: `packages/spec/scripts/benchmark-workflow.mjs`
- Read: `packages/spec/src/codex/hooks/lib/state-store.cjs`

## Acceptance
- AC-01: `start` resolves `<runtime>/session-state/specs-timing/<safe-id>.json`, prints the run ID/path, uses exclusive creation, and stores a feature SHA-256 rather than free-form feature text.
- AC-02: the only event order is `run_started → c1_opened → c1_decided → c2_opened → c2_decided`, followed optionally by `execution_started → c3_opened → c3_decided`; one live-PID lock serializes writers and stale reclaim requires a dead owner.
- AC-03: metrics are `scope_work_ms` (`run_started→c1_opened`), `c1_wait_ms`, `plan_review_work_ms`, `c2_wait_ms`, `authoring_total_ms`, optional `execution_to_c3_ms`, `c3_wait_ms`, and `full_cycle_ms`; missing endpoints return `unavailable(missing_event:<name>)`.
- AC-03: duration uses a monotonic system-uptime value paired with UTC wall time; decreasing monotonic time/reboot or invalid timestamps fail without emitting negative durations, while forward wall-clock adjustment does not change duration.
- AC-04: canonical containment rejects symlinks in existing runtime/state/run components; start is no-follow/exclusive; mark uses same-directory temp plus rename under lock; contention and kill-before/after-rename tests prove no lost event or corrupt success.
- AC-05: schema keys are closed to `schema_version`, safe `run_id`, `runtime`, `cafekit_version`, credential-free Git commit, `feature_sha256`, `clock`, and `{name,at,monotonic_ms}` events; remote URLs, paths, prompt/transcript, environment, and tool payloads are forbidden.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/specs-timing.test.js`
- Expected: all positive, negative, two-process contention, crash recovery, clock anomaly, symlink escape, privacy, and atomicity cases pass with at least one test executed.
- Reachability: the source script is the payload copied by `copy-payload.js` into each runtime's native scripts directory.
- Artifacts: temporary timing files only; tests must clean them up.

## Receipt
<!-- Filled only by the execution owner after fresh verification. -->
