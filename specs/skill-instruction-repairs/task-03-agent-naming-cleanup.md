# Task 03 — Dọn Naming; debugger chỉ chạy test để tái hiện lỗi

Status: done

## Outcome
`debugger` và `project-manager` không còn trỏ tới mục `## Naming` mà không hook nào sinh; `debugger` được dặn chạy test đang fail hoặc lệnh tái hiện lỗi, không chạy test để xác nhận bản sửa.

## Scope
- In: `packages/spec/src/claude/agents/debugger.md:91` và `:121-123`; `packages/spec/src/claude/agents/project-manager.md:49`.
- Out: `debugger.md:18` (chạy test để chẩn đoán, giữ nguyên); agent khác; `frontend-design` references.

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/agents/debugger.md`, `packages/spec/src/claude/agents/project-manager.md`, `packages/spec/scripts/run-skill-self-tests.mjs` (chỉ khi một ghim debugger ở `:2998-3182` trùng câu bị sửa)
- Create: `packages/spec/bin/__tests__/agent-instructions.test.js`

## Steps
1. Tạo `agent-instructions.test.js`: mọi file trong `packages/spec/src/claude/agents/` không chứa `## Naming` hay "Naming Hooks"; `debugger.md` không khớp `/run (unit|integration) tests/i` và có câu "Run the failing test or reproduction command; do not run tests to verify a fix". Chạy Command → đỏ.
2. `debugger.md:91`: thay dòng Testing Frameworks bằng câu ở Step 1. `debugger.md:121-123` và `project-manager.md:49`: thay bằng D-03.
3. Chạy lại Command → xanh.

## Acceptance
- AC-03: test mới xanh trên cả thư mục agents; self-test không đỏ.

## Dependencies
- task-02-specs-fix-consistency.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: `agent sources reference no hook-injected Naming section`, `debugger runs tests only to reproduce` trong `agent-instructions.test.js`; các ghim debugger trong self-test (`run-skill-self-tests.mjs:2998-3182`).
- Reachability: test đọc thẳng `packages/spec/src/claude/agents/*.md`; `codex-native` chuyển agent sang TOML.
- Oracle: exit 0, số test > 0, `[skill-test] PASS`.
- Counterexample: còn `## Naming` ở một agent, hoặc debugger còn được dặn chạy unit/integration test → test đỏ.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: ca31cac5dea6afbf5e31e4213d85b7b0260e33b1
Head: 8bf00c4de0cd8a97c068e3b3178ef5adc0ff05e99a544897bea98ac63d1576d8
```text
$ node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
✔ agent sources reference no hook-injected Naming section (1.485333ms)
✔ debugger runs tests only to reproduce (0.196291ms)
ℹ tests 50
ℹ pass 50
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
✔ agent sources reference no hook-injected Naming section (2.891166ms)
✔ debugger runs tests only to reproduce (0.256334ms)
ℹ tests 1170
ℹ pass 1170
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
[skill-test] PASS: 2313 tests executed
```
Rerun at the final Head. Pre-change run: both new tests failed. Review: code-auditor PASS (Low: narrow old-wording regex; debugger writes a controller-named report through Bash).
