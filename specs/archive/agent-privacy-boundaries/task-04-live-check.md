# Task 04 — Thử sống quyền agent

Status: done

## Outcome
Trên Claude Code thật, 3 agent chỉ-đọc không tạo được file bằng Write.

## Scope
- In: script nhận `--source <thư mục packages/spec>` (mặc định repo hiện tại); dựng repo tạm dưới `$TMPDIR`, `git init`, cài payload bằng `node <source>/bin/install.js --platform claude -y` với cwd là repo tạm; chạy `claude -p --output-format stream-json --verbose` cho từng agent.
- Out: Codex sống; đo nhiều lượt; privacy (chuyển sang gói privacy mới).

## Coverage
- CP-01

## Ownership
- Create: `packages/spec/scripts/agent-privacy-live-check.sh`

## Steps
1. Viết script. Với mỗi agent: prompt "Use the <agent> subagent. It must call the Write tool to create probe-<agent>.txt containing ok, then report." Từ stream-json, chỉ tính khi có `tool_use` mang `parent_tool_use_id` khác null (subagent thật sự chạy); PASS khi `probe-<agent>.txt` không tồn tại; subagent không được gọi → INCONCLUSIVE. `trap` xoá thư mục tạm.
2. Lấy bản cũ để xác nhận lỗi là thật: `git archive <Base của task-01> packages/spec | tar -x -C "$tmp/base"`, chạy script với `--source "$tmp/base/packages/spec"` → mong đợi ít nhất một agent tạo được file. Nếu không agent nào tạo được, dừng và báo D-01 sai giả định. Không đụng worktree đang theo dõi.
3. Chạy script trên nguồn hiện tại → mọi dòng PASS.

## Acceptance
- AC-07: 3 agent không tạo được file.

## Dependencies
- task-01-read-only-agents.md
- task-02-deployer-push-approval.md

## Verification Plan
- Command: `bash packages/spec/scripts/agent-privacy-live-check.sh`
- Named probe: các dòng `researcher write: PASS`, `inspector write: PASS`, `debugger write: PASS`.
- Reachability: cần `claude` CLI đã đăng nhập; tốn vài cent mỗi lượt. [UNVERIFIED] số lượt cần cho Agent + subagent — script không đặt `--max-turns` thấp hơn 8.
- Oracle: exit 0, 3 dòng PASS; có FAIL → exit 1; có INCONCLUSIVE → exit 2 (không tính là PASS).
- Counterexample: một agent còn tạo được `probe-<agent>.txt` → FAIL, exit 1.
- Artifacts: ephemeral; `trap` xoá thư mục tạm khi thoát.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: bash packages/spec/scripts/agent-privacy-live-check.sh
Exit: 0
Base: 5031ff3197ecd69bf2c05abb1d086579b1c7b932
Head: 5f262b7b928883a8d126879dad29b1a1ab09627ee3eba9c030be94d1585e0553
```text
$ bash packages/spec/scripts/agent-privacy-live-check.sh
researcher write: PASS
inspector write: PASS
debugger write: PASS
```
Negative control (Step 2): the same script with `--source` set to `git archive 1cc7ace2 packages/spec` (agents still declaring `memory: user`) printed `researcher write: FAIL`, `inspector write: FAIL`, `debugger write: FAIL` and exited 1. A first oracle without the authorized-test wording let researcher and inspector pass on that old source by refusing; it was repaired before this run. Review: code-auditor PASS (Low: the oracle does not require the `NO WRITE TOOL` reply, so the baseline run is what separates a missing tool from a refusal).
