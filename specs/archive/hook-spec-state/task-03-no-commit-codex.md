# Task 03 — Repo chưa có commit: hook Codex

Status: done

## Outcome
Codex xử lý repo đã `git init` nhưng chưa có commit giống Claude ở task-02:
- Stop không bị chặn khi chưa có task done.
- Đã có task done thì chặn, với lời nhắc tạo commit đầu.
- Tollgate in đúng một dòng nhắc.

## Scope
- In:
  - D-02 (plan.md), phần Codex: `src/codex/hooks/spec-gate.cjs` và `src/codex/hooks/spec-state.cjs` xử lý mã `no_git_history` mà `provenance.cjs` (task-02) ném ra.
  - Xử lý ở mọi đường gọi `deriveRuntimeContext`/`checkWorkflowReceiptSet` trong hai hook này, gồm nhánh nhiều packet (`src/codex/hooks/spec-gate.cjs:66`).
  - Một dòng changelog ở hai file changelog.
- Out:
  - `provenance.cjs` và phân loại lỗi git (task-02; ca ref hỏng/không có git đã kiểm ở Claude vì dùng chung script);
  - thư mục không phải git.

## Coverage
- CP-02

## Ownership
- Modify: `src/codex/hooks/spec-gate.cjs`, `src/codex/hooks/spec-state.cjs`, `bin/__tests__/codex-hooks.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`
- Read: `src/codex/hooks/lib/spec-receipt.cjs:6-33`

## Steps
1. Thêm các ca (a), (b), (e) giống task-02 vào `codex-hooks.test.js`:
   - Chạy trên layout `.codex` đã cài.
   - Fixture: `inHookFixture` (`:188`) luôn tạo commit và `runHook` (`:96-101`) không truyền env. Mở rộng trong file test một biến thể không commit; không đổi helper cũ theo cách làm đổi test cũ.
   - Payload Codex có `session_id`. Prompt chạm packet để Codex không lọc mất.

   Chạy Command trên code task-02: các ca mới phải đỏ; ghi số ca đỏ.
2. Sửa hai hook Codex và thêm changelog.
3. Chạy Command; chạy self-test như task-01.
4. Commit đúng các file trong Ownership.

## Acceptance
- AC-02 (phần Codex): (a), (b), (e) đúng; test cũ trong `codex-hooks.test.js` không đổi assertion; self-test exit 0.

## Dependencies
- task-02-no-commit-claude.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-native.test.js`
- Named probe: các ca (a), (b), (e) phía Codex; tên test chứa `no commits`.
- Reachability: hook chạy từ layout `.codex/hooks`; script lấy từ `.codex/scripts` hoặc `src/claude/scripts` qua `loadModule`.
- Oracle: exit 0, `# fail 0`, output có tên các ca.
- Counterexample: trên bản chép tạm, bỏ kiểm `no_git_history` trong Codex `spec-gate.cjs` → ca (a) đỏ; hoàn tác sau đó.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-native.test.js`
Exit: 0
Base: 81dc88432cbdb659fc17d495c4f3ffd6240bf59c
Head: 7de01ba0e81303be55840c4c45132d9191ce145f2210f1a262e7e8f1562783bf

```text
ok 7 - Codex no commits allows Stop without done tasks and prints one reminder
ok 8 - Codex no commits blocks a done task with first commit guidance
ok 9 - Codex no commits blocks two completed packets with first commit guidance
# tests 86
# pass 86
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): 3 test mới đỏ — 83 pass, 3 fail.
- Counterexample (Codex báo): bỏ xử lý `no_git_history` trong Codex spec-gate → test đầu đỏ; đã hoàn tác.
- Self-test (controller chạy): `PASS: 2055 tests executed`, exit 0; `git diff --check` sạch.
- Review controller: hai hook Codex giống mẫu Claude (commit 0d898bf9); `hasDoneTasks` tính ở cả nhánh completed-set (`:62`) và packet đơn trước `deriveRuntimeContext`; PostToolUse thoát trước provenance (`src/codex/hooks/spec-state.cjs:37`) nên dòng nhắc không in ở chế độ observer. Commit 81dc8843.
