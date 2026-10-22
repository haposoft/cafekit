# Task 02 — Hook dưới plugin không ghi vào repo hay cây plugin, không nhắc npx

Status: done

## Outcome
Khi chạy dưới plugin (có `CLAUDE_PLUGIN_ROOT`), mọi state của hook nằm dưới `CLAUDE_PLUGIN_DATA` (hoặc `os.tmpdir()` khi biến vắng), kể cả khi repo đã có `.claude/`; hook session không in thông báo cập nhật npx và không ghi update cache.

## Scope
- In: `hookStateDir()` → `<CLAUDE_PLUGIN_DATA>/.logs` khi biến là đường dẫn tuyệt đối; dưới plugin mà biến vắng → `<os.tmpdir()>/cafekit-plugin/.logs`; giữ nguyên hai nhánh cũ khi không có `CLAUDE_PLUGIN_ROOT`. `stateDir()` trong `state.cjs` dưới plugin → `<data hoặc tmp>/session-states/<hash cwd>` bất kể repo có `.claude/` (`packages/spec/src/claude/hooks/state.cjs:89-93`). `session.cjs` bỏ `checkCafeKitUpdate` khi có `CLAUDE_PLUGIN_ROOT` (`packages/spec/src/claude/hooks/session.cjs:118`, `packages/spec/src/claude/hooks/lib/update-check.cjs:50,58,72`).
- Out: cache git ở tmpdir (`packages/spec/src/claude/hooks/lib/git.cjs:49`); hành vi npx.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/hooks/lib/hook-state-dir.cjs`
- Modify: `packages/spec/src/claude/hooks/state.cjs`
- Modify: `packages/spec/src/claude/hooks/session.cjs`
- Create: `packages/spec/src/claude/hooks/__tests__/plugin-state-isolation.test.js`
- Regenerate: `plugins/cf/**` (build của task-01)

## Steps
1. Sửa 3 file theo Scope.
2. Test: build plugin vào thư mục tạm; với hai repo tạm (một trống, một có `.claude/settings.local.json`) chạy lần lượt mọi hook trong `hooks.json` với stdin mẫu, `CLAUDE_PLUGIN_ROOT` = cây tạm, `CLAUDE_PLUGIN_DATA` = thư mục data tạm → liệt kê đệ quy repo tạm và cây plugin trước/sau bằng nhau; data tạm có file mới; stdout `SessionStart` không chứa `npx @haposoft/cafekit`. Lặp lại khi không đặt `CLAUDE_PLUGIN_DATA` → file mới nằm dưới tmpdir, repo và cây plugin vẫn không đổi. Một test cho nhánh npx (không có `CLAUDE_PLUGIN_ROOT`) giữ kết quả cũ.
3. Chạy lại build.

## Acceptance
- AC-03: mọi trường hợp bước 2 xanh.
- AC-10: không có thông báo npx và không có `.cafekit-update-cache.json` mới.

## Dependencies
- task-01-build-plugin.md

## Verification Plan
- Command: `node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-state-isolation.test.js packages/spec/src/claude/hooks/__tests__/state.test.js packages/spec/src/claude/hooks/__tests__/update-check.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js`
- Named probe: `plugin-state-isolation.test.js` (empty-repo, repo-with-dot-claude, no-data-env-uses-tmp, no-npx-notice, npx-branch-unchanged).
- Reachability: source — node, chạy hook bằng `spawnSync` với stdin JSON mẫu.
- Oracle: danh sách file trước/sau của repo tạm và cây plugin bằng nhau.
- Counterexample: `state.cjs` vẫn chọn `<repo>/.claude/session-state` → repo có `.claude/` có thư mục mới → đỏ.
- Artifacts: thư mục tạm xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- code-auditor round 1: PASS_WITH_WARNINGS — Medium: `no-npx-notice` could pass offline; fixed by seeding a fresh update cache (`latest: 99.0.0`) and asserting its bytes; negative control on a disposable build without the `session.cjs` fix printed the npx notice offline. Low: tmp fallback now `cafekit-plugin-<uid>`. Round 2: PASS.
- Full regression run `node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js`: 1425/1427 pass; the 2 failures are in the untracked `packages/spec/bin/__tests__/agent-authority.test.js` of the separate `agent-privacy-boundaries` packet and touch no file of this task.

- Final-Head fixed point (2026-10-21): proof rerun on the final tree with Head identical before and after all seven runs; this Receipt replaces the earlier one. Output keeps every command line except blank lines and the validator's multi-line advice text (icon, repository-root and README install hints).

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-state-isolation.test.js packages/spec/src/claude/hooks/__tests__/state.test.js packages/spec/src/claude/hooks/__tests__/update-check.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-state-isolation.test.js packages/spec/src/claude/hooks/__tests__/state.test.js packages/spec/src/claude/hooks/__tests__/update-check.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js
built plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf
✔ inventory: 15 in-scope skills, 13 agents, no excluded component (237.875708ms)
✔ no-dot-claude-path: Markdown keeps no .claude runtime path and no unsubstituted root (17.158584ms)
✔ hook-commands: every hook runs from the plugin root and exists (0.351125ms)
✔ hook-smoke: every registered hook exits 0 in the built tree without a crash (4771.719459ms)
✔ agent-names-resolve: agents are called by their namespaced name and exist (20.525917ms)
✔ check-detects-drift: --check fails after one byte changes in a copy (1081.440375ms)
✔ build refuses to wipe a non-empty directory that is not a cf build (4.056792ms)
✔ empty-repo: hooks write only under CLAUDE_PLUGIN_DATA (4736.582584ms)
✔ repo-with-dot-claude: hooks write only under CLAUDE_PLUGIN_DATA (4295.920792ms)
✔ no-data-env-uses-tmp: without CLAUDE_PLUGIN_DATA state goes to the OS temp directory (4500.51825ms)
✔ no-npx-notice: the plugin session hook prints no npx update notice and writes no update cache (4609.290667ms)
✔ npx-branch-unchanged: outside a plugin, source-tree hooks keep the temp log directory (305.718917ms)
✔ Claude installed spec-state re-evaluates a standalone task when blocked becomes pending (1904.160875ms)
✔ Claude installed spec-state requires current canonical dependency proof and keys receipt mutations (4392.017959ms)
✔ Claude installed spec-state keeps unversioned pending packets out of Next with migration guidance (1965.344459ms)
✔ Claude resolver ignores fenced workflow annotations and rejects fenced-only Status (765.930875ms)
✔ Claude resolver accepts unique legacy task numbers, rejects ambiguity, and rejects exact cycles (165.78925ms)
✔ Stop snapshot includes tracked modifications and untracked files (511.154375ms)
✔ Stop snapshot includes untracked files before the first commit (390.775083ms)
✔ SessionStart prints nothing when prior context is only placeholders (322.684ms)
✔ SessionStart prints prior context that has a completed todo (295.619916ms)
✔ SessionStart under .omp drops placeholder-only context like Claude (254.6395ms)
✔ two omp sessions keep separate state (519.071458ms)
✔ Agent refreshes the installed state from transcript todos and is parsed as an agent (351.744125ms)
✔ Stop persists a bounded summary of the last assistant message (374.402916ms)
✔ Stop omits secret-related assistant messages before saving state (373.871208ms)
✔ SubagentStop saves the assistant summary and omits secret-related content (669.247917ms)
✔ a fresh state write lock skips the snapshot without changing existing bytes (3329.833542ms)
✔ a stale state write lock is removed and the snapshot is saved (396.354083ms)
✔ consecutive PostToolUse snapshots both save their todos and release the write lock (839.038833ms)
✔ malformed state input exits successfully and records a crash (250.546875ms)
✔ a new Claude session startup does not inherit another session context (716.765208ms)
✔ a Claude session resumes its own saved todo (736.305709ms)
✔ two Claude sessions resume only their own completed todos (979.325208ms)
✔ a session-less payload still reads project-level context (284.278208ms)
✔ Claude SessionStart does not create state directories (300.490917ms)
✔ a newer version produces the existing notice and caches only version data (6.226208ms)
✔ the installed version produces no update notice (2.4145ms)
✔ an invalid cached latest version is refetched instead of printed (5.277375ms)
✔ a cache timestamp in the future requires a fresh version fetch (20.386792ms)
✔ a legacy notice cache cannot inject its stored text into the session (9.350792ms)
✔ an interrupted version response fails open without an unhandled error (726.439375ms)
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 21461.490625
EXIT=0
```
