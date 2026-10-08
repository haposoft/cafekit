# Task 05 — READMEs and the usage guide drop the legacy promise

Status: done

## Outcome
The repository README, the package README and `docs/specs-usage-guide.md` no longer promise an installed legacy adapter, and the runner's guide check forbids it.

## Scope
- In: `../../README.md`: delete lines 141-147 (`### Legacy compatibility`, blank, four-line paragraph, blank); "Claude Code and Codex CLI are the primary Specs v2 acceptance targets." follows the Receipt paragraph.
- In: `README.md` (package): delete lines 316-319 (three-line paragraph and the blank after it); `## Development` follows the GATE-DONE paragraph.
- In: `../../docs/specs-usage-guide.md`: delete lines 221-228 (`## Legacy compatibility` section and its trailing blank), and shorten `:5-6` "Luồng mới không dạy registry cũ; phần đó chỉ còn ở legacy adapter." to "Luồng mới không dạy registry cũ." (dangling reference; found by the prototype suite).
- In: `scripts/run-skill-self-tests.mjs:5747` (check "specs-usage-guide teaches Develop and Sync without leaking v2.1 vocabulary"): replace `content.includes("## Legacy compatibility") &&` with `!content.includes("## Legacy compatibility") &&` and `!content.includes("legacy adapter đang cài sẵn") &&`.
- Out: README lines `105,108` and package README `281,284` ("legacy codebase"/`apps/legacy-admin`, unrelated); `specs-usage-guide.md:172-174` (cf:test separate-receipt behaviour, still current while the test skill keeps its legacy section — R-01).

## Coverage
- CP-03

## Ownership
- Modify: `../../README.md`
- Modify: `README.md`
- Modify: `../../docs/specs-usage-guide.md`
- Modify: `scripts/run-skill-self-tests.mjs` (line 5747 region only)

## Steps
1. Delete the two README passages.
2. Edit the guide (section + intro clause).
3. Flip the runner clause.
4. Run the Command.

## Acceptance
- AC-05: zero matches for `Legacy compatibility|installed legacy adapter|legacy compatibility adapter|legacy adapter` in the three files; the neighbouring lines named in Scope are intact; the runner clause forbids the section.

## Dependencies
- task-04-installer-architecture.md

## Verification Plan
- Command: `F=/tmp/ck-3c-05.txt; rm -f $F; grep -nE 'Legacy compatibility|installed legacy adapter|legacy compatibility adapter|legacy adapter' ../../README.md README.md ../../docs/specs-usage-guide.md > $F; cat $F; [ ! -s $F ] && grep -q '^Claude Code and Codex CLI are the primary Specs v2 acceptance targets\.$' ../../README.md && grep -B2 '^## Development$' README.md | grep -q 'current command output\.$' && grep -q 'Luồng mới không dạy registry cũ\.$' ../../docs/specs-usage-guide.md && grep -q '!content.includes("legacy adapter đang cài sẵn") &&' scripts/run-skill-self-tests.mjs && rm -f $F`
- Named probe: the greps in the Command; the runner check "specs-usage-guide teaches Develop and Sync without leaking v2.1 vocabulary" runs in task-10 (its `outsideLegacySections` vocabulary clause now covers the whole guide).
- Reachability: source — run from `packages/spec/`; repo files read at `../../`.
- Oracle: exit 0 and no listed line. On acfdf6e9 the Command exits 1 with 6 hits (`README.md:141,144`, package `README.md:317`, guide `:6,221,224`).
- Counterexample: leaving the guide intro clause lists `:6`; leaving the old runner clause fails the new-clause grep (and the runner fails the guide in task-10).
- Artifacts: `/tmp/ck-3c-05.txt`, removed on success.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `F=/tmp/ck-3c-05.txt; rm -f $F; grep -nE 'Legacy compatibility|installed legacy adapter|legacy compatibility adapter|legacy adapter' ../../README.md README.md ../../docs/specs-usage-guide.md > $F; cat $F; [ ! -s $F ] && grep -q '^Claude Code and Codex CLI are the primary Specs v2 acceptance targets\.$' ../../README.md && grep -B2 '^## Development$' README.md | grep -q 'current command output\.$' && grep -q 'Luồng mới không dạy registry cũ\.$' ../../docs/specs-usage-guide.md && grep -q '!content.includes("legacy adapter đang cài sẵn") &&' scripts/run-skill-self-tests.mjs && rm -f $F`
Exit: 0
Base: d5a1012464b45afd7cab9928786228864592b1cc
Head: 8a23caf94ede7d7dc81a96a09adf020b9cce6a3057c1f4524d5f5ea5e165cf9f
```text
$ (packages/spec) <Command above>   # run by the controller; EXIT=0
EXIT=0
```
Controller rerun from packages/spec after the edits; Base/Head from provenance.cjs.
