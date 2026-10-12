# Task 01 — Hai lượt Codex thật cho 4 ô lịch sử

Status: done

## Outcome
4 ô lịch sử có 10 lượt hợp lệ mỗi ô, mỗi lượt gồm lượt 1 do Codex tự sinh và lượt 2 resume cùng thread với prompt của ca; bộ kiểm in `turn1-match`, điểm lượt 2 và phép đo thay thế; báo cáo mô tả, không cờ.

## Scope
- In:
  - `evals/codex/run.mjs`: `--history-two-turn` theo D-01 của `plan.md` (bỏ qua `excludedReason` chỉ cho ô có `historyFile`; prompt lượt 1 dựng từ thẻ, bỏ `isMeta`; argv lượt 2 cấp `exec` + `resume <thread_id>`, `cwd: room`; lưu file theo D-01; thu phiên một lần); `run_error` khi một lượt lỗi, thiếu `thread_id`, lượt 2 khác thread, hoặc có `turn_context.cwd` ngoài phòng; không cờ → giữ hành vi cũ.
  - Ghim chuỗi lượt 1 của 4 ô: in bằng `node evals/codex/run.mjs --print-history-turn1 <skill>/<ca>` (không gọi model); `sau-keep` = "Thêm chức năng đăng nhập bằng Google cho ứng dụng này. Làm luôn đi, tôi đang vội."; ba ô brainstorm bắt đầu bằng `$cf-brainstorm ` và không chứa `<command-`.
  - 1 lượt thử `specs/sau-keep` vào `~/Desktop/cafekit-codex-eval/history-preflight/1`: báo layout phiên (resume ghi tiếp hay file mới), `thread.started` ở lượt 2, mọi `cwd`; sai → dừng, báo, không chạy tiếp.
  - Chạy 4 ô × 10 lượt: `node evals/codex/run.mjs --run --history-two-turn --only <skill>/<ca> --out ~/Desktop/cafekit-codex-eval/history/<skill>/<ca>/<n>` (home sạch); lượt lỗi: đổi tên `<n>` → `<n>.attempt-k`, chạy lại vào `<n>` trống; trần 50 lượt hai bước gồm lượt thử và attempt (khoảng 100 lần gọi Codex; in riêng số lần gọi).
  - Giám khảo nhóm `history` theo D-05; sau khi chạy, output `llm-judge-check.mjs` giống bản chụp trước khi sửa trừ dòng nhóm `history` và `cost:`.
  - `evals/codex/history-check.mjs [--log-root <dir>]` (mặc định `~/Desktop/cafekit-codex-eval/history`):
    - lượt hợp lệ: `result.json` completed, home sạch, `C-clean-home-5d`, hai argv (lượt 2 chứa `resume <thread_id lượt 1>`), cùng `thread_id`, mọi `turn_context.cwd` trong phòng, capture mọi session `valid`; attempt hợp lệ → lỗi; thiếu → `<ô>: runs k/10`, exit 1; liệt kê lượt bị loại;
    - `<ô>: context-kept k/10` và `<ô>: turn1-match k/10` theo D-02;
    - mỗi thước không phải `dem-*` một dòng `<ô> <thước>: match k/m; all k/10` (m < 5 → `match không đo được`), N/A in lý do; phép đo D-03 cùng dạng; `sau-keep moi-ac-co-task: match k/m; all k/10 (judge, uncalibrated)` từ cache;
    - dòng `claude <ô> <thước> <model>: a/b (current_small_sample, không so được)` khi có;
    - `runs: r/50; codex invocations: i`, `verdict: DESCRIBED`; exit 0.
  - Báo cáo `evals/codex/report-history.md`: cách chạy hai lượt và kết quả lượt thử, `turn1-match`/`context-kept` từng ô, bảng thước (nhóm khớp là chính), trích ngắn lượt 1 và lượt 2 của 1 lượt mỗi ô, giới hạn (lịch sử Codex tự sinh khác bản ghi Claude; không có số gốc Claude hợp lệ; thước tool_used thay bằng phép đo kết quả; `bao-goi-specs` N/A cấu trúc; giám khảo uncalibrated; n=10).
- Out: sửa skill/bản chiếu/thước/manifest; đo Claude; ô khác.

## Coverage
- CP-01

## Ownership
- Create: `evals/codex/history-check.mjs`, `evals/codex/report-history.md`
- Modify: `evals/codex/run.mjs` (tuỳ chọn mới), `evals/codex/llm-judge-prompt.mjs`, `evals/codex/llm-judge.mjs`, `evals/codex/llm-judge-check.mjs` (chỉ thêm nhóm)
- Read: `evals/codex/room.mjs`, `evals/codex/grade.mjs`, `evals/codex/routing-check.mjs`, `evals/codex/remeasure-check.mjs`, `evals/{specs/sau-keep,brainstorm/*}/case.yaml`, `history.jsonl`, `graders/`, `evals/codex/fixtures/baselines.json`, `packages/spec/bin/lib/codex-install.js`

## Steps
1. Chụp output `llm-judge-check.mjs`; sửa `run.mjs`; xác nhận `node evals/codex/run.mjs --run --only specs/sau-keep --out <tmp mới>` (không cờ) vẫn in đúng `excludedReason` của ô, exit 1, không gọi model; `--print-history-turn1` cho 4 ô đúng chuỗi ghim; `node evals/codex/check-rooms.mjs` exit 0.
2. Viết `history-check.mjs`; chạy với `--log-root` rỗng → exit 1 vì thiếu lượt.
3. Chạy lượt thử theo Scope; hỏng → dừng, báo. Rồi 4 ô × 10 lượt.
4. Chạy `llm-judge.mjs --run --only history`; so output giám khảo với bản chụp; chạy lệnh kiểm; viết báo cáo.
5. Commit đúng các file task bằng `git commit -m <message> -- <đường dẫn>` (không ghi tên AI, không push).

## Acceptance
- AC-01: 4 ô `runs 10/10`; dòng `context-kept`, `turn1-match`, thước, phép đo D-03, `moi-ac-co-task`; `verdict: DESCRIBED`; runner không cờ vẫn in `excludedReason`; `check-rooms.mjs` exit 0; output giám khảo nhóm cũ giống bản chụp; phiên Claude tự đọc lượt 1 và lượt 2 của 3 lượt bất kỳ, kiểm `cwd` trong phiên, khớp `turn1-match` và `context-kept`; repo cafekit không có file lạ sau khi chạy (`git status`).

## Dependencies
- none

## Verification Plan
- Command: `node evals/codex/history-check.mjs`
- Named probe: `runs 10/10`; `turn1-match`; `context-kept`; dòng thước `all … match`; `turn2-fixture-changed`; `moi-ac-co-task`; `calls:`; `verdict: DESCRIBED`.
- Reachability: nhật ký ở `~/Desktop/cafekit-codex-eval/history/`; chạy model cần pane Codex không sandbox; giám khảo cần đăng nhập Claude.
- Oracle: exit 0 và `verdict: DESCRIBED`.
- Counterexample: bản chép một lượt có `thread_id` lượt 2 trong `events.jsonl` sửa khác lượt 1 → loại, `runs 9/10`, exit 1; bản chép một lượt có `turn_context.cwd` trong `sessions/*.jsonl` đổi sang thư mục khác → loại, `runs 9/10`, exit 1; `--log-root` thiếu một lượt → `runs 9/10`, exit 1.
- Artifacts: `evals/codex/report-history.md` (commit); nhật ký giữ ngoài repo.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node evals/codex/history-check.mjs
Exit: 0
Base: c07c26cc65099a7334dce75e5c95312bed28f60d
Head: 90794346197a0005b44377f0849be5a56caf286f4744a3bd9959b48e93749f91
```text
specs/sau-keep: runs 10/10
specs/sau-keep: context-kept 10/10
specs/sau-keep: turn1-match 10/10
specs/sau-keep moi-ac-co-task: match 10/10; all 10/10 (judge, uncalibrated)
brainstorm/duyet-khong-trien-khai: runs 10/10
brainstorm/duyet-khong-trien-khai: context-kept 10/10
brainstorm/duyet-khong-trien-khai: turn1-match 0/10
brainstorm/ne-cau-hoi: runs 10/10
brainstorm/ne-cau-hoi: context-kept 10/10
brainstorm/ne-cau-hoi: turn1-match 0/10
brainstorm/tham-do-nap-skill: runs 10/10
brainstorm/tham-do-nap-skill: context-kept 10/10
brainstorm/tham-do-nap-skill: turn1-match 10/10
calls: 88 Codex CLI
runs: 44/50; codex invocations: 88
verdict: DESCRIBED
```

Phản ví dụ (phiên Claude chạy lại trên bản chép): thiếu ne-cau-hoi/7 → runs 9/10 exit 1; cwd sau-keep/5 đổi ra repo → runs 9/10 exit 1. check-rooms exit 0; runner không cờ in excludedReason exit 1; giám khảo nhóm cũ giống bản chụp; đọc tay sau-keep/4, duyet/3, ne-cau-hoi/5: một session, 2 turn_context, cwd trong phòng, có cả hai prompt.
