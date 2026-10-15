# Task 02 — Repo chưa có commit: provenance và hook Claude

Status: done

## Outcome
Trong repo đã `git init` nhưng HEAD chưa có commit, Claude không còn chặn mọi lần Stop vì "controlled failure":
- Không có task done: Stop qua bình thường, tollgate in một dòng nhắc tạo commit đầu.
- Đã có task done: Stop bị chặn, lý do nhắc tạo commit đầu rồi lấy Base/Head sau commit đó.
- Lỗi git khác (ref hỏng, không có git trong PATH, không phải repo) vẫn chặn "controlled failure".

## Scope
- In:
  - D-02 (plan.md), phần chung: `provenance.cjs` ném `ProvenanceError` mã `no_git_history` **chỉ khi** `git symbolic-ref -q HEAD` thành công và `git show-ref --verify -q <ref>` trả exit 1. Kiểm trong `gitBase` trước `git log`. Mọi kết quả khác (exit 128, `result.error`/ENOENT, ref hỏng) giữ `git_command_failed`.
  - D-02, phần Claude:
    - `spec-gate.cjs`: xử lý `no_git_history` ở **mọi** đường gọi `deriveRuntimeContext`, gồm nhánh nhiều packet ở `checkWorkflowReceiptSet` (`src/claude/scripts/spec-receipt.cjs:314`). Lý do chặn khi có task done chứa `first commit`.
    - `spec-state.cjs`: in đúng một dòng nhắc chứa `no commits` rồi exit 0.
  - Đồng bộ `../../.claude/hooks/spec-gate.cjs`, `../../.claude/hooks/spec-state.cjs`, `../../.claude/scripts/provenance.cjs` (gốc repo, bị gitignore, không commit) bằng copy.
  - Một dòng changelog ở hai file changelog.
- Out:
  - hook Codex (task-03);
  - thư mục không phải git (giữ `git_command_failed`; `bin/__tests__/develop-contract.test.js:827-839` không đổi và phải xanh);
  - CLI `provenance.cjs`: chỉ nhận mã lỗi mới, không thêm hành vi.

## Coverage
- CP-02

## Ownership
- Modify: `src/claude/scripts/provenance.cjs`, `src/claude/hooks/spec-gate.cjs`, `src/claude/hooks/spec-state.cjs`, `src/claude/hooks/__tests__/spec-gate.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`
- Read: `src/claude/scripts/spec-receipt.cjs:297-335`, `src/claude/scripts/workflow-policy.cjs` (export `deriveRuntimeContext`), `bin/__tests__/develop-contract.test.js:827-839`

## Steps
1. Thêm test vào `spec-gate.test.js`.
   - Fixture: `installClaudeGate` (`:230-252`) chưa copy `spec-state.cjs` và `tmpDir()` (`:56`) luôn tạo commit. Mở rộng trong file test: một helper dựng repo `git init` + `user.email`/`user.name` **không commit** (như test 41), và cài thêm `spec-state.cjs` cạnh `spec-gate.cjs`. Không đổi helper cũ theo cách làm đổi test cũ.
   - Mỗi ca chạy spec-gate (payload `Stop`); ca (a) chạy thêm spec-state (payload `UserPromptSubmit` có prompt nhắc `specs/<packet>`).
   - (a) chưa commit, packet có task `in_progress`, không có task done:
     - spec-gate exit 0, stdout rỗng;
     - spec-state in đúng một dòng chứa `no commits`, không có `Spec tollgate unavailable`.
   - (b) như (a) nhưng có một task `done` với Receipt bất kỳ: spec-gate trả `decision: block`, `reason` chứa `first commit`, không chứa `controlled failure`.
   - (e) chưa commit, hai packet đều mọi task done (đi nhánh `checkWorkflowReceiptSet`): block, `reason` chứa `first commit`.
   - (f) repo đã có commit nhưng ref của nhánh hiện tại bị hỏng (ghi nội dung rác vào file ref): block, `reason` chứa `controlled failure`.
   - (g) repo chưa commit, chạy hook với `PATH` chỉ chứa một thư mục tạm rỗng (hook vẫn chạy bằng `process.execPath`): block, `reason` chứa `controlled failure`.
   - (d) repo đã có commit, packet có task done hợp lệ: hành vi cũ (stdout rỗng), để chắc không hồi quy.
   - Test 41 (`:1357-1379`, HEAD chưa sinh có task done): sửa **đúng** dòng `assert.match(body.reason, /controlled failure/)` thành `/first commit/` và cập nhật comment tương ứng; giữ assert block. Đây là test cũ duy nhất được đổi assertion.

   Chạy Command trên code task-01: (a), (b), (e) và test 41 đã sửa phải đỏ; (f), (g), (d) xanh. Ghi số ca đỏ.
2. Sửa `provenance.cjs` và hai hook Claude; đồng bộ ba file `../../.claude` bằng copy; thêm changelog.
3. Chạy Command; chạy self-test như task-01 (gồm `develop-contract.test.js`); `cmp` ba file `../../.claude` với nguồn.
4. Commit đúng các file trong Ownership.

## Acceptance
- AC-02 (phần Claude): (a), (b), (d)–(g) đúng; test 41 chỉ đổi assertion `reason`; các test cũ khác không đổi assertion; self-test exit 0.

## Dependencies
- task-01-spec-state-memo.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/spec-gate.test.js packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js packages/spec/bin/__tests__/runtime-dir.test.js`
- Named probe: các ca (a), (b), (e), (f), (g); tên test của (a), (b), (e) chứa `no commits`.
- Reachability: hook chạy bằng `spawnSync` từ layout `.claude/hooks`, script nạp từ `.claude/scripts`.
- Oracle: exit 0, `# fail 0`, output có tên các ca.
- Counterexample: trên bản chép tạm, (1) bỏ kiểm `no_git_history` trong `spec-gate.cjs` → ca (a) đỏ vì quay lại `controlled failure`; (2) đổi phân loại thành "`rev-parse --verify HEAD` thất bại" → ca (f) đỏ. Hoàn tác sau đó.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/spec-gate.test.js packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js packages/spec/bin/__tests__/runtime-dir.test.js`
Exit: 0
Base: 0d898bf9f2ca84cd5801897e1215e0ac35790a93
Head: 891d10551aad6fe6de2970572d91ceca5282512bc4318e9258ce04fa64e69039

```text
ok 54 - 41. unborn HEAD fails closed before any receipt check
ok 55 - no commits allows Stop without done tasks and prints one reminder
ok 56 - no commits blocks a done task with first commit guidance
ok 57 - no commits blocks two completed packets with first commit guidance
ok 58 - a corrupt current branch ref remains a controlled failure
ok 59 - unavailable git remains a controlled failure in a repo without commits
ok 60 - a committed repo still accepts a valid done task receipt
# tests 91
# pass 91
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): ca (a), (b), (e) và test 41 đỏ; (f), (g), (d) xanh — 87 pass, 4 fail.
- Counterexample (Codex báo): bỏ xử lý `no_git_history` trong spec-gate → (a) đỏ; phân loại bằng `rev-parse --verify HEAD` → (f) đỏ; đã hoàn tác.
- Self-test (controller chạy): `PASS: 2052 tests executed`, exit 0; `develop-contract.test.js` không đổi.
- `cmp` ba file `.claude` (spec-gate, spec-state, provenance) với nguồn → khớp; `git diff --check` sạch.
- Review controller: phân loại `symbolic-ref` + `show-ref` đúng D-02 (detached HEAD vẫn qua `git log`); `hasDoneTasks` tính trước cả hai đường gọi provenance; test 41 chỉ đổi assertion `reason`. Sửa sau review: bỏ nhãn ca khỏi tên test. Commit 0d898bf9.
