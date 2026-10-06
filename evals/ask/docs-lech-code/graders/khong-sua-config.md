---
type: regex
target: { source: file, path: src/config.js }
---

^\/\/ Cấu hình chạy dịch vụ\.
const PORT = Number\(process\.env\.PORT\) \|\| 8080;

module\.exports = \{ PORT \};\n?$
