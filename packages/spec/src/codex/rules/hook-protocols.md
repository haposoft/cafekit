# Hook Protocols

Hooks are instruction boundaries. Do not bypass or work around them.

## Privacy Block Hook

Codex cannot pause a blocked tool call for an interactive permission question.
CafeKit denies sensitive access and offers a short reply and an exact fallback
phrase. A grant is reusable for one hour in the same session for exactly the
approved paths; it is not tied to a tool.

Required flow:

1. Stop the blocked access and show the user the hook's reason.
2. Ask one privacy question as the only question at the end of the turn, naming
   exactly the files shown in the denial. Do not add any other yes/no question.
3. Explain that the user's very next message may be `y`, `yes`, or `có` only
   while exactly one request is pending; any other reply cancels the shortcut.
   The exact `APPROVE CAFEKIT PRIVACY <id>` prompt remains the fallback.
4. Never send, repeat as a user message, or simulate either a short approval or
   the exact fallback phrase. Wait for a real user prompt and the approval hook.
5. After approval, tell the user which paths were just granted before reading
   them. Access only those exact paths during the one-hour session grant.

Never use another command, path, encoding, subprocess, or side channel to read a
privacy-blocked file without that explicit approval.

## State And Spec Hooks

- If a hook reports state drift, run the appropriate sync or audit flow before continuing.
- If a hook rejects task completion, keep the task `in_progress` or `blocked` until proof exists.
- Do not mark a task `done` unless the matching task file contains a valid verification receipt.
- Read `state-sync.md` for the receipt contract.

## Hook Failure Handling

- Treat hook errors as blockers when they affect safety, privacy, or task state.
- Record the blocker in the task or spec state when relevant.
- If hook output is malformed, stop and report the exact failure instead of guessing.
