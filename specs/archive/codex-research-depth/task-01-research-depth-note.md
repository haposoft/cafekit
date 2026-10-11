# Task 01 — Bản cài Codex của research mang ghi chú chọn độ sâu

Status: done

## Outcome
`normalizeCodexBody` chèn một ghi chú độ sâu (D-02) ngay sau frontmatter khi `sourcePath` là `skills/research/SKILL.md`; skill khác và nguồn chung không đổi; bản đã cài mang ghi chú.

## Scope
- In: hằng ghi chú trong `packages/spec/bin/lib/codex-install.js`, nhánh khoá `sourcePath` như ask (`codex-install.js:316-324`); nội dung theo D-02 bằng chữ của bảng gốc (`SKILL.md:21-31`): quyết định repo đã chốt và đang có hiệu lực là *known option* → Quick; lý do phụ lỗi thời không nâng độ sâu trừ khi làm đổi khuyến nghị; mâu thuẫn làm đổi khuyến nghị vẫn nâng độ sâu. Tiếng Anh; không nêu tên ca eval, tên thư viện hay chữ trong fixture; có một câu cố định dùng làm chuỗi đánh dấu (task 02 dò chuỗi này trong phiên).
- Out: `description` của research; skill gốc; agent `researcher`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/bin/lib/codex-install.js`
- Create: `packages/spec/bin/__tests__/codex-research-projection.test.js`
- Read: `packages/spec/bin/__tests__/codex-ask-projection.test.js`, `packages/spec/bin/__tests__/codex-native.test.js`, `packages/spec/src/claude/skills/research/SKILL.md`

## Steps
1. Viết test trước: bản chiếu research có ghi chú ngay sau frontmatter, frontmatter parse được và `description` không đổi; chuỗi đánh dấu KHÔNG xuất hiện trong bản chiếu của mọi skill khác (kể cả ask) và trong research với `sourcePath` `''`, `skills/research/templates/x.md`, `other-skills/research/SKILL.md`; (phụ) skill khác bằng kết quả gọi không `sourcePath`, như `codex-ask-projection.test.js:37-50`; ghi chú không chứa tên công cụ Claude (`Write|Edit|Read|Bash|WebSearch|WebFetch|AskUserQuestion`) và không chứa `Drizzle|Prisma|BullMQ|pg-boss|billing|ADR-004`.
2. Thêm ghi chú cho tới khi test xanh.
3. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-01: các kiểm ở Step 1 xanh; test cài đặt Codex (`codex-native.test.js`) xanh với bản cài mang ghi chú; self-test toàn gói xanh; nguồn chung research không đổi.

## Dependencies
- none

## Verification Plan
- Command: `test -f packages/spec/bin/__tests__/codex-research-projection.test.js && node --test packages/spec/bin/__tests__/codex-research-projection.test.js packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js && pnpm --dir packages/spec test && git diff --quiet d3e5ed48 -- packages/spec/src/claude/skills/research`
- Named probe: các test trong `codex-research-projection.test.js`; test cài đặt ở `codex-native.test.js` (bản cài bằng `normalizeCodexBody`).
- Reachability: installed — `codex-native.test.js` cài thật vào thư mục tạm và so file đã cài với `normalizeCodexBody`.
- Oracle: exit 0, mọi test PASS.
- Counterexample: trên bản sao tạm, (a) bỏ nhánh chèn ghi chú research → test đỏ; (b) chèn ghi chú cho mọi `SKILL.md` → test đỏ.
- Artifacts: không có.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: test -f packages/spec/bin/__tests__/codex-research-projection.test.js && node --test packages/spec/bin/__tests__/codex-research-projection.test.js packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-native.test.js && pnpm --dir packages/spec test && git diff --quiet d3e5ed48 -- packages/spec/src/claude/skills/research
Exit: 0
Base: 24298592ee7c6a7ed4d5e6c5de160a4a41883598
Head: cc680d574ff10eac145f70f220c732f5d4554e3c0b24e2ffb71976ae658c7c6e
```text
# tests 48
# pass 48
# fail 0
# tests 377
# pass 377
# fail 0
# tests 199
# pass 199
# fail 0
# tests 42
# pass 42
# fail 0
[skill-test] PASS: 1404 tests executed
```

Commit 24298592 (Codex thực thi, phiên Claude tự chạy lại lệnh kiểm). Phản ví dụ chạy trên bản sao tạm của HEAD: (a) tắt nhánh chèn ghi chú research → codex-research-projection 1 pass, 2 fail; (b) chèn ghi chú cho mọi SKILL.md → 1 pass, 2 fail; khôi phục bản gốc → 3 pass. Reachability: codex-native.test.js cài thật và so bản cài với normalizeCodexBody.
