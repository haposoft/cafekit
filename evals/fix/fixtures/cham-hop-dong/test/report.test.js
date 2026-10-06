require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { sumAmounts } = require("../src/report/sum");

test("cộng các số tiền đơn giản", () => {
  assert.strictEqual(sumAmounts(["10", "2.5", "7.5"]), 20);
});
