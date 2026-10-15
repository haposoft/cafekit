# Task 03 — state: Agent, khoá, log, tin nhắn cuối

Status: pending

## Outcome
State của Claude được làm mới khi gọi `Agent`, không hỏng khi hai sự kiện ghi gần nhau, ghi log khi crash; cả hai host giữ tóm tắt tin nhắn cuối mà không lưu bí mật.

## Scope
- In:
  - Claude `state.cjs` dùng `lib/project-root.cjs` (D-01) thay `payload.cwd` (`src/claude/hooks/state.cjs:246`).
  - `TRACKED_POST_TOOL_EVENTS` thêm `Agent` (`:32`); parser coi `Agent` như `Task` (`src/claude/hooks/lib/parser.cjs:83`).
  - `main().catch` ghi một dòng crash (`hook: 'state'`) vào `hook-log.jsonl` như nhánh `catch` ngoài (`state.cjs:299-315`) rồi exit 0.
  - Khoá ghi bằng `mkdir` có hạn 3s, gỡ khoá cũ hơn 15s, như `src/codex/hooks/lib/state-store.cjs:26-64`. Thu dữ liệu (transcript, git) ngoài khoá; khoá chỉ bọc đọc-gộp-ghi `latest.md`/archive; nhả khoá trước mọi `process.exit`; SessionStart không lấy khoá và không tạo thư mục. Không lấy được khoá → bỏ lần ghi (fail-open).
  - Stop và SubagentStop của Claude lưu tóm tắt `last_assistant_message` (cắt như `summary` của Codex `src/codex/hooks/state.cjs:22-34`) trong `latest.md`.
  - D-07, cả hai host: chuỗi khớp `containsSecretKeyword` → lưu `[omitted: possible secret]` (Codex `src/codex/hooks/state.cjs:153,165`). Tạo shim một dòng `src/codex/hooks/lib/secret-keywords.cjs` (như `inspect-paths.cjs`) để Codex state dùng; các fixture Codex chép bản thật của lib này (Luật fixture).
  - Đồng bộ `.claude`; changelog.
- Out: session, precompact (task-04).

## Coverage
- CP-03

## Ownership
- Modify: `src/claude/hooks/state.cjs`, `src/claude/hooks/lib/parser.cjs`, `src/codex/hooks/state.cjs`, `src/codex/hooks/lib/secret-keywords.cjs` (mới, shim), fixture chép lib theo Luật fixture (ít nhất `bin/__tests__/codex-quiet-hooks.test.js`), `src/claude/hooks/__tests__/state.test.js`, `bin/__tests__/codex-hooks.test.js`, hai changelog
- Sync (gitignored): `../../.claude/hooks/`

## Steps
1. Thêm test:
   - `state.test.js`: transcript có todo, PostToolUse `Agent` → `latest.md` được tạo hoặc làm mới với todo đó (hiện bị bỏ);
   - Stop có `last_assistant_message` thường → `latest.md` có tóm tắt; có từ khoá secret → có `[omitted: possible secret]` và không có chuỗi gốc;
   - giữ sẵn thư mục khoá mới → lần ghi bị bỏ, exit 0, `latest.md` nguyên vẹn; khoá cũ hơn 15s → bị gỡ, ghi được; hai PostToolUse liên tiếp → cả hai ghi và không còn thư mục khoá (regression guard, có thể xanh trước);
   - stdin `{` → exit 0 và `hook-log.jsonl` có dòng crash `hook: 'state'`;
   - test SessionStart không tạo thư mục (`state.test.js:459`) giữ xanh.
   - `codex-hooks.test.js`: Stop Codex với tin nhắn có từ khoá secret → state không chứa chuỗi gốc.
   Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; đồng bộ; changelog.
3. Chạy Command; `node --test packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-quiet-hooks.test.js packages/spec/bin/__tests__/orca-session.test.js`; self-test; `cmp`.
4. Không commit.

## Acceptance
- AC-03: các ca trên đúng; test cũ giữ assertion; self-test exit 0.

## Dependencies
- task-02-claude-spec-state-parity.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/state.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên mô tả hành vi.
- Reachability: hook chạy bằng `spawnSync`, layout `.claude`.
- Oracle: exit 0, `# fail 0`.
- Counterexample: bỏ `Agent` khỏi tập theo dõi trên bản chép tạm → ca Agent đỏ; bỏ lọc secret → ca secret đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
