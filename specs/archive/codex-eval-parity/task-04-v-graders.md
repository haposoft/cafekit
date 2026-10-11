# Task 04 — Thước V của sync, git chấm lại được

Status: done

## Outcome
`evals/codex/grade-v.mjs` gọi đúng các thước V gốc (`evals/sync/verify-run.mjs`, `evals/git/verify-run.mjs`) trên lượt chuẩn, không viết lại quyết định của thước.

## Scope
- In: chuẩn bị ngữ cảnh cho thước V từ nhật ký Codex (lệnh, output, phòng thử chụp); thước `khong-cham-tran` giữ N/A như quy ước.
- Out: sửa thước V; thước H (task 03).

## Coverage
- CP-04

## Ownership
- Create: `evals/codex/grade-v.mjs`, `evals/codex/check-v.mjs`
- Read: `evals/sync/verify-run.mjs`, `evals/git/verify-run.mjs`, `evals/codex/manifest.json`

## Steps
1. Gộp các adapter V đã dùng → một module.
2. Chấm lại V trên lượt chuẩn của sync, git → bảng lệch. (`develop` không có thước V, chỉ có joint suy từ H.)
3. Ghi nguyên nhân mỗi lệch.
4. Commit đúng các file task này tạo hoặc sửa bằng `git commit -m <message> -- <đường dẫn>` (chỉ các đường dẫn đó, conventional commit, không ghi tên AI, chưa push); khi task 03 và 04 chạy song song, phiên Claude cho hai commit diễn ra lần lượt.

## Acceptance
- AC-04: V của sync/git chấm lại toàn bộ lượt chuẩn, lệch không giải thích được = 0.

## Dependencies
- task-02-rooms-runner-manifest.md

## Verification Plan
- Command: `node evals/codex/check-v.mjs`
- Named probe: dòng `sync|git: runs N, mismatches M, unexplained 0`.
- Reachability: manifest và nhật ký trên máy này; không cần mạng.
- Oracle: exit 0, hai skill, `unexplained 0`.
- Counterexample: đổi một verdict V trong bản chép tạm → `unexplained 1`, exit 1.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/check-v.mjs
Exit: 0
Base: ce5a42103d9d337e755501dd43f429358b2bcb83
Head: dd14890cd2829029c18730428c4261c26908a5059cd8fb64fccc6e39b848d68b
```text
$ node evals/codex/check-v.mjs
sync: runs 40, mismatches 0, unexplained 0
git: runs 40, mismatches 0, unexplained 0
exit=0
$ (counterexample) node evals/codex/check-v.mjs --results-root <bản chép kết quả, đổi verdict V batch-all/sync/audit-handwritten-receipt/1 bao-provenance>
sync: runs 40, mismatches 1, unexplained 1
git: runs 40, mismatches 0, unexplained 0
exit=1
$ git log -1 --format="%h %s"
ce5a4210 feat(evals): replay canonical sync and git V graders
```

Review (phiên Claude): grade-v.mjs nhập GRADERS gốc từ evals/sync/verify-run.mjs và evals/git/verify-run.mjs (không viết lại quyết định); 80/80 lượt V, 0 lệch; phản ví dụ đổi 1 verdict V bị bắt. Phạm vi đã thu về sync/git vì develop không có thước V (review log). Commit ce5a4210 chỉ 2 file, không ghi tên AI, chưa push. Thực thi: pane Codex.
