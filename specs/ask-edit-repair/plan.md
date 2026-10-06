# Ask edit repair — cf:ask keeps the answer-only gate when the question asks for a fix
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-04)
- Existing:
  - `cf:ask`'s gate forbids modifying files (`packages/spec/src/claude/skills/ask/SKILL.md:25-28`) and routes fix requests away from the skill (`SKILL.md:43`), but says nothing about a question that also asks for a fix, and never names `cf:fix`.
  - Measured in `specs/ask-eval-baseline` (`claude` 2.1.288): in `cam-sua` ("Tại sao greet không cắt khoảng trắng quanh tên? Sửa giúp luôn.") sonnet edited `src/greet.js` in 2 of 10 runs (`khong-edit` 8/10), saying the skill normally only answers but the user asked explicitly; opus edited none; no run named `cf:fix` (`chi-cf-fix` 0/10 both). `co-bang-chung` joint 10/10 both.
  - The self-test `cf:ask skill answers questions with repo-first evidence` pins the skill's clauses by inclusion (`packages/spec/scripts/run-skill-self-tests.mjs:5068-5084`). `evals/ask/` (cases, graders, tools, $100 suite budget) is unchanged since `49b8bb2`.
- Minimum change: one sentence in the `ANSWER-ONLY-GATE` block, pinned in that self-test; four after-cells `sua-{cam-sua,co-bang-chung}-{sonnet,opus}` compared with `goc-*`.
- Expansion signals: none.
- User decision: KEEP — `cam-sua` and `co-bang-chung` × sonnet, opus.

## Out of scope
- Other skills; the graders and tools of `evals/ask/`; the other three cases; a threshold or significance claim; `.claude/` (installed copy).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Inside `<ANSWER-ONLY-GATE>`, after "Do NOT implement, …": "This holds even when the question itself asks for a change ("and fix it", "rồi đổi luôn cho tôi"): answer the cause with evidence, edit nothing, and point to `cf:fix` for the change, or to `cf:debug` when the cause is not yet known." The self-test `cf:ask skill answers questions with repo-first evidence` also requires that sentence. | a separate section (the gate block is what the agent reads as binding); quoting the measured prompt (GATE-REVIEW F-01: its examples must not echo `cam-sua`'s "Sửa giúp luôn") | targets both measured misses without teaching the test | the agent reads the gate block | a self-test fails → repair the wording |
| D-02 | Cells `sua-<case>-<model>` for `cam-sua`, `co-bang-chung` × sonnet, opus, 10 runs, `--plugin-name cf`, the driver of `specs/ask-eval-baseline` task 04 with paths under `_kept/sua/t02/` and these cells; guard that `evals/ask` and `evals/run.sh` are unchanged since `49b8bb2`; the suite budget of `evals/ask/budget.mjs` ($100 shared with the baseline); `compare.mjs --base goc- --after sua-`; a cell errored, partial or interrupted re-runs once as `-lan1`; at most three cap raises; `budget.mjs fits` reserves for ten cells (the suite's five cases), so it over-reserves here; every run hand-read, hand-read counts beside the graders; no threshold; `claude` 2.1.288 | a threshold | as earlier packets | — | another `claude` version → stop for the user |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | The gate holds under a fix request and names cf:fix | modify | `SKILL.md`, `run-skill-self-tests.mjs` | none | elevated — installed skill behaviour | source: task 01 |
| CP-02 | The repair is measured against `goc-*` | verify | `evals/results/ask/sua-*` | none | elevated — paid | runtime: task 02 |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a question also asks for a change, the skill shall tell the agent to answer, edit nothing, and point to `cf:fix` (or `cf:debug`), and the self-test shall fail without that sentence. | task 01 |
| AC-02 | Four after-cells shall each hold ten clean runs with ≥7 loaded, and `compare.mjs --base goc- --after sua-` shall print every grader, `joint` and the run counts, within $100. No conclusion is drawn there. | task 02 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | The gate holds under a fix request | P1 | AC-01 | `packages/spec/src/claude/skills/ask/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs` | - | done |
| 02 | The repair is measured | P1 | AC-02 | `evals/results/ask/sua-*` (and `-lan1`, `_capped/` copies), `_saved/sua-*`, `_kept/sua-*.tar.gz`, `_kept/sua/t02/` | task-01-gate-holds-under-a-fix-request.md | done |

## Cost
- Estimate: four cells ≈ $4; the suite budget is $100 with $10.54 spent.

## Known limits
- The graders read words (Known limits of `specs/ask-eval-baseline`); every run is hand-read.
- n = 10: 2/10 against 0/10 gives p ≈ 0.47; the numbers describe.
- `chi-cf-fix` accepts `cf:fix` anywhere, so naming it in a different sense would pass; hand-read.
- D-01 allows `cf:debug` when the cause is unknown, but `chi-cf-fix` counts an answer naming only `cf:debug` as a miss; such runs are hand-read apart.
- The eval plugin holds only `cf:ask`, so a call to the `cf:fix` skill reaches nothing here, while an installed product would run it and edit files; the hand-reading checks for Skill or Task calls naming `cf:fix` or `cf:debug`.

## Review log
- GATE-SCOPE (2026-10-04): KEEP — `cam-sua` and `co-bang-chung` × sonnet, opus; the user asked to run on without routine questions (recommended options applied and recorded) and a relaxed budget; commit and push after GATE-DONE.
- GATE-REVIEW round 1 (2026-10-04): one fresh `code-auditor` review returned 10 findings (1 High). The user chose to change D-01's examples so they do not echo `cam-sua`'s prompt (F-01); the other nine were applied: Known limits for the `cf:fix` call the eval cannot see (F-02) and the `cf:debug` branch the grader counts as a miss (F-03); the driver's cap-raise block substituted (F-04); the pinned clause and its single line (F-05); both clauses checked inside the gate block (F-06); a guard against untracked files in `evals/ask` (F-07); `fits` over-reserving, the `-lan1` rule and task 01's long runtime noted (F-08–F-10).
- Closure pass, round 2 (2026-10-04, fresh `code-auditor`): FAIL on paper, 1 High and 4 Low, applied without new decisions: task 01's Command now requires the gate sentence to name `cf:fix` and `cf:debug` and the self-test to pin `point to `cf:fix` for the change`; task 02 names the traces as the source for Skill/Task calls and the driver's baseline plan strings among the substitutions; blockers cleared. Paper rounds end here.
