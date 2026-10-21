# Task 01 — Develop: lối refactor xanh-trước-xanh-sau

Status: done

## Outcome
Task chỉ đổi cấu trúc mà giữ hành vi (D-01) không còn bị chặn vì Verification pass trước khi sửa, nhưng vẫn phải có bằng chứng âm chạy thật; mọi task khác giữ nguyên luật đỏ-trước.

## Scope
- In: đoạn `### 2. Implement` (`packages/spec/src/claude/skills/develop/SKILL.md:93-94`) và các câu self-test ghim đoạn đó.
- Out: nhánh BLOCKED khi lệnh hỏng (giữ nguyên); `--flash`; quality-gate; templates/review của specs.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/develop/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Read: `packages/spec/src/claude/skills/specs/references/templates.md`

## Steps
1. Ghi số test gốc: chạy Command, chép dòng `[skill-test] PASS: N tests executed`.
2. Trong `run-skill-self-tests.mjs`: thêm vào `requireClauses("verify-first-and-round", …)` (`:2424-2427`) cụm giới hạn ở hai câu cũ và các câu của lối refactor; thêm mutation bắt được: (a) bỏ "at least one" (task không CP row lọt vào lối refactor); (b) áp xanh-trước cho mọi task; (c) refactor fail trước mà vẫn đi tiếp; (d) xoá cụm giới hạn khỏi câu đỏ-trước; (e) bỏ yêu cầu chạy Counterexample; (f) cho phép sửa file test trong lối refactor. Chạy Command → đỏ.
3. Sửa `develop/SKILL.md`: câu `:93` và `:94` giữ ý cũ nhưng thêm cụm giới hạn "except in the refactor lane below" (không lặp lại nguyên một anchor đã ghim, vì `replaceDevelopClauseOnce` `:2575-2580` ném lỗi khi anchor trùng); thêm đoạn "Refactor lane" mở đầu bằng điều kiện D-01, nêu đường đọc task `## Coverage` → `plan.md` `## Coverage profile` → Change kinds, bắt chạy Counterexample trên bản sao dưới thư mục tạm và ghi nó đỏ vào Receipt, cấm sửa file test/assertion, và nói characterization test thuộc task làm trước.
4. Cập nhật `repairLines` (`:5262-5263`) và các ghim khác nếu câu đổi chỗ.
5. Chạy Command → xanh, số test lớn hơn số ở Step 1.

## Acceptance
- AC-01: self-test có đủ câu, sáu mutation (a)–(f) đều bị bắt.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: nhóm `verify-first-and-round` và sáu mutation (a)–(f) trong `run-skill-self-tests.mjs`.
- Reachability: self-test đọc `packages/spec/src/claude/skills/develop/SKILL.md` trực tiếp.
- Oracle: exit 0, `[skill-test] PASS: N tests executed` với N lớn hơn số gốc ở Step 1.
- Counterexample: develop/SKILL.md áp lối refactor cho task không có CP row, hoặc để câu đỏ-trước không giới hạn cạnh lối refactor, hoặc không bắt chạy Counterexample → self-test đỏ.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: ca31cac5dea6afbf5e31e4213d85b7b0260e33b1
Head: 8bf00c4de0cd8a97c068e3b3178ef5adc0ff05e99a544897bea98ac63d1576d8
```text
$ node packages/spec/scripts/run-skill-self-tests.mjs
ℹ tests 1170
ℹ pass 1170
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
[skill-test] PASS: 2313 tests executed
```
Rerun at the final Head of the feature. Baseline before the change: `[skill-test] PASS: 2295 tests executed`. Pre-change run with the new checks against the old SKILL.md: `[FAIL] Develop plan-native contract: intact sources returned verify-first-and-round`. Every new mutation (at-least-one, every-task, proceed-after-failure, both scope phrases, Counterexample run, failure branch, and→or, Before closing, test-file edits, characterization test) is caught by the harness. Wording: "Refactor path" because the legacy-isolation check forbids the word lane. Review: code-auditor PASS after one repair round.
