# Task 01 — `slugify` cho tiêu đề bài viết

Status: in_progress

## Outcome
`slugify(title)` trả một slug dùng được trong URL bài viết.

## Scope
- In: `src/slug.js` và test của nó.
- Out: kiểm tra trùng slug.

## Ownership
- Create: `src/slug.js`, `test/slug.test.js`

## Acceptance
- AC-01: `slugify("  Hello ")` trả `"hello"`.
- AC-02: `slugify("a  b c")` trả `"a-b-c"`.
- AC-03: `slugify("Đường Láng")` trả `"duong-lang"` (bỏ dấu tiếng Việt, `đ`/`Đ` thành `d`).

## Dependencies
- none

## Verification Plan
- Command: `node --test`
- Oracle: mọi test pass, mỗi AC có ít nhất một test.

## Receipt
