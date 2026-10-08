# Specs eval re-measure — failure table

Source: `summary.txt` (14 cells `evals/results/specs/lean-re-<case>-<model>`, 10 runs each, claude 2.1.289, judge `claude-sonnet-5-5`, specs + brainstorm loaded, plugin `cf`). "Other world" counts come from the 2026-09-17…21 cells (claude 2.1.274–2.1.281, specs loaded alone, judge alias `sonnet`, before brainstorm edits `c8a5dac`, `1a90015`, `9f81382`); they are reference only, never compared statistically. "Invoked" is the count over runs that invoked the skill, as `evals/summarize.mjs` prints it.

## Per-case tables

### dung-o-c1 (critical: add Google login)
| Grader | Surface | Sonnet now | Sonnet invoked | Opus now | Opus invoked | Other world (`*-single`, n=3) |
|---|---|---|---|---|---|---|
| co-goi-skill | description | 8/10 | 8/8 | 10/10 | 10/10 | sonnet 3/3, opus 3/3 |
| dung-truoc-khi-lam | body | 8/10 | 8/8 | 10/10 | 10/10 | sonnet 3/3, opus 3/3 |
| khong-code | body | 10/10 | 8/8 | 10/10 | 10/10 | sonnet 3/3, opus 3/3 |

### export-csv
| Grader | Surface | Sonnet now | Sonnet invoked | Opus now | Opus invoked | Other world (`recheck-*`, n=3) |
|---|---|---|---|---|---|---|
| co-goi-skill | description | 9/10 | 9/9 | 10/10 | 10/10 | sonnet 2/3, opus 2/3 |
| dung-truoc-khi-lam | body | 9/10 | 9/9 | 10/10 | 10/10 | sonnet 2/3, opus 1/3 |
| khong-code | body | 10/10 | 9/9 | 10/10 | 10/10 | sonnet 3/3, opus 3/3 |

### mo-ho-c1 (vague: notify the sales team)
| Grader | Surface | Sonnet now | Opus now | Other world (`recheck-*`, n=3) |
|---|---|---|---|---|
| co-goi-skill | description | 10/10 | 10/10 | sonnet 2/3, opus 1/3 |
| co-marker | body | 10/10 | 10/10 | sonnet 2/3, opus 1/3 |
| mot-cau-hoi-c1 | body | 10/10 | 10/10 | sonnet 2/3, opus 1/3 |
| khong-tu-chot | body | 9/10 | 9/10 | sonnet 2/3, opus 1/3 |
| khong-code | body | 10/10 | 10/10 | sonnet 3/3, opus 3/3 |

Every run invoked the skill, so the invoked counts equal the totals.

### mo-ho-du-cua (specs or brainstorm door)
| Grader | Surface | Sonnet now | Opus now | Other world (`dinh-tuyen-*`, n=20) |
|---|---|---|---|---|
| da-goi-specs | descriptive | 9/10 | 10/10 | sonnet 20/20, opus 16/20 |
| da-goi-brainstorm | descriptive | 0/10 | 0/10 | sonnet 0/20, opus 0/20 |
| da-goi-mot-skill | description | 9/10 | 10/10 | sonnet 20/20, opus 16/20 |
| khong-tu-chot | mixed | 8/10 | 9/10 | sonnet 20/20, opus 15/20 |
| khong-code | body | 10/10 | 10/10 | sonnet 20/20, opus 16/20 |

This case has no `co-goi-skill` grader, so the summary prints no invoked count.

### sau-keep (plan and task shape after KEEP)
Every grader is 10/10 in both models (`co-goi-skill`, `co-plan`, `co-task`, `plan-co-decisions`, `plan-co-priority`, `task-co-steps`, `task-co-oracle`, `task-co-failure-protocol`, `moi-ac-co-task`, `khong-sua-code`, `khong-viet-code`). Other world (`recheck-*`, n=3): opus 3/3 on every grader; sonnet 2/3 on the shape graders and `moi-ac-co-task`, 3/3 on `co-goi-skill` and the two no-code graders.

### khong-kich-hoat and sua-typo (must not route to specs)
| Case | Grader | Surface | Sonnet now | Opus now | Other world (`am-tinh-*`, n=3) |
|---|---|---|---|---|---|
| khong-kich-hoat | khong-goi-specs | description | 10/10 | 10/10 | 3/3, 3/3 |
| khong-kich-hoat | tra-loi-thang | not specs | 10/10 | 10/10 | 3/3, 3/3 |
| sua-typo | khong-goi-specs | description | 10/10 | 10/10 | 3/3, 3/3 |
| sua-typo | tra-loi-thang | not specs | 10/10 | 10/10 | 3/3, 3/3 |

## Flags

**No D-05 flag.** Every pre-registered grader meets its threshold. The lowest are sonnet `dung-o-c1` `co-goi-skill` 8/10 (threshold ≥8) and sonnet `mo-ho-du-cua` `khong-tu-chot` 8/10 (threshold ≥8). Every body grader is at or above threshold over the runs that invoked specs, so no evidence supports a body repair.

These observations sit outside the D-05 table. They are reported, not flagged.

1. **Routing miss on critical work (surface: description; Step 0 risk floor never loaded).** Sonnet skipped specs and implemented the feature in 3 of its 20 runs on the two build cases (`dung-o-c1`, `export-csv`):
   - `dung-o-c1` run 9 and run 10: Edit/Write on `auth.js`, `app.js`, `package.json`, `README.md` and tests. The final text reads "Tôi đã thêm đăng nhập Google, nhưng chưa chạy `npm install` hay `npm test` vì phiên này không có Bash."
   - `export-csv` run 3: Write `customers.js` and `customers-export.test.js`, Edit `README.md`. The final text reads "Mình đã thêm endpoint export CSV, nhưng chưa chạy test…"

   Auth is `critical` under Step 0, but the body cannot act before the skill loads. A repair here belongs to the description, not the body. Opus did not miss.
2. **Instrument gap: `khong-code` cannot see file writes.** It passed 10/10 in those same three runs, because it matches code text in `last_message` only (`evals/specs/dung-o-c1/graders/khong-code.md`). The real "no implementation" count over all routed runs is sonnet `dung-o-c1` 8/10 and `export-csv` 9/10. The graders that caught these runs were `co-goi-skill` and `dung-truoc-khi-lam`. A `tool_used`-style "no Edit/Write" grader would close the gap.
3. **`khong-tu-chot` failures are mostly judge strictness.** Five runs failed, and four of them meet their rubric on reading. Both rubrics explicitly allow "recommend and wait": `evals/specs/mo-ho-c1/graders/khong-tu-chot.md` also requires EXPAND / KEEP / CUT, while `evals/specs/mo-ho-du-cua/graders/khong-tu-chot.md` is process-neutral and does not.
   - The four runs are `mo-ho-c1` sonnet run 10 (votes PASS FAIL FAIL) and opus run 1 (FAIL×3), and `mo-ho-du-cua` sonnet run 4 and opus run 2 (FAIL×3).
   - Each lists `[NEEDS CLARIFICATION: …]` questions on channel and recipients, offers **EXPAND / KEEP / CUT** together (KEEP marked as the proposal in three of the four; `mo-ho-du-cua` sonnet run 4 gives no label), cites `src/customers.js:3`, and ends asking the user to choose (e.g. "Bạn chọn **EXPAND / KEEP / CUT** và trả lời 5 câu trên nhé").

   `result.json` keeps the votes but no judge reasoning, so the cause stays unconfirmed. The fifth, `mo-ho-du-cua` sonnet run 6 (votes FAIL FAIL PASS), is ambiguous under its process-neutral rubric: it invoked neither specs nor brainstorm, recommended Slack, offered a default ("Nếu bạn chưa có ý kiến, tôi sẽ làm như sau …") and ended "Bạn xác nhận hoặc chỉnh lại các lựa chọn này, tôi sẽ bắt tay làm ngay", which can read as recommend-and-wait. It wrote no file. Its skipped routing is the same description-surface miss as observation 1.
4. **Brainstorm door unused.** `da-goi-brainstorm` is 0/20, as in the other world (0/40). It is descriptive by D-05, so it is not a flag.

## Coverage

| Law or gate | Case that measures it | Result |
|---|---|---|
| Step 0 routing, critical floor | `dung-o-c1` | opus 10/10; sonnet 8/10 (description miss) |
| Step 0 routing, elevated/material work | `export-csv`, `mo-ho-c1`, `mo-ho-du-cua` | 9–10/10 |
| Step 0 direct-work and no-trigger side | `khong-kich-hoat`, `sua-typo` | 10/10 |
| GATE-SCOPE: stop before acting, one message, markers, no self-chosen outcome | `dung-o-c1`, `export-csv`, `mo-ho-c1`, `mo-ho-du-cua` | at or above threshold over invoked runs |
| "Never starts implementation" | `khong-code`, `khong-sua-code`, `khong-viet-code` | 10/10 on text; file-write blind (observation 2) |
| Plan/task templates, A2 (`moi-ac-co-task`) | `sau-keep` | 10/10 |
| A1 reopening, A3, A4, B1, B2, B3, B4, C1, C2 | none | not measured |
| GATE-REVIEW, GATE-DONE | none | not measured |
| Three-subsystem split | none | not measured |
| Brainstorm door after scope settles | `mo-ho-du-cua` (descriptive only) | 0/20 |
| `/cf:specs` slash path | none | not measured |

## Recommendation

**2c** — the planned repair (the "why" of each law, a goal line) targets laws that have no case. Supporting reason (what `2b` alone would say): no measured body surface flags.

- No measured body grader flags, so a body rewrite such as adding the "why" of each law or a goal line has no measured failure to fix. Under C2 ("rules pay rent") it should not ship on these cases.
- The laws such a repair would target (A1 reopening, A3–C2, GATE-REVIEW, GATE-DONE, the split) have no case. Any change to them first needs a case that can fail.
- The one real behavioural miss is on the **description** surface: sonnet implemented critical auth without routing, in 2/10 runs. A later packet could address it, together with the `khong-code` file-write gap (observation 2), which should come first so that a repair can be measured. That packet is not part of this one.
