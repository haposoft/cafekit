# Task 02 — Plan merged files

Status: done

## Outcome
`planMergedFiles(projectRoot, manifestPlan)` returns the planned new contents of every file CafeKit merged into, removing only CafeKit entries, keeping user entries and the ignore protection of every kept path, and lists what the plugins will not take over.

## Scope
- In:
  - `.claude/settings.json`: drop a handler only when its command equals a command in `packages/spec/src/claude/settings/settings.json` or runs `$CLAUDE_PROJECT_DIR/.claude/hooks/<script>.cjs` whose `hooks/<script>.cjs` is a manifest key planned `remove`; drop empty `hooks` groups, events and the `hooks` key; drop `statusLine` only when it equals CafeKit's command and `status.cjs` is planned `remove` (report "run `/cf:setup-statusline`"); `outputStyle` is left as it is (task-01 keeps the selected style file, D-03); keep every other key.
  - `.codex/hooks.json`: drop handlers `managedHandlerScript` recognizes (`packages/spec/bin/phases/codex-hooks.js:90`); then evaluate `hasProjectCafekitHooks` (`packages/spec/src/codex/hooks/lib/hook-context.cjs`) against the planned contents and kept files, and list every handler that would still keep the Codex plugin standing down.
  - `CLAUDE.md`: drop the `CAFEKIT CLAUDE` block; when `AGENTS.md` keeps user bytes, keep or add a line `@AGENTS.md` outside the blocks; an empty file is removed. `AGENTS.md`: drop `CAFEKIT CORE` and `CAFEKIT CODEX` (report that the language choice in CORE goes). `managedRange` returning `false` (duplicated or unbalanced markers) → `unparsed`, file kept.
  - Root `.gitignore`: the block is the header `# CafeKit / Ecosystem` plus the contiguous lines in CafeKit's pattern set (`packages/spec/bin/phases/root-config.js:30,105-120`); remove a block line only when its folder is gone after the plan; always keep `.cafekit-backup/`, `.cafekit.lock`, plan patterns, `specs/_shared/`, `.omp/`; lines outside the block are never touched.
  - `.omp/cafekit-manifest.json` present → the plan is marked `refused: omp` (D-06). Report that a Grok setup using the Claude install loses its hooks.
  - JSON that does not parse → `unparsed`, kept, and its referenced hook scripts kept.
- Out: writing; manifest files (task-01).

## Coverage
- CP-02

## Ownership
- Create: `packages/spec/bin/lib/migrate-merged.js`
- Create: `packages/spec/bin/__tests__/migrate-merged.test.js`
- Read: `packages/spec/bin/lib/instruction-blocks.js`, `packages/spec/bin/phases/root-config.js`, `packages/spec/bin/phases/codex-hooks.js`, `packages/spec/src/codex/hooks/lib/hook-context.cjs`, `packages/spec/src/claude/settings/settings.json`

## Steps
1. Write the merged-file planner.
2. Fixture as task-01, plus: a user hook `$CLAUDE_PROJECT_DIR/.claude/hooks/user-lint.cjs` (file present) in settings.json, a user handler `'<root>/.codex/hooks/my.cjs'` in hooks.json, user text before and after the AGENTS.md blocks, a user `.gitignore` line directly after `.agents/` with no blank line, and `.claude/.env`.

## Acceptance
- AC-02: the user Claude hook and its registration survive; every CafeKit handler is gone and no empty container remains; the Codex user handler survives and is listed as keeping the plugin standing down; AGENTS.md keeps the user text; CLAUDE.md keeps `@AGENTS.md`; with the planned `.gitignore` and the planned removals applied to a copy of the fixture, `git check-ignore .claude/.env` still succeeds and the user line stays; an `.omp/cafekit-manifest.json` fixture is `refused: omp`; unbalanced markers are `unparsed`.

## Dependencies
- task-01-plan-manifest-files.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/migrate-merged.test.js`
- Named probe: `migrate-merged.test.js` (claude-user-hook-kept, cafekit-handlers-dropped, statusline-rule, outputstyle-unchanged, codex-standdown-reported, agents-import-kept, env-stays-ignored, gitignore-user-line-kept, omp-refused, markers-unparsed).
- Reachability: source — `planMergedFiles` on a real npx install in a temp repo; `git check-ignore` on a disposable copy.
- Oracle: planned file contents; `git check-ignore` exit 0; reported lists.
- Counterexample: dropping every `.claude/hooks/*.cjs` handler or the whole `.gitignore` block → `claude-user-hook-kept` or `env-stays-ignored` red.
- Artifacts: ephemeral temp repos, removed in `after`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/migrate-merged.test.js
Exit: 0
Base: 32ef63d6daf052d6bb6e938e73714e8930f70f88
Head: de24c4764f214476925303804e5bc286001c18c47250a2840c6aff615c44be4c
```text
$ node --test packages/spec/bin/__tests__/migrate-merged.test.js
✔ claude-user-hook-kept: a user hook script and its registration survive (87.484041ms)
✔ cafekit-handlers-dropped: no CafeKit handler and no empty container remain (141.971708ms)
✔ dangling-handler-reported: a kept handler that still runs a removed hook is reported (232.063833ms)
✔ statusline-rule: the status line goes only with status.cjs (302.934167ms)
✔ outputstyle-unchanged: the selected output style stays as written (70.1525ms)
✔ codex-standdown-reported: a user handler under .codex/hooks survives and is reported (361.389875ms)
✔ agents-import-kept: AGENTS.md keeps the user text and CLAUDE.md keeps importing it (440.915167ms)
✔ env-stays-ignored: after the planned removals .claude/.env is still ignored (583.670333ms)
✔ gitignore-user-line-kept: a user line right after the CafeKit block stays (296.615ms)
✔ omp-refused: a repository with an omp install is refused (223.087041ms)
✔ markers-unparsed: duplicated or unbalanced markers leave the file untouched (521.9445ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5620.547416
EXIT=0
```

Reachability: source — `planMergedFiles` on real npx 0.18.2 installs (`claude,codex --with-document-skills` and `codex` only; cwd = temp repo, temp HOME); `git check-ignore` on disposable copies with the plan applied, git isolated from the global ignore file (`GIT_CONFIG_GLOBAL=/dev/null`, temp HOME/XDG_CONFIG_HOME).
Negative proof: in-place mutations (file restored, sha256 checked) — dropping the whole `.gitignore` block reds `env-stays-ignored` and `gitignore-user-line-kept`; dropping every `.claude/hooks` handler reds `claude-user-hook-kept` and `cafekit-handlers-dropped`; judging folders only by the manifest plan reds `env-stays-ignored`; dropping the realpath directory check reds `codex-standdown-reported`.
Review: code-auditor round 1 FAIL (Critical: `.claude/`/`.codex/`/`.agents/` ignore line removed while an absent or refused install still owns the folder), round 2 PASS.
Ownership deviation: `packages/spec/bin/phases/codex-hooks.js` (listed Read) gains one export, `managedHandlerScript`, because the task Scope names that function and it was not exported; no behavior change (`codex-hooks.test.js` + `codex-hooks-ownership.test.js` 112/112). `hasProjectCafekitHooks` is not exported either; `codexStandDown` mirrors it and task-04 checks the real hook.
Added probe: `dangling-handler-reported`.
Limitations: the "kept (edited) but no longer registered" report repeats once per dropped handler; the `@AGENTS.md` line added to a CRLF CLAUDE.md uses LF; a hook config that does not parse keeps every hook script of that platform.
