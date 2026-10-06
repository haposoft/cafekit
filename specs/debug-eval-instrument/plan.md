# Debug eval instrument
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-09-24)
- Existing: `specs/debug-proportional/` finished its three tasks, but at its GATE-DONE the user chose to repair the instrument first. `evals/debug/loi-hien-nhien/graders/gon-gang.md` is an `llm` grader that failed all 40 `base-*` and `sau-*` reports; the harness stores only `judge votes: FAIL FAIL FAIL`. `evals/debug/doc-ma-sai-huong/graders/noi-do-tin-cao.md` misses `**Root cause confidence:** **high**` and a Vietnamese label with an English `high` (9 of 10 opus `sau` reports). `claude plugin eval --help` offers no re-grade of stored results, so an `llm` grader changes only through new runs. The 16 `evals/results/debug/{base,sau}-*/result.json` keep the final message of the 80 runs in `loi-hien-nhien` and `doc-ma-sai-huong` (inside `llm` grader evidence); replaying the regex graders on them with `new RegExp(body)`, as `evals/debug/check-fixtures.sh:113` does, reproduced all 320 stored verdicts. `evals/run.sh:28` takes the skill from its own repository, and `evals/`, `evals/run.sh` and `evals/summarize.mjs` at commit `63dd231` equal the working tree, whose `packages/spec/src/claude/skills/debug/SKILL.md` there is the pre-repair skill (sha256 `6b18824102260a8aa883a80234d3f7e0d9630b9fd96d7fb1a2a064d71ec152ae`).
- Minimum change: replace `gon-gang` with a lexical `gon-gang-tieu-de` and a rewritten `gon-gang-llm`, extend `noi-do-tin-cao`, pin both with samples taken from real reports in `check-fixtures.sh`; then re-run all sixteen cells on the new instrument, `base` on the pre-repair skill and `sau` on the current one.
- Expansion signals: five files under `evals/debug/`, sixteen result directories, one temporary worktree; no service.
- User decision: **EXPAND** — re-run all sixteen cells; `gon-gang` measured **both** ways, the regex as the figure and the rewritten `llm` rubric as a reference; **no** new grader for the opening heading.

## Why this is wanted
Without a working instrument the debug-proportional GATE-DONE cannot be judged: `gon-gang` read 0/20 before and after although every `sau` report was short, and the opus confidence count read 1/10 although all ten stated high after running the code. Re-running `base` as well puts both arms on one host version (`base-*` ran on 2.1.280, `sau-*` on 2.1.281).

## Out of scope
- `packages/spec/**` — the debug and fix skills stay as measured (current `debug/SKILL.md` sha256 `82deeb3c364c48aaa97d7ebaf0b1a604d24bb048e29c7cdb16c2f144a11d6da8`).
- A grader for the opening `## Debug Report` (user decision); `co-debug-report` stays as it is.
- `evals/run.sh`, `evals/summarize.mjs`, `evals/debug/cross-count.mjs`, the fixtures, scaffolds and prompts.
- The debug-proportional GATE-DONE itself, which the user takes after this packet.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `gon-gang-tieu-de` (`regex`, `not_contains`, no `flags:`) is the figure, checked against hand labels of the stored reports; `gon-gang-llm` with a rubric that excludes the required contract fields and the regression-guard bullet is a reference; `gon-gang.md` is removed | Keep one `llm` grader; reuse the name `gon-gang` | user decision; a new name keeps old and new judgements apart in the summarizer | the report forms of the 80 stored reports cover the forms new runs write | a regex/LLM disagreement or a report with an unlisted form → reported at GATE-DONE with its text |
| D-02 | Re-run all sixteen cells into new directories `base2-*` and `sau2-*`; `base2` from a worktree at `.claude/worktrees/debug-base2` on `63dd231` with the new `evals/debug` copied in | Re-run `loi-hien-nhien` only; replay offline only | user decision (EXPAND); one instrument and one host for every figure | the worktree loads the same instrument bytes as the main tree | a digest or skill hash differs before a paid run → stop; a stored grader set, `pattern` or `criteria` differing from the main tree's files → the integrity check exits 1 |
| D-03 | `noi-do-tin-cao` accepts a bold value after the colon and a Vietnamese label with `high`/`High`/`HIGH`, still refusing `không cao` and medium or low values | Leave the pattern | 9 of 10 opus `sau` misses are these forms | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | The debug instrument grades proportion and stated confidence as the rubric intends, pinned by samples from real reports | modify, create, delete | `evals/debug/loi-hien-nhien/graders/`, `evals/debug/doc-ma-sai-huong/graders/noi-do-tin-cao.md`, `evals/debug/check-fixtures.sh` | none | routine — graders only | static: fixture checker with real-report samples, validate, offline replay over the 80 stored reports |
| CP-02 | Both arms are measured on the new instrument on one host | verify | `evals/results/debug/base2-*`, `evals/results/debug/sau2-*` | none — the reading is GATE-DONE's | elevated — paid runs | runtime: sixteen result directories, integrity check |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the fixture checker runs, it shall accept every sample the two regex graders must match and reject every sample they must not, including excerpts of stored `base` and `sau` reports and each sample again after a leading heading; and the offline replay shall reproduce the hand labels of task 01 for each regex grader on the stored reports of its own case, exiting non-zero on any mismatch. | task 01's Command |
| AC-02 | When the four cases run ten times per model on each arm, the Receipt shall report every grader, the cross-count, median tool total, seconds, cost and `claudeVersion` per cell, beside task 01's hand labels of the stored reports and the registered directions. | task 02's Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | The debug instrument grades what its rubric means | P1 | AC-01 | `evals/debug/` graders and checker | - | done |
| 02 | Both arms are measured on the new instrument | P1 | AC-02 | `evals/results/debug/base2-*`, `sau2-*` | task-01 | done |

## Review log
- GATE-REVIEW (2026-09-24): two fresh-context reviewers (Fact Checker + Contract Verifier; Failure-mode + Assumption + Proof), both FAIL; 13 findings after deduplication (1 Critical, 2 High, 8 Medium, 2 Low). Critical G-01: the Step 1 form list missed `**Sai:**`, `**Refuted**` without brackets and `giả thuyết đã loại`, so 6 of 20 stored `base` reports would pass. High G-02: the replay could not fail and a bare `^` passes cut samples but not full reports (patterns compile without flags); High G-03: task 02 could not show which instrument and skill `base2` ran.
- User decisions: accept all 13 as proposed; G-02's hand labels are the ones the reviewer proposed (`gon-gang-tieu-de` passing: `base` sonnet none, `base` opus run 5, `sau` all; `noi-do-tin-cao`: all 40 `doc-ma-sai-huong` reports high). The controller checked the `doc-ma-sai-huong` label on the stored final messages before recording it.
- Applied: G-01 forms and samples (task 01 Steps 1, 4); G-02 hand labels, replay against them, prefixed re-test, ±2 thresholds and an opus row (task 01, task 02 Registered expectations); G-03 integrity check comparing each stored grader `config` with the main tree, worktree skill hash in the Command (dry-run on the stored directories: sixteen `instrument=current`, exit 1 on the two `claude` versions); G-04 digest printed by task 01's Command, 64-digit and labelled guard, `.DS_Store` excluded, `gon-gang` check scoped to `evals/debug`; G-05 regression-guard labels, `Phòng tái phát` only as a heading; G-06 labelled confidence branch without a free span, `Độ chắc chắn`/`Mức chắc chắn`, `confidence cao`, authored refusals; G-07 `--force` removal after the move, kept directories from `tracePath`; G-08 `DISABLE_AUTOUPDATER=1` and a version check before every invocation; G-09 `error`, `skippedPaidGraders`, unscored graders fail the check; G-10 no `flags:` key, checked by the checker; G-11 cross-count over sixteen; G-12 per-case replay and AC-01 wording; G-13 `lenh-staging` out of the primary list.

- Closure pass (2026-09-24, fresh reviewer): G-01..G-13 all PASS by fresh replay (a Step-1-faithful regex reproduces the hand labels, 8 lines `= labels`; the missing-`**Sai:**` and bare-`^` variants exit 1; integrity mutations of `pattern`, `criteria` and the grader set print `MISMATCH`). Five new findings from the repairs, all accepted by the user: N-1 the `gon-gang` guard read contents only — the Command now also requires `gon-gang.md` to be absent; N-2 Step 3 lacked `Cao` (stored `base` opus runs 2 and 9); N-3 the counterexample note named the wrong runs; N-4 D-02's break signal overstated what the integrity check compares; N-5 the sixteenth invocation now checks `claude --version` before it runs. This was the second paper round (B4); later findings need runtime evidence.
- Status after the sweep: both tasks `pending`.
- Develop (2026-09-24): after three failed review rounds on task 02's Receipt draft, each finding a new sentence that did or did not separate an LLM-failed report from an LLM-passed one while the judge records no reason, the user changed task 02's record of regex/LLM disagreements to a neutral listing — run, votes and final-message location, with verbatim text only for a forbidden form the regex misses (decision "Đổi yêu cầu, ghi trung lập").
- Planning is complete. Implementation requires a new explicit `/cf:develop debug-eval-instrument` invocation.
- **GATE-DONE (2026-09-24): the user accepted the packet as complete** after the receipts and limits were shown (regex misses in `base2` opus runs 1 and 10, 13 regex/LLM disagreements with no judge reason, three primary-grader failures, `noi-do-tin-cao` refusals, task 02's changed Step 4, the debug-proportional task 03 receipt made stale by the instrument change); next, the debug-proportional GATE-DONE with the `base2`/`sau2` figures.

## Known limits
- `gon-gang-tieu-de` is lexical: a section under a label outside its list escapes it; the samples and hand labels cover the forms found in the 80 stored reports.
- The hand labels are the reviewer's reading of the stored reports, chosen by the user at GATE-REVIEW; they are the truth the replay checks, not an independent annotation.
- `noi-do-tin-cao`'s refusal samples are written for the task: no stored report states a confidence below high.
- `gon-gang-llm` is a reference only; its verdicts carry no reasons in `result.json`.
- The `base2` arm runs from a worktree at `63dd231`; the eval loads only `debug/SKILL.md` and `evals/debug`, so other files at that commit do not enter the runs.
- `base-*` and `sau-*` stay on disk; the comparison of this packet is `base2` against `sau2`.
