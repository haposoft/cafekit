---
title: "Giao việc: áp GATE-REVIEW cho specs/fix-repair"
status: handoff
created: 2026-10-01
---

# Giao việc: áp GATE-REVIEW cho `specs/fix-repair`

Worktree này (`../cafekit-fix-fix-repair`, nhánh `fix/fix-repair` từ `dev` 2f5dfef) chỉ dành cho gói `specs/fix-repair`. Gói brainstorm đang chạy song song ở worktree `cafekit` gốc — không đụng tới nó.

## Đã quyết (của user, không hỏi lại)
- GATE-SCOPE (01/10): KEEP; để nguyên lời gọi cf:debug/cf:scout; chấp nhận claude 2.1.286 + node v22.23.3 so với baseline 2.1.281 + node 20 (Known limit); trần $60. Đã ghi trong `plan.md`.
- GATE-REVIEW (01/10): 3 reviewer mới (facts+contracts; failure-mode+proof; assumptions+scope), gộp còn 15 phát hiện. User **nhận cả 15**; G-08 chọn **(a)**.

## 15 phát hiện cần áp
| ID | Mức | Sửa |
|---|---|---|
| G-01 | Critical | Command task 03 không chạy lại `verify-run-log` trên 8 ô (thư mục tạm `/private/tmp` mất khi reboot): ngay sau mỗi ô, lưu output verify vào `evals/results/fix/sau-<case>-<model>/verify-run-log.txt`; Command chỉ grep `disagreements=0` từ các file đó |
| G-02 | Critical | Lượt trả phí ra khỏi Command (`run.sh` từ chối ghi đè, `evals/run.sh:110-113`): Step 3 chạy đủ 8 ô; Command task 03 chỉ đọc (verify files, `compare-fix.mjs`, version scan, budget, pilot checks) |
| G-03 | High | Gate cho Quick lint/type: thêm câu "For a lint, type, syntax, or build failure, the exact failing check run on the unchanged code stands in for the test."; fallback đổi thành "If no automated test or check can reproduce the failure, say so" |
| G-04 | High | Kỳ vọng Fisher 10/10 vs 0/10 là `0.00001083` (không phải `1.083e-5`; xem `evals/compare-code-review.mjs:132`) |
| G-05 | High | Thêm `export PATH=/opt/homebrew/opt/node@22/bin:$PATH` ở mọi lệnh đo; kiểm `claude --version`/`node --version` cả trước và sau mỗi ô; D-05 thêm: ô bị cắt ngang cất `-reboot`, ô lệch phiên bản cất `-ver`, chạy lại một lần, chi phí vẫn tính, run không vào count; version scan bỏ qua/báo riêng thư mục thiếu `result.json` |
| G-06 | High | `--max-cost-usd` bằng đúng mức `check` (pilot 2, ô 6); budget cộng cả `judgeCostUsd` từng run; `spent` exit 1 khi vượt cap; mọi thư mục cất riêng phải mang tiền tố `sau-` để budget thấy; quy định cách in số (`spent=0` khi rỗng) |
| G-07 | Medium | Step 2 (cf:debug chỉ đọc, `debug/SKILL.md:37-38`): câu nối thành "When an existing test already fails for the diagnosed reason, its run belongs to this baseline; otherwise the regression test is written and seen failing at the start of Step 4 under `HARD-GATE-RED-BEFORE-FIX`." |
| G-08 | Medium | (a) Mở phạm vi đúng 2 dòng `packages/spec/src/claude/skills/fix/references/prevention-gate.md:15-16` cho khớp gate (test đỏ trên code gốc trước khi sửa tính là guard này; đỏ tạo bằng cách gỡ fix sau đó không tính); thêm pin + mutation |
| G-09 | Medium | Pin + mutation cho câu depth (`SKILL.md:34`), Step 2, câu Quick của Step 4, và vắng mặt cụm `regression test that fails without the fix and passes with it`; cập nhật số `rejects N` cho đúng |
| G-10 | Medium | Oracle task 02: mọi dòng `grader=` phải khớp `base=[0-9]+/10 after=[0-9]+/10`; dòng `cell=red-truoc-sonnet grader=do-truoc` có `base=1/10` |
| G-11 | Medium | Known limits: với 10 lượt/bên chỉ bước nhảy lớn mới có ý nghĩa (1→5 p=0.141; 1→7 p=0.0198; 3→8 p=0.0698), 6 ô đã ở trần 8–10/10; thước theo dõi hồi quy nêu ở GATE-DONE: `sua-dung`, `xanh-sau`, `test-giu-nguyen`, `import-test-giu-nguyen`, `gon-gang-llm`; `do-truoc` chỉ đòi file test đổi ở `red-truoc`/`cham-hop-dong`; test mới thiếu `require("./_runs")` làm `do-truoc` đếm thấp |
| G-12 | Medium | Command task 01: chạy `node --test` một lần với `--test-reporter=tap` và log ra file; ghi rõ chạy nền (runner ~12 phút) |
| G-13 | Medium | Command task 03 kiểm 8 pilot cụ thể (`partial:false`, không run nào `error`) và tổng thư mục `sau-*` ≥ 16; ô vẫn partial sau khi chạy lại → dừng hỏi user, task `blocked` |
| G-14 | Low | Guard băm cả thư mục `skills/fix`, `skills/debug`, `skills/scout` (task 01 in digest thư mục, task 03 grep); Command task 03 kiểm task 01/02 có `Status: done` |
| G-15 | Low | Câu gate không gọi tên công cụ trong backtick (Codex đổi `Edit`/`Write` thành `apply_patch`, `packages/spec/bin/lib/codex-install.js:37`): "(an edit, a file write, or a shell command that rewrites it)"; đổi anchor mutation tương ứng |

Thêm: trích dẫn `evals/run.sh:63-64` → `:64`, `:69`. Phát hiện "gói thứ hai đang mở" đã được giải bằng worktree riêng này — ghi một dòng vào Review log, không còn là rủi ro của gói.

## Việc cần làm
1. Áp 15 phát hiện vào `specs/fix-repair/` (plan + 3 task), đúng theo `.claude/skills/specs/references/review.md` (B3 consistency sweep: đọc lại mọi file, tìm cả cách viết cũ, đối chiếu bảng task / AC / Command).
2. Ghi Review log: GATE-REVIEW round 1 với quyết định của user.
3. Chạy một closure pass với một reviewer mới (code-auditor, chỉ đọc, phép thử âm trên bản sao `mktemp -d`), bảng `| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |` vào Review log. Đây là vòng giấy thứ hai và cuối (B4).
4. Phát hiện mới từ closure → trình user ở GATE-REVIEW round 2, không tự áp.
5. Khi mọi phát hiện PASS: suy lại Status (task 01, 02 → `pending`; task 03 `pending` với phụ thuộc). Dừng lại, báo user. **Không** chạy `/cf:develop`.

Trả lời user bằng tiếng Việt, gọi user là "Bro".
