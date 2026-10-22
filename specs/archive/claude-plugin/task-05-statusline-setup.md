# Task 05 — Bật statusLine CafeKit cấp user bằng một lệnh

Status: done

## Outcome
User chạy `/cf:setup-statusline` một lần; từ đó statusLine CafeKit chạy qua launcher ổn định trong `CLAUDE_PLUGIN_DATA`, tự theo bản plugin mới, và không bao giờ đè statusLine của người khác.

## Scope
- In: `plugin-context.cjs` mỗi SessionStart (khi có `CLAUDE_PLUGIN_DATA`) ghi launcher `<data>/status.cjs` (gọi `require(<JSON.stringify(root)>/status.cjs)`, bắt `MODULE_NOT_FOUND` thì thoát 0 không in gì) và file con trỏ `~/.claude/cafekit-plugin-data` chứa đường dẫn data; ghi qua file tạm tên có `pid` + ngẫu nhiên rồi `rename`. `setup-statusline.cjs` đọc con trỏ, nhận đường dẫn settings (mặc định `~/.claude/settings.json`, đi theo `realpath` nếu là symlink), chỉ đặt `statusLine` khi khoá vắng hoặc `command` chứa đúng đường dẫn launcher; giữ nguyên mọi khoá khác; ghi qua file tạm cạnh đích rồi `rename`; settings không parse được hoặc thiếu con trỏ → không ghi, exit 1 kèm lý do. `commands/setup-statusline.md` hướng model chạy `node <plugin root>/scripts/setup-statusline.cjs` theo D-06.
- Out: tự sửa settings khi user chưa gọi lệnh; statusline cho Codex.

## Coverage
- CP-05

## Ownership
- Create: `packages/spec/src/claude/scripts/setup-statusline.cjs`
- Create: `packages/spec/src/claude/plugin/commands/setup-statusline.md`
- Create: `packages/spec/src/claude/hooks/__tests__/setup-statusline.test.js`
- Modify: `packages/spec/src/claude/hooks/plugin-context.cjs`
- Modify: `packages/spec/scripts/build-claude-plugin.mjs`
- Regenerate: `plugins/cf/**`

## Steps
1. Launcher và con trỏ → test với `HOME` và `CLAUDE_PLUGIN_DATA` tạm: hai file tồn tại; `node <launcher>` với stdin mẫu exit 0; root bị xoá → launcher exit 0, stdout rỗng; root có dấu `'` trong tên → vẫn chạy.
2. Setup script → test trên file settings tạm: vắng `statusLine` → được đặt; trỏ launcher cũ → được thay; statusLine lạ cũng tên `status.cjs` → file giữ nguyên từng byte, exit 0, in lý do; JSON hỏng → giữ nguyên, exit 1; settings là symlink → đích được sửa, symlink vẫn là symlink.
3. Cập nhật build (chép `plugin/commands/` thành `commands/`), chạy lại, validate.

## Acceptance
- AC-07: mọi trường hợp bước 1 và 2 xanh; test không chạm `~/.claude` thật (HOME tạm).

## Dependencies
- task-04-language-address.md

## Verification Plan
- Command: `node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/setup-statusline.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict`
- Named probe: `setup-statusline.test.js` (launcher-written, launcher-missing-root-silent, quote-in-path, set-when-absent, replace-own-launcher, keep-foreign-status-cjs-byte-identical, malformed-exit-1, symlink-preserved).
- Reachability: source — node với `HOME` tạm truyền qua env.
- Oracle: sha256 file settings trước/sau ở trường hợp "lạ" và "hỏng"; `lstat` symlink sau khi ghi; giá trị `statusLine.command`.
- Counterexample: ghi đè statusLine lạ tên `status.cjs` → sha256 khác → đỏ.
- Artifacts: thư mục tạm xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- An earlier run of the build/context/options/isolation tests wrote `~/.claude/cafekit-plugin-data` into the real home (pointing at a test temp dir); it was removed, and every test that runs a plugin hook now sets a temp `HOME`. Confirmed absent after the full suite.
- code-auditor round 1: FAIL — High: rename dropped a 0600 settings mode; Medium: a statusLine without a string command, or a user command merely containing the launcher path, was replaced; Low: the launcher silenced real `MODULE_NOT_FOUND` errors. All fixed with tests (`mode-preserved`, `keep-extended-launcher-command`, `launcher-broken-version-reports`). Round 2: PASS. Open Lows: shell expansion of `$` in the data path, no lock against concurrent settings writes, npx also ships the script (exits 1 there), `allowed-tools: Bash(node:*)` breadth, JSONC not supported.
- Full suite `node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js`: 1460/1462; the 2 failures are in the untracked `agent-authority.test.js` of the `agent-privacy-boundaries` packet.

- Final-Head fixed point (2026-10-21): proof rerun on the final tree with Head identical before and after all seven runs; this Receipt replaces the earlier one. Output keeps every command line except blank lines and the validator's multi-line advice text (icon, repository-root and README install hints).

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/setup-statusline.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/setup-statusline.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict
built plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf
✔ inventory: 15 in-scope skills, 13 agents, no excluded component (78.871541ms)
✔ no-dot-claude-path: Markdown keeps no .claude runtime path and no unsubstituted root (7.368417ms)
✔ hook-commands: every hook runs from the plugin root and exists (0.270417ms)
✔ hook-smoke: every registered hook exits 0 in the built tree without a crash (4596.623583ms)
✔ agent-names-resolve: agents are called by their namespaced name and exist (41.394167ms)
✔ check-detects-drift: --check fails after one byte changes in a copy (1168.703541ms)
✔ build refuses to wipe a non-empty directory that is not a cf build (1.550125ms)
✔ launcher-written: SessionStart writes a launcher and a data pointer that run the statusline (657.913583ms)
✔ quote-in-path: a plugin root containing a quote still loads (487.971167ms)
✔ launcher-missing-root-silent: a removed plugin version makes the launcher exit 0 silently (1036.003667ms)
✔ set-when-absent: setup adds statusLine and keeps every other key (482.603958ms)
✔ replace-own-launcher: setup refreshes a statusLine that already points to the launcher (708.437625ms)
✔ keep-extended-launcher-command: a user command that wraps the launcher is not replaced (1171.991459ms)
✔ mode-preserved: a 0600 settings file stays 0600 after setup (597.5555ms)
✔ launcher-broken-version-reports: a present but broken statusline is not silenced (1095.997208ms)
✔ keep-foreign-status-cjs-byte-identical: another statusLine named status.cjs is left alone (609.699916ms)
✔ malformed-exit-1: unparsable settings stay byte-identical and exit 1 (547.091667ms)
✔ symlink-preserved: a symlinked settings file is updated through its target (563.059792ms)
✔ missing-pointer-exit-1: setup before any plugin session writes nothing (362.083333ms)
✔ command-registered: the plugin ships /cf:setup-statusline calling the script (0.229084ms)
ℹ tests 20
ℹ suites 0
ℹ pass 20
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 9231.145417
Validating plugin manifest: /Users/nghialuutrung/Desktop/cafekit/plugins/cf/.claude-plugin/plugin.json
⚠ Found 1 plugin directory warning:
  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
✔ Validation passed
EXIT=0
```
