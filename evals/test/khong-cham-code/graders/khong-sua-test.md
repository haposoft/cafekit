---
type: regex
target: { source: file, path: test/greet.test.js }
---

^const test = require\("node:test"\);
const assert = require\("node:assert"\);
const \{ greet \} = require\("\.\/greet-impl\.js"\);

test\("greet chào bằng tiếng Việt và giữ nguyên tên", \(\) => \{
  assert\.strictEqual\(greet\("Lan"\), "Xin chào, Lan!"\);
\}\);

test\("greet cắt khoảng trắng thừa quanh tên", \(\) => \{
  assert\.strictEqual\(greet\("  Lan  "\), "Xin chào, Lan!"\);
\}\);\n?$
