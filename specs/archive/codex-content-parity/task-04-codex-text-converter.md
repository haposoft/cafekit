# Task 04 — Bộ chuyển đổi văn bản Codex không nói sai

Status: done

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

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-specs-projection.test.js packages/spec/bin/__tests__/codex-research-projection.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: 812fab19fdf8e300b7bfb88dc93a2acebd517354
Head: 6ec2f7fbf821069aadef09ccda56a57d1da432a3661d8959d8ed0992f1768e58

```text
ok 47 - installed Codex instruction corpus excludes duplicate runtime roots
ok 48 - installed Codex instruction corpus excludes duplicate instruction filenames
ok 49 - installed Codex instruction corpus excludes AskUserQuestion
ok 50 - installed Codex instruction corpus excludes structured user-input
ok 51 - installed Codex instruction corpus excludes native input tool
ok 52 - installed Codex instruction corpus excludes native structured
ok 53 - installed Codex instruction corpus excludes Codex CLI own worktree
ok 54 - installed Codex instruction corpus excludes runtime-specific nested worktree path
ok 55 - installed Codex agents omit Team protocol send_message(type
ok 56 - installed Codex agents omit Team protocol shutdown_
ok 57 - installed Codex agents omit Team protocol task-state inspection
ok 58 - installed Codex agents retain force-push and planning-owner boundaries
ok 59 - installed Brainstorm asks a question in the final answer without a runtime possessive
ok 60 - installed Codex host lists retain Claude names alongside converted single-host paths
ok 61 - host-list preservation applies only to instruction assets including a missing source path
ok 62 - standalone host filenames do not prevent conversion of a single-host file path on the same line
ok 63 - installed Codex catalog help labels the shared skills root for Codex
# tests 84
# pass 84
# fail 0
# skipped 0
# todo 0
[skill-test] PASS: 2158 tests executed
```

- Đỏ trước sửa (Codex báo): 13/82; mọi needle bắt buộc đỏ; `AskUserQuestion` và hai câu giữ lại xanh (chỉ chống hồi quy).
- Vòng sửa 1 (review controller): mẫu sở hữu cách làm câu brainstorm thành "Use the runtime's question in the turn's final answer"; mục Team git_ops còn mục "3." lẻ. Đã sửa: câu thành "Use a question in the turn's final answer when available.", phần Team còn lại dùng gạch đầu dòng; 2 ca mới đỏ trước sửa, xanh sau.
- Counterexample (Codex báo): khôi phục cách đổi `AskUserQuestion` cũ → ca `structured user-input` đỏ; cắt cả mục Team → ca giữ force-push đỏ; hoàn tác khớp byte.
- Ca cũ đổi kỳ vọng trong `codex-native.test.js` (thuộc Ownership): ngữ pháp theo mạo từ, corpus hỏi người dùng, brainstorm decision-register, mutation grammar, oracle git_ops. Probe tĩnh self-test chỉ đổi câu "the host's own worktree".
- Review controller: usage catalog bản Claude nay ghi "the Claude runtime skills directory" thay `.claude/skills` để bộ chuyển đổi không làm trùng root. Commit 812fab19.
