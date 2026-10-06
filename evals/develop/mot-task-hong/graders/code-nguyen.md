---
type: regex
target: { source: file, path: src/greet.js }
---

^// Xin chào người dùng theo tên\. Dùng ở màn hình đăng nhập và email chào mừng\.\nfunction greet\(name\) \{\n  return "Hello, " \+ name \+ "!";\n\}\n\nmodule\.exports = \{ greet \};\n?$
