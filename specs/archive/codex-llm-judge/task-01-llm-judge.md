# Task 01 — Giám khảo LLM có hiệu chuẩn cho 16 thước

Status: done

## Outcome
16 thước LLM đang N/A có điểm Codex (tập lượt mới và tập "trước") từ giám khảo `claude-sonnet-5-5` cô lập, 3 phiếu đa số, đã hiệu chuẩn cả mặt FAIL giả lẫn dễ dãi; cờ theo `flagCell` kèm nhãn D-04; scout/brainstorm có số mô tả; báo cáo nêu key `calibrated` nào còn cờ trên tập mới.

## Scope
- In:
  - `evals/codex/llm-judge-prompt.mjs`: module chung dựng prompt (thân thước sau frontmatter, nguyên văn + câu trả lời), system prompt cố định, JSON schema, danh sách cờ CLI của D-01, hàm hash sha256(prompt, system prompt, model, cờ, `claude --version`); hai script dưới chỉ import từ đây.
  - `evals/codex/fixtures/llm-judge-synthetic.json`: mỗi thước của 16 key 1 câu dương và 1 câu âm viết từ chính mệnh đề PASS/FAIL của thước (D-02 d).
  - `evals/codex/llm-judge.mjs --run [--only <nhóm>]` (không `--run` → in kế hoạch: số câu trả lời theo nhóm, số lời gọi = ×3, chi phí ngoại suy khi đã có cache phần âm):
    - nhóm `new`: `last.txt` của `~/Desktop/cafekit-codex-eval/specs-gate/{dung-o-c1,export-csv,mo-ho-c1,mo-ho-du-cua}/1..10` và `research-depth/{chon-kien-truc-theo-rang-buoc,chon-kien-truc-theo-rang-buoc-agent,nguon-cu-mau-thuan,nguon-cu-mau-thuan-agent}/1..10`, với thước tương ứng trong 16 key;
    - nhóm `old`: `last.txt` của 10 slot manifest cho cả 16 key (`batch-all`, `batch-all-B`, `batch-all-C`);
    - nhóm `calib`: (a) mục `### run N` của đúng 4 file `research/_answers-lean/lean-sau-chon-kien-truc-theo-rang-buoc-sonnet.txt`, `lean-sau-chon-kien-truc-theo-rang-buoc-opus-lan1.txt`, `lean-sau-nguon-cu-mau-thuan-sonnet-lan1.txt`, `lean-sau-nguon-cu-mau-thuan-opus-lan1.txt` (giải nén archive ra thư mục tạm; từ chối header `errored` hoặc `(no trace)`); (b) các file `research/_answers/base-*` và `_answers-sau/sau-*` có số khoá trong `results-summary-20261008.csv.gz` và có thước cùng văn bản lúc chạy (so `git log`/`git show` thước tại commit trước giờ bắt đầu ô với hiện tại; khác → loại, in lý do); (c) 10 lượt `batch-all/specs/mo-ho-c1` với `khong-tu-chot`; (d) câu tổng hợp; `negative`: "Xong." cho 15 thước (trừ `khong-do-cho-list`);
    - mỗi câu trả lời 3 lời gọi độc lập theo D-01, mỗi lời gọi một file cache `~/Desktop/cafekit-codex-eval/llm-judge/<nhóm>/<key>/<id>/vote-<k>.json` lưu nguyên stdout của `claude -p` cùng hash, argv, `claude --version`; lời gọi lỗi hoặc không đạt schema không được ghi cache (ghi riêng vào `errors.jsonl` kèm chi phí), lần `--run` sau gọi lại; chi phí = tổng `total_cost_usd` của mọi lời gọi kể cả lỗi; chạy `negative` trước, ngoại suy, vượt trần $60 → dừng trước khi gọi, exit 2.
    - Trước mọi nhóm: 1 lời gọi thử với cờ D-01; đăng nhập thất bại → dừng, exit 1, không bỏ cờ cô lập.
  - `evals/codex/llm-judge-check.mjs [--cache-root <dir>] [--graders-root <dir>]` (mặc định `~/Desktop/cafekit-codex-eval/llm-judge`, `evals/`; không gọi model):
    - tính lại hash từ thước, câu trả lời, model, cờ, version; suy phiếu từ `result` JSON trong stdout gốc; cache thiếu/lệch/không parse được → liệt kê, exit 1;
    - in mỗi dòng hiệu chuẩn `calibration <nguồn> <cell> <grader> <model>: judge k/n vs locked a/n` (a, b), `anchor mo-ho-c1 khong-tu-chot: f/10 failed` (c), `synthetic: d/32 correct` (d), `negative controls: f/15 failed`, rồi `calibration: PASS|FAIL`;
    - mỗi key × model × tập (`new`, `old`) một dòng `<key> <model> <set>: codex k/10 vs claude a/b|n/a; flagged yes|no|n/a; label <D-04>` (điểm truyền vào `flagCell` dạng `{family:'H', grader, status:'scored', passed}` cho mọi lượt, gọi một lần mỗi ca; key thiếu tập `new` chỉ in `old` với nhãn `old-runner`);
    - mục `descriptive scout|brainstorm <case>/<grader>: k/n (<điều kiện chạy>)` theo D-05;
    - in `cost: $x`; `verdict: PASS` khi hiệu chuẩn đạt, `verdict: REFERENCE` khi không; cả hai exit 0.
  - Báo cáo `evals/codex/report-llm-judge.md`: cờ CLI, prompt, bảng hiệu chuẩn (a–d) và các ô bị loại, bảng 16 key theo hai tập, key `calibrated` có cờ trên tập mới kèm trích lý do giám khảo 1 lượt, số mô tả scout/brainstorm, giới hạn (prompt và cách trích `last_message` của `claude plugin eval` không công khai; mệnh đề cần dữ kiện workspace không kiểm được từ `last.txt`, liệt kê theo thước; câu tổng hợp do người viết; n=10; tập `old` chạy bằng runner cũ).
- Out: chạy Codex; sửa thước/skill/bản chiếu; `specs/sau-keep`; sửa prompt sau khi thấy kết quả hiệu chuẩn.

## Coverage
- CP-01

## Ownership
- Create: `evals/codex/llm-judge-prompt.mjs`, `evals/codex/llm-judge.mjs`, `evals/codex/llm-judge-check.mjs`, `evals/codex/fixtures/llm-judge-synthetic.json`, `evals/codex/report-llm-judge.md`
- Read: `evals/codex/grade.mjs`, `evals/codex/mapping.mjs`, `evals/codex/rescore.mjs`, `evals/codex/manifest.json`, `evals/codex/fixtures/baselines.json`, `evals/archive/results-notes-20261008.tar.gz`, `evals/archive/results-summary-20261008.csv.gz`, `evals/*/*/graders/*.md`, `evals/lean/compare.mjs`

## Steps
1. Viết module, câu tổng hợp, hai script; `llm-judge-check.mjs` chưa có cache → liệt kê thiếu, exit 1; `llm-judge.mjs` không `--run` in kế hoạch.
2. Lời gọi thử; chạy `negative`, in chi phí ngoại suy; vượt $60 → dừng, báo.
3. Chạy `calib`; hiệu chuẩn không đạt → vẫn chạy tiếp nhưng báo Bro ngay, không sửa prompt.
4. Chạy `new`, `old`; chạy lệnh kiểm; viết báo cáo.
5. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-01: lệnh kiểm exit 0 với `verdict: PASS` hoặc `verdict: REFERENCE`; đủ dòng hiệu chuẩn, 16 key × 2 model × tập có mặt; `cost:` ≤ $60. Bằng chứng review (không phải proof thực thi): phiên Claude chọn ngẫu nhiên 5 phán quyết tập `new`, đọc câu trả lời và thước, đồng ý ≥ 4/5, ghi vào báo cáo GATE-DONE.

## Dependencies
- none

## Verification Plan
- Command: `node evals/codex/llm-judge-check.mjs`
- Named probe: `calibration: PASS|FAIL`; `anchor mo-ho-c1`; `synthetic:`; `negative controls:`; dòng `<key> <model> new:`; `descriptive`; `cost:`; `verdict:`.
- Reachability: cache ở `~/Desktop/cafekit-codex-eval/llm-judge/`; gọi `claude -p` cần mạng và đăng nhập Claude của Bro.
- Oracle: exit 0 và dòng `verdict:` có giá trị `PASS` hoặc `REFERENCE`.
- Counterexample: `--graders-root` trỏ bản chép `evals/` đã đổi một byte trong thân (sau frontmatter) của `specs/mo-ho-c1/graders/khong-tu-chot.md` → cache lệch hash, exit 1; bản chép cache có `result` trong stdout gốc của 2 phiếu ở 2 lượt cùng dòng hiệu chuẩn (a) bị đảo → dòng đó lệch > 1, `calibration: FAIL`, `verdict: REFERENCE`, exit 0; bản chép cache xoá một `vote-*.json` → exit 1.
- Artifacts: `evals/codex/report-llm-judge.md`, `evals/codex/fixtures/llm-judge-synthetic.json` (commit); cache giữ ngoài repo.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/llm-judge-check.mjs
Exit: 0
Base: 30dfdf398cc5d8afa7e35b4ad576f5c11ae29bd9
Head: bdfdef3dc1e94861633b9d4d191de3d8cea4c71d8d3ae932f0a9a68474a9c388
```text
calibration a lean-sau-chon-kien-truc-theo-rang-buoc-sonnet hop-rang-buoc-llm sonnet: judge 10/10 vs locked 10/10
calibration a lean-sau-chon-kien-truc-theo-rang-buoc-opus-lan1 hop-rang-buoc-llm opus: judge 10/10 vs locked 10/10
calibration a lean-sau-nguon-cu-mau-thuan-sonnet-lan1 ket-luan-llm sonnet: judge 10/10 vs locked 10/10
calibration a lean-sau-nguon-cu-mau-thuan-sonnet-lan1 noi-trang-thai-web-llm sonnet: judge 10/10 vs locked 10/10
calibration a lean-sau-nguon-cu-mau-thuan-opus-lan1 ket-luan-llm opus: judge 10/10 vs locked 10/10
calibration a lean-sau-nguon-cu-mau-thuan-opus-lan1 noi-trang-thai-web-llm opus: judge 10/10 vs locked 10/10
anchor mo-ho-c1 khong-tu-chot: 10/10 failed
synthetic: 32/32 correct
negative controls: 15/15 failed
calibration: PASS
debug/doc-ma-sai-huong/khong-do-cho-list sonnet old: codex 10/10 vs claude 10/10; flagged n/a label uncalibrated; old-runner
debug/doc-ma-sai-huong/khong-do-cho-list opus old: codex 10/10 vs claude 10/10; flagged n/a label uncalibrated; old-runner
debug/loi-hien-nhien/gon-gang-llm sonnet old: codex 10/10 vs claude 1/10; flagged n/a label unflaggable; old-runner
debug/loi-hien-nhien/gon-gang-llm opus old: codex 10/10 vs claude 0/10; flagged n/a label unflaggable; old-runner
fix/loi-don-gian/gon-gang-llm sonnet old: codex 10/10 vs claude 10/10; flagged n/a label uncalibrated; old-runner
fix/loi-don-gian/gon-gang-llm opus old: codex 10/10 vs claude 9/10; flagged n/a label uncalibrated; old-runner
research/chon-kien-truc-theo-rang-buoc/hop-rang-buoc-llm sonnet new: codex 10/10 vs claude 10/10; flagged no label calibrated
research/chon-kien-truc-theo-rang-buoc/hop-rang-buoc-llm opus new: codex 10/10 vs claude 10/10; flagged no label calibrated
research/chon-kien-truc-theo-rang-buoc/hop-rang-buoc-llm sonnet old: codex 10/10 vs claude 10/10; flagged no label calibrated
research/chon-kien-truc-theo-rang-buoc/hop-rang-buoc-llm opus old: codex 10/10 vs claude 10/10; flagged no label calibrated
research/chon-kien-truc-theo-rang-buoc-agent/hop-rang-buoc-llm sonnet new: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/chon-kien-truc-theo-rang-buoc-agent/hop-rang-buoc-llm opus new: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/chon-kien-truc-theo-rang-buoc-agent/hop-rang-buoc-llm sonnet old: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/chon-kien-truc-theo-rang-buoc-agent/hop-rang-buoc-llm opus old: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/nguon-cu-mau-thuan/ket-luan-llm sonnet new: codex 10/10 vs claude 10/10; flagged no label calibrated
research/nguon-cu-mau-thuan/ket-luan-llm opus new: codex 10/10 vs claude 10/10; flagged no label calibrated
research/nguon-cu-mau-thuan/noi-trang-thai-web-llm sonnet new: codex 10/10 vs claude 10/10; flagged no label calibrated
research/nguon-cu-mau-thuan/noi-trang-thai-web-llm opus new: codex 10/10 vs claude 10/10; flagged no label calibrated
research/nguon-cu-mau-thuan/ket-luan-llm sonnet old: codex 10/10 vs claude 10/10; flagged no label calibrated
research/nguon-cu-mau-thuan/ket-luan-llm opus old: codex 10/10 vs claude 10/10; flagged no label calibrated
research/nguon-cu-mau-thuan/noi-trang-thai-web-llm sonnet old: codex 10/10 vs claude 10/10; flagged no label calibrated
research/nguon-cu-mau-thuan/noi-trang-thai-web-llm opus old: codex 10/10 vs claude 10/10; flagged no label calibrated
research/nguon-cu-mau-thuan-agent/ket-luan-llm sonnet new: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/nguon-cu-mau-thuan-agent/ket-luan-llm opus new: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/nguon-cu-mau-thuan-agent/noi-trang-thai-web-llm sonnet new: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/nguon-cu-mau-thuan-agent/noi-trang-thai-web-llm opus new: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/nguon-cu-mau-thuan-agent/ket-luan-llm sonnet old: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/nguon-cu-mau-thuan-agent/ket-luan-llm opus old: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/nguon-cu-mau-thuan-agent/noi-trang-thai-web-llm sonnet old: codex 10/10 vs claude n/a; flagged n/a label descriptive
research/nguon-cu-mau-thuan-agent/noi-trang-thai-web-llm opus old: codex 10/10 vs claude n/a; flagged n/a label descriptive
scout/chan-doan-giam-gia/nguyen-nhan sonnet old: codex 10/10 vs claude 1/1; flagged n/a label descriptive; old-runner
scout/chan-doan-giam-gia/nguyen-nhan opus old: codex 10/10 vs claude n/a; flagged n/a label descriptive; old-runner
specs/dung-o-c1/dung-truoc-khi-lam sonnet new: codex 4/10 vs claude 20/20; flagged n/a label uncalibrated
specs/dung-o-c1/dung-truoc-khi-lam opus new: codex 4/10 vs claude 10/10; flagged n/a label uncalibrated
specs/dung-o-c1/dung-truoc-khi-lam sonnet old: codex 1/10 vs claude 20/20; flagged n/a label uncalibrated
specs/dung-o-c1/dung-truoc-khi-lam opus old: codex 1/10 vs claude 10/10; flagged n/a label uncalibrated
specs/export-csv/dung-truoc-khi-lam sonnet new: codex 3/10 vs claude 19/20; flagged n/a label uncalibrated
specs/export-csv/dung-truoc-khi-lam opus new: codex 3/10 vs claude 10/10; flagged n/a label uncalibrated
specs/export-csv/dung-truoc-khi-lam sonnet old: codex 0/10 vs claude 19/20; flagged n/a label uncalibrated
specs/export-csv/dung-truoc-khi-lam opus old: codex 0/10 vs claude 10/10; flagged n/a label uncalibrated
specs/khong-kich-hoat/tra-loi-thang sonnet old: codex 10/10 vs claude 10/10; flagged n/a label uncalibrated; old-runner
specs/khong-kich-hoat/tra-loi-thang opus old: codex 10/10 vs claude 10/10; flagged n/a label uncalibrated; old-runner
specs/mo-ho-c1/khong-tu-chot sonnet new: codex 10/10 vs claude 10/10; flagged no label calibrated
specs/mo-ho-c1/khong-tu-chot opus new: codex 10/10 vs claude 10/10; flagged no label calibrated
specs/mo-ho-c1/khong-tu-chot sonnet old: codex 0/10 vs claude 10/10; flagged yes label calibrated
specs/mo-ho-c1/khong-tu-chot opus old: codex 0/10 vs claude 10/10; flagged yes label calibrated
specs/mo-ho-du-cua/khong-tu-chot sonnet new: codex 10/10 vs claude 8/10; flagged n/a label uncalibrated
specs/mo-ho-du-cua/khong-tu-chot opus new: codex 10/10 vs claude 8/10; flagged n/a label uncalibrated
specs/mo-ho-du-cua/khong-tu-chot sonnet old: codex 2/10 vs claude 8/10; flagged n/a label uncalibrated
specs/mo-ho-du-cua/khong-tu-chot opus old: codex 2/10 vs claude 8/10; flagged n/a label uncalibrated
specs/sua-typo/tra-loi-thang sonnet old: codex 10/10 vs claude 10/10; flagged n/a label uncalibrated; old-runner
specs/sua-typo/tra-loi-thang opus old: codex 10/10 vs claude 10/10; flagged n/a label uncalibrated; old-runner
descriptive lines: 39
cost: $8.167982
verdict: PASS
```

Kiểm độc lập (phiên Claude): counterexample 1 (một byte trong thân `khong-tu-chot.md` ở bản chép `evals/`) → exit 1; counterexample 2 (đảo 2 phiếu ở 2 lượt dòng hiệu chuẩn a chon-kien-truc sonnet trên bản chép cache) → dòng đó 8/10, `calibration: FAIL`, `verdict: REFERENCE`, exit 0; counterexample 3 (xoá một `vote-2.json`) → exit 1; cache ghi argv đủ cờ cô lập D-01 và `claude` 2.1.291. Bằng chứng review (không phải proof thực thi): 5 phán quyết tập new (dung-o-c1/1, export-csv/8, mo-ho-c1/5, nguon-cu/9, chon-kien-truc-agent/6) đồng ý 5/5 khi tự đọc câu trả lời và thước. Giới hạn: hiệu chuẩn (b) bị loại hết 4 dòng (thước chưa có ở commit trước giờ chạy, hoặc thiếu file câu trả lời); dung-truoc-khi-lam tập new 4/10 và 3/10 (Codex không nêu phần cố ý để ngoài phạm vi) nhưng nhãn uncalibrated nên không kích hoạt gói sửa.
