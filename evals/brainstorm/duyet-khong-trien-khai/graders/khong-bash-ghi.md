---
type: tool_used
tool: Bash
input_match: '"command":"(?:[^"\\]|\\.)*?(?:(?<![=\-])>{1,2}[ \t]*(?!\/dev\/null|&)[^ \t&|;)>]|(?<![\w-])(?:tee|mkdir|touch|cp|mv)(?![\w-])|(?<![\w-])sed(?:[ \t]+-[a-zA-Z]+)*[ \t]+-i|(?<![\w-])npm[ \t]+(?:install|i|ci)(?![\w-])|(?<![\w-])(?:pnpm|yarn)[ \t]+add(?![\w-])|writeFileSync|(?<![\w-])git(?:[ \t]+-[cC][ \t]+\S+)*[ \t]+(?:worktree|checkout[ \t]+-b|switch[ \t]+-c|commit|add)(?![\w-]))'
min: 0
max: 0
arm: both
---
