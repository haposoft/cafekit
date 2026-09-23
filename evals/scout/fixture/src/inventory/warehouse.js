// inventory/warehouse: tiện ích nhỏ của khu vực inventory.
function warehouse(input) {
  if (input === undefined || input === null) return null;
  return { area: "inventory", kind: "warehouse", value: input };
}

module.exports = { warehouse };
