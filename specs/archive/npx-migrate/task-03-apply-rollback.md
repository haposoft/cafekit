# Task 03 — Apply with backup, lock and rollback

Status: done

## Outcome
`applyMigration(projectRoot, options)` executes exactly the planned actions of task-01 and task-02 and, on any failure or interruption, puts every touched path back.

## Scope
- In (order per D-05):
  - Refuse unless `realpath(process.cwd()) === realpath(projectRoot)` (`backup.js` and `lock.js` resolve paths from the cwd); refuse a plan marked `refused`.
  - Acquire `.cafekit.lock` atomically: change `lock.acquire` to create the file with flag `wx`; reclaim a stale lock by writing a unique temp file with `wx` and renaming it over the lock only when the lock still holds the dead pid just read, then re-reading to confirm ownership (`packages/spec/bin/lib/lock.js:41-61`).
  - `backup.snapshot` every top-level target the plan touches; re-plan and refuse if the new plan differs from the one given; before each unlink re-check `lstat` (not a symlink) and the hash.
  - Remove files, write merged files atomically, remove `cafekit.json`/`cafekit-manifest.json` last, then remove folders left empty (never a folder holding a kept file).
  - On any error or SIGINT: `backup.restore`; change `restore` to continue past a failing target, collect the errors, and return them so the caller prints the backup folder and the manual steps (`packages/spec/bin/lib/backup.js:116-144`); then exit non-zero.
  - File-system calls of apply and of `backup.restore` go through an injectable `fs` (options.fs) so a test can fail the Nth write of apply or one target of the restore.
- Out: the CLI; pruning backups beyond `backup.prune`.

## Coverage
- CP-03

## Ownership
- Create: `packages/spec/bin/lib/migrate-apply.js`
- Modify: `packages/spec/bin/lib/lock.js`
- Modify: `packages/spec/bin/lib/backup.js`
- Create: `packages/spec/bin/__tests__/migrate-apply.test.js`
- Read: `packages/spec/bin/lib/migrate-plan.js`, `packages/spec/bin/lib/migrate-merged.js`

## Steps
1. Fix the lock and restore, write the apply module.
2. Test by spawning a child process whose cwd is the temp repo (never the cafekit checkout).

## Acceptance
- AC-03: after apply every planned removal is gone and every kept path has its pre-run sha256; merged files equal their planned contents; a backup holds the pre-run bytes; a second plan has no `remove`; with the injected fs failing the 5th write, the exit is non-zero and the tree hash excluding `.cafekit-backup/` and `.cafekit.lock` equals the pre-run hash; with the injected fs also failing one restore target, every other target is still restored and the failed one is reported with the backup folder; a SIGINT sent mid-apply (slowed injected fs) restores the same way; a plan made stale by editing a planned file is refused; running from another cwd is refused; two concurrent `acquire` calls never both succeed, also when both reclaim the same stale lock; existing installer tests still pass.

## Dependencies
- task-02-plan-merged-files.md

## Verification Plan
- Command: `node --test packages/spec/bin/__tests__/migrate-apply.test.js && node --test packages/spec/bin/__tests__/*.test.js`
- Named probe: `migrate-apply.test.js` (apply-removes-planned, kept-bytes-equal, merged-match-plan, backup-holds-pre-run, second-run-nothing, injected-failure-restores, restore-continues-past-failure, sigint-restores, stale-plan-refused, wrong-cwd-refused, lock-exclusive, stale-lock-exclusive).
- Reachability: source — `applyMigration` in a child process with the temp repo as cwd.
- Oracle: sha256 per path; tree hash excluding the backup and lock; exit codes.
- Counterexample: restore that stops at the first failing target, or no re-check before unlink → `restore-continues-past-failure` or `stale-plan-refused` red.
- Artifacts: ephemeral temp repos, removed in `after`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt

Verification: PASS
Command: node --test packages/spec/bin/__tests__/migrate-apply.test.js && node --test packages/spec/bin/__tests__/*.test.js
Exit: 0
Base: 32ef63d6daf052d6bb6e938e73714e8930f70f88
Head: de24c4764f214476925303804e5bc286001c18c47250a2840c6aff615c44be4c
```text
$ node --test packages/spec/bin/__tests__/migrate-apply.test.js && node --test packages/spec/bin/__tests__/*.test.js
▶ apply-removes-planned, kept-bytes-equal, merged-match-plan, backup-holds-pre-run, second-run-nothing
  ✔ apply-removes-planned (0.967166ms)
  ✔ kept-bytes-equal (10.404292ms)
  ✔ merged-match-plan (0.218ms)
  ✔ backup-holds-pre-run (11.030416ms)
  ✔ second-run-nothing (200.7785ms)
✔ apply-removes-planned, kept-bytes-equal, merged-match-plan, backup-holds-pre-run, second-run-nothing (742.532416ms)
✔ injected-failure-restores: a failed fifth write puts every byte back (643.006084ms)
✔ temp-file-cleaned: a failed rename of a root-level merged file leaves no temp file behind (634.449667ms)
✔ partial-temp-cleaned: a temp file created but not fully written is removed too (628.072334ms)
✔ merged-keeps-mode: a rewritten merged file keeps its permissions (483.145084ms)
✔ restore-continues-past-failure: one target that cannot be restored does not stop the others (543.858333ms)
✔ sigint-restores: an interrupt mid-apply puts every byte back (706.730917ms)
✔ stale-plan-refused: a planned file edited after the plan stops apply before any change (597.761375ms)
✔ stale-during-apply-refused: a planned file edited while apply runs is caught by the per-file re-check (685.425167ms)
✔ wrong-cwd-refused: apply from another directory changes nothing (334.219875ms)
✔ lock-exclusive: two concurrent acquires never both succeed (3628.892625ms)
✔ stale-lock-exclusive: two runs reclaiming the same stale lock never both succeed (4621.657667ms)
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 15884.3245
[… 1599 lines of the full bin/__tests__ run elided …]
ℹ tests 1566
ℹ suites 0
ℹ pass 1566
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 134204.784041
EXIT=0
```

Reachability: source — `applyMigration` in a child process whose cwd is a temp repo holding a real npx 0.18.2 install (`--platform claude,codex`, temp HOME); `lock.acquire` raced from two child processes.
Negative proof: in-place mutations (files restored, sha256 checked) — restore stopping at the first failing target reds `restore-continues-past-failure`; no per-file re-check reds `stale-during-apply-refused`; reclaim without the guard reds `stale-lock-exclusive`; a non-atomic acquire reds `lock-exclusive`; no temp cleanup reds `temp-file-cleaned`; cleanup only after a complete write reds `partial-temp-cleaned`; dropping the mode reds `merged-keeps-mode`; a plain `wx` lock create, no hard-link fallback, or no `written` guard each reds `stale-lock-exclusive`.
Review: code-auditor round 1 FAIL (Critical: temp file of a root-level merged write leaked on failure), round 2 PASS_WITH_WARNINGS (Medium: hard links required, breaking the installer on exFAT/vboxsf), round 3 FAIL (Critical: a partial temp write leaked), round 4 PASS_WITH_WARNINGS (whole-target rollback, D-04 metadata) — Bro decided both and authorized one extra round (lock temp-write ENOSPC), round 5 PASS.
Deviation: the stale-lock reclaim uses a `.cafekit.lock.reclaim` guard created exclusively instead of the plan's temp-file rename, because check-then-rename lets two reclaimers both confirm ownership; locks and guards are created by hard-linking a fully written temp file (plain `wx` where links are unsupported). Added probes: `stale-during-apply-refused`, `temp-file-cleaned`, `partial-temp-cleaned`, `merged-keeps-mode`.
Limitations (accepted or recorded): on failure the snapshot of each touched top-level target is restored whole, so edits made there while apply ran are reverted (message says so; Bro accepted); `cafekit.json`/`cafekit-manifest.json` stay while `runtime.json` stays (D-04 revised); SIGTERM/SIGHUP/SIGKILL mid-apply are not handled; a guard left by a killed reclaimer must be deleted by hand; filesystems without hard links have a brief empty-lock window; rename does not keep uid/gid/xattr; removed empty folders are not listed by the dry-run.
