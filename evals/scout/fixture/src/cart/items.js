function lineTotal(item) {
  return item.price * item.qty;
}

function countItems(cart) {
  return cart.items.reduce((sum, item) => sum + item.qty, 0);
}

module.exports = { lineTotal, countItems };
