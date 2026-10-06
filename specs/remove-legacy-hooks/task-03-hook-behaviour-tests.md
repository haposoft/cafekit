# Task 03 — hook-behaviour tests stop running the removed hooks

Status: done

## Outcome
The five test files that execute `task-scaffold-guard.cjs` or `completion-authority.cjs`, or read `semantic-review-authority.cjs` registrations or `completion-authority-check.cjs`, no longer do, and still pass, so task 05 can delete those files without turning these suites red.

## Scope
- In (delete whole cases, nothing else in the file):
  - `codex-hooks.test.js`: `Codex task scaffold hook blocks apply_patch Add File with stderr guidance` (`:614-629`); `semantic review authority hook is registered only for SubagentStop on Claude and Codex` (`:1039-1055`).
  - `grok-envelope.test.js`: `a nested task write is denied under the grok write tool` (`:137-165`); `the approval hook takes its approve path on a grok prompt` (`:209-233`).
  - `omp-hooks.test.js`: `a write to a scaffolded task path is guarded under omp lowercase names too` (`:120-137`).
  - `spec-narrowing.test.js`: `codex resolveCandidate agrees with the shared resolver` (`:191-204`, its subject is the removed Codex check module) and `the approval prompt names its feature` (`:284-294`).
- In: `runtime-dir.test.js` `advice names the directory the hook lives in` (`:139`) — delete only the task-scaffold-guard comment, call and assertion (`:146-148`); keep the inspect-block and agent checks.
- Out: `codex-hooks.test.js:1423` (`cat ~/.cafekit/completion-authority/hmac.key` is a generic `.key` privacy probe, kept); `hook-payload.test.js` comments (task 06); any production file.

## Coverage
- CP-04

## Ownership
- Modify: `bin/__tests__/codex-hooks.test.js`, `bin/__tests__/grok-envelope.test.js`, `bin/__tests__/omp-hooks.test.js`, `bin/__tests__/runtime-dir.test.js`, `bin/__tests__/spec-narrowing.test.js`
- Read: `bin/__tests__/hook-payload.test.js:45-90` (unit coverage of the grok/omp `write` alias and event-name mapping that remains after the grok and omp guard cases go)

## Steps
1. Delete the named cases and the three runtime-dir lines; remove imports or helpers left unused by the deletions only if the file's linting/run complains.
2. Run the Command.

## Acceptance
- AC-03 (part): the five files pass and no longer name `task-scaffold-guard`, `completion-authority` (except the kept `codex-hooks.test.js:1423` privacy probe) or `semantic-review-authority`.

## Dependencies
- none

## Verification Plan
- Command: `F=/tmp/ck-3b-03.txt; rm -f $F; node --test bin/__tests__/codex-hooks.test.js bin/__tests__/grok-envelope.test.js bin/__tests__/omp-hooks.test.js bin/__tests__/runtime-dir.test.js bin/__tests__/spec-narrowing.test.js > $F 2>&1; tail -8 $F; grep -q '^# fail 0$' $F && grep -qE '^# pass [1-9][0-9]*$' $F && ! grep -nE 'task-scaffold-guard|completion-authority|semantic-review-authority' bin/__tests__/grok-envelope.test.js bin/__tests__/omp-hooks.test.js bin/__tests__/runtime-dir.test.js bin/__tests__/spec-narrowing.test.js && ! grep -nE 'task-scaffold-guard|semantic-review-authority|completion-authority\.cjs|completion-authority-check' bin/__tests__/codex-hooks.test.js && rm -f $F`
- Named probe: the remaining cases in the five files (e.g. `advice names the directory the hook lives in`, `the codex gate consults the file only after its payload`).
- Reachability: source — each file installs or composes a temp runtime from `src/`.
- Oracle: exit 0; `# fail 0` with a non-zero pass count; the greps find nothing (today they match `grok-envelope.test.js:143,156,217,228`, `omp-hooks.test.js:130`, `runtime-dir.test.js:146-147`, `spec-narrowing.test.js:194,289`, `codex-hooks.test.js:616,1049`).
- Counterexample: a remaining case that still runs a removed hook passes now but is caught by the greps; deleting a whole runtime-dir case instead of three lines drops `inspect-block`/`agent` coverage — visible as the named probe missing.
- Artifacts: `/tmp/ck-3b-03.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3b-03.txt; rm -f $F; node --test bin/__tests__/codex-hooks.test.js bin/__tests__/grok-envelope.test.js bin/__tests__/omp-hooks.test.js bin/__tests__/runtime-dir.test.js bin/__tests__/spec-narrowing.test.js > $F 2>&1; tail -8 $F; grep -q '^# fail 0$' $F && grep -qE '^# pass [1-9][0-9]*$' $F && ! grep -nE 'task-scaffold-guard|completion-authority|semantic-review-authority' bin/__tests__/grok-envelope.test.js bin/__tests__/omp-hooks.test.js bin/__tests__/runtime-dir.test.js bin/__tests__/spec-narrowing.test.js && ! grep -nE 'task-scaffold-guard|semantic-review-authority|completion-authority\.cjs|completion-authority-check' bin/__tests__/codex-hooks.test.js && rm -f $F`
Exit: 0
Base: 53cb60818600051701d069d5fb5fea85fac96f41
Head: e54db7bf5564df45b3cffcd708adf618dbb08acece51f480f31313dea4cfc61b
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
# tests 79
# pass 79
# fail 0
```
Pre-change run (implementer): 86 tests passed but the Command exited 1 because its greps still found the removed hook names. One repair round: the `codex-hooks.test.js` case ends at :630, not :629 as scoped, and the first deletion left a stray closing brace.
