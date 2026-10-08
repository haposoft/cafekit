# Develop plan-native execution research

## Problem

`hapo:develop` already consumes flat Specs packets, but its instruction contract
predates the latest queue/proof fields and leaves avoidable ceremony around an
accepted plan. The requested change is a smaller, continuous instruction path,
not a deterministic executor or a claim that every host model will obey prose.

## Current CafeKit evidence

- Specs keeps flat Markdown as state and separates `source`, `installed`, and
  `live` obligations (`packages/spec/src/claude/skills/specs/references/templates.md:94-102`).
- Develop resolves flat tasks, uses plan order, checks dependency Receipts, and
  distinguishes feature/task modes
  (`packages/spec/src/claude/skills/develop/SKILL.md:42-59`).
- The resolver accepts `pending`, `in_progress`, `paused`, `blocked`, and `done`,
  then exposes current task status/dependencies
  (`packages/spec/src/claude/scripts/spec-resolver.cjs:71-73,249-288`).
- Runtime `Head` digests the non-Specs worktree; Stop revalidates every done task
  against the current context
  (`packages/spec/src/claude/scripts/provenance.cjs:139-190,212-240`;
  `packages/spec/src/claude/hooks/spec-gate.cjs:228-244`).
- Process-v3 dependency eligibility and canonical Receipt validation are owned by
  `workflowDependencyProofState` and `checkWorkflowTaskReceipt`
  (`packages/spec/src/claude/scripts/spec-receipt.cjs:239-310`).
- Parallel guidance records worker range data, while the canonical Receipt needs
  runtime Base/Head after integration
  (`packages/spec/src/claude/skills/develop/references/parallel-waves.md:17-30,69-99`;
  `packages/spec/src/claude/skills/develop/SKILL.md:104-116`).
- Static mode executes semantic source checks, not a live model
  (`packages/spec/scripts/run-skill-self-tests.mjs:4045-4050`).

## AK Cook comparison

AK Cook is an orchestration prompt, not a deterministic executor. Reuse only its
accepted-plan fast path, file-first resume, dependency/ownership waves, and
bounded repair loops
(`/Users/nghialuutrung/Desktop/cafekit-ref/.claude/skills/ak-cook/references/workflow-steps.md:10-58,69-123`;
`/Users/nghialuutrung/Desktop/cafekit-ref/.claude/skills/ak-cook/references/plan-state-files-first.md:8-45`).

Do not port natural-language mode inference, `--auto`, `--no-test`, numeric
scores, mandatory agent chains, plan databases, GitHub projection, journals, or
automatic commits
(`/Users/nghialuutrung/Desktop/cafekit-ref/.claude/skills/ak-cook/SKILL.md:220-276`).

## Evaluated approaches

| Approach | Speed | Correctness | Compatibility | Decision |
|---|---|---|---|---|
| Plan-native single-flight | Reuses accepted plan; one task context | Keeps proof ownership, final stabilization, C3 | No new state or flag | Choose |
| Worktree waves by default | Setup cost dominates small packets | Interrupted waves need durable identity | Existing opt-in is enough | Keep opt-in |
| Port AK Cook pipeline | Repeats research and gates | Conflicting auto/no-test authority | Requires AK state/tooling | Reject |

## Approved design

1. `/hapo:develop <feature>` encodes a continuous feature lane; explicit task
   mode never runs dependencies or siblings and returns after its target.
2. Reuse accepted C1/C2. A narrow freshness scout may reopen C1 only from current
   scope-drift evidence; live-model adherence remains `[UNVERIFIED]`.
3. Derive the queue from current bytes and `plan.md` row order. In feature mode:
   `>1 in_progress -> stop`, `1 -> recover`, `0 -> first eligible pending`;
   `paused` stops chaining and `blocked` never satisfies a dependency.
4. A resumed task discards ephemeral proof, preserves/inspects its owned diff,
   implements only unmet acceptance, and runs fresh verification. Never blindly
   repeat a non-idempotent action. Concurrent Develop invocations are unsupported;
   reread before each controller state write and stop on observed drift.
5. Load the plan index once, then only the active task, its CP rows, dependency
   proof, owned code, and consumers. Reread task bytes before mutation and queue
   bytes after synchronization.
6. Stabilize final proof to a fixed point: capture Head, re-prove stale tasks,
   reject proof that changes non-Specs bytes, recapture Head, and repeat within
   the existing repair cap until all done Receipts share the current Head.
7. Share one captured run only when each receiving task maps the same exact
   command/Head plus its level, oracle, and unique executed/pass probe count.
   `SKIP`, `TODO`, cancellation, remembered output, or duplicate names fail.
8. Explicit parallel execution integrates the complete worker commit range and
   verifies the owned-path tree before post-merge proof. Handoff SHA/range data
   never substitutes for canonical runtime Base/Head.
9. Flash returns immediately with `in_progress` and no PASS Receipt. Only a new,
   explicit non-Flash invocation can recover it and synchronize fresh proof.
10. Capture a pre-task path manifest for controller containment. Compare only new
    task delta at closeout, preserve ambient user dirt, and never describe this
    observation as evidence produced by `npm test`.

## Structural success metrics

- Zero research/replanning for a valid accepted packet.
- Zero routine user prompts between invocation and blocker/C3.
- One full active-task context at a time outside a live explicit wave.
- One fresh required proof per unchanged attempt, except bounded final-Head repair.
- No new persistent state/public flags, auto-commit, packed/live, or timing claim.

## Decision register

| ID | Decision | Owner | Impact |
|---|---|---|---|
| D-01 | `KEEP` Develop-only scope | User, 2026-08-26 | No resolver/hook/provenance rewrite |
| D-02 | Plan-native single-flight | User-approved recommendation | No AK pipeline port |
| D-03 | Existing public flags only | User-approved recommendation | No auto/fast/no-test/continuous flag |
| D-04 | Timing remains separate | User-approved scope | Structural metrics only |
| D-05 | Accept C2-01–C2-10 | User, 2026-08-26 | Narrow proof claims; close queue/recovery/proof gaps |

## Open questions

- None within scope. A host invocation would be required to turn live-model
  adherence from `[UNVERIFIED]` into evidence; this packet deliberately omits it.
