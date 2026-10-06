// Trả về các phần tử thuộc một trang; page bắt đầu từ 1, size là số phần tử mỗi trang.
function paginate(items, page, size) {
  const start = (page - 1) * size;
  return items.slice(start, start + size - 1);
}

module.exports = { paginate };
