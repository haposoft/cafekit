# Hook Protocols

Hooks are instruction boundaries. Do not bypass or work around them.

## Privacy Block Hook

When a tool call touches a sensitive file, or the hook cannot classify it safely,
the privacy hook returns a permission decision of `ask` with the reason, and the
host asks the user to approve or deny that one call. Do not ask again yourself.
On a host whose hook can only deny, the call is blocked; ask the user instead of
retrying it another way.

- If approved, the call runs; do not widen it to other files.
- If denied, continue without reading that file or performing that blocked action.

Never use another command, path, encoding, or side channel to access a privacy-blocked file without explicit approval.

## State And Spec Hooks

- If a hook reports state drift, run the appropriate sync/audit flow before continuing.
- If a hook rejects task completion, keep the task `in_progress` or `blocked` until proof exists; the receipt contract lives in `state-sync.md`.

## Hook Failure Handling

- Treat hook errors as blockers when they affect safety, privacy, or task state.
- Record the blocker in the task/spec state when relevant.
- If the hook output is malformed, stop and ask for clarification instead of guessing.

