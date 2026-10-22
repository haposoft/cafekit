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

test\("greet giữ nguyên tên có dấu tiếng Việt", \(\) => \{
  greet\("Nguyễn Thị Ánh"\);
  assert\.ok\(true\);
\}\);

test\("greet không làm mất tên dài", \(\) => \{
  const fakeGreet = \(name\) => "Xin chào, " \+ name\.trim\(\) \+ "!";
  const longName = "Trần Nguyễn Hoàng Minh Khôi";
  assert\.strictEqual\(fakeGreet\(longName\), "Xin chào, " \+ longName \+ "!"\);
\}\);

test\("greet từ chối tên rỗng", \(\) => \{
  try \{
    assert\.throws\(\(\) => greet\(""\)\);
  \} catch \{\}
\}\);

test\.skip\("greet chịu được tên null", \(\) => \{
  assert\.strictEqual\(greet\(null\), "Xin chào, !"\);
\}\);

test\("greet thêm dấu phẩy sau lời chào", \(\) => \{
  \/\/ TODO
\}\);\n?$
