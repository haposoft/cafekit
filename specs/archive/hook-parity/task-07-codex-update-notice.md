# Task 07 — Thông báo cập nhật cho Codex

Status: done

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

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/update-check.test.js packages/spec/bin/__tests__/codex-hooks.test.js`
Exit: 0
Base: 2bfbfeaacbfdb56f35c74f68d893070b3c748e6d
Head: c5bd7d817e8a6f575cdb3f7a6f63a238065a6f2efb8bc251414b5dd623b14647

```text
ok 33 - Codex SessionStart prints a newer cached CafeKit version
ok 34 - Codex SessionStart stays silent about an equal cached CafeKit version
ok 35 - Codex update failure still clears pending privacy for the session
ok 68 - a newer version produces the existing notice and caches only version data
ok 69 - the installed version produces no update notice
ok 70 - an invalid cached latest version is refetched instead of printed
ok 71 - a cache timestamp in the future requires a fresh version fetch
ok 72 - a legacy notice cache cannot inject its stored text into the session
ok 73 - an interrupted version response fails open without an unhandled error
# tests 73
# pass 73
# fail 0
```

- Đỏ trước sửa (Codex báo): 6/72; ca response bị ngắt (thêm trong lúc làm) đỏ 1/1 trước khi sửa.
- Counterexample (Codex báo): lib trả nguyên `cache.notice` → ca cache cũ đỏ; đã hoàn tác, file khớp byte.
- Vòng review 1 (controller): lib có nhánh `EISDIR` rethrow chỉ để test ép lỗi → bỏ nhánh, ca "update failure" ghi đè `update-check.cjs` trong fixture bằng module throw; assertion giữ nguyên.
- Lệnh phụ (controller chạy): codex-hooks-ownership + codex-native-hook-boundaries + orca-session + omp-hooks + session-writeenv 38 pass, 0 fail.
- Self-test (controller chạy): `PASS: 2119 tests executed`, exit 0; `cmp` `.claude/hooks/session.cjs`, `lib/update-check.cjs` khớp nguồn; `git diff --check` sạch.
- Probe tĩnh không đổi. Fixture chép lib: `codex-hooks`, `codex-quiet-hooks`, `codex-native-hook-boundaries`, `orca-session` thêm `update-check.cjs`. Installer Codex chép `update-check.cjs` đè shim.
- Review controller: không ca nào gọi mạng thật; cache chỉ `{ts, latest}`, `latest` khớp `^\d+\.\d+\.\d+$`, `ts` tương lai bị bỏ; Codex gọi sau `clearState`, trong `try` riêng; Claude `.catch(() => '')`. Commit 2bfbfeaa.
