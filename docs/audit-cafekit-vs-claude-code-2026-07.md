# Audit toàn diện CafeKit v0.13.2 — đối chiếu Claude Code 2026

> **Ngày audit:** 2026-07-13 · **Bản audit:** `@haposoft/cafekit` 0.13.2 (branch `dev`, commit `1250304`)
> **Phương pháp:** duyệt 100% package `packages/spec/` (installer 27 file, 10 hooks + 7 lib, 7 scripts, 30 skills, 13 agents, 8 rules, references, archive, OpenCode port) + tra cứu changelog/docs chính thức Claude Code 02–07/2026 + đối chiếu field test v0.13.0 (`notes/v0.13.0-field-test-post-list-screen.md`).
> **Phạm vi:** không gồm `cafekit-web/`.
> **Ghi chú 2026-08-19:** OpenCode đã ngừng được hỗ trợ (gỡ khỏi source sau 0.16.x). Mọi nhắc đến "OpenCode port" trong audit này là lịch sử tại thời điểm audit, không phản ánh trạng thái hiện tại.

---

## PHẦN 1 — GIẢI PHẪU TỪNG THÀNH PHẦN

### 1.0 Bức tranh tổng thể

CafeKit = **1 installer + 1 bộ runtime payload**. `npx @haposoft/cafekit` → copy payload vào `.claude/` (hoặc `.opencode/`). Tổng ~35–40K LOC:

| Khối | Khối lượng | Vai trò |
|---|---|---|
| `bin/` installer | 198 (orchestrator) + 2.855 (lib) + 1.478 (phases) | Cài đặt/upgrade an toàn |
| 30 skills | 7.690 dòng SKILL.md, ~20K+ LOC cả references/scripts | Workflow + domain knowledge |
| 13 agents | 1.375 dòng | Subagent chuyên trách |
| 10 hooks + 7 lib | ~1.500 + 3.000 dòng | Cưỡng chế kỷ luật runtime |
| 7 scripts | ~1.770 dòng | Validator/scaffold deterministic |
| 8 rules + CLAUDE.md | 570 + 130 dòng | Hiến pháp hành vi |
| `status.cjs` | 541 dòng | Statusline đa dòng |
| OpenCode port | AGENTS.md + 7 plugins ~1.440 dòng | Runtime thứ hai |
| Self-test | 1.505 dòng (`run-skill-self-tests.mjs`) | `npm test` |
| `archive-command/` | 1.679 dòng | **Legacy chết** (không được cài) |

### 1.1 Installer (`bin/`)

**Kiến trúc:** `install.js` là orchestrator mỏng chạy tuần tự phase handlers, mỗi phase nhận/trả `ctx`.

```
lock → context/args → chọn ngôn ngữ (en/ja/vi) → chọn platform → check version
→ snapshot backup → [per-platform: copy payload → runtime files → merge settings
→ CLAUDE.md → rules → metadata] → gitignore → post-install (addressing, Gemini key)
→ skills-setup (venv/pip/npm/Chromium, opt-in) → rtk setup (opt-in) → summary → prune backup
```

**4 cơ chế an toàn:**
1. **Process lock** (`.cafekit.lock`) — PID + timestamp, stale-PID reclaim.
2. **Snapshot backup** (`.cafekit-backup/<runId>/`) — crash → restore tự động; giữ 3 bản.
3. **Ownership manifest** (`cafekit-manifest.json`) — SHA-256 mọi file CafeKit ghi; upgrade so 3 hash (đĩa/baseline/payload) → `absent|pristine|user-modified|user-created`; file user sửa được **preserve** mặc định (chỉ đè khi `--force-overwrite`). Đây là điều plugin system không làm được.
4. **`--dry-run`** — preview không ghi.

**Flags:** `--dry-run`, `--force-overwrite` (alias `--upgrade/-u/-f`), `--with-skills-deps`, `--with-rtk`, `--yes`, `--lang`, `--help`, `--version`. Có re-exec khi chọn version khác.

**8 điểm fragile đã xác minh:**
- `bin/lib/i18n.js:373` — `--lang` mã lạ rơi về **ja** thay vì en.
- `bin/phases/claude-settings.js:112` — merge settings dedupe theo **sub-command đầu tiên** → upgrade thêm command vào entry cũ bị nuốt.
- `claude-settings.js:85-88` — user `settings.json` hỏng → throw → abort cả install.
- `install.js:162` — file root OpenCode (`opencode.json`, `AGENTS.md`) **ngoài snapshot** → crash không rollback.
- `opencode-install.js` (866 dòng) — toàn bộ writer OpenCode **bỏ qua ownership model**, không dry-run aware.
- Mất `cafekit-manifest.json` → update thành near-noop (mọi file thành `user-created` → preserve).
- `commands.core: []` → fallback command cũ trong `copy-payload.js:37` là dead code.
- Semver so sánh naive (không prerelease); multi-platform chỉ so version platform đầu.

### 1.2 CLAUDE.md + 8 rules

- **CLAUDE.md** (130): 4 khối hành vi (Think-Before-Coding/Simplicity-First/Surgical-Changes/Goal-Driven), Operating Loop, Definition-of-Done, 7 Non-Negotiable Gates. Dòng 61 chấp nhận tool vắng mặt (fallback markdown). **Addressing canary**: danh xưng cố định làm chỉ báo tràn context.
- **8 rules** (570): `workflow` (`PRECHECK_FAIL` > `NO_TESTS`), `ai-dev-rules`, `skill-workflow-routing` + `skill-domain-routing` (advisory router thay hook router đã gỡ), `orchestrator` (status block DONE/CONCERNS/BLOCKED/NEEDS_INFO), `manage-docs`, `state-sync` (Tollgate 2 lớp), `hook-protocols`.
- **Xác minh:** prefix `hapo:` **nhất quán** giữa skills và rules. Lệch chỉ ở `archive-command/` (legacy) và `impact-analysis` (bug).

### 1.3 Hooks (10) — đọc trực tiếp từng dòng

Tất cả có crash-wrapper **fail-open** (log `hooks/.logs/hook-log.jsonl`).

| Hook | Event | Chức năng |
|---|---|---|
| `session.cjs` (260) | SessionStart `startup\|resume\|clear\|compact` | Detect project/PM/framework; ghi 13 env vars vào `CLAUDE_ENV_FILE`; check update npm (cache 12h); cảnh báo sau compact (re-confirm quyền) |
| `docs-sync.cjs` (103) | SessionStart | Git hash source (exclude docs) vs `docs/.sync_hash` → ép tạo/update docs |
| `state.cjs` (286) | SessionStart + PostToolUse(`Agent\|Task\|TaskCreate\|TaskUpdate\|TodoWrite`) + Stop + SubagentStop | Persist `session-state/latest.md` (todos từ transcript + git modified); archive 5 bản, expiry 7 ngày; inject "Prior Execution Context" |
| `agent.cjs` (106) | SubagentStart `*` | Inject ~100 tok (language/paths/venv) qua `hookSpecificOutput.additionalContext` — đúng schema mới |
| `rules.cjs` (122) | UserPromptSubmit | Inject rules reminder ~250 tok, cooldown 5 phút/session |
| `spec-state.cjs` (135) | UserPromptSubmit | **Tollgate**: fingerprint `phase\|done/total` → không đổi = 1 dòng; đổi = block đỏ ~460 tok (bắt sync spec.json + task md + validator) |
| `usage.cjs` (190) | UserPromptSubmit + PostToolUse(Edit/Write), timeout 30 | Quota từ **OAuth API không chính thức** (`api.anthropic.com/api/oauth/usage`, token từ Keychain/`.credentials.json`) → cache cho statusline |
| `privacy-block.cjs` (179) | PreToolUse(Read/Write/Edit/Bash/Glob/Grep) | 15 pattern nhạy cảm; exempt `.env.example`; block + JSON `@@PRIVACY_PROMPT@@` → AskUserQuestion; Bash warn-allow (đường approved) |
| `inspect-block.cjs` (124) | PreToolUse (cùng matcher) | Chặn `node_modules/dist/.git/...` + broad glob; whitelist lệnh build/PM |
| `task-scaffold-guard.cjs` (91) | PreToolUse(`Write`) | Chặn Write vào `specs/*/tasks/task-*.md` → ép scaffold + Edit-fill. 3 van: fail-open thiếu script; message kèm lệnh; escape hatch runtime.json |

**hooks/lib** (3.000): `config.cjs` 839, `context.cjs` 616, `detect.cjs` 474, `parser.cjs` 182, `git.cjs`, `color.cjs`, `counter.cjs`.
**Chi phí context/turn sau 0.13.0:** thường ~40–60 tok; đỉnh ~700–900 khi state đổi.

### 1.4 Scripts kiểm định (7) — "enforce bằng code, không van xin bằng prompt"

1. `validate-spec-output.cjs` (457) — **Layer 1 structural**: task_files khớp đĩa; registry đủ 8 trường; regex tên task; cấm reuse timestamps; placeholder `{{...}}` = hard fail; coverage `R{N}`/`R{N}.{M}` (sub-criteria opt-in); **contract drift** byte-compare; ≥5 task ⇒ bắt validation review.
2. `spec-ground.cjs` (146) — **Layer 2 grounding**: grep work-tree thật — mọi path Modify/Delete/Read phải tồn tại hoặc được Create trước đó trong spec. Active, không né được. `--root` cho monorepo.
3. `spec-scaffold.cjs` (187) — sinh stub để Edit-fill (chống 935K output tokens). `--tasks-only` merge không đè task đã fill.
4. `generate-skill-catalog.cjs` (180) — catalog từ frontmatter.
5. `validate-docs-reconstruct.cjs` (176) — validate bundle as-is 12 file + evidence ID cross-ref.
6. `validate-docs.cjs` (69) — ⚠️ chỉ check link tương đối, **luôn exit 0** — gate trang trí.
7. `browser-tool.cjs` (138) — ⚠️ **mồ côi** (chỉ trong manifest, không ai gọi).

### 1.5 Skills (30)

**Core workflow (16):** specs (662 — flagship), develop (263), question (167), brainstorm (190), debug (254, diagnostic-only), hotfix (298), test (193), code-review (96, 3-stage, PASS ≥9.5 & 0 critical), git (66), sync (48), docs (269, `--init/--update/--summarize/--reconstruct`), inspect (222), research (58, facade WebSearch), impact-analysis (276 + 6.6K refs), generate-graph (429 + 5K), ai-multimodal (92 + 5K Gemini scripts).

**Khái niệm chính trong `specs`:**
- **SDD**: feature đi qua spec máy-đọc-được trước khi code.
- **Creation Mode**: Auto / Stop-after-Design / Step-by-step.
- **5-dimension**: Intent, Hypothesis, Gap size, **Cynefin** (Clear/Complicated/Complex/Chaotic — Chaotic → hotfix), Blast Radius.
- **Execution Tier** Light/Standard/Deep — quality floor (scope_lock, EARS, L1+L2) không bao giờ skip.
- **scope_lock**: `in_scope/out_of_scope/expansion_policy: requires-user-approval`.
- **EARS**: 5 mẫu câu requirement (When/While/If/Where/shall) + ID literal `R{N}.{M}`.
- **DoCT**: 7 yếu tố task hoàn chỉnh, mỗi yếu tố map tới 1 cơ chế enforce.
- **Red-team evidence-gated**: 4 persona; finding không trích dẫn cụ thể bị auto-reject.
- **Complexity smell**: >8 files/>2 services/>12 tasks → challenge; >15 → bắt tách spec.

**`develop`:** Load (check `ready_for_implementation`) → scout `inspector` bắt buộc → implement (`god-developer`) → Self-Healing Quality Gate (test-runner + code-auditor song song, retry max 3 → COLLAPSE) → **verification receipt** → sync 2 lớp. Modes: Specific-Task / Full-Spec / `--flash` (FLASH_UNVERIFIED) / implementation-notes.

**Domain (14):** backend, frontend-design, frontend-development, react-best-practices (50 rule), ui-ux-pro-max (664 + 1.3MB CSV), mobile, devops, web-testing, agent-browser, chrome-devtools (**4.454 files — commit cả node_modules Puppeteer, ~300MB Chromium**), pdf/pptx/docx/xlsx (**Anthropic stock skills** © 2025 Anthropic bị re-badge `author: haposoft` — vấn đề provenance).

### 1.6 Agents (13, 1.375 LOC)

`god-developer` (sonnet, Single-Track builder), `spec-maker` (opus, 224, phải đọc SKILL specs trước), `code-auditor` (5 trụ, read-only), `debugger` (sonnet, bắt buộc đọc 12 `references/debugger/`), `test-runner` (anti-illusion, verdicts PASS/FAIL/PRECHECK_FAIL/NO_TESTS), `inspector`, `git-ops`, `docs-keeper` (UPDATE-ONLY), `deployer`, `researcher` (haiku, **`memory: user`**), `brainstormer`, `project-manager`, `ui-ux-designer`. Nhiều agent mang toolset swarm `TaskCreate/SendMessage`.

### 1.7 Statusline + runtime.json

- `status.cjs` (541): statusline đa dòng — model/git/context bar/tool-agent-todo tracking/usage/timer. ⚠️ Hard-code `AUTOCOMPACT_BUFFER = 45000` (22.5% của **200K**) — sai với model 1M context.
- `runtime.json`: `privacyBlock`, `inspect.enabled`, `gemini.model` (⚠️ `gemma-4-31b-it` lệch với inspect `gemini-3-flash-preview` và script `gemini-3.1-flash-image-preview`), `statusline`, `docs.maxLoc`, `paths`, `locale`, `usage.enabled`, `spec.scaffold_guard`. ⚠️ Template thiếu key hooks có đọc (`spec`, `project`, `paths.plans`); thừa key chết (`skills.research.useGemini` — researcher dùng WebSearch native).

### 1.8 References / archive / manifest

- `references/debugger/` (12 file, 409 LOC) — **live**, debugger agent bắt buộc đọc; ship qua `agentReferences.copyRecursive`.
- `archive-command/` (1.679 LOC) — **chết**: path cũ `.specs/`, tên command trần, nhắc agent `code-reviewer` không tồn tại. Không trong manifest.
- `migration-manifest.json` (v2): 30 skills + 13 agents + 5 scripts + 20 runtime files; obsolete: `skill-router.cjs` (router cũ đã gỡ sạch).

### 1.9 OpenCode port

`AGENTS.md` (140) + 7 plugins TS (docs-sync, inspect-block, privacy-block, rules, session, state, usage). **Thiếu 3 hooks quan trọng nhất**: `spec-state` (tollgate), `task-scaffold-guard`, `agent` (subagent seeding) → OpenCode mất kỷ luật spec-workflow, chỉ còn "lời dặn". Mâu thuẫn nội bộ: `session.ts:153-159` bảo dùng `AskUserQuestion` trong khi `AGENTS.md:85` nói tool không tồn tại.

---

## PHẦN 2 — CLAUDE CODE 02–07/2026 (nền đánh giá)

1. **Plugins & Marketplaces** — kênh phân phối **khuyến nghị** thay copy file vào `.claude/`. Plugin ship: skills (`/plugin:skill`), agents, hooks, MCP, statusline. Breaking v2.1.207: plugin config không đọc từ project settings; cấm `${...}` shell expansion trong plugin hooks.
2. **Skills** — frontmatter mở rộng (`disable-model-invocation`, `model`, `allowed-tools`); stacked invocation (max 5); `.claude/commands/` chỉ còn backward-compat.
3. **Hooks** — ~30 events; mới đáng chú ý: **`TaskCreated`/`TaskCompleted`**, **`PreCompact`/`PostCompact`**, `UserPromptExpansion`. Breaking v2.1.195: matcher exact-match (regex `A|B` vẫn OK). `additionalContext` cap 10KB.
4. **Subagents** — background mặc định (v2.1.198), `isolation: "worktree"`, `memory: true`, nesting 5 cấp; `TeamCreate/TeamDelete` đã gỡ (v2.1.178).
5. **Task system** — `TaskCreate/Update/List/Get` + **`blockedBy` dependencies**, chia sẻ đa agent.
6. **Memory** — auto-memory `~/.claude/projects/<proj>/memory/MEMORY.md`; framework không nên đè.
7. **Context** — compaction hooks; `/rewind` checkpoints; `/effort`, `/fast`.
8. **Statusline** — thêm `subagentStatusLine`.
9. **Settings** — precedence Managed > CLI > Local > Project > User; tolerant parsing.
10. **Verification** — guidance chính thức: *hooks cho must-enforce, CLAUDE.md cho behavioral, skills cho workflow, Tasks cho dependency* — trùng triết lý CafeKit.

---

## PHẦN 3 — ĐÁNH GIÁ & KHUYẾN NGHỊ

### 3.1 Verdict

- **Triết lý: phù hợp, thậm chí đi trước.** Enforce bằng hooks, evidence-first, deterministic gates — CafeKit làm từ đầu 2026, nay thành guidance chính thức. Bộ ba validator L1 + grounding L2 + scaffold-guard là tài sản quý nhất (field test chấm spec 9/10).
- **Cơ chế: lệch pha 3 chỗ.** (1) Copy-file vs plugin-first; (2) hạ tầng tự chế đã có native tốt hơn (usage OAuth hack, tollgate mỗi-prompt vs TaskCompleted hook); (3) prompt đồ sộ thiết kế cho model đời cũ — model 2026 tuân thủ tốt, phần "quát tháo" tốn attention hơn được việc.
- **Bài học field test:** 2/3 cơ chế opt-in bị AI né hợp lý → *mọi gate phải mandatory-có-van-xả như scaffold-guard, hoặc đừng làm*.

### 3.2 GIỮ NGUYÊN

| Thành phần | Lý do |
|---|---|
| 3 validators + scaffold-guard | Moat thật; pattern chuẩn mực (fail-open chủ đích, van xả, message kèm lệnh) |
| Ownership manifest + snapshot/lock | Plugin không thay được "user sửa file không mất khi update" |
| Two-layer state + verification receipt | Persistent qua session; 0.13.0 bỏ hydration là đúng |
| `privacy-block` AskUserQuestion flow | Native `permissions.deny` không có luồng xin-phép-từng-file |
| Evidence gate + red-team | Nguồn chất lượng thật (field test) |
| `agent.cjs` schema `hookSpecificOutput` | Đã đúng chuẩn mới |

### 3.3 SỬA NGAY (bug cụ thể, 1–2 ngày)

1. `skills/specs/SKILL.md:164` — off-by-one "Steps 1-8" → **1-7**.
2. `skills/generate-graph/SKILL.md:3` — frontmatter `description` **rỗng** + thiếu `argument-hint` → vỡ auto-invocation/catalog.
3. `agents/ui-ux-designer.md:29-32` — hard-code path monorepo `packages/spec/src/claude/skills/...` → phải là `.claude/skills/...`.
4. `bin/lib/i18n.js:373` — `--lang` mã lạ → fallback `en` (hiện rơi về `ja`).
5. `bin/phases/claude-settings.js:112` — dedupe theo `hooks[0].command` → so toàn bộ command list.
6. `claude-settings.js:85-88` — try/catch user settings.json hỏng, báo lỗi thân thiện.
7. `runtime.json` — thống nhất model Gemini (3 nguồn 3 tên); bổ sung key `spec`/`project`; xoá `skills.research.useGemini`.
8. `skills/impact-analysis/SKILL.md` — `/review`→`/hapo:code-review`, `/impact-analysis`→`/hapo:impact-analysis`.
9. Xoá `archive-command/` (1.679 dòng chết) + `browser-tool.cjs` khỏi manifest.
10. Trả attribution Anthropic cho pdf/pptx/docx/xlsx (sửa `metadata.author`, giữ LICENSE.txt).
11. `opencode/plugins/session.ts:153-159` — bỏ chỉ dẫn AskUserQuestion (mâu thuẫn AGENTS.md:85).
12. **Validator multi-contract gap** (deferred 0.13.4): `extractTaskContracts` chỉ check block đầu tiên/task — fix ~10–15 dòng (parse mọi `<!-- contract:NAME -->`).
13. `frontend-design` — thêm LICENSE.txt được nhắc trong frontmatter, hoặc bỏ dòng nhắc.
14. `validate-docs.cjs` — exit 1 khi link gãy, hoặc đổi tên khỏi mang tiếng validator.

### 3.4 NÂNG CẤP (khớp Claude Code 2026)

1. **Tollgate → event-driven** (đòn bẩy lớn nhất): chuyển enforcement sang **`TaskCompleted` hook** (chạy validator + check receipt, chặn done "chay") + **`Stop` hook** (check sync trước khi kết thúc turn). UserPromptSubmit chỉ giữ 1 dòng nhắc. → Enforcement mạnh hơn, context nhẹ hơn.
2. **`PreCompact`/`PostCompact`** thay cảnh báo compact trong session.cjs; addressing canary chỉ còn là signature UX.
3. **`status.cjs`**: bỏ hard-code 200K/45000 — đọc context limit từ payload; thêm `subagentStatusLine`.
4. **`usage.cjs`**: OAuth endpoint + beta header 2025 là undocumented hack — đánh dấu experimental/fail rõ, thay bằng nguồn chính thức khi có.
5. **`develop` parallel wave**: `task_registry.dependencies` + subagent `isolation: "worktree"` + background default → chạy N task độc lập song song (cắt 1h38m của spec lớn — "đòn bẩy thật" field test đòi).
6. **Rà matchers v2.1.195** + thêm test settings-schema vào self-test suite.
7. **Dọn legacy tool-names** (`state-sync.md:18`, `spec-maker.md`, develop SKILL "Task tool legacy") → chuẩn `Agent`/`TaskCreate`; giữ 1 dòng fallback trong CLAUDE.md là đủ.
8. Mở rộng `memory` cho `inspector`/`debugger` (researcher đã có).

### 3.5 REMAKE (kiến trúc)

1. **Plugin-first, installer-second:**
   - Plugin `cafekit-core`: workflow skills + agents + hooks + statusline (lưu ý: plugin hooks cấm `${...}` — viết lại exec-form).
   - Plugin `cafekit-extras`: 14 domain skills — tách `chrome-devtools` (4.454 files/300MB) + bộ Office khỏi core.
   - Installer giữ cho: OpenCode, CLAUDE.md/rules merge, addressing, `runtime.json`, ownership manifest.
   - Lộ trình 3 phase: (1) publish marketplace.json; (2) tách extras; (3) co installer.
2. **OpenCode: quyết định chiến lược.** Port nốt 3 hooks thiếu (nếu OpenCode có surface) hoặc chính thức ghi tier-2 "advisory mode". Nửa vời hiện tại là tệ nhất.

### 3.6 TINH GỌN FLOW (giữ xương sống enforce-bằng-code, cắt mỡ prompt)

1. `specs` SKILL.md 662 → ~350-400 dòng: rule đã có validator enforce chỉ cần 1 câu "validator sẽ chặn" (hiện lặp ≥3 chỗ).
2. Giảm tông "URGENT/CẤM/🔴" — model 2026 không cần quát; hook chặn thật > 10 dòng caps-lock.
3. Routing rules 177 dòng → dựa native skill discovery (description chuẩn) + bảng rút gọn ~30 dòng cho ca nhập nhằng.
4. Gộp/mỏng: `inspect` internal = wrapper quanh `Explore` native → rút thành reference + giữ nhánh Gemini; cân nhắc gộp `sync` (48 dòng) vào develop/specs.
5. Chốt 1 tên chuẩn cho Evidence heading (hiện 3 alias xuyên 6 file).
6. **Không đụng quality floor**: scope_lock, EARS mandatory; contract markers → làm mandatory cho spec đa tầng BE+FE (hoặc gỡ, tránh "ảo tưởng an toàn").

### 3.7 Bảng ưu tiên

| # | Việc | Loại | Effort | Impact |
|---|---|---|---|---|
| 1 | 14 bug mục 3.3 | Fix | Thấp | Trung bình — có cái gây sai thật (i18n, settings-merge) |
| 2 | Tollgate → TaskCompleted/Stop hooks | Upgrade | Trung bình | **Cao** |
| 3 | Contract marker mandatory cho spec đa tầng (hoặc gỡ) | Fix incentive | Thấp | Cao |
| 4 | Develop parallel wave (worktree) | Upgrade | Trung bình–cao | **Cao** |
| 5 | Tinh gọn specs SKILL + routing | Slim | Trung bình | Trung bình–cao |
| 6 | Plugin-first distribution | Remake | Cao | Cao dài hạn |
| 7 | Số phận OpenCode port | Chiến lược | — | Trung bình |
| 8 | status.cjs 1M-context + usage.cjs de-risk | Upgrade | Thấp | Thấp–trung bình |

### Câu hỏi mở

1. Bắt đầu từ gói bug-fix #1 hay tollgate event-driven #2?
2. Plugin-first (#6): tạo spec `/hapo:specs` cho lộ trình 3 phase trước khi động tay?
3. OpenCode: giữ tier-1 hay chấp nhận tier-2 advisory?

---

*Nguồn: audit trực tiếp source `packages/spec/` (path:line trong thân bài); changelog & docs chính thức Claude Code (code.claude.com/docs, github.com/anthropics/claude-code); field test `notes/v0.13.0-field-test-post-list-screen.md`; memory dự án (validator multi-contract gap, hooks backlog 0.13.2).*
