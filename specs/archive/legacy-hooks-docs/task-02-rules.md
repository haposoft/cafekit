# Task 02 — rules drop the legacy section

Status: done

## Outcome
The shipped Claude rules `workflow.md`, `state-sync.md`, `manage-docs.md` and the Codex `state-sync.md` no longer promise an installed legacy adapter.

## Scope
- In: `src/claude/rules/workflow.md`: delete lines 78-86 (blank + `## Legacy compatibility` section to EOF); the file ends with "…with an obvious local cause."
- In: `src/claude/rules/state-sync.md` and `src/codex/rules/state-sync.md`: delete lines 61-69 in each (blank + `## Legacy compatibility` to EOF); both end with "…whether the requested feature is complete." and stay byte-identical (they are identical today).
- In: `src/claude/rules/manage-docs.md`: delete lines 103-111 (blank + `## Legacy specification layout` to EOF); the file ends with "Comply with the overarching rules in `./rules/ai-dev-rules.md`."
- Out: any other rule text; `src/claude/rules/workflow.md:39` ("fake adapters") is unrelated and stays.

## Coverage
- CP-01

## Ownership
- Modify: `src/claude/rules/workflow.md`
- Modify: `src/claude/rules/state-sync.md`
- Modify: `src/claude/rules/manage-docs.md`
- Modify: `src/codex/rules/state-sync.md`
- Read: `scripts/run-skill-self-tests.mjs` (state-sync and workflow checks at `:5316-5343` do not quote the section)

## Steps
1. Delete the four sections → each file ends at the line named in Scope.
2. `cmp` the two `state-sync.md` files → identical.
3. Run the Command.

## Acceptance
- AC-02: each file counts 0 lines matching `legacy|installed adapter|spec\.json` (3 each today); the `state-sync.md` pair is byte-identical; each file ends at its named line.

## Dependencies
- none

## Verification Plan
- Command: `F=/tmp/ck-3c-02.txt; rm -f $F; for f in src/claude/rules/workflow.md src/claude/rules/state-sync.md src/claude/rules/manage-docs.md src/codex/rules/state-sync.md; do echo "$f $(grep -ciE 'legacy|installed adapter|spec\.json' $f)"; done > $F; cat $F; [ "$(grep -c ' 0$' $F)" = 4 ] && cmp -s src/claude/rules/state-sync.md src/codex/rules/state-sync.md && tail -1 src/claude/rules/workflow.md | grep -q 'obvious local cause\.$' && tail -1 src/claude/rules/state-sync.md | grep -q 'whether the requested feature is complete\.$' && tail -1 src/claude/rules/manage-docs.md | grep -q 'ai-dev-rules\.md.\.$' && rm -f $F`
- Named probe: the greps, `cmp` and `tail` checks in the Command; the runner's state-sync/workflow checks and the installed Codex projection tests run in task-10.
- Reachability: source — run from `packages/spec/`.
- Oracle: exit 0; four per-file counts `0`. On acfdf6e9 the Command exits 1 (counts 3, 3, 3, 3).
- Counterexample: deleting only the heading leaves the paragraph and a count above 0; editing one `state-sync.md` only fails `cmp`; deleting more than the section fails the `tail` checks.
- Artifacts: `/tmp/ck-3c-02.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3c-02.txt; rm -f $F; for f in src/claude/rules/workflow.md src/claude/rules/state-sync.md src/claude/rules/manage-docs.md src/codex/rules/state-sync.md; do echo "$f $(grep -ciE 'legacy|installed adapter|spec\.json' $f)"; done > $F; cat $F; [ "$(grep -c ' 0$' $F)" = 4 ] && cmp -s src/claude/rules/state-sync.md src/codex/rules/state-sync.md && tail -1 src/claude/rules/workflow.md | grep -q 'obvious local cause\.$' && tail -1 src/claude/rules/state-sync.md | grep -q 'whether the requested feature is complete\.$' && tail -1 src/claude/rules/manage-docs.md | grep -q 'ai-dev-rules\.md.\.$' && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: dc69c5d31a0c1708fe8d99105e9b6494afd7a66d63732b571685b5a9d1d50124
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
src/claude/rules/workflow.md 0
src/claude/rules/state-sync.md 0
src/claude/rules/manage-docs.md 0
src/codex/rules/state-sync.md 0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
