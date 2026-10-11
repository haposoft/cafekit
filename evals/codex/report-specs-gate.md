# Đo cổng phạm vi Specs trên Codex

**PASS theo cổng đã chốt.** mo-ho-c1: co-marker 10/10, mot-cau-hoi-c1 10/10; genuine markers 10/10; echoed note 0; note loaded 10/10 và others 30/30; regressions 0.

## Phạm vi và phương pháp

Đo ngày 2026-10-11. Bản chiếu có ghi chú: commit 3e4648ea; gpt-6.1-sol medium, clean CODEX_HOME cấu hình C, workspace-write, không web. Prompt gốc của từng ca; không ask guard hoặc prompt override. Không sửa runner, bộ chấm, thước, bản chiếu hay nguồn chung. Không đo lại Claude hoặc home người dùng.

Nhật ký mới: `/Users/nghialuutrung/Desktop/cafekit-codex-eval/specs-gate`; mốc: `/Users/nghialuutrung/Desktop/cafekit-codex-eval/batch-all/specs`; đối chứng: `/Users/nghialuutrung/Desktop/cafekit-codex-eval/specs-gate-control`. 40/40 lượt mới và 5/5 đối chứng hợp lệ; 45/62 lần gọi tính cả attempt.

Chấm lại cả mốc và lượt mới bằng readRun/grade của grade.mjs, không dùng điểm đóng sẵn trong result.json. Mốc chỉ có events.jsonl, last.txt, result.json và workspace; không yêu cầu invocation/capture/session. Lượt mới kiểm model/effort, clean-home, config, prompt gốc và native capture. run_error là result.status khác completed; 0 lệnh không tự là lỗi. Lượt lỗi giữ trong <n>.attempt-k, lượt hợp lệ ở <n>; không loại lượt hợp lệ.

Cổng giữ hai regex gốc chỉ đọc last.txt, mỗi thước ≥8/10. Marker thật dùng regex đã khóa `\[(NEEDS CLARIFICATION|CẦN LÀM RÕ):\s*(?!<question>)[^\]]{5,}\]` (i), đồng thời loại tin có marker ghi chú hoặc <question>; echo guard ngăn placeholder lọt qua do whitespace backtracking. Đòi ≥8 marker thật và không có echoed note.

Đọc skill: output công cụ chứa name: cf-specs; nạp ghi chú: chính output đó chứa chuỗi đánh dấu task 01. Native dùng function_call_output/custom_tool_call_output; mốc dùng command_execution.aggregated_output. Catalog và lời gọi chưa có output không là bằng chứng. Đòi mo-ho-c1 nạp 10/10 và mọi lượt đọc specs ở ba ca khác đều nạp.

Hồi quy: khong-code không đạt 10/10 ở một ca, hoặc file src/ bị đổi, thêm, xoá. Lượt mới so workspace-before với workspace; mốc so fixture evals/specs/dung-o-c1/fixture/src. Thước hành động chưa có ánh xạ và giám khảo LLM giữ N/A, không coi là PASS.

## Số đo theo ca

| Ca | Lượt mới | khong-code mốc → sau | src/ đổi byte mốc → sau | Tin cuối trích src/ hoặc /customers mốc → sau | Đọc / nạp note sau |
|---|---:|---|---|---|---|
| mo-ho-c1 | 10/10 | 10/10 → 10/10 | 0 → 0 | 5 → 10 | 10 / 10 |
| dung-o-c1 | 10/10 | 10/10 → 10/10 | 0 → 0 | 2 → 9 | 10 / 10 |
| export-csv | 10/10 | 10/10 → 10/10 | 0 → 0 | 9 → 10 | 10 / 10 |
| mo-ho-du-cua | 10/10 | 10/10 → 10/10 | 0 → 0 | 5 → 10 | 10 / 10 |

| Thước cổng | Mốc | Sau | Đối chứng không note |
|---|---:|---:|---:|
| co-marker | 0/10 | 10/10 | 3/5 |
| mot-cau-hoi-c1 | 0/10 | 10/10 | 4/5 |
| Marker thật | 0/10 | 10/10 | 1/5 |
| Tin trích note/placeholder | 0 | 0 | 0 |

## Vị trí tin hỏi phạm vi từng lượt mo-ho-c1

Điểm “mọi tin” chỉ chẩn đoán, không cộng vào cổng. Mỗi cặp dưới đây là co-marker / mot-cau-hoi-c1. Vị trí bộ ba tính từ 1 trong agent_message; “sau” là số agent_message đứng sau tin đầu tiên chứa đủ EXPAND, KEEP, CUT. ∅ nghĩa là không có bộ ba trong cùng một tin.

| Pha/lượt | Tin cuối: marker / bộ ba | Mọi tin: marker / bộ ba | Tin bộ ba đầu / số tin sau | Marker thật | Echo | Đọc / nạp note |
|---|---|---|---|---|---|---|
| mốc/1 | FAIL / FAIL | FAIL / PASS | 2 / 1 | không | không | có / không |
| mốc/2 | FAIL / FAIL | FAIL / FAIL | ∅ / ∅ | không | không | có / không |
| mốc/3 | FAIL / FAIL | FAIL / FAIL | ∅ / ∅ | không | không | có / không |
| mốc/4 | FAIL / FAIL | FAIL / FAIL | ∅ / ∅ | không | không | có / không |
| mốc/5 | FAIL / FAIL | FAIL / PASS | 2 / 1 | không | không | có / không |
| mốc/6 | FAIL / FAIL | PASS / PASS | 3 / 1 | không | không | có / không |
| mốc/7 | FAIL / FAIL | FAIL / PASS | 2 / 1 | không | không | có / không |
| mốc/8 | FAIL / FAIL | PASS / PASS | 3 / 1 | không | không | có / không |
| mốc/9 | FAIL / FAIL | FAIL / PASS | 3 / 1 | không | không | có / không |
| mốc/10 | FAIL / FAIL | FAIL / PASS | 3 / 1 | không | không | có / không |
| sau/1 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/2 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/3 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/4 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/5 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/6 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/7 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/8 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/9 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| sau/10 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / có |
| đối chứng/1 | FAIL / PASS | FAIL / PASS | 2 / 0 | không | không | có / không |
| đối chứng/2 | PASS / PASS | PASS / PASS | 2 / 0 | không | không | có / không |
| đối chứng/3 | PASS / PASS | PASS / PASS | 2 / 0 | có | không | có / không |
| đối chứng/4 | FAIL / FAIL | FAIL / PASS | 3 / 1 | không | không | có / không |
| đối chứng/5 | PASS / PASS | PASS / PASS | 2 / 0 | không | không | có / không |

## Đối chứng và giới hạn quy hiệu ứng

Đối chứng chạy trước lượt có note từ worktree tạm tại 7304cdd1, dùng runner và bộ cài thật ở checkout đó; worktree đã được remove sau khi đủ 5 lượt. Checker kiểm snapshot Specs tồn tại và không mang marker, không chỉ dựa vào việc model có đọc hay không. Cùng CLI hiện tại và clean-home; không phải đo lại mốc CLI cũ.

Đối chứng: co-marker 3/5, mot-cau-hoi-c1 4/5, genuine 1/5. Snapshot không note: 5/5; output có note: 0/5.

Mốc → đối chứng → sau: co-marker 0/10 → 3/5 → 10/10; bộ ba 0/10 → 4/5 → 10/10. Phần cải thiện đã xuất hiện khi chưa có note không thể quy cho note; có thể liên quan runner/CLI, cấu trúc phòng và biến thiên model. Chênh lệch sau so với đối chứng là quan sát phù hợp với ghi chú, chưa tách được quan hệ nhân quả với n=5 đối chứng và n=10 sau.

Đọc tin cuối đối chứng: lượt 2 có [NEEDS CLARIFICATION] nhưng thiếu dấu hai chấm; lượt 5 khớp cụm “cần làm rõ” trong văn xuôi. Chỉ lượt 3 có marker thật dạng ngoặc. Lượt 4 gửi bộ ba ở tin trước rồi kết thúc bằng tóm tắt (1 agent_message sau bộ ba).

## Fisher một phía

H1 cố định là tỷ lệ PASS sau > mốc, dùng đuôi trên Fisher với biên cố định. Chỉ báo cáo p; cổng vẫn dùng ngưỡng đã chốt, không thay bằng p.

| Thước | Mốc → sau | p một phía cải thiện |
|---|---|---:|
| co-marker | 0/10 → 10/10 | 0.0000054125441 |
| mot-cau-hoi-c1 | 0/10 → 10/10 | 0.0000054125441 |

## Thước N/A

- co-goi-skill: N/A: tool_used/Skill chưa có ánh xạ đã hiệu chỉnh (task 05). — mo-ho-c1, dung-o-c1, export-csv.
- khong-sua-code: N/A: tool_used/Edit chưa có ánh xạ đã hiệu chỉnh (task 05). — mo-ho-c1, dung-o-c1, export-csv, mo-ho-du-cua.
- khong-tu-chot: N/A: không có giám khảo LLM hoặc dữ liệu hiệu chỉnh hợp lệ. — mo-ho-c1, mo-ho-du-cua.
- khong-viet-code: N/A: tool_used/Write chưa có ánh xạ đã hiệu chỉnh (task 05). — mo-ho-c1, dung-o-c1, export-csv, mo-ho-du-cua.
- dung-truoc-khi-lam: N/A: không có giám khảo LLM hoặc dữ liệu hiệu chỉnh hợp lệ. — dung-o-c1, export-csv.
- da-goi-brainstorm: N/A: tool_used/Skill chưa có ánh xạ đã hiệu chỉnh (task 05). — mo-ho-du-cua.
- da-goi-mot-skill: N/A: tool_used/Skill chưa có ánh xạ đã hiệu chỉnh (task 05). — mo-ho-du-cua.
- da-goi-specs: N/A: tool_used/Skill chưa có ánh xạ đã hiệu chỉnh (task 05). — mo-ho-du-cua.

## Hồi quy và lượt bị loại

Regressions: 0.

sau: 0 lượt bị loại; danh sách rỗng.

đối chứng: 0 lượt bị loại; danh sách rỗng.

## Lệnh kiểm và phản ví dụ

```text
specs/mo-ho-c1 gate: co-marker 10/10
specs/mo-ho-c1 gate: mot-cau-hoi-c1 10/10
genuine markers: 10/10
echoed note: 0
note loaded: mo-ho-c1 10/10
note loaded: others 30/30
regressions: 0
Fisher one-sided improvement co-marker: p=0.0000054125441
Fisher one-sided improvement mot-cau-hoi-c1: p=0.0000054125441
control: runs 5/5; co-marker 3/5; mot-cau-hoi-c1 4/5; genuine markers 1/5
calls: 45/62; excluded runs: 0
verdict: PASS
```

node evals/codex/specs-check.mjs --phase after: exit 0.

Phản ví dụ chạy trước model: --phase after --log-root ~/Desktop/cafekit-codex-eval/batch-all/specs → đúng specs/mo-ho-c1 gate: co-marker 0/10; verdict FAIL; exit 1. Legacy không throw dù không có capture, session hay invocation.

## Giới hạn

- CLI mốc 0.161, lượt mới 0.162; phiên bản native lượt mới: 0.162.1. Đường dẫn .agents/skills/specs đổi sang cf-specs; runner và cấu trúc phòng khác.
- N=10 mỗi ca và 5 đối chứng; không suy ra tỷ lệ chính xác hoặc cô lập hoàn toàn hiệu ứng note. Không đo lại Claude hay home người dùng.
- Nhiều thước hành động N/A; không có giám khảo LLM. Trích dẫn src/ hoặc /customers chỉ đo sự xuất hiện chuỗi, không bảo đảm đúng hoặc đầy đủ bằng chứng.
- Skills toàn cục ở ~/.agents/skills vẫn có thể thấy; không sửa thư mục đó. Nhật ký chỉ có trên máy này.
- Không ca nào tụt trích dẫn ≥3 tin cuối so với mốc.

Không có câu hỏi chưa giải quyết trong phạm vi task.
