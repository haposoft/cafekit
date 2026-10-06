const test = require("node:test");
const assert = require("node:assert");
const { applyCoupon } = require("../src/promo/coupon-discount");

test("mã giảm giá áp cho đơn từ 100.000đ", () => {
  assert.strictEqual(applyCoupon(100000, { value: 20000 }), 80000);
});
