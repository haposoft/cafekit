# Race privacy Codex và dọn file cũ omp có kiểm hash
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ.

## Scope decision (GATE-SCOPE — 2026-10-21)
- Existing:
  - Codex privacy tạo thư mục trạng thái bằng `if (create && !fs.existsSync(dir)) fs.mkdirSync(dir, { mode: 0o700 })` (`src/codex/hooks/lib/privacy-state.cjs:28`); hai `privacy-block.cjs` song song cùng thấy thư mục chưa có, cái sau ném `EEXIST` và rơi vào deny `Sensitive access could not be evaluated safely`. Ca `parallel Codex privacy blocks…` (`bin/__tests__/codex-hooks.test.js:1041`) fail ~1/3 lượt trên HEAD sạch (reviewer đo 3/10, 5/15; mọi lần fail đều là `EEXIST: mkdir …/.privacy`); bản sao tạm bỏ qua `EEXIST` → 0/30, stress 6 hook × 20 vòng 120/120.
  - omp xoá `obsolete.runtimeFiles` hooks/scripts/skills vô điều kiện (`bin/phases/omp-runtime.js:136-153`, `removeObsoleteOmpHooks`); chỉ `extensions/` đi qua `removeObsoleteRuntimeFiles` có kiểm hash (`bin/phases/claude-runtime.js:169-243`, gói omp-live-fixes). Test ghim hành vi cũ: `codex-native.test.js:3216` ("omp keeps its cleanup policy"), `legacy-hooks-retired.test.js:163`, `usage-hook-retired.test.js:88` (hash giả `'0'*64` vẫn mong xoá).
  - Ownership omp chỉ phủ `.omp` (`bin/lib/context.js:139-142`, `allowedRoots: ['.omp']`), omp không cài skill (`capabilities.skills: false`); skill cũ trong `.agents/skills` do lần cài Codex sở hữu và tự dọn (`claude-runtime.js` nhánh `codex`).
- Minimum change: tạo thư mục privacy chịu được `EEXIST`; omp gỡ hooks/scripts/extensions cũ qua đường kiểm hash, bỏ qua `skills/`; sửa ba test ghim hành vi cũ.
- Expansion signals: none — ~8 file, 2 task độc lập.
- User decision: KEEP (A + B). Bản cài omp cũ không có hash → giữ và cảnh báo, như Claude/Codex (D-09 của `specs/archive/codex-content-parity/plan.md:43`).

## Out of scope
- `src/claude/hooks/state.cjs:136` (mkdir archive không recursive, trạng thái phụ).
- Các `mkdirSync(…, { recursive: true })` khác: không ném `EEXIST`.
- Commit, push, publish.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `secureStateDir` gọi `mkdirSync(dir, { mode: 0o700 })` trong `try`, bỏ qua đúng `EEXIST`; mọi kiểm tra `assertComponentPath`/`lstat` sau đó giữ nguyên | Khoá file; `recursive: true` | Giữ nguyên kiểm tra symlink/thư mục thường đứng sau | Một thư mục do tiến trình khác vừa tạo vẫn qua các kiểm tra sau; threat model: `.privacy` có sẵn mode 0777 vẫn được nhận (có từ trước) — ai ghi được `.codex/hooks/` thì đã thay được mã hook | — |
| D-02 | omp gọi `removeObsoleteRuntimeFiles` cho `hooks/`, `scripts/`, `extensions/`; xoá `removeObsoleteOmpHooks`; mục obsolete đã mất (ENOENT) được prune bản ghi như Codex (`claude-runtime.js:193`) | Giữ xoá vô điều kiện cho hook legacy | Quyết định của Bro: không chứng minh được bản gốc thì giữ và cảnh báo | Tracker omp ghi sha256 file đã cài với khoá `.omp/…` | — |
| D-03 | omp bỏ qua mục `skills/` | Đưa skill qua kiểm hash dưới ownership omp | `.agents/skills` ngoài `allowedRoots` của omp nên luôn bị giữ → cảnh báo sai; Codex/Claude tự dọn phần của chúng | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Hai lần chặn privacy Codex song song đều trả deny có mã yêu cầu riêng | fix | `lib/privacy-state.cjs`; Codex dùng qua `src/codex/hooks/privacy-block.cjs` | settled | critical — privacy | source: ca tất định + ca song song 8 lượt |
| CP-02 | Nâng cấp omp chỉ xoá hook/script/extension cũ khớp hash; file sửa, chưa ghi nhận, symlink được giữ và cảnh báo; skill không bị omp đụng tới | fix | `bin/phases/omp-runtime.js`, `bin/phases/claude-runtime.js`, 3 test installer | settled | critical — xoá file người dùng | source: installer thật trên thư mục tạm |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When thư mục `.codex/hooks/.privacy` được tạo bởi tiến trình khác giữa lúc kiểm và lúc tạo, `createPending` shall vẫn ghi yêu cầu và privacy shall trả deny có mã duyệt. | task-01 Command |
| AC-02 | When nâng cấp omp gặp hook/script/extension cũ, the installer shall xoá file khớp hash ownership, giữ và cảnh báo file khác, và không xoá file trong `.agents/skills`. | task-02 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Tạo thư mục privacy Codex chịu được EEXIST | P1 | AC-01 | `src/codex/hooks/lib/privacy-state.cjs`, `bin/__tests__/codex-hooks.test.js` | - | done |
| 02 | omp dọn file cũ có kiểm hash | P1 | AC-02 | `bin/phases/omp-runtime.js`, `bin/phases/claude-runtime.js`, 3 test installer | task-01-codex-privacy-mkdir-race.md | done |

Command chạy từ gốc repo. Hai task không chung file mã; chung hai changelog (`packages/spec/CHANGELOG.md`, `docs/project-changelog.md`, mục Unreleased) và `docs/installer-architecture.md`, nên chạy tuần tự. Oracle chung: Command exit 0, self-test in `[skill-test] PASS`.

## Review log
- 21/10 vòng giấy 1: hai reviewer ngữ cảnh mới (Fact Checker + Contract Verifier: CONCERNS; Security + Failure-mode: DONE, không Critical/High). Xác minh trên bản sao: EEXIST là race duy nhất; đúng 3 test ghim hành vi omp cũ trên 1151; cảnh báo gộp đúng với `omp`, `codex,omp`, `claude,codex,omp`; D-01 giữ deny với symlink và file thường.
- GATE-REVIEW 21/10 — Bro chấp nhận tất cả; G7 dọn như Codex:
  - G1 Medium: stub `existsSync` so `path.basename === '.privacy'` (root qua `realpathSync`), khôi phục trong `finally`, phải thấy đỏ thật → task-01 Step 1.
  - G2 Low: ca `.privacy` là file thường → deny → task-01.
  - G3 Low: tỉ lệ ~1/3; vòng 8 lượt chỉ bổ trợ → Existing, task-01.
  - G4 Low: dòng 02 phụ thuộc task-01 → bảng Tasks.
  - G5 Low: nhánh omp `codex-native.test.js:3216` ra `Preserved 2`, không chứa `.agents/skills`, đổi tên test → task-02.
  - G6 Low: comment/doc lỗi thời → task-02 Step 3.
  - G7 Low: prune ENOENT cho omp → D-02, task-02.
  - G8 Low: ghi threat model 0777 → D-01.
- Sweep: plan + 2 task / 8 delta / phụ thuộc, Status, D-ID đã đối chiếu / 0 mâu thuẫn.
