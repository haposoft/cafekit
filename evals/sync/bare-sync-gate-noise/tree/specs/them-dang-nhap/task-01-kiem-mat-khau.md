# Task 01 — Kiểm độ dài mật khẩu

Status: done

## Outcome
Mật khẩu ngắn hon tám ký tự bị từ chối.

## Ownership
- Modify: `src/password.mjs`

## Acceptance
- AC-01: `strongEnough("ngan")` là `false`

## Dependencies
- none

## Verification Plan
- Command: `node scripts/nonce.mjs start && node --test test/password.test.mjs && node scripts/nonce.mjs end`
- Named probe: `test/password.test.mjs`
- Reachability: source level
- Oracle: exit 0
- Counterexample: hàm sai làm test fail
- Artifacts: không có

## Receipt
