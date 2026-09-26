---
type: regex
target: { source: file, path: test/total.test.js }
---

^(?=[\s\S]*(?:^|\n)test\("tổng giỏ hàng có thuế 5%", \(\) => \{\n[ \t]*assert\.strictEqual\(cartTotal\(100\), 105\);)(?=[\s\S]*(?:^|\n)test\("giảm giá trừ trước khi tính thuế", \(\) => \{\n[ \t]*assert\.strictEqual\(cartTotal\(100, 20\), 84\);)
