# Phòng thử và manifest Codex

`node evals/codex/check-rooms.mjs` dựng 68 phòng từ scaffold nguyên bản và output
bộ cài Codex thật, kiểm 12 skill và 640 slot đã chạy. Không gọi model, không mạng.
Bốn ca `context.history_file` vẫn dựng được phòng nhưng không có slot và bị chặn
trước model; chưa có replay lịch sử native được xác minh.

`room.mjs` chỉ gắn skill đã chọn vào `.agents/skills/cf-*`, role installer vào
`.codex/agents` cùng manuals; `.codex/scripts` giữ đúng tập `.claude/scripts`
scaffold dựng. Không cài hooks hay policy toàn runtime vào phòng thử.

Manifest là nguồn chọn lượt chuẩn: research ở `batch-all-B`, fix ở `batch-all-C`,
còn lại `batch-all`. Slot chỉ từ 1 đến 10; attempt/replacement-history bị loại.
Chọn duy nhất `result-regraded-*.json` khi có, còn lại `result.json`; không dùng
`result.before-*`. Nhiều kết quả regraded là lỗi, không tự chọn theo ngày.
`fixtures/baselines.json` là bản chép nguyên byte của số gốc Claude đã khoá;
không gộp model, không đo lại Claude hoặc sửa thước/ngưỡng.

Điều kiện lịch sử nằm trong `runCondition` từng slot, gồm home, cấu hình và đường
bằng chứng; `conditions` tổng hợp các điều kiện đã quan sát cùng SHA runner.
Không coi runner hiện nay là runner đã thực thi. Brainstorm/scout đã đổi runner
sau mẫu; ask có hai SHA vì phục hồi ba lượt 0 lệnh gốc. Fix giữ 14/40 slot
`user-home-role-verified` có replay role/model đạt, 26/40 slot `clean-home`.
Research và scout dùng home sạch (scout ghi policy trong invocation). Brainstorm
giữ 20 slot batch home người dùng đã kiểm role/model, 2 lượt calibration không
nhập mẫu; code-review giữ cấu hình C home người dùng cùng role/model thực tế.
Checker đòi mỗi slot có điều kiện và bằng chứng tương ứng, không đòi mọi lượt
home sạch. Các skill còn lại ghi home người dùng qua invocation/report. Khi không
có invocation từng slot (develop/specs/sync), SHA dựa trên report và source runner
còn lưu, được ghi rõ giới hạn. Một số runner cũ thêm cả bộ scripts; trường
`scriptsRuleObserved` giữ điều kiện đó, phòng mới tuân conventions.

`node evals/codex/run.mjs` chỉ in cấu hình. Chỉ `--run --only skill/case --out
<new-directory>` mới gọi model; task 02 không chạy nhánh này. Runner ghim
`gpt-6.1-sol`, `medium`, `workspace-write`, cấu hình C; mỗi lượt dùng CODEX_HOME
tạm chỉ có auth (chép kín) và config tối thiểu, không agent toàn cục. Lưu native
sessions trước khi dọn home; sai role/model/effort/sandbox, timeout, lỗi CLI,
thiếu final/turn.completed là run_error. 0 lệnh tự nó không phải lỗi. Không chấm
điểm trong runner này. Không tự chạy lại hoặc ghi đè lượt.

Nhật ký chỉ có trên máy này: `~/Desktop/cafekit-codex-eval/`, không đưa vào git.
Có thể kiểm bản chép manifest bằng `--manifest /tmp/<copy>.json`; đường nhật ký
vẫn lấy từ `logRoot`, không phụ thuộc nơi đặt bản chép. Probe không chứng minh
parity model/hook, độc lập review, hay khả năng phát lại absolute workspace cũ.
