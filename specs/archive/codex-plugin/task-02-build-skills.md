# Task 02 — Build skills, manifest, marketplace của plugin Codex

Status: done

## Outcome
`node packages/spec/scripts/build-codex-plugin.mjs` sinh phần skills + `.codex-plugin/plugin.json` (`name: "cf"`) của `plugins/cf-codex/` và `.agents/plugins/marketplace.json` commit được.

## Scope
- In: Skill trong phạm vi = cùng danh sách gói 1 (import từ `packages/spec/scripts/build-claude-plugin.mjs`), qua `normalizeCodexBody` + chính sách gọi (`syncCodexInvocationPolicy`); theo D-06: mọi lời gọi `node .codex/scripts/<x>.cjs` (và dạng `.claude/scripts/`) trong Markdown đổi thành "lệnh `<x>` trong bảng lệnh CafeKit", build trả về danh sách script được nhắc để task-06 sinh bảng; skill gọi bằng tên thư mục (`skill_invocation=$probe-skill`, không namespace); allowlist đường dẫn: cấm `\.codex[/\\](skills|references|scripts|rules|hooks)` và `\.agents/skills`, cho phép `.codex/runtime.json`, `.codex/` của repo, `~/.codex/agents`; `.gitignore` đổi dòng `.agents` (`.gitignore:116`) thành `.agents/*` kèm `!.agents/plugins/` để git mở lại được thư mục (kiểm installer npx không xoá file); chặn cài nhầm cây Claude theo D-05; `--check <dir>`.
- Out: Runtime, hooks.json (task-03).

## Coverage
- CP-02

## Ownership
- Create: `packages/spec/scripts/build-codex-plugin.mjs`
- Create: `packages/spec/bin/__tests__/codex-plugin-build.test.js`
- Create: `.agents/plugins/marketplace.json`
- Modify: `.gitignore`
- Create (generated): `plugins/cf-codex/**`

## Steps
1. Viết build phần skills/manifest/marketplace.
2. Test (build vào thư mục tạm): inventory + chính sách gọi khớp bản installer sinh; allowlist đường dẫn; manifest và marketplace có khoá docs yêu cầu; `git check-ignore` không chặn marketplace; guard D-05; `--check` bắt lệch một byte.

## Acceptance
- AC-02: các test bước 2 xanh.

## Dependencies
- task-01-runtime-layout.md

## Verification Plan
- Command: `node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-plugin-build.test.js && node packages/spec/scripts/build-codex-plugin.mjs --check plugins/cf-codex`
- Named probe: `codex-plugin-build.test.js` (inventory-and-policy, path-allowlist, manifest-and-marketplace, marketplace-not-ignored, claude-marketplace-guard, check-detects-drift).
- Reachability: source — node, git.
- Oracle: test pass, exit 0.
- Counterexample: marketplace vẫn bị gitignore → `marketplace-not-ignored` đỏ.
- Artifacts: `plugins/cf-codex/**` trong worktree; thư mục tạm xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- Outside the owned list, required by this task and kept minimal: `packages/spec/bin/phases/copy-payload.js` exports `isExplicitOnlySkill`, `CODEX_POLICY_FILE`, `CODEX_EXPLICIT_ONLY_POLICY` (shared policy, no copy); `packages/spec/scripts/build-claude-plugin.mjs` exports `clearOutput` with plugin name and manifest dir parameters; `packages/spec/bin/phases/root-config.js` `hasPattern` accepts `<dir>/*` so a reinstall does not append `.agents/` after `!.agents/plugins/` and hide the marketplace again.
- D-06 form in Markdown: plugin files as `{CAFEKIT_ROOT}/<path>`, scripts as `{cafekit:<name>}` (command table defined by task-06). Current table: `provenance`, `scan-staged-secrets`, `workflow-policy`.
- code-auditor round 1: FAIL — Critical: scripts were left as unquoted `node {CAFEKIT_ROOT}/scripts/<x>.cjs` instead of the D-06 command table; Medium: `check-ignore` blind to tracked files; reinstall would re-hide `.agents/plugins/`. Fixed with tests (path-allowlist forbids `{CAFEKIT_ROOT}/scripts/`, `--no-index`, `hasPattern`). Round 2: PASS; its Low (`--check plugins/cf-codex` skipped the marketplace) fixed — negative control: an edited marketplace makes `--check plugins/cf-codex` exit 1 with `changed .agents/plugins/marketplace.json`.
- Full suite after fixes: 1632/1632. Generated `plugins/cf-codex/skills/vibe/` also carries the uncommitted `vibe` source edits of the parallel `vibe-pipeline-skills` packet.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-plugin-build.test.js && node packages/spec/scripts/build-codex-plugin.mjs --check plugins/cf-codex
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-plugin-build.test.js && node packages/spec/scripts/build-codex-plugin.mjs --check plugins/cf-codex
plugin tree matches a fresh build: /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
EXIT=0
```
