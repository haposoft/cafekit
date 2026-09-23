# Diagnosis Protocol

Structured root cause analysis methodology. Replaces ad-hoc guessing with evidence-based investigation. Prefer running `cf:debug` directly; use this file as the Fix-local checklist.

## Core Principle

Do not guess root causes. Form hypotheses through structured reasoning and test them against evidence.

No fixes during diagnosis: product-code changes start only after the exact root-cause contract is complete.

## Pre-Diagnosis: Capture State

Before any investigation, capture the current broken state as baseline:

```
1. Record exact error messages (copy-paste, not paraphrase)
2. Record failing test output (full command + output)
3. Record relevant stack traces
4. Record relevant log snippets with timestamps
5. Record git status / recent changes: git log --oneline -10
```

This baseline is required for Step 5 (Verify) — you MUST compare before/after.

## Diagnosis Chain (Follow in Order)

### Phase 1: Observe — What is actually happening?

Read, don't assume. Activate `debugger` agent if root cause is unclear.

- What is the exact error message?
- Where does it occur? (file, line, function)
- When did it start? (check `git log`, `git bisect`)
- Can it be reproduced consistently?
- What is the expected vs actual behavior?

### Phase 2: Hypothesize — Why might this happen?

Form hypotheses through structured reasoning, NOT guessing.

**Structured hypothesis formation:**
```
For each hypothesis:
  1. State the hypothesis clearly
  2. What evidence would CONFIRM it?
  3. What evidence would REFUTE it?
  4. How to test it quickly?
```

**Common hypothesis categories:**
- Recent code change introduced regression (`git log`, `git diff`)
- Data/state mismatch (wrong input, stale cache, race condition)
- Environment difference (deps version, config, platform)
- Missing validation (null check, type guard, boundary)
- Incorrect assumption (API contract, data shape, ordering)

### Phase 3: Test — Verify hypotheses against evidence

Test each hypothesis with focused local evidence (`rg`, targeted reads, exact
commands). Spawn parallel `Explore` subagents only when the Delegation Gate in
`../SKILL.md` is open:

```
// Only through the Delegation Gate — single message, max 3 parallel agents
Agent(subagent_type="Explore", prompt="Test hypothesis A: [specific search/check]")
Agent(subagent_type="Explore", prompt="Test hypothesis B: [specific search/check]")
```

**For each hypothesis result:**
- CONFIRMED → proceed to root cause tracing
- REFUTED → discard, note why
- INCONCLUSIVE → refine hypothesis or gather more evidence

### Phase 4: Trace — Follow the root cause chain

Trace backward from symptom to origin:

```
Symptom (where error appears)
  ↑ Immediate cause (what triggered the error)
    ↑ Contributing factor (what set up the bad state)
      ↑ ROOT CAUSE (the original flaw that must be fixed)
```

**Rule:** NEVER fix where the error appears. Trace back to the source.

## Exact Root-Cause Contract

Before Step 4 implementation in `cf:fix`, record:

- Symptom: exact observable failure
- Reproduction: command, user flow, CI job, log trigger, or route
- Expected: intended behavior
- Actual: observed behavior
- Trigger: event or input that activated the failure, or `unknown`
- Root cause: file:line, config, environment, dependency, or data source
- Contributing factors: conditions that raised likelihood or impact but are not sufficient causes, or `none evidenced`
- Why now: recent change, data state, dependency drift, environment, timing, or load factor
- Evidence chain: observations proving this cause
- Blast radius: affected files, modules, tests, users, workflows, or release paths

### Phase 5: Escalate — When hypotheses fail

If 2+ hypotheses are REFUTED → see `escalation-tactics.md`.

## Diagnosis Report Format

```markdown
## Diagnosis Report

**Issue:** [one-line description]
**Pre-fix state captured:** Yes/No

### Root Cause
[Clear explanation traced back to origin]

### Exact Root-Cause Contract
- Symptom:
- Reproduction:
- Expected:
- Actual:
- Trigger:
- Root cause:
- Contributing factors:
- Why now:
- Blast radius:

### Evidence Chain
1. [Observation] → led to hypothesis [X]
2. [Test result] → confirmed/refuted [X]
3. [Trace] → root cause at [file:line]

### Affected Scope
- Files: [list]
- Functions: [list]
- Dependencies: [list]

### Recommended Fix
[What to change and why — addressing root cause, not symptoms]
```

## Quick Mode Diagnosis

For trivial issues (type errors, lint, syntax), abbreviated:
1. Read error message
2. Locate affected file(s)
3. Identify root cause (usually obvious)
4. Skip parallel hypothesis testing
5. Still capture pre-fix state for verification
