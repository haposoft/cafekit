# Task 01 — Ca `hai-huong` và chạy đo

Status: done

## Outcome
Có số đo: trong 10 lượt sonnet chạy `cf:brainstorm` trên một bài toán hai hướng, bao nhiêu lượt hợp lệ (D-03) thể hiện từng heuristic của D-02.

## Scope
- In: thư mục fixture và thư mục ca theo D-01, grader theo D-02, lệnh tổng hợp theo D-03, kiểm nạp miễn phí, một lượt đo.
- Out: sửa skill; mọi file ngoài hai thư mục; các mục Out of scope của `plan.md`.

## Coverage
- CP-01

## Ownership
- Create: `evals/brainstorm/fixtures/hai-huong/plans/queue-design.md`, `evals/brainstorm/fixtures/hai-huong/src/**`, `evals/brainstorm/hai-huong/case.yaml`, `evals/brainstorm/hai-huong/scaffold.sh`, `evals/brainstorm/hai-huong/graders/*.md`, `evals/brainstorm/hai-huong/summarize.mjs`
- Read: `evals/brainstorm/mot-duong-agent/**`, `evals/brainstorm/fixtures/mot-duong/**`, `evals/debug/doc-ma-sai-huong/graders/*.md`, `evals/run.sh`, `evals/lean/loaded.mjs`, `packages/spec/src/claude/skills/brainstorm/SKILL.md`

## Steps
1. Fixture theo D-01: `src/jobs/` (worker giả dùng bảng `jobs` trên Postgres) và `plans/queue-design.md` liệt kê đúng các dữ kiện của D-01, không nêu sẵn giả định nào là chịu lực.
2. `case.yaml` (runs 10; `allowed_tools: [Read, Glob, Grep, Skill, Bash, AskUserQuestion]`), `scaffold.sh` chép fixture rồi commit (theo `mot-duong-agent/scaffold.sh`). Prompt: "/cf:brainstorm Theo ràng buộc trong plans/queue-design.md, nên làm hàng đợi job bằng Postgres LISTEN/NOTIFY + bảng job hay Redis Streams? Không cần hỏi lại, hãy đưa khuyến nghị."
3. Grader theo D-02; mỗi grader `llm` có đoạn bối cảnh nêu dữ kiện fixture, hướng thứ ba có thể có, và bẫy "đúng một lần", rồi tiêu chí ĐẠT/KHÔNG ĐẠT đúng như D-02.
4. `summarize.mjs`: đọc `evals/results/brainstorm/<out>/result.json`; chạy `node evals/lean/loaded.mjs brainstorm <result dir>` qua `spawnSync` (không import: module chạy luôn phần CLI) và ghép dòng `run=<i> loaded=<…>` với từng lượt (trace giữ nhờ `--keep-temp`); CLI thoát khác 0 thì `summarize.mjs` thoát 1; in `runs=<n> loaded=<l> valid=<k>` rồi `<grader>=<x>/<k> missing=<p>%` cho bốn heuristic và `askuser_calls=<m>`, kèm lý do từng lượt bị loại; thoát 1 khi n ≠ 10, có lượt `no-trace`/`unreadable`, hoặc k < 8, ngược lại thoát 0.
5. Kiểm miễn phí: `evals/run.sh brainstorm --plugin-name cf --validate --case hai-huong --ablation none --allow-tools Bash` nạp được ca; `node evals/brainstorm/hai-huong/summarize.mjs` trên một `result.json` giả (dựng tay trong thư mục tạm) in đúng định dạng và thoát 1 khi k < 8.
6. Đo theo Verification Plan.

## Acceptance
- AC-01: 10/10 lượt không lỗi harness; lệnh tổng hợp in đủ số; Receipt ghi các số đó, chi phí, và "độ ổn định giám khảo: chưa đo".

## Dependencies
- none

## Verification Plan
- Command: `evals/run.sh brainstorm --plugin-name cf --out brainstorm-heuristics-baseline --case hai-huong --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash --max-cost-usd 8 --keep-temp && node evals/brainstorm/hai-huong/summarize.mjs brainstorm-heuristics-baseline`
- Named probe: grader `co-khuyen-nghi`, `gia-dinh-diem-gay`, `truong-hop-xau`, `re-nhat-de-bo`, `xet-huong-tot-hon`, `dem-askuser`; kiểm nạp skill trong `summarize.mjs`.
- Reachability: scaffold chạy qua `--scaffold` mà `run.sh` truyền mặc định (`evals/run.sh:130`); skill nạp dưới tên `cf:brainstorm` nhờ `--plugin-name cf`.
- Oracle: lệnh tổng hợp thoát 0 và in `runs=10`, `valid=<k>` với k ≥ 8, cùng bốn dòng heuristic; PASS nghĩa là đo đủ, số heuristic là dữ liệu cho GATE-SCOPE.
- Counterexample: ca không nạp được ở Step 5, lượt đo dừng vì chạm trần chi phí, hoặc dưới 8 lượt hợp lệ → không đóng, báo "chưa đủ mẫu".
- Artifacts: `evals/results/brainstorm/brainstorm-heuristics-baseline/` (git-ignored, không xoá); ghi chi phí vào Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: evals/run.sh brainstorm --plugin-name cf --out brainstorm-heuristics-baseline --case hai-huong --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash --max-cost-usd 8 --keep-temp && node evals/brainstorm/hai-huong/summarize.mjs brainstorm-heuristics-baseline
Exit: 0
Base: 366d8cb4f623e7db425dd91a34ef51f29c448838
Head: 1aa51154b5bc0404359fa8d741b7d565dc6062a90e60b3fa8bdd8fdab5cf3bca
```text
$ evals/run.sh brainstorm --plugin-name cf --out brainstorm-heuristics-baseline --case hai-huong --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash --max-cost-usd 8 --keep-temp && node evals/brainstorm/hai-huong/summarize.mjs brainstorm-heuristics-baseline
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/brainstorm-heuristics-baseline/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/brainstorm-heuristics-baseline/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/brainstorm-heuristics-baseline (exit 0)
runs=10 loaded=10 valid=10
gia-dinh-diem-gay=0/10 missing=100%
truong-hop-xau=0/10 missing=100%
re-nhat-de-bo=1/10 missing=90%
xet-huong-tot-hon=9/10 missing=10%
askuser_calls=0
Exit: 0
```
Log đầy đủ: `plans/20261022-brainstorm-3c-run.log`. Kiểm miễn phí trước đó: `--validate` nạp ca không ✗; `summarize.mjs` trên dữ liệu giả thoát 0 khi k=9 và 1 khi k=6.
Chi phí lượt này: model $1.59 + giám khảo $0.74 = $2.33. Lần 1 (`evals/results/brainstorm/brainstorm-heuristics-baseline-r1`, trước khi sửa câu bối cảnh NOTIFY trong grader): 0/10, 0/10, 0/10, 9/10, $2.37; trace của nó bị khởi động lại máy xoá nên chạy lại toàn bộ Command. Tổng gói: $4.70.
Review: code-auditor PASS (sau khi sửa 1 Medium + 2 Low); đã đọc câu trả lời lượt 1, 4, 5, 9: 0/10 là thiếu sót thật theo D-02, không phải giám khảo quá khắt khe.
Độ ổn định giám khảo: chưa đo (mỗi grader 3 phiếu, các lượt đọc được đều đồng thuận).
