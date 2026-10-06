# Task 02 — Lời tạm biệt có tên

Status: done

## Outcome
Lời tạm biệt có tên nguoi dùng.

## Scope
- In: `src/farewell.mjs`
- Out: mọi hàm khác

## Ownership
- Modify: `src/farewell.mjs`

## Acceptance
- AC-02: `farewell("An")` trả về `Tạm biệt, An!`

## Dependencies
- none

## Verification Plan
- Command: `node scripts/nonce.mjs start && node --test test/farewell.test.mjs && node scripts/nonce.mjs end`
- Named probe: `test/farewell.test.mjs`
- Reachability: source level; node từ thư mục gốc của repo
- Oracle: exit 0, test pass, in RUN-A và RUN-B
- Counterexample: hàm không chứa tên làm test fail
- Artifacts: không có

## Failure Protocol
On a failed Step or Verification Plan run: stop; record observed versus expected; after three failed rounds, stop and ask the user.

## Receipt
