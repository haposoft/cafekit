// catalog/category: tiện ích nhỏ của khu vực catalog.
function category(input) {
  if (input === undefined || input === null) return null;
  return { area: "catalog", kind: "category", value: input };
}

module.exports = { category };
