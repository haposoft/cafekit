function formatVnd(amount) {
  return amount.toLocaleString("vi-VN") + "đ";
}

module.exports = { formatVnd };
