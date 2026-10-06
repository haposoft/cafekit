# Prompt audit — cấu hình Claude Code của dự án cafekit (2026-10-06)

Diff đề xuất: `plans/20261006-prompt-audit.diff`. Chưa áp dụng thay đổi nào.

## Giả định

- **Phạm vi:** những file được nạp vào phiên Claude Code của dự án.
  - Ở gốc dự án: `CLAUDE.md` và `AGENTS.md` (nạp qua `@AGENTS.md`).
  - Trong `.claude/`: `rules/` (10 file), `skills/*/SKILL.md` (18), `agents/` (14), `output-styles/` (6).
  - Cấp user: `~/.claude/skills/{gpt-image2-skill,herdr-orchestrator}`.
  - Plugin (chỉ báo cáo, không đề xuất sửa): warp, swift-lsp, codex.
  - Các file trong `.claude/` là bản cài giống từng byte với `packages/spec/src/claude/`. Ngoại lệ duy nhất là `chrome-devtools`, nơi installer viết lại đường dẫn. Vì vậy vị trí trong báo cáo ghi theo đường dẫn source, và diff cũng nhắm vào source.
- **Không đọc:** file settings, `.mcp.json`, `~/.claude.json`, `.env`.
  - Không có: `~/.claude/CLAUDE.md`, `rules/`, `commands/`, `output-styles/`. Thư mục `~/.claude/agents/` rỗng.
  - Không đi theo symlink `~/.claude/skills/find-skills`.
  - `~/.claude/skills/synced/`: 27 bản skill do Anthropic đồng bộ, chỉ liệt kê, không audit.
- **CLAUDE.md lồng trong cây:** `sample/`, `packages/spec/`, `packages/spec/src/claude/` (template), `evals/research/fixtures/…` (fixture eval) và `packages/spec/.cafekit-backup/` (bản sao lưu) chỉ được nạp khi làm việc trong các thư mục đó. Lần này chỉ liệt kê, không audit sâu.
- **Model đích:** `claude-opus-5-5`, là model đang chạy audit. Agent nào ghim model riêng thì được audit theo model đó: haiku có deployer, docs-keeper, git-ops, inspector, project-manager, test-runner; sonnet có debugger, implementer, ui-ux-designer; fable có strategist.
- **Không kiểm chứng được:** đường dẫn `.claude/skills/.venv` trong `CLAUDE.md`, vì hook `inspect-block` chặn mọi thao tác dò `.venv`. Mình tôn trọng ranh giới đó và không tìm đường vòng.

## Tóm tắt

Phát hiện nặng nhất nằm ở **Nhóm 2**: file cấu hình nói những điều repo đã thay đổi, hoặc hai file nói ngược nhau.

1. **Luật cũ trong agent mâu thuẫn với rule mới hơn.**
   - `implementer` tự commit kèm mã task, trong khi rule mới yêu cầu có phép của user và cấm đưa mã task vào commit.
   - `implementer` bọc try/catch quanh mọi lệnh gọi, và bắt chia file khi quá 200 dòng.
   - `docs-keeper` bắt chia doc khi quá 800 dòng.
   - Mô tả của `git-ops` tự kích hoạt sau mỗi lần sửa xong. `ai-dev-rules` và `skill-workflow-routing` mới hơn đều nói ngược lại.
2. **Hai skill ghi những điều mà chính script của nó phủ nhận.**
   - `ui-ux-pro-max` quảng cáo "10 stacks" nhưng chỉ có `react-native.csv`; nhắc domain `prompt` không tồn tại; khẳng định "dự án chỉ dùng React Native"; dùng đường dẫn `python3 skills/…` không chạy được từ gốc dự án. Mô tả của nó vẫn nhận build và review, trùng vai với `cf:ui-ux`.
   - `chrome-devtools` hướng dẫn `.env` mà không script nào đọc, `--no-compress` không có tác dụng, chạy song song nhưng mọi phiên dùng chung một tab, và một câu bị lặp 11 lần.
3. **Phần lõi nạp mỗi phiên có 2 câu "kích hoạt skill trước khi làm"** (`workflow.md:9`, `ai-dev-rules.md:37-38`, viết ngày 2026-05-17). Hai câu này mâu thuẫn với luật chọn skill theo mức độ trong `skill-workflow-routing.md` (2026-09-01, mới hơn). Ngoài ra, `CLAUDE.md` bảo sửa skill dưới `.claude/skills/`, nhưng trong repo này thư mục đó là bản cài bị gitignore và bị ghi đè mỗi lần cài lại.

Số phát hiện theo nhóm:

| Nhóm | Số phát hiện | Mức độ |
|---|---|---|
| Nhóm 1 (văn bản lỗi thời) | 22 | 1 high (cấp user, flag), 16 medium, còn lại low |
| Nhóm 2 (file giòn, mâu thuẫn, sự kiện cũ) | 37 | 20 high, 9 medium, 8 low/flag |
| Nhóm 3 (mô tả) | 5 | đều medium |
| Nhóm 4 (cấu hình request) | — | Không áp dụng: không có code dựng request. Danh sách agent: 0 cặp trùng, 2 flag mức low |

Không tìm thấy giàn giáo kiểu đời model cũ: không có tên model đã nghỉ hưu, không có "think step by step", không có prefill. Các luật đã được đo bằng eval (mô tả của specs, brainstorm, debug; "never run tests" của code-review; red-before-fix của fix; pre-change run của develop; dòng "Broad questions" của ask; luật commit của git) được giữ nguyên theo danh sách giữ lại (keep list), mục 5 và 6.

## Phát hiện (theo độ tin cậy)

### High

| ID | Vị trí | Bằng chứng | Mẫu | Vì sao lỗi thời | Hành động |
|---|---|---|---|---|---|
| C1 | rules/workflow.md:9 | "Read and activate any CafeKit skill that likely applies before taking action." | G2 mâu thuẫn + G1a "default to tool" | Dòng này viết ngày 2026-05-17. `skill-workflow-routing.md:9-12` (2026-09-01) quy định trả lời thẳng câu hỏi thường và chọn skill theo mức độ cần. Câu cũ đẩy model gọi skill thừa. | rewrite (chỉ đề xuất) |
| C2 | rules/ai-dev-rules.md:37-38 | "Activate relevant skills before specialized work. / If a skill plausibly matches…" | như trên | Cùng mâu thuẫn, cùng ngày. | rewrite (chỉ đề xuất) |
| C3 | CLAUDE.md:11 (khối managed) | "Edit project skills under `.claude/skills/`" | G2 sự kiện thay đổi | `.gitignore:115` bỏ qua `.claude`, và lần cài lại ngày 06/10 đã ghi đè 4 file từng được chép tay. Trong repo này, nơi sửa thật là `packages/spec/src/claude/`. Installer ghi lại khối managed, nên ghi chú phải đặt sau marker END. | add (chỉ đề xuất) |
| A1 | agents/code-auditor.md:156 | "When called from `develop` Step 4 (Quality Gate Auto-Fix)" | G2 sự kiện thay đổi | Mục này đã bị gỡ ở commit 8e8cca65. Quality gate giờ nằm ở `develop/references/quality-gate.md`. | rewrite |
| A2 | agents/ui-ux-designer.md:33 | "trends sourced from Dribbble, Awwwards, Mobbin via the python extractor" | G2 | `search.py` chỉ tìm trong các file CSV có sẵn. | remove |
| A3 | agents/implementer.md:114 | `git commit -m "task(<id>): <title>"` | G2 mâu thuẫn | `parallel-waves.md:37` (mới hơn) chỉ cho commit khi có phép. `review-audit-self-decision.md:45` cấm ghi mã task vào commit. | rewrite (chỉ đề xuất) |
| A4 | agents/implementer.md:31 | "Every async operation has explicit `try/catch`" | G2 mâu thuẫn | `ai-dev-rules.md:16` nói "do not wrap every call in defensive noise". | rewrite (chỉ đề xuất) |
| A5 | agents/implementer.md:26 | "exceeds 200 LOC must trigger a proactive modularization" | G2 mâu thuẫn | `ai-dev-rules.md:23` chỉ chia file khi có ranh giới logic rõ. | rewrite (chỉ đề xuất) |
| A6 | agents/docs-keeper.md:62-66 | "exceeds **800 LOC**, enforce modularity" | G2 mâu thuẫn | `ai-dev-rules.md:24` cấm chia markdown chỉ để đạt giới hạn kích thước. | rewrite (chỉ đề xuất) |
| A7 | agents/git-ops.md:3 | "…or after completing a feature/bug fix." | G2 mâu thuẫn | `skill-workflow-routing.md:28`: "implementation does not authorize commit, push". | rewrite (chỉ đề xuất) |
| A8 | agents/debugger.md:55-58 | "use `repomix --remote <github-repo-url>`" | G2 mâu thuẫn ngay trong file | Dòng 54 (mới hơn) chỉ cho dùng repomix khi đã có phép. | rewrite (chỉ đề xuất) |
| A9 | agents/spec-maker.md:101, agents/implementer.md:82 vs rules/orchestrator.md:71 | 3 bộ từ Status khác nhau | G2 mâu thuẫn | `implementer` dùng `completed`, không phải trạng thái hợp lệ trong `state-sync.md`. Lịch sử git không cho biết bên nào là chuẩn: `orchestrator` cũ hơn, còn 2 agent dùng 2 bộ từ khác nhau. | **flag**: Bro chọn chiều. Diff không có hunk này, chỉ ghi chú. |
| F1 | output-styles/coding-level-2-mid.md:32 | "**MUST** suggest improvements beyond what was asked" | G2 mâu thuẫn | Ngược với `AGENTS.md:6` "Deliver exactly what was asked". Bên mới hơn lại nới lỏng một lệnh cấm. | **flag** |
| F2 | output-styles eli5:23, god:43 (và levels 1-3) | "comment … EVERY single line" / "NEVER add comments" | G2 mâu thuẫn | Ngược với `ai-dev-rules.md:18`. Có thể lan sang code ghi ra file vì `keep-coding-instructions: true` (suy luận). | **flag**: giới hạn luật cho code hiển thị trong chat |
| K1 | skills/ui-ux-pro-max/SKILL.md:443, :471 | `--domain prompt` | G2 | `CSV_CONFIG` chỉ có 11 domain, không có `prompt`. Mình đã tự kiểm lại. | remove |
| K2 | ui-ux-pro-max/SKILL.md:3, :14 | "across 10 stacks" | G2 | `data/stacks/` chỉ có `react-native.csv`. Mình đã tự kiểm lại. | rewrite |
| K3 | ui-ux-pro-max/SKILL.md:365, :445-451, :540 | "React Native (this project's only tech stack)" | G2 (sự kiện của dự án upstream) | "This project" là dự án cài CafeKit, phần lớn là web. | rewrite |
| K4 | ui-ux-pro-max/SKILL.md:3, :18-52 | "Actions: plan, build, … review, fix…"; "Must Use…" | G3 trùng công cụ + G2 mâu thuẫn | Commit 8a7c1b47 đã thu hẹp `when_to_use` thành chỉ tra cứu. `ui-ux-skill.test.js:81` ghi chính lỗi trùng vai này. | rewrite (chỉ đề xuất) |
| K5 | ui-ux-pro-max/SKILL.md:314-337 và mọi lệnh `python3 skills/…` | `python3 skills/ui-ux-pro-max/scripts/search.py` | G2 + mâu thuẫn | Đường dẫn không chạy được từ gốc dự án. `CLAUDE.md:12-14` yêu cầu dùng venv của skill. | rewrite (chỉ đề xuất). Nếu chưa chạy `--with-skills-deps` thì venv không có. |
| K6-K10 | skills/chrome-devtools/SKILL.md:285-318, 210-215, 359, 55-56, 469-487 | thư mục tmp và import, `.env`, `--no-compress`, chạy song song, `--timeout` | G2 | Chính các script của skill nói ngược. `--no-compress` còn là bug trong `screenshot.js:165`, nằm ngoài phạm vi prompt. | rewrite |
| K-H11 | chrome-devtools/SKILL.md:171-179 vs rules/process-management.md | "port 3000 is busy, find an available port" | G2 mâu thuẫn | Rule mới hơn: dừng tiến trình cũ chứ không đổi cổng. Sửa theo rule thì phải thêm một hành động dừng tiến trình. | **flag** |
| K-H12 | skills/code-review/SKILL.md:65-74 | object chứng thực Strict của reviewer | G2 | `validate-spec-output.cjs:2472` đã gỡ Strict, `installer-architecture.md:250` ghi rõ việc này. Xoá đoạn này là nới lỏng một yêu cầu bằng chứng. | **flag** |
| U-conflict | ~/.claude/skills/herdr-orchestrator:36, :18, :14 vs orchestrator.md, CLAUDE.md | "never through the CLI's own in-process sub-agents"; "never pick a model"; "no task-file edits" | G2 mâu thuẫn giữa project và cấp user | Không file nào trong project được dùng làm lý do để sửa file cấp user. | **flag**: Bro quyết luật nào thắng khi chạy trong Herdr |

### Medium

| ID | Vị trí | Bằng chứng | Mẫu | Hành động |
|---|---|---|---|---|
| C4 | AGENTS.md:37-47 | Mục Commands, Do not touch, Slow or expensive bỏ trống | Keep list 11 (bổ sung ngữ cảnh) | add sau marker END: lệnh test, `.claude/` là bản cài, `evals/run.sh` tốn tiền |
| A10–A20 | agents: git-ops:8-10, debugger:11/26/125-126, implementer:13-21, code-auditor:26-52, docs-keeper:12/71, project-manager:3/48, spec-maker:20/61, inspector:49 | các dòng IMPORTANT/CRITICAL/MANDATORY/EXTREME SPEED; ví dụ hội thoại trong description; đường dẫn `skills/specs/…`; thiếu `path:line` | G1a, G1d, G3, G2 | rewrite/remove (xem diff) |
| S1–S6 | output-styles (6 file) | header MANDATORY/FORBIDDEN; giới hạn số dòng; câu check-in tiếng Anh cố định; câu chặn tóm tắt ở level god; câu khen mẫu; khung trả lời bắt buộc | G1a, G1b/f, G1c, G1d | rewrite |
| K11–K13 | chrome-devtools | câu lặp 11 lần; thư mục screenshot lệch nhau; IMPORTANT không kèm lý do | G1c, G2, G1a | remove/rewrite |
| K14 | code-review/SKILL.md:33 | `assurance_level` | G2 (chỉ có ở packet legacy) | rewrite |
| K15 | agent-browser/SKILL.md:239 | `wait url` | G2 (dòng 138 ghi `wait --url`) | rewrite |
| K16 | ui-ux-pro-max/SKILL.md:367, 491 | "(REQUIRED)", "Always start with `--design-system`" | G1a + G1c | rewrite |
| K17 | ui-ux/SKILL.md:3 | khoảng 25 cụm kích hoạt; 'ecommerce' ngược với "storefronts not covered" | G2 liệt kê trigger | rewrite. Skill vendored từ upstream, nên gửi lên upstream và đo trigger trước/sau. |
| K18–K19 | web-testing/SKILL.md:29-37, 92-102 | bảng mô hình test và yaml CI chung chung | G2 SKILL.md dài | rewrite thành con trỏ / remove |
| U1 | ~/.claude/skills/gpt-image2-skill:3 | "Use whenever … design" | G3 trigger quá mạnh | rewrite (**ảnh hưởng mọi dự án**) |
| U2–U4 | ~/.claude/skills/herdr-orchestrator:3, 14, 176-178 | câu hành vi trong description; "not a special mode" | G3; G1d | remove/rewrite (**ảnh hưởng mọi dự án**; file nằm trong repo `~/.hod/skill`) |

### Low / flag (không có trong diff)

- **CLAUDE.md:12-14:** đường dẫn venv. Không kiểm được vì hook chặn.
- **CLAUDE.md:15:** câu "Consult … rules" thừa, vì rule đã tự nạp. Thuộc dạng trùng lặp vẫn hoạt động.
- **rules/orchestrator.md:** bảng "Prompt Engineering for Subagents" là lời khuyên chiến lược; câu "check available CPU/memory" không có cơ chế nào làm.
- **rules/manage-docs.md:16:** "check its last modified date" không có cơ chế kiểm tra.
- **agents:**
  - Phần phương pháp của debugger lặp `cf:debug`, nhưng hai bản khớp nhau.
  - Caps của inspector.
  - `src/` bị ghi cứng.
  - Luật "Read > 800 lines".
  - Danh sách agent: spec-maker, project-manager và git-ops không được gọi ở đâu; ui-ux-designer trùng vai `cf:ui-ux`.
  - Một số agent có `memory:` (suy luận: có thêm quyền ghi).
- **skills:**
  - ui-ux có lịch sử, câu "luật cũ" và caps (vendored).
  - git:34 vs :96 về force-push.
  - Câu legacy ở test:189.
  - Số liệu bên ngoài của agent-browser.
  - orca liệt kê trigger (cố ý).
  - web-testing trùng cf:test.
  - 2 checklist của ui-ux-pro-max.
- **Cấp user:** herdr dài, lặp và ghim version; gpt-image2 liệt kê trigger, có khẳng định bên ngoài, và mâu thuẫn `/tmp`.

## Plugin (chỉ báo cáo)

- **warp, swift-lsp:** không có skill, command hay agent.
- **codex 1.0.6:**
  - `agents/codex-rescue.md:3,17,34` có "Proactively use…", "Do not wait for the user…" và mặc định `--write`. Điều này đi ngược GATE-SCOPE/REVIEW và luật chỉ bắt đầu triển khai qua `/cf:develop`.
  - `codex-result-handling` có "CRITICAL … MUST".
  - Tên model bị ghim: `gpt-5.4`, `gpt-5.3-codex-spark`.
  - Tool không còn tồn tại: `BashOutput`.

## File sạch

- **Skill:** ask, brainstorm, debug, develop, fix, research, scout, specs, sync.
- **Agent:** brainstormer, researcher, strategist, test-runner, deployer.
- **Rule:** hook-protocols, state-sync, process-management, review-audit-self-decision, skill-domain-routing, skill-workflow-routing. Ngoại trừ phần mâu thuẫn đã ghi ở C1–C2, nằm ở rule khác.

## Kiểm chứng sau khi áp dụng

- Sau khi sửa file nguồn, chạy `pnpm --dir packages/spec test` và các node test. Các câu trong rule và agent có test ghim chữ, ví dụ mục orchestrator 4670-4676 và 5300-5307. Không hunk nào trong diff đụng các cụm bị ghim, theo lần grep của agent con. Mình chưa grep mọi chuỗi.
- Sửa mô tả skill (K4, K17, U1) có thể đổi cách định tuyến. Nên chạy eval trigger trước và sau khi sửa, theo luật C2.
