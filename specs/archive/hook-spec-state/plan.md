# spec-state/spec-gate: nhanh hơn, không chặn repo chưa có commit, cảnh báo đúng phiên
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ.

## Scope decision (GATE-SCOPE — 2026-10-14)
- Existing:
  - `provenance.cjs` có memo snapshot theo `root\0specsRoot`, chỉ bật khi gọi `enableSnapshotMemo()` (`src/claude/scripts/provenance.cjs:236-251`). spec-gate hai host bật memo (`src/claude/hooks/spec-gate.cjs:96`, `src/codex/hooks/spec-gate.cjs:45`). spec-state hai host thì không, dù gọi `deriveRuntimeContext` (`src/claude/hooks/spec-state.cjs:243`, `src/codex/hooks/spec-state.cjs:104`) rồi `workflowDependencyProofState` (`src/claude/scripts/spec-receipt.cjs:297-311`; Claude `spec-state.cjs:260`, Codex `spec-state.cjs:121`).
  - **Đo 14/10:** spec-state Claude gọi `git status` 14–20 lần mỗi prompt (7–10 snapshot), tuỳ số task có heading `## Receipt` (1 + 3 × số task đó). Bật memo bằng preload thì còn 2. spec-gate có memo chỉ 2. Một snapshot trên repo cafekit mất 0,6–1 s.
  - Repo đã `git init` nhưng chưa commit: `gitBase` chạy `git log` và ném `git_command_failed` (`src/claude/scripts/provenance.cjs:86-104`). **Tái hiện 14/10:** spec-gate trả `{"decision":"block","reason":"Completion gate controlled failure: git log source base failed …"}` ở mọi lần Stop (catch ở `src/claude/hooks/spec-gate.cjs:252-256`). spec-state in "Spec tollgate unavailable".
  - Codex dùng chung script Claude: `loadModule` lấy `.codex/scripts/<file>` đã cài, nếu không có thì lấy `src/claude/scripts/<file>` (`src/codex/hooks/lib/spec-receipt.cjs:6-19`).
  - Claude spec-state in cảnh báo `multiple_active`/`invalid_specs` (`src/claude/hooks/spec-state.cjs:218-228`) trước bộ lọc packet đã chạm (`:241`), nên mọi phiên đều thấy. Codex lọc trước và resolve riêng từng packet đã chạm (`src/codex/hooks/spec-state.cjs:75-84`).
- Minimum change: bật memo ở spec-state hai host; một mã lỗi riêng cho HEAD chưa có commit và hai hook xử lý mã đó; Claude spec-state chỉ cảnh báo khi phiên đã chạm packet liên quan.
- Expansion signals: khoảng 10 file → 4 task, một subsystem (hook spec-state/spec-gate).
- User decision (14/10): **KEEP** (H + 2 M).
  - Repo chưa có commit: Stop không chặn; tollgate nhắc tạo commit đầu. Task đã done thì vẫn chặn, nhắc tạo commit đầu rồi lấy Base/Head sau commit đó.
  - Người thực thi: Codex (pane Orca). Phiên Claude điều phối và ghi Status/Receipt.

## Out of scope
- Các mục L:
  - cache `tollgate-last.txt` dùng chung mọi phiên (`src/claude/hooks/spec-state.cjs:302`);
  - ghi "đã chạm" cả khi Edit lỗi (`:158`);
  - regex cứng `specs/` (`:75`);
  - đưa `spec-session-touch.cjs` thành lib chung;
  - Codex sửa task bằng shell không ghi nhận chạm.
- Thư mục không phải git (GATE-REVIEW R2 = A): giữ `git_command_failed`/"controlled failure" như hiện tại; `bin/__tests__/develop-contract.test.js:827-839` không đổi.
- Đổi cách tính Base/Head, kiểm race hai lần trong `captureSnapshot`, hay luật ràng buộc Receipt.
- state/session/cài Codex (gói 4).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | spec-state Claude và Codex gọi `enableSnapshotMemo()` của chính `provenance.cjs` mà policy đã nạp, ngay sau khi nạp policy, giống spec-gate | Bật memo mặc định trong `provenance.cjs` | Memo chỉ sống trong một tiến trình hook, nên CLI `provenance.cjs` vẫn chụp mới mỗi lần | Policy và receipt dùng cùng một instance module `provenance.cjs` (reviewer xác nhận, đo 14→2) | Số `git status` mỗi prompt vẫn > 2 → kiểm hai module có nạp hai bản khác nhau không |
| D-02 | `provenance.cjs` ném `ProvenanceError` mã `no_git_history` **chỉ khi** `git symbolic-ref -q HEAD` thành công và `git show-ref --verify -q <ref đó>` trả exit 1 (HEAD chưa sinh: `git init` chưa commit, orphan branch). Kiểm trong `gitBase` trước `git log`. Mọi lỗi khác (ref hỏng, exit 128, `GIT_DIR` sai, không có git trong PATH/ENOENT, không phải repo) giữ `git_command_failed`. Hook: spec-state hai host in đúng một dòng nhắc tạo commit đầu rồi exit 0; spec-gate hai host không chặn khi không có task `done`; có task `done` thì chặn với lý do nhắc "repo has no commits yet; create the first commit, then record Base/Head after it". Lỗi provenance khác giữ "controlled failure" | Bỏ qua cổng hoàn toàn khi chưa commit; phân loại theo "probe thất bại" (xếp nhầm ref hỏng/128/ENOENT thành chưa commit → Stop không chặn) | Bro chọn: không chặn, nhắc | Mọi đường gọi `deriveRuntimeContext`/`checkWorkflowReceiptSet` (`src/claude/scripts/spec-receipt.cjs:314`) trong hai spec-gate đều đi qua nhánh xử lý | Stop vẫn chặn với "controlled failure" ở repo chưa commit → còn một đường gọi chưa xử lý |
| D-03 | Claude spec-state, khi `touchFilter` bật và payload không có feature tường minh: nếu resolver trả `multiple_active`/`invalid_specs` thì (1) candidates có `'<specs>'` (lỗi cấu hình, `src/claude/scripts/spec-resolver.cjs:496`) → in như cũ; (2) có ứng viên thuộc tập đã chạm → in như cũ; (3) ngược lại resolve riêng từng packet đã chạm như Codex (`src/codex/hooks/spec-state.cjs:77-84`) và in tollgate/lỗi của chúng; không chạm packet nào → exit 0 im lặng. `explicit_*`, omp, grok và payload không có `session_id` giữ hành vi cũ | Bỏ hẳn cảnh báo; chỉ lọc mà không resolve riêng (mất tollgate packet đã chạm khi packet khác hỏng) | Theo Codex; phiên đang làm packet đó vẫn được báo | Tập chạm được ghi trước khi resolve (`src/claude/hooks/spec-state.cjs:202-212`) | Test `a prompt touch is remembered even when two packets are active` đỏ → sai thứ tự đọc/ghi tập chạm |

## Known limitations (GATE-REVIEW)
- Thư mục không phải git vẫn bị chặn "controlled failure" ở Stop (R2 = A).
- spec-gate Stop vẫn chặn `multiple_active`/`invalid_specs` cho mọi phiên, kể cả phiên D-03 đã cho im lặng ở prompt; packet sửa bằng Bash không ghi chạm (mục L) nên phiên đó cũng không được báo trước (R8).
- Gate không kiểm Base/Head được lấy sau commit đầu: sau một commit bất kỳ không chứa file task, Receipt gõ tay đúng định dạng vẫn qua vì chỉ kiểm cấu trúc (`src/claude/scripts/spec-receipt.cjs:175-180`) (R10).
- Bản copy ở `.claude/` gốc repo bị gitignore (`.gitignore:115`), không vào commit; bản `.claude/scripts/provenance.cjs` đã cài đang chậm hơn nguồn (R11).

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | spec-state chụp worktree tối đa một lần mỗi prompt trên hai host | fix | hook spec-state Claude/Codex | none (D-01) | elevated; đo 14–20→2 | test đếm `git status` qua preload, trên layout `.claude` và `.codex` |
| CP-02 | Repo đã `git init` chưa commit: Stop không chặn khi chưa có task done; tollgate nhắc tạo commit; task done thì chặn với lời nhắc; lỗi git khác vẫn chặn "controlled failure" | fix | provenance, spec-gate/spec-state hai host | none (D-02) | elevated; tái hiện | test hook trong repo `git init` chưa commit, một packet và hai packet; test ref hỏng và không có git trong PATH |
| CP-03 | Claude spec-state không báo `multiple_active`/`invalid_specs` cho phiên không chạm packet nào trong đó, vẫn báo tollgate của packet đã chạm và lỗi cấu hình `<specs>` | fix | hook spec-state Claude | none (D-03) | elevated | test nhiều phiên |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a prompt reaches spec-state with an active packet that has done tasks, the hook shall run `git status` at most twice (one snapshot) on Claude and on Codex. | task-01 Command |
| AC-02 | While the project is a git repository whose HEAD has no commit, spec-gate shall not block a Stop for packets without done tasks, shall block with a "first commit" reason when a task is done, and spec-state shall print one first-commit reminder, on Claude and on Codex; when git fails for any other reason, spec-gate shall still block with "controlled failure". | task-02, task-03 Command |
| AC-03 | When several packets are active or a packet is invalid and the Claude session has touched none of them, spec-state shall print nothing; when it has touched one, it shall print the warning as before; when it has touched only a valid packet, it shall print that packet's tollgate; a `<specs>` configuration error shall always print. | task-04 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | spec-state bật memo snapshot hai host | P1 | AC-01 | 2 `spec-state.cjs`, `spec-state-touched.test.js`, `codex-hooks.test.js` | - | done |
| 02 | Repo chưa có commit: provenance + hook Claude | P1 | AC-02 | `provenance.cjs`, Claude `spec-gate.cjs`/`spec-state.cjs`, `spec-gate.test.js` | task-01-spec-state-memo.md | done |
| 03 | Repo chưa có commit: hook Codex | P2 | AC-02 | Codex `spec-gate.cjs`/`spec-state.cjs`, `codex-hooks.test.js` | task-02-no-commit-claude.md | done |
| 04 | Claude spec-state cảnh báo đúng phiên | P2 | AC-03 | Claude `spec-state.cjs`, `spec-state-touched.test.js`, `spec-gate.test.js` | task-03-no-commit-codex.md | done |

Chạy tuần tự theo chuỗi phụ thuộc: các task dùng chung hook spec-state, file test và hai changelog (`CHANGELOG.md`, `../../docs/project-changelog.md`, mục Unreleased).

## Review log
- 14/10 vòng giấy 1: ba reviewer ngữ cảnh mới (Fact+Flow, Failure-mode/Security, Contracts/Assumptions), cả ba CONCERNS; gộp còn 12 mục. Đứng vững: memo D-01 cùng instance module (đo 14→2), đếm bằng preload đáng tin, không lách D-02 bằng orphan/xoá `.git`, chuỗi 4 task tuần tự.
- GATE-REVIEW 14/10, Bro chấp nhận cả 12:
  - R1 Critical: test 41 (`src/claude/hooks/__tests__/spec-gate.test.js:1357-1379`) assert `controlled failure` cho HEAD chưa sinh có task done → task-02 được sửa đúng assertion đó sang `first commit`, giữ assert block.
  - R2 High: `bin/__tests__/develop-contract.test.js:827-839` assert `git_command_failed` cho thư mục không phải git → chọn A: chỉ HEAD chưa sinh mới là `no_git_history`.
  - R3 Medium: phân loại chặt bằng `symbolic-ref` + `show-ref` (D-02); test ref hỏng và không có git trong PATH.
  - R4 Medium: thêm ca hai packet đều done (`checkWorkflowReceiptSet`).
  - R5 High: D-03 resolve riêng packet đã chạm như Codex.
  - R6 Medium: luôn in lỗi `'<specs>'`.
  - R7 Medium: fixture packet hỏng chỉ dùng task thiếu `Status:`.
  - R8 Medium: ghi giới hạn Stop + test xác nhận.
  - R9 Medium: Steps ghi rõ fixture cần mở rộng; bỏ dự phòng `getHookContext` ở task-03.
  - R10 Low: lý do chặn thành lời nhắc + giới hạn.
  - R11 Low: đường copy-sync `../../.claude/...`, không commit.
  - R12 Low: sửa trích dẫn lệch dòng (`:313`→`:314`, `:251-255`→`:252-256`), số đo 14–20.
- 14/10 vòng giấy 2 (lượt đóng, ngữ cảnh mới): DONE — R1–R12 đóng; đỏ/xanh trước sửa đã chạy thử và khớp (task-02 (f)/(g) xanh trước; task-04 (a)/(b)/(e) đỏ, (c)/(d)/(f)/(g) xanh); phân loại đo trên git 2.56 và Apple git 2.54. Low còn lại: ca (f) giả định ref dạng file (không dùng `init.defaultRefFormat=reftable`); ca (g) hỏng ở `gitRoot` nên không đi qua nhánh ENOENT trong `gitBase` (nhánh đó không tới được).
- GATE-DONE 15/10: Bro chấp nhận hoàn thành, giữ 4 giới hạn ở trên và lưu ý Low trong Receipt task-04; commit 836df552, 0d898bf9, 81dc8843, 53e7f950; self-test cuối PASS 2062.
