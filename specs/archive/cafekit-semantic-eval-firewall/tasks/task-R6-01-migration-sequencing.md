# Task R6-01: Migration ownership sequencing
**Status:** pending

## Outcome

Publish the migration checklist with per-phase rollback conditions and prove machine ownership write_set contention is rejected globally and pairwise across every boundary in `coordination.boundaries` — not only within one boundary, and not only within whatever boundaries were declared — via an owned negative fixture with nonzero failing cases covering an in-boundary dual writer, a cross-boundary dual writer, and a dual writer named in no boundary at all.

## Scope

- **In scope:** Migration checklist artifact recording that the final freeze/C12 receipt/advanceBaseline sequence never runs until every task R0-01..R6-01 has landed and every D8 gate has passed (D11/I9 no-partial-publish, cross-referenced with R5-01's R6.8); ownership dual-writer fixture dedicated semantic-firewall test covering in-boundary, cross-boundary, and entirely-omitted-boundary same-target pairs; verify this feature topology sequences hotspots without claiming a new global file lock; confirm every real cross-boundary same-target write pair in this spec — enumerated exactly, one pair per row (R0-01/R2-01 on validator-grounding.test.js; R1-01/R2-01 on validate-spec-output.cjs; R1-01/R3-01 on spec-semantic-model.cjs and specs-v2-validator-grounder-contract.test.js; R1-02/R3-01 on spec-readiness.cjs; R3-01/R5-01 on semantic-ir-mode.json; R4-01/R5-01 on benchmark-adjudicate.mjs; R4-02/R5-01 on develop-contract.test.js; R0-01/R5-01 on benchmark-workflow.mjs) — has a direct DAG edge evidenced by at least one dependency boundary between that exact pair, per I7's one-boundary-per-pair rule (do not re-merge R0-01/R2-01's validator-grounding.test.js pair into the R1-01/R2-01 pair — they are two distinct pairs on two distinct targets, each already covered by its own existing boundary, B-D-R0-R2 and B-D-R1-R2 respectively). This enumeration must be re-derived by the same anchorsByTask-projection scan the R1-01-owned validator mechanism performs (D10/I7/R8.2), never hand-eyeballed, so a mislabeled or omitted pair cannot silently persist. Note R0-01's `benchmark-failure-ledger.json`/`benchmark-failure-ledger.schema.json` are sole-writer, no-contention paths (R4-01/R5-01 only hold read/consumer anchors), so they add no new dual-writer case. V9's reachability entrypoint is the real validator that actually enforces this topology (`validate-spec-output.cjs`), reached via a new R6-01 consumer/read anchor and a direct dependency edge from R1-01 (its owner and sole implementer of the scan mechanism — R6-01 is verifier only, never implementing the scan itself), replacing the prior plan.md-file reachability reference.
- **Out of scope:** Inventing process-wide locks, rewriting unrelated packages, or implementing the ownership-contention scan mechanism itself (owned by R1-01 in `validate-spec-output.cjs`) — R6-01 owns only the negative-fixture proof against it.

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R6-01-01 | file | `packages/spec/reports/semantic-eval-firewall-migration-checklist.md` | owner | write | create |
| A-R6-01-02 | file | `packages/spec/bin/__tests__/ownership-write-set-contention.semantic-firewall.test.js` | owner | write | create |
| A-R6-01-03 | file | `packages/spec/bin/__tests__/package-inventory.test.js` | consumer | read | read |
| A-R6-01-04 | file | `packages/spec/scripts/benchmark-workflow.mjs` | consumer | read | read |
| A-R6-01-05 | file | `packages/spec/bin/__tests__/develop-contract.test.js` | consumer | read | read |
| A-R6-01-06 | file | `packages/spec/scripts/benchmark-adjudicate.mjs` | consumer | read | read |
| A-R6-01-07 | file | `packages/spec/src/claude/scripts/validate-spec-output.cjs` | consumer | read | read |
| A-R6-01-08 | file | `packages/spec/benchmarks/migration-phase-receipt.schema.json` | owner | write | create |
| A-R6-01-09 | file | `packages/spec/src/claude/scripts/migration-receipt-chain.cjs` | owner | write | create |
| A-R6-01-10 | file | `packages/spec/reports/migration-phase-receipts.json` | owner | write | create |
| A-R6-01-11 | file | `packages/spec/bin/__tests__/migration-receipt-chain.semantic-firewall.test.js` | owner | write | create |

## Changes

- [ ] Implement the exact schema, fixed store, and migration-receipt-chain runtime with atomic adjacent append, independent digest verification, candidate binding, rollback data, and release-complete assertion; keep Markdown checklist projection-only. _Requirements: 8.1_
- [ ] Keep shared hotspot writes sequenced by ownership write_sets and dependency boundaries, checked globally and pairwise across every boundary (not only within one boundary); own dual-writer negative fixture with nonzero failures under validate-spec-output exit 1 covering an in-boundary pair, a cross-boundary pair with no dependency edge, and a synthetic pair whose shared target is named in no `coordination.boundaries` entry at all (proving the scan — implemented by R1-01 — is anchorsByTask-derived, not boundary-declaration-limited); confirm R5 proof targets are listed. _Requirements: 8.2_

## Acceptance

- **R8.1:** Checklist and machine-readable receipts name each phase's success gates and rollback condition; receipt chain and candidate binding prevent skipping, reordering, or reusing a stale phase.
- **R8.2:** Machine ownership boundaries declare disjoint write_sets; contention is checked globally and pairwise across all boundaries, derived from the complete anchorsByTask projection (implemented by R1-01); dual-writer fixture fails validation with exit 1 for in-boundary, cross-boundary, and entirely-omitted-boundary cases; no extra global lock is claimed.

## Dependencies

- tasks/task-R1-01-review-receipt-schema.md
- tasks/task-R4-01-pools-public-adjudicator.md

## Verification Plan

- **Verification ref:** V9
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test migration-receipt-chain.semantic-firewall.test.js --require-semantic-test ownership-write-set-contention.semantic-firewall.test.js`
- **Expected:** Exit 0 for exact ordered receipt chain and release-complete assertion plus clean topology; all missing/stale/out-of-order receipt and three dual-writer fixtures fail nonzero.
- **Negative path:** A fixture with two writers on one path — whether inside one ownership boundary, across two different boundaries with no dependency edge, or naming a target absent from every boundary declaration — fails structural validation with nonzero errors.
- **Reachability:** `packages/spec/src/claude/scripts/validate-spec-output.cjs`
