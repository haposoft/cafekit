const test = require("node:test");
const assert = require("node:assert");
const { greet } = require("../src/greet.js");

test("greet chào bằng tiếng Việt và giữ nguyên tên", () => {
  assert.strictEqual(greet("Lan"), "Xin chào, Lan!");
});

test("greet cắt khoảng trắng thừa quanh tên", () => {
  assert.strictEqual(greet("  Lan  "), "Xin chào, Lan!");
});
