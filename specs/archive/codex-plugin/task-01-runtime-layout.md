# Task 01 — Một danh sách layout runtime Codex dùng chung

Status: done

## Outcome
`packages/spec/bin/phases/codex-runtime.js` export một danh sách layout `[nguồn, đích, transform]` (hook, lib thật thay shim, rules ghép, output styles, `runtime.schema.json`) mà installer Codex dùng; build plugin ở task-03 đọc đúng danh sách này.

## Scope
- In: Tách logic bố cục đang nằm rải ở `codex-runtime.js:65-131,166-168` thành hàm export trả về danh sách layout (không ghi file); installer gọi hàm đó rồi ghi như cũ.
- Out: Đổi hành vi installer; sửa nội dung hook.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/bin/phases/codex-runtime.js`
- Create: `packages/spec/bin/__tests__/codex-runtime-layout.test.js`

## Steps
1. Viết test: danh sách layout có mọi shim lib được thay bằng file thật (7 file `require('../../../claude/hooks/lib/…')` trong `packages/spec/src/codex/hooks/lib/`), rules = rules Claude trừ override + `src/codex/rules/*`, output styles, schema; mỗi nguồn tồn tại.
2. Refactor installer dùng hàm export; chạy toàn bộ test installer.

## Acceptance
- AC-01: test layout xanh; toàn bộ `packages/spec/bin/__tests__/*.test.js` không có test đỏ mới.

## Dependencies
- task-00-host-spike.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/*.test.js`
- Named probe: `codex-runtime-layout.test.js` (shims-resolved, rules-composed, styles-and-schema, sources-exist) + test installer Codex hiện có.
- Reachability: source — node.
- Oracle: test pass, exit 0.
- Counterexample: installer bỏ sót một shim sau refactor → `codex-native`/`installer-safety` đỏ.
- Artifacts: không có.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Review notes
- Equivalence check (controller): HEAD vs refactored installer, `--platform codex -y` into two empty repos: runtime files identical, `.codex/hooks.json` identical after masking the project path, installer report lines identical, manifest keys equal (270).
- code-auditor round 1: PASS_WITH_WARNINGS — Medium: non-file entries in `hooks/lib` skipped silently (now thrown); Lows: non-shim libs untested, group names hard-coded per call, schema `missing` hidden, layout computed twice — all fixed (`LAYOUT_GROUPS`, `groups-installed`, per-file schema report). Round 2: PASS; its Low (validate before the first write) fixed. Open: `copyRulesDirectory` `excludedNames` in `packages/spec/bin/phases/claude-runtime.js` has no caller now (outside this task's ownership).
- Receipt output keeps this task's six named probes and the run summary; the other 1318 passing lines of the same run are abridged.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/*.test.js
Exit: 0
Base: 25c114615ec45a172ebc4a3cc4ff4be0c4901e57
Head: 51d9b7b9121074a11e239490a629f883f8a79ebd168a7f6f846f94e6edd067c1
```text
$ node --test packages/spec/bin/__tests__/*.test.js
ℹ Codex git status calls: 2
✔ shims-resolved: every shim lib ships as the real Claude library, never as the shim (61.86925ms)
✔ hooks-copied: every non-shim Codex hook file ships from the Codex source (5.113375ms)
✔ groups-installed: every layout group is one the installer writes (5.764ms)
✔ rules-composed: Claude rules minus Codex overrides, plus Codex rules, with the right transform (8.157125ms)
✔ styles-and-schema: output styles carry the Codex transform and the schema ships once (3.547292ms)
✔ sources-exist: every layout source is a regular file and every destination is unique and relative (6.27525ms)
ℹ tests 1518
ℹ suites 0
ℹ pass 1518
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 316506.765458
EXIT=0
```
