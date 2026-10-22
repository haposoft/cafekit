# Task 02 — Mệnh đề SKILL + pin + history + changelog

Status: done

## Outcome
`cf:brainstorm` bắt mỗi hướng so sánh nêu giả định chịu lực, điểm gãy, hệ quả khi giả định sai, và so chi phí rời bỏ (D-01); self-test ghim câu đó; lịch sử phát lại khớp SKILL.md mới.

## Scope
- In: nối đúng câu dưới đây vào cuối bullet `SKILL.md:85` (giữ nguyên `:86`, `:87`); thêm hai khoá vào `BRAINSTORM_CONTRACT_CLAUSES` (`run-skill-self-tests.mjs:1252`): một cho phần giả định/điểm gãy/hệ quả, một cho phần chi phí rời bỏ, và một ca đột biến xoá mỗi phần (mẫu `:1954-1955`); sinh lại `history.jsonl` bằng `node evals/brainstorm/make-history.mjs`; tạo heading `### Changed` dưới `[Unreleased]` ở mỗi changelog (hiện chỉ có `### Added`, `### Fixed`) và thêm một dòng.
- Out: sửa câu khác của SKILL.md; agent `brainstormer`; mọi mục Out of scope của `plan.md`.

Câu nối vào cuối `:85`: ` For each compared approach, name the assumption it depends on most, a concrete condition (a threshold, event, or failure) under which it fails first, and what happens to it if that assumption proves wrong; compare what it would cost to abandon each approach, and when evidence leaves a load-bearing assumption open, prefer the one cheapest to abandon.`

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/brainstorm/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `evals/brainstorm/duyet-khong-trien-khai/history.jsonl`, `evals/brainstorm/ne-cau-hoi/history.jsonl`, `evals/brainstorm/tham-do-nap-skill/history.jsonl`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `evals/brainstorm/make-history.mjs`, `packages/spec/bin/__tests__/codex-native.test.js:880-900`, `:2540-2550`

## Steps
1. Chạy `node packages/spec/scripts/run-skill-self-tests.mjs` và ghi số `PASS:` cùng dòng `count=` của bộ đột biến brainstorm (hiện 79) trước khi sửa; chạy Verification Plan, phải đỏ (grep không thấy câu mới).
2. Thêm pin + hai ca đột biến; nối câu; chạy `node evals/brainstorm/make-history.mjs`; thêm changelog.
3. Chạy Verification Plan; phải xanh.

## Acceptance
- AC-02: Command thoát 0; output self-test có `count=81` ở dòng đột biến brainstorm và số `PASS:` không nhỏ hơn số ở Step 1; `make-history.mjs --check` thoát 0.

## Dependencies
- task-01-before-regression.md

## Verification Plan
- Command: `grep -qF 'under which it fails first, and what happens to it if that assumption proves wrong' packages/spec/src/claude/skills/brainstorm/SKILL.md && grep -qF 'prefer the one cheapest to abandon' packages/spec/src/claude/skills/brainstorm/SKILL.md && node evals/brainstorm/make-history.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: hai khoá mới trong `BRAINSTORM_CONTRACT_CLAUSES` và hai ca đột biến; `make-history.mjs --check`.
- Reachability: `packages/spec/package.json` script `test` chính là `node scripts/run-skill-self-tests.mjs`; `pnpm` không có trên PATH của phiên.
- Oracle: thoát 0, `count=81`, `PASS:` ≥ số Step 1.
- Counterexample: ca đột biến xoá một phần câu mà self-test vẫn xanh (count không tăng lên 81) → pin vô hiệu, không đóng.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: grep -qF 'under which it fails first, and what happens to it if that assumption proves wrong' packages/spec/src/claude/skills/brainstorm/SKILL.md && grep -qF 'prefer the one cheapest to abandon' packages/spec/src/claude/skills/brainstorm/SKILL.md && node evals/brainstorm/make-history.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: d1d171c4688bb5e875080e02c0b63ed85da48e44
Head: f05da95e0378d04ee829909c6bb4df2f09ef80488277fbfd8b82ec15ac475ca8
```text
$ grep -qF 'under which it fails first, and what happens to it if that assumption proves wrong' packages/spec/src/claude/skills/brainstorm/SKILL.md && grep -qF 'prefer the one cheapest to abandon' packages/spec/src/claude/skills/brainstorm/SKILL.md && node evals/brainstorm/make-history.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261022-bhr-task02.log (1838 dòng): dòng của make-history --check, dòng đột biến brainstorm, tổng self-test
ok: duyet-khong-trien-khai/history.jsonl equals its regeneration from the current SKILL.md
ok: ne-cau-hoi/history.jsonl equals its regeneration from the current SKILL.md
ok: tham-do-nap-skill/history.jsonl equals its regeneration from the current SKILL.md
✔ cf:brainstorm proportional routing checker rejects semantic weakenings; count=81
[skill-test] PASS: 2322 tests executed
Exit: 0
```
Trước sửa (Step 1): `node packages/spec/scripts/run-skill-self-tests.mjs` → `count=79`, `PASS: 2320 tests executed`; Command thoát 1 (grep không thấy câu mới). Sau sửa: `count=81`, `PASS: 2322`. Lần chạy đầu sau sửa (`plans/20261022-bhr-task02-r1.log`) cũng thoát 0; chạy lại sau khi sửa câu changelog theo review (Low).
Review: code-auditor PASS (hai anchor đột biến khớp đúng 1 lần, `replaceBrainstormClauseOnce` làm đỏ khi không khớp; history mỗi file đổi đúng dòng 2; Codex chỉ ghim tiền tố `:85`).
