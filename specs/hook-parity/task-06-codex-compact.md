# Task 06 — Codex compact

Status: pending

## Outcome
Sau compact, Codex nhắc rằng xác nhận đang chờ có thể đã mất, prompt kế tiếp nhận lại rules, và anchor được in nếu host gọi PreCompact.

## Scope
- In:
  - Probe (Step 1, D-06), làm trong scratchpad, không sửa `~/.codex`:
    - `CODEX_HOME` tạm như `evals/codex/run.mjs:176-189`: chép `auth.json` (Bro cho phép; không in nội dung, xoá cả thư mục sau probe), `config.toml` đánh dấu project tạm `trust_level="trusted"`.
    - Project tạm có `.codex/hooks.json` đăng ký SessionStart, UserPromptSubmit, PreCompact, PostCompact; mỗi hook ghi payload (chỉ khoá `hook_event_name`, `source`, `trigger`, `session_id`) vào một file.
    - Ép compact bằng `codex exec -C <room> --json -c model_auto_compact_token_limit=<nhỏ>` với prompt đọc một file lớn; nếu không được thì thử app-server `thread/compact/start`.
    - Đối chứng dương: không có dấu SessionStart `startup` → probe hỏng → task `blocked`, không kết luận "host không gọi". Có `startup` mà không có PreCompact sau compact → "host không gọi".
    - Ghi: PreCompact có gọi không; `session_id` của UserPromptSubmit và SessionStart `compact` có trùng không.
  - `src/codex/hooks/session.cjs` khi `source=compact`, đặt trước `getHookContext` (`:75`) và dùng `readRuntime` + `resolveSessionCwd`: gọi `clearState(PROJECT_ROOT, sessionId)` (hiện ở `:91`, sau `getHookContext`); luôn in nhắc xác nhận đang chờ (cùng ý với phần compact của `src/claude/hooks/session.cjs`); xoá chỗ giữ rules của chính phiên qua `src/codex/hooks/lib/rules-reservation.cjs` (chuyển `reservationFile`/`reserveSession` từ `src/codex/hooks/rules.cjs:15-37`).
  - Host gọi PreCompact → thêm `src/codex/hooks/precompact.cjs` ghi anchor (branch, HEAD, số path chưa commit; git `timeout: 3000`) vào file tên sha256 của phiên dưới `hookStateDir`; đăng ký trong `src/codex/hooks.json` và installer nếu installer liệt kê sự kiện; SessionStart compact in anchor khi `session_id` khớp. Host không gọi → không thêm, không đăng ký.
  - Changelog.
- Out: thông báo cập nhật (task-07).

## Coverage
- CP-06

## Ownership
- Modify: `src/codex/hooks/session.cjs`, `src/codex/hooks/rules.cjs`, `src/codex/hooks/lib/rules-reservation.cjs` (mới), `bin/__tests__/codex-hooks.test.js`, `bin/__tests__/orca-session.test.js` (chỉ fixture), hai changelog
- Chỉ khi probe thấy host gọi: `src/codex/hooks/precompact.cjs` (mới), `src/codex/hooks.json`, `bin/phases/codex-hooks.js`, `bin/__tests__/codex-hooks-ownership.test.js`
- Controller ghi kết quả probe vào Known limitations của plan.md.

## Steps
1. Probe như Scope; báo kết quả cho controller.
2. Thêm test vào `codex-hooks.test.js`:
   - SessionStart `compact` → có nhắc xác nhận đang chờ; cũng đúng khi `paths.specs: "../outside"`;
   - có một yêu cầu privacy đang chờ, `paths.specs: "../outside"`, SessionStart `compact` → không còn yêu cầu đang chờ (hiện còn 1);
   - rules phiên S tiêm, compact phiên S, rules tiêm lại; phiên T vẫn im;
   - (chỉ khi có precompact) precompact phiên S rồi SessionStart compact phiên S → có anchor; phiên T → không.
   Chạy Command trước khi sửa; ghi số ca đỏ.
3. Sửa; changelog.
4. Chạy Command; `node --test packages/spec/bin/__tests__/orca-session.test.js packages/spec/bin/__tests__/codex-quiet-hooks.test.js packages/spec/bin/__tests__/codex-hooks-ownership.test.js`; self-test.
5. Không commit.

## Acceptance
- AC-06: các ca trên đúng; self-test exit 0; kết quả probe (có đối chứng dương) ghi trong Receipt.

## Dependencies
- task-05-codex-gate-robust.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên mô tả hành vi.
- Reachability: hook chạy bằng `spawnSync` trên layout `.codex`; probe host cho PreCompact.
- Oracle: exit 0, `# fail 0`.
- Counterexample: đặt nhánh compact sau `getHookContext` → ca `paths.specs` sai đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
