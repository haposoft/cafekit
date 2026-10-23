# Task 02 — Agent `advisor` + đăng ký + test

Status: done

## Outcome
`/cf:adv --agent` chạy quy trình qua agent `advisor` bằng relay; agent cài được cho Claude và Codex (D-03).

## Scope
- In: `agents/advisor.md`; mục `--agent` trong `skills/adv/references/optional-modes.md`; `advisor.md` vào `agents.required`; ca test agent trong `adv-skill.test.js`.
- Out: sửa `strategist`; plugin (task-03); các mục Out of scope của `plan.md`.

## Coverage
- CP-02

## Ownership
- Create: `packages/spec/src/claude/agents/advisor.md`
- Modify: `packages/spec/src/claude/skills/adv/references/optional-modes.md` (mục `--agent`), `packages/spec/bin/__tests__/adv-skill.test.js` (ca agent), `packages/spec/src/claude/migration-manifest.json` (chỉ dòng `"advisor.md"` trong `agents.required`), `packages/spec/bin/__tests__/claude-plugin-build.test.js` (chỉ số agent 13 → 14 ở tên test và assert)
- Read: `~/Desktop/cfk-ref/.claude/agents/advisor.md`, `~/Desktop/cfk-ref/.claude/skills/ak-advise/references/optional-modes.md`, `packages/spec/src/claude/agents/strategist.md`, `packages/spec/bin/lib/codex-install.js`, `packages/spec/bin/__tests__/codex-projection-parity.test.js`, `packages/spec/bin/__tests__/agent-authority.test.js`

## Steps
1. Viết ca test agent trước (theo D-03/D-05), và gỡ miễn trừ tên `advisor` của task-01: năm luật relay ở cả agent và `optional-modes.md`; dòng `tools` đúng D-03; không `memory:`; thân không nhắc tên model hay "Claude Code"; bản Codex `.codex/agents/advisor.toml` sau khi cài không khớp `/fable|strongest/i` và không nói `--agent` chỉ chạy trên Codex; ba đường dẫn tìm SKILL.md của advisor, cái ứng với runtime đã cài, có thật sau khi cài.
2. Chạy Verification Plan; phải đỏ (agent chưa có).
3. Viết `advisor.md` và mục `--agent` theo D-03; thêm `advisor.md` vào manifest.
4. Chạy Verification Plan; phải xanh. Phản ví dụ trên bản sao tạm của `advisor.md`: thêm `memory: project` thì ca "không `memory:`" hỏng.

## Acceptance
- AC-02: Command thoát 0; mỗi mệnh đề Step 1 có một ca; phản ví dụ hỏng như dự kiến.

## Dependencies
- task-01-skill.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/adv-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/agent-authority.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các ca agent trong `adv-skill.test.js`.
- Reachability: installer đọc `agents.required`; Codex chiếu qua `convertCodexAgentContent` (`packages/spec/bin/lib/codex-install.js`).
- Oracle: thoát 0, `fail 0`; self-test PASS không giảm.
- Counterexample: bản sao `advisor.md` có `memory: project` làm ca tương ứng hỏng.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/adv-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/agent-authority.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: afa2276502b31a89e885dddbcf3b71904310dd19
Head: b4e5202a7d3ccec31e4fb4528f1f885197efc781eb949b438b9de5cf4f538b55
```text
$ node --test packages/spec/bin/__tests__/adv-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/agent-authority.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261022-adv-task02.log (2030 dòng): tổng của từng đoạn node --test, tổng Node tests bên trong self-test, và dòng PASS của self-test
ℹ tests 41
ℹ pass 41
ℹ fail 0
ℹ tests 97
ℹ pass 97
ℹ fail 0
ℹ tests 1211
ℹ pass 1211
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2363 tests executed
Exit: 0
```
Trước sửa (Step 2, sau khi viết ca test agent): đoạn đầu `adv-skill.test.js` tests 41, pass 24, fail 17 (`ENOENT … agents/advisor.md`), nên Command dừng. Phản ví dụ: bản sao `advisor.md` có `memory: project` làm ca "không `memory:`" hỏng; file thật đạt. Review: code-auditor PASS_WITH_WARNINGS → sửa bốn Low (`preview_path` controller lưu preview, `Q<n>` kế tiếp kể cả câu xác nhận preview, ví dụ hai option, TOML Codex có assert dương) → PASS; Medium về root `AGENTS.md` bác vì `M AGENTS.md` đã có trong git status lúc mở phiên. Lần chạy trước sửa Low: `plans/20261022-adv-task02-r1.log` (PASS 2363).
