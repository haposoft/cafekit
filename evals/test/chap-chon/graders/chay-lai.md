---
type: tool_used
tool: Bash
input_match: '"command":"(?:(?:[^"\\]|\\.)*?(?:&&|\|\||;|\||\\n|\(|\{|(?:[ \t;]|\\n)(?:do|then|else)(?=[ \t])))?[ \t]*(?:(?:sudo|time|env|if|elif|while|until|!|timeout[ \t]+[0-9][0-9.]*[smhd]?|[A-Za-z_][A-Za-z0-9_]*=(?:[^ \t"\\]|\\.)*)[ \t]+)*(?:node[ \t]+--test\b|npm[ \t]+(?:run[ \t]+)?test)(?=[ \t]|&&|\|\||;|\||\\n|\)|")'
min: 2
arm: both
---
