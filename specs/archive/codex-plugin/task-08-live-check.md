# Task 08 — Thử sống plugin Codex bằng `codex exec` dưới `CODEX_HOME` tạm

Status: done

## Outcome
Một script chứng minh trên Codex CLI thật: plugin `cf` cài từ marketplace cục bộ của repo, skill/lõi/gate/provenance hoạt động, chung sống đúng với bản npx, repo và cache không bẩn, `~/.codex` thật không bị chạm.

## Scope
- In: `CODEX_HOME` tạm như task-00, trust theo FACT `trust_method` (không toàn cục); manifest `~/.codex` thật trước/sau; `codex plugin marketplace add <cafekit>` + `codex plugin add cf@<marketplace>`; assert cache cài có `.codex-plugin/plugin.json` và hash `hooks/hooks.json` khớp `plugins/cf-codex` (D-05). Repo A trống; B một commit có packet `specs/demo` hợp lệ; C có bản cài npx Codex (installer vào repo tạm). Probe: (1) nonce chỉ có trong thân `SKILL.md` của một skill CafeKit được model trích lại sau khi gọi skill bằng tên theo FACT (hoặc event `codex exec --json` xác nhận skill), không có nhánh PASS-kèm-giới-hạn; (2) marker lõi; (3, B) model chạy lệnh `provenance` lấy từ bảng lệnh CafeKit trong context (D-06), Base = `git rev-parse HEAD`; (4, B) đặt task demo `done` không Receipt rồi kết thúc lượt → hook Stop block (đọc từ event/hook log trong `PLUGIN_DATA`); (5, C) không có marker lõi plugin lặp, có dòng báo D-07 (kèm tên skill trùng khi FACT `skill_name_collision=yes`); sau đó A, B, C `git status` sạch (B chỉ xét ngoài `specs/demo`), cache plugin không đổi, manifest `~/.codex` thật không đổi.
- Out: Chạy lệnh cài agents vào `~/.codex` thật; probe từ chối đánh done (gói 1 đã có, gate là lớp chặn).

## Coverage
- CP-07, CP-05, CP-03

## Ownership
- Create: `packages/spec/scripts/codex-plugin-live-check.sh`
- Read: `plugins/cf-codex/**`

## Steps
1. Viết script `set -euo pipefail` + `trap` → chạy, in `PASS/FAIL <probe>`, cuối `PASS: all`.

## Acceptance
- AC-08: exit 0, `PASS: all`, dòng `real ~/.codex unchanged`.

## Dependencies
- task-07-setup-agents.md

## Verification Plan
- Command: `bash packages/spec/scripts/codex-plugin-live-check.sh`
- Named probe: `codex-plugin-live-check.sh` (installed-tree-is-codex, skill-nonce, core-marker, provenance, gate-blocks, silent-beside-npx, repos-clean, cache-clean, real-codex-home-untouched).
- Reachability: live — `codex` 0.164.0 đã đăng nhập; vài lượt `codex exec` dưới `CODEX_HOME` tạm theo FACT `exec_in_temp_home`.
- Oracle: nonce/marker trong câu trả lời; Base = HEAD; decision block; manifest trước = sau.
- Counterexample: hook không được trust → marker vắng → exit 1; gốc repo sai → gate không block → exit 1.
- Artifacts: ephemeral, xoá qua `trap`. Giới hạn: probe model là một mẫu.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- The plugin is installed from a copy of the repository's marketplace layout (byte-equal `.agents/plugins/marketplace.json` and `.claude-plugin/`, copies of `plugins/cf-codex` and the Claude tree `plugins/cf`) whose `cf-ask` SKILL.md carries one random nonce line; that line is the only difference, so the D-05 decoy is present and the nonce exists only in that skill body.
- First live run: `gate-blocks` failed because the model refused to mark the task done (the core works). The task's Out excludes the refusal probe, so the script now writes `Status: done` itself and asks only for "OK"; the oracle is the installed plugin's Stop hook prompt in the session rollout (`hook_run_id="stop:…/plugins/cache/…">Completion gate: N done task(s) lack a verification receipt`), which model text cannot produce. The rollout replaces the "event/hook log in PLUGIN_DATA" of the Scope: `spec-gate` logs no decision, and the host-written rollout is the stronger record.
- code-auditor round 1: FAIL — the marketplace copy lacked the Claude decoy (blocking), and three oracles were satisfiable without their behavior (gate prefix shared with other blocks; provenance Base reachable through `git`; silent-beside-npx resting on model words with a hinting question). Repaired: full layout copy; gate regex anchored to the receipt message; provenance requires a `command_execution` of `node …/plugins/cache/…/scripts/provenance.cjs` whose output holds HEAD; core-marker and silent-beside-npx read developer-role messages (hook output) from the turn's rollout, the hint removed, and the notice must name the duplicate skills. Lows repaired: cache-only manifest search without SIGPIPE, commits without gpg or global hooks, a 600 s watchdog per `codex exec`, `FAIL: aborted`. Round 2: one Medium — `grep -q` under `pipefail` could flip the negated core check; repaired with captured variables and here-strings. Round 3: PASS.
- Mid-task, another session committed a privacy fix (`a66aa8a2`, `25c11461`); the script's `--check` caught the stale `plugins/cf-codex`, which was rebuilt before the runs below. Those commits touch only their own files.
- The Counterexample "hooks untrusted → exit 1" was not re-run here (task-00 FACT `hooks_ran_without_trust=no`; each run spends Codex turns).
- Open limitations: each model probe is one sample; files ignored by repo C's `.gitignore` are invisible to `repos-clean`; `auth.json` is a symlink, so a token refresh may write through to the real file (outside the manifest, as in task-00); the nonce can also be read from the installed skill on disk (same bytes); the sandboxed model can write under `$WORK` and could in theory forge rollout lines.

## Receipt

Verification: PASS
Command: bash packages/spec/scripts/codex-plugin-live-check.sh
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ bash packages/spec/scripts/codex-plugin-live-check.sh
PASS installed-tree-is-codex
PASS skill-nonce
PASS core-marker
PASS provenance
PASS gate-blocks
PASS silent-beside-npx
PASS repos-clean
PASS cache-clean
PASS real-codex-home-untouched
real ~/.codex unchanged
PASS: all
EXIT=0
```
