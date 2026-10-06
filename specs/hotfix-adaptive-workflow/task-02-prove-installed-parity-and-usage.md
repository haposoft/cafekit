# Task 02 — Prove installed parity and document usage

Status: done

## Outcome
The adaptive hotfix contract survives projection into installed Claude and Codex layouts, its weakenings are rejected there too, and the repository and package guides describe the adaptive workflow.

## Coverage
- CP-05 (installed half), AC-06 guide surface

## Scope
- In: extend the Codex-native and packed-install regression tests so the adaptive hotfix invariants are checked in disposable installed copies of both projections; update hotfix usage wording in the repository and package guides.
- Out: new guide files; changes to `SKILL.md`, references, or the static harness beyond what task 01 authored; installer or projection code changes; timing or live-adherence claims.

## Ownership
- Modify: `packages/spec/bin/__tests__/codex-native.test.js`
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js`
- Modify: `README.md`
- Modify: `packages/spec/README.md`
- Read: `packages/spec/src/claude/skills/hotfix/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance
- AC-05: mutating a disposable installed copy of the hotfix contract (Claude projection and Codex projection) fails the matching regression with its exact issue set, while canonical source bytes remain untouched. No hotfix projection assertion exists today, so the parity checks are new additions to both suites; the assertion at `codex-native.test.js:823` belongs to the Brainstorm projection contract and stays unchanged.
- AC-06: `README.md` and `packages/spec/README.md` describe adaptive hotfix usage (depth selection, debug handoff, shared verdicts) without timing or live-adherence claims.

## Dependencies
- task-01-author-adaptive-hotfix-contract.md

## Verification Plan
- Command: `npm --prefix packages/spec test`
- Named probe: `Codex installed Fix preserves the adaptive repair contract`; `packed Claude and Codex installs reject adaptive Fix semantic weakenings`; `repository and package guides document adaptive Fix usage`; `hapo:fix adaptive contract is complete and bounded` (via the suite's static pass) — probe names re-approved 2026-08-30 after the public rename
- Reachability: `npm test -> bin/__tests__ suites -> disposable packed/native installs under mkdtemp -> installed readiness checks`
- Oracle: the full suite exits 0 on canonical bytes; each installed-copy mutation produces its exact nonempty issue set; zero executed tests or a skipped required probe is not a pass.
- Counterexample: an installed Codex copy that restores the numeric confidence score, or a packed Claude copy that drops the Delegation Gate condition, must fail its owning regression.
- Artifacts: none durable — installed copies live under a verified temporary root and are removed; canonical file SHA-256 values and `git status` must be identical before and after the command.

## Historical Receipt (stale, non-authoritative)

This receipt predates the public `Hotfix` → `Fix` rename and cannot authorize `done`.
Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 566d1696f2dededf015068dda1ae650b06141d93
Head: fe5c82fb10b24c4ef941a3799d436180e123909d37d44a9d4d5a9b498b2264a3
```text
$ npm --prefix packages/spec test
✔ hapo:hotfix adaptive contract is complete and bounded
✔ hapo:hotfix checker rejects 21 semantic weakenings
✔ Codex installed Hotfix preserves the adaptive fix contract (778.370209ms)
✔ packed Claude and Codex installs reject adaptive Hotfix semantic weakenings (8947.098042ms)
✔ repository and package guides document adaptive Hotfix usage (1.496375ms)
[skill-test] PASS: 1013 tests executed
Exit: 0
Reachability: npm test -> bin/__tests__ suites -> disposable native/packed installs under mkdtemp -> hotfixProjectionIssues/packedHotfixIssues.
Negative proof: 7 Codex-native mutations plus 2 platforms x 5 packed mutation groups (exercised coverage assertion = 10) each produced its exact issue set, including the confidence-score counterexample on installed copies.
Cleanup: installed mutations restored byte-exact under temporary roots; git status was identical before and after the command.
Review: PASS — code-auditor initial FAIL (1 High: installed confidence-score counterexample uncovered) was remediated with the prescribed negative check + mutation in both suites, verified by the same reviewer; 2 Low notes remain non-blocking.
```

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ npm --prefix packages/spec test
✔ hapo:fix adaptive contract is complete and bounded
✔ hapo:fix checker rejects 28 semantic weakenings
✔ Codex installed Fix preserves the adaptive repair contract
✔ packed Claude and Codex installs reject adaptive Fix semantic weakenings
✔ repository and package guides document adaptive Fix usage
[skill-test] PASS: 1167 tests executed
Exit: 0
Reachability: npm test -> bin/__tests__ suites -> disposable native/packed installs under mkdtemp -> hotfixProjectionIssues/packedHotfixIssues.
Negative proof: Codex-native mutations plus 2 platforms x 5 packed mutation groups (coverage assertion = 10) each produced its exact issue set, including the public-rename revert and confidence-score counterexamples on installed copies.
Cleanup: installed mutations restored byte-exact under temporary roots; git status was identical before and after the command.
Review: PASS — probe names re-approved by the user on 2026-08-30 after the public rename; pending-diff review returned no Critical/High finding.
```
