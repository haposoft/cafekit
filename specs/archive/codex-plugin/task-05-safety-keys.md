# Task 05 — Dưới plugin, repo không tắt được privacy/inspect (Claude + Codex)

Status: done

## Outcome
Khi chạy dưới plugin `cf` (Claude) hoặc `cf` (Codex), các khoá tắt an toàn trong `runtime.json` của repo bị bỏ qua và chuỗi locale được làm sạch; bản cài npx giữ hành vi cũ.

## Scope
- In: Claude: `packages/spec/src/claude/hooks/privacy-block.cjs:56-58`, `inspect-block.cjs:61-63` bỏ qua `privacyBlock:false` / `inspect.enabled:false` khi chạy dưới plugin; Codex: `privacy-block.cjs:23`, `inspect-block.cjs:28` tương tự; Codex `rules.cjs:52-64` làm sạch `locale.*` như `pluginOption` của gói 1; build lại cả hai cây.
- Out: Đổi chính sách cho bản npx.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/claude/hooks/privacy-block.cjs`, `inspect-block.cjs`
- Modify: `packages/spec/src/codex/hooks/privacy-block.cjs`, `inspect-block.cjs`, `rules.cjs` (chỉ phần khoá an toàn/locale; phần gốc repo đã đổi ở task-04)
- Create: `packages/spec/bin/__tests__/plugin-safety-keys.test.js`
- Regenerate: `plugins/cf/**`, `plugins/cf-codex/**`

## Steps
1. Sửa theo Scope.
2. Test: với mỗi host, repo có runtime.json tắt privacy/inspect → dưới plugin vẫn chặn đọc `.env` mẫu và đường dẫn inspect; dưới npx → hành vi cũ (tắt); locale chứa `\n## X` → một dòng.

## Acceptance
- AC-05: các test bước 2 xanh; toàn bộ test `bin/__tests__` và hook Claude không có test đỏ mới.

## Dependencies
- task-04-hook-repo-root.md

## Verification Plan
- Command: `node packages/spec/scripts/build-claude-plugin.mjs && node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js`
- Named probe: `plugin-safety-keys.test.js` (claude-privacy-kept, claude-inspect-kept, codex-privacy-kept, codex-inspect-kept, npx-disable-unchanged, locale-sanitized).
- Reachability: source — `spawnSync`.
- Oracle: decision deny/ask có hoặc không đúng kỳ vọng.
- Counterexample: repo tắt được privacy dưới plugin → `*-privacy-kept` đỏ.
- Artifacts: thư mục tạm xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- `isPlugin()` (Claude) now compares realpaths like `pluginRoot()` (Codex), so a plugin root inherited by an npx hook does not remove its switch (`npx-inherited-root`). The omp privacy hook is regenerated from the Claude file plus its ask→deny overlay.
- code-auditor round 1: FAIL — High in task-04's `hasProjectCafekitHooks`: a planted `.codex/hooks.json` naming `./.codex/hooks/noop.cjs` (relative, resolved against the hook's cwd) made the Codex plugin stand down, so `.env` reads went unchecked. Medium: no Codex npx case and no inherited-root case. Repaired: scripts must be absolute; new case `relativeScript` (red before, green after); new tests `npx-inherited-root`, `codex-npx-disable-unchanged` (real npx install).
- Round 2: FAIL — High: an absolute path that still resolves through cwd (`/proc/self/cwd/...` on Linux, inferred, not reproduced on darwin). Repaired: the script's directory must equal `<realpath(root)>/.codex/hooks` lexically, exactly as the npx launcher writes it, before the realpath check; new cases `dotDot` and `symlinkAlias` (`symlinkAlias` red with the lexical check removed); the two npx tests also assert exit 0. Round 3: PASS.
- The repair edits task-04's owned `hook-context.cjs` and its test; task-04's probes run green inside this Command. Task-04's Receipt Head is refreshed at the final-Head fixed point.
- One run of this Command failed only on `precompact.test.js:350` (12.3 s against a 10 s bound, load average ~46 from parallel sessions); alone it passed 3/3 at 9.3–9.6 s and the rerun below is clean. The test is untouched.
- Open limitations: under the plugin, `paths.*` and `docs.maxLoc` from the repository's runtime.json still reach the context unsanitized (outside Scope, which names `locale.*` only; the repository's own AGENTS.md already reaches the context with the same trust). `spec.tollgate:false` still silences the reminder (not a safety gate). Unverified: a Windows drive-letter case mismatch or an npx install in a subdirectory of the git top level keeps the plugin active beside the npx hooks (both fail safe).
- Receipt output keeps this task's named probes, the two task-04 probes the repair touched, the build lines and the run summary; the other passing lines of the same run are abridged.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-claude-plugin.mjs && node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ node packages/spec/scripts/build-claude-plugin.mjs && node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js
built plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf
built Codex plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
✔ silent-beside-npx: with the npx Codex hooks active in the repository, plugin hooks stand down and say so once (3171.777417ms)
✔ planted-hooks-json-keeps-gates: a hooks.json without real npx hooks behind it does not switch the plugin off (3123.954917ms)
✔ claude-privacy-kept: the Claude plugin still asks before reading .env when runtime.json disables privacy (1358.306958ms)
✔ claude-inspect-kept: the Claude plugin still blocks node_modules when runtime.json disables inspect (630.079917ms)
✔ codex-privacy-kept: the Codex plugin still denies reading .env when runtime.json disables privacy (498.178125ms)
✔ codex-inspect-kept: the Codex plugin still blocks node_modules when runtime.json disables inspect (501.394667ms)
✔ npx-disable-unchanged: outside a plugin, runtime.json still switches the Claude gates off (821.156875ms)
✔ npx-inherited-root: an npx Claude hook launched with a plugin root inherited from its parent keeps the switch (438.392792ms)
✔ codex-npx-disable-unchanged: outside a plugin, runtime.json still switches the Codex gates off (3424.980458ms)
✔ locale-sanitized: under the Codex plugin a hostile locale stays one short line (956.610416ms)
ℹ tests 1820
ℹ suites 0
ℹ pass 1820
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 348316.757833
EXIT=0
```
