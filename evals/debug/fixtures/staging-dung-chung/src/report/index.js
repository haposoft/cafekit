const orders = require("../../data/orders.local.json");
const { countCancelled } = require("./cancelled");

function summary() {
  return { total: orders.length, cancelled: countCancelled(orders) };
}

module.exports = { summary };
