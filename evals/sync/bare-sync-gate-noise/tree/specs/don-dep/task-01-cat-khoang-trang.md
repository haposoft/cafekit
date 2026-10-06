# Task 01 — Cắt khoảng trắng

Status: done

## Outcome
Mọi phần tử được cắt khoảng trắng.

## Ownership
- Modify: `src/cleanup.mjs`

## Acceptance
- AC-01: `trimAll([" a ", "b "])` là `["a", "b"]`

## Dependencies
- none

## Verification Plan
- Command: `node scripts/nonce.mjs start && node --test test/cleanup.test.mjs && node scripts/nonce.mjs end`
- Named probe: `test/cleanup.test.mjs`
- Reachability: source level
- Oracle: exit 0
- Counterexample: hàm sai làm test fail
- Artifacts: không có

## Receipt
