const { cartTotal } = require("../cart/total");
const { countItems } = require("../cart/items");

function summarize(cart) {
  return { total: cartTotal(cart), items: countItems(cart) };
}

module.exports = { summarize };
