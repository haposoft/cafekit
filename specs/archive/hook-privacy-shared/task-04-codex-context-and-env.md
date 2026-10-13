# Task 04 — Codex privacy không phụ thuộc paths.specs; bỏ GIT_URL

Status: done

## Outcome
`runtime.paths.specs` sai không còn làm Codex deny mọi lệnh hay làm hỏng lời approve. Phiên Claude không còn ghi URL git remote (có thể chứa credential) vào env.

## Scope
- In:
  - D-05 phần Codex: `privacy-block.cjs` và `privacy-approval.cjs` dùng `PROJECT_ROOT`, `readRuntime(PROJECT_ROOT)`, `resolveSessionCwd(payload)` thay `getHookContext`; lỗi khác vẫn vào nhánh catch như cũ.
  - D-06: xoá dòng lấy và ghi `GIT_URL` trong `src/claude/hooks/session.cjs`.
  - Một dòng changelog ở hai file changelog.
- Out: `getHookContext` của các hook Codex khác (gói 3/4).

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/codex/hooks/privacy-block.cjs`, `packages/spec/src/codex/hooks/privacy-approval.cjs`, `packages/spec/src/claude/hooks/session.cjs`, `packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js`, `packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `packages/spec/src/codex/hooks/lib/hook-context.cjs`, `packages/spec/src/codex/hooks/lib/privacy-state.cjs`

## Steps
1. Thêm test và chạy Command trên code task-03; các test mới phải đỏ.
   - `codex-native-hook-boundaries.test.js`: dựng layout `.codex` đã cài, `runtime.json` = `{"paths":{"specs":"../outside"}}`, payload có `session_id`:
     - (a) privacy-block với Bash `ls`: exit 0, stdout rỗng;
     - (b) privacy-block với Bash `cat .env`: deny, có chuỗi approval;
     - (c) gửi đúng chuỗi approval đó qua `privacy-approval.cjs`, rồi chạy lại (b): cho qua.
   - `session-writeenv.test.js`: repo tạm có remote dạng `https://<user>:<giả>@example.invalid/r.git` → env file không có dòng `GIT_URL` và không chứa phần userinfo. Giá trị giả chỉ nằm trong test, không in ra log.
2. Sửa hai hook Codex và `session.cjs`; đồng bộ `.claude/hooks/session.cjs` bằng copy; changelog.
3. Chạy Command; `pnpm test` ở gốc repo.
4. Commit đúng file Ownership (không tên AI, không mã plan, không push).

## Acceptance
- AC-04: các ca (a), (b), (c) và ca env xanh; test cũ trong hai file không đổi assertion; `pnpm test` exit 0.

## Dependencies
- task-03-runtime-write-guard.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-hooks.test.js`
- Named probe: (a) `ls` cho qua, (c) approve rồi cho qua khi `paths.specs` sai; ca env không có `GIT_URL`.
- Reachability: hook Codex chạy từ layout `.codex/hooks/` (vì `PROJECT_ROOT` tính từ `__dirname`); `session.cjs` chạy bằng `spawnSync` với `CLAUDE_ENV_FILE` tạm.
- Oracle: exit 0, `# fail 0`, output có tên các test mới.
- Counterexample (bản chép tạm, hoàn tác): khôi phục `getHookContext` trong `privacy-approval.cjs` → ca (c) phải đỏ; khôi phục trong `privacy-block.cjs` → ca (a) phải đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-hooks.test.js
Exit: 0
Base: 1d60d7a56d056eaa0adc60c1bea39d1fcf54b5d1
Head: 78cdcfa2f36f2a92294d7f387932ee58e8026d200a82bbd6a3a403ff64c5a870
```text
ok 48 - privacy-block allows ls when configured specs escapes the project
ok 49 - privacy-block issues approval for a sensitive read when configured specs escapes the project
ok 50 - privacy-approval grants a pending read when configured specs escapes the project
ok 91 - session.cjs does not export GIT_URL or remote userinfo
1..92
# tests 92
# suites 0
# pass 92
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 50587.368875
```

Đỏ trước khi sửa: 4 ca mới fail trên code task-03 (báo cáo Codex). Gốc 88 test → 92. pnpm test exit 0 (PASS: 1925 tests executed). cmp .claude/hooks/session.cjs với nguồn: khớp. Counterexample: khôi phục getHookContext trong privacy-approval → ca (c) đỏ; trong privacy-block → ca (a) đỏ (đã hoàn tác). Review code-auditor: PASS, 2 Low: test env thừa hưởng process.env nên sẽ trỏ repo thật nếu CLAUDE_PROJECT_DIR được set (lần chạy này không set); resolveSessionCwd không giới hạn cwd trong project (có từ trước). Commit 1d60d7a5.
