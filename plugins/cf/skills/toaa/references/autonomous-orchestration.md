# Autonomous orchestration

Load at gate 3, before the first dispatch. The orchestrator owns the brief, the plan, integration, GitHub state and final verification. Subagents own only the piece they were given and never receive the run's authority.

## Dispatch

- A piece is parallel-safe when it needs no other piece's result, touches no file another piece touches, and does not have to land in the same change as another piece. Everything else runs in dependency order.
- Every brief is self-contained: the piece's goal, the files it owns, the files it must not touch, its Done means, the verification command, the confirmed constraints, and the stop conditions from the main brief. Do not pass the whole conversation.
- Code-writing pieces get their own worktree and branch, created with `git worktree add` from the run's integration branch (not from the default branch). Read-only pieces (scouting, research, audits) may share the integration worktree.
- Subagents do not commit to the integration branch; the orchestrator integrates and commits through `cf:git commit`.

## Quota and model routing

- Check remaining account usage before each wave when the runtime exposes it. Start with a small wave (two or three subagents), widen only while usage and machine load stay comfortable, and narrow before a limit, not after one.
- Route mechanical or read-only pieces to cheaper models; keep architecture, tricky debugging and the final review on the strongest available model.
- A rate-limit or quota error pauses new dispatches; let running subagents finish, back off, then resume. It is not a reason to stop the run.

## Machine resources

- Record each process the run starts (command, PID, port, worktree). Before starting a server or watcher, check for an existing one for the same project or port and reuse it; on "address in use", stop the stale owner the run started instead of picking a new port.
- Stop processes when their piece finishes, and before removing a worktree. Never kill processes the run did not start.
- Clear test caches, coverage output, temporary build artefacts and scratch files the run produced once they are no longer needed. Leave the user's own caches and dependency stores alone.
- Watch CPU, memory and disk between waves; reduce concurrency when the machine is saturated.

## Monitoring subagents

- Check each running subagent at every orchestrator turn: running, waiting, errored, stopped, or finished.
- Waiting on a question the orchestrator can answer inside the brief: answer it. Errored or stalled: read its last output, diagnose, then resume with a correction or re-dispatch a narrowed brief. Two failed re-dispatches of the same piece go to the `cf:strategist` agent before any stop.
- A finished report is a claim. Inspect the diff and rerun the piece's verification before integrating.
- Merge piece branches into the integration branch one at a time and run the affected tests after each merge, then remove the piece's worktree.

## GitHub issue lifecycle

Only when the brief's Authority grants issue writes. Use the repository that owns the work. Create a missing label (additive) before its first use; if the brief did not grant label creation, skip labels and say so in the report.

| Moment | Label on the work's issue |
|---|---|
| Execution starts | `in progress` (create the issue from the brief if none exists) |
| Isolated agent review starts | `in review` |
| PR opened and review clean | `done`, with the PR linked |
| PR merged | `shipped` |

Keep exactly one of these labels on the issue at a time, and post a short comment at each transition with the evidence (PR link, review result, merge commit).

Unrelated findings (bugs, vulnerabilities, gaps, hardening opportunities outside the confirmed scope) become separate issues labelled `ai-handle`. Search open issues first and comment on a match instead of duplicating. Each issue states what was observed, where (file and line or command), why it matters, and a suggested fix. Never include secrets or personal data. Do not fix them in this run; that would leave the confirmed scope.

## Final isolated review

- Spawn a fresh `cf:code-auditor` subagent whose only context is the brief, the diff or PR, and the project's review playbook (`REVIEW.md` or equivalent) and product principles when present.
- Findings are fixed by the orchestrator or a fix subagent, then a new isolated review runs on the updated diff. Repeat until no blocking finding remains; record any accepted non-blocking finding with its reason in `brief.md`.

## Verification before finishing

Run, in the orchestrator, against the integrated branch: the project's type-check, lint, tests and build (whatever the project defines), each Done-means check, and a sweep confirming no process, worktree or cache the run started remains. Report any check that could not run as unverified.
