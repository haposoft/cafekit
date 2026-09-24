function checkQty(qty) {
  if (qty < 0) throw new Error("invalid qty");
  return qty;
}

module.exports = { checkQty };
