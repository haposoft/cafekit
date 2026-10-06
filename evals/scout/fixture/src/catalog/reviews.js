// catalog/reviews: tiện ích nhỏ của khu vực catalog.
function reviews(input) {
  if (input === undefined || input === null) return null;
  return { area: "catalog", kind: "reviews", value: input };
}

module.exports = { reviews };
