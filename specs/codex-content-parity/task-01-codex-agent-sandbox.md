# Task 01 — Agent review/tra cứu trên Codex chạy read-only

Status: pending

## Outcome
TOML của `brainstormer`, `code_auditor`, `inspector`, `researcher` có `sandbox_mode = "read-only"`, và Codex thật chặn agent đó ghi file.

## Scope
- In: `convertCodexAgentContent` (`bin/lib/codex-install.js:359-389`) thêm dòng `sandbox_mode = "read-only"` cho đúng bốn agent của D-01; test; probe Codex; changelog.
- Out: agent khác; `model`; chuyển `tools:` sang Codex.

## Coverage
- CP-01

## Ownership
- Modify: `bin/lib/codex-install.js` (chỉ `convertCodexAgentContent`), `bin/__tests__/codex-native.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`
- Read: `src/claude/agents/*.md`

## Steps
1. Thêm test vào `codex-native.test.js`: cài Codex vào thư mục tạm; bốn TOML có đúng một dòng `sandbox_mode = "read-only"`; `implementer.toml`, `test_runner.toml`, `debugger.toml`, `git_ops.toml` không có `sandbox_mode`; ba khoá cũ còn nguyên. Chạy `node --test packages/spec/bin/__tests__/codex-native.test.js` trước khi sửa; ghi số ca đỏ.
2. Sửa `convertCodexAgentContent`; changelog.
3. Chạy Command.
4. Probe (controller chạy, không phải người thực thi; không có trong Command vì tốn tiền):
   - `umask 077`; `H` = thư mục mới trong scratchpad; `trap 'rm -rf "$H"' EXIT INT TERM`; chép `~/.codex/auth.json` vào `$H` không in nội dung; không `set -x`.
   - Dự án tạm đã trust (`config.toml` trong `$H`), cài Codex bằng installer; `.codex/agents/probe_ro.toml` = bản chép `brainstormer.toml` đã cài (có `sandbox_mode`), `probe_rw.toml` = cùng bản bỏ dòng `sandbox_mode`; đổi `name`, thêm vào `developer_instructions`: đọc `token.txt` (nonce ngẫu nhiên chỉ có trên đĩa) và trả lại nội dung, rồi tạo `<nonce-riêng>.txt` chứa `ok` (nonce riêng chỉ nằm trong TOML).
   - Phiên cha `codex exec` được dặn chỉ spawn agent và chuyển lại câu trả lời, không tự ghi file. Chạy hai biến thể: `--sandbox workspace-write` trên CLI, và `sandbox_mode = "workspace-write"` trong `config.toml` không có cờ CLI.
   - Trước khi xoá `$H`: `cmp -s` `auth.json` tạm với bản gốc; khác thì báo Bro, không chép ngược.
   - Receipt chỉ ghi phiên bản codex, câu trả lời token đúng/sai, file nonce có/không, câu read-only có trong rollout con hay không.
5. Không commit.

## Acceptance
- AC-01: các ca test đúng; Command xanh; probe ở mỗi biến thể: trong `$H/sessions` có rollout của thread con cho cả `probe_ro` và `probe_rw` (bằng chứng đã spawn, phiên cha tự đọc token không tính); rollout `probe_ro` có câu quyền read-only và một lệnh ghi bị từ chối; file của `probe_rw` tồn tại, file của `probe_ro` không tồn tại.

## Dependencies
- none

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-native.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test mới về `sandbox_mode`; probe Codex ở Step 4.
- Reachability: installer thật trên thư mục tạm; codex-cli 0.162.1 thật.
- Oracle: Oracle chung của plan; probe như AC-01.
- Counterexample: bỏ dòng `sandbox_mode` → ca test đỏ. Probe: không có rollout con hoặc token sai → agent chưa chạy, probe hỏng, task `blocked`; `probe_rw` không tạo được file → đối chứng hỏng, `blocked`; `probe_ro` vẫn tạo file → Codex bỏ qua trường, `blocked`, báo Bro.
- Artifacts: `$H` ephemeral, xoá bằng `trap`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
