# Task 03 — Codex ghi state khi tạo subagent

Status: done

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
- Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js`
- Cwd: gốc repo.
- Named probe: test mới có `collaborationspawn_agent` trong tên.
- Reachability: hook chạy từ layout `.codex/hooks` như các test Codex hiện có.
- Oracle: exit 0, `# fail 0`, output có tên test mới.
- Counterexample: trên bản chép tạm, (1) bỏ tên mới khỏi `isTrackedTool` → hai ca đỏ; (2) cho tool spawn gọi lại `updateTaskState` → ca thứ hai đỏ. Hoàn tác sau đó.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js`
Exit: 0
Base: 0b15e2f6742971e0121ae1c4a2ea372817cac1b8
Head: 357c83aad8f1fcdbf469317fdd36dcb0081f5e70b1c6fc75cf4a69b96c657f11

```text
ok 7 - Codex collaborationspawn_agent appears as the latest tracked tool on resume
ok 8 - Codex collaborationspawn_agent input does not create a pending todo
# tests 52
# pass 52
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): 2 test đỏ — 50 pass, 2 fail.
- Counterexample (Codex báo): bỏ tên mới khỏi `isTrackedTool` → 2 test đỏ; cho spawn gọi lại `updateTaskState` → test thứ hai đỏ; đã hoàn tác.
- Self-test (controller chạy): `PASS: 2074 tests executed`, exit 0; `git diff --check` sạch.
- Review controller: `isTrackedTool` thêm đúng một tên; tool spawn bỏ qua `updateTaskState` nhưng vẫn ghi `lastToolEvent`; assertion todo giới hạn trong mục "What's Left". Commit 0b15e2f6.
