# Task 01 — `usage.cjs` is no longer shipped, registered, or left behind by an upgrade

Status: done

## Outcome
A fresh Claude or omp install has no usage hook, and upgrading either removes an installed `usage.cjs` (modified or not) and the CafeKit settings entries while a foreign hook named `usage.cjs` survives.

## Scope
- In: delete `src/claude/hooks/usage.cjs`; remove the UserPromptSubmit entry and the whole PostToolUse `Edit|Write|MultiEdit` group (its only hook is `usage.cjs`) from `settings.json`; remove `hooks/usage.cjs` from `runtime.files`; add `hooks/usage.cjs` to `obsolete.runtimeFiles` and `.claude/hooks/usage.cjs` to `obsolete.settingsHookCommandSubstrings`; remove `'usage.cjs'` from the two omp bridge lists; make the omp install delete `.omp/hooks/<rel>` for every `obsolete.runtimeFiles` entry under `hooks/`; one new test file.
- Out: `status.cjs`, `context.cjs`, schema (task-02); self-test anchors and docs (task-03); entries in `.claude/settings.local.json` or `~/.claude/settings.json`; a user-modified `.omp/extensions/cafekit-bridge.mjs`.

## Coverage
- CP-01

## Ownership
- Delete: `src/claude/hooks/usage.cjs`
- Modify: `src/claude/settings/settings.json`, `src/claude/migration-manifest.json`, `src/omp/extensions/cafekit-bridge.mjs`, `bin/phases/omp-runtime.js`
- Create: `bin/__tests__/usage-hook-retired.test.js`
- Read: `bin/phases/claude-runtime.js:168-190`, `bin/phases/claude-settings.js:21-61`, `bin/phases/codex-hooks.js:140-160`, `bin/__tests__/orca-skill.test.js` (install helper), `bin/__tests__/omp-bridge.test.js:52-63`

## Steps
1. Write `bin/__tests__/usage-hook-retired.test.js` (orca-style `inTempProject` + `install(root, platforms)` with `--yes`, `PATH=/usr/bin:/bin`) with exactly four tests:
   - `fresh claude install ships no usage hook` — no `.claude/hooks/usage.cjs`; no command in `.claude/settings.json` contains `usage.cjs`.
   - `upgrade removes an installed usage hook and its CafeKit entries but keeps a foreign one` — install claude; write arbitrary bytes (`// user edit`) to `.claude/hooks/usage.cjs`; insert `node "$CLAUDE_PROJECT_DIR/.claude/hooks/usage.cjs"` into the UserPromptSubmit group and as a new PostToolUse `Edit|Write|MultiEdit` group, plus a foreign UserPromptSubmit command `node ~/my-hooks/usage.cjs`; reinstall; assert the file is gone, neither CafeKit command remains, the foreign command remains, and every other command from the first install remains.
   - `omp upgrade removes an installed usage hook and its manifest record` — install omp; write `.omp/hooks/usage.cjs` and add the key `.omp/hooks/usage.cjs` to `.omp/cafekit-manifest.json` (omp records keys relative to the project root, `recordRoot: '.'`, `bin/lib/context.js:139-140`); reinstall; assert the file is gone and the manifest has no `.omp/hooks/usage.cjs` key.
   - `no runtime ships or bridges usage.cjs` — `runtime.files` has no `hooks/usage.cjs`; `cafekit-bridge.mjs` has no `'usage.cjs'`; `src/claude/hooks/usage.cjs` does not exist; `obsolete.runtimeFiles` has `hooks/usage.cjs` and `obsolete.settingsHookCommandSubstrings` has `.claude/hooks/usage.cjs`; the **source** `src/claude/settings/settings.json` has no matcher group whose `hooks` array is empty (the installer's merge drops empty groups, so only the source can show one).
2. Run the Verification Plan Command once and expect failure (pre-change).
3. Edit `settings.json`: drop the UserPromptSubmit `usage.cjs` hook and the PostToolUse `Edit|Write|MultiEdit` group.
4. Edit the manifest: drop `hooks/usage.cjs` from `runtime.files`; append `hooks/usage.cjs` to `obsolete.runtimeFiles` and `.claude/hooks/usage.cjs` to `obsolete.settingsHookCommandSubstrings`.
5. Remove `'usage.cjs'` from both lists in `cafekit-bridge.mjs` (`:44,46`).
6. In `omp-runtime.js`, after `installHooks`, delete `.omp/hooks/<name>` for each `obsolete.runtimeFiles` entry `hooks/<name>` that exists (skip under dry-run), as `claude-runtime.js:171-188` does, but prune the omp tracker with `tracker.prune(tracker.keyFor(absPath))` (`bin/lib/manifest.js:85-91,119`), not with the bare `hooks/<name>`, because the omp tracker keys are `.omp/…`.
7. `git rm src/claude/hooks/usage.cjs`; run the Command.

## Acceptance
- AC-01, AC-02, AC-03: the four named tests pass and the regression files in the Command stay green. The package self-test runner is expected to fail between task-01 and task-03 (its anchors at `run-skill-self-tests.mjs:5531` and `:5547` name the removed file and constant); task-03 restores it.

## Dependencies
- none

## Verification Plan
- Command: `test ! -e src/claude/hooks/usage.cjs && test -f bin/__tests__/usage-hook-retired.test.js && node --test bin/__tests__/usage-hook-retired.test.js 2>&1 | tee /dev/stderr | grep -q '^# pass 4$' && node --test bin/__tests__/optional-skill-inventory.test.js bin/__tests__/omp-bridge.test.js bin/__tests__/omp-runtime.test.js bin/__tests__/codex-hooks-ownership.test.js bin/__tests__/package-inventory.test.js 2>&1 | tee /dev/stderr | grep -q '^# fail 0$'`
- Named probe: the four tests above; `omp-bridge.test.js:52-63` (bridge lists equal `settings.json`); `codex-hooks-ownership.test.js:181` (obsolete substring list on Codex); `package-inventory.test.js` packed install.
- Reachability: source + installed — `bin/install.js` into temp git projects for `claude` and `omp`, no network.
- Oracle: exit 0; the new file reports exactly `# pass 4`; the regression run reports `# fail 0`.
- Counterexample: omitting the omp prune fails the omp test; keeping the bare substring `hooks/usage.cjs` deletes the foreign command and fails the upgrade test; leaving an empty `Edit|Write|MultiEdit` group in the source fails `no runtime ships or bridges usage.cjs`; pruning the omp tracker with `hooks/usage.cjs` leaves the manifest key and fails the omp test; a skipped or missing test changes the pass count.
- Artifacts: ephemeral temp projects removed by the tests.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `test ! -e src/claude/hooks/usage.cjs && test -f bin/__tests__/usage-hook-retired.test.js && node --test bin/__tests__/usage-hook-retired.test.js 2>&1 | tee /dev/stderr | grep -q '^# pass 4$' && node --test bin/__tests__/optional-skill-inventory.test.js bin/__tests__/omp-bridge.test.js bin/__tests__/omp-runtime.test.js bin/__tests__/codex-hooks-ownership.test.js bin/__tests__/package-inventory.test.js 2>&1 | tee /dev/stderr | grep -q '^# fail 0$'`
Exit: 0
Base: 9f8138238923b1f01cb0be84ce9f13a1c6063522
Head: 20f525ebb85e824ee4ce3fe6f1285bbac805344785f31b28a6c8b75ca751d6b4
```text
$ (packages/spec) <Command above>   # summary lines; EXIT=0
ok 1 - fresh claude install ships no usage hook
ok 2 - upgrade removes an installed usage hook and its CafeKit entries but keeps a foreign one
ok 3 - omp upgrade removes an installed usage hook and its manifest record
ok 4 - no runtime ships or bridges usage.cjs
# tests 4
# pass 4
# fail 0
ok 6 - obsolete CafeKit hooks are pruned while similarly named foreign hooks stay
ok 10 - the dispatch table mirrors settings.json for every event omp can deliver
ok 20 - an omp install creates hooks, an extensions directory, and platform metadata
ok 42 - npm dry-run inventory is deterministic and preserves runtime payload
ok 59 - packed Codex live host E2E via codex binary (opt-in) # SKIP opt-in only: set CAFEKIT_CODEX_HOST_E2E=1 to run live Codex host
# tests 59
# pass 58
# fail 0
# skipped 1
```
Pre-change run of the same Command exited 1 at `test ! -e src/claude/hooks/usage.cjs`; the four new tests were all `not ok` before the change. The package self-test runner is expected to stay red until task-03 (anchors at `run-skill-self-tests.mjs:5531,5547`).
