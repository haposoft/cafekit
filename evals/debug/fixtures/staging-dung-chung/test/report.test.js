const test = require("node:test");
const assert = require("node:assert");
const orders = require("../data/orders.local.json");
const { countCancelled } = require("../src/report/cancelled");

test("đếm đúng số đơn huỷ", () => {
  assert.strictEqual(countCancelled(orders), 2);
});
