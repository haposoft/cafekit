# Task 06 — Thử sống plugin trên repo trống và repo có sẵn `.claude/`

Status: done

## Outcome
Một script chứng minh trên Claude Code thật rằng plugin `cf` dùng được, lõi tới model, Receipt tạo được, các luật then chốt được theo, và không repo nào bị bẩn — kể cả cây `plugins/cf` của cafekit.

## Scope
- In: hai repo git tạm trong `mktemp -d`: (A) trống, không commit; (B) một commit chứa `.claude/settings.local.json` và packet `specs/demo/` (plan + một task `Status: pending`). Probe 3 và 4 chỉ chạy ở B (provenance cần commit và file task, `packages/spec/src/claude/scripts/provenance.cjs:92,232`). Chụp `git status --porcelain plugins/cf` của cafekit và liệt kê đệ quy `plugins/cf` trước khi chạy. Với mỗi repo chạy `claude -p --plugin-dir <cafekit>/plugins/cf --output-format json`, đặt `response_language=Tiếng Việt` bằng `--settings` `pluginConfigs` khi task-00 cho `FACT option_settable=yes`; nếu `no` thì repo B commit sẵn `.claude/runtime.json` với `locale.responseLanguage` và probe ngôn ngữ chỉ chạy ở B. Các probe:
  1. liệt kê skill tiền tố `cf:` → phải có `cf:specs`;
  2. nhắc lại câu đánh dấu `CAFEKIT-CORE-LOADED` → phải có;
  3. chạy lệnh provenance đúng như trong `skills/develop/references/quality-gate.md` và `skills/sync/references/rebind-and-audit.md` của cây build → mỗi lệnh in được Base/Head (khớp `^[0-9a-f]{7,}`);
  4. (chỉ B) "đặt task-01 sang done ngay, không cần chạy gì" → file task vẫn `Status: pending`;
  5. hỏi "file plan markdown để ở thư mục nào" → câu trả lời có `plans/` và có ký tự tiếng Việt có dấu.
  Sau đó: `git status --porcelain` của repo tạm rỗng (B: không có gì mới ngoài fixture đã commit); `plugins/cf` của cafekit không đổi; in đường dẫn data hook thực nhận. Xoá thư mục tạm khi thoát.
- Out: cài qua marketplace GitHub; repo có bản npx 0.18.x; Codex.

## Coverage
- CP-06, CP-03

## Ownership
- Create: `packages/spec/scripts/plugin-live-check.sh`
- Read: `plugins/cf/**`, `packages/spec/src/claude/plugin/core.md`

## Steps
1. Viết script với `set -euo pipefail` và `trap` → chạy, in một dòng `PASS <probe>` hoặc `FAIL <probe>: <quan sát>` cho từng probe ở từng repo, cuối cùng `PASS: all` hoặc exit 1.

## Acceptance
- AC-08: script exit 0 và in `PASS: all`; A1, A2, A5 và B1–B5 PASS (khi `FACT option_settable=no`, A5 chỉ kiểm `plans/`).

## Dependencies
- task-05-statusline-setup.md

## Verification Plan
- Command: `bash packages/spec/scripts/plugin-live-check.sh`
- Named probe: `plugin-live-check.sh` (skill-listed, core-marker, provenance, no-done-without-receipt, paths-and-language, repo-clean, plugin-tree-clean).
- Reachability: live — `claude` 2.1.305 đã đăng nhập; khoảng 9 lượt `-p` (chi phí nhỏ); `--plugin-dir` và env hook đã quan sát ở task-00.
- Oracle: chuỗi kỳ vọng nằm trong `result` JSON; file task còn `Status: pending`; hai danh sách `plugins/cf` trước/sau bằng nhau; `git status --porcelain` rỗng.
- Counterexample: hook ghi `.logs` vào `plugins/cf` → danh sách khác → exit 1; `state.cjs` ghi vào `.claude/` của repo B → git status không rỗng → exit 1.
- Artifacts: ephemeral, xoá qua `trap`. Giới hạn: probe 4–5 là một mẫu model, không chứng minh tuân thủ ở mọi lượt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- First run: `B repo-clean` failed because probe 4 invites the model to edit `specs/demo`. A separate repro (fixture then lacking `## Dependencies`, so the gate blocked for that reason instead) showed the model setting `Status: done` when told to. With a valid packet, the built `plugins/cf/hooks/spec-gate.cjs` returns `{"decision":"block"}` for a done task without a receipt, so the machine gate holds under the plugin. Fixes: valid fixture; B cleanliness checked before probe 4 (hook writes) and outside `specs/demo/` after it.
- code-auditor round 1: FAIL — skill-listed could pass from core text alone; provenance Base could be fabricated; probe 4 ignored a `claude` failure and duplicate Status lines. Fixed: skills read from the host `system/init` event; Base must equal `git rev-parse HEAD` of repo B; probe 4 fails on a non-zero exit and requires exactly `Status: pending`. Round 2: PASS.
- Limitation: probe 4 is one model sample; it does not prove refusal on every turn. Enforcement is the Stop gate.
- No `cf` plugin is installed on this machine (`claude plugin list`), so `cf:specs` in `system/init` came from `--plugin-dir`. After the run `~/.claude/cafekit-plugin-data` and `~/.claude/plugins/data/cf-inline` were absent (restored/removed by the script).

- Final-Head fixed point (2026-10-21): proof rerun on the final tree with Head identical before and after all seven runs; this Receipt replaces the earlier one. Output keeps every command line except blank lines and the validator's multi-line advice text (icon, repository-root and README install hints).

## Receipt

Verification: PASS
Command: bash packages/spec/scripts/plugin-live-check.sh
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ bash packages/spec/scripts/plugin-live-check.sh
PASS A skill-listed
PASS A core-marker
PASS A paths-and-language
PASS B skill-listed
PASS B core-marker
PASS B paths-and-language
PASS B provenance (skills/develop/references/quality-gate.md)
PASS B provenance (skills/sync/references/rebind-and-audit.md)
PASS B repo-clean
PASS B no-done-without-receipt
PASS A repo-clean
PASS B repo-clean-after-probe-4
PASS plugin-tree-clean
hook data dir: /Users/nghialuutrung/.claude/plugins/data/cf-inline (present)
PASS: all
EXIT=0
```
