# Task 01 — Author native router contract

Status: done

## Outcome
CafeKit exposes `hapo:route`, reproducing AgentKit's proportional classification, chaining, agent timing, and risk gates with only installed CafeKit capabilities.

## Scope
- In: direct-path gate; final-deliverable taxonomy; size/risk/domain modifiers; installed-only chains; one-owner links; collapse/detour rules; runtime-native agent discovery; seven-field delegation; authority monotonicity; keyed failure stop.
- Out: domain execution, installing missing skills, prompt-scoring hooks, and AgentKit-only capabilities.

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/src/claude/skills/route/SKILL.md`
- Create: `packages/spec/src/claude/skills/route/references/task-taxonomy.md`
- Create: `packages/spec/src/claude/skills/route/references/chaining-patterns.md`
- Create: `packages/spec/src/claude/skills/route/references/agent-timing.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance
- AC-01: explicit skill, obvious single intent, and direct factual conversation bypass a route chain.
- AC-02: material work records final-deliverable class, size, highest-link risk, and domain count before selecting links.
- AC-02: every link has entry, exit, and one owner; failures detour and two repeated failures stop.
- AC-07: a route never adds mutation, external action, commit, push, deploy, publish, or release authority.
- AC-02: repeated failure means the same `(link, owner, normalized cause)` twice in one chain; this router stop does not replace the separate orchestrator task-retry rule.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probe: `hapo:route proportional installed-capability contract is complete and bounded`; `hapo:route checker rejects semantic routing weakenings`
- Reachability: this task adds its named semantic checker to the canonical static runner in the same ownership boundary; Task 03 owns installed projection.
- Oracle: canonical bytes yield no issues and exit 0; removing a required gate or adding an absent-capability assumption yields its exact nonempty issue set.
- Counterexample: explicit `$hapo-test` is reclassified; factual Ask spawns agents; absent Docs is invoked; high risk skips review/confirmation; review adds push; diagnose adds Fix; build adds Deploy; missing agent is synthesized; `BLOCKED` is blindly retried; different causes share a failure key or the same key loops.
- Artifacts: in-memory or disposable mutations only; canonical source unchanged.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
✔ hapo:route proportional installed-capability contract is complete and bounded
✔ hapo:route checker rejects semantic routing weakenings
[skill-test] PASS: 528 focused static tests executed
```
