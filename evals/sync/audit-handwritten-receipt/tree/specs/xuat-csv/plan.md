# Xuất CSV
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-09-28)
- User decision: KEEP — xuất bảng ra CSV có trích dẫn đúng

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a cell holds a comma, toCsv shall quote it. | task 01 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Trích dẫn ô có dấu phẩy | P1 | AC-01 | `src/csv.mjs` | - | done |
