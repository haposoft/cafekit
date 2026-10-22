# Task 04 — Câu SKILL lần 2: mọi hướng, kể cả hướng bị loại

Status: done

## Outcome
Mệnh đề giả định/điểm gãy/hệ quả ở `SKILL.md:85` nói rõ áp cho mọi hướng so sánh, kể cả hướng bị loại (GATE-SCOPE 2026-10-22 lần 2); pin, history, changelog khớp câu mới.

## Scope
- In: thay đúng tiền tố `For each compared approach, name the assumption` bằng `For every compared approach, including each one you reject, name the assumption` ở `SKILL.md:85` và ở khoá `optionStress` (`run-skill-self-tests.mjs:1273`); sinh lại `history.jsonl`; sửa dòng `### Changed` ở hai changelog cho khớp ("every compared approach, including the rejected ones").
- Out: phần chi phí rời bỏ (`optionAbandon`, đã 20/20); câu khác của SKILL.md; mọi mục Out of scope của `plan.md`.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/brainstorm/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `evals/brainstorm/duyet-khong-trien-khai/history.jsonl`, `evals/brainstorm/ne-cau-hoi/history.jsonl`, `evals/brainstorm/tham-do-nap-skill/history.jsonl`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`

## Steps
1. Chạy Verification Plan trước khi sửa; phải đỏ (grep không thấy tiền tố mới).
2. Sửa hai chỗ, `node evals/brainstorm/make-history.mjs`, sửa changelog.
3. Chạy Verification Plan; phải xanh.

## Acceptance
- AC-02 (lần 2): Command thoát 0; `count=81`; `PASS:` = 2322; `make-history.mjs --check` thoát 0.

## Dependencies
- task-02-skill-clauses.md

## Verification Plan
- Command: `grep -qF 'For every compared approach, including each one you reject, name the assumption it depends on most' packages/spec/src/claude/skills/brainstorm/SKILL.md && ! grep -qF 'For each compared approach' packages/spec/src/claude/skills/brainstorm/SKILL.md && grep -qF 'prefer the one cheapest to abandon' packages/spec/src/claude/skills/brainstorm/SKILL.md && node evals/brainstorm/make-history.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: khoá `optionStress` và ca đột biến `option-stress-removed`.
- Reachability: như task-02.
- Oracle: thoát 0, `count=81`, `PASS: 2322`.
- Counterexample: ca đột biến `option-stress-removed` không áp được lên câu mới (anchor không khớp) → self-test đỏ.
- Artifacts: none.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: grep -qF 'For every compared approach, including each one you reject, name the assumption it depends on most' packages/spec/src/claude/skills/brainstorm/SKILL.md && ! grep -qF 'For each compared approach' packages/spec/src/claude/skills/brainstorm/SKILL.md && grep -qF 'prefer the one cheapest to abandon' packages/spec/src/claude/skills/brainstorm/SKILL.md && node evals/brainstorm/make-history.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: d1d171c4688bb5e875080e02c0b63ed85da48e44
Head: be9e934a1078f94266f8b3d5fd32aae2cf8e26458f085b431d55e74fb1300dc8
```text
$ grep -qF 'For every compared approach, including each one you reject, name the assumption it depends on most' packages/spec/src/claude/skills/brainstorm/SKILL.md && ! grep -qF 'For each compared approach' packages/spec/src/claude/skills/brainstorm/SKILL.md && grep -qF 'prefer the one cheapest to abandon' packages/spec/src/claude/skills/brainstorm/SKILL.md && node evals/brainstorm/make-history.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261022-bhr-task04.log (1838 dòng): dòng của make-history --check, dòng đột biến brainstorm, tổng self-test
ok: duyet-khong-trien-khai/history.jsonl equals its regeneration from the current SKILL.md
ok: ne-cau-hoi/history.jsonl equals its regeneration from the current SKILL.md
ok: tham-do-nap-skill/history.jsonl equals its regeneration from the current SKILL.md
✔ cf:brainstorm proportional routing checker rejects semantic weakenings; count=81
[skill-test] PASS: 2322 tests executed
Exit: 0
```
Trước sửa (Step 1): Command thoát 1 (grep không thấy tiền tố mới). Review: code-auditor PASS (tiền tố đổi ở `SKILL.md:85` và `optionStress`, không còn `For each compared approach` trong `packages/` hay `evals/brainstorm`; mỗi history đổi 1 dòng; Codex chỉ ghim tiền tố `:85`).
