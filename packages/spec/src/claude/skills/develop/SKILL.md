---
name: cf:develop
description: "Implement an explicitly requested process-first feature or task, run its real verification, and close it with one evidence owner. Also supports existing legacy Specs packets."
user-invocable: true
when_to_use: "Use to implement a ready feature packet, one named task, or a clear low-risk change."
category: utilities
keywords: [implementation, specs, verification]
argument-hint: "[feature-name|specs-directory-path] [task-file] [--flash] [--parallel [N]] [--notes]"
metadata:
  author: haposoft
  version: "3.0.0"
---
# Develop — implement, prove, synchronize

Implement only the explicitly requested scope. For a process-first feature,
`plan.md` and flat tasks are the durable packet; one closeout owner coordinates
verification, review, sync, and docs impact without borrowing evidence.
Develop never starts merely because Specs finished. The user invokes it.

## Usage and pre-state guard

```text
/cf:develop <feature>
/cf:develop specs/<feature>
/cf:develop <feature> task-02-<slug>.md
/cf:develop <feature> --flash
/cf:develop <feature> --parallel [N]
/cf:develop <feature> --notes
```

`--notes` is opt-in. Only then load `references/implementation-notes-template.html`;
record decisions, scope exceptions, risks, gaps, and verification limits. Never create it by default.

Before any state mutation, reject `--flash` combined with `--parallel`:

```bash
node .claude/scripts/workflow-policy.cjs --flash --parallel --json
```

The pair exits `2` before a task edit, receipt, worktree, subagent, or commit. Do not reproduce it with a looser parser.

## Resolve the work packet

1. Resolve one `specs/<feature>/plan.md` plus flat `task-NN-*.md`; an explicit task path wins.
2. Read GATE-SCOPE scope, exclusions, acceptance mapping, ownership, and task order.
3. A task is unblocked only when every named dependency is `done` with a valid current inline Receipt.
4. Without a packet, work directly only when the change is clear, isolated, reversible, and low-risk.

Ambiguity, overlapping ownership, a dependency cycle, or a missing Verification Plan is a blocker. Do not guess.

### Accepted process-first fast path

When line two is `Specs-Contract: process-first-ready-v1`, reuse the accepted GATE-SCOPE/GATE-REVIEW.
Perform only a narrow freshness scout for target revision, scope drift, ownership
conflict, and dependency/state changes. Reopen GATE-SCOPE only for evidenced scope drift;
do not research, replan, or add a routine user gate before a real blocker or GATE-DONE.
This is a source instruction contract, not a parser/runtime or live-model guarantee;
live-model adherence is `[UNVERIFIED]` without a host invocation.

Load the plan index into working context once. Later byte rereads are narrow drift
checks; load only the active task's referenced coverage-profile rows, Outcome,
Scope, Ownership, Acceptance, Dependencies, Verification Plan, owned code, and consumers.

## Current-byte selection

Reread current plan/task bytes before each selection and controller write. Concurrent
Develop invocations are unsupported; detected state, task, or owned-path drift stops
before any Status or Receipt write.

| Current bytes | Feature mode | Explicit task mode |
|---|---|---|
| More than one `in_progress` | Fail-stop; name every active task. | Fail-stop; do not choose among them. |
| Exactly one `in_progress` | Resume exactly that task. | Recover it only when it is the exact target; otherwise stop. |
| Next row is `paused` | `paused` stops chaining; report and stop, never skip past it. | Report the target and stop. |
| Row is `blocked` or has a bad dependency | Never select it; `blocked` is not dependency-valid. | Report the blocker and stop. |
| Target is `done` | Continue queue selection only after validating its Receipt. | Report terminal state without mutation and stop. |
| No task is active | Select the first dependency-valid `pending` row in `plan.md` order. | Start only the exact pending target when dependencies are valid. |
| Status is missing, duplicate, or unknown | Stop as malformed state. | Stop as malformed state. |

Feature mode repeats this selection only after the current task closes. Specific-task
mode never touches a sibling and returns after its successful sync without chaining or GATE-DONE.

## Modes

### Sequential feature or specific task

The controller sets the selected task's single `Status:` to `in_progress`.
Implement its Outcome and Acceptance only. Keep one unblocked task at a time;
never start the next before proof, review, and sync finish for the current task.

### Parallel (`--parallel [N]`)

Load `references/parallel-waves.md`. Require disjoint writes, satisfied dependencies,
isolated worktrees, a bounded wave, and one controller writer; otherwise work sequentially.

### Flash (`--flash`)

Flash is an explicit speed trade-off, never completion:

- run only an available cheap syntax, typecheck, or compile preflight;
- skip dedicated tests, extended manual checks, and review retry loops;
- keep `Status: in_progress` and record `FLASH_UNVERIFIED` plus blocker
  `awaiting /cf:test <feature>`;
- do not unblock dependents or report Test PASS, Evidence PASS, production-ready, or done;
- stop this invocation without chaining.

Only a later explicit non-Flash invocation may recover the task. It treats Flash
output as ephemeral, inspects current bytes and the owned diff, and obtains fresh
canonical proof through the trusted sync-finalize path. Never weaken, delete, or
rewrite tests to make Flash look complete.

## Task cycle

### 1. Scout

Trace entrypoints, callers, dependents, registration, errors, and owned files.
Compilation does not prove an unmounted UI, unregistered route, uncalled service,
or missing consumer.

For an interrupted `in_progress` task, preserve and inspect current owned changes;
discard ephemeral, remembered, or prior-attempt proof; compare unmet Acceptance
against current task bytes and owned diff. Do not blindly replay a non-idempotent
mutation. Resume only unmet work, then run fresh verification.

### 2. Implement

Honor Scope, Ownership, Acceptance, and Dependencies. Do not silently replace named contracts;
scope expansion requires evidence and a return to GATE-SCOPE, not implementation convenience.
Load `references/subagent-patterns.md` when dispatch helps; only the controller writes Status or Receipt.

### 3. Verify, review, and close

The test owner executes each exact Verification Plan and records real output. The
review owner evaluates correctness, security, scope, and reachability without
manufacturing proof. Use `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`; only literal PASS can close.

Load `references/quality-gate.md`. Remediate an observed failure, then rerun only
affected proof/review. Do not blind-retry a blocked environment. After three failed
repair rounds, stop and ask the user.

After a real pass, the controller writes the task's final inline `## Receipt` with
`Verification: PASS`, exact `Command`, `Exit: 0`, runtime-derived `Base:` and `Head:`,
non-empty current output, and required negative/reachability/artifact proof; then it
sets `Status: done` and only implemented checkboxes. Missing, stale, contradictory,
zero-test, placeholder, marker-only, skipped, or remembered proof is unfinished.

### 4. Finish the requested boundary

Reread the task after sync and recompute the queue from current bytes. Specific-task
mode has already returned. Full-feature mode continues one task at a time, then runs
the named feature-level integration and reachability checks. Before GATE-DONE, apply the
quality-gate final-Head fixed point; show current evidence and limitations, and let
the user decide completion.

Evaluate docs impact from behavior actually changed: `none` means report only;
`minor` or `major` updates only affected existing docs through the docs flow.

## Definition of done

Done requires satisfied acceptance, reachable behavior, current executable proof,
stable Base/Head binding, resolved blocking review findings, and no scope substitution.
`PASS_WITH_WARNINGS`, `NO_TESTS`, `FLASH_UNVERIFIED`, or review-only pass cannot close.

## Attached references

- `references/quality-gate.md` — proof, review, final-Head, and shared-run ownership.
- `references/parallel-waves.md` — opt-in isolated worktree waves.
- `references/subagent-patterns.md` — task-local briefs and controller-only handoff.
- `references/implementation-notes-template.html` — only with `--notes`.

## Legacy workflow compatibility

If the selected feature contains `spec.json`, use its persisted `workflow_policy`,
`task_registry`, nested task paths, typed boundaries, separate task receipts, and
feature closeout receipt exactly as legacy adapters require. Preserve `planning_depth`,
`assurance_level`, derived lane, and read-only `execution_tier`; do not project these
fields into a new v3 packet. Keep JSON and Markdown status synchronized, and use the
existing completion-authority path for final closeout.
