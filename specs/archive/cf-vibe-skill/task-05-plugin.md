# Task 05 — Plugin có `cf:vibe`

Status: done

## Outcome
Bản plugin `cf` build lại có `cf:vibe`, câu ngoại lệ trong `plugin/core.md`, chế độ PR của code-review và `pr --base`.

## Scope
- In: chạy `node packages/spec/scripts/build-claude-plugin.mjs`.
- Out: sửa script build; các mục Out of scope của `plan.md`.

## Coverage
- CP-03

## Ownership
- Modify: `plugins/cf/**` (sinh bằng build)

## Steps
1. Chạy Verification Plan trước khi build; phải đỏ.
2. Build.
3. Chạy Verification Plan; phải xanh; `git status --short plugins` chỉ có file liên quan tới gói này.

## Acceptance
- AC-04 (phần plugin): Command thoát 0.

## Dependencies
- task-04-vibe-skill.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && test -f plugins/cf/skills/vibe/SKILL.md && test -f plugins/cf/skills/code-review/references/pr-fix-reply.md && grep -q 'delegated (cf:vibe)' plugins/cf/plugin/core.md && grep -q -- '--base' plugins/cf/skills/git/SKILL.md`
- Named probe: `claude-plugin-build.test.js`.
- Reachability: build đọc `skills.required` và `plugin/core.md` (`packages/spec/scripts/build-claude-plugin.mjs:35-46,156`).
- Oracle: thoát 0.
- Counterexample: không build thì `plugins/cf/skills/vibe/SKILL.md` vắng, lệnh hỏng.
- Artifacts: `plugins/cf/` (commit).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && test -f plugins/cf/skills/vibe/SKILL.md && test -f plugins/cf/skills/code-review/references/pr-fix-reply.md && grep -q 'delegated (cf:vibe)' plugins/cf/plugin/core.md && grep -q -- '--base' plugins/cf/skills/git/SKILL.md
Exit: 0
Base: fd08e0b493be715efb41293f6ff6b51120068ec5
Head: a9298d889cc33696d96e61a6f415e3622a948604e6ead570322eaf4de57cc6e6
```text
$ node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && test -f plugins/cf/skills/vibe/SKILL.md && test -f plugins/cf/skills/code-review/references/pr-fix-reply.md && grep -q 'delegated (cf:vibe)' plugins/cf/plugin/core.md && grep -q -- '--base' plugins/cf/skills/git/SKILL.md
✔ inventory: 17 in-scope skills, 14 agents, no excluded component (35.622542ms)
✔ no-dot-claude-path: Markdown keeps no .claude runtime path and no unsubstituted root (6.230875ms)
✔ hook-commands: every hook runs from the plugin root and exists (0.213375ms)
✔ hook-smoke: every registered hook exits 0 in the built tree without a crash (1741.053667ms)
✔ agent-names-resolve: agents are called by their namespaced name and exist (14.097833ms)
✔ check-detects-drift: --check fails after one byte changes in a copy (370.923541ms)
✔ build refuses to wipe a non-empty directory that is not a cf build (0.654166ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2324.61325
Exit: 0
```
Trước build: Command thoát 1 (`plugins/cf/skills/vibe/SKILL.md` chưa có). Build: `node packages/spec/scripts/build-claude-plugin.mjs` → `built plugin cf into …/plugins/cf`; `git status --short plugins`: 16 file sửa (câu ngoại lệ/câu trỏ, `pr --base`, chế độ PR của code-review) và 2 mục mới (`skills/code-review/references/pr-fix-reply.md`, `skills/vibe/`). Review: code-auditor PASS (121 file `.md` khớp nguồn sau phép biến đổi của build; `plugin/core.md` 7547 < 10000 có đủ câu ngoại lệ; link của vibe kể cả `../adv/references/ultra-mode.md` phân giải trong plugin; `cf:strategist`, `cf:docs-keeper` có trong `agents/`).
