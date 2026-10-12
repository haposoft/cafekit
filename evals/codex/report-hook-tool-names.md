# Tên tool hook Codex và nâng cấp matcher

Matcher đã được đối chiếu với một lượt Codex thật và installer đã cập nhật được nhóm dùng matcher template cũ, đồng thời giữ nhóm tùy chỉnh hoặc trộn handler người dùng. Việc xác minh này giới hạn ở cấu hình và việc hook được gọi; không xác nhận state tracking end-to-end.

## Lượt dò

- CLI: `codex-cli 0.162.1`; model `gpt-6.1-sol`, reasoning `medium`, sandbox `workspace-write`.
- Một lần gọi, exit 0. Phòng ngoài repo; CODEX_HOME tạm chỉ nhận bản chép `auth.json` và config tối thiểu, không có agents toàn cục trong home đó. Home tạm đã xóa; không sửa home thật hay thư mục skills toàn cục.
- Cờ có `--enable multi_agent`, project trust `trusted`, `--dangerously-bypass-hook-trust`. Hook ghi vết ở trong phòng, matcher `*` cho cả PreToolUse và PostToolUse.
- Prompt yêu cầu `update_plan`, `ls`, đọc `sample.txt`, sửa bằng `apply_patch`, tạo một agent con đọc file và chờ kết quả. File đổi từ `before` thành `after`; agent con xác nhận `after`.
- Log: `~/Desktop/cafekit-codex-eval/hook-tool-names/1/`: `version.txt`, `invocation.json`, `trace.jsonl`, `events.jsonl`, `stderr.txt`, `last.txt`, `sessions/`, `sample-after.txt`. Không lưu auth vào thư mục log. Hook chỉ ghi event, tên tool và kiểu command khi gặp alias shell; không ghi input, nội dung file hay giá trị bí mật.

| tool_name | PreToolUse | PostToolUse |
|---|---:|---:|
| Bash | 3 | 3 |
| apply_patch | 1 | 1 |
| collaborationspawn_agent | 1 | 1 |
| collaborationwait_agent | 1 | 1 |

Thứ tự trong trace: Pre/Post Bash, Pre/Post Bash, Pre/Post apply_patch, Pre/Post collaborationspawn_agent, Pre collaborationwait_agent, Pre/Post Bash của agent con, Post collaborationwait_agent.

`update_plan` không có trong phiên dò: `[UNVERIFIED]`. Lời gọi tạo agent con được quan sát với tên `collaborationspawn_agent`; tên literal `Agent` và `spawn_agent` không xuất hiện trong hook trace, giữ dự phòng theo tên tài liệu: `[UNVERIFIED]`. Không thấy `Read`, `Glob`, `Grep`, `Edit`, `Write`, `MultiEdit`, `TodoWrite`, `task`, `Task`.

Khi tool_name là `shell`/`exec_command`, tool_input.command là chuỗi hay mảng argv: **không quan sát được**. Hai alias vẫn được giữ cho phiên bản cũ.

## Matcher mới

| Nhóm | Matcher |
|---|---|
| PreToolUse privacy/inspect | `Bash\|exec_command\|shell\|apply_patch\|mcp__.*\|collaborationspawn_agent\|collaborationwait_agent` |
| PreToolUse ask-guard | `apply_patch` |
| PostToolUse state | `collaborationspawn_agent\|Agent\|spawn_agent\|update_plan` |
| PostToolUse spec-state | `apply_patch` |

Các matcher lifecycle khác giữ nguyên. `Agent`, `spawn_agent`, `update_plan` ở nhóm state là dự phòng chưa xác minh, không phải tên đã đo được. `state.cjs` hiện bỏ qua `collaborationspawn_agent`; sửa logic state nằm ngoài phạm vi lần này.

## Nâng cấp và kiểm chứng

Tập matcher cũ lấy từ lịch sử `git log -p -- packages/spec/src/codex/hooks.json`: inspection có hai mẫu (bản đầu và bản thêm exec_command/shell); state có `Agent|spawn_agent|update_plan|task|Task|TodoWrite`; spec-state có `apply_patch|Edit|Write|MultiEdit`.

Sau prune hook nghỉ hưu và repair launcher, installer chỉ đổi matcher cũ đã biết khi mọi handler thuộc CafeKit và xác định duy nhất một nhóm template. Nhóm trộn người dùng, matcher tùy chỉnh hoặc handler thuộc hai template giữ nguyên và có cảnh báo. Dry-run chỉ báo, không ghi. Nhánh cập nhật in `↻ … matcher updated`, không in `already registered`.

- Command trước thêm test: 57 tests, 57 pass, 0 fail, exit 0.
- Năm test mới trên code cũ: 62 tests, 58 pass, 4 fail, exit 1; cả ca cập nhật matcher và ca dọn hook nghỉ hưu đều đỏ.
- Command sau sửa: 62 tests, 62 pass, 0 fail, exit 0; gồm ownership và native-hook-boundaries.
- `pnpm test` ở gốc repo: lần chạy mới sau khi nối lại kết nối exit 0, `PASS: 1644 tests executed` (package Node 617/617, hook behavioral 199/199, chrome-devtools 42/42). Lần trước exit 1 ở chrome-devtools/performance.js vì mã thoát tiến trình con là `null` sau thời gian chờ kéo dài; không sửa hay bỏ test để chạy lại.
- Cài thử: tạo phòng tạm, `git init`, chạy `node /Users/nghialuutrung/Desktop/cafekit/packages/spec/bin/install.js --platform codex -y` từ phòng đó, exit 0. Matcher sinh ra ở mọi event khớp template. Không cài vào repo.
- Phản ví dụ ngoài repo: tắt nhánh refresh matcher làm test cập nhật matcher đỏ do thiếu thông báo cập nhật, exit 1; hoàn tác làm cùng test pass, exit 0. Không sửa bản thật.

## Giới hạn

Một lượt dò trên một phiên bản CLI, nhật ký chỉ ở máy này. Tool hosted không được xác minh qua hook. Home sạch không tự ẩn skills toàn cục ở `~/.agents/skills`; không đo tác động của chúng. Các tên dự phòng không được trình bày là bằng chứng quan sát. Không đổi logic state, spec-state hay privacy-block.
