# Task 02 — omp dọn file cũ có kiểm hash

Status: done

## Outcome
Nâng cấp omp xoá hook/script/extension cũ chỉ khi bytes khớp hash ownership; file đã sửa, chưa ghi nhận, symlink được giữ và có một dòng cảnh báo gộp; omp không đụng `.agents/skills`.

## Scope
- In: D-02 (gồm prune ENOENT cho omp), D-03; `docs/installer-architecture.md`; hai changelog.
- Out: chính sách Claude/Codex.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/bin/phases/omp-runtime.js`, `packages/spec/bin/phases/claude-runtime.js`, `packages/spec/bin/__tests__/codex-native.test.js` (chỉ ca `:3216`), `packages/spec/bin/__tests__/legacy-hooks-retired.test.js`, `packages/spec/bin/__tests__/usage-hook-retired.test.js`, `docs/installer-architecture.md`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`

## Steps
1. Test trước:
   - `legacy-hooks-retired.test.js` ca omp (`:163`): hook legacy ghi hash thật → xoá kèm bản ghi; thêm ca hash giả `'0'*64` → giữ và cảnh báo `Preserved N obsolete runtime item`.
   - `usage-hook-retired.test.js` ca omp (`:88`): tương tự.
   - `codex-native.test.js:3216`: đổi tên (bỏ "omp keeps its cleanup policy"); với omp, 2 script cũ chưa ghi nhận được giữ và stdout có `Preserved 2 obsolete runtime`, cảnh báo không chứa `.agents/skills`; skill cũ trong `.agents/skills` khi chỉ cài lại omp không bị xoá.
   - `legacy-hooks-retired.test.js`: bản ghi omp của hook legacy đã bị người dùng xoá khỏi đĩa được prune (như ca codex "prunes only absent records").
   - Chạy Command → ghi đỏ.
2. `omp-runtime.js`: bỏ `removeObsoleteOmpHooks`, chỉ gọi `removeObsoleteRuntimeFiles`; sửa comment trước lời gọi (`:159-160`). `claude-runtime.js`: bộ lọc omp nhận `hooks|scripts|extensions`, bỏ `skills/`; prune ENOENT cho cả `omp` (`:193`); sửa comment `:179-180`.
3. Doc + changelog: `docs/installer-architecture.md:80` (hook/script cũ của omp cũng đi qua kiểm hash, omp không đụng skill), `:92` (`lib/context.cjs`, `lib/detect.cjs` chỉ gỡ khi hash khớp); comment đầu `usage-hook-retired.test.js:5-8`.
4. Chạy Command. Không commit.

## Acceptance
- AC-02: ca mới xanh; Command xanh.

## Dependencies
- task-01-codex-privacy-mkdir-race.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/legacy-hooks-retired.test.js packages/spec/bin/__tests__/usage-hook-retired.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/bin/__tests__/installer-safety.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: ca hash giả omp trong `legacy-hooks-retired.test.js`; ca omp của `codex-native.test.js:3216`.
- Reachability: installer thật (`bin/install.js --platform omp --yes`) trên thư mục tạm.
- Oracle: file khớp hash bị xoá kèm bản ghi; file khác còn trên đĩa và stdout có `Preserved`; `.agents/skills` không đổi.
- Counterexample: giữ `removeObsoleteOmpHooks` → ca hash giả bị xoá, test đỏ.
- Artifacts: thư mục tạm của test.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/legacy-hooks-retired.test.js packages/spec/bin/__tests__/usage-hook-retired.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/bin/__tests__/installer-safety.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ node --test packages/spec/bin/__tests__/legacy-hooks-retired.test.js packages/spec/bin/__tests__/usage-hook-retired.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/bin/__tests__/installer-safety.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
✔ reinstall preserves untracked Codex and omp runtime files (1542.65925ms)
✔ omp upgrade removes the legacy hooks and their records (524.627875ms)
✔ omp upgrade preserves edited legacy hooks and prunes only absent records (378.951917ms)
✔ omp upgrade removes a pristine old .mjs bridge, which omp never loads (345.439917ms)
✔ omp upgrade keeps an edited, untracked or symlinked old .mjs bridge and says so (1101.255958ms)
✔ omp upgrade removes an installed usage hook and its manifest record (551.362ms)
✔ omp upgrade keeps an edited usage hook and says so (458.909125ms)
ℹ tests 129
ℹ pass 129
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
...
ℹ tests 1165
ℹ pass 1165
ℹ fail 0
[skill-test] PASS: 2295 tests executed
```
Pre-change run: the same node --test command failed exactly the three new behaviour cases (`omp upgrade keeps an edited usage hook and says so`, `omp upgrade preserves edited legacy hooks and prunes only absent records`, `reinstall preserves untracked Codex and omp runtime files`). Review: code-auditor PASS (Low: no omp-specific dry-run case; long header comment line).
