# Task 02 — Prove native parity and document usage

Status: done

## Outcome

Behavioral/mutation tests prove the source and disposable installed Claude/Codex
instruction bytes preserve the plan-native contract, while the usage guide
teaches it without inventing runtime or speed evidence.

## Scope

- In: source contract fixtures, semantic weakening mutations, disposable native
  installs, usage guidance, exact structural metrics, and controller-owned delta
  containment against an ephemeral pre-task path manifest.
- Out: live-model timing/adherence, host E2E, npm-packed contract proof, installer
  changes, hook/parser changes, timing packet execution, release, commit, or push.

## Coverage

- CP-03

## Ownership

- Modify: `packages/spec/bin/__tests__/develop-contract.test.js`
- Modify: `packages/spec/bin/__tests__/codex-native.test.js`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Modify: `docs/specs-usage-guide.md`
- Read: `packages/spec/bin/phases/copy-payload.js`
- Read: `packages/spec/bin/lib/codex-install.js`
- Read: `packages/spec/src/claude/scripts/spec-resolver.cjs` — `resolveWorkflowCandidate`
- Read: `packages/spec/src/claude/scripts/spec-receipt.cjs` — `checkWorkflowTaskReceipt`, `workflowDependencyProofState`
- Read: `packages/spec/src/claude/hooks/spec-gate.cjs` — final done-task revalidation
- Read: `packages/spec/src/claude/scripts/provenance.cjs` — runtime Base/Head derivation

## Acceptance

- AC-03: fixtures use the named resolver/receipt/provenance surfaces to cover two
  dependent tasks, plan-order selection, exact-task isolation, paused/blocked/
  invalid dependency states, interrupted recovery, multiple-active fail-stop,
  controller-only state writes, and the no-routine-prompt instruction contract.
- AC-04: tests model a later worktree mutation and repeat Head stabilization to a
  fixed point; proof that mutates source or is missing/nonzero/zero-test/remembered
  cannot close. Shared runs reject skipped/todo/cancelled/duplicate probes and
  missing per-task command, Head, level, oracle, or executed/pass attribution.
- AC-05: mutations fail when integration omits any worker-range commit/owned-path
  result, handoff SHA replaces runtime Head, or Flash chains/promotes without a
  later explicit non-Flash recovery. Existing flash-plus-parallel rejection stays.
- AC-06: disposable installed Claude and Codex copies preserve `SKILL.md`,
  `quality-gate.md`, `parallel-waves.md`, and `subagent-patterns.md` after allowed
  transforms. The guide distinguishes feature/task/parallel/Flash behavior,
  final stabilization, structural metrics, and `[UNVERIFIED]` live adherence.
- Before implementation, the controller captures an ephemeral path manifest; at
  closeout it rejects only new unowned task delta and preserves ambient user dirt.
  This observation is not attributed to `npm test`.

## Dependencies

- task-01-author-plan-native-continuous-execution.md

## Verification Plan

- Command: `npm --prefix packages/spec test`
- Named probes: `hapo:develop plan-native continuous contract is complete and bounded`; `hapo:develop plan-native checker rejects semantic weakenings`; `Develop process-first source contract preserves selection, recovery, final-Head, parallel, and Flash boundaries`; `Claude installed Develop preserves plan-native execution and references`; `Codex installed Develop preserves plan-native execution and references`; `specs-usage-guide documents plan-native Develop without timing or live-adherence claims`
- Reachability: source fixtures call `resolveWorkflowCandidate`, `workflowDependencyProofState`, `checkWorkflowTaskReceipt`, and runtime provenance; source flows through payload copy into disposable `.claude/skills/develop` and transformed `.agents/skills/develop`; the guide has an exact static probe. No live-model or packed claim is inferred.
- Oracle: package runner exits 0 with nonzero tests; every named source, negative, installed-Claude, installed-Codex, and guide probe executes and passes; legacy and existing workflow suites remain green.
- Counterexample: generic wording passes while a fixture selects the wrong task, reuses interrupted proof, stops before Head is stable, accepts a skipped probe, integrates only part of a worker range, loses one installed reference, auto-promotes Flash, or claims measured speed/live adherence; its owning probe fails.
- Artifacts: disposable fixtures with containment/cleanup only. The controller's pre-task path manifest is separate closeout context, not package-test output.

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
✔ Develop process-first source contract preserves selection, recovery, final-Head, parallel, and Flash boundaries
✔ Claude installed Develop preserves plan-native execution and references
✔ Codex installed Develop preserves plan-native execution and references
✔ specs-usage-guide documents plan-native Develop without timing or live-adherence claims
[skill-test] PASS: 1167 tests executed
Aggregate: pass=1166 fail=0 skipped=1; Exit: 0.
```
