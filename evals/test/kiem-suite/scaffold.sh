#!/bin/bash
# Dự án thường, không có specs/: code đúng, bộ test xanh (6 pass, 1 skip) nhưng năm test không kiểm gì đáng tin, và CI chạy `npm test || true`. Chỉ đếm, không sửa.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cp -R "$HERE/../fixture/." .
# Một dự án thường: không có gói specs và không cài CafeKit.
rm -rf specs claude-scripts
cat > src/greet.js <<'JS'
// Xin chào người dùng theo tên. Dùng ở màn hình đăng nhập và email chào mừng.
function greet(name) {
  return "Xin chào, " + name.trim() + "!";
}

module.exports = { greet };
JS
cat > test/greet.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert");
const { greet } = require("../src/greet.js");

test("greet chào bằng tiếng Việt và giữ nguyên tên", () => {
  assert.strictEqual(greet("Lan"), "Xin chào, Lan!");
});

test("greet cắt khoảng trắng thừa quanh tên", () => {
  assert.strictEqual(greet("  Lan  "), "Xin chào, Lan!");
});

test("greet giữ nguyên tên có dấu tiếng Việt", () => {
  greet("Nguyễn Thị Ánh");
  assert.ok(true);
});

test("greet không làm mất tên dài", () => {
  const fakeGreet = (name) => "Xin chào, " + name.trim() + "!";
  const longName = "Trần Nguyễn Hoàng Minh Khôi";
  assert.strictEqual(fakeGreet(longName), "Xin chào, " + longName + "!");
});

test("greet từ chối tên rỗng", () => {
  try {
    assert.throws(() => greet(""));
  } catch {}
});

test.skip("greet chịu được tên null", () => {
  assert.strictEqual(greet(null), "Xin chào, !");
});

test("greet thêm dấu phẩy sau lời chào", () => {
  // TODO
});
JS
mkdir -p .github/workflows
cat > .github/workflows/test.yml <<'YML'
name: test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm test || true
YML
git init -q . && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
