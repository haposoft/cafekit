# Task 04 — session/precompact Claude bền + rules sau compact

Status: in_progress

## Outcome
Sau compact, prompt kế tiếp của phiên Claude nhận lại rules; session và precompact không bao giờ làm hỏng phiên.

## Scope
- In:
  - `session.cjs` và `precompact.cjs` dùng `lib/project-root.cjs` (D-01) thay `projectRoot` riêng (`src/claude/hooks/session.cjs:44-56`, `src/claude/hooks/precompact.cjs:37-45`).
  - `session.cjs`: async IIFE có `.catch` ghi log crash (`hook: 'session'`) rồi exit 0.
  - `session.cjs`: in `CafeKit project root: <root> (session working directory: <cwd>).` chỉ khi `payload.cwd` có mặt và realpath của hai giá trị khác nhau (như `src/codex/hooks/session.cjs:109-113`); `orca-session.test.js:105-110` phải giữ đúng từng byte.
  - D-04: `src/claude/hooks/lib/rules-reservation.cjs` (thêm vào `runtime.files` của manifest) giữ hàm tạo/xoá chỗ giữ dưới `hookStateDir`, khoá là sha256 của `session_id` đã chuẩn hoá; `rules.cjs` dùng lib (bỏ `os.tmpdir()`); `session.cjs` khi `source=compact` xoá chỗ giữ của chính phiên trước mọi nhánh thoát sớm (`:277` thoát khi không có anchor khớp).
  - `precompact.cjs`: mọi lời gọi git có `timeout: 3000`.
  - Đồng bộ `.claude`; changelog.
- Out: Codex (task-06).

## Coverage
- CP-04

## Ownership
- Modify: `src/claude/hooks/session.cjs`, `src/claude/hooks/precompact.cjs`, `src/claude/hooks/rules.cjs`, `src/claude/hooks/lib/rules-reservation.cjs` (mới), `src/claude/migration-manifest.json`, `src/claude/hooks/__tests__/precompact.test.js`, hai changelog
- Probe tĩnh: `scripts/run-skill-self-tests.mjs:5215-5225` đòi `rules.cjs` chứa `reserveSession`; cập nhật nếu tên rời sang lib.
- Sync (gitignored): `../../.claude/hooks/`

## Steps
1. Thêm test vào `precompact.test.js` (layout `.claude` theo manifest, `spawnSync` có `timeout`, env bỏ `CLAUDE_PROJECT_DIR`/`PROJECT_ROOT`):
   - rules phiên S tiêm lần 1, lần 2 im lặng; SessionStart `compact` phiên S không có anchor khớp; rules lần 3 tiêm lại; phiên T vẫn im lặng;
   - session với stdin `{` → exit 0, stderr không có stack, `hook-log.jsonl` có dòng crash;
   - session với `cwd` thư mục con → có dòng project root; không có `cwd` → không có dòng đó;
   - precompact với `PATH` trỏ một `git` giả ngủ 30s → hook kết thúc dưới 10s (đặt `timeout` cho `spawnSync` của test để ca đỏ trước không treo).
   Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; manifest; đồng bộ; changelog.
3. Chạy Command; `node --test packages/spec/bin/__tests__/orca-session.test.js packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/src/claude/hooks/__tests__/installed-root.test.js`; self-test; `cmp`.
4. Không commit.

## Acceptance
- AC-04: các ca trên đúng; các test ở Step 3 xanh; self-test exit 0.

## Dependencies
- task-03-claude-state-robust.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/precompact.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên mô tả hành vi.
- Reachability: hook chạy bằng `spawnSync`, layout `.claude`.
- Oracle: exit 0, `# fail 0`.
- Counterexample: chuyển bước xoá chỗ giữ xuống sau nhánh thoát sớm → ca tiêm lại đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
