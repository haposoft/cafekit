# Đổi lời chào
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-09-20)
- User decision: KEEP — hai hàm chào và tạm biệt có tên người dùng.

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When `greet` is called with a name, it shall return a greeting naming that user. | task 01 |
| AC-02 | When `farewell` is called with a name, it shall return a farewell naming that user. | task 02 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Lời chào có tên | P1 | AC-01 | `src/greet.mjs` | - | done |
| 02 | Lời tạm biệt có tên | P1 | AC-02 | `src/farewell.mjs` | - | done |
