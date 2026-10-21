# Task 01 — Agent chỉ-đọc không còn tool Write/Edit

Status: done

## Outcome
`researcher`, `inspector`, `debugger` không còn được host cấp tool Write/Edit; `inspector` được dặn không đọc file secret/env.

## Scope
- In: gỡ dòng `memory: user` ở 3 agent; thêm một dòng vào Behavioral Checklist của `inspector` cấm đọc `.env*`, khoá, credential.
- Out: `strategist`; `sandbox_mode` Codex của `debugger`; ghi file qua Bash (3 agent vẫn có Bash — giới hạn đã ghi ở plan).

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/agents/researcher.md`, `packages/spec/src/claude/agents/inspector.md`, `packages/spec/src/claude/agents/debugger.md`
- Create: `packages/spec/bin/__tests__/agent-authority.test.js`
- Read: `packages/spec/bin/__tests__/codex-native.test.js`

## Steps
1. Tạo `agent-authority.test.js`: parse frontmatter 3 agent, khẳng định không có `memory:` và `tools:` không chứa Write/Edit/MultiEdit/NotebookEdit; khẳng định `inspector.md` có dòng cấm đọc secret/env → chạy, thấy đỏ.
2. Gỡ `memory: user` ở `researcher.md:6`, `inspector.md:6`, `debugger.md:5`.
3. Thêm dòng checklist vào mục Behavioral Checklist của `inspector.md`.
4. Chạy lại Verification → xanh.

## Acceptance
- AC-01: 3 agent không có `memory:` hay tool ghi.
- AC-03: `inspector.md` có dòng cấm đọc secret/env.

## Dependencies
- none

## Verification Plan
- Command: `cd packages/spec && node --test bin/__tests__/agent-authority.test.js bin/__tests__/codex-native.test.js`
- Named probe: test `read-only agents declare no memory or write tools` và `inspector forbids reading secrets` trong `agent-authority.test.js`; `codex-native.test.js` (45 test) giữ hồi quy TOML.
- Reachability: chạy từ `packages/spec` bằng node hiện có.
- Oracle: exit 0, mọi test pass, số test > 0.
- Counterexample: còn `memory:` ở một agent hoặc thiếu dòng cấm secrets → test đỏ.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: cd packages/spec && node --test bin/__tests__/agent-authority.test.js bin/__tests__/codex-native.test.js
Exit: 0
Base: 1cc7ace2233856eef284eccf0e582d5d6a136d86
Head: b5b647123a2024a9b5321be7901749929a3adda750ada1a524cc127d664ad3f9
```text
$ cd packages/spec && node --test bin/__tests__/agent-authority.test.js bin/__tests__/codex-native.test.js
✔ read-only agents declare no memory or write tools (2.623375ms)
✔ inspector forbids reading secrets (0.345417ms)
ℹ tests 47
ℹ suites 0
ℹ pass 47
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 26065.624125
```
Pre-change run: the same command failed with `researcher declares memory:` and the missing inspector secrets line. Review: code-auditor PASS (0 Critical/High/Medium; Low: stale `plugins/cf/agents/*` copies belong to `specs/claude-plugin`).
