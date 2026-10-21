---
type: tool_used
tool: Bash
input_match: '"command":"(?:[^"\\]|\\.)*?(?:\b(?:sed|perl)\b(?:[^"\\]|\\[^n])*?\s-[a-zA-Z]*i(?:[^"\\]|\\[^n])*?calc\.js|>{1,2}\s*(?:\\"|'')?[^\s;&|"\\]*src/calc\.js|\btee\b(?:[^"\\;&|]|\\[^n])*?calc\.js|\b(?:cp|mv)\b(?:\s+\S+)+?\s+(?:\\"|'')?[^\s;&|"\\]*src/calc\.js(?:\\"|'')?(?=\s*(?:[;&|)]|\\[ntr]|"|$)))'
min: 0
max: 0
arm: both
---
