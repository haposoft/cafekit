// inventory/reserve: tiện ích nhỏ của khu vực inventory.
function reserve(input) {
  if (input === undefined || input === null) return null;
  return { area: "inventory", kind: "reserve", value: input };
}

module.exports = { reserve };
