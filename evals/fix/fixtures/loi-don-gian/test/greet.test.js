require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { greet } = require("../src/greet");

test("chào theo tên", () => {
  assert.strictEqual(greet("An"), "Xin chào, An!");
});
