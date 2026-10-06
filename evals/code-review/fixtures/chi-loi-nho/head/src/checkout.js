function orderTotal(items, shippingFee) {
  let subtotal = 0;
  for (const item of items) subtotal += item.price * item.qty;
  console.log("here", subtotal);
  return subtotal + shippingFee;
}

module.exports = { orderTotal };
