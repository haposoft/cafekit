---
type: regex
target: { source: file, path: test/price.test.js }
---

^const test = require\("node:test"\);
const assert = require\("node:assert"\);
const \{ subtotal, roundMoney \} = require\("\.\./src/price\.js"\);

test\("subtotal cộng giá nhân số lượng của từng dòng", \(\) => \{
  assert\.strictEqual\(subtotal\(\[\{ price: 10, qty: 2 \}, \{ price: 5, qty: 1 \}\]\), 25\);
\}\);

test\("roundMoney làm tròn xuống hai chữ số", \(\) => \{
  assert\.strictEqual\(roundMoney\(10\.999\), 10\.99\);
\}\);\n?$
