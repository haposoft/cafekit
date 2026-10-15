# Task 02 — Anchor compact chỉ in cho đúng phiên

Status: done

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
- Command: `node --test packages/spec/src/claude/hooks/__tests__/precompact.test.js packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js`
- Cwd: gốc repo.
- Named probe: ca phiên khác không in anchor; ca cùng phiên in anchor.
- Reachability: PreCompact và SessionStart chạy bằng subprocess như test hiện có.
- Oracle: exit 0, `# fail 0`, output có tên các ca.
- Counterexample: trên bản chép tạm, bỏ phép so `session_id` → ca phiên khác đỏ; hoàn tác sau đó.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/precompact.test.js packages/spec/src/claude/hooks/__tests__/session-writeenv.test.js`
Exit: 0
Base: 1f2557337343e0a07d2b524465b1edf425991951
Head: a9bf9643e09722e232c83dd1616e61a143cbb6022bd02cd7280b0ada139c5aee

```text
ok 2 - a compact restart prints the captured anchors alongside the authorization warning
ok 3 - a compact restart without a capture still prints the warning and nothing invented
ok 4 - a compact restart in another session prints the warning without foreign anchors
ok 5 - a compact restart in the same session restores its captured anchors
ok 6 - a compact restart without capture session identity keeps only the warning
ok 7 - a compact restart without restart session identity keeps only the warning
ok 8 - a compact restart without either session identity keeps only the warning
ok 9 - a normal session start prints no compaction anchors
# tests 12
# pass 12
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): 4 test đỏ — 8 pass, 4 fail.
- Counterexample (Codex báo): bỏ phép so `session_id` → ca phiên khác đỏ; đã hoàn tác.
- Self-test (controller chạy): `PASS: 2072 tests executed`, exit 0; `cmp .claude/hooks/session.cjs` với nguồn khớp; `git diff --check` sạch.
- Review controller: một dòng so `record.session_id` với `payload.session_id` đã normalize (grok `sessionId` vẫn khớp); thoát sớm tương đương vì khối anchor là bước cuối trước `process.exit(0)`; test cũ chỉ thêm cùng `session_id` vào hai payload, assertion giữ nguyên. Commit 1f255733.
