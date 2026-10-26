# Task 04 — Hook Codex dưới plugin: đúng repo, cô lập state, chung sống bản npx

Status: done

## Outcome
Dưới plugin, hook Codex làm việc trên repo của payload, gate chặn đúng, không ghi gì vào repo hay cây plugin, có runtime mặc định khi repo không có `.codex/runtime.json`, và im lặng khi repo đã có hook CafeKit cấp repo.

## Scope
- In: Nhận diện plugin bằng `realpath(__dirname)` nằm dưới gốc plugin (không chỉ biến môi trường); gốc repo = `payload.cwd` → git toplevel, tính theo từng payload qua một hàm của `hook-context.cjs` thay cho hằng `PROJECT_ROOT` tính lúc nạp module (`packages/spec/src/codex/hooks/lib/hook-context.cjs:12-19,86-91`), và mọi hook đang đọc hằng đó chuyển sang hàm (`precompact.cjs:7,12,29`, `privacy-approval.cjs:15-18`, `privacy-block.cjs:20-21`, `inspect-block.cjs:25-26`, `session.cjs:103-117`, `rules.cjs:47`, `spec-gate.cjs:47`); state (`hook-context.cjs:125-129`, `lib/state-store.cjs:22`, `lib/privacy-state.cjs:17-21`) vào `PLUGIN_DATA` hoặc tmp 0700 đúng chủ (không đạt → privacy fail-closed); `session.cjs:107` bỏ update check; `rules.cjs:48-49` dùng runtime mặc định dưới plugin, `rules.cjs:23` đọc output style từ cây plugin; D-07: repo có `.codex/hooks.json` chứa hook CafeKit → mọi hook plugin exit 0 không làm gì (SessionStart in một dòng báo). Nhánh npx giữ nguyên.
- Out: Khoá tắt an toàn (task-05); lõi (task-06).

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/codex/hooks/lib/hook-context.cjs`, `lib/state-store.cjs`, `lib/privacy-state.cjs`
- Modify: `packages/spec/src/codex/hooks/session.cjs`, `rules.cjs`, `precompact.cjs`, `privacy-approval.cjs`, `privacy-block.cjs`, `inspect-block.cjs`, `spec-gate.cjs` (chỉ phần gốc repo)
- Create: `packages/spec/bin/__tests__/codex-plugin-hooks.test.js`
- Regenerate: `plugins/cf-codex/**`

## Steps
1. Sửa theo Scope.
2. Test với cây plugin build vào thư mục tạm, `HOME` tạm, repo tạm khác thư mục cha của cây plugin: Stop trên repo có task done thiếu Receipt → block; privacy-block chặn đọc `.env` của repo payload và approval ghi token theo repo payload; precompact ghi state dưới data; danh sách file repo, cây plugin và thư mục cha cây plugin trước = sau; không `PLUGIN_DATA` → tmp riêng 0700; tmp do người khác tạo/symlink → privacy fail-closed; cache cập nhật seed sẵn không sinh thông báo npx; repo trống vẫn được chèn đường dẫn mặc định; repo có `.codex/hooks.json` CafeKit → hook plugin im lặng; cây cài npx (installer vào repo tạm) vẫn chạy, kể cả có biến plugin kế thừa.

## Acceptance
- AC-04: các test bước 2 xanh; toàn bộ test `bin/__tests__` không có test đỏ mới.

## Dependencies
- task-03-build-runtime.md

## Verification Plan
- Command: `node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js`
- Named probe: `codex-plugin-hooks.test.js` (gate-blocks-in-payload-repo, privacy-uses-payload-repo, nothing-written-outside-data, tmp-root-0700, foreign-tmp-fail-closed, no-npx-notice, defaults-without-runtime, silent-beside-npx, npx-installed-tree).
- Reachability: source — `spawnSync` với env theo FACT `hook_env`/`payload_has_cwd`.
- Oracle: decision block; danh sách file trước = sau; exit code.
- Counterexample: gốc repo vẫn theo `__dirname` → gate không block → đỏ.
- Artifacts: thư mục tạm xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- Before the change three probes already passed for the wrong reason: `foreign-tmp-fail-closed` and `no-npx-notice` passed only because the hooks resolved the plugin parent instead of the repository (so no state and no update cache were reached); `npx-installed-tree` is a regression guard by design. After the change all ten probes exercise the repository from the payload.
- code-auditor round 1: FAIL — High: stand-down keyed on the substring `/.codex/hooks/` in `.codex/hooks.json`, so a committed or planted file disabled every plugin gate. Fixed: stand down only when the parsed launchers point to existing hook scripts inside `<repo>/.codex/hooks`; test `planted-hooks-json-keeps-gates`. Residual D-07 risk (real npx hooks present but untrusted → no gates) accepted by Bro at GATE-REVIEW; the SessionStart notice states the gates need those hooks trusted in /hooks or the npx install removed (asserted in `silent-beside-npx`). Round 2: PASS.
- Open Lows: `process.exit` inside `resolveProjectRoot`; the notice cannot name `migrate` until package 3.
- Receipt output keeps this task's ten named probes, the build line and the run summary; the other passing lines of the same run are abridged.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js
built Codex plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
✔ gate-blocks-in-payload-repo: Stop blocks a done task without a receipt in the payload repository (1742.595542ms)
✔ privacy-uses-payload-repo: reading the payload repository .env is denied and the approval is keyed to it (665.620667ms)
✔ nothing-written-outside-data: every hook leaves the repository, the plugin tree and its parent unchanged (4943.620625ms)
✔ tmp-root-0700: without PLUGIN_DATA, state goes to a private per-user temp directory (3705.456167ms)
✔ foreign-tmp-fail-closed: a temp state root this user does not safely own makes privacy deny (711.143417ms)
✔ no-npx-notice: the plugin session hook prints no npx update notice and keeps the update cache (716.71475ms)
✔ defaults-without-runtime: without .codex/runtime.json the rules hook still injects the repository paths (736.1575ms)
✔ silent-beside-npx: with the npx Codex hooks active in the repository, plugin hooks stand down and say so once (3724.21275ms)
✔ planted-hooks-json-keeps-gates: a hooks.json without real npx hooks behind it does not switch the plugin off (4434.32425ms)
✔ npx-installed-tree: npx-installed hooks keep their behavior, even with a plugin root inherited from the parent (4589.175708ms)
ℹ tests 1518
ℹ suites 0
ℹ pass 1518
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 291079.266208
EXIT=0
```
