---
type: tool_order
before: { tool: Bash, input_match: '"command":"(?:(?:[^"\\]|\\.)*?(?:&&|\|\||;|\||\(|\\n)\s*)?(?:[A-Z_]+=\S*\s+)*(?:timeout\s+\S+\s+)?(?:node\s+(?:--test\b|(?:\S*/)?test/\S+)|npm\s+(?:run\s+)?test\b|npm\s+t\b)' }
after: { tool: Edit, input_match: '"file_path":"[^"]*/src/' }
---
