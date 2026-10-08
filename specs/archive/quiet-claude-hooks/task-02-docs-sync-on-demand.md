# Task 02 — `docs-sync` leaves Claude's SessionStart and runs on demand

Status: done

## Outcome
Opening a Claude session no longer prints "Docs sync needed"; an upgrade removes the old entry; the `docs` skill runs the check itself when it needs it.

## Scope
- In: remove the SessionStart `docs-sync.cjs` hook from Claude `settings.json`; add `.claude/hooks/docs-sync.cjs` to `obsolete.settingsHookCommandSubstrings` (the file stays in `runtime.files`); in the three places that name the SessionStart signal — `skills/docs/SKILL.md:128,141` and `references/update-workflow.md:27` — say to run `echo '{}' | node .claude/hooks/docs-sync.cjs`; `references/init-workflow.md:113` keeps its `.sync_hash` sentence and only drops the SessionStart wording if it has any; add `SessionStart: ['docs-sync.cjs']` to the `OMP_ONLY` divergence list in `omp-bridge.test.js`.
- Out: `docs-sync.cjs` itself; omp bridge; Codex `hooks.json` and Codex hooks.

## Coverage
- CP-02

## Ownership
- Modify: `scripts/run-skill-self-tests.mjs` (repair round 1: the settings/manifest consistency self-test treats a shipped-but-unregistered hook as dead weight; `docs-sync.cjs` joins its allowlist as an on-demand hook), `src/claude/settings/settings.json`, `src/claude/migration-manifest.json`, `src/claude/skills/docs/SKILL.md`, `src/claude/skills/docs/references/update-workflow.md`, `src/claude/skills/docs/references/init-workflow.md` (only if it names SessionStart), `bin/__tests__/omp-bridge.test.js`
- Create: `bin/__tests__/docs-sync-on-demand.test.js`

## Steps
1. Write the test with exactly five tests: `fresh claude install runs no docs-sync at SessionStart` (installed settings have no command containing `docs-sync.cjs`; `.claude/hooks/docs-sync.cjs` still installed); `upgrade drops the SessionStart docs-sync entry` (insert `node "$CLAUDE_PROJECT_DIR/.claude/hooks/docs-sync.cjs"` into SessionStart, reinstall, entry gone, other SessionStart commands kept); `the docs skill runs docs-sync on demand` (`SKILL.md` and `references/update-workflow.md` contain `echo '{}' | node .claude/hooks/docs-sync.cjs`; no file under `skills/docs` says `SessionStart docs-sync`); `the Claude copy prints its signal on demand` and `the Codex copy prints its signal on demand` (temp git project with `package.json`, `docs/` and a stale `docs/.sync_hash`; run `echo '{}' | node <install>/hooks/docs-sync.cjs` from a claude install and from a codex install → stdout contains `Docs sync needed`).
2. Run the Command and expect failure.
3. Edit settings, manifest and the skill files.
4. Run the Command.

## Acceptance
- AC-03: the five tests pass.

## Dependencies
- task-01-spec-state-touched.md

## Verification Plan
- Command: `test -f bin/__tests__/docs-sync-on-demand.test.js && node --test bin/__tests__/docs-sync-on-demand.test.js 2>&1 | tee /dev/stderr | grep -q '^# pass 5$' && node --test bin/__tests__/omp-bridge.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/codex-hooks-ownership.test.js 2>&1 | tee /dev/stderr | grep -q '^# fail 0$'`
- Named probe: the five tests above; `the dispatch table mirrors settings.json for every event omp can deliver` (passes because `docs-sync.cjs` is in the `OMP_ONLY` divergence list).
- Reachability: source + installed; no network.
- Oracle: exit 0; exactly `# pass 5`; regression `# fail 0`.
- Counterexample: leaving the substring out of the obsolete list fails the upgrade test; deleting the hook file fails the fresh-install and on-demand tests; a `< /dev/null` command prints nothing on the Codex copy and fails its test.
- Artifacts: ephemeral temp projects.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `test -f bin/__tests__/docs-sync-on-demand.test.js && node --test bin/__tests__/docs-sync-on-demand.test.js 2>&1 | tee /dev/stderr | grep -q '^# pass 5$' && node --test bin/__tests__/omp-bridge.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/codex-hooks-ownership.test.js 2>&1 | tee /dev/stderr | grep -q '^# fail 0$'`
Exit: 0
Base: c11904f09ca62aca260785f47df85d061e1f8cd7
Head: bebe6613230abace6e6b2c554d736f0f1c9df55641520f5d9e1d28a3b5b61a09
```text
$ (packages/spec) <Command above>   # summary lines; EXIT=0
# tests 5
# pass 5
# fail 0
# tests 58
# pass 58
# fail 0
```
Pre-change run of the new file: `# pass 2` `# fail 3` — registration, upgrade and skill-text cases failed; both on-demand cases already passed with `echo '{}' |`. Repair round 1: the first close was premature — the full package run then failed `settings/manifest hook consistency check` (`shipped in manifest but registered in no settings event: hooks/docs-sync.cjs`, `run-skill-self-tests.mjs` runSettingsManifestConsistencyCheck), because the hook stays shipped for on-demand use; `docs-sync.cjs` joined that check's allowlist, the full run passed (`[skill-test] PASS: 1622 tests executed`), and this Command was rerun. `references/init-workflow.md:113` names `.sync_hash`, not SessionStart, so it is unchanged.
