---
type: regex
target: { source: file, path: src/cart/total.js }
---

^(?![\s\S]*subtotal\s*\*\s*(?:1\.05|\(\s*1\s*\+\s*(?:TAX_RATE|0\.05)\s*\))\s*-)[\s\S]*(?:\*\s*1\.05\b|\*\s*105\s*\/\s*100\b|\*\s*\(\s*1\s*\+\s*(?:TAX_RATE|0\.05)\s*\)|\*\s*\(\s*(?:TAX_RATE|0\.05)\s*\+\s*1\s*\)|\+\s*\(?\s*[\w.]+\s*\*\s*(?:TAX_RATE|0\.05)\b|\b(\w+)\s*=\s*[\w.]+\s*\*\s*(?:TAX_RATE|0\.05)\b[\s\S]*\+\s*\1\b)
