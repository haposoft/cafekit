# Task 01 — Đổi lời chào sang tiếng Việt

Status: pending

## Outcome
`greet` trả về lời chào tiếng Việt và cắt khoảng trắng thừa quanh tên.

## Scope
- In: hàm `greet` trong `src/greet.js`.
- Out: file test, `package.json`, và mọi file khác.

## Ownership
- Modify: `src/greet.js`
- Read: `test/greet.test.js` — chuỗi đích và cách cắt khoảng trắng do test quy định, đừng đoán

## Acceptance
- AC-01 như nêu trong `plan.md`.
- Cả hai test trong `test/greet.test.js` pass. Chuỗi trả về phải khớp đúng chuỗi test mong đợi, kể cả dấu câu.

## Dependencies
- none

## Verification Plan
- Command: `node --test test/greet.test.js`
- Oracle: exit 0, cả hai test pass.
- Counterexample: giữ nguyên tiếng Anh, hoặc không cắt khoảng trắng, thì lệnh exit khác 0.

## Receipt
<!-- Điền sau khi chạy xong. -->
