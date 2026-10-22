---
type: regex
target: { source: file, path: src/price.js }
---

function roundMoney\([^)]*\)\s*\{[^\n]*(?:\n(?!\})[^\n]*)*?\n[ \t]*(?!//)[^\n/]*?Math\.floor|function roundMoney\([^)]*\)\s*\{[ \t]*[^\n/}]*?Math\.floor
