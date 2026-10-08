# Task 01 — Author the adaptive coverage contract

Status: done

## Outcome

Specs converts a broad or ambiguous request into the smallest correct workflow and a material coverage profile, without turning routine work into a deep planning ceremony or creating new machine authority.

## Scope

- In: risk-first exact routing, canonical per-outcome coverage rows, multi-valued/open kinds and surfaces, normative ambiguity actions, monotonic risk, proof lifecycle, scoped reviewer selection, profile rederivation, and line-budget-neutral replacement.
- Out: parser/hook/Receipt changes, timing instrumentation, legacy templates, implementation dispatch, and an exhaustive technology registry.

## Ownership

- Modify: `packages/spec/src/claude/skills/specs/SKILL.md`
- Modify: `packages/spec/src/claude/agents/spec-maker.md`
- Modify: `packages/spec/src/claude/skills/specs/references/templates.md`
- Modify: `packages/spec/src/claude/skills/specs/references/review.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance

- AC-01: classify risk before route selection; preserve the clear + isolated + reversible + routine + likely one/two-file direct gate; enforce critical/elevated floors from the plan; settle user-owned observable decisions at C1/C2 before Brainstorm; route material design alternatives through Brainstorm; split exactly at `>=3` independently deliverable subsystems. Static cases include a destructive one-file request labeled routine and retention examples that would change behavior.
- AC-02: `plan.md` owns one `## Coverage profile` table with one `CP-NN` row per externally observable outcome and exact columns for kinds, material surfaces, ambiguity/action, risk/evidence, and required proof; each task references its CP IDs. Kinds are sets, unfamiliar kinds/surfaces use `other:<verbatim>`, and obligations union only within affected rows/tasks. Keep group-based reviewer counts, select Fact Checker plus matching highest-risk roles, never omit a relevant security/failure role for a critical row, and add no unrelated reviewer. Canonical semantics stay in the skill/templates, `spec-maker` references them, and accepted scope/outcome/criteria/ownership/dependency/risk/proof changes rederive affected rows before status.
- AC-03: distinguish a planned required proof set from reachability and executed evidence. Unknown command/caller/environment reachability blocks `pending`; known planned-but-unrun proof does not. Missing/failed/unavailable required execution proof blocks `done`/C3, and `source`, `installed`, and `live` remain independent. Source/static checks prove only the written contract, not live model adherence.
- AC-06: existing C1/C2/C3, task statuses, dependency basenames, Receipt rules, legacy compatibility, review cap/two-round stop, and line ceilings remain intact. Replace/compact current Step 0 plus ambiguity routing in `SKILL.md`, merge profile shape into the existing no-invention/boundary section in `templates.md`, and replace group-only review wording instead of appending parallel rules. Report per-file line deltas; do not edit the legacy template files; the nine-file shipped bundle must have net delta `<= 0` and total `<= 750`.

## Dependencies

- none

## Verification Plan

- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probe: `hapo:specs adaptive coverage contract is complete and monotonic`
- Reachability: canonical Claude Specs skill/templates/review and source `spec-maker`; installed skill/agent parity is owned by Task 02. No live-model behavior is claimed.
- Oracle: the static runner exits 0 only when the risk-first routes, canonical CP shape/rederivation, ambiguity actions, scoped lenses, proof lifecycle, existing process-first invariants, per-file deltas, and complete bundle ceiling are all present.
- Counterexample: a mutation permits a destructive routine fast path, drops an `other:<verbatim>` kind/surface, lets examples choose behavior, globalizes a critical lens, leaves a post-C2 profile stale, confuses planned proof with `UNKNOWN`, or raises the bundle above 750; the named detector fails.
- Artifacts: normal command output only; no persistent test artifact.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
✔ hapo:specs adaptive coverage contract is complete and monotonic; bundle deltas: src/claude/skills/specs/SKILL.md -19, src/claude/skills/specs/references/review.md +3, src/claude/skills/specs/references/templates.md +16; total 750/750
[skill-test] PASS: 528 focused static tests executed
Proportional mutations=70; adaptive mutations=43; adaptive groups=10.
```
