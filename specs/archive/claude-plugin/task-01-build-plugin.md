# Task 01 — Build cây plugin `plugins/cf/` và marketplace ở gốc repo

Status: done

## Outcome
`node packages/spec/scripts/build-claude-plugin.mjs` sinh ra `plugins/cf/` là plugin Claude Code hợp lệ tên `cf`; `.claude-plugin/marketplace.json` ở gốc repo trỏ tới nó; mọi hook trong cây build chạy được.

## Scope
- In: chép 15 skill = `skills.required` (`packages/spec/src/claude/migration-manifest.json`) trừ `chrome-devtools`, `ui-ux`, `ui-ux-pro-max`; 13 agent = `agents/*.md` trừ `ui-ux-designer.md`; `output-styles/`, `hooks/**` (trừ `__tests__`), `scripts/`, `references/`, `rules/`, `status.cjs`, `runtime.schema.json`. Đổi đường dẫn trong mọi `.md` theo D-06 và kết quả task-00 cho cả dạng `.claude/` và `.claude\` với tiền tố `skills|references|scripts|rules`; nếu task-00 cho `agent_name` có namespace thì đổi tên gọi agent trần tương ứng. Sinh `hooks/hooks.json` từ khối `hooks` của `src/claude/settings/settings.json`, thay `$CLAUDE_PROJECT_DIR/.claude/hooks/` bằng `${CLAUDE_PLUGIN_ROOT}/hooks/`. Sinh `.claude-plugin/plugin.json`: `name: "cf"`, `version` = `packages/spec/package.json`, `description`, `author`, `license`. Marketplace: `name`, `description`, `owner`, một entry `cf` với `source: "./plugins/cf"`. Build xoá sạch `plugins/cf/` trước khi ghi. Script `--check <dir>` build ra thư mục tạm và so từng byte với `<dir>` (dùng ở release).
- Out: document skills; 4 thành phần cần dependency (plan Out of scope); `settings.json`, `CLAUDE.md`, `gitignore`, `migration-manifest.json`, `runtime.json` mặc định; kiểm freshness trong CI.

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/scripts/build-claude-plugin.mjs`
- Create: `packages/spec/bin/__tests__/claude-plugin-build.test.js`
- Create: `.claude-plugin/marketplace.json`
- Create (generated): `plugins/cf/**`
- Read: `packages/spec/src/claude/**`, `packages/spec/package.json`, Receipt của `task-00-host-spike.md`

## Steps
1. Viết script build theo Scope → chạy, thấy `plugins/cf/.claude-plugin/plugin.json`.
2. Viết test, build vào thư mục tạm (không đọc cây commit): (b) đúng 15 thư mục skill, 13 agent, không có 4 thành phần loại trừ; (c) không file `.md` nào còn `.claude/skills/`, `.claude/references/`, `.claude/scripts/`, `.claude/rules/` hoặc dạng backslash; (d) mọi `command` trong `hooks/hooks.json` trỏ `${CLAUDE_PLUGIN_ROOT}/hooks/` và file tồn tại; (e) chạy từng hook trong cây tạm bằng `spawnSync` với stdin mẫu của event tương ứng, `CLAUDE_PLUGIN_ROOT` = cây tạm, `CLAUDE_PLUGIN_DATA` và `CLAUDE_PROJECT_DIR` = thư mục tạm → exit 0, stdout/stderr không chứa `Completion gate unavailable` hay `crash`; (f) `--check` báo khác khi sửa một byte trong bản copy; (g) với mỗi agent `<name>` trong cây: nếu `FACT agent_name` cho thấy có namespace thì không file `.md` nào còn chuỗi `` `<name>` `` hay `subagent_type: <name>` dạng trần (chỉ còn dạng có namespace); nếu không có namespace thì không file nào chứa `cf:<name>`; mọi tên agent dạng có namespace trong Markdown trỏ tới một agent có trong cây.
3. Chạy `claude plugin validate plugins/cf --strict` và `claude plugin validate . --strict`.

## Acceptance
- AC-01: (b), (c), (d), (g) xanh; cả hai lệnh validate in `Validation passed`.
- AC-02: (e) xanh với mọi hook trong `hooks.json`.
- AC-09: (f) xanh; `node packages/spec/scripts/build-claude-plugin.mjs --check plugins/cf` exit 0 ngay sau build.

## Dependencies
- task-00-host-spike.md

## Verification Plan
- Command: `node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check plugins/cf && claude plugin validate plugins/cf --strict && claude plugin validate . --strict`
- Named probe: `claude-plugin-build.test.js` (inventory, no-dot-claude-path, hook-commands, hook-smoke, check-detects-drift, agent-names-resolve) + `claude plugin validate`.
- Reachability: source — node; installed — `claude` 2.1.305, `plugin validate` không gọi model.
- Oracle: ≥6 test pass (mỗi probe có tên ở trên ít nhất một test), exit 0; validate in `Validation passed`.
- Counterexample: build sót `scripts/` → `spec-gate` in `Completion gate unavailable` → (e) đỏ; marketplace thiếu `description` → validate `--strict` đỏ.
- Artifacts: `plugins/cf/**` nằm trong worktree (commit do Bro quyết); thư mục tạm của test xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- code-auditor round 1: PASS_WITH_WARNINGS (3 Medium) → fixed: `--check` temp dir cleanup via `process.exitCode`; `clearOutput` refuses a non-empty non-cf `--out`; agent-body `${CLAUDE_PLUGIN_ROOT}` substitution observed live on claude 2.1.306 (probe agent replied `ROOT=<absolute plugin root>`). Round 2: PASS.
- Validator warnings (non-blocking): no plugin icon; README has no marketplace install line.

- Final-Head fixed point (2026-10-21): proof rerun on the final tree with Head identical before and after all seven runs; this Receipt replaces the earlier one. Output keeps every command line except blank lines and the validator's multi-line advice text (icon, repository-root and README install hints).

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check plugins/cf && claude plugin validate plugins/cf --strict && claude plugin validate . --strict
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ node packages/spec/scripts/build-claude-plugin.mjs && node --test packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check plugins/cf && claude plugin validate plugins/cf --strict && claude plugin validate . --strict
built plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf
✔ inventory: 15 in-scope skills, 13 agents, no excluded component (48.047667ms)
✔ no-dot-claude-path: Markdown keeps no .claude runtime path and no unsubstituted root (12.672708ms)
✔ hook-commands: every hook runs from the plugin root and exists (1.056583ms)
✔ hook-smoke: every registered hook exits 0 in the built tree without a crash (3959.944ms)
✔ agent-names-resolve: agents are called by their namespaced name and exist (14.128958ms)
✔ check-detects-drift: --check fails after one byte changes in a copy (938.956458ms)
✔ build refuses to wipe a non-empty directory that is not a cf build (1.14725ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5222.615792
plugin tree matches a fresh build: /Users/nghialuutrung/Desktop/cafekit/plugins/cf
Validating plugin manifest: /Users/nghialuutrung/Desktop/cafekit/plugins/cf/.claude-plugin/plugin.json
⚠ Found 1 plugin directory warning:
  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
✔ Validation passed
Validating marketplace manifest: /Users/nghialuutrung/Desktop/cafekit/.claude-plugin/marketplace.json
ℹ Advice (does not change the verdict):
✔ Validation passed
EXIT=0
```
