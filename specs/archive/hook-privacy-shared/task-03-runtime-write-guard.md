# Task 03 — Bảo vệ ghi runtime.json; công tắc đọc từ gốc cài đặt

Status: done

## Outcome
Agent không tự tắt được cổng privacy. Ghi vào `runtime.json` của CafeKit, hay vào thư mục token approve của Codex, phải được duyệt, dù viết đường dẫn ở dạng hoặc kiểu chữ nào. Đọc thì cho qua. `privacyBlock` chỉ được đọc từ runtime của gốc cài đặt.

## Scope
- In:
  - D-04 (plan.md): analyzer trả thêm `writes`; lib xét đích ghi của tool có cấu trúc, `apply_patch`, `mcp__*`, shell.
  - D-05 phần Claude/omp: hook Claude đọc `runtime.json` từ gốc cài đặt; overlay omp đi theo (vẫn bằng hook Claude + hai chỗ `deny`).
  - Một dòng changelog ở hai file changelog.
- Out: đường ghi gián tiếp; ghi đè file hook (ghi là giới hạn trong plan); Codex (`PROJECT_ROOT` đã đúng gốc).

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/hooks/lib/privacy-command-analysis.cjs`, `packages/spec/src/claude/hooks/lib/privacy-paths.cjs`, `packages/spec/src/claude/hooks/privacy-block.cjs`, `packages/spec/src/omp/hooks/privacy-block.cjs`, `packages/spec/bin/__tests__/privacy-paths.test.js`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `packages/spec/src/claude/hooks/lib/runtime-dir.cjs`

## Steps
1. Thêm ca vào `privacy-paths.test.js` (cả hai host):
   - Nhạy cảm:
     - tool có cấu trúc: Write `{file_path:".claude/runtime.json"}`, Edit `.codex/runtime.json`, NotebookEdit `.omp/runtime.json`
     - apply_patch: `*** Add File: .codex/hooks/.privacy/g.json`
     - MCP: `mcp__fs__write_file {path:".claude/runtime.json"}`
     - shell, ghi trực tiếp: `echo '{}' > .claude/runtime.json`, `echo '{}' > .CLAUDE/RUNTIME.JSON`, `echo x >> .claude/./runtime.json`, `tee .codex//runtime.json`, `sed -i s/a/b/ .omp/runtime.json`
     - shell, đích là thư mục: `cp r.json .claude/`, `mv r.json .codex/runtime.json`, `cp t .codex/hooks/./.privacy/`
     - shell, qua `cd`: `cd .claude && cp /tmp/r.json runtime.json`
     - thư mục con: `echo x > sub/.claude/runtime.json`
   - Cho qua: Read `.claude/runtime.json`; Bash `cat .codex/runtime.json`; Bash `jq .paths .claude/runtime.json`; Write `docs/runtime.json`.
   - Công tắc (chỉ Claude): `sub/.claude/runtime.json` có `privacyBlock:false`, payload `cwd=<root>/sub`, Read `../.env` → vẫn `ask`. Root `.claude/runtime.json` có `privacyBlock:false` → Read `.env` cho qua (người dùng tắt tay vẫn được).
   Chạy Command trên code task-02: các ca nhạy cảm và ca công tắc thư mục con phải đỏ; ghi số ca đỏ.
2. Sửa analyzer, lib, hook Claude và overlay omp; đồng bộ `.claude/hooks` bằng copy; changelog.
3. Chạy Command; `pnpm test` ở gốc repo; `cmp` bản `.claude` với nguồn.
4. Commit đúng file Ownership (không tên AI, không mã plan, không push).

## Acceptance
- AC-03: mọi ca đúng trên cả hai host; ca task-01/02 vẫn xanh; `omp-hooks.test.js` xanh không đổi assertion; `pnpm test` exit 0.

## Dependencies
- task-02-recursive-search.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/privacy-paths.test.js packages/spec/src/claude/hooks/__tests__/privacy-block.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/runtime-dir.test.js`
- Named probe: `echo '{}' > .CLAUDE/RUNTIME.JSON` (nhạy cảm), `cat .codex/runtime.json` (cho qua), công tắc trong `sub/` (vẫn ask).
- Reachability: như task-01.
- Oracle: exit 0, `# fail 0`, output có tên các ca Named probe.
- Counterexample (bản chép tạm, hoàn tác): bỏ bước chuyển chữ thường → ca `.CLAUDE/RUNTIME.JSON` phải đỏ; đọc công tắc theo `cwd` → ca `sub/` phải đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/privacy-paths.test.js packages/spec/src/claude/hooks/__tests__/privacy-block.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/runtime-dir.test.js
Exit: 0
Base: 447adcaac07d26075d0f62f98e8dff6d52c78213
Head: d40e95480b2e814855cd97f2f9bec8f12424744e31d3d6b6044106108a21a6b8
```text
ok 100 - privacy-paths claude: runtime writes chained approval symlink
ok 101 - privacy-paths claude: runtime writes chained runtime symlink
ok 122 - privacy-paths claude: runtime writes echo '{}' > .CLAUDE/RUNTIME.JSON
ok 138 - privacy-paths claude: runtime allows cat .codex/runtime.json
ok 153 - privacy-paths codex: runtime writes chained approval symlink
ok 154 - privacy-paths codex: runtime writes chained runtime symlink
ok 175 - privacy-paths codex: runtime writes echo '{}' > .CLAUDE/RUNTIME.JSON
ok 191 - privacy-paths codex: runtime allows cat .codex/runtime.json
ok 195 - privacy-paths claude: subdirectory switch cannot disable root privacy
1..422
# tests 422
# suites 0
# pass 422
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 32554.928042
```

Đỏ trước khi sửa: 47 ca ban đầu, rồi thêm 30 + 8 + 12 ca qua ba vòng sửa sau review (redirect trong đối số cp/mv, >|, đuôi header heredoc, cd động, thư mục symlink, cp -r .claude; redirect vào < và <<<; symlink treo; số fd trước <; chuỗi symlink nhiều tầng và vòng lặp). pnpm test exit 0 (PASS: 1921 tests executed). cmp ba file .claude với nguồn: khớp. Counterexample: bỏ chuyển chữ thường → 2 fail; đọc công tắc theo cwd → 1 fail (đã hoàn tác). Review code-auditor: FAIL ba vòng, PASS ở vòng sửa 3; Low ghi vào giới hạn: dd of=, perl -pi, truncate, touch không bị bắt (theo D-04); cp -r .claude ra ngoài bị hỏi; đường qua hơn 8 symlink bị hỏi; regex heredoc bậc hai có từ trước. Commit 447adcaa.
