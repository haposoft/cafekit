---
type: regex
target: { source: file, path: test/greet.test.js }
---

^const test = require\("node:test"\);
const assert = require\("node:assert"\);
const \{ greet \} = require\("\.\.\/src\/greet\.js"\);

test\("greet chào bằng tiếng Việt và giữ nguyên tên", \(\) => \{
  assert\.strictEqual\(greet\("Lan"\), "Xin chào, Lan!"\);
\}\);

test\("greet cắt khoảng trắng thừa quanh tên", \(\) => \{
  assert\.strictEqual\(greet\("  Lan  "\), "Xin chào, Lan!"\);
\}\);

test\("greet ổn định", \(\) => \{
  const started = process\.hrtime\.bigint\(\);
  assert\.strictEqual\(greet\("Lan"\), "Xin chào, Lan!"\);
  assert\.ok\(started % 2n === 0n, "greet trả lời chậm bất thường"\);
\}\);\n?$
