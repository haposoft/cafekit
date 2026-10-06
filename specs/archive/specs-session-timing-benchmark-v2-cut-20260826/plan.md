# Explicit local Specs session timing
Specs-Contract: process-first-ready-v1

## Scope decision (C1 — 2026-08-20)

- Existing: Specs already names the C1, C2, and C3 human gates (`packages/spec/src/claude/skills/specs/SKILL.md:26`). The installer copies the complete canonical Specs skill tree to each runtime skill root (`packages/spec/bin/phases/copy-payload.js:90`), whose native destinations are `.claude/skills` and `.agents/skills` (`packages/spec/bin/lib/context.js:77`, `packages/spec/bin/lib/context.js:100`).
- Existing: the B1 harness records one aggregate `wall_ms` and accepts `prompt` or `prompt_sha256` (`packages/spec/scripts/benchmark-workflow.mjs:13`, `packages/spec/scripts/benchmark-workflow.mjs:186`, `packages/spec/scripts/benchmark-workflow.mjs:432`). It is therefore a separate compatibility surface, not the proposed prompt-/transcript-/secret-free gate recorder.
- Existing: Codex tests enumerate the exact installed Specs tree (`packages/spec/bin/__tests__/codex-native.test.js:65`, `packages/spec/bin/__tests__/codex-native.test.js:451`), while the packed-install matrix already covers both native Specs roots (`packages/spec/bin/__tests__/package-inventory.test.js:72`, `packages/spec/bin/__tests__/package-inventory.test.js:1308`).
- Minimum change: add one explicit skill-owned Node recorder, one focused behavioral test, one short invocation contract in the canonical Specs skill, and extend the two existing package/install projections. Five files; two sequential work groups.
- Expansion signals: none. The proposal stays below eight touched files, adds one CLI module and no service/class, and has two work groups.
- User decision: **KEEP** the opt-in recorder; **CUT** telemetry, automatic hooks, B1 schema changes, kernel/parser changes, and any implicit execution.

## Final scope decision (CUT — 2026-08-26)

- User decision: do not implement the timing recorder or run the timing benchmark.
- Both tasks remain `blocked`; Q-01–Q-07 and F-01–F-08 remain unresolved, and no execution Receipt exists.
- Archive this packet as historical planning evidence. This decision does not change or roll back the completed Develop behavior.

## Out of scope

- Persisting prompts, transcripts, or secret values. Any additional metadata choice remains unresolved in Q-02 and is not authorized before C2.
- Network transmission, analytics/telemetry clients, background daemons, automatic hook registration, or invocation from `SessionStart`, `Stop`, or `SubagentStop`.
- Changes to `packages/spec/scripts/benchmark-workflow.mjs`, `packages/spec/benchmarks/`, Specs schemas, legacy adapters, workflow resolver, receipt parser, hooks, or completion authority.
- Automatic Develop execution, automatic C3 approval, benchmark aggregation, dashboards, upload/export, or migration of earlier packets.

## Acceptance criteria

| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | Where an operator explicitly opts in through the approved recorder command, the recorder shall write only the local timing record approved by Q-02/Q-04; without that invocation, installation and a Specs session shall create no recorder-owned record. | `node --test packages/spec/bin/__tests__/specs-session-timing-recorder.test.js` |
| AC-02 | When the approved C1 and C2 transition events are recorded, the recorder shall expose separate non-negative authoring-work and human-wait durations around each gate using the approved interval endpoints. | `node --test packages/spec/bin/__tests__/specs-session-timing-recorder.test.js` |
| AC-03 | Where the operator elects to continue after C2, the recorder shall represent the approved execution and C3 timing events according to Q-06; where the operator stops at C2, it shall not fabricate those optional durations. | `node --test packages/spec/bin/__tests__/specs-session-timing-recorder.test.js` |
| AC-04 | When a session record is written, it shall contain no prompt, transcript, or secret value; handling of other metadata, unknown input, and diagnostics shall follow the explicit Q-01/Q-02 decision. | `node --test packages/spec/bin/__tests__/specs-session-timing-recorder.test.js` |
| AC-05 | If an event, state transition, output target, clock observation, or concurrent write violates the approved contract, the recorder shall follow the Q-01/Q-03/Q-04/Q-05 observable failure, containment, rollback, and recovery decision without claiming success. | `node --test packages/spec/bin/__tests__/specs-session-timing-recorder.test.js` |
| AC-06 | When CafeKit is installed for Claude or Codex, the operator shall be able to invoke the same recorder behavior from the documented native skill path and receive equivalent output semantics. | `node --test packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js` |
| AC-07 | When CafeKit is installed or a Specs session runs without an explicit recorder command, the system shall add no recorder reference to Claude/Codex hook registries, perform no recorder network operation, and leave the B1 and Specs kernel/parser surfaces unchanged. | `node --test packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js` |

## Open material decisions — implementation handoff blocked

| ID | Boundary | Missing exact decision |
|---|---|---|
| Q-01 | API/CLI | Canonical script name and installed command grammar; session identifier grammar; required/default inputs; stdout/stderr shape; success/error exit codes; duplicate/retry/idempotency; compatibility promise. |
| Q-02 | Schema/privacy | Artifact version; exact keys/nesting/types; required/optional fields; event enum and numeric bounds; unknown-field behavior; safe session identifier; exact persisted allowlist that at minimum excludes prompts, transcripts, and secret values; whether any other metadata is permitted. |
| Q-03 | State/concurrency | Initial and terminal states; every event/guard/effect/next/error transition; event ordering; duplicate/retry behavior; single-writer versus lock protocol; contention, release, stale reclaim, rollback, and recovery. |
| Q-04 | Filesystem/security | Authoritative output root and whether `--output` is mandatory; trusted/untrusted path-segment grammar; lexical and canonical containment; symlink policy; create flags and mode; temp/rename/fsync policy; crash cleanup. |
| Q-05 | Time | Cross-process clock model; unit, precision, and timezone; exact authoring/wait interval endpoints and inclusion; backward/forward clock jumps; process restart or reboot behavior; invalid-duration handling. |
| Q-06 | Optional execution/C3 and retention | Whether a C2-complete artifact is terminal, resumable, or copied for later execution; exact execution/C3 events; finalization; overwrite/append rules; retention, purge, and recovery after interruption. |
| Q-07 | Integration/proof | Whether “no hidden telemetry” requires static import/identifier allowlisting, a disposable network-denied runtime probe, or both; authoritative `source` and `installed` probes; whether a live Claude/Codex host run is required or remains `UNKNOWN`. |

Examples that remain deliberately unresolved:

- `start 10:00 → C1 opens 10:05 → C1 decision 10:08`: the packet does not yet decide whether this means 5 minutes authoring plus 3 minutes wait, nor which endpoints are inclusive.
- `C2 decision → process exits → machine clock moves backward → later execution event`: the packet does not yet choose reject, clamp, annotate, or a clock that survives separate invocations.
- `finish at C2 → resume two days later for execution/C3`: the packet does not yet choose append-in-place, a linked continuation, or a new session.

## Tasks

| # | Task | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|
| 01 | Record one explicit local timing session safely | AC-01–AC-05 | `packages/spec/src/claude/skills/specs/scripts/specs-session-timing-recorder.mjs`; `packages/spec/bin/__tests__/specs-session-timing-recorder.test.js` | none | blocked |
| 02 | Ship and prove native Claude/Codex invocation without hooks | AC-06–AC-07 | `packages/spec/src/claude/skills/specs/SKILL.md`; `packages/spec/bin/__tests__/codex-native.test.js`; `packages/spec/bin/__tests__/package-inventory.test.js` | task-01-record-local-session-timing.md | blocked |

Tasks are sequential because Task 02 proves the Task 01 artifact through installed projections. No parallel claim is made.

## Review log

- Round 1: two fresh-context reviewers (Fact/Contract and Security/Failure) returned `FAIL` / `BLOCKED`. Eight root causes remain after deduplication: six High and two Medium.
- C2 state: 0 accepted, 0 rejected, 0 revised, 8 pending. No repair has been applied.

| ID | Severity | Plan location | Failure scenario | Evidence | Proposed repair | Decision |
|---|---|---|---|---|---|---|
| F-01 | High | `plan.md:24,29,41`; Task 02 lines 27–28, 43–46 | Skill wording could cause the agent to run the recorder automatically even though no hook registers it; source/installed proof would not establish live opt-in behavior. | `packages/spec/src/claude/skills/specs/SKILL.md:23-24`, `packages/spec/src/claude/skills/specs/SKILL.md:95-100`; `packages/spec/src/claude/skills/specs/references/templates.md:77`, `packages/spec/src/claude/skills/specs/references/templates.md:86-90` | Define opt-in as a separate operator command/approval and prohibit skill self-invocation; either require a live probe or narrow the claim to CafeKit-owned registration while keeping live behavior `UNKNOWN`. | pending C2 |
| F-02 | High | Task 02 lines 7, 27–28, 42–47 | Upgrade may preserve user-modified guidance, a user hook, or a pre-existing malicious recorder at the native path, so fresh-install parity does not prove upgrade discoverability or safety. | `packages/spec/bin/lib/manifest.js:189-196`; `packages/spec/bin/lib/managed-writer.js:91-108`; `packages/spec/bin/__tests__/package-inventory.test.js:446-482` | Decide fresh/pristine versus upgrade compatibility and collision behavior; test pre-existing/user-modified files for both runtimes. Return to C1 if installer policy must change. | pending C2 |
| F-03 | High | `plan.md:29`; Task 02 lines 28, 45, 47 | Pre/post hashes taken inside one test can pass after B1 or kernel/parser files were already changed before the snapshot. | `packages/spec/bin/__tests__/package-inventory.test.js:363-374`; `packages/spec/src/claude/skills/specs/references/templates.md:94-114` | Name exact protected paths and add a runtime-derived Base→Head changed-path allowlist; do not use an intra-run hash as historical proof. | pending C2 |
| F-04 | High | Task 01 lines 48–50; Task 02 lines 45–47 | Prompt/transcript/secret can survive in stdout, stderr, temp, lock, or filenames while the main artifact remains clean. | `packages/spec/bin/__tests__/secret-scanner.test.js:41-45`; `packages/spec/bin/__tests__/codex-native.test.js:453-458` | Add canaries across stdout/stderr and every disposable output name/byte, assert no temp/lock residue, and bind provenance to the final changed-path proof. | pending C2 |
| F-05 | High | `plan.md:38`; Task 01 lines 27, 40 | Two writers can both observe no lock, or a stale writer can commit after reclaim and overwrite newer state. | `packages/spec/bin/lib/lock.js:45-78` | Decide atomic acquire and fencing semantics, including unique owner token, commit/release checks, stale reclaim, and a synchronized race probe. | pending C2 |
| F-06 | High | `plan.md:40`; Task 01 lines 39, 46–49 | Caller-supplied timestamps can fabricate duration; wall clock can move backward between separate invocations. | `packages/spec/scripts/benchmark-workflow.mjs:369-374`, `packages/spec/scripts/benchmark-workflow.mjs:432-446` | Decide who owns time, the cross-process/reboot clock, anomaly policy, and forged/backward/forward-time probes. | pending C2 |
| F-07 | Medium | `plan.md:9,54-55` | Adding a recorder without reconciling the canonical “complete shipped Specs bundle” self-test makes its completeness claim false-green. | `packages/spec/package.json:12`; `packages/spec/scripts/run-skill-self-tests.mjs:1950-1962` | Add `run-skill-self-tests.mjs` as a sixth owned file or revise that contract to instruction-only; return to C1 if the accepted repair expands scope. | pending C2 |
| F-08 | Medium | Task 02 lines 42–43 | The aggregate command names three future probes without assigning each to one test file, so both files can defer ownership while the suite passes. | `packages/spec/src/claude/skills/specs/references/templates.md:74-87` | Map every named probe to exactly `codex-native.test.js` or `package-inventory.test.js`. | pending C2 |

- Accepted-repair closure: none. No finding has entered `accepted → repaired → PASS|FAIL|UNKNOWN`; therefore none is closed.
- Consistency sweep after recording review: 3 files reread / deltas: review log, explicit dispatch block, evidence-line corrections, and removal of unapproved output/error semantics / stale references fixed: 7 / conflicts left: Q-01–Q-07 plus F-01–F-08 pending C2.

## Handoff state

**Execution readiness: ARCHIVED — CUT by user.** Both tasks remain `blocked` and are not dispatchable. No implementation or benchmark run is authorized. Q-01–Q-07 and F-01–F-08 remain recorded as unresolved historical findings; no Receipt exists. Current first unblocked task: none.
