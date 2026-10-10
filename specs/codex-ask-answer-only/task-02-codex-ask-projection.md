# Task 02 — Phần chiếu Codex của ask chặn sửa file khi người dùng đòi sửa

Status: done

## Outcome
Khi bộ cài chiếu skill `ask` sang Codex, bản chiếu `.agents/skills/ask/SKILL.md` vẫn bắt đầu bằng frontmatter `name: cf-ask`, và ngay sau frontmatter có một chỉ dẫn chỉ dành cho Codex: kể cả khi người dùng yêu cầu sửa, không sửa, không tạo file, trả lời nguyên nhân kèm bằng chứng và chỉ sang `$cf-fix`. Nguồn skill Claude không đổi.

## Scope
- Lần 2 (Bro quyết 09/10): thêm vào `description` của bản chiếu ask một câu ranh giới (yêu cầu sửa vẫn chỉ được trả lời, không sửa file, chỉ sang `$cf-fix`), giữ frontmatter hợp lệ và description ≤ 1024 ký tự; viết lại note thành luật đầu tiên, ngắn, mệnh lệnh.
- In: chỉ chạy khi task 01 ra `decision: fix-needed`; khoá theo `sourcePath` kết thúc `skills/ask/SKILL.md` trong `normalizeCodexBody` (`codex-install.js:300`), chèn sau frontmatter bằng `splitFrontmatter`; câu chỉ dẫn không dùng tên công cụ riêng của Claude (self-test cấm); test chứng minh bản chiếu đúng, skill khác và prompt eval (sourcePath rỗng) không bị chèn.
- Out: sửa `packages/spec/src/claude/skills/ask/`; đổi skill khác.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/bin/lib/codex-install.js`
- Create: `packages/spec/bin/__tests__/codex-ask-projection.test.js`

## Steps
1. Thêm chèn chỉ dẫn theo `sourcePath` sau frontmatter → bản chiếu `ask` có chỉ dẫn.
2. Viết test: bản chiếu `ask` bắt đầu bằng `---`, `description` có câu ranh giới và ≤ 1024 ký tự, description của skill khác không đổi, khớp `^name:\s*cf-ask$`, có chỉ dẫn sau frontmatter; bản chiếu skill khác và chuỗi không có `sourcePath` không có chỉ dẫn.
3. Chạy test mới, test chiếu hiện có, self-test.
4. Commit đúng các file task này bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, chưa push).

## Acceptance
- AC-02: test mới và `codex-projection-parity.test.js` xanh; self-test xanh; `git diff --quiet 1bdb3916 -- packages/spec/src/claude/skills/ask`.

## Dependencies
- task-01-clean-home-diagnosis.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js && pnpm --dir packages/spec test && git diff --quiet 1bdb3916 -- packages/spec/src/claude/skills/ask`
- Named probe: test `codex ask projection carries the answer-only instruction after frontmatter`; `[skill-test] PASS`.
- Reachability: chạy từ gốc repo.
- Oracle: exit 0.
- Counterexample: gỡ chỉ dẫn khỏi đường chiếu trên bản chép tạm của `codex-install.js` → test mới fail.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js && pnpm --dir packages/spec test && git diff --quiet 1bdb3916 -- packages/spec/src/claude/skills/ask
Exit: 0
Base: 9ed215bcea3f62b58a6e996064977ea5f8c80f4a
Head: 7f1f664ab8488ae3142397bda4d4d10f73ee3ac5e4332a4f825cfaa4f8f0130f
```text
ok 1 - codex ask projection carries the answer-only instruction after frontmatter
# tests 9
# pass 9
# fail 0
ok 1 - codex ask projection carries the answer-only instruction after frontmatter
# tests 361
# pass 361
# fail 0
# tests 199
# pass 199
# fail 0
# tests 42
# pass 42
# fail 0
```

Khối trên là các dòng tóm tắt lọc từ output của lần chạy (exit 0); bỏ danh sách từng test vì một tên test có chuỗi ngoặc nhọn đôi mà gate hiểu là placeholder. Bản chiếu lần 2 (9ed215bc): câu ranh giới nằm trong `description` (thấy được lúc Codex chọn skill) và ghi chú "Rule 1 (Codex)" ở đầu thân; `description` ≤1024 ký tự, YAML hợp lệ (test kiểm). Phản ví dụ: trên bản sao tạm của `packages/spec/bin`, bỏ câu ranh giới khỏi `description` thì `codex-ask-projection.test.js` đỏ (exit 1, pass 0, fail 1). Nguồn chung `packages/spec/src/claude/skills/ask` không đổi so với 1bdb3916. Lần 1 (3361c5fd) đã trượt ở lượt đo thử; lần 2 chưa đo hành vi model, việc đó thuộc task 03.
