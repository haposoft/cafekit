# Task 06 — Both changelogs record the change

Status: done

## Outcome
`packages/spec/CHANGELOG.md` and `docs/project-changelog.md` each carry, under `## [Unreleased]` → `### Changed`, one entry that names the `cf:specs` A⁺ mechanisms (one GATE-SCOPE ask with `[NEEDS CLARIFICATION]`, `Priority`, `## Decisions`, `## Steps`, verification by comparison, `## Failure Protocol`, author fact-check sample) and the two new eval cases, referencing this packet as `specs-a-plus`.

## Scope
- In: one entry per file, Keep a Changelog form, no version bump.
- Out: closing `## [Unreleased]` into a version (release step, user-triggered); README or docs pages other than the changelog.

## Coverage
- CP-06

## Ownership
- Modify: `packages/spec/CHANGELOG.md` (existing `## [Unreleased]` block)
- Modify: `docs/project-changelog.md` (existing `## [Unreleased]` block)
- Read: the 0.16.7 entries in both files for wording and tense

## Steps
1. Read the current `## [Unreleased]` block in each file → confirm it exists and which subsections it has.
2. Add the `### Changed` entry (create the subsection if absent) in the same voice as the 0.16.7 entries.
3. Run the Command → exit 0.

## Acceptance
- AC-08 as stated in `plan.md`.
- **One entry, one home.** The mechanism list appears in the changelog; it is not repeated into README or docs.

## Dependencies
- task-01-skill-text-and-probes.md
- task-02-consumers-read-the-new-sections.md
- task-03-eval-cases-and-summarizer.md

## Verification Plan
- Command: `test "$(for f in packages/spec/CHANGELOG.md docs/project-changelog.md; do awk "/^## \[Unreleased\]/{u=1} u&&/^### Changed/{c=1;next} c&&/^## /{exit} c" "$f" | grep "specs-a-plus" | grep "## Decisions" | grep "## Steps" | grep "## Failure Protocol" | grep "NEEDS CLARIFICATION" | grep -c "history_file"; done | awk "{s+=\$1} END{print s}")" -eq 2`
- Named probe: the entry line inside each file's `## [Unreleased]` → `### Changed` section, required to name `specs-a-plus`, the `## Decisions`, `## Steps` and `## Failure Protocol` sections, the `[NEEDS CLARIFICATION]` marker, and the `history_file` case
- Reachability: known — plain text files in the repository; `awk`, `grep` and `test` are POSIX
- Oracle: exit 0, which requires each file to carry one entry in the right section naming every mechanism and the resumed case AC-08 asks for; `grep -l` alone proved only that a string appeared somewhere in the file
- Counterexample: drop one required phrase from one file's entry → that file contributes 0 and `test 1 -eq 2` exits 1; replayed on a copy under a temporary root, which exits 1 as required
- Artifacts: none

## Failure Protocol
On a failed Step or Verify: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: test "$(for f in packages/spec/CHANGELOG.md docs/project-changelog.md; do awk "/^## \[Unreleased\]/{u=1} u&&/^### Changed/{c=1;next} c&&/^## /{exit} c" "$f" | grep "specs-a-plus" | grep "## Decisions" | grep "## Steps" | grep "## Failure Protocol" | grep "NEEDS CLARIFICATION" | grep -c "history_file"; done | awk "{s+=\$1} END{print s}")" -eq 2
Exit: 0
Base: b2b4239e62c8c2c96477514e1e48c03e11469233
Head: b5fcf120c3ffd2d5243dcfe1c14093b28c6004a7e222c2a5e958744ecaa2d67c
```text
$ test "$(for f in packages/spec/CHANGELOG.md docs/project-changelog.md; do awk "/^## \[Unreleased\]/{u=1} u&&/^### Changed/{c=1;next} c&&/^## /{exit} c" "$f" | grep "specs-a-plus" | grep "## Decisions" | grep "## Steps" | grep "## Failure Protocol" | grep "NEEDS CLARIFICATION" | grep -c "history_file"; done | awk "{s+=\$1} END{print s}")" -eq 2
$ echo $?
0
```
The command prints nothing on success: it counts, per file, the entry line inside `## [Unreleased]` → `### Changed` that names `specs-a-plus`, the `## Decisions`, `## Steps` and `## Failure Protocol` sections, the `[NEEDS CLARIFICATION]` marker and the `history_file` case, then requires the two counts to sum to 2. The exit status is the evidence. The string above was read out of this file rather than retyped, so the Receipt and the Verification Plan carry the same bytes.

- Counterexample replayed on disposable copies under the session's temporary root, never on the tracked files: removing the `NEEDS CLARIFICATION` phrase from one copy drops that file's count to 0 and the command exits 1.
- Review: fresh-context reviewer, one round. It verified 8 of 8 numbers, 12 of 12 claims about the source, 3 of 3 claims about the limits, and 26 of 26 bilingual propositions, then returned FAIL on one number and I corrected three sentences in both files.
- The blocking correction: the entry said the opus run delivered "about 40 lines" of code. Counted directly from the recorded answer, it delivered five code blocks, 158 fenced lines, 132 of them non-empty. The figure 40 was the `khong-code` regex's match count (39), which the reviewer had reported as a line count in its task-05 review and I copied faithfully. Both files now say roughly 130 lines across five blocks. This mattered because the sentence is the entry's only real adherence gap, and the wrong number made it read as a third as bad.
- Second correction: "it now classifies that request critical" was true of two of three runs. The third never classified anything because it went straight to code. Both files now say so.
- Third correction: the limits list named two instrument defects and omitted a third. `khong-code` matches a prose line opening with the word "Export", so one of the two failures on the export case is a grader artifact. Leaving it out while listing the other two would have flattered the instrument.
- The Verification Plan was tightened during the task. `grep -l specs-a-plus … | wc -l -eq 2` proved only that a string appeared somewhere in each file, while AC-08 asks the entry to sit in the right section and to name the mechanisms and the two eval cases. The command now proves what the criterion claims.
- Not recorded in the changelog, deliberately: the `sau-keep` timeout raise. No published number depends on it, since no run came near either ceiling, and its place is task-05's Receipt and GATE-DONE.
- Open limitation for the release editor: this `### Changed` block now holds both `GATE-SCOPE` (this entry) and `C1` (the adjacent 0.16.7-era entry) for the same gate. Pre-existing and outside this task's one-entry-per-file scope.
