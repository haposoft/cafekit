---
type: regex
target: { source: file, path: src/orders/paginate.js }
---

^(?![\s\S]*slice\([^)\n]*size\s*-\s*1)(?![\s\S]*\bend\s*=\s*start\s*\+\s*size\s*-\s*1)[\s\S]*(?:slice\(\s*start\s*,\s*start\s*\+\s*size\s*\)|slice\(\s*start\s*,\s*(?:page\s*\*\s*size|size\s*\*\s*page)\s*\)|slice\(\s*\(\s*page\s*-\s*1\s*\)\s*\*\s*size\s*,\s*(?:page\s*\*\s*size|size\s*\*\s*page)\s*\)|slice\(\s*start\s*\)\s*\.slice\(\s*0\s*,\s*size\s*\)|\bend\s*=\s*start\s*\+\s*size\b(?!\s*-)[\s\S]*slice\(\s*start\s*,\s*end\s*\))
