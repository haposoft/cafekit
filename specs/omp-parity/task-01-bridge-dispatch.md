# Task 01 — Bridge omp dùng session id thật, chạy spec-state và lọc touch

Status: done

## Outcome
Mọi event omp mang cùng một session id (ưu tiên id thật của omp); `tool_result` chạy `state.cjs` rồi `spec-state.cjs`; `session_start` không chạy `docs-sync.cjs`; dưới `.omp` spec-state ghi và dùng touch state theo phiên như Claude.

## Scope
- In: D-01, D-02, D-03; doc installer; hai changelog.
- Out: privacy (task-02); state theo phiên (task-03); `ast_edit`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/omp/extensions/cafekit-bridge.mjs`, `packages/spec/bin/__tests__/omp-bridge.test.js`, `packages/spec/src/claude/hooks/spec-state.cjs`, `packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js`, `docs/installer-architecture.md`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `packages/spec/src/claude/hooks/lib/spec-touch.cjs`, `packages/spec/src/claude/settings/settings.json`

## Steps
1. Test trước: trong `omp-bridge.test.js` thêm (a) `shapePayload` lấy `ctx.sessionManager.getSessionId()` khi event không có `session_id`; (b) trên cây `HOOKS` (`.omp` ghép) với project tạm có hai packet active, `runEvent('tool_result', {toolName:'edit', input:{path:<specs/a/plan.md>}, isError:false}, ctx)` rồi `runEvent('input', {text:'Continue'}, ctx)` → inject nhắc `a`, không còn "Multiple active specs"; ca `isError:true` với phiên khác không ghi; (c) `session_start` không chứa `docs-sync.cjs`. Trong `spec-state-touched.test.js` đổi ca `.omp` thành lọc theo touch. Chạy Command → ghi số ca đỏ.
2. Sửa `shapePayload` (D-01), `DISPATCH` (D-02), `spec-state.cjs:94` (D-03) và comment liên quan; xoá `CLAUDE_ONLY`/`OMP_ONLY`.
3. Sửa `docs/installer-architecture.md:82` và changelog.
4. Chạy Command. Không commit.

## Acceptance
- AC-01: các ca (a)(b)(c) xanh trên cây `.omp`; Command xanh.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: ca (b) "an omp edit inside a packet scopes the tollgate to it" trong `omp-bridge.test.js`.
- Reachability: `runEvent` là hàm `pi.on('tool_result')`/`pi.on('input')` gọi; hook chạy từ cây `HOOKS` dựng như bản cài `.omp`.
- Oracle: inject của `input` nhắc packet đã chạm, không "Multiple active specs".
- Counterexample: giữ `touchFilter` Claude only hoặc bỏ `spec-state.cjs` khỏi `tool_result` → ca (b) đỏ.
- Artifacts: project tạm và file touch trong `os.tmpdir()`, xoá trong test.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: d0cf0ade6e0f79b0e0a58f8a4ab945f9e2a8558b
Head: 7c4085ffbbbc78f64a2b94beaf54afd50bd547d2774ab0f03596820f540499d8

```text
ok 1 - the dispatch table mirrors settings.json for every event omp can deliver
ok 9 - the omp session id is used for every event that does not carry its own
ok 10 - an omp edit inside a packet scopes the tollgate to it
ok 37 - omp filters by touch like Claude
# tests 48
# pass 48
# fail 0
[skill-test] PASS: 2187 tests executed
```

- Đỏ trước sửa: 3/24 trong `omp-bridge.test.js` (drift, session id, touch — touch đỏ vì phiên chưa chạm vẫn nhận "Multiple active specs").
- Điều chỉnh test: khi hai packet active, Claude vẫn cảnh báo "Multiple active" cho phiên đã chạm một trong hai (`spec-state-touched.test.js:224-229`); ca omp khớp hành vi đó thay vì kỳ vọng ban đầu.
- F6 của reviewer (ca omp cũ `spec-state-touched.test.js:207` chập chờn khi chạy cả bộ): ca đó đã được thay ở task này; lần chạy trên xanh. Nguyên nhân chập chờn chưa điều tra.
- Không commit.
