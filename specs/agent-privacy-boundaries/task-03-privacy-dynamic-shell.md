# Task 03 — Privacy bắt lệnh shell động

Status: blocked
Blocker: chờ `specs/privacy-race-omp-cleanup` (phiên khác) xong — gói đó cũng sửa `packages/spec/bin/__tests__/codex-hooks.test.js`; một file một người ghi.

## Outcome
Hook privacy (Claude, Codex, omp dùng chung lib) hỏi khi một lệnh Bash đọc file nhạy cảm qua glob, biến gán trong cùng chuỗi lệnh, `$X/<tên nhạy cảm>`, hoặc tên nhạy cảm viết thẳng trong `$(…)`/backtick; không hỏi khi glob hay biến không trỏ tới file nhạy cảm.

## Scope
- In: D-02..D-05 trong `plan.md`.
- Out: toán hạng động (giải mã, `xargs` từ pipe, `find -exec`) và các dạng khác ở mục Out of scope của `plan.md`.

## Coverage
- CP-03

## Ownership
- Modify: `packages/spec/src/claude/hooks/lib/privacy-paths.cjs`, `packages/spec/src/claude/hooks/lib/privacy-command-analysis.cjs`, `packages/spec/bin/__tests__/privacy-paths.test.js`, `packages/spec/bin/__tests__/codex-hooks.test.js`, `packages/spec/src/claude/hooks/__tests__/privacy-block.test.js`
- Read: `packages/spec/src/claude/hooks/privacy-block.cjs`, `packages/spec/src/codex/hooks/privacy-block.cjs`, `packages/spec/src/omp/hooks/privacy-block.cjs`, `packages/spec/bin/phases/codex-runtime.js`

## Steps
1. Thêm nhóm test "dynamic shell" vào `privacy-paths.test.js` cho host `claude` và `codex` (dùng `fixture()` sẵn có), repo tạm có `.env`, `sub/.env`, `notes.txt`, HOME giả có `.ssh/id_rsa`:
   - phải hỏi: `cat .e*`, `cat ./.e*`, `cat sub/.e*`, `cat */.e*`, `cat ~/.ssh/id_*`, `cp .e?v /tmp/x`, `cd sub && cat .e*`, `f=.env; cat $f`, `export F=.env && cat "$F"`, `declare f=.env; cat $f`, `cat ${f:-.env}`, `f=.env sh -c 'cat $f'`, `cat "$HOME/.ssh/id_rsa"`, `cat $(echo .env)`, ``cat `echo .env` ``, `du -sh .* *` (hành vi chấp nhận, D-02);
   - không được hỏi: `wc -l *.txt`, `ls *.txt`, `ls */package.json`, `wc -l */*.txt`, `du -sh */`, `cat $FILE`, `f=.env cat $f`, `echo $PATH`, `cd "$D" && wc -l *.txt`, `cat "$HOME/notes.txt"`;
   - một test chạy `cat .e*` khi `path.matchesGlob` bị gỡ (theo mẫu `privacy-paths.test.js:91`) → vẫn hỏi.
   → chạy, thấy nhóm "phải hỏi" đỏ.
2. Chuyển `less "$HOME/.env"`, `cat $(echo .env)`, ``cat `echo .env` `` từ danh sách cho qua sang danh sách phải chặn ở `codex-hooks.test.js:2140-2178` và ở `src/claude/hooks/__tests__/privacy-block.test.js:212-236`; sửa comment `codex-hooks.test.js:2140-2142` và `privacy-block.test.js:212-215` theo quyết định GATE-REVIEW 2026-10-21. Các ca `$FILE`, `eval`, `find . -exec sh -c 'cat "$FILE"'` giữ nguyên là cho qua.
3. Trong `privacy-command-analysis.cjs`, trả mỗi toán hạng có phần mở rộng dưới dạng `{text, directory}` (thư mục theo `cd` đã theo dõi, `null` khi không xác định); ghi phép gán biến theo D-03; trả chữ cố định trong `$(…)`/backtick làm toán hạng của lệnh đọc (D-05).
4. Trong `privacy-paths.cjs` (`extractCommandPaths`, `:105-135`; truyền `cwd` từ `sensitivePaths`, `:299`): mở glob theo D-02 bằng matcher ở `:332-339`; thêm `$` vào mẫu nhận diện ở `:130` (D-04); thư mục `null` hoặc `readdir` lỗi → khớp theo tên, không ném lỗi.
5. Chạy lại Verification → xanh, cả bộ privacy cũ không đỏ.

## Acceptance
- AC-05: mọi lệnh "phải hỏi" ra `ask` (Claude) và `deny` (Codex).
- AC-06: mọi lệnh "không được hỏi" không ra quyết định.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && node --test bin/__tests__/privacy-paths.test.js src/claude/hooks/__tests__/privacy-block.test.js bin/__tests__/codex-hooks.test.js`
- Named probe: nhóm "dynamic shell" mới trong `privacy-paths.test.js`; test `Codex privacy denies sensitive names it can resolve, allows pure indirection` trong `codex-hooks.test.js`; nhóm "Accepted gap: pure indirection" trong `privacy-block.test.js` (90 test cả file).
- Reachability: test gọi hook thật qua `spawnSync`; host codex cài bằng `bin/install.js --platform codex` trong thư mục tạm.
- Oracle: exit 0; mọi test pass; số test > 0.
- Counterexample: hook hỏi `wc -l *.txt` hoặc `du -sh */` (quay lại lỗi đã sửa ở `privacy-paths.cjs:106-110`), hoặc bỏ qua `cat ./.e*` → test đỏ.
- Artifacts: thư mục tạm của test, test tự dọn (`after`).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
