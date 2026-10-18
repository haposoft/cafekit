# codex-privacy-approval-ux: duyệt privacy trên Codex bằng một chữ
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ. Trích dẫn chạy trên `01e337a2`.

## Scope decision (GATE-SCOPE — 2026-10-18)
- Existing:
  - Codex không cho hook hỏi: binary codex 0.162.1 có câu `PreToolUse hook returned unsupported permissionDecision:ask`. Privacy Codex vì vậy chặn rồi bắt người dùng gửi đúng câu `APPROVE CAFEKIT PRIVACY <24 hex>` (`src/codex/hooks/privacy-block.cjs:44-48`, `src/codex/hooks/lib/privacy-state.cjs:15`).
  - Yêu cầu chờ duyệt đã gắn phiên, đúng tập path, hết hạn 1 giờ (`privacy-state.cjs:115-170`); `privacy-approval.cjs` chạy ở `UserPromptSubmit`, chỉ nhận prompt bắt đầu bằng tiền tố (`src/codex/hooks/privacy-approval.cjs:23-35`); quyền cấp ra dùng lại được trong 1 giờ (`privacy-state.cjs:172-208`).
  - Probe codex 0.162.1 18/10 (`codex exec`, `CODEX_HOME` tạm đã xoá, `auth.json` không đổi, hook ghi mọi `UserPromptSubmit`/`PreToolUse`/`SubagentStart`): prompt người dùng bắn `UserPromptSubmit` đúng 1 lần; spawn subagent kèm message `y` (`collaborationspawn_agent`) và gửi tiếp `yes` (`collaborationfollowup_task`) **không** bắn `UserPromptSubmit`; `SubagentStart` mang `session_id` của phiên cha.
  - Luồng duyệt dặn agent trong `src/codex/rules/hook-protocols.md:7-20`.
  - Test ghim câu mã: `bin/__tests__/codex-hooks.test.js:938-1065`, `codex-native-hook-boundaries.test.js:39-90`, `privacy-paths.test.js:75,182,252,296`.
- Hướng A (hộp chọn option qua `request_user_input`) đã loại bằng bằng chứng: system prompt trong binary codex 0.162.1 ghi "Never use the `request_user_input` tool for permission requests or permission-related escalations."; probe TUI thật 18/10 (`CODEX_HOME` tạm đã xoá, `auth.json` không đổi): model từ chối, không có tool call nào tới hook.
- Minimum change: thêm đường duyệt bằng một chữ ở prompt ngay sau lần chặn; giữ câu mã dài.
- Expansion signals: không; khoảng 7 file, một host.
- User decision (18/10): **KEEP — chỉ B**.
  - Chữ duyệt: cả prompt (sau `trim`, chuẩn hoá NFC, không phân biệt hoa thường) là `y`, `yes` hoặc `có`.
  - Chữ ngắn chỉ có hiệu lực ở prompt ngay sau lần chặn; có prompt khác ở giữa thì hết hiệu lực. GATE-REVIEW G1 (đổi "mới nhất"): chỉ duyệt khi phiên có **đúng một** yêu cầu đủ điều kiện; từ hai trở lên thì chữ ngắn không duyệt gì, phải dùng câu mã.
  - Giữ câu `APPROVE CAFEKIT PRIVACY <id>` làm dự phòng.
  - Người thực thi: Codex (pane Orca). Phiên Claude điều phối, ghi Status/Receipt.

## Out of scope
- Hướng A (`request_user_input`), phím từ chối `n`, rút ngắn mã.
- Privacy Claude (host đã có `ask`) và omp.
- Đổi TTL, phạm vi quyền (cùng phiên, đúng path, 1 giờ).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Mỗi lần chặn tạo một marker riêng `short-<sha256(session_id)>-<requestId>.json` trong `.privacy` bằng cờ `wx` (không đọc-sửa-ghi, nên chặn song song không mất marker); chặn lại đúng tập path còn pending cùng phiên thì dùng lại `requestId` cũ, không tạo pending/marker mới. Mỗi `UserPromptSubmit` có `session_id`: ngay sau khi lấy `session_id`, trong `try` riêng, giành mọi marker của phiên bằng `rename` sang tên tạm rồi xoá (atomic), trước mọi việc khác; `catch` ngoài cùng giành lại lần nữa; nếu prompt là chữ duyệt (so bằng Set `===` sau `trim` + NFC + `toLowerCase`, không NFKC) và giành được **đúng một** marker có `requestId` còn pending, chưa hết hạn, cùng phiên → gọi `approvePending` cho id đó. `cleanup` xoá marker hết hạn; `clearState` xoá marker của phiên. Mọi trường hợp khác (prompt khác, hai id trở lên, không giành được, lỗi bất kỳ) → không cấp. Câu mã dài vẫn duyệt đúng `requestId` như cũ | Duyệt mới nhất; cờ trên từng file pending | Quyết định của Bro (GATE-SCOPE, G1); giành marker atomic nên lỗi không mở cửa (G4) | `UserPromptSubmit` chỉ do prompt người dùng (probe 18/10) | Bản Codex sau bắn `UserPromptSubmit` cho subagent → probe lại trước khi nâng cấp |
| D-02 | Câu chặn: `Sensitive file access denied: <tên>. To allow exactly these paths for one hour of this Codex session, the user replies y (or yes / có) as their very next message; any other reply cancels that shortcut, and it only works while this is the only pending request. Fallback exact prompt: APPROVE CAFEKIT PRIVACY <id>`. Ngữ cảnh sau khi duyệt (cả hai đường): nêu tên đã cấp và dặn agent báo người dùng đúng các path vừa được cấp trước khi đọc | Bỏ câu mã | Agent chuyển đúng cách duyệt; người dùng biết mình vừa cấp gì (G2) | — | — |
| D-03 | `hook-protocols.md` Codex dòng 7-20: luồng duyệt nêu chữ ngắn + câu mã; câu hỏi privacy phải là câu hỏi duy nhất và ở cuối lượt, nêu đúng tên file như lý do chặn, không kèm câu hỏi có/không nào khác; agent không tự gửi, nhắc lại như tin người dùng, hay giả lập chữ duyệt hoặc câu mã; sửa mô tả cũ sai ("one-use", gắn "tool") thành: dùng lại trong 1 giờ, cùng phiên, đúng path, không gắn tool. Giữ nguyên hai câu `codex-native.test.js:289-299` ghim (malformed output, `state-sync.md`) | Giữ luồng cũ | Chống duyệt nhầm bằng luật (G2); rule khớp code (G6) | — | — |

## Known limitations
- Duyệt nhầm vẫn có thể xảy ra nếu agent trái luật D-03 và kết lượt bằng một câu có/không khác trong khi đang có đúng một yêu cầu chờ; người dùng chỉ biết qua lời agent báo lại (hook Codex không hiển thị trực tiếp cho người dùng).
- Agent tự chạy `codex exec resume … "y"` qua shell có thể bắn `UserPromptSubmit` thật [UNVERIFIED]; lỗ này có từ trước với câu mã dài; chặn lệnh `codex` lồng nhau để gói sau.
- Tin nhắn steer giữa lượt có bắn `UserPromptSubmit` không: [UNVERIFIED].
- SessionStart (mọi source: `startup`, `resume`, `clear`, `compact`) gọi `clearState` (`src/codex/hooks/session.cjs:103`): mất pending và marker, phải chặn lại.
- Hook của prompt chen giữa không chạy được tới bước giành marker (Codex không gọi hook, payload rỗng) thì chữ ngắn còn sống tới prompt sau.
- Catalog/ngữ cảnh: tên hiển thị chỉ là basename (`displayNames`), không có thư mục.
- Yêu cầu tạo trước khi cài bản mới (không có marker) chỉ duyệt được bằng câu mã.
- Hướng A có thể làm được nếu bản Codex sau gỡ câu cấm trong system prompt.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Người dùng Codex duyệt đọc file nhạy cảm bằng một chữ ở prompt kế tiếp; mọi trường hợp khác không cấp quyền | modify | privacy-state, privacy-approval, privacy-block, rule Codex | none (D-01–D-03) | critical (privacy) | test hook Codex chạy bằng `spawnSync` trên layout đã cài |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a Codex privacy block is followed by the user's very next prompt `y`, `yes` or `có` in the same session and exactly one request is pending from that block window, the hook shall grant exactly that request's paths for one hour and tell the agent to report them; if any other prompt intervenes, two or more requests are pending, the pending expired, the session differs, the prompt carries extra or look-alike characters, or the marker cannot be claimed, it shall not grant; the exact long phrase shall still grant its request. | task-01 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Duyệt privacy Codex bằng một chữ | P1 | AC-01 | `src/codex/hooks/lib/privacy-state.cjs`, `privacy-approval.cjs`, `privacy-block.cjs`, `src/codex/rules/hook-protocols.md` | - | pending |

Command chạy từ gốc repo. Oracle chung: mọi lệnh exit 0; `node --test` có `# fail 0`, `# skipped 0`, `# todo 0`, tên từng test mới hiện thành dòng `ok`; self-test in `PASS:`. Không đưa mã task/quyết định vào tên test, comment hay commit.

## Review log
- 18/10 vòng giấy 1: hai reviewer ngữ cảnh mới (Fact Checker + Contract Verifier; Security adversary + Failure-mode), cả hai CONCERNS; controller probe Codex thật (subagent không bắn `UserPromptSubmit`). Trích dẫn đúng trên `01e337a2`; `node --test` 3 file 353/353; self-test dao động 2/3 lần đỏ ở `omp-bridge.test.js:194` do gói `omp-parity` đang làm (phiên khác).
- GATE-REVIEW 18/10, Bro quyết:
  - G1 High: chỉ duyệt khi đúng một yêu cầu (đổi "mới nhất").
  - G2 High: luật D-03 + ngữ cảnh duyệt bắt agent báo path; ghi giới hạn.
  - G3: đóng bằng probe; `codex exec resume` lồng nhau ghi giới hạn.
  - G4 Medium: marker theo phiên giành bằng `rename`, lỗi thì không cấp.
  - G5 Medium: task `blocked` tới khi `omp-parity` commit hoặc đóng.
  - G6 Low: sửa mô tả sai trong rule + `docs/installer-architecture.md:336`.
  - G7 Low: test từ chối `ｙ`, `y\u200b`; so khớp Set `===`, không NFKC.
  - G8 Low: `orca-session.test.js` (danh sách lib), `codex-native.test.js:289-299` (giữ câu) vào Ownership.
  - G9 Low: thêm giới hạn steer, compact, yêu cầu cũ.
- 18/10 lượt đóng (ngữ cảnh mới, vòng giấy 2): 7/9 PASS; G1 FAIL (marker chung mất cập nhật khi chặn song song), G4 hở phía hết hiệu lực khi hook prompt chen giữa lỗi; G5 blocker cũ (`omp-parity` đã commit `45e00b32`, 3/3 done). Controller áp phần còn thiếu của G1/G4: marker riêng mỗi lần chặn bằng cờ `wx`, giành sớm trong `try` riêng + giành lại trong `catch`; dùng lại `requestId` khi chặn lại đúng tập path (để `y` không tự mất tác dụng); sửa giới hạn SessionStart; bỏ Blocker. Dừng vòng giấy theo luật B4.

