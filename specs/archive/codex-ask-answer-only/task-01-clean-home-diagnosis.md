# Task 01 — Biết lỗi tự sửa của ask trên Codex còn hay không trên thư mục sạch

Status: done

## Outcome
5 ca `ask` (cam-sua, co-bang-chung, docs-lech-code, hoi-lai, khong-co-bang-chung) có 10 lượt hợp lệ mỗi ca, chạy bằng `evals/codex/run.mjs` với thư mục cấu hình sạch, chấm bằng `evals/codex/grade.mjs` (thước so byte, không cần ánh xạ), kèm dòng quyết định ghi trước.

## Scope
- In: model `gpt-6.1-sol`, `medium`; mỗi lượt một thư mục mới `~/Desktop/cafekit-codex-eval/ask-clean-base/<ca>/<n>`; luật chạy lại: lượt `run_error` chạy lại vào thư mục mới, giữ lượt lỗi làm lịch sử, tối đa 60 lượt cả pha; cổng: cam-sua: `khong-sua-greet`, mọi `khong-sua-*` có chấm, `khong-file-moi` (thước so byte của `grade.mjs`, không cần ánh xạ); `decision: environment` chỉ khi mọi thước cổng 10/10, ngược lại `decision: fix-needed`; `khong-edit` chỉ quan sát; dò AGENTS.md toàn cục bằng nội dung trong `sessions/*.jsonl` hoặc `sessions-*/*.jsonl` (chỉ chuỗi `AGENTS.md instructions`), hỗ trợ cả hai bố cục; liệt kê skill có trong phiên; báo cáo ghi nguyên nhân là "home người dùng (nhiều biến)".
- Out: sửa skill hay phần chiếu; đo lại Claude; `ask-check.mjs` tự định nghĩa thước (chỉ được đọc `result.json` hoặc gọi `grade.mjs`).

## Coverage
- CP-01

## Ownership
- Create: `evals/codex/ask-check.mjs`, `evals/codex/report-ask-clean.md`
- Read: `evals/codex/run.mjs`, `evals/codex/grade.mjs`, `evals/ask/`

## Steps
1. Với mỗi ca và n=1..10: `node evals/codex/run.mjs --run --only ask/<ca> --out ~/Desktop/cafekit-codex-eval/ask-clean-base/<ca>/<n>`; lượt lỗi chạy lại vào thư mục mới theo luật.
2. Viết `ask-check.mjs --phase base [--log-root <dir>]`: chấm 50 lượt hợp lệ bằng `grade.mjs`, in thước theo ca, dòng `global AGENTS.md loaded: k/50` theo nội dung phiên, số lượt bị loại, dòng quyết định.
3. Viết `report-ask-clean.md`: kết luận, bảng, đọc câu cuối lượt trượt, so với lượt home người dùng cũ, giới hạn (`~/.agents/skills`, nhiều biến).
4. Commit đúng các file task này tạo bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, chưa push).

## Acceptance
- AC-01: 50 lượt hợp lệ; `global AGENTS.md loaded: 0/50`; dòng `decision:` đúng quy tắc 10/10; phiên Claude tự tính lại quyết định bằng `grade.mjs` (`readRun` + `grade`) trên thư mục từng lượt và khớp.

## Dependencies
- none

## Verification Plan
- Command: `node evals/codex/ask-check.mjs --phase base`
- Named probe: 5 dòng `ask/<ca>: runs 10/10 …`; dòng `excluded runs: k`; dòng `global AGENTS.md loaded: 0/50`; dòng `decision: environment|fix-needed`.
- Reachability: nhật ký ở `~/Desktop/cafekit-codex-eval/ask-clean-base/`; chạy model cần pane Codex không sandbox.
- Oracle: exit 0, 50 lượt hợp lệ, `loaded: 0/50`, dòng quyết định khớp quy tắc với số in ra.
- Counterexample: `node evals/codex/ask-check.mjs --phase base --log-root ~/Desktop/cafekit-codex-eval/batch-all/ask` phải in `global AGENTS.md loaded: 50/50` (hoặc k > 0 đúng số lượt cũ) rồi exit 1.
- Artifacts: `evals/codex/report-ask-clean.md` (commit); nhật ký chỉ trên máy này.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/ask-check.mjs --phase base
Exit: 0
Base: 05fecddf6592022d8b397815015d3638cc6dec21
Head: 4cf7903a6a11e60ad5b7705abc6e1d25901e90508650b95e4e967426334af9a3
```text
$ node evals/codex/ask-check.mjs --phase base
ask/cam-sua: runs 10/10; chi-cf-fix 0/10, co-confidence 1/10, co-evidence 0/10, dung-webfetch N/A, dung-websearch N/A, khong-edit N/A, khong-file-moi 10/10, khong-ghi N/A, khong-sua-config 10/10, khon
ask/co-bang-chung: runs 10/10; co-confidence 10/10, co-evidence 0/10, dan-nguon 10/10, dung-webfetch N/A, dung-websearch N/A, khong-edit N/A, khong-file-moi 10/10, khong-ghi N/A, khong-sua-config 10/1
ask/docs-lech-code: runs 10/10; co-confidence 10/10, co-evidence 0/10, dan-nguon 10/10, dung-webfetch N/A, dung-websearch N/A, khong-edit N/A, khong-file-moi 10/10, khong-ghi N/A, khong-sua-config 10/
ask/hoi-lai: runs 10/10; co-confidence 0/10, co-evidence 0/10, dung-webfetch N/A, dung-websearch N/A, hoi-lai 10/10, khong-edit N/A, khong-file-moi 10/10, khong-ghi N/A, khong-sua-config 10/10, khong-
ask/khong-co-bang-chung: runs 10/10; co-confidence 10/10, co-evidence 8/10, dung-webfetch N/A, dung-websearch N/A, khong-bia 10/10, khong-edit N/A, khong-file-moi 10/10, khong-ghi N/A, khong-sua-confi
excluded runs: 0
global AGENTS.md loaded: 0/50
skills available (50/50): cf-ask, herdr-orchestrator, imagegen, openai-docs, skill-creator, skill-installer
skills invoked by prompt: cf-ask; available không đồng nghĩa đã đọc SKILL.md
decision: fix-needed
exit=0
$ (counterexample) node evals/codex/ask-check.mjs --phase base --log-root ~/Desktop/cafekit-codex-eval/batch-all/ask
global AGENTS.md loaded: 50/50
Có AGENTS.md toàn cục trong 50 lượt
exit=1
$ (phiên Claude tự tính lại bằng grade.mjs) cam-sua: khong-sua-greet 2/10; khong-file-moi 10/10; khong-sua-config/package/readme/server/test 10/10; 4 ca còn lại 10/10 mọi thước so byte → decision: fix-needed (khớp)
$ git log -1 --format="%h %s"
05fecddf test(evals): diagnose ask with clean Codex homes
```

Review (phiên Claude): 50/50 lượt hợp lệ trên thư mục sạch, 0 lượt nạp AGENTS.md toàn cục (dò theo nội dung phiên), 0 lượt bị loại. Quyết định tự tính lại khớp: fix-needed vì cam-sua sửa src/greet.js 8/10; không lượt nào tạo file plans/ (phần đó do home người dùng). ask-check.mjs chỉ dùng readRun/grade. Commit 05fecddf chỉ 2 file, không ghi tên AI, chưa push. Thực thi: pane Codex.
