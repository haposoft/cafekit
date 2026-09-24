# Debug eval baseline
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-09-23)
- Existing: `evals/run.sh:27-31` takes a skill name and reads cases from `evals/<skill>/` (no `evals/debug/` yet); `evals/summarize.mjs` prints per-grader counts and `dem-*` tool-call medians; grader shapes proven in `evals/scout/chan-doan-giam-gia/graders/` (file regex for "code unchanged", last-message regex, `tool_used` counts with `input_match`, an `llm` judge); `evals/scout/check-fixture.sh` is the fixture-checker pattern. The debug gates to measure: DIAGNOSTIC-ONLY (`packages/spec/src/claude/skills/debug/SKILL.md:33-38`), HARD-GATE-SCOUT-FIRST (`:40-52`), ROOT-CAUSE (`:54-61`), the six `✓ Step` markers (`:101-207`), the report format (`:211-265`).
- Minimum change: four cases under `evals/debug/`, each aimed at one defect the 2026-09-23 history review found, plus a free fixture checker; then a baseline of ten runs per case per model before any edit to the skill.
- Expansion signals: one new eval directory — four fixtures of about 8–12 files, about 70 grader files including shared copies, four scaffolds, a checker and a cross-count script — no service, one deliverable group; kept as one task by user decision at GATE-REVIEW (finding 13).
- User decision: **KEEP** — four cases, skill `cf:debug` only, sonnet and opus, ten runs each.

## Why this is wanted
The history review (167 Codex sessions, 1 Claude session) found: a "high" root-cause confidence written from static reading that recurred after a green suite (birdnion, 2026-08-14); a heavy read on shared staging that the diagnostic-only gate does not forbid (a DynamoDB scan the user had to stop); two report formats, the skill's `Debug Report` and the agent's `Debugger Report`; ceremony nobody uses (`✓ Step 2–6` in 0 of 167 sessions, no flag ever passed); and callers reading "Activate `cf:scout`" as "scout yourself". Those are history counts, not a controlled measurement; this packet makes the measurement a later repair can be compared against.

## Out of scope
- Any edit to `skills/debug/`, `agents/debugger.md` or `.claude/references/debugger/`.
- The `debugger` agent path (user chose skill-only).
- Loading `cf:scout` beside debug: the cases measure debug with its own fallback reconnaissance.
- Real staging or network access: the staging script is a local stand-in that only writes a marker.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | One case per observed defect, graded by behaviour a file or tool log can show | One broad case graded by an LLM | a grader tied to one defect makes a later repair's effect readable per defect | the harness exposes tool inputs to `input_match` and files to regex graders, as `evals/scout` already uses | a grader scores identically on runs that plainly differ → fix the grader before measuring |
| D-02 | `doc-ma-sai-huong` counts the habit — stated high confidence with or without a Bash call that executes the code — independent of whether the cause is right; the prompt asks for a confidence | Hiding the cause from static reading so a wrong "high" can occur | the fixture's cause is findable by reading, and the recurrence was a habit of claiming certainty before running (user decision, finding 8) | the model states a confidence when asked | a run states none → the "not stated" row |
| D-04 | The staging README states only that the database is shared, with no prohibition | Forbid running the script in the README | the historical defect is that the skill's own gate does not forbid heavy shared reads; a README ban would measure README-following (user decision, finding 9) | — | — |
| D-03 | Grant `Edit` and `Write` in every case | Withhold them | withholding them hides whether the diagnostic-only gate holds; `evals/specs` showed withheld tools move code into the answer instead | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Four debug cases load, each fixture has exactly its planted defect, and every grader scores on a real run | create | `evals/debug/**` | none | elevated — paid pilot | static: `evals/debug/check-fixtures.sh`, `evals/run.sh debug --validate`; runtime: one pilot run per case |
| CP-02 | A baseline of the current skill exists per case and model | verify | `evals/results/debug/base-*` | none — the reading is GATE-DONE's | elevated — paid runs | runtime: eight result directories |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the four cases are validated and piloted once each, the fixture checker shall pass, validate shall print no `✗`, and each pilot shall score every grader with `partial: false`. | task 01's Command |
| AC-02 | When each case runs ten times per model on the unchanged skill, the Receipt shall report per cell every grader's count, the median tool calls, median seconds and cost, and for `doc-ma-sai-huong` the cross-count of stated confidence against whether the run executed the code. | `node evals/summarize.mjs` and `node evals/debug/cross-count.mjs` over the eight directories |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Four debug cases, each aimed at one observed defect | P1 | AC-01 | `evals/debug/` | - | done |
| 02 | The unchanged skill is measured on the four cases | P1 | AC-02 | `evals/results/debug/base-*` | task-01 | done |

## Review log
- GATE-REVIEW (2026-09-23): one fresh-context reviewer (spec-maker), 15 findings (5 High, 8 Medium, 2 Low), verdict FAIL. It read the grader engine in the `claude` 2.1.280 binary: `regex` supports `match: contains|not_contains|count:N`, a `file_exists {path, exists}` grader exists, and `input_match` runs `new RegExp(input_match).test(inputText)` over the whole serialized tool input, `description` included.
- User decisions: accept findings 1–7, 10–12, 14, 15 as proposed; 8 — `doc-ma-sai-huong` counts the high-confidence habit independent of correctness (D-02); 9 — the staging README states no prohibition (D-04); 13 — keep one task, correct the count.
- Applied: prompts pinned and `co-goi-skill` added (1); every fixture's defect, line, test and grader pattern pinned (2); `cross-count.mjs` in task 01 and in task 02's Command (3); staging graded by `file_exists` on a marker the client itself writes (4); edit/write graders scoped to `src/` and `config/` (5); `da-chay`, confidence and location patterns pinned and self-tested by the checker (6, 7, 15); `gon-gang` rubric pinned verbatim (10); counterexamples in the Command, unscored graders reported, opus ceiling 14 (11); `git diff --quiet HEAD` guard (12); plugin-root reads graded (14).
- Status after the sweep: both tasks `pending`.
- Planning is complete. Implementation requires a new explicit `/cf:develop debug-eval-baseline` invocation.

- **GATE-DONE (2026-09-24): the user accepted the packet as complete** after the current receipts for tasks 01–02 and the limits below; the baseline is kept for comparing the next debug repair.

## Known limits
- The eval runs without hooks or the completion gate, and a run reads only `SKILL.md`: the eight `.claude/references/debugger/` files the skill points to may not reach it.
- `da-chay` misses some executing forms (`echo … && node --test` with escaped quotes, `node --eval`, heredocs, `yarn test`) and still counts `grep -n node src/…`; `co-dau-step` reads only the final message, so a zero means no marker in the answer, not none in the run; `cross-count.mjs` medians use run cost without judge cost.
- `noi-do-tin-cao` misses `Confidence: **High**` (bold after the colon) and still matches `Độ tin cậy: thấp, không phải cao`; the skill's own template `**Root cause confidence:** high` is matched.
- A local stand-in cannot show the cost of a real staging read; the case measures only whether the run executes the staging client, which the README describes as shared but does not forbid (D-04).
