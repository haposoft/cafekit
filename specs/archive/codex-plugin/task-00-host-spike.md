# Task 00 — Spike: quan sát host Codex dưới `CODEX_HOME` tạm

Status: done

## Outcome
Một script chạy Codex CLI thật dưới `CODEX_HOME` tạm với plugin dùng một lần, in các dòng `FACT` để D-02…D-08 dựa trên quan sát, và không chạm `~/.codex` thật.

## Scope
- In: `CODEX_HOME=$(mktemp -d)` với `config.toml` rỗng và `auth.json` là symlink tới `~/.codex/auth.json` (không chép, không in nội dung); ghi sha256 manifest của `~/.codex` (trừ `sessions/`, `log/`, `history*`) trước và sau. Marketplace tạm (`.agents/plugins/marketplace.json`) + plugin `probe-cf` gồm: skill `probe-skill` có nonce trong thân và `${PLUGIN_ROOT}` trong `SKILL.md` lẫn một file reference; `bin/probe-bin` in một nonce; `agents/probe-agent.toml`; `userConfig` có option `probe`; `hooks/hooks.json` SessionStart ghi biến `PLUGIN_*`/`CLAUDE_PLUGIN_*` + `cwd` của payload ra file tạm và trả `additionalContext` có câu đánh dấu. Repo tạm A trống; repo tạm B là bản sao tối thiểu của cafekit: `.claude-plugin/marketplace.json` giống hệt (marketplace `cafekit`, plugin `cf`, nguồn `./plugins/cf` với một cây Claude giả có `hooks/hooks.json` riêng) và `.agents/skills/probe-skill/SKILL.md` trùng tên. Trust theo từng lần chạy/hash, không bật trust toàn cục. In: `FACT exec_in_temp_home=`, `FACT context_in_exec=`, `FACT skill_invocation=`, `FACT skill_nonce_seen=`, `FACT hooks_ran_without_trust=`, `FACT trust_method=`, `FACT hook_env=`, `FACT payload_has_cwd=`, `FACT plugin_bin_on_path=`, `FACT skill_body_substituted=`, `FACT reference_substituted=`, `FACT plugin_agents_loaded=`, `FACT plugin_options=`, `FACT installed_tree=` (cây nào Codex cài khi B có marketplace Claude), `FACT skill_name_collision=`.
- Out: Build plugin thật; sửa `packages/spec/src/`.

## Coverage
- CP-00

## Ownership
- Create: `packages/spec/scripts/codex-plugin-spike.sh`

## Steps
1. Viết script `set -euo pipefail`; `trap` xoá `CODEX_HOME` tạm và repo tạm (backup không cần vì không chạm `~/.codex`) → chạy, đọc FACT, so manifest `~/.codex` trước/sau.
2. Ghi hệ quả vào Receipt theo các nhánh Break signal của D-02, D-03, D-04, D-05, D-06, D-08.

## Acceptance
- AC-00: exit 0, đủ 15 dòng `^FACT [a-z_]+=.+$`, dòng cuối `real ~/.codex unchanged`.

## Dependencies
- none

## Verification Plan
- Command: `bash packages/spec/scripts/codex-plugin-spike.sh`
- Named probe: `codex-plugin-spike.sh` (15 FACT + manifest `~/.codex`).
- Reachability: live — `codex` 0.164.0 đã đăng nhập; vài lượt `codex exec` dưới `CODEX_HOME` tạm; `codex plugin marketplace add` đã quan sát tôn trọng `CODEX_HOME`.
- Oracle: đếm 15 dòng FACT; manifest `~/.codex` trước = sau.
- Counterexample: script ghi vào `~/.codex` thật → manifest khác → exit 1; `codex exec` bỏ qua plugin → thiếu FACT → exit 1.
- Artifacts: ephemeral, xoá qua `trap`; FACT nằm trong Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- Controller review (script-only task, no product code): runs entirely under a temporary `CODEX_HOME` with `auth.json` symlinked, never writes the real `~/.codex` (manifest of `config.toml`, `agents`, `plugins`, `skills` compared before/after), uses per-invocation `--dangerously-bypass-hook-trust` only. First runs failed on script bugs (nested `case` inside `$()`, `ls` glob under `pipefail`), fixed before this Receipt.
- Consequences (Step 2): D-06 break signal fired — `plugin_bin_on_path=no` and `skill_body_substituted=no` → back to GATE-REVIEW before task-01. `plugin_options` none → Codex language/address only from `.codex/runtime.json` or defaults. `installed_tree=not-listed` → Codex CLI does not read the repo's `.claude-plugin/marketplace.json`; D-05 guard keeps only a regression test. `skill_name_collision=both-visible` → D-07 notice required. `plugin_agents_loaded=no` → task-07 as planned. `skill_invocation=$probe-skill` → no plugin namespace on Codex.

## Receipt

Verification: PASS
Command: bash packages/spec/scripts/codex-plugin-spike.sh
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ bash packages/spec/scripts/codex-plugin-spike.sh
FACT exec_in_temp_home=yes
FACT context_in_exec=yes (A1=SPIKE-CODEX-CONTEXT-4K)
FACT skill_invocation=run probe-skill
FACT skill_nonce_seen=yes
FACT hooks_ran_without_trust=no
FACT trust_method=per-invocation --dangerously-bypass-hook-trust
FACT hook_env=CLAUDE_PLUGIN_DATA,CLAUDE_PLUGIN_ROOT,PLUGIN_DATA,PLUGIN_ROOT
FACT payload_has_cwd=yes
FACT plugin_bin_on_path=no (A6=NONE)
FACT skill_body_substituted=no
FACT reference_substituted=no
FACT plugin_agents_loaded=no (A7=NONE)
FACT plugin_options=none exported
FACT installed_tree=not-listed
FACT skill_name_collision=both-visible
real ~/.codex unchanged
EXIT=0
```
