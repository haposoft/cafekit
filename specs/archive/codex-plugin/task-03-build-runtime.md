# Task 03 — Build runtime, hooks.json và smoke test hook Codex

Status: done

## Outcome
`plugins/cf-codex/` có đủ runtime như bản cài npx Codex (theo danh sách layout của task-01) và `hooks/hooks.json` dùng bộ sinh lệnh của installer, mọi hook chạy được.

## Scope
- In: Ghi runtime theo danh sách layout; `hooks/hooks.json` sinh bằng bộ sinh lệnh của installer (`packages/spec/bin/phases/codex-hooks.js:141-160`), được tách thành hàm export nhận biểu thức gốc làm tham số (bản npx vẫn truyền `.codex/hooks`, plugin truyền biến gốc theo FACT `hook_env`); PATH dự phòng dùng danh sách thư mục chung, không ghi `process.execPath` của máy build (`:130-132`); launcher Windows tính đường dẫn từ biến môi trường lúc chạy thay vì base64 đường dẫn cố định (`:149-151`). Lệnh hook của bản npx giữ nguyên byte.
- Out: Sửa nội dung hook (task-04/05).

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/scripts/build-codex-plugin.mjs`
- Modify: `packages/spec/bin/phases/codex-hooks.js`
- Modify: `packages/spec/bin/__tests__/codex-plugin-build.test.js`
- Regenerate: `plugins/cf-codex/**`

## Steps
1. Thêm runtime + hooks.json vào build.
2. Test: tập file runtime của cây = tập file một bản cài npx Codex vào repo tạm (qua installer, HOME tạm); mọi `require` trong hook giải được; mọi lệnh hook có PATH dự phòng và `commandWindows`, không chứa đường dẫn tuyệt đối của máy build, và launcher Windows giải mã ra lệnh đọc gốc từ biến môi trường; lệnh hook mà installer sinh cho bản npx giống hệt trước khi refactor; chạy từng hook với stdin mẫu, `HOME` tạm, biến plugin theo spike → exit 0, không crash log.

## Acceptance
- AC-03: các test bước 2 xanh.

## Dependencies
- task-02-build-skills.md

## Verification Plan
- Command: `node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js && node packages/spec/scripts/build-codex-plugin.mjs --check plugins/cf-codex`
- Named probe: `codex-plugin-build.test.js` (runtime-matches-npx, requires-resolve, hook-commands-fallback, no-build-machine-paths, npx-hook-commands-unchanged, hook-smoke).
- Reachability: source — node; installer chạy vào repo tạm.
- Oracle: test pass, exit 0.
- Counterexample: chép nguyên shim → `requires-resolve` đỏ; mất PATH dự phòng → `hook-commands-fallback` đỏ.
- Artifacts: thư mục tạm xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- `packages/spec/bin/phases/codex-hooks.js` gains `pluginHookCommands`/`pluginHooksConfig` (PLUGIN_ROOT resolved at run time, PATH floor `/usr/local/bin`, `/opt/homebrew/bin` only); the npx launchers are byte-for-byte untouched (test `npx-hook-commands-unchanged`, now also decoding each Windows launcher).
- code-auditor round 1: PASS_WITH_WARNINGS — Medium: hook-smoke ran `node <file>` and grepped stdout, missing crash logs and never executing the generated launcher. Fixed: smoke runs `sh -c <command>` in a sandbox and fails on any `"status":"crash"` hook log; negative control (rules.cjs throwing inside its main try) → launcher exit 0 with a crash line in `<plugin parent>/.codex/hooks/.logs/hook-log.jsonl`, which the sandbox scan catches. Round 2: PASS.
- Open limits: whether Codex substitutes `${PLUGIN_ROOT}` itself or the shell expands it is unobserved for roots containing `"`/`$`; Windows env export of `PLUGIN_ROOT` unverified (spike ran on macOS). Hooks still resolve the repository from `__dirname` until task-04.
- Receipt output keeps this task's named probes, the build/check lines and the run summary; the other passing lines of the same run are abridged.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js && node packages/spec/scripts/build-codex-plugin.mjs --check plugins/cf-codex
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/*.test.js && node packages/spec/scripts/build-codex-plugin.mjs --check plugins/cf-codex
built Codex plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
✔ runtime-matches-npx: the plugin runtime holds the same files and bytes as an npx Codex install (1572.764583ms)
✔ requires-resolve: every relative require in the plugin hooks resolves inside the tree (9.032208ms)
✔ hook-commands-fallback: every plugin hook has a POSIX command with a node PATH fallback and a Windows command (4.500542ms)
✔ no-build-machine-paths: hooks.json names no absolute path of the machine that built it (290.074333ms)
✔ npx-hook-commands-unchanged: the npx install still gets absolute project launchers (1436.9235ms)
✔ hook-smoke: every generated plugin launcher runs its hook to exit 0 without a crash log (8906.038875ms)
ℹ tests 1518
ℹ suites 0
ℹ pass 1518
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 261477.009
plugin tree matches a fresh build: /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
EXIT=0
```
