# Task 01 — Bản cài Codex từ chối ghi file trong phiên gọi rõ ask

Status: done

## Outcome
Hook Codex mới `ask-guard.cjs` bật cờ phiên khi prompt gọi rõ ask (luật khớp ở D-02), và khi cờ bật thì từ chối các lời gọi sửa file mà lượt dò thật cho thấy Codex 0.162 gửi tới `PreToolUse`, bằng exit 2 kèm lời nhắn chỉ sang `$cf-fix`; được đăng ký trong `hooks.json` của bộ cài thành nhóm riêng.

## Scope
- In:
  - Step 0 — lượt dò thật, trước khi viết hook: một hook ghi vết tạm (chỉ ghi `hook_event_name`, `tool_name`, `session_id`, và tên khoá của `tool_input`, KHÔNG ghi nội dung prompt hay file) đăng ký cho `UserPromptSubmit` và `PreToolUse` matcher `.*` trong một phòng thử tạm ngoài repo; chạy một lượt `codex exec --dangerously-bypass-hook-trust -s workspace-write -m gpt-6.1-sol` với prompt ca `ask/cam-sua`; lưu bản ghi vào `~/Desktop/cafekit-codex-eval/ask-guard/trace/`.
  - Điều kiện dừng (D-01, D-02): không thấy `PreToolUse` nào; hoặc thao tác sửa `src/greet.js` chỉ hiện dưới `tool_name` `exec` (không tách được khỏi shell); hoặc `session_id` của `UserPromptSubmit` khác `PreToolUse`; hoặc hook không ghi được thư mục tạm → DỪNG, đặt `blocked` với nguyên nhân, báo Bro, không viết hook.
  - Hook: xử lý `UserPromptSubmit` (bật/tắt cờ) và `PreToolUse` (từ chối khi cờ bật, với đúng các `tool_name` sửa file mà lượt dò ghi nhận); lưu cờ và `denials.jsonl` theo D-02 (ngoài dự án, `sha256(session_id)`, ghi nguyên tử); thiếu `session_id` hay lỗi đọc cờ thì KHÔNG chặn và ghi crash như `packages/spec/src/codex/hooks/inspect-block.cjs:39`; lời nhắn và `denials.jsonl` không chứa nội dung file, prompt hay bí mật (chỉ thời điểm, `sha256(session_id)`, `tool_name`).
  - Đăng ký trong `packages/spec/src/codex/hooks.json`: thêm vào `UserPromptSubmit` và một nhóm `PreToolUse` riêng có matcher liệt kê đúng các tên công cụ sửa file đã ghi nhận.
- Out: chặn lệnh shell; nhận biết ask ngầm; agent con; hook phía Claude; đổi skill gốc.

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/src/codex/hooks/ask-guard.cjs`, `packages/spec/bin/__tests__/codex-ask-guard.test.js`
- Modify: `packages/spec/src/codex/hooks.json`
- Read: `packages/spec/src/codex/hooks/inspect-block.cjs`, `packages/spec/src/codex/hooks/privacy-approval.cjs`, `packages/spec/src/codex/hooks/lib/hook-context.cjs`, `packages/spec/src/codex/hooks/lib/state-store.cjs`, `packages/spec/bin/phases/codex-hooks.js`

## Steps
1. Step 0 lượt dò thật (xem Scope); dừng nếu gặp điều kiện dừng.
2. Viết test trước, payload dựng theo bản ghi thật của Step 0, chạy trên bản cài vào thư mục `mkdtemp` riêng với `CAFEKIT_ASK_GUARD_DIR` riêng và `session_id` duy nhất: phiên ask từ chối; phiên khác cho phép; prompt kế tiếp không gọi ask tắt cờ (kể cả khi còn cờ cũ); thiếu `session_id` cho phép; `/cf:ask` từ chối; prompt "Đừng dùng $cf-ask …", ask trong khối code, `$cf-asker`, `$CF-ASK` không bật cờ; `session_id` dạng `../x` không ghi ra ngoài thư mục cờ; công cụ đọc (`Read`, lệnh đọc) cho phép; mỗi lần từ chối thêm đúng một dòng vào `denials.jsonl`; bản cài có `ask-guard` đăng ký dưới cả hai sự kiện.
3. Viết `ask-guard.cjs` cho tới khi test xanh; đăng ký trong `hooks.json`.
4. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-01: lượt dò thật có bản ghi `PreToolUse` cho lời gọi sửa file tách được khỏi shell; các trường hợp ở Step 2 cho đúng exit code; bản cài thật có hook đã đăng ký; self-test toàn gói xanh.

## Dependencies
- none

## Verification Plan
- Command: `test -f packages/spec/bin/__tests__/codex-ask-guard.test.js && test -f packages/spec/src/codex/hooks/ask-guard.cjs && node --test packages/spec/bin/__tests__/codex-ask-guard.test.js packages/spec/bin/__tests__/codex-hooks.test.js && pnpm --dir packages/spec test`
- Named probe: các test trong `codex-ask-guard.test.js` nêu ở Step 2; payload lấy theo `~/Desktop/cafekit-codex-eval/ask-guard/trace/`.
- Reachability: live — bản ghi Step 0 chứng minh Codex 0.162 gọi `PreToolUse` với `tool_name` đã dùng trong test; installed — test gọi hook đã cài qua bộ cài thật.
- Oracle: exit 0 và mọi test PASS; bản ghi Step 0 có ít nhất một `PreToolUse` với `tool_name` sửa file khác `exec`.
- Counterexample: trên bản sao tạm, bỏ nhóm `PreToolUse` của `ask-guard` khỏi `hooks.json` hoặc cho hook luôn exit 0 → test đỏ.
- Artifacts: `~/Desktop/cafekit-codex-eval/ask-guard/trace/` (ngoài repo, giữ làm bằng chứng); file tạm của test dọn trong test.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: test -f packages/spec/bin/__tests__/codex-ask-guard.test.js && test -f packages/spec/src/codex/hooks/ask-guard.cjs && node --test packages/spec/bin/__tests__/codex-ask-guard.test.js packages/spec/bin/__tests__/codex-hooks.test.js && pnpm --dir packages/spec test
Exit: 0
Base: 0f8f37008b0514cf1c71a70c8a7d88c310599fb8
Head: 01a904fcbe50f8f6362da2285b887bd3c46f45aa3c313bc9f86ebd76c9a34f56
```text
ok 1 - installed Codex ask guard follows the observed hook payloads
# tests 53
# pass 53
# fail 0
ok 1 - installed Codex ask guard follows the observed hook payloads
# tests 374
# pass 374
# fail 0
# tests 199
# pass 199
# fail 0
# tests 42
# pass 42
# fail 0
[skill-test] PASS: 1401 tests executed
```

Khối trên là các dòng tóm tắt lọc từ output của lần chạy (exit 0) do phiên Claude tự chạy sau commit 0f8f3700. Step 0 (live): trong ~/Desktop/cafekit-codex-eval/ask-guard/trace/, hook dự án chạy trong `codex exec --dangerously-bypass-hook-trust`; PreToolUse báo từng lời gọi lồng trong `exec` (`Bash`), băm session_id của UserPromptSubmit và PreToolUse khớp; lượt `edit-1` sửa src/greet.js với `tool_name` `apply_patch` (tool_input khoá `command`), tách khỏi shell. Phản ví dụ (bản sao tạm của packages/spec): bỏ nhóm PreToolUse của ask-guard khỏi hooks.json → exit 1 (pass 11, fail 2); cho hook luôn exit 0 → exit 1 (pass 7, fail 6). Giới hạn: test dùng payload theo bản ghi thật nhưng chạy hook bằng node; việc Codex tôn trọng exit 2 trên model thật thuộc task 02. Commit 0f8f3700 không ghi tên AI, chưa push.
