# Task 05 — Installer Codex ghi mỗi file một lần; bỏ cấu hình chết

Status: pending

## Outcome
Cài đè Codex y nguyên không báo lib/rule cập nhật và không cài shim; `usage`, `scripts.required`, nhánh `resolve_env.py` không còn.

## Scope
- In: D-08 (`bin/phases/codex-runtime.js:85-153,201-203`, xoá `src/codex/rules/state-sync.md`); D-10 (`src/claude/runtime.json:29-31`, khối `scripts` của `src/claude/migration-manifest.json`, `ai-multimodal/scripts/check_setup.py:88-…`, `gemini_batch_process.py:30,79,93`); changelog.
- Out: nhánh obsolete (task-06); node `usage` trong schema; uninstall.

## Coverage
- CP-05

## Ownership
- Modify: `bin/phases/codex-runtime.js` (trừ nhánh obsolete), `bin/phases/claude-runtime.js` (chỉ `copyRulesDirectory` nếu cần tham số bỏ qua), `src/claude/runtime.json`, `src/claude/migration-manifest.json`, `src/claude/skills/ai-multimodal/scripts/check_setup.py`, `src/claude/skills/ai-multimodal/scripts/gemini_batch_process.py`, `bin/__tests__/installer-safety.test.js`, hai changelog
- Delete: `src/codex/rules/state-sync.md`
- Probe tĩnh: `scripts/run-skill-self-tests.mjs:2881,2897` (`codexState` trỏ sang `src/claude/rules/state-sync.md`), `:5084-5092`, `:5193` (bỏ điều kiện `scripts.required`).
- Read: `bin/lib/managed-writer.js`, `bin/__tests__/codex-hooks.test.js`, `codex-hooks-ownership.test.js`, `runtime-schema.test.js`

## Steps
1. Thêm test vào `installer-safety.test.js`: cài Codex hai lần vào thư mục tạm; lần hai không có dòng `↻` nào cho các nhãn `Codex native hooks`, `Codex privacy command analyzer`, `Codex privacy path analyzer`, `Codex secret keyword matcher`, `Codex runtime path safety`, `Codex inspection path analyzer`, `Codex spec touch helpers`, `Codex update check`, `Codex native rule overrides` và nhãn thư mục rule (dòng metadata phiên bản được phép); kiểm trên code cũ ca này đỏ; mọi lib đã cài khớp byte bản nguồn tương ứng và không file nào khớp mẫu shim D-08; `.claude/runtime.json` đã cài (cài Claude) không có `usage`; manifest không có `scripts.required`. Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-05: các ca đúng; Command xanh.

## Dependencies
- task-04-codex-text-converter.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-hooks-ownership.test.js packages/spec/bin/__tests__/codex-quiet-hooks.test.js packages/spec/bin/__tests__/runtime-schema.test.js packages/spec/bin/__tests__/package-inventory.test.js && python3 -m py_compile packages/spec/src/claude/skills/ai-multimodal/scripts/check_setup.py packages/spec/src/claude/skills/ai-multimodal/scripts/gemini_batch_process.py && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test mới về ghi một lần và cấu hình chết.
- Reachability: installer thật trên thư mục tạm; hook Codex chạy từ source qua shim.
- Oracle: Oracle chung của plan.
- Counterexample: nhận shim theo "một dòng" → lib 3 dòng bị chép nguyên, ca shim đỏ.
- Artifacts: `__pycache__` do `py_compile` sinh trong `src/` phải xoá trước khi commit.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
