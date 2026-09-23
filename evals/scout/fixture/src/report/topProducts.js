// report/topProducts: tiện ích nhỏ của khu vực report.
function topProducts(input) {
  if (input === undefined || input === null) return null;
  return { area: "report", kind: "topProducts", value: input };
}

module.exports = { topProducts };
