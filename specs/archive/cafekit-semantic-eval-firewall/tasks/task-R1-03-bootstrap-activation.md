# Task R1-03: Bootstrap activation
**Status:** pending

## Outcome

Consume the fresh post-cutover seed PASS and C14 attestation, invoke the already-built `bootstrapBaseline` transition exactly once, and persist a machine-checkable activation receipt proving C10 generation 0 is live before any post-bootstrap task starts.

## Scope

- **In scope:** lifecycle-only invocation after R1-02; verify current semantic digest and seed history; validate C14 against captured base/current HEAD; invoke R0-01's existing bootstrapBaseline; validate R0-owned receipt schema; atomically persist and byte-re-read the fixed activation receipt.
- **Out of scope:** modifying source/test/runtime modules, extending the implementation exemption, creating a freeze, or publishing.

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R1-03-01 | file | `packages/spec/reports/bootstrap-activation.json` | owner | write | create |
| A-R1-03-02 | file | `packages/spec/src/claude/scripts/change-firewall.cjs` | consumer | read | read |
| A-R1-03-03 | file | `packages/spec/src/claude/scripts/spec-authoring-validation.cjs` | consumer | read | read |
| A-R1-03-04 | file | `packages/spec/src/claude/scripts/spec-readiness.cjs` | consumer | read | read |
| A-R1-03-05 | file | `packages/spec/benchmarks/release-baseline.json` | consumer | read | read |
| A-R1-03-06 | file | `specs/cafekit-semantic-eval-firewall/spec.json` | consumer | read | read |
| A-R1-03-07 | file | `specs/cafekit-semantic-eval-firewall/reports/bootstrap-legacy-bridge-review.json` | consumer | read | read |
| A-R1-03-08 | file | `packages/spec/benchmarks/bootstrap-activation.schema.json` | consumer | read | read |
| A-R1-03-09 | file | `packages/spec/bin/__tests__/bootstrap-activation.semantic-firewall.test.js` | consumer | read | read |

## Changes

- [ ] Verify the fresh seed PASS, consume exact C14, invoke bootstrapBaseline, then atomically persist and byte-re-read the fixed-path exact-key activation receipt. _Requirements: 9.1_
- [ ] Refuse missing/stale/differently-bound activation and make every downstream protected task verify receipt plus generation-0 authority. _Requirements: 9.2_

## Acceptance

- **R9.1:** Fixed `packages/spec/reports/bootstrap-activation.json` receipt exists only after a verified seed PASS and successful exact C14 bootstrap transition; it validates against the R0-owned closed schema, package inventory excludes it, and no caller overrides its path.
- **R9.2:** Every post-bootstrap task hashes the exact receipt bytes and requires its generation, tail authority digest, and commit to match current C10; dependencies alone are insufficient.

## Dependencies

- tasks/task-R0-01-change-firewall-choke.md
- tasks/task-R1-01-review-receipt-schema.md
- tasks/task-R1-02-finalizer-pass-gate.md

## Verification Plan

- **Verification ref:** V11
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test bootstrap-activation.semantic-firewall.test.js`
- **Expected:** Exit 0; fresh accepted seed review plus exact C14 produces generation 0 and a byte-verified activation receipt; identical replay is idempotent.
- **Negative path:** Missing/stale seed, wrong base/head, generation mismatch, receipt/authority digest mismatch, or different-binding replay exits nonzero.
- **Reachability:** `packages/spec/src/claude/scripts/change-firewall.cjs`
