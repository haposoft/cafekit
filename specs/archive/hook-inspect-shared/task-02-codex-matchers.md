# Task 02 — Matcher Codex theo tên tool thật + cập nhật khi nâng cấp

Status: done

## Outcome
Matcher trong `src/codex/hooks.json` chỉ còn ba loại tên:
- tên tool mà hook Codex thật sự nhận;
- `mcp__.*`;
- alias `exec_command`/`shell`, giữ lại cho Codex bản cũ.

Khi chạy lại installer trên bản cài cũ, matcher template cũ của nhóm do CafeKit quản lý được cập nhật. Matcher do người dùng tự đặt giữ nguyên.

## Scope
- In:
  - **Lượt dò** (D-06 của `plan.md`), tối đa 3 lượt Codex:
    - Phòng tạm có `.codex/hooks.json`, chỉ đăng ký một hook ghi `{event, tool_name}` vào một file **trong phòng**, với matcher `*` cho PreToolUse và PostToolUse. Sau mỗi lượt, chép file đó ra `~/Desktop/cafekit-codex-eval/hook-tool-names/`.
    - CODEX_HOME sạch như `evals/codex/run.mjs`, không đụng `~/.codex`. Bật các cờ `--enable multi_agent` (`run.mjs:91`), `-c projects.<room>.trust_level="trusted"` (:92) và `--dangerously-bypass-hook-trust`.
    - Prompt buộc Codex làm đủ: chạy `ls`, đọc một file, sửa một file, gọi `update_plan`, và `spawn_agent` một subagent đọc 1 file.
    - Ghi kết quả vào `evals/codex/report-hook-tool-names.md`: CLI version, danh sách `tool_name` theo event, và tool nào không thấy.
  - **`src/codex/hooks.json`**:
    - PreToolUse privacy/inspect → `Bash|exec_command|shell|apply_patch|mcp__.*`, cộng tên khác quan sát được trong lượt dò.
    - ask-guard giữ `apply_patch`.
    - PostToolUse state → tên đã quan sát cho subagent và plan.
    - PostToolUse spec-state → `apply_patch`, cộng alias nếu lượt dò thấy.
    - Bỏ `Read`, `Glob`, `Grep`, `MultiEdit`, `TodoWrite`, `task`, `Task` nếu lượt dò không thấy. Giữ `exec_command`, `shell`.
  - **`bin/phases/codex-hooks.js`** (D-07 của `plan.md`):
    - Chạy sau `pruneObsoleteCodexHooks` và `repairLegacyCodexLaunchers`.
    - Chỉ đổi matcher khi nhóm toàn handler CafeKit **và** matcher hiện tại thuộc tập matcher template cũ đã biết. Tập này viết thành hằng trong code, lấy từ `git log -p -- packages/spec/src/codex/hooks.json`.
    - Khi đổi: in `↻ … matcher updated`, không in "already registered" cho nhóm đó.
    - Mọi trường hợp khác: giữ nguyên và in cảnh báo.
    - `--dry-run` chỉ in, không ghi.
  - **Test** trong `bin/__tests__/codex-hooks.test.js`:
    - (a) bản cài cũ có matcher template cũ `Bash|exec_command|apply_patch|Edit|Write|Read|Glob|Grep|mcp__.*|shell` được đổi sang matcher mới; kiểm cả dòng in;
    - (b) nhóm có thêm handler của người dùng: giữ nguyên matcher và có cảnh báo;
    - (c) cài mới ra đúng matcher template;
    - (d) nhóm toàn CafeKit mà người dùng tự đặt matcher `Read|Grep` (như `codex-hooks-ownership.test.js:153-178`): giữ nguyên;
    - (e) bản cũ còn `task-scaffold-guard` trong nhóm: sau bước dọn, matcher được đổi.
  - `packages/spec/CHANGELOG.md` và `docs/project-changelog.md`, mục `[Unreleased]`: mỗi file một dòng Changed.
- Out: matcher và installer Claude (gói 2); privacy-block.

## Coverage
- CP-02

## Ownership
- Create: `evals/codex/report-hook-tool-names.md`
- Modify: `packages/spec/src/codex/hooks.json`, `packages/spec/bin/phases/codex-hooks.js`, `packages/spec/bin/__tests__/codex-hooks.test.js`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `evals/codex/run.mjs`, `evals/codex/room.mjs`, `packages/spec/bin/__tests__/codex-hooks-ownership.test.js`

## Steps
1. Chạy Command trước khi sửa để lấy số gốc (pass là bình thường vì test (a)–(e) chưa có). Viết test (a)–(e) rồi chạy Command trên code cũ: (a) và (e) phải đỏ; nếu không đỏ thì dừng và báo.
2. Chạy lượt dò. Nếu không thấy `spawn_agent` hoặc `update_plan`, giữ tên theo tài liệu và ghi `[UNVERIFIED]` trong báo cáo.
3. Sửa `hooks.json` theo kết quả dò; sửa phần merge; viết test.
4. Chạy Command, rồi `pnpm test` ở gốc repo. Cài thử bằng installer thật:
   - tạo thư mục tạm, chạy `git init` trong đó;
   - từ thư mục tạm, chạy `node <repo>/packages/spec/bin/install.js --platform codex -y`. Installer không có `--cwd`, nên chạy từ repo sẽ cài đè lên repo;
   - đọc `hooks.json` sinh ra.
5. Commit đúng file Ownership. Không ghi tên AI, không push.

## Acceptance
- AC-02:
  - báo cáo dò có danh sách `tool_name` thật;
  - matcher mới chỉ gồm tên đó, `mcp__.*` và alias `exec_command`/`shell`;
  - 5 test merge (a)–(e) xanh;
  - `codex-hooks-ownership` và `codex-native-hook-boundaries` xanh;
  - `pnpm test` exit 0;
  - `hooks.json` sinh ra khi cài thử khớp template.

## Dependencies
- task-01-inspect-shared-lib.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-hooks-ownership.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js`
- Named probe: test (a) đổi matcher cũ sang mới; test (b) và (d) giữ nguyên nhóm của người dùng.
- Reachability: lượt dò chạy Codex thật trên CLI đang cài; cài thử bằng installer thật vào thư mục tạm.
- Oracle: exit 0, `# fail 0`, số test > 0.
- Counterexample: tắt tạm nhánh cập nhật matcher thì test (a) phải đỏ; sau đó hoàn tác.
- Artifacts: `evals/codex/report-hook-tool-names.md` (commit). Log dò để ngoài repo, ở `~/Desktop/cafekit-codex-eval/hook-tool-names/`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-hooks-ownership.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js
Exit: 0
Base: 281e50db47ca4789f75c7c99f80e4611ec04fac3
Head: d11a558680679f7f3616f8232f778d961ccae08c4e88a3d51b3f15a193cc3ad6
```text
ok 13 - upgrade refreshes a former managed inspection matcher and reports it
ok 14 - upgrade preserves a mixed user group and warns
ok 16 - fresh hook registration uses every template matcher
ok 17 - upgrade preserves a user-selected managed matcher and warns
ok 18 - upgrade refreshes the surviving group after retired hooks are pruned
# tests 63
# pass 63
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Bằng chứng kèm (12/10, Head 281e50db): lượt dò Codex 0.162.1 (1 lượt, log ~/Desktop/cafekit-codex-eval/hook-tool-names/1/) thấy `Bash`, `apply_patch`, `collaborationspawn_agent`, `collaborationwait_agent` (phiên Claude đọc lại trace gốc xác nhận); `update_plan`/`Agent`/`spawn_agent` giữ dự phòng [UNVERIFIED]; báo cáo `evals/codex/report-hook-tool-names.md`. `pnpm test` exit 0 (618+199+42 pass, skill-test 1645). Cài thử installer thật từ thư mục tạm có git: exit 0, matcher mọi event khớp template, lib inspect cài vào Codex là bản thật (cmp với nguồn); nâng cấp thử: matcher cũ → in `↻ Codex hooks: PreToolUse matcher updated`, nhóm `my-linter` của người dùng giữ nguyên không cảnh báo. Phản ví dụ trên bản chép tạm: tắt nhánh đổi matcher → 2 test đỏ (cập nhật matcher cũ, nhóm còn lại sau dọn). Hook privacy/inspect Codex với payload spawn/wait: exit 0, không crash. Review code-auditor: 0 Critical/High, 1 Medium (cảnh báo nhóm thuần người dùng) đã sửa ở 281e50db; Low để GATE-DONE. Step 1 đã sửa như task 01 (lần đỏ trước sửa: 4 test).
