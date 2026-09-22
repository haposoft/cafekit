# Develop efficiency — what one task actually costs
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-09-22)
- Chosen: build `evals/develop/` and measure **how efficiently `cf:develop` executes one task**, then stop. The numbers are the deliverable; changing the skill is a later packet.
- The user's target, in their words: measure the execution efficiency of develop, not conformance to any single law. They did not want to pick laws, so the controller chose the metric set below and records it here rather than asking again.
- Tool grant: **full** — `Write`, `Edit` and `Bash`. The user chose this so the skill really executes; a read-only run would measure what a model *says* it will do, which the previous packet already showed is not enough.
- Runs: **ten per model**, both sonnet and opus.
- Expansion signals: about seventeen new small files in one directory, one deliverable group, no new service — above the eight-file mark but below the split threshold, so one packet.

## What "efficiency" means here, decided by the controller
Four numbers per run, three of which the harness records without any grader:

| Metric | Source | Why it is the right number |
|---|---|---|
| tool calls, split by tool | `tool_used` graders with `min: 0`, one per tool, read per run | **`turns` is not a tool counter and must not be used as one.** In `evals/results/specs/dinh-tuyen-sonnet/result.json` ten of twenty runs report `turns: 1` while averaging $0.167 and 96 seconds, and `specs/skill-routing/task-02-measure-the-two-doors-again.md:123` already recorded that the field is not a simple counter. The grader explanation carries `<tool> called <n>x`, which is a real count, and splitting it by tool is also what makes the result actionable: it says whether the budget goes to reading, editing or running |
| wall-clock duration | `durationSeconds` per run | What the user actually waits |
| `costUsd` plus `judgeCostUsd` | `result.json` per run | The report's own figure omits the judge |
| rounds to green | the `Bash` counter grader, matched to the verification command, in **both** cases | A repair round costs one full verification; the clean case supplies the baseline the broken case is measured against, so both cases carry the counter |

**A fast run that did the wrong thing is not efficient.** Every case therefore carries correctness graders, and a run that closes a task without a valid Receipt, or without the verification actually passing, is counted as a failure rather than as a cheap success. This rule exists because today's A/B test produced exactly that trap: the arm without a spec finished 30% faster and had skipped 60% of the scope.

## Why this is wanted
`cf:specs` has seven eval cases and has been measured repeatedly; `cf:develop` has **none**, and `evals/develop/` does not exist. Every claim about how develop executes — including the five findings in today's evaluation of it — rests on one person's session log, not on a repeatable measurement. Meanwhile the user's stated goal is a 30-minute task, and the only figures available for it are a 76-minute average from one project's history and a single 24-minute A/B arm.

## Measured constraints (2026-09-22, HEAD `17dcf7e`)
- `evals/run.sh` is skill-generic: it resolves `packages/spec/src/claude/skills/<skill>` and `evals/<skill>` from its argument (`evals/run.sh:28-30`), so `evals/run.sh develop` needs no harness change.
- A case is small: `case.yaml` 15–24 lines, `scaffold.sh` 5 lines copying a shared fixture, graders about 6 lines each (`evals/specs/sau-keep/`, `evals/specs/mo-ho-du-cua/`).
- `develop/SKILL.md:37` requires `node .claude/scripts/workflow-policy.cjs`, a path **outside** the skill directory that the temporary eval plugin does not carry. A case that avoids `--flash` and `--parallel` never reaches that line; only a case testing that guard would need the fixture to ship the 104KB script.
- `evals/summarize.mjs:19` recognises only the grader names `co-goi-skill` and `khong-goi-specs` for its `Skill invoked` column, so develop cases either reuse those names or read their own graders instead.
- Two tool-call figures exist and they measure different things; the earlier draft of this plan quoted both as if they were one, which is how it under-priced the packet. **85 tool calls** is one agent executing one spec'd task once, in an isolated worktree, this morning — the closest analogue to one eval run. **362 tool calls per task** is `radar-insight`'s whole history divided by its task count, so it includes scouting, review, rework and every abandoned attempt across many sessions. Both are `[UNVERIFIED]` against this repository: neither is recorded anywhere outside this packet, and the first rests on a single observation.
- Price per run, taken from sixteen result directories already in this repository rather than extrapolated: `recheck-sonnet` $0.301/run at 13 turns, `recheck-opus` $0.439 at 15, `sonnet-history` $0.378 at 15, `opus-history` $0.619 at 14. **opus costs 1.4 to 1.6 times sonnet at the same turn count**, which the earlier estimate collapsed into one number.
- The harness defaults a case to **10 turns and 300 seconds** when `max_turns` and `timeout_seconds` are absent. Every existing case sets them by hand — 5/180 for `sua-typo` up to 30/1200 for `sau-keep` — because the default is far below what a real task needs.
- `claude plugin eval` runs at concurrency 1 unless told otherwise, so forty runs of a develop-sized task execute sequentially and will occupy the machine for hours.

## Out of scope
- Any change to `cf:develop` itself, to `evals/run.sh`, to `evals/summarize.mjs`, or to the `cf:specs` cases.
- Measuring conformance to a named law of the skill (the WARNINGS gate, the three-round cap, the controller-only-writes rule). Those are separate cases for a later packet.
- Comparing `cf:develop` against another tool or against a no-specs arm.
- Acting on the result. Fixing what the numbers expose is a later packet with its own scope decision.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | A fixture packet exists whose single task is small enough to measure repeatedly and real enough to execute | add | `evals/develop/fixture/` | none | routine — new files only; evidence: the existing fixture pattern at `evals/specs/dung-o-c1/fixture` | source: the case loads under `--validate` with no `✗` |
| CP-02 | Two cases measure the floor cost and the cost of one repair round | add | `evals/develop/mot-task-sach/`, `evals/develop/mot-task-hong/` | none | elevated — the cases grant Write, Edit and Bash, so a run executes real commands as the user; evidence: `evals/run.sh` passes `--scaffold` for authored suites | source: `--validate` output |
| CP-03 | The four efficiency numbers are recorded per model, with correctness held separate | verify | `evals/results/develop/*` | none — the bar is a GATE-DONE reading | elevated — a paid live-model measurement that cannot be replayed | runtime: summarizer table plus per-run figures read from `result.json` |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The fixture shall contain one `plan.md` and one `task-01-*.md` whose owned change is a single source file, whose verification command runs in under five seconds, and whose task file is valid to the workflow resolver. | `resolveWorkflowCandidate` returns the packet with one `pending` task, and the verification command timed once |
| AC-02 | When `evals/run.sh develop --validate` runs, both cases shall load with exit 0 and no `✗` line. | the `--validate` output |
| AC-03 | The clean case shall present a task that passes its verification on the first attempt; the broken case shall present the same task with one planted defect that fails the verification exactly once and is repairable from the failure message alone. | the planted defect named in the task's Receipt, and the verification run once by hand on each fixture before any paid run |
| AC-04 | When both cases run ten times per model, the Receipt shall report per model and per case: median and spread of tool calls **split by tool and read from the `tool_used` graders**, wall-clock duration, `costUsd` plus `judgeCostUsd`, and the number of verification invocations per run. `turns` may be recorded as a raw field but shall not be presented as a tool count. | `node evals/summarize.mjs` plus per-run grader explanations and figures read from each `result.json` |
| AC-05 | Each run shall be classified correct or not, and no efficiency figure shall be reported for a run that closed the task without a valid Receipt or without its verification passing. | correctness graders in each case, counted beside the efficiency figures |

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Measure efficiency, not conformance to named laws | Four law-conformance cases | The user asked for execution efficiency and declined to pick laws; efficiency is also what the 30-minute goal needs | The harness's own per-run figures (`turns`, `costUsd`, duration) are trustworthy | A figure contradicts a hand count → trust the hand count and record the discrepancy |
| D-02 | A deliberately small fixture task: one source file, one test, verification under five seconds | A realistic task like today's A/B arm | At 85 tool calls per run, forty runs cost about $71; a small task keeps the same shape at roughly a quarter of the price | A small task exercises the same develop cycle — scout, implement, verify, receipt — as a large one | The runs finish in so few turns that the cycle is not visible → enlarge the fixture and re-estimate before spending more |
| D-03 | Two cases: one clean, one with a planted defect | One case; three or more | One case cannot separate the floor cost from the cost of a repair round, which is the number the 30-minute budget turns on | The planted defect is repairable from the failure message, so the extra rounds measure the cycle and not puzzle-solving | Runs fail to repair the defect at all → the case measures difficulty rather than process; report and do not average it in |
| D-04 | Correctness graders in every case, and efficiency reported only for correct runs | Measuring speed alone | Today's A/B test produced a faster arm that had skipped 60% of the scope; speed without correctness is not a result | A run that closes with a valid Receipt and a passing command did the work | A run passes the graders while visibly doing less → tighten the graders before reading the numbers |
| D-05 | Ten runs per model, both models, full tool grant, hard ceiling $35 | Three runs; read-only grant; a relative cost threshold | The previous packet measured that fewer runs cannot separate a per-model figure from noise; a read-only run measures intention rather than execution | The per-run price stays near the sixteen measured directories | **An absolute figure, not a ratio**: stop and ask if any single run exceeds $1.20, or if the running total passes $35. The earlier relative rule would have fired on an ordinary opus run of the broken case, which costs about $0.90 by design |
| D-06 | `tool_used` graders are the tool-call counter; `turns` is recorded but never reported as a tool count | Reading `turns` as tool calls; parsing `tracePath` | `turns` is measurably not a counter, and `tracePath` points into a temporary directory the harness deletes | The grader explanation keeps the `<tool> called <n>x` shape the summarizer already parses | The explanation format changes → fall back to `--keep-temp` and count from `trace.jsonl`, and say in the Receipt that the count came from there |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | A fixture packet small enough to measure and real enough to execute | P1 | AC-01 | `evals/develop/fixture/` | - | pending |
| 02 | Two cases: the clean run and the one-repair run | P1 | AC-02, AC-03 | `evals/develop/mot-task-sach/`, `evals/develop/mot-task-hong/` | task-01 | pending |
| 03 | The four efficiency numbers are measured and recorded per model | P1 | AC-04, AC-05 | `evals/results/develop/*` | task-02 | pending |

## Review log
- GATE-REVIEW (2026-09-22): one fresh-context reviewer, 15 findings (3 Critical, 6 High, 5 Medium, 1 Low), verdict FAIL. The controller reproduced all three Criticals before the gate: `turns` reads 1 on ten of twenty runs that each cost $0.167 and ran 96 seconds; all seven existing cases set `max_turns` and `timeout_seconds` by hand while this packet set neither; and the single `&&` chain in task 03 would have spent the whole budget before the cost checkpoint could fire.
- User decision: **accepted all 15**; chose to record the missing-hooks gap as a limitation rather than pay to close it; kept ten runs per model with a hard $35 ceiling.
- Applied: C1 replaces the non-existent tool-call field with `tool_used` graders split by tool and adds D-06; C2 sets explicit turn and timeout ceilings in both cases; C3 splits the measurement into four commands with a stop point and a machine-enforced `--max-cost-usd`; H1 rebuilds the estimate per model from sixteen existing result directories and makes D-05's break signal an absolute figure; H2 separates the 85 and 362 figures and labels both `[UNVERIFIED]`; H3 gives the planted defect an owner; H4 puts the counter grader in both cases; H5 is recorded as a limitation; H6 adds a cheap Base/Head probe before any paid run; M1 corrects the HEAD; M2 corrects the plugin-assembly citation to `evals/run.sh:45-62`; M3 pins the fixture task filename and each case's `name:` field; M4 drops the `templates.md` pointer the temporary plugin does not carry; M5 records the sequential runtime; L1 passes an empty runtime object.
- Planning is complete. Implementation requires a new explicit `/cf:develop develop-efficiency` invocation.

## Known limitations carried into execution
- The measurement describes a small synthetic task. Today's real task took 85 tool calls against the fixture's expected 15–20, so the figures are a floor, not a prediction for production work.
- The cases grant `Bash`, so each run executes real commands on this machine as the user. The harness sandbox limits reach but does not guarantee it.
- Nothing here measures the laws of the skill, so a run that is fast and correct on this fixture says nothing about whether the WARNINGS gate, the three-round cap or the controller-only-writes rule are followed.
- **The eval runs a different `cf:develop` from the one a real session runs, and the user accepted this rather than paying to close it.** `evals/run.sh:47-55` copies only the skill directory into the temporary plugin, so none of `.claude/hooks/spec-gate.cjs`, `.claude/scripts/workflow-policy.cjs` or the completion-authority hook is present, and the cases grant no Task or Agent tool although `develop/SKILL.md:129` points at subagent dispatch. What the numbers therefore describe is the **floor cost of the skill text alone, with the completion gate switched off**. Since that gate is exactly what forces a rerun in a real session, the measured repair rounds are a lower bound. No figure from this packet may be compared with a real session without saying so.
- Cost estimate **$20-35**, built per model from the measured per-run prices above rather than from one observation: at the 15-20 turn size D-02 assumes, roughly $0.40-0.55 for a clean sonnet run, $0.60-0.80 clean opus, and about 40% more for each broken-case run, plus judge cost. The user accepted this range and set a hard ceiling of $35 enforced by `--max-cost-usd` rather than by discipline.
- The measurement runs sequentially at concurrency 1, so expect hours of machine occupancy, not minutes.
