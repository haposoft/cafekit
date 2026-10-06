# Finish Branch Protocol

Use this protocol for `cf:git finish`.

## Goal

Finish the current branch deliberately. Do not assume the user wants merge, push, PR, keep, or discard.

## Step 1: Inspect Current State

Run:

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --short
git worktree list
```

Identify:

- current branch
- whether this is a linked worktree
- uncommitted changes
- upstream tracking branch
- likely target branch (`main`, `develop`, or user-provided target)

## Step 2: Verify Before Finish

Before any merge/push/PR/discard recommendation, run the task-required verification or the repository default checks. If verification is not available, report `NO_TESTS` / `UNVERIFIED` honestly.

Never claim a branch is ready from stale output.

## Step 3: Present Finish Options

Offer explicit options:

1. **Merge locally** — merge current branch into target branch.
2. **Push / PR** — push current branch and create or update a pull request.
3. **Keep** — leave branch/worktree as-is for later work.
4. **Discard** — delete branch/worktree only after explicit typed confirmation.

Do not select an option silently unless the user already requested it.

## Step 4: Safety Rules

- Never force-push by default.
- Never delete a branch with unmerged commits without typed confirmation.
- Never remove a worktree you did not create or cannot identify.
- Never discard uncommitted changes without explicit typed confirmation.
- If verification fails, recommend fix/retest before merge or PR.

## Step 5: Completion Report

Report:

- branch and target
- chosen finish action
- verification commands and result
- commit/push/PR result
- remaining risks or unresolved questions
