---
type: regex
target: last_message
match: not_contains
flags: i
---

(^|\n)[ \t]*(const|let|var|import|export|module\.exports|require\()[^\n]*|app\.(get|post|use)\(\s*[\x27"]/|passport\.(use|authenticate)\(|new\s+OAuth2Client\(
