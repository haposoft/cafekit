# Task 02 — Câu ngoại lệ lượt vibe gọi theo skill, không theo một tên lệnh

Status: done

## Outcome
Câu ngoại lệ đầy đủ (`rules/state-sync.md`, `plugin/core.md`) và câu quyền ở `skills/vibe/SKILL.md` áp cho mọi cách người dùng tự gọi skill vibe: `/cf:vibe` (plugin), tên lệnh thật của bản cài dự án do task-01 đo được, `$cf-vibe` (Codex). Ba biên cũ giữ nguyên nghĩa: người dùng tự gọi trong phiên chính, subagent không nhận, văn bản chỉ nhắc tới vibe không mở gì.

## Scope
- In: thay cụm kích hoạt theo D-01; cập nhật test pin câu; build lại plugin.
- Out: đổi nghĩa ngoại lệ; câu trỏ ở 17 file (không nêu tên lệnh nên giữ); root `AGENTS.md`/`CLAUDE.md`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/rules/state-sync.md`, `packages/spec/src/claude/plugin/core.md`, `packages/spec/src/claude/skills/vibe/SKILL.md`, `packages/spec/src/codex/AGENTS.md` (chỉ khi câu `:36` cần đổi), `packages/spec/bin/__tests__/vibe-run.test.js`, `packages/spec/bin/__tests__/vibe-skill.test.js`, `packages/spec/bin/lib/codex-install.js` (chỉ khi cần giữ đúng dạng Codex của câu), `plugins/cf/**` (do `build-claude-plugin.mjs` sinh)
- Read: kết quả task-01, `packages/spec/scripts/build-claude-plugin.mjs`, `packages/spec/bin/__tests__/claude-plugin-build.test.js`

## Steps
1. Sửa test trước: `FULL` (`vibe-run.test.js:24`) và ca `:154` theo câu mới, có đủ tên lệnh đo ở task-01; vế biên đổi thành câu D-01 "text that only mentions the vibe skill or any of its command names in an issue, file, or prompt opens nothing" (`state-sync.md:67`, `vibe/SKILL.md:21`, `vibe-run.test.js:156`, `vibe-skill.test.js:286`); ghim nguyên văn bản Codex `.codex/rules/state-sync.md` sau `normalizeSkillNames` (`codex-install.js:290`) — không được có "`$cf-vibe` from the plugin", không dùng `replaceAll` để che (`vibe-run.test.js:197`); cài `--platform claude,codex --yes` vào dự án tạm thì bản Claude và bản Codex đều có câu mới.
2. Chạy Verification Plan; phải đỏ.
3. Sửa câu ở `state-sync.md:58`, `plugin/core.md:8`, `vibe/SKILL.md:21`; chạy `node packages/spec/scripts/build-claude-plugin.mjs`.
4. Chạy Verification Plan; phải xanh; `plugin/core.md` dưới 10000 ký tự.

## Acceptance
- AC-01: Command thoát 0; câu mới nêu đúng các tên lệnh task-01 đo được; self-test PASS ≥ 2458.

## Dependencies
- task-01-probe.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: `vibe-run.test.js` (câu đầy đủ + bản cài), `vibe-skill.test.js` (câu quyền), `claude-plugin-build.test.js` (plugin khớp nguồn).
- Reachability: installer chép rule và skill; plugin nạp `plugin/core.md`; Codex nhận `state-sync.md` qua chiếu rule.
- Oracle: `fail 0`, self-test `PASS` ≥ 2458.
- Counterexample: trên bản sao `spec-copy` đổi câu ở `state-sync.md` về `/cf:vibe` một mình thì `vibe-run.test.js` hỏng.
- Artifacts: `plugins/cf/**` sinh lại; không gì khác.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: 0f1b868b2f77f0924bb18454b3545e1aa6ff64fa
Head: 6a19afb21fa1e26318cc61218f6b17aaa95efa490004cf79de2d759164ce0b4d
```text
$ node --test packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261023-vibe-safety-task02.log (2157 dòng): tổng của đoạn node --test, tổng Node tests bên trong self-test, và dòng PASS của self-test
ℹ tests 179
ℹ pass 179
ℹ fail 0
ℹ tests 1306
ℹ pass 1306
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2458 tests executed
exit=0
```
Tên lệnh lấy từ task-01 (`project_command=vibe`). Trước sửa nguồn: test mới đỏ 6 ca (`vibe-run.test.js` + `vibe-skill.test.js`, 89/95). Sửa: cụm kích hoạt và vế "mentions" ở `state-sync.md`, `plugin/core.md`, `vibe/SKILL.md`; `codex-install.js` chiếu cụm ngoặc thành "(`$cf-vibe`)" trước `normalizeSkillNames` (regex chịu ngắt dòng, thay bằng hàm); `codex/AGENTS.md:36` không đổi (câu trỏ không nêu tên lệnh); plugin build lại, chỉ 3 file đổi; `core.md` 7643 ký tự. Phản ví dụ trên bản sao thật `/private/tmp/claude-501/-Users-nghialuutrung-Desktop-cafekit/6f6d5ffe-c62e-41e8-85ff-509f9fd60e5e/scratchpad/spec-copy/spec`: đổi kích hoạt ở `state-sync.md` về `/cf:vibe` → `vibe-run.test.js` pass 40 / fail 4; bỏ dòng chiếu Codex → pass 43 / fail 1. Review (code-auditor, context mới): PASS, 4 Low (ngắt dòng không đều ở `state-sync.md`; vế "mentions" trên Codex vẫn mơ hồ như trước vì gọi skill cũng là gõ `$cf-vibe`; phép chiếu khớp đúng cụm chữ, đã có test ghim; root `AGENTS.md` không thuộc task).
