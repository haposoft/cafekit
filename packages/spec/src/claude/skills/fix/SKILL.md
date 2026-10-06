---
name: cf:fix
description: "Use when asked to FIX a bug, error, test failure, CI/CD issue, type error, lint error, log error, UI issue, or code problem. Uses cf:debug for evidence-first diagnosis before any code change."
user-invocable: true
when_to_use: "Invoke to fix a bug or failure with scout-first diagnosis before change."
category: dev-tools
keywords: [hotfix, fix, bug, diagnosis]
argument-hint: "[issue] --quick|--parallel|--from-debug"
metadata:
  author: haposoft
  version: "2.0.0"
---
# Fix — root-cause repair workflow

Fix the diagnosed root cause, prove the fix with fresh evidence, and leave no side effects. Evidence first, fix second.

## Arguments

- `--quick` - Reduced-depth path for trivial issues (lint, type errors, syntax); still scout-first
- `--parallel` - Fix independent issues concurrently, only through the Delegation Gate below
- `--from-debug` - Start from an existing `cf:debug` report and validate its contract before accepting it

Default: deterministic scout-first fix. There is no initial mode selection step.

## Proportional depth

Choose the smallest adequate depth from the diagnosed evidence. Depth vocabulary follows `cf:debug`:

- **Quick/local:** one deterministic syntax, lint, type, or isolated-test failure with obvious local scope. Quick mode only reduces depth; it never skips scout, pre-fix evidence, diagnosis, or before/after verification.
- **Standard:** a diagnosed root cause inside one bounded area. Fix plus a regression test seen failing on the unchanged code before the fix (`HARD-GATE-RED-BEFORE-FIX`) and passing after it.
- **Incident/deep:** production impact, multiple components, intermittent behavior, data/security risk, or concurrency. Consume the full Incident/deep debug handoff (timeline, elimination path, recurrence candidates), implement in stages, and verify each stage.

Depth changes evidence breadth, never the gates: scout, diagnosis, before/after proof, and the side-effect gate apply at every depth.

## Bounded repair frame

Quick/local does not add a separate framing ceremony when the issue and diagnosis already establish the repaired behavior and proof. For Standard or Incident/deep, or whenever scope or risk remains ambiguous after diagnosis, record four short fields before choosing an implementation:

- **Outcome:** the observable repaired behavior.
- **Constraints:** compatibility, safety, ownership, rollout, and time boundaries.
- **Non-goals:** adjacent behavior the repair must not absorb.
- **Acceptance:** the exact reproduction plus broader evidence that proves completion.

Derive repository-owned facts from scout and diagnosis. Ask the user only for a missing user-owned decision that could materially change the repair. This frame does not select a solution, widen the issue into feature work, or run before the root cause is proven.

<HARD-GATE>
Do not propose or implement a fix before scout and diagnosis complete.
A symptom patch without a diagnosed root cause is a failed fix.
The exact root-cause contract under Diagnosis is mandatory; answer each field in one concrete sentence.
An answer containing 'probably', 'I think', 'something with', or 'maybe' is not an answer; gather evidence instead.
If 3+ fix attempts fail, stop, question the architecture, and discuss with the user.
</HARD-GATE>

<HARD-GATE-SCOUT-FIRST>
Fix always scouts before asking broad clarification questions, forming hypotheses, or changing files.
Collect these scout outputs first: the project type, language(s), framework(s), and package/test runner from repo files; the exact file(s) where the symptom surfaces and their direct callers/dependents; related tests covering the affected area; recent commits touching affected files (`git log --oneline -10 -- <affected-files>`); and existing patterns/conventions for this kind of fix.
Then state a concise 3-6 bullet codebase-context summary before diagnosis.
Do not ask generic questions before this step unless there is no repo, no error text, and no observable artifact to inspect.
</HARD-GATE-SCOUT-FIRST>

<HARD-GATE-RED-BEFORE-FIX>
Before the first change to any non-test file (an edit, a file write, or a shell command that rewrites it), run a test that fails on the unchanged code for the diagnosed reason, and keep its exact command and failing output for verification.
For a lint, type, syntax, or build failure, the exact failing check run on the unchanged code stands in for the test.
When no existing test fails for that reason, write or update the regression test first, then run it and see it fail.
Red shown after the fact does not count: stashing, checking out, reverting, or editing the fix away to make the test fail is not pre-fix evidence.
If no automated test or check can reproduce the failure, say so and keep the exact manual reproduction and its observed output instead.
This applies at every depth.
</HARD-GATE-RED-BEFORE-FIX>

<HARD-GATE-NO-SIDE-EFFECTS>
The fix is not done until verification proves:
1. The original symptom no longer reproduces with the exact pre-fix command/user flow.
2. Modified files and transitively affected modules still pass relevant tests.
3. Blast-radius workflows have no business-logic regression.
4. No new lint/type/build errors were introduced.
5. Public contracts are unchanged unless intentionally called out: function signatures, exported types, response shapes, DB schemas, env vars.

If verification reveals a side effect or regression, stop and present 2-4 concrete options to the user:
- Revert this fix and try a different root-cause angle
- Keep the fix and update <dependent files> to match the new contract
- Narrow the fix to <subset> so the regression disappears
- Accept the change — the old behavior was itself a bug
Do not silently patch around the regression.
</HARD-GATE-NO-SIDE-EFFECTS>

## Delegation Gate

Dispatch subagents (parallel scouts, hypothesis tests, deep research, or
`--parallel` fix trees) only when all three conditions hold:

- The user explicitly requested or permitted delegation or parallel agents.
- The active runtime exposes an Explore/delegation capability.
- The work splits into at least two distinct, non-overlapping scopes with useful independent work.

Otherwise continue sequentially in the main agent with focused local evidence.
Task-tracking tools are an optional visibility fallback, never a required step;
a concise markdown checklist is always sufficient.

## Standards

**Scout.** Map the blast radius before any hypothesis, with `cf:scout` or an equivalent focused local scout (`rg` plus targeted reads); scout depth follows the depth: Quick/local maps the project type, affected file(s), direct callers/dependents, related tests, and recent commits; Standard and deeper add module boundaries, test coverage, call chains, recent changes, and existing patterns; `--parallel` runs one independent scout per issue, only through the Delegation Gate.

**Diagnosis.** Evidence-based root cause analysis; no guessing. `cf:debug` may help and `--from-debug` validates its report, but neither is a required call; `references/diagnosis-protocol.md` holds the Fix-local checklist. Capture the pre-fix state first: exact error messages, failing test output, stack traces; this is the baseline for verification. When an existing test already fails for the diagnosed reason, its run belongs to this baseline; otherwise the regression test is written and seen failing at the start of implementation under `HARD-GATE-RED-BEFORE-FIX`. Locate where and when the failure started (`git log -p`), form 2-3 hypotheses each with confirm/refute evidence and a quick test, test them with focused local reads (in parallel only through the Delegation Gate), and trace symptom → immediate cause → contributing factor → root cause. If 2+ hypotheses fail, apply `references/escalation-tactics.md`.

**Exact root-cause contract** (field definitions in `references/diagnosis-protocol.md`; Expected and Actual may be one field): Symptom, Reproduction, Expected vs actual, Trigger, Root cause (file:line, config, environment, dependency, or data source), Contributing factors, Why now, Evidence chain, Blast radius.
- Trigger: event or input that activated the failure, or `unknown`
- Contributing factors: conditions that raised likelihood or impact but are not sufficient causes, or `none evidenced`

With `--from-debug`, validate the report before accepting it:

- the exact root-cause contract is complete;
- when `**Depth:**` is `incident/deep`, `Evidence Timeline` is present — a skipped timeline is valid in either producer form (`Timeline: skipped - <reason>` or `- skipped: <reason>`), as is one line naming the sources checked when none carries timestamps;
- when `**Depth:**` is `incident/deep`, `Elimination Path` records the decisive observation for each removed or retained candidate;
- a `quick/local` or `standard` report may omit both; a report with no `**Depth:**` line is treated as `incident/deep`;
- `Recurrence-Prevention Handoff`, when present, carries evidence-backed candidates only.

A report missing required fields routes back to diagnosis (`cf:debug`); it does not enter implementation.

If any contract field is vague or missing file:line/config/env evidence, keep diagnosing or ask the user for the specific missing artifact. Do not implement.

**Depth and frame.** Apply the Proportional depth rule above. For 2+ independent issues (or `--parallel`), evaluate the Delegation Gate; when it is closed, fix the issues sequentially. Track progress with the runtime's task surface when available, or a markdown checklist otherwise. For Standard and Incident/deep, complete the bounded repair frame above. Quick records no separate frame unless scope or risk is still ambiguous.

**Implementation.** Fix the root cause, not the symptom. Follow diagnosis findings. Minimal changes only; follow existing code patterns. One logical change per commit boundary.
- **Quick:** with the pre-fix failure observed under `HARD-GATE-RED-BEFORE-FIX`, apply the minimal fix from completed scout + diagnosis, run the exact pre-fix command plus typecheck/lint immediately, report before/after proof.
- **Standard:** write or update the regression test and run it to see it fail on the unchanged code (`HARD-GATE-RED-BEFORE-FIX`), then implement the fix, rerun the same test to see it pass, and run the relevant suite.
- **Incident/deep:** after diagnosis, research only unresolved external facts. If multiple cause-aligned remedies or an architecture decision remain, use `cf:brainstorm` to compare 2-3 options against the bounded repair frame, then write a concise staged implementation plan with dependencies and proof per stage. When diagnosis leaves one safe direct repair, skip research and brainstorm, record why it satisfies the frame, and implement it. Delegated research follows the Delegation Gate; implementation starts only after the direction is resolved.
- **Parallel:** one independent issue per agent, each carrying scout through verification, dispatched only through the Delegation Gate; aggregate results on completion.

**Verification and prevention.** Iron-law verification: run the exact commands from the pre-fix state capture and compare output. No claims without fresh command output from the current run. The regression proof is the failing run kept under `HARD-GATE-RED-BEFORE-FIX` and a passing run of the same test after the fix. Full check: typecheck + lint + build + test (see `references/parallel-patterns.md` Pattern C). Prevention guard (Standard+): see `references/prevention-gate.md`; consume the debug report's recurrence candidates when present. Side-effect gate: sweep the full blast radius from diagnosis against the five checks in the gate above. Review: trigger `cf:code-review`; see `references/review-cycle.md`.

Verification and review report `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED`. The definition of `PASS` defers to `cf:code-review`. `PASS_WITH_WARNINGS` routes through the same remediation or user-pause path as `FAIL` and never auto-accepts. `BLOCKED` is terminal for the cycle; resolve the blocker instead of retrying. A review-only result is not execution proof; completion claims require fresh command output.

If verification fails: under 3 attempts, return to diagnosis with the new evidence; at 3+ attempts, stop and discuss with the user. Never weaken, delete, or mock a failing assertion to obtain green.

**Finalize.** If API or behavior changed, update only the affected existing docs through the docs flow. Ask the user before committing; use conventional commits.

## Output Format

**Report:** root cause, changes made, files affected, before/after proof, prevention measures, side-effect sweep result, and any remaining limitations.

## Specialized Paths

Use `references/workflow-specialized.md` as a progressively disclosed overlay after scout for CI/CD failures, test suite failures, TypeScript type errors, UI/visual issues, and application log errors. Load only the matching section. Specialized paths add category-specific evidence and proof; they do not replace these standards, weaken diagnosis, or broaden the repair scope.

## References

Load as needed:
- `references/diagnosis-protocol.md` — Structured root cause analysis and the exact root-cause contract
- `references/escalation-tactics.md` — What to do when hypotheses fail (Inversion, Scale Game)
- `references/prevention-gate.md` — Defense-in-depth validation after fix
- `references/review-cycle.md` — Review verdict handling and required user-pause conditions
- `references/parallel-patterns.md` — Delegation Gate patterns for parallel work
- `references/workflow-specialized.md` — CI/CD, test, TypeScript, UI-specific workflows
