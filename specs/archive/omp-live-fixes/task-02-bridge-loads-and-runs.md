# Task 02 — Bridge `.js` được nạp và chạy hook bằng node

Status: done

## Outcome
`.omp/extensions/cafekit-bridge.js` được omp 18.12.x tự nạp; hook chạy bằng `node` tuyệt đối ngoài project; thiếu node hoặc hook gating thoát lạ → chặn có lý do; cài đè gỡ `.mjs` cũ chỉ khi khớp hash; trên omp thật `cat .env` bị chặn, `read README.md` thì không.

## Scope
- In: D-01, D-02, D-03; mọi tham chiếu `cafekit-bridge.mjs` (`bin/__tests__/omp-bridge.test.js:17`, `legacy-hooks-retired.test.js:24,73,187,196`, `usage-hook-retired.test.js:21`, `scripts/run-skill-self-tests.mjs:5114`, `docs/installer-architecture.md:80`); doc + changelog.
- Out: touch (task-03), privacy path (task-04).

## Coverage
- CP-02

## Ownership
- Rename: `packages/spec/src/omp/extensions/cafekit-bridge.mjs` → `cafekit-bridge.js`
- Modify: `packages/spec/bin/phases/omp-runtime.js`, `packages/spec/bin/phases/claude-runtime.js` (chỉ nếu cần dùng lại đường gỡ có kiểm hash cho omp), `packages/spec/src/claude/migration-manifest.json` (obsolete), `packages/spec/bin/__tests__/omp-bridge.test.js`, `omp-runtime.test.js`, `legacy-hooks-retired.test.js`, `usage-hook-retired.test.js`, `installer-safety.test.js` (chỉ nếu ca obsolete đặt ở đó), `packages/spec/scripts/run-skill-self-tests.mjs`, `docs/installer-architecture.md`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`

## Steps
1. Test trước:
   - `omp-runtime.test.js`: cài omp vào thư mục tạm có `.omp/extensions/cafekit-bridge.mjs` (a) khớp hash ownership → bị gỡ, chỉ còn `.js`; (b) đã sửa, (c) không có bản ghi, (d) symlink → được giữ và có cảnh báo.
   - `omp-bridge.test.js`: `hookRunner()` (export mới) khi gán `process.versions.bun`: PATH có `node` giả tuyệt đối → trả đường dẫn đó; PATH chỉ có mục tương đối hoặc ứng viên nằm trong project → bỏ qua; không còn ứng viên → `runEvent('tool_call')` chặn với lý do chứa `node`. Hook giả thoát `exit 1` không verdict trên `tool_call` → chặn nêu tên hook (sửa ca crash cũ theo D-03); trên event không gating vẫn bỏ qua. Khôi phục `process.versions.bun` và PATH trong `after`.
   - Chạy Command → ghi số ca đỏ.
2. Đổi tên, `hookRunner`, luật exit D-03, gỡ obsolete có kiểm hash, mục obsolete trong manifest; sửa mọi tham chiếu.
3. Doc + changelog.
4. Chạy Command; rồi phiên omp thật. Không commit.

## Acceptance
- AC-02: ca mới xanh; Command xanh; phiên omp thật: `bash cat .env` trả lý do privacy, `read README.md` trả nội dung.

## Dependencies
- task-01-isolated-hook-state.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/bin/__tests__/legacy-hooks-retired.test.js packages/spec/bin/__tests__/usage-hook-retired.test.js packages/spec/bin/__tests__/installer-safety.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: ca obsolete (a)–(d) trong `omp-runtime.test.js`; ca `hookRunner` và ca exit 1 trong `omp-bridge.test.js`.
- Reachability: source — installer thật trên thư mục tạm; live — `omp -p … --mode json` trong project tạm cài mới, đọc `tool_execution_end`.
- Oracle: live: kết quả `bash` nêu `.env` và không chứa nội dung file; `read` trả nội dung README.
- Counterexample: giữ `.mjs` → omp không nạp, `cat .env` in nội dung; giữ `process.execPath` → mọi tool timeout 8000 ms.
- Artifacts: project tạm `/private/tmp/claude-501/omp-live-*` với `.env` giả, xoá sau khi ghi Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-runtime.test.js packages/spec/bin/__tests__/legacy-hooks-retired.test.js packages/spec/bin/__tests__/usage-hook-retired.test.js packages/spec/bin/__tests__/installer-safety.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: f2cbde5ae16123b9bfda7352e5f1b13c815ed41f
Head: 10c6fbd07a820c9e6bbb9b3b892935b9eb0955facc9c98f88dd67a8d73549541

```text
✔ omp upgrade removes a pristine old .mjs bridge, which omp never loads
✔ omp upgrade keeps an edited, untracked or symlinked old .mjs bridge and says so
✔ a crashing or missing gate blocks on gating events instead of silently allowing
✔ under Bun the hooks run with an absolute node outside the project
✔ without a usable node under Bun a gating event blocks and names node
ℹ tests 101
ℹ pass 101
ℹ fail 0
[skill-test] PASS: 2236 tests executed
```

Live (omp 18.12.3, project tạm `/private/tmp/claude-501/omp-live-t02` cài bằng `node packages/spec/bin/install.js --platform claude,omp --yes`, `omp -p --model google-antigravity/gemini-3.8-flash --mode json`):

```text
cafekit-bridge.js
omp/18.12.3
TOOL bash [{"type":"text","text":"Sensitive file access requires approval: .env"}]
TOOL read [{"type":"text","text":"[README.md#5066]\n1:hello readme"}]
```

- Lệch quy trình: code được sửa trước khi viết test đỏ. Bù bằng bản sao tạm: mã nguồn HEAD (bridge, `omp-runtime.js`, `claude-runtime.js`, manifest) + test mới → 5/5 ca mới đỏ.
- Vòng sửa 1: ca `usage-hook-retired` đỏ khi omp đi qua bộ gỡ kiểm hash cho mọi mục. Vòng sửa 2: `codex-native.test.js:3216` ghim omp giữ chính sách dọn cũ cho hooks/scripts/skills (D-09 cũ chỉ phủ Claude/Codex) → thu hẹp theo đúng G2: chỉ `extensions/` của omp đi qua `removeObsoleteRuntimeFiles`; hooks/scripts/skills omp vẫn qua `removeObsoleteOmpHooks`; hoàn tác thay đổi fixture. Đề xuất gói sau: đưa toàn bộ obsolete omp về kiểm hash.
- Lỗi phụ đã sửa: chuỗi `*/index` trong comment khối kết thúc comment sớm.
- Project tạm có `.env` giả, không chứa secret thật. Không commit.
