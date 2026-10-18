# omp bắt kịp Claude sau hook-parity
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-18)
- Existing: bridge omp chạy chính các hook Claude theo bảng `DISPATCH` (`packages/spec/src/omp/extensions/cafekit-bridge.mjs:40-48`), installer chép `runtime.files` của Claude rồi đè overlay (`packages/spec/bin/phases/omp-runtime.js:46-50`); `spec-state.cjs` đã chuẩn hoá tên tool omp qua `normalizeHookPayload` (`packages/spec/src/claude/hooks/spec-state.cjs:51-52`); test drift ghim hai lệch có tên `CLAUDE_ONLY`/`OMP_ONLY` (`packages/spec/bin/__tests__/omp-bridge.test.js:54-55`) và overlay privacy (`packages/spec/bin/__tests__/omp-hooks.test.js:129-143`).
- Minimum change: (1) `tool_result` chạy thêm `spec-state.cjs` như PostToolUse của Claude; (2) bỏ `docs-sync.cjs` khỏi `session_start` như Claude đã bỏ ở `dc284c1c`; (3) privacy omp khi stdin rỗng chặn (`deny`), tương đương `ask` của Claude.
- Expansion signals: none — 1 subsystem.
- User decision: KEEP; docs-sync bỏ theo Claude; stdin rỗng đảo D-08 cũ của `specs/archive/hook-parity/plan.md:55` thành deny.
- Bổ sung sau GATE-REVIEW (G1): mục (1) chỉ có tác dụng khi omp có touch state theo phiên như Claude, nên gói bật bộ lọc touch và state theo phiên cho `.omp`, dùng session id thật của omp. Bro đặt mục tiêu phiên "sửa omp tương đương claude codex"; hai việc này là điều kiện để (1) có tác dụng và là hai nhánh "Claude only" còn lại (`spec-state.cjs:94`, `state.cjs:304`).

## Out of scope
- SubagentStart/SubagentStop: omp không có event subagent (`packages/spec/bin/__tests__/omp-bridge.test.js:78-79`).
- `ask` → `deny` trên tool_call: omp không có trạng thái ask.
- `ast_edit` của omp (có trong binary omp 18.11.0) chưa map sang `Edit`: chưa xác minh khoá tham số path; giới hạn đã biết.
- grok, nội dung rules/agents/skills trên omp, matcher theo tên tool ở bridge.
- Commit, push, publish.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Session id bridge: `event.session_id` → `ctx.sessionManager.getSessionId()` → id tự sinh | Chỉ id tự sinh mỗi lần nạp extension | omp 18.11.0 đưa `sessionManager` vào ctx extension và `session_stop` gửi `session_id: this.sessionId` (chuỗi trong binary `/opt/homebrew/Cellar/omp/18.11.0/bin/omp`); một id cho mọi event thì touch/state ghi và đọc cùng chỗ | ctx omp có `sessionManager.getSessionId()` | omp cũ thiếu hàm → rơi về id tự sinh, như hiện nay |
| D-02 | `tool_result` dispatch `['state.cjs', 'spec-state.cjs']`; bỏ `docs-sync.cjs` khỏi `session_start` | Matcher theo tên tool ở bridge; giữ docs-sync | Hook tự lọc tên tool (`spec-state.cjs:122`, `state.cjs:46`); Bro chọn bỏ docs-sync | omp gửi `edit`/`write` với input `path` | — |
| D-03 | `touchFilter` bật cho `.claude` và `.omp` khi có `session_id` | Giữ Claude only | Không bật thì (1) không ghi gì (G1, probe của hai reviewer) | id ổn định theo D-01 | — |
| D-04 | State theo phiên của `state.cjs` bật cho `.omp` | Giữ Claude only | Cùng điều kiện D-01; khớp Claude (`state.cjs:304-306`) | id ổn định theo D-01 | — |
| D-05 | Overlay privacy chỉ còn edit `ask`→`deny`; nhánh stdin rỗng lấy nguyên bản Claude | Giữ D-08 cũ | Quyết định của Bro; bridge luôn ghi payload (`cafekit-bridge.mjs:163`) nên chỉ đóng lỗ fail-open khi ghi lỗi | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Trên cây `.omp` đã ghép, sửa file trong `specs/<packet>/` ghi packet vào touch state của phiên omp và tollgate chỉ nói về packet phiên đó chạm; mở phiên omp không chạy docs-sync | modify, remove | bridge `DISPATCH` + session id, `spec-state.cjs`, test drift, doc installer | settled | elevated — runtime omp đã cài | source: bridge chạy trên cây `.omp` ghép |
| CP-02 | Privacy omp chặn khi stdin rỗng | modify | overlay `privacy-block.cjs` | settled | critical — đường quyết định privacy | source: hook omp với stdin rỗng |
| CP-03 | State omp tách theo phiên như Claude | modify | `state.cjs` | settled | elevated | source: `state.cjs` dưới `.omp` |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When omp phát `tool_result` cho `edit`/`write` thành công vào `specs/<packet>/` rồi `input`, the bridge trên cây `.omp` shall ghi packet vào touch state và tollgate chỉ nhắc packet đó; when `session_start`, it shall không chạy `docs-sync.cjs`. | task-01 Command |
| AC-02 | When `privacy-block.cjs` của omp nhận stdin rỗng, it shall in `permissionDecision: "deny"` với lý do `Sensitive access could not be evaluated safely.` | task-02 Command |
| AC-03 | When `state.cjs` dưới `.omp` nhận payload có `session_id`, it shall đọc/ghi state trong thư mục con của phiên đó như dưới `.claude`. | task-03 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Bridge omp dùng session id thật, chạy spec-state và lọc touch | P1 | AC-01 | `src/omp/extensions/cafekit-bridge.mjs`, `src/claude/hooks/spec-state.cjs`, hai test | - | done |
| 02 | Privacy omp chặn khi stdin rỗng | P1 | AC-02 | `src/omp/hooks/privacy-block.cjs`, `bin/__tests__/omp-hooks.test.js` | task-01-bridge-dispatch.md | done |
| 03 | State omp theo phiên | P2 | AC-03 | `src/claude/hooks/state.cjs`, `src/claude/hooks/__tests__/state.test.js` | task-01-bridge-dispatch.md | done |

Path trong bảng tính từ `packages/spec/`. Command chạy từ gốc repo. Chạy tuần tự vì cùng sửa `docs/installer-architecture.md` và hai changelog mục Unreleased (`packages/spec/CHANGELOG.md`, `docs/project-changelog.md`); câu cũ còn trong Unreleased thì sửa thẳng, không thêm câu mâu thuẫn. Oracle chung: Command exit 0, self-test in `[skill-test] PASS`.

## Review log
- 18/10 vòng giấy 1: hai reviewer ngữ cảnh mới (Fact Checker + Contract Verifier; Security + Failure-mode), cả hai CONCERNS. Gộp:
  - G1 Critical: `spec-state.cjs:94` chỉ ghi touch dưới `.claude`; probe chạy hook Claude source nên xanh giả (cả hai reviewer tái hiện trong mktemp).
  - G2 Medium: doc thật là `docs/installer-architecture.md:82`, không phải `packages/spec/docs/`.
  - G3 Medium: câu "omp retains its deny and empty-input contracts" còn trong Unreleased (`packages/spec/CHANGELOG.md:17`, `docs/project-changelog.md:15`) → sửa thẳng.
  - G4 Medium: ca đối chứng touch dùng chung file theo `SESSION_ID` module → dùng packet/phiên riêng, dọn file.
  - G5 Medium: `ast_edit` không qua bộ lọc Edit → ghi giới hạn.
- GATE-REVIEW 18/10: Bro đặt mục tiêu phiên "sửa omp source tương đương claude codex" và đã dặn gặp lựa chọn có khuyến nghị thì làm luôn + ghi plan; controller chấp nhận G1 theo hướng tương đương (D-01, D-03, D-04, task-03), G2–G5 theo đề xuất reviewer. Bro xem lại ở GATE-DONE.
- Sweep: 4 file đọc lại / 5 delta / path doc, changelog, probe `.omp` đã sửa / 0 mâu thuẫn.
