# Task 03 — Both changelogs record the description change with its measured sample

Status: done

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

Verification: PASS
Command: test "$(grep -l skill-routing packages/spec/CHANGELOG.md docs/project-changelog.md | wc -l | tr -d ' ')" = 2 && test "$(grep -l 'Unreleased' packages/spec/CHANGELOG.md docs/project-changelog.md | wc -l | tr -d ' ')" = 2
Exit: 0
Base: 0e0ffeedb434e6ee31bc681e2da8b2ffea974339
Head: a96090c44ba0c115a49d137613e051ba86bc3e299bdb3982437daec8d1c27e4e
```text
$ test "$(grep -l skill-routing packages/spec/CHANGELOG.md docs/project-changelog.md | wc -l | tr -d ' ')" = 2 && test "$(grep -l 'Unreleased' packages/spec/CHANGELOG.md docs/project-changelog.md | wc -l | tr -d ' ')" = 2
$ echo $?
0
```
The command prints nothing on success, which is what `test` does; the exit status is the evidence and the two files are the artifact. No produced file exists to hash, so the machine declaration form is deliberately not used — `.claude/scripts/workflow-policy.cjs:327` would read an `Artifacts:` line as a declaration and then require a `sha256` for each path.

- One entry per changelog, each in that file's own language: `packages/spec/CHANGELOG.md` in English, `docs/project-changelog.md` in Vietnamese, both under the existing `## [Unreleased]` `### Changed` heading, neither creating a heading.
- Both entries carry the split rather than the headline. They give the pooled figure with its p value and then say in the same sentence that sonnet went 6/10 to 0/20 at p = 0.0004 while opus went 3/10 to 4/20 at p = 0.66 and is not separable from noise. A reader who stops early still cannot come away believing both models improved.
- Both entries state the instrument before the result: same prompt bytes, same graders, same CLI build, twenty runs per model against a ten-run baseline, and a resolution recorded before the run began.
- Both entries carry the three unfavourable facts: the negative cases held only 0 of 12 and exclude an over-trigger rate above roughly 22 per cent and no lower; `cf:brainstorm` at 0 of 40 is not a result, because the suite holds no case it could win; and the four runs that still route nowhere are all opus in one shape, so what moved is how many runs reach a door rather than what an unrouted opus run does.
- The price is stated, 11.77 US dollars including judge cost, because a measurement whose cost is hidden invites the next one to be planned without a budget.
- Neither entry claims the routing problem is solved, and neither states a count without its sample size.
