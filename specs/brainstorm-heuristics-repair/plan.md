# Sửa cf:brainstorm: giả định chịu lực, trường hợp xấu, hướng rẻ nhất để bỏ (gói 3c-sửa)
Specs-Contract: process-first-ready-v1

Lộ trình: `plans/20261021-cfk-ref-borrow-roadmap.md` (gói 3, trần eval $100, đã dùng ≈ $13.0). Số gốc: `specs/archive/brainstorm-heuristics-baseline/task-01-baseline-eval.md` (sonnet, k=10: `gia-dinh-diem-gay` 0/10, `truong-hop-xau` 0/10, `re-nhat-de-bo` 1/10, `xet-huong-tot-hon` 9/10).

## Scope decision (GATE-SCOPE — 2026-10-22)
- Existing: mục "Options and specialist use" áp cho mọi route; `packages/spec/src/claude/skills/brainstorm/SKILL.md:85` bảo so 2–3 hướng theo setup cost, runtime complexity… nhưng không bắt nêu giả định chịu lực/điểm gãy hay so trường hợp xấu; `:87` "Recommend the smallest path that satisfies the contract." không nói gì về chi phí rời bỏ. Self-test ghim nguyên văn đầu câu `:85` và cả câu `:86` (`packages/spec/scripts/run-skill-self-tests.mjs:1271-1272`, `packages/spec/bin/__tests__/codex-native.test.js:893-894`), nên nối thêm vào cuối câu giữ được pin cũ. Nguồn mượn: `~/Desktop/cfk-ref/.claude/skills/ak-brainstorm/SKILL.md:86-89`. Ca đo `evals/brainstorm/hai-huong/` + `summarize.mjs`; ca hồi quy `evals/brainstorm/mot-duong-agent/` (grader `khong-bu-nhin`, `mot-duong`) và `evals/brainstorm/ne-cau-hoi/` (`do-dai-gon` ≤4000 ký tự, `co-khuyen-nghi`, `khong-hoi-lai`); hai ca cũ ghim tên `cafekit-brainstorm:brainstorm` (`evals/brainstorm/ne-cau-hoi/graders/co-goi-skill.md:4`) nên chạy với tên plugin mặc định, không `--plugin-name cf`. `evals/summarize.mjs` đếm pass theo grader cho các thư mục được nêu tên.
- Minimum change: nối một câu vào cuối bullet `SKILL.md:85` (chỉ áp cho lựa chọn vật chất), thêm pin self-test, sinh lại `history.jsonl` của các ca phát lại (`evals/brainstorm/make-history.mjs:2-8`; `ne-cau-hoi/history.jsonl` chép nguyên văn SKILL.md), một dòng changelog; đo hồi quy trước/sau trên 2 ca cũ và đo lại `hai-huong`.
- Expansion signals: khoảng 9 file (3 là `history.jsonl` sinh máy); một subsystem (skill brainstorm + eval của nó).
- User decision: **KEEP** — SKILL + đo hồi quy 2 ca, sonnet, 3 task (~$8.5). Không thêm dòng bắt buộc `Better approaches` (đã 9/10, luật C2).

## Out of scope
- `agents/brainstormer.md` và đường `--advice`/agent; opus; Codex (chiếu cài đặt tự chép SKILL.md, không đo).
- Heading handoff mới hay sửa 13 heading (`SKILL.md:113`).
- Ca `can-plan-sang-specs`, `duyet-khong-trien-khai`, `tham-do-nap-skill`: không đi qua so sánh phương án.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Chỉ nối vào cuối bullet `:85` ("For a material choice…"), không đụng `:87`, nên luật không áp khi chỉ có một hướng khả thi: với mỗi hướng so sánh, nêu giả định nó dựa vào nhiều nhất, một điều kiện cụ thể (ngưỡng, sự kiện, lỗi) khiến nó gãy trước tiên, và điều xảy ra với hướng đó nếu giả định ấy sai; luôn so chi phí rời bỏ từng hướng, và khi bằng chứng còn để ngỏ một giả định chịu lực thì ưu tiên hướng rẻ nhất để bỏ (văn bản chính xác ở task-02) | Khối điều kiện kiểu `Trade-offs`/`Better approaches` của ak-brainstorm; heading handoff mới | Ca đo đi route non-bug exploration, không dùng heading handoff; hai câu nằm đúng chỗ mọi route đọc | Sonnet làm theo một mệnh đề trong bullet hiện có | `hai-huong` sau sửa còn heuristic nào < 70% của k → chạy xác nhận ca đó một lần (task-03 Failure Protocol); vẫn trượt → quay lại GATE-SCOPE; xác nhận qua → ghi "giáp ranh", không tự PASS, Bro quyết ở GATE-DONE |
| D-02 | Hồi quy = một trong 6 cặp grader đã nêu (`mot-duong-agent`: `khong-bu-nhin`, `mot-duong`, `do-dai-gon`; `ne-cau-hoi`: `do-dai-gon`, `co-khuyen-nghi`, `khong-hoi-lai`) giảm ≥ 3 lượt đạt/10 từ "trước" sang "sau", cùng `claudeVersion`, không lượt `partial`/`error` | So mọi grader không phải `dem-*` (29 phép so, dễ báo oan); so với số archive cũ | Model/host đổi từ 10/2026 nên số cũ không so được | 10 lượt đủ thấy giảm ≥3 ở 6 cặp này; `claude` không tự cập nhật giữa task-01 và task-03 (mọi Command `export DISABLE_AUTOUPDATER=1`) | `claudeVersion` lệch giữa "trước" và "sau" → `regress.mjs` thoát 1, task-03 `blocked`, hỏi Bro (đo lại "trước" từ commit trước task-02 hay chấp nhận lệch); có hồi quy → chạy xác nhận ca đó một lần; vẫn hồi quy → quay lại GATE-SCOPE; xác nhận qua → ghi "giáp ranh" cho Bro quyết |
| D-03 | Kiểm máy: `summarize.mjs` thêm cờ `--require <pct>` thoát 1 khi một trong bốn heuristic đạt < pct% của k; `evals/brainstorm/hai-huong/regress.mjs <before> <after>` thoát 1 theo D-02 và khi một bên `partial`, có lượt `error`, không đủ 10 lượt, thiếu grader, hoặc `claudeVersion` lệch; Receipt ghi `claude --version` và trạng thái nạp skill (`evals/lean/loaded.mjs`) của mỗi thư mục, ca không nạp SKILL.md thì ghi là giới hạn | So bằng mắt | Đưa được vào Receipt; PASS không phụ thuộc đọc tay | `result.json` giữ shape `cases[].arms.with[].graders[]` | — |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Có số "trước" của 2 ca hồi quy trên skill hiện tại | add | Eval | none | routine | live (eval sonnet n=10 ×2) |
| CP-02 | SKILL.md có 2 mệnh đề mới, được self-test ghim | change | Skill, Test | none | routine | source (self-test, đỏ trước xanh sau) |
| CP-03 | Sonnet làm đủ 3 heuristic ở `hai-huong` mà không hồi quy 2 ca cũ | change | Skill behavior | none | routine | live (eval sonnet n=10 ×3) |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the current skill runs `mot-duong-agent` and `ne-cau-hoi` 10 times each on sonnet, the summary shall print per-grader pass counts for both, and `regress.mjs` shall exit 0 on a 2-pass drop and 1 on a 3-pass drop in its fake-data self-test. | task-01 |
| AC-02 | When the self-test runs, it shall fail if either part of the new clause is removed from SKILL.md, and pass with it present; the replayed histories shall match the edited SKILL.md. | task-02 |
| AC-03 | When `hai-huong` runs 10 times on sonnet after the change, `summarize.mjs --require 70` shall exit 0 (k ≥ 8, every heuristic ≥ 70% of k), and `regress.mjs` shall exit 0 for both regression cases against task-01. | task-03 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Số "trước" của 2 ca hồi quy + `regress.mjs` | P1 | AC-01 | `evals/brainstorm/hai-huong/regress.mjs` | - | done |
| 02 | Hai mệnh đề SKILL + pin + changelog | P1 | AC-02 | `packages/spec/src/claude/skills/brainstorm/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `evals/brainstorm/*/history.jsonl` | task-01-before-regression.md | done |
| 03 | Đo sau: `hai-huong` + 2 ca hồi quy | P1 | AC-03 | `evals/brainstorm/hai-huong/summarize.mjs` | task-04-every-approach.md | done |
| 04 | Câu SKILL lần 2: mọi hướng, kể cả hướng bị loại | P1 | AC-02 | `packages/spec/src/claude/skills/brainstorm/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`, `evals/brainstorm/*/history.jsonl` | task-02-skill-clauses.md | done |

## Scope decision 2 (GATE-SCOPE — 2026-10-22, quay lại sau task-03)
- Evidence: task-03 Command dừng ở `--require 70` (`hai-huong` 7/10, 6/10, 10/10, 9/10); lượt xác nhận `bhr-sau-hai-huong-xn` 5/10, 4/10, 10/10, 8/10. Lượt 3 chỉ nêu giả định/điểm gãy cho hướng được khuyến nghị.
- User decision: sửa câu lần 2 (task-04: "For every compared approach, including each one you reject") rồi chạy lại toàn bộ Command task-03, giữ luật xác nhận của D-01; nếu cả lượt xác nhận vẫn dưới 70% thì dừng, không sửa lần 3. Ngưỡng và D-02 giữ nguyên.

## Review log
- Round 1 (2026-10-22): 2 reviewer context mới (Fact Checker + Contract Verifier; Assumption Destroyer + Proof Auditor); 15 finding gộp còn 12 (G1–G12); Bro nhận cả 12. sweep: plan + 3 task / delta: sinh lại history (G1), lệnh node thay pnpm (G2), một câu duy nhất ở `:85` luôn so chi phí rời bỏ và nêu hệ quả khi giả định sai (G3–G5), `regress.mjs` chặn kết quả bẩn + tự thử (G6), D-02 còn 5 grader + chạy xác nhận (G7), ghi trạng thái nạp skill (G8), Oracle `count=81` (G9), parse `--require` + summarize ngay sau `hai-huong` (G10), số pass self-test trước sửa (G11), tạo heading `### Changed` (G12) / tham chiếu cũ đã sửa: "2 câu", `:87`, "mọi grader không phải `dem-*`", `pnpm`, "tên hai ca đột biến" / còn mâu thuẫn: 0.
- Closure pass (2026-10-22, context mới): G1–G12 PASS; 2 lỗi mới từ chính bản sửa → sửa trong phạm vi đã nhận: D-02 nêu rõ 6 cặp grader theo từng ca (gồm `do-dai-gon` của `mot-duong-agent`); chặn tự cập nhật `claude` bằng `export DISABLE_AUTOUPDATER=1` và định trước đường xử lý khi `claudeVersion` lệch; task-01 chạy `regress.mjs` thư mục với chính nó để chặn `partial`/`error` bằng mã thoát. Hết blocker → task-01 pending, task-02/03 pending chờ phụ thuộc.
- Kiểm delta GATE-SCOPE lần 2 (2026-10-22, context mới): 4/4 mục đúng; 1 lỗi: lượt xác nhận va thư mục `-xn` đã có và lệch câu "dừng" → task-03 Step 2 đổi tên cả `-xn`, Scope decision 2 ghi rõ dừng sau lượt xác nhận.
