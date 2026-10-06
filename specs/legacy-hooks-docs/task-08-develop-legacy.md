# Task 08 — develop skill and references drop the legacy closeout promise

Status: done

## Outcome
The `cf:develop` skill, `parallel-waves.md` and `quality-gate.md` no longer tell the model to keep a legacy feature closeout receipt or adapter, the `cf:develop` description drops "Also supports existing legacy Specs packets", and the tests that required those sections now forbid them.

## Scope
- In: `src/claude/skills/develop/SKILL.md`: delete lines 170-178 (blank + `## Legacy workflow compatibility` to EOF; the file ends with the `implementation-notes-template.html` bullet, 169 lines); line 3 description ends "…and close it with one evidence owner." (drop " Also supports existing legacy Specs packets.").
- In: `src/claude/skills/develop/references/parallel-waves.md`: delete lines 73-80 (blank + section to EOF; promises the legacy separate task receipt and the final feature receipt).
- In: `src/claude/skills/develop/references/quality-gate.md`: delete lines 124-130 (blank + section to EOF; promises `feature-receipt.md`).
- In: `scripts/run-skill-self-tests.mjs:2601` (`developPlanNativeContractIssues`): `legacyHeadingCount !== 4` → `legacyHeadingCount !== 1 || !dispatch.includes("## Legacy workflow compatibility")` (only `subagent-patterns.md` keeps one); the vocabulary half of the condition stays.
- In: `bin/__tests__/develop-contract.test.js`: in "CLI exposes a derived lane without making it primary Develop authority" replace the four `regions.legacy` asserts (`:758-761`) with `assert.doesNotMatch(develop, /## Legacy workflow compatibility|Also supports existing legacy Specs packets/);`; in "R7 Develop and Sync surfaces …" set the develop and parallel-waves expected legacy-heading counts to 0.
- Out: `develop/references/subagent-patterns.md:54-58` (lane snapshot in dispatch; promises no closeout — kept per the user's conditional, R-10); test skill and `test-runner` sections (current per-task receipt behaviour).

## Coverage
- CP-06

## Ownership
- Modify: `src/claude/skills/develop/SKILL.md`
- Modify: `src/claude/skills/develop/references/parallel-waves.md`
- Modify: `src/claude/skills/develop/references/quality-gate.md`
- Modify: `scripts/run-skill-self-tests.mjs` (line 2601 only)
- Modify: `bin/__tests__/develop-contract.test.js` (lines 758-761 and the R7 surface table)
- Read: `bin/__tests__/codex-native.test.js:53-55` (projects the three develop references to Codex)

## Steps
1. Delete the three sections and the description clause.
2. Edit the runner condition and the two tests.
3. Run the Command.

## Acceptance
- AC-09: the three files count 0 lines matching `legacy|spec\.json|feature-receipt|feature closeout` (5, 3, 2 today); the description line matches exactly; `subagent-patterns.md` still has its section; `develop-contract` + `codex-native` pass 103 tests.

## Dependencies
- task-03-specs-sync-skills.md
- task-05-readmes-guide.md

## Verification Plan
- Command: `F=/tmp/ck-3c-08.txt; rm -f $F; for f in src/claude/skills/develop/SKILL.md src/claude/skills/develop/references/parallel-waves.md src/claude/skills/develop/references/quality-gate.md; do echo "$f $(grep -ciE 'legacy|spec\.json|feature-receipt|feature closeout' $f)"; done > $F; cat $F; [ "$(grep -c ' 0$' $F)" = 3 ] && grep -q '^description: "Implement an explicitly requested process-first feature or task, run its real verification, and close it with one evidence owner."$' src/claude/skills/develop/SKILL.md && grep -q '^## Legacy workflow compatibility$' src/claude/skills/develop/references/subagent-patterns.md && grep -q 'if (legacyHeadingCount !== 1 || !dispatch.includes("## Legacy workflow compatibility")' scripts/run-skill-self-tests.mjs && grep -qF "['develop', DEVELOP, 0]," bin/__tests__/develop-contract.test.js && grep -qF "['parallel waves', PARALLEL_WAVES, 0]," bin/__tests__/develop-contract.test.js && grep -qF 'assert.doesNotMatch(develop, /## Legacy workflow compatibility|Also supports existing legacy Specs packets/);' bin/__tests__/develop-contract.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 103' $F && grep -qx '# fail 0' $F && rm -f $F`
- Named probe: `develop-contract.test.js` "CLI exposes a derived lane without making it primary Develop authority" and "R7 Develop and Sync surfaces teach process-v3 and isolate hierarchical Legacy sections", and `codex-native.test.js` (Codex projection of the develop references) — 103 tests together; the runner's `cf:develop plan-native` contract check runs in task-10.
- Reachability: source — run from `packages/spec/`.
- Oracle: exit 0; three counts `0`; `# tests 103`, `# fail 0`. On acfdf6e9 the Command exits 1.
- Counterexample: leaving the description clause fails the exact description grep; deleting `subagent-patterns.md`'s section too fails its grep and the runner condition; leaving the old count of 4 fails the runner grep; the old `regions.legacy` asserts fail once the section is gone.
- Artifacts: `/tmp/ck-3c-08.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3c-08.txt; rm -f $F; for f in src/claude/skills/develop/SKILL.md src/claude/skills/develop/references/parallel-waves.md src/claude/skills/develop/references/quality-gate.md; do echo "$f $(grep -ciE 'legacy|spec\.json|feature-receipt|feature closeout' $f)"; done > $F; cat $F; [ "$(grep -c ' 0$' $F)" = 3 ] && grep -q '^description: "Implement an explicitly requested process-first feature or task, run its real verification, and close it with one evidence owner."$' src/claude/skills/develop/SKILL.md && grep -q '^## Legacy workflow compatibility$' src/claude/skills/develop/references/subagent-patterns.md && grep -q 'if (legacyHeadingCount !== 1 || !dispatch.includes("## Legacy workflow compatibility")' scripts/run-skill-self-tests.mjs && grep -qF "['develop', DEVELOP, 0]," bin/__tests__/develop-contract.test.js && grep -qF "['parallel waves', PARALLEL_WAVES, 0]," bin/__tests__/develop-contract.test.js && grep -qF 'assert.doesNotMatch(develop, /## Legacy workflow compatibility|Also supports existing legacy Specs packets/);' bin/__tests__/develop-contract.test.js && node --test bin/__tests__/develop-contract.test.js bin/__tests__/codex-native.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 103' $F && grep -qx '# fail 0' $F && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: 963e456085d35927ca85b0b69a05243255de2a3aed30cc6f60d57b988a5e55db
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
src/claude/skills/develop/SKILL.md 0
src/claude/skills/develop/references/parallel-waves.md 0
src/claude/skills/develop/references/quality-gate.md 0
# tests 103
# fail 0
EXIT=0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
