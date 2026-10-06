---
type: regex
target: { source: file, path: src/greet.js }
---

(?:function\s+greet\s*\(\s*(\w+)\s*\)[\s\S]*?(?:\+\s*\1\s*\+|\$\{\s*\1\s*\})|\bgreet\s*=\s*\(?\s*(\w+)\s*\)?\s*=>[\s\S]*?(?:\+\s*\2\s*\+|\$\{\s*\2\s*\}))
