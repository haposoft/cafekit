# Task 02 — Prove installed parity and document usage

Status: done

## Outcome
The adaptive docs contract survives projection into installed Claude and Codex layouts — including installs that select the optional document bundle — its weakenings are rejected there, and the repository and package guides describe the checkpoint and Delegation Gate.

## Coverage
- CP-05

## Scope
- In: add new docs parity assertions and disposable installed-copy mutations to the Codex-native and packed-install regression suites, covering the optional-bundle install branch — extend the suites' own install helpers where needed (e.g. `runInstaller` in `package-inventory.test.js:330-340` currently cannot pass `--with-document-skills`; opt-in precedent at `codex-native.test.js:2036`) while respecting the absent-by-default catalog assertion at `codex-native.test.js:2992`; update docs usage wording in the repository and package guides.
- Out: new guide files; changes to `SKILL.md`, references, or the static harness beyond what task 01 authored; installer or bundle-selection code changes; timing or live-adherence claims.

## Ownership
- Modify: `packages/spec/bin/__tests__/codex-native.test.js`
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js`
- Modify: `README.md`
- Modify: `packages/spec/README.md`
- Read: `packages/spec/src/claude/skills/docs/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `packages/spec/bin/phases/select-skill-bundles.js`

## Acceptance
- AC-05: mutating a disposable installed copy of the docs contract fails the matching regression with its exact issue set in both projections while canonical source bytes remain untouched; at least one covered install path selects the optional document bundle so the installed docs skill actually exists in the fixture; no existing assertion is deleted or weakened.
- AC-06: `README.md` and `packages/spec/README.md` describe docs usage (post-task checkpoint, Delegation Gate, evidence taxonomy) without timing or live-adherence claims.

## Dependencies
- task-01-author-adaptive-docs-contract.md

## Verification Plan
- Command: `npm --prefix packages/spec test`
- Named probe: the new docs parity checks in `codex-native.test.js` and `package-inventory.test.js`; `hapo:docs adaptive contract is complete and bounded` (via the suite's static pass); the guide-coverage assertions added for docs
- Reachability: `npm test -> bin/__tests__ suites -> disposable native/packed installs under mkdtemp (document bundle selected) -> installed docs contract checks`
- Oracle: the full suite exits 0 on canonical bytes; each installed-copy mutation produces its exact nonempty issue set; zero executed tests or a skipped required probe is not a pass.
- Counterexample: an installed Codex copy that drops a Delegation Gate clause, or a packed Claude copy whose checkpoint invents a new document, must fail its owning regression.
- Artifacts: none durable — installed copies live under a verified temporary root and are removed; canonical file SHA-256 values and `git status` must be identical before and after the command.

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 8a865906308f73c5f28b682816e4c5e409cd2eb8
Head: 35cd1eb2446bd0cde219e8592637d82ba95052e9d7fb35ace61b62ac1fe7eb3a
```text
$ npm --prefix packages/spec test
✔ hapo:docs adaptive contract is complete and bounded
✔ hapo:docs checker rejects 18 semantic weakenings
✔ Codex installed Docs preserves the adaptive contract (839.369208ms)
✔ packed Claude and Codex installs reject adaptive Docs semantic weakenings (5754.776625ms)
✔ repository and package guides document adaptive Docs usage (0.588958ms)
[skill-test] PASS: 1167 tests executed
Exit: 0
Reachability: npm test -> bin/__tests__ suites -> disposable native/packed installs under mkdtemp with --with-document-skills -> docsProjectionIssues/packedDocsIssues.
Negative proof: 5 Codex-native mutations plus 2 platforms x 4 packed mutation groups (exercised coverage assertion = 8) each produced its exact issue set; the absent-by-default catalog assertion stays untouched.
Cleanup: installed mutations restored byte-exact under temporary roots; canonical source bytes asserted unchanged after every mutation; git status was identical before and after the command.
Review: PASS — code-auditor (0 Critical, 0 High, 0 Medium; 2 Low non-blocking); runInstaller extension verified backward-compatible across all 14 call sites; every clause verified transform-safe through the Codex projection.
```
