# Task 03 — Bản plugin có `cf:adv`

Status: done

## Outcome
Bản plugin `cf` build lại có `cf:adv` và `advisor`; test plugin xanh (D-06).

## Scope
- In: chạy build để sinh lại `plugins/cf` (số đếm của test plugin đã sửa ở task-01/02).
- Out: sửa `build-claude-plugin.mjs`; các mục Out of scope của `plan.md`.

## Coverage
- CP-03

## Ownership
- Modify: `plugins/cf/**` (sinh bằng build)
- Read: `packages/spec/scripts/build-claude-plugin.mjs`

## Steps
1. Chạy Verification Plan trước khi build; phải đỏ (`plugins/cf/skills/adv/SKILL.md` chưa có).
2. Chạy `node packages/spec/scripts/build-claude-plugin.mjs`.
3. Chạy Verification Plan; phải xanh.

## Acceptance
- AC-03: Command thoát 0; `plugins/cf/skills/adv/SKILL.md` tồn tại; `optional-modes.md` trong cây plugin có nhánh thiếu `ui-ux-designer`.

## Dependencies
- task-02-advisor-agent.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && test -f plugins/cf/skills/adv/SKILL.md && test -f plugins/cf/agents/advisor.md && grep -q 'ui-ux-designer' plugins/cf/skills/adv/references/optional-modes.md`
- Named probe: `claude-plugin-build.test.js`.
- Reachability: build đọc `skills.required` và thư mục `agents/` (`build-claude-plugin.mjs:35-46`).
- Oracle: thoát 0, `fail 0`.
- Counterexample: không build lại thì `plugins/cf/skills/adv/SKILL.md` vắng, lệnh hỏng.
- Artifacts: `plugins/cf/` (commit).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && test -f plugins/cf/skills/adv/SKILL.md && test -f plugins/cf/agents/advisor.md && grep -q 'ui-ux-designer' plugins/cf/skills/adv/references/optional-modes.md
Exit: 0
Base: afa2276502b31a89e885dddbcf3b71904310dd19
Head: 852ed85d528caca653c48b8c8c7881f5f719801fa8816433ee785d475f47e3c0
```text
$ node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && test -f plugins/cf/skills/adv/SKILL.md && test -f plugins/cf/agents/advisor.md && grep -q 'ui-ux-designer' plugins/cf/skills/adv/references/optional-modes.md
✔ inventory: 16 in-scope skills, 14 agents, no excluded component (33.212ms)
✔ no-dot-claude-path: Markdown keeps no .claude runtime path and no unsubstituted root (6.081334ms)
✔ hook-commands: every hook runs from the plugin root and exists (0.2135ms)
✔ hook-smoke: every registered hook exits 0 in the built tree without a crash (1740.886084ms)
✔ agent-names-resolve: agents are called by their namespaced name and exist (13.845625ms)
✔ check-detects-drift: --check fails after one byte changes in a copy (356.509791ms)
✔ build refuses to wipe a non-empty directory that is not a cf build (0.595417ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2300.872458
Exit: 0
```
Trước build: Command thoát 1 (`plugins/cf/skills/adv/SKILL.md` chưa có). Build: `node packages/spec/scripts/build-claude-plugin.mjs` → `built plugin cf into …/plugins/cf`; `git status --short plugins` chỉ còn `plugins/cf/agents/advisor.md` và `plugins/cf/skills/adv/` mới, `git diff plugins` rỗng. Review: code-auditor PASS (khác nguồn chỉ ở tiền tố `cf:` cho agent đã ship và `${CLAUDE_PLUGIN_ROOT}` trong `advisor.md`; nhánh thiếu `ui-ux-designer` còn ở bản plugin). Low để nguyên: trong bản plugin, đường dẫn tìm skill thứ nhất và thứ ba của `advisor` trùng nhau, vô hại.
