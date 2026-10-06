# CafeKit 2026 Remake — Tổng hợp toàn bộ nội dung thảo luận

> Tổng hợp từ phiên làm việc 2026-07-13 → 2026-07-20. Bao gồm: audit, research 5 track, quyết định đã chốt, quyết định đang chờ, kiến trúc đích, lộ trình.

---

## 0. Mục tiêu tổng thể

**SDD → TDD → RDD**

- **SDD (Spec-Driven Development)**: mọi tính năng bắt đầu từ spec có máy kiểm chứng — không code trước khi có spec, không claim xong trước khi có receipt. Đây là moat hiện tại của CafeKit.
- **TDD (Trust-Driven Development)**: khi SDD chạy đủ lâu trong nội bộ haposoft, nó tạo ra *bằng chứng tin cậy* có thể trình bày được — "mọi task đều có receipt máy-kiểm, không phải lời tự nhận". Trust là sản phẩm phụ của SDD được vận hành nghiêm túc.
- **RDD (Revenue-Driven Development)**: Trust → differentiator khi chào dự án ("verified AI delivery") → win-rate hợp đồng cao hơn → năng suất nội bộ tăng → margin tăng. Revenue không đến từ bán kit mà đến từ *uy tín delivery* mà kit tạo ra.

**Chuỗi nhân quả**: SDD tạo receipts → receipts tạo trust → trust tạo revenue. Remake 2026 phải giữ nguyên chuỗi này và làm nó *dễ tiếp cận hơn* (plugin-first, loop mode, ceremony co giãn) để nhiều team hơn thật sự dùng — vì kit không được dùng thì không tạo ra trust, không tạo ra revenue.

### Nguyên tắc thiết kế (user chốt 2026-07-20)

> "Thực hiện thật đơn giản, minh bạch, nhưng vẫn hiệu quả đạt được mục tiêu **khi người dùng muốn**."

Ba trụ, giải đúng căng thẳng "simple vs powerful" mà mọi framework chết vì nó:

1. **Simple by default** — đường mặc định zero ceremony: cài 1 lệnh, gõ việc là làm. Việc nhỏ không bị bắt viết spec, không bị hỏi 5 câu. Chỉ MỘT luật luôn bật: claim done phải có bằng chứng.
2. **Transparent always** — mọi trạng thái nằm trong git đọc được/diff được; gate khi chặn phải in rõ VÌ SAO + LỐI THOÁT; escape hatch công khai trong runtime.json (tắt được, nhưng có chủ đích và có dấu vết); không magic ẩn.
3. **Powerful on demand** — sức mạnh đầy đủ (full SDD pipeline, red-team, --loop, night shift, team mode) nằm sau lời gọi có chủ đích của user, không tự đè lên. Máy đề xuất tier theo số đếm; user một từ để override cả hai chiều (ép sâu `--deep`, ép nhanh "just do it").

**Ứng dụng làm tiêu chí keep/cut**: mỗi skill/agent phải qua 3 câu — (a) có làm đường mặc định đơn giản hơn không? (b) hành vi có minh bạch không? (c) có phải power-on-demand đúng nghĩa không? Trượt cả 3 → cut.

---

## 1. Xuất phát điểm — Audit CafeKit 0.14.1

Sau khi hoàn tất chiến dịch audit + 7 PR (#65–#71 merged), suite 161 tests, user tuyên bố:

> "remake toàn bộ cafekit theo chuẩn của 2026 luôn. TOÀN BỘ, TOÀN BỘ"

Bổ sung cùng ngày: **"tinh gọn lại cafekit, phù hợp với solo builder và cả team nhỏ trong công ty"**.

---

## 2. Research nền tảng — 5 Track

### Track 1 — Plugin/marketplace mechanics (official docs)
- Plugin system có **~29 hook events** đầy đủ (Stop, PreToolUse, SubagentStart, TaskCompleted…) → toàn bộ enforcement layer CÓ THỂ sống trong plugin.
- `${CLAUDE_PLUGIN_DATA}` = thư mục state bền vững, sống sót qua update. `${CLAUDE_PLUGIN_ROOT}` thay đổi mỗi version (chỉ dùng cho assets read-only).
- Exec-form bắt buộc khi có `args` (không shell expansion). 11 hook hiện tại dùng `$CLAUDE_PROJECT_DIR` shell-form → **phải viết lại toàn bộ**.
- Hard limits plugin: không được write project root, không merge CLAUDE.md, không sửa settings.json → CLI mỏng vẫn cần.

### Track 2 — Hệ sinh thái 2026
- Spec Kit (~93k★), OpenSpec (~52k★), BMAD: đều prompt-only, không có deterministic gates.
- **CafeKit là bản duy nhất kết hợp SDD + bundled skills + machine gates** — positioning: "full-stack spec-driven runtime".
- Chính sách 04/2026: Anthropic khóa OAuth subscription cho harness ngoài (OpenClaw ~247k★ bị đầu tiên). 06/2026 nới lại bằng "Agent SDK credit" pool riêng. **CafeKit chạy trong Claude Code chính chủ → không bị ảnh hưởng, thậm chí được củng cố**.

### Track 3 — Migration patterns
- ESLint v8→v10: opt-in → default+compat → hard removal (~18 tháng); tooling tự động tăng adoption ~40%→70-80%.
- Husky: tách "immutable runtime" khỏi "user-editable directory".
- shadcn: copy-into-project đúng cho UI, SAI cho enforcement runtime → chỉ mượn pattern overrides.
- **Kết luận**: 3-phase rollout + hybrid CLI + `migrate` command + overrides escape hatch.

### Track 4 — ClaudeKit reference (~/Desktop/claudekit-engineer)

**4a. Kiến trúc (lean lens):**
- ClaudeKit ~273K LOC, 87 skills — nặng gấp 7x nhưng always-on context chỉ ~40 dòng → lean = nhỏ context thường trực, không phải nhỏ repo.
- **5 borrow**: CLAUDE.md ≤50 dòng + lazy routing; CLI-as-state-API (`ck plan check/uncheck`); compact recovery; manifest checksum + deletions list; stateless git-diff gate (simplify-gate: block ship khi diff >400 LOC/8 files).
- **3 giữ**: two-layer spec chạy trên project của user; self-contained npx; catalog skill gọn.

**4b. Critical-thinking patterns (Top 10):**
1. **Iron Law**: cấm claim xong khi chưa có bằng chứng tươi; 5-bước gate.
2. **Evidence auto-reject**: finding không có `file:line` → Reject không xét nội dung.
3. **5-tuple gate**: output/acceptance/scope/constraints/touchpoints trước design.
4. **Anti-rationalization tables**: gọi tên suy nghĩ lách gate ngay cạnh gate.
5. **Scale-by-count tiering**: số phase → số reviewer/câu hỏi/budget tự động.
6. **[UNVERIFIED] tags + resolution duty**: persist uncertainty, bắt buộc gỡ sau.
7. **Whole-plan consistency sweep**: sau mỗi review edit, rà toàn bộ file.
8. **Decision stability**: quyết định đã verify không bị lật bởi audit trừu tượng.
9. **Falsification-only schema**: critic chỉ có field phủ định, không có field khen.
10. **Machine gate chỉ ở ship verbs**: upstream prose, chỉ ship/PR/deploy mới code-backed.

**4c. Install mechanics (ck CLI 4.5.2):**
- npm CLI + private GitHub Releases = license gate thực tế.
- Manifest SHA-256 per-file + `deletions[]` glob + CI fail-closed gate.
- Settings selective-merge + `installedSettings` ledger cho hook/mcp.
- **Market intel**: claudekit.cc → 301 → agentkit.best — pivot thương mại đóng (AgentKit Engineer $99, app $19-49/năm). Tiền lệ giá kit $99 tồn tại.
- **6 borrow cho thin-CLI/migrate**: checksum manifest; deletions[] + CI gate; selective-merge + ledger; offline fallback; scoped backups; sourceDir/runtimeDir split.

### Track 5 — repository-harness (~/Desktop/repository-harness)
- Tác giả: Hoang Nguyen (hoangnb24), MIT, Rust CLI + SQLite, v0.1.17, 244 commits.
- **Thesis**: "Coding agents không chỉ cần prompt tốt hơn. Chúng cần repository tốt hơn." / "The app is what users touch. The harness is what agents touch."
- **7 cơ chế**: authority gate (read-only vs change trước khi mutate); risk lanes tự động (tiny/normal/high-risk); context rules phase×lane (Must/Should/Skip); policy/state split (markdown vs SQLite); proof-gated completion (`story complete` chạy fresh proof); trace + scoring; self-improvement loop H0→H5.
- **Phát hiện đắt nhất — tiến hóa hội tụ**: proof-gated `story complete` ≡ spec-gate receipts của CafeKit — hai dự án độc lập cùng đến một kết luận. Xác nhận mạnh nhất từ bên ngoài cho moat thesis.
- **4 borrow**: context rules phase×lane; auto risk-lane; tool registry degrade ladder; AGENTS.md shim.
- **Giữ khác biệt**: state trong git (họ SQLite gitignored, không share team); self-contained (không binary đóng).
- **Để sau (YAGNI)**: self-improvement loop H0→H5.

---

## 3. Kiến trúc đích — 5 tầng

```
┌─ 1. PHÂN PHỐI ──────────────────────────────────────────────┐
│  cafekit (plugin core)   cafekit-extras (plugin)   CLI mỏng │
│  skills+agents+hooks     office/chrome-devtools    CLAUDE.md │
│  +statusline, update     nặng, cài khi cần         runtime.json│
│  qua marketplace                                   migrate   │
├─ 2. NGỮ CẢNH LUÔN-NẠP (thu nhỏ ~4x) ────────────────────────┤
│  Contract ≤50 dòng · mọi rule/routing lazy-load khi cần     │
├─ 3. LUỒNG LÀM VIỆC (1 trục, 4 chế độ vận hành) ─────────────┤
│  question→brainstorm→specs→develop→test→review→git           │
│  Interactive · Loop (--loop) · Night shift · Team            │
│  ceremony tự co giãn theo SỐ ĐẾM task                       │
├─ 4. LỚP SUY LUẬN (mới — học ClaudeKit) ──────────────────────┤
│  Iron Law · evidence auto-reject · 5-tuple gate ·           │
│  anti-rationalization · decision stability · [UNVERIFIED]   │
├─ 5. MOAT ENFORCEMENT (giữ nguyên, chuyển nhà) ──────────────┤
│  validators L1/L2 · spec-gate receipts · scaffold-guard ·   │
│  two-layer state → hooks exec-form, cache CLAUDE_PLUGIN_DATA │
└─────────────────────────────────────────────────────────────┘
```

**Câu thần chú**: "Loop không phanh = slop. Receipts chính là cái phanh."

**Harness engineering — 3 tầng:**
| Tầng | Ai làm | Ví dụ |
|---|---|---|
| Runtime (vòng lặp, tools, permissions) | Anthropic | Claude Code |
| Workflow trong phiên (gates, receipts, skills) | **CafeKit** | spec-gate, validators, loop mode |
| Repository (ngữ cảnh + state bền trong repo) | repository-harness | AGENTS.md, decisions/, TEST_MATRIX |

---

## 4. Quyết định đã chốt

| Quyết định | Kết luận | Lý do |
|---|---|---|
| Remake toàn bộ | ✅ | User: "TOÀN BỘ, TOÀN BỘ" |
| Lean, solo + team nhỏ | ✅ | User chốt cùng ngày |
| Plugin-first hybrid | ✅ | Policy 04/2026 ủng hộ; installer = bug surface lớn nhất |
| Moat giữ nguyên | ✅ | Chỉ chuyển nhà sang plugin |
| 4 operating modes, Loop trước | ✅ | Loop rẻ nhất; Night shift chờ Loop chứng minh |
| Sản phẩm độc lập, nội bộ dùng trước | ✅ | haposoft dogfood ở 0.15 |
| OSS giữ nguyên, không paid tier | ✅ | Mọi enforcement free 100% |
| Không budget mkt → organic | ✅ | Marketplace + docs + team mkt haposoft |
| OpenCode: đóng băng ❄ | ✅ | Policy cap credit + user bỏ §3.5 |
| Theo trend harness/loop | ✅ | User: "vẫn muốn theo các xu hướng mới nhất như harness, loop..." |

---

## 5. Quyết định đang chờ

### 5.1 Keep/cut 28 skills + 13 agents
Chưa có bảng đề xuất. Tôi cần dựng bảng (giữ/gộp/bỏ + lý do từng dòng) để bro duyệt.

### 5.2 Namespace: `/hapo:` → `/cafekit:`?
Tên plugin quyết định tiền tố lệnh gõ hằng ngày. Phân tích:
- Plugin tên `cafekit` → `/cafekit:specs` — brand nhất quán, dài hơn 4 ký tự.
- Plugin tên `hapo` → `/hapo:specs` — zero ma sát chuyển đổi, nhưng brand chẻ đôi vĩnh viễn.
- Internal-first nghĩa là đổi tên bây giờ rẻ nhất trong lịch sử dự án.
- **Dính với keep/cut**: chốt bộ lệnh cuối rồi nhìn tổng thể sẽ dễ chọn tên hơn.
- **User**: "chưa quyết định, cần hình dung nó thế nào đã".

### 5.3 Bước kế tiếp
- **Spike plugin** (blocker kỹ thuật cuối): dựng plugin thật tối thiểu (1 skill + 1 hook exec-form + ghi `CLAUDE_PLUGIN_DATA`) để xác nhận 2 giả định còn lại (gap #2 và #3 trong research).
- **Bảng keep/cut**: có thể chạy song song với spike.
- **User**: "chưa quyết định".

---

## 6. Business model

| Tầng | Ai | Trả cho | Trạng thái |
|---|---|---|---|
| Free (OSS) | Tất cả | Toàn bộ core: specs, develop, gates, receipts | ✅ Giữ nguyên |
| Nội bộ haposoft | Các team | Năng suất + "verified AI delivery" differentiator | ✅ Mục tiêu chính |
| Team tier (dashboard, CI gate, analytics) | Team 3-20 người | ~$10-15/seat/tháng | ❌ Ngoài scope remake (YAGNI) |

Tiền lệ thị trường: AgentKit Engineer $99 (closed-source pivot của ClaudeKit cũ).

---

## 7. Lộ trình strangler

```
0.15 — Opt-in          0.16 — Default         0.17+ — EOL installer
Plugin song song  ──►  Plugin là chính    ──►  Installer khai tử
installer             +cafekit migrate         (công bố ≥6 tháng trước)
haposoft dogfood      launch cộng đồng         CLI mỏng ở lại vĩnh viễn
                      marketplace + organic    OpenCode ngủ đông
```

---

## 8. Gaps còn lại trước khi mở spec

1. **Spike plugin** (BLOCKING kỹ thuật): `CLAUDE_PLUGIN_DATA` + exec-form hook + event parity trên stable hiện tại.
2. **Keep/cut table**: 28 skills + 13 agents — bảng đề xuất chờ bro duyệt.
3. **Namespace decision**: chờ bộ lệnh cuối từ keep/cut.

---

## 9. Files đã tạo trong phiên này

| File | Nội dung |
|---|---|
| `specs/_shared/Research-cafekit-2026-remake-2026-07-20.md` | Hồ sơ research 5 track đầy đủ |
| `plans/remake-overview-diagram.html` | Bản đồ 5 tầng + trạng thái quyết định (tông nâu) |
| `plans/repository-harness-explained.html` | Giải thích repository-harness (tông xanh) |
| `plans/cafekit-2026-remake-tong-hop.md` | File này |
| `~/.claude/projects/.../memory/cafekit-2026-full-remake-intent.md` | Memory cập nhật xuyên suốt |

---

## 10. Audit bổ sung 2026-07-30 — Fit với Opus 5 / Fable 5

**Trigger**: User yêu cầu đánh giá toàn bộ package cafekit có còn phù hợp với model mới (Opus 5/Fable 5, 06/2026+) không, dựa trên official guide Anthropic + bài viết context engineering của Thariq.

### 10.1 Nguyên tắc chỉ đạo từ guide Anthropic

1. **Model nói dài hơn**: Effort chỉ kiểm soát thinking, không kiểm soát length → cần explicit response style
2. **Đừng "hobble" model**: Anthropic đã xóa 80% system prompt cũ, eval không giảm. Rules cứng gây over-thinking
3. **Progressive disclosure**: Load rules/skills khi cần, không nhồi hết lên đầu
4. **Context engineering > prompt đơn lẻ**: CLAUDE.md siêu nhẹ, chỉ chứa "gotchas" của repo
5. **Match surrounding code**: Không ép style riêng, model tự match

### 10.2 Quá trình đánh giá (4 vòng)

**Vòng 1**: Chỉ nhìn `/CLAUDE.md` → ước lượng 70% fit. **Sai lầm**: chưa thấy mạng lưới copy-paste.

**Vòng 2**: Mở rộng ra `/AGENTS.md` + `.claude/rules/*.md` → 50% fit. Phát hiện 2 CLAUDE.md gần identical, 8 rules overlap, settings profiles khác model.

**Vòng 3**: Phân biệt rõ **dev instructions** vs **shipped instructions** → 45% fit. Insight then chốt: package này là installer, copy files cho user cuối. User cuối mới là người chạy Opus 5 hàng ngày.

**Vòng 4**: Đào sâu từng file (29 files chính). Phát hiện chi tiết → có đủ data cho plan.

### 10.3 Mạng lưới vấn đề (Problem Network)

```
TEMPLATE CŨ (Opus 4 era, 2024-2025)
    │
    ├── [copy] → /CLAUDE.md (dev, 133 dòng)
    ├── [copy] → /packages/spec/CLAUDE.md (dev, 131 dòng)
    ├── [copy] → src/claude/CLAUDE.md (shipped, 131 dòng) ────┐
    │   ├── [copy] → src/claude/rules/*.md (8 files, ~450 dòng)│
    │   └── [parallel impl] → src/claude/hooks/*.cjs (11 files)│
    ├── [copy+rewrite] → src/codex/AGENTS.md (shipped, 42) ────┤
    │   ├── [partial copy] → src/codex/rules/*.md (2 files)    │
    │   └── [parallel impl] → src/codex/hooks/*.cjs (10)        │
    └── [copy+extend] → src/opencode/AGENTS.md (shipped, 140) ──┤
        └── [parallel impl] → src/opencode/plugins/*.ts (10)    │
                                                                  ↓
                            USER CÀI ĐẶT → nhận instructions khác nhau theo runtime
                                                                  ↓
                  Opus 5/Fable 5 session: load + process → OVER-THINKING
```

**Insight then chốt**: Vấn đề không phải từng file sai — mà là **mạng lưới copy-paste đa tầng** đã làm phình to instructions mà không ai trả lời câu "user thực sự cần bao nhiêu?".

### 10.4 Số liệu tổng hợp (đo đạc thực tế)

| Layer | Files | Tổng dòng | Loại |
|---|---|---|---|
| Installer code | 28 JS | 5236 | Node.js |
| Claude hooks | 11 + lib | ~2000 | Runtime enforcement |
| Codex hooks | 10 | 915 | Runtime enforcement |
| OpenCode plugins | 10 TS | 1899 | Runtime enforcement |
| Claude agents | 14 | 1386 | Sub-agent definitions |
| **Claude runtime instructions/session** | 9 | **~580** | **User load mỗi session** |
| **Codex runtime instructions/session** | 3 | **~115** | **User load mỗi session** |
| **OpenCode runtime instructions/session** | 1 | **140** | **User load mỗi session** |

**Lệch runtime**: Claude ~5x nặng hơn Codex.

### 10.5 So sánh với 4 insight từ guide Opus 5

| Insight | Claude runtime | Codex runtime | OpenCode runtime |
|---|---|---|---|
| **1. Model nói dài hơn** | ❌ 580 dòng/session, response style chỉ 4 dòng | ⚠ 115 dòng OK | ❌ 140 dòng có 4 Core Behaviors thừa |
| **2. Đừng hobble model** | ❌ 13 hooks + 7 "Never" + 5 DoD | ⚠ 10 hooks + 5 DoD | ⚠ 10 plugins + 5 DoD |
| **3. Prompt & context** | ❌ Tất cả 580 dòng load đầu, không progressive disclosure | ⚠ Ít rules nhưng AGENTS.md vẫn generic | ❌ AGENTS.md có Core Behavior dài |
| **4. Context engineering** | ❌ orchestrator.md 132 dòng, manage-docs.md 92 dòng | ✅ 2 rules tổng 73 dòng | ⚠ AGENTS.md 140 dòng thay vì <80 |

**Tổng kết fit**:
- Codex runtime: 60-65% (tốt nhất)
- OpenCode runtime: 50% (cần canonical template)
- Claude runtime: 35-40% (kém nhất, cần refactor nặng)

### 10.6 Đánh giá từng file (29 files chính)

#### A. SHIPPED INSTRUCTIONS (user cuối nhận)

| File | Dòng | Mức ưu tiên | Vấn đề chính |
|---|---|---|---|
| `src/claude/CLAUDE.md` | 131 | **HIGH** | 7 "Never" gates chống Opus 5 judgement; thiếu Working out loud + Uncertainty sections |
| `src/codex/AGENTS.md` | 42 | MEDIUM | Đã lean, chỉ cần polish |
| `src/opencode/AGENTS.md` | 140 | **HIGH** | 80% copy từ Claude → drift inevitable |
| `src/claude/rules/orchestrator.md` | 132 | MEDIUM | 132 dòng nên move sang skill `coordinate-agents` |
| `src/claude/rules/manage-docs.md` | 92 | MEDIUM | Trùng logic với state-sync.md + orchestrator |
| `src/claude/rules/workflow.md` | 57 | LOW | 5-step loop đã covered ở CLAUDE.md |
| `src/claude/rules/skill-workflow-routing.md` | 24 | LOW | Giữ |
| `src/claude/rules/skill-domain-routing.md` | 29 | LOW | 24 skill routing table — Opus 5 tự route được |
| `src/claude/rules/state-sync.md` | 31 | MEDIUM | Tollgate Protocol là value riêng, cần consolidate |
| `src/claude/rules/ai-dev-rules.md` | 50 | **HIGH** | Nội dung gần identical với Core Behavior trong CLAUDE.md |
| `src/claude/rules/hook-protocols.md` | 36 | LOW | Privacy flow — value riêng, giữ |
| `src/codex/rules/state-sync.md` | 42 | MEDIUM | Consolidate với phiên bản Claude |
| `src/codex/rules/hook-protocols.md` | 33 | LOW | Giữ |

#### B. INSTALLER CODE

| File | Dòng | Mức ưu tiên | Vấn đề chính |
|---|---|---|---|
| `bin/install.js` | 221 | LOW | Thin orchestrator tốt; smell hardcode platform |
| `bin/phases/select-platform.js` | 254 | **WORK IN PROGRESS** | Fix A đang dở (promptAddMorePlatforms edge case) |
| `bin/phases/root-config.js` | 70 | NONE | OK |
| `bin/phases/copy-payload.js` | 240 | MEDIUM | Function 165 dòng vi phạm 200-line rule; `DEPENDENCY_TEMPLATES` dead code |
| `bin/phases/claude-runtime.js` | 192 | LOW | 5 functions rõ ràng; gần limit |
| `bin/phases/claude-settings.js` | 161 | LOW | `mergeClaudeSettings` 89 dòng gần giới hạn |
| `bin/phases/codex-runtime.js` | 140 | LOW | OK |
| `bin/phases/opencode-runtime.js` | 38 | NONE | OK |
| `bin/phases/post-install.js` | 263 | **HIGH** | Vi phạm 200-line rule; 4 functions nên tách |
| `bin/phases/summary.js` | 79 | NONE | OK |
| `bin/phases/report.js` | 66 | NONE | OK |
| `bin/phases/write-metadata.js` | 60 | NONE | OK |
| `bin/phases/setup-rtk.js` | 159 | LOW | Comment header 19% file |
| `bin/phases/skills-setup.js` | 143 | LOW | OK |

#### C. LIB (CORE HELPERS)

| File | Dòng | Mức ưu tiên | Vấn đề chính |
|---|---|---|---|
| `bin/lib/context.js` | 355 | **HIGH** | Vi phạm 200-line rule nặng nhất; 4 concerns trộn lẫn |
| `bin/lib/managed-writer.js` | 182 | LOW | Header doc 10% file |
| `bin/lib/manifest.js` | 227 | MEDIUM | `createTracker` 87 dòng, 7 methods |
| `bin/lib/codex-install.js` | 195 | MEDIUM | Hardcoded 13 agent names liên kết với agent sprawl |
| `bin/lib/opencode-install.js` | 854 | **HIGH** | File lớn nhất package, vi phạm 200-line rule |

#### D. SHIPPED HOOKS

| File | Dòng | Mức ưu tiên | Vấn đề chính |
|---|---|---|---|
| `src/claude/hooks/spec-gate.cjs` | 184 | MEDIUM | 184 dòng trong 1 try-catch; quá nhiều regex |
| `src/claude/hooks/state.cjs` | 296 | **HIGH** | Lớn nhất, chưa audit chi tiết |
| `src/claude/hooks/session.cjs` | 264 | **HIGH** | Cần audit |
| `src/claude/hooks/spec-state.cjs` | 132 | MEDIUM | Overlap với spec-gate |

#### E. SHIPPED AGENTS

| File | Dòng | Mức ưu tiên | Vấn đề chính |
|---|---|---|---|
| `src/claude/agents/god-developer.md` | 105 | **CRITICAL** | "god-developer" = anti-pattern theo guide Anthropic; Opus 5 cover |
| `src/claude/agents/spec-maker.md` | 224 | MEDIUM | 14-item finalization audit → Opus 5 over-think |
| `src/claude/agents/debugger.md` | 191 | MEDIUM | L24 MANDATORY: Read 13 references files → load nặng |
| `src/claude/agents/code-auditor.md` | 156 | LOW | 5 Pillars framework tốt |
| `src/claude/agents/test-runner.md` | 148 | LOW | Anti-Illusion Protocol có giá trị |

### 10.7 Phân loại ưu tiên Remake

#### Critical (xóa/refactor trước)

1. **`god-developer` agent** — anti-pattern, Opus 5 cover
2. **7 "Never" gates trong CLAUDE.md** — chống Opus 5 judgement
3. **`context.js` 355 dòng** — split 4 files
4. **`post-install.js` 263 dòng** — split 4 files
5. **`state.cjs` 296 + `session.cjs` 264** — audit + tách

#### High (refactor cẩn thận)

6. **`src/opencode/AGENTS.md` 140 dòng** — share canonical template
7. **`src/claude/rules/ai-dev-rules.md`** — merge hoặc xóa
8. **`copy-payload.js` 240 dòng** — split concerns
9. **`src/claude/CLAUDE.md` 131 dòng** — apply template Opus 5
10. **`opencode-install.js` 854 dòng** — split

#### Medium (polish)

11. **`orchestrator.md` 132 dòng** — move to skill
12. **`manifest.js` 227 dòng** — split tracker
13. **`spec-maker.md` 224 dòng** — consolidate audit
14. **`debugger.md` 191 dòng** — references loading

#### Low (giữ)

15. **`hook-protocols.md` 36 dòng** — value riêng
16. **`manage-docs.md` 92 dòng** — OK sau consolidate
17. **`workflow.md` 57 dòng** — OK sau trim
18. **Test runner, code-auditor** — agents có giá trị

### 10.8 Kế hoạch Remake Full (4-5 tuần)

#### Phase 1 — Foundation (1-2 ngày)

1. Tạo `src/common/INSTRUCTIONS.template.md` — canonical, <100 dòng theo template Opus 5
2. Build step render 3 phiên bản: `src/claude/CLAUDE.md`, `src/codex/AGENTS.md`, `src/opencode/AGENTS.md`
3. Mỗi phiên bản ≤80 dòng
4. Xóa 7 "Never" gates, gộp Operating Discipline + DoD
5. Thêm Working out loud + Uncertainty sections

#### Phase 2 — Installer cleanup (2-3 ngày)

6. Split `bin/lib/context.js` (355) thành: `context.js` (200), `platforms.js` (80), `cli-args.js` (60), `manifest-loader.js` (80)
7. Split `bin/phases/post-install.js` (263) thành: `patch-language.js`, `patch-addressing.js`, `patch-runtime-locale.js`, `patch-settings-language.js`
8. Split `bin/phases/copy-payload.js` (240) thành: `copy-skills.js`, `copy-agents.js`, `copy-commands.js`
9. Refactor `bin/lib/manifest.js` (227) — tách `createTracker`
10. Split `bin/lib/opencode-install.js` (854) — chưa rõ cách tách, cần đọc chi tiết

#### Phase 3 — Hooks audit (3-5 ngày)

11. Audit `hooks/state.cjs` (296), `hooks/session.cjs` (264) — tách concerns
12. Consolidate `spec-state.cjs` + `spec-gate.cjs` — giảm overlap
13. Bỏ hooks không cần với Opus 5: `task-scaffold-guard.cjs`, `inspect-block.cjs`, `rules.cjs`, `usage.cjs`
14. Giữ 7 hooks core: `state.cjs` (refactored), `session.cjs` (refactored), `privacy-block.cjs`, `privacy-approval.cjs` (Codex), `agent.cjs`, `spec-gate.cjs`, `docs-sync.cjs`

#### Phase 4 — Agents cleanup (1 tuần)

15. **Xóa `god-developer`** (anti-pattern)
16. Audit `project-manager` (39 dòng) — merge với `git-ops` nếu trùng
17. Truncate `spec-maker.md` 14-item audit xuống 5-6 items
18. Move `references/debugger/` 13 files → skill progressive disclosure
19. Mục tiêu: 14 agents → 8-9 agents

#### Phase 5 — Skills + Rules consolidation (3-5 ngày)

20. Move `orchestrator.md` (132) → skill `coordinate-agents`
21. Move `manage-docs.md` (92) → skill `manage-docs`
22. Xóa `ai-dev-rules.md` (50) — merge vào CLAUDE.md canonical
23. Consolidate `state-sync.md` giữa Claude/Codex (1 canonical)

#### Phase 6 — Tests + i18n (1 tuần)

24. Update `bin/__tests__/codex-native.test.js` (28KB, Fix B đang dở) theo installer refactor
25. Audit `bin/lib/i18n.js` (403 dòng, task 5.1 đang dở)
26. End-to-end test 3 runtime sau mỗi phase

### 10.9 Trả lời câu hỏi gốc

> "CafeKit instructions còn phù hợp với Opus 5/Fable 5 không?"

- **Với user cuối (Claude runtime)**: KHÔNG — 580 dòng instructions/session quá nhiều
- **Với user cuối (Codex runtime)**: MỘT PHẦN — 115 dòng OK nhưng hooks enforce quá nhiều
- **Với user cuối (OpenCode runtime)**: MỘT PHẦN — 140 dòng nhưng copy từ Claude template
- **Với package dev**: KHÔNG — 700 dòng dev instructions overlap, không match Opus 5 workflow

### 10.10 Tích hợp với plan remake tổng thể

Audit này bổ sung trực tiếp cho **Section 5 (Quyết định đang chờ)** và **Section 8 (Gaps còn lại)**:

| Section 5/8 | Liên kết audit |
|---|---|
| **5.1 Keep/cut 28 skills + 13 agents** | Section 10.6.E + 10.7 — đã có đề xuất cụ thể cho 14 agents Claude (xóa god-developer, gộp project-manager, ...) |
| **5.3 Spike plugin** | Section 10.8 Phase 1-2 — canonical template + installer cleanup |
| **Gap #1 Spike plugin** | Phase 1 cung cấp foundation cho plugin migration |

**Kết luận**: Plan remake tổng thể (Section 7: lộ trình strangler 0.15→0.17) có thể giữ nguyên kiến trúc 5 tầng. Audit này cung cấp **data cụ thể về file-level changes** để feed vào spike + keep/cut table.

### 10.11 Open Questions

1. **Scope chính xác của full remake?** Plan 4-5 tuần. Khớp với kỳ vọng của bro?
2. **Mức độ conservative**: Bỏ `god-developer` có thể break existing user workflows — OK với breaking change trong major version bump (1.0)?
3. **Canonical template approach**: Build step hay manual sync? Tôi đề xuất build step.
4. **Settings profiles sync**: `settings.impl.json` dùng `xai.grok-4.3`, `settings.reviewer.json` dùng `claude-fable-5`. Có liên quan tới instructions không?
5. **Tests**: 3 test files (~50KB). Refactor installer sẽ cần update tests. Ưu tiên update tests trước hay sau từng phase?
6. **CHANGELOG.md 49KB**: Có cần review changelog để biết hướng phát triển gần đây trước khi remake không?
7. **4 task dang dở** (Fix A, Fix B, 5.1, 5.2+5.3): Ưu tiên xử lý trước khi remake hay để song song?
8. **Plugin-first vs Installer-first**: Audit này focus vào installer cải tổ. Section 4 đã chốt Plugin-first. Có cần điều chỉnh Phase 1-6 để align với plugin migration?

---

## 11. Files tham chiếu (cập nhật)

| File | Nội dung |
|---|---|
| `specs/_shared/Research-cafekit-2026-remake-2026-07-20.md` | Hồ sơ research 5 track đầy đủ |
| `plans/remake-overview-diagram.html` | Bản đồ 5 tầng + trạng thái quyết định (tông nâu) |
| `plans/repository-harness-explained.html` | Giảt thích repository-harness (tông xanh) |
| `plans/cafekit-2026-remake-tong-hop.md` | File này (đã append Section 10-11) |
| `~/.claude/projects/.../memory/cafekit-2026-full-remake-intent.md` | Memory cập nhật xuyên suốt |
| Template Opus 5 | https://gist.github.com/thieung/5b7667145b370dbd889fe079bcb5cf86 |
| Anthropic official guide Opus 5 | Public từ launch |
| Thariq's context engineering essay | Bài viết tham khảo |
