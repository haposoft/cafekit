# Task 03 — Codex ghi state khi tạo subagent

Status: pending

## Outcome
Khi Codex 0.162.1 gọi `collaborationspawn_agent`, hook state Codex ghi lần gọi đó vào state của phiên, như đã làm với `spawn_agent`.

## Scope
- In:
  - D-03 (plan.md): `isTrackedTool` trong `src/codex/hooks/state.cjs:73-80` nhận thêm `collaborationspawn_agent`; với `spawn_agent`/`collaborationspawn_agent` chỉ ghi `lastToolEvent`, không gọi `updateTaskState` (`:131-137`).
  - Một dòng changelog ở hai file changelog.
- Out: matcher `src/codex/hooks.json` (đã có tên này); `collaborationwait_agent`; `update_plan`.

## Coverage
- CP-03

## Ownership
- Modify: `src/codex/hooks/state.cjs`, `bin/__tests__/codex-hooks.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`

## Steps
1. Thêm test vào `codex-hooks.test.js` trên layout `.codex` đã cài: gửi PostToolUse `tool_name: "collaborationspawn_agent"` với `session_id` S, `tool_input` có `message`, rồi SessionStart `resume` cùng S → stdout có `Latest Tracked Tool` và `collaborationspawn_agent`. Thêm ca thứ hai: `tool_input` có `id` và `title` → SessionStart `resume` có `collaborationspawn_agent` nhưng mục "What's Left" không có todo đó (giới hạn assertion trong mục này: dòng `Latest Tracked Tool` có thể chứa JSON của input). Chạy Command trước khi sửa: cả hai ca đỏ vì chưa ghi `Latest Tracked Tool`; ghi số ca đỏ.
2. Sửa `state.cjs`; thêm changelog.
3. Chạy Command; chạy self-test như task-01.
4. Không commit (controller commit).

## Acceptance
- AC-03: test mới xanh; test cũ không đổi assertion; self-test exit 0.

## Dependencies
- task-02-compact-anchor-session.md

## Verification Plan
- Command (chạy từ gốc repo): `node --test packages/spec/bin/__tests__/codex-hooks.test.js`
- Named probe: test mới có `collaborationspawn_agent` trong tên.
- Reachability: hook chạy từ layout `.codex/hooks` như các test Codex hiện có.
- Oracle: exit 0, `# fail 0`, output có tên test mới.
- Counterexample: trên bản chép tạm, (1) bỏ tên mới khỏi `isTrackedTool` → hai ca đỏ; (2) cho tool spawn gọi lại `updateTaskState` → ca thứ hai đỏ. Hoàn tác sau đó.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
