# Task 02 — Tìm đệ quy vào thư mục có file mật

Status: done

## Outcome
Lệnh tìm đệ quy (grep/rg/ag/tool Grep) quét một thư mục mà ở cấp con trực tiếp có file mật, và không có bộ lọc nào loại file đó, thì phải được duyệt trên mọi host. Tìm trong thư mục sạch, trong một file, hoặc trong thư mục không tồn tại thì cho qua.

## Scope
- In:
  - D-03 (plan.md): analyzer trả thêm `searches` (kể cả lệnh lồng trong `bash -c`, `xargs`, `find -exec`), giữ nguyên `paths`/`dynamic`/`malformed`;
  - lib xét con trực tiếp bằng `sensitiveRequest`, áp bộ lọc bằng glob thật (`dot:true`, viết tay hoặc dùng `path.matchesGlob` nếu node ≥22 có sẵn; không thêm dependency);
  - một dòng changelog ở hai file changelog.
- Out: duyệt cây con sâu; ghi runtime.json (task-03).

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/hooks/lib/privacy-command-analysis.cjs`, `packages/spec/src/claude/hooks/lib/privacy-paths.cjs`, `packages/spec/bin/__tests__/privacy-paths.test.js`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`

## Steps
1. Thêm ca vào `privacy-paths.test.js` (cả hai host). Fixture có `.env`, `credentials.json`, `.env.example`, `app.ts` ở gốc, thư mục `src/` sạch, `notes.txt` là symlink tới `.env` trong một thư mục con riêng.
   - Nhạy cảm:
     - Bash: `grep -r API_KEY .`, `grep -rn API_KEY .`, `grep -Rin key .`, `grep -rl KEY .`, `grep --recursive KEY .`, `grep -d recurse KEY .`, `grep -R KEY` (không path), `grep -r KEY src .`
     - lệnh lồng: `bash -c 'grep -rn KEY .'`, `echo . | xargs grep -r KEY`
     - rg: `rg KEY .` (vì `credentials.json`), `rg --hidden KEY .`, `rg -u -u KEY .`
     - glob/include: `rg --hidden -g '!*.ts' KEY .`, `grep -r --include='*' KEY .`, `grep -r --include .env KEY .`, `grep -r --include='.e*' KEY .`
     - tool Grep: `{pattern:"KEY"}`, `{pattern:"KEY", path:"."}`, `{pattern:"KEY", glob:"*"}`, `{pattern:"KEY", glob:".*"}`, `{pattern:"KEY", glob:"*.{env,json}"}`
     - symlink: `grep -R KEY <thư mục có notes.txt>`
   - Cho qua:
     - `grep -r KEY src`, `grep -r --include=*.ts KEY .`, `rg -g '*.ts' KEY .`
     - Grep `{pattern:"KEY", path:".", glob:"*.ts"}`
     - `grep -r KEY app.ts` (gốc là file), `grep -r KEY nope/` (không tồn tại), `grep -r KEY locked/` (thư mục `chmod 000`, chỉ chạy khi không phải root; hook không được crash và không ask/deny)
     - `grep KEY .` (không đệ quy), `grep -r KEY .` trong thư mục chỉ có `.env.example`
   Chạy Command trên code task-01: các ca nhạy cảm phải đỏ; ghi số ca đỏ.
2. Sửa analyzer và lib; đồng bộ `.claude/hooks/lib/` bằng copy; changelog.
3. Chạy Command; `pnpm test` ở gốc repo; `cmp` bản `.claude` với nguồn.
4. Commit đúng file Ownership (không tên AI, không mã plan, không push).

## Acceptance
- AC-02: mọi ca đúng trên cả hai host; test cũ của analyzer và `privacy-block.test.js` không đổi assertion; `pnpm test` exit 0.

## Dependencies
- task-01-privacy-shared-lib.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/privacy-paths.test.js packages/spec/src/claude/hooks/__tests__/privacy-block.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/omp-hooks.test.js`
- Named probe: `grep -rn API_KEY .` (nhạy cảm), `grep -r KEY src` (cho qua), Grep `glob:"*"` (nhạy cảm), `rg -g '*.ts' KEY .` (cho qua), `grep -r KEY app.ts` (cho qua).
- Reachability: như task-01.
- Oracle: exit 0, `# fail 0`, output có tên các ca Named probe.
- Counterexample (bản chép tạm, hoàn tác): coi mọi include là giới hạn → ca `--include='*'` phải đỏ; chỉ nhận `-r` đứng riêng → ca `-rn` phải đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/privacy-paths.test.js packages/spec/src/claude/hooks/__tests__/privacy-block.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/omp-hooks.test.js
Exit: 0
Base: 4e033fa0df23b24300376710cb3f24f844340d04
Head: 52ed092d8ac962de396b7bbdcd7b611c6782165cb616e5fd0a761c7d40333b92
```text
ok 90 - privacy-paths claude: recursive grep -rn API_KEY .
ok 119 - privacy-paths claude: recursive Grep {"pattern":"KEY","glob":"*"}
ok 143 - privacy-paths claude: recursive grep -r KEY src
ok 145 - privacy-paths claude: recursive rg -g '*.ts' KEY .
ok 146 - privacy-paths claude: recursive grep -r KEY app.ts
ok 156 - privacy-paths codex: recursive grep -rn API_KEY .
ok 185 - privacy-paths codex: recursive Grep {"pattern":"KEY","glob":"*"}
ok 209 - privacy-paths codex: recursive grep -r KEY src
ok 211 - privacy-paths codex: recursive rg -g '*.ts' KEY .
ok 212 - privacy-paths codex: recursive grep -r KEY app.ts
# tests 307
# suites 0
# pass 307
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 36997.125041
```

Đỏ trước khi sửa: 58 ca nhạy cảm fail trên code task-01 (gốc 174 test); các vòng sửa thêm ca đỏ trước (23, 6, 6, 4, 2). pnpm test exit 0 (PASS: 1813 tests executed). cmp hai lib .claude với nguồn: khớp. Counterexample: coi mọi include là giới hạn → 4 fail (gồm --include='*'); chỉ nhận -r riêng → 2 fail (-rn); đã hoàn tác. Review code-auditor: 3 vòng FAIL (glob neo '/', thiếu matchesGlob trên Node cũ, cờ ẩn rg/ag, glob làm treo hook) → Bro chọn hướng A: chỉ khớp glob hẹp (≤4 wildcard, ≤1 nhóm brace, không escape/extglob/class), glob khác coi như không loại → PASS. Giới hạn: gốc resolve theo cwd phiên (cd sub && grep -r, gốc chứa biến không xét); chưa xác minh Grep Claude tách glob theo dấu phẩy; ag -u ≥1 là hidden (siết hơn D-03). Commit 4e033fa0.
