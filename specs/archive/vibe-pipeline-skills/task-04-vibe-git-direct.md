# Task 04 — Vibe: không tự chạy `git commit`/`gh pr create`; nhãn báo cáo bằng tiếng Anh

Status: done

## Outcome
`vibe/SKILL.md` (nguồn, bản cài Claude và Codex, plugin) có hai câu D-05 trong đoạn đầu `## Pipeline`: không tự chạy `git commit` hay `gh pr create` kể cả sau khi đọc cách `cf:git` làm, để `cf:git commit` và `cf:git pr` chạy vì chúng mang bước quét secret, luật không attribution và kiểm commit range; nhãn `Plan:`, `Implement:`, `skipped` viết bằng tiếng Anh dù báo cáo bằng ngôn ngữ nào.

## Scope
- In: hai câu D-05; test ghim; build plugin.
- Out: hook hay kiểm tra máy; sửa `git/SKILL.md`; nới thước `ghi-*`.

## Coverage
- CP-02

## Ownership
- Modify: `packages/spec/src/claude/skills/vibe/SKILL.md`, `packages/spec/bin/__tests__/vibe-skill.test.js`, `plugins/cf/skills/vibe/**` (do `build-claude-plugin.mjs` sinh)
- Read: `packages/spec/bin/lib/codex-install.js:292-300`, `packages/spec/bin/__tests__/vibe-skill.test.js:430-438` (từ cấm), `packages/spec/bin/__tests__/vibe-run.test.js:85` (`GATE_PATTERNS`)

## Steps
1. Sửa test trước: ghim nguyên hai câu D-05 trong đoạn đầu `## Pipeline`; bản cài Codex có `cf-git commit` và `cf-git pr` trong câu đó; không có cụm "read" kiểu cấm đọc skill.
2. Chạy Verification Plan; phải đỏ.
3. Thêm hai câu; `node packages/spec/scripts/build-claude-plugin.mjs`.
4. Chạy Verification Plan; phải xanh; `vibe/SKILL.md` ≤ 70 dòng; không cụm nào trong 7 `GATE_PATTERNS`.

## Acceptance
- AC-04: Command thoát 0; self-test PASS ≥ 2476.

## Dependencies
- task-02-vibe-shortcut-rule.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs`
- Named probe: `vibe-skill.test.js` (hai câu D-05, bản cài Codex), `build-claude-plugin.mjs --check`.
- Reachability: installer chép skill cho Claude và Codex; `scaffold.sh:65` cài từ nguồn hiện tại cho task-05.
- Oracle: `fail 0`, `--check` thoát 0, self-test `PASS` ≥ 2476.
- Counterexample: trên bản sao `spec-copy`, bỏ câu "Never run `git commit` or `gh pr create` yourself…" thì `vibe-skill.test.js` đỏ.
- Artifacts: `plugins/cf/skills/vibe/**` sinh lại.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs
Exit: 0
Base: b6d8988827e59241b623276d4b915aab449e6ece
Head: cc3de7b43d82ae25b16c38df5e8e8451d30e88460a2d529d3df7e6b1c4a41828
```text
$ node --test packages/spec/bin/__tests__/vibe-skill.test.js packages/spec/bin/__tests__/vibe-run.test.js packages/spec/bin/__tests__/claude-plugin-build.test.js && node packages/spec/scripts/build-claude-plugin.mjs --check && node packages/spec/scripts/run-skill-self-tests.mjs
# trích từ plans/20261026-vibe-pipeline-task04.log (2124 dòng): tổng đoạn node --test, dòng --check, tổng Node tests trong self-test, dòng PASS
ℹ tests 110
ℹ pass 110
ℹ fail 0
plugin tree matches a fresh build: /Users/nghialuutrung/Desktop/cafekit/plugins/cf
ℹ tests 1340
ℹ pass 1340
ℹ fail 0
ℹ tests 302
ℹ pass 302
ℹ fail 0
ℹ tests 42
ℹ pass 42
ℹ fail 0
[skill-test] PASS: 2492 tests executed
exit=0
```
Trước sửa nguồn: 3 ca mới đỏ (55/58). Review 1: FAIL — câu D-05 đầu tiên ("Never run … `gh pr create` yourself") mâu thuẫn với PR promotion của `--both` (`vibe/SKILL.md:53`) và trên Codex cấm cách dùng skill; Bro chọn câu trung lập host kèm ngoại lệ `--both` (D-05 đã sửa). Câu hiện tại ở cuối đoạn đầu `## Pipeline`: chỉ chạy `git commit`/`gh pr create` như bước của `cf:git commit`/`cf:git pr` (ngoại lệ PR promotion `--both`), kèm lý do; nhãn `Plan:`/`Implement:`/`skipped` bằng tiếng Anh. Test mới: mọi `gh pr create` trong `vibe/SKILL.md` là ngoại lệ đã nêu; bản cài Codex có `cf-git commit`/`cf-git pr`. `SKILL.md` 69 dòng; plugin build lại. Phản ví dụ trên bản sao `/private/tmp/claude-501/-Users-nghialuutrung-Desktop-cafekit/6f6d5ffe-c62e-41e8-85ff-509f9fd60e5e/scratchpad/spec-copy/spec` bỏ câu mới: `vibe-skill.test.js` pass 57 / fail 2. Review 2: PASS. Lượt chạy trên câu cũ được giữ ở `plans/20261026-vibe-pipeline-task04-old-wording.log`, không làm bằng chứng. Self-test chạy trên cây có thay đổi chưa commit của gói song song `codex-plugin`. Giới hạn: một lượt đọc kỹ `git/SKILL.md` rồi làm đủ bước (kể cả helper quét) mà không gọi Skill vẫn bị `pipeline.mjs` chấm trượt `cf-git-commit` — đánh đổi để câu đúng trên Codex; test ghim câu gần nguyên văn.
