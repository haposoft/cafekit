const { FREE_SHIPPING_FROM } = require("../config/shipping");

function shippingFee(cart) {
  if (cart.pickup) return 0;
  return cart.items.length && cart.subtotalHint >= FREE_SHIPPING_FROM ? 0 : 15000;
}

module.exports = { shippingFee };
