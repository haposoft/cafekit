---
type: tool_used
tool: Bash
input_match: '"command":"(?:(?:[^"\\]|\\.)*?(?:&&|\|\||;|\||\(|\\n)\s*)?(?:[A-Z_]+=\S*\s+)*(?:timeout\s+\S+\s+)?(?:node\s+(?:--test\b|(?:\S*/)?test/\S+)|npm\s+(?:run\s+)?test\b|npm\s+t\b|npx\s+(?:jest|vitest|mocha)\b)'
min: 0
max: 0
arm: both
---
