const test = require("node:test");
const assert = require("node:assert");
const { checkQty } = require("../src/cart/qty");

test("số lượng 0 bị từ chối", () => {
  assert.throws(() => checkQty(0));
});

test("số lượng dương được nhận", () => {
  assert.strictEqual(checkQty(2), 2);
});
