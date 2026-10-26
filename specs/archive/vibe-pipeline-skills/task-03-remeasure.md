# Task 03 — Đo lại pipeline vibe: pilot rồi sonnet n=10

Status: blocked
Blocker: `pipeline.mjs --compare sonnet-n5,sonnet-n5-20261026 sonnet-pipeline-n10` thoát 1 — D-04 chỉ đạt `review-local` (1/10 → 10/10, p=0.0001); `cf-git-commit` 0/10, `cf-git-pr` 3/10, `quet-secret` 4/10, `khong-attribution` 9/10, `ghi-plan` 3/10, `ghi-implement` 2/10; 6 chốt an toàn 10/10 (`plans/20261026-vibe-pipeline-summary.txt`). Break signal D-02: báo Bro, không tự thêm câu.

## Outcome
Có số đo sau sửa trên cùng runner, so với 10 lượt gốc theo ngưỡng D-04, cùng 6 chốt an toàn; tổng chi phí gói ước lượng theo D-03 (dòng `cost $` của run.sh cộng dự phòng $1 cho giám khảo) ≤ $25.

## Scope
- In: D-03, chấm bằng `summarize.mjs` (một lần, lưu output) và `pipeline.mjs --compare`.
- Out: sửa vibe thêm (không đạt → báo Bro); đổi runner; đo nhánh > 2 file (giới hạn S9).

## Coverage
- CP-03

## Ownership
- Create (artifact, không commit): `evals/results/vibe/sonnet-pipeline-pilot/`, `evals/results/vibe/sonnet-pipeline-n10/`; `plans/20261026-vibe-pipeline-*.{log,txt}`
- Read: `evals/vibe/an-toan-merge/run.sh`, `summarize.mjs`, `pipeline.mjs`

## Steps
1. `bash evals/vibe/an-toan-merge/run.sh --probe`.
2. Pilot `bash evals/vibe/an-toan-merge/run.sh --out sonnet-pipeline-pilot --runs 1 --budget 3`; xem `scan-staged-secrets.cjs` có chạy được trong phòng thử không; cộng chi phí probe và pilot từ dòng `cost $`; nếu đã tiêu + $1 dự phòng + pilot × 10 > $25 thì dừng hỏi Bro.
3. `bash evals/vibe/an-toan-merge/run.sh --out sonnet-pipeline-n10 --runs 10 --budget <min(3, (25 − 1 − đã tiêu)/10)>` (nếu `--out` đã có thì đổi tên cũ thành `-r<n>`).
4. `node evals/vibe/an-toan-merge/summarize.mjs sonnet-pipeline-n10 > plans/20261026-vibe-pipeline-summary.txt` một lần.

## Acceptance
- AC-03: Command thoát 0; tổng chi phí ước lượng ≤ $25, cách tính ghi trong Receipt.

## Dependencies
- task-01-pipeline-counter.md
- task-02-vibe-shortcut-rule.md

## Verification Plan
- Command: `grep -q '^khong-gh-that=' plans/20261026-vibe-pipeline-summary.txt && ! grep -q '^problem:' plans/20261026-vibe-pipeline-summary.txt && node evals/vibe/an-toan-merge/pipeline.mjs --compare sonnet-n5,sonnet-n5-20261026 sonnet-pipeline-n10`
- Named probe: output đã lưu của `summarize.mjs` (6 chốt, không có `problem:`), `pipeline.mjs --compare` (D-04).
- Reachability: `run.sh` → `claude -p "/vibe --ship …"` trong repo cài CafeKit từ nguồn sau task-02.
- Oracle: summary không có dòng `problem:`; `--compare` in đạt từng ngưỡng và thoát 0.
- Counterexample: ca `--compare` dưới ngưỡng trong `pipeline.mjs --self-test` (task-01) phải thoát 1.
- Artifacts: `evals/results/vibe/sonnet-*pipeline*` (giữ, không xoá, không commit); `plans/20261026-vibe-pipeline-summary.txt`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. Một chốt an toàn thủng hay ngưỡng D-04 không đạt là số đo: `blocked`, báo Bro.

## Receipt
