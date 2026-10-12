# inspect-block dùng chung cho mọi host + dọn matcher Codex
Specs-Contract: process-first-ready-v1

## Scope decision (GATE-SCOPE — 2026-10-12)
- Existing:
  - Claude `packages/spec/src/claude/hooks/inspect-block.cjs` tự viết regex. `extractPaths` lấy `file_path`, `path`, `pattern` (:53-55) và chỉ bắt `cat|ls|find|head|tail` (:57), áp cho mọi tool trong matcher `Read|Write|Edit|MultiEdit|Bash|Glob|Grep` (`src/claude/settings/settings.json`). Hook này cũng là hook PreToolUse của omp (`src/omp/extensions/cafekit-bridge.mjs:45`) và grok (chạy hook `.claude`).
  - Codex `src/codex/hooks/lib/inspect-paths.cjs` tách token shell đúng (`shellTokens` :45-79, reader rg/grep/sed/find :152-168), nhưng có hai chỗ hỏng:
    - nhánh dự phòng (:172-175) bắt mọi token có `/` trỏ vào thư mục bị cấm, kể cả chính file thực thi `.agents/skills/.venv/bin/python3`;
    - `inspectInput` (:177, tách lệnh ở :181-186) coi nội dung `apply_patch` là lệnh shell.
  - Installer đã có cơ chế chép lib Claude sang Codex (`bin/phases/codex-runtime.js:106-125`). Trong `src`, bản Codex chỉ là shim `module.exports = require('../../../claude/hooks/lib/privacy-command-analysis.cjs')`, và test fixture chép đè (`bin/__tests__/codex-native-hook-boundaries.test.js:16`).
  - Matcher Codex: `src/codex/hooks.json:66` `Bash|exec_command|apply_patch|Edit|Write|Read|Glob|Grep|mcp__.*|shell`, `:93` `Agent|spawn_agent|update_plan|task|Task|TodoWrite`, `:103` `apply_patch|Edit|Write|MultiEdit`.
  - Theo tài liệu Codex, hook nhận `Bash` và `apply_patch` (alias `Edit`/`Write`), `mcp__…`, `spawn_agent` khớp `Agent`, `update_plan`; tool hosted (web search) không qua hook. Phiên eval thật ghi nhận `tool_name` là `Bash`/`apply_patch` (`plans/20261012-hook-review.md`, bảng tool).
  - Khi nâng cấp, merge bỏ qua script đã đăng ký mà không cập nhật matcher (`bin/phases/codex-hooks.js:235-247`), và hứa giữ nguyên chỗ người dùng đặt script (`codex-hooks.js:54-56,126-128`).
- Minimum change: chuyển `inspect-paths.cjs` thành lib Claude dùng chung, cho inspect-block của cả hai host gọi nó, sửa các lỗi chặn nhầm/để lọt, rồi dọn matcher Codex và cho installer cập nhật matcher của nhóm do CafeKit quản lý.
- Expansion signals: khoảng 10 file (lib, 2 hook, shim, installer ×2, hooks.json, 2–3 test, changelog). Vượt 8 file vì đây là EXPAND do Bro chọn; vẫn một subsystem.
- User decision: EXPAND — lib chung + dọn matcher Codex. inspect-block chỉ kiểm thao tác đọc, bỏ qua Edit/Write/MultiEdit/NotebookEdit/apply_patch. Lệnh shell chỉ kiểm lệnh đọc đã biết (kể cả khi bọc trong `sudo|env|time|command|npm exec|npx|pnpm exec|yarn exec|bunx|xargs` hoặc nằm trong `$(…)`/backtick), lệnh khác cho qua. Người thực thi: Codex (pane Orca); phiên Claude điều phối, ghi Status/Receipt.

## Out of scope
- privacy-block, spec-state, state, session (gói 2–4 trong `plans/20261012-hook-review.md`).
- Cập nhật matcher khi nâng cấp phía installer **Claude** (`bin/phases/claude-settings.js:131-140`) → gói 2.
- Đổi danh sách thư mục bị cấm và luật glob quá rộng (giữ nguyên `BLOCKED_DIRS`, `BROAD_GLOBS`).
- Lệnh PowerShell trên grok Windows (`Get-Content`, `gc`, `type`; grok map `PowerShell` → `Bash`, `hook-payload.cjs:64`): vẫn lọt như hiện nay.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `src/claude/hooks/lib/inspect-paths.cjs` là nguồn duy nhất, xuất `inspectInput(toolName, toolInput, cwd)` trả `{ broadGlob, blockedPath }`. `src/codex/hooks/lib/inspect-paths.cjs` thành shim `require` như `privacy-command-analysis`; installer Codex chép file Claude đè lên shim. Claude cần liệt kê lib trong `migration-manifest.json` | Giữ hai bản; tạo `src/common/` | Theo đúng cơ chế đang chạy cho 3 lib khác; omp/grok tự hưởng lợi | Hook `.claude` và `.codex` có cùng hình payload sau `normalizeHookPayload` / `readPayload` | Test omp/grok đỏ → sửa tại lib, không tách bản |
| D-02 | Tool ghi (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `apply_patch`) → không kiểm, exit 0 | Kiểm theo header patch | Bro chọn: hook giữ ngữ cảnh, chỉ kiểm thao tác đọc | — | — |
| D-03 | Trường có cấu trúc: kiểm `file_path`, `path`, `paths`, `notebook_path` và khoá trong `PATH_KEYS`. `pattern` của **Glob** và `glob` của Grep: kiểm độ rộng và thư mục cấm, **trừ** glob bắt đầu bằng `!` (loại trừ). `pattern` của **Grep** là regex, không kiểm. Mọi tool không phải tool ghi (kể cả `exec_command`, thiếu `tool_name`) đều quét `command`/`cmd` (H-06) | Coi mọi `pattern` là path | Grep `pattern:"target"` đang bị chặn nhầm | Claude Glob `{pattern, path}`, Grep `{pattern, path, glob}` | — |
| D-04 | Trước khi xét segment: mở `~` bằng `os.homedir()`; đường dẫn (cả tuyệt đối lẫn sau khi mở `~`) nằm trong **project root** thì đổi về tương đối theo project root; nếu không thì thử theo `cwd`; so cả bản gốc lẫn `realpathSync` của root/cwd (macOS `/var` ↔ `/private/var`); ngoài cả hai → xét nguyên. Project root: Claude `CLAUDE_PROJECT_DIR` rồi `payload.cwd`; Codex `projectRoot` của `getHookContext` (`hook-context.cjs:86-93`) | Chỉ theo `cwd` | Project dưới `~/build/app`, cwd `~/build/app/packages/x` vẫn bị khoá nếu chỉ theo cwd (H-05) | — | — |
| D-05 | Lệnh shell: tách token như hiện tại; tách nhóm ở `;`, `&&`, `\|\|`, `\|`, xuống dòng; **bỏ qua thân heredoc** tới dòng kết thúc; mở `$(…)`/backtick khi không trong ngoặc hoặc trong `"…"`, không mở trong `'…'`. Mỗi nhóm bóc lớp bọc `sudo|env|time|command|nice|nohup|xargs|npm exec|npx|pnpm exec|pnpx|yarn exec|bunx` kèm **tuỳ chọn, phép gán `VAR=val` và `--`** (H-04). Chỉ lệnh đọc `cat head tail nl less more bat ls tree find rg grep sed awk wc du file stat` mới trả path (bỏ `cd`, `pushd`, `source`, `.`: H-03). Tuỳ chọn có giá trị không phải path: `tree -I/-P`, `grep/rg --exclude/--exclude-dir/--include/-e/-f…`, glob `!…` (H-08). Bỏ nhánh dự phòng :172-175. Token đầu (file thực thi) không bao giờ là path | Giữ nhánh dự phòng | Bro chọn; hết chặn venv/build | Codex đọc file bằng `cat`/`nl -ba`/`sed -n`/`rg` (phiên eval thật) | — |
| D-06 | Matcher Codex lấy theo tên tool thật đo trên binary đang cài. Dò trong phòng sạch giống `evals/codex/run.mjs` (CODEX_HOME tạm, `--enable multi_agent` :91, `projects.<room>.trust_level="trusted"` :92, `--dangerously-bypass-hook-trust`); hook ghi `tool_name` vào file **trong phòng**, matcher `*` cho PreToolUse/PostToolUse; prompt buộc chạy lệnh, sửa file, `update_plan`, `spawn_agent`. Matcher mới: bỏ `Read`, `Glob`, `Grep`, `MultiEdit`, `TodoWrite`, `task`, `Task`; **giữ** alias `exec_command`, `shell` cho Codex bản cũ (H-09); thêm tên quan sát được | Lấy theo tài liệu; bỏ hết alias | Tài liệu nói `spawn_agent` khớp `Agent`, chưa rõ hook nhận tên nào | Dò ≤ 3 lượt Codex | Không thấy `spawn_agent`/`update_plan` → giữ tên tài liệu, ghi `[UNVERIFIED]` |
| D-07 | Installer Codex khi nâng cấp, chạy **sau** `pruneObsoleteCodexHooks` và `repairLegacyCodexLaunchers`: nhóm chỉ gồm handler CafeKit **và** matcher hiện tại thuộc tập matcher template cũ đã biết (lấy từ lịch sử git của `src/codex/hooks.json`, gồm `Bash|apply_patch|Edit|Write|Read|Glob|Grep|mcp__.*` và bản có `|exec_command|shell`, và các matcher cũ của nhóm state/spec-state) → đổi sang matcher template, in `↻ … matcher updated` (không in "already registered"). Mọi trường hợp khác (người dùng tự đặt, nhóm lẫn handler người dùng, nhóm chứa script thuộc hai template) → giữ nguyên, in cảnh báo (H-02) | Đổi mọi nhóm CafeKit | Giữ cam kết `codex-hooks.js:54-56` | `managedHandlerScript` nhận diện đúng handler CafeKit | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Một bộ luật inspect cho Claude, Codex, omp, grok: không chặn nhầm venv, build, patch, Grep regex, project dưới `build/`; vẫn chặn đọc `node_modules`/`dist`… kể cả `grep -r`, `npm exec cat`, `$(cat …)` | add, modify | hooks dùng chung 4 host, installer | none | elevated: hook PreToolUse chạy mọi lời gọi tool ở 4 host | test bảng ca trên cả `.claude` và `.codex` đã cài, test omp/grok xanh, toàn bộ `pnpm test` |
| CP-02 | Matcher Codex chỉ gồm tên tool có thật; bản cài cũ được cập nhật matcher khi chạy lại installer | modify | installer Codex, hooks.json | Tên tool `spawn_agent` (D-06) | elevated: sai matcher → hook im lặng không chạy | lượt dò ghi `tool_name` thật; test merge nâng cấp |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When a read-type tool call or shell reader targets a blocked directory inside the project, the inspect hook on every host shall deny it. When the call is a write tool, a non-reader command, an executable path, a Grep regex, or a path whose blocked segment lies above `cwd`, it shall allow it. | task-01 Command |
| AC-02 | When Codex runs a session with CafeKit hooks, each PreToolUse/PostToolUse matcher shall contain only observed tool names, `mcp__.*`, and the kept aliases `exec_command`/`shell`. When the installer re-runs over a CafeKit-only group whose matcher is a known former template matcher, it shall update that matcher; every other group shall stay unchanged with a warning. | task-02 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Lib inspect dùng chung cho mọi host | P1 | AC-01 | `src/claude/hooks/lib/inspect-paths.cjs`, `src/{claude,codex}/hooks/inspect-block.cjs`, `src/codex/hooks/lib/inspect-paths.cjs`, `bin/phases/codex-runtime.js`, `src/claude/migration-manifest.json`, `bin/__tests__/inspect-paths.test.js` | - | done |
| 02 | Matcher Codex theo tên tool thật + cập nhật khi nâng cấp | P1 | AC-02 | `src/codex/hooks.json`, `bin/phases/codex-hooks.js`, `bin/__tests__/codex-hooks.test.js`, `evals/codex/report-hook-tool-names.md` | task-01-inspect-shared-lib.md | done |

## Review log
- Round 1 (2 reviewer ngữ cảnh mới, 12/10): 12 phát hiện H-01..H-12 sau khử trùng; Bro chấp nhận hết. Đã áp: fixture `codex-hooks.test.js` + `require` trong `try` (H-01, task-01); D-07 chỉ đổi matcher template cũ đã biết (H-02); bỏ `source/./cd` (H-03); bóc tuỳ chọn lớp bọc (H-04); D-04 theo project root + realpath + `~` (H-05); quét `command` mọi tool không ghi (H-06); `$(…)` trong `"…"`, heredoc (H-07); tham số loại trừ (H-08); công thức dò + giữ alias (H-09); chứng minh JSON deny/không crash + counterexample 2 (H-10); consumer, changelog docs, lệnh cài, trích dẫn (H-11); PowerShell ngoài phạm vi (H-12).

## GATE-DONE
- 12/10: Bro chọn "Đóng, archive + commit". Receipt: task-01 exit 0 317/317 (Head f2b0797f), task-02 exit 0 63/63 (Head 281e50db); `pnpm test` exit 0 trên 281e50db. Commit 2cb6febd, f2b0797f, a57b3e0c, 281e50db, chưa push.
- Lệch đã ghi: Step 1 hai task sửa vì node 22 bỏ qua im lặng file test vắng (lần đỏ trước sửa chuyển sang Step 2; Oracle task-01 thêm số test và tên test); hai file `.claude/` trong Ownership không commit vì `.claude` bị gitignore.
- Giới hạn chuyển gói sau: Grep `glob:"**/*.ts"` có `path` vẫn bị chặn (Bro: ghi vào gói 2, chưa đổi); `bash -c`/`{ …; }`/`cd x && cat` lọt; crash khi lồng cực sâu (fail-open); cảnh báo mỗi lần cài cho matcher CafeKit người dùng tự đặt; chưa rõ Codex khớp matcher toàn chuỗi hay chuỗi con; `update_plan` chưa quan sát; `state.cjs` Codex chưa nhận `collaborationspawn_agent` (gói 4).
