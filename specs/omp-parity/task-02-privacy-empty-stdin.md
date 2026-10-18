# Task 02 — Privacy omp chặn khi stdin rỗng

Status: done

## Outcome
`packages/spec/src/omp/hooks/privacy-block.cjs` là bản Claude chỉ khác một edit `ask`→`deny`; stdin rỗng in `deny` với lý do đánh giá thất bại.

## Scope
- In: D-05; hai changelog (sửa thẳng câu Unreleased cũ).
- Out: `ask`→`deny` trên tool_call; privacy Claude/Codex.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/omp/hooks/privacy-block.cjs`, `packages/spec/bin/__tests__/omp-hooks.test.js`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `packages/spec/src/claude/hooks/privacy-block.cjs`, `docs/installer-architecture.md`

## Steps
1. Test trước trong `omp-hooks.test.js`: chạy fork với stdin rỗng → `permissionDecision === 'deny'`, reason chứa `Sensitive access could not be evaluated safely.`; xoá edit stdin rỗng trong `expectedOverlay` (`omp-hooks.test.js:139-140`). Chạy Command → ghi số ca đỏ.
2. Thay `if (!stdin) process.exit(0);` bằng khối Claude (`src/claude/hooks/privacy-block.cjs:45-48`).
3. Sửa câu Unreleased `packages/spec/CHANGELOG.md:17`, `docs/project-changelog.md:15`.
4. Chạy Command. Không commit.

## Acceptance
- AC-02: ca stdin rỗng deny; test overlay xanh với một edit; Command xanh.

## Dependencies
- task-01-bridge-dispatch.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/omp-runtime.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: "an empty stdin is denied under omp" và "the fork differs from Claude only by its overlay".
- Reachability: installer đè file này lên `.omp/hooks/` (`overlayFiles` trong `bin/phases/omp-runtime.js`); bridge gọi ở `tool_call`.
- Oracle: stdout JSON `deny` với lý do trên.
- Counterexample: giữ `if (!stdin) process.exit(0);` → stdout rỗng, ca đỏ.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/omp-hooks.test.js packages/spec/bin/__tests__/omp-bridge.test.js packages/spec/bin/__tests__/omp-runtime.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: d0cf0ade6e0f79b0e0a58f8a4ab945f9e2a8558b
Head: c1786a424a1c49467e7bb3d057f4f1332ff8a9ca7024b7022771b68a8a918989

```text
ok 16 - the fork differs from Claude only by its overlay
ok 17 - an empty stdin is denied under omp, where Claude asks
# tests 24
# pass 24
# fail 0
[skill-test] PASS: 2188 tests executed
```

- Đỏ trước sửa: 2/7 trong `omp-hooks.test.js` (overlay, stdin rỗng).
- Fork nay chỉ khác Claude ở edit `ask`→`deny` (đã `diff`). Câu Unreleased cũ ở hai changelog sửa thẳng.
- Không commit.
