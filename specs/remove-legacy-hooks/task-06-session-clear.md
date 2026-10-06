# Task 06 — session hooks stop clearing the authority state

Status: done

## Outcome
Claude and Codex SessionStart no longer reach for `completion-authority-state.cjs` (deleted in task 05; until now the guarded `require` just threw and was swallowed), and no test comment describes a removed hook as live.

## Scope
- In: delete the `try { require('./completion-authority-state.cjs').clearState(…) } catch {}` line in `src/claude/hooks/session.cjs:205` and `src/codex/hooks/session.cjs:91`. Keep Codex `clearState(projectRoot)` and its comment (`:89-90`, the privacy approval state from `lib/privacy-state.cjs`).
- In: comments only — `hook-payload.test.js:52-53` (drop the task-scaffold-guard clause, keep privacy-block and inspect-block), `:86` (drop the semantic-review-authority sentence or name a current reader of `agent_id`), `:105-107` (the write/edit split no longer protects a scaffold guard; state only a reason that still holds after the guard is gone, or drop the rationale; the assertions stay); `codex-hooks-ownership.test.js:139-140` ("state.cjs registers under several events by design").
- Out: any assertion change in those two test files.

## Coverage
- CP-05

## Ownership
- Modify: `src/claude/hooks/session.cjs`, `src/codex/hooks/session.cjs`, `bin/__tests__/hook-payload.test.js`, `bin/__tests__/codex-hooks-ownership.test.js`

## Steps
1. Delete the two session lines; edit the three comments.
2. Run the Command.

## Acceptance
- AC-06: the session cases pass on real Claude and Codex installs and composed Codex trees; the four files name no removed hook.

## Dependencies
- task-05-remove-and-prune.md

## Verification Plan
- Command: `F=/tmp/ck-3b-06.txt; rm -f $F; ! grep -niE 'completion-authority|semantic-review-authority|task-scaffold-guard|scaffold guard' src/claude/hooks/session.cjs src/codex/hooks/session.cjs bin/__tests__/hook-payload.test.js bin/__tests__/codex-hooks-ownership.test.js && grep -q '^  clearState(projectRoot);$' src/codex/hooks/session.cjs && node --test bin/__tests__/legacy-authority-decoupled.test.js bin/__tests__/orca-session.test.js bin/__tests__/hook-payload.test.js bin/__tests__/codex-hooks-ownership.test.js src/claude/hooks/__tests__/session-writeenv.test.js > $F 2>&1; tail -8 $F; grep -q '^# fail 0$' $F && grep -qE '^ok [0-9]+ - claude session starts without the legacy files$' $F && grep -qE '^ok [0-9]+ - codex session starts without the legacy files$' $F && grep -qE '^ok [0-9]+ - the Codex session line ends with Orca: pane$' $F && rm -f $F`
- Named probe: `claude session starts without the legacy files`, `codex session starts without the legacy files` (real installs, SessionStart exits 0), `the Codex session line ends with Orca: pane` (composed Codex tree, output unchanged), `session.cjs escapes shell metacharacters in GIT_BRANCH (no injection when sourced)`.
- Reachability: source + installed — `bin/install.js --platform claude,codex` and a hand-composed `.codex/hooks` tree.
- Oracle: exit 0; the grep finds nothing (today it matches `session.cjs:205`, Codex `session.cjs:91`, `hook-payload.test.js:52,86,105`, `codex-hooks-ownership.test.js:139`); `# fail 0`; the three named `ok` lines.
- Counterexample: deleting Codex `clearState(projectRoot)` as well would let privacy approvals outlive a session, and no existing test pins that call, so the Command greps for it; leaving either authority line fails the first grep.
- Artifacts: `/tmp/ck-3b-06.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3b-06.txt; rm -f $F; ! grep -niE 'completion-authority|semantic-review-authority|task-scaffold-guard|scaffold guard' src/claude/hooks/session.cjs src/codex/hooks/session.cjs bin/__tests__/hook-payload.test.js bin/__tests__/codex-hooks-ownership.test.js && grep -q '^  clearState(projectRoot);$' src/codex/hooks/session.cjs && node --test bin/__tests__/legacy-authority-decoupled.test.js bin/__tests__/orca-session.test.js bin/__tests__/hook-payload.test.js bin/__tests__/codex-hooks-ownership.test.js src/claude/hooks/__tests__/session-writeenv.test.js > $F 2>&1; tail -8 $F; grep -q '^# fail 0$' $F && grep -qE '^ok [0-9]+ - claude session starts without the legacy files$' $F && grep -qE '^ok [0-9]+ - codex session starts without the legacy files$' $F && grep -qE '^ok [0-9]+ - the Codex session line ends with Orca: pane$' $F && rm -f $F`
Exit: 0
Base: 53cb60818600051701d069d5fb5fea85fac96f41
Head: 7b44431acd0cf530b03b78f3f9892a0ca0b4fe2815a57de585efb73922aa08de
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
# tests 38
# pass 38
# fail 0
```
Implemented by the controller. Pre-change run exited 2 (non-zero as expected; the step that returned 2 rather than 1 was not isolated). Both authority-state clear lines removed; Codex `clearState(projectRoot)` (privacy) kept and pinned by the Command; four test comments reworded to reasons that hold without the removed hooks, assertions unchanged.
