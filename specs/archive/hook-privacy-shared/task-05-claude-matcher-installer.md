# Task 05 — Matcher Claude có NotebookEdit, mcp__.*; installer cập nhật matcher

Status: done

## Outcome
Hook privacy và inspect chạy cho `NotebookEdit` và tool MCP trên Claude. Chạy lại installer thì bản cài cũ (kể cả bản có entry bị tách hay còn `inspector-block.cjs`) được đổi sang matcher mới. Entry của người dùng giữ nguyên.

## Scope
- In:
  - D-07 (plan.md): matcher PreToolUse trong template; `.claude/hooks/inspector-block.cjs` vào `settingsHookCommandSubstrings`;
  - `FORMER_MATCHERS` và hàm cập nhật trong `claude-settings.js`, chạy sau `pruneObsoleteSettingsHooks` và trước bước gộp, tôn trọng dry-run;
  - test mới; một dòng changelog ở hai file changelog.
- Out: matcher PostToolUse của spec-state/state (gói 3, 4).

## Coverage
- CP-05

## Ownership
- Modify: `packages/spec/src/claude/settings/settings.json`, `packages/spec/bin/phases/claude-settings.js`, `packages/spec/src/claude/migration-manifest.json`, `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Create: `packages/spec/bin/__tests__/claude-settings.test.js`
- Read: `packages/spec/bin/phases/codex-hooks.js:27-60`, `packages/spec/bin/lib/context.js` (`PLATFORMS.claude.folder`), `packages/spec/bin/install.js:71`

## Steps
1. Viết `claude-settings.test.js` gọi `mergeClaudeSettings` với ctx giả trong thư mục tạm (chdir nếu `PLATFORMS.claude.folder` tương đối; trả lại cwd trong `finally`). Ca:
   - (a) entry chỉ có privacy + inspect, matcher `Read|Write|Edit|MultiEdit|Bash|Glob|Grep` → đổi sang matcher template, có dòng `matcher updated`;
   - (b) như (a) với `Read|Write|Edit|MultiEdit|Bash|Glob` → đổi;
   - (c) entry có thêm lệnh người dùng → giữ nguyên matcher và lệnh;
   - (d) matcher lạ (`Read|Bash`) chỉ có lệnh CafeKit → giữ nguyên;
   - (e) cài mới → có matcher template, không trùng entry;
   - (f) entry bị tách: privacy một mình dưới matcher cũ, inspect dưới matcher template → entry privacy được đổi matcher, không sinh entry trùng;
   - (g) entry cũ có `inspector-block.cjs` + `privacy-block.cjs` dưới matcher cũ → `inspector-block` bị gỡ, privacy được đổi matcher;
   - (h) dry-run với (a) → không ghi file, dòng in có tiền tố `[dry-run]`.
   Chạy Command trên code task-04: (a), (b), (f), (g), (h) phải đỏ.
2. Sửa template, manifest, installer; changelog.
3. Chạy Command; `pnpm test` ở gốc repo. Cài thử installer thật trong thư mục tạm có `git init`, chạy `node /Users/nghialuutrung/Desktop/cafekit/packages/spec/bin/install.js --platform claude -y` **từ** thư mục tạm (installer không có `--cwd`):
   - lần 1: cài mới;
   - sửa tay matcher về `Read|Write|Edit|MultiEdit|Bash|Glob|Grep`;
   - lần 2: phải in `matcher updated`, và `settings.json` có matcher template.
4. Commit đúng file Ownership (không tên AI, không mã plan, không push).

## Acceptance
- AC-05: ca (a)–(h) đúng; cài thử thật đúng như Step 3; `pnpm test` exit 0.

## Dependencies
- task-04-codex-context-and-env.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/claude-settings.test.js packages/spec/bin/__tests__/legacy-hooks-retired.test.js packages/spec/bin/__tests__/usage-hook-retired.test.js packages/spec/bin/__tests__/grok-platform.test.js packages/spec/bin/__tests__/output-styles.test.js packages/spec/bin/__tests__/package-inventory.test.js`
- Named probe: ca (a), (c), (f).
- Reachability: `mergeClaudeSettings` (`bin/phases/claude-settings.js:71`) được `install.js:71` gọi; cài thử thật ở Step 3 phủ đường gọi này.
- Oracle: exit 0, `# fail 0`, output có tên test của `claude-settings.test.js`.
- Counterexample (bản chép tạm, hoàn tác): bỏ điều kiện "mọi lệnh thuộc template" → ca (c) phải đỏ.
- Artifacts: không; xoá thư mục cài thử.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
Verification: PASS
Command: node --test packages/spec/bin/__tests__/claude-settings.test.js packages/spec/bin/__tests__/legacy-hooks-retired.test.js packages/spec/bin/__tests__/usage-hook-retired.test.js packages/spec/bin/__tests__/grok-platform.test.js packages/spec/bin/__tests__/output-styles.test.js packages/spec/bin/__tests__/package-inventory.test.js
Exit: 0
Base: 1d6c331387db622c05c3752f408df94c0c6e52f5
Head: 988dc13175e5e03f3fb16cad68c44af5680faa97a5577d1ec26930742a882694
```text
ok 1 - (a) claude-settings updates the former matcher for managed privacy and inspect
ok 3 - (c) claude-settings preserves a mixed entry with a user command
ok 6 - (f) claude-settings updates a split privacy entry without duplicate commands
ok 9 - (i) claude-settings preserves a null handler without updating the matcher
1..54
# tests 54
# suites 0
# pass 54
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 59561.116666
```

Đỏ trước khi sửa: 5 ca (a)(b)(f)(g)(h), cộng ca (i) đỏ ở vòng sửa 2. Gốc 45 test → 54. pnpm test exit 0 (PASS: 1934 tests executed). Cài thử thật trong thư mục tạm có git init (controller chạy lại): lần 1 matcher Read|Write|Edit|MultiEdit|NotebookEdit|Bash|Glob|Grep|mcp__.*; sửa tay về matcher cũ; lần 2 in 'Settings: hook PreToolUse matcher updated', còn một entry matcher template 2 lệnh; đã xoá thư mục. Counterexample: bỏ every(...) trong bộ lọc candidates → ca (c) đỏ (đã hoàn tác). Review code-auditor: FAIL vòng đầu (điều kiện lặp làm Counterexample không đỏ được), sửa 2 vòng (vòng 2 vá hồi quy hook null do controller dò ra), PASS. Low: matcher có .* nên khớp thêm TodoWrite/BashOutput/ReadMcpResourceTool (đúng D-07, chỉ tốn thêm spawn); PreToolUse là object làm bước gộp cũ ném (có từ trước); lệnh viết khác template bị giữ và privacy chạy hai lần; file inspector-block.cjs cũ còn trên đĩa. Commit 1d6c3313.
