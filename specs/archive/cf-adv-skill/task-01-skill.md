# Task 01 — Skill `adv` + đăng ký + test

Status: done

## Outcome
`/cf:adv` cài được cho Claude và Codex, với quy trình và cờ theo D-01/D-02 (trừ phần relay `--agent`, thuộc task-02).

## Scope
- In: `skills/adv/SKILL.md`, `skills/adv/references/optional-modes.md` (`--html`, `--md`, `--github`; mục `--agent` chỉ có tiêu đề và câu "xem agent `advisor`" để task-02 viết), `skills/adv/references/ultra-mode.md`, thêm `adv` vào `skills.required`, test `adv-skill.test.js` cho skill theo D-05.
- Out: agent `advisor` và relay (task-02); plugin (task-03); các mục Out of scope của `plan.md`.

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/src/claude/skills/adv/SKILL.md`, `packages/spec/src/claude/skills/adv/references/optional-modes.md`, `packages/spec/src/claude/skills/adv/references/ultra-mode.md`, `packages/spec/bin/__tests__/adv-skill.test.js`
- Modify: `packages/spec/src/claude/migration-manifest.json` (chỉ dòng `"adv",` trong `skills.required`), `packages/spec/bin/__tests__/claude-plugin-build.test.js` (chỉ số skill 15 → 16 ở tên test và assert)
- Read: `~/Desktop/cfk-ref/.claude/skills/ak-advise/**`, `~/Desktop/cfk-ref/.claude/skills/ak-brainstorm/references/ultra-verifier-mode.md`, `packages/spec/bin/__tests__/ui-ux-skill.test.js`, `packages/spec/src/claude/skills/brainstorm/SKILL.md`, `packages/spec/src/claude/agents/{ui-ux-designer,docs-keeper,brainstormer,strategist}.md`, `packages/spec/bin/lib/codex-install.js`

## Steps
1. Chạy Verification Plan trước khi sửa; phải đỏ (`adv-skill.test.js` chưa có nên `node --test` đầu lệnh thoát khác 0).
2. Viết SKILL.md và hai reference theo D-01/D-02; thêm `adv` vào manifest.
3. Viết test theo D-05, phần skill: cổng một câu hỏi; reframe gồm Done means; preview Mermaid + mockup ghi là trạng thái giả định; chín mục lời khuyên và handoff brief với điều kiện dừng hẹp; chỉ ghi report/preview, không implement; bỏ qua lệnh nhúng trong URL; `--yagni` mặc định tắt; dòng phân ranh adv/brainstorm/ask; `--html` có nhánh thiếu agent và cấm tài nguyên mạng; `--github` hỏi xác nhận trước khi chạy `gh`; ultra-mode có đủ các luật ở D-02 (một lần phỏng vấn, năm ứng viên `brainstormer`, ẩn danh, cổng năm ứng viên + một lần dispatch lại, dừng cứng khi không chạy song song được, rubric, bác cả thì dừng cứng, xung đột `--agent`); không còn chuỗi cấm (kể cả `fable`, "Claude Code", đường dẫn `.claude/(skills|references|scripts|rules)/`); tên agent phân giải được (miễn đúng một tên `advisor`, ghi rõ miễn trừ này trong test) và link phân giải được; cài vào dự án tạm `--platform claude,codex --yes` thì skill và reference có ở cả hai runtime, link phân giải được ở bản cài; bản Codex của skill không khớp `/fable/i` và không có "chỉ chạy trên Codex CLI".
4. Chạy Verification Plan; phải xanh. Kiểm phản ví dụ trên bản sao: chép cả `packages/spec` sang thư mục tạm (chép thật, không symlink), xoá `"adv",` khỏi manifest bản sao, chạy test cài đặt của bản sao → phải hỏng.

## Acceptance
- AC-01: Command thoát 0; mỗi mệnh đề ở Step 3 có ít nhất một ca; phản ví dụ Step 4 hỏng như dự kiến.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/adv-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: `adv-skill.test.js`.
- Reachability: installer đọc `skills.required` (`packages/spec/bin/lib/context.js` `loadClaudeMigrationManifest`); ca cài đặt kiểm file đích thật ở `.claude/skills/adv/` và `.agents/skills/adv/`.
- Oracle: thoát 0; `adv-skill.test.js` chạy riêng báo `pass` > 0 và `fail 0`; self-test PASS không giảm (2322).
- Counterexample: bản sao `packages/spec` không có `"adv",` trong manifest thì ca cài đặt hỏng.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/adv-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: afa2276502b31a89e885dddbcf3b71904310dd19
Head: ecc8da6d60d888d9db4c45279a3a2045d90e5c0f5a2210dee916f247ed121999
```text
$ node --test packages/spec/bin/__tests__/adv-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261022-adv-task01.log (1965 dòng): tổng của từng đoạn node --test (adv-skill; package-inventory + codex-native), tổng Node tests bên trong self-test, và dòng PASS của self-test
ℹ tests 26
ℹ pass 26
ℹ fail 0
ℹ tests 62
ℹ pass 62
ℹ fail 0
ℹ tests 1196
ℹ pass 1196
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2348 tests executed
Exit: 0
```
Trước sửa: Command thoát 1 (`adv-skill.test.js` chưa có). Lần chạy giữa chừng thoát 1 ở self-test vì `claude-plugin-build.test.js` ghim 15 skill; Bro chọn dời dòng số skill về task này (15 → 16, Review log). Phản ví dụ (bản sao thật `packages/spec` kèm `node_modules`, bỏ `"adv",` khỏi manifest): `adv-skill.test.js` pass 21, fail 3 (manifest, cài đặt, bản Codex). Review: code-auditor PASS; hai Low đã áp (hai câu của bản gốc ở bước 4 và 5, ca test cho mệnh đề credentials), rồi chạy lại cả Command (`plans/20261022-adv-task01-r1.log` là lần trước, PASS 2346).
