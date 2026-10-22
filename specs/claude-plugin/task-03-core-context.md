# Task 03 — Lõi chỉ dẫn ≤10.000 ký tự chèn qua SessionStart

Status: done

## Outcome
Plugin `cf` có hook SessionStart `plugin-context.cjs` in JSON `hookSpecificOutput.additionalContext` chứa lõi chỉ dẫn ≤10.000 ký tự, kèm đường dẫn tới từng file rules chi tiết trong plugin, và một câu đánh dấu cố định nằm trong 2.000 ký tự đầu.

## Scope
- In: `plugin/core.md` gom phần bắt buộc từ khối CORE của `src/common/AGENTS.md`, `src/claude/CLAUDE.md` và 10 file `src/claude/rules/*.md` (rules 25.340 byte; tổng cả ba nguồn 29.307 byte); mỗi rules file được nhắc bằng một dòng "đọc `<plugin root>/rules/<file>.md` khi <chủ đề>"; hook thay `${CLAUDE_PLUGIN_ROOT}` bằng `process.env.CLAUDE_PLUGIN_ROOT` trước khi in; câu đánh dấu `CAFEKIT-CORE-LOADED` ở đầu; matcher `startup|resume|clear|compact`; build thêm entry này vào `plugins/cf/hooks/hooks.json` (không vào `src/claude/settings/settings.json`).
- Out: xưng hô và ngôn ngữ (task-04); nội dung rules chi tiết giữ nguyên; chứng minh model tuân theo (task-06).

## Coverage
- CP-03

## Ownership
- Create: `packages/spec/src/claude/plugin/core.md`
- Create: `packages/spec/src/claude/hooks/plugin-context.cjs`
- Create: `packages/spec/src/claude/hooks/__tests__/plugin-context.test.js`
- Modify: `packages/spec/scripts/build-claude-plugin.mjs`
- Regenerate: `plugins/cf/**`

## Steps
1. Viết `core.md` → đếm ký tự (`[...text].length`) ≤10.000 sau khi thay root bằng chuỗi dài 120 ký tự.
2. Viết hook → test: có `CLAUDE_PLUGIN_ROOT` → JSON hợp lệ, `hookEventName: "SessionStart"`, mọi đường dẫn rules trong text tồn tại, `CAFEKIT-CORE-LOADED` nằm trong 2.000 ký tự đầu; không có biến → không in gì, exit 0.
3. Cập nhật build, chạy lại.

## Acceptance
- AC-04: test độ dài, JSON, đường dẫn, vị trí câu đánh dấu xanh; `src/claude/settings/settings.json` không chứa `plugin-context.cjs`.

## Dependencies
- task-02-hook-state-plugin-data.md

## Verification Plan
- Command: `node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-context.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict`
- Named probe: `plugin-context.test.js` (core-under-10000-chars, emits-session-start-json, rule-paths-exist, marker-in-first-2000, silent-without-plugin-root, npx-settings-untouched).
- Reachability: source — node; installed — `claude plugin validate`. Hành vi model ở task-06.
- Oracle: độ dài ≤10000; JSON parse được; `fs.existsSync` đúng mọi đường dẫn.
- Counterexample: lõi vượt 10.000 ký tự → test độ dài đỏ.
- Artifacts: chỉ cây build.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- code-auditor round 1: PASS_WITH_WARNINGS — Medium: `replaceAll` string replacement expanded `$&` in a plugin root (fixed with a function replacement, test `dollar-in-root`); Medium: core dropped the authority boundary from `skill-workflow-routing.md` (diagnosis ≠ repair, implementation ≠ commit/push/release) — restored; Low: drift → sync/audit, malformed hook output → stop and report, read README first, advice is not execution proof — restored. Round 2: PASS.
- Core length after fixes: 7,358 characters with a 120-character plugin root (limit 10,000).

- Final-Head fixed point (2026-10-21): proof rerun on the final tree with Head identical before and after all seven runs; this Receipt replaces the earlier one. Output keeps every command line except blank lines and the validator's multi-line advice text (icon, repository-root and README install hints).

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-context.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/src/claude/hooks/__tests__/plugin-context.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && claude plugin validate plugins/cf --strict
built plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf
✔ inventory: 15 in-scope skills, 13 agents, no excluded component (113.709ms)
✔ no-dot-claude-path: Markdown keeps no .claude runtime path and no unsubstituted root (12.025375ms)
✔ hook-commands: every hook runs from the plugin root and exists (0.295375ms)
✔ hook-smoke: every registered hook exits 0 in the built tree without a crash (3962.215375ms)
✔ agent-names-resolve: agents are called by their namespaced name and exist (33.51525ms)
✔ check-detects-drift: --check fails after one byte changes in a copy (996.046208ms)
✔ build refuses to wipe a non-empty directory that is not a cf build (1.859916ms)
✔ core-under-10000-chars: the injected core fits the host limit with a 120-character root (253.571667ms)
✔ emits-session-start-json: the hook prints one JSON object with additionalContext (197.684625ms)
✔ rule-paths-exist: every rules path in the core resolves inside the plugin (258.35325ms)
✔ dollar-in-root: a plugin root containing $& stays literal in every path (628.483834ms)
✔ marker-in-first-2000: the load marker survives the host preview cut (259.136834ms)
✔ silent-without-plugin-root: outside the plugin the hook prints nothing (284.30625ms)
✔ npx-settings-untouched: the npx settings template does not register the plugin hook (0.631ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5426.948459
Validating plugin manifest: /Users/nghialuutrung/Desktop/cafekit/plugins/cf/.claude-plugin/plugin.json
⚠ Found 1 plugin directory warning:
  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
✔ Validation passed
EXIT=0
```
