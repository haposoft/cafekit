# Task 01 — Số "trước" của 2 ca hồi quy

Status: done

## Outcome
Có số đạt theo grader của `mot-duong-agent` và `ne-cau-hoi` trên skill hiện tại (sonnet, n=10 mỗi ca), và có `regress.mjs` đã tự thử để task-03 so theo D-02/D-03.

## Scope
- In: tạo `evals/brainstorm/hai-huong/regress.mjs` (kèm `--self-test`); chạy hai ca trên SKILL.md chưa sửa.
- Out: sửa SKILL.md, grader, case, history; mọi mục Out of scope của `plan.md`.

## Coverage
- CP-01

## Ownership
- Create: `evals/brainstorm/hai-huong/regress.mjs`
- Read: `evals/summarize.mjs`, `evals/lean/loaded.mjs`, `evals/brainstorm/mot-duong-agent/**`, `evals/brainstorm/ne-cau-hoi/**`, `evals/run.sh`

## Steps
1. `regress.mjs <before dir> <after dir>`: đọc `result.json` hai thư mục; với các grader D-02 của ca đó (`mot-duong-agent`: `khong-bu-nhin`, `mot-duong`, `do-dai-gon`; `ne-cau-hoi`: `do-dai-gon`, `co-khuyen-nghi`, `khong-hoi-lai`; ca xác định theo `cases[0].name`, ca khác thì thoát 2) in `<grader> before=<b>/<n> after=<a>/<m>`; thoát 1 khi một grader giảm ≥ 3 lượt đạt, khi một bên `partial: true`, có lượt mang `error`, không có đúng 10 lượt, thiếu một grader ở một bên, hoặc `claudeVersion` hai bên khác nhau; ngược lại thoát 0. `regress.mjs --self-test` dựng dữ liệu giả trong thư mục tạm và kiểm: giảm 2 → 0, giảm 3 → 1, partial → 1, error → 1, lệch `claudeVersion` → 1; in `self-test: ok`. Chú thích đầu file bằng tiếng Việt theo kiểu `evals/*.mjs`.
2. Kiểm miễn phí: `evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --validate --case mot-duong-agent --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch` và tương tự với `ne-cau-hoi` nạp được ca.
3. Chạy Verification Plan (trả phí), trước mọi sửa SKILL.md; controller ghi output vào `plans/` (ngoài `/private/tmp`).

## Acceptance
- AC-01: Command thoát 0; Receipt ghi `claude --version`, số theo grader của hai thư mục, dòng `loaded=` của `loaded.mjs` cho mỗi thư mục, chi phí.

## Dependencies
- none

## Verification Plan
- Command: `export DISABLE_AUTOUPDATER=1 && git diff --quiet HEAD -- packages/spec/src/claude/skills/brainstorm evals/brainstorm/ne-cau-hoi/history.jsonl && claude --version && node evals/brainstorm/hai-huong/regress.mjs --self-test && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-truoc-mot-duong-agent --case mot-duong-agent --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-truoc-ne-cau-hoi --case ne-cau-hoi --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && node evals/summarize.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-ne-cau-hoi && node evals/lean/loaded.mjs brainstorm evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-ne-cau-hoi && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-mot-duong-agent && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-ne-cau-hoi evals/results/brainstorm/bhr-truoc-ne-cau-hoi`
- Named probe: `regress.mjs --self-test`; 6 cặp grader của D-02; `regress.mjs` thư mục với chính nó (chặn `partial`/`error`/thiếu lượt bằng mã thoát).
- Reachability: hai ca chạy dưới tên plugin mặc định `cafekit-brainstorm`, khớp `evals/brainstorm/ne-cau-hoi/graders/co-goi-skill.md:4`; SKILL.md lấy từ `packages/spec/src/claude/skills/brainstorm` (`evals/run.sh:33`); `ne-cau-hoi` nạp skill qua `history.jsonl`.
- Oracle: lệnh thoát 0; summarize in đủ grader của hai thư mục, không thư mục nào `partial`.
- Counterexample: `git diff --quiet` đầu lệnh khác 0 (skill hay history đã sửa) → lệnh dừng, số "trước" không hợp lệ.
- Artifacts: `evals/results/brainstorm/bhr-truoc-*` (git-ignored, không xoá); chi phí vào Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: export DISABLE_AUTOUPDATER=1 && git diff --quiet HEAD -- packages/spec/src/claude/skills/brainstorm evals/brainstorm/ne-cau-hoi/history.jsonl && claude --version && node evals/brainstorm/hai-huong/regress.mjs --self-test && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-truoc-mot-duong-agent --case mot-duong-agent --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-truoc-ne-cau-hoi --case ne-cau-hoi --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && node evals/summarize.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-ne-cau-hoi && node evals/lean/loaded.mjs brainstorm evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-ne-cau-hoi && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-mot-duong-agent && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-ne-cau-hoi evals/results/brainstorm/bhr-truoc-ne-cau-hoi
Exit: 0
Base: d1d171c4688bb5e875080e02c0b63ed85da48e44
Head: 582aab9bad7749eb6f2b048c31f7e6f4c89c83cb5a2cd207a04f5fe114b5cb2d
```text
$ export DISABLE_AUTOUPDATER=1 && git diff --quiet HEAD -- packages/spec/src/claude/skills/brainstorm evals/brainstorm/ne-cau-hoi/history.jsonl && claude --version && node evals/brainstorm/hai-huong/regress.mjs --self-test && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-truoc-mot-duong-agent --case mot-duong-agent --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && evals/run.sh brainstorm --with-skill specs --with-agent brainstormer --out bhr-truoc-ne-cau-hoi --case ne-cau-hoi --model sonnet --judge-model sonnet --runs 10 --threshold 0 --ablation none --allow-tools Bash Edit Write AskUserQuestion WebSearch WebFetch --max-cost-usd 6 --keep-temp && node evals/summarize.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-ne-cau-hoi && node evals/lean/loaded.mjs brainstorm evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-ne-cau-hoi && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-mot-duong-agent evals/results/brainstorm/bhr-truoc-mot-duong-agent && node evals/brainstorm/hai-huong/regress.mjs evals/results/brainstorm/bhr-truoc-ne-cau-hoi evals/results/brainstorm/bhr-truoc-ne-cau-hoi
2.1.307 (Claude Code)
ok: drop 2 passes → exit 0
ok: drop 3 fails → exit 1
ok: partial fails → exit 1
ok: error fails → exit 1
ok: version mismatch fails → exit 1
ok: 9 runs fails → exit 1
ok: skipped paid graders fails → exit 1
ok: missing grader fails → exit 1
ok: unknown case exits 2 → exit 2
ok: missing result.json exits 2 → exit 2
self-test: ok
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-truoc-mot-duong-agent/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-truoc-mot-duong-agent/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-truoc-mot-duong-agent (exit 0)
Wrote /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-truoc-ne-cau-hoi/result.json
Report: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-truoc-ne-cau-hoi/report.html
results: /Users/nghialuutrung/Desktop/cafekit/evals/results/brainstorm/bhr-truoc-ne-cau-hoi (exit 0)

evals/results/brainstorm/bhr-truoc-mot-duong-agent  model=sonnet  judge=sonnet  ablation=none  started=2026-10-22T03:14:56.116Z  cost=$1.47
  mot-duong-agent [with]  runs 10  Skill invoked 0/10 (10 run(s) with no skill grader)  co-goi-agent 10/10  dem-agent 10/10  dem-askuser 10/10  dem-bash 10/10  dem-edit 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dem-skill 10/10  dem-webfetch 10/10  dem-websearch 10/10  dem-write 10/10  do-dai-gon 7/10  khong-bu-nhin 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit 10/10  khong-file-moi 10/10  khong-tu-duyet 9/10  khong-write 10/10  mot-duong 9/10  nhan-kha-thi 7/10

evals/results/brainstorm/bhr-truoc-ne-cau-hoi  model=sonnet  judge=sonnet  ablation=none  started=2026-10-22T03:23:12.272Z  cost=$0.75
  ne-cau-hoi [with]  runs 10  Skill invoked 0/10  co-goi-skill 0/10  co-khuyen-nghi 10/10  dem-agent 10/10  dem-askuser 10/10  dem-bash 10/10  dem-edit 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dem-skill 10/10  dem-webfetch 10/10  dem-websearch 10/10  dem-write 10/10  do-dai-gon 10/10  dua-muc-tieu 10/10  ghi-gia-dinh 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit 10/10  khong-file-moi 10/10  khong-hoi-ky-thuat 10/10  khong-hoi-lai 10/10  khong-write 10/10  noi-do-sau 10/10  noi-route 10/10

AGGREGATE over 2 directories
  mot-duong-agent [with]  runs 10  Skill invoked 0/10 (10 run(s) with an unread skill count)  co-goi-agent 10/10  dem-agent 10/10  dem-askuser 10/10  dem-bash 10/10  dem-edit 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dem-skill 10/10  dem-webfetch 10/10  dem-websearch 10/10  dem-write 10/10  do-dai-gon 7/10  khong-bu-nhin 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit 10/10  khong-file-moi 10/10  khong-tu-duyet 9/10  khong-write 10/10  mot-duong 9/10  nhan-kha-thi 7/10
  ne-cau-hoi [with]  runs 10  Skill invoked 0/10  co-goi-skill 0/10  co-khuyen-nghi 10/10  dem-agent 10/10  dem-askuser 10/10  dem-bash 10/10  dem-edit 10/10  dem-glob 10/10  dem-grep 10/10  dem-read 10/10  dem-skill 10/10  dem-webfetch 10/10  dem-websearch 10/10  dem-write 10/10  do-dai-gon 10/10  dua-muc-tieu 10/10  ghi-gia-dinh 10/10  khong-doc-dap-an-bash 10/10  khong-doc-dap-an-glob 10/10  khong-doc-dap-an-grep 10/10  khong-doc-dap-an-read 10/10  khong-edit 10/10  khong-file-moi 10/10  khong-hoi-ky-thuat 10/10  khong-hoi-lai 10/10  khong-write 10/10  noi-do-sau 10/10  noi-route 10/10
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=1 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=2 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=3 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=4 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=5 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=6 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=7 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=8 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=9 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent run=10 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-mot-duong-agent loaded=0/10 model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=1 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=2 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=3 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=4 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=5 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=6 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=7 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=8 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=9 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi run=10 loaded=no via=- model=claude-sonnet-5-5
evals/results/brainstorm/bhr-truoc-ne-cau-hoi loaded=0/10 model=claude-sonnet-5-5
mot-duong-agent khong-bu-nhin before=10/10 after=10/10
mot-duong-agent mot-duong before=9/10 after=9/10
mot-duong-agent do-dai-gon before=7/10 after=7/10
ne-cau-hoi do-dai-gon before=10/10 after=10/10
ne-cau-hoi co-khuyen-nghi before=10/10 after=10/10
ne-cau-hoi khong-hoi-lai before=10/10 after=10/10
Exit: 0
```
Log đầy đủ: `plans/20261022-bhr-task01.log` (đã lược các dòng `⚠ kept`, `Note:`, `median`). Chi phí: `mot-duong-agent` $1.47 + `ne-cau-hoi` $0.75 = $2.22. Lượt trước (`*-r1`, $2.22) chạy với `regress.mjs` chưa chặn `skippedPaidGraders`; review sau sửa PASS nên chạy lại cả Command.
Giới hạn: `loaded=0/10` ở cả hai ca. `mot-duong-agent` giao việc cho agent `brainstormer` và controller không nạp skill (median `dem-skill` 0), nên ca này không đo được câu mới của SKILL.md. `ne-cau-hoi` nạp skill qua `history.jsonl` mà `loaded.mjs` không nhận ra; `node evals/brainstorm/make-history.mjs --check` thoát 0 (history khớp SKILL.md hiện tại).
Nhiễu: cùng skill, `mot-duong-agent` `do-dai-gon` 9/10 ở `-r1` và 7/10 ở lượt này; `mot-duong` 10/10 và 9/10.
