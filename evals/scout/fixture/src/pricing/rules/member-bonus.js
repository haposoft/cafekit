const { MEMBER_RATE } = require("../../config/pricing");

function apply(amount, cart) {
  return cart.member ? amount * (1 - MEMBER_RATE) : amount;
}

module.exports = { name: "member-bonus", apply };
