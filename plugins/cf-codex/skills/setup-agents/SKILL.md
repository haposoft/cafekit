---
name: cf-setup-agents
description: "Install or refresh the CafeKit agents (test_runner, code_auditor, and the rest) in the user's Codex agents directory. Run it once after installing or updating the CafeKit plugin."
user-invocable: true
disable-model-invocation: true
---

# Setup agents

Codex loads no agents from a plugin, so this skill copies the CafeKit agents into the user's Codex agents directory.

1. Run `{cafekit:setup-agents}` with no arguments, exactly as the CafeKit command table defines it. Never pass a target directory.
2. Report its output lines to the user unchanged. It adds missing agents, refreshes the ones it installed that nobody edited, and keeps every other file: an edited one (`kept (modified)`), one CafeKit did not install, or a symlink.
3. For each `collision:` line, tell the user that the repository's own agent with that name exists beside the installed one.
4. If it fails, report the error. Do not retry with another command, and do not write, edit, or delete agent files yourself.

Agents are read when a Codex session starts; tell the user to start a new session to use them.
