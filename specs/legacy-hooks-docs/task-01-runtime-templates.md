# Task 01 — Claude and Codex instruction templates drop the legacy section

Status: done

## Outcome
The shipped `src/claude/CLAUDE.md`, `src/codex/AGENTS.md` and the package `AGENTS.md` no longer tell the model that `spec.json` packets keep an installed adapter and closeout contract, and the runner checks that forbid the section instead of requiring it.

## Scope
- In: `src/claude/CLAUDE.md`: delete lines 27-33 (the blank line, `### Legacy Specs compatibility`, the blank line and the four-line paragraph); the file then ends at the GATE-DONE bullet ("…may invent approval or proof.").
- In: `src/codex/AGENTS.md`: delete lines 34-40 (heading, blank, paragraph, trailing blank), so the GATE-DONE bullet is followed by one blank line and `## Codex caveats`.
- In: `AGENTS.md` (package root, `packages/spec/AGENTS.md`): delete lines 88-94 the same way (R-02, user decision); `## Codex caveats` follows the GATE-DONE bullet.
- In: `scripts/run-skill-self-tests.mjs:5066` and `:5078` (checks "Claude runtime template exposes process-first Specs truth" and "Codex runtime template …"): replace `content.includes("### Legacy Specs compatibility") &&` with `!content.includes("Legacy Specs compatibility") &&` followed by `!content.includes("installed adapter") &&`; keep every other clause, including the `outsideLegacySections` vocabulary check.
- Out: repo-root `CLAUDE.md`/`AGENTS.md` and `.claude/` (user decision 1); every other runner check.

## Coverage
- CP-01

## Ownership
- Modify: `src/claude/CLAUDE.md`
- Modify: `src/codex/AGENTS.md`
- Modify: `AGENTS.md` (package root)
- Modify: `scripts/run-skill-self-tests.mjs` (lines 5066, 5078 only)
- Read: `bin/__tests__/installer-safety.test.js:28,426-440` (embeds the Claude template), `bin/__tests__/skill-routing-source.test.js:85-93` (reads the Codex template)

## Steps
1. Delete the Claude section → `tail -1 src/claude/CLAUDE.md` is the GATE-DONE bullet line.
2. Delete the Codex section → `## Codex caveats` follows the GATE-DONE bullet after one blank line.
3. Flip both runner clauses → `grep -c '!content.includes("Legacy Specs compatibility")' scripts/run-skill-self-tests.mjs` prints 2.
4. Run the Command.

## Acceptance
- AC-01: the three files count 0 lines matching `legacy|installed adapter|spec\.json` (3 each today); the two runner checks forbid the section; the template tests pass.

## Dependencies
- none

## Verification Plan
- Command: `F=/tmp/ck-3c-01.txt; rm -f $F; for f in src/claude/CLAUDE.md src/codex/AGENTS.md AGENTS.md; do echo "$f $(grep -ciE 'legacy|installed adapter|spec\.json' $f)"; done > $F; cat $F; [ "$(grep -c ' 0$' $F)" = 3 ] && tail -1 src/claude/CLAUDE.md | grep -q 'may invent approval or proof\.$' && grep -B2 '^## Codex caveats$' src/codex/AGENTS.md | grep -q 'may invent approval or proof\.$' && grep -B2 '^## Codex caveats$' AGENTS.md | grep -q 'may invent approval or proof\.$' && [ "$(grep -c '!content.includes("Legacy Specs compatibility") &&' scripts/run-skill-self-tests.mjs)" = 2 ] && [ "$(grep -c '!content.includes("installed adapter") &&' scripts/run-skill-self-tests.mjs)" = 2 ] && ! grep -q 'content.includes("### Legacy Specs compatibility")' scripts/run-skill-self-tests.mjs && node --test bin/__tests__/installer-safety.test.js bin/__tests__/skill-routing-source.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 27' $F && grep -qx '# fail 0' $F && rm -f $F`
- Named probe: the greps in the Command plus `installer-safety.test.js` and `skill-routing-source.test.js` (27 tests; they embed and read the two templates); the runner checks themselves run in task-10.
- Reachability: source — run from `packages/spec/`; installed projection of the templates is exercised by the full suite in task-10.
- Oracle: exit 0; three per-file counts `0`; `# tests 27` and `# fail 0`. On acfdf6e9 the Command exits 1 (counts 3, 3, 3).
- Counterexample: leaving the heading or any sentence of the paragraph keeps a count above 0; deleting the runner checks instead of flipping them fails the `grep -c … = 2` pins; a damaged template breaks `installer-safety.test.js`.
- Artifacts: `/tmp/ck-3c-01.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3c-01.txt; rm -f $F; for f in src/claude/CLAUDE.md src/codex/AGENTS.md AGENTS.md; do echo "$f $(grep -ciE 'legacy|installed adapter|spec\.json' $f)"; done > $F; cat $F; [ "$(grep -c ' 0$' $F)" = 3 ] && tail -1 src/claude/CLAUDE.md | grep -q 'may invent approval or proof\.$' && grep -B2 '^## Codex caveats$' src/codex/AGENTS.md | grep -q 'may invent approval or proof\.$' && grep -B2 '^## Codex caveats$' AGENTS.md | grep -q 'may invent approval or proof\.$' && [ "$(grep -c '!content.includes("Legacy Specs compatibility") &&' scripts/run-skill-self-tests.mjs)" = 2 ] && [ "$(grep -c '!content.includes("installed adapter") &&' scripts/run-skill-self-tests.mjs)" = 2 ] && ! grep -q 'content.includes("### Legacy Specs compatibility")' scripts/run-skill-self-tests.mjs && node --test bin/__tests__/installer-safety.test.js bin/__tests__/skill-routing-source.test.js > $F 2>&1; grep -E '^# (tests|fail)' $F; grep -qx '# tests 27' $F && grep -qx '# fail 0' $F && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: 2d114ff814a7011b20cde56b980cf1767315db75a973233078b58c9ec442ce99
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
src/claude/CLAUDE.md 0
src/codex/AGENTS.md 0
AGENTS.md 0
# tests 27
# fail 0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
