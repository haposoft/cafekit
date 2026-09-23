// catalog/images: tiện ích nhỏ của khu vực catalog.
function images(input) {
  if (input === undefined || input === null) return null;
  return { area: "catalog", kind: "images", value: input };
}

module.exports = { images };
