# Task 01 — Installer chặn khi file gốc đã commit đang vắng

Status: done

## Outcome
Cài vào repo mà `AGENTS.md`/`CLAUDE.md` đang được git theo dõi nhưng vắng trên đĩa thì installer báo lệnh khôi phục, không ghi gì, exit khác 0.

## Scope
- In: D-01 trong `bin/install.js` (helper nhỏ có thể đặt trong `bin/lib/` nếu cần); test; hai changelog.
- Out: writer từng file; tự khôi phục.

## Coverage
- CP-01

## Ownership
- Modify: `bin/install.js`, `bin/__tests__/installer-safety.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`
- Create (nếu cần): `bin/lib/tracked-root-files.js`
- Read: `bin/phases/claude-runtime.js`, `bin/phases/codex-runtime.js`, `bin/lib/backup.js`, `bin/lib/context.js` (alias platform), `bin/__tests__/package-inventory.test.js:1486` (mẫu commit trong test)

## Steps
1. Thêm test vào `installer-safety.test.js`, chạy installer thật (`node bin/install.js --platform … --yes --without-document-skills`) trong repo git tạm:
   - commit (identity riêng, `--no-gpg-sign`) `AGENTS.md` có ghi chú sau marker, xoá file trên đĩa, cài `claude` → exit khác 0, output có `git checkout -- AGENTS.md` và `git rm AGENTS.md`, không có `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.cafekit-backup/` mới (bỏ qua `.cafekit.lock`).
   - như trên với `CLAUDE.md` khi cài `claude`; `AGENTS.md` khi cài `codex`; `AGENTS.md` khi cài `omp`.
   - `AGENTS.md` đánh dấu `git update-index --skip-worktree` rồi xoá → cài bình thường.
   - `CLAUDE.md` là symlink treo đã commit, trỏ tới đường dẫn bên trong repo tạm → output **không** có `tracked by git but missing`; hàng rào symlink sẵn có của snapshot vẫn chặn (`Refusing to follow symlinked managed path`, `bin/lib/backup.js:96`), exit khác 0, không ghi gì ra ngoài repo tạm. (Develop 18/10: oracle cũ "exit 0" mâu thuẫn hàng rào này; controller sửa.)
   - `AGENTS.md` vừa skip-worktree vừa assume-unchanged (cờ `s`) rồi xoá → cài bình thường.
   - git trả lỗi khác (giả lập `GIT_TEST_ASSUME_DIFFERENT_OWNER=1`, chạy installer với `GIT_CONFIG_GLOBAL=/dev/null` và `GIT_CONFIG_NOSYSTEM=1` để không phụ thuộc gitconfig của máy) → cài bình thường, output có `Could not confirm git state for AGENTS.md`.
   - `CLAUDE.md` vắng nhưng đã commit, cài `codex` → cài bình thường (codex không ghi `CLAUDE.md`).
   - `--dry-run` cùng tình huống → báo cùng lỗi, exit khác 0.
   - file đã `git rm` (khỏi index) → cài bình thường, tạo file.
   - thư mục không phải repo git → cài bình thường.
   - file có mặt → cài bình thường, ghi chú sau marker giữ nguyên.
   Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-01: các ca đúng; Command xanh.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/installer-safety.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test preflight mới.
- Reachability: installer thật trên repo git tạm.
- Oracle: Oracle chung của plan.
- Counterexample: bỏ preflight → ca `AGENTS.md` vắng tạo file mới, đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/installer-safety.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: 73b55dd9cd504504040572a4bc4e6c2ac798127d
Head: a2b93b0e0f52e02845273e6f0d22b25381a866bc74c5571152b64a083e20a0a2

```text
ok 3 - missing tracked AGENTS.md stops claude installation before writes
ok 4 - missing tracked CLAUDE.md stops claude installation before writes
ok 5 - missing tracked AGENTS.md stops codex installation before writes
ok 6 - missing tracked AGENTS.md stops omp installation before writes
ok 7 - missing tracked AGENTS.md stops claude installation in dry-run before writes
ok 8 - missing skip-worktree AGENTS.md permits installation
ok 9 - missing skip-worktree AGENTS.md permits installation with assume-unchanged
ok 10 - a tracked dangling CLAUDE.md symlink is present for the root preflight
ok 11 - uncertain git ownership warns and permits a fresh root file
ok 12 - Codex installation leaves a missing tracked CLAUDE.md alone
ok 13 - a root file removed from the git index can be freshly installed
ok 14 - a project outside git installs root files without a git-state warning
ok 15 - an existing tracked root file retains notes after its managed marker
# tests 61
# pass 61
# fail 0
# skipped 0
# todo 0
[skill-test] PASS: 2230 tests executed
```

- Đỏ trước sửa (Codex báo): 6/13 ca mới; 6 ca giữ hành vi cũ xanh từ đầu (đúng ý); ca symlink treo đỏ ngoài dự kiến.
- Vòng điều chỉnh: oracle ca symlink treo cũ ("exit 0") mâu thuẫn hàng rào symlink sẵn có của snapshot (`bin/lib/backup.js:96`); controller sửa oracle: preflight không báo "tracked but missing", hàng rào cũ vẫn chặn. Không sửa `backup.js`.
- Counterexample (Codex báo): bỏ lời gọi preflight → ca `missing tracked AGENTS.md stops claude installation before writes` đỏ; khôi phục khớp byte.
- Review controller: preflight sau khi có `ctx.platforms`, trước snapshot; luôn kiểm `AGENTS.md`, `CLAUDE.md` khi có claude; `lstat`; cờ `S`/`s` bỏ qua; exit 1 hoặc "not a git repository" im lặng; lỗi khác cảnh báo. Commit 73b55dd9.
