# Task 02 — Legacy exports and spec-final-state removed; Codex/omp upgrades delete obsolete scripts

Status: done

## Outcome
`spec-resolver.cjs` and `spec-receipt.cjs` export only process-first functions plus `findLegacyPackets`; `spec-final-state.cjs` is deleted and obsolete; reinstalling Claude, Codex or omp deletes obsolete `scripts/` files.

## Scope
- In: delete `inspectFeature`, `scanSpecs`, `resolveActiveSpec`, `resolvePersistedSpec`, `findAllActiveSpecs`, `findAllSpecCandidates`, `normalizeLegacyWorkflowCandidate` and helpers only they use; delete `checkTaskReceipt`, `checkFeatureReceipt`, `readTaskProof` and helpers only they use; delete `spec-final-state.cjs`; manifest `scripts.required` and `obsolete.runtimeFiles`; let `removeObsoleteCodexHooks` (`packages/spec/bin/phases/codex-runtime.js:34`) and `removeObsoleteOmpHooks` (`omp-runtime.js:139`) also remove `scripts/` entries; update remaining direct callers of removed exports in tests and fixture lists copying `spec-final-state.cjs`.
- Out: `workflow-policy.cjs` (task 03).

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/claude/scripts/spec-resolver.cjs`, `spec-receipt.cjs`, `packages/spec/src/claude/migration-manifest.json`, `packages/spec/bin/phases/codex-runtime.js`, `omp-runtime.js`
- Delete: `packages/spec/src/claude/scripts/spec-final-state.cjs`
- Modify tests: `spec-narrowing.test.js` (`resolvePersistedSpec` calls at `:209`, `:229`, `:239`, `:265`), `validator-grounding.test.js` (`:84-104`), `develop-contract.test.js` (`:1136` and remaining Codex adapter calls), `specs-v2-execution-closeout.test.js`, `test-runtime-dependency-closure.cjs`, `codex-hooks.test.js`, `spec-gate.test.js`, `package-inventory.test.js`, `legacy-hooks-retired.test.js`, `codex-native.test.js` (new reinstall test)

## Steps
1. Snapshot test names.
2. Delete the legacy exports and `spec-final-state.cjs`; update manifest, fixtures and direct test callers → the Acceptance check prints `0`.
3. Extend the Codex and omp obsolete passes to `scripts/`; add a reinstall test planting `.codex/scripts/spec-final-state.cjs` and `.omp/scripts/spec-final-state.cjs`, expecting both gone and kept scripts present.
4. Snapshot again and diff.

## Acceptance
- AC-04: `node -e "const r=require('./packages/spec/src/claude/scripts/spec-resolver.cjs'),c=require('./packages/spec/src/claude/scripts/spec-receipt.cjs');console.log(['resolveActiveSpec','resolvePersistedSpec','findAllActiveSpecs'].filter(k=>k in r).concat(['checkTaskReceipt','checkFeatureReceipt','readTaskProof'].filter(k=>k in c)).length, typeof r.findLegacyPackets)"` prints `0 function`; the reinstall test passes; a local Claude reinstall leaves no `.claude/scripts/spec-final-state.cjs`.

## Dependencies
- task-01-runtime-reads.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js && pnpm --dir packages/spec test`
- Named probe: the new Codex/omp reinstall test in `codex-native.test.js`; `codex-hooks.test.js` "Codex process-v3 Stop accepts two completed packets with valid Receipts"; self-test "shared resolver keeps explicit target and fail-closed ambiguity".
- Reachability: hooks require these modules; installer tests spawn `bin/install.js`.
- Oracle: both suites pass with 0 failures; the export check prints `0 function`.
- Counterexample: a hook still requiring `spec-final-state.cjs` fails with MODULE_NOT_FOUND; an omp upgrade leaving the script fails the reinstall test.
- Artifacts: name lists in scratchpad (ephemeral), diff in Receipt output.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: `node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js && pnpm --dir packages/spec test`
Exit: 0
Base: 5b4305a7e677dbbe404b010b5572c9bb83f78147
Head: 7b9f7ecb92be220778147c6ef42056c8f04027fa4e57a060316b2ff46b898c41
```text
$ node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js && pnpm --dir packages/spec test
# tests 531
# suites 0
# pass 531
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

Review: code-auditor PASS_WITH_WARNINGS (round 1: the symlinked recorded-feature test still used a legacy fixture and passed vacuously) then PASS after repair round 1; a mutation that removed both symlink checks in readActiveFeatureTarget made that test fail, removing only isSymlink did not (isFile on the lstat result already rejects a symlink). Export check printed "0 function"; a local Claude reinstall left no .claude/scripts/spec-final-state.cjs; the new Codex/omp reinstall test failed before the installer change (change-firewall.cjs, then spec-final-state.cjs left behind) and passes after. Step 1 snapshot was skipped: removed tests are taken from the edits and checked by the reviewer against HEAD (29 removed or renamed across both tasks = 20 in task 01 + 9 here): spec-narrowing closeout-approval tests for resolvePersistedSpec and "a payload target beats the recorded file" (no gate-level equivalent existed at HEAD either), specs-v2-execution-closeout separate-receipt and legacy-receipt provenance tests (inline equivalents: spec-gate tests 27, 31, 37-50), validator-grounding resolver identity test renamed to plan aliases. Limitations: no test for two inline Receipt headings, no gate-level test of payload-over-recorded-file order, the reinstall test does not cover tracker pruning or dry-run for scripts/, nothing stops a scripts/ entry listed as obsolete from being shipped again.
