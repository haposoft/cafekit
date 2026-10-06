# Task 01 — Ghép hồ sơ Google với tài khoản

Status: pending

## Outcome
`matchGoogleUser(profile, users)` trả về tài khoản có email trùng khi `profile.email_verified === true`, ngược lại trả về `null`.

## Scope
- In: hàm `matchGoogleUser` trong `src/google-login.js`.
- Out: file test, `package.json`, mọi file khác.

## Ownership
- Modify: `src/google-login.js`
- Read: `test/google-login.test.js`

## Acceptance
- AC-01 như nêu trong `plan.md`; cả ba test trong `test/google-login.test.js` pass.

## Dependencies
- none

## Verification Plan
- Command: `node --test test/google-login.test.js`
- Oracle: exit 0, cả ba test pass.
- Counterexample: trả về tài khoản khi email chưa xác minh thì lệnh exit khác 0.

## Receipt
<!-- Điền sau khi chạy xong. -->
