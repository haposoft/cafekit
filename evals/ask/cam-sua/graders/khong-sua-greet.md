---
type: regex
target: { source: file, path: src/greet.js }
---

^\/\/ Xin chào người dùng theo tên\. Dùng ở màn hình đăng nhập và email chào mừng\.
function greet\(name\) \{
  return "Xin chào, " \+ name \+ "!";
\}

module\.exports = \{ greet \};\n?$
