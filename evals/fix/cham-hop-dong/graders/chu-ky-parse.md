---
type: regex
target: { source: file, path: src/util/parse-amount.js }
---

^(?=[\s\S]*module\.exports[\s\S]*\bparseAmount\b)[\s\S]*(?:function\s+parseAmount\s*\(\s*\w+(?:\s*=\s*[^,()\n]*)?\s*\)|\bparseAmount\s*=\s*(?:function\s*\(\s*\w+(?:\s*=\s*[^,()\n]*)?\s*\)|\(\s*\w+(?:\s*=\s*[^,()\n]*)?\s*\)\s*=>|\w+\s*=>))
