const { lineTotal } = require("./items");
const { priceSubtotal } = require("../pricing/engine");
const { shippingFee } = require("../shipping/fee");

function cartTotal(cart) {
  const subtotal = cart.items.reduce((sum, item) => sum + lineTotal(item), 0);
  return priceSubtotal(subtotal, cart) + shippingFee(cart);
}

module.exports = { cartTotal };
