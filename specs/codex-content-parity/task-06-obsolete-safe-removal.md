# Task 06 — File obsolete đã sửa được giữ, kèm cảnh báo

Status: pending

## Outcome
Ở cả hai host, mục obsolete chỉ bị xoá khi còn đúng bản CafeKit đã cài; mục đã sửa, chưa có hash, symlink, hoặc thư mục có file lạ/đã sửa được giữ, và mỗi lần cài in một dòng cảnh báo gộp.

## Scope
- In: D-09 ở `bin/phases/claude-runtime.js:167-191` và `codex-runtime.js:34-46`; sửa 3 test cũ theo hành vi mới; changelog.
- Out: agent/skill obsolete (đã có kiểm riêng); uninstall.

## Coverage
- CP-06

## Ownership
- Modify: `bin/phases/claude-runtime.js` (nhánh obsolete), `bin/phases/codex-runtime.js` (`removeObsoleteCodexHooks`), `bin/__tests__/legacy-hooks-retired.test.js` (`:85-103,115-141`), `bin/__tests__/codex-native.test.js` (`:2290-2305,3120-3140`), `bin/__tests__/usage-hook-retired.test.js` (`:78`), `bin/__tests__/installer-safety.test.js`, hai changelog
- Probe tĩnh: `scripts/run-skill-self-tests.mjs:5207-5210` (chữ `rmSync`/`prunePrefix`) và `runInstallerMigrationFixtureTests` (`:5768-5812`, file `skill-router` không có trong tracker nay được giữ kèm cảnh báo), chỉ theo đúng code mới.
- Read: `bin/lib/manifest.js`, `bin/lib/path-safety.js`, `src/claude/migration-manifest.json`

## Steps
1. Thêm test vào `installer-safety.test.js`, mỗi host: file obsolete khớp hash → bị xoá, tracker prune; file đã sửa → giữ; file không có trong tracker → giữ; symlink trỏ ra ngoài thư mục tạm → giữ, đích không đổi; thư mục obsolete toàn file khớp → xoá; thư mục có một file lạ → giữ; có mục bị giữ → đúng một dòng cảnh báo nêu số mục. Sửa các ca cũ (`legacy-hooks-retired`, `codex-native`, `usage-hook-retired:78`, self-test migration fixture) thành: file đã sửa hoặc không có trong tracker được giữ kèm cảnh báo. Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-06: các ca đúng; Command xanh.

## Dependencies
- task-05-installer-write-once.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/legacy-hooks-retired.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/usage-hook-retired.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test obsolete mới.
- Reachability: installer thật trên thư mục tạm.
- Oracle: Oracle chung của plan.
- Counterexample: bỏ kiểm hash → ca file đã sửa đỏ; bỏ `lstat` → ca symlink đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
