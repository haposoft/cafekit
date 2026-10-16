# Task 04 — Bộ chuyển đổi văn bản Codex không nói sai

Status: pending

## Outcome
Văn bản cài cho Codex không còn giao thức Team (vẫn giữ luật không thuộc Team), danh sách hai host trùng lặp, cách hỏi người dùng mâu thuẫn, "Codex CLI's own worktree"; usage catalog đúng root.

## Scope
- In:
  - D-05 khi chuyển agent (`git-ops.md:10-18`, `project-manager.md:55-63`).
  - D-06 cho nội dung `isInstructionAsset` (đường dẫn rỗng tính là instruction, để bản có và không có `sourcePath` giống nhau) (`git/SKILL.md:27`, `worktree-blueprint.md:50,73,78`, `ask/SKILL.md:65`, `docs/references/init-workflow.md:17`); nguồn Claude `git/SKILL.md:27` "Claude Code's own worktree" → "the host's own worktree"; `worktree-blueprint.md:22` viết trung tính về host (thư mục worktree lồng do host hoặc người dùng tạo dưới runtime đã bị ignore).
  - D-07 (`codex-install.js:211-247`; nguồn `git/SKILL.md:18`, `scout/SKILL.md:22`, `sync/references/rebind-and-audit.md:50`, `brainstorm/SKILL.md:75`, `brainstorm/references/question-framework.md:135,150`).
  - `generate-skill-catalog.cjs:30`: text usage đúng root sau chuyển đổi.
  - Changelog.
- Out: agent TOML ngoài phần Team; nội dung skill khác.

## Coverage
- CP-04

## Ownership
- Modify: `bin/lib/codex-install.js` (`normalizeCodexBody`, `normalizeRuntimePaths`, `normalizeAskUserQuestion`, phần Team của `convertCodexAgentContent`), `src/claude/skills/git/SKILL.md`, `src/claude/skills/git/references/worktree-blueprint.md` (dòng 22), `src/claude/scripts/generate-skill-catalog.cjs` (dòng usage), `bin/__tests__/codex-projection-parity.test.js`, `bin/__tests__/codex-native.test.js` (ca ghim "structured user-input request" ở `:826-829,1380-1435,1490-1520` và `:819`), hai changelog
- Probe tĩnh: `scripts/run-skill-self-tests.mjs:1283` (câu "native input tool") và mọi probe ghim chữ `git/SKILL.md:27`/`worktree-blueprint.md:22`, chỉ theo đúng câu mới.

## Steps
1. Thêm test vào `codex-projection-parity.test.js`: cài Codex kèm document skills vào thư mục tạm, quét mọi `.md`/`.toml` dưới `.agents/skills`, `.codex`:
   - không khớp `/(\.codex\/?)[\s,`]+\1/`, `/(`?AGENTS\.md`?)[\s,]+\1/`, `AskUserQuestion`, `structured user-input`, `native input tool`, `native structured`, `Codex CLI's own worktree`, `.codex/worktrees/`;
   - `git_ops.toml`, `project_manager.toml` không chứa `send_message(type`, `shutdown_`, `task-state inspection`; vẫn chứa câu force push của `git-ops.md:15` và câu "incomplete packet returns to the planning owner";
   - `worktree-blueprint.md` Codex còn `.claude` trong danh sách cần chép; `ask/SKILL.md` Codex còn `CLAUDE.md`; đường dẫn một host như `.codex/scripts/` vẫn được đổi;
   - `node .codex/scripts/generate-skill-catalog.cjs --help` không có `for Claude` cạnh `.agents/skills`.
   So chữ sau khi chuẩn hoá khoảng trắng (TOML ngắt dòng thành `\n`). Chạy Command trước khi sửa; ghi số ca đỏ; mọi needle trừ `AskUserQuestion` và hai câu giữ lại (chỉ chống hồi quy) phải có ít nhất một ca đỏ.
2. Sửa; cập nhật ca ghim trong `codex-native.test.js` theo câu D-07; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-04: các ca đúng; Command xanh.

## Dependencies
- task-03-codex-rules-reach.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-specs-projection.test.js packages/spec/bin/__tests__/codex-research-projection.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test quét văn bản Codex mới.
- Reachability: installer thật trên thư mục tạm.
- Oracle: Oracle chung của plan.
- Counterexample: khôi phục phép đổi `AskUserQuestion` cũ → ca `structured user-input` đỏ; cắt cả mục Team → ca câu force push đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
