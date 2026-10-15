# Task 01 — Một luật root cho hook Claude

Status: done

## Outcome
Phiên Claude đứng ở thư mục con vẫn nhận rules, vẫn tôn trọng `inspect.enabled:false`, subagent vẫn nhận context, và spec-gate tìm đúng root; bản cài từ manifest chạy được.

## Scope
- In:
  - D-01 (plan.md): tạo `src/claude/hooks/lib/project-root.cjs`; thêm `hooks/lib/project-root.cjs` vào `runtime.files` của `src/claude/migration-manifest.json`.
  - `rules.cjs`: đọc runtime từ root trước khi giữ chỗ; runtime vắng thì thoát mà không giữ chỗ.
  - `inspect-block.cjs`: runtime từ root; `inspectInput` nhận `cwd` của payload và `projectRoot` từ lib.
  - `agent.cjs`: runtime và các path Specs/Plans/Docs theo root; bỏ comment "monorepo".
  - `spec-gate.cjs`: thay `projectRoot` riêng (`src/claude/hooks/spec-gate.cjs:20-28`) bằng lib.
  - Đồng bộ bản copy `../../.claude/hooks/` (gitignored, không commit); changelog.
- Out: spec-state (task-02), state (task-03), session/precompact (task-04), privacy-block (task-08).

## Coverage
- CP-01

## Ownership
- Modify: `src/claude/hooks/lib/project-root.cjs` (mới), `src/claude/hooks/rules.cjs`, `src/claude/hooks/inspect-block.cjs`, `src/claude/hooks/agent.cjs`, `src/claude/hooks/spec-gate.cjs`, `src/claude/migration-manifest.json`, `src/claude/hooks/__tests__/installed-root.test.js` (mới), `CHANGELOG.md`, `../../docs/project-changelog.md`
- Fixture chép tay lib (Luật fixture trong plan.md): ít nhất `src/claude/hooks/__tests__/spec-gate.test.js:230-252`, `bin/__tests__/develop-contract.test.js:69-87`.
- Probe tĩnh liên quan nếu chữ đổi: `scripts/run-skill-self-tests.mjs` (probe rules/agent chạy từ source `:6474-6501` phải giữ xanh: từ source không có thư mục chấm nên root = `CLAUDE_PROJECT_DIR` hoặc `payload.cwd`).
- Sync (gitignored, không commit): `../../.claude/hooks/`

## Steps
1. Viết `installed-root.test.js`: dựng `<tmp>/.claude/` chỉ từ `MANIFEST.runtime.files` (như `bin/__tests__/omp-hooks.test.js:17`), không chép cả `lib/`; ghi `<tmp>/.claude/runtime.json`; tạo `<tmp>/sub/dir`; chạy hook bằng `spawnSync(process.execPath, [hook])` với payload `cwd: <tmp>/sub/dir`, env bỏ `CLAUDE_PROJECT_DIR` và `PROJECT_ROOT`:
   - rules với `session_id` mới → stdout có rules;
   - rules khi chưa có `runtime.json` → im lặng; ghi runtime rồi chạy lại cùng `session_id` → có rules (chỉ kiểm hành vi, không kiểm file giữ chỗ);
   - inspect-block với `inspect.enabled:false` và Read vào thư mục bị chặn → exit 0;
   - agent → stdout có context, Specs path theo root;
   - spec-gate Stop với packet có task done thiếu Receipt dưới root (layout có thêm `scripts.required` của manifest) → block với lý do về Receipt, không chứa `unavailable` (regression guard: `spec-gate.cjs:28-30` đã tự nhận root, ca này có thể xanh trước).
   Chạy Command trước khi sửa: ghi số ca đỏ (ca dựng từ manifest sẽ đỏ vì thiếu lib).
2. Tạo lib, sửa bốn hook, manifest; đồng bộ `.claude`; changelog.
3. Chạy Command; `node --test packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/src/claude/hooks/__tests__/spec-gate.test.js packages/spec/bin/__tests__/develop-contract.test.js`; self-test; `cmp` bản `.claude` với nguồn.
4. Không commit (controller commit).

## Acceptance
- AC-01: các ca trên đúng; test hiện có không đổi assertion; omp-hooks, spec-gate test và self-test exit 0.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/installed-root.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên test mô tả hành vi, không chứa mã plan.
- Reachability: hook chạy từ layout `<tmp>/.claude/hooks/` dựng theo manifest như installer.
- Oracle: exit 0, `# fail 0`.
- Counterexample: bỏ `project-root.cjs` khỏi manifest trên bản chép tạm → ca dựng layout đỏ; cho rules đọc runtime theo `payload.cwd` → ca thư mục con đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/installed-root.test.js`
Exit: 0
Base: e4db86d6dc669069141a89528aaf1f1efdf08776
Head: 592219d40074d770ddc3552d2e48bf2330630632f224520468237ac0ed510034

```text
ok 1 - installed rules read the project runtime from a nested session cwd
ok 2 - rules wait for runtime before reserving the session injection
ok 3 - installed inspect respects a disabled project runtime from a nested cwd
ok 4 - installed agent context uses project paths from a nested session cwd
ok 5 - installed spec gate checks root packet receipts from a nested session cwd
# tests 5
# pass 5
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): 4 fail, 1 pass (ca spec-gate là regression guard).
- Counterexample (Codex báo): bỏ `project-root.cjs` khỏi manifest → 4 test đỏ; rules đọc runtime theo `payload.cwd` → 1 test đỏ; đã hoàn tác.
- Lệnh phụ (controller chạy): omp-hooks + spec-gate + develop-contract 123 pass, 0 fail.
- Self-test (controller chạy): `PASS: 2079 tests executed`, exit 0; `cmp` năm file `.claude/hooks` với nguồn khớp.
- Probe tĩnh: `scripts/run-skill-self-tests.mjs` `runHook` của probe rules/agent từ source bỏ `CLAUDE_PROJECT_DIR`/`PROJECT_ROOT` khỏi env (Luật fixture); fixture `spec-gate.test.js`, `develop-contract.test.js` chép thêm `project-root.cjs`.
- Review controller: thứ tự root đúng D-01; rules đọc runtime trước khi giữ chỗ; inspect lấy realpath của `cwd` để so khớp với root đã realpath (macOS `/var` → `/private/var`); không assertion cũ nào bị xoá. Commit e4db86d6.
