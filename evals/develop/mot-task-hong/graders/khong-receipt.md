---
type: regex
target: { source: file, path: specs/doi-loi-chao/task-01-doi-loi-chao.md }
match: not_contains
---

## Receipt[^\n]*(\n(?!#{1,2}[ \t])[^\n]*)*?\n[ \t]*([-*][ \t]+|\d+[.)][ \t]+)?(\*\*)?(?:Verification|Command|Exit|Base|Head|Artifact|Result|Lệnh|Kết quả)(\*\*)?[ \t]*[:—–]|## Receipt[^\n]*(\n(?!#{1,2}[ \t])[^\n]*)*?\n[ \t]*(```|~~~)|## Receipt[^\n]*(\n(?!#{1,2}[ \t])[^\n]*)*?\n[ \t]*\|[ \t]*(\*\*)?(?:Verification|Command|Exit|Base|Head|Artifact|Result|Lệnh|Kết quả)|## Receipt[^\n]*(\n(?!#{1,2}[ \t])[^\n]*)*?-->[ \t]*(?:Verification|Command|Exit|Base|Head|Artifact|Result|Lệnh|Kết quả)
