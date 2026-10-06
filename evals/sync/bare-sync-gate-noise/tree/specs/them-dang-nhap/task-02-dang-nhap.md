# Task 02 — Đăng nhập tài khoản demo

Status: in_progress

## Outcome
Tài khoản demo đăng nhập được.

## Ownership
- Modify: `src/login.mjs`

## Acceptance
- AC-02: `login("an", "mat-khau")` trả về `true`

## Dependencies
- task-01-kiem-mat-khau.md

## Verification Plan
- Command: `node scripts/nonce.mjs start && node --test test/login.test.mjs && node scripts/nonce.mjs end`
- Named probe: `test/login.test.mjs`
- Reachability: source level
- Oracle: exit 0
- Counterexample: hàm sai làm test fail
- Artifacts: không có

## Receipt
