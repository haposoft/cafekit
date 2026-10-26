# Task 02 — Vibe: chỉ Plan và Implement được rút gọn có điều kiện; review, commit và PR luôn qua skill của chúng

Status: done

## Outcome
`vibe/SKILL.md` (nguồn, bản cài Claude và Codex, plugin) theo D-02: Plan (bước 4) và Implement (bước 6) được bỏ chỉ khi luật làm thẳng của Specs cũng cho phép và thay đổi ≤ 2 file, không đụng contract công khai, bảo mật hay dữ liệu; bước 2, 7, 10, 11, 13 gọi skill có tên của chúng mỗi khi bước đó chạy (bước 2 vẫn tái dùng worktree như đã viết, bước 13 chỉ với `--ship`/`--both`); mọi commit đi qua `cf:git commit`; bước có điều kiện giữ predicate; không câu nào nêu tên tool của host. Báo cáo và `report-templates.md:42` có `- Plan: run (<relative path>) | skipped (<reason>)` (thay dòng `- Plan: <relative path>`) và `- Implement: run (cf:develop|cf:fix) | skipped (<reason>)`; khi không có packet, bước 5, 6 và 11 dùng tóm tắt thay đổi và lệnh kiểm thay cho plan link và receipt.

## Scope
- In: một câu (tối đa hai) gần đầu `## Pipeline`; câu disposition ở `SKILL.md:67`; `references/report-templates.md`; test ghim; build plugin.
- Out: đổi thứ tự hay số bước; predicate của bước có điều kiện; `rules/state-sync.md`; rule chung.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/vibe/SKILL.md`, `packages/spec/src/claude/skills/vibe/references/report-templates.md`, `packages/spec/bin/__tests__/vibe-skill.test.js`, `plugins/cf/skills/vibe/**` (do `build-claude-plugin.mjs` sinh)
- Read: `packages/spec/bin/lib/codex-install.js:43-56,292-300` (tool và tên skill trên Codex), `packages/spec/bin/__tests__/vibe-skill.test.js:153-160,404-424,430-438,452` (steps(), chế độ skill, từ cấm — "lane" ở `:435`, giới hạn dòng), `packages/spec/bin/__tests__/vibe-run.test.js:85,96-105` (7 `GATE_PATTERNS`: new explicit, user decides, Ask the user before committing, no route expands, three human gates, user chooses, ask the user at GATE), `packages/spec/src/claude/skills/specs/SKILL.md:17-23`

## Steps
1. Sửa test trước: ghim câu D-02 trong nguồn và trong bản cài Codex (tên `cf-…`); câu nêu đủ: chỉ Plan và Implement, điều kiện cộng thêm vào luật làm thẳng của Specs, ≤ 2 file, không contract/bảo mật/dữ liệu, bước 2/7/10/11/13 gọi skill mỗi khi chạy (kèm hai ngoại lệ đã viết), mọi commit qua `cf:git commit`; cấm cụm "Skill tool" trong `vibe/SKILL.md` và references; báo cáo và template có `- Plan: run (…) | skipped (…)` thay dòng cũ và `- Implement: …`, không còn dòng `- Plan: <relative path>`; câu nói bước 5/6/11 khi không có packet.
2. Chạy Verification Plan; phải đỏ.
3. Sửa `SKILL.md` và `report-templates.md`; `node packages/spec/scripts/build-claude-plugin.mjs`.
4. Chạy Verification Plan; phải xanh; `vibe/SKILL.md` không quá 70 dòng; không cụm nào trong 7 `GATE_PATTERNS`.

## Acceptance
- AC-02: Command thoát 0; self-test PASS ≥ 2466.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: `vibe-skill.test.js` (câu mới, bản cài Claude và Codex, template), `build-claude-plugin.mjs --check` (plugin đã commit khớp nguồn).
- Reachability: installer chép skill cho Claude và Codex; plugin build từ nguồn; `scaffold.sh:65` cài từ nguồn hiện tại vào phòng thử của task-03.
- Oracle: `fail 0`, `--check` thoát 0, self-test `PASS` ≥ 2466.
- Counterexample: trên bản sao `spec-copy`, bỏ vế "bước 2, 7, 10, 11, 13 gọi skill mỗi khi chạy" thì `vibe-skill.test.js` đỏ.
- Artifacts: `plugins/cf/skills/vibe/**` sinh lại.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: b6d8988827e59241b623276d4b915aab449e6ece
Head: 80afae99fec01bd9abc518b68f34e2cc8fdeaeaf89fcb31dd85cc584c97dd442
```text
$ node --test packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261026-vibe-pipeline-task02.log (2103 dòng): tổng đoạn node --test, dòng --check, tổng Node tests trong self-test, dòng PASS
ℹ tests 106
ℹ pass 106
ℹ fail 0
plugin tree matches a fresh build: /Users/nghialuutrung/Desktop/cafekit/plugins/cf
ℹ tests 1324
ℹ pass 1324
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2476 tests executed
exit=0
```
Trước sửa nguồn: 4 ca mới trong `vibe-skill.test.js` đỏ (51/55). Sửa: đoạn mới đầu `## Pipeline` của `vibe/SKILL.md` (mỗi bước chạy gọi skill có tên — bước 2/7/10/11/13 kèm hai ngoại lệ, mọi commit qua `cf:git commit`, bước có điều kiện giữ predicate; chỉ Plan và Implement được bỏ, cộng thêm vào luật làm thẳng của Specs, ≤ 2 file, không contract/bảo mật/dữ liệu, báo `Plan|Implement: skipped (<reason>)`, bước 5/6/11 khi không có packet), câu disposition trong Completion report, `report-templates.md:42-43`; cấm cụm "Skill tool"; plugin build lại (2 file vibe). `SKILL.md` 69 dòng. Phản ví dụ trên bản sao `/private/tmp/claude-501/-Users-nghialuutrung-Desktop-cafekit/6f6d5ffe-c62e-41e8-85ff-509f9fd60e5e/scratchpad/spec-copy/spec` bỏ câu "Each step that runs invokes its named skill…": `vibe-skill.test.js` pass 53 / fail 2. Review (code-auditor): PASS, 5 Low. Self-test chạy trên cây có cả thay đổi chưa commit của gói song song `codex-plugin` (`codex-runtime.js`, `copy-payload.js`, `build-claude-plugin.mjs`). Giới hạn: template issue body (`report-templates.md:16,28`) chưa có nhánh không packet; bỏ bước 6 có thể bỏ luôn việc chuyển nhãn "in progress"; `rules/state-sync.md` "Receipts stay mandatory" vẫn giả định có packet (ngoài phạm vi); đoạn tóm tắt không nhắc lại `--fix --reply`/`--base` (thân bước 10/11 có đủ); test ghim câu gần nguyên văn.
