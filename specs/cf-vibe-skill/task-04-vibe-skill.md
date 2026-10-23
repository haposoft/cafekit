# Task 04 — Skill `vibe` + đăng ký + changelog + test

Status: done

## Outcome
`/cf:vibe` cài được cho Claude và Codex với pipeline, cờ, chốt merge và luật bảo mật theo D-06, mọi chế độ skill nó gọi đều có thật (D-07).

## Scope
- In: `skills/vibe/SKILL.md` và ba reference; `vibe` vào `skills.required`; số skill plugin 16 → 17; dòng `### Added` ở hai changelog; ca test skill trong `vibe-skill.test.js`.
- Out: plugin build (task-05); các mục Out of scope của `plan.md`.

## Coverage
- CP-03

## Ownership
- Create: `packages/spec/src/claude/skills/vibe/SKILL.md`, `packages/spec/src/claude/skills/vibe/references/pipeline-skill-integration.md`, `packages/spec/src/claude/skills/vibe/references/subagent-orchestration.md`, `packages/spec/src/claude/skills/vibe/references/report-templates.md`
- Modify: `packages/spec/bin/__tests__/vibe-skill.test.js` (ca skill), `packages/spec/src/claude/migration-manifest.json` (chỉ dòng `"vibe"`), `packages/spec/bin/__tests__/claude-plugin-build.test.js` (chỉ số skill 16 → 17), `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `~/Desktop/cfk-ref/.claude/skills/ak-vibe/**`, `packages/spec/src/claude/skills/{git,specs,develop,fix,debug,research,code-review,test,adv}/SKILL.md`, `packages/spec/src/claude/skills/adv/references/ultra-mode.md`, `packages/spec/bin/__tests__/adv-skill.test.js`

## Steps
1. Viết ca test trước theo D-06/D-07: mười ba bước đúng thứ tự, mỗi bước gọi đúng skill/agent; worktree từ `origin/<target>`; không làm trên nhánh được bảo vệ; chế độ ship (`--both` > `--beta` > stable) và `--both` theo D-06 (chặng beta từ nhánh tích hợp, chặng stable là PR promote, liệt kê commit, hỏi một câu, beta chưa xanh thì không mở stable); kiểm commit-range trước PR và trước mỗi merge; hỏi trước khi merge vào nhánh release; vòng sửa CI tối đa 3; chạy lại Verification Plan bị ảnh hưởng trước GATE-DONE; `--advice` → `strategist`; `--ultra` chỉ cho plan review và code review; bảo mật V9; báo cáo hoàn thành liệt kê quyết định `delegated`; mỗi `cf:<skill> <mode|flag>` được nhắc có trong usage/argument-hint của skill đó; chuỗi cấm D-07; skill/agent tồn tại; link phân giải; cài hai runtime có skill.
2. Chạy Verification Plan; phải đỏ.
3. Viết skill, reference; thêm manifest; đổi số plugin; thêm changelog.
4. Chạy Verification Plan; phải xanh.

## Acceptance
- AC-04 (phần cài đặt): Command thoát 0; mỗi mệnh đề Step 1 có ca.

## Dependencies
- task-03-code-review-pr-mode.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/vibe-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/vibe-run.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: ca skill trong `vibe-skill.test.js`.
- Reachability: installer đọc `skills.required`.
- Oracle: thoát 0, `fail 0`; self-test PASS không giảm.
- Counterexample: bản sao thật `packages/spec` (kèm `node_modules`) bỏ `"vibe"` khỏi manifest thì ca cài đặt hỏng.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/vibe-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/vibe-run.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: fd08e0b493be715efb41293f6ff6b51120068ec5
Head: 08fa120cf9d5ec802d7e083e57a0eda8acf25d32fe71bffa9acba14b2ab556b4
```text
$ node --test packages/spec/bin/__tests__/vibe-skill.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js packages/spec/bin/__tests__/vibe-run.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261023-vibe-task04.log (2151 dòng): tổng của từng đoạn node --test, tổng Node tests bên trong self-test, và dòng PASS của self-test
ℹ tests 51
ℹ pass 51
ℹ fail 0
ℹ tests 113
ℹ pass 113
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
Exit: 0
```
Trước sửa: `vibe-skill.test.js` 47 ca, 25 đỏ (skill chưa có), Command thoát 1. Phản ví dụ trên bản sao thật `packages/spec` (kèm `node_modules`), bỏ `"vibe"` khỏi manifest: ca manifest và ca cài đặt hai runtime đỏ, `pass 49 / fail 2` (chạy lại ở Head cuối bằng `node --test bin/__tests__/vibe-skill.test.js` trong bản sao `/private/tmp/claude-501/-Users-nghialuutrung-Desktop-cafekit/6f6d5ffe-c62e-41e8-85ff-509f9fd60e5e/scratchpad/spec-copy/spec`). Vòng sửa 1 (review FAIL, High): không mở/link issue ở repo ngoài; quyền khớp câu ngoại lệ, tạo label hỏi một lần; dừng khi `headRefOid` khác HEAD local; packet tái dùng chép vào và commit; `--both` stable đầy đủ; các Low. Vòng sửa 2 (review FAIL, Medium): template báo cáo bỏ follow-up issue; lệch D-04 (PR promote bằng `gh pr create`) ghi vào Review log; gộp câu tái dùng packet (regex test chấp nhận cụm "is reused " chèn vào, cùng nghĩa); bỏ qua label khi đã từ chối. Review lần 3: PASS. Log các lần trước: `plans/20261023-vibe-task04-r1.log`, `-r2.log`. Giới hạn: hành vi sống của pipeline (gh, merge, CI) chưa chạy — `[UNVERIFIED]`, eval với `gh` giả là gói kế tiếp.
