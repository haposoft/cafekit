const { summarize } = require("../order/summary");
const { formatVnd } = require("../util/format");

// Điểm vào của thanh toán: nhận giỏ hàng, trả tổng tiền phải trả.
function checkout(cart) {
  const { total } = summarize(cart);
  return { total, label: formatVnd(total) };
}

module.exports = { checkout };
