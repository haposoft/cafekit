# Task 01 — Cô lập trạng thái hook trong test

Status: done

## Outcome
`precompact.test.js` và `spec-gate.test.js` chạy hook với thư mục tạm riêng của tiến trình test, nên hai bộ hook test chạy song song không làm hỏng nhau.

## Scope
- In: D-07.
- Out: thay `hook-state-dir.cjs`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/hooks/__tests__/precompact.test.js`, `packages/spec/src/claude/hooks/__tests__/spec-gate.test.js`

## Steps
1. Tái hiện trước sửa: chạy Command → ghi số cặp fail.
2. Đầu mỗi file, trước mọi `require` dùng `os.tmpdir()`: tạo `PRIVATE_TMP` bằng `fs.mkdtempSync`, gán `process.env.TMPDIR`, `TMP`, `TEMP`; xoá trong `test.after`. Không sửa từng điểm spawn (mọi env con dựng từ `process.env`).
3. Chạy Command. Không commit.

## Acceptance
- AC-01: 3 cặp song song đều exit 0; self-test PASS.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && for i in 1 2 3; do node --test src/claude/hooks/__tests__/*.test.js > /dev/null 2>&1 & A=$!; node --test src/claude/hooks/__tests__/*.test.js > /dev/null 2>&1 & B=$!; wait $A; a=$?; wait $B; b=$?; [ $a -eq 0 ] && [ $b -eq 0 ] || exit 1; echo "pair $i ok"; done && node scripts/run-skill-self-tests.mjs`
- Named probe: `a compact restart in the same session restores its captured anchors` (`precompact.test.js:150`).
- Reachability: hook chạy từ source như self-test.
- Oracle: 3 dòng `pair N ok`, self-test PASS.
- Counterexample: bỏ TMPDIR riêng → cặp song song fail (đã tái hiện 4/6).
- Artifacts: thư mục tạm của test, xoá trong `after`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `cd packages/spec && for i in 1 2 3; do node --test src/claude/hooks/__tests__/*.test.js > /dev/null 2>&1 & A=$!; node --test src/claude/hooks/__tests__/*.test.js > /dev/null 2>&1 & B=$!; wait $A; a=$?; wait $B; b=$?; [ $a -eq 0 ] && [ $b -eq 0 ] || exit 1; echo "pair $i ok"; done && node scripts/run-skill-self-tests.mjs`
Exit: 0
Base: f2cbde5ae16123b9bfda7352e5f1b13c815ed41f
Head: eec303d6360f98ac49d9841f57d4b325baff1b835ae50cb88bc923acf95d2ebd

```text
pair 1 ok
pair 2 ok
pair 3 ok
[skill-test] PASS: 2233 tests executed
```

- Đỏ trước sửa: 3/3 cặp fail (5/6 bộ); ca fail: `precompact.test.js` (2 ca compact restart) và `spec-gate.test.js` "5. first run".
- Sửa: đầu hai file đặt `TMPDIR/TMP/TEMP` = thư mục `mkdtemp` riêng, xoá trong `after`; không sửa điểm spawn nào.
- Chạy bằng `bash -c` vì vòng lặp viết theo cú pháp POSIX.
- Không commit. `AGENTS.md` đang có khối Codex do một lần cài Codex khác thêm lúc 10:44, không thuộc task.
