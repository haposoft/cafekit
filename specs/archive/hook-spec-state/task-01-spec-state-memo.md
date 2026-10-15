# Task 01 — spec-state chụp worktree một lần mỗi prompt trên hai host

Status: done

## Outcome
Mỗi prompt, spec-state Claude và Codex chỉ chụp worktree một lần, dù packet có bao nhiêu task done. Nội dung tollgate in ra không đổi.

## Scope
- In:
  - D-01 (plan.md): gọi `enableSnapshotMemo()` của `provenance.cjs` mà policy đã nạp, ngay sau khi nạp policy.
    - Claude: dùng thư mục `scripts` của chính hook, như `src/claude/hooks/spec-gate.cjs:96`.
    - Codex: `path.dirname(loaded.path)`, như `src/codex/hooks/spec-gate.cjs:45`.
  - Đồng bộ `../../.claude/hooks/spec-state.cjs` (gốc repo, bị gitignore, không commit) bằng copy.
  - Một dòng changelog ở hai file changelog.
- Out: đổi `provenance.cjs`, `spec-receipt.cjs`; cache tollgate.

## Coverage
- CP-01

## Ownership
- Modify: `src/claude/hooks/spec-state.cjs`, `src/codex/hooks/spec-state.cjs`, `src/claude/hooks/__tests__/spec-state-touched.test.js`, `bin/__tests__/codex-hooks.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`
- Read: `src/claude/scripts/provenance.cjs:236-251`, `src/claude/scripts/spec-receipt.cjs:297-311`, `src/codex/hooks/lib/spec-receipt.cjs:6-33`

## Steps
1. Thêm một test cho mỗi host:
   - Claude: thêm vào `spec-state-touched.test.js`.
   - Codex: thêm vào `codex-hooks.test.js`, dùng layout `.codex` đã cài như các test spec-state Codex hiện có (`:386-455`).
   - Mỗi test làm như sau:
     - Dựng repo git có một commit, kèm packet 3 task: 2 task `done` có Receipt thật (lấy Base/Head bằng `provenance.cjs` của fixture), 1 task `in_progress`.
     - Viết một file preload tạm, đặt **ngoài** worktree, bọc `child_process.spawnSync`/`execFileSync` để đếm lệnh `git` có đối số `status`. Ghi kết quả đếm vào một file cũng **ngoài** worktree; nếu ghi trong worktree thì snapshot thứ hai thấy worktree đổi và báo `worktree_race`.
     - Chạy hook với `NODE_OPTIONS=--require <preload>` và một prompt chạm packet.
   - Assert: hook exit 0; stdout có `Spec state changed`; số lần `git status` ≤ 2.
   - Chạy Command trên code hiện tại: hai test phải đỏ. Số đo hiện tại là 14–20 tuỳ số task có heading `## Receipt`. Ghi số ca đỏ.
2. Sửa hai hook; đồng bộ `.claude/hooks/spec-state.cjs` bằng copy; thêm changelog.
3. Chạy Command; chạy `node scripts/run-skill-self-tests.mjs` trong `packages/spec`, vì M2 chưa cài pnpm. Nếu có pnpm thì `pnpm test` ở gốc repo cũng dùng được. `cmp` bản `../../.claude` với nguồn.
4. Commit đúng các file trong Ownership: không tên AI, không mã plan, không push.

## Acceptance
- AC-01: hai test mới xanh; các test cũ trong hai file không đổi assertion; self-test exit 0.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js packages/spec/bin/__tests__/codex-hooks.test.js`
- Named probe: hai test mới, có chữ `one snapshot` trong tên.
- Reachability: hook chạy bằng `spawnSync(process.execPath, [hook])` từ layout `.claude/hooks` và `.codex/hooks`; script nạp từ `scripts` cạnh hook.
- Oracle: exit 0, `# fail 0`, output có tên hai test mới.
- Counterexample: trên bản chép tạm, bỏ lệnh `enableSnapshotMemo()` → hai test đỏ; hoàn tác sau đó.
- Artifacts: không; preload và file đếm nằm trong thư mục tạm của test và được xoá trong `finally`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js packages/spec/bin/__tests__/codex-hooks.test.js`
Exit: 0
Base: 836df552eac479a5775aba39b8434f8c3b81bdb8
Head: 7c5b907d4decfc34cd8bf7e011616ee8cbdcad51be066b2998a33b8d8ec9edd8

```text
ok 11 - Codex installed spec-state uses one snapshot for done task receipts
# Codex git status calls: 2
ok 57 - Claude spec-state uses one snapshot for done task receipts
# Claude git status calls: 2
# tests 57
# pass 57
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): 2 test đỏ, mỗi host 14 lần `git status`.
- Counterexample (Codex báo): bỏ `enableSnapshotMemo()` → 2 test đỏ (14 lần), hoàn tác xanh lại.
- Self-test (controller chạy): `node scripts/run-skill-self-tests.mjs` trong `packages/spec` → `PASS: 2046 tests executed`, exit 0.
- `cmp .claude/hooks/spec-state.cjs packages/spec/src/claude/hooks/spec-state.cjs` → khớp; `git diff --check` sạch.
- Review controller: hai hook thêm đúng một dòng giống mẫu spec-gate (`src/claude/hooks/spec-gate.cjs:96`, `src/codex/hooks/spec-gate.cjs:45`); test kiểm Receipt hợp lệ trước khi đếm. Commit 836df552.
