require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { cartTotal } = require("../src/cart/total");

test("tổng giỏ hàng có thuế 5%", () => {
  assert.strictEqual(cartTotal(100), 105);
});

test("giảm giá trừ trước khi tính thuế", () => {
  assert.strictEqual(cartTotal(100, 20), 84);
});
