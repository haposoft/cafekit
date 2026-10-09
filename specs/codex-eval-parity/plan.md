# Codex eval parity
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-09)
- Existing: Codex đã tự chấm 12 skill (`plans/20261008-codex-regrade/SUMMARY.md`), nhưng khoảng một nửa thước là N/A vì bộ chấm chỉ biết Bash/regex/file (`plans/20261008-codex-regrade/graders.cjs:12-17`). Nhật ký Codex nằm ở `~/Desktop/cafekit-codex-eval/` (`batch-all/`, `batch-all-B/`, `batch-all-C/`, `calib-all-A/`, kèm `sessions-*` cho một số skill). Bộ chạy và chấm thật nằm rải ở `plans/20261008-codex-regrade/*.cjs` và `~/Desktop/cafekit-codex-eval/**/controller-*`. Quy ước đo ở `plans/20261008-codex-regrade/conventions.md:5-14`. Eval Claude chạy qua `evals/run.sh:130`.
- Minimum change: ánh xạ sự kiện Codex thay cho công cụ Claude, có hiệu chỉnh theo từng thước; chấm lại offline nhật ký Codex đã có, so với số gốc Claude trong `evals/archive/`. Giám khảo LLM đã bị bỏ ở GATE-REVIEW vòng 2 (không có dữ liệu hiệu chỉnh hợp lệ).
- Expansion signals: bộ chạy hiện là 76 file `.cjs` rời trong `plans/` bị gitignore (`.gitignore:107`) cùng nhiều biến thể `controller-*`; gom về `evals/codex/` tách thành ba task.
- User decision: KEEP, với bốn điều chỉnh: commit ứng viên 0.18.2 trước rồi đo trên commit đó; KHÔNG đo lại Claude (dùng số gốc cũ, ghi rõ giới hạn); bộ chạy đưa vào `evals/codex/`; làm gói này trước, sửa lỗi `ask` ở gói sau. Người thực thi: Codex (các pane Orca), phiên Claude điều phối và là người duy nhất ghi Status/Receipt.

## Out of scope
- Đo lại Claude (kể cả 24 cặp ca–model thiếu số gốc và thước V `sync` lệch dụng cụ).
- Định nghĩa lại thước định tuyến `tool: Skill`; phát lại `context.history_file`; đo hook trong vòng lặp model; thêm model Codex thứ hai; viết bộ ca cho skill chưa có.
- Giám khảo LLM cho cả 17 thước `type: llm`: ghi N/A kèm lý do. Debug/fix/scout/specs không có câu trả lời Claude trong lưu trữ; research chỉ có ô 0/10 là lượt lỗi hết hạn mức nên không dựng được lớp FAIL (GATE-REVIEW vòng 2, N-01).
- Sửa skill, thước, ngưỡng; sửa lỗi `ask/cam-sua`; publish hay push; thay đổi `AGENTS.md`/`CLAUDE.md`.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Chấm lại offline nhật ký Codex đã có | Chạy lại toàn bộ ~750 lượt Codex | Đã kiểm 2862/2863 file trong bảng vân tay khớp cây hiện tại (chỉ lệch `run.cjs` đã duyệt) | Vân tay các đường dẫn có commit và có trong bảng `sha256` (`packages/spec/src/**`, `packages/spec/bin/**`, `evals/run.sh`, `evals/*.mjs`, `evals/<skill>/**`) khớp commit của task 01; đường dẫn không có vân tay ghi là "chưa khoá" | Đường dẫn dùng chung lệch → mọi skill phải chạy lại; `evals/<skill>/` lệch → chạy lại skill đó; danh sách chạy lại chờ Bro duyệt |
| D-02 | Ánh xạ chỉ bật cho một thước khi thước đó qua đối chứng dương và âm trên lượt thật cùng điều kiện chạy | Bật ánh xạ theo loại công cụ | Thước `input_match` neo vào JSON Claude có thể PASS rỗng | Có lượt thật chứa và không chứa hành vi đó | Không đủ đối chứng → thước giữ N/A kèm lý do |
| D-03 | Không dùng giám khảo LLM; 17 thước `llm` N/A | Giám khảo `claude -p` Sonnet cho research | Lớp FAIL trong lưu trữ chỉ gồm lượt lỗi hết hạn mức; giám khảo luôn-PASS đạt 80% | Không có nhãn từng lượt hợp lệ | Có số gốc Claude mới kèm câu trả lời → gói sau |
| D-04 | Một manifest lượt chuẩn có commit làm nguồn duy nhất cho chấm lại | Quét `batch-all/**` | Lượt chuẩn của research/fix ở `batch-all-B`/`batch-all-C`; có lượt attempt/replacement/before-5d | Mỗi skill có đúng một thư mục chuẩn và luật chọn slot | Slot trùng hoặc thiếu → check báo lỗi |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Ứng viên 0.18.2 nằm trong commit cục bộ, đủ file, test xanh | integrate | git, packages/spec | none | elevated: thiếu file mới làm hỏng hook Codex | source: porcelain sạch + self-test + node test |
| CP-02 | Phòng thử, runner và manifest lượt chuẩn trong `evals/codex/` | add, migrate | evals/codex, Integration/proof | none | elevated: đọc nhầm nhật ký làm sai mọi số | source: dựng 68 phòng thử, manifest không trùng/thiếu |
| CP-03 | Bộ chấm regex/files/file_exists/Bash gộp, chấm lại toàn bộ lượt chuẩn khớp verdict đã lưu hoặc nêu lý do lệch | add, migrate | evals/codex | none | elevated | source: replay toàn bộ |
| CP-04 | Thước V của sync/git chấm lại được qua bộ chấm mới | add, migrate | evals/codex, evals/sync, evals/git | none | elevated | source: replay V |
| CP-05 | Thước công cụ Claude (Edit/Write/Agent/Web/Read/Grep/Glob) chấm được bằng sự kiện Codex khi đã hiệu chỉnh theo thước | add | evals/codex, AI/model | none | elevated: đếm sai làm lệch kết luận an toàn | source: đối chứng dương/âm theo thước |
| CP-06 | Báo cáo so sánh mới cho 12 skill | modify | evals/codex | none | routine | source: chấm lại + kiểm số |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the 0.18.2 candidate is committed, `git status --porcelain --untracked-files=all -- packages evals docs` shall be empty, HEAD shall differ from `4128698a`, `AGENTS.md`/`CLAUDE.md` shall stay out of the commit, and the self-test and node tests shall pass. | task-01 Command |
| AC-02 | When `node evals/codex/check-rooms.mjs` runs, it shall build 68 rooms from case scaffolds plus the real Codex install output and validate the committed manifest with no duplicate or missing canonical slot. | task-02 Command |
| AC-03 | When `node evals/codex/check-replay.mjs` runs, every canonical run shall be re-scored and every verdict mismatch against the saved result shall be listed with its cause. | task-03 Command |
| AC-04 | When `node evals/codex/check-v.mjs` runs, the V graders of sync and git shall re-score canonical runs equal to the saved verdicts or list each mismatch with its cause. | task-04 Command |
| AC-05 | If a grader using a mapped tool lacks a passing positive and negative control on real runs of the same run condition, the grader shall stay N/A with a reason. | task-05 Command |
| AC-06 | When re-scoring completes, the report shall list for each of the 12 skills the comparable grader count before and after, the run conditions, every flag with its reading, every `llm` grader as N/A with its reason, and any cell re-run because of source drift. | task-06 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Commit ứng viên 0.18.2 | P1 | AC-01 | git (không sửa file) | - | done |
| 02 | Phòng thử, runner, manifest lượt chuẩn | P1 | AC-02 | `evals/codex/room.mjs`, `run.mjs`, `manifest.json` | 01 | done |
| 03 | Bộ chấm gộp, chấm lại toàn bộ | P1 | AC-03 | `evals/codex/grade.mjs` | 02 | done |
| 04 | Thước V sync/git | P1 | AC-04 | `evals/codex/grade-v.mjs` | 02 | done |
| 05 | Ánh xạ sự kiện có hiệu chỉnh theo thước | P1 | AC-05 | `evals/codex/mapping.mjs` | 03 | done |
| 06 | Chấm lại và báo cáo 12 skill | P2 | AC-06 | `evals/codex/report-parity.md` | 04, 05 | done |

## Review log
- Round 1 (3 reviewer ngữ cảnh mới): 13 phát hiện R-01..R-13, Bro chấp nhận hết; `AGENTS.md`/`CLAUDE.md` để ngoài commit; giám khảo thu về research. Đã áp: task-02 cũ tách thành 02/03/04; ánh xạ thành task 05, giám khảo task 06 phụ thuộc 05; báo cáo task 07. Sweep: 8 file đọc lại / 13 delta / trích dẫn `run.sh:104` sửa thành `:130`.
- Closure vòng 1 (ngữ cảnh mới): R-01..R-13 đều PASS; lộ 5 điểm mới N-01..N-05.
- Round 2: Bro bỏ task-06 giám khảo (N-01), chấp nhận N-02..N-05 (ownership `mapping-calibration.json`; duyệt chạy lại đọc từ `evals/codex/rerun-approval.json` do phiên Claude ghi; vân tay thêm `packages/spec/bin/**`, `evals/run.sh`, `evals/*.mjs`; mỗi task tự commit file mình tạo, chưa push). Gói còn 6 task.
- Closure vòng 2 (ngữ cảnh mới): N-02, N-03 PASS; N-01, N-04, N-05 hở (tham chiếu treo task-03; Oracle task-06 thiếu kiểm 17 thước `llm`; 11/16 `evals/*.mjs` không có vân tay; `git commit` không pathspec khi 03/04 song song). Đã vá trong phạm vi quyết định đã duyệt: bỏ tham chiếu giám khảo ở task-03; probe/Oracle task-06 thêm `llm N/A with reason: 17/17` và `unlocked paths`; luật "chưa khoá" cho đường dẫn không có vân tay (D-01, task-06); commit bằng `git commit -- <paths>`, 03/04 commit lần lượt. Kiểm lại bằng grep (tác giả, không phải ngữ cảnh mới): 0 tham chiếu `giám khảo (task 06)`, 5/5 task có `git commit -m <message> -- <đường dẫn>`, task-06 có cả ba dòng probe mới.
- Thực thi task 04 (09/10): Codex dừng vì `develop` không có thước V (kết quả chuẩn chỉ có H; `evals/develop/` không có `verify-run.mjs`, chỉ có chỉ số joint suy từ H ở `evals/develop/compare.mjs:24`). Lỗi dữ kiện của plan; sửa bằng cách thu hẹp: task 04 chỉ còn V của sync và git (CP-04, AC-04, task 04). Không thêm phạm vi.
