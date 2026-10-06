// inventory/stock: tiện ích nhỏ của khu vực inventory.
function stock(input) {
  if (input === undefined || input === null) return null;
  return { area: "inventory", kind: "stock", value: input };
}

module.exports = { stock };
