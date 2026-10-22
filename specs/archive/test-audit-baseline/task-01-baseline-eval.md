# Task 01 — Ca `kiem-suite` và chạy đo

Status: done

## Outcome
Có số đo: trong 10 lượt sonnet chạy `cf:test` với câu hỏi "bộ test có đáng tin không", bao nhiêu lượt hợp lệ (D-03) chỉ ra từng lỗi đã cấy (D-02).

## Scope
- In: thư mục ca theo D-01, grader và bộ đếm theo D-02, `summarize.mjs` và `check-fixture.sh` theo D-03/Step 5, một lượt đo.
- Out: sửa skill; mọi file ngoài `evals/test/kiem-suite/`; các mục Out of scope của `plan.md`.

## Coverage
- CP-01

## Ownership
- Create: `evals/test/kiem-suite/case.yaml`, `evals/test/kiem-suite/scaffold.sh`, `evals/test/kiem-suite/graders/*.md`, `evals/test/kiem-suite/summarize.mjs`, `evals/test/kiem-suite/check-fixture.sh`
- Read: `evals/test/fixture/**`, `evals/test/chap-chon/**`, `evals/brainstorm/hai-huong/summarize.mjs`, `evals/brainstorm/hai-huong/graders/*.md`, `evals/lean/loaded.mjs`, `evals/run.sh`

## Steps
1. `scaffold.sh` theo D-01, theo mẫu `evals/test/chap-chon/scaffold.sh`. Chú thích trong file test không được gợi ý test nào là lỗi; riêng thân `// TODO` là chính lỗi được cấy.
2. `case.yaml`: `runs: 10`, prompt đúng D-01, `allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]`, `max_turns: 30`, `timeout_seconds: 900`.
3. Sáu grader `llm` (`focus: last_message`) và các bộ đếm theo D-02; mỗi grader `llm` có đoạn bối cảnh nêu đúng tên test bị cấy của loại đó và tiêu chí ĐẠT/KHÔNG ĐẠT với lý do tối thiểu.
4. `summarize.mjs` theo D-03, gọi `node evals/lean/loaded.mjs test <dir>` qua `spawnSync(process.execPath, …)`; `--self-test` trên dữ liệu giả: đủ mẫu → 0; k < 8 → 1; lượt `error` → 1; `partial` → 1; thiếu grader `tim-*` → 1.
5. `check-fixture.sh` ($0, chạy scaffold trong thư mục tạm): `npm test` thoát 0 với 6 pass, 1 skip, 0 fail; (a) thay `greet` bằng bản sai thì đúng 2 test thật hỏng; (b) bỏ `.skip` thì test đó hỏng; (c) bỏ `try/catch` thì test đó hỏng; (d) mọi tên test nêu trong sáu grader có trong `test/greet.test.js`; (e) `.github/workflows/test.yml` chứa `npm test || true`; (f) regex của `khong-sua-test` và `khong-sua-code` khớp đúng file vừa scaffold, và không khớp khi file đó bị sửa một ký tự; (g) thay `greet` bằng bản ném lỗi thì đúng 3 test hỏng (2 test thật và test assert luôn đúng), chứng minh test hàm giả không gọi `greet`. In `check-fixture: ok` và thoát 0, sai thì thoát 1.
6. Chạy Verification Plan; controller ghi log ngoài `/private/tmp`. Đo lại (vì lỗi harness) thì đổi tên thư mục kết quả cũ thành `test-audit-baseline-r<n>`, không xoá (T11).

## Acceptance
- AC-01: Command thoát 0; Receipt ghi `claude --version`, `node --version`, số từng loại lỗi trên k kèm lượt bị chấm sót, các bộ đếm chẩn đoán, chi phí, "độ ổn định giám khảo: chưa đo", giới hạn định tuyến/nhánh không skill.

## Dependencies
- none

## Verification Plan
- Command: `export DISABLE_AUTOUPDATER=1 && claude --version && node --version && bash evals/test/kiem-suite/check-fixture.sh && node evals/test/kiem-suite/summarize.mjs --self-test && evals/run.sh test --plugin-name cf --validate --case kiem-suite --ablation none --allow-tools Write Edit Bash && evals/run.sh test --plugin-name cf --out test-audit-baseline --case kiem-suite --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Write Edit Bash --max-cost-usd 8 --keep-temp && node evals/test/kiem-suite/summarize.mjs test-audit-baseline`
- Named probe: sáu grader `tim-*`; `check-fixture.sh`; `summarize.mjs --self-test`.
- Reachability: scaffold chạy qua `--scaffold` mà `evals/run.sh` truyền mặc định; skill nạp dưới tên `cf:test` nhờ `--plugin-name cf`; `loaded.mjs` khớp init `^[^:]+:test$`; nhánh `--validate` thoát 0 khi không có ✗ (`evals/run.sh:102-111`).
- Oracle: lệnh thoát 0, in `runs=10`, `valid=<k>` với k ≥ 8 và sáu dòng `tim-*`; PASS nghĩa là đo đủ, số là dữ liệu cho GATE-SCOPE.
- Counterexample: `check-fixture.sh` hay `--validate` hỏng, chạm trần chi phí, thiếu grader, hoặc k < 8 → lệnh dừng, không đóng, báo "chưa đủ mẫu" khi k < 8.
- Artifacts: `evals/results/test/test-audit-baseline/` gồm `answers/` (git-ignored, không xoá); chi phí vào Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: export DISABLE_AUTOUPDATER=1 && claude --version && node --version && bash evals/test/kiem-suite/check-fixture.sh && node evals/test/kiem-suite/summarize.mjs --self-test && evals/run.sh test --plugin-name cf --validate --case kiem-suite --ablation none --allow-tools Write Edit Bash && evals/run.sh test --plugin-name cf --out test-audit-baseline --case kiem-suite --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Write Edit Bash --max-cost-usd 8 --keep-temp && node evals/test/kiem-suite/summarize.mjs test-audit-baseline
Exit: 0
Base: 746705d9936e34eb1d4d4f53405338c4a0edd136
Head: 9d52a34ab5584dab0ba917b571562ea25080ca2e42a763cf1a0a52d700c8da1e
```text
$ export DISABLE_AUTOUPDATER=1 && claude --version && node --version && bash evals/test/kiem-suite/check-fixture.sh && node evals/test/kiem-suite/summarize.mjs --self-test && evals/run.sh test --plugin-name cf --validate --case kiem-suite --ablation none --allow-tools Write Edit Bash && evals/run.sh test --plugin-name cf --out test-audit-baseline --case kiem-suite --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Write Edit Bash --max-cost-usd 8 --keep-temp && node evals/test/kiem-suite/summarize.mjs test-audit-baseline
2.1.308 (Claude Code)
v26.11.1
ok: npm test exits 0 with 6 pass, 1 skip, 0 fail
ok: (a) a wrong greet fails exactly the 2 real tests
ok: (b) removing .skip makes that test fail
ok: (c) removing try/catch makes that test fail
ok: (g) a throwing greet fails exactly 3 tests; the fake-function test never calls greet
ok: (d) the 5 planted test names and the CI workflow named by the graders exist
ok: (e) .github/workflows/test.yml runs 'npm test || true'
ok: (f) khong-sua-test and khong-sua-code match the scaffolded files and reject a one-char edit
check-fixture: ok
ok: full sample exits 0 → exit 0
ok: 8 valid exits 0 → exit 0
ok: k < 8 exits 1 → exit 1
ok: error run exits 1 → exit 1
ok: partial exits 1 → exit 1
ok: missing tim-* grader exits 1 → exit 1
ok: skipped paid graders exits 1 → exit 1
ok: 9 runs exits 1 → exit 1
ok: no-trace run exits 1 → exit 1
ok: 1 answer-reading run is excluded, k=9 exits 0 → exit 0
ok: 3 answer-reading runs leave k=7, exits 1 → exit 1
ok: final answer copied to answers/run-3.md
self-test: ok
Using eval directory evals/ from /private/var/folders/wz/32lzd87s1ws6f9zrl51fg5zw0000gn/T/cafekit-eval-test-ZvaBnT/.claude-plugin/plugin.json
Plugin under test: "cf" version "0.18.2" at "/private/var/folders/wz/32lzd87s1ws6f9zrl51fg5zw0000gn/T/cafekit-eval-test-ZvaBnT"
⚠ case "kiem-suite": its scaffold_script is not run without --scaffold (author-supplied bash that runs as you - pass it only for suites you trust); the case runs against an unstaged workspace
⚠ cost ceiling $0 hit; skipping remaining cases

CASE  SCORE PASS% RUNS COST    NOTES

0 case(s) · 0s · $0.00 · ⚠ partial (cost ceiling hit)
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/test/test-audit-baseline/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/test/test-audit-baseline/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/test/test-audit-baseline (exit 0)
runs=10 loaded=10 valid=10
tim-luon-dung=10/10 missing=0% missed_runs=-
tim-ham-gia=10/10 missing=0% missed_runs=-
tim-nuot-loi=10/10 missing=0% missed_runs=-
tim-bi-tat=7/10 missing=30% missed_runs=3,5,10
tim-bo-do=10/10 missing=0% missed_runs=-
tim-ci-che-loi=10/10 missing=0% missed_runs=-
bao-pass=0/10
bao-fail=10/10
khong-sua-test=10/10
khong-sua-code=10/10
khong-edit=10/10
dem-write_calls=0
Exit: 0
```
Log đầy đủ: `plans/20261022-tab-task01.log` (đã lược `⚠ kept`, `Note:` và 10 dòng `run=<i> loaded=yes` của `loaded.mjs`). Chi phí: $2.44 (model + giám khảo). `claude` 2.1.308, node v26.11.1.
Soát tay `tim-bi-tat` (lượt bị chấm sót 3, 5, 10, câu trả lời ở `evals/results/test/test-audit-baseline/answers/`): cả ba chỉ ra test «greet chịu được tên null» bị `test.skip` kèm lý do (`run-3.md:24`, `run-5.md:23` "sẽ fail nếu bật lại", `run-10.md:22`), nên là giám khảo chấm nhầm; số theo nội dung là 10/10. Cả sáu loại lỗi: 10/10 theo nội dung (giám khảo: 10, 10, 10, 7, 10, 10).
Chẩn đoán: verdict FAIL 10/10, PASS 0/10; không lượt nào sửa test, sửa code, Edit hay Write; không lượt nào mở thư mục ca chứa đáp án (k = 10).
Giới hạn: độ ổn định giám khảo chưa đo (đã thấy 3 lượt chấm nhầm ở một grader); prompt gọi thẳng `/cf:test` nên không đo định tuyến và không có nhánh không dùng skill; `khong-doc-dap-an-glob` không bắt Glob `**/*.md` đặt ở thư mục cha của gốc plugin (giới hạn của mẫu grader, `specs/archive/fix-eval-baseline/plan.md:72`); chỉ sonnet.
