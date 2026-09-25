---
name: cf:debug
description: "Use before fixing any bug, failing test, CI/CD failure, production incident, performance issue, UI regression, flaky test, or unexpected behavior. Diagnostic-only root-cause workflow with evidence, hypotheses, blast-radius mapping, and verification plan."
user-invocable: true
when_to_use: "Invoke for evidence-first root-cause diagnosis before any fix."
category: dev-tools
keywords: [debug, diagnosis, root-cause, evidence]
argument-hint: "[issue] --quick|--ci|--frontend|--perf"
metadata:
  author: haposoft
  version: "1.0.0"
---
# Debug - Evidence-First Root Cause Analysis

Debugging is diagnosis, not repair. Find the source of the failure before changing product code.

## Arguments

- `--quick` - obvious local syntax, lint, type, or single-test failure
- `--ci` - CI/CD logs, runner environment, dependency versions, pipeline setup
- `--frontend` - browser console, screenshot, accessibility tree, network, responsive checks
- `--perf` - baseline measurements, bottleneck layer, profiling, before/after targets

Flags are optional hints. Without one, choose the depth yourself from the evidence below.

## Proportional depth

- **Quick/local:** one deterministic syntax, lint, type, or isolated-test failure.
- **Standard:** a reproducible failure inside one component or service that fits neither other depth.
- **Incident/deep:** production impact, multiple components, intermittent behavior, data/security risk, environment drift, concurrency, or two refuted hypotheses. Add a cross-source timeline, explicit elimination path, trigger/root-cause/contributing-factor separation, and recurrence-prevention gaps.

Quick/local and Standard reports write the root-cause contract, the confirmed hypothesis, the verification plan, and the fix direction; when the root cause is unknown, they list every hypothesis tested instead. Only Incident/deep reports add `Evidence Timeline`, the other hypotheses tested, `### Elimination Path`, and `### Recurrence-Prevention Handoff`. A shorter report omits those sections; it does not write them as skipped.

Depth changes evidence breadth and report length, never the six steps, the diagnostic-only gate, or the root-cause standard. Do not make a routine local failure perform incident ceremony merely because more tools are available.

<DIAGNOSTIC-ONLY-GATE>
`cf:debug` is read-only for product code.
Do NOT edit product code, apply fixes, create migrations, or add regression tests as implementation.
Do NOT change config, dependency versions, generated assets, or test snapshots to make the failure disappear.
Do NOT run heavy or costly reads — table scans, bulk exports, load or stress runs — against shared staging or production without the user's explicit permission; prefer local or fixture data.
Temporary instrumentation is allowed only when it is the minimal way to observe hidden state; record the file/line, capture the proof, remove it before finishing, and report `Temporary instrumentation: removed`.
</DIAGNOSTIC-ONLY-GATE>

<HARD-GATE-SCOUT-FIRST>
Before hypotheses, inspect the actual codebase context.
You must identify:
- project type, language, framework, runtime, and test runner
- affected files/modules and exact symptom location
- direct callers, dependents, and data/config boundaries
- related tests and reproduction commands
- recent commits touching affected paths
- adjacent known-good implementation patterns

After scout, provide a 3-6 bullet codebase-context summary before evidence capture.
Do not ask generic questions before this step unless the issue cannot be located from the prompt or repository.
</HARD-GATE-SCOUT-FIRST>

<ROOT-CAUSE-GATE>
Do NOT recommend a fix until the root-cause contract is complete.
Do NOT stop at the first plausible explanation unless evidence directly confirms it. Test hypotheses against evidence.
If 2+ hypotheses are refuted, change strategy before continuing.
If evidence is insufficient, report `Root cause: unknown`, `Missing Evidence`, and `Next Diagnostic Action`; do not hand off to `cf:fix` as ready.
Report confidence `high` only when the cause was reproduced or observed at runtime — the failing command run, a log or probe read. From static reading alone, report at most `medium`.
Answer each item in one concrete sentence.
If any answer contains 'probably', 'I think', 'something with', or 'maybe' — it is not an answer; gather evidence instead.
</ROOT-CAUSE-GATE>

`cf:debug` stops at diagnosis unless the user explicitly asks to fix. If the user asks to fix while still inside `cf:debug`, finish the debug report first. Then hand off only the completed root-cause contract to `cf:fix`.

## Step 1: Scout

Understand the affected code before forming hypotheses.

Invoke the `scout` skill (`cf:scout`) for the affected scope and fold its findings into the codebase-context summary the scout-first gate requires. Include recent changes: `git log --oneline -10 -- <affected-files>`.
If `cf:scout` is not installed, use direct read-only reconnaissance (`rg`, file reads, test discovery, and `git log`) and say so.

## Step 2: Capture Evidence

Create a baseline that can later prove whether the issue changed.

**Capture:**
- Exact command, URL, user flow, or trigger
- Exact error message, stack trace, failing assertion, or visual symptom
- Expected vs actual behavior
- Relevant logs with timestamps
- Environment facts: runtime, dependency versions, OS, browser, CI runner, config
- Whether the issue reproduces consistently or intermittently

For Incident/deep work, build an `Evidence Timeline` from timestamped facts across relevant sources. Normalize timezones, preserve request/trace/run IDs, and distinguish observed ordering from inferred causation. When no source carries timestamps, the timeline says so in one line and names the sources checked.

For frontend issues, use `.claude/references/debugger/frontend-verification.md`.
For CI/log issues, use `.claude/references/debugger/log-ci-analysis.md`.
For performance issues, use `.claude/references/debugger/performance-diagnostics.md`.

## Step 3: Pattern Analysis

Before proposing a cause, compare against known-good patterns.

**Check:**
- Similar implementation that works
- Similar tests that pass
- Recent code that changed the same contract
- Config/env differences between passing and failing contexts
- Dependency/API contract changes

## Step 4: Hypothesis Tests

When evidence does not directly confirm the first explanation, create 2-3 competing hypotheses. Test one variable at a time.

```text
Hypothesis: [statement]
Confirm if: [evidence that proves it]
Refute if: [evidence that disproves it]
Quick test: [command/search/log/query]
Result: confirmed | refuted | inconclusive
```

Rules:
- Never batch unrelated changes as a test.
- Prefer read-only evidence: logs, grep, stack traces, DB queries, browser traces.
- For flaky async tests, use `.claude/references/debugger/condition-based-waiting.md`.
- If 2+ hypotheses are refuted, use inversion: ask what evidence would make the current explanation impossible.
- Preserve an elimination path: for every confirmed, refuted, or inconclusive hypothesis, cite the observation and explain why it changes the candidate set. Quick/local and Standard reports fold it into the confirmed hypothesis's evidence; only Incident/deep reports write it under `### Elimination Path`.

## Step 5: Root Cause Trace

Trace backward from symptom to origin.

```text
Symptom
  <- immediate cause
    <- contributing factor
      <- ROOT CAUSE
```

**Exact root-cause contract:**
- Symptom: exact observable failure
- Reproduction: command/user flow/log trigger
- Expected vs actual behavior
- Trigger: event or input that activated the failure, or `unknown`
- Root cause: file:line or config/env source
- Contributing factors: conditions that increased likelihood or impact but are not sufficient causes, or `none evidenced`
- Why now: recent change, data state, dependency, environment, timing, or load factor
- Evidence chain: observations that prove this cause
- Blast radius: files/modules/tests/users/workflows affected

Do not collapse correlation into causation. The root cause must explain the mechanism from trigger to symptom and identify the earliest owned invariant whose correction would prevent recurrence. Read `.claude/references/debugger/root-cause-tracing.md` for deep call/data flow or test-pollution cases.

## Step 6: Blast Radius + Verification And Prevention Plan

Prepare the handoff to `cf:fix` or the user.

**Verification plan must include:**
- Original failing command or reproduction path
- Targeted regression test or scenario
- Affected-module tests
- Typecheck/lint/build commands when relevant
- UI screenshot/console/network checks when relevant
- Side-effect sweep from `.claude/references/debugger/side-effect-gate.md`

For Incident/deep work, add recurrence-prevention candidates: missing invariant or validation layer, observability/alerting gap, and one regression scenario. These are evidence-backed handoff directions only; `cf:debug` does not implement them.

## Diagnostic Report Format

Open the final answer with `## Debug Report` in this shape, keeping only the sections its depth requires under Proportional depth. Write `Temporary Instrumentation` only when instrumentation was added, and `Missing Evidence` and `Next Diagnostic Action` only when the root cause is unknown.

```markdown
## Debug Report

**Issue:** [one-line summary]
**Mode:** quick | standard | ci | frontend | perf
**Depth:** quick/local | standard | incident/deep
**Root cause confidence:** high | medium | low | unknown

### Root Cause Contract
- Symptom:
- Reproduction:
- Expected:
- Actual:
- Trigger:
- Root cause:
- Contributing factors:
- Why now:
- Evidence chain:
- Blast radius:

### Hypotheses Tested
1. [confirmed/refuted/inconclusive] [hypothesis] - [evidence]

### Evidence Timeline
- [timestamp/source/id/event]

### Elimination Path
- [candidate removed or retained] - [decisive observation]

### Verification Plan
- Original reproduction:
- Regression guard:
- Side-effect sweep:

### Recurrence-Prevention Handoff
- Missing invariant/validation:
- Monitoring or alerting gap:
- Regression scenario:

### Temporary Instrumentation
- removed: [file:line, purpose, proof captured]

### Recommended Fix Direction
[Smallest root-cause fix, or "insufficient evidence"]

### Missing Evidence
- [Only when root cause is unknown]

### Next Diagnostic Action
- [Only when root cause is unknown]

### Unresolved Questions
- [Only if any]
```

## Relationship To Fix

- Use `cf:debug` to determine what is wrong.
- Use `cf:fix` to change code only after the root-cause contract is complete.
- A `Root cause: unknown` report is not ready for Fix; continue diagnosis or ask for the missing artifact.
- If `cf:fix` verification fails, return to `cf:debug` with the new evidence.

## References

Load as needed:
- `.claude/references/debugger/core-philosophy.md` - Anti-guessing discipline
- `.claude/references/debugger/root-cause-tracing.md` - Backward trace to origin
- `.claude/references/debugger/verification-protocol.md` - Diagnostic baseline and proof handoff ownership
- `.claude/references/debugger/log-ci-analysis.md` - Logs and CI/CD failure analysis
- `.claude/references/debugger/parallel-agent-hydration.md` - Permission-gated parallel reconnaissance
- `.claude/references/debugger/frontend-verification.md` - Browser/UI verification
- `.claude/references/debugger/performance-diagnostics.md` - Performance investigation
- `.claude/references/debugger/condition-based-waiting.md` - Flaky async test diagnosis
- `.claude/references/debugger/side-effect-gate.md` - Regression and blast-radius checks
