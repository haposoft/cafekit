const { TIER_THRESHOLD, TIER_RATE } = require("../../config/pricing");

// Giảm theo bậc: đơn từ ngưỡng trở lên được giảm TIER_RATE.
function apply(amount) {
  if (amount > TIER_THRESHOLD) {
    return amount * (1 - TIER_RATE);
  }
  return amount;
}

module.exports = { name: "tier-threshold", apply };
