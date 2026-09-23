// catalog/product: tiện ích nhỏ của khu vực catalog.
function product(input) {
  if (input === undefined || input === null) return null;
  return { area: "catalog", kind: "product", value: input };
}

module.exports = { product };
