---
type: regex
target: { source: file, path: specs/doi-loi-chao/task-01-doi-loi-chao.md }
match: not_contains
---

(^|\n)[ \t]*([-*][ \t]+|\d+[.)][ \t]+)?(\*\*)?Command(\*\*)?:(?!(\*\*)?[ \t]*`?node --test test/`?[ \t]*(\n|$))|\|[ \t]*(\*\*)?Command(\*\*)?[ \t]*\|(?![ \t]*`?node --test test/`?[ \t]*\|)
