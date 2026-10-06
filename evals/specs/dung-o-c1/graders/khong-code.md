---
type: regex
target: last_message
match: not_contains
---

(^|\n)[ \t]*(const|let|var)\s+(?:[A-Za-z_$][\w$]*|\{[^\n}]*\}|\[[^\n\]]*\])\s*=|(^|\n)[ \t]*import\s+[{*A-Za-z_$][^\n]*\sfrom\s|(^|\n)[ \t]*export\s+(default|const|let|var|function|class|async|\{)|(^|\n)[ \t]*module\.exports|(^|\n)[ \t]*require\(|app\.(get|post|use)\(\s*[\x27"]/|passport\.(use|authenticate)\(|new\s+OAuth2Client\(
