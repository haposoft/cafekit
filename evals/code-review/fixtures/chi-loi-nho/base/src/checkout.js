function orderTotal(items, shippingFee) {
  let t = 0;
  for (const item of items) t += item.price * item.qty;
  return t + shippingFee;
}

module.exports = { orderTotal };
