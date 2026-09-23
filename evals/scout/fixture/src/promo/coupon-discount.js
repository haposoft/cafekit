// Mã giảm giá nhập tay; không liên quan tới giảm giá theo bậc.
const MIN_ORDER = 100000;

function applyCoupon(amount, coupon) {
  if (!coupon || amount < MIN_ORDER) return amount;
  return amount - coupon.value;
}

module.exports = { applyCoupon, MIN_ORDER };
