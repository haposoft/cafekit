# Task 03 — Codex đọc đủ rule; rule và gitignore hai host khớp; xoá file cũ

Status: done

## Outcome
AGENTS block Codex trỏ đủ 10 rule; orchestrator trên Codex không hứa model mạnh nhất; `hook-protocols.md` và gitignore khớp theo D-04; hai file cũ trong `packages/spec` bị xoá.

## Scope
- In:
  - `src/codex/AGENTS.md`: trỏ `.codex/rules/workflow.md`, `ai-dev-rules.md`, `orchestrator.md`, `manage-docs.md` kèm khi nào đọc.
  - Bộ chuyển đổi: đoạn Model Escalation của `rules/orchestrator.md` (`src/claude/rules/orchestrator.md:95-99`) trên Codex theo D-03.
  - `src/claude/rules/hook-protocols.md`, `src/codex/rules/hook-protocols.md`: D-04.
  - `src/claude/gitignore`: thêm `!.env.sample`, `!.env.template`, `*.tmp`.
  - `git rm` `packages/spec/CLAUDE.md`, `packages/spec/AGENTS.md`.
  - Changelog.
- Out: nội dung khác của rule; installer.

## Coverage
- CP-03

## Ownership
- Modify: `src/codex/AGENTS.md`, `bin/lib/codex-install.js` (chỉ phép đổi orchestrator), `src/claude/rules/hook-protocols.md`, `src/codex/rules/hook-protocols.md`, `src/claude/gitignore`, `bin/__tests__/codex-native.test.js`, hai changelog
- Delete: `packages/spec/CLAUDE.md`, `packages/spec/AGENTS.md`

## Steps
1. Thêm test vào `codex-native.test.js`: cài Codex vào thư mục tạm; `AGENTS.md` nhắc tên cả 10 file trong `.codex/rules/` và mỗi file tồn tại; `.codex/rules/orchestrator.md` không chứa `strongest` hay `below` cạnh `fable`; hai `hook-protocols.md` đã cài (Claude, Codex) chứa câu D-04; `.claude/.gitignore` (cài Claude) chứa ba dòng mới. Chạy `node --test packages/spec/bin/__tests__/codex-native.test.js` trước khi sửa; ghi số ca đỏ.
2. Sửa; xoá hai file; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-03: các ca đúng; Command xanh.

## Dependencies
- task-02-codex-when-to-use.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-native.test.js && test ! -e packages/spec/CLAUDE.md && test ! -e packages/spec/AGENTS.md && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test mới về rule Codex.
- Reachability: installer thật trên thư mục tạm.
- Oracle: Oracle chung của plan.
- Counterexample: bỏ một dòng trỏ rule trong `src/codex/AGENTS.md` → ca 10 rule đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/codex-native.test.js && test ! -e packages/spec/CLAUDE.md && test ! -e packages/spec/AGENTS.md && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: 27a61cb56d00f67a5e3211d9259acb4f714c2e0d
Head: 9f8922f515e4738f44ac45d33b6160917bba5154c65296a2b49efff0bc89af0e

```text
ok 1 - installed Codex instructions reference all ten runtime rules
ok 2 - installed Codex orchestrator describes high reasoning on the session model
ok 3 - installed hook protocols share malformed-output handling and Codex receipt guidance
ok 4 - installed Claude ignore rules preserve env samples and ignore temporary files
# tests 45
# pass 45
# fail 0
# skipped 0
# todo 0
[skill-test] PASS: 2141 tests executed
```

- Đỏ trước sửa (Codex báo): 4/45.
- Counterexample (Codex báo): bỏ dòng trỏ `workflow.md` → ca 10 rule đỏ; khôi phục → xanh, khớp byte.
- `test ! -e` cho hai file cũ nằm trong Command; hai file xoá trong commit 27a61cb5.
- Review controller: đoạn Model Escalation chỉ đổi trên Codex (`normalizeCodexBody`, nhánh `rules/orchestrator.md`), nguồn Claude giữ nguyên; câu malformed giống nhau hai host; bản `.claude/rules/hook-protocols.md` gốc repo (gitignored) chưa đồng bộ, sẽ cập nhật khi cài lại.
