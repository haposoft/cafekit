# Task 03 — Rules, skill and guides state the modes and the limitation

Status: done
## Outcome

Every operator-facing statement of the completion policy describes the two modes,
the clean-tree condition, and the fact that the gate does not detect a fabricated
receipt, so nobody infers a guarantee the code does not provide.

## Scope

- In: the rule files, the Specs skill, the published flow guide, and a static probe
  that fails if the old wording returns to the package source.
- Out: the two tollgate message strings, which belong to the tasks that own those
  files, and any behavior change.

## Coverage

- CP-06

## Ownership

- Modify: `packages/spec/src/claude/rules/state-sync.md`
- Modify: `packages/spec/src/claude/rules/workflow.md`
- Modify: `packages/spec/src/codex/rules/state-sync.md`
- Modify: `packages/spec/src/claude/skills/specs/SKILL.md`
- Modify: `docs/cf-specs-flow.html`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance

- AC-06: each owned document states that a done task keeps runtime provenance
  binding unless its file is committed, unchanged, and the tree outside the specs
  root is clean, in which case it is validated on structure alone.
- The clean-tree condition is stated once, in `state-sync.md`, and referenced rather
  than copied elsewhere.
- The skill's Machine boundary section records that the gate detects drift, not
  invention, and that a valid `Base`/`Head` pair can be produced without running the
  command. This is the limitation the user accepted at C2.
- `docs/cf-specs-flow.html:489` no longer states that the Stop gate revalidates
  every done task.
- No file gains a new schema, approval field or readiness bit.
- A static probe asserts the new wording in all five documents and asserts that the
  phrase `revalidates every task currently marked done` is absent from
  `packages/spec/src/`. The probe is scoped to that directory, so planning documents
  that quote the old policy historically do not fail it.

## Dependencies

- task-01-structure-only-for-committed-receipts.md
- task-02-mirror-the-modes-in-codex.md

## Verification Plan

- Command: `npm --prefix packages/spec test`
- Named probe: a new static probe in `run-skill-self-tests.mjs` in the style of the
  anchor probes near `run-skill-self-tests.mjs:4818`, asserting the required wording
  in the five owned documents and the absence of the old sentence under
  `packages/spec/src/`.
- Reachability: the probe reads the canonical source files the installer projects
  into both runtimes, plus the published guide.
- Oracle: the suite exits 0 with the probe passing, and fails when any owned
  document is reverted to the old wording.
- Counterexample: restoring the old sentence in one rule file must fail the probe;
  a planning document under `plans/` that quotes the old sentence must not.
- Artifacts: none.

## Receipt

Verification: PASS
Command: npm --prefix packages/spec test
Exit: 0
Base: 874bda9490ddd205dfb52772d33f8392458c675b
Head: ec2ea6805c49bb0ec70c4bc4ff74d727ba05a21180ecad45ebbe992a10791598
```text
$ npm --prefix packages/spec test
ℹ tests 417
ℹ pass 416
ℹ fail 0
ℹ tests 219
ℹ pass 219
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 1238 tests executed
```
