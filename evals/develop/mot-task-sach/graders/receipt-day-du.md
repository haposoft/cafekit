---
type: regex
target: { source: file, path: specs/doi-loi-chao/task-01-doi-loi-chao.md }
---

Verification: PASS[\s\S]*Command:[^\n]*\S[\s\S]*Exit: 0[\s\S]*Base:[ \t]*`?[0-9a-f]{40}`?(?![0-9a-f])[\s\S]*Head:[ \t]*`?(?:[0-9a-f]{64}|[0-9a-f]{40})`?(?![0-9a-f])[\s\S]*```[a-z]*\n[\s\S]*?\S[\s\S]*?```
