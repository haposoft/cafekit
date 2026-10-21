# Task 02 — Deployer hỏi trước khi push lúc rollback

Status: done

## Outcome
Rollback dạng git trong `deployer` tách `git revert` khỏi `git push` và yêu cầu user đồng ý rõ ràng trước khi push.

## Scope
- In: Option A ở `deployer.md:63-66`.
- Out: Option B/C (lệnh nền tảng), phần còn lại của agent.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/agents/deployer.md`, `packages/spec/bin/__tests__/agent-authority.test.js`

## Steps
1. Thêm test vào `agent-authority.test.js`: `deployer.md` không có `git push` nối sau `&&`/`;` với lệnh khác, và có câu yêu cầu user duyệt trước push → chạy, thấy đỏ.
2. Sửa Option A: `git revert HEAD --no-edit`, rồi một câu "ask the user before `git push`; never push without explicit approval".
3. Chạy lại Verification → xanh.

## Acceptance
- AC-04: không còn push vô điều kiện; có yêu cầu duyệt.

## Dependencies
- task-01-read-only-agents.md

## Verification Plan
- Command: `cd packages/spec && node --test bin/__tests__/agent-authority.test.js`
- Named probe: test deployer push trong `agent-authority.test.js`.
- Reachability: chạy từ `packages/spec`.
- Oracle: exit 0, test deployer pass.
- Counterexample: giữ nguyên `&& git push` → test đỏ.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: cd packages/spec && node --test bin/__tests__/agent-authority.test.js
Exit: 0
Base: 5031ff3197ecd69bf2c05abb1d086579b1c7b932
Head: 5f262b7b928883a8d126879dad29b1a1ab09627ee3eba9c030be94d1585e0553
```text
$ cd packages/spec && node --test bin/__tests__/agent-authority.test.js
✔ read-only agents declare no memory or write tools (0.847333ms)
✔ deployer asks before pushing a rollback (0.185125ms)
✔ inspector forbids reading secrets (0.095625ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 117.895459
```
Rerun at the final Head of the feature. Pre-change run: the same command failed `deployer asks before pushing a rollback`. Regression: `node --test bin/__tests__/develop-contract.test.js` 42/42 pass. Review: code-auditor PASS (Low: a standalone `git push` line elsewhere would slip the test; Option B/C rollback commands lack an approval line — out of scope).
