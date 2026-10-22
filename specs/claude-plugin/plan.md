# Claude Code plugin `cf` (gói 1/3 của việc thay installer npx)
Specs-Contract: process-first-ready-v1

Nguồn: brief đã duyệt `plans/20261021-plugin-install-brief.md`.

## Scope decision (GATE-SCOPE — 2026-10-21)
- Existing: payload skill/agent/hook/output-style đã nằm ở `packages/spec/src/claude/` (18 skill lõi ở `packages/spec/src/claude/migration-manifest.json` `skills.required`, 14 agent); hook tìm runtime dir và rơi về `.claude` khi không nằm dưới thư mục có dấu chấm (`packages/spec/src/claude/hooks/lib/runtime-dir.cjs:31-36`); `state.cjs` chọn `<repo>/.claude/session-state` khi repo có `.claude/`, ngược lại `~/.claude/session-states/<hash>` (`packages/spec/src/claude/hooks/state.cjs:89-93`).
- Minimum change: build một cây plugin Claude `plugins/cf/` từ nguồn hiện có, kèm marketplace ở gốc repo; hook không ghi vào repo hay cây plugin; lõi chỉ dẫn ≤10.000 ký tự chèn qua SessionStart; ngôn ngữ/xưng hô qua `userConfig`; bootstrap statusLine cấp user; thử sống.
- Expansion signals: >8 file; 3 phần giao độc lập (plugin Claude, plugin Codex, `migrate`) → tách 3 gói, gói này chỉ là plugin Claude.
- User decision: KEEP — tách 3 gói chạy lần lượt; installer npx giữ nguyên trong thời gian này. Marketplace ngay repo cafekit; ghim `version`; document skills để plugin riêng `cf-docs` ở gói sau.

## Out of scope
- Plugin Codex (gói 2), lệnh `migrate` cho 0.18.x (gói 3), gỡ installer npx, plugin `cf-docs`, phát hành npm hay đẩy marketplace lên GitHub.
- Skill `chrome-devtools`, `ui-ux`, `ui-ux-pro-max` và agent `ui-ux-designer` (cần venv/npm/Chromium/playwright; `packages/spec/src/claude/agents/ui-ux-designer.md:28-31`, `packages/spec/src/claude/skills/chrome-devtools/SKILL.md:24-29,181`): vẫn dùng qua npx; gói sau cài dependency vào `CLAUDE_PLUGIN_DATA` (GATE-REVIEW G-04).
- Đổi nội dung hay hành vi skill ngoài đổi đường dẫn và tên gọi bắt buộc cho plugin.
- Giới hạn đã biết: repo còn `.claude/runtime.json` cũ của npx với `privacyBlock:false` hay `inspect.enabled:false` sẽ tắt cổng tương ứng dưới plugin (`packages/spec/src/claude/hooks/privacy-block.cjs:56-58`, `packages/spec/src/claude/hooks/inspect-block.cjs:61-63`); gói 3 (`migrate`) xử lý (G-09).

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Script build sinh cây `plugins/cf/` (commit vào git) từ `packages/spec/src/claude/`; kiểm "cây commit khớp nguồn" chỉ chạy ở bước release, không ở CI | `.claude-plugin/plugin.json` thẳng trong `src/claude/`; kiểm freshness trong CI | `skills` trong manifest chỉ *cộng thêm* vào `skills/` mặc định (code.claude.com/docs/en/plugins-reference) nên không loại được skill ngoài phạm vi; đường dẫn `.claude/...` trong Markdown phải đổi cho plugin nhưng giữ cho npx; CI chạy test mỗi lần sửa `src/claude` (`.github/workflows/test.yml:47`) | Marketplace cài từ git nên cây phải được commit lúc release | — |
| D-02 | Lõi chỉ dẫn ≤10.000 ký tự trong `plugin/core.md`, chèn bằng hook mới `plugin-context.cjs` chỉ có trong `hooks.json` của plugin; rules chi tiết ship thành file đọc khi cần | Sửa `session.cjs` dùng chung với npx | Plugin không nạp CLAUDE.md/rules, chỉ có `additionalContext` tối đa 10.000 ký tự (code.claude.com/docs/en/hooks) | Lõi + con trỏ giữ được hành vi then chốt | Probe luật ở task-06 đỏ → bổ sung luật đó vào lõi trong ngân sách |
| D-03 | Ngôn ngữ và xưng hô qua `userConfig` (`response_language`, `address`), làm sạch một dòng ≤64 ký tự; `.claude/runtime.json` của repo (nếu có) thắng | Bắt mọi repo có runtime.json | Brief: file cấu hình repo là tuỳ chọn; hook nhận `CLAUDE_PLUGIN_OPTION_<KEY>` (plugins-reference) | Biến tới được hook | task-00 thấy biến vắng → quay lại GATE-REVIEW |
| D-04 | Hook ghi state vào `CLAUDE_PLUGIN_DATA`; thiếu biến mà đang chạy dưới plugin thì ghi vào `os.tmpdir()`, không bao giờ vào cây plugin hay repo | Ghi trong cây plugin | Docs: `${CLAUDE_PLUGIN_ROOT}` đổi mỗi bản cập nhật, "don't write state there" | — | — |
| D-05 | statusLine: SessionStart ghi launcher `<CLAUDE_PLUGIN_DATA>/status.cjs` và file con trỏ cố định `~/.claude/cafekit-plugin-data` chứa đường dẫn data; lệnh `/cf:setup-statusline` (file `commands/setup-statusline.md`) gọi script ghi `statusLine` chỉ khi trống hoặc `command` trỏ đúng launcher đó | Ship statusLine trong plugin | Plugin `settings` chỉ nhận `agent`, `subagentStatusLine`; command phải là file `.md` | — | User đã có statusLine khác → không ghi, in hướng dẫn |
| D-06 | Đường dẫn trong Markdown đổi theo kết quả task-00: biến được thay trong agent/reference → `${CLAUDE_PLUGIN_ROOT}/...`; nếu không → script gọi qua `bin/` của plugin (nằm trên PATH của Bash tool theo plugins-reference) | Giữ `.claude/...` | Receipt cần `provenance.cjs` (`packages/spec/src/claude/skills/develop/references/quality-gate.md:31`, `packages/spec/src/claude/skills/sync/references/rebind-and-audit.md:32`) | task-00 trả lời được | Cả hai cách đều hỏng → quay lại GATE-REVIEW |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-00 | Bốn sự thật host đã được quan sát: thay biến trong agent/reference, biến trong Bash, `CLAUDE_PLUGIN_DATA`/`additionalContext` dưới `--plugin-dir -p`, tên agent có namespace | other:spike | Integration/proof | none | elevated: thiết kế D-03/D-04/D-06 dựa vào | live |
| CP-01 | Cây `plugins/cf/` + marketplace hợp lệ, hook chạy được trong cây build | add | Runtime/deploy (packaging), Integration/proof | none | elevated: kênh cài mới | source + installed (`claude plugin validate`) |
| CP-02 | Hook chạy dưới plugin không ghi file vào repo hay cây plugin và không nhắc `npx` | modify | Filesystem/security | none | elevated: `hookStateDir` ghi `HOOKS_DIR/.logs` (`packages/spec/src/claude/hooks/lib/hook-state-dir.cjs:33-36`); `state.cjs:89-90`; `update-check.cjs:50,58,72` | source |
| CP-03 | Mỗi phiên nhận lõi chỉ dẫn ≤10.000 ký tự và model theo các luật then chốt | add | AI/model, Runtime | none | elevated: cắt khoảng 65% chữ luôn bật | source + live |
| CP-04 | Ngôn ngữ/xưng hô/đường dẫn có hiệu lực cho phiên chính và subagent khi repo không có runtime.json | modify | Runtime (config/env), AI/model (chèn chuỗi user) | none | elevated: `rules.cjs:36-37`, `agent.cjs:47-49` thoát khi thiếu runtime.json | source |
| CP-05 | statusLine CafeKit bật được bằng một lệnh, không đè statusLine khác | add | Filesystem (cấp user) | none | critical: ghi `~/.claude/settings.json` | source |
| CP-06 | Repo trống và repo có sẵn `.claude/`: cài plugin → `cf:specs` dùng được, lõi tới model, Receipt tạo được, cả repo thử và cây `plugins/cf` của cafekit đều sạch | integrate | Integration/proof | none | elevated | live |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-00 | When the spike runs, the system shall print the seven `FACT <name>=<value>` lines named in task-00, covering the host facts in CP-00. | task-00 |
| AC-01 | The build shall produce a plugin with the 15 in-scope skills, 13 agents, output styles, hooks, scripts and references, with no `.claude/` or `.claude\` path left in its Markdown, and `claude plugin validate --strict` shall pass on it and on the repo marketplace. | task-01 |
| AC-02 | When each hook in the built tree runs with a sample payload, it shall exit 0 without a crash log or `Completion gate unavailable`. | task-01 |
| AC-09 | If the committed `plugins/cf/` differs from a fresh build, the release check shall fail. | task-01 |
| AC-03 | While running under the plugin, every hook shall write state only under `CLAUDE_PLUGIN_DATA` (or the OS temp directory when it is absent) and nothing under the project or plugin root, including when the project already has `.claude/`. | task-02 |
| AC-10 | While running under the plugin, the session hook shall print no npx update notice and write no update cache. | task-02 |
| AC-04 | When a session starts, resumes, clears or compacts with the plugin enabled, the system shall inject the core instructions of at most 10,000 characters with resolvable paths to the detailed rules. | task-03 |
| AC-05 | While no `.claude/runtime.json` exists under the plugin, the rules and subagent hooks shall inject the default specs/plans/docs paths and the `response_language` option when set; a runtime.json value shall win. | task-04 |
| AC-06 | When `address` is set, the core context shall include it on one line of at most 64 characters with control characters removed, and the core shall stay at most 10,000 characters. | task-04 |
| AC-07 | When the user runs `/cf:setup-statusline`, the system shall set `statusLine` only if it is absent or points to the CafeKit launcher, and otherwise leave the file byte-identical and print why. | task-05 |
| AC-08 | In a fresh empty repo and in a repo with `.claude/settings.local.json`, the plugin shall list `cf:specs`, reach the model with the core, run the Receipt provenance command, pass the rule probes, and leave both the test repo and cafekit `plugins/cf` without new changes. | task-06 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 00 | Spike: quan sát 4 sự thật host | P1 | AC-00 | `packages/spec/scripts/plugin-spike.sh` | - | done |
| 01 | Build cây plugin + marketplace | P1 | AC-01, AC-02, AC-09 | `packages/spec/scripts/build-claude-plugin.mjs`, `.claude-plugin/marketplace.json`, `plugins/cf/**` | task-00 | done |
| 02 | Hook không ghi vào repo/cây plugin, không nhắc npx | P1 | AC-03, AC-10 | `hooks/lib/hook-state-dir.cjs`, `hooks/state.cjs`, `hooks/session.cjs` | task-01 | done |
| 03 | Lõi chỉ dẫn ≤10KB qua SessionStart | P1 | AC-04 | `plugin/core.md`, `hooks/plugin-context.cjs` | task-02 | done |
| 04 | Ngôn ngữ/xưng hô không cần runtime.json | P2 | AC-05, AC-06 | `hooks/rules.cjs`, `hooks/agent.cjs`, `hooks/plugin-context.cjs` | task-03 | done |
| 05 | Bootstrap statusLine cấp user | P3 | AC-07 | `scripts/setup-statusline.cjs`, `commands/setup-statusline.md` | task-04 | done |
| 06 | Thử sống trên repo trống và repo có `.claude/` | P1 | AC-08 | `packages/spec/scripts/plugin-live-check.sh` | task-05 | done |

Đường dẫn hook/script không có tiền tố nằm dưới `packages/spec/src/claude/`. Task 01–05 đều chạy lại build nên `plugins/cf/**` có nhiều writer: chuỗi phụ thuộc buộc chạy tuần tự.

## Review log
- Round 1 (2026-10-21): 3 reviewer (Fact Checker; Security + Failure-mode; Assumption + Scope + Flow) → 15 finding sau gộp (G-01 Critical, G-02..G-07 High, G-08..G-15 Medium). Bro: nhận tất cả; G-04 chọn loại 4 thành phần cần dependency khỏi gói 1. Sửa trích dẫn: `runtime-dir.cjs:31-36`; 29.307 byte = rules 25.340 + CLAUDE.md + AGENTS core; `claude` 2.1.305.
- Closure round 1 (fresh reviewer): 12/15 PASS; FAIL G-11 (chỉ probe `address`), G-13 (không probe tên agent), G-15 (task-06 không phụ thuộc task-05); UNKNOWN: cách đặt userConfig dưới `--plugin-dir`.
- Round 2 (sửa, không thêm phạm vi): G-11 → task-04 probe `*-language-sanitized`; G-13 → task-01 (g) `agent-names-resolve`; G-15 → task-06 phụ thuộc task-05; UNKNOWN → task-00 `FACT option_settable` + nhánh dự phòng ở task-06; task-06 probe 3 chạy cả lệnh trong `rebind-and-audit.md`.
- Closure round 2 (fresh reviewer): G-11, G-15, UNKNOWN-1, NEW-3 PASS; G-13 FAIL (mẫu (g) hẹp, Oracle ≥5). Mới có bằng chứng code: probe provenance không đạt ở repo trống (`packages/spec/src/claude/scripts/provenance.cjs:92,232`); A5 lệch nhánh dự phòng; AC-00 ghi "four" khác 7 FACT. Sửa cơ học: (g) kiểm mọi chuỗi tên agent trong backtick, Oracle ≥6; probe 3–4 chỉ ở repo B có commit; AC-08 nêu rõ probe từng repo; AC-00 = 7 FACT. Hết 2 vòng giấy: closure G-13 chỉ còn chứng minh bằng chạy thật (task-01 (g)).
- Áp dụng round 1: G-01/G-13 → task-00 + D-06; G-02/G-03/G-10 → task-02; G-04 → Out of scope; G-05 → D-01, AC-09 chỉ ở release; G-06 → D-05, task-05; G-07 → probe luật task-06; G-08/G-11 → task-04; G-09 → Out of scope (giới hạn đã biết); G-12/G-14 → task-01; G-15 → cột Dependencies.
- GATE-DONE (2026-10-21): Bro accepted completion after the final-Head fixed point (7 proofs rerun, Head 12550e8c… identical before and after, 7/7 receipts valid). Known limitations accepted: probe 4 is one model sample (Stop gate is the enforcement), validator icon/README warnings, docs update deferred to release.
