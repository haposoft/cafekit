# Task 06 — Báo cáo so sánh mới cho 12 skill

Status: done

## Outcome
Lượt chuẩn của 12 skill được chấm lại bằng bộ chấm đầy đủ (task 03–05) và so với số gốc Claude trong `evals/codex/fixtures/baselines.json` theo luật đã khoá; báo cáo nêu số thước so được trước/sau, điều kiện chạy, mọi cờ kèm cách đọc.

## Scope
- In: so vân tay các đường dẫn có commit (`packages/spec/src/**`, `packages/spec/bin/**`, `evals/run.sh`, `evals/*.mjs`, `evals/<skill>/**`) CÓ trong bảng `sha256` đã khoá; đường dẫn không có vân tay lúc chạy không dùng để phát hiện lệch và được liệt kê trong báo cáo là "chưa khoá" giữa lúc chạy và commit của task 01; đường dẫn dùng chung lệch → mọi skill cần chạy lại, `evals/<skill>/` lệch → skill đó; danh sách chạy lại DỪNG chờ Bro duyệt trước khi gọi model; quyết định duyệt chỉ đọc từ `evals/codex/rerun-approval.json` do phiên Claude ghi sau khi Bro duyệt (task không tự ghi file này); 17 thước `llm` ghi N/A kèm lý do; cột điều kiện chạy; cách đọc cờ (đổi tên khi chiếu, cách viết, tin giữa chừng, khác thật).
- Out: đo lại Claude; sửa skill; chạy lại khi chưa được duyệt.

## Coverage
- CP-06

## Ownership
- Create: `evals/codex/rescore.mjs`, `evals/codex/report-parity.md`
- Read: `evals/codex/rerun-approval.json` (chỉ đọc; phiên Claude là người ghi)

## Steps
1. So vân tay → danh sách ô phải chạy lại (có thể rỗng); nếu không rỗng thì dừng, báo Bro.
2. Chấm lại mọi lượt chuẩn → bảng mới theo skill.
3. Viết báo cáo, mở đầu bằng kết luận và giới hạn (không đo lại Claude, không có giám khảo LLM, nhật ký chỉ trên máy này).
4. Commit đúng các file task này tạo hoặc sửa bằng `git commit -m <message> -- <đường dẫn>` (chỉ các đường dẫn đó, conventional commit, không ghi tên AI, chưa push); khi task 03 và 04 chạy song song, phiên Claude cho hai commit diễn ra lần lượt.

## Acceptance
- AC-06: báo cáo có, cho 12 skill, số thước so được trước và sau, cột điều kiện chạy, mọi cờ kèm cách đọc, 17 thước `llm` N/A kèm lý do, danh sách ô chạy lại (hoặc ghi rỗng).

## Dependencies
- task-04-v-graders.md
- task-05-event-mapping.md

## Verification Plan
- Command: `node evals/codex/rescore.mjs --check`
- Named probe: dòng `skills: 12/12`, dòng `comparable before → after`, dòng `flags without reading: 0`, dòng `rerun cells: N (approved|none)`, dòng `llm N/A with reason: 17/17`, dòng `unlocked paths: N`.
- Reachability: nhật ký và fixtures trên máy này; chạy lại (nếu Bro duyệt) cần pane Codex có mạng.
- Oracle: exit 0, 12 skill có số, 0 cờ thiếu cách đọc, `llm N/A with reason: 17/17`, rerun là `none`, hoặc `approved` khi và chỉ khi `evals/codex/rerun-approval.json` tồn tại và liệt kê đúng các ô đó.
- Counterexample: xoá cách đọc của một cờ trong bản tạm của báo cáo → `flags without reading: 1`, exit 1.
- Artifacts: `evals/codex/report-parity.md` (commit).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/rescore.mjs --check
Exit: 0
Base: a15b05db2dc8b748c4850c1184507d144c629c23
Head: cd611cfbbfb06e9ff82138ddb5bed0f9fa6620e21fcb48cc86295f7d255f18f7
```text
$ node evals/codex/rescore.mjs --check
skills: 12/12
comparable before → after: 501 → 510
flags without reading: 0
rerun cells: 0 (none)
llm N/A with reason: 17/17
unlocked paths: 11
exit=0
$ (counterexample) node evals/codex/rescore.mjs --check --report <bản chép báo cáo, xoá cách đọc cờ F001>
flags without reading: 1
exit=1
$ git log -1 --format="%h %s"
a15b05db feat(evals): rescore canonical runs and report parity
```

Review (phiên Claude): 12/12 skill, 640 lượt; rerun 0 (none), rerun-approval.json không tồn tại; 17/17 thước llm N/A có lý do; 11 đường dẫn chưa khoá được liệt kê. So được 501 → 510: 64/81 thước bật ở task 05 là dem-* chẩn đoán (loại khỏi so sánh), 17 thước thật, phần có số gốc Claude cho +9. Thước an toàn ask/cam-sua khong-edit nay đo trực tiếp (Claude 10/10, Codex 2/10). Commit a15b05db chỉ 2 file, không ghi tên AI, chưa push. Thực thi: pane Codex.
