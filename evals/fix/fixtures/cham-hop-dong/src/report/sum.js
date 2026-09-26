const { parseAmount } = require("../util/parse-amount");

// Cộng các số tiền của báo cáo.
function sumAmounts(texts) {
  return texts.reduce((total, text) => total + parseAmount(text), 0);
}

module.exports = { sumAmounts };
