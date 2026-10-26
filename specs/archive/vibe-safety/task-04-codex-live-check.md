# Task 04 — Live check Codex 3×3 lượt: có chính sách thì không tự chọn vibe, đối chứng thì chọn, gọi tên thì chọn

Status: done

## Outcome
Có bằng chứng chạy thật trên codex-cli máy này rằng file của task-03 làm Codex thôi tự nạp `cf-vibe`, kèm lượt đối chứng chứng minh prompt đủ mạnh để Codex tự nạp khi không có chính sách.

## Scope
- In: `packages/spec/scripts/codex-implicit-invocation-check.sh` theo D-03.
- Out: đo nhiều lượt; omp; sửa cấu hình trust toàn cục.

## Coverage
- CP-02

## Ownership
- Create: `packages/spec/scripts/codex-implicit-invocation-check.sh`
- Read: `packages/spec/scripts/agent-privacy-live-check.sh:11-13`, `evals/codex/run.mjs:91-93,176-190`, `packages/spec/src/claude/skills/vibe/SKILL.md`

## Steps
1. Script: dự án tạm dưới `${TMPDIR}`, `git init`, cài `--platform codex --yes`; `CODEX_HOME` tạm sạch có trust cho đúng dự án tạm và chép thông tin đăng nhập theo mẫu `evals/codex/run.mjs`, không bao giờ sửa `~/.codex`; mọi lượt `codex exec --json -s read-only` với `GH_CONFIG_DIR=<thư mục rỗng>` và `GH_TOKEN=invalid`.
2. Ba loại, mỗi loại 3 lượt: (a) implicit có file — prompt nêu nhu cầu khớp mô tả vibe mà không nêu tên skill; (b) đối chứng — cùng prompt, dự án tạm thứ hai đã xoá `agents/openai.yaml`; (c) explicit — `$cf-vibe` + cùng nhu cầu, có file.
3. Chấm theo D-03: "chọn" = dòng `SKILL` của câu trả lời cuối nêu vibe, hoặc có lệnh của pipeline; "đọc" chỉ ghi chẩn đoán; in `implicit=k/3 control=k/3 explicit=k/3` và số lượt đọc; giữ stream sự kiện và câu trả lời trong `plans/`.
4. Thoát 0 khi implicit 0/3, explicit 3/3, đối chứng ≥ 2/3; đối chứng < 2/3 hay lượt lỗi → `INCONCLUSIVE`, thoát 2; còn lại thoát 1. Dọn thư mục tạm khi thoát.

## Acceptance
- AC-03: Command in `implicit=0/3`, `explicit=3/3`, `control` ≥ 2/3 và thoát 0.

## Dependencies
- task-03-codex-policy.md

## Verification Plan
- Command: `bash packages/spec/scripts/codex-implicit-invocation-check.sh`
- Named probe: `codex-implicit-invocation-check.sh`.
- Reachability: `codex` 0.164.0 trên PATH; installer thật từ task-03.
- Oracle: dòng `implicit=0/3 control=k/3 explicit=3/3` với k ≥ 2, thoát 0.
- Counterexample: loại (b) chính là phản ví dụ — cùng prompt không có file mà ít hơn 2/3 lượt chọn vibe thì kết quả không được tính (thoát 2).
- Artifacts: rollout tạm bị xoá; dòng kết quả ghi vào `plans/`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user. `INCONCLUSIVE` không phải repair round: sửa prompt cho đối chứng nạp được rồi chạy lại cả ba lượt.

## Receipt

Verification: PASS
Command: bash packages/spec/scripts/codex-implicit-invocation-check.sh
Exit: 0
Base: 0f1b868b2f77f0924bb18454b3545e1aa6ff64fa
Head: 127410ed584abc33e3d0844db870499ecce26d08e5aeeb434345095073dab031
```text
$ bash packages/spec/scripts/codex-implicit-invocation-check.sh
implicit=0/3 control=3/3 explicit=3/3 (read: implicit=2/3 control=3/3 explicit=3/3)
log: plans/20261023-codex-implicit-check.log (evidence: plans/20261023-codex-implicit-evidence)
exit=0
```
Chạy trên codex-cli 0.164.0, model gpt-6.1-sol (ghi trong log); mỗi lượt một `CODEX_HOME` tạm chỉ trust dự án tạm, `-s read-only`, `GH_CONFIG_DIR` rỗng, `GH_TOKEN=invalid`. Từng lượt: implicit 1–3 chọn `cf-ask` (đọc thân vibe ở lượt 1 và 3), control 1–3 và explicit 1–3 chọn `cf-vibe`; không lượt nào chạy lệnh pipeline. Đối chứng (loại control, cùng prompt, không có `openai.yaml`) chọn vibe 3/3, nên `implicit=0/3` không phải do prompt yếu. Lịch sử: lần 1 theo cách chấm cũ ra no/yes/yes; review lần 1 (Medium: chuỗi đánh dấu nằm cuối thân, đọc một phần sẽ lọt) → thêm tín hiệu lệnh đọc file và nới dòng SKILL; lần 2, 3 ra `implicit=yes` vì model `cat` thân vibe sau khi catalog in chẩn đoán `explicit_only (vibe)`, rồi vẫn chọn `cf-ask` và chỉ người dùng gọi `$cf-vibe` (bằng chứng `plans/20261023-codex-implicit-evidence-r3/`) → task `blocked`, Bro chọn chấm theo hành vi, 3 lượt mỗi loại (ghi ở plan); lần 4 đạt (`plans/20261023-codex-implicit-evidence-r4/`); review lần 2 (Medium: regex trên JSON thô bỏ sót lệnh có nháy đơn và `git -C`) → `pipeline_command` đọc `item.command` qua `JSON.parse`, thử đúng trên 8 dạng lệnh mẫu, neo dòng SKILL, xoá bằng chứng cũ cùng ngày; lần 5 (ở trên) đạt; review lần 3: PASS (reviewer chạy lại `pipeline_command` trên 12 file bằng chứng thật). Giới hạn: Codex vẫn có thể mở thân skill như tài liệu (2/3 lượt implicit) — chính sách gỡ skill khỏi danh sách chọn, không giấu file; 3 lượt mỗi loại là smoke (0/3 → cận trên 95% khoảng 63%); lệnh gọi `gh`/`git` bằng đường dẫn tuyệt đối và lỗi của node trong `pipeline_command` đều bị tính là không chọn; chỉ chặn vibe cấp user khi thư mục tên `vibe`; không có timeout; prompt cấm chạy gh/git nên tín hiệu thực tế chủ yếu là dòng SKILL; omp không đo.
