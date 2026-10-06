# Task 02 — CafeKit installs `cf:ui-ux` and the two UI skills no longer claim the same work

Status: done

## Outcome
A fresh Claude install ships `ui-ux` with its package manifest, `migration-manifest.json` requires it, `cf:ui-ux-pro-max` advertises lookups only, the Codex projection still accepts every vendored `.md`, and a test pins all of it.

## Scope
- In: one line in `skills.required`; the `when_to_use` line of `ui-ux-pro-max/SKILL.md`; a new test file.
- Out: `obsolete.skills`, bundles, Codex/omp manifests, agent `ui-ux-designer`, routing rules, the body of either skill.

## Coverage
- CP-03

## Ownership
- Modify: `src/claude/migration-manifest.json` (add `"ui-ux"` to `skills.required` between `"test"` and `"ui-ux-pro-max"`), `src/claude/skills/ui-ux-pro-max/SKILL.md` (line 5, `when_to_use` only)
- Create: `bin/__tests__/ui-ux-skill.test.js`
- Read: `bin/__tests__/orca-skill.test.js`, `bin/__tests__/optional-skill-inventory.test.js`, `bin/__tests__/codex-native.test.js:2149-2330`, `bin/phases/copy-payload.js`

## Steps
1. In `src/claude/migration-manifest.json`, insert `"ui-ux",` into `skills.required` between `"test"` (line 23) and `"ui-ux-pro-max"` (line 24) → the array has 18 entries.
2. In `src/claude/skills/ui-ux-pro-max/SKILL.md` line 5, set `when_to_use: "Invoke to look up color palettes, font pairings, product-type styles, or UX guidelines; to build or review a screen use cf:ui-ux."` → the word `layout` and the phrase `design system` no longer appear in that line.
3. Write `bin/__tests__/ui-ux-skill.test.js` on the `orca-skill.test.js` pattern (header comment stating the failure each case prevents; `inTempProject` with `git init`; `install(root, ['claude'])` with `--yes` and `PATH=/usr/bin:/bin`), with exactly these four `test(...)` names and assertions:
   - `manifest requires ui-ux` — `loadClaudeMigrationManifest().skills.required` includes `'ui-ux'` and still includes `'ui-ux-pro-max'`.
   - `cf:ui-ux frontmatter carries routing metadata and the MIT license` — the frontmatter of `src/claude/skills/ui-ux/SKILL.md` has `name: cf:ui-ux`, `license: MIT`, `category: frontend`, non-empty `when_to_use` and `keywords`, `description` length ≤ 1024; the whole file matches neither `/\$[0-9]/` nor `/\$ARGUMENTS/`; `src/claude/skills/ui-ux/LICENSE` exists; `src/claude/skills/ui-ux/scripts/package.json` declares `dependencies.playwright`.
   - `ui-ux-pro-max when_to_use no longer claims layout or design systems` — the `when_to_use:` line matches neither `/layout/i` nor `/design system/i` and contains `cf:ui-ux`.
   - `fresh claude install copies ui-ux with its playwright package manifest` — after `install`, `.claude/skills/ui-ux/SKILL.md` and `.claude/skills/ui-ux/scripts/package.json` exist and the installed `SKILL.md` satisfies `assert.match(content, /^name: cf:ui-ux$/m)` (the file begins with `---`, so no `startsWith`).
4. Run the Verification Plan Command → all tests in the four files pass.

## Acceptance
- AC-03: the four named tests pass; `optional-skill-inventory.test.js`, `skill-routing-source.test.js`, and `codex-native.test.js` still pass with the new manifest entry and the vendored files.
- AC-04: the pro-max assertion and the frontmatter assertion (including the `$<digit>` check) pass.

## Dependencies
- task-01-vendor-skill.md

## Verification Plan
- Command: `test -f bin/__tests__/ui-ux-skill.test.js && node --test bin/__tests__/ui-ux-skill.test.js && node --test bin/__tests__/optional-skill-inventory.test.js bin/__tests__/skill-routing-source.test.js bin/__tests__/codex-native.test.js`
- Named probe: `manifest requires ui-ux`; `cf:ui-ux frontmatter carries routing metadata and the MIT license`; `ui-ux-pro-max when_to_use no longer claims layout or design systems`; `fresh claude install copies ui-ux with its playwright package manifest`; plus `manifest separates core, optional documents, and retired skills` (`optional-skill-inventory.test.js:51`), `skill catalog exposes discriminating routing metadata` (`skill-routing-source.test.js:96`), and `Codex installed Specs and spec-maker reject adaptive coverage mutations` (`codex-native.test.js:2149`, whose body scan at 2252-2326 forbids `Agent(`, `subagent_type`, `SendMessage`, `/cf:`, `Claude Code` in every projected `.md` and checks each `name:`).
- Reachability: source + installed — run from `packages/spec/`; the install cases run `bin/install.js` into temp git projects with no network use (`skills-setup.js:22-31` skips dependency setup without `--with-skills-deps`).
- Oracle: exit 0; the first `node --test` summary shows `# pass 4` and `# fail 0` (the new file runs alone, so a missing or misnamed file exits 1 instead of being dropped — Node v22 treats each path as a glob and silently drops a non-matching one when other paths are given); the second summary shows `# fail 0`.
- Counterexample: reverting Step 1 must fail `manifest requires ui-ux` and the install case; restoring the old pro-max `when_to_use` must fail its test; `name: ui-ux` or a `"$1"` left in the vendored `SKILL.md` must fail the frontmatter test; a vendored `.md` containing `Claude Code` or `/cf:` must fail the Codex projection test.
- Artifacts: ephemeral temp projects removed by each test's `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `test -f bin/__tests__/ui-ux-skill.test.js && node --test bin/__tests__/ui-ux-skill.test.js && node --test bin/__tests__/optional-skill-inventory.test.js bin/__tests__/skill-routing-source.test.js bin/__tests__/codex-native.test.js`
Exit: 0
Base: 659b7053ca581085ca5c84977e6c1741c96f9b28
Head: d32e06651c1d0a1012ce09671d2f57c892e86a6d0270f151d28f5dbc1ce852c8
```text
$ (packages/spec) <Command above>   # summary lines; EXIT=0
ok 1 - manifest requires ui-ux
ok 2 - cf:ui-ux frontmatter carries routing metadata and the MIT license
ok 3 - ui-ux-pro-max when_to_use no longer claims layout or design systems
ok 4 - fresh claude install copies ui-ux with its playwright package manifest
# tests 4
# pass 4
# fail 0
ok 22 - Codex installed Specs and spec-maker reject adaptive coverage mutations
ok 35 - manifest separates core, optional documents, and retired skills
ok 51 - skill catalog exposes discriminating routing metadata
# tests 52
# pass 52
# fail 0
```
Pre-change runs: the original Command passed before any change (`# pass 52`, exit 0 — Node v22.23.3 drops a missing path silently when other paths are given), recorded as a blocker and repaired by user decision; the repaired Command then failed at `test -f` (exit 1) before the test file existed. Not run: mutation counterexamples (they would edit tracked source bytes).
