# Task R3-01: IR dual-run wire
**Status:** pending

## Outcome

Create semantic IR helper and mode file, implement C11 normalize/equality/disagreement report using one exact ASCII ordinal comparator (replacing existing `localeCompare` call sites in spec-semantic-model.cjs), wire dual-run into modelFromMarkdown and readiness, support shadow report-only and promote hard-fail and rollback.

## Scope

- **In scope:** spec-semantic-ir.cjs, semantic-ir-mode.json, model and readiness wire, ir-dual-run-wire.semantic-firewall.test.js, contract suite extensions for C11 (sequential handoff after R1-01's own edits to spec-semantic-model.cjs and specs-v2-validator-grounder-contract.test.js, and after R1-02's own edits to spec-readiness.cjs, per the matching dependency boundaries on those exact files). R3-01 lands after the boot-window (D11/I9): protected-path writes are authorized via `authorized_evolution` bound to the latest accepted PASS in the lineage (ordinarily the seed entry, I14).
- **Out of scope:** Setting promote after release gates (R5), private corpora.

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R3-01-01 | file | `packages/spec/src/claude/scripts/spec-semantic-ir.cjs` | owner | write | create |
| A-R3-01-02 | file | `packages/spec/src/claude/scripts/semantic-ir-mode.json` | owner | write | create |
| A-R3-01-03 | file | `packages/spec/src/claude/scripts/spec-semantic-model.cjs` | owner | write | modify |
| A-R3-01-04 | file | `packages/spec/src/claude/scripts/spec-readiness.cjs` | owner | write | modify |
| A-R3-01-05 | file | `packages/spec/bin/__tests__/ir-dual-run-wire.semantic-firewall.test.js` | owner | write | create |
| A-R3-01-06 | file | `packages/spec/bin/__tests__/specs-v2-validator-grounder-contract.test.js` | owner | write | modify |
| A-R3-01-07 | file | `packages/spec/src/claude/scripts/spec-semantic-model.cjs` | consumer | read | read |
| A-R3-01-08 | file | `packages/spec/src/claude/scripts/spec-readiness.cjs` | consumer | read | read |
| A-R3-01-09 | file | `packages/spec/bin/__tests__/specs-v2-validator-grounder-contract.test.js` | consumer | read | read |
| A-R3-01-10 | file | `packages/spec/reports/bootstrap-activation.json` | consumer | read | read |

## Changes

- [ ] Implement C11 normalize, stable equality, semanticDigest, disagreement report exact keys, and dual-run invoke from modelFromMarkdown and readiness. _Requirements: 4.1_
- [ ] Shadow markdown authority report-only; promote IR authority hard-fail on disagreement; rollback to shadow or off. _Requirements: 4.2_
- [ ] Sort all top-level and nested set arrays with one exact ASCII ordinal string comparator; replace existing `localeCompare`-based sort call sites in spec-semantic-model.cjs; prove cross-host sort parity with an owned test. _Requirements: 4.3_

## Acceptance

- **R4.1:** Owned wiring test fails if IR exists without both callers.
- **R4.2:** Mode authority and C11 equality are implementer-unambiguous.
- **R4.3:** Sorting is ASCII-ordinal deterministic, not locale-dependent; cross-host parity proven.

## Dependencies

- tasks/task-R1-01-review-receipt-schema.md
- tasks/task-R1-02-finalizer-pass-gate.md
- tasks/task-R1-03-bootstrap-activation.md

## Verification Plan

- **Verification ref:** V5
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test ir-dual-run-wire.semantic-firewall.test.js`
- **Expected:** Exit 0; C11 disagreement fields; ASCII ordinal sort parity across hosts; promote hard-fail; orphan fails.
- **Negative path:** Unwired IR module fails with nonzero failures; a localeCompare-based sort divergence fails.
- **Reachability:** `packages/spec/src/claude/scripts/spec-semantic-model.cjs`
