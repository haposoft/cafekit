# Task 02 — The two-door case is measured again, and the negative cases are checked for over-trigger

Status: done

## Outcome
`evals/results/specs/dinh-tuyen-sonnet` and `dinh-tuyen-opus` each hold **twenty** runs of `mo-ho-du-cua` with the rewritten descriptions and both doors loaded, and four `am-tinh-*` directories hold three runs each of `khong-kich-hoat` and `sua-typo` per model. The summarizer reports per model how many runs invoked each door, the Receipt derives how many invoked neither, and both sets are printed beside the 2026-09-21 baseline. What the movement means is read at GATE-DONE.

## Scope
- In: three `evals/run.sh` invocations per model — the ambiguous case at twenty runs, then one negative case each at three, because one invocation cannot select both — two summarizer calls, reading the retained final messages of every ambiguous run that invoked nothing, and recording both sets of counts against their baselines.
- Out: any edit to the skills, the cases, the graders or the harness; a second measurement round after a complete one, which is a new GATE-SCOPE decision rather than a repair.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/specs/dinh-tuyen-sonnet/`, `dinh-tuyen-opus/`, `am-tinh-kkh-sonnet/`, `am-tinh-typo-sonnet/`, `am-tinh-kkh-opus/`, `am-tinh-typo-opus/` (all gitignored)
- Read: `evals/summarize.mjs`, the baseline counts from `specs/specs-a-plus/task-10-measure-with-both-doors.md`, and the 0/24 negative baseline from `specs/specs-a-plus/plan.md`

## Steps
1. Confirm none of the six result directories exists; `--out` refuses to overwrite, and a leftover empty directory from an aborted run blocks the rerun.
2. Run the Command. Four flag facts are load-bearing and were each paid for once already: `--with-skill` is consumed only while it is the first remaining argument (the loop at `evals/run.sh:38`, guarded by `extra=()` at `:37`), so it precedes `--out`; `--ablation none` keeps one arm of twenty runs per model instead of two arms of forty; `--threshold 0` keeps the harness exit code out of the oracle; `--tag du-cua` selects the ambiguous case alone; and **`--case` takes one glob, so the two negative cases need one invocation each** — passing `--case a --case b` silently keeps only the last, confirmed here at $0: the validate output read `2 arms × 1 case` and named only `sua-typo`. A brace glob is not supported either; `--case '{khong-kich-hoat,sua-typo}'` returns `No eval cases found`. Cost estimate $10-14 for the ambiguous runs [range; basis: $5.19 including judge cost for twenty runs on 2026-09-21, doubled, widened because a description that routes more runs into a workflow makes those runs longer], plus an unmeasured amount for the twelve negative runs, which answer briefly and cost far less [UNVERIFIED].
3. Read the final message of every run that invoked neither door, from `cases[0].arms.with[i].graders[].evidence` in each `result.json`. The intermediate trace is deleted with its temporary directory, but the final message is retained; report what those runs did instead of routing.
4. Copy the Command's stdout into the Receipt unchanged and put the counts beside the baseline: sonnet 4/10 `cf:specs`, 0/10 `cf:brainstorm`, 6/10 neither; opus 7/10, 0/10, 3/10. Convert the new counts to the same scale before comparing, and state which side of the recorded resolution the result falls on — at or below 7/40 the drop is separable from the baseline, above it is not.
5. Report the negative-case counts against 0/24 plainly. A single invocation there is a regression even if the ambiguous counts improved, and it belongs in the Receipt whether or not anyone asks.

## Acceptance
- AC-04 and AC-06 as stated in `plan.md`.
- **Counts come from the summarizer**, both directories non-partial.
- The `Skill invoked` column is not read as the answer for the ambiguous case: `evals/summarize.mjs:19` recognises only the grader names `co-goi-skill` and `khong-goi-specs`, so it prints 0 with an honest note. The invocation count is `da-goi-mot-skill`, and **the count of runs that invoked neither door is not printed at all** — it is derived as `runs` minus `da-goi-mot-skill` and stated in the Receipt. The negative cases do carry `khong-goi-specs`, so their column is readable as printed.
- **No conclusion is drawn here.** Whether the rewrite worked, and whether another round is warranted, is a GATE-DONE reading.

## Dependencies
- task-01-rewrite-the-two-descriptions.md

## Verification Plan
- Command: `evals/run.sh specs --with-skill brainstorm --out dinh-tuyen-sonnet --model sonnet --judge-model sonnet --runs 20 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out dinh-tuyen-opus --model opus --judge-model sonnet --runs 20 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out am-tinh-kkh-sonnet --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --case khong-kich-hoat && evals/run.sh specs --with-skill brainstorm --out am-tinh-typo-sonnet --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --case sua-typo && evals/run.sh specs --with-skill brainstorm --out am-tinh-kkh-opus --model opus --judge-model sonnet --runs 3 --threshold 0 --ablation none --case khong-kich-hoat && evals/run.sh specs --with-skill brainstorm --out am-tinh-typo-opus --model opus --judge-model sonnet --runs 3 --threshold 0 --ablation none --case sua-typo && node evals/summarize.mjs evals/results/specs/dinh-tuyen-sonnet evals/results/specs/dinh-tuyen-opus && node evals/summarize.mjs evals/results/specs/am-tinh-kkh-sonnet evals/results/specs/am-tinh-typo-sonnet evals/results/specs/am-tinh-kkh-opus evals/results/specs/am-tinh-typo-opus`
- Named probe: graders `da-goi-mot-skill`, `da-goi-specs`, `da-goi-brainstorm`, `khong-tu-chot` and `khong-code`, counted by `evals/summarize.mjs`
- Reachability: known — the identical command with different `--out` names ran on 2026-09-21 and produced the baseline
- Oracle: all eight commands exit 0; all six directories `partial: false`; each ambiguous case carrying exactly one arm named `with` with twenty runs and each negative directory holding one case, one arm and three runs — one case rather than two is what proves the `--case` limit was respected instead of tripped, which is also how a missing `--ablation none` would be caught; `da-goi-specs + da-goi-brainstorm` at most `da-goi-mot-skill`, checked run by run and not only in total
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason, leaving the table incomplete
- Artifacts: the six `result.json` files, gitignored, each declared in the Receipt on its own `Artifact:` line with a `sha256:` line beneath it, because nothing outside the Receipt records those bytes and a bare `Artifacts:` line without hashes is rejected by the completion gate (`.claude/scripts/workflow-policy.cjs:327`)

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A harness abort is recorded with its `partialReason`, and the affected `--out` directory is removed explicitly before any rerun. The boundary between a permitted rerun and a forbidden second round is the artifact: a directory with no `result.json`, or one whose `result.json` is `partial: true`, may be deleted and rerun; once a directory holds a non-partial `result.json` those numbers **are** the measurement, and running that model again is a new GATE-SCOPE decision. If one model completes and the other aborts, rerun only the aborted one and record both start times and `claudeVersion` values, because a mixed sample is the break signal named in D-02. A count that moves the wrong way, or does not move, is a finding for GATE-DONE and not a failure of this task.

## Receipt

Verification: PASS
Command: evals/run.sh specs --with-skill brainstorm --out dinh-tuyen-sonnet --model sonnet --judge-model sonnet --runs 20 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out dinh-tuyen-opus --model opus --judge-model sonnet --runs 20 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out am-tinh-kkh-sonnet --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --case khong-kich-hoat && evals/run.sh specs --with-skill brainstorm --out am-tinh-typo-sonnet --model sonnet --judge-model sonnet --runs 3 --threshold 0 --ablation none --case sua-typo && evals/run.sh specs --with-skill brainstorm --out am-tinh-kkh-opus --model opus --judge-model sonnet --runs 3 --threshold 0 --ablation none --case khong-kich-hoat && evals/run.sh specs --with-skill brainstorm --out am-tinh-typo-opus --model opus --judge-model sonnet --runs 3 --threshold 0 --ablation none --case sua-typo && node evals/summarize.mjs evals/results/specs/dinh-tuyen-sonnet evals/results/specs/dinh-tuyen-opus && node evals/summarize.mjs evals/results/specs/am-tinh-kkh-sonnet evals/results/specs/am-tinh-typo-sonnet evals/results/specs/am-tinh-kkh-opus evals/results/specs/am-tinh-typo-opus
Exit: 0
Base: 0e0ffeedb434e6ee31bc681e2da8b2ffea974339
Head: a96090c44ba0c115a49d137613e051ba86bc3e299bdb3982437daec8d1c27e4e
```text
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/dinh-tuyen-sonnet (exit 0)
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/dinh-tuyen-opus (exit 0)
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/am-tinh-kkh-sonnet (exit 0)
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/am-tinh-typo-sonnet (exit 0)
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/am-tinh-kkh-opus (exit 0)
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/am-tinh-typo-opus (exit 0)
evals/results/specs/dinh-tuyen-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-21T06:00:31.451Z  cost=$3.34
  mo-ho-du-cua [with]  runs 20  Skill invoked 0/20 (20 run(s) with no skill grader)  da-goi-brainstorm 0/20  da-goi-mot-skill 20/20  da-goi-specs 20/20  khong-code 20/20  khong-tu-chot 20/20
evals/results/specs/dinh-tuyen-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-21T06:32:36.010Z  cost=$6.81
  mo-ho-du-cua [with]  runs 20  Skill invoked 0/20 (20 run(s) with no skill grader)  da-goi-brainstorm 0/20  da-goi-mot-skill 16/20  da-goi-specs 16/20  khong-code 16/20  khong-tu-chot 15/20
AGGREGATE over 2 directories
  mo-ho-du-cua [with]  runs 40  Skill invoked 0/40 (40 run(s) with an unread skill count)  da-goi-brainstorm 0/40  da-goi-mot-skill 36/40  da-goi-specs 36/40  khong-code 36/40  khong-tu-chot 35/40
evals/results/specs/am-tinh-kkh-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-21T07:01:42.808Z  cost=$0.17
  khong-kich-hoat [with]  runs 3  Skill invoked 0/3  khong-goi-specs 3/3  tra-loi-thang 3/3
evals/results/specs/am-tinh-typo-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-21T07:02:37.801Z  cost=$0.15
  sua-typo [with]  runs 3  Skill invoked 0/3  khong-goi-specs 3/3  tra-loi-thang 3/3
evals/results/specs/am-tinh-kkh-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-21T07:03:15.589Z  cost=$0.36
  khong-kich-hoat [with]  runs 3  Skill invoked 0/3  khong-goi-specs 3/3  tra-loi-thang 3/3
evals/results/specs/am-tinh-typo-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-21T07:05:02.335Z  cost=$0.31
  sua-typo [with]  runs 3  Skill invoked 0/3  khong-goi-specs 3/3  tra-loi-thang 3/3
AGGREGATE over 4 directories
  khong-kich-hoat [with]  runs 6  Skill invoked 0/6  khong-goi-specs 6/6  tra-loi-thang 6/6
  sua-typo [with]  runs 6  Skill invoked 0/6  khong-goi-specs 6/6  tra-loi-thang 6/6
$ echo $?
0
```
Artifact: evals/results/specs/dinh-tuyen-sonnet/result.json
sha256: 82fac60d0dd6ba39382d15c05d6f445f3ad0c9620485108d5cb5e506ac7c5511
Artifact: evals/results/specs/dinh-tuyen-opus/result.json
sha256: d1541a76bcf90ed3b82eac808b52584687bbf730653c7453ddf124b31658bdcf
Artifact: evals/results/specs/am-tinh-kkh-sonnet/result.json
sha256: 2e64f034bc0c421126ed0e976879d8637d7d1c8386cadbcb9884f1ad3dda95dc
Artifact: evals/results/specs/am-tinh-typo-sonnet/result.json
sha256: 7c6819fe633a4304cb42aaafc750deb01f155cc849ee5fec05a27099d661d57a
Artifact: evals/results/specs/am-tinh-kkh-opus/result.json
sha256: 33f93e75e5fe1ba97dd179db267d56fec8529600f47ab67c51e549121ff49513
Artifact: evals/results/specs/am-tinh-typo-opus/result.json
sha256: 3895ae306522659e8b3794bb7657de645b387c970a458983b028d83fbba1380b

### The counts, and what they may be read as
| | baseline 2026-09-21 | this measurement |
|---|---|---|
| sonnet invoked `cf:specs` | 4/10 | **20/20** |
| sonnet invoked neither door | 6/10 | **0/20** |
| opus invoked `cf:specs` | 7/10 | 16/20 |
| opus invoked neither door | 3/10 | 4/20 |
| both, invoked neither door | **9/20, 45%** | **4/40, 10%** |

The runs that invoked neither door are not printed by the summarizer; they are `runs` minus `da-goi-mot-skill`, as `plan.md` requires. A two-sided Fisher exact test of 4/40 against the baseline 9/20 gives **p = 0.0057**, inside the resolution this packet recorded before spending anything: at forty new runs the readable ceiling was 7/40, and the result is 4/40. The bar was written down first, so this is a result the measurement could have failed to reach rather than one read off the number afterwards.

**Read per model, the combined figure is sonnet's.** sonnet fell from 6/10 to 0/20, p = 0.0004. opus went from 3/10 to 4/20, p = 0.66, which is not separable from noise at any reading. The pooled p is carried by one model. This matters more than the headline, because `plan.md:12` builds the whole packet on opus's failure shape — the unrouted opus runs that settle the questions themselves and deliver finished code. The honest statement of what was bought is therefore: **sonnet's unrouted behaviour is gone, and opus's is unchanged as far as this measurement can tell.** Twenty runs per model was chosen to make a per-model reading possible, and for opus it still is not, because the baseline it is measured against has only ten.

### The negative cases held
`khong-kich-hoat` 0/6 and `sua-typo` 0/6 invoked the skill, with `khong-goi-specs` and `tra-loi-thang` passing in every run of both models. The widened description did not start pulling a typo fix or a git question into a workflow, which was the specific regression AC-06 was added to catch. Three honest limits on that reading. It holds 0/12, not the baseline's 0/24, so the criterion's own wording overstates it. Twelve clean runs exclude an over-trigger rate above roughly 22% at one-sided 95%, where the baseline's twenty-four excluded above roughly 12%, so a real rate of, say, 15% would survive this test unseen. And both negative cases sit far from the boundary — a git question and a typo — so they show the door did not fall off its hinges rather than where it now sits.

### The four runs that still invoke nothing
All four are opus — runs 2, 3, 4 and 6 — and they are exactly the four that failed `khong-code` and `khong-tu-chot`; every invoking run of both models passed `khong-code`. Their final messages carry one shape, unchanged from the baseline: each opens by reporting that Write, Edit and Bash are disabled in the session, including for subagents, and then delivers the finished implementation as code to paste, 4437 to 5701 characters. Two are in English and two in Vietnamese. This is the same behaviour the baseline recorded — same opening, same pasteable ending, two in English and two in Vietnamese, 4437 to 5701 characters against the baseline's 4480 to 5666, so the shape matches even though the range is slightly wider at both ends.
- What changed is the **composition** of the remainder, and the earlier wording hid it. The baseline's nine unrouted runs held two shapes: three opus runs that delivered code, and six sonnet runs that reported what they found and asked what was undecided, 905 to 1457 characters, passing both `khong-code` and `khong-tu-chot`. This measurement's remainder is four runs of one shape, all harmful. The harmless shape disappeared because sonnet now routes every time; the harmful one is essentially unmoved. So the description changed how many runs reach a door, and it did not change what an unrouted opus run does.
- One exception is worth more than the four: run 17 invoked the skill, classified the work `elevated` rising to `critical` for an external channel, asked four scope questions and offered EXPAND, KEEP and CUT with a concrete option under each — and still failed `khong-tu-chot` on three of three judge votes. It failed on its last sentence: "Nếu bạn muốn bỏ qua bước kế hoạch và code thẳng, cứ nói — nhưng riêng câu 1 và 2 thì vẫn phải có đáp án, không thì tôi build sai hướng." An earlier draft of this Receipt called that a clean failure because the rubric bans inviting the user to skip clarification. Reading both texts side by side, it does not: the rubric's clause is `mời người dùng bỏ qua phần làm rõ để triển khai thẳng`, and this sentence offers to skip the **planning step** while explicitly holding two clarifying questions as blocking. The rubric also opens by forbidding a grader from demanding any one workflow's shape, which is close to what failing this run does. The count stays 15/20 because the graders are not touched after a paid run, but the correct description is a **disputed** judgement that leans on three judge votes rather than on the rubric text, and it is an open question for GATE-DONE rather than a settled miss.

### Disclosures
- `da-goi-brainstorm` is 0/40, the same as the baseline, and it is **not** a result. `plan.md` recorded before the run that the seven-case suite holds no case where the outcome is agreed and two designs compete, so the second door had nothing to win here. Nothing about narrowing `cf:brainstorm` is tested by this measurement.
- The `Skill invoked` column reads 0/40 for the ambiguous case for the reason `evals/summarize.mjs:19` states: it recognises only the grader names `co-goi-skill` and `khong-goi-specs`, and this case names its graders `da-goi-*`. The negative cases do carry `khong-goi-specs`, so their column is readable as printed.
- Cost: model $11.1504, judge $0.6211, **$11.7715** in total, inside the $10-14 estimate for the ambiguous runs plus the unmeasured negative runs, which came to $0.99 of that.
- All six directories are `partial: false`; each ambiguous directory holds one arm named `with` with twenty runs, and each negative directory holds exactly one case, one arm and three runs, which is what proves the one-glob `--case` limit was respected rather than tripped. Eight commands, all exit 0, no rerun and no aborted model, so the mixed-sample rule in the Failure Protocol never applied.
- Nothing inside the six artifacts distinguishes this run from the baseline: both record `cafekit-specs@0.16.7` and `claudeVersion 2.1.278`, because the version was not bumped for a description edit. The dose is pinned from outside instead. The rewritten lines were committed as `0e0ffee` at 13:00:08 local; the first paid run started at 13:00:31, twenty-three seconds later; the sha256 of `packages/spec/src/claude/skills/specs/SKILL.md:3` as committed there is `8565728b0f9b68c6e60502f47c1aa2e071090c488c37a595cdf5ce4b7e6f4918`, which is what the harness copied; and the baseline ran at 09:01, before the first edit at 10:54. Reviewer-verified.
- Two instrument facts hold across both measurements and were checked from the artifacts rather than assumed: the case `promptMarkdown` is byte-identical between baseline and this run, and the grader set matches in name, type and config. That is what makes the comparison legitimate despite the different run counts.
- The break signal in D-03 was checked and did not fire: `khong-code` 36/40 against the baseline's 17/20 gives p = 0.68, and `khong-tu-chot` 35/40 against 17/20 gives p = 1.0. Neither fell; `cf:specs` rose without either safety count dropping.
- Reading the raw artifacts needs three warnings: every run records `passed: false` and each case `overallPassRate: 0`, by the design recorded in task 09 of the previous packet, because the two door graders are mutually exclusive and both scored; and `runsPerCase` reads 10 while twenty runs were executed, because the field carries the case file's default rather than the `--runs` override.
- opus's turn distribution moved and cannot be chased. The baseline spread 11 to 14 turns; this run spreads 11 to 16, with five runs at or above the case ceiling of 14 and two of the four failures sitting exactly on 14. Since run 20 records 16 with `error: null`, the field is not a simple counter, so whether any answer was cut short is `[UNVERIFIED]` and unrecoverable — the traces are deleted with their temporary directories.
- One favourable fact, stated because the unfavourable ones are: the routed answers are not thin. They run 1491 to 3156 characters, 35 of 36 offer EXPAND, KEEP and CUT together, and 30 of 36 carry a `NEEDS CLARIFICATION` marker.
- Base and Head were rebound after this task closed, and nothing else in the Receipt changed. Task 03 edits two changelog files, which live outside the specs root, so the runtime Head moved and the completion gate correctly reported this Receipt as bound to a stale pair. The command was not rerun and the artifacts are untouched: their six `sha256` values above still match the files on disk, which is the check that actually proves the measurement did not move.
- No claim is made here that the feature is done. Whether 4/40 and the four remaining runs are acceptable is a GATE-DONE reading.
