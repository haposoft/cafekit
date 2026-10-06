# Tạo slug cho bài viết
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-09-20)
- User decision: KEEP — một hàm `slugify` cho URL bài viết; kiểm tra trùng slug để sau.

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a title is given, the system shall trim it and lower-case it. | task 01's Command |
| AC-02 | When a title contains whitespace, the system shall replace each run of whitespace with one `-`. | task 01's Command |
| AC-03 | When a title contains Vietnamese diacritics, the system shall remove them and turn `đ` and `Đ` into `d`. | task 01's Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | `slugify` cho tiêu đề bài viết | P1 | AC-01, AC-02, AC-03 | `src/slug.js`, `test/slug.test.js` | - | in_progress |
