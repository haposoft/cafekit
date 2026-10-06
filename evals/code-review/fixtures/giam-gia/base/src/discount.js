// Mức giảm theo tổng đơn (VND, số nguyên).
function discountRate(total) {
  if (total >= 500000) return 0.10;
  return 0;
}

function finalPrice(total) {
  // VND không có đơn vị lẻ nên làm tròn về đồng.
  return Math.round(total * (1 - discountRate(total)));
}

module.exports = { discountRate, finalPrice };
