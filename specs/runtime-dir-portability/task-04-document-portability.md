# Task 04 — Documentation records what is portable and what stays Claude-only

Status: done

## Outcome
The installer architecture document names `runtime-dir.cjs`, states that runtime reads and advice derive from the hook's location while skill paths come from the platform registry, lists the 13 `~/.claude/` sites kept as Claude Code behaviour and the 20 dead-code lines left in place, and describes the omp overlay. Both changelogs gain an entry.

## Scope
- In: the current architecture doc, the two changelogs, one static probe.
- Out: historical records.

## Coverage
- CP-04

## Ownership
- Modify: `docs/installer-architecture.md`
- Modify: `packages/spec/CHANGELOG.md`
- Modify: `docs/project-changelog.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`

## Acceptance
- AC-08: a static probe asserts the doc names `runtime-dir.cjs`, contains the phrase that hooks derive their runtime directory from their own location, names the `~/.claude/` remainder as Claude-only, and describes `src/omp/hooks/` as an overlay of three files.

## Dependencies
- task-03-omp-overlay-and-runtime.md

## Verification Plan
- Command: `node scripts/run-skill-self-tests.mjs`
- Named probe: `installer architecture documents hook portability` in `runStaticSemanticTests()`.
- Reachability: known — same shape as `installer architecture documents omp coverage and gaps`.
- Oracle: suite PASS with the probe executed.
- Counterexample: deleting the portability paragraph must fail the probe.
- Artifacts: none.

## Receipt

Verification: PASS
Command: node scripts/run-skill-self-tests.mjs
Exit: 0
Base: 4ceaa93e4e23206bd3d2b9b486d49ac5e039ac95
Head: 21ede08b1be134e97bed5fc3d6db19314756934eb9721690bf075547c0f04941
```text
$ node scripts/run-skill-self-tests.mjs
✔ installer architecture documents hook portability
…
Ran 1 test in completion policy wording
[skill-test] source tree stays free of hook state
Ran 1 test in source tree cleanliness
[skill-test] PASS: 1271 tests executed
```
