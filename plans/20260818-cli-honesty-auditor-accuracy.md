# CLI honesty & auditor-doc accuracy (dogfood quy trình process-first)

> Chạy theo bộ quy trình mới `plans/20260818-skill-specs-lean-draft.md`. Đây là feature dogfood đầu tiên.

## Quyết định scope (C1 — 2026-08-18)

- **Đã có sẵn:** 7/10 finding audit 14/08 đã vá (F-01→F-05 gồm cả 2 High). Còn F-07 (fail-open có chủ đích, để riêng), F-08, F-10.
- **Tối thiểu:** F-08 (`spec-scaffold.cjs` không nhận `--help`/`--version`; verify runtime: `node spec-scaffold.cjs --help` → `precondition: feature must be one safe path segment...` trên **stderr**, **exit=2**) + F-10 (`code-auditor.md:56,153`).
- **User chọn:** GIỮ — F-08 + F-10, không mở rộng F-07.
- **Điều chỉnh sau C2 (2026-08-18):** cắt Task 02 (F-10) — xem "Ngoài phạm vi". Scope thực thi còn Task 01.

## Ngoài phạm vi

- **F-10 / Task 02 — cắt tại C2.** Reviewer lật ngược tiền đề: dòng 153 chỉ kích hoạt khi helper *trả về* lexical path, mà `commitChanges` trả **void** (`spec-scaffold.cjs:1762-1821`) → rủi ro false-positive gần như không có. Cách sửa "hiển nhiên" (xóa yêu cầu realpath) lại **hạ chuẩn security** cho mọi helper tương lai *có* trả path. Chi phí thật gấp ba ước tính (sửa nguồn + chạy lại installer vì `.claude/agents/` là bản copy do `copy-payload.js:159-176` sinh, drift 7 ngày + verify runtime). Giá trị thấp / rủi ro cao / chi phí cao → cắt. Nếu sau này cần: đổi câu thành **có điều kiện** ("*nếu* helper trả path thì path phải là canonical realpath"), không xóa trắng.
- F-07 docs-sync fail-open — cần quyết định thiết kế trước; không đụng.
- F-06/F-09 test-fidelity — Low, chưa verify sâu; không đụng.
- `packages/spec/.opencode/agents/code-auditor.md` — artifact riêng đã cũ (rubric 10-point khác hẳn), không nằm đường sinh của `.claude/`; không đụng.
- Mọi WIP semantic-kernel khác đang trên branch — không đụng.

## Task

| # | Task | Owner file chính | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 01 | Scaffold nhận `--help`/`--version` | `packages/spec/src/claude/scripts/spec-scaffold.cjs` | - | **done** (evidence dưới) |
| ~~02~~ | ~~Sửa auditor-doc~~ | — | — | **cắt tại C2** |

---

## Task 01 — `spec-scaffold.cjs` nhận `--help`/`--version`, exit 0

### Scope
- Trong: khi argv chứa `--help`/`-h` → in usage ra **stdout** (`console.log`), exit 0. Khi chứa `--version`/`-v` → in version, exit 0. Cả hai xử **trước** mọi precondition, không coi `--help` là feature name.
- Ngoài: không đổi bất kỳ flag chức năng nào; **giữ nguyên `usage()` in ra stderr** cho nhánh no-arg-error (quy ước usage-as-error) — H1.

### File
- Sửa: `packages/spec/src/claude/scripts/spec-scaffold.cjs` (chuỗi usage tách thành `USAGE_TEXT`; thêm `readVersion()` + `respondToInfoFlags()` trước `main()`)
- Thêm test: `packages/spec/bin/__tests__/specs-v2-policy-and-scaffold.test.js`
- Đọc lúc chạy: `<adapter>/cafekit.json` (runtime đã cài) hoặc `packages/spec/package.json` (source tree)

### Anchors
- Chèn `respondToInfoFlags(process.argv)` làm dòng đầu `main()`, trước `recoverTransactions` và mọi precondition.
- Version đọc bằng `fs.readFileSync` (**không `require`** — xem "Phát sinh khi thực thi"), thử `../cafekit.json` rồi `../../../package.json`, fallback `'unknown'`.

### Acceptance
- `node spec-scaffold.cjs --help` → **stdout** không rỗng (chứa "Usage:"), exit 0, stderr rỗng.
- `node spec-scaffold.cjs --version` → stdout là version hợp lệ **có chấp nhận prerelease** (hiện `0.16.0-rc.4`) — L2, exit 0.
- `node spec-scaffold.cjs` (không arg) → giữ nguyên: usage ra **stderr**, exit **2**.
- Scaffold một feature thật vẫn chạy như trước (không regression); suite `pnpm -C packages/spec test` xanh.

### Evidence (chạy 2026-08-18)

```
$ node packages/spec/src/claude/scripts/spec-scaffold.cjs --help
Usage: node spec-scaffold.cjs <feature> [--sync-semantic-model] [--tasks ...
stderr: ''
Exit: 0

$ node packages/spec/src/claude/scripts/spec-scaffold.cjs --version
0.16.0-rc.4
stderr: ''
Exit: 0

$ node packages/spec/src/claude/scripts/spec-scaffold.cjs        # no-arg giữ nguyên
stdout: ''
stderr: Usage: node spec-scaffold.cjs ...
Exit: 2

$ node --test packages/spec/bin/__tests__/specs-v2-policy-and-scaffold.test.js
✔ --help and --version answer on stdout before any precondition runs (355ms)
tests 17 | pass 17 | fail 0

$ pnpm -C packages/spec test
[skill-test] PASS: 701 tests executed
Exit: 0
```

Result: **PASS** — 4/4 acceptance đạt; `-h`/`-v` alias cũng exit 0; info flag không chạm work tree (test khẳng định `readdirSync(root)` rỗng); suite 700 → 701 test, không regression.

### Phát sinh khi thực thi (bằng chứng runtime — luật B4)
`require('../../../package.json')` **phá runtime dependency closure**: file nằm ngoài source root `src/claude` nên `copyCommonJsDependencyClosure` ném `runtime dependency escapes source root`, làm đỏ 2 test (`validator-grounding.test.js:1097,1166`). Nghĩa là bản cài sẽ không có nguồn version. Sửa: đọc bằng `fs.readFileSync` (không `require`) với 2 ứng viên — `<adapter>/cafekit.json` cho runtime đã cài, `packages/spec/package.json` cho source tree — fallback `'unknown'`. Không reviewer nào bắt được ở C2 vì chỉ lộ khi chạy thật.

---

## Review log

### Vòng 1 (2026-08-18) — reviewer fresh-context, vai Fact Checker
7 findings, user nhận cả 7. Verdict reviewer: FAIL (không cho plan vào thực thi as-is).

| # | Sev | Finding | Xử lý |
|---|---|---|---|
| H1 | High | `usage()` in **stderr** (`:133 console.error`) nhưng acceptance đòi stdout → làm đúng plan sẽ FAIL | Sửa scope: help dùng `console.log` riêng, giữ `usage()` stderr cho no-arg-error |
| H2 | High | Xóa yêu cầu realpath khỏi rubric chung = hạ chuẩn security mọi helper tương lai | Cắt Task 02 (xem Ngoài phạm vi) |
| H3 | High | `.claude/agents/` là bản copy installer sinh, drift 7 ngày — sửa nguồn không chạm runtime; Evidence không chứng minh được | Cắt Task 02; ghi rõ cơ chế `copy-payload.js:159-176` |
| M1 | Med | Bảng task ghi sai owner path (`skills/specs/...` không tồn tại) | Sửa bảng |
| M2 | Med | Baseline sai: `--help` thật cho **exit=2**, message ở stderr (plan ghi exit 0) | Sửa mục C1 |
| L1 | Low | Citation `:1641` là nhánh rollback; rename commit thật ở `:1778/:1801` | Ghi nhận trong lý do cắt |
| L2 | Low | Version `0.16.0-rc.4` — regex SemVer phải nhận prerelease | Sửa acceptance |

Reviewer xác nhận đúng: tiền đề "scaffold không trả realpath" (`commitChanges:1762-1821` trả void), version path 3 cấp `../`, anchor `parseArgs:201`/`main:2005`/`usage:132`. Không bịa finding cho đủ số.

**Sweep sau sửa (B3):** đọc lại toàn file; delta = {help→stdout, cắt Task 02, baseline exit 2, SemVer prerelease, owner path}; đã reconcile mục C1, Ngoài phạm vi, bảng Task, Scope/Anchors/Acceptance/Evidence Task 01. Còn mâu thuẫn: 0.
