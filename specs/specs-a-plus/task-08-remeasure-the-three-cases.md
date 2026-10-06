# Task 08 — The three affected cases are remeasured with the repaired graders

Status: done

## Outcome
Two named result directories, `recheck-sonnet` and `recheck-opus`, hold three runs of `export-csv`, `mo-ho-c1` and `sau-keep` each, measured with the repaired graders, and the summarizer prints their per-grader counts beside the counts the defective graders produced. Whether the two previously missed bars are now met is read at GATE-DONE, not decided here.

## Scope
- In: one `evals/run.sh` invocation per model over the `recheck` tag, one summarizer call, and recording the table.
- Out: any edit to skills, cases or graders; the three cases not affected by the three defects; a verdict on the bars.

## Coverage
- CP-08

## Ownership
- Create: `evals/results/specs/recheck-sonnet/`, `evals/results/specs/recheck-opus/` (gitignored)
- Read: `evals/summarize.mjs`, `evals/run.sh`, and the four earlier result directories for the side-by-side

## Steps
1. Confirm neither directory exists; `--out` refuses to overwrite.
2. Run the Command. Expect 15 runs per model: `export-csv` and `mo-ho-c1` at two arms each, `sau-keep` single-arm because its history sets that automatically. Cost estimate $8-14 [range; basis: $0.207 per single-turn run and $0.356 per resumed run measured in tasks 04 and 05].
3. Copy the Command's stdout into the Receipt unchanged.
4. Under the Receipt, put the repaired counts next to the defective-grader counts for the same cases, so the difference attributable to the instrument is visible.

## Acceptance
- AC-10 as stated in `plan.md`.
- **Counts come from the summarizer**, and both directories are non-partial.
- **Nothing is repaired here.** A count still below a bar is written down for GATE-DONE.

## Dependencies
- task-07-repair-the-graders.md

## Verification Plan
- Command: `evals/run.sh specs --out recheck-sonnet --model sonnet --judge-model sonnet --runs 3 --threshold 0 --allow-tools Write Edit --tag recheck && evals/run.sh specs --out recheck-opus --model opus --judge-model sonnet --runs 3 --threshold 0 --allow-tools Write Edit --tag recheck && node evals/summarize.mjs evals/results/specs/recheck-sonnet evals/results/specs/recheck-opus`
- Named probe: graders `khong-tu-chot`, `mot-cau-hoi-c1`, `co-marker`, `co-goi-skill`, `khong-code`, `moi-ac-co-task` and the rest of the `sau-keep` set, counted by `evals/summarize.mjs`
- Reachability: known — the same harness and tags ran in tasks 04 and 05; `--tag` is a list filter and a history case runs single-arm under auto ablation
- Oracle: all three commands exit 0; both directories are `partial: false`; the table lists `export-csv`, `mo-ho-c1` and `sau-keep` with three runs in each arm they should have
- Counterexample: a run cut short leaves `partial: true`, the summarizer skips that directory and says why, and the table is incomplete
- Artifacts: `evals/results/specs/recheck-sonnet/result.json`, `evals/results/specs/recheck-opus/result.json` (gitignored), named in the Receipt

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A harness abort is recorded with its `partialReason`; before a rerun remove the affected `--out` directory explicitly. A count below a bar is not a failure of this task.

## Receipt

Verification: PASS
Command: evals/run.sh specs --out recheck-sonnet --model sonnet --judge-model sonnet --runs 3 --threshold 0 --allow-tools Write Edit --tag recheck && evals/run.sh specs --out recheck-opus --model opus --judge-model sonnet --runs 3 --threshold 0 --allow-tools Write Edit --tag recheck && node evals/summarize.mjs evals/results/specs/recheck-sonnet evals/results/specs/recheck-opus
Exit: 0
Base: b2b4239e62c8c2c96477514e1e48c03e11469233
Head: 6d4c8d8a35fe6915166b63d713d6fc74895322b5997880eb42e3ffe8f0868a24
```text
AGGREGATE over 2 directories
  export-csv [with]  runs 6  Skill invoked 4/6  co-goi-skill 4/6  dung-truoc-khi-lam 3/6  khong-code 6/6
  export-csv [without]  runs 6  Skill invoked 0/6 (6 run(s) with an unread skill count)  dung-truoc-khi-lam 0/6  khong-code 6/6
  mo-ho-c1 [with]  runs 6  Skill invoked 3/6  co-goi-skill 3/6  co-marker 3/6  khong-code 6/6  khong-tu-chot 3/6  mot-cau-hoi-c1 3/6
  mo-ho-c1 [without]  runs 6  Skill invoked 0/6 (6 run(s) with an unread skill count)  co-marker 0/6  khong-code 6/6  khong-tu-chot 0/6  mot-cau-hoi-c1 0/6
  sau-keep [with]  runs 6  Skill invoked 6/6  co-goi-skill 6/6  co-plan 5/6  co-task 5/6  khong-sua-code 6/6  khong-viet-code 6/6  moi-ac-co-task 5/6  plan-co-decisions 5/6  plan-co-priority 5/6  task-co-failure-protocol 5/6  task-co-oracle 5/6  task-co-steps 5/6
```
The two per-directory sections above the aggregate are omitted for length and cost nothing to reproduce.

- Artifacts: `evals/results/specs/recheck-sonnet` (`partial: false`, 3 cases, 15 runs, $4.8983, 34 minutes) and `recheck-opus` (`partial: false`, 3 cases, 15 runs, $7.6423, 32 minutes), both gitignored. Total $12.5406 over 66.5 minutes, inside the $8-14 estimate — the first cost estimate in this packet that held.

**What the repaired graders changed, beside what the defective ones reported.**

| Grader | Defective | Repaired |
|---|---|---|
| `khong-tu-chot` (`mo-ho-c1`) | 1/6 | 3/6 |
| `moi-ac-co-task` (`sau-keep`) | 2/6 | 5/6 |
| `khong-code` (`export-csv`) | 4/6 | 6/6 |

- Four of the thirty runs ended `exit 1: Reached maximum number of turns (14)`, all in `export-csv[without]`: one sonnet and all three opus, each stopping at exactly 15 turns. They remain in every denominator the summarizer prints, which does not show the field. Three of them left an answer of 14, 14 and 99 characters, so `khong-code` passing on those runs carries no information. The mechanism is `[UNVERIFIED]`: my first reading — that a control arm runs past the cap because nothing stops it — does not survive the evidence, since `mo-ho-c1[without]` reached 17 and 19 turns under the same cap without erroring while every errored run stopped at 15.
- `khong-code` reaching 6/6 on `export-csv` must not be read as the one real adherence gap being closed. The six with-arm answers are full (1211 to 2884 characters) and contain no code at all, so the repaired pattern missed nothing; the gap simply did not recur. Nothing in tasks 07 or 08 was aimed at closing it, and the condition that produced it — the case granting no Write or Edit, so an implementing model must put code in the answer — is unchanged. At a base rate of one in six, six draws cannot separate "gone" from "not drawn".
- Several counts fell although task-07 touched no skill text: `export-csv` skill invoked 6/6 → 4/6 and `dung-truoc-khi-lam` 5/6 → 3/6; `mo-ho-c1` skill invoked 4/6 → 3/6; `sau-keep` `co-plan` 6/6 → 5/6. The reviewer tested the obvious rival explanation — that this task's Command adds `--allow-tools Write Edit` — and refuted it: both single-turn cases declare `allowed_tools: [Read, Glob, Grep, Skill]`, and a run may use only the intersection, so those two cases could not see Write or Edit. The skill files and `run.sh` were unchanged between the two measurements, and every grader that moved is one task-07 did not touch. Variance is the explanation that survives.
- What that implies, and it reaches back over the whole packet: three graders whose own bytes did not change still moved by one in six, so a difference of one or two in six is indistinguishable from noise. Three runs per model is enough to see a large effect, such as the 0 of 4 to 10 of 12 the description change produced, and not enough to treat 11/12 as different from 9/12.
- No per-model claim in this packet survives. On `sau-keep` the first measurement had sonnet at 2/3 on `moi-ac-co-task` and opus at 0/3; this one has opus perfect at 3/3 everywhere and sonnet dropping to 2/3 because one run never wrote `plan.md`, which took seven file-reading graders down with it. Two measurements, two opposite conclusions about the same pair on the same case. This is why GATE-REVIEW removed the per-model floors.
- The two measurements used different `sau-keep` ceilings, 600s then 1200s. Actual durations here were 63 to 239 seconds, so nothing depended on it.
- Post-closure amendment, disclosed rather than hidden: task-06's changelog entries stated these counts as properties of the skill. Both files now say the figures come from one sample of three runs per model and name the later sample's 4 of 6 and 3 of 6. Task-06's verification command still exits 0. The edit touches a closed task's artifact, as the `sau-keep` timeout did in task-05.
- Review: fresh-context reviewer, one round, PASS. It recomputed the three movements from the artifacts, tested and refuted the tool-environment explanation for the drops, read all six `export-csv` answers to settle whether the gap recurred, and corrected my account of the four errored runs.
