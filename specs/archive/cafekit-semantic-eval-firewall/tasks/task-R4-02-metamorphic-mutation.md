# Task R4-02: Metamorphic and mutation controls
**Status:** pending

## Outcome

Register public metamorphic relations and invalid mutants with graph-delta assertions and critical mutant kill proofs, including negative controls, without prose-literal primary oracles.

## Scope

- **In scope:** metamorphic-relations schema, create metamorphic-mutation.semantic-firewall.test.js, and extend existing develop-contract tests for graph deltas and mutant kills. R4-02 lands after the boot-window (D11/I9): protected-path writes are authorized via `authorized_evolution` bound to the latest accepted PASS in the lineage (ordinarily the seed entry, I14).
- **Out of scope:** Private oracles and sealed task bodies.

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R4-02-01 | file | `packages/spec/benchmarks/metamorphic-relations.schema.json` | owner | write | create |
| A-R4-02-02 | file | `packages/spec/bin/__tests__/metamorphic-mutation.semantic-firewall.test.js` | owner | write | create |
| A-R4-02-03 | file | `packages/spec/bin/__tests__/develop-contract.test.js` | owner | write | modify |
| A-R4-02-04 | file | `packages/spec/benchmarks/pool-governance.schema.json` | consumer | read | read |
| A-R4-02-05 | file | `packages/spec/benchmarks/public-regression.interface.json` | consumer | read | read |
| A-R4-02-06 | file | `packages/spec/scripts/run-skill-self-tests.mjs` | consumer | read | read |

## Changes

- [ ] Define typed meaning-preserving relations with preconditions, closed operations, preserved fields, permitted deltas and forbidden deltas. _Requirements: 7.1_
- [ ] Define the minimum critical-mutant catalog across omitted criteria, weakened boundaries, missing failure paths, broken dependencies, stale provenance and expected-answer leakage; require true-positive and negative-control families. _Requirements: 7.2_
- [ ] Prove every applicable critical mutant is killed, every transform preserves its contract, one valid negative control survives, and one invalid mutant is detected. _Requirements: 7.3_

## Acceptance

- **R7.1:** Metamorphic suite validates typed graph contracts, not prose equality alone.
- **R7.2:** Missing catalog coverage, true-positive family, or negative control fails the suite.
- **R7.3:** All applicable critical mutants die, valid negative control survives, and invalid control is detected.

## Dependencies

- tasks/task-R4-01-pools-public-adjudicator.md

## Verification Plan

- **Verification ref:** V7
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test metamorphic-mutation.semantic-firewall.test.js`
- **Expected:** Exit 0; graph-delta and mutant kill cases pass; dedicated basename required and executed.
- **Negative path:** Prose-literal-only oracle is insufficient for suite pass.
- **Reachability:** `packages/spec/scripts/run-skill-self-tests.mjs`
