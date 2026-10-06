const test = require("node:test");
const assert = require("node:assert");
const { checkout } = require("../src/api/checkout");

const cart = (price) => ({ items: [{ price, qty: 1 }], pickup: true });

test("đơn trên ngưỡng được giảm 10%", () => {
  assert.strictEqual(checkout(cart(200000)).total, 180000);
});

test("đơn đúng ngưỡng 100.000đ được giảm 10%", () => {
  assert.strictEqual(checkout(cart(100000)).total, 90000);
});

test("đơn dưới ngưỡng không được giảm", () => {
  assert.strictEqual(checkout(cart(50000)).total, 50000);
});
