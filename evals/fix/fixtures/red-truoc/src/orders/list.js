const { paginate } = require("./paginate");

// Danh sách đơn hàng hiển thị cho người dùng, mặc định 10 đơn mỗi trang.
function listOrders(orders, page = 1, size = 10) {
  return { page, size, items: paginate(orders, page, size) };
}

module.exports = { listOrders };
