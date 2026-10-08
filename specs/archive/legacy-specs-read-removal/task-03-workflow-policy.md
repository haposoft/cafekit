# Task 03 — workflow-policy keeps only the D-03 keep list

Status: done

## Outcome
`workflow-policy.cjs` exports exactly the D-03 keep list (`deriveRuntimeContext`, `validateCanonicalReceipt`, `receiptValidatorOptions`, `isTapMetadataHeading`, `executionPolicy`) and keeps the CLI path behind `--flash --parallel --json`; lane, planning-depth, assurance, approval-schema, independent-audit, Flash-registry and completion-decision code is gone.

## Scope
- In: delete every export and private helper not reached from the keep list or the kept CLI path; delete tests that only exercise removed exports (for example `POLICY.promoteFlashTask`, `consumeReviewVerdict`, `completionDecision*` cases in `packages/spec/bin/__tests__`).
- Out: behavior change in any kept export.

## Coverage
- CP-05

## Ownership
- Modify: `packages/spec/src/claude/scripts/workflow-policy.cjs`
- Modify tests: `packages/spec/bin/__tests__/develop-contract.test.js`, `package-inventory.test.js`, other `bin/__tests__` files calling removed exports, `packages/spec/scripts/run-skill-self-tests.mjs`

## Steps
1. Snapshot test names; `grep -rn "POLICY\.\|policy\." packages/spec/src packages/spec/bin --include=*.cjs --include=*.js | grep -v __tests__` → kept callers use only the keep list; a missing one is added to D-03 with its caller cited.
2. Delete everything outside the keep list → module loads; `node packages/spec/src/claude/scripts/workflow-policy.cjs --json` prints `execution-policy`.
3. Delete or trim tests of removed exports; snapshot again and diff.

## Acceptance
- AC-05: `node -e "const p=require('./packages/spec/src/claude/scripts/workflow-policy.cjs');const keep=['deriveRuntimeContext','validateCanonicalReceipt','receiptValidatorOptions','isTapMetadataHeading','executionPolicy'];const gone=['classifyLane','completionDecisionForSpec','approvalState','planningObligationsFor'];console.log(keep.every(k=>typeof p[k]==='function'), gone.filter(k=>k in p).length)"` prints `true 0`; `node packages/spec/src/claude/scripts/workflow-policy.cjs --flash --parallel --json` exits 2.

## Dependencies
- task-02-shared-exports.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js && pnpm --dir packages/spec test`
- Named probe: `develop-contract.test.js` probe for `--flash --parallel` rejection (near line 195); `package-inventory.test.js` "packed Claude and Codex installs self-contain runtime provenance and fail closed without it".
- Reachability: hooks, `spec-receipt.cjs` and the develop skill CLI call the module; tests run all three.
- Oracle: both suites pass; the `node -e` check prints `true 0`.
- Counterexample: dropping `validateCanonicalReceipt` makes the keep check print `false` and the gate receipt tests fail.
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

Review: code-auditor PASS_WITH_WARNINGS (round 1: the forged-context probe was deleted without a rewrite, the stale probe passed the freshly derived context, three orphan CLI comments) then PASS after repair round 1. AC-05 check printed "true 0"; --flash --parallel --json exits 2 from source and from the reinstalled .claude/scripts/workflow-policy.cjs (508 lines, was 2306); every kept function body matches HEAD except parseCliArgs and runCli, which only lost their non-execution-policy actions. Mutation checks on temporary edits, restored and compared with cmp: replacing the trust guard and recompute with a direct use of the passed context fails the provenance test; removing only isTrustedRuntimeContext still passes because recomputeRuntimeContext also refuses a copy. Test-name diff against the pre-change snapshot (552 -> 531): 24 removed (lane, approval, verdict adapter, completion decision, flash registry promote/sync-finalize, downgrade, workflow_policy snapshot/escalation/v1 migration tests, plus the old names of two ported tests), 3 added (Develop names the process-first packet as its only authority; review and sync skills keep the verdict vocabulary and the sync-finalize path; the placeholder/failure/artifact regression renamed without its lane probe). Three receipt tests lost only their --validate-receipt CLI calls; the same bodies are still asserted through validateCanonicalReceipt. Limitations: evals/sync fixtures already drift from source and no packet task owns evals/; artifactDeclaration keeps its legacy key aliases as a private helper of receiptValidatorOptions.
