# Task 04 — gate and session closure tests stop copying the removed modules

Status: done

## Outcome
The tests that compose a Stop-gate or SessionStart runtime by hand no longer copy, require or expect the authority modules, and still pass, so they stay green when task 05 deletes the files.

## Scope
- In: `src/claude/hooks/__tests__/spec-gate.test.js` — remove the loop copying `completion-authority-check.cjs`, `completion-authority-state.cjs`, `semantic-review-authority.cjs` (`:298-300`); the gate no longer loads them (3a).
- In: `bin/__tests__/specs-v2-execution-closeout.test.js` — remove the module-level `CLAUDE_CHECK`/`CODEX_CHECK` requires (`:21-22`); keep only `spec-gate.cjs` in the Claude copy list (`:270-273`); delete the three cases that call the check module: `completion authority supports taskless v2 and binds task plan plus receipt bytes` (`:380-393`), `completion authority activates only at durable closeout and honors the Stop loop guard` (`:416-440`), `v2 floor merge keeps axes independent, planning controls artifact profile, and risks raise assurance floor` (`:442-459`, `mergePolicyFloor` is reachable only through the removed check module).
- In: `bin/__tests__/legacy-authority-decoupled.test.js` — `removeLegacyFiles` (`:40-48`) deletes each file with `fs.rmSync(target, { force: true })` and no longer asserts it was installed, so every case holds both before and after task 05.
- In: `bin/__tests__/orca-session.test.js` — `composeCodexHookTree` stops copying `completion-authority-state.cjs` (`:148-149`); Codex `session.cjs` loads it only inside a `try` (`src/codex/hooks/session.cjs:91`).
- Out: the session hooks themselves (task 06); deleting any hook (task 05).

## Coverage
- CP-04

## Ownership
- Modify: `src/claude/hooks/__tests__/spec-gate.test.js`, `bin/__tests__/specs-v2-execution-closeout.test.js`, `bin/__tests__/legacy-authority-decoupled.test.js`, `bin/__tests__/orca-session.test.js`

## Steps
1. Edit the four files as scoped.
2. Run the Command.

## Acceptance
- AC-03 (part): the four files pass; three of them name no `completion-authority` or `semantic-review-authority`; `legacy-authority-decoupled.test.js` no longer requires the files to be installed.

## Dependencies
- none

## Verification Plan
- Command: `F=/tmp/ck-3b-04.txt; rm -f $F; node --test src/claude/hooks/__tests__/spec-gate.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/legacy-authority-decoupled.test.js bin/__tests__/orca-session.test.js > $F 2>&1; tail -8 $F; grep -q '^# fail 0$' $F && grep -qE '^# pass [1-9][0-9]*$' $F && grep -qE '^ok [0-9]+ - codex session starts without the legacy files$' $F && ! grep -nE 'completion-authority|semantic-review-authority' src/claude/hooks/__tests__/spec-gate.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/orca-session.test.js && ! grep -n 'is installed before removal' bin/__tests__/legacy-authority-decoupled.test.js && rm -f $F`
- Named probe: `spec-gate.test.js` `installed Claude gate fails closed with a controlled decision when policy is missing or malformed`, `Claude adapter requires canonical SHA-256 only for a declared task artifact`, `empty or malformed Claude hook payload fails closed` (each failed in the deletion simulation only because of the copy loop); `Claude and Codex gates require task proof at every Stop and feature proof only at durable closeout`; the four Codex orca-session cases; `codex session starts without the legacy files`.
- Reachability: source — hand-composed runtimes under temp directories; installed — `legacy-authority-decoupled.test.js` runs `bin/install.js --platform claude,codex`.
- Oracle: exit 0; `# fail 0` with a non-zero pass count; the named `ok` line; the greps find nothing (today they match `spec-gate.test.js:299`, `specs-v2-execution-closeout.test.js:21-22,271-272`, `orca-session.test.js:148-149`, `legacy-authority-decoupled.test.js:44`).
- Counterexample: a leftover copy of a removed file passes now but fails the grep (and would fail with ENOENT after task 05, as observed in the simulation); keeping the presence assertion fails all eight decoupled cases after task 05.
- Artifacts: `/tmp/ck-3b-04.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3b-04.txt; rm -f $F; node --test src/claude/hooks/__tests__/spec-gate.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/legacy-authority-decoupled.test.js bin/__tests__/orca-session.test.js > $F 2>&1; tail -8 $F; grep -q '^# fail 0$' $F && grep -qE '^# pass [1-9][0-9]*$' $F && grep -qE '^ok [0-9]+ - codex session starts without the legacy files$' $F && ! grep -nE 'completion-authority|semantic-review-authority' src/claude/hooks/__tests__/spec-gate.test.js bin/__tests__/specs-v2-execution-closeout.test.js bin/__tests__/orca-session.test.js && ! grep -n 'is installed before removal' bin/__tests__/legacy-authority-decoupled.test.js && rm -f $F`
Exit: 0
Base: 53cb60818600051701d069d5fb5fea85fac96f41
Head: bddb54a64c45fe20c651a6e034c235e85b9b2f392a2ea74a313b1e2b87bf0d33
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
# tests 94
# pass 94
# fail 0
```
Pre-change run (implementer): 97 tests passed but the Command's greps still matched the copied authority modules (orca-session.test.js:148-149, specs-v2-execution-closeout.test.js:21-22,271-272, spec-gate.test.js:299) and the 'is installed before removal' assertion. 97 -> 94: three cases that called the check module were deleted as scoped.
