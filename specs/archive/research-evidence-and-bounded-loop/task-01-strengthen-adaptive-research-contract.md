# Task 01 — Strengthen adaptive Research contract

Status: done

## Outcome
Research scales effort to decision risk and returns traceable, honest evidence
without forcing delegation or persistent files.

## Scope
- In: Quick/Standard/Deep routing, claim provenance, contradictions, uncertainty,
  recommendation tradeoffs, sequential fallback, persistence boundary.
- Out: Loop behavior, new research domains, live-model quality claims.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/research/SKILL.md`
- Modify: `packages/spec/src/claude/agents/researcher.md`
- Modify: `packages/spec/src/claude/skills/specs/templates/research.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance
- AC-01: depth is selected from reversibility, blast radius, uncertainty, and
  decision cost; Quick is bounded lookup, Standard verifies alternatives, and
  Deep adds contradiction/gap analysis without arbitrary research theatre.
- AC-02: material claims carry resolvable evidence metadata and certainty;
  comparisons name a winner only with explicit fit, tradeoffs, and limitations.
- AC-03: delegation is optional acceleration, not a correctness dependency;
  output stays in chat unless durable persistence has explicit authority.
- Existing Specs research headings and ordering remain byte-compatible; full
  scaffold/validator consumer compatibility is owned by Task 03 package proof.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`
- Named probes: `hapo:research adaptive evidence contract is complete and bounded`;
  `hapo:research checker rejects semantic weakenings`.
- Reachability: canonical Research skill, researcher agent, and report template;
  installed and legacy-consumer proof belongs to Task 03.
- Oracle: the runner exits 0 only when depth, provenance, uncertainty,
  contradiction handling, fallback, and persistence boundaries coexist.
- Counterexample: a mutation forces delegation, persists every answer, removes a
  claim anchor/date/certainty, or allows Deep to skip contradiction checks; its
  named probe fails.
- Artifacts: none.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs --static-only
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a

```text
✔ hapo:research adaptive evidence contract is complete and bounded
✔ hapo:research checker rejects semantic weakenings; count=18
[skill-test] PASS: 528 focused static tests executed
```
