# privacy-block dùng chung cho mọi host + vá lỗ lọt
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ.

## Scope decision (GATE-SCOPE — 2026-10-12)
- Existing:
  - Bảng mẫu nhạy cảm (`RESTRICTED_PATTERNS`/`ALLOWED_EXEMPTIONS` ở Claude, `RESTRICTED`/`EXEMPT` ở Codex), `resolveTarget`, `isSymlinkToSensitive` và phần quét token sau analyzer được chép tay ở 3 nơi: `src/claude/hooks/privacy-block.cjs:22-165`, `src/codex/hooks/privacy-block.cjs:17-149`, `src/omp/hooks/privacy-block.cjs`. Overlay omp = hook Claude + đúng hai chỗ `ask`→`deny` (:196-197, :245), test so từng byte (`bin/__tests__/omp-hooks.test.js:126-153`).
  - Claude `extractPaths` chỉ đọc `file_path`, `path`, `paths`, `search_paths` (`claude/hooks/privacy-block.cjs:171-181`) → Grep `glob:".env*"` và NotebookEdit `notebook_path:".env"` lọt **[tái hiện 12/10]**. Codex quét đệ quy theo `isPathKey` (`codex/hooks/privacy-block.cjs:37-40,173-186`) nhưng không đọc `glob`, `uri`, `source`/`destination`.
  - Matcher Claude `Read|Write|Edit|MultiEdit|Bash|Glob|Grep` (`src/claude/settings/settings.json:66`) không có `NotebookEdit`, `mcp__.*`.
  - Analyzer chỉ trả `{paths, dynamic, malformed}` (`claude/hooks/lib/privacy-command-analysis.cjs:388-391`): `grep -r API_KEY .` → `["."]`, `grep -R KEY` → `[]`, `rg -g "*.ts" KEY .` → `["KEY","."]`, đích ghi (`>`, `tee`, `cp`) → `[]` (đo 12/10). `rg KEY .` đọc cả `credentials.json` không ẩn (reviewer đo).
  - `privacyBlock === false` tắt cổng (`claude/privacy-block.cjs:211`, `codex/privacy-block.cjs:230`, omp :212). Claude/omp đọc `runtime.json` theo `cwd` của payload (`claude/privacy-block.cjs:45-52,208`) → `sub/.claude/runtime.json` cũng tắt được.
  - Codex privacy gọi `getHookContext` (`codex/privacy-block.cjs:229`, `codex/privacy-approval.cjs:26`), hàm này ném lỗi khi `runtime.paths.specs` sai (`codex/hooks/lib/hook-context.cjs:54-88`) → deny **mọi** lệnh **[tái hiện]**. `require` của hook Codex nằm ngoài `try` (`codex/privacy-block.cjs:4-15`).
  - `session.cjs:224,238` ghi `git remote get-url origin` vào `CLAUDE_ENV_FILE` dưới tên `GIT_URL`; không có consumer.
  - Installer Claude gộp theo chuỗi matcher, lệnh đã có thì bỏ qua (`bin/phases/claude-settings.js:131-158`). Matcher cũ đã ship: `Read|Write|Edit|MultiEdit|Bash|Glob`, `Read|Write|Edit|MultiEdit|Bash|Glob|Grep`; trước 9b8ba7c4 lệnh là `inspector-block.cjs` (không có trong `migration-manifest.json:134-146`). Mẫu Codex: `bin/phases/codex-hooks.js:27-60`.
  - Fixture Codex chép tay danh sách lib: `bin/__tests__/codex-hooks.test.js:143-160`, `codex-native-hook-boundaries.test.js:14-18`, `inspect-paths.test.js:21-26`. `codex-hooks.test.js:726-733` assert `rg --glob '**/*' symbol src` bị chặn.
  - Inspect: glob rộng bị chặn bất kể có `path` (`claude/hooks/lib/inspect-paths.cjs:233-236`).
- Minimum change: lib `privacy-paths.cjs` dùng chung; analyzer báo thêm thông tin tìm đệ quy và đích ghi; vá lỗ lọt; matcher Claude + installer; Codex privacy không phụ thuộc `paths.specs`; bỏ `GIT_URL`; nới inspect cho glob có path hẹp.
- Expansion signals: khoảng 20 file → 6 task, vẫn một subsystem (hook PreToolUse).
- User decision (12/10): **KEEP**.
  - Tìm đệ quy không giới hạn vào thư mục có file mật ở cấp con trực tiếp → ask (Claude) / deny (Codex, omp).
  - Ghi `runtime.json` của CafeKit và thư mục token approve Codex phải được duyệt; đọc thì cho qua; người dùng vẫn tắt bằng tay.
  - Inspect: glob rộng có path hẹp thì cho qua.
  - Người thực thi: Codex (pane Orca); phiên Claude điều phối, ghi Status/Receipt.

## Out of scope
- `PermissionRequest` của Codex thay token approve.
- spec-state/spec-gate/state/session khác (gói 3, 4); `getHookContext` của hook Codex khác.
- Đường ghi gián tiếp (`f=…; … > $f`, script/ngôn ngữ khác ghi file); ghi đè chính file hook, `hooks.json`, `settings*.json`: guardrail, không phải sandbox.
- Đổi danh sách mẫu nhạy cảm; duyệt cây con sâu khi tìm đệ quy.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | `src/claude/hooks/lib/privacy-paths.cjs` là nguồn duy nhất: bảng mẫu, `isSensitive`, `isSafe`, `sensitiveRequest(path, cwd)` (realpath + symlink), `extractPaths`, `sensitivePaths(toolName, input, cwd)`. Lib chỉ `require` `privacy-command-analysis.cjs` (và phụ thuộc sẵn có của nó). Codex: shim + installer chép đè; mọi `require` của hook Codex nằm trong `try` → thiếu lib = deny. omp overlay = hook Claude + đúng hai chỗ `ask`→`deny` | Giữ 3 bản | Một chỗ sửa cho 4 host | omp chép overlay sau bộ Claude (`omp-runtime.js:17`) | Test omp đỏ → sửa lib, không tách bản |
| D-02 | `extractPaths`: khoá có cấu trúc theo `isPathKey` + `notebook_path`, `glob`, `globs`; với `mcp__*` khớp tên khoá theo chuỗi con `/path\|file\|dir\|uri\|source\|dest\|target/i`, bỏ tiền tố `file://`; `command`/`cmd` (chuỗi, hoặc mảng argv thì lấy đối số sau `-c`/`-lc`, không có thì nối argv) khi tool là `Bash`/`exec_command`/`shell`; header patch (cả `Move to:`) khi `apply_patch`/`Edit`/`Write` có trường patch | Chỉ thêm khoá cho Claude | Hợp nhất hành vi đúng nhất hiện có | Payload Claude sau `normalizeHookPayload` cùng tên khoá | — |
| D-03 | Tìm đệ quy: analyzer trả thêm `searches: [{recursive, hidden, includes, excludes, roots}]` cho `grep/egrep/fgrep` (cờ `r`/`R` ở bất kỳ vị trí trong cụm cờ ngắn, `--recursive`, `--dereference-recursive`, `-d recurse`, `--directories=recurse`), `rg`/`ag` (luôn đệ quy; `hidden` khi `--hidden`, `-.`, `-u` ≥2 lần hoặc `-uu`), kể cả lồng trong `bash -c`, `xargs`, `find -exec`. Tool `Grep` = đệ quy, `hidden` = true [UNVERIFIED: Grep Claude có đọc file ẩn], gốc = `path` hoặc `cwd`. Gốc không có → `cwd`. Với mỗi gốc là thư mục đọc được: con trực tiếp nhạy cảm (theo `sensitiveRequest`, bỏ qua file ẩn khi `hidden` = false) và **không** bị loại bởi bộ lọc → nhạy cảm. Bộ lọc: include/glob chỉ loại con khi glob thật (`dot:true`) **không khớp** tên con; glob phủ định `!`, `--exclude`, `type` không loại. Parse `--include=v`, `--include v`, `-g v`, `--glob=v`. Gốc là file / không tồn tại / readdir lỗi → bỏ xét đệ quy | Mọi tìm đệ quy; duyệt sâu | Bro chọn; reviewer chứng minh chuỗi glob không đủ | Analyzer thấy argv của lệnh lồng | — |
| D-04 | Bảo vệ ghi: đích nhạy cảm = `runtime.json` ngay dưới đoạn `.claude`/`.codex`/`.omp` bất kỳ, và mọi thứ dưới `.codex/hooks/.privacy`; so sau khi chuẩn hoá (chữ thường, `\`→`/`, bỏ `/./`, gộp `//`, resolve `..`). Đích ghi: tool `Write`/`Edit`/`MultiEdit`/`NotebookEdit`, header `apply_patch`, `mcp__*` có khoá path; shell: analyzer trả thêm `writes` = đích của `>`, `>>`, `tee`, đối số cuối của `cp`/`mv`/`install`/`ln`, file của `sed -i`, và thư mục đích (đích là thư mục `.claude`/`.codex`/`.omp`/`.privacy` → nhạy cảm); `cd`/`pushd` vào các thư mục đó → coi lệnh sau nó trong cùng chuỗi là ghi vào đó. Đọc (`Read`, `cat`, `jq`) cho qua trên mọi host | Bắt mọi lệnh nhắc tên | Bro chọn (R-05) | — | — |
| D-05 | `privacyBlock` đọc từ runtime của gốc cài đặt: Claude/omp dùng thư mục cha của runtime root đã cài (`runtime-dir.cjs:28-29`), trong source tree dùng `CLAUDE_PROJECT_DIR` rồi `cwd`; Codex `readRuntime(PROJECT_ROOT)`. Codex `privacy-block`, `privacy-approval` dùng `PROJECT_ROOT`, `readRuntime`, `resolveSessionCwd` thay `getHookContext` | Sửa `getHookContext` | Privacy không dùng `paths.specs` | — | — |
| D-06 | Xoá `GIT_URL` (lấy + ghi) khỏi `session.cjs` | Bóc userinfo | Không có consumer | grep 12/10 | Có consumer ngoài repo → ghi changelog |
| D-07 | Matcher Claude PreToolUse: `Read\|Write\|Edit\|MultiEdit\|NotebookEdit\|Bash\|Glob\|Grep\|mcp__.*`. Installer: thêm `.claude/hooks/inspector-block.cjs` vào `settingsHookCommandSubstrings`; sau prune, entry PreToolUse có matcher ∈ `FORMER_MATCHERS` và mọi lệnh ∈ tập lệnh template của event → đổi sang matcher template, in `↻ [dry-run ]Settings: hook PreToolUse matcher updated`. Lệnh người dùng hoặc matcher lạ → giữ nguyên, không cảnh báo | Đổi mọi entry chứa lệnh CafeKit | Theo mẫu Codex gói 1; phủ entry bị tách | Lệnh CafeKit = lệnh có trong template | — |
| D-08 | Inspect: `broadGlob` chỉ được bỏ qua khi có ít nhất một path và mọi path sau resolve nằm **hẳn bên trong** project root (không bằng, không phải tổ tiên, không ở ngoài) và không thuộc thư mục bị chặn | Giữ chặn | Bro chọn; R-10 | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Một bộ luật privacy cho Claude, Codex, omp, grok; bắt `glob`, `notebook_path`, khoá MCP, argv; quyết định theo host giữ nguyên; thiếu lib trên Codex = deny | add, refactor, fix | hook 4 host, installer Codex/omp, fixture test | none | critical | test bảng ca trên `.claude` và `.codex` cài bằng installer thật + test omp/grok + `pnpm test` |
| CP-02 | Tìm đệ quy không giới hạn vào thư mục có file mật phải được duyệt | add | analyzer, lib privacy | none (D-03) | critical | test bảng ca |
| CP-03 | Ghi `runtime.json`/token approve phải được duyệt; công tắc đọc từ gốc cài đặt | add, fix | analyzer, lib, hook Claude/omp | none (D-04, D-05) | critical | test bảng ca |
| CP-04 | Codex privacy + approve chạy khi `paths.specs` sai; `GIT_URL` không còn trong env | fix, remove | hook Codex, session Claude | none | critical | test layout cài Codex + test env file |
| CP-05 | Matcher Claude có `NotebookEdit`, `mcp__.*`; bản cài cũ được cập nhật | modify | settings, installer Claude, manifest | none | elevated | test merge + cài thử thật |
| CP-06 | Glob rộng kèm path hẹp bên trong project không bị inspect chặn | modify | lib inspect | none (D-08) | elevated | test bảng ca inspect |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When any tool call names a sensitive non-exempt file through a structured key (incl. `glob`, `notebook_path`, MCP keys, `file://`), an argv/string command, or a patch header, the privacy hook on every host shall return that host's decision (Claude `ask`, Codex `deny` with approval token, omp `deny`); a missing shared lib on Codex shall deny. | task-01 Command |
| AC-02 | When a recursive search's root directory has a direct child that is sensitive and not excluded by an include filter under real glob semantics, the privacy hook shall treat the call as sensitive; a clean root, a file root, or a missing root shall be allowed. | task-02 Command |
| AC-03 | When a tool or shell command writes to a CafeKit `runtime.json` or the Codex approval directory (any casing or path form), the privacy hook shall treat it as sensitive; reads shall be allowed; `privacyBlock` shall be read from the installed runtime root only. | task-03 Command |
| AC-04 | When `runtime.paths.specs` is invalid, Codex privacy shall allow non-sensitive commands and approval shall still issue grants; `CLAUDE_ENV_FILE` shall contain no `GIT_URL`. | task-04 Command |
| AC-05 | When the installer re-runs over a PreToolUse entry whose matcher is a former one and whose commands are all template commands, it shall set the template matcher (also in dry-run output, without writing); other entries shall stay unchanged. | task-05 Command |
| AC-06 | When a broad glob comes with paths strictly inside the project root and outside blocked directories, inspect shall allow it; with no path, the root, an ancestor, or an outside path it shall block. | task-06 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Lib privacy dùng chung cho mọi host | P1 | AC-01 | `src/claude/hooks/lib/privacy-paths.cjs`, 3 `privacy-block.cjs`, shim, `codex-runtime.js`, manifest, fixture test | - | done |
| 02 | Tìm đệ quy vào thư mục có file mật | P1 | AC-02 | `privacy-command-analysis.cjs`, `privacy-paths.cjs`, `privacy-paths.test.js` | task-01-privacy-shared-lib.md | done |
| 03 | Bảo vệ ghi runtime.json + công tắc đọc từ gốc cài | P1 | AC-03 | `privacy-command-analysis.cjs`, `privacy-paths.cjs`, hook Claude/omp, `privacy-paths.test.js` | task-02-recursive-search.md | done |
| 04 | Codex privacy không phụ thuộc paths.specs + bỏ GIT_URL | P2 | AC-04 | hook Codex privacy/approval, `session.cjs`, 2 test | task-03-runtime-write-guard.md | done |
| 05 | Matcher Claude + installer cập nhật matcher | P2 | AC-05 | `settings.json`, `claude-settings.js`, manifest, test mới | task-04-codex-context-and-env.md | done |
| 06 | Inspect cho qua glob rộng có path hẹp | P3 | AC-06 | `inspect-paths.cjs`, `inspect-paths.test.js`, `codex-hooks.test.js` | task-05-claude-matcher-installer.md | done |

Chạy tuần tự theo chuỗi phụ thuộc: mọi task ghi `CHANGELOG.md` và `../../docs/project-changelog.md` (Unreleased), và nhiều task dùng chung file test/manifest.

## Review log
- Round 1 (3 reviewer ngữ cảnh mới, 12/10): 15 phát hiện R-01..R-15 sau khử trùng. Bro nhận hết; R-05 chọn "chỉ bắt lệnh dạng ghi". Đã áp: glob thật + phủ định + 2 dạng tham số (R-01, D-03); analyzer báo `searches` (R-02, task-02 sở hữu analyzer); `rg`/`ag` luôn đệ quy, ẩn theo cờ (R-03); chuẩn hoá đường dẫn, thư mục đích, `cd`, MCP ghi, công tắc theo gốc cài (R-04, D-04, D-05); chỉ bắt đích ghi (R-05); fixture Codex trong Ownership + dựng bằng installer (R-06); `codex-hooks.test.js:726-733` thuộc task-06 (R-07); readdir lỗi bỏ qua (R-08); khoá MCP chuỗi con + `file://` (R-09); path hẹp = hẳn bên trong root (R-10); `require` trong `try` + giới hạn phụ thuộc lib (R-11); ràng buộc byte omp (R-12); `inspector-block` obsolete + điều kiện tập con + dry-run (R-13); symlink con + argv (R-14); test approve + `session_id` + trích dẫn (R-15). Tách runtime.json thành task-03 (6 task); chuỗi phụ thuộc tuyến tính để tránh hai người ghi một file.
- Closure (reviewer mới, 12/10): 14/15 PASS (bằng chứng riêng theo file:line); R-08 PARTIAL vì thiếu ca thư mục không đọc được → thêm ca `chmod 000` vào task-02. Vá thêm: trích dẫn glob trong lệnh Acceptance task-01 (zsh); test xoá `CLAUDE_PROJECT_DIR` khi spawn hook. Sweep: 7 file đọc lại / 0 tham chiếu lệch / 0 mâu thuẫn. Hết blocker ngoài phụ thuộc → 6 task `pending`.

| ID | Decision | Original counterexample | Repaired at | Proved at | Replay | Closure |
|---|---|---|---|---|---|---|
| R-01..R-07, R-09..R-15 | accepted | như bảng GATE-REVIEW | plan.md D-01..D-08; task-01..06 | closure pass 12/10 (task-02:27-28, task-03:25-33, task-01:28-34, task-05:28-32, task-06:24…) | paper | PASS |
| R-08 | accepted | gốc tìm là file/không tồn tại/không đọc được | plan.md D-03; task-02 ca cho qua | task-02 ca `locked/` (thêm sau closure) | paper | PASS |
