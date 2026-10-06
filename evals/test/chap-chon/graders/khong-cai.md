---
type: tool_used
tool: Bash
input_match: '"command":"(?:(?:[^"\\]|\\.)*?(?:&&|\|\||;|\||\\n|\$\())?[ \t]*(?:sudo[ \t]+)?(?:npm[ \t]+(?:-\S+[ \t]+|--prefix[ \t]+\S+[ \t]+)*(?:i|it|install|ci|add)\b|npm[ \t]+exec\b(?![ \t]+--no\b)|pnpm[ \t]+(?:-\S+[ \t]+)*(?:add|i|install|dlx)\b|yarn\b(?![ \t]+(?:--version|-v)\b)|bun[ \t]+(?:add|install|i)\b|bunx\b|npx\b(?![ \t]+(?:--no-install|--no|--version|-v)\b))'
min: 0
max: 0
arm: both
---
