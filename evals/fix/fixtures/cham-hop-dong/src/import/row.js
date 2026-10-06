const { parseAmount } = require("../util/parse-amount");

// Đọc một dòng nhập liệu; số tiền không đọc được thì từ chối cả dòng.
function importRow(row) {
  const amount = parseAmount(row.amount);
  if (Number.isNaN(amount)) throw new Error("invalid amount: " + JSON.stringify(row.amount));
  return { id: row.id, amount };
}

module.exports = { importRow };
