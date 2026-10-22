# Đo gốc: cf:test có tự soát ra test giả, test bị tắt và CI che lỗi không (gói 3d/5)
Specs-Contract: process-first-ready-v1

Lộ trình: `plans/20261021-cfk-ref-borrow-roadmap.md` (gói 3, trần eval $100, đã dùng ≈ $27.4; luật C2).

## Scope decision (GATE-SCOPE — 2026-10-22)
- Existing: `cf:test` chỉ có các chế độ chạy proof (`packages/spec/src/claude/skills/test/SKILL.md:16-23`); nó đọc test để bắt nguồn bất định (`:61`) và cấm làm yếu test (`:27`), nhưng không có chế độ soát độ tin cậy của bộ test. Nguồn mượn: `~/Desktop/cfk-ref/.claude/skills/ak-test/references/audit-suite-workflow.md:17-41` (test giả, bị tắt, làm dở, không hiệu lực, CI điểm mù). Bộ eval `evals/test/` có fixture dự án thường `evals/test/fixture/` và mẫu scaffold `evals/test/chap-chon/scaffold.sh` (chép fixture, gỡ `specs`, `claude-scripts`, ghi lại file test). Bộ kiểm nạp `evals/lean/loaded.mjs` (gọi CLI, không import). `find-polluter`: cách làm đã có ở `packages/spec/src/claude/references/debugger/root-cause-tracing.md:44`, chưa có lỗi thật.
- Minimum change: một task đo gốc, chưa sửa skill.
- Expansion signals: khoảng 10 file, chỉ thư mục eval mới.
- User decision: **KEEP** — đo gốc sonnet; audit (nếu thêm sau) thuộc `cf:test`; `find-polluter` CUT. Ngưỡng (mẫu số k = số lượt hợp lệ; GATE-REVIEW T8): một loại lỗi bị bỏ sót <20% của k thì không cần; 20–29% "giáp ranh"; ≥30% đáng thêm chế độ audit; cần k ≥ 8, dưới mức đó báo "chưa đủ mẫu". Có số thì quay lại GATE-SCOPE.

## Out of scope
- Sửa `cf:test`; `find-polluter.sh`; opus, Codex; nhánh không dùng skill.
- Sửa `evals/test/check-fixtures.sh` hay các ca cũ.
- Độ ổn định của giám khảo: không chấm lại; Receipt ghi "chưa đo".
- Định tuyến (người dùng có tự tìm tới `cf:test` không) và nhánh không dùng skill: prompt gọi thẳng bằng slash, nên số đo không tách được phần của skill khỏi năng lực sẵn có của sonnet; Receipt ghi giới hạn này.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Ca mới `evals/test/kiem-suite/`: scaffold chép `evals/test/fixture/`, gỡ `specs` và `claude-scripts`, ghi lại `src/greet.js` đúng như `evals/test/chap-chon/scaffold.sh:8-15` (fixture gốc `evals/test/fixture/src/greet.js:3` cố ý sai), ghi lại `test/greet.test.js` gồm 2 test thật của `chap-chon` cộng 5 test lỗi đã cấy, mỗi test đặt tên theo một hành vi `greet` tuyên bố có (không tên nào lộ lỗi): assert luôn đúng (`assert.ok(true)` sau khi gọi `greet`), kiểm một hàm giả không gọi `greet`, `try/catch` nuốt một assert hỏng, `test.skip` không lý do mà bật lên sẽ hỏng, thân chỉ có `// TODO`; thêm `.github/workflows/test.yml` chạy `npm test \|\| true`; `npm test` xanh (6 pass, 1 skip). Prompt trung tính (GATE-REVIEW T1): `/cf:test Bộ test của dự án này có đáng tin không? Chỉ báo cáo, đừng sửa gì.` | Prompt kể sẵn loại lỗi (lộ đáp án); dùng lại `chap-chon`; nhiều file test | Một file, sáu lỗi riêng biệt, suite xanh nên chỉ đọc mới thấy | Model trả lời trong chat | Lượt không nạp `cf:test` → loại khỏi mẫu, ghi lý do |
| D-02 | Sáu grader `llm` chấm theo nghĩa, mỗi loại lỗi một grader, mỗi file nêu đúng tên test bị cấy và lý do tối thiểu được tính: `tim-luon-dung` (assert không phụ thuộc kết quả `greet`), `tim-ham-gia` (test không gọi `greet` thật; chỉ nói "luôn pass" thì chưa đủ), `tim-nuot-loi` (`catch` nuốt assert hỏng nên test luôn xanh), `tim-bi-tat` (bị skip mà không có lý do; nói thêm "bật lên sẽ hỏng" là đủ nhưng không bắt buộc), `tim-bo-do` (thân rỗng/chỉ TODO nên không kiểm gì), `tim-ci-che-loi` (`\|\| true` làm CI không bao giờ đỏ). Nhắc chung chung hay chỉ liệt kê tên test không kèm lý do thì không tính. Bộ đếm chẩn đoán (không vào ngưỡng, không loại lượt): `bao-pass`, `bao-fail` (regex verdict theo `evals/test/chap-chon/graders/bao-pass.md`), `khong-sua-test`, `khong-sua-code` (regex nguyên file theo `chap-chon/graders/khong-sua-*.md`), `khong-edit` (theo `chap-chon/graders/khong-edit.md`, có `input_match`), `dem-write` (`tool_used` Write); bốn grader `khong-doc-dap-an-{read,grep,glob,bash}` (mẫu `evals/brainstorm/mot-duong-agent/graders/`, thư mục plugin `cafekit-eval-test-*`) dùng cho tính hợp lệ (D-03) | Grader regex; prompt kể sẵn | Văn xuôi Việt/Anh; cần lý do chứ không chỉ tên | Giám khảo sonnet chấm đúng theo định nghĩa | — |
| D-03 | Mẫu hợp lệ = lượt mà `node evals/lean/loaded.mjs test <dir>` báo `loaded=yes` và không mở thư mục ca chứa đáp án (bốn grader `khong-doc-dap-an-*` đạt; `evals/run.sh:79` chép cả thư mục ca vào plugin); thiếu một grader `khong-doc-dap-an-*` thì thoát 1. `evals/test/kiem-suite/summarize.mjs <out> [<results dir>]` in `runs= loaded= valid=`, `<grader>=<x>/<k> missing=<p>%` cho sáu loại kèm danh sách lượt bị chấm sót (để soát tay, GATE-REVIEW T7), các bộ đếm chẩn đoán trên cả 10 lượt, lý do từng lượt bị loại; chép câu trả lời cuối từng lượt vào `<results dir>/<out>/answers/run-<i>.md` (T12); thoát 1 khi số lượt ≠ 10, có lượt `no-trace`/`unreadable`/`error`/`skippedPaidGraders`, `partial`, thiếu một grader `tim-*` ở lượt hợp lệ (T4), hoặc k < 8 | Đếm tay; coi grader vắng là bỏ sót | Đưa vào Receipt, máy chặn mẫu bẩn | `result.json` giữ shape `cases[0].arms.with[].graders[]` | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Có số gốc cho sáu loại lỗi bộ test mà `cf:test` sonnet tự soát ra, đủ để quyết có thêm chế độ audit không | add | Eval | none | routine | live (eval sonnet n=10) |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the case runs 10 times on sonnet, the summary command shall print the number of valid runs (`cf:test` loaded) and, for each of the six planted defects, how many valid runs name it with a reason, after a free load check of the case, the fixture's negative checks and a fake-data check of the summary, all inside one Command. | task-01 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Ca `kiem-suite` + chạy đo | P1 | AC-01 | `evals/test/kiem-suite/**` | - | done |

## Review log
- Round 1 (2026-10-22): 2 reviewer context mới (Fact Checker + Contract Verifier; Assumption Destroyer + Proof Auditor); 15 finding gộp còn 13 (T1–T13); Bro nhận cả 13, T8 chọn <20% / 20–29% / ≥30%. sweep: plan + task / delta: prompt trung tính (T1), kiểm âm tính fixture + `greet.js` theo `chap-chon` (T2), tên test theo hành vi + tiêu chí hàm giả (T3), grader vắng → thoát 1 (T4), đếm verdict (T5), đếm sửa code/Write (T6), in lượt bị chấm sót + rủi ro đa so sánh nêu ở GATE-SCOPE (T7), ngưỡng (T8), lý do tối thiểu từng grader (T9), `--validate` trong Command (T10), đổi tên `-r<n>` khi đo lại (T11), chép câu trả lời ra `answers/` (T12), `node --version` (T13) / tham chiếu cũ đã sửa: "giữ `src/greet.js` đúng", prompt kể sẵn, "20–40%" / còn mâu thuẫn: 0.
- Closure pass (2026-10-22, context mới): T1–T13 PASS; lỗi mới N1 từ chính T6 (regex `khong-sua-*` chưa được phát lại trên cây scaffold) → thêm (f) vào `check-fixture.sh`; nhận ghi chú: (g) `greet` ném lỗi làm hỏng đúng 3 test, chứng minh test hàm giả không gọi `greet`. Hết blocker → pending.
- Review develop (2026-10-22, code-auditor): PASS_WITH_WARNINGS — Medium: grader và scaffold đọc được trong lượt đo (`evals/run.sh:79`) → thêm bốn `khong-doc-dap-an-*` và loại lượt mở đáp án khỏi mẫu (D-02/D-03; chọn theo quy ước làm luôn phương án Recommended giữa gói eval, ghi tại đây); Low: sửa bối cảnh `tim-luon-dung` (hỏng khi `greet` ném lỗi), bỏ vế thừa ở `tim-bo-do`, self-test thêm `skippedPaidGraders`/9 lượt/no-trace/lượt đọc đáp án; lượt giám khảo lỗi ghi `passed:false` vẫn soát được qua `missed_runs`.
