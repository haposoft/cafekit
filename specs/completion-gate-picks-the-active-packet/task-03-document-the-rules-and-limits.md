# Task 03 — Documentation records the rules and the limits

Status: pending

## Outcome
The installer architecture document explains how the two Stop hooks decide which feature a turn is about, why they use different rules, how to name the feature when several are in play, and what this fix deliberately does not do. Both changelogs carry a `Fixed` entry naming issue #79 that describes the real defect — the gate answered an identity question and never reached receipt validation — and states the limits plainly rather than implying the problem is fully solved.

## Scope
- In: a completion-gate subsection in `docs/installer-architecture.md` covering the two narrowing rules and why they differ, `specs/_shared/active-feature.json` and its precedence behind a host-supplied target, and the three measured limits from `plan.md`; one `Fixed` entry in each changelog under a new version heading; one static case keeping the section honest.
- Out: the README skill list, which does not describe hooks; the reply to issue #79; any behaviour change.

## Coverage
- CP-04

## Ownership
- Modify: `docs/installer-architecture.md`
- Modify: `packages/spec/CHANGELOG.md`
- Modify: `docs/project-changelog.md`
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs` (one case in `runStaticSemanticTests()`)

## Acceptance
- AC-05 as stated in `plan.md`.
- The probe asserts the heading, the phrase `unfinished work`, the phrase `claiming closeout`, `specs/_shared/active-feature.json`, and a sentence stating that a host-supplied target wins. It asserts no task-status vocabulary: valid task statuses are `pending`, `in_progress`, `blocked`, `done`, and an earlier draft of this work wrongly claimed otherwise.
- The documentation states the limit that receipts in packets the gate did not resolve are not revalidated, and why: rebinding them fails on `provenance` whenever any unrelated file is uncommitted. It names that as a known gap with its own future packet rather than as a design virtue.
- The changelog entries name issue #79, say that a lone packet's resolution is unchanged, and record that two packets genuinely claiming closeout still require the file.
- The probe's `file` field uses `../../docs/installer-architecture.md`, since static cases run with `packages/spec` as the working directory.

## Dependencies
- task-02-record-the-active-feature.md

## Verification Plan
- Command: `node scripts/run-skill-self-tests.mjs`
- Named probe: `installer architecture documents completion gate identity` in `runStaticSemanticTests()`.
- Reachability: known — the same shape as `installer architecture documents orca awareness` at `run-skill-self-tests.mjs:4899`; `--static-only` runs it in seconds for the counterexample.
- Oracle: suite PASS with the probe executed and the reported total rising by exactly one.
- Counterexample: deleting the completion-gate subsection must fail the probe under `--static-only`; deleting only the sentence about host-supplied precedence must also fail it.
- Artifacts: none.

## Receipt
