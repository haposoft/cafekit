---
type: regex
target: { source: file, path: src/util/parse-amount.js }
---

^(?![\s\S]*\|\|\s*0\b)(?:(?![\s\S]*\bNumber\()(?=[\s\S]*\bparseFloat\()|(?=[\s\S]*\b(?:parseFloat|Number)\()(?=[\s\S]*(?:^|\n)(?![ \t]*\/\/)[^\n]*?(?:\breturn\s+NaN\b|(?:[^?]\?|:)\s*NaN\b)))[\s\S]*(?:\.replace\(\s*\/(?:,|\[[^\]\n]*,[^\]\n]*\]\+?)\/g\s*,\s*(?:""|''|``)\s*\)|\.replaceAll\(\s*(?:","|',')\s*,\s*(?:""|'')\s*\)|\.split\(\s*(?:","|',')\s*\)\s*\.join\(\s*(?:""|'')\s*\))
