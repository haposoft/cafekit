# Task 02 — Model thật kết thúc bằng tin cổng phạm vi, không hồi quy

Status: done

## Outcome
4 ca specs có 10 lượt hợp lệ mỗi ca với bản chiếu của task 01; `mo-ho-c1` đạt `co-marker` ≥ 8/10 và `mot-cau-hoi-c1` ≥ 8/10; không hồi quy so với `batch-all/specs`; báo cáo ghi vị trí tin hỏi phạm vi từng lượt và các biến lẫn vào.

## Scope
- In:
  - Chạy `mo-ho-c1`, `dung-o-c1`, `export-csv`, `mo-ho-du-cua` × 10 lượt bằng `node evals/codex/run.mjs --run --only specs/<ca> --out <thư mục mới>` (clean home, cấu hình C, không web) vào `~/Desktop/cafekit-codex-eval/specs-gate/<ca>/<n>`; lượt lỗi: đổi tên `<n>` thành `<n>.attempt-k` rồi chạy lại vào `<n>` trống (`run.mjs:96` từ chối thư mục không trống); trần 62 lần gọi tính cả attempt và đối chứng.
  - Đối chứng (chỉ báo cáo): 5 lượt `mo-ho-c1` không ghi chú, chạy từ worktree tạm `git worktree add <tmp> 7304cdd1` (runner cài bản chiếu từ checkout của nó, `evals/codex/room.mjs:11,26`) vào `~/Desktop/cafekit-codex-eval/specs-gate-control/mo-ho-c1/<n>`; xoá worktree sau khi chạy.
  - `run_error` phân loại bằng máy trong `specs-check.mjs`: `result.json` status khác `completed`; lượt 0 lệnh không tự là run_error; liệt kê mọi lượt bị loại kèm lý do.
  - `evals/codex/specs-check.mjs --phase after [--log-root <dir>]`:
    - đọc cả định dạng mới (`invocation.json`, `capture.json`, `sessions/`) và cũ (`events.jsonl`, `last.txt`, `result.json`, `workspace`); định dạng cũ bỏ qua kiểm capture/session/invocation, không throw, vẫn in dòng cổng;
    - chấm mọi lượt bằng `grade.mjs`; mốc = chấm lại `batch-all/specs` bằng cùng `grade.mjs`;
    - cổng: in `specs/mo-ho-c1 gate: co-marker k/10` và `specs/mo-ho-c1 gate: mot-cau-hoi-c1 k/10`, đạt khi cả hai k ≥ 8;
    - marker thật: in `genuine markers: m/10` = số tin cuối `mo-ho-c1` khớp `\[(NEEDS CLARIFICATION|CẦN LÀM RÕ):\s*(?!<question>)[^\]]{5,}\]` (cờ i); in `echoed note: e` = số tin cuối chứa chuỗi đánh dấu của task 01 hoặc `<question>`; cổng đòi m ≥ 8 và e = 0;
    - đối chiếu: với mỗi lượt `mo-ho-c1`, in hai thước trên tin cuối và trên mọi `agent_message` (chỉ để báo cáo, không cộng điểm), và số `agent_message` sau tin đầu tiên có bộ ba;
    - nạp ghi chú: "đọc skill" = output công cụ (định dạng mới: `function_call_output`/`custom_tool_call_output` trong `sessions/*.jsonl`, như `research-check.mjs:96-97`; định dạng cũ: `command_execution.aggregated_output` trong `events.jsonl`) chứa `name: cf-specs`; "nạp" = output đó chứa chuỗi đánh dấu; in `note loaded: mo-ho-c1 a/10` (đòi 10/10) và `note loaded: others b/c` (đòi b = c);
    - hồi quy: `khong-code` < 10/10 ở bất kỳ ca nào; so byte `src/` của `workspace` (định dạng mới so với `workspace-before`, `run.mjs:112`; định dạng cũ so với `evals/specs/dung-o-c1/fixture/src`) — file bị đổi, thêm, xoá; in danh sách thước N/A;
    - chỉ báo cáo: số tin cuối có trích `src/` hoặc `/customers` mỗi ca so với mốc; đối chứng: hai thước cổng và marker thật trên 5 lượt `specs-gate-control` (`--control-root`, mặc định `~/Desktop/cafekit-codex-eval/specs-gate-control`);
    - in Fisher p (một phía) của `co-marker` và `mot-cau-hoi-c1` so với mốc; in `verdict`.
  - Báo cáo `evals/codex/report-specs-gate.md`: số đo, vị trí tin hỏi phạm vi từng lượt `mo-ho-c1`, trích dẫn `src/` so với mốc (tụt ≥ 3 ở một ca ghi thành giới hạn), kết quả đối chứng và phần hiệu ứng quy cho runner/CLI, giới hạn (CLI 0.161→0.162, đường dẫn skill `.agents/skills/specs` → `cf-specs`, runner khác, n=10, nhiều thước hành động N/A).
- Out: đo lại Claude; home của Bro; đổi thước; sửa thêm bản chiếu; 6 ca định tuyến và `sau-keep`.

## Coverage
- CP-02

## Ownership
- Create: `evals/codex/specs-check.mjs`, `evals/codex/report-specs-gate.md`
- Read: `evals/codex/room.mjs`, `evals/codex/run.mjs`, `evals/codex/grade.mjs`, `evals/codex/research-check.mjs`

## Steps
1. Viết `specs-check.mjs`; chạy với `--log-root ~/Desktop/cafekit-codex-eval/batch-all/specs` để thấy cổng FAIL ở dòng `co-marker 0/10`.
2. Chạy 5 lượt đối chứng từ worktree tạm, xoá worktree; chạy 4 ca × 10 lượt.
3. Chạy lệnh kiểm; viết báo cáo.
4. Cổng không đạt hoặc có hồi quy → dừng, báo Bro, không sửa vòng hai.
5. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-02: hai dòng cổng ≥ 8/10; `genuine markers` ≥ 8 và `echoed note: 0`; nạp ghi chú `mo-ho-c1` 10/10 và các ca khác b = c; `regressions: 0`; báo cáo đủ mục; phiên Claude tự áp hai regex thước và regex marker thật trên `last.txt` của `mo-ho-c1` và khớp.

## Dependencies
- task-01-specs-scope-note.md

## Verification Plan
- Command: `node evals/codex/specs-check.mjs --phase after`
- Named probe: `specs/mo-ho-c1 gate: co-marker k/10`; `specs/mo-ho-c1 gate: mot-cau-hoi-c1 k/10`; `genuine markers:`; `echoed note: 0`; `note loaded:`; `regressions: 0`; `verdict: PASS`.
- Reachability: nhật ký ở `~/Desktop/cafekit-codex-eval/specs-gate/`; chạy model cần pane Codex không sandbox.
- Oracle: exit 0 và `verdict: PASS`.
- Counterexample: `--phase after --log-root ~/Desktop/cafekit-codex-eval/batch-all/specs` → in đúng dòng `specs/mo-ho-c1 gate: co-marker 0/10`, `verdict: FAIL`, exit 1.
- Artifacts: `evals/codex/report-specs-gate.md` (commit); nhật ký giữ ngoài repo.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/specs-check.mjs --phase after
Exit: 0
Base: c8ede5c98072d455326ccad93bca2bebac91ba31
Head: 41e60c6286b2ae209da9ea00f8771164e3a02e59b4f2ddc05e44b3a5d403e5a6
```text
specs/mo-ho-c1: runs 10/10; src citations 5/10 → 10/10 (delta 5)
specs/dung-o-c1: runs 10/10; src citations 2/10 → 9/10 (delta 7)
specs/export-csv: runs 10/10; src citations 9/10 → 10/10 (delta 1)
specs/mo-ho-du-cua: runs 10/10; src citations 5/10 → 10/10 (delta 5)
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

Commit c8ede5c9 (Codex thực thi, phiên Claude tự chạy lại lệnh kiểm). Khối trên bỏ dòng N/A và placement từng lượt (có trong evals/codex/report-specs-gate.md; cả 10 lượt mo-ho-c1 có after trio 0). Phản ví dụ chạy lại: --log-root ~/Desktop/cafekit-codex-eval/batch-all/specs in đúng dòng cổng co-marker 0/10, verdict FAIL, exit 1. Phiên Claude tự áp hai regex thước và regex marker thật trên 10 last.txt mo-ho-c1: 10/10 co-marker, 10/10 bộ ba, mỗi lượt 3 marker thật, 0 lượt trích câu đánh dấu; trên 5 last.txt đối chứng: 3/5, 4/5, marker thật 1/5 — khớp checker. Worktree đối chứng đã xoá (git worktree list chỉ còn repo chính).
