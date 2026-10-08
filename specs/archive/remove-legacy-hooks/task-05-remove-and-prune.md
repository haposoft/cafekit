# Task 05 — delete the five hooks everywhere and prune them on upgrade (Claude, Codex, omp)

Status: done

## Outcome
No runtime ships, registers or bridges `completion-authority.cjs`, `completion-authority-check.cjs`, `completion-authority-state.cjs`, `semantic-review-authority.cjs` or `task-scaffold-guard.cjs`; upgrading a Claude, Codex or omp project deletes installed copies (any content), their manifest records and the CafeKit registrations, while foreign hooks with the same file names survive. The shipped omp bridge never lists a gate whose file is gone (a user-modified bridge is out of scope by DN-01, plan Out of scope).

## Scope
- In: `src/claude/settings/settings.json` — drop the UserPromptSubmit `completion-authority.cjs` hook (`:59`), the whole PreToolUse `Write` group (`:83-90`, its only hook is the scaffold guard), the Stop `completion-authority.cjs` hook (`:121`) and the SubagentStop `semantic-review-authority.cjs` hook (`:135`).
- In: `src/codex/hooks.json` — drop the same three registrations (`:51-55`, `:83-87`, `:111-115`, `:128-132`), keeping every group that still has hooks.
- In: `src/omp/extensions/cafekit-bridge.mjs` — drop `'completion-authority.cjs'` from `input` and `session_stop` and `'task-scaffold-guard.cjs'` from `tool_call` (`:44,45,47`); reword the header so it no longer names `semantic-review-authority.cjs` (`:23-24`).
- In: `src/claude/migration-manifest.json` — drop the five `hooks/<name>` from `runtime.files` (`:140,144-147`); append them to `obsolete.runtimeFiles`; append the nine D-01 substrings to `obsolete.settingsHookCommandSubstrings` (append only: `codex-hooks-ownership.test.js:188` reads `obsolete[0]`).
- In: `bin/phases/codex-runtime.js` — add `removeObsoleteCodexHooks(ctx, platformKey)` per D-02 (only the deletion depends on the file existing; `tracker.prune(tracker.keyFor(target))` runs for every obsolete `hooks/` entry, outside dry-run) and call it right after the `copyManagedTree` of `src/codex/hooks` (`:59-66`).
- In: `bin/__tests__/omp-bridge.test.js` — drop the module-level `PREFIX` require (`:20`) and `the approval phrase reaches completion-authority through the input event` (`:165-174`); in `a crashing or missing gate blocks …` stub only `inspect-block.cjs` and say "the other PreToolUse gate" (`:145-148`); reword the comment `inspect-block / task-scaffold-guard exit 2 …` (`:101`) to name inspect-block only.
- In: `git rm` the ten hook files (`src/claude/hooks/<five>`, `src/codex/hooks/<five>`) and `src/claude/hooks/__tests__/completion-authority.test.js`, `src/claude/hooks/__tests__/semantic-review-authority.test.js`.
- In: create `bin/__tests__/legacy-hooks-retired.test.js` (helpers as in `usage-hook-retired.test.js:22-46`: temp git project, `bin/install.js --platform … --yes`, `PATH=/usr/bin:/bin`).
- Out: session hooks (task 06); schema (task 07); runner allowlist and changelogs (task 08); docs (3c); `.claude/settings.local.json`, `~/.claude/settings.json`, `~/.cafekit/completion-authority/`.

## Coverage
- CP-03

## Ownership
- Modify: `src/claude/settings/settings.json`, `src/codex/hooks.json`, `src/omp/extensions/cafekit-bridge.mjs`, `src/claude/migration-manifest.json`, `bin/phases/codex-runtime.js`, `bin/__tests__/omp-bridge.test.js`
- Create: `bin/__tests__/legacy-hooks-retired.test.js`
- Delete: the ten hook files and the two hook test files above
- Read: `bin/phases/omp-runtime.js:131-150` (prune to mirror), `bin/lib/manifest.js:79-125` (`keyFor`, `prune`), `bin/phases/codex-hooks.js:49-82,140-160,192-200` (launcher shape, prune, prune-before-repair order), `bin/phases/claude-runtime.js:168-190`, `bin/phases/claude-settings.js:20-61`

Six modified files, one above the usual five: the bridge test must change with the bridge, and splitting registrations from deletions would leave omp listing a missing gate.

## Steps
1. Write `legacy-hooks-retired.test.js` with exactly six tests (NAMES = the five files; REGISTERED = `completion-authority.cjs`, `semantic-review-authority.cjs`, `task-scaffold-guard.cjs`; foreign command = `node ~/my-hooks/<name>`):
   - `fresh installs ship and register none of the five legacy hooks` — `--platform claude,codex,omp` in one project; no NAME under `.claude/hooks`, `.codex/hooks`, `.omp/hooks`; no command in `.claude/settings.json` or `.codex/hooks.json` contains a NAME; the installed `.omp/extensions/cafekit-bridge.mjs` contains no NAME.
   - `claude upgrade removes the legacy hooks and their CafeKit entries but keeps foreign ones` — install claude; write `// user edit` to `.claude/hooks/<NAME>` ×5 and add keys `hooks/<NAME>` to `.claude/cafekit-manifest.json`; add `node "$CLAUDE_PROJECT_DIR/.claude/hooks/completion-authority.cjs"` to UserPromptSubmit and Stop, a PreToolUse `{ matcher: 'Write' }` group with the scaffold guard, the semantic hook to SubagentStop, and the three foreign commands to UserPromptSubmit; reinstall; assert the files and keys are gone, no command contains `.claude/hooks/<REGISTERED>`, the three foreign commands remain, and every command of the first install remains.
   - `codex upgrade removes the legacy hooks, their records and their CafeKit entries but keeps foreign ones` — install codex; write `.codex/hooks/<NAME>` for every NAME except `completion-authority-state.cjs` (a record whose file is already gone), and keys `.codex/hooks/<NAME>` for all five in `.codex/cafekit-manifest.json`; add three CafeKit handlers in the three shapes an installer wrote: the installed `spec-gate.cjs` POSIX launcher with `spec-gate.cjs` replaced by `completion-authority.cjs` (Stop), the template form `node ".codex/hooks/task-scaffold-guard.cjs"` (PreToolUse), and a Windows-path form `node 'C:\\work\\proj\\.codex\\hooks\\semantic-review-authority.cjs'` (SubagentStop); add the foreign `node ~/my-hooks/completion-authority.cjs` (UserPromptSubmit); reinstall; assert files and keys gone, no command contains `.codex/hooks/<REGISTERED>` or `.codex\hooks\<REGISTERED>`, the foreign command remains, every command of the first install remains.
   - `omp upgrade removes the legacy hooks and their records` — install omp; write `.omp/hooks/<NAME>` ×5 and keys `.omp/hooks/<NAME>`; reinstall; assert files and keys gone.
   - `omp upgrade replaces a pristine old bridge that still lists the removed gates` — install omp; overwrite `.omp/extensions/cafekit-bridge.mjs` with the installed bridge text with `'task-scaffold-guard.cjs'` added to `tool_call` and `'completion-authority.cjs'` to `input` and `session_stop`; record its sha256 under `.omp/extensions/cafekit-bridge.mjs` in `.omp/cafekit-manifest.json`; reinstall; assert the installed bridge names no NAME and equals `src/omp/extensions/cafekit-bridge.mjs` byte for byte.
   - `no source ships, registers or bridges the five legacy hooks` — the ten hook files and two hook tests do not exist; `runtime.files`, source `settings.json`, `hooks.json` and `cafekit-bridge.mjs` name no NAME; `obsolete.runtimeFiles` has all five `hooks/<NAME>`; `obsolete.settingsHookCommandSubstrings` has the nine D-01 entries and still starts with `hooks/skill-router.cjs`; no source `settings.json` group has an empty `hooks` array.
2. Run the Command once → expect failure (pre-change).
3. Edit `settings.json`, `hooks.json`, the bridge, the manifest as scoped.
4. Add the Codex prune to `codex-runtime.js`.
5. Edit `omp-bridge.test.js` as scoped.
6. `git rm` the twelve files.
7. Run the Command.

## Acceptance
- AC-04, AC-05: the six named tests pass; the full package runner passes with the files gone.

## Dependencies
- task-01-strict-unsupported.md
- task-02-agent-skill-text.md
- task-03-hook-behaviour-tests.md
- task-04-closure-tests.md

## Verification Plan
- Command: `F=/tmp/ck-3b-05.txt; G=/tmp/ck-3b-05-suite.txt; rm -f $F $G; test -f bin/__tests__/legacy-hooks-retired.test.js && node --test bin/__tests__/legacy-hooks-retired.test.js > $F 2>&1; tail -12 $F; grep -q '^# tests 6$' $F && grep -q '^# pass 6$' $F && grep -q '^# fail 0$' $F && node scripts/run-skill-self-tests.mjs > $G 2>&1; tail -4 $G; grep -qE '^\[skill-test\] PASS: [0-9]+ tests executed$' $G && rm -f $F $G`
- Named probe: the six tests above; `omp-bridge.test.js` `the dispatch table mirrors settings.json for every event omp can deliver`; `codex-hooks-ownership.test.js` `obsolete CafeKit hooks are pruned while similarly named foreign hooks stay`; `legacy-authority-decoupled.test.js` (gates and sessions with the files absent); the runner's settings/manifest consistency check.
- Reachability: source — the five source files and manifest; installed — `bin/install.js` into temp git projects for `claude`, `codex`, `omp`, first install then reinstall, no network.
- Oracle: exit 0; the new file reports exactly `# tests 6`, `# pass 6`, `# fail 0`; the runner prints `[skill-test] PASS`.
- Counterexample: without the Codex prune the codex test finds the files and `.codex/hooks/…` keys; with the shared substring `hooks/<name>` the foreign `~/my-hooks/<name>` commands are removed; without the backslash entries the Windows-path handler survives (it is then rewritten by `repairLegacyCodexLaunchers` into a `.codex/hooks/…` command, which the assertion also catches); pruning the Codex tracker with the bare `hooks/<name>`, or only when the file exists, leaves `.codex/hooks/<name>` keys (the codex test also adds one key whose file is absent: `.codex/hooks/completion-authority-state.cjs` is written to the manifest but not to disk); a bridge left with the gates fails the pristine-bridge test; keeping a bridge entry makes the fresh-install test and the bridge mirror test fail; prepending a substring breaks `codex-hooks-ownership.test.js:188`.
- Artifacts: `/tmp/ck-3b-05.txt`, `/tmp/ck-3b-05-suite.txt`, removed on success; temp projects removed by the tests.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3b-05.txt; G=/tmp/ck-3b-05-suite.txt; rm -f $F $G; test -f bin/__tests__/legacy-hooks-retired.test.js && node --test bin/__tests__/legacy-hooks-retired.test.js > $F 2>&1; tail -12 $F; grep -q '^# tests 6$' $F && grep -q '^# pass 6$' $F && grep -q '^# fail 0$' $F && node scripts/run-skill-self-tests.mjs > $G 2>&1; tail -4 $G; grep -qE '^\[skill-test\] PASS: [0-9]+ tests executed$' $G && rm -f $F $G`
Exit: 0
Base: 53cb60818600051701d069d5fb5fea85fac96f41
Head: 94d7cbb885777db3b14659adcfa28f42c693e4b39ef47105abf6b3e75ac5cf6d
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
# tests 6
# pass 6
# fail 0
[skill-test] PASS: 1580 tests executed
```
Pre-change run (implementer): the new test file did not exist, so `test -f` stopped the Command. No repair rounds. Twelve files deleted (five Claude hooks, five Codex hooks, two authority test files); the package total fell from 1630 to 1580 with those suites and the cases removed in tasks 01-04. New `removeObsoleteCodexHooks` in `bin/phases/codex-runtime.js` always prunes the tracker key and deletes the file only when it exists; the obsolete lists were appended, `obsolete[0]` unchanged.
