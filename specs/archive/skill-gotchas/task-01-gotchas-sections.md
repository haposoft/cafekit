# Task 01 — Gotchas sections in cf:develop and cf:sync

Status: done

## Outcome
`cf:develop` and `cf:sync` each end their working guidance with a `## Gotchas` section that names the traps the current gate code produces, under the conditions the code applies, and a contract test fails when a section is missing, loses an entry, lists the dropped bulleted-Receipt trap, or shouts MUST/NEVER.

## Scope
- In: one new section per skill with the entries below; one new test in `develop-contract.test.js`.
- Out: any other skill, any reference file, any script or hook, any gate message.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/SKILL.md`
- Modify: `packages/spec/src/claude/skills/sync/SKILL.md`
- Modify: `packages/spec/bin/__tests__/develop-contract.test.js`
- Read: `packages/spec/src/claude/scripts/spec-receipt.cjs`, `packages/spec/src/claude/scripts/provenance.cjs`, `packages/spec/src/claude/scripts/spec-resolver.cjs`, `packages/spec/src/claude/hooks/spec-gate.cjs`, `packages/spec/src/claude/skills/develop/references/quality-gate.md`, `packages/spec/src/claude/skills/sync/references/rebind-and-audit.md`

## Steps
1. Add a test `develop and sync carry symptom-first gotchas` to `develop-contract.test.js`. It extracts the `## Gotchas` section of each skill (from the heading to the next `## ` heading or end of file) and asserts:
   - each skill has exactly one `## Gotchas` heading;
   - develop's section matches `/command_identity/`, `/last top-level `- Command:`/`, `/\bprovenance\b/` together with `/outside the specs root/`, and `/specs\/_shared\/active-feature\.json/` together with `/explicit_not_found/`;
   - sync's section matches `/committed copy/` and `/\/cf:sync rebind/`;
   - neither section matches `/list marker|bullet/i` (the fixed trap) nor `/\b(MUST|NEVER)\b/` (case-sensitive).
2. In develop `SKILL.md`, insert this section immediately before `## Attached references` → the develop assertions pass:

   ```markdown
   ## Gotchas

   - **`command_identity` although the command looks right.** The gate takes the last top-level `- Command:` of the Verification Plan before its first `###` sub-heading (or, when none sits at top level, the last one under the sub-headings) and compares it with the Receipt's `Command:` line after trimming whitespace and one wrapping pair of backticks. Earlier commands in the plan are prerequisites, and a second `Command:` or `Commands:` line in the Receipt fails too. Copy that one line instead of rewording it.
   - **`provenance` fails after a docs or changelog edit.** `Head` is a digest of the tracked and untracked, non-ignored files outside the specs root, uncommitted bytes included, so an edit there after a Receipt was written (docs impact, a formatter, a lockfile) moves `Head`; `Base` moves only with a new commit. The gate compares a Receipt with the live pair while its task file differs from its committed copy, and the final-Head fixed point compares every done Receipt before GATE-DONE. Re-derive at that fixed point, or with `/cf:sync rebind`, after the last such edit.
   - **The Stop at the end of a turn blocks with `explicit_not_found` after a packet is moved.** When the host names no feature, the Stop hooks check the packet named in `specs/_shared/active-feature.json`, and a name whose directory or `plan.md` no longer exists blocks the turn. When you archive, rename, or delete that packet, point the file at a live packet or delete it in the same change.
   ```

3. In sync `SKILL.md`, append this section at the end of the file → the sync assertions pass:

   ```markdown
   ## Gotchas

   - **`provenance` fails on a done task after a small edit.** A done task file that matches its committed copy, or was never committed, has its Receipt checked on structure alone; changing a committed file afterwards, even a typo or a checkbox, binds the Receipt to the live Base and Head again, which a Receipt written before that commit usually no longer matches. Leave committed done tasks as they are, or run `/cf:sync rebind <feature> <task-NN-slug.md>` after the edit.
   ```

4. Run the Verification Plan Command → exit 0 with the new test and all existing tests passing.

## Acceptance
- AC-01: develop has one `## Gotchas` with the three entries of Step 2.
- AC-02: sync has one `## Gotchas` with the entry of Step 3.
- AC-03: the new test fails on a copy whose section mentions a list marker or contains `MUST`/`NEVER`.
- Existing assertions in `develop-contract.test.js` (for example `\blane\b` and agent names absent from develop) still pass.

## Dependencies
- none

## Verification Plan
- Command: `grep -q '^## Gotchas' packages/spec/src/claude/skills/develop/SKILL.md && grep -q '^## Gotchas' packages/spec/src/claude/skills/sync/SKILL.md && node --test packages/spec/bin/__tests__/develop-contract.test.js`
- Named probe: the two `grep -q '^## Gotchas'` probes, then test `develop and sync carry symptom-first gotchas` in `packages/spec/bin/__tests__/develop-contract.test.js`
- Reachability: the test reads the two source files by path (`DEVELOP`, `SYNC_SKILL` constants at `develop-contract.test.js:18,25`); run from the repository root.
- Oracle: exit 0 with `fail 0` and the new test listed as passing; before any change it exits 1 at the first `grep` because develop has no `## Gotchas` heading.
- Counterexample: on a disposable copy of the test inputs, adding `- Receipt fields may not start with a list marker.` to either section, or writing `MUST` in it, makes the named test fail.
- Artifacts: none (ephemeral).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `grep -q '^## Gotchas' packages/spec/src/claude/skills/develop/SKILL.md && grep -q '^## Gotchas' packages/spec/src/claude/skills/sync/SKILL.md && node --test packages/spec/bin/__tests__/develop-contract.test.js`
Exit: 0
Base: 7ed6b1faae93d8299945862bf2887be9a53968cb
Head: 29213f8c11f4f628cd48be068467ec8969385af92cd63f8e3ae6ac6467af1a1a

```text
✔ develop and sync carry symptom-first gotchas (0.316333ms)
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5535.294083
```

- Rerun at the final-Head fixed point after task-02 moved Head. Before the change the same Command exited 1 at the first `grep`.
- Counterexample on a disposable copy of `packages/spec` and `docs`: adding `- Receipt fields may not start with a list marker.` to develop or sync, `- You MUST rebind.` to sync, or `- NEVER reword it.` to develop each made the named test fail (pass 0, fail 1) with the matching message; the unchanged copy passed.
- Review: PASS. The diff touches only the three owned files; both sections equal Steps 2–3 verbatim, and develop's section sits between `## Definition of done` and `## Attached references`.
