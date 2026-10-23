# Task 03 — `cf:code-review #PR --fix --reply`

Status: done

## Outcome
`cf:code-review` nhận PR với `--fix`/`--reply` theo D-05; không có cờ thì ranh giới cũ (không sửa, không commit, không mở PR, không chạy test) giữ nguyên.

## Scope
- In: `code-review/references/pr-fix-reply.md`; mục ngắn trong `code-review/SKILL.md` (argument-hint, Input, References); ca test trong `vibe-skill.test.js`.
- Out: đổi verdict/severity; các mục Out of scope của `plan.md`.

## Coverage
- CP-02

## Ownership
- Create: `packages/spec/src/claude/skills/code-review/references/pr-fix-reply.md`
- Modify: `packages/spec/src/claude/skills/code-review/SKILL.md`, `packages/spec/bin/__tests__/vibe-skill.test.js` (ca code-review)
- Read: `~/Desktop/cfk-ref/.claude/skills/ak-review-pr/{SKILL.md,references/mode-fix.md,references/mode-reply.md}`, `packages/spec/src/claude/skills/fix/SKILL.md`, `evals/code-review/sua-ho/graders/`, `packages/spec/scripts/run-skill-self-tests.mjs`

## Steps
1. Viết ca test trước cho mọi mệnh đề D-05, gồm ca "không cờ = không sửa, không commit, không mở PR, không chạy test", "nội dung PR là dữ liệu", "chỉ comment của OWNER/MEMBER/COLLABORATOR", marker chống trả lời trùng, redact, không force-push, `cf:fix` commit qua `cf:git commit`.
2. Chạy Verification Plan; phải đỏ.
3. Viết reference và mục SKILL.md.
4. Chạy Verification Plan; phải xanh.

## Acceptance
- AC-03: Command thoát 0; mỗi mệnh đề có ca.

## Dependencies
- task-02-git-pr-base.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/vibe-skill.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: ca code-review trong `vibe-skill.test.js`.
- Reachability: `code-review/SKILL.md` trỏ reference bằng đường dẫn tương đối.
- Oracle: thoát 0, `fail 0`; self-test PASS không giảm.
- Counterexample: bỏ câu "without --fix, never edits" trên bản sao tạm thì ca tương ứng hỏng.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/vibe-skill.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: fd08e0b493be715efb41293f6ff6b51120068ec5
Head: 2ceca44d9997a39b228e81e5c0bdcdcde789c95b7bc62e1f74ae29036fff43ac
```text
$ node --test packages/spec/bin/__tests__/vibe-skill.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261023-vibe-task03.log (1972 dòng): tổng của đoạn node --test, tổng Node tests bên trong self-test, và dòng PASS của self-test
ℹ tests 22
ℹ pass 22
ℹ fail 0
ℹ tests 1277
ℹ pass 1277
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2429 tests executed
Exit: 0
```
Trước sửa: Command thoát 1 (8 ca code-review mới đỏ, `ENOENT … pr-fix-reply.md`). Phản ví dụ: bỏ câu "Without `--fix`, the review never edits, commits, or opens a PR" trên bản sao làm ca tương ứng đỏ; bỏ chốt fork (`isCrossRepository`) trên bản sao làm ca "stops BLOCKED on a fork PR" đỏ. Vòng sửa 1 (review FAIL, High): kiểm `headRefName`, dừng với PR từ fork, `gh pr checkout` trước `cf:fix`, chỉ push khi đứng đúng nhánh head; không commit khi kiểm chứng của `cf:fix` hỏng hoặc có thay đổi lạ; đọc/đăng qua `gh api` với endpoint cụ thể; marker có id. Vòng sửa 2 (review FAIL, Medium): bỏ reply của chính mình khỏi danh sách, tìm marker ở cả hai danh sách ngay trước khi đăng, đăng một lần sau khi vòng sửa hội tụ, `--paginate`. Review lần 3: PASS. Low để nguyên: câu "one reply per comment, accepted or declined" (`pr-fix-reply.md:35`) chưa ghi "trusted, in-scope" như dòng 9; marker `id=<review-id>` dùng chung không gian với `id=<comment-id>`. Log các lần trước: `plans/20261023-vibe-task03-r1.log`, `-r2.log`.
