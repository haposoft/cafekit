# Task 04 — Ngôn ngữ, xưng hô và đường dẫn có hiệu lực khi repo không có runtime.json

Status: done

## Outcome
Dưới plugin, repo không cần `.claude/runtime.json`: hook rules (phiên chính) và hook agent (subagent) vẫn chèn đường dẫn specs/plans/docs mặc định và ngôn ngữ từ option `response_language`; lõi chỉ dẫn có câu xưng hô từ option `address`; mọi giá trị option được làm sạch.

## Scope
- In: `plugin.json` khai `userConfig.response_language` và `userConfig.address` (string, không bắt buộc, mặc định rỗng). `rules.cjs` và `agent.cjs` khi không có runtime.json **và** có `CLAUDE_PLUGIN_ROOT` dùng `{}` thay vì thoát (`packages/spec/src/claude/hooks/rules.cjs:36-37`, `packages/spec/src/claude/hooks/agent.cjs:47-49`). Ngôn ngữ: `runtime.locale.responseLanguage` thắng, rồi `CLAUDE_PLUGIN_OPTION_RESPONSE_LANGUAGE`. `plugin-context.cjs` thêm mục Addressing khi `CLAUDE_PLUGIN_OPTION_ADDRESS` có giá trị. Làm sạch cả hai option: bỏ ký tự điều khiển và xuống dòng, trim, cắt ≤64 ký tự.
- Out: hành vi npx (không có `CLAUDE_PLUGIN_ROOT` → vẫn thoát khi thiếu runtime.json); schema runtime.json.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/claude/hooks/rules.cjs`
- Modify: `packages/spec/src/claude/hooks/agent.cjs`
- Modify: `packages/spec/src/claude/hooks/plugin-context.cjs`
- Modify: `packages/spec/scripts/build-claude-plugin.mjs`
- Create: `packages/spec/src/claude/hooks/__tests__/plugin-options.test.js`
- Regenerate: `plugins/cf/**`

## Steps
1. Sửa `rules.cjs`, `agent.cjs` → test cho mỗi hook: plugin + không runtime.json + không option → có đường dẫn mặc định, không mục Language; plugin + option `Tiếng Việt` → `Respond in Tiếng Việt`; plugin + runtime.json `English` + option `Tiếng Việt` → `English`; không plugin + không runtime.json → không in gì; option `response_language` = `x\n## Y` hoặc 10.000 ký tự → dòng Language là một dòng ≤64 ký tự giá trị, không có heading `## Y`.
2. Sửa `plugin-context.cjs` → test: `address=Bro` → context chứa `Bro`; không option → không có mục Addressing; option 10.000 ký tự và option chứa `\n## X` → một dòng ≤64 ký tự, lõi vẫn ≤10.000.
3. Cập nhật build, chạy lại, validate.

## Acceptance
- AC-05: 5 trường hợp bước 1 xanh cho cả `rules.cjs` và `agent.cjs`.
- AC-06: 4 trường hợp bước 2 xanh.

## Dependencies
- task-03-core-context.md

## Verification Plan
- Command: `node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-options.test.js packages/spec/src/claude/hooks/__tests__/plugin-context.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict`
- Named probe: `plugin-options.test.js` (rules-defaults, rules-option-language, rules-runtime-wins, rules-npx-unchanged, rules-language-sanitized, agent-defaults, agent-option-language, agent-runtime-wins, agent-npx-unchanged, agent-language-sanitized, address-present, address-absent, option-oversize, option-newline).
- Reachability: source — `spawnSync` với env giả; tên biến `CLAUDE_PLUGIN_OPTION_<KEY>` theo plugins-reference, đã quan sát ở task-00 (`hook_env_option`).
- Oracle: stdout chứa/không chứa đúng chuỗi kỳ vọng; độ dài dòng address ≤64.
- Counterexample: option thắng runtime.json → trường hợp 3 đỏ; option có `\n` vẫn tạo heading mới → đỏ.
- Artifacts: thư mục tạm xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- An eager `require('./lib/plugin-options.cjs')` in `rules.cjs`/`agent.cjs` broke npx installs (7 regressions in the full suite: installed trees ship only `migration-manifest.json` `runtime.files`). Fixed by a plugin-only lazy require and by adding `hooks/lib/plugin-options.cjs` to `packages/spec/src/claude/migration-manifest.json` (outside this task's Ownership list; required so an inherited `CLAUDE_PLUGIN_ROOT` cannot break an npx install). Test `npx-installed-tree` covers it.
- code-auditor round 1: PASS_WITH_WARNINGS (Medium: npx test did not model the manifest tree; Low: bidi/zero-width chars, newline assertion relied on JSON quoting, inherited plugin root) → all fixed. Round 2: PASS; the literal U+202E in the test file was then replaced by an escape.
- Full suite `node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js`: 1447/1449 twice; the 2 failures are in the untracked `agent-authority.test.js` of the `agent-privacy-boundaries` packet.

- Final-Head fixed point (2026-10-21): proof rerun on the final tree with Head identical before and after all seven runs; this Receipt replaces the earlier one. Output keeps every command line except blank lines and the validator's multi-line advice text (icon, repository-root and README install hints).

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-options.test.js packages/spec/src/claude/hooks/__tests__/plugin-context.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-options.test.js packages/spec/src/claude/hooks/__tests__/plugin-context.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict
built plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf
✔ inventory: 15 in-scope skills, 13 agents, no excluded component (193.497709ms)
✔ no-dot-claude-path: Markdown keeps no .claude runtime path and no unsubstituted root (26.5705ms)
✔ hook-commands: every hook runs from the plugin root and exists (0.328708ms)
✔ hook-smoke: every registered hook exits 0 in the built tree without a crash (4897.581625ms)
✔ agent-names-resolve: agents are called by their namespaced name and exist (28.206417ms)
✔ check-detects-drift: --check fails after one byte changes in a copy (1312.416583ms)
✔ build refuses to wipe a non-empty directory that is not a cf build (1.360833ms)
✔ core-under-10000-chars: the injected core fits the host limit with a 120-character root (344.084875ms)
✔ emits-session-start-json: the hook prints one JSON object with additionalContext (321.163541ms)
✔ rule-paths-exist: every rules path in the core resolves inside the plugin (283.334458ms)
✔ dollar-in-root: a plugin root containing $& stays literal in every path (826.570416ms)
✔ marker-in-first-2000: the load marker survives the host preview cut (330.130291ms)
✔ silent-without-plugin-root: outside the plugin the hook prints nothing (285.69525ms)
✔ npx-settings-untouched: the npx settings template does not register the plugin hook (0.420542ms)
✔ rules-defaults: without runtime.json the plugin still injects default paths and no language (294.974584ms)
✔ rules-option-language: the response_language option sets the response language (441.793792ms)
✔ rules-runtime-wins: a runtime.json language wins over the option (296.82175ms)
✔ rules-npx-unchanged: outside the plugin a missing runtime.json still injects nothing (329.01575ms)
✔ rules-language-sanitized: a hostile option stays one short line (716.119666ms)
✔ agent-defaults: without runtime.json the plugin still injects default paths and no language (312.461458ms)
✔ agent-option-language: the response_language option sets the response language (265.237916ms)
✔ agent-runtime-wins: a runtime.json language wins over the option (190.277417ms)
✔ agent-npx-unchanged: outside the plugin a missing runtime.json still injects nothing (194.240875ms)
✔ agent-language-sanitized: a hostile option stays one short line (547.439ms)
✔ address-present: the address option adds the addressing instruction (279.352291ms)
✔ address-absent: no address option, no addressing section (260.59825ms)
✔ option-oversize: a 10,000-character address is cut to 64 and the core stays within 10,000 (293.834709ms)
✔ option-newline: an address with a newline cannot open a new heading (284.700708ms)
✔ npx-installed-tree: hooks run from a tree holding only the manifest runtime files (1381.19325ms)
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6832.513125
Validating plugin manifest: /Users/nghialuutrung/Desktop/cafekit/plugins/cf/.claude-plugin/plugin.json
⚠ Found 1 plugin directory warning:
  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
✔ Validation passed
EXIT=0
```
