# Plan thi công — Track A fixup PR #76 · Track B hậu merge

**Ngày**: 2026-08-06 · **Trạng thái**: TRACK A ĐÃ TRIỂN KHAI — FOCUSED LOCAL VERIFICATION COMPLETE; independent review, full installer/tarball matrix và live benchmark evidence vẫn pending; không chạy CI/CD trong checkpoint này
**Cập nhật 2026-08-07 (worker runtime/provenance remediation)**: `docs/provenance.md`, combined-install boundary (CORE neutral + ownership/ignore), OpenCode advisory `spec-gate` đã triển khai trong **Track A** để đóng H1/H5/parity trước merge. Track B (B1 benchmark baseline/treatment, B2 three-mode redesign, B3 validator hardening, B4 isolated entrypoint spike, B5 full ledger expansion) **vẫn là hậu merge, chưa đánh dấu done trong PR #76**. Không trộn artifact Track B (corpus, harness treatment, mode spec) vào PR này; chỉ deliver minimal contract để đạt 9–10/10 independent remake.
**Cập nhật 2026-08-07 (Track B1 harness — benchmark-workflow `run`):** `packages/spec/scripts/benchmark-workflow.mjs` đã bổ sung đường `run` reproducible (runner-adapter boundary, freeze corpus/config/repo/permissions/tool, capture command/wall_ms/artifact hash, emit receipt bất biến cho `validate`/`summarize`). Harness Track B1 coi như **implemented**; `docs/benchmark-workflow.md` đã cập nhật CLI contract (`--runner` argv array, `--out` bundle, fail-closed cho missing runner/placeholder/secret-like command/partial matrix/hash mismatch/artifact escape, redact stderr). **Live baseline/treatment results vẫn explicitly `exploratory/no-live-runs` (chưa chạy)** — không fabricate receipt hay claim kết quả. Harness này đủ để chạy baseline/treatment sau B2–B5 mà không cần sửa script.
**Nguồn finding**: 3 vòng review với 4 reviewer (2 Claude + 2 Codex gpt-5.6-sol), các finding blocking đã verify độc lập — chi tiết PHẦN 6 `plans/20260805-instructions-semantic-review.md`
**Branch Track A**: `refactor/instructions-2026` (PR #76, 11 commits, chưa merge) · **Track B**: sau merge, branch/spec riêng

## Quyết định chiến lược đã chốt (user, 2026-08-06)

| # | Quyết định | Hệ quả thi công |
|---|---|---|
| S1 | **Plugin-first là North Star** (tái xác nhận quyết định 20/07) | Installer chỉ nhận fix, không nhận feature mới; Track B4 giữ scope tối thiểu; plugin spike vẫn là blocker lộ trình 0.16→0.17 |
| S2 | **`--flash` KHÔNG unblock dependency khi chưa verify** — flash = `implemented_unverified`, không phải `done` | A9 thi công trong Commit A-II theo đúng đặc tả bên dưới |
| S3 | **AgentKit: pattern-only + clean-room rewrite + provenance ledger**; không lấy nguyên văn | B5 gồm tạo `docs/provenance.md`; mọi pattern port sau này phải qua ledger |
| A13 | **Track top-level `plans/*.md`** (không chuyển sang docs/) | Thay rule ignore để Git traverse được `plans/`; git add 5 file plan kỹ thuật trong Commit A-III |
| Dispatch | **1 worker tuần tự cả 3 commit** (không song song) | Files chồng nhau giữa A-II/A-III; 1 worker giữ mạch ngữ cảnh, 3 commit ranh giới rõ |

---

# TRACK A — Fixup PR #76 (chỉ sửa lỗi đã verify, KHÔNG thiết kế mới)

Ước lượng tổng sau fixup review: 2-4 ngày implementation + 1-2 ngày fixture/tarball verification/review. Chia 3 commit theo concern; không ép deadline cũ 1-1.5 ngày vì A1/A3/A9 nay có executable behavior + migration tests thật.

## Commit A-I: An toàn & hành vi installer (blocking)

### A1 [C1] Secret scanner trong `git/SKILL.md` — regression nghiêm trọng nhất
- Files: `packages/spec/src/claude/skills/git/SKILL.md` (~L29-34), helper mới `packages/spec/src/claude/scripts/scan-staged-secrets.cjs`, `packages/spec/src/claude/migration-manifest.json` (`scripts.required`)
- Hiện trạng (đã verify bằng 7 mẫu): regex `\b(api[_-]?key|...)\b\s*[:=]` MISS cả `OPENAI_API_KEY=`, `AWS_SECRET_ACCESS_KEY=`, `GITHUB_TOKEN=`, `JWT_SECRET=`, `"apiKey": "..."` — vì `\b` không cắt qua `_`. Kèm 2 lỗi hành vi: "show the lines" in giá trị secret vào transcript; gợi ý `git rm --cached` máy móc sai cho tracked source.
- Sửa:
  - Không khóa behavior vào một `grep` regex: regex tên-biến chứa keyword match sai cả `tokenizer=` và `password_hint_label=`; `grep -n` cũng chỉ trả line của diff stream, không phải source line.
  - Helper Node parse `git diff --cached --unified=0 --no-color --diff-filter=ACMR`; chỉ xét **added lines**, dùng hunk header để map đúng source `file:line`, bỏ context/deleted lines.
  - Detector kết hợp known-sensitive identifiers + identifier boundaries + safe-name exclusions (`*_label`, `*_hint`, `*_path`, `*_file`, `tokenizer`) và value signal; placeholder/example values không được block như secret thật nhưng phải có fixture rõ.
  - Output contract: **chỉ** báo file + source line + tên biến; không echo diff line, value hay surrounding context. Câu mẫu: "Blocked: possible secret `OPENAI_API_KEY` at src/config.ts:12. Value not shown."
  - `git/SKILL.md` gọi helper qua installed runtime script path; manifest phải ship helper cho Claude/Codex/OpenCode và installer transform path đúng từng runtime.
  - Bỏ câu "show the lines"; bỏ gợi ý `git rm --cached` mặc định → thay bằng: untracked → thêm `.gitignore`; tracked → dừng lại, khuyên rotate + hỏi user.
  - Xóa 2 annotation leak cùng file: heading "## References (unchanged)" → "## References"; xóa parenthetical "(Word-boundary + assignment context: ...)".
- Test: fixture mới chạy helper thật — true-positive env/JSON/YAML và các tên phổ biến; false-positive `tokenizer`, `password_hint_label`, `api_key_file`, placeholder; deleted/context lines không trigger; assert source line mapping; assert stdout/stderr không chứa secret value.

### A2 [H2] Fresh install ép `responseLanguage: "en"`
- File: `packages/spec/bin/lib/context.js` (~L312, L318-322) + `bin/phases/post-install.js` (`patchRuntimeLocale`)
- Hiện trạng (verified): cài không `--lang` → runtime.json ghi `"responseLanguage":"en"` → hook inject "Respond in en", trái core "Match the language the user writes in".
- Sửa: `ctx.locale` khởi tạo `null` (thay vì `'en'`); `ctx.lang` giữ `'en'` cho UI installer. `patchRuntimeLocale` + `patchSettingsLanguage` + `patchLanguageSection` chỉ chạy khi `ctx.locale` truthy (user chọn --lang / interactive / saved locale). Giữ nguyên hardening không-downgrade đã có.
- Test: fresh `--yes` không --lang → `locale.responseLanguage === null` cả 3 runtime + hook rules không inject dòng Language; case `--lang vi` giữ nguyên pass; upgrade không `--lang` phải giữ nguyên saved locale khác English.

### A3 [H6] Rename `god-developer` chưa end-to-end
- Files: `packages/spec/src/claude/migration-manifest.json` (obsolete), kiểm tra cơ chế prune agents trong `bin/phases/` (copy-payload/claude-runtime), `cafekit-web/src/components/docs/catalog-visuals.tsx:15`
- Hiện trạng (verified): upgrade giữ nguyên `god-developer.md|toml` cũ ở cả 3 runtime; web catalog còn render god-developer.
- Sửa: thêm obsolete entries cho agent cũ (Claude `agents/god-developer.md`; Codex `agents/god_developer.toml`; OpenCode `agents/god-developer.md`) và bổ sung ownership-aware prune cho **cả 3 runtime**. Không tái dùng xóa vô điều kiện của `removeObsoleteClaudeRuntimeFiles`: pristine/recorded old payload → delete + prune tracker; user-modified hoặc untracked user file → preserve + warn. Sửa catalog-visuals sang `implementer`.
- Test: fixture upgrade từ payload cũ 232520d cho từng runtime với 3 case: pristine → agent cũ biến mất; user-modified → preserve + warn; untracked user-created → preserve + warn. Mọi case phải có `implementer`; tracker không giữ zombie entry sau delete.

### A4 [M7] Malformed CORE marker im lặng
- File: `bin/phases/claude-runtime.js` (~L99) + nơi tương ứng codex/opencode dùng `managedRange` trả `false`
- Sửa: topology hỏng (marker lặp/thiếu END) → giữ nguyên không ghi (như hiện tại) NHƯNG `ctx.ui.warn` + `ctx.results.errors++` (trigger rollback transaction thay vì báo thành công).
- Test: ma trận mỗi runtime/root target gồm missing START, missing END, duplicate START, duplicate END, END-before-START. Installer phải exit khác 0, rollback toàn transaction, giữ exact bytes của file user và stderr nêu target + loại topology; không case nào được report `unchanged/success`.

## Commit A-II: Nhất quán contract trong skills (blocking)

### A5 [H3] Quality-gate mù tier
- File: `packages/spec/src/claude/skills/develop/references/quality-gate.md` (đầu file + L64-93)
- Sửa: thêm đầu file đoạn "Tier input (from develop Delegation policy)" và điều kiện hóa:
  - Light: main session tự chạy verification commands + tự soát spec compliance theo cùng checklist; KHÔNG spawn test-runner/code-auditor.
  - Standard: main session chạy test + spec check; **một** lượt `code-auditor` gộp spec compliance + code quality tại ship point.
  - Deep/`--parallel`: tạm giữ chain hiện tại trong Track A; B2 phải đánh giá lại theo risk, không coi chain này là contract bất biến.
  - Checklist nội dung (điều kiện FAIL) giữ nguyên cho MỌI tier — chỉ thay đổi AI NÀO thực hiện.
- Định nghĩa ship point máy hiểu được:
  - Specific-task mode: task được yêu cầu là ship point; review đúng diff/task packet đó một lần.
  - Full-spec Standard: task trung gian chỉ main-session gate; combined auditor chạy **một lần sau task cuối + Final Integration Scout**, review cumulative feature diff và toàn bộ acceptance/reachability.
  - Không set feature-level `code_done`/completion trước combined auditor PASS; auditor FAIL giữ feature chưa hoàn tất dù individual task receipts đã pass.
  - Auditor FAIL phải map finding về task/surface cần sửa; chỉ rerun affected evidence + combined review, không replay mọi gate đã pass.
- Sửa kèm: `develop/SKILL.md` L193 "the inspector" → "the scout" (leftover A2 cũ).
- Test behavior trace: Light 2 tasks = 0 subagent; Standard full-spec 3 tasks = đúng 1 auditor tổng; Standard specific-task = đúng 1 auditor; Deep giữ số call đã document. Assert bằng trace/call counter, không chỉ grep prose.

### A6 [H4] `--flash --parallel` hai contract
- File: `develop/SKILL.md` (~L227 + phần Arguments)
- Sửa: fail-fast ngay khi parse nếu có cả `--flash` và `--parallel`; báo hai flag incompatible rồi STOP trước khi ghi state/spawn/commit. Không tự bỏ `--flash` và chạy workflow đắt hơn yêu cầu. Điều kiện hóa L227 thành "If `--flash` is active (and `--parallel` is not)..."; Mode Matrix ghi rõ `unsupported — no execution`.
- Test: combined flags không sửa file/spec state, không spawn agent, không tạo worktree/commit và trả đúng remediation command.

### A7 [H5] Enum verdict thống nhất
- Files: `agents/code-auditor.md` (frontmatter L4 + body), `skills/code-review/references/verification-gate.md` (~L30), quét `NEEDS FIXES|USER INTERVENTION|Incomplete PASS|SPEC_PASS` toàn `src/claude`
- Sửa: một enum duy nhất **`PASS | FAIL | BLOCKED`** (BLOCKED = thiếu execution proof / môi trường chặn — thay cho "Incomplete PASS" và "USER INTERVENTION"; "NEEDS FIXES" = FAIL kèm findings). `SPEC_PASS` nội bộ quality-gate đổi thành "Stage 1 PASS" wording để khỏi thêm enum.
- Consumer semantics bắt buộc: PASS → proceed; FAIL → findings sửa được, quay implementer; BLOCKED → thiếu proof/quyền/môi trường/user-owned decision, dừng ngay và **không** blind-retry 3 vòng. Enum này chỉ là review verdict; agent lifecycle và test sub-status không bị đổi ngầm.
- Test: producer/consumer contract fixtures cho cả 3 verdict; grep-assert 0 match `NEEDS FIXES|Incomplete PASS|USER INTERVENTION` trong review payload; quality gate chứng minh BLOCKED dừng một lần, FAIL mới đi fix loop.

### A8 [mới, verified] 2 sửa 1-dòng
- `agents/spec-maker.md:128`: xóa pointer chết `tasks-parallel-analysis.md` (nội dung đã merge vào `tasks-generation.md` từ 0.13.0) → trỏ `tasks-generation.md`.
- `skills/specs/references/review.md:102`: bỏ quota — "find 5-10 flaws, findings only, NO praise" → "report only findings backed by a concrete citation; do not pad to a count" (khớp L115 "Quality over quantity" và evidence-gated red-team có sẵn).

### A9 [S2 — ĐÃ CHỐT] Flash không được là `done`
- Files: `develop/SKILL.md` (Step 4F/5), `skills/test/SKILL.md`, `skills/sync/SKILL.md` + `references/sync-protocols.md`, `hooks/spec-gate.cjs` (không cần sửa logic done-gate — xem dưới), OpenCode/Codex twins nếu có wording tương ứng
- Hiện trạng (verified): flash sync task thành done với receipt `FLASH_UNVERIFIED`, nhưng `spec-gate.cjs:90` đòi `Verification: PASS` → mâu thuẫn: hoặc gate chặn flash, hoặc flash lách gate.
- Storage mapping v2 đã chốt (không thêm status thứ năm trong Track A): semantic `implemented_unverified` được lưu bằng `status: "in_progress"` + receipt `Verification: FLASH_UNVERIFIED` + blocker `"awaiting /hapo:test <feature>"`; **không unblock dependency**. Develop Step 5 + sync wording phải thống nhất; spec-gate không xét vì task chưa newly-done.
- Định nghĩa promotion path: `/hapo:test <feature>` chỉ promote từng flash task khi toàn bộ exact Evidence + reachability của task đó PASS; thay receipt bằng proof thật → clear blocker → `/hapo:sync ... done` → dependency mới được unblock. FAIL/BLOCKED/NO_TESTS giữ `in_progress` và blocker; không blanket-promote mọi flash task trong feature.
- Test: flash fixture không có `done`, dependent task vẫn blocked; test PASS promote đúng một task + clear blocker + unblock dependency; test FAIL/BLOCKED/NO_TESTS không promote; spec-gate vẫn chặn mọi attempt set done khi receipt còn `FLASH_UNVERIFIED`.

## Commit A-III: Trung thực tài liệu (non-blocking nhưng gộp trước merge)

### A10 [M8] Quét nốt stats không nguồn
- `mobile-development/SKILL.md:120` (121K/170K/35%/46%/80-95%), `references/mobile-best-practices.md:490`, grep lại `[0-9]+(%|K)` toàn domain skills — xóa số hoặc thêm nguồn+ngày.

### A11 [M9] Changelog + PR body + version badge
- `packages/spec/CHANGELOG.md` [0.16.0] bổ sung: Addressing opt-in + preserved-on-reinstall; rename `god-developer`→`implementer` (breaking-ish, ghi rõ ai bị ảnh hưởng); delegation tiers; verdict enum mới; git skill rewrite; sửa câu "prohibition on editing global ~/.claude/skills" khớp wording mới; flash-state change (A9).
- `docs/project-changelog.md`: đưa mục Wave 4 về đúng section, sửa mô tả OpenCode language patch.
- `packages/spec/README.md:5`: badge 0.15.2 → 0.16.0.
- PR #76 body: thêm section cho commit skills-editorial + fixup; sửa số test (229 → số mới sau fixup); **sửa claim context**: "always-on wrapper+core ~64 dòng; effective load còn gồm rules/ 450 dòng — giảm tầng đó thuộc Wave 2, chưa làm trong PR này".

### A12 [develop L282] Câu CWD lặp
- "...in the wrong place and will fail to locate the root docs/ folder" → một vế: "...will fail to locate the root `docs/` folder."

### A13 [ĐÃ CHỐT] Un-ignore plans/*.md
- `.gitignore:108`: **không** giữ nguyên `plans/` rồi chỉ thêm `!plans/*.md` — Git không traverse parent directory đã ignore. Thay block bằng:
  ```gitignore
  plans/*
  !plans/*.md
  !plans/templates/
  !plans/templates/**
  ```
  Kết quả: Markdown cấp gốc được track; nested reports/evidence và top-level HTML/artifact khác vẫn ignore; templates hiện có tiếp tục track được.
- `git add` 5 file: `20260804-cafekit-opus5-fix-map.md`, `20260805-instructions-semantic-review.md`, `20260805-instructions-editorial-implementation.md`, `20260805-codex-review-brief.md`, `20260806-fixup-and-postmerge-plan.md` (+ `cafekit-2026-remake-tong-hop.md` nếu user không phản đối — chứa business context, hỏi 1 câu trước khi add).
- Test ignore contract bằng file temp: `plans/example.md` stage được; `plans/reports/example.md` và `plans/example.html` vẫn ignored; cleanup fixture sau test.

## Verification Track A (bắt buộc trước merge)

```bash
pnpm --filter @haposoft/cafekit test                  # toàn suite + fixtures mới
pnpm --filter web lint                                # A3 sửa catalog web
pnpm --filter web build                               # compile production web surface
(cd packages/spec && npm pack --dry-run)              # verify publish inventory
CAFEKIT_PACK_DIR="$(mktemp -d)"
(cd packages/spec && npm pack --pack-destination "$CAFEKIT_PACK_DIR")
# Toàn bộ install/upgrade matrix bên dưới PHẢI dùng tarball trong CAFEKIT_PACK_DIR, không dùng source checkout
# Ma trận cài đặt tarball: {claude, codex, opencode, combined, combined-rerun} × {no-lang, --lang vi}
#   no-lang: responseLanguage null, hook không inject Language
#   saved locale + no-lang upgrade: giữ nguyên saved locale
#   upgrade 232520d → tarball HEAD: pristine old agent pruned; modified/untracked old agent preserved + warned; notes user sống; addressing giữ
# Secret scanner helper: true/false positives, added-only, source-line mapping, output redaction
# Malformed markers: 5 topology cases × runtime; exact-byte rollback
# grep gates: 0 × "9\.5|NEEDS FIXES|Incomplete PASS|god-developer|packages/spec/src/" trong payload cài
# Tier behavior trace: Light 2 tasks → 0 spawn; Standard full-spec 3 tasks → 1 combined auditor; Standard specific → 1 auditor; Deep → documented count
# Flash transition: unverified không unblock; /hapo:test PASS promote đúng task; FAIL/BLOCKED/NO_TESTS giữ nguyên
git diff --check
```

Sau fixup: **review độc lập riêng cho fixup diff** (reviewer mới, không phải người lập plan, không phải worker viết fixup). Chỉ khi test, build, tarball matrix và review đều PASS mới xin quyết định merge PR #76; tag/publish 0.16.0 là authority riêng theo quy trình release, không được suy ra tự động từ merge.

---

# TRACK B — Hậu merge (thiết kế, không nhét vào PR #76)

Thứ tự phụ thuộc: B1a → B2 → (B3 ∥ B4 ∥ B5) → B1b. Mỗi mục mở spec riêng; `/hapo:specs` hiện tại chỉ dùng cho work high-risk này, không được lấy ceremony của nó làm acceptance cho thiết kế mới.

## B1. Benchmark harness + baseline/treatment split — ~4-7 ngày

### B1a — Làm trước B2: harness, corpus, baseline
- Corpus 12-20 task thật trên 1-2 repo mẫu: task nhỏ/reversible, Standard multi-file, và Critical negative controls (auth/privacy/migration/cross-runtime). Không chỉ dùng installer/hook/skill edits vì sẽ bias về local text/config work.
- Freeze per experiment: model/version, reasoning effort, prompt, repo commit, clean initial worktree, permissions và tool availability; mỗi run context-isolated, không dùng output/memory từ run trước.
- Baseline = workflow hiện tại. Chạy pilot rồi chọn repeat count; mục tiêu 2-3 repeats/task nếu budget cho phép, nếu chỉ 1 run phải gắn nhãn exploratory vì model output stochastic.
- Đo: requirement/acceptance correctness theo rubric độc lập, regression, unsupported completion claims, user correction, tool/subagent calls, wall time, tokens, context loaded, reviewer findings hữu ích và false-positive findings. Test pass chỉ là một tín hiệu, không phải toàn bộ correctness.
- Adjudication nên blind theo arm khi khả thi; ghi exact command/artifact và failure category, không chỉ điểm tổng.

### B1b — Chạy sau B2-B5: treatment + quyết định rollout
- Treatment = implementation Direct/Standard/Critical thật sau B2-B5, cùng corpus/config/repeat policy của baseline; không benchmark một prompt mock rồi gọi đó là workflow mới.
- Báo median + dispersion và kết quả tách theo lane; không gộp task trivial với Critical thành một score.
- Success gate: Direct/Standard giảm latency/cost rõ mà không tăng regression/user correction; Critical không giảm security/contract/evidence quality. Nếu không đạt, giữ lane cũ cho nhóm task thất bại và điều chỉnh trigger/gate.
- Deliverable: harness script, immutable run receipts, rubric và bảng kết quả được track sau A13.

## B2. Ba-mode redesign specs + develop (Direct / Standard / Critical) — ~1-2 tuần, spec riêng
- Nguyên tắc đã hội tụ 3 nguồn độc lập: "Simple by default · Transparent always · Powerful on demand" (user 20/07) ≡ tiered delegation (fix-map W4) ≡ Direct/Standard/Critical (Codex).
- **Direct** (rõ, reversible, low-risk): inspect → implement → targeted test → self-check diff → evidence. Không spec file, subagent hay registry. Bỏ universal approved-spec hard gate; Direct phải đi qua runtime hooks mà không bị auto-route sang full specs. Luật bắt buộc duy nhất: claim done có proof tương xứng blast radius.
- **Standard** (default): 1 file `spec.md` 60-120 dòng (Goal/Non-goals/Acceptance/Constraints/Surfaces/Verification/Open decisions); main agent implement; 1 combined review tại **feature** ship point, không per-task; một canonical receipt.
- **Critical**: giữ strict invariants + durable state + deterministic evidence gates, **không** giữ nguyên toàn bộ orchestration hiện tại như contract. Research, rollback, threat model và specialist reviewer chỉ bật theo risk; không fixed reviewer count/minimum-finding quota.
- Lane classifier dựa trên reversibility/destructive effect, auth/payment/privacy/data sensitivity, schema/migration, public contract compatibility, cross-service/runtime coupling, ambiguity ảnh hưởng outcome và rollback difficulty. Keywords/task count chỉ là signal; user override được cả hai chiều, nhưng downgrade Critical phải surface trade-off rõ.
- State semantics: tách `generated`, `agent_validated`, `user_approved`; không auto-write approval của user. Một mutable owner cho task status/receipt; Markdown không giữ bản trạng thái thứ hai nếu không có lý do audit rõ.
- Compatibility: thêm `schema_version`; v2 reader riêng, không nới parser v3 để nhận mọi legacy form. `develop`, `test`, `sync`, hooks và reviewer phải hiểu đúng artifact model của từng lane trước rollout.
- Kèm: HTML notes + translation mirror → opt-in; docs checkpoint → feature closeout thay vì per-task; Standard không bắt buộc EARS; archive/maintenance tách khỏi create path.
- Acceptance: Direct không tạo spec/state; Standard tối đa một batched user pause khi còn user-owned decision; Critical reviewer mặc định là 1 combined independent audit, chỉ thêm specialist khi risk lens thực sự khác.

## B3. Validator + grounding hardening — ~4-6 ngày
- `validate-spec-output.cjs`: mention ID ≠ covered; chỉ structured/anchored mapping trong task mới tính. Spec khai subcriterion mà 0 task map phải **FAIL**, không WARN; incidental ID trong prose không được tính.
- Ready gate phải validate lane-appropriate artifacts, blocking questions, status/validation fields và generated/agent-validated/user-approved semantics; research heading rỗng, placeholder hoặc missing required contract không được false-pass.
- Contract check: task reference tới unknown/missing contract phải fail; không copy canonical body vào mọi task — task reference contract ID, validator resolve về một source of truth.
- `spec-ground.cjs`: Related Files rỗng fail; action là enum exact; path phải nằm trong declared work roots; glob phải có match thật; existing Create không chỉ warning khi có overwrite risk.
- Create-before-Modify/Delete/Read phải theo dependency DAG, không chỉ "có task Create ở đâu đó"; missing dependency, cycle và cross-spec mutual block phải fail.
- `codebase-analysis.md`: bỏ 4-docs MANDATORY hard-requirement → "read if present"; không halt khi thiếu.
- Mutation fixtures bắt buộc: missing subcriterion mapping, incidental requirement ID, unknown/missing contract, invalid ready transition, empty Related Files, invalid action, parent-directory root escape, glob zero-match, modify-before-create, DAG cycle và missing runtime reachability.
- V2 compatibility nằm trong migration reader tests; không làm validator v3 fail-open chỉ để giữ legacy.

## B4. Combined-install isolation — ~2-3 ngày, quyết định kiến trúc nhỏ
- Vấn đề (Codex #3): root AGENTS.md chứa cả 3 platform block → runtime đọc chéo instruction.
- Phương án đề xuất: root AGENTS.md = CORE (neutral) duy nhất; platform delta chuyển vào entrypoint riêng từng runtime (CLAUDE.md đã có sẵn cho Claude; Codex/OpenCode cần xác minh cơ chế tương đương — nếu không có, chấp nhận trade-off hiện tại và ghi rõ trong docs). Spike 0.5 ngày trước khi code.

## B5. Parallel-wave review fix + provenance ledger — ~2-4 ngày
- `parallel-waves.md`: lưu và truyền explicit `base_sha` + `head_sha`; reviewer/tester dùng `git diff <base_sha>..<head_sha>` thay working-tree diff. Mỗi fix tạo commit mới, cập nhật `head_sha`, rồi rerun affected gate.
- Trước dispatch: destination tree phải clean/compatible; document rõ `--parallel` có phải consent cho worker commits/cherry-pick hay cần confirmation riêng. Không mutation nếu precondition fail.
- Failure recovery: failed/blocked worktree được giữ để inspect/resume; không `remove --force`/delete branch trước merge thành công hoặc explicit discard. Receipt ghi branch + commit range.
- Conflict graph ngoài exact path phải xét directory overlap, lockfiles, manifests/export barrels, migration registries, generated artifacts và shared state writer.
- Sau mỗi wave chạy affected integration command; sau wave cuối chạy explicit feature/full integration command lấy từ spec/repo contract, không chỉ Final Integration Scout. Phân loại baseline/env/spec/code failure để không blind-retry.
- Provenance ledger cho pattern mượn AgentKit (theo S3): 1 file `docs/provenance.md` liệt kê pattern → nguồn → mức reuse (idea/clean-room).

## Ngoài track (đã có chủ, không lặp ở đây)
- Wave 2 fix-map (rules/ 450 dòng luôn-nạp → path-scoped/lazy): vẫn là việc lớn kế tiếp sau Track A, tính lại sau B1b có số đo.
- Plugin spike (S1): blocker của lộ trình 0.16→0.17, plan tổng §5.3.
- Keep/cut 29 skills + 13 agents (§5.1): sau B1b+B2.

## Unresolved Qs
1. A13: có add luôn `cafekit-2026-remake-tong-hop.md` (chứa business context SDD→TDD→RDD) vào git không, hay chỉ 5 file kỹ thuật? Đây là lựa chọn tracking, không chặn implementation; hỏi user trước bước stage A-III.
