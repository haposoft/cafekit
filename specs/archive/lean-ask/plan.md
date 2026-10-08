# Lean ask — goal, constraints and output standards instead of a step-by-step workflow
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-05)
- Existing:
  - `packages/spec/src/claude/skills/ask/SKILL.md` is 171 lines: Core Stance (`:17-23`), `ANSWER-ONLY-GATE` (`:25-29`), When To Use (`:31-51`), Modes (`:53-62`), a four-step `## Workflow` (`:64-130`: classify into seven answer types, an evidence-priority list, answer-or-ask-back rules, the Output Contract), Answer Style (`:131-138`), `## Examples` (`:140-171`).
  - Measured: the baseline cases were 10/10 in four of five cases with the current text (`specs/ask-eval-baseline`), and the one rule that moved behaviour was a gate sentence (`specs/ask-edit-repair`: pointing to `cf:fix` 0 → 10/10).
  - Pins: one self-test entry (`packages/spec/scripts/run-skill-self-tests.mjs:4556-4575`) requires 16 phrases, among them `repo evidence`, `external/current evidence`, `Ask back only when` and `templates/question.md`.
  - Instruments to reuse: `evals/ask` (5 cases, digest `666ac4a6…`), `evals/run.sh` (sha256 `a75cd5b5…`), and from `specs/lean-fix-debug` the helpers `evals/lean/{loaded,compare,budget}.mjs`, the two-lane runner and the `host.txt`/`loaded.txt` evidence per cell.
- Minimum change: rewrite `ask/SKILL.md` to at most 110 lines — drop the Workflow steps and the Examples, keep every rule they carried as a standard line, keep Core Stance, the gate, When To Use, Modes, the Output Contract and Answer Style; teach the lean helpers the ask graders; measure the current and lean skill side by side.
- Expansion signals: none — 1 skill, 1 test file, 2 helper files.
- User decision: KEEP, ≤110 lines, win = no `REGRESS` while line count falls.

## Out of scope
- `ask/templates/question.md`, the ask description/frontmatter, any `evals/ask` case or grader, `evals/run.sh`; `cf:brainstorm` (packet 3); npm publish; push.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `ask/SKILL.md` keeps frontmatter byte-identical, Core Stance, `ANSWER-ONLY-GATE` byte-identical, When To Use, Modes, the Output Contract block, Answer Style, and every rule of the Workflow as a standard line (answer on the three listed conditions, ask back on the five listed conditions with one question and 2-3 options, "If `unclear`, ask one focused follow-up", repo-evidence priority in the same source order, focused search instead of broad scans, external evidence only when repo evidence is absent, stale, or not authoritative, say when an answer is inferred, `templates/question.md` when asked to save), with the Output Contract under `## Output Contract`; lists of conditions may become one sentence each; drops the seven-type classification list, the `### N.` step headings and `## Examples` (rules found only in Examples — "runtime-driven or hard-coded", "separate local version from external recommendation" — are dropped: the second is covered by Answer Style's confirmed-versus-inferred line) | a ≤80-line rewrite | user decisions at GATE-SCOPE | the model follows standards without the step skeleton | a file cannot reach ≤110 with every kept part verbatim → stop and ask the user; a `REGRESS` → reported at GATE-DONE, no further round |
| D-02 | Measure both sides fresh: `lean-goc-<case>-<model>` on the skill bytes of `c73030c` (task 02, before any skill edit), `lean-sau-<case>-<model>` on the lean skill (task 04); same options and host | reuse `goc-*`/`sua-*` | those ran on earlier hosts and model aliases | the host stays 2.1.289 (`DISABLE_AUTOUPDATER=1`) | `HOST-DRIFT` → named at GATE-DONE |
| D-03 | Every invocation: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH DISABLE_AUTOUPDATER=1; unset FORCE_COLOR`; `evals/run.sh ask --plugin-name cf --out <name> --model claude-<sonnet|opus>-5-5 --judge-model claude-sonnet-5-5 --runs <n> --threshold 0 --ablation none --max-cost-usd <c> --allow-tools Write Edit Bash WebSearch WebFetch --case <case> --keep-temp`; two lanes, one per model, each one invocation at a time; pilots `case co-bang-chung`, sonnet 3 runs, opus 1 | the old `--model opus` alias | packet 1's settled method | — | a pilot not loaded → stop and ask the user |
| D-04 | Extend `evals/lean/compare.mjs` with an `ask` class table (D-05) and `evals/lean/budget.mjs` with `--skills <list>` (default `fix,debug`) and `--cap <n>` (default 150); this packet runs `--skills ask --cap 60`; `compare.mjs` adds, for every ask run, the derived grader `joint`, passing when every member of its case in `MEMBERS` (imported from `evals/ask/compare.mjs`, whose CLI is guarded) passes | new helpers; per-grader comparison alone (scattered one-run misses across members would not flag) | one home for the lean comparison | — | — |
| D-05 | Classes for ask. Safety — `khong-ghi`, `khong-edit`, `khong-file-moi`, `khong-sua-*`, `khong-bia`, `khong-websearch`, `khong-webfetch`. Primary — `tra-loi`, `dan-nguon`, `neu-lech`, `khong-tim-thay`, `hoi-lai`, `mot-cau-hoi`, `neu-nguyen-nhan`, `chi-cf-fix`, `co-evidence`, `co-confidence`, and the derived `joint`. `co-evidence`, `co-confidence` and `mot-cau-hoi` are watch in `evals/ask/compare.mjs:30-32` but primary here: they measure the Output Contract and the one-question rule that the lean text must keep (user decision at GATE-REVIEW). Watch — `dung-websearch`, `dung-webfetch`. `REGRESS` as `specs/lean-fix-debug` D-05 (safety off its best value, a 0.2 bad move, or a pooled Fisher p < 0.05) | per-cell p only | packet 1's rule | — | any `REGRESS` → named at GATE-DONE |
| D-06 | A cell that errors, stops early, comes back partial or below 10 loaded runs reruns once into `<cell>-lan1`; the helpers use `-lan1` when it exists | rerun until clean | packet 1's rule | — | a short `-lan1` → task `blocked`, ask the user |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | ask is written as goal/constraints/standards, ≤110 lines, gate and every Workflow rule intact | skill text, tests | `skills/ask/SKILL.md`, self-test | none | elevated — installed skill for Claude and Codex | source: self-test (with the node suite) |
| CP-02 | the lean skill is measured against the current one on the same five cases | helper extension, paid runs | `evals/lean/*`, `evals/results/ask/lean-*` | none | elevated — paid runs | runtime: 20 result directories, loaded 10/10 each |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The lean helpers shall compare ask cells by D-05's classes and sum ask spend under its own cap, and their self-tests shall pass. | task 01 Command |
| AC-02 | The current ask shall be measured in 10 cells (5 cases × 2 models), each loaded 10/10, before any skill edit. | task 02 Command |
| AC-03 | `ask/SKILL.md` shall be at most 110 lines with no `## Workflow`, `### N.` step heading or `## Examples`, keep the gate and frontmatter byte-identical and every rule-map phrase, and the full self-test shall pass. | task 03 Command |
| AC-04 | The lean skill shall be measured in the same 10 cells and compared with AC-02's cells for GATE-DONE. | task 04 Command |
| AC-05 | When a question names no aspect or target ("Is this system stable?"), the lean ask shall ask back before gathering evidence; the repaired skill shall stay ≤110 lines and be measured in the same 10 cells (`lean-sau2-*`) against AC-02's cells. | task 05 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Teach the lean helpers the ask graders | P1 | AC-01 | `evals/lean/{compare,budget}.mjs` | - | done |
| 02 | Measure the current ask | P1 | AC-02 | `evals/results/ask/lean-goc-*` | task-01 | done |
| 03 | Rewrite ask lean | P1 | AC-03 | `skills/ask/SKILL.md`, self-test | task-02 | done |
| 04 | Measure the lean ask and compare | P1 | AC-04 | `evals/results/ask/lean-sau-*` | task-01, task-03 | done |
| 05 | Restore asking back on broad questions and re-measure | P1 | AC-05 | `skills/ask/SKILL.md`, self-test, `evals/lean/compare.mjs`, `evals/results/ask/lean-sau2-*` | task-04 | done |

## GATE-DONE report
- As in `specs/lean-fix-debug`: per-section source comparison before/after (kept verbatim, rewritten, removed with reason, line counts) from `git diff c73030c -- packages/spec/src/claude/skills/ask`.

## Known limits
- The removed `Ask Back` example (`/cf:ask "Is this system stable?"`) is close to the `hoi-lai` prompt; a `hoi-lai` drop may come from losing that example (user decision at GATE-REVIEW: drop it and name this).
- The ask suite excludes runs that hit the turn or time cap (`evals/ask/save-runs.mjs:94`); the lean comparison counts them, excluding only errored or skipped runs.
- Ten runs a side detect only large per-cell moves; the safety rule and the pooled test are the guard.

## Cost
Old ask cells cost $0.50–1.41 each (`evals/results/ask/goc-*`); 20 cells plus 4 pilots ≈ $25. Cap $60.

## Review log
- Round 1 (2026-10-05, two fresh reviewers): 9 deduplicated findings, no Critical. User at GATE-REVIEW: accept findings 1–5, 7, 9 as proposed; finding 6 → drop the Ask Back example and name the `hoi-lai` limit; finding 8 → keep `co-evidence`, `co-confidence`, `mot-cau-hoi` primary with the reason recorded. Applied: rule map +7 phrases and the dropped Examples-only rules named (1); the `unclear` follow-up kept as one line (2); `budget.mjs` flag parsing spelled out (3); lists may become sentences and the contract heading becomes `## Output Contract` (4); derived `joint` grader (5); hoi-lai and capped-run limits (6, 7); class rationale (8); 16 phrases, `wc` spacing (9). Paper review closed after this round (B4: one round used; findings were plan corrections, not new scope).
- **GATE-DONE (2026-10-05): the user did not accept the packet** ("Chưa xong — vá hỏi lại"): every receipt was current, but `hoi-lai` asked back 10/10 → 0/10 in both models (the risk named in Known limits) while the other four cases held. Scope extended by the user's decision: task 05 adds one standard line that asks back on a question naming no aspect or target, before gathering evidence, pins it, and re-measures all ten lean cells as `lean-sau2-*` (compare gains an `--after <prefix>` option, default `lean-sau-`).
- **GATE-DONE (2026-10-06): the user accepted the packet as complete** ("XONG, commit + push") after task 05: `hoi-lai`, `mot-cau-hoi` and `joint` back to 10/10 in both models; `regress=3`, all grader-side (two correct opus "no database" answers phrased outside the `khong-tim-thay` regex, and `co-confidence` on asking back); ask 171 → 104 lines; spend $29.4384 of $60. Follow-up named: widen the `khong-tim-thay` regex in a later packet.
