# Task 01 — Installer chặn khi file gốc đã commit đang vắng

Status: pending

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
   - `CLAUDE.md` là symlink treo đã commit, trỏ tới đường dẫn bên trong repo tạm → exit 0, không có lỗi preflight, không ghi gì ra ngoài repo tạm.
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
<!-- Fill only after execution. -->
