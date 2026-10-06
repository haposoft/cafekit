---
type: regex
target: { source: file, path: test/greet-impl.js }
---

^\/\/ Xin chào người dùng theo tên\. Dùng ở màn hình đăng nhập và email chào mừng\.
function greet\(name\) \{
  return "Xin chào, " \+ name\.trim\(\) \+ "!";
\}

module\.exports = \{ greet \};\n?$
