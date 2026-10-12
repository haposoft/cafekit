# Codex specs routing remeasure
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-11)
- Existing: bản chiếu Codex của specs có ghi chú cổng phạm vi từ `3e4648ea` (`packages/spec/bin/lib/codex-install.js`, hằng `CODEX_SPECS_SCOPE_NOTE`); gói đó chỉ đo 4 ca cổng và ghi rõ "6 ca định tuyến chưa đo" (`specs/archive/codex-specs-scope-gate/plan.md`, GATE-DONE). 6 ca: `sua-typo`, `khong-kich-hoat` (chỉ trả lời), `lam-thang-doi-ten`, `lam-thang-xoa-module`, `sua-nho-lam-luon` (làm thẳng), `develop-auth` (`/cf:develop google-login`); lượt Codex cũ (trước ghi chú) ở `~/Desktop/cafekit-codex-eval/batch-all/specs/<ca>/1..10`, định dạng cũ. Thước của các ca này phần lớn là `tool_used` Edit/Write/Skill (`evals/specs/<ca>/graders/`), không chấm được trên lượt runner mới vì ánh xạ chỉ có cho slot manifest (`evals/codex/grade.mjs:140-145`, đã thấy ở `specs/archive/codex-test-review-remeasure`); `develop-auth/dung-blocked` là regex trên file, `tra-loi-thang` là thước LLM (giám khảo đã hiệu chuẩn ở `evals/codex/llm-judge*.mjs`, nhãn `uncalibrated` cho thước specs). Phát hiện "đã đọc skill specs" = output công cụ chứa `name: cf-specs` (`evals/codex/specs-check.mjs:83`). Runner: `node evals/codex/run.mjs --run --only specs/<ca> --out <thư mục mới>`.
- Minimum change: sửa `loadedSkills` của `develop-auth` + bộ kiểm đo kết quả trên đường dẫn fixture + nhóm `routing` cho giám khảo LLM + 60 lượt mới + 30 lượt đối chứng không ghi chú + báo cáo.
- Expansion signals: none (gói 3 trong 4, `plans/20261011-codex-unmeasured.md`).
- User decision: KEEP — chỉ đo, không sửa skill/bản chiếu; không đo Claude; không push, không publish. Người thực thi: Codex (pane Orca); phiên Claude điều phối, ghi Status/Receipt, tự kiểm lại.

## Out of scope
- Sửa skill, bản chiếu, thước; chạy lại 4 ca cổng; `sau-keep` (gói 4); đo Claude.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Kết quả đo trên đường dẫn của fixture (bỏ `.git`, `.agents`, `.codex`): lượt mới so với `workspace-before` (`run.mjs:112`), lượt cũ và đối chứng cũ so với `evals/specs/<ca>/fixture` (như `specs-check.mjs:34-42`). Đổi tên xong = `src/` và `test/` có `formatCustomerName`, không còn `fmtName`; gỡ module xong = không còn `src/legacy-export.js`, `test/legacy-export.test.js`, `src/app.js` không còn `legacy-export`; sửa README xong = có `nội bộ`, không còn `nôi bộ`; ca chỉ trả lời = không file fixture nào đổi; thêm `extra-artifacts` = file mới dưới `specs/`, `plans/` hoặc `.md` mới ngoài fixture | So cả cây với `buildRoom` mới; chấm tool_used | Cấu trúc phòng cũ (`.agents/skills/specs`, `.codex/scripts`) khác phòng mới; kết quả trên đĩa là điều người dùng thấy | — | — |
| D-02 | Gác cổng thừa đo ba cách: `overgate-final` (tin cuối có `NEEDS CLARIFICATION` hoặc đủ EXPAND, KEEP, CUT), `overgate-any` (bất kỳ `agent_message` nào như vậy, hoặc lời gọi `request_user_input`), `asked-stopped` (không đổi file fixture nào ở ca làm thẳng và tin cuối kết thúc bằng câu hỏi); kèm `skill-read` (output công cụ chứa `name: cf-specs`; lượt cũ chỉ đọc `command_execution.aggregated_output` như `specs-check.mjs:82`), `note-loaded` (output chứa chuỗi đánh dấu `CODEX_SPECS_SCOPE_MARKER`) và gác cổng thừa trong nhóm đã đọc skill | Chỉ tin cuối | Ghi chú đẩy câu hỏi vào tin cuối nhưng hỏi kiểu khác vẫn là gác thừa | — | — |
| D-03 | Ba nhánh: `new` (bản chiếu hiện tại, 10 lượt), `control` (worktree tạm ở `7304cdd1`, không ghi chú, cùng runner/home sạch, 5 lượt mỗi ca), `old` (batch-all, chỉ tham khảo, khác runner và home người dùng). Hồi quy do ghi chú khi `new` xấu hơn `control` theo tỉ lệ ≥ 0,2 (≥ 2/10 so với ≥ 1/5) ở: done/unchanged giảm, overgate-any/asked-stopped/extra-artifacts tăng, `tra-loi-thang` giảm (ca chỉ trả lời, nhãn uncalibrated); `develop-auth`: hồi quy khi dừng sai ≥ 3/10 và nhiều hơn control. Ngưỡng chênh quyết định; Fisher hai phía (`evals/lean/compare.mjs`) chỉ in tham khảo. `skill-read` tăng ≥ 3 so với control → dòng theo dõi, không phải hồi quy | So mỗi old ↔ new | Gói trước cho thấy runner một mình đổi hành vi (`report-specs-gate.md`, đối chứng 3/5, 4/5) | n=10/5 đủ thấy chênh lớn | Hồi quy → báo Bro, gói sửa cần GATE-SCOPE riêng |
| D-04 | `develop-auth`: sửa `evals/codex/manifest.json` thêm `develop` vào `loadedSkills` (Bro quyết ở GATE-REVIEW; lượt cũ thiếu `cf-develop`, 7/10 dừng vì không có skill); dừng sai = đọc `cf-specs` hoặc (không đổi file `src/` nào và task file không có `Status: blocked`), như `specs/archive/specs-fast-lane/plan.md` D-04; nhánh `old` của ca này ghi `invalid (no cf-develop)`; `node evals/codex/check-rooms.mjs` phải exit 0 sau khi sửa | Bỏ ca | Đo đúng việc `/cf:develop` không bị ghi chú cổng phạm vi chặn | Codex nạp được `cf-develop` khi có trong phòng | Phòng không có `cf-develop` sau sửa → dừng, báo |

## Self-check (phiên Claude đếm tay trên `batch-all/specs`, 2026-10-12)
- `old`: `sua-nho-lam-luon done 10/10`; `lam-thang-doi-ten done 10/10` (`src/`, `test/`); `lam-thang-xoa-module done 10/10` (gồm `test/legacy-export.test.js`); `sua-typo unchanged 10/10`; `khong-kich-hoat unchanged 10/10`; `develop-auth src-changed 3/10, blocked 0/10` (invalid, chỉ để kiểm bộ đo); `overgate-final 0/10` cả 6 ca; `skill-read` 0, 0, 3, 1, 0, 4 (sua-typo, khong-kich-hoat, lam-thang-doi-ten, lam-thang-xoa-module, sua-nho-lam-luon, develop-auth); `extra-artifacts` 4/10 ở `lam-thang-doi-ten` (lượt 1, 2, 4, 9) và `lam-thang-xoa-module` (lượt 2, 5, 7, 9), 0 ở ca khác; `tra-loi-thang` 10/10 ở `sua-typo`, `khong-kich-hoat` (cache nhóm `old` của gói giám khảo).

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Biết ghi chú cổng phạm vi có làm Codex hỏi phạm vi thừa, tạo plan thừa hoặc bỏ việc ở 6 ca định tuyến không | add, modify | evals/codex, AI/model | none | elevated: hồi quy định tuyến ảnh hưởng mọi việc nhỏ trên Codex; runner đổi lẫn vào | live: 60 lượt mới + 30 đối chứng; lệnh kiểm tự đo lượt cũ và đòi khớp mọi số ghim trước khi so |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the 6 cases run 10 valid clean-home times with the current projection and 5 times each from a no-note worktree, the check shall reproduce every pinned old count, compute the D-01 outcomes, D-02 gating counts and `tra-loi-thang` for the new, control and old arms, apply the D-03/D-04 regression rules against the control, and the report shall state per case whether the note caused a routing regression. | task-01 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Đo lại 6 ca định tuyến specs | P1 | AC-01 | `evals/codex/routing-check.mjs`, `evals/codex/report-specs-routing.md`, `evals/codex/manifest.json`, `evals/codex/llm-judge{,-check,-prompt}.mjs` | - | done |

## Review log
- Round 1 (2 reviewer ngữ cảnh mới): 10 phát hiện H-01..H-10 sau khử trùng. Bro chấp nhận hết; `develop-auth` chọn sửa manifest, đo đúng. Đã áp: `cf-develop` cho develop-auth và luật dừng sai (H-01, D-04); nhánh đối chứng không ghi chú (H-02, D-03); so theo đường dẫn fixture (H-03, D-01); gác cổng ba cách (H-04, D-02); `extra-artifacts` (H-05); `note-loaded` và dòng theo dõi đọc skill (H-06); `tra-loi-thang` cũ↔mới vào luật (H-07); ghim thêm số và kiểm cả `test/` (H-08); cho sửa tối thiểu `llm-judge-prompt.mjs` với nhóm `routing` (H-09); ngưỡng chênh quyết định, p tham khảo (H-10). `out of scope` "sửa thước" có ngoại lệ D-04 do Bro quyết.

## GATE-DONE
- 2026-10-12: Bro chấp nhận hoàn thành. regression: none; mới 10/10 làm xong hoặc không đổi file, gác cổng thừa 0, plan thừa 0 (cũ 4/10 ở hai ca); develop-auth có `cf-develop` → dừng sai 0/10 (đối chứng 0/5). Theo dõi: `lam-thang-doi-ten` skill-read 6/10 so với đối chứng 0/5, không gác cổng. Giới hạn: n=10/5; nhánh old khác runner và home; `tra-loi-thang` uncalibrated; CLI 0.162.1.
