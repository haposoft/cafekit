const test = require("node:test");
const assert = require("node:assert");
const { roundTo } = require("../src/util/money");

test("làm tròn theo bước", () => {
  assert.strictEqual(roundTo(1234, 1000), 1000);
});
