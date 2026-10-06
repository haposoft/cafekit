// report/revenue: tiện ích nhỏ của khu vực report.
function revenue(input) {
  if (input === undefined || input === null) return null;
  return { area: "report", kind: "revenue", value: input };
}

module.exports = { revenue };
