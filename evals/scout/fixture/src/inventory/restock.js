// inventory/restock: tiện ích nhỏ của khu vực inventory.
function restock(input) {
  if (input === undefined || input === null) return null;
  return { area: "inventory", kind: "restock", value: input };
}

module.exports = { restock };
