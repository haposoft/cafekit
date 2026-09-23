// catalog/search: tiện ích nhỏ của khu vực catalog.
function search(input) {
  if (input === undefined || input === null) return null;
  return { area: "catalog", kind: "search", value: input };
}

module.exports = { search };
