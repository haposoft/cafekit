# project-notes-home: ghi chú riêng của project có một nơi và không bị installer làm mất
Specs-Contract: process-first-ready-v1

Đường dẫn tương đối theo `packages/spec/` trừ khi ghi rõ. Trích dẫn chạy trên `bb93385b`.

## Scope decision (GATE-SCOPE — 2026-10-18)
- Existing:
  - Template chung dặn ghi project notes sau `CAFEKIT CORE END` (`src/common/AGENTS.md:36-41`); template `src/claude/CLAUDE.md:1-6` import `@AGENTS.md` nhưng không nói nơi ghi chú; khối Codex `src/codex/AGENTS.md` cũng không; `README.md:102-103` nói chỉ dẫn ngoài khối trong `CLAUDE.md` được giữ (gợi ý ghi chú ở `CLAUDE.md`).
  - Ba chỗ ghi file gốc tạo file mới từ template khi file vắng mặt: `ensureSharedAgentsMdCore` (`bin/phases/claude-runtime.js:85-113`, gọi ở `bin/install.js:188` và `claude-runtime.js:120`), `copyClaudeMdFile` (`claude-runtime.js:280-310`), `installManagedAgentsMd` (`bin/phases/codex-runtime.js:135-160`).
  - Tiền lệ lỗi có kiểm soát: marker hỏng → cảnh báo, giữ file, `results.errors++` (`claude-runtime.js:96-99`); `errors > 0` → installer ném lỗi và rollback snapshot (`bin/install.js:196-215`).
  - Sự cố 08/10/2026 16:42: snapshot `.cafekit-backup/1791452554835/snapshot.json` ghi `.claude`, `CLAUDE.md`, `AGENTS.md` đều `existed: false` dù cả hai file đã commit có mục `## This repository` → installer tạo mới, ghi chú mất trên đĩa. Nguyên nhân file vắng chưa xác minh; preflight chỉ chặn khi file còn trong index.
  - Chuẩn host: Claude Code nạp `CLAUDE.md` và `@import` (https://code.claude.com/docs/en/memory); Codex nạp `AGENTS.override.md` hoặc `AGENTS.md` mỗi cấp, override thay hẳn file (https://developers.openai.com/codex/guides/agents-md). `AGENTS.md` gốc là nơi duy nhất cả hai host đọc và nhóm dùng chung.
- Minimum change: preflight installer chặn khi file gốc vắng mặt mà git đang theo dõi; ba nơi chữ cùng chỉ về `AGENTS.md` sau `CAFEKIT CORE END`.
- Expansion signals: không; khoảng 8 file.
- User decision (18/10): **KEEP**; file gốc vắng mà git theo dõi → báo lỗi, exit khác 0, không tạo file.
- Repo này (đã làm tay 18/10, ngoài gói): khôi phục `AGENTS.md`/`CLAUDE.md` từ HEAD, gộp ghi chú `CLAUDE.md` vào `AGENTS.md`, cài lại `.claude/` 0.18.2.
- Người thực thi: Codex (pane Orca). Phiên Claude điều phối, ghi Status/Receipt.

## Out of scope
- `docs/installer-architecture.md`; `AGENTS.override.md`, `CLAUDE.local.md`; omp; tự khôi phục từ HEAD.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Một preflight trong `bin/install.js` sau khi có `ctx.platforms` (sau `:176`), trước snapshot (`:181`) và mọi lần ghi: luôn kiểm `AGENTS.md` (writer chung `install.js:188` chạy với mọi platform, kể cả omp); kiểm `CLAUDE.md` khi `ctx.platforms` có `claude` (sau khi đổi alias, `grok` thành `claude`). File "vắng" khi `fs.lstatSync` báo ENOENT (symlink treo vẫn tính là có). Với file vắng, chạy `git ls-files -v --error-unmatch -- <file>` (cwd = thư mục cài, timeout 3000 ms, không shell): exit 0 và cờ đầu dòng khác `S` (không phải skip-worktree) → ném lỗi `<file> is tracked by git but missing from the working tree; restore it with \`git checkout -- <file>\`, or \`git rm <file>\` if the deletion is intended, then rerun the installer.` → exit khác 0, không ghi gì (chưa có snapshot nên không rollback). Exit 1, hoặc stderr có `not a git repository` → hành vi cũ, im lặng. Mọi kết quả khác (exit khác, lỗi spawn, timeout, git vắng) → hành vi cũ kèm một dòng cảnh báo `Could not confirm git state for <file>; installing a fresh copy.` `--dry-run` đi cùng đường | Kiểm trong từng writer rồi rollback; tự lấy bản HEAD; chặn khi git lỗi | Quyết định của Bro (GATE-SCOPE); GATE-REVIEW G1, G3–G5 | Index git phản ánh ý định giữ file | — |
| D-02 | Mỗi nơi một biến thể, cùng phần đầu `Project notes (commands, files to leave unchanged, slow or expensive operations) belong in the root AGENTS.md after the CAFEKIT CORE END marker`: khối Claude (`src/claude/CLAUDE.md`) thêm `; Claude Code reads them through @AGENTS.md.` (không có chữ Codex, giữ bất biến cách ly `installer-safety.test.js:406`, `package-inventory.test.js:1596`); khối Codex (`src/codex/AGENTS.md`) thêm `; Codex reads AGENTS.md directly.`; `README.md` dùng câu đầy đủ `; Claude Code reads them through @AGENTS.md and Codex reads AGENTS.md directly.`, đặt ngay sau câu cam kết `:102-103` (giữ nguyên câu đó) và sau đoạn kết thúc ở `:139`. `src/common/AGENTS.md` giữ nguyên | Một câu chung; nới test cách ly | GATE-REVIEW G2 (Bro chọn biến thể); G6 | — | — |

## Known limitations
- Git không xác nhận được (dubious ownership, timeout, git vắng) → vẫn tạo file mới, chỉ kèm cảnh báo.
- File theo dõi với tên khác hoa thường (`agents.md`) không bị bắt.
- Mất cả index entry (nhánh orphan, cwd sai) → preflight không giúp.
- File đã `git rm` hoặc repo không dùng git: installer vẫn tạo file mới như cũ.
- Bản cài trong các repo khác không tự sửa; người dùng phải tự chuyển ghi chú từ `CLAUDE.md` sang `AGENTS.md`.

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Installer không lặng lẽ thay file gốc đã commit mà đang vắng | fix | `bin/install.js` preflight | none (D-01) | elevated (mất dữ liệu người dùng) | test installer trên repo git tạm |
| CP-02 | Ba nơi chữ cùng chỉ một nơi ghi chú | modify | template Claude, khối Codex, README | none (D-02) | routine | test chữ trên bản cài |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | If root AGENTS.md (any platform) or CLAUDE.md (when claude is selected) is missing on disk while present in the git index and not skip-worktree, the installer shall write nothing, print the restore and `git rm` commands, and exit non-zero; if git cannot confirm the state it shall warn and behave as before; otherwise it shall behave as before. | task-01 Command |
| AC-02 | When Claude or Codex is installed, the installed CLAUDE.md block and Codex AGENTS.md block shall carry their D-02 variant (the Claude block still free of Codex wording), and README shall keep its ownership sentence and state the full D-02 sentence. | task-02 Command |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Preflight file gốc vắng mà git theo dõi | P1 | AC-01 | `bin/install.js`, `installer-safety.test.js` | - | pending |
| 02 | Một câu chỉ nơi ghi chú | P2 | AC-02 | `src/claude/CLAUDE.md`, `src/codex/AGENTS.md`, `README.md` | task-01-tracked-root-preflight.md | pending |

Command chạy từ gốc repo. Oracle chung: mọi lệnh exit 0; `node --test` có `# fail 0`, `# skipped 0`, `# todo 0`, tên từng test mới hiện thành dòng `ok`; self-test in `PASS:`. Hai task cùng sửa hai changelog (`CHANGELOG.md`, `../../docs/project-changelog.md`, Unreleased) nên chạy tuần tự. Probe tĩnh trong `scripts/run-skill-self-tests.mjs` ghim chữ template chỉ được cập nhật đúng theo thay đổi, nêu trong Receipt. Không đưa mã task/quyết định vào tên test, comment hay commit.

## Review log
- 18/10 vòng giấy 1: hai reviewer ngữ cảnh mới (Fact Checker + Contract Verifier; Failure-mode + Assumption + Scope), cả hai CONCERNS; trích dẫn khớp `bb93385b`; Command hiện xanh (installer-safety 48/48, + skill-routing 51/51, self-test 2217).
- GATE-REVIEW 18/10, Bro chấp nhận cả 7: G1 kiểm `AGENTS.md` mọi lần cài + ca omp; G2 mỗi khối một biến thể câu; G3 cảnh báo khi git không xác nhận được, timeout 3000 ms; G4 skip-worktree không tính vắng, dùng `lstat`; G5 câu lỗi nêu `git rm`, chữ thường vào giới hạn; G6 README giữ câu cam kết, chèn sau `:139`, test chuẩn hoá khoảng trắng; G7 nguyên nhân 08/10 chưa xác minh, test `--no-gpg-sign`, bỏ qua `.cafekit.lock`.
