# Task 04 — Privacy omp: MV/rename, sloppy, read selector, eval

Status: done

## Outcome
Privacy chặn: `edit` di chuyển/đổi tên tới file bảo vệ (hashline `MV`, patch `edits[].rename`), sloppy `*** Edit File:` tới file nhạy cảm, `edit` có input chuỗi mà không rút được path, `read` dùng selector (`.env:raw`, `.env:1-50`), và `eval` có `code` nhắc tên file nhạy cảm.

## Scope
- In: D-05, D-06; doc (giới hạn `vibe_spawn`, `lsp` rename, tool trong `eval`) + changelog.
- Out: mở rộng glob; Claude/Codex không đổi hành vi ngoài các path mới được kiểm thêm.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/claude/hooks/lib/privacy-paths.cjs`, `packages/spec/bin/__tests__/omp-hooks.test.js`, `packages/spec/src/claude/hooks/__tests__/privacy-block.test.js`, `docs/installer-architecture.md`, hai changelog

## Steps
1. Test trước trên fork omp (`omp-hooks.test.js`, payload theo envelope live): `edit` `{input:"[notes.md#ABCD]\nMV .env", path:"notes.md"}` → deny; `edit` `{path:"notes.md", edits:[{op:"update", rename:".omp/runtime.json"}]}` → deny; `edit` `{input:"*** Edit File: .env\n…"}` → deny; `edit` `{input:"garbage"}` → deny; `read {path:".env:raw"}`, `{path:".env:1-50"}` → deny; `read {path:"README.md:1-5"}` → cho qua; `eval {language:"python", code:"print(open('.env').read())"}` → deny; `eval {code:"print(1)"}` → cho qua. Thêm một ca Claude `Read` với path thường vẫn cho qua (`privacy-block.test.js`). Chạy Command → ghi số ca đỏ.
2. Sửa `privacy-paths.cjs` theo D-05, D-06. Không thêm `require` mới.
3. Doc + changelog.
4. Chạy Command; rồi phiên omp thật (`read .env:raw` và `eval` đọc `.env` bị chặn). Không commit.

## Acceptance
- AC-04: ca mới xanh; Command xanh; phiên omp thật chặn hai ca trên.

## Dependencies
- task-03-edit-touch-paths.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/src/claude/hooks/__tests__/privacy-block.test.js packages/spec/bin/__tests__/codex-hooks.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các ca MV, rename, sloppy, selector, eval trong `omp-hooks.test.js`.
- Reachability: source — fork omp trên cây cài; live — omp thật như task-02.
- Oracle: deny nêu `.env` / `runtime.json`; ca hợp lệ cho qua.
- Counterexample: bỏ bước bỏ hậu tố selector → ca `.env:raw` đỏ; bỏ quét `code` → ca eval đỏ.
- Artifacts: như task-02.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/src/claude/hooks/__tests__/privacy-block.test.js packages/spec/bin/__tests__/codex-hooks.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: f2cbde5ae16123b9bfda7352e5f1b13c815ed41f
Head: 64081914b62cf3038b1b143a906d6717f5784ed299046f69e323f82cc85a1202

```text
✔ omp edits that move, rename or hide their target cannot reach a protected file
✔ omp read selectors and eval code cannot reach a secret file
✔ a Claude Read of an ordinary path is not affected by omp selector handling
ℹ tests 210
ℹ pass 210
ℹ fail 0
[skill-test] PASS: 2241 tests executed
```

Live (omp 18.12.3, project tạm cài `--platform claude,omp`, `.env` giả, `omp -p --model google-antigravity/gemini-3.8-flash --mode json`):

```text
CALL read {"path":".env:raw"}
RESULT read [{"type":"text","text":"Sensitive file access requires approval: .env"}]
CALL eval {"language":"py","code":"print(open('.env').read())"}
RESULT eval [{"type":"text","text":"Sensitive file access requires approval: .env"}]
```

- Đỏ trước sửa: 2 ca mới trong `omp-hooks.test.js` (lần đầu hỏng ở `hashline MV`).
- Ca Codex chập chờn có sẵn (`parallel Codex privacy blocks…`) làm lượt Command đầu exit 1; đo lại sau khi sửa lib dùng chung: fail 2/6 lượt chạy cả file, tương đương mốc HEAD sạch 2/4; ca này chạy hai tiến trình privacy Codex song song, không đi qua đường `edit`/`eval`. Theo quyết định của Bro, chạy lại Command → exit 0 (ở trên).
- `rename` thêm vào khoá path chung (Claude/Codex chỉ kiểm thêm path). `edit` không rút được file → ném lỗi → privacy trả deny `Sensitive access could not be evaluated safely`. Không thêm `require` mới. Không commit.
