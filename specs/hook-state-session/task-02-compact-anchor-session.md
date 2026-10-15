# Task 02 — Anchor compact chỉ in cho đúng phiên

Status: pending

## Outcome
Sau compact, Claude chỉ in "State before compaction" khi anchor do chính phiên đó ghi. Cảnh báo xác nhận vẫn in mọi lần compact.

## Scope
- In:
  - D-02 (plan.md) trong `src/claude/hooks/session.cjs` (`:270-293`): so `record.session_id` với `session_id` của payload; khớp → in như cũ; không khớp hoặc một bên thiếu → bỏ phần anchor.
  - Đồng bộ `../../.claude/hooks/session.cjs` (gốc repo, bị gitignore, không commit) bằng copy.
  - Một dòng changelog ở hai file changelog.
- Out: `precompact.cjs` (đã ghi `session_id`, `src/claude/hooks/precompact.cjs:81`); lưu record theo phiên.

## Coverage
- CP-02

## Ownership
- Modify: `src/claude/hooks/session.cjs`, `src/claude/hooks/__tests__/precompact.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`
- Sync (gitignored, không commit): `../../.claude/hooks/session.cjs`

## Steps
1. Thêm test vào `precompact.test.js`, dùng cách chạy PreCompact rồi SessionStart compact như test hiện có (`:92-120`):
   - PreCompact với `session_id` A, SessionStart compact với `session_id` B → có cảnh báo `SESSION COMPRESSED`, không có `State before compaction`;
   - PreCompact và SessionStart compact cùng `session_id` A → có anchor như cũ.

   Nếu test cũ `:92` gửi payload không có `session_id` ở một trong hai bước, ghi quan sát; chỉ thêm `session_id` giống nhau vào payload của test đó nếu cần, không đổi assertion. Chạy Command trước khi sửa: ca phiên khác phải đỏ; ghi số ca đỏ.
2. Sửa `session.cjs`; đồng bộ bản `../../.claude`; thêm changelog.
3. Chạy Command; chạy self-test như task-01; `cmp` bản `../../.claude/hooks/session.cjs` với nguồn.
4. Không commit (controller commit).

## Acceptance
- AC-02: hai ca trên đúng; test cũ không đổi assertion; self-test exit 0.

## Dependencies
- task-01-claude-state-per-session.md

## Verification Plan
- Command (chạy từ gốc repo): `node --test packages/spec/src/claude/hooks/__tests__/precompact.test.js packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js`
- Named probe: ca phiên khác không in anchor; ca cùng phiên in anchor.
- Reachability: PreCompact và SessionStart chạy bằng subprocess như test hiện có.
- Oracle: exit 0, `# fail 0`, output có tên các ca.
- Counterexample: trên bản chép tạm, bỏ phép so `session_id` → ca phiên khác đỏ; hoàn tác sau đó.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
