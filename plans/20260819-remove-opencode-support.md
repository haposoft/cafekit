# Gỡ hỗ trợ OpenCode (dogfood vòng 2)

> Chạy theo `plans/20260818-skill-specs-lean-draft.md`. Vòng 2: việc cross-cutting nhiều task có phụ thuộc.

## Quyết định scope (C1 — 2026-08-19, sửa sau review vòng 1)

- **Đã có gì sẵn:** `git grep -lie opencode` → **101 file tracked** toàn repo. Trừ `plans/`, `cafekit-web/`, `pnpm-lock.yaml` → **52 file in-scope**: `bin/` 18, `src/opencode/` 11, `src/claude/` 8, `scripts/` 1, doc/md 11, cộng `.gitignore`, `.repomixignore`, `packages/spec/package.json`.
- **Platform registry tập trung** tại `bin/lib/context.js:96-118` (entry `opencode: {` → `},`; dòng 110-117 là block `capabilities`). Comment `:70-72` xác nhận `PLATFORMS` là registry chính thức. Mọi consumer đều keyed động (`Object.entries/keys`) — gỡ entry không vỡ vòng lặp nào trong `bin/`.
- **User chọn: MỞ RỘNG**, đã điều chỉnh sau review vòng 1 (xem Review log).

### Diễn giải phần mở rộng (chốt tại C1)

- **Doc trạng-thái-hiện-tại** trong repo: gỡ sạch mô tả OpenCode như platform được hỗ trợ.
- **Doc lịch sử** (`CHANGELOG.md`, `docs/project-changelog.md`, `docs/audit-*.md`): **không xoá entry cũ** — chúng ghi sự thật đã xảy ra. Thêm entry mới ghi việc gỡ + ghi chú "đã ngừng hỗ trợ".
- **Dependency**: gỡ devDep `@opencode-ai/plugin`, regen lockfile, sửa `description` trong `package.json:4` (text hiển thị công khai trên npm).
- **Artifact gitignored**: chỉ `rm -rf packages/spec/.opencode` (root `.opencode` không tồn tại — đã kiểm).

## Ngoài phạm vi

- **`cafekit-web/` — user quyết để NGOÀI (2026-08-19).** Đây là workspace member (`pnpm-workspace.yaml:3`) chứa 34 file / 122 ref, gồm 3 trang `public/content/docs/{en,ja,vi}/platforms/opencode.mdx` và typed nav registry `src/lib/docs-config.ts:60`. **Hệ quả phải chấp nhận: sau khi xong việc này, site tài liệu công khai vẫn còn 3 trang mô tả OpenCode như platform được hỗ trợ.** Acceptance Task 05 đã hạ phạm vi cho khớp sự thật này, không tuyên bố "không doc nào còn mô tả". Việc gỡ web là plan riêng.
- **KHÔNG xoá `.agents/` và `.codex/`** (root lẫn trong `packages/spec/`) — đây là runtime Claude/Codex đang dùng thật (`.codex/` 10 entry, `packages/spec/.codex/` 9), gitignored nên không phục hồi được bằng git. Bản plan trước ghi nhầm là artifact cần xoá.
- **Giữ nguyên** `.gitignore:118` và `.repomixignore:14` (rule `.opencode/*`) — để thư mục `.opencode/` cũ trên máy người dùng không nhảy ra untracked. Chỉ gỡ khi có yêu cầu riêng.
- Không đụng hỗ trợ Claude Code và Codex CLI; không refactor kiến trúc registry.

## Task

| # | Task | Owner file chính | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 01 | Cắt đường cài (nguyên tử) | `bin/**`, `scripts/run-skill-self-tests.mjs` | - | **done** `fe3051a` |
| 02 | Gỡ nhánh hook runtime + catalog | `src/claude/**` | 01 | **done** `c132f78` |
| 03 | Xoá source + doc riêng | `src/opencode/`, `docs/opencode-*.md` | 01, 02 | **done** `82198d0` |
| 04 | Doc + dependency + changelog | `README.md`, `docs/*.md`, `package.json` | 03 | **done** `770a2c9` |

**Ghi chú A2 (ngoại lệ có chủ đích):** Task 01 đụng ~20 file, vượt xa ngưỡng ~5. Lý do: registry, mọi consumer của nó, **và các test/static-check assert sự tồn tại của nó** là một thao tác nguyên tử. Review vòng 1 chứng minh việc tách chúng tạo vùng chết — `installer-safety.test.js:14` require module bị xoá, `run-skill-self-tests.mjs:597-616` assert `context.js` chứa `"id: 'opencode'"`, cả hai `exit(1)` ngay dòng đầu khiến Task 02/03 chạy mù. Gộp lại là cách duy nhất giữ suite xanh sau mỗi task.

---

## Task 01 — Cắt đường cài (nguyên tử: registry + consumer + test)

### Scope
- Trong: gỡ entry `opencode` khỏi `PLATFORMS`, mọi nhánh tiêu thụ trong installer, i18n key, và mọi test/static-check assert sự tồn tại của platform này.
- Ngoài: không đổi hình dạng registry cho claude/codex; không đổi thứ tự phase.

### File
- Sửa: `bin/lib/context.js` (21 ref: registry `:96-118`, `DEPENDENCY_TEMPLATES` `:60`/`:65`, require `:16`), `bin/lib/i18n.js` (`nsOpencode` `:110`/`:231`/`:351`), `bin/install.js` (5), `bin/lib/manifest.js` (1), `bin/lib/copy-utils.js` (1), `bin/phases/select-platform.js` (1), `bin/phases/copy-payload.js` (9), `bin/phases/post-install.js` (12), `bin/phases/root-config.js` (3), `bin/phases/summary.js` (1, gồm map `:58` `opencode: 'nsOpencode'`), `bin/phases/claude-runtime.js` (3, gồm `normalizeOpenCodeBody` `:132` trong `copyRoutingFile` dùng chung)
- Sửa test: `bin/__tests__/installer-safety.test.js` (55 ref, require destructuring `:11-14`), `bin/__tests__/package-inventory.test.js` (13), `bin/__tests__/develop-contract.test.js` (6), `bin/__tests__/codex-native.test.js` (3), `scripts/run-skill-self-tests.mjs` (140 ref — gồm hàm `runOpenCodeInstallerFixtureTests()` `:2024-2217` và lời gọi `:3012-3013`; static check `:597-616`, `:673-677`, `:710`)
- Xoá: `bin/lib/opencode-install.js`, `bin/phases/opencode-runtime.js`, `bin/__tests__/opencode-spec-gate.test.js` (45 ref — nằm dưới `bin/` nên phải đi cùng task này cho acceptance grep=0 khả thi; 0 export/0 importer; nó require `src/opencode/plugins/*.ts` nhưng test đã xoá thì không còn ai require)

### Cạm bẫy đã biết (từ review vòng 1)
- **`context.js` entry kết thúc `:118`, KHÔNG phải `:109`** — cắt sai để lại `capabilities:{...}` mồ côi → SyntaxError.
- **`run-skill-self-tests.mjs:2799` `roots[2]` là index cứng** — mảng `standalone` `:2722-2726` xếp claude=0, codex=1, opencode=2, rồi `:2742` push `decoy`. Gỡ opencode khỏi mảng mà quên block `:2799-2820` sẽ khiến `opencodeRoot` trỏ vào `decoy` → **pass giả, grep không bắt được**. Phải gỡ cả block.
- **Shared check `:1334`** cùng loại bẫy với `:1344`: liệt cả `src/opencode/plugins/spec-gate.ts` lẫn 2 file Claude — chỉ gỡ phần tử opencode, giữ check cho Claude. (Check `:664`, `:1282`, `:1294`, `:1312` là opencode-only → xoá trọn.)
- **`package-inventory.test.js:315/316/328`** — assert phủ định dùng chung (`doesNotMatch /Claude|Codex|OpenCode|.../`) bảo vệ CORE/Claude block: **gỡ nhánh `OpenCode|\.opencode` trong alternation, KHÔNG xoá nguyên dòng**.
- **Vùng phụ thuộc trong `runWave1InstructionFixtureTests` kéo tới `:2892`** (ngoài block `2799-2820`): `--platform "claude,codex,opencode"` `:2827`/`:2868` sẽ hard-fail sau khi registry gỡ; env `OPENCODE_MODEL` `:2834-2835`/`:2875-2876`; marker `:2847`; `assertNoSourcePayloadPaths(..., "opencode", ...)` `:2864`/`:2892`; map/nhánh `:2248`, `:2619-2620`, `:2646`, `:2682-2686`.
- **Static check README** `:673-677` assert README chứa `"OpenCode: supported project-local runtime install"`; check `:710` assert `root-config.js` chứa `'.opencode/'` (đúng dòng 710 — dòng 709 là assert `.claude/`, 711 là `.codex/`, phải giữ). Cả hai phải gỡ trong task này, nếu không Task 04 sẽ phá chúng mà không ai bắt.

### Acceptance
- `grep -ri opencode packages/spec/bin/ packages/spec/scripts/` → **0 kết quả**.
- `node packages/spec/bin/install.js --dry-run --platform opencode` → lỗi "Unknown platform" (chứng minh đường cài đã đóng; `--dry-run` trần không phân biệt được vì repo không có marker `.opencode`).
- `pnpm -C packages/spec test` → exit 0.

### Verification Plan
```
grep -ri opencode packages/spec/bin/ packages/spec/scripts/
node packages/spec/bin/install.js --dry-run --platform opencode
pnpm -C packages/spec test
```

---

## Task 02 — Gỡ nhánh ở hook runtime + skill catalog

### Scope
- Trong: gỡ nhận diện/nhánh OpenCode trong hook lib, skill catalog, và 3 file dữ liệu dưới `src/claude/`.
- Ngoài: không đổi hành vi hook với claude/codex.

### File
- Sửa: `src/claude/hooks/lib/detect.cjs`, `src/claude/hooks/lib/context.cjs`, `src/claude/hooks/spec-state.cjs`, `src/claude/hooks/task-scaffold-guard.cjs`, `src/claude/scripts/generate-skill-catalog.cjs`, `src/claude/gitignore` (`:1` comment), `src/claude/migration-manifest.json` (`:84` key `"opencode"`, tiêu thụ tại `claude-runtime.js:198` — gỡ là no-op an toàn), `src/claude/skills/question/SKILL.md` (`:76`)

### Acceptance
- `grep -ri opencode packages/spec/src/claude/` → **0 kết quả**.
- `pnpm -C packages/spec test` → exit 0.

### Verification Plan
```
grep -ri opencode packages/spec/src/claude/
pnpm -C packages/spec test
```

---

## Task 03 — Xoá source + file/doc riêng của OpenCode

### Scope
- Trong: xoá `src/opencode/` (11 file), test riêng, 2 doc riêng, artifact gitignored.
- Ngoài: **không đụng `.agents/`, `.codex/`** (xem Ngoài phạm vi).

### Cạm bẫy đã biết
`run-skill-self-tests.mjs:1267`, `:1324`, `:1344` có check dùng chung liệt cả 3 platform, ví dụ `:1344` `files: ["src/claude/hooks/rules.cjs", "src/codex/hooks/rules.cjs", "src/opencode/plugins/rules.ts"]`. Task 01 phải đã gỡ phần opencode khỏi các check này; nếu còn sót, xoá `src/opencode/` sẽ làm **mất coverage cho claude/codex**, không chỉ opencode.

### File
- Xoá: `packages/spec/src/opencode/` (test riêng đã xoá từ Task 01), `packages/spec/docs/opencode-hook-port-audit.md`, `packages/spec/docs/opencode-plugin-contract.md`
- Dọn: `rm -rf packages/spec/.opencode`

### Acceptance
- Các đường dẫn trên không còn tồn tại; `.codex/`, `.agents/` **vẫn còn nguyên**.
- `pnpm -C packages/spec test` → exit 0.

### Verification Plan
```
ls packages/spec/src/opencode 2>&1; ls -d .codex .agents packages/spec/.codex
git status --short
pnpm -C packages/spec test
```

---

## Task 04 — Doc + dependency + changelog

### Scope
- Trong: gỡ OpenCode khỏi doc mô tả trạng thái hiện tại **trong repo**; gỡ devDep + regen lockfile + sửa npm description; thêm entry changelog; thêm ghi chú "đã ngừng hỗ trợ" ở doc lịch sử **mà không xoá entry cũ**.
- Ngoài: `cafekit-web/` (user quyết để ngoài — xem Ngoài phạm vi).

### File
- Sửa: `README.md` (4 ref), `packages/spec/README.md` (17), `docs/installer-architecture.md` (24), `docs/provenance.md` (1), `AGENTS.md` (`:29` — bản render ở root, song sinh với `packages/spec/src/codex/AGENTS.md:28`), `packages/spec/src/codex/AGENTS.md`
- Dependency: `packages/spec/package.json` — gỡ devDep `@opencode-ai/plugin` (`:60`; entry duy nhất — xoá cả block `devDependencies` rỗng), sửa `description` (`:4`, đang ghi "Claude Code, Codex CLI, and OpenCode"); chạy `pnpm install --lockfile-only` để regen `pnpm-lock.yaml`
- Thêm entry (không xoá cũ): `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Thêm ghi chú: `docs/audit-cafekit-vs-claude-code-2026-07.md`

### Acceptance
- Không doc **trong repo này** (ngoài `cafekit-web/` và `plans/`) còn mô tả OpenCode như platform được hỗ trợ.
- `package.json` không còn devDep opencode; `description` không còn nhắc OpenCode; lockfile đã regen.
- Entry lịch sử cũ còn nguyên; có entry mới ghi việc gỡ.
- `pnpm -C packages/spec test` → exit 0 (bắt buộc — Task 01 đã gỡ static check đọc README, task này sửa README nên phải chạy lại để chắc).

### Verification Plan
```
grep -ri opencode README.md docs/ AGENTS.md packages/spec/README.md packages/spec/CHANGELOG.md packages/spec/package.json
pnpm -C packages/spec test
```

## Review log

### Vòng 1 (2026-08-19) — 2 reviewer fresh-context: Fact Checker + Contract Verifier
Cả hai verdict **FAIL**, 5 Critical mỗi bên, hội tụ vào cùng nhóm vấn đề. User nhận toàn bộ.

| Nhóm | Finding | Xử lý |
|---|---|---|
| **Nguy hiểm** | Plan ra lệnh `rm -rf .agents/ .codex/` — đó là runtime Codex đang chạy thật, gitignored, không phục hồi được; mâu thuẫn chính lời plan "không đụng Codex" | Bỏ khỏi scope, ghi vào Ngoài phạm vi |
| **Inventory** | "39 file tracked" sai — thực tế 101 toàn repo / 52 in-scope; bỏ sót `cafekit-web/` (34 file), `package.json`, `i18n.js`, `run-skill-self-tests.mjs` (140 ref), `AGENTS.md` root | Đếm lại, phân nhóm đúng, bổ sung vào task |
| **Sai kỹ thuật** | Registry range `96-109` sai → cắt đúng theo plan gây SyntaxError | Sửa thành `96-118`, ghi vào Cạm bẫy |
| **Thứ tự** | 01→04 tạo vùng chết: suite `exit(1)` từ cuối Task 01 tới Task 04, Task 02/03 chạy mù | Gộp 01+04 thành Task 01 nguyên tử |
| **Bẫy câm** | `roots[2]` index cứng — gỡ opencode khiến biến trỏ vào `decoy` → pass giả | Ghi vào Cạm bẫy Task 01 |
| **Acceptance nói dối** | 3/5 acceptance bất khả thi như viết | Sửa từng cái cho khả thi và trung thực |

Reviewer xác nhận đúng: 37/37 path tồn tại, mọi ref count per-file chính xác, `src/opencode/` đúng 11 file, gitignore claim đúng, `opencode-spec-gate.test.js` 0 importer, registry iteration keyed động, quyết định giữ entry changelog lịch sử là đúng chuẩn.

**Quyết định user (C1 sửa):** (1) `cafekit-web/` để **ngoài** scope — acceptance Task 05 cũ bị hạ xuống cho khớp sự thật; (2) **gỡ** devDep + lockfile + description; (3) **gộp** Task 01+04.

### Vòng 2 (2026-08-19) — 1 reviewer fresh-context, verify bản sửa
Verdict FAIL nhưng khoanh hẹp: kiến trúc/thứ tự/inventory ĐÚNG (9/9 mục verify, 0 file mồ côi, 0 cửa sổ đỏ); lỗi còn lại là 6 con số dòng + 1 acceptance, "không cần vòng 3 — verify được bằng sed". Đã tự kiểm từng con số bằng file thật và áp: fixture `:2024-2217`; static check `:597-616`; root-config check `:710` (giữ 709/711); devDep `:60` + xoá block rỗng; chuyển `opencode-spec-gate.test.js` sang Task 01; bổ sung cạm bẫy `:1334`, `package-inventory:315/316/328`, vùng `:2827-2892`. Hết ngân sách review giấy (B4) — từ đây mọi tranh luận cần bằng chứng runtime.

**Sweep sau sửa (B3):** đọc lại toàn file; delta = {web ra ngoài, bỏ rm .agents/.codex, range 96-118, gộp task, +i18n/package.json/AGENTS.md, inventory 52, acceptance hạ phạm vi}; đã reconcile mục C1, Ngoài phạm vi, bảng Task, cả 4 task. Task cũ đánh số 05 nay là 04. Còn mâu thuẫn: 0.

## Evidence (chạy 2026-08-19)

```
Task 01:
$ grep -ri opencode packages/spec/bin/ packages/spec/scripts/ | wc -l          → 0
$ node packages/spec/bin/install.js --dry-run --platform opencode
Installation failed: Unknown platform: opencode. Expected: claude, codex
$ pnpm -C packages/spec test                                                    → exit 0, 691 tests
(701 → 691: 10 test opencode-only bị xoá đúng chủ đích)

Task 02:
$ grep -ri opencode packages/spec/src/claude/ | wc -l                           → 0
$ pnpm -C packages/spec test                                                    → exit 0, 691 tests

Task 03:
$ ls packages/spec/src/opencode                       → No such file or directory
$ ls -d .codex .agents packages/spec/.codex           → còn nguyên (runtime thật không bị đụng)
$ pnpm -C packages/spec test                          → exit 0, 691 tests

Task 04:
$ grep -c "opencode-ai" pnpm-lock.yaml                → 0 (lockfile đã regen)
$ pnpm -C packages/spec test                          → exit 0, 691 tests
$ git grep -lie opencode -- . ':!cafekit-web' ':!plans' ':!pnpm-lock.yaml'
.gitignore .repomixignore README.md docs/audit-*.md docs/project-changelog.md docs/provenance.md packages/spec/CHANGELOG.md
→ 7 file, tất cả giữ-có-chủ-đích: ignore rules (Ngoài phạm vi), dòng removal note, lịch sử.
```

Result: **PASS** — 4/4 task đạt acceptance, suite xanh sau MỖI task (không có cửa sổ đỏ, đúng như plan thiết kế).

### Lệch so với plan (ghi nhận tại sweep)
1. `docs/provenance.md` plan xếp diện "sửa" nhưng khi đọc, ref duy nhất là **record verification lịch sử** — sửa nó là làm giả biên bản. Quyết định: giữ nguyên, phân loại lại thành doc lịch sử. Acceptance vẫn đạt (câu đó không mô tả OpenCode là platform được hỗ trợ).
2. Fixture gitignore legacy trong `installer-safety.test.js` thay `.opencode/` bằng `.legacy-runtime/` — giữ nguyên mục đích test (dòng ngoài template được bảo tồn) và test giờ còn đúng nghĩa hơn (dòng chắc chắn không nằm trong template hiện tại).
3. Root `AGENTS.md` câu ownership-contract render cũ lệch template ("Codex CLI, OpenCode" vs "Claude Code, OpenCode") — sửa root theo đúng template mới trừ OpenCode.

**Sweep cuối (B3):** đọc lại plan sau khi điền evidence; delta = {4 task done, 3 lệch ghi trên}; đối chiếu Ngoài phạm vi (web/`.agents`/`.codex`/ignore-rules) — tất cả được tôn trọng, `git status` sạch. Còn mâu thuẫn: 0.
