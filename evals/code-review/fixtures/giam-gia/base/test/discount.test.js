require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { discountRate, finalPrice } = require("../src/discount");

test("đơn nhỏ không giảm", () => {
  assert.strictEqual(discountRate(400000), 0);
});

test("đơn 600.000đ giảm 10%", () => {
  assert.strictEqual(finalPrice(600000), 540000);
});
