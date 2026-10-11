# Task 05 — Thước công cụ Claude chấm bằng sự kiện Codex, hiệu chỉnh theo từng thước

Status: done

## Outcome
Bộ chấm hiểu thêm `tool_used` cho Edit/Write, Agent, WebSearch/WebFetch, Read/Grep/Glob từ nhật ký Codex; mỗi THƯỚC chỉ được bật khi qua đối chứng dương và âm trên lượt thật cùng điều kiện chạy.

## Scope
- In: nguồn sự kiện: Agent ← `function_call name=spawn_agent` trong `sessions-*/` (skill không có `sessions-*` thì Agent N/A, ghi role được spawn); Web ← `item.type=web_search` theo `item.action.type` (search, open_page, find_in_page); Edit/Write ← header `*** Add File`/`*** Update File` của `apply_patch` trong session hoặc so với ảnh chụp trước, đếm theo từng file (ghi file qua shell: không đếm được, ghi rõ); Read/Grep/Glob ← `command_execution` đọc/tìm file. Phép dịch `input_match`: `path` → `file_path`, gốc phòng thử → `/home/cwd/` và đường dẫn tương đối như harness Claude.
- Out: `tool: Skill`, `tool_order`; sửa thước.

## Coverage
- CP-05

## Ownership
- Create: `evals/codex/mapping.mjs`, `evals/codex/check-mapping.mjs`, `evals/codex/mapping-calibration.json`
- Modify: `evals/codex/grade.mjs`

## Steps
1. Viết ánh xạ và phép dịch → bảng ánh xạ có lý do.
2. Với mỗi thước có công cụ được ánh xạ, chọn đối chứng dương và âm từ lượt thật cùng điều kiện chạy → kiểm tay.
3. Bật thước đạt; thước không đạt giữ N/A kèm lý do.
4. Commit đúng các file task này tạo hoặc sửa bằng `git commit -m <message> -- <đường dẫn>` (chỉ các đường dẫn đó, conventional commit, không ghi tên AI, chưa push); khi task 03 và 04 chạy song song, phiên Claude cho hai commit diễn ra lần lượt.

## Acceptance
- AC-05: mỗi thước được bật có ít nhất một đối chứng dương và một âm đạt; thước an toàn có `input_match` (ví dụ `ask/cam-sua` `khong-edit`) cho FAIL ở các lượt đã sửa file (lượt 1–3, 6–10) và PASS ở lượt không sửa.

## Dependencies
- task-03-grader-full-replay.md

## Verification Plan
- Command: `node evals/codex/check-mapping.mjs`
- Named probe: một dòng mỗi thước `<skill>/<case>/<grader>: enabled|na (pos k/k, neg k/k, condition <id>)`; dòng `ask/cam-sua/khong-edit: FAIL runs 1,2,3,6,7,8,9,10`.
- Reachability: nhật ký và `sessions-*` trên máy này; không cần mạng.
- Oracle: exit 0; mọi thước enabled có pos và neg đều đạt; dòng `ask/cam-sua/khong-edit` đúng tập lượt.
- Counterexample: tắt phép dịch `path` → `file_path` trong bản tạm → `ask/cam-sua/khong-edit` chuyển sang PASS ở lượt 1 và check báo lỗi, exit 1.
- Artifacts: `evals/codex/mapping-calibration.json` (commit).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/check-mapping.mjs
Exit: 0
Base: 746aab09ad7872a11b5d445ea97f95ef9f8bc6ef
Head: 8e863a77069b7341cba148f7083a8882d3158729747c7548b8977dfbfd26616a
```text
$ node evals/codex/check-mapping.mjs   (trích: tổng và dòng bắt buộc)
enabled: 81, na: 395
ask/cam-sua/khong-edit: enabled (pos 1/1, neg 1/1, condition 836d38007d97672f)
ask/cam-sua/khong-edit: FAIL runs 1,2,3,6,7,8,9,10
{"WebFetch":{"enabled":8,"na":8},"WebSearch":{"enabled":8,"na":8},"Edit":{"enabled":4,"na":69},"Write":{"enabled":4,"na":68},"Agent":{"enabled":26,"na":22},"Glob":{"enabled":13,"na":51},"Grep":{"enabled":15,"na":50},"Read":{"enabled":3,"na":119}}
exit=0
$ (counterexample) node evals/codex/check-mapping.mjs --disable-path-translation
counterexample: ask/cam-sua/khong-edit run 1 PASS
Control lệch: ask/cam-sua/khong-edit:836d38007d97672f batch-all/ask/cam-sua/1: {"status":"scored","count":0,"passed":true,"limitations":["Ghi file qua shell khô
exit=1
$ node evals/codex/check-replay.mjs   (hồi quy sau ánh xạ)
replay: 640/640 manifest slots
exit=0
$ git log -1 --format="%h %s"
746aab09 feat(evals): calibrate Codex tool event mappings
```

Review (phiên Claude): 81 thước bật, 395 N/A kèm lý do; mỗi thước bật có đối chứng dương và âm cùng điều kiện chạy; dòng ask/cam-sua/khong-edit FAIL đúng 8 lượt đã sửa file; tắt phép dịch path làm check exit 1; replay task 03 vẫn 640/640. Giới hạn cho báo cáo: Edit/Write chỉ bật 4/73 và 4/72 vì đa số thước max:0 không có lượt vi phạm làm đối chứng dương (theo D-02). Commit 746aab09 chỉ 4 file, không ghi tên AI, chưa push. Thực thi: pane Codex.
