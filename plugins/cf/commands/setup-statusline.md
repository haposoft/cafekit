---
description: Turn on the CafeKit statusline in your Claude Code user settings
allowed-tools: Bash(node:*)
---

Run this command once with the Bash tool and report its output to the user in one or two lines:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-statusline.cjs"
```

It sets `statusLine` in `~/.claude/settings.json` only when none is set or the existing one is CafeKit's, and leaves any other statusLine unchanged. If it exits 1, show the user its message and stop; do not edit the settings file yourself.
