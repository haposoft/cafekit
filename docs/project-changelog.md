# Project Changelog

All notable changes to CafeKit are documented here, following
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
### Removed
- **Hai thư viện hook không ai dùng.** `hooks/lib/context.cjs` và `hooks/lib/detect.cjs` vẫn được cài nhưng không file nào require. Đã xoá khỏi nguồn và manifest; nâng cấp sẽ xoá hai file này khỏi `.claude/hooks/lib/` của bản cài cũ.

### Fixed
- **File hướng dẫn không còn nói ngược runtime hay ngược nhau (prompt audit).** `workflow` và `ai-dev-rules` thôi bắt kích hoạt skill trước mọi việc, vì câu đó ngược với luật chọn skill theo mức cần; `CLAUDE.md` và `AGENTS.md` gốc thêm một mục sau khối managed nêu lệnh test của repo và nói rõ `.claude/` là bản cài. Agent: `implementer` chỉ commit khi có phép và không ghi mã task, xử lý lỗi ở ranh giới thay vì bọc mọi lệnh, chỉ chia file khi có ranh giới thật; `docs-keeper` thôi chia doc theo số dòng; `git-ops` không tự kích hoạt sau khi sửa xong; `code-auditor` trỏ đúng quality gate của develop; `debugger` áp cùng điều kiện cho phép với `repomix --remote`; `spec-maker` và `implementer` kết bằng khối `DONE | CONCERNS | BLOCKED | NEEDS_INFO` mà `orchestrator` yêu cầu; `ui-ux-designer` bỏ các nguồn xu hướng mà extractor không có; chữ ép buộc (IMPORTANT, CRITICAL, MANDATORY, EXTREME SPEED) thành câu thường. Output style bỏ tiêu đề MANDATORY/FORBIDDEN, giới hạn số dòng, câu check-in tiếng Anh cố định và câu khen mẫu; luật comment chỉ áp cho code hiện trong chat; level mid không còn bảo làm thêm việc. Skill: `ui-ux-pro-max` được mô tả là kho tra cứu (dựng và review thuộc `cf:ui-ux`), bỏ domain `prompt` không tồn tại và "10 stacks", chạy `search.py` bằng `python3` thường, không mặc định dự án là React Native; `chrome-devtools` mô tả đúng script của nó (không đọc `.env`, `--no-compress true`, dùng chung một tab, script nào đọc `--timeout`, thư mục tmp để import chạy được, dừng tiến trình giữ cổng thay vì đổi cổng) và chỉ giữ một bản của câu từng lặp 11 lần; `code-review` bỏ object chứng thực Strict mà validator đã từ chối và đọc độ sâu từ coverage profile; `agent-browser` sửa `wait --url`; `web-testing` trỏ sang references thay vì chép lại.

## [0.18.0] - 2026-10-06
### Added
- **CI chạy bộ self-test** (`.github/workflows/test.yml`). Mỗi lần push vào `dev` hoặc `main` và mỗi pull request đều cài `@haposoft/cafekit` theo đúng lockfile đã commit (`--frozen-lockfile`) trên Ubuntu với Node 22, pnpm 10.28.0 và Python 3.12, rồi chạy `pnpm --filter @haposoft/cafekit test`. Không cài cây `cafekit-web`, và việc publish lên npm vẫn làm tay.
- **`cf:ui-ux`** — skill `ui-ux` của evondevKit (https://github.com/evondev/evondevKit, 0.3.13, commit `6465d4c`, MIT) được chép vào `skills/ui-ux/` giữ nguyên từng byte, trừ frontmatter theo chuẩn CafeKit và một dòng trong thân (`"$1"` của `count_files` → `"$*"`, vì Claude Code thay `$0`–`$9` trong thân skill bằng đối số gọi), kèm `LICENSE` và `scripts/package.json` để `--with-skills-deps` cài Playwright và tải Chromium cho `probe.mjs` (cài mặc định `--yes` không tải gì). Quy trình kiểu designer (brief → 2–3 wireframe → chọn → dựng) cho màn trong app, cùng các lối soi UI, dựng lại giữ brand, refactor, dựng design system trước và làm logo. Giữ nguyên như upstream: thân skill tiếng Việt; `probe.mjs` bấm popup, nút mở và chạm chữ bị cắt trên trang nó đo, tìm Playwright theo `--pw`, rồi thư mục đang đứng, rồi thư mục của nó (dự án có Playwright riêng nên truyền `--pw .claude/skills/ui-ux/scripts`), và rơi về Chrome hệ thống; skill bảo model gắn ảnh mẫu Unsplash/randomuser và chạy nền `http.server` — luật quản lý tiến trình và phạm vi của CafeKit vẫn áp dụng; `scripts/lint-skill.mjs` được ship nhưng không dùng. `bin/__tests__/ui-ux-skill.test.js` ghim tên, license, việc không còn `$<số>`, manifest Playwright và bản đã cài; một lần cài thật với `--with-skills-deps` đã đo trang kanban mẫu của skill ở 375 và 1440 px.
### Changed
- `when_to_use` của `cf:ui-ux-pro-max` giờ chỉ nói việc tra cứu (bảng màu, font, style theo loại sản phẩm, luật UX) và chỉ việc dựng màn sang `cf:ui-ux`.
- **Tài liệu thôi hứa adapter legacy cho `spec.json` (`legacy-hooks-docs`).** Sau `remove-legacy-hooks`, mục tương thích legacy bị xoá khỏi `CLAUDE.md` của Claude, `AGENTS.md` của Codex, các rule `workflow`, `state-sync` và `manage-docs`, các skill `cf:specs`, `cf:sync`, `cf:develop` và `cf:code-review`, và agent `project-manager` (`deployer` bỏ đường deploy legacy); description của `cf:sync` và `cf:develop` bỏ vế legacy. Hai README, `docs/specs-usage-guide.md` và website bỏ cùng lời hứa đó, và trang Claude của website thôi liệt kê `docs-sync.cjs` ở SessionStart. Export `resolvePersistedSpec` không ai dùng bị gỡ khỏi `spec-utils.cjs` của Codex. Agent `implementer`, `inspector`, `code-auditor`, `docs-keeper` và `deployer` thôi mô tả gói `spec.json` legacy, `scope_lock` hay `Related Files`. `docs/installer-architecture.md` giờ mô tả một Stop gate chặn closeout của gói legacy schema `2.1`, validator từ chối Strict, và bộ hook của omp và grok không còn các hook đã gỡ. Cài lại để làm mới bản đã cài.
- **Hook bớt ồn, chỉ Claude (`quiet-claude-hooks`).** `spec-state.cjs` giờ chỉ báo một gói cho phiên Claude đã chạm nó — câu gõ có `specs/<gói>`, token `/cf:<lệnh> <gói>` hoặc tên gói có gạch nối/chữ số, payload nêu tên gói, hoặc phiên Edit/Write/MultiEdit một file trong gói (ghi lặng lẽ qua đăng ký PostToolUse `Edit|Write|MultiEdit` mới, so bằng đường dẫn thật) — nên gói của phiên khác không còn hiện ở mỗi lượt gửi tin. `docs-sync.cjs` không chạy lúc mở phiên Claude nữa; skill `docs` tự chạy `echo '{}' | node .claude/hooks/docs-sync.cjs` khi cần tín hiệu docs lệch, và khi nâng cấp dòng SessionStart cũ bị gỡ. `state.cjs` bỏ khối "Prior Execution Context" lúc mở phiên khi khối đó chỉ có tiêu đề, dòng giữ chỗ và kết quả agent chỉ có giờ. Chỉ Claude: omp, Codex và grok (gửi `sessionId`) giữ hành vi cũ, và test đối chiếu omp ghi rõ hai điểm lệch có chủ đích.
- **Mô tả của `cf:specs` đưa việc rõ ràng nhưng rủi ro vào lập kế hoạch (`specs-routing-repair`).** Một câu mới nói việc có rủi ro auth, dữ liệu hay tiền phải vào Specs trước, kể cả khi yêu cầu rõ, gấp hay bảo làm luôn, và model không tự triển khai; các câu định tuyến khác được rút gọn cho vừa (1018/1024 ký tự), mệnh đề skip bị ghim giữ nguyên. Bộ eval specs nhìn thấy việc ghi file: `khong-code` chỉ đọc câu trả lời cuối, nên `dung-o-c1`, `export-csv`, `mo-ho-c1`, `mo-ho-du-cua` thêm `khong-sua-code`/`khong-viet-code` (không Edit hay Write trong `src/`), được chấm lại trên trace đã lưu bằng `evals/specs/check-write-graders.mjs`; ca âm mới `sua-nho-lam-luon` kiểm rằng sửa README rõ ràng kèm "làm luôn" vẫn được làm thẳng. Số gốc trên claude 2.1.289: sonnet gọi Specs 13/20 lượt ở mỗi ca build, số còn lại tự ghi `src/`; opus 10/10.
- **Văn của `cf:brainstorm` được nối thành dòng dài (`lean-brainstorm`).** Skill vốn đã viết theo ràng buộc và tiêu chuẩn đầu ra, nên chỉ nối các dòng bị ngắt tay: 221 → 121 dòng, chuỗi từ và cấu trúc khối giữ nguyên, gate và frontmatter giống từng byte, `references/question-framework.md` không đổi (không có dòng ngắt tay). 21 câu ghim đột biến trong test Codex và package-inventory có chứa xuống dòng được đổi khoảng trắng, ba history phát lại được dựng lại. Đo xác nhận trên ca history `ne-cau-hoi` (claude 2.1.289, sonnet và opus, 5 lượt mỗi bên): số đạt của mọi thước giống hệt trước và sau, ca thăm dò vẫn trích đúng dòng HARD-GATE. Chi $2.47.
- **`cf:ask` viết theo mục tiêu, ràng buộc và tiêu chuẩn đầu ra (`lean-ask`).** Bỏ workflow 4 bước và các ví dụ; mọi luật trong đó thành một dòng tiêu chuẩn (câu hỏi mơ hồ, thứ tự bằng chứng, khi nào dùng web, khi nào trả lời hay hỏi lại), gate chỉ-trả-lời và output contract giữ nguyên, thêm một dòng để câu hỏi không nêu khía cạnh hay đối tượng ("Hệ thống này có ổn định không?") được hỏi lại trước khi tra cứu. 171 → 104 dòng. Đo bằng `claude plugin eval` trên claude 2.1.289, 5 ca ask × sonnet, opus × 10 lượt mỗi bên: bản gọn đầu tiên thôi hỏi lại ở câu hỏi mơ hồ (10/10 → 0/10; ví dụ Ask Back bị bỏ vốn đang dạy hành vi này), dòng thêm vào khôi phục 10/10 ở cả hai model, không thước an toàn nào đổi; ba cờ còn lại là do thước. Công cụ `evals/lean/` nay so được ô ask với thước suy ra `joint` và tính ngân sách theo từng gói. Chi $29.44.
- **`cf:fix` và `cf:debug` viết theo mục tiêu, ràng buộc và tiêu chuẩn đầu ra (`lean-fix-debug`).** Bỏ sơ đồ mermaid, sáu mục `## Step`, các dòng `✓ Step` và mọi chữ `Step N`; điều mỗi bước đòi hỏi nay là một dòng tiêu chuẩn trong `## Standards`, mọi gate giữ đủ luật (chỉ đổi số bước thành tên mục và gộp checklist scout thành một câu nêu đủ mục), mẫu báo cáo debug giữ nguyên, việc gọi `cf:debug`/`cf:scout` từ fix là trợ giúp tuỳ chọn chứ không bắt buộc. fix 299 → 153 dòng, debug 240 → 165. Đo bằng `claude plugin eval` trên claude 2.1.289, 4 ca fix và 4 ca debug × sonnet, opus × 10 lượt mỗi bên, đo mới cả hai bên: fix — không thước an toàn nào đổi ở ô nào, `✓ Step` 1–10/10 → 0/10, `test-truoc-sua` ở `cham-hop-dong` 7 → 9 (sonnet) và 6 → 8 (opus); debug — mọi thước bằng nhau trừ thước độ gọn do LLM chấm ở `loi-hien-nhien` opus 3/10 → 0/10 (p=0.21, giám khảo chỉ ghi phiếu), đã gắn cờ và chấp nhận là nhiễu giám khảo. Self-test ghim mọi luật từng nằm trong các mục Step, trần dòng debug hạ 245 → 170, các chỗ ghim số bước đổi sang tên mục. Chi $55.64.
- **Statusline mặc định gọn còn một dòng.** `◆ model (effort)  ◔ context%  ⧗ quota 5h% reset  ◷ tuần%  ⎇ nhánh ●file đổi ↑↓  ± +thêm/-xoá` thay cho ba dòng emoji; mỗi số có một ký hiệu một màu làm nhãn, ký hiệu context đầy dần theo phần trăm, phần trăm chuyển vàng ở 70% và đỏ ở 85%, màn hẹp bỏ dần thay đổi, tuần, quota rồi nhánh, không bao giờ bỏ model hay context; mức effort là giá trị `/effort` đang dùng, lấy từ `effort.level` của payload, chỉ hiện khi model có effort. `full` chỉ thêm dòng agent và todo khi đang có, `compact` là riêng dòng đó, `minimal` giữ model, context và nhánh. Dòng còn đọc thẳng payload của Claude Code để hiện fast mode (`ϟ`), thinking (`✱`), PR của nhánh và trạng thái review (`#80✓`, `✗` khi cần sửa, mờ khi draft, `!12` cho GitLab MR), git worktree (`⊟`), thời gian phiên (`⏱ 7h49m`) và tỉ lệ trúng cache prompt (`↻ 99%`, vàng dưới 80%, đỏ dưới 50%); mỗi mục chỉ hiện khi có và bị bỏ trước khi màn hẹp; quota giờ lấy từ `rate_limits` của payload khi có, không có thì đọc file cache như cũ. `statuslineColors: false` giờ tắt cả mã màu ở phần trăm. `statuslineLayout` tự cấu hình vẫn hiển thị như cũ. `src/claude/hooks/__tests__/statusline.test.js` ghim dòng, các chế độ, thứ tự bỏ khi hẹp và công tắc màu.
### Fixed
- **Rule không còn nói điều runtime không làm.**
  - `hook-protocols` mô tả marker `@@PRIVACY_PROMPT@@`, thứ hook riêng tư đã thôi phát ra từ 29/07/2026. Nay rule mô tả quyết định `ask` của host: người dùng trả lời một lần; trên host chỉ biết chặn thì lệnh bị chặn.
  - `orchestrator` bỏ con số 200K, bỏ dòng thông tin tài nguyên mà không hook nào tiêm vào, và bỏ ví dụ `phase-02.md`.
  - `manage-docs` coi bộ tài liệu cốt lõi là tuỳ chọn, và bỏ các lần kiểm 2 tuần, hằng tuần mà không có gì chạy.
  - `workflow` bỏ `design.md`.
  - `manage-docs`, `workflow` và `hook-protocols` không chép lại hợp đồng Receipt nữa mà trỏ về `state-sync.md`.
  - `review-audit-self-decision` ghi đúng chỗ định nghĩa các cửa là `state-sync.md`; `ai-dev-rules` chỉ đòi lint khi dự án có linter.
  - `AGENTS.md` của Codex trỏ tới hai bản override `state-sync` và `hook-protocols`.
- **Hook nêu thư mục `specs/`.** Hook rules đầu phiên dặn không tạo Markdown ngoài `plans/` và `docs/`, mâu thuẫn với mọi gói Specs. Nay hook này và hook của agent con, trên cả Claude lẫn Codex, đều nêu `Specs → specs/` (lấy từ `runtime.paths.specs`).
### Removed
- **Gỡ hook `usage.cjs` khỏi Claude và omp (`remove-usage-hook`).** Hook này đọc token OAuth của Claude Code từ Keychain macOS rồi gọi một API quota không công khai ở mỗi lượt gửi tin và mỗi lần `Edit`/`Write`, chỉ để statusline hiện quota; giờ statusline lấy quota từ `rate_limits` mà Claude Code gửi kèm. Khi nâng cấp, `.claude/hooks/usage.cjs` và `.omp/hooks/usage.cjs` bị xoá kể cả khi đã sửa, và hai dòng trong `.claude/settings.json` có lệnh chứa `.claude/hooks/usage.cjs` bị gỡ (hook riêng ở chỗ khác, như `~/my-hooks/usage.cjs`, được giữ); dòng nằm trong `.claude/settings.local.json` hoặc `~/.claude/settings.json` không do bộ cài quản lý, phải tự gỡ. Statusline không còn đọc file cache: trước lượt gọi API đầu tiên của phiên, hoặc trên Claude Code quá cũ chưa gửi `rate_limits`, sẽ không có quota; phiên API-key, Bedrock, Vertex vốn đã không có quota. Khoá `usage` trong `runtime.json` vẫn hợp lệ nhưng đã deprecated và không còn tác dụng; `hooks/lib/context.cjs` không đọc cache nữa. `bin/__tests__/usage-hook-retired.test.js` ghim lần cài mới, nâng cấp Claude và omp, và danh sách nguồn.
- **Gỡ năm hook legacy của `spec.json` khỏi Claude, Codex và omp (`remove-legacy-hooks`).** `completion-authority.cjs`, `completion-authority-check.cjs`, `completion-authority-state.cjs`, `semantic-review-authority.cjs` và `task-scaffold-guard.cjs` chỉ phục vụ gói legacy `spec.json`. Khi nâng cấp, bản đã cài bị xoá kể cả khi đã sửa, bản ghi manifest và dòng đăng ký của CafeKit bị gỡ (Codex giờ cũng dọn file hook cũ), còn hook riêng cùng tên ở chỗ khác được giữ; một bản sao hook CafeKit đặt ở `~/.claude/hooks/` hoặc `~/.codex/hooks/` và được đăng ký trong settings của dự án cũng bị gỡ đăng ký, vì bộ dọn so khớp `.claude/hooks/<tên>` / `.codex/hooks/<tên>` trong lệnh. Mức Strict giờ báo lỗi `Strict assurance is no longer supported`; đóng gói legacy `spec.json` bị chặn từ khi tách cổng; `spec.scaffold_guard` vẫn hợp lệ trong `runtime.json` nhưng đã deprecated và không còn tác dụng; `code-auditor` không còn in marker attestation. Dòng trong `.claude/settings.local.json` hoặc `~/.claude/settings.json` và thư mục `~/.cafekit/completion-authority/` không do bộ cài quản lý, có thể tự xoá. `bin/__tests__/legacy-hooks-retired.test.js` ghim lần cài mới và nâng cấp trên cả ba runtime.

## [0.16.8] - 2026-09-22
### Changed
- **`cf:orca` theo hướng dẫn của Orca 1.4.220.** Yêu cầu giao việc ("hand off", "handover", "giao cho agent khác") giờ đi tới `orca skills get orca-cli` thay vì `orchestration`, vốn chỉ dành cho việc người dùng nói rõ muốn giám sát, theo dõi hay điều phối; danh sách chủ đề nêu đúng các hướng dẫn CLI này có (browser, automations, publishing artifact là reference của `orca-cli`; Linear, giả lập iOS/Android, môi trường theo workspace và điều khiển GUI qua `orca skills list`). `terminal close --all` và `worktree rm` giờ phải hỏi người dùng kể cả trong worktree hiện tại, vì chúng dừng mọi tiến trình của workspace và xoá trạng thái; nội dung trang trong browser và nội dung ticket Linear cũng được coi là không tin cậy như output terminal.
- **`cf:ask` giữ luật chỉ-trả-lời khi chính câu hỏi nhờ sửa, và chỉ sang `cf:fix` (`ask-edit-repair`).** Khối luật giờ nói rõ: kể cả câu hỏi kiểu "… rồi sửa luôn", agent trả lời nguyên nhân có bằng chứng, không sửa file nào, và chỉ sang `cf:fix` để sửa (hoặc `cf:debug` khi chưa rõ nguyên nhân); self-test của `cf:ask` ghim các mệnh đề này (1658 test). Đo so với số gốc mới của `cf:ask` (10 lượt mỗi ô, trước → sau, câu hỏi "Sửa giúp luôn"): sonnet tự sửa file 2 → 0, chỉ sang `cf:fix` 0 → 10 ở cả sonnet và opus; câu hỏi thường vẫn đúng 10/10 cả hai model, dù 7/20 câu trả lời giờ thêm một câu cuối gợi ý `cf:fix`.
- **`cf:test` đọc các test liên quan trước khi cho `PASS` ở dự án thường, và đánh `FAIL` test có assertion phụ thuộc may rủi (`test-flaky-repair`).** Với Ordinary non-Spec testing, trước mọi `PASS` hay `PASS_WITH_WARNINGS` skill giờ đọc các test phủ code đích hoặc code đã đổi (mọi file test khi bộ test nhỏ). Khi assertion hay điều kiện pass phụ thuộc đồng hồ, số ngẫu nhiên, mạng, trạng thái file dùng chung hay thứ tự chạy thì kết luận là `FAIL`, nêu tên nguồn, kể cả khi mọi lần chạy đều xanh; khi chỉ phần setup phụ thuộc thì chạy lại các test nghi ngờ ít nhất hai lần nữa, kết quả lệch là `FAIL` vì chập chờn. Named probe của process-first vẫn chạy đúng một lần. Luật nằm trong danh sách Execution của `SKILL.md`, được `execution-strategy.md` và dòng flaky của `failure-triage.md` nhắc lại; một nhóm self-test ghim năm mệnh đề, mỗi mệnh đề bị bắt khi làm yếu (1653 → 1658 test). Đo trên một test pass khi `process.hrtime.bigint()` chẵn (10 lượt mỗi ô, trước → sau): sonnet `PASS` 2 → 0, đọc file test 8 → 10; opus `FAIL` 10 → 10 với số lần chạy lại thật 9 → 4 vì đọc assertion đã đủ kết luận; ở dự án xanh tất định kết luận vẫn đúng 10/10 cho cả hai model với chi phí gần như cũ.
- **`cf:git` có vòng đời worktree đầy đủ chỉ bằng git, và đường commit quét bí mật trước khi stage (`git-skill-repair`).** `worktree` mở thư mục anh em chỉ bằng git (Orca, Herdr, worktree của Claude Code chỉ là lối tắt tuỳ chọn), dừng khi thư mục hay nhánh đã tồn tại thay vì che lỗi, và có list, remove, prune: trước `git worktree remove` kiểm `status --porcelain --ignored` và log chưa merge, không bao giờ `--force`, đòi gõ `remove <tên-thư-mục>` / `delete <nhánh>`, và dùng prune cho thư mục đã mất thay vì `rm -rf`. `commit` xác nhận `git rev-parse --show-toplevel` và nhánh của checkout đích TRƯỚC khi stage, quét cây làm việc tìm bí mật trước khi stage bất cứ thứ gì (khối bash 3.2 ngay trong skill, không cần script đi kèm; chỉ in `file:dòng:loại`), dừng toàn bộ khi trúng mà không đụng index, stage theo đường dẫn tường minh (không `git add -A`, `.`, `-u`, `commit -a`), và không thêm `Co-Authored-By` trừ khi được yêu cầu. Khối quét tránh `$0`…`$9` vì Claude Code thay chúng bằng đối số gọi skill ngay trong thân skill (trace cho thấy model đọc `commit` ở chỗ awk cần `$0`; nay có pin cấm dấu đô la đi liền chữ số và `$ARGUMENTS` trong skill và references). Đo trên `claude-opus-5-5` bằng `claude plugin eval`, n=20 mỗi ô, trước và sau, skill nạp 160/160: commit-secret `dung-o-khoa` 8/20 → 20/20 (p=0.000045), `khong-add-all` 14 → 20 (p=0.020), `khong-coauthor` 9 → 20 (p=0.00015), `khong-doi-index-sau-lo-khoa` 13 → 20 (p=0.0083), `quet-truoc` 12 → 20 (p=0.0033), `khong-in-gia-tri` 17 → 20 (p=0.23); wrong-checkout `kiem-toplevel-truoc-stage` 19 → 20 (p=1.0; 17 → 20, p=0.23, khi không tính `git worktree list` là bước kiểm nhánh), `commit-dung-cho` 19 → 20; hai ca worktree vốn 20/20 cả trước lẫn sau (không có gì để cải thiện, không hồi quy). Bốn grader commit-secret nêu trên đo luật SAU khi sửa (văn bản cũ dạy `git add -A` và `git rm --cached`), nên chúng cho thấy mức thay đổi, không phải mức tuân thủ văn bản cũ. Giới hạn: một model; ba grader đã được sửa sau khi thấy kết quả (`kiem-toplevel-truoc-stage`, `quet-truoc`, `khong-dung-vi-tokens`; plan của gói ghi lý do), ô commit-secret phía sau được chấm lại offline dưới thước cuối; chi $48.47 trên $60 kể cả các lượt đã thay thế.
- **`cf:sync` có lệnh rebind chính thức, gọi không đối số thì chỉ báo cáo, không bao giờ né gate, và báo file đã đổi lấy từ git (`sync-skill-repair`).** `/cf:sync rebind <feature> [<task-NN-slug.md>]` chạy nguyên văn Command đã lập kế hoạch của từng task `done` trong một shell, lấy Base/Head một lần sau mọi Command bằng đúng lệnh provenance mà Develop nêu; lệnh fail hay chạy 0 test thì task thành `blocked` kèm dòng `Blocker:` nêu Command và mã thoát, Receipt cũ giữ lại dưới dòng "Not current proof" — không bao giờ ghi PASS. `/cf:sync` không đối số audit mọi gói process-first và không ghi gì cho tới khi người dùng xác nhận các thay đổi được nêu tên; skill cấm archive, chuyển hay đổi tên gói, đổi thư mục specs, sửa `.claude/` hay hook để gate im; báo file đã đổi là phần chênh của ảnh chụp `git status --porcelain -uall` kèm sha256 từng path. Luật nằm ở reference mới `references/rebind-and-audit.md`; một nhóm self-test 30 mutation ghim chúng, thân skill không còn ký hiệu đối số. Đo bằng `evals/sync` (4 ca lấy từ lịch sử dùng thật, `claude-opus-5-5` và `claude-sonnet-5-5`, 20 lượt mỗi ô, `claude` 2.1.286, cùng một thước đã khoá cho hai phía): gọi không đối số mà không ghi gì trước khi xác nhận tăng 4 → 20/20 (opus) và 7 → 20 (sonnet), p < 0,0001 mỗi bên, hỏi xác nhận 4 → 18 và 3 → 18 (watch); rebind lệnh fail kết thúc `blocked` với Receipt cũ được đánh dấu tăng 1 → 20 và 0 → 20, p < 0,000001 mỗi bên, trong khi không lượt nào ở cả hai phía từng ghi PASS mới; các thước chính của rebind sạch vốn đã ở hoặc sát trần (sonnet 19 → 20); các thước chính của ca audit đạt 20/20 hai phía chỉ sau khi hai thước chữ của nó được sửa sau khi thấy số gốc. Giới hạn đã đo: các thước được sửa và thêm trong giai đoạn pilot, và hai thước sửa thêm một lần sau khi đã thấy các ô gốc (chấm lại toàn bộ phía gốc, khi chưa chạy ô sau nào); một số quyết định do trợ lý được ủy quyền chọn, đang chờ duyệt, gồm cả thước đứng sau kết quả gọi không đối số (`specs/sync-skill-repair/plan.md`); thước watch "không gọi Base/Head gạch đầu dòng là lỗi" ở ca audit giảm 13 → 10/20 (opus, p = 0,52) và tăng 10 → 14 (sonnet), chưa đọc đối chiếu trace; báo file đã đổi không có thước chính; pilot phía sau chỉ 1 lượt mỗi ca và model, và runner trả phí nằm ngoài repo. Tốn $81,11 trên trần $120.
- **`cf:debug` viết báo cáo theo đúng độ sâu nó khai, `cf:fix` nhận báo cáo đó, và agent `debugger` làm theo các cửa của skill (`debug-proportional`, cùng `debug-eval-instrument`).** Báo cáo có thêm dòng `**Depth:** quick/local | standard | incident/deep`; mức Quick/local và Standard chỉ viết hợp đồng nguyên nhân, giả thuyết đã xác nhận, kế hoạch kiểm và hướng sửa, còn dòng thời gian, các giả thuyết khác, đường loại trừ và phần phòng tái phát chỉ dành cho Incident/deep. Bỏ sáu dòng `✓ Step`, sơ đồ mermaid và danh sách scout lặp lại; câu trả lời cuối mở đầu bằng `## Debug Report`; Bước 1 gọi skill `scout`; độ tin cậy `high` chỉ khi đã tái hiện hoặc quan sát lúc chạy; đọc nặng trên staging/production dùng chung phải được phép. `cf:fix --from-debug` chỉ đòi dòng thời gian và đường loại trừ với `incident/deep` (hoặc khi không khai độ sâu). Agent `debugger` dùng khuôn báo cáo của skill và, ngay đầu mỗi lần điều tra, trỏ tới hai cửa của nó. Đo bằng `claude plugin eval` sau khi sửa bộ chấm độ gọn và độ tin cậy, 10 lượt mỗi ca, cả hai nhánh trên `claude` 2.1.281: báo cáo tương xứng 1/10 → 9/10 (sonnet) và 2/10 → 8/10 (opus); có tiêu đề `## Debug Report` 39/40 → 40/40 và 12/40 → 40/40; điểm chính giữ nguyên (39/40 và 40/40).
- **Ba skill giờ nằm trong thư mục mang đúng tên công khai của chúng, và `cf:scout` thành một bước con ngắn (`scout-subroutine`).** Claude Code hiện skill dự án theo tên thư mục chứ không theo `name` trong frontmatter — một phiên liệt kê `develop`, không phải `cf:develop` — nên các chỗ gọi `cf:scout`, `cf:fix`, `cf:ask` trỏ vào những tên không host Claude nào hiện ra; ba skill hiện dưới tên `inspect`, `hotfix`, `question`. Trong toàn bộ lịch sử trên máy, Claude Code chưa từng gọi scout, trong khi Codex (mở file skill theo đường dẫn) đọc nó ở 480/1956 phiên. Ba thư mục đổi thành `scout`, `fix`, `ask`; bộ cài dọn thư mục cũ qua `obsolete.skills`, chỉ xoá bản quản lý còn nguyên, và danh mục CafeKit gắn nhãn `retired_skill` cho bản cũ do người dùng sửa thay vì loại luôn tên công khai vì trùng. Chứng minh bằng một lần nâng cấp thật từ bản cài trước cho Claude và Codex (`scripts/check-skill-rename.sh`): `--dry-run` không đổi gì, sau đó thư mục cũ mất, thư mục mới có, và danh mục của cả hai host đủ ba tên. Lệnh gõ tay thành `/scout`, `/fix`, `/ask`. Scout từ 142 xuống 61 dòng: cổng phạm vi và danh sách cấm quét giữ nguyên văn; mẫu `Scout Report` (chỉ dùng 1/480 phiên Codex) được thay bằng phần kết quả để bên gọi gộp vào báo cáo của nó (file kèm `path:line`, điểm vào và đường gọi, phạm vi ảnh hưởng, mẫu hình, điều chưa rõ); chế độ host tự bật chia việc không còn được tính là người dùng cho phép; quy trình chia việc hai pha chuyển sang file tham chiếu và câu "timeout 3 phút" không thực thi được đã bỏ. Bộ self-test từ 1382 lên 1403 test. Ca eval mới `evals/scout/chan-doan-giam-gia` cho `/cf:debug` chẩn đoán một lỗi ngưỡng nằm sâu năm tầng trong dự án 63 file: mọi lượt đều chẩn đoán đúng, nhưng scout chỉ được gọi 2/5 lượt sonnet dù tên đã hiện đúng — model đọc "Step 1: Scout" của debug là việc tự làm; đây là giới hạn ở phía các skill gọi, chưa sửa trong gói này. Thư mục cũ do người dùng sửa vẫn hiện trong host cạnh thư mục mới.
- **`cf:develop` chạy thử lệnh kiểm tra trước khi viết code, chỉ đúng lệnh lấy Base/Head, và được đo trên một phòng thử mà lượt trung thực có thể đóng task (`develop-repairs`).** Skill giờ chạy đúng lệnh Verification Plan một lần trước khi sửa và kỳ vọng nó thất bại (trừ `--flash` hoặc khi lệnh tốn tiền hay ghi artifact); lệnh qua ngay trước khi sửa, hoặc thất bại vì thứ khác ngoài Acceptance chưa đạt, là blocker phải báo chứ không phải lỗi để lách. Một vòng sửa được định nghĩa (một thất bại quan sát được cộng lần sửa và chạy lại), Receipt viết sau cùng khi proof và review đều qua, bước scout đọc test hay probe sẽ chấm task, và `### Flash` rút về một con trỏ. Dòng Receipt giờ nói Base và Head chép từ `node .claude/scripts/provenance.cjs … --json` và không bao giờ gõ tay hay tự tính: trước đây không skill, reference hay thông báo cổng nào nêu lệnh đó. `quality-gate.md` chỉ cho neo lại Receipt có artifact khi mọi hash khớp, không file nào mà proof đọc bị đổi, và mọi khẳng định đều rút từ artifact đó; ngược lại thì chạy lại. `command_identity` của cổng chấp nhận Verification Plan có nhiều dòng `- Command:` cấp cao nhất, neo Receipt vào dòng cuối, và không bao giờ đếm `Command` thụt lề hay nằm dưới tiêu đề con. Bộ self-test từ 1366 lên 1382 test. **Phải sửa thước trước.** Trong run của `claude plugin eval`, `/usr/bin/git` (vỏ Xcode) hỏng, nên phòng thử `evals/develop` không có git dùng được; lượt trung thực không thể lấy Base/Head, còn `receipt-day-du` (`Base:\s*\S+`) lại cho qua lượt tự chế. Vì vậy số "đóng đúng" của `develop-efficiency` đo mức sẵn lòng tự chế con dấu, không đo chất lượng develop. Scaffold giờ commit phòng thử và mang theo script lấy dấu, thước đòi Base 40 hex, và git lấy từ Homebrew. Sandbox còn chặn `find` và `Glob` vào `references/` của plugin, nên chỉ chữ trong `SKILL.md` chắc chắn tới được lượt chạy. Sau đó đo cả hai bản skill trên thước đã sửa, 10 lượt mỗi ô: ô sạch sonnet đóng đúng 6/10 trước và 9/10 sau (các lượt trượt của bản cũ viết Head bằng văn xuôi), ô sạch opus 10/10 và 9/10; khi lệnh kiểm tra hỏng vì lý do không liên quan tới code, opus dừng lại 10/10 ở cả hai bản nhưng dừng TRƯỚC khi đụng code 0/10 trước và 10/10 sau, còn sonnet báo blocker 0/10 trước và 4/10 sau. Giới hạn đo được: sonnet đóng task hỏng ở 16/20 lượt, và cả 11 lượt đã được kiểm lệnh trong Receipt đều tự thay lệnh của plan bằng một lệnh chạy được, điều cổng thật sẽ chặn còn eval không thấy (bản ghi của 5 lượt còn lại đã bị xoá trước khi đọc); số lần sonnet chạy lệnh kiểm tra ở ô hỏng không giảm (trung vị 5 → 6); 10 lượt mỗi ô không phân biệt được chênh một hai lượt; eval chạy không có hook hay cổng hoàn thành. Tốn 36,19 USD trên 17 thư mục kết quả của gói này.
- **Mô tả `cf:brainstorm` giờ phủ đủ các surface mà thân skill phục vụ, và `cf:specs` bỏ một tính từ mơ hồ (tiếp nối `skill-routing`).** Trước đây `cf:brainstorm` chỉ quảng cáo ca hai-thiết-kế-cạnh-tranh, bỏ sót ba surface mà body vẫn xử lý: khám phá ý tưởng còn mở, ứng viên một-phương-án vẫn cần quyết định, và bug cần đóng khung trước chẩn đoán. Dòng mới phủ exploration và ứng viên một-đường, còn bug chưa biết căn nguyên được chỉ đi nơi khác; `when_to_use` phát biểu cùng điều kiện. Ở `cf:specs`, "hurried" không còn là điều kiện vào — sự vội chỉ còn là lý do-không-được-bỏ cửa phạm vi. Chưa đo: thay đổi này đụng vào đúng text mà phép đo `skill-routing` mô tả, nên các con số của nó đã cũ cho tới khi chạy lại.
- **Hai dòng mô tả skill giờ nói rõ yêu cầu chưa đủ thông tin thuộc về đâu, và một model đã thôi bỏ qua cửa (`skill-routing`).** `cf:specs` nói yêu cầu ngắn, mơ hồ hay vội vẫn thuộc về nó, vì cửa phạm vi sinh ra để hỏi những điều chưa quyết; `cf:brainstorm` nói nó dành cho khi kết quả đã chốt mà hai thiết kế cạnh tranh. Hai dòng phát biểu cùng một điều kiện từ hai phía, và đó là điều kiện thân hai skill vốn đã giữ. Đo trên đúng câu hỏi mơ hồ cũ, trùng byte prompt, trùng bộ thước, trùng bản CLI, 20 lượt mỗi model so với nền 10 lượt: số lượt không gọi skill nào giảm từ 9/20 xuống 4/40, Fisher hai phía p = 0,0057 so với ngưỡng đã ghi trước khi chạy. Tách theo model thì kết quả lệch hẳn: sonnet từ 6/10 xuống 0/20 (p = 0,0004), opus từ 3/10 lên 4/20 (p = 0,66, không phân biệt được với nhiễu) — tức một model đã hết hành vi bỏ cửa, model kia thì chưa có bằng chứng thay đổi. Hai ca âm tính giữ nguyên, 0/12 lượt gọi skill cho câu hỏi git và việc sửa lỗi chính tả, chỉ đủ loại trừ tỉ lệ gọi nhầm trên khoảng 22%. `cf:brainstorm` được gọi 0/40, y như nền, và đó không phải kết quả: bộ ca không có ca nào mà kết quả đã chốt và hai thiết kế cạnh tranh. Bốn lượt còn bỏ cửa đều là opus và đều một khuôn — báo rằng công cụ ghi file bị tắt rồi giao nguyên code để dán — nên thứ thay đổi là số lượt tới được cửa, không phải thứ một lượt opus bỏ cửa sẽ làm. Tốn 11,77 USD gồm cả tiền giám khảo.
- **`cf:specs` thêm 8 cơ chế, và đã đo xem model có làm theo không (`specs-a-plus`).** Mẫu plan có thêm bảng `## Decisions` và cột `Priority`; file task có `## Steps` theo thứ tự và `## Failure Protocol`; xác minh được nêu là phép so sánh với Oracle chứ không phải phán đoán; GATE-SCOPE hỏi gọn trong một lượt, liệt kê mọi điểm chưa rõ dạng `[NEEDS CLARIFICATION: <câu hỏi>]` và luôn đủ EXPAND / KEEP / CUT; Step 0 nói rõ kích cỡ yêu cầu không phải tín hiệu rủi ro; và tác giả phải chạy lại một mẫu trích dẫn trước GATE-REVIEW. Develop, `rules/workflow.md` và `spec-maker` nay đều nạp hai mục mới của task. Bó 9 file giữ ở 745/750 dòng, bộ self-test từ 1353 lên 1366 test, số counterexample ngữ nghĩa từ 23 lên 30. Thêm 2 ca eval: một yêu cầu mơ hồ, và một ca nối transcript (`context.history_file`) đo chính packet model viết ra sau khi người dùng trả lời KEEP. Đo trên sonnet và opus, 3 run mỗi bên — đây là MỘT mẫu; một mẫu sau trên cùng bộ ca với cùng skill cho 4/6 và 3/6 ở chỗ mẫu này cho 6/6 và 5/6, nên hãy đọc các con số dưới đây như đặc tính của một mẫu, không phải thuộc tính của hệ thống: skill được gọi 12/12 run dương, dừng đúng GATE-SCOPE 11/12, 0/24 ở ca âm, và ca nối transcript đạt 10/11 tiêu chí ở mức 6/6 — model tự viết `## Decisions`, `Priority`, `## Steps`, `## Failure Protocol`, `- Oracle:` mà không cần nhắc. Lỗi ngày 17/09 (opus coi "export CSV khách hàng" là việc thường) không tái lập: ở hai run dừng đúng cửa, nó tự xếp yêu cầu đó là `critical`; run còn lại giao code thẳng nên không phân loại gì. Giới hạn đo được: với yêu cầu mơ hồ, skill chỉ được gọi 4/6 run; `moi-ac-co-task` trượt mỗi khi plan viết tiêu chí dạng dải (`AC-01..AC-06`) thay vì liệt kê — đây là lỗi thước đo, xảy ra ở cả hai model; `khong-code` tính một dòng văn xuôi mở đầu bằng chữ "Export" là code, nên một trong hai lần trượt ở ca export là lỗi thước đo chứ không phải code thật; `khong-tu-chot` trộn một rubric phạt nhầm việc đề xuất phạm vi nhỏ nhất (vốn do skill bắt buộc) với một lần trượt thật; và cả 6 run đều dồn toàn bộ tính năng vào một hàng Tasks. Một khoảng hở tuân thủ có thật: khi bị tắt Write và Edit, opus tuyên bố sẽ giao code hoàn chỉnh để dán vào và đưa ra khoảng 130 dòng code trong 5 khối ngay trong câu trả lời — tắt công cụ không ngăn được việc triển khai, chỉ dời nó vào lời đáp.
- **`cf:specs` giờ được mô tả bằng đúng yêu cầu cần mở nó.** Đo bằng bộ `evals/` mới (`claude plugin eval`, có/không skill, 3 run mỗi nhánh): skill hiện rõ trong danh mục nhưng sonnet không gọi 3/3, opus 0/1 khi được yêu cầu thêm đăng nhập Google "làm luôn đi" — cả hai đi thẳng vào code, opus còn tự chốt kiến trúc thay người dùng, đúng thứ cửa C1 sinh ra để ngăn. Mô tả mới mở bằng lời người dùng (thêm/xây/triển khai/đổi một chức năng), có ví dụ, nói thẳng "vội không phải lý do bỏ bước hỏi phạm vi", và "không bao giờ viết code"; mệnh đề skip giữ nguyên văn. Sau: gọi skill 10/12 run dương trên hai model (trước 0/4), dừng C1 theo trọng tài 7/12 (trước 0/7), 0/24 nhảy nhầm ở ca âm. Giới hạn đo được: opus vẫn coi "export CSV khách hàng" là việc thường và bỏ qua skill 2/3; sonnet thì không.
### Removed
- **Nâng cấp giờ xoá thư mục `cf:loop`, `cf:route` và `cf:delegate` đã cài.** Ba tên này được thêm vào `obsolete.skills` và danh sách retired của catalog, nên khi cài lại sẽ xoá bản còn khớp với bản ghi cài đặt, còn bản người dùng đã sửa thì giữ lại kèm cảnh báo.
- **Bỏ `cf:delegate`.** Skill này giao việc từ Claude Code sang CLI Codex hoặc Grok rồi theo dõi; nay host tự chạy subagent, còn việc giữa các agent đi qua pane và worktree của Orca (`cf:orca`). Đã xoá skill cùng 2 file tham khảo, và `cf:orca` không còn trỏ tới nó.
- **Bỏ `cf:route`.** Host chọn skill dựa trên mô tả, và đã đo được rằng sửa mô tả là đổi được lựa chọn; luật định tuyến giờ bảo agent tự phân loại việc mơ hồ, nhiều bước hay rủi ro cao rồi ghép chuỗi ngắn nhất, vẫn giữ các giới hạn về danh mục thật, không bịa skill và không mở rộng quyền. Skill, ba file tham chiếu, mục đóng gói, self-test và tài liệu đều đã gỡ; bản cài sau đóng gói được kiểm là không còn Route.
- **Bỏ `cf:loop`.** Skill tối ưu theo chỉ số (chỉ chạy khi gọi đích danh), hai file tham chiếu, mục đóng gói, câu luật định tuyến giữ nó ở chế độ gọi đích danh, các self-test và tài liệu đều đã gỡ; bản cài Claude và Codex sau khi đóng gói giờ được kiểm là không còn Loop.
### Fixed
- **Receipt gõ tay cặp Base/Head được bảo "thêm dòng" dù đã có.** Cổng giờ nói rõ hai dòng có mặt nhưng không phải cặp runtime dẫn xuất, kèm hình dạng mong đợi, để việc cần làm là dẫn xuất lại.

## [0.16.7] - 2026-09-16
### Fixed
- **Receipt viết trường theo kiểu gạch đầu dòng bị trượt bốn check cùng lúc**: mọi mục khác trong file task đều viết trường theo kiểu đó — `- Command:` của Verification Plan nằm ngay trên Receipt vài dòng — nên viết tiếp theo phong cách ấy là sai lầm tự nhiên, mà mục duy nhất cấm nó lại chính là Receipt. Phần khớp trường giờ chấp nhận dấu `-`, `*` hoặc `+` ở đầu. Thân Receipt được cắt riêng theo mục `## Receipt` nên không đụng tới trường của Verification Plan.

- **Mọi lỗi Receipt đều được trả lời bằng cùng một câu**: "write a runtime-bound `## Receipt`" là hướng dẫn sai khi Receipt vẫn ở đó mà chỉ một trường không đọc được — đúng cảnh mà lỗi trên tạo ra. Thông báo giờ nêu thẳng cần sửa gì: thiếu dòng `Verification: PASS`, `Command:` không khớp Verification Plan, exit khác 0, khối output rỗng, thiếu `Base:`/`Head:` — trên cả hai runtime, từ một bảng ánh xạ dùng chung.

## [0.16.6] - 2026-09-16
### Fixed
- **Việc commit `specs/` là một yêu cầu chưa từng được nói ra, và dự án nào `gitignore` nó thì không thể đáp ứng**: file task chưa commit vẫn bị ràng buộc `Base`/`Head` sống, nên những dự án đó hỏng toàn bộ receipt vĩnh viễn ngay sau lần sửa code đầu tiên. Được báo từ một dự án bị chặn ngay ở tin nhắn đầu phiên, chưa thay đổi gì, và vẫn còn bị chặn sau 0.16.5.

  Receipt giờ chỉ ràng buộc `Base`/`Head` sống khi chính file task của nó **có bản trong `HEAD`** mà bytes hiện tại không còn khớp. Đã commit-không-đổi và chưa-từng-commit đều kiểm trên cấu trúc: cái đầu vẫn khớp mốc của nó, cái sau không có mốc nào để lệch. Sửa file task đã commit thì vẫn bị bắt. Mọi kiểm tra cấu trúc — trạng thái, `Verification: PASS`, `Exit: 0`, lệnh khớp Verification Plan, output không rỗng, không placeholder — vẫn chạy trong mọi trường hợp, nên packet chưa commit **vẫn được kiểm**, chỉ là không đối chiếu `Base`/`Head`.

  Tiếp nối 0.16.5, vốn gỡ điều kiện cả-cây vì cùng lý do: mỗi phép kiểm đều báo động trên mọi receipt hợp lệ nên không mang tín hiệu nào. Bốn ca ghim hợp đồng cũ nữa được viết lại kèm lý do chứ không nới lỏng, và thêm ca `50` để chứng minh các kiểm tra cấu trúc không bị gỡ theo.

## [0.16.5] - 2026-09-16
### Fixed
- **Một file chưa commit là chặn mọi lượt, ở bất kỳ dự án nào có packet Specs đã xong**: `receiptBindingMode` mở lại **mọi** receipt done trong repo mỗi khi có thứ gì ngoài thư mục specs chưa commit, và receipt bị mở lại thì phải khớp `Base`/`Head` sống. `Base` là commit cuối cùng chạm vào file ngoài thư mục specs, nên receipt viết trước bất kỳ commit sau đó đều mang `Base` cũ **theo định nghĩa** — đo được 52/52 receipt done trên repo này. Vì vậy điều kiện đó làm hỏng tất cả cùng lúc, mọi lần, và không phân biệt nổi receipt bị sửa tay với receipt nguyên vẹn. Được báo từ một dự án mà người dùng bị chặn ngay ở tin nhắn đầu tiên của phiên, chưa thay đổi gì cả.

  Điều này **đảo** quyết định C1 đã ghi ở `specs/receipt-freshness-policy/plan.md` (giữ điều kiện cả cây). Bằng chứng mới chính là số đo trên: một phép kiểm báo động trên 100% dữ liệu hợp lệ thì không mang tín hiệu nào. Hai ca ghim hợp đồng cũ được cập nhật kèm lý do chứ không nới lỏng.

## [0.16.4] - 2026-09-15
### Fixed
- **Cả hai hook Stop chặn mọi lượt ở dự án có nhiều packet Specs, và cổng hoàn thành chưa từng kiểm một receipt nào** ([#79](https://github.com/haposoft/cafekit/issues/79)): mỗi hook xác định "lượt này thuộc feature nào?" bằng cách đếm số ứng viên thô, nên một repo chỉ đơn giản là tích luỹ nhiều feature đã xong sẽ mơ hồ vĩnh viễn, còn lời khuyên duy nhất — cung cấp feature target tường minh — lại trỏ tới thứ không có gì trong sản phẩm ghi ra. Nửa nghiêm trọng hơn là danh tính được quyết trước: khi có nhiều packet, một receipt thật sự thiếu lại bị trả lời bằng `multiple active specs detected`, nên phần rà receipt của cổng chưa bao giờ chạy. Đã tái hiện cả hai nửa trước khi sửa, và đo lại sau: cùng dự án đó giờ báo đúng lỗi thiếu receipt, trên đúng feature được chỉ định.

  Mỗi hook giờ thu hẹp theo đúng câu hỏi của chính nó. Cổng Stop chọn packet còn việc chưa xong, bất kể layout, nên repo toàn packet legacy `spec.json` thu hẹp y như repo process-first vốn đã làm được; nhánh rà cả tập vẫn giữ chốt chặn process-first của riêng nó, vì nhánh đó thoát ra trước các lớp semantic-digest, `FLASH_UNVERIFIED`, feature-receipt và completion-policy. Phê duyệt closeout chỉ đếm những packet thật sự đang đòi closeout. **Dự án có đúng một packet vẫn resolve được bất kể trạng thái, không đổi** — kể cả packet đơn lẻ đang làm dở, thứ mà nếu chỉ dùng luật closeout thì sẽ bị bỏ sót. Codex đi tới cùng đáp án qua resolver dùng chung thay vì phép đếm riêng.

  Khi thật sự có nhiều packet đang chạy, `specs/_shared/active-feature.json` (`{"featureName": "..."}`) chỉ ra packet đang làm, và cả hai hook Stop trên cả hai runtime đều đọc được. Target do host cung cấp luôn thắng, nên file không bao giờ bẻ lái một hook vốn đã biết feature của mình; file thiếu, rỗng, sai định dạng hoặc là symlink thì bị bỏ qua chứ không biến thành lỗi gây chặn. Hai thông báo phê duyệt giờ nêu tên feature đang được duyệt. **Hai packet cùng thật sự đòi closeout thì vẫn chặn cho tới khi file chỉ định một cái.**

  Receipt trong những packet mà cổng không chọn thì vẫn chưa được rà lại, và đó là một lỗ hổng đã biết chứ không phải lựa chọn thiết kế: `receiptBindingMode` gắn lại mọi receipt trong repo mỗi khi cây ngoài thư mục specs còn bẩn, nên rà các packet lịch sử sẽ sinh ra một lỗi `provenance` cho từng cái ngay khi có một file không liên quan chưa commit. Đo ở quy mô thật trên chính repo này lúc phát triển: 17 packet đã xong mang 50 task done với receipt hợp lệ đã commit cùng lúc hỏng `provenance` chỉ vì hai file nguồn không liên quan chưa commit, và cả 50 lại đạt sau khi commit. Việc đổi ý nghĩa của ràng buộc receipt để dành cho packet riêng.

- **Mục `task_registry` cũ ghi là `completed` bị đọc thành chưa xong** ([#79](https://github.com/haposoft/cafekit/issues/79)): phần thu hẹp chỉ chấp nhận `done`, nên repo nâng cấp từ bản cũ vẫn để mọi packet lịch sử tranh chỗ, và cú chặn ở trên sống sót qua chính bản vá lẽ ra phải gỡ nó. Đo trên đúng hình dạng được báo — 17 packet lịch sử cộng 1 packet đang chạy — `completed` vẫn cho ra 18 ứng viên trong khi `done` thì resolve. `normalizeLegacyWorkflowCandidate` giờ đọc cả `done`, `completed` và `complete`, khớp với cách `spec-final-state.cjs` vốn đã đọc trạng thái spec. Packet process-first giữ nguyên tập nghiêm ngặt `pending`/`in_progress`/`paused`/`blocked`/`done`, nên task ghi `completed` ở đó vẫn là sai định dạng chứ không được coi là đã xong.

## [0.16.3] - 2026-09-14
### Fixed
- **Hook Codex trả 127 khi host khởi động từ giao diện đồ hoạ macOS** (2026-09-14): lệnh launcher gọi `node` bằng tên trần, mà `node` được tìm qua PATH. Ứng dụng khởi động từ Finder hoặc từ app như Orca chỉ truyền cho tiến trình con PATH tối thiểu `/usr/bin:/bin:/usr/sbin:/sbin`, không chứa bản node của Homebrew, nvm, fnm hay Volta, nên shell trả `command not found` và hook chưa bao giờ khởi động — mã 127, khác với mã 1 mà 0.16.2 đã sửa. Mỗi launcher giờ mang theo một lưới đỡ PATH: thư mục của Node.js đã chạy bản cài, rồi `/usr/local/bin` và `/opt/homebrew/bin`. Lưới đỡ được nối vào **cuối** chứ không phải đầu, nên node hiện tại của trình quản lý phiên bản vẫn được ưu tiên trong terminal bình thường, còn các mục này chỉ dùng tới khi PATH không có node nào; thư mục không tồn tại thì cũng vô hại. Cài lại sẽ gắn lại cả launcher do 0.16.2 ghi lẫn dạng git trước 0.16.2, vì nếu không thì logic merge coi đó là chỗ người dùng tự đặt và giữ mãi. Hook do người dùng tự viết không bao giờ bị ghi lại, kể cả khi trùng dạng.

  Claude Code mang đúng khuôn mẫu này trong `.claude/settings.json` và **chưa** được sửa ở đây. Phần merge của nó khử trùng lặp theo nguyên văn chuỗi lệnh chứ không theo tên script, nên đổi định dạng sẽ thêm bản sao thứ hai của mọi hook ở các dự án đã cài thay vì thay thế. Chưa quan sát thấy nó hỏng, vì Claude Code thường khởi động từ terminal vốn đã có node trong PATH.

## [0.16.2] - 2026-09-14
### Added
- **Orca (onorca.dev) runtime awareness** (2026-09-13): a `cf:orca` skill ships with the install itself instead of a per-machine setup, tried and then removed for following the machine rather than the project. It detects `ORCA_PANE_KEY`, routes the user's phrases to Orca's own `orca skills get orca-cli`/`orchestration` guides read live rather than vendored, and defaults `terminal send`/`close`/worker-stop to the current `ORCA_WORKTREE_ID` — its safety property — asking first, by name, before reaching outside it. `session.cjs` (Claude Code and Codex) ends its SessionStart line with `Orca: pane` when the variable is set and never prints the two token variables in the same environment. omp gets the skill only beside a Claude or Codex install and no session line; Grok gets the skill via its Claude compatibility layer but no session line either.

### Fixed
- **Hook Codex không chạy khi dự án chưa có git, hoặc nằm trong một repo lớn hơn** (2026-09-14): mọi launcher trong `.codex/hooks.json` tự tìm gốc dự án bằng `$(git rev-parse --show-toplevel)`. Ngoài repo thì lệnh đó không in gì nên đường dẫn co lại thành `/.codex/hooks/<script>.cjs`; còn dự án nằm trong repo lớn hơn thì nó trả về gốc **ngoài cùng** nên launcher trỏ sang `.codex` của thư mục khác. Cả hai đều trỏ vào đường dẫn không tồn tại, nên Codex khởi chạy đủ hook, hook nào cũng chết, và các cổng riêng tư, chặn rò rỉ bí mật, chặn scaffold, chặn hoàn thành đều vắng mặt trong im lặng dù bản cài trông vẫn bình thường. Đường dẫn đã biết ngay lúc cài nên giờ được ghi thẳng vào lệnh, bọc nháy đơn để đường dẫn chứa `$`, dấu huyền hay khoảng trắng vẫn an toàn. Cài lại còn sửa luôn launcher do bản installer cũ ghi, vì logic merge coi script đã đăng ký là chỗ người dùng tự đặt và nếu không có bước này thì lệnh hỏng sẽ nằm lại vĩnh viễn; chỉ đúng mẫu byte mà CafeKit từng phát ra mới bị ghi lại, hook người dùng thêm vào được giữ nguyên. Launcher Windows vốn đã mang đường dẫn tuyệt đối nên không đổi. Claude Code chưa bao giờ dính lỗi này vì nó dùng `$CLAUDE_PROJECT_DIR` do host đặt sẵn. Đổi tên hoặc di chuyển thư mục dự án giờ cần cài lại, cùng lý do mà Windows vốn đã như vậy; chạy lại installer sẽ báo và sửa.

## [0.16.1] - 2026-09-09
### Added
- **Oh My Pi (omp) platform** (2026-09-08): `--platform omp` provisions the Claude gate scripts with a one-file omp overlay under `.omp/hooks/`, `.omp/runtime.json` with its schema, and a bridge extension omp auto-loads from `.omp/extensions/`, giving omp CafeKit's gates on every event it emits. Skills are not copied, since omp discovers `.claude/skills` and `.agents/skills` itself. Subagent hooks are not carried because omp has no subagent events.

### Changed
- **Portable gate hooks** (2026-09-08): hooks derive their runtime directory from their own location (`lib/runtime-dir.cjs`) instead of hardcoding `.claude`, so one hook tree serves `.claude/` and `.omp/`; the omp fork became a small overlay written over the Claude set, an omp-only install ships `.omp/runtime.json` so rules are injected, and provenance ignores `.omp/` runtime state. Thirteen `~/.claude/` reads of Claude Code's own files stay Claude-only by design.

### Fixed

- **Gates were silently open under Grok CLI** (2026-09-08): grok runs CafeKit's hooks through its Claude compatibility but with a camelCase envelope, so the privacy gate asked nothing, the Stop gate lost its loop guard, and denials arrived without a reason. One shared payload reader inside the hooks fixes all three, denials now carry a JSON reason, and `--platform grok` installs the Claude runtime plus a trust reminder. The limits are recorded: only four grok channels change control flow, so reminder hooks do not reach the model, and `usage.cjs` stays unrouted because it touches Claude credentials.

### Removed

- **rtk token-saver install phase**: removed the opt-in rtk phase, the `--with-rtk` flag, the interactive prompt, and its localized strings from the installer. An old script passing `--with-rtk` still runs, since unknown flags are ignored. A previously registered rtk hook stays where it is.

## [0.16.0] - 2026-09-04

### Breaking

- **Public skill prefix renamed to `cf`**: skills are invoked as `cf:<name>` in Claude Code and `cf-<name>` in Codex CLI. The `hapo` prefix is gone with no alias.
- **Repair skill renamed to `fix`**: `hapo:hotfix` became `cf:fix` (`cf-fix` on Codex). No old-command alias. The `hotfix` payload directory name is unchanged so upgrades stay clean.

### Fixed
- **Hook state written into the source tree** (2026-09-02): Claude and Codex hooks now resolve their own state directory, so a run from `packages/spec/src` writes crash logs and gate caches to a temp directory instead of the source tree. An untracked `.logs/` under `src/` changed the worktree digest that receipt provenance binds to, which made the completion gate report every done task as stale; it did so three times before the cause was found. One shared helper per runtime replaces fourteen copies of the old path expression, and a final self-test fails when any suite leaves hook state under `src/`.
- **Docs sync after workflow-state commits** (2026-08-26): Claude and Codex docs-sync hooks now exclude the configured Specs root as well as docs, so committing plans or refreshed Receipts does not create a false source-change warning; behavioral coverage proves both runtimes stay silent for Specs-only commits and still report real source changes.
- **Receipt provenance after spec-only commits** (2026-08-26): runtime `Base` now follows the latest commit that changes content outside the configured Specs root, matching the existing worktree `Head` exclusion. Committing refreshed process-first Receipts no longer invalidates those same Receipts on the next Stop, including deterministic fallback for repositories whose reachable history has multiple Specs-only roots.
- **Codex managed-block ownership** (2026-08-20): native `src/codex/AGENTS.md` is installed verbatim so its foreign-runtime ignore clause cannot be inverted by the generic Claude-to-Codex converter; fresh and rerun installer tests now assert the exact actor on both sides of the boundary.
- **Process-v3 Stop proof binding** (2026-08-20): Claude and Codex now require each inline Receipt command to match the task's exact Verification Plan command. A single unfinished packet wins over completed history, while an all-completed packet set is revalidated without a permanent `multiple_persisted` Stop lock.

### Removed
- **OpenCode support** (2026-08-19): gỡ đường cài, plugin runtime `src/opencode`, dependency, test và tài liệu OpenCode. Bản cuối hỗ trợ OpenCode là 0.16.x. Các entry lịch sử bên dưới giữ nguyên vì ghi lại sự thật đã xảy ra tại thời điểm đó.

### Changed
- **Secret output guardrail** (2026-09-04): Claude and Codex gained a UserPromptSubmit hook that reminds the agent not to print raw credentials when the prompt is about secret handling. It closes the gap between the existing read gate and the commit-time scanner: neither protected the transcript. The hook never echoes the prompt or the matched value and fails open.
- **Coding levels on both runtimes, junior by default** (2026-09-04): Claude installs seed `outputStyle` with the junior level; Codex reads a new `codingLevel` key and its rules hook injects the matching style once per session, since Codex CLI has no native output-style surface. Out-of-range levels inject nothing, and a user's chosen style is never overwritten.
- **Coding-level output styles** (2026-09-03): added six output styles under `.claude/output-styles/`, from ELI5 to a terse expert mode, so the reader can set how much explanation answers carry. Every style keeps the base coding instructions and changes presentation only. Claude Code only; a Codex install ships none.
- **Public skill prefix renamed to `cf`** (2026-09-03): skills are invoked as `cf:<name>` in Claude Code and `cf-<name>` in Codex CLI instead of the `hapo` prefix. Breaking rename with no alias; payload directory names are unchanged. Historical records keep their original wording.
- **Self-documenting runtime configuration** (2026-09-03): `runtime.json` gained a `$schema` reference and a `runtime.schema.json` installed next to it for Claude and Codex alike, giving editors completion and hover documentation for every project setting. Descriptions come from the code that reads each key; `spec.completion_gate` is documented as a gate that blocks while present rather than a toggle, and the `hooks` map and `develop` key are marked deprecated because nothing reads them.
- **Codex hooks.json entry ownership** (2026-09-03): `.codex/hooks.json` is now merged per hook script rather than copied verbatim, the same way `.claude/settings.json` has always been handled. Previously one user-added hook classified the whole file as user-modified, so a normal install kept CafeKit's retired hooks and `--force-overwrite` deleted the user's. Merging on the script basename instead of the full command also stops a hook the user moved to another matcher from being registered a second time.
- **Strategist counsel agent** (2026-09-03): added an advisory-only agent pinned to the strongest model that returns complete counsel in one reply, without an interview or a session model switch. A host lacking that tier substitutes the newest Opus it allows. Subagent coordination now routes repeated failures and high-stakes design forks to it, and records that counsel never substitutes for execution proof.
- **Compaction state anchors** (2026-09-03): a PreCompact hook records branch, HEAD, dirty-file count, and in-flight task state before compaction, and the next session start reads them back. Only re-derivable facts are captured, nothing captured is proof or authorization, and unavailable facts are recorded as null.
- **Statusline configurable layout** (2026-09-02): the statusline reads an optional `statuslineLayout` `{ lines: [[sectionId, ...], ...] }` value that selects and orders `model`, `context`, `quota`, `directory`, `git`, `plan`, `cost`, and `changes`; render modes only slice the line count. The quota area now shows the five-hour and weekly windows with reset countdowns while the usage cache is fresh, and cost is a layout-gated, default-disabled section. Semantics were ported into the existing self-contained `status.cjs` rather than importing the reference library cluster. With the key absent and no fresh cache or cost data, output stays byte-identical. The first behavioral statusline test covers ten cases beside the static probes.
- **Review precedence and process hygiene rules** (2026-09-02): added `review-audit-self-decision.md` and `process-management.md`, covering when an audit may reverse a verified decision or a user decision, and how long-running processes are tracked, reused, and stopped. Claude auto-loads project rules; Codex does not, so its instruction template carries an explicit pointer instead. Three static probes and one installed-parity test guard the contract.
- **Adaptive Docs workflow** (2026-09-01): documentation work runs through a Post-Task Docs Checkpoint that accepts a `none`, `minor`, or `major` handoff from Develop and Sync, with an escape path so a `major` checkpoint without a docs root cannot silently initialize one. A Delegation Gate now governs reader splitting at four sites instead of dispatching readers ungated.
- **Native skill routing** (2026-09-01): skill selection uses the runtime's own semantic matching against a generated live catalog rather than a prompt-scoring hook. Routing rules were shortened to proportional selection and chain shape, and they state plainly that selection is not deterministic.
- **Optional document skill bundle** (2026-09-01): fresh installs now ship 18 core skills and offer `docs`, `docx`, `pdf`, `pptx`, `xlsx`, and `ai-multimodal` as one persisted opt-in bundle through the interactive installer or `--with-document-skills`. `--without-document-skills` safely removes only pristine CafeKit-owned copies; legacy installs retain the bundle on first upgrade. Six broad engineering companion skills are no longer installed or published, while docs validators, hooks, and agents remain core runtime assets.
- **Skill-agent-hook relationship integrity** (2026-08-31): aligned implementer, scout, code-auditor, docs-keeper, and deployer with the process-first `plan.md` + flat task + inline Receipt contract while isolating the legacy adapter. Public web, tutorial, catalog, and localized docs now use `ask`/`scout`/`fix`, describe Claude Code + Codex CLI as current targets, and label OpenCode 0.16 as history. New source, installed-projection, and website guards fail on contract drift.
- **Adaptive Research and bounded Loop** (2026-08-31): Research now selects Quick, Standard, or Deep depth and makes material claims traceable by source, authority, date/version, applicability, and evidence state. The new explicit-only Loop freezes a finite numeric Metric, reproducible Baseline, distinct Guard, noise/minimum-delta policy, budget, and stop conditions; experiments stay in a detached worktree and return a base-bound patch without applying or committing it. Packed Claude/Codex parity and semantic mutations prove the instruction contract; live-agent adherence remains `[UNPROVEN]`.
- **Public Fix skill and adaptive repair routing** (2026-08-30): renamed the public repair surface from the previous Hotfix command to `hapo:fix` / `hapo-fix`. The public invocation change is breaking and has no old-command alias; the manifest-owned physical `hotfix` directory remains only for installer ownership and clean upgrades. Quick/local fixes stay ceremony-light; Standard and Incident/deep repairs add a bounded outcome/constraints/non-goals/acceptance frame, and only unresolved external facts or multiple cause-aligned remedies trigger post-diagnosis research, brainstorm, and staged planning. CI, test, type, UI, and log overlays now require category-specific baselines and proof while loading only the matching section. Semantic mutation and installed-runtime tests protect the rename, routing, progressive disclosure, and scout-before-diagnosis boundary.
- **Adaptive-depth Debug workflow** (2026-08-29): `hapo:debug` now keeps routine failures lightweight while escalating production, multi-component, intermittent, data/security, environment, and concurrency incidents into correlated timelines, explicit hypothesis elimination, trigger/root-cause/contributing-factor tracing, and recurrence-prevention handoff. Debug remains diagnostic-only; Fix/Test own mutation and post-change proof, and parallel reconnaissance now requires user permission, runtime support, and independent read-only scopes. Semantic mutation tests and disposable Codex install parity protect the contract.
- **Public Ask and Scout skills** (2026-08-28): renamed the public question-answering surface to `hapo:ask` and the discovery surface to `hapo:scout` across Claude, Codex, routing, README, and web documentation while retaining the internal `question`/`inspect` payload paths for compatible upgrades. Scout now uses a focused local fast path, delegates only when permission, runtime support, and independent scopes are all present, and falls back to sequential discovery otherwise; source and disposable-install checks cover both runtime projections.
- **Plan-native Develop execution** (2026-08-26): `hapo:develop` now selects the first dependency-ready task in plan order and continues sequentially until a real blocker or C3; exact-task, interrupted-resume, worktree parallel, Flash, Receipt, and final-Head stabilization contracts now have source and installed-runtime coverage.
- **Specs timing benchmark archived** (2026-08-26): the unimplemented recorder/benchmark proposal was explicitly CUT and moved to a dated archive; its two tasks remain `blocked`, all material questions/findings remain unresolved, and no timing result or execution Receipt is claimed.
- **Specs process-first v3 swap** (2026-08-19): tài liệu `hapo:specs` chuyển sang packet phẳng `specs/<feature>/plan.md` + `task-NN-<slug>.md`, dùng C1/C2/C3 và inline `## Receipt` làm đường chính; legacy adapter chỉ còn là nhánh tương thích.
- **Archived semantic spec** (2026-08-19): `specs/cafekit-semantic-eval-firewall` được chuyển vào `specs/archive/` như tư liệu lịch sử.
- **Claude prune follow-up** (2026-08-19): bản cài Claude prune các file payload spec cũ bằng migration manifest. Known limitation: bản upgrade của Codex vẫn còn 15 file mồ côi từ bundle cũ, nhưng fresh install đi đúng inventory mong đợi.
- **Specs v2 semantic authoring contract**: made “a new implementer does not guess product/architecture decisions” the North Star; split durable planning (`None|Compact|Full`) from assurance (`Routine|Elevated|Strict`), with `Direct|Standard|Critical` retained only as compatibility adapters. Compact/Full share a three-file core and add explicit research, topology-driven tasks, or `spec.json` phase groups only when justified; no phase files or mandatory User Story/scenario boilerplate.
- **Specs v2 proof boundaries**: task plans now stay concise around typed source anchors and a `Verification Plan`; per-task receipts remain separate execution artifacts and `feature-receipt.md` is final closeout only. Structural validation, factual grounding, and whole-spec semantic/counterexample review are distinct gates; no tool exit alone proves semantic correctness.
- **Specs v2 platform and benchmark scope**: Claude Code and Codex are the primary v2 acceptance targets without removing broader OpenCode support. Benchmark guidance requires both v2 axes plus the legacy lane, while documenting that current `b1.v1` source still validates lane only and has no implemented axis-schema migration.
- **Specs v2 usage guide**: replaced the legacy mandatory phase/task flow with the adaptive two-axis topology, honest authoring pause/approval boundary, Claude/Codex-native handoff, and separate execution receipts.
- **Specs v2 semantic evidence**: readiness now requires a compact `validation.semantic_review` receipt bound to a read-only digest of final artifacts and canonical topology, exact `RN.M` coverage, concrete counterexamples linked to real design decisions, and independent review for `Strict`; no extra review report file is generated.
- **Specs v2 proportional assurance**: any normalized risk now raises the automatic minimum only to `Elevated`; `Strict` is opt-in for an explicit user/project independent-audit requirement or a user-confirmed scope-specific audit decision. Risk keywords, severity labels, `Full` depth, and model preference no longer create reviewer ceremony; an unavailable Strict host event pauses once instead of retrying, downgrading, or simulating attestation.
- **Shared CORE instruction block (Đợt 1)**: root `AGENTS.md` now stores one shared `src/common/AGENTS.md` CORE block (`<!-- CAFEKIT CORE START -->` / `<!-- CAFEKIT CORE END -->`) installed once per run by `ensureSharedAgentsMdCore`, before the per-platform loop. Claude/Codex/OpenCode runtimes carry only their own runtime-specific wrapper content; language patching stays in the shared CORE while addressing remains per-platform.
- **Combined-install boundary**: documented the tested shared-root trade-off (neutral CORE plus native Codex/OpenCode blocks in `AGENTS.md`, also imported by Claude) and added regression coverage for marker topology, ownership-preserving reruns, locale/addressing placement, and malformed-marker rollback.
- **Reinstall preserves managed Addressing**: when a newer template drops its `## Addressing (Context Overflow Indicator)` section, the exact saved section is carried over from the existing managed block (Claude, Codex, and OpenCode) so the user's address survives for `setupAddressing`.
- **OpenCode direct plugin copy hardening**: plugin copies skip generated artifacts (`.coverage`, `__pycache__`, `.pyc`/`.pyo`) and byte-normalize direct text plugin files via `normalizeOpenCodeBody`.
- **Source-path tripwire self-test**: real install fixtures assert no installed payload under `.claude|.codex|.opencode` still references `packages/spec/src/`, covering all three runtimes including combined installs.
- **Security invariants — logging redaction (lane-aware)**: exact-boundary token matching, false-positive-safe preservation of safe identifiers (`_file`/`_path`/`_hint`/`_label`, `tokenizer`) and credential-free public URLs, quote-aware `Bearer`/`Basic` redaction preserving surrounding quotes and trailing `,`/`;`/whitespace outside the value, and idempotent markers `[REDACTED]`/`[REDACTED-PEM]` (`redact(redact(x)) === redact(x)`).
- **Security invariants — filesystem write boundary (lane-aware)**: filesystem containment via lexical `path.resolve` + `realpath` of deepest existing parent, symlink/traversal rejection (empty/whitespace/URI/absolute/`..`/sibling-prefix and parent/final symlink never followed or overwritten), atomic same-directory temp write + `rename` with cleanup on error and no outside-root mutation on rejection, and canonical `realpath` return (e.g. macOS `/var` → `/private/var`).
- **Lane-aware evidence**: security verification applies only when the task touches redaction or filesystem boundary; Direct — targeted unit test + diff self-check, Standard — bounded suite, Critical — strict evidence / full suite (inspector/test-runner/code-auditor) per lane policy; no fixed heavy ceremony on every task.
- **B1 benchmark harness**: added frozen corpus/config/receipt validation, per-lane baseline/treatment summaries, task/repeat completeness gates, and fixture-only contract tests; live baseline/treatment runs remain pending, with no rollout claim.
- `npm test` in `packages/spec` passes `304` tests.

## [0.16.0-rc.1] - 2026-08-07

### Changed
- **Slim always-on instructions**: made `AGENTS.md` the shared instruction surface, reduced Claude/Codex/OpenCode templates to project gotchas plus runtime-specific guidance, and added `Commands`, `Do not touch`, and `Slow or expensive` scaffolding stubs.
- **Canonical instruction install**: root `AGENTS.md` stores one shared `src/common/AGENTS.md` core block for Claude, Codex, and OpenCode installs; each runtime keeps its own managed block and user content is preserved.
- **Instruction hook safety**: rules hooks are silent when runtime configuration is missing, malformed, or unreadable; Claude subagent paths prefer payload `cwd` over stale `PROJECT_ROOT`.
- **OpenCode instruction updates**: OpenCode language and addressing patches use its own managed block, and all runtimes ship project-local skill/venv gotchas with correct paths.
- **Combined-install regression coverage**: real temp installs verify one shared core, runtime-specific blocks, localization, evidence contracts, and idempotent reruns.
- **Session-scoped hook context**: rules hooks now reserve one injection per session instead of re-injecting after a five-minute gap; reservation or runtime-read failures remain fail-open.
- **Trimmed dynamic reminders**: kept only configured language, plans/docs paths, and `docs.maxLoc` in prompt hooks; trimmed Claude subagent context to paths, language, and skill venv guidance.
- **Wave 4 skills editorial pass (Đợt 2)**: added Light/Standard/Deep delegation tiers and a mode matrix; replaced numeric quality scoring with severity verdicts (PASS = no Critical, no High, at most one Medium); renamed the implementation agent payload to `implementer` and aligned migration-manifest, Codex, and OpenCode mappings; made inspect internal-only with related ext/Gemini cleanup; removed unsourced domain percentage claims.

## [0.15.2] - 2026-07-29

### Fixed
- Native Windows Codex hooks now use a cmd-safe launcher bound to the canonical project hook path at install time. It needs no Git, works from nested directories, and rejects nested hook shadowing, removing the repeated `SessionStart`, `UserPromptSubmit`, and `PreToolUse` exit-code-1 errors.
- Native Windows skill setup now invokes npm/npx `.cmd` through `%ComSpec%` for package and browser dependencies, and surfaces the useful failure code when a command still fails.
- Installer UI now pins the CommonJS-compatible Clack line, restoring the declared Node 18 compatibility contract.

## [0.15.1] - 2026-07-29

### Changed
- Release metadata bumped to `0.15.1` after validating the published `0.15.0` Claude Code and Codex CLI install surfaces; no installer or runtime behavior changed in this version-only update.

## [0.15.0] - 2026-07-29

### Added
- Native Codex CLI install surface: `.agents/skills`, `.codex/agents/*.toml`, project lifecycle hooks/rules/scripts/references/runtime, and a managed CafeKit block in root `AGENTS.md`; invoked with `$hapo-*` or `/skills`, with no generated project `config.toml`.

### Changed
- Installer supports Claude Code, Codex CLI, and OpenCode coexistence. Codex ownership and rollback span `.codex/` + `.agents/`; same-version runs selectively refresh pristine files, preserve user edits, and reserve full reset for explicit `--force-overwrite`.

### Fixed
- Codex privacy tokens are one-use and exact-set-bound across session/tool/canonical sensitive paths, including native patch and move inputs.
- Codex state/lock/archive data is isolated per hashed session ID; malformed managed `AGENTS.md` markers preserve user bytes.

### Verified
- Package tests and a real Codex CLI 0.145 sandbox passed native skill, custom-agent, hooks/state, and privacy-block flows.

## [0.14.2] - 2026-07-29

### Added
- Parallel Wave Mode for `hapo:develop` (`--parallel [N]`): dependency-ordered waves, worktree-isolated `god-developer` per task, gate-in-worktree before cherry-pick merge, post-merge wave check, orchestrator-only state sync; sequential default unchanged, runtime escape hatch `develop.parallel` (spec `develop-parallel-wave`).

### Fixed
- Claude installer now manages only a marked block in project-root `CLAUDE.md`, preserves project-owned instructions, and rolls back both overwritten and newly created targets after failure.
- Claude privacy hooks use native `permissionDecision: "ask"` for sensitive direct/Bash access, classify symlink targets first, and avoid duplicate `.env` policy in the inspect hook.
- Spec completion rejects explicit failures, non-zero exits, zero-test receipts, invalid timestamps, and fence-only evidence; reopened tasks are gated again.
- Session state includes tracked and untracked files, including repositories without a first commit.
- Installer no longer resets `locale.responseLanguage` to `en` on non-interactive upgrade (saved-locale restore hoisted above the interactivity check + no-downgrade guard; live regression fixture). Statusline autocompact reserve is proportional to the real context window (1M models no longer treated as 200k).

### Changed
- Slim-flow batch (audit §3.6): specs SKILL diet (~662→≤450), docs-sync banners slimmed (no shouting), routing rules → ambiguous-cases only, inspect internal mode thinned, `## Evidence` canonicalized (legacy aliases parse-only), contract-marker MUST for BE/FE + validator WARN on ≥5-task specs without contracts.
- `spec.{scaffold_guard, completion_gate, tollgate}` documented in runtime.json; Claude reminder honors `tollgate` like OpenCode; dead `useGemini` key dropped; `usage.cjs` OAuth endpoint marked experimental; legacy `Task`-tool prose → `Agent`; `inspector`/`debugger` gain `memory: user`.

### Removed
- Legacy `archive-command/` tree (1,680 dead lines) + vestigial references.

### Added
- Self-test: settings-template ↔ migration-manifest hook consistency check (11 hooks).

## [0.14.1] - 2026-07-17

### Fixed
- Restored `hapo:delegate` (+ Codex/Grok references, routing, installer gitignore hardening) on the release line — present in 0.13.4 but missing from 0.14.0, which was published from `dev` before PR #68 merged.

## [0.14.0] - 2026-07-17

### Added
- **`spec-gate.cjs` (Stop completion gate)**: machine-enforced receipt check when the assistant ends a turn with newly-done tasks (Evidence section + proof, no placeholders, `completed_at` set). First-run seeds cache without blocking; escape hatch `spec.completion_gate: false`. Complements the soft `spec-state` reminder (audit §3.4.1).
- **OpenCode port Option A — spec-workflow enforcement**: `task-scaffold-guard.ts` (block hand-written task files via `write`/`apply_patch`) and `spec-state.ts` (tollgate inject via `chat.message`); installer self-test expects both plugins.
- **First hook behavioral test harness** (`src/claude/hooks/__tests__/`): runs each hook as a real subprocess (stdin payload → exit code / output) via `node --test`, wired into `run-skill-self-tests.mjs`. Covers the two hook-hardening fixes with regression tests proven to fail against the unpatched code.

### Changed
- **`spec-state.cjs` reminder slimmed**: state-change block is compact English only (no red ALL-CAPS / bilingual wall); one-line unchanged path kept. Hard completion enforcement is now the Stop gate.

### Removed
- `generate-graph` and `impact-analysis` skills (unused) + orphaned `scripts/browser-tool.cjs`; routing/manifest/OpenCode wrappers/self-tests cleaned; upgrades remove them from existing installs (PR #66).

### Fixed
- specs `--validate` dispatch off-by-one (Steps 1-7, not 1-8); ui-ux-designer agent dev-path → installed `.claude/skills/` venv path; Gemini model IDs unified on `gemma-4-31b-it` family (runtime.json is the single source); installer `--lang` unknown codes fall back to English; installer settings merge dedupes per command and survives malformed settings.json; `validate-docs.cjs` exits 1 on broken links; spec validator verifies every tagged contract block per task (PR #66).
- Document-skill attribution restored to Anthropic (`pdf`/`pptx`/`docx`/`xlsx` frontmatter author); `frontend-design` license line corrected to MIT, removing a dangling `LICENSE.txt` reference (PR #67).
- OpenCode `session.ts` compaction banner + `AGENTS.md` map Claude `AskUserQuestion`/`TodoWrite`/`Task` to OpenCode built-ins (`question`/`todowrite`/agent-subtask) instead of instructing unavailable tools.

### Fixed — Hook hardening
- **`session.cjs` env escaping**: `writeEnv` now escapes `\ $ \` "` (was `"` only), so an attacker-influenced value flowing into `CLAUDE_ENV_FILE` (e.g. a git branch named `` evil$HOME-x`pwd` ``) can no longer expand or execute when the env file is sourced. Matches the canonical `escapeShellValue` semantics in `lib/config.cjs`.
- **`privacy-block.cjs` symlink bypass**: the sensitive-file gate now resolves symlink targets via `fs.realpathSync` and checks both the requested name and its real target, closing the bypass where a harmless-looking symlink (e.g. `notes.txt` → `.env`) slipped past the basename check. Exemptions (`.env.example`) still win on either name; fail-open when the path cannot be resolved.

## [0.13.4] - 2026-07-15

### Added
- **`hapo:delegate`**: offload a scoped coding task to Codex or Grok CLI from Claude Code (brief file, sandbox, monitor/resume, independent verify). Wired into skill routing + migration manifest.
- Installer dual-layer gitignore: root ignores `.claude/` and `.opencode/`; in-folder `.gitignore` covers secrets, skill deps, session state, and logs.

### Docs
- CafeKit vs Claude Code audit (2026-07); installer architecture + README gitignore policy.

## [0.13.3] - 2026-06-22

### Added
- Validator placeholder gate for unfilled scaffold stubs (hard-fail on leftover `{{...}}` in task files).

### Changed
- Specs self-tests / Step 7 wording realigned to process-discipline (not token-cut) framing.

## [0.13.2] - 2026-06-21

### Added — Enforce scaffold on task creation
- **`task-scaffold-guard.cjs` (PreToolUse hook)**: hard-blocks any `Write` to `specs/<feature>/tasks/task-*.md`, forcing task files to be generated via `spec-scaffold.cjs` then `Edit`-filled. Fixes the field-test dodge where the model hand-wrote every task file and skipped the opt-in scaffold step. Only the `Write` tool on a task-file path is blocked — `Edit`/`MultiEdit`, other `Write`s, and the scaffold script itself are untouched.
- **Safety valves**: fail-open when the scaffold script is missing (no deadlock), an actionable block message with the exact command, and a `.claude/runtime.json` escape hatch (`"spec": { "scaffold_guard": false }`).
- **Validator placeholder gate**: `validate-spec-output.cjs` now hard-fails a task that still has an unfilled `{{...}}` scaffold placeholder (warns on a leftover `.../` path). Fill-side complement to the guard: the hook forces creation via scaffold, this proves the stub was completed.

### Changed
- `settings.json`: guard registered under a dedicated `Write` matcher in `PreToolUse`.
- `migration-manifest.json`: hook declared in `runtime.files` so the installer ships it.
- Specs `SKILL.md` Step 7: scaffold is now mandatory (Write to a task file is blocked), not a suggestion.

### Notes
- Buys process discipline and consistent `task_registry`/`task_files`, not a large token reduction — task content is still emitted via `Edit`.

## [0.13.1] - 2026-06-21

### Added — Specs v2 (quality + grounding + output-cost)
- **Layer 2 grounding (`spec-ground.cjs`)**: new deterministic check that greps the real work tree to verify every `Related Files` path a task cites (Modify/Delete/Read) exists, or is Created earlier in the spec. Closes the gap where the structural validator checks spec *shape* but is blind to phantom file paths. Active-grep (not opt-in). Wired into Step 8.5 + the `--validate` gate. `--root` for monorepo/sibling-project specs.
- **Spec scaffolding (`spec-scaffold.cjs`)**: generates spec.json + doc templates + task stubs so the model Edit-fills placeholders instead of hand-Writing whole files (the dominant output-token cost). `--tasks-only` merges task stubs + task_files/task_registry into an existing spec without overwriting filled tasks. Wired into Step 7.
- **Execution Tier (Light/Standard/Deep)**: auto-scales research/discovery/review depth by complexity so small specs skip full-pipeline overhead. Recorded in `spec.json.design_context.execution_tier`. Quality floor (scope_lock, EARS, Layer 1 + Layer 2) never skips.
- **Evidence-gated red-team**: `review.md` Step 5.5 auto-rejects findings that don't cite a concrete task/section or verbatim quote (spec-level analogue of ck-plan's `file:line` gate).
- **Definition of a Complete Task (DoCT)**: explicit quality bar in SKILL.md mapping each completeness element (real paths, contract, measurable acceptance, real evidence commands, reachability, requirement mapping) to its enforcing mechanism.
- **Frontend Fidelity Rule**: when a frontend task has a provided visual reference (design image, Figma, screenshot, palette, design tokens, style guide), the task MUST reproduce it faithfully — extract concrete values (exact hex, font, spacing, verbatim UI text), state a `match <reference>` constraint, and prove fidelity in Evidence. New components with a reference must cite its tokens; conditional so brownfield reuse is unaffected. (`tasks-generation.md` + DoCT)
- **Complexity Smell Check (by numbers)**: quantitative YAGNI tripwires in scope inquiry (>8 files / >2 new services / >12 tasks → challenge; >15 tasks → split into sibling specs), targeting the mega-spec failure mode. Surfaced for the user to decide (Expand/Hold/Reduce/Split), never silently built. (`scope-inquiry.md` + SKILL.md Step 3)

### Changed — Specs v2
- **Literal `R{N}.{M}` is now the default requirement format** (template + SKILL.md Step 5). Wakes per-criterion coverage (P1d), which the model previously dodged by writing a bare numbered list. NFR section uses literal IDs too.

## [0.13.0] - 2026-06-18

### Changed
- **Specs context optimization (P0 + P1b)**: The `spec-state` UserPromptSubmit hook now emits the full Tollgate block only when spec state (phase + done/total tasks) actually changes; unchanged turns get a one-line reminder, cutting repeated per-turn context (~460 tokens/turn). State fingerprint cached in `.claude/hooks/.logs/tollgate-last.txt` (gitignored, fail-open).
- **Deterministic timestamp check**: `validate-spec-output.cjs` now fails a spec when `timestamps.requirements_done` / `design_done` / `tasks_done` reuse `timestamps.init`, moving a previously prompt-only rule into the hard validator backstop.
- **Per-criterion coverage check (P1d)**: `validate-spec-output.cjs` now verifies acceptance-criterion coverage at sub-level (e.g. `R3.4`), not just the requirement group (`R3`). Enforced only when `requirements.md` declares explicit `R{N}.{M}` literals and tasks use the numeric `_Requirements: x.y_` mapping; specs using the legacy numbered-list format are skipped (no false failures). Closes the "phantom traceability" gap where a task referencing `R3` counted as covering every `R3.x` criterion.
- **SKILL.md de-duplication (#2)**: `specs/SKILL.md` Step 9.5 Finalization Audit and the Pre-Finalization Checklist now split into a "validator-enforced" group (collapsed to one line pointing at `validate-spec-output.cjs`) and a "judgment-only" group the validator cannot see. Removes hand-restated rules that the deterministic validator already hard-fails on; all semantic rules (deletion policy, provider drift, decision propagation, EARS measurability, diagrams) are preserved verbatim. ~290 tokens off the always-loaded skill body with no loss of enforcement.
- **Removed Task Hydration step**: dropped Step 8 (Task Hydration) from the `specs` pipeline and deleted `references/task-hydration.md`. It created session-scoped Claude Tasks that died with the session and were re-derived from task files anyway; `develop` reads task files directly. Pipeline renumbered to 1→7 + Validation (8) + Finalization Audit (8.5) + Completion (9). Removes ~1 step and ~1KB of always-referenced guidance with no loss of source-of-truth (task files + `task_registry` unchanged).
- **Cross-layer contract drift check (#3)**: `validate-spec-output.cjs` can now detect BE/FE/DB contract drift. When `design.md` defines a named contract via `<!-- contract:NAME -->` + a fenced block, every task that declares `Contracts: NAME` must copy that block verbatim; the validator fails the spec on a divergent copy (e.g. `orderId` vs `order_id`) or an unknown contract name. Fully opt-in — specs without contract markers are unaffected. `templates/design.md` documents the syntax. Verified on a synthetic BE+FE fixture (match → PASS, field rename → FAIL, unknown name → FAIL) plus regression on the two real specs (no effect).
- **Merged tasks-parallel-analysis into tasks-generation (A1)**: deleted `rules/tasks-parallel-analysis.md` (~90% a restatement of `tasks-generation.md`'s Parallel Analysis section). Its 3 unique points (env/setup precondition, `(P)` outside checkbox brackets, skip container-only majors) were merged into `tasks-generation.md`. Step 7 loads one fewer rule file; no behavior change.

## [0.12.0] - 2026-06-16

### Added
- **Opt-in rtk token-saver integration** (`specs/rtk-installer-integration`): CafeKit installer now offers an opt-in phase to install the rtk binary and register its official Claude Code PreToolUse hook. Invoked via `--with-rtk` flag or interactive confirmation (defaults to off); non-fatal if rtk is unavailable or installation fails. Token savings apply to Bash command output logged by Claude Code.

## [0.11.7] - 2026-06-03

### Added
- **Version picker on update**: When upgrading, the installer fetches the 5 most recent CafeKit versions from the npm registry and presents an interactive picker. Selecting a different version re-execs `npx @haposoft/cafekit@<chosen>` automatically. Falls back to the classic 3-option menu when offline or registry is unreachable (3 s timeout).

### Changed
- **Skip language prompt on re-install**: Saved locale is read from `.claude/runtime.json`; the language picker is skipped and the stored language is applied silently.
- **Skip platform prompt on re-install**: Installed platform is read from `.claude/cafekit.json` or `.opencode/cafekit.json`; the platform confirmation step is skipped. Fixes a latent bug where the guard used `ctx.isUpdate` before it was set.

## [0.11.6] - 2026-06-03

### Changed
- **Streamlined update flow**: When selecting "Update" in version prompt:
  - Assistant name (addressing) step shows "Keep X / Change?" instead of re-asking
  - Skill dependencies setup still runs for re-installing dependencies
  - Reduces redundant prompts during updates

## [0.11.5] - 2026-06-03

### Fixed
- **Installer version prompt error**: Fixed "select is not a function" error by using `ctx.ui.select()` instead of direct `@clack/prompts` import
- Added missing `versionForceReinstall` translations (en/ja/vi)

## [0.11.4] - 2026-06-03

### Added
- **Interactive version upgrade prompt**: When CafeKit is already installed, the installer now displays:
  - Current version installed
  - Version available to update
  - Interactive options: "Update to X", "Reinstall", "Skip"
  - Clear information about what will happen in each case
- **New version check flow**:
  - Same version: Prompts "CafeKit X is already installed. What would you like to do?" with options to Reinstall or Skip
  - Upgrade available: Shows "CafeKit X → Y: Update available!" with options to Update, Reinstall current, or Skip
  - Downgrade: Warns and asks for confirmation
- **Enhanced installer intro**: Redesigned intro banner with cleaner visual style and description "AI-native development workflow for Claude Code"

### Changed
- **Update check cache TTL**: Reduced from 12 hours to 1 hour for faster detection of new versions

## [0.11.3] - 2026-06-03

### Changed
- **Skill auto-activation metadata**: All 30 skills now declare `user-invocable`, `when_to_use`, `category`, and `keywords` in frontmatter so Claude Code matches user intent to the right skill at startup, matching the reference ClaudeKit schema.
- **Normalized version field**: All skills use `metadata.version` instead of top-level `version` for consistency.
- **Agent activation names**: Agents now reference skills by directory name (`git`) rather than frontmatter name (`hapo:git`) for correct Skill tool resolution.
- **CLAUDE.md**: Skill activation guidance updated to generic "analyze the skills catalog and activate" pattern.
- **`impact-analysis` branding fix**: `name: impact-analysis` corrected to `name: hapo:impact-analysis`.
- **Status line**: Active spec indicator now shows `📋 <slug>` when a spec is `in_progress`, replacing the disabled active-plan lookup.

## [0.11.2] - 2026-06-02

### Added
- **Update check on session start**: `session.cjs` calls the npm registry on each
  new conversation and prints a banner when a newer version is available.
  Result is cached in `.claude/.cafekit-update-cache.json` for **12 hours** to
  avoid spamming the network. Cache file added to `.claude/gitignore`.

## [0.11.1] - 2026-06-02

### Added
- **"Other…" option in language picker**: user can type any language name freely
  (e.g. Korean, French, Spanish). UI installer stays English; the chosen label is
  written to `CLAUDE.md`, `runtime.json` and `settings.json` so the AI responds
  in that language. Separates `ctx.lang` (UI) from `ctx.locale` (AI response).

## [0.11.0] - 2026-06-02

### Added
- **Installer i18n (en / ja / vi)**: language picker as first step; all prompts,
  spinners, summary and next-steps render in the chosen language. Stored in
  `runtime.json`, `CLAUDE.md` (Language Consistency section) and `settings.json`.
- **`--lang <code>`** flag for non-interactive / CI installs.
- **Opt-in skill dependency setup** (`--with-skills-deps`): Python venv + pip,
  skill-local npm, Chromium (chrome-devtools) and Playwright browser (pptx).
  Re-runs now upgrade existing packages (`pip install --upgrade`, `npm update`).
- **Dependency manifests for pdf, docx, pptx skills** so `--with-skills-deps`
  auto-provisions them (previously only ai-multimodal and chrome-devtools).
- **`--help` / `-h` and `--version` / `-v`** flags.
- **Summary surfaces skills needing API keys** dynamically from `.env.example`.
- **Version check before install**: same version → "already up to date" + exit;
  downgrade → confirm or abort; upgrade → proceeds normally.

### Fixed
- **Chromium download** (`chrome-devtools`): switched to puppeteer's own
  `install.mjs` (cache-aware); previous `npx puppeteer browsers install chrome`
  had no such bin and silently failed.
- **Manifest prune**: `removeObsoleteClaudeRuntimeFiles` now also removes the
  deleted files' entries from `cafekit-manifest.json`, preventing zombie entries.
- **Gemini API key prompt removed** (upstream `@google/gemini-cli` was removed).
  `GEMINI_API_KEY` is documented in `ai-multimodal/.env.example` instead.
- **`API keys isolated in .env` next-step line** corrected (no longer valid after
  removing the Gemini prompt).
- Addressing regex upgraded to Unicode `\p{L}` — accepts Japanese, Vietnamese
  and any-script names.
- `CLAUDE.md`/`rules/` no longer force-overwrite user edits (tracked since 0.10.0).

### Changed
- **Addressing label is platform-aware**: "Claude Code will call you…" / "OpenCode
  will call you…" instead of "AI".



### Added
- **Installer i18n (en / ja / vi).** Language is chosen as the first step
  (interactive) or via `--lang <en|ja|vi>`; prompts, milestones, summary and
  next-steps render in that language. Non-interactive defaults to English; an
  unknown code falls back to Japanese. The choice is written to the installed
  `runtime.json` (`locale.responseLanguage`) so the AI responds in it. New
  `bin/lib/i18n.js`. Addressing input now accepts any-script names (Unicode).
- **`--help` / `-h` and `--version` / `-v`** flags so the installer's options
  (`--dry-run`, `--force-overwrite`, `--with-skills-deps`, `--yes`, `--lang`) are discoverable.
- **Summary surfaces skills needing keys**: lists installed skills that ship a
  `.env.example` (e.g. ai-multimodal, devops) so users know to copy it to `.env`.

### Fixed
- **Chromium download for chrome-devtools** now works. The previous
  `npx puppeteer browsers install chrome` invocation failed (puppeteer ships no
  such bin and `--yes` refetched from the registry); switched to puppeteer's own
  `install.mjs` (cache-aware), with `@puppeteer/browsers` as fallback.

### Removed
- **Gemini API key prompt dropped from install.** With gemini-cli gone, the key
  served only the `ai-multimodal` skill — which documents it in its own
  `.env.example`. Users set `GEMINI_API_KEY` there if/when they use that skill,
  instead of being prompted on every install.

## [0.10.2] - 2026-06-01

### Added
- **Opt-in skill dependency setup** (`bin/phases/skills-setup.js`, `bin/lib/skill-deps.js`).
  During install (interactive prompt) or via `--with-skills-deps`, CafeKit can now
  provision the parts a file-copy can't: a Python venv at `<skillsDir>/.venv` +
  `pip install` each skill's `scripts/requirements.txt`, skill-local `npm install`,
  and the Puppeteer Chromium binary. Cross-platform, no sudo, all steps non-fatal.
- **Detect-and-guide for system tools.** Missing `ffmpeg`/`poppler`/`librsvg`/
  `tesseract` and global npm CLIs (agent-browser) are detected and printed with
  per-OS install commands — never auto-installed.
- **Dependency manifests for `pdf`, `docx`, `pptx` skills** (`scripts/requirements.txt`
  and `scripts/package.json`) so their pip/npm deps are auto-installed by the setup
  (previously declared only in SKILL.md prose). Playwright browser is fetched for the
  pptx html2pptx workflow.

### Changed
- **Addressing message is platform-aware**: now reads "Claude Code will call you …"
  (or "OpenCode" for OpenCode installs) instead of "AI".

### Removed
- **Gemini CLI auto-install dropped.** The upstream `@google/gemini-cli` package was
  removed by Google, so the installer no longer attempts to install it. The Gemini
  **API key** prompt remains (SDK-based skills like ai-multimodal read it directly).

## [0.10.0] - 2026-06-01

### Changed
- **Installer rewritten into a phase architecture.** `packages/spec/bin/install.js`
  went from a 1297-line monolith to a thin orchestrator (~150 lines) plus focused
  modules under `bin/lib/` and `bin/phases/` (each ≤ ~265 lines), satisfying the
  project's 200-line guidance. `bin/lib/opencode-install.js` is unchanged and still
  called in the same order.
- **`--upgrade` / `-u` / `-f` / `--force` are now aliases of `--force-overwrite`.**
  Re-running the installer no longer blindly overwrites managed files.

### Added
- **Interactive TUI via `@clack/prompts`.** Installer now renders framed
  intro/outro, a spinner per platform, and `◆/│/└` prompts (`bin/lib/ui.js`,
  `ctx.ui`). Falls back to plain output when piped/CI/`--yes`.
- **`--yes` / `-y` and non-interactive detection.** Piped/CI runs skip prompts
  and use defaults instead of hanging — fixes the previous readline-on-pipe stall
  and makes the installer CI-friendly.
- **Ownership tracking (SHA-256).** Each install records a per-platform
  `<folder>/cafekit-manifest.json` mapping every managed file to its content hash.
  Re-installs classify files as pristine / user-modified / user-created and update
  only what changed (selective merge).
- **User-edit preservation.** Files a user has modified are kept by default and
  reported in the summary; `--force-overwrite` replaces them (a backup is kept).
- **Backup + rollback.** Platform folders and root `CLAUDE.md` / `.gitignore` are
  snapshotted to `.cafekit-backup/<runId>/` before any writes; a mid-install
  failure rolls back to the pre-run state.
- **Process lock.** `.cafekit.lock` prevents concurrent installs; stale locks from
  dead processes are reclaimed automatically.
- **`--dry-run`.** Previews every create/update/preserve decision without touching
  the filesystem.

### Fixed
- **`CLAUDE.md` and `rules/` no longer force-overwrite user edits** on every run
  (latent data loss). They are now tracked; installer-managed content (template +
  addressing section) is re-recorded so upstream updates still propagate to users
  who configured addressing.
- **`.gitignore` over-broad `bin/` rule** unignored for `packages/spec/bin/` so the
  installer's own modules are version-controlled (they were silently untracked).
- Backup copies preserve restrictive file permissions (e.g. `.env` stays `0o600`).
