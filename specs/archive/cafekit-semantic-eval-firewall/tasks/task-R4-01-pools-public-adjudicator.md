# Task R4-01: Pools public fixtures and adjudicator
**Status:** pending

## Outcome

Declare 8/8/8 pool governance, own the in-repo public regression interface manifest and exactly eight fixture bodies, exclude B1 and private or sealed payloads from ship inventory, separate runner telemetry from independent adjudication records under candidate isolation, and invoke C15 `classifyFailure` as a consumer after producing a fresh adjudication record for an opened benchmark failure. R4-01 lands after the boot-window (D11/I9): its protected-path writes are authorized via `authorized_evolution` bound to the latest accepted PASS in the lineage (ordinarily the seed entry, I14).

## Scope

- **In scope:** corpus and pool schemas, public-regression.interface.json, public-regression.manifest.json, public-fixture-PR-01 through PR-08, inventory and copy-payload ship exclusions, candidate-isolation helper, adjudication schema and entry, owned package-inventory modifications and public-pool-loader.semantic-firewall.test.js, `classifyFailure` invocation after a fresh C5 adjudication. R4-01 lands only after R1-02 and after loading C10 proves post-cutover `bootstrapBaseline` generation 0 bound to the seed PASS; task dependencies alone never authorize protected writes.
- **Out of scope:** Creating private or sealed bodies and release gate ordering details beyond isolation; writing to `benchmark-failure-ledger.json` directly (R0-01 is the sole file writer; R4-01 only calls the exported transition function).

## Anchors and Ownership

| ID | Type | Target | Role | Access | Action |
|---|---|---|---|---|---|
| A-R4-01-01 | file | `packages/spec/benchmarks/corpus.schema.json` | owner | write | modify |
| A-R4-01-02 | file | `packages/spec/benchmarks/pool-governance.schema.json` | owner | write | create |
| A-R4-01-03 | file | `packages/spec/benchmarks/public-regression.interface.json` | owner | write | create |
| A-R4-01-04 | file | `packages/spec/benchmarks/public-regression.manifest.json` | owner | write | create |
| A-R4-01-05 | file | `packages/spec/benchmarks/public-fixture-PR-01.json` | owner | write | create |
| A-R4-01-06 | file | `packages/spec/benchmarks/public-fixture-PR-02.json` | owner | write | create |
| A-R4-01-07 | file | `packages/spec/benchmarks/public-fixture-PR-03.json` | owner | write | create |
| A-R4-01-08 | file | `packages/spec/benchmarks/public-fixture-PR-04.json` | owner | write | create |
| A-R4-01-09 | file | `packages/spec/benchmarks/public-fixture-PR-05.json` | owner | write | create |
| A-R4-01-10 | file | `packages/spec/benchmarks/public-fixture-PR-06.json` | owner | write | create |
| A-R4-01-11 | file | `packages/spec/benchmarks/public-fixture-PR-07.json` | owner | write | create |
| A-R4-01-12 | file | `packages/spec/benchmarks/public-fixture-PR-08.json` | owner | write | create |
| A-R4-01-13 | file | `packages/spec/bin/__tests__/package-inventory.test.js` | owner | write | modify |
| A-R4-01-14 | file | `packages/spec/bin/phases/copy-payload.js` | owner | write | modify |
| A-R4-01-15 | file | `packages/spec/benchmarks/adjudication-record.schema.json` | owner | write | create |
| A-R4-01-16 | file | `packages/spec/scripts/benchmark-adjudicate.mjs` | owner | write | create |
| A-R4-01-17 | file | `packages/spec/scripts/candidate-isolation.mjs` | owner | write | create |
| A-R4-01-18 | file | `packages/spec/bin/__tests__/public-pool-loader.semantic-firewall.test.js` | owner | write | create |
| A-R4-01-19 | file | `packages/spec/src/claude/scripts/change-firewall.cjs` | consumer | read | read |
| A-R4-01-20 | file | `packages/spec/benchmarks/benchmark-failure-ledger.json` | consumer | read | read |
| A-R4-01-21 | file | `packages/spec/scripts/benchmark-workflow.mjs` | consumer | read | read |
| A-R4-01-22 | file | `packages/spec/src/claude/scripts/spec-readiness.cjs` | consumer | read | read |
| A-R4-01-23 | file | `packages/spec/reports/bootstrap-activation.json` | consumer | read | read |
| A-R4-01-24 | file | `packages/spec/reports/adjudication-nonce-ledger.json` | owner | write | create |
| A-R4-01-25 | file | `packages/spec/benchmarks/adjudication-nonce-ledger.schema.json` | owner | write | create |
| A-R4-01-26 | file | `packages/spec/benchmarks/sealed-exposure-pointer.schema.json` | owner | write | create |
| A-R4-01-27 | file | `packages/spec/scripts/sealed-governance.mjs` | owner | write | create |
| A-R4-01-28 | file | `packages/spec/benchmarks/sealed-exposure-ledger.schema.json` | owner | write | create |

## Changes

- [ ] Keep only public interface fixtures and contracts in this repository. _Requirements: 5.1_
- [ ] Declare 8/8/8 pools; own eight typed public fixtures; validate the exact external-ledger schema through the fixed untracked pointer and explicit absolute-file CLI contract, enforcing per-RC rotation, zero tuning access, predecessor chain, and two-published-release retirement delay without HOME/cwd fallback. _Requirements: 5.2_
- [ ] Emit exact pre-mutation-contained D7 CandidateRunRecord; aggregate every artifact deterministically; atomically consume C5 freshness nonce in the fixed durable ledger; require the same run/candidate/failure/corpus/artifacts/reviewer bindings before release inputs. _Requirements: 5.3_
- [ ] Exclude B1 and private or sealed payloads from npm product ship set. _Requirements: 5.4_
- [ ] Prove public loaders reject private or sealed paths and inventory excludes B1 with a negative control. _Requirements: 5.5_
- [ ] After openFailure, pass canonical fresh C5 bytes to classifyFailure/reclassifyFailure; require C15 to recompute the digest and verify exact run/candidate/failure/evidence/reviewer/freshness bindings; refuse bare digests, replay, cross-run/candidate use, stale class, or post-resolution correction. _Requirements: 5.6_

## Acceptance

- **R5.1:** Private and sealed bodies are not stored under the package tree.
- **R5.2:** Public interface and manifest list exactly 8 typed slots with domain-neutral answer_pattern contracts; sealed generation rotates every RC, never feeds tuning, and retires to public only after two completed releases. The explicit absolute external-ledger file must match the fixed untracked pointer and exact closed ledger schema; no environment/cwd/HOME lookup is allowed.
- **R5.3:** Runner alone cannot set release ready; a realpath-contained D7 CandidateRunRecord and fresh exact-bound C5 bytes are required, while candidate payloads omit arm/oracle/expected-answer fields.
- **R5.4:** B1 is not an npm product ship surface.
- **R5.5:** Owned tests fail closed on private body path and on B1 ship inclusion attempts.
- **R5.6:** Classification accepts only recomputed canonical C5 bytes with exact live bindings; bare/stale/replayed/cross-boundary records and post-resolution corrections are refused.

## Dependencies

- tasks/task-R0-01-change-firewall-choke.md
- tasks/task-R1-02-finalizer-pass-gate.md
- tasks/task-R1-03-bootstrap-activation.md

## Verification Plan

- **Verification ref:** V6
- **Task role:** subject
- **Command:** `node packages/spec/scripts/run-skill-self-tests.mjs --require-semantic-test public-pool-loader.semantic-firewall.test.js`
- **Expected:** Exit 0; public interface length 8; eight bodies load; B1 excluded; private path rejected; classifyFailure invoked with a fresh adjudication_digest; a pre-resolution reclassifyFailure correction with a fresh adjudication_digest and matching previous_primary_failure_class accepted and immediately reflected by deriveFailureState; dedicated basename required and executed.
- **Negative path:** Adding a sealed body under packages/spec/benchmarks fails closed in owned tests; classifyFailure accepted with a stale/reused adjudication_digest fails; reclassifyFailure accepted with a mismatched previous_primary_failure_class, a reused/stale adjudication_digest, or against an already-resolved failure_id fails.
- **Reachability:** `packages/spec/scripts/candidate-isolation.mjs` → `packages/spec/scripts/benchmark-adjudicate.mjs` → C15 classifyFailure/reclassifyFailure
