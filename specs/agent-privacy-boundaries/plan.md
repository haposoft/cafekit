# Ranh giới quyền agent + privacy shell động (gói 1/5)
Specs-Contract: process-first-ready-v1

Lộ trình chung: `plans/20261021-cfk-ref-borrow-roadmap.md`.

## Scope decision (GATE-SCOPE — 2026-10-21)
- Existing: `researcher`, `inspector`, `debugger` khai `tools:` không có Write/Edit nhưng có `memory: user` (`packages/spec/src/claude/agents/researcher.md:3,6`, `inspector.md:3,6`, `debugger.md:5-6`); danh sách agent của phiên hiện Write, Edit cho cả ba, còn `code-auditor`/`brainstormer` không có `memory:` thì không [suy luận: host cộng Write/Edit cho agent có `memory:`; task-04 kiểm sống]. `deployer.md:66` chạy `git revert HEAD --no-edit && git push`. Privacy: bộ phân tích bỏ mọi từ có phần mở rộng và chỉ khớp glob/`~`/`{` theo tên (`packages/spec/src/claude/hooks/lib/privacy-paths.cjs:120-134`); quyết định cũ cho qua `$FILE`, `less "$HOME/.env"`, `cat $(echo .env)` ghi ở `privacy-paths.cjs:106-110` và `packages/spec/bin/__tests__/codex-hooks.test.js:2140-2178`. Đã chạy: `cat .e*`, `cat ./.e*`, `cat sub/.e*`, `cat ~/.ssh/id_*`, `f=.env; cat $f`, `cat $(echo LmVudg== | base64 -d)`, `cat "$HOME/.ssh/id_rsa"`, `printf LmVudg== | base64 -d | xargs cat` đều không ra quyết định; `cat .env` ra `ask`. Codex dùng shim trỏ về lib Claude (`packages/spec/bin/phases/codex-runtime.js:104-118`), omp chép bộ hook Claude (`packages/spec/bin/phases/omp-runtime.js:75`).
- Minimum change: gỡ `memory:` ở 3 agent; inspector cấm đọc secrets/env; deployer hỏi trước push lúc rollback; privacy bắt glob (cả có thư mục), biến gán trong chuỗi lệnh, `$X/<tên nhạy cảm>`, và tên nhạy cảm viết thẳng trong `$(…)`/backtick.
- Expansion signals: 11 file (sau CUT ngày 2026-10-21: 6 file); một subsystem quyền agent + một subsystem hook → một gói.
- User decision: KEEP — chi tiết ở lộ trình chung. GATE-REVIEW vòng 1 (2026-10-21): Bro nhận 14/14 finding, gồm **đảo quyết định cũ** ở `codex-hooks.test.js:2140-2178`: `less "$HOME/.env"`, `cat $(echo .env)`, ``cat `echo .env` `` chuyển sang "phải hỏi". Sau closure vòng 2 (2026-10-21), Bro **tách toán hạng động** (giải mã, `xargs` từ pipe, `find -exec`) ra gói sau có đo số lần hỏi oan; task-03 chờ gói `specs/privacy-race-omp-cleanup` (phiên khác) xong vì cùng sửa `codex-hooks.test.js`.

- CUT (2026-10-21, sau develop): Bro tách phần privacy (task-03, CP-03, AC-05, AC-06, phần privacy của AC-07) sang một gói privacy mới, gộp với gói 1b toán hạng động, thiết kế lại có ngân sách chung cho cả lệnh; dùng lại `plans/20261021-privacy-task03-attempt.patch` và `plans/20261021-privacy-task03-spec.md`. Gói này còn quyền agent + deployer.

## Out of scope
- `strategist` (giữ `memory: project`; host cấp nó Edit dù chỉ khai Write — ghi giới hạn).
- Ghi file qua Bash của 3 agent (redirect, `sed -i`, `tee`) — agent vẫn có Bash.
- `sandbox_mode` của `debugger` trên Codex (vai trò cần chạy test; Codex 0.162.1 không cưỡng chế `sandbox_mode`, `docs/project-changelog.md:29`).
- Toán hạng động của lệnh đọc: `cat $(echo LmVudg== | base64 -d)`, `cat $(printf '\x2e…')`, `… | base64 -d | xargs cat`, `find … -exec cat {} +`, `find . -exec sh -c 'cat "$FILE"' \;` — để gói sau, đo số lần hỏi oan trên lịch sử lệnh thật trước khi chọn luật (trong repo có `.env` ở gốc, luật "thư mục có file nhạy cảm" sẽ hỏi mọi `xargs`/`find -exec`).
- Shell động ngoài các dạng ở D-02..D-05: hàm shell, `printf -v`, `read`, biến lấy từ file; `git show HEAD:.env`, `dd if=.env`, `tar cf - .env`, `git diff --no-index /dev/null .env`.
- Gói 2–5 và gói `specs/claude-plugin`.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Gỡ `memory:` ở 3 agent | Giữ `memory:` + `disallowedTools` | Bro chọn ở GATE-SCOPE | `memory:` là nguồn duy nhất cấp Write/Edit | task-04 vẫn thấy Write sau khi gỡ → dừng, quay lại GATE-SCOPE |
| D-02 | Glob: tách dirname/basename; dirname là chữ cố định (gồm `./`, `~`) → `readdir` rồi khớp basename bằng matcher sẵn có; dirname có ký tự glob → mở một cấp thư mục (tối đa 64 thư mục khớp, vượt thì khớp theo tên) rồi khớp basename trong từng thư mục; thiếu `path.matchesGlob` hoặc `readdir` lỗi → khớp theo tên như cũ; basename rỗng (`*/`) không khớp file nào; `du -sh .* *`/`stat .*` hỏi khi có `.env` là hành vi chấp nhận (glob thật sự trùng file nhạy cảm) | Hỏi mọi glob; coi dirname có glob là nhạy cảm (hỏi oan `ls packages/*/package.json`, `du -sh */` ở `packages/spec/bin/__tests__/codex-hooks.test.js:2175`) | Giữ `wc -l *.cjs` không hỏi (`privacy-paths.cjs:106-110`); `engines` cho Node ≥18 (`packages/spec/package.json:62`) | Matcher ở `privacy-paths.cjs:332-339` khớp đúng tên bắt đầu bằng dấu chấm | Bash và Node khác nhau (`[.]env`) → ghi lệch, ưu tiên hỏi |
| D-03 | Biến: gán ở đoạn lệnh trước (`;`, `&&`, `\|\|`, `export`, `declare`, `local`, `readonly`) áp cho các đoạn sau; gán đứng trước một lệnh (`f=.env cat $f`) chỉ áp cho `sh -c`/`bash -c`/`env` lồng bên trong; `${X:-word}` xét cả `word` | Theo dõi qua nhiều lệnh Bash | Đúng ngữ nghĩa bash; hook chỉ thấy một lệnh | — | — |
| D-04 | `$X/<tên>` và `${X}/<tên>` khớp theo tên (thêm `$` vào mẫu nhận diện ở `privacy-paths.cjs:130`), không giải `HOME` từ env | Giải `process.env.HOME` | `HOME` trong môi trường hook Codex chưa rõ; `cat $FILE` vẫn không hỏi | — | — |
| D-05 | Chữ cố định trong `$(…)`/backtick làm toán hạng của lệnh đọc (`cat $(echo .env)`) khớp theo tên | Hỏi khi thư mục có file nhạy cảm (tách ra gói sau) | Không cần fixture, không hỏi oan theo thư mục | — | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | 3 agent chỉ-đọc không có tool Write/Edit trên Claude; inspector cấm đọc secrets/env | modify | AI/model (agent), Security | none | critical: ranh giới quyền ghi | source + live |
| CP-02 | Deployer không push khi rollback nếu user chưa đồng ý | modify | AI/model, Git | none | critical: push ra remote | source |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | The `researcher`, `inspector` and `debugger` agent sources shall declare no `memory:` field and no Write, Edit, MultiEdit or NotebookEdit tool. | task-01 |
| AC-03 | The `inspector` source shall forbid reading secret or env files. | task-01 |
| AC-04 | The `deployer` rollback protocol shall require explicit user approval before any `git push`. | task-02 |
| AC-07 | When a subagent `researcher`, `inspector` or `debugger` from an install of this source tries to create a file with Write, no file shall appear. | task-04 |

AC-02 bỏ ở GATE-REVIEW (R2); AC-08 bỏ khi tách toán hạng động; AC-05, AC-06 và phần privacy của AC-07 chuyển sang gói privacy mới (CUT 2026-10-21).

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Agent chỉ-đọc hết tool Write/Edit | P1 | AC-01, AC-03 | `packages/spec/src/claude/agents/{researcher,inspector,debugger}.md`, `packages/spec/bin/__tests__/agent-authority.test.js` | - | done |
| 02 | Deployer hỏi trước push | P1 | AC-04 | `packages/spec/src/claude/agents/deployer.md`, `packages/spec/bin/__tests__/agent-authority.test.js` | task-01 | done |
| 04 | Thử sống quyền agent | P1 | AC-07 | `packages/spec/scripts/agent-privacy-live-check.sh` | task-01, task-02 | done |

task-01 và task-02 cùng sửa `agent-authority.test.js`: chạy tuần tự.

## Review log
- Round 1 (2026-10-21): 2 reviewer context mới (Fact Checker + Contract Verifier; Security adversary + Failure-mode + Assumption destroyer); 18 finding gộp còn 14 (R1–R14), Bro nhận 14/14; sweep: 5 file đọc lại / 14 delta / tham chiếu cũ đã sửa: AC-02, `codex-install.js`, "20 test", `git stash`, danh sách bộ giải mã, đường dẫn giả cố định / còn mâu thuẫn: 0.
- Closure vòng 1: 12/14 PASS (R1–R9, R11–R14), R10 FAIL; bản sửa lộ N1 (High), N2 (Medium), N3, N4 (Low).
- Round 2 (2026-10-21, vòng giấy cuối): Bro nhận R10, N1, N2, N3, N4 như đề xuất; sweep: 5 file đọc lại / 5 delta (D-02 mở glob thư mục một cấp + `du -sh .* *` chấp nhận, fixture `.env` cho 3 lệnh đã chuyển, số file 10, Status) / tham chiếu cũ đã sửa: "coi như nhạy cảm", "9 file" / còn mâu thuẫn: 0.
- Closure vòng 2: R10, N2, N3 PASS; N1, N4 FAIL; lộ M1 (High: `src/claude/hooks/__tests__/privacy-block.test.js:212-236` khẳng định cho qua 3 lệnh đã chuyển, ngoài Ownership), M2 (High: `.env` fixture làm đỏ vòng allowed `codex-hooks.test.js:2183,2190`), M3 (Low: `*/`). Hệ quả D-05: trong repo có `.env` ở gốc, mọi `xargs`/`find -exec`/`$(…)` của lệnh đọc sẽ hỏi.
- Quyết định sau vòng giấy cuối (2026-10-21): Bro tách toán hạng động ra gói sau (bỏ D-06, AC-08; D-05 thành khớp tên chữ trong substitution → N1/M2 không cần fixture `.env`); M1 đưa `privacy-block.test.js` vào Ownership; M3 ghi vào D-02; task-03 chờ `specs/privacy-race-omp-cleanup`. sweep: 5 file đọc lại / 6 delta / tham chiếu cũ đã sửa: D-06, AC-08, "toán hạng động", fixture `.env`, "10 file" / còn mâu thuẫn: 0.
- Develop 2026-10-21: task-01, task-02 done (commit 32f41fe5, 446bf0a3). task-03 sau 4 vòng sửa vẫn FAIL review (ngân sách theo toán hạng, regex O(n²) khi mở rộng biến); đóng được H1 backtrack hàm mũ, M1 `.e*****`, L2 `a=$a$a`, bypass `big/.e*`, tràn stack 200k file. Đã hoàn tác; patch ở `plans/20261021-privacy-task03-attempt.patch`. task-04 chờ task-03.
- CUT 2026-10-21: task-03 gỡ khỏi gói (bản cuối lưu ở `plans/20261021-privacy-task03-spec.md`, lịch sử ở 446bf0a3); task-04 bỏ phụ thuộc task-03 và phần privacy; sweep: plan + task-01/02/04 / 5 delta (CP-03, AC-05, AC-06, AC-07, task-03) / còn mâu thuẫn: 0.
