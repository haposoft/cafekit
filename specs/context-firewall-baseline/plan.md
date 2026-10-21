# Đo gốc: model có đổ file lớn vào context không (gói 3b/5)
Specs-Contract: process-first-ready-v1

Lộ trình chung: `plans/20261021-cfk-ref-borrow-roadmap.md` (gói 3, GATE-SCOPE 2026-10-21; luật C2; trần eval cả gói 3 là $100, đã dùng ≈ $8.3).

## Scope decision (GATE-SCOPE — 2026-10-21)
- Existing: CafeKit không có hook giới hạn output theo kích thước; hook PreToolUse hiện có là privacy và inspect-block (`packages/spec/src/claude/settings/settings.json`). Nguồn mượn tiềm năng: `~/Desktop/cfk-ref/.claude/hooks/context-firewall.cjs` (151 dòng) + `lib/context-firewall/*.cjs` (809 dòng), ngưỡng mặc định Read cảnh báo 256 KB / chặn 2 MB, `cat` cảnh báo 128 KB / chặn 512 KB, Grep giới hạn 100 dòng (`~/Desktop/cfk-ref/.claude/hooks/lib/context-firewall/thresholds.cjs:13-23`). Claude Code tự cắt output Bash và giới hạn Read `[UNVERIFIED: giới hạn chính xác của host; xác nhận bằng docs Claude Code hoặc một lượt đo]`. Bộ eval `evals/ask/` có ca kiểu "câu hỏi về repo" (`evals/ask/cam-sua/case.yaml`).
- Minimum change: một task đo gốc, chưa viết hook.
- Expansion signals: 6 file, chỉ thư mục eval.
- User decision: **KEEP** — chỉ đo gốc; có số thì quay lại GATE-SCOPE để quyết viết hook hay đóng gói. Ngưỡng "hỏng": một ca có ≥3/10 lượt đổ nguyên một file ≥128 KB vào context (`cat`/`less`/`more` không qua `head`/`tail`/`grep`/`sed -n`, hoặc Read không `limit`/`offset`).

- GATE-SCOPE mở lại (2026-10-21, bằng chứng mới từ review): Claude Code 2.1.306 tự giới hạn — Bash chỉ trả model 30.000 ký tự, phần thừa lưu ra file kèm bản xem trước (`bashOutputMaxChars` 4000–128000); Read từ chối file > 262144 byte hoặc > 25000 token với `FileTooLargeError` "Use offset and limit", trừ khi model đặt `allow_large: true` (đọc từ `strings` của binary `~/.local/share/claude/versions/2.1.306`). Ngưỡng firewall AgentKit (Read 256 KB, `cat` 128 KB) trùng hoặc cao hơn giới hạn host. **Bro chọn CUT**: đóng gói 3b trên Claude, không đo, không viết hook ($0). Codex/omp mở lại ở GATE-SCOPE riêng nếu cần.

## Out of scope
- Viết hook firewall; đo Codex/omp; đo opus.

## Decisions
| ID | Chosen | Rejected | Why | Load-bearing assumption | Break signal → response |
|---|---|---|---|---|---|
| D-01 | Hai ca trong `evals/ask/`: `log-lon-tim-loi` (`logs/app.log` ~5 MB, hỏi dòng lỗi gây crash) và `json-lon-tom-tat` (`data/export.json` ~3 MB, hỏi cấu trúc); prompt tự nhiên, không gọi tên skill | Ca riêng không gắn skill | `evals/run.sh` cần một thư mục skill; `ask` sát nhất với câu hỏi về file | Model trả lời được mà không cần đọc hết file | — |
| D-02 | Grader `tool_used` đếm lượt đổ nguyên file: Bash có `cat|less|more` lên file lớn không kèm `head|tail|grep|sed -n|wc|jq` trong cùng lệnh; Read lên file lớn không có `limit`/`offset` | Đếm token | Grader `tool_used` không tốn giám khảo; token không có sẵn theo lượt `[UNVERIFIED]` | — | Grader bắt nhầm lệnh có pipe → sửa theo fixture trước khi đo |

## Coverage profile
| ID | Outcome | Change kinds | Material surfaces | Ambiguity/action | Risk/evidence | Required proof |
|---|---|---|---|---|---|---|
| CP-01 | Có số gốc tỉ lệ lượt đổ nguyên file lớn cho hai ca, đủ để quyết viết hook hay không | add | Eval | none | routine | live (eval sonnet n=10) |

## Acceptance criteria
| ID | EARS criterion | Proof |
|---|---|---|
| AC-01 | When the two cases run 10 times each on sonnet, the run shall report, per case, how many runs dumped a whole ≥128 KB file into context, with the fixture checks green beforehand. | task-01 |

## Tasks
| # | Task | Priority | Criteria | Primary ownership | Dependencies | Status |
|---|---|---|---|---|---|---|
| 01 | Hai ca đo gốc + chạy đo | P1 | AC-01 | `evals/ask/log-lon-tim-loi/**`, `evals/ask/json-lon-tom-tat/**` | - | blocked |

## Review log
- Round 1 (2026-10-21): 2 reviewer context mới; Critical chung: grader đếm lần thử, không đo byte vào context, vì host đã cắt/từ chối. Dẫn tới mở lại GATE-SCOPE → CUT.
