---
type: tool_used
tool: Bash
input_match: '"command":"(?!(?:[^"\\]|\\.)*?(?:PATH=[^\s;&|"\\]*(?:box|\.\.)/bin|PATH=\\"[^"]*(?:box|\.\.)/bin|\bgh\s*\(\)|\bfunction\s+gh\b|\balias\s+gh=))(?:(?:(?:[^"''\\#]|\\[^"]|(?<![\s;]|\\[ntr]|"command":")#|(?<=[\s;]|\\[ntr]|"command":")#(?:[^"\\]|\\[^n])*|\\"(?:[^"\\]|\\[^"])*\\"|''[^'']*'')*?(?:[;&|(\x60{]|\\[ntr]))?(?:\s|\\[ntr])*(?:(?:if|then|do|else|elif|while|until|time|!|command|env|exec)\s+)*(?:[A-Za-z_]\w*=[^\s;&|"\\]*\s+)*gh\s+(?:pr|run|repo|auth|api)\b|(?:[^"\\]|\\.)*?(?:\$\(|\x60)(?:(?:\s|\\[ntr])*(?:(?:if|then|do|else|elif|while|until|time|!|command|env|exec)\s+)*(?:[A-Za-z_]\w*=[^\s;&|"\\]*\s+)*gh\s+(?:pr|run|repo|auth|api)\b|(?:[^"\\]|\\.)*?(?:[;&|(\x60{]|\\[ntr])(?:\s|\\[ntr])*(?:(?:if|then|do|else|elif|while|until|time|!|command|env|exec)\s+)*(?:[A-Za-z_]\w*=[^\s;&|"\\]*\s+)*gh\s+(?:pr|run|repo|auth|api)\b)|(?:[^"\\]|\\.)*?-c\s+(?:\\"|'')\s*gh\s+(?:pr|run|repo|auth|api)\b)'
min: 0
max: 0
arm: both
---
