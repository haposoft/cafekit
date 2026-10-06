# Task 01 — on Claude, `spec-state` speaks only about packets this session touched

Status: done

## Outcome
A Claude session no longer sees the tollgate of a packet another session is working on, while omp, Codex and session-less payloads behave exactly as before.

## Scope
- In: a per-session touch set in `spec-state.cjs`, stored in `lib/hook-state-dir.cjs`'s dir as `spec-touched-<full sha256 hex of the session id>.json` (no 12-char slice; self-test `run-skill-self-tests.mjs:5114-5120`). Order inside the hook: (1) right after reading the payload, if `hook_event_name` is `PostToolUse` and the tool is `Edit|Write|MultiEdit`, compare `realpath(tool_input.file_path)` (or of its deepest existing parent) with `realpath(<specsRoot>)/<f>/`, record `<f>`, exit 0 with no output — no resolve, no git, no cache; (2) on UserPromptSubmit, before resolving (`:87`), record every existing packet `<f>` (directories under `RESOLVER.specsDirectory(baseDir, runtime)`) that the prompt names as `specs/<f>`, as a `/cf:<cmd> <f>` token, or as a bare token when `<f>` contains `-`, `_` or a digit (regex-escaped), plus the payload's `featureName`; (3) after resolving and before the cache read at `:189`, exit 0 with no output when `runtimeDirName() === '.claude'`, the **raw** payload has a snake_case `session_id`, and the resolved packet is not in the set. Register `spec-state.cjs` on PostToolUse `Edit|Write|MultiEdit` in Claude `settings.json`. In `omp-bridge.test.js:53-63` replace exact mirroring with `DISPATCH = registered − CLAUDE_ONLY + OMP_ONLY`, `CLAUDE_ONLY = { PostToolUse: ['spec-state.cjs'] }`, and assert each listed divergence is still a real difference (so the test fails once omp catches up).
- Out: warning lines printed before a packet is resolved; omp bridge code; Codex; grok.

## Coverage
- CP-01

## Ownership
- Modify: `src/claude/hooks/spec-state.cjs`, `src/claude/settings/settings.json`, `bin/__tests__/omp-bridge.test.js`
- Create: `src/claude/hooks/__tests__/spec-state-touched.test.js`
- Read: `src/claude/hooks/__tests__/state.test.js:38-106` (installed fixture), `src/claude/hooks/lib/runtime-dir.cjs`, `src/claude/hooks/lib/hook-state-dir.cjs`

## Steps
1. Write `spec-state-touched.test.js` reusing the installed-fixture pattern of `state.test.js:38-106` (hooks under `<tmp>/.claude/hooks`, one process-first packet `auth-flow`, plus a second packet `docs`), with exactly seven tests:
   - `an untouched packet prints nothing on Claude` — prompt `Continue`, `session_id: s1` → stdout empty, `tollgate-last.txt` absent.
   - `naming the packet in the prompt touches it and keeps the full block` — prompt `Continue` (empty), then `continue auth-flow` → `/Spec state changed/`, then `Continue` → the one-line form.
   - `editing a file inside the packet touches it silently` — PostToolUse `Edit` on a **non-canonical** path to `specs/auth-flow/plan.md` (built through `/var/...` when the fixture is under `/private/var`, else a symlinked parent) for `s2` → stdout empty and cache unchanged; then UserPromptSubmit `Continue` for `s2` → `/Spec state changed/`.
   - `a plain one-word slug needs specs/ prefix` — with `docs` the only active packet, prompt `fix the docs` → empty; `look at specs/docs` → prints.
   - `another session's touch does not leak` — touch with `s3`, prompt with `s4` → empty.
   - `omp, grok and session-less payloads keep the old behaviour` — the same fixture under `.omp/hooks` with `session_id: s5`, the Claude copy with `sessionId: s6` (grok shape), and with no session id → all three print.
   - `a prompt touch is remembered even when two packets are active` — two active packets, prompt `specs/auth-flow` (multiple-active warning), then close the other packet, prompt `Continue` → prints `auth-flow`.
2. Run the Command and expect failure.
3. Implement in `spec-state.cjs`; add the PostToolUse group to `settings.json`.
4. Run the Command.

## Acceptance
- AC-01, AC-02: the seven tests pass; existing `state.test.js` spec-state tests (which send `featureName: 'auth'`) and the omp parity test with its divergence list still pass.

## Dependencies
- none

## Verification Plan
- Command: `test -f src/claude/hooks/__tests__/spec-state-touched.test.js && node --test src/claude/hooks/__tests__/spec-state-touched.test.js 2>&1 | tee /dev/stderr | grep -q '^# pass 7$' && node --test src/claude/hooks/__tests__/state.test.js bin/__tests__/spec-narrowing.test.js bin/__tests__/omp-bridge.test.js 2>&1 | tee /dev/stderr | grep -q '^# fail 0$'`
- Named probe: the seven tests above; `Claude installed spec-state re-evaluates a standalone task when blocked becomes pending` (`state.test.js:108`); `the dispatch table mirrors settings.json for every event omp can deliver` (`omp-bridge.test.js`).
- Reachability: source + installed-shape fixture; no network.
- Oracle: exit 0; exactly `# pass 7`; regression run `# fail 0`.
- Counterexample: dropping the runtime or snake_case check empties the omp/grok case; keying the set without the session id leaks; a PostToolUse branch that resolves or writes the cache fails the silent-edit case; lexical containment fails the non-canonical edit; filtering after the cache leaves only the one-line form after a later touch; recording after resolve loses the two-packet touch.
- Artifacts: ephemeral temp projects.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `test -f src/claude/hooks/__tests__/spec-state-touched.test.js && node --test src/claude/hooks/__tests__/spec-state-touched.test.js 2>&1 | tee /dev/stderr | grep -q '^# pass 7$' && node --test src/claude/hooks/__tests__/state.test.js bin/__tests__/spec-narrowing.test.js bin/__tests__/omp-bridge.test.js 2>&1 | tee /dev/stderr | grep -q '^# fail 0$'`
Exit: 0
Base: c11904f09ca62aca260785f47df85d061e1f8cd7
Head: 6bf1139e979675a38094a8b8e08ccb0fb5f4f4a3ec3da7e60b6a5a8cdc95bf49
```text
$ (packages/spec) <Command above>   # summary lines; EXIT=0
# tests 7
# pass 7
# fail 0
# tests 38
# pass 38
# fail 0
```
Pre-change run of the new file: `# pass 2` `# fail 5` — the five filter cases failed (the hook printed for every session); the omp/grok/session-less case and the two-packet case passed because they assert the unchanged behaviour.
