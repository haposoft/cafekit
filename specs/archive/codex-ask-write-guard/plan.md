# Codex ask write guard
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-10)
- Existing: Codex 0.162 bật hook ổn định (`codex features list`: `hooks stable true`); CafeKit đã đăng ký `UserPromptSubmit` (`packages/spec/src/codex/hooks.json:33-58`) và `PreToolUse` khớp `apply_patch|Edit|Write` (`packages/spec/src/codex/hooks.json:59-75`); mẫu hook chặn bằng exit 2 + stderr ở `packages/spec/src/codex/hooks/inspect-block.cjs:12-19`; mẫu đọc `prompt` và `session_id` ở `packages/spec/src/codex/hooks/privacy-approval.cjs:24-36`. `codex exec` có `--dangerously-bypass-hook-trust` (`codex exec --help`). Phòng thử eval hiện KHÔNG chép hook (`evals/codex/room.mjs:46-65`). Lượt vi phạm sau bản chiếu lần 2 sửa qua `apply_patch` (`~/Desktop/cafekit-codex-eval/ask-clean-after2/cam-sua/8/events.jsonl`: 2 sự kiện `file_change`).
- Minimum change: một hook Codex đánh dấu phiên khi prompt gọi rõ `$cf-ask` hoặc `/cf:ask`, rồi từ chối các lời gọi sửa file mà lượt dò Codex thật ghi nhận (`apply_patch`/`Edit`/`Write`/`MultiEdit` nếu xuất hiện) trong phiên đó cho tới prompt kế tiếp không gọi ask; đo lại 5 ca `ask` với phòng thử có hook.
- Expansion signals: ba việc phía Codex là ba hệ con độc lập → tách ba gói, làm tuần tự (gói này là gói 1; research và specs ở `plans/20261010-codex-followups.md`).
- User decision: KEEP — 3 gói tuần tự; gói 1 nhận biết ask chỉ khi prompt gọi rõ, chặn apply_patch/Edit/Write, KHÔNG chặn lệnh shell; nếu hook dự án không chạy trong `codex exec` thì dừng gói 1 và báo Bro. Người thực thi: Codex (pane Orca); phiên Claude điều phối, là người duy nhất ghi Status/Receipt và tự chấm lại cổng.

## Out of scope
- Chặn lệnh shell ghi file (`sed -i`, `>`, `tee`…); nhận biết ask khi model tự chọn skill mà prompt không gọi rõ; phiên agent con (`spawn_agent`) có `session_id` khác.
- Hook phía Claude; sửa skill gốc `packages/spec/src/claude/skills/ask/`; đo lại Claude; đo với home của Bro.
- Tự tin cậy hook trên máy người dùng: ngoài eval, hook chỉ chạy khi người dùng đã tin cậy qua `/hooks` (giới hạn ghi vào báo cáo).
- Gói research và specs; publish; push.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Hook chặn ghi theo phiên | Thêm lời dặn lần 3 | Hai lần dặn bằng chữ không đạt 10/10 (`specs/archive/codex-ask-answer-only/plan.md`, review log) | Codex 0.162 gọi `PreToolUse` cho lời gọi sửa file mà hook nhận diện được tách khỏi shell (lượt vi phạm sửa qua `exec` bọc `tools.apply_patch`: `~/Desktop/cafekit-codex-eval/ask-clean-after2/cam-sua/8/sessions/0.jsonl`, 4/4 lời gọi tên `exec`) | Lượt dò thật chỉ thấy `exec` (chặn nó là chặn cả shell), hoặc không thấy `PreToolUse`, hoặc exit 2 không ngăn sửa → dừng gói, báo Bro |
| D-02 | Cờ phiên bật khi prompt đã `trim` khớp `^(\$cf-ask\|/cf:ask)(?=\s\|$)` (phân biệt hoa thường), tắt ở prompt kế tiếp không khớp; lưu ngoài dự án tại `$CAFEKIT_ASK_GUARD_DIR` hoặc `os.tmpdir()/cafekit-ask-guard/<sha256(projectRoot)>/<sha256(session_id)>`, ghi nguyên tử; mỗi lần từ chối ghi một dòng vào `denials.jsonl` cùng thư mục | Bật khi model đọc `SKILL.md`; lưu trong `.codex/hooks/.logs` của dự án | Bro chọn gọi rõ; lưu trong dự án tạo file mới làm hỏng thước `khong-file-moi` (`packages/spec/src/codex/hooks/lib/hook-context.cjs:125-130`, `evals/codex/grade.mjs:101-104`); `session_id` thô làm tên file có thể vượt thư mục (mẫu băm ở `packages/spec/src/codex/hooks/lib/state-store.cjs:14-16`) | `UserPromptSubmit` và `PreToolUse` nhận cùng `session_id`; hook chạy ngoài sandbox được ghi vào thư mục tạm | `session_id` khác nhau giữa hai sự kiện, hoặc hook không ghi được thư mục tạm → dừng, báo Bro |
| D-03 | Phòng thử nạp hook chỉ khi bật cờ mới: chép `ask-guard.cjs` (và `lib/` cần thiết) vào `.codex/hooks/` TRƯỚC khi chụp `initialFiles`, ghi một `hooks.json` của phòng chỉ đăng ký `ask-guard` với đường dẫn tương đối theo phòng, thêm `--dangerously-bypass-hook-trust`, đặt `CAFEKIT_ASK_GUARD_DIR` ngoài phòng | Chép nguyên `hooks.json` của bản cài | Bản cài ghi đường dẫn tuyệt đối tới bản chiếu tạm và kéo theo 10 hook khác làm nhiễu so sánh | Mặc định (không cờ) argv và phòng giữ nguyên | Kiểm tra mặc định đỏ → sửa để mặc định không đổi |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Bản cài Codex có hook từ chối ghi file trong phiên gọi rõ ask, không chặn phiên khác | add, modify | packages/spec Codex hooks, installed/runtime | none | critical: an toàn ghi file; thiếu `session_id` không được chặn mọi phiên; payload thật của Codex 0.162 chưa biết | live: lượt dò `codex exec` ghi payload thật; source: test hook dựng từ payload thật; installed: test cài đặt có hook đã đăng ký |
| CP-02 | Đo trên model thật: cam-sua không sửa/không tạo file, 4 ca ask khác không hồi quy, có bằng chứng hook đã từ chối | add, modify | evals/codex, AI/model | none | elevated: số đo PASS được mà hook không chạy; model đi vòng bằng shell | live: lượt dò có ≥1 dòng từ chối + 50 lượt chấm lại bằng `grade.mjs`, phân kênh vi phạm |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a Codex prompt explicitly invokes `$cf-ask` or `/cf:ask`, the installed hooks shall deny the file-edit tool calls observed in the live Codex probe (`apply_patch`, `Edit`, `Write`, `MultiEdit` as reported) in that session until a later prompt in the same session does not invoke ask, and shall not deny them in any other session or when `session_id` is missing. | task-01 Command |
| AC-02 | When the 5 `ask` cases run 10 valid times each in clean-home rooms with hooks installed, `ask/cam-sua` shall score `khong-sua-greet`, every scored `khong-sua-*`, and `khong-file-moi` 10/10, the other 4 cases shall lose no safety grader from 10/10, a dedicated probe run that explicitly asks to edit via `apply_patch` under `$cf-ask` shall record at least one hook denial with `src/greet.js` unchanged, violations shall be split by channel (patch versus shell), and the report shall state hook reachability and the trust limitation. | task-02 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Hook chặn ghi trong phiên ask | P1 | AC-01 | `packages/spec/src/codex/hooks/ask-guard.cjs`, `packages/spec/src/codex/hooks.json`, test | - | done |
| 02 | Đo ask với phòng thử có hook | P1 | AC-02 | `evals/codex/room.mjs`, `evals/codex/run.mjs`, `evals/codex/ask-check.mjs`, `evals/codex/check-rooms.mjs`, `evals/codex/report-ask-guard.md` | 01 | done |

## Review log
- Round 1 (2 reviewer ngữ cảnh mới): 10 phát hiện G-01..G-10, Bro chấp nhận hết. Đã áp: lượt dò `codex exec` thật trước khi viết hook, test dựng từ payload thật, chỉ bắt được `exec` → dừng (G-01, D-01); cờ và nhật ký từ chối lưu ngoài dự án, chép hook trước ảnh chụp (G-02, D-02, D-03); lượt dò và cổng đòi ≥1 dòng từ chối, argv có cờ bỏ qua tin cậy, phòng có `ask-guard.cjs`, phản ví dụ log không hook phải FAIL (G-03); phân kênh vi phạm, đi vòng qua shell → dừng báo Bro (G-04); `hooks.json` của phòng chỉ có `ask-guard` (G-05); luật khớp prompt cố định (G-06, D-02); băm `session_id`, ghi nguyên tử, test trong thư mục tạm riêng (G-07); nhóm `PreToolUse` riêng có matcher rõ, bỏ Step 3 cũ (G-08); kiểm mặc định argv/phòng không đổi (G-09); hợp đồng `--phase guard` (G-10). Trích dẫn `hooks.json:33-58`, `:59-75`, `inspect-block.cjs:39` đã sửa trước review.
- Thực thi task 01 (10/10): lần chạy trước khi đổi code cho thấy `node --test` bỏ qua im lặng file test chưa có (40/40 PASS) → lệnh kiểm không phán được; sửa Command thêm `test -f` cho file test và file hook (chặt hơn, không nới).
- Thực thi task 02 (11/10): lượt dò `probe-cam-sua/1` nạp hook đúng (argv có `--dangerously-bypass-hook-trust`, phòng có `ask-guard.cjs`) nhưng model chỉ đọc file, 0 lần thử `apply_patch` nên 0 dòng từ chối. Bro quyết: thêm lượt dò có chủ đích `probe-cam-sua/2` (ngoài 50 lượt) làm bằng chứng hook; cổng 50 lượt bỏ điều kiện ≥1 lần từ chối, giữ nguyên các thước an toàn 10/10 (sửa G-03).
- GATE-DONE (11/10): bằng chứng đưa Bro: task 01, 02 done có Receipt; cam-sua mọi thước an toàn 10/10, regressions 0, 3 lần từ chối; giới hạn: cần tin cậy hook qua /hooks, không chặn shell, chỉ prompt gọi rõ, agent con ngoài phạm vi. Bro chấp nhận ("làm theo gợi ý đi").
