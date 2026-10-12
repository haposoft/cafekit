# Task 01 — Đo lại 4 ô test/code-review bằng runner mới

Status: done

## Outcome
4 ô `test/thuong-do`, `test/thuong-sach`, `code-review/thieu-tieu-chi`, `code-review/thieu-tieu-chi-agent` có 10 lượt hợp lệ mỗi ô với runner hiện tại; bộ kiểm cho biết cờ F045–F051, F069–F074 nào còn và nhãn của nó; báo cáo nêu cờ "khác thật" còn lại.

## Scope
- In:
  - `evals/codex/rescore.mjs`: export thêm một hàm cờ theo ô (nhận skill, case, điểm mỗi lượt, baselines; dùng nguyên `classOf`, `inverted`, bộ lọc so được và epsilon `1e-9` của `rescore.mjs:49-61,88-101`); `rescore()` gọi lại chính hàm đó; output và exit của `node evals/codex/rescore.mjs --check` sau khi sửa giống hệt bản chụp trước khi sửa `~/Desktop/cafekit-codex-eval/rescore-check-before-remeasure.txt` (trên HEAD 13c34dd3 lệnh này đã dừng vì vân tay lệch do 3 gói Codex trước; không tạo `rerun-approval.json`, `remeasure-check.mjs` không gọi kiểm vân tay).
  - 1 lượt thử `test/thuong-do` vào `~/Desktop/cafekit-codex-eval/remeasure-preflight/1`, xem `capture.json` có agent con không; không nhập mẫu.
  - Chạy 4 ô × 10 lượt bằng `node evals/codex/run.mjs --run --only <skill>/<ca> --out ~/Desktop/cafekit-codex-eval/remeasure/<skill>/<ca>/<n>` (home sạch, cấu hình C, không `--user-home`); lượt lỗi: đổi tên `<n>` thành `<n>.attempt-k`, chạy lại vào `<n>` trống (`run.mjs:96`); trần 50 lần gọi gồm lượt thử và attempt; `calls` = số thư mục `<n>` + `<n>.attempt-k` + lượt thử.
  - `evals/codex/remeasure-check.mjs [--log-root <dir>] [--old-root <dir>]` (mặc định `~/Desktop/cafekit-codex-eval/remeasure` và `~/Desktop/cafekit-codex-eval/batch-all`):
    - Bước 1, tự kiểm: chấm lại 4 ô ở `--old-root` (định dạng cũ, không ánh xạ) và đòi: đúng số Codex của F045–F051, F069–F074 ở `report-parity.md`, cả 13 `flagged yes`, nhãn từng lượt khớp cách đọc parity (`report-parity.md:80-109`; vd `thuong-sach/7` cách viết tool input, `thuong-sach/4` khác thật), 0 cờ NEW; lệch → in `self-check: FAIL <lý do>`, exit 1. Khớp → `self-check: PASS`.
    - Bước 2: lượt mới hợp lệ khi `result.json` status `completed`, `invocation.json` có home sạch và cấu hình `C-clean-home-5d`, đúng model/effort, `capture.json` mọi session `valid`, prompt đúng ca; thư mục `.attempt-k` hợp lệ → lỗi, exit 1; liệt kê lượt bị loại kèm lý do, in `role exclusions: <ca> r` (D-04 của `plan.md`); in tập `cli_version`; ô thiếu lượt hợp lệ → `<ca>: runs k/10`, exit 1.
    - Chấm lượt mới bằng `grade.mjs` không ánh xạ; lệnh để gắn nhãn đọc cả root `events.jsonl` và `sessions/*.jsonl`; áp hàm cờ export; in N/A của thước primary/safety kèm lý do.
    - Mỗi cờ cũ một dòng `F0NN <key> <model>: old a/10 → new b/10; flagged yes|no|inconclusive; p_old_new <p>; labels <lượt>=<nhãn>,...`; cờ mới (chỉ thước không ánh xạ) cùng dạng với id `NEW`.
    - In `still real: <danh sách key>` theo luật D-02 trừ cờ "chưa kết luận" và `co-header` (rỗng → `still real: none`), `calls: c/50`, `verdict: MEASURED`; exit 0.
  - Báo cáo `evals/codex/report-test-review-remeasure.md`: bảng cờ cũ → mới, nhãn từng lượt, Fisher cũ→mới, lượt thử và tỉ lệ loại vì role; trích ngắn 1 lượt cho mỗi key "khác thật"; giới hạn (home người dùng → home sạch, `cli_version`, n=10, thước ánh xạ N/A, nhãn máy).
- Out: sửa skill, bản chiếu, thước; đo Claude; ô khác.

## Coverage
- CP-01

## Ownership
- Create: `evals/codex/remeasure-check.mjs`, `evals/codex/report-test-review-remeasure.md`
- Modify: `evals/codex/rescore.mjs` (chỉ export hàm cờ theo ô)
- Read: `evals/codex/run.mjs`, `evals/codex/grade.mjs`, `evals/codex/mapping.mjs`, `evals/lean/compare.mjs`, `evals/codex/specs-check.mjs`, `evals/codex/fixtures/baselines.json`, `evals/codex/report-parity.md`

## Steps
1. Export hàm cờ; output + exit của `rescore.mjs --check` giống hệt bản chụp trước khi sửa. Viết `remeasure-check.mjs`; chạy với `--log-root` trỏ thư mục rỗng để thấy `self-check: PASS` rồi exit 1 vì thiếu lượt.
2. Chạy lượt thử, rồi 4 ô × 10 lượt.
3. Chạy lệnh kiểm; viết báo cáo.
4. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-01: `self-check: PASS`; 13 dòng F0NN đủ; 40 lượt hợp lệ; `verdict: MEASURED`; phiên Claude tự áp regex `neu-task`, `co-header` lên `last.txt` của `code-review/thieu-tieu-chi` và đếm dòng `# tests N` trong output lệnh `test/thuong-do`, khớp với số và nhãn in ra.

## Dependencies
- none

## Verification Plan
- Command: `node evals/codex/remeasure-check.mjs`
- Named probe: `self-check: PASS`; 13 dòng `F0NN ... flagged`; `role exclusions:`; `still real:`; `calls:`; `verdict: MEASURED`.
- Reachability: nhật ký ở `~/Desktop/cafekit-codex-eval/remeasure/`; chạy model cần pane Codex không sandbox.
- Oracle: exit 0, `self-check: PASS` và `verdict: MEASURED`.
- Counterexample: `--old-root` trỏ bản chép `batch-all` 4 ô, trong đó `events.jsonl` của `test/thuong-sach/4` được chèn một `command_execution` có output `# tests 2` (nhãn lượt 4 đổi thành cách viết, lệch parity) → `self-check: FAIL`, exit 1; `--log-root` thiếu một lượt (bản chép) → `runs 9/10`, exit 1.
- Artifacts: `evals/codex/report-test-review-remeasure.md` (commit); nhật ký giữ ngoài repo.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/remeasure-check.mjs
Exit: 0
Base: 51af0daea9b7d7c4596148347e950d6c8e358a14
Head: ce520c72af5b86301fa99c1f95fddd094a58aad6cfa5540b8e153250d56e7816
```text
self-check: PASS
test/thuong-do: runs 10/10
role exclusions: test/thuong-do 0
test/thuong-sach: runs 10/10
role exclusions: test/thuong-sach 0
code-review/thieu-tieu-chi: runs 10/10
role exclusions: code-review/thieu-tieu-chi 0
code-review/thieu-tieu-chi-agent: runs 10/10
role exclusions: code-review/thieu-tieu-chi-agent 0
cli_version: 0.162.1
F045 code-review/thieu-tieu-chi/H/co-header sonnet: old 0/10 → new 0/10; flagged yes; p_old_new 1.0000000
F046 code-review/thieu-tieu-chi/H/co-header opus: old 0/10 → new 0/10; flagged yes; p_old_new 1.0000000
F047 code-review/thieu-tieu-chi/H/neu-task sonnet: old 0/10 → new 0/10; flagged yes; p_old_new 1.0000000
F048 code-review/thieu-tieu-chi/H/neu-task opus: old 0/10 → new 0/10; flagged yes; p_old_new 1.0000000
F049 code-review/thieu-tieu-chi-agent/H/co-verdict sonnet: old 3/10 → new 10/10; flagged no; p_old_new 0.0030959752
F050 code-review/thieu-tieu-chi-agent/H/co-verdict opus: old 3/10 → new 10/10; flagged no; p_old_new 0.0030959752
F051 code-review/thieu-tieu-chi-agent/H/neu-task opus: old 0/10 → new 0/10; flagged inconclusive; p_old_new 1.0000000
F069 test/thuong-do/H/chay-test sonnet: old 6/10 → new 10/10; flagged no; p_old_new 0.086687307
F070 test/thuong-do/H/chay-test opus: old 6/10 → new 10/10; flagged no; p_old_new 0.086687307
F071 test/thuong-sach/H/chay-test sonnet: old 8/10 → new 8/10; flagged inconclusive; p_old_new 1.0000000
F072 test/thuong-sach/H/chay-test opus: old 8/10 → new 8/10; flagged inconclusive; p_old_new 1.0000000
F073 test/thuong-sach/H/verdict sonnet: old 8/10 → new 7/10; flagged inconclusive; p_old_new 1.0000000
F074 test/thuong-sach/H/verdict opus: old 8/10 → new 7/10; flagged inconclusive; p_old_new 1.0000000
still real: none
calls: 41/50
verdict: MEASURED
```

Kiểm độc lập (phiên Claude): `rescore.mjs --check` output+exit giống hệt bản chụp trước khi sửa; counterexample `--old-root` chèn `# tests 2` vào `thuong-sach/4` → `self-check: FAIL` exit 1; `--log-root` thiếu `thuong-do/10` → `runs 9/10` exit 1; regex `neu-task`/`co-header` trên 10 `last.txt` mới đều 0 khớp, cả 10 nêu task 01 và có header `[cf-code-review]`; `# tests N` có ở 10/10 lượt `thuong-do`. Giới hạn: lượt `thuong-sach/5` viết `Test Verdict: PASS` (cách viết) nhưng nhãn máy là khác thật vì D-02 không phủ thước `verdict`; không đổi kết luận (inconclusive).
