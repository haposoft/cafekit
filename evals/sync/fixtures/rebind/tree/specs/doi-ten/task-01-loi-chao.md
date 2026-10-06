# Task 01 — Lời chào có tên

Status: done

## Outcome
Lời chào có tên nguoi dùng.

## Scope
- In: `src/greet.mjs`
- Out: mọi hàm khác

## Ownership
- Modify: `src/greet.mjs`

## Acceptance
- AC-01: `greet("An")` trả về `Xin chào, An!`

## Dependencies
- none

## Verification Plan
- Command: `node scripts/nonce.mjs start && node --test test/greet.test.mjs && node scripts/nonce.mjs end`
- Named probe: `test/greet.test.mjs`
- Reachability: source level; node từ thư mục gốc của repo
- Oracle: exit 0, test pass, in RUN-A và RUN-B
- Counterexample: hàm không chứa tên làm test fail
- Artifacts: không có

## Failure Protocol
On a failed Step or Verification Plan run: stop; record observed versus expected; after three failed rounds, stop and ask the user.

## Receipt
