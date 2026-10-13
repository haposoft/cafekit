# Task 01 — Lib privacy dùng chung cho mọi host

Status: done

## Outcome
Claude, Codex, omp và grok cùng dùng một bộ luật privacy (`src/claude/hooks/lib/privacy-paths.cjs`). Grep `glob`, `notebook_path`, khoá MCP (kể cả `uri` dạng `file://`, `source`/`destination`), `command` dạng argv và header `Move to:` đều được kiểm. Quyết định theo host giữ nguyên. Trên Codex, thiếu lib thì deny.

## Scope
- In:
  - D-01, D-02 (plan.md): tạo lib; ba hook `privacy-block.cjs` chỉ còn đọc payload, kiểm `privacyBlock` (giữ cách đọc hiện tại, task-03 đổi), gọi `sensitivePaths`, trả quyết định host. Giữ nguyên lời nhắn và nhánh catch.
  - Hook Codex: mọi `require` vào trong `try`.
  - Shim `src/codex/hooks/lib/privacy-paths.cjs` một dòng `require`; installer Codex chép lib (như `codex-runtime.js:105-111`); thêm lib vào `migration-manifest.json`.
  - Fixture test Codex: thêm `privacy-paths` vào danh sách lib chép tay ở ba file test (chỉ sửa danh sách, không đổi assertion).
  - Một dòng changelog ở hai file changelog.
- Out: tìm đệ quy (task-02), ghi runtime.json và chỗ đọc công tắc (task-03), `getHookContext` (task-04), matcher (task-05).

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/src/claude/hooks/lib/privacy-paths.cjs`, `packages/spec/src/codex/hooks/lib/privacy-paths.cjs`, `packages/spec/bin/__tests__/privacy-paths.test.js`
- Modify: `packages/spec/src/claude/hooks/privacy-block.cjs`, `packages/spec/src/codex/hooks/privacy-block.cjs`, `packages/spec/src/omp/hooks/privacy-block.cjs`, `packages/spec/bin/phases/codex-runtime.js`, `packages/spec/src/claude/migration-manifest.json`, `packages/spec/bin/__tests__/codex-hooks.test.js` (danh sách lib ở `inHookFixture`), `packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js` (danh sách lib), `packages/spec/bin/__tests__/inspect-paths.test.js` (danh sách lib), `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `packages/spec/src/claude/hooks/lib/privacy-command-analysis.cjs`, `packages/spec/src/codex/hooks/lib/privacy-state.cjs`, `packages/spec/bin/phases/omp-runtime.js`, `packages/spec/bin/__tests__/omp-hooks.test.js:126-153`, `packages/spec/bin/__tests__/codex-native.test.js` (mẫu `install(root)`)
- Không commit file trong `.claude/` (gitignore); đồng bộ bản dogfood bằng copy.

## Steps
1. Chạy Command trước khi sửa: `privacy-paths.test.js` chưa có nên node bỏ qua im lặng, pass là bình thường; ghi số test gốc.
2. Viết `privacy-paths.test.js`. Fixture Codex dựng bằng **installer thật** vào thư mục tạm có `git init` (theo mẫu `install(root)` của `codex-native.test.js`), fixture Claude là thư mục tạm có `.claude/hooks` chép từ nguồn. Payload Codex luôn có `session_id`. Mọi lần spawn hook trong test xoá `CLAUDE_PROJECT_DIR` khỏi env (như `runtime-dir.test.js:95`). Bảng ca, mỗi ca trên cả hai host:
   - nhạy cảm: Read `.env`; Grep `{pattern:"x", glob:".env*"}`; NotebookEdit `{notebook_path:".env"}`; `mcp__fs__read_file {path:".env"}`; `mcp__x__y {args:{file_path:"certs/a.pem"}}`; `mcp__fs__read {uri:"file://<tmp>/.env"}`; `mcp__fs__move_file {source:".env", destination:"x"}`; `mcp__s__read {relative_path:".env"}`; Bash `cat .env`; Bash `docker compose --env-file .env up`; `shell {command:["bash","-lc","cat .env"]}`; apply_patch `*** Update File: .env`; apply_patch `*** Update File: a.txt` + `*** Move to: .env`;
   - cho qua: Read `app.ts`; Read `.env.example`; Grep `{pattern:"API_KEY", glob:"*.ts"}`; Bash `ls`;
   - Claude trả JSON `ask`; Codex trả JSON `deny` có chuỗi approval; không có stack trên stderr;
   - Codex đã cài nhưng xoá `.codex/hooks/lib/privacy-paths.cjs` → Bash `ls` vẫn ra JSON `deny`, exit 0.
   Chạy Command trên code cũ: các ca `glob`, `notebook_path` phía Claude và ca `uri`/`source`/argv phía Codex phải đỏ; ghi số ca đỏ vào báo cáo.
3. Viết lib, rút gọn ba hook, shim, installer, manifest, sửa danh sách lib của ba fixture, changelog. **omp:** `src/omp/hooks/privacy-block.cjs` phải bằng hook Claude mới cộng đúng hai chỗ thay của `expectedOverlay` (`omp-hooks.test.js:126-153`): giữ hai khối `permissionDecision: 'ask'` của hook Claude nguyên chữ, nguyên thụt lề (8 và 6 dấu cách), mỗi khối đúng một lần. Đồng bộ `.claude/hooks` (privacy-block + lib) bằng copy.
4. Chạy Command; `pnpm test` ở gốc repo; `cmp` bản `.claude` với nguồn.
5. Commit đúng file Ownership bằng `git commit -m <message> -- <đường dẫn>` (không tên AI, không mã plan, không push).

## Acceptance
- AC-01:
  - mọi ca trong bảng đúng trên cả hai host, kể cả ca thiếu lib;
  - `privacy-block.test.js` và các test trong Command xanh mà không đổi assertion;
  - bảng mẫu nhạy cảm chỉ còn định nghĩa trong `privacy-paths.cjs` (`grep -rln "kubeconfig" packages/spec/src --include='*.cjs'` chỉ trả lib);
  - shim Codex một dòng `require`; `pnpm test` exit 0.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/privacy-paths.test.js packages/spec/src/claude/hooks/__tests__/privacy-block.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/inspect-paths.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/bin/__tests__/grok-envelope.test.js packages/spec/bin/__tests__/hook-payload.test.js packages/spec/bin/__tests__/runtime-dir.test.js`
- Named probe: ca Grep `glob:".env*"` và NotebookEdit `notebook_path:".env"` trên Claude; ca `uri:"file://…/.env"` và argv `bash -lc` trên Codex; ca thiếu lib trên Codex; ca `.env.example` cho qua.
- Reachability: hook chạy bằng `spawnSync(process.execPath, [hook])` với stdin JSON; layout Codex do `install.js` thật tạo ra, nên chứng minh được cả bước chép lib của installer.
- Oracle: exit 0, `# fail 0`, số test lớn hơn số gốc ở Step 1, output có tên test của `privacy-paths.test.js`.
- Counterexample (bản chép tạm, hoàn tác): bỏ `glob` khỏi khoá được quét → ca Grep `glob:".env*"` phải đỏ; đưa `require` của hook Codex ra ngoài `try` → ca thiếu lib phải đỏ.
- Artifacts: không; xoá thư mục cài tạm.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/privacy-paths.test.js packages/spec/src/claude/hooks/__tests__/privacy-block.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/inspect-paths.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/bin/__tests__/grok-envelope.test.js packages/spec/bin/__tests__/hook-payload.test.js packages/spec/bin/__tests__/runtime-dir.test.js
Exit: 0
Base: 31c4eb7e5f8a3eeafacfc199ba2aa94c6931b36b
Head: 861f32eead5c0961d756e68877c9c99d849c179f9cbf838a2db2bbfb2cdce82c
```text
ok 361 - privacy-paths claude: Grep sensitive glob
ok 362 - privacy-paths claude: NotebookEdit sensitive notebook_path
ok 365 - privacy-paths claude: MCP file uri
ok 370 - privacy-paths claude: shell argv bash -lc
ok 374 - privacy-paths claude: Read exempt .env.example
ok 378 - privacy-paths codex: Grep sensitive glob
ok 379 - privacy-paths codex: NotebookEdit sensitive notebook_path
ok 382 - privacy-paths codex: MCP file uri
ok 387 - privacy-paths codex: shell argv bash -lc
ok 391 - privacy-paths codex: Read exempt .env.example
ok 394 - privacy-paths codex: missing shared lib denies even Bash ls
# tests 488
# suites 0
# pass 488
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 41780.382208
```

Đỏ trước khi sửa: 16 ca mới fail trên code cũ (báo cáo Codex). Gốc 453 test → 488. pnpm test exit 0 (PASS: 1680 tests executed). cmp bản .claude với nguồn: khớp. grep kubeconfig chỉ trả privacy-paths.cjs. Counterexample: bỏ glob → 2 fail; require ngoài try → 1 fail (đã hoàn tác). Review code-auditor: PASS, 4 Low (chặn nhầm nội dung MCP chứa chữ khớp mẫu; URI %XX; argv $1; command không phải chuỗi che cmd). Commit 31c4eb7e.
