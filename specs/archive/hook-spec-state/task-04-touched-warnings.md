# Task 04 — Claude spec-state chỉ cảnh báo phiên đã chạm packet

Status: done

## Outcome
Trên Claude, phiên không chạm packet nào không còn thấy cảnh báo `Multiple active specs` hay `Invalid workflow packet` của packet khác. Phiên đã chạm packet liên quan vẫn thấy cảnh báo như cũ. Phiên chỉ chạm một packet hợp lệ vẫn thấy tollgate của packet đó, kể cả khi packet khác hỏng. Lỗi cấu hình `<specs>` luôn được báo.

## Scope
- In:
  - D-03 (plan.md): khi `touchFilter` bật và payload không có feature tường minh, nếu resolver trả `multiple_active`/`invalid_specs`:
    - candidates có `'<specs>'` → in như cũ;
    - ít nhất một ứng viên thuộc tập đã chạm (sau khi đã ghi nhận packet nhắc trong prompt hiện tại) → in như cũ;
    - ngược lại resolve riêng từng packet đã chạm theo mẫu Codex (`src/codex/hooks/spec-state.cjs:77-84`) và in tollgate/lỗi của chúng; không chạm packet nào → exit 0 im lặng.
  - Giữ nguyên `explicit_*` và hành vi của omp, grok, payload không có `session_id`.
  - Đồng bộ `../../.claude/hooks/spec-state.cjs` (gốc repo, bị gitignore, không commit) bằng copy.
  - Một dòng changelog ở hai file changelog.
- Out:
  - đổi spec-gate (chặn ở Stop vẫn áp cho mọi phiên; giới hạn đã ghi ở plan);
  - cache tollgate;
  - các mục L khác.

## Coverage
- CP-03

## Ownership
- Modify: `src/claude/hooks/spec-state.cjs`, `src/claude/hooks/__tests__/spec-state-touched.test.js`, `src/claude/hooks/__tests__/spec-gate.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`

## Steps
1. Thêm ca vào `spec-state-touched.test.js`:
   - (a) hai packet active, phiên `s1` gửi `Continue` (chưa chạm packet nào) → stdout rỗng;
   - (b) một packet hỏng (task thiếu `Status:`), phiên `s1` gửi `Continue` → stdout rỗng;
   - (c) như (b) nhưng prompt nhắc `specs/<packet hỏng>` → có `Invalid workflow packet`;
   - (d) payload không có `session_id` với hai packet active → vẫn có `Multiple active specs`;
   - (e) phiên `s1` nhắc `specs/<packet hợp lệ>` trong khi có một packet hỏng chưa chạm → có `Spec state changed`, không có `Invalid workflow packet`;
   - (f) `runtime.json` đặt `paths.specs` thoát khỏi project root, phiên chưa chạm gì → vẫn có `Invalid workflow packet detected: <specs>`.

   Thêm vào `spec-gate.test.js` ca (g): hai packet active, phiên chưa chạm packet nào, Stop → vẫn `decision: block` với `multiple active specs` (xác nhận giới hạn đã ghi).

   Test `a prompt touch is remembered even when two packets are active` phải giữ nguyên và xanh.
   Chạy Command trên code task-03: (a), (b), (e) phải đỏ; (c), (d), (f), (g) xanh. Ghi số ca đỏ.
2. Sửa hook; đồng bộ `../../.claude/hooks/spec-state.cjs` bằng copy; thêm changelog.
3. Chạy Command; chạy self-test như task-01; `cmp` bản `../../.claude` với nguồn.
4. Commit đúng các file trong Ownership.

## Acceptance
- AC-03: (a)–(g) đúng; test cũ không đổi assertion; self-test exit 0.

## Dependencies
- task-03-no-commit-codex.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`
- Named probe: ca (a), (b), (e), (f), (g); test `a prompt touch is remembered even when two packets are active`.
- Reachability: hook chạy từ layout `.claude/hooks` bằng `spawnSync`.
- Oracle: exit 0, `# fail 0`, output có tên các ca.
- Counterexample: trên bản chép tạm, (1) bỏ điều kiện tập chạm trước cảnh báo → ca (a) đỏ; (2) bỏ bước resolve riêng packet đã chạm → ca (e) đỏ. Hoàn tác sau đó.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`
Exit: 0
Base: 53e7f950466816c353ecf59d90377ab73eb22e6e
Head: 2ab66889cda7cc481e400fc77816c4ff41846a94fc96af70196a828b86a9d683

```text
ok 48 - Stop still blocks multiple active specs for an untouched session
ok 82 - a prompt touch is remembered even when two packets are active
ok 83 - an untouched session stays quiet with two active packets
ok 84 - an untouched session stays quiet when a packet is invalid
ok 85 - touching an invalid packet still prints its warning
ok 86 - a session-less prompt still warns about two active packets
ok 87 - a touched valid packet prints its tollgate when another packet is invalid
ok 88 - an invalid specs root still warns an untouched session
# tests 91
# pass 91
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): (a), (b), (e) đỏ; (c), (d), (f), (g) xanh — 88 pass, 3 fail.
- Counterexample (Codex báo): bỏ điều kiện tập chạm → (a) đỏ; bỏ bước resolve riêng packet đã chạm → (e) đỏ; đã hoàn tác.
- Self-test (controller chạy): `PASS: 2062 tests executed`, exit 0; `cmp .claude/hooks/spec-state.cjs` với nguồn khớp; `git diff --check` sạch.
- Review controller: nhánh mới chỉ chạy khi `touchFilter`, không có feature/path tường minh và lỗi là `multiple_active`/`invalid_specs`; `'<specs>'` và ứng viên đã chạm giữ đường cũ; resolve riêng theo mẫu Codex. Lưu ý Low (không chặn, giống Codex): nếu packet đã chạm bị xoá/chuyển đi trong khi packet khác gây `multiple_active`/`invalid_specs`, phiên đó thấy `Explicit spec target invalid (explicit_not_found)`. Commit 53e7f950.
