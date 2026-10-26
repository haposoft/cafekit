# Task 07 — Lệnh cài agents CafeKit cấp user cho Codex

Status: done

## Outcome
User gọi skill cài agents một lần; agent CafeKit (TOML Codex) có trong `~/.codex/agents`, không file nào của user bị đè, chạy lại sau khi cập nhật plugin thì làm mới đúng file của CafeKit.

## Scope
- In: Build sinh `agents/*.toml` bằng `convertCodexAgentContent`/`codexAgentName` cho cùng danh sách agent với build Claude (`inScopeAgents()`), mỗi file có dấu CafeKit chứa tên plugin, version và sha256 thân đã ship; `setup-agents.cjs` chỉ ghi vào `~/.codex/agents` (không nhận đối số đích từ skill): vắng → ghi; có dấu và thân hiện tại khớp sha đã ship → thay; dấu có mà thân lệch → giữ, báo `modified`; không dấu → giữ, báo; file đích là symlink → coi là của user, giữ; ghi file tạm `pid`+ngẫu nhiên rồi `rename`, giữ mode; báo khi repo hiện tại có `.codex/agents` trùng tên. Skill `setup-agents` gọi tường minh (chính sách như `adv`/`vibe`), chỉ chạy script và báo. Nếu FACT `plugin_agents_loaded=yes`: thay bằng ship `agents/` trong plugin + test tải.
- Out: Xoá agent khi gỡ plugin (gói 3).

## Coverage
- CP-06

## Ownership
- Create: `packages/spec/src/codex/scripts/setup-agents.cjs`
- Create: `packages/spec/src/codex/plugin/skills/setup-agents/SKILL.md`
- Create: `packages/spec/bin/__tests__/codex-setup-agents.test.js`
- Modify: `packages/spec/scripts/build-codex-plugin.mjs`
- Regenerate: `plugins/cf-codex/**`

## Steps
1. Build agents TOML + dấu; viết script và skill.
2. Test với `HOME` tạm: thư mục trống → đủ file; bản cũ còn khớp sha → thay; bản có dấu nhưng sửa thân → giữ byte, báo `modified`; file lạ → giữ byte; mode 0600 giữ; symlink giữ là symlink và đích không đổi; trùng tên với `.codex/agents` của repo → báo; skill có chính sách gọi tường minh, không nhận đối số đích.

## Acceptance
- AC-07: các test bước 2 xanh; test không chạm `~/.codex` thật.

## Dependencies
- task-06-core-context.md

## Verification Plan
- Command: `node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-setup-agents.test.js packages/spec/bin/__tests__/codex-plugin-build.test.js`
- Named probe: `codex-setup-agents.test.js` (agents-built-with-hash-marker, write-when-absent, replace-own-unmodified, keep-modified-own, keep-foreign, mode-preserved, symlink-kept, repo-collision-reported, skill-explicit-no-target).
- Reachability: source — node với `HOME` tạm.
- Oracle: sha256 trước/sau; dòng báo; exit code.
- Counterexample: đè bản user đã sửa mà giữ dấu → sha khác → đỏ.
- Artifacts: thư mục tạm xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- Spike fact `plugin_agents_loaded=no`, so the command path of D-04 applies. The build writes `agents/<snake>.toml` = `# CafeKit agent: plugin=cf version=<v> sha256=<body hash>` + `convertCodexAgentContent` output for the 14 `inScopeAgents()`; bodies are byte-equal to the npx conversion. `setup-agents.cjs` ships as `scripts/setup-agents.cjs`, so the task-06 command table defines `{cafekit:setup-agents}` without further wiring; the npx installer copies only `src/claude/scripts` and never sees it.
- Scope deviation, implementer's choice: the target is `$CODEX_HOME/agents` when `CODEX_HOME` is set (absolute), else `~/.codex/agents`, because Codex reads agents from its home and the D-08 live checks run with a temp `CODEX_HOME` beside the real `HOME`; a relative `CODEX_HOME` is refused (exit 1, nothing written). Probe `codex-home-honored`. Whether Codex reads `$CODEX_HOME/agents` is an inference from its home layout, not verified here.
- `codex-plugin-build.test.js` `inventory-and-policy` (outside Ownership, inside this Command) now expects the Claude plugin skills plus `CODEX_ONLY_SKILLS` and checks each skill's policy against its own source.
- code-auditor round 1: PASS_WITH_WARNINGS — Medium: the `CODEX_HOME` branch had no probe and a relative value fell back to the real `~/.codex`. Repaired with the refusal and `codex-home-honored`; Low 2 (an unreadable file stopped the run) repaired as `kept (unreadable)` with probe `unreadable-kept`. Round 2: PASS; its Low 1 (the refused case did not assert that nothing was written) is now asserted.
- Counterexample checked: making the script treat a marked-but-edited file as its own turns `keep-modified-own` red; restored.
- One run failed only on `hook-smoke` (the PreCompact hook killed at its 20 s timeout while the machine load average was ~150 from other workloads); the same test passed in the runs before and after it, and the Receipt run below started once the load fell under 30.
- Open limitations: a microsecond TOCTOU window between the ownership check and the rename; collisions are matched by file name, not the TOML `name` field; `kept (unreadable)` also labels ELOOP/ENOTDIR; whether Codex honors the explicit-only policy for a plugin skill is unverified (task-08 does not run setup-agents); a user file carrying a self-consistent forged marker counts as CafeKit's (accepted in D-04); agent bodies keep the npx paths they already had (`advisor` names `.agents/skills/adv/SKILL.md`, absent in a plugin-only repository).

## Receipt

Verification: PASS
Command: node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-setup-agents.test.js packages/spec/bin/__tests__/codex-plugin-build.test.js
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ node packages/spec/scripts/build-codex-plugin.mjs && node --test packages/spec/bin/__tests__/codex-setup-agents.test.js packages/spec/bin/__tests__/codex-plugin-build.test.js
built Codex plugin cf into /Users/nghialuutrung/Desktop/cafekit/plugins/cf-codex
✔ inventory-and-policy: the Claude plugin skill list, Codex names, and explicit-only policies (105.016333ms)
✔ path-allowlist: Markdown reaches plugin files through {CAFEKIT_ROOT}, never an install path (13.182584ms)
✔ manifest-and-marketplace: plugin.json and the repo marketplace carry the keys Codex reads (0.304083ms)
✔ marketplace-not-ignored: git can commit .agents/plugins/marketplace.json (16.365959ms)
✔ claude-marketplace-guard: the Codex marketplace never points at the Claude plugin tree (0.165292ms)
✔ check-detects-drift: --check fails after one byte changes in a fresh copy (705.871ms)
✔ runtime-matches-npx: the plugin runtime holds the same files and bytes as an npx Codex install (700.712416ms)
✔ requires-resolve: every relative require in the plugin hooks resolves inside the tree (2.013667ms)
✔ hook-commands-fallback: every plugin hook has a POSIX command with a node PATH fallback and a Windows command (0.802458ms)
✔ no-build-machine-paths: hooks.json names no absolute path of the machine that built it (168.690209ms)
✔ npx-hook-commands-unchanged: the npx install still gets absolute project launchers (675.535ms)
✔ hook-smoke: every generated plugin launcher runs its hook to exit 0 without a crash log (2960.316958ms)
✔ agents-built-with-hash-marker: every in-scope agent ships as TOML whose marker hashes its body (102.967166ms)
✔ write-when-absent: an empty agents directory receives every shipped agent (173.805333ms)
✔ replace-own-unmodified: an unedited agent from an older release is replaced (179.931291ms)
✔ keep-modified-own: an agent whose body was edited under the marker keeps its bytes (190.835709ms)
✔ keep-foreign: a file CafeKit did not install keeps its bytes (192.301959ms)
✔ mode-preserved: replacing an owned agent keeps its file mode (191.827083ms)
✔ codex-home-honored: an absolute CODEX_HOME receives the agents and a relative one is refused (415.385583ms)
✔ unreadable-kept: a file it cannot read is kept and the other agents still install (200.946375ms)
✔ symlink-kept: a symlinked agent stays a symlink and its target is untouched (202.781417ms)
✔ repo-collision-reported: an agent of the same name in the repository is reported (196.42575ms)
✔ skill-explicit-no-target: the skill is explicit-only and the script refuses any argument (187.399083ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5606.05825
EXIT=0
```
