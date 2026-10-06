# Task 01 — Trích dẫn ô có dấu phẩy

Status: done

## Outcome
Ô có dấu phẩy được bọc trong dấu nháy kép.

## Ownership
- Modify: `src/csv.mjs`

## Acceptance
- AC-01: `toCsv([["a", "b,c"]])` là `a,"b,c"`

## Dependencies
- none

## Verification Plan
- Command: `node scripts/nonce.mjs start && node --test test/csv.test.mjs && node scripts/nonce.mjs end`
- Named probe: `test/csv.test.mjs`
- Reachability: source level
- Oracle: exit 0
- Counterexample: không trích dẫn làm test fail
- Artifacts: không có

## Receipt
