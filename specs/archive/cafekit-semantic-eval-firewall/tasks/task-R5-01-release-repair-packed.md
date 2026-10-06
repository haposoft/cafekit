# Task R5-01: Release gates repair budget and packed parity
**Status:** pending

## Outcome

Enforce ordered release gates with correctness before efficiency, bind the third-attempt-of-the-epoch stop (blocking any fourth attempt) to ready false, require Claude and Codex matrix membership, honest host-blocked outcomes, packed parity checks, the C12 ReleaseReceipt exact contract (including `resolvedFailureIds`) with an independently re-hashed artifact that gates advanceBaseline, invoke C15 `resolveFailure` as a consumer for each resolved framework_regression id — passing only `failure_id`/`decision_digest` and never a digest or membership claim, since `resolveFailure` independently self-verifies both against the receipt `advanceBaseline` persists (I13) — an IR mode promote write governed by an exact gate list with non-sticky rollback, enforce that the final freeze/receipt/advanceBaseline sequence never runs until every task R0-01..R6-01 has landed and every D8 gate has passed (no partial R0/R1 publish, D11/I9), and list every R5 proof write target in ownership.

## Scope

- **In scope:** Release decision assembly on adjudication outputs; C12 release-receipt schema and emission with an independently re-hashed npm .tgz artifactDigest and exact `resolvedFailureIds`; `resolveFailure` invocation (consumer of R0-01's C15 API) for every resolved id after advanceBaseline succeeds; exact IR promote-transition gate list and non-sticky rollback wiring; repair_round stop coverage bound to readiness, scoped to the current review_epoch; packed parity tests; promote write to semantic-ir-mode.json only after every exact gate passes; the no-partial-publish gate (every task landed, every D8 gate passed on the same candidate before the final freeze/receipt/advance); sequential writes to benchmark-workflow.mjs and develop-contract.test.js after R0-01's and R4-02's own prior edits respectively (per matching dependency boundaries); sequential write to benchmark-adjudicate.mjs after R4-01; create release-gates-packed.semantic-firewall.test.js; extend develop-contract tests; any additional R5-created proof artifacts must appear in this task ownership table and write_set.
- **Out of scope:** Live sealed execution against private data and npm publish beyond prepack hooks owned by R0; advancing baseline during candidate verification (advanceBaseline itself is R0-01's); writing to `benchmark-failure-ledger.json` directly (R0-01 is the sole file writer; R5-01 only calls the exported `resolveFailure` transition).

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R5-01-01 | file | `packages/spec/scripts/benchmark-adjudicate.mjs` | owner | write | modify |
| A-R5-01-02 | file | `packages/spec/scripts/benchmark-workflow.mjs` | owner | write | modify |
| A-R5-01-03 | file | `packages/spec/src/claude/scripts/semantic-ir-mode.json` | owner | write | modify |
| A-R5-01-04 | file | `packages/spec/bin/__tests__/release-gates-packed.semantic-firewall.test.js` | owner | write | create |
| A-R5-01-05 | file | `packages/spec/bin/__tests__/develop-contract.test.js` | owner | write | modify |
| A-R5-01-06 | file | `packages/spec/benchmarks/release-decision.schema.json` | owner | write | create |
| A-R5-01-13 | file | `packages/spec/benchmarks/release-receipt.schema.json` | owner | write | create |
| A-R5-01-07 | file | `packages/spec/scripts/benchmark-adjudicate.mjs` | consumer | read | read |
| A-R5-01-08 | file | `packages/spec/src/claude/scripts/spec-readiness.cjs` | consumer | read | read |
| A-R5-01-09 | file | `packages/spec/src/claude/scripts/spec-semantic-ir.cjs` | consumer | read | read |
| A-R5-01-10 | file | `packages/spec/src/claude/scripts/semantic-ir-mode.json` | consumer | read | read |
| A-R5-01-11 | file | `packages/spec/benchmarks/metamorphic-relations.schema.json` | consumer | read | read |
| A-R5-01-12 | file | `packages/spec/benchmarks/release-baseline.json` | consumer | read | read |
| A-R5-01-14 | file | `packages/spec/scripts/benchmark-workflow.mjs` | consumer | read | read |
| A-R5-01-15 | file | `packages/spec/bin/__tests__/develop-contract.test.js` | consumer | read | read |
| A-R5-01-16 | file | `packages/spec/benchmarks/benchmark-failure-ledger.json` | consumer | read | read |
| A-R5-01-17 | file | `packages/spec/src/claude/scripts/change-firewall.cjs` | consumer | read | read |
| A-R5-01-18 | file | `packages/spec/src/claude/scripts/migration-receipt-chain.cjs` | consumer | read | read |

## Changes

- [ ] Emit exact C7 candidate/run/adjudication bindings and all eight closed evidence variants with their canonical PASS predicates; fail closed on missing/stale/mismatched evidence; evaluate correctness before cost; require zero additional hard failures and candidate aggregate score greater than or equal to the frozen baseline; force stop when non-PASS at repair_round index 2 sets lifecycle disposition BLOCKED with ready false. _Requirements: 6.1_
- [ ] Require Claude and Codex; keep Grok optional non-acceptance stress. _Requirements: 6.2_
- [ ] Record host-blocked or not-ready when host evidence is missing without simulated PASS. _Requirements: 6.3_
- [ ] Assert packed Claude and Codex parity or concrete host blocker without silent divergence. _Requirements: 6.4_
- [ ] Emit a C12 ReleaseReceipt with exact keys including `resolvedFailureIds` set to the exact sorted-set equal of the current freeze's `remediatedFailureIds` (R1.12 — never independently chosen at receipt-authoring time), an explicit `artifactPath` restricted to `packages/spec/.cafekit-release/`, and call `advanceBaseline` with it — relying on `advanceBaseline`'s own hardened idempotency check (verifies or idempotently repairs canonical receipt evidence, never a blind no-op on digest match alone), its own `resolvedFailureIds`-vs-`remediatedFailureIds` equality check, its own durable receipt-bytes persistence as event (A) before its authority rename as event (B) (R1.13), and single invocation covering both events (R0-01-owned, R1.11/R1.12/R1.13) rather than re-implementing any retry, equality, or persistence logic in this task's orchestration code; never call `resolveFailure` before `advanceBaseline` has returned success. _Requirements: 6.5_
- [ ] Flip IR mode from shadow to promote only when every ordered D8 gate has passed on the same candidate, a fresh C5 adjudication exists, Claude/Codex packed parity is confirmed, and the C11 shadow dual-run shows zero disagreement; on any promote-mode disagreement, roll mode back to shadow immediately and hard-fail that cycle's readiness (not sticky). _Requirements: 6.6_
- [ ] Strictly after `advanceBaseline` returns success, for each id in the receipt's non-empty `resolvedFailureIds`, invoke C15 `resolveFailure` passing only `failure_id` and the current C7 ReleaseDecision's `decision_digest` — never a `release_receipt_digest` this task computed itself, since `resolveFailure` independently re-reads the persisted receipt and re-derives that digest itself (I13), and never asserting `failure_id` membership on `resolveFailure`'s behalf; rely on `resolveFailure`'s own independent current-authority precondition, receipt self-verification, and per-id idempotency (R0-01-owned, R1.11/R1.13) for crash safety — this task's orchestration never adds its own reconciliation, digest-trust, or membership logic, it only calls the two functions in order and lets a retry re-invoke the same sequence. _Requirements: 6.7_
- [ ] Gate the final freeze/C12 receipt/advanceBaseline sequence on every task R0-01..R6-01 having landed and every D8 gate having passed on the same candidate; refuse a release receipt covering only the boot-window tasks. _Requirements: 6.8_

## Acceptance

- **R6.1:** C7 exact schema, all eight closed evidence key sets/PASS predicates, and same-run/same-candidate bindings are enforced; missing/stale evidence fails; non-inferiority allows equality but rejects any added hard failure or lower aggregate score; a non-pass at attempt_index 2 cannot promote and no fourth attempt is reached.
- **R6.2:** Grok-only green results cannot release.
- **R6.3:** Missing host evidence never becomes simulated PASS.
- **R6.4:** Silent packed divergence fails owned tests.
- **R6.5:** C12 receipt exact keys (including resolvedFailureIds exact-equal to freeze.remediatedFailureIds) enforced; field mismatch, a resolvedFailureIds divergence, or a mismatched/symlinked/missing artifact at `artifactPath` against current freeze/candidate blocks advanceBaseline with exit 2; a repeated call against an already-published receipt digest verifies (and idempotently repairs if lost/corrupt) canonical receipt evidence rather than blindly no-op'ing; advanceBaseline durably persists the validated receipt bytes (event A) before its authority rename (event B, R1.13).
- **R6.6:** Promote flip requires every exact gate on the same candidate; disagreement always rolls back to shadow, never sticky.
- **R6.7:** `resolveFailure` called only after `advanceBaseline` has returned, passing only `failure_id` and `decision_digest`; `resolveFailure` itself independently re-reads the persisted receipt bytes, recomputes the digest, confirms the current authority already shows this receipt as published, validates the exact C12 schema, and requires `failure_id` membership in the receipt's own `resolvedFailureIds` before it ever appends, and is a no-op on a matching-digest replay (I13).
- **R6.8:** Final freeze/receipt/advance refused until every task has landed and every D8 gate has passed; no partial R0/R1 publish.
- **Ownership:** Every path this task creates or modifies is listed above and in coordination write_set R5-01.

## Dependencies

- tasks/task-R0-01-change-firewall-choke.md
- tasks/task-R1-02-finalizer-pass-gate.md
- tasks/task-R3-01-ir-dual-run-wire.md
- tasks/task-R4-01-pools-public-adjudicator.md
- tasks/task-R4-02-metamorphic-mutation.md
- tasks/task-R6-01-migration-sequencing.md

## Verification Plan

- **Verification ref:** V8
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test release-gates-packed.semantic-firewall.test.js`
- **Expected:** Exit 0 for gate order, third-attempt-of-the-epoch stop bound to readiness (fourth attempt of that epoch never reached), matrix, parity or host-blocker fixtures, C12 receipt verification with re-hashed artifact and resolvedFailureIds exact-equal to the freeze's remediatedFailureIds, advanceBaseline called strictly before the resolveFailure loop, persisting the receipt bytes (event A) before its authority rename (event B), resolveFailure invoked with only failure_id/decision_digest (never a caller-computed digest) and independently re-verifying the persisted receipt plus failure_id membership before appending, only for classified-unresolved framework_regression ids, a simulated crash after event A but before event B resuming correctly from the staged unpublished receipt on retry, a simulated crash between event B and the resolveFailure loop recovering correctly on retry (each file written exactly once, no reconciliation command), a simulated loss/corruption of the canonical receipt file after event B being idempotently repaired from the supplied bytes on the next advanceBaseline retry rather than blindly no-op'ing, the no-partial-publish gate refusing a boot-window-only receipt, and promote-flip-only-under-exact-gates; dedicated basename required and executed.
- **Negative path:** A fourth attempt of the same epoch occurring after the third (index 2) stop still promoting ready, a mismatched or unverified-artifact C12 receipt advancing baseline, a resolvedFailureIds set diverging from the freeze's remediatedFailureIds advancing baseline, resolveFailure accepted for a non-framework_regression id or for an id absent from the persisted receipt's own resolvedFailureIds despite a correct current digest, a mismatched-digest replay for an already-resolved id being coerced or accepted instead of refused (a matching-digest replay succeeding as an idempotent no-op is expected and is not a defect), resolveFailure succeeding before advanceBaseline's event B has committed the receipt, advanceBaseline returning success on a digest match without verifying the canonical receipt is present and valid, an idempotent repair accepting supplied bytes that fail schema or digest verification, a retried advanceBaseline re-writing the authority record instead of idempotently no-op'ing, a boot-window-only release receipt advancing baseline, or a promote flip missing one exact gate, all fail the owned assertion.
- **Reachability:** `packages/spec/scripts/benchmark-workflow.mjs`
