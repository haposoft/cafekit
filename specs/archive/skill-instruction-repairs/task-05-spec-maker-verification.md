# Task 05 — Spec-maker tự chạy các vai review trước khi chốt plan

Status: done

## Outcome
Trước khi chốt plan, spec-maker tự chạy các vai Fact Checker, Flow Tracer, Scope Auditor của `review.md` trên claim của chính nó, thay vì chép lại danh sách kiểm (luật A3).

## Scope
- In: một câu cuối mục `### 1. Inspect before asking` của `packages/spec/src/claude/agents/spec-maker.md:27-31`, trỏ tới bảng Reviewer roles trong `.claude/skills/specs/references/review.md`.
- Out: các bước khác của spec-maker; `review.md`.

## Coverage
- CP-05

## Ownership
- Modify: `packages/spec/src/claude/agents/spec-maker.md`, `packages/spec/bin/__tests__/agent-instructions.test.js`
- Read: `packages/spec/src/claude/skills/specs/references/review.md`, `packages/spec/bin/__tests__/package-inventory.test.js`

## Steps
1. Thêm vào `agent-instructions.test.js`: spec-maker trỏ `review.md` và nêu đủ ba vai Fact Checker, Flow Tracer, Scope Auditor. Chạy Command → đỏ.
2. Thêm câu theo Scope, không chen vào các câu đang ghim ở `run-skill-self-tests.mjs:677-679`, `:986`, `:1070` và `package-inventory.test.js:1343-1348`, `:1801`.
3. Chạy lại Command → xanh.

## Acceptance
- AC-05: test mới xanh; bản Codex, self-test và package-inventory không đỏ.

## Dependencies
- task-04-docs-keeper-why-where.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: `spec-maker runs the review roles on its own claims` trong `agent-instructions.test.js`; ghim spec-maker trong self-test và `package-inventory.test.js`.
- Reachability: test đọc thẳng nguồn; `codex-native` chuyển spec-maker sang TOML (`codex-native.test.js:34`).
- Oracle: exit 0, số test > 0, `[skill-test] PASS`.
- Counterexample: thiếu con trỏ `review.md`, hoặc câu mới làm vỡ một câu ghim → đỏ.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: ca31cac5dea6afbf5e31e4213d85b7b0260e33b1
Head: 8bf00c4de0cd8a97c068e3b3178ef5adc0ff05e99a544897bea98ac63d1576d8
```text
$ node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
✔ spec-maker runs the review roles on its own claims (0.176083ms)
ℹ tests 67
ℹ pass 67
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
✔ spec-maker runs the review roles on its own claims (0.189708ms)
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
Pre-change run: `spec-maker runs the review roles on its own claims` failed against the HEAD spec-maker. Process deviation: that negative control overwrote the tracked `spec-maker.md` with the HEAD bytes for one run instead of a disposable copy; the edited file was restored and `cmp` confirmed it byte-identical before this proof. Review: code-auditor PASS after one repair round (pointer pinned next to the role names; self-check does not replace the fresh review).
