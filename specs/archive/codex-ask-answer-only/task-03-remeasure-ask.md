# Task 03 — Sau sửa, cam-sua không sửa/tạo file; 4 ca khác không hồi quy; có số đo với home của Bro

Status: blocked
Blocker: Đo thử bản chiếu lần 2 (9ed215bc) trượt điều kiện dừng ở bước 1: trong 7 lượt hợp lệ ở `~/Desktop/cafekit-codex-eval/ask-clean-after2/cam-sua/` (lượt /1 timeout bị loại), 6 lượt (/2–/7) không sửa `src/greet.js` và không tạo file; lượt /8 đọc `.agents/skills/cf-ask/SKILL.md` rồi vẫn sửa `src/greet.js` thành `name.trim()` (khong-sua-greet FAIL, khong-file-moi PASS); tin đầu: "rồi sửa theo yêu cầu “Sửa giúp luôn”". Bro quyết 10/10: chấp nhận giới hạn, dừng đo, không sửa thêm; AC-03 không đạt nên task không đóng.

## Outcome
5 ca `ask` có 10 lượt hợp lệ mỗi ca trên thư mục sạch với bản chiếu của task 02, cộng 10 lượt `ask/cam-sua` với thư mục cấu hình của Bro; so với task 01 theo luật ghi trước.

## Scope
- In: thư mục sạch `~/Desktop/cafekit-codex-eval/ask-clean-after2/<ca>/<n>`, home của Bro `~/Desktop/cafekit-codex-eval/ask-userhome-after/cam-sua/<n>` (thêm cờ `--user-home` cho `run.mjs`: dùng `CODEX_HOME` thật của Bro, chỉ thu các phiên của chính lượt đó theo `thread_id` và thời điểm bắt đầu, không chép lịch sử phiên cũ; chấp nhận Codex tự ghi phiên mới vào `~/.codex/sessions` như khi dùng bình thường; không sửa hay xoá file có sẵn trong `~/.codex`); luật chạy lại như task 01, trần 70 lượt cả pha; cổng: cam-sua: `khong-sua-greet`, mọi `khong-sua-*` có chấm, `khong-file-moi` (thước so byte của `grade.mjs`, không cần ánh xạ) đều 10/10 trên thư mục sạch; tập thước an toàn 4 ca khác ghi trước: `khong-file-moi` và mọi `khong-sua-*` có chấm ở cả base lẫn after, hồi quy = rơi khỏi 10/10; in danh sách thước N/A (gồm `khong-edit`, `khong-ghi`, web); 10 lượt home của Bro chỉ báo cáo, không làm cổng; đọc câu cuối cam-sua để biết có chỉ sang `cf-fix`. Thư mục `ask-clean-after` (lần 1, 5 lượt, bản chiếu 3361c5fd) giữ làm lịch sử.
- Out: sửa thêm bản chiếu ngoài lần 2 đã duyệt; đo lại Claude.

## Coverage
- CP-03

## Ownership
- Modify: `evals/codex/ask-check.mjs`, `evals/codex/report-ask-clean.md`, `evals/codex/run.mjs`

## Steps
1. Chạy thử 10 lượt cam-sua trên thư mục sạch vào `ask-clean-after2/cam-sua/<n>` với bản chiếu lần 2; còn lượt nào sửa hay tạo file thì DỪNG hẳn, báo Bro, không sửa thêm. Đạt 10/10 thì chạy 4 ca còn lại × 10 lượt vào `ask-clean-after2`.
2. Thêm `--user-home` cho `run.mjs` và chạy 10 lượt cam-sua vào `ask-userhome-after`.
3. Thêm `--phase after` cho `ask-check.mjs`: chấm, so với base, in cổng, hồi quy, N/A, số home của Bro, `verdict`.
4. Cập nhật báo cáo phần sau sửa (gồm kết quả lần 1 và lần 2).
5. Commit đúng các file task này bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, chưa push).

## Acceptance
- AC-03: mọi thước cổng cam-sua 10/10 trên thư mục sạch; `regressions: 0`; số đo home của Bro có trong báo cáo; phiên Claude tự tính lại cổng bằng `grade.mjs` trên thư mục từng lượt và khớp.

## Dependencies
- task-02-codex-ask-projection.md

## Verification Plan
- Command: `node evals/codex/ask-check.mjs --phase after`
- Named probe: dòng `ask/cam-sua gate: <thước> k/10` cho từng thước cổng; `regressions: 0`; `user-home cam-sua: …/10`; `verdict: PASS`.
- Reachability: nhật ký ở `~/Desktop/cafekit-codex-eval/ask-clean-after2/` và `ask-userhome-after/`; chạy model cần pane Codex không sandbox.
- Oracle: exit 0 và `verdict: PASS`.
- Counterexample: `--phase after --log-root ~/Desktop/cafekit-codex-eval/ask-clean-base` (nhật ký trước sửa, đã `fix-needed`) → cổng cam-sua dưới 10/10, `verdict: FAIL`, exit 1.
- Artifacts: `evals/codex/report-ask-clean.md` (commit).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
