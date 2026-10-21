# Sửa instruction skill và agent (gói 2/5)
Specs-Contract: process-first-ready-v1

Lộ trình chung: `plans/20261021-cfk-ref-borrow-roadmap.md`.

## Scope decision (GATE-SCOPE — 2026-10-21)
- Existing:
  - `develop` bắt lệnh Verification phải fail trước khi sửa, pass trước là blocker (`packages/spec/src/claude/skills/develop/SKILL.md:93-94`); self-test ghim nguyên văn (`packages/spec/scripts/run-skill-self-tests.mjs:2424-2427`, `:2606-2620`, `:5262-5263`) và `replaceDevelopClauseOnce` (`:2575-2580`) ném lỗi khi anchor xuất hiện hai lần. Coverage profile có loại `refactor` (`packages/spec/src/claude/skills/specs/references/templates.md:173`); develop chưa đọc Coverage ở đâu.
  - `specs/SKILL.md:29` "…; the user must invoke Specs or ask for durable planning" lệch với description (`:3`); vế đầu bị ghim ở `run-skill-self-tests.mjs:5440`.
  - `fix/SKILL.md:3` description "Uses cf:debug for evidence-first diagnosis"; thân `:103` "neither is a required call" là quyết định của gói lean fix (commit `5f5d745c`, GATE-DONE 2026-10-05).
  - `debugger.md:91` "Run unit tests, integration tests…"; `debugger.md:123` và `project-manager.md:49` trỏ tới `## Naming` mà không hook nào sinh (`packages/spec/src/claude/hooks/lib/config.cjs:715` chỉ export `resolveNamingPattern`).
  - `docs-keeper.md` thiếu luật WHY/WHERE; `manage-docs.md:22` bắt cập nhật docs khi "development phase transitions". Nguồn mượn: `~/Desktop/cfk-ref/.claude/agents/docs-manager.md`.
  - `spec-maker.md:27-31` đã dặn cite `path:line`; các vai Fact Checker, Flow Tracer, Scope Auditor nằm ở `packages/spec/src/claude/skills/specs/references/review.md`.
- Minimum change: 5 task — (a) task-01, (b) task-02, (d) task-03, (e) task-04, (f) task-05.
- Expansion signals: khoảng 13 file; 5 việc độc lập nhưng cùng loại sửa chữ và cùng đường kiểm → một gói.
- User decision: **KEEP** — 5 task. (b) sửa thân, giữ nguyên description. GATE-REVIEW vòng 1 (2026-10-21): G3 giữ quyết định lean (gọi `cf:debug` là tuỳ chọn); nhận G1, G2, G4–G12.

## Out of scope
- Gom định nghĩa GATE (đợi `specs/claude-plugin`, lõi `packages/spec/src/claude/plugin/core.md`); đổi tên khoá `inspect` (`packages/spec/src/claude/hooks/inspect-block.cjs:63` đã nhận cả `scout`); xoá nguồn `docs-sync.cjs` (obsolete ở `packages/spec/src/claude/migration-manifest.json:138,159`).
- Đổi `description:` của bất kỳ skill nào; đo eval.
- 5 file `packages/spec/src/claude/skills/frontend-design/references/workflow-*.md` cũng trỏ `## Naming` — phần còn sót đã biết.
- Build lại `plugins/cf/` (của `specs/claude-plugin`): sau gói này bản build cũ, `build-claude-plugin.mjs --check` sẽ exit 1 cho tới khi gói kia build lại trước commit/release.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Lối refactor: task tham chiếu **ít nhất một** CP row và mọi row chỉ mang `refactor` → lần chạy trước khi sửa phải pass; fail trước là blocker; trước khi đóng phải chạy Counterexample trên bản sao tạm và ghi nó đỏ ở đó vào Receipt; diff không sửa file test/assertion; characterization test thuộc task làm trước | Cờ mới; bỏ luật đỏ-trước | Dùng trường đã có; bằng chứng âm vẫn chạy thật | Tác giả plan ghi đúng loại; Counterexample chạy được trên bản sao | Counterexample không đỏ trên bản sao → không đóng, coi như task thường |
| D-02 | `fix` giữ quyết định lean: thân nói Fix áp dụng giao thức chẩn đoán kiểu `cf:debug` tại chỗ (`references/diagnosis-protocol.md`), gọi `cf:debug` là tuỳ chọn | Debug mặc định (đảo `5f5d745c`) | Bro chọn ở GATE-REVIEW; description đúng nghĩa, hành vi không đổi | — | — |
| D-03 | Agent trả báo cáo trong câu trả lời; chỉ ghi file khi controller đưa đường dẫn | Thêm hook sinh `## Naming` | Không hook nào sinh `## Naming` | — | — |
| D-04 | Làm (e) task-04 và (f) task-05 theo bằng chứng đọc AgentKit, chưa có lỗi quan sát trong CafeKit (luật C2) | Đo số gốc trước | Bro chọn KEEP | Mục mới được agent dùng, không trùng mục sẵn có | Review/eval sau thấy mục mới không được dùng hoặc trùng `Task Closeout Mode` → gỡ |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Develop cho task refactor chạy xanh-trước-xanh-sau có bằng chứng âm thật; mọi task khác giữ đỏ-trước | modify | AI/model (skill) | none | elevated: luật hoàn thành của develop | source (self-test có mutation) |
| CP-02 | Specs và Fix không còn lệch giữa description và thân | modify | AI/model (skill) | none | elevated: định tuyến và quy trình | source |
| CP-03 | Debugger và project-manager không trỏ `## Naming`; debugger chỉ chạy test để tái hiện lỗi | modify | AI/model (agent) | none | routine | source |
| CP-04 | Docs-keeper và rule docs giữ WHY/WHERE, tách tầng bằng chứng, không đổi docs chỉ vì đổi phase | modify | AI/model (agent, rule) | none | elevated: rule nạp mọi phiên | source |
| CP-05 | Spec-maker tự chạy các vai review trên claim của mình trước khi chốt plan | modify | AI/model (agent) | none | routine | source |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a task references at least one CP row and every referenced row lists only `refactor`, the develop skill shall require the pre-change run to pass, a recorded failing Counterexample on a disposable copy, and no test-file edit; the red-first sentences shall be scoped to exclude only that lane. | task-01 |
| AC-02 | The specs body shall keep its pinned documentation clause and state that a capability request is a request while Step 0 still decides direct work; the fix body shall say Fix applies the debug-style diagnosis inline and calling `cf:debug` is optional; no `description:` line shall change. | task-02 |
| AC-03 | No agent source shall reference a `## Naming` section; `debugger` shall be told to run the failing test or reproduction command and not to run tests as fix verification. | task-03 |
| AC-04 | The docs-keeper source shall state that code owns WHAT/HOW and docs own WHY/WHERE, list the evidence layers, and exempt rule-defined metrics and changelog docs from the no-counts rule; the manage-docs rule shall not require a docs update on a phase transition alone. | task-04 |
| AC-05 | The spec-maker source shall tell it to run the review.md Fact Checker, Flow Tracer and Scope Auditor roles on its own claims before finalizing. | task-05 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Develop: lối refactor xanh-trước-xanh-sau | P1 | AC-01 | `packages/spec/src/claude/skills/develop/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs` | - | done |
| 02 | Gỡ lệch specs và fix | P2 | AC-02 | `packages/spec/src/claude/skills/specs/SKILL.md`, `packages/spec/src/claude/skills/fix/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs` | task-01 | done |
| 03 | Dọn Naming, sửa câu test ở debugger | P2 | AC-03 | `packages/spec/src/claude/agents/debugger.md`, `packages/spec/src/claude/agents/project-manager.md`, `packages/spec/bin/__tests__/agent-instructions.test.js`, `packages/spec/scripts/run-skill-self-tests.mjs` | task-02 | done |
| 04 | Docs-keeper WHY/WHERE + rule docs | P3 | AC-04 | `packages/spec/src/claude/agents/docs-keeper.md`, `packages/spec/src/claude/rules/manage-docs.md`, `packages/spec/bin/__tests__/agent-instructions.test.js` | task-03 | done |
| 05 | Spec-maker tự chạy vai review | P3 | AC-05 | `packages/spec/src/claude/agents/spec-maker.md`, `packages/spec/bin/__tests__/agent-instructions.test.js` | task-04 | done |

Các task chung `run-skill-self-tests.mjs` hoặc `agent-instructions.test.js` chạy tuần tự theo cột Dependencies.

## Review log
- Round 1 (2026-10-21): 3 reviewer context mới (Fact Checker + Contract Verifier; Assumption destroyer + Failure-mode; Scope critic + Proof); 23 finding gộp còn 12 (G1–G12). Bro: G3 giữ quyết định lean (đảo D-02 cũ); nhận G1, G2, G4–G12. sweep: plan + 5 task / 12 delta / tham chiếu cũ đã sửa: D-02 debug mặc định, ghim description, `debugger.md:92/:124`, Reachability `manage-docs` của task-04, ba ý trùng review.md ở task-05, C2 ở Out of scope / còn mâu thuẫn: 0.
- Closure vòng 1 (2026-10-21): 12/12 PASS (reviewer context mới, phép thử `git diff` của task-02 chạy trên repo nháp). Áp thêm lưu ý nhỏ thuộc G3: self-test cấm câu gọi `cf:debug` theo mặc định. Lưu ý chấp nhận: vế `git diff` của task-02 chỉ so với HEAD. Mọi task chuyển `pending`.
