# Parallel waves — `cf:develop --parallel`

Load this reference only for explicit parallel execution. The goal is bounded concurrency with immutable provenance and one state writer.

## Preconditions

1. Confirm Git and isolated worktree support; otherwise state why and fall back to the sequential loop.
2. Respect `.claude/runtime.json` `develop.parallel: false` when present.
3. Clamp `--parallel N` to 1..5; default to 3.
4. Require a clean destination; record exact `base_sha` and stop on incompatible bases.
5. Confirm consent for worker commits and controller cherry-picks before creating worktrees.

Range facts belong only in controller handoff metadata, never the inline Receipt:

```text
base_sha: <destination commit before dispatch>
head_sha: <worker commit at handoff>
branch: <worker branch>
worktree_path: <isolated worktree>
commit_range: <base_sha>..<head_sha>
retention: retained|released
cleanup_authorization: pending|explicit-discard|merged-release
```

The final inline Receipt instead receives fresh runtime Base/Head, exact command, exit, and output after integration; handoff metadata cannot substitute for it.

## Build and dispatch a wave

Read dependencies from the plan table and each task. A candidate is ready only when every named dependency is `done` with a valid current Receipt.
Add tasks in plan order up to the cap. Exclude normalized path overlap or a shared mutable registry, lockfile, manifest, generated output, migration, or export barrel.
Uncertain overlap is a conflict. One file has one writer per wave.

Each worker receives the complete task-local brief from `subagent-patterns.md`, exact owned paths, worktree, acceptance, proof command, and these constraints:

1. Edit only granted paths in the assigned worktree; never undo another worker.
2. Do not edit `plan.md`, Status, or `## Receipt`; only the controller writes state/proof.
3. Report exact precheck commands/exits; commit only with user authorization.
4. Return status plus branch, worktree, Base, Head, complete range, owned-path tree, and retention.

A blocked or failed worker keeps its identifiable worktree and branch. Never
force-delete it without merge success or explicit discard authorization.

## Prove the full handoff

Before integration, enumerate every commit with `git rev-list --reverse <base_sha>..<head_sha>`
and the complete changed tree with `git diff --name-status <base_sha>..<head_sha>`.
Reject an empty, discontinuous, partial, or base-incompatible range; duplicate/missing commits; and every path outside Ownership.
Test/review the complete immutable range through `quality-gate.md`; unresolved High/Critical findings block that task.

## Integrate sequentially

In plan order, apply every enumerated worker commit, in range order:

```bash
git cherry-pick <next-worker-commit>
```

After each pick, verify the destination contains that source commit's patch. After the last, compare the integrated owned-path tree with the worker tree.
Any missing/extra commit or path stops before post-merge proof. On conflict, abort the pick, block that task, and retain its branch/worktree.
Release only after recording `cleanup_authorization: merged-release` in handoff metadata.

## Post-merge proof

Only after complete range/tree integration, run the affected integration command
against the fresh runtime Base/Head. Failure blocks the next wave; classify it as
`baseline`, `environment`, `spec`, or `code`. Do not blind-retry: code/spec repair
creates a new commit and repeats the full range/tree audit; other classes remain blockers.

After the final wave, run feature integration and reachability proof. The controller
then writes inline Receipts and Status one task at a time. Worker reports and range
metadata are inputs, not completion authority; incomplete workers cannot be hidden
by successful siblings.
