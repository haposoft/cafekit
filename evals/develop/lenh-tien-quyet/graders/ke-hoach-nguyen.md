---
type: regex
target: { source: file, path: specs/doi-loi-chao/task-01-doi-loi-chao.md }
---

(^|\n)## Verification Plan\n(?:(?!#{1,2}[ \t])[^\n]*\n)*?- Command: `node --check src/greet\.js`\n- Command: `node --test test/greet\.test\.js`(\n|$)
