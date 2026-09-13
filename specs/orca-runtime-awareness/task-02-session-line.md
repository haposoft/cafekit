# Task 02 — SessionStart names the Orca pane and never a token

Status: done

## Outcome
When a session starts inside an Orca pane, the first line the CafeKit session hook prints for Claude Code and for Codex ends with `Orca: pane`, so an agent whose host reads that line knows where it is before the user says a word. Outside Orca the line is byte-identical to today. The same environment carries two credentials, `ORCA_AGENT_HOOK_TOKEN` and `ORCA_AGENT_LAUNCH_TOKEN`, and neither the line, stderr, nor the env file the Claude hook writes ever contains them.

## Scope
- In: one `parts.push('Orca: pane')` appended after the `Branch:` entry in `src/claude/hooks/session.cjs:252-258` and after the `branch &&` entry in `src/codex/hooks/session.cjs:94-99`, guarded by `typeof process.env.ORCA_PANE_KEY === 'string' && process.env.ORCA_PANE_KEY !== ''`; no other variable is read or written; the value of `ORCA_PANE_KEY` is not printed. A test that runs both hooks as child processes with a controlled environment.
- Out: `ORCA_TERMINAL_HANDLE` or any other value in the line (the agent can read its own environment; a printed value would be the only real value in a `|`-joined context line); writing any `ORCA_*` key into the env file; the omp bridge (it discards `session_start` stdout, recorded in `plan.md`); Grok (SessionStart is passive there); whether Codex feeds the line to the model (`[UNVERIFIED]` in `plan.md`).

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/hooks/session.cjs` (the `parts` block at `:252-258`; not `writeEnv` at `:30-41`)
- Modify: `packages/spec/src/codex/hooks/session.cjs` (the `parts` array at `:94-99`)
- Create: `packages/spec/bin/__tests__/orca-session.test.js`
- Read: `packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js:46` (how the Claude hook is driven and where its env file lands), `packages/spec/bin/__tests__/codex-native.test.js:2031` (the one place the Codex session hook is driven today)

## Acceptance
- AC-02 as stated in `plan.md`.
- **The test controls its environment.** Every case builds `env` from a copy of `process.env` with every key starting with `ORCA_` deleted, then adds only the variables the case needs. Without this the negative cases pass on a machine outside Orca and fail inside one — the user's default — because every existing hook fixture spawns with `{...process.env}`.
- **The Orca part is last.** It is appended after the detected parts, so a project with facts prints `Session startup. Type: … | Branch: dev | Orca: pane` and a bare directory (no git, no `package.json`) prints `Session startup. Type: app | Orca: pane` — corrected from the plan's original "empty directory prints `Orca: pane` alone" wording after reading `detectProjectType` in both hooks, which always resolves to at least `app` and never returns empty. A pane session can therefore never print the `No project info detected.` fallback or an Orca-only line; that detector is pre-existing and out of scope to change, so `Type: app | Orca: pane` is the true achievable minimum.
- **Tokens are grepped everywhere.** With both token variables set to distinct sentinel strings, the sentinels appear nowhere in stdout, stderr, or the Claude env file; the assertion runs over the whole outputs.
- **The Codex hook has its own runner.** No existing suite other than `codex-native.test.js:2031` drives `src/codex/hooks/session.cjs`; the new test spawns it directly with `spawnSync(process.execPath, [file], { input, env })`, and `codex-native.test.js` runs as the guard.

## Dependencies
- none

## Verification Plan
- Command: `node --test bin/__tests__/orca-session.test.js src/claude/hooks/__tests__/*.test.js bin/__tests__/codex-native.test.js`
- Named probe: `the Claude session line ends with Orca: pane`, `the Codex session line ends with Orca: pane`, `no Orca part outside a pane, byte for byte`, `an empty project inside a pane still prints the marker`, `no token ever reaches stdout, stderr, or the env file`; every existing case in the hook suite and `Codex Windows hook launchers stay project-bound without Git from nested cwd` (codex-native, which runs the Codex session hook) as regression guards.
- Reachability: known — both hooks are run as child processes with an explicit `env`; the Claude hook's env file path comes from `CLAUDE_ENV_FILE` as in `session-writeenv.test.js`.
- Oracle: first stdout line matches `/^Session \S+\. .*Orca: pane$/` with the variable and is byte-equal to the no-variable line plus ` | Orca: pane`; on a bare directory that line is `Session startup. Type: app | Orca: pane`, the achievable minimum since `detectProjectType` never returns empty; `doesNotMatch(/Orca/)` without it; `doesNotMatch(<sentinel>)` on stdout, stderr, and the env file.
- Counterexample: printing `process.env.ORCA_AGENT_HOOK_TOKEN` anywhere must fail the token case; keying on `ORCA_TERMINAL_HANDLE` instead of `ORCA_PANE_KEY` must fail the no-part case when only the handle is set; writing an `ORCA_` key into the env file must fail the token case's file grep; spawning with `{...process.env}` unstripped must fail the no-part case inside an Orca pane.
- Artifacts: ephemeral, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/orca-session.test.js src/claude/hooks/__tests__/*.test.js bin/__tests__/codex-native.test.js
Exit: 0
Base: 2fdc0ac910e34df4fa9175bdfac77a9f456620a3
Head: 0c289e13acf4dc4abaa53c1361e46e28fa39bca2e70a290bdc6893618d633b59
```text
$ node --test bin/__tests__/orca-session.test.js src/claude/hooks/__tests__/*.test.js bin/__tests__/codex-native.test.js
✔ Codex Windows hook launchers stay project-bound without Git from nested cwd (2868.744125ms)
…
✔ the Claude session line ends with Orca: pane (1705.332292ms)
✔ no Orca part outside a pane, byte for byte (1632.551708ms)
✔ keying on ORCA_TERMINAL_HANDLE instead of ORCA_PANE_KEY must not add the marker (1291.407584ms)
✔ an empty project inside a pane still prints the marker (999.961708ms)
✔ no token ever reaches stdout, stderr, or the Claude env file (1228.395083ms)
✔ the Codex session line ends with Orca: pane (1713.711042ms)
✔ no Orca part outside a pane on Codex, byte for byte (1495.490584ms)
✔ an empty Codex project inside a pane still prints the marker (490.106916ms)
✔ no token ever reaches stdout or stderr on Codex (804.084958ms)
…
ℹ tests 260
ℹ suites 0
ℹ pass 260
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Counterexamples ran on a full-copy temp root (`bin/`, `src/`, `scripts/`, `package.json` copied; only `node_modules` symlinked, per the methodology task-01 corrected). Four mutations were checked: pushing `` `Token: ${process.env.ORCA_AGENT_HOOK_TOKEN}` `` into the Claude hook's `parts` turned the 9-test baseline into 6 pass/3 fail, the sentinel visible in the failing assertion's `actual` value; keying the Claude hook's guard on `ORCA_TERMINAL_HANDLE` instead of `ORCA_PANE_KEY` gave 5 pass/4 fail, including the counterexample's own named case; writing an extra `writeEnv(envFile, 'ORCA_HOOK_TOKEN_LEAK', process.env.ORCA_AGENT_HOOK_TOKEN)` into the Claude hook gave a clean 8 pass/1 fail, isolating exactly the token-in-env-file case; and reverting `baseEnv()` in the test file itself to unstripped `{...process.env, ...overrides}`, run under this very session's own ambient Orca pane (16 real `ORCA_*` variables present, `ORCA_PANE_KEY` confirmed set without printing its value), gave 4 pass/5 fail — the exact failure mode the task's env-stripping requirement exists to prevent. Each mutation was reverted; `diff -rq` against the tracked `bin/` and `src/` trees after all four returned no differences.

The task and plan's original oracle wording for the minimum case ("a directory with no other project facts" prints `Orca: pane` alone, or `Session <source>. Orca: pane` when empty) was corrected before this receipt: `detectProjectType` in both `session.cjs` hooks always resolves to at least `app` and never returns empty, verified by reading both functions' source and by direct probes of each hook against bare temp directories (no git, no `package.json`) with `ORCA_PANE_KEY` set. A pane session can therefore never print the `No project info detected.` fallback or an Orca-only line; the achievable minimum, confirmed by the standalone probes above, is `Session startup. Type: app | Orca: pane`. `plan.md`'s AC-02 row, this task's Acceptance and Oracle text, and the Review log were updated to match; no scope, ownership, or dependency changed, and the detector itself (pre-existing, out of scope) was not touched.
