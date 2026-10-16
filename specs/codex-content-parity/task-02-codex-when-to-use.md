# Task 02 — Codex thấy "khi nào dùng" của skill

Status: done

## Outcome
`description` Codex của mỗi skill có `when_to_use` kết thúc bằng `Use when: <when_to_use>` khi vừa 1024; catalog Codex không lặp lại.

## Scope
- In: D-02 trong `normalizeCodexBody` (`bin/lib/codex-install.js:316-356`), áp cho mọi nội dung có frontmatter `when_to_use`, không phụ thuộc `sourcePath`; ghi dòng `description:` bằng `JSON.stringify`; áp trước câu ranh giới ask (kiểm 1024 của ask giữ nguyên). `generate-skill-catalog.cjs:195` bỏ phần ` Use:` khi `description` đã chứa `when_to_use`. Changelog.
- Out: `brainstorm` (vượt 1024, giữ nguyên); nguồn Claude; eval.

## Coverage
- CP-02

## Ownership
- Modify: `bin/lib/codex-install.js` (nhánh frontmatter của `normalizeCodexBody`), `src/claude/scripts/generate-skill-catalog.cjs` (chỉ dòng nối ` Use:`), `bin/__tests__/codex-projection-parity.test.js`, hai changelog
- Read: `bin/lib/codex-frontmatter.js`, `bin/__tests__/codex-ask-projection.test.js`, `codex-research-projection.test.js`, `codex-specs-projection.test.js`, `skill-routing-source.test.js`

## Steps
1. Thêm test vào `codex-projection-parity.test.js`: cài Codex kèm document skills vào thư mục tạm; lặp trên skill đã cài: nguồn có `when_to_use` và tổng ≤ 1024 → `JSON.parse` giá trị dòng `description:` thành chuỗi kết thúc `Use when: <when_to_use>`, độ dài ≤ 1024; `brainstorm` → `description` bằng nguồn; `agent-browser`, `chrome-devtools`, `web-testing` parse được. Catalog Codex (`node .codex/scripts/generate-skill-catalog.cjs --skills` trên bản cài) có `when_to_use` của `fix` đúng một lần. Chạy Command trước khi sửa; ghi số ca đỏ.
2. Sửa; changelog.
3. Chạy Command.
4. Không commit.

## Acceptance
- AC-02: các ca đúng; Command xanh.

## Dependencies
- task-01-codex-agent-sandbox.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-research-projection.test.js packages/spec/bin/__tests__/codex-specs-projection.test.js packages/spec/bin/__tests__/skill-routing-source.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: các test mới về `Use when:`.
- Reachability: installer thật trên thư mục tạm.
- Oracle: Oracle chung của plan.
- Counterexample: ghi `description` không qua `JSON.stringify` → ca `web-testing` đỏ; nối cả `brainstorm` → ca 1024 đỏ.
- Artifacts: không.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: `node --test packages/spec/bin/__tests__/codex-projection-parity.test.js packages/spec/bin/__tests__/codex-ask-projection.test.js packages/spec/bin/__tests__/codex-research-projection.test.js packages/spec/bin/__tests__/codex-specs-projection.test.js packages/spec/bin/__tests__/skill-routing-source.test.js && node packages/spec/scripts/run-skill-self-tests.mjs`
Exit: 0
Base: f24b1fc187a4d1c40f301d23c30ee6dcd07a1cb3
Head: d3515a66bfe8308caa12e94d827ddd91c09ad7cb4bc9861cc7004f28e50f0293

```text
ok 2 - installed skill descriptions carry Use when within the routing length limit
ok 3 - brainstorm description stays unchanged when Use when exceeds the routing length limit
ok 4 - installed agent-browser description serializes Use when as a JSON string
ok 5 - installed chrome-devtools description serializes Use when as a JSON string
ok 6 - installed web-testing description serializes Use when as a JSON string
ok 7 - Codex catalog emits the fix Use when text only once
ok 8 - Use when projection applies without a source path and preserves quoted metadata
# tests 25
# pass 25
# fail 0
# skipped 0
# todo 0
[skill-test] PASS: 2137 tests executed
```

- Đỏ trước sửa (Codex báo): 5/25.
- Counterexample (Codex báo): bỏ `JSON.stringify` → ca `web-testing` đỏ; khôi phục → xanh, khớp byte.
- Review controller: phép nối áp trước câu ranh giới ask, không phụ thuộc `sourcePath`; regex thay cả dòng `description:` gập nhiều dòng; catalog chỉ bỏ ` Use:` khi description đã chứa `when_to_use`. Ba test projection ask/research/specs không đổi và xanh. Commit f24b1fc1.
