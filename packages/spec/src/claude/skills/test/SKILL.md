---
name: cf:test
description: "Execute the smallest adequate verification scope and own the canonical execution proof."
user-invocable: true
when_to_use: "Use after implementation, for a feature scope, or for an explicit test request."
category: testing
keywords: [test, unit, integration, e2e, proof]
argument-hint: "[scope|--full|--ui <url>|--ui-auth <url>|--ui-flow <url>]"
metadata:
  author: haposoft
  version: "2.0.0"
---
# Test — execution proof owner

`cf:test` executes the smallest adequate real verification and owns the
canonical execution result. For process-first work it returns one typed proof
handoff to the controller; it never writes task state or the inline Receipt.
Review consumes validated proof and never invents or duplicates execution.

## Usage

```text
/cf:test
/cf:test --full
/cf:test <scope-or-path>
/cf:test <feature-name>
/cf:test specs/<feature>
/cf:test specs/<feature>/task-NN-<slug>.md
/cf:test --ui <url>
/cf:test --ui-auth <url>
/cf:test --ui-flow <url>
```

## Hard gates

- Never claim a pass without executing the exact relevant command.
- Never mock, weaken, delete, or skip a failing assertion to obtain green.
- Missing tooling, a missing command, nonzero exit, or zero executed tests is
  never `PASS`. Do not auto-install project-local tooling during proof.
- Preserve exact commands, counts, output, reachability, proof level, Base,
  Head, artifact hashes, and redaction labels.
- Source, installed, and live proof are distinct. Live adherence is
  `[UNVERIFIED]` without a host invocation.
- Use only `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`. Unknown, malformed,
  partial, contradictory, duplicate, skipped, or stale proof fails closed.

## Target routing

Classify current filesystem bytes before selecting tests. Use `lstat` so broken
links count as markers. Never migrate or repair packet state while testing.

| Observed state | Route |
|---|---|
| Valid regular `plan.md` with `Specs-Contract: process-first-ready-v1`, one or more valid regular flat `task-NN-*.md`, and no legacy marker | Process-first |
| Any flat marker that is orphaned, malformed, duplicated, symlinked, nonregular, or mixed with a legacy marker | `BLOCKED` |
| Valid regular legacy root resolving every nested task and separate receipt, with no flat marker | Legacy adapter |
| Orphan, malformed, symlinked, nonregular, identity-conflicting, or mixed legacy state | `BLOCKED` |
| No flat or legacy marker | Ordinary non-Spec testing |

A flat marker is a direct-child `plan.md` or `task-NN-*.md`. A legacy marker is
`spec.json`, a nested legacy task, or a separate legacy receipt. See
`references/execution-strategy.md` for the complete validation truth table.

## Spec-Aware Mode

<SCOPE-GATE>
For a feature target, test only current accepted scope, the active task's exact
Verification Plan, and reachable runtime surfaces. Missing or orphaned
reachability fails even when a command exits successfully.
</SCOPE-GATE>

For a process-first feature:

1. Read current `plan.md` and flat task bytes. Select only a contained regular
   task whose dependencies allow proof.
2. Use the task's exact `Command`, exact unique `Named probes`, `Reachability`,
   `Oracle`, `Counterexample`, required proof level, and artifact declaration.
3. Run the smallest adequate proof. `--full` expands scope but cannot weaken
   the Verification Plan or substitute unrelated green tests.
4. Return exactly one canonical `test-proof-v1` object. Do not edit `plan.md`,
   `Status:`, the task's `## Receipt`, or any sibling task.
5. The Develop controller validates the payload, recomputes its digest, checks
   current provenance, and alone writes process-first Status and inline Receipt.

## Execution

1. Detect commands from task and repository files; never invent them.
2. Run a cheap compile or typecheck precheck when the project provides one.
3. Execute the exact task command and all named probes with real counts.
4. For Ordinary non-Spec testing, before any `PASS` or `PASS_WITH_WARNINGS`,
   read the tests that cover the target or changed code (every test file when
   the suite is small). When an assertion or its pass condition depends on a
   nondeterministic source — the clock, randomness, the network, shared
   filesystem state or test order — the verdict is `FAIL`, naming the source,
   even when every run passes. When only setup depends on one, rerun just the
   suspect tests at least twice more; any differing outcome is `FAIL` as flaky.
   A single green run of such a test is not `PASS`. This step does not apply to
   process-first Named probes, which run exactly once.
5. Inspect negative paths, runtime reachability, and declared artifacts.
6. Capture tracked, untracked, and ignored project-command drift separately
   from runtime Head. Never silently clean or hide project changes.
7. Redact sensitive material, validate the complete proof object, then return a
   concise human report separately from the machine handoff.

Required proof follows the behavior:

| Surface | Adequate proof |
|---|---|
| pure logic/parser/validator | unit plus negative path |
| stateful UI or module wiring | component/integration plus mounted path |
| API, persistence, provider, or process boundary | real contract/state handoff |
| complete user workflow | E2E or UI flow |
| layout, focus, labels, keyboard | viewport/visual/accessibility check |
| regression | reproduction before fix plus passing regression |
| security/performance | only when requirement, risk, or boundary requires it |

## Process-first proof handoff

The machine payload is canonical UTF-8 JSON with exact top-level keys:

```text
schema_version, target, verdict, command, exit, counts, provenance,
proof_level, expected, observed, reachability, artifacts, branches,
raw_output, redactions, payload_sha256
```

`schema_version` is exactly `test-proof-v1`; unknown keys block. Branch IDs map
one-to-one to exact unique Named probes. The digest is lowercase SHA-256 of
stable JSON excluding only `payload_sha256`. Exact field shapes, nullable
pre-execution `BLOCKED` rules, and aggregation live in
`references/execution-strategy.md`.

Only all required branches passing with exact command, exit 0, executed > 0,
failed/skipped 0, matching Base/Head, `reachability.status: PASS`, valid artifact
hashes, and safe redaction can aggregate `PASS`. Aggregate in this order:
`FAIL` > `BLOCKED` > `PASS_WITH_WARNINGS` > `PASS`.

## Persistent-write and authentication boundary

- `.hapo/test-memory.json` is optional read-only context. Hash absent/present
  bytes before and after; never create, merge, or update it during proof.
- Put only Test-owned temporary files outside the project and clean them.
  Never create Test-owned reports, caches, lazy installs, or auth state.
- For authenticated UI proof, prefer the project's own auth helper. Otherwise
  use only an explicitly selected user-controlled profile bound to a confirmed
  HTTPS or localhost origin, identity, permissions, and action scope.
- Block cross-origin redirects and destructive production actions without fresh
  consent. Never ask for, export, paste, or persist cookies or tokens.
- Redact Authorization, Cookie, Set-Cookie, session tokens, credentials, and
  scoped PII from commands, headers/bodies, logs, screenshots, and reports.
  If safe proof is impossible, return `BLOCKED`.

## Verdict and report

```markdown
## Test Verdict

**Status:** PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED
**Scope:** [target and selected proof]
**Commands:** [exact redacted commands]
**Exit:** [actual result]

### Results
- Passed: N | Failed: N | Skipped: N | Executed: N
- Reachability: PASS | FAIL | BLOCKED
- Proof level: source | installed | live
- Project-command drift: [tracked/untracked/ignored, or none]

### Action
- [controller handoff, exact failure, or changed prerequisite]
```

Do not place the full JSON payload, secrets, verbose raw logs, or screenshots in
the concise report. `PASS_WITH_WARNINGS` remains unfinished; only literal
validated `PASS` may be synchronized by the controller.

When the target's task can be read — a process-first packet, or a packet
`BLOCKED` while it is classified that still holds exactly one regular flat task
with a readable `Command` and `Named probes` — end the final message with the
concise report, then a `### Machine handoff (test-proof-v1)` heading and exactly
one fenced `json` block holding the validated payload. The handoff block follows
the report and is not part of it. No further fenced block follows it. A
pre-execution `BLOCKED` takes the same placement; its shape is in
`references/execution-strategy.md` §4. For any other target, end with the
report and the line `No payload: target not identifiable.`

## Legacy workflow compatibility

A valid legacy packet keeps the v2.1 adapter, legacy task resolution, and its
separate receipt path. Do not write process-first inline proof into it. If
legacy proof identities conflict or the packet is mixed/malformed, return
`BLOCKED`; never choose one source or migrate it during unrelated testing.

Flash legacy behavior remains proof-only: testing may make a current
`FLASH_UNVERIFIED` task eligible for trusted sync-finalize, but never promotes
state or unblocks dependents itself. Only explicit trusted sync-finalize may
promote it.

## References

- `references/execution-strategy.md` — routing, payload schema, aggregation,
  blast radius, UI safety, and report separation.
- `references/failure-triage.md` — failure classification and four verdicts.
- `references/test-memory.md` — optional read-only historical context.
