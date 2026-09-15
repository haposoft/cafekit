# Task 03 — Documentation records the rules and the limits

Status: done

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
- Modify: `packages/spec/bin/__tests__/package-inventory.test.js` — added by measurement, not planned. The full suite this task runs surfaced one case the earlier constrained runs never executed: it pinned the pre-fix ambiguity contract on the installed source-free copy. See the plan's Review log.

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

Verification: PASS
Command: node scripts/run-skill-self-tests.mjs
Exit: 0
Base: 5a8c0290e7a8383b00830b5f196264759b7ec70a
Head: 12db5673abc47c40736c6ade4e2cbbad5810fe17f21e2ae32574138351b4e358
```text
$ node scripts/run-skill-self-tests.mjs
✔ installer architecture documents completion gate identity
...
[skill-test] PASS: 1346 tests executed
```

The probe was executed, not merely present: `--static-only` reports it by name among 542 static cases, and both counterexamples were run. Deleting the whole `## Completion gate identity` section produced `[FAIL] installer architecture documents completion gate identity`. Replacing only the sentence `**A target supplied by the host always wins**` with neutral wording produced the same failure, so the probe pins the precedence claim specifically rather than the heading alone. The document was restored from a copy after each and the suite re-run.

The total is 1346 against the 1324 this repository reported at 0.16.3: twenty new cases in `bin/__tests__/spec-narrowing.test.js`, one end-to-end case in `bin/__tests__/codex-hooks.test.js`, and this static probe.

This run found one thing the packet's earlier constrained runs could not. `bin/__tests__/package-inventory.test.js` exercises the **installed, source-free** copy of the hooks, and it asserted `multiple_persisted` from its own scaffolded fixtures — the same pre-fix contract AC-04 corrects, on a surface no earlier command in this packet touched. It is recorded rather than quietly patched. Measured cause: `assertInstalledCompletion` runs first and drives `compact-installed` to closeout, so exactly one of the three fixtures is claiming closeout and now resolves, which is precisely the intended behaviour. Two wrong repairs were rejected before the right one — asserting `null` failed, because one packet is claiming closeout; asserting the old error would have re-pinned the bug. The case now asserts that the claiming packet resolves and, to keep the property it was guarding, creates two throwaway packets that genuinely claim closeout and asserts the ambiguity names exactly the three claiming ones, then removes them so later assertions in the same fixture are unaffected.

Two limits of this proof are stated rather than implied. A static probe proves the written document contains these claims; it cannot prove a model reads or follows them. And the changelog entries sit under a `## [0.16.4]` heading while `package.json` and the second version pin still read 0.16.3, because bumping them is a release decision the user makes, not part of this task.
