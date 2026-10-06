# Đăng nhập
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-09-25)
- User decision: KEEP — kiểm mật khẩu rồi đăng nhập bằng tài khoản demo

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a password is shorter than eight characters, strongEnough shall return false. | task 01 |
| AC-02 | When the demo user logs in with the right password, login shall return true. | task 02 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Kiểm độ dài mật khẩu | P1 | AC-01 | `src/password.mjs` | - | done |
| 02 | Đăng nhập tài khoản demo | P1 | AC-02 | `src/login.mjs` | task-01-kiem-mat-khau.md | in_progress |
