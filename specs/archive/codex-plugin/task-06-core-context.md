# Task 06 — Lõi chỉ dẫn Codex qua SessionStart

Status: done

## Outcome
Plugin Codex có hook SessionStart in `additionalContext` chứa lõi ≤10.000 ký tự (câu đánh dấu `CAFEKIT-CODEX-CORE-LOADED` trong 2.000 ký tự đầu), trỏ tới rules chi tiết trong plugin; không bản cài npx nào nhận hook này.

## Scope
- In: `packages/spec/src/codex/plugin/core.md` gom phần bắt buộc từ `packages/spec/src/common/AGENTS.md` và `packages/spec/src/codex/AGENTS.md` (bỏ dòng chỉ đúng cho npx); tên gọi skill theo FACT; hook `packages/spec/src/codex/plugin/hooks/plugin-context.cjs` thay gốc bằng hàm và chèn bảng lệnh tuyệt đối D-06 (mỗi script mà build ghi nhận: `<tên>: node "<plugin root>/scripts/<tên>.cjs"`, đường dẫn quote an toàn); không có nhánh option (`plugin_options` không export); build chép hook và đăng ký trong `hooks.json` của plugin.
- Out: Hook npx.

## Coverage
- CP-05

## Ownership
- Create: `packages/spec/src/codex/plugin/core.md`
- Create: `packages/spec/src/codex/plugin/hooks/plugin-context.cjs`
- Create: `packages/spec/bin/__tests__/codex-plugin-context.test.js`
- Modify: `packages/spec/scripts/build-codex-plugin.mjs`
- Regenerate: `plugins/cf-codex/**`

## Steps
1. Viết `core.md`, hook, cập nhật build.
2. Test: ≤10.000 ký tự với gốc dài 120 ký tự; JSON đúng dạng Codex nhận; marker trong 2.000 đầu; bảng lệnh có đủ mọi script build ghi nhận và mỗi lệnh chạy được (`node <path> --help` hoặc exit hợp lệ với stdin rỗng); đường dẫn rules tồn tại; gốc chứa `$&` giữ nguyên; không gốc plugin → im lặng; một bản cài npx (installer vào repo tạm) không có `plugin-context.cjs` và `hooks.json` npx không gọi nó.

## Acceptance
- AC-06: các test bước 2 xanh.

## Dependencies
- task-05-safety-keys.md

## Verification Plan
- Command: `node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-plugin-context.test.js packages/spec/bin/__tests__/codex-plugin-build.test.js`
- Named probe: `codex-plugin-context.test.js` (core-under-10000-chars, command-table-complete, emits-session-start-json, marker-in-first-2000, rule-paths-exist, dollar-in-root, silent-without-plugin-root, npx-install-lacks-plugin-hook).
- Reachability: source — node; hành vi model ở task-08.
- Oracle: độ dài; JSON; đường dẫn; danh sách file bản npx.
- Counterexample: hook lọt vào bản npx → `npx-install-lacks-plugin-hook` đỏ.
- Artifacts: chỉ cây build.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- The tree keeps the plugin-only files under `plugin/` (`plugin/core.md`, `plugin/hooks/plugin-context.cjs`, `plugin/script-commands.json`), so `hooks/` stays byte-equal to the npx install (`runtime-matches-npx`). The hook requires `../../hooks/lib/hook-context.cjs`, which resolves from both `src/codex/plugin/hooks/` and `<root>/plugin/hooks/`; it is silent unless `pluginRoot()` matches by realpath and stands down beside a real npx install (D-07).
- `codex-plugin-build.test.js` `hook-commands-fallback` (outside Ownership, inside this Command) pinned the handler count to the npx template; it now requires exactly one plugin-only handler, on SessionStart, with every other handler still equal to the template count and every launcher checked as before.
- code-auditor round 1: PASS with six Lows. Applied: the core states the default language rule of the npx block; the command table follows the marker line, so a long root pushes the rules list, not the table, past the cap; the dead `.codex/...` mapping line is removed. A wording slip put a `{cafekit:…}` token in the core body and `command-table-complete` failed; the wording was fixed, not the test. Round 2 on that delta: PASS.
- Open limitations: POSIX single quoting breaks on Windows when the plugin root contains `'`; `$cf-setup-agents` arrives with task-07; the vibe sentence keeps `/cf:vibe` and `/vibe` because `vibe-run.test.js` pins it; beside an npx install the hook prints nothing, so the plugin's duplicate `$cf-*` skills carry undefined `{CAFEKIT_ROOT}`/`{cafekit:…}` tokens (consequence of D-07; for the user at GATE-DONE; package 3 `migrate` closes it).
- The pre-change run of the Command was skipped: the work resumed after compaction with task-05 still open, and the new test file did not exist before this task.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-plugin-context.test.js packages/spec/bin/__tests__/codex-plugin-build.test.js
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-plugin-context.test.js packages/spec/bin/__tests__/codex-plugin-build.test.js
built Codex plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
✔ inventory-and-policy: the Claude plugin skill list, Codex names, and explicit-only policies (117.034583ms)
✔ path-allowlist: Markdown reaches plugin files through {CAFEKIT_ROOT}, never an install path (14.323375ms)
✔ manifest-and-marketplace: plugin.json and the repo marketplace carry the keys Codex reads (0.316958ms)
✔ marketplace-not-ignored: git can commit .agents/plugins/marketplace.json (17.8325ms)
✔ claude-marketplace-guard: the Codex marketplace never points at the Claude plugin tree (0.174625ms)
✔ check-detects-drift: --check fails after one byte changes in a fresh copy (866.34425ms)
✔ runtime-matches-npx: the plugin runtime holds the same files and bytes as an npx Codex install (866.314208ms)
✔ requires-resolve: every relative require in the plugin hooks resolves inside the tree (2.608375ms)
✔ hook-commands-fallback: every plugin hook has a POSIX command with a node PATH fallback and a Windows command (0.971209ms)
✔ no-build-machine-paths: hooks.json names no absolute path of the machine that built it (196.82525ms)
✔ npx-hook-commands-unchanged: the npx install still gets absolute project launchers (698.481083ms)
✔ hook-smoke: every generated plugin launcher runs its hook to exit 0 without a crash log (3201.75425ms)
✔ emits-session-start-json: the hook prints the SessionStart JSON Codex reads, registered for every source (286.905208ms)
✔ core-under-10000-chars: with a 120-character plugin root the injected text stays within the host cap (204.946708ms)
✔ marker-in-first-2000: the core marker sits in the first 2000 characters (194.042292ms)
✔ command-table-complete: every recorded script has one absolute command that runs (1087.70825ms)
✔ rule-paths-exist: the root, the rules directory and every rules file named in the core exist (222.647ms)
✔ dollar-in-root: a plugin root containing `$&` is injected literally (262.555875ms)
✔ silent-without-plugin-root: without a plugin root, or with one inherited from elsewhere, the hook prints nothing (344.154ms)
✔ npx-install-lacks-plugin-hook: an npx Codex install neither ships nor calls the plugin hook, and the plugin stands down beside it (928.212541ms)
ℹ tests 20
ℹ suites 0
ℹ pass 20
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6293.710333
EXIT=0
```
