# Task 04 — Docs-keeper giữ WHY/WHERE; rule docs không đổi docs chỉ vì đổi phase

Status: done

## Outcome
Docs-keeper ghi lý do (WHY) và chỉ đường (WHERE), trỏ về mã/test/manifest cho WHAT/HOW, tách tầng bằng chứng, không tự thêm số đếm hay danh sách ngoài các tài liệu mà rule đã định nghĩa là chứa số liệu hoặc changelog; rule `manage-docs` không còn bắt cập nhật docs chỉ vì phase đổi trạng thái.

## Scope
- In: thêm mục ngắn vào `packages/spec/src/claude/agents/docs-keeper.md` (luật WHY/WHERE; tầng Intent / Current decisions / Current evidence / Stateful records; không chép số đếm, LOC, cây file, danh sách — trừ `development-roadmap.md` và `project-changelog.md` theo `packages/spec/src/claude/rules/manage-docs.md:9-12`; không tự thêm changelog/roadmap/ADR khi repo không đòi); bỏ dòng "A development phase transitions" ở `manage-docs.md:22`.
- Out: bảng Pre-Write Verification, repomix, Task Closeout Mode; câu cấm sẵn có ở `develop-contract.test.js:242-260`.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/claude/agents/docs-keeper.md`, `packages/spec/src/claude/rules/manage-docs.md`, `packages/spec/bin/__tests__/agent-instructions.test.js`
- Read: `~/Desktop/cfk-ref/.claude/agents/docs-manager.md`, `packages/spec/bin/__tests__/develop-contract.test.js`

## Steps
1. Thêm vào `agent-instructions.test.js`: docs-keeper có "Code owns WHAT and HOW" và "WHY and WHERE", có bốn tầng bằng chứng, có câu cấm số đếm kèm ngoại lệ roadmap/changelog; `manage-docs.md` không còn "development phase transitions". Chạy Command → đỏ.
2. Sửa hai file theo Scope bằng giọng CafeKit; không dùng chữ "legacy", "spec.json", "scope_lock" (bị cấm ở `develop-contract.test.js:242-260`).
3. Chạy lại Command → xanh.

## Acceptance
- AC-04: test mới xanh; `develop-contract` và `codex-native` không đỏ.

## Dependencies
- task-03-agent-naming-cleanup.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/develop-contract.test.js packages/spec/bin/__tests__/codex-native.test.js`
- Named probe: `docs-keeper keeps WHY and WHERE`, `manage-docs does not churn docs on a phase change` trong `agent-instructions.test.js`; ghim docs-keeper ở `develop-contract.test.js:242-260`; rule cài cho Codex ở `codex-native.test.js:262-272`.
- Reachability: test đọc thẳng nguồn; `codex-native` cài rule vào fixture Codex.
- Oracle: exit 0, số test > 0.
- Counterexample: còn dòng phase-transition, hoặc docs-keeper dùng chữ bị cấm → test đỏ.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/develop-contract.test.js packages/spec/bin/__tests__/codex-native.test.js
Exit: 0
Base: ca31cac5dea6afbf5e31e4213d85b7b0260e33b1
Head: 8bf00c4de0cd8a97c068e3b3178ef5adc0ff05e99a544897bea98ac63d1576d8
```text
$ node --test packages/spec/bin/__tests__/agent-instructions.test.js packages/spec/bin/__tests__/develop-contract.test.js packages/spec/bin/__tests__/codex-native.test.js
✔ docs-keeper keeps WHY and WHERE (0.238209ms)
✔ manage-docs does not churn docs on a phase change (0.216833ms)
ℹ tests 92
ℹ pass 92
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
Rerun at the final Head. Pre-change run: `docs-keeper keeps WHY and WHERE` and `manage-docs does not churn docs on a phase change` failed. Review: code-auditor PASS after one repair round. The installed `.claude/rules/manage-docs.md` keeps the old line until a reinstall.
