# Task 01 — Author plan-native continuous execution

Status: done

## Outcome

Canonical Develop source encodes an accepted packet as a continuous, resumable
instruction contract with deterministic selection and honest final-Head,
parallel, shared-proof, and Flash boundaries.

## Scope

- In: accepted-plan fast path, queue/task state table, crash recovery, task-local
  context, prompt stops, final-Head fixed point, shared-run attribution, complete
  parallel integration, Flash recovery, and existing line budgets.
- Out: live-model proof, new flags/state/index, executor CLI, resolver/hooks/
  provenance/parser, Sync/Test-agent changes, legacy migration, timing, or release.

## Coverage

- CP-01
- CP-02

## Ownership

- Modify: `packages/spec/src/claude/skills/develop/SKILL.md`
- Modify: `packages/spec/src/claude/skills/develop/references/quality-gate.md`
- Modify: `packages/spec/src/claude/skills/develop/references/parallel-waves.md`
- Modify: `packages/spec/src/claude/skills/develop/references/subagent-patterns.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance

- AC-01: marker-bearing feature mode reuses accepted C1/C2, performs only a
  narrow freshness scout, loads the plan index once, and has no routine gate
  until a real blocker or C3. The text labels live-model adherence unverified.
- AC-02: current bytes drive selection. Feature mode stops on multiple active or
  `paused`, resumes exactly one active, otherwise uses the first dependency-valid
  pending row in plan order, and never selects `blocked`. Task mode touches only
  its target, handles terminal/paused/blocked/bad-dependency states, and returns
  after sync. Concurrent invocation is unsupported; detected drift stops a write.
- AC-02: interrupted recovery discards ephemeral proof, preserves and inspects
  owned changes, resumes only unmet acceptance, avoids blind non-idempotent
  mutation, and requires fresh verification.
- AC-03: the active brief contains only referenced CP rows, Outcome, Scope,
  Ownership, Acceptance, Dependencies, Verification Plan, relevant code, and
  consumers. Only the controller writes Status or Receipt.
- AC-04: before C3, fixed-point stabilization repeats within the existing cap
  until all done Receipts share current Head; a proof run changing non-Specs
  bytes blocks. Shared proof maps one captured run to each task's exact command,
  Head, level, oracle, unique named probe, and executed/pass count; skip/todo/
  cancelled/ambiguous/remembered evidence cannot close.
- AC-05: parallel integration proves every commit in the worker range and the
  owned-path tree before post-merge proof; handoff metadata never substitutes
  for inline runtime Base/Head. Flash stops `in_progress` with no PASS and only
  a later explicit non-Flash invocation may recover it from fresh proof.

## Dependencies

- none

## Verification Plan

- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probes: `hapo:develop plan-native continuous contract is complete and bounded`; `hapo:develop plan-native checker rejects semantic weakenings`
- Reachability: canonical Claude Develop skill and its quality/parallel/dispatch references at source level. Task 02 owns installed parity. Live-model adherence remains `[UNVERIFIED]`.
- Oracle: static runner exits 0 only when source instructions jointly encode selection, recovery, lazy context, prompt boundaries, stable Head, attributed shared proof, full-range integration, Flash recovery, legacy isolation, existing flags, and line budgets.
- Counterexample: a source mutation omits `paused`, changes plan order, blindly repeats an interrupted action, resumes multiple active tasks, accepts a skipped shared probe, stops after one stale-Head pass, integrates a partial range, chains after Flash, adds a public mode, or claims live behavior; its owning semantic probe fails.
- Artifacts: static/mutation output only; mutations use disposable memory or temporary copies and leave source bytes unchanged.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
✔ hapo:develop plan-native continuous contract is complete and bounded
✔ hapo:develop plan-native checker rejects semantic weakenings
[skill-test] PASS: 528 focused static tests executed
Proportional mutations=70; adaptive mutations=43; adaptive groups=10.
```
