# Task 05 — Both changelogs extend the 0.16.8 entry

Status: pending

## Outcome
`packages/spec/CHANGELOG.md` and `docs/project-changelog.md` describe the develop repairs inside the existing `## [0.16.8]` section, in each file's own language, with no new version heading and no reopened `[Unreleased]`.

## Scope
- In: text inside the existing `## [0.16.8]` heading in both changelogs, **and folding the live `## [Unreleased]` section into it**. That section sits above 0.16.8 and holds the brainstorm-description work from `c8a5dac`/`17dcf7e`, which is also today's work; the user chose at GATE-REVIEW to ship everything from today as one version.
- Out: the version number, `package.json`, the README badge, and publishing.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: task 04's Receipt for the measured before and after figures

## Steps
1. Read both files' `## [Unreleased]` and `## [0.16.8]` sections. Unreleased is **not empty** — an earlier draft of this task assumed it was and its verification command failed on the real files.
2. Move the Unreleased entries into `## [0.16.8]` and remove the now-empty heading, in both files. Nothing is lost: that work shipped today and 0.16.8 is unpublished.
3. Write one entry per file, in that file's language, naming what changed in the skill and in the gate, and giving the before and after figures with their sample sizes.
4. If task 04 showed no readable movement, say that plainly. A changelog that records only favourable measurements is not a changelog.
5. Run the Command and compare the observed output with the Oracle.

## Acceptance
- AC-07 as stated in `plan.md`.
- No `## [Unreleased]` heading exists in either file afterwards, and no `## [0.16.9]` is created.
- Neither entry states a count without its sample size.

## Dependencies
- task-04-measure-after.md

## Verification Plan
- Command: `test "$(grep -c '^## \[0\.16\.8\]' packages/spec/CHANGELOG.md)" = 1 && test "$(grep -c '^## \[0\.16\.8\]' docs/project-changelog.md)" = 1 && test "$(grep -l 'Unreleased' packages/spec/CHANGELOG.md docs/project-changelog.md | wc -l | tr -d ' ')" = 0`
- Named probe: none; the greps are the check
- Reachability: known — the same shape verified AC-05 in `skill-routing`
- Oracle: exit 0, meaning each file has exactly one 0.16.8 heading and neither has reopened `Unreleased`
- Counterexample: opening a new version heading, or leaving an `Unreleased` section behind, exits non-zero. Each file is counted separately because `grep -c` over two files prints `file:N` and a combined count would pass on the wrong shape
- Artifacts: none; stdout is the evidence

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If 0.16.8 has been published by the time this task runs, stop: D-04 assumed it had not, and the user must choose whether to open 0.16.9.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
