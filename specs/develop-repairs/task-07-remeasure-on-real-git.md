# Task 07 — Both skill versions are measured on the repaired instrument

Status: done

## Outcome
`evals/results/develop/git-{truoc,sau}-{sach,hong}-{sonnet,opus}` hold ten runs each: the pre-repair skill (`0b7ec52`) and the repaired skill (tasks 01–03 and 08, working tree), both measured on the task-06 and task-08 instrument, so the only difference between a `truoc` and a `sau` cell is the skill text.

## Scope
- In: eight `evals/run.sh` invocations with `--keep-temp`, the summarizer, reading final messages from kept traces for every run that did not close, and recording figures beside the registered directions below.
- Out: any change to cases, fixture, graders or harness after task 08; any skill edit; drawing the conclusion, which belongs to GATE-DONE.

## Coverage
- CP-05

## Ownership
- Create: the eight result directories (gitignored); a temporary worktree of `0b7ec52` under the session scratchpad, removed at the end
- Read: `task-04-measure-after.md` Receipt for the flawed-instrument figures

## Steps
1. Confirm the eight directories do not exist, `which git` resolves to `/opt/homebrew/bin/git`, and `packages/spec/src/claude/skills/develop` is identical at `0b7ec52` and `ca5dae8`.
2. **Before-skill cells:** `git worktree add <scratchpad>/truoc 0b7ec52`, then copy the current `evals/develop/` over the worktree's copy so both arms use the same instrument; run the four `git-truoc-*` invocations from that worktree and move each result directory into this repository's `evals/results/develop/`.
3. **After-skill cells:** run the four `git-sau-*` invocations from this repository.
4. Every invocation: `--runs 10 --threshold 0 --ablation none --judge-model sonnet --allow-tools Write Edit Bash --keep-temp`, one `--case`, ceiling `--max-cost-usd 10` for sonnet and `14` for opus.
5. For each run that does not pass, read the last assistant message from its kept trace and record the stated reason in one short phrase. Then make the kept directories readable with `chmod 700` and delete them.
6. Remove the worktree with `git worktree remove`.
7. Report per cell: correct count, median tool calls from the `tool_used` graders (never `turns`), median seconds and median cost over correct runs, median Bash count over all runs, and the stated reasons for the misses.

## Registered expectations
Written 2026-09-23, before any paid run of this task.

| Comparison | Grader | Expected | Why |
|---|---|---|---|
| clean, both skills, both models | correct close | **at least 8/10** | git now works, so an honest run can close; a clean cell below 8 on either skill is a defect of that skill or of the instrument, and is reported as it is |
| clean, `sau` vs `truoc` | correct close | **not lower by more than one** | the repairs should not cost a clean task anything |
| clean, `sau` vs `truoc` | tool calls | up by 1–3 | the pre-change verification run and the judge read |
| broken, `sau` vs `truoc` | `dong-task`, `receipt-day-du` | **down** | the repaired skill stops at an unrelated failure instead of closing |
| broken, `sau` vs `truoc` | code graders | unchanged or down | a run that stops at the blocker may leave the code unedited |
| broken, `sau` vs `truoc` | Bash count | down | the failure is seen once and raised rather than retried |

## Acceptance
- AC-09 as stated in `plan.md`.
- Every miss is named with its run number and stated reason; timeouts are named and kept out of the correct-run medians.
- The task-04 figures are quoted as the flawed-instrument reading, not mixed into these cells.
- **No conclusion is drawn here.**

## Dependencies
- task-08-name-the-provenance-command.md

## Verification Plan
- Command: `evals/run.sh develop --out git-sau-hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong --keep-temp && node evals/summarize.mjs evals/results/develop/git-truoc-sach-sonnet evals/results/develop/git-truoc-sach-opus evals/results/develop/git-truoc-hong-sonnet evals/results/develop/git-truoc-hong-opus evals/results/develop/git-sau-sach-sonnet evals/results/develop/git-sau-sach-opus evals/results/develop/git-sau-hong-sonnet evals/results/develop/git-sau-hong-opus`
- Prerequisite runs: the other seven invocations of Steps 2–3, same flags, names `git-truoc-{sach,hong}-{sonnet,opus}` and `git-sau-sach-sonnet`, `git-sau-sach-opus`, `git-sau-hong-sonnet`
- Named probe: the eight graders of each case, counted per run
- Reachability: known — task 04 ran the same cases, and the task-06 checker proves the workspace has a commit
- Oracle: all eight run commands and the summarizer exit 0; eight directories `partial: false`, one case, one arm `with`, ten runs
- Counterexample: a run cut short leaves `partial: true` and the summarizer skips that directory with a reason
- Artifacts: the eight `result.json` files, gitignored, each declared on its own `Artifact:` line with a `sha256:` line beneath it

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. A figure that moves the wrong way is the finding and is reported as it is.

## Receipt

Verification: PASS
Command: evals/run.sh develop --out git-sau-hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong --keep-temp && node evals/summarize.mjs evals/results/develop/git-truoc-sach-sonnet evals/results/develop/git-truoc-sach-opus evals/results/develop/git-truoc-hong-sonnet evals/results/develop/git-truoc-hong-opus evals/results/develop/git-sau-sach-sonnet evals/results/develop/git-sau-sach-opus evals/results/develop/git-sau-hong-sonnet evals/results/develop/git-sau-hong-opus
Exit: 0
Base: 46a4ed1d51f2f293dabd51ec74bdbb4dcc294bc6
Head: 89673dae9b87e77a1a3b13365dbc49d9c96f3bee5a52b07b7ff499fb2cb696a6
```text
$ evals/run.sh develop --out git-sau-hong-opus --model opus --judge-model sonnet --runs 10 --threshold 0 --ablation none --max-cost-usd 14 --allow-tools Write Edit Bash --case mot-task-hong --keep-temp && node evals/summarize.mjs evals/results/develop/git-truoc-sach-sonnet evals/results/develop/git-truoc-sach-opus evals/results/develop/git-truoc-hong-sonnet evals/results/develop/git-truoc-hong-opus evals/results/develop/git-sau-sach-sonnet evals/results/develop/git-sau-sach-opus evals/results/develop/git-sau-hong-sonnet evals/results/develop/git-sau-hong-opus
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/git-sau-hong-opus/result.json
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/develop/git-sau-hong-opus (exit 0)
evals/results/develop/git-truoc-sach-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T04:13:01.868Z  cost=$2.06
  mot-task-sach [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 10/10  receipt-day-du 6/10
evals/results/develop/git-truoc-sach-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-23T04:22:56.034Z  cost=$3.04
  mot-task-sach [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 10/10  receipt-day-du 10/10
evals/results/develop/git-truoc-hong-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T04:31:56.047Z  cost=$3.40
  mot-task-hong [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 10/10  receipt-day-du 5/10
evals/results/develop/git-truoc-hong-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-23T04:53:50.107Z  cost=$2.98
  mot-task-hong [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 0/10  receipt-day-du 0/10
evals/results/develop/git-sau-sach-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T04:13:01.892Z  cost=$2.25
  mot-task-sach [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 10/10  receipt-day-du 9/10
evals/results/develop/git-sau-sach-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-23T04:22:56.411Z  cost=$2.40
  mot-task-sach [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 10/10  code-tieng-viet 10/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 10/10  receipt-day-du 9/10
evals/results/develop/git-sau-hong-sonnet  model=sonnet  judge=sonnet  ablation=none  started=2026-09-23T04:31:56.046Z  cost=$3.53
  mot-task-hong [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 9/10  code-tieng-viet 9/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 6/10  receipt-day-du 5/10
evals/results/develop/git-sau-hong-opus  model=opus  judge=sonnet  ablation=none  started=2026-09-23T05:04:02.631Z  cost=$2.04
  mot-task-hong [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  code-cat-khoang-trang 0/10  code-tieng-viet 0/10  dem-edit 10/10  dem-read 10/10  dem-verify 10/10  dem-write 10/10  dong-task 0/10  receipt-day-du 0/10
AGGREGATE over 8 directories
  mot-task-hong [with]  runs 40  Skill invoked 0/40 (40 run(s) with an unread skill count)  code-cat-khoang-trang 29/40  code-tieng-viet 29/40  dem-edit 40/40  dem-read 40/40  dem-verify 40/40  dem-write 40/40  dong-task 16/40  receipt-day-du 10/40
  mot-task-sach [with]  runs 40  Skill invoked 0/40 (40 run(s) with an unread skill count)  code-cat-khoang-trang 40/40  code-tieng-viet 40/40  dem-edit 40/40  dem-read 40/40  dem-verify 40/40  dem-write 40/40  dong-task 40/40  receipt-day-du 34/40
EXIT:0
```
Artifact: evals/results/develop/git-truoc-sach-sonnet/result.json
sha256: 6b977c9d189639bfaf55756b90337325ec5d23e2f8f803545c72031d2de8a5b7
Artifact: evals/results/develop/git-truoc-sach-opus/result.json
sha256: 9f0383c53434127bb84f49269cf7c9fe62c8977b6c81bd5644bdf1cfcf562447
Artifact: evals/results/develop/git-truoc-hong-sonnet/result.json
sha256: 2091d44d53092a4c30a8a6ddaba052dd4724ca3dddf31c23bd9dc785593de5cb
Artifact: evals/results/develop/git-truoc-hong-opus/result.json
sha256: 420091821b2912c3d5d91ca5ed49962584c9e2835e8bfaa66b82d8b6680f75b8
Artifact: evals/results/develop/git-sau-sach-sonnet/result.json
sha256: bc550eded241bb02ac1064ce2d9890112807b8f0a341772078eaedb8b797d4ce
Artifact: evals/results/develop/git-sau-sach-opus/result.json
sha256: e6a4a3c2887a6a00c5849d416c874d6ec8fc92bf7da029bc6c90f20247333770
Artifact: evals/results/develop/git-sau-hong-sonnet/result.json
sha256: 795256e688ee2b7a8536cd560f43853e4fc922e2db373b6a40326e501c32710d
Artifact: evals/results/develop/git-sau-hong-opus/result.json
sha256: 0d605e63261609871e104227697407a1de8a05c6e2a5aea90cf5ffabdc28e12d

The fenced block drops the harness's `--scaffold` notices, `Report:` paths and the ten `⚠ kept` lines. The seven prerequisite invocations each exited 0 (`git-truoc-*` ran from a detached worktree of `0b7ec52` with the current `evals/develop/` rsync'd in, confirmed identical by `diff -rq`, and were moved here); all eight directories are `partial: false`, one case, one arm `with`, ten runs. Step 1 held: no directory pre-existed, `which git` gave `/opt/homebrew/bin/git`, and the skill is identical at `0b7ec52` and `ca5dae8`. Step 5: every miss's final message and task file were read from its kept trace, then all 88 kept directories from this session were deleted. Step 6: the worktree was removed.

### Per cell (tool, seconds, $ are medians over correct runs; V is median Bash over all ten; tool = Read+Bash+Edit+Write, never `turns`)
| Cell | correct | tool | sec | $/correct | V | misses and stated reason |
|---|---|---|---|---|---|---|
| clean sonnet, pre-repair | **6/10** | 9 | 56.5 | $0.1982 | 1 | #5 #6 #7 #10: closed with a real Base but `Head:` written as prose ("working tree, uncommitted") |
| clean sonnet, repaired | **9/10** | 11 | 57 | $0.2253 | 2 | #6: real Base and 64-hex Head, but no fenced output block |
| clean opus, pre-repair | **10/10** | 5 | 53.5 | $0.2995 | 3 | none; runs found `.claude/scripts/provenance.cjs` by listing the tree |
| clean opus, repaired | **9/10** | 4 | 48 | $0.2385 | 3 | #1: real Base and 64-hex Head, but no fenced output block |
| broken sonnet, pre-repair | 5/10 | 13 | 143 | $0.3550 | 5 | #2 #4 #5 #7 #9: closed with Head as prose |
| broken sonnet, repaired | 5/10 | 13 | 124 | $0.3512 | 6 | #1 #6 #8: code done, stopped at the broken command as a blocker; #3: stopped before any change; #2: closed, Receipt failed |
| broken opus, pre-repair | 0/10 | n/a | n/a | n/a | 3 | all ten: edited the code, then left `in_progress` because the plan's command fails |
| broken opus, repaired | 0/10 | n/a | n/a | n/a | 2 | all ten: stopped **before changing any code**, naming the broken command as a blocker |

**Every checked close in the broken cells substituted the command.** Sonnet closed the broken task in 16 of 20 runs (10 pre-repair, 6 repaired). The plan names `node --test test/`; all 11 whose Receipt command was read (the ten grader passes and repaired #2) wrote `node --test test/greet.test.js`, `test/*.test.js` or bare `node --test`. The other five closes (pre-repair #2 #4 #5 #7 #9) were not read for their command before the kept traces were deleted. The real gate's `command_identity` would reject those Receipts; this eval has no gate. In the broken cells the grader counts closes, not correct behaviour.

Stopped at the broken command and raised it, in the broken cells: sonnet 0/10 → 4/10; opus 10/10 → 10/10, of which before any code change 0/10 → 10/10.

### Registered directions beside the outcome
| Comparison | Registered | Observed |
|---|---|---|
| clean, both skills, both models, correct | at least 8/10 | pre-repair sonnet 6/10 **below**; repaired sonnet 9, pre-repair opus 10, repaired opus 9 |
| clean, repaired vs pre-repair, correct | not lower by more than one | sonnet +3; opus −1 |
| clean, repaired vs pre-repair, tool calls | up by 1–3 | sonnet 9 → 11 (+2); opus 5 → 4 (−1, not up) |
| broken, `dong-task` / `receipt-day-du` | down | sonnet 10 → 6 and 5 → 5; opus 0 → 0 and 0 → 0 |
| broken, code graders | unchanged or down | sonnet 10 → 9; opus 10 → 0 |
| broken, Bash count | down | sonnet 5 → 6 (**up**); opus 3 → 2 |

Rebound at the final-Head fixed point from `f1d51729…` to the current Head: all eight declared `sha256` values were recomputed and match, and no file the proof reads (`develop/` skill, `evals/develop/`, `evals/run.sh`, `evals/summarize.mjs`, `provenance.cjs`) is newer than the last cell's `result.json`; the only change outside `specs/` since the run is the two changelogs of task 05, which this proof does not read, and every figure above is derived from the eight artifacts.

Limits: ten runs per cell does not separate one or two runs; the grader cannot detect a well-formed invented 40-hex Base (task-06 review); the eval runs without hooks or the completion gate, and the sandbox denies `find`/`Glob` into the plugin's `references/`, so only `SKILL.md` text reliably reaches a run. No conclusion is drawn here.
