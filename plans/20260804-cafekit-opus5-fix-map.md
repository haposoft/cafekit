# CafeKit Instructions 2026 — Fix Map tổng hợp (bản chốt, model-agnostic)

**Ngày**: 2026-08-04 · **Nguồn**: 6 vòng đánh giá độc lập (07/30 → 08/04) trên `packages/spec/` v0.15.2
**Mục tiêu (chốt lại 08/04)**: KHÔNG tối ưu riêng cho Opus/Fable — hoàn thiện instructions theo chuẩn công nghệ 2026, chạy tốt trên **phổ model** (fleet thực tế chạy Claude + grok + nemotron + gpt + deepseek qua Herdr/settings profiles).
**Kết luận**: Machine-layer (validators/gates/receipts) = moat, model-agnostic by construction, giữ nguyên. Prompt-layer lặp 5-9x mỗi rule + coaching generic → dedupe, không viết lại.

## Nguyên tắc chỉ đạo (chưng cất từ mọi vòng)

> **Mỗi rule tồn tại ở đúng MỘT nơi enforce — máy nếu máy kiểm được, prompt (một lần, tại tầng lazy sát nơi dùng) nếu không. Mọi chỗ khác chỉ còn pointer.**

### Tiêu chí model-agnostic (thiết kế cho phổ model, không cho một model)

1. **Always-on layer tối giản, chỉ gotchas** — context economy lợi cho mọi model; coaching generic thì model mạnh không cần, model yếu không tuân thủ ổn định. Cả hai đều được gate máy bắt tốt hơn (bằng chứng: smoke test self-disarm — model đọc escape hatch trong prose rồi tự tắt guard; prose bị lách, gate thì không).
2. **Lazy layer (skills/agents) ĐƯỢC PHÉP prescriptive** — chỉ load khi dùng, và model bind vào đó có thể là model yếu. Checklist chi tiết trong agent file là hợp lệ; chỉ cắt phần trùng máy-enforce và phần generic.
3. **Machine gates là sàn chung** — hoạt động bất kể model nào chạy phía trên.
4. **Một rule một nơi** — chống drift, lợi maintenance bất kể model.
5. **Dựa vào cơ chế native của từng runtime** (frontmatter routing, subagent primitives, hooks/plugins) thay vì mô tả lại bằng prose.

Pattern mẫu đã có sẵn trong package: bảng DoCT + câu "Validator-enforced (do not re-check by hand)" trong `specs/SKILL.md` Step 8.5. Nhân rộng pattern này ra toàn bộ.

Exemplar nội bộ làm chuẩn khi viết lại: `src/codex/AGENTS.md` (42 dòng), `skills/sync/SKILL.md` (48 dòng), `templates/task.md` (form-style).

---

## A. SHIPPED INSTRUCTIONS (ưu tiên cao nhất — mọi user nhận mỗi session)

### A1. `src/claude/CLAUDE.md` — 131 dòng → ~50 dòng

| Dòng | Nội dung | Hành động |
|---|---|---|
| L14-21 | Think Before Coding | XÓA (default Opus 5); giữ 1 câu "surface assumptions when they affect the work" |
| L23-28 | Simplicity First (YAGNI/KISS/DRY) | XÓA — generic |
| L30-36 | Surgical Changes | XÓA; giữ 1 câu "match existing style" |
| L38-43 | Goal-Driven Execution | RÚT còn 2 dòng gotcha: Completion Criteria/`## Evidence` là SoT |
| L45-53 | Operating Loop 5 bước | RÚT còn 1 dòng pointer (chi tiết ở skill develop/specs) |
| L55-62 | Operating Discipline (6 bullets) | XÓA — trùng DoD; giữ dòng L62 (tool fallback) chuyển vào hook-protocols |
| L64-73 | Definition of Done | RÚT còn 3 dòng; GIỮ dòng `NO_TESTS`/`0 tests + exit 0` (gotcha thật) |
| L75-83 | 7 "Never" gates | XÓA 6/7 (máy enforce); GIỮ 1 câu "hook block là instruction boundary" |
| L85-97 | Rule References 8 files | RÚT còn 3 pointers (state-sync, hook-protocols, routing) |
| L99-107 | Skill Use + venv paths | GIỮ (gotcha) — bỏ 2 dòng IMPORTANT generic |
| L110-115 | Git And Reporting | RÚT còn 2 dòng (conventional commits, no AI attribution) |
| L117-120 | Language Consistency | GIỮ nguyên (marker `cafekit:lang`) |
| L122-126 | Communication | XÓA — thay bằng section mới |
| L128-131 | Addressing canary | GIỮ nguyên (thiết kế độc đáo) |
| (mới) | **Response style** | THÊM theo template Opus 5: ngắn gọn, độ dài file khớp nhu cầu, no filler, lead with outcome |
| (mới) | **Uncertainty** | THÊM: label inferences, không trình bày guess như fact |
| (mới) | **Delegation** | THÊM: tự làm khi vài tool calls; delegate theo tier rủi ro (xem E1); receipts do máy kiểm, không phải do số agent |

### A2. `src/codex/AGENTS.md` — 42 dòng, chuẩn nhất

- GIỮ cấu trúc (mapping + contract + caveats) — **dùng làm khung canonical cho 2 file kia**
- THÊM Response style + Uncertainty (~8 dòng)

### A3. `src/opencode/AGENTS.md` — 140 dòng → ~60 dòng

- XÓA L32-69 (4 Core Behaviors), L71-78 (Loop), L88-94 (Discipline), L96-105 (DoD) — copy từ Claude
- GIỮ L5-29 (Runtime Mapping + Command Surface), L80-86 (Runtime Limits — value riêng), Language
- Render từ canonical + phần OpenCode-specific

### A4. Cơ chế canonical — phương án mới ưu tiên: AGENTS.md làm chuẩn

AGENTS.md đã là open standard (Agentic AI Foundation, 60k+ repos). Cả Codex lẫn OpenCode đọc AGENTS.md natively; Claude Code bridge được qua `@AGENTS.md` import.

- **Phương án A (ưu tiên)**: `AGENTS.md` = core canonical duy nhất; `CLAUDE.md` = `@AGENTS.md` + block Claude-specific (hooks, venv, addressing); Codex/OpenCode chỉ thêm block caveats riêng. Không cần build step — chuẩn mở tự làm việc đó.
- Phương án B (fallback): build step render từ `src/common/instructions-core.md` nếu phương án A vướng installer managed-block logic.
- Lưu ý kỹ thuật: `@import` load toàn bộ lúc startup (không tiết kiệm context — chỉ là tổ chức); HTML comments bị strip trước khi vào context → dùng để annotate lý do từng dòng miễn phí token.

### A5. Section `## Commands` — content ROI cao nhất đang THIẾU hoàn toàn

Data (ETH 02/2026): lệnh được nhắc trong context file được dùng 1.6-2.5×/instance vs <0.01-0.05× khi không nhắc (chênh >100×); trong khi overview sections không giảm bước nào. CafeKit CLAUDE.md hiện có **0 commands** — thiếu đúng loại content hiệu quả nhất.

- THÊM section `## Commands` vào template, **installer scaffold lúc cài**: tái dùng logic detect PM/framework của `session.cjs` để prefill (install/test/lint từ `package.json` scripts), user tinh chỉnh sau
- THÊM stub `## Do-not-touch` + `## Slow/expensive` (data: 1 dòng cảnh báo "test suite 20+ phút" giảm 24% wall-clock) — để trống cho user điền, kèm HTML comment hướng dẫn

## B. RULES/ — 8 files → 3 files

| File | Dòng | Hành động | Đích |
|---|---|---|---|
| `ai-dev-rules.md` | 50 | **XÓA** | trùng CLAUDE.md; dòng 200-line + kebab-case chuyển vào canonical (2 dòng) |
| `orchestrator.md` | 132 | **CHUYỂN** | `skills/develop/references/orchestrator.md` (chỉ cần khi delegate/parallel); bỏ Completion Statuses block + Avoid table; giữ 3-paths mandatory + prompt template |
| `manage-docs.md` | 92 | **CHUYỂN** | `skills/docs/references/` ; phần spec-layout XÓA (trùng specs SKILL) |
| `workflow.md` | 57 | **GỘP** | phần Production/CI Issues → `skills/debug` hoặc `hotfix` references; task fields → đã có trong specs SKILL; xóa file |
| `skill-domain-routing.md` | 29 | **RÚT** | bỏ bảng 24 dòng (Claude Code tự route bằng frontmatter); gộp 5-6 ambiguous cases vào skill-workflow-routing.md; xóa file |
| `skill-workflow-routing.md` | 24 | GIỮ + nhận ambiguous cases | ~30 dòng |
| `state-sync.md` | 31 | **GIỮ** — moat | consolidate wording với bản Codex (42) thành 1 canonical |
| `hook-protocols.md` | 36 | **GIỮ** — moat | + nhận dòng tool-fallback từ CLAUDE.md |

**Phương án bổ sung cho rules còn giữ**: path-scoped rules (`.claude/rules/*.md` với YAML frontmatter `paths:` globs) — chỉ load khi Claude đụng file khớp glob, 0 token khi không. Verify feature này trên Claude Code hiện tại trước; nếu hoạt động, `state-sync.md` scope vào `specs/**`, `hook-protocols.md` giữ always-on (phạm vi toàn cục).

Đồng bộ: `phases/claude-runtime.js copyRulesDirectory` + `codex-runtime.js` + `opencode` rules copy + `migration-manifest.json` (không list rules nhưng installer copy cả cây) + mọi pointer trong CLAUDE.md/AGENTS.md.

## C. HOOKS — 11 giữ 10, sửa 2, không bỏ gates

| Hook | Hành động |
|---|---|
| `rules.cjs` (122) | **GỌT LỚN**: chỉ giữ Language + paths (~6 dòng inject); XÓA blocks YAGNI/Modularization/comment-style (L85-107 — "write descriptive code comments" còn ngược guide); **sửa bug cooldown** (thực nghiệm: fire mỗi lượt) |
| `agent.cjs` (106) | GỌT NHẸ: giữ Language + paths + venv; bỏ dòng "YAGNI · KISS · DRY" |
| `privacy-block`, `inspect-block`, `task-scaffold-guard`, `spec-gate`, `spec-state` | **GIỮ NGUYÊN** — gates, chi phí 0 khi không vi phạm |
| `session`, `state`, `docs-sync` | GIỮ (event-gated, rẻ) |
| `usage.cjs` | GIỮ optional (đã mark experimental + có toggle) |
| `state.cjs` (296), `session.cjs` (264) | Nợ kỹ thuật tách file — Wave 5, không thuộc track Opus 5 |

Đồng bộ Codex hooks + OpenCode plugins tương ứng (`rules.ts` gọt giống `rules.cjs`).

## D. AGENTS — 13 → ~11

| Agent | Dòng | Hành động |
|---|---|---|
| `god-developer.md` | 105 | **GIỮ NHƯNG GỌT + ĐỔI TÊN** (`implementer.md`) — với fleet hỗn hợp, agent implementer định danh vẫn cần (model bind vào có thể yếu). Cắt: Core Principles generic (L14-22, trừ Surgical Reading + 200 LOC limit — gotcha thật); giữ: Self-Check checklist, Execution Process, Worktree Conduct. 105 → ~60 dòng. Đồng bộ tên: `migration-manifest.json`; `codex-install.js` AGENT_NAMES L10-24; `opencode-install.js` OPENCODE_COMMAND_TEMPLATES; SKILL develop/hotfix/test; `orchestrator.md`; parallel-waves.md |
| `researcher.md` | 67 | **VIẾT LẠI giọng trung tính**: bỏ "Alpha Predator/ABSOLUTELY FORBIDDEN/brutally/dark web sectors"; giữ multi-source verification + credibility scoring + output routing → ~40 dòng |
| `spec-maker.md` | 224 | Xóa Finalization Audit 14 items → thay bằng "chạy 2 validators + judgment-only list" (giống SKILL Step 8.5); bỏ MANDATORY blocks trùng SKILL → ~130 dòng |
| `debugger.md` | 191 | "MANDATORY read 4 references" → "load references theo domain khi cần"; giữ root-cause contract 7 items (giá trị thật) → ~150 |
| `project-manager` (39) + `git-ops` (20) | Team Mode/swarm blocks (TaskList/claim/shutdown_request) xuất hiện ở 6 agents → tách thành `references/swarm-protocol.md` chung, mỗi agent 1 pointer. Cân nhắc gộp 2 agent này |
| `test-runner` (148) | GIỮ — Anti-Illusion Protocol là gotcha thật; chỉ dedupe Evidence restatement |
| `code-auditor` (156) | GIỮ — 5 Pillars; dedupe phần trùng code-review SKILL |
| `brainstormer`, `inspector`, `docs-keeper`, `deployer`, `ui-ux-designer` | GIỮ, gọt swarm-block dùng pointer chung |

## E. SKILLS — 29 giữ nguyên số lượng, dedupe nội dung

### E1. Sửa trọng điểm

| Skill | Hành động |
|---|---|
| `develop/SKILL.md` (284) | **XÓA Anti-Rationalization table** (L114+ — prose bị lách, gate không); **delegation chuyển từ mandatory sang TIERED** (mở rộng Execution Tier có sẵn của specs sang develop): Light/trivial → main thread tự implement, không bắt buộc inspector scout; Standard → implement + 1 review độc lập khi ship; Deep/risky (auth/payment/migration/parallel wave) → chain đầy đủ inspector→implementer→test-runner→code-auditor. Chain kiểm chứng độc lập GIỮ làm mặc định tại ship-point (giá trị với fleet hỗn hợp), chỉ bỏ ép buộc đồng loạt mọi task. HARD-GATE/DoD/CONTRACT/SCOPE-FIDELITY: giữ ý, rút mỗi block còn 1-2 câu + pointer máy |
| `specs/SKILL.md` (410) | Xóa "Forbidden generated artifacts" list (validator bắt); xóa 8 guardrails `--validate` REJECTED-style → giữ bảng auto-decision; nhân rộng "Validator-enforced (do not re-check by hand)" → ~300 dòng |
| `test/SKILL.md` (193) | Bỏ bắt buộc spawn test-runner cho case standalone đơn giản (chạy trực tiếp, spawn khi UI parallel); GIỮ HARD-GATE NO_TESTS semantics |
| `code-review/SKILL.md` (96) | GIỮ; Stage 3 inspector → optional theo judgement |
| `hotfix`, `brainstorm`, `docs`, `question`, `debug` | Dedupe pass: mọi restatement Evidence/DoD → 1 câu pointer |

### E2. Dedupe toàn cục rule "Evidence receipt" (9 chỗ prompt → 2)

GIỮ phát biểu đầy đủ tại: `templates/task.md` (footer) + `rules/state-sync.md`.
THAY bằng pointer tại: CLAUDE.md L41, workflow.md (xóa file), specs SKILL Step 7, spec-maker.md, test-runner.md, sync SKILL Directive 4, develop DoD block.
Cụm `"(legacy heading aliases still parse)"`: chỉ giữ trong code comments của hooks/validator; xóa khỏi mọi prose.

## F. INSTALLER — nợ kỹ thuật (Wave 5, tách khỏi track Opus 5)

| File | Dòng | Hành động |
|---|---|---|
| `lib/opencode-install.js` | 854 | Tách: OPENCODE_COMMAND_TEMPLATES (L26-225) → `opencode-commands.json` data; writers → `opencode-writers.js`; config merge → `opencode-config.js` |
| `lib/context.js` | 355 | Tách: `platforms.js`, `cli-args.js`, `manifest-loader.js`, context factory |
| `phases/post-install.js` | 263 | Tách 4 patch functions thành module riêng |
| `phases/copy-payload.js` | 240 | Tách skills/agents/commands; XÓA `DEPENDENCY_TEMPLATES` dead code (L56-67) |
| `lib/manifest.js` | 227 | Tách `createTracker` |
| `lib/i18n.js` | 403 | Để nguyên (messages = config-like, đúng exception của 200-line rule); hoàn thành task 5.1 test placeholders |
| `phases/setup-rtk.js` | 159 | Cân nhắc pin checksum cho `curl \| sh` |
| `src/claude/runtime.json` | — | Xóa key `gemini.model` legacy nếu không còn reference (verify trước) |

## G. KHÔNG SỬA (moat + đã đúng chuẩn 2026)

- `scripts/validate-spec-output.cjs`, `spec-ground.cjs`, `spec-scaffold.cjs` — validators
- Hooks gates: `spec-gate`, `privacy-block`, `inspect-block`, `task-scaffold-guard`
- `templates/task.md` (form-style), `skills/sync/SKILL.md`
- Tollgate concept, Execution Tier (Light/Standard/Deep), addressing canary, managed-block markers
- `lib/backup.js`, `lock.js`, `path-safety.js`, `managed-writer.js`, `ui.js`
- Kiến trúc lazy-load 29 skills

## H. Thứ tự thực hiện (6 waves)

1. **Wave 1** (1-2 ngày, tác động/chi phí cao nhất): gọt `rules.cjs` + sửa cooldown → viết canonical + render 3 instructions (A1-A4) → gọt `agent.cjs`
2. **Wave 2** (2-3 ngày): tái phân bổ rules/ (B) + dedupe pass rule Evidence toàn cục (E2)
3. **Wave 3** (3-5 ngày): agents (D) — gọt + đổi tên god-developer→implementer + đồng bộ 6 điểm + researcher/spec-maker/debugger + swarm-protocol chung
4. **Wave 4** (3-5 ngày): skills trọng điểm (E1) — develop/specs/test; **A/B test delegation mới trên 1 spec nội bộ trước khi chốt**
5. **Wave 5** (song song được): installer tech-debt (F)
6. **Wave 6** (1 tuần): update self-tests + installer 3-platform dry-run + field test 1 spec end-to-end + CHANGELOG + bump version

**Verification mỗi wave**: `npm test` (self-tests) + `--dry-run` 3 platform + với Wave 3-4: chạy `/hapo:specs` + `/hapo:develop` thật trên spec mẫu, so receipts.

**Đo lường bổ sung (theo phương pháp data-driven):**
- `/context` sau install để xác nhận payload thực load (trước/sau Wave 1-2 — kỳ vọng giảm ~60-70%)
- **Test-by-deletion**: xóa section nghi ngờ → chạy lại 3 task quen → so kết quả; đây là cách A/B rẻ cho Wave 4
- Metric theo dõi: số lần phải sửa lời agent/session, số lần chạy sai command, cost/task — không đo bằng cảm giác

## J. Cơ sở dữ liệu thực nghiệm (bài goonnguyen 08/2026 — 4 nghiên cứu)

Bằng chứng định lượng ủng hộ fix-map, ghi lại để trích khi review:

| Số liệu | Nguồn | Ủng hộ mục |
|---|---|---|
| Context file giảm 28.6% runtime, 16.6% output tokens, **không đổi** task completion | Lulla 01/2026, 124 PRs | Instructions = process memory, không phải knowledge → cắt overview/architecture khỏi CLAUDE.md (A1) |
| File do dev viết: +4%; file LLM-generate: **−3%**; cả hai tăng cost 20-23% | ETH AGENTbench 02/2026 | Template generic của kit thuộc nhóm −3% → template phải là scaffold + gotchas, không phải advice (A1, A5) |
| Command được nhắc: dùng 1.6-2.5×; không nhắc: <0.05× (>100×). Overview: 0 tác dụng | ETH | Section Commands (A5); xóa Core Behaviors (A1) |
| Xóa docs/ rồi mới đo → context file +2.7% | ETH | "Agent tự grep được thì xóa" — nguyên tắc single source of truth |
| Nhiều constraint → GPT reasoning tokens +22% | ETH | Over-thinking do prompt rules — cắt 7 Nevers, anti-rationalization (A1, E1) |
| 1 dòng cảnh báo "test suite 20+ phút" → giảm 24% wall-clock | Khatri 07/2026 | Slow/expensive warnings = ROI cao nhất (A5) |
| "Markdown is probabilistic, hooks are the gate" | bài viết | Trùng 100% nguyên tắc machine-layer của fix-map (C, G) |

**4-Question Filter — tiêu chí biên tập cho MỌI dòng giữ lại ở Wave 1-2:**
1. Agent tự discover được không (`ls`/`grep`/`cat`)? → xóa
2. Không có dòng này thì hỏng cụ thể cái gì? Không trả lời được → xóa
3. Verify được không? ("chạy `pnpm lint` trước khi done" ✓; "code sạch sẽ" ✗)
4. Có mâu thuẫn dòng khác không? → conflict tệ hơn không có rule

**Chính sách bảo trì tương lai (ghi vào docs của kit): add-on-failure** — chỉ thêm dòng mới khi agent sai cùng lỗi lần 2, review bắt lỗi đáng lẽ phải biết, hoặc phải gõ lại correction từ session trước. Không viết trước hàng trăm dòng.

**Caveat của chính nghiên cứu**: toàn Python + one-shot autonomous runs; interactive multi-turn và non-Python chưa được đo — không tuyệt đối hóa.

## I. Việc dang dở cần xử trước/song song

Fix A (select-platform), Fix B (codex-native test), 5.1 i18n, 5.2+5.3 settings, changelog+docs sync, commit 3 nhóm, 11 dependabot alerts, release 0.15.3 — nên đóng trước Wave 1 để remake bắt đầu từ trạng thái sạch.

## K. Nguồn tham khảo tổng hợp (reference index)

| # | Nguồn | Loại | Đóng góp chính vào fix-map |
|---|---|---|---|
| 1 | Official guide Anthropic cho Opus 5 (public từ launch) | Định tính, first-party | 4 insights nền: verbosity, don't-hobble, progressive disclosure, context engineering |
| 2 | Thariq — context engineering essay | Định tính | CLAUDE.md siêu nhẹ chỉ gotchas; skills ngắn; /doctor rightsizing |
| 3 | Template CLAUDE.md Opus 5 — gist `thieung/5b7667145b370dbd889fe079bcb5cf86` | Template mẫu | 8 sections chuẩn: Response style, Working out loud, Scope, Uncertainty, Quality, Code, Delegation, Irreversible actions |
| 4 | Duy /zuey/ — "Viết CLAUDE.md dựa trên số liệu" `goonnguyen.substack.com/p/viet-claudemd-cho-ung-dua-tren-so` | **Định lượng** (4 papers) | Section J: 4-Question Filter, commands>100× prose, add-on-failure, test-by-deletion, path-scoped rules, AGENTS.md standard |
| 4a | ↳ Lulla et al. 01/2026 (124 PRs) | Paper | Context file = efficiency, không phải correctness |
| 4b | ↳ Gloaguen et al. ETH SRI 02/2026 (AGENTbench) | Paper | Dev-written +4% / LLM-gen −3% / cost +20-23%; command-vs-prose >100× |
| 4c | ↳ Khatri 07/2026 (preprint, 288 runs) | Paper | Bottleneck = skill không phải knowledge; slow-warning giảm 24% wall-clock |
| 4d | ↳ Chatlatanagulchai et al. 11/2025 (survey 2.303 files) | Survey | Devs viết nhiều nhất đúng loại content vô dụng nhất (architecture overview) |
| 5 | `~/Desktop/cafekit-ref/` — **AgentKit Engineer** (kit thương mại của tác giả nguồn #4) | Kit thực chiến | Section L: đối chứng sống của triết lý guidance-lean |
| 6 | Nghiên cứu nội bộ 5 track (plan `cafekit-2026-remake-tong-hop.md` §2) | Nội bộ | ClaudeKit patterns, repository-harness, plugin mechanics, migration patterns |

## L. Học từ cafekit-ref (AgentKit Engineer) — triết lý & flow

**Khảo sát 08/04**: `.claude/` = 8 rules (**318 dòng TỔNG**, mỗi file 27-53 dòng) + ~98 skills lazy + 16 agents (1.904 dòng) + ~12 hooks + `.agentkit/config.yaml` + adapters/claude-code. **KHÔNG có CLAUDE.md ở root** — đúng tuyên bố tác giả trong nguồn #4.

### Triết lý rút ra

1. **Guidance qua hook injection + rules tự-scope, không qua file tĩnh dày**: mỗi rules file mở đầu *"Use this file when/for/only when..."* — model biết khi nào cần đọc. Rules = **operational protocol cho tình huống cụ thể** (spawn subagent / edit code / review / long-running process), không phải knowledge dump.
2. **Capability-based routing**: workflow routing dùng `[bracketed capability]` resolve qua **live installed-skill catalog** — *"never synthesize an absent skill command"*. Không hardcode tên lệnh → không drift khi skill vắng.
3. **HARD-GATE vẫn tồn tại ở lazy layer** (ak-cook có 5 gates!) nhưng mỗi gate kèm **user-override valve**: *"If user explicitly says 'just code it', respect their instruction"*; `--no-test` hạ thành warning + surface trade-off cho user chấp nhận. → Xác nhận revision model-agnostic (lazy layer được phép prescriptive) + pattern valve đáng copy.
4. **Brainstorm contract 4 trường** (outcome, constraints, non-goals, acceptance criteria) làm gate mở đầu, *"proportional — ask only about a material decision that cannot be discovered safely"*.
5. **Enforcement machine của họ MỎNG hơn CafeKit** (simplify-gate, secret guardrail — không có spec validators/receipts). **Đích của mình = guidance-lean (họ) + enforcement-heavy (CafeKit)** — không copy nguyên.

### Pattern áp dụng vào fix-map

| Pattern từ AgentKit | Áp vào fix-map | Wave |
|---|---|---|
| Câu tự-scope "Use this file when..." đầu mỗi rules file | 3 rules còn giữ (B) — rẻ, bổ trợ path-scoped option | 2 |
| Capability-routing `[bracket]` + live catalog, bỏ hardcode `/hapo:*` | `skill-workflow-routing.md` viết lại (B) | 2 |
| User-override valve trong HARD-GATE | develop/specs/test gates (E1) | 4 |
| **`kongming` — model-escalation agent**: advisory-only, autonomous (không hỏi lại, 1 lượt trả đủ, Assumptions + confidence), model mạnh nhất + per-runtime override | **Agent mới đề xuất** — hợp fleet hỗn hợp: worker yếu escalate lên advisor mạnh không đổi model session; flag `--advice` cho develop | 3 |
| `process-management` rules (ghost process: PID/port tracking, reuse-or-stop, cleanup theo worktree) | Category gotcha mới — rule lazy hoặc reference devops/develop | 2 |
| `review-audit-self-decision` (decision stability + user-decision protection + no plan-IDs trong code artifacts) | Port bản 34 dòng của họ (CafeKit đã định borrow từ ClaudeKit — đây là dạng chuẩn) | 2 |
| Injection **scope-reservation** (reserve/mark/clear) thay cooldown thô | Implementation hint fix cadence `rules.cjs` (C) | 1 |
| **PreCompact hook** (capture state trước compaction) | Hook candidate — bổ trợ addressing canary (canary phát hiện sau, PreCompact cứu trước) | 3 |
| Config stub commented-out, team-committed (`config.yaml`) | Cách document `runtime.json` template | 5 |
| `disable-model-invocation: true` cho skill internal dùng chung | Cơ chế cho shared references (swarm-protocol, orchestrator sau move) | 3 |
| `fullstack-developer` shape (tên trung tính + behavioral checklist 8 items + escalation + file-ownership) | Khung mẫu trực tiếp cho `implementer.md` (D) | 3 |

## Quyết định đã chốt (user, 2026-08-04)

1. **Canonical = phương án A**: `AGENTS.md` chuẩn mở duy nhất + `CLAUDE.md = @AGENTS.md + block Claude-specific`. Không build step.
2. **`god-developer` → `implementer`** — đồng bộ 6 điểm ở Wave 3.
3. **Tier delegation ở develop dùng lại trigger của specs Execution Tier** (Light/Standard/Deep — 1 khái niệm tier toàn kit); A/B trên 1 spec nội bộ trước khi chốt hành vi.
4. **Version bump = 0.16.0** — khớp lộ trình strangler (0.15 opt-in → 0.16 default → 0.17 EOL installer) trong plan tổng.
5. **Đóng 8 việc dang dở TRƯỚC Wave 1** (Fix A/B, i18n 5.1, settings 5.2+5.3, changelog+docs sync, commit, dependabot, release 0.15.3) — remake khởi đầu từ trạng thái sạch.

## Ý tưởng để sau (đã lưu memory)

6. Agent kiểu `kongming` (model-escalation advisor) — lưu tại memory `kongming-model-escalation-idea`; cân nhắc lại khi vào Wave 3.
