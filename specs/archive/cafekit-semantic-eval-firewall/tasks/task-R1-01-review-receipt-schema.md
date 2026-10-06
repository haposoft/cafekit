# Task R1-01: Review receipt C2 schema freeze
**Status:** in_progress

## Outcome

Freeze C2 receipt keys including separate reviewer verdict and lifecycle_disposition, plus the C13 durable `semantic_review_history` schema (lineage_id + append-only entries, each carrying `review_epoch` alongside `attempt_index`) that grounds epoch-scoped repair_round attempt-index derivation, across semantic model, scaffold, template, review guidance, and structural validator, plus the new C16 `AuthoringValidationReceipt` fail-closed check in the validator and the new `spec-authoring-validation.cjs` atomic coordinator (D13) that is the sole writer of any authoring stage's `validated` transition together with that receipt. R1-01 lands under the legacy-bridge boot-window (D11/I9, second of the three exempt tasks): it builds the C2/C13 schema but does not invoke `bootstrapBaseline` or touch freeze/release state.

## Scope

- **In scope:** semantic-model, scaffold, spec-state template, review.md, validate-spec-output C2 and C13 completeness; the new `spec-authoring-validation.cjs` atomic coordinator and validate-spec-output's C16 fail-closed freshness check (consuming the R0-01-owned `spec-authoring-digest.cjs` primitive); correcting scaffold to never write `validated` for any authoring field; review-receipt-c2.semantic-firewall.test.js; extend validator-grounder contract tests for verdict vs lifecycle_disposition, semantic_review_history exact keys, and C16 receipt freshness.
- **Out of scope:** Finalizer promote logic and history append/reject enforcement (R1-02), coding while ready=false.

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R1-01-01 | file | `packages/spec/src/claude/scripts/spec-semantic-model.cjs` | owner | write | modify |
| A-R1-01-02 | file | `packages/spec/src/claude/scripts/spec-scaffold.cjs` | owner | write | modify |
| A-R1-01-03 | file | `packages/spec/src/claude/skills/specs/templates/spec-state.json` | owner | write | modify |
| A-R1-01-04 | file | `packages/spec/src/claude/skills/specs/references/review.md` | owner | write | modify |
| A-R1-01-05 | file | `packages/spec/src/claude/scripts/validate-spec-output.cjs` | owner | write | modify |
| A-R1-01-06 | file | `packages/spec/bin/__tests__/review-receipt-c2.semantic-firewall.test.js` | owner | write | create |
| A-R1-01-07 | file | `packages/spec/bin/__tests__/specs-v2-validator-grounder-contract.test.js` | owner | write | modify |
| A-R1-01-08 | file | `packages/spec/src/claude/scripts/change-firewall.cjs` | consumer | read | read |
| A-R1-01-09 | file | `packages/spec/src/claude/scripts/spec-authoring-validation.cjs` | owner | write | create |
| A-R1-01-10 | file | `packages/spec/src/claude/scripts/spec-authoring-digest.cjs` | consumer | read | read |

## Changes

- [x] Persist C2 exact keys including verdict PASS|FAIL, lifecycle_disposition CONTINUE|BLOCKED, repair_round attempt index storage, findings, unresolved_decisions, graph_coverage, reviewed_criteria, counterexamples, semantic_digest, status, reviewer_evidence. _Requirements: 3.1_
- [x] Enforce structural completeness types nullability enums cardinality digest binding only without meaning judgment. _Requirements: 3.4_
- [x] Add C13 `semantic_review_history` structural schema: exact keys `lineage_id`, `entries`; entry exact keys `sequence`, `semantic_digest`, `review_receipt_digest`, `verdict`, `lifecycle_disposition`, `blocking_count`, `attempt_index`, `review_epoch`; reject duplicated findings/unresolved_decisions/counterexamples inside history; require dedupe against the whole lineage (any existing entry's digest, not only the latest), unaffected by epoch scoping. _Requirements: 3.6_
- [x] Harden `validate-spec-output.cjs`'s ownership-contention scan (D10/I7): derive every same-target write/write task pair directly from the complete `anchorsByTask` write-anchor projection, independent of which `coordination.boundaries` entries reference them; treat any single existing dependency boundary between a pair — regardless of its own named `deliverable` — as covering every target that pair shares; flag exit 1 any same-target pair with no qualifying dependency boundary between the two tasks at all, including a pair named in no boundary whatsoever. R1-01 is the sole write-owner of this file within this feature and implements this mechanism; R6-01 (V9) proves it only as a read-only consumer, never implementing it. _Requirements: 8.3_
- [x] Confirm the authoring-lifecycle ordering invariant (I15): a required stage transitions `draft` → `validated` only as the direct, current-run output of `validate-spec-output.cjs` and `spec-ground.cjs` (invoked read-only, A-D-08, never modified by this task) both completing cleanly over that stage's exact current bytes, strictly before the reviewer computes any digest claiming to cover it; any edit reverts the stage to `draft` until re-confirmed, treated identically everywhere it is read (C1's `authorized_evolution` check, the finalizer's C13 lineage). _Requirements: 3.7_
- [x] Add `validate-spec-output.cjs`'s fail-closed C16 freshness check: exit nonzero whenever an authoring stage reads `validated` with `validation.authoring_validation` absent, missing that field's entry, or digest-mismatched against current bytes, computed via the R0-01-owned shared `spec-authoring-digest.cjs` primitive (A-R1-01-10) — never a separate reimplementation. _Requirements: 3.8_
- [x] Build `packages/spec/src/claude/scripts/spec-authoring-validation.cjs` (C16/D13, new, sole atomic writer): construct an in-memory candidate spec.json, invoke the canonical `validate-spec-output.cjs` and `spec-ground.cjs` over that exact candidate's current bytes, compute the C16 digests via the shared primitive, and only on a fully clean pass atomically replace spec.json (write-temp-then-rename) with the updated `authoring.*` enum values and the fresh receipt written together; a failed or partial run leaves spec.json completely unchanged. Correct `spec-scaffold.cjs` in the same pass so it never itself writes `validated` for any authoring field (removing the asymmetric requirements/design preserve-on-migrate bug rather than patching it in place) — every scaffold-produced authoring state is `draft` or `absent`; only this coordinator may flip a stage to `validated`. _Requirements: 3.9_

## Acceptance

- **R3.1:** C2 closed set with separate verdict and lifecycle_disposition.
- **R3.4:** Unknown keys, wrong types, wrong nullability fail structural validation.
- **R3.6:** `semantic_review_history` closed key set including `review_epoch`; entries reference receipts by digest only, never duplicating findings; dedupe covers the whole lineage, not just the latest entry.
- **R8.3:** validate-spec-output.cjs's ownership-contention scan derives candidate pairs from the complete anchorsByTask projection, not from declared boundaries alone; R1-01 implements it as sole write-owner; R6-01 verifies only.
- **R3.7:** A required authoring stage becomes validated only via a current validator-plus-grounder pass over its own exact bytes; the reviewer's semantic_digest is computed only over already-validated bytes; any later edit reverts the stage to draft until re-confirmed, and a stale validated flag is treated as draft by every downstream consumer.
- **R3.8:** `validation.authoring_validation` (C16) has the exact per-stage digest shape (raw bytes for requirements/design; raw bytes or `RESEARCH_ABSENT_DIGEST` for research; ASCII-sorted stable-JSON bundle or `TASKS_ABSENT_DIGEST` for tasks), non-circular; `validate-spec-output.cjs` fails closed whenever a stage reads `validated` without a matching fresh digest.
- **R3.9:** `spec-authoring-validation.cjs` is the sole atomic writer of any stage's `validated` transition together with the C16 receipt, all-or-nothing over an in-memory candidate proven clean; `spec-scaffold.cjs` never itself writes `validated` for any authoring field.

## Dependencies

- tasks/task-R0-01-change-firewall-choke.md

## Verification Plan

- **Verification ref:** V2
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test review-receipt-c2.semantic-firewall.test.js`
- **Expected:** Exit 0 for C2 fixtures including verdict vs disposition separation and C13 semantic_review_history exact keys including `review_epoch`, with whole-lineage digest dedupe; ownership-contention scan derives candidate write/write pairs from the complete anchorsByTask projection and passes on this feature's own topology; a required authoring stage marked validated only after this validator and spec-ground.cjs both complete cleanly over its current bytes, reverting to draft on any later edit; `spec-authoring-validation.cjs` atomically writing a stage's `validated` transition together with its exact C16 digest only on a fully clean candidate pass, with a failed/partial run leaving spec.json completely unchanged; `validate-spec-output.cjs` failing closed on a `validated` reading with an absent or digest-mismatched C16 receipt; dedicated basename required.
- **Negative path:** Receipt missing lifecycle_disposition on completed, history entry missing `review_epoch` or duplicating findings, a replay matching an older (non-latest) entry being appended anyway, a same-target write/write pair named in no coordination.boundaries entry going undetected, a stage left/read as validated while its bytes diverge from the last validator/grounder-confirmed bytes, a validated enum accepted despite an absent or digest-mismatched C16 receipt, or a simulated partial coordinator run leaving the enum flipped without the matching receipt (or vice versa) instead of spec.json unchanged, fails.
- **Reachability:** `packages/spec/src/claude/scripts/validate-spec-output.cjs`
