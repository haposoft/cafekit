# Task 01 — Resolver and Claude + Codex hooks read only process-first packets

Status: done

## Outcome
The resolver returns only process-first packets (a dir with `plan.md` and `spec.json` counts as process-first) and exports `findLegacyPackets`; Claude and Codex `spec-gate`, `spec-state` and `precompact` contain no legacy branch or legacy-export guard; `spec-state` prints the legacy notice once per session; malformed process-first packets still block Stop; every test built on a `spec.json` fixture is rewritten on a process-first fixture or deleted per D-05. Legacy exports still exist (removed in task 02).

## Scope
- In, resolver (`packages/spec/src/claude/scripts/spec-resolver.cjs`): drop the legacy merge in `resolveWorkflowCandidate` (`:885-891`, `:907-930`) and the `legacyPresent` short-circuit (`:224-226`, `:810`, `:899`); `readActiveFeatureTarget` (`:510`) yields no target when the named dir holds `spec.json` and no `plan.md`, while a missing dir still yields `explicit_not_found`; add `findLegacyPackets(projectRoot, runtime)` (existence checks only, via `specsDirectory`); keep the self-test-pinned strings (`packages/spec/scripts/run-skill-self-tests.mjs:4877-4885`).
- In, Claude hooks: `spec-gate.cjs` drops the 2.1 closeout block, stale Flash check, `checkTaskReceipt`/`checkFeatureReceipt`/`completionDecisionForSpec` use, their load guards (`:99-104`) and legacy fix hints, and keeps the `invalid_specs` branch (`:164-170`) reworded "invalid workflow packet"; `spec-state.cjs` drops the `resolveActiveSpec` fallback (`:182`), `flashState`, `feature-receipt.md` read and `spec.json` advice, and prints the notice from `findLegacyPackets` before resolve and before the touch filter (`:186`, `:213`), once per session via a memo in `hookStateDir`; `precompact.cjs` stays workflow-only.
- In, Codex hooks: the same in `src/codex/hooks/spec-gate.cjs` (`:48` guard, `:105-222`, `taskStatusMap`, `checkReceiptDetails`, `spec.json` fallback `:117`) and `spec-state.cjs` (`:63-166`, fallback `:67`); remove `resolveActiveSpec`, `findActiveSpec`, `findAll*`, the `:69` guard and fallback (`:106-112`) from `lib/spec-utils.cjs`; remove `checkTaskReceipt`/`checkReceipt`/`checkFeatureReceipt` adapters and the `:40` guard from `lib/spec-receipt.cjs`.
- In, tests: every test that builds a `spec.json` fixture in `spec-gate.test.js`, `codex-hooks.test.js`, `develop-contract.test.js`, `legacy-authority-decoupled.test.js`, `spec-narrowing.test.js`, `specs-v2-execution-closeout.test.js` is rewritten on a process-first fixture when its subject is receipt/provenance logic (for example `spec-gate.test.js` tests 13–17), or deleted when its subject is legacy-only (2.1 closeout, separate `receipts/`, `feature-receipt.md`); add the new tests in Steps.
- Out: deleting legacy exports and `spec-final-state.cjs` (task 02); `workflow-policy.cjs` (task 03); instruction text (task 04).

## Coverage
- CP-01, CP-02, CP-03

## Ownership
- Modify: `packages/spec/src/claude/scripts/spec-resolver.cjs`
- Modify: `packages/spec/src/claude/hooks/spec-gate.cjs`, `spec-state.cjs`, `precompact.cjs`
- Modify: `packages/spec/src/codex/hooks/spec-gate.cjs`, `spec-state.cjs`, `lib/spec-utils.cjs`, `lib/spec-receipt.cjs`
- Modify tests: `packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`, `spec-state-touched.test.js`; `packages/spec/bin/__tests__/codex-hooks.test.js`, `develop-contract.test.js`, `legacy-authority-decoupled.test.js`, `spec-narrowing.test.js`, `specs-v2-execution-closeout.test.js`

## Steps
1. Snapshot test names: `node --test --test-reporter=spec <Command files> > before.txt` in the scratchpad.
2. Edit the resolver → a planted `specs/old/spec.json` is not returned and `findLegacyPackets` lists `old`.
3. Edit the Claude and Codex hooks → `grep -nE "completionDecisionForSpec|checkTaskReceipt|checkFeatureReceipt|checkReceiptDetails|resolveActiveSpec|findActiveSpec|taskStatusMap|flashState|isStaleFlashDone|feature-receipt|schema_version|receipts/|spec\.json" packages/spec/src/claude/hooks/{spec-gate,spec-state,precompact}.cjs packages/spec/src/codex/hooks/*.cjs packages/spec/src/codex/hooks/lib/*.cjs` prints nothing.
4. Rewrite or delete legacy-fixture tests per D-05; record each deleted test name and reason.
5. Add tests (Claude and Codex each): notice once across two prompts of one session; notice when the legacy packet is the only packet; Stop stdout `''` with only a legacy packet and with `active-feature.json` naming it; `active-feature.json` naming a missing dir still blocks with `explicit_not_found`; a process-first packet with a dependency cycle and a done task blocks Stop; a hybrid dir with an unreceipted done task blocks Stop.
6. Snapshot again; diff names.

## Acceptance
- AC-01: the name diff shows only rewritten (same subject, process-first fixture), deleted-with-reason and new tests; all pass.
- AC-02, AC-03: the Step 5 tests pass for Claude and Codex; the Step 3 grep is empty.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/*.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/develop-contract.test.js packages/spec/bin/__tests__/legacy-authority-decoupled.test.js packages/spec/bin/__tests__/spec-narrowing.test.js packages/spec/bin/__tests__/specs-v2-execution-closeout.test.js && pnpm --dir packages/spec test`
- Named probe: `codex-hooks.test.js` "Codex completion gate validates explicit process-v3 inline Receipt" and "Codex process-v3 Stop accepts two completed packets with valid Receipts" (process-first, kept as is); `spec-gate.test.js` tests 13–17 rewritten on process-first fixtures; the Step 5 tests.
- Reachability: tests spawn the Claude and Codex hooks with copied runtimes; `pnpm test` runs every suite and the self-test pin on the resolver.
- Oracle: all pass with 0 failures; the Step 3 grep is empty; the name diff matches Step 4's record.
- Counterexample: a resolver that still merges legacy candidates fails the "only legacy packet → Stop silent" test; a gate without the `invalid_specs` branch fails the cycle test.
- Artifacts: `before.txt`/`after.txt` in the scratchpad (ephemeral), diff quoted in the Receipt output.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/*.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/develop-contract.test.js packages/spec/bin/__tests__/legacy-authority-decoupled.test.js packages/spec/bin/__tests__/spec-narrowing.test.js packages/spec/bin/__tests__/specs-v2-execution-closeout.test.js && pnpm --dir packages/spec test`
Exit: 0
Base: 5b4305a7e677dbbe404b010b5572c9bb83f78147
Head: 7b9f7ecb92be220778147c6ef42056c8f04027fa4e57a060316b2ff46b898c41
```text
$ node --test packages/spec/src/claude/hooks/__tests__/*.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/develop-contract.test.js packages/spec/bin/__tests__/legacy-authority-decoupled.test.js packages/spec/bin/__tests__/spec-narrowing.test.js packages/spec/bin/__tests__/specs-v2-execution-closeout.test.js && pnpm --dir packages/spec test
# tests 299
# suites 0
# pass 299
# fail 0
# cancelled 0
# skipped 0
# todo 0
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

Review: code-auditor FAIL (round 1: 2 Codex Step 5 tests missing, unread cache schema_version matched the Step 3 grep, test 18 pass cases not in binding mode) then PASS after repair round 1. Step 3 grep over the Claude and Codex hooks prints nothing. Test-name diff against the pre-change snapshot: 20 removed, each legacy-only (completed_at, legacy read-compat, registry path escape, deleted task with spec.json done, malformed spec.json, 2.1 closeout x2, legacy mid-execution x2, Strict closeout x2, registry FLASH_UNVERIFIED, feature-receipt closeout, unproven dependency on a spec.json registry (covered by develop-contract workflowDependencyProofState and codex-hooks), legacy narrowing x4, Codex cache case renamed after dropping its deleted-task sub-case); 14 added; receipt, provenance, artifact, placeholder, phantom-vector and containment tests kept their names on process-first fixtures. New tests run against HEAD source: 11 of 12 fail there; the missing-dir explicit_not_found test passes on both (preservation). One resolver containment test no longer matches the legacy reason text "canonicalization error"; it still asserts explicit_malformed. Limitations kept out of scope: Codex result.body is never set (pre-existing), a payload without a session id repeats the notice each prompt, a plan.md packet whose tasks live only in nested tasks/ stays invisible.
