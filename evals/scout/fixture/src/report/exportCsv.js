// report/exportCsv: tiện ích nhỏ của khu vực report.
function exportCsv(input) {
  if (input === undefined || input === null) return null;
  return { area: "report", kind: "exportCsv", value: input };
}

module.exports = { exportCsv };
