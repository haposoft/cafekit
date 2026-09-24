const { checkQty } = require("./qty");

function addItem(cart, item, qty) {
  cart.items.push({ ...item, qty: checkQty(qty) });
  return cart;
}

module.exports = { addItem };
