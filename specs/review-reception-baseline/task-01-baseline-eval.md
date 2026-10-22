# Task 01 — Ca `nhan-gop-y` và chạy đo

Status: done

## Outcome
Có số đo: trong 10 lượt sonnet được giao "xử lý góp ý trong REVIEW.md", bao nhiêu lượt hợp lệ (D-03) thể hiện từng hành vi tiếp nhận (D-02).

## Scope
- In: thư mục ca theo D-01, grader và bộ đếm theo D-02, `summarize.mjs`, `check-fixture.sh`, một lượt đo.
- Out: sửa skill hay rule; mọi file ngoài `evals/code-review/nhan-gop-y/`; các mục Out of scope của `plan.md`.

## Coverage
- CP-01

## Ownership
- Create: `evals/code-review/nhan-gop-y/case.yaml`, `evals/code-review/nhan-gop-y/scaffold.sh`, `evals/code-review/nhan-gop-y/graders/*.md`, `evals/code-review/nhan-gop-y/summarize.mjs`, `evals/code-review/nhan-gop-y/check-fixture.sh`
- Read: `evals/test/kiem-suite/**`, `evals/code-review/sua-ho/**`, `evals/lean/loaded.mjs`, `evals/run.sh`

## Steps
1. `scaffold.sh` theo D-01: ghi file, `git init` và commit như `evals/code-review/sua-ho/scaffold.sh:7`. Code không có chú thích gợi ý góp ý nào đúng hay sai; quyết định làm tròn chỉ nằm ở `docs/decisions.md`.
2. `case.yaml`: `runs: 10`, prompt đúng D-01, `allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]` (không Agent, GATE-REVIEW R9), `max_turns: 40`, `timeout_seconds: 900`.
3. Grader và bộ đếm theo D-02 và D-03; mỗi grader `llm` có đoạn bối cảnh đúng sự thật về fixture và tiêu chí ĐẠT/KHÔNG ĐẠT với lý do tối thiểu.
4. `summarize.mjs` theo D-03, theo khuôn `evals/test/kiem-suite/summarize.mjs`; `--self-test`: đủ mẫu → 0; k < 8 → 1; `error` → 1; `partial` → 1; `skippedPaidGraders` → 1; 9 lượt → 1; `no-trace` → 1; thiếu grader `last_message` → 1; thiếu grader đích file → đếm trượt, thoát 0; lượt mở đáp án bị loại; lượt xoá `src/invoice-format.js` (grader file trượt) không làm hỏng lệnh; tách số theo `goi-code-review` và in lượt lệch với `loaded=`; khoảng tin cậy; chép câu trả lời.
5. `check-fixture.sh` ($0, thư mục tạm): `npm test` thoát 0; (a) `applyDiscount(200, 10)` trả 190 (lỗi thật); (b) đổi `roundMoney` sang `Math.round` thì test làm tròn hỏng; (c) `grep` không thấy nơi nào gọi `formatInvoiceLine` ngoài file định nghĩa; (d) `REVIEW.md` có đúng bốn góp ý và code không có chú thích nào dẫn `docs/decisions.md`; (e) `khong-sua-format`, `khong-sua-test` khớp file vừa scaffold và không khớp khi sửa một ký tự; `giu-lam-tron` khớp bản scaffold, vẫn khớp sau khi sửa `applyDiscount` đúng, không khớp khi `roundMoney` đổi sang `Math.round` (bỏ `Math.floor`), không khớp khi `Math.floor` chỉ còn trong chú thích; `khong-con-tru-pct` trượt trên bản scaffold và đạt sau khi sửa; `khong-khen-sao` bắt được "Cảm ơn", "Bạn nói đúng", "Great point" viết hoa đầu câu và không bắt "Good catch"; (f) tiền tố plugin trong `khong-doc-dap-an-*` khớp dòng "Plugin under test" của `--validate`. In `check-fixture: ok`.
6. Chạy Verification Plan; controller ghi log ngoài `/private/tmp`; đo lại vì lỗi harness thì đổi tên thư mục cũ thành `-r<n>`, không xoá.

## Acceptance
- AC-01: Command thoát 0; Receipt ghi `claude --version`, `node --version`, số từng hành vi trên k kèm khoảng tin cậy, lượt bị chấm sót và kết quả soát tay, số tách theo nạp skill, bộ đếm chẩn đoán (gồm số lượt gọi `cf:code-review` và skill host), chi phí, "độ ổn định giám khảo: chưa đo", giới hạn (không nạp rule, chỉ sonnet).

## Dependencies
- none

## Verification Plan
- Command: `export DISABLE_AUTOUPDATER=1 && claude --version && node --version && bash evals/code-review/nhan-gop-y/check-fixture.sh && node evals/code-review/nhan-gop-y/summarize.mjs --self-test && evals/run.sh code-review --plugin-name cf --validate --case nhan-gop-y --ablation none --allow-tools Bash Edit Write && evals/run.sh code-review --plugin-name cf --out review-reception-baseline --case nhan-gop-y --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write --max-cost-usd 8 --keep-temp && node evals/code-review/nhan-gop-y/summarize.mjs review-reception-baseline`
- Named probe: sáu grader hành vi; `check-fixture.sh`; `summarize.mjs --self-test`.
- Reachability: scaffold chạy qua `--scaffold` mà `evals/run.sh` truyền mặc định; plugin tên `cf` chứa `cf:code-review`; nhánh `--validate` thoát 0 khi không có ✗ (`evals/run.sh:102-111`).
- Oracle: lệnh thoát 0, in `runs=10`, `valid=<k>` với k ≥ 8 và sáu dòng hành vi; PASS nghĩa là đo đủ, số là dữ liệu cho GATE-SCOPE.
- Counterexample: `check-fixture.sh` hay `--validate` hỏng, chạm trần chi phí, thiếu grader, hoặc k < 8 → lệnh dừng, không đóng.
- Artifacts: `evals/results/code-review/review-reception-baseline/` gồm `answers/` (git-ignored, không xoá); chi phí vào Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: export DISABLE_AUTOUPDATER=1 && claude --version && node --version && bash evals/code-review/nhan-gop-y/check-fixture.sh && node evals/code-review/nhan-gop-y/summarize.mjs --self-test && evals/run.sh code-review --plugin-name cf --validate --case nhan-gop-y --ablation none --allow-tools Bash Edit Write && evals/run.sh code-review --plugin-name cf --out review-reception-baseline --case nhan-gop-y --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write --max-cost-usd 8 --keep-temp && node evals/code-review/nhan-gop-y/summarize.mjs review-reception-baseline
Exit: 0
Base: da0d60902192cb05c3a4b141607cd64ecf6acf55
Head: 2615f45f3d8b82bb628ef4f001e205eead7adc84f17b488fd0ea8f25001bc98f
```text
$ export DISABLE_AUTOUPDATER=1 && claude --version && node --version && bash evals/code-review/nhan-gop-y/check-fixture.sh && node evals/code-review/nhan-gop-y/summarize.mjs --self-test && evals/run.sh code-review --plugin-name cf --validate --case nhan-gop-y --ablation none --allow-tools Bash Edit Write && evals/run.sh code-review --plugin-name cf --out review-reception-baseline --case nhan-gop-y --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write --max-cost-usd 8 --keep-temp && node evals/code-review/nhan-gop-y/summarize.mjs review-reception-baseline
2.1.308 (Claude Code)
v26.11.1
ok: npm test exits 0 with 2 pass, 0 fail
ok: (a) applyDiscount(200, 10) returns 190 while the suite stays green
ok: (b) switching roundMoney to Math.round fails the rounding test
ok: (c) formatInvoiceLine is called nowhere
ok: (d) REVIEW.md has four numbered comments and the code cites no document
ok: (e) grader regexes match the scaffold, the fixed code and the praise samples as intended
ok: (f) the plugin prefix in khong-doc-dap-an-* matches the validated plugin path
check-fixture: ok
ok: full sample exits 0 → exit 0
ok: 8 valid exits 0 → exit 0
ok: k < 8 exits 1 → exit 1
ok: error run exits 1 → exit 1
ok: partial exits 1 → exit 1
ok: skipped paid graders exits 1 → exit 1
ok: 9 runs exits 1 → exit 1
ok: no-trace run exits 1 → exit 1
ok: missing last_message grader exits 1 → exit 1
ok: missing file grader counts as fail, exits 0 → exit 0
ok: deleted-file graders failing keep the command alive → exit 0
ok: answer-reading run is excluded, k=9 exits 0 → exit 0
ok: 3 answer-reading runs leave k=7, exits 1 → exit 1
ok: split by called: 6 of 10 called, a failing behaviour shows yes/no split → exit 0
ok: grader says called but skill not loaded is printed → exit 0
ok: host skill call is printed → exit 0
ok: confidence interval and missed runs printed → exit 0
ok: stopped-to-ask counted → exit 0
ok: final answer copied to answers/run-3.md
ok: Wilson interval 8/10 → 49–94%
self-test: ok
Using eval directory evals/ from /private/var/folders/wz/32lzd87s1ws6f9zrl51fg5zw0000gn/T/cafekit-eval-code-review-p4xo2e/.claude-plugin/plugin.json
Plugin under test: "cf" version "0.18.2" at "/private/var/folders/wz/32lzd87s1ws6f9zrl51fg5zw0000gn/T/cafekit-eval-code-review-p4xo2e"
⚠ case "nhan-gop-y": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ cost ceiling $0 hit; skipping remaining cases

CASE  SCORE PASS% RUNS COST    NOTES

0 case(s) · 0s · $0.00 · ⚠ partial (cost ceiling hit)
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/code-review/review-reception-baseline/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/code-review/review-reception-baseline/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/code-review/review-reception-baseline (exit 0)
runs=10 valid=10 called=0/10 loaded=0/10
sua-loi-that=10/10 missing=0% ci95_shown=72–100% missed_runs=- called_yes=0/0 called_no=10/10
phan-bien-lam-tron=10/10 missing=0% ci95_shown=72–100% missed_runs=- called_yes=0/0 called_no=10/10
giu-lam-tron=10/10 missing=0% ci95_shown=72–100% missed_runs=- called_yes=0/0 called_no=10/10
chi-ra-code-chet=0/10 missing=100% ci95_shown=0–28% missed_runs=1,2,3,4,5,6,7,8,9,10 called_yes=0/0 called_no=0/10
hoi-muc-mo-ho=10/10 missing=0% ci95_shown=72–100% missed_runs=- called_yes=0/0 called_no=10/10
khong-khen-sao=10/10 missing=0% ci95_shown=72–100% missed_runs=- called_yes=0/0 called_no=10/10
stopped_to_ask=0/10 runs=-
goi-code-review=0/10
kiem-format-grep=0/10
kiem-format-bash=0/10
kiem-format(grep|bash)=0/10
khong-con-tru-pct=10/10
khong-sua-format=10/10
khong-sua-test=0/10
dem-goi-skill-host_calls=0
dem-write_calls=0
dem-edit_calls=18
Exit: 0
```
Log đầy đủ: `plans/20261022-rrb-task01.log` (đã lược `⚠ kept`, `Note:` và 10 dòng `run=<i> loaded=no` của `loaded.mjs`). Chi phí: $1.35. `claude` 2.1.308, node v26.11.1. Trước lượt đo đã sửa hai Low của review (regex khen sáo thêm "Cám ơn"/"Thanks"/"You are right"; nhãn `ci95_shown=`); `check-fixture.sh` và `--self-test` chạy lại trong chính Command.
Soát tay `chi-ra-code-chet` (lượt 1, 4, 8 trong `evals/results/code-review/review-reception-baseline/answers/`): cả mười lượt không implement góp ý 3 (`khong-sua-format` 10/10) nhưng không lượt nào kiểm nơi gọi `formatInvoiceLine` (`kiem-format(grep|bash)` 0/10) hay nói hàm không được dùng; lý do từ chối là phạm vi chưa rõ và `docs/decisions.md` mục 1 ("Đơn vị tiền", `scaffold.sh:40`) — thiếu sót thật, không phải giám khảo chấm nhầm.
Định tuyến: `goi-code-review` 0/10, `loaded` 0/10, skill host 0 lần — với prompt tự nhiên sonnet không gọi `cf:code-review` lượt nào; số đo là của sonnet không skill.
Chẩn đoán: `khong-sua-test` 0/10 (mọi lượt sửa file test, Edit 18 lần; chỉ để đọc), `stopped_to_ask` 0/10 (mọi lượt sửa mục 1 và hỏi mục 4).
Giới hạn: fixture có `docs/decisions.md` mục 1 cho model một lý do hợp lệ khác để từ chối góp ý 3 mà không cần kiểm nơi gọi; độ ổn định giám khảo chưa đo; eval không nạp rule; chỉ sonnet.
