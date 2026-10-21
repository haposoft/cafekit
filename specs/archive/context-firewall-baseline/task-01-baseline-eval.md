# Task 01 — Hai ca đo gốc và chạy đo

Status: blocked
Blocker: CUT ở GATE-SCOPE mở lại 2026-10-21 — host Claude đã tự giới hạn output (xem plan.md), không đo.

## Outcome
Có số đo cho mỗi ca: bao nhiêu trong 10 lượt sonnet đổ nguyên một file ≥128 KB vào context.

## Scope
- In: hai thư mục ca mới trong `evals/ask/` theo D-01, scaffold sinh file lớn tất định (không tải mạng), grader theo D-02, một kiểm fixture miễn phí, một lượt đo.
- Out: hook; mọi thay đổi ngoài hai thư mục ca.

## Coverage
- CP-01

## Ownership
- Create: `evals/ask/log-lon-tim-loi/case.yaml`, `evals/ask/log-lon-tim-loi/scaffold.sh`, `evals/ask/log-lon-tim-loi/graders/*.md`, `evals/ask/json-lon-tom-tat/case.yaml`, `evals/ask/json-lon-tom-tat/scaffold.sh`, `evals/ask/json-lon-tom-tat/graders/*.md`
- Read: `evals/ask/cam-sua/**`, `evals/ask/fixture/**`, `evals/run.sh`, `evals/ask/check-fixtures.sh`

## Steps
1. Scaffold: dựng repo nhỏ từ `evals/ask/fixture/`, sinh `logs/app.log` ~5 MB (dòng INFO lặp, một dòng `ERROR` gây crash ở khoảng 70% file) và `data/export.json` ~3 MB (mảng bản ghi đồng dạng) bằng vòng lặp shell/node tất định; commit.
2. Grader mỗi ca: `do-nguyen-file` (`tool_used` Bash và Read như D-02, `max: 0` — đạt nghĩa là không đổ); `tra-loi-dung` (`regex` trên `last_message`: ca log nêu đúng mã lỗi, ca json nêu đúng tên trường cấp một).
3. Kiểm miễn phí: chạy scaffold vào thư mục tạm, xác nhận cỡ file ≥128 KB và đáp án đúng có trong file; thử regex grader trên lệnh mẫu đổ nguyên file (phải bắt) và lệnh có `grep`/`head`/Read có `limit` (không bắt). `evals/run.sh ask --plugin-name cf --validate --case '*-lon-*' --ablation none --allow-tools Bash` nạp đủ hai ca.
4. Đo theo Verification Plan.

## Acceptance
- AC-01: lượt đo hoàn tất 20/20 lượt không lỗi harness; Receipt ghi cho mỗi ca số lượt `do-nguyen-file` không đạt (= số lượt đổ nguyên file) và số lượt `tra-loi-dung` đạt.

## Dependencies
- none

## Verification Plan
- Command: `evals/run.sh ask --plugin-name cf --out context-firewall-baseline --case '*-lon-*' --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash --max-cost-usd 6 --keep-temp`
- Named probe: grader `do-nguyen-file` và `tra-loi-dung` của hai ca.
- Reachability: scaffold chạy qua `--scaffold` mà `run.sh` truyền mặc định (`evals/run.sh:130`).
- Oracle: `evals/results/ask/context-firewall-baseline/result.json` có 20 lượt, 0 lỗi; số liệu theo từng grader.
- Counterexample: grader `do-nguyen-file` không bắt được `cat logs/app.log` ở fixture Step 3 → không đo.
- Artifacts: `evals/results/ask/context-firewall-baseline/` (git-ignored, không xoá); ghi chi phí vào Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
