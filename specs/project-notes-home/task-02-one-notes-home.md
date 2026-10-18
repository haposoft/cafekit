# Task 02 — Một câu chỉ nơi ghi chú project

Status: pending

## Outcome
Template `CLAUDE.md`, khối Codex `AGENTS.md` và README cùng chứa câu D-02.

## Scope
- In: D-02 ở `src/claude/CLAUDE.md` (biến thể Claude, không có chữ Codex), `src/codex/AGENTS.md` (biến thể Codex), `README.md` (câu đầy đủ, ngay sau câu cam kết `:102-103` giữ nguyên, và sau đoạn kết thúc ở `:139`); test; hai changelog.
- Out: `src/common/AGENTS.md`; docs khác.

## Coverage
- CP-02

## Ownership
- Modify: `src/claude/CLAUDE.md`, `src/codex/AGENTS.md`, `README.md`, `bin/__tests__/installer-safety.test.js`, hai changelog
- Probe tĩnh: `scripts/run-skill-self-tests.mjs:2882-2883,4815-4851` và `bin/__tests__/skill-routing-source.test.js:85` nếu ghim chữ bị đổi; chỉ theo câu mới.

## Steps
1. Thêm test vào `installer-safety.test.js` (so chữ sau khi chuẩn hoá khoảng trắng): cài `claude` và `codex` vào thư mục tạm; khối CafeKit trong `CLAUDE.md` chứa biến thể Claude (có `` `@AGENTS.md` `` trong backtick, không có `@AGENTS.md.` trần) và vẫn không có `Codex`; khối Codex trong `AGENTS.md` chứa biến thể Codex; `README.md` chứa câu đầy đủ và vẫn chứa câu cam kết "CafeKit owns only its marked block inside the project-root `CLAUDE.md`". Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-02: các ca đúng; Command xanh.

## Dependencies
- task-01-tracked-root-preflight.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/skill-routing-source.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test câu chuẩn mới.
- Reachability: installer thật trên thư mục tạm.
- Oracle: Oracle chung của plan.
- Counterexample: bỏ câu khỏi khối Codex → ca Codex đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
