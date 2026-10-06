# Task 03 — `state.cjs` stays silent at SessionStart when it has nothing to say

Status: done

## Outcome
A Claude session opens without the "Prior Execution Context" block when that block would only hold headings, placeholders and timestamp-only agent results.

## Scope
- In: in `state.cjs` SessionStart, when `runtimeDirName() === '.claude'`, and the raw payload carries a snake_case `session_id`, strip headings (`#`/`##` lines, `<!-- … -->`), the placeholder bullets `(No completed tasks recorded)`, `(All tasks completed)`, `(No file changes detected)`, and `- Completed at <time>` lines; print the block only if any non-blank line remains.
- Out: what `state.cjs` writes; PostToolUse/Stop/SubagentStop paths; omp and Codex.

## Coverage
- CP-03

## Ownership
- Modify: `src/claude/hooks/state.cjs`, `src/claude/hooks/__tests__/state.test.js`

## Steps
1. Add three tests to `state.test.js`: `SessionStart prints nothing when prior context is only placeholders` (write the exact filler shape seen in this repo: headings, the three placeholders, three `## Agent Result: code-auditor (…)` blocks with only `- Completed at …`); `SessionStart prints prior context that has a completed todo`; `SessionStart under .omp keeps printing placeholder-only context`.
2. Run the Command and expect failure.
3. Implement.
4. Run the Command.

## Acceptance
- AC-04: the three tests pass with the rest of `state.test.js`.

## Dependencies
- task-02-docs-sync-on-demand.md

## Verification Plan
- Command: `node --test src/claude/hooks/__tests__/state.test.js 2>&1 | tee /dev/stderr | grep -E '^ok .* - SessionStart (prints nothing when prior context is only placeholders|prints prior context that has a completed todo|under .omp keeps printing placeholder-only context)$' | wc -l | grep -q '^ *3$' && node --test src/claude/hooks/__tests__/state.test.js 2>&1 | grep -q '^# fail 0$'`
- Named probe: the three tests above.
- Reachability: source; spawns `state.cjs` from a `.claude`/`.omp` shaped temp tree.
- Oracle: exit 0; the three named tests `ok`; `# fail 0`.
- Counterexample: filtering only headings keeps printing the placeholder block; filtering everything hides a real todo.
- Artifacts: ephemeral temp dirs.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test src/claude/hooks/__tests__/state.test.js 2>&1 | tee /dev/stderr | grep -E '^ok .* - SessionStart (prints nothing when prior context is only placeholders|prints prior context that has a completed todo|under .omp keeps printing placeholder-only context)$' | wc -l | grep -q '^ *3$' && node --test src/claude/hooks/__tests__/state.test.js 2>&1 | grep -q '^# fail 0$'`
Exit: 0
Base: c11904f09ca62aca260785f47df85d061e1f8cd7
Head: 240ff6eb16cbc33c1192b93b25b5a262d01629483aeb541f81dccb05fdb1f1b7
```text
$ (packages/spec) <Command above>   # summary lines; EXIT=0
ok 8 - SessionStart prints nothing when prior context is only placeholders
ok 9 - SessionStart prints prior context that has a completed todo
ok 10 - SessionStart under .omp keeps printing placeholder-only context
# tests 10
# pass 10
# fail 0
```
Pre-change run: `not ok 8` (the placeholder-only block printed); 9 and 10 passed as guards of the unchanged behaviour.
