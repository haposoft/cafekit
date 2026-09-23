const { TIER_RATE } = require("../config/pricing");

function discountLabel() {
  return `Giảm ${Math.round(TIER_RATE * 100)}% cho đơn từ 100.000đ`;
}

module.exports = { discountLabel };
