# Codex specs scope gate
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-11)
- Existing: `packages/spec/src/claude/skills/specs/SKILL.md:64` dặn "Ask GATE-SCOPE in one message", liệt kê mục cần quyết dưới dạng `[NEEDS CLARIFICATION: <question>]` và đưa EXPAND, KEEP, CUT cùng lúc. Phần chiếu Codex đã có tiền lệ chèn ghi chú theo `sourcePath` cho ask và research (`packages/spec/bin/lib/codex-install.js:330-335`). Thước `evals/specs/mo-ho-c1/graders/co-marker.md` (regex `NEEDS CLARIFICATION|CẦN LÀM RÕ`, cờ i) và `mot-cau-hoi-c1.md` (đủ EXPAND, KEEP, CUT) chỉ đọc `last_message`. Lỗi đo được (`evals/codex/report-parity.md:92-95`, F057–F060): Codex 0/10 ở cả hai thước, Claude 10/10. Chẩn đoán vị trí (`plans/20261008-codex-regrade/report-specs.md:105-120`): Codex gửi tin hỏi phạm vi ở giữa rồi kết thúc bằng một tin tóm tắt (`~/Desktop/cafekit-codex-eval/batch-all/specs/mo-ho-c1/1/events.jsonl` dòng 40 hỏi KEEP/EXPAND/CUT, dòng 41 tóm tắt); marker vắng ở mọi tin 8/10 lượt; bộ ba vắng ở mọi tin 3/10 lượt (lượt 3, 4 dịch thành GIỮ/MỞ RỘNG/THU HẸP).
- Minimum change: một ghi chú cho riêng bản chiếu Codex của `specs/SKILL.md`; đo lại 4 ca × 10 lượt.
- Expansion signals: none (gói 3 trong 3 gói tuần tự; `plans/20261010-codex-followups.md`).
- User decision: KEEP — chỉ sửa phần chiếu Codex, skill gốc và Claude không đổi, không đổi thước; đo `mo-ho-c1` (cổng) cùng `dung-o-c1`, `export-csv`, `mo-ho-du-cua` (kiểm hồi quy); cổng `co-marker` ≥ 8/10 VÀ `mot-cau-hoi-c1` ≥ 8/10. Người thực thi: Codex (pane Orca); phiên Claude điều phối, ghi Status/Receipt và tự chấm lại cổng.

## Out of scope
- Sửa skill gốc `packages/spec/src/claude/skills/specs/`, `description` của specs, agent `spec-maker` hay bản chiếu của nó; đo lại Claude; đổi thước hoặc target của thước.
- 6 ca định tuyến (`sua-typo`, `khong-kich-hoat`, `lam-thang-*`, `sua-nho-lam-luon`, `develop-auth`) và `sau-keep`; home của Bro; publish; push.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Ghi chú chèn sau frontmatter của bản chiếu `specs/SKILL.md`, khoá `sourcePath` như ask và research | Sửa câu GATE-SCOPE ở skill gốc; đổi thước sang đọc mọi tin | Bro chọn chỉ phần chiếu; Claude đã 10/10; thước giữ nguyên để so được với mốc | Codex đọc thân skill trước khi hỏi phạm vi | Cổng < 8/10 → dừng, báo Bro, không sửa vòng hai |
| D-02 | Ghi chú nói bốn điều: câu hỏi GATE-SCOPE nằm trong final answer của lượt (không ở commentary, không qua `request_user_input`), không gửi tóm tắt sau nó; mỗi mục cần quyết viết đúng dạng `[NEEDS CLARIFICATION: <question>]` với nội dung thật; giữ nguyên chữ `NEEDS CLARIFICATION` và ba chữ EXPAND, KEEP, CUT, không dịch | Chỉ nhắc "dùng marker"; chỉ nói "tin cuối" | Hai lỗi đo được là vị trí tin (7/10, Codex coi câu hỏi ở commentary là đã gửi: `batch-all/specs/mo-ho-c1/1/events.jsonl` dòng 41 "câu hỏi đã gửi") và thiếu chữ (marker 8/10, dịch bộ ba 2/10) | Ghi chú không làm Codex tự chốt phạm vi hay viết code | `khong-code` < 10/10 hoặc file `src/` bị đổi ở bất kỳ ca nào → hồi quy, verdict FAIL |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Bản cài Codex của specs mang ghi chú cổng phạm vi; skill khác và nguồn chung không đổi | modify | packages/spec Codex projection, installed | none | elevated: chiếu sai làm đổi mọi skill Codex | source: test chiếu; installed: `codex-native.test.js` |
| CP-02 | Model thật kết thúc lượt bằng tin GATE-SCOPE có marker thật và đủ bộ ba, không hồi quy ca khác | add | evals/codex, AI/model | none | elevated: nhiều biến lẫn vào (CLI 0.161→0.162, runner, phòng); PASS giả do trích lại ghi chú | live: 40 lượt chấm bằng `grade.mjs`, so mốc `batch-all/specs`, kiểm marker thật, đếm lượt nạp ghi chú, 5 lượt đối chứng không ghi chú |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When CafeKit is installed for Codex, the projected `specs/SKILL.md` shall carry the scope-gate note after its frontmatter, every other projected skill and the shared source shall stay unchanged, and the frontmatter shall stay valid. | task-01 Command |
| AC-02 | When the 4 specs cases run 10 valid times each in clean-home rooms with the new projection, `mo-ho-c1` shall score at least 8/10 on both `co-marker` and `mot-cau-hoi-c1` with at least as many genuine (non-placeholder, non-echoed) markers in the final message, all 10 `mo-ho-c1` runs and every other run that read the specs skill shall have loaded the note, `khong-code` shall stay 10/10 and no `src/` file shall change in any of the 4 cases, and the report shall give per-run final-message placement, `src/` citation counts against the baseline, 5 no-note control runs, and Fisher p for both gate graders. | task-02 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Ghi chú cổng phạm vi trong bản chiếu specs | P1 | AC-01 | `packages/spec/bin/lib/codex-install.js`, 2 test | - | done |
| 02 | Đo lại 4 ca specs | P1 | AC-02 | `evals/codex/specs-check.mjs`, `evals/codex/report-specs-gate.md` | 01 | done |

## Review log
- Round 1 (2 reviewer ngữ cảnh mới): 8 phát hiện H-01..H-08. Bro chấp nhận hết; H-07 chọn thêm 5 lượt đối chứng. Đã áp: miễn trừ specs ở `codex-research-projection.test.js:57` (đổi phạm vi có chủ đích, không nới test) (H-01); kiểm marker thật, gắn cờ tin cuối trích ghi chú (H-02); định nghĩa đọc/nạp theo output công cụ, `mo-ho-c1` 10/10 (H-03); đọc định dạng cũ qua `events.jsonl` (H-04); D-02 nêu final answer và giữ chữ marker (H-05); cột trích dẫn `src/` chỉ báo cáo (H-06); 5 lượt đối chứng `mo-ho-c1` từ worktree tạm ở `7304cdd1`, trần 62 (H-07); tham chiếu so byte và cách đặt tên attempt (H-08).

## GATE-DONE
- 2026-10-11: Bro chấp nhận hoàn thành. mo-ho-c1 co-marker 10/10, mot-cau-hoi-c1 10/10, marker thật 10/10, echoed 0, note loaded 10/10 + 30/30, regressions 0. Giới hạn đã nêu: đối chứng không ghi chú trên runner mới đạt 3/5 và 4/5 (marker thật 1/5) nên phần vị trí tin quy một phần cho runner/CLI; CLI 0.161→0.162, đường dẫn cf-specs, n=10/n=5, thước hành động và LLM N/A, 6 ca định tuyến chưa đo.
