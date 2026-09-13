# Task 02 — SessionStart names the Orca pane and never a token

Status: pending

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
- **The Orca part is last.** It is appended after the detected parts, so a project with facts prints `Session startup. Type: … | Branch: dev | Orca: pane` and an empty directory prints `Session startup. Orca: pane`; the `No project info detected.` fallback appears only when no part at all was collected.
- **Tokens are grepped everywhere.** With both token variables set to distinct sentinel strings, the sentinels appear nowhere in stdout, stderr, or the Claude env file; the assertion runs over the whole outputs.
- **The Codex hook has its own runner.** No existing suite other than `codex-native.test.js:2031` drives `src/codex/hooks/session.cjs`; the new test spawns it directly with `spawnSync(process.execPath, [file], { input, env })`, and `codex-native.test.js` runs as the guard.

## Dependencies
- none

## Verification Plan
- Command: `node --test bin/__tests__/orca-session.test.js src/claude/hooks/__tests__/*.test.js bin/__tests__/codex-native.test.js`
- Named probe: `the Claude session line ends with Orca: pane`, `the Codex session line ends with Orca: pane`, `no Orca part outside a pane, byte for byte`, `an empty project inside a pane still prints the marker`, `no token ever reaches stdout, stderr, or the env file`; every existing case in the hook suite and `Codex Windows hook launchers stay project-bound without Git from nested cwd` (codex-native, which runs the Codex session hook) as regression guards.
- Reachability: known — both hooks are run as child processes with an explicit `env`; the Claude hook's env file path comes from `CLAUDE_ENV_FILE` as in `session-writeenv.test.js`.
- Oracle: first stdout line matches `/^Session \S+\. .*Orca: pane$/` with the variable and is byte-equal to the no-variable line plus ` | Orca: pane` (or `Session <source>. Orca: pane` when empty); `doesNotMatch(/Orca/)` without it; `doesNotMatch(<sentinel>)` on stdout, stderr, and the env file.
- Counterexample: printing `process.env.ORCA_AGENT_HOOK_TOKEN` anywhere must fail the token case; keying on `ORCA_TERMINAL_HANDLE` instead of `ORCA_PANE_KEY` must fail the no-part case when only the handle is set; writing an `ORCA_` key into the env file must fail the token case's file grep; spawning with `{...process.env}` unstripped must fail the no-part case inside an Orca pane.
- Artifacts: ephemeral, removed in `finally`.

## Receipt
