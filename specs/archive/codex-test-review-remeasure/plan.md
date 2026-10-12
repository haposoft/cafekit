# Codex test and code-review remeasure
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-11)
- Existing: cờ "khác thật" còn mở của `evals/codex/report-parity.md` đều đo bằng runner cũ (home người dùng, `batch-all`): `test/thuong-do` `chay-test` 6/10 (F069–F070), `test/thuong-sach` `chay-test` và `verdict` 8/10 (F071–F074), `code-review/thieu-tieu-chi` `neu-task` 0/10 và `co-header` 0/10 (F045–F048), `code-review/thieu-tieu-chi-agent` `co-verdict` 3/10 và `neu-task` 0/10 (F049–F051). Gói specs vừa rồi cho thấy riêng runner/CLI mới đã gỡ phần lớn lỗi (đối chứng không ghi chú 3/5 và 4/5, `evals/codex/report-specs-gate.md`). Luật cờ ở `evals/codex/rescore.mjs:93-101` (safety mất mức tốt nhất, giảm ≥ 0,20, hoặc Fisher hai phía p < 0,05 so với số gốc Claude `current_archived`). Runner mới: `node evals/codex/run.mjs --run --only <skill>/<ca> --out <thư mục mới>` (`evals/codex/run.mjs:153-163`, home sạch, cấu hình C).
- Minimum change: một bộ kiểm chỉ đọc nhật ký + một export nhỏ hàm cờ theo ô trong `evals/codex/rescore.mjs` + 1 lượt thử + 40 lượt Codex với runner mới + báo cáo. Không sửa skill, bản chiếu hay thước.
- Expansion signals: none (gói 1 trong 4, `plans/20261011-codex-unmeasured.md`).
- User decision: KEEP — không đo Claude, không push, không publish. Còn cờ "khác thật" sau khi đo lại → lập gói sửa phần chiếu Codex riêng (đã nằm trong KEEP), không sửa trong gói này. Người thực thi: Codex (pane Orca); phiên Claude điều phối, ghi Status/Receipt, tự chấm lại.

## Out of scope
- Sửa skill gốc, bản chiếu Codex, thước, ngưỡng; đo lại Claude; các ô test/code-review không có cờ; giám khảo LLM; publish; push.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Dùng lại `grade.mjs` và đúng luật cờ của `rescore.mjs:93-101` trên lượt mới, so với cùng số gốc Claude trong `fixtures/baselines.json` | Luật cờ mới; so với lượt Codex cũ | Giữ so được với báo cáo parity; lượt Codex cũ chỉ là cột tham khảo | Số gốc Claude đã khoá vẫn đúng cho các ô này | Ô không có số gốc `current_archived` → in N/A, không cờ |
| D-02 | Nhãn gắn cho từng lượt trượt, bằng máy: `chay-test` trượt mà output của một lệnh bất kỳ (root `events.jsonl`/`command_execution.aggregated_output` hoặc `sessions/*.jsonl` `function_call_output`) có dòng `^# tests \d+` → "cách viết tool input"; `co-verdict`/`verdict-*` trượt mà tin cuối có enum `PASS_WITH_WARNINGS\|PASS\|FAIL\|BLOCKED` → "cách viết"; `neu-task` trượt mà tin cuối nêu `task 01`/`task-01` → "cách viết" (Bro quyết ở GATE-REVIEW); `co-header` có `# Code Review Results [cf-code-review]` → "đổi tên khi chiếu" (installer đổi `cf:`→`cf-`, `codex-install.js:270-276`, không bao giờ kích hoạt); còn lại → "khác thật". Một key là "khác thật" khi ≥ 1 model còn cờ và ≥ 1 lượt trượt mang nhãn "khác thật" | Đọc tay từng lượt; một nhãn cho cả cờ | Quyết định lập gói sửa dựa trên nhãn nên phải lặp lại được; parity đã giải thích các dạng trên (`report-parity.md:80-109`): `thuong-sach/7` chạy test qua `subprocess.run(['npm','test'])`, F049/F050 có enum, F051 nêu task 01 | Các mẫu trên phủ hết cách đọc "không phải lỗi" của parity | Nhãn trên `batch-all` khác cách đọc parity ở ≥ 1 lượt → counterexample FAIL, sửa mẫu trước khi chạy model |
| D-03 | Cờ chỉ đạt nhờ Δ ≥ 0,20 với Fisher p ≥ 0,05 (so Claude) → "chưa kết luận", không kích hoạt gói sửa; in thêm Fisher p Codex cũ → mới | Coi mọi cờ là còn thật | n=10: 10/10→8/10 là cờ, 9/10 không; F050/F051 lật bởi 1 lượt | — | — |
| D-04 | Lượt bị loại vì `Native role/model/effort/sandbox không khớp` (`run.mjs:86`) là tín hiệu hành vi: đếm và báo theo ô, vẫn chạy lại để đủ 10 nhưng báo cáo nêu tỉ lệ bị loại | Lặng lẽ chạy lại | Lượt trượt cũ `thuong-do` 2,8,9,10 chính là các lượt sinh agent con (`collab_tool_call` 6/6/8/2, lượt khác 0); ô test không có role nên con sẽ bị loại → che lỗi | Một lượt chạy thử cho biết Codex còn sinh con ở home sạch không | Lượt thử bị loại vì role → ghi vào báo cáo, giữ quy tắc đếm |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Biết cờ nào của test/code-review còn thật với runner mới | add, modify | evals/codex, AI/model | none | elevated: kết luận sai dẫn tới gói sửa thừa hoặc bỏ sót lỗi bằng chứng test; lượt lỗi bị loại làm đẹp số | live: 40 lượt; lệnh kiểm tự chấm lại `batch-all` và đòi khớp parity (số, cờ, nhãn, 0 cờ NEW) trước khi in số mới |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the 4 cells run 10 valid clean-home runs each with the current runner, the check shall first regrade `batch-all` and fail unless it reproduces the 13 parity flags with their scores, per-run labels matching the parity readings and no NEW flag; it shall then grade the new runs without mapping, apply the exported parity flag rule per model, print for each of F045–F051 and F069–F074 old and new score, flagged state, per-run labels, old→new Fisher p and an inconclusive mark (D-03), list every excluded run and role-check exclusions per cell (D-04), and the report shall state which keys remain "khác thật". | task-01 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Đo lại 4 ô test/code-review bằng runner mới | P1 | AC-01 | `evals/codex/remeasure-check.mjs`, `evals/codex/report-test-review-remeasure.md`, `evals/codex/rescore.mjs` (export) | - | done |

## Review log
- Round 1 (2 reviewer ngữ cảnh mới): 8 phát hiện H-01..H-08 sau khử trùng. Bro chấp nhận hết; `neu-task` nêu task 01 không có tên file = "cách viết", không kích hoạt. Đã áp: nhãn từng lượt, TAP summary, mẫu enum và task 01 (H-01, D-02); lượt bị loại vì role là tín hiệu, đọc `sessions/` (H-02, D-04); lệnh kiểm tự chấm `batch-all` và đòi khớp parity (H-03); export hàm cờ từ `rescore.mjs` (H-04); chấm không ánh xạ, cờ NEW chỉ thước không ánh xạ (H-05); kiểm điều kiện lượt (H-06); "chưa kết luận" và Fisher cũ→mới (H-07, D-03); `co-header` do installer, không kích hoạt (H-08).
- Develop 11/10: `rescore.mjs --check` đã exit 1 trên HEAD 13c34dd3 (vân tay lệch từ 3 gói Codex trước). Bro chọn đổi điều kiện thành "output và exit không đổi trước/sau export"; không tạo `rerun-approval.json`.

## GATE-DONE
- 2026-10-12: Bro chấp nhận hoàn thành, không lập gói sửa. still real: none; thuong-do chay-test 6→10/10, -agent co-verdict 3→10/10; co-header (installer), neu-task (cách viết, Bro quyết), thuong-sach chay-test 8/10 (test có chạy) và verdict 7/10 (inconclusive, p=0,21; 2 lượt FAIL vì đòi negative-path). Giới hạn: nhãn máy `thuong-sach/5` là khác thật dù chỉ khác cách viết; thước ánh xạ N/A; n=10; CLI 0.162.1; home sạch thay home người dùng.
