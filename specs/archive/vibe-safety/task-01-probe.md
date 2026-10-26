# Task 01 — Probe: tên lệnh vibe của bản cài dự án, và eval harness có nạp `.claude/` của phòng thử không

Status: done

## Outcome
Có số đo thật (không đoán) cho bốn câu hỏi mà task-02 và task-05 dựa vào: bản cài dự án gõ lệnh vibe bằng tên gì, harness `claude plugin eval` có nạp `.claude/` (rule, hook SessionStart) của phòng thử không, biến môi trường `GH_CONFIG_DIR`/`GH_TOKEN` có tới được tiến trình con không, và skill trong plugin tạm có trùng tên với skill của bản cài không.

## Scope
- In: `evals/vibe/probe.sh` (D-00) và ca `evals/vibe/tham-do/` (haiku, 1 lượt); in kết quả dạng `key=value`.
- Out: sửa câu ngoại lệ (task-02); ca an toàn (task-05); mọi lệnh tốn tiền ngoài hai lượt haiku.

## Coverage
- CP-01, CP-03 (điều kiện vào)

## Ownership
- Create: `evals/vibe/probe.sh`, `evals/vibe/tham-do/case.yaml`, `evals/vibe/tham-do/scaffold.sh`, `evals/vibe/tham-do/graders/*.md`
- Modify (chỉ khi `case.yaml` không truyền được đường dẫn repo vào scaffold): `evals/run.sh` — export một biến `EVAL_CAFEKIT_ROOT`
- Read: `evals/run.sh:33-110`, `evals/git/merge-pr-ci/{case.yaml,scaffold.sh}`, `evals/lean/loaded.mjs:56`, `packages/spec/bin/install.js`

## Steps
1. `probe.sh` phần 1 (≈ $0.01): tạo dự án tạm dưới `${TMPDIR}`, `git init`, chạy `node <repo>/packages/spec/bin/install.js --platform claude --yes` với cwd là dự án tạm (không bao giờ cwd = repo), rồi `claude -p --model haiku --output-format stream-json --verbose "Trả lời đúng một chữ: ok"` trong dự án tạm với `GH_CONFIG_DIR=<thư mục rỗng>` và `GH_TOKEN=invalid`; đọc sự kiện `system/init`: in `project_command=<tên trong slash_commands khớp vibe>`, `project_skill=<tên trong skills khớp vibe>`, `sessionstart=<yes|no>` (có sự kiện hook SessionStart hoặc nội dung hook trong trace), `rules=<yes|no>` (`CLAUDE.md`/rule của cwd có trong context: dò `memory_paths` hoặc chuỗi đặc trưng của `state-sync.md`).
2. Ca `tham-do`: scaffold cài CafeKit như Step 1 vào phòng thử (đường dẫn repo lấy qua `EVAL_*` của `case.yaml` nếu harness hỗ trợ, không thì qua `evals/run.sh` — ghi cách nào dùng được); prompt yêu cầu chạy đúng một lệnh Bash `test -n "$GH_CONFIG_DIR" && test "$GH_TOKEN" = invalid && echo ENV_OK` rồi trả lời một chữ.
3. `probe.sh` phần 2 (≈ $0.01): `evals/run.sh vibe --plugin-name cf --out probe-<ngày>-r<n> --case tham-do --model haiku --runs 1 --threshold 0 --ablation none` với cùng hai biến môi trường; từ trace in `harness_skills=<danh sách tên khớp vibe>` (ví dụ `cf:vibe` từ plugin, `vibe` từ bản cài), `harness_sessionstart=<yes|no>`, `harness_rules=<yes|no>`, `env_passthrough=<yes|no>` (có `ENV_OK` trong kết quả công cụ), `harness_duplicate=<yes|no>` (vibe xuất hiện dưới hơn một tên). Không dùng lại regex `^[^:]+:vibe$` của `evals/lean/loaded.mjs:56` (không bắt tên trần `vibe`): bộ đếm riêng khớp cả `vibe` và `<plugin>:vibe`.
4. Thoát 0 khi in đủ mọi khoá với giá trị đọc được; thiếu khoá hay trace không đọc được thì thoát 1. Ghi kết quả vào `plans/` (log giữ ngoài `/private/tmp`).

## Acceptance
- AC-00: Command in đủ 9 khoá của Step 1 (4) và Step 3 (5), thoát 0; kết quả nêu rõ tên lệnh thật mà task-02 và task-05 dùng.

## Dependencies
- none

## Verification Plan
- Command: `bash evals/vibe/probe.sh`
- Named probe: `evals/vibe/probe.sh` + ca `evals/vibe/tham-do`.
- Reachability: `install.js` cài vào dự án tạm; `claude -p` và `evals/run.sh` là đường host thật.
- Oracle: 9 dòng `key=value`, không giá trị rỗng, thoát 0; nếu `harness_rules=no` hoặc `env_passthrough=no` thì đó là số đo (không phải lỗi) và task-05 đi theo Break signal của D-00 (`harness_rules=no`) hoặc D-04 (`env_passthrough=no`): `blocked`, quay lại GATE-SCOPE.
- Counterexample: trên bản sao tạm của `probe.sh` bỏ bước cài thì `project_command=` rỗng và script thoát 1.
- Artifacts: `evals/results/vibe/probe-*` (giữ, không xoá); log tóm tắt ở `plans/`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash evals/vibe/probe.sh
Exit: 0
Base: 0f1b868b2f77f0924bb18454b3545e1aa6ff64fa
Head: 342037ba2d94dd45f41b05564cc7e3343794a4b9d557537e5a1d1d344bec6c7d
```text
$ bash evals/vibe/probe.sh
project_command=vibe
project_skill=vibe
sessionstart=yes
rules=yes
harness_skills=cf:vibe
harness_sessionstart=no-hook-events
harness_rules=no
env_passthrough=no
harness_duplicate=no
log: plans/20261023-vibe-probe.log
exit=0
```
Kết quả lượt cuối: `evals/results/vibe/probe-20261023-r9` (`result.json`, `trace.jsonl`, `room.txt`); chi phí mỗi lượt ≈ $0.003 (harness) + một lượt `claude -p` haiku. Không chạy-trước-cho-đỏ vì Command tốn tiền. Phản ví dụ: bản sao dùng-một-lần `/private/tmp/claude-501/-Users-nghialuutrung-Desktop-cafekit/6f6d5ffe-c62e-41e8-85ff-509f9fd60e5e/scratchpad/probe-counter/probe-no-install.sh` (bỏ bước cài, log ra scratchpad) in `project_command=` rỗng, `rules=no`, `probe: thiếu khoá`, thoát 1 — cũng là đối chứng cho câu dò rule. Tách nguyên nhân (r7, r8, r9): `tool_result` của lệnh dò có dòng `INSTALL_OK` và mã thoát khác 0 của vế `GH_*` — agent thấy bản cài, `room.txt` có 21 skill ở `sealed/home/cwd/.claude/skills`, nhưng `init.skills` chỉ `cf:vibe`, câu dò `ABSENT`, 0 sự kiện hook → harness không nạp `.claude/` của phòng thử; vế `GH_*` thoát 1 → env bị lọc. Vòng sửa 1: harness lọc env của scaffold → `evals/run.sh` ghi `$work/evals/.cafekit-root` thay vì export `EVAL_CAFEKIT_ROOT` (lệch D-04 `EVAL_*`, đã ghi vào Review log của plan). Vòng sửa 2: thiếu `--keep-temp` nên trace bị xoá → thêm cờ, chép trace về thư mục kết quả. Vòng sửa 3 (review PASS_WITH_WARNINGS, 3 Medium): khoá `no-install` qua `INSTALL_OK`, `unverified` khi model tự gọi công cụ, rào `room_ok` cho chmod/rm, scaffold chỉ cài dưới thư mục tạm và ngoài repo, grader `co-ban-cai` (luôn sai vì đường dẫn phía grader) thay bằng `chay-lenh-do`. Review lần 2: code không còn finding ≥ Medium, M3 chỉ cần ghi lại (đã ghi); sau đó sửa thêm 2 Low (comment câu dò, regex `^INSTALL_OK$`) rồi chạy lại Command ở trên. Giới hạn: `harness_sessionstart=no-hook-events` nghĩa là trace harness không phát sự kiện hook nên chưa đo được hook có chạy; Low còn lại: `TMPDIR` có `/` cuối nên nhánh đó của `room_ok` không bao giờ khớp (an toàn), phòng `--keep-temp` bị bỏ lại khi `run.sh` thoát khác 0.
