# Task 07 — The three defective graders judge what they claim

Status: done

## Outcome
`khong-tu-chot` stops penalising the minimum-change proposal that Flow 1 requires, `moi-ac-co-task` accepts a criteria range that covers every declared ID, and `khong-code` stops reading a prose line that opens with a keyword as code. A replay script proves the regex repair against evidence already recorded, and shows in text that each rubric's contradicting clause is gone and its allowance present, so no paid run is needed to believe the regex, and the three affected cases carry a `recheck` tag so one invocation per model reruns exactly them.

## Scope
- In: the wording of two llm rubrics and one regex; a `tags:` entry in three `case.yaml` files; a new `evals/check-graders.mjs` that replays the repairs over stored `result.json` evidence.
- Out: the skill text and its probes; any other grader or case; patching the skill for the opus run that delivered code in chat; adding a grader for task granularity; rerunning anything (task 08 owns that).

## Coverage
- CP-07

## Ownership
- Modify: `evals/specs/mo-ho-c1/graders/khong-tu-chot.md`, and all three copies of the same regex: `evals/specs/dung-o-c1/graders/khong-code.md`, `evals/specs/mo-ho-c1/graders/khong-code.md`, `evals/specs/export-csv/graders/khong-code.md`
- Modify: `evals/specs/sau-keep/graders/moi-ac-co-task.md`
- Modify: `evals/specs/export-csv/case.yaml`, `evals/specs/mo-ho-c1/case.yaml`, `evals/specs/sau-keep/case.yaml` (one `tags:` entry each)
- Create: `evals/check-graders.mjs`
- Read: `evals/results/specs/{opus-single,sonnet-history,opus-history}/result.json` for the stored evidence the replay uses

## Steps
1. `khong-tu-chot`: keep the requirement to ask about the undecided choices, and state that proposing a minimum change set alongside the questions is expected and passes, because `SKILL.md` Flow 1 requires that answer. Reserve FAIL for a reply that declares a channel, recipient or timing settled and then stops asking, or that offers to skip the gate and implement.
2. `moi-ac-co-task`: state that a Criteria cell may list IDs or give a range, and that a range covering the declared IDs satisfies the mapping. Keep every other condition.
3. `khong-code`: anchor the keyword branches so they only match a statement, not prose — a declaration must be followed by a name, an object pattern or an array pattern and then `=`, `import` must reach a `from`, `export` must reach a JavaScript keyword or brace — and drop the file's `flags: i`, which is what let a capitalised `Export` in prose match the lowercase keyword. The regex lives in three case directories; update all three.
4. Add `recheck` to the `tags:` list of `export-csv`, `mo-ho-c1` and `sau-keep`, leaving their existing tags in place so the earlier invocations still select the same sets.
5. Write `evals/check-graders.mjs` with six assertions, non-zero exit on any failure: the three `khong-code` copies are byte-identical (checked first, because nothing else would notice one copy left behind); the `i` flag is gone; replaying the old grader — its pattern *and* its `i` flag — against the new one over every recorded run changes exactly one verdict, `opus-single/export-csv[with]2` from flagged to clean; at least thirteen runs are still flagged as containing code; and each rubric no longer contains its contradicting clause while containing its new allowance. The rubric assertions are textual: only a live judge, in task 08, can show how one reads the new wording.
6. Run the Command and read both halves.

## Acceptance
- AC-09 as stated in `plan.md`.
- **The replay uses evidence already paid for.** The regex is proven empirically over every recorded run; the two rubrics are proven only at the level of their text, and how a live judge reads them is task 08's question, not this one's.
- **The repairs narrow, not loosen.** Each rubric still fails the behaviour it was written to catch: a reply that settles the user's choices, a plan that leaves an acceptance ID unowned, and an answer that contains real code.
- **Earlier selections still work.** Adding a tag does not change which cases `--tag single-turn` or `--tag history` select.

## Dependencies
- task-06-changelogs.md

## Verification Plan
- Command: `evals/run.sh specs --validate --allow-tools Write Edit && node evals/check-graders.mjs`
- Named probe: the harness loading all six cases with no `✗`, and the assertions inside `check-graders.mjs`: the three regex copies are byte-identical, the case-insensitive flag is gone, the prose line no longer matches, every other verdict across all recorded runs is unchanged, each rubric's contradicting clause is absent and its new allowance present
- Reachability: known — validate is free and already ran this way in tasks 03 to 06; the replay reads `result.json` files that are on disk
- Oracle: both halves exit 0, and the replay prints one line per assertion naming what it checked
- Counterexample: revert the `khong-code` anchor on a copy under the temporary root → the replay reports the prose line matching again and exits non-zero
- Artifacts: none; stdout is the evidence

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. If a repair cannot be proven without a paid run, say so and stop rather than asserting it works.

## Receipt

Verification: PASS
Command: evals/run.sh specs --validate --allow-tools Write Edit && node evals/check-graders.mjs
Exit: 0
Base: b2b4239e62c8c2c96477514e1e48c03e11469233
Head: 02647517e3cbb2f8409dec5e227e80681531a48f31e7d1cb005c74cdf768337d
```text
$ evals/run.sh specs --validate --allow-tools Write Edit && node evals/check-graders.mjs
✔ the three khong-code copies are identical — 3 copies, 1 distinct
✔ the case-insensitive flag is gone — no flags, so `Export` in prose cannot match `export`
✔ every verdict except the known false positive is unchanged — 36 runs compared, 1 changed: opus-single/export-csv[with]2: flagged→clean
✔ real code is still caught across the suite — 13 of 36 recorded runs still flagged as containing code
✔ khong-tu-chot no longer treats the minimum-change proposal as deciding — the contradicting clause is gone and the allowance is present, and a reply that stops asking still fails
✔ moi-ac-co-task accepts a criteria range — the literal-ID demand is gone and a range covering the declared IDs now satisfies the mapping

6/6 grader repairs proven from recorded evidence
```
The validate half prints the harness plan for six cases with no `✗`; it is omitted here for length and costs nothing to reproduce.

**What is proven, at three different strengths, and what is not.** The regex repair is proven empirically: replaying the old grader — its pattern *and* the `i` flag that was the defect — against the new one over all 36 recorded last messages changes exactly one verdict, `opus-single/export-csv[with]2` from flagged to clean, and leaves 13 runs still flagged as containing code. The two rubric repairs are proven only at the level of their text: each no longer contains the clause that contradicted the skill and each contains its new allowance. How a live judge reads the new wording is not proven here and cannot be; that is task 08's measurement. This Receipt must not be carried to GATE-DONE as "the graders are now correct".

- The defect each repair answers: `khong-code` matched a prose line opening with a capitalised "Export" because `flags: i` made the lowercase keyword branch case-insensitive; `khong-tu-chot` penalised the minimum-change proposal that `SKILL.md` Flow 1 requires, failing an otherwise conforming answer three votes to zero; `moi-ac-co-task` demanded each acceptance ID literally and so rejected `AC-01..AC-06`, a range that covers every declared ID, in four of six runs across both models.
- Review: fresh-context reviewer, three rounds, the cap this task set itself. Round 1 FAIL on a Critical of mine: the regex lives in **three** case directories, not two, and the copy in `export-csv` — the very case that produced the false positive and one of the three the next task reruns — was left unrepaired, so the replay passed while the defect stood. Root cause: a hand-copied file with nothing keeping the copies in step. The script now compares all three before it trusts any replay, and reverting any one of them exits 1, which the reviewer verified by reverting each in turn on a disposable tree.
- Round 2 FAIL on the same class of error this packet keeps finding: the task text described the script's earlier shape while the script had moved on, and Outcome and Acceptance claimed the rubrics were proven when only their text was checked. Both were rewritten; the script's own header had been the honest one.
- A defect of my own that no review caught, found by running the new script: the first comparison used the old pattern **without** its `i` flag, so it reported "36 runs compared, nothing changed" — which would have read as the repair being pointless. The flag is the defect, so the comparison now uses the old grader's pattern and flags together.
- The declaration branch was tightened twice. It first required an identifier, which silently stopped catching `const { toCsv } = require('./csv')`; widening it to accept any character opened a narrow prose gap (`let me know if the mapping A = B is right`); the current form accepts a name, an object pattern or an array pattern and still demands `=`. The reviewer measured 18 code shapes caught, 8 prose lines ignored, and the flagged set identical to both the previous pattern's and an independent ground truth on all 36 runs.
- Also in this task: `export-csv`, `mo-ho-c1` and `sau-keep` gained a `recheck` tag so one invocation per model reruns exactly them, verified as selecting those three and no others, with `sau-keep` still single-arm under auto ablation.
- Open limitations for GATE-DONE: the rubric assertions compare literal strings, so a reworded contradiction would pass them; the pattern is read from the first non-empty line of the grader body, so a comment placed above it would be tested instead, which fails loudly rather than silently; and three hand-kept copies of one regex remain, now guarded by an assertion rather than by structure.
