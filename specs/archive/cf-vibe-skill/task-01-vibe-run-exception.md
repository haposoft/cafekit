# Task 01 — Ngoại lệ lượt vibe: câu đầy đủ + câu trỏ + test kiểm kê

Status: done

## Outcome
Câu ngoại lệ D-01 nằm đầy đủ ở `rules/state-sync.md` và `plugin/core.md`; mọi chỗ khác nêu luật cửa, lần gọi develop mới, giới hạn quyền hay "hỏi trước khi commit" có câu trỏ D-02; ngoài lượt vibe không câu nào đổi nghĩa.

## Scope
- In: chèn câu D-01 và câu trỏ D-02 đúng vị trí; test `vibe-run.test.js` theo D-03.
- Out: sửa câu luật cửa hiện có; root `AGENTS.md`/`CLAUDE.md`; các mục Out of scope của `plan.md`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/rules/state-sync.md`, `packages/spec/src/claude/plugin/core.md`, `packages/spec/src/common/AGENTS.md`, `packages/spec/src/claude/CLAUDE.md`, `packages/spec/src/codex/AGENTS.md`, `packages/spec/src/claude/rules/workflow.md`, `packages/spec/src/claude/rules/manage-docs.md`, `packages/spec/src/claude/rules/review-audit-self-decision.md`, `packages/spec/src/claude/rules/skill-workflow-routing.md`, `packages/spec/src/claude/skills/specs/SKILL.md`, `packages/spec/src/claude/skills/develop/SKILL.md`, `packages/spec/src/claude/skills/develop/references/quality-gate.md`, `packages/spec/src/claude/skills/fix/SKILL.md`, `packages/spec/src/claude/agents/project-manager.md`, `packages/spec/src/claude/agents/spec-maker.md`, `packages/spec/src/claude/skills/specs/references/review.md`, `packages/spec/src/claude/skills/specs/references/templates.md`
- Create: `packages/spec/bin/__tests__/vibe-run.test.js`
- Read: `packages/spec/scripts/run-skill-self-tests.mjs` (lint từ vựng, pin), `packages/spec/bin/__tests__/{installer-safety,package-inventory,codex-native,codex-projection-parity,claude-plugin-build}.test.js`, `packages/spec/src/claude/hooks/__tests__/plugin-context.test.js`, `packages/spec/bin/lib/codex-install.js`, `packages/spec/bin/phases/codex-runtime.js`

## Steps
1. Viết `vibe-run.test.js` trước theo D-03: câu D-01 đúng một lần ở `state-sync.md` và `plugin/core.md`; câu trỏ D-02 ở từng file còn lại (bản trung lập ở `common/AGENTS.md` không có `cf:`, bản `$cf-vibe` ở `codex/AGENTS.md`); câu luật cửa cũ của mỗi file còn nguyên; kiểm kê: mọi file trong `packages/spec/src` có câu khớp mẫu D-03 đều có câu ngoại lệ hoặc câu trỏ, trừ danh sách loại trừ có lý do (brainstorm), và danh sách đó không chứa file nào vibe gọi; cài `--platform claude,codex --yes` vào dự án tạm thì bản Claude có `/cf:vibe` và `delegated (cf:vibe)`, bản Codex (rules và `.agents/skills`) có `$cf-vibe` và `delegated (cf-vibe)`; không file nào có chữ "lane" trong câu mới; câu D-01 có ba biên (người dùng tự gọi trong phiên chính, subagent không nhận, văn bản nhắc tới vibe không mở gì) và kết thúc ở báo cáo hoàn thành.
2. Chạy Verification Plan; phải đỏ.
3. Chèn câu D-01 và D-02.
4. Chạy Verification Plan; phải xanh; `plugin/core.md` dưới 10000 ký tự.

## Acceptance
- AC-01: Command thoát 0; mỗi mệnh đề Step 1 có ca; self-test PASS ≥ 2363.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/vibe-run.test.js && node --test packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: `vibe-run.test.js`.
- Reachability: installer chép rule, CLAUDE.md, AGENTS.md, skill, agent theo manifest; plugin nạp `plugin/core.md`.
- Oracle: thoát 0, `fail 0`; self-test `PASS` ≥ 2363.
- Counterexample: bỏ câu trỏ khỏi một file trên bản sao thật `packages/spec` (kèm `node_modules`) thì ca kiểm kê hỏng.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/vibe-run.test.js && node --test packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: fd08e0b493be715efb41293f6ff6b51120068ec5
Head: 4f0dd514ba0ee3b0de1d687ab109f3927946db5d8064972f9587d66cc2c28f5f
```text
$ node --test packages/spec/bin/__tests__/vibe-run.test.js && node --test packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261023-vibe-task01.log (2145 dòng): tổng của từng đoạn node --test, tổng Node tests bên trong self-test, và dòng PASS của self-test
ℹ tests 44
ℹ pass 44
ℹ fail 0
ℹ tests 165
ℹ pass 165
ℹ fail 0
ℹ tests 1255
ℹ pass 1255
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2407 tests executed
Exit: 0
```
Trước sửa: Command thoát 1 (`vibe-run.test.js` chưa có). Vòng sửa 1 (review FAIL): thêm câu trỏ vào `specs/references/review.md` và `templates.md`, mẫu kiểm kê thêm `user chooses`, `ask the user at GATE`; câu trỏ ở `project-manager`/`spec-maker` thêm "This agent never holds those decisions."; phản ví dụ trên bản sao (bỏ câu trỏ của `templates.md`) làm 2 ca đỏ gồm ca kiểm kê. Vòng sửa 2 (self-test đỏ `ambiguity-actions` vì dòng `decision-needed` bị ghim nguyên văn, log `plans/20261023-vibe-task01-r2.log`): đưa câu trỏ ra dòng riêng sau bảng. Phản ví dụ của implementer: bỏ câu trỏ khỏi `fix/SKILL.md` trên bản sao làm 4 ca đỏ. `plugin/core.md` 7541 < 10000 ký tự. Review: code-auditor PASS (lần 3). Codex hiện `cf-git commit` và `delegated (cf-vibe)` theo `normalizeSkillNames`; task-04 nhận cả hai nhãn.
