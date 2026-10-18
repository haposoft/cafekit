# Task 03 — State omp theo phiên

Status: done

## Outcome
`state.cjs` dưới `.omp` dùng thư mục state theo `session_id` như dưới `.claude`; SessionStart omp bỏ snapshot chỉ có placeholder như Claude.

## Scope
- In: D-04; doc installer nếu nhắc; hai changelog.
- Out: grok (gửi `sessionId` camelCase, giữ nguyên); Codex.

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/hooks/state.cjs`, `packages/spec/src/claude/hooks/__tests__/state.test.js`, `docs/installer-architecture.md`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`

## Steps
1. Test trước: đổi ca `SessionStart under .omp keeps printing placeholder-only context` (`state.test.js:395`) thành omp bỏ placeholder như Claude; thêm ca hai phiên `.omp` không thấy state của nhau. Chạy Command → ghi số ca đỏ.
2. Sửa `state.cjs:304` và comment `:309`.
3. Doc + changelog.
4. Chạy Command. Không commit.

## Acceptance
- AC-03: ca mới xanh; Command xanh.

## Dependencies
- task-01-bridge-dispatch.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/state.test.js packages/spec/bin/__tests__/omp-bridge.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: ca hai phiên `.omp` trong `state.test.js`.
- Reachability: `state.cjs` chạy từ `<root>/.omp/hooks` như bản cài.
- Oracle: phiên B không in state của phiên A.
- Counterexample: giữ điều kiện `.claude` → ca đỏ.
- Artifacts: thư mục tạm, xoá trong test.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/state.test.js packages/spec/bin/__tests__/omp-bridge.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: d0cf0ade6e0f79b0e0a58f8a4ab945f9e2a8558b
Head: d8ba97505974759bd784712e26510c340d98ff5f1f4f61bed9e32b19e09902c7

```text
ok 20 - SessionStart under .omp drops placeholder-only context like Claude
ok 21 - two omp sessions keep separate state
# tests 34
# pass 34
# fail 0
[skill-test] PASS: 2189 tests executed
```

- Đỏ trước sửa: 1/24 trong `state.test.js` ("two omp sessions keep separate state": cùng phiên không đọc được state của mình). Ca placeholder xanh cả trước sửa (đọc thư mục gốc rỗng) nên không tính là bằng chứng; ca hai phiên là counterexample.
- Không commit.
