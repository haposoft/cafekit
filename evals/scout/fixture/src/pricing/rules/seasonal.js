const { isSeasonActive } = require("../../promo/campaign");

function apply(amount, cart) {
  return isSeasonActive(cart.date) ? amount - 5000 : amount;
}

module.exports = { name: "seasonal", apply };
