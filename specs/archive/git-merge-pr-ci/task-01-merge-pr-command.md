# Task 01 — Lệnh `merge-pr` trong cf:git

Status: done

## Outcome
`cf:git` có lệnh `merge-pr <PR>`; dòng lệnh trong SKILL.md chứa luật then chốt của D-01..D-05 (vì lượt chạy có thể không đọc được reference), `references/merge-pr.md` chứa các bước chi tiết; pin chặn mọi bản làm yếu.

## Scope
- In: một dòng `merge-pr` trong `## Commands` của `packages/spec/src/claude/skills/git/SKILL.md` (cổng, `--match-head-commit`, `--auto` khi chờ, `--disable-auto` khi dừng, chờ `MERGED`, theo dõi CI không báo xanh khi không có run, CI đỏ → báo và chỉ `cf:fix`, không `--admin`/`--force`, chỉ chạy khi được gọi tên); `argument-hint` thêm `merge-pr <PR>`; mục `## References` thêm `references/merge-pr.md`; file mới `references/merge-pr.md` (bash 3.2, `gh` thuần, bảng lỗi gồm "Auto merge is not allowed"); pin trong khối `GIT_SKILL_PINS`.
- Out: menu mặc định (giữ nguyên); `description:`/`when_to_use:`; mục Out of scope của `plan.md`.

## Coverage
- CP-01

## Ownership
- Modify: `packages/spec/src/claude/skills/git/SKILL.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Create: `packages/spec/src/claude/skills/git/references/merge-pr.md`
- Read: `packages/spec/scripts/weaken-git-pins.sh`, `~/Desktop/cfk-ref/.claude/skills/ak-git/references/workflow-merge-pr.md`

## Steps
1. Thêm pin vào `GIT_SKILL_PINS` (`run-skill-self-tests.mjs:3855-4098`): `includes` cho từng luật D-01..D-05 ở SKILL.md và reference; `excludes`/`forbid` để `merge-pr` không vào menu mặc định, không có `gh pr merge[^\n]*--admin`, không có `--force`, không có `$[0-9]`/`$ARGUMENTS` trong reference (như các reference khác ở `:4041`, `:4060`). Chạy Command → đỏ.
2. Viết `references/merge-pr.md` theo D-02..D-05, mốc thời gian bằng `SECONDS`, không dùng `timeout`.
3. Thêm dòng `merge-pr`, `argument-hint`, mục References trong SKILL.md.
4. Chạy lại Command → xanh, cả `weaken-git-pins.sh` cho thấy mỗi pin mới chuyển đỏ khi bị gỡ.

## Acceptance
- AC-01: self-test xanh; `weaken-git-pins.sh` báo mọi pin mới đều bị bắt.

## Dependencies
- none

## Verification Plan
- Command: `node packages/spec/scripts/run-skill-self-tests.mjs && bash packages/spec/scripts/weaken-git-pins.sh`
- Named probe: các pin `merge-pr` mới trong `GIT_SKILL_PINS`; `weaken-git-pins.sh` gỡ từng pin.
- Reachability: self-test đọc thẳng `packages/spec/src/claude/skills/git/`.
- Oracle: exit 0, `[skill-test] PASS`, `weaken-git-pins.sh` không báo pin nào sống sót khi bị gỡ.
- Counterexample: SKILL.md thiếu cổng hoặc thiếu `--match-head-commit`, hoặc reference có `--admin` → pin đỏ.
- Artifacts: ephemeral.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node packages/spec/scripts/run-skill-self-tests.mjs && bash packages/spec/scripts/weaken-git-pins.sh
Exit: 0
Base: 5a29e898843c4aa425ee6daf82a1654d2c070b9f
Head: c4e964170d600e21c43901bd6e9e21bba5f10bd611f76d00b0245f95559ee111
```text
$ node packages/spec/scripts/run-skill-self-tests.mjs && bash packages/spec/scripts/weaken-git-pins.sh
[skill-test] PASS: 2320 tests executed
weaken-git-pins: unweakened pass, 123/123 weakened copies fail
```
Rerun at the final Head of the feature. Pre-change run: `[FAIL] cf:git merge-pr runs only when named and passes the readiness gate before merging: src/claude/skills/git/SKILL.md`. Every ```bash block of `references/merge-pr.md` passes `/bin/bash -n` (bash 3.2). Review: code-auditor PASS after three repair rounds (per-command polls under 480 s with a carried T0; run loop resets RESULT per run; "$METHOD"; MERGE_SHA guarded so `--commit ""` cannot list old green runs; required-check buckets read as exact lines). Lows left: an empty run list in the watch block prints only elapsed; the 1800 s watch limit lives in prose.
