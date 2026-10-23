# Task 02 — `cf:git pr --base`

Status: done

## Outcome
`cf:git pr --base <branch>` mở PR vào nhánh chỉ định, sau khi in các commit PR mang theo (D-04).

## Scope
- In: dòng `pr` trong mục Commands của `git/SKILL.md` (không sửa argument-hint, vì bị pin nguyên văn ở `packages/spec/scripts/run-skill-self-tests.mjs:4075`).
- Out: đổi mặc định nhánh tích hợp; các mục Out of scope của `plan.md`.

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/skills/git/SKILL.md`
- Create: `packages/spec/bin/__tests__/vibe-skill.test.js` (ca git)
- Read: `packages/spec/scripts/run-skill-self-tests.mjs` (GIT_SKILL_PINS)

## Steps
1. Viết ca test trước: `pr` nhận `--base <branch>`; không có `--base` thì vẫn nhắm nhánh tích hợp; trước `gh pr create` in `git log --oneline origin/<base>..HEAD`; mọi GIT_SKILL_PINS còn đạt.
2. Chạy Verification Plan; phải đỏ.
3. Sửa `git/SKILL.md`.
4. Chạy Verification Plan; phải xanh.

## Acceptance
- AC-02: Command thoát 0.

## Dependencies
- task-01-vibe-run-exception.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/vibe-skill.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: ca git trong `vibe-skill.test.js`.
- Reachability: `cf:git` đọc lệnh từ SKILL.md.
- Oracle: thoát 0, `fail 0`; self-test PASS không giảm.
- Counterexample: bỏ câu in commit trên bản sao tạm thì ca tương ứng hỏng.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/vibe-skill.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: fd08e0b493be715efb41293f6ff6b51120068ec5
Head: 429d4f6514cc0749bcedc41a39d2158c79c920c069942c55332af132bd11afdf
```text
$ node --test packages/spec/bin/__tests__/vibe-skill.test.js && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261023-vibe-task02.log (1932 dòng): tổng của đoạn node --test, tổng Node tests bên trong self-test, và dòng PASS của self-test
ℹ tests 2
ℹ pass 2
ℹ fail 0
ℹ tests 1257
ℹ pass 1257
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2409 tests executed
Exit: 0
```
Trước sửa: Command thoát 1 (hai ca git mới đỏ). Phản ví dụ trên bản sao: bỏ câu in commit làm ca tương ứng đỏ. Review: code-auditor PASS_WITH_WARNINGS (`<base>` chưa định nghĩa, bước in chỉ trong mệnh đề `--base`; thiếu `git fetch`) → sửa câu thành định nghĩa `<base>`, fetch và in trước mọi `gh pr create --base <base>` → PASS; lần chạy trước sửa: `plans/20261023-vibe-task02-r1.log`. argument-hint (`git/SKILL.md:8`, bị ghim) không đổi.
