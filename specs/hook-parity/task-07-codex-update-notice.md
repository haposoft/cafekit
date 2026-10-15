# Task 07 — Thông báo cập nhật cho Codex

Status: in_progress

## Outcome
Phiên Codex báo khi có bản CafeKit mới, cùng chữ và cùng cache 12 giờ như Claude, và cache không thể bị dùng để chèn câu tuỳ ý.

## Scope
- In:
  - D-05: chuyển `fetchLatestVersion`, `isNewer`, `getInstalledVersion`, `checkCafeKitUpdate` từ `src/claude/hooks/session.cjs:113-193` vào `src/claude/hooks/lib/update-check.cjs` (thêm vào `runtime.files` của manifest), nhận thư mục runtime và hàm fetch làm tham số.
  - Cache chỉ lưu `{ ts, latest }`; `latest` phải khớp `^\d+\.\d+\.\d+$`; `ts` ở tương lai → coi như hết hạn; câu thông báo dựng lúc đọc. Cache cũ dạng `{ ts, notice }` bị bỏ qua.
  - Claude session dùng lib, chữ thông báo không đổi.
  - Codex session gọi lib (shim `src/codex/hooks/lib/update-check.cjs`; installer chép như `secret-keywords.cjs`) sau `clearState` (`src/codex/hooks/session.cjs:89-92`), trong `try` riêng; đọc `cafekit.json` trong `.codex/`; fail-open.
  - Changelog.
- Out: đổi nội dung thông báo.

## Coverage
- CP-07

## Ownership
- Modify: `src/claude/hooks/lib/update-check.cjs` (mới), `src/claude/migration-manifest.json`, `src/claude/hooks/session.cjs`, `src/codex/hooks/session.cjs`, `src/codex/hooks/lib/update-check.cjs` (mới, shim), `bin/phases/codex-runtime.js`, `src/claude/hooks/__tests__/update-check.test.js` (mới), `bin/__tests__/codex-hooks.test.js`, `bin/__tests__/orca-session.test.js`, `bin/__tests__/codex-native-hook-boundaries.test.js` (chỉ fixture chép lib), hai changelog
- Sync (gitignored): `../../.claude/hooks/`

## Steps
1. Test:
   - `update-check.test.js` (unit, fetch giả): bản mới hơn → có câu; bằng nhau → không; cache `latest` không hợp lệ hoặc `ts` tương lai → gọi fetch lại; cache cũ có `notice` → bỏ qua `notice`.
   - `codex-hooks.test.js`: layout `.codex` có `cafekit.json` version cũ và cache còn hạn với `latest` mới → SessionStart Codex in thông báo; cache có `latest` bằng version → không in; lib throw (cache là thư mục) → pending privacy của phiên vẫn bị xoá, exit 0. Không ca nào gọi mạng thật.
   Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; manifest; installer; đồng bộ `.claude`; changelog.
3. Chạy Command; `node --test packages/spec/bin/__tests__/codex-hooks-ownership.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/bin/__tests__/orca-session.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js`; self-test; `cmp`.
4. Không commit.

## Acceptance
- AC-07: các ca trên đúng; các test ở Step 3 xanh; self-test exit 0.

## Dependencies
- task-06-codex-compact.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/update-check.test.js packages/spec/bin/__tests__/codex-hooks.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên mô tả hành vi.
- Reachability: hook chạy bằng `spawnSync` trên layout đã cài; lib chạy với fetch giả.
- Oracle: exit 0, `# fail 0`.
- Counterexample: cho lib trả `cache.notice` nguyên văn → ca cache cũ đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
