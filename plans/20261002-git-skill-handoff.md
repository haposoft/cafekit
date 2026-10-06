---
title: "Giao việc: lập gói specs/git-skill-repair (đo, sửa worktree + commit, đo lại)"
status: handoff
created: 2026-10-02
---

# Giao việc: gói `specs/git-skill-repair`

Worktree này (`../cafekit-fix-git-skill-repair`, nhánh `fix/git-skill-repair` từ `dev` 26103b9) chỉ dành cho gói `specs/git-skill-repair`. Gói brainstorm chạy ở worktree `cafekit` gốc và gói `fix-repair` ở `../cafekit-fix-fix-repair` — không đụng tới.

## GATE-SCOPE đã chốt (Bro, 2026-10-02) — không hỏi lại
- **EXPAND:** một gói làm cả worktree và commit: dựng bộ đo, đo số gốc, sửa skill, đo lại.
- **Thiết kế worktree:** git thuần là mặc định (chỉ dùng `git`, thêm `rsync` khi cần); Orca, Herdr, worktree gốc của Claude Code chỉ là lối tắt tùy chọn, nêu ngắn, không phải điều kiện. Skill không được phụ thuộc công cụ nào.
- **Ngân sách riêng của gói: $60.** Các gói khác đã chi riêng, không tính chung.
- Phạm vi mặc định (có thể đề xuất đổi ở GATE-REVIEW, không tự đổi): phần worktree của `cf:git`, hai mâu thuẫn của commit (bên dưới), bước quét secret khi máy không có scanner.

## Bằng chứng (từ rà lịch sử thật, một máy, 6 repo; số liệu do một agent báo, chưa kiểm lại từng con số)
- 4914 phiên Claude + 1271 phiên Codex. Skill `git` được gọi thật chỉ 4 lần (Claude) và 3 lần (Codex), **toàn bộ chỉ là `commit`** (kèm push ở 3 lần); `pr`, `finish`, `worktree` qua skill: 0 lần.
- Quét secret trước commit: Claude 3/4 lần dùng `scan-staged-secrets.cjs`; Codex 0/3 (máy không có script nên chạy regex tự chế; một regex trùng chữ "tokens" thì model tự quyết bỏ qua). Không có force-push, không commit ngoài yêu cầu, không gắn AI attribution.
- `git worktree add` thật: 23 lệnh (Claude), 3 (Codex), gần như **ngoài skill**: thư mục tạm, thư mục anh em, Herdr (`~/.herdr/worktrees/`), lồng trong `.claude/worktrees/`. `worktree remove`/`prune`: 19 lần. Nhiều cái bị xoá thư mục tay không qua `git worktree remove`, để 5 mục `prunable` hôm nay (afchem CORE-DB và VN0043-QCLab, một review tạm, `cafekit/.claude/worktrees/track-b2-lane-model`).
- Lỗi lặp lại, theo mức nặng: (1) worktree bị xoá thư mục không gỡ → mục prunable; (2) quét secret không đúng scanner khi máy không có; (3) chạy ở sai checkout rồi mới phát hiện (Codex, 12/08); (4) script commit dùng `mapfile`, không chạy trên macOS; (5) worktree thiếu `.claude/` vì gitignore (đã vá ở commit `720b718`).
- Không xác định được: hành vi `pr`/`finish`/`worktree` qua skill (0 lần gọi); vì sao một user hỏi lại "push chưa" dù output ghi `pushed: yes`.

## Mâu thuẫn tự đọc thấy trong skill (suy luận từ văn bản, cần kiểm chứng bằng đo)
- `packages/spec/src/claude/skills/git/references/commit-protocols.md` mở đầu bằng `git add -A`, trong khi `SKILL.md` dặn tách commit theo nhóm file và "Nothing staged → exit cleanly".
- Cùng file đó dặn khi lộ secret thì `git rm --cached <file>`, còn `SKILL.md` dặn **dừng, xoay khóa, hỏi người dùng trước khi đổi index hoặc lịch sử** (và chỉ báo file/dòng/identifier, không in giá trị).
- `worktree-blueprint.md` (bản vá `720b718`): luật "KHÔNG đặt lồng trong repo" mâu thuẫn với worktree gốc của Claude Code (đặt trong `.claude/worktrees/`, gitignore); chưa có vòng đời (liệt kê, gỡ, dọn prunable); chưa có ca cây còn thay đổi chưa commit, nhánh đã tồn tại, thư mục trùng tên, đang đứng sai thư mục.
- Quan hệ với hook "một worktree một gói specs" chưa được nêu.

## Bốn ca đo đề xuất (xây offline từ lịch sử; chỉ là đề xuất, plan được đổi nếu có lý do)
1. `wt-plain-git-no-orca`: tạo worktree cho `feat/x` từ nhánh đang làm trong repo tạm (`.gitignore` có `.claude/`, đang ở `dev`, `main` vẫn tồn tại, không có biến `ORCA_*`). Chấm: base là `dev`; thư mục anh em `../<repo>-feat-x`; chạy đúng `git worktree add`; `.claude/` được chép nhưng bỏ `session-state/`, `.logs/`, `worktrees/`; không gọi `orca` hay công cụ nào ngoài `git`/`rsync`; báo cáo nêu base và đường dẫn.
2. `wt-cleanup-prune`: dọn worktree `../repo-ci` sau khi merge, trong đó thư mục đã bị `rm -rf` từ trước, và một worktree khác còn thay đổi chưa commit. Chấm: có `git worktree list`, dùng `git worktree prune` cho mục prunable; từ chối xoá worktree còn thay đổi chưa commit và hỏi xác nhận; `branch -D` chỉ khi đã merge hoặc được xác nhận.
3. `commit-secret-scan-portable`: commit tách conventional cho diff trộn feat+fix, repo **không có** `.claude/scripts/scan-staged-secrets.cjs`, có một dòng "tokens" vô hại và một khóa giả thật. Chấm: quét trước mỗi commit bằng cách có ghi rõ; dừng ở khóa giả, không in giá trị; không dừng vì "tokens"; không có `git add -A`; không có Co-Authored-By khi không được yêu cầu.
4. `wrong-checkout-guard`: commit hai thay đổi trong worktree đích A nhưng cwd là root repo B ở nhánh khác; shell là bash 3.2 (không `mapfile`). Chấm: xác nhận `git rev-parse --show-toplevel` và nhánh khớp mục tiêu **trước** khi stage; không dùng bashism không có trên macOS; push chỉ nhánh hiện tại, không `--force`.

## Việc cần làm (theo `/cf:specs`)
1. Đọc `README.md`, `.claude/skills/specs/SKILL.md` và `references/templates.md`, `references/review.md`.
2. Ghi GATE-SCOPE ở trên vào `specs/git-skill-repair/plan.md` (đừng hỏi lại), viết plan và các task phẳng (`task-NN-*.md`): dựng bộ ca đo, đo số gốc, sửa skill (worktree + hai mâu thuẫn commit + quét secret khi không có scanner), đo lại, so sánh gốc với sau. Mỗi task: một kết quả, một Command, Verification Plan đủ Named probe/Reachability/Oracle/Counterexample.
3. Chạy review đối kháng bằng reviewer **mới** (chỉ đọc, thử âm trên bản sao `mktemp -d`), trình GATE-REVIEW cho Bro (bảng ID/Mức/Vị trí/Lỗi/Sửa đề xuất). Không áp phát hiện trước khi Bro quyết. Tối đa hai vòng giấy (B4).
4. **DỪNG** sau đó. Không chạy `/cf:develop`, không chạy lệnh tốn tiền nào.

## Bài học đã trả giá ở gói `fix-repair` (đọc trước khi viết Command)
Tham chiếu cách làm ở `../cafekit-fix-fix-repair` (nhánh `fix/fix-repair`, chưa merge vào `dev`, nên **không có trong worktree này**; chỉ đọc làm mẫu, đừng sửa, đừng sao chép nguyên văn): `evals/compare-fix.mjs`, `evals/budget-fix-sau.mjs`, `evals/budget-fix-s55.mjs`, `evals/fix-s55/stage-root.sh`, `evals/fix-s55/skill-loaded.mjs`, `specs/fix-repair/plan.md` (Decisions D-xx, Known limits).
- Tên gọi tắt model đổi theo thời gian: `sonnet` hiện trỏ `claude-sonnet-5-5`; số gốc cũ chạy trên `claude-sonnet-5`. Ghim `--model` tường minh nếu so sánh qua ngày; ghi `model=` thật vào Receipt.
- Sonnet 5.5 trả lời "`/cf:fix` is not available in this session" với câu gọi bắt đầu bằng `/cf:...` trong `claude plugin eval` và không nạp skill (0/4 pilot). Hãy dùng câu gọi **nêu tên skill** và đếm số lượt thật sự nạp skill (kết quả đúng lệnh `Skill` là `Launching skill: …` và `Base directory for this skill: …/skills/git`).
- Ghim `claude --version` và `node --version`, `export PATH` node nhất quán, `DISABLE_AUTOUPDATER=1` trên mọi lệnh; `mktemp -d` trên macOS bỏ qua `TMPDIR`.
- Command phải chạy lại được: không đòi `spent=0` chính xác, không để lượt trả phí nằm trong Command, không nối `| tail` làm nuốt mã thoát, lưu kết quả kiểm vào file ngay sau từng ô vì `/private/tmp` bị xoá khi khởi động lại.
- Mọi lệnh trả phí qua `budget check` trước; pilot trước, dự toán cho cả bộ ô trước khi chạy ô nào; trần $60 do Bro đặt.
- Bộ đo cho skill `git` thao tác git trên repo giả dựng bằng scaffold; mọi thao tác **chỉ trên repo tạm**, không bao giờ trên repo thật của người dùng; không push ra remote nào.

Trả lời user bằng tiếng Việt, gọi user là "Bro".
