# Task 08 — Privacy hiển thị thống nhất

Status: done

## Outcome
Khi hỏi quyền đọc file nhạy cảm, Claude, omp và Codex nêu cùng danh sách tên; Claude hỏi lại thay vì cho qua khi không đọc được payload.

## Scope
- In:
  - Chuyển `displayNames` (`src/codex/hooks/lib/privacy-state.cjs:64-69`) vào `src/claude/hooks/lib/privacy-paths.cjs` (đã được chép sang Codex và omp); Codex `privacy-state.cjs` dùng lại từ đó.
  - Claude `privacy-block.cjs`: dùng `lib/project-root.cjs` (D-01) thay `:51-53`; lý do `ask` là `Sensitive file access requires approval: <displayNames(paths)>`; stdin rỗng → `ask` với lý do `Sensitive access could not be evaluated safely.`; mọi lần in `ask` đi qua một helper duy nhất.
  - Bản fork omp `src/omp/hooks/privacy-block.cjs`: áp cùng thay đổi tên; stdin rỗng của omp giữ như hiện tại (`:44-45`) và cập nhật các phép sửa cố định trong `bin/__tests__/omp-hooks.test.js:128-157` cho khớp bản Claude mới.
  - Quyết định `ask`/`deny` không đổi.
  - Đồng bộ `.claude`; changelog.
- Out: thông điệp spec-gate, spec-state, agent (task-09).

## Coverage
- CP-08

## Ownership
- Modify: `src/claude/hooks/privacy-block.cjs`, `src/claude/hooks/lib/privacy-paths.cjs`, `src/codex/hooks/lib/privacy-state.cjs`, `src/omp/hooks/privacy-block.cjs`, `src/claude/hooks/__tests__/privacy-block.test.js`, `bin/__tests__/omp-hooks.test.js`, `bin/__tests__/orca-session.test.js` (chỉ fixture chép lib), hai changelog
- Sync (gitignored): `../../.claude/hooks/`

## Steps
1. Thêm test vào `privacy-block.test.js`: Bash đọc năm path nhạy cảm gồm bốn basename khác nhau → lý do khớp `displayNames` (3 tên đã sắp, `(+1 more)`); stdin rỗng → `ask`. Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; cập nhật phép sửa omp; đồng bộ; changelog.
3. Chạy Command; `node --test packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/orca-session.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/privacy-paths.test.js`; self-test; `cmp`.
4. Không commit.

## Acceptance
- AC-08: các ca trên đúng; các test ở Step 3 xanh; self-test exit 0.

## Dependencies
- task-07-codex-update-notice.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/privacy-block.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên mô tả hành vi.
- Reachability: hook chạy bằng `spawnSync` như test hiện có.
- Oracle: exit 0, `# fail 0`.
- Counterexample: cho Claude chỉ nêu `paths[0]` → ca năm path đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/privacy-block.test.js`
Exit: 0
Base: 3f606ecc2d0eb8c0bf4f6511738ebec4f4809e2d
Head: b4c29ba2d8c7c357356bc56743d9f2df0e984b90436e30bf069e25f14b404072

```text
ok 1 - sensitive reads list sorted distinct basenames and the remaining count
ok 2 - empty stdin asks because sensitive access cannot be evaluated safely
ok 88 - still allows real link to allowed example (regression: real link to .env.example)
ok 89 - fails closed on malformed/looping symlink (hop limit)
# tests 89
# pass 89
# fail 0
```

- Đỏ trước sửa (Codex báo): 2 fail / 89.
- Counterexample (Codex báo): cho Claude chỉ nêu `paths[0]` → ca năm path đỏ; đã hoàn tác, file khớp byte.
- Lệnh phụ (controller chạy): omp-hooks + orca-session + codex-hooks + privacy-paths 358 pass, 0 fail; codex-quiet-hooks 9 pass, 0 fail.
- Self-test (controller chạy): `PASS: 2121 tests executed`, exit 0; `cmp` `.claude/hooks/privacy-block.cjs`, `lib/privacy-paths.cjs` khớp nguồn; `git diff --check` sạch.
- Probe tĩnh không đổi. Fixture chép lib: `orca-session`, `codex-hooks`, `codex-quiet-hooks` bổ sung lib cần thiết; phép sửa cố định omp trong `omp-hooks.test.js` cập nhật theo helper mới.
- Review controller (đường quyết định privacy): quyết định `ask`/`deny` không đổi ngoài stdin rỗng của Claude → `ask`; mọi lần in đi qua `askForPermission`; lỗi require lib rơi vào `catch` → `ask` (fail-safe); omp giữ `deny` và cho qua khi stdin rỗng; Codex `privacy-state` dùng `displayNames` từ `privacy-paths.cjs` (installer đã chép bản thật). Commit 3f606ecc.
