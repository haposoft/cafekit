# Task 03 — Touch cho edit nhiều file và ast_edit

Status: done

## Outcome
Sửa file trong packet bằng `edit` (một hoặc nhiều file) hoặc `ast_edit` ghi các packet đó vào touch state của phiên omp.

## Scope
- In: D-04; doc + changelog.
- Out: privacy (task-04); alias `ast_edit`.

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/omp/extensions/cafekit-bridge.js`, `packages/spec/src/claude/hooks/lib/spec-touch.cjs`, `packages/spec/src/claude/hooks/spec-state.cjs`, `packages/spec/bin/__tests__/omp-bridge.test.js`, `packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js`, `docs/installer-architecture.md`, hai changelog

## Steps
1. Test trước trong `omp-bridge.test.js` trên cây `.omp` ghép, envelope theo thăm dò live: (a) `edit` `{input:"[specs/alpha/plan.md#F2E7]…", path, paths:[…]}` một file → touch `alpha`; (b) `paths` hai packet, không có `path` → touch cả hai; (c) `ast_edit` `{ops, paths:['specs/**']}` với `details.fileChanges:[{path:<abs specs/beta/plan.md>}]` → touch `beta`, glob không được ghi; (d) bridge không chuyển `oldText`/`newText` vào payload. Chạy Command → ghi số ca đỏ.
2. Bridge chỉ chuyển `details.fileChanges[].path` (và `details.path`) vào `tool_response`; `spec-touch.cjs` thêm hàm trả danh sách path; `spec-state.cjs` ghi mọi packet. Không thêm `require` mới (luật fixture).
3. Doc + changelog.
4. Chạy Command; rồi phiên omp thật. Không commit.

## Acceptance
- AC-03: ca (a)–(d) xanh; Command xanh; phiên omp thật: edit `specs/alpha/plan.md` → file touch của phiên chứa `alpha`.

## Dependencies
- task-02-bridge-loads-and-runs.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js packages/spec/bin/__tests__/codex-hooks.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: ca (b) và (c) trong `omp-bridge.test.js`.
- Reachability: source — cây `.omp` ghép; live — omp thật, đọc `.omp/hooks/.logs/spec-touched-*.json`.
- Oracle: touch chứa đúng packet.
- Counterexample: chỉ đọc `file_path` → ca (b), (c) đỏ.
- Artifacts: như task-02.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js packages/spec/bin/__tests__/codex-hooks.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: f2cbde5ae16123b9bfda7352e5f1b13c815ed41f
Head: d639ba5d1ad5217945bc408fe74fcf8b6be3b6f296e747ed527be6f84749a453

```text
✔ an omp edit inside a packet scopes the tollgate to it
✔ multi-file edits and ast_edit record every packet they changed
✔ the bridge passes edit result paths but not the file contents
ℹ tests 136
ℹ pass 136
ℹ fail 0
[skill-test] PASS: 2238 tests executed
```

Live (omp 18.12.3, project tạm cài `--platform claude,omp`, `omp -p --model google-antigravity/gemini-3.8-flash --mode json`, prompt sửa `specs/alpha/plan.md`):

```text
SESSION 01a15807-2329-742b-90b0-8bb9ea1cf460
TOOL edit ok
.omp/hooks/.logs/spec-touched-09266bca9beda277a9380decc9814da78809ae3b43a7e618feaca24ca87a6a45.json: ["alpha"]
sha256(session id) = 09266bca9beda277a9380decc9814da78809ae3b43a7e618feaca24ca87a6a45
```

- Đỏ trước sửa: 2 ca mới (multi-file/ast_edit, bridge không chuyển nội dung).
- Ca ngoài phạm vi chập chờn: `codex-hooks.test.js` "parallel Codex privacy blocks preserve both markers and cannot be approved by y" (commit 8e714fe4, gói codex-privacy-approval-ux). Chạy cả file: HEAD sạch fail 2/4, working tree fail 2/4 — có sẵn, không do task. Command fail 2 lượt vì ca này; Bro chọn chạy lại Command; lượt thứ 3 exit 0 (ở trên). Race privacy Codex là việc của gói sau.
- `ast_edit` giữ tên riêng (không alias); glob trong `paths` bị bỏ qua. Không thêm `require` mới. Không commit.
