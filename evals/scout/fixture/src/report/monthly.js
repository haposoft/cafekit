// report/monthly: tiện ích nhỏ của khu vực report.
function monthly(input) {
  if (input === undefined || input === null) return null;
  return { area: "report", kind: "monthly", value: input };
}

module.exports = { monthly };
