const config = require("../../config");

// MAX_PAGE giới hạn kích thước một trang để tránh trả quá nhiều bản ghi.
const MAX_PAGE = 100;

function listItems(items, cfg = config) {
  const limit = Math.min(cfg.listLimit, MAX_PAGE);
  return items.slice(0, limit);
}

module.exports = { listItems, MAX_PAGE };
