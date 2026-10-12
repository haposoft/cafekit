# Task 01 — Lib inspect dùng chung cho mọi host

Status: done

## Outcome
`src/claude/hooks/lib/inspect-paths.cjs` là bộ luật inspect duy nhất. Hook inspect-block của Claude (cũng là hook của omp, grok) và của Codex đều gọi nó. Kết quả mong muốn:
- hết chặn nhầm venv, build, patch, Grep regex và project nằm dưới thư mục `build/`;
- vẫn chặn đọc thư mục nặng, kể cả qua `grep -r`, lệnh có lớp bọc, `$(…)`.

## Scope
- In:
  - Chuyển `src/codex/hooks/lib/inspect-paths.cjs` sang `src/claude/hooks/lib/inspect-paths.cjs` và sửa theo D-02..D-05 của `plan.md`. API: `inspectInput(toolName, toolInput, { cwd, projectRoot })` → `{ broadGlob, blockedPath }`.
  - `src/claude/hooks/inspect-block.cjs`:
    - bỏ `extractPaths`, `ALLOWED_CMD`, `VENV_*` và regex lệnh riêng; gọi lib với `{ cwd: payload.cwd, projectRoot: CLAUDE_PROJECT_DIR || payload.cwd }`;
    - giữ nguyên `denyWithReason` (JSON + stderr + exit 2), vì `grok-envelope.test.js:131` cần câu "Please narrow your scope";
    - giữ nguyên cờ `runtime.scout/inspect.enabled` và nhánh crash;
    - giữ nguyên header có chuỗi `<runtime>/runtime.json` (`runtime-dir.test.js:146-147`) và dòng `"inspect": { "enabled": false }` (`scripts/check-skill-rename.sh:24`);
    - lib mới không dùng literal `'inspect'` có dấu nháy.
  - `src/codex/hooks/inspect-block.cjs`: chuyển `require('./lib/inspect-paths.cjs')` (:9) vào trong `try`; gọi lib với `{ cwd: sessionCwd, projectRoot }` lấy từ `getHookContext`; giữ nguyên định dạng deny hiện tại.
  - `src/codex/hooks/lib/inspect-paths.cjs` → shim một dòng `module.exports = require('../../../claude/hooks/lib/inspect-paths.cjs');`.
  - `bin/phases/codex-runtime.js`: thêm `writeSourceFile` cho `inspect-paths.cjs` cạnh 3 lib hiện có (:105-125).
  - `src/claude/migration-manifest.json`: thêm `hooks/lib/inspect-paths.cjs`. Installer Claude và omp chép lib theo manifest.
  - Đồng bộ bản dogfood: `.claude/hooks/inspect-block.cjs` và `.claude/hooks/lib/inspect-paths.cjs` giống hệt nguồn.
  - Test mới `packages/spec/bin/__tests__/inspect-paths.test.js`:
    - chạy bảng ca dưới đây trên hook Claude chép vào thư mục tạm, và trên hook Codex theo fixture của `codex-native-hook-boundaries.test.js`;
    - thêm `inspect-paths` vào danh sách lib chép ở `codex-native-hook-boundaries.test.js:16` và ở fixture `inHookFixture` của `codex-hooks.test.js:68-80`;
    - ca chặn: exit 2, và Claude có `"permissionDecision":"deny"` trên stdout, Codex có `SCOPE LIMIT EXCEEDED` trên stderr;
    - ca cho qua: exit 0, stdout rỗng, không có dòng `crash` mới trong `hook-log.jsonl` của thư mục state tạm.
  - `packages/spec/CHANGELOG.md` và `docs/project-changelog.md`, mục `[Unreleased]`: mỗi file một dòng Fixed.
- Out: privacy-block; `BLOCKED_DIRS`/`BROAD_GLOBS`; matcher (task 02); PowerShell trên grok.

### Bảng ca (cả hai host; cwd = project root = thư mục tạm, trừ khi ghi khác)
Phải chặn (exit 2):
- Read:
  - `node_modules/x/index.js`;
  - đường dẫn tuyệt đối `<root>/dist/a.js`.
- Glob:
  - `pattern:"**/*"` (glob quá rộng);
  - `pattern:"*.js", path:"dist"`.
- Grep:
  - `pattern:"foo", path:"node_modules"`;
  - `pattern:"foo", glob:"dist/**"`.
- Bash, lệnh đọc trực tiếp:
  - đọc file: `cat` vào `dist/index.js`, `nl -ba` vào `dist/a.js`, `sed -n 1,5p` vào `build/x`;
  - tìm kiếm: `grep -rn foo node_modules`, `rg foo dist`, `find ./dist`;
  - liệt kê: `ls node_modules`.
- Bash, lệnh đọc nằm sau lớp bọc:
  - lớp bọc package manager: `npm exec` + cat vào `./dist/index.js`, `npx` + cat vào `dist/a.js`, `npm exec --` + cat vào `dist/a`;
  - biến môi trường và quyền: `FOO=1` + cat, `env FOO=1` + cat, `sudo -u root` + cat, cùng đích `dist/a`.
- Bash, lệnh đọc nằm trong substitution:
  - `vite build --outDir ./dist` + `$(` cat vào `dist/index.js` `)`;
  - echo + backtick cat vào `dist/a`;
  - echo + `"$(` cat vào `dist/a` `)"`.
- Bash, đường dẫn `~`: cat vào một đường `~/…` trỏ vào `<root>/dist/a`.
- Ca không có `tool_name`: `{ path: "./dist/index.js" }`.
- Ca `tool_name: "exec_command"`: cat vào `dist/index.js`.

Phải cho qua (exit 0):
- Tool ghi:
  - Edit, Write, MultiEdit vào `<root>/scripts/build/release.js`;
  - NotebookEdit vào `dist/a.ipynb`;
  - `apply_patch` có dòng `"main": "./dist/index.js"`;
  - `apply_patch` có `*** Add File: src/build/config.ts`.
- Grep chỉ có regex, không có path cấm: `pattern:"target"`, `pattern:"node_modules"`.
- Venv:
  - `.agents/skills/.venv/bin/python3 scripts/search.py q`;
  - `.claude/skills/.venv/bin/python3 scripts/x.py`;
  - `python3 -m venv .venv`;
  - `source .venv/bin/activate && pytest`.
- Lệnh build hoặc lệnh không phải lệnh đọc:
  - `node_modules/.bin/eslint src`, `npx eslint dist/`, `python3 scripts/x.py build/out`;
  - `tsc --outDir ./build`, `vite build --outDir ./dist`, `npm run build -- --outDir ./dist`;
  - `cargo build --target-dir ./target`, `cd build && cmake ..`.
- Tham số loại trừ:
  - `tree -I node_modules`;
  - `grep -rn foo . --exclude-dir node_modules`;
  - `rg --glob '!**/node_modules/**' foo`;
  - Grep `pattern:"foo", glob:"!dist/**"`;
  - `find . -path ./node_modules -prune -o -print`.
- Chuỗi trông giống lệnh nhưng không phải:
  - `echo concat vendor`;
  - substitution trong ngoặc đơn: echo + `'$(` cat vào `dist/a` `)'`;
  - heredoc `git commit -F - <<'EOF'` có thân `ls node_modules cleanup`, kết thúc bằng `EOF`.
- Project root là `<tmp>/build/app`, Read vào `<tmp>/build/app/src/a.js` trong ba trường hợp:
  - cwd là chính root;
  - cwd là `<tmp>/build/app/packages/x`;
  - root được truyền qua symlink (`fs.symlinkSync`), còn đường dẫn là realpath.
- Ca thông thường: Read `src/a.js`; Bash cat vào `src/a.js`.

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/src/claude/hooks/lib/inspect-paths.cjs`, `packages/spec/bin/__tests__/inspect-paths.test.js`, `.claude/hooks/lib/inspect-paths.cjs`
- Modify: `packages/spec/src/claude/hooks/inspect-block.cjs`, `packages/spec/src/codex/hooks/inspect-block.cjs`, `packages/spec/src/codex/hooks/lib/inspect-paths.cjs`, `packages/spec/bin/phases/codex-runtime.js`, `packages/spec/src/claude/migration-manifest.json`, `packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js` (danh sách lib :16), `packages/spec/bin/__tests__/codex-hooks.test.js` (fixture :68-80), `.claude/hooks/inspect-block.cjs`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `packages/spec/src/omp/extensions/cafekit-bridge.mjs`, `packages/spec/bin/__tests__/{omp-bridge,omp-hooks,grok-envelope,hook-payload,runtime-dir}.test.js`, `packages/spec/scripts/check-skill-rename.sh`, `packages/spec/src/claude/hooks/lib/hook-payload.cjs`, `packages/spec/src/codex/hooks/lib/hook-context.cjs`

## Steps
1. Chạy Command trước khi sửa để lấy số gốc. Node 22 bỏ qua im lặng file test không tồn tại khi lệnh có file khác (đã kiểm 12/10: Command exit 0, 85/85), nên lần chạy này pass là bình thường; lần đỏ trước khi sửa là Step 2.
2. Viết test theo bảng ca; chạy Command trên code cũ, phải đỏ ở ít nhất các ca của Named probe (ghi số ca đỏ vào báo cáo của Codex, không ghi vào task). Nếu không ca nào đỏ thì dừng và báo.
3. Viết lib, sửa hai hook, shim, installer, manifest; đồng bộ `.claude/hooks`. Lưu ý: hook đang chạy trong pane có thể chặn chính lệnh shell có chuỗi giống lệnh đọc; dùng tool sửa file, không vòng qua hook.
4. Chạy Command; chạy `pnpm test` ở gốc repo; `cmp` bản `.claude/hooks` với nguồn; chạy `bash packages/spec/scripts/check-skill-rename.sh`.
5. Commit đúng file Ownership bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-01:
  - mọi ca trong bảng đúng trên cả hai host;
  - các test `codex-native-hook-boundaries`, `omp-bridge`, `omp-hooks`, `grok-envelope`, `hook-payload`, `runtime-dir`, `codex-hooks` xanh;
  - `pnpm test` ở gốc repo exit 0;
  - `.claude/hooks/inspect-block.cjs` và `.claude/hooks/lib/inspect-paths.cjs` giống hệt bản nguồn;
  - `src/codex/hooks/lib/inspect-paths.cjs` chỉ còn một dòng `require`;
  - `check-skill-rename.sh` không báo lỗi mới.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/inspect-paths.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/grok-envelope.test.js packages/spec/bin/__tests__/hook-payload.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/runtime-dir.test.js`
- Named probe:
  - ca `.venv/bin/python3` cho qua trên Codex;
  - ca Grep `pattern:"target"` cho qua trên Claude;
  - ca `grep -rn foo node_modules` bị chặn trên Claude;
  - ca `env FOO=1` + cat bị chặn trên cả hai host.
- Reachability: hook chạy bằng `spawnSync(process.execPath, [hook])` với stdin JSON, giống cách host thật gọi.
- Oracle: exit 0, `# fail 0`, số test lớn hơn 85 (số gốc khi chưa có `inspect-paths.test.js`), và output có tên test của `inspect-paths.test.js`.
- Counterexample (chỉ làm trên bản chép tạm, hoàn tác cả ba):
  1. lib coi `pattern` của Grep là path → ca Grep `pattern:"target"` phải đỏ;
  2. bật lại nhánh dự phòng cũ → ca `.agents/skills/.venv/bin/python3 …` phải đỏ;
  3. bỏ `inspect-paths` khỏi fixture → ca chặn phải đỏ, vì hook crash không được tính là cho qua.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/inspect-paths.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/grok-envelope.test.js packages/spec/bin/__tests__/hook-payload.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/runtime-dir.test.js
Exit: 0
Base: f2b0797f03233618b32b9301c4b8ab62e678473e
Head: b244d7a1732d04459c3a17fd664e6b55d615b1bf86de1f50acd7a97d2ce42c11
```text
ok 74 - inspect-paths claude: grep -rn foo node_modules
ok 82 - inspect-paths claude: env FOO=1 cat dist/a
ok 96 - inspect-paths claude: Grep regex target
ok 98 - inspect-paths claude: .agents/skills/.venv/bin/python3 scripts/search.py q
ok 190 - inspect-paths codex: grep -rn foo node_modules
ok 198 - inspect-paths codex: env FOO=1 cat dist/a
ok 212 - inspect-paths codex: Grep regex target
ok 214 - inspect-paths codex: .agents/skills/.venv/bin/python3 scripts/search.py q
# tests 317
# pass 317
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Bằng chứng kèm (12/10, Head f2b0797f): 116 ca inspect-paths mỗi host; `pnpm test` exit 0 (612+199+42 pass, skill-test 1639); `cmp` .claude/hooks với nguồn exit 0; `check-skill-rename.sh` exit 1 giống hệt trên 7f04f10e (dòng optional-skill-inventory.test.js:63 có sẵn, không lỗi mới). Phản ví dụ trên bản chép tạm: lib coi `pattern` của Grep là path → 4 ca Grep regex đỏ (hai host); Codex báo fallback cũ → 18 đỏ, bỏ lib khỏi fixture → 102 đỏ. Thử trực tiếp hook Claude trong phiên: chuỗi văn xuôi có lệnh đọc cho qua, `grep -rn … node_modules` bị chặn. Review code-auditor: 0 Critical/High, 2 Medium chặn nhầm (redirect, tuỳ chọn rg/grep) đã sửa ở f2b0797f; Low còn lại ghi ở GATE-DONE. Step 1 đã sửa: node 22 bỏ qua im lặng file test vắng, lần đỏ trước sửa là Step 2 (66 ca).
