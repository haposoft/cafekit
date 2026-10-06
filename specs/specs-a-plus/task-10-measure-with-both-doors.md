# Task 10 — The ambiguous request is measured with both doors open

Status: done

## Outcome
`evals/results/specs/du-cua-sonnet` and `du-cua-opus` each hold ten runs of `mo-ho-du-cua` with `cf:specs` and `cf:brainstorm` both available, and the summarizer reports per model how many runs invoked each skill and how many invoked neither. What that says about the description is read at GATE-DONE.

## Scope
- In: one `evals/run.sh` invocation per model, one summarizer call, reading the first run's trace to confirm the two `input_match` patterns separated the skills correctly, and recording the counts.
- Out: any edit to skills, cases, graders or the harness; changing the description, which is the lever this measurement exists to aim.

## Coverage
- CP-10

## Ownership
- Create: `evals/results/specs/du-cua-sonnet/`, `evals/results/specs/du-cua-opus/` (gitignored)
- Read: `evals/summarize.mjs`, `evals/run.sh`, and the `mo-ho-c1` counts from the four earlier directories for the side-by-side

## Steps
1. Confirm neither directory exists.
2. Run the Command. `--with-skill` is consumed by `evals/run.sh` only while it is the first remaining argument (`evals/run.sh:37`), so it precedes `--out`, as the usage line at `evals/run.sh:7-8` shows; placed later it reaches the CLI, which exits 1 on an unknown option. `--ablation none` is mandatory, not stylistic: without it the harness plans two arms, which doubles the cost to twenty runs per model and quietly turns the three `da-goi-*` graders into with-only indicators that no longer score, changing what is being measured. Expect ten runs per model, single arm, no control arm, because the question is which door is taken rather than whether a door helps. Cost estimate $5-7 [range; basis: $0.207 per single-turn run measured in task 04, twenty runs].
3. Read the first run's trace and confirm `da-goi-specs` and `da-goi-brainstorm` did not both fire on one invocation; report it either way.
4. Copy the Command's stdout into the Receipt unchanged, and put the counts beside `mo-ho-c1`'s 3 of 6 from the one-door world.

## Acceptance
- AC-12 as stated in `plan.md`.
- **Counts come from the summarizer**, both directories non-partial.
- **No conclusion is drawn here.** Which door is correct, and whether the description should change, is a GATE-DONE reading of these counts.

## Dependencies
- task-09-load-several-skills.md

## Verification Plan
- Command: `evals/run.sh specs --with-skill brainstorm --out du-cua-sonnet --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out du-cua-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua && node evals/summarize.mjs evals/results/specs/du-cua-sonnet evals/results/specs/du-cua-opus`
- Named probe: graders `da-goi-mot-skill`, `da-goi-specs`, `da-goi-brainstorm`, `khong-tu-chot` and `khong-code`, counted by `evals/summarize.mjs`
- Reachability: known — the same harness ran ten paid measurements in tasks 04, 05 and 08; `--with-skill` and the `du-cua` tag are proven by task 09's validate
- Oracle: all three commands exit 0; both directories `partial: false`, each case carrying exactly one arm named `with` and ten runs in it, which is also how a missing `--ablation none` would be caught; the table reports `da-goi-specs` and `da-goi-brainstorm` counts that sum to at most the `da-goi-mot-skill` count
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason, leaving the table incomplete
- Artifacts: `evals/results/specs/du-cua-sonnet/result.json`, `evals/results/specs/du-cua-opus/result.json` (gitignored), named in the Receipt

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A harness abort is recorded with its `partialReason`; before a rerun remove the affected `--out` directory explicitly. A count that favours neither door is a finding, not a failure.

## Receipt

Verification: PASS
Command: evals/run.sh specs --with-skill brainstorm --out du-cua-sonnet --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out du-cua-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua && node evals/summarize.mjs evals/results/specs/du-cua-sonnet evals/results/specs/du-cua-opus
Exit: 0
Base: 3eb39f1d2985441dbe4d137b9dd890e994f570c7
Head: 3c0544ad6a7b70292f8484a65e47b12630df20a95d2b610b4a58293aa2c06323
```text
$ evals/run.sh specs --with-skill brainstorm --out du-cua-sonnet --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua && evals/run.sh specs --with-skill brainstorm --out du-cua-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --tag du-cua && node evals/summarize.mjs evals/results/specs/du-cua-sonnet evals/results/specs/du-cua-opus
Note: --scaffold runs each case's scaffold_script as you. Only use it on case files you (or your org) authored.
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/du-cua-sonnet/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/du-cua-sonnet/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/du-cua-sonnet (exit 0)
Note: --scaffold runs each case's scaffold_script as you. Only use it on case files you (or your org) authored.
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/du-cua-opus/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/du-cua-opus/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/specs/du-cua-opus (exit 0)

evals/results/specs/du-cua-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-21T02:01:43.779Z  cost=$1.38
  mo-ho-du-cua [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  da-goi-brainstorm 0/10  da-goi-mot-skill 4/10  da-goi-specs 4/10  khong-code 10/10  khong-tu-chot 10/10

evals/results/specs/du-cua-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-21T02:11:27.874Z  cost=$3.55
  mo-ho-du-cua [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  da-goi-brainstorm 0/10  da-goi-mot-skill 7/10  da-goi-specs 7/10  khong-code 7/10  khong-tu-chot 7/10

AGGREGATE over 2 directories
  mo-ho-du-cua [with]  runs 20  Skill invoked 0/20 (20 run(s) with an unread skill count)  da-goi-brainstorm 0/20  da-goi-mot-skill 11/20  da-goi-specs 11/20  khong-code 17/20  khong-tu-chot 17/20
$ echo $?
0
```
Both result files are gitignored, both report `partial: false`, and each carries exactly one arm named `with` with ten runs — the shape a missing `--ablation none` would have broken. The bytes behind the counts below are pinned here because nothing outside this Receipt records them:

Artifact: evals/results/specs/du-cua-sonnet/result.json
sha256: fa10e31c42305fc3d06bed13370314583d635c126d7475245393435e3447d768
Artifact: evals/results/specs/du-cua-opus/result.json
sha256: 2b854534134f17be5c391361dd039c7d0bf0de98c6fc483ede22102ab428367f

- The Command in this Verification Plan was repaired before it ran, and the repair is the first thing a reader should weigh. As first written it placed `--out` before `--with-skill`; `evals/run.sh:37` consumes `--with-skill` only while it is the first remaining argument, so the flag reached the CLI, which answered `error: unknown option '--with-skill'` and exited 1. Observed: exit 1, zero runs, $0.00. Expected: ten runs per model. The repair reorders two tokens to the form the script's own usage line shows at `evals/run.sh:7-8` and changes no flag, count, model, tag or grader; `evals/run.sh`, the skill, the case and the rubrics were not touched. Task 09's Receipt had already recorded that this option fails loudly when misplaced rather than being silently dropped, which is why the mistake cost nothing: a quiet harness would have charged for ten runs in a one-door world while the task claimed two. The empty `du-cua-sonnet` directory the abort left behind was removed explicitly before the rerun, and the reordered flag set was checked at `$0.00` through the validate path before any paid run started; that check left no artifact, so it rests on this statement alone. Two process points belong to GATE-DONE rather than to this Receipt. The edit changed the task body, not only the Receipt: both the Verification Plan Command and Step 2 were rewritten, and Step 2 is outside the surgical-edit list in `.claude/rules/state-sync.md`. Because the gate proves command identity by comparing the Receipt's Command against the Verification Plan's, editing the plan side makes that check agree with itself; what carries the honesty here is this disclosure and the original text in `git show HEAD:specs/specs-a-plus/task-10-measure-with-both-doors.md`, not the gate. The alternative that needed no judgement of mine was to stop and ask the user.
- Counts, from the summarizer, no conclusion drawn here. sonnet: `da-goi-mot-skill` 4/10, `da-goi-specs` 4/10, `da-goi-brainstorm` 0/10, `khong-code` 10/10, `khong-tu-chot` 10/10, and six runs invoked neither door (runs 2, 4, 5, 7, 9, 10). opus: `da-goi-mot-skill` 7/10, `da-goi-specs` 7/10, `da-goi-brainstorm` 0/10, `khong-code` 7/10, `khong-tu-chot` 7/10, and three runs invoked neither door (runs 1, 5, 8). Neither model opened the second door once in twenty runs.
- Step 3, with a deviation to declare, and the deviation is narrower than it first looked. What is gone is the intermediate trace: each run's `tracePath` points into a per-run temporary directory the harness removes on exit, and all twenty are gone, so the tool-call sequence and the raw encoding of the Skill tool's input cannot be inspected. Each run's final message survives, in `cases[0].arms.with[i].graders[].evidence`, 905 to 5666 characters per run, pinned by the sha256 values above. The separation Step 3 asks about was confirmed from the recorded per-run grader counts, which answer it for all twenty runs instead of one — every invoking run reports `Skill called 1x` for `da-goi-specs` and `Skill called 0x` for `da-goi-brainstorm`, so no run fired both patterns, and the invariant `da-goi-specs + da-goi-brainstorm <= da-goi-mot-skill` holds run by run rather than only in aggregate. For the opposite question the counts are weaker than a trace, not stronger: a call the `[^-]` guard failed to match would report `0x` on all three graders and be indistinguishable from no call at all.
- Task 09's residual collision risk is untested rather than cleared, and this run adds evidence on one side of it while opening a second side. The feared false positive is a brainstorm call whose free-text arguments mention specs; with zero brainstorm calls in twenty runs, that case never arose, so twenty runs passed with no false positive observed and none exercised. The other direction is a false negative, and it is new here: while the Skill input encoding stays `[UNVERIFIED]`, a real call the `[^-]` guard failed to match would score `0x` on all three graders and look exactly like no call, which is the bucket the nine non-invoking runs sit in. What the data does narrow is the encoding itself — eleven calls matched `(^|[^-])specs`, so whatever the harness writes into that input contains `specs` not preceded by a hyphen, which rules out the forms where the skill appears only as part of a hyphenated plugin-qualified name.
- The `Skill invoked` column reads 0/10 for this case and must not be read as the answer. `evals/summarize.mjs:19` recognises only the grader names `co-goi-skill` and `khong-goi-specs`, and this case names its graders `da-goi-*`, so the summarizer honestly reports `10 run(s) with no skill grader` instead of inventing a number. The invocation count for this case is `da-goi-mot-skill`.
- The case's own score caps at 4 of 5 and its pass rate reads 0 by design, because `da-goi-specs` and `da-goi-brainstorm` are mutually exclusive and both scored. That choice was made in task 09 so the two door counts stay visible in the summarizer table; the numbers to read are the per-grader counts above, never the case score.
- One correlation, reported because it is the strongest signal in the data and not because the task asked for it. In opus the three runs that invoked no skill — runs 1, 5 and 8 — are exactly the three that failed `khong-code` and `khong-tu-chot`; every invoking run passed both. In sonnet the six non-invoking runs all passed both. The retained final messages say what the two failure shapes are. All three opus runs answer that they cannot write files because this session has no Write, Edit or Bash tool, and then deliver the finished implementation as pasteable code — run 8 in English, runs 1 and 5 in Vietnamese, 4480 to 5666 characters. All six sonnet runs instead report what they found and ask what is undecided, naming real files: `src/customers.js` in all six, plus `src/users-store.js` or `package.json`, 905 to 1457 characters. `turns` explains neither shape and is not a usable proxy for effort here: sonnet's run 5 shows one turn yet cites two files, cost $0.137 and took 67s, while its run 2 shows nine turns at $0.086 over 27s. What remains `[UNVERIFIED]` is narrower than the behaviour: the intermediate tool-call sequence, and therefore whether a non-invoking run considered a skill and rejected it.
- Two smaller facts a later reader would want. Two opus runs, 3 and 9, ended at fourteen turns, the case's `max_turns` ceiling, so their final messages could have been cut short; both passed every grader and their retained messages run 2041 and 3002 characters, so no truncation is visible. Both directories record `claudeVersion 2.1.278`, while the harness facts pinned in `plan.md:31` were measured on 2.1.274; every flag behaved as recorded, and the suite metadata inside each `result.json` confirms `ablation: none`, the model overrides, `judgeModel: sonnet`, `tagFilters: [du-cua]` and `threshold: 0`.
- Side by side with the one-door world, for shape only. The same prompt under `mo-ho-c1` with `cf:specs` as the only door: sonnet 2/3, opus 1/3, 3/6 together (`evals/results/specs/recheck-sonnet`, `recheck-opus`, 19/09). Task 08 established that three runs cannot separate a one-or-two-run difference from noise, so these are not subtractable from today's ten-run figures.
- Cost, model and judge separately, because `costUsd` in the report and in the summarizer line excludes the judge. Model: $1.3831 sonnet, $3.5527 opus, $4.9358 together. Judge: $0.1019 and $0.1554, $0.2573 together. Total $5.1931, inside the task's $5-7 estimate rather than under it. An earlier draft of this Receipt read $4.93 by adding the two rounded model figures and omitting the judge.
