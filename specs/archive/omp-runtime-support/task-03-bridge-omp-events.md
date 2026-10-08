# Task 03 — The bridge maps omp events onto the forked hooks

Status: done
## Outcome
An extension loaded from `.omp/extensions/` receives omp lifecycle events, dispatches the matching forked hook with a Claude-shaped payload carrying a stable session identifier, and returns omp's block shape with the hook's own reason. A blocked turn can be approved and closed.

## Scope
- In: event mapping, payload shaping including session identity, verdict translation across all three denial mechanisms, the bridge's own timeout budget, the re-entry guard, and the approve path.
- Out: hook contract changes, owned by task 02.

## Coverage
- CP-03
- CP-04

## Ownership
- Create: `packages/spec/src/omp/extensions/cafekit-bridge.mjs`
- Create: `packages/spec/bin/__tests__/omp-bridge.test.js`
- Read: `packages/spec/src/claude/hooks/spec-gate.cjs`
- Read: `packages/spec/src/claude/hooks/completion-authority.cjs`
- Read: `packages/spec/src/claude/settings/settings.json`

## Acceptance
- AC-07: every dispatched payload carries a session identifier the bridge derives from omp's session context and keeps stable for that session, because omp's `input` payload is only `{ type, text, images, source }` and `src/claude/hooks/rules.cjs:57` exits when the identifier is absent.
- AC-08: a hook denying through any of the plan's three mechanisms yields omp's `{ block: true, reason }` carrying the hook's own reason text, including the exit-2 hooks whose reason arrives on stdout per `src/claude/hooks/inspect-block.cjs:91-96`.
- AC-09: a hook exceeding the bridge's budget yields a block naming that hook. The budget is fixed below omp's `extensionHandlers.toolCallTimeoutMs` default of 30000 ms so the bridge's reason wins over omp's substitute.
- AC-10: a `session_stop` payload with `stop_hook_active` true returns without dispatching the gate, matching `src/claude/hooks/spec-gate.cjs:82`.
- AC-11: the approval phrase produced by `src/claude/hooks/completion-authority.cjs:132-133` reaches that hook's approve path, which `:77` reaches only for a `UserPromptSubmit` event with a session id, so a blocked turn has a real exit.

## Dependencies
- task-02-fork-omp-hooks.md

## Verification Plan
- Command: `node --test bin/__tests__/omp-bridge.test.js`
- Named probe: the `each denial mechanism becomes an omp block`, `a slow hook blocks with its own name before omp cuts it off`, `stop_hook_active short-circuits the gate`, `the approval phrase reaches the approve path`, and `every dispatch carries a stable session id` cases in `bin/__tests__/omp-bridge.test.js`.
- Reachability: known — omp auto-discovery of `.omp/extensions/` and the `session_start` dispatch were observed on 2026-09-08 from a real `omp -p` run against a probe extension, and the omp contract rows in `plan.md` were read from the installed binary. The automated tests drive the bridge's exported functions against real child hook processes; they do not launch omp, which needs provider credentials. That gap is the reason AC-08 and AC-09 assert on the bridge's return value rather than on omp's observed behaviour.
- Oracle: each named case's assertion holds; a blocked dispatch reports the hook's own reason rather than a generic one.
- Counterexample: dropping the `stop_hook_active` guard must fail the third case; treating a non-zero exit as a bare block without reading stdout must fail the first; omitting session identity must fail the fifth.
- Artifacts: ephemeral temporary directories from `fs.mkdtempSync`, removed in `finally`.

## Receipt

Verification: PASS
Command: node --test bin/__tests__/omp-bridge.test.js
Exit: 0
Base: 39fd5ceab93ca78203f7194832d296c1deec9415
Head: 3e0ede44a864e9a36574eb90ee65309327015f5f4fa3fbf9a26a57a06ebf9fa2
```text
$ node --test bin/__tests__/omp-bridge.test.js
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
