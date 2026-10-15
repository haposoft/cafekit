# Task 09 — Thông điệp thống nhất

Status: pending

## Outcome
spec-gate, tollgate và context subagent in cùng nội dung ở hai host theo D-08.

## Scope
- In:
  - `paths.specs` thoát root: Codex spec-gate block bằng câu `Completion gate: invalid workflow packet detected (…)` như Claude (`src/claude/hooks/spec-gate.cjs:169`), thay `controlled failure`.
  - spec-state: Claude thêm dòng `- Hooks revalidate receipt bytes but never grant approval.`; Codex thêm số đếm chi tiết `(N in_progress, N pending, N blocked)` vào dòng Phase như Claude (`src/claude/hooks/spec-state.cjs:342-345`).
  - Claude `agent.cjs`: thêm hai dòng `- YAGNI · KISS · DRY` và `- Be concise. List unresolved questions at end.` dưới `## Rules` (`src/claude/hooks/agent.cjs:79-80`), như `src/codex/hooks/agent.cjs:46-51`.
  - Đồng bộ `.claude`; changelog.
- Out: khoá cache spec-gate; tiền tố lệnh `/cf:` và `$cf-`.

## Coverage
- CP-09

## Ownership
- Modify: `src/codex/hooks/spec-gate.cjs` hoặc `src/codex/hooks/lib/hook-context.cjs` (chỗ sinh câu `controlled failure`), `src/claude/hooks/spec-state.cjs`, `src/codex/hooks/spec-state.cjs`, `src/claude/hooks/agent.cjs`, `bin/__tests__/codex-hooks.test.js`, `src/claude/hooks/__tests__/spec-state-touched.test.js`, hai changelog
- Probe tĩnh ghim chữ trong `scripts/run-skill-self-tests.mjs`: cập nhật đúng theo chữ D-08.
- Sync (gitignored): `../../.claude/hooks/`

## Steps
1. Thêm test:
   - `codex-hooks.test.js`: `paths.specs: "../outside"` → Stop Codex block với `invalid workflow packet`; spec-state Codex có số đếm chi tiết.
   - `spec-state-touched.test.js`: spec-state Claude có dòng `never grant approval`; agent Claude có hai dòng mới.
   Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; đồng bộ; changelog.
3. Chạy Command; self-test; `cmp`.
4. Không commit.

## Acceptance
- AC-09: các ca trên đúng; self-test exit 0.

## Dependencies
- task-08-privacy-display.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-hooks.test.js packages/spec/src/claude/hooks/__tests__/spec-state-touched.test.js`
- Cwd: gốc repo.
- Named probe: các test mới; tên mô tả hành vi.
- Reachability: hook chạy bằng `spawnSync` trên layout đã cài.
- Oracle: exit 0, `# fail 0`.
- Counterexample: khôi phục câu `controlled failure` → ca `paths.specs` đỏ; hoàn tác.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
