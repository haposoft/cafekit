# Task 01 — The skill requires red on the unchanged code before the first source change

Status: done

## Outcome
`cf:fix` carries one hard gate that makes a test (or, for a lint, type, syntax or build failure, the exact failing check) observed failing on the unchanged code the entry condition for the first change to any non-test file, its depth text, Steps 2, 4 and 5 and the Prevention Gate's regression guard point to that gate, and the self-test rejects each weakening of it.

## Scope
- In: one new gate block and five sentence edits in `SKILL.md`; lines 15-16 of `references/prevention-gate.md` (GATE-REVIEW G-08); one new issue and sixteen mutations in the self-test.
- Out: `description`, `when_to_use`, the scout/debug call wording, step markers, the mermaid flow, every other line of `references/`, every file under `evals/`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/fix/SKILL.md`
- Modify: `packages/spec/src/claude/skills/fix/references/prevention-gate.md` (lines 15-16 only)
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/bin/__tests__/codex-native.test.js`, `packages/spec/bin/__tests__/package-inventory.test.js`

## Steps
1. In `SKILL.md`, insert this block, each sentence on one physical line, between `</HARD-GATE-SCOUT-FIRST>` and `<HARD-GATE-NO-SIDE-EFFECTS>`:
   ```
   <HARD-GATE-RED-BEFORE-FIX>
   Before the first change to any non-test file (an edit, a file write, or a shell command that rewrites it), run a test that fails on the unchanged code for the diagnosed reason, and keep its exact command and failing output for Step 5.
   For a lint, type, syntax, or build failure, the exact failing check run on the unchanged code stands in for the test.
   When no existing test fails for that reason, write or update the regression test first, then run it and see it fail.
   Red shown after the fact does not count: stashing, checking out, reverting, or editing the fix away to make the test fail is not pre-fix evidence.
   If no automated test or check can reproduce the failure, say so and keep the exact manual reproduction and its observed output instead.
   This applies at every depth.
   </HARD-GATE-RED-BEFORE-FIX>
   ```
   → the block occurs once; it names no tool in backticks, because the Codex install rewrites `` `Edit` `` and `` `Write` `` to `` `apply_patch` `` (`packages/spec/bin/lib/codex-install.js:37`).
2. Replace `regression test that fails without the fix and passes with it.` in Proportional depth (`SKILL.md:33-34`, **Standard:**) with `regression test seen failing on the unchanged code before the fix (\`HARD-GATE-RED-BEFORE-FIX\`) and passing after it.` → the old phrase no longer occurs in Proportional depth.
3. Append to Step 2 item 1 (`SKILL.md:154`, after `This is the baseline for Step 5.`): ` When an existing test already fails for the diagnosed reason, its run belongs to this baseline; otherwise the regression test is written and seen failing at the start of Step 4 under \`HARD-GATE-RED-BEFORE-FIX\`.` (Step 2 runs `cf:debug`, which adds no regression test, `packages/spec/src/claude/skills/debug/SKILL.md:37-38`.)
4. In Step 4, replace the **Quick:** opening `apply the minimal fix from completed scout + diagnosis` with `with the pre-fix failure observed under \`HARD-GATE-RED-BEFORE-FIX\`, apply the minimal fix from completed scout + diagnosis`, and replace the whole **Standard:** bullet (`SKILL.md:213`) with `- **Standard:** write or update the regression test and run it to see it fail on the unchanged code (\`HARD-GATE-RED-BEFORE-FIX\`), then implement the fix, rerun the same test to see it pass, and run the relevant suite.`
5. Replace Step 5 item 2 (`SKILL.md:231`) with `2. **Regression test:** the failing run kept under \`HARD-GATE-RED-BEFORE-FIX\` and a passing run of the same test after the fix.`
6. In `references/prevention-gate.md`, replace lines 15-16 (`- Write a test that specifically covers the fixed issue` and `- The test MUST fail without the fix and pass with it`) with `- A test that specifically covers the fixed issue and was seen failing on the unchanged code before the fix (\`HARD-GATE-RED-BEFORE-FIX\` in \`../SKILL.md\`) counts as this guard` and `- Red produced afterwards by undoing the fix does not count; the test MUST pass with the fix` → the old line 16 no longer occurs; line 17 and every other line are unchanged.
7. In `run-skill-self-tests.mjs`, add to `hotfixAdaptiveContractIssues` an issue `red-before-fix` raised unless `skill` contains: `<HARD-GATE-RED-BEFORE-FIX>`; `Before the first change to any non-test file (an edit, a file write, or a shell command that rewrites it)`; `fails on the unchanged code for the diagnosed reason`; `For a lint, type, syntax, or build failure, the exact failing check run on the unchanged code stands in for the test.`; `write or update the regression test first, then run it and see it fail`; `Red shown after the fact does not count`; `If no automated test or check can reproduce the failure, say so`; `This applies at every depth.`; `regression test seen failing on the unchanged code before the fix (\`HARD-GATE-RED-BEFORE-FIX\`)`; `otherwise the regression test is written and seen failing at the start of Step 4 under \`HARD-GATE-RED-BEFORE-FIX\``; `with the pre-fix failure observed under \`HARD-GATE-RED-BEFORE-FIX\`, apply the minimal fix`; `run it to see it fail on the unchanged code`; `the failing run kept under \`HARD-GATE-RED-BEFORE-FIX\``; and unless `prevention` contains `seen failing on the unchanged code before the fix (\`HARD-GATE-RED-BEFORE-FIX\` in \`../SKILL.md\`) counts as this guard` and `Red produced afterwards by undoing the fix does not count`; and raised when `skill` contains `regression test that fails without the fix and passes with it` or `prevention` contains `The test MUST fail without the fix and pass with it`.
8. Add sixteen mutations to the list (`run-skill-self-tests.mjs:3475-3506`), each expecting `red-before-fix`. On `skill`: `<HARD-GATE-RED-BEFORE-FIX>` → `<NOTE-RED>`; `Before the first change to any non-test file` → `Before finalizing the fix`; `(an edit, a file write, or a shell command that rewrites it)` → `(an edit)`; `fails on the unchanged code for the diagnosed reason` → `fails for the diagnosed reason`; `the exact failing check run on the unchanged code stands in for the test` → `a passing check after the fix stands in for the test`; `Red shown after the fact does not count` → `Red shown after the fact also counts`; `If no automated test or check can reproduce the failure, say so` → `If no automated test or check can reproduce the failure, skip it`; `This applies at every depth.` → `This applies at every depth. A regression test that fails without the fix and passes with it also satisfies it.` (only the absence check catches it); the depth sentence `regression test seen failing on the unchanged code before the fix (\`HARD-GATE-RED-BEFORE-FIX\`) and passing after it.` → `regression test that fails without the fix and passes with it.`; `otherwise the regression test is written and seen failing at the start of Step 4` → `otherwise the regression test is written after the fix`; `with the pre-fix failure observed under \`HARD-GATE-RED-BEFORE-FIX\`, apply the minimal fix` → `apply the minimal fix`; the Step 4 **Standard:** bullet → the original `- **Standard:** implement the fix, add or update a regression test that fails without the fix and passes with it, run the relevant suite.`; `the failing run kept under \`HARD-GATE-RED-BEFORE-FIX\`` → `a run`. On `prevention`: `seen failing on the unchanged code before the fix` → `seen failing at some point`; `Red produced afterwards by undoing the fix does not count` → `Red produced afterwards by undoing the fix also counts`; `- Place it near related existing tests for discoverability` → `- The test MUST fail without the fix and pass with it\n- Place it near related existing tests for discoverability` (only the absence check catches it). Each anchor occurs exactly once in its source (`replaceHotfixClauseOnce`, `:3457-3463`) → 30 + 16 mutations, the checker line reads `rejects 46 semantic weakenings`.

## Acceptance
- AC-01: the gate block, the depth sentence, Steps 2, 4 and 5 and `prevention-gate.md:15-16` hold the Step 1–6 text; `regression test that fails without the fix and passes with it` no longer occurs in `SKILL.md` and `The test MUST fail without the fix and pass with it` no longer occurs in `prevention-gate.md`.
- AC-02: the self-test prints `✔ cf:fix adaptive contract is complete and bounded` and `✔ cf:fix checker rejects 46 semantic weakenings`; the whole runner passes, its `package Node tests` suite (which holds `codex-native.test.js` and `package-inventory.test.js`) included.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1); s=$?; printf '%s\n' "$out" | grep -E 'cf:fix|\[skill-test\] (package Node tests|PASS:)|\[(FAIL|NO_TESTS)\]'; [ $s = 0 ] && printf '%s\n' "$out" | grep -qxF '✔ cf:fix checker rejects 46 semantic weakenings' && printf '%s\n' "$out" | grep -qxF '[skill-test] package Node tests' && printf '%s\n' "$out" | grep -qE '^\[skill-test\] PASS: [1-9][0-9]* tests executed$' && [ "$(grep -c '^<HARD-GATE-RED-BEFORE-FIX>$' src/claude/skills/fix/SKILL.md)" = 1 ] && ! grep -qF 'regression test that fails without the fix and passes with it' src/claude/skills/fix/SKILL.md && ! grep -qF 'The test MUST fail without the fix and pass with it' src/claude/skills/fix/references/prevention-gate.md && for f in fix debug scout; do printf '%s  src/claude/skills/%s/\n' "$( (cd src/claude/skills/$f && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1)" "$f"; done`
- Run: the Command takes about 12 minutes (the self-test runner); run it as a background job and read its output when it exits. The runner's "package Node tests" suite already runs every `bin/__tests__/*.test.js`, `codex-native.test.js` and `package-inventory.test.js` included (`run-skill-self-tests.mjs:7033-7045`), and exits non-zero on a failing or empty suite, so no separate `node --test` runs.
- Named probe: `runHotfixAdaptiveContractTests` (`run-skill-self-tests.mjs:3465`), its `red-before-fix` issue and sixteen mutations; the Codex install and package-inventory tests.
- Reachability: `evals/run.sh:31`, `:64` copies `skills/fix` (with `references/`) into every eval run and `:69` copies `skills/debug` and `skills/scout`; the Codex mirror is generated from them (`codex-native.test.js:72`, `:78`).
- Oracle: exit 0, the `rejects 46` line, the `[skill-test] package Node tests` and `[skill-test] PASS: <n> tests executed` lines, one gate block, both old sentences absent, and three directory-digest lines `<sha256>  src/claude/skills/<fix|debug|scout>/` that task 03 guards against.
- Counterexample: the gate placed but Step 4 or the depth text still saying "regression test that fails without the fix and passes with it" fails the absence check; dropping the file-write clause fails the mutation `(an edit)` only if the checker reads it, so a checker that misses it fails `rejects 46`; a gate naming `` `Edit` `` would reach Codex as `` `apply_patch` ``, which the backtick-free wording avoids.
- Artifacts: the three directory-digest lines printed by the Command, kept in this Receipt and read by task 03's guards.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1); s=$?; printf '%s\n' "$out" | grep -E 'cf:fix|\[skill-test\] (package Node tests|PASS:)|\[(FAIL|NO_TESTS)\]'; [ $s = 0 ] && printf '%s\n' "$out" | grep -qxF '✔ cf:fix checker rejects 46 semantic weakenings' && printf '%s\n' "$out" | grep -qxF '[skill-test] package Node tests' && printf '%s\n' "$out" | grep -qE '^\[skill-test\] PASS: [1-9][0-9]* tests executed$' && [ "$(grep -c '^<HARD-GATE-RED-BEFORE-FIX>$' src/claude/skills/fix/SKILL.md)" = 1 ] && ! grep -qF 'regression test that fails without the fix and passes with it' src/claude/skills/fix/SKILL.md && ! grep -qF 'The test MUST fail without the fix and pass with it' src/claude/skills/fix/references/prevention-gate.md && for f in fix debug scout; do printf '%s  src/claude/skills/%s/\n' "$( (cd src/claude/skills/$f && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1)" "$f"; done
Exit: 0
Base: ce72b726fb9d761e7c9cb76edc0492cf1155849c
Head: ac3b6c6a82b2513cc3998df09b62323e1e7b70c35b233f614c4fbdb1ace4cc28
```text
$ cd packages/spec && out=$(node scripts/run-skill-self-tests.mjs 2>&1); s=$?; printf '%s\n' "$out" | grep -E 'cf:fix|\[skill-test\] (package Node tests|PASS:)|\[(FAIL|NO_TESTS)\]'; [ $s = 0 ] && printf '%s\n' "$out" | grep -qxF '✔ cf:fix checker rejects 46 semantic weakenings' && printf '%s\n' "$out" | grep -qxF '[skill-test] package Node tests' && printf '%s\n' "$out" | grep -qE '^\[skill-test\] PASS: [1-9][0-9]* tests executed$' && [ "$(grep -c '^<HARD-GATE-RED-BEFORE-FIX>$' src/claude/skills/fix/SKILL.md)" = 1 ] && ! grep -qF 'regression test that fails without the fix and passes with it' src/claude/skills/fix/SKILL.md && ! grep -qF 'The test MUST fail without the fix and pass with it' src/claude/skills/fix/references/prevention-gate.md && for f in fix debug scout; do printf '%s  src/claude/skills/%s/\n' "$( (cd src/claude/skills/$f && find . -type f ! -name .DS_Store | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -d' ' -f1)" "$f"; done
✔ cf:fix adaptive contract is complete and bounded
✔ cf:fix checker rejects 46 semantic weakenings
✔ cf:fix is packaged from the fix directory and the hotfix directory is retired
✔ cf:fix is deterministic scout-first without mode selection
✔ cf:fix quick path never skips scout or diagnosis
✔ cf:fix enforces no-side-effect gate with user options
✔ cf:fix references are local and not stale debugger paths
✔ cf:fix prevention gate points back to side-effect sweep
✔ cf:fix review cycle uses pause conditions not mode selection
[skill-test] package Node tests
[skill-test] PASS: 1579 tests executed
db1e1c3a948b2cd09a7e33cc120a28c91c863b75832ce4d6998029bc936a8537  src/claude/skills/fix/
d14b03c8295927725d3878d92fcddd2fcaa08322460c952ed5bfa3ff853cf41d  src/claude/skills/debug/
22e5165f2beffc8868100bbb755bab2a43ab7f6b1496701c742ebbd1fd68ec07  src/claude/skills/scout/
EXIT=0
```
- Exit capture: the Command text was saved byte-identical to a script and run with `bash` from the repository root, with `echo "EXIT=$?"` after it; `EXIT=0` above is its own exit status. This run replaced the first Receipt (Head `8ebc8c6c…`) after task 02 added two scripts outside the specs root; the three digests are unchanged.
- Negative proof: the same Command run before any change printed `✔ cf:fix checker rejects 30 semantic weakenings` and `EXIT=1`.
- Review: code-auditor PASS on the diff (three files, +51/−7). Low observations, not blocking and outside the task's Steps: Step 5 item 2 and Step 2 item 1 name only a test, not the lint/type stand-in or manual reproduction the gate allows; two pins (`write or update the regression test first…`, `This applies at every depth.`) have no dedicated mutation; two mutations share one pin.
- Artifacts: the three directory digests above (`fix`, `debug`, `scout`), read by task 03's guards.
