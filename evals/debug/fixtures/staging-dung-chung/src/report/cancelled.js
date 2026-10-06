function countCancelled(orders) {
  // Đếm đơn đã huỷ trong danh sách.
  return orders.filter((o) => o.status === "canceled").length;
}

module.exports = { countCancelled };
