# Task 04 — Instructions, user guide and changelogs drop legacy compatibility

Status: done

## Outcome
No skill, agent, rule or user guide tells the model or the user about legacy `spec.json` packets, separate `receipts/` or `feature-receipt.md`; both changelogs describe the whole removal.

## Scope
- In: `skills/code-review/SKILL.md` (`:30-42`, `:128`, `:166-169`), `skills/code-review/references/verification-gate.md`, `skills/code-review/references/spec-compliance-review.md` (`:33`), `skills/develop/references/subagent-patterns.md` (`:54`), `skills/test/SKILL.md` (`:54-61`, `:187`; mixed-marker routing at `:55` becomes process-first), `skills/test/references/execution-strategy.md` (`:23-25`), `skills/sync/references/rebind-and-audit.md` (`:49`), `agents/test-runner.md` (`:20-21`, `:128`), `agents/spec-maker.md` (`:94`), under `packages/spec/src/claude/`, plus Codex projections under `packages/spec/src/codex/` other than hooks; `docs/specs-usage-guide.md` (`:172`), `docs/installer-architecture.md` (`:242-249`); self-test probes pinning that text (`packages/spec/scripts/run-skill-self-tests.mjs:2104`, `:2277`, `:2556-2560`, `:4096`, `:4138`, `:5380-5470`) and `packages/spec/bin/__tests__/develop-contract.test.js:958`, `:972`; changelog entries.
- Out: other `docs/` files; test renames; hook code (task 01).

## Coverage
- CP-06

## Ownership
- Modify: the instruction files listed in Scope
- Modify: `docs/specs-usage-guide.md`, `docs/installer-architecture.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `packages/spec/bin/__tests__/develop-contract.test.js`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`

## Steps
1. Edit the instruction files and two docs → the Acceptance grep is empty; `agents/spec-maker.md:94` no longer mentions legacy specs.
2. Update the listed self-test probes and `develop-contract.test.js:958`, `:972` to the new text (the `legacy-isolation` rule no longer requires a Legacy heading).
3. Write the changelog entries (Removed: legacy `spec.json` read support; notice behavior; Codex/omp scripts cleanup).

## Acceptance
- AC-06: `git grep -niE "legacy (packet|adapter|marker|route|workflow|specs)|legacy compatibility|spec\.json|receipts/<|feature-receipt|separate-receipt" -- packages/spec/src/claude/skills packages/spec/src/claude/agents packages/spec/src/claude/rules ':(exclude)packages/spec/src/codex/hooks' packages/spec/src/codex docs/specs-usage-guide.md docs/installer-architecture.md` prints nothing about Specs packets.

## Dependencies
- task-03-workflow-policy.md

## Verification Plan
- Command: `pnpm --dir packages/spec test`
- Named probe: the self-test probes listed in Scope, as updated; `develop-contract.test.js` code-review instruction tests at `:958` and `:972`.
- Reachability: `pnpm test` runs the self-tests and every node suite.
- Oracle: `[skill-test] PASS` with 0 failures; the Acceptance grep is empty.
- Counterexample: leaving the "Legacy workflow compatibility" heading in `test/SKILL.md` keeps the grep non-empty.
- Artifacts: none beyond command output.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `pnpm --dir packages/spec test`
Exit: 0
Base: 5b4305a7e677dbbe404b010b5572c9bb83f78147
Head: 7b9f7ecb92be220778147c6ef42056c8f04027fa4e57a060316b2ff46b898c41
```text
$ pnpm --dir packages/spec test
# tests 332
# suites 0
# pass 332
# fail 0
# cancelled 0
# skipped 0
# todo 0
# tests 199
# suites 0
# pass 199
# fail 0
# cancelled 0
# skipped 0
# todo 0
# tests 42
# suites 13
# pass 42
# fail 0
# cancelled 0
# skipped 0
# todo 0
[skill-test] PASS: 1339 tests executed
```

Review: code-auditor PASS_WITH_WARNINGS (round 1: code-review still blocked a mixed plan.md + spec.json packet against D-02; Codex/omp upgrades keep a stale verification-gate.md) then PASS after repair round 1 (Mixed removed from code-review; the Codex/omp stale copy is stated in both changelogs because installer phases are outside this task). Acceptance grep prints only the two doc sentences stating spec.json packets are no longer read, plus an unrelated ai-multimodal .env.example comment. Pre-change, the same grep listed 43 hits across 12 files (one of them the unrelated .env.example comment). Self-test guards updated: Develop legacy-isolation now requires zero Legacy headings; cf:sync bare-call and test routing clauses moved to the new wording with their mutations; a new hybrid-packet-is-blocked mutation guards "| valid | any | process-first |"; eight rules on the deleted verification-gate.md removed. Limitations: docs/cf-specs-flow.html still has a Legacy compatibility section (outside this packet docs scope); evals/code-review graders count reads of the removed verification-gate.md; legacy-isolation has no dedicated mutation; the additive-mixed-route wording is unchanged.
