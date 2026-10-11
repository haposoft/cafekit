# Task 02 — Model thật chọn Quick ở ca đã có quyết định, không hồi quy

Status: done

## Outcome
8 ca research có 10 lượt hợp lệ mỗi ca với bản chiếu của task 01; `da-co-quyet-dinh/do-sau-quick` ≥ 8/10; không hồi quy ở 4 ca không agent so với `batch-all-B/research`; báo cáo ghi lý do nâng độ sâu từng lượt và các biến lẫn vào.

## Scope
- In:
  - Chạy 8 ca × 10 lượt bằng `node evals/codex/run.mjs --run --only research/<ca> --out <thư mục mới>` (clean home, config C, web bật như `run.mjs:14-18`) vào `~/Desktop/cafekit-codex-eval/research-depth/<ca>/<n>`; chạy lại vào `<n>.attempt-k` rồi lượt hợp lệ vào `<n>`; trần 110 lần gọi tính cả attempt.
  - `run_error` phân loại bằng máy trong `research-check.mjs`: `result.json` status khác `completed`, hoặc mọi mục web search của lượt có trạng thái lỗi trong `events.jsonl`; lượt 0 lệnh không tự là run_error; liệt kê mọi lượt bị loại kèm lý do.
  - `evals/codex/research-check.mjs --phase after [--log-root <dir>]`:
    - đọc cả định dạng mới (`invocation.json`, `capture.json`, `sessions/`) và cũ (`invocation-research.json`, `capture-research.json`, `sessions-research/`); kiểm invocation/clean-home chỉ với định dạng mới;
    - chấm mọi lượt bằng `grade.mjs`; mốc = chấm lại `batch-all-B/research` bằng cùng `grade.mjs`;
    - luật độ sâu: nhãn `Depth:` hoặc `Độ sâu:` đầu tiên trong `last.txt`, giá trị là từ Quick/Standard/Deep (hoặc Nhanh/Tiêu chuẩn/Sâu) đầu tiên sau nhãn; không có nhãn = "không rõ"; in phân bố mỗi ca; in mọi lượt mà luật và thước regex bất đồng;
    - cổng: `research/da-co-quyet-dinh gate: do-sau-quick k/10` với k ≥ 8 VÀ 0 bất đồng ở ca này;
    - bằng chứng nạp ghi chú: số lượt không agent có chuỗi đánh dấu của task 01 trong `sessions/*.jsonl` (đòi 40/40);
    - hồi quy (chỉ 4 ca không agent): thước `khong-*` có chấm rơi dưới mốc; so byte `workspace-before` với `workspace` (file sẵn có bị đổi); số phiên trong `capture.json` > 1 (gọi agent con); `nguon-cu-mau-thuan/do-sau-standard-deep` rơi dưới mốc; in danh sách thước N/A;
    - báo cáo-only: `chon-kien-truc-theo-rang-buoc/do-sau-standard` và 4 ca `-agent`: phân bố độ sâu và lý do sau nhãn `Depth:` từng lượt;
    - in Fisher p (một phía) của `do-sau-quick` và `do-sau-standard` so với mốc; in `verdict`.
  - Báo cáo `evals/codex/report-research-depth.md`: số đo, lý do nâng độ sâu từng lượt ở hai ca độ sâu, giới hạn (CLI 0.161→0.162, đường dẫn skill `.agents/skills/research` → `cf-research`, runner khác, web thay đổi theo thời gian, n=10), không quy thay đổi ở `chon-kien-truc` cho ghi chú nếu lý do nâng độ sâu không đổi.
- Out: đo lại Claude; home của Bro; đổi thước; sửa thêm bản chiếu.

## Coverage
- CP-02

## Ownership
- Create: `evals/codex/research-check.mjs`, `evals/codex/report-research-depth.md`
- Read: `evals/codex/run.mjs`, `evals/codex/grade.mjs`, `evals/codex/ask-check.mjs`

## Steps
1. Viết `research-check.mjs`; chạy với `--log-root ~/Desktop/cafekit-codex-eval/batch-all-B/research` để thấy cổng FAIL ở dòng `do-sau-quick 0/10`.
2. Chạy 8 ca × 10 lượt.
3. Chạy lệnh kiểm; viết báo cáo.
4. Cổng không đạt hoặc có hồi quy → dừng, báo Bro, không sửa vòng hai.
5. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-02: dòng cổng `do-sau-quick` ≥ 8/10 và 0 bất đồng; nạp ghi chú 40/40; `regressions: 0`; báo cáo đủ mục; phiên Claude tự áp luật nhãn `Depth:` đầu tiên trên `last.txt` của `da-co-quyet-dinh` và khớp.

## Dependencies
- task-01-research-depth-note.md

## Verification Plan
- Command: `node evals/codex/research-check.mjs --phase after`
- Named probe: `research/da-co-quyet-dinh gate: do-sau-quick k/10`; `depth disagreements: 0`; `note loaded: 40/40`; `regressions: 0`; `verdict: PASS`.
- Reachability: nhật ký ở `~/Desktop/cafekit-codex-eval/research-depth/`; chạy model cần pane Codex không sandbox, có mạng.
- Oracle: exit 0 và `verdict: PASS`.
- Counterexample: `--phase after --log-root ~/Desktop/cafekit-codex-eval/batch-all-B/research` → in đúng dòng `research/da-co-quyet-dinh gate: do-sau-quick 0/10`, `verdict: FAIL`, exit 1.
- Artifacts: `evals/codex/report-research-depth.md` (commit); nhật ký giữ ngoài repo.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/research-check.mjs --phase after
Exit: 0
Base: 7304cdd1ff1475a3c5ccb0c840a9fb1dd73f6904
Head: 4bc87e6b1f596d645438f83c3302d7fc75f17a748ed272d4702f0836331e32cb
```text
research/chon-kien-truc-theo-rang-buoc: runs 10/10; depth {"Quick":0,"Standard":1,"Deep":9,"không rõ":0}
research/chon-kien-truc-theo-rang-buoc-agent: runs 10/10; depth {"Quick":0,"Standard":1,"Deep":9,"không rõ":0}
research/da-co-quyet-dinh: runs 10/10; depth {"Quick":10,"Standard":0,"Deep":0,"không rõ":0}
research/da-co-quyet-dinh-agent: runs 10/10; depth {"Quick":10,"Standard":0,"Deep":0,"không rõ":0}
research/khong-luu-khong-sua: runs 10/10; depth {"Quick":0,"Standard":4,"Deep":6,"không rõ":0}
research/khong-luu-khong-sua-agent: runs 10/10; depth {"Quick":0,"Standard":0,"Deep":10,"không rõ":0}
research/nguon-cu-mau-thuan: runs 10/10; depth {"Quick":0,"Standard":0,"Deep":10,"không rõ":0}
research/nguon-cu-mau-thuan-agent: runs 10/10; depth {"Quick":0,"Standard":1,"Deep":9,"không rõ":0}
research/da-co-quyet-dinh gate: do-sau-quick 10/10
depth disagreements: 0
depth disagreements all cases: 0
note loaded: 40/40
regressions: 0
Fisher one-sided improvement da-co-quyet-dinh/do-sau-quick: p=0.0000054125441
Fisher one-sided improvement chon-kien-truc-theo-rang-buoc/do-sau-standard: p=0.99458204
calls: 80/110; excluded runs: 0
verdict: PASS
```

Commit 7304cdd1 (Codex thực thi, phiên Claude tự chạy lại lệnh kiểm). Khối trên giữ dòng tóm tắt; phần N/A và lý do từng lượt nằm trong evals/codex/report-research-depth.md. Phản ví dụ chạy lại: --log-root ~/Desktop/cafekit-codex-eval/batch-all-B/research in đúng dòng cổng do-sau-quick 0/10, verdict FAIL, exit 1. Phiên Claude tự áp luật nhãn Depth: đầu tiên trên 10 last.txt của da-co-quyet-dinh: 10/10 Quick, khớp. Nhật ký ở ~/Desktop/cafekit-codex-eval/research-depth/, 0 attempt.
