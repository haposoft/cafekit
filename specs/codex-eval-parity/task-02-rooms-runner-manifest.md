# Task 02 — Phòng thử, runner và manifest lượt chuẩn trong `evals/codex/`

Status: done

## Outcome
`evals/codex/` có: bộ dựng phòng thử (scaffold của ca + output bộ cài Codex thật), runner `codex exec` theo `plans/20261008-codex-regrade/conventions.md` (CODEX_HOME tạm sạch, cấu hình C cho agent, lượt 0 lệnh không tự là lỗi), và `manifest.json` có commit ghi thư mục lượt chuẩn và luật chọn slot cho từng skill.

## Scope
- In: gộp logic phòng thử/runner từ `plans/20261008-codex-regrade/*.cjs` và `~/Desktop/cafekit-codex-eval/**/controller-*`; manifest: thư mục gốc chuẩn (ví dụ research → `batch-all-B`, fix → `batch-all-C`), chỉ slot dạng số, loại `*.attempt-*`/`*.replacement-history-*`, chọn file kết quả chuẩn (`result-regraded-*.json` nếu có, không dùng `result.before-5d.json`); điều kiện chạy của từng skill (runner SHA, cấu hình, home sạch hay không); chép số gốc Claude đã khoá vào `evals/codex/fixtures/baselines.json`.
- Out: bộ chấm (task 03, 04), chạy model.

## Coverage
- CP-02

## Ownership
- Create: `evals/codex/room.mjs`, `evals/codex/run.mjs`, `evals/codex/manifest.json`, `evals/codex/fixtures/baselines.json`, `evals/codex/check-rooms.mjs`, `evals/codex/README.md`
- Read: `plans/20261008-codex-regrade/`, `~/Desktop/cafekit-codex-eval/`

## Steps
1. Đọc các report và thư mục `controller-*` → bảng thư mục chuẩn, luật slot, điều kiện chạy cho 12 skill.
2. Viết manifest và bộ dựng phòng thử → 68 phòng dựng được không gọi model.
3. Viết `check-rooms.mjs` → dựng 68 phòng, kiểm manifest không trùng/thiếu slot, đủ 10 slot mỗi ô đã chạy.
4. Commit đúng các file task này tạo hoặc sửa bằng `git commit -m <message> -- <đường dẫn>` (chỉ các đường dẫn đó, conventional commit, không ghi tên AI, chưa push); khi task 03 và 04 chạy song song, phiên Claude cho hai commit diễn ra lần lượt.

## Acceptance
- AC-02: 68 phòng dựng được; manifest có đúng 12 skill, không slot trùng hoặc thiếu; README ghi giới hạn "nhật ký chỉ có trên máy này".

## Dependencies
- task-01-commit-0182-candidate.md

## Verification Plan
- Command: `node evals/codex/check-rooms.mjs`
- Named probe: dòng `rooms: 68/68`; dòng `manifest: 12 skills, duplicate slots 0, missing slots 0`.
- Reachability: nhật ký ở `~/Desktop/cafekit-codex-eval/`; không cần mạng.
- Oracle: exit 0 và hai dòng trên đúng số.
- Counterexample: thêm vào bản chép tạm của manifest một slot trỏ tới `6.attempt-*` → check báo slot không hợp lệ, exit 1.
- Artifacts: `evals/codex/manifest.json`, `evals/codex/fixtures/baselines.json` (commit).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/check-rooms.mjs
Exit: 0
Base: e28e6068955ae7562659f0a34dc74e2f00892c26
Head: 14e297d920a2640040807639e783f3b9bceda3efbdaef650bbdd0586c2835a88
```text
$ node evals/codex/check-rooms.mjs
rooms: 68/68
manifest: 12 skills, duplicate slots 0, missing slots 0
exit=0
$ (counterexample) node evals/codex/check-rooms.mjs --manifest <bản chép có slot ask/hoi-lai/6.attempt-1791477911508>
Slot không hợp lệ: batch-all/ask/hoi-lai/6.attempt-1791477911508
Thiếu 1 slot
exit=1
$ git log -1 --format="%h %s"
e28e6068 feat: add canonical evaluation rooms and manifest
```

Review (phiên Claude): manifest 12 skill, 640 slot chuẩn (research=batch-all-B, fix=batch-all-C), điều kiện chạy ghi theo skill/slot (vòng sửa 1: điều kiện hỗn hợp có bằng chứng thay cho đòi home sạch mọi slot); README ghi giới hạn nhật ký chỉ trên máy này; commit e28e6068 chỉ 6 file của task, không ghi tên AI, chưa push. Thực thi: pane Codex.
