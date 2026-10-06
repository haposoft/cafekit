# Capability dispatch patterns

Load this optional reference only when a task benefits from independent
inspection, implementation, verification, review, or docs capability. Runtime
role names are configuration, not workflow policy.

## Task-local dispatch brief

Build the brief from current bytes after loading the plan index once. Include only:

- the task's referenced coverage-profile rows;
- Outcome, Scope, Ownership, Acceptance, Dependencies, and Verification Plan;
- owned code, its entrypoints/consumers, and explicit exclusions;
- work context plus reports/plans paths, stop conditions, and handoff format.

Do not forward unrelated plan rows, sibling task bodies, ambient repository
history, old proof, or a full session transcript. Reread the active task before
mutation and after sync; a current-byte mismatch returns to the controller.

Use one capability per concrete responsibility. The runtime may map it to an
available local role, but that mapping cannot add scope or weaken proof.

## Independence and ownership

- Inspection traces entrypoints and risks without editing source.
- Implementation edits only granted paths and does not write task state.
- Verification is the sole producer of executable proof.
- Review consumes proof and reports findings without claiming execution.
- Documentation starts only after a real docs-impact decision.
- The controller alone writes Status and inline Receipt.

Implementation/worker handoff contains changed paths and owned diff plus, when
parallel, branch/worktree/Base/Head/complete range and owned-path-tree metadata.
Verification handoff separately contains the fresh command, exit, named probes,
counts, output, and observed Head. Neither handoff is itself an inline Receipt;
only the controller may validate and synchronize it.

A specific-task invocation ends after that task. Full-feature execution may
continue only after the current task is synchronized and the next dependency
set is recomputed.

## Safe fallback

If a required capability or isolated workspace is unavailable, record BLOCKED
or run only a permitted main-session check. Never silently substitute an actor
for an independence requirement. A PENDING, BLOCKED, or provenance-free result
cannot be normalized to PASS.

After interruption, preserve the owned diff but discard ephemeral handoffs and
remembered proof. Do not tell an implementation worker to repeat a non-idempotent
action blindly; scope the resumed brief to unmet Acceptance and require fresh
verification. Concurrent invocations remain unsupported, so drift blocks handoff.

## Legacy workflow compatibility

When the selected packet is legacy, include its persisted lane snapshot and
obligations in the dispatch, but do not let workers edit that state or infer an
independent result from a role label.
