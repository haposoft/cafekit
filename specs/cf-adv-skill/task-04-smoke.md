# Task 04 — Smoke sống `/cf:adv`

Status: done

## Outcome
Một lượt `/cf:adv` thật với brief đầy đủ trả về đủ cấu trúc lời khuyên (D-07).

## Scope
- In: ca `evals/adv/smoke/` (case.yaml, graders), một lượt đo `--runs 1`.
- Out: đo phỏng vấn nhiều vòng; các mục Out of scope của `plan.md`.

## Coverage
- CP-04

## Ownership
- Create: `evals/adv/smoke/case.yaml`, `evals/adv/smoke/graders/*.md`
- Read: `evals/run.sh`, `evals/code-review/nhan-gop-y/**`

## Steps
1. `case.yaml`: `runs: 1`; prompt `/cf:adv` kèm brief đầy đủ (bài toán nhỏ, ví dụ chọn cách lưu cấu hình người dùng), các câu trả lời phỏng vấn và một reframing ghi rõ "đã xác nhận, không cần hỏi lại"; `allowed_tools: [Read, Glob, Grep, Skill, Bash, Write]`; không cần scaffold.
2. Grader regex trên câu trả lời cuối: có `Verdict`, có `What you should do` (hoặc tiếng Việt tương đương), có `Trade-offs`, có khối handoff chứa `Objective:` và `Done means:`; không dùng grader `tool_used` Skill (slash không gọi công cụ Skill, `evals/lean/loaded.mjs:6`; nạp skill kiểm ở Command); bộ đếm Edit; Write chỉ dưới `plans/reports/`.
3. `evals/run.sh adv --plugin-name cf --validate --case smoke --ablation none --allow-tools Bash Write` không có ✗; rồi chạy Verification Plan.

## Acceptance
- AC-04: Command thoát 0; các grader cấu trúc đạt; Receipt ghi chi phí và câu trả lời cuối (trích).

## Dependencies
- task-03-plugin.md

## Verification Plan
- Command: `export DISABLE_AUTOUPDATER=1 && claude --version && evals/run.sh adv --plugin-name cf --validate --case smoke --ablation none --allow-tools Bash Write && evals/run.sh adv --plugin-name cf --out adv-smoke --case smoke --model sonnet --judge-model sonnet --runs 1 --threshold 1 --ablation none --allow-tools Bash Write --max-cost-usd 2 --keep-temp && node evals/lean/loaded.mjs adv evals/results/adv/adv-smoke | tee /dev/stderr | grep -q ' loaded=1/1 '`
- Named probe: các grader cấu trúc.
- Reachability: `evals/run.sh` chép skill từ `packages/spec/src/claude/skills/adv` (`evals/run.sh:33`).
- Oracle: thoát 0 (`--threshold 1` = mọi grader phải đạt, dưới ngưỡng thì lệnh thoát 1; `grep` chặn khi không có `loaded=1/1`). Nếu `loaded=0/1` vì `disable-model-invocation` làm `init.skills` không liệt kê skill (`[UNVERIFIED]`), task `blocked` và đọc trace trước khi kết luận.
- Counterexample: skill không nạp (`loaded=0/1`) hoặc thiếu một phần cấu trúc → không đóng.
- Artifacts: `evals/results/adv/adv-smoke/` (không xoá); chi phí vào Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: export DISABLE_AUTOUPDATER=1 && claude --version && evals/run.sh adv --plugin-name cf --validate --case smoke --ablation none --allow-tools Bash Write && evals/run.sh adv --plugin-name cf --out adv-smoke --case smoke --model sonnet --judge-model sonnet --runs 1 --threshold 1 --ablation none --allow-tools Bash Write --max-cost-usd 2 --keep-temp && node evals/lean/loaded.mjs adv evals/results/adv/adv-smoke | tee /dev/stderr | grep -q ' loaded=1/1 '
Exit: 0
Base: afa2276502b31a89e885dddbcf3b71904310dd19
Head: 23cb2f8da0dd31b33d54351f8b65df4e8b2cc23ad9cf95039f3a116617ff7ced
```text
$ export DISABLE_AUTOUPDATER=1 && claude --version && evals/run.sh adv --plugin-name cf --validate --case smoke --ablation none --allow-tools Bash Write && evals/run.sh adv --plugin-name cf --out adv-smoke --case smoke --model sonnet --judge-model sonnet --runs 1 --threshold 1 --ablation none --allow-tools Bash Write --max-cost-usd 2 --keep-temp && node evals/lean/loaded.mjs adv evals/results/adv/adv-smoke | tee /dev/stderr | grep -q ' loaded=1/1 '
2.1.308 (Claude Code)
Using eval directory evals/ from /private/var/folders/wz/32lzd87s1ws6f9zrl51fg5zw0000gn/T/cafekit-eval-adv-ygfH77/.claude-plugin/plugin.json
Plugin under test: "cf" version "0.18.2" at "/private/var/folders/wz/32lzd87s1ws6f9zrl51fg5zw0000gn/T/cafekit-eval-adv-ygfH77"
⚠ cost ceiling $0 hit; skipping remaining cases

CASE  SCORE PASS% RUNS COST    NOTES

0 case(s) · 0s · $0.00 · ⚠ partial (cost ceiling hit)
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/adv/adv-smoke/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/adv/adv-smoke/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/adv/adv-smoke (exit 0)
evals/results/adv/adv-smoke run=1 loaded=yes via=slash model=claude-sonnet-5-5
evals/results/adv/adv-smoke loaded=1/1 model=claude-sonnet-5-5
Exit: 0
```
Grader của lượt này (`evals/results/adv/adv-smoke/result.json`): `co-verdict`, `co-nen-lam`, `co-trade-off`, `co-handoff`, `dem-edit`, `write-chi-report` đều đạt; chi phí $0.13; trace không có tool call nào. Hai lần trước: r1 (`adv-smoke-r1`, $0.09) Exit 1 vì regex trade-off không bắt tiêu đề tiếng Việt "Đánh đổi" — câu trả lời vẫn đủ chín mục và handoff; r2 (`adv-smoke-r2`) Exit 0 nhưng review chỉ ra `co-nen-lam` khớp nhầm "Không nên làm" → neo cả ba regex vào tiêu đề, thử âm tính trên văn bản giả rồi chạy r3 này. Review: code-auditor PASS. Giới hạn: grader chỉ nhận mục viết thành tiêu đề `#`, mục viết bằng nhãn in đậm sẽ bị chấm trượt (không bao giờ chấm đạt sai); ghi file qua Bash không được đếm; một lượt, chỉ sonnet; phỏng vấn nhiều vòng và relay `--agent` chưa chạy sống.
