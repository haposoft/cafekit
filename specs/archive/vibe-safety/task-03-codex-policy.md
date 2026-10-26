# Task 03 — Codex: skill chỉ-gọi-tên có `agents/openai.yaml` chặn gọi ngầm, và vắng khỏi danh mục

Status: done

## Outcome
Sau khi cài cho Codex, mỗi skill nguồn có `disable-model-invocation: true` (hiện `vibe`, `adv`) có `.agents/skills/<tên>/agents/openai.yaml` đúng nội dung D-02, được ghi qua đường ghi có sở hữu nên nâng cấp và gỡ không để rác; skill không có key thì không có file; `generate-skill-catalog.cjs` không liệt kê skill có key.

## Scope
- In: sinh file khi cài/nâng cấp Codex; xoá khi key bị bỏ (hash khớp); lọc danh mục; test.
- Out: Claude (host đã tôn trọng key); omp (giới hạn ghi ở GATE-DONE); `policy.products`; skill `merge-pr` chỉ-gọi-tên theo mode (giới hạn ghi ở GATE-DONE).

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/bin/phases/copy-payload.js` (`:116-138`), `packages/spec/bin/lib/managed-writer.js` (`:45-53`, thêm đường ghi nội dung sinh ra nếu cần), `packages/spec/src/claude/scripts/generate-skill-catalog.cjs` (`:162-173`)
- Create: `packages/spec/bin/__tests__/codex-implicit-policy.test.js`
- Read: `packages/spec/bin/phases/skill-inventory.js:21-59`, `packages/spec/bin/lib/codex-install.js`, `packages/spec/bin/__tests__/{codex-native,codex-projection-parity,installer-safety,package-inventory}.test.js`

## Steps
1. Viết `codex-implicit-policy.test.js` trước: cài `--platform codex --yes` vào dự án tạm → `.agents/skills/vibe/agents/openai.yaml` và `.agents/skills/adv/agents/openai.yaml` có đúng `policy:\n  allow_implicit_invocation: false\n`, skill khác không có file; file được ghi trong manifest sở hữu; cài lại không đổi byte (`unchanged`); trên bản sao nguồn bỏ key của `adv` rồi cài lại → file `adv` bị xoá; người dùng sửa file thì nâng cấp giữ (`preserved`) như file sở hữu khác; `removeSkill` gỡ cả cây (kể cả `agents/openai.yaml`); `--platform claude` không sinh file; `generate-skill-catalog.cjs --skills` trên `.agents/skills` không có `cf-vibe`/`cf-adv`, vẫn có skill khác; cùng lệnh trên `.claude/skills` của bản cài Claude cũng không có `cf:vibe`/`cf:adv`.
2. Chạy Verification Plan; phải đỏ.
3. Sửa installer và catalog.
4. Chạy Verification Plan; phải xanh.

## Acceptance
- AC-02: Command thoát 0; mỗi mệnh đề Step 1 có ca; self-test PASS ≥ 2458.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-implicit-policy.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: `codex-implicit-policy.test.js`.
- Reachability: `install.js --platform codex` → `copy-payload.js` ghi `.agents/skills`; Codex đọc `agents/openai.yaml` cạnh `SKILL.md` (`metadata.rs:53-57`); `AGENTS.md` bảo Codex chạy catalog.
- Oracle: `fail 0`, self-test `PASS` ≥ 2458.
- Counterexample: trên bản sao `spec-copy`, bỏ nhánh sinh file thì ca nội dung hỏng; bỏ bộ lọc catalog thì ca danh mục hỏng.
- Artifacts: none (dự án tạm xoá sau test).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/codex-implicit-policy.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: 0f1b868b2f77f0924bb18454b3545e1aa6ff64fa
Head: af28350e4c234dad521906e648f6fe70d11be361594d831e54ed6ac70ff90908
```text
$ node --test packages/spec/bin/__tests__/codex-implicit-policy.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/installer-safety.test.js packages/spec/bin/__tests__/package-inventory.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261023-vibe-safety-task03.log (2152 dòng): tổng của đoạn node --test, tổng Node tests bên trong self-test, và dòng PASS của self-test
ℹ tests 166
ℹ pass 166
ℹ fail 0
ℹ tests 1314
ℹ pass 1314
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2466 tests executed
exit=0
```
Trước sửa nguồn: `codex-implicit-policy.test.js` 8 ca, 5 đỏ. Sửa: `writeManagedFile` nhận `content` (file sinh ra, cùng quyết định sở hữu, không chép bit thực thi); `copy-payload.js` gọi `syncCodexInvocationPolicy` cho mỗi skill khi cài Codex — ghi `agents/openai.yaml` cho skill có `disable-model-invocation: true` (có ngoặc hay không), xoá bản cũ có sở hữu và khớp hash khi key bị bỏ (prune manifest, xoá `agents/` rỗng), giữ bản người dùng tạo hay sửa; catalog bỏ skill chỉ-gọi-tên ở mọi runtime với chẩn đoán `explicit_only`; plugin build lại (`plugins/cf/scripts/generate-skill-catalog.cjs` giống hệt nguồn — nằm trong ownership `plugins/cf/**` của task-02). Ngoài Ownership: `codex-native.test.js:2329` ghim tổng catalog = số skill cài; bắt buộc đổi thành trừ số skill chỉ-gọi-tên (tính từ file đã cài, không yếu đi — reviewer xác nhận). Phản ví dụ trên bản sao thật `/private/tmp/claude-501/-Users-nghialuutrung-Desktop-cafekit/6f6d5ffe-c62e-41e8-85ff-509f9fd60e5e/scratchpad/spec-copy/spec` (trước bản sửa regex có ngoặc, không ảnh hưởng hai phép đột biến này): bỏ lời gọi `syncCodexInvocationPolicy` → pass 4 / fail 4; tắt bộ lọc catalog → pass 7 / fail 1. Review (code-auditor, context mới, có tái hiện installer thật ở scratchpad cho dry-run và xoá bản cũ): PASS; sửa Low #1 (installer nhận `"true"` như parser catalog) rồi review xác nhận lại: PASS. Giới hạn: một skill nguồn tự mang `agents/openai.yaml` sẽ bị ghi đè hoặc xoá (hiện không skill nào có); khối `specs` chép riêng không gọi hàm này (không có key); số đếm tóm tắt không tính lần xoá policy; test chưa có ca `--dry-run`; omp dùng chung `.agents/skills` nhưng không ghi skill (`capabilities.skills: false`), omp có đọc `openai.yaml` không vẫn `[UNVERIFIED]`.
