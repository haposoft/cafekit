# Task 02 — Gỡ lệch giữa description và thân của specs và fix

Status: done

## Outcome
Thân `specs` công nhận yêu cầu thêm/đổi tính năng là yêu cầu (Step 0 vẫn quyết làm thẳng hay lập packet); thân `fix` nói rõ Fix áp dụng giao thức chẩn đoán kiểu `cf:debug` tại chỗ và gọi `cf:debug` là tuỳ chọn, khớp description mà không đổi hành vi.

## Scope
- In: vế sau của câu `packages/spec/src/claude/skills/specs/SKILL.md:29` (giữ nguyên vế "Do not create a plan merely because documentation mentions this skill" đang ghim ở `run-skill-self-tests.mjs:5440`); câu **Diagnosis** ở `packages/spec/src/claude/skills/fix/SKILL.md:103`.
- Out: mọi `description:`; Step 0 của specs; luồng gọi `cf:debug`.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/specs/SKILL.md`, `packages/spec/src/claude/skills/fix/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`

## Steps
1. Trong `run-skill-self-tests.mjs`: kiểm thân specs không còn "the user must invoke Specs or ask for durable planning", có câu "a request to add, build or change a capability is one" và có nhắc Step 0; thân fix không còn "neither is a required call", có câu Fix áp dụng giao thức chẩn đoán kiểu `cf:debug` tại chỗ và gọi `cf:debug` là tuỳ chọn, và không có câu bảo gọi `cf:debug` theo mặc định (`/cf:debug\b[^.]*\bby default\b/i`). Chạy Command → đỏ.
2. `specs/SKILL.md:29`: giữ vế đầu nguyên văn; thay vế sau bằng "; a request to add, build or change a capability is one, and Step 0 still decides whether it needs a packet."
3. `fix/SKILL.md:103`: thay vế "`cf:debug` may help and `--from-debug` validates its report, but neither is a required call;" bằng câu theo D-02, giữ nguyên phần còn lại của đoạn.
4. Chạy Command → xanh.

## Acceptance
- AC-02: hai câu cũ biến mất, hai câu mới có mặt, không dòng `description:` nào đổi.

## Dependencies
- task-01-develop-refactor-lane.md

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs && test -z "$(git diff -U0 HEAD -- packages/spec/src/claude/skills/specs/SKILL.md packages/spec/src/claude/skills/fix/SKILL.md | grep -E '^[-+]description:')"`
- Named probe: kiểm mới cho thân specs/fix trong `run-skill-self-tests.mjs`; vế `git diff` khẳng định không dòng `description:` nào đổi.
- Reachability: self-test đọc hai SKILL.md trực tiếp.
- Oracle: exit 0, `[skill-test] PASS`.
- Counterexample: thân fix bảo gọi `cf:debug` mặc định, còn câu cũ, hoặc một dòng `description:` bị sửa → exit khác 0.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs && test -z "$(git diff -U0 HEAD -- packages/spec/src/claude/skills/specs/SKILL.md packages/spec/src/claude/skills/fix/SKILL.md | grep -E '^[-+]description:')"
Exit: 0
Base: ca31cac5dea6afbf5e31e4213d85b7b0260e33b1
Head: 8bf00c4de0cd8a97c068e3b3178ef5adc0ff05e99a544897bea98ac63d1576d8
```text
$ node packages/spec/scripts/run-skill-self-tests.mjs && test -z "$(git diff -U0 HEAD -- packages/spec/src/claude/skills/specs/SKILL.md packages/spec/src/claude/skills/fix/SKILL.md | grep -E '^[-+]description:')"
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
Rerun at the final Head; the `git diff` guard printed nothing and the chain exited 0. Pre-change runs: `[FAIL] Specs body treats a request to add, build or change a capability as a request and leaves Step 0 to decide`, then `[FAIL] Fix body applies the diagnosis protocol inline, makes cf:debug optional, and never calls it by default`. Review: code-auditor PASS (Low: `fix/references/diagnosis-protocol.md:3` still says "Prefer running cf:debug directly" — outside ownership).
