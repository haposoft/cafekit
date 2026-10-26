# Codex CLI plugin `cf` (gói 2/3 của việc thay installer npx)
Specs-Contract: process-first-ready-v1

Nguồn: brief đã duyệt `plans/20261021-plugin-install-brief.md`; gói 1 đã đóng ở `specs/archive/claude-plugin/`.

## Scope decision (GATE-SCOPE — 2026-10-26)
- Existing: biến đổi Claude→Codex của installer (`packages/spec/bin/lib/codex-install.js` `normalizeCodexBody`, `convertCodexAgentContent`, `codexAgentName`); chính sách gọi skill riêng Codex (`packages/spec/bin/phases/copy-payload.js:45,174` `syncCodexInvocationPolicy`); bố cục runtime Codex do installer ghép (shim lib, rules, output styles, schema: `packages/spec/bin/phases/codex-runtime.js:65-131,166-168`); bộ sinh lệnh hook có PATH dự phòng + `commandWindows` (`packages/spec/bin/phases/codex-hooks.js:141-160`); hook Codex `packages/spec/src/codex/hooks/` (12 script, 17 handler trong `packages/spec/src/codex/hooks.json`); khối chỉ dẫn `packages/spec/src/codex/AGENTS.md` (4.038 byte); build gói 1 `packages/spec/scripts/build-claude-plugin.mjs`.
- Minimum change: build cây plugin Codex `plugins/cf-codex/` + marketplace `.agents/plugins/marketplace.json`; hook Codex dưới plugin dùng đúng repo của user (hiện gốc repo tính từ vị trí file: `packages/spec/src/codex/hooks/lib/hook-context.cjs:12-13,86-91`), không ghi vào repo/cây plugin, không chạy chồng với bản cài npx; lõi chỉ dẫn qua SessionStart; lệnh cài agents cấp user; thử sống bằng `codex exec` dưới `CODEX_HOME` tạm.
- Expansion signals: >8 file; một phần giao độc lập → một gói.
- User decision: KEEP. Nếu plugin Codex không chở được agents → lệnh cài agents vào `~/.codex/agents` do user tự chạy. Plugin tên `cf`; cách gõ skill theo host.
- Phạm vi thêm tại GATE-REVIEW (Bro, 2026-10-26, G-06): dưới plugin — cả Claude (`plugins/cf`) lẫn Codex — bỏ qua các khoá tắt an toàn đến từ `runtime.json` của repo; bản cài npx giữ nguyên.

## Out of scope
- Lệnh `migrate` (gói 3); gỡ installer npx; README/docs/icon/phát hành; plugin `cf-docs`; 3 skill + 1 agent cần dependency (như gói 1).
- Đổi nội dung skill ngoài biến đổi Codex đã có và đổi đường dẫn/tên gọi bắt buộc cho plugin.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Cây riêng `plugins/cf-codex/`; bố cục runtime lấy từ một danh sách layout export bởi `codex-runtime.js`, dùng chung cho installer và build | Cây chung với `plugins/cf`; viết lại bố cục trong build | Shim lib và rules ghép có transform; viết lại sẽ lệch dần (G-02) | Installer giữ nguyên hành vi khi đọc danh sách chung | Test installer Codex đỏ → sửa danh sách, không tách nhánh |
| D-02 | Dưới plugin: gốc repo = `payload.cwd` → git toplevel; state vào `PLUGIN_DATA`, thiếu biến → tmp 0700 đúng chủ, không đạt thì privacy fail-closed | Gốc theo `__dirname`; ghi `<repo>/.codex/` | G-01, brief: repo sạch | Payload Codex có `cwd` | Spike thấy thiếu `cwd` → dùng `process.cwd()` và ghi FACT |
| D-03 | Lõi chỉ dẫn Codex ≤10.000 ký tự qua SessionStart, hook đặt ở `src/codex/plugin/hooks/` | Ghi `AGENTS.md`; đặt trong `src/codex/hooks/` | Plugin không ship `AGENTS.md`; installer chép cả `src/codex/hooks/` (G-09) | Codex đưa `additionalContext` vào `codex exec` | Spike `context_in_exec=no` → quay lại GATE-REVIEW |
| D-04 | Agents qua lệnh user chạy một lần ghi `~/.codex/agents/*.toml`; quyền sở hữu = dấu chứa sha256 thân đã ship | Ship trong plugin; dấu chỉ là comment | Docs không có agents cho plugin; dấu comment giả được (G-14) | — | Spike `plugin_agents_loaded=yes` → ship trong plugin, bỏ lệnh |
| D-05 | Chống Codex cài nhầm cây Claude qua `.claude-plugin/marketplace.json` theo FACT `installed_tree` của decoy giống hệt repo | Bỏ qua | Codex đọc marketplace Claude; hook Claude trả `ask` mà Codex không hiểu → privacy fail-open (G-07) | — | Spike cài cây Claude → task-02 chặn (khai entry chỉ cho Claude hoặc đổi cấu trúc) |
| D-06 | Hook SessionStart chèn vào lõi một bảng lệnh tuyệt đối cho các script plugin (ví dụ `provenance: node "<plugin root>/scripts/provenance.cjs"`); Markdown viết "chạy lệnh `provenance` trong bảng lệnh CafeKit" thay cho `.codex/scripts/<x>.cjs`; chèn lại ở `compact` | `bin/` trên PATH; `${PLUGIN_ROOT}` trong skill; đường dẫn tương đối từ SKILL.md; launcher cấp user | task-00: `plugin_bin_on_path=no`, `skill_body_substituted=no`, `reference_substituted=no`, `context_in_exec=yes` (G-03; Bro chọn tại GATE-REVIEW 2026-10-26) | Model đọc được bảng lệnh trong context | Task-08 Base ≠ git HEAD → quay lại GATE-REVIEW |
| D-07 | Plugin chạy cùng bản cài npx: hook plugin không làm gì (in một dòng báo một lần) khi repo có hook CafeKit cấp repo; nếu FACT `skill_name_collision=yes`, dòng báo đó nói rõ skill trùng tên và trỏ tới lệnh `migrate` (gói 3) | Cả hai cùng chạy | Hai kho privacy → vòng duyệt không thoát; plugin không tắt được skill của repo (G-04) | Nhận ra hook CafeKit qua `.codex/hooks.json` của repo | — |
| D-08 | Mọi bài thử Codex chạy dưới `CODEX_HOME` tạm (`config.toml` mới, `auth.json` symlink); không bao giờ chạm `~/.codex` thật; cấm trust toàn cục | Sửa rồi khôi phục `~/.codex` | Khôi phục mong manh, trust/cache nằm ngoài `config.toml` (G-05); đã quan sát `codex plugin marketplace add` ghi vào `CODEX_HOME` tạm, `~/.codex/config.toml` không đổi | `codex exec` chạy được dưới `CODEX_HOME` tạm | Spike `exec_in_temp_home=no` → quay lại GATE-REVIEW |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-00 | Sự thật host Codex đã quan sát dưới `CODEX_HOME` tạm | other:spike | Integration/proof | none | elevated | live |
| CP-01 | Bố cục runtime Codex có một nguồn chung cho installer và build | refactor | Runtime/deploy | none | elevated: installer Codex hiện dùng | source |
| CP-02 | Cây `plugins/cf-codex/` + marketplace commit được, hook chạy được, tập file khớp bản cài npx | add | Runtime/deploy, Integration | none | elevated | source |
| CP-03 | Hook Codex dưới plugin dùng đúng repo, gate chặn đúng, không ghi repo/cây plugin, không chồng bản npx, có runtime mặc định | modify | Filesystem/security, Async/state | none | critical: gate chết âm thầm (G-01) | source + live |
| CP-04 | Dưới plugin (Claude, Codex), repo không tắt được privacy/inspect | modify | Filesystem/security | none | critical: leo thang quyền (G-06) | source |
| CP-05 | Mỗi phiên Codex nhận lõi chỉ dẫn ≤10.000 ký tự | add | AI/model | none | elevated | source + live |
| CP-06 | Agents CafeKit dùng được trên Codex sau một lệnh, không đè agent của user | add | Filesystem (cấp user) | none | critical: ghi `~/.codex/agents` | source |
| CP-07 | Thử sống: plugin cài từ marketplace cục bộ, skill/lõi/gate/provenance hoạt động, repo sạch, `~/.codex` thật không bị chạm | integrate | Integration/proof | none | elevated | live |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-00 | When the spike runs, the system shall print every `FACT` line named in task-00 and leave the real `~/.codex` untouched. | task-00 |
| AC-01 | The Codex installer and the plugin build shall read one exported runtime layout, and the existing Codex installer tests shall still pass. | task-01 |
| AC-02 | The build shall produce `plugins/cf-codex/` with the in-scope skills and their invocation policies, a valid `.codex-plugin/plugin.json` named `cf`, and a committable `.agents/plugins/marketplace.json`, with no runtime path outside the allowlist. | task-02 |
| AC-03 | The built tree shall hold the same runtime files as an npx Codex install, resolve every hook `require`, keep the PATH fallback and `commandWindows`, and every hook shall exit 0 on a sample payload. | task-03 |
| AC-04 | While running under the plugin, Codex hooks shall act on the payload's repository, block a done task without a receipt, write nothing under the repository or plugin root, inject defaults without a `.codex/runtime.json`, and stay silent when the repository has CafeKit repo-level hooks. | task-04 |
| AC-05 | While running under either plugin, a repository runtime.json shall not disable privacy or inspect, and locale strings shall be sanitized; npx behavior shall be unchanged. | task-05 |
| AC-06 | When a Codex session starts under the plugin, the system shall inject core instructions of at most 10,000 characters, and no npx install shall receive the plugin hook. | task-06 |
| AC-07 | When the user runs the agents setup, the system shall write each CafeKit agent only when absent or when its body still matches the shipped hash, leave every other file byte-identical, and report each decision. | task-07 |
| AC-08 | Under a temporary `CODEX_HOME`, `codex exec` shall prove a skill body nonce, the core marker, a gate block, and the provenance Base, keep the test repositories and installed cache unchanged, stay silent beside an npx install, and leave the real `~/.codex` untouched. | task-08 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 00 | Spike: quan sát host Codex dưới `CODEX_HOME` tạm | P1 | AC-00 | `packages/spec/scripts/codex-plugin-spike.sh` | - | done |
| 01 | Một danh sách layout runtime Codex dùng chung | P1 | AC-01 | `packages/spec/bin/phases/codex-runtime.js` | task-00 | done |
| 02 | Build skills, manifest, marketplace | P1 | AC-02 | `packages/spec/scripts/build-codex-plugin.mjs`, `.agents/plugins/marketplace.json`, `.gitignore` | task-01 | done |
| 03 | Build runtime + hooks.json + smoke | P1 | AC-03 | `packages/spec/scripts/build-codex-plugin.mjs`, `packages/spec/bin/phases/codex-hooks.js` | task-02 | done |
| 04 | Hook Codex: đúng repo, cô lập, chung sống npx | P1 | AC-04 | `packages/spec/src/codex/hooks/lib/{hook-context,state-store,privacy-state}.cjs`, `session.cjs`, `rules.cjs`, `precompact.cjs`, `privacy-approval.cjs`, `privacy-block.cjs`, `inspect-block.cjs`, `spec-gate.cjs` | task-03 | done |
| 05 | Repo không tắt được an toàn dưới plugin (Claude + Codex) | P1 | AC-05 | `packages/spec/src/{claude,codex}/hooks/{privacy-block,inspect-block}.cjs`, `packages/spec/src/codex/hooks/rules.cjs` | task-04 | done |
| 06 | Lõi chỉ dẫn Codex qua SessionStart | P1 | AC-06 | `packages/spec/src/codex/plugin/core.md`, `packages/spec/src/codex/plugin/hooks/plugin-context.cjs` | task-05 | done |
| 07 | Lệnh cài agents cấp user | P2 | AC-07 | `packages/spec/src/codex/scripts/setup-agents.cjs`, `packages/spec/src/codex/plugin/skills/setup-agents/` | task-06 | done |
| 08 | Thử sống bằng `codex exec` | P1 | AC-08 | `packages/spec/scripts/codex-plugin-live-check.sh` | task-07 | done |

Task 02–07 chạy lại build nên `plugins/cf-codex/**` (và `plugins/cf/**` ở task-05) có nhiều writer: chuỗi phụ thuộc buộc chạy tuần tự.

## Review log
- Round 1 (2026-10-26): 3 reviewer (Fact Checker + Contract; Security + Failure-mode; Assumption + Scope + Flow) → 15 finding sau gộp (G-01 Critical gốc repo sai dưới plugin, cả 3 reviewer cùng tìm; G-02…G-08 High; G-09…G-14 Medium; G-15 Low). Controller kiểm thêm: `CODEX_HOME` tạm được `codex plugin marketplace add` tôn trọng, `~/.codex/config.toml` không đổi; `.gitignore:116` chặn `.agents/plugins/marketplace.json`. Sửa trích dẫn: 17 handler/12 script (không phải 34 lệnh); không có `src/codex/hooks/__tests__`; installer chép cả thư mục hook (không có danh sách runtime).
- Bro: nhận tất cả; G-06 sửa cho cả plugin Claude lẫn Codex (thêm phạm vi, ghi ở Scope decision).
- Closure round 1 (fresh reviewer): 14/15 PASS; G-04 FAIL ở nhánh trùng tên skill. Mới: N-1 `PROJECT_ROOT` là hằng lúc nạp module (`packages/spec/src/codex/hooks/lib/hook-context.cjs:12-19`), các hook `precompact`, `privacy-approval`, `privacy-block`, `inspect-block` không task nào sửa phần gốc repo; N-2 bộ sinh lệnh hook installer không export, ghi cứng `.codex/hooks` và `process.execPath` (`packages/spec/bin/phases/codex-hooks.js:109-111,130-132,149-151,319-324`); N-3 lệnh task-01 hẹp hơn Acceptance, và `!.agents/plugins/` không mở lại được file khi `.gitignore:116` bỏ cả thư mục `.agents`.
- Round 2 (sửa, không thêm phạm vi): G-04 → D-07 dòng báo trùng tên + task-08 probe (5); N-1 → task-04 sở hữu mọi hook đọc gốc repo, gốc lấy theo từng payload qua một hàm; N-2 → task-03 sở hữu `codex-hooks.js`, export bộ sinh có tham số gốc, không ghi đường dẫn máy build; N-3 → task-01 chạy toàn bộ `bin/__tests__`, `.gitignore` đổi `.agents` → `.agents/*` + `!.agents/plugins/`. Hết 2 vòng giấy.
- GATE-REVIEW D-06 (2026-10-26, sau task-00): cả hai nhánh `bin/` và thay gốc trong skill đều `no` → Bro chọn lõi chèn bảng lệnh tuyệt đối. Kéo theo: task-02 viết lại lời gọi script thành tên lệnh trong bảng; task-06 chèn bảng; task-08 probe provenance dùng bảng. `plugin_options` không export → bỏ nhánh option ở task-06 (ngôn ngữ/xưng hô Codex chỉ từ `.codex/runtime.json` hoặc mặc định). `installed_tree=not-listed` → D-05 chỉ giữ test hồi quy.
- GATE-REVIEW D-07 (2026-10-26, task-04 review): plugin chỉ đứng ngoài khi `.codex/hooks.json` của repo trỏ tới script hook npx có thật trong repo; Bro chấp nhận rủi ro còn lại (hook npx có thật nhưng chưa trust → không gate nào chạy) với dòng báo SessionStart nói rõ phải trust qua `/hooks` hoặc gỡ bản npx; gói 3 (`migrate`) đóng lỗ này.
- Áp dụng: G-01/G-04/G-10/G-13 → task-04 + D-02/D-07; G-02 → task-01 + D-01; G-03 → task-00 FACT + D-06 + allowlist ở task-02; G-05 → D-08, task-00/08; G-06 → task-05; G-07 → task-00 decoy + D-05 + task-08; G-08 → task-02; G-09 → D-03, task-06; G-11 → task-03; G-12 → task-08; G-14 → D-04, task-07; G-15 → tách build thành task-02/03.
- Final-Head fixed point (2026-10-26): every task Command re-run in order on Base `25c11461` / Head `51d9b7b9…` (unchanged before, between and after the runs; Base moved from `691dd4f5` because another session committed a privacy fix mid-packet); 9/9 Receipts rebound. In the re-run of task-00 the model answered `skill_invocation=run probe-skill` (earlier `$probe-skill`): a one-sample model answer; the `cf-<name>` naming rests on `skill_nonce_seen` and `skill_name_collision`, which held.
- GATE-DONE (2026-10-26): Bro accepted completion on the nine current Receipts and the limitations shown, and asked for commits (no push).
