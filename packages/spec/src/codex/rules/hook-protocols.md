# Hook Protocols

Hooks are instruction boundaries. Do not bypass or work around them.

## Privacy Block Hook

Codex cannot pause a blocked tool call for an interactive permission question.
CafeKit therefore denies the sensitive access and emits one exact approval
phrase tied to the current session, requested path, tool, and expiry.

Required flow:

1. Stop the blocked access and show the user the hook's reason.
2. Ask the user to send the exact approval phrase if they want one retry.
3. Do not write, repeat as a user message, or otherwise simulate that phrase.
4. Retry only after a later real user prompt exactly matches it.
5. Use the resulting token once, only for the originally blocked operation.

Never use another command, path, encoding, subprocess, or side channel to read a
privacy-blocked file without that explicit approval.

## State And Spec Hooks

- If a hook reports state drift, run the appropriate sync or audit flow before continuing.
- If a hook rejects task completion, keep the task `in_progress` or `blocked` until proof exists.
- Do not mark a task `done` unless the matching task file contains a valid verification receipt.

## Hook Failure Handling

- Treat hook errors as blockers when they affect safety, privacy, or task state.
- Record the blocker in the task or spec state when relevant.
- If hook output is malformed, stop and report the exact failure instead of guessing.
