# Task 01 — Tạo thư mục privacy Codex chịu được EEXIST

Status: done

## Outcome
Hai `privacy-block.cjs` của Codex chạy song song trong project chưa có `.codex/hooks/.privacy` đều trả deny có mã duyệt riêng; không lượt nào rơi vào `could not be evaluated safely`.

## Scope
- In: D-01; hai changelog.
- Out: khoá ghi trạng thái, các mkdir recursive khác.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/codex/hooks/lib/privacy-state.cjs`, `packages/spec/bin/__tests__/codex-hooks.test.js`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`

## Steps
1. Test trước (tất định): trong `codex-hooks.test.js`, require `privacy-state.cjs` của bản cài fixture (tiền lệ `codex-hooks.test.js:793`), tạo sẵn `.codex/hooks/.privacy`, bọc `fs.existsSync` để trả `false` khi `path.basename(p) === '.privacy'` (root đã qua `realpathSync`, nên không so đường dẫn đầy đủ), khôi phục trong `finally` → `createPending` trả bản ghi có `requestId`, không ném. Thêm ca `.privacy` là file thường → hook trả deny `could not be evaluated safely`. Chạy Command → phải thấy ca tất định đỏ thật (`EEXIST`) trước khi sửa.
2. Sửa `privacy-state.cjs:28` theo D-01.
3. Changelog.
4. Chạy Command. Không commit.

## Acceptance
- AC-01: ca tất định và ca file thường xanh; ca `parallel Codex privacy blocks…` xanh 8/8 lượt chạy riêng (bổ trợ: với tỉ lệ ~1/3, 8 lượt xanh còn ~4% trượt nếu lỗi còn); Command xanh.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && for i in 1 2 3 4 5 6 7 8; do node --test --test-name-pattern='parallel Codex privacy blocks' bin/__tests__/codex-hooks.test.js > /dev/null 2>&1 || exit 1; done && node --test bin/__tests__/codex-hooks.test.js && node scripts/run-skill-self-tests.mjs`
- Named probe: ca tất định mới; `parallel Codex privacy blocks preserve both markers and cannot be approved by y` (`codex-hooks.test.js:1041`).
- Reachability: hook Codex chạy từ cây cài fixture (`inHookFixture`).
- Oracle: ca tất định trả `requestId`; 8 lượt song song exit 0.
- Counterexample: giữ `existsSync` + `mkdirSync` → ca tất định ném `EEXIST`; ca song song fail ~1/3; vá sai kiểu `recursive: true` hoặc nuốt mọi lỗi → ca file thường đỏ.
- Artifacts: fixture tạm của test.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: cd packages/spec && for i in 1 2 3 4 5 6 7 8; do node --test --test-name-pattern='parallel Codex privacy blocks' bin/__tests__/codex-hooks.test.js > /dev/null 2>&1 || exit 1; done && node --test bin/__tests__/codex-hooks.test.js && node scripts/run-skill-self-tests.mjs
Exit: 0
Base: 32f41fe5248626c33df972f5addd8fd73a6f4255
Head: 12550e8c526e04e2c762c78fed9d6b527207aa894058eb0bd01c9837c5865ad8
```text
$ cd packages/spec && for i in 1 2 3 4 5 6 7 8; do node --test --test-name-pattern='parallel Codex privacy blocks' bin/__tests__/codex-hooks.test.js > /dev/null 2>&1 || exit 1; done && node --test bin/__tests__/codex-hooks.test.js && node scripts/run-skill-self-tests.mjs
✔ Codex privacy records a request when another hook creates its state directory first (54.538792ms)
✔ Codex privacy denies when its state path is a regular file (156.608542ms)
✔ parallel Codex privacy blocks preserve both markers and cannot be approved by y (492.847292ms)
ℹ tests 99
ℹ pass 99
ℹ fail 0
...
ℹ tests 42
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
[skill-test] PASS: 2295 tests executed
```
Rerun at the final Head after task-02 (the first Receipt bound Head 56150ffc…). Pre-change run: the deterministic case threw `EEXIST: file already exists, mkdir '…/.codex/hooks/.privacy'`, and the same Command failed with the parallel case red on iteration 7 of 8. Review: code-auditor PASS (Low: the regular-file case is guarded by the later `lstat` check, not by the new `catch`).
