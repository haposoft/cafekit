// inventory/lowStock: tiện ích nhỏ của khu vực inventory.
function lowStock(input) {
  if (input === undefined || input === null) return null;
  return { area: "inventory", kind: "lowStock", value: input };
}

module.exports = { lowStock };
