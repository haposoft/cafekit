require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { paginate } = require("../src/orders/paginate");

const orders = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

test("trang 2 bắt đầu ở đơn thứ 11", () => {
  assert.strictEqual(paginate(orders, 2, 10)[0].id, 11);
});

test("danh sách rỗng cho trang rỗng", () => {
  assert.deepStrictEqual(paginate([], 1, 10), []);
});
