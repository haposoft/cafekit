# Task 07 — dead comments, the Codex wrapper and the unused binding removed

Status: done

## Outcome
No source comment points at the removed scaffold guard or completion authority, the unused Codex `resolvePersistedSpec` wrapper is gone, and the unused `event` binding left by 3b is removed; behaviour is unchanged.

## Scope
- In: `src/claude/scripts/validate-spec-output.cjs:726-729`: comment → " * Task files are created from the scaffold template, so every task starts as a" / " * stub full of `{{...}}` placeholders, and nothing guarantees the model FILLED it." (rest of the comment unchanged).
- In: `src/claude/scripts/spec-resolver.cjs:863-864`: " * Persisted spec resolution remains unchanged; process-v3 is an additive adapter." (drop "and never becomes completion-authority input by way of findAllSpecCandidates").
- In: `src/claude/hooks/lib/hook-payload.cjs:57-58`: "conflating them would make the scaffold guard reject ordinary edits." → "conflating them would gate an ordinary edit as a file creation."
- In: `src/codex/hooks/lib/spec-utils.cjs`: delete `function resolvePersistedSpec` (`:155-159` and the blank after) and its export line `:165`. No caller: the only other hits are the Claude resolver `spec-resolver.cjs:743,992` and `spec-narrowing.test.js`, which loads the Claude resolver (`:18`).
- In: `bin/__tests__/codex-native.test.js:1988`: `for (const { event, handler } of launchers)` → `for (const { handler } of launchers)` (`event` is unused in the loop body `:1988-2001`).
- Out: the Claude `resolvePersistedSpec` and its comments `spec-resolver.cjs:765,768` (tested by `spec-narrowing.test.js`; R-04); the "completion authority functions" error strings in both `spec-gate.cjs` (generic wording); legacy kernel scripts.

## Coverage
- CP-04

## Ownership
- Modify: `src/claude/scripts/validate-spec-output.cjs`
- Modify: `src/claude/scripts/spec-resolver.cjs`
- Modify: `src/claude/hooks/lib/hook-payload.cjs`
- Modify: `src/codex/hooks/lib/spec-utils.cjs`
- Modify: `bin/__tests__/codex-native.test.js`

## Steps
1. Edit the three comments.
2. Delete the wrapper and its export → `grep -n resolvePersistedSpec src/codex/hooks/lib/spec-utils.cjs` is empty.
3. Drop `event` from the destructuring.
4. Run the Command.

## Acceptance
- AC-07: no listed stale line; the four sources pass `node --check`; `spec-narrowing`, `codex-hooks` and `codex-native` tests pass with 92 tests.

## Dependencies
- none

## Verification Plan
- Command: `F=/tmp/ck-3c-07.txt; rm -f $F; grep -nE 'scaffold-guard|scaffold guard|completion-authority input' src/claude/scripts/validate-spec-output.cjs src/claude/scripts/spec-resolver.cjs src/claude/hooks/lib/hook-payload.cjs > $F; grep -n 'resolvePersistedSpec' src/codex/hooks/lib/spec-utils.cjs >> $F; grep -n 'const { event, handler } of launchers' bin/__tests__/codex-native.test.js >> $F; cat $F; [ ! -s $F ] && node --check src/claude/scripts/validate-spec-output.cjs && node --check src/claude/scripts/spec-resolver.cjs && node --check src/claude/hooks/lib/hook-payload.cjs && node --check src/codex/hooks/lib/spec-utils.cjs && node --test bin/__tests__/spec-narrowing.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/codex-native.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 92' $F && grep -qx '# fail 0' $F && rm -f $F`
- Named probe: `bin/__tests__/spec-narrowing.test.js` ("the codex gate consults the file only after its payload", which loads the Codex `spec-utils.cjs`), `bin/__tests__/codex-hooks.test.js` (requires `spec-utils.cjs` at `:1200,1662`) and `bin/__tests__/codex-native.test.js` ("Codex Windows hook launchers stay project-bound without Git from nested cwd") — 92 tests together on the prototype.
- Reachability: source — run from `packages/spec/`.
- Oracle: exit 0; no listed line; `# tests 92`, `# fail 0`. On acfdf6e9 the Command exits 1 with 8 hits.
- Counterexample: a removed export that something still used fails `codex-hooks`/`spec-narrowing`; a syntax slip in an edited comment fails `node --check`; deleting a test drops the count below 92.
- Artifacts: `/tmp/ck-3c-07.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3c-07.txt; rm -f $F; grep -nE 'scaffold-guard|scaffold guard|completion-authority input' src/claude/scripts/validate-spec-output.cjs src/claude/scripts/spec-resolver.cjs src/claude/hooks/lib/hook-payload.cjs > $F; grep -n 'resolvePersistedSpec' src/codex/hooks/lib/spec-utils.cjs >> $F; grep -n 'const { event, handler } of launchers' bin/__tests__/codex-native.test.js >> $F; cat $F; [ ! -s $F ] && node --check src/claude/scripts/validate-spec-output.cjs && node --check src/claude/scripts/spec-resolver.cjs && node --check src/claude/hooks/lib/hook-payload.cjs && node --check src/codex/hooks/lib/spec-utils.cjs && node --test bin/__tests__/spec-narrowing.test.js bin/__tests__/codex-hooks.test.js bin/__tests__/codex-native.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 92' $F && grep -qx '# fail 0' $F && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: a39e6b36d3d95972f10b8507d8c6919bc5b08e2a501c113293a3cac779bdd8c4
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
# tests 92
# fail 0
EXIT=0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
