# Task 00 — Spike: quan sát 4 sự thật host trước khi build

Status: done

## Outcome
Một script chạy Claude Code thật với một plugin dùng một lần và in ra 7 dòng `FACT`, để D-03, D-04, D-06 và cách gọi agent dựa trên quan sát thay vì suy đoán.

## Scope
- In: script dựng plugin tạm trong `mktemp -d` gồm: một skill có file reference chứa chuỗi `${CLAUDE_PLUGIN_ROOT}/marker.txt`; một agent `probe-agent.md` có cùng chuỗi trong thân; hook SessionStart ghi `env` (chỉ các biến `CLAUDE_PLUGIN_*`, `CLAUDE_PROJECT_DIR`) ra file trong thư mục tạm và trả `additionalContext` chứa câu đánh dấu; `userConfig.probe` mặc định `x`. Chạy `claude -p --plugin-dir <tmp-plugin> --output-format json` trong một repo git tạm, yêu cầu model: (1) nhắc lại câu đánh dấu; (2) chạy `echo "$CLAUDE_PLUGIN_ROOT"` bằng Bash; (3) đọc file reference qua skill và báo chuỗi đường dẫn đã được thay chưa; (4) liệt kê tên agent khả dụng có chữ `probe`. In: `FACT context_in_print_mode=`, `FACT bash_has_plugin_root=`, `FACT reference_substituted=`, `FACT agent_name=`, kèm `FACT hook_env_plugin_data=` và `FACT hook_env_option=` từ file env. Chạy lượt thứ hai với `--settings` chứa `pluginConfigs` đặt `probe=y` cho plugin tạm, in `FACT option_settable=<yes|no>` theo việc hook thấy `CLAUDE_PLUGIN_OPTION_PROBE=y`.
- Out: build plugin thật; bất kỳ thay đổi nào trong `packages/spec/src/`.

## Coverage
- CP-00

## Ownership
- Create: `packages/spec/scripts/plugin-spike.sh`

## Steps
1. Viết script với `set -euo pipefail` và `trap` xoá thư mục tạm → chạy, đọc 7 dòng `FACT`.
2. Nếu `reference_substituted=no` và `bash_has_plugin_root=no` → ghi vào Receipt và dừng các task sau, quay lại GATE-REVIEW (D-06). Nếu `hook_env_plugin_data` rỗng → D-04 dùng nhánh tmpdir. Nếu `agent_name` có tiền tố `cf:`-kiểu → task-01 đổi tên gọi agent trong Markdown.

## Acceptance
- AC-00: script exit 0, in đủ 7 dòng `FACT` mỗi dòng có giá trị `yes`, `no` hoặc chuỗi quan sát được (không rỗng).

## Dependencies
- none

## Verification Plan
- Command: `bash packages/spec/scripts/plugin-spike.sh`
- Named probe: `plugin-spike.sh` (7 dòng FACT).
- Reachability: live — `claude` 2.1.305 đã đăng nhập trên máy; hai lượt `-p` (chi phí nhỏ).
- Oracle: đếm đúng 7 dòng `^FACT [a-z_]+=.+$`; exit 0.
- Counterexample: model không chạy được lệnh hay host bỏ qua `--plugin-dir` → thiếu dòng FACT → exit 1.
- Artifacts: ephemeral; thư mục tạm xoá qua `trap`; 7 dòng FACT nằm trong Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- Final-Head fixed point (2026-10-21): proof rerun on the final tree with Head identical before and after all seven runs; this Receipt replaces the earlier one. Output keeps every command line except blank lines and the validator's multi-line advice text (icon, repository-root and README install hints).

## Receipt

Verification: PASS
Command: bash packages/spec/scripts/plugin-spike.sh
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ bash packages/spec/scripts/plugin-spike.sh
--- model answers (turn 1) ---
A1: SPIKE-CONTEXT-7Q2
A2: []
A3: /var/folders/wz/32lzd87s1ws6f9zrl51fg5zw0000gn/T/cafekit-plugin-spike.j0xMGr/plugin/skills/probe-skill/ref.md
A4: REF_LINE: ${CLAUDE_PLUGIN_ROOT}/marker.txt
A5: probe-cf:probe-agent
---
FACT context_in_print_mode=yes
FACT bash_has_plugin_root=no (A2=[])
FACT reference_substituted=skill_body:yes reference_file:no
FACT agent_name=probe-cf:probe-agent
FACT hook_env_plugin_data=/Users/nghialuutrung/.claude/plugins/data/probe-cf-inline
FACT hook_env_option=absent
FACT option_settable=yes
EXIT=0
```
