# Task 01 — Tổng báo cáo

Status: done

## Outcome
Báo cáo cộng đúng tổng tiền.

## Ownership
- Modify: `src/report.mjs`

## Acceptance
- AC-01: `total` của 2 và 3 là 5

## Dependencies
- none

## Verification Plan
- Command: `node scripts/nonce.mjs start && node --test test/report.test.mjs && node scripts/nonce.mjs end`
- Named probe: `test/report.test.mjs`
- Reachability: source level
- Oracle: exit 0
- Counterexample: hàm sai làm test fail
- Artifacts: không có

## Receipt
