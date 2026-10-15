# hook-parity: Claude và Codex hành xử giống nhau ở chỗ đáng lẽ phải giống
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ.

## Scope decision (GATE-SCOPE — 2026-10-15)
- Existing (hai reviewer parity 15/10, trích dẫn đã chạy lại trên `15130ba9`):
  - Logic quyết định đã dùng chung: phân loại path privacy/inspect, từ khoá secret, resolver, Receipt, Base/Head. Các lib `src/codex/hooks/lib/{inspect-paths,privacy-paths,privacy-command-analysis,runtime-path-safety}.cjs` là shim `require('../../../claude/hooks/lib/…')`; installer chép bản Claude đè lên khi cài (`bin/phases/codex-runtime.js:100-139`).
  - Claude đọc `runtime.json` theo `payload.cwd`, không theo root đã cài: `src/claude/hooks/rules.cjs:52-61` (giữ chỗ tiêm ở `:59` trước khi đọc runtime ở `:61`), `src/claude/hooks/inspect-block.cjs:55-58`, `src/claude/hooks/agent.cjs:47-51`, `src/claude/hooks/spec-state.cjs:90,110`, `src/claude/hooks/state.cjs:246`. Luật root hiện lệch nhau: thư mục chấm trước (`src/claude/hooks/privacy-block.cjs:51-53`, `src/claude/hooks/spec-state.cjs:119-120` rồi `PROJECT_ROOT`); `CLAUDE_PROJECT_DIR` trước (`src/claude/hooks/session.cjs:44-56`, `src/claude/hooks/spec-gate.cjs:20-28`); `CLAUDE_PROJECT_DIR` rồi `payload.cwd` (`src/claude/hooks/precompact.cjs:37-45`). Codex dùng `PROJECT_ROOT` của hook (`src/codex/hooks/lib/hook-context.cjs:12-18`).
  - Claude spec-state: cache tollgate một file chung (`src/claude/hooks/spec-state.cjs:318`); regex tên packet cứng `specs/` và chỉ `/cf:` (`:71-79`); chạm chỉ ghi qua PostToolUse Edit/Write (`:157-168`). Codex có `successfulMutation`/`namedPackets` (`src/codex/hooks/lib/spec-session-touch.cjs:74-126`).
  - Claude state: `TRACKED_POST_TOOL_EVENTS` thiếu `Agent` (`src/claude/hooks/state.cjs:32`) dù matcher có `Agent`; parser chỉ nhận `Task` (`src/claude/hooks/lib/parser.cjs:83`); `main().catch` thoát không ghi log (`state.cjs:296-298`); không khoá ghi (Codex: `src/codex/hooks/lib/state-store.cjs:26-64`); Stop/SubagentStop không giữ `last_assistant_message` (Codex: `src/codex/hooks/state.cjs:153,165`).
  - Claude session: async IIFE không có `.catch` (`src/claude/hooks/session.cjs:197-299`); không in dòng "project root (session cwd)" như Codex (`src/codex/hooks/session.cjs:109-113`). `precompact.cjs` gọi git không timeout (`src/claude/hooks/precompact.cjs:30-31`).
  - Rules tiêm một lần mỗi phiên, không tiêm lại sau compact ở cả hai host (`src/claude/hooks/rules.cjs:28-44`, `src/codex/hooks/rules.cjs:15-37`); chỗ giữ của Claude ở `os.tmpdir()`, Codex ở `hookStateDir`.
  - Codex `inspect-block` gọi `getHookContext`, hàm này throw khi `paths.specs` sai nên inspect cho qua âm thầm (`src/codex/hooks/inspect-block.cjs:23,39`); privacy đã sửa bằng `readRuntime` + `resolveSessionCwd` (`src/codex/hooks/privacy-block.cjs:15-22`). `src/codex/hooks/lib/` thiếu shim `secret-keywords.cjs`, require nằm ngoài `try` (`src/codex/hooks/secret-output-guardrail.cjs:18`).
  - Codex compact chỉ in cảnh báo privacy (`src/codex/hooks/session.cjs:114-118`); không đăng ký PreCompact (`src/codex/hooks.json`). Binary codex 0.162.1 có chuỗi `PreCompact`/`PostCompact` (đo 15/10), host có gọi hay không chưa thử.
  - Thông báo cập nhật npm chỉ ở Claude (`src/claude/hooks/session.cjs:113-193`); Codex cũng có `cafekit.json` trong thư mục runtime (`bin/phases/write-metadata.js:15`).
  - Hiển thị: Claude privacy chỉ nêu `paths[0]` và stdin rỗng thì cho qua (`src/claude/hooks/privacy-block.cjs:43-44,59`); Codex nêu đủ và stdin rỗng thì deny (`src/codex/hooks/lib/hook-context.cjs:22-24`). `paths.specs` thoát root: Claude "invalid workflow packet", Codex "controlled failure". Chữ spec-state lệch (`src/claude/hooks/spec-state.cjs:340-345` so với `src/codex/hooks/spec-state.cjs:175-185`). Agent context Codex có thêm hai dòng `YAGNI · KISS · DRY` và `Be concise…` (`src/codex/hooks/agent.cjs:46-51`); Claude đã có `## Rules` (`src/claude/hooks/agent.cjs:79-80`). Codex nêu tối đa 3 tên khử trùng + `(+N more)` (`src/codex/hooks/lib/privacy-state.cjs:64-69`). Bản fork omp `src/omp/hooks/privacy-block.cjs` bị `bin/__tests__/omp-hooks.test.js:128-157` ghim theo bản Claude.
  - Installer Claude và omp chỉ chép `runtime.files` của `src/claude/migration-manifest.json:150-180` (`bin/phases/claude-runtime.js:139-164`, `bin/phases/omp-runtime.js:46-50`). Shim Codex chỉ chạy trong source tree; fixture `bin/__tests__/codex-hooks.test.js:143-162`, `codex-quiet-hooks.test.js:15-16`, `orca-session.test.js:147-153` chép `src/codex/hooks` và chỉ thay vài lib cố định.
  - `getHookContext` throw khi `paths.specs` sai; 9 hook Codex dùng nó, gồm session (`src/codex/hooks/session.cjs:75`) và rules (`src/codex/hooks/rules.cjs:73-76`, cũng giữ chỗ trước khi đọc runtime).
  - `last_assistant_message` Codex lưu nguyên văn (cắt ngắn) rồi in lại khi resume (`src/codex/hooks/state.cjs:22-34,165`).
- Minimum change: sửa mọi lệch (D) hai reviewer đã nêu, cộng hai tính năng Bro chọn.
- Expansion signals: khoảng 30 file, hai host → 9 task tuần tự.
- User decision (15/10): **KEEP 6 nhóm + thêm**:
  - `agent.cjs` Claude đổi sang root đã cài (bỏ hành vi `payload.cwd` "monorepo").
  - Thêm: rules tiêm lại sau compact (cả hai host); thông báo cập nhật npm cho Codex; "còn gì thì cho vào" → khoá ghi state Claude và giữ `last_assistant_message`.
  - Codex PreCompact: nếu host 0.162.1 không gọi hook thì vẫn nhắc xác nhận đang chờ ở SessionStart compact, bỏ anchor, không đăng ký hook host không gọi.
  - GATE-REVIEW (15/10) tách privacy khỏi task hiển thị và gom mọi hook Claude về một luật root.
  - Người thực thi: Codex (pane Orca). Phiên Claude điều phối và ghi Status/Receipt.

## Out of scope
- `hooks.json` Codex ghi thư mục node có số phiên bản (`bin/phases/codex-hooks.js:130-143`): cố ý, đã có ghi chú.
- Khác biệt cố ý (I): `ask` của Claude và `deny` + token của Codex; matcher theo tên tool; `ask-guard`, `privacy-approval` chỉ ở Codex; chuẩn hoá payload grok chỉ ở Claude; nguồn todo (transcript và `tool_input`); `CLAUDE_ENV_FILE`; tiền tố `$cf-`, `apply_patch`.
- Khoá cache spec-gate khác nhau (cache không phải bằng chứng).
- Codex-only, không phải parity: cảnh báo matcher người dùng tự đặt, `ask-guard` chỉ chặn `apply_patch`.
- omp, grok: giữ hành vi hiện có, trừ chỗ dùng chung lib.
- Sửa task qua shell không ghi chạm (giới hạn chung hai host).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `src/claude/hooks/lib/project-root.cjs` là luật root duy nhất của mọi hook Claude: thư mục runtime đã cài (tên bắt đầu bằng `.`) → cha của nó; không thì `CLAUDE_PROJECT_DIR`; không thì `payload.cwd`; không thì `process.cwd()`; kết quả qua `realpathSync` khi được. Dùng cho rules, inspect-block, agent, spec-gate (task-01), spec-state (task-02), state (task-03), session, precompact (task-04), privacy-block (task-08). `runtime.json` đọc từ root; path trong tool input vẫn tính theo `payload.cwd` | Giữ từng hook một luật; chỉ sửa ba hook | Một luật, khớp Codex `PROJECT_ROOT` | Hook Claude, grok (`$CLAUDE_PROJECT_DIR/.claude/hooks`) và omp (`.omp/hooks`) đều chạy từ thư mục chấm | Worktree dưới `.claude/worktrees/*` nay nhận context trỏ về checkout chính (quyết định của Bro); hook nào đọc sai runtime → kiểm luật |
| D-02 | Chuyển các hàm thuần `canonicalTarget`, `packetAt`, `namedPackets` (`src/codex/hooks/lib/spec-session-touch.cjs:15-38,104-126`) vào `src/claude/hooks/lib/spec-touch.cjs`, cùng `explicitFailure(payload)` chỉ xét cờ (`success:false`, `is_error`, `isError`, `ok:false`, `error`, status lỗi, exit code ≠ 0). Codex giữ `successfulMutation` = `!explicitFailure` + phần cũ. Claude bỏ ghi chạm chỉ khi `explicitFailure`, không xét chữ trong `tool_response` | Chuyển cả `successfulMutation`; chép logic | Một nguồn; nội dung file Write chứa dòng "Failed…" không được làm mất chạm | Claude gửi lỗi tool qua PostToolUseFailure, PostToolUse chỉ chạy khi thành công (đã kiểm chuỗi binary `claude` 2.1.300 ngày 15/10) | Bản Claude mới đổi → kiểm lại chuỗi binary |
| D-03 | Cache tollgate Claude theo phiên: `tollgate-last-<sha256(session_id) 16>.txt` khi có `session_id` thô trên `.claude`; không thì file cũ | Giữ file chung | Khớp Codex (`src/codex/hooks/spec-state.cjs:20-26`) | — | — |
| D-04 | Rules tiêm lại sau compact: mỗi host có `lib/rules-reservation.cjs` dưới `hookStateDir`, khoá file là sha256 của `session_id` đã chuẩn hoá; SessionStart `source=compact` xoá chỗ giữ của chính phiên trước mọi nhánh thoát sớm, prompt kế tiếp tiêm lại | Tiêm thẳng trong SessionStart; đếm epoch | Một điểm xoá, không đổi sự kiện đăng ký | Phiên compact giữ `session_id` (Claude đo 15/10; Codex đo ở probe task-06) | Không tiêm lại → kiểm `session_id` payload compact |
| D-05 | Logic cập nhật npm chuyển vào `src/claude/hooks/lib/update-check.cjs`; Claude và Codex session dùng chung (Codex qua shim + installer chép). Cache chỉ lưu `latest` khớp `^\d+\.\d+\.\d+$`; bỏ cache có `ts` ở tương lai; câu thông báo dựng lúc đọc. Codex gọi lib sau `clearState`, trong `try` riêng | Chép riêng; cache lưu nguyên câu | Một nguồn; repo độc không chèn được câu qua cache; không làm mất bước huỷ quyền privacy | Codex có `cafekit.json` trong `.codex/` | Không có version → không in, fail-open |
| D-06 | Codex PreCompact: task-06 probe host với đối chứng dương trong `CODEX_HOME` tạm (Bro cho phép chép `auth.json`, không in nội dung, xoá sau probe). Không có dấu SessionStart `startup` → task `blocked`. Host gọi → `src/codex/hooks/precompact.cjs` ghi anchor tên theo sha256 phiên dưới `hookStateDir`, đăng ký trong `hooks.json`, SessionStart compact in anchor khớp phiên. Host không gọi → không đăng ký; SessionStart compact vẫn nhắc xác nhận đang chờ | Đăng ký mù; kết luận "không gọi" khi probe hỏng | Quyết định của Bro; probe hỏng khác host không gọi | — | — |
| D-07 | `last_assistant_message` (Claude mới thêm, Codex đang có) lưu dạng tóm tắt; chuỗi khớp `containsSecretKeyword` (`src/claude/hooks/lib/secret-keywords.cjs:42`) thì lưu `[omitted: possible secret]` | Lưu nguyên văn; bỏ tính năng | Bí mật in ra sau một lần duyệt không được sống qua resume | — | — |
| D-08 | Chữ đích: `paths.specs` thoát root → cả hai host block bằng câu `Completion gate: invalid workflow packet detected (…)` của Claude (`src/claude/hooks/spec-gate.cjs:169`). spec-state hai host in: dòng tiêu đề, dòng Phase kèm số đếm chi tiết của Claude, `Next unblocked`, dòng Migration, dòng Sync, dòng Workflow source, dòng `Hooks revalidate receipt bytes but never grant approval.` Privacy hai host nêu tên bằng `displayNames` của Codex (tối đa 3, khử trùng, `(+N more)`) | Người thực thi tự chọn chữ | Chữ đích kiểm được | — | — |

## Known limitations
- Auto-compact giữa một lượt: rules chỉ quay lại ở prompt người dùng kế tiếp.
- File `rules-*.json` và `tollgate-last-*.txt` theo phiên tích tụ, không dọn (như state phiên).
- Worktree dưới `.claude/worktrees/*` nhận context Specs/Plans/Docs của checkout chính (D-01).
- Hook Codex gọi npm có bị sandbox chặn mạng hay đi qua `HTTPS_PROXY` không: chưa kiểm; lỗi mạng chỉ làm thiếu thông báo.
- omp giữ hành vi riêng ở stdin rỗng của privacy (`src/omp/hooks/privacy-block.cjs:44-45`): cho qua, khác Claude (task-08).
- Bản copy ở `.claude/` gốc repo bị gitignore, không vào commit; sau GATE-DONE nên cài lại bằng installer.
- Probe Codex host (task-06, 15/10, codex-cli 0.162.1, `codex exec` với `model_auto_compact_token_limit=20000`, `CODEX_HOME` tạm đã xoá): đối chứng dương có SessionStart `startup`; host gọi PreCompact (`trigger: auto`), rồi PostCompact và SessionStart `compact` ở mỗi lần compact; `session_id` của UserPromptSubmit và SessionStart `compact` trùng nhau. → Nhánh "host gọi PreCompact" của D-06 áp dụng.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Hook Claude ở thư mục con vẫn đọc đúng `runtime.json`; bản cài theo manifest chạy được | fix | lib root, rules, inspect-block, agent, spec-gate, manifest | none (D-01) | elevated; reviewer tái hiện | test layout dựng theo manifest, cwd thư mục con |
| CP-02 | spec-state Claude khớp Codex về runtime, chạm, cache, tên packet | fix | spec-state Claude, lib chung, Codex touch | none (D-02, D-03) | elevated | test spec-state + state + fixture Codex xanh |
| CP-03 | state hai host: `Agent` làm mới state, khoá ghi, log crash, tin nhắn cuối đã lọc | fix + feature | state, parser Claude; state Codex | none (D-07) | elevated (secret) | test state Claude + Codex |
| CP-04 | session/precompact Claude bền, rules tiêm lại sau compact | fix + feature | session, precompact, rules Claude | none (D-04) | elevated | test precompact + orca-session |
| CP-05 | Codex inspect và rules không cho qua âm thầm khi `paths.specs` sai; guardrail chạy từ source | fix | inspect-block, rules, guardrail Codex | none | elevated (gate) | test hook Codex |
| CP-06 | Codex compact nhắc xác nhận đang chờ, rules tiêm lại, anchor nếu host gọi PreCompact | fix + feature | session, precompact, hooks.json Codex | probe host (D-06) | elevated; host chưa thử | probe có đối chứng + test hook Codex |
| CP-07 | Codex có thông báo cập nhật npm an toàn | feature | lib chung, session hai host | none (D-05) | elevated (cache không tin cậy) | test hai host + unit lib |
| CP-08 | Privacy hai host nêu cùng danh sách tên; Claude `ask` khi stdin rỗng | fix | privacy-block Claude + omp, lib chung | none (D-08) | critical (privacy decision path) | test privacy + omp-hooks |
| CP-09 | Thông điệp spec-gate, spec-state, agent giống nhau | fix | spec-gate, spec-state, agent | none (D-08) | routine | test hook Codex |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a Claude hook installed from the manifest runs with `payload.cwd` in a subdirectory, rules, inspect-block, agent and spec-gate shall read the project's `runtime.json`; rules shall inject once runtime exists. | task-01 Command |
| AC-02 | When Claude spec-state runs, it shall read `runtime.json` from the project root, skip a touch only for an explicitly failed edit, keep its tollgate cache per session, and recognise packets by the configured specs prefix, absolute path and explicit path. | task-02 Command |
| AC-03 | When a Claude PostToolUse `Agent`, Stop or SubagentStop arrives, the state hook shall refresh state under a write lock and log any crash; both hosts shall store the last assistant message summary only when it carries no secret keyword. | task-03 Command |
| AC-04 | When a Claude session starts after compaction, the next prompt shall receive the rules again; session and precompact shall exit 0 with a log on failure, and precompact git calls shall time out. | task-04 Command |
| AC-05 | When Codex runtime has an invalid `paths.specs`, inspect-block and rules shall still apply; secret-output-guardrail shall run from source. | task-05 Command |
| AC-06 | When a Codex session starts after compaction, even with an invalid `paths.specs`, it shall warn that pending confirmations may be lost and the next prompt shall receive the rules again; it shall print the same session's anchor only when the probe showed the host runs PreCompact. | task-06 Command |
| AC-07 | When a newer CafeKit version is published, the Codex session shall print the same update notice as Claude, built from a validated cached version, after privacy state is cleared. | task-07 Command |
| AC-08 | When privacy asks or denies, both hosts shall name files with the same `displayNames`; Claude shall `ask` on empty input. | task-08 Command |
| AC-09 | When spec-gate, spec-state or agent context print, both hosts shall show the D-08 text and the same agent rule lines. | task-09 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Một luật root cho hook Claude | P1 | AC-01 | `lib/project-root.cjs`, rules, inspect-block, agent, spec-gate, manifest | - | done |
| 02 | spec-state Claude khớp Codex | P1 | AC-02 | Claude spec-state, `lib/spec-touch.cjs`, Codex touch | task-01-claude-installed-root.md | done |
| 03 | state: Agent, khoá, log, tin nhắn cuối | P2 | AC-03 | Claude state, parser; Codex state | task-02-claude-spec-state-parity.md | done |
| 04 | session/precompact Claude bền + rules sau compact | P2 | AC-04 | Claude session, precompact, rules, `lib/rules-reservation.cjs` | task-03-claude-state-robust.md | done |
| 05 | Codex inspect, rules, guardrail | P1 | AC-05 | Codex inspect-block, rules, guardrail, shim | task-04-claude-session-compact.md | done |
| 06 | Codex compact | P2 | AC-06 | Codex session, rules reservation, precompact, hooks.json | task-05-codex-gate-robust.md | done |
| 07 | Thông báo cập nhật cho Codex | P3 | AC-07 | `lib/update-check.cjs`, session hai host | task-06-codex-compact.md | done |
| 08 | Privacy hiển thị thống nhất | P1 | AC-08 | privacy-block Claude + omp, lib tên | task-07-codex-update-notice.md | done |
| 09 | Thông điệp thống nhất | P3 | AC-09 | spec-gate, spec-state, agent | task-08-privacy-display.md | done |

Command của mỗi task chạy từ gốc repo; self-test chạy trong `packages/spec` bằng `node scripts/run-skill-self-tests.mjs`. Chạy tuần tự: các task dùng chung hai changelog (`CHANGELOG.md`, `../../docs/project-changelog.md`, mục Unreleased), manifest và vài file test. Mọi task tạo lib Claude mới phải thêm lib vào `runtime.files` của manifest. **Luật fixture:** các test tự chép tay một danh sách lib — `bin/__tests__/codex-hooks.test.js`, `codex-quiet-hooks.test.js`, `orca-session.test.js`, `codex-native-hook-boundaries.test.js`, `develop-contract.test.js`, `omp-hooks.test.js`, `omp-runtime.test.js`, `src/claude/hooks/__tests__/spec-gate.test.js`, `state.test.js`, `spec-state-touched.test.js` — thuộc Ownership của mọi task, nhưng chỉ ở phần danh sách lib được chép; task nào thêm `require` mới vào một hook phải thêm lib đó vào mọi fixture chép hook ấy. Self-test chạy toàn bộ `bin/__tests__` và `src/claude/hooks/__tests__` (`scripts/run-skill-self-tests.mjs:6625-6649`), nên fixture vỡ sẽ hiện ở Step 3 của chính task gây ra. Probe tĩnh trong `scripts/run-skill-self-tests.mjs` ghim chữ của hook bị đổi chỉ được cập nhật theo đúng thay đổi của task, ghi rõ trong Receipt. Test chạy hook từ source xoá `CLAUDE_PROJECT_DIR` và `PROJECT_ROOT` khỏi env.

## Review log
- 15/10 vòng giấy 1: ba reviewer ngữ cảnh mới (Fact Checker + Contract Verifier; Failure-mode + Assumption destroyer; Security + Scope), cả ba CONCERNS; gộp 15 nhóm. Xác nhận: các file test dùng làm Verification đều xanh trên `15130ba9`; Claude 2.1.300 gửi lỗi tool qua PostToolUseFailure (chuỗi binary); binary codex 0.162.1 có schema `pre-compact.command.input`.
- GATE-REVIEW 15/10, Bro chấp nhận cả 15:
  - G1 High: lib Claude mới vào `runtime.files`; test dựng layout theo manifest; chạy `omp-hooks.test.js`.
  - G2 High: task tạo shim sở hữu và chạy các fixture Codex.
  - G3 High: task-08 sở hữu bản fork omp privacy-block và `omp-hooks.test.js`; mọi `ask` qua một helper.
  - G4 High: probe PreCompact có đối chứng dương, `CODEX_HOME` tạm, Bro cho phép chép `auth.json`.
  - G5 Medium: lọc `last_assistant_message` có từ khoá secret ở cả hai host (D-07).
  - G6 Medium: update check sau `clearState`, cache chỉ lưu version đã kiểm (D-05).
  - G7 Medium: rules và nhánh compact Codex không đi qua `getHookContext`.
  - G8 Medium: một luật root cho mọi hook Claude (D-01).
  - G9 Medium: test task-02 thiết kế lại; chỉ chuyển hàm thuần + `explicitFailure`.
  - G10 Medium: task-03 oracle quan sát được; crash bằng stdin `{`; khoá nhả trước exit; SessionStart không khoá.
  - G11 Medium: task-04 xoá chỗ giữ trước khi đọc anchor; test git treo có timeout; chạy `orca-session.test.js`.
  - G12 Medium: task-01 chỉ kiểm hành vi rules.
  - G13 Medium: tách privacy thành task-08; chữ đích ghi trong D-08.
  - G14 Low: sửa trích dẫn; D-02 đã kiểm qua binary; anchor Codex tên sha256.
  - G15 Low: ghi giới hạn ở Known limitations.
- 15/10 vòng giấy 2 (lượt đóng, ngữ cảnh mới): CONCERNS — 12/15 đóng; G1, G2, G7 áp chưa đủ, có bằng chứng chạy được trên bản chép: fixture chép tay lib vỡ khi hook thêm `require` (task-01 spec-gate/develop-contract, task-02 state.test, task-03 cần shim `secret-keywords` trước task-05, task-08 orca-session, task-07 codex-native-hook-boundaries); `clearState` Codex vẫn sau `getHookContext`. Controller áp phần còn thiếu của các mục đã chấp nhận: Luật fixture (Tasks), chuyển shim `secret-keywords` sang task-03, `clearState` trước `getHookContext` ở task-06; sửa giấy: ca spec-gate task-01 thành regression guard, điều kiện ca `tollgate:false`, số học ca task-08, hai trích dẫn. Dừng vòng giấy theo luật B4.
