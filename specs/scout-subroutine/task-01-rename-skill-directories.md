# Task 01 — Three skills live in a directory named after their public suffix

Status: done

## Outcome
`skills/inspect`, `skills/hotfix` and `skills/question` become `skills/scout`, `skills/fix` and `skills/ask`, so a host that names project skills by directory shows `scout`, `fix`, `ask` — the suffixes of the `cf:scout`, `cf:fix`, `cf:ask` their callers use — and a real upgrade from the previous install removes the pristine old directories, keeps a user-modified one, and keeps the old names out of CafeKit's catalog.

## Scope
- In: move the three source directories (frontmatter `name` and `description` unchanged); `src/claude/migration-manifest.json` (`skills.required` renamed; `inspect`, `hotfix`, `question` appended to `obsolete.skills`); `src/claude/scripts/generate-skill-catalog.cjs` (the three old names join `RETIRED_DIRECTORIES`, `PUBLIC_SUFFIX_BY_DIRECTORY` is removed because directory and suffix now agree); every test and probe that pins the old directories, inverted where it asserted the old layout; one migration test; one check script that scans for residual old names and runs a real upgrade.
- Out: `bin/lib/codex-install.js` (its slash-command list needs no new entry: no bare `/scout`, `/fix`, `/ask` occurs in `src/claude`); the `"inspect"` runtime key, `runtime.schema.json` and `hooks/inspect-block.cjs`; callers' text; `agents/inspector.md`; `packages/spec/CLAUDE.md:18,49` (internal, not shipped).

## Coverage
- CP-00

## Ownership
- Move: `packages/spec/src/claude/skills/inspect/` → `scout/`, `hotfix/` → `fix/`, `question/` → `ask/`
- Modify: `packages/spec/src/claude/migration-manifest.json`, `packages/spec/src/claude/scripts/generate-skill-catalog.cjs`, `packages/spec/bin/__tests__/codex-native.test.js`, `packages/spec/bin/__tests__/package-inventory.test.js`, `packages/spec/bin/__tests__/skill-routing-source.test.js`, `packages/spec/bin/__tests__/optional-skill-inventory.test.js`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Create: `packages/spec/scripts/check-skill-rename.sh`
- Read: `bin/phases/skill-inventory.js:21-66`, `generate-skill-catalog.cjs:9-23, :126-148, :178-183`, `plans/20260830-hapo-fix-hotfix-learning/plan.md:26,55` (why the directories were kept)

## Steps
1. `git mv` the three directories.
2. Manifest and catalog: rename in `skills.required`; append the three old names to `obsolete.skills` and to `RETIRED_DIRECTORIES` (the two are kept in sync by the comment at `generate-skill-catalog.cjs:9`); delete `PUBLIC_SUFFIX_BY_DIRECTORY` and its uses.
3. Invert, deliberately, every assertion that pins the old layout: `codex-native.test.js:2263-2270` (inspect), `:2273-2281` (question/ask), `:2861-2863` (hotfix); `package-inventory.test.js:2288-2301`; the two probes at `run-skill-self-tests.mjs:4373-4389` ("packaged from the question/hotfix directory"). Update every other old path — including `codex-native.test.js:72`, `package-inventory.test.js:192-195, :2748-2749`, `run-skill-self-tests.mjs:3211-3216, :4645, :4657, :4682-4758` — and the pinned `obsolete.skills` list at `optional-skill-inventory.test.js:59-62`.
4. Migration test in `optional-skill-inventory.test.js`, both platforms: pristine `inspect/`, `hotfix/`, `question/` are removed and `scout/`, `fix/`, `ask/` installed; a modified `hotfix/` is preserved with `Preserved user-owned skill`, and the generated catalog lists `cf:fix` from `fix/` and marks `hotfix` `retired_skill` rather than dropping `cf:fix` as a duplicate.
5. `scripts/check-skill-rename.sh`:
   - residual scan: in `src`, `bin`, `scripts` (`.js`, `.cjs`, `.mjs`, `.json`), print every `skills/(inspect|hotfix|question)\b` or quoted `'inspect'|"inspect"|'hotfix'|"hotfix"|'question'|"question"` outside an allowlist declared in the script, each allowlisted file with its reason (retired lists, the runtime `inspect` key and guard, the migration test, the routing fixtures); exit non-zero on any unlisted match;
   - real upgrade: in a temp project, install with the installer from a detached worktree of `e083bd9` (`--platform claude,codex -y`), then run the current installer with `--dry-run` and assert the old directories are untouched, then without it and assert they are gone, the new ones present, and the generated catalog lists `cf:scout`, `cf:fix`, `cf:ask` for both runtimes; remove the worktree and temp project.
6. Run the Command.

## Acceptance
- AC-00 as stated in `plan.md`.
- A host still shows a preserved, user-modified old directory next to the new one; this is recorded as a limit, not a failure.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && node scripts/run-skill-self-tests.mjs && bash scripts/check-skill-rename.sh`
- Named probe: the migration test in `optional-skill-inventory.test.js`; the inverted assertions in `codex-native.test.js`, `package-inventory.test.js` and the two probes; `check-skill-rename.sh`'s residual scan and upgrade assertions
- Reachability: known — `reconcileSkillInventory` runs on every install for each platform (`bin/phases/skill-inventory.js:61-66`, `bin/install.js:64`), and the catalog generator reads `RETIRED_DIRECTORIES` (`generate-skill-catalog.cjs:126-148`)
- Oracle: `[skill-test] PASS` with more tests than the 1382 in `develop-repairs`' final receipts, and the check script prints its assertions and exits 0
- Counterexample: leaving `inspect` out of `obsolete.skills` keeps the old directory after the real upgrade and fails the migration test; leaving it out of `RETIRED_DIRECTORIES` fails the catalog/manifest parity test, and a modified old copy would then be reported `folder_name_mismatch` instead of `retired_skill`; either makes the Command fail
- Artifacts: none; the moved and changed files are the deliverable, and the upgrade runs in a temp directory removed on exit

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: cd packages/spec && node scripts/run-skill-self-tests.mjs && bash scripts/check-skill-rename.sh
Exit: 0
Base: e083bd9ffd60fd9129ddee14401cdf136e007412
Head: 076af72265aaa8eb2673b5315d46d93b8831142d6f6c9367042d7b4adf61cd38
```text
$ cd packages/spec && node scripts/run-skill-self-tests.mjs && bash scripts/check-skill-rename.sh
[skill-test] static semantic checks
[skill-test] skill catalog checks
[skill-test] installer migration fixtures
[skill-test] instruction install fixtures
[skill-test] spec artifact validator fixtures
[skill-test] reconstruct docs validator fixtures
[skill-test] package Node tests
[skill-test] hook behavioral tests
[skill-test] chrome-devtools script tests
[skill-test] pdf bounding-box tests
[skill-test] retired completion-policy sentence is gone from the payload
[skill-test] source tree stays free of hook state
[skill-test] PASS: 1403 tests executed
ok: no unlisted reference to skills/inspect, skills/hotfix or skills/question
ok: the e083bd9 install created inspect, hotfix and question for claude and codex
ok: --dry-run changes nothing
ok: upgrade removed the three old directories and installed scout, fix and ask for claude and codex
ok: both catalogs list cf:scout, cf:fix and cf:ask
EXIT:0
```
Re-run at the final-Head fixed point (2026-09-23) after task 03 changed `run-skill-self-tests.mjs`, which this proof reads: 1403 tests and the same five assertions.
The fenced block keeps the suite's section and summary lines and the check script's five assertions. The suite rose from 1382 to 1385: the two-platform migration test and the catalog/manifest parity test.

Pre-change run of the same Command (2026-09-23): `[skill-test] PASS: 1382 tests executed`, then `bash: scripts/check-skill-rename.sh: No such file or directory`, exit 127 — the unmet Acceptance.

Repair rounds:
1. The first full run failed one test, `package-inventory.test.js:2602` ("packed Claude and Codex reject adaptive Brainstorm semantic weakenings"): a sixth old-layout pin, not in Step 3's list, asserted `.claude/skills/fix` absent ("public Fix rename keeps the manifest-owned hotfix directory"). It now asserts `fix/SKILL.md` present and `hotfix` absent on both platforms. A grep for `manifest-owned|rename keeps|rename must keep` finds no other.
2. Review FAIL (0 Critical/High, 2 blocking Medium): the migration test did not check the `Preserved user-owned skill` warning, and nothing pinned `inspect` in `RETIRED_DIRECTORIES`; the task's counterexample wrongly said a missing entry drops the name as a duplicate (it reports `folder_name_mismatch`). Added the warning assertion and a parity test; corrected the counterexample and the test comment; the `--dry-run` step now hashes the whole project tree; the allowlist entry for the migration test was narrowed.
3. Review FAIL: the narrowed allowlist had a stray `\` and missed the new line from round 1; both fixed; final review PASS.

Counterexamples on disposable copies of `src`, `bin` and `package.json`: without `inspect` in `obsolete.skills` the migration test fails (`AssertionError: inspect`, 2/2 platforms); without `hotfix` in `RETIRED_DIRECTORIES` it fails (2/2).

Observed behaviour: an install made with the `e083bd9` installer created `inspect`, `hotfix` and `question` under `.claude/skills` and `.agents/skills`; the current installer under `--dry-run` left the project tree hash unchanged; the real upgrade removed the three and installed `scout`, `fix`, `ask`; both runtimes' catalogs list `cf:scout`, `cf:fix`, `cf:ask`. A user-modified `hotfix/` survives with `Preserved user-owned skill` and is marked `retired_skill`, while `cf:fix` is served from `fix/`.

Limits: the residual scan covers `.js`, `.cjs`, `.mjs` and `.json` only; `generate-skill-catalog.cjs`'s `duplicate_public_name` branch is now unreachable from a single root, so the routing test no longer exercises it; `evals/summarize.mjs` and `evals/inspect/` in the tree belong to task 02.
