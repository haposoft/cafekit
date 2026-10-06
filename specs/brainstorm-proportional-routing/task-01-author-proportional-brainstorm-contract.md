# Task 01 — Author the proportional Brainstorm contract

Status: done

## Outcome

Brainstorm spends ceremony only on unresolved material choices while preserving evidence-first discovery, explicit user decisions, safe bug diagnosis, and the Specs-first implementation boundary.

## Scope

- In: front-door classification, accepted-contract provenance/reuse, bug diagnosis routing, exploration-only stop, conditional alternatives, single final approval by default, conditional persistence, derived touchpoints, risk-surface wording, specialist alignment, and mutation-backed static checks.
- Out: implementation dispatch, HTML/advice modes, report registries, timing claims, and changes to Debug, Hotfix, Specs, or Develop behavior.

## Coverage

- CP-01

## Ownership

- Modify: `packages/spec/src/claude/skills/brainstorm/SKILL.md`
- Modify: `packages/spec/src/claude/skills/brainstorm/references/question-framework.md`
- Modify: `packages/spec/src/claude/agents/brainstormer.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/src/claude/rules/skill-workflow-routing.md`

## Acceptance

- AC-01: direct factual answers, specific commands, and explicitly different workflows win precedence and leave Brainstorm before scout, questions, approval, or persistence; read-only architectural exploration does not exit merely because it writes nothing. Reuse accepted contract fields independently only with current user acceptance or an approved artifact bound to the same target and revision; preserve valid fields, ask only material missing/conflicting fields, and invalidate stale provenance.
- AC-02: frame expected repaired behavior, constraints, non-goals, and acceptance evidence before diagnosis; never propose fixes from symptoms; route through `hapo:debug` until root cause is evidenced. Compare 2–3 cause-aligned remedies only when at least two viable fixes remain. Hand off to `hapo:hotfix` only if the user explicitly requested a fix; diagnosis-only requests return the root-cause report and stop.
- AC-03: feature/docs delivery produces a bounded handoff for a new explicit `hapo:specs` invocation. Non-bug product/architecture exploration-only is chat-only by default: recommendation then stop, with no approval, file persistence, Specs/Hotfix handoff, or implementation. Bug/failure always follows AC-02 through Debug, including diagnosis-only requests, before stopping or using explicitly authorized Hotfix. Brainstorm never invokes Develop.
- AC-04: preserve the narrow scout, domain/risk discovery, truthful decision register, and three-plus-subsystem split. A material choice compares 2–3 mechanically distinct viable options; a single viable path records why alternatives would be artificial. Align the specialist so it cannot force strawman options or a Specs handoff for exploration-only work.
- AC-05: make Outcome, Constraints, Non-goals, and Acceptance the user-owned contract; derive technical touchpoints from scout evidence and ask only when ownership/scope is undecidable. Rename the undefined `Risk matrix` to conditional risk surfaces. For delivery, use draft → internal 4-point review → present → one final approval by default → persist the exact approved content only with user authority at the configured report path when cross-session continuity or Specs needs it. Require a separate section decision for auth/secrets/privacy, destructive/irreversible or data-loss, money/privilege/safety, and production-state mutation boundaries.
- AC-07: replace shallow Brainstorm substring checks with named behavioral checks plus negative mutations for front-door precedence, field-level provenance/freshness, diagnose-before-remedy, fix authority, exploration stop/no ceremony, Specs-first/no Develop, option cardinality, critical section gates, review-before-approval/persistence, truthful decision provenance, and the line ceiling. The static runner rejects every weakening and executes a nonzero check count.
- AC-08: compact or replace existing ceremony instead of appending parallel rules. Keep `SKILL.md`, `references/question-framework.md`, and `agents/brainstormer.md` at a combined `<= 506` lines; report per-file deltas and make no measured generation-time claim.

## Dependencies

- none

## Verification Plan

- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probes: `hapo:brainstorm proportional routing contract is complete and bounded`; `hapo:brainstorm proportional routing checker rejects semantic weakenings`
- Expected: exit 0, nonzero focused static count, both named probes pass, and all existing static checks remain green.
- Reachability: canonical Brainstorm skill and question reference → source specialist → static contract checker. Runtime projection is proved by Task 02; no live-model adherence is claimed.
- Counterexamples: an architectural exploration exits solely because it is read-only; a direct fact scouts first; one stale/partial artifact approves every field; an API 500 receives cache/retry designs before diagnosis; “explore this API 500, diagnose only” bypasses Debug or invokes Hotfix; non-bug exploration requests approval or writes a report; a real two-way choice shows one option; one path gets fake alternatives; a critical payment section skips its decision; persistence precedes approval; an inferred choice is logged as the user's decision; the authoring bundle grows past 506 lines.
- Artifacts: none beyond command output; mutation checks operate on in-memory or disposable copies and leave canonical source unchanged.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
✔ hapo:brainstorm proportional routing contract is complete and bounded; src/claude/skills/brainstorm/SKILL.md=209 (+21), src/claude/skills/brainstorm/references/question-framework.md=170 (-62), src/claude/agents/brainstormer.md=69 (-17); total 448/506
✔ hapo:brainstorm proportional routing checker rejects semantic weakenings; count=70
[skill-test] PASS: 528 focused static tests executed
Proportional mutations=70; adaptive mutations=43; adaptive groups=10.
```
