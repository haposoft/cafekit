// Tổng tiền phải trả: tạm tính trừ giảm giá, rồi cộng thuế 5% trên phần còn lại (xem README.md).
const TAX_RATE = 0.05;

function cartTotal(subtotal, discount = 0) {
  const afterDiscount = subtotal - discount;
  return afterDiscount;
}

module.exports = { cartTotal, TAX_RATE };
