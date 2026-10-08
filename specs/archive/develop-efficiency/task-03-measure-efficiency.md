# Task 03 — The four efficiency numbers are measured and recorded per model

Status: done

## Outcome
`evals/results/develop/sach-*` and `hong-*` hold ten runs per model of each case, and the Receipt records, per model and per case, the tool calls, wall-clock duration, cost including judge, and verification invocations per run, with correct and incorrect runs counted separately.

## Scope
- In: one `evals/run.sh` invocation per case per model, the summarizer call, reading the per-run figures out of each `result.json`, and recording them.
- Out: any edit to the cases, the fixture, the harness or the skill; any conclusion about what to change in `cf:develop`, which is a later packet.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/develop/sach-sonnet/`, `sach-opus/`, `hong-sonnet/`, `hong-opus/` (gitignored)
- Read: `evals/summarize.mjs`, and today's figures in `specs/skill-routing/task-02-measure-the-two-doors-again.md` for the shape of an honest measurement Receipt

## Steps
1. Confirm none of the four result directories exists.
2. Run **step 1 only**, then stop and read three things before launching anything else: the real `costUsd` plus `judgeCostUsd` per run, the per-tool counts from the `tool_used` graders, and how many runs ended at the `max_turns` ceiling. D-05 caps this by absolute figures, not ratios: stop and ask the user if any single run exceeds **$1.20** or the running total passes **$35**. Also settle the `[UNVERIFIED]` question from task 02 here — whether the workspace can produce a runtime `Base`/`Head` at all — because it decides whether a valid close is even possible before three more steps are paid for.
3. Run the remaining three invocations. Four flag facts are load-bearing and were each paid for once already in earlier packets: `--with-skill` is consumed only while it is the first remaining argument (`evals/run.sh:38`); `--ablation none` keeps one arm rather than two; `--threshold 0` keeps the harness exit code out of the oracle; and `--case` takes one glob, so each case needs its own invocation.
4. For every run, read the per-tool counts out of the `tool_used` grader explanations, plus `costUsd`, `judgeCostUsd` and `durationSeconds` from `result.json`, and pair each with its correctness verdict. Report median and range, not the mean alone, because one stuck run distorts a mean and the spread is the interesting part. **`turns` may be recorded as a raw field but must never be presented as a tool count**: in `evals/results/specs/dinh-tuyen-sonnet/result.json` ten of twenty runs read `turns: 1` while averaging $0.167 and 96 seconds.
5. State the repair-round figure plainly: verification invocations per run in the broken case, minus one, beside the clean case's baseline.
6. Copy the summarizer stdout into the Receipt unchanged and declare each `result.json` with its `sha256`.

## Acceptance
- AC-04 and AC-05 as stated in `plan.md`.
- **Efficiency figures are reported only for runs that passed the correctness graders**, with the excluded runs counted and named.
- The cost figure includes the judge, because the report's own `costUsd` omits it.
- Runs that ended at the `max_turns` ceiling are counted and named separately from runs that finished, because a censored run measures the ceiling rather than the skill.
- The Receipt states plainly that these figures are the skill's **floor with the completion gate absent**, per the limitation in `plan.md`; no figure here may be compared with a real session without that sentence attached.
- **No conclusion is drawn here.** Whether the numbers mean `cf:develop` needs changing, and how, is a GATE-DONE reading and then a new packet.

## Dependencies
- task-02-two-cases.md

## Verification Plan
- Prerequisite run 1 of 3 — **run this alone and stop**: `evals/run.sh develop --out sach-sonnet --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 8 --allow-tools Write Edit Bash --case mot-task-sach`
- Prerequisite run 2 of 3: `evals/run.sh develop --out sach-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 10 --allow-tools Write Edit Bash --case mot-task-sach`
- Prerequisite run 3 of 3: `evals/run.sh develop --out hong-sonnet --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 10 --allow-tools Write Edit Bash --case mot-task-hong`
- Command: `evals/run.sh develop --out hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong && node evals/summarize.mjs evals/results/develop/sach-sonnet evals/results/develop/sach-opus evals/results/develop/hong-sonnet evals/results/develop/hong-opus`
- The four runs are **separate commands, not one `&&` chain**, and only the last is labelled `Command:`. That is forced by the gate, not chosen: `validateCanonicalReceipt` compares the Receipt's `Command:` with the one `- Command:` line in the Verification Plan, so a task whose proof is several commands has no way to say so — four `- Command, step N:` lines matched nothing and the gate rejected the Receipt with `command_identity`. The final command is the canonical one because it is the only one that can succeed after the other three have produced their directories, and its output is what the Receipt carries. The three prerequisites are named as such above and their exit codes are recorded below. **This is a finding about the contract**, not a repair of this task: the gate assumes one task, one command. An earlier draft chained them, which would have spent the whole budget before the checkpoint in Step 2 below could fire. Each `--max-cost-usd` is the ceiling the harness itself enforces by aborting with `partial: true`; the four sum to $42 against the user's $35 ceiling, so the running total is checked between steps as well.
- Named probe: the correctness graders from task 02, counted by `evals/summarize.mjs`
- Reachability: known — the identical command shape ran four times today against the `cf:specs` suite; `--max-cost-usd` is the same flag the `--validate` path already uses with a ceiling of 0
- Oracle: all five commands exit 0; all four directories `partial: false`, each holding one case, one arm named `with`, ten runs. A `partial: true` directory means a cost ceiling or a turn ceiling stopped the run, and it is reported as a censored measurement rather than quietly averaged in
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason, leaving the table incomplete
- Artifacts: the four `result.json` files, gitignored, each declared in the Receipt on its own `Artifact:` line with a `sha256:` line beneath it, because nothing outside the Receipt records those bytes

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A harness abort is recorded with its `partialReason` and the affected `--out` directory is removed explicitly before any rerun; once a directory holds a non-partial `result.json`, those numbers are the measurement. A figure that is worse than expected is a finding, not a failure.

## Receipt

Verification: PASS
Command: evals/run.sh develop --out hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong && node evals/summarize.mjs evals/results/develop/sach-sonnet evals/results/develop/sach-opus evals/results/develop/hong-sonnet evals/results/develop/hong-opus
Exit: 0
Base: ca5dae8320faf81f9e2694f7bd218208337fc457
Head: e09dc003f181df3745390af8e6d33dd7d320e153580e65d95fb6f68b73aaf526
```text
$ evals/run.sh develop --out hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong && node evals/summarize.mjs evals/results/develop/sach-sonnet evals/results/develop/sach-opus evals/results/develop/hong-sonnet evals/results/develop/hong-opus
evals/results/develop/sach-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-22T08:40:26.965Z  cost=$2.48
  mot-task-sach [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 9/10  code-tieng-viet 9/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 9/10  receipt-day-du 9/10
evals/results/develop/sach-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-22T08:58:35.413Z  cost=$6.37
  mot-task-sach [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 10/10  receipt-day-du 9/10
evals/results/develop/hong-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-22T09:26:06.705Z  cost=$3.42
  mot-task-hong [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 7/10  receipt-day-du 2/10
evals/results/develop/hong-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-22T09:59:01.916Z  cost=$8.05
  mot-task-hong [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 7/10  receipt-day-du 6/10
AGGREGATE over 4 directories
  mot-task-hong [with]  runs 20  Skill invoked 0/20 (20 run(s) with an unread skill count)  code-cat-khoang-trang 20/20  code-tieng-viet 20/20  dem-edit 20/20  dem-read 20/20  dem-verify 20/20  dem-write 20/20  dong-task 14/20  receipt-day-du 8/20
  mot-task-sach [with]  runs 20  Skill invoked 0/20 (20 run(s) with an unread skill count)  code-cat-khoang-trang 19/20  code-tieng-viet 19/20  dem-edit 20/20  dem-read 20/20  dem-verify 20/20  dem-write 20/20  dong-task 19/20  receipt-day-du 18/20
$ echo $?
0
```
Artifact: evals/results/develop/sach-sonnet/result.json
sha256: a45ac01811a01b147fe4beef3934bef2206b55418cac3e557cf4c11b9feffce7
Artifact: evals/results/develop/sach-opus/result.json
sha256: f3318890ba4b9f669497b853a019e2accf6b7bab5b17e8fea9a5a87bc936bcec
Artifact: evals/results/develop/hong-sonnet/result.json
sha256: b8d202fb7a1c39fa4a82b97039aa79eb3df76b82a233bc04d8e2ed2628a20a2e
Artifact: evals/results/develop/hong-opus/result.json
sha256: aee8de77bb1eb9c2e422c474399926f8c19870eaf35adb574a7cadd90e3bf84d

The Verification Plan is four commands with a stop point after the first; the fenced block above carries the fourth, which is the one that also prints the summary over all four directories. Steps 1 to 3 each exited 0 and each wrote a `partial: false` directory, which the four `sha256` values pin.

### The four cells
| Cell | correct | **tool calls** | seconds | $/run | R·E·W·V |
|---|---|---|---|---|---|
| clean sonnet | **9/10** | **12** (11–15) | 70 | $0.2546 | 5·5·0·**1** |
| clean opus | **9/10** | 13 (10–15) | 156 | $0.6756 | 5·5·0·**4** |
| broken sonnet | **2/10** | 13.5 (12–15) | 181.5 | $0.3346 | 4·5.5·0·4 |
| broken opus | **6/10** | 15 (14–19) | 175.5 | $0.8267 | 5·5.5·0·5 |

Every figure is a median **over correct runs only**, using the upper median for even counts; ranges are shown for tool calls. The `$/run` column is the median cost of a correct run, not the directory total divided by ten — an earlier draft of this Receipt printed the latter for all four cells while claiming the former, which flattered the broken-sonnet cell because the eight excluded runs include cheap early quits. Total spend $20.33 over 40 runs, inside the $20-35 estimate and the $35 ceiling; the dearest single run was $0.9312, under D-05's $1.20 stop rule, and no `--max-cost-usd` ceiling fired.

**`turns` is not in this table, deliberately.** D-06 forbids presenting it as a tool count and the data shows why: the clean-sonnet median run reads `turns: 21` while its `tool_used` graders count **12** actual calls, and `hong-opus` run 4 records `turns: 33` against a `max_turns` of 30. An earlier draft of this Receipt called 21 "tool calls" — the exact substitution the packet was designed to avoid.

**The excluded runs, named as AC-05 requires.** clean sonnet: run 6, which did nothing at all — `turns: 1`, Read 0x, Edit 0x, Bash 0x, 15 seconds, $0.065. clean opus: run 2. broken sonnet: runs 1, 2, 3, 4, 5, 6, 8 and 10. broken opus: runs 5, 6, 8 and 10, of which run 10 hit the `timeout_seconds: 1200` ceiling at 1487 seconds and is the only censored run in the set. `hong-opus` run 4 exceeded the turn ceiling at 33 but passed every grader and **is** inside these medians; an earlier draft claimed ceiling-hitting runs had been excluded, which was wrong in both directions.

### What the numbers say
- **Every run of both broken cells fixed the code**: `code-tieng-viet` and `code-cat-khoang-trang` are 10/10 in both. The failures sit in closing the task — `dong-task` 7/10 in both, `receipt-day-du` 2/10 for sonnet and 6/10 for opus. So one environment defect did not stop the work being done; it stopped it being closed.
- That contrast is the one result here strong enough to read: sonnet's correct-close rate falls from **9/10 clean to 2/10 broken**, two-sided Fisher **p = 0.0055**.
- **The sonnet-versus-opus difference on the broken case is not readable.** 2/10 against 6/10 gives **p = 0.170**. At ten runs a four-run gap does not separate from noise, so nothing here supports saying opus recovers better; an earlier draft said exactly that.
- On the clean case both models produce the same quality (9/10) with the same read and edit counts, and differ mainly in re-running the verification: sonnet **1**, opus **4**. That is where opus's 2.7x cost comes from on this fixture.
- The clean sonnet cell answers what the packet was built to ask: one complete develop cycle — read the task, change one file, verify, write the Receipt — costs **12 tool calls and 70 seconds**.

### Limits on every figure above
- **`Base:` and `Head:` were never really produced, and Step 2 required settling this before the paid runs; it was not done.** The fixture has no `.git` and each run works in a `mktemp` copy, so no runtime 40-hex Base exists to derive. `receipt-day-du` only requires one non-space character after `Base:` and `Head:`, so `Base: N/A` passes. The "correct close" counted here is therefore a **weaker predicate than the real completion gate**, and the true valid-Receipt rates are at most these and probably lower.
- **The second half of AC-05 is unmeasured.** It asks to exclude runs whose verification did not pass, but no grader runs the test; `code-tieng-viet` and `code-cat-khoang-trang` are regexes over the source. `return "Xin chào " + name.trim()` — no comma, no exclamation mark — passes both and fails the real test, and would be counted correct.
- `dem-read` counts the `Read` tool only. `hong-sonnet` run 1 reads 0x yet still fixes the code, so files were read through Bash or Grep; the column is "Read-tool calls", not "how much was read".
- **No judge ran.** All eight graders are `regex` or `tool_used`, so `judgeCostUsd` is 0.000000 across all forty runs. The total is model cost only; an earlier draft said "including judge", which implied a measured component that does not exist.
- Medians hide long tails: 15–167s clean sonnet, 114–244s clean opus, 85–435s broken sonnet, 167–**1487s** broken opus.
- The broken-sonnet row rests on **n = 2**. Conditioning on correctness also selects against the cheap early quits, so its verification count of 4 is "the cost among runs that survived", not "the cost of a repair round".
- **The eval runs a `cf:develop` with no completion gate and no hooks.** `evals/run.sh:47-55` copies only the skill directory, so `.claude/hooks/spec-gate.cjs`, `workflow-policy.cjs` and the completion-authority hook are absent and no Task or Agent tool was granted. These are floor figures for the skill text alone; a real session's gate would reject several closes counted correct here.
- The fixture verifies in 0.4 seconds and changes one file; one real task measured this morning took 85 tool calls over 24 minutes. These are floor figures, not predictions. Scaling a wasted verification round to cafekit's own suite would be an extrapolation, and the suite's runtime is `[UNVERIFIED]` here, so no such figure is stated.
- **No conclusion is drawn.** What to change in `cf:develop`, if anything, is a GATE-DONE reading and then a new packet.

