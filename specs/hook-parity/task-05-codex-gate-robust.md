# Task 05 — Codex inspect, rules, guardrail

Status: done

## Outcome
Inspect và rules của Codex vẫn chạy khi `paths.specs` cấu hình sai; guardrail secret chạy được cả từ source.

## Scope
- In:
  - `src/codex/hooks/inspect-block.cjs` dùng `readRuntime(PROJECT_ROOT)` + `resolveSessionCwd` như `src/codex/hooks/privacy-block.cjs:15-22`, không dùng `getHookContext`.
  - `src/codex/hooks/rules.cjs`: không dùng `getHookContext`; đọc runtime trước khi giữ chỗ (`:73-76`), runtime vắng → không giữ chỗ.
  - Shim `src/codex/hooks/lib/secret-keywords.cjs` đã có từ task-03; require trong `secret-output-guardrail.cjs` chuyển vào `try`.
  - Changelog.
- Out: privacy-block Codex (đã đúng); session Codex (task-06).

## Coverage
- CP-05

## Ownership
- Modify: `src/codex/hooks/inspect-block.cjs`, `src/codex/hooks/rules.cjs`, `src/codex/hooks/secret-output-guardrail.cjs`, `bin/__tests__/codex-hooks.test.js`, `bin/__tests__/codex-quiet-hooks.test.js`, `bin/__tests__/orca-session.test.js` (chỉ fixture chép lib), hai changelog

## Steps
1. Thêm test vào `codex-hooks.test.js`:
   - runtime có `paths.specs: "../outside"` và Read vào thư mục bị chặn → inspect exit 2 (đang 0);
   - cùng runtime, rules với `session_id` mới → có rules (đang im);
   - rules khi chưa có runtime → im lặng; ghi runtime rồi chạy lại cùng `session_id` → có rules;
   - chạy `src/codex/hooks/secret-output-guardrail.cjs` từ source với prompt có từ khoá secret → exit 0 và in nhắc (regression guard: shim có từ task-03); trên layout thiếu lib → exit 0, không stack.
   Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; changelog.
3. Chạy Command; `node --test packages/spec/bin/__tests__/codex-quiet-hooks.test.js packages/spec/bin/__tests__/orca-session.test.js`; self-test.
4. Không commit.

## Acceptance
- AC-05: các ca trên đúng; test Codex cũ xanh; self-test exit 0.

## Dependencies
- task-04-claude-session-compact.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên mô tả hành vi.
- Reachability: hook chạy bằng `spawnSync` trên layout `.codex` hoặc từ source như test hiện có.
- Oracle: exit 0, `# fail 0`.
- Counterexample: khôi phục `getHookContext` ở inspect → ca `paths.specs` đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js`
Exit: 0
Base: 9bbbd089c71633e58a7af6bac8be684fd3640c70
Head: 969c90f216676a0a7136548839ac336367cad06769637e630a9771bafbe3b1a1

```text
ok 22 - Codex inspect still denies blocked reads when the configured specs path escapes
ok 23 - Codex rules still inject when the configured specs path escapes
ok 24 - Codex rules wait for runtime before reserving the same session
ok 25 - Codex secret guardrail runs from source with its shared keyword shim
ok 26 - Codex secret guardrail fails open without a keyword library or a stack
# tests 58
# pass 58
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): 4 fail / 58; ca guardrail từ source xanh sẵn (regression guard, shim có từ task-03).
- Counterexample (Codex báo): khôi phục `getHookContext` ở inspect → ca specs thoát root đỏ; đã hoàn tác, file khớp byte.
- Lệnh phụ (controller chạy): codex-quiet-hooks + orca-session 18 pass, 0 fail.
- Self-test (controller chạy): `PASS: 2103 tests executed`, exit 0; `git diff --check` sạch.
- Probe tĩnh và fixture không đổi (không thêm `require` mới).
- Review controller: inspect dùng `PROJECT_ROOT` + `readRuntime` + `resolveSessionCwd` như privacy; rules đọc runtime trước khi giữ chỗ; require `secret-keywords` trong `try`. Commit 9bbbd089.
