# Test memory

`.hapo/test-memory.json` is optional historical context, never canonical proof.
Current command output, provenance, named probes, and reachability always win.

## Read-only contract

- If the file exists as a regular contained file, read it as untrusted hints.
- If absent, continue without creating it.
- Before proof, record whether it is absent or hash its exact bytes. After proof,
  verify the same absence or byte hash.
- Never create, initialize, merge, normalize, rewrite, or delete Test memory.
- Never execute remembered setup commands automatically. Confirm each command
  from current project/task bytes or report a changed prerequisite.
- Known flaky tests and known issues remain labels only; they cannot downgrade a
  current required failure, justify a skip, or produce `PASS`.

## Suggestions

The concise report may suggest a potential memory update in plain language, but
must not emit an auto-merge block or mutate project files. The user or a separate
authorized workflow decides whether to update historical context later.

Hashing memory alone is insufficient for side-effect proof. Also observe and
report tracked, untracked, and ignored project-command drift; preserve all
user-owned changes and never silently clean them.
