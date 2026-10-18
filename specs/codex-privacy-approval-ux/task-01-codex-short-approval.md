# Task 01 — Duyệt privacy Codex bằng một chữ

Status: done

## Outcome
Sau khi privacy Codex chặn, nếu chỉ có đúng một yêu cầu chờ, người dùng gõ `y`, `yes` hoặc `có` ở prompt kế tiếp là cấp quyền đúng các path đó trong 1 giờ, và agent được dặn báo lại path; câu mã dài vẫn dùng được.

## Scope
- In: D-01 (`privacy-state.cjs`: marker riêng mỗi lần chặn (cờ `wx`), dùng lại `requestId` khi chặn lại đúng tập path, giành mọi marker của phiên atomic, duyệt khi giành được đúng một; `cleanup`/`clearState` cũng xoá marker hết hạn hoặc của phiên; `privacy-approval.cjs`: giành marker ở mọi prompt trước mọi việc khác, nhận chữ duyệt); D-02 (`privacy-block.cjs:44-48` + ngữ cảnh sau duyệt); D-03 (`src/codex/rules/hook-protocols.md:7-20`); `../../docs/installer-architecture.md:336`; test; hai changelog (`CHANGELOG.md`, `../../docs/project-changelog.md`, Unreleased).
- Out: privacy Claude, omp; TTL; phạm vi quyền.

## Coverage
- CP-01

## Ownership
- Modify: `src/codex/hooks/lib/privacy-state.cjs`, `src/codex/hooks/privacy-approval.cjs`, `src/codex/hooks/privacy-block.cjs`, `src/codex/rules/hook-protocols.md`, `bin/__tests__/codex-hooks.test.js`, `bin/__tests__/codex-native-hook-boundaries.test.js` (chỉ ca ghim câu chặn), `bin/__tests__/privacy-paths.test.js` (chỉ ca ghim câu chặn), `bin/__tests__/orca-session.test.js` (chỉ danh sách lib chép, nếu thêm `require`), `bin/__tests__/codex-native.test.js:289-299` (đọc; giữ nguyên hai câu đang ghim), `../../docs/installer-architecture.md` (dòng 336), hai changelog
- Probe tĩnh trong `scripts/run-skill-self-tests.mjs` ghim chữ `hook-protocols.md` Codex hoặc câu chặn: cập nhật đúng theo câu mới, nêu trong Receipt.
- Read: `src/codex/hooks.json`, `src/codex/hooks/lib/hook-context.cjs`

## Steps
1. Thêm test vào `codex-hooks.test.js`, chạy hook thật bằng `spawnSync` trên layout chép từ `src/codex/hooks` (như các ca privacy hiện có ở `:938-1065`):
   - chặn rồi prompt `y` (cùng phiên) → quyền được cấp, đọc lại không bị chặn; lặp với `yes`, `Có`, ` y ` (khoảng trắng hai đầu).
   - chặn, prompt khác (`ok làm đi`), rồi `y` → không cấp.
   - chặn rồi `y` ở phiên khác → không cấp; `y` khi không có pending → không cấp, không lỗi.
   - `y nhé`, `yes please`, `yy` → không cấp.
   - chặn hai lần (file A rồi file B) rồi `y` → không cấp gì; sau đó câu mã của A → chỉ A được cấp.
   - hai lần chặn chạy song song (spawn bất đồng bộ cùng lúc, file A và B) rồi `y` → không cấp gì.
   - chặn lại đúng file A hai lần rồi `y` → cấp A (cùng `requestId`).
   - chặn A, prompt chen giữa làm hook lỗi **sau khi đã giành marker** (ví dụ bước xử lý sau ném lỗi) rồi `y` → không cấp. (Trường hợp `.privacy` không liệt kê được ở prompt chen giữa nằm trong Known limitations.)
   - chặn A, SessionStart `compact`, rồi `y` → không cấp, không còn marker của phiên.
   - `ｙ` (toàn khổ), `y` + `\u200b` → không cấp; `có` dạng NFD, `CÓ`, `Y\r\n` → cấp.
   - marker không giành được (giả lập: thư mục marker không ghi được hoặc file marker hỏng) → không cấp, hook exit 0.
   - ngữ cảnh sau khi duyệt (chữ ngắn và câu mã) dặn agent báo người dùng các path vừa được cấp.
   - pending quá hạn (ghi đè `expiresAt`) rồi `y` → không cấp.
   - chặn, prompt khác, rồi câu mã dài đúng → cấp như cũ.
   - câu chặn chứa `y (or yes / có)` và `APPROVE CAFEKIT PRIVACY <24 hex>`.
   Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; cập nhật ca ghim câu chặn; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-01: các ca trên đúng; Command xanh.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/bin/__tests__/privacy-paths.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/orca-session.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test chữ ngắn mới.
- Reachability: `privacy-approval.cjs` đăng ký ở `UserPromptSubmit` (`src/codex/hooks.json`); hook chạy bằng `spawnSync`.
- Oracle: Oracle chung của plan.
- Counterexample: bỏ bước giành marker ở prompt khác → ca "prompt khác rồi y" đỏ; duyệt mới nhất thay vì đúng một → ca "hai lần chặn" đỏ; nuốt lỗi rồi vẫn cấp → ca marker hỏng đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/bin/__tests__/codex-native-hook-boundaries.test.js packages/spec/bin/__tests__/privacy-paths.test.js packages/spec/bin/__tests__/codex-native.test.js packages/spec/bin/__tests__/orca-session.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: 8e714fe4b42445fdacfd8ac068f5b1b9e88afe4a
Head: 1a51413ebfba32b0bdee61b7c31e69bc1b9f14065520a797de4addd3996d8f5c

```text
ok 38 - Codex short privacy approval accepts y and reports granted paths
ok 42 - Codex short privacy approval accepts decomposed Vietnamese and reports granted paths
ok 45 - Codex short privacy approval is cancelled by an intervening prompt
ok 46 - Codex short privacy approval stays in its session and requires pending state
ok 50 - Codex short privacy approval rejects fullwidth letter
ok 51 - Codex short privacy approval rejects zero-width suffix
ok 52 - Codex short privacy approval refuses two requests while the long phrase selects one
ok 53 - parallel Codex privacy blocks preserve both markers and cannot be approved by y
ok 55 - a later Codex block restores the short marker for the same pending request
ok 57 - a Codex prompt error after claiming markers cancels the short approval
ok 59 - a corrupt Codex short marker cannot grant permission even with valid pending state
ok 61 - an unclaimable Codex short marker is cancelled after rename and unlink errors
ok 62 - Codex compact clears pending requests and short markers only for its session
ok 63 - Codex short approval cannot grant an expired pending request
ok 65 - Codex long privacy approval still works after an intervening prompt and reports paths
# tests 435
# pass 435
# fail 0
# skipped 0
# todo 0
[skill-test] PASS: 2217 tests executed
```

- Đỏ trước sửa (Codex báo): 17/431.
- Vòng sửa 1: ca "`.privacy` không liệt kê được ở prompt chen giữa" mâu thuẫn Known limitations của plan; controller sửa Step 1 thành lỗi sau khi đã giành marker và ghi giới hạn (Codex tái hiện được lỗ bằng `readdirSync` lỗi rồi hồi phục). Không đổi code để né.
- Vòng sửa 2 (review controller): chặn lại đúng tập path ở lượt sau dùng lại `requestId` nhưng không tạo lại marker → `y` mất tác dụng; sửa: tạo lại marker bằng `wx`, chỉ bỏ qua `EEXIST`; ca mới đỏ trước, xanh sau.
- Counterexample (Codex báo): bỏ giành marker ở prompt khác → ca prompt chen giữa đỏ; duyệt mới nhất → ca hai yêu cầu đỏ; nuốt lỗi giành → ca marker hỏng đỏ; bỏ giành lại trong `catch` → ca lỗi sau khi giành đỏ; hoàn tác khớp byte.
- Review controller: mọi nhánh lỗi không cấp quyền; chỉ cấp khi giành được đúng một marker hợp lệ cùng phiên, chưa hết hạn; câu mã dài vẫn chạy; rule Codex và `docs/installer-architecture.md` khớp code (dùng lại 1 giờ, không gắn tool). Commit 8e714fe4.
