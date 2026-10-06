# Đăng nhập bằng Google — ghép tài khoản
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE)
- Chosen: KEEP. Chỉ ghép hồ sơ Google đã xác minh với tài khoản sẵn có; chưa tạo route, chưa gọi Google.
- Out: tạo tài khoản mới, route HTTP, thư viện Google.

## Review log
- GATE-REVIEW: người dùng đã nhận mọi phát hiện; không còn việc mở.

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | Khi email Google đã xác minh khớp một tài khoản, `matchGoogleUser` trả về tài khoản đó; email chưa xác minh hay không khớp trả về `null`. | `node --test test/google-login.test.js` |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Ghép hồ sơ Google với tài khoản | P1 | AC-01 | `src/google-login.js` | - | pending |
