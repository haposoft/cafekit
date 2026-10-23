# Subagent orchestration in the vibe pipeline

The vibe controller owns interpretation, taste, and every gate. Subagents add speed and fresh context; they own no decision, and they never receive the decisions the vibe-run exception delegates to the controller. Give each subagent the files, the acceptance criteria, and the constraints it needs, because it has no conversation history.

## When to fan out

Fan out only across independent slices that can run at the same time.

- Fresh-context reads with no write contention: research, debugging, code-review waves (including `--ultra`), test analysis, and `--advice` counsel. They are read-only or write isolated artifacts, so they parallelize freely and avoid one agent grading its own work.
- Independent implementation slices: only when each slice owns a disjoint set of files. For multi-file writes, use worktree isolation as `cf:develop --parallel` describes.

## Safety rules

1. Disjoint file ownership: two concurrent writers in one worktree must never touch the same file. Partition by file or module before dispatch.
2. Serialize the shared boundary: name one owner for a shared schema, export, or config and serialize that one mutation.
3. Contracts up front: freeze cross-slice interfaces before the fan-out.
4. Separate checks: delegates run focused checks on stable owned inputs; the controller runs shared build, lint, and full-suite jobs after the wave rejoins.
5. Scoped mutation: delegates edit only their own files; the controller stages and commits through `cf:git commit`.
6. Cap concurrency at what the runtime allows; the excess only queues.

## Reconvene

After each wave, collect the results, inspect the touched files, run the narrowest affected check, and only then advance. Reuse a result for unchanged inputs; invalidate it after an edit.
