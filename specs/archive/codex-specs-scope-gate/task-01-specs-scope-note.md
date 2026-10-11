# Task 01 — Bản cài Codex của specs mang ghi chú cổng phạm vi

Status: done

## Outcome
`normalizeCodexBody` chèn một ghi chú cổng phạm vi (D-02) ngay sau frontmatter khi `sourcePath` là `skills/specs/SKILL.md`; skill khác (kể cả ask, research) và nguồn chung không đổi; bản đã cài mang ghi chú.

## Scope
- In: hằng ghi chú trong `packages/spec/bin/lib/codex-install.js`, nhánh khoá `sourcePath` như research (`codex-install.js:330-335`); nội dung theo D-02 (final answer, không commentary hay `request_user_input`; không tóm tắt sau; marker có nội dung thật; giữ nguyên `NEEDS CLARIFICATION`, EXPAND, KEEP, CUT), tiếng Anh, không nêu tên ca eval hay chữ trong fixture (khách hàng, bán hàng, thông báo); có một câu cố định làm chuỗi đánh dấu (export hằng; task 02 dò chuỗi này trong phiên). Ghi chú được phép chứa nguyên văn `[NEEDS CLARIFICATION: <question>]`, `EXPAND`, `KEEP`, `CUT`.
- In: sửa đúng miễn trừ ở `packages/spec/bin/__tests__/codex-research-projection.test.js:57` để bỏ qua cả `specs/SKILL.md` như `ask/SKILL.md` (đổi phạm vi có chủ đích vì specs giờ có ghi chú riêng; kiểm chuỗi đánh dấu research vắng mặt ở specs vẫn giữ).
- Out: `description` của specs; skill gốc; agent `spec-maker`; `references/templates.md`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/bin/lib/codex-install.js`
- Modify: `packages/spec/bin/__tests__/codex-research-projection.test.js` (chỉ dòng miễn trừ)
- Create: `packages/spec/bin/__tests__/codex-specs-projection.test.js`
- Read: `packages/spec/bin/__tests__/codex-native.test.js`, `packages/spec/src/claude/skills/specs/SKILL.md`

## Steps
1. Viết test trước theo mẫu `codex-research-projection.test.js`: bản chiếu specs có ghi chú ngay sau frontmatter, frontmatter giữ nguyên; chuỗi đánh dấu KHÔNG có trong bản chiếu của mọi skill khác và trong specs với `sourcePath` `''`, `skills/specs/references/templates.md`, `other-skills/specs/SKILL.md`; skill khác ngoài ask và research bằng kết quả gọi không `sourcePath`; bản chiếu research vẫn chứa đúng một chuỗi đánh dấu research; ghi chú chứa `final answer` và `NEEDS CLARIFICATION`; ghi chú không chứa tên công cụ Claude (`Write|Edit|Read|Bash|WebSearch|WebFetch|AskUserQuestion`) và không chứa `customer|sales|notif|khách|bán hàng|thông báo`.
2. Thêm ghi chú và sửa dòng miễn trừ ở test research cho tới khi test xanh.
3. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-01: các kiểm ở Step 1 xanh; test cài đặt Codex (`codex-native.test.js`) xanh; self-test toàn gói xanh; nguồn chung specs không đổi.

## Dependencies
- none

## Verification Plan
- Command: `test -f packages/spec/bin/__tests__/codex-specs-projection.test.js && node --test packages/spec/bin/__tests__/codex-specs-projection.test.js packages/spec/bin/__tests__/codex-research-projection.test.js packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js && pnpm --dir packages/spec test && git diff --quiet 7304cdd1 -- packages/spec/src/claude/skills/specs`
- Named probe: các test trong `codex-specs-projection.test.js`; test cài đặt ở `codex-native.test.js`.
- Reachability: installed — `codex-native.test.js` cài thật vào thư mục tạm và so file đã cài với `normalizeCodexBody`.
- Oracle: exit 0, mọi test PASS.
- Counterexample: trên bản sao tạm, (a) bỏ nhánh chèn ghi chú specs → test đỏ; (b) chèn ghi chú cho mọi `SKILL.md` → test đỏ.
- Artifacts: không có.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: test -f packages/spec/bin/__tests__/codex-specs-projection.test.js && node --test packages/spec/bin/__tests__/codex-specs-projection.test.js packages/spec/bin/__tests__/codex-research-projection.test.js packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js && pnpm --dir packages/spec test && git diff --quiet 7304cdd1 -- packages/spec/src/claude/skills/specs
Exit: 0
Base: 3e4648ead39fd63d1aa41bd2f6028b3f0627b391
Head: b45428a804e27e812cbeecd3dc620c382afbb9cdca301c11b8aae10dc57ff14b
```text
# tests 51
# pass 51
# fail 0
# tests 380
# pass 380
# fail 0
# tests 199
# pass 199
# fail 0
# tests 42
# pass 42
# fail 0
[skill-test] PASS: 1407 tests executed
```

Commit 3e4648ea (Codex thực thi, phiên Claude tự chạy lại lệnh kiểm). Phản ví dụ trên bản sao tạm của HEAD: (a) tắt nhánh chèn ghi chú specs → codex-specs-projection 1 pass, 2 fail; (b) chèn ghi chú cho mọi SKILL.md → 1 pass, 2 fail; khôi phục → 3 pass. Miễn trừ specs ở codex-research-projection.test.js là đổi phạm vi đã chấp nhận ở GATE-REVIEW H-01. Reachability: codex-native.test.js cài thật và so bản cài với normalizeCodexBody.
