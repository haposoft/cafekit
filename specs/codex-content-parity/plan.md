# codex-content-parity: bản cài Codex nói và làm đúng như bản Claude
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ. Trích dẫn chạy lại trên `97816221`.

## Scope decision (GATE-SCOPE — 2026-10-16)
- Existing (audit parity 16/10, ba reviewer cài thật vào thư mục tạm; ba reviewer plan 16/10):
  - Agent Codex: `convertCodexAgentContent` chỉ xuất `name`, `description`, `developer_instructions` (+ `model_reasoning_effort` cho strategist) (`bin/lib/codex-install.js:359-389`); dòng `tools:` của Claude bị bỏ (`src/claude/agents/brainstormer.md:3`, `code-auditor.md:3`, `researcher.md:3`, `inspector.md`). Binary codex 0.162.1 có `sandbox_mode` trong bộ nhập agent và trong câu quyền "`sandbox_mode` is `read-only`" (reviewer đọc strings 16/10), chưa chạy thật. Bốn agent read-only không cần ghi file theo nguồn (`researcher.md:11`, `brainstormer.md:56`).
  - Skill Codex: frontmatter giữ `when_to_use` nhưng binary codex không có chuỗi này. Codex cài 18 skill; mọi skill có `when_to_use` nối vừa 1024 trừ `brainstorm` (857 + 200); `ui-ux` thành 976. Ba skill để `description` không ngoặc (`agent-browser`, `chrome-devtools`, `web-testing`). Ask nối câu ranh giới và chặn > 1024 (`codex-install.js:331-336`); `codex-ask-projection.test.js:22-26,36-41` và `codex-research-projection.test.js:28-35` so bản có và không có `sourcePath`. Catalog nối ` Use: <when_to_use>` sau description (`src/claude/scripts/generate-skill-catalog.cjs:195`).
  - Rule Codex: AGENTS block chỉ trỏ 6 rule (`src/codex/AGENTS.md:10-21`); bốn rule `workflow`, `ai-dev-rules`, `orchestrator`, `manage-docs` được cài nhưng không ai trỏ. `orchestrator.md:97` hứa strategist "runs … on the strongest available model". `hook-protocols.md` hai bản lệch câu malformed; Claude gitignore thiếu `!.env.sample`, `!.env.template`, `*.tmp`.
  - Bộ chuyển đổi: Team protocol trong `src/claude/agents/git-ops.md:10-18` và `project-manager.md:55-63` (heading cuối file) chỉ bị đổi chữ thành `send_message(type`, `task-state inspection` (`codex-install.js:44-48,307-308`); `git-ops.md:15` và `project-manager.md:57-58` là luật không thuộc Team. `.claude` → `.codex` và `CLAUDE.md` → `AGENTS.md` (`codex-install.js:255-260,319-320`) làm trùng danh sách hai host (`git/SKILL.md:27`, `git/references/worktree-blueprint.md:50,73,78`, `ask/SKILL.md:65`, `docs/references/init-workflow.md:17`); `worktree-blueprint.md:22` là đường riêng Claude `.claude/worktrees/`. `normalizeRuntimePaths` chạy cả trên `.cjs`/`.py` (`codex-install.js:317-323`). `AskUserQuestion` → "structured user-input request" (`codex-install.js:211-247`), ghim ở `codex-native.test.js:826-829,1380-1435,1490-1520`, trong khi note specs cấm `request_user_input` (`codex-install.js:22`); `brainstorm/references/question-framework.md:150` nhắc "native input tool". "Claude Code" → "Codex CLI" tạo "Codex CLI's own worktree" (`codex-install.js:320`, `git/SKILL.md:27`). Usage catalog in ".agents/skills for Claude" (`generate-skill-catalog.cjs:30`).
  - Installer: copy cây `src/codex/hooks` chép 7 shim rồi `writeSourceFile` ghi đè (`bin/phases/codex-runtime.js:85-153`); 4 shim một dòng, 3 shim có `'use strict'` (`privacy-command-analysis`, `runtime-path-safety`, `spec-touch`). Rule Codex ghi hai lần (`codex-runtime.js:201-203`); `copyRulesDirectory` dùng chung (`claude-runtime.js:261-277`); `src/codex/rules/state-sync.md` giống hệt bản Claude và được self-test đọc (`scripts/run-skill-self-tests.mjs:2881,2897,5084-5092`). `usage.enabled` trong `src/claude/runtime.json:29`; schema giữ node deprecated (`runtime-schema.test.js:89`). `scripts.required` không được installer đọc nhưng self-test đọc (`run-skill-self-tests.mjs:5193`). `ai-multimodal` tìm `scripts/resolve_env.py` không bao giờ được cài (`check_setup.py:88-93`, `gemini_batch_process.py:30,79,93`).
  - Obsolete: xoá `obsolete.runtimeFiles` không kiểm hash và đi theo symlink (`claude-runtime.js:167-191`, `codex-runtime.js:34-46`); danh sách có cả thư mục (`skills/generate-graph`, `skills/impact-analysis`). Test ghim hành vi xoá file đã sửa hoặc không có trong tracker: `legacy-hooks-retired.test.js:85-103,115-141`, `codex-native.test.js:2290-2305,3120-3140`, `usage-hook-retired.test.js:78`, self-test `run-skill-self-tests.mjs:5768-5812`; self-test ghim chữ `rmSync` (`run-skill-self-tests.mjs:5207-5210`).
  - Anchor compact: Claude ghi `compact-recovery.json` chung (`src/claude/hooks/precompact.cjs:28`, `session.cjs:194`; ghim ở `run-skill-self-tests.mjs:5067-5073`, `precompact.test.js:257`); Codex ghi theo sha256 phiên (`src/codex/hooks/precompact.cjs:34-35`).
  - `packages/spec/CLAUDE.md`, `packages/spec/AGENTS.md`: git theo dõi, không ship npm (`package.json:17-20`).
- Minimum change: sửa D1–D7, anchor compact, các mục L sửa được, hai file cũ.
- Expansion signals: khoảng 35 file, một đường giao (npm) → 7 task tuần tự.
- User decision (16/10): **KEEP**.
  - Read-only trên Codex: brainstormer, code-auditor, inspector, researcher.
  - Xoá `packages/spec/CLAUDE.md`, `packages/spec/AGENTS.md`.
  - File obsolete người dùng đã sửa: giữ và cảnh báo cho mọi file, kể cả hook legacy (GATE-REVIEW G1 đảo quyết định gỡ hẳn của gói dọn hook).
  - Probe Codex thật: `CODEX_HOME` tạm trong scratchpad, chép `auth.json` không in nội dung, xoá sau probe.
  - Người thực thi: Codex (pane Orca). Phiên Claude điều phối, chạy probe, ghi Status/Receipt.

## Out of scope
- Lệnh uninstall; PATH dự phòng cho launcher hook Claude.
- Khác biệt cố ý (I): privacy `ask` và `deny` + token; agent `.md`/TOML, `model`/`memory`; `/cf:x` và `$cf-x`; output-style/statusline và `codingLevel`; đường dẫn tuyệt đối trong `hooks.json`; ba note Codex.
- `docs-sync.cjs`: skill docs và omp gọi tay (`src/claude/skills/docs/SKILL.md:128`, `src/omp/extensions/cafekit-bridge.mjs:41`).
- Đo lại eval định tuyến Codex; dọn file anchor cũ.
- Khôi phục `## This repository` trong `AGENTS.md`/`CLAUDE.md` gốc repo; hai file đó không vào commit của gói.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | TOML của `brainstormer`, `code_auditor`, `inspector`, `researcher` có `sandbox_mode = "read-only"`; agent khác không đổi | Mọi agent không có Edit/Write; chỉ brainstormer | Quyết định của Bro | Codex 0.162.1 áp `sandbox_mode` của agent TOML | Probe task-01 không chứng minh được agent đã chạy, hoặc agent read-only vẫn ghi file → task `blocked`, báo Bro |
| D-02 | Codex: mọi nội dung có frontmatter `when_to_use` (không phụ thuộc `sourcePath`) nối `description` + ` Use when: ` + `when_to_use` khi tổng ≤ 1024, ghi lại bằng `JSON.stringify`; vượt thì giữ nguyên. Áp trước câu ranh giới ask. Catalog Codex bỏ phần ` Use:` khi description đã chứa `when_to_use` | Dòng trong thân; theo path | Định tuyến đọc `description`; giữ test projection | Codex chọn skill theo `description` | — |
| D-03 | `src/codex/AGENTS.md` trỏ đủ 10 rule. Đoạn Model Escalation của orchestrator trên Codex đổi qua bộ chuyển đổi: strategist chạy reasoning effort cao trên model của phiên trừ khi cấu hình chọn khác; bỏ mốc "below `fable`" | File override | Một nguồn; khớp runtime note strategist (`codex-install.js:372-373`) | — | — |
| D-04 | Hai `hook-protocols.md`: `If hook output is malformed, stop and report the exact failure instead of guessing.`; Codex thêm trỏ `state-sync.md`. Claude gitignore thêm `!.env.sample`, `!.env.template`, `*.tmp` | Giữ lệch | Câu đích kiểm được | — | — |
| D-05 | Codex chỉ bỏ các dòng Team nhắc `TaskList`/`TaskGet`/`TaskUpdate`/`SendMessage`/`shutdown_request` và câu dẫn "When instantiated as a team member" / "When triggered as an active teammate"; giữ `git-ops.md:15` và `project-manager.md:57-58` | Cắt cả mục | Không mất luật không thuộc Team | — | — |
| D-06 | Chỉ với nội dung `isInstructionAsset` (đường dẫn rỗng tính là instruction): danh sách nêu cả hai host (`.claude` cạnh `.codex`, `CLAUDE.md` cạnh `AGENTS.md`) giữ nguyên tên host Claude; đường dẫn một host trên cùng dòng vẫn được đổi. Nguồn Claude: "Claude Code's own worktree" → "the host's own worktree"; `worktree-blueprint.md:22` viết trung tính về host | Bỏ qua cả dòng | Sửa gốc lỗi, không làm lố | — | — |
| D-07 | Codex: `AskUserQuestion` và "native structured user-input tool"/"native input tool" thành cụm danh từ "a question in the turn's final answer" (giữ logic mạo từ); không nhắc `request_user_input` | Cụm động từ; giữ chữ cũ | Khớp note specs | — | — |
| D-08 | Shim = file chỉ có (tuỳ chọn `'use strict';`) và `module.exports = require('../../../claude/hooks/lib/<cùng tên>')`. Installer Codex không chép shim trong copy cây, chỉ ghi bản Claude một lần, danh sách suy ra từ shim. Chỉ Codex: `copyRulesDirectory` bỏ qua tên có trong `src/codex/rules`; xoá `src/codex/rules/state-sync.md`, self-test đọc bản Claude | Giữ ghi hai lần | Cài đè y nguyên không báo lib/rule cập nhật | — | — |
| D-09 | `obsolete.runtimeFiles`: `lstat`/`assertNoSymlinkPath` trước mọi bước, symlink → giữ + cảnh báo. File chỉ xoá khi tracker có hash và khớp. Thư mục chỉ xoá khi mọi file trong đó có hash khớp và không có file lạ. Phần giữ lại: một dòng cảnh báo gộp mỗi lần cài, nêu số mục và cách tự xoá; không prune tracker | Xoá như cũ; trừ hook legacy | Quyết định của Bro (G1) | Tracker ghi sha256 file đã cài | — |
| D-10 | Bỏ `usage` khỏi `src/claude/runtime.json` (giữ node schema); bỏ `scripts.required` khỏi manifest và probe self-test đọc nó; bỏ nhánh `resolve_env.py` trong `ai-multimodal`, giữ đường dự phòng | Cài thêm `resolve_env.py` | Không có nguồn để cài | — | — |
| D-11 | Claude anchor compact `compact-recovery-<sha256(session_id) hex>.json` dưới `hookStateDir`, như Codex; không có `session_id` thì không ghi | Giữ file chung | Hai phiên không đè anchor của nhau | — | — |

## Known limitations
- `brainstorm` trên Codex không có `when_to_use` trong `description` (vượt 1024); trần 1024 của Codex là giả định kế thừa từ nhánh ask, chưa thấy trong binary.
- Đổi `description` Codex có thể đổi tỉ lệ gọi skill; gói này không đo lại eval.
- Read-only trên Codex cũng tắt mạng của shell (researcher không `curl` được; web search native vẫn chạy); ở chế độ `on-request` agent con có thể xin leo quyền và người dùng duyệt. `sandbox_mode` chỉ probe trên codex-cli 0.162.1.
- Bản cài cũ không có manifest/hash: mọi mục obsolete còn trên đĩa bị giữ, mỗi lần cài in một dòng cảnh báo gộp.
- File anchor theo phiên tích tụ trong `.logs`, như Codex.
- Catalog đọc `description` đã `JSON.stringify` không giải mã escape: skill có dấu `"` (ví dụ `orca`) hiện `\"` trong catalog Codex.
- Bản copy `.claude/`, `.codex/`, `.agents/` gốc repo bị gitignore; sau GATE-DONE nên cài lại bằng installer.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Agent review/tra cứu trên Codex không ghi được file | fix | agent TOML, Codex host | none (D-01) | elevated; host chưa thử | unit TOML + probe Codex có bằng chứng chạy và đối chứng dương |
| CP-02 | Codex thấy "khi nào dùng" của skill | fix | SKILL.md Codex, catalog | none (D-02) | elevated (định tuyến, YAML) | test projection |
| CP-03 | Codex đọc đủ rule, không hứa sai model; rule/gitignore khớp; hai file cũ biến mất | fix + remove | AGENTS Codex, rules, gitignore | none (D-03, D-04) | routine | test cài + kiểm file |
| CP-04 | Văn bản Codex không nhắc tool không có, không trùng host, hỏi người dùng nhất quán | fix | bộ chuyển đổi, nguồn skill | none (D-05–D-07) | elevated | test projection + codex-native |
| CP-05 | Installer ghi mỗi file một lần, không còn cấu hình chết | fix | codex-runtime, manifest, runtime.json, ai-multimodal | none (D-08, D-10) | elevated | test installer + hook Codex |
| CP-06 | File obsolete đã sửa, thư mục lạ, symlink được giữ kèm cảnh báo | fix | claude-runtime, codex-runtime | none (D-09) | critical (xoá file người dùng) | test installer hai host |
| CP-07 | Anchor compact Claude theo phiên | fix | precompact, session Claude | none (D-11) | routine | test precompact + orca-session |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When Codex agents are installed, brainstormer, code_auditor, inspector and researcher shall carry `sandbox_mode = "read-only"`, and a live Codex subagent from the installed file shall prove it ran yet fail to create a file that the same agent without the key creates. | task-01 Command + probe |
| AC-02 | When a skill with `when_to_use` is converted for Codex, its description shall end with `Use when: <when_to_use>` and parse as a JSON string whenever the total fits 1024; the Codex catalog shall not repeat it. | task-02 Command |
| AC-03 | When Codex is installed, AGENTS.md shall name all ten installed rules, orchestrator shall not promise the strongest model, both hook-protocols shall share the malformed-output sentence, Claude gitignore shall carry the env exceptions; `packages/spec/CLAUDE.md` and `AGENTS.md` shall not exist. | task-03 Command |
| AC-04 | When Claude text is converted for Codex, it shall contain no Team tool protocol yet keep the non-Team rules, no duplicated host list, no `AskUserQuestion`, structured user-input or native input tool wording, no "Codex CLI's own worktree", and the catalog usage shall name the right root per host. | task-04 Command |
| AC-05 | When Codex is reinstalled over an identical install, no lib or rule line shall be reported updated and no installed lib shall be a shim; runtime.json and manifest shall carry no `usage` or `scripts.required`. | task-05 Command |
| AC-06 | When an obsolete runtime entry is user-modified, untracked, a symlink, or a directory with a foreign or modified file, both hosts shall keep it and print one aggregated warning; an unmodified tracked entry shall be removed. | task-06 Command |
| AC-07 | When Claude PreCompact runs for two sessions, each shall keep its own anchor and SessionStart compact shall print only its own. | task-07 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Agent Codex read-only | P1 | AC-01 | `bin/lib/codex-install.js` (agent), `codex-native.test.js` | - | pending |
| 02 | `when_to_use` cho Codex | P1 | AC-02 | `bin/lib/codex-install.js` (skill), catalog, `codex-projection-parity.test.js` | task-01-codex-agent-sandbox.md | pending |
| 03 | Rule Codex đủ, rule/gitignore khớp, xoá file cũ | P1 | AC-03 | `src/codex/AGENTS.md`, rules, gitignore | task-02-codex-when-to-use.md | pending |
| 04 | Bộ chuyển đổi văn bản | P1 | AC-04 | `bin/lib/codex-install.js` (body), nguồn skill, `codex-native.test.js` | task-03-codex-rules-reach.md | pending |
| 05 | Installer ghi một lần, bỏ cấu hình chết | P2 | AC-05 | `bin/phases/codex-runtime.js`, manifest, runtime.json, ai-multimodal | task-04-codex-text-converter.md | pending |
| 06 | Obsolete an toàn | P1 | AC-06 | `bin/phases/{claude,codex}-runtime.js` (nhánh obsolete) | task-05-installer-write-once.md | pending |
| 07 | Anchor compact Claude theo phiên | P3 | AC-07 | `src/claude/hooks/{precompact,session}.cjs` | task-06-obsolete-safe-removal.md | pending |

Command chạy từ gốc repo; self-test là `node packages/spec/scripts/run-skill-self-tests.mjs` đặt cuối mỗi Command. Oracle chung: mọi lệnh exit 0; output `node --test` có `# fail 0`, `# skipped 0`, `# todo 0`, và tên từng test mới hiện thành dòng `ok`; self-test in `PASS:`. Chạy tuần tự: task 01, 02, 04 cùng sửa `bin/lib/codex-install.js`, task 01/04/06 cùng sửa `codex-native.test.js`, task 05/06 cùng sửa `codex-runtime.js`; mọi task sửa hai changelog (`CHANGELOG.md`, `../../docs/project-changelog.md`, mục Unreleased). Probe tĩnh trong `scripts/run-skill-self-tests.mjs` chỉ được cập nhật ở dòng task ghi rõ trong Ownership, nêu trong Receipt. Không đưa mã task/quyết định vào tên test, comment hay commit.

## Review log
- 16/10 vòng giấy 1: ba reviewer ngữ cảnh mới (Fact Checker + Contract Verifier; Failure-mode + Assumption destroyer; Security + Scope), cả ba CONCERNS; gộp 15 nhóm. Lệnh Verification gốc đều xanh trên `97816221` (codex-native 36, projection-parity 8, installer-safety 24, precompact + orca-session 23; self-test 2125). Controller chạy lại trích dẫn `legacy-hooks-retired.test.js:85-88`, `run-skill-self-tests.mjs:2881,5067-5073,5193`, `project-manager.md:55` (heading cuối, file 63 dòng): đúng.
- GATE-REVIEW 16/10, Bro chấp nhận cả 15:
  - G1 Critical: giữ + cảnh báo cho mọi file obsolete, sửa 3 test cũ, thư mục xoá khi mọi file khớp (D-09).
  - G2 High: task-05 sở hữu probe self-test `state-sync`/`scripts.required`; giữ node `usage` trong schema.
  - G3 High: D-02 không phụ thuộc path, `JSON.stringify` description.
  - G4 High: task-04 sở hữu `codex-native.test.js`; câu đích dạng danh từ; thêm `question-framework.md:150`.
  - G5 High: task-07 sở hữu probe `compact-recovery` và ca `precompact.test.js:257`.
  - G6 High: probe task-01 có nonce, token chứng minh đã chạy, TOML do installer xuất, oracle rollout con, hai biến thể sandbox.
  - G7 Medium: `umask 077`, `trap`, `cmp -s` trước khi xoá `CODEX_HOME` tạm.
  - G8 Medium: chặn symlink trước khi xoá obsolete.
  - G9 Medium: định nghĩa shim bằng mẫu `module.exports`; chỉ Codex bỏ qua rule; không assert `Updated: 0`.
  - G10 Medium: chỉ bỏ dòng Team, giữ luật không thuộc Team.
  - G11 Medium: oracle task-04 dùng regex trùng thật, cài kèm document skills, `.md` only, dòng 22 trung tính, thêm `init-workflow.md:17`.
  - G12 Medium: Command gom mọi bằng chứng; Oracle chặn skip/todo và đòi tên test mới.
  - G13 Medium: tách task-05 thành 05 (ghi một lần + cấu hình chết) và 06 (obsolete).
  - G14 Low: bỏ dòng dự phòng trong thân; catalog không lặp `when_to_use`.
  - G15 Low: Known limitations read-only; sửa trích dẫn; bỏ câu probe không có ở task-03.
- 16/10 lượt đóng (ngữ cảnh mới, vòng giấy 2): 11/15 PASS; G1, G6, G9, G11 FAIL vì áp chưa đủ, có bằng chứng chạy trên bản cài tạm. Controller áp phần còn thiếu của các mục đã chấp nhận: task-06 sở hữu `usage-hook-retired.test.js:78` và self-test migration fixture (`:5768-5812`); AC-01 bắt buộc rollout thread con; oracle task-05 theo nhãn `↻` thật; task-04 chuẩn hoá khoảng trắng, miễn đỏ-trước cho needle chống hồi quy, D-06 gate bằng `isInstructionAsset`. Thêm giới hạn catalog escape (N5). Dừng vòng giấy theo luật B4; lỗi còn lại cần bằng chứng chạy thật.
