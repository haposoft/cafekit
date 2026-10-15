# Task 01 — Claude state lưu theo phiên

Status: pending

## Outcome
Mỗi phiên Claude chỉ thấy "Prior Execution Context" do chính nó ghi. Phiên mới không còn thấy context của pane khác cùng project.

## Scope
- In:
  - D-01 (plan.md) trong `src/claude/hooks/state.cjs`: thư mục state theo `session_id` khi runtime là `.claude` và payload thô có `session_id` chuỗi khác rỗng; mọi sự kiện dùng cùng thư mục; SessionStart chỉ đọc, không tạo thư mục; không dọn thư mục phiên cũ.
  - Không có `session_id` hoặc runtime khác `.claude` (omp, grok): giữ thư mục cũ.
  - Đồng bộ `../../.claude/hooks/state.cjs` (gốc repo, bị gitignore, không commit) bằng copy.
  - Một dòng changelog ở hai file changelog.
- Out: `session.cjs` (task-02); Codex (task-03); xoá `latest.md` cấp project cũ; dọn thư mục phiên cũ.

## Coverage
- CP-01

## Ownership
- Modify: `src/claude/hooks/state.cjs`, `src/claude/hooks/__tests__/state.test.js`, `CHANGELOG.md`, `../../docs/project-changelog.md`
- Sync (gitignored, không commit): `../../.claude/hooks/state.cjs`

## Steps
1. Thêm test vào `state.test.js`, chạy hook thật bằng `spawnSync` như các test SessionStart hiện có (`:375-390`):
   - phiên A ghi state có todo hoàn thành (PostToolUse `TodoWrite` hoặc Stop), phiên B gửi SessionStart `startup` → stdout không có `Prior Execution Context`;
   - phiên A gửi SessionStart `resume` → có context của A;
   - hai phiên A và B cùng ghi → mỗi phiên resume thấy đúng của mình;
   - payload không có `session_id` → hành vi cũ (đọc thư mục project);
   - project có `.claude/` nhưng chưa có `.claude/session-state/`: SessionStart của phiên Claude không tạo `session-state/` hay thư mục phiên (code cũ tạo `session-state/` ở `state.cjs:38`, nên ca này đỏ trước).

   Lưu ý fixture: tạo `<tmp>/.claude` để `stateDir` không rơi về `~/.claude/session-states` (`state.cjs:42-44`); danh sách file sửa lấy từ git nên giống nhau giữa hai phiên, hãy phân biệt phiên bằng todo, mà todo đến từ transcript JSONL có `TodoWrite`/`TaskCreate`/`TaskUpdate` (`lib/parser.cjs:94-98`) — hoặc ghi `latest.md` trực tiếp vào thư mục phiên như `sessionStartWith`.

   Test cũ: `sessionStartWith` (`:347-372`) ghi `latest.md` cấp project nhưng gửi `session_id: 'start-1'` trên `.claude`; được phép đổi fixture này — chỉ khi runtime là `.claude` — để ghi vào thư mục phiên `sha256('start-1')` cắt 16 ký tự, **giữ nguyên assertion** của `:375` và `:379`; thêm một ca không có `session_id` đọc thư mục project. Test `.omp` (`:384`) giữ nguyên và xanh. Chạy Command trước khi sửa: các ca mới về tách phiên phải đỏ; ghi số ca đỏ.
2. Sửa `state.cjs`; đồng bộ bản `../../.claude`; thêm changelog.
3. Chạy Command; chạy `node scripts/run-skill-self-tests.mjs` trong `packages/spec`; `cmp` bản `../../.claude/hooks/state.cjs` với nguồn.
4. Không commit (controller commit).

## Acceptance
- AC-01: các ca trên đúng; test cũ trong `state.test.js` không đổi assertion (chỉ fixture `sessionStartWith` được đổi như Step 1); self-test exit 0.

## Dependencies
- none

## Verification Plan
- Command (chạy từ gốc repo): `node --test packages/spec/src/claude/hooks/__tests__/state.test.js`
- Named probe: các test mới về tách phiên; tên test mô tả hành vi, không chứa mã plan.
- Reachability: hook chạy bằng `spawnSync(process.execPath, [state.cjs])` với payload JSON qua stdin, như test hiện có.
- Oracle: exit 0, `# fail 0`, output có tên các ca.
- Counterexample: trên bản chép tạm, bỏ khoá `session_id` khỏi thư mục state → ca "phiên B startup" đỏ; hoàn tác sau đó.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
