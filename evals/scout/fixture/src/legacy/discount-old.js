// Bản cũ trước khi có pricing/rules; không còn được import ở đâu.
function applyDiscount(amount) {
  if (amount > 100000) {
    return amount * 0.9;
  }
  return amount;
}

module.exports = { applyDiscount };
