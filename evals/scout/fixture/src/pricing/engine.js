const rules = require("./rules");

// Áp lần lượt từng quy tắc giá lên tạm tính của giỏ.
function priceSubtotal(subtotal, cart) {
  return rules.all.reduce((amount, rule) => rule.apply(amount, cart), subtotal);
}

module.exports = { priceSubtotal };
