---
title: "Việc kế tiếp sau remake core chain (02/09/2026)"
description: "Chi tiết 6 việc cần làm sau đánh giá đợt nâng cấp process-first, viết để một model khác thực thi độc lập."
status: pending
priority: P1
branch: dev
created: 2026-09-02
source_assessment: "phiên đánh giá 02/09/2026 tại HEAD d2cd4c0"
---

# Việc kế tiếp sau remake core chain

> Tài liệu này viết cho một model **không có ngữ cảnh phiên trước**. Mọi khẳng định về
> repo đều kèm địa chỉ `file:dòng` đo tại HEAD `d2cd4c0` (02/09/2026). Trước khi sửa,
> hãy grep lại địa chỉ đó; nếu lệch thì cập nhật địa chỉ, không đoán.

## Nhật ký thực thi

Cập nhật 2026-09-02, chạy tại HEAD `d2cd4c0` với thay đổi chưa commit.

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Fix hook ghi `.logs` vào source tree | **XONG** — 15 điểm dùng helper chung, rác đã xoá, probe cuối suite đã thêm, suite PASS 1172 |
| 2 | Dogfood feature thật ngoài CafeKit | **CHỜ USER** — cần user chọn repo và feature |
| 3 | Giảm churn refresh receipt | **CHỜ USER** — cần user chọn phương án A / B / C |
| 4 | Docs, changelog, release | **XONG PHẦN KHÔNG CẦN QUYẾT** — 4a, 4c, 4e xong; 4b và 4d chờ user |
| 5 | Cài lại projection Codex | **XONG PHẦN LỚN** — rules 10/10, `loop` + `route` đã cài, 5/6 skill cũ đã gỡ; xem ghi chú bên dưới |
| 6 | Packet gỡ kernel legacy | **CHƯA MỞ** — chờ Việc 2 và mốc ~20/09 |

Ghi chú Việc 1: nguyên nhân gốc đúng như mô tả, nhưng có **bốn** fixture test copy hook thô chứ không phải hai như plan dự đoán. Ngoài `develop-contract.test.js` và `specs-v2-execution-closeout.test.js` còn `spec-gate.test.js`, `state.test.js`. Mỗi chỗ phải copy kèm `hooks/lib/hook-state-dir.cjs`, nếu không hook fail-closed với thông báo thiếu module. Commit `e281605` ghi nhầm là năm; con số đúng là bốn.

Sai số khác đã xác minh trong chính plan này, giữ lại để không ai đọc nhầm: bảng đối chiếu changelog ở Việc 4c liệt kê bảy mốc còn thiếu, thực tế là mười một vì bỏ sót Develop, Test và hai mốc Brainstorm; Việc 4e ngầm cho rằng ba plan cũ sẽ commit được, nhưng chúng nằm trong thư mục con của `plans/` mà `.gitignore:107` chặn, nên sửa đó chỉ tồn tại trên máy; tiêu chí Việc 5 đòi "không còn 6 skill đã bỏ" là quá chắc, `backend-development` bị xếp user-owned nên installer từ chối gỡ kể cả với `--force-overwrite`.

Ghi chú Việc 1, bước 6: **đã kiểm và bỏ qua**. Thu hẹp `.gitignore` từ `.codex` thành `/.codex` sẽ làm lộ `packages/spec/.agents` (451 file) và `packages/spec/.codex` (61 file) — một bản cài Codex cũ nằm nhầm trong package từ 2026-08-04. Chúng đang bị pattern trần che, không ảnh hưởng Head vì file bị ignore không vào `git status --untracked-files=all`. Thu hẹp gitignore phải đi kèm quyết định xoá 512 file đó, nằm ngoài phạm vi plan này.

Ghi chú Việc 5: bản cài giữ nguyên 8 file bị xếp là user-modified. Đã đối chiếu 3 file: `hotfix/SKILL.md` giống hệt source sau chuẩn hoá tên, `debug/SKILL.md` chỉ khác ở đường dẫn `.codex/references/` đúng theo phép chuyển đổi Codex, riêng `brainstorm/SKILL.md` **thật sự cũ** — thiếu câu về optional document bundle của 01/09. `backend-development` cũng được giữ vì bị xếp user-owned nên không bị prune. Muốn dứt điểm cần `--force-overwrite` cho Codex, có backup ở `.cafekit-backup/`; đây là quyết định của user.

## Ngữ cảnh bắt buộc cho mọi delegation

- Work context: `/Users/nghialuutrung/Desktop/cafekit`
- Specs: `/Users/nghialuutrung/Desktop/cafekit/specs/`
- Docs: `/Users/nghialuutrung/Desktop/cafekit/docs/`
- Package chính: `packages/spec/` (npm `@haposoft/cafekit`, version `0.16.0-rc.8`)
- Suite: `npm --prefix packages/spec test` (tại HEAD: PASS 1171 tests, exit 0)

## Quy ước chung khi thực thi

1. Đọc `CLAUDE.md`, `AGENTS.md` và `.claude/rules/*.md` của repo trước. Xưng hô với user là "bro", trả lời tiếng Việt.
2. Việc nào là feature hoặc thay đổi thiết kế thì đi qua `/hapo:specs` (C1 → C2) rồi `/hapo:develop`. Việc nào là bug có nguyên nhân đã rõ thì dùng `/hapo:fix`. Việc nào chỉ là chạy lệnh hoặc sửa docs thì làm trực tiếp.
3. Không commit, không publish npm, không đổi dist-tag khi user chưa nói rõ. Conventional commits, không AI attribution.
4. Không sửa `specs/*/task-*.md` đã `done` để "cho qua gate". Nếu gate báo receipt lỗi, đọc Việc 3 trước khi làm gì.
5. Sau khi chạy suite từ source tree, kiểm tra rác: `find packages/spec/src -name .logs -type d`. Nếu còn, xem Việc 1.

## Tổng quan thứ tự

| # | Việc | Kích cỡ | Luồng | Phụ thuộc | Cần user quyết |
|---|---|---|---|---|---|
| 1 | Sửa bug hook ghi `.logs` vào source tree | S | `/hapo:fix` | không | không |
| 2 | Dogfood 1 feature thật ngoài CafeKit, đo 4 thước | M | `/hapo:specs` ở repo khác | Việc 1 nên xong trước để gate không báo giả | chọn repo/feature |
| 3 | Giảm churn refresh receipt (thiết kế gate) | L | `/hapo:brainstorm` → `/hapo:specs` | không, nhưng nên có số liệu Việc 2 | có, chọn phương án |
| 4 | Đồng bộ docs, 2 changelog, trạng thái release | S–M | `/hapo:docs --update` + tay | không | có, quyết release |
| 5 | Cài lại projection Codex | S | lệnh installer | không | không |
| 6 | Packet gỡ kernel legacy | XL | `/hapo:specs` | Việc 2 đo xong, mốc ~20/09 | có, C1 |

---

## Việc 1. Sửa bug hook ghi `.logs` vào source tree

### Triệu chứng đã quan sát

- Chạy `npm --prefix packages/spec test` từ repo tạo `packages/spec/src/claude/hooks/.logs/` (hiện untracked giữa lúc chạy, `git status` báo `??`) và tích rác vào `packages/spec/src/.codex/hooks/.logs/` (155 file `rules-*.json` từ 14/08 đến 02/09).
- Rác `src/.codex/` không hiện trong `git status` vì `.gitignore:117` có pattern trần `.codex` (khớp ở mọi độ sâu). Kiểm chứng: `git check-ignore -v packages/spec/src/.codex/hooks/.logs/x`.
- Hậu quả: Head của receipt provenance được tính từ manifest worktree (`packages/spec/src/claude/scripts/provenance.cjs:165-199`) và danh sách loại trừ ở `provenance.cjs:157-159` chỉ có `.claude/hooks/.logs` và `.codex/hooks/.logs` ở gốc repo. File rác dưới `packages/spec/src/...` làm Head đổi → gate Stop báo receipt lệch dù không ai sửa gì. Memory ghi 3 lần báo giả trong 2 ngày.

### Nguyên nhân gốc

Hook tính thư mục log theo vị trí file (`__dirname`) hoặc theo `projectRoot`, đúng cho bản installed (`.claude/hooks/`) nhưng sai khi test chạy hook thẳng từ `packages/spec/src/`.

Các chỗ chưa có guard, phía Claude (11 vị trí):

| File | Dòng |
|---|---|
| `packages/spec/src/claude/hooks/agent.cjs` | 93 |
| `packages/spec/src/claude/hooks/rules.cjs` | 96 |
| `packages/spec/src/claude/hooks/inspect-block.cjs` | 118 |
| `packages/spec/src/claude/hooks/session.cjs` | 272 |
| `packages/spec/src/claude/hooks/spec-state.cjs` | 19 và 185 (`tollgate-last.txt`) |
| `packages/spec/src/claude/hooks/task-scaffold-guard.cjs` | 87 |
| `packages/spec/src/claude/hooks/state.cjs` | 283 |
| `packages/spec/src/claude/hooks/spec-gate.cjs` | 47 và 205 (`spec-gate-last.json`) |
| `packages/spec/src/claude/hooks/usage.cjs` | 190 |

Phía Codex (3 vị trí, dùng `projectRoot` nên khi chạy từ source thì root = `packages/spec/src`):

| File | Dòng |
|---|---|
| `packages/spec/src/codex/hooks/rules.cjs` | 18 |
| `packages/spec/src/codex/hooks/spec-state.cjs` | 24 |
| `packages/spec/src/codex/hooks/spec-gate.cjs` | 135–141 |

Hai chỗ **đã có guard đúng**, dùng làm mẫu:

- `packages/spec/src/claude/hooks/docs-sync.cjs:96-99`: nếu `__dirname` chứa `packages/spec/src` thì ghi vào `os.tmpdir()/cafekit-hook-logs/claude-docs-sync`.
- `packages/spec/src/codex/hooks/lib/hook-context.cjs:118-121`: cùng logic với `PROJECT_ROOT`.

### Các bước

1. Tạo một helper dùng chung phía Claude, ví dụ `packages/spec/src/claude/hooks/lib/hook-state-dir.cjs`, export một hàm trả về thư mục state/log theo đúng quy tắc của `docs-sync.cjs:96-99`. Thay 11 vị trí trên bằng helper. Kiểm tra `migration-manifest.json` để file lib mới được cài và prune đúng.
2. Phía Codex: export hàm tương tự từ `hook-context.cjs` (đã có logic ở dòng 118-121) và dùng ở 3 vị trí trên. Không tạo file lib mới nếu không cần.
3. Cập nhật test đang tự ghép đường dẫn `.logs`: `bin/__tests__/codex-hooks.test.js` (6 chỗ), `bin/__tests__/develop-contract.test.js` (4), `src/claude/hooks/__tests__/spec-gate.test.js` (2), `scripts/run-skill-self-tests.mjs` (2), `bin/__tests__/specs-v2-execution-closeout.test.js` (1), `src/claude/hooks/__tests__/completion-authority.test.js` (1), `src/claude/hooks/__tests__/state.test.js` (1). Test nào đọc cache `spec-gate-last.json` hay `tollgate-*.txt` phải tính path qua helper hoặc qua fixture install thật, không hardcode.
4. Xoá rác hiện có: `packages/spec/src/.codex/` (toàn bộ, chỉ chứa `.logs`) và thư mục rỗng `packages/spec/src/claude/hooks/.logs/`. Trước khi xoá, `ls` để chắc chỉ có file `rules-*.json` / `hook-log.jsonl`.
5. Thêm một kiểm tra cuối suite trong `scripts/run-skill-self-tests.mjs`: sau khi mọi test chạy xong, `packages/spec/src` không được chứa thư mục `.logs` nào. Đây là probe trỏ về sự cố thật (3 báo giả), hợp luật C-2.
6. Cân nhắc thu hẹp `.gitignore:117` từ `.codex` thành `/.codex/` (và `.gitignore:115` `.claude` tương tự) để rác lồng sâu không bị che. Kiểm tra trước bằng `git status --ignored` xem có gì khác đang dựa vào pattern trần.

### Không làm

- Không đổi vị trí log của bản installed. `.claude/hooks/.logs/` phải giữ vì `.gitignore:90` và `provenance.cjs:158` đã tính đúng chỗ này.
- Không thêm `**/.logs/` vào exclude của `provenance.cjs` như cách "che" thay cho sửa gốc. Có thể thêm nếu user đồng ý, nhưng phải đi kèm bước 1–2.

### Tiêu chí chấp nhận

- Chạy `npm --prefix packages/spec test` hai lần liên tiếp: PASS, và `find packages/spec/src -name .logs -type d` trả về rỗng sau mỗi lần.
- `git status --porcelain` sạch sau suite (không `??` dưới `packages/spec/src`).
- Bản installed: sau `node packages/spec/bin/install.js --platform claude --dry-run` không có thay đổi hành vi log ngoài file lib mới được liệt kê.

---

## Việc 2. Dogfood một feature thật ngoài CafeKit, đo 4 thước

### Vì sao

11 packet đã chạy đều là CafeKit tự sửa CafeKit, mỗi packet 2 task theo cùng khuôn "author contract + prove parity". Essence doc (`plans/20260818-essence-specs-process-first.md`, mục "Thước đo thành công") đo trên "một feature vừa (3–5 task)". Chưa có số liệu nào đúng đối tượng. Mốc gỡ kernel (~20/09) phụ thuộc số liệu này.

### Chọn feature

- Repo sản phẩm thật của haposoft (không phải cafekit, không phải cafekit-web), có test tự động chạy được.
- Feature ước 3–5 task, có ít nhất 1 task chạm 2 module trở lên.
- User chọn repo và feature; model không tự chọn.

### Chuẩn bị

1. Cài CafeKit bản hiện tại vào repo đích: `npx @haposoft/cafekit@0.16.0-rc.8 --platform claude -y` (dist-tag `latest` hiện trỏ rc.8). Hoặc cài từ source: `node /Users/nghialuutrung/Desktop/cafekit/packages/spec/bin/install.js --platform claude`.
2. Xác nhận hook wired: `.claude/settings.json` của repo đích có `spec-gate.cjs` ở Stop.
3. Mở file đo `plans/reports/2026-09-DD-dogfood-external-<slug>.md` **trong repo cafekit** với bảng dưới, điền dần trong lúc chạy.

### Chạy chuỗi

`/hapo:specs` (C1) → review → C2 → `/hapo:develop` (từng task) → `/hapo:test` → `/hapo:code-review` → C3.

Không sửa skill CafeKit giữa chừng để "đạt điểm". Ghi lại điểm vướng, sửa sau khi đo xong.

### Bảng đo

| Thước | Cách đếm | Kết quả |
|---|---|---|
| 1. ≤3 quyết định người / feature | Đếm mọi lần model dừng hỏi user (AskUserQuestion, xác nhận, re-approve). C1, C2, C3 là 3 lần chuẩn. Ghi từng lần thừa và vì sao. | |
| 2. 0 false-done lọt C3 | Sau C3, mở phiên mới (context sạch), chạy lại đúng lệnh trong `## Receipt` của từng task, so exit code và output. Đọc diff từng task xem có làm đúng Outcome không. Ghi số task lệch. | |
| 3. Luật mới phải trích sự cố | Nếu trong lúc chạy phải thêm bất kỳ luật/probe/bước nào vào skill, ghi luật đó kèm sự cố cụ thể. Không có sự cố → không thêm. | |
| 4. Sửa 1 luật = 1 file | Nếu phải sửa một luật, đếm số file phải chạm để luật đó nhất quán. | |

Ghi thêm: số findings C2 và số bị user bác (11 packet trước đều "accept all", 0 bị bác; cần biết cửa C2 có phân biệt hay không). Ghi thời gian mỗi cửa.

### Tiêu chí chấp nhận

- File report có đủ 4 dòng kết quả, mỗi dòng có bằng chứng (lệnh, output hoặc trích dẫn).
- Kết luận một câu: đủ điều kiện gỡ kernel hay chưa, và điều gì còn thiếu.

---

## Việc 3. Giảm churn refresh receipt (quyết định thiết kế)

### Bằng chứng churn

- 20/89 commit từ 18/08 đến 02/09 chỉ để refresh, rebind receipt hoặc dời marker sync (`git log --since=2026-08-18 --oneline | grep -iE 'refresh|rebind|re-close|sync (source|docs)'`).
- Chuỗi nhân quả mẫu: `4560f08 fix(docs): refresh source sync revision` (commit docs) → `408b82c fix(specs): rebind receipts after docs sync`.
- 4/16 commit gần nhất vẫn thuộc loại này, sau cả bản sửa provenance ngày 26/08 (`6608d55`, `b2d01f8`).
- Sự cố tái hiện ngay lúc viết plan này (02/09): chỉ tạo file `plans/20260902-post-remake-followups.md` (untracked, ngoài `specs/`) là gate Stop báo "27 done task(s) lack a verification receipt, failed check(s) provenance". `git status --porcelain` lúc đó chỉ có đúng file đó. Không ai chạm receipt hay source.

### Cơ chế hiện tại (đọc trước khi đề xuất)

1. `packages/spec/src/claude/scripts/provenance.cjs:86-104` (`gitBase`): Base = commit mới nhất **có thay đổi ngoài thư mục specs**. Commit docs, plans, test, web đều dời Base.
2. `provenance.cjs:165-199` (`manifest`, `manifestDigest`): Head = digest của toàn worktree trừ specs root và vài thư mục runtime (`:157-159`).
3. `packages/spec/src/claude/hooks/spec-gate.cjs:126-146`: khi không có packet nào đang chạy (`layoutKind === 'process-v3-completed-set'`), gate gọi `RECEIPT.checkWorkflowReceiptSet(resolved.candidates, ...)` để **kiểm lại mọi task done của mọi packet đã hoàn tất** so với Base/Head hiện tại. `spec-gate.cjs:228-231` ghi rõ chính sách: "every Stop revalidates the canonical receipt for every task currently marked done".
4. Hệ quả: một commit bất kỳ ngoài `specs/` → 27 receipt của 11 packet đồng loạt lệch Base → phải chạy lại lệnh và ghi lại Base/Head → commit refresh. Commit refresh chỉ chạm `specs/` nên không dời Base, vòng dừng ở đó cho tới commit source tiếp theo.
5. Codex có bản gương: `packages/spec/src/codex/hooks/spec-gate.cjs` và `src/codex/hooks/lib/spec-receipt.cjs` (load policy chung từ Claude, có fallback riêng ở dòng 63).

Điểm mâu thuẫn với essence: luật C-1 nói "Xong = bằng chứng" tại thời điểm xong; ngoại lệ máy duy nhất là "receipt tồn tại + exit code + so content-hash". Cách hiện tại nâng thành "bằng chứng phải luôn tươi so với HEAD hiện tại", tức chuyển từ kiểm bịa thành kiểm mới, và đó là nguồn thuế.

### Ba phương án đưa ra C1 (đề xuất, chưa kiểm chứng)

| Phương án | Nội dung | Được | Mất |
|---|---|---|---|
| A. Thu hẹp Base | `gitBase` loại thêm `paths.docs` và `paths.plans` (đọc từ `runtime.json`, khoá `paths` ở `packages/spec/src/claude/runtime.json:12-14`) giống cách đã loại specs. | Cắt cascade docs → receipt. Nhỏ, ít test đổi. | Commit src/test vẫn dời Base. Giảm chứ không hết churn. |
| B. Base theo task | Base = commit mới nhất chạm các path trong mục `Ownership` của task. | Đúng ngữ nghĩa "proof cho phần mình sở hữu". | Phải parse Ownership, path glob, khó chuẩn hoá; test lớn. |
| C. Đóng băng sau done | Ở transition sang `done`, gate kiểm đủ (lệnh, exit 0, Base/Head khớp runtime). Sau đó lưu hash byte của khối `## Receipt` vào cache; các Stop sau chỉ kiểm receipt **không bị sửa** (hash khớp) và còn đủ trường, không so lại Base/Head với HEAD mới. Cache mất → kiểm lại đủ một lần rồi ghi lại. | Hết churn hoàn toàn. Vẫn chặn bịa và sửa lén. Đúng tinh thần C-1. | Đổi chính sách ghi ở `spec-gate.cjs:228-231`; cache trở thành một phần sự thật (cần ghi vào git hay không là câu hỏi phụ). Test `spec-gate.test.js` (1481 dòng) và `codex-hooks.test.js` đổi nhiều. |

Khuyến nghị đưa lên C1: **C kết hợp A**. A cắt nguồn cascade rõ nhất với chi phí nhỏ; C giải quyết gốc. Nếu user chỉ muốn một bước nhỏ trước 20/09 thì làm A.

### Luồng thực thi

1. `/hapo:brainstorm` với 3 phương án trên, ra decision contract.
2. `/hapo:specs` tạo packet `specs/receipt-freshness-policy/` (tên gợi ý). Task gợi ý: (01) Base/Head policy trong `provenance.cjs` + `workflow-policy.cjs` phần receipt (hàm `validateCanonicalReceipt` ở `:1887`, `expectedProvenanceFromSource` ở `:245`); (02) gate Stop Claude + Codex; (03) cập nhật câu chữ rule và message: `packages/spec/src/claude/hooks/spec-state.cjs:225` ("Stop revalidates every task currently marked done"), `packages/spec/src/claude/rules/state-sync.md`, `workflow.md`, và `packages/spec/src/codex/rules/state-sync.md`.
3. Bằng chứng bắt buộc trong Verification Plan: một fixture có task done hợp lệ, sau đó (a) commit chỉ docs, (b) commit chỉ src không liên quan → gate không block; (c) sửa 1 byte trong `## Receipt` → block; (d) task mới chuyển done với Base/Head cũ → block.

### Không làm

- Không nới `validateCanonicalReceipt` tại thời điểm chuyển `done`. Ngoại lệ máy phải giữ nguyên độ chặt ở cửa vào.
- Không sửa 27 receipt hiện có bằng tay để "hợp" chính sách mới. Nếu chính sách mới cần định dạng khác, packet phải có bước migrate rõ.

---

## Việc 4. Đồng bộ docs, hai changelog, trạng thái release

### 4a. Docs sync

- `docs/.sync_hash` = `16c4fbc0…`, HEAD = `d2cd4c0…`, trễ 16 commit. Hook `docs-sync.cjs` sẽ nhắc mỗi phiên tới khi hash được ghi lại.
- Chạy `/hapo:docs --update`. Các file chắc chắn cần chạm:
  - `docs/project-changelog.md`: thiếu 3 entry dưới `[Unreleased]`: docs v2 với Post-Task Docs Checkpoint và Delegation Gate (01/09, commit `15e725c`), statusline configurable layout (02/09, `833ab78`), port 2 rule `review-audit-self-decision.md` + `process-management.md` (02/09, `8a86590`). Đã có entry cho optional bundle 01/09.
  - `docs/installer-architecture.md`: commit cuối 19/08, chưa nói tới bundle tài liệu tuỳ chọn, cờ `--with-document-skills` / `--without-document-skills`, 6 skill không còn cài, `schemaVersion: 2`. Nguồn: `packages/spec/bin/install.js` phần help (dòng ~93-115) và `plans/20260901-optional-skills-install-inventory/plan.md`.
  - `docs/specs-usage-guide.md` (28/08): đối chiếu với `packages/spec/src/claude/skills/specs/SKILL.md` hiện tại, sửa nếu lệch.
- Kết thúc: ghi HEAD tại thời điểm sync vào `docs/.sync_hash`.

### 4b. Cấu trúc `docs/project-changelog.md`

Mục `## [0.16.0] - 2026-08-04` nằm **trên** `## [Unreleased]` trong khi npm chưa có 0.16.0 final (dist-tag `latest` = `0.16.0-rc.8`). Hỏi user chọn một: (i) đổi tiêu đề mục đó thành dải rc và giữ nguyên thứ tự chuẩn Keep a Changelog (Unreleased lên đầu), hoặc (ii) gộp nội dung vào `[Unreleased]` chờ 0.16.0 final. Không tự quyết.

### 4c. `packages/spec/CHANGELOG.md`

Mục `[Unreleased]` hiện có 4 bullet (research/loop, đổi tên `hapo:fix`, repair framing, mutation coverage). Đối chiếu từng mốc sau bằng grep trước khi thêm: đổi tên `hapo:ask`/`hapo:scout` (28/08, `b9e3f0d`), debug adaptive (29/08, `19f1bb3`), relationship integrity (31/08, `65fd5d0`), bundle tài liệu tuỳ chọn + native routing (01/09, `16c4fbc`), docs v2 (`15e725c`), statusline (`833ab78`), rules port (`8a86590`). Mốc release trước là `[0.16.0-rc.8] - 2026-08-25`.

### 4d. Trạng thái release (user quyết)

- npm: `latest` = `0.16.0-rc.8`, `next` = `0.16.0-rc.6` (cũ hơn `latest`, ngược). Git không có tag nào cho 0.16.x (tag mới nhất theo thời gian là `v0.8.17`).
- Trình cho user 2 lựa chọn: (i) cắt `0.16.0` final từ HEAD sau khi Việc 1 và 4a–4c xong; (ii) ra `0.16.0-rc.9` và giữ `next` = `latest`. Cả hai đều cần sửa dist-tag `next` (`npm dist-tag add @haposoft/cafekit@<ver> next`).
- Commit release theo mẫu `8f2961c` (chỉ chạm `packages/spec/CHANGELOG.md` và `packages/spec/package.json`). Kiểm `packages/spec/package.json` không còn wire `release-preflight.mjs` vào prepack (đã gỡ ở `f931303`).
- Chỉ publish khi user nói rõ.

### 4e. Trạng thái plan cũ lệch thực tế

Ba file frontmatter dòng 4 còn `status: pending` dù việc đã land. Với mỗi file, xác minh commit tương ứng rồi mới đổi sang `completed` và ghi commit vào frontmatter:

| Plan | Commit cần xác minh |
|---|---|
| `plans/20260820-specs-skill-blind-dogfood-fixes/plan.md` | tìm commit 20/08 chạm `specs/references/templates.md` và `review.md` |
| `plans/20260830-hapo-fix-hotfix-learning/plan.md` | `df73206 feat(skills)!: rename hotfix to fix` và các commit cùng ngày |
| `plans/20260831-relationship-integrity-process-first/plan.md` | `65fd5d0 fix(workflow): align process-first relationship contracts` |

### Tiêu chí chấp nhận

- Hook docs-sync im lặng ở phiên mới (hash khớp HEAD).
- Hai changelog có đủ entry cho mọi commit `feat`/`feat!` từ 25/08 đến HEAD; kiểm bằng `git log --since=2026-08-25 --pretty=%s | grep -E '^feat'` rồi đối chiếu tay.
- Quyết định release và cấu trúc changelog được ghi vào changelog hoặc vào plan này, không để ngầm.

---

## Việc 5. Cài lại projection Codex

### Bằng chứng lệch

- `.codex/rules/` thiếu `process-management.md` và `review-audit-self-decision.md`. Rule Codex được installer chuyển từ `packages/spec/src/claude/rules/` (source `src/codex/rules/` chỉ có 2 file gốc), nên chỉ cần chạy lại installer.
- `.agents/skills/` thiếu `loop` và `route`; vẫn còn 6 skill đã bỏ khỏi inventory: `backend-development`, `devops`, `frontend-design`, `frontend-development`, `mobile-development`, `react-best-practices`.
- `.codex/cafekit.json` còn `schemaVersion: 1`; `.codex/cafekit-manifest.json` trộn entry `0.16.0-rc.6` và `rc.8`.
- `.agents/skills/herdr-orchestrator` là skill của user, không thuộc CafeKit. Installer phải để nguyên.

### Các bước

1. `node packages/spec/bin/install.js --platform codex --with-document-skills --dry-run` từ gốc repo. Đọc kỹ danh sách sẽ xoá: chỉ được có 6 skill trên và file mồ côi CafeKit sở hữu. Nếu thấy `herdr-orchestrator` hoặc file user sửa trong danh sách xoá, dừng và báo.
2. Chạy thật (bỏ `--dry-run`). Dùng `--with-document-skills` vì repo này đang cài `docs/docx/pdf/pptx/xlsx/ai-multimodal` trong `.agents/skills/`.
3. Kiểm sau cài:

```bash
diff <(ls packages/spec/src/claude/rules) <(ls .codex/rules)
ls .agents/skills | grep -E '^(loop|route)$'
ls .agents/skills | grep -E 'backend-development|devops|frontend|mobile-development|react-best-practices' ; echo "exit=$? (mong đợi 1)"
ls .agents/skills/herdr-orchestrator
grep schemaVersion .codex/cafekit.json
git status --porcelain
```

4. `.codex/` và `.agents/` bị gitignore nên không có gì commit, trừ khi installer đổi managed block trong `AGENTS.md` (tiền lệ `38c005f docs: refresh managed instruction blocks via installer`). Nếu `AGENTS.md` đổi, xem diff rồi báo user trước khi commit.

### Tiêu chí chấp nhận

- `.codex/rules` có đủ 10 file như `packages/spec/src/claude/rules`.
- `.agents/skills` có `loop`, `route`, không còn 6 skill đã bỏ, vẫn còn `herdr-orchestrator` nguyên vẹn.
- `.codex/cafekit.json` `schemaVersion: 2`.

---

## Việc 6. Packet gỡ kernel legacy (sau khi Việc 2 đo xong, mốc ~20/09)

### Điều kiện mở

- Report Việc 2 kết luận đủ điều kiện, hoặc user quyết gỡ dù thiếu số liệu (ghi rõ).
- Việc 3 đã có quyết định, vì phần receipt/provenance là thứ **giữ lại**, phải biết hình dạng cuối trước khi cắt phần còn lại.

### Kiểm kê tại HEAD (dòng code, chưa tính test)

Scripts `packages/spec/src/claude/scripts/` tổng 14.582 dòng:

| File | Dòng | Phân loại | Ghi chú |
|---|---|---|---|
| `validate-spec-output.cjs` | 3.941 | legacy | require `semantic-review-authority`, `spec-authoring-digest`, `spec-ground`, `spec-semantic-model`, `workflow-policy` |
| `spec-scaffold.cjs` | 2.317 | legacy | được gọi bởi hook `task-scaffold-guard.cjs:65` |
| `workflow-policy.cjs` | 2.294 | **trộn** | giữ `validateCanonicalReceipt` (`:1887`), `expectedProvenanceFromSource` (`:245`), `receiptValidatorOptions`, `deriveRuntimeContext`; phần lane/approval/flash (~`:800-1880`) là legacy |
| `change-firewall.cjs` | 1.748 | legacy, đang pause | 3 test file, 54 mention |
| `spec-resolver.cjs` | 929 | **trộn** | resolve process-first (`layoutKind 'process-v3-*'`, `:912`) + nhánh `spec.json` |
| `spec-ground.cjs` | 650 | legacy | |
| `spec-readiness.cjs` | 425 | legacy | |
| `spec-semantic-model.cjs` | 396 | legacy | |
| `spec-receipt.cjs` | 357 | giữ | |
| `provenance.cjs` | 328 | giữ | |
| `spec-final-state.cjs` | 290 | legacy | dùng bởi `completion-authority-check.cjs:22` |
| `generate-skill-catalog.cjs` | 218 | giữ | routing mới |
| `validate-docs-reconstruct.cjs`, `validate-docs.cjs`, `scan-staged-secrets.cjs` | 176 / 66 / 170 | giữ | docs, git skill |
| `spec-authoring-digest.cjs` | 151 | kiểm lại | essence từng nói giữ, nhưng hiện chỉ được require bởi 4 file legacy; hash process-first nằm ở `provenance.cjs:199` |
| `spec-authoring-validation.cjs` | 126 | legacy | |

Hooks `packages/spec/src/claude/hooks/` tổng 5.944 dòng (kể lib). Legacy đang wired trong `packages/spec/src/claude/settings/settings.json`:

| Hook | Dòng | Event | Ghi chú |
|---|---|---|---|
| `completion-authority.cjs` + `completion-authority-state.cjs` + `completion-authority-check.cjs` | 154 + 527 + 56 | UserPromptSubmit, Stop | 0 tham chiếu `plan.md`/process-first |
| `semantic-review-authority.cjs` | 152 | SubagentStop | gọi `validate-spec-output.cjs` (`:78`, `:88`) |
| `task-scaffold-guard.cjs` | 93 | PreToolUse | gọi `spec-scaffold.cjs` |
| `spec-state.cjs` nhánh legacy | ~`:226-230` | UserPromptSubmit | message `spec.json` / `receipts/` / `validate-spec-output` |
| `spec-gate.cjs` nhánh legacy | phần `taskRegistry`, `staleFlashTasks` (`:217-223`) | Stop | giữ phần process-v3 |

Codex gương: `packages/spec/src/codex/hooks/completion-authority*.cjs`, nhánh legacy trong `spec-gate.cjs`/`spec-state.cjs`, fallback trong `lib/spec-receipt.cjs:63`.

Skill `specs` còn 254 dòng template legacy: `packages/spec/src/claude/skills/specs/templates/{design.md, spec-state.json, task.md, requirements.md, research.md, requirements-init.md}`.

Test gắn với legacy (ứng viên xoá hoặc cắt), tổng ~13.000 dòng:

| Test | Dòng |
|---|---|
| `bin/__tests__/validator-grounding.test.js` | 3.210 |
| `bin/__tests__/develop-contract.test.js` | 3.337 (cắt phần lane/flash, giữ phần develop v3) |
| `bin/__tests__/change-firewall.semantic-firewall.test.js` | 2.133 |
| `bin/__tests__/specs-v2-validator-grounder-contract.test.js` | 1.132 |
| `src/claude/hooks/__tests__/completion-authority.test.js` | 983 |
| `bin/__tests__/specs-v2-policy-and-scaffold.test.js` | 665 |
| `bin/__tests__/release-preflight.semantic-firewall.test.js` | 586 |
| `bin/__tests__/specs-v2-execution-closeout.test.js` | 468 |
| `bin/__tests__/review-receipt-c2.semantic-firewall.test.js` | 378 |
| `bin/__tests__/finalizer-pass-gate.semantic-firewall.test.js` | 342 |
| `src/claude/hooks/__tests__/semantic-review-authority.test.js` | 257 |

Scripts phụ: `packages/spec/scripts/release-preflight.mjs`, `semantic-firewall-test-discovery.cjs`, `benchmark-workflow.mjs` (kiểm `release:freeze` trong `package.json:16`).

Từ khoá của danh sách "vứt" còn sống trong source (không tính test): `planning_depth` 17 file, `execution_tier` 14, `semantic_model` 14, `repair_round` 5, `epoch` 5, `lineage` 5. Dùng làm checklist quét cuối.

### Quyết định C1 phải hỏi user

- Bỏ hẳn hỗ trợ packet `spec.json` (breaking, cần bump major hoặc ghi rõ trong changelog) hay giữ một adapter chỉ-đọc? Khuyến nghị: bỏ hẳn, vì lộ trình internal-first và mọi packet active đều là process-first; `specs/archive/*` giữ làm lịch sử, không cần runtime.
- Có gỡ `change-firewall.cjs` cùng lúc không? Memory ghi "chỉ mở lại khi có sự cố thật"; đề xuất gỡ luôn kèm ghi chú.

### Hình dạng packet gợi ý (3 task tuần tự)

1. **Tách lõi receipt/provenance**: chuyển `validateCanonicalReceipt`, `receiptValidatorOptions`, `expectedProvenanceFromSource`, `deriveRuntimeContext` từ `workflow-policy.cjs` sang `spec-receipt.cjs` (hoặc module mới ≤ ~400 dòng); hooks Claude và Codex `lib/spec-receipt.cjs` trỏ sang module mới; suite xanh. Không xoá gì ở bước này.
2. **Gỡ dây và xoá**: bỏ 4 hook legacy khỏi `settings/settings.json` và bản Codex tương ứng; xoá scripts legacy, hooks legacy, test legacy, templates legacy; thêm entry `deletions` vào `packages/spec/src/claude/migration-manifest.json` để bản upgrade prune file cũ (tiền lệ changelog "Claude prune follow-up 2026-08-19"); cắt nhánh legacy trong `spec-gate.cjs`, `spec-state.cjs`, `spec-resolver.cjs`.
3. **Dọn chữ**: bỏ mục "Legacy compatibility" trong `packages/spec/src/claude/rules/{workflow,state-sync,manage-docs}.md`, `src/claude/CLAUDE.md`, `src/common/AGENTS.md`, `src/codex/AGENTS.md`, `src/codex/rules/state-sync.md`; bỏ tham chiếu `task_registry` trong `agents/project-manager.md`, `skills/develop/SKILL.md`, `skills/develop/references/parallel-waves.md`, `skills/sync/SKILL.md`, `skills/sync/references/sync-protocols.md`; bỏ tham chiếu `validate-spec-output.cjs` trong `agents/code-auditor.md`; cập nhật test parity installed và web docs.

### Tiêu chí chấp nhận

- Suite xanh; fresh install (`--dry-run` rồi thật vào thư mục tạm) không có file legacy nào; upgrade từ bản rc.8 có sẵn prune đúng file legacy.
- Hành vi gate process-first không đổi: các case trong `src/claude/hooks/__tests__/spec-gate.test.js` phần process-v3 vẫn pass; 4 case bằng chứng của Việc 3 vẫn pass.
- Quét từ khoá "vứt" trả về 0 file ngoài `specs/archive/` và changelog.
- Kích cỡ mục tiêu (ước lượng, không phải luật): `src/claude/scripts` ≤ ~2.500 dòng, `src/claude/hooks` ≤ ~4.000 dòng kể lib, thư mục skill `specs` ≤ 550 dòng.

---

## Phụ lục. Số liệu nền tại HEAD `d2cd4c0` (02/09/2026)

- 89 commit từ 18/08: 24 docs, 20 feat, 19 fix, 15 test, 4 release, 4 chore, 2 refactor.
- 11 packet process-first, 27/27 task done, receipt đủ trường, mỗi task đúng 1 `Status:` và 1 `## Receipt`.
- Suite 1171 test PASS. Spot-check 2 lệnh receipt chạy lại pass (statusline 10/10, routing 3/3).
- Lõi skill `specs` 496 dòng (SKILL 151 + review 127 + templates 218) + 254 dòng template legacy.
- 16 skill CafeKit tự viết: 6.488 dòng. Hooks 5.944, scripts 14.582, harness `run-skill-self-tests.mjs` 6.341 dòng với 162 probe kiểu neo chuỗi.
- Từ 19/08: test +10.292/−272 dòng, source +3.843/−2.216, specs +2.981, docs/plans/web +1.095/−1.993.
- PR mở: #55 (statusline active-spec, cần rebase vì 3 hunk giao vùng port), #64 (CI workflow, từ 07/07), #59 (web copy, từ tháng 6).
