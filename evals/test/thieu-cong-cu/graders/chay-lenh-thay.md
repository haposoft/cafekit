---
type: tool_used
tool: Bash
input_match: '"command":"(?:(?:[^"\\]|\\.)*?(?:&&|\|\||;|\||\\n|\$\())?[ \t]*(?:sudo[ \t]+)?(?:node[ \t]+--test\b(?!(?:[^"\\&;|]|\\.)*\.none\.)|npm[ \t]+(?:run[ \t]+)?test\b)'
min: 1
arm: both
---
