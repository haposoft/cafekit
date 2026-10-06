# Specs eval re-measure — current behaviour of cf:specs on today's host
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-06)
- Existing:
  - `evals/specs` holds seven cases (digest `835f27e50264490b`): `dung-o-c1`, `export-csv`, `mo-ho-c1` (stop at GATE-SCOPE, ask one question, no self-decided scope), `mo-ho-du-cua` (specs vs brainstorm door), `sau-keep` (plan and task shape after KEEP; its history is a dialog only and the skill loads fresh, `evals/specs/sau-keep/history.jsonl`), `khong-kich-hoat`, `sua-typo` (no specs). Skill-call graders match `specs` in the Skill input (`evals/specs/*/graders/co-goi-skill.md`), so `cf:specs` counts.
  - Last measured 2026-09-17…21 on claude 2.1.274–2.1.281 (`evals/results/specs/{*-single,*-history,recheck-*,dinh-tuyen-*,du-cua-*,am-tinh-*}`); skill and host have changed since (claude 2.1.289, specs skill digest `f208fb4864a8b11d`).
  - `evals/summarize.mjs` prints per-case grader counts for named result directories; `evals/lean/budget.mjs --skills specs --cap <n>` sums `evals/results/specs/lean-*`.
- Minimum change: no skill or eval edit; 14 cells (7 cases × sonnet and opus × 10 runs), then a failure table mapped to the skill's laws and gates that decides the next step (2a targeted repair or 2b leave as is).
- Expansion signals: none.
- User decision: KEEP — the with-skill arm only, brainstorm loaded beside specs as the product ships, plugin named `cf`, judge `claude-sonnet-5-5`; about $55–60.

## Out of scope
- Any edit to `packages/spec/src/claude/skills/specs`, `evals/specs` or `evals/run.sh`; the without-skill arm; a repair (a later packet, decided from this one's table).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Every invocation: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH DISABLE_AUTOUPDATER=1; unset FORCE_COLOR; evals/run.sh specs --plugin-name cf --with-skill brainstorm --out lean-re-<case>-<model> --model claude-<sonnet\|opus>-5-5 --judge-model claude-sonnet-5-5 --runs 10 --threshold 0 --ablation none --max-cost-usd <c> --allow-tools Write Edit --case <case> --keep-temp`; two lanes, one per model, one invocation at a time per lane; guards before each: specs skill `f208fb4864a8b11d`, brainstorm skill `3b5ee008aaa94d05`, `evals/specs` `835f27e50264490b`, `evals/run.sh` sha256 `a75cd5b5fbe5b643…`, node v22.23.3; `host.txt` before/after | the old aliases `sonnet`/`opus` and plugin `cafekit-specs` | packets 1–3 method; the product names the skill `cf:specs` | — | a cell partial or with errored runs → rerun once as `<cell>-lan1`; a guard mismatch → stop |
| D-02 | Pilot first: `dung-o-c1` one run per model (`lean-re-pilot-dung-o-c1-<model>`), stop if not clean | no pilot | cheap check of grants and loading | — | pilot unclean → stop and ask the user |
| D-03 | The report `specs/specs-eval-remeasure/report.md` tabulates every grader count per case and model (and, where `evals/summarize.mjs` prints it, the count over the runs that invoked the skill) beside the old count where one exists, labelled "other world" (old cells loaded specs alone, used the judge alias `sonnet`, and predate brainstorm description edits `c8a5dac`, `1a90015`, `9f81382`); flags use only the pre-registered table D-05; each flag names its surface; a flag from an LLM grader quotes 1–2 lines of the run `evidence` from `result.json` to confirm it; the report has `## Coverage` (laws and gates with and without a case) and `## Recommendation` with one of `2a` (a SKILL.md-body flag, naming the law), `2b` (no flag on any measured surface), or `2c` (the law the planned repair targets has no case) | statistical tests against the old cells; a flat 8/10 threshold | different world; descriptive graders would always flag | — | — |
| D-04 | `loaded.txt` per cell (`node evals/lean/loaded.mjs specs <dir>`, slash or Skill-tool load); `claude --version` captured before the run and written with the after value into `host.txt` once the run created the directory; a run that ends on the turn cap (`Reached maximum number of turns`) is a measured result, not a broken run | rerunning turn-cap runs | the turn cap is behaviour; `run.sh` refuses an existing `--out` directory | — | — |
| D-05 | Pre-registered expectations (written before any result). Surfaces: **description** (routing), **body** (`SKILL.md`), **templates** (`references/templates.md`). `dung-o-c1`, `export-csv`: `co-goi-skill` description ≥8/10; `dung-truoc-khi-lam` body, GATE-SCOPE stop before acting, ≥8 over runs that invoked specs; `khong-code` body, "never starts implementation", 10/10. `mo-ho-c1`: `co-goi-skill` description ≥8; `co-marker` body, `[NEEDS CLARIFICATION]`, `mot-cau-hoi-c1` body, GATE-SCOPE in one message, `khong-tu-chot` body, "never choose a product outcome on the user's behalf" — each ≥8 over runs that invoked specs; `khong-code` 10/10. `mo-ho-du-cua`: `da-goi-specs`, `da-goi-brainstorm` descriptive (never flagged); `da-goi-mot-skill` description ≥8; `khong-tu-chot` mixed surface ≥8; `khong-code` 10/10. `sau-keep`: `co-goi-skill` loading ≥8; `co-plan`, `co-task`, `plan-co-decisions`, `plan-co-priority`, `task-co-steps`, `task-co-oracle`, `task-co-failure-protocol` templates ≥8; `moi-ac-co-task` templates/A2 ≥8; `khong-sua-code`, `khong-viet-code` body, "never starts implementation", 10/10. `khong-kich-hoat`, `sua-typo`: `khong-goi-specs` description 10/10; `tra-loi-thang` ≥8 (not specs). Only a **body** flag can support a body repair. | per-cell p-values | reviewer finding; one fact, one home | — | a grader missing from this table → reported, not flagged |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | the current specs is measured on all seven cases in both models | paid runs | `evals/results/specs/lean-re-*` | none | elevated — paid runs | runtime: 14 clean result directories |
| CP-02 | a failure table maps observed failures to the skill's laws for the 2a/2b decision | report | `specs/specs-eval-remeasure/report.md` | none | routine | source: report regenerated from saved summaries |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The current specs shall be measured in 14 cells, each complete with 10 clean runs and one host version. | task 01 Command |
| AC-02 | The report shall list every grader count per case and model, flag only by the pre-registered table D-05 with the surface named and LLM flags confirmed from `evidence`, include `## Coverage`, and end with `2a`, `2b` or `2c`. | task 02 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Measure the current specs | P1 | AC-01 | `evals/results/specs/lean-re-*` | - | done |
| 02 | Write the failure table | P1 | AC-02 | `specs/specs-eval-remeasure/report.md`, `summary.txt` | task-01 | done |

## Known limits
- Ten runs a side locate failures; they do not prove a change against the old cells (different host and skill).
- The judge (`claude-sonnet-5-5`) scores four graders; votes are recorded, and the run `evidence` in `result.json` is used to confirm each LLM flag.
- The seven cases do not exercise A1 reopening, A3, A4, B1–B4, C1, C2, GATE-REVIEW, GATE-DONE, the three-subsystem split, or the `/cf:specs` slash path (every prompt routes through the description or names the skill in words); `sau-keep` mostly measures `references/templates.md`. A clean result therefore cannot justify or rule out a change to those laws (`2c`).
- `input_match: specs` is not anchored to the skill field, so a brainstorm call whose arguments mention "specs" could mis-score `co-goi-skill`/`khong-goi-specs` (graders are out of scope here).
- At GATE-DONE a fresh reviewer checks each flag against D-05 and the run `evidence`.

## Cost
Earlier cells: 3-run single-turn sets $6–8 per model with both arms; `mo-ho-du-cua` 10 runs $1.38 (sonnet) / $3.55 (opus). This packet ≈ $35–45 (reviewer estimate from old per-run costs). Cap $80; `sau-keep` opus cell ceiling $12.

## Review log
- Round 1 (2026-10-06, two fresh reviewers): no Critical. Main finding: the seven cases cannot measure the planned repair (the 'why' of the laws, a goal line); user chose to measure as planned with all fixes ("Đo như plan + nhận 7 sửa"). Applied: `2c` and `## Coverage` (D-03), pre-registered expectations with surfaces (D-05), "other world" labels for old counts, LLM flags confirmed from `evidence`, fresh-reviewer check at GATE-DONE, `loaded.txt` and host capture and turn-cap rule (D-04), `sau-keep` opus ceiling $12, the cell list pinned in task 02, Known limits for unmeasured laws, the slash path and the unanchored grader. Paper review closed.
- **GATE-DONE (2026-10-06): the user accepted the packet as complete** ("XONG, commit (chưa push)"): 14 cells, $22.9475 of $80; no D-05 flag; recommendation `2c`. Follow-up chosen: a new packet that first gives `khong-code` file-write sight, then repairs the specs description so sonnet stops implementing critical work without routing, measured before and after.
