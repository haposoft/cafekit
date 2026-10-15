# Task 02 — spec-state Claude khớp Codex

Status: done

## Outcome
Tollgate của Claude đọc đúng cấu hình project, không lẫn cache giữa các phiên và nhận packet theo cùng luật với Codex.

## Scope
- In:
  - `spec-state.cjs` Claude dùng `lib/project-root.cjs` (D-01) cho `baseDir` và `runtime.json` (thay `:90,110,119-120`).
  - D-02: chuyển `canonicalTarget`, `packetAt`, `namedPackets` (`src/codex/hooks/lib/spec-session-touch.cjs:15-38,104-126`) và `explicitFailure` mới vào `src/claude/hooks/lib/spec-touch.cjs`; thêm vào `runtime.files` của manifest; Codex require qua shim `src/codex/hooks/lib/spec-touch.cjs`; installer chép lib vào bản Codex (`bin/phases/codex-runtime.js`, như `secret-keywords.cjs`). Codex `successfulMutation` = `!explicitFailure(payload)` + phần cũ; hành vi Codex không đổi.
  - Claude bỏ ghi chạm chỉ khi `explicitFailure`.
  - Claude nhận tên packet bằng `namedPackets` (thay regex `src/claude/hooks/spec-state.cjs:71-79`).
  - Target tường minh dạng path (`explicitPath`, `:122`) được ghi chạm.
  - D-03: cache tollgate theo phiên; fixture `cacheFile` ở `state.test.js:96,117-118,145` và `spec-state-touched.test.js:60,71,96` đổi theo tên mới, giữ nghĩa assertion.
  - Đồng bộ `.claude`; changelog.
- Out: chữ in ra của spec-state (task-09).

## Coverage
- CP-02

## Ownership
- Modify: `src/claude/hooks/spec-state.cjs`, `src/claude/hooks/lib/spec-touch.cjs` (mới), `src/claude/migration-manifest.json`, `src/codex/hooks/lib/spec-session-touch.cjs`, `src/codex/hooks/lib/spec-touch.cjs` (mới, shim), `bin/phases/codex-runtime.js`, `src/claude/hooks/__tests__/spec-state-touched.test.js`, `src/claude/hooks/__tests__/state.test.js` (fixture `cacheFile` và danh sách lib chép ở `:46-51`), `bin/__tests__/codex-hooks.test.js`, `bin/__tests__/codex-quiet-hooks.test.js`, `bin/__tests__/orca-session.test.js` (chỉ fixture chép lib), hai changelog
- Probe tĩnh: `scripts/run-skill-self-tests.mjs:4870-4877` đòi `spec-state.cjs` chứa `realpathSync`; cập nhật nếu chuỗi rời sang lib.
- Sync (gitignored): `../../.claude/hooks/`

## Steps
1. Thêm test vào `spec-state-touched.test.js` (layout `.claude`, env bỏ `CLAUDE_PROJECT_DIR`/`PROJECT_ROOT`):
   - packet đã được phiên chạm, `spec.tollgate:false` ở root, payload `cwd` là thư mục con → không in gì (không có packet đã chạm thì ca này xanh sẵn);
   - PostToolUse Edit có `tool_response: { is_error: true }` → không ghi chạm;
   - PostToolUse Write có `tool_response.content` chứa dòng `Failed x` → vẫn ghi chạm;
   - `paths.specs: "planning"`, packet tên chỉ có chữ thường (ví dụ `auth`), prompt nêu `planning/auth` → nhận packet;
   - payload `specPath` trỏ tới packet → ghi chạm và nhắc;
   - ba lượt A → B → A với cùng state: lượt A thứ hai in dạng gọn `Tollgate active` (hiện in lại khối đầy đủ).
   Chạy Command trước khi sửa; ghi số ca đỏ.
2. Tạo lib, chuyển hàm, sửa Claude spec-state, manifest, installer, shim, fixture; đồng bộ `.claude`; changelog.
3. Chạy Command; `node --test packages/spec/src/claude/hooks/__tests__/state.test.js packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-hooks-ownership.test.js packages/spec/bin/__tests__/codex-quiet-hooks.test.js packages/spec/bin/__tests__/orca-session.test.js packages/spec/bin/__tests__/omp-hooks.test.js`; self-test; `cmp`.
4. Không commit.

## Acceptance
- AC-02: các ca trên đúng; các test ở Step 3 xanh; self-test exit 0.

## Dependencies
- task-01-claude-installed-root.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên mô tả hành vi.
- Reachability: hook chạy bằng `spawnSync` trên layout `.claude`.
- Oracle: exit 0, `# fail 0`.
- Counterexample: trên bản chép tạm, cho cache dùng file chung → ca A → B → A đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js`
Exit: 0
Base: 8c47ff9a210142f706d626f53508ec14d55d661f
Head: 717606b8c0abb2cc45921a02d864a5fba3f1d6b3117385bc7bf1ddc2f13fef58

```text
ok 1 - an untouched packet prints nothing on Claude
ok 2 - a touched packet respects the project tollgate toggle from a nested cwd
ok 3 - an explicitly failed edit does not touch its packet
ok 4 - written content mentioning failure still touches its packet
ok 5 - a configured specs prefix names a plain lowercase packet
ok 6 - an explicit packet path records the session touch
ok 7 - another session does not displace the compact tollgate cache
ok 8 - naming the packet in the prompt touches it and keeps the full block
ok 22 - Claude spec-state uses one snapshot for done task receipts
# tests 22
# pass 22
# fail 0
```

- Đỏ trước sửa (Codex báo, Step 1): 5 đỏ, 17 xanh trên 22.
- Counterexample (Codex báo): cache tollgate dùng file chung → ca A → B → A đỏ; đã hoàn tác, file khớp byte.
- Codex không đổi hành vi (Codex báo): so `successfulMutation` cũ/mới trên 729 input, 0 khác biệt.
- Lệnh phụ (controller chạy): state + codex-hooks + codex-hooks-ownership + codex-quiet-hooks + orca-session + omp-hooks 103 pass, 0 fail.
- Self-test (controller chạy): `PASS: 2085 tests executed`, exit 0; `cmp` `.claude/hooks/spec-state.cjs` và `lib/spec-touch.cjs` khớp nguồn; `git diff --check` sạch.
- Probe tĩnh: nhãn "state cache carries full project, session, and spec identity" thêm `lib/spec-touch.cjs` vào danh sách file, assertion giữ nguyên. Fixture chép lib: `codex-hooks`, `codex-quiet-hooks`, `spec-gate`, `state` thêm `spec-touch.cjs` (và `project-root.cjs` ở `state`).
- Review controller: hàm thuần chuyển nguyên văn từ Codex; Claude bỏ chạm chỉ khi `explicitFailure`; cache theo phiên chỉ khi có bộ lọc chạm (`.claude` + `session_id` thô); installer chép `spec-touch.cjs` cho Codex. Ghi nhận: `packetAt` nay ghi chạm cả file nằm thẳng dưới specs root (như Codex), tên đó không phải packet nên không ảnh hưởng tollgate. Commit 8c47ff9a.
