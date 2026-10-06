---
type: regex
target: { source: file, path: specs/doi-loi-chao/task-01-doi-loi-chao.md }
---

(^|\n)[ \t]*([-*][ \t]*)?(\*\*)?Blocker(\*\*)?:(\*\*)?(?=[^\n]*node --test test/)(?=[^\n]*(MODULE_NOT_FOUND|Cannot find module))
