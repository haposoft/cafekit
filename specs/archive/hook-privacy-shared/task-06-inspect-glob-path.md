# Task 06 — Inspect cho qua glob rộng có path hẹp

Status: done

## Outcome
Grep/Glob với glob rộng (`**/*.ts`) kèm path hẹp nằm hẳn bên trong project (như `src`) không còn bị inspect chặn trên mọi host. Các trường hợp sau vẫn bị chặn như cũ: không có path, path là gốc project, path là thư mục cha của gốc, path nằm ngoài project, hoặc path trong thư mục bị chặn.

## Scope
- In:
  - D-08 (plan.md) trong `inspect-paths.cjs`, áp cho cả trường có cấu trúc (`path`, `paths`) lẫn positional của `rg -g`/`--glob`;
  - chuyển ca `rg --glob '**/*' symbol src` ở `codex-hooks.test.js:726-733` sang nhóm cho qua và thêm ca `rg --glob '**/*' symbol .` vào nhóm bị chặn (theo D-08, không làm yếu test);
  - một dòng changelog ở hai file changelog.
- Out: đổi `BROAD_GLOBS`, `BLOCKED_DIRS`.

## Coverage
- CP-06

## Ownership
- Modify: `packages/spec/src/claude/hooks/lib/inspect-paths.cjs`, `packages/spec/bin/__tests__/inspect-paths.test.js`, `packages/spec/bin/__tests__/codex-hooks.test.js`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`

## Steps
1. Thêm ca vào `inspect-paths.test.js` (cả hai host) và sửa nhóm ca ở `codex-hooks.test.js:726-733` như Scope. Chạy Command trên code task-05: các ca cho qua phải đỏ.
   - Cho qua: Grep `{pattern:"x", glob:"**/*.ts", path:"src"}`; Glob `{pattern:"**/*.ts", path:"src"}`; Bash `rg -g '**/*.ts' x src`.
   - Vẫn chặn: Glob `{pattern:"**/*"}`; Grep `{pattern:"x", glob:"**/*.ts", path:"."}`; Glob `{pattern:"**/*.ts", path:"<project root tuyệt đối>"}`; Glob `{pattern:"**/*", path:".."}`; Glob `{pattern:"**/*", path:"/"}`; Glob `{pattern:"**/*", path:"~"}`; Glob `{pattern:"**/*", path:"src/.."}`; Glob `{pattern:"**/*.ts", path:"node_modules"}`; Bash `rg --glob '**/*' symbol .`.
2. Sửa lib; đồng bộ `.claude/hooks/lib/inspect-paths.cjs` bằng copy; changelog.
3. Chạy Command; `pnpm test` ở gốc repo; `cmp` bản `.claude` với nguồn.
4. Commit đúng file Ownership (không tên AI, không mã plan, không push).

## Acceptance
- AC-06: mọi ca đúng trên cả hai host; các ca cũ khác của hai file test không đổi; `pnpm test` exit 0.

## Dependencies
- task-05-claude-matcher-installer.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/inspect-paths.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/omp-hooks.test.js`
- Named probe: Grep `glob:"**/*.ts", path:"src"` (cho qua); `path:"."` và `path:".."` (chặn).
- Reachability: như gói 1 (`spawnSync` hook từ layout `.claude`/`.codex` đã dựng).
- Oracle: exit 0, `# fail 0`, output có tên các ca Named probe.
- Counterexample (bản chép tạm, hoàn tác): coi path ngoài root là hẹp → ca `path:".."` phải đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/inspect-paths.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/omp-hooks.test.js
Exit: 0
Base: cd502ce90c4899ea31d62a862eae26cb000bc1eb
Head: 1a8e44123abdf599669d8ba224c703182cc31e3d7ba71707d3c0a524d9b0095d
```text
ok 163 - inspect-paths claude: Grep glob:"**/*.ts", path:"src"
ok 164 - inspect-paths claude: Glob pattern:"**/*.ts", path:"src"
ok 167 - inspect-paths claude: Grep glob:"**/*.ts", path:"."
ok 169 - inspect-paths claude: Glob broad path:".."
ok 334 - inspect-paths codex: Grep glob:"**/*.ts", path:"src"
ok 335 - inspect-paths codex: Glob pattern:"**/*.ts", path:"src"
ok 338 - inspect-paths codex: Grep glob:"**/*.ts", path:"."
ok 340 - inspect-paths codex: Glob broad path:".."
1..394
# tests 394
# suites 0
# pass 394
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 42357.096667
```

Đỏ trước khi sửa: 7 ca theo task + 5 ca Codex thêm (gom scope theo lệnh, đổi cwd); vòng sửa 1 thêm 21 ca; vòng sửa 2 thêm 58 ca (báo cáo Codex). Gốc 284 test → 394. pnpm test exit 0 (PASS: 2044 tests executed). cmp .claude/hooks/lib/inspect-paths.cjs với nguồn: khớp. Counterexample: coi path ngoài root là hẹp → hai ca path:".." đỏ (đã hoàn tác). Named probe path:".." được phủ bằng ca Glob path:".." (Grep dùng cùng hàm narrowPath). Review code-auditor: FAIL (rg không path với option lạ được cho qua), PASS_WITH_WARNINGS (chặn nhầm cờ rg thông dụng), rồi PASS. Low ghi giới hạn: RIPGREP_CONFIG_PATH gán trong lệnh và sudo -nD.. lọt (phải cố ý dựng); env -iC .. tách rời, timeout/eval/sh -c rg, rg -g'**/*' dính liền không được phân tích (có từ trước); -Tjs, -epat, cd src && rg . bị chặn thừa; ca cho qua chưa có variant nested/symlink trong test. Commit cd502ce9.
