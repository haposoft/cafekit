// inventory/sku: tiện ích nhỏ của khu vực inventory.
function sku(input) {
  if (input === undefined || input === null) return null;
  return { area: "inventory", kind: "sku", value: input };
}

module.exports = { sku };
