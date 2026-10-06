# Task 01 — Record one explicit local timing session safely

Status: blocked

## Outcome

After the material decisions in `plan.md` are resolved, the approved explicit local command records the approved C1/C2 timing intervals and optional later execution/C3 intervals without persisting prompts, transcripts, or secret values.

## Scope

- In: the approved command/state/schema/time/filesystem contract; prompt-/transcript-/secret-free local persistence; approved failure behavior; focused source behavior tests.
- Out: installed-runtime documentation/projection, hooks, network, B1 integration, kernel/parser changes, automatic execution, aggregation, and UI.

## Ownership

- Create after Q-01 confirms this command surface: `packages/spec/src/claude/skills/specs/scripts/specs-session-timing-recorder.mjs`
- Create: `packages/spec/bin/__tests__/specs-session-timing-recorder.test.js`
- Read: `packages/spec/src/claude/skills/specs/SKILL.md`
- Read: `packages/spec/bin/phases/copy-payload.js`

## Acceptance

- AC-01: explicit opt-in is the only creation/update trigger; a no-invocation control leaves no artifact.
- AC-02: approved C1/C2 events yield distinct, non-negative authoring-work and human-wait durations using the Q-05 endpoints.
- AC-03: optional execution/C3 timing follows the Q-06 continuation contract and is never fabricated when the operator stops at C2.
- AC-04: no prompt, transcript, or secret value reaches the session record; Q-01/Q-02 decides all other metadata, unknown-input, and diagnostic behavior.
- AC-05: invalid order, duplicate/retry, unsafe/symlinked target, clock anomaly, write failure, and writer contention follow the approved fail/rollback/recovery contract.

## Blockers

- Q-01–Q-06 in `plan.md` are material and unresolved. Different choices change CLI output, durable bytes, timing totals, security, retry behavior, and compatibility. Do not implement this task before C2 resolves them.

## Dependencies

- none

## Example mapping

- Separate CLI invocations around C1/C2 require a cross-process clock decision; a process-local monotonic value alone cannot establish the later interval.
- Replaying the same event may be an idempotent no-op, a conflict, or a new sample; Q-03 must choose one.
- An output path through a symlink may resolve outside the trusted root even if its lexical path is inside; Q-04 must choose the rejection and cleanup behavior.

## Verification Plan

- Command: `node --test packages/spec/bin/__tests__/specs-session-timing-recorder.test.js`
- Named probes (to be created in the owned test file): `explicit recorder separates C1/C2 authoring and wait intervals without prompt transcript or secret fields`; `optional execution/C3 timing is absent until explicitly continued`; `invalid transitions, clock anomalies, unsafe targets, and competing writers follow the approved failure contract without partial artifacts`; `no invocation creates no timing artifact`.
- Reachability: `source` — direct Node invocation of the owned canonical script; `installed` — owned by Task 02; `live` — `UNKNOWN` until Q-07 decides whether a host run is required.
- Oracle: each accepted event sequence yields the Q-01/Q-02 stdout and exact record bytes; rejected sequences yield the approved failure observation and preserve the pre-run record bytes or absence according to Q-03/Q-04.
- Counterexample: a test must fail if a prompt, transcript, or secret canary is persisted, if wait and authoring time collapse into one total, if optional phases appear before an explicit continuation, or if a rejected event violates the approved rollback/cleanup behavior.
- Artifacts: tests create only disposable sessions below a verified `fs.mkdtempSync()` root under canonical `os.tmpdir()`, assert realpath containment before destructive controls, hash pre/post bytes with SHA-256 where rollback is expected, and remove the disposable root in `finally`.

## Receipt
