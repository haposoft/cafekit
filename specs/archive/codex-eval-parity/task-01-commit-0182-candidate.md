# Task 01 — Ứng viên 0.18.2 nằm trong commit cục bộ, đủ file, test xanh

Status: done

## Outcome
Thay đổi chưa commit của ứng viên 0.18.2 dưới `packages/` và `docs/` (gồm 4 file mới chưa được git theo dõi, trong đó có `packages/spec/src/codex/hooks/lib/spec-session-touch.cjs`) và 6 fixture `provenance.cjs` dưới `evals/` nằm trong commit cục bộ trên `dev`, chưa push.

## Scope
- In: xác định file thuộc ứng viên bằng bảng `sha256` trong `plans/20261008-codex-regrade/cells-all.json` (bytes phải khớp); stage theo đường dẫn tường minh `git add -- packages evals docs`; conventional commit, không ghi tên AI.
- Out: `git add -A`, `git commit -a`; `AGENTS.md`, `CLAUDE.md` (Bro quyết để ngoài commit); `specs/`, `plans/`; push, publish, tag; sửa nội dung file.

## Coverage
- CP-01

## Ownership
- Modify: không sửa nội dung; chỉ stage và commit file dưới `packages/`, `evals/`, `docs/`.
- Read: `plans/20261008-codex-regrade/cells-all.json`

## Steps
1. So bytes mọi file thay đổi dưới `packages/`, `evals/`, `docs/` với bảng `sha256` → mọi file thuộc bảng đều khớp; file ngoài bảng (README, CHANGELOG) liệt kê riêng.
2. Chạy self-test và node test → xanh.
3. `git add -- packages evals docs` rồi commit → porcelain sạch dưới ba thư mục đó, `AGENTS.md`/`CLAUDE.md` vẫn là thay đổi chưa commit.

## Acceptance
- AC-01: porcelain (kể cả file chưa theo dõi) sạch dưới `packages`, `evals`, `docs`; HEAD khác `4128698a`; `AGENTS.md`/`CLAUDE.md` không nằm trong commit mới; self-test và node test xanh; chưa push.

## Dependencies
- none

## Verification Plan
- Command: `test -z "$(git status --porcelain --untracked-files=all -- packages evals docs)" && test "$(git rev-parse --short=8 HEAD)" != 4128698a && ! git diff --name-only 4128698a HEAD | grep -qE '^(AGENTS|CLAUDE)\.md$' && pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js`
- Named probe: `[skill-test] PASS` của self-test; `# fail 0` của node test.
- Reachability: chạy từ gốc repo bằng bash, ngay sau commit của task này (trước khi task 02 tạo `evals/codex/`).
- Oracle: exit 0.
- Counterexample: bỏ sót `spec-session-touch.cjs` khỏi commit → porcelain còn `??` → exit 1.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: test -z "$(git status --porcelain --untracked-files=all -- packages evals docs)" && test "$(git rev-parse --short=8 HEAD)" != 4128698a && ! git diff --name-only 4128698a HEAD | grep -qE '^(AGENTS|CLAUDE)\.md$' && pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/*.test.js packages/spec/src/claude/hooks/__tests__/*.test.js
Exit: 0
Base: ffea5cb2973f7e2f6be1f969594ce77d861f4d84
Head: 27548e24211f1101e83cc8a0f53663503a0df7772c6e3d5db7854f7e359246f4
```text
$ <Command ở trên>
# pass 42
# fail 0
[skill-test] PASS: 1387 tests executed
# tests 559
# pass 559
# fail 0
exit=0
$ git log --oneline 4128698a..HEAD
ffea5cb2 fix(spec): prepare 0.18.2 Codex runtime candidate
$ (kiểm bytes so bảng sha256 cells-all.json)
{"files":30,"inMap":26,"match":26,"mismatch":[],"outsideMap":["docs/installer-architecture.md","docs/project-changelog.md","packages/spec/CHANGELOG.md","packages/spec/README.md"]}
```

Review (phiên Claude): 30 file đúng ứng viên + 6 fixture; 26/26 bytes khớp bảng vân tay, 4 file ngoài bảng là docs/CHANGELOG/README; không có AGENTS.md/CLAUDE.md; không ghi tên AI; chưa push. Thực thi: pane Codex.
