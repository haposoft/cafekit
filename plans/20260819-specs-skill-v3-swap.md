# Thay skill hapo:specs bằng bản process-first v3 (+ develop/sync theo sau)

> Chạy theo `plans/20260818-skill-specs-lean-draft.md` (quy trình) — và đây cũng là lần đầu **plan này dogfood chính các kỹ thuật mới** (tiêu chí EARS, cột truy vết, 12 chiều).
> **Bản v4 (KHOÁ GIẤY)** — vá theo 2 vòng review C2 (vòng 1: 3 reviewer FAIL; vòng 2: 1 reviewer FAIL, mọi finding sửa được ở tầng giấy) + 3 phân xử của user. Hết quota 2 vòng giấy theo luật B4 — lỗi còn lại để runtime bắt khi thực thi.

## Quyết định scope (C1 — 2026-08-19)

- **Đã có gì sẵn:**
  - Skill đang ship `packages/spec/src/claude/skills/specs/`: **23 file / 1.943 dòng** — SKILL.md 222 dòng ("semantic kernel v2.1") + 8 references + 8 rules + 6 templates (254 dòng).
  - Nhóm develop/sync (user quyết viết lại luôn): `develop/SKILL.md` 187 + `develop/references/parallel-waves.md` 194 + `sync/SKILL.md` 103 + `sync/references/sync-protocols.md` 83 = **567 dòng dạy v2.1**. `quality-gate.md` (154) + `subagent-patterns.md` (51) thoát lưới grep 3-keyword nhưng VẪN dạy v2.1 bằng từ vựng khác (`quality-gate.md:4-5` "Canonical v2.1 policy input", lane/`execution_tier`, `:42-45` `needsIndependentAudit`, `:90-121` Flash Gate persisted fields; `subagent-patterns.md:3,:16,:31` "persisted lane") → vào scope Task 02 sửa từ vựng. Codex KHÔNG có bản develop/sync riêng (transform từ bundle claude qua codex-native).
  - Bản thay thế specs: draft 238 dòng đã duyệt C2 + dogfood 2 lần (`plans/20260818-skill-specs-lean-draft.md`). **Lưu ý:** draft viết layout `plans/<ts>-<slug>/` — plan này CHỐT layout `specs/<feature>/`, Task 01 phải sửa theo (xem chỉ thị layout).
  - 4 kỹ thuật bổ sung đã research 19/08: EARS 5 mẫu câu (nội dung sẵn tại `rules/ears-format.md` 42 dòng — giữ nội dung, chuyển vào templates.md mới); bảng 12 chiều edge-case (nguồn NGOÀI repo: `~/Desktop/cafekit-ref/.claude/skills/ak-scenario/`); luật Example Mapping ("không chắc outcome = câu hỏi, không đoán"; "rule mờ = kèm 2-3 ví dụ"); cột truy vết Tiêu chí→Task.
  - Ràng buộc kỹ thuật đã xác minh (fact-checked vòng 1):
    - `spec-scaffold.cjs:34` đọc `skills/specs/templates/` → **templates/ phải giữ nguyên** khi kernel còn sống.
    - Test bám nội dung skill specs: `run-skill-self-tests.mjs` **54 ref** — cỗ máy contract thật trải `:165-308` (sources map `:259-274` gồm cả specMaker/state-sync/CLAUDE/AGENTS, **mutation harness `:281-303`**), `design-principles` assert riêng `:1497-1514`, `ask-user-question-gates` check `:839-845`, files lists `:475-505`; `codex-native.test.js` **17 ref** — vùng thật `assertInstalledAuthoringProjection` `:193-215` + danh sách file cài `:668-671`; `validator-grounding.test.js` **14 ref** (`:529,:551` trỏ design-principles/design-review); `installer-safety`/`specs-v2-policy-and-scaffold`/`completion-authority` mỗi file 1.
    - Test bám develop/sync: **`develop-contract.test.js` 2.878 dòng** (3 ref path develop + 1 sync; content test lớn: `:309-312` flash+parallel guard nguyên văn, `:689-705` đòi heading `## Policy authority` + planning_depth/assurance_level, `:1121` sync SKILL phải chứa `sync-finalize`, `:1521-1539` ~15 chuỗi bắt buộc trong parallel-waves, `:720-733` Artifact router + `:896-905` Platform acceptance bám SKILL specs); `run-skill-self-tests.mjs` 14 ref `skills/develop` + 1 `skills/sync`, gồm **line-budget floor `:1457-1466`** (specs SKILL 150-230, develop SKILL 140-200 — budget mới phải kèm sửa range này) và **notes-template asserts `:944-979`**; **`package-inventory.test.js:814-824`** (`assertTransforms` đòi `/hapo:develop`/`$hapo-develop` sau cài). Đây là gánh test lớn nhất của scope mở rộng.
    - Bề mặt còn dạy workflow v2.1 (grep `semantic_model|machine authority|task_registry` + biến thể gạch nối `semantic-model`): **spec-maker.md** (trỏ 5 lần vào file sắp xoá: `:89,:167,:168,:170,:171`), `src/claude/CLAUDE.md`, `src/claude/rules/{state-sync,workflow}.md`, **`src/codex/rules/state-sync.md`** (bị test mutate `run-skill-self-tests.mjs:270`, `codex-native.test.js:210`), `src/{codex,common}/AGENTS.md`, `src/claude/rules/manage-docs.md` (dạy "spec.json is sole source of truth" `:76` + layout `tasks/task-R*.md` `:85` — không chứa keyword nào, điểm mù grep), nhóm develop/sync ×4 (Task 02).
    - Docs ngoài `packages/spec/` trỏ file sắp xoá: `README.md:170`, `docs/specs-usage-guide.md:166`, `docs/hapo-specs-flow.html:555`, `src/claude/agents/project-manager.md:24`.
    - Done-gate: **hai file riêng** — `src/claude/hooks/spec-gate.cjs` và `src/codex/hooks/spec-gate.cjs`; resolver DÙNG CHUNG (`src/codex/hooks/lib/spec-utils.cjs:16-24` delegate về `spec-resolver.cjs`). Gate hiện `spec-gate.cjs:163` resolve `spec.json`, `:173` đọc `task_registry` → hồ sơ không spec.json **vô hình với máy canh** (implicit: resolver `:104` `missingSpec` → scan `:187-189` bỏ qua im lặng; gate `:116` exit 0). NHƯNG explicit target trỏ layout mới → **block mọi Stop** `explicit_not_found` (`spec-gate.cjs:131-137`, resolver `:412-413`) — Task 05 phải xử cả nhánh này.
    - Receipt validator tái dùng được: `validateCanonicalReceipt` (`workflow-policy.cjs:1887`, export `:2276`) — validate body thuần, không cần spec.json; contract THẬT: block lệnh + `Exit:` + **`Verification: PASS`** (`:1903`) + đúng một cặp `Base`/`Head` hoặc `base_sha`/`head_sha` (`:1953-1976`) + không placeholder. Tầng `checkTaskReceipt` KHÔNG tái dùng nguyên trạng (đòi `completed_at` từ registry `spec-receipt.cjs:147-148`, regex chỉ nhận `tasks/task-*.md` `:43,:119`).
    - Chốt máy thứ 3 tồn tại: `task-scaffold-guard.cjs:50` (cả bản codex) chặn Write vào `specs/<feature>/tasks/task-*.md` và dạy chạy kernel. Layout mới **phẳng** (`task-NN-*.md` cạnh plan.md, KHÔNG thư mục `tasks/`) là quyết định tường minh để không đụng guard; câu "đúng hai kiểm tra" của draft sửa thành "hai chốt nội dung + một guard layout kernel cũ giữ nguyên".
    - Installer KHÔNG tự xoá file dest thừa (`managed-writer.js:147-180` chỉ overlay). Cơ chế prune duy nhất: `src/claude/migration-manifest.json` → `obsolete.runtimeFiles` (`claude-runtime.js:168-191`, có tiền lệ skill + prunePrefix). **Claude-only** — Codex không có prune → 15 file mồ côi ở `.agents/skills/specs/` trên máy đã cài (known limitation, ghi changelog).
    - Spec paused `specs/cafekit-semantic-eval-firewall/spec.json:144,:1193` trỏ `design-principles.md` (typed anchor, `spec-ground.cjs:223` kiểm `fs.existsSync`) → user quyết **archive spec** (move `specs/archive/`); sau move resolver không quét (`spec-resolver.cjs:167` readdirSync chỉ con trực tiếp, verified), `specs/archive/` không bị git-ignore (check-ignore exit 1). **NHƯNG (proven vòng 2, chạy thật):** `validate-spec-output.cjs` KHÔNG chạy được trên path archive — `:1448` suy projectRoot từ vị trí spec dir → grounding evidence repo-relative fail hết, exit 1; và mọi key lạ top-level trong spec.json bị closed schema reject (`:3372-3373`, allowlist `:76`) → KHÔNG thêm `archived_note` vào spec.json, KHÔNG dùng validator làm acceptance trên path archive (R6 đo cách khác).
- **User chọn (C2 phân xử 19/08):** (1) **viết lại develop/sync luôn** trong plan này, không vá nhãn; (2) **archive** spec `cafekit-semantic-eval-firewall`; (3) **cắt hết flag** — argument-hint mới chỉ `<feature-description>`.
- **Mặc định bảo thủ (chốt ở vòng giấy 2, user có thể phủ quyết trước khi thực thi):**
  - **Flags develop giữ nguyên** (`--flash/--parallel/--notes` + `implementation-notes-template.html` 320 dòng + Flash Gate): user chỉ quyết cắt flag cho SPECS; bề mặt develop ngoài trọng tâm swap — Task 02 chỉ thay phần dạy v2.1 authority, giữ flags và references của chúng.
  - **Receipt nằm INLINE trong task file**, section `## Receipt` cuối file: layout phẳng một-file-một-task, gate quét `Status: done` → validate phần `## Receipt` cùng file bằng `validateCanonicalReceipt`. (Không dùng `receipts/<task>.md` — thêm file thêm chỗ lệch.)

## Tiêu chí chấp nhận (đo được)

- **R1**: Khi user gõ `/hapo:specs <mô tả feature>` trong repo đã cài lại, agent shall chạy flow 3 cửa: hỏi scope đúng một lần, tạo `specs/<feature>/plan.md` + `task-NN-*.md` (phẳng, không `tasks/`), không đòi `spec.json`. **Đo bằng:** phiên dogfood TƯƠNG TÁC có human tại 3 cửa; evidence = trích transcript 3 quyết định của human.
- **R2**: Bundle `skills/specs/` sau swap shall ≤ 750 dòng (ước 440 mới + templates/ 254 = ~694; đệm dịch EN), và không file nào bị xoá còn được trỏ tới từ code/test/doc **toàn repo** (grep 0, trừ CHANGELOG/lịch sử có chủ đích).
- **R3**: `pnpm -C packages/spec test` shall exit 0 sau **Task 03, 04 và 05** (khoảng 01→03 chấp nhận đỏ, không commit giữa chừng — xem ghi chú A2).
- **R4**: Sau Task 04, các keyword v2.1 (`semantic_model|semantic-model|machine authority|task_registry` + từ vựng phái sinh lane/`execution_tier`/`planning_depth`) trên danh sách bề mặt đã đo ở C1 shall chỉ còn bên trong section có heading chứa "Legacy". **Đo theo SECTION, không theo dòng** (lệnh awk section-aware ở Task 04 — `grep -v legacy` theo dòng đã proven tự fail); loại trừ `skills/specs/templates/` (ngoài scope sửa, `templates/design.md:14` chứa "machine authority" hợp lệ cho kernel cũ).
- **R5**: If một task file layout mới ghi `Status: done` mà thiếu receipt hợp lệ theo `validateCanonicalReceipt` (block lệnh + `Exit:` + `Verification: PASS` + cặp Base/Head + không placeholder), done-gate shall chặn ở Stop — chứng minh bằng runtime (Claude tối thiểu).
- **R6**: Hành vi legacy shall không đổi: hook test fixture layout cũ (spec.json + task_registry) pass như trước, và sau archive, `spec-state.cjs`/`spec-gate.cjs` chạy trên repo shall exit 0 không error (resolver bỏ qua `specs/archive/` im lặng). KHÔNG dùng `validate-spec-output.cjs` trên path archive làm acceptance (proven fail — validator suy projectRoot từ vị trí spec dir, `validate-spec-output.cjs:1448`).
- **R7**: `develop/SKILL.md` + `sync/SKILL.md` mới shall dạy CẢ hai chế độ: hồ sơ layout mới (plan.md + task phẳng + receipt, không spec.json) là đường chính; spec.json legacy là nhánh tương thích được đánh dấu. Đo bằng content test mới trong `develop-contract.test.js`.

## Ngoài phạm vi

- Không gỡ kernel scripts (`spec-scaffold/validate-spec-output/spec-readiness/...`) — phục vụ spec cũ tới đợt gỡ riêng (strangler).
- Không đổi `templates/` (kernel đọc — `spec-scaffold.cjs:34`); không đổi digest hook; không đổi `task-scaffold-guard` (layout mới phẳng nên không đụng).
- Không cắt flags develop (`--flash/--parallel/--notes`) và `implementation-notes-template.html` — mặc định bảo thủ, chỉ sửa từ vựng v2.1.
- Không xây cơ chế prune cho Codex (chưa tồn tại; orphan `.agents/skills/specs/` là known limitation ghi changelog).
- Không dịch/đồng bộ `cafekit-web/`.
- Draft `plans/20260818-skill-specs-lean-draft.md` giữ nguyên làm decision record.

## Task

| # | Task | Tiêu chí | Owner chính | Phụ thuộc | Trạng thái |
|---|---|---|---|---|---|
| 01 | Thay bundle skill specs + spec-maker agent (xoá 15 file cũ) | R2 | `src/claude/skills/specs/**`, `src/claude/agents/spec-maker.md` | - | done |
| 02 | Viết lại develop/sync theo quy trình mới (2 chế độ) | R7 | `skills/develop/SKILL.md`, `parallel-waves.md`, `skills/sync/SKILL.md`, `sync-protocols.md` | 01 | done |
| 03 | Dạy lại test bám nội dung (specs + develop/sync) | R2, R3 | `scripts/run-skill-self-tests.mjs`, `bin/__tests__/*` (nặng nhất: `develop-contract.test.js` 2.878 dòng) | 01, 02 | done |
| 04 | Đồng bộ luật nhà + docs + agents phụ | R4 | `src/claude/CLAUDE.md`, `src/claude/rules/*`, `src/codex/rules/state-sync.md`, `src/{codex,common}/AGENTS.md`, README/docs, `project-manager.md` | 01, 02 | done |
| 05 | 2 done-gate layout mới + migration-manifest + archive spec cũ + cài lại + dogfood | R1, R5, R6 | `src/claude/hooks/spec-gate.cjs`, `src/codex/hooks/spec-gate.cjs`, `spec-resolver.cjs`, `migration-manifest.json`, `specs/` | 01-04 | in_progress — R1 human dogfood pending |

**Ghi chú A2:** Task 01+02 là nội dung, Task 03 là test soi nội dung. Quy ước: **suite chỉ bắt buộc xanh sau Task 03**; khoảng 01→03 chấp nhận đỏ, **không commit giữa chừng** (không lưới máy enforce — đã xác minh không có pre-commit/CI hook tự động). Nếu khoảng đỏ phải kéo dài qua phiên, ghi trạng thái vào plan này trước khi dừng.

---

## Task 01 — Thay bundle skill specs + spec-maker

### Scope
- Trong: viết bundle mới **tiếng Anh**:
  - `SKILL.md` (~170 dòng): frontmatter giữ **`name: hapo:specs` + `description`** (2 field load-bearing — `generate-skill-catalog.cjs:124-125`; catalog test đòi `` `hapo:specs` `` tại `run-skill-self-tests.mjs:1697`); `argument-hint` = `<feature-description>` DUY NHẤT (user quyết cắt `--status/--validate/--archive`). Thân = triết lý + 3 cửa + flow 5 bước + 10 luật + lằn ranh máy + luật bảo trì C-2 + 2 luật Example Mapping.
  - `references/review.md` (~120): B1 evidence rule, 4 vai + bảng co giãn, red-team 4 lens + cap 15, consistency sweep, điều kiện dừng 2 vòng, cửa C2.
  - `references/templates.md` (~150): khung plan.md (mục Tiêu chí EARS + bảng task có cột Tiêu chí) + khung task + **mẫu receipt khớp contract `validateCanonicalReceipt`** (block lệnh + `Exit:` + `Verification: PASS` + cặp `Base`/`Head`) + EARS 5 mẫu + quality gate (từ `rules/ears-format.md`) + bảng 12 chiều rút gọn + tiêu chí dừng saturation.
  - **CHỈ THỊ LAYOUT (bắt buộc, sửa khác draft):** mọi chỗ dạy cấu trúc thư mục phải là `specs/<feature>/plan.md` + `task-NN-*.md` **phẳng cạnh plan.md** — KHÔNG `plans/<ts>-<slug>/` như draft, KHÔNG thư mục `tasks/` (tránh `task-scaffold-guard.cjs:50`).
  - `src/claude/agents/spec-maker.md`: viết lại theo quy trình mới (hiện trỏ file sắp xoá tại 4 dòng `:89,:167,:168,:170` và dạy `review.json`/`spec-readiness.cjs`/`planning_depth`).
  - **Mẫu receipt trong templates.md phải là INLINE section `## Receipt`** cuối task file (mặc định bảo thủ đã chốt).
- Xoá 15 file: `references/{archive-workflow,ask-user-question-gates,codebase-analysis,cross-spec-dependency,research-strategy,scope-inquiry,translation-mirror}.md` (7) + `rules/{design-discovery-full,design-discovery-light,design-principles,design-review,ears-format,phase-decision-matrix,task-scoring-rubric,tasks-generation}.md` (8).
- Giữ: `templates/` nguyên 6 file (254 dòng).
- Ngoài: develop/sync (Task 02), test (Task 03), luật nhà/docs (Task 04).

### Acceptance
- Bundle `skills/specs/` ≤ 750 dòng tổng; frontmatter giữ `name: hapo:specs` + `description`; hint không còn flag cũ.
- spec-maker.md: grep tên 15 file đã xoá → 0.

### Verification Plan
```
find packages/spec/src/claude/skills/specs -type f | xargs wc -l | tail -1
grep -c "design-principles\|ears-format\|tasks-generation\|design-discovery\|task-scoring" packages/spec/src/claude/agents/spec-maker.md
```
(suite chạy ở Task 03)

---

## Task 02 — Viết lại develop/sync (2 chế độ)

### Scope
- Trong: viết lại 4 file (567 dòng hiện tại) theo quy trình mới, **đường chính = layout mới** (đọc plan.md + task phẳng, làm theo Acceptance/Verification Plan của task, viết receipt theo contract `validateCanonicalReceipt`, không đòi spec.json), **nhánh legacy đánh dấu rõ** (gặp spec.json thì theo task_registry như cũ):
  - `skills/develop/SKILL.md` (187 → mục tiêu ~140-160, khớp floor test hiện `140-200` — nếu xuống dưới 140 thì Task 03 phải hạ floor `run-skill-self-tests.mjs:1462-1466` có chủ đích): bỏ transition `spec.json.task_registry` bắt buộc (`:120`), bỏ "machine authority" (`:16`); GIỮ heading/flags mà test content bám (`--notes` opt-in, notes-template refs `:33,:187`); giữ nguyên tắc một-task-một-lần, evidence-first, quality-gate references.
  - `skills/develop/references/parallel-waves.md` (194 → ~100): worktree isolation + single-writer giữ nguyên (đúc kết thật); bỏ phần đọc typed `coordination.boundaries` làm topology authority — layout mới lấy dependency từ bảng task + mục Dependencies của task file.
  - `skills/sync/SKILL.md` (103 → ~60) + `references/sync-protocols.md` (83 → ~50): sync = cập nhật Status trong task file + receipt inline; spec.json chỉ khi hồ sơ legacy có nó.
  - **Sửa từ vựng v2.1** (không viết lại cấu trúc): `quality-gate.md` (`:4-5` "Canonical v2.1 policy input"/lane/`execution_tier`, `:42-45` `needsIndependentAudit`, `:138` "Compact/Full") và `subagent-patterns.md` (`:3,:16,:31` "persisted lane") — thay bằng khái niệm quy trình mới hoặc đưa vào khối Legacy; **GIỮ flags `--flash/--parallel/--notes` + Flash Gate + `implementation-notes-template.html`** (mặc định bảo thủ).
- Ngoài: test (Task 03).

### Acceptance
- 4 file viết lại tổng ≤ 400 dòng (develop SKILL không dưới floor test trừ khi Task 03 hạ floor có chủ đích); mỗi file có đúng một khối nhánh legacy đánh dấu bằng heading chứa "Legacy".
- Grep `machine authority` trong 6 file (4 viết lại + quality-gate + subagent-patterns) → 0 ngoài khối Legacy; `task_registry`/lane/`execution_tier` chỉ trong khối Legacy (đo theo section — awk, không `grep -v` theo dòng).

### Verification Plan
```
wc -l packages/spec/src/claude/skills/develop/SKILL.md packages/spec/src/claude/skills/develop/references/parallel-waves.md packages/spec/src/claude/skills/sync/SKILL.md packages/spec/src/claude/skills/sync/references/sync-protocols.md
grep -n "task_registry\|machine authority" <4 file trên>
```
(suite chạy ở Task 03)

---

## Task 03 — Dạy lại test (specs + develop/sync)

### Scope
- Trong: viết lại mọi check assert nội dung cũ — mỗi check giữ lại phải trỏ được mục đích thật (C-2):
  - `run-skill-self-tests.mjs` (54 ref specs + 14 develop + 1 sync): vùng thao tác thật `:165-308` — sources map `:259-274` thay bằng bộ mới; **mutation harness `:281-303`** viết lại mutations tương ứng nội dung mới (không xoá — nó chống check chết); spec-maker refs `:268,:479,:496,:572,:688,:927`; design-principles asserts `:1497-1514`; ask-user-question-gates check `:839-845`; files lists `:475-505` (chú ý `:502`); template checks `:315-326` giữ; codex state-sync mutate `:270`.
  - **`develop-contract.test.js` (2.878 dòng — gánh nặng nhất):** viết lại content tests bám develop/sync cũ — vùng chính: `:309-312` (flash+parallel guard nguyên văn), `:689-705` (heading `## Policy authority` + planning_depth/assurance_level), `:1121` (sync `sync-finalize`), `:1521-1539` (~15 chuỗi parallel-waves: base_sha/head_sha/worktree...); 2 content test bám SKILL specs `:720-733` (Artifact router/spec.json core) + `:896-905` (Platform acceptance + `/hapo:develop`); thêm content test mới cho R7 (2 chế độ). Viết lại contract test, không phải sửa path.
  - `run-skill-self-tests.mjs` phần develop: **line-budget `:1457-1466`** (chỉnh range khớp budget mới có chủ đích); **notes-template asserts `:944-979`** (giữ — flags develop không cắt); 14 ref develop (`:503,:773,:782,:805,:938,:946,:957,:968,:983,:991,:1003,:1006,:1031,:1464`) + 1 sync (`:504`).
  - **`package-inventory.test.js:814-824`** (`assertTransforms`): đòi `/hapo:develop` (claude) + `$hapo-develop` (codex) trong SKILL sau cài — nội dung mới phải giữ các token này.
  - `codex-native.test.js` (17 ref): `assertInstalledAuthoringProjection` `:193-215` + danh sách file cài `:668-671` + codex state-sync `:210`.
  - `validator-grounding.test.js` (14 ref): `:529,:551` trỏ design-principles/design-review — sửa fixture; phần kernel/templates giữ.
  - `installer-safety.test.js:615`, `specs-v2-policy-and-scaffold.test.js:13`, `completion-authority.test.js:752` — kiểm từng chỗ.
- Ngoài: không nới lỏng invariant không liên quan; không xoá test để cho qua.

### Cạm bẫy đã biết
- Check "shared resolver keeps explicit target" (`run-skill-self-tests.mjs:1246-1252`) join nội dung resolver + SKILL.md (`:1667-1671`); chuỗi `multiple active specs`/`Ambiguous active candidates fail closed` chỉ có ở `SKILL.md:104` → thay SKILL chắc chắn vỡ. **Không xoá trắng** — nó bảo vệ `spec-resolver.cjs:258,:261` thật; đổi câu assert sang nội dung tương đương trong SKILL mới hoặc chuyển assert về resolver.

### Acceptance
- `pnpm -C packages/spec test` exit 0.
- Grep **toàn repo** (trừ `CHANGELOG.md`, `docs/project-changelog.md`, `specs/_shared/`, `specs/archive/`, `plans/`) đủ 15 tên file xoá — pattern gồm cả `design-principles` và `design-review` → 0 ref sống ngoài các nơi Task 04 sở hữu.

### Verification Plan
```
pnpm -C packages/spec test
grep -rn "archive-workflow\|ask-user-question-gates\|codebase-analysis\|cross-spec-dependency\|research-strategy\|scope-inquiry\|translation-mirror\|design-discovery-full\|design-discovery-light\|design-principles\|design-review\|ears-format\|phase-decision-matrix\|task-scoring-rubric\|tasks-generation" . --include="*.js" --include="*.mjs" --include="*.cjs" --include="*.md" --include="*.json" --include="*.html" | grep -v "CHANGELOG\|project-changelog\|specs/_shared\|specs/archive\|plans/"
```

---

## Task 04 — Đồng bộ luật nhà + docs + agents phụ

### Scope
- Trong:
  - `src/claude/rules/state-sync.md` — viết lại: file là sự thật, receipt theo contract validateCanonicalReceipt, spec.json chỉ là legacy-compat.
  - `src/codex/rules/state-sync.md` — cùng nội dung phía codex (bị test mutate `run-skill-self-tests.mjs:270` — phối hợp Task 03).
  - `src/claude/rules/workflow.md` — bước Plan/Verify/Sync theo 3 cửa + receipt.
  - `src/claude/rules/manage-docs.md` — sửa `:76` ("spec.json is the sole source of truth") + `:68` layout + `:85` `tasks/task-R*.md` theo layout mới; phần cũ dán nhãn legacy.
  - `src/claude/CLAUDE.md` + `src/codex/AGENTS.md` + `src/common/AGENTS.md` — thay khối bullets "Specs v2 keeps planning_depth..." bằng mô tả quy trình mới (ngắn).
  - **CẢNH BÁO CORE:** `src/common/AGENTS.md` bị test enforce runtime-neutral — `installer-safety.test.js:231` + `package-inventory.test.js:312` cấm `Claude|Codex|.claude|.codex|/hapo:|$hapo-`. Nội dung mới cho CORE phải trung tính (không tên lệnh, không path runtime). **Không được nới test này.**
  - Docs + agent phụ: `README.md:170`, `docs/specs-usage-guide.md:166`, `docs/hapo-specs-flow.html:555`, `src/claude/agents/project-manager.md:24` — cập nhật hết ref file xoá + mô tả layout mới (README "Spec Output" section).
- Ngoài: `.claude/rules/*` bản render (installer sinh lại); rules khác (orchestrator, hook-protocols, ai-dev-rules) giữ nguyên.

### Acceptance
- R4: grep `semantic_model|semantic-model|machine authority|task_registry` trên danh sách bề mặt C1 → chỉ còn đoạn nhãn legacy.
- `pnpm -C packages/spec test` exit 0 — nếu check nội dung CLAUDE/AGENTS đỏ, sửa NỘI DUNG cho khớp invariant, không nới test.

### Verification Plan
```
# Section-aware: in dòng match keyword v2.1 nằm NGOÀI section có heading chứa "Legacy";
# loại trừ skills/specs/templates/ (kernel cũ đọc, hợp lệ).
find packages/spec/src -name "*.md" -not -path "*skills/specs/templates*" -exec awk '
  /^#/ { inLegacy = ($0 ~ /[Ll]egacy/) }
  /semantic_model|semantic-model|machine authority|task_registry/ && !inLegacy { print FILENAME ":" FNR ": " $0 }
' {} +
pnpm -C packages/spec test
```

---

## Task 05 — 2 done-gate + migration-manifest + archive + cài lại + dogfood thật

### Scope
- Trong:
  - **Cả hai gate** (file riêng): `src/claude/hooks/spec-gate.cjs` VÀ `src/codex/hooks/spec-gate.cjs`. Resolver `spec-resolver.cjs` dùng chung — sửa một nơi lan cả hai. Hành vi mới: `specs/<feature>/` không `spec.json` nhưng có `plan.md` + `task-*.md` → gate quét task `Status: done` và validate receipt bằng `validateCanonicalReceipt` (`workflow-policy.cjs:1887`; KHÔNG dùng `checkTaskReceipt` — đòi registry `spec-receipt.cjs:147-148` + regex `tasks/` `:43,:119`). Giữ nguyên hành vi khi `spec.json` tồn tại (R6). **Xử cả nhánh explicit target** trỏ layout mới (hiện block mọi Stop `explicit_not_found` — `spec-gate.cjs:131-137`, resolver `:412-413`).
  - `src/claude/migration-manifest.json`: thêm 15 file xoá vào `obsolete.runtimeFiles` (tiền lệ + prunePrefix tại `claude-runtime.js:168-191`). Codex không prune — ghi known limitation vào changelog.
  - **Archive spec cũ (user quyết):** `git mv specs/cafekit-semantic-eval-firewall specs/archive/cafekit-semantic-eval-firewall`; **KHÔNG đụng spec.json** (closed schema reject key lạ — `validate-spec-output.cjs:3372-3373`); ghi note vào file mới `specs/archive/cafekit-semantic-eval-firewall/ARCHIVED.md` (lý do archive + anchor design-principles.md là lịch sử, file đã gỡ trong v3) + commit message. Sau move resolver không quét nữa (verified `spec-resolver.cjs:167`).
  - **Receipt layout mới = section `## Receipt` inline trong task file** (mặc định bảo thủ đã chốt) — gate quét `Status: done` rồi validate phần `## Receipt` cùng file.
  - Thêm test hook cho ba nhánh: layout mới thiếu receipt → chặn; đủ receipt → qua; layout cũ (fixture) → không đổi.
  - Chạy `node packages/spec/bin/install.js` cài lại repo này; xác nhận `.claude/skills/specs/rules/` được prune.
  - **Dogfood tương tác**: human gõ `/hapo:specs` cho một việc nhỏ thật, human quyết tại 3 cửa; thử khai done thiếu receipt → bị chặn → bổ sung → qua.
- Ngoài: không đổi digest hook; không đổi task-scaffold-guard; không thêm chốt máy mới (C-2).

### Acceptance
- R5: transcript hook chặn done-không-receipt ở layout mới (Claude tối thiểu).
- R6: hook test fixture layout cũ pass; sau archive, một prompt bất kỳ + Stop trong repo không sinh error/warn từ `spec-state.cjs`/`spec-gate.cjs` (resolver bỏ qua `specs/archive/` im lặng). KHÔNG chạy `validate-spec-output.cjs` trên path archive (proven fail — projectRoot suy sai).
- R1: phiên dogfood tạo `specs/<feature>/plan.md` + task phẳng; evidence = trích transcript 3 quyết định human.
- Sau reinstall: `ls .claude/skills/specs/rules/` không còn 8 file cũ.
- `pnpm -C packages/spec test` exit 0.

### Verification Plan
```
pnpm -C packages/spec test
node packages/spec/bin/install.js --dry-run
ls packages/spec/.claude/skills/specs/rules/ 2>/dev/null || echo "pruned"
ls specs/archive/cafekit-semantic-eval-firewall/ARCHIVED.md
```

## Review log

### Vòng 1 (2026-08-19) — 3 reviewer fresh-context: Fact Checker, Contract Verifier, Assumption Destroyer — 3/3 FAIL
- **Critical đã vá vào bản v2:** (1) "5 file luật nhà" là grep cắt xén — bề mặt thật 11+ file, thêm spec-maker.md (Task 01), codex state-sync + manage-docs + docs/README (Task 04), develop/sync → phân xử user; (2) installer không dọn file mồ côi → migration-manifest vào Task 05, Codex orphan = known limitation; (3) spec active trỏ design-principles.md (`spec.json:144,:1193`, grounding `spec-ground.cjs:223`) → phân xử user.
- **High đã vá:** line-range codex-native sai hẳn vùng (507-518 → 193-215/668-671); ruleChecks thật `:165-308` + mutation harness; develop-contract là content rewrite; R3↔A2 hết mâu thuẫn; chỉ thị layout tường minh specs/ + task phẳng (draft dạy plans/); receipt contract đầy đủ (`Verification: PASS` + Base/Head); chốt cả 2 gate file riêng; task-scaffold-guard ghi nhận là chốt máy thứ 3, layout phẳng né có chủ đích.
- **Medium/Low đã vá:** 23 file (không phải 22); draft 238 dòng; CORE neutrality warning + cấm nới test; R1 định nghĩa đo được (human tại 3 cửa + transcript); grep acceptance đủ 15 tên + toàn repo; nguồn 12 chiều ghi rõ đường dẫn ngoài repo; budget 694/750; frontmatter load-bearing là name+description.

### C2 phân xử (2026-08-19, user):
1. develop/sync: **viết lại luôn** (không vá nhãn) → thêm Task 02 + R7; đo mới: 4 file 567 dòng, develop-contract.test.js 2.878 dòng vào Task 03.
2. Spec `cafekit-semantic-eval-firewall`: **archive** (move `specs/archive/`) → vào Task 05; R6 đổi sang fixture + validate trên path archive.
3. Flags cũ: **cắt hết** — hint mới chỉ `<feature-description>` → vào Task 01.

### Vòng 2 (2026-08-19) — 1 reviewer fresh-context verify — FAIL, mọi finding vá được ở tầng giấy → bản v4
- **Critical đã vá:** (1) R6 archive bất khả thi — PROVEN bằng chạy validator thật: `validate-spec-output.cjs:1448` suy projectRoot từ vị trí spec dir → move sang `specs/archive/` làm grounding fail, exit 1 → R6 đổi cơ chế đo (fixture + resolver-skip); (2) `archived_note` bị closed schema reject (`:3372-3373`) → note chuyển sang `ARCHIVED.md` + commit message.
- **High đã vá:** (3) lệnh R4 `grep -v Legacy` lọc theo dòng tự fail (templates/design.md:14 match sẵn) → đổi sang awk section-aware + exclude templates/; (4) line-budget floor `run-skill-self-tests.mjs:1462-1466` (develop 140-200) đánh đỏ target ~120 → target đổi ~140-160, Task 03 kê chỉnh range có chủ đích; (5) quality-gate.md + subagent-patterns.md dạy v2.1 bằng từ vựng khác (lane/execution_tier/Flash persisted) → vào scope Task 02 sửa từ vựng.
- **Medium đã vá:** flags develop + `implementation-notes-template.html` chốt GIỮ (mặc định bảo thủ — user chỉ cắt flag specs); `package-inventory.test.js:814-824` kê vào Task 03; vị trí receipt chốt INLINE `## Receipt` trong task file.
- **Low đã vá:** spec-maker 4 dòng ref (không phải 5); sources map `:259-274` (không phải `:257-267`).
- **Spot-check fix vòng 1: 5/5 VERIFIED** (codex-native ranges, mutation harness, receipt contract, CORE neutrality refs, migration-manifest mechanism).

### KHOÁ GIẤY (B4): đã dùng hết 2 vòng review giấy. Bản v4 là bản thực thi; lỗi phát hiện thêm sẽ bắt bằng runtime evidence trong lúc thực thi, ghi tiếp vào log này.

## Execution log (2026-08-20)

- Task 01-04: implemented. Specs bundle = 9 files / 696 lines; four primary develop/sync files = 399 lines; section-aware legacy vocabulary scan returned no live violation.
- Task 05 implementation: both runtimes resolve process-v3 flat tasks and validate inline receipts; Claude migration manifest prunes the 15 retired paths; the semantic firewall spec moved under `specs/archive/`; real combined install completed with exit 0.
- Runtime proof: a process-v3 done task without a receipt was blocked; a canonical receipt with bound provenance and the planned command passed. Installed Claude and Codex `spec-state.cjs` / `spec-gate.cjs` all stayed silent with exit 0 after the archive.
- Regression proof: `pnpm -C packages/spec test` exited 0 with `[skill-test] PASS: 700 tests executed`; package Node tests reported 324 pass, 0 fail, 1 opt-in live-host skip; hook behavioral tests reported 180/180.
- Runtime review repair: Receipt commands are now bound exactly to each task's `## Verification Plan`. One unfinished process-v3 packet wins over completed history; when every packet is complete, Stop revalidates the full receipt set instead of blocking on `multiple_persisted`. Pre-fix focused tests failed exactly 3/44 Claude and 3/31 Codex; post-fix they passed 44/44 and 31/31.
- Independent remediation review: PASS for scope/spec compliance, correctness/security, reachability/provenance, and runtime parity; no remaining code finding.
- Runtime repair discovered during install: native `src/codex/AGENTS.md` is now installed verbatim so the foreign-runtime ownership sentence is not rewritten into a Codex self-ignore instruction. Focused installer/native/inventory regression: 47 pass, 0 fail, 1 opt-in skip.
- Remaining R1 evidence: the required human-driven `/hapo:specs` C1/C2/C3 transcript has not been performed. Do not mark Task 05 or the whole plan done until that transcript exists.
