# Task 03 — Both changelogs record the description change with its measured sample

Status: pending

## Outcome
`packages/spec/CHANGELOG.md` and `docs/project-changelog.md` each carry an `## [Unreleased]` `### Changed` entry that names the `cf:specs` and `cf:brainstorm` description change, references `skill-routing`, and states the before and after counts as one sample of ten runs per model rather than as properties of the skill.

## Scope
- In: one entry in each changelog, under the existing `## [Unreleased]` `### Changed` heading.
- Out: version bumps, release notes, `docs/.sync_hash`, the web site, and any doc that describes the skill's behaviour rather than its change history.

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: task 02's Receipt for the measured counts, and the existing `[Unreleased]` entries so the new text matches their voice and does not repeat them

## Steps
1. Read both current `## [Unreleased]` sections. The `specs-a-plus` entry already states its figures as one sample; match that phrasing rather than inventing a second convention.
2. Write one entry per file naming the two descriptions, the reason, the packet, and both counts with their sample size.
3. State the limit in the same entry: the counts come from one case, twenty runs, two doors, while the product ships thirty-two skills, so the numbers describe this measurement and not the catalogue.
4. Run the Command and compare the observed output with the Oracle.

## Acceptance
- AC-05 as stated in `plan.md`.
- Neither entry states a count without its sample size.
- Neither entry claims the routing problem is solved; it reports what changed and what was measured.

## Dependencies
- task-02-measure-the-two-doors-again.md

## Verification Plan
- Command: `test "$(grep -l skill-routing packages/spec/CHANGELOG.md docs/project-changelog.md | wc -l | tr -d ' ')" = 2 && test "$(grep -l 'Unreleased' packages/spec/CHANGELOG.md docs/project-changelog.md | wc -l | tr -d ' ')" = 2`
- Named probe: none; the grep is the check
- Reachability: known — the same shape of command verified AC-08 in `specs-a-plus` task 06
- Oracle: exit 0, which requires both files to name `skill-routing` and both to still carry an `Unreleased` heading; both already have `## [Unreleased]` and `### Changed`, so no heading is created
- Counterexample: an entry added to only one of the two files leaves the first `wc -l` at 1 and the command exits 1. Both halves are `test` comparisons rather than a bare `grep -c`, which returns 0 when only one file matches and would have let a half-done change pass
- Artifacts: none; stdout is the evidence

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If task 02's counts did not move, the entry still gets written and says so; a changelog that records only favourable measurements is not a changelog.

## Receipt
<!-- Fill only after execution; see the canonical form in references/templates.md. -->
