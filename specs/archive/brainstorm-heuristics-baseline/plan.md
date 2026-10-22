# Đo gốc: cf:brainstorm có nêu giả định chịu lực và hướng tốt hơn không (gói 3c/5)
Specs-Contract: process-first-ready-v1

Lộ trình chung: `plans/20261021-cfk-ref-borrow-roadmap.md` (gói 3, GATE-SCOPE 2026-10-21; luật C2; trần eval cả gói 3 là $100, đã dùng ≈ $8.3).

## Scope decision (GATE-SCOPE — 2026-10-21)
- Existing: `cf:brainstorm` giữ riêng feasibility/confidence/disposition và luật ước lượng số (`packages/spec/src/claude/skills/brainstorm/SKILL.md:67`), handoff có 13 heading bắt buộc gồm `Direction and alternatives`, `Relevant impacts and failure behavior`, `Assumptions` (`:113`); không có câu nào bắt mỗi phương án nêu giả định chịu lực và điều kiện gãy đầu tiên, so trường hợp xấu nhất, ưu tiên hướng rẻ nhất để bỏ, hay ghi rõ có/không có hướng tốt hơn. Nguồn mượn: `~/Desktop/cfk-ref/.claude/skills/ak-brainstorm/SKILL.md:38-43`, `:86-91`. Bộ eval `evals/brainstorm/` có fixture và scaffold kiểu `mot-duong-agent/scaffold.sh`; grader `llm` có tiền lệ ở `evals/debug/doc-ma-sai-huong/graders/khong-do-cho-list.md`. 10 lượt sonnet của ca brainstorm cũ tốn $0.73–1.53 (`evals/archive/results-summary-20261008.csv.gz`). Bộ đọc trace cũ ghim tên `cafekit-brainstorm:brainstorm` (`evals/brainstorm/read-traces.mjs:40`), không khớp `--plugin-name cf`.
- Minimum change: một task đo gốc, chưa sửa skill.
- Expansion signals: khoảng 10 file, chỉ thư mục eval.
- User decision: **KEEP** — đo gốc sonnet; có số thì quay lại GATE-SCOPE. Ngưỡng (mẫu số luôn là k = số lượt hợp lệ): heuristic nào thiếu ở ≥30% của k thì đáng thêm vào skill; tỉ lệ thiếu từ 20% đến 40% của k ghi "giáp ranh" để GATE-SCOPE cân nhắc; cần k ≥ 8, dưới mức đó báo "chưa đủ mẫu". GATE-REVIEW vòng 1 (2026-10-21): nhận B1–B10.

## Out of scope
- Sửa `cf:brainstorm`; đo opus, Codex; nhánh không dùng skill.
- Đường gọi agent `brainstormer` và tra web: ca chỉ cấp công cụ đọc và Bash, nên chỉ đo đường controller.
- Độ ổn định của giám khảo: không chấm lại; Receipt ghi "chưa đo".

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Ca mới `evals/brainstorm/hai-huong/`: fixture `plans/queue-design.md` có hai hướng khả thi (Postgres LISTEN/NOTIFY + bảng job, hoặc Redis Streams); dữ kiện: đã có Postgres, chưa có Redis; tải hiện tại 50 job/s; thử tải trên instance hiện tại chịu khoảng 600 job/s; chiến dịch tháng 11 có thể nhân tải lên nhiều lần nhưng chưa có số; cần mỗi job được xử lý đúng một lần; đội nhỏ, muốn ít thành phần vận hành. Prompt `/cf:brainstorm` đủ ngữ cảnh, dặn không cần hỏi lại | Dùng lại `mot-duong`; ghi sẵn "đỉnh 2.000 job/s chưa chắc" | Giả định chịu lực phải do model tự suy ra; không hướng nào tự có "đúng một lần" (NOTIFY nhiều nhất một lần; bảng job và Streams ít nhất một lần) nên có bẫy | Model trả lời đủ trong chat khi không hỏi được | Lượt không đưa khuyến nghị (`co-khuyen-nghi` trượt) → loại khỏi mẫu, ghi lý do |
| D-02 | Grader `llm`, chấm theo nghĩa, không đòi cụm chữ nào; heading hay khung trống không tính; một hướng thứ ba được so sánh kèm lý do (ví dụ bảng job + `SELECT … FOR UPDATE SKIP LOCKED`) tính vào "mỗi hướng": `gia-dinh-diem-gay` (mỗi hướng so sánh nêu giả định chịu lực nhất và một điều kiện cụ thể — ngưỡng, sự kiện hoặc lỗi — khiến nó vi phạm một ràng buộc; nhắc lại ràng buộc fixture không kèm điều kiện cụ thể thì không tính); `truong-hop-xau` (so hệ quả của từng hướng khi giả định đi ngược hướng đó); `re-nhat-de-bo` (luôn áp dụng ở ca này: so chi phí đảo ngược/rời bỏ của các hướng và khuyến nghị dựa trên đó; tự khẳng định giả định đã giải mà không có bằng chứng thì trượt); `xet-huong-tot-hon` (nói rõ "không có hướng tốt hơn vì …" hoặc nêu một hướng/biến thể ngoài hai hướng được hỏi kèm lý do); cổng mẫu `co-khuyen-nghi` (`llm`: có một khuyến nghị, kể cả khuyến nghị theo giai đoạn); bộ đếm `dem-askuser` | Grader regex | Văn xuôi tiếng Việt/Anh khó bắt bằng regex; regex cũ gắn đáp án ca khác (`evals/brainstorm/ne-cau-hoi/graders/co-khuyen-nghi.md:6`) | Giám khảo sonnet chấm đúng theo định nghĩa | — |
| D-03 | Mẫu hợp lệ = lượt đạt `co-khuyen-nghi` và được CLI `node evals/lean/loaded.mjs brainstorm <result dir>` (gọi qua `spawnSync`, vì import module đó chạy luôn phần CLI và thoát 2) báo dòng `run=<i> loaded=yes` (init liệt kê `cf:brainstorm` và dòng `Base directory for this skill: …/skills/brainstorm` trong trace hoặc transcript, bỏ qua tool_result); file `evals/brainstorm/hai-huong/summarize.mjs` đọc `result.json` và trace, in số lượt hợp lệ, số lượt đạt và tỉ lệ thiếu của từng heuristic, số lần gọi AskUserQuestion, và thoát 1 khi số lượt ≠ 10, có lượt `no-trace`/`unreadable`, hoặc k < 8 | Đếm tay; dò một câu của SKILL.md trong trace (thân skill qua slash chỉ nằm trong transcript, và heading `Direction and alternatives` cũng có trong câu trả lời) | Đưa được vào Receipt, lặp lại được; mẫu thiếu không thể ra `Exit: 0` | `result.json` có verdict từng grader theo lượt (`cases[].arms.with[].graders[]`) | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Có số gốc cho bốn heuristic trên `cf:brainstorm` với sonnet, đủ để quyết sửa skill hay không | add | Eval | none | routine | live (eval sonnet n=10) |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the case runs 10 times on sonnet, the summary command shall print the number of valid runs (recommendation given and `cf:brainstorm` loaded) and, for each of the four heuristics, how many valid runs show it, with the case loading green beforehand. | task-01 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Ca `hai-huong` + chạy đo | P1 | AC-01 | `evals/brainstorm/hai-huong/**`, `evals/brainstorm/fixtures/hai-huong/**` | - | done |

## Review log
- Round 1 (2026-10-21): 2 reviewer context mới (Fact Checker + Contract Verifier; Assumption destroyer + Proof); 16 finding gộp còn 10 (B1–B10); Bro nhận cả 10. sweep: plan + task / 10 delta (cổng nạp skill, định nghĩa grader, fixture không nói sẵn giả định, `re-nhat-de-bo` luôn áp dụng, `co-khuyen-nghi` thành llm, lệnh tổng hợp, `dem-askuser`, giới hạn đường controller, độ ổn định giám khảo, mẫu số ngưỡng) / tham chiếu cũ đã sửa: "2.000 job/s chưa chắc", break signal chấm lại, `co-khuyen-nghi` regex, "≥3/10 lượt" / còn mâu thuẫn: 0.
- Closure pass (2026-10-22, context mới): B2–B5, B7–B9 PASS; B1, B6, B10 FAIL + N1–N4 → sửa trong phạm vi đã nhận: kiểm nạp dùng lại `evals/lean/loaded.mjs` (B1/N1), `summarize.mjs` thoát 1 khi thiếu mẫu (B6/N4), mẫu số ngưỡng là k cả cho vùng giáp ranh (B10), D-03 bỏ "`node -e`" (N2), break signal D-01 khớp định nghĩa hợp lệ (N3). sweep: plan + task / còn mâu thuẫn: 0.
- Re-closure (2026-10-22): B6, B10, N2, N3 PASS; B1 FAIL vì M1 (bằng chứng chạy thật: `import { readRun }` từ `loaded.mjs` in usage và thoát 2) → D-03/Step 4 gọi CLI qua `spawnSync`, không sửa `loaded.mjs` (ngoài Ownership). B1 đóng bằng bằng chứng chạy: `node evals/lean/loaded.mjs --self-test` → `self-test: ok` (có ca slash chỉ nằm trong transcript); CLI thoát 1 khi có lượt unreadable. Hết blocker → Status pending.
- Review develop (2026-10-22, code-auditor): PASS_WITH_WARNINGS — sửa câu bối cảnh grader sai sự thật về NOTIFY (Medium), `summarize.mjs` dùng `process.execPath` và coi `run.error` là lỗi harness (Low); máy khởi động lại xoá trace giữ trong `/private/tmp` nên chạy lại toàn bộ Command để có output hiện hành.
