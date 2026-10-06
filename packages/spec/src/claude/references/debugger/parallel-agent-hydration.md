# Permission-Gated Parallel Reconnaissance

Parallel discovery is optional, not a default Debug phase. Start with focused repository and runtime evidence in the main agent.

## Delegation Gate

Delegate only when all are true:

1. The user explicitly requested or permitted delegation or parallel agents.
2. The active runtime exposes an Explore/delegation capability.
3. There are at least two distinct, non-overlapping scopes whose read-only evidence can be collected independently.

Otherwise continue sequentially. Lack of delegation must never block diagnosis.

## Good Independent Scopes

- Frontend console/network evidence vs backend request/log evidence
- Application trace vs database query/lock evidence
- Failing CI job vs nearest known-good run
- Independent service or package boundaries in a cascading incident

## Dispatch Contract

- Assign explicit source/log/runtime boundaries with no overlap.
- Reconnaissance is read-only: no product edits, fix application, migrations, or state mutation.
- Provide the symptom, known evidence, exact questions, allowed commands, and required provenance.
- Require findings to distinguish observed fact, inference, and unknown.
- Join all results before root-cause judgment. Resolve contradictions against primary evidence and record unresolved conflicts.
