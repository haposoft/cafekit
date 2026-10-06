# Task 03 — specs and sync skills drop the legacy section

Status: done

## Outcome
The `cf:specs` and `cf:sync` skills no longer route `spec.json` packets to an installed adapter, the `cf:sync` description stops mentioning legacy state, and the tests that required those sections now forbid them while still pinning current behaviour.

## Scope
- In: `src/claude/skills/specs/SKILL.md`: delete lines 138-144 (`## Legacy compatibility`, blank, four-line paragraph, blank); `## Maintenance` follows the Machine boundary paragraph; the file becomes 143 lines.
- In: `src/claude/skills/sync/SKILL.md`: delete lines 73-80 (blank + `## Legacy workflow compatibility` to EOF); line 3 becomes `description: "Synchronize process-first task Status and inline Receipts without inventing proof."` (drop "; also preserves existing legacy Specs state").
- In: `src/claude/skills/sync/references/sync-protocols.md`: delete lines 54-62 (blank + `## Legacy workflow compatibility` to EOF).
- In: `bin/__tests__/develop-contract.test.js`: test "Specs primary output is a flat process-first packet with isolated legacy compatibility" — `:788` expects `0` legacy headings; replace the two `regions.legacy` asserts (`:794-795`) with `assert.doesNotMatch(specs, /installed legacy adapters?/i);` and keep `assertVocabularyIsLegacyOnly`. Test "R7 Develop and Sync surfaces …" — give each surface an expected legacy-heading count (develop 1, parallel waves 1, sync 0, sync protocols 0), assert that count at `:841`, run the `spec.json`/`task_registry` legacy asserts only when the count is 1, and replace `:873` `assert.match(legacyCorpus, /sync-finalize/i)` with `assert.match(regionsByName.get('sync').primary, /sync-finalize/i)` (sync-finalize is current behaviour, `sync/SKILL.md:25,52`); delete the then-unused `legacyCorpus` accumulator (`:836`, `:847`; A-07).
- In: `scripts/run-skill-self-tests.mjs:5481`: floor `>= 150` → `>= 140` (D-03). `:5835` (check "Specs primary flow is file-first while legacy kernel remains isolated"): replace `content.includes("## Legacy compatibility") &&` with `!content.includes("## Legacy compatibility") &&` and `!content.includes("installed legacy adapters") &&`.
- Out: the develop and code-review legacy sections and the R7 develop/parallel-waves rows (task-08, task-09); the test-skill and `test-runner` legacy sections (current behaviour, kept by user decision); `sync/references/rebind-and-audit.md:49` (reports legacy packets; current behaviour).

## Coverage
- CP-01

## Ownership
- Modify: `src/claude/skills/specs/SKILL.md`
- Modify: `src/claude/skills/sync/SKILL.md`
- Modify: `src/claude/skills/sync/references/sync-protocols.md`
- Modify: `bin/__tests__/develop-contract.test.js`
- Modify: `scripts/run-skill-self-tests.mjs` (lines 5481, 5835 only)

## Steps
1. Delete the three sections and the description clause → each file counts 0 legacy terms.
2. Edit the two `develop-contract.test.js` tests as in Scope → `node --test bin/__tests__/develop-contract.test.js` reports 69 tests, 0 fail.
3. Edit the two runner clauses.
4. Run the Command.

## Acceptance
- AC-03: the three skill files count 0 lines matching `legacy|installed adapter|spec\.json` (4 each today); the sync description line matches exactly; specs SKILL has 143 lines; `develop-contract.test.js` passes 69/69.

## Dependencies
- task-01-runtime-templates.md

## Verification Plan
- Command: `F=/tmp/ck-3c-03.txt; rm -f $F; for f in src/claude/skills/specs/SKILL.md src/claude/skills/sync/SKILL.md src/claude/skills/sync/references/sync-protocols.md; do echo "$f $(grep -ciE 'legacy|installed adapter|spec\.json' $f)"; done > $F; cat $F; [ "$(grep -c ' 0$' $F)" = 3 ] && grep -qx 'description: "Synchronize process-first task Status and inline Receipts without inventing proof."' src/claude/skills/sync/SKILL.md && [ "$(wc -l < src/claude/skills/specs/SKILL.md | tr -d ' ')" = 143 ] && grep -q 'length >= 140 && content.trimEnd().split("\\n").length <= 230' scripts/run-skill-self-tests.mjs && grep -q '!content.includes("installed legacy adapters") &&' scripts/run-skill-self-tests.mjs && [ "$(grep -c '        !content.includes("## Legacy compatibility") &&' scripts/run-skill-self-tests.mjs)" -ge 1 ] && grep -qF "assert.match(regionsByName.get('sync').primary, /sync-finalize/i);" bin/__tests__/develop-contract.test.js && ! grep -q 'legacyCorpus' bin/__tests__/develop-contract.test.js && node --test bin/__tests__/develop-contract.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 69' $F && grep -qx '# fail 0' $F && rm -f $F`
- Named probe: `develop-contract.test.js` "Specs primary output is a flat process-first packet with isolated legacy compatibility" and "R7 Develop and Sync surfaces teach process-v3 and isolate hierarchical Legacy sections" (69 tests in the file), plus the greps; the runner floor and `:5835` checks run in task-10.
- Reachability: source — run from `packages/spec/`.
- Oracle: exit 0; three counts `0`; `# tests 69`, `# fail 0`. On acfdf6e9 the Command exits 1 (counts 4, 4, 4).
- Counterexample: keeping the sync description clause fails the exact `grep -qx`; deleting a test instead of editing it drops `# tests 69`; leaving the floor at 150 is caught by the `>= 140` grep; dropping the `sync-finalize` assertion or the flipped `!content.includes("## Legacy compatibility")` clause fails their greps (A-06); a leftover `legacyCorpus` fails `! grep` (A-07).
- Artifacts: `/tmp/ck-3c-03.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3c-03.txt; rm -f $F; for f in src/claude/skills/specs/SKILL.md src/claude/skills/sync/SKILL.md src/claude/skills/sync/references/sync-protocols.md; do echo "$f $(grep -ciE 'legacy|installed adapter|spec\.json' $f)"; done > $F; cat $F; [ "$(grep -c ' 0$' $F)" = 3 ] && grep -qx 'description: "Synchronize process-first task Status and inline Receipts without inventing proof."' src/claude/skills/sync/SKILL.md && [ "$(wc -l < src/claude/skills/specs/SKILL.md | tr -d ' ')" = 143 ] && grep -q 'length >= 140 && content.trimEnd().split("\\n").length <= 230' scripts/run-skill-self-tests.mjs && grep -q '!content.includes("installed legacy adapters") &&' scripts/run-skill-self-tests.mjs && [ "$(grep -c '        !content.includes("## Legacy compatibility") &&' scripts/run-skill-self-tests.mjs)" -ge 1 ] && grep -qF "assert.match(regionsByName.get('sync').primary, /sync-finalize/i);" bin/__tests__/develop-contract.test.js && ! grep -q 'legacyCorpus' bin/__tests__/develop-contract.test.js && node --test bin/__tests__/develop-contract.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 69' $F && grep -qx '# fail 0' $F && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: b31d0bb5e5237638143e761bc3c02ee6b471ff1ff7526c5046146562d9d768a3
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
src/claude/skills/specs/SKILL.md 0
src/claude/skills/sync/SKILL.md 0
src/claude/skills/sync/references/sync-protocols.md 0
# tests 69
# fail 0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
