# Task R1-02: Finalizer pass gate and cutover proof
**Status:** in_progress

## Outcome

Replace unconditional readiness promotion with C3 rules: derive `review_epoch` as the count of prior PASS entries in the same `semantic_review_history` lineage, and repair_round as the C13 `attempt_index` scoped to that epoch (count of prior FAIL entries since the last PASS, or since lineage start when no PASS has occurred yet, 0..2), atomically append the current completed receipt to that history with the readiness decision (idempotent on a replayed digest), separate lifecycle disposition BLOCKED at index 2 of an epoch (terminal, never reopened), promote only on PASS with CONTINUE (closing the epoch), reject any caller-supplied repair_round/review_epoch/history/lineage_id that diverges from the finalizer-derived state. R1-02 lands under the legacy-bridge boot-window (D11/I9, third of the three exempt tasks); once it lands, a fresh, real, post-cutover review must PASS on the then-current digest to seed this same history at `sequence 0`/`review_epoch 0` before `bootstrapBaseline` (R0-01) may run.

## Scope

- **In scope:** spec-readiness.cjs and final-state; finalizer-pass-gate.semantic-firewall.test.js with promote/refuse, attempt-index, index-2 BLOCKED.
- **Out of scope:** IR promote bit (R5), pools, coding while ready=false.

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R1-02-01 | file | `packages/spec/src/claude/scripts/spec-readiness.cjs` | owner | write | modify |
| A-R1-02-02 | file | `packages/spec/src/claude/scripts/spec-final-state.cjs` | owner | write | modify |
| A-R1-02-03 | file | `packages/spec/bin/__tests__/finalizer-pass-gate.semantic-firewall.test.js` | owner | write | create |
| A-R1-02-04 | file | `packages/spec/src/claude/scripts/spec-semantic-model.cjs` | consumer | read | read |
| A-R1-02-05 | file | `packages/spec/src/claude/scripts/validate-spec-output.cjs` | consumer | read | read |
| A-R1-02-06 | file | `packages/spec/bin/__tests__/specs-v2-validator-grounder-contract.test.js` | consumer | read | read |

## Changes

- [x] Promote ready true only on C2 PASS with lifecycle CONTINUE, zero blockers, fresh digest, clean validate and ground; "clean validate" is satisfied only by `validate-spec-output.cjs`'s own exit code, which already fails closed on a stale C16 authoring receipt (R1-01, A-R1-02-05 consumer anchor) — the finalizer does not reimplement a separate authoring-freshness check. _Requirements: 3.2_
- [x] Derive `review_epoch` as the count of prior PASS entries in the lineage, and repair_round as C13 attempt_index from the FAIL-count since the last PASS within that same epoch (0/1/2 = first/second/third attempt of the epoch); FAIL at 0/1 ready false; FAIL at 2 (third attempt of the epoch) disposition BLOCKED, ready false, blocking a fourth attempt of that epoch from ever occurring, epoch never reopened; before deriving or appending anything, first check whether the current epoch's latest recorded entry already shows lifecycle_disposition BLOCKED and refuse the whole operation outright if so (no attempt_index computed, no entry appended); PASS closes the epoch; atomically append current receipt to history, deduping against any existing entry anywhere in the lineage (not only the latest); reject caller-supplied repair_round/review_epoch/history/lineage_id divergence outright. _Requirements: 3.3_
- [x] Own promote/refuse matrices including index-2 BLOCKED (epoch-terminal) and negative-control legacy incomplete. _Requirements: 3.5_

## Acceptance

- **R3.2:** Finalizer sole ready true writer on PASS CONTINUE; promotion is refused whenever `validate-spec-output.cjs` exits nonzero, including on a stale C16 authoring receipt (R3.8/I20), with no separate finalizer-side digest check.
- **R3.3:** review_epoch and attempt_index derived correctly from durable history (epoch-scoped, not whole-lineage FAIL count); index-2 (third attempt of the epoch) BLOCKED stop blocks a fourth attempt of that epoch, never reopened; an explicit reject-before-append check refuses the whole operation outright (no attempt_index computed, no entry appended) whenever the current epoch's latest entry is already BLOCKED; caller divergence rejected, not silently ignored.
- **R3.5:** Owned tests cover promote, refuse, and disposition separation.

## Dependencies

- tasks/task-R1-01-review-receipt-schema.md

## Verification Plan

- **Verification ref:** V3
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test finalizer-pass-gate.semantic-firewall.test.js`
- **Expected:** Exit 0; review_epoch derived from the count of prior passing entries, attempt index 0/1/2 derived from the count of prior non-passing entries within that same epoch; an explicit reject-before-append check refusing the whole operation outright — no attempt_index computed, no entry appended — before any other processing when the current epoch's latest entry already shows the stop disposition; input repair_round/review_epoch/history/lineage_id rejected; index-2 lifecycle stop disposition leaves ready false and the epoch never reopens; replayed receipt digest not appended twice.
- **Negative path:** Attempt after index-2 stop disposition promoting ready, attempt_index silently computed (e.g. index 3) or an entry silently appended against an epoch already at the stop disposition instead of the whole operation being refused outright, attempt_index computed across epochs instead of within one, or a caller-supplied repair_round/review_epoch being silently accepted, is treated as a defect by owned tests.
- **Reachability:** `packages/spec/src/claude/scripts/spec-readiness.cjs`
