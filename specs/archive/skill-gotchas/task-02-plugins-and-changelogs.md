# Task 02 — Rebuilt plugins and changelog entries

Status: done

## Outcome
The committed Claude (`plugins/cf`) and Codex (`plugins/cf-codex`) plugin trees carry the new Gotchas text, each equal to a fresh build from source, and both changelogs record the change under `[Unreleased]`.

## Scope
- In: regenerate both plugin trees with their build scripts; add one `[Unreleased]` → `### Added` entry to each changelog.
- Out: version bump, release, plugin-repository sync, reinstalling local `.claude/skills/` or `.agents/skills/`, any source change.

## Coverage
- CP-02

## Ownership
- Modify (generated): `plugins/cf/`, `plugins/cf-codex/`, `.claude-plugin/marketplace.json` (written by the Claude build), `.agents/plugins/marketplace.json` (written by the Codex build)
- Modify: `packages/spec/CHANGELOG.md`
- Modify: `docs/project-changelog.md`
- Read: `packages/spec/scripts/build-claude-plugin.mjs`, `packages/spec/scripts/build-codex-plugin.mjs`

## Steps
1. Run the Verification Plan Command → it fails at the first `--check` because task-01 changed the source.
2. Run `node packages/spec/scripts/build-claude-plugin.mjs` and `node packages/spec/scripts/build-codex-plugin.mjs` → `git status` shows changes only under the two plugin trees (the marketplace files are rewritten with unchanged bytes); any change outside the develop and sync skill files is reported before continuing.
3. Above `## [0.18.3]` in each changelog, add `## [Unreleased]` with `### Added` and one entry in that file's language and layout:
   - `packages/spec/CHANGELOG.md` (English, blank lines between heading, subsection and entry): `cf:develop` and `cf:sync` end with a Gotchas section naming the gate traps users hit: a Receipt `Command:` that is not the plan's canonical Verification Plan command, a `provenance` failure after an edit outside the specs root, a stale `specs/_shared/active-feature.json` that blocks the turn's Stop, and a committed done task edited after the fact.
   - `docs/project-changelog.md`: the same content, matching the language and layout of that file's surrounding entries.
4. Run the Verification Plan Command → exit 0.

## Acceptance
- AC-04: both `--check` runs exit 0 and the package self-tests pass.
- AC-05: each changelog has an `## [Unreleased]` heading above `## [0.18.3]` whose entry names Gotchas.

## Dependencies
- task-01-gotchas-sections.md

## Verification Plan
- Command: `node packages/spec/scripts/build-claude-plugin.mjs --check plugins/cf && node packages/spec/scripts/build-codex-plugin.mjs --check plugins/cf-codex && awk '/^## \[0\.18\.3\]/{exit} /^## \[Unreleased\]/{u=1} u && /Gotchas/{f=1} END{exit !f}' packages/spec/CHANGELOG.md && awk '/^## \[0\.18\.3\]/{exit} /^## \[Unreleased\]/{u=1} u && /Gotchas/{f=1} END{exit !f}' docs/project-changelog.md && pnpm --dir packages/spec test`
- Named probe: the `--check` mode of both build scripts (exit 1 when the directory differs from a fresh build), the two `awk` probes (exit 0 only when `Gotchas` appears after an `[Unreleased]` heading and before `[0.18.3]`), and `packages/spec/scripts/run-skill-self-tests.mjs` (which runs every `bin/__tests__/*.test.js`, including `claude-plugin-build.test.js` and `codex-plugin-build.test.js`).
- Reachability: run from the repository root; build scripts resolve the repository from their own location.
- Oracle: the chained command exits 0; before Step 2 it exits 1 at the first `--check`.
- Counterexample: skipping the Codex rebuild leaves `build-codex-plugin.mjs --check plugins/cf-codex` at exit 1; an `[Unreleased]` block placed below `[0.18.3]`, or an entry outside that block, leaves its `awk` probe at exit 1.
- Artifacts: the two plugin trees are committed build output, compared by the build script's own `--check` rule.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node packages/spec/scripts/build-claude-plugin.mjs --check plugins/cf && node packages/spec/scripts/build-codex-plugin.mjs --check plugins/cf-codex && awk '/^## \[0\.18\.3\]/{exit} /^## \[Unreleased\]/{u=1} u && /Gotchas/{f=1} END{exit !f}' packages/spec/CHANGELOG.md && awk '/^## \[0\.18\.3\]/{exit} /^## \[Unreleased\]/{u=1} u && /Gotchas/{f=1} END{exit !f}' docs/project-changelog.md && pnpm --dir packages/spec test`
Exit: 0
Base: 7ed6b1faae93d8299945862bf2887be9a53968cb
Head: 29213f8c11f4f628cd48be068467ec8969385af92cd63f8e3ae6ac6467af1a1a

```text
plugin tree matches a fresh build: /Users/nghialuutrung/Desktop/cafekit/plugins/cf
plugin tree matches a fresh build: /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
✔ develop and sync carry symptom-first gotchas (0.28575ms)
[skill-test] PASS: 2349 tests executed
```

- Before the rebuild, `build-claude-plugin.mjs --check plugins/cf` reported the tree stale in `skills/develop/SKILL.md` and `skills/sync/SKILL.md`; the rebuilds changed only those two files in each plugin tree, and both marketplace files kept their bytes. The Codex copy names the command `$cf-sync`.
- Both changelogs already had an `## [Unreleased]` block, so the entry sits under a new `### Added` inside it, above `### Removed`.
- Counterexample on scratch files: the `awk` probe exits 1 when `[Unreleased]` sits below `[0.18.3]` and when the Gotchas entry sits only under `[0.18.3]`; it exits 0 on both edited changelogs.
- The first run of this Command stopped at `command not found: pnpm` (exit 127); after the user installed pnpm 12.16.1 the unchanged Command ran. Its install step changed no tracked file.
- Review: PASS. The diff stays inside the owned paths.
