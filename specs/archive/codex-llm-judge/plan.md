# Codex LLM judge for N/A rubrics
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-11)
- Existing: 17 thước `type: llm` đang N/A ở `evals/codex/report-parity.md:115-131` vì "không có giám khảo LLM; chưa có dữ liệu hiệu chuẩn hợp lệ". 16/17 có `focus: last_message`; `specs/sau-keep/moi-ac-co-task` đọc file và không có lượt Codex (thuộc gói 4). Số gốc Claude khoá ở `evals/codex/fixtures/baselines.json`, chấm bằng giám khảo `claude-sonnet-5-5` của `claude plugin eval` (cờ `--judge-model claude-sonnet-5-5` ở các gói lean, ví dụ `specs/archive/lean-*/`); `claude plugin eval` không có chế độ chỉ chấm lại bản ghi có sẵn (`claude plugin eval --help`). Lượt Codex có sẵn theo `evals/codex/manifest.json`: 10 lượt mỗi ô ở `batch-all`, `batch-all-B` (research), `batch-all-C` (fix). Bài Claude còn lưu chỉ có research (`evals/archive/results-notes-20261008.tar.gz` → `research/_answers-lean/lean-sau-chon-kien-truc-theo-rang-buoc-{sonnet,opus-lan1}.txt`, `lean-sau-nguon-cu-mau-thuan-{sonnet,opus}-lan1.txt`, 10 lượt mỗi file, đúng các ô khoá); bài của specs/debug/fix/scout đã xoá cùng `evals/results`. Hàm cờ theo ô đã export: `flagCell` ở `evals/codex/rescore.mjs`. Scout và brainstorm có 0 thước so được (`report-parity.md:169`).
- Minimum change: một module prompt chung + script giám khảo có cache + bộ kiểm chỉ đọc cache + câu tổng hợp hiệu chuẩn + báo cáo; không chạy Codex.
- Expansion signals: none (gói 2 trong 4, `plans/20261011-codex-unmeasured.md`).
- User decision: KEEP — không đo Claude làm đối tượng (chỉ dùng Claude làm giám khảo), không push, không publish; scout/brainstorm chỉ mô tả phía Codex, ghi rõ không so được. Người thực thi: Codex (pane Orca); phiên Claude điều phối, ghi Status/Receipt, tự chấm lại một mẫu.

## Out of scope
- Chạy lại lượt Codex; sửa thước, ngưỡng, skill, bản chiếu; `specs/sau-keep` (gói 4); thước ánh xạ N/A; đo số gốc Claude mới.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Giám khảo `claude -p --model claude-sonnet-5-5` cô lập: `--setting-sources ""`, `--strict-mcp-config`, `--tools ""`, `--disable-slash-commands`, `--no-session-persistence`, system prompt cố định, `--json-schema` cho `{"pass": boolean, "reason": string}`, cwd tạm rỗng, gỡ biến `ORCA_*`/`HERDR_*`; 3 phiếu, lấy đa số; prompt dựng từ một module chung cho cả hai script | Một phiếu; chạy với settings của Bro | Cùng model và cùng 3 phiếu như giám khảo số gốc; settings/hook của Bro làm nhiễu và đổi theo máy | Đăng nhập OAuth vẫn dùng được khi tắt nguồn settings | Lời gọi thử thất bại vì đăng nhập → dừng, báo Bro, không dùng settings của Bro |
| D-02 | Hiệu chuẩn có cả mặt dễ dãi: (a) 4 file research `lean-sau` khoá 10/10; (b) các ô research còn bài và có FAIL thật (`research/_answers/base-*-agent-*`, `_answers-sau/sau-*`) chỉ khi văn bản thước lúc chạy giống hiện tại (so `git show <commit>:<thước>` với giờ bắt đầu ô); (c) mỏ neo miễn phí: 10 lượt `batch-all/specs/mo-ho-c1` (regex `mot-cau-hoi-c1` 0/10) phải FAIL `khong-tu-chot`; (d) mỗi thước 1 câu dương và 1 câu âm tổng hợp viết từ chính mệnh đề PASS/FAIL của thước, lưu trong repo; "Xong." là đối chứng âm, N/A cho thước chỉ có điều kiện phủ định (`khong-do-cho-list`). Đạt khi mọi dòng (a)(b) lệch ≤ 1, (c) ≥ 9/10 FAIL, (d) đúng hết | Chỉ hiệu chuẩn trên ô 10/10 | Ô 10/10 chỉ bắt FAIL giả; cần mẫu âm thật | Câu tổng hợp đại diện đủ cho thước tiếng Việt | Hiệu chuẩn không đạt → `verdict: REFERENCE`, số Codex chỉ tham khảo, không cờ |
| D-03 | Tập lượt: lượt mới (bản chiếu hiện tại) là tập chính: `specs-gate/{dung-o-c1,export-csv,mo-ho-c1,mo-ho-du-cua}`, `research-depth/{chon-kien-truc-theo-rang-buoc,nguon-cu-mau-thuan}{,-agent}`; lượt manifest cũ là tập "trước"; ca không có lượt mới (`sua-typo`, `khong-kich-hoat`, debug, fix, scout) chấm lượt cũ, nhãn `old-runner` | Chỉ lượt cũ | Bro chọn ở GATE-REVIEW; lượt cũ mô tả lỗi đã sửa (vd `khong-tu-chot` đòi bộ ba mà lượt cũ không có) | — | — |
| D-04 | Bảng nhãn cố định cho 16 key: `calibrated` (research non-agent), `uncalibrated` (specs, debug `khong-do-cho-list`, fix), `descriptive` (baseline `missing_current`/`current_small_sample`: research `-agent`, scout), `unflaggable` (`debug/loi-hien-nhien/gon-gang-llm`, khoá 1/10 và 0/10); chỉ `calibrated` mới kích hoạt gói sửa; `uncalibrated` được nâng thành `calibrated` khi (c)(d) của D-02 cho thước đó đúng hết | Một nhãn chung | Nói trước dòng nào ra được quyết định | — | — |
| D-05 | Mục mô tả scout/brainstorm: chấm slot manifest bằng `grade.mjs` có ánh xạ, in k/n từng thước H không phải `dem-*` kèm điều kiện chạy (brainstorm `user-home-role-verified`); không so Claude | Chấm không ánh xạ | Không ánh xạ thì gần như mọi thước tool là N/A | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | 16 thước LLM có điểm Codex (lượt mới và cũ) từ giám khảo cô lập, 3 phiếu, đã hiệu chuẩn cả hai mặt (hoặc nhãn rõ khi không), cờ theo luật parity; scout/brainstorm có số mô tả | add | evals/codex, AI/model | none | elevated: giám khảo nhiễm settings hoặc dễ dãi làm cờ sai; tốn tiền nếu chấm lại | live: lời gọi `claude -p` thật lưu nguyên output; lệnh kiểm chỉ đọc cache, kiểm hash, in hiệu chuẩn trước khi in cờ |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When every judgment is cached, the check shall verify each entry's hash over prompt, model, flags and CLI version and derive each vote from the stored raw output, exit 1 only for missing, stale or invalid cache, print every calibration row (D-02 a–d) and `verdict: PASS` when calibration holds or `verdict: REFERENCE` when it does not, print for each of the 16 keys, each Claude model and each run set the Codex majority score, the locked Claude score, the `flagCell` result and the D-04 label, print the scout/brainstorm descriptive scores, and the report shall list which calibrated keys are flagged on the new run set. | task-01 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Giám khảo LLM có hiệu chuẩn cho 16 thước | P1 | AC-01 | `evals/codex/llm-judge*.mjs`, `evals/codex/fixtures/llm-judge-synthetic.json`, `evals/codex/report-llm-judge.md` | - | done |

## Review log
- Round 1 (2 reviewer ngữ cảnh mới): 9 phát hiện H-01..H-09 sau khử trùng. Bro chấp nhận hết; H-01 chọn lượt mới làm chính, cũ làm "trước"; H-06 chọn 3 phiếu đa số, trần $60. Đã áp: tập lượt (H-01, D-03); cô lập giám khảo (H-02, D-01); hiệu chuẩn hai mặt (H-03, D-02); REFERENCE thay vì exit 1 (H-04); không cache invalid, cộng mọi chi phí, ngoại suy từ phần âm (H-05); 3 phiếu (H-06); bảng nhãn (H-07, D-04); lưu output gốc, module prompt chung (H-08); ghim file, mô tả có ánh xạ, mẫu 5 phán quyết là bằng chứng review (H-09, D-05).

## GATE-DONE
- 2026-10-12: Bro chấp nhận hoàn thành, không lập gói sửa. calibration PASS (a 6/6, anchor 10/10 FAIL, synthetic 32/32, negative 15/15); (b) loại cả 4 dòng; cost $8,17; tập new không cờ; `mo-ho-c1/khong-tu-chot` cũ 0/10 → mới 10/10. Giới hạn ghi backlog: `specs/{dung-o-c1,export-csv}/dung-truoc-khi-lam` tập new 4/10 và 3/10 (Codex không nêu phần cố ý để ngoài phạm vi; nhãn uncalibrated); prompt giám khảo khác `claude plugin eval`; n=10; debug/fix/scout chấm lượt runner cũ.
