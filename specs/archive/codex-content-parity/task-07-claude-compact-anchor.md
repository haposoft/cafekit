# Task 07 — Anchor compact Claude theo phiên

Status: done

## Outcome
PreCompact Claude ghi anchor riêng theo phiên như Codex; SessionStart compact chỉ in anchor của chính phiên.

## Scope
- In: D-11 ở `src/claude/hooks/precompact.cjs:28` và `session.cjs:194`; test; đồng bộ `../../.claude/hooks/` (gitignored); changelog.
- Out: Codex; dọn file anchor cũ.

## Coverage
- CP-07

## Ownership
- Modify: `src/claude/hooks/precompact.cjs`, `src/claude/hooks/session.cjs`, `src/claude/hooks/__tests__/precompact.test.js` (gồm ca `:257`), hai changelog
- Probe tĩnh: `scripts/run-skill-self-tests.mjs:5067-5073` đổi điều kiện thành `compact-recovery-`.
- Read: `src/codex/hooks/precompact.cjs`, `src/codex/hooks/session.cjs`, `bin/__tests__/orca-session.test.js`
- Sync (gitignored): `../../.claude/hooks/precompact.cjs`, `../../.claude/hooks/session.cjs`

## Steps
1. Sửa `precompact.test.js`: hai phiên A, B lần lượt PreCompact → hai file `compact-recovery-<sha256>.json` cùng tồn tại; SessionStart compact của A in anchor A, không in của B; payload không có `session_id` → không ghi file; ca `:257` ghi anchor của phiên kia dưới tên hash của nó. Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; đồng bộ; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-07: các ca đúng; Command xanh.

## Dependencies
- task-06-obsolete-safe-removal.md

## Verification Plan
- Command: `node --test packages/spec/src/claude/hooks/__tests__/precompact.test.js packages/spec/bin/__tests__/orca-session.test.js && cmp packages/spec/src/claude/hooks/precompact.cjs .claude/hooks/precompact.cjs && cmp packages/spec/src/claude/hooks/session.cjs .claude/hooks/session.cjs && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test hai phiên mới.
- Reachability: hook chạy bằng `spawnSync`.
- Oracle: Oracle chung của plan.
- Counterexample: quay lại tên file chung → ca hai phiên đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/src/claude/hooks/__tests__/precompact.test.js packages/spec/bin/__tests__/orca-session.test.js && cmp packages/spec/src/claude/hooks/precompact.cjs .claude/hooks/precompact.cjs && cmp packages/spec/src/claude/hooks/session.cjs .claude/hooks/session.cjs && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: d0cf0ade6e0f79b0e0a58f8a4ab945f9e2a8558b
Head: 6093741dd9d6464e20ea084603b9e79a8f923496c5c5c5e4325fc1a11ae81918

```text
ok 20 - two compacting sessions keep separate anchors and restore only their own branch
ok 21 - PreCompact without a usable session identity creates no anchor or state directory
# tests 25
# pass 25
# fail 0
# skipped 0
# todo 0
[skill-test] PASS: 2184 tests executed
```

- Đỏ trước sửa (Codex báo): 4/25.
- Counterexample (Codex báo): quay lại tên file chung → ca hai phiên đỏ; hoàn tác khớp byte.
- `cmp` hai hook `.claude/` (gitignored, đã đồng bộ) nằm trong Command.
- Review controller: tên anchor `compact-recovery-<sha256(session_id)>.json` như Codex; không có `session_id` thì không ghi và SessionStart thoát sớm; ca `precompact.test.js:257` ghi anchor phiên kia dưới tên hash của nó; probe self-test đổi sang `compact-recovery-`. Commit d0cf0ade.
