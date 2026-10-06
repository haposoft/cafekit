# Review ngữ nghĩa nội dung instructions — bản đối chiếu

**Ngày**: 2026-08-05 · **Phạm vi**: 4 file instruction shipped (PR #76, branch `refactor/instructions-2026`) + 14 SKILL.md
**Mục đích**: Baseline đối chiếu cho editorial pass trước merge PR #76 và cho Wave 4 (skills dedupe) của `plans/20260804-cafekit-opus5-fix-map.md`
**Phương pháp**: Đọc từng câu như biên tập viên; đánh giá nghĩa, độ mơ hồ, đối tượng nghe, tính kiểm chứng được. Không đánh giá kiến trúc/installer (đã có ở fix-map).

---

## PHẦN 1 — 4 file instruction shipped (payload PR #76)

### 1.1 `src/common/AGENTS.md` (core, 38 dòng) — 8/10, file tốt nhất

| Dòng/đoạn | Vấn đề ngữ nghĩa | Sửa đề xuất |
|---|---|---|
| "Keep scope surgical" | "surgical" = biệt ngữ nội bộ, không định nghĩa hành vi, không kiểm chứng được | Thay bằng câu hành vi: "Deliver exactly what was asked; do not expand, polish, or add optional work" |
| "`Completion Criteria` and `## Evidence` are the source of truth" | Thiếu neo: source of truth của cái gì, ở đâu | Thêm "in `specs/<feature>/tasks/*.md`" |
| "`NO_TESTS` and `0 tests + exit 0` do not pass..." | **Dòng mạnh nhất file** — cụ thể, không thể hiểu nhầm | Giữ nguyên |
| "Hook blocks are instruction boundaries" | Nhập nhằng cú pháp: "blocks" = danh từ (khối) hay động từ (chặn)? | "When a hook blocks an action, that is an instruction boundary — do not work around it" |
| Delegation: "Verification comes from machine gates" | "machine gates" = biệt ngữ không có vật quy chiếu trong project user | Neo: "from the project's hooks and validators" |
| 3 stub (Commands/Do not touch/Slow) | HTML comment bị strip → model thấy 3 heading RỖNG; "## Do not touch" trống có thể đọc thành "không có gì cần tránh" | Chấp nhận được; cân nhắc installer bỏ section khi chưa điền |
| Language generic: "Use the configured project language" | "configured" ở đâu? — tự quy chiếu vào config model không thấy; bản unpatched là noise | Bản unpatched tự đứng: "Match the language the user writes in" |

Response style / Uncertainty / Delegation: trung thành template, giọng mệnh lệnh đúng — giữ.

### 1.2 `src/claude/CLAUDE.md` (wrapper, 23 dòng) — 6/10

| Vấn đề | Chi tiết | Sửa |
|---|---|---|
| **Tái phạm one-rule-one-place** | 2 rule lặp với core: "hook block is an instruction boundary" + "conventional commits / no AI attribution" — có ở CẢ core lẫn wrapper | Xóa khỏi wrapper; wrapper chỉ chứa delta riêng Claude |
| Câu lạc đối tượng #1 | "Claude Code loads `AGENTS.md` above as shared project instructions" — meta-commentary cho người bảo trì, model không cần được kể nó vừa load gì | Chuyển thành HTML comment (miễn phí cho người, vô hình với model) |
| Câu lạc đối tượng #2 | "review hook changes before trusting them" — "trust" là hành động của NGƯỜI (lệnh `/hooks`), model không thi hành được | HTML comment hoặc bỏ |
| **Mâu thuẫn tầng ngôn ngữ** | Core: "use the configured project language" + Wrapper: "Always respond in English" — 2 rule ngôn ngữ cùng load; hiện wrapper thắng nhờ vị trí, nhưng layering mong manh (bug `--lang vi` là hệ quả) | Language section tồn tại ở ĐÚNG 1 file — bỏ khỏi core, wrapper per-runtime giữ |
| Addressing "anh" hardcode | Giá trị locale của repo dev lọt vào template ship toàn cầu | Template không ship section Addressing; installer thêm khi user opt-in |

Điểm tốt giữ: "Consult `.claude/rules/state-sync.md`... when their topics apply" — pattern tự-scope kiểu AgentKit.

### 1.3 `src/codex/AGENTS.md` (16 dòng) — 7.5/10

| Vấn đề | Chi tiết | Sửa |
|---|---|---|
| **Lỗi cấy ghép path** | "Edit project-local skills there, not global `~/.claude/skills`" — file CODEX quy chiếu global path của CLAUDE. Lặp y hệt ở OpenCode L8 | "edit them in the project" (bỏ vế `~/.claude`) |
| "may not" nhập nhằng | "Hosted tools... **may not** enter the local hook path" — đọc được thành cấm ("không được phép") hoặc cảnh báo ("có thể không"). Ý gốc = cảnh báo | "hooks are not a complete security boundary; hosted tools can bypass them" |

### 1.4 `src/opencode/AGENTS.md` (31 dòng) — 7/10

| Vấn đề | Chi tiết | Sửa |
|---|---|---|
| **Nén mất phần hành động** | "Map task state and questions to OpenCode built-ins" — bản cũ có mapping cụ thể (`TodoWrite → todowrite`, `AskUserQuestion → question`), bản mới giữ vỏ trừu tượng vứt ruột. Ngược nguyên tắc commands-not-prose | Trả lại 1 dòng mapping cụ thể |
| Câu tautology | "plugins provide only the project-specific gates they implement" — lặp thừa, không nói gate nào có/không | Viết rõ: gate nào của Claude có bản OpenCode, phần còn lại không tồn tại |
| Lỗi cấy ghép path (L8) | Giống Codex 1.3 | Giống trên |

Điểm mạnh: Command surface 7 lệnh thật kèm cú pháp = content ROI cao nhất; dòng disambiguation `hapo:*` hữu ích.

---

## PHẦN 2 — 14 SKILL.md (13 chuỗi workflow + 1 domain đại diện)

### 2.1 Phát hiện xuyên suốt

**A1. Mâu thuẫn 3 tầng delegation trong `develop`** (phát hiện quan trọng nhất — giải thích hiện tượng worker đốt 100% context vào sub-agent):

| Vị trí | Câu | Mức |
|---|---|---|
| Anti-Rationalization L118-119 | "ALWAYS delegate via the `Agent` tool" | Bắt buộc |
| Step 2 L165 | "Mandatory per task: Call `Agent(inspector)` before EVERY active task" | Bắt buộc |
| Step 3 L182 | "Act as `god-developer` **OR directly write code**" | Tùy chọn |
| Mermaid L128 + "diagram is authoritative" | "Step 3: Implement Code (god-developer)" — mất vế "OR directly" → bản nghiêm ngặt thắng | Ép bắt buộc |

Khi mơ hồ, model chọn đường an toàn = delegate tất cả → agent sprawl.

**A2. Một rule lặp 3 lần trong cùng file `develop`**: Placeholder/Reachability/Named-Technology xuất hiện ở Step 3 (8 named Rules) → Step 4 (điều kiện FAIL) → Step 5 (điều kiện receipt), ba diễn đạt hơi lệch nhau. Dedupe được ~60-80 dòng không mất nghĩa.

**A3. Hai giọng văn**:
- Giọng chuẩn (house style): `sync`, `delegate`, `question`, `debug` — mỗi câu một hành động kiểm chứng được
- Giọng sân khấu: `research` ("Be brutal"), `git` ("clean-room execution engine" — dùng SAI thuật ngữ; "proprietary Node scripts" — script của chính kit; "VSC" — viết ngược VCS)

**A4. Độ chính xác giả bằng số**:
- `Score >= 9.5 & Zero Critical`: giải số học trừ điểm → quy tắc ngầm = 0 Critical, 0 High, ≤1 Medium — nhưng không câu nào nói thế. Thay bằng quy tắc chữ.
- Domain skills: "98% SQL injection reduction", "83% migrations fail", "Vitest 50% faster" — số liệu không nguồn viết như sự thật = nhiên liệu hallucination có vỏ trích dẫn.

**A5. Rò rỉ locale + đường dẫn dev (BUG THẬT)**:
- **Bug 1** `research/SKILL.md` L43: câu chỉ dẫn tiếng Việt giữa file tiếng Anh + hardcode path `packages/spec/src/claude/skills/specs/templates/research.md` — chỉ tồn tại trong monorepo dev. Regex transform installer chỉ rewrite chuỗi `.claude/...` → `src/claude/` không khớp → **ship path hỏng cho mọi user**.
- **Bug 2** `inspect/SKILL.md` mode `ext`: ghi "gemma-4-31b-it (installed with npx @haposoft/cafekit)" nhưng gemini-cli setup đã bị gỡ khỏi installer từ 0.14.2 (xác nhận trong comment `post-install.js`) → mode mồ côi dependency.
- `question/SKILL.md`: ví dụ câu hỏi bằng tiếng Việt trong skill ship toàn cầu (cùng họ lỗi addressing "anh").

**A6. Mâu thuẫn nội bộ `brainstorm`**: Anti-Rationalization L62 "'Let me explore the code first' → Follow the process" đứng cạnh HARD-GATE-SCOUT-FIRST (L31) bắt scout (= explore) trước tiên. Bảng phủ đầu đúng hành vi mà gate bắt buộc.

### 2.2 Bảng chấm từng skill

| Skill | Dòng | Điểm | Vấn đề chính | Điểm sáng |
|---|---|---|---|---|
| `sync` | 48 | **9** | — | Mẫu mực, 6 directive chính xác. **House style** |
| `delegate` | 124 | **9** | — | Cụ thể nhất kit (flags thật, anti-goals rõ). House style |
| `debug` | 254 | **8.5** | — | Gates chuẩn; câu instrumentation L30 mẫu mực; "--quick giảm độ sâu không bỏ bước" |
| `question` | 167 | 8 | Ví dụ tiếng Việt (A5) | ANSWER-ONLY-GATE gọn đúng |
| `hotfix` | 298 | 8 | — | Anti-Rationalization ở đây NHẤT QUÁN với gates; "Symptom fixes are FAILURE" rõ |
| `test` | 193 | 7.5 | Ép spawn test-runner cả case đơn giản | NO_TESTS semantics chuẩn |
| `code-review` | 96 | 7 | Ngưỡng 9.5 (A4) | 3-stage gọn |
| `specs` | 410 | 7 | REJECTED-style + lặp validator (đã review 08/04) | DoCT table + "Validator-enforced (do not re-check)" = pattern chuẩn |
| `brainstorm` | 189 | 7 | A6; "Ecosystem Swarm" nhãn vai trò khó hiểu; trigger "deeply complex" không định nghĩa | Question framework + 5 exact requirements tốt |
| `inspect` | 151 | 6 | Bug 2; 3 hệ đếm agent lẫn lộn (1-6 / 3-6 / 1-10) | Scope gate + no-scan lists tốt |
| `develop` | 284 | **5.5** | A1 + A2 + diagram lệch prose | Đặc tả `--flash` xuất sắc (bắt log chuỗi chính xác, CẤM nói "Test PASS"); CWD Protocol = gotcha thật (chữ "crash" nói quá) |
| `git` | 66 | **5** | A3 nặng nhất (clean-room/proprietary/VSC sai nghĩa); regex secret false-positive (`token` khớp "tokenizer"); `pr` hardcode nhánh `develop`/`main` vs convention repo `dev` | Finish options 4 lựa chọn rõ |
| `research` | 58 | **4** | Bug 1; "Be brutal" register | Cấu trúc facade đúng |
| `backend-development` (đại diện 9 domain skills) | 101 | 5 | Bách khoa đóng vai instruction; stats không nguồn (A4) | Decision Matrix hành động được — giữ matrix bỏ stats |

---

## PHẦN 3 — Danh sách hành động tổng hợp

### Bug phải sửa (không phải văn phong)

1. `research/SKILL.md` L43 — bỏ câu tiếng Việt; sửa path → `.claude/skills/specs/templates/research.md` (để transform tự rewrite per-platform)
2. `inspect/SKILL.md` — quyết mode `ext`: bỏ (đề xuất, YAGNI) hoặc ghi "cần tự cài gemini-cli"
3. `develop/SKILL.md` — hợp nhất 3 phát biểu delegation về MỘT câu (input trực tiếp cho Wave 4 tiered delegation)
4. Claude-only `--lang vi` không patch AGENTS.md (`post-install.js` `instructionTargets` thiếu target AGENTS.md cho claude) — đã báo 08/04, thuộc PR #76

### Editorial pass trước merge PR #76 (4 file instruction)

5. Core: sửa "surgical"→câu hành vi; "Hook blocks"→hết nhập nhằng; neo "machine gates"; Language unpatched tự đứng
6. Wrapper Claude: xóa 2 rule lặp; 2 câu meta→HTML comment; Language về 1 nơi
7. Codex+OpenCode: bỏ quy chiếu `~/.claude/skills`; "may not"→cảnh báo rõ; OpenCode trả lại mapping built-ins; sửa câu tautology plugins

### Editorial pass Wave 4 (skills)

8. Dedupe nội-file `develop` (Step 3/4/5 → nói 1 lần + pointer): −60-80 dòng
9. Thay ngưỡng 9.5 bằng quy tắc chữ: "no Critical, no High, at most one Medium"
10. Đưa `git` + `research` về house style (2 file nhỏ nhất, sửa nhanh nhất)
11. Quét stats không nguồn ở 9 domain skills; giữ Decision Matrices
12. Anti-Rationalization: giữ `hotfix` (nhất quán), sửa/bỏ `brainstorm` (mâu thuẫn A6) + `develop` (A1)
13. `question`: đổi ví dụ tiếng Việt → tiếng Anh
14. `git`: sửa VSC→VCS, bỏ "clean-room"/"proprietary"; regex secret thêm word-boundary; `pr` đọc nhánh đích từ repo thay vì hardcode

### House style chuẩn (tham chiếu khi viết lại)

- **Mẫu tốt trong kit**: `sync` (48d), `delegate` (124d), `debug` (gates + instrumentation clause), đặc tả `--flash` của develop, DoCT table của specs
- **Nguyên tắc**: mỗi câu = 1 hành động kiểm chứng được; không biệt ngữ chưa neo; không số liệu không nguồn; không câu lạc đối tượng (lệnh cho model ≠ ghi chú cho người — ghi chú dùng HTML comment); một rule một chỗ, chỗ khác pointer

---

## PHẦN 4 — Liên kết

- Fix-map tổng: `plans/20260804-cafekit-opus5-fix-map.md` (mục 3 ở trên = input Wave 4; mục 5-7 = editorial trước merge PR #76)
- PR đang mở: https://github.com/haposoft/cafekit/pull/76 (branch `refactor/instructions-2026`)
- Review lịch sử: reviewer `review-wave1` + verifier `verify-wave1` (5 defects đã sửa, verified 08/05)
- Chưa cover: 15 skill còn lại chưa đọc từng câu (chrome-devtools 666d, ui-ux-pro-max 664d, pptx 489d, frontend-development 406d, docs 269d, mobile-development 218d, docx 202d, các domain nhỏ) — đọc khi Wave 4 đụng tới; kỳ vọng cùng họ vấn đề với backend-development

---

## PHẦN 5 — Kỹ thuật viết học từ AgentKit (`~/Desktop/cafekit-ref/.claude`, khảo sát 08/05)

Bối cảnh quan trọng: AgentKit và CafeKit **cùng tổ tiên ClaudeKit** — bảng Anti-Rationalization và regex secret-scan giống hệt nhau. Đây là phép so sánh cùng-nguyên-liệu-hai-cách-biên-tập. Đã đọc: ak-fix (336d), ak-cook (291d), ak-scout (120d), ak-git (126d), ak-test (125d), ak-code-review (202d).

### 5.1 Kỹ thuật áp thẳng vào action list của Phần 3

| # | Kỹ thuật AgentKit | Nguyên văn mẫu | Giải quyết vấn đề CafeKit |
|---|---|---|---|
| T1 | **Điều khoản tách "skill nhắc agent" khỏi "phải spawn agent"** (ak-scout L46-49) | *"Do not spawn subagents only because this skill mentions Explore... If that explicit request is absent, scout in the main agent with `search_files` and `read_file`."* | **Thuốc giải trực tiếp cho A1** (mâu thuẫn 3 tầng delegation của develop) — action #3. Delegation điều kiện hóa theo runtime policy + user request |
| T2 | **"One concrete sentence each" + gọi tên từ mơ hồ** (ak-fix EXACT-ROOT-CAUSE) | *"answer ALL of these in one concrete sentence each"* + *"If ANY item is vague ('probably', 'I think', 'something with…')"* | Nâng cấp root-cause contract của hotfix/debug: ràng buộc format đầu ra kiểm chứng được + máy dò mơ hồ tự vận hành bằng danh sách từ cấm |
| T3 | **Menu lựa chọn viết sẵn nguyên văn** (ak-fix/ak-cook NO-SIDE-EFFECTS) | 2-4 options là câu trích dẫn literal có placeholder: *"Keep the fix and update the dependent code at `<files>`..."* | hotfix hiện liệt kê option trừu tượng → script hóa để UX nhất quán, model khỏi ứng biến |
| T4 | **Không có điểm số — rule bằng chữ + staged gates** (ak-code-review) | Không tồn tại ngưỡng 9.5; thay bằng: Stage 1 spec-compliance MUST pass trước Stage 2; *"Critical findings block merge until fixed and re-verified"*; *"About to claim status → RUN verification command FIRST"* | Xác nhận action #9 (bỏ số học 9.5). Kèm câu stance đáng mượn: *"Default assumption: reviewed code may be AI-assisted. Do not trust polished shape, confident comments, or happy-path tests."* — chỉ đích danh THỨ không được tin |
| T5 | **Menu-on-no-args** (ak-git/ak-test/ak-code-review) | *"If invoked WITHOUT arguments, use ask_user with header 'Git Operation', question 'What would you like to do?'"* + bảng options | CafeKit skills mặc định giả định có args; pattern này rẻ, UX tốt — đáng thêm cho git/test/code-review |
| T6 | **Output template literal** (ak-git, ak-cook) | `✓ staged: N files (+X/-Y)` · `✓ Step [N]: [status] - [metrics]` | Hệ thống hóa thứ develop `--flash` đã làm đúng (bắt log chuỗi chính xác) ra toàn kit |
| T7 | **Mode × behavior matrix** (ak-cook L220-227) | Bảng mode → research/testing/gates/progression | Đóng lỗ hổng thật của develop: tương tác flag không đặc tả (`--flash` + `--parallel` = gì? — hiện không có câu trả lời) |
| T8 | **Error table 2 cột** (ak-git) | Error → Action (Secrets → Block; Push rejected → suggest rebase) | Ngữ nghĩa failure gọn cho git skill |
| T9 | **Capability-neutral naming + bảng map per-runtime** (ak-scout Runtime Tooling) | `search_files`/`ask_user capability`/`the live task-management surface` + map riêng Claude/Codex Desktop | Portability giải ở TẦNG SOẠN THẢO thay vì regex transform lúc cài — chính regex transform là thủ phạm Bug 1 (path `src/claude/` lọt lưới). Trade-off: câu chữ hơi vụng (*"the engineer project-organization skill" skill*) |

### 5.2 Trả lời Open Q3 bằng bằng chứng đối chiếu

Bảng Anti-Rationalization của ak-fix/ak-cook **nhất quán nội bộ** — không entry nào cấm hành vi mà gate bắt buộc (gates của họ mở bằng intent-frame trước, scout sau, nên "Let me explore first" không xung đột). Kết luận: **thiết bị này không lỗi, entry của CafeKit viết lỗi** (brainstorm A6, develop A1). Lựa chọn: sửa entry cho nhất quán (theo AgentKit) hoặc bỏ hẳn (theo hướng model-mạnh của guide) — cả hai đều hợp lệ, chỉ cần một chuẩn.

### 5.3 Lỗi của AgentKit — KHÔNG copy

- Block `--advice` (~28 dòng) duplicate nguyên văn giữa ak-cook và ak-fix — họ cũng chưa giải one-rule-one-place; duplicate nguyên văn ít drift hơn paraphrase nhưng vẫn nên là shared reference
- Regex secret cùng false-positive (`token` khớp "tokenizer") — bug di truyền từ tổ tiên chung, cả hai kit cùng cần word-boundary
- ak-git L84: *"Only use feat, fix, or perf prefixes for files in .claude directory (do not use docs)"* — rule bí ẩn không lý do, fail đúng câu hỏi "không có nó thì hỏng gì"
- Smart Intent Detection (ak-cook): match chuỗi "trust me"/"quick" để đoán mode — dễ vỡ, không nên bắt chước

---

## PHẦN 6 — Review độc lập thứ 3 (Codex gpt-5.6-sol, 08/05) — kết quả & calibration

Chạy theo brief `plans/20260805-codex-review-brief.md` (3 phase, blind trước khi mở Appendix). **Calibration xuất sắc**: tự tìm ra 6/6 lỗi Appendix A, 0 finding sai, và phát hiện **1 Critical + 5 High mới** — tất cả đã được kiểm chứng độc lập lại bằng thực nghiệm (08/05):

| # | Finding Codex | Kiểm chứng lại | Ghi chú |
|---|---|---|---|
| C1 | Regex secret-scan mới trong `git/SKILL.md:29` **bỏ lọt secret thật**: MISS cả 5 format phổ biến (OPENAI_API_KEY, AWS_SECRET_ACCESS_KEY, GITHUB_TOKEN, JWT_SECRET, `"apiKey":`) — `\b` fail vì `_` là word-char; regex CŨ bắt được (substring). Kèm rủi ro "show the lines" in giá trị secret vào transcript | **CONFIRMED bằng test 7 mẫu** | **Regression do draft của mình** (plan 2.2): sửa false-positive "tokenizer" nhưng chưa từng test true-positive. Bài học: fix detector phải test cả 2 chiều |
| H2 | Fresh install không `--lang` → runtime ghi `responseLanguage: "en"` → hook inject "Respond in en", trái core "Match the language the user writes in" | CONFIRMED (`{"responseLanguage":"en"}`) | Gốc pre-existing (`context.js` default locale='en') nhưng giờ mâu thuẫn trực tiếp core mới |
| H3 | `quality-gate.md` spawn test-runner + 2× code-auditor **vô điều kiện** — không biết tier, trái Delegation policy | CONFIRMED (0 mention tier) | Gap propagation lớn nhất: policy mới chưa chảy xuống reference |
| H4 | `--flash --parallel` 2 contract ngược nhau: Mode Matrix nói parallel wins, develop L227 nói cứ có `--flash` là Flash Gate | CONFIRMED | Matrix thêm vào nhưng prose không được điều kiện hóa |
| H5 | Enum verdict không thống nhất: frontmatter code-auditor `PASS/NEEDS FIXES/USER INTERVENTION` vs body `PASS/FAIL` vs verification-gate "Incomplete PASS" | CONFIRMED | |
| H6 | Rename chưa end-to-end: upgrade không prune `god-developer.md` cũ (3 runtime); `cafekit-web/.../catalog-visuals.tsx:15` còn render god-developer | CONFIRMED | copy-payload không có cơ chế prune agents; manifest thiếu obsolete entry |
| M7 | Malformed CORE marker → installer báo "unchanged" + exit 0, không cảnh báo | Confirmed theo code đã đọc | Fail-safe preserve đúng, thiếu warning |
| M8 | Stats sweep chưa hết: `mobile-development/SKILL.md:120` (121K/170K/35%/46%), `mobile-best-practices.md:490` | Nhận — grep sweep của mình quá hẹp pattern | |
| M9 | Changelog/PR body thiếu rộng hơn A6 (delegation tiers, verdict migration, git rewrite; PR ghi sai số test) | Nhận | |

**Trace 3 dòng xóa của develop**: Codex xác nhận cả 3 preserved (khớp kết luận trước) — dedupe không mất nghĩa.

**Kết luận sau 3 lượt review độc lập**: PR #76 cần **1 fixup commit** xử lý C1 + H2-H6 + M7-M9 + 3 editorial leaks (A1-A4) trước merge, sau đó review riêng cho fixup diff.

## Unresolved Qs (chờ quyết)

1. Mode `ext` của inspect: bỏ hẳn (đề xuất) hay giữ + ghi chú tự cài?
2. Domain skills: quét stats ngay trong editorial pass hay chờ keep/cut tổng (plan §5.1)?
3. Anti-Rationalization: ~~bỏ đồng loạt hay giữ nơi nhất quán~~ → **đã có bằng chứng 5.2**: thiết bị OK nếu entry nhất quán với gates; chọn sửa-cho-nhất-quán hay bỏ-đồng-loạt vẫn chờ chốt
4. 3 heading stub rỗng sau strip comment: chấp nhận hay installer bỏ section chưa điền?
5. Language section rút về 1 nơi: wrapper per-runtime (đề xuất) hay core?
6. (Mới) Portability: giữ regex transform lúc cài hay chuyển dần sang capability-neutral authoring như AgentKit (T9)? — quyết định kiến trúc, ảnh hưởng cách viết mọi skill sau này
