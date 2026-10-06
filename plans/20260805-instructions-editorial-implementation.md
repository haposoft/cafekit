# Nội dung thực hiện — Editorial pass instructions (chi tiết thi công)

**Ngày**: 2026-08-05 · **Input**: `plans/20260805-instructions-semantic-review.md` (vấn đề + kỹ thuật T1-T9) + `plans/20260804-cafekit-opus5-fix-map.md`
**Chia 2 đợt**: Đợt 1 = trước merge PR #76 (4 file instruction, branch `refactor/instructions-2026`) · Đợt 2 = Wave 4 skills (tiếp tục trên branch `refactor/instructions-2026`)

## Quyết định mặc định (để thi công không chờ; bro override được từng cái)

| Q | Quyết định mặc định | Lý do |
|---|---|---|
| Q1 inspect `ext` | **BỎ hẳn** mode ext + config gemini | YAGNI — installer đã gỡ gemini-cli từ 0.14.2 |
| Q2 domain stats | Quét trong Đợt 2 luôn (đi cùng batch skill) | Rẻ, cùng một lượt grep |
| Q3 Anti-Rationalization | Giữ thiết bị NƠI NHẤT QUÁN: `hotfix` giữ nguyên; `brainstorm` sửa 1 row; `develop` bỏ bảng | Bằng chứng 5.2: thiết bị OK, entry lỗi |
| Q4 stub rỗng | Giữ heading như hiện tại | Vô hại; xét lại nếu quan sát thấy nhiễu |
| Q5 vị trí Language | **ĐẢO đề xuất cũ → Language nằm trong CORE (1 nơi duy nhất)**; XÓA khỏi wrapper Claude và mọi platform block; installer patch core block trong AGENTS.md cho MỌI platform | Giải cùng lúc: mâu thuẫn 2 tầng (1.2), bug `--lang vi` claude (#4), và tránh 3 section ngôn ngữ khi combined install |
| Q6 portability | GIỮ regex transform; thêm **tripwire self-test** cấm chuỗi `packages/spec/src/` trong mọi payload | Chuyển authoring-neutral là việc remake lớn, để sau; tripwire chặn cả họ bug path-leak ngay |

---

# ĐỢT 1 — Trước merge PR #76

## 1.1 `src/common/AGENTS.md` — bản viết lại đầy đủ

```markdown
# AGENTS.md

## Shared CafeKit instructions

- Deliver exactly what was asked. Do not expand, polish, or add optional work beyond the request. Match existing code style and structure.
- For spec work, `Completion Criteria` and `## Evidence` in `specs/<feature>/tasks/*.md` are the source of truth for task state.
- `NO_TESTS` and `0 tests + exit 0` do not pass when the task requires automated tests.
- When a hook blocks an action, that is an instruction boundary — do not work around it.
- Use conventional commits. Do not add AI attribution unless requested.

## Response style

Keep replies focused and brief. Match written-file length to task needs. Do not add filler sections or redundant summaries. Lead with the outcome.

## Uncertainty

Say when you are unsure and what would settle it. Label inferences instead of presenting them as verified facts.

## Delegation

Do the work yourself when it takes a handful of tool calls. Delegate genuinely independent parallel tracks. Verification comes from the project's hooks and validators, not from spawning more agents.

## Commands

<!-- Add project-specific install, test, lint, and build commands here. Keep commands executable. -->

## Do not touch

<!-- List files, directories, generated artifacts, or secrets that tasks must leave unchanged. -->

## Slow or expensive

<!-- Note commands, environments, or operations that need explicit planning before running. -->

## Language Consistency <!-- cafekit:lang -->

Match the language the user writes in. Technical terms, code identifiers, and file paths may remain in English.
```

Thay đổi so với hiện tại: "surgical"→câu hành vi; thêm neo `specs/<feature>/tasks/*.md`; "Hook blocks"→hết nhập nhằng; "machine gates"→"the project's hooks and validators"; Language unpatched tự đứng ("Match the language the user writes in").

## 1.2 `src/claude/CLAUDE.md` — bản viết lại đầy đủ (23 → ~14 dòng)

```markdown
# CLAUDE.md

@AGENTS.md

<!-- Claude Code reads this file; the @import above loads the shared AGENTS.md core.
     Humans: review installed hooks with /hooks before trusting them. -->

## Claude Code runtime

- Edit project skills under `.claude/skills/`, not `~/.claude/skills`.
- Run Python skill scripts with the skill venv:
  - macOS/Linux: `.claude/skills/.venv/bin/python3 scripts/<script>.py`
  - Windows: `.claude\skills\.venv\Scripts\python.exe scripts\<script>.py`
- Consult `.claude/rules/state-sync.md`, `.claude/rules/hook-protocols.md`, and `.claude/rules/skill-workflow-routing.md` when their topics apply.
```

Thay đổi: XÓA 2 rule lặp core (hook boundary, conventional commits); XÓA section Language (về core theo Q5); XÓA section Addressing khỏi template (installer append khi user opt-in — `configureAddressing` đã có nhánh append-when-absent); 2 câu meta → 1 HTML comment.

## 1.3 `src/codex/AGENTS.md` (block Codex) — 2 sửa điểm

- Dòng 4: `"...browse with /skills. Edit project-local skills there, not global ~/.claude/skills."` → `"...browse with /skills. Edit skills in the project, not in a global skills directory."`
- Dòng 16: `"Do not edit global trust configuration. Hosted tools and untrusted project hooks may not enter the local hook path."` → `"Do not edit global trust configuration. Hooks are not a complete security boundary; hosted tools and untrusted project hooks can bypass the local hook path."`

## 1.4 `src/opencode/AGENTS.md` (block OpenCode) — 3 sửa điểm

- Dòng 8: bỏ vế `not global ~/.claude/skills` (giống 1.3)
- Dòng 31 thay cả đoạn "OpenCode limits":

```markdown
## OpenCode limits

Claude Code hooks, statusline, and settings do not run in OpenCode. Map Claude-only tools to OpenCode built-ins: `TodoWrite` → `todowrite`, `AskUserQuestion` → `question`, `Task` → the agent/subtask flow. The installed plugins under `.opencode/plugins/` provide the privacy, inspect-scope, spec-state, scaffold-guard, session-state, and docs-sync gates; other Claude runtime behavior has no OpenCode equivalent.
```

## 1.5 Installer — theo Q5 (Language về core)

File `bin/phases/post-install.js`:
- `patchLanguageSection`: đổi target — patch section `<!-- cafekit:lang -->` trong **core block của AGENTS.md** (dùng marker CAFEKIT CORE từ `bin/lib/instruction-blocks.js`), áp cho MỌI platform đã cài. Bỏ patch language trên CLAUDE.md/per-platform block.
- Bản patched: `"Always respond in **<Label>**. Technical terms, code identifiers, and file paths may remain in English, but explanations, comments directed at the user, and structured output must be in <Label>."`
- `configureAddressing`: giữ nguyên cơ chế (per-platform, opt-in) — chỉ xác nhận nhánh append hoạt động khi template không còn section (test 1.7).

## 1.6 Self-tests cập nhật (`scripts/run-skill-self-tests.mjs` + `bin/__tests__/`)

- Cập nhật assertion khớp wording mới (các chuỗi "surgical", "~/.claude/skills" trong codex/opencode, Language cũ... sẽ đổi)
- Assertion mới: (a) core AGENTS.md sau cài KHÔNG chứa 2 rule đã xóa khỏi wrapper ở dạng lặp; (b) `--lang vi` → core block trong AGENTS.md chứa "Vietnamese", VÀ không file nào còn "Always respond in **English**"; (c) combined install: đúng 1 section `cafekit:lang` trong AGENTS.md; (d) claude-only: CLAUDE.md không chứa section Language/Addressing từ template
- **Tripwire Q6**: fail nếu bất kỳ file payload nào (skills/rules/agents sau cài) chứa chuỗi `packages/spec/src/`

## 1.7 Verification Đợt 1

```bash
npm test                                             # toàn suite + assertions mới
# cài 5 case vào mktemp: claude / codex / opencode / combined / combined-rerun
# case --lang vi cho cả 3 platform: grep Vietnamese trong core, absent English
# upgrade test: cài 0.15.2 (worktree 232520d + symlink node_modules) → cài HEAD đè → user notes sống, marker 1 cặp, addressing không bị chèn "anh"
```

Cuối đợt: sửa PR #76 body — dòng line-count thành trung thực: "always-on của user Claude: ~130 → ~64 dòng (AGENTS.md 39 + CLAUDE.md ~25)".

---

# ĐỢT 2 — Wave 4 skills (branch mới `refactor/skills-editorial`)

## 2.1 `develop/SKILL.md` — sửa lớn nhất

**(a) Hợp nhất delegation thành MỘT policy block** — chèn sau phần Execution Modes, dùng T1:

```markdown
## Delegation policy (single source for this skill)

Implement in the main session by default. Do not spawn a subagent because a step
mentions an agent name — spawn only per this table:

| Tier (from spec `execution_tier`) | Delegation |
|---|---|
| Light — clear + isolated + ≤2 tasks | None. Main session scouts, implements, verifies. |
| Standard — default / 3-4 tasks | Main session scouts + implements; one independent `code-auditor` review at ship point. |
| Deep — Complex/Critical, auth/payment/migration/schema, 5+ tasks, or `--parallel` | `inspector` scout per task, one `implementer` per worktree (parallel wave), `test-runner` + `code-auditor` gates. |
```

**(b) Xóa** bảng Anti-Rationalization (L114-119) — 2 entry delegation mâu thuẫn policy, phần còn lại generic.

**(c) Sửa diagram** L128: node `"Step 3: Implement Code (god-developer)"` → `"Step 3: Implement (per Delegation policy)"`; L127 `"Task-Aware Scout (inspector)"` → `"Task-Aware Scout (per Delegation policy)"`. Step 2 L165 `"Mandatory per task: Call Agent(inspector)"` → `"Scout per Delegation policy — Deep tier delegates to inspector; Light/Standard scouts in the main session with the same required outputs:"` (giữ nguyên danh sách outputs — đó là phần giá trị).

**(d) Dedupe Step 3/4/5**: Step 3 giữ 8 named Rules (canonical). Step 4 các điều kiện lặp → 1 dòng: `"Violating any Step 3 rule = FAIL."`, chỉ giữ điều kiện cộng thêm (PRECHECK_FAIL outranks NO_TESTS; evidence-missing-despite-green; 3-round escalation). Step 5 chỉ giữ cơ học receipt (status/timestamps/receipt content), bỏ các câu nhắc lại rule. Ước −60-80 dòng.

**(e) Mode × behavior matrix** (T7) — thêm sau Arguments:

```markdown
| Mode | Scout | Quality gate | Receipt | Notes |
|---|---|---|---|---|
| default (specific-task / full-spec) | per tier | full (Step 4) | verified | |
| `--flash` | per tier | Flash Gate (4F) | `FLASH_UNVERIFIED` | |
| `--parallel` | inspector per task | full, inside each worktree | verified | implies Deep tier |
| `--flash --parallel` | **not supported** — `--parallel` wins, state this to the user | | | waves always run the quality gate |
| `--no-notes` | — | — | — | composable with all modes |
```

**(f)** `Score >= 9.5 & Zero Critical` (L211) → `"no Critical findings, no High findings, at most one Medium"`. **(g)** CWD Protocol: "crash" → "will fail to locate the root docs/ folder".

## 2.2 `git/SKILL.md` — viết lại trọn (66 dòng, house style + T5/T6/T8)

```markdown
# Git Operations & Worktree

Git operations and worktree management using plain `git` commands.

## Default (no arguments)
Present options via AskUserQuestion — header "Git Operation": commit / push / pr / finish / worktree.

## Commands
- `commit`: secret scan → analyze diff → split into conventional commits.
- `push`: push current branch.
- `pr`: push + open PR. Target = the repo's integration branch — detect via
  `gh repo view --json defaultBranchRef` or `origin/HEAD`; never assume `main`/`develop`.
- `finish`: fresh `git status` + verification, then present exactly 4 options:
  merge locally / push + PR / keep branch-worktree / discard (typed confirmation).
- `worktree <desc>`: sibling dir `../<project>-<branch>` for isolated setup.

## Secret scan (before every commit)
```bash
git diff --cached | grep -inE '\b(api[_-]?key|secret|password|credential(s)?|token)\b\s*[:=]'
```
Match → STOP: show the lines, refuse to commit, suggest `.gitignore` + `git rm --cached`.
(Word-boundary + assignment context: "tokenizer" no longer false-positives.)

## Split rules
Split when: mixed types (feat+fix), mixed scopes, config/deps mixed with code, >10 unrelated files.
Single commit when: same type+scope, ≤3 files, ≤50 lines.

## Output
```
✓ staged: N files (+X/-Y)
✓ secrets: none
✓ commit: <hash> type(scope): description
✓ pushed: yes|no
```

## Errors
| Error | Action |
|---|---|
| Secrets matched | Block; show lines |
| Nothing staged | Exit cleanly |
| Push rejected | Suggest `git pull --rebase` |
| Conflicts | List files; never auto-resolve |

Never force-push or delete a worktree without explicit confirmation.

## References (unchanged)
- `references/commit-protocols.md` · `references/finish-branch.md` · `references/worktree-blueprint.md`
```

Xóa: "clean-room execution engine", "proprietary Node scripts", "VSC", mantra.

## 2.3 `research/SKILL.md` — 2 sửa điểm

- L43 thay nguyên câu tiếng Việt: `"Use the template at .claude/skills/specs/templates/research.md verbatim. Do not add sections beyond it."` (path bắt đầu `.claude/` → transform installer tự rewrite per-platform; hết Bug 1)
- L15 mantra `"Be brutal, straight to the point, and strictly authoritative"` → `"Return ranked recommendations with sources; never an unsorted list of options."`

## 2.4 `inspect/SKILL.md` — bỏ mode `ext` (Q1)

- Xóa: argument `ext`, section Configuration (gemini), hàng bảng mode có Gemini, file `references/external-gemini-inspection.md`
- Grep dọn đồng bộ: `skill-domain-routing` (nếu còn), `runtime.json` template key `gemini`, `generate-skill-catalog`, agents nhắc "inspect ext" (debugger.md L48, L94), self-tests
- Thống nhất 1 hệ đếm: giữ SCALE (1-10); sửa "1-6 sub-scopes"/"SCALE 3-6 recommended" quy về SCALE

## 2.5 `brainstorm/SKILL.md` — 2 sửa điểm

- Bảng Anti-Rationalization row L62 thay bằng: `| "I'll skip the scout summary and go straight to questions" | Gate order is scout → summarize findings → ask. Questions come from evidence. |`
- "Ecosystem Swarm" đoạn L74: thay trigger "deeply complex" bằng điều kiện đếm được: `"Call brainstormer only when 2+ architectures have material trade-offs after discovery; call researcher only for external/current facts the repo cannot answer."` — bỏ 3 nhãn vai trò trong ngoặc.

## 2.6 `hotfix` + `debug` — nâng cấp T2/T3 (sửa điểm, không viết lại)

- Root-cause contract (hotfix HARD-GATE L28, debug ROOT-CAUSE-GATE): thêm 2 câu: `"Answer each item in one concrete sentence."` + `"If any answer contains 'probably', 'I think', 'something with', or 'maybe' — it is not an answer; gather evidence instead."`
- hotfix NO-SIDE-EFFECTS options L53-57: chuyển 4 option thành câu nguyên văn có placeholder (mẫu ak-fix): `"Revert this fix and try a different root-cause angle"` / `"Keep the fix and update <dependent files> to match the new contract"` / `"Narrow the fix to <subset> so the regression disappears"` / `"Accept the change — the old behavior was itself a bug"`.

## 2.7 `code-review/SKILL.md` + `agents/code-auditor.md` + `develop references/quality-gate.md`

- Mọi chỗ `Score >= 9.5 / < 9.5 / scoring formula` → quy tắc chữ: **PASS = no Critical, no High, at most one Medium**. code-auditor giữ phân loại 🔴🟠🟡🔵 và Automatic Criticals (giá trị thật), bỏ số học -2.0/-1.0/-0.3/-0.1.
- Thêm câu stance (T4, đầu phần Review Process của code-auditor): `"Assume the code may be AI-generated. Do not trust polished structure, confident comments, or happy-path tests — verify behavior from evidence."`

## 2.8 `question/SKILL.md` — dịch 5 ví dụ tiếng Việt (L33-40) sang tiếng Anh, giữ nguyên nghĩa.

## 2.9 Domain skills — quét stats không nguồn (Q2)

Phương pháp: `grep -rnE '[0-9]+%' src/claude/skills/{backend,frontend,mobile}-development src/claude/skills/{devops,web-testing,react-best-practices}/SKILL.md` → mỗi match: có nguồn kèm link thì giữ, không nguồn thì xóa số giữ ý (vd "98% SQL injection reduction" → "parameterized queries prevent SQL injection"). Giữ nguyên mọi Decision Matrix.

## 2.10 Verification Đợt 2

```bash
npm test                                   # assertions cập nhật theo wording mới
grep -rn "9\.5" src/claude | wc -l         # = 0
grep -rn "god-developer" src/ bin/ | wc -l  # chỉ còn tên mới (đổi tên implementer đi cùng đợt này theo fix-map D)
grep -rnE 'packages/spec/src/' <cài-đặt-temp>  # tripwire = 0
# A/B thật (fix-map Wave 4): chạy /hapo:develop 1 task Light-tier trên project mẫu
#   → đếm subagent spawns: kỳ vọng 0 (trước: ≥2)
```

**A/B evidence (2026-08-05):** Herdr Claude worker chạy trong project tạm cô lập với
`settings.impl.json`; nested Agent/subagent spawn count = **0**. `npm run build && npm test`
pass (1 test), Vite preview + `curl` trả HTML, missing `src/config.js` làm build fail
với lỗi resolve đúng kỳ vọng rồi file được restore. Dev-server curl bổ sung bị dừng khi
đã đủ evidence chính; không ảnh hưởng branch CafeKit.

## Thứ tự & ước lượng

| Bước | Việc | Ước |
|---|---|---|
| Đợt 1 | 1.1→1.7 + sửa PR body → merge PR #76 | 0.5-1 ngày |
| Đợt 2a | 2.1 develop + 2.7 scoring (đụng nhau qua quality-gate) | 1 ngày |
| Đợt 2b | 2.2 git + 2.3 research + 2.4 inspect + 2.5 brainstorm + 2.6 + 2.8 | 1 ngày |
| Đợt 2c | 2.9 domain sweep + 2.10 verify + A/B | 0.5-1 ngày |

## Quyết định đã chốt (user, 2026-08-05 — theo đề xuất mặc định)

1. **`--flash --parallel` = parallel wins** (2.1e giữ nguyên): waves luôn chạy quality gate; khi cả 2 flag cùng xuất hiện, thông báo cho user rằng `--flash` bị bỏ qua.
2. **Đổi tên `god-developer` → `implementer` gộp vào Đợt 2a** — cùng lượt đụng develop/quality-gate, đồng bộ 6 điểm theo fix-map D (migration-manifest, codex-install AGENT_NAMES, opencode command templates, SKILL develop/hotfix/test, orchestrator.md, parallel-waves.md).
3. **Đợt 1 giao worker qua Herdr** theo convention hiện hành (controller coordinator-only; reviewer/verifier độc lập session mới trước khi merge).
4. Sáu quyết định mặc định ở bảng đầu file (Q1-Q6) giữ nguyên hiệu lực.

## Trạng thái

**ĐÃ HOÀN TẤT ĐỢT 2** — 2.1–2.9 đã triển khai; self-tests đạt 229/229; reviewer đã
được chạy lại sau khi xử lý các finding; docs, A/B evidence, commit `925e094`, push và
`docs/.sync_hash` đã hoàn tất trên branch `refactor/instructions-2026`.

Việc còn ngoài phạm vi thi công: merge PR #76 vào `dev`.
