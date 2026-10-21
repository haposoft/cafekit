# omp chạy thật: bridge nạp được, hook chạy được, privacy và touch đúng đường dẫn
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ. Bằng chứng runtime từ omp 18.12.1 và 18.12.3 (Bun 1.4.3) ngày 20/10, project tạm cài bằng `node bin/install.js --platform claude,omp --yes`; chuỗi binary trích ở `/private/tmp/claude-501/omp-strings.txt` (viết tắt S:<dòng>, bản 18.12.1).

## Scope decision (GATE-SCOPE — 2026-10-20)
- Existing:
  - Bridge là `src/omp/extensions/cafekit-bridge.mjs`, installer chép cả cây `src/omp/extensions` (`bin/phases/omp-runtime.js:111-130`). omp chỉ tự nạp `*.{ts,js}` và `*/index.{ts,js}` (S:488289-488290); extension thăm dò `.js` nạp được (cả khi project có `package.json` `"type":"commonjs"`), `.mjs` không. Hệ quả: chạy thật, `cat .env` không bị chặn.
  - Bridge chạy hook bằng `spawn(process.execPath, …)` (`src/omp/extensions/cafekit-bridge.mjs:151`); trong omp `process.execPath` là binary omp, nên khi bridge được nạp mọi hook timeout 8000 ms.
  - Event extension của `edit` đã có `path` và `paths` do omp tự thêm từ header (thăm dò live 18.12.3: `{"input":"[specs/alpha/plan.md#F2E7]…","path":"specs/alpha/plan.md","paths":["specs/alpha/plan.md"]}`; S:628594-628660). `ast_edit` gửi `{ops, paths}` (`paths` có thể là glob), kết quả có `details.fileChanges[].path`. spec-state chỉ ghi touch từ `tool_input.file_path` (`src/claude/hooks/spec-state.cjs:122-124`).
  - Test chập chờn: hook chạy từ source ghi trạng thái vào `os.tmpdir()/cafekit-hook-logs/claude` (`src/claude/hooks/lib/hook-state-dir.cjs:33-36`); `precompact.test.js` và `spec-gate.test.js` dùng chung với session id cố định; hai bộ hook test song song fail 4/6 lượt (log `/private/tmp/claude-501/flaky/`).
- Minimum change: cô lập TMPDIR test; bridge `.js` + gỡ `.mjs` cũ có kiểm hash; chạy hook bằng `node` an toàn; touch từ `paths`/`fileChanges`; vá privacy cho MV/rename, sloppy, read selector, eval; chứng minh bằng omp thật.
- Expansion signals: ~18 file chạm, 4 task — đã báo tại GATE-SCOPE và GATE-REVIEW.
- User decision: EXPAND; thiếu `node` → chặn và báo rõ. GATE-REVIEW 20/10: chấp nhận G1–G15, đưa G7/G8 vào gói, G3 chặn.

## Out of scope
- Event `input` không phát ở `omp -p` (thăm dò không thấy `input`): rules/tollgate không chèn khi chạy không tương tác.
- Glob và thư mục trong `ast_edit.paths` không được mở rộng cho privacy ghi; chỉ đường dẫn cụ thể.
- `vibe_spawn`, `lsp` rename và tool gọi bên trong `eval` (`evalTools`) chưa được gate; ghi giới hạn trong doc.
- Sự cố `AGENTS.md`/`CLAUDE.md` gốc repo bị xoá lúc 10:37:21 ngày 20/10: chưa rõ thủ phạm, đã khôi phục từ HEAD.
- Commit, push, publish.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Đổi tên `src/omp/extensions/cafekit-bridge.js` (ESM); `.omp/extensions/cafekit-bridge.mjs` cũ gỡ qua đường gỡ có kiểm hash ownership (giữ file đã sửa, chưa ghi nhận, symlink; cảnh báo cả khi chỉ cài omp) | Gỡ vô điều kiện bằng `removeObsoleteOmpHooks` (`bin/phases/omp-runtime.js:136-153`) | Khớp luật giữ file người dùng (`specs/archive/remove-legacy-hooks/plan.md:18`) | omp không nạp `.mjs` (S:488289) nên `.mjs` sót lại vô hại | — |
| D-02 | Bridge export `hookRunner()`: dưới Bun tìm `node` trong các mục PATH tuyệt đối (theo `path.delimiter`, PATHEXT trên Windows), loại ứng viên có realpath nằm trong project, resolve một lần; không thấy → event gating chặn với lý do `node was not found on PATH`; không dưới Bun → `process.execPath` | Gọi `bun` của omp | Hook là CommonJS Node; chặn repo chiếm `node` | `node` tuyệt đối có trong PATH | — |
| D-03 | Event gating (`tool_call`, `session_stop`): hook thoát mã ngoài {0, 2} hoặc bị kill bằng signal → chặn, nêu tên hook | Giữ "exit 1 không verdict = cho qua" | Shim `node` hỏng không được mở privacy | — | — |
| D-04 | Touch đọc `tool_input.file_path`, `tool_input.paths[]` và `tool_response.details.fileChanges[].path`; bridge chỉ chuyển các path này (không chuyển nguyên `details`) | Phân tích văn bản patch; chuyển nguyên `details` | omp đã thêm `path`/`paths`; `details` chứa nội dung cả file | omp giữ `paths`/`fileChanges` | fixture envelope thật đỏ khi omp đổi |
| D-05 | Privacy: thu đích `MV <dest>` (hashline) và `edits[].rename` (patch), header `*** Edit File:` (sloppy) như path ghi; `edit` có input chuỗi mà không rút được path nào → chặn; không alias `ast_edit` | Alias `ast_edit→Edit` | Alias miễn kiểm scope của inspect (`lib/inspect-paths.cjs:12,276`) | — | — |
| D-06 | Privacy: mỗi path còn được kiểm sau khi bỏ tối đa hai hậu tố `:<selector>` khớp `raw|conflicts|img|<khoảng dòng>`; tool `eval` quét token tên file trong `code` như lệnh shell | Chỉ kiểm path nguyên văn | `read {path:".env:raw"}` qua được (selector xác nhận live `specs/alpha/plan.md:-10`; S:513180-513200); `eval {code}` không có path key (S:777305-777320) | — | — |
| D-07 | Test hook đặt `process.env.TMPDIR/TMP/TEMP` riêng ở đầu `precompact.test.js` và `spec-gate.test.js`, trước khi require `hook-state-dir.cjs` | Session id ngẫu nhiên; sửa từng điểm spawn | Mọi điểm spawn và đường dẫn ở tiến trình cha cùng theo | `os.tmpdir()` đọc TMPDIR mỗi lần gọi (đã thử) | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Hai bộ hook test song song không fail vì trạng thái chung | fix | `precompact.test.js`, `spec-gate.test.js` | settled | routine | source: 3 cặp song song |
| CP-02 | Trên omp thật, bridge được nạp và hook chạy: `cat .env` bị chặn, `read README.md` không; thiếu node hoặc hook thoát lạ → chặn | fix, migrate | bridge, installer, manifest obsolete, test, doc | settled | critical — privacy | source + live (omp 18.12.x) |
| CP-03 | `edit` nhiều file và `ast_edit` vào packet ghi touch | fix | bridge payload, `lib/spec-touch.cjs`, `spec-state.cjs`; lib dùng chung với Codex qua shim (`src/codex/hooks/lib/spec-touch.cjs:3`) | settled | elevated | source + live |
| CP-04 | Privacy chặn MV/rename/sloppy vào file bảo vệ, read selector và eval đọc secret | fix | `lib/privacy-paths.cjs` (dùng chung với Codex qua `src/codex/hooks/lib/privacy-paths.cjs:1`) | settled | critical — privacy | source + live |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When hai bộ hook test chạy song song, both shall pass ba lượt liên tiếp. | task-01 Command |
| AC-02 | When omp 18.12.x khởi động trong project đã cài, it shall nạp bridge và chặn `cat .env`, không chặn `read README.md`; when không tìm được `node` hợp lệ hoặc hook gating thoát mã ngoài {0,2}, the bridge shall chặn và nêu lý do. | task-02 Command + phiên omp thật |
| AC-03 | When omp sửa file trong `specs/<packet>/` bằng `edit` (một hoặc nhiều file) hoặc `ast_edit`, the bridge shall ghi các packet đó vào touch state. | task-03 Command + phiên omp thật |
| AC-04 | When `edit` dùng MV/rename/sloppy tới file bảo vệ, `read` dùng selector trên file nhạy cảm, hoặc `eval` nhắc tên file nhạy cảm, privacy shall chặn. | task-04 Command + phiên omp thật |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Cô lập trạng thái hook trong test | P1 | AC-01 | `src/claude/hooks/__tests__/precompact.test.js`, `spec-gate.test.js` | - | done |
| 02 | Bridge `.js` được nạp và chạy hook bằng node | P1 | AC-02 | `src/omp/extensions/`, `bin/phases/omp-runtime.js`, manifest | task-01-isolated-hook-state.md | done |
| 03 | Touch cho edit nhiều file và ast_edit | P1 | AC-03 | bridge, `lib/spec-touch.cjs`, `spec-state.cjs` | task-02-bridge-loads-and-runs.md | done |
| 04 | Privacy omp: MV/rename, sloppy, read selector, eval | P1 | AC-04 | `lib/privacy-paths.cjs`, `bin/__tests__/omp-hooks.test.js` | task-03-edit-touch-paths.md | done |

Command chạy từ gốc repo. Chạy tuần tự (02–04 cùng sửa bridge/test omp, doc `docs/installer-architecture.md` và hai changelog mục Unreleased). **Luật fixture:** task sửa lib dùng chung không thêm `require` mới; nếu buộc phải thêm thì sửa luôn danh sách lib chép tay trong `spec-state-touched.test.js:39-41`, `codex-hooks.test.js`, `codex-quiet-hooks.test.js`, `develop-contract.test.js`, `orca-session.test.js`, `state.test.js`, `spec-gate.test.js` (chỉ phần danh sách) và ghi trong Receipt. Phiên omp thật: `omp -p --model google-antigravity/gemini-3.8-flash --mode json` trong project tạm cài mới; Receipt ghi `omp --version`. Oracle chung: Command exit 0, self-test in `[skill-test] PASS`.

## Review log
- 20/10 vòng giấy 1: ba reviewer ngữ cảnh mới (Fact Checker; Security + Failure-mode; Contract Verifier + Scope), cả ba CONCERNS. Thăm dò live 18.12.3 xác nhận omp thêm `path`/`paths` vào event `edit`, `.js` ESM nạp được dưới `"type":"commonjs"`, `read` có selector `:-10`.
- GATE-REVIEW 20/10 — Bro chấp nhận tất cả; G7/G8 đưa vào gói; G3 chặn:
  - G1 High: tiền đề hashline sai → D-04, task-03.
  - G2 High: gỡ `.mjs` không kiểm hash → D-01, task-02.
  - G3 High: shim `node` hỏng mở privacy → D-03, task-02.
  - G4 Medium: chiếm `node` qua PATH → D-02.
  - G5 High: đích MV/rename → D-05, task-04.
  - G6 Medium: sloppy + input không rút được path → D-05, task-04.
  - G7 High: read selector → D-06, task-04.
  - G8 High: eval → D-06, task-04.
  - G9 Medium: điểm spawn + tiến trình mồ côi → D-07, task-01 Command.
  - G10 Medium: phiên bản → "18.12.x", Receipt ghi `omp --version`.
  - G11 Medium: luật fixture + Codex → đoạn Tasks, CP-03/CP-04.
  - G12 Low: không alias `ast_edit` → D-05.
  - G13 Low: Windows → D-02.
  - G14 Low: `hookRunner` export mới, khôi phục env trong test → task-02.
  - G15 Low: thứ tự 01 cô lập test trước.
- Sweep: plan + 4 task viết lại / 15 delta / tên task, thứ tự, D-ID, CP, AC đã đối chiếu / 0 mâu thuẫn.
- GATE-DONE 21/10: Bro chấp nhận hoàn thành 4/4 task với các giới hạn đã nêu (flake Codex parallel privacy có sẵn, task-02 sửa code trước test, gỡ kiểm hash chỉ cho `extensions/` của omp, các tool omp chưa gate).
