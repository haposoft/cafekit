# Task 03 — Đo sau: `hai-huong` + 2 ca hồi quy

Status: done

## Outcome
Có số "sau" cho ba ca trên SKILL.md đã sửa; máy kiểm được ngưỡng heuristic (D-01) và không hồi quy (D-02, D-03).

## Scope
- In: thêm cờ `--require <pct>` vào `evals/brainstorm/hai-huong/summarize.mjs`; một lượt đo ba ca; tối đa một lượt xác nhận cho mỗi ca trượt (Failure Protocol).
- Out: sửa SKILL.md, grader, case; mọi mục Out of scope của `plan.md`.

## Coverage
- CP-03

## Ownership
- Modify: `evals/brainstorm/hai-huong/summarize.mjs`
- Read: `evals/brainstorm/hai-huong/regress.mjs`, `specs/brainstorm-heuristics-repair/task-01-before-regression.md`

## Steps
1. `--require <pct>`: gỡ cặp `--require <pct>` khỏi argv trước khi đọc `<out name> [<results dir>]`; `pct` phải là số 0–100, sai thì thoát 2; sau phần in hiện có, thoát 1 khi một trong bốn heuristic đạt < pct% của k; không có cờ thì giữ hành vi cũ. Thử trên dữ liệu giả trong scratchpad: số gốc (0/0/1/9 của 10) với `--require 70` thoát 1, dữ liệu 8/8/8/9 thoát 0.
2. Trước khi chạy lại: đổi tên (không xoá) `evals/results/brainstorm/bhr-sau-hai-huong` thành `bhr-sau-hai-huong-r1` và `bhr-sau-hai-huong-xn` thành `bhr-sau-hai-huong-xn-r1` vì `evals/run.sh` từ chối ghi đè (`evals/run.sh:125`); log cũ đổi thành `*-r1.log`.
3. Chạy Verification Plan; controller ghi output vào `plans/`.

## Acceptance
- AC-03: Command thoát 0; Receipt ghi `claude --version`, số "sau" từng heuristic, bảng `regress.mjs` của hai ca, dòng `loaded=` từng thư mục (ca không nạp SKILL.md ghi là giới hạn), chi phí.

## Dependencies
- task-04-every-approach.md

## Verification Plan
- Command: `export DISABLE_AUTOUPDATER=1 && claude --version && evals/run.sh brainstorm --plugin-name cf --out bhr-sau-hai-huong --case hai-huong --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash --max-cost-usd 8 --keep-temp && node evals/brainstorm/hai-huong/summarize.mjs bhr-sau-hai-huong --require 70 && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-sau-mot-duong-agent --case mot-duong-agent --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-sau-ne-cau-hoi --case ne-cau-hoi --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && node evals/lean/loaded.mjs brainstorm evals/results/brainstorm/bhr-sau-mot-duong-agent evals/results/brainstorm/bhr-sau-ne-cau-hoi && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-sau-mot-duong-agent && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-ne-cau-hoi evals/results/brainstorm/bhr-sau-ne-cau-hoi`
- Named probe: `summarize.mjs --require 70`; `regress.mjs` hai ca.
- Reachability: `hai-huong` nạp `cf:brainstorm` (`--plugin-name cf`), hai ca cũ nạp `cafekit-brainstorm:brainstorm`; cả ba lấy SKILL.md đã sửa từ `packages/spec/src`, `ne-cau-hoi` qua `history.jsonl` đã sinh lại ở task-02.
- Oracle: lệnh thoát 0.
- Counterexample: heuristic < 70% của k, k < 8, một cặp grader D-02 giảm ≥ 3, hoặc `claudeVersion` lệch với task-01 → không đóng; lệch version thì `blocked` và hỏi Bro (plan D-02).
- Artifacts: `evals/results/brainstorm/bhr-sau-*` (không xoá); chi phí vào Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. Riêng khi lệnh dừng vì ngưỡng (D-01) hoặc hồi quy (D-02) chứ không vì lỗi harness: chạy xác nhận một lần đúng ca đó với `--out <tên cũ>-xn`, cùng cờ; vẫn trượt → task `blocked` với số đo, quay lại GATE-SCOPE; xác nhận qua → task `blocked` ghi "giáp ranh" kèm cả hai số, Bro quyết ở GATE-DONE; không lượt nào tự thành PASS.

## Receipt

Verification: PASS
Command: export DISABLE_AUTOUPDATER=1 && claude --version && evals/run.sh brainstorm --plugin-name cf --out bhr-sau-hai-huong --case hai-huong --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash --max-cost-usd 8 --keep-temp && node evals/brainstorm/hai-huong/summarize.mjs bhr-sau-hai-huong --require 70 && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-sau-mot-duong-agent --case mot-duong-agent --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-sau-ne-cau-hoi --case ne-cau-hoi --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && node evals/lean/loaded.mjs brainstorm evals/results/brainstorm/bhr-sau-mot-duong-agent evals/results/brainstorm/bhr-sau-ne-cau-hoi && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-sau-mot-duong-agent && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-ne-cau-hoi evals/results/brainstorm/bhr-sau-ne-cau-hoi
Exit: 0
Base: d1d171c4688bb5e875080e02c0b63ed85da48e44
Head: be9e934a1078f94266f8b3d5fd32aae2cf8e26458f085b431d55e74fb1300dc8
```text
$ export DISABLE_AUTOUPDATER=1 && claude --version && evals/run.sh brainstorm --plugin-name cf --out bhr-sau-hai-huong --case hai-huong --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash --max-cost-usd 8 --keep-temp && node evals/brainstorm/hai-huong/summarize.mjs bhr-sau-hai-huong --require 70 && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-sau-mot-duong-agent --case mot-duong-agent --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-sau-ne-cau-hoi --case ne-cau-hoi --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && node evals/lean/loaded.mjs brainstorm evals/results/brainstorm/bhr-sau-mot-duong-agent evals/results/brainstorm/bhr-sau-ne-cau-hoi && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-sau-mot-duong-agent && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-ne-cau-hoi evals/results/brainstorm/bhr-sau-ne-cau-hoi
2.1.307 (Claude Code)
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-hai-huong/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-hai-huong/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-hai-huong (exit 0)
runs=10 loaded=10 valid=10
gia-dinh-diem-gay=10/10 missing=0%
truong-hop-xau=9/10 missing=10%
re-nhat-de-bo=10/10 missing=0%
xet-huong-tot-hon=9/10 missing=10%
askuser_calls=0
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-mot-duong-agent/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-mot-duong-agent/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-mot-duong-agent (exit 0)
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-ne-cau-hoi/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-ne-cau-hoi/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-sau-ne-cau-hoi (exit 0)
evals/results/brainstorm/bhr-sau-mot-duong-agent run=1 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=2 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=3 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=4 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=5 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=6 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=7 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=8 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=9 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent run=10 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-mot-duong-agent loaded=0/10 model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=1 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=2 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=3 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=4 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=5 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=6 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=7 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=8 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=9 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi run=10 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-sau-ne-cau-hoi loaded=0/10 model=claude-sonnet-5-5
mot-duong-agent khong-bu-nhin before=10/10 after=10/10
mot-duong-agent mot-duong before=9/10 after=9/10
mot-duong-agent do-dai-gon before=7/10 after=8/10
ne-cau-hoi do-dai-gon before=10/10 after=10/10
ne-cau-hoi co-khuyen-nghi before=10/10 after=10/10
ne-cau-hoi khong-hoi-lai before=10/10 after=10/10
Exit: 0
```
Log đầy đủ: `plans/20261022-bhr-task03.log` (đã lược `⚠ kept`, `Note:`, `median`). Chi phí: `hai-huong` $2.68 + `mot-duong-agent` $1.44 + `ne-cau-hoi` $0.79 = $4.91. Câu lần 1 (trước task-04): `bhr-sau-hai-huong-r1` 7/10, 6/10, 10/10, 9/10 và xác nhận `bhr-sau-hai-huong-xn-r1` 5/10, 4/10, 10/10, 8/10 ($5.02, log `plans/20261022-bhr-task03*-r1.log`). Gốc (gói `brainstorm-heuristics-baseline`): 0/10, 0/10, 1/10, 9/10.
Kiểm tay (code-auditor, 3 lượt): các verdict PASS khớp grader, có giả định + điều kiện gãy + hệ quả cho cả Redis Streams bị loại; hai verdict FAIL (lượt 7 `truong-hop-xau`, lượt 2 `xet-huong-tot-hon`) nhiều khả năng là giám khảo chấm nhầm, nên số đo nghiêng về thấp; result.json không giữ lý do của giám khảo nên chưa xác nhận được. Trung vị độ dài câu trả lời cuối 3718 ký tự (r1: 3467).
Giới hạn: `mot-duong-agent` không nạp SKILL.md (`loaded=0/10`, việc giao cho agent `brainstormer`), nên ca này chỉ cho thấy đường agent không đổi; `ne-cau-hoi` nạp skill qua `history.jsonl` đã sinh lại (task-04, `make-history.mjs --check` thoát 0) mà `loaded.mjs` không nhận ra. Độ ổn định giám khảo chưa đo.
