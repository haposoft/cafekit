# state/session: không rò context giữa các phiên Claude, Codex theo dõi subagent
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ.

## Scope decision (GATE-SCOPE — 2026-10-15)
- Existing:
  - Claude `state.cjs` lưu `latest.md` theo project, không theo phiên (`src/claude/hooks/state.cjs:34-49`). SessionStart in `latest.md` của phiên nào ghi gần nhất (`:250-260`); Stop/PostToolUse/SubagentStop ghi đè cùng file (`:264-291`). Nhiều pane Claude cùng project nhận "Prior Execution Context" của nhau (quan sát 14/10: cafekit mở 3 pane Claude).
  - Codex đã lưu theo phiên: `session-state/<sha256(session_id)>/` (`src/codex/hooks/lib/state-store.cjs:14-24`), SessionStart chỉ đọc state của chính phiên (`src/codex/hooks/state.cjs:117-124`).
  - Claude precompact ghi một file `compact-recovery.json` chung project, có `session_id` (`src/claude/hooks/precompact.cjs:78-90`); session.cjs khi compact in record đó mà không so phiên (`src/claude/hooks/session.cjs:270-293`).
  - Codex matcher PostToolUse đã có `collaborationspawn_agent` (`src/codex/hooks.json`), nhưng `isTrackedTool` chỉ nhận `spawn_agent` (`src/codex/hooks/state.cjs:73-80`), nên hook chạy mà không ghi gì. Tên tool đo trên Codex 0.162.1 ngày 12/10 (gói 1). `updateTaskState`/`summary` đọc payload tổng quát (`:46-58`, `:131-137`), không phụ thuộc hình dạng input riêng của spawn.
- Minimum change: Claude state và anchor compact theo phiên; Codex nhận `collaborationspawn_agent`.
- Expansion signals: khoảng 8 file → 3 task, hai host.
- User decision (15/10): **KEEP** (M1 + M2). Phiên Claude mới (startup) không thấy context phiên khác; chỉ resume/compact thấy state của chính phiên, giống Codex.
  - Người thực thi: Codex (pane Orca). Phiên Claude điều phối và ghi Status/Receipt.

## Out of scope
- M3: `hooks.json` Codex ghép thư mục node có số phiên bản vào fallback PATH (`bin/phases/codex-hooks.js:130-143`); cài lại bằng node khác đổi chuỗi lệnh, Codex đòi trust lại.
- M4: Codex compact không có precompact / cảnh báo xác nhận (đã có cảnh báo privacy ở `src/codex/hooks/session.cjs:114-118`; `PreCompact` chưa thử trên binary).
- Các mục L: cảnh báo matcher tự đặt, `rules` không tiêm lại sau compact, precompact gọi git không timeout, session crash không ghi log, thông báo cập nhật chỉ ở Claude, ask-guard chỉ chặn `apply_patch`.
- omp, grok và payload không có `session_id`: giữ lưu theo project như cũ.
- `collaborationwait_agent` và tên `update_plan` trên binary mới (chưa quan sát).
- Dọn thư mục state phiên cũ (GATE-REVIEW G2).
- Dọn `latest.md` cấp project cũ đã có trên đĩa (phiên Claude bỏ qua nó).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Claude `state.cjs`: khi runtime là `.claude` và payload thô có `session_id` chuỗi khác rỗng, thư mục state là `<stateDir cũ>/<sha256(session_id) cắt 16 ký tự>/`; mọi sự kiện (SessionStart, PostToolUse, SubagentStop, Stop) dùng thư mục đó. SessionStart chỉ đọc, không tạo thư mục. Không dọn thư mục phiên cũ (Codex cũng không). Không có `session_id` hoặc runtime khác `.claude` → thư mục cũ | Giữ theo project, chỉ lọc khi đọc; lưu theo pane Orca; dọn thư mục phiên cũ hơn 7 ngày (GATE-REVIEW: bỏ, YAGNI) | Phiên mới sạch theo quyết định của Bro; layout giống Codex | Claude gửi cùng `session_id` khi resume và compact của một phiên (reviewer đo payload hook thật trên Claude Code 2.1.300 ngày 15/10: `--resume`, `--continue`, `/compact` giữ id) | Resume/compact không còn thấy context của chính phiên → kiểm lại `session_id` của payload thật |
| D-02 | Claude `session.cjs` khi compact chỉ in "State before compaction" nếu `record.session_id` bằng `session_id` của payload; không khớp hoặc thiếu → không in anchor, cảnh báo xác nhận vẫn in | Lưu `compact-recovery.json` theo phiên | Thay đổi một điểm đọc; precompact đã ghi `session_id` | Payload SessionStart compact có `session_id` (Claude) | Anchor không bao giờ in ở compact thật → so payload thật |
| D-03 | Codex `isTrackedTool` nhận thêm `collaborationspawn_agent`; với tool tạo subagent (`spawn_agent`, `collaborationspawn_agent`) chỉ ghi `lastToolEvent`, không gọi `updateTaskState` | Đổi matcher; bắt payload thật trước | Matcher đã gửi tool này tới hook; input spawn có thể mang `id`/`title` thành todo ma (`src/codex/hooks/state.cjs:54-69`) | Tên tool trên 0.162.1 là `collaborationspawn_agent` (đo 12/10) | Binary mới đổi tên → cập nhật cả matcher lẫn hàm |

## Known limitations
- `/clear` và `--fork-session` tạo `session_id` mới (đo 15/10), nên không còn thấy context phiên trước; đây là hệ quả của "phiên mới sạch".
- Không dọn thư mục state của phiên cũ: mỗi phiên khoảng 24K (`latest.md` + tối đa 5 archive), giống Codex.
- D-02: host không gửi `session_id` nào (cả thô lẫn `sessionId`) sẽ không thấy anchor compact; omp và grok có gửi.
- Chưa quan sát payload `collaborationspawn_agent` thật; test dùng payload dựng tay với tên tool đã đo.
- `compact-recovery.json` vẫn là một file chung: phiên khác compact sau sẽ ghi đè, phiên trước khi compact sẽ không có anchor (không in sai, chỉ thiếu).
- `latest.md` cấp project cũ của Claude ở lại trên đĩa, không ai đọc với phiên Claude có `session_id`.
- Bản copy ở `.claude/` gốc repo bị gitignore, không vào commit.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Phiên Claude chỉ thấy "Prior Execution Context" của chính nó; phiên mới không thấy của phiên khác | fix | hook state Claude | none (D-01) | elevated; đọc code + quan sát nhiều pane | test hook hai phiên trên layout `.claude` |
| CP-02 | Anchor "State before compaction" chỉ in cho đúng phiên đã compact | fix | hook session Claude | none (D-02) | elevated | test precompact + session hai phiên |
| CP-03 | Codex ghi state khi gọi `collaborationspawn_agent` | fix | hook state Codex | none (D-03) | routine; đo tên tool 12/10 | test hook Codex trên layout `.codex` |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a Claude session starts, resumes or compacts, the state hook shall print only the prior context written by the same `session_id`; a payload without `session_id` or a non-Claude runtime shall keep the project-level behaviour. | task-01 Command |
| AC-02 | When a Claude session restarts after compaction, the session hook shall print the pre-compaction anchors only when the captured `session_id` matches, and shall always print the authorization warning. | task-02 Command |
| AC-03 | When Codex reports a PostToolUse for `collaborationspawn_agent`, the state hook shall record it as the latest tracked tool for that session. | task-03 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Claude state lưu theo phiên | P1 | AC-01 | Claude `state.cjs`, `state.test.js` | - | done |
| 02 | Anchor compact đúng phiên | P2 | AC-02 | Claude `session.cjs`, `precompact.test.js` | task-01-claude-state-per-session.md | done |
| 03 | Codex theo dõi `collaborationspawn_agent` | P2 | AC-03 | Codex `state.cjs`, `codex-hooks.test.js` | task-02-compact-anchor-session.md | in_progress |

Command của mỗi task chạy từ gốc repo; self-test chạy trong `packages/spec`. Chạy tuần tự: các task dùng chung hai changelog (`CHANGELOG.md`, `../../docs/project-changelog.md`, mục Unreleased).

## Review log
- 15/10 vòng giấy 1: hai reviewer ngữ cảnh mới (Fact+Contracts, Failure-mode), cả hai CONCERNS; gộp 5 nhóm. Xác nhận: trích dẫn khớp; `--resume`/`--continue`/`/compact` giữ `session_id` (đo payload thật, Claude Code 2.1.300); grok/omp bị loại đúng; task-03 đỏ trước chắc chắn.
- GATE-REVIEW 15/10, Bro chấp nhận:
  - G1 High: `src/claude/hooks/__tests__/state.test.js:347-382` (`sessionStartWith` ghi `latest.md` cấp project nhưng gửi `session_id`) → task-01 được chuyển fixture vào thư mục phiên, giữ assertion, thêm ca không có `session_id`.
  - G2 Medium: bỏ dọn thư mục phiên cũ; SessionStart không tạo thư mục.
  - G3 Medium: ghi giới hạn `/clear`, fork.
  - G4 Low: Ownership thêm bản copy `.claude`; ghi cwd của Command; lưu ý fixture test; giới hạn D-02 khi thiếu `session_id`.
  - G5 Low: tool spawn chỉ ghi `lastToolEvent`.
- 15/10 vòng giấy 2 (lượt đóng, ngữ cảnh mới): DONE — G1–G5 đóng, chạy lại phản ví dụ trên code hiện tại; đỏ-trước của task-03 hai ca đã chạy thử. Ba ghi chú Low đã sửa chữ: fixture chỉ đổi cho `.claude`, assertion todo giới hạn trong "What's Left", parser nhận cả `TaskCreate`/`TaskUpdate`.
