# Codex research depth
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-10, ngưỡng chốt 2026-10-11)
- Existing: bảng chọn độ sâu Quick/Standard/Deep ở `packages/spec/src/claude/skills/research/SKILL.md:21-31` (Quick cho "known option"); phần chiếu Codex có tiền lệ chèn ghi chú theo `sourcePath` cho ask ở `packages/spec/bin/lib/codex-install.js:316-324`; `evals/codex/run.mjs:14-18` đã chạy research với web bật; nhật ký Codex cũ ở `~/Desktop/cafekit-codex-eval/batch-all-B/research/<ca>/<n>`. Lỗi đo được (`evals/codex/report-parity.md:88-91`): `da-co-quyet-dinh` `do-sau-quick` Codex 0/10 (Claude 10/10) dù fixture có ADR đã chốt (`evals/research/fixtures/da-co-quyet-dinh/docs/decisions/ADR-004-orm.md`); `chon-kien-truc-theo-rang-buoc` `do-sau-standard` Codex 5/10 (Claude 10/10). Đọc lại câu cuối: ở `da-co-quyet-dinh` Codex nâng độ sâu vì thấy một lý do phụ trong ADR đã lỗi thời và vì "dữ liệu tiền" (`batch-all-B/research/da-co-quyet-dinh/1/last.txt`); ở `chon-kien-truc` cả 5 lượt Deep (6–10) nâng vì tài liệu BullMQ hiện hành có backend PostgreSQL, trái ghi chú repo "cần Redis" — bằng chứng mâu thuẫn thật có thể đổi kết luận, đúng luật `SKILL.md:31` (`batch-all-B/research/chon-kien-truc-theo-rang-buoc/{6..10}/last.txt`).
- Minimum change: một ghi chú độ sâu chỉ cho bản chiếu Codex của `research/SKILL.md`; đo lại 8 ca research × 10 lượt.
- Expansion signals: none (gói 2 trong 3 gói tuần tự; `plans/20261010-codex-followups.md`).
- User decision: KEEP — chỉ sửa phần chiếu Codex, skill gốc và Claude không đổi, không đo lại Claude; cổng ≥ 8/10 cho `da-co-quyet-dinh/do-sau-quick`; `chon-kien-truc-theo-rang-buoc` chỉ báo cáo kèm lý do nâng độ sâu từng lượt (GATE-REVIEW H-01); đo đủ 8 ca, ca `-agent` chỉ báo cáo. Người thực thi: Codex (pane Orca); phiên Claude điều phối, ghi Status/Receipt và tự chấm lại cổng.

## Out of scope
- Sửa skill gốc `packages/spec/src/claude/skills/research/`, agent `researcher` hay bản chiếu của nó; đo lại Claude; sửa thước hay ngưỡng của bộ ca.
- Cổng cho ca `-agent`; home của Bro; publish; push.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Ghi chú độ sâu chèn sau frontmatter của bản chiếu `research/SKILL.md` (khoá `sourcePath`, như ask) | Sửa bảng độ sâu ở skill gốc | Bro chọn chỉ phần chiếu; Claude đã đạt 10/10 | Codex đọc thân skill trước khi chọn độ sâu | Đo xong mà cổng < 8/10 → dừng, báo Bro, không sửa vòng hai |
| D-02 | Ghi chú dùng chữ của bảng gốc: một quyết định repo đã chốt (đang có hiệu lực) là một *known option* → Quick; lý do phụ đã lỗi thời không nâng độ sâu trừ khi nó làm đổi khuyến nghị; mâu thuẫn làm đổi khuyến nghị vẫn nâng độ sâu như `SKILL.md:31` | Câu "không theo chữ miền"; câu "không bị mâu thuẫn → Quick" | Câu cũ trái tín hiệu blast-radius của bảng và tự chặn Quick khi Codex thấy lý do phụ lỗi thời (10/10 lượt cũ); `nguon-cu-mau-thuan` cần Standard/Deep (`evals/research/nguon-cu-mau-thuan/graders/do-sau-standard-deep.md`) | Ghi chú không làm tụt ca có bằng chứng mâu thuẫn | `nguon-cu-mau-thuan` `do-sau-standard-deep` tụt so với mốc → hồi quy, verdict FAIL |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Bản cài Codex của research mang ghi chú độ sâu; skill khác và nguồn chung không đổi | modify | packages/spec Codex projection, installed | none | elevated: chiếu sai làm đổi mọi skill Codex | source: test chiếu; installed: bản cài có ghi chú |
| CP-02 | Model thật chọn Quick ở ca đã có quyết định, không hồi quy ca khác | add | evals/codex, AI/model | none | elevated: ghi chú làm tụt ca cần Deep; nhiều biến lẫn vào (CLI 0.161→0.162, phòng, runner, web) | live: 80 lượt chấm bằng `grade.mjs`, so mốc `batch-all-B/research`, đếm lượt nạp ghi chú |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When CafeKit is installed for Codex, the projected `research/SKILL.md` shall carry the depth note after its frontmatter, every other projected skill and the shared source shall stay unchanged, and the frontmatter shall stay valid. | task-01 Command |
| AC-02 | When the 8 research cases run 10 valid times each in clean-home rooms with the new projection, `da-co-quyet-dinh/do-sau-quick` shall score at least 8/10 with zero disagreements between the grader and the first-`Depth:`-label rule, every non-agent run shall have loaded the note, no scored `khong-*` grader, workspace byte comparison, or spawned-session count in the 4 non-agent cases shall regress from the `batch-all-B/research` baseline, `nguon-cu-mau-thuan/do-sau-standard-deep` shall not drop below its baseline, and the report shall give per-run escalation reasons and Fisher p for both depth graders. | task-02 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Ghi chú độ sâu trong bản chiếu research | P1 | AC-01 | `packages/spec/bin/lib/codex-install.js`, test | - | done |
| 02 | Đo lại 8 ca research | P1 | AC-02 | `evals/codex/research-check.mjs`, `evals/codex/report-research-depth.md` | 01 | done |

## Review log
- Round 1 (2 reviewer ngữ cảnh mới): 9 phát hiện H-01..H-09. Bro: H-01 bỏ `chon-kien-truc` khỏi cổng (Deep do bằng chứng mâu thuẫn thật, chỉ báo cáo kèm lý do); chấp nhận H-02..H-09. Đã áp: D-02 dùng chữ của bảng gốc (H-02); biến lẫn vào ghi làm giới hạn, lý do nâng độ sâu từng lượt, Fisher p, đếm lượt nạp ghi chú (H-03); test bằng chuỗi đánh dấu vắng mặt và `sourcePath` lạ (H-04); hồi quy chỉ 4 ca không agent, in N/A, so byte, đếm phiên con (H-05); phản ví dụ `batch-all-B/research`, đọc cả định dạng cũ, đòi đúng dòng cổng 0/10 (H-06); luật nhãn `Depth:` đầu tiên, 0 bất đồng (H-07); run_error phân loại bằng máy, liệt kê lượt loại, `<n>.attempt-k` (H-08); thêm `codex-native.test.js` vào lệnh kiểm (H-09).

## GATE-DONE
- 2026-10-11: Bro chấp nhận hoàn thành. Cổng da-co-quyet-dinh Quick 10/10, note loaded 40/40, regressions 0. Giới hạn đã nêu: chon-kien-truc Standard 5→1/10 (chỉ báo cáo, lý do nâng độ sâu không đổi), biến lẫn vào CLI/đường dẫn skill/runner/web, n=10, nhiều thước khong-* N/A.
