# Task 01 — Agent review/tra cứu trên Codex chạy read-only

Status: done

## Outcome
TOML của `brainstormer`, `code_auditor`, `inspector`, `researcher` có `sandbox_mode = "read-only"` và kết thúc `developer_instructions` bằng mục `## Read-only role` với câu `Read-only role: never create, never edit, and never delete files, and never run commands that write to disk; return findings in your reply.`.

## Scope
- In: `convertCodexAgentContent` (`bin/lib/codex-install.js:359-389`) thêm dòng `sandbox_mode = "read-only"` và mục `## Read-only role` cho đúng bốn agent của D-01; test; changelog. Probe Codex đã chạy 16/10 (Codex bỏ qua trường), kết quả ghi trong plan.
- Out: agent khác; `model`; chuyển `tools:` sang Codex.

## Coverage
- CP-01

## Ownership
- Modify: `bin/lib/codex-install.js` (chỉ `convertCodexAgentContent`), `bin/__tests__/codex-native.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`
- Read: `src/claude/agents/*.md`

## Steps
1. Thêm test vào `codex-native.test.js`: cài Codex vào thư mục tạm; bốn TOML có đúng một dòng `sandbox_mode = "read-only"` và `developer_instructions` kết thúc bằng mục `## Read-only role` chứa câu D-01; `implementer.toml`, `test_runner.toml`, `debugger.toml`, `git_ops.toml` không có `sandbox_mode` lẫn mục `## Read-only role`; ba khoá cũ còn nguyên. Chạy `node --test packages/spec/bin/__tests__/codex-native.test.js` trước khi sửa; ghi số ca đỏ.
2. Sửa `convertCodexAgentContent`; changelog.
3. Chạy Command.
4. (Probe Codex thật đã chạy 16/10; không chạy lại.)
5. Không commit.

## Acceptance
- AC-01: bốn TOML có đúng một dòng `sandbox_mode = "read-only"` và `developer_instructions` kết thúc bằng mục `## Read-only role` chứa câu D-01; bốn agent khác không có cả hai; Command xanh.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test mới về `sandbox_mode` và mục `## Read-only role`.
- Reachability: installer thật trên thư mục tạm.
- Oracle: Oracle chung của plan.
- Counterexample: bỏ mục `## Read-only role` → ca test đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: 04ac017ba8765f6af4f160d760156b7e859838c3
Head: 8949c0927658bcb337d87ca54fe640c167632745081e61034995415def1fc293

```text
ok 1 - installed brainstormer agent has exactly one read-only sandbox setting
ok 2 - installed code_auditor agent has exactly one read-only sandbox setting
ok 3 - installed inspector agent has exactly one read-only sandbox setting
ok 4 - installed researcher agent has exactly one read-only sandbox setting
ok 5 - installed implementation agents retain their sandbox defaults
# tests 41
# pass 41
# fail 0
# skipped 0
# todo 0
[skill-test] PASS: 2130 tests executed
```

- Đỏ trước sửa (Codex báo): 4/41, đúng bốn ca read-only.
- Vòng sửa 1: câu "do not create, edit, or delete files" làm đỏ ca brainstorm `specialist-boundary` (bộ dò coi "edit … files" sau dấu phẩy là không bị phủ định); controller đổi câu thành phủ định từng động từ, không sửa bộ dò.
- Counterexample (Codex báo): bỏ mục `## Read-only role` → 4 ca đỏ; khôi phục → xanh, khớp byte.
- Probe Codex thật (controller, 16/10, codex-cli 0.162.1, `CODEX_HOME` tạm đã xoá, `auth.json` không đổi): cả hai agent trả đúng token và có rollout thread con; `probe_ro` (có `sandbox_mode = "read-only"`) vẫn tạo được file ở cả biến thể cờ `--sandbox workspace-write` và `sandbox_mode` trong `config.toml` → Codex không cưỡng chế; Bro chọn giữ dòng + lời dặn (ghi trong plan).
- Review controller: diff 5 dòng ở `convertCodexAgentContent`, chỉ bốn agent; changelog nêu giới hạn. Commit 04ac017b.
