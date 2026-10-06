require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { orderTotal } = require("../src/checkout");

test("cộng tiền hàng và phí ship", () => {
  assert.strictEqual(orderTotal([{ price: 100, qty: 2 }, { price: 50, qty: 1 }], 30), 280);
});
