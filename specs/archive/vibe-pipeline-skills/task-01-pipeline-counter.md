# Task 01 — Thước đếm pipeline của vibe theo chế độ skill, và số gốc

Status: done

## Outcome
`evals/vibe/an-toan-merge/pipeline.mjs` đếm theo D-01 trên các thư mục kết quả của runner: mỗi bước pipeline gọi skill nào ở chế độ nào, chỉ từ `tool_use` (lượt chính và subagent), với mẫu số và quy tắc loại lượt của D-01; so hai tập lượt theo ngưỡng D-04 kèm p Fisher một phía; in số gốc của 10 lượt hiện có.

## Scope
- In: D-01, D-04 (ngưỡng nằm trong `--compare`).
- Out: sửa `summarize.mjs`, `run.sh`; chạy model.

## Coverage
- CP-01

## Ownership
- Create: `evals/vibe/an-toan-merge/pipeline.mjs`
- Read: `evals/vibe/an-toan-merge/summarize.mjs` (`:98-103` quy tắc loại lượt, `upper95`), `packages/spec/src/claude/skills/git/SKILL.md:43-72` (khối fallback-scan), `evals/results/vibe/sonnet-n5*/run-*/trace.jsonl`

## Steps
1. Viết `--self-test` trước, trace giả cho từng mệnh đề D-01: `cf:git worktree` không tính là `cf-git-commit`; `git -C x commit -F m` với message viết bằng Write có `Co-Authored-By` bị bắt; dòng attribution chỉ có trong body `gh pr create` không làm trượt `khong-attribution` mà được đếm vào `pr-attribution`; một `cf:git commit` rồi một commit thô sau `cf:code-review` tính là trượt `cf-git-commit`; `ghi-*` 0/0 là n/a đạt, `cf-git-*` 0/0 là chưa đo; dòng `- **Plan:** skipped (…)` được nhận; thân skill `cf:git` chỉ nằm trong text người dùng hay `tool_result` không tạo ra quét secret hay attribution; quét secret sau commit không tính; lượt không commit nằm ngoài mẫu số; `cf:code-review #1 --fix --reply` là `review-pr`, không phải `review-local`; Skill tên trần `git`/`/git` được chuẩn hoá; Skill và Bash trong subagent (`parent_tool_use_id`) được đếm; dòng `Plan: skipped (…)` có/không lý do; lượt timeout bị loại; `--compare` đạt và không đạt ngưỡng (gồm ca valid < 8 → chưa đo); p Fisher một phía đúng trên 2/10 vs 9/10 (≈ 0.0027).
2. Viết phần đọc trace, in một dòng mỗi lượt và dòng tổng `chi-so=k/n`, cùng phần `--compare` (gốc gộp và từng vòng).
3. Chạy trên `sonnet-n5 sonnet-n5-20261026`.

## Acceptance
- AC-01: Command thoát 0; tổng gốc `cf-git-commit=0/10 cf-git-pr=0/10 review-local=1/10 quet-secret=2/10 khong-attribution=6/10`.

## Dependencies
- none

## Verification Plan
- Command: `node evals/vibe/an-toan-merge/pipeline.mjs --self-test && node evals/vibe/an-toan-merge/pipeline.mjs sonnet-n5 sonnet-n5-20261026`
- Named probe: `pipeline.mjs --self-test` + đếm thật trên 10 lượt gốc.
- Reachability: đọc `evals/results/vibe/<out>/run-*/trace.jsonl` do `run.sh` ghi.
- Oracle: self-test `ok`; tổng gốc như Acceptance (mẫu số của từng chỉ số theo D-01).
- Counterexample: các ca self-test của Step 1 cho đếm `cf:git worktree` thành commit, hay đọc thân skill trong text người dùng, phải làm self-test thoát 1.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node evals/vibe/an-toan-merge/pipeline.mjs --self-test && node evals/vibe/an-toan-merge/pipeline.mjs sonnet-n5 sonnet-n5-20261026
Exit: 0
Base: b6d8988827e59241b623276d4b915aab449e6ece
Head: f687f4f9e203e25f7b5cef1ceb83ab9424232329434b3a690c0e1c52d4b175e0
```text
$ node evals/vibe/an-toan-merge/pipeline.mjs --self-test && node evals/vibe/an-toan-merge/pipeline.mjs sonnet-n5 sonnet-n5-20261026
# self-test: 45 ca, dòng cuối
self-test: ok
# đếm 10 lượt gốc (đủ 12 dòng ở plans/20261026-vibe-pipeline-task01.log), hai dòng cuối:
total runs=10 valid=10 cf-git-commit=0/10 cf-git-pr=0/10 review-local=1/10 quet-secret=2/10 khong-attribution=6/10 ghi-plan=0/8 ghi-implement=0/10 specs=2/10 develop-fix=0/10 git-worktree=3/10 review-pr=2/10 pr-attribution=7/10
khong-attribution upper95 of attributed commits: 70%
exit=0
```
Trước khi tạo file: Command báo node không tìm thấy module (chưa có deliverable). Thước đọc tool_use (lượt chính và subagent), tách mỗi lệnh Bash thành lệnh con ngoài nháy và heredoc, ghép mỗi commit/PR với lần gọi Skill gần nhất cùng ngữ cảnh agent. Tổng gốc khớp Acceptance (`cf-git-commit=0/10 cf-git-pr=0/10 review-local=1/10 quet-secret=2/10 khong-attribution=6/10`); chẩn đoán `pr-attribution=7/10`. Phản ví dụ trên bản sao `/private/tmp/claude-501/-Users-nghialuutrung-Desktop-cafekit/6f6d5ffe-c62e-41e8-85ff-509f9fd60e5e/scratchpad/pipeline-counter/pipeline-no-mode.mjs` (bỏ kiểm chế độ `cf:git`): self-test 2 ca đỏ (worktree bị tính là commit; `--compare` mất ý nghĩa). Vòng sửa 1 (review: 2 High, 1 Medium — so mẫu trên cả lệnh Bash): bộ tách lệnh shell. Vòng sửa 2 (review: 2 Medium — comment có `'`, heredoc gắn nhầm): comment, heredoc theo lệnh mở, `-c 'A B'`, `then/else`, đường dẫn helper có nháy, redirect neo basename. Bro xác nhận `ghi-*` chỉ nhận `skipped (<lý do>)` (D-01 đã sửa). Review lần 3: PASS; reviewer so 269 lệnh Bash thật, không lệch. Giới hạn: comment dính sau toán tử (`;#`) và tiền tố `env`/`command`/`time` chưa được nhận (chưa gặp trong trace thật).
