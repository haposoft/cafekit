// report/daily: tiện ích nhỏ của khu vực report.
function daily(input) {
  if (input === undefined || input === null) return null;
  return { area: "report", kind: "daily", value: input };
}

module.exports = { daily };
