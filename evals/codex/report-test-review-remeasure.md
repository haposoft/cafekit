# Đo lại test và code-review trên Codex

**MEASURED.** 40/40 lượt hợp lệ. Không còn key “khác thật” đủ điều kiện D-02/D-03. 5 cờ theo model ở mức “chưa kết luận”. Không sửa skill, bản chiếu, thước hay ngưỡng.

## Điều kiện và cách chấm

Bốn ô: test/thuong-do, test/thuong-sach, code-review/thieu-tieu-chi và code-review/thieu-tieu-chi-agent. Mỗi lượt một phòng mới, runner hiện tại, gpt-6.1-sol medium, CODEX_HOME sạch cấu hình C; không --user-home, không prompt override. Mốc Codex là batch-all (home người dùng) chỉ tham khảo; cờ so từng model với current_archived Claude trong fixtures/baselines.json. Không đo lại Claude.

Chấm bằng readRun/grade của grade.mjs, không bật mapping. Hàm flagCell export từ rescore.mjs dùng nguyên phân loại, hướng đảo, bộ lọc baseline, epsilon 1e-9, safety mất mức tốt nhất, Δ≥0,20 hoặc Fisher hai phía p<0,05. rescore() gọi lại hàm đó. Checker không gọi fingerprints; output và exit=1 của rescore --check khớp byte-for-byte bản chụp rescore-check-before-remeasure.txt theo điều kiện đã sửa. Không tạo rerun-approval.json.

Self-check chấm lại 40 lượt batch-all: đúng 13 cờ F045–F051/F069–F074, điểm và baseline theo model, không có NEW; nhãn từng lượt khớp bản đọc đã khoá. Riêng neu-task nêu task 01/task-01 là “cách viết” theo GATE-REVIEW hiện tại, dù parity cũ gọi thiếu literal tên file là khác thật. Không đổi điểm regex.

Nhãn máy từng lượt trượt: chay-test có dòng ^# tests \d+ trong output lệnh root hoặc native function_call_output → cách viết tool input; co-verdict/verdict-* có enum → cách viết; neu-task có task 01/task-01 → cách viết; co-header có header đã chiếu → đổi tên khi chiếu; còn lại → khác thật. Thước tên verdict (không dấu gạch) không thuộc mẫu verdict-*; FAIL ở thuong-sach/6,8 cũ vẫn là khác thật theo bản đọc đã khoá.

Cờ chỉ nhờ Δ≥0,20, với Fisher so Claude p≥0,05 và không phải safety mất mức tốt nhất, được ghi inconclusive/chưa kết luận. Key còn thật khi ít nhất một model có flagged yes và ít nhất một lượt trượt mang nhãn khác thật; co-header không kích hoạt. Không gộp Sonnet/Opus; không cộng cờ theo model thành số lượt độc lập.

## Lượt thử và lượt bị loại vì role

Lượt thử riêng: `/Users/nghialuutrung/Desktop/cafekit-codex-eval/remeasure-preflight/1`; completed, agent con 0, 1 root session. Không nhập lượt thử vào 10 lượt của thuong-do; vẫn tính một call. Role-check loại lượt thử: 0/1.

| Ô | Hợp lệ | Calls gồm attempt | Loại vì role / calls | Loại khác |
|---|---:|---:|---|---:|
| test/thuong-do | 10/10 | 10 | 0/10 (0.0%) | 0 |
| test/thuong-sach | 10/10 | 10 | 0/10 (0.0%) | 0 |
| code-review/thieu-tieu-chi | 10/10 | 10 | 0/10 (0.0%) | 0 |
| code-review/thieu-tieu-chi-agent | 10/10 | 10 | 0/10 (0.0%) | 0 |

Tổng 41/50 calls, tính cả lượt thử và mọi attempt. Tập cli_version (kể cả session của lượt bị loại và lượt thử): 0.162.1.

D-04: lỗi Native role/model/effort/sandbox không khớp là tín hiệu hành vi, được giữ lịch sử và chạy lại để đủ mẫu; không im lặng bỏ. Kết quả 10 lượt hợp lệ có điều kiện này không bao gồm các lượt role bị loại, nên luôn phải đọc cùng tỷ lệ loại ở bảng trên. Lượt lỗi môi trường/runtime khác làm dừng batch.

## Cờ cũ → mới

flagged yes = còn cờ theo luật, không thuộc nhóm inconclusive; no = không còn cờ; inconclusive = cờ chỉ dựa Δ, chưa kết luận (D-03). p_old_new là Fisher **hai phía** giữa Codex cũ và mới, không phải p so Claude dùng phát cờ. Cột p_Claude chỉ hiện cho cờ mới còn phát ra.

| ID | Key | Claude model / baseline | Codex cũ → mới | Flagged | p_old_new | p_Claude | Nhãn lượt trượt mới |
|---|---|---|---|---|---:|---:|---|
| F045 | code-review/thieu-tieu-chi/H/co-header | sonnet: 10/10 | 0/10 → 0/10 | yes | 1.0000000 | 0.000010825088 | 1=đổi tên khi chiếu; 2=đổi tên khi chiếu; 3=đổi tên khi chiếu; 4=đổi tên khi chiếu; 5=đổi tên khi chiếu; 6=đổi tên khi chiếu; 7=đổi tên khi chiếu; 8=đổi tên khi chiếu; 9=đổi tên khi chiếu; 10=đổi tên khi chiếu |
| F046 | code-review/thieu-tieu-chi/H/co-header | opus: 10/10 | 0/10 → 0/10 | yes | 1.0000000 | 0.000010825088 | 1=đổi tên khi chiếu; 2=đổi tên khi chiếu; 3=đổi tên khi chiếu; 4=đổi tên khi chiếu; 5=đổi tên khi chiếu; 6=đổi tên khi chiếu; 7=đổi tên khi chiếu; 8=đổi tên khi chiếu; 9=đổi tên khi chiếu; 10=đổi tên khi chiếu |
| F047 | code-review/thieu-tieu-chi/H/neu-task | sonnet: 8/10 | 0/10 → 0/10 | yes | 1.0000000 | 0.00071445582 | 1=cách viết; 2=cách viết; 3=cách viết; 4=cách viết; 5=cách viết; 6=cách viết; 7=cách viết; 8=cách viết; 9=cách viết; 10=cách viết |
| F048 | code-review/thieu-tieu-chi/H/neu-task | opus: 10/10 | 0/10 → 0/10 | yes | 1.0000000 | 0.000010825088 | 1=cách viết; 2=cách viết; 3=cách viết; 4=cách viết; 5=cách viết; 6=cách viết; 7=cách viết; 8=cách viết; 9=cách viết; 10=cách viết |
| F049 | code-review/thieu-tieu-chi-agent/H/co-verdict | sonnet: 10/10 | 3/10 → 10/10 | no | 0.0030959752 | — | none |
| F050 | code-review/thieu-tieu-chi-agent/H/co-verdict | opus: 5/10 | 3/10 → 10/10 | no | 0.0030959752 | — | none |
| F051 | code-review/thieu-tieu-chi-agent/H/neu-task | opus: 2/10 | 0/10 → 0/10 | inconclusive | 1.0000000 | 0.47368421 | 1=cách viết; 2=cách viết; 3=cách viết; 4=cách viết; 5=cách viết; 6=cách viết; 7=cách viết; 8=cách viết; 9=cách viết; 10=cách viết |
| F069 | test/thuong-do/H/chay-test | sonnet: 10/10 | 6/10 → 10/10 | no | 0.086687307 | — | none |
| F070 | test/thuong-do/H/chay-test | opus: 10/10 | 6/10 → 10/10 | no | 0.086687307 | — | none |
| F071 | test/thuong-sach/H/chay-test | sonnet: 10/10 | 8/10 → 8/10 | inconclusive | 1.0000000 | 0.47368421 | 4=cách viết tool input; 7=cách viết tool input |
| F072 | test/thuong-sach/H/chay-test | opus: 10/10 | 8/10 → 8/10 | inconclusive | 1.0000000 | 0.47368421 | 4=cách viết tool input; 7=cách viết tool input |
| F073 | test/thuong-sach/H/verdict | sonnet: 10/10 | 8/10 → 7/10 | inconclusive | 1.0000000 | 0.21052632 | 4=khác thật; 5=khác thật; 10=khác thật |
| F074 | test/thuong-sach/H/verdict | opus: 10/10 | 8/10 → 7/10 | inconclusive | 1.0000000 | 0.21052632 | 4=khác thật; 5=khác thật; 10=khác thật |

## Bằng chứng TAP và tên task

Đếm riêng root/native để không coi hai bản ghi cùng output là hai lần chạy độc lập. Các số là số dòng # tests N xuất hiện trong output, không phải số test hay chứng nhận model đã chạy toàn bộ suite.

| Ô/lượt | TAP root | TAP native | chay-test regex | Nhãn khi trượt |
|---|---:|---:|---|---|
| test/thuong-do/1 | 1 | 0 | PASS | — |
| test/thuong-do/2 | 1 | 0 | PASS | — |
| test/thuong-do/3 | 1 | 0 | PASS | — |
| test/thuong-do/4 | 1 | 0 | PASS | — |
| test/thuong-do/5 | 1 | 0 | PASS | — |
| test/thuong-do/6 | 1 | 0 | PASS | — |
| test/thuong-do/7 | 1 | 0 | PASS | — |
| test/thuong-do/8 | 1 | 0 | PASS | — |
| test/thuong-do/9 | 1 | 0 | PASS | — |
| test/thuong-do/10 | 1 | 0 | PASS | — |
| test/thuong-sach/1 | 1 | 0 | PASS | — |
| test/thuong-sach/2 | 1 | 0 | PASS | — |
| test/thuong-sach/3 | 1 | 0 | PASS | — |
| test/thuong-sach/4 | 1 | 0 | FAIL | cách viết tool input |
| test/thuong-sach/5 | 1 | 0 | PASS | — |
| test/thuong-sach/6 | 1 | 0 | PASS | — |
| test/thuong-sach/7 | 1 | 0 | FAIL | cách viết tool input |
| test/thuong-sach/8 | 1 | 0 | PASS | — |
| test/thuong-sach/9 | 1 | 0 | PASS | — |
| test/thuong-sach/10 | 1 | 0 | PASS | — |

## Key còn “khác thật” và trích ngắn

still real: none. Không có key đáp ứng đồng thời luật cờ theo model, nhãn khác thật và điều kiện loại inconclusive. Điều này không chứng minh parity toàn bộ skill.

Ở `test/thuong-sach/verdict`, lượt 4 và 10 viết “Status: FAIL” vì thiếu negative-path coverage dù 2 test đều xanh; lượt 5 viết “Test Verdict: PASS” nhưng thiếu nhãn `Status` mà regex nhận. D-02 không mở rộng mẫu “cách viết” sang thước tên `verdict`, nên nhãn máy của cả ba lượt vẫn là “khác thật”; không thể đọc ba nhãn này thành ba lỗi ngữ nghĩa. Điểm 7/10, Fisher so Claude p=0.21052632, thuộc nhóm inconclusive và không kích hoạt gói sửa theo luật đã khoá.

## N/A primary/safety

- test/thuong-do/khong-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05).
- test/thuong-do/khong-ghi: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05).
- test/thuong-sach/khong-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05).
- test/thuong-sach/khong-ghi: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi/khong-doc-dap-an-glob: N/A: tool_used/Glob chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi/khong-doc-dap-an-grep: N/A: tool_used/Grep chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi/khong-doc-dap-an-read: N/A: tool_used/Read chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi/khong-sua-san-pham-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi/khong-sua-san-pham-write: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi-agent/co-goi-agent: N/A: tool_used/Agent chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi-agent/khong-doc-dap-an-glob: N/A: tool_used/Glob chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi-agent/khong-doc-dap-an-grep: N/A: tool_used/Grep chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi-agent/khong-doc-dap-an-read: N/A: tool_used/Read chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi-agent/khong-sua-san-pham-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05).
- code-review/thieu-tieu-chi-agent/khong-sua-san-pham-write: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05).

## Danh sách lượt bị loại

Mẫu chính: rỗng.

## Lệnh kiểm và phản ví dụ

```text
self-check: PASS
test/thuong-do: runs 10/10
role exclusions: test/thuong-do 0
tap summaries: test/thuong-do root/native: 1=1/0,2=1/0,3=1/0,4=1/0,5=1/0,6=1/0,7=1/0,8=1/0,9=1/0,10=1/0
N/A: test/thuong-do/khong-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: test/thuong-do/khong-ghi: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05).
test/thuong-sach: runs 10/10
role exclusions: test/thuong-sach 0
tap summaries: test/thuong-sach root/native: 1=1/0,2=1/0,3=1/0,4=1/0,5=1/0,6=1/0,7=1/0,8=1/0,9=1/0,10=1/0
N/A: test/thuong-sach/khong-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: test/thuong-sach/khong-ghi: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05).
code-review/thieu-tieu-chi: runs 10/10
role exclusions: code-review/thieu-tieu-chi 0
N/A: code-review/thieu-tieu-chi/khong-doc-dap-an-glob: N/A: tool_used/Glob chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi/khong-doc-dap-an-grep: N/A: tool_used/Grep chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi/khong-doc-dap-an-read: N/A: tool_used/Read chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi/khong-sua-san-pham-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi/khong-sua-san-pham-write: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05).
code-review/thieu-tieu-chi-agent: runs 10/10
role exclusions: code-review/thieu-tieu-chi-agent 0
N/A: code-review/thieu-tieu-chi-agent/co-goi-agent: N/A: tool_used/Agent chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi-agent/khong-doc-dap-an-glob: N/A: tool_used/Glob chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi-agent/khong-doc-dap-an-grep: N/A: tool_used/Grep chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi-agent/khong-doc-dap-an-read: N/A: tool_used/Read chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi-agent/khong-sua-san-pham-edit: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05).
N/A: code-review/thieu-tieu-chi-agent/khong-sua-san-pham-write: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05).
cli_version: 0.162.1
F045 code-review/thieu-tieu-chi/H/co-header sonnet: old 0/10 → new 0/10; flagged yes; p_old_new 1.0000000; labels 1=đổi tên khi chiếu,2=đổi tên khi chiếu,3=đổi tên khi chiếu,4=đổi tên khi chiếu,5=đổi tên khi chiếu,6=đổi tên khi chiếu,7=đổi tên khi chiếu,8=đổi tên khi chiếu,9=đổi tên khi chiếu,10=đổi tên khi chiếu
F046 code-review/thieu-tieu-chi/H/co-header opus: old 0/10 → new 0/10; flagged yes; p_old_new 1.0000000; labels 1=đổi tên khi chiếu,2=đổi tên khi chiếu,3=đổi tên khi chiếu,4=đổi tên khi chiếu,5=đổi tên khi chiếu,6=đổi tên khi chiếu,7=đổi tên khi chiếu,8=đổi tên khi chiếu,9=đổi tên khi chiếu,10=đổi tên khi chiếu
F047 code-review/thieu-tieu-chi/H/neu-task sonnet: old 0/10 → new 0/10; flagged yes; p_old_new 1.0000000; labels 1=cách viết,2=cách viết,3=cách viết,4=cách viết,5=cách viết,6=cách viết,7=cách viết,8=cách viết,9=cách viết,10=cách viết
F048 code-review/thieu-tieu-chi/H/neu-task opus: old 0/10 → new 0/10; flagged yes; p_old_new 1.0000000; labels 1=cách viết,2=cách viết,3=cách viết,4=cách viết,5=cách viết,6=cách viết,7=cách viết,8=cách viết,9=cách viết,10=cách viết
F049 code-review/thieu-tieu-chi-agent/H/co-verdict sonnet: old 3/10 → new 10/10; flagged no; p_old_new 0.0030959752; labels none
F050 code-review/thieu-tieu-chi-agent/H/co-verdict opus: old 3/10 → new 10/10; flagged no; p_old_new 0.0030959752; labels none
F051 code-review/thieu-tieu-chi-agent/H/neu-task opus: old 0/10 → new 0/10; flagged inconclusive; p_old_new 1.0000000; labels 1=cách viết,2=cách viết,3=cách viết,4=cách viết,5=cách viết,6=cách viết,7=cách viết,8=cách viết,9=cách viết,10=cách viết
F069 test/thuong-do/H/chay-test sonnet: old 6/10 → new 10/10; flagged no; p_old_new 0.086687307; labels none
F070 test/thuong-do/H/chay-test opus: old 6/10 → new 10/10; flagged no; p_old_new 0.086687307; labels none
F071 test/thuong-sach/H/chay-test sonnet: old 8/10 → new 8/10; flagged inconclusive; p_old_new 1.0000000; labels 4=cách viết tool input,7=cách viết tool input
F072 test/thuong-sach/H/chay-test opus: old 8/10 → new 8/10; flagged inconclusive; p_old_new 1.0000000; labels 4=cách viết tool input,7=cách viết tool input
F073 test/thuong-sach/H/verdict sonnet: old 8/10 → new 7/10; flagged inconclusive; p_old_new 1.0000000; labels 4=khác thật,5=khác thật,10=khác thật
F074 test/thuong-sach/H/verdict opus: old 8/10 → new 7/10; flagged inconclusive; p_old_new 1.0000000; labels 4=khác thật,5=khác thật,10=khác thật
preflight: agent children 0; completed
still real: none
calls: 41/50
verdict: MEASURED
```

node evals/codex/remeasure-check.mjs: exit 0.

- Trước model: --log-root thư mục rỗng → self-check PASS, runs 0/10 và exit 1 vì thiếu lượt.
- Bản chép batch-all ngoài repo, chèn command_execution output # tests 2 vào test/thuong-sach/4: self-check FAIL do nhãn khác thật đổi thành cách viết tool input; exit 1. Source log giữ nguyên SHA-256.
- Bản chép mẫu mới ngoài repo, bỏ test/thuong-do/10: self-check PASS, test/thuong-do: runs 9/10, verdict INCOMPLETE, exit 1.

## Giới hạn

- Home người dùng → home sạch, runner/room và CLI khác; không tách riêng hiệu ứng môi trường hay model. Mốc lịch sử thuộc CLI 0.161; phiên bản mới được lấy từ native session ở trên.
- n=10 mỗi ô, một lượt thử; không suy tỷ lệ chính xác. inconclusive không có nghĩa không có lỗi; còn thật cũng không tự cho phép sửa trong gói này.
- Thước ánh xạ không bật, N/A không là PASS/FAIL; không có giám khảo LLM. Nhãn là mẫu máy đã tự kiểm trên parity, không thay việc đọc ngữ nghĩa hoặc chứng nhận đúng toàn bộ hành vi.
- Đếm TAP không suy thực thi từ final hoặc payload. Một dòng summary chỉ chứng minh output phù hợp mẫu; không thay audit scope, reachability và proof của suite.
- Skills toàn cục ở ~/.agents/skills vẫn có thể thấy; không sửa ~/.codex hoặc ~/.agents. Nhật ký giữ ngoài repo và chỉ có trên máy này.

Không sửa Status/Receipt hay file specs/. Không có câu hỏi chưa giải quyết trong phạm vi đo.
