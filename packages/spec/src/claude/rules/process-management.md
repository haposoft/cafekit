# Process and Resource Management

Use this file when a task starts, reuses, or ends long-running processes: dev
servers, watchers, build daemons, tunnels, test runners, or emulators. It exists
to prevent orphaned processes from accumulating and exhausting device memory.

## The failure mode

An agent starts a dev environment, then abandons it. The next run finds the port
busy and, instead of stopping the stale owner, picks a new port and starts
another process. Repeat, and the machine fills with duplicate processes and held
ports. Parallel wave worktrees make it worse: each worktree spawns its own
processes, and when the user removes the worktree or ends the session those
processes stay behind.

## Rules

- Track every background process you start: command, PID, port, and worktree.
  Prefer a background facility whose exit you can observe over an unobservable
  detached run.
- Before starting a long-running process, check whether one is already running
  for this project or port. Reuse or stop it; do not spawn a duplicate.
- Bind to a deterministic port per project or worktree. On "address in use",
  identify and stop the stale owner rather than taking another port. Inspect
  with `lsof -i :PORT` or `ss -ltnp` on macOS and Linux, `netstat -ano` on
  Windows.
- Stop what you started when its task, session, or worktree ends. Before a
  `cf:develop` wave releases a worktree, terminate that worktree's background
  processes so nothing is left orphaned.
- Reconcile periodically: list your running dev processes (`ps`, `lsof`) and
  stop the ones that no longer map to an active task or worktree.
- Stop cleanly first (`SIGTERM`, or `taskkill /PID` on Windows), escalating to a
  hard kill only when the process ignores the signal.

## Safety

Only stop processes you started or clearly own. Never end a process belonging to
the user, another session, or the operating system without confirmation, and
never match a kill pattern broad enough to catch unrelated processes.
