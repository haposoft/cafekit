# Task 03 — Bộ chấm gộp chấm lại toàn bộ lượt chuẩn

Status: done

## Outcome
`evals/codex/grade.mjs` chấm regex (last_message/file/files), file_exists và Bash theo quy ước đã chốt (`flags`, `match: not_contains`, `target: files` = file mới so với ảnh chụp trước khi gọi model, nhiều `agent_message`), và chấm lại TOÀN BỘ lượt chuẩn trong manifest.

## Scope
- In: chấm lại mọi lượt chuẩn của 12 skill; so với file kết quả chuẩn; mỗi lệch có chủ đích nêu quy ước gây ra nó (ví dụ test cũ coi lượt 0 lệnh là run_error).
- Out: thước V (task 04), ánh xạ công cụ mới (task 05); thước `type: llm` (giữ N/A, không có giám khảo).

## Coverage
- CP-03

## Ownership
- Create: `evals/codex/grade.mjs`, `evals/codex/check-replay.mjs`
- Read: `evals/codex/manifest.json`, các `graders*.cjs` và `controller-*` đã dùng

## Steps
1. Gộp bộ chấm → một hàm chấm mọi loại thước trong phạm vi.
2. Chấm lại toàn bộ lượt chuẩn → bảng lệch theo skill.
3. Với mỗi lệch, ghi nguyên nhân hoặc sửa bộ chấm cho khớp quy ước.
4. Commit đúng các file task này tạo hoặc sửa bằng `git commit -m <message> -- <đường dẫn>` (chỉ các đường dẫn đó, conventional commit, không ghi tên AI, chưa push); khi task 03 và 04 chạy song song, phiên Claude cho hai commit diễn ra lần lượt.

## Acceptance
- AC-03: mọi lượt chuẩn được chấm lại; số lệch theo skill được in; mỗi lệch có nguyên nhân; lệch không giải thích được = 0.

## Dependencies
- task-02-rooms-runner-manifest.md

## Verification Plan
- Command: `node evals/codex/check-replay.mjs`
- Named probe: một dòng mỗi skill `<skill>: runs N, mismatches M, unexplained 0`.
- Reachability: manifest và nhật ký trên máy này; không cần mạng.
- Oracle: exit 0, 12 skill, mọi dòng `unexplained 0`, tổng runs bằng tổng slot trong manifest.
- Counterexample: đổi một verdict trong bản chép tạm của kết quả chuẩn → dòng skill đó báo `unexplained 1`, exit 1.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/check-replay.mjs
Exit: 0
Base: a3917fe16cece50f587364e32975b4412a98995e
Head: 48adee30849a0283544374541131d6226c64552c86388d710941608de89a2c1b
```text
$ node evals/codex/check-replay.mjs
ask: runs 50, mismatches 0, unexplained 0
brainstorm: runs 20, mismatches 0, unexplained 0
code-review: runs 100, mismatches 0, unexplained 0
debug: runs 40, mismatches 0, unexplained 0
develop: runs 20, mismatches 0, unexplained 0
fix: runs 40, mismatches 0, unexplained 0
git: runs 40, mismatches 0, unexplained 0
research: runs 80, mismatches 0, unexplained 0
scout: runs 10, mismatches 0, unexplained 0
specs: runs 100, mismatches 0, unexplained 0
sync: runs 40, mismatches 0, unexplained 0
test: runs 100, mismatches 0, unexplained 0
replay: 640/640 manifest slots
exit=0
$ (counterexample) node evals/codex/check-replay.mjs --results-root <bản chép kết quả, đổi verdict batch-all/develop/mot-task-hong/1 co-blocker>
develop: runs 20, mismatches 1, unexplained 1
replay: 640/640 manifest slots
exit=1
$ git log -1 --format="%h %s"
a3917fe1 feat: add canonical grader replay checks
```

Review (phiên Claude): bộ chấm tái tính từ nhật ký thật (readRun) rồi so verdict đã lưu, không dùng verdict lưu làm đầu vào; có hồ sơ runner cũ để giải thích lệch theo quy ước; 640/640 lượt, 0 lệch; phản ví dụ đổi 1 verdict bị bắt. Commit a3917fe1 chỉ 2 file, không ghi tên AI, chưa push. Thực thi: pane Codex.
