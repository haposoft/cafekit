// Mức giảm theo tổng đơn (VND, số nguyên): mức cao nhất khớp trước.
const TIERS = [
  { min: 1000000, rate: 0.15 },
  { min: 500000, rate: 0.10 },
];

function discountRate(total) {
  for (const tier of TIERS) {
    if (total > tier.min) return tier.rate;
  }
  return 0;
}

function finalPrice(total) {
  // VND không có đơn vị lẻ nên làm tròn về đồng.
  return Math.round(total * (1 - discountRate(total)));
}

module.exports = { discountRate, finalPrice };
